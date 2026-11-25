/**
 * 音效引擎：事件→声部的分派、限流、空间化与总线发送（SfxEngine）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { NoiseGenerator } from './audio-math'
import { AUDIO_POST_COMPRESSOR_GAIN, getSfxCueGain, AUDIO_COMPRESSOR_SETTINGS, AUDIO_MIX_BUS_GAIN, SFX_MAX_ACTIVE_VOICES, SFX_RUNTIME_CUE_TABLE } from './sfx-cues'
import { SoundVoice } from './sound-voice'

// 构造器 engineOptions = {} 会被推断为空类型 {}；源码读取 .clock / .dynamics，
// 故仅补可选字段标注：clock 作为取时函数（返回 number），dynamics 为布尔开关。
interface SfxEngineSecondaryInput {
  clock?: () => number
  dynamics?: boolean
}

// play() 的 playOptions = {} 同样被推断为 {}；源码读取的 8 个字段
// 均为可覆盖的数值型参数（pan 为 -1..1 声像值，其余为时间/增益/优先级等），
// 全部声明为可选 number，保持 `?? 默认值` 的既有运行时语义不变。
interface SfxPlayOptions {
  when?: number
  prio?: number
  gain?: number
  lp?: number
  pan?: number
  pitch?: number
  dur?: number
  v?: number
}

class SfxEngine {
  ctx
  kit
  musicIn
  musicRev
  now
  stats = { played: 0, throttled: 0, capped: 0, stolen: 0, peakVoices: 0 }
  counts = new Map()
  sfxBus
  uiBus
  sfxRev
  musicVol
  musicLp
  musicDuck
  master
  voices = []
  notes = []
  lastAt = new Map()
  graph = []
  constructor(builder, engineOptions: SfxEngineSecondaryInput = {}) {
    ;((this.ctx = builder), (this.kit = new NoiseGenerator(builder)), (this.now = engineOptions.clock ?? (() => builder.currentTime)))
    const createTrackedGain = (target) => {
      const GainValue = builder.createGain()
      return ((GainValue.gain.value = target), this.graph.push(GainValue), GainValue)
    }
    ;((this.master = createTrackedGain(1)), this.master.connect(builder.destination))
    const sResult = createTrackedGain(AUDIO_MIX_BUS_GAIN)
    if (engineOptions.dynamics === !1) ((sResult.gain.value = 1), sResult.connect(this.master))
    else {
      const DynamicsCompressorValue = builder.createDynamicsCompressor()
      ;((DynamicsCompressorValue.threshold.value = AUDIO_COMPRESSOR_SETTINGS.threshold), (DynamicsCompressorValue.knee.value = AUDIO_COMPRESSOR_SETTINGS.knee), (DynamicsCompressorValue.ratio.value = AUDIO_COMPRESSOR_SETTINGS.ratio), (DynamicsCompressorValue.attack.value = AUDIO_COMPRESSOR_SETTINGS.attack), (DynamicsCompressorValue.release.value = AUDIO_COMPRESSOR_SETTINGS.release))
      const sSResult = createTrackedGain(AUDIO_POST_COMPRESSOR_GAIN),
        softClipDriveGain = createTrackedGain(0.5),
        WaveShaperValue = builder.createWaveShaper()
      ;((WaveShaperValue.curve = createSoftClipCurve()), sResult.connect(DynamicsCompressorValue), DynamicsCompressorValue.connect(sSResult), sSResult.connect(softClipDriveGain), softClipDriveGain.connect(WaveShaperValue), WaveShaperValue.connect(this.master), this.graph.push(DynamicsCompressorValue, WaveShaperValue))
    }
    ;((this.sfxBus = createTrackedGain(1)),
      (this.uiBus = createTrackedGain(1)),
      this.sfxBus.connect(sResult),
      this.uiBus.connect(sResult),
      (this.musicIn = createTrackedGain(1)),
      (this.musicLp = builder.createBiquadFilter()),
      (this.musicLp.type = "lowpass"),
      (this.musicLp.frequency.value = 2e4),
      (this.musicLp.Q.value = 0.5),
      (this.musicDuck = createTrackedGain(1)),
      (this.musicVol = createTrackedGain(1)),
      this.musicIn.connect(this.musicLp),
      this.musicLp.connect(this.musicDuck),
      this.musicDuck.connect(this.musicVol),
      this.musicVol.connect(sResult),
      this.graph.push(this.musicLp))
    const ConvolverValue = builder.createConvolver()
    ;((ConvolverValue.normalize = !1), (ConvolverValue.buffer = this.kit.impulse(2.4, 2)), (this.sfxRev = createTrackedGain(1)), (this.musicRev = createTrackedGain(1)), this.sfxRev.connect(ConvolverValue), this.musicRev.connect(ConvolverValue), ConvolverValue.connect(sResult), this.graph.push(ConvolverValue))
  }
  play(lookupKey, playOptions: SfxPlayOptions = {}) {
    const selectedSFX_RUNTIME_CUE_TABLE = SFX_RUNTIME_CUE_TABLE[lookupKey],
      scheduledTime = this.now() + (playOptions.when ?? 0) + 0.004,
      throttleGroupKey = selectedSFX_RUNTIME_CUE_TABLE.group ?? lookupKey,
      Value = this.lastAt.get(throttleGroupKey)
    if (Value !== void 0 && scheduledTime - Value < selectedSFX_RUNTIME_CUE_TABLE.gap && scheduledTime >= Value) return (this.stats.throttled++, null)
    const priority = playOptions.prio ?? selectedSFX_RUNTIME_CUE_TABLE.prio
    let sameCueVoiceCount = 0,
      activeVoiceCount = 0
    for (const voice of this.voices) voice.stolen || voice.killAt < scheduledTime || (activeVoiceCount++, voice.key === lookupKey && sameCueVoiceCount++)
    if (sameCueVoiceCount >= selectedSFX_RUNTIME_CUE_TABLE.poly) return (this.stats.throttled++, null)
    if (activeVoiceCount >= SFX_MAX_ACTIVE_VOICES && !this.steal(priority, scheduledTime)) return (this.stats.capped++, null)
    this.lastAt.set(throttleGroupKey, scheduledTime)
    const ctxState = this.ctx,
      SfxCueGainValue = getSfxCueGain(lookupKey),
      createGainGainValue = ctxState.createGain()
    createGainGainValue.gain.value = (playOptions.gain ?? 1) * SfxCueGainValue
    let outputNode = createGainGainValue,
      lowpassFilter = null
    playOptions.lp && playOptions.lp < 16e3 && ((lowpassFilter = ctxState.createBiquadFilter()), (lowpassFilter.type = "lowpass"), (lowpassFilter.frequency.value = playOptions.lp), (lowpassFilter.Q.value = 0.5), outputNode.connect(lowpassFilter), (outputNode = lowpassFilter))
    let stereoPanner = null
    ;(playOptions.pan !== void 0 && this.kit.canPan && ((stereoPanner = ctxState.createStereoPanner()), (stereoPanner.pan.value = playOptions.pan), outputNode.connect(stereoPanner), (outputNode = stereoPanner)), outputNode.connect(selectedSFX_RUNTIME_CUE_TABLE.bus === "ui" ? this.uiBus : this.sfxBus))
    let reverbSendGain = null
    selectedSFX_RUNTIME_CUE_TABLE.rev > 0 && ((reverbSendGain = ctxState.createGain()), (reverbSendGain.gain.value = selectedSFX_RUNTIME_CUE_TABLE.rev), outputNode.connect(reverbSendGain), reverbSendGain.connect(this.sfxRev))
    const soundVoice = new SoundVoice(this.kit, createGainGainValue, scheduledTime)
    ;((soundVoice.pm = (playOptions.pitch ?? 1) * (1 + (this.kit.rnd() * 2 - 1) * selectedSFX_RUNTIME_CUE_TABLE.jitter)), (soundVoice.dur = playOptions.dur ?? selectedSFX_RUNTIME_CUE_TABLE.len), selectedSFX_RUNTIME_CUE_TABLE.fn(soundVoice, playOptions.v ?? 0), soundVoice.finish())
    const keyConfig = { key: lookupKey, patch: soundVoice, out: createGainGainValue, pan: stereoPanner, lpf: lowpassFilter, send: reverbSendGain, prio: priority, vol: SfxCueGainValue, killAt: soundVoice.end + 0.05, stolen: !1 }
    return (
      this.voices.push(keyConfig),
      this.stats.played++,
      this.counts.set(lookupKey, (this.counts.get(lookupKey) ?? 0) + 1),
      activeVoiceCount + 1 > this.stats.peakVoices && (this.stats.peakVoices = activeVoiceCount + 1),
      {
        stop: (fadeOutTime = 0.15) => {
          const stopTime = this.now()
          keyConfig.killAt <= stopTime || (createGainGainValue.gain.cancelScheduledValues(stopTime), createGainGainValue.gain.setTargetAtTime(0, stopTime, fadeOutTime / 4), (keyConfig.killAt = Math.min(keyConfig.killAt, stopTime + fadeOutTime + 0.05)))
        },
        set: (targetObject, propertyName) => {
          const setTime = this.now()
          ;(createGainGainValue.gain.setTargetAtTime(targetObject * SfxCueGainValue, setTime, 0.06), stereoPanner && stereoPanner.pan.setTargetAtTime(propertyName, setTime, 0.06))
        },
      }
    )
  }
  steal(priorityThreshold, stealTime) {
    let stealVictim = null
    for (const candidateVoice of this.voices) candidateVoice.stolen || candidateVoice.killAt < stealTime || candidateVoice.prio >= priorityThreshold || ((!stealVictim || candidateVoice.prio < stealVictim.prio) && (stealVictim = candidateVoice))
    return stealVictim ? (stealVictim.out.gain.cancelScheduledValues(stealTime), stealVictim.out.gain.setTargetAtTime(0, stealTime, 0.006), (stealVictim.killAt = stealTime + 0.04), (stealVictim.stolen = !0), this.stats.stolen++, !0) : !1
  }
  note(destinationNode, startTime) {
    const GainResult = this.ctx.createGain()
    GainResult.connect(destinationNode)
    const soundVoice = new SoundVoice(this.kit, GainResult, startTime)
    return (this.notes.push({ patch: soundVoice, root: GainResult }), soundVoice)
  }
  sweep() {
    const currentTime = this.now()
    let liveWriteIndex = 0
    for (let index = 0; index < this.voices.length; index++) {
      const selectedVoices = this.voices[index]
      selectedVoices.killAt < currentTime ? (selectedVoices.out.disconnect(), selectedVoices.lpf?.disconnect(), selectedVoices.pan?.disconnect(), selectedVoices.send?.disconnect()) : (this.voices[liveWriteIndex++] = selectedVoices)
    }
    ;((this.voices.length = liveWriteIndex), (liveWriteIndex = 0))
    for (let noteIndex = 0; noteIndex < this.notes.length; noteIndex++) {
      const selectedNotes = this.notes[noteIndex]
      selectedNotes.patch.end + 0.1 < currentTime ? selectedNotes.root.disconnect() : (this.notes[liveWriteIndex++] = selectedNotes)
    }
    this.notes.length = liveWriteIndex
  }
  get voiceCount() {
    return this.voices.length
  }
  get noteCount() {
    return this.notes.length
  }
  setVolumes(masterVolume, sfxVolume, musicVolume) {
    const currentTime = this.now()
    ;(this.master.gain.setTargetAtTime(clampVolume01(masterVolume), currentTime, 0.03),
      this.sfxBus.gain.setTargetAtTime(clampVolume01(sfxVolume), currentTime, 0.03),
      this.uiBus.gain.setTargetAtTime(clampVolume01(sfxVolume), currentTime, 0.03),
      this.sfxRev.gain.setTargetAtTime(clampVolume01(sfxVolume), currentTime, 0.03),
      this.musicVol.gain.setTargetAtTime(clampVolume01(musicVolume), currentTime, 0.03),
      this.musicRev.gain.setTargetAtTime(clampVolume01(musicVolume), currentTime, 0.03))
  }
  fadeMaster(targetGain, fadeTime) {
    const currentTime = this.now()
    ;(this.master.gain.cancelScheduledValues(currentTime), this.master.gain.setTargetAtTime(targetGain, currentTime, fadeTime))
  }
  duck(duckLevel, restoreDelay) {
    const currentTime = this.now()
    ;(this.musicDuck.gain.cancelScheduledValues(currentTime), this.musicDuck.gain.setTargetAtTime(duckLevel, currentTime, 0.04), this.musicDuck.gain.setTargetAtTime(1, currentTime + restoreDelay, 0.35))
  }
  setMusicTone(musicCutoffHz) {
    this.musicLp.frequency.setTargetAtTime(musicCutoffHz, this.now(), 0.25)
  }
  dispose() {
    for (const voice of this.voices) voice.out.disconnect()
    for (const note of this.notes) note.root.disconnect()
    ;((this.voices.length = 0), (this.notes.length = 0))
    for (const graphNode of this.graph) graphNode.disconnect()
    this.graph.length = 0
  }
}

const clampVolume01 = (rawVolume) => (rawVolume < 0 ? 0 : rawVolume > 1 ? 1 : rawVolume)

function createSoftClipCurve() {
  const float32Array = new Float32Array(4097),
    clipThreshold = 0.72
  for (let index = 0; index < 4097; index++) {
    const curveInput = ((index / 4096) * 2 - 1) * 2,
      inputMagnitude = Math.abs(curveInput),
      clippedMagnitude = inputMagnitude <= clipThreshold ? inputMagnitude : clipThreshold + (1 - clipThreshold) * Math.tanh((inputMagnitude - clipThreshold) / (1 - clipThreshold))
    float32Array[index] = Math.sign(curveInput) * clippedMagnitude * 0.985
  }
  return float32Array
}

const MUSIC_TICK_LOOKAHEAD_S = 0.3,
  MUSIC_TRACK_START_DELAY_S = 0.25,
  MUSIC_STINGER_START_DELAY_S = 0.08


function shiftNoteUpMajorScale(midiNote) {
  const majorScalePitchClasses = [0, 2, 4, 5, 7, 9, 11],
    pitchClass = ((midiNote % 12) + 12) % 12,
    scaleDegreeIndex = majorScalePitchClasses.indexOf(pitchClass)
  if (scaleDegreeIndex < 0) return midiNote + 4
  const targetDegreeIndex = scaleDegreeIndex + 2
  return midiNote - pitchClass + majorScalePitchClasses[targetDegreeIndex % 7] + (targetDegreeIndex >= 7 ? 12 : 0)
}

export { SfxEngine, MUSIC_TICK_LOOKAHEAD_S, shiftNoteUpMajorScale, MUSIC_TRACK_START_DELAY_S, MUSIC_STINGER_START_DELAY_S }