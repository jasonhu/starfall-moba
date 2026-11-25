/**
 * 音效合成原语 —— Web Audio 合成器层面的发声单元
 * ---------------------------------------------------------------
 * 每个函数在内核注入的合成套件（SfxKit）之上拼出音色，不采样、不加载音频文件。
 * 命名按「波形结构 + 用途」：softsaw 振荡 → Swing/String；FM → Impact；噪声带通 → Click/Hiss…
 *
 * 参数约定（首参固定为 kit）：
 *   freq / freqs  基频（Hz）或和弦频率表
 *   startTime     起振时刻（秒，相对当前时间）
 *   dur           持续时长（秒）
 *   intensity     强度系数（0~1，影响音量与调制深度）
 *   dest          目标节点（滤波器 / 增益 / 总线）；缺省时由调用方决定
 *
 * ⚠️ 各函数参数顺序并不统一（有的 freq 在前、有的 startTime 在前），
 *    因为历史上由不同音效条目各自调用。调用时请以本文件签名为准。
 */

/** 合成节点：filt / pan / gain 的返回值 */
export interface SynthNode {
  readonly frequency: number
  connect(node: unknown): SynthNode
}

/** 振荡器参数：w 波形 / f 频率 / t 起始 / a 起振 / h 保持 / d 衰减 / g 增益 / to 目标 */
export interface OscSpec {
  w?: string
  f?: number
  f1?: number
  ft?: number
  det?: number
  t?: number
  a?: number
  h?: number
  d?: number
  g?: number
  to?: unknown
  vib?: number
  vr?: number
  vd?: number
  [k: string]: unknown
}

/** 内核注入的音频合成套件（Web Audio 之上的一层封装） */
export interface SfxKit {
  /** 建滤波器并返回节点 */
  filt(kind: string, freq: number, q: number, dest?: unknown): SynthNode
  /** 参数自动化：points 为 [时间, 值] 序列 */
  ramp(param: unknown, points: number[][]): void
  osc(spec: OscSpec): void
  fm(spec: Record<string, unknown>): void
  noise(spec: Record<string, unknown>): void
  ring(freq: number, partials: number[], spec: Record<string, unknown>): void
  pan(value: number, dest?: unknown): SynthNode
  gain(value: number, dest?: unknown): SynthNode
  drive?(amount: number): SynthNode
  ctx: { createGain(): SynthNode }
}

function sfxSwingWhoosh(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  brightness = 1,
  dest?: SynthNode,
): void {
  const filter = soundBuilder.filt("lowpass", 420, 1.1, dest),
    cutoff = 2500 * brightness * (0.55 + 0.45 * intensity)
  soundBuilder.ramp(filter.frequency, [
    [startTime, 420],
    [startTime + 0.045, cutoff],
    [startTime + 0.22, cutoff * 0.62],
    [startTime + Math.max(0.3, dur + 0.1), cutoff * 0.45],
  ])
  const holdTime = Math.max(0, dur - 0.06)
  ;(soundBuilder.osc({ w: "softsaw", f: freq, det: -7, t: startTime, a: 0.022, h: holdTime, d: 0.16, g: 0.2 * intensity, to: filter }),
    soundBuilder.osc({ w: "softsaw", f: freq, det: 8, t: startTime + 0.003, a: 0.03, h: holdTime, d: 0.16, g: 0.2 * intensity, to: filter }),
    soundBuilder.osc({ w: "softsq", f: freq / 2, t: startTime, a: 0.03, h: holdTime, d: 0.14, g: 0.07 * intensity, to: filter }))
}

function sfxStringDraw(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  const filter = soundBuilder.filt("lowpass", 380, 0.9, dest),
    cutoff = 2100 * (0.6 + 0.4 * intensity)
  soundBuilder.ramp(filter.frequency, [
    [startTime, 380],
    [startTime + 0.09, cutoff],
    [startTime + Math.max(0.3, dur + 0.15), cutoff * 0.6],
  ])
  const holdTime = Math.max(0, dur - 0.1)
  ;(soundBuilder.osc({ w: "softsaw", f: freq, det: -5, t: startTime, a: 0.06, h: holdTime, d: 0.22, g: 0.2 * intensity, vib: 7, vr: 5, vd: 0.25, to: filter }),
    soundBuilder.osc({ w: "reed", f: freq, det: 6, t: startTime, a: 0.07, h: holdTime, d: 0.22, g: 0.12 * intensity, to: filter }))
}

function sfxFmImpact(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  ;(soundBuilder.fm({ f: freq, ratio: 3.01, idx: 0.5 + 2.2 * intensity, idx1: 0.04, idt: Math.min(0.35, dur), t: startTime, a: 0.002, d: dur, g: 0.2 * intensity, to: dest }),
    soundBuilder.osc({ f: freq * 2, t: startTime, a: 0.002, d: dur * 0.4, g: 0.045 * intensity, to: dest }),
    soundBuilder.osc({ f: freq * 4.2, t: startTime, a: 0.001, d: 0.04, g: 0.03 * intensity, to: dest }))
}

function sfxExplosion(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  const tailTime = Math.max(0.2, dur),
    filter = soundBuilder.filt("lowpass", 400, 2.2, dest)
  ;(soundBuilder.ramp(filter.frequency, [
    [startTime, 800 + 4200 * intensity],
    [startTime + 0.16, 720],
    [startTime + tailTime + 0.05, 380],
  ]),
    soundBuilder.osc({ w: "softsaw", f: freq, t: startTime, a: 0.004, d: tailTime, g: 0.22 * intensity, to: filter }),
    soundBuilder.osc({ w: "triangle", f: freq * 2, t: startTime, a: 0.004, d: tailTime * 0.5, g: 0.06 * intensity, to: filter }))
}

function sfxChordPad(
  soundBuilder: SfxKit,
  freqs: number[],
  startTime: number,
  dur: number,
  intensity: number,
  brightness = 1,
  dest?: SynthNode,
): void {
  const filter = soundBuilder.filt("lowpass", 500, 0.6, dest)
  soundBuilder.ramp(filter.frequency, [
    [startTime, 600 * brightness],
    [startTime + dur * 0.4, 2300 * brightness],
    [startTime + dur + 1.3, 900 * brightness],
  ])
  const panLeft = soundBuilder.pan(-0.55, filter),
    panRight = soundBuilder.pan(0.55, filter),
    attack = Math.min(1, dur * 0.35),
    holdTime = Math.max(0, dur - attack)
  for (let voiceIndex = 0; voiceIndex < freqs.length; voiceIndex++) {
    const voiceGain = (0.085 * intensity) / (1 + voiceIndex * 0.12),
      noteTime = startTime + voiceIndex * 0.007
    ;(soundBuilder.osc({ w: "softsaw", f: freqs[voiceIndex], det: -9, t: noteTime, a: attack, h: holdTime, d: 1.4, g: voiceGain, to: panLeft }), soundBuilder.osc({ w: "softsaw", f: freqs[voiceIndex], det: 9, t: noteTime + 0.011, a: attack * 1.1, h: holdTime, d: 1.4, g: voiceGain, to: panRight }))
  }
  soundBuilder.osc({ f: freqs[0] / 2, t: startTime, a: attack, h: holdTime, d: 1.2, g: 0.03 * intensity, to: filter })
}

/**
 * 处理界面。
 *
 * @param soundBuilder - 音效构建器
 * @param freq - 次要输入
 * @param startTime - 输入
 * @param dur - 第四输入
 * @param intensity - 输入
 * @param tone - 附加输入
 * @param dest - 附加输入
 */
function sfxLowThud(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  tone = 0,
  dest?: SynthNode,
): void {
  const filter = soundBuilder.filt("lowpass", 300, 1.2, dest),
    cutoff = 380 + 800 * tone + 300 * intensity
  ;(soundBuilder.ramp(filter.frequency, [
    [startTime, cutoff],
    [startTime + 0.12, 280 + 160 * tone],
    [startTime + dur + 0.3, 220],
  ]),
    soundBuilder.osc({ f: freq, t: startTime, a: 0.008, h: dur * 0.8, d: 0.14 + dur * 0.2, g: 0.22 * intensity, to: dest }),
    soundBuilder.osc({ w: "softsaw", f: freq, t: startTime, a: 0.006, h: dur * 0.7, d: 0.12 + dur * 0.2, g: 0.26 * intensity, to: filter }))
}

function sfxGlassChime(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  ;(soundBuilder.osc({ w: "glass", f: freq, t: startTime, a: 0.05, h: Math.max(0, dur - 0.1), d: 0.2, g: 0.2 * intensity, vib: 9, vr: 5.2, vd: 0.2, to: dest }),
    soundBuilder.osc({ w: "triangle", f: freq * 2, t: startTime, a: 0.07, h: Math.max(0, dur - 0.12), d: 0.15, g: 0.03 * intensity, to: dest }),
    soundBuilder.noise({ flt: "bandpass", fc: freq * 2, q: 1.5, t: startTime, a: 0.03, d: 0.12, g: 0.035 * intensity, to: dest }))
}

function sfxSustainedWind(
  soundBuilder: SfxKit,
  freq: number,
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  const filter = soundBuilder.filt("lowpass", 2200 + 1600 * intensity, 0.7, dest)
  ;(soundBuilder.osc({ w: "softsaw", f: freq, det: -10, t: startTime, a: 0.006, h: dur * 0.3, d: dur, g: 0.13 * intensity, to: filter }),
    soundBuilder.osc({ w: "softsaw", f: freq, det: 11, t: startTime, a: 0.008, h: dur * 0.3, d: dur, g: 0.13 * intensity, to: filter }),
    soundBuilder.noise({ flt: "bandpass", fc: 2600, q: 1, t: startTime, a: 0.002, d: 0.025, g: 0.03 * intensity, to: dest }))
}

function sfxFormantChant(
  soundBuilder: SfxKit,
  freqs: number[],
  startTime: number,
  dur: number,
  intensity: number,
  dest?: SynthNode,
): void {
  const busGain = soundBuilder.gain(1.6, dest),
    GainValue = soundBuilder.ctx.createGain()
  ;(GainValue.connect(soundBuilder.filt("bandpass", 720, 2.2, busGain)), GainValue.connect(soundBuilder.filt("bandpass", 1150, 2.6, busGain)), GainValue.connect(soundBuilder.filt("bandpass", 2700, 3, soundBuilder.gain(0.4, busGain))))
  const attack = Math.min(0.5, dur * 0.4),
    holdTime = Math.max(0, dur - attack)
  for (let voiceIndex = 0; voiceIndex < freqs.length; voiceIndex++) {
    const noteFreq = freqs[voiceIndex],
      noteTime = startTime + voiceIndex * 0.009
    ;(soundBuilder.osc({ w: "softsaw", f: noteFreq, det: -8, t: noteTime, a: attack, h: holdTime, d: 0.7, g: 0.16 * intensity, vib: 10, vr: 5, vd: 0.3, to: GainValue }),
      soundBuilder.osc({ w: "softsaw", f: noteFreq, det: 9, t: noteTime + 0.004, a: attack, h: holdTime, d: 0.7, g: 0.16 * intensity, to: GainValue }))
  }
}

function sfxPitchDropHit(soundBuilder: SfxKit, startTime: number, gain: number, dest?: SynthNode): void {
  ;(soundBuilder.osc({ f: 150, f1: 46, ft: 0.09, t: startTime, a: 0.001, d: 0.26, g: 0.9 * gain, to: dest }), soundBuilder.noise({ flt: "highpass", fc: 1800, t: startTime, a: 0.001, d: 0.012, g: 0.18 * gain, to: dest }))
}

function sfxDeepBoom(
  soundBuilder: SfxKit,
  startTime: number,
  gain: number,
  pitchScale = 1,
  dest?: SynthNode,
): void {
  ;(soundBuilder.osc({ f: 118 * pitchScale, f1: 58 * pitchScale, ft: 0.14, t: startTime, a: 0.002, d: 0.5, g: 0.6 * gain, to: dest }),
    soundBuilder.osc({ w: "triangle", f: 236 * pitchScale, f1: 100 * pitchScale, ft: 0.1, t: startTime, a: 0.002, d: 0.2, g: 0.35 * gain, to: dest }),
    soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 1400, fc1: 300, t: startTime, a: 0.001, d: 0.07, g: 0.3 * gain, to: dest }))
}

function sfxNoiseSnare(soundBuilder: SfxKit, startTime: number, gain: number, dest?: SynthNode): void {
  ;(soundBuilder.noise({ flt: "bandpass", fc: 2100, q: 0.6, t: startTime, a: 0.001, d: 0.15, g: 0.45 * gain, to: dest }), soundBuilder.osc({ w: "triangle", f: 210, f1: 150, t: startTime, a: 0.001, d: 0.08, g: 0.35 * gain, to: dest }))
}

function sfxTripleTap(soundBuilder: SfxKit, startTime: number, gain: number, dest?: SynthNode): void {
  ;(soundBuilder.noise({ flt: "bandpass", fc: 1300, q: 1.1, t: startTime, a: 0.001, d: 0.02, g: 0.3 * gain, to: dest }),
    soundBuilder.noise({ flt: "bandpass", fc: 1300, q: 1.1, t: startTime + 0.011, a: 0.001, d: 0.02, g: 0.3 * gain, to: dest }),
    soundBuilder.noise({ flt: "bandpass", fc: 1300, q: 1.1, t: startTime + 0.023, a: 0.001, d: 0.13, g: 0.3 * gain, to: dest }))
}

function sfxNoiseHiss(
  soundBuilder: SfxKit,
  startTime: number,
  gain: number,
  isLong = false,
  dest?: SynthNode,
): void {
  soundBuilder.noise({ flt: "highpass", fc: 7200, t: startTime, a: 0.001, d: isLong ? 0.22 : 0.05, g: 0.7 * gain, to: dest })
}

function sfxClickTick(soundBuilder: SfxKit, startTime: number, gain: number, dest?: SynthNode): void {
  soundBuilder.noise({ flt: "bandpass", fc: 5600, q: 1.4, t: startTime, a: 0.012, d: 0.05, g: 0.5 * gain, to: dest })
}

function sfxBrightPing(soundBuilder: SfxKit, startTime: number, gain: number, dest?: SynthNode): void {
  ;(soundBuilder.osc({ f: 1650, t: startTime, a: 0.001, d: 0.022, g: 0.3 * gain, to: dest }),
    soundBuilder.osc({ w: "triangle", f: 430, t: startTime, a: 0.001, d: 0.035, g: 0.3 * gain, to: dest }),
    soundBuilder.noise({ flt: "highpass", fc: 3e3, t: startTime, a: 0.001, d: 0.008, g: 0.15 * gain, to: dest }))
}

function sfxMetalRing(
  soundBuilder: SfxKit,
  startTime: number,
  gain: number,
  dur = 1.6,
  dest?: SynthNode,
): void {
  ;(soundBuilder.noise({ flt: "highpass", fc: 4200, t: startTime, a: 0.002, d: dur, g: 0.3 * gain, to: dest }),
    soundBuilder.noise({ flt: "bandpass", fc: 8200, q: 2, t: startTime, a: 0.002, d: dur * 0.6, g: 0.18 * gain, to: dest }),
    soundBuilder.ring(3100, [1, 1.34, 1.72, 2.31], { t: startTime, a: 0.002, d: dur * 0.5, g: 0.02 * gain, to: dest }))
}

function sfxNoiseWhoosh(
  soundBuilder: SfxKit,
  startTime: number,
  attack: number,
  gain: number,
  dest?: SynthNode,
): void {
  soundBuilder.noise({ flt: "highpass", fc: 2500, fc1: 7e3, t: startTime, a: attack, d: 0.08, g: 0.22 * gain, to: dest })
}

function sfxBellTone(
  soundBuilder: SfxKit,
  baseFreq: number,
  startTime: number,
  gain: number,
  dest?: SynthNode,
): void {
  ;(soundBuilder.osc({ f: baseFreq * 1.12, f1: baseFreq, ft: 0.06, t: startTime, a: 0.002, d: 0.9, g: 0.75 * gain, to: dest }),
    soundBuilder.osc({ f: baseFreq * 1.5, t: startTime, a: 0.002, d: 0.4, g: 0.2 * gain, to: dest }),
    soundBuilder.osc({ f: baseFreq * 2, t: startTime, a: 0.002, d: 0.25, g: 0.1 * gain, to: dest }),
    soundBuilder.noise({ k: "pink", flt: "lowpass", fc: 900, fc1: 200, t: startTime, a: 0.001, d: 0.06, g: 0.4 * gain, to: dest }))
}

export { sfxSwingWhoosh, sfxStringDraw, sfxFmImpact, sfxExplosion, sfxChordPad, sfxLowThud, sfxGlassChime, sfxSustainedWind, sfxFormantChant, sfxPitchDropHit, sfxDeepBoom, sfxNoiseSnare, sfxTripleTap, sfxNoiseHiss, sfxClickTick, sfxBrightPing, sfxMetalRing, sfxNoiseWhoosh, sfxBellTone }
