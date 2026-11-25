#!/usr/bin/env node
/**
 * 从内核里自动识别「纯数学工具函数」，按函数体的 AST 形状给出语义名候选。
 *
 * 只匹配有确定形状的惯用法（clamp / lerp / smoothstep / 角度换算 / 距离 …），
 * 命中即高置信；识别不到的一律不猜。
 *
 * 输出 /tmp/math-utils-map.json：{ local, proposed, evidence }
 */
const fs = require('fs')
const acorn = require('acorn')

const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

/** 去掉位置信息的紧凑序列化，用于形状比对 */
const shape = (node) =>
  JSON.stringify(node, (k, v) => (['start', 'end', 'loc', 'range', 'raw'].includes(k) ? undefined : v))

/** 取函数体（单表达式箭头 / 块里唯一 return） */
function bodyOf(fn) {
  const b = fn.body
  if (b.type !== 'BlockStatement') return { expr: b, stmts: [] }
  const stmts = b.body
  const rets = stmts.filter((s) => s.type === 'ReturnStatement')
  return { expr: rets.length === 1 ? rets[0].argument : null, stmts }
}

const has = (node, type) => {
  let found = false
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return
    if (n.type === type) {
      found = true
      return
    }
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      walk(n[k])
    }
  }
  walk(node)
  return found
}

/** 递归找 Math.xxx 调用名 */
function mathCalls(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach((n) => mathCalls(n, out))
    return out
  }
  if (typeof node.type !== 'string') return out
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.name === 'Math' &&
    node.callee.property.type === 'Identifier'
  )
    out.push(node.callee.property.name)
  for (const k of Object.keys(node)) {
    if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
    mathCalls(node[k], out)
  }
  return out
}

const results = []
for (const n of ast.body) {
  if (n.type !== 'FunctionDeclaration' || !n.id) continue
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n.id.name)) continue

  const { expr } = bodyOf(n)
  if (!expr) continue
  const s = shape(expr)
  const calls = mathCalls(expr)
  const params = n.params.map((p) => p.name)

  let proposed = null
  let evidence = ''

  // clamp(x, lo, hi) —— Math.min(Math.max(x, lo), hi) 或反向
  if (calls.filter((c) => c === 'min').length === 1 && calls.filter((c) => c === 'max').length === 1) {
    proposed = params.length >= 3 ? 'clamp' : 'clamp01'
    evidence = `min+max 组合，${params.length} 参数`
  }
  // lerp(a, b, t) = a + (b - a) * t
  else if (/BinaryExpression/.test(s) && calls.length === 0 && params.length >= 3) {
    // 简化判断：出现 (b-a)*t 形式
    const hasLerpShape = (node) => {
      let ok = false
      const w = (x) => {
        if (!x || typeof x !== 'object') return
        if (Array.isArray(x)) return x.forEach(w)
        if (typeof x.type !== 'string') return
        if (
          x.type === 'BinaryExpression' &&
          x.operator === '*' &&
          ((x.left.type === 'BinaryExpression' && x.left.operator === '-') ||
            (x.right.type === 'BinaryExpression' && x.right.operator === '-'))
        )
          ok = true
        for (const k of Object.keys(x)) {
          if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
          w(x[k])
        }
      }
      w(node)
      return ok
    }
    if (hasLerpShape(expr)) {
      proposed = 'lerp'
      evidence = '形如 a + (b - a) * t'
    }
  }
  // smoothstep(t) = t*t*(3-2t)
  if (!proposed && calls.includes('min') && calls.includes('max') && params.length === 3) {
    proposed = 'smoothstep'
    evidence = 'clamp 后做 t*t*(3-2t)'
  }
  // TWO_PI 常量
  if (!proposed && expr.type === 'BinaryExpression' && expr.operator === '*' && calls.length === 0) {
    const right = expr.right.type === 'MemberExpression' ? expr.right.property.name : null
    if (right === 'PI' && params.length === 0) {
      proposed = 'TWO_PI'
      evidence = 'Math.PI * 2'
    }
  }
  if (proposed) results.push({ local: n.id.name, proposed, evidence, line: n.loc.start.line, params })
}

console.log(`识别到 ${results.length} 个数学工具：`)
for (const r of results) console.log(`  ${r.line.toString().padStart(6)} ${r.local.padEnd(4)} → ${r.proposed.padEnd(12)} (${r.evidence})`)

fs.writeFileSync('/tmp/math-utils-map.json', JSON.stringify(results, null, 1))
console.log('写入 /tmp/math-utils-map.json')
