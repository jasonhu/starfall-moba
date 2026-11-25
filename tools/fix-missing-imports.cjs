#!/usr/bin/env node
/**
 * 自动补齐内核模块漏掉的跨模块 import。
 * 复用 audit-all-modules 的审计逻辑，对每个 MISSING-IMPORT 符号找到导出它的模块，
 * 在目标文件顶部插入 import 语句。
 *
 * 用法: node tools/fix-missing-imports.cjs [--write]
 * 默认 dry-run 只打印要补什么；--write 才真正写入。
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

const WRITE = process.argv.includes('--write')
const KDIR = 'src/kernel'
const files = fs.readdirSync(KDIR).filter((f) => f.endsWith('.js'))
const GLOBALS = new Set([
  'Math','Object','Array','String','Number','Boolean','Symbol','BigInt','JSON','Date','RegExp',
  'Map','Set','WeakMap','WeakSet','Promise','Proxy','Reflect','Error','TypeError','RangeError',
  'Infinity','NaN','undefined','null','true','false','this','globalThis','window','document',
  'console','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame',
  'Float32Array','Float64Array','Uint8Array','Uint8ClampedArray','Int8Array','Uint16Array',
  'Int16Array','Uint32Array','Int32Array','ArrayBuffer','DataView','isNaN','isFinite',
  'parseInt','parseFloat','encodeURIComponent','decodeURIComponent','structuredClone','WeakRef',
  'arguments','performance','navigator','location','screen','self','matchMedia','getComputedStyle',
  'cancelAnimationFrame','ResizeObserver','Image','URLSearchParams','MessageChannel',
  'AbortController','CustomEvent','Event','Element','HTMLElement','Node',
  'HTMLCanvasElement','HTMLImageElement','HTMLVideoElement','HTMLButtonElement','HTMLInputElement',
  'HTMLTextAreaElement','HTMLSelectElement','ImageData','ImageBitmap','VideoFrame','OffscreenCanvas',
  'Float16Array','WebGLRenderingContext','WebGL2RenderingContext',
  'XRWebGLBinding','XRWebGLLayer','__THREE_DEVTOOLS__',
  'HERO_DATA','buildClassicMap','buildSoundBank','buildVfxTemplates',
])

// 符号 -> 导出它的模块文件名
const symbolOwner = new Map()
for (const f of files) {
  const ast = acorn.parse(fs.readFileSync(path.join(KDIR, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      if (n.declaration.type === 'VariableDeclaration')
        for (const d of n.declaration.declarations) if (d.id.type === 'Identifier') symbolOwner.set(d.id.name, f)
      else if (n.declaration.id) symbolOwner.set(n.declaration.id.name, f)
    } else if (n.type === 'ExportNamedDeclaration' && n.specifiers)
      for (const s of n.specifiers) symbolOwner.set(s.exported.name, f)
  }
}

for (const f of files) {
  const src = fs.readFileSync(path.join(KDIR, f), 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const defined = new Set()
  for (const n of ast.body)
    if (n.type === 'ImportDeclaration') for (const s of n.specifiers) defined.add(s.local.name)
  const addPat = (p) => {
    if (!p) return
    if (p.type === 'Identifier') defined.add(p.name)
    else if (p.type === 'ArrayPattern') p.elements.forEach(addPat)
    else if (p.type === 'ObjectPattern') p.properties.forEach((x) => addPat(x.value || x.argument))
    else if (p.type === 'AssignmentPattern') addPat(p.left)
    else if (p.type === 'RestElement') addPat(p.argument)
  }
  walk.simple(ast, {
    VariableDeclarator(n) { addPat(n.id) },
    FunctionDeclaration(n) { if (n.id) addPat(n.id); n.params.forEach(addPat) },
    FunctionExpression(n) { if (n.id) addPat(n.id); n.params.forEach(addPat) },
    ArrowFunctionExpression(n) { n.params.forEach(addPat) },
    ClassDeclaration(n) { if (n.id) addPat(n.id) },
    ClassExpression(n) { if (n.id) addPat(n.id) },
    CatchClause(n) { addPat(n.param) },
  })
  const refs = new Set()
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
    refs.add(n.name)
  })
  const missing = [...refs].filter((n) => symbolOwner.has(n))
  if (!missing.length) continue

  // 按来源模块分组
  const byOwner = new Map()
  for (const n of missing) {
    const owner = symbolOwner.get(n)
    if (!byOwner.has(owner)) byOwner.set(owner, [])
    byOwner.get(owner).push(n)
  }
  console.log(`\n${f}:`)
  const imports = []
  for (const [owner, names] of byOwner) {
    const mod = './' + owner.replace(/\.js$/, '')
    console.log(`  import { ${names.sort().join(', ')} } from '${mod}'`)
    imports.push(`import { ${names.sort().join(', ')} } from '${mod}'`)
  }
  if (WRITE) {
    // 插到文件头注释之后、第一条语句之前
    const lines = src.split('\n')
    let ins = 0
    // 跳过开头的 /** ... */ 注释块
    if (lines[0].startsWith('/**')) {
      for (let i = 0; i < lines.length; i++) { if (lines[i].includes('*/')) { ins = i + 1; break } }
    }
    lines.splice(ins, 0, ...imports)
    fs.writeFileSync(path.join(KDIR, f), lines.join('\n'))
    console.log('  ✅ 已写入')
  }
}
if (!WRITE) console.log('\n(dry-run，加 --write 才写入)')
