#!/usr/bin/env node
/**
 * 切片簇规划器（v1）
 * ---------------------------------------------------------------
 * 目的：面对 3 万行的内核，人工找「自洽的连续声明簇」太慢。本工具按声明顺序
 * 扫描，把连续声明聚成块，并统计每块「向外逃逸」的符号数——逃逸越少越适合
 * 物理切片（逃逸 = 需要从块外 import 的顶层符号）。
 *
 * 用法：
 *   node tools/plan-clusters.cjs [--max-lines 600] [--max-escape 6] [--min-lines 80]
 *
 * 输出：候选窗口（行范围 / 行数 / 逃逸符号清单 / 声明名预览），按行数降序。
 * 说明：只做「建议」，切片前仍需 analyze-slice-deps 复核 + 人工确认语义。
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf('--' + name)
  return i >= 0 ? Number(args[i + 1]) : def
}
const MAX_LINES = opt('max-lines', 700)
const MAX_ESCAPE = opt('max-escape', 6)
const MIN_LINES = opt('min-lines', 60)

const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// ---- 顶层声明 ----
const decls = []
const imported = new Set()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) imported.add(s.local.name)
    continue
  }
  const names = []
  if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) if (d.id.type === 'Identifier') names.push(d.id.name)
  } else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  if (!names.length) continue
  // 该声明引用的「其它顶层符号」
  const refs = new Set()
  walk.simple(n, { Identifier: (id) => refs.add(id.name) })
  decls.push({ names, refs, start: n.loc.start.line, end: n.loc.end.line, node: n })
}
const owner = new Map() // symbol -> decl index
decls.forEach((d, i) => d.names.forEach((nm) => owner.set(nm, i)))

// 每个声明实际依赖的「别的声明」
decls.forEach((d) => {
  d.depIdx = new Set()
  for (const r of d.refs) {
    const o = owner.get(r)
    if (o !== undefined && !d.names.includes(r)) d.depIdx.add(o)
  }
})

// ---- 贪心聚类：连续声明打包，控制逃逸 ----
const groups = []
let i = 0
while (i < decls.length) {
  let last = i
  const inside = new Set([i])
  const escapes = () => {
    const out = new Set()
    for (const k of inside) for (const dep of decls[k].depIdx) if (!inside.has(dep)) out.add(dep)
    return out
  }
  while (last + 1 < decls.length) {
    const next = last + 1
    const lines = decls[next].end - decls[i].start + 1
    if (lines > MAX_LINES) break
    inside.add(next)
    if (escapes().size > MAX_ESCAPE) {
      inside.delete(next)
      break
    }
    last = next
  }
  const lines = decls[last].end - decls[i].start + 1
  const esc = escapes()
  if (lines >= MIN_LINES) {
    groups.push({ from: i, to: last, lineStart: decls[i].start, lineEnd: decls[last].end, lines, escapes: [...esc].map((k) => decls[k].names[0]), names: decls.slice(i, last + 1).flatMap((d) => d.names) })
  }
  i = last + 1
}

groups.sort((a, b) => b.lines - a.lines)
console.log(`候选簇 ${groups.length} 个（max-lines=${MAX_LINES} max-escape=${MAX_ESCAPE} min-lines=${MIN_LINES}）\n`)
for (const g of groups.slice(0, 40)) {
  console.log(
    `${String(g.lines).padStart(5)} 行  ${String(g.lineStart).padStart(6)}-${String(g.lineEnd).padEnd(6)} 逃逸${String(g.escapes.length).padStart(2)}  ${g.escapes.slice(0, 8).join(',')}`
  )
  console.log(`        声明: ${g.names.slice(0, 18).join(',')}${g.names.length > 18 ? ' …' : ''}`)
}
