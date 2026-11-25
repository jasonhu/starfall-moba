#!/usr/bin/env node
/**
 * 工作单去重加固：保证同一文件内不会出现两个声明改成同一个新名。
 *
 * 生成器的 fileUsed 可能因遍历顺序/作用域嵌套漏判，tsc 会报 TS2451 重复声明。
 * 本工具在写盘前再扫一遍：按 (file, to) 分组，第 2+ 条换唯一后缀；
 * 后缀同时避开文件原始标识符与所有已分配新名。
 *
 * 用法: node tools/dedupe-worklist.cjs <in.json> <out.json>
 */
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const [inFile, outFile] = process.argv.slice(2)
if (!inFile || !outFile) { console.error('用法: dedupe-worklist.cjs <in.json> <out.json>'); process.exit(2) }
const worklist = JSON.parse(fs.readFileSync(inFile, 'utf8'))

// 每个文件的原始标识符集合（避免新名撞已有符号）
const originalIds = new Map()
function idsOf(file) {
  if (originalIds.has(file)) return originalIds.get(file)
  // 优先从 git HEAD 读原始源码（本工具在改名写盘前跑，工作树可能已含部分新名）
  let src = ''
  try { src = cp.execFileSync('git', ['show', `HEAD:./${file}`], { encoding: 'utf8', cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }) } catch (e) {
    const abs = path.resolve(file)
    if (fs.existsSync(abs)) src = fs.readFileSync(abs, 'utf8')
  }
  const set = new Set(src.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])
  originalIds.set(file, set)
  return set
}

// 按文件分组处理
const byFile = new Map()
for (const e of worklist) {
  const list = byFile.get(e.file) || []
  list.push(e)
  byFile.set(e.file, list)
}

let renamed = 0
const out = []
for (const [file, entries] of byFile) {
  const used = new Set(idsOf(file))
  for (const e of entries) {
    let name = e.to
    if (used.has(name)) {
      const base = name.replace(/\d+$/, '')
      const ordinals = ['Secondary', 'Tertiary', 'Quaternary', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth']
      let i = 0
      while (i < ordinals.length && used.has(`${base}${ordinals[i]}`)) i++
      name = i < ordinals.length ? `${base}${ordinals[i]}` : `${base}Extra${used.size}`
      renamed++
    }
    used.add(name)
    out.push({ ...e, to: name })
  }
}

fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ entries: out.length, deduped: renamed, outFile }))
