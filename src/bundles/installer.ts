/**
 * Bundle Installer —— 把声明式 HeroBundle 翻译成对内核注册表的写入。
 *
 * 这是重构的"心脏"：旧工程里 install.ts 把项羽的视觉表硬编码进内核
 * (__registerXiangyuTables)，音效/规格/模型散落在 install.ts。
 * 现在所有安装路径统一在这里，且全部走数据驱动，新增英雄零改内核。
 *
 * 安装顺序有依赖：bind -> data -> model -> visual -> combat -> audio，
 * 因为 audio 的普攻事件映射要等模型/数据就位后再写才不会被覆盖。
 */

import type { Kernel } from '../extensions/api'
import type { HeroBundle } from './types'
import {
  aliasHeroModel, aliasHeroVisual, aliasHeroSfx, aliasHeroIcons,
  registerActionSpec,
} from '../extensions/api'

/** 发射一次安装，返回每层是否成功，便于自检 */
export interface InstallReport {
  id: string
  data: boolean
  model: 'built' | 'aliased' | 'registered' | 'missing'
  visual: boolean
  combat: boolean
  audio: boolean
  notes: string[]
}

/**
 * 装载英雄。
 *
 * @param kernel - 输入
 * @param heroBundle - 要安装的英雄 bundle 数据
 */
export function installHeroBundle(kernel: Kernel, heroBundle: HeroBundle): InstallReport {
  const notes: string[] = []
  const report: InstallReport = {
    id: heroBundle.id, data: false, model: 'missing', visual: false, combat: false, audio: false, notes,
  }
  const kernelApi = kernel as any

  // ---- 1. 数据层：注入英雄表 + 英雄顺序 ----
  // 内核启动时 kr = Object.keys(HERO_DATA)；这里 HERO_DATA 已由 heroes/index.ts
  // 静态导入，所以只要 bundle 的 data 已在 index 注册即可。校验存在性：
  if (kernelApi.HeroTable[heroBundle.id]) {
    report.data = true
  } else {
    notes.push('HeroTable 未找到该 id，请确认已加入 src/heroes/index.ts')
  }

  // ---- 2. 模型层：独占 builder 已在内核 Gx；或走别名复用 ----
  const modelKey = `hero:${heroBundle.id}`
  if (heroBundle.model.key && kernelApi.ModelRegistry[modelKey]) {
    report.model = 'built' // 内核 builder 已注册（如 SX/XY），无需动作
  } else if (heroBundle.model.aliasFrom) {
    aliasHeroModel(heroBundle.id, heroBundle.model.aliasFrom)
    report.model = 'aliased'
    notes.push(`模型复用 ${heroBundle.model.aliasFrom}`)
  } else if (heroBundle.model.key && kernelApi.registerModel) {
    kernelApi.registerModel(modelKey, heroBundle.model.key)
    report.model = 'registered'
  } else {
    notes.push('模型缺失：既无内核 builder 也无 aliasFrom')
  }

  // ---- 3. 视觉层：一张表一次注入，替代旧的 __registerXiangyuTables 硬编码 ----
  if (heroBundle.visual) {
    kernelApi.registerHeroTables(heroBundle.id, {
      palette: heroBundle.visual.palette,
      portrait: heroBundle.visual.portrait,
      scale: heroBundle.visual.scale,
      cast: heroBundle.visual.cast,
      hit: heroBundle.visual.hit,
      ability: heroBundle.visual.ability,
      tactics: heroBundle.visual.tactics,
      skillMap: heroBundle.visual.skillMap,
      speed: heroBundle.visual.speed,
      skillOrder: heroBundle.visual.skillOrder,
      icons: heroBundle.visual.icons,
      iconBg: heroBundle.visual.iconBg,
    })
    report.visual = true
  } else if (heroBundle.model.aliasFrom) {
    aliasHeroVisual(heroBundle.id, heroBundle.model.aliasFrom)
    aliasHeroIcons(heroBundle.id, heroBundle.model.aliasFrom)
    report.visual = true
    notes.push('视觉层走别名回退（宿主 ' + heroBundle.model.aliasFrom + '）')
  }

  // ---- 4. 战斗规格层：显式规格 or 内核兜底 ----
  if (heroBundle.combat) {
    const combatResult = heroBundle.combat(kernel)
    // combat() 内部已经通过 kernel.buildActionSpec 构造好各槽，直接注册到 Oa 数值表
    registerActionSpec(heroBundle.id, combatResult as any)
    // 关键：Oa 只是数值表，真正执行位移/伤害/控制的是 tm 表的 Oi handler。
    // 内置 5 英雄在内核里硬编码了 handler；新英雄必须调用本钩子按 Oa 生成等价 handler，
    // 否则 Wk() 落到默认空 cast —— 扣蓝进 CD 但技能不生效（项羽一技能曾经的 bug）。
    kernelApi.installActionHandlers(heroBundle.id)
    report.combat = true
  } else {
    notes.push('未写战斗规格，内核 __defaultActionSpec 自动兜底')
  }

  // ---- 5. 音效层：程序化定义 + 普攻事件映射 ----
  if (heroBundle.audio) {
    for (const sound of heroBundle.audio.sounds ?? []) {
      const defineSoundResult = kernelApi.defineSound(sound.group, sound.label, sound.build, sound.mix ?? {})
      // registerSoundDef 一次写入 FS（定义表）+ r1（运行时查找表），
      // 不要再用 registerSound（只写 FS）重复注册。
      kernelApi.registerSoundDef(sound.name, defineSoundResult)
    }
    if (heroBundle.audio.swingEvent) kernelApi.AttackSwingSfx[heroBundle.id] = heroBundle.audio.swingEvent
    if (heroBundle.audio.hitEvent) kernelApi.AttackHitSfx[heroBundle.id] = heroBundle.audio.hitEvent
    report.audio = true
  } else if (heroBundle.model.aliasFrom) {
    aliasHeroSfx(heroBundle.id, heroBundle.model.aliasFrom)
    report.audio = true
    notes.push('音效走别名回退（宿主 ' + heroBundle.model.aliasFrom + '）')
  }

  return report
}

/** 批量安装所有 bundle，跳过 demo */
export function installAllBundles(kernel: Kernel, bundles: HeroBundle[]): InstallReport[] {
  return bundles.filter((candidateBundle) => !candidateBundle.demo).map((bundleToInstall) => installHeroBundle(kernel, bundleToInstall))
}
