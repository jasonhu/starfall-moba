/**
 * 战斗行为
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { stopMovement, MONSTER_ACTIVE, MONSTER_IDLE, isStructure, markNonEnumerable } from './combat-core'
import { ECONOMY, JUNGLE_RULES, LATE_GAME_SCALING, MONSTER_STATS, TOWER_RULES, TOWER_STATS } from '../game-balance'
import { clearDrakeBreath, onMinionDeath, findKillCreditHero, grantGold, grantXp, interruptDash, recomputeStats, onHeroDeath } from './unit-stats'
import { hasActiveBuff, cancelAttackWindup, removeBuff, refreshStatusFlags, STAT_MODIFYING_BUFF_IDS, invokeBuffRemoval, HARD_CROWD_CONTROL_STATES } from './skill-cast'

function alertMonsterCamp(alertingMonster, provokingEnemy) {
  if (!(provokingEnemy.team === 2 || !provokingEnemy.alive)) for (const member of alertingMonster.mon.camp.members) member.mon.state === MONSTER_IDLE && ((member.mon.state = MONSTER_ACTIVE), (member.targetId = provokingEnemy.id))
}

/**
 * 处理怪物。
 *
 * @param world - 战场
 * @param deadMonster - 输入
 * @param killCreditHero - 第三输入
 */
function onMonsterDeath(world, deadMonster, killCreditHero) {
  const battleState = world.state,
    selectedMONSTER_STATS = MONSTER_STATS[deadMonster.monsterType],
    monsterCamp = deadMonster.mon.camp,
    campMemberIndex = monsterCamp.members.indexOf(deadMonster)
  ;(campMemberIndex >= 0 && monsterCamp.members.splice(campMemberIndex, 1), monsterCamp.members.length === 0 && (monsterCamp.respawnAt = battleState.time + monsterCamp.def.respawn), clearDrakeBreath(world, deadMonster), world.fx("monster_slain", deadMonster.pos, 2, { unitId: deadMonster.id }))
  let killCreditHeroResolved = null
  if (killCreditHero && killCreditHero.kind === "hero") killCreditHeroResolved = killCreditHero
  else {
    const Value = world.byId.get(deadMonster.rt.lastAttackerId)
    Value && Value.kind === "hero" && (killCreditHeroResolved = Value)
  }
  if (!killCreditHeroResolved) return
  ;(killCreditHeroResolved.cs++, grantGold(world, killCreditHeroResolved, selectedMONSTER_STATS.gold, "monster", deadMonster.pos))
  const shareRadiusSquared = ECONOMY.shareRadius * ECONOMY.shareRadius,
    shareRecipients = [killCreditHeroResolved]
  for (const nearbyHero of world.heroes) {
    if (nearbyHero === killCreditHeroResolved || nearbyHero.team !== killCreditHeroResolved.team || !nearbyHero.alive) continue
    const offsetX = nearbyHero.pos.x - deadMonster.pos.x,
      offsetY = nearbyHero.pos.y - deadMonster.pos.y
    offsetX * offsetX + offsetY * offsetY <= shareRadiusSquared && shareRecipients.push(nearbyHero)
  }
  const selectedXpShare = ECONOMY.xpShare[Math.min(shareRecipients.length, ECONOMY.xpShare.length) - 1]
  for (const recipientHero of shareRecipients) grantXp(world, recipientHero, selectedMONSTER_STATS.xp * selectedXpShare)
  for (const hook of killCreditHeroResolved.h.hooks) hook.onKill && hook.onKill(world, killCreditHeroResolved, deadMonster)
  const jUNGLE_RULES = JUNGLE_RULES
  switch (deadMonster.monsterType) {
    case "frost_golem":
      killCreditHeroResolved.alive && (applyStatusEffect(world, killCreditHeroResolved, "frost_insight", { duration: jUNGLE_RULES.buffDuration, key: "camp", merge: "replace" }), world.fx("buff_gain", killCreditHeroResolved.pos, killCreditHeroResolved.team, { unitId: killCreditHeroResolved.id }))
      break
    case "ember_golem":
      killCreditHeroResolved.alive && (applyStatusEffect(world, killCreditHeroResolved, "ember_might", { duration: jUNGLE_RULES.buffDuration, key: "camp", merge: "replace" }), world.fx("buff_gain", killCreditHeroResolved.pos, killCreditHeroResolved.team, { unitId: killCreditHeroResolved.id }))
      break
    case "abyss_drake":
      for (const teamGoldHero of world.heroes) teamGoldHero.team === killCreditHeroResolved.team && (grantGold(world, teamGoldHero, jUNGLE_RULES.drakeTeamGold, "monster", teamGoldHero.pos), grantXp(world, teamGoldHero, jUNGLE_RULES.drakeTeamXp))
      ;(world.emit({ type: "epicSlain", monsterType: deadMonster.monsterType, team: killCreditHeroResolved.team, pos: { x: deadMonster.pos.x, y: deadMonster.pos.y } }), world.emit({ type: "announce", key: "epic_slain", team: killCreditHeroResolved.team, unitId: killCreditHeroResolved.id }))
      break
    case "star_colossus":
      for (const colossusGoldHero of world.heroes) colossusGoldHero.team === killCreditHeroResolved.team && grantGold(world, colossusGoldHero, jUNGLE_RULES.colossusTeamGold, "monster", colossusGoldHero.pos)
      battleState.teams[killCreditHeroResolved.team].blessingLeft = jUNGLE_RULES.blessingDuration
      for (const teamMinion of world.units) teamMinion.kind === "minion" && teamMinion.team === killCreditHeroResolved.team && teamMinion.alive && recomputeStats(world, teamMinion)
      ;(world.emit({ type: "epicSlain", monsterType: deadMonster.monsterType, team: killCreditHeroResolved.team, pos: { x: deadMonster.pos.x, y: deadMonster.pos.y } }), world.emit({ type: "announce", key: "epic_slain", team: killCreditHeroResolved.team, unitId: killCreditHeroResolved.id }))
      break
  }
}

const COMBAT_LANE_NAMES = ["top", "mid", "bot"],
  ATTACK_THINK_INTERVAL = 0.1,
  MINION_AGGRO_QUERY_RADIUS = 10,
  PERIODIC_CHECK_INTERVAL = 0.5,
  COMBAT_QUERY_BUFFER = []

function refreshStructureInvulnerability(battleWorld) {
  for (const teamIndex of [0, 1]) {
    let isActive = !1
    for (const laneName of COMBAT_LANE_NAMES) {
      const [outerTower, middleTower, innerTower] = battleWorld.towers[teamIndex][laneName]
      ;(outerTower && (outerTower.invulnerable = !1), middleTower && (middleTower.invulnerable = outerTower !== null), innerTower && (innerTower.invulnerable = outerTower !== null || middleTower !== null), innerTower || (isActive = !0))
    }
    const selectedCores = battleWorld.cores[teamIndex]
    selectedCores.alive && (selectedCores.invulnerable = !isActive)
  }
}

/**
 * 处理防御塔。
 *
 * @param battleWorld - 战场
 * @param destroyedTower - 输入
 * @param killCreditHero - 第三输入
 */
function onTowerDestroyed(battleWorld, destroyedTower, killCreditHero) {
  const battleState = battleWorld.state,
    enemyTeam = destroyedTower.team === 0 ? 1 : 0,
    selectedTOWER_STATS = TOWER_STATS[destroyedTower.tier]
  ;((battleWorld.towers[destroyedTower.team][destroyedTower.lane][destroyedTower.tier - 1] = null), battleWorld.nav.removeObstacle(destroyedTower.id), battleState.teams[enemyTeam].towersDestroyed++)
  const xConfig = { x: destroyedTower.pos.x, y: destroyedTower.pos.y }
  ;(battleWorld.emit({ type: "towerDestroyed", unitId: destroyedTower.id, team: destroyedTower.team, lane: destroyedTower.lane, tier: destroyedTower.tier, pos: xConfig }), battleWorld.fx("tower_destroyed", destroyedTower.pos, destroyedTower.team, { unitId: destroyedTower.id }))
  const lastHitHero = killCreditHero && killCreditHero.kind === "hero" ? killCreditHero : null
  battleWorld.emit({ type: "announce", key: "tower_destroyed", team: enemyTeam, unitId: lastHitHero ? lastHitHero.id : void 0 })
  for (const teammateHero of battleWorld.heroes) teammateHero.team === enemyTeam && grantGold(battleWorld, teammateHero, selectedTOWER_STATS.teamGold + (teammateHero === lastHitHero ? selectedTOWER_STATS.lastHitGold : 0), "tower", destroyedTower.pos)
  if (lastHitHero) for (const killHook of lastHitHero.h.hooks) killHook.onKill && killHook.onKill(battleWorld, lastHitHero, destroyedTower)
  refreshStructureInvulnerability(battleWorld)
}

function onCoreDestroyed(battleWorld, destroyedCore) {
  const battleState = battleWorld.state,
    winningTeam = destroyedCore.team === 0 ? 1 : 0
  ;(battleWorld.nav.removeObstacle(destroyedCore.id),
    (battleState.over = !0),
    (battleState.winner = winningTeam),
    (battleState.endTime = battleState.time),
    battleWorld.fx("core_destroyed", destroyedCore.pos, destroyedCore.team, { unitId: destroyedCore.id }),
    battleWorld.emit({ type: "gameOver", winner: winningTeam }),
    battleWorld.emit({ type: "announce", key: winningTeam === 0 ? "victory" : "defeat", team: winningTeam }))
}

const ATTACK_TARGET_PADDING = 2,
  EMBER_BURN_DURATION = 2,
  EMBER_SLOW_DURATION = 1,
  EMBER_BURN_TICK_INTERVAL = 0.5,
  TOWER_FOCUS_DURATION = 3,
  MIN_DAMAGE_REDUCTION_FLOOR = 0.2

/**
 * 更新伤害。
 *
 * @param battleWorld - 战场
 * @param damageSource - 英雄
 * @param damageTarget - 英雄
 * @param rawDamage - 第四输入
 * @param physicalKind - 输入
 * @param skillKind - 技能
 * @param damageSlot - 附加输入
 * @param isCritical - 附加输入
 * @returns 数值结果
 */
function applyDamage(battleWorld, damageSource, damageTarget, rawDamage, physicalKind, skillKind = "skill", damageSlot = null, isCritical = !1) {
  const battleState = battleWorld.state
  if (battleState.over || !damageTarget.alive || !(rawDamage > 0) || damageTarget.invulnerable || damageTarget.rt.untargetable) return 0
  const damageTime = battleState.time,
    amountConfig = { amount: rawDamage, dtype: physicalKind, kind: skillKind, slot: damageSlot, crit: isCritical }
  if (damageSource && damageSource.kind === "hero") {
    const sourceHooks = damageSource.h.hooks
    for (let index = 0; index < sourceHooks.length; index++) {
      const selectedG = sourceHooks[index]
      selectedG.modifyDamageDealt && selectedG.modifyDamageDealt(battleWorld, damageSource, damageTarget, amountConfig)
    }
    battleState.teams[damageSource.team].blessingLeft > 0 && hasActiveBuff(damageSource, "star_blessing") && (amountConfig.amount *= 1 + JUNGLE_RULES.blessingDamage)
  }
  if (damageTarget.kind === "hero") {
    const targetHooks = damageTarget.h.hooks
    for (let targetHookIndex = 0; targetHookIndex < targetHooks.length; targetHookIndex++) {
      const targetHook = targetHooks[targetHookIndex]
      targetHook.modifyDamageTaken && targetHook.modifyDamageTaken(battleWorld, damageTarget, damageSource, amountConfig)
    }
  } else isStructure(damageTarget) && (damageTarget.rt.backdoor && (amountConfig.amount *= 1 - TOWER_RULES.backdoorReduction), damageTime > LATE_GAME_SCALING.start && (amountConfig.amount *= 1 + ((damageTime - LATE_GAME_SCALING.start) / 60) * LATE_GAME_SCALING.structureVulnPerMin))
  let damageReductionFactor = 1
  const targetBuffs = damageTarget.buffs
  for (let damageBuffIndex = 0; damageBuffIndex < targetBuffs.length; damageBuffIndex++) targetBuffs[damageBuffIndex].id === "dmg_reduction" && (damageReductionFactor *= 1 - Math.min(1, Math.max(0, targetBuffs[damageBuffIndex].value)))
  damageReductionFactor < 1 && (amountConfig.amount *= Math.max(MIN_DAMAGE_REDUCTION_FLOOR, damageReductionFactor))
  let mitigatedDamage = amountConfig.amount
  if (physicalKind === "physical") {
    const effectiveArmor = damageTarget.stats.armor * (1 - (damageSource ? damageSource.stats.armorPen : 0))
    mitigatedDamage *= 600 / (600 + Math.max(0, effectiveArmor))
  } else if (physicalKind === "magic") {
    const effectiveMagicResist = damageTarget.stats.mr * (1 - (damageSource ? damageSource.stats.magicPen : 0))
    mitigatedDamage *= 600 / (600 + Math.max(0, effectiveMagicResist))
  }
  if (!(mitigatedDamage > 0)) return 0
  const damageAfterShield = damageTarget.shield > 0 ? absorbWithShields(battleWorld, damageTarget, mitigatedDamage) : mitigatedDamage,
    actualHpDamage = Math.min(damageTarget.hp, damageAfterShield)
  damageTarget.hp -= damageAfterShield
  const finalDamage = mitigatedDamage - damageAfterShield + actualHpDamage
  if (
    ((damageTarget.lastHitTime = damageTime),
    damageSource &&
      ((damageTarget.rt.lastAttackerId = damageSource.id),
      damageTarget.kind === "hero"
        ? ((damageTarget.dmgTaken += finalDamage),
          damageSource.team !== damageTarget.team && ((damageSource.rt.hitHeroTime = damageTime), (damageSource.rt.hitHeroId = damageTarget.id)),
          damageSource.kind === "hero" ? ((damageSource.dmgDealt += finalDamage), (damageSource.h.lastCombatTime = damageTime), (damageTarget.h.lastCombatTime = damageTime), damageTarget.h.damagers.set(damageSource.id, damageTime)) : isStructure(damageSource) && (damageTarget.h.lastCombatTime = damageTime))
        : damageSource.kind === "hero" && isStructure(damageTarget)
          ? (damageSource.dmgTower += finalDamage)
          : damageTarget.kind === "monster" && alertMonsterCamp(damageTarget, damageSource)),
    battleWorld.emit({ type: "damage", targetId: damageTarget.id, sourceId: damageSource ? damageSource.id : -1, amount: finalDamage, dtype: physicalKind, crit: isCritical, pos: { x: damageTarget.pos.x, y: damageTarget.pos.y }, skill: skillKind === "skill" }),
    damageTarget.kind === "hero" && (hasActiveBuff(damageTarget, "recall") && removeBuff(battleWorld, damageTarget, "recall"), damageSource && (damageSource.kind === "hero" || isStructure(damageSource)) && hasActiveBuff(damageTarget, "restore") && removeBuff(battleWorld, damageTarget, "restore")),
    damageTarget.hp <= 0 && ((damageTarget.hp = 0), killUnit(battleWorld, damageTarget, damageSource)),
    damageTarget.kind === "hero" && skillKind !== "env")
  ) {
    const damageTakenHooks = damageTarget.h.hooks
    for (let damageTakenHookIndex = 0; damageTakenHookIndex < damageTakenHooks.length; damageTakenHookIndex++) {
      const damageTakenHook = damageTakenHooks[damageTakenHookIndex]
      damageTakenHook.onDamageTaken && damageTakenHook.onDamageTaken(battleWorld, damageTarget, damageSource, finalDamage, amountConfig)
    }
  }
  if (damageSource && damageSource.kind === "hero")
    if (skillKind === "skill") {
      const attackerHooks = damageSource.h.hooks
      for (let attackerHookIndex = 0; attackerHookIndex < attackerHooks.length; attackerHookIndex++) {
        const skillHitHook = attackerHooks[attackerHookIndex]
        skillHitHook.onSkillHit && skillHitHook.onSkillHit(battleWorld, damageSource, damageTarget, finalDamage, amountConfig)
      }
    } else skillKind === "basic" && damageSource.alive && damageSource.stats.lifesteal > 0 && !isStructure(damageTarget) && healUnit(battleWorld, damageSource, damageSource, finalDamage * damageSource.stats.lifesteal)
  return finalDamage
}

/**
 * 处理单位。
 *
 * @param battleWorld - 主要输入
 * @param healSource - 次要输入
 * @param healTarget - 输入
 * @param requestedHeal - 第四输入
 * @param silentHeal - 附加输入
 * @returns 数值结果
 */
function healUnit(battleWorld, healSource, healTarget, requestedHeal, silentHeal = !1) {
  if (!healTarget.alive || !(requestedHeal > 0)) return 0
  const hpBeforeHeal = healTarget.hp
  healTarget.hp = Math.min(healTarget.stats.maxHp, hpBeforeHeal + requestedHeal)
  const actualHealAmount = healTarget.hp - hpBeforeHeal
  return (actualHealAmount >= 1 && !silentHeal && battleWorld.emit({ type: "heal", targetId: healTarget.id, amount: actualHealAmount, pos: { x: healTarget.pos.x, y: healTarget.pos.y } }), actualHealAmount)
}

/**
 * 处理单位。
 *
 * @param battleWorld - 战场
 * @param dyingUnit - 输入
 * @param killAttacker - 第三输入
 */
function killUnit(battleWorld, dyingUnit, killAttacker) {
  if (!dyingUnit.alive) return
  const battleState = battleWorld.state
  ;((dyingUnit.alive = !1), (dyingUnit.hp = 0))
  const runtime = dyingUnit.rt
  ;((runtime.windupLeft = 0),
    (runtime.windupTarget = -1),
    runtime.dash && interruptDash(battleWorld, dyingUnit, "interrupted"),
    clearAllBuffs(battleWorld, dyingUnit),
    stopMovement(dyingUnit),
    (runtime.act = null),
    (runtime.lockUntil = 0),
    (dyingUnit.targetId = -1),
    (dyingUnit.anim = "dead"),
    (dyingUnit.animStart = battleState.time),
    (dyingUnit.animDur = 1.5))
  const creditHero = dyingUnit.kind === "hero" ? findKillCreditHero(battleWorld, dyingUnit, killAttacker) : null,
    killerId = creditHero ? creditHero.id : killAttacker ? killAttacker.id : -1
  switch ((battleWorld.emit({ type: "death", unitId: dyingUnit.id, kind: dyingUnit.kind, team: dyingUnit.team, killerId: killerId, pos: { x: dyingUnit.pos.x, y: dyingUnit.pos.y } }), dyingUnit.kind)) {
    case "hero":
      onHeroDeath(battleWorld, dyingUnit, creditHero, killAttacker)
      break
    case "minion":
      onMinionDeath(battleWorld, dyingUnit, killAttacker)
      break
    case "monster":
      onMonsterDeath(battleWorld, dyingUnit, killAttacker)
      break
    case "tower":
      onTowerDestroyed(battleWorld, dyingUnit, killAttacker)
      break
    case "core":
      onCoreDestroyed(battleWorld, dyingUnit)
      break
  }
}

function isStatusImmune(targetUnit, slowKind) {
  return !!(
    targetUnit.kind === "tower" ||
    targetUnit.kind === "core" ||
    targetUnit.invulnerable ||
    targetUnit.rt.untargetable ||
    targetUnit.rt.unstoppable ||
    (slowKind === "slow" && targetUnit.rt.slowImmune) ||
    (targetUnit.kind === "monster" && slowKind !== "slow" && MONSTER_STATS[targetUnit.monsterType].epic)
  )
}

/**
 * 查找状态效果。
 *
 * @param targetUnit - 输入
 * @param lookupOption - 输入
 * @param requiredKey - 第三输入
 */
function findBuffByKey(targetUnit, lookupOption, requiredKey?: string) {
  const unitBuffs = targetUnit.buffs
  for (let index = 0; index < unitBuffs.length; index++) {
    const selectedS = unitBuffs[index]
    if (selectedS.id === lookupOption && (requiredKey === void 0 || selectedS.key === requiredKey)) return selectedS
  }
  return null
}

function interruptOnCrowdControl(battleWorld, affectedUnit, isHardCrowdControl) {
  const rtValue = affectedUnit.rt
  ;(rtValue.dash && rtValue.dash.mode !== "forced" && interruptDash(battleWorld, affectedUnit, "interrupted"),
    isHardCrowdControl && (cancelAttackWindup(affectedUnit), rtValue.act !== null && rtValue.act !== "spin" && (rtValue.act = null), affectedUnit.kind === "hero" && ((affectedUnit.h.pendingCast = null), hasActiveBuff(affectedUnit, "recall") && removeBuff(battleWorld, affectedUnit, "recall"))))
}

/**
 * 更新特效。
 *
 * @param battleWorld - 战场
 * @param targetUnit - 输入
 * @param lookupKey - 查找键
 * @param effectOptions - 第四输入
 */
function applyStatusEffect(battleWorld, targetUnit, lookupKey, effectOptions) {
  if (!targetUnit.alive) return null
  const hasResult = HARD_CROWD_CONTROL_STATES.has(lookupKey)
  if ((hasResult || lookupKey === "slow") && isStatusImmune(targetUnit, lookupKey)) return null
  const sourceUnitId = effectOptions.sourceId ?? -1,
    effectDuration = effectOptions.duration,
    effectPotency = effectOptions.value ?? 0,
    stackCount = effectOptions.stacks ?? 1,
    effectKey = effectOptions.key ?? (hasResult ? "cc" : lookupKey === "shield" ? `#${battleWorld.buffSeq++}` : `s${sourceUnitId}`),
    applyTime = battleWorld.state.time
  let findBuffByKeyResult = findBuffByKey(targetUnit, lookupKey, effectKey)
  if (findBuffByKeyResult) {
    const resolvedMaxStacks = effectOptions.maxStacks ?? findBuffByKeyResult.maxStacks
    ;((findBuffByKeyResult.maxStacks = resolvedMaxStacks),
      resolvedMaxStacks > 1
        ? ((findBuffByKeyResult.stacks = Math.min(resolvedMaxStacks, findBuffByKeyResult.stacks + stackCount)), (findBuffByKeyResult.timeLeft = effectDuration), (findBuffByKeyResult.duration = effectDuration), (findBuffByKeyResult.startTime = applyTime), effectOptions.value !== void 0 && (findBuffByKeyResult.value = effectPotency))
        : effectOptions.merge === "replace"
          ? ((findBuffByKeyResult.timeLeft = effectDuration), (findBuffByKeyResult.duration = effectDuration), (findBuffByKeyResult.value = effectPotency), (findBuffByKeyResult.startTime = applyTime))
          : (effectDuration > findBuffByKeyResult.timeLeft && ((findBuffByKeyResult.timeLeft = effectDuration), (findBuffByKeyResult.duration = effectDuration), (findBuffByKeyResult.startTime = applyTime)), effectPotency > findBuffByKeyResult.value && (findBuffByKeyResult.value = effectPotency)),
      (findBuffByKeyResult.sourceId = sourceUnitId),
      effectOptions.onTick && (findBuffByKeyResult.onTick = effectOptions.onTick),
      effectOptions.onExpire && (findBuffByKeyResult.onExpire = effectOptions.onExpire),
      effectOptions.onRemove && (findBuffByKeyResult.onRemove = effectOptions.onRemove))
  } else {
    const initialMaxStacks = effectOptions.maxStacks ?? 1
    ;((findBuffByKeyResult = {
      id: lookupKey,
      sourceId: sourceUnitId,
      timeLeft: effectDuration,
      duration: effectDuration,
      stacks: Math.min(initialMaxStacks, Math.max(1, stackCount)),
      value: effectPotency,
      key: effectKey,
      maxStacks: initialMaxStacks,
      startTime: applyTime,
      tickInterval: effectOptions.tickInterval ?? 0,
      tickLeft: effectOptions.tickInterval ?? 0,
      onTick: effectOptions.onTick ?? null,
      onExpire: effectOptions.onExpire ?? null,
      onRemove: effectOptions.onRemove ?? null,
    }),
      markNonEnumerable(findBuffByKeyResult, "onTick", "onExpire", "onRemove"),
      targetUnit.buffs.push(findBuffByKeyResult))
  }
  return (refreshStatusFlags(targetUnit), lookupKey === "stun" || lookupKey === "airborne" ? interruptOnCrowdControl(battleWorld, targetUnit, !0) : lookupKey === "root" && interruptOnCrowdControl(battleWorld, targetUnit, !1), (targetUnit.kind === "hero" || STAT_MODIFYING_BUFF_IDS.has(lookupKey)) && recomputeStats(battleWorld, targetUnit), findBuffByKeyResult)
}

/**
 * 移除状态效果。
 *
 * @param battleWorld - 主要输入
 * @param targetUnit - 输入
 */
function clearAllBuffs(battleWorld, targetUnit) {
  const unitBuffs = targetUnit.buffs
  if (unitBuffs.length === 0) return
  const buffSnapshot = unitBuffs.slice()
  ;((unitBuffs.length = 0), refreshStatusFlags(targetUnit))
  for (const removedBuff of buffSnapshot) invokeBuffRemoval(battleWorld, targetUnit, removedBuff)
}

function absorbWithShields(battleWorld, targetUnit, incomingDamage) {
  let remainingDamage = incomingDamage
  for (; remainingDamage > 0;) {
    let soonestExpiringShield = null
    const unitBuffs = targetUnit.buffs
    for (let index = 0; index < unitBuffs.length; index++) {
      const selectedA = unitBuffs[index]
      selectedA.id === "shield" && selectedA.value > 0 && (soonestExpiringShield === null || selectedA.timeLeft < soonestExpiringShield.timeLeft) && (soonestExpiringShield = selectedA)
    }
    if (!soonestExpiringShield) break
    const absorbedDamage = Math.min(soonestExpiringShield.value, remainingDamage)
    if (((soonestExpiringShield.value -= absorbedDamage), (remainingDamage -= absorbedDamage), soonestExpiringShield.value <= 1e-6)) {
      const depletedShieldIndex = unitBuffs.indexOf(soonestExpiringShield)
      ;(depletedShieldIndex >= 0 && unitBuffs.splice(depletedShieldIndex, 1), battleWorld.fx("shield_break", targetUnit.pos, targetUnit.team, { unitId: targetUnit.id }), invokeBuffRemoval(battleWorld, targetUnit, soonestExpiringShield))
    }
  }
  return (refreshStatusFlags(targetUnit), remainingDamage)
}

export { applyDamage, findBuffByKey, MINION_AGGRO_QUERY_RADIUS, ATTACK_THINK_INTERVAL, EMBER_BURN_TICK_INTERVAL, ATTACK_TARGET_PADDING, EMBER_SLOW_DURATION, PERIODIC_CHECK_INTERVAL, applyStatusEffect, EMBER_BURN_DURATION, healUnit, isStatusImmune, COMBAT_QUERY_BUFFER, refreshStructureInvulnerability, TOWER_FOCUS_DURATION }