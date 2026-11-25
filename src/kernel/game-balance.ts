/**
 * 数值平衡表：MINION_STATS/TOWER_STATS/CORE_STATS/MONSTER_STATS/WAVE_SCHEDULE/TOWER_RULES/JUNGLE_RULES/ECONOMY/VISION_RANGES/LATE_GAME_SCALING + 音效合成原语（原 starfall.core.js 第 17-392 行）
 * ---------------------------------------------------------------
 * 内容：小兵/防御塔/野怪数值表、成长经济公式、音效合成原语。
 * 依赖：零（本块不引用任何块外符号，已由 AST 验证）。
 * 本文件由工具自动抽取，变量名/逻辑与线上 100% 一致；本版在保持数据逐字节不变的前提下补充类型契约。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */

/** 小兵/野怪通用战斗数值（部分字段仅兵种具备） */
export interface CombatantStats {
  name: string
  alias?: string
  reward?: string
  hp: number
  hpPerMin: number
  ad: number
  adPerMin: number
  armor: number
  mr: number
  attackSpeed: number
  attackRange: number
  moveSpeed: number
  radius: number
  projectileSpeed: number
  gold: number
  xp: number
  /** 小兵对塔伤害系数 / 野怪是否为史诗级 */
  towerMult?: number
  epic?: boolean
}

/** 防御塔单级数值 */
export interface TowerStats {
  hp: number; ad: number; armor: number; mr: number
  attackSpeed: number; attackRange: number; radius: number; projectileSpeed: number
  teamGold: number; lastHitGold: number
}

/** 兵线刷新规则 */
export interface WaveSchedule {
  firstAt: number; interval: number; melee: number; ranged: number; siegeEvery: number; stagger: number
}

/** 经济/击杀规则 */
export interface EconomyRules {
  startGold: number; passiveGold: number; proximityGoldRatio: number; shareRadius: number
  xpShare: number[]; killGold: number; killGoldPerStreak: number; killGoldMax: number; killGoldMin: number
  firstBloodBonus: number; assistRatio: number; assistWindow: number; killXp: number; killXpPerLevel: number; multiKillWindow: number
}

/** 视野范围（按单位类型） */
export interface VisionRanges {
  hero: number; minion: number; monster: number; tower: number; core: number; bushReveal: number; revealOnAttack: number
}

const MINION_STATS: Record<string, CombatantStats> = {
    melee: {
      name: "近战兵",
      hp: 1100,
      hpPerMin: 75,
      ad: 58,
      adPerMin: 4,
      armor: 40,
      mr: 40,
      attackSpeed: 0.8,
      attackRange: 1.9,
      moveSpeed: 4,
      radius: 0.5,
      projectileSpeed: 0,
      gold: 56,
      xp: 95,
      towerMult: 0.6,
    },
    ranged: {
      name: "远程兵",
      hp: 720,
      hpPerMin: 45,
      ad: 84,
      adPerMin: 6,
      armor: 20,
      mr: 20,
      attackSpeed: 0.75,
      attackRange: 6.5,
      moveSpeed: 4,
      radius: 0.45,
      projectileSpeed: 18,
      gold: 45,
      xp: 70,
      towerMult: 0.6,
    },
    siege: {
      name: "攻城兵",
      hp: 2e3,
      hpPerMin: 140,
      ad: 150,
      adPerMin: 10,
      armor: 80,
      mr: 80,
      attackSpeed: 0.5,
      attackRange: 8,
      moveSpeed: 3.8,
      radius: 0.8,
      projectileSpeed: 14,
      gold: 104,
      xp: 160,
      towerMult: 1.6,
    },
    super: {
      name: "超级兵",
      hp: 4500,
      hpPerMin: 300,
      ad: 220,
      adPerMin: 14,
      armor: 120,
      mr: 120,
      attackSpeed: 0.85,
      attackRange: 2.3,
      moveSpeed: 4,
      radius: 0.9,
      projectileSpeed: 0,
      gold: 118,
      xp: 180,
      towerMult: 1.2,
    },
  },
  WAVE_SCHEDULE: WaveSchedule = { firstAt: 10, interval: 30, melee: 2, ranged: 1, siegeEvery: 3, stagger: 0.6 },
  TOWER_STATS: Record<number, TowerStats> = {
    1: { hp: 7200, ad: 420, armor: 80, mr: 80, attackSpeed: 1, attackRange: 8.5, radius: 1.6, projectileSpeed: 26, teamGold: 120, lastHitGold: 100 },
    2: { hp: 8500, ad: 480, armor: 110, mr: 110, attackSpeed: 1, attackRange: 8.5, radius: 1.6, projectileSpeed: 26, teamGold: 140, lastHitGold: 100 },
    3: { hp: 12e3, ad: 540, armor: 140, mr: 140, attackSpeed: 1, attackRange: 8.5, radius: 1.6, projectileSpeed: 26, teamGold: 160, lastHitGold: 100 },
  },
  TOWER_RULES = { rampPerHit: 0.25, rampMax: 1, backdoorReduction: 0.6, minionMult: 1.4 },
  CORE_STATS = { hp: 19e3, ad: 560, armor: 150, mr: 150, attackSpeed: 1, attackRange: 9, radius: 2.6, projectileSpeed: 26, regen: 40, regenDelay: 8 },
  CORE_RULES = { regenRatio: 0.12, enemyDamageRatio: 0.2 },
  JUNGLE_RULES = {
    leash: 9,
    buffDuration: 70,
    frostCdr: 0.2,
    frostManaRegen: 0.015,
    emberBurnBase: 14,
    emberBurnPerLevel: 3,
    emberSlow: 0.15,
    drakeTeamGold: 90,
    drakeTeamXp: 160,
    breathFirst: 4,
    breathEvery: 12,
    breathWarn: 0.9,
    breathTime: 0.8,
    breathRecover: 0.5,
    breathRadius: 7.5,
    breathAngle: Math.PI / 3,
    breathTicks: 4,
    breathAdRatio: 3,
    blessingDuration: 80,
    blessingDamage: 0.15,
    blessingRegen: 0.01,
    blessingMinionBoost: 0.4,
    colossusTeamGold: 120,
  },
  MONSTER_STATS: Record<string, CombatantStats> = {
    mossback: {
      name: "苔背獾",
      hp: 2200,
      hpPerMin: 150,
      ad: 70,
      adPerMin: 5,
      armor: 60,
      mr: 40,
      attackSpeed: 0.7,
      attackRange: 2,
      moveSpeed: 4.6,
      radius: 0.9,
      projectileSpeed: 0,
      gold: 54,
      xp: 77,
      epic: !1,
    },
    glimwing: {
      name: "荧翅蛾",
      hp: 1250,
      hpPerMin: 85,
      ad: 55,
      adPerMin: 4,
      armor: 30,
      mr: 30,
      attackSpeed: 0.9,
      attackRange: 5,
      moveSpeed: 4.8,
      radius: 0.6,
      projectileSpeed: 16,
      gold: 31,
      xp: 45,
      epic: !1,
    },
    frost_golem: {
      name: "蓝buff",
      alias: "霜晶巨鹿",
      reward: `打掉它，${JUNGLE_RULES.buffDuration} 秒内技能冷却更短、回蓝更快`,
      hp: 4200,
      hpPerMin: 280,
      ad: 110,
      adPerMin: 7,
      armor: 90,
      mr: 60,
      attackSpeed: 0.65,
      attackRange: 2.4,
      moveSpeed: 4.4,
      radius: 1.3,
      projectileSpeed: 0,
      gold: 97,
      xp: 138,
      epic: !1,
    },
    ember_golem: {
      name: "红buff",
      alias: "炽焰巨熊",
      reward: `打掉它，${JUNGLE_RULES.buffDuration} 秒内普攻附带灼烧和减速`,
      hp: 4200,
      hpPerMin: 280,
      ad: 110,
      adPerMin: 7,
      armor: 90,
      mr: 60,
      attackSpeed: 0.65,
      attackRange: 2.4,
      moveSpeed: 4.4,
      radius: 1.3,
      projectileSpeed: 0,
      gold: 97,
      xp: 138,
      epic: !1,
    },
    abyss_drake: {
      name: "河道巨龙",
      alias: "沉渊鳞龙",
      reward: `打掉它：全队每人 +${JUNGLE_RULES.drakeTeamGold} 金币、+${JUNGLE_RULES.drakeTeamXp} 经验`,
      hp: 9e3,
      hpPerMin: 600,
      ad: 190,
      adPerMin: 12,
      armor: 120,
      mr: 100,
      attackSpeed: 0.6,
      attackRange: 3.2,
      moveSpeed: 4,
      radius: 2,
      projectileSpeed: 0,
      gold: 80,
      xp: 120,
      epic: !0,
    },
    star_colossus: {
      name: "星陨巨灵",
      reward: `打掉它：全队 ${JUNGLE_RULES.blessingDuration} 秒内伤害 +${Math.round(JUNGLE_RULES.blessingDamage * 100)}%、持续回血、小兵更强`,
      hp: 16e3,
      hpPerMin: 900,
      ad: 260,
      adPerMin: 16,
      armor: 160,
      mr: 140,
      attackSpeed: 0.55,
      attackRange: 3.6,
      moveSpeed: 3.8,
      radius: 2.4,
      projectileSpeed: 0,
      gold: 120,
      xp: 180,
      epic: !0,
    },
  },
  ECONOMY: EconomyRules = {
    startGold: 300,
    passiveGold: 3.9,
    proximityGoldRatio: 0.35,
    shareRadius: 12,
    xpShare: [1, 0.7, 0.52, 0.42, 0.36],
    killGold: 220,
    killGoldPerStreak: 60,
    killGoldMax: 520,
    killGoldMin: 110,
    firstBloodBonus: 100,
    assistRatio: 0.8,
    assistWindow: 10,
    killXp: 140,
    killXpPerLevel: 28,
    multiKillWindow: 10,
  }
function xpToNext(level: number): number {
  return level >= 15 ? 0 : 160 + 60 * (level - 1)
}
function heroRespawnSeconds(heroLevel: number, elapsedSeconds: number): number {
  return Math.min(60, 6 + heroLevel * 1.5 + Math.max(0, elapsedSeconds - 600) / 20)
}
const LATE_GAME_SCALING = { start: 660, structureVulnPerMin: 0.2, minionBoostPerMin: 0.22 },
  VISION_RANGES: VisionRanges = { hero: 13, minion: 9, monster: 0, tower: 11, core: 13, bushReveal: 2.2, revealOnAttack: 1.5 }


export { MINION_STATS, WAVE_SCHEDULE, TOWER_STATS, TOWER_RULES, CORE_STATS, CORE_RULES, JUNGLE_RULES, MONSTER_STATS, ECONOMY, xpToNext, heroRespawnSeconds, LATE_GAME_SCALING, VISION_RANGES }
