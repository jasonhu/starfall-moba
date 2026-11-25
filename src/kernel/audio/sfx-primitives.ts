/**
 * 音效合成原语：振荡器 / 噪声 / FM 打击的薄封装 + 音效定义 DSL
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { midiToFrequency } from './audio-math'
import { sfxBellTone, sfxFmImpact, sfxFormantChant, sfxMetalRing, sfxNoiseSnare, sfxStringDraw, sfxSwingWhoosh } from './sfx-synth'

function defineSfxCue(category, label, playFn, overrides = {}) {
  return { fn: playFn, label: label, cat: category, bus: "sfx", loud: -20, rev: 0.12, gap: 0.045, poly: 3, prio: 1, jitter: 0.03, len: 0.6, range: 26, ...overrides }
}

const BELL_PARTIALS = [1, 2.31, 3.87, 5.2],
  METAL_PARTIALS = [1, 1.48, 2.36, 3.2],
  GLASS_PARTIALS = [1, 1.34, 1.87, 2.6],
  CHIME_PARTIALS = [1, 1.5, 2.5, 3.76],
  CRYSTAL_PARTIALS = [1, 2.01, 3.03, 4.2],
  MELODY_BASE_MIDI = 62

function snapToScaleTone(midiNote) {
  const pitchClass = ((midiNote % 12) + 12) % 12
  return pitchClass === 2 || pitchClass === 4 || pitchClass === 9 || pitchClass === 11 ? midiNote - 1 : midiNote
}

function playFanfareMelody(builder, melodySpec, isReady) {
  const beatDuration = 60 / melodySpec.bpm,
    baseMidi = MELODY_BASE_MIDI + (isReady ? -5 : 0),
    count = melodySpec.mel.length
  let maxNoteEnd = 0
  for (let index = 0; index < count; index++) {
    const selectedMel = melodySpec.mel[index],
      pitchOffset = isReady ? snapToScaleTone(melodySpec.mel[melodySpec.noFlip ? index : count - 1 - index][1]) : selectedMel[1],
      midiToFrequencyResult = midiToFrequency(baseMidi + pitchOffset),
      noteTime = selectedMel[0] * beatDuration,
      noteDuration = selectedMel[2] * beatDuration
    ;((maxNoteEnd = Math.max(maxNoteEnd, noteTime + noteDuration)),
      melodySpec.inst === "horn" ? sfxStringDraw(builder, midiToFrequencyResult, noteTime, noteDuration, selectedMel[3]) : sfxSwingWhoosh(builder, midiToFrequencyResult, noteTime, noteDuration, selectedMel[3], isReady ? 0.85 : 1),
      isReady ? sfxSwingWhoosh(builder, midiToFrequencyResult / 2, noteTime, noteDuration, selectedMel[3] * 0.35, 0.8) : (melodySpec.oct && sfxSwingWhoosh(builder, midiToFrequencyResult * 2, noteTime, noteDuration, selectedMel[3] * 0.45, 1.1), melodySpec.bells && sfxFmImpact(builder, midiToFrequencyResult * 2, noteTime, Math.max(0.4, noteDuration), selectedMel[3] * 0.5)))
  }
  for (const timpBeat of melodySpec.timp ?? []) sfxBellTone(builder, midiToFrequency(baseMidi - 24), timpBeat * beatDuration, isReady ? 0.55 : 0.6)
  if ((melodySpec.cym !== void 0 && (isReady ? builder.noise({ k: "pink", flt: "lowpass", fc: 1800, fc1: 300, t: melodySpec.cym * beatDuration, a: 0.004, d: 1, g: 0.35 }) : sfxMetalRing(builder, melodySpec.cym * beatDuration, 0.6, 1.4)), melodySpec.chord)) {
    const [chordStartBeat, bushMap, chordDurationBeats] = melodySpec.chord,
      chordFrequencies = bushMap.map((chordNote) => midiToFrequency(baseMidi + (isReady ? snapToScaleTone(chordNote) : chordNote)))
    ;(sfxFormantChant(builder, chordFrequencies, chordStartBeat * beatDuration, chordDurationBeats * beatDuration, isReady ? 0.35 : 0.5), (maxNoteEnd = Math.max(maxNoteEnd, (chordStartBeat + chordDurationBeats) * beatDuration)))
  }
  if (melodySpec.sparkle && !isReady) {
    const lastNote = melodySpec.mel[count - 1],
      sparkleBaseMidi = baseMidi + lastNote[1] + 12
    ;[0, 7, 12, 16, 19].forEach((interval, sparkleIndex) => sfxFmImpact(builder, midiToFrequency(sparkleBaseMidi + interval), lastNote[0] * beatDuration + 0.05 + sparkleIndex * 0.05, 0.7, 0.3))
  }
  if (isReady) {
    const filtResult = builder.filt("lowpass", 520, 1)
    ;(builder.osc({ w: "softsaw", f: midiToFrequency(baseMidi - 12), a: 0.05, h: maxNoteEnd * 0.6, d: 0.6, g: 0.12, to: filtResult }), builder.osc({ w: "softsaw", f: midiToFrequency(baseMidi - 6), a: 0.05, h: maxNoteEnd * 0.6, d: 0.6, g: 0.09, to: filtResult }))
  }
}

const TEAM_VARIANTS = [
    { label: "己方", v: 0 },
    { label: "敌方", v: 1 },
  ],
  UI_CUE_DEFAULTS = { bus: "ui", loud: -15, gap: 0.4, poly: 1, prio: 3, jitter: 0, rev: 0.26 },
  FANFARE_MELODIES = {
    match_start: {
      bpm: 120,
      mel: [
        [0, 0, 1, 0.8],
        [1, 7, 1, 0.85],
        [2, 12, 2.5, 1],
      ],
      oct: !0,
      timp: [0, 1, 2],
      cym: 2,
      chord: [2, [-12, 0, 7, 14], 2.5],
    },
    minions_spawn: {
      bpm: 140,
      inst: "horn",
      mel: [
        [0, 7, 0.5, 0.75],
        [0.5, 7, 0.5, 0.75],
        [1, 12, 1.6, 0.95],
      ],
      timp: [1],
    },
    first_blood: {
      bpm: 150,
      mel: [
        [0, 0, 0.5, 0.9],
        [0.5, 7, 0.5, 0.95],
        [1, 12, 2, 1],
      ],
      oct: !0,
      timp: [0, 1],
      cym: 1,
      chord: [1, [0, 7, 12, 15], 2],
    },
    double_kill: {
      bpm: 150,
      mel: [
        [0, 7, 0.5, 0.9],
        [0.5, 12, 1.6, 1],
      ],
      bells: !0,
      timp: [0.5],
    },
    triple_kill: {
      bpm: 150,
      mel: [
        [0, 7, 0.5, 0.9],
        [0.5, 12, 0.5, 0.95],
        [1, 15, 1.6, 1],
      ],
      bells: !0,
      timp: [1],
      cym: 1,
    },
    quadra_kill: {
      bpm: 150,
      mel: [
        [0, 7, 0.5, 0.9],
        [0.5, 12, 0.5, 0.92],
        [1, 15, 0.5, 0.96],
        [1.5, 19, 2, 1],
      ],
      oct: !0,
      bells: !0,
      timp: [0, 1.5],
      cym: 1.5,
      chord: [1.5, [0, 7, 12, 15], 2],
    },
    penta_kill: {
      bpm: 150,
      mel: [
        [0, 7, 0.5, 0.9],
        [0.5, 12, 0.5, 0.92],
        [1, 15, 0.5, 0.95],
        [1.5, 19, 0.5, 0.98],
        [2, 24, 3.2, 1],
      ],
      oct: !0,
      bells: !0,
      timp: [0, 1, 2],
      cym: 2,
      chord: [2, [0, 4, 7, 12, 16], 3.2],
      sparkle: !0,
    },
    killing_spree: {
      bpm: 160,
      mel: [
        [0, 12, 0.5, 0.8],
        [0.5, 12, 0.5, 0.8],
        [1, 15, 1.3, 0.95],
      ],
      timp: [1],
    },
    unstoppable: {
      bpm: 160,
      mel: [
        [0, 12, 0.5, 0.85],
        [0.5, 12, 0.5, 0.85],
        [1, 12, 0.5, 0.9],
        [1.5, 17, 1.8, 1],
      ],
      oct: !0,
      timp: [0, 1.5],
      cym: 1.5,
    },
    legendary: {
      bpm: 160,
      mel: [
        [0, 12, 0.5, 0.85],
        [0.5, 15, 0.5, 0.9],
        [1, 19, 0.5, 0.93],
        [1.5, 22, 0.5, 0.96],
        [2, 24, 3, 1],
      ],
      oct: !0,
      bells: !0,
      timp: [0, 0.5, 1, 1.5, 2],
      cym: 2,
      chord: [2, [0, 7, 12, 16, 19], 3],
      sparkle: !0,
    },
    shutdown: {
      bpm: 150,
      mel: [
        [0, 19, 0.5, 1],
        [0.5, 12, 1.6, 0.95],
      ],
      timp: [0.5],
      noFlip: !0,
    },
    ace: {
      bpm: 120,
      mel: [
        [0, 0, 0.75, 1],
        [1, 0, 0.4, 0.9],
        [1.5, 3, 0.4, 0.95],
        [2, 7, 3, 1],
      ],
      oct: !0,
      timp: [0, 1, 1.5, 2],
      cym: 2,
      chord: [2, [-12, 0, 7, 12, 15], 3],
      sparkle: !0,
    },
    tower_destroyed: {
      bpm: 120,
      inst: "horn",
      mel: [
        [0, 0, 1, 0.85],
        [1, 7, 2.2, 0.95],
      ],
      timp: [0, 1],
    },
    epic_slain: {
      bpm: 150,
      mel: [
        [0, 0, 0.5, 0.9],
        [0.5, 5, 0.5, 0.92],
        [1, 7, 0.5, 0.95],
        [1.5, 12, 2.2, 1],
      ],
      oct: !0,
      timp: [0, 1.5],
      cym: 1.5,
      chord: [1.5, [0, 7, 12, 16], 2.2],
      sparkle: !0,
    },
    super_minions: {
      bpm: 132,
      inst: "horn",
      mel: [
        [0, 0, 0.5, 0.8],
        [0.5, 0, 0.5, 0.8],
        [1, 3, 0.5, 0.85],
        [1.5, 5, 1.6, 0.95],
      ],
      timp: [0, 1.5],
    },
  },
  makeAnnounceCue = (cueKey, cueLabel, cueLength, loudness, useTeamVariants, onPlay?) =>
    defineSfxCue(
      "播报",
      cueLabel,
      (builder, teamVariant) => {
        const isEnemyVariant = useTeamVariants && teamVariant > 0.5
        ;(playFanfareMelody(builder, FANFARE_MELODIES[cueKey], isEnemyVariant), onPlay?.(builder, isEnemyVariant))
      },
      { ...UI_CUE_DEFAULTS, len: cueLength, loud: loudness, variants: useTeamVariants ? TEAM_VARIANTS : void 0 },
    ),
  ANNOUNCE_CUES = {
    ann_match_start: makeAnnounceCue("match_start", "战斗开始", 2.8, -14, !1, (builder) => {
      ;(sfxNoiseSnare(builder, 0.5 - 0.11, 0.4), sfxNoiseSnare(builder, 0.5 - 0.055, 0.5))
    }),
    ann_minions_spawn: makeAnnounceCue("minions_spawn", "小兵出击", 1.5, -19, !1),
    ann_first_blood: makeAnnounceCue("first_blood", "首杀", 1.9, -14, !0, (builder, isEnemyVariant) => {
      ;(isEnemyVariant || builder.ring(2600, [1, 1.48, 2.36], { a: 0.001, d: 0.5, g: 0.07 }), builder.noise({ flt: "bandpass", fc: 3e3, fc1: 6e3, q: 2, a: 0.01, d: 0.1, g: 0.2 }))
    }),
    ann_double_kill: makeAnnounceCue("double_kill", "双杀", 1.3, -16, !0),
    ann_triple_kill: makeAnnounceCue("triple_kill", "三杀", 1.5, -15, !0),
    ann_quadra_kill: makeAnnounceCue("quadra_kill", "四杀", 2, -14, !0),
    ann_penta_kill: makeAnnounceCue("penta_kill", "五杀", 3, -12, !0),
    ann_killing_spree: makeAnnounceCue("killing_spree", "连杀 3", 1.3, -17, !0),
    ann_unstoppable: makeAnnounceCue("unstoppable", "连杀 5", 1.6, -15, !0),
    ann_legendary: makeAnnounceCue("legendary", "连杀 7+", 2.6, -13, !0),
    ann_shutdown: makeAnnounceCue("shutdown", "终结", 1.4, -16, !0, (builder) => {
      builder.noise({ flt: "bandpass", fc: 5e3, fc1: 1200, q: 1.5, a: 0.004, d: 0.14, g: 0.4 })
    }),
    ann_ace: makeAnnounceCue("ace", "团灭", 3.2, -12, !0),
    ann_tower_destroyed: makeAnnounceCue("tower_destroyed", "摧毁防御塔", 2.2, -17, !0, (builder) => {
      builder.noise({ k: "brown", flt: "lowpass", fc: 300, a: 0.05, d: 0.9, g: 0.2 })
    }),
    ann_epic_spawn: defineSfxCue(
      "播报",
      "史诗野怪出现",
      (builder) => {
        const lowpassFilter = builder.filt("lowpass", 300, 1)
        ;(builder.ramp(lowpassFilter.frequency, [
          [0, 300],
          [0.9, 2200],
          [2, 500],
        ]),
          [38, 50, 57, 63].forEach((midiNote, voiceIndex) => {
            builder.osc({ w: "softsaw", f: midiToFrequency(midiNote), det: voiceIndex * 5 - 8, a: 0.8, h: 0.2, d: 0.9, g: 0.22, to: lowpassFilter })
          }),
          sfxBellTone(builder, midiToFrequency(38), 0, 0.7),
          sfxBellTone(builder, midiToFrequency(38), 0.85, 0.85),
          builder.noise({ k: "brown", flt: "lowpass", fc: 200, a: 0.6, h: 0.3, d: 0.9, g: 0.25 }),
          sfxStringDraw(builder, midiToFrequency(62), 0.85, 0.9, 0.8),
          sfxStringDraw(builder, midiToFrequency(63), 0.85, 0.9, 0.5),
          sfxSwingWhoosh(builder, midiToFrequency(50), 0.85, 0.9, 0.9, 0.8),
          sfxSwingWhoosh(builder, midiToFrequency(56), 0.85, 0.9, 0.7, 0.8))
      },
      { ...UI_CUE_DEFAULTS, len: 2.4, loud: -15 },
    ),
    ann_epic_slain: makeAnnounceCue("epic_slain", "史诗野怪被击杀", 2.2, -14, !0),
    ann_super_minions: makeAnnounceCue("super_minions", "超级兵出击", 1.7, -17, !0),
    ann_victory: defineSfxCue(
      "播报",
      "胜利(冲击音)",
      (builder) => {
        ;(sfxBellTone(builder, midiToFrequency(38), 0, 0.9),
          sfxBellTone(builder, midiToFrequency(45), 0.12, 0.6),
          sfxMetalRing(builder, 0, 0.8, 2.2),
          [50, 57, 62, 66, 69, 74].forEach((midiNote, noteIndex) => sfxSwingWhoosh(builder, midiToFrequency(midiNote), noteIndex * 0.007, 1.2, 0.8 - noteIndex * 0.05, 1.1)),
          sfxFormantChant(builder, [midiToFrequency(62), midiToFrequency(66), midiToFrequency(69), midiToFrequency(74)], 0.01, 1.4, 0.5),
          [74, 78, 81, 86, 90].forEach((midiNote, noteIndex) => sfxFmImpact(builder, midiToFrequency(midiNote), 0.08 + noteIndex * 0.06, 1, 0.45)))
      },
      { ...UI_CUE_DEFAULTS, len: 2.6, loud: -12 },
    ),
    ann_defeat: defineSfxCue(
      "播报",
      "失败(冲击音)",
      (builder) => {
        ;(sfxBellTone(builder, midiToFrequency(38), 0, 1),
          sfxBellTone(builder, midiToFrequency(33), 0.5, 0.7),
          builder.noise({ k: "pink", flt: "lowpass", fc: 2400, fc1: 200, a: 0.004, d: 1.8, g: 0.5 }),
          [38, 45, 50, 53, 57].forEach((midiNote, noteIndex) => sfxSwingWhoosh(builder, midiToFrequency(midiNote), noteIndex * 0.009, 1.5, 0.8 - noteIndex * 0.05, 0.75)))
        const lowpassFilter = builder.filt("lowpass", 900, 1)
        ;(builder.osc({ w: "softsaw", f: midiToFrequency(69), f1: midiToFrequency(62), ft: 1.4, a: 0.1, h: 0.6, d: 0.9, g: 0.18, to: lowpassFilter }),
          builder.osc({ w: "softsaw", f: midiToFrequency(65), f1: midiToFrequency(57), ft: 1.4, a: 0.1, h: 0.6, d: 0.9, g: 0.14, to: lowpassFilter }))
      },
      { ...UI_CUE_DEFAULTS, len: 2.8, loud: -13 },
    ),
  },
  CLASH_PARTIALS = [1, 1.52, 2.27, 3.05],
  DRUM_PARTIALS = [1, 2.76, 5.4]

/**
 * 播放界面。
 *
 * @param builder - 主要输入
 * @param startTime - 次要输入
 * @param gain - 第三输入
 * @param pitchScale - 第四输入
 * @param decay - 附加输入
 * @param destination - 附加输入
 */
function playLowThud(builder, startTime, gain, pitchScale = 1, decay = 0.42, destination?) {
  ;(builder.osc({ f: 128 * pitchScale, f1: 56 * pitchScale, ft: 0.13, t: startTime, a: 0.002, d: decay, g: gain * 0.8, to: destination }),
    builder.osc({ w: "triangle", f: 250 * pitchScale, f1: 110 * pitchScale, ft: 0.08, t: startTime, a: 0.002, d: decay * 0.4, g: gain * 0.4, to: destination }),
    builder.noise({ k: "pink", flt: "lowpass", fc: 1500, fc1: 320, t: startTime, a: 0.001, d: 0.06, g: gain * 0.35, to: destination }))
}

function playMetalClash(builder, fundamental, startTime, decayTime, gain, destination?) {
  ;(builder.osc({ w: "triangle", f: 210, f1: 120, ft: 0.05, t: startTime, a: 0.001, d: 0.09, g: gain * 0.55, to: destination }),
    builder.noise({ k: "pink", flt: "bandpass", fc: 520, q: 1.4, t: startTime, a: 0.001, d: 0.045, g: gain * 0.6, to: destination }))
  for (let index = 0; index < CLASH_PARTIALS.length; index++) {
    const partialFreq = fundamental * CLASH_PARTIALS[index],
      partialGain = (gain * 0.45) / (1 + index * 0.6),
      partialDecay = decayTime / (1 + index * 0.4)
    ;(builder.osc({ f: partialFreq, t: startTime, a: 0.002, d: partialDecay, g: partialGain, to: destination }), index < 2 && builder.osc({ f: partialFreq * 1.013, t: startTime, a: 0.004, d: partialDecay * 0.9, g: partialGain * 0.6, to: destination }))
  }
  ;(builder.osc({ f: fundamental * 5.3, t: startTime, a: 0.001, d: Math.min(0.2, decayTime * 0.3), g: gain * 0.12, to: destination }), builder.noise({ flt: "bandpass", fc: Math.min(4200, fundamental * 4.2), q: 3, t: startTime, a: 0.001, d: 0.03, g: gain * 0.3, to: destination }))
}

function playWarHorn(builder, startTime, duration, gain, baseFrequency = 135, destination?) {
  const gainResult = builder.gain(1.5, destination),
    GainValue = builder.ctx.createGain()
  ;(GainValue.connect(builder.filt("bandpass", 700, 3, gainResult)),
    GainValue.connect(builder.filt("bandpass", 1150, 3.5, gainResult)),
    GainValue.connect(builder.filt("bandpass", 2600, 3, builder.gain(0.35, gainResult))),
    builder.osc({ w: "sawtooth", f: baseFrequency * 1.18, f1: baseFrequency * 0.8, ft: duration, t: startTime, a: 0.02, h: duration * 0.3, d: duration * 0.7, g: gain, vib: 60, vr: 31, vd: 0, to: GainValue }),
    builder.noise({ k: "pink", t: startTime, a: 0.015, h: duration * 0.2, d: duration * 0.8, g: gain * 0.5, to: GainValue }))
}

/**
 * 播放碰撞。
 *
 * @param builder - 主要输入
 * @param fundamental - 次要输入
 * @param startTime - 第三输入
 * @param gain - 第四输入
 * @param decay - 附加输入
 * @param destination - 附加输入
 */
function playDrumHit(builder, fundamental, startTime, gain, decay = 0.2, destination?) {
  ;(builder.osc({ w: "triangle", f: 190, f1: 75, ft: 0.07, t: startTime, a: 0.001, d: 0.12, g: gain * 0.35, to: destination }), builder.noise({ flt: "bandpass", fc: 2100, q: 0.9, t: startTime, a: 0.001, d: 0.035, g: gain * 0.6, to: destination }))
  for (let index = 0; index < DRUM_PARTIALS.length; index++) builder.osc({ f: fundamental * DRUM_PARTIALS[index], t: startTime, a: 0.001, d: decay / (1 + index * 0.5), g: (gain * 0.55) / (1 + index * 0.5), to: destination })
  builder.osc({ w: "triangle", f: fundamental * 1.47, t: startTime, a: 0.001, d: decay * 0.5, g: gain * 0.2, to: destination })
}

function playNoiseSweep(soundBuilder, startTime, sweepDuration, gain, startFrequency, midFrequency, endFrequency, resonance = 1.2, noiseKind = "white", destination?) {
  const sweepFilter = soundBuilder.filt("bandpass", startFrequency, resonance, destination)
  ;(soundBuilder.ramp(sweepFilter.frequency, [
    [startTime, startFrequency],
    [startTime + sweepDuration * 0.45, midFrequency],
    [startTime + sweepDuration, endFrequency],
  ]),
    soundBuilder.noise({ k: noiseKind, t: startTime, a: sweepDuration * 0.4, d: sweepDuration * 0.6, g: gain * 2.4, to: sweepFilter }))
}

function playPluckedString(builder, frequency, startTime, decay, gain, glideFrequency?, destination?) {
  const lowpassFilter = builder.filt("lowpass", 2e3, 1.3, destination),
    initialCutoffFrequency = Math.min(9e3, frequency * 7 + 1500)
  if (
    (builder.ramp(lowpassFilter.frequency, [
      [startTime, initialCutoffFrequency],
      [startTime + 0.045, Math.max(1500, frequency * 3.5)],
      [startTime + Math.max(0.1, decay), Math.max(800, frequency * 1.6)],
    ]),
    glideFrequency === void 0)
  )
    builder.osc({ w: "string", f: frequency * 1.014, f1: frequency, ft: 0.035, t: startTime, a: 0.001, d: decay, g: gain * 1.5, to: lowpassFilter })
  else {
    const glideTime = Math.min(0.12, decay * 0.3)
    builder.osc({ w: "string", f: frequency, f1: glideFrequency, ft: glideTime, t: startTime, a: 0.001, h: glideTime * 0.6, d: decay, g: gain * 1.5, to: lowpassFilter })
  }
  ;(builder.osc({ w: "string", f: (glideFrequency ?? frequency) * 2.003, t: startTime + 0.002, a: 0.001, d: decay * 0.4, g: gain * 0.25, to: lowpassFilter }),
    builder.noise({ flt: "bandpass", fc: 3400, q: 1.1, t: startTime, a: 0.001, d: 0.011, g: gain * 0.6, to: destination }),
    builder.osc({ w: "triangle", f: 330, f1: 250, t: startTime, a: 0.001, d: 0.04, g: gain * 0.25, to: destination }))
}

function playStringNote(builder, frequency, startTime, decay, gain, includeNoise, destination) {
  ;(builder.osc({ w: "string", f: frequency, t: startTime, a: 0.001, d: decay, g: gain * 1.5, to: destination }), includeNoise && builder.noise({ flt: "bandpass", fc: 3400, q: 1.1, t: startTime, a: 0.001, d: 0.008, g: gain * 0.4, to: destination }))
}

function playReedCall(builder, startTime, gain, destination?) {
  const bandpassFilter = builder.filt("bandpass", 1250, 2.2, destination)
  ;(builder.osc({ w: "reed", f: 500, f1: 430, t: startTime, a: 0.015, h: 0.05, d: 0.07, g: gain, to: bandpassFilter }), builder.osc({ w: "reed", f: 610, f1: 470, t: startTime + 0.15, a: 0.02, h: 0.08, d: 0.14, g: gain * 1.1, to: bandpassFilter }))
}

function playBambooFlute(builder, frequency, startTime, decay, gain, destination?) {
  const lowpassFilter = builder.filt("lowpass", 3e3, 0.9, destination)
  ;(builder.ramp(lowpassFilter.frequency, [
    [startTime, Math.min(12e3, frequency * 12)],
    [startTime + 0.03, Math.max(1800, frequency * 4)],
    [startTime + Math.max(0.08, decay), Math.max(900, frequency * 2)],
  ]),
    builder.osc({ w: "zhu", f: frequency, det: -6, t: startTime, a: 0.001, d: decay, g: gain * 1, to: lowpassFilter }),
    builder.osc({ w: "zhu", f: frequency, det: 7, t: startTime + 0.003, a: 0.001, d: decay * 0.85, g: gain * 0.75, to: lowpassFilter }),
    builder.noise({ flt: "bandpass", fc: 2600, q: 2, t: startTime, a: 0.001, d: 0.008, g: gain * 0.5, to: destination }),
    builder.osc({ f: 1250, f1: 800, t: startTime, a: 0.001, d: 0.012, g: gain * 0.15, to: destination }))
}

function playPluckLead(builder, frequency, startTime, decay, gain, destination?) {
  const lowpassFilter = builder.filt("lowpass", 2600, 1.2, destination)
  ;(builder.ramp(lowpassFilter.frequency, [
    [startTime, 2600],
    [startTime + decay * 0.8, 420],
  ]),
    builder.osc({ w: "triangle", f: frequency * 1.16, f1: frequency, ft: 0.045, t: startTime, a: 0.001, d: decay, g: gain * 0.7, to: lowpassFilter }),
    builder.osc({ w: "softsaw", f: frequency * 2.32, f1: frequency * 2, ft: 0.045, t: startTime, a: 0.001, d: decay * 0.5, g: gain * 0.3, to: lowpassFilter }),
    builder.noise({ flt: "bandpass", fc: 1900, q: 1.6, t: startTime, a: 0.001, d: 0.012, g: gain * 0.45, to: destination }))
}

/**
 * 播放怪物。
 *
 * @param builder - 构建器
 * @param startTime - 次要输入
 * @param duration - 第三输入
 * @param gain - 第四输入
 * @param destination - 附加输入
 */
function playMonsterGrowl(builder, startTime, duration, gain, destination?) {
  const bandpassFilter = builder.filt("bandpass", 600, 5, destination)
  builder.ramp(bandpassFilter.frequency, [
    [startTime, 600],
    [startTime + duration, 1100],
  ])
  const tremoloGain = builder.gain(0.5, bandpassFilter)
  ;(builder.lfo(tremoloGain.gain, 34, 0.5, startTime, duration, 52), builder.osc({ w: "sawtooth", f: 92, f1: 150, ft: duration, t: startTime, a: duration * 0.5, d: duration * 0.5, g: gain * 4, to: tremoloGain }), builder.noise({ k: "pink", t: startTime, a: duration * 0.5, d: duration * 0.5, g: gain * 1.6, to: tremoloGain }))
}

function playImpactTick(builder, startTime, gain, pitchScale = 1, destination?) {
  ;(builder.osc({ f: 520 * pitchScale, f1: 300 * pitchScale, t: startTime, a: 0.001, d: 0.045, g: gain * 0.7, to: destination }),
    builder.osc({ w: "triangle", f: 1040 * pitchScale, f1: 600 * pitchScale, t: startTime, a: 0.001, d: 0.02, g: gain * 0.3, to: destination }),
    builder.noise({ flt: "bandpass", fc: 1700 * pitchScale, q: 1.8, t: startTime, a: 0.001, d: 0.016, g: gain * 0.5, to: destination }),
    builder.osc({ f: 180 * pitchScale, f1: 120 * pitchScale, t: startTime, a: 0.001, d: 0.05, g: gain * 0.25, to: destination }))
}

function playSlashHiss(builder, startTime, duration, gain, startCutoff, endCutoff?, destination?) {
  const attackTime = Math.min(0.03, duration * 0.3)
  ;(builder.noise({ flt: "bandpass", fc: startCutoff, fc1: endCutoff, q: 7, t: startTime, a: attackTime, d: duration, g: gain, to: destination }), builder.osc({ f: startCutoff * 0.98, f1: endCutoff * 0.98, t: startTime, a: attackTime, d: duration * 0.9, g: gain * 0.07, to: destination }))
}

function playDistortedBoom(builder, startTime, duration, gain, frequency, glideFrequency, filterFrequency, peakFrequency, destination?) {
  const driveResult = builder.drive(3, builder.filt("lowpass", 3e3, 0.6, destination)),
    lowpassFilter = builder.filt("lowpass", filterFrequency, 2.2, driveResult)
  ;(builder.ramp(lowpassFilter.frequency, [
    [startTime, filterFrequency],
    [startTime + duration * 0.3, peakFrequency],
    [startTime + duration, filterFrequency],
  ]),
    builder.osc({ w: "sawtooth", f: frequency, f1: glideFrequency, ft: duration, t: startTime, a: duration * 0.12, h: duration * 0.45, d: duration * 0.45, g: gain * 0.55, vib: 80, vr: 27, vd: 0, to: lowpassFilter }),
    builder.osc({ w: "sawtooth", f: frequency * 1.49, f1: glideFrequency * 1.45, ft: duration, t: startTime, a: duration * 0.15, h: duration * 0.4, d: duration * 0.4, g: gain * 0.3, vib: 60, vr: 37, vd: 0, to: lowpassFilter }),
    builder.noise({ k: "pink", flt: "bandpass", fc: peakFrequency * 0.8, fc1: filterFrequency, q: 1.5, t: startTime, a: duration * 0.15, h: duration * 0.35, d: duration * 0.5, g: gain * 0.5, to: destination }))
}

export { METAL_PARTIALS, playSlashHiss, playDistortedBoom, playDrumHit, DRUM_PARTIALS, playReedCall, playPluckLead, playLowThud, playPluckedString, playNoiseSweep, GLASS_PARTIALS, playWarHorn, playBambooFlute, playStringNote, playMonsterGrowl, defineSfxCue, CHIME_PARTIALS, BELL_PARTIALS, playMetalClash, CRYSTAL_PARTIALS, playImpactTick, ANNOUNCE_CUES }