/**
 * 单位状态：重叠分离、野怪营地、属性统计与状态更新
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { TELEPORT_SEARCH_RADIUS, SEPARATION_PUSH_FACTOR, MAX_SEPARATION_STEP, SEPARATION_DISTANCE_FACTOR, startAction, createMonsterUnit } from './combat-core'
import { pointSegmentDistanceSq } from './skill-evaluation'
import { eh, f5, lm } from '../skills/skill-values'
import { ItemTable } from '../equipment'
import { ECONOMY, JUNGLE_RULES, MINION_STATS, MONSTER_STATS, heroRespawnSeconds, xpToNext } from '../game-balance'
import { HERO_TABLE } from '../../heroes/registry'

function endDash(world, unit, dash, endReason) {
  const runtime = unit.rt
  runtime.dash === dash && ((runtime.dash = null), dash.ignoreWalls && !world.nav.isFree(unit.pos.x, unit.pos.y, runtime.navR - 0.05) && world.nav.nearestFree(unit.pos.x, unit.pos.y, runtime.navR, unit.pos, TELEPORT_SEARCH_RADIUS), dash.onEnd && dash.onEnd(endReason))
}

function interruptDash(world, unit, endReason = "interrupted") {
  const dash = unit.rt.dash
  dash && endDash(world, unit, dash, endReason)
}

const DASH_TRAIL_SLOTS = []

function updateDash(world, unit, deltaTime) {
  const rtValue = unit.rt,
    dash = rtValue.dash
  if (!dash) return
  const coordX = unit.pos.x,
    coordY = unit.pos.y
  let dashEndReason = null
  if (dash.mode === "leap") {
    dash.t += deltaTime
    const progress = dash.t >= dash.dur ? 1 : dash.t / dash.dur
    ;((unit.pos.x = dash.fromX + (dash.toX - dash.fromX) * progress), (unit.pos.y = dash.fromY + (dash.toY - dash.fromY) * progress), progress >= 1 && (dashEndReason = "arrived"))
  } else {
    const dashStepDistance = Math.min(dash.left, dash.speed * deltaTime)
    ;(dash.ignoreWalls ? ((unit.pos.x += dash.dirX * dashStepDistance), (unit.pos.y += dash.dirY * dashStepDistance)) : world.nav.moveStraight(unit.pos, dash.dirX, dash.dirY, dashStepDistance, rtValue.navR) < dashStepDistance - 1e-4 && (dashEndReason = "wall"),
      (dash.left -= dashStepDistance),
      !dashEndReason && dash.left <= 1e-6 && (dashEndReason = "arrived"))
  }
  if (dash.onHit && dash.hitRadius >= 0) {
    const centerX = (coordX + unit.pos.x) * 0.5,
      centerY = (coordY + unit.pos.y) * 0.5,
      distance = Math.hypot(unit.pos.x - coordX, unit.pos.y - coordY) * 0.5,
      hitCandidates = world.grid.query(centerX, centerY, distance + dash.hitRadius, DASH_TRAIL_SLOTS) > 0 ? DASH_TRAIL_SLOTS.slice() : DASH_TRAIL_SLOTS
    for (let index = 0; index < hitCandidates.length; index++) {
      const selectedH = hitCandidates[index]
      if (selectedH === unit || !selectedH.alive || dash.hitIds.indexOf(selectedH.id) >= 0 || (dash.filter && !dash.filter(selectedH))) continue
      const combinedRadius = dash.hitRadius + selectedH.radius
      if (pointSegmentDistanceSq(selectedH.pos.x, selectedH.pos.y, coordX, coordY, unit.pos.x, unit.pos.y) > combinedRadius * combinedRadius) continue
      dash.hitIds.push(selectedH.id)
      const onHitResult = dash.onHit(selectedH)
      if (rtValue.dash !== dash) return
      if (onHitResult === !0) {
        dashEndReason = "hit"
        break
      }
    }
  }
  dashEndReason && endDash(world, unit, dash, dashEndReason)
}

const DEAD_UNIT_BUFFER = []

function pruneDeadUnits(unit) {
  return unit.alive && unit.kind !== "tower" && unit.kind !== "core" && unit.rt.dash === null
}

/**
 * 处理单位。
 *
 * @param world - 战场
 */
function resolveUnitOverlaps(world) {
  const units = world.units,
    grid = world.grid
  for (let index = 0; index < units.length; index++) {
    const selectedT = units[index]
    if (!pruneDeadUnits(selectedT)) continue
    const Value = grid.query(selectedT.pos.x, selectedT.pos.y, selectedT.radius, DEAD_UNIT_BUFFER)
    for (let neighborIndex = 0; neighborIndex < Value; neighborIndex++) {
      const selectedDEAD_UNIT_BUFFER = DEAD_UNIT_BUFFER[neighborIndex]
      if (selectedDEAD_UNIT_BUFFER.id <= selectedT.id || !pruneDeadUnits(selectedDEAD_UNIT_BUFFER)) continue
      const firstWeight = selectedT.rt.weight,
        secondWeight = selectedDEAD_UNIT_BUFFER.rt.weight
      if (firstWeight === 0 && secondWeight === 0) continue
      let deltaX = selectedT.pos.x - selectedDEAD_UNIT_BUFFER.pos.x,
        deltaY = selectedT.pos.y - selectedDEAD_UNIT_BUFFER.pos.y
      const targetSeparation = (selectedT.radius + selectedDEAD_UNIT_BUFFER.radius) * SEPARATION_DISTANCE_FACTOR,
        distanceSquared = deltaX * deltaX + deltaY * deltaY
      if (distanceSquared >= targetSeparation * targetSeparation) continue
      let currentDistance = Math.sqrt(distanceSquared)
      if (currentDistance < 1e-4) {
        const fallbackPushAngle = (selectedT.id * 2.399963 + selectedDEAD_UNIT_BUFFER.id) % (Math.PI * 2)
        ;((deltaX = Math.cos(fallbackPushAngle)), (deltaY = Math.sin(fallbackPushAngle)), (currentDistance = 1))
      }
      const pushMagnitude = (targetSeparation - currentDistance) * SEPARATION_PUSH_FACTOR,
        firstPushShare = firstWeight === 0 ? 0 : secondWeight === 0 ? 1 : secondWeight / (firstWeight + secondWeight),
        secondPushShare = secondWeight === 0 ? 0 : firstWeight === 0 ? 1 : firstWeight / (firstWeight + secondWeight),
        dirX = deltaX / currentDistance,
        dirY = deltaY / currentDistance
      ;((selectedT.rt.pushX += dirX * pushMagnitude * firstPushShare), (selectedT.rt.pushY += dirY * pushMagnitude * firstPushShare), (selectedDEAD_UNIT_BUFFER.rt.pushX -= dirX * pushMagnitude * secondPushShare), (selectedDEAD_UNIT_BUFFER.rt.pushY -= dirY * pushMagnitude * secondPushShare))
    }
  }
  const nav = world.nav
  for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
    const unit = units[unitIndex],
      runtime = unit.rt
    if (runtime.pushX === 0 && runtime.pushY === 0) continue
    let pushX = runtime.pushX,
      pushY = runtime.pushY
    if (((runtime.pushX = 0), (runtime.pushY = 0), !unit.alive)) continue
    const distance = Math.hypot(pushX, pushY)
    ;(distance > MAX_SEPARATION_STEP && ((pushX = (pushX / distance) * MAX_SEPARATION_STEP), (pushY = (pushY / distance) * MAX_SEPARATION_STEP)), nav.moveWithCollision(unit.pos, pushX, pushY, runtime.navR))
  }
}

const MAX_ATTACK_SPEED = 2.5,
  MIN_MOVE_SPEED = 1.2,
  MAX_CDR = 0.4,
  MAX_PENETRATION = 0.8,
  STAT_KEYS = {
    hp: 0,
    mana: 0,
    ad: 0,
    ap: 0,
    apPct: 0,
    armor: 0,
    mr: 0,
    asPct: 0,
    moveFlat: 0,
    movePct: 0,
    slow: 0,
    slowResist: 0,
    cdr: 0,
    lifesteal: 0,
    crit: 0,
    critDmg: 0,
    armorPen: 0,
    magicPen: 0,
    hpRegen: 0,
    manaRegen: 0,
    adPct: 0,
    hpPct: 0,
  }

function resetStatsScratch() {
  ;((STAT_KEYS.hp = 0),
    (STAT_KEYS.mana = 0),
    (STAT_KEYS.ad = 0),
    (STAT_KEYS.ap = 0),
    (STAT_KEYS.apPct = 0),
    (STAT_KEYS.armor = 0),
    (STAT_KEYS.mr = 0),
    (STAT_KEYS.asPct = 0),
    (STAT_KEYS.moveFlat = 0),
    (STAT_KEYS.movePct = 0),
    (STAT_KEYS.slow = 0),
    (STAT_KEYS.slowResist = 0),
    (STAT_KEYS.cdr = 0),
    (STAT_KEYS.lifesteal = 0),
    (STAT_KEYS.crit = 0),
    (STAT_KEYS.critDmg = 0),
    (STAT_KEYS.armorPen = 0),
    (STAT_KEYS.magicPen = 0),
    (STAT_KEYS.hpRegen = 0),
    (STAT_KEYS.manaRegen = 0),
    (STAT_KEYS.adPct = 0),
    (STAT_KEYS.hpPct = 0))
}

function recomputeStats(world, unit) {
  resetStatsScratch()
  const runtime = unit.rt
  let isActive = !1,
    hasStarBlessing = !1
  const buffs = unit.buffs
  for (let index = 0; index < buffs.length; index++) {
    const selectedA = buffs[index]
    switch (selectedA.id) {
      case "slow":
        selectedA.value > STAT_KEYS.slow && (STAT_KEYS.slow = selectedA.value)
        break
      case "haste":
        STAT_KEYS.movePct += selectedA.value
        break
      case "attack_speed":
        STAT_KEYS.asPct += selectedA.value
        break
      case "frost_insight":
        isActive = !0
        break
      case "star_blessing":
        hasStarBlessing = !0
        break
    }
  }
  if (unit.kind === "hero") {
    unit.h.baseLevel !== unit.level && ((runtime.base = f5(unit.h.def, unit.level)), (unit.h.baseLevel = unit.level))
    for (let itemIndex = 0; itemIndex < unit.items.length; itemIndex++) {
      const selectedItems = unit.items[itemIndex]
      if (!selectedItems) continue
      const itemStats = ItemTable[selectedItems].stats
      ;((STAT_KEYS.hp += itemStats.hp ?? 0),
        (STAT_KEYS.mana += itemStats.mana ?? 0),
        (STAT_KEYS.ad += itemStats.ad ?? 0),
        (STAT_KEYS.ap += itemStats.ap ?? 0),
        (STAT_KEYS.apPct += itemStats.apPct ?? 0),
        (STAT_KEYS.armor += itemStats.armor ?? 0),
        (STAT_KEYS.mr += itemStats.mr ?? 0),
        (STAT_KEYS.asPct += itemStats.attackSpeedPct ?? 0),
        (STAT_KEYS.moveFlat += itemStats.moveSpeed ?? 0),
        (STAT_KEYS.cdr += itemStats.cdr ?? 0),
        (STAT_KEYS.lifesteal += itemStats.lifesteal ?? 0),
        (STAT_KEYS.crit += itemStats.critChance ?? 0),
        (STAT_KEYS.critDmg += itemStats.critDamage ?? 0),
        (STAT_KEYS.armorPen += itemStats.armorPen ?? 0),
        (STAT_KEYS.magicPen += itemStats.magicPen ?? 0),
        (STAT_KEYS.hpRegen += itemStats.hpRegen ?? 0),
        (STAT_KEYS.manaRegen += itemStats.manaRegen ?? 0))
    }
    isActive && (STAT_KEYS.cdr += JUNGLE_RULES.frostCdr)
    const hooks = unit.h.hooks
    for (let hookIndex = 0; hookIndex < hooks.length; hookIndex++) {
      const statMods = hooks[hookIndex].statMods
      statMods && statMods.call(hooks[hookIndex], world, unit, STAT_KEYS)
    }
  } else unit.kind === "minion" && world.state.teams[unit.team].blessingLeft > 0 && ((STAT_KEYS.hpPct += JUNGLE_RULES.blessingMinionBoost), (STAT_KEYS.adPct += JUNGLE_RULES.blessingMinionBoost))
  const baseStats = runtime.base,
    stats = unit.stats,
    previousMaxHp = stats.maxHp,
    previousMaxMana = stats.maxMana
  if (
    ((stats.maxHp = (baseStats.maxHp + STAT_KEYS.hp) * (1 + STAT_KEYS.hpPct)),
    (stats.maxMana = baseStats.maxMana + STAT_KEYS.mana),
    (stats.ad = (baseStats.ad + STAT_KEYS.ad) * (1 + STAT_KEYS.adPct)),
    (stats.ap = (baseStats.ap + STAT_KEYS.ap) * (1 + STAT_KEYS.apPct)),
    (stats.armor = baseStats.armor + STAT_KEYS.armor),
    (stats.mr = baseStats.mr + STAT_KEYS.mr),
    (stats.attackSpeed = Math.min(MAX_ATTACK_SPEED, baseStats.attackSpeed * Math.max(0.2, 1 + STAT_KEYS.asPct))),
    baseStats.moveSpeed > 0)
  ) {
    const slowResistRatio = STAT_KEYS.slowResist < 0 ? 0 : STAT_KEYS.slowResist > 1 ? 1 : STAT_KEYS.slowResist,
      effectiveSlowRatio = Math.min(0.9, STAT_KEYS.slow * (1 - slowResistRatio))
    stats.moveSpeed = Math.max(MIN_MOVE_SPEED, (baseStats.moveSpeed + STAT_KEYS.moveFlat) * Math.max(0.1, 1 + STAT_KEYS.movePct) * (1 - effectiveSlowRatio))
  } else stats.moveSpeed = 0
  ;((stats.attackRange = baseStats.attackRange),
    (stats.cdr = Math.min(MAX_CDR, baseStats.cdr + STAT_KEYS.cdr)),
    (stats.lifesteal = baseStats.lifesteal + STAT_KEYS.lifesteal),
    (stats.critChance = Math.min(1, baseStats.critChance + STAT_KEYS.crit)),
    (stats.critDamage = baseStats.critDamage + STAT_KEYS.critDmg),
    (stats.armorPen = Math.min(MAX_PENETRATION, baseStats.armorPen + STAT_KEYS.armorPen)),
    (stats.magicPen = Math.min(MAX_PENETRATION, baseStats.magicPen + STAT_KEYS.magicPen)),
    (stats.hpRegen = baseStats.hpRegen + STAT_KEYS.hpRegen + (hasStarBlessing ? stats.maxHp * JUNGLE_RULES.blessingRegen : 0)),
    (stats.manaRegen = baseStats.manaRegen + STAT_KEYS.manaRegen + (isActive ? stats.maxMana * JUNGLE_RULES.frostManaRegen : 0)),
    unit.alive && (stats.maxHp > previousMaxHp && (unit.hp += stats.maxHp - previousMaxHp), stats.maxMana > previousMaxMana && (unit.mana += stats.maxMana - previousMaxMana)),
    unit.hp > stats.maxHp && (unit.hp = stats.maxHp),
    unit.mana > stats.maxMana && (unit.mana = stats.maxMana))
}

const LEVEL_UP_HEAL_FRACTION = 0.2,
  DEATH_STREAK_GOLD_PENALTY = 40,
  HERO_SKILL_SLOT_IDS = ["s1", "s2", "ult"]

function grantGold(world, unit, amount, reason, position, suppressEvent = !1) {
  const goldAmount = Math.round(amount)
  goldAmount <= 0 || ((unit.gold += goldAmount), (unit.goldEarned += goldAmount), (world.state.teams[unit.team].gold += goldAmount), suppressEvent || world.emit({ type: "gold", unitId: unit.id, amount: goldAmount, pos: { x: position.x, y: position.y }, reason: reason }))
}

/**
 * 更新技能。
 *
 * @param hero - 英雄
 */
function updateSkillLevels(hero) {
  const lmResult = lm(hero.level),
    selectedHERO_TABLE = HERO_TABLE[hero.heroId]
  for (const slotId of HERO_SKILL_SLOT_IDS) {
    const selectedSkills = hero.skills[slotId],
      skillDef = selectedHERO_TABLE.skills[slotId]
    selectedSkills.level = lmResult[slotId]
    const skillLevelIndex = Math.max(0, selectedSkills.level - 1)
    ;((selectedSkills.cost = skillDef.manaCost[skillLevelIndex]), selectedSkills.cd <= 0 && (selectedSkills.cdMax = skillDef.cooldown[skillLevelIndex]))
  }
}

/**
 * 处理单位。
 *
 * @param world - 主要输入
 * @param unit - 输入
 */
function levelUpUnit(world, unit) {
  ;(unit.level++,
    (unit.xpToNext = xpToNext(unit.level)),
    recomputeStats(world, unit),
    unit.alive && ((unit.hp += (unit.stats.maxHp - unit.hp) * LEVEL_UP_HEAL_FRACTION), (unit.mana += (unit.stats.maxMana - unit.mana) * LEVEL_UP_HEAL_FRACTION)),
    updateSkillLevels(unit),
    world.emit({ type: "levelUp", unitId: unit.id, level: unit.level }),
    world.fx("level_up", unit.pos, unit.team, { unitId: unit.id }))
}

function grantXp(world, unit, drakeTeamXp) {
  if (!(unit.level >= eh || !(drakeTeamXp > 0))) {
    for (unit.xp += drakeTeamXp; unit.level < eh && unit.xp >= unit.xpToNext;) ((unit.xp -= unit.xpToNext), levelUpUnit(world, unit))
    unit.level >= eh && ((unit.xp = 0), (unit.xpToNext = 0))
  }
}

const xpShareForCount = (count) => ECONOMY.xpShare[Math.min(count, ECONOMY.xpShare.length) - 1]

/**
 * 查找英雄。
 *
 * @param world - 战场
 * @param victim - 英雄
 * @param killer - 输入
 */
function findKillCreditHero(world, victim, killer) {
  if (killer && killer.kind === "hero" && killer.team !== victim.team) return killer
  let result = null,
    cutoffTime = world.state.time - ECONOMY.assistWindow
  for (const [lookupKey, damageTime] of victim.h.damagers) {
    if (damageTime < cutoffTime) continue
    const getValue = world.byId.get(lookupKey)
    getValue && getValue.kind === "hero" && getValue.team !== victim.team && ((result = getValue), (cutoffTime = damageTime))
  }
  return result
}

/**
 * 处理英雄。
 *
 * @param world - 战场
 * @param victim - 英雄
 * @param killer - 英雄
 * @param fallbackKiller - 第四输入
 */
function onHeroDeath(world, victim, killer, fallbackKiller) {
  const state = world.state,
    time = state.time,
    eCONOMY = ECONOMY,
    victimStreak = victim.streak
  ;(victim.deaths++, (victim.streak = 0), (victim.respawnIn = heroRespawnSeconds(victim.level, time)), (victim.h.atkOrder = !1), (victim.h.pendingCast = null))
  const assisters = []
  for (const [builder, lastDamageTime] of victim.h.damagers) {
    if (time - lastDamageTime > eCONOMY.assistWindow) continue
    const Result = world.byId.get(builder)
    Result && Result.kind === "hero" && Result !== killer && Result.team !== victim.team && assisters.push(Result)
  }
  victim.h.damagers.clear()
  let total = 0,
    firstBlood = !1,
    shutdown = !1,
    multiKill = 0,
    killStreak = 0
  if (killer) {
    ;((total = eCONOMY.killGold + eCONOMY.killGoldPerStreak * victimStreak - DEATH_STREAK_GOLD_PENALTY * victim.h.deathStreak),
      (total = Math.max(eCONOMY.killGoldMin, Math.min(eCONOMY.killGoldMax, total))),
      world.firstBlood || ((world.firstBlood = !0), (firstBlood = !0), (total += eCONOMY.firstBloodBonus)),
      (shutdown = victimStreak >= 3))
    const hValue = killer.h
    if (
      (killer.kills++,
      killer.streak++,
      (killStreak = killer.streak),
      (hValue.multiKill = time - hValue.lastKillTime <= eCONOMY.multiKillWindow ? Math.min(5, hValue.multiKill + 1) : 1),
      (hValue.lastKillTime = time),
      (hValue.deathStreak = 0),
      (multiKill = hValue.multiKill),
      state.teams[killer.team].kills++,
      grantGold(world, killer, total, "kill", victim.pos),
      assisters.length > 0)
    ) {
      const assistGold = (total * eCONOMY.assistRatio) / assisters.length
      for (const item of assisters) (item.assists++, (item.h.deathStreak = 0), grantGold(world, item, assistGold, "assist", victim.pos))
    }
  }
  victim.h.deathStreak++
  const shareRadiusSq = eCONOMY.shareRadius * eCONOMY.shareRadius,
    xpRecipients = []
  killer && xpRecipients.push(killer)
  for (const assister of assisters) xpRecipients.push(assister)
  for (const allyHero of world.heroes) {
    if (allyHero.team === victim.team || !allyHero.alive || xpRecipients.indexOf(allyHero) >= 0) continue
    const deltaX = allyHero.pos.x - victim.pos.x,
      deltaY = allyHero.pos.y - victim.pos.y
    deltaX * deltaX + deltaY * deltaY <= shareRadiusSq && xpRecipients.push(allyHero)
  }
  if (xpRecipients.length > 0) {
    const xpReward = (eCONOMY.killXp + eCONOMY.killXpPerLevel * victim.level) * xpShareForCount(xpRecipients.length)
    for (const recipient of xpRecipients) grantXp(world, recipient, xpReward)
  }
  world.emit({ type: "heroKill", victimId: victim.id, killerId: killer ? killer.id : fallbackKiller ? fallbackKiller.id : -1, assistIds: assisters.map((assistHero) => assistHero.id), multiKill: multiKill, streak: killStreak, firstBlood: firstBlood, shutdown: shutdown, bounty: total })
  for (const victimHook of victim.h.hooks) victimHook.onDeath && victimHook.onDeath(world, victim, killer ?? fallbackKiller)
  if (killer) for (const killerHook of killer.h.hooks) (killerHook.onKill && killerHook.onKill(world, killer, victim), killerHook.onTakedown && killerHook.onTakedown(world, killer, victim, !0))
  for (const assisterHook of assisters) for (const hook of assisterHook.h.hooks) hook.onTakedown && hook.onTakedown(world, assisterHook, victim, !1)
  const opposingTeam = victim.team === 0 ? 1 : 0
  if (killer) {
    let announcementKey = null
    ;(firstBlood
      ? (announcementKey = "first_blood")
      : multiKill >= 5
        ? (announcementKey = "penta_kill")
        : multiKill === 4
          ? (announcementKey = "quadra_kill")
          : multiKill === 3
            ? (announcementKey = "triple_kill")
            : multiKill === 2
              ? (announcementKey = "double_kill")
              : shutdown
                ? (announcementKey = "shutdown")
                : killStreak >= 7
                  ? (announcementKey = "legendary")
                  : killStreak === 5
                    ? (announcementKey = "unstoppable")
                    : killStreak === 3 && (announcementKey = "killing_spree"),
      announcementKey && world.emit({ type: "announce", key: announcementKey, team: killer.team, unitId: killer.id, victimId: victim.id }))
  }
  let hasLivingTeammate = !1
  for (const teammate of world.heroes) teammate.team === victim.team && teammate.alive && (hasLivingTeammate = !0)
  hasLivingTeammate || world.emit({ type: "announce", key: "ace", team: opposingTeam, unitId: killer ? killer.id : void 0 })
}

/**
 * 处理小兵。
 *
 * @param world - 主要输入
 * @param minion - 输入
 * @param attacker - 输入
 */
function onMinionDeath(world, minion, attacker) {
  const selectedMINION_STATS = MINION_STATS[minion.minionType],
    economy = ECONOMY,
    lastHitter = attacker && attacker.kind === "hero" && attacker.team !== minion.team ? attacker : null
  if (lastHitter) {
    ;(lastHitter.cs++, grantGold(world, lastHitter, selectedMINION_STATS.gold, "lasthit", minion.pos), world.fx("gold_gain", minion.pos, lastHitter.team, { unitId: lastHitter.id, value: selectedMINION_STATS.gold }))
    for (const hook of lastHitter.h.hooks) hook.onKill && hook.onKill(world, lastHitter, minion)
  }
  const shareRadiusSq = economy.shareRadius * economy.shareRadius,
    nearbyHeroes = []
  lastHitter && nearbyHeroes.push(lastHitter)
  for (const hero of world.heroes) {
    if (hero.team === minion.team || !hero.alive || hero === lastHitter) continue
    const deltaX = hero.pos.x - minion.pos.x,
      deltaY = hero.pos.y - minion.pos.y
    deltaX * deltaX + deltaY * deltaY > shareRadiusSq || (nearbyHeroes.push(hero), grantGold(world, hero, selectedMINION_STATS.gold * economy.proximityGoldRatio, "passive", minion.pos))
  }
  if (nearbyHeroes.length > 0) {
    const xpReward = selectedMINION_STATS.xp * xpShareForCount(nearbyHeroes.length)
    for (const recipient of nearbyHeroes) grantXp(world, recipient, xpReward)
  }
}

const MONSTER_RESPAWN_HEAL_FRACTION = 0.25,
  MONSTER_REGEN_FRACTION = 0.05,
  MONSTER_LEASH_GRACE = 3,
  LAST_HIT_AGGRO_WINDOW = 2.5

function initJungleCamps(bushMap) {
  for (const camp of bushMap.map.camps) bushMap.camps.push({ def: camp, members: [], respawnAt: camp.firstSpawn })
}

function spawnCamp(world, camp) {
  const campDef = camp.def
  for (let index = 0; index < campDef.spawns.length; index++) {
    const MonsterUnitValue = createMonsterUnit(world, camp, index)
    ;(camp.members.push(MonsterUnitValue), world.addUnit(MonsterUnitValue))
  }
  ;(world.emit({ type: "monsterSpawn", campId: campDef.id, monsterType: campDef.monsterType, pos: { x: campDef.pos.x, y: campDef.pos.y } }), MONSTER_STATS[campDef.monsterType].epic && world.emit({ type: "announce", key: "epic_spawn", team: 2 }))
}

function updateJungleCamps(world) {
  const time = world.state.time,
    campStates = world.state.camps
  for (let index = 0; index < world.camps.length; index++) {
    const selectedCamps = world.camps[index]
    selectedCamps.members.length === 0 && !world.opts.noCamps && time + 1e-9 >= selectedCamps.respawnAt && spawnCamp(world, selectedCamps)
    const campAlive = selectedCamps.members.length > 0
    ;((campStates[index].alive = campAlive), (campStates[index].respawnIn = campAlive ? 0 : Math.max(0, selectedCamps.respawnAt - time)))
  }
}

const CAMP_BUFFER = []

function beginDrakeBreath(world, drake, target) {
  const jUNGLE_RULES = JUNGLE_RULES,
    now = world.state.time
  let dirX = target.pos.x - drake.pos.x,
    dirY = target.pos.y - drake.pos.y
  const distance = Math.hypot(dirX, dirY)
  distance > 1e-4 ? ((dirX /= distance), (dirY /= distance)) : ((dirX = Math.cos(drake.facing)), (dirY = Math.sin(drake.facing)))
  const breathDuration = jUNGLE_RULES.breathWarn + jUNGLE_RULES.breathTime,
    idConfig = {
      id: world.allocId(),
      ownerId: drake.id,
      pos: { x: drake.pos.x, y: drake.pos.y },
      dir: { x: dirX, y: dirY },
      radius: jUNGLE_RULES.breathRadius,
      angle: jUNGLE_RULES.breathAngle,
      age: 0,
      warn: jUNGLE_RULES.breathWarn,
      duration: breathDuration,
      start: now,
      spraying: !1,
      ticksLeft: jUNGLE_RULES.breathTicks,
      nextTick: now + jUNGLE_RULES.breathWarn,
      tickDamage: (drake.stats.ad * jUNGLE_RULES.breathAdRatio) / jUNGLE_RULES.breathTicks,
    }
  ;((drake.mon.breath = idConfig),
    (drake.mon.specialAt = now + jUNGLE_RULES.breathEvery),
    world.cones.push(idConfig),
    (drake.facing = Math.atan2(dirY, dirX)),
    startAction(world, drake, "cast_s1", breathDuration, !1),
    world.fx("drake_breath_warn", drake.pos, 2, { unitId: drake.id, targetId: target.id, dir: { x: dirX, y: dirY }, radius: jUNGLE_RULES.breathRadius, angle: jUNGLE_RULES.breathAngle, value: jUNGLE_RULES.breathWarn }))
}

function clearDrakeBreath(world, drake) {
  const breath = drake.mon.breath
  if (!breath) return
  drake.mon.breath = null
  const breathIndex = world.cones.indexOf(breath)
  ;(breathIndex >= 0 && world.cones.splice(breathIndex, 1), drake.rt.act === "cast_s1" && (drake.rt.act = null))
}

export { grantGold, LAST_HIT_AGGRO_WINDOW, clearDrakeBreath, beginDrakeBreath, onMinionDeath, CAMP_BUFFER, MONSTER_REGEN_FRACTION, MONSTER_LEASH_GRACE, findKillCreditHero, recomputeStats, initJungleCamps, interruptDash, MONSTER_RESPAWN_HEAL_FRACTION, grantXp, updateDash, resolveUnitOverlaps, updateJungleCamps, onHeroDeath }