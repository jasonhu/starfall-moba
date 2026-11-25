#!/usr/bin/env node
/**
 * 按调用关系给未命名函数聚类。
 *
 * 对每个短名顶层函数：
 *   - 找出所有调用点（CallExpression 的 callee 是它）
 *   - 找出调用点所属的「顶层声明」（按行范围归属）
 * 输出：函数 → 主要调用者聚类；以及「只被单个顶层声明调用」的强内聚簇。
 */
const fs = require('fs')
const acorn = require('acorn')

const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
const isShort = (n) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n)

// 顶层声明：名字 + 行范围
const tops = []
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') continue
  let name = null
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) name = n.id.name
  else if (n.type === 'VariableDeclaration') {
    const ids = n.declarations.filter((d) => d.id.type === 'Identifier').map((d) => d.id.name)
    name = ids.join(',')
  }
  tops.push({ name, start: n.loc.start.line, end: n.loc.end.line, type: n.type, node: n })
}
const ownerOfLine = (line) => {
  for (const t of tops) if (line >= t.start && line <= t.end) return t
  return null
}

// 收集调用关系
const calls = new Map() // callee -> [callerTopName]
const walk = (node, cb) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((n) => walk(n, cb))
  if (typeof node.type !== 'string') return
  cb(node)
  for (const k of Object.keys(node)) {
    if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
    walk(node[k], cb)
  }
}
walk(ast, (n) => {
  if (n.type !== 'CallExpression') return
  if (n.callee.type !== 'Identifier') return
  const name = n.callee.name
  if (!isShort(name)) return
  const owner = ownerOfLine(n.loc.start.line)
  if (!owner || owner.name === name) return
  if (!calls.has(name)) calls.set(name, [])
  calls.get(name).push(owner.name)
})

// 已语义化的函数名（用于判断聚类归属可读性）
const namedTops = new Set(tops.map((t) => t.name).filter((n) => n && !isShort(n.split(',')[0])))

const rows = []
for (const [fn, callers] of calls) {
  const uniq = [...new Set(callers)]
  rows.push({ fn, callers: uniq, count: callers.length, single: uniq.length === 1 })
}

// 只被单个顶层声明调用 → 强内聚
const exclusive = new Map() // owner -> [fn]
for (const r of rows) if (r.single) {
  const o = r.callers[0] || '(表达式语句)'
  if (!exclusive.has(o)) exclusive.set(o, [])
  exclusive.get(o).push(r.fn)
}
const sorted = [...exclusive.entries()].sort((a, b) => b[1].length - a[1].length)

console.log(`未命名函数被调用关系：${rows.length} 个有调用点`)
console.log(`其中「只被单个顶层声明调用」：${[...exclusive.values()].reduce((a, b) => a + b.length, 0)} 个，分布在 ${exclusive.size} 个宿主下\n`)
console.log('宿主（按内聚函数数量排序，前 18）：')
for (const [owner, fns] of sorted.slice(0, 18)) {
  const label = (owner || '(表达式语句)').length > 40 ? owner.slice(0, 40) + '…' : owner || '(表达式语句)'
  console.log(`  ${label.padEnd(42)} ${String(fns.length).padStart(3)} 个: ${fns.slice(0, 8).join(', ')}`)
}

fs.writeFileSync('/tmp/call-clusters.json', JSON.stringify(sorted.map(([owner, fns]) => ({ owner, fns })), null, 1))
console.log('\n写入 /tmp/call-clusters.json')
