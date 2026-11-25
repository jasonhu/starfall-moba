/**
 * 内核切片 · 英雄被动技能注册：六英雄 passive 定义 + 装备/通用 passive（副作用注册块）（原 starfall.core.js 第 353-895 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
import { HERO_TABLE } from '../../heroes/registry'
import { registerPassiveFactory, isStructure, registerCastHandler, spawnArea, cancelArea, registerPassiveDef } from './combat-core'
import { getBuffStackCount, healTargetUnit, beginUnitAction, scheduleIfCasterAlive, findUnitsInCone, hasAnyBuff, extendDisarmDuration, revealUnitAfterAttack, removeBuffById, dealProcDamage, spawnConfiguredProjectile, dashTowardPoint, scheduleDelayedAction, applyHasteBuff, resetSkillCooldown, reduceSkillCooldown, teleportToPosition, faceUnitToward, tryUseHeroCooldown } from '../render/geometry-helpers'
import { removeBuff, hasActiveBuff } from './skill-cast'
import { emitSkillFx, applySlow, makeTargetFilter, clonePoint, startDash, scaleSkillDamage, queryTargetsByDistance, dealSkillHit, applyKnockup, startLeap, findMoveEndpoint, applyStun, dealSkillDamage, applyAttackSpeedBuff, applyShieldBuff } from './generic-cast-handler'
import { applyStatusEffect, findBuffByKey } from './combat-behavior'
import { getSkillValueRaw, getCastRange, getCastDelay } from './skill-evaluation'

// 类型标注：PassiveSpec.values 为 Record<string, Num>（Num=number|number[]），
// 而本文件五个英雄被动中参与算术的字段运行时均为标量 number（数组形态仅 xiangyu.damage 使用，
// 不在此文件注册）。此处仅做编译期收窄，断言在运行时被擦除，数值/控制流不变。
type PassiveNumView = Record<string, number>
const PANYUE_PASSIVE = HERO_TABLE.panyue.passive.values as PassiveNumView,
  PANYUE_FISSURE_TICK_INTERVAL = 0.25,
  PANYUE_SLOW_DURATION = 0.5,
  PANYUE_UNSTOPPABLE_BONUS = 0.1,
  PANYUE_AIM_RANGE_FACTOR = 0.6
registerPassiveFactory("panyue", {
  modifyBasicAttack(world, attacker, target, damageMods) {
    isStructure(target) || (getBuffStackCount(attacker, "panyue_passive") >= PANYUE_PASSIVE.hits - 1 && (damageMods.bonusMagic += attacker.stats.maxHp * PANYUE_PASSIVE.hpRatio))
  },
  onBasicAttackHit(world, unit, target) {
    if (!isStructure(target)) {
      if (getBuffStackCount(unit, "panyue_passive") >= PANYUE_PASSIVE.hits - 1) {
        ;(removeBuff(world, unit, "panyue_passive"), emitSkillFx(world, "panyue_passive_hit", target.pos, unit.team, { unitId: unit.id, targetId: target.id }), target.alive && applySlow(world, target, PANYUE_PASSIVE.slow, PANYUE_PASSIVE.slowDur, unit, "panyue_passive"))
        return
      }
      applyStatusEffect(world, unit, "panyue_passive", { duration: 1 / 0, maxStacks: PANYUE_PASSIVE.hits - 1, sourceId: unit.id })
    }
  },
})
registerCastHandler("panyue", "s1", {
  movement: !0,
  noAnim: !0,
  lockTime: 0,
  aimSpeed: getSkillValueRaw("panyue", "s1", "dashSpeed"),
  aimRange: getCastRange("panyue", "s1") + getSkillValueRaw("panyue", "s1", "impactRadius") * PANYUE_AIM_RANGE_FACTOR,
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext,
      TargetFilterValue = makeTargetFilter(caster.team)
    ;(emitSkillFx(sim, "panyue_s1_dash", castContext.origin, caster.team, { unitId: caster.id, dir: clonePoint(castContext.dir) }),
      startDash(sim, caster, {
        dir: castContext.dir,
        distance: castContext.range,
        speed: castContext.val("dashSpeed"),
        hitRadius: castContext.width * 0.5,
        filter: makeTargetFilter(caster.team, { heroesOnly: !0 }),
        onHit: () => !0,
        onEnd(interruptedKind) {
          if (interruptedKind === "interrupted" || !caster.alive) return
          const valResult = castContext.val("impactRadius"),
            scaleSkillDamageResult = scaleSkillDamage(castContext, "damage", { ad: "adRatio" })
          emitSkillFx(sim, "panyue_s1_impact", caster.pos, caster.team, { unitId: caster.id, radius: valResult })
          for (const targetUnit of queryTargetsByDistance(sim, caster.pos, valResult, TargetFilterValue)) (dealSkillHit(castContext, targetUnit, scaleSkillDamageResult, "physical"), applyKnockup(sim, targetUnit, castContext.val("knockup"), caster))
        },
      }))
  },
})
registerCastHandler("panyue", "s2", {
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext,
      shieldDuration = castContext.val("duration")
    ;(emitSkillFx(sim, "panyue_s2_cast", caster.pos, caster.team, { unitId: caster.id, radius: castContext.radius }), removeBuff(sim, caster, "shield", "panyue_s2"), applyStatusEffect(sim, caster, "panyue_bulwark", { duration: shieldDuration, sourceId: caster.id, merge: "replace" }))
    const spawnAreaValue = spawnArea(sim, { visual: "panyue_s2_aura", owner: caster, pos: caster.pos, radius: castContext.radius, duration: shieldDuration, follow: caster })
    applyStatusEffect(sim, caster, "shield", {
      duration: shieldDuration,
      value: scaleSkillDamage(castContext, "shield", { hp: "hpRatio" }),
      sourceId: caster.id,
      key: "panyue_s2",
      merge: "replace",
      onRemove(world, unit) {
        ;(removeBuff(world, unit, "panyue_bulwark"), cancelArea(world, spawnAreaValue))
      },
    })
    const damageAmount = castContext.val("damage")
    for (const targetUnit of queryTargetsByDistance(sim, caster.pos, castContext.radius, makeTargetFilter(caster.team))) (dealSkillHit(castContext, targetUnit, damageAmount, "magic"), applySlow(sim, targetUnit, castContext.val("slow"), castContext.val("slowDur"), caster, "panyue_s2"))
  },
})
registerCastHandler("panyue", "ult", {
  movement: !0,
  noAnim: !0,
  aimLead: getSkillValueRaw("panyue", "ult", "leapTime"),
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext,
      leapDuration = castContext.val("leapTime"),
      clonePointResult = clonePoint(caster.pos),
      makeTargetFilterTargetFilterValue = makeTargetFilter(caster.team)
    let telegraphArea = null
    startLeap(sim, caster, castContext.targetPos.x, castContext.targetPos.y, leapDuration, (arrivedKind) => {
      if ((removeBuff(sim, caster, "unstoppable", "panyue_ult"), arrivedKind !== "arrived" || !caster.alive)) {
        telegraphArea && cancelArea(sim, telegraphArea)
        return
      }
      const landingPoint = clonePoint(caster.pos),
        landingDamage = scaleSkillDamage(castContext, "damage", { hp: "hpRatio" })
      emitSkillFx(sim, "panyue_ult_land", landingPoint, caster.team, { unitId: caster.id, radius: castContext.radius })
      for (const radiusa of queryTargetsByDistance(sim, landingPoint, castContext.radius, makeTargetFilterTargetFilterValue)) (dealSkillHit(castContext, radiusa, landingDamage, "physical"), applyKnockup(sim, radiusa, castContext.val("knockup"), caster))
      spawnArea(sim, {
        visual: "panyue_ult_fissure",
        owner: caster,
        pos: landingPoint,
        radius: castContext.radius,
        duration: castContext.val("zoneDur"),
        tickInterval: PANYUE_FISSURE_TICK_INTERVAL,
        firstTick: 0,
        onTick(world, area) {
          for (const targetUnit of queryTargetsByDistance(world, area.pos, area.radius, makeTargetFilterTargetFilterValue)) applySlow(world, targetUnit, castContext.val("slow"), PANYUE_SLOW_DURATION, caster, "panyue_fissure")
        },
      })
    })
    const casterDash = caster.rt.dash,
      leapDestination = casterDash ? { x: casterDash.toX, y: casterDash.toY } : clonePoint(caster.pos)
    ;(applyStatusEffect(sim, caster, "unstoppable", { duration: leapDuration + PANYUE_UNSTOPPABLE_BONUS, sourceId: caster.id, key: "panyue_ult", merge: "replace" }),
      emitSkillFx(sim, "panyue_ult_leap", clonePointResult, caster.team, { unitId: caster.id, from: clonePointResult, to: clonePoint(leapDestination) }),
      (telegraphArea = spawnArea(sim, { visual: "telegraph", owner: caster, pos: leapDestination, radius: castContext.radius, duration: leapDuration })))
  },
})
const CHIJIN_PASSIVE = HERO_TABLE.chijin.passive.values as PassiveNumView,
  CHIJIN_S1_CAST_DELAY = getCastDelay("chijin", "s1")
registerPassiveFactory("chijin", {
  onSkillCast(world, caster, slot) {
    ;(slot !== "s1" && slot !== "s2" && slot !== "ult") || applyStatusEffect(world, caster, "chijin_ember", { duration: CHIJIN_PASSIVE.window, sourceId: caster.id, merge: "replace" })
  },
  modifyBasicAttack(world, attacker, target, damageMods) {
    isStructure(target) || !hasActiveBuff(attacker, "chijin_ember") || (damageMods.bonus += CHIJIN_PASSIVE.damage + CHIJIN_PASSIVE.adRatio * attacker.stats.ad)
  },
  onBasicAttackHit(world, attacker, target) {
    isStructure(target) || !hasActiveBuff(attacker, "chijin_ember") || (removeBuff(world, attacker, "chijin_ember"), emitSkillFx(world, "chijin_passive_hit", target.pos, attacker.team, { unitId: attacker.id, targetId: target.id }), healTargetUnit(world, attacker, attacker, attacker.stats.maxHp * CHIJIN_PASSIVE.healHpRatio))
  },
  statMods(world, unit, statBonuses) {
    const findBuffByKeyResult = findBuffByKey(unit, "chijin_blaze")
    findBuffByKeyResult && (statBonuses.asPct += findBuffByKeyResult.value)
  },
  onTick(world, unit) {
    if (unit.rt.act !== null) return
    const spinBuff = findBuffByKey(unit, "chijin_spin")
    spinBuff && beginUnitAction(world, unit, "spin", spinBuff.timeLeft, !1)
  },
})
registerCastHandler("chijin", "s1", {
  aimLead: CHIJIN_S1_CAST_DELAY,
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext
    scheduleIfCasterAlive(castContext, CHIJIN_S1_CAST_DELAY, () => {
      const scaledDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" })
      emitSkillFx(sim, "chijin_s1_slash", caster.pos, caster.team, { unitId: caster.id, dir: clonePoint(castContext.dir), radius: castContext.range, angle: castContext.angle })
      for (const targetUnit of findUnitsInCone(sim, caster.pos, castContext.dir, castContext.range, castContext.angle, makeTargetFilter(caster.team))) (dealSkillHit(castContext, targetUnit, scaledDamage, "physical"), applySlow(sim, targetUnit, castContext.val("slow"), castContext.val("slowDur"), caster, "chijin_s1"))
    })
  },
})
registerCastHandler("chijin", "s2", {
  movement: !0,
  noAnim: !0,
  lockTime: 0,
  aimSpeed: getSkillValueRaw("chijin", "s2", "dashSpeed"),
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext,
      dashOrigin = clonePoint(caster.pos)
    ;(emitSkillFx(sim, "chijin_s2_dash", dashOrigin, caster.team, { unitId: caster.id, from: dashOrigin, to: findMoveEndpoint(sim, caster, castContext.dir, castContext.range), dir: clonePoint(castContext.dir) }),
      applyStatusEffect(sim, caster, "chijin_blaze", { duration: castContext.val("asDur"), value: castContext.val("asBonus"), sourceId: caster.id, merge: "replace" }),
      startDash(sim, caster, {
        dir: castContext.dir,
        distance: castContext.range,
        speed: castContext.val("dashSpeed"),
        hitRadius: castContext.width * 0.5,
        filter: makeTargetFilter(caster.team),
        onHit(target) {
          dealSkillHit(castContext, target, scaleSkillDamage(castContext, "damage", { ad: "adRatio" }), "physical")
        },
      }))
  },
})
registerCastHandler("chijin", "ult", {
  noAnim: !0,
  lockTime: 0,
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext,
      spinDuration = castContext.val("duration"),
      tickInterval = castContext.val("tick"),
      spinTickCount = Math.round(spinDuration / tickInterval),
      TargetFilterResult = makeTargetFilter(caster.team)
    let ticksElapsed = 0
    ;(emitSkillFx(sim, "chijin_ult_start", caster.pos, caster.team, { unitId: caster.id }),
      applyStatusEffect(sim, caster, "chijin_spin", { duration: spinDuration, sourceId: caster.id, merge: "replace" }),
      hasAnyBuff(sim, caster, ["slow"]),
      applyStatusEffect(sim, caster, "dmg_reduction", { duration: spinDuration, value: castContext.val("reduction"), sourceId: caster.id, key: "chijin_ult", merge: "replace" }),
      beginUnitAction(sim, caster, "spin", spinDuration, !1),
      extendDisarmDuration(sim, caster, spinDuration),
      spawnArea(sim, {
        visual: "chijin_ult_spin",
        owner: caster,
        pos: caster.pos,
        radius: castContext.radius,
        duration: spinDuration,
        follow: caster,
        tickInterval: tickInterval,
        firstTick: castContext.def ? castContext.def.castTime : 0,
        onTick(world, area) {
          if (ticksElapsed >= spinTickCount) return
          ticksElapsed++
          const scaledDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" })
          emitSkillFx(world, "chijin_ult_tick", area.pos, caster.team, { unitId: caster.id, radius: area.radius })
          for (const radiuso of queryTargetsByDistance(world, area.pos, area.radius, TargetFilterResult)) dealSkillHit(castContext, radiuso, scaledDamage, "physical")
          revealUnitAfterAttack(world, caster)
        },
      }))
  },
})
const XINGLI_PASSIVE = HERO_TABLE.xingli.passive.values as PassiveNumView,
  XINGLI_S1_CAST_DELAY = getCastDelay("xingli", "s1"),
  XINGLI_METEOR_COUNT = 3,
  XINGLI_METEOR_RADIUS = 1.7,
  XINGLI_ULT_DELAY_COMPENSATION = 0.2
registerPassiveFactory("xingli", {
  /**
   * 处理技能与碰撞。
   *
   * @param world - 主要输入
   * @param attacker - 输入
   * @param target - 输入
  */
  onSkillHit(world, attacker, target) {
    if (!target.alive || isStructure(target)) return
    const applyStatusEffectResult = applyStatusEffect(world, target, "xingli_mark", { duration: XINGLI_PASSIVE.duration, maxStacks: XINGLI_PASSIVE.stacks, sourceId: attacker.id })
    if (!applyStatusEffectResult || applyStatusEffectResult.stacks < XINGLI_PASSIVE.stacks) return
    ;(removeBuffById(world, target, applyStatusEffectResult), emitSkillFx(world, "xingli_passive_burst", target.pos, attacker.team, { unitId: attacker.id, targetId: target.id }))
    let burstDamage = target.stats.maxHp * XINGLI_PASSIVE.hpRatio
    ;(target.kind !== "hero" && (burstDamage = Math.min(burstDamage, XINGLI_PASSIVE.cap)), applyStun(world, target, XINGLI_PASSIVE.stun, attacker), dealProcDamage(world, attacker, target, burstDamage, "magic"))
  },
})
registerCastHandler("xingli", "s1", {
  aimSpeed: getSkillValueRaw("xingli", "s1", "speed"),
  aimLead: XINGLI_S1_CAST_DELAY,
  cast(castContext) {
    const { sim: sim, caster: caster } = castContext
    scheduleIfCasterAlive(castContext, XINGLI_S1_CAST_DELAY, () => {
      const scaledDamage = scaleSkillDamage(castContext, "damage", { ap: "apRatio" })
      ;(emitSkillFx(sim, "xingli_s1_cast", caster.pos, caster.team, { unitId: caster.id, dir: clonePoint(castContext.dir) }),
        spawnConfiguredProjectile(sim, {
          visual: "xingli_s1",
          owner: caster,
          from: caster.pos,
          dir: castContext.dir,
          speed: castContext.val("speed"),
          range: castContext.range,
          radius: castContext.width * 0.5,
          pierce: !0,
          filter: makeTargetFilter(caster.team),
          onHit(world, projectile, target) {
            dealSkillDamage(world, caster, target, scaledDamage, "magic", castContext.slot)
          },
        }))
    })
  },
})
registerCastHandler("xingli", "s2", {
  aimLead: getSkillValueRaw("xingli", "s2", "delay"),
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      targetPoint = clonePoint(castContext.targetPos),
      delayDuration = castContext.val("delay")
    ;(spawnArea(t, { visual: "telegraph", owner: e, pos: targetPoint, radius: castContext.radius, duration: delayDuration }),
      spawnArea(t, {
        visual: "xingli_s2_well",
        owner: e,
        pos: targetPoint,
        radius: castContext.radius,
        duration: delayDuration,
        onEnd(world, area, endedNaturally) {
          if (!endedNaturally) return
          const scaledDamage = scaleSkillDamage(castContext, "damage", { ap: "apRatio" })
          emitSkillFx(world, "xingli_s2_burst", area.pos, e.team, { unitId: e.id, radius: area.radius })
          for (const targetUnit of queryTargetsByDistance(world, area.pos, area.radius, makeTargetFilter(e.team))) (dealSkillHit(castContext, targetUnit, scaledDamage, "magic"), targetUnit.alive && (dashTowardPoint(world, targetUnit, area.pos, castContext.val("pull")), applySlow(world, targetUnit, castContext.val("slow"), castContext.val("slowDur"), e, "xingli_s2")))
        },
      }))
  },
})
/**
 * 处理坐标。
 *
 * @param world - 主要输入
 * @param position - 坐标
 * @param radius - 第三输入
 * @returns 结果对象
 */
function randomPointInRadius(world, position, radius) {
  const scatterDistance = Math.sqrt(world.rng.next()) * Math.max(0, radius - XINGLI_METEOR_RADIUS * 0.5),
    angle = world.rng.next() * Math.PI * 2
  return { x: position.x + Math.cos(angle) * scatterDistance, y: position.y + Math.sin(angle) * scatterDistance }
}
function castXingliMeteorBarrage(castContext, caster, centerPoint, radius, meteorInterval) {
  const { sim: sim } = castContext,
    scaledDamage = scaleSkillDamage(castContext, "damage", { ap: "apRatio" })
  for (let index = 0; index < XINGLI_METEOR_COUNT; index++) {
    const randomPointInRadiusResult = randomPointInRadius(sim, centerPoint, radius),
      spawnMeteorFx = () => emitSkillFx(sim, "xingli_meteor", randomPointInRadiusResult, caster.team, { unitId: caster.id, radius: XINGLI_METEOR_RADIUS })
    index === 0 ? spawnMeteorFx() : scheduleDelayedAction(sim, (meteorInterval * index) / XINGLI_METEOR_COUNT, spawnMeteorFx)
  }
  for (const targetUnit of queryTargetsByDistance(sim, centerPoint, radius, makeTargetFilter(caster.team))) (dealSkillHit(castContext, targetUnit, scaledDamage, "magic"), applySlow(sim, targetUnit, castContext.val("slow"), castContext.val("slowDur"), caster, "xingli_ult"))
}
registerCastHandler("xingli", "ult", {
  aimLead: getSkillValueRaw("xingli", "ult", "delay") + XINGLI_ULT_DELAY_COMPENSATION,
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      targetPoint = clonePoint(castContext.targetPos),
      stormDuration = castContext.val("duration"),
      waveCount = castContext.val("waves"),
      waveInterval = stormDuration / waveCount
    ;(emitSkillFx(t, "xingli_ult_cast", e.pos, e.team, { unitId: e.id }),
      spawnArea(t, {
        visual: "telegraph",
        owner: e,
        pos: targetPoint,
        radius: castContext.radius,
        duration: castContext.val("delay"),
        onEnd(world, area, endedNaturally) {
          if (!endedNaturally) return
          let wavesCast = 1
          const stormArea = spawnArea(world, {
            visual: "xingli_ult_storm",
            owner: e,
            pos: targetPoint,
            radius: castContext.radius,
            duration: stormDuration,
            tickInterval: waveInterval,
            onTick(tickWorld, tickArea) {
              wavesCast >= waveCount || (wavesCast++, castXingliMeteorBarrage(castContext, e, tickArea.pos, tickArea.radius, waveInterval))
            },
          })
          castXingliMeteorBarrage(castContext, e, stormArea.pos, stormArea.radius, waveInterval)
        },
      }))
  },
})
const FENGLING_PASSIVE = HERO_TABLE.fengling.passive.values as PassiveNumView,
  FENGLING_S1_CAST_DELAY = getCastDelay("fengling", "s1"),
  FENGLING_ULT_DELAY_COMPENSATION = 0.2
registerPassiveFactory("fengling", {
  statMods(world, unit, statBonuses) {
    const BuffStackCountValue = getBuffStackCount(unit, "fengling_gale")
    BuffStackCountValue <= 0 || ((statBonuses.asPct += BuffStackCountValue * FENGLING_PASSIVE.asPerStack), BuffStackCountValue >= FENGLING_PASSIVE.maxStacks && (statBonuses.movePct += FENGLING_PASSIVE.haste))
  },
  modifyBasicAttack(world, attacker, target, damageMods) {
    isStructure(target) || (getBuffStackCount(attacker, "fengling_gale") >= FENGLING_PASSIVE.maxStacks && (damageMods.bonus += FENGLING_PASSIVE.bonus + FENGLING_PASSIVE.bonusPerLevel * attacker.level), hasActiveBuff(attacker, "fengling_crit") && (damageMods.forceCrit = !0))
  },
  onBasicAttackHit(world, attacker, target) {
    ;(applyStatusEffect(world, attacker, "fengling_gale", { duration: FENGLING_PASSIVE.duration, maxStacks: FENGLING_PASSIVE.maxStacks, sourceId: attacker.id }), isStructure(target) || removeBuff(world, attacker, "fengling_crit"))
  },
})
registerCastHandler("fengling", "s1", {
  aimSpeed: getSkillValueRaw("fengling", "s1", "speed"),
  aimLead: FENGLING_S1_CAST_DELAY,
  cast(castContext) {
    const { sim: t, caster: e } = castContext
    scheduleIfCasterAlive(castContext, FENGLING_S1_CAST_DELAY, () => {
      const scaledDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" })
      ;(emitSkillFx(t, "fengling_s1_cast", e.pos, e.team, { unitId: e.id, dir: clonePoint(castContext.dir) }),
        spawnConfiguredProjectile(t, {
          visual: "fengling_s1",
          owner: e,
          from: e.pos,
          dir: castContext.dir,
          speed: castContext.val("speed"),
          range: castContext.range,
          radius: castContext.width * 0.5,
          pierce: !0,
          filter: makeTargetFilter(e.team),
          /**
           * 处理碰撞。
           *
           * @param world - 主要输入
           * @param projectile - 次要输入
           * @param target - 第三输入
          */
          onHit(world, projectile, target) {
            return target.kind !== "hero"
              ? (dealSkillDamage(world, e, target, scaledDamage * castContext.val("minionRatio"), "physical", castContext.slot), !1)
              : (dealSkillDamage(world, e, target, scaledDamage, "physical", castContext.slot), applySlow(world, target, castContext.val("slow"), castContext.val("slowDur"), e, "fengling_s1"), !0)
          },
        }))
    })
  },
})
registerCastHandler("fengling", "s2", {
  aim: "facing",
  movement: !0,
  noAnim: !0,
  lockTime: 0,
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      dashOrigin = clonePoint(e.pos)
    ;(emitSkillFx(t, "fengling_s2_dash", dashOrigin, e.team, { unitId: e.id, from: dashOrigin, to: findMoveEndpoint(t, e, castContext.dir, castContext.range), dir: clonePoint(castContext.dir) }),
      startDash(t, e, {
        dir: castContext.dir,
        distance: castContext.range,
        speed: castContext.val("dashSpeed"),
        onEnd() {
          e.alive && (applyHasteBuff(t, e, castContext.val("haste"), castContext.val("hasteDur"), e, "fengling_s2"), applyStatusEffect(t, e, "fengling_crit", { duration: castContext.val("critWindow"), sourceId: e.id, merge: "replace" }))
        },
      }))
  },
})
registerCastHandler("fengling", "ult", {
  aimLead: getSkillValueRaw("fengling", "ult", "delay") + FENGLING_ULT_DELAY_COMPENSATION,
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      targetPoint = clonePoint(castContext.targetPos),
      rainDuration = castContext.val("duration"),
      rainTickInterval = castContext.val("tick"),
      rainTickCount = Math.round(rainDuration / rainTickInterval)
    ;(emitSkillFx(t, "fengling_ult_cast", e.pos, e.team, { unitId: e.id }),
      spawnArea(t, {
        visual: "telegraph",
        owner: e,
        pos: targetPoint,
        radius: castContext.radius,
        duration: castContext.val("delay"),
        onEnd(world, area, endedNaturally) {
          if (!endedNaturally) return
          let ticksElapsed = 0
          const dealRainTick = (cooldown) => {
              ticksElapsed++
              const scaledDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" })
              emitSkillFx(t, "fengling_ult_tick", cooldown.pos, e.team, { unitId: e.id, radius: cooldown.radius })
              for (const targetUnit of queryTargetsByDistance(t, cooldown.pos, cooldown.radius, makeTargetFilter(e.team))) (dealSkillHit(castContext, targetUnit, scaledDamage, "physical"), applySlow(t, targetUnit, castContext.val("slow"), castContext.val("slowDur"), e, "fengling_ult"))
            },
            spawnAreaResult = spawnArea(world, {
              visual: "fengling_ult_rain",
              owner: e,
              pos: targetPoint,
              radius: castContext.radius,
              duration: rainDuration,
              tickInterval: rainTickInterval,
              onTick(tickWorld, tickArea) {
                ticksElapsed < rainTickCount && dealRainTick(tickArea)
              },
            })
          dealRainTick(spawnAreaResult)
        },
      }))
  },
})
const YEQUE_PASSIVE = HERO_TABLE.yeque.passive.values as PassiveNumView,
  YEQUE_S2_CAST_DELAY = getCastDelay("yeque", "s2"),
  YEQUE_SHADOW_DURATION = 3,
  YEQUE_SHADOW_VALUE = 0.3
registerPassiveFactory("yeque", {
  modifyDamageDealt(world, attacker, target, damageConfig) {
    isStructure(target) || (target.hp < target.stats.maxHp * YEQUE_PASSIVE.threshold && (damageConfig.amount *= 1 + YEQUE_PASSIVE.bonus), target.kind === "monster" && (damageConfig.amount *= 1 + YEQUE_PASSIVE.monsterBonus))
  },
  onTakedown(world, killer) {
    ;(resetSkillCooldown(killer, "s1"), resetSkillCooldown(killer, "s2"), killer.alive && (healTargetUnit(world, killer, killer, killer.stats.maxHp * YEQUE_PASSIVE.healHpRatio, !0), applyStatusEffect(world, killer, "yeque_shadow", { duration: YEQUE_SHADOW_DURATION, sourceId: killer.id, merge: "replace" })))
  },
})
registerCastHandler("yeque", "s1", {
  movement: !0,
  noAnim: !0,
  lockTime: 0,
  aimSpeed: getSkillValueRaw("yeque", "s1", "dashSpeed"),
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      dashOrigin = clonePoint(e.pos)
    let isActive = !1
    ;(emitSkillFx(t, "yeque_s1_dash", dashOrigin, e.team, { unitId: e.id, from: dashOrigin, to: findMoveEndpoint(t, e, castContext.dir, castContext.range), dir: clonePoint(castContext.dir) }),
      startDash(t, e, {
        dir: castContext.dir,
        distance: castContext.range,
        speed: castContext.val("dashSpeed"),
        hitRadius: castContext.width * 0.5,
        filter: makeTargetFilter(e.team),
        onHit(target) {
          const isHeroTarget = target.kind === "hero"
          ;(dealSkillHit(castContext, target, scaleSkillDamage(castContext, "damage", { ad: "adRatio" }), "physical"), isHeroTarget && !isActive && ((isActive = !0), reduceSkillCooldown(e, "s1", castContext.val("refund"))))
        },
      }))
  },
})
registerCastHandler("yeque", "s2", {
  aimSpeed: getSkillValueRaw("yeque", "s2", "speed"),
  aimLead: YEQUE_S2_CAST_DELAY,
  cast(castContext) {
    const { sim: t, caster: e } = castContext
    scheduleIfCasterAlive(castContext, YEQUE_S2_CAST_DELAY, () => {
      const scaledDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" }),
        bladeCount = Math.round(castContext.val("blades")),
        spreadAngle = castContext.val("spread"),
        baseAngle = Math.atan2(castContext.dir.y, castContext.dir.x),
        hitTargetIds = new Set()
      emitSkillFx(t, "yeque_s2_cast", e.pos, e.team, { unitId: e.id, dir: clonePoint(castContext.dir) })
      for (let index = 0; index < bladeCount; index++) {
        const bladeAngle = baseAngle + (index - (bladeCount - 1) * 0.5) * spreadAngle
        spawnConfiguredProjectile(t, {
          visual: "yeque_s2",
          owner: e,
          from: e.pos,
          dir: { x: Math.cos(bladeAngle), y: Math.sin(bladeAngle) },
          speed: castContext.val("speed"),
          range: castContext.range,
          radius: castContext.width * 0.5,
          filter: makeTargetFilter(e.team),
          onHit(world, projectile, target) {
            const repeatDamageMultiplier = hitTargetIds.has(target.id) ? castContext.val("repeatRatio") : 1
            ;(hitTargetIds.add(target.id), dealSkillDamage(world, e, target, scaledDamage * repeatDamageMultiplier, "physical", castContext.slot), applySlow(world, target, castContext.val("slow"), castContext.val("slowDur"), e, "yeque_s2"))
          },
        })
      }
    })
  },
})
registerCastHandler("yeque", "ult", {
  movement: !0,
  cast(castContext) {
    const { sim: t, caster: e } = castContext,
      skillTarget = castContext.target
    if (!skillTarget) return
    const vanishOrigin = clonePoint(e.pos)
    ;(emitSkillFx(t, "yeque_ult_vanish", vanishOrigin, e.team, { unitId: e.id, targetId: skillTarget.id }),
      applyStatusEffect(t, e, "untargetable", {
        duration: castContext.val("vanish"),
        sourceId: e.id,
        key: "yeque_ult",
        merge: "replace",
        onExpire() {
          if (!e.alive || !skillTarget.alive || t.byId.get(skillTarget.id) !== skillTarget) return
          const behindTargetAngle = skillTarget.facing + Math.PI,
            strikeDistance = skillTarget.radius + e.radius + YEQUE_SHADOW_VALUE,
            strikePosition = clonePoint(teleportToPosition(t, e, { x: skillTarget.pos.x + Math.cos(behindTargetAngle) * strikeDistance, y: skillTarget.pos.y + Math.sin(behindTargetAngle) * strikeDistance }))
          ;(faceUnitToward(e, skillTarget.pos), emitSkillFx(t, "yeque_ult_strike", skillTarget.pos, e.team, { unitId: e.id, targetId: skillTarget.id, from: vanishOrigin, to: strikePosition }))
          const strikeDamage = scaleSkillDamage(castContext, "damage", { ad: "adRatio" }) + castContext.val("missingRatio") * (skillTarget.stats.maxHp - skillTarget.hp)
          dealSkillHit(castContext, skillTarget, strikeDamage, "physical")
        },
      }))
  },
})
const SPELL_SHIELD_HP_RATIO = 0.35,
  ITEM_PASSIVE_VALUE_UQ = 4,
  ITEM_PASSIVE_VALUE_PQ = 60,
  REGEN_OUT_OF_COMBAT_DELAY = 5,
  passiveValue = (unit) => unit.passive?.value ?? 0,
  passiveValue2 = (unit) => unit.passive?.value2 ?? 0
registerPassiveDef("onhit_magic", (unit) => ({
  modifyBasicAttack(world, attacker, target, damageMods) {
    isStructure(target) || (damageMods.bonusMagic += passiveValue(unit))
  },
}))
registerPassiveDef("thorns", (unit) => ({
  onDamageTaken(world, victim, attacker, damageAmount, damageConfig) {
    damageConfig.kind !== "basic" || !attacker || !attacker.alive || isStructure(attacker) || dealProcDamage(world, victim, attacker, damageAmount * passiveValue(unit), "magic")
  },
}))
registerPassiveDef("spell_slow", (unit) => ({
  onSkillHit(world, attacker, target) {
    target.alive && applySlow(world, target, passiveValue(unit), passiveValue2(unit), attacker, "item_frost")
  },
}))
registerPassiveDef("regen_ooc", (passiveDef) => ({
  onTick(world, unit, deltaTime) {
    unit.inCombat || unit.hp >= unit.stats.maxHp || world.state.time - unit.lastHitTime < REGEN_OUT_OF_COMBAT_DELAY || (unit.hp = Math.min(unit.stats.maxHp, unit.hp + unit.stats.maxHp * passiveValue(passiveDef) * deltaTime))
  },
}))
registerPassiveDef("cripple_aura", (unit) => ({
  onDamageTaken(world, victim, attacker, damageAmount, damageConfig) {
    damageConfig.kind !== "basic" || !attacker || !attacker.alive || isStructure(attacker) || applyAttackSpeedBuff(world, attacker, -passiveValue(unit), passiveValue2(unit), victim, "item_cripple")
  },
}))
registerPassiveDef("execute_bonus", (unit) => ({
  modifyDamageDealt(world, attacker, target, damageConfig) {
    isStructure(target) || (target.hp < target.stats.maxHp * passiveValue2(unit) && (damageConfig.amount *= 1 + passiveValue(unit)))
  },
}))
registerPassiveDef("spell_shield", (unit) => ({
  onDamageTaken(world, victim) {
    !victim.alive || victim.hp >= victim.stats.maxHp * SPELL_SHIELD_HP_RATIO || (tryUseHeroCooldown(world, victim, "item_spell_shield", ITEM_PASSIVE_VALUE_PQ) && applyShieldBuff(world, victim, passiveValue(unit) + passiveValue2(unit) * victim.level, ITEM_PASSIVE_VALUE_UQ, victim, "item_spell_shield"))
  },
}))


export { PANYUE_PASSIVE, PANYUE_FISSURE_TICK_INTERVAL, PANYUE_SLOW_DURATION, PANYUE_UNSTOPPABLE_BONUS, PANYUE_AIM_RANGE_FACTOR, CHIJIN_PASSIVE, CHIJIN_S1_CAST_DELAY, XINGLI_PASSIVE, XINGLI_S1_CAST_DELAY, XINGLI_METEOR_COUNT, XINGLI_METEOR_RADIUS, XINGLI_ULT_DELAY_COMPENSATION, randomPointInRadius, castXingliMeteorBarrage, FENGLING_PASSIVE, FENGLING_S1_CAST_DELAY, FENGLING_ULT_DELAY_COMPENSATION, YEQUE_PASSIVE, YEQUE_S2_CAST_DELAY, YEQUE_SHADOW_DURATION, YEQUE_SHADOW_VALUE, SPELL_SHIELD_HP_RATIO, ITEM_PASSIVE_VALUE_UQ, ITEM_PASSIVE_VALUE_PQ, REGEN_OUT_OF_COMBAT_DELAY, passiveValue, passiveValue2 }