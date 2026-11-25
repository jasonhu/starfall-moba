#!/usr/bin/env node
/**
 * 抽取模型层到 src/kernel/models.js
 *
 * 规则：
 *   1. 搬走：14 个模型构造器 + 「只被模型构造器引用」的顶层声明
 *   2. 不搬：初始化表达式引用 core 常量的顶层 const（会形成 TDZ），留在 core
 *   3. 自动生成双向 import：
 *        models.js 从 core 导入它需要的符号（这些只在函数体内使用，调用时已初始化）
 *        core 从 models.js 导入仍然被引用的模型符号
 *   4. 搬走的声明保持原有的相对顺序与源码文本（逐字节），只做物理移动
 *
 * 用法：node tools/extract-models.cjs [--write]
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const CORE = 'src/kernel/starfall.core.js'
const OUT = 'src/kernel/models.js'
const WRITE = process.argv.includes('--write')

const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const BUILDERS = ['fO', 'CU', 'BU', 'SU', 'yO', 'CO', 'SX', 'zU', 'MO', 'VU', 'JU', 'KU', 'Ec', 'lO']

// ---- 1) 顶层声明表 ----
const declNodes = [] // { node, names[], line }
const topDecl = new Set()
const importSrc = new Map()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) importSrc.set(s.local.name, n.source.value)
    continue
  }
  const names = []
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') names.push(d.id.name)
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  names.forEach((x) => topDecl.add(x))
  declNodes.push({ node: n, names, line: n.loc.start.line })
}

// ---- 2) 引用归属：谁引用谁（builder / core） ----
const referencedBy = new Map()
for (const { node, names } of declNodes) {
  const owner = node.type === 'FunctionDeclaration' && node.id && BUILDERS.includes(node.id.name) ? node.id.name : '__core__'
  walk.simple(node, {
    Identifier(id) {
      if (!topDecl.has(id.name)) return
      if (!referencedBy.has(id.name)) referencedBy.set(id.name, new Set())
      referencedBy.get(id.name).add(owner)
    },
  })
}

const modelOnly = new Set(
  [...referencedBy.entries()].filter(([n, s]) => !s.has('__core__') && !BUILDERS.includes(n)).map(([n]) => n)
)
let moveSet = new Set([...BUILDERS, ...modelOnly])

// ---- 3) 排除「初始化期依赖 core」的顶层 const 组 ----
const held = new Set()
const heldLines = []
for (const { node, names } of declNodes) {
  if (node.type !== 'VariableDeclaration') continue
  if (!names.some((x) => moveSet.has(x))) continue
  const refs = new Set()
  walk.simple(node, { Identifier(id) { refs.add(id.name) } })
  const external = [...refs].filter((r) => !moveSet.has(r) && topDecl.has(r) && !importSrc.has(r))
  if (external.length) {
    names.forEach((x) => held.add(x))
    heldLines.push({ names: names.join(','), line: node.loc.start.line, external: external.slice(0, 5) })
  }
}
held.forEach((x) => moveSet.delete(x))

// 不动点：被搬的顶层 const 若在「初始化求值阶段」引用了留在 core 的符号，也必须留下。
// 只分析初始化表达式的顶层（不进入嵌套函数体）——嵌套函数里的引用是调用期，安全。
const topLevelRefs = (expr) => {
  const refs = new Set()
  const calls = []
  ;(function w(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(w)
    if (typeof n.type !== 'string') return
    if (/Function(Expression|Declaration)$/.test(n.type) || n.type === 'ArrowFunctionExpression') return
    if (n.type === 'Identifier') refs.add(n.name)
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier') calls.push(n.callee.name)
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      w(n[k])
    }
  })(expr)
  return { refs, calls }
}

for (let changed = true; changed; ) {
  changed = false
  for (const { node, names } of declNodes) {
    if (node.type !== 'VariableDeclaration') continue
    if (!names.some((x) => moveSet.has(x))) continue
    let hold = false
    for (const d of node.declarations) {
      if (!d.init) continue
      const { refs, calls } = topLevelRefs(d.init)
      // 引用留在 core 的符号 → 留
      for (const r of refs) if (held.has(r) || (topDecl.has(r) && !moveSet.has(r) && !importSrc.has(r))) hold = true
      // 初始化期调用非模型函数 → 留
      for (const c of calls) if (!moveSet.has(c)) hold = true
    }
    if (hold) {
      names.forEach((x) => {
        if (moveSet.has(x)) {
          held.add(x)
          moveSet.delete(x)
        }
      })
      changed = true
    }
  }
}

// ---- 4) 选块 ----
const moved = declNodes.filter((d) => d.names.length && d.names.every((x) => moveSet.has(x)))
const movedNames = new Set(moved.flatMap((d) => d.names))

// ---- 5) 双向引用 ----
const refsIn = (nodes) => {
  const s = new Set()
  for (const { node } of nodes) walk.simple(node, { Identifier(id) { s.add(id.name) } })
  return s
}
const movedRefs = refsIn(moved)
const coreRefsIntoSelf = movedRefs.has('__never__') // 占位

// models.js 需要从 core 导入：被搬代码引用、但不在搬走集合、且在 core 顶层声明
const needFromCore = [...movedRefs].filter((n) => !movedNames.has(n) && topDecl.has(n) && !importSrc.has(n))
// models.js 需要从 three 导入
const needFromThree = [...movedRefs].filter((n) => importSrc.get(n) === 'three')
// models.js 需要从其它内核模块导入
const needFromModules = [...movedRefs]
  .filter((n) => {
    const s = importSrc.get(n)
    return s && s.startsWith('./') && s !== './starfall.core.js'
  })
  .map((n) => ({ name: n, from: importSrc.get(n) }))

// 搬走后，core 里仍被引用的搬走符号 → 需要 core 从 models.js 导入
const remainingRefs = refsIn(declNodes.filter((d) => !moved.includes(d)))
const coreNeedsFromModels = [...movedNames].filter((n) => remainingRefs.has(n))

// ---- 6) 生成 ----
const importLines = []
if (needFromThree.length) importLines.push(`import { ${[...new Set(needFromThree)].sort().join(', ')} } from 'three'`)
const byMod = new Map()
for (const { name, from } of needFromModules) {
  if (!byMod.has(from)) byMod.set(from, [])
  byMod.get(from).push(name)
}
for (const [from, names] of byMod) importLines.push(`import { ${names.sort().join(', ')} } from '${from}'`)
if (needFromCore.length) importLines.push(`import { ${[...new Set(needFromCore)].sort().join(', ')} } from './starfall.core.js'`)

const blocks = moved.map((d) => src.slice(d.node.start, d.node.end))
const header = `/**
 * 程序化模型层（从 starfall.core.js 抽出）
 * ===============================================================
 * 内容：14 个模型构造器（英雄/怪物/建筑）及其专用辅助函数与配色。
 *   fO  四足巨兽     yO  四足兽（小）   CO  四足兽（中）   lO  四足兽（坐骑）
 *   CU  持弓         BU  弓手（变体）    SU  持剑           SX  项羽（骨架段）
 *   zU  持盾         VU  法系           MO  法阵/召唤物
 *   JU · KU · Ec     建筑/塔/道具
 * 说明：仅做物理搬运，声明文本与顺序未改动；被 core 引用的构造器在文件末尾导出。
 * 变更后请同步 kernel/SECTIONS.md。
 */

`
const footer = `\nexport { ${coreNeedsFromModels.sort().join(', ')} }\n`

let out = header + importLines.join('\n') + '\n\n' + blocks.join('\n\n') + footer

// ---- 7) 从 core 删除并加 import ----
const removeRanges = moved.map((d) => [d.node.start, d.node.end]).sort((a, b) => b[0] - a[0])
let coreOut = src
for (const [s, e] of removeRanges) coreOut = coreOut.slice(0, s) + coreOut.slice(e)

const coreImport = `import { ${coreNeedsFromModels.sort().join(', ')} } from './models.js'\n`
// 插到第一条 import 之后，保持文件头整洁
const firstImportEnd = coreOut.indexOf('\n', coreOut.indexOf("import ")) + 1
coreOut = coreOut.slice(0, firstImportEnd) + coreImport + coreOut.slice(firstImportEnd)

console.log(`搬走声明 ${moved.length} 组 / 符号 ${movedNames.size} 个`)
console.log(`留在 core（初始化期依赖）: ${held.size} 个符号，${heldLines.length} 组`)
heldLines.slice(0, 6).forEach((h) => console.log(`   ${h.names} @${h.line} → ${h.external.join(',')}`))
console.log(`models.js 需要 three: ${needFromThree.length}，需要 core: ${needFromCore.length}，需要其它模块: ${needFromModules.length}`)
console.log(`core 需要从 models 导入: ${coreNeedsFromModels.length} 个 (${coreNeedsFromModels.join(', ')})`)

if (!WRITE) {
  console.log('\n[dry-run] 未写入')
  process.exit(0)
}
fs.writeFileSync(OUT, out)
fs.writeFileSync(CORE, coreOut)
console.log(`\n已写入 ${OUT}（${out.split('\n').length} 行）`)
console.log(`core: ${src.split('\n').length} → ${coreOut.split('\n').length} 行`)
