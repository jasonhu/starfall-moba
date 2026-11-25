#!/usr/bin/env node
/**
 * 对齐「内核压缩常量链」与「官方 three r180 常量链」。
 *
 * 背景：rollup 打包时 tree-shake 掉了未使用的常量，导致两侧序列存在空洞，
 * 但相对顺序保持。用 LCS（最长公共子序列）按「值序列」对齐，再检查冲突。
 *
 * 输出：映射表（压缩名 → 官方名）+ 冲突/未匹配清单。
 */
const fs = require('fs')
const acorn = require('acorn')

const OUR_FILE = 'src/kernel/audio-constants.js'
const OFFICIAL = ['/tmp/three-check/package/build/three.core.js', '/tmp/three-check/package/build/three.module.js']

function decls(file, onlyTopLevel) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  const out = []
  const visit = (n) => {
    if (n.type === 'VariableDeclaration')
      for (const d of n.declarations) {
        if (d.id.type !== 'Identifier') continue
        const init = d.init
        let val = null
        if (!init) val = null
        else if (init.type === 'Literal') val = typeof init.value === 'number' ? `n:${init.value}` : `s:${init.value}`
        else if (init.type === 'UnaryExpression' && init.operator === '-' && init.argument.type === 'Literal') val = `n:${-init.argument.value}`
        else val = null // 对象/函数/表达式不参与对齐
        out.push({ name: d.id.name, val, type: init ? init.type : 'none' })
      }
  }
  for (const n of ast.body) {
    if (n.type === 'VariableDeclaration') visit(n)
    else if (n.type === 'ExportNamedDeclaration' && n.declaration && n.declaration.type === 'VariableDeclaration') visit(n.declaration)
  }
  return out
}

const ours = decls(OUR_FILE).filter((d) => d.val)
const off = OFFICIAL.flatMap((f) => decls(f)).filter((d) => d.val)

console.log(`我方常量(可对齐): ${ours.length}，官方常量(可对齐): ${off.length}`)

// LCS 对齐
const n = ours.length,
  m = off.length
const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
for (let i = n - 1; i >= 0; i--)
  for (let j = m - 1; j >= 0; j--)
    dp[i][j] = ours[i].val === off[j].val ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])

const pairs = []
let i = 0,
  j = 0
while (i < n && j < m) {
  if (ours[i].val === off[j].val) {
    pairs.push({ ours: ours[i], off: off[j], i, j })
    i++
    j++
  } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
  else j++
}

console.log(`LCS 对齐成功: ${pairs.length} / ${ours.length}`)
const unmatched = ours.filter((_, idx) => !pairs.some((p) => p.i === idx))
console.log(`未匹配(值不在官方集中或顺序冲突): ${unmatched.length}`)
if (unmatched.length) console.log('  ' + unmatched.map((u) => `${u.name}=${u.val}`).join(' '))

// 冲突检查：同一官方名被映射两次
const seen = new Map()
const conflicts = []
for (const p of pairs) {
  if (seen.has(p.off.name)) conflicts.push(`${p.ours.name} & ${seen.get(p.off.name)} → ${p.off.name}`)
  else seen.set(p.off.name, p.ours.name)
}
console.log(`官方名冲突: ${conflicts.length}`)
if (conflicts.length) console.log('  ' + conflicts.join('\n  '))

console.log('\n=== 映射（前 60）===')
for (const p of pairs.slice(0, 60)) console.log(`  ${p.ours.name.padEnd(5)} = ${String(p.ours.val).padEnd(8)} → ${p.off.name}`)

fs.writeFileSync('/tmp/const-map.json', JSON.stringify(pairs.map((p) => ({ local: p.ours.name, official: p.off.name, val: p.ours.val })), null, 1))
console.log('\n写入 /tmp/const-map.json')
