#!/usr/bin/env node
/**
 * 内核分层规划器：给 starfall.core.js 里的每个顶层声明判定「目标分层」
 * ---------------------------------------------------------------
 * 参照 e01-ai/starfall 的目录划分：core / sim / ships / render / fx / ui / world
 * 我们用证据打分，而不是凭名字猜：
 *
 *   DOM 特征      → ui      （document/createEl/classList/innerHTML/事件监听）
 *   渲染特征      → render  （renderer/scene/camera/material/geometry/texture/shader）
 *   特效特征      → fx      （particle/glow/decal/trail/vfx/emit fx）
 *   模拟特征      → sim     （unit/state/command/emit/order/combat/ai）
 *   音频特征      → audio   （AudioContext/osc/noise/gain/voice）
 *   世界特征      → world   （nav/terrain/map/bush/spawn）
 *   都不沾        → core    （纯数学/工具/常量）
 *
 * 名字里的既有语义作为「先验」加分（我们已把类/函数大量语义化）。
 *
 * 输出：docs/05-内核分层映射.md + /tmp/layer-plan.json
 *
 * 用法：node tools/plan-layers.cjs [--top 20]
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const CORE = 'src/kernel/starfall.core.js'
const OUT_MD = '../../../../docs/05-内核分层映射.md'
const OUT_JSON = '/tmp/layer-plan.json'

const src = fs.readFileSync(CORE, 'utf8')
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

/** 特征词表：命中即给对应层加分 */
const FEATURES = {
  ui: [
    /\bdocument\./g, /\bcreateEl\(/g, /classList/g, /innerHTML/g, /appendChild/g,
    /addEventListener/g, /querySelector/g, /getBoundingClientRect/g, /\bsf-hud/g,
    /HUD_|_HUD|Hud[A-Z]/, /createHud|createMinimap|createSkillBar|createScoreboard|createToast|createBanner|createKillFeed|createCoach|createTips|createFps/,
  ],
  render: [
    /\brenderer\b/g, /\bscene\b/g, /\bcamera\b/g, /WebGLRenderTarget/g, /ShaderMaterial|RawShaderMaterial/g,
    /BufferGeometry|InstancedMesh/g, /\btextures?\b/gi, /toneMapping|toneMappingExposure/g, /\bbloom\b/gi,
    /RenderPass|ShaderPass|CompositePass|PostRenderer|PostPipeline|RenderSettings|CameraRig|MaterialFactory|ToonMaterial|PostTargets/,
    /OutlineRegistry|UnitVisualView|InstancedSpriteBuffer|createUnitViews|\.view\b/gi,
    /\brender\(/g,
  ],
  fx: [
    /\bparticle/gi, /\bglow\b/g, /\bdecal/gi, /\btrail/gi, /\bvfx\b/gi, /\bspark/gi,
    /VfxSystem|ParticleSystem|DecalLayer|DecalPen|TrailBuilder|IconBatch|InstanceBatch|ParticleSprite|AimIndicator|AreaEffectView|UnitShadowView|UnitBuffView|TargetIndicatorView/,
    /"fx"|type: "fx"/g,
  ],
  sim: [
    /\bunits?\b/g, /\.state\./g, /\bcommand\(/g, /\bemit\(/g, /\borders?\b/g, /\bcombat\b/gi,
    /Simulation|HeroAgent|TeamAi|TeamContext|MatchFlow|NavGrid|UnitCommander|spawnUnit|updateUnit|updateCombat|resolveUnit|tickBuff|estimate|canKill|chooseCastable|runHero/,
    /\balive\b/g, /\brespawn/gi,
  ],
  audio: [
    /AudioContext|createOscillator|createGain|createBiquadFilter|createConvolver|createPeriodicWave/g,
    /\bosc\(|\bnoise\(|\bfm\(|\bring\(|\bramp\(/g,
    /AudioMixer|SfxEngine|SynthVoice|SoundVoice|SpeechAnnouncer|MusicDirector|MusicTrack/,
    /\bgain\b|\bpan\b|\bdecay\b|\breverb/gi,
  ],
  ships: [
    /ModelBuilder|MeshBuilder|buildSkeleton|SkeletonSolver|Animator|NodeTree/g,
    /\.bone\(|\.paint\(|\.limb\(|hull/gi,
    /顶点|骨骼|骨架|模型/g,
  ],
  world: [
    /\bnav\b|\bterrain\b|\bmap\b/gi, /\bbush/gi, /\bspawn/gi, /\bcamp/gi, /\blane\b/gi,
    /MapGeometry|buildClassicMap|navR|nearestWalkable/,
  ],
}

/** 名字先验：命中即加分 */
const NAME_HINTS = [
  [/\b(Hud|HUD|Panel|Banner|Toast|Minimap|Scoreboard|SkillBar|KillFeed|Coach|Tips|Menu|Dialog|Overlay|Tooltip|Shop)\w*/, 'ui', 6],
  [/(Renderer|Render|Camera|Material|Shader|Texture|Bloom|PostFx|Post\w*|Light|Shadow|Geometry|Mesh|Sprite|Fog|Sky)/, 'render', 4],
  [/(Vfx|Particle|Decal|Trail|Glow|Spark|Effect|Emitter)/, 'fx', 6],
  [/(Simulation|Hero|Unit|Combat|Ai|AI|Team|Match|Order|Command|Spawn|Respawn|Buff|Damage|Skill|Ability|Attack|Move|Path|Wave|Tower|Core|Jungle|Monster|Minion|Economy|Gold|Xp)/, 'sim', 4],
  [/(Audio|Sfx|SFX|Sound|Voice|Music|Synth|Mixer|Announcer|Reverb)/, 'audio', 6],
  [/(Model|Mesh|Skeleton|Rig|Animator|Limb|Hull|Bone)/, 'ships', 5],
  [/(View|Outline|Instanced|Batch|Render|Draw)/, 'render', 3],
  [/(Map|Terrain|Nav|Bush|Camp|Lane|World|Arena|Prop)/, 'world', 4],
]

/** 收集顶层声明 */
const decls = []
for (const node of ast.body) {
  if (node.type === 'ImportDeclaration') continue
  let names = []
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id) names = [node.id.name]
  else if (node.type === 'VariableDeclaration') {
    for (const d of node.declarations) {
      const walkPat = (id) => {
        if (!id) return
        if (id.type === 'Identifier') names.push(id.name)
        else if (id.type === 'ArrayPattern') id.elements.forEach(walkPat)
        else if (id.type === 'ObjectPattern') id.properties.forEach((p) => walkPat(p.value || p.argument))
        else if (id.type === 'AssignmentPattern') walkPat(id.left)
        else if (id.type === 'RestElement') walkPat(id.argument)
      }
      walkPat(d.id)
    }
  }
  if (!names.length) continue
  decls.push({ names, node, line: node.loc.start.line, end: node.loc.end.line, lines: node.loc.end.line - node.loc.start.line + 1 })
}

/** 打分 */
const scored = decls.map((d) => {
  const text = src.slice(d.node.start, d.node.end)
  const scores = { ui: 0, render: 0, fx: 0, sim: 0, audio: 0, world: 0, core: 1 }
  const hits = {}

  for (const [layer, pats] of Object.entries(FEATURES)) {
    for (const re of pats) {
      re.lastIndex = 0
      const m = text.match(re)
      if (m) {
        const w = Math.min(3, m.length) // 每次命中 1 分，单一特征最多 3 分
        scores[layer] = (scores[layer] || 0) + w
        ;(hits[layer] = hits[layer] || []).push(`${re.source.slice(0, 24)}×${m.length}`)
      }
    }
  }
  const name = d.names[0]
  for (const [re, layer, w] of NAME_HINTS) {
    if (re.test(name)) {
      scores[layer] = (scores[layer] || 0) + w
      ;(hits[layer] = hits[layer] || []).push(`name:${re.source.slice(1, 20)}`)
    }
  }

  const MIN_SCORE = 3 // 低于此分归 core（视为未定），避免单个弱特征把代码判到别的层
  let best = 'core', bestScore = scores.core
  for (const [layer, sc] of Object.entries(scores)) {
    if (layer === 'core') continue
    if (sc >= MIN_SCORE && sc > bestScore) {
      best = layer
      bestScore = sc
    }
  }
  return { ...d, layer: best, score: bestScore, scores, hits }
})

// 统计
const byLayer = {}
for (const s of scored) {
  const L = (byLayer[s.layer] = byLayer[s.layer] || { count: 0, lines: 0, items: [] })
  L.count++
  L.lines += s.lines
  L.items.push(s)
}
for (const v of Object.values(byLayer)) v.items.sort((a, b) => b.lines - a.lines)

// JSON
fs.writeFileSync(OUT_JSON, JSON.stringify(scored.map((s) => ({
  names: s.names, line: s.line, lines: s.lines, layer: s.layer, score: s.score,
})), null, 1))

// Markdown
const order = ['core', 'sim', 'ships', 'render', 'fx', 'ui', 'audio', 'world']
const totalLines = scored.reduce((a, s) => a + s.lines, 0)
const mdParts = []
mdParts.push('# 内核分层映射（自动生成，勿手改）', '')
mdParts.push(`> 生成工具：\`tools/plan-layers.cjs\`；数据源 \`src/kernel/starfall.core.js\`（${scored.length} 个顶层声明 / ${totalLines} 行）`)
mdParts.push('> 分层参照 `games/starfall-e01/src/`：core / sim / ships / render / fx / ui / world')
mdParts.push('> 判定方式：代码特征（DOM 调用、THREE 渲染对象、音频调用等）+ 名字先验，取最高分；详见工具内 FEATURES / NAME_HINTS', '')
mdParts.push('> ⚠️ **本表是自动分类初稿**，不是最终结论。搬运每一块之前仍须人工核对，重点看三类：')
mdParts.push('> ① `core` 层里「零特征」的大项（可能是数据表，也可能是我漏了特征词）；')
mdParts.push('> ② `sim` 与 `world` 的边界（NavGrid / TeamAi 这类两边都沾）；')
mdParts.push('> ③ `ships` 与 `fx` 的边界（模型构建器里常含特效调用）。', '')
mdParts.push('## 分批搬运计划（按耦合从低到高）', '')
mdParts.push('| 批次 | 目标层 | 行数 | 理由 | 状态 |')
mdParts.push('|---|---|---|---|---|')
mdParts.push('| 1 | `audio/` `ui/` 已有模块归位 | — | 只动路径不改内容，先建立分层骨架 | ✅ 已完成（sfx-synth / synth-voice / hud-styles / svg-icons） |')
mdParts.push('| 2 | `audio` 剩余（AudioMixer / SfxEngine / SpeechAnnouncer / MusicDirector） | 2,841 | 与渲染解耦，接口已语义化 | 待办 |')
mdParts.push('| 3 | `world`（NavGrid / 地图 / 地形 / 野区） | 3,423 | 依赖单一（sim 只读它） | 待办 |')
mdParts.push('| 4 | `fx`（VfxSystem / Particle / Decal / Trail） | 8,059 | 量大但内聚 | 待办 |')
mdParts.push('| 5 | `ui` 剩余（HUD / 面板 / 输入） | 6,697 | 依赖 DOM，可独立验证 | 待办 |')
mdParts.push('| 6 | `render`（渲染管线 / 材质 / 相机） | 2,270 | 与 three 强耦合 | 待办 |')
mdParts.push('| 7 | `ships`（模型构建 / 骨骼 / 动画） | 1,714 | 依赖 ModelBuilder 体系 | 待办 |')
mdParts.push('| 8 | `sim`（模拟 / 战斗 / AI） | 3,531 | 耦合最紧，最后动 | 待办 |')
mdParts.push('| — | `core` 剩余 | 14,651 | 常量/数据表/工具，多数留在内核底层 | — |', '')
mdParts.push('**每批固定流程**：`find-usages` 量影响面 → 逐块搬 → 改 import（含模块内部反向引用）→')
mdParts.push('`check-import-surface` → `tsc` → `build` → `engine-smoke` → 涉及渲染时浏览器点检 → 提交。', '')
mdParts.push('## 总览', '')
mdParts.push('| 层 | 声明数 | 行数 | 占比 |')
mdParts.push('|---|---|---|')
let md = mdParts.join('\n') + '\n'

for (const k of order) {
  const v = byLayer[k]
  if (!v) continue
  md += `| \`${k}\` | ${v.count} | ${v.lines} | ${((v.lines * 100) / totalLines).toFixed(1)}% |\n`
}
md += `\n## 各层明细（按行数降序）\n`

for (const k of order) {
  const v = byLayer[k]
  if (!v) continue
  md += `\n### \`${k}\` — ${v.count} 个声明 / ${v.lines} 行\n\n`
  md += `| 名称 | 行范围 | 行数 | 得分 | 主要特征 |\n|---|---|---|---|---|\n`
  const top = process.argv.includes('--top') ? Number(process.argv[process.argv.indexOf('--top') + 1]) || 20 : 40
  for (const it of v.items.slice(0, top)) {
    const feature = Object.entries(it.hits).sort((a, b) => b[1].length - a[1].length)[0]
    md += `| \`${it.names[0]}\` | ${it.line}-${it.end} | ${it.lines} | ${it.score} | ${feature ? feature[0] + ': ' + feature[1].slice(0, 2).join(', ') : '—'} |\n`
  }
  if (v.items.length > top) md += `| … 其余 ${v.items.length - top} 个略 | | | | |\n`
}

fs.writeFileSync(path.resolve(__dirname, OUT_MD), md)

// 控制台摘要
console.log(`顶层声明 ${scored.length} 个 / ${totalLines} 行\n`)
console.log('层      声明数    行数    占比')
for (const k of order) {
  const v = byLayer[k]
  if (!v) continue
  console.log(`${k.padEnd(8)}${String(v.count).padStart(5)}${String(v.lines).padStart(9)}   ${((v.lines * 100) / totalLines).toFixed(1)}%`)
}
console.log(`\n已写入 ${OUT_MD}`)
console.log(`已写入 ${OUT_JSON}`)
