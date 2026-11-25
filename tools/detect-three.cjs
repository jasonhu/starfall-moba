#!/usr/bin/env node
/**
 * 识别内联的 Three.js 代码范围，并建立「压缩名 → 官方导出名」映射。
 *
 * 原理：Three.js 的类是稳定的，方法名集合几乎等价于指纹。
 * 1) 解析官方 r180 的 three.core.js + three.module.js，建「类名 → 方法名集合」
 * 2) 解析内联内核，对每个顶层 ClassDeclaration 提取方法名集合
 * 3) 用 Jaccard 相似度匹配，高分的判定为 Three.js 代码
 * 4) 输出：匹配表（压缩名 → 官方名 + 相似度 + 行号）+ 连续区间统计
 *
 * 用法：node tools/detect-three.cjs [--map-json out.json]
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const OFFICIAL = [
  '/tmp/three-check/package/build/three.core.js',
  '/tmp/three-check/package/build/three.module.js',
]

/** 提取类体方法名集合（不含 constructor） */
function classMethodSet(classNode) {
  const set = new Set()
  for (const el of classNode.body.body) {
    if (el.type !== 'MethodDefinition') continue
    const k = el.key
    const name = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null
    if (name && name !== 'constructor') set.add(name)
  }
  return set
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

// ---- 1) 官方 ----
const official = new Map() // name -> Set
for (const f of OFFICIAL) {
  const src = fs.readFileSync(f, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  for (const n of ast.body) {
    if (n.type === 'ClassDeclaration' && n.id) {
      const s = classMethodSet(n)
      if (s.size >= 2) official.set(n.id.name, s)
    } else if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id.type === 'Identifier' && d.init && d.init.type === 'ClassExpression') {
          const s = classMethodSet(d.init)
          if (s.size >= 2) official.set(d.id.name, s)
        }
      }
    }
  }
}
console.log(`官方类指纹: ${official.size} 个`)

// ---- 2) 内核 ----
const CORE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const results = []
for (const n of ast.body) {
  let cls = null,
    name = null
  if (n.type === 'ClassDeclaration' && n.id) {
    cls = n
    name = n.id.name
  } else if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (d.id.type === 'Identifier' && d.init && d.init.type === 'ClassExpression') {
        cls = d.init
        name = d.id.name
      }
    }
  }
  if (!cls || !name) continue
  const ms = classMethodSet(cls)
  if (ms.size < 2) continue

  let best = null,
    bestScore = 0
  for (const [oname, oset] of official) {
    const sc = jaccard(ms, oset)
    if (sc > bestScore) {
      bestScore = sc
      best = oname
    }
  }
  results.push({
    local: name,
    line: n.loc.start.line,
    endLine: n.loc.end.line,
    methods: ms.size,
    match: best,
    score: +bestScore.toFixed(3),
  })
}

const solid = results.filter((r) => r.score >= 0.85)
const weak = results.filter((r) => r.score >= 0.5 && r.score < 0.85)
const none = results.filter((r) => r.score < 0.5)

console.log(`\n内核顶层类: ${results.length} 个`)
console.log(`  高置信命中(>=0.85): ${solid.length}`)
console.log(`  弱命中(0.5~0.85):   ${weak.length}`)
console.log(`  未命中(<0.5):       ${none.length}`)

if (solid.length) {
  const first = solid[0].line
  const last = solid[solid.length - 1].endLine
  console.log(`\n高置信区间: ${first} ~ ${last} 行 (${last - first + 1} 行)`)
  // 区间内高置信占比
  const inside = results.filter((r) => r.line >= first && r.endLine <= last)
  const insideSolid = inside.filter((r) => r.score >= 0.85)
  console.log(`区间内顶层类 ${inside.length} 个，其中高置信 ${insideSolid.length} 个`)
  // 找最大间隙，判断是否有游戏代码混入
  let maxGap = 0,
    gapAt = 0
  for (let i = 1; i < solid.length; i++) {
    const g = solid[i].line - solid[i - 1].endLine
    if (g > maxGap) {
      maxGap = g
      gapAt = solid[i - 1].endLine
    }
  }
  console.log(`最大间隙: ${maxGap} 行 (在 ${gapAt} 行之后)`)
}

console.log('\n=== 高置信匹配明细（前 80）===')
for (const r of solid.slice(0, 80)) {
  console.log(
    `${String(r.line).padStart(6)}-${String(r.endLine).padStart(6)}  ${r.local.padEnd(4)} → ${String(r.match).padEnd(28)} ${r.score}  (${r.methods} 方法)`
  )
}
console.log('\n=== 未命中的顶层类（可能是游戏代码）===')
for (const r of none.slice(0, 60)) {
  console.log(`${String(r.line).padStart(6)}-${String(r.endLine).padStart(6)}  ${r.local.padEnd(4)} score=${r.score} 最像=${r.match} (${r.methods} 方法)`)
}

const mapJson = process.argv.indexOf('--map-json')
if (mapJson > 0) {
  const out = process.argv[mapJson + 1]
  fs.writeFileSync(out, JSON.stringify(solid.map((r) => ({ local: r.local, official: r.match, score: r.score, line: r.line })), null, 1))
  console.log(`\n映射已写入 ${out}`)
}
