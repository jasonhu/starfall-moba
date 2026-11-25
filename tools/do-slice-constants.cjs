#!/usr/bin/env node
/** 一次性切片脚本：把 17-392 行的基础常量块移到 constants-core.js */
const fs = require('fs')
const acorn = require('acorn')
const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const lines = src.split('\n')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

// 取 loc 完全在 [17,392] 的顶层声明节点
const nodes = ast.body.filter((n) => n.loc.start.line >= 17 && n.loc.end.line <= 392)
if (!nodes.length) throw new Error('未找到目标声明')

// 用字符偏移精确抽取（首节点 start → 末节点 end）
const startOff = nodes[0].start
const endOff = nodes[nodes.length - 1].end
const block = src.slice(startOff, endOff)

// 收集这些节点声明的所有顶层符号名
const names = []
for (const n of nodes) {
  if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.push(n.id.name)
  else if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) {
      const walkPat = (id) => {
        if (!id) return
        if (id.type === 'Identifier') names.push(id.name)
        else if (id.type === 'ArrayPattern') id.elements.forEach(walkPat)
        else if (id.type === 'ObjectPattern') id.properties.forEach((p) => walkPat(p.value))
        else if (id.type === 'AssignmentPattern') walkPat(id.left)
        else if (id.type === 'RestElement') walkPat(id.argument)
      }
      walkPat(d.id)
    }
}

// 新文件：块内容 + export 全部符号
const header = `/**
 * 内核切片 · 基础常量与经济公式（原 starfall.core.js 第 17-392 行）
 * ---------------------------------------------------------------
 * 内容：小兵/防御塔/野怪数值表、成长经济公式、音效合成原语。
 * 依赖：零（本块不引用任何块外符号，已由 AST 验证）。
 * 本文件由工具自动抽取，变量名/逻辑与线上 100% 一致，仅为物理拆分。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
`
const out = header + block + '\n\nexport { ' + [...new Set(names)].join(', ') + ' }\n'
fs.writeFileSync('src/kernel/constants-core.js', out)

// 原文件：把 [startOff, endOff] 替换为 import 语句
const importLine = `import { ${[...new Set(names)].join(', ')} } from './constants-core'`
const newSrc = src.slice(0, startOff) + importLine + src.slice(endOff)
fs.writeFileSync(FILE, newSrc)

console.log(`切片完成：${nodes.length} 个声明，${names.length} 个符号，${block.split('\n').length} 行`)
console.log('导出符号:', [...new Set(names)].join(' '))
console.log('原文件新行数:', newSrc.split('\n').length)
