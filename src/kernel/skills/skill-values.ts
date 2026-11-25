/**
 * 英雄技能数值与文案工具（取值 / 槽位计数 / 描述渲染 / 等级成长）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 * TS 类型化：参数/返回值接入 HeroSpec / SkillSpec / UnitStats 业务契约，逻辑逐字节不变。
 */

import type { HeroSpec, SkillSpec } from '../../heroes/types'
import type { UnitStats } from '../sim/types'
import { HERO_TABLE } from '../../heroes/registry'

/** 英雄名称与定位的可读标签，如「盘月 · 法师」 */
function z0(heroId: string | HeroSpec): string {
  const heroSpec = typeof heroId == 'string' ? HERO_TABLE[heroId] : heroId
  return `${heroSpec.name} · ${heroSpec.roleName}`
}

const SKILL_EFFECT_KINDS: Record<string, string> = { dash: '位移', control: '控制', slow: '减速', burst: '爆发', dot: '持续伤害', shield: '护盾', heal: '回复', buff: '增益' },
  /** 技能点分配的最大判定等级 */
  eh = 15

/** 按英雄等级分配 s1/s2/ult 的技能点（每 4 级一个 ult 点，其余交替） */
function lm(level: number): { s1: number; s2: number; ult: number } {
  let s1Points = 0,
    s2Points = 0,
    ultPoints = 0,
    parity = 0
  for (let index = 1; index <= Math.min(level, eh); index++) index === 4 || index === 8 || index === 12 ? ultPoints++ : (parity++ % 2 === 0 && s1Points < 6) || s2Points >= 6 ? s1Points++ : s2Points++
  return { s1: s1Points, s2: s2Points, ult: ultPoints }
}

/** 取技能在指定等级下的数值（支持单值或按等级数组） */
function Nh(skill: SkillSpec, valueKey: string, level: number): number {
  const value = skill.values[valueKey]
  if (value === void 0) throw new Error(`skill ${skill.name} has no value "${valueKey}"`)
  if (typeof value == 'number') return value
  const levelIndex = Math.max(0, Math.min(value.length - 1, level - 1))
  return value[levelIndex]
}

/** 格式化技能数值：按百分比或普通小数展示 */
function Cy(value: number, asPercent: boolean): string {
  return asPercent ? `${Math.round(value * 100)}%` : Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

/** 渲染技能描述：把 {xxx}/{xxx%} 占位符替换为对应数值 */
function US(skill: SkillSpec, _unused?: unknown): string {
  return skill.desc.replace(/\{(\w+)(%?)\}/g, (match, placeholderKey, suffix) => {
    const value = skill.values[placeholderKey],
      usePercent = suffix === '%'
    return value === void 0 ? `{${placeholderKey}}` : typeof value == 'number' ? Cy(value, usePercent) : value.map((levelValue) => Cy(levelValue, usePercent)).join('/')
  })
}

/** 召唤师技能定义（回城/疗伤/闪现） */
const ea = {
  recall: { name: '回城', brief: '原地站 5 秒，回泉水补满', desc: '原地站 5 秒后传送回泉水。移动、攻击或受到伤害会打断。', channel: 5, cooldown: 1 },
  heal: { name: '疗伤', brief: '5 秒内回三成血和蓝', desc: '5 秒内持续回复共 30% 最大生命与 30% 最大法力。受到英雄或防御塔伤害会打断。', duration: 5, hpRatio: 0.3, manaRatio: 0.3, cooldown: 60 },
  flash: { name: '闪现', brief: '朝一个方向瞬移一小段', desc: '向指定方向瞬移一小段距离，可穿越薄墙。', range: 5, cooldown: 110 },
}

/** 按英雄与等级计算派生战斗属性（接入 UnitStats 契约） */
function f5(heroDefinition: HeroSpec, level: number): UnitStats {
  const growthSteps = Math.max(0, Math.min(eh, level) - 1)
  return {
    maxHp: heroDefinition.base.hp + heroDefinition.growth.hp * growthSteps,
    maxMana: heroDefinition.base.mana + heroDefinition.growth.mana * growthSteps,
    ad: heroDefinition.base.ad + heroDefinition.growth.ad * growthSteps,
    ap: 0,
    armor: heroDefinition.base.armor + heroDefinition.growth.armor * growthSteps,
    mr: heroDefinition.base.mr + heroDefinition.growth.mr * growthSteps,
    attackSpeed: heroDefinition.base.attackSpeed * (1 + heroDefinition.growth.attackSpeedPct * growthSteps),
    moveSpeed: heroDefinition.base.moveSpeed,
    attackRange: heroDefinition.base.attackRange,
    hpRegen: heroDefinition.base.hpRegen + 0.6 * growthSteps,
    manaRegen: heroDefinition.base.manaRegen + 0.2 * growthSteps,
    cdr: 0,
    lifesteal: 0,
    critChance: 0,
    critDamage: 2,
    armorPen: 0,
    magicPen: 0,
  }
}

export { Nh, SKILL_EFFECT_KINDS, US, ea, eh, f5, lm, z0 }
