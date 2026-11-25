import type { HeroSpec } from './types'

/** 李广 · 汉之飞将（射手） */
export const fengling: HeroSpec = {
  id: "fengling",
  name: "李广",
  title: "汉之飞将",
  role: "marksman",
  roleName: "射手",
  lane: "bot",
  difficulty: 2,
  lore: "西汉名将，《史记·李将军列传》说他「猿臂善射」。夜里把草中巨石当成猛虎，一箭射去，箭头没进了石头；匈奴人叫他「汉之飞将军」，多年不敢来犯。",
  tips: "站住了不停射箭，越射越快，叠满五层还会加移速和伤害。被近身就用「飞将腾身」翻开，落地后的下一箭必定暴击。大招箭雨能减速一大片，开团、断后都好用。",
  attackType: "ranged",
  radius: 0.58,
  base: {
    hp: 2900,
    mana: 440,
    ad: 168,
    armor: 78,
    mr: 50,
    attackSpeed: 0.95,
    moveSpeed: 5.5,
    attackRange: 8.2,
    hpRegen: 7,
    manaRegen: 3
  },
  growth: {
    hp: 205,
    mana: 100,
    ad: 13,
    armor: 14,
    mr: 6,
    attackSpeedPct: 0.03
  },
  basicAttack: {
    windup: 0.28,
    damageType: "physical",
    projectile: "fengling_basic",
    projectileSpeed: 30
  },
  passive: {
    name: "猿臂连射",
    brief: "连续普攻，越射越快越疼",
    tags: ["buff"],
    desc: "普攻命中获得一层连射(最多 5 层，持续 3 秒)，每层提高 6% 攻速。满层时移速提高 10%，且普攻额外造成 20(+每级 4) 点物理伤害。",
    values: {
      maxStacks: 5,
      duration: 3,
      asPerStack: 0.06,
      haste: 0.1,
      bonus: 20,
      bonusPerLevel: 4
    }
  },
  skills: {
    s1: {
      slot: "s1",
      name: "白羽没石",
      brief: "一支能穿兵的重箭，射中减速",
      tags: ["burst", "slow"],
      desc: "引满长弓射出一支能没入石棱的重箭，贯穿沿途小兵，命中的第一个敌方英雄受到 {damage}(+{adRatio%}物攻) 点物理伤害并减速 {slow%}，持续 {slowDur} 秒(对沿途小兵/野怪造成 60% 伤害)。",
      maxLevel: 6,
      cooldown: [8, 7.6, 7.2, 6.8, 6.4, 6],
      manaCost: [50, 55, 60, 65, 70, 75],
      cast: {
        type: "direction",
        range: 14,
        width: 1.3
      },
      values: {
        damage: [280, 350, 420, 490, 560, 630],
        adRatio: 1,
        slow: 0.3,
        slowDur: 1.5,
        speed: 32,
        minionRatio: 0.6
      },
      castTime: 0.3
    },
    s2: {
      slot: "s2",
      name: "飞将腾身",
      brief: "翻身拉开距离，下一箭必暴击",
      tags: ["dash", "buff"],
      desc: "向指定方向腾身翻跃，落地后获得 {haste%} 移速加成持续 {hasteDur} 秒，且下一次普攻必定暴击。",
      maxLevel: 6,
      cooldown: [9, 8.5, 8, 7.5, 7, 6.5],
      manaCost: [40, 42, 44, 46, 48, 50],
      cast: {
        type: "direction",
        range: 5,
        width: 1.2
      },
      values: {
        haste: 0.2,
        hasteDur: 2,
        critWindow: 4,
        dashSpeed: 26
      },
      castTime: 0.05
    },
    ult: {
      slot: "ult",
      name: "箭锁阴山",
      brief: "箭雨盖住一大片，持续减速",
      tags: ["slow", "dot"],
      desc: "仰射一簇羽箭，令箭雨封锁目标区域 {duration} 秒：每 {tick} 秒造成 {damage}(+{adRatio%}物攻) 点物理伤害并减速 {slow%}。",
      maxLevel: 3,
      cooldown: [50, 45, 40],
      manaCost: [110, 120, 130],
      cast: {
        type: "position",
        range: 11.5,
        radius: 5
      },
      values: {
        damage: [95, 140, 185],
        adRatio: 0.4,
        duration: 3,
        tick: 0.5,
        delay: 0.5,
        slow: 0.35,
        slowDur: 0.8
      },
      castTime: 0.4
    }
  },
  build: ["boots", "sunchaser_bow", "boots_fury", "phantom_edge", "blood_scythe", "piercing_spear", "starfall_blade"],
  palette: {
    primary: "#2f7a78",
    secondary: "#e9e2cf",
    accent: "#c99a45",
    glow: "#9df5d2"
  },
  look: "高瘦的汉代边将(男)，双臂比常人长：鬓角微霜，头戴插着双鹖尾的武冠；苍青戎服外罩熟皮轻甲，只披左肩，短披风斜搭身后；右腰后一箙白羽箭，手持一张黑漆角弓。站姿沉稳，开弓极满。"
} satisfies HeroSpec
