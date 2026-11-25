#!/usr/bin/env node
/**
 * 导入 / 导出契约校验（改文件前必跑）
 * ---------------------------------------------------------------
 * 解决的问题：改一个模块的文件后缀、导出名或文件位置时，**别的文件里的 import 必须同步改**。
 * 这类错误在 tsc 里不一定报（.js 不受类型检查），在 audit 里也抓不到（它只看自由标识符），
 * 只有 build 才会报 —— 而且如果漏改的是「同名的另一个文件」还可能静默错。
 *
 * 本脚本对 src/ 下所有 .js / .ts 做静态校验：
 *   1. 每个相对 import 的路径必须能解析到真实文件（含 .js→.ts 映射、index 文件）
 *   2. 每个具名 import 的符号，必须在目标模块的导出集合里
 *   3. 顺带报告「导出但全项目无人 import」的孤立符号（可选，仅提示）
 *
 * 用法：
 *   node tools/check-import-surface.cjs            # 校验
 *   node tools/check-import-surface.cjs --orphans  # 额外列出孤立导出
 *
 * 退出码：0 = 契约完整；1 = 有问题
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOT = 'src'
const SHOW_ORPHANS = process.argv.includes('--orphans')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(js|ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(ROOT)

function parseFile(file) {
  const code = fs.readFileSync(file, 'utf8')
  const kind = file.endsWith('.ts') || file.endsWith('.tsx') ? ts.ScriptKind.TS : ts.ScriptKind.JS
  return ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind)
}

const hasExportModifier = (node) => {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return !!mods && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** 收集一个模块对外暴露的名字（含类型导出） */
function collectExports(sf) {
  const names = new Set()
  for (const st of sf.statements) {
    // export { a, b as c } / export type { T }
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) names.add(el.name.text)
      continue
    }
    // export * from '...' —— 无法静态确定，记为通配
    if (ts.isExportDeclaration(st) && !st.exportClause) {
      names.add('*')
      continue
    }
    // export default
    if (ts.isExportAssignment(st)) {
      names.add('default')
      continue
    }
    if (!hasExportModifier(st)) continue

    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text)
    } else if (st.name && ts.isIdentifier(st.name)) {
      names.add(st.name.text)
    }
  }
  return names
}

/** 路径解析：支持 './x'、'./x.js'（→ x.ts）、'./x/index.*' */
function resolveSpec(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  const tried = []
  const push = (p) => {
    if (!tried.includes(p)) tried.push(p)
  }
  push(base)
  // `./x.js` → `x.ts` 的映射只在 TS 源文件里成立（TS 的 ESM 惯例）；
  // 在 .js 文件里写 './x.js' 时，rollup/vite 会按字面解析，找不到就报错。
  // 这条区分很关键：node-tree 转 ts 时 core(.js) 里残留 './node-tree.js' 就是这么漏的。
  const fromTs = /\.tsx?$/.test(fromFile)
  if (fromTs && spec.endsWith('.js')) {
    push(base.slice(0, -3) + '.ts')
    push(base.slice(0, -3) + '.tsx')
  }
  if (!/\.(js|ts|tsx)$/.test(spec)) {
    push(base + '.js')
    push(base + '.ts')
    push(base + '.tsx')
    push(path.join(base, 'index.js'))
    push(path.join(base, 'index.ts'))
  }
  for (const p of tried) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return { file: p }
  }
  return { missing: true, tried }
}

// ---- 建立模块表 ----
const mods = new Map() // 绝对路径 -> { exports, imports: [{spec, symbols, line}] }
for (const f of files) {
  const sf = parseFile(f)
  const exports = collectExports(sf)
  const imports = []
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) return
    const spec = node.moduleSpecifier && node.moduleSpecifier.text
    if (!spec) return
    const symbols = []
    const clause = node.importClause
    if (clause) {
      if (clause.name) symbols.push({ imported: 'default', local: clause.name.text })
      const nb = clause.namedBindings
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          symbols.push({
            imported: el.propertyName ? el.propertyName.text : el.name.text,
            local: el.name.text,
          })
        }
      }
    }
    imports.push({ spec, symbols, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, typeOnly: !!clause?.isTypeOnly })
  })
  mods.set(path.resolve(f), { exports, imports, file: f })
}

// ---- 校验 ----
const problems = []
const importedNames = new Set()

for (const [abs, info] of mods) {
  for (const imp of info.imports) {
    if (!imp.spec.startsWith('.')) continue // 外部包（three 等）不校验

    const res = resolveSpec(abs, imp.spec)
    if (res.missing) {
      problems.push(`${info.file}:${imp.line} 路径无法解析：'${imp.spec}'（尝试 ${res.tried.length} 个候选）`)
      continue
    }
    const target = mods.get(path.resolve(res.file))
    if (!target) continue

    for (const s of imp.symbols) {
      importedNames.add(`${path.resolve(res.file)}::${s.imported}`)
      if (target.exports.has('*')) continue
      if (!target.exports.has(s.imported)) {
        problems.push(
          `${info.file}:${imp.line} 目标模块未导出 '${s.imported}'（来自 '${imp.spec}'，该模块导出 ${target.exports.size} 个符号）`,
        )
      }
    }
  }
}

// ---- 孤立导出（仅提示）----
const orphans = []
if (SHOW_ORPHANS) {
  for (const [abs, info] of mods) {
    for (const name of info.exports) {
      if (name === '*' || name === 'default') continue
      if (!importedNames.has(`${abs}::${name}`)) orphans.push(`${info.file} → ${name}`)
    }
  }
}

// ---- 报告 ----
console.log(`扫描 ${mods.size} 个模块`)
if (problems.length) {
  console.log(`\n❌ 发现 ${problems.length} 处导入/导出契约问题：`)
  problems.slice(0, 30).forEach((p) => console.log('  ' + p))
  if (problems.length > 30) console.log(`  … 其余 ${problems.length - 30} 处略`)
} else {
  console.log('✅ 导入/导出契约完整（路径全部可解析、具名导入全部有对应导出）')
}

if (SHOW_ORPHANS) {
  console.log(`\n孤立导出 ${orphans.length} 个（导出但无人 import，仅供参考）：`)
  orphans.slice(0, 40).forEach((o) => console.log('  ' + o))
  if (orphans.length > 40) console.log(`  … 其余 ${orphans.length - 40} 个略`)
}

process.exit(problems.length ? 1 : 0)
