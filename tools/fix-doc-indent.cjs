#!/usr/bin/env node
/**
 * 修复 add-function-docs.cjs 在类方法上插入 JSDoc 时丢失的缩进。
 * 规则：若 `/**` 前有缩进，则其内部 `*` 行与紧随其后的声明行都补上同样缩进。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve('src')
const files = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.ts')) files.push(full)
  }
})(ROOT)

let changed = 0
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  let out = false
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s+)\/\*\*\s*$/)
    if (!match) continue
    const indent = match[1]
    let j = i + 1
    while (j < lines.length && !/^\s*\*\/\s*$/.test(lines[j])) {
      if (/^\s*\*/.test(lines[j])) {
        const normalized = `${indent} ${lines[j].trimStart()}`
        if (lines[j] !== normalized) { lines[j] = normalized; out = true }
      }
      j++
    }
    if (j < lines.length && /^\s*\*\/\s*$/.test(lines[j])) {
      const normalized = `${indent}${lines[j].trimStart()}`
      if (lines[j] !== normalized) { lines[j] = normalized; out = true }
    }
    if (j + 1 < lines.length && lines[j + 1].trim()) {
      const normalized = `${indent}${lines[j + 1].trimStart()}`
      if (lines[j + 1] !== normalized) { lines[j + 1] = normalized; out = true }
    }
  }
  if (out) {
    fs.writeFileSync(file, lines.join('\n'))
    changed++
  }
}
console.log(`修复缩进文件数: ${changed}`)
