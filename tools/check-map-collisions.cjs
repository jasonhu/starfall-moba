#!/usr/bin/env node
/**
 * 检查一批短名是否可安全全局重命名：
 *  1. 目标新名是否与任一文件的顶层绑定/import 绑定冲突
 *  2. 源短名是否在多个文件里都是顶层声明（跨文件同名 → 需确认是否同一符号）
 *  3. 源短名是否在任何文件里被内层局部遮蔽（rename-across 会跳过该文件，可能漏改 import）
 * 用法: node tools/check-map-collisions.cjs <map.json>
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const mapFile = process.argv[2]
if (!mapFile) { console.error('用法: check-map-collisions.cjs <map.json>'); process.exit(2) }
const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const oldNames = Object.keys(mapping)
const newNames = Object.values(mapping)

const files = []
;(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.js')) files.push(p)
  }
})(path.resolve('src/kernel'))

// 每个源短名在哪些文件里是「顶层声明」
const declaredTop = new Map() // name -> [file]
// 每个源短名在哪些文件里被「内层遮蔽」
const shadowedIn = new Map() // name -> [file]
// 每个文件里所有绑定名（顶层声明 + import），用于新名冲突检测
const bindingsPerFile = new Map()

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let ast
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }) } catch { continue }
  const rel = path.relative(path.resolve('src/kernel'), file)
  const bindings = new Set()
  const checkTop = (anc) => !!anc && anc.length === 2 && anc[0].type === 'Program'
  ;(function walkAst(n, anc) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(x => walkAst(x, anc))
    if (typeof n.type !== 'string') return
    const na = [...anc, n]
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
      const top = anc.length >= 2 && anc[anc.length-2].type === 'Program' && anc[anc.length-1].type === 'VariableDeclaration'
      bindings.add(n.id.name)
      if (top && oldNames.includes(n.id.name)) { if (!declaredTop.has(n.id.name)) declaredTop.set(n.id.name, []); declaredTop.get(n.id.name).push(rel) }
      if (!top && oldNames.includes(n.id.name)) { if (!shadowedIn.has(n.id.name)) shadowedIn.set(n.id.name, []); shadowedIn.get(n.id.name).push(rel) }
    }
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) {
      bindings.add(n.id.name)
      const top = checkTop(anc)
      if (top && oldNames.includes(n.id.name)) { if (!declaredTop.has(n.id.name)) declaredTop.set(n.id.name, []); declaredTop.get(n.id.name).push(rel) }
      if (!top && oldNames.includes(n.id.name)) { if (!shadowedIn.has(n.id.name)) shadowedIn.set(n.id.name, []); shadowedIn.get(n.id.name).push(rel) }
    }
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') for (const p of n.params) {
      if (p.type === 'Identifier') { bindings.add(p.name); if (oldNames.includes(p.name)) { if (!shadowedIn.has(p.name)) shadowedIn.set(p.name, []); shadowedIn.get(p.name).push(rel) } }
    }
    if (n.type === 'ImportDeclaration') for (const s of n.specifiers) bindings.add(s.local.name)
    for (const k of Object.keys(n)) if (!['type','start','end','loc','range'].includes(k)) walkAst(n[k], na)
  })(ast, [])

  bindingsPerFile.set(rel, bindings)
}

let problems = 0
console.log('=== 新名冲突（目标名已作为绑定存在于某文件）===')
for (const file of files) {
  const rel = path.relative(path.resolve('src/kernel'), file)
  const bindings = bindingsPerFile.get(rel)
  const conflicts = newNames.filter(n => bindings.has(n))
  if (conflicts.length) { console.log(`  ${rel}: ${conflicts.join(',')}`); problems++ }
}
if (!problems) console.log('  （无）')

console.log('\n=== 源短名在多个文件都是顶层声明（确认是否同一符号）===')
let multi = 0
for (const [name, fl] of declaredTop) if (fl.length > 1) { console.log(`  ${name}: ${fl.join(' , ')}`); multi++ }
if (!multi) console.log('  （无）')

console.log('\n=== 源短名被内层遮蔽的文件（rename-across 会跳过该文件）===')
let sh = 0
for (const [name, fl] of shadowedIn) { const uniq=[...new Set(fl)]; console.log(`  ${name}: ${uniq.slice(0,6).join(' , ')}${uniq.length>6?' …':''}`); sh++ }
if (!sh) console.log('  （无）')

console.log(`\n汇总: ${oldNames.length} 条映射；新名冲突文件 ${problems}，跨文件同名 ${multi}，遮蔽 ${sh}`)
