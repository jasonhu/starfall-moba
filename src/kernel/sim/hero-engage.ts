/**
 * 英雄交战决策
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Matrix3, Vector3 } from 'three'
import { colorToRgb } from '../fx/particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { castDirectionWithError, castAtWithScatter, canCastAlongLine, isTargetSlowed, HERO_ACTION_SPECS, getScaledSkillValue, computeSkillDamage, hasBuffById, findBestAoeAimPoint, predictLeadAimPoint, isLineBlockedByMinions, dist2, scratchPoint, maxCrowdControlDuration, canCastComboSkill } from './skill-evaluation'

const SCENERY_FOG_PALETTE = { warm: colorToRgb(16771519), cold: colorToRgb(13954293), steam: colorToRgb(16773590), violet: colorToRgb(ARENA_PALETTE.env.violet) },
  ENGAGE_SCRATCH_POSITION = new Vector3(),
  ENGAGE_SCRATCH_NORMAL = new Vector3(),
  ENGAGE_SCRATCH_MATRIX = new Matrix3(),
  LANE_DECOR_MARGIN = 0.1,
  LANE_DECOR_WIDTH_SCALE = 0.28,
  LANE_DECOR_COLOR_A = colorToRgb(12169376),
  LANE_DECOR_COLOR_B = colorToRgb(12891799),
  LANE_DECOR_COLOR_C = colorToRgb(8682868),
  LANE_DECOR_COLOR_D = colorToRgb(7180120)

function runHeroEngage(hero, unit) {
  const selfPlayer = hero.me,
    dist2Result = dist2(selfPlayer.pos, unit.pos),
    targetHpFraction = unit.hp / unit.stats.maxHp
  switch (hero.heroId) {
    case "panyue": {
      if (canCastComboSkill(hero, "ult") && dist2Result <= 13 && dist2Result > 3) {
        const panyueUltSpec = HERO_ACTION_SPECS.panyue.ult,
          findBestAoeAimPointResult = findBestAoeAimPoint(hero, unit, panyueUltSpec.aoeRadius, 9.5, panyueUltSpec.delay, scratchPoint)
        if ((findBestAoeAimPointResult >= 2 || (findBestAoeAimPointResult >= 1 && (targetHpFraction < 0.6 || hero.fightAdv >= 1.5 || hero.friendsNear >= 1))) && (hero.diving || hero.v.enemyStructureCovering(scratchPoint, 0) === null)) return (castAtWithScatter(hero, "ult", scratchPoint), !0)
      }
      return canCastComboSkill(hero, "s1") && dist2Result <= 9.6 && maxCrowdControlDuration(unit) < 0.35
        ? (predictLeadAimPoint(hero, unit, 0, getScaledSkillValue(hero, "s1", "dashSpeed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0)
        : canCastComboSkill(hero, "s2") && (dist2Result <= 4.3 + unit.radius || (hero.hpR < 0.55 && hero.heroesOnMe > 0))
          ? (hero.act.castSelf("s2"), !0)
          : !1
    }
    case "chijin": {
      const hasBuffByIdResult = hasBuffById(selfPlayer, "chijin_ember"),
        isTargetInAttackRange = dist2Result <= selfPlayer.stats.attackRange + unit.radius + 0.4,
        shouldPrioritizeBasicAttack = hasBuffByIdResult && isTargetInAttackRange && hero.v.attackCooldown() < 0.35 && !hasBuffById(selfPlayer, "chijin_spin")
      if (canCastComboSkill(hero, "s2") && dist2Result > 3.2 && dist2Result <= 8.2) {
        predictLeadAimPoint(hero, unit, 0, getScaledSkillValue(hero, "s2", "dashSpeed"), scratchPoint)
        const leadAimOffsetX = scratchPoint.x - selfPlayer.pos.x,
          leadAimOffsetY = scratchPoint.y - selfPlayer.pos.y,
          distance = Math.hypot(leadAimOffsetX, leadAimOffsetY) || 1
        if (canCastAlongLine(hero, leadAimOffsetX / distance, leadAimOffsetY / distance, Math.min(5.5, distance))) return (castDirectionWithError(hero, "s2", scratchPoint), !0)
      }
      if (shouldPrioritizeBasicAttack) return !1
      if (canCastComboSkill(hero, "ult") && dist2Result <= 4.4) {
        let nearbyFoeCount = 0
        for (const foeUnit of hero.foes) dist2(selfPlayer.pos, foeUnit.pos) <= 4.2 + foeUnit.radius && nearbyFoeCount++
        if (nearbyFoeCount >= 2 || targetHpFraction < 0.7 || hero.fightAdv >= 1.4 || hero.hpR < 0.5) return (hero.act.castSelf("ult"), !0)
      }
      if (canCastComboSkill(hero, "s1") && dist2Result <= 5.4) return (predictLeadAimPoint(hero, unit, 0.1, 0, scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0)
      if (canCastComboSkill(hero, "s2") && isTargetInAttackRange && !hasBuffByIdResult && targetHpFraction > 0.25 && hero.me.skills.s1.cd > 1.5) {
        const targetOffsetX = unit.pos.x - selfPlayer.pos.x,
          targetOffsetY = unit.pos.y - selfPlayer.pos.y,
          targetDistance = Math.hypot(targetOffsetX, targetOffsetY) || 1
        if (canCastAlongLine(hero, targetOffsetX / targetDistance, targetOffsetY / targetDistance, 5.5)) return (hero.act.castDir("s2", targetOffsetX / targetDistance, targetOffsetY / targetDistance), !0)
      }
      return !1
    }
    case "xingli": {
      const maxCrowdControlDurationResult = maxCrowdControlDuration(unit)
      if (canCastComboSkill(hero, "s2") && dist2Result <= 12) {
        const xingliS2Spec = HERO_ACTION_SPECS.xingli.s2
        if (dist2Result < 4.5 && unit.stats.attackRange < 4) return ((scratchPoint.x = (selfPlayer.pos.x + unit.pos.x) * 0.5), (scratchPoint.y = (selfPlayer.pos.y + unit.pos.y) * 0.5), castAtWithScatter(hero, "s2", scratchPoint), !0)
        if ((findBestAoeAimPoint(hero, unit, xingliS2Spec.aoeRadius, 9, xingliS2Spec.delay, scratchPoint), Math.hypot(scratchPoint.x - selfPlayer.pos.x, scratchPoint.y - selfPlayer.pos.y) <= 9 + xingliS2Spec.aoeRadius * 0.5)) return (castAtWithScatter(hero, "s2", scratchPoint), !0)
      }
      if (canCastComboSkill(hero, "ult") && dist2Result <= 15) {
        const xingliUltSpec = HERO_ACTION_SPECS.xingli.ult,
          aoeFoesHitCount = findBestAoeAimPoint(hero, unit, xingliUltSpec.aoeRadius, 11, xingliUltSpec.delay + 0.3, scratchPoint)
        if (aoeFoesHitCount >= 2 || (aoeFoesHitCount >= 1 && (maxCrowdControlDurationResult > 0.2 || isTargetSlowed(unit) || targetHpFraction < 0.6 || hero.fightAdv >= 1.4))) return (castAtWithScatter(hero, "ult", scratchPoint), !0)
      }
      return canCastComboSkill(hero, "s1") && dist2Result <= 12.2 ? (predictLeadAimPoint(hero, unit, 0.08, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    }
    case "fengling": {
      if (canCastComboSkill(hero, "s2", !0) && hero.nearFoe && hero.nearFoeD < 3.4 && hero.nearFoe.stats.attackRange < 4 && castAlongClearLine(hero, "s2", selfPlayer.pos.x - hero.nearFoe.pos.x, selfPlayer.pos.y - hero.nearFoe.pos.y, 5)) return !0
      if (canCastComboSkill(hero, "s1") && dist2Result <= 13.2) return (predictLeadAimPoint(hero, unit, 0.12, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0)
      if (canCastComboSkill(hero, "ult") && dist2Result <= 15) {
        const fenglingUltSpec = HERO_ACTION_SPECS.fengling.ult,
          ultFoesHitCount = findBestAoeAimPoint(hero, unit, fenglingUltSpec.aoeRadius, 11.5, fenglingUltSpec.delay + 0.3, scratchPoint)
        if (ultFoesHitCount >= 2 || (ultFoesHitCount >= 1 && (isTargetSlowed(unit) || maxCrowdControlDuration(unit) > 0.2 || targetHpFraction < 0.55 || hero.fightAdv >= 1.4))) return (castAtWithScatter(hero, "ult", scratchPoint), !0)
      }
      const attackReach = selfPlayer.stats.attackRange + unit.radius
      if (canCastComboSkill(hero, "s2") && dist2Result > attackReach + 0.5 && dist2Result < attackReach + 5 && targetHpFraction < 0.3 && hero.fightAdv >= 1.2) {
        const targetDirX = unit.pos.x - selfPlayer.pos.x,
          targetDirY = unit.pos.y - selfPlayer.pos.y,
          foeDistance = Math.hypot(targetDirX, targetDirY) || 1
        if (canCastAlongLine(hero, targetDirX / foeDistance, targetDirY / foeDistance, 5)) return (hero.act.castDir("s2", targetDirX / foeDistance, targetDirY / foeDistance), !0)
      }
      return !1
    }
    case "yeque": {
      if (canCastComboSkill(hero, "ult") && dist2Result <= 8.4 && unit.alive) {
        const computeSkillDamageResult = computeSkillDamage(selfPlayer, "ult", unit),
          targetEffectiveHp = unit.hp + unit.shield
        if (computeSkillDamageResult >= targetEffectiveHp * 0.9 || (targetHpFraction < 0.45 && computeSkillDamageResult >= targetEffectiveHp * 0.6 && selfPlayer.skills.s1.cd > 0.5)) return (hero.act.castTarget("ult", unit.id), !0)
      }
      if (canCastComboSkill(hero, "s2") && dist2Result <= 8.4 && (predictLeadAimPoint(hero, unit, 0.06, getScaledSkillValue(hero, "s2", "speed"), scratchPoint), dist2Result < 4.2 || !isLineBlockedByMinions(hero, scratchPoint, 0.5))) return (castDirectionWithError(hero, "s2", scratchPoint), !0)
      if (canCastComboSkill(hero, "s1") && dist2Result <= 7.6 && dist2Result > 1.2) {
        predictLeadAimPoint(hero, unit, 0, getScaledSkillValue(hero, "s1", "dashSpeed"), scratchPoint)
        const predictedAimOffsetX = scratchPoint.x - selfPlayer.pos.x,
          predictedAimOffsetY = scratchPoint.y - selfPlayer.pos.y,
          predictedAimDistance = Math.hypot(predictedAimOffsetX, predictedAimOffsetY) || 1
        if (canCastAlongLine(hero, predictedAimOffsetX / predictedAimDistance, predictedAimOffsetY / predictedAimDistance, Math.min(6.5, predictedAimDistance + 1))) return (castDirectionWithError(hero, "s1", scratchPoint), !0)
      }
      return !1
    }
    default: {
      // ── 通用 AI 兜底：没有专属 case 的英雄（如外部新增的）也不会站着不动 ──
      try {
        const selectedHERO_ACTION_SPECS = HERO_ACTION_SPECS[hero.heroId]
        if (!selectedHERO_ACTION_SPECS) return !1
        if (canCastComboSkill(hero, "s2") && selectedHERO_ACTION_SPECS.s2 && (hero.hpR < 0.55 || dist2Result <= 6)) {
          hero.act.castSelf("s2")
          return !0
        }
        if (canCastComboSkill(hero, "ult") && selectedHERO_ACTION_SPECS.ult && dist2Result <= 10 && (targetHpFraction < 0.7 || hero.fightAdv >= 1.2)) {
          castAtWithScatter(hero, "ult", scratchPoint)
          return !0
        }
        if (canCastComboSkill(hero, "s1") && selectedHERO_ACTION_SPECS.s1 && dist2Result <= 8.6) {
          const fallbackTargetOffsetX = unit.pos.x - selfPlayer.pos.x,
            fallbackTargetOffsetY = unit.pos.y - selfPlayer.pos.y,
            fallbackTargetDistance = Math.hypot(fallbackTargetOffsetX, fallbackTargetOffsetY) || 1,
            ScaledSkillValueValue = getScaledSkillValue(hero, "s1", "dashSpeed")
          const s1CastType = selectedHERO_ACTION_SPECS.s1.cast && selectedHERO_ACTION_SPECS.s1.cast.type
          if (ScaledSkillValueValue) predictLeadAimPoint(hero, unit, 0, ScaledSkillValueValue, scratchPoint)
          if (s1CastType === "self") { hero.act.castSelf("s1"); return !0 }
          if (s1CastType === "position") { castAtWithScatter(hero, "s1", scratchPoint); return !0 }
          if (canCastAlongLine(hero, fallbackTargetOffsetX / fallbackTargetDistance, fallbackTargetOffsetY / fallbackTargetDistance, Math.min(7, fallbackTargetDistance + 1))) { castDirectionWithError(hero, "s1", scratchPoint); return !0 }
        }
      } catch (engageError) {
        console.warn("[starfall] generic AI fallback failed:", engageError)
      }
      return !1
    }
  }
}

function castAlongClearLine(hero, skillId, directionX, directionY, castRange) {
  const targetAngle = Math.atan2(directionY, directionX)
  for (const angleOffset of [0, 0.5, -0.5, 1, -1]) {
    const castAngle = targetAngle + angleOffset,
      castDirX = Math.cos(castAngle),
      castDirY = Math.sin(castAngle)
    if (((scratchPoint.x = hero.me.pos.x + castDirX * castRange), (scratchPoint.y = hero.me.pos.y + castDirY * castRange), !!hero.v.lineClear(hero.me.pos, scratchPoint) && hero.v.enemyStructureCovering(scratchPoint, 0) === null)) return (hero.act.castDir(skillId, castDirX, castDirY), !0)
  }
  return !1
}

export { castAlongClearLine, LANE_DECOR_COLOR_A, LANE_DECOR_MARGIN, ENGAGE_SCRATCH_MATRIX, LANE_DECOR_COLOR_D, LANE_DECOR_WIDTH_SCALE, ENGAGE_SCRATCH_POSITION, LANE_DECOR_COLOR_B, LANE_DECOR_COLOR_C, runHeroEngage, ENGAGE_SCRATCH_NORMAL, SCENERY_FOG_PALETTE }