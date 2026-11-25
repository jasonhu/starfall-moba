/**
 * 共享的作用域分析工具。
 *
 * 目的：判断某个标识符引用是否「真正自由」（即在任何作用域里都找不到声明）。
 * 名字级判断（`defined.has(name)`）会被别处的同名局部变量污染 —— 历史 bug：
 * 内核里 `z` 只在某个函数参数处声明过，导致 23 处未定义的 `z(...)` 调用全部被放过，
 * 运行时才抛 ReferenceError。
 *
 * 导出 analyze(src) → { ast, freeRefs: Map<name, line[]>, programScope }
 */
const acorn = require('acorn')

const META = new Set(['type', 'start', 'end', 'loc', 'range', 'raw'])
const children = (n) => Object.keys(n).filter((k) => !META.has(k))
const isFn = (t) => t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression'

class Scope {
  constructor(parent) {
    this.parent = parent
    this.decls = new Set()
  }
  declare(n) {
    if (n) this.decls.add(n)
  }
  has(n) {
    let s = this
    while (s) {
      if (s.decls.has(n)) return s
      s = s.parent
    }
    return null
  }
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

function analyze(src, opts = {}) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const program = new Scope(null)
  const scopeOf = new WeakMap()

  ;(function build(node, sc) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => build(c, sc))
    if (typeof node.type !== 'string') return

    if (isFn(node.type)) {
      if (node.type === 'FunctionDeclaration' && node.id) sc.declare(node.id.name)
      const fs_ = new Scope(sc)
      scopeOf.set(node, fs_)
      node.params.forEach((p) => declarePattern(p, fs_))
      ;(function hoist(n) {
        if (!n || typeof n !== 'object') return
        if (Array.isArray(n)) return n.forEach(hoist)
        if (typeof n.type !== 'string') return
        if (isFn(n.type)) {
          if (n.type === 'FunctionDeclaration' && n.id) fs_.declare(n.id.name)
          return
        }
        if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d) => declarePattern(d.id, fs_))
        children(n).forEach((k) => hoist(n[k]))
      })(node.body)
      if (node.body) build(node.body, fs_)
      return
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.id) sc.declare(node.id.name)
      const cs = new Scope(sc)
      scopeOf.set(node, cs)
      node.body.body.forEach((el) => build(el, cs))
      return
    }
    if (node.type === 'CatchClause') {
      const cs = new Scope(sc)
      scopeOf.set(node, cs)
      declarePattern(node.param, cs)
      build(node.body, cs)
      return
    }
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach((d) => {
        declarePattern(d.id, sc)
        if (d.init) build(d.init, sc)
      })
      return
    }
    children(node).forEach((k) => build(node[k], sc))
  })(ast, program)

  for (const n of ast.body) if (n.type === 'ImportDeclaration') n.specifiers.forEach((sp) => program.declare(sp.local.name))

  const freeRefs = new Map()
  const globals = opts.globals || new Set()

  ;(function resolve(node, sc) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => resolve(c, sc))
    if (typeof node.type !== 'string') return
    const inner = scopeOf.get(node) || sc

    if (node.type === 'Identifier') {
      if (sc.has(node.name) || globals.has(node.name)) return
      if (!freeRefs.has(node.name)) freeRefs.set(node.name, [])
      freeRefs.get(node.name).push(node.loc.start.line)
      return
    }
    if (node.type === 'MemberExpression') {
      // 2026-11-19 事故 #4：旧实现在「非 computed 且 property 是 Identifier」时直接 return，
      // 导致 `HERO_TABLE.chijin.skills.s2` 这种多级访问的链尾把整个链跳过，object `HERO_TABLE`
      // 从不被 resolve → 漏报未 import 绑定（运行时 ReferenceError，第 6 道闸门没抓到）。
      // 正确做法：object 永远要 resolve；只跳过非 computed 的 property 本身。
      resolve(node.object, inner)
      if (node.computed) resolve(node.property, inner)
      return
    }
    if (node.type === 'Property') {
      if (node.shorthand) return resolve(node.value, inner)
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
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) resolve(node.declaration, inner)
      return // specifier 里的名字是导出名，不是引用
    }
    children(node).forEach((k) => resolve(node[k], inner))
  })(ast, program)

  return { ast, freeRefs, programScope: program }
}

module.exports = { analyze, Scope }
