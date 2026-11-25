#!/usr/bin/env node
/**
 * 闭包扩展器：给定种子顶层符号，递归纳入它依赖的所有 core 顶层声明，
 * 直到闭包「自包含」（不再引用闭包外的 core 声明）。
 *
 * 用途：拆解剩余「互相依赖」的声明组——单独抽会逃逸 N 个 core 符号，
 * 把逃逸符号也纳入闭包即可整体搬走。
 *
 * 用法：
 *   node tools/expand-closure.cjs <Seed1,Seed2,...> [--max N] [--json]
 */
const fs = require('fs')
const acorn = require('acorn')
const libScope = require('./lib-scope.cjs')

const [, , seedArg, ...rest] = process.argv
if (!seedArg) {
  console.error('用法: node tools/expand-closure.cjs <A,B,...> [--max N] [--json]')
  process.exit(1)
}
const seeds = seedArg.split(',').map((s) => s.trim()).filter(Boolean)
const maxIdx = rest.indexOf('--max')
const MAX = maxIdx >= 0 ? +rest[maxIdx + 1] : 60
const AS_JSON = rest.includes('--json')
const CORE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// 顶层声明：name -> 完整节点（同一 const 链的所有名字归为一组）
const groups = [] // { names:[], node }
const nameToGroup = new Map()
// core 的 import 绑定：这些符号虽然被闭包内代码引用，但已能从外部模块 import，
// 不应递归纳入闭包（否则会误把「已抽到其它模块的符号」当成待搬的 core 声明）。
const importedNames = new Set()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') { for (const s of n.specifiers) importedNames.add(s.local.name); continue }
  const names = []
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') names.push(d.id.name)
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  if (!names.length) continue
  const g = { names, node: n }
  groups.push(g)
  names.forEach((x) => nameToGroup.set(x, g))
}

// 每个顶层声明「节点内部」出现的标识符（含嵌套函数体）——用简单递归，排除属性名/对象 key/局部遮蔽由 nameToGroup 兜底
const refsCache = new Map()
function refsOf(g) {
  if (refsCache.has(g)) return refsCache.get(g)
  const set = new Set()
  ;(function walk(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return
    if (n.type === 'Identifier') { set.add(n.name); return }
    // 非计算属性 key 不是引用
    if (n.type === 'Property' && !n.computed) { walk(n.value); return }
    if (n.type === 'MemberExpression' && !n.computed) { walk(n.object); return }
    if (n.type === 'MethodDefinition' && !n.computed) { walk(n.value); return }
    if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration') return
    if (n.type === 'ExportNamedDeclaration') { if (n.declaration) walk(n.declaration); return }
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range', 'raw'].includes(k)) continue
      walk(n[k])
    }
  })(g.node)
  refsCache.set(g, set)
  return set
}

// 闭包扩展
const closure = new Set(seeds)
const missingSeeds = seeds.filter((s) => !nameToGroup.has(s))
if (missingSeeds.length) {
  console.error('❌ 种子符号不是 core 顶层声明:', missingSeeds.join(', '))
  process.exit(2)
}
let grew = true
let iterations = 0
while (grew && iterations++ < MAX) {
  grew = false
  const groupRefs = new Set()
  for (const name of closure) for (const r of refsOf(nameToGroup.get(name))) groupRefs.add(r)
  // groupRefs 中属于 core 顶层声明、但不在闭包内的 → 纳入
  for (const r of groupRefs) {
    if (closure.has(r) || !nameToGroup.has(r) || importedNames.has(r)) continue
    for (const extra of nameToGroup.get(r).names) if (!closure.has(extra)) { closure.add(extra); grew = true }
  }
}

const allNames = [...closure]
// 计算闭包整体对外的逃逸（应只剩非顶层符号：import 绑定 / 全局 / 未声明）
const groupRefs = new Set()
for (const name of closure) for (const r of refsOf(nameToGroup.get(name))) groupRefs.add(r)
const escape = [...groupRefs].filter((r) => !closure.has(r) && nameToGroup.has(r) && !importedNames.has(r))
const lines = closure.size
const startLine = Math.min(...[...closure].map((n) => nameToGroup.get(n).node.loc.start.line))
const endLine = Math.max(...[...closure].map((n) => nameToGroup.get(n).node.loc.end.line))

if (AS_JSON) {
  console.log(JSON.stringify({ seeds, allNames, escape, iterations, span: [startLine, endLine] }))
} else {
  console.log(`种子: ${seeds.join(', ')}`)
  console.log(`闭包: ${allNames.length} 个符号 / 覆盖行 ${startLine}-${endLine}（${endLine - startLine + 1} 行）/ ${iterations} 轮`)
  console.log(`闭包外 core 逃逸: ${escape.length} ${escape.length ? '→ ' + escape.join(', ') : '（无，自包含 ✅）'}`)
  console.log(`符号: ${allNames.join(', ')}`)
}
