/**
 * 音效事件表（原 kernel 内 FS 对象，逐字符搬运）
 * 依赖的合成工具从内核注入，模块本身不 import 内核，避免循环依赖。
 * 追加/替换音效：直接改这里，或用 extensions/api 的 registerSound 运行时注入。
 */
import type { SoundKit } from './types'

/**
 * 创建音效。
 *
 * @param soundKit - 来源
 * @returns 结果对象
 */
export function buildSoundBank(soundKit: SoundKit): Record<string, unknown> {
  const { At: defineSfxCue, Ti: playNoiseSweep, Hc: playDrumHit, Qm: noteE6Frequency, Ey: melodyNoteFrequencies, Si: playPluckedString, Ay: noteB6Frequency, c5: playMonsterGrowl, Od: playPluckLead, El: playSlashHiss, th: playImpactTick, Tl: glassPartials, i1: bellPartials, Fc: playDistortedBoom, ga: chimePartials, CS: metalPartials, It: midiToFrequency } = soundKit as any
  return {
    atk_panyue_swing: defineSfxCue(
      "英雄普攻",
      "樊哙·挥剑带盾",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.22, 0.4, 260, 1300, 500, 1.3, "pink"),
          soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 260, a: 0.08, d: 0.14, g: 0.5 }),
          soundBuilder.ring(1100, [1, 2.76], { t: 0.06, a: 0.001, d: 0.04, g: 0.05 }))
      },
      { loud: -27, len: 0.4, gap: 0.12, rev: 0.06 },
    ),
    atk_panyue_hit: defineSfxCue(
      "英雄普攻",
      "樊哙·剑盾命中",
      (builder) => {
        const driveResult = builder.drive(2.5)
        ;(builder.osc({ f: 118, f1: 40, ft: 0.1, a: 0.002, d: 0.28, g: 0.55, to: driveResult }),
          builder.osc({ w: "triangle", f: 260, f1: 120, ft: 0.06, a: 0.001, d: 0.12, g: 0.5, to: driveResult }),
          builder.noise({ flt: "highpass", fc: 2800, a: 0.001, d: 0.012, g: 0.3 }),
          builder.noise({ flt: "bandpass", fc: 1300, q: 0.8, a: 0.001, d: 0.08, g: 0.6, to: driveResult }),
          builder.noise({ k: "pink", flt: "bandpass", fc: 520, q: 1.4, a: 0.001, d: 0.05, g: 0.7 }),
          builder.ring(620, [1, 1.52, 2.27], { a: 0.002, d: 0.24, g: 0.3 }))
      },
      { loud: -16, len: 0.55, gap: 0.08, rev: 0.14 },
    ),
    atk_chijin_swing: defineSfxCue(
      "英雄普攻",
      "程咬金·抡斧",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.24, 0.5, 300, 1500, 480, 1.2), soundBuilder.osc({ f: 92, f1: 70, a: 0.06, d: 0.14, g: 0.2 }))
      },
      { loud: -27, len: 0.35, gap: 0.1, rev: 0.06 },
    ),
    atk_chijin_hit: defineSfxCue(
      "英雄普攻",
      "程咬金·斧劈命中",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(2)
        ;(soundBuilder.osc({ w: "triangle", f: 170, f1: 60, a: 0.002, d: 0.14, g: 0.4, to: driveBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 1800, q: 0.9, a: 0.001, d: 0.05, g: 0.6, to: driveBus }),
          playDrumHit(soundBuilder, 430, 0, 0.9, 0.22),
          soundBuilder.noise({ flt: "highpass", fc: 4500, a: 0.001, d: 0.01, g: 0.3 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 1e3, fc1: 450, q: 0.8, a: 0.01, d: 0.14, g: 0.25 }))
      },
      { loud: -17, len: 0.45, gap: 0.07 },
    ),
    atk_xingli_charge: defineSfxCue(
      "英雄普攻",
      "王昭君·按弦",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 2600, fc1: 3800, q: 3, a: 0.04, d: 0.08, g: 0.3 }), soundBuilder.osc({ w: "string", f: noteE6Frequency, a: 0.03, d: 0.1, g: 0.2 }))
      },
      { loud: -30, len: 0.3, gap: 0.12, jitter: 0 },
    ),
    atk_xingli_launch: defineSfxCue(
      "英雄普攻",
      "王昭君·扫弦出手",
      (soundBuilder, variant) => {
        const selectedEy = melodyNoteFrequencies[Math.max(0, Math.round(variant)) % melodyNoteFrequencies.length]
        ;(playPluckedString(soundBuilder, selectedEy, 0, 0.28, 1), soundBuilder.noise({ flt: "bandpass", fc: 2200, fc1: 4200, q: 2, a: 0.01, d: 0.1, g: 0.18 }), soundBuilder.osc({ f: 300, f1: 170, a: 0.002, d: 0.06, g: 0.2 }))
      },
      {
        loud: -21,
        len: 0.4,
        gap: 0.07,
        rev: 0.18,
        jitter: 0,
        variants: [
          { label: "乐句第 1 音", v: 0 },
          { label: "乐句第 5 音", v: 4 },
        ],
      },
    ),
    atk_xingli_hit: defineSfxCue(
      "英雄普攻",
      "王昭君·音波命中",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "string", f: noteE6Frequency, a: 0.001, d: 0.3, g: 0.8 }),
          soundBuilder.osc({ f: noteB6Frequency, t: 0.01, a: 0.001, d: 0.22, g: 0.14 }),
          soundBuilder.noise({ flt: "bandpass", fc: 4200, q: 1, a: 0.001, d: 0.05, g: 0.4 }),
          soundBuilder.osc({ f: 240, f1: 130, a: 0.002, d: 0.08, g: 0.3 }))
      },
      { loud: -18, len: 0.5, gap: 0.07, rev: 0.22, jitter: 0 },
    ),
    atk_fengling_draw: defineSfxCue(
      "英雄普攻",
      "李广·引弓",
      (soundBuilder) => {
        playMonsterGrowl(soundBuilder, 0, 0.14, 0.6)
      },
      { loud: -31, len: 0.3, gap: 0.12, rev: 0.05 },
    ),
    atk_fengling_launch: defineSfxCue(
      "英雄普攻",
      "李广·放箭",
      (soundBuilder) => {
        ;(playPluckLead(soundBuilder, 196, 0, 0.2, 1), playSlashHiss(soundBuilder, 0.008, 0.16, 0.5, 3600, 2e3), soundBuilder.noise({ flt: "highpass", fc: 2500, a: 0.001, d: 0.008, g: 0.3 }))
      },
      { loud: -20, len: 0.4, gap: 0.07, rev: 0.1 },
    ),
    atk_fengling_hit: defineSfxCue(
      "英雄普攻",
      "李广·箭矢命中",
      (soundBuilder) => {
        const distortionBus = soundBuilder.drive(2)
        ;(playImpactTick(soundBuilder, 0, 1.1, 1, distortionBus), soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 700, a: 0.003, d: 0.07, g: 0.3, to: distortionBus }), soundBuilder.osc({ w: "triangle", f: 188, a: 0.004, d: 0.14, g: 0.16, vib: 90, vr: 38, vd: 0 }))
      },
      { loud: -18, len: 0.3, gap: 0.07 },
    ),
    atk_yeque_swing: defineSfxCue(
      "英雄普攻",
      "荆轲·匕首划刺",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 1500, fc1: 4200, fct: 0.05, q: 4, a: 0.015, d: 0.045, g: 0.8 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1800, fc1: 4800, fct: 0.05, q: 4, t: 0.07, a: 0.015, d: 0.045, g: 0.65 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 500, q: 1.5, a: 0.02, d: 0.1, g: 0.12 }))
      },
      { loud: -27, len: 0.3, gap: 0.1, rev: 0.06 },
    ),
    atk_yeque_hit: defineSfxCue(
      "英雄普攻",
      "荆轲·匕首命中",
      (soundBuilder) => {
        const distortionBus = soundBuilder.drive(2)
        ;(soundBuilder.noise({ flt: "highpass", fc: 3600, a: 0.001, d: 0.02, g: 0.5 }),
          soundBuilder.ring(3100, glassPartials, { a: 0.001, d: 0.15, g: 0.14 }),
          soundBuilder.osc({ w: "triangle", f: 280, f1: 100, a: 0.001, d: 0.065, g: 0.4, to: distortionBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 3200, q: 2, a: 0.001, d: 0.04, g: 0.4, to: distortionBus }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 1, a: 0.008, d: 0.12, g: 0.18 }))
      },
      { loud: -17, len: 0.35, gap: 0.06 },
    ),
    minion_swing: defineSfxCue(
      "小兵与野怪",
      "小兵·挥击",
      (soundBuilder) => {
        soundBuilder.noise({ flt: "bandpass", fc: 900, fc1: 2200, q: 2, a: 0.03, d: 0.06, g: 0.5 })
      },
      { loud: -34, len: 0.2, gap: 0.16, poly: 2, prio: 0, rev: 0.04, jitter: 0.08 },
    ),
    minion_melee_hit: defineSfxCue(
      "小兵与野怪",
      "近战兵·命中",
      (soundBuilder) => {
        ;(soundBuilder.ring(880, [1, 2.4, 3.9], { a: 0.001, d: 0.07, g: 0.14 }), soundBuilder.noise({ flt: "bandpass", fc: 2200, q: 1.2, a: 0.001, d: 0.03, g: 0.4 }), soundBuilder.osc({ f: 180, f1: 105, a: 0.001, d: 0.055, g: 0.4 }))
      },
      { loud: -26, len: 0.2, gap: 0.11, poly: 3, prio: 0, jitter: 0.1, rev: 0.06 },
    ),
    minion_ranged_launch: defineSfxCue(
      "小兵与野怪",
      "远程兵·能量弹出手",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 1150, f1: 500, a: 0.002, d: 0.09, g: 0.4 }),
          soundBuilder.osc({ w: "triangle", f: 2300, f1: 1e3, a: 0.002, d: 0.06, g: 0.12 }),
          soundBuilder.noise({ flt: "highpass", fc: 5e3, a: 0.001, d: 0.02, g: 0.1 }))
      },
      { loud: -29, len: 0.2, gap: 0.12, poly: 2, prio: 0, jitter: 0.08, rev: 0.08 },
    ),
    minion_ranged_hit: defineSfxCue(
      "小兵与野怪",
      "远程兵·能量弹命中",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 3e3, q: 2, a: 0.001, d: 0.04, g: 0.5 }), soundBuilder.osc({ f: 520, f1: 300, a: 0.001, d: 0.05, g: 0.3 }))
      },
      { loud: -28, len: 0.2, gap: 0.11, poly: 2, prio: 0, jitter: 0.1, rev: 0.08 },
    ),
    minion_siege_launch: defineSfxCue(
      "小兵与野怪",
      "攻城兵·开炮",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 165, f1: 50, a: 0.002, d: 0.22, g: 0.7 }),
          soundBuilder.osc({ w: "triangle", f: 330, f1: 110, a: 0.001, d: 0.1, g: 0.4 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 600, q: 0.7, a: 0.002, d: 0.13, g: 0.5 }),
          soundBuilder.noise({ flt: "highpass", fc: 2e3, a: 0.001, d: 0.03, g: 0.25 }))
      },
      { loud: -22, len: 0.4, gap: 0.15, poly: 2, rev: 0.12 },
    ),
    minion_siege_hit: defineSfxCue(
      "小兵与野怪",
      "攻城兵·炮弹爆炸",
      (soundBuilder) => {
        ;(soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2200, fc1: 300, a: 0.002, d: 0.32, g: 0.8 }),
          soundBuilder.osc({ f: 92, f1: 40, a: 0.002, d: 0.26, g: 0.6 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1800, q: 0.7, a: 0.001, d: 0.05, g: 0.6 }))
      },
      { loud: -20, len: 0.5, gap: 0.15, poly: 2, rev: 0.16 },
    ),
    super_hit: defineSfxCue(
      "小兵与野怪",
      "超级兵·重击",
      (soundBuilder) => {
        ;(soundBuilder.ring(520, bellPartials, { a: 0.001, d: 0.16, g: 0.14 }), soundBuilder.noise({ flt: "bandpass", fc: 1600, q: 1, a: 0.001, d: 0.05, g: 0.5 }), soundBuilder.osc({ f: 140, f1: 60, a: 0.001, d: 0.14, g: 0.8 }))
      },
      { loud: -21, len: 0.35, gap: 0.12, poly: 2, jitter: 0.06 },
    ),
    monster_swing: defineSfxCue(
      "小兵与野怪",
      "野怪·出手",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(0.41, (subBuilder) => {
              ;(playDistortedBoom(subBuilder, 0, 0.16, 0.6, 150, 105, 500, 1300), subBuilder.noise({ flt: "bandpass", fc: 900, fc1: 2400, q: 2, t: 0.03, a: 0.03, d: 0.07, g: 0.5 }))
            })
          : variant < 1.5
            ? soundBuilder.sub(1, (subBuilder) => {
                ;(playNoiseSweep(subBuilder, 0, 0.2, 0.4, 500, 2200, 900, 1.2),
                  subBuilder.noise({ k: "pink", flt: "bandpass", fc: 420, q: 1.5, a: 0.02, d: 0.09, g: 0.5 }),
                  subBuilder.ring(3300, chimePartials, { t: 0.05, a: 0.001, d: 0.12, g: 0.06 }))
              })
            : variant < 2.5
              ? soundBuilder.sub(0.52, (subBuilder) => {
                  ;(playDistortedBoom(subBuilder, 0, 0.24, 0.7, 92, 66, 380, 1e3), playNoiseSweep(subBuilder, 0.02, 0.2, 0.3, 200, 900, 400, 1, "pink"))
                })
              : variant < 3.5
                ? soundBuilder.sub(0.36, (subBuilder) => {
                    ;(subBuilder.noise({ flt: "bandpass", fc: 1200, fc1: 3200, q: 2.5, a: 0.1, d: 0.1, g: 0.7 }), playDistortedBoom(subBuilder, 0, 0.26, 0.6, 70, 52, 300, 800))
                  })
                : soundBuilder.sub(0.77, (subBuilder) => {
                    ;(playNoiseSweep(subBuilder, 0, 0.3, 0.5, 110, 520, 200, 0.9, "brown"),
                      subBuilder.osc({ w: "softsaw", f: 55, f1: 82, a: 0.12, d: 0.16, g: 0.3, to: subBuilder.filt("lowpass", 300, 1) }),
                      subBuilder.ring(310, bellPartials, { t: 0.02, a: 0.02, d: 0.2, g: 0.06 }))
                  })
      },
      {
        loud: -27,
        len: 0.4,
        gap: 0.14,
        poly: 2,
        jitter: 0.08,
        variants: [
          { label: "苔背獾", v: 0 },
          { label: "霜晶巨鹿", v: 1 },
          { label: "炽焰巨熊", v: 2 },
          { label: "河道巨龙", v: 3 },
          { label: "星陨巨灵", v: 4 },
        ],
      },
    ),
    monster_hit: defineSfxCue(
      "小兵与野怪",
      "野怪·命中",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(0.7, (subBuilder) => {
              ;(subBuilder.noise({ flt: "bandpass", fc: 1600, q: 1, a: 0.001, d: 0.06, g: 0.6 }),
                subBuilder.noise({ flt: "bandpass", fc: 2600, q: 2, t: 0.02, a: 0.001, d: 0.04, g: 0.4 }),
                subBuilder.osc({ f: 145, f1: 60, a: 0.002, d: 0.12, g: 0.5 }))
            })
          : variant < 1.5
            ? soundBuilder.sub(1, (subBuilder) => {
                ;(subBuilder.osc({ f: 150, f1: 60, a: 0.002, d: 0.14, g: 0.45 }),
                  subBuilder.noise({ flt: "bandpass", fc: 2400, q: 1.2, a: 0.001, d: 0.04, g: 0.6 }),
                  subBuilder.scatter(4, 0.01, 0.14, (scatterTime) => subBuilder.ring(subBuilder.rr(2600, 5200), chimePartials, { t: scatterTime, a: 0.001, d: subBuilder.rr(0.05, 0.12), g: 0.07 })))
              })
            : soundBuilder.sub(0.44, (subBuilder) => {
                const distortionBus = subBuilder.drive(2)
                ;(subBuilder.osc({ f: 120, f1: 44, a: 0.002, d: 0.2, g: 0.55, to: distortionBus }),
                  subBuilder.noise({ k: "pink", flt: "lowpass", fc: 1500, fc1: 300, a: 0.002, d: 0.14, g: 0.6, to: distortionBus }),
                  subBuilder.noise({ flt: "bandpass", fc: 1400, q: 0.8, a: 0.001, d: 0.06, g: 0.7 }),
                  subBuilder.scatter(4, 0.02, 0.16, (scatterTime) => subBuilder.noise({ flt: "highpass", fc: subBuilder.rr(3e3, 6e3), t: scatterTime, a: 0.001, d: 0.012, g: 0.2 })))
              })
      },
      {
        loud: -21,
        len: 0.35,
        gap: 0.1,
        poly: 2,
        jitter: 0.08,
        variants: [
          { label: "苔背獾", v: 0 },
          { label: "霜晶巨鹿", v: 1 },
          { label: "炽焰巨熊", v: 2 },
        ],
      },
    ),
    monster_spit_launch: defineSfxCue(
      "小兵与野怪",
      "荧翅蛾·抖出磷粉",
      (soundBuilder) => {
        const gainResult = soundBuilder.gain(0.6)
        ;(soundBuilder.lfo(gainResult.gain, 28, 0.4, 0, 0.2),
          soundBuilder.noise({ flt: "bandpass", fc: 700, fc1: 1500, q: 1.5, a: 0.02, d: 0.12, g: 0.8, to: gainResult }),
          soundBuilder.noise({ flt: "bandpass", fc: 2600, fc1: 4200, q: 2, t: 0.03, a: 0.01, d: 0.06, g: 0.35 }),
          soundBuilder.osc({ f: 1700, f1: 2300, t: 0.03, a: 0.005, d: 0.07, g: 0.06 }))
      },
      { loud: -26, len: 0.25, gap: 0.12, poly: 2, jitter: 0.08 },
    ),
    monster_spit_hit: defineSfxCue(
      "小兵与野怪",
      "荧翅蛾·磷粉命中",
      (soundBuilder) => {
        ;(soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2600, fc1: 500, a: 0.001, d: 0.11, g: 0.7 }),
          soundBuilder.osc({ f: 300, f1: 130, a: 0.001, d: 0.07, g: 0.35 }),
          soundBuilder.osc({ f: 2400, t: 0.01, a: 0.001, d: 0.05, g: 0.06 }),
          soundBuilder.osc({ f: 3200, t: 0.04, a: 0.001, d: 0.05, g: 0.05 }))
      },
      { loud: -24, len: 0.25, gap: 0.1, poly: 2, jitter: 0.08 },
    ),
    epic_hit: defineSfxCue(
      "小兵与野怪",
      "史诗野怪·重击",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(1, (subBuilder) => {
              const distortionBus = subBuilder.drive(2.5, subBuilder.gain(0.55))
              ;(subBuilder.osc({ f: 80, f1: 30, a: 0.003, d: 0.5, g: 0.8, to: distortionBus }),
                subBuilder.osc({ w: "triangle", f: 230, f1: 70, a: 0.002, d: 0.18, g: 0.5, to: distortionBus }),
                subBuilder.noise({ flt: "bandpass", fc: 2200, q: 1.2, a: 0.001, d: 0.03, g: 0.9 }),
                subBuilder.noise({ k: "pink", flt: "bandpass", fc: 900, q: 0.8, a: 0.002, d: 0.14, g: 1 }),
                subBuilder.noise({ k: "pink", flt: "lowpass", fc: 1500, fc1: 220, a: 0.003, d: 0.36, g: 0.6, to: distortionBus }),
                subBuilder.noise({ flt: "bandpass", fc: 3e3, fc1: 1500, q: 0.9, t: 0.03, a: 0.02, d: 0.3, g: 0.35 }))
            })
          : soundBuilder.sub(0.85, (subBuilder) => {
              const distortionBus = subBuilder.drive(2.5, subBuilder.gain(0.55))
              ;(subBuilder.osc({ f: 66, f1: 26, a: 0.003, d: 0.6, g: 0.8, to: distortionBus }),
                subBuilder.osc({ w: "triangle", f: 200, f1: 60, a: 0.002, d: 0.22, g: 0.5, to: distortionBus }),
                subBuilder.noise({ k: "pink", flt: "lowpass", fc: 1300, fc1: 180, a: 0.003, d: 0.45, g: 0.7, to: distortionBus }),
                subBuilder.noise({ flt: "bandpass", fc: 1200, q: 0.7, a: 0.001, d: 0.07, g: 0.8 }),
                subBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 0.8, a: 0.002, d: 0.16, g: 1 }),
                subBuilder.ring(330, bellPartials, { a: 0.002, d: 0.4, g: 0.25 }),
                subBuilder.scatter(4, 0.06, 0.3, (scatterTime) => subBuilder.noise({ flt: "bandpass", fc: subBuilder.rr(350, 1100), q: 2, t: scatterTime, a: 0.001, d: subBuilder.rr(0.04, 0.09), g: subBuilder.rr(0.2, 0.35) })))
            })
      },
      {
        loud: -15,
        len: 0.8,
        gap: 0.15,
        poly: 2,
        rev: 0.22,
        variants: [
          { label: "河道巨龙", v: 0 },
          { label: "星陨巨灵", v: 1 },
        ],
      },
    ),
    monster_spawn: defineSfxCue(
      "小兵与野怪",
      "野怪·刷新",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(0.89, (subBuilder) => {
              ;(subBuilder.scatter(5, 0, 0.4, (scatterTime) => subBuilder.noise({ k: "pink", flt: "bandpass", fc: subBuilder.rr(500, 1300), q: 1.5, t: scatterTime, a: 0.004, d: subBuilder.rr(0.04, 0.08), g: subBuilder.rr(0.3, 0.6) })),
                [0.5, 0.66].forEach((strikeTime) => subBuilder.noise({ flt: "bandpass", fc: 1700, q: 3, t: strikeTime, a: 0.02, d: 0.05, g: 0.3 })),
                playDistortedBoom(subBuilder, 0.78, 0.18, 0.4, 170, 120, 500, 1200))
            })
          : variant < 1.5
            ? soundBuilder.sub(1, (subBuilder) => {
                ;(subBuilder.scatter(8, 0, 0.5, (scatterTime) => subBuilder.ring(subBuilder.rr(2400, 5600), chimePartials, { t: scatterTime, a: 0.001, d: subBuilder.rr(0.05, 0.14), g: 0.06 })), subBuilder.noise({ flt: "highpass", fc: 5e3, a: 0.3, d: 0.4, g: 0.05 }))
                const filtResult = subBuilder.filt("bandpass", 900, 2.5)
                ;(subBuilder.osc({ w: "reed", f: 233, f1: 349, ft: 0.35, t: 0.5, a: 0.1, h: 0.3, d: 0.35, g: 0.5, vib: 25, vr: 6, vd: 0.2, to: filtResult }),
                  subBuilder.osc({ w: "softsaw", f: 233, f1: 349, ft: 0.35, t: 0.5, a: 0.12, h: 0.28, d: 0.3, g: 0.2, to: filtResult }))
              })
            : variant < 2.5
              ? soundBuilder.sub(0.55, (subBuilder) => {
                  ;(subBuilder.scatter(6, 0, 0.45, (scatterTime) => subBuilder.noise({ flt: "bandpass", fc: subBuilder.rr(300, 1e3), q: 2, t: scatterTime, a: 0.001, d: subBuilder.rr(0.05, 0.1), g: subBuilder.rr(0.3, 0.5) })),
                    subBuilder.noise({ k: "brown", flt: "lowpass", fc: 260, a: 0.2, d: 0.4, g: 0.6 }),
                    playDistortedBoom(subBuilder, 0.5, 0.6, 0.9, 105, 70, 350, 1300))
                })
              : soundBuilder.sub(0.64, (subBuilder) => {
                  const tremoloGain = subBuilder.gain(0.6)
                  ;(subBuilder.lfo(tremoloGain.gain, 9, 0.4, 0, 0.9, 14),
                    subBuilder.noise({ flt: "bandpass", fc: 900, fc1: 1600, q: 1.5, a: 0.5, d: 0.3, g: 0.7, to: tremoloGain }),
                    [0.3, 0.5, 0.66].forEach((strikeTime, noteIndex) => subBuilder.osc({ f: 2100 + noteIndex * 350, t: strikeTime, a: 0.004, d: 0.1, g: 0.05 })))
                })
      },
      {
        loud: -25,
        len: 1.2,
        gap: 0.3,
        poly: 2,
        prio: 0,
        jitter: 0.04,
        rev: 0.2,
        range: 22,
        variants: [
          { label: "苔背獾", v: 0 },
          { label: "霜晶巨鹿", v: 1 },
          { label: "炽焰巨熊", v: 2 },
          { label: "荧翅蛾", v: 5 },
        ],
      },
    ),
    tower_charge: defineSfxCue(
      "防御塔",
      "防御塔·核心蓄光",
      (soundBuilder) => {
        const lowpassFilter = soundBuilder.filt("lowpass", 900, 1)
        ;(soundBuilder.osc({ w: "softsaw", f: 110, f1: 220, a: 0.24, d: 0.08, g: 0.5, to: lowpassFilter }),
          soundBuilder.osc({ f: 660, f1: 990, a: 0.24, d: 0.06, g: 0.15 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1500, fc1: 4e3, q: 3, a: 0.24, d: 0.05, g: 0.1 }))
      },
      { loud: -29, len: 0.4, gap: 0.2, poly: 2, rev: 0.1 },
    ),
    tower_launch: defineSfxCue(
      "防御塔",
      "防御塔·光弹出膛",
      (soundBuilder) => {
        ;(soundBuilder.fm({ f: 520, f1: 180, ft: 0.25, ratio: 1.5, idx: 4, idx1: 0.5, a: 0.002, d: 0.3, g: 0.6 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1200, fc1: 400, q: 1.2, a: 0.002, d: 0.2, g: 0.4 }),
          soundBuilder.osc({ f: 82, a: 0.002, d: 0.16, g: 0.5 }),
          soundBuilder.ring(1760, chimePartials, { a: 0.002, d: 0.26, g: 0.06 }))
      },
      { loud: -20, len: 0.5, gap: 0.12, poly: 3, rev: 0.18 },
    ),
    tower_hit: defineSfxCue(
      "防御塔",
      "防御塔·光弹命中",
      (soundBuilder) => {
        ;(soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 3e3, fc1: 300, a: 0.001, d: 0.2, g: 0.8 }),
          soundBuilder.osc({ f: 150, f1: 50, a: 0.002, d: 0.2, g: 0.5 }),
          soundBuilder.fm({ f: 660, f1: 220, ratio: 1.5, idx: 3, idx1: 0.3, a: 0.002, d: 0.14, g: 0.3 }),
          soundBuilder.ring(880, chimePartials, { a: 0.001, d: 0.2, g: 0.16 }),
          soundBuilder.noise({ flt: "highpass", fc: 3500, a: 0.001, d: 0.012, g: 0.4 }))
      },
      { loud: -19, len: 0.45, gap: 0.1, poly: 3, group: "towerhit", rev: 0.18 },
    ),
    tower_hit_player: defineSfxCue(
      "防御塔",
      "防御塔·命中玩家(加重)",
      (soundBuilder) => {
        const distortionBus = soundBuilder.drive(3)
        ;(soundBuilder.osc({ f: 64, f1: 30, a: 0.003, d: 0.42, g: 0.8, to: distortionBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 3200, fc1: 250, a: 0.001, d: 0.26, g: 0.9, to: distortionBus }),
          soundBuilder.osc({ w: "triangle", f: 200, f1: 60, a: 0.002, d: 0.2, g: 0.5 }),
          soundBuilder.fm({ f: 660, f1: 180, ratio: 1.5, idx: 4, idx1: 0.3, a: 0.002, d: 0.2, g: 0.4 }),
          soundBuilder.ring(880, chimePartials, { a: 0.001, d: 0.3, g: 0.16 }))
        const filterNode = soundBuilder.filt("lowpass", 1800, 1)
        ;(soundBuilder.osc({ w: "softsq", f: 740, a: 0.003, d: 0.14, g: 0.22, to: filterNode }), soundBuilder.osc({ w: "softsq", f: 698, a: 0.003, d: 0.16, g: 0.22, to: filterNode }))
      },
      { loud: -14, len: 0.7, gap: 0.12, poly: 2, prio: 3, group: "towerhit", rev: 0.2 },
    ),
    fx_hit_physical: defineSfxCue(
      "通用命中",
      "物理命中火花",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "highpass", fc: 3500, a: 0.001, d: 0.03, g: 0.5 }), soundBuilder.ring(2600, [1, 1.5], { a: 0.001, d: 0.05, g: 0.07 }), soundBuilder.osc({ f: 220, f1: 120, a: 0.001, d: 0.04, g: 0.35 }))
      },
      { loud: -27, len: 0.2, gap: 0.09, poly: 3, prio: 0, jitter: 0.1, rev: 0.06 },
    ),
    fx_hit_magic: defineSfxCue(
      "通用命中",
      "法术命中星屑",
      (soundBuilder) => {
        ;(soundBuilder.fm({ f: 1900, ratio: 2.7, idx: 1.5, idx1: 0.1, a: 0.001, d: 0.14, g: 0.3 }),
          soundBuilder.noise({ flt: "bandpass", fc: 6e3, q: 1.5, a: 0.001, d: 0.06, g: 0.3 }),
          soundBuilder.osc({ f: 400, f1: 250, a: 0.001, d: 0.05, g: 0.25 }))
      },
      { loud: -27, len: 0.25, gap: 0.09, poly: 3, prio: 0, jitter: 0.1, rev: 0.14 },
    ),
    fx_hit_crit: defineSfxCue(
      "通用命中",
      "暴击重击",
      (soundBuilder) => {
        const distortionBus = soundBuilder.drive(3)
        ;(soundBuilder.osc({ w: "triangle", f: 200, f1: 60, a: 0.002, d: 0.2, g: 0.6, to: distortionBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 2e3, q: 0.7, a: 0.001, d: 0.07, g: 0.8, to: distortionBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 5200, q: 2, a: 0.002, d: 0.1, g: 0.3 }),
          soundBuilder.ring(1800, metalPartials, { a: 0.001, d: 0.32, g: 0.22 }),
          soundBuilder.osc({ f: 1200, f1: 3200, a: 0.004, d: 0.09, g: 0.16 }))
      },
      { loud: -16, len: 0.5, gap: 0.09, poly: 2, prio: 2, rev: 0.2 },
    ),
    fx_hit_tower: defineSfxCue(
      "通用命中",
      "塔弹命中碎光",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 2500, q: 1, a: 0.001, d: 0.05, g: 0.6 }), soundBuilder.ring(1320, chimePartials, { a: 0.001, d: 0.16, g: 0.1 }), soundBuilder.osc({ f: 170, f1: 70, a: 0.002, d: 0.12, g: 0.6 }))
      },
      { loud: -23, len: 0.35, gap: 0.1, poly: 2, group: "towerhit", rev: 0.16 },
    ),
    xingli_s1_fly: defineSfxCue(
      "技能弹道",
      "一弦穿云·飞行",
      (soundBuilder) => {
        const filterNode = soundBuilder.filt("lowpass", 4200, 1)
        ;(soundBuilder.osc({ w: "string", f: midiToFrequency(76), a: 0.03, d: 0.42, g: 0.7, vib: 35, vr: 13, vd: 0, to: filterNode }),
          soundBuilder.osc({ w: "string", f: midiToFrequency(83), a: 0.04, d: 0.36, g: 0.35, vib: 35, vr: 13, vd: 0, to: filterNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 1400, fc1: 3600, q: 2, a: 0.04, d: 0.42, g: 0.4 }))
      },
      { loud: -26, len: 0.6, gap: 0.1, poly: 2, rev: 0.2, jitter: 0 },
    ),
    xingli_s1_hit: defineSfxCue(
      "技能弹道",
      "一弦穿云·贯穿命中",
      (soundBuilder) => {
        ;(playPluckedString(soundBuilder, noteE6Frequency, 0, 0.36, 0.9), playPluckedString(soundBuilder, noteB6Frequency, 0.02, 0.3, 0.5), soundBuilder.noise({ flt: "bandpass", fc: 4e3, q: 0.8, a: 0.001, d: 0.08, g: 0.5 }), soundBuilder.osc({ f: 210, f1: 80, a: 0.002, d: 0.14, g: 0.45 }))
      },
      { loud: -17, len: 0.6, gap: 0.07, rev: 0.24, jitter: 0 },
    ),
    fengling_s1_fly: defineSfxCue(
      "技能弹道",
      "白羽没石·破空",
      (soundBuilder) => {
        ;(playSlashHiss(soundBuilder, 0, 0.42, 0.9, 3e3, 1900), soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 0.8, a: 0.03, d: 0.3, g: 0.3 }))
      },
      { loud: -26, len: 0.55, gap: 0.1, poly: 2, rev: 0.12 },
    ),
    fengling_s1_hit: defineSfxCue(
      "技能弹道",
      "白羽没石·命中",
      (soundBuilder, variant) => {
        const distortionBus = soundBuilder.drive(2, soundBuilder.gain(0.7))
        ;(playImpactTick(soundBuilder, 0, 1.1, 0.85, distortionBus),
          soundBuilder.osc({ f: 230, f1: 110, a: 0.001, d: 0.1, g: 0.3, to: distortionBus }),
          soundBuilder.osc({ w: "triangle", f: 430, f1: 300, a: 0.001, d: 0.12, g: 0.5 }),
          soundBuilder.osc({ w: "triangle", f: 172, a: 0.004, d: 0.18, g: 0.2, vib: 90, vr: 38, vd: 0 }),
          variant > 0.5 &&
            (soundBuilder.noise({ flt: "highpass", fc: 1800, t: 0.004, a: 0.001, d: 0.02, g: 0.6 }),
            soundBuilder.noise({ flt: "bandpass", fc: 950, q: 1.2, t: 0.008, a: 0.001, d: 0.05, g: 0.55 }),
            soundBuilder.scatter(5, 0.03, 0.22, (scatterTime) => soundBuilder.noise({ flt: "bandpass", fc: soundBuilder.rr(1400, 3600), q: 3, t: scatterTime, a: 0.001, d: soundBuilder.rr(0.012, 0.03), g: soundBuilder.rr(0.2, 0.4) }))))
      },
      {
        loud: -17,
        len: 0.45,
        gap: 0.07,
        rev: 0.16,
        variants: [
          { label: "钉入", v: 0 },
          { label: "命中英雄(石裂)", v: 1 },
        ],
      },
    ),
    yeque_s2_fly: defineSfxCue(
      "技能弹道",
      "引匕一掷·飞行",
      (soundBuilder) => {
        ;(playSlashHiss(soundBuilder, 0, 0.36, 0.7, 3600, 3e3), soundBuilder.osc({ f: 5200, a: 0.02, d: 0.3, g: 0.02 }))
      },
      { loud: -27, len: 0.5, gap: 0.1, poly: 2, rev: 0.1 },
    ),
    yeque_s2_hit: defineSfxCue(
      "技能弹道",
      "引匕一掷·命中",
      (soundBuilder) => {
        ;(soundBuilder.ring(3300, glassPartials, { a: 0.001, d: 0.22, g: 0.22 }), soundBuilder.noise({ flt: "highpass", fc: 4500, a: 0.001, d: 0.01, g: 0.5 }))
        const distortionBus = soundBuilder.drive(2)
        ;(soundBuilder.osc({ w: "triangle", f: 250, f1: 95, a: 0.001, d: 0.08, g: 0.4, to: distortionBus }), soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 0.8, a: 0.005, d: 0.1, g: 0.2 }))
      },
      { loud: -18, len: 0.4, gap: 0.06, rev: 0.14 },
    ),
    proj_fizzle: defineSfxCue(
      "技能弹道",
      "弹道落空",
      (soundBuilder, variant) => {
        variant > 0.5
          ? soundBuilder.sub(0.85, (subBuilder) => {
              ;(playImpactTick(subBuilder, 0, 0.8, 1.2), subBuilder.ring(2900, glassPartials, { t: 0.004, a: 0.001, d: 0.12, g: 0.07 }))
            })
          : soundBuilder.sub(1, (subBuilder) => {
              ;(subBuilder.noise({ flt: "highpass", fc: 3e3, a: 0.01, d: 0.12, g: 0.4 }), subBuilder.osc({ f: 900, f1: 500, a: 0.005, d: 0.1, g: 0.2 }))
            })
      },
      {
        loud: -33,
        len: 0.25,
        gap: 0.1,
        poly: 2,
        prio: 0,
        rev: 0.14,
        variants: [
          { label: "消散", v: 0 },
          { label: "匕首钉地", v: 1 },
        ],
      },
    ),
  }
}
