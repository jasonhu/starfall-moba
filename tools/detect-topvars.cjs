#!/usr/bin/env node
/**
 * 顶层变量语义化候选识别。
 *
 * 三类高置信信号：
 *  A. 临时实例：`const X = new Foo()` 且 X 从不被整体赋值 → TEMP_<Foo>
 *  B. 配置对象：ObjectExpression 且 >=70% 的 key 是有意义的英文单词 → 按 key 归组命名
 *  C. 纯数组表：ArrayExpression（元素为对象/数组）→ 按首元素 key 命名
 *
 * 输出 /tmp/topvar-map.json（含证据），由人工/脚本二次筛选后执行改名。
 */
const fs = require('fs')
const acorn = require('acorn')

const FILE = 'src/kernel/starfall.core.js'
const src = fs.readFileSync(FILE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const isShort = (n) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n)
const isWord = (n) => /^[a-z][a-zA-Z0-9]{2,}$/.test(n)

// 统计每个名字被引用次数（粗略）
const refCount = new Map()
{
  const re = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g
  let m
  while ((m = re.exec(src))) refCount.set(m[0], (refCount.get(m[0]) || 0) + 1)
}

const out = []
for (const n of ast.body) {
  if (n.type !== 'VariableDeclaration') continue
  for (const d of n.declarations) {
    if (d.id.type !== 'Identifier' || !d.init) continue
    const name = d.id.name
    if (!isShort(name)) continue
    const init = d.init

    // A. new Foo(...)
    if (init.type === 'NewExpression' && init.callee.type === 'Identifier') {
      const cls = init.callee.name
      // 排除被整体重新赋值的（无法判断，保守跳过）
      const reassigned = new RegExp(`\\b${name}\\s*=\\s*(?!new)\\S`).test(src)
      out.push({
        local: name,
        kind: 'temp',
        proposed: `TEMP_${cls}`,
        evidence: `new ${cls}()`,
        refs: refCount.get(name) || 0,
        line: d.loc.start.line,
        safe: !reassigned,
      })
      continue
    }

    // B. 配置对象
    if (init.type === 'ObjectExpression' && init.properties.length >= 3) {
      const keys = init.properties
        .map((p) => (p.key && p.key.type === 'Identifier' ? p.key.name : p.key && p.key.type === 'Literal' ? String(p.key.value) : null))
        .filter(Boolean)
      const wordKeys = keys.filter(isWord)
      if (wordKeys.length / keys.length >= 0.7) {
        out.push({
          local: name,
          kind: 'object',
          proposed: `CONFIG_${wordKeys.slice(0, 3).join('_').toUpperCase()}`,
          evidence: `${keys.length} 键: ${wordKeys.slice(0, 6).join(',')}`,
          refs: refCount.get(name) || 0,
          line: d.loc.start.line,
          safe: true,
        })
      }
      continue
    }

    // C. 数组表
    if (init.type === 'ArrayExpression' && init.elements.length >= 3) {
      const first = init.elements[0]
      let hint = 'TABLE'
      if (first && first.type === 'ObjectExpression' && first.properties[0] && first.properties[0].key)
        hint = `${String(first.properties[0].key.name || first.properties[0].key.value).toUpperCase()}_TABLE`
      out.push({
        local: name,
        kind: 'array',
        proposed: `ARRAY_${hint}`,
        evidence: `${init.elements.length} 元素`,
        refs: refCount.get(name) || 0,
        line: d.loc.start.line,
        safe: true,
      })
    }
  }
}

const byKind = out.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {})
console.log(`候选 ${out.length} 个：`, JSON.stringify(byKind))
console.log('\n--- 临时实例（前 30，按引用数）---')
for (const r of out.filter((r) => r.kind === 'temp').sort((a, b) => b.refs - a.refs).slice(0, 30))
  console.log(`  ${String(r.line).padStart(6)} ${r.local.padEnd(4)} → ${r.proposed.padEnd(24)} ${r.evidence}  引用${r.refs}${r.safe ? '' : ' ⚠可能被重新赋值'}`)
console.log('\n--- 配置对象（前 25）---')
for (const r of out.filter((r) => r.kind === 'object').sort((a, b) => b.refs - a.refs).slice(0, 25))
  console.log(`  ${String(r.line).padStart(6)} ${r.local.padEnd(4)} 引用${String(r.refs).padStart(3)}  ${r.evidence}`)
console.log('\n--- 数组表（前 15）---')
for (const r of out.filter((r) => r.kind === 'array').sort((a, b) => b.refs - a.refs).slice(0, 15))
  console.log(`  ${String(r.line).padStart(6)} ${r.local.padEnd(4)} → ${r.proposed}  ${r.evidence}  引用${r.refs}`)

fs.writeFileSync('/tmp/topvar-map.json', JSON.stringify(out, null, 1))
console.log('\n写入 /tmp/topvar-map.json')
