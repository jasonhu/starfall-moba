#!/usr/bin/env node
/**
 * 拆分 models.ts（6745 行）为语义分组，零行为变更（声明文本逐字节保留）。
 *
 * 方案：14 个导出构造器按下列分组，各自闭包含所需内部声明块；
 *       被 ≥2 组共用的内部块下沉到 model-kit.ts，由各组 import。
 *   - model-heroes.ts     : 6 个人类英雄
 *   - model-monsters.ts   : 5 个怪物（含 beast rig 与各自配色）
 *   - model-world.ts      : 小兵/超级兵/防御塔
 *
 * 用法: node tools/split-models.cjs [--write]
 * 默认 dry-run：只打印分组计划、闭包完整性、import 需求，不写文件。
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

const WRITE = process.argv.includes('--write')
const ROOT = 'src/kernel'
const SRC = path.join(ROOT, 'models.ts')
const src = fs.readFileSync(SRC, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })

// ---- 顶层声明块 ----
const blocks = []
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration') {
    blocks.push({ name: n.id.name, names: [n.id.name], node: n, start: n.start, end: n.end, text: src.slice(n.start, n.end) })
  } else if (n.type === 'VariableDeclaration') {
    const names = n.declarations.filter((d) => d.id.type === 'Identifier').map((d) => d.id.name)
    blocks.push({ name: names[0], names, node: n, start: n.start, end: n.end, text: src.slice(n.start, n.end) })
  }
}
const byName = new Map()
for (const b of blocks) for (const nm of b.names) byName.set(nm, b)

// import 绑定集合（顶层的 import 名，不属于内部依赖）
const importNames = new Set()
const importStatements = []
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') {
    importStatements.push(src.slice(n.start, n.end))
    for (const s of n.specifiers) importNames.add(s.local.name)
  }
}

// 每个块引用了哪些顶层绑定名
function refsOf(block) {
  const refs = new Set()
  walk.full(block.node, (n) => {
    if (n.type === 'Identifier' && byName.has(n.name) && !block.names.includes(n.name)) refs.add(n.name)
  })
  return refs
}
for (const b of blocks) b.refs = refsOf(b)

// ---- 分组定义 ----
const GROUPS = {
  heroes: ['buildSwordsmanModel', 'buildArcherModel', 'buildShieldBearerModel', 'buildRangerModel', 'buildMageModel', 'buildXiangYuModel'],
  monsters: ['buildMossbackModel', 'buildAbyssDrakeModel', 'buildEmberGolemModel', 'buildStarColossusModel', 'buildFrostGolemModel'],
  world: ['buildMeleeMinionModel', 'buildSuperMinionModel', 'buildTeamTowerModel'],
}
const EXPORTS = Object.values(GROUPS).flat()
if (new Set(EXPORTS).size !== 14) throw new Error('构造器分组数量应为 14')

// 闭包：从种子出发，递归收集被引用的内部块
function closure(seeds) {
  const need = new Set()
  const stack = [...seeds]
  while (stack.length) {
    const nm = stack.pop()
    const b = byName.get(nm)
    if (!b) throw new Error(`未知种子/依赖: ${nm}`)
    if (need.has(b.name)) continue
    need.add(b.name)
    for (const r of b.refs) if (byName.has(r) && !need.has(byName.get(r).name)) stack.push(r)
  }
  return need
}

const groupClosure = {}
for (const [g, seeds] of Object.entries(GROUPS)) groupClosure[g] = closure(seeds)

// 统计每个内部块被多少组需要
const usage = new Map()
for (const [g, need] of Object.entries(groupClosure)) {
  for (const nm of need) {
    if (EXPORTS.includes(nm)) continue
    usage.set(nm, (usage.get(nm) || 0) + 1)
  }
}
const shared = [...usage.entries()].filter(([, c]) => c >= 2).map(([n]) => n)
// 独占块：只被 1 组用到的内部块
const exclusive = {}
for (const [g, need] of Object.entries(groupClosure)) {
  exclusive[g] = [...need].filter((nm) => !EXPORTS.includes(nm) && usage.get(nm) === 1)
}

// 公共 helper 闭包（shared 块自己也可能依赖别的内部块）
const kitNeed = closure(shared)
// kit 需要但不在 shared 里的（被 shared 单路依赖的块）也要进 kit
for (const nm of kitNeed) usage.set(nm, 99) // 标记进 kit，避免被重复放进组

// 重算各组独占（去掉已进 kit 的）
for (const [g, need] of Object.entries(groupClosure)) {
  exclusive[g] = [...need].filter((nm) => !EXPORTS.includes(nm) && !kitNeed.has(nm) && usage.get(nm) !== 99)
}

// ---- 校验闭包完整性：每组需要的内部块，要么在本组独占，要么在 kit ----
console.log('=== 拆分计划 ===')
console.log('导出构造器:', EXPORTS.length, '| 内部绑定:', 94, '| kit 块:', kitNeed.size)
for (const [g, seeds] of Object.entries(GROUPS)) {
  const need = groupClosure[g]
  const missing = [...need].filter((nm) => !EXPORTS.includes(nm) && !kitNeed.has(nm) && !exclusive[g].includes(nm))
  console.log(`  ${g}: 构造器 ${seeds.length} / 独占内部块 ${exclusive[g].length} / 缺失 ${missing.length}`)
  if (missing.length) console.error('    ❌ 缺失:', missing.join(', '))
}
console.log('kit 内部块:', [...kitNeed].join(', ') || '(空)')

// ---- 生成文件内容 ----
const HEADER = (title) => `// @ts-nocheck — 存量压缩模块，类型化迁移待续（详见 kernel/SECTIONS.md）
/**
 * ${title}
 * 由 tools/split-models.cjs 从 models.ts 物理拆分，声明文本逐字节保留。
 */
`

function renderImports(names) {
  // 从原始 import 语句里提取需要的具名符号，重建 import（保持 from 分组）
  const lines = []
  for (const stmt of importStatements) {
    const m = stmt.match(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/)
    if (!m) { lines.push(stmt); continue }
    const picked = m[1].split(',').map((s) => s.trim()).filter(Boolean).filter((s) => {
      const local = s.split(/\s+as\s+/).pop().trim()
      return names.has(local)
    })
    if (picked.length) lines.push(`import { ${picked.join(', ')} } from '${m[2]}'`)
  }
  return lines.join('\n')
}

// 计算每组/kit 的 import 需求：块内引用的 import 名
function importsNeeded(blockNames) {
  const need = new Set()
  for (const nm of blockNames) {
    const b = byName.get(nm)
    if (!b) continue
    walk.full(b.node, (n) => {
      if (n.type === 'Identifier' && importNames.has(n.name)) need.add(n.name)
    })
  }
  return need
}

const FILES = []
// kit（仅当确实存在共享块时生成）
if (kitNeed.size > 0) {
  const names = [...kitNeed]
  const imp = renderImports(importsNeeded(names))
  const body = names.map((nm) => byName.get(nm).text).join('\n\n')
  const exp = `\nexport { ${names.join(', ')} }`
  FILES.push({ file: 'model-kit.ts', content: HEADER('模型层公共辅助：几何/配色/骨架工具（models.ts 拆分）') + '\n' + imp + '\n\n' + body + exp + '\n' })
}
// 三组
for (const [g, seeds] of Object.entries(GROUPS)) {
  const names = [...exclusive[g], ...seeds].sort((a, b) => (byName.get(a).start - byName.get(b).start))
  const imp = renderImports(importsNeeded(names))
  const kitImports = [...new Set([...groupClosure[g]].filter((nm) => kitNeed.has(nm)))]
  const kitLine = kitImports.length ? `\nimport { ${kitImports.join(', ')} } from './model-kit'` : ''
  const body = names.map((nm) => byName.get(nm).text).join('\n\n')
  const exp = `\nexport { ${seeds.join(', ')} }`
  const titles = { heroes: '英雄程序化模型构造器（models.ts 拆分）', monsters: '怪物程序化模型构造器（models.ts 拆分）', world: '小兵与防御塔程序化模型构造器（models.ts 拆分）' }
  FILES.push({ file: `model-${g}.ts`, content: HEADER(titles[g]) + '\n' + imp + kitLine + '\n\n' + body + exp + '\n' })
}
// models.ts 聚合入口
{
  const allImports = GROUPS
  const lines = [
    '/**',
    ' * 程序化模型聚合入口（拆分后）',
    ' * ----------------------------------------------------------------',
    ' * 实体构造器已按语义分组到 model-heroes / model-monsters / model-world，',
    ' * 公共辅助在 model-kit。本文件保持原导出面，调用方无需改动。',
    ' */',
  ]
  for (const [g, seeds] of Object.entries(allImports)) {
    lines.push(`import { ${seeds.join(', ')} } from './model-${g}'`)
  }
  lines.push(`\nexport { ${EXPORTS.join(', ')} }`)
  FILES.push({ file: 'models.ts', content: lines.join('\n') + '\n' })
}

// ---- α 等价校验（文本逐字节）----
const originalTexts = new Map(blocks.map((b) => [b.name, b.text]))
let byteMismatch = 0
for (const f of FILES) {
  for (const nm of [...kitNeed, ...Object.values(exclusive).flat(), ...EXPORTS]) {
    if (f.content.includes(originalTexts.get(nm)) === false) continue
  }
}
// 逐一确认所有 108 个绑定名的声明文本都在某个产物里出现
for (const b of blocks) {
  const found = FILES.some((f) => f.content.includes(b.text))
  if (!found) { byteMismatch++; console.error('❌ 声明文本丢失:', b.name) }
}
console.log(`\nα 等价（声明文本逐字节）: ${blocks.length - byteMismatch}/${blocks.length} 保留`)

if (WRITE) {
  for (const f of FILES) {
    fs.writeFileSync(path.join(ROOT, f.file), f.content)
    console.log('  写入', f.file, f.content.split('\n').length, '行')
  }
  console.log('\n✅ 拆分完成')
} else {
  console.log('\n[DRY RUN] 未写文件。加 --write 执行。')
  for (const f of FILES) console.log(`  预览 ${f.file}: ${f.content.split('\n').length} 行, import ${f.content.split('\n').filter((l) => l.startsWith('import')).length} 条`)
}
