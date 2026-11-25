#!/usr/bin/env node
/**
 * 适配 rename-scoped-all.cjs 的 α 等价验证器：
 *  - 顶层绑定引用 old→new
 *  - 简写属性 `{ k }`（k 在映射内）展开为 `{ k: newName }`（键保留）
 *  - 局部遮蔽的同名标识符不动
 * 用法: verify-rename-scoped.cjs <before.js> <after.js> <map.json>
 */
const fs = require('fs')
const acorn = require('acorn')
const [beforeF, afterF, mapArg] = process.argv.slice(2)
if (!beforeF || !afterF || !mapArg) { console.error('用法: verify-rename-scoped.cjs <before> <after> <map.json>'); process.exit(2) }
const mapping = JSON.parse(fs.existsSync(mapArg) ? fs.readFileSync(mapArg, 'utf8') : mapArg)
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const META = new Set(['type', 'start', 'end', 'loc', 'range', 'raw'])
const childrenOf = (n) => Object.keys(n).filter((k) => !META.has(k))
const isFn = (t) => t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression'

class Scope {
  constructor(parent, kind) { this.parent = parent; this.kind = kind; this.decls = new Set() }
  declare(n) { if (n) this.decls.add(n) }
  lookup(n) { let s = this; while (s) { if (s.decls.has(n)) return s; s = s.parent } return null }
}
function declarePattern(p, sc) {
  if (!p) return
  if (p.type === 'Identifier') sc.declare(p.name)
  else if (p.type === 'ObjectPattern') p.properties.forEach((x) => declarePattern(x.value || x.argument, sc))
  else if (p.type === 'ArrayPattern') p.elements.forEach((e) => declarePattern(e, sc))
  else if (p.type === 'AssignmentPattern') declarePattern(p.left, sc)
  else if (p.type === 'RestElement') declarePattern(p.argument, sc)
}

// 变换旧 AST：只改解析到 program 的绑定 + 简写展开 + specifier
function transform(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  const program = new Scope(null, 'program')
  const scopeOf = new WeakMap()
  function buildScopes(node, sc) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => buildScopes(c, sc))
    if (typeof node.type !== 'string') return
    if (isFn(node.type)) {
      if (node.type === 'FunctionDeclaration' && node.id) sc.declare(node.id.name)
      const fs = new Scope(sc, 'function'); scopeOf.set(node, fs)
      node.params.forEach((p) => declarePattern(p, fs))
      ;(function hoist(n) {
        if (!n || typeof n !== 'object') return
        if (Array.isArray(n)) return n.forEach(hoist)
        if (typeof n.type !== 'string') return
        if (isFn(n.type)) { if (n.type === 'FunctionDeclaration' && n.id) fs.declare(n.id.name); return }
        if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d) => declarePattern(d.id, fs))
        childrenOf(n).forEach((k) => hoist(n[k]))
      })(node.body)
      if (node.body) buildScopes(node.body, fs); return
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') { if (node.id) sc.declare(node.id.name); const cs = new Scope(sc, 'class'); scopeOf.set(node, cs); node.body.body.forEach((el) => buildScopes(el, cs)); return }
    if (node.type === 'CatchClause') { const cs = new Scope(sc, 'catch'); declarePattern(node.param, cs); buildScopes(node.body, cs); return }
    if (node.type === 'VariableDeclaration') { node.declarations.forEach((d) => { declarePattern(d.id, sc); if (d.init) buildScopes(d.init, sc) }); return }
    childrenOf(node).forEach((k) => buildScopes(node[k], sc))
  }
  buildScopes(ast, program)
  for (const n of ast.body) if (n.type === 'ImportDeclaration') n.specifiers.forEach((sp) => program.declare(sp.local.name))

  // 记录每个 Identifier 绑定的解析 scope
  const binding = new WeakMap()
  function mark(node, sc) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => mark(c, sc))
    if (typeof node.type !== 'string') return
    const inner = scopeOf.get(node) || sc
    if (node.type === 'Identifier' && hasOwn(mapping, node.name)) binding.set(node, sc.lookup(node.name))
    childrenOf(node).forEach((k) => mark(node[k], inner))
  }
  mark(ast, program)

  function apply(node, parent) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => apply(c, parent))
    if (typeof node.type !== 'string') return
    if (node.type === 'Property' && node.shorthand && node.key.type === 'Identifier' && hasOwn(mapping, node.key.name) && binding.get(node.value) === program) {
      node.shorthand = false
      node.key = { type: 'Identifier', name: node.key.name }
      node.value = { type: 'Identifier', name: mapping[node.key.name] }
      return
    }
    if (node.type === 'Identifier') {
      if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
      if (parent && ['MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.key === node && !parent.computed) return
      if (parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return
      if (parent && ['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent.type) && parent.label === node) return
      if (parent && ['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier', 'ExportSpecifier'].includes(parent.type)) return // specifier 单独处理
      if (binding.get(node) === program) node.name = mapping[node.name]
      return
    }
    childrenOf(node).forEach((k) => apply(node[k], node))
  }
  apply(ast, null)
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') for (const sp of n.specifiers) for (const slot of ['local', 'imported']) { const id = sp[slot]; if (id && id.type === 'Identifier' && hasOwn(mapping, id.name)) id.name = mapping[id.name] }
    if (n.type === 'ExportNamedDeclaration' && n.specifiers) for (const sp of n.specifiers) for (const slot of ['local', 'exported']) { const id = sp[slot]; if (id && id.type === 'Identifier' && hasOwn(mapping, id.name)) id.name = mapping[id.name] }
  }
  return ast
}
const canon = (ast) => JSON.stringify(ast, (k, v) => (META.has(k) ? undefined : v))
const a = canon(transform(fs.readFileSync(beforeF, 'utf8')))
const b = canon(acorn.parse(fs.readFileSync(afterF, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }))
if (a === b) { console.log('✅ α-等价通过:', afterF); process.exit(0) }
else { console.log('❌ α-等价失败:', afterF); process.exit(1) }
