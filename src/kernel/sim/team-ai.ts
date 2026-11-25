/**
 * 队伍 AI 决策
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { LANE_NAMES, getLaneProgress } from '../world/lane-progress'
import { AI_DIFFICULTY_PRESETS } from '../ai-difficulty'
import { __heroRow } from '../ui/banner'
import { lm } from '../skills/skill-values'
import { HERO_TABLE } from '../../heroes/registry'
import { AI_TUNING } from '../ai-tactics'
import { dist2 } from './skill-evaluation'
import { MONSTER_STATS } from '../game-balance'

const HERO_AI_ACTION_MAP = {
    panyue: { cast_s2: "s2", dash: "s1", leap: "ult" },
    chijin: { cast_s1: "s1", dash: "s2", spin: "ult" },
    xingli: { cast_s1: "s1", cast_s2: "s2", cast_ult: "ult" },
    fengling: { cast_s1: "s1", dash: "s2", cast_ult: "ult" },
    yeque: { dash: "s1", cast_s2: "s2", cast_ult: "ult" },
  },
  HERO_THREAT_RADIUS = 20,
  MINION_THREAT_RADIUS = 10,
  ENEMY_COOLDOWN_TOLERANCE = 0.1

class TeamAi {
  team
  enemyTeam
  geo
  profile
  phase = "lane"
  lanes
  tasks = new Map()
  pushLane = "mid"
  aliveAllies = 5
  aliveFoes = 5
  turtle = !1
  epicCamp = -1
  focusId = -1
  massLane = null
  massAt = -99
  squadLane = null
  squadUntil = 0
  nextSquadAt = 0
  focusUntil = 0
  epicSince = 0
  epicRetryAt = 0
  epicLastHp = new Map()
  nextUpdate = -1
  lastTime = -1
  casts = new Map()
  castStamp = new Map()
  defendHold = new Map()
  constructor(bushMap) {
    ;((this.team = bushMap.team), (this.enemyTeam = bushMap.enemyTeam), (this.geo = getLaneProgress(bushMap.map)), (this.profile = AI_DIFFICULTY_PRESETS[bushMap.difficulty]))
    const alliedCore = bushMap.alliedStructures().find((alliedStructure) => alliedStructure.kind === "core"),
      enemyCore = bushMap.enemyStructures().find((enemyStructure) => enemyStructure.kind === "core"),
      createLaneState = (laneName) => ({
        lane: laneName,
        allyFront: -1,
        enemyFront: -1,
        allyMinions: 0,
        enemyMinions: 0,
        ownStruct: alliedCore,
        ownP: 0,
        foeStruct: enemyCore,
        foeP: 0,
        foeTowers: 3,
        ownTowers: 3,
        threatHeroes: 0,
        threatMinions: 0,
        threat: 0,
        foeHeroes: 0,
        threatUntil: -1,
        threatSeen: 0,
        atFoeStruct: !1,
      })
    this.lanes = { top: createLaneState("top"), mid: createLaneState("mid"), bot: createLaneState("bot") }
  }
  observe(world) {
    if (world.time === this.lastTime) return
    this.lastTime = world.time
    const scoreboardResult = world.scoreboard()
    for (let index = 0; index < scoreboardResult.length; index++) {
      const selectedE = scoreboardResult[index]
      if (selectedE.team === this.team || !selectedE.alive || !world.canSee(selectedE)) continue
      const selectedHeroId = (__heroRow(HERO_AI_ACTION_MAP, selectedE.heroId) || {})[selectedE.anim]
      if (!selectedHeroId || this.castStamp.get(selectedE.id * 4 + (selectedHeroId === "s1" ? 0 : selectedHeroId === "s2" ? 1 : 2)) === selectedE.animStart) continue
      this.castStamp.set(selectedE.id * 4 + (selectedHeroId === "s1" ? 0 : selectedHeroId === "s2" ? 1 : 2), selectedE.animStart)
      let Value = this.casts.get(selectedE.id)
      ;(Value || ((Value = { s1: -999, s2: -999, ult: -999 }), this.casts.set(selectedE.id, Value)), (Value[selectedHeroId] = selectedE.animStart))
    }
  }
  enemyReady(enemyHero, skillIndex, currentTime) {
    const selectedLevel = lm(enemyHero.level)[skillIndex]
    if (selectedLevel <= 0) return !1
    const getValue = this.casts.get(enemyHero.id)
    if (!getValue) return !0
    const effectiveCooldown = HERO_TABLE[enemyHero.heroId].skills[skillIndex].cooldown[selectedLevel - 1] * (1 - ENEMY_COOLDOWN_TOLERANCE)
    return currentTime - getValue[skillIndex] >= effectiveCooldown
  }
  update(world) {
    ;(this.observe(world),
      !(world.time < this.nextUpdate) &&
        ((this.nextUpdate = world.time + AI_TUNING.teamTick),
        this.refreshLanes(world),
        this.refreshPhase(world),
        this.choosePushLane(world),
        this.refreshEpic(world),
        this.refreshSquad(world),
        this.assign(world),
        world.time >= this.focusUntil && (this.focusId = -1)))
  }
  taskOf(lookupKey) {
    return this.tasks.get(lookupKey) ?? { kind: "lane", lane: "mid", campId: -1 }
  }
  callFocus(focusHeroId, currentTime) {
    ;((this.focusId = focusHeroId), (this.focusUntil = currentTime + 2.5))
  }
  refreshLanes(builder) {
    const geoState = this.geo,
      teamState = this.team
    for (const laneName of LANE_NAMES) {
      const selectedLanes = this.lanes[laneName]
      ;((selectedLanes.allyFront = -1),
        (selectedLanes.enemyFront = -1),
        (selectedLanes.allyMinions = 0),
        (selectedLanes.enemyMinions = 0),
        (selectedLanes.threatHeroes = 0),
        (selectedLanes.threatMinions = 0),
        (selectedLanes.foeHeroes = 0),
        (selectedLanes.atFoeStruct = !1),
        (selectedLanes.ownTowers = 0),
        (selectedLanes.foeTowers = 0))
    }
    let ownCore = null,
      enemyCore = null
    const topConfig = { top: 9, mid: 9, bot: 9 },
      lowestFoeTierByLane = { top: 9, mid: 9, bot: 9 }
    for (const alliedStructure of builder.alliedStructures()) {
      if (alliedStructure.kind === "core") {
        ownCore = alliedStructure
        continue
      }
      const alliedStructureLane = this.lanes[alliedStructure.lane]
      ;(alliedStructureLane.ownTowers++, alliedStructure.tier < topConfig[alliedStructure.lane] && ((topConfig[alliedStructure.lane] = alliedStructure.tier), (alliedStructureLane.ownStruct = alliedStructure)))
    }
    for (const enemyStructure of builder.enemyStructures()) {
      if (enemyStructure.kind === "core") {
        enemyCore = enemyStructure
        continue
      }
      const enemyStructureLane = this.lanes[enemyStructure.lane]
      ;(enemyStructureLane.foeTowers++, enemyStructure.tier < lowestFoeTierByLane[enemyStructure.lane] && ((lowestFoeTierByLane[enemyStructure.lane] = enemyStructure.tier), (enemyStructureLane.foeStruct = enemyStructure)))
    }
    for (const progressLaneName of LANE_NAMES) {
      const progressLaneState = this.lanes[progressLaneName]
      ;(progressLaneState.ownTowers === 0 && ownCore && (progressLaneState.ownStruct = ownCore),
        progressLaneState.foeTowers === 0 && enemyCore && (progressLaneState.foeStruct = enemyCore),
        (progressLaneState.ownP = geoState.prog(teamState, progressLaneName, progressLaneState.ownStruct.pos.x, progressLaneState.ownStruct.pos.y)),
        (progressLaneState.foeP = geoState.prog(teamState, progressLaneName, progressLaneState.foeStruct.pos.x, progressLaneState.foeStruct.pos.y)))
    }
    for (const ally of builder.allies()) {
      if (ally.kind !== "minion") continue
      const allyMinionLane = this.lanes[ally.lane],
        progResult = geoState.prog(teamState, ally.lane, ally.pos.x, ally.pos.y)
      ;(allyMinionLane.allyMinions++, progResult > allyMinionLane.allyFront && (allyMinionLane.allyFront = progResult), dist2(ally.pos, allyMinionLane.foeStruct.pos) <= allyMinionLane.foeStruct.stats.attackRange && (allyMinionLane.atFoeStruct = !0))
    }
    for (const enemy of builder.enemies())
      if (enemy.kind === "minion") {
        const enemyMinionLane = this.lanes[enemy.lane],
          enemyMinionProgress = geoState.prog(teamState, enemy.lane, enemy.pos.x, enemy.pos.y)
        ;(enemyMinionLane.enemyMinions++, (enemyMinionLane.enemyFront < 0 || enemyMinionProgress < enemyMinionLane.enemyFront) && (enemyMinionLane.enemyFront = enemyMinionProgress), dist2(enemy.pos, enemyMinionLane.ownStruct.pos) <= MINION_THREAT_RADIUS && enemyMinionLane.threatMinions++)
      } else if (enemy.kind === "hero") {
        const nearestLaneResult = geoState.nearestLane(enemy.pos.x, enemy.pos.y)
        geoState.lateral < 10 && this.lanes[nearestLaneResult].foeHeroes++
        for (const threatLaneName of LANE_NAMES) {
          const threatLaneState = this.lanes[threatLaneName]
          dist2(enemy.pos, threatLaneState.ownStruct.pos) <= HERO_THREAT_RADIUS && threatLaneState.threatHeroes++
        }
      }
    for (const scoreLaneName of LANE_NAMES) {
      const scoredLaneState = this.lanes[scoreLaneName]
      scoredLaneState.threatHeroes >= 2 ? ((scoredLaneState.threatUntil = builder.time + AI_TUNING.threatHold), (scoredLaneState.threatSeen = scoredLaneState.threatHeroes)) : builder.time < scoredLaneState.threatUntil && scoredLaneState.threatHeroes < scoredLaneState.threatSeen && (scoredLaneState.threatHeroes = scoredLaneState.threatSeen)
      const recentHitBonus = builder.time - scoredLaneState.ownStruct.lastHitTime < 3 ? 1 : 0
      ;((scoredLaneState.threat = scoredLaneState.threatHeroes * 2 + Math.min(scoredLaneState.threatMinions, 6) * 0.35 + recentHitBonus), scoredLaneState.foeHeroes >= 3 && ((this.massLane = scoreLaneName), (this.massAt = builder.time)))
    }
    if (this.massLane) for (const nonMassLaneName of LANE_NAMES) nonMassLaneName !== this.massLane && this.massAt === builder.time && (this.lanes[nonMassLaneName].threatUntil = -1)
  }
  refreshPhase(world) {
    const battleState = world.state,
      scoreboardEntries = world.scoreboard()
    let aliveAllyCount = 0,
      aliveFoeCount = 0
    for (let index = 0; index < scoreboardEntries.length; index++) scoreboardEntries[index].alive && (scoreboardEntries[index].team === this.team ? aliveAllyCount++ : aliveFoeCount++)
    ;((this.aliveAllies = aliveAllyCount), (this.aliveFoes = aliveFoeCount), aliveAllyCount <= aliveFoeCount - 2 ? (this.turtle = !0) : aliveAllyCount >= aliveFoeCount && (this.turtle = !1))
    const totalTowersDestroyed = battleState.teams[0].towersDestroyed + battleState.teams[1].towersDestroyed
    ;(this.phase === "lane" && (world.time >= AI_TUNING.laneEnd || (totalTowersDestroyed >= 1 && world.time >= AI_TUNING.laneEnd * 0.7)) && (this.phase = "mid"),
      this.phase !== "late" && (world.time >= AI_TUNING.lateStart || (totalTowersDestroyed >= 5 && world.time >= AI_TUNING.lateStart * 0.8)) && (this.phase = "late"))
  }
  choosePushLane(world) {
    let bestPushLane = this.pushLane,
      bestPushScore = -1 / 0
    for (const laneName of LANE_NAMES) {
      const laneState = this.lanes[laneName],
        foeStructHpFraction = laneState.foeStruct.hp / laneState.foeStruct.stats.maxHp
      let total = (3 - laneState.foeTowers) * 1.2 + (1 - foeStructHpFraction) * 1.2
      ;(laneName === "mid" && (total += 0.6),
        laneState.allyFront >= 0 && (total += (laneState.allyFront - this.geo.total(laneName) * 0.5) / 30),
        laneState.atFoeStruct && (total += 0.8),
        laneName === this.pushLane && (total += 1.2),
        laneState.ownTowers === 0 && (total -= 0.5),
        laneName === this.massLane && world.time - this.massAt < AI_TUNING.massMemory && (total += 3),
        total > bestPushScore && ((bestPushScore = total), (bestPushLane = laneName)))
    }
    this.pushLane = bestPushLane
  }
  epicMonster(world, campId) {
    for (const monster of world.monsters()) if (monster.campId === campId) return monster
    return null
  }
  refreshEpic(builder) {
    const currentTime = builder.time
    if (this.epicCamp >= 0) {
      ;(!this.epicMonster(builder, this.epicCamp) || currentTime - this.epicSince > 50 || this.turtle) && ((this.epicCamp = -1), (this.epicRetryAt = currentTime + 12))
      return
    }
    if (currentTime < this.epicRetryAt || this.turtle || currentTime < 140) return
    this.epicRetryAt = currentTime + 4
    const scoreboardEntries = builder.scoreboard()
    for (const camp of builder.map.camps) {
      if (!MONSTER_STATS[camp.monsterType].epic) continue
      const epicMonsterResult = this.epicMonster(builder, camp.id)
      if (!epicMonsterResult) {
        this.epicLastHp.delete(camp.id)
        continue
      }
      const isColossus = camp.monsterType === "star_colossus",
        requiredHeroCount = isColossus ? AI_TUNING.colossusHeroes : AI_TUNING.drakeHeroes,
        requiredHeroLevel = isColossus ? AI_TUNING.colossusLevel : AI_TUNING.drakeLevel
      let availableAllyCount = 0,
        total = 0
      for (let index = 0; index < scoreboardEntries.length; index++) {
        const selectedS = scoreboardEntries[index]
        selectedS.team !== this.team || !selectedS.alive || selectedS.hp < selectedS.stats.maxHp * 0.55 || dist2(selectedS.pos, camp.pos) > (builder.botControlled(selectedS) ? 48 : 14) || (availableAllyCount++, (total += selectedS.level))
      }
      if (availableAllyCount < requiredHeroCount || total / availableAllyCount < requiredHeroLevel) continue
      let nearbyEnemyCount = 0
      for (const enemyHero of builder.enemyHeroes()) dist2(enemyHero.pos, camp.pos) < 20 && nearbyEnemyCount++
      const previousEpicHp = this.epicLastHp.get(camp.id) ?? epicMonsterResult.hp
      this.epicLastHp.set(camp.id, epicMonsterResult.hp)
      const monsterUnderAttack = epicMonsterResult.hp < previousEpicHp - 1 && epicMonsterResult.hp < epicMonsterResult.stats.maxHp * 0.9,
        aliveAdvantage = this.aliveAllies - this.aliveFoes
      let isActive = !1
      if ((monsterUnderAttack ? (isActive = this.profile.teamwork >= 0.9 && availableAllyCount >= requiredHeroCount + 1) : nearbyEnemyCount >= availableAllyCount ? (isActive = !1) : aliveAdvantage >= 1 ? (isActive = !0) : this.phase !== "lane" && aliveAdvantage >= 0 && (isActive = builder.rng.chance(0.25 * this.profile.teamwork)), !!isActive)) {
        ;((this.epicCamp = camp.id), (this.epicSince = currentTime))
        return
      }
    }
  }
  refreshSquad(world) {
    const currentTime = world.time
    if (this.phase !== "mid" || this.turtle || this.epicCamp >= 0) {
      ;((this.squadLane = null), this.phase === "lane" && (this.nextSquadAt = currentTime + 5))
      return
    }
    if (this.squadLane) {
      const squadLaneState = this.lanes[this.squadLane]
      ;(currentTime >= this.squadUntil || squadLaneState.foeTowers < 3 || this.lanes.mid.threat >= 3) && ((this.squadLane = null), (this.nextSquadAt = currentTime + AI_TUNING.squadRest * (1.3 - 0.5 * this.profile.teamwork)))
      return
    }
    if (currentTime < this.nextSquadAt) return
    let chosenSquadLane = null,
      bestSquadScore = -1 / 0
    for (const topbot of ["top", "bot"]) {
      const candidateLaneState = this.lanes[topbot]
      if (candidateLaneState.foeTowers < 3) continue
      let total = (1 - candidateLaneState.foeStruct.hp / candidateLaneState.foeStruct.stats.maxHp) * 2 + world.rng.range(0, 1)
      ;(candidateLaneState.allyFront >= 0 && (total += (candidateLaneState.allyFront - this.geo.total(topbot) * 0.5) / 25), (total += candidateLaneState.foeHeroes * 0.3), total > bestSquadScore && ((bestSquadScore = total), (chosenSquadLane = topbot)))
    }
    if (!chosenSquadLane) {
      this.nextSquadAt = currentTime + 10
      return
    }
    ;((this.squadLane = chosenSquadLane), (this.squadUntil = currentTime + AI_TUNING.squadTime))
  }
  assign(world) {
    const scoreboardEntries = world.scoreboard(),
      allyHeroes = []
    for (let index = 0; index < scoreboardEntries.length; index++) scoreboardEntries[index].team === this.team && allyHeroes.push(scoreboardEntries[index])
    const isBotControlled = (checkedHero) => world.botControlled(checkedHero),
      aliveAdvantage = this.aliveAllies - this.aliveFoes,
      shouldPush = this.phase !== "lane" && aliveAdvantage >= 2
    for (const allyHero of allyHeroes) {
      let assignedTask
      const taskLane = allyHero.lane === "jungle" ? "mid" : allyHero.lane
      ;(this.phase === "late" || shouldPush
        ? (assignedTask = { kind: "push", lane: this.pushLane, campId: -1 })
        : this.squadLane && (allyHero.lane === "jungle" || allyHero.lane === "mid")
          ? (assignedTask = { kind: "push", lane: this.squadLane, campId: -1 })
          : allyHero.lane === "jungle"
            ? (assignedTask = { kind: "jungle", lane: taskLane, campId: -1 })
            : this.phase === "mid" && this.lanes[taskLane].foeTowers < 3
              ? (assignedTask = { kind: "push", lane: this.pushLane, campId: -1 })
              : (assignedTask = { kind: "lane", lane: taskLane, campId: -1 }),
        this.tasks.set(allyHero.heroId, assignedTask))
    }
    if (this.turtle) {
      let mostThreatenedLane = this.pushLane,
        highestThreat = 0
      for (const defenseLaneName of LANE_NAMES) this.lanes[defenseLaneName].threat > highestThreat && ((highestThreat = this.lanes[defenseLaneName].threat), (mostThreatenedLane = defenseLaneName))
      for (const defendHero of allyHeroes) {
        const Result = this.tasks.get(defendHero.heroId)
        Result && Result.kind === "push" && this.tasks.set(defendHero.heroId, { kind: "defend", lane: highestThreat > 0 ? mostThreatenedLane : Result.lane, campId: -1 })
      }
    }
    const assignedHeroIds = new Set(),
      sortResult = [...LANE_NAMES].sort((firstLane, secondLane) => this.lanes[secondLane].threat - this.lanes[firstLane].threat)
    for (const laneName of sortResult) {
      const laneState = this.lanes[laneName]
      if (laneState.threat < 1.2) continue
      const isKeyStructure = laneState.ownStruct.kind === "core" || (laneState.ownStruct.kind === "tower" && laneState.ownStruct.tier === 3)
      let defendersNeeded
      if (this.phase === "lane") {
        let hasNearbyDefender = !1
        for (const nearbyHero of allyHeroes) nearbyHero.alive && nearbyHero.lane === laneName && dist2(nearbyHero.pos, laneState.ownStruct.pos) < 24 && (hasNearbyDefender = !0)
        defendersNeeded = hasNearbyDefender ? 0 : 1
      } else ((defendersNeeded = laneState.threatHeroes > 0 ? laneState.threatHeroes + (isKeyStructure ? 1 : 0) : laneState.threatMinions >= 3 ? 1 : 0), isKeyStructure && laneState.threatHeroes >= 2 && (defendersNeeded = 5))
      for (const nonBotHero of allyHeroes) nonBotHero.alive && !isBotControlled(nonBotHero) && dist2(nonBotHero.pos, laneState.ownStruct.pos) < 18 && defendersNeeded--
      if (defendersNeeded <= 0) continue
      const defenderCandidates = allyHeroes.filter((candidateHero) => candidateHero.alive && isBotControlled(candidateHero) && !assignedHeroIds.has(candidateHero.heroId)).sort((firstDefender, secondDefender) => dist2(firstDefender.pos, laneState.ownStruct.pos) - dist2(secondDefender.pos, laneState.ownStruct.pos))
      for (const defender of defenderCandidates) {
        if (defendersNeeded <= 0) break
        ;(this.phase === "lane" && defender.lane !== "jungle" && defender.lane !== laneName) ||
          (dist2(defender.pos, laneState.ownStruct.pos) > 70 && !isKeyStructure) ||
          (this.tasks.set(defender.heroId, { kind: "defend", lane: laneName, campId: -1 }), this.defendHold.set(defender.heroId, { lane: laneName, until: world.time + AI_TUNING.defendHold }), assignedHeroIds.add(defender.heroId), defendersNeeded--)
      }
    }
    for (const heldDefender of allyHeroes) {
      const defendHoldInfo = this.defendHold.get(heldDefender.heroId)
      if (!(!defendHoldInfo || assignedHeroIds.has(heldDefender.heroId) || !heldDefender.alive)) {
        if (world.time >= defendHoldInfo.until || this.lanes[defendHoldInfo.lane].threat <= 0) {
          this.defendHold.delete(heldDefender.heroId)
          continue
        }
        ;(this.tasks.set(heldDefender.heroId, { kind: "defend", lane: defendHoldInfo.lane, campId: -1 }), assignedHeroIds.add(heldDefender.heroId))
      }
    }
    if (this.epicCamp >= 0) {
      const selectedCamps = world.map.camps[this.epicCamp],
        isColossus = selectedCamps.monsterType === "star_colossus",
        requiredEpicHeroCount = (isColossus ? AI_TUNING.colossusHeroes : AI_TUNING.drakeHeroes) + 1,
        epicCandidates = allyHeroes
          .filter((epicCandidate) => epicCandidate.alive && !assignedHeroIds.has(epicCandidate.heroId) && epicCandidate.hp >= epicCandidate.stats.maxHp * 0.5 && dist2(epicCandidate.pos, selectedCamps.pos) < (isBotControlled(epicCandidate) ? 55 : 14))
          .sort((firstEpicCandidate, secondEpicCandidate) => (firstEpicCandidate.lane === "jungle" ? -100 : 0) + dist2(firstEpicCandidate.pos, selectedCamps.pos) - ((secondEpicCandidate.lane === "jungle" ? -100 : 0) + dist2(secondEpicCandidate.pos, selectedCamps.pos)))
      let assignedEpicCount = 0
      for (const epicHero of epicCandidates) {
        if (assignedEpicCount >= requiredEpicHeroCount) break
        ;(this.tasks.set(epicHero.heroId, { kind: "epic", lane: "mid", campId: this.epicCamp }), assignedEpicCount++)
      }
      if (assignedEpicCount < (isColossus ? AI_TUNING.colossusHeroes : AI_TUNING.drakeHeroes)) {
        for (const epicHeroToReassign of epicCandidates) {
          const heroTask = this.tasks.get(epicHeroToReassign.heroId)
          heroTask && heroTask.kind === "epic" && this.tasks.set(epicHeroToReassign.heroId, epicHeroToReassign.lane === "jungle" ? { kind: "jungle", lane: "mid", campId: -1 } : { kind: "lane", lane: epicHeroToReassign.lane, campId: -1 })
        }
        ;((this.epicCamp = -1), (this.epicRetryAt = world.time + 8))
      }
    }
  }
  pushers(world, lane) {
    let result = 0
    for (const alliedHero of world.alliedHeroes()) {
      const heroTask = this.tasks.get(alliedHero.heroId)
      !heroTask || heroTask.kind !== "push" || heroTask.lane !== lane || (!world.botControlled(alliedHero) && dist2(alliedHero.pos, world.hero.pos) > 16) || result++
    }
    return result
  }
}

export { TeamAi, HERO_AI_ACTION_MAP }
