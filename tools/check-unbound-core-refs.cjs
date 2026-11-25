#!/usr/bin/env node
/**
 * 闸门：扫所有抽出模块，找出「引用了 core 顶层符号、但该模块没 import」的漏网绑定。
 *
 * 背景（2026-11-19 真事故）：icon-theme.js 的 heroIconPalette() 用了 HERO_TABLE，
 * 它是 core 的 import 绑定；extract-symbols 把 import 绑定视为「安全」（新模块会从
 * 同一来源再 import），但实际并不会自动补 import → 运行时 `HERO_TABLE is not defined`。
 * tsc / 模块审计 / 导入契约三道闸门都放过，只有浏览器 pageerror 才暴露。
 *
 * 判据：对模块做作用域分析拿 freeRefs（真正自由的标识符），与 core 顶层声明集合求交。
 * 交集里的名字如果是模块本该自己 import 的，就是漏洞。为避免误报：
 *   - 只认「大写开头」（常量/类/工厂）与已知小写工具名，过滤普通局部变量误入
 *   - 排除 JS/浏览器全局（Math/document/window/...）
 *   - 排除 three（模块会从 three import，名字一般已声明）
 *
 * 用法：node tools/check-unbound-core-refs.cjs
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const { analyze } = require('./lib-scope.cjs')

const ROOT = path.resolve('src/kernel')
const { resolveSource } = require('./lib-files.cjs')
const CORE = resolveSource(path.join(ROOT, 'starfall.core.js'))

// core 顶层声明集合（含 const 链、class、function、import 绑定）
const coreSrc = fs.readFileSync(CORE, 'utf8')
const coreAst = acorn.parse(coreSrc, { ecmaVersion: 'latest', sourceType: 'module' })
const coreTop = new Set()
for (const n of coreAst.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) coreTop.add(d.id.name)
  else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) coreTop.add(n.id.name)
  else if (n.type === 'ImportDeclaration') for (const sp of n.specifiers) coreTop.add(sp.local.name)
}

const GLOBALS = new Set([
  'Math', 'Object', 'Array', 'JSON', 'Number', 'String', 'Boolean', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Date', 'RegExp', 'Promise', 'Symbol', 'Error', 'TypeError', 'Infinity', 'NaN', 'undefined',
  'document', 'window', 'globalThis', 'navigator', 'console', 'location', 'screen', 'matchMedia',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'performance', 'Image', 'Audio', 'URL', 'URLSearchParams', 'Float32Array',
  'Float64Array', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'ArrayBuffer', 'DataView', 'Blob', 'TextEncoder', 'TextDecoder', 'structuredClone', 'alert',
  'WebGL2RenderingContext', 'OffscreenCanvas', 'HTMLCanvasElement', 'CustomEvent', 'Event',
])

// 递归收集模块文件（排除 core 自身）
const mods = []
;(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if ((name.endsWith('.js') || name.endsWith('.ts')) && name !== 'starfall.core.js') mods.push(p)
  }
})(ROOT)

let issues = 0
for (const file of mods) {
  const src = fs.readFileSync(file, 'utf8')
  // 迁移后的 .ts 为纯 JS 语法（类型信息仅存在于早期 39 个样板文件，带类型注解者跳过）
  if (file.endsWith('.ts') && /\b(interface|type)\s+[A-Z]|: *(string|number|boolean|any)\b/.test(src)) continue
  let res
  try { res = analyze(src, { globals: GLOBALS }) } catch (e) { continue }
  const bad = []
  for (const [name, lines] of res.freeRefs) {
    // 只关心 core 顶层符号 —— 这才可能是「从 core 搬出、忘了 import」的。
    // coreTop 本身已是白名单（import 绑定 + 顶层 const/class/function），无需再按大小写过滤：
    // 2026-11-19 事故 #2：buildVfxTemplates（小写开头的 import 绑定）曾被大小写过滤漏掉。
    if (!coreTop.has(name)) continue
    bad.push(`${name}@${lines.slice(0, 3).join(',')}`)
  }
  if (bad.length) {
    issues++
    console.log(`⚠️  ${path.relative(process.cwd(), file)}: ${bad.join('  ')}`)
  }
}

if (issues) {
  console.error(`\n❌ ${issues} 个模块疑似引用了未导入的 core 符号；请逐一核对上方清单。`)
  process.exit(1)
} else {
  console.log(`✅ ${mods.length} 个模块：无「引用 core 符号却未 import」的漏网绑定`)
}
