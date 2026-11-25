/**
 * 几何与骨骼辅助工具：路径/姿态/网格计算的纯函数组
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { solveTwoBoneIK } from '../fx/effect-spawner'
import { aimPropAtTarget, XIANGYU_COLOR_PALETTE } from './hero-preview'
import { MONSTER_STATS } from '../game-balance'
import { applyDamage, applyStatusEffect, healUnit, isStatusImmune } from '../sim/combat-behavior'
import { interruptDash, recomputeStats } from '../sim/unit-stats'
import { cancelAttackWindup, removeBuff, refreshStatusFlags, STAT_MODIFYING_BUFF_IDS, invokeBuffRemoval, markRevealedOnAttack } from '../sim/skill-cast'
import { stopMovement, faceTowards, startAction, teleportUnit, createDashState } from '../sim/combat-core'
import { spawnProjectile } from '../sim/simulation'
import { ea } from '../skills/skill-values'
import { queryTargetsByDistance } from '../sim/generic-cast-handler'

const GEOMETRY_TWO_PI = Math.PI * 2

const IDENTITY_QUAT_ARRAY = [0, 0, 0, 1]

function poseQuadrupedLegIk(quadrupedRig, poseStack, legIndex, footTargetX, footTargetY, footTargetZ, aimEulerX = 0) {
  const selectedLegs = quadrupedRig.legs[legIndex]
  ;(solveTwoBoneIK(quadrupedRig.rig, poseStack, selectedLegs.upper, selectedLegs.lower, selectedLegs.foot, footTargetX, footTargetY, footTargetZ, selectedLegs.side * 0.12, 0.1, selectedLegs.bend, selectedLegs.bend, IDENTITY_QUAT_ARRAY), aimPropAtTarget(poseStack, selectedLegs.foot, IDENTITY_QUAT_ARRAY, aimEulerX, 0, 0))
}

function poseAllLegsIk(quadrupedRig, poseStack, footTargetXOffset = 0, footTargetZOffset = 0, activeLegMask = 15) {
  for (let index = 0; index < 4; index++) {
    if (!(activeLegMask & (1 << index))) continue
    const selectedLeg = quadrupedRig.legs[index]
    poseQuadrupedLegIk(quadrupedRig, poseStack, index, selectedLeg.rx + footTargetXOffset, selectedLeg.ry, selectedLeg.rz + footTargetZOffset)
  }
}

const QUADRUPED_GAIT_TABLE = { walk: { off: [0, 0.5, 0.75, 0.25], duty: 0.64 }, trot: { off: [0, 0.5, 0.5, 0], duty: 0.5 }, bound: { off: [0, 0.14, 0.56, 0.7], duty: 0.42 } }

const XIANGYU_PALETTE_ALIAS = XIANGYU_COLOR_PALETTE

function getMonsterDisplayName(monster) {
  const selectedMONSTER_STATS = MONSTER_STATS[monster.monsterType]
  return selectedMONSTER_STATS.alias || selectedMONSTER_STATS.epic ? selectedMONSTER_STATS.name : "小野怪"
}

function applyForcedDash(battleWorld, dashingUnit, dashDirX, dashDirY, dashDistance, dashSpeed) {
  if (!dashingUnit.alive || dashingUnit.rt.weight === 0 || isStatusImmune(dashingUnit, "airborne")) return !1
  const distance = Math.hypot(dashDirX, dashDirY)
  if (distance < 1e-6 || dashDistance <= 0) return !1
  const runtime = dashingUnit.rt
  ;(runtime.dash && interruptDash(battleWorld, dashingUnit, "interrupted"), cancelAttackWindup(dashingUnit))
  const DashStateValue = createDashState(battleWorld, "forced")
  return ((DashStateValue.dirX = dashDirX / distance), (DashStateValue.dirY = dashDirY / distance), (DashStateValue.speed = Math.max(0.1, dashSpeed)), (DashStateValue.left = dashDistance), (DashStateValue.dur = dashDistance / DashStateValue.speed), (runtime.dash = DashStateValue), (runtime.path = null), !0)
}

/**
 * 创建配置。
 *
 * @param battleWorld - 来源
 * @param projectileSpec - 输入
 */
function spawnConfiguredProjectile(battleWorld, projectileSpec) {
  const projectileTeam = projectileSpec.team ?? projectileSpec.owner.team,
    spawnProjectileValue = spawnProjectile(battleWorld, projectileSpec.visual, projectileSpec.owner, projectileSpec.from, projectileTeam),
    distance = Math.hypot(projectileSpec.dir.x, projectileSpec.dir.y)
  return (
    distance > 1e-6 ? ((spawnProjectileValue.dir.x = projectileSpec.dir.x / distance), (spawnProjectileValue.dir.y = projectileSpec.dir.y / distance)) : ((spawnProjectileValue.dir.x = Math.cos(projectileSpec.owner.facing)), (spawnProjectileValue.dir.y = Math.sin(projectileSpec.owner.facing))),
    (spawnProjectileValue.speed = Math.max(1, projectileSpec.speed)),
    (spawnProjectileValue.radius = projectileSpec.radius),
    (spawnProjectileValue.maxRange = projectileSpec.range),
    (spawnProjectileValue.pierce = projectileSpec.pierce === !0),
    (spawnProjectileValue.filter = projectileSpec.filter ?? null),
    (spawnProjectileValue.onHit = projectileSpec.onHit ?? null),
    (spawnProjectileValue.onEnd = projectileSpec.onEnd ?? null),
    spawnProjectileValue
  )
}

/**
 * 获取状态效果。
 *
 * @param targetUnit - 输入
 * @param lookupOption - 输入
 */
function getBuffStackCount(targetUnit, lookupOption) {
  let result = 0
  const unitBuffs = targetUnit.buffs
  for (let index = 0; index < unitBuffs.length; index++) unitBuffs[index].id === lookupOption && unitBuffs[index].stacks > result && (result = unitBuffs[index].stacks)
  return result
}

function removeBuffById(battleWorld, targetUnit, buffToRemove) {
  const buffIndex = targetUnit.buffs.indexOf(buffToRemove)
  return buffIndex < 0 ? !1 : (targetUnit.buffs.splice(buffIndex, 1), refreshStatusFlags(targetUnit), invokeBuffRemoval(battleWorld, targetUnit, buffToRemove), targetUnit.alive && (targetUnit.kind === "hero" || STAT_MODIFYING_BUFF_IDS.has(buffToRemove.id)) && recomputeStats(battleWorld, targetUnit), !0)
}

const HEAL_TICK_SECONDS = 0.5

/**
 * 处理英雄。
 *
 * @param battleWorld - 主要输入
 * @param recallingHero - 英雄
 */
function finishHeroRecall(battleWorld, recallingHero) {
  if (recallingHero.kind !== "hero" || !recallingHero.alive) return
  ;(stopMovement(recallingHero), (recallingHero.h.atkOrder = !1))
  const teleportUnitResult = teleportUnit(battleWorld, recallingHero, recallingHero.h.spawn.x, recallingHero.h.spawn.y)
  ;((recallingHero.facing = recallingHero.team === 1 ? Math.PI * 0.75 : -Math.PI * 0.25), battleWorld.fx("recall_done", teleportUnitResult, recallingHero.team, { unitId: recallingHero.id }))
}

function applyHealTick(battleWorld, healedUnit, healBuff) {
  const healConfig = ea.heal,
    healTickCount = Math.round(healConfig.duration / HEAL_TICK_SECONDS)
  ;(healUnit(battleWorld, healedUnit, healedUnit, (healedUnit.stats.maxHp * healConfig.hpRatio) / healTickCount), (healedUnit.mana = Math.min(healedUnit.stats.maxMana, healedUnit.mana + (healedUnit.stats.maxMana * healConfig.manaRatio) / healTickCount)))
}

/**
 * 查找单位。
 *
 * @param battleWorld - 输入
 * @param position - 坐标
 * @param facingDirection - 输入
 * @param searchRadius - 射程
 * @param angle - 输入
 * @param unitFilter - 附加输入
 */
function findUnitsInCone(battleWorld, position, facingDirection, searchRadius, angle, unitFilter) {
  const TargetsByDistanceValue = queryTargetsByDistance(battleWorld, position, searchRadius, unitFilter),
    halfConeAngle = angle * 0.5,
    distance = Math.hypot(facingDirection.x, facingDirection.y) || 1,
    facingDirX = facingDirection.x / distance,
    facingDirY = facingDirection.y / distance,
    unitsInCone = []
  for (const candidateUnit of TargetsByDistanceValue) {
    const offsetX = candidateUnit.pos.x - position.x,
      offsetY = candidateUnit.pos.y - position.y,
      targetDistance = Math.hypot(offsetX, offsetY)
    if (targetDistance <= candidateUnit.radius) {
      unitsInCone.push(candidateUnit)
      continue
    }
    const angleCosine = (offsetX * facingDirX + offsetY * facingDirY) / targetDistance
    Math.acos(angleCosine > 1 ? 1 : angleCosine < -1 ? -1 : angleCosine) <= halfConeAngle + Math.asin(Math.min(1, candidateUnit.radius / targetDistance)) && unitsInCone.push(candidateUnit)
  }
  return unitsInCone
}

function dealProcDamage(battleWorld, damageSource, damageTarget, rawDamage, physicalKind) {
  return applyDamage(battleWorld, damageSource, damageTarget, rawDamage, physicalKind, "proc")
}

function healTargetUnit(battleWorld, healSource, healTarget, requestedHeal, showHealFx = !1) {
  const healUnitResult = healUnit(battleWorld, healSource, healTarget, requestedHeal)
  return (showHealFx && healUnitResult > 0 && battleWorld.fx("heal", healTarget.pos, healTarget.team, { unitId: healTarget.id }), healUnitResult)
}

function applyHasteBuff(battleWorld, targetUnit, hasteAmount, hasteDuration, sourceUnit, effectKey) {
  return applyStatusEffect(battleWorld, targetUnit, "haste", { duration: hasteDuration, value: hasteAmount, sourceId: sourceUnit ? sourceUnit.id : -1, key: effectKey, merge: "replace" })
}

/**
 * 判断状态效果。
 *
 * @param battleWorld - 输入
 * @param targetUnit - 次要输入
 * @param buffsToCheck - 第三输入
 */
function hasAnyBuff(battleWorld, targetUnit, buffsToCheck) {
  let isActive = !1
  for (const buffToCheck of buffsToCheck) removeBuff(battleWorld, targetUnit, buffToCheck) && (isActive = !0)
  return isActive
}

function teleportToPosition(battleWorld, teleportedUnit, destination) {
  return teleportUnit(battleWorld, teleportedUnit, destination.x, destination.y)
}

/**
 * 处理坐标。
 *
 * @param battleWorld - 主要输入
 * @param dashingUnit - 次要输入
 * @param targetPosition - 输入
 * @param maxDashDistance - 第四输入
 * @param dashSpeed - 附加输入
 */
function dashTowardPoint(battleWorld, dashingUnit, targetPosition, maxDashDistance, dashSpeed = 14) {
  const deltaX = targetPosition.x - dashingUnit.pos.x,
    deltaY = targetPosition.y - dashingUnit.pos.y,
    distance = Math.hypot(deltaX, deltaY)
  return distance < 0.05 ? !1 : applyForcedDash(battleWorld, dashingUnit, deltaX, deltaY, Math.min(maxDashDistance, distance), dashSpeed)
}

function scheduleDelayedAction(battleSim, delaySeconds, delayedAction) {
  return battleSim.schedule(delaySeconds, delayedAction)
}

function scheduleIfCasterAlive(castContext, delaySeconds, onCasterAlive, cancelIfStunned = !1) {
  const { sim: battleSim, caster: caster } = castContext
  return battleSim.schedule(delaySeconds, () => {
    caster.alive && ((cancelIfStunned && caster.rt.stunned) || onCasterAlive())
  })
}

function beginUnitAction(battleWorld, actingUnit, actionName, timeLeft, cancelOnMove = !0) {
  startAction(battleWorld, actingUnit, actionName, timeLeft, cancelOnMove)
}

function extendDisarmDuration(world, disarmedUnit, extraDisarmDuration) {
  const disarmUntilTime = world.state.time + extraDisarmDuration
  ;(disarmUntilTime > disarmedUnit.rt.disarmUntil && (disarmedUnit.rt.disarmUntil = disarmUntilTime), cancelAttackWindup(disarmedUnit))
}

function faceUnitToward(facingUnit, targetPoint) {
  faceTowards(facingUnit, targetPoint.x, targetPoint.y)
}

function revealUnitAfterAttack(battleWorld, attackingUnit) {
  markRevealedOnAttack(battleWorld, attackingUnit)
}

function reduceSkillCooldown(hero, skillIndex, cooldownReductionRatio) {
  const selectedSkills = hero.skills[skillIndex]
  selectedSkills.cd = Math.max(0, selectedSkills.cd - selectedSkills.cdMax * cooldownReductionRatio)
}

function resetSkillCooldown(hero, skillIndex) {
  hero.skills[skillIndex].cd = 0
}

/**
 * 处理英雄。
 *
 * @param battleWorld - 战场
 * @param hero - 英雄
 * @param lookupKey - 查找键
 * @param cooldownDuration - 第四输入
 */
function tryUseHeroCooldown(battleWorld, hero, lookupKey, cooldownDuration) {
  const currentTime = battleWorld.state.time,
    cooldownReadyAt = hero.h.cooldowns.get(lookupKey) ?? -1 / 0
  return currentTime < cooldownReadyAt ? !1 : (hero.h.cooldowns.set(lookupKey, currentTime + cooldownDuration), !0)
}

export { getMonsterDisplayName, findUnitsInCone, finishHeroRecall, poseQuadrupedLegIk, applyHealTick, revealUnitAfterAttack, scheduleDelayedAction, resetSkillCooldown, faceUnitToward, applyHasteBuff, scheduleIfCasterAlive, teleportToPosition, QUADRUPED_GAIT_TABLE, dashTowardPoint, extendDisarmDuration, poseAllLegsIk, getBuffStackCount, tryUseHeroCooldown, removeBuffById, dealProcDamage, HEAL_TICK_SECONDS, spawnConfiguredProjectile, XIANGYU_PALETTE_ALIAS, GEOMETRY_TWO_PI, hasAnyBuff, reduceSkillCooldown, beginUnitAction, healTargetUnit }