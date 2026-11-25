/** 战斗音效映射：Boss 判定、播报优先级、连杀事件集合 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./load-ts.cjs')

const A = loadTs('src/kernel/attack-sfx-map.ts')

test('Boss 判定：仅 star_colossus 为 Boss', () => {
  assert.equal(A.isBossMonster('star_colossus'), 1)
  assert.equal(A.isBossMonster('abyss_drake'), 0)
  assert.equal(A.isBossMonster('mossback'), 0)
  assert.equal(A.MONSTER_KIND.star_colossus, 4)
})

test('播报优先级：胜利/失败最高，连杀事件按数量递增', () => {
  assert.equal(A.ANNOUNCE_PRIORITY.victory, 100)
  assert.ok(A.ANNOUNCE_PRIORITY.penta_kill > A.ANNOUNCE_PRIORITY.quadra_kill)
  assert.ok(A.ANNOUNCE_PRIORITY.quadra_kill > A.ANNOUNCE_PRIORITY.triple_kill)
  assert.ok(A.ANNOUNCE_PRIORITY.triple_kill > A.ANNOUNCE_PRIORITY.double_kill)
})

test('事件集合自洽：连杀事件全属于重大事件，重大事件全在优先级表', () => {
  for (const e of A.KILL_STREAK_EVENTS) {
    assert.ok(A.MAJOR_EVENTS.has(e), `连杀事件 ${e} 应在重大事件中`)
    assert.ok(e in A.ANNOUNCE_PRIORITY, `${e} 应有优先级`)
  }
  for (const e of A.MAJOR_EVENTS) {
    assert.ok(e in A.ANNOUNCE_PRIORITY, `重大事件 ${e} 应有优先级`)
  }
})

test('音效映射表存在（普攻/命中/弹道/范围）', () => {
  assert.ok(Object.keys(A.HERO_ATTACK_SFX).length > 0)
  assert.ok(Object.keys(A.HERO_HIT_SFX).length > 0)
  assert.ok(Object.keys(A.PROJECTILE_LAUNCH_SFX).length > 0)
  assert.ok(Object.keys(A.AREA_SFX).length > 0)
})
