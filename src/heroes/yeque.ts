import type { HeroSpec } from './types'

/** 荆轲 · 易水壮士（刺客） */
export const yeque: HeroSpec = {
  id: "yeque",
  name: "荆轲",
  title: "易水壮士",
  role: "assassin",
  roleName: "刺客",
  lane: "jungle",
  difficulty: 3,
  lore: "战国末年的剑客，受燕太子丹之托入秦行刺。《史记·刺客列传》记他易水辞别，献上督亢地图，「图穷而匕首见」。",
  tips: "先在野区打野攒等级，再去各条路抓残血的人。敌人血量低于四成时你打得更疼，拿到击杀或助攻会刷新一、二技能，可以接着追下一个。别第一个冲进人堆：等队友先上，再用大招贴上去收掉脆皮。",
  attackType: "melee",
  radius: 0.58,
  base: {
    hp: 3050,
    mana: 440,
    ad: 178,
    armor: 88,
    mr: 52,
    attackSpeed: 0.92,
    moveSpeed: 6,
    attackRange: 2.2,
    hpRegen: 8,
    manaRegen: 3
  },
  growth: {
    hp: 250,
    mana: 100,
    ad: 13.5,
    armor: 16,
    mr: 6.5,
    attackSpeedPct: 0.022
  },
  basicAttack: {
    windup: 0.3,
    damageType: "physical"
  },
  passive: {
    name: "一去不还",
    brief: "打残血更疼，杀人后刷新技能",
    tags: ["burst"],
    desc: "抱定死志：对生命值低于 40% 的敌人造成的伤害提高 18%。参与击杀英雄后，立即刷新一、二技能冷却并回复 8% 最大生命。对野怪造成的伤害提高 25%。",
    values: {
      threshold: 0.4,
      bonus: 0.18,
      healHpRatio: 0.08,
      monsterBonus: 0.25
    }
  },
  skills: {
    s1: {
      slot: "s1",
      name: "风萧易水",
      brief: "突刺穿过敌人，刺中英雄这招更快转好",
      tags: ["dash"],
      desc: "像一阵寒风向指定方向疾刺穿过，对路径上的敌人造成 {damage}(+{adRatio%}物攻) 点物理伤害。若命中敌方英雄，这一招的冷却立即返还 {refund%}。",
      maxLevel: 6,
      cooldown: [7, 6.7, 6.4, 6.1, 5.8, 5.5],
      manaCost: [40, 44, 48, 52, 56, 60],
      cast: {
        type: "direction",
        range: 6.5,
        width: 2
      },
      values: {
        damage: [200, 255, 310, 365, 420, 475],
        adRatio: 1,
        refund: 0.4,
        dashSpeed: 30
      },
      castTime: 0.05
    },
    s2: {
      slot: "s2",
      name: "引匕一掷",
      brief: "扇形丢出三把匕首，命中减速",
      tags: ["slow"],
      desc: "扇形掷出 3 把匕首，每把对命中的第一个敌人造成 {damage}(+{adRatio%}物攻) 点物理伤害并减速 {slow%}，持续 {slowDur} 秒(同一目标被多把命中时，后续匕首只造成 50% 伤害)。",
      maxLevel: 6,
      cooldown: [8, 7.6, 7.2, 6.8, 6.4, 6],
      manaCost: [50, 54, 58, 62, 66, 70],
      cast: {
        type: "direction",
        range: 9,
        width: 1
      },
      values: {
        damage: [165, 210, 255, 300, 345, 390],
        adRatio: 0.65,
        slow: 0.35,
        slowDur: 1.5,
        blades: 3,
        spread: 0.2792526803190927,
        speed: 26,
        repeatRatio: 0.5
      },
      castTime: 0.15
    },
    ult: {
      slot: "ult",
      name: "卷尽匕现",
      brief: "抖开图卷欺近目标，卷尽一匕",
      tags: ["burst", "dash"],
      desc: "抖开督亢图卷遮住身形(期间不可被选中)，卷尽时人已欺到目标敌方英雄身边，一匕刺出：造成 {damage}(+{adRatio%}物攻) 外加目标 {missingRatio%} 已损生命的物理伤害。",
      maxLevel: 3,
      cooldown: [40, 35, 30],
      manaCost: [100, 105, 110],
      cast: {
        type: "target",
        range: 8
      },
      values: {
        damage: [340, 510, 680],
        adRatio: 1.2,
        missingRatio: 0.2,
        vanish: 0.35
      },
      castTime: 0.35
    }
  },
  build: ["boots", "starfall_blade", "boots_arcane", "piercing_spear", "phantom_edge", "blood_scythe", "starweave_cloak"],
  palette: {
    primary: "#3a3156",
    secondary: "#ece8de",
    accent: "#b48cff",
    glow: "#a886ff"
  },
  look: "精瘦冷峻的战国游侠：束发露面，一身近黑的墨紫劲装，束腕绑腿；颈后一条长长的素白巾拖在身后，末端像蘸了墨；背上斜挎一支图卷筒；右手反握一柄淬过药的青钢匕首，左手一把更小的副匕。跑动时身体压低。"
} satisfies HeroSpec
