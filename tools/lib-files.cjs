/** 统一的文件发现：在 JS→TS 迁移期同时接受 .js 与 .ts（优先 .ts）。 */
const fs = require('fs')
const path = require('path')

/** 列出目录中的源码文件名（不递归），.js/.ts 去重（同名优先 .ts） */
function listSourceFiles(dir) {
  const names = new Map()
  for (const n of fs.readdirSync(dir)) {
    if (n.endsWith('.js') || n.endsWith('.ts')) {
      const base = n.replace(/\.(js|ts)$/, '')
      if (!names.has(base) || n.endsWith('.ts')) names.set(base, n)
    }
  }
  return [...names.values()]
}

/** 给定无后缀或 .js 路径，解析到实际存在的文件（.ts 优先） */
function resolveSource(p) {
  if (fs.existsSync(p)) return p
  const noExt = p.replace(/\.(js|ts)$/, '')
  for (const ext of ['.ts', '.js']) if (fs.existsSync(noExt + ext)) return noExt + ext
  return p
}

module.exports = { listSourceFiles, resolveSource }
