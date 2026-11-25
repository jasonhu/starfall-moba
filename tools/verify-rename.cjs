#!/usr/bin/env node
/**
 * α-等价（重命名正确性）验证器
 * ---------------------------------------------------------------
 * 证明「新文件 = 旧文件应用纯标识符改名映射」，即：除了把某些
 * 绑定标识符 old→new 之外，逻辑结构一字未动。
 *
 * 原理：把映射应用到旧文件的 AST（只改作为「绑定/引用」出现的
 * Identifier，排除属性名、非简写对象 key、标签、字符串），序列化
 * 后与新文件 AST 比对。若完全相等 → 100% 证明只改名。
 *
 * 用法: node tools/verify-rename.cjs <before.js> <after.js> '{"Je":"Matrix3"}'
 *   或: node tools/verify-rename.cjs <before.js> <after.js> <mapping.json>
 */
const fs = require('fs')
const acorn = require('acorn')
const walk = require('acorn-walk')

const [beforeF, afterF, mapArg] = process.argv.slice(2)
if (!beforeF || !afterF || !mapArg) {
  console.error('用法: verify-rename.cjs <before.js> <after.js> <mapping.json 或 JSON 字符串>')
  process.exit(2)
}
let mapping
try {
  mapping = mapArg.trim().startsWith('{') ? JSON.parse(mapArg) : JSON.parse(fs.readFileSync(mapArg, 'utf8'))
} catch (e) {
  console.error('映射解析失败:', e.message)
  process.exit(2)
}

function parse(f) {
  return acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
}

/** 判断某个 Identifier 节点是否处于「不当改名」位置（属性名/key/标签/export 别名除外） */
function isExcluded(parent, key) {
  if (!parent) return false
  // obj.foo / obj['foo'] 的 foo —— 属性名不改名（computed 的标识符是表达式，可改）
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return true
  // {foo: 1} 的非简写 key；简写 {foo} 的 key/value 同节点，必须改
  if (parent.type === 'Property' && key === 'key' && !parent.shorthand && !parent.computed) return true
  // 类方法名 / 类字段名不是绑定（内核里可能存在与导入同名的类方法 `fm(){}`），不改
  if ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed) return true
  // 对象字面量里的方法简写 `{ fm() {} }`
  if (parent.type === 'Property' && key === 'key' && parent.method && !parent.computed) return true
  // label: / break label
  if (parent.type === 'LabeledStatement' && key === 'label') return true
  if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return true
  // class A {} / function f(){} 声明的 id 也是绑定，允许改 —— 不排除
  // import {a as b} 的 imported(a) 不改名，local(b) 可改
  if (parent.type === 'ImportSpecifier' && key === 'imported') return true
  if (parent.type === 'ImportDefaultSpecifier' && key === 'imported') return true
  if (parent.type === 'ImportNamespaceSpecifier' && key === 'imported') return true
  // export {a as b}: exported(b) 是对外名，若映射里明确给了才改，这里保守排除由调用方决定
  return false
}

function applyRename(ast) {
  // 注意：不能用 acorn-walk 的 fullAncestor —— 它对 Property 只访问 value，
  // 简写属性 `{ Ft }` 的 key 会被漏掉（曾导致假阳性失败）。这里用完整递归遍历。
  const walkAll = (node, parent, key) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const c of node) walkAll(c, parent, key)
      return
    }
    if (typeof node.type !== 'string') return
    if (node.type === 'Identifier') {
      if (!Object.prototype.hasOwnProperty.call(mapping, node.name)) return
      if (isExcluded(parent, key)) return
      node.name = mapping[node.name]
      return
    }
    for (const k of Object.keys(node)) {
      if (['type', 'start', 'end', 'loc', 'range', 'raw'].includes(k)) continue
      walkAll(node[k], node, k)
    }
  }
  walkAll(ast, null, null)
  // fullAncestor 不遍历 import/export specifier 子节点，单独处理。
  // imported/exported 也要应用映射：因为源模块导出名本身也被重命名了，
  // 引用方 import 的 imported 名必须同步，否则模块解析会失败。
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration' && n.specifiers)
      for (const sp of n.specifiers)
        for (const slot of ['local', 'exported']) {
          const id = sp[slot]
          if (id && id.type === 'Identifier' && Object.prototype.hasOwnProperty.call(mapping, id.name)) id.name = mapping[id.name]
        }
    if (n.type === 'ImportDeclaration' && n.specifiers)
      for (const sp of n.specifiers)
        for (const slot of ['local', 'imported']) {
          const id = sp[slot]
          if (id && id.type === 'Identifier' && Object.prototype.hasOwnProperty.call(mapping, id.name)) id.name = mapping[id.name]
        }
  }
  return ast
}

function findKey(parent, child) {
  if (!parent) return null
  for (const k of Object.keys(parent)) {
    if (parent[k] === child) return k
    if (Array.isArray(parent[k]) && parent[k].indexOf(child) >= 0) return k
  }
  return null
}

function canon(ast) {
  return JSON.stringify(ast, (k, v) => (['start', 'end', 'loc', 'range', 'raw'].includes(k) ? undefined : v))
}

const a = applyRename(parse(beforeF))
const b = parse(afterF)
const ca = canon(a)
const cb = canon(b)
if (ca === cb) {
  console.log(`✅ α-等价通过：${beforeF} 应用 ${Object.keys(mapping).length} 项改名后与 ${afterF} 完全一致（纯改名，逻辑零改动）`)
  process.exit(0)
} else {
  console.error('❌ α-等价失败：新文件不是旧文件的纯改名，存在额外逻辑改动')
  // 定位首个差异
  let i = 0
  while (i < Math.min(ca.length, cb.length) && ca[i] === cb[i]) i++
  console.error('首个差异 @', i)
  console.error('BEFORE(applied):', ca.slice(Math.max(0, i - 120), i + 120))
  console.error('AFTER         :', cb.slice(Math.max(0, i - 120), i + 120))
  process.exit(1)
}
