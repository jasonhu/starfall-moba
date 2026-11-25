/** 粒子图集：clamp01 / smoothstep 缓动与图集常量 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const P = loadTs('src/kernel/particle-atlas.ts')

test('clamp01 边界与中段', () => {
  assert.equal(P.clamp01(-5), 0)
  assert.equal(P.clamp01(1.7), 1)
  assert.equal(P.clamp01(0.5), 0.5)
  assert.equal(P.clamp01(0), 0)
  assert.equal(P.clamp01(1), 1)
})

test('smoothstep 单调、端点精确、中点 0.5', () => {
  assert.equal(P.smoothstep(0, 1, 0), 0)
  assert.equal(P.smoothstep(0, 1, 1), 1)
  assert.ok(Math.abs(P.smoothstep(0, 1, 0.5) - 0.5) < 1e-12)
  let prev = -1
  for (let i = 0; i <= 20; i++) {
    const v = P.smoothstep(0, 10, i / 2)
    assert.ok(v >= prev, 'smoothstep 应单调不减')
    prev = v
  }
})

test('图集常量自洽：8×5 网格容纳 40 种粒子，索引唯一且连续', () => {
  assert.equal(P.ATLAS_COLS * P.ATLAS_ROWS, 40)
  assert.equal(P.ATLAS_CELL_SIZE, 128)
  const kinds = Object.values(P.PARTICLE_KIND)
  assert.equal(kinds.length, 40)
  assert.equal(new Set(kinds).size, 40, '粒子索引应唯一')
  assert.deepEqual([...kinds].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i))
})

test('TWO_PI 为 2π', () => {
  assert.ok(Math.abs(P.TWO_PI - Math.PI * 2) < 1e-12)
})
