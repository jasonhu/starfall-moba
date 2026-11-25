/**
 * 扩展 API —— 所有"往核心里加东西"的操作都从这里进。
 * 设计原则：不改 kernel 内部实现，只往它的注册表里写条目。
 */

export type ModelKey = string
/** 模型/角色构建函数：返回 { geometry, rig, clips, ... }，由内核 qc() 缓存 */
export type ModelBuilder = () => unknown

export interface Kernel {
  ModelRegistry: Record<string, ModelBuilder>
  HeroTable: Record<string, unknown>
  HeroActionSpecs: Record<string, unknown>
  VfxTemplates: Record<string, unknown>
  VfxEventHandlers: Record<string, unknown>
  SoundBank: Record<string, unknown>
  HeroIcons: Record<string, unknown>
  ItemTable: Record<string, unknown>
  defineSound: (...args: unknown[]) => unknown
  AttackSwingSfx: Record<string, string>
  AttackHitSfx: Record<string, string>
  VfxPalette: Record<string, any>
  HeroModelScale: Record<string, number>
  PortraitCrop: Record<string, any>
  registerSoundDef: (name: string, def: unknown) => unknown
  registerSoundRuntime: (name: string, def: unknown) => unknown
  heroRadarSvg: (id: string) => string
  heroRow: (table: Record<string, any>, id: string) => any
  SoundBankSkillGroup: Record<string, any>
  buildActionSpec: (heroId: string, slot: string, fields: Record<string, unknown>) => unknown
  makeDamage: (type: string, extra?: Record<string, unknown>) => unknown
  makeDash: (heroId: string, slot: string, stopsAtHero?: boolean) => { duration: number } & Record<string, unknown>
  skillValue: (heroId: string, slot: string, key: string) => number
  skillRange: (heroId: string, slot: string) => number
  buildModel: (key: ModelKey) => unknown
  listModelKeys: () => string[]
  /** 通用视觉表注入（重构新增）：一次写入所有按英雄 id 索引的表 */
  registerHeroTables: (id: string, parts: Record<string, unknown>) => void
  /** 数据驱动施法 handler（重构新增）：按 Oa 规格生成真实施法执行函数，新英雄必须调用 */
  installActionHandlers: (id: string) => void
  /** 可选：注册一个模型 builder（旧内核无此钩子，别名路径不需要） */
  registerModel?: (key: ModelKey, builder: unknown) => void
}

let K: Kernel | null = null

/** main.ts 在 import kernel 后立即调用一次 */
export function bindKernel(kernel: Kernel) {
  K = kernel
}

function requireKernel(): Kernel {
  if (!K) throw new Error('[starfall] kernel 尚未绑定：请先 await import(kernel) 再调用扩展 API')
  return K
}

/** 直接复用某个已有英雄的模型/骨架/动作 —— 新英雄最快跑通的方式 */
export function aliasHeroModel(newId: string, baseId: string) {
  const requireKernelResult = requireKernel()
  const textValue = `hero:${baseId}`
  const builder = requireKernelResult.ModelRegistry[textValue]
  if (!builder) throw new Error(`[starfall] 没有可复用的模型：${textValue}`)
  requireKernelResult.ModelRegistry[`hero:${newId}`] = builder
}

/**
 * 一次性把新英雄"寄宿"到一个已有英雄上：
 * 模型/骨架/动作、特效配色、立绘取景框、模型缩放。
 * 只换数据、不写外观时，这四个都必须对齐，否则选人/对局渲染会读到 undefined。
 */
export function aliasHeroVisual(newId: string, baseId: string) {
  const kernel = requireKernel()
  // 记录宿主关系：内核里所有"按英雄 id 查表"的地方（雷达/动画/镜头/AI 性格…）
  // 都会通过 heroRow() 回退到宿主，避免新英雄读到 undefined
  const globalScope = globalThis as any
  ;(globalScope.__STARFALL_HERO_BASE__ ||= {})[newId] = baseId
  const model = kernel.ModelRegistry[`hero:${baseId}`]
  if (!model) throw new Error(`[starfall] 没有可复用的模型：hero:${baseId}`)
  kernel.ModelRegistry[`hero:${newId}`] = model
  if (kernel.VfxPalette[baseId]) kernel.VfxPalette[newId] = kernel.VfxPalette[baseId]
  if (kernel.PortraitCrop[baseId]) kernel.PortraitCrop[newId] = kernel.PortraitCrop[baseId]
  kernel.HeroModelScale[newId] = kernel.HeroModelScale[baseId] ?? 1
}

/**
 * 音效别名：把 <baseId> 的普攻/技能/特效事件全部复制一份给新英雄。
 * 内核的音效查找表 r1 在启动时一次性合并，所以这里必须走 registerSoundDef 同时写 FS 和 r1，
 * 否则对局中 cast_<id>_s1 这类事件会抛 "Cannot read properties of undefined"。
 */
export function aliasHeroSfx(newId: string, baseId: string) {
  const kernel = requireKernel()
  kernel.AttackSwingSfx[newId] = kernel.AttackSwingSfx[baseId]
  kernel.AttackHitSfx[newId] = kernel.AttackHitSfx[baseId]
  // 音效分散在三张表：FS（战斗事件）、GS（技能施法）、其余 UI 组，都已并入运行时查找表 r1。
  const renamed = (sourceSoundKey: string) => sourceSoundKey.split(baseId).join(newId)
  let copied = 0
  for (const table of [kernel.SoundBank, kernel.SoundBankSkillGroup]) {
    for (const [soundEventKey, soundDefinition] of Object.entries(table)) {
      if (!soundEventKey.includes(baseId)) continue
      const target = renamed(soundEventKey)
      if (target === soundEventKey) continue
      kernel.registerSoundRuntime(target, soundDefinition)
      copied++
    }
  }
  return copied
}

/** 复用某个英雄的技能图标（不写图标 SVG 时的兜底） */
export function aliasHeroIcons(newId: string, baseId: string) {
  const kernel = requireKernel()
  const icons = kernel.HeroIcons[baseId]
  if (!icons) throw new Error(`[starfall] 没有可复用的图标：${baseId}`)
  kernel.HeroIcons[newId] = icons
}

/** 注册技能玩法规格（damage / cc / mobility / selfBuffs） */
export function registerActionSpec(heroId: string, registrationValue: Record<'s1' | 's2' | 'ult', unknown>) {
  const kernel = requireKernel()
  kernel.HeroActionSpecs[heroId] = registrationValue
}

/** 注册战斗特效模板，key 与 VfxEventHandlers 对应 */
export function registerVfx(registrationKey: string, template: unknown) {
  const kernel = requireKernel()
  kernel.VfxTemplates[registrationKey] = template
}

/** 注册特效事件处理函数（内核在播放 fx_xxx 事件时回调） */
export function registerVfxHandler(vfxEventKey: string, handler: unknown) {
  const kernel = requireKernel()
  kernel.VfxEventHandlers[vfxEventKey] = handler
}

/** 注册音效：definition 用 kernel.defineSound 构造，保证和内置音效同一套 DSL */
export function registerSound(soundKey: string, definition: unknown) {
  const kernel = requireKernel()
  kernel.SoundBank[soundKey] = definition
}

/** 技能规格构造器集合 —— 手写新英雄 Oa 条目时用 */
export function actionSpecKit() {
  const kernel = requireKernel()
  return {
    build: kernel.buildActionSpec,
    damage: kernel.makeDamage,
    dash: kernel.makeDash,
    val: kernel.skillValue,
    range: kernel.skillRange,
  }
}

/** 深拷贝某个英雄的技能规格：数值会沿用被克隆英雄，先跑通再逐条改写 */
export function cloneActionSpec(fromId: string, targetHeroId: string) {
  const kernel = requireKernel()
  const selectedHeroActionSpecs = kernel.HeroActionSpecs[fromId]
  if (!selectedHeroActionSpecs) throw new Error(`[starfall] 没有可克隆的技能规格：${fromId}`)
  kernel.HeroActionSpecs[targetHeroId] = JSON.parse(JSON.stringify(selectedHeroActionSpecs))
  return kernel.HeroActionSpecs[targetHeroId]
}

/** 追加场景元素：fn 在内核建完地形后调用，拿到 {scene, map, terrain, kit} */
export function registerSceneExtra(sceneExtraInitializer: (sceneContext: {
  scene: any; map: any; terrain: any; kit: { Mesh: any; Geometry: any; Material: any; Vector3: any; Group: any }
}) => void) {
  const globalScope = globalThis as any
  ;(globalScope.__STARFALL_SCENE_EXTRAS__ ||= []).push(sceneExtraInitializer)
}

/** 整体替换地图：必须在 import kernel 之前调用（world 构建时只读一次） */
export function setMapFactory(factory: () => unknown) {
  ;(globalThis as any).__STARFALL_MAP__ = factory
}

/**
 * 处理模型。
 *
 */
export function listRegisteredModels(): string[] {
  return requireKernel().listModelKeys()
}
