#!/usr/bin/env node
/**
 * 为指定文件生成「命名工作单」：列出每个顶层短名的定义上下文，便于批量赋予语义名。
 * 用法: node tools/naming-worksheet.cjs <file> [maxChars]
 */
const fs = require('fs')
const acorn = require('acorn')

const file = process.argv[2]
if (!file) { console.error('用法: naming-worksheet.cjs <file> [maxChars=160]'); process.exit(2) }
const maxChars = Number(process.argv[3] || 160)
const src = fs.readFileSync(file, 'utf8')
const lines = src.split('\n')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true, locations: true })
const isShort = (n) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(n)

// exported / imported 标记
const exported = new Set()
const imported = new Set()
const importSrc = new Map()
for (const n of ast.body) {
  if (n.type === 'ExportNamedDeclaration' && n.declaration) {
    if (n.declaration.type === 'VariableDeclaration') for (const d of n.declaration.declarations) if (d.id.type === 'Identifier') exported.add(d.id.name)
    if (n.declaration.type === 'FunctionDeclaration' && n.declaration.id) exported.add(n.declaration.id.name)
    if (n.declaration.type === 'ClassDeclaration' && n.declaration.id) exported.add(n.declaration.id.name)
  }
  if (n.type === 'ExportNamedDeclaration' && n.specifiers) for (const s of n.specifiers) exported.add(s.exported.name)
  if (n.type === 'ImportDeclaration') {
    for (const s of n.specifiers) { imported.add(s.local.name); importSrc.set(s.local.name, n.source.value) }
  }
}

function countRefs(name) {
  const re = new RegExp('\\b' + name.replace(/[$]/g, '\\$') + '\\b', 'g')
  return (src.match(re) || []).length
}

const rows = []
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration' && n.id && isShort(n.id.name)) {
    const params = n.params.map(p => p.type === 'Identifier' ? p.name : p.type === 'AssignmentPattern' ? (p.left.name || '?') : '?').join(',')
    const bodySnip = lines[n.body.loc.start.line] ? lines[n.body.loc.start.line].trim().slice(0, maxChars) : ''
    rows.push({ name: n.id.name, kind: 'fn', refs: countRefs(n.id.name), exp: exported.has(n.id.name), imp: imported.has(n.id.name), sig: `(${params}) => ${bodySnip}` })
  } else if (n.type === 'ClassDeclaration' && n.id && isShort(n.id.name)) {
    const methods = n.body.body.filter(e => e.type === 'MethodDefinition' && e.key.type === 'Identifier' && e.key.name !== 'constructor').map(e => e.key.name)
    rows.push({ name: n.id.name, kind: 'class', refs: countRefs(n.id.name), exp: exported.has(n.id.name), imp: false, sig: `${methods.length}方法: ${methods.slice(0,8).join(',')}` })
  } else if (n.type === 'VariableDeclaration') {
    for (const d of n.declarations) {
      if (d.id.type !== 'Identifier' || !isShort(d.id.name)) continue
      const init = d.init ? src.slice(d.init.start, d.init.end).replace(/\s+/g, ' ').slice(0, maxChars) : '(no init)'
      rows.push({ name: d.id.name, kind: n.kind, refs: countRefs(d.id.name), exp: exported.has(d.id.name), imp: imported.has(d.id.name), sig: `= ${init}`, src: importSrc.get(d.id.name) })
    }
  }
}
rows.sort((a, b) => b.refs - a.refs)
console.log(`# ${file}  (${rows.length} 短名)\n`)
for (const r of rows) {
  const flags = [r.exp ? 'EXPORT' : '', r.imp ? `IMPORT:${r.src}` : ''].filter(Boolean).join(' ')
  console.log(`${r.name.padEnd(6)} [${r.kind.padEnd(8)}] refs=${String(r.refs).padStart(3)} ${flags}`)
  console.log(`       ${r.sig}`)
}
