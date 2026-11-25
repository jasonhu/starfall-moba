/**
 * 战斗音效映射：普攻/命中/弹道发射与命中/范围提示 + 怪物种类 + 播报优先级（原 starfall.core.js 第 3178-3236 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 事件播报优先级表（事件名 → 数值，越大越优先） */
export type AnnouncePriority = Record<string, number>

const HERO_ATTACK_SFX = { panyue: "atk_panyue_swing", chijin: "atk_chijin_swing", xingli: "atk_xingli_charge", fengling: "atk_fengling_draw", yeque: "atk_yeque_swing" },
  HERO_HIT_SFX = { panyue: "atk_panyue_hit", chijin: "atk_chijin_hit", yeque: "atk_yeque_hit" },
  PROJECTILE_LAUNCH_SFX = {
    xingli_basic: "atk_xingli_launch",
    fengling_basic: "atk_fengling_launch",
    xingli_s1: "xingli_s1_fly",
    fengling_s1: "fengling_s1_fly",
    yeque_s2: "yeque_s2_fly",
    minion_ranged: "minion_ranged_launch",
    minion_siege: "minion_siege_launch",
    tower_bolt: "tower_launch",
    core_bolt: "tower_launch",
    monster_spit: "monster_spit_launch",
  },
  PROJECTILE_HIT_SFX = {
    xingli_basic: "atk_xingli_hit",
    fengling_basic: "atk_fengling_hit",
    xingli_s1: "xingli_s1_hit",
    fengling_s1: "fengling_s1_hit",
    yeque_s2: "yeque_s2_hit",
    minion_ranged: "minion_ranged_hit",
    minion_siege: "minion_siege_hit",
    tower_bolt: "tower_hit",
    core_bolt: "tower_hit",
    monster_spit: "monster_spit_hit",
  },
  AREA_SFX = {
    telegraph: "area_telegraph",
    panyue_s2_aura: "area_panyue_aura",
    panyue_ult_fissure: "area_panyue_fissure",
    chijin_ult_spin: "area_chijin_spin",
    xingli_s2_well: "area_xingli_well",
    xingli_ult_storm: "area_xingli_storm",
    fengling_ult_rain: "area_fengling_rain",
  },
  MONSTER_KIND = { mossback: 0, frost_golem: 1, ember_golem: 2, abyss_drake: 3, star_colossus: 4, glimwing: 5 },
  isBossMonster = (monsterId: string): number => (monsterId === "star_colossus" ? 1 : 0),
  ANNOUNCE_PRIORITY: AnnouncePriority = {
    victory: 100,
    defeat: 100,
    ace: 90,
    penta_kill: 85,
    quadra_kill: 80,
    legendary: 78,
    triple_kill: 75,
    unstoppable: 72,
    double_kill: 70,
    first_blood: 68,
    shutdown: 60,
    killing_spree: 58,
    epic_slain: 50,
    tower_destroyed: 45,
    epic_spawn: 40,
    match_start: 35,
    super_minions: 30,
    minions_spawn: 20,
  },
  KILL_STREAK_EVENTS = new Set(["first_blood", "double_kill", "triple_kill", "quadra_kill", "penta_kill", "killing_spree", "unstoppable", "legendary", "shutdown", "ace"]),
  MAJOR_EVENTS = new Set([...KILL_STREAK_EVENTS, "tower_destroyed", "epic_slain", "super_minions"])

export { HERO_ATTACK_SFX, HERO_HIT_SFX, PROJECTILE_LAUNCH_SFX, PROJECTILE_HIT_SFX, AREA_SFX, MONSTER_KIND, isBossMonster, ANNOUNCE_PRIORITY, KILL_STREAK_EVENTS, MAJOR_EVENTS }
