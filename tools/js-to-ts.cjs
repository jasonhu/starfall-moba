#!/usr/bin/env node
/**
 * 机械式 JS→TS 转换（可作用于真实 src 或临时副本）：
 *  1) 所有 .js → .ts
 *  2) 相对 import/export/dynamic-import 里的 './x.js' → './x'（去后缀）
 * 用法: node tools/js-to-ts.cjs <rootDir> [--write]
 * 默认 rootDir=src；不写 --write 时只报告。
 */
const fs = require('fs')
const path = require('path')

const root = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'src'
const WRITE = process.argv.includes('--write')
const ROOT = path.resolve(root)

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(ROOT)
const jsFiles = files.filter((f) => f.endsWith('.js'))
const codeFiles = files.filter((f) => /\.(js|ts)$/.test(f))

// 去相对 import 的 .js 后缀：'./x.js' -> './x'，'../x.js' -> '../x'
// 不动裸模块（three）与 .json/.css 等；不动字符串字面量中出现但非 import 位置的（用前面关键字锚定）
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(|\bimport\s+|\bexport\s+.*?\bfrom\s*)(['"])(\.{1,2}\/[^'"]*?)\.js\2/g

let specEdits = 0
const results = []
for (const f of codeFiles) {
  const src = fs.readFileSync(f, 'utf8')
  const out = src.replace(SPEC_RE, (m, pre, q, spec) => { specEdits++; return pre + q + spec + q })
  if (out !== src) results.push({ file: f, out })
}

console.log(`扫描 ${files.length} 文件；${jsFiles.length} 个 .js 待改名；${results.length} 文件含相对 .js import（共 ${specEdits} 处）`)
if (!WRITE) {
  console.log('[dry-run] 未写入')
  process.exit(0)
}
// 1) 先改 import 后缀
for (const r of results) fs.writeFileSync(r.file, r.out)
// 2) 再改扩展名
for (const f of jsFiles) fs.renameSync(f, f.slice(0, -3) + '.ts')
console.log(`[write] 已转换 ${jsFiles.length} 个文件为 .ts`)
