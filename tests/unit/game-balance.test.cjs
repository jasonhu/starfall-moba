/** 数值平衡：经验曲线、复活时间、关键数据表结构 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const B = loadTs('src/kernel/game-balance.ts')

test('xpToNext 线性成长，满级 15 归零', () => {
  assert.equal(B.xpToNext(1), 160)
  assert.equal(B.xpToNext(2), 220)
  assert.equal(B.xpToNext(15), 0)
  assert.equal(B.xpToNext(16), 0)
})

test('heroRespawnSeconds 随等级/时间增长但封顶 60 秒', () => {
  assert.equal(B.heroRespawnSeconds(1, 0), 7.5)
  assert.equal(B.heroRespawnSeconds(1, 600), 7.5)
  assert.ok(B.heroRespawnSeconds(10, 1200) > B.heroRespawnSeconds(1, 1200))
  assert.equal(B.heroRespawnSeconds(18, 100000), 60)
})

test('关键数值表存在且字段自洽', () => {
  assert.ok(B.MINION_STATS.melee.hp > 0)
  assert.ok(B.MINION_STATS.ranged.attackRange > B.MINION_STATS.melee.attackRange)
  assert.equal(Object.keys(B.TOWER_STATS).length, 3)
  assert.ok(B.WAVE_SCHEDULE.siegeEvery > 0)
  assert.ok(B.ECONOMY.startGold > 0 && B.ECONOMY.killGold > 0)
  assert.equal(B.VISION_RANGES.hero, 13)
  assert.equal(B.VISION_RANGES.monster, 0)
  assert.ok(B.LATE_GAME_SCALING.start > 0)
  assert.ok(Object.keys(B.MONSTER_STATS).length >= 4)
})

test('数据表数值均为有限数（防 NaN 污染运行时）', () => {
  const walk = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path}.${k} 应为有限数`)
      else if (v && typeof v === 'object') walk(v, `${path}.${k}`)
    }
  }
  for (const table of ['MINION_STATS', 'TOWER_STATS', 'MONSTER_STATS', 'ECONOMY', 'WAVE_SCHEDULE', 'VISION_RANGES']) {
    walk(B[table], table)
  }
})
