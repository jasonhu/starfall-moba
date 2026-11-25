import type { HeroSpec } from './types'

/** 樊哙 · 鸿门闯帐（坦克） */
export const panyue: HeroSpec = {
  id: "panyue",
  name: "樊哙",
  title: "鸿门闯帐",
  role: "tank",
  roleName: "坦克",
  lane: "bot",
  difficulty: 1,
  lore: "沛县屠狗出身的汉初猛将。《史记》载鸿门宴上他「带剑拥盾入军门」，侧过盾牌撞倒卫士闯进大帐，怒视项王，护着刘邦脱了险。",
  tips: "你是队伍的门板：用「侧盾闯帐」撞进去把人顶飞。被集火就开「拥盾怒目」，有护盾还能减速身边的人。大招跳进人堆砸地开团，别忘了每第三下普攻自带减速。",
  attackType: "melee",
  radius: 0.75,
  base: {
    hp: 3650,
    mana: 440,
    ad: 158,
    armor: 120,
    mr: 70,
    attackSpeed: 0.8,
    moveSpeed: 5.6,
    attackRange: 2.3,
    hpRegen: 11,
    manaRegen: 3.2
  },
  growth: {
    hp: 330,
    mana: 100,
    ad: 9.5,
    armor: 24,
    mr: 9,
    attackSpeedPct: 0.015
  },
  basicAttack: {
    windup: 0.38,
    damageType: "physical"
  },
  passive: {
    name: "覆盾震地",
    brief: "每第三下普攻更疼，还带减速",
    tags: ["slow"],
    desc: "每第三次普攻改用大盾砸地，对目标额外造成自身 4% 最大生命的法术伤害并减速 30%，持续 1 秒。",
    values: {
      hits: 3,
      hpRatio: 0.04,
      slow: 0.3,
      slowDur: 1
    }
  },
  skills: {
    s1: {
      slot: "s1",
      name: "侧盾闯帐",
      brief: "举盾冲过去，撞到人就击飞",
      tags: ["dash", "control"],
      desc: "侧起大盾向指定方向冲撞，撞到第一个敌方英雄或冲到终点时震开周围，造成 {damage}(+{adRatio%}物攻) 点物理伤害并击飞 {knockup} 秒。",
      maxLevel: 6,
      cooldown: [9, 8.6, 8.2, 7.8, 7.4, 7],
      manaCost: [50, 55, 60, 65, 70, 75],
      cast: {
        type: "direction",
        range: 7.5,
        width: 2.2
      },
      values: {
        damage: [240, 300, 360, 420, 480, 540],
        adRatio: 0.6,
        knockup: 0.75,
        dashSpeed: 22,
        impactRadius: 2.6
      },
      castTime: 0.1
    },
    s2: {
      slot: "s2",
      name: "拥盾怒目",
      brief: "给自己加护盾，减速身边敌人",
      tags: ["shield", "slow"],
      desc: "拥盾立定，获得 {shield}(+{hpRatio%}最大生命) 点护盾，持续 {duration} 秒；同时怒目一喝震慑周围敌人，造成 {damage} 点法术伤害并减速 {slow%}，持续 {slowDur} 秒。",
      maxLevel: 6,
      cooldown: [11, 10.6, 10.2, 9.8, 9.4, 9],
      manaCost: [60, 65, 70, 75, 80, 85],
      cast: {
        type: "self",
        radius: 4.5
      },
      values: {
        shield: [300, 390, 480, 570, 660, 750],
        hpRatio: 0.09,
        duration: 4,
        damage: [120, 160, 200, 240, 280, 320],
        slow: 0.35,
        slowDur: 2
      },
      castTime: 0.2
    },
    ult: {
      slot: "ult",
      name: "跃盾砸阵",
      brief: "跳进人堆砸地，击飞一大片",
      tags: ["control", "slow"],
      desc: "大喝一声「死且不避」，须发戟张，高高跃起连人带盾砸向目标区域，落地造成 {damage}(+{hpRatio%}最大生命) 点物理伤害并击飞 {knockup} 秒，随后留下持续 {zoneDur} 秒的震裂地面，使其中敌人减速 {slow%}。跃起期间免疫控制。",
      maxLevel: 3,
      cooldown: [50, 45, 40],
      manaCost: [100, 110, 120],
      cast: {
        type: "position",
        range: 9.5,
        radius: 4.5
      },
      values: {
        damage: [400, 600, 800],
        hpRatio: 0.06,
        knockup: 1,
        leapTime: 0.65,
        zoneDur: 3,
        slow: 0.4
      },
      castTime: 0.65
    }
  },
  build: ["boots", "guardian_plate", "boots_guard", "starweave_cloak", "undying_heart", "thorn_mail", "winter_scepter"],
  palette: {
    primary: "#5f6b78",
    secondary: "#7a4e30",
    accent: "#d9a441",
    glow: "#ffcf70"
  },
  look: "魁梧的汉初猛将：比其他英雄高大宽厚一号，玄铁札甲配方片披膊，赭褐粗布战裙；须发戟张、络腮虬髯、怒目；左臂一面黑漆金纹的双弧大盾，右手一柄汉剑。动作沉重。"
} satisfies HeroSpec
