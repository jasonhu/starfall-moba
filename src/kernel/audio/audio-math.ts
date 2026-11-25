/**
 * 音频数学与噪声基底（MIDI→频率、滤波器补偿、确定性噪声发生器）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */



const midiToFrequency = (midiNote) => 440 * Math.pow(2, (midiNote - 69) / 12),
  clampAudibleFrequency = (frequencyHz) => (frequencyHz < 16 ? 16 : frequencyHz > 19e3 ? 19e3 : frequencyHz),
  NOISE_RMS_TARGET = 0.5,
  FILTER_GAIN_MIN_HZ = 20,
  FILTER_GAIN_MAX_HZ = 2e4,
  BROWN_NOISE_CORNER_HZ = 140

function computeNoiseBandwidthRatio(whiteKind, lowCutoffHz, highCutoffHz) {
  const lowBandEdgeHz = Math.max(FILTER_GAIN_MIN_HZ, Math.min(FILTER_GAIN_MAX_HZ, lowCutoffHz)),
    highBandEdgeHz = Math.max(lowBandEdgeHz * 1.01, Math.min(FILTER_GAIN_MAX_HZ, highCutoffHz))
  return whiteKind === "white" ? (highBandEdgeHz - lowBandEdgeHz) / (FILTER_GAIN_MAX_HZ - FILTER_GAIN_MIN_HZ) : whiteKind === "pink" ? Math.log(highBandEdgeHz / lowBandEdgeHz) / Math.log(FILTER_GAIN_MAX_HZ / FILTER_GAIN_MIN_HZ) : (Math.atan(highBandEdgeHz / BROWN_NOISE_CORNER_HZ) - Math.atan(lowBandEdgeHz / BROWN_NOISE_CORNER_HZ)) / (Math.atan(FILTER_GAIN_MAX_HZ / BROWN_NOISE_CORNER_HZ) - Math.atan(FILTER_GAIN_MIN_HZ / BROWN_NOISE_CORNER_HZ))
}

function computeFilterGainCompensation(noiseColor, lowpassKind, filterCutoffHz, filterQ) {
  let bandwidthFraction = 1
  if (lowpassKind === "lowpass") bandwidthFraction = computeNoiseBandwidthRatio(noiseColor, FILTER_GAIN_MIN_HZ, filterCutoffHz * 1.1)
  else if (lowpassKind === "highpass") bandwidthFraction = computeNoiseBandwidthRatio(noiseColor, filterCutoffHz / 1.1, FILTER_GAIN_MAX_HZ)
  else if (lowpassKind === "bandpass") {
    const bandwidthScale = Math.sqrt(1 + 1 / (4 * filterQ * filterQ)),
      bandwidthHalfWidth = 1 / (2 * filterQ)
    bandwidthFraction = computeNoiseBandwidthRatio(noiseColor, filterCutoffHz * (bandwidthScale - bandwidthHalfWidth), filterCutoffHz * (bandwidthScale + bandwidthHalfWidth)) * 1.57
  }
  return Math.min(8, 1 / Math.sqrt(Math.max(0.0156, Math.min(1, bandwidthFraction))))
}

class NoiseGenerator {
  ctx
  canPan
  noises = new Map()
  curves = new Map()
  waves = new Map()
  seed
  constructor(audioContext, initialSeed = 5370206) {
    ;((this.ctx = audioContext), (this.seed = initialSeed >>> 0), (this.canPan = typeof audioContext.createStereoPanner == "function"))
  }
  rnd() {
    this.seed = (this.seed + 1831565813) >>> 0
    let seedState = this.seed
    return ((seedState = Math.imul(seedState ^ (seedState >>> 15), seedState | 1)), (seedState ^= seedState + Math.imul(seedState ^ (seedState >>> 7), seedState | 61)), ((seedState ^ (seedState >>> 14)) >>> 0) / 4294967296)
  }
  reseed(newSeed) {
    this.seed = newSeed >>> 0
  }
  noise(lookupKey) {
    let Value = this.noises.get(lookupKey)
    if (Value) return Value
    const sampleRate = this.ctx.sampleRate,
      bufferLengthSamples = Math.floor(sampleRate * 2.5)
    Value = this.ctx.createBuffer(1, bufferLengthSamples, sampleRate)
    const ChannelDataValue = Value.getChannelData(0)
    let noiseLcgState = lookupKey === "white" ? 19088743 : lookupKey === "pink" ? 38177486 : 20281789
    const nextRandomSample = () => ((noiseLcgState = (Math.imul(noiseLcgState, 1664525) + 1013904223) >>> 0), noiseLcgState / 2147483648 - 1)
    if (lookupKey === "white") for (let index = 0; index < bufferLengthSamples; index++) ChannelDataValue[index] = nextRandomSample()
    else if (lookupKey === "pink") {
      let pinkNoiseLowFreqPole = 0,
        pinkNoiseLowMidPole = 0,
        pinkNoiseMidPole = 0,
        pinkNoiseUpperMidPole = 0,
        pinkNoiseHighMidPole = 0,
        pinkNoiseHighPole = 0,
        pinkNoiseTopBandPole = 0
      for (let pinkSampleIndex = 0; pinkSampleIndex < bufferLengthSamples; pinkSampleIndex++) {
        const rResult = nextRandomSample()
        ;((pinkNoiseLowFreqPole = 0.99886 * pinkNoiseLowFreqPole + rResult * 0.0555179),
          (pinkNoiseLowMidPole = 0.99332 * pinkNoiseLowMidPole + rResult * 0.0750759),
          (pinkNoiseMidPole = 0.969 * pinkNoiseMidPole + rResult * 0.153852),
          (pinkNoiseUpperMidPole = 0.8665 * pinkNoiseUpperMidPole + rResult * 0.3104856),
          (pinkNoiseHighMidPole = 0.55 * pinkNoiseHighMidPole + rResult * 0.5329522),
          (pinkNoiseHighPole = -0.7616 * pinkNoiseHighPole - rResult * 0.016898),
          (ChannelDataValue[pinkSampleIndex] = (pinkNoiseLowFreqPole + pinkNoiseLowMidPole + pinkNoiseMidPole + pinkNoiseUpperMidPole + pinkNoiseHighMidPole + pinkNoiseHighPole + pinkNoiseTopBandPole + rResult * 0.5362) * 0.16),
          (pinkNoiseTopBandPole = rResult * 0.115926))
      }
    } else {
      let brownNoiseRunningSum = 0,
        brownNoiseOutput = 0,
        brownNoisePrevSum = 0
      for (let brownSampleIndex = 0; brownSampleIndex < bufferLengthSamples; brownSampleIndex++) ((brownNoiseRunningSum = (brownNoiseRunningSum + 0.02 * nextRandomSample()) / 1.02), (brownNoiseOutput = 0.996 * (brownNoiseOutput + brownNoiseRunningSum - brownNoisePrevSum)), (brownNoisePrevSum = brownNoiseRunningSum), (ChannelDataValue[brownSampleIndex] = brownNoiseOutput))
    }
    const crossfadeSamples = Math.floor(sampleRate * 0.02)
    for (let crossfadeIndex = 0; crossfadeIndex < crossfadeSamples; crossfadeIndex++) {
      const crossfadeWeight = crossfadeIndex / crossfadeSamples
      ChannelDataValue[crossfadeIndex] = ChannelDataValue[crossfadeIndex] * crossfadeWeight + ChannelDataValue[bufferLengthSamples - crossfadeSamples + crossfadeIndex] * (1 - crossfadeWeight)
    }
    let total = 0
    for (let rmsSampleIndex = 0; rmsSampleIndex < bufferLengthSamples; rmsSampleIndex++) total += ChannelDataValue[rmsSampleIndex] * ChannelDataValue[rmsSampleIndex]
    const rmsNormalizeGain = NOISE_RMS_TARGET / Math.sqrt(total / bufferLengthSamples)
    for (let normalizeIndex = 0; normalizeIndex < bufferLengthSamples; normalizeIndex++) ChannelDataValue[normalizeIndex] *= rmsNormalizeGain
    return (this.noises.set(lookupKey, Value), Value)
  }
  curve(waveshaperDrive) {
    const lookupKey = Math.round(waveshaperDrive * 10)
    let getValue = this.curves.get(lookupKey)
    if (getValue) return getValue
    const curveTableSize = 1024
    getValue = new Float32Array(curveTableSize)
    const driveAmount = Math.max(0.1, lookupKey / 10),
      tanhResult = Math.tanh(driveAmount)
    for (let index = 0; index < curveTableSize; index++) {
      const curvePosition = (index / (curveTableSize - 1)) * 2 - 1
      getValue[index] = Math.tanh(driveAmount * curvePosition) / tanhResult
    }
    return (this.curves.set(lookupKey, getValue), getValue)
  }
  wave(lookupKey) {
    let Result = this.waves.get(lookupKey)
    if (Result) return Result
    const harmonicCount = 40,
      float32Array = new Float32Array(harmonicCount + 1),
      harmonicAmplitudes = new Float32Array(harmonicCount + 1),
      glassPartials = [0, 1, 0.3, 0.09, 0.04, 0.015],
      reedPartials = [0, 1, 0.12, 0.55, 0.08, 0.3, 0.05, 0.14, 0.03, 0.06]
    for (let index = 1; index <= harmonicCount; index++)
      lookupKey === "softsaw"
        ? (harmonicAmplitudes[index] = (index % 2 ? 1 : -1) / Math.pow(index, 1.45))
        : lookupKey === "softsq"
          ? (harmonicAmplitudes[index] = index % 2 ? 1 / Math.pow(index, 1.35) : 0)
          : lookupKey === "glass"
            ? (harmonicAmplitudes[index] = glassPartials[index] ?? 0)
            : lookupKey === "reed"
              ? (harmonicAmplitudes[index] = reedPartials[index] ?? 0)
              : lookupKey === "string"
                ? (harmonicAmplitudes[index] = Math.sin(index * Math.PI * 0.13) / Math.pow(index, 1.2))
                : (harmonicAmplitudes[index] = (Math.sin(index * Math.PI * 0.29) / Math.pow(index, 0.85)) * (index % 2 ? 1 : 0.5))
    return ((Result = this.ctx.createPeriodicWave(float32Array, harmonicAmplitudes)), this.waves.set(lookupKey, Result), Result)
  }
  impulse(impulseDurationSec, decayTimeSec) {
    const sampleRate = this.ctx.sampleRate,
      impulseSampleCount = Math.floor(sampleRate * impulseDurationSec),
      BufferValue = this.ctx.createBuffer(2, impulseSampleCount, sampleRate)
    for (let index = 0; index < 2; index++) {
      const getChannelDataChannelDataValue = BufferValue.getChannelData(index)
      let prngState = index === 0 ? 165902235 : 133474241
      const nextImpulseRandom = () => ((prngState = (Math.imul(prngState, 1664525) + 1013904223) >>> 0), prngState / 2147483648 - 1)
      let total = 0
      const impulseStartSample = Math.floor(sampleRate * 0.012)
      for (let impulseSampleIndex = impulseStartSample; impulseSampleIndex < impulseSampleCount; impulseSampleIndex++) {
        const sampleTimeSec = impulseSampleIndex / sampleRate,
          tailSmoothingFactor = 0.55 - 0.42 * Math.min(1, sampleTimeSec / (impulseDurationSec * 0.7))
        total += (nextImpulseRandom() - total) * tailSmoothingFactor
        const attackEnvelopeGain = Math.min(1, (impulseSampleIndex - impulseStartSample) / (sampleRate * 0.02))
        getChannelDataChannelDataValue[impulseSampleIndex] = total * Math.exp((-6.91 * sampleTimeSec) / decayTimeSec) * attackEnvelopeGain
      }
      ;(index === 0 ? [0.011, 0.019, 0.027, 0.041, 0.057] : [0.013, 0.021, 0.031, 0.037, 0.061]).forEach((reflectionTimeSec, reflectionIndex) => {
        getChannelDataChannelDataValue[Math.floor(reflectionTimeSec * sampleRate)] += (reflectionIndex % 2 ? -0.5 : 0.6) / (1 + reflectionIndex * 0.5)
      })
      let energySum = 0
      for (let energyIndex = 0; energyIndex < impulseSampleCount; energyIndex++) energySum += getChannelDataChannelDataValue[energyIndex] * getChannelDataChannelDataValue[energyIndex]
      const normalizationGain = 1 / Math.sqrt(energySum || 1)
      for (let normalizeIndex = 0; normalizeIndex < impulseSampleCount; normalizeIndex++) getChannelDataChannelDataValue[normalizeIndex] *= normalizationGain
    }
    return BufferValue
  }
}

export { computeFilterGainCompensation, midiToFrequency, NoiseGenerator, clampAudibleFrequency }
