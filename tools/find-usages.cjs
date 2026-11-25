#!/usr/bin/env node
/**
 * 引用面查询（改文件之前必跑）
 * ---------------------------------------------------------------
 * 两种用法：
 *   1) 查某个文件被谁 import（改文件名 / 改导出名 / 转 .ts 时必须先看这个）
 *      node tools/find-usages.cjs src/kernel/node-tree.ts
 *   2) 查某个符号在全项目的出现位置（含声明 / 引用 / 属性名 / 字符串）
 *      node tools/find-usages.cjs --symbol NodeTree
 *
 * 为什么需要它：改名或改后缀时，真正危险的不是被改的文件本身，而是**别处的调用方**。
 * 先看影响面，改完再用 check-import-surface.cjs 复核，才不会出现
 * 「core 改了、skeleton/models 忘了」这种漏改。
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOT = 'src'
const args = process.argv.slice(2)

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
const parse = (file) => {
  const code = fs.readFileSync(file, 'utf8')
  const kind = /\.tsx?$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  return ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind)
}

// ---------- 模式 1：谁 import 了这个文件 ----------
if (args[0] && !args[0].startsWith('--')) {
  const target = path.resolve(args[0])
  if (!fs.existsSync(target)) {
    console.error(`文件不存在: ${args[0]}`)
    process.exit(1)
  }
  const hits = []
  for (const f of files) {
    if (path.resolve(f) === target) continue
    const sf = parse(f)
    sf.forEachChild((node) => {
      if (!ts.isImportDeclaration(node)) return
      const spec = node.moduleSpecifier && node.moduleSpecifier.text
      if (!spec || !spec.startsWith('.')) return
      const base = path.resolve(path.dirname(f), spec)
      const cands = [base, base + '.js', base + '.ts', path.join(base, 'index.js'), path.join(base, 'index.ts')]
      if (/\.[jt]s$/.test(spec)) cands.push(base.replace(/\.js$/, '.ts'))
      if (!cands.includes(target)) return
      const names = []
      const clause = node.importClause
      if (clause) {
        if (clause.name) names.push('default')
        const nb = clause.namedBindings
        if (nb && ts.isNamedImports(nb)) nb.elements.forEach((el) => names.push(el.propertyName ? el.propertyName.text : el.name.text))
        if (nb && ts.isNamespaceImport(nb)) names.push(`* as ${nb.name.text}`)
      }
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      hits.push({ file: f, line, spec, names })
    })
  }
  console.log(`「${args[0]}」被 ${hits.length} 个模块引用：\n`)
  for (const h of hits) console.log(`  ${h.file}:${h.line}  import { ${h.names.join(', ')} } from '${h.spec}'`)
  if (!hits.length) console.log('  （无人引用）')
  process.exit(0)
}

// ---------- 模式 2：查符号 ----------
const idx = args.indexOf('--symbol')
if (idx < 0 || !args[idx + 1]) {
  console.error('用法: node tools/find-usages.cjs <文件>  或  --symbol <名字>')
  process.exit(1)
}
const symbol = args[idx + 1]

const rows = []
for (const f of files) {
  const sf = parse(f)
  ;(function visit(node, parent) {
    if (ts.isIdentifier(node) && node.text === symbol) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      let kind = '引用'
      if (parent) {
        if (
          (ts.isVariableDeclaration(parent) && parent.name === node) ||
          ((ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) && parent.name === node) ||
          (ts.isParameter(parent) && parent.name === node)
        )
          kind = '声明'
        else if ((ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isMethodDeclaration(parent) && parent.name === node)) kind = '属性/方法名'
        else if (ts.isPropertyAssignment(parent) && parent.name === node) kind = '对象键'
        else if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) kind = '导入导出名'
      }
      rows.push({ file: f, line, kind })
    } else if (ts.isStringLiteral(node) && node.text === symbol) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      rows.push({ file: f, line, kind: '字符串' })
    }
    ts.forEachChild(node, (c) => visit(c, node))
  })(sf, null)
}

const byKind = rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {})
console.log(`「${symbol}」共出现 ${rows.length} 处  ${JSON.stringify(byKind)}\n`)
for (const r of rows) console.log(`  [${r.kind}] ${r.file}:${r.line}`)
