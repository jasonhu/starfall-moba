#!/usr/bin/env node
/**
 * 按「函数作用域」重命名局部绑定（参数 / 局部变量 / 嵌套函数名）
 * ------------------------------------------------------------------
 * 用途：语义化重构时给每个函数单独指定改名表，避免同名字符串在不同函数里含义不同
 * （例如 sfxSwingWhoosh 的 `t` 是频率，sfxPitchDropHit 的 `t` 是起始时间）。
 *
 * 安全保证：
 *  1. 只改「解析到的绑定声明位于该函数内部」的引用；外层/顶层同名符号不动
 *  2. 属性名（obj.t）、方法名、对象字面量的 key 一律不改
 *  3. 简写属性 `{ t }` 会展开成 `{ t: startTime }` —— 保留 key，只换值
 *     （若直接改成 `{ startTime }`，消费方按 key `t` 读就拿不到，参考 vfx kit 事故）
 *  4. dry-run 会打印全部改名点，便于逐条核对
 *
 * 用法：
 *   node tools/rename-in-scope.cjs <file> <map.json>          # dry-run
 *   node tools/rename-in-scope.cjs <file> <map.json> --write  # 写入
 *
 * map.json 结构：{ "函数名": { "旧名": "新名", ... }, ... }
 */
const fs = require('fs')
const acorn = require('acorn')

const FILE = process.argv[2]
const MAP_FILE = process.argv[3]
const WRITE = process.argv.includes('--write')
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

if (!FILE || !MAP_FILE) {
  console.error('用法: node tools/rename-in-scope.cjs <file> <map.json> [--write]')
  process.exit(1)
}

const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
const fullMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))

// ---------------- 作用域 ----------------
class Scope {
  constructor(parent) {
    this.parent = parent
    this.decls = new Map() // name -> true
  }
  declare(n) {
    if (n) this.decls.set(n, true)
  }
  lookup(n) {
    let s = this
    while (s) {
      if (s.decls.has(n)) return s
      s = s.parent
    }
    return null
  }
  isInsideOf(ancestor) {
    let s = this
    while (s) {
      if (s === ancestor) return true
      s = s.parent
    }
    return false
  }
}

const scopeOf = new WeakMap()
const refScope = new WeakMap()

const children = (n) => {
  const out = []
  for (const k of Object.keys(n)) {
    if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
    const v = n[k]
    if (v && typeof v === 'object') out.push(k)
  }
  return out
}

function declarePattern(p, sc) {
  if (!p) return
  switch (p.type) {
    case 'Identifier':
      sc.declare(p.name)
      break
    case 'ObjectPattern':
      p.properties.forEach((x) => declarePattern(x.value || x.argument, sc))
      break
    case 'ArrayPattern':
      p.elements.forEach((e) => declarePattern(e, sc))
      break
    case 'AssignmentPattern':
      declarePattern(p.left, sc)
      break
    case 'RestElement':
      declarePattern(p.argument, sc)
      break
  }
}

const isFn = (t) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(t)

/** 建作用域（fnScope 为根） */
function buildScopes(node, sc) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((c) => buildScopes(c, sc))
  if (typeof node.type !== 'string') return

  if (isFn(node.type)) {
    const fs2 = new Scope(sc)
    scopeOf.set(node, fs2)
    if (node.type === 'FunctionDeclaration' && node.id) fs2.declare(node.id.name)
    node.params.forEach((p) => declarePattern(p, fs2))
    // var 提升到函数作用域
    ;(function hoist(n) {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(hoist)
      if (typeof n.type !== 'string') return
      if (isFn(n.type)) return
      if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d) => declarePattern(d.id, fs2))
      children(n).forEach((k) => hoist(n[k]))
    })(node.body)
    if (node.body) buildScopes(node.body, fs2)
    return
  }

  if (node.type === 'BlockStatement' || node.type === 'ForStatement' || node.type === 'ForOfStatement' || node.type === 'ForInStatement' || node.type === 'SwitchStatement') {
    const bs = new Scope(sc)
    scopeOf.set(node, bs)
    if (node.type === 'ForStatement' && node.init && node.init.type === 'VariableDeclaration') declarePattern(node.init.declarations[0]?.id, bs)
    if ((node.type === 'ForOfStatement' || node.type === 'ForInStatement') && node.left && node.left.type === 'VariableDeclaration')
      declarePattern(node.left.declarations[0]?.id, bs)
    ;(function collect(n) {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(collect)
      if (typeof n.type !== 'string') return
      if (isFn(n.type)) return
      if (n.type === 'VariableDeclaration' && n.kind !== 'var') n.declarations.forEach((d) => declarePattern(d.id, bs))
      if (n.type === 'FunctionDeclaration' && n.id) bs.declare(n.id.name)
      if (n.type === 'ClassDeclaration' && n.id) bs.declare(n.id.name)
      children(n).forEach((k) => collect(n[k]))
    })(node.type === 'ForStatement' ? node.body : node)
    children(node).forEach((k) => buildScopes(node[k], bs))
    return
  }

  if (node.type === 'CatchClause') {
    const cs = new Scope(sc)
    scopeOf.set(node, cs)
    declarePattern(node.param, cs)
    buildScopes(node.body, cs)
    return
  }

  children(node).forEach((k) => buildScopes(node[k], sc))
}

/** 解析引用到声明所在作用域 */
function resolve(node, sc) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((c) => resolve(c, sc))
  if (typeof node.type !== 'string') return

  const inner = scopeOf.get(node) || sc

  if (node.type === 'Identifier') {
    refScope.set(node, sc)
    return
  }
  if (node.type === 'MemberExpression') {
    resolve(node.object, inner)
    if (node.computed) resolve(node.property, inner)
    return
  }
  if (node.type === 'Property') {
    if (node.shorthand) {
      resolve(node.value, inner)
      return
    }
    if (node.computed) resolve(node.key, inner)
    resolve(node.value, inner)
    return
  }
  if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
    if (node.computed) resolve(node.key, inner)
    if (node.value) resolve(node.value, inner)
    return
  }
  if (node.type === 'LabeledStatement' || node.type === 'BreakStatement' || node.type === 'ContinueStatement') return

  children(node).forEach((k) => resolve(node[k], inner))
}

function findFunction(name) {
  let found = null
  ;(function walk(n) {
    if (!n || typeof n !== 'object' || found) return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return
    if (n.type === 'FunctionDeclaration' && n.id && n.id.name === name) {
      found = n
      return
    }
    children(n).forEach((k) => walk(n[k]))
  })(ast)
  return found
}

// ---------------- 逐函数改名 ----------------
const edits = []
const report = []
const missingFns = []
const skipped = []

for (const [fnName, mapping] of Object.entries(fullMap)) {
  const fn = findFunction(fnName)
  if (!fn) {
    missingFns.push(fnName)
    continue
  }

  const rootScope = new Scope(null)
  buildScopes(fn, rootScope)
  const fnScope = scopeOf.get(fn) || rootScope
  resolve(fn, fnScope)

  const before = edits.length
  const lines = []

  ;(function collect(n, parent) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach((c) => collect(c, parent))
    if (typeof n.type !== 'string') return

    if (n.type === 'Identifier' && hasOwn(mapping, n.name)) {
      // 简写属性 `{ x }`：acorn 的 key 与 value 是两个节点但范围完全相同，
      // 只由 key 负责展开成 `{ x: 新名 }`，value 跳过，否则会产生重叠编辑。
      const isShorthandKey = parent && parent.type === 'Property' && parent.shorthand && parent.key === n
      const isShorthandValue =
        parent && parent.type === 'Property' && parent.shorthand && parent.value === n && parent.key !== n

      // 位置判定：属性名 / 方法名 / 非简写对象 key 一律不改
      const isNamePos =
        parent &&
        ((parent.type === 'MemberExpression' && parent.property === n && !parent.computed) ||
          ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === n && !parent.computed) ||
          (parent.type === 'Property' && parent.key === n && !parent.computed && !parent.shorthand))

      if (isShorthandValue) {
        // 已由 key 的展开覆盖，无需单独编辑
      } else if (isNamePos) {
        skipped.push(`${fnName}@${n.loc.start.line} 「${n.name}」位于属性名/键名，跳过`)
      } else {
        // 从「引用点」向上解析声明；只有声明落在本函数内部才改
        const refSc = refScope.get(isShorthandKey ? parent.value : n)
        const declSc = refSc ? refSc.lookup(n.name) : null
        if (!declSc || !declSc.isInsideOf(fnScope)) {
          skipped.push(`${fnName}@${n.loc.start.line} 「${n.name}」绑定不在本函数内，跳过`)
        } else if (isShorthandKey) {
          edits.push({ start: n.start, end: n.end, text: `${n.name}: ${mapping[n.name]}` })
          lines.push(`  ${n.loc.start.line}: { ${n.name} } → { ${n.name}: ${mapping[n.name]} }`)
        } else {
          edits.push({ start: n.start, end: n.end, text: mapping[n.name] })
          lines.push(`  ${n.loc.start.line}: ${n.name} → ${mapping[n.name]}`)
        }
      }
    }

    children(n).forEach((k) => collect(n[k], n))
  })(fn, null)

  report.push({ fnName, lines: lines.slice(0, 40), count: edits.length - before })
}

// ---------------- 输出 ----------------
console.log(`文件: ${FILE}`)
let totalEdits = 0
for (const r of report) {
  totalEdits += r.count
  console.log(`\n▸ ${r.fnName}  (${r.count} 处)`)
  r.lines.forEach((l) => console.log(l))
  if (r.count > r.lines.length) console.log(`  … 其余 ${r.count - r.lines.length} 处略`)
}
if (missingFns.length) console.log(`\n⚠️ 未找到函数: ${missingFns.join(', ')}`)
if (skipped.length) {
  console.log(`\n跳过 ${skipped.length} 处（属性名/键名或非本函数绑定）:`)
  skipped.slice(0, 15).forEach((s) => console.log('  ' + s))
  if (skipped.length > 15) console.log(`  … 其余 ${skipped.length - 15} 条略`)
}

// 校验：同一位置不能被两个函数重复编辑
const seen = new Map()
for (const e of edits) {
  const k = `${e.start}:${e.end}`
  if (seen.has(k)) {
    console.error(`\n❌ 位置冲突（${k}）：${seen.get(k)} 与另一次编辑重复，已中止`)
    process.exit(3)
  }
  seen.set(k, e.text)
}

console.log(`\n合计 ${totalEdits} 处改名`)
if (!WRITE) {
  console.log('[dry-run] 未写入')
  process.exit(0)
}

let out = src
for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
fs.writeFileSync(FILE, out)
console.log(`已写入 ${FILE}`)
