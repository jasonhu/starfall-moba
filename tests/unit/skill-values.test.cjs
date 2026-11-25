/**
 * 技能数值与文案（类型契约消费者）
 * 注：模块内导出仍是迁移期短名，这里用语义别名承接，后续语义化时只改这一处。
 *  f5=computeStats  Nh=valueAt  lm=allocateSkillPoints  US=renderDesc  z0=heroLabel
 *  ea=summonerSpells  eh=MAX_SKILL_LEVEL
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const S = loadTs('src/kernel/skills/skill-values.ts')
const { HERO_TABLE } = loadTs('src/heroes/registry.ts')

const computeStats = S.f5
const valueAt = S.Nh
const allocateSkillPoints = S.lm
const renderDesc = S.US
const heroLabel = S.z0
const MAX_LEVEL = S.eh

test('英雄标签含名称与定位', () => {
  const label = heroLabel('panyue')
  assert.ok(label.includes('·'), '应含分隔符')
  assert.ok(label.length > 2)
})

test('技能点分配：1..15 级，每 4 级一个 ult 点，s1/s2 各不超 6', () => {
  assert.equal(MAX_LEVEL, 15)
  for (let lv = 1; lv <= 15; lv++) {
    const pts = allocateSkillPoints(lv)
    const ultExpected = [4, 8, 12].filter((n) => n <= lv).length
    assert.equal(pts.ult, ultExpected, `等级 ${lv} 的 ult 点`)
    assert.ok(pts.s1 <= 6 && pts.s2 <= 6)
    assert.ok(pts.s1 + pts.s2 + pts.ult <= lv)
  }
})

test('派生属性成长：等级 1 为基础值，随等级线性增长，封顶 15', () => {
  const hero = HERO_TABLE.panyue
  const lv1 = computeStats(hero, 1)
  const lv8 = computeStats(hero, 8)
  assert.equal(lv1.maxHp, hero.base.hp)
  assert.equal(lv1.ad, hero.base.ad)
  assert.ok(lv8.maxHp > lv1.maxHp, '成长后生命应增加')
  assert.ok(lv8.armor > lv1.armor)
  assert.equal(computeStats(hero, 99).maxHp, computeStats(hero, 15).maxHp, '成长封顶 15 级')
  // 关键字段齐全（UnitStats 契约）
  for (const key of ['maxHp', 'maxMana', 'ad', 'ap', 'armor', 'mr', 'attackSpeed', 'moveSpeed', 'attackRange', 'cdr', 'critDamage']) {
    assert.ok(Number.isFinite(lv8[key]), `UnitStats.${key} 应为有限数`)
  }
})

test('技能取值 valueAt：单值直返、数组按等级索引、缺键抛错', () => {
  const skill = { name: '测试技能', values: { fixed: 0.5, perLevel: [10, 20, 30] } }
  assert.equal(valueAt(skill, 'fixed', 5), 0.5)
  assert.equal(valueAt(skill, 'perLevel', 1), 10)
  assert.equal(valueAt(skill, 'perLevel', 2), 20)
  assert.equal(valueAt(skill, 'perLevel', 3), 30)
  assert.equal(valueAt(skill, 'perLevel', 99), 30, '超界钳制到末级')
  assert.equal(valueAt(skill, 'perLevel', 0), 10, '下界钳制到首级')
  assert.throws(() => valueAt(skill, 'missing', 1), /has no value/)
})

test('技能描述渲染：占位符替换为数值，百分比与数组正确格式化', () => {
  const skill = {
    name: '测试',
    desc: '造成 {damage} 伤害，{rate%} 加成，每段 {hits}。',
    values: { damage: 120, rate: 0.35, hits: [10, 20, 30] },
  }
  assert.equal(renderDesc(skill), '造成 120 伤害，35% 加成，每段 10/20/30。')
  const missing = { name: '缺值', desc: '未知 {foo}', values: {} }
  assert.equal(renderDesc(missing), '未知 {foo}', '缺值占位符保留原样')
})

test('召唤师技能定义完整', () => {
  assert.ok(S.ea.recall.channel > 0)
  assert.ok(S.ea.heal.hpRatio > 0 && S.ea.heal.manaRatio > 0)
  assert.ok(S.ea.flash.range > 0)
  assert.equal(S.SKILL_EFFECT_KINDS.dash, '位移')
})
