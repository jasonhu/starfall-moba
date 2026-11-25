/**
 * 内核切片 · 装备数据表（原 starfall.core.js 第 53358-53462 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/数据与线上 100% 一致；本版在保持数据逐字节不变的前提下
 * 补充业务类型契约（ItemSpec / ItemStats / ItemPassive …），使装备结构显式可查。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */

/** 装备大类 */
export type ItemCategory = 'boots' | 'attack' | 'magic' | 'defense'
/** 装备档次（1=基础鞋 / 2=成型装） */
export type ItemTier = 1 | 2
/** 分路 key */
export type LaneKey = 'top' | 'mid' | 'bot'
/** 防御塔层级 key */
export type TowerTier = 1 | 2 | 3

/** 装备提供的属性加成（键为属性名，值为数值；并非每件装备都给全部属性） */
export type ItemStats = Partial<{
  ad: number
  ap: number
  apPct: number
  armor: number
  mr: number
  hp: number
  mana: number
  moveSpeed: number
  attackSpeedPct: number
  critChance: number
  critDamage: number
  lifesteal: number
  armorPen: number
  magicPen: number
  cdr: number
  /** 每回合计生命回复（装备提供时由 recomputeStats 累加） */
  hpRegen: number
  /** 每回合计法力回复（装备提供时由 recomputeStats 累加） */
  manaRegen: number
}>

/** 装备被动（部分装备才有） */
export interface ItemPassive {
  id: string
  name: string
  desc: string
  value: number
  value2?: number
}

/** 一件装备的完整定义 */
export interface ItemSpec {
  id: string
  name: string
  brief: string
  category: ItemCategory
  tier: ItemTier
  cost: number
  stats: ItemStats
  passive?: ItemPassive
  /** 商店卡片主色（十六进制） */
  color: string
}

/** 全部装备表（按 id 索引） */
const ItemTable: Record<string, ItemSpec> = {
    boots: { id: "boots", name: "移速草鞋", brief: "跑得更快的基础鞋", category: "boots", tier: 1, cost: 250, stats: { moveSpeed: 0.5 }, color: "#a8794f" },
    boots_guard: { id: "boots_guard", name: "护甲铁靴", brief: "跑得快，还更抗物理伤害", category: "boots", tier: 2, cost: 710, stats: { moveSpeed: 0.6, armor: 110 }, color: "#8d99a8" },
    boots_arcane: { id: "boots_arcane", name: "减冷却布靴", brief: "跑得快，技能冷却更短", category: "boots", tier: 2, cost: 710, stats: { moveSpeed: 0.6, cdr: 0.15 }, color: "#7f8cff" },
    boots_fury: { id: "boots_fury", name: "攻速皮靴", brief: "跑得快，普攻出手更快", category: "boots", tier: 2, cost: 710, stats: { moveSpeed: 0.6, attackSpeedPct: 0.25 }, color: "#56c7a0" },
    starfall_blade: {
      id: "starfall_blade",
      name: "收割斩马剑",
      brief: "物攻最高，打残血更疼",
      category: "attack",
      tier: 2,
      cost: 2100,
      stats: { ad: 110, cdr: 0.1 },
      passive: { id: "execute_bonus", name: "收割", desc: "对生命低于 50% 的敌人，伤害 +15%(对建筑无效)。", value: 0.15, value2: 0.5 },
      color: "#ffb44d",
    },
    sunchaser_bow: {
      id: "sunchaser_bow",
      name: "攻速角弓",
      brief: "攻速大涨，普攻附带法伤",
      category: "attack",
      tier: 2,
      cost: 1900,
      stats: { attackSpeedPct: 0.35, critChance: 0.15, moveSpeed: 0.25 },
      passive: { id: "onhit_magic", name: "附带法伤", desc: "普攻额外造成 45 点法术伤害(对建筑无效)。", value: 45 },
      color: "#ffd76a",
    },
    blood_scythe: { id: "blood_scythe", name: "吸血环首刀", brief: "普攻造成伤害，自己回血", category: "attack", tier: 2, cost: 1800, stats: { ad: 85, lifesteal: 0.2 }, color: "#d8433f" },
    piercing_spear: { id: "piercing_spear", name: "破甲长戟", brief: "专克高护甲：无视 35% 护甲", category: "attack", tier: 2, cost: 2e3, stats: { ad: 75, armorPen: 0.35 }, color: "#9fb4c9" },
    phantom_edge: {
      id: "phantom_edge",
      name: "暴击吴钩",
      brief: "暴击率高，暴击打得更疼",
      category: "attack",
      tier: 2,
      cost: 2150,
      stats: { ad: 60, critChance: 0.3, critDamage: 0.3 },
      color: "#b48cff",
    },
    astral_staff: { id: "astral_staff", name: "减冷却法杖", brief: "法强、蓝量、减冷却都给", category: "magic", tier: 2, cost: 2e3, stats: { ap: 180, mana: 300, cdr: 0.1 }, color: "#6aa8ff" },
    void_crown: { id: "void_crown", name: "法穿玉冠", brief: "专克高魔抗：无视 35% 魔抗", category: "magic", tier: 2, cost: 2100, stats: { ap: 150, magicPen: 0.35 }, color: "#9b6bff" },
    winter_scepter: {
      id: "winter_scepter",
      name: "减速权杖",
      brief: "技能打中就减速，自己更耐打",
      category: "magic",
      tier: 2,
      cost: 2e3,
      stats: { ap: 110, hp: 800 },
      passive: { id: "spell_slow", name: "技能减速", desc: "技能造成伤害时使目标减速 20%，持续 1 秒。", value: 0.2, value2: 1 },
      color: "#8fe3ff",
    },
    sage_codex: { id: "sage_codex", name: "法强竹简", brief: "法强最高，技能伤害最猛", category: "magic", tier: 2, cost: 2300, stats: { ap: 220, apPct: 0.3 }, color: "#f1d27a" },
    guardian_plate: {
      id: "guardian_plate",
      name: "护甲重铠",
      brief: "护甲最高，打你的人攻速降低",
      category: "defense",
      tier: 2,
      cost: 1900,
      stats: { hp: 1e3, armor: 210 },
      passive: { id: "cripple_aura", name: "减攻速", desc: "用普攻打你的敌人攻速 −20%，持续 2 秒。", value: 0.2, value2: 2 },
      color: "#7f8ea3",
    },
    starweave_cloak: {
      id: "starweave_cloak",
      name: "魔抗狐裘",
      brief: "很抗法术，残血自动开盾",
      category: "defense",
      tier: 2,
      cost: 1850,
      stats: { hp: 1e3, mr: 200 },
      passive: { id: "spell_shield", name: "保命盾", desc: "生命低于 35% 时获得 600(+每级 60) 护盾，持续 4 秒，冷却 60 秒。", value: 600, value2: 60 },
      color: "#6fd0c5",
    },
    undying_heart: {
      id: "undying_heart",
      name: "回血护心镜",
      brief: "血最厚，脱战后快速回血",
      category: "defense",
      tier: 2,
      cost: 2e3,
      stats: { hp: 2e3 },
      passive: { id: "regen_ooc", name: "脱战回血", desc: "脱离战斗 5 秒后，每秒回复 2% 最大生命。", value: 0.02 },
      color: "#e0566f",
    },
    thorn_mail: {
      id: "thorn_mail",
      name: "反伤钉盾",
      brief: "谁普攻你，谁就被反伤",
      category: "defense",
      tier: 2,
      cost: 1750,
      stats: { hp: 500, armor: 170 },
      passive: { id: "thorns", name: "反伤", desc: "被普攻打中时，对攻击者造成该次伤害 18% 的法术伤害。", value: 0.18 },
      color: "#7da36b",
    },
  }

/** 装备列表（表值的数组形式，供商店遍历） */
const ItemList: ItemSpec[] = Object.values(ItemTable)
/** 普攻基础攻击距离 */
const BaseAttackRange = 0.6
/** 施法失败原因 → 提示文案 */
const CastFailMessage: Record<string, string> = { cooldown: "技能冷却中", mana: "法力不足", disabled: "当前无法行动", no_target: "没有可用目标", gold: "金币不足", full: "装备栏已满" }
/** 比率转百分比文案 */
const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`
/** 分路 key → 中文名 */
const LaneName: Record<LaneKey, string> = { top: "上路", mid: "中路", bot: "下路" }
/** 防御塔层级 → 中文名 */
const TowerName: Record<TowerTier, string> = { 1: "一塔", 2: "二塔", 3: "高地塔" }
/** 防御塔完整标签，如「上路一塔」 */
const formatTowerLabel = (laneKey: LaneKey, towerTier: TowerTier): string => `${LaneName[laneKey]}${TowerName[towerTier]}`

export { ItemTable, ItemList, BaseAttackRange, CastFailMessage, formatPercent, LaneName, TowerName, formatTowerLabel }
