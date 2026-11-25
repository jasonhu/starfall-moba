#!/usr/bin/env node
/**
 * 计算 Three.js 区域（默认 3675-20038）内声明的所有顶层符号，
 * 哪些被「区域外」的代码引用 —— 这些才是必须从官方 three 引入的公共 API。
 *
 * 同时把 audio-constants.js（已切出的 three 常量链）也算作 three 区域的一部分。
 *
 * 用法：node tools/three-api-surface.cjs [start] [end]
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

const START = Number(process.argv[2] || 3675)
const END = Number(process.argv[3] || 20038)
const CORE = 'src/kernel/starfall.core.js'

const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// ---- 1) three 区域内声明的顶层符号 ----
const inRegion = new Set()
const declNodes = []
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') continue
  const s = n.loc.start.line,
    e = n.loc.end.line
  const inside = s >= START && e <= END
  if (!inside) continue
  declNodes.push(n)
  const addId = (id) => {
    if (!id) return
    if (id.type === 'Identifier') inRegion.add(id.name)
    else if (id.type === 'ArrayPattern') id.elements.forEach(addId)
    else if (id.type === 'ObjectPattern') id.properties.forEach((p) => addId(p.value || p.argument))
    else if (id.type === 'AssignmentPattern') addId(id.left)
    else if (id.type === 'RestElement') addId(id.argument)
  }
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) addId(n.id)
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) addId(d.id)
}

// 加上已切出的 three 常量模块
const CONST_MOD = 'src/kernel/audio-constants.js'
const constSrc = fs.readFileSync(CONST_MOD, 'utf8')
const constAst = acorn.parse(constSrc, { ecmaVersion: 'latest', sourceType: 'module' })
let constCount = 0
for (const n of constAst.body) {
  if (n.type === 'VariableDeclaration')
    for (const d of n.declarations)
      if (d.id.type === 'Identifier') {
        inRegion.add(d.id.name)
        constCount++
      }
  if (n.type === 'ExportNamedDeclaration' && n.declaration && n.declaration.type === 'VariableDeclaration')
    for (const d of n.declaration.declarations)
      if (d.id.type === 'Identifier') {
        inRegion.add(d.id.name)
        constCount++
      }
}

console.log(`three 区域: ${START}-${END} (${END - START + 1} 行)`)
console.log(`区域内顶层声明节点: ${declNodes.length}，其中类 ${declNodes.filter((n) => n.type === 'ClassDeclaration').length}，函数 ${declNodes.filter((n) => n.type === 'FunctionDeclaration').length}，变量声明 ${declNodes.filter((n) => n.type === 'VariableDeclaration').length}`)
console.log(`区域内唯一符号名: ${inRegion.size}（含 audio-constants.js 的 ${constCount} 个常量）`)

// ---- 2) 区域外对区域符号的引用 ----
const usedOutside = new Map() // name -> Set(文件名)
walk.fullAncestor(ast, (node, _st, anc) => {
  if (node.type !== 'Identifier') return
  const line = node.loc.start.line
  if (line >= START && line <= END) return
  if (!inRegion.has(node.name)) return
  const parent = anc[anc.length - 2]
  if (!parent) return
  // 排除属性名/对象字面量 key
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
  if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return
  if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) return
  if (!usedOutside.has(node.name)) usedOutside.set(node.name, new Set())
  usedOutside.get(node.name).add('starfall.core.js')
})

// 其他源文件（TS 侧）也扫
const otherFiles = []
function collect(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) collect(p)
    else if (/\.(ts|js)$/.test(f) && !p.includes('starfall.core.js')) otherFiles.push(p)
  }
}
collect('src')
for (const f of otherFiles) {
  const s = fs.readFileSync(f, 'utf8')
  let a
  try {
    a = acorn.parse(s, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  } catch {
    continue
  }
  walk.simple(a, {
    Identifier(node) {
      if (inRegion.has(node.name)) {
        if (!usedOutside.has(node.name)) usedOutside.set(node.name, new Set())
        usedOutside.get(node.name).add(path.relative('src', f))
      }
    },
  })
}

console.log(`\n被区域外引用的符号: ${usedOutside.size} 个`)
const sorted = [...usedOutside.entries()].sort((a, b) => b[1].size - a[1].size)
for (const [name, files] of sorted) {
  console.log(`  ${name.padEnd(5)} ← ${[...files].join(', ')}`)
}

// ---- 3) 这些符号里哪些是类（已有官方映射）----
let classMap = {}
try {
  const m = JSON.parse(fs.readFileSync('/tmp/three-map.json', 'utf8'))
  for (const r of m) classMap[r.local] = { official: r.official, score: r.score }
} catch {}
const cls = sorted.filter(([n]) => classMap[n])
const nonCls = sorted.filter(([n]) => !classMap[n])
console.log(`\n其中已识别为官方类: ${cls.length}`)
console.log(`需要另行识别的（函数/常量/未匹配类）: ${nonCls.length}`)
console.log(nonCls.map(([n]) => n).join(' '))
