/**
 * 项羽 · 西楚霸王 —— 用 HeroBundle 声明的完整英雄。
 *
 * 重构前，这个英雄被拆散在 4 个地方：
 *   - src/heroes/xiangyu.ts        数值数据
 *   - src/heroes/xiangyu.spec.ts   技能规格
 *   - src/extensions/install.ts    5 条程序化音效 + 普攻映射
 *   - 内核 __registerXiangyuTables 10 张视觉表 + 4 个图标
 * 现在全部收拢到这一个文件、一个 defineHeroBundle 调用里。
 *
 * 模型几何（SX/XY）因依赖内核私有 DSL，仍留在内核 Gx 注册表，
 * bundle 用 model.key 声明即可，不需要也不应该外移。
 */

import { defineHeroBundle } from './types'
import { xiangyu } from '../heroes/xiangyu'
import type { Kernel } from '../extensions/api'
import type { CombatSpec } from './types'

// 技能图标 SVG body（从旧内核 __registerXiangyuTables 提取，色值已内联）
const ICON_BG: [string, string, string] = ['#3a2422', '#8d3126', '#140b09']
const icons = {
  passive: `<g fill="none" stroke-linecap="round">
          <path d="M18 30q0 18 14 18t14-18" stroke="#f0c063" stroke-width="2"/>
          <path d="M18 30h28" stroke="#f0c063" stroke-width="2.4"/>
          <path d="M24 48v7M32 48v8M40 48v7" stroke="#f0c063" stroke-width="2"/>
          <path d="M32 12v14M26 26q6 5 12 0" stroke="#e9eef7" stroke-width="2.6"/>
          <path d="M22 20l-6-6M42 20l6-6" stroke="#ff8a4c" stroke-width="1.6" stroke-opacity=".8"/>
        </g>`,
  s1: `<g fill="none" stroke-linecap="round">
          <path d="M12 52q18-8 30-32" stroke="#f0c063" stroke-width="2.6" stroke-opacity=".85"/>
          <path d="M28 50l16-14" stroke="#e9eef7" stroke-width="3.2"/>
          <path d="M42 22l9 8-8 6z" fill="#e9eef7" stroke="#9fb0c6" stroke-width="1.2"/>
          <path d="M9 45q7-9 18-12" stroke="#ff8a4c" stroke-width="2" stroke-opacity=".75"/>
          <circle cx="14" cy="49" r="2.6" fill="#f0c063"/>
        </g>`,
  s2: `<g>
          <path d="M32 12l17 7v13c0 12-8 19-17 23-9-4-17-11-17-23V19z" fill="#1d1414" stroke="#f0c063" stroke-width="2.2"/>
          <path d="M32 20l11 4v9c0 8-5 12-11 15-6-3-11-7-11-15v-9z" fill="none" stroke="#ff8a4c" stroke-width="1.6" stroke-opacity=".9"/>
          <path d="M26 33h12" stroke="#f0c063" stroke-width="2.6"/>
          <path d="M32 33v-8M32 33v8" stroke="#f0c063" stroke-width="1.6" stroke-opacity=".7"/>
        </g>`,
  ult: `<g fill="none">
          <ellipse cx="32" cy="42" rx="22" ry="9" stroke="#f0c063" stroke-width="2.2" stroke-opacity=".8"/>
          <ellipse cx="32" cy="42" rx="13" ry="5" stroke="#ff8a4c" stroke-width="1.8"/>
          <path d="M32 10v20" stroke="#e9eef7" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M25 24q7 6 12 0" stroke="#e9eef7" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M18 44l-8 6M46 44l8 6" stroke="#f0c063" stroke-width="1.6" stroke-opacity=".7"/>
        </g>`,
}

/** 技能规格：数值全部从英雄数据读取，这里只描述"它们如何映射到战斗系统" */
function combat(kernel: Kernel): CombatSpec {
  const kernelApi = kernel as any
  const readSkillValue = (clavL: string, skillValueKey: string) => kernelApi.skillValue('xiangyu', clavL, skillValueKey)
  const range = (idleMin: string) => kernelApi.skillRange('xiangyu', idleMin)
  const makeDamageSpec = (damageType: string, extra: Record<string, string> = {}) => kernelApi.makeDamage(damageType, extra)
  return {
    s1: kernelApi.buildActionSpec('xiangyu', 's1', {
      roles: ['engage', 'chase'],
      damage: makeDamageSpec('physical', { ad: 'adRatio' }),
      cc: [{ kind: 'knockup', duration: readSkillValue('s1', 'knockup'), value: 0 }],
      // mobility 的 kind='dash' + stopsAtHero=true 会让通用 handler 真正发起冲锋，
      // 并在撞到第一个英雄时停下、在落点做 AOE 伤害与击飞。
      mobility: kernelApi.makeDash('xiangyu', 's1', true),
      reach: range('s1') + readSkillValue('s1', 'impactRadius'),
      aoeRadius: readSkillValue('s1', 'impactRadius'),
      dodgeable: true,
    }),
    s2: kernelApi.buildActionSpec('xiangyu', 's2', {
      roles: ['defense', 'buff'],
      // s2 是纯护盾+攻速技能，values 里没有 damage 字段。
      // 声明 damage 会让内核施法时执行 Nh(skill,'damage') 抛错；
      // 内核 Pk() 对 damage 缺失有安全兜底（if(!i) return 0），此处不声明即可。
      duration: readSkillValue('s2', 'duration'),
      selfBuffs: ['shield', 'attack_speed'],
    }),
    ult: kernelApi.buildActionSpec('xiangyu', 'ult', {
      roles: ['engage', 'zone'],
      damage: makeDamageSpec('physical', { ad: 'adRatio' }),
      cc: [
        { kind: 'knockup', duration: readSkillValue('ult', 'knockup'), value: 0 },
        { kind: 'slow', duration: readSkillValue('ult', 'zoneDur'), value: readSkillValue('ult', 'slow') },
      ],
      // kind='leap' 让通用 handler 用跳跃原语飞到目标区域，落地做 AOE + 减速区。
      mobility: { kind: 'leap', distance: range('ult'), duration: readSkillValue('ult', 'leapTime'), wallBlocked: false, stopsAtHero: false, destination: 'aim' },
      duration: readSkillValue('ult', 'zoneDur'),
      delay: readSkillValue('ult', 'leapTime'),
      dodgeable: false,
    }),
  }
}

export const xiangyuBundle = defineHeroBundle({
  id: 'xiangyu',
  data: xiangyu,

  model: { key: 'hero:xiangyu' },

  visual: {
    palette: { glow: 16747196, hot: 16756280, deep: 11609162, accent: 16431971, dark: 2365480 },
    portrait: [-0.42, 0.46],
    scale: 1.03,
    cast: { cast_s1: ['dash', 0.62], cast_s2: ['cast_s2', 1.25], cast_ult: ['cast_ult', 1.1] },
    hit: { drop: 0.28, dist: 3.4, yaw: -16, x: 0.02 },
    ability: { survive: 8.4, damage: 6.6, control: 8.2, mobility: 6.4, ease: 6.8 },
    tactics: { fleeHp: 0.24, recallHp: 0.35, engage: 0.88, initiator: true, diveBackline: 0.35, support: false },
    skillMap: { cast_s1: 's1', dash: 's1', cast_s2: 's2', cast_ult: 'ult' },
    speed: 1.15,
    skillOrder: ['ult', 's1', 's2'],
    icons,
    iconBg: {
      passive: ICON_BG, s1: ['#3b2320', '#7d2b25', '#150c0a'],
      s2: ['#33262a', '#6d3a2e', '#120c0b'], ult: ['#2a1a18', '#8a3520', '#150b09'],
    },
  },

  combat,

  audio: {
    swingEvent: 'atk_xiangyu_swing',
    hitEvent: 'atk_xiangyu_hit',
    sounds: [
      {
        name: 'atk_xiangyu_swing', group: '英雄普攻', label: '项羽·戟风',
        build: (soundBuilder) => {
          soundBuilder.noise({ k: 'brown', flt: 'lowpass', fc: 420, a: 0.05, d: 0.2, g: 0.45 })
          soundBuilder.noise({ flt: 'bandpass', fc: 1500, fc1: 700, q: 1.1, a: 0.006, d: 0.16, g: 0.4 })
          soundBuilder.osc({ f: 74, f1: 44, a: 0.05, d: 0.16, g: 0.22 })
        },
        mix: { loud: -22, len: 0.5, gap: 0.1, rev: 0.08 },
      },
      {
        name: 'atk_xiangyu_hit', group: '英雄普攻', label: '项羽·戟刃入肉',
        build: (builder) => {
          const driveResult = builder.drive(3)
          builder.osc({ f: 96, f1: 34, ft: 0.09, a: 0.002, d: 0.32, g: 0.6, to: driveResult })
          builder.osc({ w: 'triangle', f: 210, f1: 90, ft: 0.05, a: 0.001, d: 0.14, g: 0.45, to: driveResult })
          builder.noise({ flt: 'highpass', fc: 3200, a: 0.001, d: 0.01, g: 0.35 })
          builder.noise({ flt: 'bandpass', fc: 900, q: 0.7, a: 0.002, d: 0.1, g: 0.55 })
          builder.ring(480, [1, 1.41, 2.13], { a: 0.003, d: 0.22, g: 0.26 })
        },
        mix: { loud: -14, len: 0.6, gap: 0.07, rev: 0.12 },
      },
      {
        name: 'cast_xiangyu_s1', group: '技能释放', label: '项羽·破釜冲锋',
        build: (soundBuilder) => {
          soundBuilder.noise({ k: 'pink', flt: 'bandpass', fc: 600, fc1: 2400, q: 0.9, a: 0.06, d: 0.3, g: 0.5 })
          soundBuilder.osc({ f: 110, f1: 58, a: 0.04, d: 0.26, g: 0.4 })
          soundBuilder.scatter(4, 0.03, 0.16, (grainTime: number) => soundBuilder.noise({ flt: 'highpass', fc: soundBuilder.rr(2200, 5200), t: grainTime, a: 0.001, d: 0.02, g: 0.16 }))
        },
        mix: { loud: -18, len: 0.8, rev: 0.16 },
      },
      {
        name: 'cast_xiangyu_s2', group: '技能释放', label: '项羽·霸王怒吼',
        build: (soundBuilder) => {
          soundBuilder.osc({ w: 'sawtooth', f: 78, f1: 62, a: 0.12, d: 0.4, g: 0.4 })
          soundBuilder.noise({ k: 'brown', flt: 'lowpass', fc: 380, a: 0.14, d: 0.42, g: 0.42 })
          soundBuilder.noise({ flt: 'bandpass', fc: 1100, q: 1.6, a: 0.1, d: 0.36, g: 0.25 })
          soundBuilder.ring(300, [1, 1.5], { a: 0.05, d: 0.5, g: 0.2 })
        },
        mix: { loud: -16, len: 1.1, rev: 0.22 },
      },
      {
        name: 'cast_xiangyu_ult', group: '技能释放', label: '项羽·垓下落地',
        build: (soundBuilder) => {
          const driveBus = soundBuilder.drive(2)
          soundBuilder.osc({ f: 52, f1: 26, ft: 0.4, a: 0.02, d: 0.9, g: 0.75, to: driveBus })
          soundBuilder.noise({ k: 'brown', flt: 'lowpass', fc: 900, fc1: 220, a: 0.01, d: 0.7, g: 0.7 })
          soundBuilder.noise({ flt: 'highpass', fc: 2600, a: 0.001, d: 0.18, g: 0.3 })
          soundBuilder.scatter(6, 0.05, 0.5, (grainTime: number) => soundBuilder.noise({ flt: 'bandpass', fc: soundBuilder.rr(600, 2400), t: grainTime, a: 0.002, d: 0.06, g: 0.2 }))
        },
        mix: { loud: -10, len: 1.4, rev: 0.3 },
      },
    ],
  },
})
