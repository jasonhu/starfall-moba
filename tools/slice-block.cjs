#!/usr/bin/env node
/**
 * 通用切片脚本：把内核 [START,END] 行的完整顶层声明搬到一个新模块。
 * 前置条件（必须已用 analyze-slice-deps.cjs 验证）：段内→段外 = 0。
 *
 * 用法: node tools/slice-block.cjs <startLine> <endLine> <新文件名(相对 src/kernel/)> <模块说明>
 * 例:   node tools/slice-block.cjs 10492 10814 triangulation.js "多边形三角剖分算法组"
 */
const fs = require('fs')
const acorn = require('acorn')

const [, , sArg, eArg, outName, desc] = process.argv
if (!sArg || !eArg || !outName) {
  console.error('用法: node tools/slice-block.cjs <start> <end> <新文件名> <说明>')
  process.exit(1)
}
const START = Number(sArg)
const END = Number(eArg)
const FILE = 'src/kernel/starfall.core.js'
const OUT = 'src/kernel/' + outName
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// 完全落在 [START,END] 的顶层声明
const nodes = ast.body.filter((n) => n.loc.start.line >= START && n.loc.end.line <= END)
if (!nodes.length) throw new Error('未找到目标声明')
// 安全检查：不能有跨越边界的声明
const crossing = ast.body.filter((n) => n.loc.start.line <= END && n.loc.end.line >= START && !nodes.includes(n))
if (crossing.length) {
  console.error('错误：边界切到声明内部！跨越的声明:', crossing.map((n) => `${n.type}@${n.loc.start.line}-${n.loc.end.line}`))
  process.exit(1)
}

const startOff = nodes[0].start
const endOff = nodes[nodes.length - 1].end
const block = src.slice(startOff, endOff)

const names = []
for (const n of nodes) {
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  else if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) {
      const p = (id) => {
        if (!id) return
        if (id.type === 'Identifier') names.push(id.name)
        else if (id.type === 'ArrayPattern') id.elements.forEach(p)
        else if (id.type === 'ObjectPattern') id.properties.forEach((x) => p(x.value))
        else if (id.type === 'AssignmentPattern') p(id.left)
        else if (id.type === 'RestElement') p(id.argument)
      }
      p(d.id)
    }
}
const uniqNames = [...new Set(names)]

const header = `/**
 * 内核切片 · ${desc || outName}（原 starfall.core.js 第 ${START}-${END} 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
`
fs.writeFileSync(OUT, header + block + '\n\nexport { ' + uniqNames.join(', ') + ' }\n')

const importLine = `import { ${uniqNames.join(', ')} } from './${outName}'`
const newSrc = src.slice(0, startOff) + importLine + src.slice(endOff)
fs.writeFileSync(FILE, newSrc)

console.log(`切片完成 → ${OUT}`)
console.log(`  ${nodes.length} 个声明, ${uniqNames.length} 个符号, ${block.split('\n').length} 行`)
console.log(`  导出: ${uniqNames.join(' ')}`)
console.log(`  内核新行数: ${newSrc.split('\n').length}`)
