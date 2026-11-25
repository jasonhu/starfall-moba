import type { HeroSpec } from './types'

/** 程咬金 · 混世魔王（战士） */
export const chijin: HeroSpec = {
  id: "chijin",
  name: "程咬金",
  title: "混世魔王",
  role: "fighter",
  roleName: "战士",
  lane: "top",
  difficulty: 2,
  lore: "隋唐演义里瓦岗寨的「混世魔王」。民间传说他梦里学斧，醒来只记得三招——这「三板斧」却招招要命。",
  tips: "三个技能就是三板斧，每放完一个技能马上补一下普攻，又疼又回血。用「半路杀出」冲到人脸上，再开大招抡斧转圈。血少也能打回来，但别一个人冲进塔里。",
  attackType: "melee",
  radius: 0.62,
  base: {
    hp: 3450,
    mana: 430,
    ad: 172,
    armor: 104,
    mr: 55,
    attackSpeed: 0.9,
    moveSpeed: 5.8,
    attackRange: 2.3,
    hpRegen: 9,
    manaRegen: 3
  },
  growth: {
    hp: 310,
    mana: 95,
    ad: 12.5,
    armor: 21,
    mr: 8,
    attackSpeedPct: 0.022
  },
  basicAttack: {
    windup: 0.33,
    damageType: "physical"
  },
  passive: {
    name: "越砍越勇",
    brief: "放完技能的下一斧更疼还回血",
    tags: ["heal"],
    desc: "施放技能后，4 秒内的下一次普攻变为重斧：额外造成 80(+50%物攻) 点物理伤害，并回复自身 5% 最大生命。",
    values: {
      damage: 80,
      adRatio: 0.5,
      healHpRatio: 0.05,
      window: 4
    }
  },
  skills: {
    s1: {
      slot: "s1",
      name: "拦腰一斧",
      brief: "向前横扫一大片，砍中减速",
      tags: ["burst", "slow"],
      desc: "三板斧第一式：抡斧横扫前方扇形区域，造成 {damage}(+{adRatio%}物攻) 点物理伤害并减速 {slow%}，持续 {slowDur} 秒。",
      maxLevel: 6,
      cooldown: [6.5, 6.2, 5.9, 5.6, 5.3, 5],
      manaCost: [40, 44, 48, 52, 56, 60],
      cast: {
        type: "cone",
        range: 5.5,
        angle: 1.9198621771937625
      },
      values: {
        damage: [220, 275, 330, 385, 440, 495],
        adRatio: 0.8,
        slow: 0.3,
        slowDur: 1.5
      },
      castTime: 0.25
    },
    s2: {
      slot: "s2",
      name: "半路杀出",
      brief: "冲上去砍一路，攻速变快",
      tags: ["dash", "buff"],
      desc: "三板斧第二式：提斧向指定方向猛冲，对路径上的敌人造成 {damage}(+{adRatio%}物攻) 点物理伤害，并获得 {asBonus%} 攻速加成，持续 {asDur} 秒。",
      maxLevel: 6,
      cooldown: [10, 9.5, 9, 8.5, 8, 7.5],
      manaCost: [50, 54, 58, 62, 66, 70],
      cast: {
        type: "direction",
        range: 5.5,
        width: 2
      },
      values: {
        damage: [150, 190, 230, 270, 310, 350],
        adRatio: 0.5,
        asBonus: [0.4, 0.44, 0.48, 0.52, 0.56, 0.6],
        asDur: 4,
        dashSpeed: 24
      },
      castTime: 0.05
    },
    ult: {
      slot: "ult",
      name: "抡圆了砍",
      brief: "抡斧转圈持续砍，可以边转边走",
      tags: ["dot", "buff"],
      desc: "三板斧第三式：抡圆大斧转成一团斧影，持续 {duration} 秒：每 {tick} 秒对周围敌人造成 {damage}(+{adRatio%}物攻) 点物理伤害。期间可以移动，免疫减速并获得 {reduction%} 减伤。",
      maxLevel: 3,
      cooldown: [42, 38, 34],
      manaCost: [100, 110, 120],
      cast: {
        type: "self",
        radius: 4.2
      },
      values: {
        duration: 3,
        tick: 0.3,
        damage: [100, 150, 200],
        adRatio: 0.45,
        reduction: 0.3
      },
      castTime: 0.1
    }
  },
  build: ["boots", "blood_scythe", "boots_guard", "starfall_blade", "guardian_plate", "piercing_spear", "starweave_cloak"],
  palette: {
    primary: "#cc3a26",
    secondary: "#3a3436",
    accent: "#e2a13a",
    glow: "#ff7a2a"
  },
  look: "粗豪敦实的大斧武将：圆铁盔顶一撮红缨，赤褐络腮短髯，咧嘴带笑；胸前两面铜圆护的铁甲，朱红披风与战裙；双手持一柄宽刃的八卦宣花斧，平时扛在右肩。动作大开大合。"
} satisfies HeroSpec
