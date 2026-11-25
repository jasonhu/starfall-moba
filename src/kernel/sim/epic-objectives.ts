/**
 * 史诗目标追踪
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BOT_GROUP_TIME_SEC, BOT_LANE_ORDER, BOT_ROLE_ORDER, BOT_TUNING, RETREAT_HP_THRESHOLD, estimateAttackReady, findNearestUnit, forEachVisibleUnit } from '../ui/match-flow'
import { MONSTER_STATS } from '../game-balance'
import { LaneName, formatTowerLabel } from '../equipment'
import { riverNameFor } from '../render/procedural-art'
import { getMonsterDisplayName } from '../starfall.core'

function hasObjectiveBuff(unit, buffId) {
  for (const buff of unit.buffs) if (buff.id === buffId) return !0
  return !1
}

function distanceToPolyline(position, polyline) {
  let minDistanceSquared = 1 / 0
  for (let index = 0; index + 1 < polyline.length; index++) {
    const selectedT = polyline[index],
      nextPoint = polyline[index + 1],
      segmentDx = nextPoint.x - selectedT.x,
      segmentDy = nextPoint.y - selectedT.y,
      segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy
    let projectionRatio = segmentLengthSquared > 0 ? ((position.x - selectedT.x) * segmentDx + (position.y - selectedT.y) * segmentDy) / segmentLengthSquared : 0
    projectionRatio = projectionRatio < 0 ? 0 : projectionRatio > 1 ? 1 : projectionRatio
    const closestPointOffsetX = selectedT.x + segmentDx * projectionRatio - position.x,
      closestPointOffsetY = selectedT.y + segmentDy * projectionRatio - position.y,
      closestPointDistanceSquared = closestPointOffsetX * closestPointOffsetX + closestPointOffsetY * closestPointOffsetY
    closestPointDistanceSquared < minDistanceSquared && (minDistanceSquared = closestPointDistanceSquared)
  }
  return Math.sqrt(minDistanceSquared)
}

const OBJECTIVE_LANE_NAMES = ["top", "mid", "bot"]

function findNearestLane(bushMap, lookupOption) {
  let nearestLane = "mid",
    nearestLaneDistance = 1 / 0
  for (const laneName of OBJECTIVE_LANE_NAMES) {
    const distanceToPolylineResult = distanceToPolyline(lookupOption, bushMap.map.lanes[laneName])
    distanceToPolylineResult < nearestLaneDistance && ((nearestLaneDistance = distanceToPolylineResult), (nearestLane = laneName))
  }
  return nearestLane
}

const OBJECTIVE_SNAPSHOT = { foeTowers: [], myTowers: [], foeCore: null, myCore: null, myMinions: [], foeMinions: [] }

function collectObjectiveSnapshot(world, referenceUnit) {
  const oBJECTIVE_SNAPSHOT = OBJECTIVE_SNAPSHOT
  ;((oBJECTIVE_SNAPSHOT.foeTowers.length = 0), (oBJECTIVE_SNAPSHOT.myTowers.length = 0), (oBJECTIVE_SNAPSHOT.myMinions.length = 0), (oBJECTIVE_SNAPSHOT.foeMinions.length = 0), (oBJECTIVE_SNAPSHOT.foeCore = null), (oBJECTIVE_SNAPSHOT.myCore = null))
  const myTeam = referenceUnit.team
  for (const worldUnit of world.units)
    worldUnit.alive &&
      (worldUnit.kind === "tower"
        ? (worldUnit.team === myTeam ? oBJECTIVE_SNAPSHOT.myTowers : oBJECTIVE_SNAPSHOT.foeTowers).push(worldUnit)
        : worldUnit.kind === "core"
          ? worldUnit.team === myTeam
            ? (oBJECTIVE_SNAPSHOT.myCore = worldUnit)
            : (oBJECTIVE_SNAPSHOT.foeCore = worldUnit)
          : worldUnit.kind === "minion" && (worldUnit.team === myTeam ? oBJECTIVE_SNAPSHOT.myMinions.push(worldUnit) : worldUnit.visible[myTeam] && oBJECTIVE_SNAPSHOT.foeMinions.push(worldUnit)))
  return oBJECTIVE_SNAPSHOT
}

const makePushLaneKey = (tower) => `push_lane:${tower.lane}:${tower.tier}`

function isInStructureAttackReach(lookupKey, structure, rangePad) {
  const effectiveAttackRange = structure.stats.attackRange + lookupKey.radius + rangePad
  return BOT_ROLE_ORDER(structure.pos, lookupKey.pos) <= effectiveAttackRange * effectiveAttackRange
}

function shouldHelpEpicCamp(world, hero, camp, helpRadius, hurtHpRatio) {
  let isActive = !1
  for (const campMonster of world.units) campMonster.kind !== "monster" || campMonster.campId !== camp.id || !campMonster.alive || !campMonster.visible[hero.team] || (campMonster.hp < campMonster.stats.maxHp * hurtHpRatio && (isActive = !0))
  if (!isActive) return !1
  const helpRadiusSquared = helpRadius * helpRadius
  for (const teammate of world.heroes) if (teammate.team === hero.team && teammate.id !== hero.id && teammate.alive && BOT_ROLE_ORDER(teammate.pos, camp.pos) <= helpRadiusSquared) return !0
  return !1
}

/**
 * 处理防御塔。
 *
 * @param snapshot - 主要输入
 * @param lane - 输入
 */
function lowestTierTowerInLane(snapshot, lane) {
  let result = null
  for (const foeTower of snapshot.foeTowers) foeTower.lane === lane && (!result || foeTower.tier < result.tier) && (result = foeTower)
  return result
}

const findCampById = (world, campId) => {
  const selectedCamps = world.camps[campId]
  return selectedCamps && selectedCamps.campId === campId ? selectedCamps : world.camps.find((candidateCamp) => candidateCamp.campId === campId)
}

function trackEpicObjectives(world, botHero, kbmKind, botMemory) {
  const bOT_TUNING = BOT_TUNING,
    currentTime = world.time,
    gameMap = world.map
  for (const camp of gameMap.camps) {
    if (!MONSTER_STATS[camp.monsterType].epic) continue
    const findCampByIdResult = findCampById(world, camp.id)
    findCampByIdResult && findCampByIdResult.alive ? botMemory.epicSince.has(camp.id) || botMemory.epicSince.set(camp.id, currentTime) : (botMemory.epicSince.delete(camp.id), botMemory.epicHelpAt.delete(camp.id))
  }
  const lResult = l()
  return (
    botMemory.lastId === "epic_soon" && lResult && lResult.id !== "epic_soon" && lResult.priority > 3.5 && botMemory.lastKey.startsWith("epic_soon:") && botMemory.epicSoonOff.add(Number(botMemory.lastKey.slice(10))),
    (botMemory.lastId = lResult ? lResult.id : null),
    (botMemory.lastKey = lResult ? lResult.key : ""),
    lResult
  )
  function l() {
    if (!botHero.alive || world.over) return null
    const lastAdviceId = botMemory.lastId,
      collectObjectiveSnapshotResult = collectObjectiveSnapshot(world, botHero),
      botTeam = botHero.team,
      enemyTeam = botTeam === 0 ? 1 : 0,
      healthRatio = botHero.hp / Math.max(1, botHero.stats.maxHp)
    if (healthRatio < bOT_TUNING.retreatHp[lastAdviceId === "retreat" ? 1 : 0] && !hasObjectiveBuff(botHero, "fountain") && !hasObjectiveBuff(botHero, "recall"))
      return { id: "retreat", priority: 1, key: "retreat", tone: "warn", text: kbmKind === "kbm" ? "血量危险：先后撤，按 B 回城" : "血量危险：先后撤，点「回城」" }
    if (hasObjectiveBuff(botHero, "tower_focus")) {
      let threateningStructure = null,
        nearestThreatDistanceSquared = 1 / 0
      for (const foeTower of collectObjectiveSnapshotResult.foeTowers) {
        const bOT_ROLE_ORDERResult = BOT_ROLE_ORDER(foeTower.pos, botHero.pos)
        bOT_ROLE_ORDERResult < nearestThreatDistanceSquared && ((nearestThreatDistanceSquared = bOT_ROLE_ORDERResult), (threateningStructure = foeTower))
      }
      if ((collectObjectiveSnapshotResult.foeCore && BOT_ROLE_ORDER(collectObjectiveSnapshotResult.foeCore.pos, botHero.pos) < nearestThreatDistanceSquared && (threateningStructure = collectObjectiveSnapshotResult.foeCore), threateningStructure && isInStructureAttackReach(botHero, threateningStructure, bOT_TUNING.aggroPad[lastAdviceId === "tower_aggro" ? 1 : 0]) && !estimateAttackReady(threateningStructure, collectObjectiveSnapshotResult.myMinions)))
        return { id: "tower_aggro", priority: 2, key: "tower_aggro", tone: "warn", text: "塔在打你，塔下没有小兵，先退出来" }
    }
    {
      let defendTarget = null
      const checkUnderAttack = (friendlyStructure) => {
        if (defendTarget || currentTime - friendlyStructure.lastHitTime >= bOT_TUNING.defendRecent) return
        const defendRadiusSquared = bOT_TUNING.defendRadius * bOT_TUNING.defendRadius
        for (const enemyHero of world.heroes)
          if (!(enemyHero.team === botTeam || !enemyHero.alive || !enemyHero.visible[botTeam]) && BOT_ROLE_ORDER(enemyHero.pos, friendlyStructure.pos) <= defendRadiusSquared) {
            defendTarget = friendlyStructure
            return
          }
      }
      collectObjectiveSnapshotResult.myCore && checkUnderAttack(collectObjectiveSnapshotResult.myCore)
      for (const myTower of collectObjectiveSnapshotResult.myTowers) myTower.tier === 3 && checkUnderAttack(myTower)
      const confirmedDefendTarget = defendTarget
      if (confirmedDefendTarget)
        return confirmedDefendTarget.kind === "core"
          ? { id: "defend", priority: 3, key: "defend:core", tone: "warn", text: "敌人在打我方水晶，快回防！", pos: confirmedDefendTarget.pos }
          : { id: "defend", priority: 3, key: `defend:${confirmedDefendTarget.lane}`, tone: "warn", text: `敌人在拆我方${formatTowerLabel(confirmedDefendTarget.lane, 3)}，回防！`, pos: confirmedDefendTarget.pos }
    }
    if (hasObjectiveBuff(botHero, "recall")) return { id: "heal_up", priority: 3.5, key: "heal_up", tone: "info", text: "回城中：原地别动，回泉水补满再出发" }
    if (hasObjectiveBuff(botHero, "fountain") && healthRatio < bOT_TUNING.fountainHp) return { id: "heal_up", priority: 3.5, key: "heal_up", tone: "info", text: "在泉水里补满状态再出发" }
    if (collectObjectiveSnapshotResult.foeCore && !collectObjectiveSnapshotResult.foeCore.invulnerable) {
      let brokenHighGroundLane = null,
        nearestLaneDistance = 1 / 0
      for (const laneName of OBJECTIVE_LANE_NAMES) {
        if (collectObjectiveSnapshotResult.foeTowers.some((towerInLane) => towerInLane.lane === laneName && towerInLane.tier === 3)) continue
        const forEachVisibleUnitResult = forEachVisibleUnit(world, enemyTeam, laneName, 3),
          enemyPresenceDistance = forEachVisibleUnitResult ? BOT_ROLE_ORDER(forEachVisibleUnitResult, botHero.pos) : 1 / 0
        ;(enemyPresenceDistance < nearestLaneDistance || brokenHighGroundLane === null) && ((nearestLaneDistance = enemyPresenceDistance), (brokenHighGroundLane = laneName))
      }
      if (lastAdviceId === "end_it" && botMemory.lastKey.startsWith("end_it:")) {
        const lastEndItLane = botMemory.lastKey.slice(7)
        OBJECTIVE_LANE_NAMES.indexOf(lastEndItLane) >= 0 && !collectObjectiveSnapshotResult.foeTowers.some((lastEndItTower) => lastEndItTower.lane === lastEndItLane && lastEndItTower.tier === 3) && (brokenHighGroundLane = lastEndItLane)
      }
      const highGroundText = brokenHighGroundLane ? `敌方${LaneName[brokenHighGroundLane]}高地已破` : "敌方高地已破"
      return { id: "end_it", priority: 4, key: `end_it:${brokenHighGroundLane ?? ""}`, tone: "go", text: `${highGroundText}：跟着小兵去打水晶！`, pos: collectObjectiveSnapshotResult.foeCore.pos }
    }
    {
      let aliveEnemyCount = 0
      for (const aliveEnemyHero of world.heroes) aliveEnemyHero.team !== botTeam && aliveEnemyHero.alive && aliveEnemyCount++
      if (aliveEnemyCount <= 1) return { id: "numbers", priority: 6, key: "numbers", tone: "go", text: "敌方大部分阵亡，抓紧推塔！" }
    }
    {
      const selectedPushNowDist = bOT_TUNING.pushNowDist[lastAdviceId === "push_now" ? 1 : 0],
        attackReadyBonus = lastAdviceId === "push_now" ? 2 : 0
      for (const pushableTower of collectObjectiveSnapshotResult.foeTowers)
        if (!(pushableTower.invulnerable || BOT_ROLE_ORDER(pushableTower.pos, botHero.pos) > selectedPushNowDist * selectedPushNowDist) && estimateAttackReady(pushableTower, collectObjectiveSnapshotResult.myMinions, attackReadyBonus))
          return ((botMemory.pushLane = pushableTower.lane), { id: "push_now", priority: 5, key: makePushLaneKey(pushableTower), tone: "go", text: "小兵进塔了，快打塔！", pos: pushableTower.pos })
    }
    {
      let activeEpicCamp = null,
        needsHelp = !1,
        nearestEpicCampDistance = 1 / 0
      for (const epicCamp of gameMap.camps) {
        const Value = botMemory.epicSince.get(epicCamp.id)
        if (Value === void 0) continue
        const bOT_LANE_ORDERResult = BOT_LANE_ORDER(epicCamp.pos, botHero.pos),
          wasHelpingEpic = lastAdviceId === "epic_up" && botMemory.lastKey === `epic_up:${epicCamp.id}:help`
        let shouldHelpEpicCampResult = shouldHelpEpicCamp(world, botHero, epicCamp, bOT_TUNING.epicMates[wasHelpingEpic ? 1 : 0], wasHelpingEpic ? 1 : bOT_TUNING.epicHurt)
        shouldHelpEpicCampResult ? botMemory.epicHelpAt.set(epicCamp.id, currentTime) : wasHelpingEpic && currentTime - (botMemory.epicHelpAt.get(epicCamp.id) ?? -1 / 0) <= bOT_TUNING.epicHelpLinger && (shouldHelpEpicCampResult = !0)
        const selectedEpicNear = bOT_TUNING.epicNear[lastAdviceId === "epic_up" && botMemory.lastKey === `epic_up:${epicCamp.id}` ? 1 : 0],
          isFreshEpicSpawn = !botMemory.epicTold.has(epicCamp.id) && currentTime - Value < bOT_TUNING.epicFresh
        ;(!isFreshEpicSpawn && currentTime - Value >= bOT_TUNING.epicFresh && botMemory.epicTold.add(epicCamp.id), !(!shouldHelpEpicCampResult && !isFreshEpicSpawn && bOT_LANE_ORDERResult > selectedEpicNear) && ((shouldHelpEpicCampResult && !needsHelp) || (shouldHelpEpicCampResult === needsHelp && bOT_LANE_ORDERResult < nearestEpicCampDistance)) && ((nearestEpicCampDistance = bOT_LANE_ORDERResult), (activeEpicCamp = epicCamp), (needsHelp = shouldHelpEpicCampResult)))
      }
      if (activeEpicCamp) {
        const monsterName = MONSTER_STATS[activeEpicCamp.monsterType].name,
          riverNameForResult = riverNameFor(activeEpicCamp.pos)
        return needsHelp
          ? { id: "epic_up", priority: 7, key: `epic_up:${activeEpicCamp.id}:help`, tone: "go", text: `队友在打${monsterName}(${riverNameForResult})，过去帮忙`, pos: activeEpicCamp.pos }
          : { id: "epic_up", priority: 7, key: `epic_up:${activeEpicCamp.id}`, tone: "info", text: `${monsterName}已刷新(${riverNameForResult})：一个人打不过，等队友去了再跟上` }
      }
    }
    {
      let respawningCamp = null,
        soonestRespawnIn = 1 / 0
      for (const epicCampConfig of gameMap.camps) {
        if (!MONSTER_STATS[epicCampConfig.monsterType].epic) continue
        const epicCampState = findCampById(world, epicCampConfig.id)
        if (!epicCampState || epicCampState.alive || epicCampState.respawnIn <= 0 || epicCampState.respawnIn > bOT_TUNING.epicSoon) {
          botMemory.epicSoonOff.delete(epicCampConfig.id)
          continue
        }
        botMemory.epicSoonOff.has(epicCampConfig.id) || (epicCampState.respawnIn < soonestRespawnIn && ((soonestRespawnIn = epicCampState.respawnIn), (respawningCamp = epicCampConfig)))
      }
      if (respawningCamp) return { id: "epic_soon", priority: 8, key: `epic_soon:${respawningCamp.id}`, tone: "info", text: `${MONSTER_STATS[respawningCamp.monsterType].name} ${Math.ceil(soonestRespawnIn)} 秒后刷新(${riverNameFor(respawningCamp.pos)})`, pos: respawningCamp.pos }
    }
    const isJungler = botHero.lane === "jungle",
      botLane = botHero.lane === "jungle" ? "mid" : botHero.lane
    if (world.wave === 0) {
      const nextWaveSeconds = Math.max(1, Math.ceil(world.nextWaveIn))
      if (isJungler) {
        const findNearestUnitResult = findNearestUnit(world, botHero)
        if (findNearestUnitResult) return { id: "spawn_wait", priority: 9, key: "spawn_wait", tone: "info", text: `小兵 ${nextWaveSeconds} 秒后出发，你是打野：先去${MONSTER_STATS[findNearestUnitResult.monsterType].name}那儿等着`, pos: findNearestUnitResult.pos }
      }
      const friendlyTowerPos = forEachVisibleUnit(world, botTeam, botLane)
      return { id: "spawn_wait", priority: 9, key: "spawn_wait", tone: "info", text: `小兵 ${nextWaveSeconds} 秒后出发，先去${formatTowerLabel(botLane, 1)}等着`, pos: friendlyTowerPos ?? void 0 }
    }
    if (isJungler && currentTime < RETREAT_HP_THRESHOLD) {
      let jungleCamp = null,
        nearestJungleDistance = 1 / 0,
        respawningJungleCamp = null,
        nearestRespawningJungleDistance = 1 / 0
      for (const ownJungleCamp of gameMap.camps) {
        if (ownJungleCamp.side !== botTeam) continue
        const jungleCampState = findCampById(world, ownJungleCamp.id)
        if (jungleCampState) {
          if (jungleCampState.alive) {
            const jungleCampScore = BOT_LANE_ORDER(ownJungleCamp.pos, botHero.pos) - (botMemory.lastKey === `jungle:${ownJungleCamp.id}` ? 6 : 0)
            jungleCampScore < nearestJungleDistance && ((nearestJungleDistance = jungleCampScore), (jungleCamp = ownJungleCamp))
          } else if (jungleCampState.respawnIn > 0 && jungleCampState.respawnIn <= 30 && MONSTER_STATS[ownJungleCamp.monsterType].alias) {
            const respawningJungleScore = BOT_LANE_ORDER(ownJungleCamp.pos, botHero.pos) - (botMemory.lastKey === `jungle_wait:${ownJungleCamp.id}` ? 6 : 0)
            respawningJungleScore < nearestRespawningJungleDistance && ((nearestRespawningJungleDistance = respawningJungleScore), (respawningJungleCamp = ownJungleCamp))
          }
        }
      }
      if (jungleCamp) return { id: "jungle", priority: 10, key: `jungle:${jungleCamp.id}`, tone: "info", text: `打野怪升级：去打${getMonsterDisplayName(jungleCamp)}`, pos: jungleCamp.pos }
      if (respawningJungleCamp) {
        const respawningCampState = findCampById(world, respawningJungleCamp.id)
        return { id: "jungle", priority: 10, key: `jungle_wait:${respawningJungleCamp.id}`, tone: "info", text: `野怪 ${Math.max(1, Math.ceil(respawningCampState ? respawningCampState.respawnIn : 1))} 秒后刷新，先去${getMonsterDisplayName(respawningJungleCamp)}营地等着`, pos: respawningJungleCamp.pos }
      }
    }
    if (currentTime >= BOT_GROUP_TIME_SEC) {
      let nearestTeammate = null,
        secondNearestTeammate = null,
        nearestTeammateDistance = 1 / 0,
        secondTeammateDistance = 1 / 0
      for (const teammateHero of world.heroes) {
        if (teammateHero.team !== botTeam || teammateHero.id === botHero.id || !teammateHero.alive) continue
        const bOT_ROLE_ORDERBOT_ROLE_ORDERResult = BOT_ROLE_ORDER(teammateHero.pos, botHero.pos)
        bOT_ROLE_ORDERBOT_ROLE_ORDERResult < nearestTeammateDistance ? ((secondNearestTeammate = nearestTeammate), (secondTeammateDistance = nearestTeammateDistance), (nearestTeammate = teammateHero), (nearestTeammateDistance = bOT_ROLE_ORDERBOT_ROLE_ORDERResult)) : bOT_ROLE_ORDERBOT_ROLE_ORDERResult < secondTeammateDistance && ((secondNearestTeammate = teammateHero), (secondTeammateDistance = bOT_ROLE_ORDERBOT_ROLE_ORDERResult))
      }
      if (nearestTeammate && secondNearestTeammate) {
        const xConfig = { x: (nearestTeammate.pos.x + secondNearestTeammate.pos.x) / 2, y: (nearestTeammate.pos.y + secondNearestTeammate.pos.y) / 2 }
        if (BOT_LANE_ORDER(xConfig, botHero.pos) > bOT_TUNING.groupDist[lastAdviceId === "group" ? 1 : 0]) {
          let findNearestLaneResult = findNearestLane(world, xConfig)
          const rememberedGroupLane = botMemory.groupLane !== null && currentTime - botMemory.groupAt <= bOT_TUNING.groupForget ? botMemory.groupLane : null
          return (
            rememberedGroupLane !== null && rememberedGroupLane !== findNearestLaneResult
              ? distanceToPolyline(xConfig, gameMap.lanes[rememberedGroupLane]) - distanceToPolyline(xConfig, gameMap.lanes[findNearestLaneResult]) < 6
                ? ((findNearestLaneResult = rememberedGroupLane), (botMemory.groupCand = null))
                : (botMemory.groupCand !== findNearestLaneResult && ((botMemory.groupCand = findNearestLaneResult), (botMemory.groupCandSince = currentTime)), currentTime - botMemory.groupCandSince < bOT_TUNING.groupSwitch ? (findNearestLaneResult = rememberedGroupLane) : (botMemory.groupCand = null))
              : (botMemory.groupCand = null),
            (botMemory.groupLane = findNearestLaneResult),
            (botMemory.groupAt = currentTime),
            lowestTierTowerInLane(collectObjectiveSnapshotResult, findNearestLaneResult) && (botMemory.pushLane = findNearestLaneResult),
            { id: "group", priority: 11, key: `group:${findNearestLaneResult}`, tone: "info", text: `队友在${LaneName[findNearestLaneResult]}集合，过去一起推`, pos: xConfig }
          )
        }
      }
    }
    if (currentTime < RETREAT_HP_THRESHOLD && !isJungler && distanceToPolyline(botHero.pos, gameMap.lanes[botLane]) > bOT_TUNING.backDist[lastAdviceId === "back_to_lane" ? 1 : 0]) {
      const enemyCore = gameMap.bases[enemyTeam].core
      let rallyPosition = null,
        nearestRallyDistance = 1 / 0
      for (const myMinion of collectObjectiveSnapshotResult.myMinions) {
        if (myMinion.lane !== botLane) continue
        const minionCoreDistance = BOT_ROLE_ORDER(myMinion.pos, enemyCore)
        minionCoreDistance < nearestRallyDistance && ((nearestRallyDistance = minionCoreDistance), (rallyPosition = myMinion.pos))
      }
      if (!rallyPosition)
        for (const friendlyTower of collectObjectiveSnapshotResult.myTowers) {
          if (friendlyTower.lane !== botLane) continue
          const towerCoreDistance = BOT_ROLE_ORDER(friendlyTower.pos, enemyCore)
          towerCoreDistance < nearestRallyDistance && ((nearestRallyDistance = towerCoreDistance), (rallyPosition = friendlyTower.pos))
        }
      return { id: "back_to_lane", priority: 12, key: "back_to_lane", tone: "info", text: `回到${LaneName[botLane]}，跟着小兵打`, pos: rallyPosition ?? void 0 }
    }
    if (currentTime < bOT_TUNING.farmUntil) {
      const selectedFarmDist = bOT_TUNING.farmDist[lastAdviceId === "lane_farm" ? 1 : 0]
      for (const foeMinion of collectObjectiveSnapshotResult.foeMinions)
        if (BOT_ROLE_ORDER(foeMinion.pos, botHero.pos) <= selectedFarmDist * selectedFarmDist) {
          botMemory.farmSeenAt = currentTime
          break
        }
      if (currentTime - botMemory.farmSeenAt <= (lastAdviceId === "lane_farm" ? bOT_TUNING.farmLinger : 0)) return { id: "lane_farm", priority: 13, key: "lane_farm", tone: "info", text: "补兵赚钱：给小兵最后一击" }
    }
    {
      let pushLane = null
      if (currentTime < RETREAT_HP_THRESHOLD && lowestTierTowerInLane(collectObjectiveSnapshotResult, botLane)) pushLane = botLane
      else {
        const rememberedPushLane = botMemory.pushLane && lowestTierTowerInLane(collectObjectiveSnapshotResult, botMemory.pushLane) ? botMemory.pushLane : null
        let bestLaneScore = 10
        for (const candidateLaneName of OBJECTIVE_LANE_NAMES) {
          if (!lowestTierTowerInLane(collectObjectiveSnapshotResult, candidateLaneName)) continue
          const lanePushDistance = distanceToPolyline(botHero.pos, gameMap.lanes[candidateLaneName]) - (candidateLaneName === rememberedPushLane ? 4 : 0)
          lanePushDistance < bestLaneScore && ((bestLaneScore = lanePushDistance), (pushLane = candidateLaneName))
        }
        if ((pushLane || (pushLane = rememberedPushLane), !pushLane)) {
          bestLaneScore = 1 / 0
          for (const towerLaneName of OBJECTIVE_LANE_NAMES) {
            const lowestTierTowerInLaneResult = lowestTierTowerInLane(collectObjectiveSnapshotResult, towerLaneName)
            if (!lowestTierTowerInLaneResult) continue
            const towerPushDistance = BOT_LANE_ORDER(lowestTierTowerInLaneResult.pos, botHero.pos) - (towerLaneName === botLane ? 20 : 0)
            towerPushDistance < bestLaneScore && ((bestLaneScore = towerPushDistance), (pushLane = towerLaneName))
          }
        }
      }
      const pushLaneTower = pushLane ? lowestTierTowerInLane(collectObjectiveSnapshotResult, pushLane) : null
      return pushLane && pushLaneTower
        ? ((botMemory.pushLane = pushLane), { id: "push_lane", priority: 14, key: makePushLaneKey(pushLaneTower), tone: "info", text: `跟着小兵，推掉敌方${formatTowerLabel(pushLane, pushLaneTower.tier)}`, pos: pushLaneTower.pos })
        : { id: "push_lane", priority: 14, key: "push_lane:core", tone: "info", text: "跟着小兵，去打敌方水晶", pos: gameMap.bases[enemyTeam].core }
    }
  }
}

export { trackEpicObjectives }
