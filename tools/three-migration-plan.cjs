#!/usr/bin/env node
/**
 * 生成 Three.js 迁移方案：为「被游戏代码引用的 three 符号」逐个找到官方导出名，并核验可导入性。
 *
 * 数据源：
 *  - /tmp/three-map.json   类指纹匹配（方法名 Jaccard）
 *  - /tmp/const-map.json   常量链 LCS 对齐（顺序+值）
 *  - /tmp/others-map.json  字符串指纹匹配（函数/对象/GLSL）
 *  - 官方 r180 build 的 export 列表（判定是否可从 'three' 导入）
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const OFFICIAL = ['/tmp/three-check/package/build/three.core.js', '/tmp/three-check/package/build/three.module.js']

// ---- 官方导出表 ----
const exportsSet = new Set()
const exportAlias = new Map() // 内部名 → 导出名
for (const f of OFFICIAL) {
  const ast = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration') {
      if (n.declaration) {
        const d = n.declaration
        if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) exportsSet.add(d.id.name)
        else if (d.type === 'VariableDeclaration') for (const dd of d.declarations) if (dd.id.type === 'Identifier') exportsSet.add(dd.id.name)
      }
      for (const sp of n.specifiers || []) {
        const local = sp.local.name
        const exp = sp.exported.name
        exportsSet.add(exp)
        if (local !== exp) exportAlias.set(local, exp)
      }
    }
  }
}
console.log(`官方 r180 导出符号: ${exportsSet.size}`)

// ---- 已有映射 ----
const load = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return []
  }
}
const classMap = new Map(load('/tmp/three-map.json').map((r) => [r.local, { official: r.official, score: r.score, via: 'class' }]))
const constMap = new Map(load('/tmp/const-map.json').map((r) => [r.local, { official: r.official, score: 1, via: 'const' }]))
const othersMap = new Map(load('/tmp/others-map.json').map((r) => [r.local, { official: r.official, score: r.score, via: 'strings' }]))
void classMap

// ---- 外部引用清单（来自 three-api-surface 的输出，重算一遍）----
const START = 3675,
  END = 20038
const CORE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const inRegion = new Set()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') continue
  if (n.loc.start.line < START || n.loc.end.line > END) continue
  const add = (id) => {
    if (!id) return
    if (id.type === 'Identifier') inRegion.add(id.name)
    else if (id.type === 'ArrayPattern') id.elements.forEach(add)
    else if (id.type === 'ObjectPattern') id.properties.forEach((p) => add(p.value || p.argument))
    else if (id.type === 'AssignmentPattern') add(id.left)
    else if (id.type === 'RestElement') add(id.argument)
  }
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) add(n.id)
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) add(d.id)
}
// 已切出的 three 常量模块
const cAst = acorn.parse(fs.readFileSync('src/kernel/audio-constants.js', 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
for (const n of cAst.body)
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') inRegion.add(d.id.name)

const usedOutside = new Map()
walk.fullAncestor(ast, (node, _s, anc) => {
  if (node.type !== 'Identifier') return
  const line = node.loc.start.line
  if (line >= START && line <= END) return
  if (!inRegion.has(node.name)) return
  const parent = anc[anc.length - 2]
  if (!parent) return
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
  if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return
  if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) return
  if (!usedOutside.has(node.name)) usedOutside.set(node.name, [])
  usedOutside.get(node.name).push(line)
})
// 其他模块
const files = []
;(function walkDir(d) {
  for (const f of fs.readdirSync(d)) {
    const p = `${d}/${f}`
    if (fs.statSync(p).isDirectory()) walkDir(p)
    else if (/\.(ts|js)$/.test(f) && !p.endsWith('starfall.core.js')) files.push(p)
  }
})('src')
for (const f of files) {
  let a
  try {
    a = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  } catch {
    continue
  }
  walk.simple(a, {
    Identifier(node) {
      if (inRegion.has(node.name)) {
        if (!usedOutside.has(node.name)) usedOutside.set(node.name, [])
        usedOutside.get(node.name).push(`${f}:${node.loc.start.line}`)
      }
    },
  })
}

// ---- 逐符号决策 ----
const rows = []
for (const [local, refs] of [...usedOutside.entries()].sort()) {
  let hit = classMap.get(local) || constMap.get(local) || othersMap.get(local) || null
  let official = hit ? hit.official : null
  let via = hit ? hit.via : null
  let score = hit ? hit.score : 0
  if (official && !exportsSet.has(official)) {
    const alias = exportAlias.get(official)
    if (alias && exportsSet.has(alias)) official = alias
  }
  const importable = official ? exportsSet.has(official) : false
  rows.push({ local, official, via, score, importable, refs: refs.length })
}

const ok = rows.filter((r) => r.importable)
const notExported = rows.filter((r) => r.official && !r.importable)
const unknown = rows.filter((r) => !r.official)

console.log(`\n被引用的 three 符号: ${rows.length}`)
console.log(`  ✅ 可直接从 'three' 导入: ${ok.length}`)
console.log(`  ⚠️ 识别到但官方未导出: ${notExported.length}`)
console.log(`  ❓ 尚未识别: ${unknown.length}`)

if (notExported.length) {
  console.log('\n--- 识别到但非公开导出 ---')
  for (const r of notExported) console.log(`  ${r.local.padEnd(5)} → ${String(r.official).padEnd(24)} via=${r.via} 引用${r.refs}次`)
}
if (unknown.length) {
  console.log('\n--- 未识别 ---')
  for (const r of unknown) console.log(`  ${r.local.padEnd(5)} 引用${r.refs}次`)
}
console.log('\n--- 可导入明细（按引用次数）---')
for (const r of ok.sort((a, b) => b.refs - a.refs))
  console.log(`  ${r.local.padEnd(5)} → ${String(r.official).padEnd(26)} ${String(r.via).padEnd(7)} 引用${r.refs}`)

fs.writeFileSync('/tmp/three-migration.json', JSON.stringify(rows, null, 1))
console.log(`\n写入 /tmp/three-migration.json（${rows.length} 行）`)
