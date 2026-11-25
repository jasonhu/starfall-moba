/** 音频数学：MIDI→频率、可听频率钳制、滤波器增益补偿、确定性噪声发生器 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const M = loadTs('src/kernel/audio/audio-math.ts')

test('MIDI 69 = 标准音 A4 = 440Hz，每 12 半音翻倍', () => {
  assert.equal(M.midiToFrequency(69), 440)
  assert.ok(Math.abs(M.midiToFrequency(81) - 880) < 1e-9)
  assert.ok(Math.abs(M.midiToFrequency(57) - 220) < 1e-9)
})

test('可听频率钳制在 [16, 19000]', () => {
  assert.equal(M.clampAudibleFrequency(10), 16)
  assert.equal(M.clampAudibleFrequency(20000), 19000)
  assert.equal(M.clampAudibleFrequency(1000), 1000)
})

test('滤波器增益补偿恒为有限正数且不超过 8', () => {
  for (const noise of ['white', 'pink', 'brown']) {
    for (const type of ['lowpass', 'highpass', 'bandpass', 'notch']) {
      for (const [lo, hi, q] of [[20, 20000, 1], [200, 8000, 0.707], [1000, 1000, 4]]) {
        const gain = M.computeFilterGainCompensation(noise, type, hi, q)
        assert.ok(Number.isFinite(gain), `${noise}/${type} 应为有限数`)
        assert.ok(gain > 0 && gain <= 8, `${noise}/${type} 增益 ${gain} 越界`)
      }
    }
  }
})

test('噪声发生器：同种子产生同序列，reseed 可复现', () => {
  const fakeCtx = { sampleRate: 44100 }
  const a = new M.NoiseGenerator(fakeCtx, 12345)
  const b = new M.NoiseGenerator(fakeCtx, 12345)
  const seqA = Array.from({ length: 20 }, () => a.rnd())
  const seqB = Array.from({ length: 20 }, () => b.rnd())
  assert.deepEqual(seqA, seqB)
  assert.ok(seqA.every((v) => v >= 0 && v < 1))
  a.reseed(999)
  b.reseed(999)
  assert.equal(a.rnd(), b.rnd())
})

test('不同种子产生不同序列', () => {
  const fakeCtx = { sampleRate: 44100 }
  const a = new M.NoiseGenerator(fakeCtx, 1)
  const b = new M.NoiseGenerator(fakeCtx, 2)
  assert.notEqual(a.rnd(), b.rnd())
})
