#!/usr/bin/env node
/**
 * 引擎逻辑冒烟测试（不含渲染 / 不启动浏览器 / 不烧 GPU）
 * ---------------------------------------------------------------
 * 把内核 bundle 成 CJS，在 Node 里 stub DOM/WebAudio/动画帧等浏览器
 * 全局对象，导入内核导出的注册表与纯逻辑函数，验证游戏逻辑数据完好。
 *
 * 用途：每次语义化重命名 / 切片后，快速确认「引擎逻辑没坏」。
 * 渲染层（WebGLRenderer/render/DOM 绘制）不参与，故不会触碰 GPU。
 */
const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')

const OUT = path.resolve('tools/.engine-bundle.cjs')

// ---- 1. 打包内核为 CJS（Node 可加载）----
esbuild.buildSync({
  entryPoints: [require('fs').existsSync('src/kernel/starfall.core.ts') ? 'src/kernel/starfall.core.ts' : 'src/kernel/starfall.core.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: OUT,
  logLevel: 'silent',
  target: 'es2022',
})

// ---- 2. stub 浏览器全局（内核顶层有 typeof 保护，这里更保险）----
// stub 由共用模块提供（check-vfx-templates.cjs 也用它）
require('./lib-dom-stub.cjs').installDomStub()

// ---- 3. 导入内核导出 ----
let K
const warnings = []
const origWarn = console.warn
console.warn = (...a) => {
  warnings.push(a.map(String).join(' '))
  origWarn(...a)
}
try {
  K = require(OUT)
} catch (e) {
  console.error('❌ 内核加载失败:', e.stack || e.message)
  process.exit(1)
} finally {
  console.warn = origWarn
}

const checks = []
const ck = (name, cond, detail = '') => checks.push({ name, ok: !!cond, detail })

// ---- Three.js 集成断言（替换内联库后新增）----
ck('Three.js 版本为 r180', (global.window && global.window.__THREE__) === '180', `window.__THREE__=${global.window && global.window.__THREE__}`)
ck(
  'Three.js 单实例（未出现多重导入告警）',
  !warnings.some((w) => w.includes('Multiple instances of Three.js')),
  '无告警'
)
ck(
  '自定义色调映射补丁已生效',
  !warnings.some((w) => w.includes('未找到 CustomToneMapping')),
  warnings.find((w) => w.includes('CustomToneMapping')) || '无告警'
)

// 英雄表
const heroes = K.HeroTable || {}
ck('英雄表非空', Object.keys(heroes).length >= 5, `${Object.keys(heroes).length} 个: ${Object.keys(heroes).join(',')}`)
// 玩法规格
const specs = K.HeroActionSpecs || {}
ck('玩法规格表非空', Object.keys(specs).length >= 5, `${Object.keys(specs).length} 个英雄`)
for (const h of Object.keys(heroes)) {
  const s = specs[h]
  ck(`规格 ${h} 三槽齐全`, s && s.s1 && s.s2 && s.ult, s ? Object.keys(s).join(',') : '无')
}
// 数值取值 / 射程（纯逻辑函数，最易被重命名误伤）
if (typeof K.skillValue === 'function') {
  const first = Object.keys(heroes)[0]
  let v
  try { v = K.skillValue(first, 's1', 'damage') } catch (e) { v = 'ERR:' + e.message }
  ck('skillValue 可调用', v !== undefined && !String(v).startsWith('ERR'), `值=${JSON.stringify(v)}`)
}
if (typeof K.skillRange === 'function') {
  const first = Object.keys(heroes)[0]
  let r
  try { r = K.skillRange(first, 's1') } catch (e) { r = 'ERR:' + e.message }
  ck('skillRange 可调用', typeof r === 'number' && !Number.isNaN(r), `值=${r}`)
}
// 装备 / 地图 / 音效 / 特效注册表
ck('装备表非空', K.ItemTable && Object.keys(K.ItemTable).length >= 10, `${K.ItemTable ? Object.keys(K.ItemTable).length : 0} 件`)
ck('模型注册表非空', K.ModelRegistry && K.listModelKeys && K.listModelKeys().length >= 5,
  `${K.listModelKeys ? K.listModelKeys().length : 0} 个模型`)
ck('音效库非空', K.SoundBank && Object.keys(K.SoundBank).length >= 1, `${K.SoundBank ? Object.keys(K.SoundBank).length : 0} 条`)
ck(
  '英雄技能音效分组非空',
  K.SoundBankSkillGroup && Object.keys(K.SoundBankSkillGroup).length >= 30,
  `${K.SoundBankSkillGroup ? Object.keys(K.SoundBankSkillGroup).length : 0} 条`
)
ck(
  '音效定义 DSL 可用',
  typeof K.defineSound === 'function' && typeof K.defineSound('测试', '测试', () => {}).fn === 'function'
)
ck('特效模板非空', K.VfxTemplates && Object.keys(K.VfxTemplates).length >= 1)
ck('地图工厂可用', typeof K.buildMap === 'function')
try { const m = K.buildMap(); ck('buildMap 产出有效', !!m, m ? Object.keys(m).slice(0, 6).join(',') : '') } catch (e) { ck('buildMap 产出有效', false, e.message) }

// 技能规格构造器（返回结构，纯逻辑）
if (typeof K.makeDamage === 'function') {
  try { const d = K.makeDamage('physical', { ad: 'adRatio' }); ck('makeDamage 可用', !!d, JSON.stringify(d)) }
  catch (e) { ck('makeDamage 可用', false, e.message) }
}
if (typeof K.makeDash === 'function') {
  try { const d = K.makeDash('panyue', 's1', true); ck('makeDash 可用', !!d, JSON.stringify(d)) }
  catch (e) { ck('makeDash 可用', false, e.message) }
}

// ---- sim 战斗核心簇：施法 handler 注册表 + 纯判断函数（无渲染）----
// 单独 bundle combat-core，直接验证从内核抽出的战斗逻辑，防止重命名/搬迁误伤。
try {
  const CORE_BUNDLE = path.resolve('tools/.combat-core-bundle.cjs')
  esbuild.buildSync({
    entryPoints: [require('fs').existsSync('src/kernel/sim/combat-core.ts') ? 'src/kernel/sim/combat-core.ts' : 'src/kernel/sim/combat-core.js'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: CORE_BUNDLE,
    logLevel: 'silent',
    target: 'es2022',
  })
  const C = require(CORE_BUNDLE)

  ck('CAST_HANDLERS 施法 handler 表存在', C.CAST_HANDLERS instanceof Map, `size=${C.CAST_HANDLERS && C.CAST_HANDLERS.size}`)
  // 注册 → 读取 → 通配回退：验证注册机制的完整链路
  if (typeof C.registerCastHandler === 'function' && typeof C.getCastHandler === 'function') {
    C.registerCastHandler('__smoke', 's1', { id: 'smoke-s1' })
    const h = C.getCastHandler('__smoke', 's1')
    ck('registerCastHandler → getCastHandler 往返', h && h.id === 'smoke-s1', JSON.stringify(h))
    C.registerWildcardHandler('s9', { id: 'smoke-wild' })
    const w = C.getCastHandler('__other_hero__', 's9')
    ck('通配 handler 回退', w && w.id === 'smoke-wild', JSON.stringify(w))
  }
  if (typeof C.isSummonerSpell === 'function') {
    ck('isSummonerSpell 判定正确', C.isSummonerSpell('flash') && C.isSummonerSpell('recall') && C.isSummonerSpell('heal') && !C.isSummonerSpell('s1'))
  }
  if (typeof C.isStructure === 'function') {
    ck('isStructure 判定正确', C.isStructure({ kind: 'tower' }) && C.isStructure({ kind: 'core' }) && !C.isStructure({ kind: 'hero' }))
  }
  if (typeof C.isTargetable === 'function') {
    const alive = { alive: true, invulnerable: false, rt: {} }
    const dead = { alive: false, invulnerable: false, rt: {} }
    const invul = { alive: true, invulnerable: true, rt: {} }
    ck('isTargetable 判定正确', C.isTargetable(alive) && !C.isTargetable(dead) && !C.isTargetable(invul))
  }
  if (typeof C.canTarget === 'function') {
    const self = { team: 1 }
    const enemy = { alive: true, invulnerable: false, rt: {}, team: 2, visible: { 1: true } }
    const ally = { alive: true, invulnerable: false, rt: {}, team: 1, visible: { 1: true } }
    ck('canTarget 敌我判定正确', C.canTarget(self, enemy) && !C.canTarget(self, ally))
  }
  ck('移动模式常量自洽', C.MOVE_IDLE === 0 && C.MOVE_DIRECTION === 1)
  ck('SUMMONER_SPELL_SPECS 三槽齐全', C.SUMMONER_SPELL_SPECS && C.SUMMONER_SPELL_SPECS.recall && C.SUMMONER_SPELL_SPECS.heal && C.SUMMONER_SPELL_SPECS.flash)
} catch (e) {
  ck('sim 战斗核心簇加载/断言', false, e.message)
}

// ---- 4. 输出 ----
let pass = 0
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`)
  if (c.ok) pass++
}
console.log(`\n引擎逻辑冒烟: ${pass}/${checks.length} 通过（无浏览器 / 无 GPU / 无渲染）`)
process.exit(pass === checks.length ? 0 : 1)
