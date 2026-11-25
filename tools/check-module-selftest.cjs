#!/usr/bin/env node
/**
 * 模块自包含性检查：找出新切出模块里的"自由标识符"——既不是本模块定义、
 * 也不是 import 进来、也不是局部变量、也不是 JS 全局的标识符。
 * 自由标识符 = 运行时 ReferenceError 风险（切片漏 import 的典型症状）。
 *
 * 用法: node tools/check-module-selftest.cjs <file.js> [file2.js ...]
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const GLOBALS = new Set([
  'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'JSON', 'Date', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'Error', 'TypeError', 'RangeError',
  'Infinity', 'NaN', 'undefined', 'null', 'true', 'false', 'this', 'globalThis', 'window', 'document',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'Float32Array', 'Float64Array', 'Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Uint16Array',
  'Int16Array', 'Uint32Array', 'Int32Array', 'ArrayBuffer', 'DataView', 'isNaN', 'isFinite',
  'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'structuredClone', 'WeakRef',
])

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  const defined = new Set() // 顶层声明 + import 绑定 + 所有局部绑定
  const imported = new Set()

  // import 绑定
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration')
      for (const s of n.specifiers) imported.add(s.local.name)
  }
  // 所有声明性绑定（任何层级）：收集 decl.id / 函数参数 / class 名 / catch 参数
  const addPat = (p) => {
    if (!p) return
    if (p.type === 'Identifier') defined.add(p.name)
    else if (p.type === 'ArrayPattern') p.elements.forEach(addPat)
    else if (p.type === 'ObjectPattern') p.properties.forEach((x) => addPat(x.value || x.argument))
    else if (p.type === 'AssignmentPattern') addPat(p.left)
    else if (p.type === 'RestElement') addPat(p.argument)
  }
  // walk.full 回调签名是 (node, state, c)，用 simple 收集各类声明节点
  walk.simple(ast, {
    VariableDeclarator(n) { addPat(n.id) },
    FunctionDeclaration(n) { if (n.id) addPat(n.id); n.params.forEach(addPat) },
    FunctionExpression(n) { if (n.id) addPat(n.id); n.params.forEach(addPat) },
    ArrowFunctionExpression(n) { n.params.forEach(addPat) },
    ClassDeclaration(n) { if (n.id) addPat(n.id) },
    ClassExpression(n) { if (n.id) addPat(n.id) },
    CatchClause(n) { addPat(n.param) },
  })
  for (const s of imported) defined.add(s)

  // 收集所有引用型 Identifier（排除属性名、对象 key、声明位置、label、import/export）
  const refs = new Map()
  walk.fullAncestor(ast, (n, _st, anc) => {
    if (n.type !== 'Identifier') return
    const p = anc[anc.length - 2]
    if (!p) return
    if (p.type === 'MemberExpression' && p.property === n && !p.computed) return
    if (p.type === 'Property' && p.key === n && !p.shorthand && !p.computed) return
    if (p.type === 'VariableDeclarator' && p.id === n) return
    if ((p.type === 'FunctionDeclaration' || p.type === 'ClassDeclaration') && p.id === n) return
    if (/Import|Export/.test(p.type)) return
    if (p.type === 'LabeledStatement' || p.type === 'BreakStatement' || p.type === 'ContinueStatement') return
    if (defined.has(n.name) || GLOBALS.has(n.name)) return
    refs.set(n.name, (refs.get(n.name) || 0) + 1)
  })

  const free = [...refs.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\n=== ${file} ===`)
  console.log(`定义/导入绑定: ${defined.size}, 自由标识符: ${free.length}`)
  if (free.length) {
    console.log('⚠️  自由标识符 (可能是漏 import 或内置白名单缺失):')
    console.log('   ' + free.slice(0, 60).map(([n, c]) => `${n}(${c})`).join(' '))
  } else {
    console.log('✅ 无自由标识符，模块自包含')
  }
}
