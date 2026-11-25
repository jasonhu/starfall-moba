/**
 * 战斗模拟主类
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { HeroAgent } from './hero-agent'
import { CAMP_BUFFER, LAST_HIT_AGGRO_WINDOW, clearDrakeBreath, beginDrakeBreath, MONSTER_REGEN_FRACTION, MONSTER_LEASH_GRACE, initJungleCamps, MONSTER_RESPAWN_HEAL_FRACTION, recomputeStats, resolveUnitOverlaps, updateDash, updateJungleCamps } from './unit-stats'
import { getPassiveFactory, COMBAT_MEMORY_WINDOW, NEARBY_QUERY_RADIUS, stopMovement, MAX_WINDUP_TIME, MONSTER_ACTIVE, MONSTER_DEAD, MONSTER_IDLE, MOVE_DIRECTION, MOVE_IDLE, RECENT_TARGET_WINDOW, TeamContext, createMinionUnit, setDirectionMove, updateMovement, canTarget, createBaseUnit, createCoreUnit, createTowerUnit, navigateToGoal, faceTowards, getPassive, isStructure, isTargetable, markNonEnumerable, moveTowards, setPathMove, startAction, tickCrowdControl, updateAreas, updateBushVisibility } from './combat-core'
import { applyDamage, findBuffByKey, MINION_AGGRO_QUERY_RADIUS, ATTACK_THINK_INTERVAL, EMBER_BURN_TICK_INTERVAL, ATTACK_TARGET_PADDING, EMBER_SLOW_DURATION, PERIODIC_CHECK_INTERVAL, applyStatusEffect, EMBER_BURN_DURATION, COMBAT_QUERY_BUFFER, refreshStructureInvulnerability, TOWER_FOCUS_DURATION } from './combat-behavior'
import { CORE_RULES, CORE_STATS, ECONOMY, JUNGLE_RULES, TOWER_RULES, WAVE_SCHEDULE } from '../game-balance'
import { hasActiveBuff, rejectCast, cancelAttackWindup, ALL_CAST_SLOT_IDS, removeBuff, refreshStatusFlags, STAT_MODIFYING_BUFF_IDS, isValidAimPoint, ATTACK_ACQUIRE_RANGE, invokeBuffRemoval, tryCastSkill, ATTACK_RANGE_TOLERANCE, ATTACK_TARGET_SEARCH_RADIUS, AUTO_BUY_CHECK_INTERVAL, cancelRecall, markRevealedOnAttack, RESPAWN_GUARD_DURATION } from './skill-cast'
import { pointSegmentDistanceSq, resolveDifficulty } from './skill-evaluation'
import { PolylineProjector, projectParamOnSegment } from '../world/lane-progress'
import { BaseAttackRange, ItemTable } from '../equipment'
import { getNextBuildItem, getEffectiveItemCost, isRecommendedItem, canBuyItem } from '../ui/shop-panel'
import { HERO_IDS } from '../../heroes/registry'
import { getClassicMapData } from '../fx/particle-system'
import { NavGrid } from '../world/nav-grid'
import { AREA_ALPHA_AGE_SCALE } from '../fx/emitters'

const makeHeroAgent = (view) => new HeroAgent(view)

let HeroAgentFactory = makeHeroAgent

function createHeroAgent(view) {
  return HeroAgentFactory(view)
}

function applyDrakeBreathCone(world, sourceUnit, breath) {
  const Value = world.grid.query(breath.pos.x, breath.pos.y, breath.radius, CAMP_BUFFER),
    halfAngle = breath.angle * 0.5,
    hitUnits = []
  for (let index = 0; index < Value; index++) {
    const selectedCAMP_BUFFER = CAMP_BUFFER[index]
    if (selectedCAMP_BUFFER.team === 2 || !isTargetable(selectedCAMP_BUFFER) || selectedCAMP_BUFFER.kind === "tower" || selectedCAMP_BUFFER.kind === "core") continue
    const offsetX = selectedCAMP_BUFFER.pos.x - breath.pos.x,
      offsetY = selectedCAMP_BUFFER.pos.y - breath.pos.y,
      distance = Math.hypot(offsetX, offsetY)
    if (!(distance > breath.radius + selectedCAMP_BUFFER.radius)) {
      if (distance > selectedCAMP_BUFFER.radius) {
        const cosAngle = (offsetX * breath.dir.x + offsetY * breath.dir.y) / distance
        if (Math.acos(cosAngle > 1 ? 1 : cosAngle < -1 ? -1 : cosAngle) > halfAngle + Math.asin(Math.min(1, selectedCAMP_BUFFER.radius / distance))) continue
      }
      hitUnits.push(selectedCAMP_BUFFER)
    }
  }
  for (const unit of hitUnits) unit.alive && applyDamage(world, sourceUnit, unit, breath.tickDamage, "magic", "skill")
}

function updateDrakeBreath(world, monster, deltaTime) {
  const breath = monster.mon.breath
  if (!breath) return !1
  const jUNGLE_RULES = JUNGLE_RULES,
    currentTime = world.state.time
  return (
    (breath.age += deltaTime),
    (monster.facing = Math.atan2(breath.dir.y, breath.dir.x)),
    !breath.spraying &&
      currentTime + 1e-9 >= breath.start + breath.warn &&
      ((breath.spraying = !0), world.fx("drake_breath", breath.pos, 2, { unitId: monster.id, dir: { x: breath.dir.x, y: breath.dir.y }, radius: breath.radius, angle: breath.angle, value: jUNGLE_RULES.breathTime })),
    breath.spraying && breath.ticksLeft > 0 && currentTime + 1e-9 >= breath.nextTick && (breath.ticksLeft--, (breath.nextTick += jUNGLE_RULES.breathTime / jUNGLE_RULES.breathTicks), applyDrakeBreathCone(world, monster, breath)),
    currentTime + 1e-9 >= breath.start + breath.duration ? (clearDrakeBreath(world, monster), monster.rt.atkCd < jUNGLE_RULES.breathRecover && (monster.rt.atkCd = jUNGLE_RULES.breathRecover), !1) : !0
  )
}

/**
 * 更新单位与怪物。
 *
 * @param world - 战场
 * @param monster - 输入
 * @param deltaTime - 第三输入
 */
function updateMonsterUnit(world, monster, deltaTime) {
  const runtime = monster.rt,
    monsterData = monster.mon,
    stats = monster.stats
  if ((advanceBasicAttackWindup(world, monster, deltaTime), monsterData.breath && updateDrakeBreath(world, monster, deltaTime))) return
  if (runtime.dash) {
    updateDash(world, monster, deltaTime)
    return
  }
  if (runtime.stunned) return
  const campDefense = monsterData.camp.def
  if ((monsterData.state !== MONSTER_ACTIVE ? (monsterData.specialAt = -1) : monsterData.specialAt < 0 && monster.monsterType === "abyss_drake" && (monsterData.specialAt = world.state.time + JUNGLE_RULES.breathFirst), monsterData.state === MONSTER_ACTIVE)) {
    const getValue = world.byId.get(monster.targetId),
      leashRadius = JUNGLE_RULES.leash,
      campOffsetX = monster.pos.x - campDefense.pos.x,
      campOffsetY = monster.pos.y - campDefense.pos.y
    let targetInLeash = !!getValue && canTarget(monster, getValue) && campOffsetX * campOffsetX + campOffsetY * campOffsetY <= leashRadius * leashRadius
    if (targetInLeash && getValue) {
      const targetCampOffsetX = getValue.pos.x - campDefense.pos.x,
        targetCampOffsetY = getValue.pos.y - campDefense.pos.y,
        leashWithGrace = leashRadius + MONSTER_LEASH_GRACE
      targetInLeash = targetCampOffsetX * targetCampOffsetX + targetCampOffsetY * targetCampOffsetY <= leashWithGrace * leashWithGrace
    }
    if (targetInLeash && getValue) {
      if (monsterData.specialAt >= 0 && world.state.time >= monsterData.specialAt && runtime.windupLeft <= 0) {
        const triggerRadius = JUNGLE_RULES.breathRadius - 1,
          targetOffsetX = getValue.pos.x - monster.pos.x,
          targetOffsetY = getValue.pos.y - monster.pos.y
        if (targetOffsetX * targetOffsetX + targetOffsetY * targetOffsetY <= triggerRadius * triggerRadius) {
          beginDrakeBreath(world, monster, getValue)
          return
        }
      }
      engageTarget(world, monster, getValue, deltaTime, !0)
      return
    }
    if (campOffsetX * campOffsetX + campOffsetY * campOffsetY <= leashRadius * leashRadius) {
      const Result = world.byId.get(runtime.lastAttackerId)
      if (Result && Result !== getValue && Result.team !== 2 && canTarget(monster, Result) && world.state.time - monster.lastHitTime < LAST_HIT_AGGRO_WINDOW) {
        const attackerCampOffsetX = Result.pos.x - campDefense.pos.x,
          attackerCampOffsetY = Result.pos.y - campDefense.pos.y
        if (attackerCampOffsetX * attackerCampOffsetX + attackerCampOffsetY * attackerCampOffsetY <= leashRadius * leashRadius) {
          ;(cancelAttackWindup(monster), (monster.targetId = Result.id))
          return
        }
      }
    }
    ;(cancelAttackWindup(monster), (monsterData.state = MONSTER_DEAD), (monster.targetId = -1))
  }
  const homeOffsetX = monsterData.home.x - monster.pos.x,
    homeOffsetY = monsterData.home.y - monster.pos.y,
    homeDistanceSquared = homeOffsetX * homeOffsetX + homeOffsetY * homeOffsetY
  if (monsterData.state === MONSTER_DEAD) {
    ;(monster.hp < stats.maxHp && (monster.hp = Math.min(stats.maxHp, monster.hp + stats.maxHp * MONSTER_RESPAWN_HEAL_FRACTION * deltaTime)),
      homeDistanceSquared > 0.3 * 0.3 ? runtime.rooted || navigateToGoal(world, monster, monsterData.home.x, monsterData.home.y, deltaTime) : ((monsterData.state = MONSTER_IDLE), (monster.facing = Math.atan2(-monsterData.home.y, -monsterData.home.x))))
    return
  }
  ;(monster.hp < stats.maxHp && (monster.hp = Math.min(stats.maxHp, monster.hp + stats.maxHp * MONSTER_REGEN_FRACTION * deltaTime)), homeDistanceSquared > 0.6 * 0.6 && !runtime.rooted && moveTowards(world, monster, monsterData.home.x, monsterData.home.y, deltaTime))
}

function spawnProjectile(world, visual, owner, position, team) {
  const idConfig = {
    id: world.allocId(),
    visual: visual,
    team: team,
    ownerId: owner.id,
    pos: { x: position.x, y: position.y },
    prevPos: { x: position.x, y: position.y },
    dir: { x: 1, y: 0 },
    speed: 0,
    radius: 0.25,
    targetId: -1,
    traveled: 0,
    maxRange: 0,
    homing: !1,
    pierce: !1,
    dead: !1,
    filter: null,
    hitIds: [],
    onHit: null,
    onEnd: null,
    basic: !1,
    ad: 0,
    dtype: "physical",
    vsStructure: 1,
    vsMinion: 1,
  }
  return (markNonEnumerable(idConfig, "filter", "onHit", "onEnd", "hitIds"), world.projectiles.push(idConfig), world.emit({ type: "projectileSpawn", id: idConfig.id, visual: visual, pos: { x: position.x, y: position.y }, ownerId: owner.id }), idConfig)
}

function spawnHomingProjectile(world, spawnSpec) {
  const spawnProjectileValue = spawnProjectile(world, spawnSpec.visual, spawnSpec.owner, spawnSpec.from, spawnSpec.owner.team)
  ;((spawnProjectileValue.homing = !0), (spawnProjectileValue.speed = Math.max(1, spawnSpec.speed)), (spawnProjectileValue.radius = spawnSpec.radius ?? 0.25), (spawnProjectileValue.targetId = spawnSpec.target.id), (spawnProjectileValue.onHit = spawnSpec.onHit ?? null), (spawnProjectileValue.onEnd = spawnSpec.onEnd ?? null))
  const offsetX = spawnSpec.target.pos.x - spawnSpec.from.x,
    offsetY = spawnSpec.target.pos.y - spawnSpec.from.y,
    distance = Math.hypot(offsetX, offsetY)
  return (distance > 1e-6 && ((spawnProjectileValue.dir.x = offsetX / distance), (spawnProjectileValue.dir.y = offsetY / distance)), spawnProjectileValue)
}

function endProjectile(world, projectile) {
  projectile.dead || ((projectile.dead = !0), world.emit({ type: "projectileEnd", id: projectile.id, visual: projectile.visual, pos: { x: projectile.pos.x, y: projectile.pos.y } }), projectile.onEnd && projectile.onEnd(world, projectile))
}

function hitProjectile(world, projectile, target) {
  return (world.emit({ type: "projectileHit", id: projectile.id, visual: projectile.visual, pos: { x: projectile.pos.x, y: projectile.pos.y }, targetId: target.id }), projectile.onHit ? projectile.onHit(world, projectile, target) === !0 : !1)
}

function isValidAttackTarget(attacker, candidate) {
  return candidate.team !== attacker.team && (candidate.kind === "hero" || candidate.kind === "minion" || candidate.kind === "monster") && isTargetable(candidate)
}

const PROJECTILE_QUERY_SCRATCH = [],
  PROJECTILE_HIT_SCRATCH = [],
  PROJECTILE_PARAM_SCRATCH = []

function updateHomingProjectile(world, updateValue, deltaTime) {
  const target = world.byId.get(updateValue.targetId)
  if (!target || !target.alive || target.rt.untargetable) {
    endProjectile(world, updateValue)
    return
  }
  const offsetX = target.pos.x - updateValue.pos.x,
    offsetY = target.pos.y - updateValue.pos.y,
    distance = Math.hypot(offsetX, offsetY),
    stepDistance = updateValue.speed * deltaTime
  if (distance <= stepDistance + target.radius * 0.5) {
    ;((updateValue.pos.x = target.pos.x), (updateValue.pos.y = target.pos.y), (updateValue.traveled += distance), hitProjectile(world, updateValue, target), endProjectile(world, updateValue))
    return
  }
  ;((updateValue.dir.x = offsetX / distance), (updateValue.dir.y = offsetY / distance), (updateValue.pos.x += updateValue.dir.x * stepDistance), (updateValue.pos.y += updateValue.dir.y * stepDistance), (updateValue.traveled += stepDistance))
}

function updateLinearProjectile(world, updateResult, deltaTime) {
  const remainingRange = updateResult.maxRange - updateResult.traveled,
    stepDistance = Math.min(updateResult.speed * deltaTime, remainingRange),
    coordX = updateResult.pos.x,
    coordY = updateResult.pos.y,
    endX = coordX + updateResult.dir.x * stepDistance,
    endY = coordY + updateResult.dir.y * stepDistance,
    queryValue = world.grid.query((coordX + endX) * 0.5, (coordY + endY) * 0.5, stepDistance * 0.5 + updateResult.radius, PROJECTILE_QUERY_SCRATCH)
  ;((PROJECTILE_HIT_SCRATCH.length = 0), (PROJECTILE_PARAM_SCRATCH.length = 0))
  for (let index = 0; index < queryValue; index++) {
    const selectedPROJECTILE_QUERY_SCRATCH = PROJECTILE_QUERY_SCRATCH[index]
    if (!selectedPROJECTILE_QUERY_SCRATCH.alive || selectedPROJECTILE_QUERY_SCRATCH.id === updateResult.ownerId || updateResult.hitIds.indexOf(selectedPROJECTILE_QUERY_SCRATCH.id) >= 0 || (updateResult.filter ? !updateResult.filter(selectedPROJECTILE_QUERY_SCRATCH) : !isValidAttackTarget(updateResult, selectedPROJECTILE_QUERY_SCRATCH))) continue
    const hitRadius = updateResult.radius + selectedPROJECTILE_QUERY_SCRATCH.radius
    if (pointSegmentDistanceSq(selectedPROJECTILE_QUERY_SCRATCH.pos.x, selectedPROJECTILE_QUERY_SCRATCH.pos.y, coordX, coordY, endX, endY) > hitRadius * hitRadius) continue
    const projectParamOnSegmentResult = projectParamOnSegment(selectedPROJECTILE_QUERY_SCRATCH.pos.x, selectedPROJECTILE_QUERY_SCRATCH.pos.y, coordX, coordY, endX, endY)
    let count = PROJECTILE_HIT_SCRATCH.length
    for (PROJECTILE_HIT_SCRATCH.push(selectedPROJECTILE_QUERY_SCRATCH), PROJECTILE_PARAM_SCRATCH.push(projectParamOnSegmentResult); count > 0 && PROJECTILE_PARAM_SCRATCH[count - 1] > projectParamOnSegmentResult;) ((PROJECTILE_HIT_SCRATCH[count] = PROJECTILE_HIT_SCRATCH[count - 1]), (PROJECTILE_PARAM_SCRATCH[count] = PROJECTILE_PARAM_SCRATCH[count - 1]), count--)
    ;((PROJECTILE_HIT_SCRATCH[count] = selectedPROJECTILE_QUERY_SCRATCH), (PROJECTILE_PARAM_SCRATCH[count] = projectParamOnSegmentResult))
  }
  if (PROJECTILE_HIT_SCRATCH.length > 0) {
    const hitTargets = PROJECTILE_HIT_SCRATCH.slice(),
      hitSegmentParams = PROJECTILE_PARAM_SCRATCH.slice()
    for (let hitIndex = 0; hitIndex < hitTargets.length; hitIndex++) {
      const selectedF = hitTargets[hitIndex]
      if (!selectedF.alive) continue
      ;(updateResult.hitIds.push(selectedF.id), (updateResult.pos.x = coordX + (endX - coordX) * hitSegmentParams[hitIndex]), (updateResult.pos.y = coordY + (endY - coordY) * hitSegmentParams[hitIndex]))
      const hitProjectileResult = hitProjectile(world, updateResult, selectedF)
      if (updateResult.dead) return
      if (hitProjectileResult || !updateResult.pierce) {
        ;((updateResult.traveled += stepDistance * hitSegmentParams[hitIndex]), endProjectile(world, updateResult))
        return
      }
    }
  }
  ;((updateResult.pos.x = endX), (updateResult.pos.y = endY), (updateResult.traveled += stepDistance), updateResult.traveled >= updateResult.maxRange - 1e-6 && endProjectile(world, updateResult))
}

function updateProjectiles(world, deltaTime) {
  const projectiles = world.projectiles,
    lengthValue = projectiles.length
  for (let index = 0; index < lengthValue; index++) {
    const selectedE = projectiles[index]
    selectedE.dead || ((selectedE.prevPos.x = selectedE.pos.x), (selectedE.prevPos.y = selectedE.pos.y), selectedE.homing ? updateHomingProjectile(world, selectedE, deltaTime) : updateLinearProjectile(world, selectedE, deltaTime))
  }
  let writeIndex = 0
  for (let scanIndex = 0; scanIndex < projectiles.length; scanIndex++) {
    const projectile = projectiles[scanIndex]
    projectile.dead || (projectiles[writeIndex++] = projectile)
  }
  projectiles.length = writeIndex
}

/**
 * 处理目标。
 *
 * @param world - 战场
 * @param unit - 输入
 */
function selectAttackTarget(world, unit) {
  const attackRange = unit.stats.attackRange,
    recentCutoff = world.state.time - RECENT_TARGET_WINDOW
  let isActive = !1,
    recentHeroTarget = null,
    nearestRecentHeroDist = 1 / 0,
    bestMinionTarget = null,
    bestMinionScore = 1 / 0,
    fallbackHero = null,
    fallbackHeroDist = 1 / 0
  const nearbyCount = world.grid.query(unit.pos.x, unit.pos.y, Math.max(attackRange, MINION_AGGRO_QUERY_RADIUS), COMBAT_QUERY_BUFFER)
  for (let index = 0; index < nearbyCount; index++) {
    const selectedCOMBAT_QUERY_BUFFER = COMBAT_QUERY_BUFFER[index]
    if (!selectedCOMBAT_QUERY_BUFFER.alive || selectedCOMBAT_QUERY_BUFFER.team === unit.team || selectedCOMBAT_QUERY_BUFFER.team === 2) continue
    const distance = Math.hypot(selectedCOMBAT_QUERY_BUFFER.pos.x - unit.pos.x, selectedCOMBAT_QUERY_BUFFER.pos.y - unit.pos.y)
    if ((selectedCOMBAT_QUERY_BUFFER.kind === "minion" && distance <= MINION_AGGRO_QUERY_RADIUS && (isActive = !0), !(distance - selectedCOMBAT_QUERY_BUFFER.radius > attackRange || !canTarget(unit, selectedCOMBAT_QUERY_BUFFER)))) {
      if (selectedCOMBAT_QUERY_BUFFER.kind === "hero") (selectedCOMBAT_QUERY_BUFFER.rt.hitHeroTime >= recentCutoff && distance < nearestRecentHeroDist && ((recentHeroTarget = selectedCOMBAT_QUERY_BUFFER), (nearestRecentHeroDist = distance)), distance < fallbackHeroDist && ((fallbackHero = selectedCOMBAT_QUERY_BUFFER), (fallbackHeroDist = distance)))
      else if (selectedCOMBAT_QUERY_BUFFER.kind === "minion") {
        const minionScore = distance + (selectedCOMBAT_QUERY_BUFFER.minionType === "siege" || selectedCOMBAT_QUERY_BUFFER.minionType === "super" ? 0 : 1e3)
        minionScore < bestMinionScore && ((bestMinionTarget = selectedCOMBAT_QUERY_BUFFER), (bestMinionScore = minionScore))
      }
    }
  }
  unit.rt.backdoor = !isActive
  const currentTarget = unit.targetId >= 0 ? world.byId.get(unit.targetId) : void 0,
    isCurrentTargetValid = !!currentTarget && canTarget(unit, currentTarget) && Math.hypot(currentTarget.pos.x - unit.pos.x, currentTarget.pos.y - unit.pos.y) - currentTarget.radius <= attackRange
  if (recentHeroTarget && !(isCurrentTargetValid && currentTarget && currentTarget.kind === "hero" && currentTarget.rt.hitHeroTime >= recentCutoff)) unit.targetId = recentHeroTarget.id
  else if (!isCurrentTargetValid) {
    const chosenTarget = bestMinionTarget ?? fallbackHero
    unit.targetId = chosenTarget ? chosenTarget.id : -1
  }
}

/**
 * 更新单位。
 *
 * @param world - 战场
 * @param unit - 输入
 * @param deltaTime - 第三输入
 */
function updateCombatUnit(world, unit, deltaTime) {
  const rtValue = unit.rt,
    currentTime = world.state.time
  if ((advanceBasicAttackWindup(world, unit, deltaTime), currentTime >= rtValue.thinkAt && ((rtValue.thinkAt = currentTime + ATTACK_THINK_INTERVAL), selectAttackTarget(world, unit)), unit.targetId >= 0)) {
    const target = world.byId.get(unit.targetId)
    target && canTarget(unit, target) ? engageTarget(world, unit, target, deltaTime, !1) : (unit.targetId = -1)
  }
  unit.kind === "core" && unit.hp < unit.stats.maxHp && currentTime - unit.lastHitTime >= CORE_STATS.regenDelay && (unit.hp = Math.min(unit.stats.maxHp, unit.hp + CORE_STATS.regen * deltaTime))
}

function updateFountain(world, deltaTime) {
  const state = world.state,
    bases = world.map.bases
  for (const hero of world.heroes) {
    if (!hero.alive) continue
    const selectedS = bases[hero.team],
      heroOffsetX = hero.pos.x - selectedS.fountain.x,
      heroOffsetY = hero.pos.y - selectedS.fountain.y
    if (heroOffsetX * heroOffsetX + heroOffsetY * heroOffsetY > selectedS.fountainRadius * selectedS.fountainRadius) continue
    const stats = hero.stats
    ;(hero.hp < stats.maxHp && (hero.hp = Math.min(stats.maxHp, hero.hp + stats.maxHp * CORE_RULES.regenRatio * deltaTime)), hero.mana < stats.maxMana && (hero.mana = Math.min(stats.maxMana, hero.mana + stats.maxMana * CORE_RULES.regenRatio * deltaTime)))
    const findBuffByKeyResult = findBuffByKey(hero, "fountain")
    findBuffByKeyResult ? (findBuffByKeyResult.timeLeft = 0.3) : applyStatusEffect(world, hero, "fountain", { duration: 0.3 })
  }
  if (state.tick % Math.round(PERIODIC_CHECK_INTERVAL / deltaTime) === 0)
    for (const base of bases) {
      if (world.grid.query(base.fountain.x, base.fountain.y, base.fountainRadius, COMBAT_QUERY_BUFFER) === 0) continue
      const nearbyUnits = COMBAT_QUERY_BUFFER.slice()
      for (const enemyUnit of nearbyUnits) {
        if (!enemyUnit.alive || enemyUnit.team === base.team || enemyUnit.team === 2) continue
        const enemyOffsetX = enemyUnit.pos.x - base.fountain.x,
          enemyOffsetY = enemyUnit.pos.y - base.fountain.y
        enemyOffsetX * enemyOffsetX + enemyOffsetY * enemyOffsetY > base.fountainRadius * base.fountainRadius || applyDamage(world, null, enemyUnit, enemyUnit.stats.maxHp * CORE_RULES.enemyDamageRatio, "true", "env")
      }
    }
}

function isInAttackRange(attacker, target, rangePadding = 0) {
  const effectiveRange = attacker.stats.attackRange + target.radius + rangePadding,
    offsetX = attacker.pos.x - target.pos.x,
    offsetY = attacker.pos.y - target.pos.y
  return offsetX * offsetX + offsetY * offsetY <= effectiveRange * effectiveRange
}

function canBasicAttack(world, unit) {
  const runtime = unit.rt,
    currentTime = world.state.time
  return unit.alive && !runtime.stunned && runtime.dash === null && runtime.windupLeft <= 0 && runtime.atkCd <= 0 && currentTime >= runtime.lockUntil && currentTime >= runtime.disarmUntil
}

function startBasicAttack(world, hero, target) {
  const runtime = hero.rt,
    attackInterval = 1 / Math.max(0.1, hero.stats.attackSpeed),
    attackActionTime = Math.min(attackInterval, MAX_WINDUP_TIME)
  if (
    ((runtime.atkCd = attackInterval),
    (runtime.windupLeft = attackActionTime * runtime.atk.windup),
    (runtime.windupTarget = target.id),
    (hero.targetId = target.id),
    faceTowards(hero, target.pos.x, target.pos.y),
    startAction(world, hero, "attack", attackActionTime, !0),
    world.emit({ type: "attack", unitId: hero.id, targetId: target.id }),
    hero.kind === "hero")
  ) {
    hasActiveBuff(hero, "recall") && removeBuff(world, hero, "recall")
    const hooks = hero.h.hooks
    for (let index = 0; index < hooks.length; index++) {
      const selectedO = hooks[index]
      selectedO.onBasicAttackStart && selectedO.onBasicAttackStart(world, hero, target)
    }
  }
}

function advanceBasicAttackWindup(world, unit, deltaTime) {
  const runtime = unit.rt
  if ((runtime.atkCd > 0 && (runtime.atkCd -= deltaTime), runtime.windupLeft <= 0)) return
  const target = world.byId.get(runtime.windupTarget)
  if (runtime.stunned || !target || !canTarget(unit, target) || !isInAttackRange(unit, target, ATTACK_TARGET_PADDING)) {
    cancelAttackWindup(unit)
    return
  }
  if (((runtime.windupLeft -= deltaTime), runtime.windupLeft > 1e-9)) return
  ;((runtime.windupLeft = 0), (runtime.windupTarget = -1), markRevealedOnAttack(world, unit))
  const attack = runtime.atk
  if (attack.visual) {
    const spawnHomingProjectileValue = spawnHomingProjectile(world, { visual: attack.visual, owner: unit, from: unit.pos, target: target, speed: attack.projSpeed, onHit: onBasicAttackProjectileHit })
    ;((spawnHomingProjectileValue.basic = !0), (spawnHomingProjectileValue.ad = unit.stats.ad), (spawnHomingProjectileValue.dtype = attack.dtype), (spawnHomingProjectileValue.vsStructure = attack.vsStructure), (spawnHomingProjectileValue.vsMinion = attack.vsMinion))
  } else dealBasicAttack(world, unit, target, unit.stats.ad, attack.dtype, attack.vsStructure, attack.vsMinion)
}

function onBasicAttackProjectileHit(world, projectile, target) {
  const owner = world.byId.get(projectile.ownerId) ?? null
  dealBasicAttack(world, owner, target, projectile.ad, projectile.dtype, projectile.vsStructure, projectile.vsMinion)
}

function onEmberBurnTick(world, target, burnBuff) {
  applyDamage(world, world.byId.get(burnBuff.sourceId) ?? null, target, burnBuff.value, "true", "dot")
}

const DAMAGE_MODIFIERS = { mult: 1, bonus: 0, bonusPhysical: 0, bonusMagic: 0, bonusTrue: 0, forceCrit: !1, noCrit: !1 }

/**
 * 处理英雄。
 *
 * @param world - 主要输入
 * @param hero - 英雄
 * @param target - 输入
 */
function resolveHeroBasicAttack(world, hero, target) {
  ;((DAMAGE_MODIFIERS.mult = 1), (DAMAGE_MODIFIERS.bonus = 0), (DAMAGE_MODIFIERS.bonusPhysical = 0), (DAMAGE_MODIFIERS.bonusMagic = 0), (DAMAGE_MODIFIERS.bonusTrue = 0), (DAMAGE_MODIFIERS.forceCrit = !1), (DAMAGE_MODIFIERS.noCrit = !1))
  const hooks = hero.h.hooks
  for (let index = 0; index < hooks.length; index++) {
    const modifyHook = hooks[index]
    modifyHook.modifyBasicAttack && modifyHook.modifyBasicAttack(world, hero, target, DAMAGE_MODIFIERS)
  }
  const stats = hero.stats,
    isStructureResult = isStructure(target),
    isCrit = !DAMAGE_MODIFIERS.noCrit && !isStructureResult && (DAMAGE_MODIFIERS.forceCrit || (stats.critChance > 0 && world.rng.next() < stats.critChance)),
    damage = stats.ad * DAMAGE_MODIFIERS.mult * (isCrit ? stats.critDamage : 1) + DAMAGE_MODIFIERS.bonus,
    bonusPhysical = DAMAGE_MODIFIERS.bonusPhysical,
    bonusMagic = DAMAGE_MODIFIERS.bonusMagic,
    bonusTrue = DAMAGE_MODIFIERS.bonusTrue,
    damageType = hero.rt.atk.dtype
  world.fx(isCrit ? "hit_crit" : damageType === "magic" ? "hit_magic" : "hit_physical", target.pos, hero.team, { unitId: hero.id, targetId: target.id })
  const applyDamageResult = applyDamage(world, hero, target, damage, damageType, "basic", null, isCrit)
  ;(bonusPhysical > 0 && applyDamage(world, hero, target, bonusPhysical, "physical", "proc"),
    bonusMagic > 0 && applyDamage(world, hero, target, bonusMagic, "magic", "proc"),
    bonusTrue > 0 && applyDamage(world, hero, target, bonusTrue, "true", "proc"),
    !isStructureResult &&
      target.alive &&
      hasActiveBuff(hero, "ember_might") &&
      (applyStatusEffect(world, target, "burn", { sourceId: hero.id, duration: EMBER_BURN_DURATION, merge: "replace", key: "ember", value: JUNGLE_RULES.emberBurnBase + JUNGLE_RULES.emberBurnPerLevel * hero.level, tickInterval: EMBER_BURN_TICK_INTERVAL, onTick: onEmberBurnTick }),
      applyStatusEffect(world, target, "slow", { sourceId: hero.id, duration: EMBER_SLOW_DURATION, value: JUNGLE_RULES.emberSlow, key: "ember" })))
  for (let hookIndex = 0; hookIndex < hooks.length; hookIndex++) {
    const hitHook = hooks[hookIndex]
    hitHook.onBasicAttackHit && hitHook.onBasicAttackHit(world, hero, target, applyDamageResult, isCrit)
  }
}

function dealBasicAttack(world, attacker, target, damage, magicKind, structureMult, minionMult) {
  if (!target.alive) return
  if (attacker && attacker.kind === "hero") {
    resolveHeroBasicAttack(world, attacker, target)
    return
  }
  let finalDamage = damage
  isStructure(target) && (finalDamage *= structureMult)
  let hitEffectType = magicKind === "magic" ? "hit_magic" : "hit_physical"
  if (attacker && isStructure(attacker)) {
    if (((hitEffectType = "hit_tower"), target.kind === "minion")) finalDamage *= TOWER_RULES.minionMult
    else if (target.kind === "hero") {
      const textValue = `t${attacker.id}`,
        towerFocusBuff = findBuffByKey(target, "tower_focus", textValue)
      ;((finalDamage *= 1 + Math.min(TOWER_RULES.rampMax, TOWER_RULES.rampPerHit * (towerFocusBuff ? towerFocusBuff.stacks : 0))),
        applyStatusEffect(world, target, "tower_focus", { sourceId: attacker.id, duration: TOWER_FOCUS_DURATION, key: textValue, stacks: 1, maxStacks: Math.max(1, Math.round(TOWER_RULES.rampMax / TOWER_RULES.rampPerHit)) }))
    }
  } else target.kind === "minion" && (finalDamage *= minionMult)
  ;(world.fx(hitEffectType, target.pos, attacker ? attacker.team : 2, { targetId: target.id }), applyDamage(world, attacker, target, finalDamage, magicKind, "basic"))
}

/**
 * 处理目标。
 *
 * @param world - 战场
 * @param unit - 输入
 * @param target - 第三输入
 * @param deltaTime - 第四输入
 * @param canChase - 附加输入
 */
function engageTarget(world, unit, target, deltaTime, canChase) {
  const runtime = unit.rt
  return runtime.windupLeft > 0
    ? !0
    : isInAttackRange(unit, target)
      ? (canBasicAttack(world, unit) ? startBasicAttack(world, unit, target) : world.state.time >= runtime.lockUntil && !runtime.stunned && faceTowards(unit, target.pos.x, target.pos.y), !0)
      : (canChase && !runtime.rooted && !runtime.stunned && runtime.dash === null && world.state.time >= runtime.lockUntil && navigateToGoal(world, unit, target.pos.x, target.pos.y, deltaTime), !1)
}

const BUFF_TICK_SCRATCH = [],
  BUFF_EXPIRE_SCRATCH = []

/**
 * 处理状态效果。
 *
 * @param world - 主要输入
 * @param unit - 输入
 * @param deltaTime - 第三输入
 */
function tickBuffs(world, unit, deltaTime) {
  const buffs = unit.buffs
  if (buffs.length === 0) return
  ;((BUFF_TICK_SCRATCH.length = 0), (BUFF_EXPIRE_SCRATCH.length = 0))
  for (let index = 0; index < buffs.length; index++) {
    const buff = buffs[index]
    ;(buff.tickInterval > 0 && buff.onTick && ((buff.tickLeft -= deltaTime), buff.tickLeft <= 1e-9 && ((buff.tickLeft += buff.tickInterval), BUFF_TICK_SCRATCH.push(buff))), (buff.timeLeft -= deltaTime), buff.timeLeft <= 1e-9 && BUFF_EXPIRE_SCRATCH.push(buff))
  }
  if (BUFF_TICK_SCRATCH.length === 0 && BUFF_EXPIRE_SCRATCH.length === 0) return
  const tickingBuffs = BUFF_TICK_SCRATCH.length > 0 ? BUFF_TICK_SCRATCH.slice() : null,
    expiringBuffs = BUFF_EXPIRE_SCRATCH.length > 0 ? BUFF_EXPIRE_SCRATCH.slice() : null
  if (tickingBuffs)
    for (const tickingBuff of tickingBuffs) {
      if (!unit.alive) return
      buffs.indexOf(tickingBuff) >= 0 && tickingBuff.onTick && tickingBuff.onTick(world, unit, tickingBuff)
    }
  if (expiringBuffs) {
    let statsChanged = !1
    for (const expiringBuff of expiringBuffs) {
      if (!unit.alive) return
      const expiringBuffIndex = buffs.indexOf(expiringBuff)
      expiringBuffIndex < 0 || expiringBuff.timeLeft > 1e-9 || (buffs.splice(expiringBuffIndex, 1), refreshStatusFlags(unit), expiringBuff.onExpire && expiringBuff.onExpire(world, unit, expiringBuff), invokeBuffRemoval(world, unit, expiringBuff), (unit.kind === "hero" || STAT_MODIFYING_BUFF_IDS.has(expiringBuff.id)) && (statsChanged = !0))
    }
    statsChanged && unit.alive && recomputeStats(world, unit)
  }
}

/**
 * 处理装备。
 *
 * @param hero - 英雄
 */
function rebuildItemHooks(hero) {
  const hooks = [],
    PassiveFactoryValue = getPassiveFactory(hero.heroId)
  PassiveFactoryValue && hooks.push(PassiveFactoryValue)
  const seenPassives = new Set()
  for (const itemId of hero.items) {
    if (!itemId) continue
    const selectedItemTable = ItemTable[itemId]
    if (!selectedItemTable.passive || seenPassives.has(selectedItemTable.passive.id)) continue
    const PassiveValue = getPassive(selectedItemTable)
    PassiveValue && (seenPassives.add(selectedItemTable.passive.id), hooks.push(PassiveValue))
  }
  hero.h.hooks = hooks
}

function refreshAfterItemChange(world, hero) {
  ;(rebuildItemHooks(hero), recomputeStats(world, hero))
}

/**
 * 处理装备。
 *
 * @param world - 主要输入
 * @param hero - 次要输入
 * @param itemId - 元素
 * @param isAuto - 第四输入
 */
function buyItem(world, hero, itemId, isAuto = !1) {
  const itemConfig = ItemTable[itemId]
  if (!itemConfig) return !1
  const items = hero.items
  let cost = itemConfig.cost,
    slotIndex = -1
  if (itemConfig.category === "boots") {
    const findIndexResult = items.findIndex((itemId) => itemId !== null && ItemTable[itemId].category === "boots")
    if (findIndexResult >= 0) {
      const existingBoots = ItemTable[items[findIndexResult]]
      if (itemConfig.tier === 1 || existingBoots.id === itemConfig.id) return rejectCast(world, hero, "full", isAuto)
      ;((slotIndex = findIndexResult), (cost -= Math.floor(existingBoots.cost * BaseAttackRange)))
    }
  }
  return (
    slotIndex < 0 && (slotIndex = items.indexOf(null)),
    slotIndex < 0
      ? rejectCast(world, hero, "full", isAuto)
      : hero.gold < cost
        ? rejectCast(world, hero, "gold", isAuto)
        : ((hero.gold -= cost), (items[slotIndex] = itemId), refreshAfterItemChange(world, hero), isAuto ? world.emit({ type: "itemBought", unitId: hero.id, itemId: itemId, auto: !0 }) : world.emit({ type: "itemBought", unitId: hero.id, itemId: itemId }), !0)
  )
}

/**
 * 处理装备。
 *
 * @param world - 主要输入
 * @param hero - 英雄
 * @param slotIndex - 索引
 */
function sellItem(world, hero, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= hero.items.length) return !1
  const selectedItems = hero.items[slotIndex]
  return selectedItems ? ((hero.gold += Math.floor(ItemTable[selectedItems].cost * BaseAttackRange)), (hero.items[slotIndex] = null), hero.autoBuy && isRecommendedItem(hero.heroId, selectedItems) && (hero.autoBuy = !1), refreshAfterItemChange(world, hero), !0) : !1
}

function autoBuyNextItem(world, hero) {
  const NextBuildItemValue = getNextBuildItem(hero)
  !NextBuildItemValue || !canBuyItem(hero, NextBuildItemValue) || hero.gold < getEffectiveItemCost(hero, NextBuildItemValue) || buyItem(world, hero, NextBuildItemValue, !0)
}

const TARGET_QUERY_SCRATCH = [],
  MINION_LOW_HP_RATIO = 0.35

function canOneShot(attacker, target) {
  return target.hp <= (attacker.stats.ad * 600) / (600 + target.stats.armor)
}

function targetPriority(attacker, candidate) {
  switch (candidate.kind) {
    case "hero":
      return 0
    case "minion":
      return canOneShot(attacker, candidate) || candidate.hp < candidate.stats.maxHp * MINION_LOW_HP_RATIO ? 1 : 3
    case "monster":
      return 4
    default:
      return 2
  }
}

/**
 * 处理目标。
 *
 * @param world - 主要输入
 * @param unit - 次要输入
 * @param searchPadding - 第三输入
 * @returns 数值结果
 */
function selectAttackTargetSmart(world, unit, searchPadding) {
  const attackRange = unit.stats.attackRange,
    nearbyCount = world.grid.query(unit.pos.x, unit.pos.y, attackRange + searchPadding, TARGET_QUERY_SCRATCH)
  let bestTarget = null,
    bestPriority = 1 / 0,
    bestScore = 1 / 0,
    nearbyTarget = null,
    nearestDist = 1 / 0
  for (let index = 0; index < nearbyCount; index++) {
    const selectedTARGET_QUERY_SCRATCH = TARGET_QUERY_SCRATCH[index]
    if (!canTarget(unit, selectedTARGET_QUERY_SCRATCH)) continue
    const distance = Math.hypot(selectedTARGET_QUERY_SCRATCH.pos.x - unit.pos.x, selectedTARGET_QUERY_SCRATCH.pos.y - unit.pos.y) - selectedTARGET_QUERY_SCRATCH.radius
    if (distance <= attackRange + ATTACK_RANGE_TOLERANCE) {
      const targetPriorityResult = targetPriority(unit, selectedTARGET_QUERY_SCRATCH)
      let targetScore
      ;(selectedTARGET_QUERY_SCRATCH.kind === "hero" ? (targetScore = selectedTARGET_QUERY_SCRATCH.hp / selectedTARGET_QUERY_SCRATCH.stats.maxHp) : selectedTARGET_QUERY_SCRATCH.kind === "minion" ? (targetScore = canOneShot(unit, selectedTARGET_QUERY_SCRATCH) ? selectedTARGET_QUERY_SCRATCH.hp - 1e6 : selectedTARGET_QUERY_SCRATCH.hp) : selectedTARGET_QUERY_SCRATCH.kind === "monster" ? (targetScore = selectedTARGET_QUERY_SCRATCH.hp) : (targetScore = distance),
        (targetPriorityResult < bestPriority || (targetPriorityResult === bestPriority && targetScore < bestScore)) && ((bestTarget = selectedTARGET_QUERY_SCRATCH), (bestPriority = targetPriorityResult), (bestScore = targetScore)))
    } else if (distance <= attackRange + searchPadding && distance < nearestDist) {
      if (selectedTARGET_QUERY_SCRATCH.kind === "monster" && distance > attackRange + ATTACK_ACQUIRE_RANGE) continue
      ;((nearestDist = distance), (nearbyTarget = selectedTARGET_QUERY_SCRATCH))
    }
  }
  return bestTarget ?? nearbyTarget
}

function commandAttack(world, hero, lookupKey) {
  const heroRef = hero.h
  cancelRecall(world, hero)
  let chosenTarget = null,
    isExplicit = !1
  if (lookupKey !== void 0 && lookupKey >= 0) {
    const specifiedTarget = world.byId.get(lookupKey)
    if (!specifiedTarget || !canTarget(hero, specifiedTarget)) {
      rejectCast(world, hero, "no_target")
      return
    }
    ;((chosenTarget = specifiedTarget), (isExplicit = !0))
  } else {
    const selectAttackTargetSmartResult = selectAttackTargetSmart(world, hero, ATTACK_TARGET_SEARCH_RADIUS)
    if (!selectAttackTargetSmartResult) return
    const currentTarget = heroRef.atkOrder ? world.byId.get(heroRef.atkTargetId) : void 0
    if (currentTarget && canTarget(hero, currentTarget) && (hero.rt.windupLeft > 0 || (isInAttackRange(hero, currentTarget, ATTACK_RANGE_TOLERANCE) && targetPriority(hero, currentTarget) <= targetPriority(hero, selectAttackTargetSmartResult)))) return
    chosenTarget = selectAttackTargetSmartResult
  }
  ;(heroRef.atkTargetId !== chosenTarget.id && cancelAttackWindup(hero), (heroRef.atkOrder = !0), (heroRef.atkTargetId = chosenTarget.id), (heroRef.atkExplicit = isExplicit), (hero.targetId = chosenTarget.id), stopMovement(hero))
}

/**
 * 处理目标。
 *
 * @param world - 主要输入
 * @param hero - 英雄
 * @param deltaTime - 第三输入
 */
function pursueAttackTarget(world, hero, deltaTime) {
  const hValue = hero.h
  let attackTarget = world.byId.get(hValue.atkTargetId)
  if (!attackTarget || !canTarget(hero, attackTarget)) {
    if (hero.rt.windupLeft > 0) return
    const acquiredTarget = selectAttackTargetSmart(world, hero, ATTACK_ACQUIRE_RANGE)
    if (!acquiredTarget) {
      ;((hValue.atkOrder = !1), (hero.targetId = -1))
      return
    }
    ;((hValue.atkTargetId = acquiredTarget.id), (hValue.atkExplicit = !1), (attackTarget = acquiredTarget))
  }
  ;((hero.targetId = attackTarget.id), engageTarget(world, hero, attackTarget, deltaTime, !0))
}

function clearAttackOrder(world, hero) {
  ;((hero.h.atkOrder = !1), (hero.targetId = -1), cancelAttackWindup(hero), cancelRecall(world, hero))
}

/**
 * 处理单位。
 *
 * @param world - 战场
 * @param hero - 英雄
 * @param command - 第三输入
 */
function handleUnitCommand(world, hero, command) {
  if (world.state.over) return
  if (command.type === "buy") {
    buyItem(world, hero, command.itemId)
    return
  }
  if (command.type === "sell") {
    sellItem(world, hero, command.index)
    return
  }
  if (command.type === "autoBuy") {
    hero.autoBuy = command.enabled === !0
    return
  }
  if (!hero.alive) return
  const runtime = hero.rt
  switch (command.type) {
    case "move": {
      const distance = isValidAimPoint(command.dir) ? Math.hypot(command.dir.x, command.dir.y) : 0
      if (!(distance > 0.05)) {
        runtime.moveMode === MOVE_DIRECTION && stopMovement(hero)
        return
      }
      ;(clearAttackOrder(world, hero), setDirectionMove(hero, command.dir.x / distance, command.dir.y / distance))
      return
    }
    case "moveTo":
      if (!isValidAimPoint(command.pos)) return
      ;(clearAttackOrder(world, hero), setPathMove(world, hero, command.pos.x, command.pos.y))
      return
    case "stop":
      ;(stopMovement(hero), (hero.h.atkOrder = !1), (hero.h.pendingCast = null), (hero.targetId = -1), cancelAttackWindup(hero))
      return
    case "attack":
      commandAttack(world, hero, command.targetId)
      return
    case "cast":
      tryCastSkill(world, hero, command)
      return
  }
}

/**
 * 处理英雄。
 *
 * @param world - 战场
 * @param hero - 英雄
 */
function respawnHero(world, hero) {
  const heroData = hero.h,
    runtime = hero.rt
  ;((hero.alive = !0),
    (hero.respawnIn = 0),
    (hero.pos.x = heroData.spawn.x),
    (hero.pos.y = heroData.spawn.y),
    (hero.prevPos.x = heroData.spawn.x),
    (hero.prevPos.y = heroData.spawn.y),
    (hero.facing = hero.team === 1 ? Math.PI * 0.75 : -Math.PI * 0.25),
    (hero.anim = "idle"),
    (hero.animStart = world.state.time),
    (hero.animDur = 0),
    (hero.targetId = -1),
    stopMovement(hero),
    (runtime.atkCd = 0),
    (runtime.windupLeft = 0),
    (runtime.lockUntil = 0),
    (runtime.disarmUntil = 0),
    (runtime.act = null),
    (runtime.revealUntil = -999),
    (heroData.atkOrder = !1),
    (heroData.pendingCast = null),
    recomputeStats(world, hero),
    (hero.hp = hero.stats.maxHp),
    (hero.mana = hero.stats.maxMana),
    world.grid.insert(hero),
    applyStatusEffect(world, hero, "respawn_guard", { duration: RESPAWN_GUARD_DURATION }),
    world.emit({ type: "respawn", unitId: hero.id, pos: { x: hero.pos.x, y: hero.pos.y } }),
    world.fx("respawn", hero.pos, hero.team, { unitId: hero.id }))
  for (const hook of heroData.hooks) hook.onSpawn && hook.onSpawn(world, hero)
}

function tickPassiveGold(world, hero, deltaTime) {
  const state = world.state,
    currentTime = state.time,
    heroData = hero.h,
    runtime = hero.rt
  if (currentTime >= 10 && ((heroData.goldFrac += ECONOMY.passiveGold * deltaTime), heroData.goldFrac >= 1)) {
    const goldGrant = Math.floor(heroData.goldFrac)
    ;((heroData.goldFrac -= goldGrant), (hero.gold += goldGrant), (hero.goldEarned += goldGrant), (state.teams[hero.team].gold += goldGrant))
  }
  for (let index = 0; index < ALL_CAST_SLOT_IDS.length; index++) {
    const selectedSkills = hero.skills[ALL_CAST_SLOT_IDS[index]]
    selectedSkills.cd > 0 && (selectedSkills.cd = selectedSkills.cd > deltaTime ? selectedSkills.cd - deltaTime : 0)
  }
  if (((hero.inCombat = currentTime - heroData.lastCombatTime < COMBAT_MEMORY_WINDOW), hero.autoBuy && (state.tick + heroData.index) % AUTO_BUY_CHECK_INTERVAL === 0 && autoBuyNextItem(world, hero), !hero.alive)) {
    ;((hero.respawnIn -= deltaTime), hero.respawnIn <= 1e-9 && respawnHero(world, hero))
    return
  }
  const stats = hero.stats
  ;(hero.hp < stats.maxHp && (hero.hp = Math.min(stats.maxHp, hero.hp + stats.hpRegen * deltaTime)), hero.mana < stats.maxMana && (hero.mana = Math.min(stats.maxMana, hero.mana + stats.manaRegen * deltaTime)))
  const blessingLeft = state.teams[hero.team].blessingLeft
  blessingLeft > 0.05 && !hasActiveBuff(hero, "star_blessing") && applyStatusEffect(world, hero, "star_blessing", { duration: blessingLeft, key: "team" })
  const hooks = heroData.hooks
  for (let hookIndex = 0; hookIndex < hooks.length; hookIndex++) {
    const selectedC = hooks[hookIndex]
    selectedC.onTick && selectedC.onTick(world, hero, deltaTime)
  }
  if (hero.alive) {
    if ((advanceBasicAttackWindup(world, hero, deltaTime), runtime.dash)) {
      updateDash(world, hero, deltaTime)
      return
    }
    if (!(runtime.stunned || currentTime < runtime.lockUntil)) {
      if (heroData.pendingCast) {
        const pendingCast = heroData.pendingCast
        if (((heroData.pendingCast = null), currentTime <= heroData.pendingUntil && (tryCastSkill(world, hero, pendingCast, !0), currentTime < runtime.lockUntil || runtime.dash !== null))) return
      }
      if (heroData.atkOrder) {
        pursueAttackTarget(world, hero, deltaTime)
        return
      }
      runtime.windupLeft > 0 || runtime.rooted || runtime.moveMode === MOVE_IDLE || updateMovement(world, hero, deltaTime)
    }
  }
}

function respawnUnit(world, hero) {
  ;(rebuildItemHooks(hero), recomputeStats(world, hero), (hero.hp = hero.stats.maxHp), (hero.mana = hero.stats.maxMana))
  for (const hook of hero.h.hooks) hook.onSpawn && hook.onSpawn(world, hero)
}

const MINION_LANE_NAMES = ["top", "mid", "bot"],
  MINION_INITIAL_THINK_DELAY = 0.25,
  MINION_WAYPOINT_STEP = 3,
  MINION_FAR_FROM_LANE = 9,
  MINION_AGGRO_RADIUS = NEARBY_QUERY_RADIUS + 3,
  MINION_LATERAL_OFFSETS = [-0.9, 0.9, 0, -1.7, 1.7, 0.5],
  scratchLanePoint = { x: 0, y: 0 },
  MINION_TARGET_QUERY_SCRATCH = []

/**
 * 创建小兵。
 *
 * @param world - 战场
 * @param team - 次要输入
 * @param lane - 第三输入
 * @param minionType - 第四输入
 * @param spawnIndex - 附加输入
 */
function spawnOneMinion(world, team, lane, minionType, spawnIndex) {
  if (world.state.over) return
  const selectedLanes = world.lanes[lane],
    selectedMinionSpawn = world.map.bases[team].minionSpawn[lane],
    projectResult = selectedLanes.project(selectedMinionSpawn.x, selectedMinionSpawn.y)
  selectedLanes.pointAt(projectResult, scratchLanePoint)
  const selectedMINION_LATERAL_OFFSETS = MINION_LATERAL_OFFSETS[spawnIndex % MINION_LATERAL_OFFSETS.length],
    xConfig = { x: selectedMinionSpawn.x - selectedLanes.ty * selectedMINION_LATERAL_OFFSETS, y: selectedMinionSpawn.y + selectedLanes.tx * selectedMINION_LATERAL_OFFSETS }
  world.nav.nearestFree(xConfig.x, xConfig.y, 0.8, xConfig)
  const MinionUnitValue = createMinionUnit(world, team, lane, minionType, xConfig)
  ;((MinionUnitValue.m.offset = selectedMINION_LATERAL_OFFSETS), (MinionUnitValue.facing = Math.atan2(selectedLanes.ty * MinionUnitValue.m.dir, selectedLanes.tx * MinionUnitValue.m.dir)), world.state.teams[team].blessingLeft > 0 && recomputeStats(world, MinionUnitValue), world.addUnit(MinionUnitValue), updateMinionUnit(world, MinionUnitValue), (MinionUnitValue.rt.thinkAt = world.state.time + MINION_INITIAL_THINK_DELAY))
}

/**
 * 创建小兵。
 *
 * @param world - 战场
 * @param waveNumber - 次要输入
 */
function spawnMinionWave(world, waveNumber) {
  const currentTime = world.state.time
  for (const team of [0, 1]) {
    const enemyTeam = team === 0 ? 1 : 0
    for (const lane of MINION_LANE_NAMES) {
      const minionTypes = []
      for (let index = 0; index < WAVE_SCHEDULE.melee; index++) minionTypes.push("melee")
      world.towers[enemyTeam][lane][2] === null && (minionTypes.push("super"), world.superAnnounced[team][lane] || ((world.superAnnounced[team][lane] = !0), world.emit({ type: "announce", key: "super_minions", team: team })))
      for (let rangedIndex = 0; rangedIndex < WAVE_SCHEDULE.ranged; rangedIndex++) minionTypes.push("ranged")
      ;(waveNumber >= WAVE_SCHEDULE.siegeEvery && waveNumber % WAVE_SCHEDULE.siegeEvery === 0 && minionTypes.push("siege"),
        minionTypes.forEach((minionType, spawnIndex) => {
          world.scheduler.at(currentTime + spawnIndex * WAVE_SCHEDULE.stagger, () => spawnOneMinion(world, team, lane, minionType, spawnIndex))
        }))
    }
  }
}

function updateWaveSpawner(world) {
  const state = world.state
  if (world.opts.noWaves) {
    state.nextWaveIn = 0
    return
  }
  ;(state.time + 1e-9 >= world.nextWaveAt &&
    (state.wave++, (world.nextWaveAt += WAVE_SCHEDULE.interval), spawnMinionWave(world, state.wave), world.emit({ type: "waveSpawn", wave: state.wave }), state.wave === 1 && world.emit({ type: "announce", key: "minions_spawn", team: 2 })),
    (state.nextWaveIn = Math.max(0, world.nextWaveAt - state.time)))
}

/**
 * 更新单位与小兵。
 *
 * @param world - 战场
 * @param minion - 输入
 */
function updateMinionUnit(world, minion) {
  const manaValue = minion.m,
    lane = world.lanes[minion.lane],
    laneProgress = lane.project(minion.pos.x, minion.pos.y),
    lateral = lane.lateral
  manaValue.offLane = lateral > 4
  const farFromLane = lateral > MINION_FAR_FROM_LANE,
    currentTarget = minion.targetId >= 0 ? world.byId.get(minion.targetId) : void 0
  let targetInRange = !1
  if (currentTarget && canTarget(minion, currentTarget)) {
    const targetOffsetX = currentTarget.pos.x - minion.pos.x,
      targetOffsetY = currentTarget.pos.y - minion.pos.y
    targetInRange = targetOffsetX * targetOffsetX + targetOffsetY * targetOffsetY <= MINION_AGGRO_RADIUS * MINION_AGGRO_RADIUS && !(farFromLane && currentTarget.kind === "hero")
  }
  const recentCutoff = world.state.time - RECENT_TARGET_WINDOW
  let recentHeroTarget = null,
    recentHeroDist = 1 / 0,
    minionTarget = null,
    minionDist = 1 / 0,
    heroTarget = null,
    heroDist = 1 / 0,
    otherTarget = null,
    otherDist = 1 / 0
  const nearbyCount = world.grid.query(minion.pos.x, minion.pos.y, NEARBY_QUERY_RADIUS, MINION_TARGET_QUERY_SCRATCH)
  for (let index = 0; index < nearbyCount; index++) {
    const selectedMINION_TARGET_QUERY_SCRATCH = MINION_TARGET_QUERY_SCRATCH[index]
    if (selectedMINION_TARGET_QUERY_SCRATCH.kind === "monster" || !canTarget(minion, selectedMINION_TARGET_QUERY_SCRATCH)) continue
    const distance = Math.hypot(selectedMINION_TARGET_QUERY_SCRATCH.pos.x - minion.pos.x, selectedMINION_TARGET_QUERY_SCRATCH.pos.y - minion.pos.y) - selectedMINION_TARGET_QUERY_SCRATCH.radius
    distance > NEARBY_QUERY_RADIUS ||
      (selectedMINION_TARGET_QUERY_SCRATCH.rt.hitHeroTime >= recentCutoff && distance < recentHeroDist && !(farFromLane && selectedMINION_TARGET_QUERY_SCRATCH.kind === "hero") && ((recentHeroTarget = selectedMINION_TARGET_QUERY_SCRATCH), (recentHeroDist = distance)),
      selectedMINION_TARGET_QUERY_SCRATCH.kind === "minion" ? distance < minionDist && ((minionTarget = selectedMINION_TARGET_QUERY_SCRATCH), (minionDist = distance)) : selectedMINION_TARGET_QUERY_SCRATCH.kind === "hero" ? distance < heroDist && !farFromLane && ((heroTarget = selectedMINION_TARGET_QUERY_SCRATCH), (heroDist = distance)) : distance < otherDist && ((otherTarget = selectedMINION_TARGET_QUERY_SCRATCH), (otherDist = distance)))
  }
  let chosenAttackTarget
  if ((recentHeroTarget ? ((chosenAttackTarget = manaValue.helping && targetInRange && currentTarget ? currentTarget : recentHeroTarget), (manaValue.helping = !0)) : ((chosenAttackTarget = targetInRange && currentTarget && !manaValue.helping ? currentTarget : (minionTarget ?? heroTarget ?? otherTarget)), (manaValue.helping = !1)), (minion.targetId = chosenAttackTarget ? chosenAttackTarget.id : -1), chosenAttackTarget)) return
  if (manaValue.dir > 0 ? laneProgress >= lane.total - 1 : laneProgress <= 1) {
    const selectedCores = world.cores[minion.team === 0 ? 1 : 0]
    ;((manaValue.goalX = selectedCores.pos.x), (manaValue.goalY = selectedCores.pos.y))
  } else (lane.pointAt(laneProgress + manaValue.dir * MINION_WAYPOINT_STEP, scratchLanePoint), (manaValue.goalX = scratchLanePoint.x - lane.ty * manaValue.offset), (manaValue.goalY = scratchLanePoint.y + lane.tx * manaValue.offset))
}

/**
 * 更新英雄与单位。
 *
 * @param world - 战场
 * @param unit - 输入
 * @param deltaTime - 第三输入
 */
function updateHeroUnit(world, unit, deltaTime) {
  const runtime = unit.rt,
    currentTime = world.state.time
  if ((advanceBasicAttackWindup(world, unit, deltaTime), runtime.dash)) {
    updateDash(world, unit, deltaTime)
    return
  }
  if (!runtime.stunned) {
    if ((currentTime >= runtime.thinkAt && ((runtime.thinkAt = currentTime + MINION_INITIAL_THINK_DELAY), updateMinionUnit(world, unit)), unit.targetId >= 0)) {
      const target = world.byId.get(unit.targetId)
      if (target && canTarget(unit, target)) {
        engageTarget(world, unit, target, deltaTime, !0)
        return
      }
      ;((unit.targetId = -1), (runtime.thinkAt = currentTime))
    }
    runtime.windupLeft > 0 || runtime.rooted || (unit.m.offLane ? navigateToGoal(world, unit, unit.m.goalX, unit.m.goalY, deltaTime) : moveTowards(world, unit, unit.m.goalX, unit.m.goalY, deltaTime))
  }
}

class RandomStream {
  s
  constructor(seed) {
    this.s = seed >>> 0
  }
  next() {
    const nextState = (this.s = (this.s + 1831565813) >>> 0)
    let imulResult = Math.imul(nextState ^ (nextState >>> 15), nextState | 1)
    return ((imulResult ^= imulResult + Math.imul(imulResult ^ (imulResult >>> 7), imulResult | 61)), ((imulResult ^ (imulResult >>> 14)) >>> 0) / 4294967296)
  }
  range(idleMin, maxBound) {
    return idleMin + (maxBound - idleMin) * this.next()
  }
  int(arrayLength) {
    return Math.floor(this.next() * arrayLength)
  }
  chance(probability) {
    return this.next() < probability
  }
  pick(ferns) {
    return ferns[this.int(ferns.length)]
  }
  fork() {
    return new RandomStream((Math.floor(this.next() * 4294967296) ^ 2654435769) >>> 0)
  }
  get state() {
    return this.s
  }
}

class TimerQueue {
  tasks = []
  seq = 0
  at(scheduledTime, callbackFn) {
    const timeConfig = { time: scheduledTime, seq: this.seq++, fn: callbackFn },
      tasks = this.tasks
    let insertIndex = tasks.length
    for (tasks.push(timeConfig); insertIndex > 0 && tasks[insertIndex - 1].time > scheduledTime;) ((tasks[insertIndex] = tasks[insertIndex - 1]), insertIndex--)
    return ((tasks[insertIndex] = timeConfig), timeConfig)
  }
  cancel(task) {
    task && (task.fn = null)
  }
  run(currentTime) {
    const tasks = this.tasks
    for (; tasks.length > 0 && tasks[0].time <= currentTime + 1e-9;) {
      const shiftResult = tasks.shift(),
        callbackFn = shiftResult.fn
      callbackFn && ((shiftResult.fn = null), callbackFn())
    }
  }
  get pending() {
    return this.tasks.length
  }
}

const SPATIAL_CELL_SIZE = 4,
  SPATIAL_MIN_COORD = -60,
  SPATIAL_CELL_COUNT = 30,
  SPATIAL_QUERY_MARGIN = 2.6,
  SPATIAL_EXTRA_MARGIN = 1.2

class SpatialIndex {
  head = new Int32Array(SPATIAL_CELL_COUNT * SPATIAL_CELL_COUNT).fill(-1)
  next = new Int32Array(256)
  items = []
  index(coordX, coordY) {
    let cellX = ((coordX - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0,
      cellY = ((coordY - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0
    return ((cellX = cellX < 0 ? 0 : cellX >= SPATIAL_CELL_COUNT ? SPATIAL_CELL_COUNT - 1 : cellX), (cellY = cellY < 0 ? 0 : cellY >= SPATIAL_CELL_COUNT ? SPATIAL_CELL_COUNT - 1 : cellY), cellY * SPATIAL_CELL_COUNT + cellX)
  }
  push(candidateUnit) {
    const items = this.items,
      itemCount = items.length
    if (itemCount >= this.next.length) {
      const int32Array = new Int32Array(this.next.length * 2)
      ;(int32Array.set(this.next), (this.next = int32Array))
    }
    items.push(candidateUnit)
    const indexResult = this.index(candidateUnit.pos.x, candidateUnit.pos.y)
    ;((this.next[itemCount] = this.head[indexResult]), (this.head[indexResult] = itemCount))
  }
  rebuild(units) {
    ;(this.head.fill(-1), (this.items.length = 0))
    for (let index = units.length - 1; index >= 0; index--) {
      const selectedT = units[index]
      selectedT.alive && this.push(selectedT)
    }
  }
  insert(unit) {
    this.push(unit)
  }
  query(coordX, coordY, radius, nearBuf) {
    nearBuf.length = 0
    const queryRadius = radius + SPATIAL_QUERY_MARGIN + SPATIAL_EXTRA_MARGIN
    let minCellX = ((coordX - queryRadius - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0,
      maxCellX = ((coordX + queryRadius - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0,
      minCellY = ((coordY - queryRadius - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0,
      maxCellY = ((coordY + queryRadius - SPATIAL_MIN_COORD) / SPATIAL_CELL_SIZE) | 0
    ;((minCellX = minCellX < 0 ? 0 : minCellX), (minCellY = minCellY < 0 ? 0 : minCellY), (maxCellX = maxCellX >= SPATIAL_CELL_COUNT ? SPATIAL_CELL_COUNT - 1 : maxCellX), (maxCellY = maxCellY >= SPATIAL_CELL_COUNT ? SPATIAL_CELL_COUNT - 1 : maxCellY))
    const headState = this.head,
      nextState = this.next,
      items = this.items
    for (let index = minCellY; index <= maxCellY; index++) for (let cellX = minCellX; cellX <= maxCellX; cellX++) for (let itemIndex = headState[index * SPATIAL_CELL_COUNT + cellX]; itemIndex >= 0; itemIndex = nextState[itemIndex]) nearBuf.push(items[itemIndex])
    return nearBuf.length
  }
}

const BUSH_VISIBILITY_TICK_INTERVAL = 6,
  EVENT_LOG_MAX_LENGTH = 5e4,
  DEFAULT_TICK_INTERVAL = 0.2

/** 对局构造选项：测试/AI 托管用的开关与机器人控制器工厂。 */
interface SimulationOptions {
  noBots?: boolean
  noWaves?: boolean
  botFactory?: typeof createHeroAgent
}

class Simulation {
  state
  config
  opts: SimulationOptions
  map
  nav
  grid = new SpatialIndex()
  rng
  scheduler = new TimerQueue()
  units = []
  heroes = []
  projectiles = []
  areas = []
  cones = []
  byId = new Map()
  lanes
  towers
  cores
  camps = []
  lastSeen
  superAnnounced
  firstBlood = !1
  nextWaveAt = WAVE_SCHEDULE.firstAt
  buffSeq = 0
  events = []
  nextId = 1
  frozen = !1
  views = new Map()
  constructor(config, opts: SimulationOptions = {}) {
    const playerHero = HERO_IDS.includes(config.playerHero) ? config.playerHero : HERO_IDS[0]
    ;((this.config = { ...config, playerHero: playerHero }),
      (this.opts = opts),
      (this.map = getClassicMapData()),
      (this.nav = new NavGrid(this.map)),
      (this.rng = new RandomStream(config.seed)),
      (this.lanes = { top: new PolylineProjector(this.map.lanes.top), mid: new PolylineProjector(this.map.lanes.mid), bot: new PolylineProjector(this.map.lanes.bot) }),
      (this.state = {
        time: 0,
        tick: 0,
        config: this.config,
        map: this.map,
        units: this.units,
        heroes: this.heroes,
        projectiles: this.projectiles,
        areas: this.areas,
        teams: [
          { kills: 0, towersDestroyed: 0, gold: 0, blessingLeft: 0 },
          { kills: 0, towersDestroyed: 0, gold: 0, blessingLeft: 0 },
        ],
        camps: this.map.camps.map((camp) => ({ campId: camp.id, alive: !1, respawnIn: camp.firstSpawn })),
        playerId: -1,
        nextWaveIn: WAVE_SCHEDULE.firstAt,
        wave: 0,
        over: !1,
        winner: null,
      }))
    const createTowerRow = () => ({ top: [null, null, null], mid: [null, null, null], bot: [null, null, null] })
    ;((this.towers = [createTowerRow(), createTowerRow()]),
      (this.superAnnounced = [
        { top: !1, mid: !1, bot: !1 },
        { top: !1, mid: !1, bot: !1 },
      ]))
    const createSeenRow = () => Array.from({ length: Math.max(10, HERO_IDS.length * 2) }, () => ({ x: 0, y: 0, time: -999 })) // FIX: 原写死10槽，6英雄时team1第6个index=10越界
    this.lastSeen = [createSeenRow(), createSeenRow()]
    const heroIds = [playerHero, ...HERO_IDS.filter((heroId) => heroId !== playerHero)]
    for (const item of [0, 1])
      heroIds.forEach((heroId, heroIndex) => {
        const BaseUnitValue = createBaseUnit(this, item * 5 + heroIndex, item, heroId, item === 0 && heroIndex === 0)
        ;(this.addUnit(BaseUnitValue), this.heroes.push(BaseUnitValue), (this.state.teams[item].gold += BaseUnitValue.goldEarned), BaseUnitValue.isPlayer && (this.state.playerId = BaseUnitValue.id))
      })
    for (const tower of this.map.towers) {
      const TowerUnitValue = createTowerUnit(this, tower)
      ;((this.towers[tower.team][tower.lane][tower.tier - 1] = TowerUnitValue), this.addUnit(TowerUnitValue), this.nav.addObstacle(TowerUnitValue.id, TowerUnitValue.pos.x, TowerUnitValue.pos.y, TowerUnitValue.radius))
    }
    const coreUnits = this.map.bases.map((base) => {
      const CoreUnitValue = createCoreUnit(this, base)
      return (this.addUnit(CoreUnitValue), this.nav.addObstacle(CoreUnitValue.id, CoreUnitValue.pos.x, CoreUnitValue.pos.y, CoreUnitValue.radius), CoreUnitValue)
    })
    ;((this.cores = [coreUnits[0], coreUnits[1]]), refreshStructureInvulnerability(this), initJungleCamps(this))
    for (const hero of this.heroes) respawnUnit(this, hero)
    const botRandom = new RandomStream((config.seed ^ 1540483477) >>> 0)
    for (const teamHero of this.heroes) (this.views.set(teamHero.id, new TeamContext(this, teamHero, resolveDifficulty(config.difficulty, teamHero.team), botRandom.fork())), !opts.noBots && (!teamHero.isPlayer || config.autoPlay) && this.setBotControl(teamHero.id, !0))
    ;(this.grid.rebuild(this.units), updateBushVisibility(this), this.emit({ type: "announce", key: "match_start", team: 2 }))
  }
  step() {
    const state = this.state
    if ((state.tick++, (state.time = state.tick * AREA_ALPHA_AGE_SCALE), state.over)) {
      this.freeze()
      return
    }
    const aREA_ALPHA_AGE_SCALE = AREA_ALPHA_AGE_SCALE,
      units = this.units
    ;(this.scheduler.run(state.time), updateWaveSpawner(this), updateJungleCamps(this), this.updateBlessing(aREA_ALPHA_AGE_SCALE))
    const orderRoll = this.rng.next(),
      reverseOrder = orderRoll < 0.5,
      forwardOrder = ((orderRoll * 4) | 0) % 2 === 0
    ;(this.grid.rebuild(units), this.runBots(forwardOrder))
    const unitCount = units.length
    for (let index = 0; index < unitCount; index++) {
      const snapshotUnit = units[index]
      ;((snapshotUnit.prevPos.x = snapshotUnit.pos.x), (snapshotUnit.prevPos.y = snapshotUnit.pos.y), (snapshotUnit.rt.moved = !1))
    }
    for (let unitIndex = 0; unitIndex < unitCount; unitIndex++) {
      const currentUnit = units[reverseOrder ? unitIndex : unitCount - 1 - unitIndex]
      switch ((currentUnit.alive && tickBuffs(this, currentUnit, aREA_ALPHA_AGE_SCALE), currentUnit.kind)) {
        case "hero":
          tickPassiveGold(this, currentUnit, aREA_ALPHA_AGE_SCALE)
          break
        case "minion":
          currentUnit.alive && updateHeroUnit(this, currentUnit, aREA_ALPHA_AGE_SCALE)
          break
        case "monster":
          currentUnit.alive && updateMonsterUnit(this, currentUnit, aREA_ALPHA_AGE_SCALE)
          break
        case "tower":
        case "core":
          currentUnit.alive && updateCombatUnit(this, currentUnit, aREA_ALPHA_AGE_SCALE)
          break
      }
      if (state.over) break
    }
    ;(this.grid.rebuild(units), updateProjectiles(this, aREA_ALPHA_AGE_SCALE), updateAreas(this, aREA_ALPHA_AGE_SCALE), resolveUnitOverlaps(this), updateFountain(this, aREA_ALPHA_AGE_SCALE), state.tick % BUSH_VISIBILITY_TICK_INTERVAL === 0 && updateBushVisibility(this))
    for (let ccIndex = 0; ccIndex < units.length; ccIndex++) tickCrowdControl(this, units[ccIndex])
    this.removeDead()
  }
  command(lookupKey, commandPayload) {
    const hero = this.byId.get(lookupKey)
    !hero || hero.kind !== "hero" || handleUnitCommand(this, hero, commandPayload)
  }
  drainEvents() {
    const events = this.events
    return ((this.events = []), events)
  }
  getUnit(lookupKey) {
    return this.byId.get(lookupKey)
  }
  get time() {
    return this.state.time
  }
  allocId() {
    return this.nextId++
  }
  emit(event) {
    const events = this.events
    ;(events.length >= EVENT_LOG_MAX_LENGTH && (events.length = 0), events.push(event))
  }
  // 注意：这是 Simulation 的「广播特效事件」方法，名字必须是 fx——
  // 全库有 31 处 n.fx(...) 依赖它，且与顶层 canvas 工厂 createCanvas 无关。
  fx(fxKey, position, team, extraData) {
    this.emit({ type: "fx", key: fxKey, pos: { x: position.x, y: position.y }, team: team, ...extraData })
  }
  schedule(delay, callbackFn) {
    return this.scheduler.at(this.state.time + Math.max(0, delay), callbackFn)
  }
  addUnit(unit) {
    ;(this.units.push(unit), this.byId.set(unit.id, unit), this.grid.insert(unit))
  }
  botView(lookupKey) {
    return this.views.get(lookupKey)
  }
  setBotControl(lookupKey, propertyName) {
    const hero = this.byId.get(lookupKey),
      view = this.views.get(lookupKey)
    if (!(!hero || hero.kind !== "hero" || !view)) {
      if (!propertyName) {
        hero.h.controller = null
        return
      }
      ;((hero.h.controller = (this.opts.botFactory ?? createHeroAgent)(view)), (hero.h.nextThink = Math.max(0.5, this.state.time) + (hero.h.index % 5) * 0.04))
    }
  }
  runBots(forwardOrder) {
    const currentTime = this.state.time,
      heroes = this.heroes
    for (let index = 0; index < heroes.length; index++) {
      const hero = heroes[forwardOrder ? index : heroes.length - 1 - index],
        controller = hero.h.controller
      if (!controller || currentTime < hero.h.nextThink) continue
      hero.h.nextThink = currentTime + (controller.interval ?? DEFAULT_TICK_INTERVAL)
      const view = this.views.get(hero.id)
      view && controller.think(view)
    }
  }
  updateBlessing(deltaTime) {
    for (const item of [0, 1]) {
      const selectedTeams = this.state.teams[item]
      if (!(selectedTeams.blessingLeft <= 0) && ((selectedTeams.blessingLeft -= deltaTime), !(selectedTeams.blessingLeft > 0))) {
        selectedTeams.blessingLeft = 0
        for (const unit of this.units) unit.kind === "minion" && unit.team === item && unit.alive && recomputeStats(this, unit)
      }
    }
  }
  removeDead() {
    const units = this.units
    let writeIndex = 0
    for (let index = 0; index < units.length; index++) {
      const unit = units[index]
      if (!unit.alive && (unit.kind === "minion" || unit.kind === "monster" || unit.kind === "tower")) {
        this.byId.delete(unit.id)
        continue
      }
      units[writeIndex++] = unit
    }
    units.length = writeIndex
  }
  freeze() {
    if (!this.frozen) {
      this.frozen = !0
      for (const unit of this.units) ((unit.prevPos.x = unit.pos.x), (unit.prevPos.y = unit.pos.y))
      for (const projectile of this.projectiles) ((projectile.prevPos.x = projectile.pos.x), (projectile.prevPos.y = projectile.pos.y))
    }
  }
}

export { Simulation, spawnProjectile }