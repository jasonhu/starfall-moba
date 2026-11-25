/**
 * AI 战术参数：HERO_AI_PERSONALITY（英雄性格）/ AI_TUNING（全局调参）/ SKILL_SLOTS（原 starfall.core.js 第 61040-61098 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 单个英雄的战术性格（逃血线/开团倾向/切后排/辅助倾向） */
export interface HeroAiPersonality {
  fleeHp: number; recallHp: number; engage: number; initiator: boolean; diveBackline: number; support: boolean
}
/** 全局 AI 调参（感知半径/优势阈值/补刀蓝量等） */
export interface AiTuning { [key: string]: number }
const HERO_AI_PERSONALITY: Record<string, HeroAiPersonality> = {
    panyue: { fleeHp: 0.22, recallHp: 0.33, engage: 0.9, initiator: !0, diveBackline: 0.2, support: !0 },
    chijin: { fleeHp: 0.23, recallHp: 0.34, engage: 0.82, initiator: !0, diveBackline: 0.5, support: !1 },
    xingli: { fleeHp: 0.3, recallHp: 0.38, engage: 1.05, initiator: !1, diveBackline: 0, support: !1 },
    fengling: { fleeHp: 0.3, recallHp: 0.38, engage: 1.05, initiator: !1, diveBackline: 0, support: !1 },
    yeque: { fleeHp: 0.28, recallHp: 0.38, engage: 0.94, initiator: !1, diveBackline: 1.2, support: !1 },
  },
  AI_TUNING: AiTuning = {
    senseRadius: 15,
    allyNear: 10,
    allyFar: 18,
    foeNear: 11,
    foeFar: 18,
    fightHorizon: 5,
    advAllIn: 1.18,
    advPoke: 0.85,
    advFlee: 0.62,
    respectLethal: 0.8,
    advOutgunned: 0.7,
    advPress: 1.08,
    advFightBack: 0.95,
    tradeFatigue: 0.05,
    advPressed: 0.85,
    baseGhostRange: 42,
    baseGhost: 0.75,
    followUp: 0.85,
    waitForEngage: 1.12,
    killSlack: 2.2,
    shakenTime: 4,
    shakenFactor: 1.25,
    fleeHold: 1.4,
    fightHold: 1,
    baseHpReady: 0.92,
    baseManaReady: 0.8,
    healHp: 0.5,
    towerMargin: 1.2,
    minionAggro: 8,
    laneEnd: 270,
    squadTime: 50,
    squadRest: 35,
    lateStart: 570,
    groupMin: 3,
    drakeHeroes: 2,
    drakeLevel: 5,
    colossusHeroes: 3,
    colossusLevel: 8,
    gankSameTarget: 80,
    gankSameLane: 45,
    defendHold: 6,
    regroupBack: 11,
    threatHold: 18,
    massMemory: 25,
    teamTick: 0.8,
    waveclearMana: 0.55,
    groupHarass: 0.3,
    pokeMana: 0.35,
    jungleMana: 0.25,
  },
  SKILL_SLOTS: string[] = ["s1", "s2", "ult"]

export { HERO_AI_PERSONALITY, AI_TUNING, SKILL_SLOTS }
