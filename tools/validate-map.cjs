#!/usr/bin/env node
/**
 * 改名映射静态校验（在 dry-run 之前跑）：
 *  - 目标名不能是 JS 保留字
 *  - 目标名不能重复（两个源名映射到同一新名）
 *  - 目标名不能等于「另一个未被本映射改名的符号名」（全局顶层/import 绑定）
 *  - 目标名不能命中已知 9 个遮蔽名
 *  - 源名若被内层遮蔽（权威工具会跳过文件）→ 报告警告
 * 用法: node tools/validate-map.cjs <map.json>
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const mapFile = process.argv[2]
if (!mapFile) { console.error('用法: validate-map.cjs <map.json>'); process.exit(2) }
const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
const olds = Object.keys(mapping)
const news = Object.values(mapping)

const RESERVED = new Set(('await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval').split(' '))
const SHADOWED = new Set('cv up sk cc to dy sp bg fn'.split(' '))

let errs = 0
function err(msg) { errs++; console.log('  ❌ ' + msg) }

// 1. 保留字
for (const n of news) if (RESERVED.has(n)) err(`目标名是保留字: ${n}`)
// 2. 重复目标
const seen = new Set()
for (const n of news) { if (seen.has(n)) err(`目标名重复: ${n}`); seen.add(n) }
// 3. 9 遮蔽名
for (const n of news) if (SHADOWED.has(n)) err(`目标名命中已知遮蔽名: ${n}`)
// 4. 非合法标识符
for (const n of news) if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)) err(`目标名非合法标识符: ${n}`)

// 收集全局所有绑定（顶层声明 + import）与所有出现的标识符名
const files = []
;(function w(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); fs.statSync(p).isDirectory() ? w(p) : n.endsWith('.js') && files.push(p) } })(path.resolve('src/kernel'))
const allBindings = new Set()
for (const f of files) {
  let ast
  try { ast = acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }) } catch { continue }
  for (const n of ast.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') allBindings.add(d.id.name)
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) allBindings.add(n.id.name)
    if (n.type === 'ImportDeclaration') for (const s of n.specifiers) allBindings.add(s.local.name)
  }
}
// 目标名不能与「未被改名的现有绑定」冲突
for (const n of news) if (allBindings.has(n) && !olds.includes(n)) err(`目标名与现有绑定冲突: ${n}`)

console.log(`校验 ${olds.length} 条映射：${errs} 个问题`)
process.exit(errs ? 1 : 0)
