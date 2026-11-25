/**
 * 英雄代理决策
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { castDirectionWithError, AREA_THREAT_KIND_BY_VISUAL, castAtWithScatter, canCastAlongLine, isTargetSlowed, computeClusterCenter, HERO_ACTION_SPECS, getScaledSkillValue, countTargetsInBand, computeSkillDamage, computeBasicAttackDamage, estimateAttackDps, UnitCommander, clampToRange, predictLeadAimPoint, allyProximityFactor, isLineBlockedByMinions, canHitTarget, chooseCastableSkill, dist2, effectiveHp, estimateFightHorizon, estimateSkillDamage, estimateTimeToKill, expectedDps, foeProximityFactor, scratchPoint, maxCrowdControlDuration, canCastComboSkill, availableManaFraction } from './skill-evaluation'
import { AI_TUNING, HERO_AI_PERSONALITY } from '../ai-tactics'
import { castAlongClearLine, runHeroEngage } from './hero-engage'
import { HERO_TABLE } from '../../heroes/registry'
import { MONSTER_STATS, TOWER_RULES } from '../game-balance'
import { getNextBuildItem, getEffectiveItemCost, MIN_ITEM_COST } from '../ui/shop-panel'
import { TeamAi } from './team-ai'
import { AI_DIFFICULTY_PRESETS } from '../ai-difficulty'
import { __heroRow } from '../ui/banner'

/**
 * 判断目标。
 *
 * @param hero - 英雄
 * @param target - 次要输入
 */
function canKillTarget(hero, target) {
  const selfPlayer = hero.me,
    dist2Result = dist2(selfPlayer.pos, target.pos),
    effectiveHpThreshold = (target.hp + target.shield) * 1.08,
    canKillWithSkill = (river, hitCount?) => canCastComboSkill(hero, river) && computeSkillDamage(selfPlayer, river, target, hitCount) >= effectiveHpThreshold
  switch (hero.heroId) {
    case "panyue":
      if (dist2Result <= 9.4 && canKillWithSkill("s1")) {
        predictLeadAimPoint(hero, target, 0, getScaledSkillValue(hero, "s1", "dashSpeed"), scratchPoint)
        const distance = Math.hypot(scratchPoint.x - selfPlayer.pos.x, scratchPoint.y - selfPlayer.pos.y) || 1
        if (canCastAlongLine(hero, (scratchPoint.x - selfPlayer.pos.x) / distance, (scratchPoint.y - selfPlayer.pos.y) / distance, Math.min(7.5, distance))) return (castDirectionWithError(hero, "s1", scratchPoint), !0)
      }
      return !1
    case "chijin":
      if (dist2Result <= 5.3 && canKillWithSkill("s1")) return (predictLeadAimPoint(hero, target, 0.1, 0, scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0)
      if (dist2Result <= 6.3 && canKillWithSkill("s2")) {
        predictLeadAimPoint(hero, target, 0, getScaledSkillValue(hero, "s2", "dashSpeed"), scratchPoint)
        const aimDistance = Math.hypot(scratchPoint.x - selfPlayer.pos.x, scratchPoint.y - selfPlayer.pos.y) || 1
        if (canCastAlongLine(hero, (scratchPoint.x - selfPlayer.pos.x) / aimDistance, (scratchPoint.y - selfPlayer.pos.y) / aimDistance, 5.5)) return (castDirectionWithError(hero, "s2", scratchPoint), !0)
      }
      return !1
    case "xingli":
      return dist2Result <= 12.2 && canKillWithSkill("s1") ? (predictLeadAimPoint(hero, target, 0.08, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    case "fengling":
      return dist2Result <= 13.6 && canKillWithSkill("s1") ? (predictLeadAimPoint(hero, target, 0.12, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    case "yeque":
      return dist2Result <= 8.4 && canKillWithSkill("s2", 1) && (predictLeadAimPoint(hero, target, 0.06, getScaledSkillValue(hero, "s2", "speed"), scratchPoint), !isLineBlockedByMinions(hero, scratchPoint, 0.5))
        ? (castDirectionWithError(hero, "s2", scratchPoint), !0)
        : dist2Result <= 8.3 && canKillWithSkill("ult") && (hero.diving || hero.v.enemyStructureCovering(target.pos, 0.5) === null) && hero.advantageAt(target.pos.x, target.pos.y) >= 0.8
          ? (hero.act.castTarget("ult", target.id), !0)
          : !1
  }
}

function tryPoke(hero, target) {
  const meValue = hero.me,
    dist2Dist2Result = dist2(meValue.pos, target.pos)
  switch (hero.heroId) {
    case "panyue":
      return canCastComboSkill(hero, "s2") && dist2Dist2Result <= 4 + target.radius && availableManaFraction(hero, "s2") >= AI_TUNING.pokeMana ? (hero.act.castSelf("s2"), !0) : !1
    case "chijin":
      return canCastComboSkill(hero, "s1") && dist2Dist2Result <= 5.2 && availableManaFraction(hero, "s1") >= AI_TUNING.pokeMana ? (predictLeadAimPoint(hero, target, 0.1, 0, scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    case "xingli":
      return canCastComboSkill(hero, "s1") && dist2Dist2Result <= 11.6 && availableManaFraction(hero, "s1") >= AI_TUNING.pokeMana
        ? (predictLeadAimPoint(hero, target, 0.08, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0)
        : canCastComboSkill(hero, "s2") && dist2Dist2Result <= 9 && availableManaFraction(hero, "s2") >= 0.5 && (isTargetSlowed(target) || maxCrowdControlDuration(target) > 0.2)
          ? (predictLeadAimPoint(hero, target, HERO_ACTION_SPECS.xingli.s2.delay, 0, scratchPoint), castAtWithScatter(hero, "s2", scratchPoint), !0)
          : !1
    case "fengling":
      return canCastComboSkill(hero, "s1") && dist2Dist2Result <= 12.8 && availableManaFraction(hero, "s1") >= AI_TUNING.pokeMana ? (predictLeadAimPoint(hero, target, 0.12, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    case "yeque":
      return canCastComboSkill(hero, "s2") && dist2Dist2Result <= 8 && availableManaFraction(hero, "s2") >= AI_TUNING.pokeMana && (predictLeadAimPoint(hero, target, 0.06, getScaledSkillValue(hero, "s2", "speed"), scratchPoint), !isLineBlockedByMinions(hero, scratchPoint, 0.5)) ? (castDirectionWithError(hero, "s2", scratchPoint), !0) : !1
  }
}

function tryWaveclear(hero, foeMinions, isJungleCamp) {
  if (foeMinions.length === 0) return !1
  const selfPlayer = hero.me,
    manaThreshold = isJungleCamp ? AI_TUNING.jungleMana : AI_TUNING.waveclearMana,
    minTargetsForClear = isJungleCamp ? 1 : 3,
    canCastWithMana = (detail) => canCastComboSkill(hero, detail) && availableManaFraction(hero, detail) >= manaThreshold,
    selectedT = foeMinions[0]
  switch (hero.heroId) {
    case "panyue": {
      if (!canCastWithMana("s2")) return !1
      let minionCount = 0
      for (const foeMinion of foeMinions) dist2(selfPlayer.pos, foeMinion.pos) <= 4.5 + foeMinion.radius && minionCount++
      return minionCount >= minTargetsForClear + (isJungleCamp ? 0 : 1) ? (hero.act.castSelf("s2"), !0) : !1
    }
    case "chijin":
      return canCastWithMana("s1") && computeClusterCenter(foeMinions, 4, scratchPoint) >= minTargetsForClear && dist2(selfPlayer.pos, scratchPoint) <= 4.5 ? (hero.act.castDir("s1", scratchPoint.x - selfPlayer.pos.x, scratchPoint.y - selfPlayer.pos.y), !0) : !1
    case "xingli": {
      if (canCastWithMana("s1")) {
        computeClusterCenter(foeMinions, 4, scratchPoint)
        const xingliAimX = scratchPoint.x - selfPlayer.pos.x,
          xingliAimY = scratchPoint.y - selfPlayer.pos.y
        if (Math.hypot(xingliAimX, xingliAimY) <= 11 && countTargetsInBand(hero, foeMinions, xingliAimX, xingliAimY, 12, 0.65) >= minTargetsForClear) return (hero.act.castDir("s1", xingliAimX, xingliAimY), !0)
      }
      return canCastComboSkill(hero, "s2") && availableManaFraction(hero, "s2") >= manaThreshold + 0.1 && computeClusterCenter(foeMinions, 3.4, scratchPoint) >= minTargetsForClear + 1 && dist2(selfPlayer.pos, scratchPoint) <= 9 ? (hero.act.castAt("s2", scratchPoint), !0) : !1
    }
    case "fengling": {
      if (!canCastWithMana("s1")) return !1
      computeClusterCenter(foeMinions, 4, scratchPoint)
      const fenglingAimX = scratchPoint.x - selfPlayer.pos.x,
        fenglingAimY = scratchPoint.y - selfPlayer.pos.y
      return Math.hypot(fenglingAimX, fenglingAimY) <= 12 && countTargetsInBand(hero, foeMinions, fenglingAimX, fenglingAimY, 14, 0.65) >= minTargetsForClear ? (hero.act.castDir("s1", fenglingAimX, fenglingAimY), !0) : !1
    }
    case "yeque": {
      if (canCastWithMana("s2") && dist2(selfPlayer.pos, selectedT.pos) <= 3.6 + selectedT.radius) return (hero.act.castDir("s2", selectedT.pos.x - selfPlayer.pos.x, selectedT.pos.y - selfPlayer.pos.y), !0)
      if (canCastWithMana("s1")) {
        computeClusterCenter(foeMinions, 4, scratchPoint)
        const yequeAimX = scratchPoint.x - selfPlayer.pos.x,
          yequeAimY = scratchPoint.y - selfPlayer.pos.y,
          distance = Math.hypot(yequeAimX, yequeAimY)
        if (distance > 0.8 && distance <= 6 && countTargetsInBand(hero, foeMinions, yequeAimX, yequeAimY, 6.5, 1) >= minTargetsForClear && canCastAlongLine(hero, yequeAimX / distance, yequeAimY / distance, 6.5)) return (hero.act.castDir("s1", yequeAimX, yequeAimY), !0)
      }
      return !1
    }
  }
}

/**
 * 处理英雄。
 *
 * @param hero - 英雄
 * @param directionX - 次要输入
 * @param directionY - 第三输入
 * @returns 数值结果
 */
function runHeroCombatAction(hero, directionX, directionY) {
  const nearFoe = hero.nearFoe,
    hasNearbyFoe = nearFoe !== null && hero.nearFoeD < 7
  switch (hero.heroId) {
    case "panyue":
      if (hasNearbyFoe && canCastComboSkill(hero, "s2", !0) && hero.nearFoeD < 4.5) return (hero.act.castSelf("s2"), !0)
      if (canCastComboSkill(hero, "s1", !0) && castAlongClearLine(hero, "s1", directionX, directionY, 7.5)) return !0
      if (hero.hpR < 0.25 && canCastComboSkill(hero, "ult", !0)) {
        const distance = Math.hypot(directionX, directionY) || 1
        ;((scratchPoint.x = hero.me.pos.x + (directionX / distance) * 9.5), (scratchPoint.y = hero.me.pos.y + (directionY / distance) * 9.5))
        const nearestWalkableResult = hero.v.nearestWalkable(scratchPoint)
        if (hero.v.enemyStructureCovering(nearestWalkableResult, 0) === null) return (hero.act.castAt("ult", nearestWalkableResult), !0)
      }
      return !1
    case "chijin":
      return canCastComboSkill(hero, "s2", !0) && castAlongClearLine(hero, "s2", directionX, directionY, 5.5)
    case "xingli":
      return hasNearbyFoe && nearFoe && canCastComboSkill(hero, "s2", !0) ? ((scratchPoint.x = nearFoe.pos.x + (hero.me.pos.x - nearFoe.pos.x) * 0.3), (scratchPoint.y = nearFoe.pos.y + (hero.me.pos.y - nearFoe.pos.y) * 0.3), hero.act.castAt("s2", scratchPoint), !0) : !1
    case "fengling":
      return canCastComboSkill(hero, "s2", !0) && castAlongClearLine(hero, "s2", directionX, directionY, 5) ? !0 : hasNearbyFoe && nearFoe && canCastComboSkill(hero, "s1", !0) && hero.hpR > 0.2 ? (predictLeadAimPoint(hero, nearFoe, 0.12, getScaledSkillValue(hero, "s1", "speed"), scratchPoint), castDirectionWithError(hero, "s1", scratchPoint), !0) : !1
    case "yeque":
      return canCastComboSkill(hero, "s1", !0) && castAlongClearLine(hero, "s1", directionX, directionY, 6.5)
  }
}

const HERO_LANE_POINT = { x: 0, y: 0 },
  LAST_HIT_TARGETS = { kill: null, push: null, wait: null }

function findProtectedCarry(element) {
  if (!element.style.support) return null
  for (const friend of element.friends) {
    const heroRole = HERO_TABLE[friend.heroId].role
    if ((heroRole === "marksman" || heroRole === "mage") && dist2(friend.pos, element.me.pos) < 13) return friend
  }
  return null
}

/**
 * 处理目标与碰撞。
 *
 * @param hero - 英雄
 * @param protectedCarry - 次要输入
 * @param hasMinionDisadvantage - 第三输入
 */
function decideLastHitTarget(hero, protectedCarry, hasMinionDisadvantage) {
  if (((LAST_HIT_TARGETS.kill = null), (LAST_HIT_TARGETS.push = null), (LAST_HIT_TARGETS.wait = null), hero.foeMinions.length === 0)) return LAST_HIT_TARGETS
  const selfPlayer = hero.me,
    view = hero.v,
    basicAttack = HERO_TABLE[hero.heroId].basicAttack,
    attackRange = selfPlayer.stats.attackRange,
    attackInterval = 1 / Math.max(0.1, selfPlayer.stats.attackSpeed),
    attackWindupTime = Math.min(attackInterval, 0.7) * basicAttack.windup,
    projectileSpeed = basicAttack.projectileSpeed ?? 0,
    attackCooldownResult = view.attackCooldown(),
    effectiveMoveSpeed = Math.max(1, selfPlayer.stats.moveSpeed),
    maxSafeDistance = hero.ranged ? 4.5 : 6,
    myTower = hero.myStruct
  let lowestKillableHp = 1 / 0,
    lowestHpForPush = 1 / 0,
    bestWaitScore = 1 / 0
  for (const foeMinion of hero.foeMinions) {
    const distanceToMinion = dist2(selfPlayer.pos, foeMinion.pos) - foeMinion.radius,
      distanceBeyondRange = Math.max(0, distanceToMinion - attackRange)
    if (distanceBeyondRange > maxSafeDistance || !hero.safeToHit(foeMinion) || !hero.safeFromFoes(foeMinion) || (hasMinionDisadvantage && foeMinion.targetId !== selfPlayer.id && !(myTower && foeMinion.targetId === myTower.id))) continue
    const armorFactor = 600 / (600 + foeMinion.stats.armor),
      basicAttackDamage = selfPlayer.stats.ad * armorFactor
    let total = 0
    for (const myMinion of hero.myMinions) myMinion.targetId === foeMinion.id && (total += myMinion.stats.ad * myMinion.stats.attackSpeed * armorFactor)
    myTower && myTower.targetId === foeMinion.id && (total += myTower.stats.ad * TOWER_RULES.minionMult * myTower.stats.attackSpeed * armorFactor)
    const timeToReach = distanceBeyondRange / effectiveMoveSpeed + attackWindupTime + (projectileSpeed > 0 ? Math.min(distanceToMinion, attackRange) / projectileSpeed : 0) + attackCooldownResult,
      hpAfterAllyDamage = foeMinion.hp - total * timeToReach,
      lastHitDamage = basicAttackDamage * (1 + view.rng.range(-1, 1) * hero.prof.lastHitError)
    if (hpAfterAllyDamage <= lastHitDamage) {
      if (protectedCarry && (protectedCarry.targetId === foeMinion.id || hpAfterAllyDamage > lastHitDamage * 0.4)) continue
      const hpAfterTowerShot = hpAfterAllyDamage - (foeMinion.minionType === "siege" || foeMinion.minionType === "super" ? 600 : 0)
      hpAfterTowerShot < lowestKillableHp && ((lowestKillableHp = hpAfterTowerShot), (LAST_HIT_TARGETS.kill = foeMinion))
      continue
    }
    if (total > 0) {
      const waitScore = (foeMinion.hp - basicAttackDamage) / total - timeToReach
      waitScore < attackInterval * 1.05 && waitScore < bestWaitScore && ((bestWaitScore = waitScore), (LAST_HIT_TARGETS.wait = foeMinion))
    }
    foeMinion.hp < lowestHpForPush && ((lowestHpForPush = foeMinion.hp), (LAST_HIT_TARGETS.push = foeMinion))
  }
  return (LAST_HIT_TARGETS.kill && hero.prof.lastHitSkip > 0 && view.rng.chance(hero.prof.lastHitSkip) && (LAST_HIT_TARGETS.kill = null), LAST_HIT_TARGETS)
}

function tryHarass(hero, shouldWaitToLastHit, isNonLane) {
  if (hero.foes.length === 0 || hero.adv < AI_TUNING.advPoke || hero.inFoeRange || !hero.inMood(MOOD_HARASS_INDEX, isNonLane ? Math.min(1, hero.prof.harass + AI_TUNING.groupHarass) : hero.prof.harass)) return !1
  const selfPlayer = hero.me,
    view = hero.v
  let bestHarassTarget = null,
    bestHarassScore = 1 / 0
  for (const foeUnit of hero.foes) {
    const distanceToEnemySq = dist2(selfPlayer.pos, foeUnit.pos)
    if (distanceToEnemySq > 13.5) continue
    const harassScore = foeUnit.hp / foeUnit.stats.maxHp + distanceToEnemySq * 0.03
    harassScore < bestHarassScore && ((bestHarassScore = harassScore), (bestHarassTarget = foeUnit))
  }
  if (!bestHarassTarget || (!view.busy() && tryPoke(hero, bestHarassTarget) && (hero.label = "poke"), shouldWaitToLastHit)) return !1
  const distanceToHarassTarget = dist2(selfPlayer.pos, bestHarassTarget.pos) - bestHarassTarget.radius,
    attackRange = selfPlayer.stats.attackRange,
    safeMinionThreshold = 3 + Math.floor(selfPlayer.level / 3)
  return hero.aggroMinions > safeMinionThreshold || !hero.safeToHit(bestHarassTarget) ? !1 : (hero.ranged ? distanceToHarassTarget <= attackRange + 0.8 && view.attackCooldown() <= 0.25 : distanceToHarassTarget <= attackRange + 0.3 && hero.adv >= 1) ? (hero.act.attack(bestHarassTarget.id), (hero.label = "harass"), !0) : !1
}

function trySiege(hero, laneState) {
  const foeTower = laneState.foeStruct
  return foeTower.invulnerable || hero.foeStruct !== foeTower || hero.foeStructD - foeTower.radius > hero.me.stats.attackRange + 6 || hero.tankers === 0 || hero.tankHp < 450 || hero.towerOnMe || (hero.foes.length > 0 && hero.adv < 0.95)
    ? !1
    : (hero.act.attack(foeTower.id), (hero.label = "siege"), !0)
}

function hasGroupForPush(hero, lane) {
  const brain = hero.brain
  if (brain.aliveFoes <= 1) return !0
  const minPushGroupSize = Math.min(AI_TUNING.groupMin, brain.pushers(hero.v, lane))
  return hero.friendsNear + 1 >= minPushGroupSize
}

function decideLaneMovement(element, lane, laneKind) {
  const selfPlayer = element.me,
    geometry = element.geo,
    team = element.team,
    selectedLanes = element.brain.lanes[lane],
    attackRange = selfPlayer.stats.attackRange,
    foeTower = selectedLanes.foeStruct,
    towerAttackRange = foeTower.stats.attackRange,
    laneLength = geometry.total(lane),
    progResult = geometry.prog(team, lane, selfPlayer.pos.x, selfPlayer.pos.y),
    protectedCarry = laneKind === "lane" ? findProtectedCarry(element) : null,
    engageBuffer = element.ranged ? Math.max(2.5, attackRange - 2.2) : element.style.support ? 1.6 : 1,
    allyFront = selectedLanes.allyFront >= selectedLanes.ownP - 6 ? selectedLanes.allyFront : -1,
    enemyFront = selectedLanes.enemyFront,
    clampToRangeResult = clampToRange(progResult, selectedLanes.ownP + 2.5, Math.max(selectedLanes.ownP + 2.5, laneLength * 0.5 - 4))
  let targetLaneProgress
  laneKind === "defend"
    ? ((targetLaneProgress = selectedLanes.ownP - 1.5),
      enemyFront >= 0 && enemyFront < selectedLanes.ownP + 9 && (targetLaneProgress = Math.min(enemyFront - engageBuffer, selectedLanes.ownP + 3)),
      selectedLanes.threatHeroes >= 3 && element.friendsNear + 1 < Math.min(selectedLanes.threatHeroes - 1, element.brain.aliveAllies) && (targetLaneProgress = Math.min(targetLaneProgress, Math.max(0, selectedLanes.ownP - AI_TUNING.regroupBack))))
    : allyFront >= 0
      ? ((targetLaneProgress = (enemyFront >= 0 && Math.abs(enemyFront - allyFront) < 12 ? (allyFront + enemyFront) * 0.5 : allyFront + 0.5) - engageBuffer), targetLaneProgress < progResult - 3 && (enemyFront < 0 || enemyFront - progResult > 10) && (targetLaneProgress = Math.max(targetLaneProgress, Math.min(progResult, clampToRangeResult))))
      : enemyFront >= 0
        ? (targetLaneProgress = Math.min(enemyFront - engageBuffer - 1.5, clampToRangeResult))
        : (targetLaneProgress = clampToRangeResult)
  const respectZone = element.respect,
    isAloneUnderTower = element.myMinions.length === 0 && element.foeMinions.length >= 3
  if ((isAloneUnderTower && enemyFront >= 0 && (targetLaneProgress = Math.min(targetLaneProgress, enemyFront > selectedLanes.ownP + 7 ? enemyFront - AI_TUNING.minionAggro - 1.5 : selectedLanes.ownP - 3)), element.adv < 1.15 || element.poker))
    for (const foeHero of element.foes) {
      const foeHeroProgress = geometry.prog(team, lane, foeHero.pos.x, foeHero.pos.y)
      if (geometry.lateral > 9 || foeHeroProgress < progResult - 2) continue
      let threatBuffer = element.respect ? element.threatReach(foeHero) + 1 : foeHero.stats.attackRange + foeHero.radius + selfPlayer.radius + 0.8
      if (foeHero === element.poker) threatBuffer = Math.max(threatBuffer, foeHero.stats.attackRange + foeHero.radius + selfPlayer.radius + 2.5)
      else if (element.adv >= 1.15) continue
      targetLaneProgress > foeHeroProgress - threatBuffer && (targetLaneProgress = foeHeroProgress - threatBuffer)
    }
  ;(laneKind === "lane" && element.prof.harass < 0.3 && (targetLaneProgress = Math.min(targetLaneProgress, laneLength * 0.5 + 3)),
    laneKind === "push" && targetLaneProgress > selectedLanes.foeP - towerAttackRange - 9 && !hasGroupForPush(element, lane) && (targetLaneProgress = selectedLanes.foeP - towerAttackRange - 9),
    (element.foeStruct === foeTower ? element.tankers > 0 && element.tankHp > 450 && !element.towerOnMe : selectedLanes.atFoeStruct) || (targetLaneProgress = Math.min(targetLaneProgress, selectedLanes.foeP - (towerAttackRange + AI_TUNING.towerMargin + 0.8))),
    (targetLaneProgress = Math.max(targetLaneProgress, selectedLanes.ownP - 4)),
    element.anchorLane === lane && Math.abs(targetLaneProgress - element.anchorP) < 6 && (targetLaneProgress = element.anchorP + (targetLaneProgress - element.anchorP) * 0.35),
    (element.anchorLane = lane),
    (element.anchorP = targetLaneProgress),
    geometry.point(team, lane, targetLaneProgress, HERO_LANE_POINT, element.side))
  const distanceToLanePoint = dist2(selfPlayer.pos, HERO_LANE_POINT)
  if (distanceToLanePoint > 17) {
    if (laneKind === "defend" && distanceToLanePoint > 60 && dist2(element.home, HERO_LANE_POINT) < distanceToLanePoint - 35 && element.recallNow()) {
      element.label = "defend:recall"
      return
    }
    ;(element.travel(HERO_LANE_POINT.x, HERO_LANE_POINT.y), (element.label = `${laneKind}:go`))
    return
  }
  const hasProtectedCarry = protectedCarry !== null,
    canPush = laneKind !== "lane" || selectedLanes.foeHeroes === 0 || element.adv >= 1.3 || selectedLanes.threatMinions > 0,
    decideLastHitTargetResult = decideLastHitTarget(element, protectedCarry, isAloneUnderTower)
  if (decideLastHitTargetResult.kill) {
    ;(element.act.attack(decideLastHitTargetResult.kill.id), (element.label = `${laneKind}:lasthit`))
    return
  }
  const shouldWaitToLastHit = decideLastHitTargetResult.wait !== null && !canPush
  if (!tryHarass(element, shouldWaitToLastHit, laneKind !== "lane") && !trySiege(element, selectedLanes)) {
    if ((canPush && !hasProtectedCarry && !element.v.busy() && element.foeMinions.length >= 3 && tryWaveclear(element, element.foeMinions, !1), decideLastHitTargetResult.push && !hasProtectedCarry && !respectZone && !shouldWaitToLastHit)) {
      ;(element.act.attack(decideLastHitTargetResult.push.id), (element.label = `${laneKind}:push`))
      return
    }
    if (shouldWaitToLastHit && decideLastHitTargetResult.wait) {
      const waitTarget = decideLastHitTargetResult.wait
      ;(dist2(selfPlayer.pos, waitTarget.pos) - waitTarget.radius > attackRange - 0.3 ? element.act.moveTo(waitTarget.pos.x, waitTarget.pos.y) : element.act.halt(), (element.label = `${laneKind}:wait`))
      return
    }
    ;(distanceToLanePoint > 1.5 ? element.act.moveTo(HERO_LANE_POINT.x, HERO_LANE_POINT.y) : element.act.halt(), (element.label = respectZone ? `${laneKind}:zoned` : isAloneUnderTower ? `${laneKind}:wait-wave` : `${laneKind}:hold`))
  }
}

const CAMP_RESPAWN_LOOKAHEAD = 6,
  CAMP_MONSTER_BUFFER = [],
  GANK_INTERCEPT_POINT = { x: 0, y: 0 }

function hasStatusBuff(unit, buffId) {
  for (let index = 0; index < unit.buffs.length; index++) if (unit.buffs[index].id === buffId) return !0
  return !1
}

/**
 * 处理怪物。
 *
 * @param world - 主要输入
 * @param campId - 输入
 */
function listCampMonsters(world, campId) {
  CAMP_MONSTER_BUFFER.length = 0
  for (const monster of world.v.monsters()) monster.campId === campId && CAMP_MONSTER_BUFFER.push(monster)
  return (CAMP_MONSTER_BUFFER.sort((firstMonster, secondMonster) => firstMonster.hp - secondMonster.hp), CAMP_MONSTER_BUFFER)
}

function chooseJungleCamp(world) {
  const view = world.v,
    selfPlayer = world.me,
    campLayouts = view.map.camps,
    campStates = view.state.camps
  if ((world.campId >= 0 && campStates[world.campId].alive) || (world.campId >= 0 && campLayouts[world.campId].side === world.team && campStates[world.campId].respawnIn <= CAMP_RESPAWN_LOOKAHEAD)) return campLayouts[world.campId]
  let bestCamp = null,
    bestCampScore = 1 / 0
  const moveSpeed = Math.max(1, selfPlayer.stats.moveSpeed)
  for (const camp of campLayouts) {
    if (camp.side !== world.team || MONSTER_STATS[camp.monsterType].epic) continue
    const distanceToCamp = dist2(selfPlayer.pos, camp.pos),
      selectedI = campStates[camp.id],
      respawnWait = selectedI.alive ? 0 : Math.max(0, selectedI.respawnIn - distanceToCamp / moveSpeed)
    if (respawnWait > CAMP_RESPAWN_LOOKAHEAD && world.time > 30) continue
    let campCost = distanceToCamp + respawnWait * moveSpeed
    ;(camp.monsterType === "frost_golem" && !hasStatusBuff(selfPlayer, "frost_insight") && (campCost -= 10), camp.monsterType === "ember_golem" && !hasStatusBuff(selfPlayer, "ember_might") && (campCost -= 12), campCost < bestCampScore && ((bestCampScore = campCost), (bestCamp = camp)))
  }
  return ((world.campId = bestCamp ? bestCamp.id : -1), bestCamp)
}

/**
 * 查找目标。
 *
 * @param world - 战场
 */
function findGankTarget(world) {
  const selfPlayer = world.me,
    view = world.v
  if (world.time < world.nextGankAt || selfPlayer.level < 2 || world.hpR < 0.6 || world.manaR < 0.3) return null
  let result = null,
    bestGankScore = 0
  for (const foeHero of world.foesAll) {
    const distanceToFoe = dist2(selfPlayer.pos, foeHero.pos)
    if (distanceToFoe > 48 || view.enemyStructureCovering(foeHero.pos, 5) || world.time - (world.gankedAt.get(foeHero.id) ?? -999) < AI_TUNING.gankSameTarget) continue
    const nearestLaneResult = world.geo.nearestLane(foeHero.pos.x, foeHero.pos.y)
    if (world.time - world.gankLaneAt[nearestLaneResult] < AI_TUNING.gankSameLane) continue
    let isActive = !1
    for (const alliedHero of view.alliedHeroes()) alliedHero !== selfPlayer && alliedHero.hp > alliedHero.stats.maxHp * 0.4 && dist2(alliedHero.pos, foeHero.pos) < 14 && (isActive = !0)
    if (!isActive) continue
    const advantageAtResult = world.advantageAt(foeHero.pos.x, foeHero.pos.y)
    if (advantageAtResult < 1.25 / world.prof.aggression) continue
    const gankScore = advantageAtResult * (1.4 - foeHero.hp / foeHero.stats.maxHp) - distanceToFoe / 60
    gankScore > bestGankScore && ((bestGankScore = gankScore), (result = foeHero))
  }
  return result
}

function endGank(world, didKillTarget) {
  return ((world.gankId = -1), (world.nextGankAt = world.time + world.prof.gankCooldown * (didKillTarget ? 1 : 0.6)), !1)
}

function continueGank(world) {
  const view = world.v,
    selfPlayer = world.me,
    time = world.time,
    unitResult = view.unit(world.gankId)
  if (time - world.gankSince > 24) return endGank(world, !1)
  if (!unitResult || unitResult.kind !== "hero" || !unitResult.alive || !view.canSee(unitResult)) {
    const scoreboardResult = view.scoreboard()
    for (let index = 0; index < scoreboardResult.length; index++) if (scoreboardResult[index].id === world.gankId && !scoreboardResult[index].alive) return endGank(world, !0)
    if (time - world.gankSeenAt > 3.5) return endGank(world, !1)
    const lastSeenResult = view.lastSeen(world.gankId)
    return lastSeenResult ? (world.act.moveTo(lastSeenResult.x, lastSeenResult.y), (world.label = "gank"), !0) : endGank(world, !1)
  }
  if (((world.gankSeenAt = time), view.enemyStructureCovering(unitResult.pos, 1.5))) return endGank(world, !1)
  const distanceToTarget = dist2(selfPlayer.pos, unitResult.pos)
  if (distanceToTarget < 10) return world.advantageAt(unitResult.pos.x, unitResult.pos.y) < 1 ? endGank(world, !1) : (world.act.moveTo(unitResult.pos.x, unitResult.pos.y), (world.label = "gank"), !0)
  const foeHomeDistance = dist2(world.foeHome, unitResult.pos) || 1
  return (
    (GANK_INTERCEPT_POINT.x = unitResult.pos.x + ((world.foeHome.x - unitResult.pos.x) / foeHomeDistance) * 4),
    (GANK_INTERCEPT_POINT.y = unitResult.pos.y + ((world.foeHome.y - unitResult.pos.y) / foeHomeDistance) * 4),
    (!view.walkable(GANK_INTERCEPT_POINT) || view.enemyStructureCovering(GANK_INTERCEPT_POINT, 2) || dist2(selfPlayer.pos, GANK_INTERCEPT_POINT) > distanceToTarget + 6) && ((GANK_INTERCEPT_POINT.x = unitResult.pos.x), (GANK_INTERCEPT_POINT.y = unitResult.pos.y)),
    world.travel(GANK_INTERCEPT_POINT.x, GANK_INTERCEPT_POINT.y, 2.5),
    (world.label = "gank"),
    !0
  )
}

function decideJungleTask(world) {
  const view = world.v,
    selfPlayer = world.me,
    time = world.time
  if (world.gankId >= 0 && continueGank(world)) return
  const campStates = view.state.camps
  let isCampActive = !1
  if (world.campId >= 0 && campStates[world.campId].alive && dist2(selfPlayer.pos, view.map.camps[world.campId].pos) < 9) for (const campMonster of listCampMonsters(world, world.campId)) campMonster.hp < campMonster.stats.maxHp * 0.97 && (isCampActive = !0)
  if (!isCampActive && time >= world.nextGankEval) {
    world.nextGankEval = time + 1
    const findGankTargetResult = findGankTarget(world)
    if (findGankTargetResult && ((world.gankId = findGankTargetResult.id), (world.gankSince = time), (world.gankSeenAt = time), world.gankedAt.set(findGankTargetResult.id, time), (world.gankLaneAt[world.geo.nearestLane(findGankTargetResult.pos.x, findGankTargetResult.pos.y)] = time), continueGank(world))) return
  }
  const chooseJungleCampResult = chooseJungleCamp(world)
  if (!chooseJungleCampResult) {
    let pushLane = world.brain.pushLane,
      bestLaneScore = -1
    for (const topmidbot of ["top", "mid", "bot"]) {
      const laneState = world.brain.lanes[topmidbot],
        laneThreat = laneState.threat + laneState.foeHeroes * 0.5
      laneThreat > bestLaneScore && ((bestLaneScore = laneThreat), (pushLane = topmidbot))
    }
    decideLaneMovement(world, pushLane, "lane")
    return
  }
  const listCampMonstersResult = listCampMonsters(world, chooseJungleCampResult.id),
    distanceToCamp = dist2(selfPlayer.pos, chooseJungleCampResult.pos)
  if (listCampMonstersResult.length === 0) {
    ;(distanceToCamp > 4.5 ? world.travel(chooseJungleCampResult.pos.x, chooseJungleCampResult.pos.y) : world.act.halt(), (world.label = "jungle:wait"))
    return
  }
  if (distanceToCamp > 9) {
    ;(world.travel(chooseJungleCampResult.pos.x, chooseJungleCampResult.pos.y), (world.label = "jungle:go"))
    return
  }
  ;(view.busy() || tryWaveclear(world, listCampMonstersResult, !0), world.act.attack(listCampMonstersResult[0].id), (world.label = "jungle:clear"))
}

function attackCamp(world, campId) {
  const view = world.v,
    selfPlayer = world.me,
    selectedCamps = view.map.camps[campId],
    campMonsters = listCampMonsters(world, campId)
  if (!selectedCamps || campMonsters.length === 0) {
    ;(world.act.halt(), (world.label = "epic:none"))
    return
  }
  const selectedA = campMonsters[0],
    distanceToCamp = dist2(selfPlayer.pos, selectedCamps.pos)
  if (distanceToCamp > 11) {
    const homeDistance = dist2(world.home, selectedCamps.pos) || 1
    ;(world.travel(selectedCamps.pos.x + ((world.home.x - selectedCamps.pos.x) / homeDistance) * 5, selectedCamps.pos.y + ((world.home.y - selectedCamps.pos.y) / homeDistance) * 5), (world.label = "epic:go"))
    return
  }
  const requiredHeroes = selectedCamps.monsterType === "star_colossus" ? AI_TUNING.colossusHeroes : AI_TUNING.drakeHeroes
  if (selectedA.hp >= selectedA.stats.maxHp * 0.985) {
    let readyHeroCount = 1,
      hasEnoughHelp = !0
    for (const friend of world.friends) dist2(friend.pos, selectedCamps.pos) > 12 || (readyHeroCount++, friend.hp > selfPlayer.hp && (hasEnoughHelp = !1))
    if (readyHeroCount < requiredHeroes || !hasEnoughHelp) {
      ;(distanceToCamp > 6 ? world.act.moveTo(selectedCamps.pos.x, selectedCamps.pos.y) : world.act.halt(), (world.label = "epic:wait"))
      return
    }
  }
  ;(view.busy() || tryWaveclear(world, campMonsters, !0), world.act.attack(selectedA.id), (world.label = "epic:fight"))
}

function tryAutoBuy(agent) {
  const hero = agent.hero
  if (hero.gold < MIN_ITEM_COST) return !1
  const NextBuildItemValue = getNextBuildItem(hero)
  return !NextBuildItemValue || hero.gold < getEffectiveItemCost(hero, NextBuildItemValue) ? !1 : (agent.command({ type: "buy", itemId: NextBuildItemValue }), !0)
}

const TEAM_AI_CACHE = new WeakMap()

/**
 * 获取阵营。
 *
 * @param world - 战场
 */
function getTeamAi(world) {
  let Value = TEAM_AI_CACHE.get(world.state)
  Value || ((Value = [null, null]), TEAM_AI_CACHE.set(world.state, Value))
  let teamAi = Value[world.team]
  return (teamAi || ((teamAi = new TeamAi(world)), (Value[world.team] = teamAi)), teamAi)
}

const HERO_SCRATCH_POINT = { x: 0, y: 0 },
  CONE_DODGE_POINT = { x: 0, y: 0 },
  STAND_POINT_SCRATCH = { x: 0, y: 0 },
  MOOD_HARASS_INDEX = 0,
  MOOD_TEAMWORK_INDEX = 1,
  MOOD_FOCUS_INDEX = 2,
  MOOD_FLASH_KILL_INDEX = 3,
  MOOD_DURATION_BY_INDEX = [2.5, 4, 3, 6]

function hasBuff(unit, buffId) {
  for (let index = 0; index < unit.buffs.length; index++) if (unit.buffs[index].id === buffId) return !0
  return !1
}

const ENGAGE_REACH_BY_HERO = { panyue: { slot: "s1", reach: 9 }, chijin: { slot: "s2", reach: 5.5 }, xingli: null, fengling: null, yeque: { slot: "s1", reach: 6.5 } },
  KILL_WINDOW_SLACK_BY_HERO = { panyue: 1.2, chijin: 0.7, xingli: 0.8, fengling: 0.6, yeque: 0.9 }

class HeroAgent {
  interval
  prof
  style
  brain
  geo
  act = new UnitCommander()
  heroId
  team
  ranged
  home
  foeHome
  v
  me
  time = 0
  label = "init"
  foes = []
  foesAll = []
  friends = []
  foeMinions = []
  myMinions = []
  nearFoe = null
  nearFoeD = 1 / 0
  friendsNear = 0
  foeStruct = null
  foeStructD = 1 / 0
  myStruct = null
  myStructD = 1 / 0
  inFoeRange = !1
  towerOnMe = !1
  tankers = 0
  tankHp = 0
  aggroMinions = 0
  minionsOnMe = 0
  heroesOnMe = 0
  hpR = 1
  manaR = 1
  dmgRate = 0
  adv = 9
  poker = null
  pokedUntil = 0
  danger = 0
  respect = !1
  respectUntil = 0
  fightAdv = 1
  evalAllyOut = 1
  fleeUntil = 0
  fightUntil = 0
  fightTargetId = -1
  diving = !1
  forceFightId = -1
  tradeStart = -99
  tradeEnd = -99
  trading = !1
  baseStay = !1
  idleUntil = 0
  lastThink = 0
  lastHp = 0
  moodUntil = [0, 0, 0, 0]
  moodOn = [!1, !1, !1, !1]
  seenSince = new Map()
  seenLast = new Map()
  dodgeRoll = new Map()
  safeAt = -99
  safe = { x: 0, y: 0 }
  anchorLane = null
  anchorP = 0
  side
  tripX = 1e9
  tripY = 1e9
  route = null
  routeIdx = 0
  routeAt = -99
  shakenUntil = 0
  assistId = -1
  assistUntil = 0
  assistBanUntil = 0
  campId = -1
  gankId = -1
  gankSince = 0
  gankSeenAt = 0
  nextGankAt = 50
  nextGankEval = 0
  gankedAt = new Map()
  gankLaneAt = { top: -999, mid: -999, bot: -999 }
  constructor(bushMap) {
    ;((this.prof = AI_DIFFICULTY_PRESETS[bushMap.difficulty]),
      (this.interval = this.prof.think),
      (this.heroId = bushMap.hero.heroId),
      (this.style =
        __heroRow(HERO_AI_PERSONALITY, this.heroId) || { fleeHp: 0.25, recallHp: 0.35, engage: 1, initiator: !1, diveBackline: 0.3, support: !1 }),
      (this.team = bushMap.team),
      (this.brain = getTeamAi(bushMap)),
      (this.geo = this.brain.geo),
      (this.ranged = HERO_TABLE[this.heroId].attackType === "ranged"),
      (this.home = bushMap.map.bases[bushMap.team].fountain),
      (this.foeHome = bushMap.map.bases[bushMap.enemyTeam].fountain),
      (this.lastHp = bushMap.hero.hp),
      (this.side = bushMap.rng.range(-1, 1) * 1.8),
      (this.nextGankAt = 55 + bushMap.rng.range(0, 25)))
  }
  think(world) {
    this.v = world
    const hero = world.hero
    if (((this.me = hero), (this.time = world.time), this.act.begin(world), tryAutoBuy(world), !world.state.over)) {
      if (!hero.alive) {
        this.onDead()
        return
      }
      if ((this.brain.update(world), this.sense(), (this.lastThink = this.time), !this.idle())) {
        if (hasBuff(hero, "recall") && !this.threatened()) {
          this.label = "recall"
          return
        }
        this.dodge() || this.survive() || (this.finish(), !this.sustain() && (this.combat() || this.assist() || this.doTask()))
      }
    }
  }
  onDead() {
    ;((this.label = "dead"),
      (this.fleeUntil = 0),
      (this.fightUntil = 0),
      (this.fightTargetId = -1),
      (this.forceFightId = -1),
      (this.poker = null),
      (this.diving = !1),
      (this.baseStay = !1),
      (this.gankId = -1),
      (this.campId = -1),
      (this.dmgRate = 0),
      (this.lastHp = 0),
      this.act.forget())
  }
  travel(destX, destY, arrivalRadius = 5, forceMove = !1) {
    const selfPlayer = this.me,
      timeState = this.time,
      distance = Math.hypot(destX - this.tripX, destY - this.tripY),
      isNearDestination = Math.hypot(selfPlayer.pos.x - this.tripX, selfPlayer.pos.y - this.tripY) < 3
    ;(distance > arrivalRadius || isNearDestination || this.route === null || timeState - this.routeAt > 4) &&
      ((this.tripX = destX), (this.tripY = destY), (this.routeAt = timeState), (this.routeIdx = 0), (HERO_SCRATCH_POINT.x = destX), (HERO_SCRATCH_POINT.y = destY), (this.route = this.diving ? null : this.v.safePath(HERO_SCRATCH_POINT)))
    const route = this.route
    if (!route) {
      this.act.moveTo(this.tripX, this.tripY, forceMove)
      return
    }
    for (; this.routeIdx < route.length - 1 && Math.hypot(route[this.routeIdx].x - selfPlayer.pos.x, route[this.routeIdx].y - selfPlayer.pos.y) < 1.8;) this.routeIdx++
    const selectedC = route[this.routeIdx]
    this.act.moveTo(selectedC.x, selectedC.y, forceMove)
  }
  doTask() {
    const taskOfResult = this.brain.taskOf(this.heroId)
    switch (taskOfResult.kind) {
      case "jungle":
        decideJungleTask(this)
        break
      case "epic":
        attackCamp(this, taskOfResult.campId)
        break
      case "lane":
        decideLaneMovement(this, taskOfResult.lane, "lane")
        break
      case "push":
        decideLaneMovement(this, taskOfResult.lane, "push")
        break
      case "defend":
        decideLaneMovement(this, taskOfResult.lane, "defend")
        break
    }
  }
  sense() {
    const vState = this.v,
      selfPlayer = this.me,
      timeValue = this.time,
      senseRadius = AI_TUNING.senseRadius
    ;((this.foes.length = 0),
      (this.foesAll.length = 0),
      (this.friends.length = 0),
      (this.foeMinions.length = 0),
      (this.myMinions.length = 0),
      (this.nearFoe = null),
      (this.nearFoeD = 1 / 0),
      (this.heroesOnMe = 0),
      (this.minionsOnMe = 0),
      (this.aggroMinions = 0),
      (this.friendsNear = 0),
      (timeValue >= this.pokedUntil || (this.poker && (!this.poker.alive || !vState.canSee(this.poker)))) && (this.poker = null))
    for (const enemy of vState.enemies()) {
      const distanceToEnemyUnit = dist2(selfPlayer.pos, enemy.pos)
      if (enemy.kind === "hero") {
        const lastSeenTime = this.seenLast.get(enemy.id) ?? -99
        if ((timeValue - lastSeenTime > 0.7 && this.seenSince.set(enemy.id, timeValue), this.seenLast.set(enemy.id, timeValue), timeValue - (this.seenSince.get(enemy.id) ?? timeValue) < this.prof.reaction || (this.foesAll.push(enemy), distanceToEnemyUnit > senseRadius))) continue
        ;(this.foes.push(enemy), distanceToEnemyUnit < this.nearFoeD && ((this.nearFoeD = distanceToEnemyUnit), (this.nearFoe = enemy)), enemy.targetId === selfPlayer.id && (this.heroesOnMe++, (this.poker = enemy), (this.pokedUntil = timeValue + 1.5)))
      } else if (enemy.kind === "minion") {
        if (distanceToEnemyUnit > 13) continue
        ;(this.foeMinions.push(enemy), distanceToEnemyUnit <= AI_TUNING.minionAggro && this.aggroMinions++, enemy.targetId === selfPlayer.id && this.minionsOnMe++)
      }
    }
    for (const ally of vState.allies())
      if (ally !== selfPlayer)
        if (ally.kind === "hero") {
          const distanceToAlly = dist2(selfPlayer.pos, ally.pos)
          ;(distanceToAlly <= senseRadius && this.friends.push(ally), distanceToAlly <= 10 && this.friendsNear++)
        } else ally.kind === "minion" && dist2(selfPlayer.pos, ally.pos) <= 14 && this.myMinions.push(ally)
    ;((this.foeStruct = null), (this.foeStructD = 22))
    for (const enemyStructure of vState.enemyStructures()) {
      const distanceToFoeStruct = dist2(selfPlayer.pos, enemyStructure.pos)
      distanceToFoeStruct < this.foeStructD && ((this.foeStructD = distanceToFoeStruct), (this.foeStruct = enemyStructure))
    }
    ;((this.myStruct = null), (this.myStructD = 22))
    for (const alliedStructure of vState.alliedStructures()) {
      const distanceToMyStruct = dist2(selfPlayer.pos, alliedStructure.pos)
      distanceToMyStruct < this.myStructD && ((this.myStructD = distanceToMyStruct), (this.myStruct = alliedStructure))
    }
    ;((this.inFoeRange = !1), (this.towerOnMe = !1), (this.tankers = 0), (this.tankHp = 0))
    const foeTower = this.foeStruct
    if (foeTower) {
      const towerAttackRange = foeTower.stats.attackRange
      ;((this.inFoeRange = this.foeStructD <= towerAttackRange + 0.4), (this.towerOnMe = foeTower.targetId === selfPlayer.id))
      for (const myMinion of this.myMinions) dist2(myMinion.pos, foeTower.pos) <= towerAttackRange + myMinion.radius && (this.tankers++, (this.tankHp += myMinion.hp))
    }
    ;((this.hpR = selfPlayer.hp / selfPlayer.stats.maxHp), (this.manaR = selfPlayer.stats.maxMana > 0 ? selfPlayer.mana / selfPlayer.stats.maxMana : 1))
    const secondsSinceThink = Math.max(0.05, timeValue - this.lastThink),
      damageTaken = Math.max(0, this.lastHp - selfPlayer.hp)
    ;((this.dmgRate = this.dmgRate * 0.55 + (damageTaken / secondsSinceThink) * 0.45), this.dmgRate < 1 && (this.dmgRate = 0), (this.lastHp = selfPlayer.hp), (this.adv = this.advantageAt(selfPlayer.pos.x, selfPlayer.pos.y)), (this.fightAdv = this.adv))
    let total = 0
    const brain = this.brain
    for (const foeHero of this.foes) dist2(selfPlayer.pos, foeHero.pos) > this.threatReach(foeHero) + 1.5 || (total += estimateSkillDamage(foeHero, selfPlayer, (skillSlot) => brain.enemyReady(foeHero, skillSlot, timeValue)))
    ;((this.danger = total / Math.max(1, selfPlayer.hp + selfPlayer.shield)),
      this.foes.length > 0 && ((this.danger >= AI_TUNING.respectLethal && this.adv < 1.2) || this.adv < AI_TUNING.advOutgunned) && (this.respectUntil = timeValue + 1.6),
      (this.respect = timeValue < this.respectUntil && this.foes.length > 0))
  }
  threatReach(foeUnit) {
    let total = foeUnit.stats.attackRange + foeUnit.radius + this.me.radius + 0.8
    const selectedENGAGE_REACH_BY_HERO = ENGAGE_REACH_BY_HERO[foeUnit.heroId]
    return (selectedENGAGE_REACH_BY_HERO && this.brain.enemyReady(foeUnit, selectedENGAGE_REACH_BY_HERO.slot, this.time) && (total += selectedENGAGE_REACH_BY_HERO.reach), total)
  }
  ghosts(ghostX, ghostY) {
    const awareness = this.prof.awareness,
      vValue = this.v,
      scoreboardEntries = vValue.scoreboard(),
      distance = Math.hypot(ghostX - this.foeHome.x, ghostY - this.foeHome.y) < AI_TUNING.baseGhostRange
    let total = 0,
      ghostCount = 0
    for (let index = 0; index < scoreboardEntries.length; index++) {
      const hiddenFoe = scoreboardEntries[index]
      if (hiddenFoe.team === this.team || !hiddenFoe.alive || vValue.canSee(hiddenFoe)) continue
      if (distance) {
        ghostCount++
        continue
      }
      const lastSighting = vValue.lastSeen(hiddenFoe.id)
      if (!lastSighting || lastSighting.time < 0) continue
      const secondsSinceSeen = this.time - lastSighting.time
      secondsSinceSeen > 25 || Math.hypot(lastSighting.x - ghostX, lastSighting.y - ghostY) - 6.5 * secondsSinceSeen > 12 || (total += secondsSinceSeen < 3 ? 0.8 : secondsSinceSeen < 10 ? 0.5 : 0.25)
    }
    return total * awareness + ghostCount * AI_TUNING.baseGhost * (0.5 + 0.5 * awareness)
  }
  advantageAt(pointX, pointY) {
    const view = this.v,
      selfPlayer = this.me,
      time = this.time,
      brain = this.brain
    let total = 0,
      allyStrength = 0,
      foeStrength = 0,
      foeDamage = 0,
      foeCount = 0
    for (const alliedHero of view.alliedHeroes()) {
      const distance = alliedHero === selfPlayer ? 1 : allyProximityFactor(Math.hypot(alliedHero.pos.x - pointX, alliedHero.pos.y - pointY))
      if (distance <= 0) continue
      const skills = alliedHero.skills
      ;((total += effectiveHp(alliedHero) * distance), (allyStrength += estimateFightHorizon(alliedHero, (skillSlot) => skills[skillSlot].cd <= 0.3 && alliedHero.mana >= skills[skillSlot].cost) * distance))
    }
    for (const foeHero of this.foesAll) {
      const foeProximityFactorResult = foeProximityFactor(Math.hypot(foeHero.pos.x - pointX, foeHero.pos.y - pointY))
      foeProximityFactorResult <= 0 || ((foeStrength += effectiveHp(foeHero) * foeProximityFactorResult), (foeDamage += estimateFightHorizon(foeHero, (skillSlot) => brain.enemyReady(foeHero, skillSlot, time)) * foeProximityFactorResult), (foeCount += foeProximityFactorResult))
    }
    const ghostsResult = this.ghosts(pointX, pointY)
    if (foeCount <= 0 && ghostsResult <= 0) return 9
    if (ghostsResult > 0) {
      const meanFoeStrength = foeCount > 0 ? foeStrength / foeCount : effectiveHp(selfPlayer) / Math.max(0.3, this.hpR),
        meanFoeDamage = foeCount > 0 ? foeDamage / foeCount : estimateAttackDps(selfPlayer) * AI_TUNING.fightHorizon * 1.6
      ;((foeStrength += meanFoeStrength * ghostsResult), (foeDamage += meanFoeDamage * ghostsResult))
    }
    ;((HERO_SCRATCH_POINT.x = pointX), (HERO_SCRATCH_POINT.y = pointY))
    const enemyStructureCoveringResult = view.enemyStructureCovering(HERO_SCRATCH_POINT, 0.5)
    enemyStructureCoveringResult && (foeDamage += expectedDps(enemyStructureCoveringResult))
    for (const alliedTower of view.alliedStructures()) {
      const towerAttackRange = alliedTower.stats.attackRange
      if ((alliedTower.pos.x - pointX) * (alliedTower.pos.x - pointX) + (alliedTower.pos.y - pointY) * (alliedTower.pos.y - pointY) <= towerAttackRange * towerAttackRange) {
        allyStrength += expectedDps(alliedTower)
        break
      }
    }
    const aggroRangeSq = AI_TUNING.minionAggro * AI_TUNING.minionAggro
    for (const foeMinion of this.foeMinions) (foeMinion.pos.x - pointX) * (foeMinion.pos.x - pointX) + (foeMinion.pos.y - pointY) * (foeMinion.pos.y - pointY) <= aggroRangeSq && (foeDamage += estimateAttackDps(foeMinion) * AI_TUNING.fightHorizon * 0.6)
    for (const myMinion of this.myMinions) (myMinion.pos.x - pointX) * (myMinion.pos.x - pointX) + (myMinion.pos.y - pointY) * (myMinion.pos.y - pointY) <= aggroRangeSq && (allyStrength += estimateAttackDps(myMinion) * AI_TUNING.fightHorizon * 0.35)
    return ((this.evalAllyOut = allyStrength), estimateTimeToKill(total, allyStrength, foeStrength, foeDamage))
  }
  killWindow(target) {
    const view = this.v,
      selfPlayer = this.me,
      killTimeNeeded = effectiveHp(target) / Math.max(1, this.evalAllyOut / AI_TUNING.fightHorizon)
    let escapeDistance = 60,
      isReady = null
    for (const enemyTower of view.enemyStructures()) {
      const towerEdgeDistance = dist2(enemyTower.pos, target.pos) - enemyTower.stats.attackRange
      towerEdgeDistance < escapeDistance && ((escapeDistance = towerEdgeDistance), (isReady = enemyTower.pos))
    }
    let total = Math.max(0, escapeDistance) / Math.max(1, target.stats.moveSpeed) + AI_TUNING.killSlack + (KILL_WINDOW_SLACK_BY_HERO[this.heroId] ?? 1)
    for (let index = 0; index < target.buffs.length; index++) {
      const selectedBuffs = target.buffs[index]
      selectedBuffs.id === "stun" || selectedBuffs.id === "airborne" || selectedBuffs.id === "root" ? (total += selectedBuffs.timeLeft) : selectedBuffs.id === "slow" && (total += selectedBuffs.timeLeft * selectedBuffs.value * 1.5)
    }
    if (isReady) {
      const distanceToEscapePoint = dist2(isReady, target.pos)
      if (dist2(isReady, selfPlayer.pos) < distanceToEscapePoint - 1) total += 2.5
      else
        for (const friend of this.friends)
          if ((dist2(friend.pos, target.pos) < 12 && (total += (KILL_WINDOW_SLACK_BY_HERO[friend.heroId] ?? 1) * 0.5), dist2(isReady, friend.pos) < distanceToEscapePoint - 1 && dist2(friend.pos, target.pos) < 10)) {
            total += 2.5
            break
          }
    }
    return killTimeNeeded <= total
  }
  nearFoeFountain(position, extraRadius) {
    const fountainRadius = this.v.map.bases[this.v.enemyTeam].fountainRadius + extraRadius,
      offsetX = position.x - this.foeHome.x,
      offsetY = position.y - this.foeHome.y
    return offsetX * offsetX + offsetY * offsetY <= fountainRadius * fountainRadius
  }
  threatened() {
    return this.dmgRate > 0 || (this.nearFoe && this.nearFoeD < 11) ? !0 : this.minionsOnMe > 0
  }
  inMood(moodIndex, moodChance) {
    return (this.time >= this.moodUntil[moodIndex] && ((this.moodUntil[moodIndex] = this.time + MOOD_DURATION_BY_INDEX[moodIndex]), (this.moodOn[moodIndex] = this.v.rng.chance(moodChance))), this.moodOn[moodIndex])
  }
  /**
   * 处理碰撞。
   *
   * @param target - 主要输入
  */
  safeToHit(target) {
    if (this.nearFoeFountain(target.pos, 1.5 - this.me.stats.attackRange)) return !1
    const foeTower = this.foeStruct
    return !foeTower || target === foeTower || this.diving || (this.tankers > 0 && this.tankHp > 500 && !this.towerOnMe)
      ? !0
      : dist2(target.pos, foeTower.pos) + this.me.stats.attackRange + target.radius > foeTower.stats.attackRange + AI_TUNING.towerMargin + 0.4
  }
  safeFromFoes(target) {
    if (!this.respect) return !0
    const targetReach = this.me.stats.attackRange + target.radius
    for (const foeHero of this.foes) if (dist2(foeHero.pos, target.pos) + targetReach < this.threatReach(foeHero)) return !1
    return !0
  }
  killable(target) {
    const selfPlayer = this.me
    return chooseCastableSkill(selfPlayer, target) + 2 * computeBasicAttackDamage(selfPlayer, target) >= target.hp + target.shield
  }
  idle() {
    const profState = this.prof
    return profState.idleRate <= 0
      ? !1
      : this.time < this.idleUntil
        ? this.dmgRate > 0 || (this.nearFoe && this.nearFoeD < 6)
          ? ((this.idleUntil = 0), !1)
          : ((this.label = "idle"), !0)
        : this.dmgRate > 0 || this.inFoeRange
          ? !1
          : this.v.rng.chance(profState.idleRate * this.interval)
            ? ((this.idleUntil = this.time + this.v.rng.range(profState.idleMin, profState.idleMax)), this.act.halt(), (this.label = "idle"), !0)
            : !1
  }
  canStand = (standPoint) => this.v.walkable(standPoint)
  willDodge(lookupKey) {
    let getValue = this.dodgeRoll.get(lookupKey)
    return (getValue === void 0 && (this.dodgeRoll.size > 64 && this.dodgeRoll.clear(), (getValue = this.v.rng.chance(this.prof.dodge)), this.dodgeRoll.set(lookupKey, getValue)), getValue)
  }
  dodge() {
    const view = this.v,
      selfPlayer = this.me,
      profValue = this.prof
    if (view.busy()) return !1
    let total = 0,
      dodgeY = 0,
      hasDodgeThreat = !1
    const moveSpeed = Math.max(1, selfPlayer.stats.moveSpeed)
    for (const hostileArea of view.hostileAreas()) {
      const selectedAREA_THREAT_KIND_BY_VISUAL = AREA_THREAT_KIND_BY_VISUAL[hostileArea.visual]
      if ((selectedAREA_THREAT_KIND_BY_VISUAL !== "incoming" && selectedAREA_THREAT_KIND_BY_VISUAL !== "damage") || hostileArea.followUnitId >= 0 || hostileArea.age < profValue.reaction) continue
      const areaOffsetX = selfPlayer.pos.x - hostileArea.pos.x,
        areaOffsetY = selfPlayer.pos.y - hostileArea.pos.y,
        distance = Math.hypot(areaOffsetX, areaOffsetY),
        dangerRadius = hostileArea.radius + selfPlayer.radius + 0.35
      if (distance >= dangerRadius || !this.willDodge(hostileArea.id)) continue
      const areaTimeLeft = hostileArea.duration - hostileArea.age,
        dodgeTime = (dangerRadius - distance) / moveSpeed
      let escapeDirX, fleeDirY
      if (distance > 0.3) ((escapeDirX = areaOffsetX / distance), (fleeDirY = areaOffsetY / distance))
      else {
        const areaHomeDistance = dist2(this.home, selfPlayer.pos) || 1
        ;((escapeDirX = (this.home.x - selfPlayer.pos.x) / areaHomeDistance), (fleeDirY = (this.home.y - selfPlayer.pos.y) / areaHomeDistance))
      }
      if (selectedAREA_THREAT_KIND_BY_VISUAL === "incoming" && dodgeTime > areaTimeLeft + 0.12) {
        if (profValue.dodge >= 0.9 && areaTimeLeft > 0.1 && runHeroCombatAction(this, escapeDirX, fleeDirY)) return ((this.label = "dodge"), !0)
        continue
      }
      ;((total += escapeDirX), (dodgeY += fleeDirY), (hasDodgeThreat = !0))
    }
    for (const hostileCone of view.hostileCones()) hostileCone.age < profValue.reaction || (canHitTarget(selfPlayer.pos, selfPlayer.radius, hostileCone, this.home, this.canStand, CONE_DODGE_POINT) && this.willDodge(hostileCone.id) && ((total += CONE_DODGE_POINT.x * 2), (dodgeY += CONE_DODGE_POINT.y * 2), (hasDodgeThreat = !0)))
    for (const hostileProjectile of view.hostileProjectiles()) {
      if (hostileProjectile.targetId !== -1 || hostileProjectile.speed <= 0 || hostileProjectile.traveled / hostileProjectile.speed < profValue.reaction * 0.5) continue
      const projectileOffsetX = selfPlayer.pos.x - hostileProjectile.pos.x,
        projectileOffsetY = selfPlayer.pos.y - hostileProjectile.pos.y,
        projectileAlong = projectileOffsetX * hostileProjectile.dir.x + projectileOffsetY * hostileProjectile.dir.y
      if (projectileAlong < 0 || projectileAlong > hostileProjectile.maxRange - hostileProjectile.traveled + selfPlayer.radius) continue
      const projectileSide = projectileOffsetX * hostileProjectile.dir.y - projectileOffsetY * hostileProjectile.dir.x,
        safeSideDistance = hostileProjectile.radius + selfPlayer.radius + 0.3
      if (Math.abs(projectileSide) >= safeSideDistance || !this.willDodge(hostileProjectile.id) || (safeSideDistance - Math.abs(projectileSide)) / moveSpeed > projectileAlong / hostileProjectile.speed + 0.05) continue
      const sideSign = projectileSide >= 0 ? 1 : -1
      let dodgeDirX = hostileProjectile.dir.y * sideSign,
        dodgeDirY = -hostileProjectile.dir.x * sideSign
      ;((HERO_SCRATCH_POINT.x = selfPlayer.pos.x + dodgeDirX * 1.6), (HERO_SCRATCH_POINT.y = selfPlayer.pos.y + dodgeDirY * 1.6), view.walkable(HERO_SCRATCH_POINT) || ((dodgeDirX = -dodgeDirX), (dodgeDirY = -dodgeDirY)), (total += dodgeDirX * 1.5), (dodgeY += dodgeDirY * 1.5), (hasDodgeThreat = !0))
    }
    if (!hasDodgeThreat) return !1
    const shotHomeDistance = dist2(this.home, selfPlayer.pos) || 1
    ;((total += ((this.home.x - selfPlayer.pos.x) / shotHomeDistance) * 0.3), (dodgeY += ((this.home.y - selfPlayer.pos.y) / shotHomeDistance) * 0.3))
    const fleeDirLength = Math.hypot(total, dodgeY)
    return fleeDirLength < 0.001 ? !1 : (this.act.moveDir(total / fleeDirLength, dodgeY / fleeDirLength, !0), (this.label = "dodge"), !0)
  }
  survive() {
    const time = this.time
    if (((this.forceFightId = -1), time >= this.fightUntil && (this.diving = !1), this.nearFoeFountain(this.me.pos, 1.2)))
      return (this.travel(this.home.x, this.home.y, 8, !0), (this.label = "leave-fountain"), !0)
    const foeTower = this.foeStruct,
      shouldLeaveTower = foeTower !== null && this.inFoeRange && !this.diving && (this.towerOnMe || this.tankers === 0 || this.tankHp < 450),
      hasNearbyFoe = this.nearFoe !== null && this.nearFoeD < 12,
      fleeHpThreshold = this.style.fleeHp
    let isFleeing = time < this.fleeUntil
    if (
      (isFleeing
        ? hasNearbyFoe && (this.adv < AI_TUNING.advFlee * 1.2 || this.hpR < fleeHpThreshold) && (this.fleeUntil = Math.max(this.fleeUntil, time + 0.6))
        : (((this.hpR < fleeHpThreshold && (hasNearbyFoe || this.inFoeRange || this.dmgRate > 0)) ||
            (hasNearbyFoe && this.adv < AI_TUNING.advFlee) ||
            (this.heroesOnMe > 0 && this.nearFoeD < 9 && this.adv < AI_TUNING.advPressed) ||
            (hasNearbyFoe && this.danger >= 1 && this.adv < 1.1 && this.prof.awareness > 0)) &&
            (isFleeing = !0),
          isFleeing && (this.fleeUntil = time + AI_TUNING.fleeHold)),
      isFleeing)
    ) {
      const nearFoe = this.nearFoe
      return nearFoe && this.nearFoeD <= this.engageDist(nearFoe) && this.killable(nearFoe) && this.adv >= 0.55 && !this.v.enemyStructureCovering(nearFoe.pos, 0) ? ((this.forceFightId = nearFoe.id), !1) : (this.flee(), !0)
    }
    return shouldLeaveTower && foeTower ? (this.leaveTower(foeTower), !0) : !1
  }
  /**
   * 处理防御塔。
   *
   * @param foeTower - 主要输入
  */
  leaveTower(foeTower) {
    const selfPlayer = this.me
    let fleeDirX = selfPlayer.pos.x - foeTower.pos.x,
      fleeDirY = selfPlayer.pos.y - foeTower.pos.y
    const distance = Math.hypot(fleeDirX, fleeDirY) || 1,
      homeDistance = dist2(this.home, selfPlayer.pos) || 1
    ;((fleeDirX = fleeDirX / distance + ((this.home.x - selfPlayer.pos.x) / homeDistance) * 0.9), (fleeDirY = fleeDirY / distance + ((this.home.y - selfPlayer.pos.y) / homeDistance) * 0.9))
    const escapeDistance = Math.hypot(fleeDirX, fleeDirY) || 1,
      retreatExtra = foeTower.stats.attackRange + 3 - this.foeStructD,
      retreatPoint = this.v.nearestWalkable({ x: selfPlayer.pos.x + (fleeDirX / escapeDistance) * Math.max(3, retreatExtra), y: selfPlayer.pos.y + (fleeDirY / escapeDistance) * Math.max(3, retreatExtra) })
    ;(this.act.moveTo(retreatPoint.x, retreatPoint.y, !0), (this.label = "leave-tower"))
  }
  safeSpot() {
    if (this.time - this.safeAt < 1) return this.safe
    this.safeAt = this.time
    const selfPlayer = this.me
    let bestSafeScore = 1 / 0
    const distance = /**
 * 处理距离。
 *
 * @param candidateX - 主要输入
 * @param chest - 输入
 * @param dangerPenalty - 第三输入
 */
(candidateX, chest, dangerPenalty) => {
      let distance = Math.hypot(candidateX - selfPlayer.pos.x, chest - selfPlayer.pos.y) + dangerPenalty
      const candidateOffsetX = candidateX - selfPlayer.pos.x,
        candidateOffsetY = chest - selfPlayer.pos.y,
        candidateDistance = Math.hypot(candidateOffsetX, candidateOffsetY) || 1
      for (const foeHero of this.foes) {
        const foeOffsetX = foeHero.pos.x - selfPlayer.pos.x,
          foeOffsetY = foeHero.pos.y - selfPlayer.pos.y,
          foeProjection = (foeOffsetX * candidateOffsetX + foeOffsetY * candidateOffsetY) / candidateDistance
        foeProjection <= 0 || foeProjection >= candidateDistance || (Math.abs(foeOffsetX * candidateOffsetY - foeOffsetY * candidateOffsetX) / candidateDistance < 5 && (distance += 30))
      }
      distance < bestSafeScore && ((bestSafeScore = distance), (this.safe.x = candidateX), (this.safe.y = chest))
    }
    distance(this.home.x, this.home.y, 6)
    for (const alliedTower of this.v.alliedStructures()) {
      if (alliedTower.kind !== "tower") continue
      const towerToHomeDistance = dist2(alliedTower.pos, this.home)
      if (towerToHomeDistance > dist2(selfPlayer.pos, this.home) + 2) continue
      const homeBlend = 3 / Math.max(1, towerToHomeDistance)
      distance(alliedTower.pos.x + (this.home.x - alliedTower.pos.x) * homeBlend, alliedTower.pos.y + (this.home.y - alliedTower.pos.y) * homeBlend, 0)
    }
    return this.safe
  }
  flee() {
    const view = this.v,
      selfPlayer = this.me
    ;((this.label = "flee"), (this.gankId = -1), (this.shakenUntil = this.time + AI_TUNING.shakenTime))
    const safeSpotResult = this.safeSpot()
    let fleeDirX = safeSpotResult.x - selfPlayer.pos.x,
      fleeDirY = safeSpotResult.y - selfPlayer.pos.y
    Math.hypot(fleeDirX, fleeDirY) < 4 && ((fleeDirX = this.home.x - selfPlayer.pos.x), (fleeDirY = this.home.y - selfPlayer.pos.y), (this.safe.x = this.home.x), (this.safe.y = this.home.y))
    const distance = Math.hypot(fleeDirX, fleeDirY) || 1
    ;((fleeDirX /= distance), (fleeDirY /= distance))
    const hasNearbyFoe = this.nearFoe !== null && this.nearFoeD < 8.5,
      escapeSense = this.prof.escapeSense
    if (hasNearbyFoe && !view.busy() && (this.hpR < 0.5 * escapeSense || this.adv < 0.5 || (this.heroesOnMe > 0 && this.nearFoeD < 4.5 && this.hpR < 0.75)) && runHeroCombatAction(this, fleeDirX, fleeDirY)) return
    const isCriticalHp = this.hpR < 0.2 * escapeSense,
      shouldFlash = this.hpR < 0.65 * escapeSense && this.adv < 0.5 && this.nearFoeD < 4.5
    if ((isCriticalHp || shouldFlash) && this.nearFoe && this.nearFoeD < 6.5 && view.skillReady("flash") && !view.busy())
      for (const angleOffset of [0, 0.6, -0.6]) {
        const flashAngle = Math.atan2(fleeDirY, fleeDirX) + angleOffset
        if (((HERO_SCRATCH_POINT.x = selfPlayer.pos.x + Math.cos(flashAngle) * 5), (HERO_SCRATCH_POINT.y = selfPlayer.pos.y + Math.sin(flashAngle) * 5), !(!view.walkable(HERO_SCRATCH_POINT) || view.enemyStructureCovering(HERO_SCRATCH_POINT, 0)))) {
          ;(this.act.castDir("flash", Math.cos(flashAngle), Math.sin(flashAngle)), this.act.forget())
          return
        }
      }
    this.travel(this.safe.x, this.safe.y, 3, !0)
  }
  sustain() {
    const view = this.v,
      selfPlayer = this.me,
      selectedBases = view.map.bases[this.team],
      distanceToHome = dist2(selfPlayer.pos, this.home),
      isAtFountain = distanceToHome <= selectedBases.fountainRadius - 0.5
    if (this.baseStay)
      if (this.hpR >= AI_TUNING.baseHpReady && this.manaR >= AI_TUNING.baseManaReady) this.baseStay = !1
      else {
        if (((this.label = "base"), isAtFountain)) this.act.halt()
        else if (distanceToHome < 26) this.act.moveTo(this.home.x, this.home.y)
        else if (!this.recallNow()) {
          const safeRetreatSpot = this.safeSpot()
          this.travel(safeRetreatSpot.x, safeRetreatSpot.y, 3)
        }
        return !0
      }
    const isSafeToHeal = !this.nearFoe || this.nearFoeD > 10,
      hasBuffResult = hasBuff(selfPlayer, "restore")
    !hasBuffResult && this.hpR < AI_TUNING.healHp && isSafeToHeal && !this.inFoeRange && view.skillReady("heal") && !selfPlayer.inCombat && this.act.castSelf("heal")
    let shouldRecall = this.hpR < this.style.recallHp || (this.manaR < 0.12 && this.hpR < 0.75) || (this.hpR < 0.55 && this.manaR < 0.2)
    if ((shouldRecall && this.hpR >= 0.2 && (hasBuffResult || (view.skillReady("heal") && isSafeToHeal && !selfPlayer.inCombat)) && (shouldRecall = !1), !shouldRecall || (this.time < this.fightUntil && this.adv >= 1.3 && this.hpR >= this.style.fleeHp))) return !1
    if (((this.label = "go-home"), (this.gankId = -1), isAtFountain)) return ((this.baseStay = !0), this.act.halt(), !0)
    if (distanceToHome < 26) return ((this.baseStay = !0), this.act.moveTo(this.home.x, this.home.y), !0)
    if (this.recallNow()) return ((this.baseStay = !0), !0)
    const safeSpot = this.safeSpot()
    return (this.travel(safeSpot.x, safeSpot.y, 3), !0)
  }
  recallNow() {
    const view = this.v
    return hasBuff(this.me, "recall")
      ? !0
      : !((!this.nearFoe || this.nearFoeD > 14) && !this.inFoeRange && this.dmgRate <= 0 && this.minionsOnMe === 0 && this.foeMinionsWithin(7) === 0) || !view.skillReady("recall") || view.busy()
        ? !1
        : (this.act.castSelf("recall"), this.act.forget(), !0)
  }
  /**
   * 处理小兵。
   *
   * @param radius - 主要输入
  */
  foeMinionsWithin(radius) {
    let foeMinionCount = 0
    for (const foeMinion of this.foeMinions) dist2(foeMinion.pos, this.me.pos) <= radius && foeMinionCount++
    return foeMinionCount
  }
  engageDist(foeUnit) {
    const selfPlayer = this.me
    if (this.ranged) return selfPlayer.stats.attackRange + foeUnit.radius + 2.5
    const engageReach = ENGAGE_REACH_BY_HERO[this.heroId],
      skillReach = engageReach && this.v.skillReady(engageReach.slot) ? engageReach.reach : 0
    return selfPlayer.stats.attackRange + foeUnit.radius + 3.5 + skillReach
  }
  diveOk(target, foeTower, advantage) {
    if (!this.prof.dive || foeTower.kind === "core") return !1
    const selfPlayer = this.me,
      burstDamage = chooseCastableSkill(selfPlayer, target) + 2 * computeBasicAttackDamage(selfPlayer, target),
      targetHp = target.hp + target.shield,
      towerDamage = (foeTower.stats.ad * 1.5 * 600) / (600 + selfPlayer.stats.armor)
    return burstDamage >= targetHp * 1.15 && selfPlayer.hp - towerDamage * 3 > selfPlayer.stats.maxHp * 0.3 && advantage >= 0.9 ? !0 : this.tankers >= 2 && advantage >= 1.8 && this.hpR > 0.5
  }
  /**
   * 处理坐标。
   *
   * @param target - 主要输入
   * @param outPosition - 输入
  */
  standPoint(target, outPosition) {
    const selfPlayer = this.me,
      standoffDistance = selfPlayer.stats.attackRange + target.radius,
      standOffsetX = selfPlayer.pos.x - target.pos.x,
      standOffsetY = selfPlayer.pos.y - target.pos.y,
      distance = Math.hypot(standOffsetX, standOffsetY)
    return (distance <= standoffDistance || distance < 0.001 ? ((outPosition.x = selfPlayer.pos.x), (outPosition.y = selfPlayer.pos.y)) : ((outPosition.x = target.pos.x + (standOffsetX / distance) * standoffDistance), (outPosition.y = target.pos.y + (standOffsetY / distance) * standoffDistance)), outPosition)
  }
  /**
   * 查找目标。
   *
  */
  pickTarget() {
    const selfPlayer = this.me,
      view = this.v,
      attackRange = selfPlayer.stats.attackRange
    let bestTarget = null,
      bestScore = -1 / 0
    for (const foeHero of this.foes) {
      const distanceToFoe = dist2(selfPlayer.pos, foeHero.pos),
        foeHpFraction = foeHero.hp / foeHero.stats.maxHp
      let total = 2 - distanceToFoe / 6 + (1 - foeHpFraction) * 2.2
      const foeRole = HERO_TABLE[foeHero.heroId].role
      if (
        ((foeRole === "mage" || foeRole === "marksman") && (total += this.style.diveBackline),
        foeHero.id === this.brain.focusId && this.inMood(MOOD_FOCUS_INDEX, this.prof.focus) && (total += 1.5),
        foeHero.id === this.fightTargetId && this.time < this.fightUntil + 1 && (total += 0.8),
        foeHero.id === this.forceFightId && (total += 10),
        foeHero.targetId === selfPlayer.id && (total += 0.4),
        this.ranged && distanceToFoe <= attackRange + foeHero.radius + 0.5 && (total += 1),
        this.style.support)
      )
        for (const friend of this.friends) {
          const friendRole = HERO_TABLE[friend.heroId].role
          ;(friendRole === "mage" || friendRole === "marksman") && dist2(friend.pos, foeHero.pos) < 4.5 && (total += 1.2)
        }
      ;(view.enemyStructureCovering(foeHero.pos, -0.5) && (total -= 1.5), this.killable(foeHero) && (total += 2), total > bestScore && ((bestScore = total), (bestTarget = foeHero)))
    }
    return bestTarget
  }
  finish() {
    if (!(this.foes.length === 0 || this.v.busy())) {
      for (const foeHero of this.foes) if (!(foeHero.hp > foeHero.stats.maxHp * 0.3) && canKillTarget(this, foeHero)) return
    }
  }
  combat() {
    if (this.foes.length === 0) return !1
    const pickTargetResult = this.pickTarget()
    if (!pickTargetResult) return !1
    const selfPlayer = this.me,
      view = this.v,
      time = this.time,
      distanceToTarget = dist2(selfPlayer.pos, pickTargetResult.pos),
      standPointResult = this.standPoint(pickTargetResult, STAND_POINT_SCRATCH),
      standPointAdvantage = this.advantageAt(standPointResult.x, standPointResult.y)
    this.fightAdv = standPointAdvantage
    let engageThreshold = (AI_TUNING.advAllIn * this.style.engage) / this.prof.aggression
    pickTargetResult.id === this.brain.focusId ? (engageThreshold *= AI_TUNING.followUp) : !this.style.initiator && this.friendsNear >= 2 && this.brain.focusId < 0 && (engageThreshold *= AI_TUNING.waitForEngage)
    const isShaken = time < this.shakenUntil
    isShaken && (engageThreshold *= AI_TUNING.shakenFactor)
    const hasActiveFight = time < this.fightUntil && this.fightTargetId === pickTargetResult.id,
      canAttackTarget = distanceToTarget <= selfPlayer.stats.attackRange + pickTargetResult.radius + 1,
      isUnderAttack = this.heroesOnMe > 0 || (selfPlayer.inCombat && time - selfPlayer.lastHitTime < 1.2),
      engageDistResult = this.engageDist(pickTargetResult),
      killableResult = this.killable(pickTargetResult),
      killWindowResult = this.killWindow(pickTargetResult)
    let shouldFight = !1,
      shouldTrade = !1
    if (pickTargetResult.id === this.forceFightId) shouldFight = !0
    else if (standPointAdvantage >= engageThreshold && killWindowResult) shouldFight = !0
    else if (hasActiveFight && !this.trading && standPointAdvantage >= Math.max(1, engageThreshold * 0.85) && killWindowResult) shouldFight = !0
    else if (killableResult && standPointAdvantage >= 0.75 && distanceToTarget <= engageDistResult && killWindowResult) shouldFight = !0
    else if (canAttackTarget && standPointAdvantage >= AI_TUNING.advPress * (isShaken ? AI_TUNING.shakenFactor : 1) && !this.respect) ((shouldFight = !0), (shouldTrade = !0))
    else if (isUnderAttack && canAttackTarget) {
      const tradeStartTime = time - this.tradeEnd < 3 ? this.tradeStart : time
      standPointAdvantage >= AI_TUNING.advFightBack + (time - tradeStartTime) * AI_TUNING.tradeFatigue && ((shouldFight = !0), (shouldTrade = !0), (this.tradeStart = tradeStartTime), (this.tradeEnd = time))
    }
    if (((this.trading = shouldTrade), !shouldFight || (distanceToTarget > engageDistResult && !(standPointAdvantage >= engageThreshold * 1.2 && distanceToTarget <= 14 && (pickTargetResult.hp < pickTargetResult.stats.maxHp * 0.5 || this.friendsNear >= 1))) || this.nearFoeFountain(standPointResult, 1.5))) return !1
    const coveringEnemyTower = view.enemyStructureCovering(standPointResult, 0.3)
    if (coveringEnemyTower) {
      if (this.diveOk(pickTargetResult, coveringEnemyTower, standPointAdvantage)) this.diving = !0
      else if (!(this.ranged && !view.enemyStructureCovering(selfPlayer.pos, 0.3) && canAttackTarget)) return !1
    }
    return ((this.fightUntil = time + AI_TUNING.fightHold), (this.fightTargetId = pickTargetResult.id), this.prof.focus > 0 && !shouldTrade && this.brain.callFocus(pickTargetResult.id, time), this.fight(pickTargetResult, distanceToTarget, !shouldTrade), !0)
  }
  fight(target, distanceToTarget, isAllIn) {
    const view = this.v,
      selfPlayer = this.me
    ;((this.label = isAllIn ? "fight" : "trade"), view.busy() || (isAllIn ? runHeroEngage(this, target) : tryPoke(this, target)))
    const engageDistance = selfPlayer.stats.attackRange + target.radius
    if (isAllIn && distanceToTarget > engageDistance + 0.8 && distanceToTarget < engageDistance + 5 && target.hp <= computeBasicAttackDamage(selfPlayer, target) * 1.6 && view.skillReady("flash") && !view.busy() && this.inMood(MOOD_FLASH_KILL_INDEX, this.prof.flashKill)) {
      const aimDirX = (target.pos.x - selfPlayer.pos.x) / distanceToTarget,
        aimDirY = (target.pos.y - selfPlayer.pos.y) / distanceToTarget
      ;((HERO_SCRATCH_POINT.x = selfPlayer.pos.x + aimDirX * 5), (HERO_SCRATCH_POINT.y = selfPlayer.pos.y + aimDirY * 5), view.walkable(HERO_SCRATCH_POINT) && (this.diving || !view.enemyStructureCovering(HERO_SCRATCH_POINT, 0)) && (this.act.castDir("flash", aimDirX, aimDirY), this.act.forget()))
    }
    this.ranged ? this.kite(target) : this.act.attack(target.id)
  }
  meleeThreat() {
    let nearestMeleeFoe = null,
      nearestDistance = 1 / 0
    for (const foeHero of this.foes) {
      if (foeHero.stats.attackRange >= 4) continue
      const distanceToFoe = dist2(this.me.pos, foeHero.pos)
      distanceToFoe < foeHero.stats.attackRange + 2.4 && distanceToFoe < nearestDistance && ((nearestDistance = distanceToFoe), (nearestMeleeFoe = foeHero))
    }
    return nearestMeleeFoe
  }
  kite(target) {
    const view = this.v,
      selfPlayer = this.me,
      actState = this.act
    if (!this.prof.orbwalk || view.attackWindup()) {
      actState.attack(target.id)
      return
    }
    const attackCooldownRemaining = view.attackCooldown(),
      meleeThreatResult = this.meleeThreat()
    if (!meleeThreatResult || attackCooldownRemaining <= this.interval * 0.7) {
      actState.attack(target.id)
      return
    }
    let kiteDirX = selfPlayer.pos.x - meleeThreatResult.pos.x,
      kiteDirY = selfPlayer.pos.y - meleeThreatResult.pos.y
    const distance = Math.hypot(kiteDirX, kiteDirY) || 1,
      homeDistance = dist2(this.home, selfPlayer.pos) || 1
    ;((kiteDirX = kiteDirX / distance + ((this.home.x - selfPlayer.pos.x) / homeDistance) * 0.5), (kiteDirY = kiteDirY / distance + ((this.home.y - selfPlayer.pos.y) / homeDistance) * 0.5))
    const kiteDistance = Math.hypot(kiteDirX, kiteDirY) || 1
    if (((HERO_SCRATCH_POINT.x = selfPlayer.pos.x + (kiteDirX / kiteDistance) * 2), (HERO_SCRATCH_POINT.y = selfPlayer.pos.y + (kiteDirY / kiteDistance) * 2), !view.walkable(HERO_SCRATCH_POINT) || view.enemyStructureCovering(HERO_SCRATCH_POINT, 0))) {
      actState.attack(target.id)
      return
    }
    actState.moveDir(kiteDirX / kiteDistance, kiteDirY / kiteDistance)
  }
  assist() {
    if (this.hpR < 0.5) return !1
    const view = this.v,
      selfPlayer = this.me,
      currentTask = this.brain.taskOf(this.heroId),
      isSameLaneTask = this.brain.phase === "lane" && currentTask.kind === "lane",
      assistRange = isSameLaneTask ? 16 : 30
    let assistTarget = null,
      closestDistance = 1 / 0
    for (const alliedHero of view.alliedHeroes()) {
      if (alliedHero === selfPlayer || !alliedHero.inCombat) continue
      const distanceToAlly = dist2(selfPlayer.pos, alliedHero.pos)
      if (distanceToAlly < 7) {
        alliedHero.id === this.assistId && ((this.assistId = -1), (this.assistBanUntil = this.time + 6))
        continue
      }
      if (distanceToAlly > assistRange || distanceToAlly >= closestDistance) continue
      let isUnderThreat = !1
      for (const foeHero of this.foesAll) dist2(foeHero.pos, alliedHero.pos) < 11 && (isUnderThreat = !0)
      isUnderThreat && ((closestDistance = distanceToAlly), (assistTarget = alliedHero))
    }
    if (!assistTarget) return !1
    const time = this.time
    if (assistTarget.id === this.assistId && time < this.assistUntil) {
      if (this.advantageAt(assistTarget.pos.x, assistTarget.pos.y) < 0.8) return ((this.assistUntil = 0), (this.assistBanUntil = time + 3), !1)
    } else {
      if (time < this.assistBanUntil || (!isSameLaneTask && !this.inMood(MOOD_TEAMWORK_INDEX, this.prof.teamwork))) return !1
      if (this.advantageAt(assistTarget.pos.x, assistTarget.pos.y) < 1.05 || view.enemyStructureCovering(assistTarget.pos, 1)) return ((this.assistBanUntil = time + 3), !1)
      ;((this.assistId = assistTarget.id), (this.assistUntil = time + 2.5))
    }
    return (this.travel(assistTarget.pos.x, assistTarget.pos.y, 2.5), (this.label = "assist"), !0)
  }
}

export { HeroAgent, KILL_WINDOW_SLACK_BY_HERO }