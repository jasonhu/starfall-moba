#!/usr/bin/env node
/**
 * 执行 Three.js 替换：
 *   1) 删除 core 中内联的 three 区（3675-20038）
 *   2) 在原位置写入 `import { 官方名 as 压缩名 } from 'three'` + 3 个内部临时变量
 *
 * 用法：
 *   node tools/apply-three-swap.cjs            # dry-run，只检查与打印
 *   node tools/apply-three-swap.cjs --write    # 真正写入
 */
const fs = require('fs')
const acorn = require('acorn')

const CORE = 'src/kernel/starfall.core.js'
const START = 3675
const END = 20038
const WRITE = process.argv.includes('--write')

const rows = JSON.parse(fs.readFileSync('/tmp/three-final-map.json', 'utf8'))
const mapped = rows.filter((r) => r.official)
const temps = rows.filter((r) => !r.official).map((r) => r.local)

// 去重：local 唯一；official 可重复（不同 local 别名同一个导出）
const seenLocal = new Set()
const specifiers = []
for (const r of mapped) {
  if (seenLocal.has(r.local)) continue
  seenLocal.add(r.local)
  specifiers.push(`${r.official} as ${r.local}`)
}
specifiers.sort((a, b) => a.localeCompare(b))

const tempLines = [
  `const bg = new dt(),`,
  `  cc = new dt(),`,
  `  cv = new Ri()`,
]

const importBlock = [
  `// ---- Three.js r180（官方 npm 包，版本锁定见 package.json）----`,
  `// 保留打包后的短别名，使其余游戏代码零改动；新增功能请直接用官方类名。`,
  `import {`,
  ...specifiers.map((s) => `  ${s},`),
  `} from 'three'`,
  ``,
  `// Three.js 内部复用的临时向量/四元数（原内联副本中的模块级 scratch 变量）`,
  ...tempLines,
  ``,
].join('\n')

// ---- 边界校验 ----
const src = fs.readFileSync(CORE, 'utf8')
const lines = src.split('\n')
const lineAt = (n) => lines[n - 1]
console.log(`第 ${START} 行: ${lineAt(START).slice(0, 80)}`)
console.log(`第 ${END} 行:   ${lineAt(END)}`)
if (!lineAt(START).startsWith('import {')) throw new Error('起点不是 import 语句，边界错误')
if (lineAt(END).trim() !== '}') throw new Error('终点不是类结束的 }，边界错误')
console.log(`拟删除行数: ${END - START + 1}`)

// 用 AST 确认删除区间内没有「游戏侧需要的」声明 —— 即区间外不再声明同名
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
const outside = new Set()
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') continue
  if (n.loc.start.line >= START && n.loc.end.line <= END) continue
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) outside.add(n.id.name)
  else if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) if (d.id.type === 'Identifier') outside.add(d.id.name)
}
const clash = mapped.filter((r) => outside.has(r.local)).map((r) => r.local)
if (clash.length) {
  console.log(`⚠️ 以下别名在区间外也有顶层声明（会重复定义）: ${clash.join(' ')}`)
} else {
  console.log('✅ 无重复声明冲突')
}
console.log(`\n导入符号: ${specifiers.length} 个，临时变量: ${temps.length} 个 (${temps.join(', ')})`)
console.log('导入块预览（前 8 行 / 后 6 行）:')
console.log(importBlock.split('\n').slice(0, 8).join('\n'))
console.log('  ...')
console.log(importBlock.split('\n').slice(-6).join('\n'))

if (!WRITE) {
  console.log('\n[dry-run] 未写入。加 --write 执行。')
  process.exit(0)
}

const out = [...lines.slice(0, START - 1), importBlock, ...lines.slice(END)].join('\n')
fs.writeFileSync(CORE, out)
console.log(`\n已写入。内核行数: ${lines.length} → ${out.split('\n').length}`)
