import type { HeroSpec } from './types'

/** 王昭君 · 落雁出塞（法师） */
export const xingli: HeroSpec = {
  id: "xingli",
  name: "王昭君",
  title: "落雁出塞",
  role: "mage",
  roleName: "法师",
  lane: "mid",
  difficulty: 2,
  lore: "西汉元帝时出塞和亲的王嫱，《汉书》《后汉书》有载。传说她在马上怀抱琵琶，曲声一起，南飞的大雁听得忘了振翅，纷纷落向平沙，于是有了「落雁」之名。",
  tips: "技能每打中一次留下一层「余音」，同一个人叠满三层就会眩晕。先放「回环收弦」把人圈住拉回来，再把大招盖上去。你很脆，站在队友身后弹，别让人近身。",
  attackType: "ranged",
  radius: 0.58,
  base: {
    hp: 3100,
    mana: 520,
    ad: 150,
    armor: 80,
    mr: 50,
    attackSpeed: 0.85,
    moveSpeed: 5.5,
    attackRange: 7.5,
    hpRegen: 7,
    manaRegen: 4.2
  },
  growth: {
    hp: 225,
    mana: 125,
    ad: 8,
    armor: 14,
    mr: 6,
    attackSpeedPct: 0.01
  },
  basicAttack: {
    windup: 0.3,
    damageType: "magic",
    projectile: "xingli_basic",
    projectileSpeed: 24
  },
  passive: {
    name: "余音三叠",
    brief: "技能打中同一人三次就眩晕",
    tags: ["control"],
    desc: "技能命中敌人会留下一层余音(持续 5 秒)。叠满 3 层时弦音共振：造成目标 6% 最大生命的法术伤害(对非英雄上限 300)并眩晕 0.75 秒。",
    values: {
      stacks: 3,
      duration: 5,
      hpRatio: 0.06,
      cap: 300,
      stun: 0.75
    }
  },
  skills: {
    s1: {
      slot: "s1",
      name: "一弦穿云",
      brief: "弹出一道音波，穿透一整条线",
      tags: ["burst"],
      desc: "拨动一弦，弹出一道穿透的弦音，对沿途所有敌人造成 {damage}(+{apRatio%}法强) 点法术伤害。",
      maxLevel: 6,
      cooldown: [6.3, 6, 5.7, 5.4, 5.1, 4.8],
      manaCost: [50, 55, 60, 65, 70, 75],
      cast: {
        type: "direction",
        range: 12,
        width: 1.3
      },
      values: {
        damage: [280, 350, 420, 490, 560, 630],
        apRatio: 0.55,
        speed: 26
      },
      castTime: 0.2
    },
    s2: {
      slot: "s2",
      name: "回环收弦",
      brief: "圈住一片，稍后把人拉到中间",
      tags: ["control", "slow"],
      desc: "在目标位置拨出一圈回旋的曲音，{delay} 秒后收弦：造成 {damage}(+{apRatio%}法强) 点法术伤害，将敌人拉向中心并减速 {slow%}，持续 {slowDur} 秒。",
      maxLevel: 6,
      cooldown: [11, 10.6, 10.2, 9.8, 9.4, 9],
      manaCost: [70, 75, 80, 85, 90, 95],
      cast: {
        type: "position",
        range: 9,
        radius: 3.4
      },
      values: {
        damage: [260, 325, 390, 455, 520, 585],
        apRatio: 0.5,
        delay: 0.6,
        pull: 1.6,
        slow: 0.45,
        slowDur: 2
      },
      castTime: 0.25
    },
    ult: {
      slot: "ult",
      name: "雁落平沙",
      brief: "雁群一波波俯冲，覆盖一大片",
      tags: ["dot", "slow"],
      desc: "一曲引得群雁落向目标区域：{duration} 秒内俯冲 {waves} 波雁影，每波对区域内敌人造成 {damage}(+{apRatio%}法强) 点法术伤害并减速 {slow%}。每波都会附加一层余音。",
      maxLevel: 3,
      cooldown: [48, 43, 38],
      manaCost: [120, 130, 140],
      cast: {
        type: "position",
        range: 11,
        radius: 5.2
      },
      values: {
        damage: [160, 230, 300],
        apRatio: 0.3,
        waves: 5,
        duration: 2.5,
        delay: 0.5,
        slow: 0.3,
        slowDur: 1
      },
      castTime: 0.4
    }
  },
  build: ["boots", "astral_staff", "boots_arcane", "void_crown", "sage_codex", "winter_scepter", "starweave_cloak"],
  palette: {
    primary: "#3d4c9e",
    secondary: "#f6f0e6",
    accent: "#c8324a",
    glow: "#a9d4ff"
  },
  look: "出塞的汉家女子：绛红斗篷配一圈蓬松的雪白毛领，头戴白毛帽箍，露出黑色发髻与金步摇；斗篷下是月白曲裾深衣与长绶带；怀里斜抱一把梨形四弦琵琶。神情沉静，施法时弦上泛起月色与金光。"
} satisfies HeroSpec
