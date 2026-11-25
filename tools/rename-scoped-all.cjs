#!/usr/bin/env node
/**
 * 全库作用域感知改名器（rename-scoped.cjs 的多文件版）：
 *  - 只改「解析到顶层绑定（含 import 局部名）」的引用；局部遮蔽的同名变量不动。
 *  - 简写属性 `{ Gd }` 展开为 `{ Gd: newName }`——保留对象键（跨模块契约），只改值绑定。
 *  - 同步改 import/export specifier 的绑定名；export 的对外名也改（全库同 map）。
 * 用法: node tools/rename-scoped-all.cjs <map.json> [--dry|--write]
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const args = process.argv.slice(2)
const mapFile = args.find((a) => !a.startsWith('--'))
if (!mapFile) { console.error('用法: rename-scoped-all.cjs <map.json> [--write]'); process.exit(2) }
const WRITE = args.includes('--write')
const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

const KERNEL = path.resolve('src/kernel')
const files = []
;(function w(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? w(p) : n.endsWith('.js') && files.push(p) } })(KERNEL)

class Scope {
  constructor(parent, kind) { this.parent = parent; this.kind = kind; this.decls = new Set() }
  declare(n) { if (n) this.decls.add(n) }
  lookup(n) { let s = this; while (s) { if (s.decls.has(n)) return s; s = s.parent } return null }
}
const META = new Set(['type', 'start', 'end', 'loc', 'range', 'raw'])
const childrenOf = (n) => Object.keys(n).filter((k) => !META.has(k))
const isFn = (t) => t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression'

function declarePattern(p, sc) {
  if (!p) return
  if (p.type === 'Identifier') sc.declare(p.name)
  else if (p.type === 'ObjectPattern') p.properties.forEach((x) => declarePattern(x.value || x.argument, sc))
  else if (p.type === 'ArrayPattern') p.elements.forEach((e) => declarePattern(e, sc))
  else if (p.type === 'AssignmentPattern') declarePattern(p.left, sc)
  else if (p.type === 'RestElement') declarePattern(p.argument, sc)
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
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
      if (node.body) buildScopes(node.body, fs)
      return
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.id) sc.declare(node.id.name)
      const cs = new Scope(sc, 'class'); scopeOf.set(node, cs)
      node.body.body.forEach((el) => buildScopes(el, cs)); return
    }
    if (node.type === 'CatchClause') { const cs = new Scope(sc, 'catch'); declarePattern(node.param, cs); buildScopes(node.body, cs); return }
    if (node.type === 'VariableDeclaration') { node.declarations.forEach((d) => { declarePattern(d.id, sc); if (d.init) buildScopes(d.init, sc) }); return }
    childrenOf(node).forEach((k) => buildScopes(node[k], sc))
  }
  buildScopes(ast, program)
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') n.specifiers.forEach((sp) => program.declare(sp.local.name))
  }

  const refBinding = new WeakMap()
  const info = new WeakMap()
  function resolve(node, sc) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => resolve(c, sc))
    if (typeof node.type !== 'string') return
    const inner = scopeOf.get(node) || sc
    if (node.type === 'Identifier') {
      if (hasOwn(mapping, node.name)) refBinding.set(node, sc.lookup(node.name))
      return
    }
    if (node.type === 'MemberExpression') { if (!node.computed && node.property.type === 'Identifier') info.set(node.property, { excl: true }); resolve(node.object, inner); if (node.computed) resolve(node.property, inner); return }
    if (node.type === 'Property') {
      if (node.shorthand) { if (node.value.type === 'Identifier') info.set(node.value, { shorthand: true }); resolve(node.value, inner); return }
      if (node.computed) resolve(node.key, inner); else if (node.key.type === 'Identifier') info.set(node.key, { excl: true })
      resolve(node.value, inner); return
    }
    if (node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') {
      if (!node.computed && node.key.type === 'Identifier') info.set(node.key, { excl: true }); else if (node.computed) resolve(node.key, inner)
      if (node.value) resolve(node.value, inner); return
    }
    if (node.type === 'LabeledStatement') { if (node.label.type === 'Identifier') info.set(node.label, { excl: true }); resolve(node.body, inner); return }
    if (node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier' || node.type === 'ImportNamespaceSpecifier') {
      // 顶层 import：local 与 imported 都标记，交给 specifier 循环处理
      return
    }
    childrenOf(node).forEach((k) => resolve(node[k], inner))
  }
  resolve(ast, program)

  const edits = []
  function push(id, text) { edits.push({ start: id.start, end: id.end, text: text || mapping[id.name] }) }
  ;(function collect(node, parent) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach((c) => collect(c, parent))
    if (typeof node.type !== 'string') return
    if (node.type === 'Identifier') {
      // 硬保护：属性名/键名/标签不改
      if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
      if (parent && ['MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.key === node && !parent.computed) return
      if (parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return
      if (parent && ['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent.type) && parent.label === node) return
      const sc = refBinding.get(node)
      if (sc === undefined || sc !== program) return  // 只改顶层绑定引用；局部遮蔽不动
      const inf = info.get(node)
      if (inf && inf.excl) return
      if (inf && inf.shorthand) push(node, `${node.name}: ${mapping[node.name]}`)  // 展开简写，保留键
      else push(node)
      return
    }
    childrenOf(node).forEach((k) => collect(node[k], node))
  })(ast, null)

  // import/export specifier：同步绑定名（imported/exported 是对外契约名，全库同 map 时也改）
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') for (const sp of n.specifiers) {
      for (const slot of ['local', 'imported']) {
        const id = sp[slot]
        if (id && id.type === 'Identifier' && hasOwn(mapping, id.name)) push(id)
      }
    }
    if (n.type === 'ExportNamedDeclaration' && n.specifiers) for (const sp of n.specifiers) {
      for (const slot of ['local', 'exported']) {
        const id = sp[slot]
        if (id && id.type === 'Identifier' && hasOwn(mapping, id.name)) push(id)
      }
    }
  }

  const uniq = [...new Map(edits.map((e) => [`${e.start}:${e.end}`, e])).values()].sort((a, b) => b.start - a.start)
  if (!uniq.length) return { file, count: 0, out: src }
  let out = src
  for (const e of uniq) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return { file, count: uniq.length, out }
}

const results = files.map(processFile).filter((r) => r.count > 0)
console.log(`=== ${results.length} 文件受影响，共 ${results.reduce((s, r) => s + r.count, 0)} 处 ===`)
for (const r of results) console.log(`  ${WRITE ? '[write]' : '[dry]'} ${path.relative(KERNEL, r.file)}: ${r.count}`)
if (WRITE) {
  const BAK = path.resolve('.rename-backup')
  for (const r of results) {
    const rel = path.relative(KERNEL, r.file)
    const bp = path.join(BAK, rel)
    fs.mkdirSync(path.dirname(bp), { recursive: true })
    fs.writeFileSync(bp, fs.readFileSync(r.file))
    fs.writeFileSync(r.file, r.out)
  }
  console.log('已写入并备份到 .rename-backup/')
}
