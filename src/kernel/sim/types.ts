/**
 * sim 战斗层运行时类型契约（Runtime Simulation Contracts）
 * ---------------------------------------------------------------
 * 本文件为「纯类型定义」，不产生任何运行时代码（全部 type/interface）。
 * 字段来源：从 combat-core.js 的 su/nu/Um 工厂、各 kind 单位构造点、
 * simulation.js 的 spawnProjectile、combat-behavior.js 的 buff 构造点逐字段反推，
 * 与线上运行时对象 100% 对应。
 *
 * 用途：为 sim 层模块的类型化提供统一的业务语义契约，避免各模块各自定义
 * 结构。后续类型化模块通过 `import type { ... } from './types'` 接入。
 *
 * 注意：部分函数字段（filter/onHit/onTick 等）在运行时通过 markNonEnumerable
 * 设为不可枚举，类型上以 `| null` 表示其可选回调语义。
 */

// ─────────────────────────────────────────────────────────────
// 基础几何 / 通用
// ─────────────────────────────────────────────────────────────

/** 二维世界坐标（sim 内部一律使用 x/y 平面坐标，不含 z） */
export interface Vec2 {
  x: number
  y: number
}

/** 单位阵营：0/1 为对战双方，2 为中立（野怪） */
export type TeamId = 0 | 1 | 2

/** 单位类别：英雄 / 小兵 / 防御塔 / 水晶核心 / 野怪 */
export type UnitKind = 'hero' | 'minion' | 'tower' | 'core' | 'monster'

/** 伤害类型 */
export type DamageType = 'physical' | 'magic' | 'true'

// ─────────────────────────────────────────────────────────────
// 属性与战斗状态
// ─────────────────────────────────────────────────────────────

/** 派生战斗属性（Um 工厂产出，各来源值经 equipment/passive 叠加后） */
export interface UnitStats {
  maxHp: number
  maxMana: number
  ad: number
  ap: number
  armor: number
  mr: number
  attackSpeed: number
  moveSpeed: number
  attackRange: number
  hpRegen: number
  manaRegen: number
  cdr: number
  lifesteal: number
  critChance: number
  critDamage: number
  armorPen: number
  magicPen: number
  [key: string]: number
}

/** 普攻/投射物伤害修饰参数 */
export interface AttackConfig {
  windup: number
  dtype: DamageType
  visual: string | null
  projSpeed: number
  vsStructure: number
  vsMinion: number
}

/** 位移状态（dash）：leap 跳跃插值 或 匀速直线推进 */
export interface DashState {
  mode: 'leap' | 'dash'
  t: number
  dur: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  left: number
  speed: number
  dirX: number
  dirY: number
  navR: number
  ignoreWalls: boolean
  hitRadius: number
  hitIds: number[]
  filter: ((target: RuntimeUnit) => boolean) | null
  onHit: ((target: RuntimeUnit) => boolean | void) | null
  onEnd: ((reason: string) => void) | null
}

/** 运行时动态状态（nu 工厂产出，挂在 unit.rt，markNonEnumerable） */
export interface RuntimeState {
  navR: number
  weight: number
  sight: number
  base: UnitStats
  atk: AttackConfig
  stunned: boolean
  rooted: boolean
  silenced: boolean
  untargetable: boolean
  unstoppable: boolean
  slowImmune: boolean
  airborne: number | null
  moveMode: number
  dirX: number
  dirY: number
  path: Vec2[] | null
  pathIdx: number
  goalX: number
  goalY: number
  pathTime: number
  stuck: number
  moved: boolean
  pushX: number
  pushY: number
  dash: DashState | null
  atkCd: number
  windupLeft: number
  windupTarget: number
  disarmUntil: number
  lockUntil: number
  act: unknown | null
  actStart: number
  actDur: number
  actUntil: number
  actMoveCancel: boolean
  hitHeroTime: number
  hitHeroId: number
  revealUntil: number
  lastAttackerId: number
  thinkAt: number
  backdoor: boolean
}

// ─────────────────────────────────────────────────────────────
// Buff 实例
// ─────────────────────────────────────────────────────────────

/** buff 定义（注册表条目，带给 addBuff 的参数） */
export interface BuffSpec {
  duration?: number
  maxStacks?: number
  tickInterval?: number
  onTick?: ((sim: unknown, unit: RuntimeUnit, buff: BuffInstance) => void) | null
  onExpire?: ((sim: unknown, unit: RuntimeUnit, buff: BuffInstance) => void) | null
  onRemove?: ((sim: unknown, unit: RuntimeUnit, buff: BuffInstance) => void) | null
  [key: string]: unknown
}

/** buff 运行时实例（挂在 unit.buffs） */
export interface BuffInstance {
  id: number
  sourceId: number
  timeLeft: number
  duration: number
  stacks: number
  value: number
  key: string
  maxStacks: number
  startTime: number
  tickInterval: number
  tickLeft: number
  onTick: BuffSpec['onTick']
  onExpire: BuffSpec['onExpire']
  onRemove: BuffSpec['onRemove']
}

// ─────────────────────────────────────────────────────────────
// 单位（各 kind 的公共底座 + 专用扩展）
// ─────────────────────────────────────────────────────────────

/** 所有单位共享的底座字段（su 工厂产出） */
export interface BaseUnit {
  id: number
  team: TeamId
  pos: Vec2
  prevPos: Vec2
  facing: number
  radius: number
  alive: boolean
  hp: number
  mana: number
  stats: UnitStats
  buffs: BuffInstance[]
  shield: number
  anim: string
  animStart: number
  animDur: number
  targetId: number
  visible: [boolean, boolean]
  bushId: number
  invulnerable: boolean
  lastHitTime: number
}

/** 英雄专用运行时数据（unit.h，markNonEnumerable） */
export interface HeroRuntime {
  def: unknown
  index: number
  spawn: Vec2
  baseLevel: number
  atkOrder: boolean
  atkTargetId: number
  atkExplicit: boolean
  pendingCast: unknown | null
  pendingUntil: number
  goldFrac: number
  multiKill: number
  lastKillTime: number
  deathStreak: number
  damagers: Map<number, number>
  lastCombatTime: number
  hooks: unknown[]
  cooldowns: Map<string, number>
  vars: Map<string, unknown>
  controller: unknown | null
  nextThink: number
}

/** 小兵专用运行时数据（unit.m） */
export interface MinionRuntime {
  offset: number
  dir: number
  goalX: number
  goalY: number
  helping: boolean
  offLane: boolean
}

/** 野怪专用运行时数据（unit.mon，markNonEnumerable） */
export interface MonsterRuntime {
  home: Vec2
  state: number
  camp: unknown
  specialAt: number
  breath: unknown | null
}

/** 英雄技能槽运行时（skills.s1/s2/ult/recall/heal/flash） */
export interface SkillSlot {
  level: number
  cd: number
  cdMax: number
  cost: number
}

/** 完整英雄单位 */
export interface HeroUnit extends BaseUnit {
  kind: 'hero'
  heroId: string
  name: string
  isPlayer: boolean
  lane: string
  level: number
  xp: number
  xpToNext: number
  gold: number
  goldEarned: number
  kills: number
  deaths: number
  assists: number
  cs: number
  streak: number
  skills: Record<string, SkillSlot>
  items: Array<string | null>
  respawnIn: number
  dmgDealt: number
  dmgTaken: number
  dmgTower: number
  inCombat: boolean
  autoBuy: boolean
  rt: RuntimeState
  h: HeroRuntime
}

/** 小兵单位 */
export interface MinionUnit extends BaseUnit {
  kind: 'minion'
  team: TeamId
  minionType: string
  lane: string
  rt: RuntimeState
  m: MinionRuntime
}

/** 防御塔单位 */
export interface StructureUnit extends BaseUnit {
  kind: 'tower' | 'core'
  team: TeamId
  lane?: string
  tier?: number
  rt: RuntimeState
}

/** 野怪单位 */
export interface MonsterUnit extends BaseUnit {
  kind: 'monster'
  team: TeamId
  monsterType: string
  campId: number
  rt: RuntimeState
  mon: MonsterRuntime
}

/** 任意单位联合类型 */
export type RuntimeUnit = HeroUnit | MinionUnit | StructureUnit | MonsterUnit

// ─────────────────────────────────────────────────────────────
// 投射物 / 区域
// ─────────────────────────────────────────────────────────────

/** 投射物运行时实例（spawnProjectile 产出） */
export interface Projectile {
  id: number
  visual: string
  team: TeamId
  ownerId: number
  pos: Vec2
  prevPos: Vec2
  dir: Vec2
  speed: number
  radius: number
  targetId: number
  traveled: number
  maxRange: number
  homing: boolean
  pierce: boolean
  dead: boolean
  filter: ((target: RuntimeUnit) => boolean) | null
  hitIds: number[]
  onHit: ((sim: unknown, projectile: Projectile, target: RuntimeUnit) => boolean | void) | null
  onEnd: ((sim: unknown, projectile: Projectile, reason?: string) => void) | null
  basic: boolean
  ad: number
  dtype: DamageType
  vsStructure: number
  vsMinion: number
}

/** 持续性区域（AOE）运行时实例（spawnArea 产出） */
export interface AreaEffect {
  id: number
  visual: string
  pos: Vec2
  radius: number
  duration: number
  dead: boolean
  onTick: ((sim: unknown, area: AreaEffect) => void) | null
  onEnd: ((sim: unknown, area: AreaEffect, reason?: string) => void) | null
  [key: string]: unknown
}

// ─────────────────────────────────────────────────────────────
// 事件 / 状态快照
// ─────────────────────────────────────────────────────────────

/** sim 产出的帧事件（emit 的载荷，被渲染/音效层消费） */
export interface SimEvent {
  type: string
  [key: string]: unknown
}

/** 单队聚合状态 */
export interface TeamState {
  kills: number
  towersDestroyed: number
  gold: number
  blessingLeft: number
}

/** 野怪营地状态 */
export interface CampState {
  campId: number
  alive: boolean
  respawnIn: number
}

/** 对局全局状态（sim.state） */
export interface MatchState {
  time: number
  tick: number
  config: unknown
  map: unknown
  units: RuntimeUnit[]
  heroes: HeroUnit[]
  projectiles: Projectile[]
  areas: AreaEffect[]
  teams: [TeamState, TeamState]
  camps: CampState[]
  playerId: number
  nextWaveIn: number
  wave: number
  over: boolean
  winner: TeamId | null
}
