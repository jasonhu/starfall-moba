#!/usr/bin/env node
/**
 * 全库短名盘点：扫描 src 下所有 .js/.ts 文件的顶层声明，找出仍是短名的符号。
 * 短名判定：^[A-Za-z_$][A-Za-z0-9_$]{0,3}$（1-4 字符），排除纯 three 官方类/常见缩写。
 * 输出按文件分组的 JSON，供语义化排期。
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const ROOT = 'src'
const isShort = (n) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n)

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|ts)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(ROOT)
const report = []
let totalShort = 0
let totalDecl = 0

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let ast
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true })
  } catch (e) {
    // .ts 文件可能有类型语法，跳过解析失败
    report.push({ file, error: String(e.message).slice(0, 80) })
    continue
  }
  // 引用计数（粗略）
  const refCount = new Map()
  const re = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g
  let m
  while ((m = re.exec(src))) refCount.set(m[0], (refCount.get(m[0]) || 0) + 1)

  const shorts = []
  // 收集 import 绑定（这些是跨模块契约，单独标记）
  const importBindings = new Set()
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') {
      for (const s of n.specifiers) importBindings.add(s.local.name)
    }
  }
  for (const n of ast.body) {
    let name = null
    let kind = null
    let initSnip = ''
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier' || !isShort(d.id.name)) continue
        const init = d.init
        initSnip = init ? src.slice(init.start, Math.min(init.end, init.start + 40)).replace(/\n/g, ' ') : ''
        shorts.push({ name: d.id.name, kind: n.kind, isImport: importBindings.has(d.id.name), refs: refCount.get(d.id.name) || 0, init: initSnip })
        totalDecl++
      }
      continue
    }
    if (n.type === 'FunctionDeclaration' && n.id && isShort(n.id.name)) {
      shorts.push({ name: n.id.name, kind: 'function', isImport: false, refs: refCount.get(n.id.name) || 0, init: '' })
      totalDecl++
    } else if (n.type === 'ClassDeclaration' && n.id && isShort(n.id.name)) {
      shorts.push({ name: n.id.name, kind: 'class', isImport: false, refs: refCount.get(n.id.name) || 0, init: '' })
      totalDecl++
    }
  }
  if (shorts.length) {
    shorts.sort((a, b) => b.refs - a.refs)
    report.push({ file, count: shorts.length, shorts })
    totalShort += shorts.length
  }
}

report.sort((a, b) => (b.count || 0) - (a.count || 0))
const summary = { files: files.length, jsFiles: files.filter(f => f.endsWith('.js')).length, tsFiles: files.filter(f => f.endsWith('.ts')).length, totalShort, filesWithShort: report.filter(r => r.count).length }
fs.writeFileSync('/tmp/shortname-inventory.json', JSON.stringify({ summary, report }, null, 2))
console.log(JSON.stringify(summary))
console.log('TOP 20 files by short-name count:')
for (const r of report.slice(0, 20)) {
  if (!r.count) continue
  console.log(String(r.count).padStart(4), r.file, '|', r.shorts.slice(0, 6).map(s => `${s.name}(${s.refs})`).join(' '))
}
