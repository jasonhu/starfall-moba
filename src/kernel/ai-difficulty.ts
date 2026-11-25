/**
 * AI 难度预设 AI_DIFFICULTY_PRESETS（novice 等档位的思考延迟/反应/瞄准误差/闪避）（原 starfall.core.js 第 62551-62644 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 单档 AI 难度：思考/反应延迟、瞄准误差、进攻性与走位习惯 */
export interface AiDifficultyPreset {
  think: number; reaction: number; aimError: number; aimLead: number; dodge: number
  lastHitError: number; lastHitSkip: number; aggression: number; harass: number; dive: boolean
  comboGap: number; orbwalk: boolean; flashKill: number; escapeSense: number; focus: number
  awareness: number; teamwork: number; idleRate: number; idleMin: number; idleMax: number; gankCooldown: number
  [key: string]: number | boolean
}

const AI_DIFFICULTY_PRESETS: Record<string, AiDifficultyPreset> = {
  novice: {
    think: 0.4,
    reaction: 0.9,
    aimError: 0.3,
    aimLead: 0,
    dodge: 0.05,
    lastHitError: 0.22,
    lastHitSkip: 0.3,
    aggression: 0.72,
    harass: 0.1,
    dive: !1,
    comboGap: 0.9,
    orbwalk: !1,
    flashKill: 0,
    escapeSense: 0.75,
    focus: 0,
    awareness: 0,
    teamwork: 0.25,
    idleRate: 0.07,
    idleMin: 1,
    idleMax: 2.5,
    gankCooldown: 100,
  },
  easy: {
    think: 0.3,
    reaction: 0.6,
    aimError: 0.2,
    aimLead: 0,
    dodge: 0.15,
    lastHitError: 0.22,
    lastHitSkip: 0.3,
    aggression: 0.8,
    harass: 0.2,
    dive: !1,
    comboGap: 0.6,
    orbwalk: !1,
    flashKill: 0,
    escapeSense: 0.75,
    focus: 0,
    awareness: 0,
    teamwork: 0.4,
    idleRate: 0.035,
    idleMin: 0.7,
    idleMax: 1.8,
    gankCooldown: 70,
  },
  normal: {
    think: 0.16,
    reaction: 0.28,
    aimError: 0.09,
    aimLead: 0.8,
    dodge: 0.6,
    lastHitError: 0.1,
    lastHitSkip: 0.1,
    aggression: 1,
    harass: 0.55,
    dive: !0,
    comboGap: 0.22,
    orbwalk: !0,
    flashKill: 0.45,
    escapeSense: 1,
    focus: 0.6,
    awareness: 0.4,
    teamwork: 0.7,
    idleRate: 0,
    idleMin: 0,
    idleMax: 0,
    gankCooldown: 34,
  },
  hard: {
    think: 0.1,
    reaction: 0.12,
    aimError: 0.03,
    aimLead: 1,
    dodge: 0.85,
    lastHitError: 0.04,
    lastHitSkip: 0,
    aggression: 1.06,
    harass: 0.75,
    dive: !0,
    comboGap: 0.08,
    orbwalk: !0,
    flashKill: 0.9,
    escapeSense: 1.1,
    focus: 1,
    awareness: 0.7,
    teamwork: 1,
    idleRate: 0,
    idleMin: 0,
    idleMax: 0,
    gankCooldown: 30,
  },
}

export { AI_DIFFICULTY_PRESETS }
