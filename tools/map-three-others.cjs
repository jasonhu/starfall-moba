#!/usr/bin/env node
/**
 * 为 Three.js 区域内「非类、非常量」的顶层声明（函数、对象、类表达式）识别官方对应项。
 *
 * 指纹：声明体内所有字符串字面量长度 >=6 的集合（GLSL 代码、报错信息等高度唯一）。
 * 对每个内核声明，在官方顶层声明中找指纹最相似者。
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const CORE = 'src/kernel/starfall.core.js'
const OFFICIAL = ['/tmp/three-check/package/build/three.core.js', '/tmp/three-check/package/build/three.module.js']
const START = Number(process.argv[2] || 3675)
const END = Number(process.argv[3] || 20038)

function stringSignature(node) {
  const set = new Set()
  walk.simple(node, {
    Literal(n) {
      if (typeof n.value === 'string' && n.value.length >= 6) set.add(n.value)
    },
    TemplateElement(n) {
      const s = n.value && n.value.cooked
      if (typeof s === 'string' && s.length >= 6) set.add(s)
    },
  })
  return set
}

function topDecls(file, withLines) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: withLines })
  const out = []
  const push = (name, node) => {
    const sig = stringSignature(node)
    if (sig.size === 0) return
    out.push({ name, sig, node })
  }
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' && n.id) push(n.id.name, n)
    else if (n.type === 'ClassDeclaration' && n.id) push(n.id.name, n)
    else if (n.type === 'VariableDeclaration')
      for (const d of n.declarations) if (d.id.type === 'Identifier' && d.init) push(d.id.name, { type: 'VariableDeclarator', start: d.start, end: d.end })
  }
  return out
}

// 官方：按 VariableDeclarator 粒度取指纹（因为 const A = {...}, B = {...} 是同一条链）
function officialDecls() {
  const out = []
  for (const f of OFFICIAL) {
    const src = fs.readFileSync(f, 'utf8')
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
    for (const n of ast.body) {
      if (n.type === 'FunctionDeclaration' && n.id) {
        const sig = stringSignature(n)
        if (sig.size) out.push({ name: n.id.name, sig })
      } else if (n.type === 'ClassDeclaration' && n.id) {
        const sig = stringSignature(n)
        if (sig.size) out.push({ name: n.id.name, sig })
      } else if (n.type === 'VariableDeclaration') {
        for (const d of n.declarations) {
          if (d.id.type !== 'Identifier' || !d.init) continue
          const sig = stringSignature(d.init)
          if (sig.size) out.push({ name: d.id.name, sig })
        }
      }
    }
  }
  return out
}

const off = officialDecls()
console.log(`官方带字符串指纹的顶层声明: ${off.length}`)

const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const known = new Set()
for (const f of ['/tmp/three-map.json', '/tmp/const-map.json']) {
  try {
    for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) known.add(r.local)
  } catch {}
}

const targets = []
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') continue
  if (n.loc.start.line < START || n.loc.end.line > END) continue
  if (n.type === 'FunctionDeclaration' && n.id) targets.push({ name: n.id.name, node: n, kind: 'function', line: n.loc.start.line })
  else if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) if (d.id.type === 'Identifier' && d.init) targets.push({ name: d.id.name, node: d.init, kind: 'var', line: d.loc.start.line })
}

console.log(`内核区域内候选声明: ${targets.length}（已识别 ${targets.filter((t) => known.has(t.name)).length}）`)

const res = []
for (const t of targets) {
  if (known.has(t.name)) continue
  const sig = stringSignature(t.node)
  if (sig.size === 0) {
    res.push({ ...t, match: null, score: 0, sigSize: 0 })
    continue
  }
  let best = null,
    bestScore = 0
  for (const o of off) {
    let inter = 0
    for (const s of sig) if (o.sig.has(s)) inter++
    const sc = inter / Math.min(sig.size, o.sig.size) // 用较小者：允许官方是大超集
    if (sc > bestScore) {
      bestScore = sc
      best = o.name
    }
  }
  res.push({ name: t.name, kind: t.kind, line: t.line, match: best, score: +bestScore.toFixed(3), sigSize: sig.size })
}

const hi = res.filter((r) => r.score >= 0.9)
const mid = res.filter((r) => r.score >= 0.5 && r.score < 0.9)
const no = res.filter((r) => r.score < 0.5)

console.log(`\n高置信(>=0.9): ${hi.length}`)
for (const r of hi) console.log(`  ${String(r.line).padStart(6)} ${r.name.padEnd(5)} → ${String(r.match).padEnd(26)} ${r.score} (${r.sigSize}串)`)
console.log(`\n中等(0.5~0.9): ${mid.length}`)
for (const r of mid.slice(0, 40)) console.log(`  ${String(r.line).padStart(6)} ${r.name.padEnd(5)} → ${String(r.match).padEnd(26)} ${r.score} (${r.sigSize}串)`)
console.log(`\n未识别(<0.5): ${no.length}`)
for (const r of no.slice(0, 60)) console.log(`  ${String(r.line).padStart(6)} ${r.name.padEnd(5)} 最像=${r.match} ${r.score} (${r.sigSize}串)`)

fs.writeFileSync('/tmp/others-map.json', JSON.stringify(res.filter((r) => r.score >= 0.9).map((r) => ({ local: r.name, official: r.match, score: r.score, line: r.line })), null, 1))
console.log('\n写入 /tmp/others-map.json')
