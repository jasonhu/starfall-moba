/**
 * 单元测试的 TS 模块加载器（零新依赖）
 * ---------------------------------------
 * Node 内置 node:test 无法直接 require .ts。这里用项目已有的 esbuild
 * 把目标 TS 模块（连同其依赖）现场 bundle 成 CJS 到临时目录再 require。
 * 与 tools/engine-smoke.cjs 同一手法，只是粒度到单模块、且不引内核全局副作用。
 */
const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')

const ROOT = path.resolve(__dirname, '../..')
const TMP = path.resolve(__dirname, '.bundles')
fs.mkdirSync(TMP, { recursive: true })

/** 加载一个 src 下的 TS 模块，返回其 ESM 导出对象 */
function loadTs(relPath) {
  const infile = path.join(ROOT, relPath)
  const outfile = path.join(TMP, relPath.replace(/[\\/]/g, '__').replace(/\.ts$/, '') + '.cjs')
  esbuild.buildSync({
    entryPoints: [infile],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    target: 'es2022',
  })
  // 每次 require 前清缓存，确保拿到刚生成的内容
  delete require.cache[require.resolve(outfile)]
  return require(outfile)
}

module.exports = { loadTs, ROOT, TMP }
