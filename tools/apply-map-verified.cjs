#!/usr/bin/env node
/**
 * 一键批量改名 + α 等价验证：
 *  1) rename-across.cjs <map> --write（自动备份到 .rename-backup/）
 *  2) 对每个被改动的文件，用 verify-rename.cjs 做 α 等价验证
 * 用法: node tools/apply-map-verified.cjs <map.json>
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const mapFile = process.argv[2]
if (!mapFile) { console.error('用法: apply-map-verified.cjs <map.json>'); process.exit(2) }

const KERNEL = path.resolve('src/kernel')
const BAK = path.resolve('.rename-backup')

function changedFiles() {
  const out = []
  ;(function walk(rel) {
    const abs = path.join(BAK, rel)
    if (!fs.existsSync(abs)) return
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = path.join(rel, e.name)
      if (e.isDirectory()) walk(r)
      else if (e.name.endsWith('.js')) out.push(r)
    }
  })('')
  // 只保留「当前存在且与备份不同」的
  return out.filter(r => {
    const cur = path.join(KERNEL, r)
    return fs.existsSync(cur) && fs.readFileSync(cur) !== fs.readFileSync(path.join(BAK, r))
  })
}

// 清空旧备份，确保只验证本轮改动
if (fs.existsSync(BAK)) fs.rmSync(BAK, { recursive: true, force: true })

console.log('=== STEP 1: rename-across --write ===')
try {
  const o = execFileSync('node', ['tools/rename-across.cjs', mapFile, '--write'], { encoding: 'utf8' })
  console.log(o)
} catch (e) {
  console.log(e.stdout || '')
  console.error(e.stderr || '')
  if (e.status === 4 || e.status === 1) { console.error('改名工具拒绝执行，中止'); process.exit(e.status || 1) }
}

console.log('=== STEP 2: α 等价验证 ===')
const files = changedFiles()
let fail = 0
for (const rel of files) {
  const bak = path.join(BAK, rel)
  const cur = path.join(KERNEL, rel)
  try {
    execFileSync('node', ['tools/verify-rename.cjs', bak, cur, mapFile], { stdio: 'pipe' })
    console.log('  ✅', rel)
  } catch (e) {
    console.log('  ❌', rel, '\n', (e.stdout || '').toString().slice(0, 300))
    // 回滚该文件
    fs.copyFileSync(bak, cur)
    console.log('     ↩️ 已回滚')
    fail++
  }
}
console.log(`\n验证 ${files.length} 文件，失败 ${fail}`)
process.exit(fail ? 1 : 0)
