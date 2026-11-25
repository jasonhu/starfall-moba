#!/usr/bin/env node
/**
 * 通用「按符号名搬迁」工具：把 core 中指定的顶层声明整块搬到独立模块。
 *
 * 用法：
 *   node tools/extract-symbols.cjs <outFile> <Name1,Name2,...> [--write] [--header "..."]
 *
 * 自动处理：
 *   1. 三个方向的 import：three（别名映射回官方名）、其它内核模块、core
 *   2. core 侧补内部 export（供新模块导入），避免重复声明
 *   3. 只做物理搬运：声明文本逐字节保留，相对顺序不变
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

const [, , outFile, nameList, ...rest] = process.argv
const WRITE = rest.includes('--write')
const headerIdx = rest.indexOf('--header')
const headerText = headerIdx >= 0 ? rest[headerIdx + 1] : ''
const CORE = 'src/kernel/starfall.core.js'

if (!outFile || !nameList) {
  console.error('用法: node tools/extract-symbols.cjs <outFile> <A,B,C> [--write] [--header "..."]')
  process.exit(1)
}
const targets = new Set(nameList.split(',').map((s) => s.trim()).filter(Boolean))

const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// ---- 顶层声明表 & three 别名映射 ----
const decls = []
const topDecl = new Set()
const importSrc = new Map()
const aliasToOfficial = new Map()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) {
      importSrc.set(s.local.name, n.source.value)
      if (n.source.value === 'three' && s.imported) aliasToOfficial.set(s.local.name, s.imported.name)
    }
    continue
  }
  const names = []
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') names.push(d.id.name)
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  names.forEach((x) => topDecl.add(x))
  decls.push({ node: n, names })
}

const picked = decls.filter((d) => d.names.length && d.names.every((x) => targets.has(x)))
const missing = [...targets].filter((t) => !picked.some((d) => d.names.includes(t)))
if (missing.length) {
  console.error('❌ 未找到这些顶层声明:', missing.join(', '))
  process.exit(2)
}

const movedNames = new Set(picked.flatMap((d) => d.names))

// ---- 初始化期依赖闸门 ----
// 顶层 const 的「初始化求值」若引用了留在 core 的 const、或任何 import 绑定，搬走后会在
// 模块初始化阶段读到 undefined / TDZ（真实踩过：status-vfx 的 ELEMENT_COLORS.frost）。
// 这里只检查初始化表达式的顶层，不进入嵌套函数体（那是调用期，安全）。
const coreConst = new Set()
const coreFn = new Set()
for (const d of decls) {
  if (d.node.type === 'VariableDeclaration') d.names.forEach((n) => coreConst.add(n))
  else d.names.forEach((n) => coreFn.add(n))
}
const initLevelRefs = (expr) => {
  const refs = new Set()
  ;(function w(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(w)
    if (typeof n.type !== 'string') return
    if (/Function(Expression|Declaration)$/.test(n.type) || n.type === 'ArrowFunctionExpression') return
    if (n.type === 'Identifier') refs.add(n.name)
    // 对象字面量的非计算键不是「读取绑定」：{ hp: '#f0584f' } 的 hp 是字符串键，
    // 不是 core 里的同名 const。2026-11-19 UI 图标层踩到：HUD_THEME_COLORS.hp 被误判为
    // 读取骨骼临时数组 hp。计算键 { [x]: 1 } 的 x 仍算真实引用。
    if (n.type === 'Property' && !n.computed) {
      w(n.value)
      return
    }
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      w(n[k])
    }
  })(expr)
  return refs
}
const unsafe = []
for (const d of picked) {
  if (d.node.type !== 'VariableDeclaration') continue
  for (const decl of d.node.declarations) {
    if (!decl.init) continue
    for (const r of initLevelRefs(decl.init)) {
      if (movedNames.has(r) || coreFn.has(r) || /^(Math|Object|Array|JSON|Number|String|Boolean|Map|Set|WeakMap|Date|RegExp)$/.test(r)) continue
      // 命中：留在 core 的 const。
      // import 绑定不算危险——新模块会从同一来源再 import 一次，拿到的是同一模块实例
      // （2026-11-19：GLSL 片段读 arena-palette 的 aL/BM 被误判，实测安全）
      if (coreConst.has(r) && !importSrc.has(r)) unsafe.push(`${d.names[0]}: 初始化期读取 ${r}`)
    }
  }
}
// ---- 跨模块可变状态写入闸门（2026-11-19 事故 #3）----
// 搬走 let/var 符号后，若 core 残留代码（尤其是顶层副作用块）仍给它赋值，运行时必崩：
// `let Y8/K8` 搬到 ui/dom-kit.js 后，core 的 pointermove 监听仍写 `Y8 = clientX`。
// 六道静态闸门全过（不是顶层声明、是副作用块赋值），只有浏览器错误边界抓到。
const mutableMoved = new Set()
for (const d of picked) {
  if (d.node.type !== 'VariableDeclaration' || d.node.kind === 'const') continue
  d.names.forEach((n) => mutableMoved.add(n))
}
const assignedOutside = new Set()
if (mutableMoved.size) {
  const pickedRanges = picked.map((d) => [d.node.start, d.node.end])
  ;(function scan(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(scan)
    if (typeof n.type !== 'string') return
    if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') {
      const target = n.type === 'AssignmentExpression' ? n.left : n.argument
      if (target && target.type === 'Identifier' && mutableMoved.has(target.name)) {
        const inPicked = pickedRanges.some(([a, b]) => n.start >= a && n.end <= b)
        if (!inPicked) assignedOutside.add(target.name)
      }
    }
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      scan(n[k])
    }
  })(ast)
}
if (assignedOutside.size) {
  console.error('⛔ 拒绝搬迁（core 残留代码仍在给搬走的可变绑定赋值，搬走必崩）：')
  ;[...assignedOutside].slice(0, 12).forEach((u) => console.error('   ' + u + ': core 内有赋值点'))
  console.error('   对策：在新模块导出 setXxx() setter，core 的赋值点改调 setter。')
  if (!rest.includes('--force-write')) process.exit(4)
  console.error('   ⚠️ --force-write：忽略闸门，风险自负')
}

if (unsafe.length) {
  console.error('⛔ 拒绝搬迁（初始化期会读到未定义的绑定，搬走必崩）：')
  ;[...new Set(unsafe)].slice(0, 12).forEach((u) => console.error('   ' + u))
  if (!rest.includes('--force-init')) {
    console.error('   确认安全（例如这些符号也会一起搬）再加 --force-init')
    process.exit(3)
  }
}

const movedRefs = new Set()
for (const { node } of picked) walk.simple(node, { Identifier: (id) => movedRefs.add(id.name) })

// 输出目录相对 core 目录（src/kernel/）的层级，用于把 core 视角的 import 源
// 重算为新模块视角（踩过的坑：抽到 render/ 子目录后 './fx/x' 应为 '../fx/x'）。
const CORE_DIR = path.dirname(CORE)
const OUT_DIR = path.dirname(outFile)
const KERNEL_PREFIX = 'src/kernel/'
const relOutFromKernel = outFile.startsWith(KERNEL_PREFIX) ? path.dirname(outFile.slice(KERNEL_PREFIX.length)) : ''
const outDepth = outFile.startsWith(KERNEL_PREFIX) ? (relOutFromKernel === '.' ? 0 : relOutFromKernel.split('/').length) : 0

/** 把 core 里写的 import 源（相对 src/kernel/）转成从输出目录出发的路径 */
function rebaseImport(srcPath) {
  if (!srcPath.startsWith('.') || srcPath.includes('starfall.core')) return srcPath
  // core 视角的绝对路径（不带扩展名统一处理）
  const abs = path.posix.normalize(path.posix.join(CORE_DIR, srcPath))
  let rel = path.posix.relative(OUT_DIR, abs)
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

const needThree = [...movedRefs].filter((n) => importSrc.get(n) === 'three')
const needModules = new Map()
for (const n of movedRefs) {
  const s = importSrc.get(n)
  // 接受 './' 与 '../' 开头（HERO_TABLE 来自 ../heroes/registry，之前被漏掉 → 反复手工补）
  if (s && (s.startsWith('./') || s.startsWith('../')) && !s.includes('starfall.core')) {
    const rebased = rebaseImport(s)
    if (!needModules.has(rebased)) needModules.set(rebased, [])
    needModules.get(rebased).push(n)
  }
}
const needCore = [...movedRefs].filter((n) => !movedNames.has(n) && topDecl.has(n) && !importSrc.has(n))

// 搬走后 core 仍引用的搬走符号
const restRefs = new Set()
for (const d of decls) {
  if (picked.includes(d)) continue
  walk.simple(d.node, { Identifier: (id) => restRefs.add(id.name) })
}
// 导出块里的 local 名也算「core 仍引用」——否则 `export { FS as SoundBank }` 会变成
// 未定义导出（踩过：SyntaxError: Export 'FS' is not defined）。
for (const n of ast.body) {
  if (n.type === 'ExportNamedDeclaration' && n.specifiers) for (const sp of n.specifiers) restRefs.add(sp.local.name)
}
const coreNeeds = [...movedNames].filter((n) => restRefs.has(n))

// ---- 生成新模块 ----
const imports = []
if (needThree.length)
  imports.push(`import { ${[...new Set(needThree)].map((n) => (aliasToOfficial.has(n) ? `${aliasToOfficial.get(n)} as ${n}` : n)).sort().join(', ')} } from 'three'`)
for (const [from, names] of needModules) imports.push(`import { ${[...new Set(names)].sort().join(', ')} } from '${from}'`)
// core 自身的路径也要 rebase：抽到 sim/ 子目录时 './starfall.core.js' 应为 '../starfall.core.js'
// （rebaseImport 会跳过 starfall.core，这里单独算）
const coreImportPath = (() => {
  const abs = path.posix.join(CORE_DIR, 'starfall.core.js')
  let rel = path.posix.relative(OUT_DIR, abs)
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
})()
if (needCore.length) imports.push(`import { ${[...new Set(needCore)].sort().join(', ')} } from '${coreImportPath}'`)

const body = picked.map((d) => src.slice(d.node.start, d.node.end))
const out =
  `/**\n * ${headerText || '从 starfall.core.js 抽出的模块'}\n *\n * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。\n */\n\n` +
  imports.join('\n') +
  '\n\n' +
  body.join('\n\n') +
  `\n\nexport { ${coreNeeds.sort().join(', ')} }\n`

// ---- 改 core ----
const ranges = picked.map((d) => [d.node.start, d.node.end]).sort((a, b) => b[0] - a[0])
let coreOut = src
for (const [s, e] of ranges) coreOut = coreOut.slice(0, s) + coreOut.slice(e)
coreOut = coreOut.replace(/\n{3,}/g, '\n\n')

// 在外部 import 锚点后插入导入
const anchor = 'import { buildVfxTemplates } from "../vfx/templates";'
if (!coreOut.includes(anchor)) throw new Error('找不到 import 锚点')
const rel = outFile.startsWith('src/kernel/') ? './' + outFile.slice('src/kernel/'.length) : outFile
coreOut = coreOut.replace(anchor, `${anchor}\nimport { ${coreNeeds.sort().join(', ')} } from '${rel}'`)

// 补内部导出（排除 core 自己仍声明的名字）
const existingExport = new Set()
{
  const a2 = acorn.parse(coreOut, { ecmaVersion: 'latest', sourceType: 'module' })
  // 只有「导出名 == 本地名」才算可被同名 import；`X as Y` 的别名导出不算
  for (const n of a2.body)
    if (n.type === 'ExportNamedDeclaration' && n.specifiers)
      n.specifiers.forEach((sp) => {
        if (sp.exported.name === sp.local.name) existingExport.add(sp.local.name)
      })
}
const stillDeclared = new Set()
{
  const a2 = acorn.parse(coreOut, { ecmaVersion: 'latest', sourceType: 'module' })
  for (const n of a2.body) {
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) stillDeclared.add(n.id.name)
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') stillDeclared.add(d.id.name)
  }
}
const exportNeeded = [...new Set(needCore)].filter((n) => stillDeclared.has(n) && !existingExport.has(n))
if (exportNeeded.length) coreOut = coreOut.trimEnd() + `\n\n// 供 ${outFile.split('/').pop()} 使用的内部符号\nexport { ${exportNeeded.sort().join(', ')} }\n`

console.log(`搬走 ${picked.length} 组声明 / ${movedNames.size} 个符号`)
console.log(`新模块需要：three ${needThree.length}、其它模块 ${needModules.size} 个来源、core ${new Set(needCore).size}`)
console.log(`core 需要从新模块导入 ${coreNeeds.length} 个；core 补导出 ${exportNeeded.length} 个`)
console.log(`core: ${src.split('\n').length} → ${coreOut.split('\n').length} 行；新模块 ${out.split('\n').length} 行`)

if (!WRITE) {
  console.log('[dry-run] 未写入')
  process.exit(0)
}
fs.writeFileSync(outFile, out)
fs.writeFileSync(CORE, coreOut)
// 语法自检
acorn.parse(out, { ecmaVersion: 'latest', sourceType: 'module' })
acorn.parse(coreOut, { ecmaVersion: 'latest', sourceType: 'module' })
console.log('✅ 已写入，两侧语法自检通过')
