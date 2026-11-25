#!/usr/bin/env node
/**
 * 为 @ts-nocheck 恢复模块补「构造函数动态挂载属性」的 declare 字段声明。
 *
 * 根因：压缩代码恢复的类在 constructor 里 this.xxx = ... 动态挂属性，
 * TS 不认 → 大量 TS2339 "Property 'xxx' does not exist on type 'Class'"。
 * 修法：在类体开头插入 declare 字段（按 init 右值推断类型），不改运行时行为。
 *
 * 用法: node tools/add-class-fields.cjs <file.ts> [--write]
 * 默认 dry-run，打印将要插入的字段。
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const WRITE = args.includes('--write')
if (!file) { console.error('用法: add-class-fields.cjs <file.ts> [--write]'); process.exit(2) }

const src = fs.readFileSync(file, 'utf8')
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

// 从 init 右值文本推断字段类型
function inferType(init) {
  const t = init.trim()
  if (/^!0$|^!1$|^true$|^false$/.test(t)) return 'boolean'
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return 'number'
  if (/^["'`]/.test(t)) return 'string'
  if (/^\[/.test(t)) return 'any[]'
  if (/^\{/.test(t)) return 'Record<string, any>'
  if (/^new [A-Z]\w+/.test(t)) { const m = t.match(/^new ([A-Z]\w+)/); return m[1] }
  if (/^this\./.test(t)) return 'any'
  return 'any'
}

const inserts = [] // { pos, text }
for (const stmt of sf.statements) {
  if (!ts.isClassDeclaration(stmt) || !stmt.name) continue
  const cls = stmt
  const clsName = cls.name.text
  // 收集本类构造函数里的 this.xxx =（不含方法里的）
  const fields = new Map()
  for (const member of cls.members) {
    if (!ts.isConstructorDeclaration(member) || !member.body) continue
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const l = n.left
        if (ts.isPropertyAccessExpression(l) && l.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const name = l.name.text
          if (!fields.has(name)) fields.set(name, inferType(n.right.getText(sf)))
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(member.body)
  }
  if (fields.size === 0) continue
  // 已有 declare 字段跳过
  const existing = new Set()
  for (const m of cls.members) {
    if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) existing.add(m.name.text)
  }
  const lines = []
  for (const [name, type] of fields) {
    if (existing.has(name)) continue
    lines.push(`  declare ${name}: ${type}`)
  }
  if (lines.length === 0) continue
  // 插入到类体左大括号之后
  const pos = stmt.members.pos
  inserts.push({ pos, cls: clsName, count: lines.length, text: '\n' + lines.join('\n') + '\n' })
}

console.log(JSON.stringify({ file, classes: inserts.map((i) => ({ class: i.cls, fields: i.count })) }, null, 2))
if (WRITE) {
  let out = src
  for (const ins of inserts.sort((a, b) => b.pos - a.pos)) {
    out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos)
  }
  fs.writeFileSync(file, out)
  console.log('[write] inserted', inserts.reduce((s, i) => s + i.count, 0), 'fields')
} else {
  console.log('[dry] would insert', inserts.reduce((s, i) => s + i.count, 0), 'fields')
}
