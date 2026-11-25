#!/usr/bin/env node
/**
 * 作用域感知的顶层符号改名器（v2）
 *
 * 与 v1 的区别：
 *  - 两遍遍历改为「通用递归」：统一递归所有子节点，只在遇到函数/类/catch 时切换作用域。
 *    这样类字段里的箭头函数、默认参数、模板字符串内的表达式都不会漏。
 *    （v1 曾漏改 20 处 z(...)，导致设置面板 / 暂停对话框运行时 ReferenceError）
 *  - 新增 --audit：不改名，只校验「每个目标名的 AST 引用总数 == 实际解析数」，
 *    不相等即说明遍历有盲区，必须修复后再改名。
 *
 * 用法：
 *   node tools/rename-scoped.cjs <map.json> --audit
 *   node tools/rename-scoped.cjs <map.json>            # dry-run
 *   node tools/rename-scoped.cjs <map.json> --write
 */
const fs = require('fs')
const acorn = require('acorn')

const MAP_FILE = process.argv[2]
const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')
const CORE = 'src/kernel/starfall.core.js'
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

const mapping = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// ---------------- 作用域 ----------------
class Scope {
  constructor(parent, kind) {
    this.parent = parent
    this.kind = kind
    this.decls = new Set()
  }
  declare(n) {
    if (n) this.decls.add(n)
  }
  lookup(n) {
    let s = this
    while (s) {
      if (s.decls.has(n)) return s
      s = s.parent
    }
    return null
  }
}
const program = new Scope(null, 'program')
const scopeOf = new WeakMap()

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

const META = new Set(['type', 'start', 'end', 'loc', 'range', 'raw'])
const children = (n) => Object.keys(n).filter((k) => !META.has(k))
const isFn = (t) => t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression'

/** 第一遍：建立作用域并登记声明（通用递归） */
function buildScopes(node, sc) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((c) => buildScopes(c, sc))
  if (typeof node.type !== 'string') return

  if (isFn(node.type)) {
    if (node.type === 'FunctionDeclaration' && node.id) sc.declare(node.id.name)
    const fnScope = new Scope(sc, 'function')
    scopeOf.set(node, fnScope)
    node.params.forEach((p) => declarePattern(p, fnScope))
    ;(function hoist(n) {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(hoist)
      if (typeof n.type !== 'string') return
      if (isFn(n.type)) {
        if (n.type === 'FunctionDeclaration' && n.id) fnScope.declare(n.id.name)
        return
      }
      if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d) => declarePattern(d.id, fnScope))
      children(n).forEach((k) => hoist(n[k]))
    })(node.body)
    if (node.body) buildScopes(node.body, fnScope)
    return
  }

  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    if (node.id) sc.declare(node.id.name)
    const cs = new Scope(sc, 'class')
    scopeOf.set(node, cs)
    node.body.body.forEach((el) => buildScopes(el, cs))
    return
  }

  if (node.type === 'CatchClause') {
    const cs = new Scope(sc, 'catch')
    declarePattern(node.param, cs)
    buildScopes(node.body, cs)
    return
  }

  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach((d) => {
      declarePattern(d.id, sc)
      if (d.init) buildScopes(d.init, sc)
    })
    return
  }

  children(node).forEach((k) => buildScopes(node[k], sc))
}
buildScopes(ast, program)
for (const n of ast.body) if (n.type === 'ImportDeclaration') n.specifiers.forEach((sp) => program.declare(sp.local.name))

// ---------------- 第二遍：解析引用 ----------------
const refBinding = new WeakMap()
const parentInfo = new WeakMap()
const visited = new Map()

function resolve(node, sc) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach((c) => resolve(c, sc))
  if (typeof node.type !== 'string') return

  const inner = scopeOf.get(node) || sc

  if (node.type === 'Identifier') {
    if (hasOwn(mapping, node.name)) {
      refBinding.set(node, sc.lookup(node.name))
      visited.set(node.name, (visited.get(node.name) || 0) + 1)
    }
    return
  }
  if (node.type === 'MemberExpression') {
    if (!node.computed && node.property.type === 'Identifier') parentInfo.set(node.property, { exclude: true })
    resolve(node.object, inner)
    if (node.computed) resolve(node.property, inner)
    return
  }
  if (node.type === 'Property') {
    if (node.shorthand) {
      if (node.value.type === 'Identifier') parentInfo.set(node.value, { shorthand: true })
      resolve(node.value, inner)
      return
    }
    if (node.computed) resolve(node.key, inner)
    else if (node.key.type === 'Identifier') parentInfo.set(node.key, { exclude: true })
    resolve(node.value, inner)
    return
  }
  if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
    if (!node.computed && node.key.type === 'Identifier') parentInfo.set(node.key, { exclude: true })
    else if (node.computed) resolve(node.key, inner)
    if (node.value) resolve(node.value, inner)
    return
  }
  if (node.type === 'LabeledStatement') {
    if (node.label.type === 'Identifier') parentInfo.set(node.label, { exclude: true })
    resolve(node.body, inner)
    return
  }
  children(node).forEach((k) => resolve(node[k], inner))
}
resolve(ast, program)

// ---------------- 收集改名点 ----------------
const edits = []
let shadowed = 0
let skippedProp = 0
/** 硬保护：这些位置的标识符是「名字」而不是「绑定」，永远不能改。
 *  历史事故：`fx`（Simulation 的发特效方法）被改名成 createCanvas，
 *  但 31 处 `n.fx(...)` 调用点没跟着改 → 运行时 `n.fx is not a function`。
 *  不能依赖 WeakMap 里的 parentInfo 是否被某条遍历路径设置过，必须按父节点类型判定。 */
function isNamePosition(node, parent) {
  if (!parent) return false
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return true
  if ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed) return true
  if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return true
  if (parent.type === 'ExportSpecifier' || parent.type === 'ImportSpecifier') return false // 单独处理
  return false
}

;(function collect(n, parent) {
  if (!n || typeof n !== 'object') return
  if (Array.isArray(n)) return n.forEach((c) => collect(c, parent))
  if (typeof n.type !== 'string') return
  if (n.type === 'Identifier') {
    if (isNamePosition(n, parent)) { skippedProp++; return }
    const sc = refBinding.get(n)
    if (sc === undefined) return
    const info = parentInfo.get(n)
    if ((info && info.exclude) || sc !== program) {
      shadowed++
      return
    }
    if (info && info.shorthand) edits.push({ start: n.start, end: n.end, name: n.name, text: `${n.name}: ${mapping[n.name]}` })
    else edits.push({ start: n.start, end: n.end, name: n.name })
    return
  }
  children(n).forEach((k) => collect(n[k], n))
})(ast)

for (const n of ast.body) {
  if (n.type === 'ExportNamedDeclaration' && n.specifiers)
    n.specifiers.forEach((sp) =>
      ['local', 'exported'].forEach((slot) => {
        const id = sp[slot]
        if (id && hasOwn(mapping, id.name)) edits.push({ start: id.start, end: id.end, name: id.name })
      })
    )
}
;(function ids(n) {
  if (!n || typeof n !== 'object') return
  if (Array.isArray(n)) return n.forEach(ids)
  if (typeof n.type !== 'string') return
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id && hasOwn(mapping, n.id.name))
    edits.push({ start: n.id.start, end: n.id.end, name: n.id.name })
  if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && hasOwn(mapping, n.id.name))
    edits.push({ start: n.id.start, end: n.id.end, name: n.id.name })
  children(n).forEach((k) => {
    if (k !== 'id') ids(n[k])
  })
})(ast)

const uniq = [...new Map(edits.map((e) => [`${e.start}:${e.end}`, e])).values()].sort((a, b) => b.start - a.start)

// ---------------- 覆盖完整性自检 ----------------
const naive = new Map()
;(function countAll(n, parent, key) {
  if (!n || typeof n !== 'object') return
  if (Array.isArray(n)) return n.forEach((c) => countAll(c, parent, key))
  if (typeof n.type !== 'string') return
  if (n.type === 'Identifier' && hasOwn(mapping, n.name)) {
    const isProp = parent && parent.type === 'MemberExpression' && parent.property === n && !parent.computed
    const isKey = parent && ['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.key === n && !parent.computed
    const isLabel = parent && (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement')
    if (!isProp && !isKey && !isLabel) naive.set(n.name, (naive.get(n.name) || 0) + 1)
  }
  children(n).forEach((k) => countAll(n[k], n, k))
})(ast, null, null)

const gaps = []
for (const name of Object.keys(mapping)) {
  const total = naive.get(name) || 0
  const seen = visited.get(name) || 0
  if (total !== seen) gaps.push(`${name}: AST 计数 ${total}，解析 ${seen}（差 ${total - seen}）`)
}
if (gaps.length) {
  console.log('⚠️ 遍历覆盖不完整，可能存在未解析引用：')
  gaps.forEach((g) => console.log('   ' + g))
} else console.log('✅ 遍历覆盖完整（目标名的 AST 计数 == 解析数）')

console.log(`可改名 ${uniq.length} 处；跳过 遮蔽/作用域 ${shadowed} 处、属性名/方法名/键名 ${skippedProp} 处`)
if (AUDIT) process.exit(gaps.length ? 2 : 0)
if (!WRITE) {
  console.log('[dry-run] 未写入')
  process.exit(0)
}
let out = src
for (const e of uniq) out = out.slice(0, e.start) + (e.text || mapping[e.name]) + out.slice(e.end)
fs.writeFileSync(CORE, out)
console.log(`已写入 ${CORE}`)
