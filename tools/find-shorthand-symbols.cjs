#!/usr/bin/env node
/**
 * 找出映射中「在任意 JS 文件里出现在简写属性位置」的源符号。
 * 这些符号不能安全全局改名（会连带改对象键，破坏跨模块解构契约）。
 * 用法: node tools/find-shorthand-symbols.cjs <map.json>
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const mapFile = process.argv[2]
const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const inMap = (n) => Object.prototype.hasOwnProperty.call(mapping, n)

const hits = new Map() // name -> [file:line]
const files = []
;(function w(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n)
    fs.statSync(p).isDirectory() ? w(p) : n.endsWith('.js') && files.push(p)
  }
})(path.resolve('src/kernel'))

for (const f of files) {
  let ast
  try { ast = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true }) } catch { continue }
  ;(function walk(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return
    if (n.type === 'Property' && n.shorthand && n.key && n.key.type === 'Identifier' && inMap(n.key.name)) {
      if (!hits.has(n.key.name)) hits.set(n.key.name, [])
      hits.get(n.key.name).push(`${path.relative(path.resolve('src/kernel'), f)}:${n.loc.start.line}`)
    }
    for (const k of Object.keys(n)) if (!['type','start','end','loc','range'].includes(k)) walk(n[k])
  })(ast)
}

for (const [name, locs] of [...hits].sort()) console.log(name.padEnd(6), '→', mapping[name], '|', locs.slice(0, 4).join(' '))
console.log(`\n共 ${hits.size} 个映射符号出现在简写属性位置，必须从映射中排除`)
fs.writeFileSync('/tmp/shorthand-symbols.json', JSON.stringify([...hits.keys()]))
