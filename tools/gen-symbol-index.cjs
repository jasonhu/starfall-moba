#!/usr/bin/env node
/**
 * 生成内核符号索引 docs/SYMBOLS.md。
 *
 * 目的：语义化重命名只覆盖了有确定证据的符号；其余短名需要一个可导航的索引，
 * 让读代码的人能按「行号 + 类别 + 证据」快速定位。
 *
 * 证据来源：类的字段/方法名、函数的参数与首句、对象的键、数组长度、引用次数。
 */
const fs = require('fs')
const acorn = require('acorn')

const FILE = 'src/kernel/starfall.core.js'
const OUT = 'src/kernel/SYMBOLS.md'
const src = fs.readFileSync(FILE, 'utf8')
const lines = src.split('\n')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const isShort = (n) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n)
const refCount = new Map()
{
  const re = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g
  let m
  while ((m = re.exec(src))) refCount.set(m[0], (refCount.get(m[0]) || 0) + 1)
}

const buckets = { class: [], function: [], config: [], table: [], temp: [], other: [] }

const keyOf = (p) =>
  p && p.key ? (p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : '?') : '?'

for (const n of ast.body) {
  if (n.type === 'ClassDeclaration') {
    const ms = []
    for (const el of n.body.body) if (el.type === 'MethodDefinition') {
      const k = el.key
      const nm = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null
      if (nm && nm !== 'constructor') ms.push(nm)
    }
    if (!isShort(n.id.name)) continue
    buckets.class.push({ name: n.id.name, line: n.loc.start.line, refs: refCount.get(n.id.name) || 0, ev: `${ms.length} 方法: ${ms.slice(0, 6).join(', ')}` })
    continue
  }
  if (n.type === 'FunctionDeclaration' && n.id) {
    if (!isShort(n.id.name)) continue
    const params = n.params.map((p) => p.name || '?').join(',')
    const first = n.body.body[0]
    const snip = first ? lines[first.loc.start.line - 1].trim().slice(0, 70) : ''
    buckets.function.push({ name: n.id.name, line: n.loc.start.line, refs: refCount.get(n.id.name) || 0, ev: `(${params}) → ${snip}` })
    continue
  }
  if (n.type === 'VariableDeclaration')
    for (const d of n.declarations) {
      if (d.id.type !== 'Identifier' || !d.init || !isShort(d.id.name)) continue
      const name = d.id.name,
        init = d.init,
        refs = refCount.get(name) || 0
      const line = d.loc.start.line
      if (init.type === 'NewExpression' && init.callee.type === 'Identifier')
        buckets.temp.push({ name, line, refs, ev: `new ${init.callee.name}()` })
      else if (init.type === 'ObjectExpression') {
        const keys = init.properties.map(keyOf)
        buckets.config.push({ name, line, refs, ev: `${keys.length} 键: ${keys.slice(0, 8).join(', ')}` })
      } else if (init.type === 'ArrayExpression')
        buckets.table.push({ name, line, refs, ev: `${init.elements.length} 元素` })
      else buckets.other.push({ name, line, refs, ev: `${init.type}` })
    }
}

const total = Object.values(buckets).reduce((a, b) => a + b.length, 0)
const md = []
md.push('# 内核符号索引（未语义化部分）')
md.push('')
md.push('> 自动生成，请勿手工编辑；重新生成：`node tools/gen-symbol-index.cjs`')
md.push('> 行号仅供快速定位，用 `grep -nF` 复核。已语义化的符号不在本表（见 SECTIONS.md）。')
md.push('')
md.push(`未语义化顶层符号共 **${total}** 个：` + Object.entries(buckets).map(([k, v]) => `${k} ${v.length}`).join(' / '))
md.push('')

function section(title, rows, note) {
  if (!rows.length) return
  md.push(`## ${title}`)
  if (note) md.push('', note)
  md.push('')
  md.push('| 符号 | 行号 | 引用 | 证据 |')
  md.push('|---|---|---|---|')
  for (const r of rows.sort((a, b) => b.refs - a.refs)) md.push(`| \`${r.name}\` | ${r.line} | ${r.refs} | ${r.ev.replace(/\|/g, '\\|')} |`)
  md.push('')
}

section('类（class）', buckets.class, '字段/方法名保留完好，可直接按方法名判断职责。')
section('函数（function）', buckets.function, '括号内是参数名，箭头后是函数体首句（已去缩进）。')
section('配置对象（config）', buckets.config, '键名保留完好，多数是配色板或参数表。')
section('数组表（table）', buckets.table)
section('临时实例（temp）', buckets.temp, '模块级 scratch 对象（向量/矩阵/Map 等），非业务数据。')
section('其它（other）', buckets.other)

fs.writeFileSync(OUT, md.join('\n'))
console.log(`已生成 ${OUT}：${total} 个未语义化符号（class ${buckets.class.length} / function ${buckets.function.length} / config ${buckets.config.length} / table ${buckets.table.length} / temp ${buckets.temp.length} / other ${buckets.other.length}）`)
