#!/usr/bin/env node
/**
 * 全模块审计：检查 src/kernel/ 下每个模块（含 core）的自由标识符。
 * 与 check-module-selftest 的区别：把"所有内核模块导出的符号"都视为合法定义来源，
 * 但仍要求每个模块显式 import 它用到的跨模块符号——漏 import 会报 MISSING-IMPORT。
 *
 * 这是多次切片后必须做的审计：分析器 analyze-slice-deps 只看单个文件，
 * 切片后符号移到别的文件就检测不到跨模块引用了。
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')
const { analyze } = require('./lib-scope.cjs')

const GLOBALS = new Set([
  'Math','Object','Array','String','Number','Boolean','Symbol','BigInt','JSON','Date','RegExp',
  'Map','Set','WeakMap','WeakSet','Promise','Proxy','Reflect','Error','TypeError','RangeError',
  'Infinity','NaN','undefined','null','true','false','this','globalThis','window','document',
  'console','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame',
  'Float32Array','Float64Array','Uint8Array','Uint8ClampedArray','Int8Array','Uint16Array',
  'Int16Array','Uint32Array','Int32Array','ArrayBuffer','DataView','isNaN','isFinite',
  'parseInt','parseFloat','encodeURIComponent','decodeURIComponent','structuredClone','WeakRef',
  'arguments',
  // DOM / Web API 内置
  'performance','navigator','location','screen','self','matchMedia','getComputedStyle',
  'cancelAnimationFrame','ResizeObserver','Image','URLSearchParams','MessageChannel',
  'AbortController','CustomEvent','Event','Element','HTMLElement','Node',
  'HTMLCanvasElement','HTMLImageElement','HTMLVideoElement','HTMLButtonElement','HTMLInputElement',
  'HTMLTextAreaElement','HTMLSelectElement','ImageData','ImageBitmap','VideoFrame','OffscreenCanvas',
  'Float16Array','WebGLRenderingContext','WebGL2RenderingContext',
  'XRWebGLBinding','XRWebGLLayer','__THREE_DEVTOOLS__',
  // 项目里从外部 TS 模块 import 的绑定名
  'HERO_DATA','buildClassicMap','buildSoundBank','buildVfxTemplates',
])

const KDIR = 'src/kernel'
const { listSourceFiles } = require('./lib-files.cjs')
const allSource = listSourceFiles(KDIR)
// 带类型注解的早期 .ts 样板 acorn 解析不了，由 tsc 负责校验；审计只覆盖纯 JS 语法文件
const isTypedTs = (f) => f.endsWith('.ts') && /\b(interface|type)\s+[A-Z]|^export type|import type|:\s*(string|number|boolean|any)\b|:\s*\[[^\]]*\]\[\]|:\s*[A-Z]\w*(<[^>]+>)?\s*[=;,){\n]|\bas\s+(unknown|const|[A-Z])|satisfies\s+[A-Z]|\bdeclare\s+(field|readonly)/m.test(fs.readFileSync(path.join(KDIR, f), 'utf8'))
const files = allSource.filter((f) => !isTypedTs(f))

// 收集所有模块顶层导出的符号（作为"合法跨模块符号"全集）
const exported = new Set()
for (const f of allSource) {
  let ast
  try { ast = acorn.parse(fs.readFileSync(path.join(KDIR, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }) } catch { continue }
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      if (n.declaration.type === 'VariableDeclaration')
        for (const d of n.declaration.declarations) if (d.id.type === 'Identifier') exported.add(d.id.name)
      else if (n.declaration.id) exported.add(n.declaration.id.name)
    } else if (n.type === 'ExportNamedDeclaration' && n.specifiers)
      for (const s of n.specifiers) exported.add(s.exported.name)
  }
}

let totalIssues = 0
for (const f of files) {
  const src = fs.readFileSync(path.join(KDIR, f), 'utf8')
  // 作用域级分析：只有「在任何作用域都找不到声明」的标识符才算自由引用。
  // 旧实现按名字判断（defined.has(name)），会被别处同名局部变量污染：
  // 历史 bug —— `z` 只在某个函数参数处声明过，23 处未定义的 z(...) 被放过，运行时 ReferenceError。
  let freeRefs
  try {
    freeRefs = analyze(src, { globals: GLOBALS }).freeRefs
  } catch (e) {
    console.log(`\n⚠️  ${f}\n  解析失败: ${e.message}`)
    totalIssues++
    continue
  }
  // 转成 name -> 次数（与原逻辑对齐）
  const refs = new Map()
  for (const [name, lines] of freeRefs) refs.set(name, lines.length)

  // 分类自由标识符
  const missingImport = [...refs.entries()].filter(([n]) => exported.has(n))
  const unknown = [...refs.entries()].filter(([n]) => !exported.has(n))

  if (missingImport.length || unknown.length) {
    totalIssues++
    console.log(`\n⚠️  ${f}`)
    if (missingImport.length) console.log('  MISSING-IMPORT (跨模块符号未导入):', missingImport.map(([n, c]) => `${n}(${c})`).join(' '))
    if (unknown.length) console.log('  UNKNOWN (非全局非导出，需人工确认):', unknown.map(([n, c]) => `${n}(${c})`).join(' '))
  } else {
    console.log(`✅ ${f}`)
  }
}
console.log(`\n审计结果: ${totalIssues} 个模块有问题`)
process.exit(totalIssues ? 1 : 0)
