#!/usr/bin/env node
/**
 * 自动找出内核中"可安全物理切片"的连续声明块。
 * 安全判据：块内所有顶层声明引用的符号都落在块内（段内→段外 = 0），
 * 即切出去后新模块无需 import 内核任何东西（不会形成循环依赖）。
 *
 * 用法: node tools/find-slice-candidates.cjs [minLines]
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const MIN_LINES = Number(process.argv[2] || 150)
const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// 顶层声明节点（排除 import/export）
const decls = ast.body.filter(
  (n) => n.type.startsWith('VariableDeclaration') || n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration'
)

const declaredNames = (n) => {
  const out = []
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) out.push(n.id.name)
  else if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) {
      const p = (id) => {
        if (!id) return
        if (id.type === 'Identifier') out.push(id.name)
        else if (id.type === 'ArrayPattern') id.elements.forEach(p)
        else if (id.type === 'ObjectPattern') id.properties.forEach((x) => p(x.value))
        else if (id.type === 'AssignmentPattern') p(id.left)
        else if (id.type === 'RestElement') p(id.argument)
      }
      p(d.id)
    }
  return out
}

// name -> 声明节点下标
const nameToIdx = new Map()
decls.forEach((d, i) => declaredNames(d).forEach((n) => nameToIdx.set(n, i)))

// 每个声明引用了哪些"其他顶层声明"（下标集合）
const refIdx = decls.map((d, i) => {
  const s = new Set()
  walk.simple(d, {
    Identifier(node) {
      // 简化：排除属性名与对象 key（与 analyze 脚本一致）
      // 用 parent 需要 fullAncestor，这里用另一种方式：只要名字在 nameToIdx 就算引用
      const idx = nameToIdx.get(node.name)
      if (idx !== undefined && idx !== i) s.add(idx)
    },
  })
  return s
})

// 找闭包块：对每个起点 i，扩展 j 直到 refs[i..j] 全部 ⊆ [i..j]
const candidates = []
for (let i = 0; i < decls.length; i++) {
  let j = i
  const need = new Set()
  // 迭代：纳入 [i..j] 的引用，若引用到 >j 的声明则扩展 j
  let changed = true
  while (changed) {
    changed = false
    for (let k = i; k <= j; k++) {
      for (const idx of refIdx[k]) {
        if (!need.has(idx)) {
          need.add(idx)
          if (idx > j) { j = idx; changed = true }
        }
      }
    }
  }
  // 若 need 含 <i 的下标，说明该块向外（前）依赖，不安全，跳过
  if ([...need].some((idx) => idx < i)) continue
  const startLine = decls[i].loc.start.line
  const endLine = decls[j].loc.end.line
  const lines = endLine - startLine + 1
  if (lines >= MIN_LINES && j >= i) {
    candidates.push({ i, j, startLine, endLine, lines, declCount: j - i + 1, names: decls.slice(i, j + 1).flatMap(declaredNames) })
  }
}

// 去重：同一 [i,j] 保留一次；按块内声明数升序（优先小而清晰），行数适中优先
const seen = new Set()
const uniq = candidates.filter((c) => {
  const k = `${c.i}-${c.j}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

console.log(`顶层声明总数: ${decls.length}`)
console.log(`找到 ${uniq.length} 个候选块（>= ${MIN_LINES} 行，段内→段外=0）\n`)
uniq
  .sort((a, b) => a.lines - b.lines)
  .slice(0, 40)
  .forEach((c, n) => {
    const sample = c.names.slice(0, 8).join(' ') + (c.names.length > 8 ? ' …' : '')
    console.log(
      `${String(n + 1).padStart(2)}. [${c.startLine}-${c.endLine}] ${String(c.lines).padStart(5)}行 ${String(c.declCount).padStart(3)}声明 :: ${sample}`
    )
  })
