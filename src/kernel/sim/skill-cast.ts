/**
 * 技能施放
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { VISION_RANGES } from '../game-balance'
import { recomputeStats } from './unit-stats'
import { MOVE_DIRECTION, SUMMONER_SPELL_SPECS, canTarget, getCastHandler, isSummonerSpell, startAction } from './combat-core'
import { AREA_ALPHA_AGE_SCALE } from '../fx/emitters'
import { Nh, ea } from '../skills/skill-values'

function markRevealedOnAttack(world, attacker) {
  attacker.rt.revealUntil = world.state.time + VISION_RANGES.revealOnAttack
}

function cancelAttackWindup(attacker) {
  const runtime = attacker.rt
  runtime.windupLeft <= 0 || ((runtime.windupLeft = 0), (runtime.windupTarget = -1), (runtime.atkCd = 0), runtime.act === "attack" && (runtime.act = null))
}

const HARD_CROWD_CONTROL_STATES = new Set(["stun", "airborne", "root", "silence"]),
  STAT_MODIFYING_BUFF_IDS = new Set(["slow", "haste", "attack_speed", "frost_insight", "star_blessing"]),
  SLOW_IMMUNE_BUFF_IDS = new Set(["chijin_spin"])

/**
 * 判断状态效果。
 *
 * @param targetUnit - 输入
 * @param buffId - 次要输入
 */
function hasActiveBuff(targetUnit, buffId) {
  const targetBuffs = targetUnit.buffs
  for (let index = 0; index < targetBuffs.length; index++) if (targetBuffs[index].id === buffId) return !0
  return !1
}

function refreshStatusFlags(targetUnit) {
  const rtValue = targetUnit.rt
  let isActive = !1,
    isRooted = !1,
    isSilenced = !1,
    isUntargetable = !1,
    isUnstoppable = !1,
    isInvulnerable = !1,
    isSlowImmune = !1,
    airborneBuff = null,
    total = 0
  const targetBuffs = targetUnit.buffs
  for (let index = 0; index < targetBuffs.length; index++) {
    const selectedD = targetBuffs[index]
    switch (selectedD.id) {
      case "stun":
        isActive = !0
        break
      case "airborne":
        airborneBuff = selectedD
        break
      case "root":
        isRooted = !0
        break
      case "silence":
        isSilenced = !0
        break
      case "untargetable":
        isUntargetable = !0
        break
      case "unstoppable":
        isUnstoppable = !0
        break
      case "respawn_guard":
        isInvulnerable = !0
        break
      case "shield":
        total += selectedD.value
        break
      default:
        SLOW_IMMUNE_BUFF_IDS.has(selectedD.id) && (isSlowImmune = !0)
        break
    }
  }
  ;((rtValue.stunned = isActive || airborneBuff !== null),
    (rtValue.airborne = airborneBuff),
    (rtValue.rooted = isRooted),
    (rtValue.silenced = isSilenced),
    (rtValue.untargetable = isUntargetable),
    (rtValue.unstoppable = isUnstoppable),
    (rtValue.slowImmune = isSlowImmune),
    (targetUnit.shield = total),
    targetUnit.kind === "hero" && (targetUnit.invulnerable = isInvulnerable))
}

function invokeBuffRemoval(battleWorld, targetUnit, removedBuff) {
  ;(removedBuff.id === "recall" && targetUnit.rt.act === "channel" && (targetUnit.rt.act = null), removedBuff.onRemove && removedBuff.onRemove(battleWorld, targetUnit, removedBuff))
}

/**
 * 移除状态效果。
 *
 * @param battleWorld - 主要输入
 * @param targetUnit - 输入
 * @param lookupKey - 查找键
 * @param requiredKey - 第四输入
 */
function removeBuff(battleWorld, targetUnit, lookupKey, requiredKey?) {
  const targetBuffs = targetUnit.buffs
  let removedBuffs = null
  for (let index = targetBuffs.length - 1; index >= 0; index--) {
    const selectedI = targetBuffs[index]
    selectedI.id !== lookupKey || (requiredKey !== void 0 && selectedI.key !== requiredKey) || (targetBuffs.splice(index, 1), removedBuffs ? removedBuffs.push(selectedI) : (removedBuffs = [selectedI]))
  }
  if (!removedBuffs) return !1
  refreshStatusFlags(targetUnit)
  for (const removedBuff of removedBuffs) invokeBuffRemoval(battleWorld, targetUnit, removedBuff)
  return (targetUnit.alive && (targetUnit.kind === "hero" || STAT_MODIFYING_BUFF_IDS.has(lookupKey)) && recomputeStats(battleWorld, targetUnit), !0)
}

const ALL_CAST_SLOT_IDS = ["s1", "s2", "ult", "recall", "heal", "flash"],
  ATTACK_TARGET_SEARCH_RADIUS = 7,
  ATTACK_ACQUIRE_RANGE = 2.5,
  ATTACK_RANGE_TOLERANCE = 0.75,
  TARGET_PICK_PADDING = 0.5,
  PENDING_CAST_WINDOW = 0.6,
  MAX_AIM_LEAD_SPEED = 12,
  DEFAULT_POSITION_AIM_LEAD = 0.3,
  RESPAWN_GUARD_DURATION = 2,
  AUTO_BUY_CHECK_INTERVAL = 15

function rejectCast(battleWorld, caster, rejectReason, silentReject = !1) {
  return (caster.isPlayer && !silentReject && battleWorld.emit({ type: "reject", unitId: caster.id, reason: rejectReason }), !1)
}

function cancelRecall(battleWorld, caster) {
  hasActiveBuff(caster, "recall") && removeBuff(battleWorld, caster, "recall")
}

const CAST_TARGET_QUERY_BUFFER = []

function getCastSpecForSlot(hero, lookupOption) {
  return isSummonerSpell(lookupOption) ? SUMMONER_SPELL_SPECS[lookupOption] : hero.h.def.skills[lookupOption].cast
}

/**
 * 处理坐标。
 *
 * @param movingUnit - 主要输入
 * @param leadTime - 次要输入
 */
function extrapolatePosition(movingUnit, leadTime) {
  const velocityX = (movingUnit.pos.x - movingUnit.prevPos.x) / AREA_ALPHA_AGE_SCALE,
    velocityY = (movingUnit.pos.y - movingUnit.prevPos.y) / AREA_ALPHA_AGE_SCALE
  return leadTime <= 0 || Math.hypot(velocityX, velocityY) > MAX_AIM_LEAD_SPEED ? { x: movingUnit.pos.x, y: movingUnit.pos.y } : { x: movingUnit.pos.x + velocityX * leadTime, y: movingUnit.pos.y + velocityY * leadTime }
}

/**
 * 处理目标。
 *
 * @param battleWorld - 主要输入
 * @param caster - 次要输入
 * @param queryRadius - 第三输入
 * @param heroesOnly - 第四输入
 * @returns 数值结果
 */
function acquireCastTarget(battleWorld, caster, queryRadius, heroesOnly) {
  const Value = battleWorld.grid.query(caster.pos.x, caster.pos.y, queryRadius, CAST_TARGET_QUERY_BUFFER)
  let lowestHpHeroTarget = null,
    lowestHeroHpRatio = 1 / 0,
    nearestOtherTarget = null,
    nearestDistance = 1 / 0
  for (let index = 0; index < Value; index++) {
    const selectedCAST_TARGET_QUERY_BUFFER = CAST_TARGET_QUERY_BUFFER[index]
    if (selectedCAST_TARGET_QUERY_BUFFER.kind === "tower" || selectedCAST_TARGET_QUERY_BUFFER.kind === "core" || !canTarget(caster, selectedCAST_TARGET_QUERY_BUFFER)) continue
    const distance = Math.hypot(selectedCAST_TARGET_QUERY_BUFFER.pos.x - caster.pos.x, selectedCAST_TARGET_QUERY_BUFFER.pos.y - caster.pos.y) - selectedCAST_TARGET_QUERY_BUFFER.radius
    if (!(distance > queryRadius))
      if (selectedCAST_TARGET_QUERY_BUFFER.kind === "hero") {
        const heroHpRatio = selectedCAST_TARGET_QUERY_BUFFER.hp / selectedCAST_TARGET_QUERY_BUFFER.stats.maxHp
        heroHpRatio < lowestHeroHpRatio && ((lowestHeroHpRatio = heroHpRatio), (lowestHpHeroTarget = selectedCAST_TARGET_QUERY_BUFFER))
      } else distance < nearestDistance && ((nearestDistance = distance), (nearestOtherTarget = selectedCAST_TARGET_QUERY_BUFFER))
  }
  return lowestHpHeroTarget ?? (heroesOnly ? null : nearestOtherTarget)
}

/**
 * 处理坐标。
 *
 * @param caster - 主要输入
 * @param targetX - 次要输入
 * @param targetY - 第三输入
 * @param fallbackDirection - 输入
 */
function directionToPoint(caster, targetX, targetY, fallbackDirection) {
  const offsetX = targetX - caster.pos.x,
    offsetY = targetY - caster.pos.y,
    distance = Math.hypot(offsetX, offsetY)
  return distance > 1e-4 ? { x: offsetX / distance, y: offsetY / distance } : { x: fallbackDirection.x, y: fallbackDirection.y }
}

function getFacingDirection(facingUnit) {
  const unitRuntime = facingUnit.rt
  return unitRuntime.moveMode === MOVE_DIRECTION ? { x: unitRuntime.dirX, y: unitRuntime.dirY } : { x: Math.cos(facingUnit.facing), y: Math.sin(facingUnit.facing) }
}

function computeAimDirectionWithLead(caster, targetUnit, castSpec, fallbackDirection) {
  let total = castSpec.aimLead ?? 0
  castSpec.aimSpeed && castSpec.aimSpeed > 0 && (total += Math.hypot(targetUnit.pos.x - caster.pos.x, targetUnit.pos.y - caster.pos.y) / castSpec.aimSpeed)
  const extrapolatePositionResult = extrapolatePosition(targetUnit, Math.min(total, 0.8))
  return directionToPoint(caster, extrapolatePositionResult.x, extrapolatePositionResult.y, fallbackDirection)
}

function isValidAimPoint(aimPoint) {
  return aimPoint !== void 0 && Number.isFinite(aimPoint.x) && Number.isFinite(aimPoint.y)
}

function resolveCastAim(battleWorld, caster, castSpec, castHandler, castCommand) {
  const casterPos = caster.pos,
    FacingDirectionValue = getFacingDirection(caster)
  let isReady = null
  if (castCommand.targetId !== void 0 && castCommand.targetId >= 0) {
    const getValue = battleWorld.byId.get(castCommand.targetId)
    getValue && canTarget(caster, getValue) && (isReady = getValue)
  }
  const useTargetedAim = castHandler.aim !== "facing"
  switch (castSpec.type) {
    case "self":
      return { dir: { x: Math.cos(caster.facing), y: Math.sin(caster.facing) }, pos: { x: casterPos.x, y: casterPos.y }, target: null }
    case "target": {
      const targetPickRadius = castSpec.range + TARGET_PICK_PADDING
      let castTarget = isReady
      return (
        castTarget && (castTarget.kind !== "hero" || Math.hypot(castTarget.pos.x - casterPos.x, castTarget.pos.y - casterPos.y) - castTarget.radius > targetPickRadius) && (castTarget = null),
        castTarget || (castTarget = acquireCastTarget(battleWorld, caster, targetPickRadius, !0)),
        castTarget ? { dir: directionToPoint(caster, castTarget.pos.x, castTarget.pos.y, FacingDirectionValue), pos: { x: castTarget.pos.x, y: castTarget.pos.y }, target: castTarget } : null
      )
    }
    case "direction":
    case "cone": {
      let aimDirection
      if (isValidAimPoint(castCommand.dir) && Math.hypot(castCommand.dir.x, castCommand.dir.y) > 0.001) aimDirection = directionToPoint(caster, casterPos.x + castCommand.dir.x, casterPos.y + castCommand.dir.y, FacingDirectionValue)
      else if (isValidAimPoint(castCommand.pos)) aimDirection = directionToPoint(caster, castCommand.pos.x, castCommand.pos.y, FacingDirectionValue)
      else if (isReady) aimDirection = computeAimDirectionWithLead(caster, isReady, castHandler, FacingDirectionValue)
      else {
        const acquiredTarget = useTargetedAim ? acquireCastTarget(battleWorld, caster, (castHandler.aimRange ?? castSpec.range) + TARGET_PICK_PADDING, !1) : null
        aimDirection = acquiredTarget ? computeAimDirectionWithLead(caster, acquiredTarget, castHandler, FacingDirectionValue) : FacingDirectionValue
      }
      return { dir: aimDirection, pos: { x: casterPos.x + aimDirection.x * castSpec.range, y: casterPos.y + aimDirection.y * castSpec.range }, target: null }
    }
    case "position": {
      let aimPosition
      const aimLeadTime = castHandler.aimLead ?? DEFAULT_POSITION_AIM_LEAD
      if (isValidAimPoint(castCommand.pos)) aimPosition = { x: castCommand.pos.x, y: castCommand.pos.y }
      else if (isValidAimPoint(castCommand.dir) && Math.hypot(castCommand.dir.x, castCommand.dir.y) > 0.001) {
        const directionToPointResult = directionToPoint(caster, casterPos.x + castCommand.dir.x, casterPos.y + castCommand.dir.y, FacingDirectionValue)
        aimPosition = { x: casterPos.x + directionToPointResult.x * castSpec.range, y: casterPos.y + directionToPointResult.y * castSpec.range }
      } else if (isReady) aimPosition = extrapolatePosition(isReady, aimLeadTime)
      else {
        const acquiredAimTarget = useTargetedAim ? acquireCastTarget(battleWorld, caster, castSpec.range + castSpec.radius * 0.6, !1) : null
        aimPosition = acquiredAimTarget ? extrapolatePosition(acquiredAimTarget, aimLeadTime) : { x: casterPos.x + FacingDirectionValue.x * castSpec.range * 0.6, y: casterPos.y + FacingDirectionValue.y * castSpec.range * 0.6 }
      }
      const aimOffsetX = aimPosition.x - casterPos.x,
        aimOffsetY = aimPosition.y - casterPos.y,
        distance = Math.hypot(aimOffsetX, aimOffsetY)
      return (distance > castSpec.range && ((aimPosition.x = casterPos.x + (aimOffsetX / distance) * castSpec.range), (aimPosition.y = casterPos.y + (aimOffsetY / distance) * castSpec.range)), { dir: distance > 1e-4 ? { x: aimOffsetX / distance, y: aimOffsetY / distance } : FacingDirectionValue, pos: aimPosition, target: null })
    }
  }
}

/**
 * 处理技能。
 *
 * @param battleWorld - 战场
 * @param caster - 英雄
 * @param castCommand - 第三输入
 * @param silentReject - 第四输入
 */
function tryCastSkill(battleWorld, caster, castCommand, silentReject = !1) {
  const skillSlot = castCommand.slot,
    selectedSkills = caster.skills[skillSlot]
  if (!selectedSkills || !caster.alive) return !1
  const heroRuntime = caster.rt,
    castTime = battleWorld.state.time
  if (selectedSkills.level <= 0) return rejectCast(battleWorld, caster, "disabled", silentReject)
  if (selectedSkills.cd > 0) return rejectCast(battleWorld, caster, "cooldown", silentReject)
  const isSummonerSpellResult = isSummonerSpell(skillSlot),
    CastHandlerValue = getCastHandler(caster.heroId, skillSlot)
  if (heroRuntime.stunned || (heroRuntime.silenced && !isSummonerSpellResult) || (CastHandlerValue.movement && heroRuntime.rooted)) return rejectCast(battleWorld, caster, "disabled", silentReject)
  if (caster.mana < selectedSkills.cost) return rejectCast(battleWorld, caster, "mana", silentReject)
  if (castTime < heroRuntime.lockUntil || heroRuntime.dash !== null) return ((caster.h.pendingCast = castCommand), (caster.h.pendingUntil = castTime + PENDING_CAST_WINDOW), !1)
  if (CastHandlerValue.canCast) {
    const canCastResult = CastHandlerValue.canCast(battleWorld, caster)
    if (canCastResult) return rejectCast(battleWorld, caster, canCastResult, silentReject)
  }
  const CastSpecForSlotValue = getCastSpecForSlot(caster, skillSlot),
    resolveCastAimResult = resolveCastAim(battleWorld, caster, CastSpecForSlotValue, CastHandlerValue, castCommand)
  if (!resolveCastAimResult) return rejectCast(battleWorld, caster, "no_target", silentReject)
  const skillDef = isSummonerSpellResult ? null : caster.h.def.skills[skillSlot],
    skillLevel = selectedSkills.level
  ;((caster.mana -= selectedSkills.cost),
    (selectedSkills.cdMax = skillDef ? skillDef.cooldown[skillLevel - 1] * (1 - caster.stats.cdr) : ea[skillSlot].cooldown),
    (selectedSkills.cd = selectedSkills.cdMax),
    cancelAttackWindup(caster),
    skillSlot !== "recall" && cancelRecall(battleWorld, caster),
    CastSpecForSlotValue.type !== "self" && (caster.facing = Math.atan2(resolveCastAimResult.dir.y, resolveCastAimResult.dir.x)),
    markRevealedOnAttack(battleWorld, caster))
  const castDuration = skillDef ? skillDef.castTime : 0,
    castLockDuration = CastHandlerValue.lockTime ?? castDuration
  ;(castLockDuration > 0 && (heroRuntime.lockUntil = castTime + castLockDuration), skillDef && castDuration > 0 && !CastHandlerValue.noAnim && startAction(battleWorld, caster, `cast_${skillSlot}`, castDuration, !0))
  const xConfig = { x: caster.pos.x, y: caster.pos.y }
  battleWorld.emit({ type: "skillCast", unitId: caster.id, heroId: caster.heroId, slot: skillSlot, pos: xConfig, dir: { x: resolveCastAimResult.dir.x, y: resolveCastAimResult.dir.y }, targetPos: { x: resolveCastAimResult.pos.x, y: resolveCastAimResult.pos.y }, targetId: resolveCastAimResult.target ? resolveCastAimResult.target.id : -1 })
  const simConfig = {
      sim: battleWorld,
      caster: caster,
      slot: skillSlot,
      level: skillLevel,
      def: skillDef,
      origin: { x: xConfig.x, y: xConfig.y },
      dir: resolveCastAimResult.dir,
      targetPos: resolveCastAimResult.pos,
      target: resolveCastAimResult.target,
      spec: CastSpecForSlotValue,
      range: "range" in CastSpecForSlotValue ? CastSpecForSlotValue.range : 0,
      radius: "radius" in CastSpecForSlotValue ? CastSpecForSlotValue.radius : 0,
      width: "width" in CastSpecForSlotValue ? CastSpecForSlotValue.width : 0,
      angle: "angle" in CastSpecForSlotValue ? CastSpecForSlotValue.angle : 0,
      val: (statKey) => {
        if (!skillDef) throw new Error(`summoner skill "${skillSlot}" has no values`)
        return Nh(skillDef, statKey, skillLevel)
      },
    },
    skillHooks = caster.h.hooks
  for (let index = 0; index < skillHooks.length; index++) {
    const selectedY = skillHooks[index]
    selectedY.onSkillCast && selectedY.onSkillCast(battleWorld, caster, skillSlot)
  }
  return (CastHandlerValue.cast(simConfig), !0)
}

export { hasActiveBuff, rejectCast, cancelAttackWindup, ALL_CAST_SLOT_IDS, removeBuff, refreshStatusFlags, STAT_MODIFYING_BUFF_IDS, isValidAimPoint, ATTACK_ACQUIRE_RANGE, invokeBuffRemoval, tryCastSkill, HARD_CROWD_CONTROL_STATES, ATTACK_RANGE_TOLERANCE, ATTACK_TARGET_SEARCH_RADIUS, AUTO_BUY_CHECK_INTERVAL, cancelRecall, markRevealedOnAttack, RESPAWN_GUARD_DURATION }