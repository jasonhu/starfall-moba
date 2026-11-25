/**
 * 新英雄模板 —— 复制本文件改名为 <your_id>.ts，然后在 index.ts 里注册。
 * 先跑通"数据 + 复用现有模型/技能规格"的最小闭环，再逐步替换成自己的模型和特效。
 */
import type { HeroSpec } from './types'

export const myhero: HeroSpec = {
  id: 'myhero',            // 唯一 id，小写英文，会和模型 key `hero:myhero` 对齐
  name: '无名氏',
  title: '测试剑客',
  role: 'fighter',
  roleName: '战士',
  lane: 'mid',
  difficulty: 2,
  lore: '一句话背景。',
  tips: '一句话上手提示。',
  attackType: 'melee',
  radius: 0.6,
  base: { hp: 3300, mana: 420, ad: 165, armor: 95, mr: 50, attackSpeed: 0.85, moveSpeed: 5.7, attackRange: 2.3, hpRegen: 9, manaRegen: 3 },
  growth: { hp: 300, mana: 90, ad: 11, armor: 20, mr: 8, attackSpeedPct: 0.02 },
  basicAttack: { windup: 0.34, damageType: 'physical' },
  passive: {
    name: '无名被动',
    brief: '每第三次普攻附加额外伤害',
    tags: ['burst'],
    desc: '每第三次普攻额外造成 {damage} 点物理伤害。',
    values: { hits: 3, damage: [40, 60, 80] },
  },
  skills: {
    s1: {
      slot: 's1',
      name: '突刺',
      brief: '向前突进并击退敌人',
      tags: ['dash', 'control'],
      desc: '向指定方向突进，造成 {damage}(+{adRatio%}物攻) 点物理伤害。',
      maxLevel: 6,
      cooldown: [7, 6.6, 6.2, 5.8, 5.4, 5],
      manaCost: [40, 45, 50, 55, 60, 65],
      cast: { type: 'direction', range: 7, width: 1.8 },
      values: { damage: [180, 230, 280, 330, 380, 430], adRatio: 0.5, speed: 18, dashSpeed: 18 },
      castTime: 0.1,
    },
    s2: {
      slot: 's2',
      name: '架势',
      brief: '短暂加护盾',
      tags: ['shield'],
      desc: '获得 {shield}(+{hpRatio%}最大生命) 点护盾，持续 {duration} 秒。',
      maxLevel: 6,
      cooldown: [12, 11.5, 11, 10.5, 10, 9.5],
      manaCost: [50, 55, 60, 65, 70, 75],
      cast: { type: 'self', radius: 2 },
      values: { shield: [200, 260, 320, 380, 440, 500], hpRatio: 0.06, duration: 3 },
      castTime: 0.15,
    },
    ult: {
      slot: 'ult',
      name: '决死一击',
      brief: '跳向目标点造成范围伤害',
      tags: ['control', 'burst'],
      desc: '跃向目标区域，落地造成 {damage} 点物理伤害并击飞 {knockup} 秒。',
      maxLevel: 3,
      cooldown: [45, 40, 35],
      manaCost: [100, 110, 120],
      cast: { type: 'position', range: 8, radius: 3.5 },
      values: { damage: [300, 450, 600], knockup: 0.8, leapTime: 0.55 },
      castTime: 0.55,
    },
  },
  build: ['boots', 'guardian_plate', 'starweave_cloak', 'undying_heart', 'thorn_mail', 'winter_scepter'],
  palette: { primary: '#4a5568', secondary: '#2d3748', accent: '#e2c275', glow: '#ffd98a' },
  look: '中等身形的剑客，短打劲装，右手一柄直刃长剑，动作轻快。',
}
