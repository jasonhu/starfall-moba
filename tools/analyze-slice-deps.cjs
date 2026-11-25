#!/usr/bin/env node
/**
 * 切片依赖分析器：用 AST 精确统计某个行号区间内的顶层声明，
 * 与区间外代码之间的双向符号引用，判断该区间能否安全物理切片。
 *
 * 用法: node tools/analyze-slice-deps.cjs <startLine> <endLine> [label]
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const [, , sArg, eArg, label] = process.argv
const START = Number(sArg)
const END = Number(eArg)
const src = fs.readFileSync('src/kernel/starfall.core.js', 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// 1) 收集所有顶层声明符号 -> 声明所在行
const topDecls = new Map() // name -> line
for (const node of ast.body) {
  const line = node.loc.start.line
  if (node.type === 'FunctionDeclaration' && node.id) topDecls.set(node.id.name, line)
  else if (node.type === 'ClassDeclaration' && node.id) topDecls.set(node.id.name, line)
  else if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) {
      // 只取简单标识符绑定；解构模式暂不处理
      collectPattern(d.id, line)
    }
  }
}
function collectPattern(id, line) {
  if (!id) return
  if (id.type === 'Identifier') topDecls.set(id.name, line)
  else if (id.type === 'ArrayPattern') id.elements.forEach((e) => collectPattern(e, line))
  else if (id.type === 'ObjectPattern') id.properties.forEach((p) => collectPattern(p.value, line))
  else if (id.type === 'AssignmentPattern') collectPattern(id.left, line)
  else if (id.type === 'RestElement') collectPattern(id.argument, line)
}

// 2) 收集所有标识符引用（排除属性名、声明名本身）——按是否赋值/读取区分不必要，先统计引用点
// 用 scope 感知：只关心"自由引用"到顶层声明的。简化：遍历所有 Identifier，
// 但排除 MemberExpression.property（obj.foo 的 foo）与对象字面量 key。
const refLines = new Map() // name -> Set(line)
function addRef(name, line) {
  if (!topDecls.has(name)) return
  if (!refLines.has(name)) refLines.set(name, new Set())
  refLines.get(name).add(line)
}

walk.fullAncestor(ast, (node, _st, ancestors) => {
  if (node.type !== 'Identifier') return
  const parent = ancestors[ancestors.length - 2]
  if (!parent) return
  // 排除 a.b 里的 b
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
  // 排除对象字面量 key（非简写）
  if (parent.type === 'Property' && parent.key === node && !parent.shorthand && !parent.computed) return
  // 排除声明的 id 位置
  if (
    (parent.type === 'FunctionDeclaration' || parent.type === 'ClassDeclaration') &&
    parent.id === node
  ) return
  if (parent.type === 'VariableDeclarator' && parent.id === node) return
  // 排除 import/export 说明符
  if (/Import|Export/.test(parent.type)) return
  addRef(node.name, node.loc.start.line)
})

// 3) 计算交集
const insideDecls = [...topDecls.entries()].filter(([, l]) => l >= START && l <= END).map(([n]) => n)
const outsideDecls = [...topDecls.entries()].filter(([, l]) => l < START || l > END).map(([n]) => n)
const inSet = new Set(insideDecls)
const outSet = new Set(outsideDecls)

// 段内引用了哪些"段外顶层符号" -> 切片后必须 import 进来
const needsImport = new Map()
for (const name of outsideDecls) {
  const lines = refLines.get(name)
  if (!lines) continue
  const cnt = [...lines].filter((l) => l >= START && l <= END).length
  if (cnt) needsImport.set(name, cnt)
}

// 段外引用了哪些"段内顶层符号" -> 切片后必须 export 出去
const needsExport = new Map()
for (const name of insideDecls) {
  const lines = refLines.get(name)
  if (!lines) continue
  const cnt = [...lines].filter((l) => l < START || l > END).length
  if (cnt) needsExport.set(name, cnt)
}

const fmt = (m) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `${n}(${c})`)
    .join(' ')

console.log(`\n=== 切片依赖分析 [${START}, ${END}] ${label || ''} ===`)
console.log(`顶层声明总数: ${topDecls.size}`)
console.log(`段内顶层声明 (${insideDecls.length}): ${insideDecls.join(' ')}`)
console.log(`\n【段内 → 段外】需 import 的符号 (${needsImport.size}):`)
console.log('  ' + (fmt(needsImport) || '（无）'))
console.log(`\n【段外 → 段内】需 export 的符号 (${needsExport.size}):`)
console.log('  ' + (fmt(needsExport) || '（无）'))
console.log(`\n结论: ${needsImport.size === 0 && needsExport.size === 0 ? '✅ 完全独立，可直接切片' : `⚠️ 有 ${needsImport.size + needsExport.size} 个跨边界符号需处理`}`)
