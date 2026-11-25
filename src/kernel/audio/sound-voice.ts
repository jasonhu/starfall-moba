/**
 * 乐音发声体：单个合成器声部的调度、包络与调制（SoundVoice）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { computeFilterGainCompensation, clampAudibleFrequency } from './audio-math'

class SoundVoice {
  ctx
  kit
  out
  t0
  end
  pm = 1
  dur = 1
  constructor(kit, out, startTime) {
    ;((this.kit = kit), (this.ctx = kit.ctx), (this.out = out), (this.t0 = startTime), (this.end = startTime))
  }
  rnd() {
    return this.kit.rnd()
  }
  rr(lowerBound, upperBound) {
    return lowerBound + (upperBound - lowerBound) * this.kit.rnd()
  }
  env(builder, hero, startTime) {
    const peakGain = hero.g ?? 1,
      attackTime = Math.max(0.001, hero.a ?? 0.002),
      holdTime = hero.h !== void 0 && hero.h > 0 ? hero.h : 0,
      decayTime = Math.max(0.004, hero.d)
    ;(builder.setValueAtTime(0, startTime), builder.linearRampToValueAtTime(peakGain, startTime + attackTime))
    const decayStartTime = startTime + attackTime + holdTime
    return (
      holdTime > 0 && builder.setValueAtTime(peakGain, decayStartTime),
      hero.lin ? (builder.linearRampToValueAtTime(0, decayStartTime + decayTime), decayStartTime + decayTime) : (builder.setTargetAtTime(0, decayStartTime, decayTime / 5), builder.setValueAtTime(peakGain * 0.00674, decayStartTime + decayTime), builder.linearRampToValueAtTime(0, decayStartTime + decayTime + 0.008), decayStartTime + decayTime + 0.008)
    )
  }
  setWave(targetObject, sineKind) {
    !sineKind || sineKind === "sine" || (sineKind === "square" || sineKind === "sawtooth" || sineKind === "triangle" ? (targetObject.type = sineKind) : targetObject.setPeriodicWave(this.kit.wave(sineKind)))
  }
  total(envelope) {
    return Math.max(0.001, envelope.a ?? 0.002) + (envelope.h ?? 0) + envelope.d
  }
  osc(oscillatorSpec) {
    const ctxState = this.ctx,
      startTime = this.t0 + (oscillatorSpec.t ?? 0),
      OscillatorValue = ctxState.createOscillator()
    ;(this.setWave(OscillatorValue, oscillatorSpec.w),
      OscillatorValue.frequency.setValueAtTime(clampAudibleFrequency(oscillatorSpec.f * this.pm), startTime),
      oscillatorSpec.f1 !== void 0 && OscillatorValue.frequency.exponentialRampToValueAtTime(clampAudibleFrequency(oscillatorSpec.f1 * this.pm), startTime + (oscillatorSpec.ft ?? this.total(oscillatorSpec))),
      oscillatorSpec.det && OscillatorValue.detune.setValueAtTime(oscillatorSpec.det, startTime))
    const GainValue = ctxState.createGain(),
      oscillatorStopTime = this.env(GainValue.gain, oscillatorSpec, startTime) + 0.005
    if (oscillatorSpec.vib) {
      const createOscillatorOscillatorValue = ctxState.createOscillator()
      createOscillatorOscillatorValue.frequency.value = oscillatorSpec.vr ?? 5.5
      const createGainGainValue = ctxState.createGain()
      ;(createGainGainValue.gain.setValueAtTime(0, startTime + (oscillatorSpec.vd ?? 0.12)), createGainGainValue.gain.linearRampToValueAtTime(oscillatorSpec.vib, startTime + (oscillatorSpec.vd ?? 0.12) + 0.15), createOscillatorOscillatorValue.connect(createGainGainValue), createGainGainValue.connect(OscillatorValue.detune), createOscillatorOscillatorValue.start(startTime), createOscillatorOscillatorValue.stop(oscillatorStopTime))
    }
    return (OscillatorValue.connect(GainValue), GainValue.connect(oscillatorSpec.to ?? this.out), OscillatorValue.start(startTime), OscillatorValue.stop(oscillatorStopTime), oscillatorStopTime > this.end && (this.end = oscillatorStopTime), OscillatorValue)
  }
  fm(fmSpec) {
    const ctxValue = this.ctx,
      startTime = this.t0 + (fmSpec.t ?? 0),
      oscResult = this.osc(fmSpec),
      noteDuration = this.total(fmSpec),
      clampAudibleFrequencyResult = clampAudibleFrequency(fmSpec.f * this.pm),
      OscillatorResult = ctxValue.createOscillator()
    ;(OscillatorResult.frequency.setValueAtTime(clampAudibleFrequency(clampAudibleFrequencyResult * fmSpec.ratio), startTime), fmSpec.f1 !== void 0 && OscillatorResult.frequency.exponentialRampToValueAtTime(clampAudibleFrequency(fmSpec.f1 * this.pm * fmSpec.ratio), startTime + (fmSpec.ft ?? noteDuration)))
    const GainResult = ctxValue.createGain(),
      modulatorFrequency = clampAudibleFrequencyResult * fmSpec.ratio
    return (
      GainResult.gain.setValueAtTime(Math.max(0.01, fmSpec.idx * modulatorFrequency), startTime),
      fmSpec.idx1 !== void 0 && GainResult.gain.exponentialRampToValueAtTime(Math.max(0.01, fmSpec.idx1 * modulatorFrequency), startTime + (fmSpec.idt ?? noteDuration)),
      OscillatorResult.connect(GainResult),
      GainResult.connect(oscResult.frequency),
      OscillatorResult.start(startTime),
      OscillatorResult.stop(startTime + noteDuration + 0.02),
      oscResult
    )
  }
  noise(noiseSpec) {
    const audioContext = this.ctx,
      startTime = this.t0 + (noiseSpec.t ?? 0),
      noiseResult = this.kit.noise(noiseSpec.k ?? "white"),
      BufferSourceValue = audioContext.createBufferSource()
    ;((BufferSourceValue.buffer = noiseResult), (BufferSourceValue.loop = !0), noiseSpec.rate && (BufferSourceValue.playbackRate.value = noiseSpec.rate))
    const envelopeGain = audioContext.createGain(),
      noiseKind = noiseSpec.k ?? "white",
      filterCutoffFrequency = noiseSpec.fc ?? 1e3,
      filterCenterFrequency = noiseSpec.fc1 !== void 0 ? Math.sqrt(filterCutoffFrequency * noiseSpec.fc1) : filterCutoffFrequency,
      computeFilterGainCompensationResult = computeFilterGainCompensation(noiseKind, noiseSpec.flt, filterCenterFrequency, noiseSpec.q ?? 0.8),
      stopTime = this.env(envelopeGain.gain, { ...noiseSpec, g: (noiseSpec.g ?? 1) * computeFilterGainCompensationResult }, startTime) + 0.005
    if (noiseSpec.flt) {
      const BiquadFilterValue = audioContext.createBiquadFilter()
      ;((BiquadFilterValue.type = noiseSpec.flt),
        (BiquadFilterValue.Q.value = noiseSpec.q ?? 0.8),
        BiquadFilterValue.frequency.setValueAtTime(clampAudibleFrequency(filterCutoffFrequency * this.pm), startTime),
        noiseSpec.fc1 !== void 0 && BiquadFilterValue.frequency.exponentialRampToValueAtTime(clampAudibleFrequency(noiseSpec.fc1 * this.pm), startTime + (noiseSpec.fct ?? this.total(noiseSpec))),
        BufferSourceValue.connect(BiquadFilterValue),
        BiquadFilterValue.connect(envelopeGain))
    } else BufferSourceValue.connect(envelopeGain)
    return (envelopeGain.connect(noiseSpec.to ?? this.out), BufferSourceValue.start(startTime, this.kit.rnd() * (noiseResult.duration - 0.3)), BufferSourceValue.stop(stopTime), stopTime > this.end && (this.end = stopTime), BufferSourceValue)
  }
  ring(baseFrequency, partialRatios, oscillatorSpec) {
    const baseGain = oscillatorSpec.g ?? 1
    for (let index = 0; index < partialRatios.length; index++) this.osc({ ...oscillatorSpec, f: baseFrequency * partialRatios[index], d: oscillatorSpec.d / (1 + index * 0.45), g: baseGain / (1 + index * 0.7) })
  }
  scatter(hitCount, startOffset, spreadTime, playHit) {
    for (let index = 0; index < hitCount; index++) playHit(startOffset + this.kit.rnd() * spreadTime, index)
  }
  filt(filterType, cutoffFrequency, resonance = 0.8, busGain) {
    const createBiquadFilterBiquadFilterValue = this.ctx.createBiquadFilter()
    return ((createBiquadFilterBiquadFilterValue.type = filterType), (createBiquadFilterBiquadFilterValue.frequency.value = clampAudibleFrequency(cutoffFrequency * this.pm)), (createBiquadFilterBiquadFilterValue.Q.value = resonance), createBiquadFilterBiquadFilterValue.connect(busGain ?? this.out), createBiquadFilterBiquadFilterValue)
  }
  gain(gainValue, dest?) {
    const gainNode = this.ctx.createGain()
    return ((gainNode.gain.value = gainValue), gainNode.connect(dest ?? this.out), gainNode)
  }
  drive(driveAmount, dest) {
    const WaveShaperValue = this.ctx.createWaveShaper()
    return ((WaveShaperValue.curve = this.kit.curve(driveAmount)), WaveShaperValue.connect(dest ?? this.out), WaveShaperValue)
  }
  pan(panValue, filter) {
    if (!this.kit.canPan) return this.gain(1, filter)
    const StereoPannerValue = this.ctx.createStereoPanner()
    return ((StereoPannerValue.pan.value = panValue), StereoPannerValue.connect(filter ?? this.out), StereoPannerValue)
  }
  ramp(audioParam, rampPoints, useExponentialRamp = !0) {
    for (let index = 0; index < rampPoints.length; index++) {
      const pointTime = this.t0 + rampPoints[index][0],
        selectedEindex = rampPoints[index][1]
      index === 0 ? audioParam.setValueAtTime(selectedEindex, pointTime) : useExponentialRamp && selectedEindex > 0 && rampPoints[index - 1][1] > 0 ? audioParam.exponentialRampToValueAtTime(selectedEindex, pointTime) : audioParam.linearRampToValueAtTime(selectedEindex, pointTime)
    }
  }
  lfo(targetParam, lfoFrequency, modulationDepth, startOffset, duration, endFrequency) {
    const audioContext = this.ctx,
      startTime = this.t0 + startOffset,
      lfoOscillator = audioContext.createOscillator()
    ;(lfoOscillator.frequency.setValueAtTime(lfoFrequency, startTime), endFrequency !== void 0 && lfoOscillator.frequency.linearRampToValueAtTime(endFrequency, startTime + duration))
    const modulationGain = audioContext.createGain()
    ;((modulationGain.gain.value = modulationDepth), lfoOscillator.connect(modulationGain), modulationGain.connect(targetParam), lfoOscillator.start(startTime), lfoOscillator.stop(startTime + duration + 0.05))
  }
  echo(delayTime, feedbackGain, echoGain, tailTime, dest) {
    const audioContext = this.ctx,
      inputGainNode = audioContext.createGain(),
      DelayValue = audioContext.createDelay(Math.max(0.05, delayTime * 1.5))
    DelayValue.delayTime.value = delayTime
    const feedbackNode = audioContext.createGain()
    feedbackNode.gain.value = feedbackGain
    const echoNode = audioContext.createGain()
    return ((echoNode.gain.value = echoGain), inputGainNode.connect(dest ?? this.out), inputGainNode.connect(DelayValue), DelayValue.connect(feedbackNode), feedbackNode.connect(DelayValue), DelayValue.connect(echoNode), echoNode.connect(dest ?? this.out), tailTime > this.tail && (this.tail = tailTime), inputGainNode)
  }
  sub(subGain, configureSubVoice) {
    const subVoice = new SoundVoice(this.kit, this.gain(subGain), this.t0)
    ;((subVoice.pm = this.pm), (subVoice.dur = this.dur), configureSubVoice(subVoice), subVoice.finish(), subVoice.end > this.end && (this.end = subVoice.end))
  }
  tail = 0
  finish() {
    ;((this.end += this.tail), (this.tail = 0))
  }
}

export { SoundVoice }