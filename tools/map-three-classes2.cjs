#!/usr/bin/env node
/**
 * Three.js 类识别 v2 —— 用确定性信号替代纯 Jaccard。
 *
 * 信号优先级：
 *   S1: 类体内 `this.type = "Foo"` → 若官方导出 Foo，直接命中（最可靠）
 *   S2: 类体内 `this.isFoo = true` → 若官方导出 Foo，直接命中
 *   S3: 方法名集合（含静态，前缀 static:）Jaccard，阈值 0.75，且必须唯一最优
 *
 * 输出 /tmp/three-map2.json：{ local, official, score, via, line }
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

;(async () => {
  const THREE = await import('three')
  const exported = new Set(Object.keys(THREE))

  const src = fs.readFileSync('src/kernel/starfall.core.js', 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  /** 收集实例+静态方法名 */
  function methods(node) {
    const s = new Set()
    for (const el of node.body.body) {
      if (el.type !== 'MethodDefinition' && el.type !== 'PropertyDefinition') continue
      const k = el.key
      const nm = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null
      if (!nm || nm === 'constructor') continue
      s.add(el.static ? `static:${nm}` : nm)
    }
    return s
  }

  /** 类体里的 this.type = "X" / this.isX = true（压缩后写作 !0） */
  function flags(node) {
    const types = new Set()
    const isFlags = new Set()
    const isTrue = (r) =>
      (r.type === 'Literal' && r.value === true) ||
      (r.type === 'UnaryExpression' && r.operator === '!' && r.argument.type === 'Literal' && r.argument.value === 0)
    walk.simple(node, {
      AssignmentExpression(n) {
        if (n.left.type !== 'MemberExpression' || n.left.computed) return
        const prop = n.left.property.name
        if (!prop) return
        if (prop === 'type' && n.right.type === 'Literal' && typeof n.right.value === 'string') types.add(n.right.value)
        if (prop.startsWith('is') && isTrue(n.right)) isFlags.add(prop.slice(2))
      },
    })
    return { types, isFlags }
  }

  /** 官方类的原型+静态方法名集合 */
  const officialMethods = new Map()
  function offMethods(name) {
    if (officialMethods.has(name)) return officialMethods.get(name)
    const C = THREE[name]
    const s = new Set()
    if (typeof C === 'function') {
      let proto = C.prototype
      while (proto && proto !== Object.prototype) {
        for (const nm of Object.getOwnPropertyNames(proto)) if (nm !== 'constructor') s.add(nm)
        proto = Object.getPrototypeOf(proto)
      }
      for (const nm of Object.getOwnPropertyNames(C)) {
        if (['length', 'name', 'prototype'].includes(nm)) continue
        s.add(`static:${nm}`)
      }
    }
    officialMethods.set(name, s)
    return s
  }

  const jac = (a, b) => {
    if (!a.size || !b.size) return 0
    let i = 0
    for (const x of a) if (b.has(x)) i++
    return i / (a.size + b.size - i)
  }

  const out = []
  for (const n of ast.body) {
    let cls = null,
      name = null
    if (n.type === 'ClassDeclaration' && n.id) {
      cls = n
      name = n.id.name
    } else if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations)
        if (d.id.type === 'Identifier' && d.init && d.init.type === 'ClassExpression') {
          cls = d.init
          name = d.id.name
        }
    }
    if (!cls || !name) continue

    const ms = methods(cls)
    if (ms.size === 0) continue
    const { types, isFlags } = flags(cls)

    let official = null,
      via = null,
      score = 0

    // S1: this.type
    for (const t of types) {
      if (exported.has(t)) {
        official = t
        via = 'type'
        score = 1
        break
      }
    }
    // S2: isXxx
    if (!official)
      for (const f of isFlags) {
        if (exported.has(f)) {
          official = f
          via = 'is'
          score = 1
          break
        }
      }
    // S3: 方法名 Jaccard（含静态）
    if (!official) {
      let best = null,
        bs = 0,
        second = 0
      for (const o of exported) {
        if (typeof THREE[o] !== 'function') continue
        const sc = jac(ms, offMethods(o))
        if (sc > bs) {
          second = bs
          bs = sc
          best = o
        } else if (sc > second) second = sc
      }
      if (bs >= 0.75) {
        official = best
        via = 'methods'
        score = +bs.toFixed(3)
        if (second === bs) via = 'methods-ambiguous'
      }
    }
    out.push({ local: name, official, via, score, line: n.loc.start.line, methods: ms.size })
  }

  const matched = out.filter((r) => r.official)
  const ambiguous = matched.filter((r) => r.via === 'methods-ambiguous')
  console.log(`顶层类: ${out.length}，识别: ${matched.length}，歧义: ${ambiguous.length}`)
  console.log(`  按 this.type 命中: ${matched.filter((r) => r.via === 'type').length}`)
  console.log(`  按 isXxx 命中:    ${matched.filter((r) => r.via === 'is').length}`)
  console.log(`  按方法名命中:      ${matched.filter((r) => r.via === 'methods').length}`)

  console.log('\n=== 方法名命中（可能歧义，需人工确认）===')
  for (const r of matched.filter((r) => r.via.startsWith('methods'))) console.log(`  ${String(r.line).padStart(6)} ${r.local.padEnd(4)} → ${String(r.official).padEnd(26)} ${r.score} ${r.via}`)

  console.log('\n=== 未识别 ===')
  for (const r of out.filter((r) => !r.official)) console.log(`  ${String(r.line).padStart(6)} ${r.local.padEnd(4)} (${r.methods} 方法)`)

  fs.writeFileSync('/tmp/three-map2.json', JSON.stringify(matched.map((r) => ({ local: r.local, official: r.official, score: r.score, via: r.via, line: r.line })), null, 1))
  console.log('\n写入 /tmp/three-map2.json')
})()
