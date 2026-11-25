/**
 * 英雄数据契约（HeroSpec）
 * 由内核模拟层直接消费：数值、文本、出装、配色、外观提示全部来自这里。
 * 字段来源：从官方 bundle 的 Se 表反推，5 个英雄 100% 覆盖。
 */

export type HeroId = string
export type AttackType = 'melee' | 'ranged'
export type Role = 'tank' | 'fighter' | 'mage' | 'marksman' | 'assassin' | 'support'
export type Lane = 'top' | 'mid' | 'bot' | 'jungle' | 'support'

/** 普通数值或按技能等级递增的数组 */
export type Num = number | number[]
/** 技能描述里 {xxx} 占位符的取值；% 结尾的键表示按百分比展示 */
export type SkillValues = Record<string, Num>

export interface BaseStats {
  hp: number
  mana: number
  ad: number
  armor: number
  mr: number
  attackSpeed: number
  moveSpeed: number
  attackRange: number
  hpRegen: number
  manaRegen: number
}

export interface GrowthStats {
  hp: number
  mana: number
  ad: number
  armor: number
  mr: number
  attackSpeedPct: number
}

/** 施法形态：方向型 / 自身型 / 指定点 / 扇形 / 指定目标 */
export type CastSpec =
  | { type: 'direction'; range: number; width: number }
  | { type: 'self'; radius: number }
  | { type: 'position'; range: number; radius: number }
  | { type: 'cone'; range: number; angle: number }
  | { type: 'target'; range: number }

export type SkillTag = 'slow' | 'dash' | 'control' | 'shield' | 'heal' | 'burst' | 'buff' | 'dot'

export interface SkillSpec {
  slot: 's1' | 's2' | 'ult'
  name: string
  brief: string
  tags: SkillTag[]
  /** 支持 {damage}、{adRatio%} 等占位符，由 UI 层按 skill.values 渲染 */
  desc: string
  maxLevel: number
  cooldown: number[]
  manaCost: number[]
  cast: CastSpec
  values: SkillValues
  castTime: number
}

export interface PassiveSpec {
  name: string
  brief: string
  tags: SkillTag[]
  desc: string
  values: SkillValues
}

export interface Palette {
  primary: string
  secondary: string
  accent: string
  glow: string
}

export interface HeroSpec {
  id: HeroId
  name: string
  title: string
  role: Role
  roleName: string
  lane: Lane
  difficulty: number
  lore: string
  tips: string
  attackType: AttackType
  radius: number
  base: BaseStats
  growth: GrowthStats
  basicAttack: {
    windup: number
    damageType: 'physical' | 'magic'
    /** 远程英雄的弹道外观 id（近战无此字段） */
    projectile?: string
    projectileSpeed?: number
  }
  passive: PassiveSpec
  skills: { s1: SkillSpec; s2: SkillSpec; ult: SkillSpec }
  /** 推荐出装，item id 必须在 ln 物品表里存在 */
  build: string[]
  palette: Palette
  /** 供外观生成器使用的文字描述（AI 建模时读这段来拼几何） */
  look: string
}
