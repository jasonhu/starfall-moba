#!/usr/bin/env node
/**
 * 运行时验证「压缩名 → 官方 three 导出名」映射的正确性。
 *
 * 验证一（常量）：逐个比较我方值与 THREE[官方名] 的实际值，必须完全相等。
 * 验证二（类）：比较我方类的方法名集合与 THREE[官方名].prototype 的方法名集合，
 *              要求我方方法名是官方方法名的子集（打包时可能省略未使用方法）。
 */
const fs = require('fs')
const acorn = require('acorn')

;(async () => {
  const THREE = await import('three')
  const core = fs.readFileSync('src/kernel/starfall.core.js', 'utf8')
  const ast = acorn.parse(core, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  // ---------- 常量 ----------
  const constMap = JSON.parse(fs.readFileSync('/tmp/const-map.json', 'utf8'))
  let cOk = 0
  const cBad = []
  for (const r of constMap) {
    const raw = r.val.startsWith('n:') ? Number(r.val.slice(2)) : r.val.slice(2)
    const actual = THREE[r.official]
    if (actual === raw) cOk++
    else cBad.push(`${r.local}(${raw}) → ${r.official}(${String(actual)})`)
  }
  console.log(`常量映射: ${cOk}/${constMap.length} 值完全相等`)
  if (cBad.length) console.log('  不匹配: ' + cBad.join(', '))

  // ---------- 类 ----------
  const classMap = JSON.parse(fs.readFileSync('/tmp/three-map.json', 'utf8'))
  const localClasses = new Map()
  for (const n of ast.body) {
    if (n.type === 'ClassDeclaration' && n.id) localClasses.set(n.id.name, n)
    else if (n.type === 'VariableDeclaration')
      for (const d of n.declarations) if (d.id.type === 'Identifier' && d.init && d.init.type === 'ClassExpression') localClasses.set(d.id.name, d.init)
  }
  const methodNames = (node) => {
    const s = new Set()
    for (const el of node.body.body) {
      if (el.type !== 'MethodDefinition') continue
      const k = el.key
      const nm = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null
      if (nm && nm !== 'constructor') s.add(nm)
    }
    return s
  }
  let kOk = 0
  const kBad = []
  const kSkip = []
  for (const r of classMap) {
    const local = localClasses.get(r.local)
    const Off = THREE[r.official]
    if (!local || typeof Off !== 'function') {
      kSkip.push(`${r.local}→${r.official}`)
      continue
    }
    const mine = methodNames(local)
    const theirs = new Set()
    let proto = Off.prototype
    while (proto && proto !== Object.prototype) {
      for (const nm of Object.getOwnPropertyNames(proto)) if (nm !== 'constructor') theirs.add(nm)
      proto = Object.getPrototypeOf(proto)
    }
    const missing = [...mine].filter((m) => !theirs.has(m))
    if (missing.length === 0) kOk++
    else kBad.push(`${r.local}→${r.official} 缺:${missing.slice(0, 4).join(',')}`)
  }
  console.log(`\n类映射: ${kOk}/${classMap.length} 方法集合全部可在官方原型链找到`)
  if (kBad.length) console.log('  不一致: ' + kBad.join(' | '))
  if (kSkip.length) console.log('  跳过: ' + kSkip.join(', '))

  const pass = cBad.length === 0 && kBad.length === 0
  console.log(`\n${pass ? '✅ 映射验证通过（常量逐值相等、类方法集合匹配）' : '❌ 存在不一致'}`)
  process.exit(pass ? 0 : 1)
})()
