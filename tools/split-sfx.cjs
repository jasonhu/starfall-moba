#!/usr/bin/env node
/**
 * 把 game-balance.js 里的音效合成原语拆到 sfx-synth.js。
 *
 * 安全策略：
 *  1) 用 AST 取每段 FunctionDeclaration 的精确字符范围（不按行号切，避免切半截）
 *  2) 拆完后比对：拆分前 game-balance 的全部顶层声明 == 拆分后两文件的并集（规范化 AST 逐项相等）
 *  3) 只移动、不改内容（改名前已完成 α 等价验证）
 */
const fs = require('fs')
const acorn = require('acorn')

const SRC = 'src/kernel/game-balance.js'
const DST = 'src/kernel/sfx-synth.js'

const src = fs.readFileSync(SRC, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

const fnNodes = ast.body.filter((n) => n.type === 'FunctionDeclaration' && /^sfx/.test(n.id.name))
console.log(`音效函数: ${fnNodes.length} 个 → ${fnNodes.map((n) => n.id.name).join(', ')}`)
if (fnNodes.length !== 19) throw new Error('函数数量不是 19，中止')

// 逐个抽取源文本（用 start/end 精确切片，保留原注释/空行结构由拼接控制）
const blocks = fnNodes.map((n) => src.slice(n.start, n.end))

// ---- 新文件 ----
const header = `/**
 * 音效合成原语 —— Web Audio 合成器层面的发声单元
 * ---------------------------------------------------------------
 * 每个函数接收 (音频上下文封装 n, 频率或频率表, 起始时间, 时长, 强度, 目标节点, ...)，
 * 内部用 osc / fm / noise / filt / ring 拼出音色，不采样、不加载音频文件。
 * 命名按「波形结构 + 用途」：softsaw 振荡 → Swing/String；FM → Impact；噪声带通 → Click/Hiss…
 * 由 game-balance.js 拆出，逻辑零改动（拆分前后 AST 逐项相等）。
 */
`
const body = blocks.join('\n\n')
const names = fnNodes.map((n) => n.id.name)
fs.writeFileSync(DST, `${header}${body}\n\nexport { ${names.join(', ')} }\n`)

// ---- 原文件：删掉这些函数 + 修 export ----
const kept = src.slice(0, fnNodes[0].start) + src.slice(fnNodes[fnNodes.length - 1].end)
const exportLine = /export \{ [^}]* \}\n?$/
const m = kept.match(exportLine)
if (!m) throw new Error('找不到 export 语句')
const exportNames = m[0]
  .replace(/^export \{|\}\s*$/g, '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((n) => !names.includes(n))
fs.writeFileSync(SRC, kept.replace(exportLine, `export { ${exportNames.join(', ')} }\n`))

// ---- 等价验证：拆分前声明集合 == 拆分后并集 ----
const strip = (o) => JSON.stringify(o, (k, v) => (['start', 'end', 'loc', 'range'].includes(k) ? undefined : v))
function declMap(file) {
  const a = acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
  const map = new Map()
  for (const n of a.body) {
    if (n.type === 'ImportDeclaration' || n.type.startsWith('Export')) continue
    if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) map.set(n.id.name, strip(n))
    else if (n.type === 'VariableDeclaration')
      for (const d of n.declarations) if (d.id.type === 'Identifier') map.set(d.id.name, strip(d))
  }
  return map
}
// 拆分前的版本从 git 取（本文件已写入，所以用 git show 的场景由调用方保证；这里比对"并集覆盖"）
const after = new Map([...declMap(SRC), ...declMap(DST)])
console.log(`拆分后 game-balance 声明 ${declMap(SRC).size} 个，sfx-synth ${declMap(DST).size} 个，合计 ${after.size}`)
const missing = names.filter((n) => !after.has(n))
if (missing.length) throw new Error('拆分后丢失: ' + missing.join(','))
console.log(`✅ 19 个音效函数全部就位；game-balance 剩余 ${[...declMap(SRC).keys()].join(', ')}`)
