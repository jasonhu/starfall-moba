/**
 * 背景音乐：四首曲目（BPM 66/100/108/132）与曲目调度（MusicDirector）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MUSIC_TICK_LOOKAHEAD_S, shiftNoteUpMajorScale, MUSIC_TRACK_START_DELAY_S, MUSIC_STINGER_START_DELAY_S } from './sfx-engine'
import { SynthVoice } from './synth-voice'
import { sfxBellTone, sfxBrightPing, sfxChordPad, sfxClickTick, sfxDeepBoom, sfxExplosion, sfxFmImpact, sfxFormantChant, sfxGlassChime, sfxLowThud, sfxMetalRing, sfxNoiseHiss, sfxNoiseSnare, sfxNoiseWhoosh, sfxPitchDropHit, sfxStringDraw, sfxSustainedWind, sfxSwingWhoosh, sfxTripleTap } from './sfx-synth'
import { midiToFrequency } from './audio-math'

/** intro 和弦条目：[起始步, 根音 midi, 和弦音 midi 列表, 时值]；元组标注避免异构数组被推断为 (number | number[])[]。 */
type IntroChordTuple = [number, number, number[], number]

/** 把 [和弦序号, 音符] 列表按和弦序号分桶（每桶一个和弦的音符） */
function bucketNotesByChord(notes, chordCount) {
  const buckets = []
  for (let index = 0; index < chordCount; index++) buckets.push([])
  for (const note of notes) buckets[note[0]].push(note)
  return buckets
}

const MUSIC_MENU_CHORD_VOICINGS = [
    { bass: 41, pad: [57, 60, 64, 67] },
    { bass: 41, pad: [55, 59, 62, 67] },
    { bass: 40, pad: [55, 59, 62, 64] },
    { bass: 45, pad: [55, 59, 60, 64] },
    { bass: 41, pad: [57, 60, 64, 67] },
    { bass: 43, pad: [55, 59, 62, 64] },
    { bass: 45, pad: [55, 59, 60, 64] },
    { bass: 40, pad: [55, 60, 62, 64] },
    { bass: 38, pad: [53, 57, 60, 64] },
    { bass: 40, pad: [55, 59, 62, 64] },
    { bass: 41, pad: [57, 59, 60, 64] },
    { bass: 43, pad: [59, 62, 64, 67] },
    { bass: 38, pad: [53, 57, 60, 64] },
    { bass: 40, pad: [55, 59, 62, 64] },
    { bass: 41, pad: [57, 60, 64, 67] },
    { bass: 43, pad: [55, 60, 62, 67] },
  ],
  MUSIC_MENU_MELODY_NOTES = [
    [0, 74, 2, 0.8],
    [2, 81, 3, 0.9],
    [5, 79, 1, 0.6],
    [6, 77, 2, 0.7],
    [8, 76, 2, 0.7],
    [10, 72, 2, 0.6],
    [12, 74, 4, 0.8],
    [16, 76, 2, 0.75],
    [18, 83, 3, 0.85],
    [21, 81, 1, 0.6],
    [22, 79, 2, 0.7],
    [24, 76, 2, 0.65],
    [26, 74, 2, 0.55],
    [28, 76, 4, 0.7],
    [32, 81, 2, 0.8],
    [34, 84, 3, 0.9],
    [37, 83, 1, 0.65],
    [38, 81, 2, 0.7],
    [40, 79, 3, 0.75],
    [43, 76, 1, 0.55],
    [44, 79, 4, 0.7],
    [48, 81, 6, 0.8],
    [54, 79, 2, 0.6],
    [56, 76, 8, 0.7],
    [64, 77, 3, 0.7],
    [67, 76, 1, 0.5],
    [68, 74, 4, 0.65],
    [72, 79, 3, 0.72],
    [75, 77, 1, 0.5],
    [76, 76, 4, 0.65],
    [80, 81, 3, 0.78],
    [83, 79, 1, 0.55],
    [84, 83, 4, 0.75],
    [88, 86, 4, 0.85],
    [92, 83, 2, 0.65],
    [94, 79, 2, 0.6],
    [96, 77, 3, 0.7],
    [99, 76, 1, 0.5],
    [100, 74, 2, 0.6],
    [102, 81, 2, 0.7],
    [104, 79, 6, 0.72],
    [110, 76, 2, 0.55],
    [112, 76, 2, 0.7],
    [114, 72, 2, 0.6],
    [116, 74, 4, 0.75],
    [120, 79, 4, 0.65],
    [124, 71, 2, 0.5],
    [126, 72, 2, 0.55],
  ],
  MUSIC_MENU_MELODY_BY_CHORD = bucketNotesByChord(MUSIC_MENU_MELODY_NOTES, 128),
  MUSIC_ARP_PATTERNS = [
    [0, 1, 2, 3, 2, 1, 2, 3],
    [0, 2, 1, 3, 0, 2, 3, 1],
    [3, 2, 1, 0, 1, 2, 3, 2],
  ]

class MusicTrackBpm66 extends SynthVoice {
  cPad = this.chan("cPad", 0.51, { rev: 0.4 })
  cBass = this.chan("cBass", 0.24, { rev: 0.1 })
  cBell = this.chan("cBell", 1, { rev: 0.55, dly: 0.4 })
  cFlute = this.chan("cFlute", 0.64, { rev: 0.5, dly: 0.25, pan: 0.15 })
  cArp = this.chan("cArp", 1.24, { rev: 0.35, dly: 0.35, pan: -0.25 })
  cStarL = this.chan("cStarL", 1.14, { rev: 0.7, dly: 0.3, pan: -0.6 })
  cStarR = this.chan("cStarR", 1.14, { rev: 0.7, dly: 0.3, pan: 0.6 })
  constructor(music, startTime) {
    super(music, startTime, (60 / 66) * 0.75)
  }
  stepDur() {
    return 60 / 66 / 2
  }
  onStep(step, nextT, stepDur) {
    const chordCycleIndex = Math.floor(step / 128),
      stepInCycle = step % 128,
      chordIndex = stepInCycle >> 3,
      stepInChord = stepInCycle & 7,
      selectedMUSIC_MENU_CHORD_VOICINGS = MUSIC_MENU_CHORD_VOICINGS[chordIndex],
      isFinalChord = chordIndex === 15
    if (stepInChord === 0) {
      const padDuration = isFinalChord ? stepDur * 4 : stepDur * 8
      ;(this.play(this.cPad, nextT, (padVoice) => sfxChordPad(padVoice, selectedMUSIC_MENU_CHORD_VOICINGS.pad.map(midiToFrequency), 0, padDuration, 0.9)), this.play(this.cBass, nextT, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(selectedMUSIC_MENU_CHORD_VOICINGS.bass), 0, stepDur * 7, 0.7)))
    }
    if (
      (isFinalChord && stepInChord === 4 && this.play(this.cPad, nextT, (padVoice) => sfxChordPad(padVoice, [55, 59, 62, 67].map(midiToFrequency), 0, stepDur * 4, 0.9)),
      stepInChord === 4 && chordIndex % 2 === 1 && !isFinalChord && this.play(this.cBass, nextT, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(selectedMUSIC_MENU_CHORD_VOICINGS.bass + 7), 0, stepDur * 3, 0.4)),
      !(chordCycleIndex % 4 === 2 && chordIndex < 4))
    )
      for (const MUSIC_MENU_MELODY_BY_CHORDa of MUSIC_MENU_MELODY_BY_CHORD[stepInCycle]) {
        const noteDuration = MUSIC_MENU_MELODY_BY_CHORDa[2] * stepDur
        chordCycleIndex % 2 === 0 ? this.play(this.cBell, nextT, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(MUSIC_MENU_MELODY_BY_CHORDa[1]), 0, Math.max(1.6, noteDuration * 1.5), MUSIC_MENU_MELODY_BY_CHORDa[3])) : this.play(this.cFlute, nextT, (fluteVoice) => sfxGlassChime(fluteVoice, midiToFrequency(MUSIC_MENU_MELODY_BY_CHORDa[1] - 12), 0, noteDuration * 0.95, MUSIC_MENU_MELODY_BY_CHORDa[3]))
      }
    if (chordCycleIndex > 0 || chordIndex >= 4) {
      const selectedMUSIC_ARP_PATTERNS = MUSIC_ARP_PATTERNS[(chordCycleIndex + (chordIndex >> 2)) % MUSIC_ARP_PATTERNS.length],
        arpNote = selectedMUSIC_MENU_CHORD_VOICINGS.pad[selectedMUSIC_ARP_PATTERNS[stepInChord]] + 12,
        arpIntensity = stepInChord % 2 === 0 ? 0.55 : 0.38
      this.play(this.cArp, nextT, (arpVoice) => sfxExplosion(arpVoice, midiToFrequency(arpNote), 0, 0.5, arpIntensity))
    }
    if (this.rnd() < 0.17) {
      const starNotePitch = selectedMUSIC_MENU_CHORD_VOICINGS.pad[Math.floor(this.rnd() * selectedMUSIC_MENU_CHORD_VOICINGS.pad.length)] + 24 + (this.rnd() < 0.3 ? 12 : 0),
        starStartOffset = this.rnd() * stepDur * 0.6,
        starIntensity = 0.15 + this.rnd() * 0.22
      this.play(this.rnd() < 0.5 ? this.cStarL : this.cStarR, nextT, (starVoice) => sfxFmImpact(starVoice, midiToFrequency(starNotePitch), starStartOffset, 1.3, starIntensity))
    }
  }
}

const MUSIC_CHORD_DM7 = { bass: 38, pad: [53, 57, 62, 64] },
  MUSIC_CHORD_CADD9 = { bass: 36, pad: [52, 55, 60, 62] },
  MUSIC_CHORD_BM7 = { bass: 35, pad: [55, 57, 59, 62] },
  MUSIC_CHORD_AM7 = { bass: 33, pad: [55, 57, 60, 64] },
  MUSIC_CHORD_FMAJ7 = { bass: 41, pad: [53, 57, 60, 64] },
  MUSIC_CHORD_G6 = { bass: 43, pad: [55, 59, 62, 64] },
  MUSIC_CHORD_DM9_OVER_A = { bass: 33, pad: [57, 62, 64, 65] },
  MUSIC_CHORD_ASUS4 = { bass: 33, pad: [57, 62, 64, 69] },
  MUSIC_COMBAT_CHORD_PROGRESSION = [MUSIC_CHORD_DM7, MUSIC_CHORD_DM7, MUSIC_CHORD_CADD9, MUSIC_CHORD_CADD9, MUSIC_CHORD_BM7, MUSIC_CHORD_BM7, MUSIC_CHORD_AM7, MUSIC_CHORD_AM7, MUSIC_CHORD_FMAJ7, MUSIC_CHORD_G6, MUSIC_CHORD_AM7, MUSIC_CHORD_AM7, MUSIC_CHORD_FMAJ7, MUSIC_CHORD_G6, MUSIC_CHORD_DM9_OVER_A, MUSIC_CHORD_ASUS4],
  MUSIC_COMBAT_CHORD_DURATIONS = [2, 0, 2, 0, 2, 0, 2, 0, 1, 1, 2, 0, 1, 1, 1, 1],
  MUSIC_COMBAT_MELODY_NOTES = [
    [0, 74, 4, 0.85],
    [4, 81, 6, 0.95],
    [10, 79, 2, 0.7],
    [12, 77, 4, 0.8],
    [16, 76, 4, 0.8],
    [20, 72, 4, 0.7],
    [24, 74, 8, 0.85],
    [32, 76, 4, 0.8],
    [36, 79, 6, 0.9],
    [42, 76, 2, 0.65],
    [44, 74, 4, 0.75],
    [48, 72, 4, 0.7],
    [52, 74, 4, 0.75],
    [56, 76, 8, 0.8],
    [64, 74, 4, 0.8],
    [68, 83, 6, 0.95],
    [74, 81, 2, 0.7],
    [76, 79, 4, 0.8],
    [80, 81, 4, 0.8],
    [84, 83, 4, 0.85],
    [88, 86, 8, 0.95],
    [96, 84, 6, 0.95],
    [102, 83, 2, 0.7],
    [104, 81, 4, 0.8],
    [108, 79, 4, 0.75],
    [112, 81, 6, 0.85],
    [118, 76, 2, 0.65],
    [120, 81, 8, 0.85],
    [128, 81, 3, 0.9],
    [131, 81, 3, 0.8],
    [134, 84, 2, 0.85],
    [136, 81, 4, 0.85],
    [140, 77, 4, 0.75],
    [144, 83, 3, 0.9],
    [147, 83, 3, 0.8],
    [150, 86, 2, 0.85],
    [152, 83, 4, 0.85],
    [156, 79, 4, 0.75],
    [160, 84, 3, 0.92],
    [163, 84, 3, 0.82],
    [166, 88, 2, 0.9],
    [168, 86, 4, 0.88],
    [172, 84, 4, 0.8],
    [176, 81, 8, 0.85],
    [188, 76, 2, 0.65],
    [190, 79, 2, 0.7],
    [192, 81, 3, 0.9],
    [195, 81, 3, 0.8],
    [198, 84, 2, 0.85],
    [200, 81, 4, 0.85],
    [204, 77, 4, 0.75],
    [208, 83, 3, 0.9],
    [211, 83, 3, 0.8],
    [214, 86, 2, 0.85],
    [216, 88, 4, 0.92],
    [220, 86, 4, 0.85],
    [224, 89, 6, 1],
    [230, 88, 2, 0.8],
    [232, 86, 4, 0.9],
    [236, 81, 4, 0.8],
    [240, 81, 4, 0.8],
    [244, 76, 4, 0.7],
    [248, 81, 8, 0.9],
  ],
  MUSIC_COMBAT_MELODY_BY_CHORD = bucketNotesByChord(MUSIC_COMBAT_MELODY_NOTES, 256),
  MUSIC_EXPLORE_PERC_DROP_PATTERN = [0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0],
  MUSIC_EXPLORE_PERC_PING_PATTERN = [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0.25],
  MUSIC_EXPLORE_PERC_CLICK_PATTERN = [0.4, 0, 0.28, 0, 0.4, 0, 0.28, 0.14, 0.4, 0, 0.28, 0, 0.4, 0, 0.28, 0.14],
  MUSIC_COMBAT_PERC_DROP_PATTERN = [1, 0, 0, 0, 0, 0, 0.6, 0, 0.9, 0, 0.5, 0, 0, 0, 0, 0],
  MUSIC_COMBAT_PERC_SNARE_PATTERN = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.3],
  MUSIC_COMBAT_PERC_DEEP_BOOM_PATTERN = [1, 0, 0, 0.7, 0, 0, 0.8, 0, 1, 0, 0, 0.6, 0, 0, 0.75, 0],
  MUSIC_COMBAT_PERC_DEEP_BOOM_SUSTAINED_PATTERN = [0, 0, 0.4, 0, 0, 0.4, 0, 0, 0, 0, 0.4, 0, 0.5, 0, 0, 0.45],
  MUSIC_COMBAT_PERC_HIHAT_PATTERN = [0.5, 0.2, 0.35, 0.2, 0.5, 0.2, 0.35, 0.25, 0.5, 0.2, 0.35, 0.2, 0.5, 0.2, 0.4, 0.3],
  MUSIC_COMBAT_BASS_OCTAVE_OFFSETS = [0, 0, 12, 0, 0, 12, 0, 7]

class MusicTrackBpm108 extends SynthVoice {
  lExplore = this.layer(1)
  lCombat = this.layer(0)
  I = 0
  tension = 0
  applied = -1
  cPad = this.chan("cPad", 0.51, { rev: 0.35 })
  eBass = this.chan("eBass", 0.21, { layer: this.lExplore })
  eArp = this.chan("eArp", 1.34, { layer: this.lExplore, rev: 0.3, dly: 0.35, pan: -0.3 })
  eBell = this.chan("eBell", 1.24, { layer: this.lExplore, rev: 0.5, dly: 0.35, pan: 0.2 })
  eFlute = this.chan("eFlute", 0.6, { layer: this.lExplore, rev: 0.45, dly: 0.2, pan: 0.1 })
  ePerc = this.chan("ePerc", 0.7, { layer: this.lExplore, rev: 0.15 })
  cBass = this.chan("cBass", 0.35, { layer: this.lCombat })
  cDrum = this.chan("cDrum", 0.4, { layer: this.lCombat, rev: 0.16 })
  cSnare = this.chan("cSnare", 0.7, { layer: this.lCombat, rev: 0.22, pan: -0.1 })
  cHat = this.chan("cHat", 1.8, { layer: this.lCombat, rev: 0.08, pan: 0.25 })
  cStr = this.chan("cStr", 1.28, { layer: this.lCombat, rev: 0.25, pan: -0.2 })
  cBrass = this.chan("cBrass", 0.4, { layer: this.lCombat, rev: 0.35, dly: 0.12 })
  cLow = this.chan("cLow", 0.37, { layer: this.lCombat, rev: 0.3 })
  constructor(music, startTime) {
    super(music, startTime, (60 / 108) * 0.75)
  }
  mood(intensity, tensionLevel) {
    ;((this.I = intensity),
      (this.tension = tensionLevel),
      !(Math.abs(intensity - this.applied) < 0.01) && ((this.applied = intensity), this.setLayer(this.lExplore, Math.cos((intensity * Math.PI) / 2), 0.15), this.setLayer(this.lCombat, Math.sin((intensity * Math.PI) / 2), 0.15)))
  }
  stepDur() {
    return 60 / (108 * (1 + 0.07 * this.tension)) / 4
  }
  onStep(step, nextTime, stepDur) {
    const chordCycleIndex = Math.floor(step / 256),
      stepInCycle = step % 256,
      chordIndex = stepInCycle >> 4,
      stepInChord = stepInCycle & 15,
      chordHalfIndex = chordIndex >> 3,
      selectedMUSIC_COMBAT_CHORD_PROGRESSION = MUSIC_COMBAT_CHORD_PROGRESSION[chordIndex],
      combatActive = this.I > 0.04,
      exploreActive = this.I < 0.97,
      isFillBar = chordIndex === 7 || chordIndex === 15,
      timingJitter = () => (this.rnd() - 0.5) * 0.006
    if (stepInChord === 0 && MUSIC_COMBAT_CHORD_DURATIONS[chordIndex] > 0) {
      const padDuration = stepDur * 16 * MUSIC_COMBAT_CHORD_DURATIONS[chordIndex]
      this.play(this.cPad, nextTime, (padVoice) => sfxChordPad(padVoice, selectedMUSIC_COMBAT_CHORD_PROGRESSION.pad.map(midiToFrequency), 0, padDuration, 0.85, 1 + this.I * 0.6))
    }
    const melodyVariationPhase = chordCycleIndex % 4,
      hasExploreMelody = melodyVariationPhase === 0 || melodyVariationPhase === 3 || (melodyVariationPhase === 1 ? chordHalfIndex === 1 : chordHalfIndex === 0),
      addUpperNote = melodyVariationPhase === 3 && chordHalfIndex === 1,
      chordMelodyNotes = hasExploreMelody ? MUSIC_COMBAT_MELODY_BY_CHORD[stepInCycle] : null
    if (exploreActive) {
      if (stepInChord === 0 && MUSIC_COMBAT_CHORD_DURATIONS[chordIndex] > 0) {
        const bassDuration = stepDur * 16 * MUSIC_COMBAT_CHORD_DURATIONS[chordIndex]
        this.play(this.eBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass), 0, bassDuration * 0.85, 0.75))
      }
      if ((stepInChord === 14 && (chordIndex === 15 || MUSIC_COMBAT_CHORD_DURATIONS[chordIndex + 1] > 0) && this.play(this.eBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass + 12), 0, stepDur * 1.6, 0.45, 0.3)), (stepInChord & 1) === 0 && (chordCycleIndex > 0 || chordIndex >= 2))) {
        const arpPattern = MUSIC_ARP_PATTERNS[(chordCycleIndex + chordHalfIndex) % MUSIC_ARP_PATTERNS.length],
          arpNote = selectedMUSIC_COMBAT_CHORD_PROGRESSION.pad[arpPattern[stepInChord >> 1]] + 12
        this.play(this.eArp, nextTime + timingJitter(), (arpVoice) => sfxExplosion(arpVoice, midiToFrequency(arpNote), 0, 0.32, (stepInChord & 3) === 0 ? 0.6 : 0.42))
      }
      if (
        (MUSIC_EXPLORE_PERC_DROP_PATTERN[stepInChord] > 0 && this.play(this.ePerc, nextTime, (percussionVoice) => sfxPitchDropHit(percussionVoice, 0, MUSIC_EXPLORE_PERC_DROP_PATTERN[stepInChord] * 0.55)),
        MUSIC_EXPLORE_PERC_PING_PATTERN[stepInChord] > 0 && this.play(this.ePerc, nextTime + timingJitter(), (percussionVoice) => sfxBrightPing(percussionVoice, 0, MUSIC_EXPLORE_PERC_PING_PATTERN[stepInChord])),
        MUSIC_EXPLORE_PERC_CLICK_PATTERN[stepInChord] > 0 && this.play(this.ePerc, nextTime + timingJitter(), (percussionVoice) => sfxClickTick(percussionVoice, 0, MUSIC_EXPLORE_PERC_CLICK_PATTERN[stepInChord] * (0.85 + this.rnd() * 0.3))),
        chordMelodyNotes)
      )
        for (const melodyNote of chordMelodyNotes) {
          const melodyNoteDuration = melodyNote[2] * stepDur
          melodyVariationPhase === 2 ? this.play(this.eFlute, nextTime, (fluteVoice) => sfxGlassChime(fluteVoice, midiToFrequency(melodyNote[1] - 12), 0, melodyNoteDuration * 0.92, melodyNote[3])) : this.play(this.eBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(melodyNote[1]), 0, Math.max(0.9, melodyNoteDuration * 1.4), melodyNote[3] * 0.9))
        }
    }
    if (combatActive) {
      if ((stepInChord & 1) === 0) {
        const bassNote = (selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass < 36 ? selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass + 12 : selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass) + MUSIC_COMBAT_BASS_OCTAVE_OFFSETS[stepInChord >> 1]
        this.play(this.cBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(bassNote), 0, stepDur * 1.5, (stepInChord & 3) === 0 ? 0.85 : 0.65, 0.8))
      }
      const isFillEnd = isFillBar && stepInChord >= 12
      if (
        (MUSIC_COMBAT_PERC_DROP_PATTERN[stepInChord] > 0 && !isFillEnd && this.play(this.cDrum, nextTime, (drumVoice) => sfxPitchDropHit(drumVoice, 0, MUSIC_COMBAT_PERC_DROP_PATTERN[stepInChord])),
        MUSIC_COMBAT_PERC_DEEP_BOOM_PATTERN[stepInChord] > 0 && !isFillEnd && this.play(this.cDrum, nextTime + timingJitter(), (drumVoice) => sfxDeepBoom(drumVoice, 0, MUSIC_COMBAT_PERC_DEEP_BOOM_PATTERN[stepInChord] * (0.9 + this.rnd() * 0.15), 1)),
        MUSIC_COMBAT_PERC_DEEP_BOOM_SUSTAINED_PATTERN[stepInChord] > 0 && !isFillEnd && this.play(this.cDrum, nextTime + timingJitter(), (drumVoice) => sfxDeepBoom(drumVoice, 0, MUSIC_COMBAT_PERC_DEEP_BOOM_SUSTAINED_PATTERN[stepInChord], 1.5)),
        MUSIC_COMBAT_PERC_SNARE_PATTERN[stepInChord] > 0 &&
          !isFillEnd &&
          this.play(this.cSnare, nextTime, (snareVoice) => {
            ;(sfxNoiseSnare(snareVoice, 0, MUSIC_COMBAT_PERC_SNARE_PATTERN[stepInChord]), MUSIC_COMBAT_PERC_SNARE_PATTERN[stepInChord] === 1 && sfxTripleTap(snareVoice, 0, 0.7))
          }),
        isFillEnd && this.play(this.cDrum, nextTime, (drumVoice) => sfxDeepBoom(drumVoice, 0, 0.5 + (stepInChord - 12) * 0.17, stepInChord % 2 ? 1.5 : 1.2)),
        this.play(this.cHat, nextTime + timingJitter(), (hatVoice) => sfxNoiseHiss(hatVoice, 0, MUSIC_COMBAT_PERC_HIHAT_PATTERN[stepInChord] * (0.85 + this.rnd() * 0.3), stepInChord === 14 && (chordIndex & 1) === 1)),
        (stepInChord & 3) !== 1)
      ) {
        const strumIndex = stepInChord >> 2,
          stringNote = selectedMUSIC_COMBAT_CHORD_PROGRESSION.pad[[0, 2, 1, 3][strumIndex]] + (strumIndex === 3 ? 12 : 0)
        this.play(this.cStr, nextTime + timingJitter(), (stringVoice) => sfxSustainedWind(stringVoice, midiToFrequency(stringNote), 0, 0.14, (stepInChord & 3) === 0 ? 0.85 : 0.55))
      }
      if (
        (stepInChord === 0 &&
          MUSIC_COMBAT_CHORD_DURATIONS[chordIndex] > 0 &&
          this.play(this.cLow, nextTime, (lowVoice) => {
            ;(sfxSwingWhoosh(lowVoice, midiToFrequency(selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass + 12), 0, stepDur * 6, 0.8, 0.7), sfxSwingWhoosh(lowVoice, midiToFrequency(selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass + 19), 0, stepDur * 6, 0.6, 0.7), sfxBellTone(lowVoice, midiToFrequency(selectedMUSIC_COMBAT_CHORD_PROGRESSION.bass), 0, 0.7))
          }),
        stepInChord === 0 && (chordIndex === 0 || chordIndex === 8) && this.play(this.cDrum, nextTime, (drumVoice) => sfxMetalRing(drumVoice, 0, 0.55, 1.8)),
        isFillBar && stepInChord === 8 && this.play(this.cDrum, nextTime, (drumVoice) => sfxNoiseWhoosh(drumVoice, 0, stepDur * 8, 0.7)),
        chordMelodyNotes)
      )
        for (const brassNote of chordMelodyNotes) {
          const brassNoteDuration = brassNote[2] * stepDur
          this.play(this.cBrass, nextTime, (brassVoice) => {
            ;(sfxSwingWhoosh(brassVoice, midiToFrequency(brassNote[1] - 12), 0, brassNoteDuration * 0.9, brassNote[3]), addUpperNote && sfxSwingWhoosh(brassVoice, midiToFrequency(shiftNoteUpMajorScale(brassNote[1]) - 12), 0, brassNoteDuration * 0.9, brassNote[3] * 0.6))
          })
        }
      if (this.tension > 0.25) {
        const tensionNote = (stepInChord & 2) === 0 ? 81 : 86,
          tensionIntensity = (0.2 + 0.35 * this.tension) * ((stepInChord & 3) === 0 ? 1 : 0.7)
        this.play(this.cStr, nextTime, (stringVoice) => sfxSustainedWind(stringVoice, midiToFrequency(tensionNote), 0, 0.09, tensionIntensity))
      }
    }
  }
}

const MUSIC_VICTORY_MELODY_NOTES = [
    [4, 74, 1, 0.9],
    [5, 74, 1, 0.85],
    [6, 81, 3, 1],
    [9, 79, 1, 0.8],
    [10, 78, 2, 0.9],
    [12, 76, 1, 0.85],
    [13, 78, 1, 0.85],
    [14, 79, 2, 0.9],
    [16, 81, 4, 0.95],
    [20, 83, 2, 0.95],
    [22, 81, 1, 0.85],
    [23, 83, 1, 0.9],
    [24, 85, 2, 0.95],
    [26, 86, 10, 1],
  ],
  MUSIC_VICTORY_INTRO_CHORDS: IntroChordTuple[] = [
    [0, 38, [50, 57, 62, 66], 12],
    [12, 43, [55, 59, 62, 67], 4],
    [16, 45, [57, 61, 64, 69], 4],
    [20, 43, [55, 59, 62, 67], 4],
    [24, 45, [57, 61, 64, 69], 2],
    [26, 38, [50, 57, 62, 66, 69, 74], 12],
  ],
  MUSIC_VICTORY_INTRO_LENGTH = 36

class MusicTrackBpm132 extends SynthVoice {
  cPad = this.chan("cPad", 0.41, { rev: 0.4 })
  cBrass = this.chan("cBrass", 0.4, { rev: 0.4, dly: 0.12 })
  cBell = this.chan("cBell", 1.16, { rev: 0.55, dly: 0.3 })
  cBass = this.chan("cBass", 0.29)
  cDrum = this.chan("cDrum", 0.66, { rev: 0.2 })
  mel = bucketNotesByChord(MUSIC_VICTORY_MELODY_NOTES, 40)
  constructor(music, startTime) {
    super(music, startTime, (60 / 132) * 0.75)
  }
  stepDur() {
    return 60 / 132 / 2
  }
  onStep(step, nextTime, stepDur) {
    if (step < MUSIC_VICTORY_INTRO_LENGTH) {
      step < 4 &&
        (this.play(this.cDrum, nextTime, (drumVoice) => {
          ;(sfxNoiseSnare(drumVoice, 0, 0.35 + step * 0.12), sfxNoiseSnare(drumVoice, stepDur / 2, 0.4 + step * 0.12))
        }),
        step === 0 && this.play(this.cDrum, nextTime, (drumVoice) => sfxNoiseWhoosh(drumVoice, 0, stepDur * 4, 0.8)))
      for (const introChord of MUSIC_VICTORY_INTRO_CHORDS) {
        if (introChord[0] !== step) continue
        const chordDuration = introChord[3] * stepDur,
          isFinalChord = step === 26
        ;(this.play(this.cPad, nextTime, (padVoice) => {
          ;(sfxChordPad(padVoice, introChord[2].map(midiToFrequency), 0, chordDuration, 0.9, 1.4), isFinalChord && sfxFormantChant(padVoice, [62, 66, 69, 74].map(midiToFrequency), 0, chordDuration, 0.55))
        }),
          this.play(this.cBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(introChord[1]), 0, chordDuration * 0.9, 0.8, 0.4)),
          step > 0 && this.play(this.cDrum, nextTime, (drumVoice) => sfxBellTone(drumVoice, midiToFrequency(introChord[1]), 0, isFinalChord ? 0.8 : 0.6)),
          (step === 4 || isFinalChord) && this.play(this.cDrum, nextTime, (drumVoice) => sfxMetalRing(drumVoice, 0, isFinalChord ? 0.8 : 0.5, isFinalChord ? 2.6 : 1.5)))
      }
      step >= 4 && step < 26 && (this.play(this.cDrum, nextTime, (snareVoice) => sfxNoiseSnare(snareVoice, 0, step % 2 === 0 ? 0.5 : 0.28)), step % 4 === 3 && this.play(this.cDrum, nextTime, (ghostSnareVoice) => sfxNoiseSnare(ghostSnareVoice, stepDur / 2, 0.25)))
      for (const melt of this.mel[step]) {
        const noteDuration = melt[2] * stepDur
        ;(this.play(this.cBrass, nextTime, (brassVoice) => {
          ;(sfxSwingWhoosh(brassVoice, midiToFrequency(melt[1]), 0, noteDuration * 0.92, melt[3], 1.1), sfxSwingWhoosh(brassVoice, midiToFrequency(melt[1] - 12), 0, noteDuration * 0.92, melt[3] * 0.7, 0.9))
        }),
          this.play(this.cBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(melt[1] + 12), 0, Math.max(0.8, noteDuration), melt[3] * 0.6)))
      }
      step >= 27 && step <= 31 && this.play(this.cBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency([78, 81, 86, 90, 93][step - 27]), 0, 1.6, 0.6))
      return
    }
    if (
      ((step - MUSIC_VICTORY_INTRO_LENGTH) % 16 === 0 && (this.play(this.cPad, nextTime, (padVoice) => sfxChordPad(padVoice, [50, 57, 62, 66, 69, 76].map(midiToFrequency), 0, stepDur * 17, 0.6, 1.1)), this.play(this.cBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(38), 0, stepDur * 14, 0.4))),
      this.rnd() < 0.22)
    ) {
      const bellNotePitch = [74, 76, 78, 81, 83, 86, 88, 90][Math.floor(this.rnd() * 8)],
        bellIntensity = 0.18 + this.rnd() * 0.2
      this.play(this.cBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(bellNotePitch), 0, 1.6, bellIntensity))
    }
  }
}

const MUSIC_DEFEAT_MELODY_NOTES = [
    [1, 69, 3, 0.8],
    [4, 67, 2, 0.7],
    [6, 65, 2, 0.7],
    [8, 62, 3, 0.75],
    [11, 64, 1, 0.6],
    [12, 65, 4, 0.75],
    [16, 67, 3, 0.8],
    [19, 65, 1, 0.65],
    [20, 64, 4, 0.7],
    [24, 62, 8, 0.8],
  ],
  MUSIC_DEFEAT_INTRO_CHORDS: IntroChordTuple[] = [
    [0, 38, [50, 57, 62, 65], 8],
    [8, 34, [53, 58, 62, 65], 8],
    [16, 31, [55, 58, 62], 4],
    [20, 33, [57, 62, 64], 4],
    [24, 38, [50, 57, 62, 64, 65], 8],
  ],
  MUSIC_DEFEAT_INTRO_LENGTH = 32

class MusicTrackBpm100 extends SynthVoice {
  cPad = this.chan("cPad", 0.62, { rev: 0.45 })
  cHorn = this.chan("cHorn", 0.63, { rev: 0.5, dly: 0.2 })
  cBell = this.chan("cBell", 1.02, { rev: 0.6, dly: 0.3 })
  cBass = this.chan("cBass", 0.21)
  cDrum = this.chan("cDrum", 0.55, { rev: 0.25 })
  mel = bucketNotesByChord(MUSIC_DEFEAT_MELODY_NOTES, 32)
  constructor(music, startTime) {
    super(music, startTime, (60 / 100) * 1.5)
  }
  stepDur() {
    return 60 / 100 / 2
  }
  onStep(step, nextTime, stepDur) {
    if (step < MUSIC_DEFEAT_INTRO_LENGTH) {
      for (const introChord of MUSIC_DEFEAT_INTRO_CHORDS) {
        if (introChord[0] !== step) continue
        const chordDuration = introChord[3] * stepDur
        ;(this.play(this.cPad, nextTime, (padVoice) => sfxChordPad(padVoice, introChord[2].map(midiToFrequency), 0, chordDuration, 0.9, 0.7)),
          this.play(this.cBass, nextTime, (bassVoice) => sfxLowThud(bassVoice, midiToFrequency(introChord[1]), 0, chordDuration * 0.9, 0.75)),
          this.play(this.cDrum, nextTime, (drumVoice) => sfxBellTone(drumVoice, midiToFrequency(introChord[1] < 36 ? introChord[1] + 12 : introChord[1]), 0, step === 0 || step === 24 ? 0.8 : 0.5)))
      }
      for (const melodyNote of this.mel[step]) {
        const noteDuration = melodyNote[2] * stepDur
        this.play(this.cHorn, nextTime, (hornVoice) => {
          ;(sfxStringDraw(hornVoice, midiToFrequency(melodyNote[1]), 0, noteDuration * 0.95, melodyNote[3]), sfxStringDraw(hornVoice, midiToFrequency(melodyNote[1] - 12), 0, noteDuration * 0.95, melodyNote[3] * 0.5))
        })
      }
      ;(step === 24 || step === 28) && this.play(this.cBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(50), 0, 2.6, 0.7))
      return
    }
    const mainStep = step - MUSIC_DEFEAT_INTRO_LENGTH
    ;(mainStep % 16 === 0 && this.play(this.cPad, nextTime, (padVoice) => sfxChordPad(padVoice, [38, 45, 50, 57, 64].map(midiToFrequency), 0, stepDur * 17, 0.7, 0.6)), mainStep % 32 === 8 && this.play(this.cBell, nextTime, (bellVoice) => sfxFmImpact(bellVoice, midiToFrequency(62), 0, 3, 0.3)))
  }
}

class MusicDirector {
  static solo = null
  m
  cur = null
  name = "none"
  dying = []
  I = 0
  tension = 0
  constructor(mixer) {
    this.m = mixer
  }
  get track() {
    return this.name
  }
  get channels() {
    return this.cur ? [...new Set(this.cur.chanNames)] : []
  }
  setTrack(victoryKind) {
    if (victoryKind === this.name) return
    const switchTime = this.m.now(),
      isStinger = victoryKind === "victory" || victoryKind === "defeat"
    if (this.cur) {
      const fadeOutTime = isStinger ? 0.12 : 0.45
      ;(this.cur.fade(0, fadeOutTime), (this.cur.killAt = switchTime + fadeOutTime * 6 + 2.5), this.dying.push(this.cur), (this.cur = null))
    }
    if (((this.name = victoryKind), victoryKind === "none")) return
    const startTime = switchTime + (isStinger ? MUSIC_STINGER_START_DELAY_S : MUSIC_TRACK_START_DELAY_S),
      newTrack = victoryKind === "menu" ? new MusicTrackBpm66(this.m, startTime) : victoryKind === "battle" ? new MusicTrackBpm108(this.m, startTime) : victoryKind === "victory" ? new MusicTrackBpm132(this.m, startTime) : new MusicTrackBpm100(this.m, startTime)
    ;(newTrack.mood(this.I, this.tension), newTrack.fade(1, isStinger ? 0.02 : 0.3), (this.cur = newTrack))
  }
  setMood(targetObject, propertyName) {
    ;((this.I = targetObject), (this.tension = propertyName), this.cur?.mood(targetObject, propertyName))
  }
  tick(lookahead = MUSIC_TICK_LOOKAHEAD_S) {
    const currentTime = this.m.now()
    ;(this.cur?.schedule(currentTime, lookahead), this.dying.length && (this.dying = this.dying.filter((dyingTrack) => (dyingTrack.killAt > currentTime ? !0 : (dyingTrack.dispose(), !1)))))
  }
  dispose() {
    this.cur?.dispose()
    for (const dyingTrack of this.dying) dyingTrack.dispose()
    ;((this.cur = null), (this.dying.length = 0), (this.name = "none"))
  }
}

const SPEECH_ANNOUNCEMENT_TEXTS = {
    first_blood: "First blood!",
    double_kill: "Double kill!",
    triple_kill: "Triple kill!",
    quadra_kill: "Quadra kill!",
    penta_kill: "Penta kill!",
    killing_spree: "Killing spree!",
    unstoppable: "Unstoppable!",
    legendary: "Legendary!",
    shutdown: "Shut down!",
    ace: "Ace!",
    victory: "Victory!",
    defeat: "Defeat.",
  },
  SPEECH_ENGLISH_VOICE_PREFERENCES = ["google uk english male", "daniel", "microsoft guy", "microsoft david", "microsoft ryan", "microsoft george", "alex", "aaron", "arthur", "fred", "male"]

/**
 * 处理语音。
 *
 * @param voices - 主要输入
 * @returns 数值结果
 */
function selectEnglishSpeechVoice(voices) {
  const filterResult = voices.filter((englishVoice) => /^en([-_]|$)/i.test(englishVoice.lang))
  if (!filterResult.length) return null
  for (const preferredName of SPEECH_ENGLISH_VOICE_PREFERENCES) {
    const matchedVoice = filterResult.find((preferredVoice) => preferredVoice.name.toLowerCase().includes(preferredName))
    if (matchedVoice) return matchedVoice
  }
  return filterResult.find((regionalVoice) => /en[-_](us|gb)/i.test(regionalVoice.lang)) ?? filterResult[0]
}

export { SPEECH_ANNOUNCEMENT_TEXTS, MusicDirector, selectEnglishSpeechVoice }