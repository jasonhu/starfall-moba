/**
 * 从 starfall.core.js 抽出的模块
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { buildSoundBank } from '../../audio/definitions'
import { HERO_TABLE } from '../../heroes/registry'
import { midiToFrequency } from './audio-math'
import { METAL_PARTIALS, playSlashHiss, playDistortedBoom, playDrumHit, DRUM_PARTIALS, playReedCall, playPluckLead, playLowThud, playPluckedString, playNoiseSweep, GLASS_PARTIALS, playWarHorn, playBambooFlute, playStringNote, playMonsterGrowl, defineSfxCue, CHIME_PARTIALS, BELL_PARTIALS, playMetalClash, CRYSTAL_PARTIALS, playImpactTick, ANNOUNCE_CUES } from './sfx-primitives'
import { sfxFmImpact, sfxStringDraw, sfxSwingWhoosh } from './sfx-synth'
import { JUNGLE_RULES } from '../game-balance'

const SFX_BANK_MELODY_NOTE_FREQS = [76, 79, 81, 83, 86, 83, 81, 79].map(midiToFrequency),
  SFX_BANK_NOTE_E6_FREQ = midiToFrequency(88),
  SFX_BANK_NOTE_B6_FREQ = midiToFrequency(95),
  SFX_COMBAT_CUE_TABLE = buildSoundBank({
    // 键名即 `src/audio/definitions` 的解构契约，必须保持压缩名；值可自由语义化
    At: defineSfxCue, Ti: playNoiseSweep, Hc: playDrumHit, Qm: SFX_BANK_NOTE_E6_FREQ, Ey: SFX_BANK_MELODY_NOTE_FREQS, Si: playPluckedString, Ay: SFX_BANK_NOTE_B6_FREQ, c5: playMonsterGrowl, Od: playPluckLead, El: playSlashHiss,
    th: playImpactTick, Tl: GLASS_PARTIALS, i1: BELL_PARTIALS, Fc: playDistortedBoom, ga: CHIME_PARTIALS, CS: METAL_PARTIALS, It: midiToFrequency,
  });

const SFX_SKILL_NOTE_A3_FREQ = midiToFrequency(57),
  SFX_SKILL_NOTE_D4_FREQ = midiToFrequency(62),
  SFX_SKILL_NOTE_E4_FREQ = midiToFrequency(64),
  SFX_SKILL_NOTE_A4_FREQ = midiToFrequency(69),
  SFX_SKILL_NOTE_B4_FREQ = midiToFrequency(71),
  SFX_SKILL_NOTE_D5_FREQ = midiToFrequency(74),
  SFX_SKILL_NOTE_E5_FREQ = midiToFrequency(76),
  SFX_SKILL_NOTE_G5_FREQ = midiToFrequency(79),
  SFX_SKILL_NOTE_A5_FREQ = midiToFrequency(81),
  SFX_SKILL_NOTE_B5_FREQ = midiToFrequency(83),
  SFX_SKILL_NOTE_D6_FREQ = midiToFrequency(86),
  SFX_SKILL_NOTE_E6_FREQ = midiToFrequency(88),
  SFX_SKILL_NOTE_G6_FREQ = midiToFrequency(91),
  SFX_SKILL_NOTE_B6_FREQ = midiToFrequency(95),
  SFX_DRUM_HIT_NOTE_FREQS = [SFX_SKILL_NOTE_D4_FREQ, SFX_SKILL_NOTE_A4_FREQ, SFX_SKILL_NOTE_D5_FREQ]

function playRepeatedDrumHits(soundBuilder, hitCount) {
  for (let index = 0; index < hitCount; index++) playDrumHit(soundBuilder, SFX_DRUM_HIT_NOTE_FREQS[index], index * 0.105, 0.8 + index * 0.1, index === hitCount - 1 ? 0.32 : 0.2)
}

const SFX_METEOR_PLUCK_NOTE_FREQS = [SFX_SKILL_NOTE_B5_FREQ, SFX_SKILL_NOTE_D6_FREQ, SFX_SKILL_NOTE_E6_FREQ, SFX_SKILL_NOTE_G6_FREQ],
  CHIJIN_ULT_TICK_VALUE = HERO_TABLE.chijin.skills.ult.values.tick,
  CHIJIN_ULT_TICK_INTERVAL = typeof CHIJIN_ULT_TICK_VALUE == "number" && CHIJIN_ULT_TICK_VALUE > 0.05 ? CHIJIN_ULT_TICK_VALUE : 0.3,
  SFX_SKILL_CAST_OPTIONS = { loud: -21, len: 0.5, gap: 0.1, poly: 2, prio: 2, jitter: 0.01, rev: 0.16 },
  SFX_SKILL_EFFECT_OPTIONS = { loud: -16, len: 0.7, gap: 0.08, poly: 3, prio: 2, rev: 0.18 },
  SFX_AREA_AMBIENCE_OPTIONS = { loud: -24, gap: 0.2, poly: 2, prio: 1, jitter: 0.02, rev: 0.16 },
  SFX_NO_JITTER_OPTIONS = { jitter: 0 },
  SFX_SKILL_CAST_CUES = {
    cast_panyue_s1: defineSfxCue(
      "技能施放",
      "樊哙·侧盾闯帐",
      (soundBuilder) => {
        ;(playLowThud(soundBuilder, 0, 0.6, 1.15), playMetalClash(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0.005, 0.26, 0.9), playMetalClash(soundBuilder, SFX_SKILL_NOTE_A4_FREQ, 0.1, 0.36, 1))
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_panyue_s2: defineSfxCue(
      "技能施放",
      "樊哙·拥盾怒目",
      (soundBuilder) => {
        ;(playLowThud(soundBuilder, 0, 0.55, 1.1), playMetalClash(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0.005, 0.24, 0.8), playLowThud(soundBuilder, 0.12, 0.6, 0.82, 0.5), playMetalClash(soundBuilder, SFX_SKILL_NOTE_A3_FREQ, 0.125, 0.5, 1))
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_panyue_ult: defineSfxCue(
      "技能施放",
      "樊哙·跃盾砸阵",
      (soundBuilder) => {
        ;(playLowThud(soundBuilder, 0, 0.5, 0.9, 0.3),
          playLowThud(soundBuilder, 0.09, 0.55, 1.1, 0.3),
          playLowThud(soundBuilder, 0.18, 0.65, 1.35, 0.5),
          playMetalClash(soundBuilder, SFX_SKILL_NOTE_A3_FREQ, 0.005, 0.2, 0.5),
          playMetalClash(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0.185, 0.6, 1.1),
          soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 260, a: 0.3, d: 0.3, g: 0.5 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, len: 0.9, loud: -18 },
    ),
    cast_chijin_s1: defineSfxCue(
      "技能施放",
      "程咬金·拦腰一斧(一声)",
      (soundBuilder) => {
        ;(playRepeatedDrumHits(soundBuilder, 1), playNoiseSweep(soundBuilder, 0, 0.14, 0.25, 600, 2200, 900))
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_chijin_s2: defineSfxCue(
      "技能施放",
      "程咬金·半路杀出(两声)",
      (soundBuilder) => {
        playRepeatedDrumHits(soundBuilder, 2)
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_chijin_ult: defineSfxCue(
      "技能施放",
      "程咬金·抡圆了砍(三声)",
      (soundBuilder) => {
        ;(playRepeatedDrumHits(soundBuilder, 3), playNoiseSweep(soundBuilder, 0.05, 0.5, 0.4, 400, 1700, 900, 0.9, "pink"))
      },
      { ...SFX_SKILL_CAST_OPTIONS, len: 0.9, loud: -18 },
    ),
    cast_xingli_s1: defineSfxCue(
      "技能施放",
      "王昭君·一弦穿云",
      (soundBuilder) => {
        ;(playPluckedString(soundBuilder, SFX_SKILL_NOTE_E6_FREQ, 0, 0.16, 0.8), playPluckedString(soundBuilder, SFX_SKILL_NOTE_B6_FREQ, 0.045, 0.28, 1))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS, rev: 0.26 },
    ),
    cast_xingli_s2: defineSfxCue(
      "技能施放",
      "王昭君·回环收弦",
      (soundBuilder) => {
        ;(playPluckedString(soundBuilder, SFX_SKILL_NOTE_A5_FREQ, 0, 0.6, 1, SFX_SKILL_NOTE_B5_FREQ), playPluckedString(soundBuilder, SFX_SKILL_NOTE_E5_FREQ, 0.16, 0.4, 0.5))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS, len: 0.7, rev: 0.26 },
    ),
    cast_xingli_ult: defineSfxCue(
      "技能施放",
      "王昭君·雁落平沙",
      (soundBuilder) => {
        ;([SFX_SKILL_NOTE_E5_FREQ, SFX_SKILL_NOTE_B5_FREQ, SFX_SKILL_NOTE_E6_FREQ, SFX_SKILL_NOTE_G6_FREQ].forEach((noteFreq, noteIndex) => playPluckedString(soundBuilder, noteFreq, noteIndex * 0.07, noteIndex === 3 ? 0.7 : 0.3, 0.7 + noteIndex * 0.1)), soundBuilder.noise({ flt: "highpass", fc: 6e3, a: 0.25, d: 0.5, g: 0.05 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS, len: 1.1, loud: -18, rev: 0.3 },
    ),
    cast_fengling_s1: defineSfxCue(
      "技能施放",
      "李广·白羽没石",
      (soundBuilder) => {
        ;(playMonsterGrowl(soundBuilder, 0, 0.26, 1), soundBuilder.osc({ w: "triangle", f: 98, f1: 147, a: 0.2, d: 0.08, g: 0.1 }))
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_fengling_s2: defineSfxCue(
      "技能施放",
      "李广·飞将腾身",
      (soundBuilder) => {
        ;(playPluckLead(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0, 0.1, 0.6), playPluckLead(soundBuilder, midiToFrequency(67), 0.05, 0.18, 0.8))
      },
      SFX_SKILL_CAST_OPTIONS,
    ),
    cast_fengling_ult: defineSfxCue(
      "技能施放",
      "李广·箭锁阴山",
      (soundBuilder) => {
        ;(playLowThud(soundBuilder, 0, 0.6, 1.3, 0.3), playLowThud(soundBuilder, 0.14, 0.7, 1.3, 0.36), playMonsterGrowl(soundBuilder, 0.05, 0.36, 1.3))
      },
      { ...SFX_SKILL_CAST_OPTIONS, len: 0.9, loud: -18 },
    ),
    cast_yeque_s1: defineSfxCue(
      "技能施放",
      "荆轲·风萧易水",
      (soundBuilder) => {
        ;(playBambooFlute(soundBuilder, SFX_SKILL_NOTE_D5_FREQ, 0, 0.32, 1), soundBuilder.osc({ f: 73.4, f1: 55, a: 0.01, d: 0.26, g: 0.25 }), soundBuilder.noise({ flt: "bandpass", fc: 900, fc1: 2200, q: 4, a: 0.05, d: 0.2, g: 0.2 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS },
    ),
    cast_yeque_s2: defineSfxCue(
      "技能施放",
      "荆轲·引匕一掷",
      (soundBuilder) => {
        ;(playBambooFlute(soundBuilder, SFX_SKILL_NOTE_A4_FREQ, 0, 0.22, 0.8), soundBuilder.noise({ flt: "bandpass", fc: 2200, fc1: 6800, q: 4, t: 0.01, a: 0.03, d: 0.07, g: 0.5 }), soundBuilder.ring(3300, GLASS_PARTIALS, { t: 0.05, a: 0.001, d: 0.2, g: 0.14 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS },
    ),
    cast_yeque_ult: defineSfxCue(
      "技能施放",
      "荆轲·卷尽匕现",
      (soundBuilder) => {
        ;(playBambooFlute(soundBuilder, SFX_SKILL_NOTE_D5_FREQ, 0, 0.22, 0.8),
          playBambooFlute(soundBuilder, midiToFrequency(68), 0.13, 0.5, 1),
          soundBuilder.osc({ f: 62, f1: 40, t: 0.02, a: 0.004, d: 0.24, g: 0.4 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1200, fc1: 500, q: 4, a: 0.05, d: 0.35, g: 0.2 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, ...SFX_NO_JITTER_OPTIONS, len: 0.8, loud: -18 },
    ),
    cast_recall: defineSfxCue(
      "技能施放",
      "回城·启动",
      (soundBuilder) => {
        ;(sfxFmImpact(soundBuilder, SFX_SKILL_NOTE_A5_FREQ, 0, 0.4, 0.8), sfxFmImpact(soundBuilder, SFX_SKILL_NOTE_D6_FREQ, 0.09, 0.6, 0.9))
      },
      { ...SFX_SKILL_CAST_OPTIONS, loud: -25, rev: 0.25 },
    ),
    cast_heal: defineSfxCue(
      "技能施放",
      "疗伤·启动",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "glass", f: midiToFrequency(72), a: 0.02, d: 0.3, g: 0.5 }), soundBuilder.osc({ w: "glass", f: SFX_SKILL_NOTE_G5_FREQ, t: 0.09, a: 0.02, d: 0.45, g: 0.5 }), soundBuilder.osc({ f: midiToFrequency(84), t: 0.09, a: 0.02, d: 0.3, g: 0.12 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, loud: -24, rev: 0.25 },
    ),
    cast_flash: defineSfxCue(
      "技能施放",
      "闪现·启动",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 2400, f1: 4800, a: 0.001, d: 0.04, g: 0.4 }), soundBuilder.noise({ flt: "highpass", fc: 6e3, a: 0.001, d: 0.025, g: 0.3 }))
      },
      { ...SFX_SKILL_CAST_OPTIONS, loud: -26, len: 0.2 },
    ),
    fx_panyue_passive_hit: defineSfxCue(
      "技能特效",
      "樊哙·覆盾震地",
      (builder) => {
        const driveResult = builder.drive(2)
        ;(builder.osc({ f: 100, f1: 36, ft: 0.14, a: 0.003, d: 0.46, g: 0.5, to: driveResult }),
          builder.noise({ k: "pink", flt: "lowpass", fc: 900, fc1: 220, a: 0.003, d: 0.34, g: 0.5, to: driveResult }),
          playMetalClash(builder, 247, 0, 0.75, 1),
          builder.noise({ flt: "bandpass", fc: 1500, q: 0.8, a: 0.001, d: 0.045, g: 0.7 }),
          builder.scatter(3, 0.05, 0.2, (scatterTime) => builder.noise({ k: "pink", flt: "bandpass", fc: builder.rr(300, 800), q: 2, t: scatterTime, a: 0.001, d: 0.05, g: 0.25 })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -15 },
    ),
    fx_panyue_s1_dash: defineSfxCue(
      "技能特效",
      "樊哙·闯帐起步",
      (soundBuilder) => {
        ;([0, 0.1, 0.19].forEach((startTime, noteIndex) => {
          ;(soundBuilder.osc({ f: 120 - noteIndex * 8, f1: 50, t: startTime, a: 0.002, d: 0.1, g: 0.75 - noteIndex * 0.12 }), soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 700, t: startTime, a: 0.001, d: 0.04, g: 0.4 }))
        }),
          playNoiseSweep(soundBuilder, 0, 0.34, 0.6, 200, 950, 420, 0.9, "brown"),
          soundBuilder.scatter(4, 0.02, 0.26, (scatterTime) => soundBuilder.ring(soundBuilder.rr(900, 1500), DRUM_PARTIALS, { t: scatterTime, a: 0.001, d: 0.035, g: 0.05 })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -19, len: 0.5 },
    ),
    fx_panyue_s1_impact: defineSfxCue(
      "技能特效",
      "樊哙·侧盾撞击",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(2.5)
        ;(soundBuilder.osc({ f: 108, f1: 34, ft: 0.15, a: 0.003, d: 0.5, g: 0.6, to: driveBus }),
          soundBuilder.osc({ w: "triangle", f: 250, f1: 85, ft: 0.1, a: 0.002, d: 0.2, g: 0.4, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2400, fc1: 220, a: 0.002, d: 0.3, g: 0.8, to: driveBus }),
          soundBuilder.noise({ flt: "highpass", fc: 2600, a: 0.001, d: 0.014, g: 0.5 }),
          playMetalClash(soundBuilder, 294, 0, 0.7, 1.1),
          soundBuilder.scatter(4, 0.08, 0.3, (scatterTime) => soundBuilder.osc({ f: soundBuilder.rr(90, 150), f1: 50, t: scatterTime, a: 0.002, d: 0.08, g: soundBuilder.rr(0.2, 0.35) })),
          soundBuilder.ring(1150, DRUM_PARTIALS, { t: 0.04, a: 0.001, d: 0.12, g: 0.06 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -13, len: 0.9, rev: 0.24 },
    ),
    fx_panyue_s2_cast: defineSfxCue(
      "技能特效",
      "樊哙·拥盾一喝",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 128, f1: 55, a: 0.002, d: 0.2, g: 0.6 }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 800, a: 0.001, d: 0.06, g: 0.5 }),
          playMetalClash(soundBuilder, 262, 0, 0.9, 0.9),
          playWarHorn(soundBuilder, 0.04, 0.3, 0.9),
          soundBuilder.osc({ f: 440, f1: 660, t: 0.1, a: 0.12, d: 0.5, g: 0.1 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -16, len: 1 },
    ),
    fx_panyue_ult_leap: defineSfxCue(
      "技能特效",
      "樊哙·腾跃",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 115, f1: 55, a: 0.002, d: 0.12, g: 0.7 }),
          playNoiseSweep(soundBuilder, 0, 0.45, 0.5, 240, 1700, 900, 1, "pink"),
          playWarHorn(soundBuilder, 0, 0.22, 0.45, 150),
          soundBuilder.scatter(3, 0.02, 0.2, (scatterTime) => soundBuilder.ring(soundBuilder.rr(800, 1300), DRUM_PARTIALS, { t: scatterTime, a: 0.001, d: 0.05, g: 0.05 })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -19, len: 0.6 },
    ),
    fx_panyue_ult_land: defineSfxCue(
      "技能特效",
      "樊哙·砸地(大鼓 + 盾震)",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(3, soundBuilder.gain(0.8))
        ;(soundBuilder.osc({ f: 76, f1: 25, ft: 0.5, a: 0.004, d: 1.5, g: 0.75, to: driveBus }),
          soundBuilder.osc({ f: 150, f1: 48, ft: 0.2, a: 0.003, d: 0.5, g: 0.35, to: driveBus }),
          soundBuilder.osc({ f: 56, f1: 30, ft: 0.4, t: 0.07, a: 0.006, d: 1.1, g: 0.3, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1800, fc1: 160, a: 0.004, d: 1.2, g: 0.9, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 0.7, a: 0.01, d: 0.5, g: 0.6 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1200, q: 0.5, a: 0.001, d: 0.09, g: 1 }),
          soundBuilder.noise({ flt: "highpass", fc: 3e3, a: 0.001, d: 0.02, g: 0.5 }),
          playMetalClash(soundBuilder, 262, 0, 1.6, 0.8),
          playMetalClash(soundBuilder, 392, 0.02, 1.1, 0.45),
          [0.1, 0.24, 0.4].forEach((startTime, noteIndex) => soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 900 - noteIndex * 190, q: 0.9, t: startTime, a: 0.03, d: 0.3, g: 0.6 - noteIndex * 0.1 })),
          soundBuilder.scatter(9, 0.15, 1.1, (scatterTime) => soundBuilder.osc({ f: soundBuilder.rr(80, 160), f1: 50, t: scatterTime, a: 0.002, d: soundBuilder.rr(0.05, 0.1), g: soundBuilder.rr(0.12, 0.3) * (1.4 - scatterTime) })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -11, len: 2.3, gap: 0.2, poly: 2, prio: 3, rev: 0.3 },
    ),
    fx_chijin_passive_hit: defineSfxCue(
      "技能特效",
      "程咬金·重斧(带回血音)",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(2.5)
        ;(soundBuilder.osc({ f: 150, f1: 48, ft: 0.1, a: 0.002, d: 0.28, g: 0.5, to: driveBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 1700, q: 0.8, a: 0.001, d: 0.06, g: 0.7, to: driveBus }),
          playDrumHit(soundBuilder, 392, 0, 1, 0.34),
          soundBuilder.scatter(4, 0.02, 0.18, (scatterTime) => soundBuilder.noise({ flt: "highpass", fc: soundBuilder.rr(3500, 6500), t: scatterTime, a: 0.001, d: 0.01, g: 0.18 })),
          [SFX_SKILL_NOTE_G5_FREQ, midiToFrequency(84), SFX_SKILL_NOTE_E6_FREQ].forEach((noteFreq, noteIndex) => soundBuilder.osc({ w: "glass", f: noteFreq, t: 0.09 + noteIndex * 0.05, a: 0.004, d: 0.14, g: 0.16 })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -16 },
    ),
    fx_chijin_s1_slash: defineSfxCue(
      "技能特效",
      "程咬金·拦腰斧弧",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.3, 0.5, 350, 2600, 600, 1.1),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 1200, fc1: 450, q: 0.6, t: 0.05, a: 0.05, d: 0.36, g: 0.6 }),
          soundBuilder.osc({ f: 105, f1: 55, a: 0.004, d: 0.22, g: 0.4 }),
          playDrumHit(soundBuilder, 520, 0.09, 0.5, 0.22),
          soundBuilder.scatter(5, 0.1, 0.3, (scatterTime) => soundBuilder.noise({ flt: "highpass", fc: soundBuilder.rr(3e3, 6500), t: scatterTime, a: 0.001, d: 0.012, g: soundBuilder.rr(0.1, 0.22) })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -15, len: 0.8 },
    ),
    fx_chijin_s2_dash: defineSfxCue(
      "技能特效",
      "程咬金·半路杀出",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.3, 0.55, 450, 3e3, 800, 1.1),
          [0, 0.09, 0.18].forEach((startTime) => soundBuilder.osc({ f: 130, f1: 55, t: startTime, a: 0.002, d: 0.08, g: 0.5 })),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1800, a: 0.02, d: 0.28, g: 0.4 }),
          soundBuilder.noise({ flt: "bandpass", fc: 2600, fc1: 3400, q: 6, t: 0.04, a: 0.04, d: 0.2, g: 0.3 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -18, len: 0.6 },
    ),
    fx_chijin_ult_start: defineSfxCue(
      "技能特效",
      "程咬金·抡斧起手",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.55, 0.55, 300, 1600, 1e3, 0.9, "pink"),
          playDrumHit(soundBuilder, 294, 0, 0.5, 0.4),
          playDrumHit(soundBuilder, 440, 0.07, 0.4, 0.35),
          soundBuilder.osc({ f: 62, f1: 115, a: 0.2, d: 0.3, g: 0.4 }),
          soundBuilder.noise({ k: "brown", flt: "bandpass", fc: 300, q: 0.8, a: 0.2, d: 0.3, g: 0.4 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -15, len: 0.9 },
    ),
    fx_chijin_ult_tick: defineSfxCue(
      "技能特效",
      "程咬金·斧环一圈",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.27, 0.7, 500, 2300, 650, 1.2, "pink"),
          soundBuilder.osc({ f: 88, f1: 66, a: 0.03, d: 0.19, g: 0.5 }),
          soundBuilder.osc({ f: 1620, a: 0.02, d: 0.1, g: 0.04 }),
          soundBuilder.scatter(2, 0.04, 0.16, (scatterTime) => soundBuilder.noise({ flt: "highpass", fc: soundBuilder.rr(3e3, 6e3), t: scatterTime, a: 0.001, d: 0.012, g: 0.2 })))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -17, len: 0.45, gap: 0.12, poly: 3, jitter: 0.06 },
    ),
    fx_xingli_passive_burst: defineSfxCue(
      "技能特效",
      "王昭君·余音三叠",
      (soundBuilder) => {
        ;([SFX_SKILL_NOTE_E5_FREQ, SFX_SKILL_NOTE_B5_FREQ, SFX_SKILL_NOTE_E6_FREQ].forEach((noteFreq, noteIndex) => playPluckedString(soundBuilder, noteFreq, noteIndex * 0.045, 0.5, 0.8)),
          [SFX_SKILL_NOTE_E5_FREQ, SFX_SKILL_NOTE_B5_FREQ, SFX_SKILL_NOTE_E6_FREQ, SFX_SKILL_NOTE_G6_FREQ].forEach((noteFreq) => {
            ;(soundBuilder.osc({ f: noteFreq, t: 0.1, a: 0.12, d: 0.6, g: 0.12 }), soundBuilder.osc({ f: noteFreq * 1.006, t: 0.1, a: 0.14, d: 0.55, g: 0.08 }))
          }),
          soundBuilder.osc({ w: "triangle", f: 260, f1: 90, t: 0.1, a: 0.003, d: 0.26, g: 0.5 }),
          soundBuilder.noise({ flt: "bandpass", fc: 4200, q: 0.7, t: 0.1, a: 0.001, d: 0.1, g: 0.4 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -15, len: 0.9, rev: 0.28 },
    ),
    fx_xingli_s1_cast: defineSfxCue(
      "技能特效",
      "王昭君·一弦穿云出手",
      (soundBuilder) => {
        ;(playPluckedString(soundBuilder, SFX_SKILL_NOTE_B5_FREQ, 0, 0.3, 1.1), playPluckedString(soundBuilder, SFX_SKILL_NOTE_E6_FREQ, 0.004, 0.26, 0.7))
        const gainResult = soundBuilder.gain(1)
        ;(soundBuilder.lfo(gainResult.gain, 70, 0.5, 0, 0.3), soundBuilder.noise({ flt: "bandpass", fc: 1800, fc1: 6500, fct: 0.16, q: 1.4, a: 0.012, d: 0.2, g: 0.6, to: gainResult }), soundBuilder.osc({ f: 150, f1: 70, a: 0.003, d: 0.12, g: 0.35 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -16, len: 0.6, rev: 0.24 },
    ),
    fx_xingli_s2_burst: defineSfxCue(
      "技能特效",
      "王昭君·回环收拨",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 3200, fc1: 400, fct: 0.12, q: 1.5, a: 0.1, d: 0.04, g: 0.8 }),
          [SFX_SKILL_NOTE_A5_FREQ, SFX_SKILL_NOTE_E5_FREQ, SFX_SKILL_NOTE_D5_FREQ, SFX_SKILL_NOTE_A4_FREQ].forEach((noteFreq, noteIndex) => playPluckedString(soundBuilder, noteFreq, 0.12 + noteIndex * 0.02, 0.62 - noteIndex * 0.05, 0.9)),
          soundBuilder.osc({ f: 124, f1: 40, t: 0.12, a: 0.003, d: 0.5, g: 0.55 }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2200, fc1: 260, t: 0.12, a: 0.002, d: 0.28, g: 0.5 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -14, len: 1.1, rev: 0.28 },
    ),
    fx_xingli_ult_cast: defineSfxCue(
      "技能特效",
      "王昭君·起曲引雁",
      (soundBuilder) => {
        const filtResult = soundBuilder.filt("lowpass", 5200, 0.8),
          noteCount = 13
        for (let index = 0; index < noteCount; index++) playStringNote(soundBuilder, index % 4 === 3 ? SFX_SKILL_NOTE_D6_FREQ : SFX_SKILL_NOTE_B5_FREQ, 0.03 + index * 0.062, 0.2, 0.25 + 0.6 * Math.sin((Math.PI * index) / noteCount), index % 2 === 0, filtResult)
        ;(playPluckedString(soundBuilder, SFX_SKILL_NOTE_E4_FREQ, 0, 0.9, 0.7), playPluckedString(soundBuilder, SFX_SKILL_NOTE_B4_FREQ, 0.05, 0.8, 0.5), soundBuilder.osc({ f: 82.4, a: 0.3, d: 0.42, g: 0.15 }), playReedCall(soundBuilder, 0.5, 0.22))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -16, len: 1.2, rev: 0.3 },
    ),
    fx_xingli_meteor: defineSfxCue(
      "技能特效",
      "王昭君·落雁",
      (soundBuilder) => {
        const selectedSFX_METEOR_PLUCK_NOTE_FREQS = SFX_METEOR_PLUCK_NOTE_FREQS[Math.floor(soundBuilder.rnd() * SFX_METEOR_PLUCK_NOTE_FREQS.length) % SFX_METEOR_PLUCK_NOTE_FREQS.length]
        ;(playPluckedString(soundBuilder, selectedSFX_METEOR_PLUCK_NOTE_FREQS, 0, 0.42, 1, selectedSFX_METEOR_PLUCK_NOTE_FREQS * 0.667),
          soundBuilder.noise({ flt: "bandpass", fc: 3600, fc1: 1200, fct: 0.11, q: 2, a: 0.07, d: 0.04, g: 0.3 }),
          soundBuilder.osc({ f: 150, f1: 48, ft: 0.14, t: 0.11, a: 0.003, d: 0.4, g: 0.5 }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2600, fc1: 300, t: 0.11, a: 0.002, d: 0.26, g: 0.45 }),
          soundBuilder.noise({ flt: "highpass", fc: 4500, t: 0.13, a: 0.03, d: 0.35, g: 0.12 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -15, len: 0.8, gap: 0.09, poly: 4, rev: 0.26 },
    ),
    fx_fengling_s1_cast: defineSfxCue(
      "技能特效",
      "李广·白羽没石出手",
      (soundBuilder) => {
        ;(playPluckLead(soundBuilder, 123, 0, 0.34, 1.1),
          soundBuilder.osc({ f: 120, f1: 58, a: 0.003, d: 0.14, g: 0.25 }),
          playSlashHiss(soundBuilder, 0.01, 0.3, 0.45, 4200, 1900),
          soundBuilder.noise({ flt: "bandpass", fc: 2400, fc1: 900, q: 1.5, t: 0.01, a: 0.015, d: 0.22, g: 0.35 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -16, len: 0.6 },
    ),
    fx_fengling_s2_dash: defineSfxCue(
      "技能特效",
      "李广·飞将腾身(落地上弦)",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.22, 0.4, 700, 2400, 1100, 0.9),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 500, t: 0.19, a: 0.004, d: 0.06, g: 0.5 }),
          soundBuilder.osc({ f: 110, f1: 60, t: 0.19, a: 0.002, d: 0.07, g: 0.4 }),
          soundBuilder.osc({ f: 1900, f1: 1300, t: 0.3, a: 0.001, d: 0.012, g: 0.5 }),
          soundBuilder.noise({ flt: "bandpass", fc: 3200, q: 2.5, t: 0.3, a: 0.001, d: 0.008, g: 0.6 }),
          soundBuilder.osc({ w: "triangle", f: 520, f1: 420, t: 0.302, a: 0.001, d: 0.03, g: 0.35 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -20, len: 0.5 },
    ),
    fx_fengling_ult_cast: defineSfxCue(
      "技能特效",
      "李广·仰射(三弦齐发)",
      (soundBuilder) => {
        ;([0, 0.075, 0.15].forEach((startTime, noteIndex) => playPluckLead(soundBuilder, 150 + noteIndex * 14, startTime, 0.2, 0.8)),
          [0.02, 0.06, 0.1, 0.15, 0.19].forEach((startTime, noteIndex) => playSlashHiss(soundBuilder, startTime, 0.36, 0.3, 1500 + noteIndex * 260, 3400 + noteIndex * 380)),
          soundBuilder.noise({ flt: "bandpass", fc: 1e3, fc1: 4800, fct: 0.4, q: 1.2, a: 0.16, d: 0.26, g: 0.5 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -17, len: 0.7 },
    ),
    fx_fengling_ult_tick: defineSfxCue(
      "技能特效",
      "李广·箭雨落地",
      (soundBuilder) => {
        ;(soundBuilder.scatter(9, 0, 0.28, (scatterTime) => playImpactTick(soundBuilder, scatterTime, soundBuilder.rr(0.4, 0.8), soundBuilder.rr(0.8, 1.3))),
          soundBuilder.scatter(3, 0, 0.14, (scatterTime) => playSlashHiss(soundBuilder, scatterTime, 0.08, 0.25, soundBuilder.rr(3200, 4200), 1800)),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 600, q: 0.8, a: 0.03, d: 0.22, g: 0.3 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -17, len: 0.55, gap: 0.2, poly: 3, jitter: 0.06 },
    ),
    fx_yeque_s1_dash: defineSfxCue(
      "技能特效",
      "荆轲·风萧易水",
      (soundBuilder) => {
        ;(playNoiseSweep(soundBuilder, 0, 0.17, 0.7, 700, 5200, 1600, 2),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 400, fc1: 1500, fct: 0.12, q: 1.2, a: 0.02, d: 0.14, g: 0.5 }),
          soundBuilder.ring(2900, GLASS_PARTIALS, { t: 0.05, a: 0.001, d: 0.18, g: 0.1 }),
          soundBuilder.osc({ f: 98, f1: 52, a: 0.004, d: 0.16, g: 0.35 }),
          soundBuilder.noise({ flt: "bandpass", fc: 700, fc1: 1500, fct: 0.5, q: 5, t: 0.08, a: 0.15, d: 0.4, g: 0.16 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -17, len: 0.7 },
    ),
    fx_yeque_s2_cast: defineSfxCue(
      "技能特效",
      "荆轲·掷匕",
      (soundBuilder) => {
        ;([0, 0.035, 0.07].forEach((startTime, noteIndex) => soundBuilder.noise({ flt: "bandpass", fc: 2800 + noteIndex * 300, fc1: 5600 + noteIndex * 400, q: 3, t: startTime, a: 0.004, d: 0.045, g: 0.7 })),
          soundBuilder.ring(3500, GLASS_PARTIALS, { a: 0.001, d: 0.14, g: 0.06 }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 600, a: 0.006, d: 0.1, g: 0.35 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -19, len: 0.4 },
    ),
    fx_yeque_ult_vanish: defineSfxCue(
      "技能特效",
      "荆轲·图卷展开",
      (soundBuilder) => {
        const tremoloGain = soundBuilder.gain(1)
        ;(soundBuilder.lfo(tremoloGain.gain, 38, 0.45, 0, 0.45),
          soundBuilder.noise({ flt: "bandpass", fc: 1400, fc1: 4600, fct: 0.3, q: 1.2, a: 0.05, d: 0.3, g: 0.8, to: tremoloGain }),
          soundBuilder.noise({ flt: "highpass", fc: 5500, a: 0.06, d: 0.26, g: 0.1, to: tremoloGain }),
          playBambooFlute(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0.02, 0.4, 0.5),
          soundBuilder.osc({ f: 92, f1: 45, a: 0.004, d: 0.24, g: 0.5 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -18, len: 0.6, rev: 0.24 },
    ),
    fx_yeque_ult_strike: defineSfxCue(
      "技能特效",
      "荆轲·卷尽匕现",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(3, soundBuilder.gain(0.6))
        ;(soundBuilder.noise({ flt: "highpass", fc: 3200, t: 0.045, a: 0.001, d: 0.04, g: 1.1 }),
          soundBuilder.noise({ flt: "bandpass", fc: 5200, q: 1.5, t: 0.045, a: 0.001, d: 0.06, g: 0.6 }),
          soundBuilder.noise({ flt: "bandpass", fc: 2600, fc1: 7e3, q: 2, t: 0.045, a: 0.004, d: 0.1, g: 0.5 }),
          soundBuilder.ring(2500, GLASS_PARTIALS, { t: 0.045, a: 0.001, d: 0.45, g: 0.2 }),
          soundBuilder.osc({ f: 110, f1: 36, ft: 0.13, t: 0.045 + 0.01, a: 0.003, d: 0.42, g: 0.4, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1400, fc1: 300, t: 0.045 + 0.01, a: 0.001, d: 0.07, g: 0.3, to: driveBus }),
          playBambooFlute(soundBuilder, SFX_SKILL_NOTE_D4_FREQ, 0.045 + 0.02, 0.5, 0.6),
          playBambooFlute(soundBuilder, midiToFrequency(56), 0.045 + 0.03, 0.5, 0.5))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, loud: -13, len: 0.9, prio: 3, rev: 0.24 },
    ),
    yeque_refresh: defineSfxCue(
      "技能特效",
      "荆轲·得手(技能刷新)",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: SFX_SKILL_NOTE_D6_FREQ, a: 0.001, d: 0.6, g: 0.4 }),
          soundBuilder.osc({ f: SFX_SKILL_NOTE_D6_FREQ * 1.5, t: 0.004, a: 0.001, d: 0.4, g: 0.14 }),
          soundBuilder.osc({ w: "zhu", f: SFX_SKILL_NOTE_D5_FREQ, a: 0.001, d: 0.12, g: 0.12 }),
          soundBuilder.noise({ flt: "bandpass", fc: 2600, q: 2, a: 0.001, d: 0.008, g: 0.3 }))
      },
      { ...SFX_SKILL_EFFECT_OPTIONS, ...SFX_NO_JITTER_OPTIONS, bus: "ui", loud: -24, len: 0.7, gap: 0.3, poly: 1, rev: 0.26 },
    ),
    area_telegraph: defineSfxCue(
      "区域铺底",
      "预警圈(己方)",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 587, a: 0.01, d: 0.14, g: 0.4 }), soundBuilder.osc({ f: 880, t: 0.07, a: 0.01, d: 0.16, g: 0.3 }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -32, len: 0.4, prio: 0 },
    ),
    area_telegraph_enemy: defineSfxCue(
      "区域铺底",
      "预警圈(敌方)",
      (soundBuilder) => {
        const glideTime = Math.min(1.2, Math.max(0.3, soundBuilder.dur)),
          lowpassFilter = soundBuilder.filt("lowpass", 900, 1)
        ;(soundBuilder.osc({ w: "softsq", f: 311, a: 0.01, d: 0.28, g: 0.4, to: lowpassFilter }),
          soundBuilder.osc({ w: "softsq", f: 294, a: 0.01, d: 0.3, g: 0.4, to: lowpassFilter }),
          soundBuilder.osc({ f: 200, f1: 420, ft: glideTime, a: glideTime * 0.9, d: 0.06, g: 0.25 }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -26, len: 0.6, prio: 2 },
    ),
    area_panyue_aura: defineSfxCue(
      "区域铺底",
      "拥盾怒目·盾影",
      (soundBuilder) => {
        const cueDuration = soundBuilder.dur,
          holdTime = Math.max(0.1, cueDuration - 0.8),
          gainNode = soundBuilder.gain(1)
        ;(soundBuilder.lfo(gainNode.gain, 2.2, 0.3, 0, cueDuration + 0.5),
          [147, 148.6, 223.5, 225.7, 334].forEach((noteFreq, noteIndex) => soundBuilder.osc({ f: noteFreq, a: 0.25, h: holdTime, d: 0.6, g: noteIndex < 4 ? 0.22 : 0.1, to: gainNode })),
          soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 240, a: 0.2, h: holdTime, d: 0.6, g: 0.4, to: gainNode }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 420, q: 1, a: 0.2, h: holdTime, d: 0.6, g: 0.3, to: gainNode }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -30, len: 4 },
    ),
    area_panyue_fissure: defineSfxCue(
      "区域铺底",
      "跃盾砸阵·震裂的地面",
      (soundBuilder) => {
        const cueDuration = soundBuilder.dur,
          holdTime = Math.max(0.1, cueDuration - 0.7),
          gainNode = soundBuilder.gain(1)
        ;(soundBuilder.lfo(gainNode.gain, 3.1, 0.25, 0, cueDuration + 0.7),
          soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 190, a: 0.12, h: holdTime, d: 0.6, g: 0.7, to: gainNode }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 450, q: 0.9, a: 0.12, h: holdTime, d: 0.6, g: 0.4, to: gainNode }),
          soundBuilder.scatter(Math.round(cueDuration * 3), 0.1, Math.max(0.2, cueDuration - 0.3), (scatterTime) => {
            ;(soundBuilder.osc({ f: soundBuilder.rr(90, 170), f1: 55, t: scatterTime, a: 0.002, d: soundBuilder.rr(0.04, 0.08), g: soundBuilder.rr(0.2, 0.4) }),
              soundBuilder.noise({ k: "pink", flt: "bandpass", fc: soundBuilder.rr(400, 1100), q: 2, t: scatterTime, a: 0.001, d: 0.04, g: soundBuilder.rr(0.15, 0.3) }))
          }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -24, len: 3 },
    ),
    area_chijin_spin: defineSfxCue(
      "区域铺底",
      "抡圆了砍·呼啸",
      (soundBuilder) => {
        const cueDuration = soundBuilder.dur,
          holdTime = Math.max(0.1, cueDuration - 0.45),
          tickRate = 1 / CHIJIN_ULT_TICK_INTERVAL,
          lfoPhase = CHIJIN_ULT_TICK_INTERVAL * 0.75,
          gainNode = soundBuilder.gain(0.55)
        soundBuilder.lfo(gainNode.gain, tickRate, 0.45, lfoPhase, cueDuration + 0.3)
        const filterNode = soundBuilder.filt("bandpass", 800, 1.1, gainNode)
        ;(soundBuilder.lfo(filterNode.frequency, tickRate, 380, lfoPhase, cueDuration + 0.3),
          soundBuilder.noise({ k: "pink", a: 0.15, h: holdTime, d: 0.3, g: 2.4, to: filterNode }),
          soundBuilder.osc({ w: "softsaw", f: 73, a: 0.2, h: holdTime, d: 0.3, g: 0.2, to: soundBuilder.filt("lowpass", 240, 0.7, gainNode) }),
          soundBuilder.noise({ k: "brown", flt: "bandpass", fc: 300, q: 0.8, a: 0.3, h: holdTime, d: 0.3, g: 0.3, to: gainNode }),
          soundBuilder.scatter(Math.round(cueDuration * 3), 0.05, Math.max(0.2, cueDuration - 0.2), (scatterTime) => {
            soundBuilder.noise({ flt: "highpass", fc: soundBuilder.rr(3e3, 6e3), t: scatterTime, a: 0.001, d: 0.01, g: soundBuilder.rr(0.06, 0.14) })
          }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -22, len: 3 },
    ),
    area_xingli_well: defineSfxCue(
      "区域铺底",
      "回环收弦·蓄势",
      (soundBuilder) => {
        const holdTime = Math.max(0.25, soundBuilder.dur),
          filterNode = soundBuilder.filt("lowpass", 1500, 1)
        soundBuilder.ramp(filterNode.frequency, [
          [0, 1500],
          [holdTime, 6e3],
        ])
        const noteCount = Math.max(4, Math.round(holdTime * 14))
        for (let noteIndex = 0; noteIndex < noteCount; noteIndex++) {
          const noteProgress = noteIndex / noteCount
          playStringNote(soundBuilder, SFX_SKILL_NOTE_A5_FREQ, holdTime * Math.pow(noteProgress, 0.7), 0.14, 0.3 + 0.7 * noteProgress, noteIndex % 2 === 0, filterNode)
        }
        soundBuilder.noise({ flt: "bandpass", fc: 300, fc1: 2400, fct: holdTime, q: 2, a: holdTime * 0.92, d: 0.05, g: 0.4 })
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -25, len: 0.6 },
    ),
    area_xingli_storm: defineSfxCue(
      "区域铺底",
      "雁落平沙·轮指",
      (soundBuilder) => {
        const cueDuration = soundBuilder.dur,
          holdTime = Math.max(0.1, cueDuration - 0.8),
          gainNode = soundBuilder.gain(1),
          filterNode = soundBuilder.filt("lowpass", 5200, 0.8, gainNode),
          noteRate = 13.5,
          noteCount = Math.round(cueDuration * noteRate)
        for (let noteIndex = 0; noteIndex < noteCount; noteIndex++) {
          const noteTime = 0.05 + noteIndex / noteRate + soundBuilder.rr(-0.006, 0.006),
            noteEnvelope = 0.35 + 0.65 * Math.pow(Math.sin((Math.PI * noteTime) / 1.25), 2),
            tailFadeGain = Math.min(1, Math.max(0.15, (cueDuration - noteTime) / 0.5))
          playStringNote(soundBuilder, noteIndex % 8 === 7 ? SFX_SKILL_NOTE_D6_FREQ : SFX_SKILL_NOTE_B5_FREQ, noteTime, 0.16, 0.5 * noteEnvelope * tailFadeGain, noteIndex % 2 === 0, filterNode)
        }
        ;(soundBuilder.noise({ flt: "highpass", fc: 5500, a: 0.3, h: holdTime, d: 0.6, g: 0.05, to: gainNode }), soundBuilder.osc({ f: 82.4, a: 0.3, h: holdTime, d: 0.5, g: 0.08, to: gainNode }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, ...SFX_NO_JITTER_OPTIONS, loud: -27, len: 3, rev: 0.3 },
    ),
    area_fengling_rain: defineSfxCue(
      "区域铺底",
      "箭锁阴山·箭阵",
      (soundBuilder) => {
        const cueDuration = soundBuilder.dur
        ;(soundBuilder.scatter(Math.round(cueDuration * 7), 0.05, Math.max(0.2, cueDuration - 0.15), (scatterTime) => playImpactTick(soundBuilder, scatterTime, soundBuilder.rr(0.25, 0.55), soundBuilder.rr(0.75, 1.35))),
          soundBuilder.scatter(Math.round(cueDuration * 1.6), 0.1, Math.max(0.2, cueDuration - 0.4), (scatterTime) => playSlashHiss(soundBuilder, scatterTime, 0.16, 0.2, soundBuilder.rr(3e3, 4400), 1700)),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 500, q: 0.7, a: 0.2, h: Math.max(0.1, cueDuration - 0.6), d: 0.4, g: 0.25 }))
      },
      { ...SFX_AREA_AMBIENCE_OPTIONS, loud: -25, len: 3 },
    ),
  },
  SFX_CUE_GAIN_SCALE = {
    atk_panyue_swing: 0.57,
    atk_panyue_hit: 0.797,
    atk_chijin_swing: 0.517,
    atk_chijin_hit: 0.694,
    atk_xingli_charge: 0.503,
    atk_xingli_launch: 0.391,
    atk_xingli_hit: 1.002,
    atk_fengling_draw: 0.478,
    atk_fengling_launch: 0.703,
    atk_fengling_hit: 1.021,
    atk_yeque_swing: 0.446,
    atk_yeque_hit: 1.239,
    minion_swing: 0.266,
    minion_melee_hit: 1.111,
    minion_ranged_launch: 0.458,
    minion_ranged_hit: 0.791,
    minion_siege_launch: 0.944,
    minion_siege_hit: 0.773,
    super_hit: 1.106,
    monster_swing: 0.517,
    monster_hit: 1.638,
    monster_spit_launch: 0.512,
    monster_spit_hit: 0.848,
    epic_hit: 0.777,
    monster_spawn: 0.435,
    tower_charge: 0.319,
    tower_launch: 0.469,
    tower_hit: 0.809,
    tower_hit_player: 0.602,
    fx_hit_physical: 1.281,
    fx_hit_magic: 0.585,
    fx_hit_crit: 0.824,
    fx_hit_tower: 1.048,
    xingli_s1_fly: 0.327,
    xingli_s1_hit: 0.547,
    fengling_s1_fly: 0.171,
    fengling_s1_hit: 0.795,
    yeque_s2_fly: 0.27,
    yeque_s2_hit: 1.289,
    proj_fizzle: 0.357,
    cast_panyue_s1: 0.539,
    cast_panyue_s2: 0.597,
    cast_panyue_ult: 0.679,
    cast_chijin_s1: 0.713,
    cast_chijin_s2: 0.554,
    cast_chijin_ult: 0.543,
    cast_xingli_s1: 0.374,
    cast_xingli_s2: 0.234,
    cast_xingli_ult: 0.423,
    cast_fengling_s1: 0.846,
    cast_fengling_s2: 1.019,
    cast_fengling_ult: 0.824,
    cast_yeque_s1: 0.75,
    cast_yeque_s2: 0.813,
    cast_yeque_ult: 0.85,
    cast_recall: 0.701,
    cast_heal: 0.35,
    cast_flash: 0.843,
    fx_panyue_passive_hit: 0.677,
    fx_panyue_s1_dash: 0.799,
    fx_panyue_s1_impact: 0.604,
    fx_panyue_s2_cast: 0.799,
    fx_panyue_ult_leap: 0.85,
    fx_panyue_ult_land: 0.555,
    fx_chijin_passive_hit: 0.581,
    fx_chijin_s1_slash: 1.028,
    fx_chijin_s2_dash: 0.831,
    fx_chijin_ult_start: 1.034,
    fx_chijin_ult_tick: 0.849,
    fx_xingli_passive_burst: 0.592,
    fx_xingli_s1_cast: 0.49,
    fx_xingli_s2_burst: 0.47,
    fx_xingli_ult_cast: 0.759,
    fx_xingli_meteor: 0.451,
    fx_fengling_s1_cast: 1.008,
    fx_fengling_s2_dash: 1.082,
    fx_fengling_ult_cast: 0.807,
    fx_fengling_ult_tick: 1.394,
    fx_yeque_s1_dash: 0.995,
    fx_yeque_s2_cast: 1.273,
    fx_yeque_ult_vanish: 0.652,
    fx_yeque_ult_strike: 0.96,
    yeque_refresh: 0.402,
    area_telegraph: 0.33,
    area_telegraph_enemy: 0.487,
    area_panyue_aura: 0.162,
    area_panyue_fissure: 0.33,
    area_chijin_spin: 0.269,
    area_xingli_well: 0.227,
    area_xingli_storm: 0.435,
    area_fengling_rain: 0.669,
    fx_heal: 0.756,
    fx_shield_break: 1.042,
    fx_level_up: 0.728,
    fx_respawn: 0.603,
    fx_recall_start: 0.765,
    fx_recall_done: 0.447,
    fx_flash: 1.351,
    fx_gold_gain: 0.432,
    fx_tower_destroyed: 0.592,
    fx_core_destroyed: 0.483,
    fx_monster_slain: 1.019,
    fx_drake_breath_warn: 0.276,
    fx_drake_breath: 0.543,
    fx_buff_gain: 0.953,
    player_hurt: 1.17,
    player_hurt_heavy: 0.701,
    skill_hit: 0.457,
    heartbeat: 1.133,
    death_hero_ally: 0.725,
    death_hero_enemy: 0.975,
    death_player: 0.485,
    death_minion: 0.413,
    death_minion_big: 0.67,
    death_monster: 0.832,
    epic_roar: 0.474,
    epic_fall: 0.517,
    kill_player: 0.752,
    kill_ally: 1.022,
    kill_enemy: 0.757,
    levelup_player: 1.205,
    respawn_player: 0.806,
    coin: 0.79,
    coin_big: 1.126,
    buy: 1.42,
    reject: 0.933,
    recall_channel: 0.333,
    ann_match_start: 0.897,
    ann_minions_spawn: 0.814,
    ann_first_blood: 0.78,
    ann_double_kill: 0.827,
    ann_triple_kill: 0.778,
    ann_quadra_kill: 0.789,
    ann_penta_kill: 0.797,
    ann_killing_spree: 0.684,
    ann_unstoppable: 0.715,
    ann_legendary: 0.767,
    ann_shutdown: 0.765,
    ann_ace: 0.941,
    ann_tower_destroyed: 1.268,
    ann_epic_spawn: 0.61,
    ann_epic_slain: 0.909,
    ann_super_minions: 1.227,
    ann_victory: 0.595,
    ann_defeat: 0.611,
    ui_click: 0.885,
    ui_hover: 0.327,
    ui_confirm: 1.235,
    ui_back: 1.271,
    ui_select: 0.755,
    ui_buy: 1.414,
    ui_error: 1.03,
    ui_ready: 0.95,
    ui_countdown: 0.828,
  },
  SFX_SYSTEM_NOTE_A3_FREQ = midiToFrequency(57),
  SFX_SYSTEM_NOTE_D4_FREQ = midiToFrequency(62),
  SFX_SYSTEM_NOTE_F4_FREQ = midiToFrequency(65),
  SFX_SYSTEM_NOTE_A4_FREQ = midiToFrequency(69),
  SFX_SYSTEM_NOTE_C5_FREQ = midiToFrequency(72),
  SFX_SYSTEM_NOTE_D5_FREQ = midiToFrequency(74),
  SFX_SYSTEM_NOTE_G5_FREQ = midiToFrequency(79),
  SFX_SYSTEM_NOTE_A5_FREQ = midiToFrequency(81),
  SFX_SYSTEM_NOTE_C6_FREQ = midiToFrequency(84),
  SFX_SYSTEM_NOTE_D6_FREQ = midiToFrequency(86),
  SFX_SYSTEM_NOTE_E6_FREQ = midiToFrequency(88),
  SFX_SYSTEM_NOTE_G6_FREQ = midiToFrequency(91),
  SFX_SYSTEM_NOTE_A6_FREQ = midiToFrequency(93),
  SFX_SYSTEM_NOTE_C7_FREQ = midiToFrequency(96),
  SFX_SYSTEM_CUE_OPTIONS = { loud: -19, len: 0.8, gap: 0.1, poly: 2, prio: 2, jitter: 0.01, rev: 0.2 }

function playEpicRoarLayer(soundBuilder, baseFreq, sweepTime, layerGain, pitchScale = 1) {
  const driveBus = soundBuilder.drive(4, soundBuilder.filt("lowpass", 3200, 0.6)),
    filterNode = soundBuilder.filt("lowpass", 300, 2.4, driveBus)
  ;(soundBuilder.ramp(filterNode.frequency, [
    [baseFreq, 300],
    [baseFreq + sweepTime * 0.22, 1900],
    [baseFreq + sweepTime * 0.7, 1200],
    [baseFreq + sweepTime, 300],
  ]),
    soundBuilder.osc({ w: "sawtooth", f: 82 * pitchScale, f1: 58 * pitchScale, ft: sweepTime, t: baseFreq, a: sweepTime * 0.12, h: sweepTime * 0.5, d: sweepTime * 0.4, g: layerGain * 0.55, vib: 90, vr: 29, vd: 0, to: filterNode }),
    soundBuilder.osc({ w: "sawtooth", f: 123 * pitchScale, f1: 80 * pitchScale, ft: sweepTime, t: baseFreq, a: sweepTime * 0.15, h: sweepTime * 0.45, d: sweepTime * 0.4, g: layerGain * 0.4, vib: 70, vr: 37, vd: 0, to: filterNode }),
    soundBuilder.osc({ w: "softsaw", f: 520 * pitchScale, f1: 330 * pitchScale, ft: sweepTime, t: baseFreq + sweepTime * 0.08, a: sweepTime * 0.15, h: sweepTime * 0.35, d: sweepTime * 0.4, g: layerGain * 0.22, vib: 40, vr: 9, vd: 0, to: soundBuilder.filt("bandpass", 1400, 1.6) }),
    soundBuilder.noise({ k: "brown", flt: "bandpass", fc: 340, fc1: 180, q: 1.4, t: baseFreq, a: sweepTime * 0.14, h: sweepTime * 0.45, d: sweepTime * 0.5, g: layerGain * 0.8 }),
    soundBuilder.noise({ flt: "bandpass", fc: 2600, q: 3, t: baseFreq, a: sweepTime * 0.2, h: sweepTime * 0.35, d: sweepTime * 0.45, g: layerGain * 0.14 }),
    soundBuilder.osc({ f: 46, t: baseFreq, a: sweepTime * 0.2, h: sweepTime * 0.35, d: sweepTime * 0.6, g: layerGain * 0.4 }))
}

function playBeastSnarlLayer(soundBuilder, startTime, layerGain) {
  ;(soundBuilder.osc({ f: 84, f1: 30, ft: 0.3, t: startTime, a: 0.004, d: 0.7, g: layerGain * 0.8 }),
    soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 3e3, fc1: 400, t: startTime, a: 0.004, d: 0.6, g: layerGain * 0.8 }),
    soundBuilder.noise({ flt: "highpass", fc: 3500, t: startTime + 0.02, a: 0.02, d: 0.5, g: layerGain * 0.28 }),
    soundBuilder.scatter(6, startTime + 0.1, 0.6, (scatterTime) => soundBuilder.noise({ flt: "bandpass", fc: soundBuilder.rr(1800, 4500), q: 3, t: scatterTime, a: 0.002, d: soundBuilder.rr(0.02, 0.05), g: layerGain * soundBuilder.rr(0.1, 0.25) })))
}

const SFX_STATUS_CUES = {
    fx_heal: defineSfxCue(
      "状态与系统",
      "治疗",
      (soundBuilder) => {
        ;([SFX_SYSTEM_NOTE_C6_FREQ, SFX_SYSTEM_NOTE_E6_FREQ, SFX_SYSTEM_NOTE_G6_FREQ].forEach((noteFreq, noteIndex) => soundBuilder.fm({ f: noteFreq, ratio: 2, idx: 1.2, idx1: 0.05, t: noteIndex * 0.07, a: 0.004, d: 0.42, g: 0.2 })),
          soundBuilder.osc({ w: "glass", f: SFX_SYSTEM_NOTE_C5_FREQ, a: 0.1, d: 0.5, g: 0.14 }),
          soundBuilder.osc({ w: "glass", f: SFX_SYSTEM_NOTE_G5_FREQ, t: 0.05, a: 0.12, d: 0.5, g: 0.1 }),
          soundBuilder.noise({ flt: "highpass", fc: 6e3, a: 0.15, d: 0.3, g: 0.04 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -24, gap: 0.4, group: "heal", rev: 0.26 },
    ),
    fx_shield_break: defineSfxCue(
      "状态与系统",
      "护盾破碎",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "highpass", fc: 2500, a: 0.001, d: 0.26, g: 0.6 }),
          soundBuilder.osc({ f: 300, f1: 90, a: 0.001, d: 0.08, g: 0.6 }),
          soundBuilder.scatter(9, 0, 0.22, (scatterTime) => soundBuilder.ring(soundBuilder.rr(2e3, 6e3), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.05, 0.14), g: 0.07 })),
          soundBuilder.fm({ f: 1245, f1: 830, ratio: 1.41, idx: 2, idx1: 0.1, a: 0.001, d: 0.3, g: 0.14 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -19, len: 0.6, jitter: 0.04 },
    ),
    fx_level_up: defineSfxCue(
      "状态与系统",
      "升级(他人)",
      (soundBuilder) => {
        ;([SFX_SYSTEM_NOTE_G5_FREQ, SFX_SYSTEM_NOTE_C6_FREQ, SFX_SYSTEM_NOTE_E6_FREQ, SFX_SYSTEM_NOTE_G6_FREQ].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, noteFreq, noteIndex * 0.055, 0.5, 0.7)),
          soundBuilder.noise({ flt: "bandpass", fc: 800, fc1: 6e3, q: 1.2, a: 0.24, d: 0.1, g: 0.2 }),
          soundBuilder.osc({ f: 196, a: 0.1, d: 0.4, g: 0.2 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -24, gap: 0.2, rev: 0.26 },
    ),
    fx_respawn: defineSfxCue(
      "状态与系统",
      "复活(他人)",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 110, f1: 220, a: 0.3, d: 0.4, g: 0.4 }),
          soundBuilder.noise({ flt: "bandpass", fc: 400, fc1: 4200, q: 1.2, a: 0.34, d: 0.14, g: 0.3 }),
          [SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_D6_FREQ].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, noteFreq, 0.34 + noteIndex * 0.03, 0.9, 0.6)))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -23, len: 1.4, rev: 0.28 },
    ),
    fx_recall_start: defineSfxCue(
      "状态与系统",
      "回城引导开始",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "glass", f: 293.7, f1: 330, a: 0.2, d: 0.5, g: 0.3 }), sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_A5_FREQ, 0.05, 0.5, 0.6), soundBuilder.noise({ flt: "bandpass", fc: 2e3, q: 2, a: 0.2, d: 0.3, g: 0.06 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -26, rev: 0.26 },
    ),
    fx_recall_done: defineSfxCue(
      "状态与系统",
      "回城传送完成",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 500, fc1: 6500, fct: 0.18, q: 1.5, a: 0.16, d: 0.05, g: 0.7 }),
          soundBuilder.osc({ f: 300, f1: 1800, ft: 0.18, a: 0.15, d: 0.04, g: 0.2 }),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_D6_FREQ, 0.19, 0.7, 0.8),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_A6_FREQ, 0.2, 0.6, 0.6),
          soundBuilder.osc({ f: 125, f1: 60, t: 0.19, a: 0.003, d: 0.2, g: 0.6 }),
          soundBuilder.noise({ flt: "highpass", fc: 5e3, t: 0.19, a: 0.005, d: 0.4, g: 0.1 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -19, len: 1, rev: 0.28 },
    ),
    fx_flash: defineSfxCue(
      "状态与系统",
      "闪现",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 1500, fc1: 9e3, fct: 0.07, q: 1.5, a: 0.01, d: 0.07, g: 0.8 }), soundBuilder.osc({ f: 700, f1: 2800, ft: 0.07, a: 0.005, d: 0.07, g: 0.3 }))
        const echoResult = soundBuilder.echo(0.09, 0.3, 0.35, 0.4)
        ;(soundBuilder.osc({ f: 1800, f1: 900, t: 0.08, a: 0.002, d: 0.08, g: 0.4, to: echoResult }),
          soundBuilder.fm({ f: 2637, ratio: 3.01, idx: 1.5, idx1: 0.05, t: 0.08, a: 0.001, d: 0.26, g: 0.18, to: echoResult }),
          soundBuilder.osc({ f: 160, f1: 70, t: 0.08, a: 0.002, d: 0.1, g: 0.4 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -18, len: 0.8, jitter: 0.03 },
    ),
    fx_gold_gain: defineSfxCue(
      "状态与系统",
      "金币掉落(他人)",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "highpass", fc: 6e3, a: 0.001, d: 0.005, g: 0.2 }), soundBuilder.ring(2400, CRYSTAL_PARTIALS, { a: 0.001, d: 0.13, g: 0.2 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -32, len: 0.25, gap: 0.12, prio: 0, jitter: 0.06, rev: 0.1 },
    ),
    fx_tower_destroyed: defineSfxCue(
      "状态与系统",
      "防御塔倒塌",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(3)
        ;(soundBuilder.osc({ f: 82, f1: 28, ft: 0.4, a: 0.004, d: 1.3, g: 0.8, to: driveBus }),
          soundBuilder.osc({ w: "triangle", f: 240, f1: 60, ft: 0.3, a: 0.003, d: 0.45, g: 0.45, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1600, fc1: 150, a: 0.004, d: 1.5, g: 0.9, to: driveBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 1800, q: 0.6, a: 0.001, d: 0.13, g: 0.8, to: driveBus }),
          soundBuilder.scatter(14, 0.02, 0.7, (scatterTime) => soundBuilder.ring(soundBuilder.rr(1500, 5e3), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.08, 0.25), g: 0.1 })),
          soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 320, t: 0.15, a: 0.25, h: 0.5, d: 0.9, g: 0.6 }),
          soundBuilder.scatter(12, 0.2, 1.4, (scatterTime) => {
            soundBuilder.noise({ flt: "bandpass", fc: soundBuilder.rr(300, 1200), q: 2, t: scatterTime, a: 0.001, d: soundBuilder.rr(0.05, 0.14), g: soundBuilder.rr(0.2, 0.45) })
          }),
          soundBuilder.fm({ f: 880, f1: 110, ft: 0.9, ratio: 1.5, idx: 3, idx1: 0.3, a: 0.01, d: 1, g: 0.14 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -12, len: 2.6, gap: 0.3, prio: 3, range: 46, rev: 0.32 },
    ),
    fx_core_destroyed: defineSfxCue(
      "状态与系统",
      "水晶爆炸",
      (soundBuilder) => {
        ;(soundBuilder.fm({ f: 200, f1: 2200, ft: 0.6, ratio: 1.5, idx: 4, a: 0.5, d: 0.12, g: 0.3 }),
          soundBuilder.noise({ flt: "bandpass", fc: 600, fc1: 6e3, fct: 0.6, q: 2, a: 0.55, d: 0.06, g: 0.5 }),
          soundBuilder.scatter(6, 0, 0.5, (scatterTime) => soundBuilder.ring(soundBuilder.rr(2e3, 5e3), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: 0.1, g: 0.06 })))
        const hitDelay = 0.62,
          driveBus = soundBuilder.drive(3.5)
        ;(soundBuilder.osc({ f: 64, f1: 22, ft: 0.7, t: hitDelay, a: 0.004, d: 2.4, g: 0.85, to: driveBus }),
          soundBuilder.osc({ f: 96, f1: 30, ft: 0.5, t: hitDelay + 0.08, a: 0.006, d: 1.6, g: 0.5, to: driveBus }),
          soundBuilder.osc({ w: "triangle", f: 260, f1: 55, ft: 0.4, t: hitDelay, a: 0.003, d: 0.6, g: 0.45, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2400, fc1: 120, t: hitDelay, a: 0.004, d: 2.2, g: 1, to: driveBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 1500, q: 0.5, t: hitDelay, a: 0.001, d: 0.16, g: 0.9 }),
          soundBuilder.scatter(26, hitDelay + 0.02, 1.6, (scatterTime) => soundBuilder.ring(soundBuilder.rr(1200, 5200), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.1, 0.35), g: 0.09 })),
          soundBuilder.scatter(14, hitDelay + 0.2, 2, (scatterTime) => {
            soundBuilder.noise({ flt: "bandpass", fc: soundBuilder.rr(250, 1100), q: 2, t: scatterTime, a: 0.001, d: soundBuilder.rr(0.06, 0.16), g: soundBuilder.rr(0.15, 0.3) })
          }),
          soundBuilder.fm({ f: 1760, f1: 55, ft: 2.2, ratio: 1.5, idx: 3, idx1: 0.2, t: hitDelay, a: 0.01, d: 2.4, g: 0.12 }),
          soundBuilder.osc({ f: 36.7, t: hitDelay + 0.3, a: 0.4, h: 0.6, d: 1.6, g: 0.5 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -10, len: 4.2, gap: 1, poly: 1, prio: 3, range: 400, rev: 0.36 },
    ),
    fx_monster_slain: defineSfxCue(
      "状态与系统",
      "野怪倒地",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "triangle", f: 140, f1: 45, a: 0.003, d: 0.32, g: 0.7 }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 900, fc1: 250, a: 0.003, d: 0.28, g: 0.6 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 1400, q: 0.8, t: 0.03, a: 0.03, d: 0.3, g: 0.35 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -20, len: 0.6, jitter: 0.05 },
    ),
    fx_drake_breath_warn: defineSfxCue(
      "状态与系统",
      "河道巨龙·吐息预警(蓄息)",
      (soundBuilder) => {
        const cueDuration = Math.min(1.6, Math.max(0.4, soundBuilder.dur))
        ;(soundBuilder.noise({ flt: "bandpass", fc: 350, fc1: 2200, fct: cueDuration, q: 1.6, a: cueDuration * 0.95, d: 0.06, g: 0.7 }), soundBuilder.noise({ flt: "highpass", fc: 4500, a: cueDuration * 0.95, d: 0.05, g: 0.08 }))
        const driveBus = soundBuilder.drive(3, soundBuilder.filt("lowpass", 2400, 0.6)),
          filterNode = soundBuilder.filt("lowpass", 260, 2, driveBus)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 260],
          [cueDuration, 1100],
        ]),
          soundBuilder.osc({ w: "sawtooth", f: 58, f1: 104, ft: cueDuration, a: cueDuration * 0.9, d: 0.1, g: 0.4, vib: 80, vr: 26, vd: 0, to: filterNode }),
          soundBuilder.osc({ w: "sawtooth", f: 87, f1: 156, ft: cueDuration, a: cueDuration * 0.9, d: 0.1, g: 0.25, vib: 60, vr: 35, vd: 0, to: filterNode }),
          [0, 3, 7, 10, 14].forEach((noteOffset, noteIndex) => soundBuilder.fm({ f: midiToFrequency(62 + noteOffset), ratio: 2.4, idx: 1.6, idx1: 0.1, t: cueDuration * (0.12 + noteIndex * 0.17), a: 0.004, d: 0.22, g: 0.09 + noteIndex * 0.02 })))
        const gainNode = soundBuilder.gain(0.6)
        ;(soundBuilder.lfo(gainNode.gain, 9, 0.4, 0, cueDuration + 0.1, 22),
          soundBuilder.osc({ w: "softsq", f: 311, f1: 622, ft: cueDuration, a: cueDuration * 0.92, d: 0.06, g: 0.7, to: soundBuilder.filt("lowpass", 2600, 1, gainNode) }),
          soundBuilder.osc({ f: 933, f1: 1866, ft: cueDuration, a: cueDuration * 0.95, d: 0.05, g: 0.2, to: gainNode }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -18, len: 0.95, gap: 0.5, poly: 1, range: 34, rev: 0.26 },
    ),
    fx_drake_breath: defineSfxCue(
      "状态与系统",
      "河道巨龙·吐息喷吐",
      (soundBuilder) => {
        const cueDuration = Math.min(1.6, Math.max(0.3, soundBuilder.dur)),
          holdTime = Math.max(0.05, cueDuration - 0.12),
          gainNode = soundBuilder.gain(0.75)
        soundBuilder.lfo(gainNode.gain, 23, 0.25, 0, cueDuration + 0.5)
        const filterNode = soundBuilder.filt("bandpass", 1500, 0.7, gainNode)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 2400],
          [0.12, 1500],
          [cueDuration, 800],
        ]),
          soundBuilder.noise({ a: 0.03, h: holdTime, d: 0.35, g: 2.6, to: filterNode }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 520, fc1: 200, a: 0.04, h: holdTime, d: 0.4, g: 0.4, to: gainNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 5200, q: 2.5, a: 0.05, h: holdTime, d: 0.3, g: 0.25, to: gainNode }))
        const driveBus = soundBuilder.drive(3, soundBuilder.filt("lowpass", 1800, 0.6, soundBuilder.gain(0.4)))
        ;(soundBuilder.osc({ w: "sawtooth", f: 74, f1: 52, ft: cueDuration, a: 0.03, h: holdTime, d: 0.3, g: 0.35, vib: 90, vr: 31, vd: 0, to: soundBuilder.filt("lowpass", 700, 1.5, driveBus) }),
          soundBuilder.osc({ f: 62, f1: 40, a: 0.05, h: holdTime * 0.8, d: 0.5, g: 0.15 }),
          soundBuilder.noise({ flt: "bandpass", fc: 1100, q: 0.6, a: 0.004, d: 0.1, g: 0.5 }))
        const breathCount = Math.max(1, Math.round(JUNGLE_RULES.breathTicks))
        for (let noteIndex = 1; noteIndex < breathCount; noteIndex++) soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 700, q: 1, t: (cueDuration * noteIndex) / breathCount, a: 0.01, d: 0.12, g: 0.4 })
        soundBuilder.noise({ flt: "highpass", fc: 3800, t: cueDuration, a: 0.08, d: 0.45, g: 0.07 })
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -14, len: 1.3, gap: 0.5, poly: 1, prio: 3, range: 34, rev: 0.3 },
    ),
    fx_buff_gain: defineSfxCue(
      "状态与系统",
      "获得野区增益",
      (soundBuilder) => {
        const filterNode = soundBuilder.filt("lowpass", 800, 1)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 800],
          [0.3, 3200],
          [0.8, 1e3],
        ]),
          [SFX_SYSTEM_NOTE_D4_FREQ, SFX_SYSTEM_NOTE_A4_FREQ, SFX_SYSTEM_NOTE_D5_FREQ].forEach((noteFreq, noteIndex) => soundBuilder.osc({ w: "softsaw", f: noteFreq, det: noteIndex * 6 - 6, a: 0.15, d: 0.6, g: 0.22, to: filterNode })),
          soundBuilder.noise({ flt: "bandpass", fc: 600, fc1: 5200, q: 1.2, a: 0.25, d: 0.1, g: 0.3 }),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_D6_FREQ, 0.26, 0.7, 0.7),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_A6_FREQ, 0.33, 0.7, 0.6),
          soundBuilder.osc({ f: 73.4, a: 0.15, d: 0.5, g: 0.4 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -18, len: 1.2, rev: 0.28 },
    ),
    player_hurt: defineSfxCue(
      "状态与系统",
      "玩家受击",
      (soundBuilder, hitIntensity) => {
        ;(soundBuilder.osc({ f: 180, f1: 70, a: 0.002, d: 0.09 + hitIntensity * 0.05, g: 0.8 }),
          soundBuilder.noise({ flt: "bandpass", fc: 900, q: 1, a: 0.002, d: 0.07, g: 0.5 }),
          soundBuilder.noise({ flt: "highpass", fc: 3e3, a: 0.001, d: 0.012, g: 0.2 + hitIntensity * 0.3 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -22, len: 0.3, gap: 0.1, group: "hurt", jitter: 0.06, rev: 0.05 },
    ),
    player_hurt_heavy: defineSfxCue(
      "状态与系统",
      "玩家受重击",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(3)
        ;(soundBuilder.osc({ w: "triangle", f: 190, f1: 55, a: 0.002, d: 0.3, g: 0.8, to: driveBus }),
          soundBuilder.noise({ flt: "bandpass", fc: 1100, q: 0.8, a: 0.001, d: 0.1, g: 0.9, to: driveBus }),
          soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 500, a: 0.01, d: 0.25, g: 0.4 }),
          soundBuilder.osc({ f: 2400, a: 0.01, d: 0.4, g: 0.025 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -17, len: 0.6, gap: 0.12, group: "hurt", prio: 3, jitter: 0.04, rev: 0.08 },
    ),
    skill_hit: defineSfxCue(
      "状态与系统",
      "技能命中确认",
      (soundBuilder) => {
        ;(soundBuilder.fm({ f: 1320, ratio: 2, idx: 1, idx1: 0.05, a: 0.001, d: 0.11, g: 0.4 }), soundBuilder.noise({ flt: "highpass", fc: 5e3, a: 0.001, d: 0.012, g: 0.25 }), soundBuilder.osc({ f: 660, a: 0.001, d: 0.05, g: 0.15 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -27, len: 0.25, gap: 0.08, jitter: 0.04, rev: 0.08 },
    ),
    heartbeat: defineSfxCue(
      "状态与系统",
      "濒死心跳",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "triangle", f: 120, f1: 70, a: 0.006, d: 0.12, g: 1 }),
          soundBuilder.osc({ f: 240, f1: 140, a: 0.004, d: 0.06, g: 0.4 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 400, q: 2, a: 0.003, d: 0.04, g: 0.5 }),
          soundBuilder.osc({ w: "triangle", f: 105, f1: 62, t: 0.24, a: 0.006, d: 0.14, g: 0.7 }),
          soundBuilder.osc({ f: 210, f1: 124, t: 0.24, a: 0.004, d: 0.06, g: 0.28 }),
          soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 350, q: 2, t: 0.24, a: 0.003, d: 0.04, g: 0.3 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -22, len: 0.6, gap: 0.5, poly: 1, rev: 0 },
    ),
    death_hero_ally: defineSfxCue(
      "状态与系统",
      "友方英雄阵亡",
      (soundBuilder) => {
        const filterNode = soundBuilder.filt("lowpass", 1e3, 0.9)
        ;(soundBuilder.osc({ w: "softsaw", f: SFX_SYSTEM_NOTE_A4_FREQ, a: 0.01, h: 0.12, d: 0.25, g: 0.3, to: filterNode }),
          soundBuilder.osc({ w: "softsaw", f: SFX_SYSTEM_NOTE_D4_FREQ, t: 0.2, a: 0.01, h: 0.2, d: 0.6, g: 0.34, to: filterNode }),
          soundBuilder.osc({ w: "softsaw", f: SFX_SYSTEM_NOTE_F4_FREQ, t: 0.2, a: 0.01, h: 0.2, d: 0.6, g: 0.18, to: filterNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 3e3, fc1: 300, q: 1, a: 0.02, d: 0.6, g: 0.3 }),
          soundBuilder.osc({ f: 110, f1: 45, a: 0.003, d: 0.3, g: 0.7 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -18, len: 1.2, rev: 0.26 },
    ),
    death_hero_enemy: defineSfxCue(
      "状态与系统",
      "敌方英雄阵亡",
      (soundBuilder) => {
        ;(soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 4200, fc1: 500, a: 0.002, d: 0.32, g: 0.8 }),
          soundBuilder.osc({ w: "triangle", f: 180, f1: 60, a: 0.002, d: 0.22, g: 0.5 }),
          [SFX_SYSTEM_NOTE_E6_FREQ, SFX_SYSTEM_NOTE_C6_FREQ, SFX_SYSTEM_NOTE_A5_FREQ].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, noteFreq, 0.03 + noteIndex * 0.06, 0.4, 0.95)),
          soundBuilder.noise({ flt: "highpass", fc: 6e3, t: 0.05, a: 0.02, d: 0.4, g: 0.07 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -17, len: 0.9, rev: 0.24 },
    ),
    death_player: defineSfxCue(
      "状态与系统",
      "玩家阵亡",
      (soundBuilder) => {
        const driveBus = soundBuilder.drive(2)
        soundBuilder.osc({ f: 72, f1: 28, ft: 0.4, a: 0.004, d: 1.1, g: 1, to: driveBus })
        const filterNode = soundBuilder.filt("lowpass", 1400, 1)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 1400],
          [1, 200],
        ]),
          soundBuilder.osc({ w: "softsaw", f: SFX_SYSTEM_NOTE_A4_FREQ, f1: 110, ft: 0.95, a: 0.02, h: 0.3, d: 0.7, g: 0.4, to: filterNode }),
          soundBuilder.osc({ w: "softsaw", f: SFX_SYSTEM_NOTE_D4_FREQ, f1: 73.4, ft: 0.95, a: 0.02, h: 0.3, d: 0.7, g: 0.3, to: filterNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 3200, fc1: 200, fct: 0.9, q: 1.2, a: 0.03, d: 0.9, g: 0.5 }),
          soundBuilder.fm({ f: SFX_SYSTEM_NOTE_D4_FREQ, ratio: 3.5, idx: 2, idx1: 0.05, idt: 0.4, t: 0.5, a: 0.004, d: 1.5, g: 0.2 }),
          soundBuilder.fm({ f: SFX_SYSTEM_NOTE_A3_FREQ, ratio: 3.5, idx: 2, idx1: 0.05, idt: 0.4, t: 0.52, a: 0.004, d: 1.5, g: 0.16 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -14, len: 2.2, prio: 3, rev: 0.3 },
    ),
    death_minion: defineSfxCue(
      "状态与系统",
      "小兵阵亡",
      (soundBuilder) => {
        ;(soundBuilder.noise({ flt: "bandpass", fc: 1300, fc1: 400, q: 1, a: 0.002, d: 0.13, g: 0.6 }),
          soundBuilder.osc({ f: 240, f1: 90, a: 0.002, d: 0.1, g: 0.5 }),
          soundBuilder.scatter(3, 0.02, 0.12, (scatterTime) => soundBuilder.ring(soundBuilder.rr(900, 1800), [1, 2.4], { t: scatterTime, a: 0.001, d: 0.04, g: 0.08 })))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -26, len: 0.35, gap: 0.09, poly: 3, prio: 0, jitter: 0.1, rev: 0.08 },
    ),
    death_minion_big: defineSfxCue(
      "状态与系统",
      "攻城兵/超级兵阵亡",
      (soundBuilder) => {
        ;(soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1500, fc1: 250, a: 0.002, d: 0.3, g: 0.8 }),
          soundBuilder.osc({ f: 130, f1: 48, a: 0.002, d: 0.26, g: 0.8 }),
          soundBuilder.scatter(5, 0.02, 0.25, (scatterTime) => soundBuilder.ring(soundBuilder.rr(400, 900), BELL_PARTIALS, { t: scatterTime, a: 0.001, d: 0.09, g: 0.1 })))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, loud: -22, len: 0.6, gap: 0.1, prio: 1, jitter: 0.06 },
    ),
    death_monster: defineSfxCue(
      "状态与系统",
      "野怪·倒下",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(1, (soundBuilder) => {
              const filterNode = soundBuilder.filt("lowpass", 1500, 1.5)
              ;(soundBuilder.osc({ w: "sawtooth", f: 330, f1: 110, ft: 0.3, a: 0.01, d: 0.32, g: 0.5, vib: 50, vr: 19, vd: 0, to: filterNode }),
                soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 900, fc1: 400, q: 1, a: 0.01, d: 0.3, g: 0.4 }),
                soundBuilder.osc({ f: 110, f1: 50, t: 0.22, a: 0.003, d: 0.2, g: 0.7 }))
            })
          : variant < 1.5
            ? soundBuilder.sub(0.86, (soundBuilder) => {
                const filterNode = soundBuilder.filt("bandpass", 850, 2.2)
                ;(soundBuilder.osc({ w: "reed", f: 330, f1: 165, ft: 0.5, a: 0.03, h: 0.15, d: 0.4, g: 0.5, vib: 30, vr: 7, vd: 0.1, to: filterNode }),
                  soundBuilder.osc({ w: "softsaw", f: 330, f1: 165, ft: 0.5, a: 0.04, h: 0.12, d: 0.36, g: 0.2, to: filterNode }),
                  soundBuilder.osc({ f: 100, f1: 44, t: 0.3, a: 0.003, d: 0.26, g: 0.7 }),
                  soundBuilder.scatter(9, 0.32, 0.4, (scatterTime) => soundBuilder.ring(soundBuilder.rr(2200, 5600), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.05, 0.16), g: 0.07 })))
              })
            : variant < 2.5
              ? soundBuilder.sub(0.51, (soundBuilder) => {
                  playDistortedBoom(soundBuilder, 0, 0.5, 0.8, 120, 62, 400, 1300)
                  const driveBus = soundBuilder.drive(2)
                  ;(soundBuilder.osc({ f: 92, f1: 34, t: 0.42, a: 0.003, d: 0.4, g: 0.8, to: driveBus }),
                    soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1200, fc1: 250, t: 0.42, a: 0.003, d: 0.3, g: 0.6, to: driveBus }),
                    soundBuilder.noise({ flt: "highpass", fc: 3200, fc1: 1500, t: 0.45, a: 0.03, d: 0.45, g: 0.12 }))
                })
              : soundBuilder.sub(0.75, (soundBuilder) => {
                  const gainNode = soundBuilder.gain(0.6)
                  ;(soundBuilder.lfo(gainNode.gain, 18, 0.4, 0, 0.45, 5),
                    soundBuilder.noise({ flt: "bandpass", fc: 1400, fc1: 600, q: 1.5, a: 0.02, d: 0.4, g: 0.7, to: gainNode }),
                    soundBuilder.osc({ f: 2300, f1: 900, ft: 0.35, a: 0.01, d: 0.35, g: 0.06 }),
                    soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2200, fc1: 600, t: 0.3, a: 0.01, d: 0.16, g: 0.4 }))
                })
      },
      {
        ...SFX_SYSTEM_CUE_OPTIONS,
        loud: -21,
        len: 0.8,
        jitter: 0.06,
        variants: [
          { label: "苔背獾", v: 0 },
          { label: "霜晶巨鹿", v: 1 },
          { label: "炽焰巨熊", v: 2 },
          { label: "荧翅蛾", v: 5 },
        ],
      },
    ),
    epic_roar: defineSfxCue(
      "状态与系统",
      "史诗野怪现身",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(0.89, (soundBuilder) => {
              const gainNode = soundBuilder.gain(0.6)
              ;(soundBuilder.lfo(gainNode.gain, 2.5, 0.35, 0, 1.1, 7),
                soundBuilder.noise({ k: "pink", flt: "bandpass", fc: 500, fc1: 1500, fct: 1, q: 1.2, a: 0.9, d: 0.12, g: 0.9, to: gainNode }),
                soundBuilder.noise({ k: "brown", flt: "lowpass", fc: 200, a: 0.8, d: 0.3, g: 0.5 }),
                playBeastSnarlLayer(soundBuilder, 1, 1),
                playEpicRoarLayer(soundBuilder, 1.55, 1.1, 1))
            })
          : soundBuilder.sub(1, (soundBuilder) => {
              ;(soundBuilder.osc({ f: 2200, f1: 240, ft: 0.95, a: 0.5, d: 0.5, g: 0.12 }), soundBuilder.noise({ flt: "bandpass", fc: 5e3, fc1: 700, fct: 0.95, q: 2, a: 0.85, d: 0.1, g: 0.5 }))
              const hitDelay = 1,
                driveBus = soundBuilder.drive(3)
              ;(soundBuilder.osc({ f: 70, f1: 24, ft: 0.5, t: hitDelay, a: 0.004, d: 1.4, g: 0.9, to: driveBus }),
                soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 2200, fc1: 160, t: hitDelay, a: 0.004, d: 1.1, g: 0.9, to: driveBus }),
                soundBuilder.noise({ flt: "highpass", fc: 3e3, t: hitDelay + 0.03, a: 0.05, d: 0.9, g: 0.2 }))
              for (let noteIndex = 0; noteIndex < 9; noteIndex++) {
                const burstTime = hitDelay + 0.25 + 1.3 * Math.pow(noteIndex / 9, 0.75)
                ;(soundBuilder.noise({ flt: "bandpass", fc: 400 + noteIndex * 70, q: 2.2, t: burstTime, a: 0.001, d: 0.06, g: 0.35 }), soundBuilder.osc({ f: 120 + noteIndex * 9, f1: 70, t: burstTime, a: 0.002, d: 0.07, g: 0.3 }))
              }
              ;([SFX_SYSTEM_NOTE_D4_FREQ, SFX_SYSTEM_NOTE_A4_FREQ, SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_E6_FREQ].forEach((noteFreq, noteIndex) => soundBuilder.fm({ f: noteFreq, ratio: 1.41, idx: 1.8, idx1: 0.3, t: hitDelay + 1.5 + noteIndex * 0.05, a: 0.3, h: 0.3, d: 0.9, g: 0.09 })),
                soundBuilder.osc({ f: 36.7, t: hitDelay + 1.4, a: 0.4, h: 0.3, d: 1, g: 0.4 }))
            })
      },
      {
        ...SFX_SYSTEM_CUE_OPTIONS,
        loud: -14,
        len: 3.6,
        gap: 1,
        poly: 1,
        prio: 3,
        range: 400,
        rev: 0.34,
        variants: [
          { label: "河道巨龙", v: 0 },
          { label: "星陨巨灵", v: 1 },
        ],
      },
    ),
    epic_fall: defineSfxCue(
      "状态与系统",
      "史诗野怪倒下",
      (soundBuilder, variant) => {
        variant < 0.5
          ? soundBuilder.sub(0.85, (soundBuilder) => {
              ;(playEpicRoarLayer(soundBuilder, 0, 0.75, 0.9, 1.25),
                soundBuilder.noise({ flt: "highpass", fc: 4e3, t: 0.6, a: 0.001, d: 0.03, g: 0.4 }),
                soundBuilder.scatter(7, 0.6, 0.25, (scatterTime) => soundBuilder.ring(soundBuilder.rr(2200, 5200), CHIME_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.08, 0.2), g: 0.1 })))
              const driveBus = soundBuilder.drive(2.5)
              ;(soundBuilder.osc({ f: 64, f1: 24, ft: 0.5, t: 1.25, a: 0.004, d: 1.2, g: 0.8, to: driveBus }),
                soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1500, fc1: 140, t: 1.25, a: 0.004, d: 0.9, g: 0.8, to: driveBus }),
                playBeastSnarlLayer(soundBuilder, 1.8, 0.7),
                soundBuilder.noise({ flt: "bandpass", fc: 2500, fc1: 7e3, fct: 1.1, q: 2, t: 2, a: 0.5, d: 0.6, g: 0.1 }),
                [SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_D6_FREQ, SFX_SYSTEM_NOTE_A6_FREQ].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, noteFreq, 2 + noteIndex * 0.12, 0.9, 0.5)))
            })
          : soundBuilder.sub(1, (soundBuilder) => {
              ;([0, 0.34, 0.68].forEach((startTime, noteIndex) => {
                ;(soundBuilder.fm({ f: 660 - noteIndex * 110, f1: 180, ft: 0.5, ratio: 1.41, idx: 3, idx1: 0.4, t: startTime, a: 0.002, d: 0.5, g: 0.3 }),
                  soundBuilder.noise({ flt: "bandpass", fc: 2600, q: 1.5, t: startTime, a: 0.001, d: 0.03, g: 0.5 }))
              }),
                playBeastSnarlLayer(soundBuilder, 1, 0.8),
                playBeastSnarlLayer(soundBuilder, 1.3, 0.7))
              const driveBus = soundBuilder.drive(2.5)
              ;(soundBuilder.osc({ f: 58, f1: 24, ft: 0.6, t: 1.6, a: 0.01, d: 1.3, g: 0.8, to: driveBus }),
                soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1300, fc1: 140, t: 1.6, a: 0.05, d: 1, g: 0.8, to: driveBus }),
                soundBuilder.scatter(10, 1.6, 0.9, (scatterTime) => soundBuilder.noise({ flt: "bandpass", fc: soundBuilder.rr(300, 1100), q: 2, t: scatterTime, a: 0.001, d: soundBuilder.rr(0.05, 0.12), g: soundBuilder.rr(0.15, 0.3) })),
                soundBuilder.osc({ f: 300, f1: 1800, ft: 0.4, t: 2.2, a: 0.35, d: 0.08, g: 0.2 }),
                [SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_D6_FREQ].forEach((noteFreq) => sfxFmImpact(soundBuilder, noteFreq, 2.6, 1, 0.6)))
              const impactNoteFreqs = [86, 88, 91, 93, 96, 98].map(midiToFrequency)
              soundBuilder.scatter(12, 2.6, 0.9, (scatterTime, noteIndex) => sfxFmImpact(soundBuilder, impactNoteFreqs[noteIndex % impactNoteFreqs.length], scatterTime, 0.6, 0.4))
            })
      },
      {
        ...SFX_SYSTEM_CUE_OPTIONS,
        loud: -13,
        len: 3.6,
        gap: 1,
        poly: 1,
        prio: 3,
        range: 400,
        rev: 0.32,
        variants: [
          { label: "河道巨龙", v: 0 },
          { label: "星陨巨灵", v: 1 },
        ],
      },
    ),
    kill_player: defineSfxCue(
      "状态与系统",
      "玩家完成击杀",
      (soundBuilder) => {
        ;([SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_D6_FREQ].forEach((noteFreq, noteIndex) => {
          ;(sfxSwingWhoosh(soundBuilder, noteFreq, noteIndex * 0.05, noteIndex === 2 ? 0.3 : 0.06, 0.9), sfxFmImpact(soundBuilder, noteFreq * 2, noteIndex * 0.05, 0.4, 0.5))
        }),
          soundBuilder.noise({ flt: "highpass", fc: 6e3, t: 0.1, a: 0.01, d: 0.4, g: 0.06 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -17, len: 0.8, rev: 0.24 },
    ),
    kill_ally: defineSfxCue(
      "状态与系统",
      "友方完成击杀",
      (soundBuilder) => {
        ;(sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_A5_FREQ, 0, 0.3, 0.6), sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_D6_FREQ, 0.08, 0.5, 0.7))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -25, len: 0.7, rev: 0.24 },
    ),
    kill_enemy: defineSfxCue(
      "状态与系统",
      "敌方完成击杀",
      (soundBuilder) => {
        ;(sfxStringDraw(soundBuilder, SFX_SYSTEM_NOTE_D5_FREQ, 0, 0.1, 0.8), sfxStringDraw(soundBuilder, SFX_SYSTEM_NOTE_A4_FREQ, 0.11, 0.3, 0.9), soundBuilder.osc({ f: 110, f1: 73, a: 0.01, d: 0.4, g: 0.2 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -24, len: 0.7, rev: 0.24 },
    ),
    levelup_player: defineSfxCue(
      "状态与系统",
      "玩家升级",
      (soundBuilder) => {
        ;([SFX_SYSTEM_NOTE_G5_FREQ, SFX_SYSTEM_NOTE_C6_FREQ, SFX_SYSTEM_NOTE_E6_FREQ, SFX_SYSTEM_NOTE_G6_FREQ].forEach((noteFreq, noteIndex) => {
          ;(sfxFmImpact(soundBuilder, noteFreq, noteIndex * 0.06, 0.6, 0.8), sfxFmImpact(soundBuilder, noteFreq / 2, noteIndex * 0.06, 0.4, 0.4))
        }),
          [SFX_SYSTEM_NOTE_C6_FREQ, SFX_SYSTEM_NOTE_E6_FREQ, SFX_SYSTEM_NOTE_G6_FREQ, SFX_SYSTEM_NOTE_C7_FREQ].forEach((noteFreq) => sfxFmImpact(soundBuilder, noteFreq, 0.26, 1, 0.5)))
        const filterNode = soundBuilder.filt("lowpass", 600, 0.8)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 600],
          [0.3, 2400],
          [1, 800],
        ]),
          [midiToFrequency(60), midiToFrequency(67), SFX_SYSTEM_NOTE_C5_FREQ].forEach((noteFreq, noteIndex) => soundBuilder.osc({ w: "softsaw", f: noteFreq, det: noteIndex * 7 - 7, a: 0.25, h: 0.1, d: 0.6, g: 0.14, to: filterNode })),
          soundBuilder.noise({ flt: "bandpass", fc: 800, fc1: 7e3, q: 1.2, a: 0.26, d: 0.12, g: 0.18 }),
          soundBuilder.osc({ f: 130.8, a: 0.1, d: 0.5, g: 0.3 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -16, len: 1.5, rev: 0.3 },
    ),
    respawn_player: defineSfxCue(
      "状态与系统",
      "玩家复活",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 73.4, f1: 146.8, a: 0.35, d: 0.5, g: 0.6 }),
          soundBuilder.noise({ flt: "bandpass", fc: 300, fc1: 5e3, q: 1.2, a: 0.4, d: 0.16, g: 0.4 }),
          [SFX_SYSTEM_NOTE_D5_FREQ, SFX_SYSTEM_NOTE_A5_FREQ, SFX_SYSTEM_NOTE_D6_FREQ, midiToFrequency(90)].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, noteFreq, 0.4 + noteIndex * 0.035, 1.1, 0.7)))
        const filterNode = soundBuilder.filt("lowpass", 1800, 0.8)
        ;[SFX_SYSTEM_NOTE_D4_FREQ, SFX_SYSTEM_NOTE_A4_FREQ].forEach((noteFreq) => soundBuilder.osc({ w: "softsaw", f: noteFreq, t: 0.38, a: 0.05, h: 0.2, d: 0.7, g: 0.16, to: filterNode }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -17, len: 1.7, rev: 0.3 },
    ),
    coin: defineSfxCue(
      "状态与系统",
      "补兵金币",
      (soundBuilder, variant) => {
        const ringRatio = 1 + variant * 0.25
        ;(soundBuilder.noise({ flt: "highpass", fc: 6e3, a: 0.001, d: 0.006, g: 0.3 }), soundBuilder.ring(1976 * ringRatio, CRYSTAL_PARTIALS, { a: 0.001, d: 0.2, g: 0.28 }), soundBuilder.ring(2637 * ringRatio, CRYSTAL_PARTIALS, { t: 0.055, a: 0.001, d: 0.34, g: 0.3 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -20, len: 0.5, gap: 0.07, poly: 3, group: "coin", jitter: 0.02, rev: 0.14 },
    ),
    coin_big: defineSfxCue(
      "状态与系统",
      "大额金币",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 180, f1: 90, a: 0.002, d: 0.1, g: 0.3 }),
          soundBuilder.scatter(7, 0, 0.3, (scatterTime, noteIndex) => soundBuilder.ring(1760 * (1 + noteIndex * 0.09), CRYSTAL_PARTIALS, { t: scatterTime, a: 0.001, d: soundBuilder.rr(0.15, 0.3), g: 0.16 })),
          soundBuilder.ring(3520, CRYSTAL_PARTIALS, { t: 0.32, a: 0.001, d: 0.45, g: 0.2 }),
          soundBuilder.noise({ flt: "highpass", fc: 7e3, a: 0.02, d: 0.35, g: 0.06 }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -19, len: 0.9, gap: 0.2, rev: 0.16 },
    ),
    buy: defineSfxCue(
      "状态与系统",
      "购买装备",
      (soundBuilder) => {
        ;([0, 0.045, 0.09].forEach((startTime, noteIndex) => soundBuilder.ring(2637 / (1 + noteIndex * 0.12), CRYSTAL_PARTIALS, { t: startTime, a: 0.001, d: 0.12, g: 0.18 })),
          soundBuilder.osc({ f: 200, f1: 120, t: 0.1, a: 0.002, d: 0.08, g: 0.4 }),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_A5_FREQ, 0.14, 0.4, 0.8),
          sfxFmImpact(soundBuilder, SFX_SYSTEM_NOTE_D6_FREQ, 0.22, 0.6, 0.9))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -19, len: 0.9, gap: 0.25, group: "buy", rev: 0.18 },
    ),
    reject: defineSfxCue(
      "状态与系统",
      "操作被拒绝",
      (soundBuilder) => {
        const filterNode = soundBuilder.filt("lowpass", 1100, 1)
        ;(soundBuilder.osc({ w: "softsq", f: 247, a: 0.004, d: 0.07, g: 0.5, to: filterNode }), soundBuilder.osc({ w: "softsq", f: 233, t: 0.09, a: 0.004, d: 0.1, g: 0.5, to: filterNode }))
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -26, len: 0.3, gap: 0.25, group: "error", rev: 0.04 },
    ),
    recall_channel: defineSfxCue(
      "状态与系统",
      "回城引导(持续)",
      (soundBuilder) => {
        const cueDuration = Math.max(1, soundBuilder.dur),
          gainNode = soundBuilder.gain(1)
        soundBuilder.lfo(gainNode.gain, 3, 0.3, 0, cueDuration + 0.3, 9)
        const filterNode = soundBuilder.filt("lowpass", 500, 1.2, gainNode)
        ;(soundBuilder.ramp(filterNode.frequency, [
          [0, 500],
          [cueDuration, 2600],
        ]),
          soundBuilder.osc({ w: "softsaw", f: 146.8, f1: 220, ft: cueDuration, a: cueDuration * 0.95, d: 0.15, g: 0.5, to: filterNode }),
          soundBuilder.osc({ w: "softsaw", f: 220.5, f1: 330, ft: cueDuration, a: cueDuration * 0.95, d: 0.15, g: 0.35, to: filterNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 1200, fc1: 5e3, fct: cueDuration, q: 2, a: cueDuration * 0.95, d: 0.15, g: 0.14, to: gainNode }))
        const melodyNotes = [74, 76, 79, 81, 84, 86, 88, 91, 93, 96],
          noteCount = Math.min(melodyNotes.length, Math.floor(cueDuration / 0.5))
        for (let noteIndex = 0; noteIndex < noteCount; noteIndex++) soundBuilder.fm({ f: midiToFrequency(melodyNotes[noteIndex + melodyNotes.length - noteCount]), ratio: 3.01, idx: 1.5, idx1: 0.05, t: noteIndex * 0.5 + 0.25, a: 0.002, d: 0.4, g: 0.08 + noteIndex * 0.012 })
      },
      { ...SFX_SYSTEM_CUE_OPTIONS, bus: "ui", loud: -24, len: 5, gap: 0.5, poly: 1, rev: 0.24 },
    ),
  },
  SFX_UI_CUE_OPTIONS = { bus: "ui", loud: -25, len: 0.3, gap: 0.03, poly: 2, prio: 2, jitter: 0, rev: 0.08 },
  SFX_UI_CUES = {
    ui_click: defineSfxCue(
      "界面",
      "点击",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 1250, f1: 800, a: 0.001, d: 0.035, g: 0.5 }), soundBuilder.noise({ flt: "highpass", fc: 4e3, a: 0.001, d: 0.005, g: 0.3 }), soundBuilder.osc({ w: "triangle", f: 400, a: 0.001, d: 0.03, g: 0.2 }))
      },
      { ...SFX_UI_CUE_OPTIONS, len: 0.15 },
    ),
    ui_hover: defineSfxCue(
      "界面",
      "悬停",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 2200, a: 0.002, d: 0.018, g: 0.4 }), soundBuilder.osc({ f: 3300, a: 0.002, d: 0.012, g: 0.12 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -36, len: 0.1, gap: 0.05, prio: 0, rev: 0.04 },
    ),
    ui_confirm: defineSfxCue(
      "界面",
      "确认",
      (soundBuilder) => {
        ;(sfxFmImpact(soundBuilder, midiToFrequency(86), 0, 0.3, 0.8), sfxFmImpact(soundBuilder, midiToFrequency(93), 0.065, 0.45, 0.9), soundBuilder.osc({ f: 220, f1: 147, a: 0.002, d: 0.06, g: 0.2 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -22, len: 0.6, gap: 0.08, rev: 0.16 },
    ),
    ui_back: defineSfxCue(
      "界面",
      "返回",
      (soundBuilder) => {
        ;(sfxFmImpact(soundBuilder, midiToFrequency(81), 0, 0.2, 0.7), sfxFmImpact(soundBuilder, midiToFrequency(76), 0.06, 0.3, 0.6), soundBuilder.noise({ flt: "bandpass", fc: 2400, fc1: 900, q: 2, a: 0.01, d: 0.08, g: 0.08 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -25, len: 0.45, gap: 0.08, rev: 0.12 },
    ),
    ui_select: defineSfxCue(
      "界面",
      "选中",
      (soundBuilder) => {
        ;(soundBuilder.osc({ w: "triangle", f: 1320, a: 0.002, d: 0.16, g: 0.4 }),
          sfxFmImpact(soundBuilder, midiToFrequency(88), 0, 0.3, 0.7),
          soundBuilder.noise({ flt: "bandpass", fc: 1500, fc1: 5e3, q: 2, a: 0.02, d: 0.06, g: 0.1 }),
          soundBuilder.osc({ f: 147, a: 0.002, d: 0.08, g: 0.3 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -22, len: 0.45, gap: 0.06, rev: 0.16 },
    ),
    ui_buy: defineSfxCue(
      "界面",
      "购买",
      (soundBuilder) => {
        ;([0, 0.045, 0.09].forEach((startTime, noteIndex) => soundBuilder.ring(2637 / (1 + noteIndex * 0.12), CRYSTAL_PARTIALS, { t: startTime, a: 0.001, d: 0.12, g: 0.18 })),
          soundBuilder.osc({ f: 200, f1: 120, t: 0.1, a: 0.002, d: 0.08, g: 0.4 }),
          sfxFmImpact(soundBuilder, midiToFrequency(81), 0.14, 0.4, 0.8),
          sfxFmImpact(soundBuilder, midiToFrequency(86), 0.22, 0.6, 0.9))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -19, len: 0.9, gap: 0.25, group: "buy", rev: 0.18 },
    ),
    ui_error: defineSfxCue(
      "界面",
      "错误",
      (soundBuilder) => {
        const filterNode = soundBuilder.filt("lowpass", 1e3, 1)
        ;(soundBuilder.osc({ w: "softsq", f: 220, a: 0.004, d: 0.07, g: 0.6, to: filterNode }),
          soundBuilder.osc({ w: "softsq", f: 207.6, t: 0.1, a: 0.004, d: 0.12, g: 0.6, to: filterNode }),
          soundBuilder.noise({ flt: "bandpass", fc: 500, q: 1, a: 0.002, d: 0.03, g: 0.15 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -24, len: 0.35, gap: 0.25, group: "error", rev: 0.04 },
    ),
    ui_ready: defineSfxCue(
      "界面",
      "就绪",
      (soundBuilder) => {
        ;[74, 81, 86, 90].forEach((noteFreq, noteIndex) => sfxFmImpact(soundBuilder, midiToFrequency(noteFreq), noteIndex * 0.05, 0.7, 0.8))
        const filterNode = soundBuilder.filt("lowpass", 2200, 0.8)
        ;([62, 69].forEach((noteFreq) => soundBuilder.osc({ w: "softsaw", f: midiToFrequency(noteFreq), t: 0.15, a: 0.04, h: 0.1, d: 0.5, g: 0.14, to: filterNode })), soundBuilder.noise({ flt: "highpass", fc: 6e3, t: 0.12, a: 0.02, d: 0.4, g: 0.05 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -19, len: 1.1, gap: 0.2, rev: 0.26 },
    ),
    ui_countdown: defineSfxCue(
      "界面",
      "倒计时",
      (soundBuilder) => {
        ;(soundBuilder.osc({ f: 880, a: 0.001, d: 0.07, g: 0.6 }), soundBuilder.osc({ w: "triangle", f: 1760, a: 0.001, d: 0.03, g: 0.2 }), soundBuilder.noise({ flt: "bandpass", fc: 2500, q: 2, a: 0.001, d: 0.012, g: 0.2 }))
      },
      { ...SFX_UI_CUE_OPTIONS, loud: -22, len: 0.25, gap: 0.2, rev: 0.14 },
    ),
  },
  SFX_RUNTIME_CUE_TABLE = { ...SFX_COMBAT_CUE_TABLE, ...SFX_SKILL_CAST_CUES, ...SFX_STATUS_CUES, ...ANNOUNCE_CUES, ...SFX_UI_CUES }

/**
 * 处理音效。
 *
 * @param cueName - 主要输入
 * @param result - 输入
 */
function __registerSound(cueName, result) {
  // FS 是定义表，r1 是运行时查找表（启动时一次性合并），两处都要写
  SFX_COMBAT_CUE_TABLE[cueName] = result
  SFX_RUNTIME_CUE_TABLE[cueName] = result
  return result
}

/**
 * 处理音效与时长。
 *
 * @param cueName - 主要输入
 * @param soundCue - 输入
 */
function __registerSoundRuntime(cueName, soundCue) {
  // 只写运行时查找表 r1，不污染 FS（FS 同时驱动设置面板的音效分组列表）
  SFX_RUNTIME_CUE_TABLE[cueName] = soundCue
  return soundCue
}

function getSfxCueGain(lookupKey) {
  return SFX_CUE_GAIN_SCALE[lookupKey] ?? 1
}

const SFX_MAX_ACTIVE_VOICES = 28,
  AUDIO_MIX_BUS_GAIN = 0.8,
  AUDIO_POST_COMPRESSOR_GAIN = 1.13,
  AUDIO_COMPRESSOR_SETTINGS = { threshold: -9, knee: 6, ratio: 8, attack: 0.003, release: 0.2 }

export { SFX_COMBAT_CUE_TABLE, SFX_SKILL_CAST_CUES, AUDIO_POST_COMPRESSOR_GAIN, getSfxCueGain, AUDIO_COMPRESSOR_SETTINGS, AUDIO_MIX_BUS_GAIN, SFX_MAX_ACTIVE_VOICES, __registerSound, __registerSoundRuntime, SFX_RUNTIME_CUE_TABLE }