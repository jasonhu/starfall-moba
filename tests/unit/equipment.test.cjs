/** 装备表与文案格式化：formatPercent / formatTowerLabel / 装备表完整性 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const E = loadTs('src/kernel/equipment.ts')

test('formatPercent 四舍五入到整数百分比', () => {
  assert.equal(E.formatPercent(0.3), '30%')
  assert.equal(E.formatPercent(0.125), '13%')
  assert.equal(E.formatPercent(1), '100%')
  assert.equal(E.formatPercent(0), '0%')
})

test('formatTowerLabel 组合分路与层级中文名', () => {
  assert.equal(E.formatTowerLabel('top', 1), '上路一塔')
  assert.equal(E.formatTowerLabel('mid', 2), '中路二塔')
  assert.equal(E.formatTowerLabel('bot', 3), '下路高地塔')
})

test('装备表结构自洽：ItemList 与 ItemTable 同源', () => {
  assert.equal(E.ItemList.length, Object.keys(E.ItemTable).length)
  for (const item of E.ItemList) {
    assert.ok(item.name, '装备应有名称')
    assert.ok(item.stats && typeof item.stats === 'object', `${item.name} 应有属性加成`)
  }
  assert.equal(E.BaseAttackRange, 0.6)
  assert.equal(E.CastFailMessage.cooldown, '技能冷却中')
})

test('装备属性加成均为有限数', () => {
  for (const item of E.ItemList) {
    for (const [k, v] of Object.entries(item.stats || {})) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${item.name}.${k} 非有限数`)
    }
  }
})
