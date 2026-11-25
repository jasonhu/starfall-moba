/**
 * 战斗模拟核心：施法 handler、状态效果、单位创建与目标筛选
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { ea, f5, lm } from '../skills/skill-values'
import { isPointInPolygon } from '../world/geometry-2d'
import { CORE_STATS, ECONOMY, LATE_GAME_SCALING, MINION_STATS, MONSTER_STATS, TOWER_STATS, VISION_RANGES, xpToNext } from '../game-balance'
import { capsuleHitsAnyCircle } from '../world/nav-grid'
import { HERO_TABLE } from '../../heroes/registry'

const MOVE_IDLE = 0,
  MOVE_DIRECTION = 1,
  MOVE_PATH = 2,
  MONSTER_IDLE = 0,
  MONSTER_ACTIVE = 1,
  MONSTER_DEAD = 2

function markNonEnumerable(targetObject, ...propertyNames) {
  for (const propertyName of propertyNames) Object.defineProperty(targetObject, propertyName, { enumerable: !1 })
  return targetObject
}

const NEARBY_QUERY_RADIUS = 8,
  RECENT_TARGET_WINDOW = 2,
  COMBAT_MEMORY_WINDOW = 5,
  DEFAULT_WINDUP_SECONDS = 0.35,
  MAX_WINDUP_TIME = 0.7;

/**
 * 计算折线总长度：从起点依次连接各点，累加相邻两点间的欧氏距离。
 *
 * @param startPoint - 折线起点
 * @param points - 后续路径点列表
 * @returns 折线总长度
 */
function polylineLength(startPoint, points) {
  let total = 0,
    currentX = startPoint.x,
    currentY = startPoint.y
  for (const point of points) ((total += Math.hypot(point.x - currentX, point.y - currentY)), (currentX = point.x), (currentY = point.y))
  return total
}

const NOOP_CAST_HANDLER = { cast: () => {} },
  CAST_HANDLERS = new Map(),
  PASSIVE_FACTORIES = new Map(),
  PASSIVE_DEFS = new Map(),
  PASSIVE_INSTANCES = new Map()

/**
 * 注册施法处理器。键格式为 `heroId:skillKey`；召唤师技能以英雄 ID 通配符 `*:skillKey` 兜底。
 */
function registerCastHandler(heroId, skillKey, castHandler) {
  CAST_HANDLERS.set(`${heroId}:${skillKey}`, castHandler)
}

function registerWildcardHandler(skillKey, castHandler) {
  CAST_HANDLERS.set(`*:${skillKey}`, castHandler)
}

/**
 * 查找施法处理器：优先精确匹配 `heroId:skillKey`，再退到通配 `*:skillKey`，最后返回空实现。
 */
function getCastHandler(heroId, skillKey) {
  return CAST_HANDLERS.get(`${heroId}:${skillKey}`) ?? CAST_HANDLERS.get(`*:${skillKey}`) ?? NOOP_CAST_HANDLER
}

function registerPassiveFactory(registrationKey, passiveFactory) {
  PASSIVE_FACTORIES.set(registrationKey, passiveFactory)
}

function getPassiveFactory(lookupKey) {
  return PASSIVE_FACTORIES.get(lookupKey)
}

function registerPassiveDef(registrationKey, passiveDefinition) {
  ;(PASSIVE_DEFS.set(registrationKey, passiveDefinition), PASSIVE_INSTANCES.clear())
}

/**
 * 获取单位当前生效的被动实例；以单位 ID 为键缓存，被动定义变更时整体失效。
 */
function getPassive(unit) {
  if (!unit.passive) return
  let activePassive = PASSIVE_INSTANCES.get(unit.id)
  if (!activePassive) {
    const passiveDefinition = PASSIVE_DEFS.get(unit.passive.id)
    if (!passiveDefinition) return
    ;((activePassive = passiveDefinition(unit)), PASSIVE_INSTANCES.set(unit.id, activePassive))
  }
  return activePassive
}

const SUMMONER_SPELL_SPECS = { recall: { type: "self", radius: 0 }, heal: { type: "self", radius: 0 }, flash: { type: "direction", range: ea.flash.range, width: 0 } }

function isSummonerSpell(spellId) {
  return spellId === "recall" || spellId === "heal" || spellId === "flash"
}

const BUSH_BOUNDS_CACHE = new WeakMap()

/**
 * 获取地图上每个草丛多边形的轴对齐包围盒，结果按地图对象缓存（WeakMap）。
 * 包围盒只用于粗筛，精确判定仍走 isPointInPolygon。
 */
function getBushBounds(bushMap) {
  let bushBoundsList = BUSH_BOUNDS_CACHE.get(bushMap)
  return (
    bushBoundsList ||
      ((bushBoundsList = bushMap.bushes.map((bushPolygon) => {
        const bounds = { minX: 1 / 0, minY: 1 / 0, maxX: -1 / 0, maxY: -1 / 0 }
        for (const vertex of bushPolygon) ((bounds.minX = Math.min(bounds.minX, vertex.x)), (bounds.minY = Math.min(bounds.minY, vertex.y)), (bounds.maxX = Math.max(bounds.maxX, vertex.x)), (bounds.maxY = Math.max(bounds.maxY, vertex.y)))
        return bounds
      })),
      BUSH_BOUNDS_CACHE.set(bushMap, bushBoundsList)),
    bushBoundsList
  )
}

/**
 * 查找坐标所在的草丛下标：先用包围盒排除明显不在范围内的草丛，
 * 再用点在多边形内判定确认；不在任何草丛时返回 -1。
 */
function findBushAt(bushMap, position) {
  const bushBoundsList = getBushBounds(bushMap)
  for (let index = 0; index < bushBoundsList.length; index++) {
    const bounds = bushBoundsList[index]
    if (!(position.x < bounds.minX || position.x > bounds.maxX || position.y < bounds.minY || position.y > bounds.maxY) && isPointInPolygon(position, bushMap.bushes[index])) return index
  }
  return -1
}

const VISIBLE_UNITS_BUFFER = []

/**
 * 每帧更新战场单位的草丛归属与阵营可见性。
 * 分两阶段：先给每个单位标注所在草丛 id，再按阵营逐个判定谁能看见谁。
 */
function updateBushVisibility(world) {
  const units = world.units,
    bushMap = world.map,
    currentTime = world.state.time,
    bushRevealRangeSquared = VISION_RANGES.bushReveal * VISION_RANGES.bushReveal
  for (let index = 0; index < units.length; index++) {
    const trackedUnit = units[index]
    ;(trackedUnit.kind === "hero" || trackedUnit.kind === "minion" || trackedUnit.kind === "monster") && (trackedUnit.bushId = trackedUnit.alive ? findBushAt(bushMap, trackedUnit.pos) : -1)
  }
  // 阶段二：按阵营缓存「能提供视野的存活单位」，再逐个计算可见性。
  for (const teamId of [0, 1]) {
    VISIBLE_UNITS_BUFFER.length = 0
    for (let viewerIndex = 0; viewerIndex < units.length; viewerIndex++) {
      const collectedUnit = units[viewerIndex]
      collectedUnit.alive && collectedUnit.team === teamId && collectedUnit.rt.sight > 0 && VISIBLE_UNITS_BUFFER.push(collectedUnit)
    }
    for (let targetIndex = 0; targetIndex < units.length; targetIndex++) {
      const evaluatedUnit = units[targetIndex]
      if (evaluatedUnit.team === teamId || evaluatedUnit.kind === "tower" || evaluatedUnit.kind === "core" || evaluatedUnit.kind === "monster" || !evaluatedUnit.alive) {
        evaluatedUnit.visible[teamId] = !0
        continue
      }
      const hiddenInBush = evaluatedUnit.bushId >= 0 && evaluatedUnit.rt.revealUntil <= currentTime
      let visibleToTeam = !1
      const evaluatedX = evaluatedUnit.pos.x,
        evaluatedY = evaluatedUnit.pos.y
      for (let viewerCursor = 0; viewerCursor < VISIBLE_UNITS_BUFFER.length; viewerCursor++) {
        const viewerUnit = VISIBLE_UNITS_BUFFER[viewerCursor],
          deltaX = viewerUnit.pos.x - evaluatedX,
          deltaY = viewerUnit.pos.y - evaluatedY,
          distanceSquared = deltaX * deltaX + deltaY * deltaY,
          viewerSight = viewerUnit.rt.sight
        if (!(distanceSquared > viewerSight * viewerSight) && !(hiddenInBush && viewerUnit.bushId !== evaluatedUnit.bushId && distanceSquared > bushRevealRangeSquared)) {
          visibleToTeam = !0
          break
        }
      }
      // 英雄一旦被看见就刷新最后目击点，AI 在失去视野后仍可据此追击。
      if (((evaluatedUnit.visible[teamId] = visibleToTeam), visibleToTeam && evaluatedUnit.kind === "hero")) {
        const lastSeenRecord = world.lastSeen[teamId][evaluatedUnit.h.index]
        ;((lastSeenRecord.x = evaluatedX), (lastSeenRecord.y = evaluatedY), (lastSeenRecord.time = currentTime))
      }
    }
  }
}

const PATH_RISK_COST_FACTOR = 1.6,
  ALLY_PERCEPTION_OFFSET = 13,
  EMPTY_HOSTILE_AREA_LIST = []

class TeamContext {
  hero
  team
  enemyTeam
  difficulty
  rng
  map
  state
  sim
  self
  cacheTick = -1
  cAllies = []
  cAlliedHeroes = []
  cEnemies = []
  cEnemyHeroes = []
  cEnemyStructures = []
  cAlliedStructures = []
  cMonsters = []
  nearBuf = []
  zones = []
  constructor(simulation, heroUnit, difficulty, randomGenerator) {
    ;((this.sim = simulation),
      (this.self = heroUnit),
      (this.hero = heroUnit),
      (this.team = heroUnit.team),
      (this.enemyTeam = heroUnit.team === 0 ? 1 : 0),
      (this.difficulty = difficulty),
      (this.rng = randomGenerator),
      (this.map = simulation.map),
      (this.state = simulation.state))
  }
  get time() {
    return this.sim.state.time
  }
  /**
   * 按 tick 缓存敌我单位分类；同一帧内重复调用直接复用上次结果。
   * 分类结果供 allies/enemies/enemyStructures 等查询方法共享。
   */
  refresh() {
    const currentTick = this.sim.state.tick
    if (currentTick === this.cacheTick) return
    this.cacheTick = currentTick
    const teamId = this.team
    ;((this.cAllies.length = 0),
      (this.cAlliedHeroes.length = 0),
      (this.cEnemies.length = 0),
      (this.cEnemyHeroes.length = 0),
      (this.cEnemyStructures.length = 0),
      (this.cAlliedStructures.length = 0),
      (this.cMonsters.length = 0))
    const units = this.sim.units
    for (let index = 0; index < units.length; index++) {
      const candidateUnit = units[index]
      candidateUnit.alive &&
        (candidateUnit.team === teamId
          ? (this.cAllies.push(candidateUnit), candidateUnit.kind === "hero" ? this.cAlliedHeroes.push(candidateUnit) : (candidateUnit.kind === "tower" || candidateUnit.kind === "core") && this.cAlliedStructures.push(candidateUnit))
          : candidateUnit.kind === "monster"
            ? this.cMonsters.push(candidateUnit)
            : candidateUnit.kind === "tower" || candidateUnit.kind === "core"
              ? this.cEnemyStructures.push(candidateUnit)
              : candidateUnit.visible[teamId] && !candidateUnit.invulnerable && !candidateUnit.rt.untargetable && (this.cEnemies.push(candidateUnit), candidateUnit.kind === "hero" && this.cEnemyHeroes.push(candidateUnit)))
    }
  }
  allies() {
    return (this.refresh(), this.cAllies)
  }
  alliedHeroes() {
    return (this.refresh(), this.cAlliedHeroes)
  }
  enemies() {
    return (this.refresh(), this.cEnemies)
  }
  enemyHeroes() {
    return (this.refresh(), this.cEnemyHeroes)
  }
  enemyStructures() {
    return (this.refresh(), this.cEnemyStructures)
  }
  alliedStructures() {
    return (this.refresh(), this.cAlliedStructures)
  }
  monsters() {
    return (this.refresh(), this.cMonsters)
  }
  perceivable(candidateUnit) {
    return candidateUnit.team === this.team || candidateUnit.kind === "monster" || candidateUnit.kind === "tower" || candidateUnit.kind === "core" || candidateUnit.visible[this.team]
  }
  unit(lookupKey) {
    const resolvedUnit = this.sim.byId.get(lookupKey)
    return resolvedUnit && this.perceivable(resolvedUnit) ? resolvedUnit : void 0
  }
  canSee(candidateUnit) {
    return candidateUnit.team === this.team || candidateUnit.visible[this.team]
  }
  /**
   * 查询坐标附近、当前阵营可感知且未被半径掩盖的存活单位。
   * 先用空间网格粗查，再做精确距离与可见性过滤。
   */
  near(position, radius) {
    const candidateCount = this.sim.grid.query(position.x, position.y, radius, this.nearBuf),
      visibleUnits = []
    for (let index = 0; index < candidateCount; index++) {
      const candidateUnit = this.nearBuf[index]
      !candidateUnit.alive || !this.perceivable(candidateUnit) || (Math.hypot(candidateUnit.pos.x - position.x, candidateUnit.pos.y - position.y) - candidateUnit.radius <= radius && visibleUnits.push(candidateUnit))
    }
    return visibleUnits
  }
  scoreboard() {
    return this.sim.heroes
  }
  lastSeen(lookupKey) {
    const targetUnit = this.sim.byId.get(lookupKey)
    return !targetUnit || targetUnit.kind !== "hero" || targetUnit.team === this.team ? null : this.sim.lastSeen[this.team][targetUnit.h.index]
  }
  botControlled(candidateUnit) {
    const resolvedUnit = this.sim.byId.get(candidateUnit.id)
    return !!resolvedUnit && resolvedUnit.kind === "hero" && resolvedUnit.team === this.team && resolvedUnit.h.controller !== null
  }
  walkable(position, navClearance) {
    return this.sim.nav.isFree(position.x, position.y, navClearance ?? this.self.rt.navR)
  }
  lineClear(startPosition, endPosition, navClearance) {
    return this.sim.nav.segmentFree(startPosition.x, startPosition.y, endPosition.x, endPosition.y, navClearance ?? this.self.rt.navR)
  }
  nearestWalkable(position) {
    const adjustedPosition = { x: position.x, y: position.y }
    return (this.sim.nav.nearestFree(position.x, position.y, this.self.rt.navR, adjustedPosition), adjustedPosition)
  }
  /**
   * 估算到目标点的导航距离：视线通畅时取直线距离，否则按寻路折线长度计算。
   * 路径终点离目标超过 2 码视为不可达，返回 Infinity。
   */
  pathDistance(destination) {
    const origin = this.self.pos,
      navigation = this.sim.nav,
      navClearance = this.self.rt.navR
    if (navigation.segmentFree(origin.x, origin.y, destination.x, destination.y, navClearance)) return Math.hypot(destination.x - origin.x, destination.y - origin.y)
    const findPathResult = navigation.findPath(origin.x, origin.y, destination.x, destination.y, navClearance)
    if (!findPathResult || findPathResult.length === 0) return 1 / 0
    const pathEnd = findPathResult[findPathResult.length - 1]
    return Math.hypot(pathEnd.x - destination.x, pathEnd.y - destination.y) > 2 ? 1 / 0 : polylineLength(origin, findPathResult)
  }
  /**
   * 规划一条规避敌方防御塔攻击范围与泉水危险圈的路径。
   * 先构造危险圆；若直线段不与危险圆相交则直达，否则交给导航网格带权寻路。
   *
   * @param destination - 目标坐标
   * @param riskMargin - 在敌方攻击范围外额外预留的安全距离
   * @returns 路径点数组；无可用路径时返回 null
   */
  safePath(destination, riskMargin = 1) {
    this.refresh()
    const origin = this.self.pos,
      navigation = this.sim.nav,
      navClearance = this.self.rt.navR,
      hazardCircles = this.zones
    hazardCircles.length = 0
    for (const enemyStructure of this.cEnemyStructures) {
      let avoidRadius = enemyStructure.stats.attackRange + riskMargin
      ;((avoidRadius = Math.min(avoidRadius, Math.hypot(origin.x - enemyStructure.pos.x, origin.y - enemyStructure.pos.y) - 0.4, Math.hypot(destination.x - enemyStructure.pos.x, destination.y - enemyStructure.pos.y) - 0.4)), avoidRadius > enemyStructure.radius + 1 && hazardCircles.push({ x: enemyStructure.pos.x, y: enemyStructure.pos.y, r: avoidRadius }))
    }
    const enemyBase = this.map.bases[this.enemyTeam],
      distance = Math.min(enemyBase.fountainRadius + riskMargin, Math.hypot(origin.x - enemyBase.fountain.x, origin.y - enemyBase.fountain.y) - 0.4, Math.hypot(destination.x - enemyBase.fountain.x, destination.y - enemyBase.fountain.y) - 0.4)
    if ((distance > 1 && hazardCircles.push({ x: enemyBase.fountain.x, y: enemyBase.fountain.y, r: distance }), navigation.segmentFree(origin.x, origin.y, destination.x, destination.y, navClearance) && !capsuleHitsAnyCircle(hazardCircles, origin.x, origin.y, destination.x, destination.y))) return [{ x: destination.x, y: destination.y }]
    const riskyPath = navigation.findPath(origin.x, origin.y, destination.x, destination.y, navClearance, hazardCircles, PATH_RISK_COST_FACTOR)
    return riskyPath && riskyPath.length > 0 ? riskyPath : null
  }
  bushAt(position) {
    return findBushAt(this.map, position)
  }
  enemyStructureCovering(position, rangeMargin = 0) {
    this.refresh()
    for (const enemyStructure of this.cEnemyStructures) {
      const attackReach = enemyStructure.stats.attackRange + rangeMargin,
        deltaX = enemyStructure.pos.x - position.x,
        deltaY = enemyStructure.pos.y - position.y
      if (deltaX * deltaX + deltaY * deltaY <= attackReach * attackReach) return enemyStructure
    }
    return null
  }
  /**
   * 判断某个坐标点是否处于我方英雄的感知范围内。
   * 在英雄视野半径上额外加 ALLY_PERCEPTION_OFFSET，用于危险区域预判。
   */
  perceivesPoint(pointX, pointY, pointRadius) {
    this.refresh()
    const perceptionRadius = ALLY_PERCEPTION_OFFSET + pointRadius
    for (const alliedHero of this.cAlliedHeroes) {
      const deltaX = alliedHero.pos.x - pointX,
        deltaY = alliedHero.pos.y - pointY
      if (deltaX * deltaX + deltaY * deltaY <= perceptionRadius * perceptionRadius) return !0
    }
    return !1
  }
  hostileAreas() {
    const perceivedAreas = []
    for (const area of this.sim.areas) area.team === this.team || area.dead || (this.perceivesPoint(area.pos.x, area.pos.y, area.radius) && perceivedAreas.push(area))
    return perceivedAreas
  }
  hostileCones() {
    const allCones = this.sim.cones
    if (allCones.length === 0) return EMPTY_HOSTILE_AREA_LIST
    const perceivedCones = []
    for (const allCone of allCones) this.perceivesPoint(allCone.pos.x, allCone.pos.y, allCone.radius) && perceivedCones.push(allCone)
    return perceivedCones
  }
  hostileProjectiles() {
    const perceivedProjectiles = []
    for (const projectile of this.sim.projectiles) projectile.team === this.team || projectile.dead || (this.perceivesPoint(projectile.pos.x, projectile.pos.y, 0) && perceivedProjectiles.push(projectile))
    return perceivedProjectiles
  }
  castSpec(skillKey) {
    return isSummonerSpell(skillKey) ? SUMMONER_SPELL_SPECS[skillKey] : HERO_TABLE[this.self.heroId].skills[skillKey].cast
  }
  skillReady(skillKey) {
    const heroUnit = this.self,
      skillState = heroUnit.skills[skillKey]
    if (!heroUnit.alive || skillState.level <= 0 || skillState.cd > 0 || heroUnit.mana < skillState.cost || heroUnit.rt.stunned || (!isSummonerSpell(skillKey) && heroUnit.rt.silenced)) return !1
    const castHandler = getCastHandler(heroUnit.heroId, skillKey)
    return castHandler.movement && heroUnit.rt.rooted ? !1 : !(castHandler.canCast && castHandler.canCast(this.sim, heroUnit) !== null)
  }
  orderState() {
    const selfUnit = this.self
    return selfUnit.h.atkOrder ? 3 : selfUnit.rt.moveMode === MOVE_PATH ? 2 : selfUnit.rt.moveMode === MOVE_DIRECTION ? 1 : 0
  }
  orderTargetId() {
    return this.self.h.atkOrder ? this.self.h.atkTargetId : -1
  }
  attackWindup() {
    return this.self.rt.windupLeft > 0
  }
  attackCooldown() {
    const runtimeState = this.self.rt,
      disarmRemaining = runtimeState.disarmUntil - this.sim.state.time
    return Math.max(0, runtimeState.atkCd, disarmRemaining)
  }
  busy() {
    const runtimeState = this.self.rt
    return runtimeState.stunned || runtimeState.dash !== null || this.sim.state.time < runtimeState.lockUntil
  }
  command(commandPayload) {
    this.sim.command(this.self.id, commandPayload)
  }
}

/**
 * 启动一次有时长的动作（施法前摇、回城等），并记录是否允许移动打断。
 * duration 为 0 时动作截止时间设为 Infinity，需由外部显式清除。
 */
function startAction(world, actingUnit, actionName, duration, cancelOnMove = !0) {
  const runtimeState = actingUnit.rt,
    startTime = world.state.time
  ;((runtimeState.act = actionName), (runtimeState.actStart = startTime), (runtimeState.actDur = duration), (runtimeState.actUntil = duration > 0 ? startTime + duration : 1 / 0), (runtimeState.actMoveCancel = cancelOnMove))
}

/**
 * 切换单位动画；仅当动画名或起始时间变化时才写入，避免每帧重复赋值。
 */
function setAnimation(targetUnit, animationName, startTime, duration) {
  ;(targetUnit.anim !== animationName || targetUnit.animStart !== startTime) && ((targetUnit.anim = animationName), (targetUnit.animStart = startTime), (targetUnit.animDur = duration))
}

/**
 * 每帧推进单位的动作与动画状态：依次处理击飞、眩晕、突进、当前动作，
 * 都没有特殊状态时回落到 move / idle。
 */
function tickCrowdControl(world, unit) {
  if (!unit.alive) return
  const runtimeState = unit.rt,
    currentTime = world.state.time
  if (runtimeState.airborne) {
    setAnimation(unit, "airborne", runtimeState.airborne.startTime, runtimeState.airborne.duration)
    return
  }
  if (runtimeState.stunned) {
    unit.anim !== "stunned" && setAnimation(unit, "stunned", currentTime, 0)
    return
  }
  const dashState = runtimeState.dash
  if (dashState && dashState.anim) {
    setAnimation(unit, dashState.anim, dashState.startTime, dashState.dur)
    return
  }
  if (runtimeState.act !== null)
    if (currentTime >= runtimeState.actUntil || (runtimeState.moved && runtimeState.actMoveCancel)) runtimeState.act = null
    else {
      setAnimation(unit, runtimeState.act, runtimeState.actStart, runtimeState.actDur)
      return
    }
  const locomotionAnimation = runtimeState.moved ? "move" : "idle"
  unit.anim !== locomotionAnimation && setAnimation(unit, locomotionAnimation, currentTime, 0)
}

/**
 * 依规格创建一个持续区域（AOE 地面效果）：补全 ID、阵营、跟随单位与回调，
 * 加入世界并发射 areaSpawn 事件；onTick/onEnd 不参与枚举。
 */
function spawnArea(world, areaSpec) {
  const tickInterval = areaSpec.tickInterval ?? 0,
    idConfig = {
      id: world.allocId(),
      visual: areaSpec.visual,
      team: areaSpec.team ?? areaSpec.owner.team,
      ownerId: areaSpec.owner.id,
      pos: { x: areaSpec.pos.x, y: areaSpec.pos.y },
      radius: areaSpec.radius,
      age: 0,
      duration: areaSpec.duration,
      followUnitId: areaSpec.follow ? areaSpec.follow.id : -1,
      tickInterval: tickInterval,
      tickLeft: areaSpec.firstTick ?? tickInterval,
      dead: !1,
      endWithFollow: areaSpec.endWithFollow !== !1,
      onTick: areaSpec.onTick ?? null,
      onEnd: areaSpec.onEnd ?? null,
    }
  return (markNonEnumerable(idConfig, "onTick", "onEnd"), world.areas.push(idConfig), world.emit({ type: "areaSpawn", id: idConfig.id, visual: idConfig.visual, pos: { x: idConfig.pos.x, y: idConfig.pos.y }, radius: idConfig.radius, duration: idConfig.duration }), idConfig)
}

/**
 * 结束区域：标记 dead、发射 areaEnd 事件并按结束原因触发 onEnd 回调。
 */
function endArea(world, area, endedNaturally) {
  area.dead || ((area.dead = !0), world.emit({ type: "areaEnd", id: area.id, visual: area.visual, pos: { x: area.pos.x, y: area.pos.y } }), area.onEnd && area.onEnd(world, area, endedNaturally))
}

function cancelArea(world, area) {
  endArea(world, area, !1)
}

/**
 * 推进所有存活区域：更新跟随位置、按间隔触发 onTick、到期触发 onEnd，
 * 最后原地基压数组清除 dead 项以避免每帧分配新数组。
 */
function updateAreas(world, deltaTime) {
  const areas = world.areas,
    initialCount = areas.length
  for (let index = 0; index < initialCount; index++) {
    const selectedAreas = areas[index]
    if (!selectedAreas.dead) {
      if (selectedAreas.followUnitId >= 0) {
        const followedUnit = world.byId.get(selectedAreas.followUnitId)
        if (followedUnit && followedUnit.alive) ((selectedAreas.pos.x = followedUnit.pos.x), (selectedAreas.pos.y = followedUnit.pos.y))
        else if (selectedAreas.endWithFollow) {
          endArea(world, selectedAreas, !1)
          continue
        }
      }
      ;((selectedAreas.age += deltaTime),
        !(selectedAreas.tickInterval > 0 && selectedAreas.onTick && ((selectedAreas.tickLeft -= deltaTime), selectedAreas.tickLeft <= 1e-9 && selectedAreas.age <= selectedAreas.duration + 1e-9 && ((selectedAreas.tickLeft += selectedAreas.tickInterval), selectedAreas.onTick(world, selectedAreas), selectedAreas.dead))) &&
          selectedAreas.age >= selectedAreas.duration - 1e-9 &&
          endArea(world, selectedAreas, !0))
    }
  }
  // 原地基压：把存活区域搬到数组前段，再截断尾部，避免每帧新建数组。
  let writeIndex = 0
  for (let readIndex = 0; readIndex < areas.length; readIndex++) {
    const currentArea = areas[readIndex]
    currentArea.dead || (areas[writeIndex++] = currentArea)
  }
  areas.length = writeIndex
}

const MAX_NAV_CLEARANCE = 0.8

function createDefaultStats(statOverrides) {
  return {
    maxHp: 1,
    maxMana: 0,
    ad: 0,
    ap: 0,
    armor: 0,
    mr: 0,
    attackSpeed: 1,
    moveSpeed: 0,
    attackRange: 0,
    hpRegen: 0,
    manaRegen: 0,
    cdr: 0,
    lifesteal: 0,
    critChance: 0,
    critDamage: 2,
    armorPen: 0,
    magicPen: 0,
    ...statOverrides,
  }
}

/**
 * 创建状态与时长。
 *
 * @param navigationRadius - 输入
 * @param weight - 输入
 * @param sight - 输入
 * @param baseType - 输入
 * @param attackType - 输入
 * @returns 结果对象
 */
/**
 * 创建单位运行时状态：导航半径会被 MAX_NAV_CLEARANCE 截断，
 * 其余字段为控制、移动、攻击、动作与视野的初始值。
 */
function createRuntimeState(navigationRadius, weight, sight, baseType, attackType) {
  return {
    navR: Math.min(navigationRadius, MAX_NAV_CLEARANCE),
    weight: weight,
    sight: sight,
    base: baseType,
    atk: attackType,
    stunned: !1,
    rooted: !1,
    silenced: !1,
    untargetable: !1,
    unstoppable: !1,
    slowImmune: !1,
    airborne: null,
    moveMode: MOVE_IDLE,
    dirX: 0,
    dirY: 0,
    path: null,
    pathIdx: 0,
    goalX: 0,
    goalY: 0,
    pathTime: -999,
    stuck: 0,
    moved: !1,
    pushX: 0,
    pushY: 0,
    dash: null,
    atkCd: 0,
    windupLeft: 0,
    windupTarget: -1,
    disarmUntil: 0,
    lockUntil: 0,
    act: null,
    actStart: 0,
    actDur: 0,
    actUntil: 0,
    actMoveCancel: !0,
    hitHeroTime: -999,
    hitHeroId: -1,
    revealUntil: -999,
    lastAttackerId: -1,
    thinkAt: 0,
    backdoor: !1,
  }
}

/**
 * 创建单位与状态。
 *
 * @param world - 战场
 * @param teamId - 输入
 * @param position - 坐标
 * @param facing - 输入
 * @param radius - 半径
 * @param stats - 输入
 * @returns 结果对象
 */
/**
 * 创建所有单位共享的基础状态：ID、阵营、坐标、半径、血量法力、Buff 容器与可见性。
 */
function createUnitBaseState(world, teamId, position, facing, radius, stats) {
  return {
    id: world.allocId(),
    team: teamId,
    pos: { x: position.x, y: position.y },
    prevPos: { x: position.x, y: position.y },
    facing: facing,
    radius: radius,
    alive: !0,
    hp: stats.maxHp,
    mana: stats.maxMana,
    stats: stats,
    buffs: [],
    shield: 0,
    anim: "idle",
    animStart: world.state.time,
    animDur: 0,
    targetId: -1,
    visible: [teamId !== 1, teamId !== 0],
    bushId: -1,
    invulnerable: !1,
    lastHitTime: -999,
  }
}

const towerFacingForTeam = (teamId) => (teamId === 1 ? Math.PI * 0.75 : -Math.PI * 0.25)

/**
 * 创建单位。
 *
 * @param world - 战场
 * @param spawnSlot - 输入
 * @param teamId - 输入
 * @param heroId - 输入
 * @param isPlayer - 输入
 */
/**
 * 按英雄定义与出生点创建一个完整英雄单位：
 * 组装等级属性、技能槽（三技能 + 三召唤师技能）、普攻规格与基础状态。
 */
function createBaseUnit(world, spawnSlot, teamId, heroId, isPlayer) {
  const heroDefinition = HERO_TABLE[heroId],
    selectedBases = world.map.bases[teamId],
    spawnPoint = selectedBases.spawns[spawnSlot % selectedBases.spawns.length],
    stats = f5(heroDefinition, 1),
    levelCurve = lm(1),
    createSkillState = (skillSlot) => ({ level: levelCurve[skillSlot], cd: 0, cdMax: heroDefinition.skills[skillSlot].cooldown[0], cost: heroDefinition.skills[skillSlot].manaCost[0] }),
    createSummonerSpellState = (cooldownSeconds) => ({ level: 1, cd: 0, cdMax: cooldownSeconds, cost: 0 }),
    skillSlots = { s1: createSkillState("s1"), s2: createSkillState("s2"), ult: createSkillState("ult"), recall: createSummonerSpellState(ea.recall.cooldown), heal: createSummonerSpellState(ea.heal.cooldown), flash: createSummonerSpellState(ea.flash.cooldown) },
    basicAttackSpec = { windup: heroDefinition.basicAttack.windup, dtype: heroDefinition.basicAttack.damageType, visual: heroDefinition.basicAttack.projectile ?? null, projSpeed: heroDefinition.basicAttack.projectileSpeed ?? 0, vsStructure: 1, vsMinion: 1 },
    heroUnit = {
      ...createUnitBaseState(world, teamId, spawnPoint, towerFacingForTeam(teamId), heroDefinition.radius, stats),
      kind: "hero",
      team: teamId,
      heroId: heroId,
      name: heroDefinition.name,
      isPlayer: isPlayer,
      lane: heroDefinition.lane,
      level: 1,
      xp: 0,
      xpToNext: xpToNext(1),
      gold: ECONOMY.startGold,
      goldEarned: ECONOMY.startGold,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      streak: 0,
      skills: skillSlots,
      items: [null, null, null, null, null, null],
      respawnIn: 0,
      dmgDealt: 0,
      dmgTaken: 0,
      dmgTower: 0,
      inCombat: !1,
      autoBuy: isPlayer && world.state.config.autoBuy === !0,
      buffs: [],
      rt: createRuntimeState(heroDefinition.radius, 2, VISION_RANGES.hero, f5(heroDefinition, 1), basicAttackSpec),
      h: {
        def: heroDefinition,
        index: spawnSlot,
        spawn: { x: spawnPoint.x, y: spawnPoint.y },
        baseLevel: 1,
        atkOrder: !1,
        atkTargetId: -1,
        atkExplicit: !1,
        pendingCast: null,
        pendingUntil: 0,
        goldFrac: 0,
        multiKill: 0,
        lastKillTime: -999,
        deathStreak: 0,
        damagers: new Map(),
        lastCombatTime: -999,
        hooks: [],
        cooldowns: new Map(),
        vars: new Map(),
        controller: null,
        nextThink: 0,
      },
    }
  return markNonEnumerable(heroUnit, "rt", "h")
}

function createMinionUnit(world, teamId, lane, siegeKind, position) {
  const selectedMINION_STATS = MINION_STATS[siegeKind],
    elapsedMinutes = world.state.time / 60,
    lateGameBoost = 1 + (Math.max(0, world.state.time - LATE_GAME_SCALING.start) / 60) * LATE_GAME_SCALING.minionBoostPerMin,
    DefaultStatsValue = createDefaultStats({ maxHp: (selectedMINION_STATS.hp + selectedMINION_STATS.hpPerMin * elapsedMinutes) * lateGameBoost, ad: (selectedMINION_STATS.ad + selectedMINION_STATS.adPerMin * elapsedMinutes) * lateGameBoost, armor: selectedMINION_STATS.armor, mr: selectedMINION_STATS.mr, attackSpeed: selectedMINION_STATS.attackSpeed, attackRange: selectedMINION_STATS.attackRange, moveSpeed: selectedMINION_STATS.moveSpeed }),
    isRanged = selectedMINION_STATS.projectileSpeed > 0,
    windupConfig = { windup: DEFAULT_WINDUP_SECONDS, dtype: "physical", visual: isRanged ? (siegeKind === "siege" ? "minion_siege" : "minion_ranged") : null, projSpeed: selectedMINION_STATS.projectileSpeed, vsStructure: selectedMINION_STATS.towerMult, vsMinion: 1 },
    weight = siegeKind === "super" || siegeKind === "siege" ? 2 : 1,
    minionUnit = {
      ...createUnitBaseState(world, teamId, position, towerFacingForTeam(teamId), selectedMINION_STATS.radius, DefaultStatsValue),
      kind: "minion",
      team: teamId,
      minionType: siegeKind,
      lane: lane,
      buffs: [],
      rt: createRuntimeState(selectedMINION_STATS.radius, weight, VISION_RANGES.minion, { ...DefaultStatsValue }, windupConfig),
      m: { offset: 0, dir: teamId === 0 ? 1 : -1, goalX: position.x, goalY: position.y, helping: !1, offLane: !1 },
    }
  return markNonEnumerable(minionUnit, "rt", "m")
}

function createTowerUnit(world, towerSpec) {
  const selectedTOWER_STATS = TOWER_STATS[towerSpec.tier],
    createDefaultStatsDefaultStatsValue = createDefaultStats({ maxHp: selectedTOWER_STATS.hp, ad: selectedTOWER_STATS.ad, armor: selectedTOWER_STATS.armor, mr: selectedTOWER_STATS.mr, attackSpeed: selectedTOWER_STATS.attackSpeed, attackRange: selectedTOWER_STATS.attackRange }),
    basicAttackSpec = { windup: 0.3, dtype: "physical", visual: "tower_bolt", projSpeed: selectedTOWER_STATS.projectileSpeed, vsStructure: 1, vsMinion: 1 },
    towerUnit = { ...createUnitBaseState(world, towerSpec.team, towerSpec.pos, towerFacingForTeam(towerSpec.team), selectedTOWER_STATS.radius, createDefaultStatsDefaultStatsValue), kind: "tower", team: towerSpec.team, lane: towerSpec.lane, tier: towerSpec.tier, buffs: [], rt: createRuntimeState(selectedTOWER_STATS.radius, 0, VISION_RANGES.tower, { ...createDefaultStatsDefaultStatsValue }, basicAttackSpec) }
  return markNonEnumerable(towerUnit, "rt")
}

function createCoreUnit(world, coreSpec) {
  const DefaultStatsResult = createDefaultStats({ maxHp: CORE_STATS.hp, ad: CORE_STATS.ad, armor: CORE_STATS.armor, mr: CORE_STATS.mr, attackSpeed: CORE_STATS.attackSpeed, attackRange: CORE_STATS.attackRange }),
    basicAttackSpec = { windup: 0.3, dtype: "physical", visual: "core_bolt", projSpeed: CORE_STATS.projectileSpeed, vsStructure: 1, vsMinion: 1 },
    coreUnit = { ...createUnitBaseState(world, coreSpec.team, coreSpec.core, towerFacingForTeam(coreSpec.team), CORE_STATS.radius, DefaultStatsResult), kind: "core", team: coreSpec.team, buffs: [], rt: createRuntimeState(CORE_STATS.radius, 0, VISION_RANGES.core, { ...DefaultStatsResult }, basicAttackSpec) }
  return markNonEnumerable(coreUnit, "rt")
}

function createMonsterUnit(world, camp, spawnIndex) {
  const monsterDef = camp.def,
    selectedMONSTER_STATS = MONSTER_STATS[monsterDef.monsterType],
    elapsedMinutes = world.state.time / 60,
    defaultStats = createDefaultStats({ maxHp: selectedMONSTER_STATS.hp + selectedMONSTER_STATS.hpPerMin * elapsedMinutes, ad: selectedMONSTER_STATS.ad + selectedMONSTER_STATS.adPerMin * elapsedMinutes, armor: selectedMONSTER_STATS.armor, mr: selectedMONSTER_STATS.mr, attackSpeed: selectedMONSTER_STATS.attackSpeed, attackRange: selectedMONSTER_STATS.attackRange, moveSpeed: selectedMONSTER_STATS.moveSpeed }),
    selectedSpawns = monsterDef.spawns[spawnIndex],
    xConfig = { x: monsterDef.pos.x + selectedSpawns.x, y: monsterDef.pos.y + selectedSpawns.y },
    basicAttackSpec = { windup: DEFAULT_WINDUP_SECONDS, dtype: "physical", visual: selectedMONSTER_STATS.projectileSpeed > 0 ? "monster_spit" : null, projSpeed: selectedMONSTER_STATS.projectileSpeed, vsStructure: 1, vsMinion: 1 },
    spawnFacing = Math.atan2(-xConfig.y, -xConfig.x),
    monsterUnit = {
      ...createUnitBaseState(world, 2, xConfig, spawnFacing, selectedMONSTER_STATS.radius, defaultStats),
      kind: "monster",
      team: 2,
      monsterType: monsterDef.monsterType,
      campId: monsterDef.id,
      buffs: [],
      rt: createRuntimeState(selectedMONSTER_STATS.radius, selectedMONSTER_STATS.epic ? 0 : 3, VISION_RANGES.monster, { ...defaultStats }, basicAttackSpec),
      mon: { home: xConfig, state: MONSTER_IDLE, camp: camp, specialAt: -1, breath: null },
    }
  return markNonEnumerable(monsterUnit, "rt", "mon")
}

function isStructure(unit) {
  return unit.kind === "tower" || unit.kind === "core"
}

function isTargetable(unit) {
  return unit.alive && !unit.invulnerable && !unit.rt.untargetable
}

function canTarget(attacker, target) {
  return !(!target.alive || target.invulnerable || target.rt.untargetable || target.team === attacker.team || (attacker.team !== 2 && !target.visible[attacker.team]))
}

const REPATH_DISTANCE_THRESHOLD = 0.6,
  REPATH_TIME_THRESHOLD = 0.25,
  STUCK_TIME_THRESHOLD = 0.35,
  PATH_STALE_PENALTY = 1,
  SEPARATION_DISTANCE_FACTOR = 0.85,
  SEPARATION_PUSH_FACTOR = 0.5,
  MAX_SEPARATION_STEP = 0.12,
  TELEPORT_SEARCH_RADIUS = 24

function faceTowards(unit, targetX, targetY) {
  const deltaX = targetX - unit.pos.x,
    deltaY = targetY - unit.pos.y
  deltaX * deltaX + deltaY * deltaY > 1e-8 && (unit.facing = Math.atan2(deltaY, deltaX))
}

function stopMovement(unit) {
  const runtime = unit.rt
  ;((runtime.moveMode = MOVE_IDLE), (runtime.path = null), (runtime.stuck = 0))
}

function setDirectionMove(unit, dirX, value) {
  const rtValue = unit.rt
  ;((rtValue.moveMode = MOVE_DIRECTION), (rtValue.dirX = dirX), (rtValue.dirY = value), (rtValue.path = null))
}

function computeUnitPath(world, unit, goalX, goalY, forcePath) {
  const runtimeState = unit.rt,
    navigation = world.nav
  if (((runtimeState.goalX = goalX), (runtimeState.goalY = goalY), (runtimeState.pathTime = world.state.time), (runtimeState.pathIdx = 0), (runtimeState.stuck = 0), !forcePath && navigation.segmentFree(unit.pos.x, unit.pos.y, goalX, goalY, runtimeState.navR))) {
    runtimeState.path = [{ x: goalX, y: goalY }]
    return
  }
  const pathPoints = navigation.findPath(unit.pos.x, unit.pos.y, goalX, goalY, runtimeState.navR)
  ;((runtimeState.path = pathPoints && pathPoints.length > 0 ? pathPoints : [{ x: goalX, y: goalY }]), (!pathPoints || navigation.lastPathPartial) && (runtimeState.pathTime += PATH_STALE_PENALTY))
}

function setPathMove(world, unit, goalX, goalY) {
  ;((unit.rt.moveMode = MOVE_PATH), computeUnitPath(world, unit, goalX, goalY, !1))
}

function advanceAlongPath(world, unit, deltaTime) {
  const runtimeState = unit.rt,
    path = runtimeState.path
  if (!path) return !1
  const navigation = world.nav,
    stepDistance = unit.stats.moveSpeed * deltaTime
  let remainingStepDistance = stepDistance
  const coordX = unit.pos.x,
    coordY = unit.pos.y
  for (; remainingStepDistance > 1e-6 && runtimeState.pathIdx < path.length;) {
    const selectedI = path[runtimeState.pathIdx],
      deltaX = selectedI.x - unit.pos.x,
      deltaY = selectedI.y - unit.pos.y,
      distance = Math.hypot(deltaX, deltaY)
    distance <= remainingStepDistance ? (distance > 1e-6 && navigation.moveWithCollision(unit.pos, deltaX, deltaY, runtimeState.navR), (remainingStepDistance -= distance), runtimeState.pathIdx++) : (navigation.moveWithCollision(unit.pos, (deltaX / distance) * remainingStepDistance, (deltaY / distance) * remainingStepDistance, runtimeState.navR), (remainingStepDistance = 0))
  }
  const movedX = unit.pos.x - coordX,
    movedY = unit.pos.y - coordY,
    movedDistance = Math.hypot(movedX, movedY)
  movedDistance > 1e-5 && ((unit.facing = Math.atan2(movedY, movedX)), (runtimeState.moved = !0))
  const isPathComplete = runtimeState.pathIdx >= path.length
  return (!isPathComplete && movedDistance < stepDistance * 0.35 ? ((runtimeState.stuck += deltaTime), runtimeState.stuck > STUCK_TIME_THRESHOLD && computeUnitPath(world, unit, runtimeState.goalX, runtimeState.goalY, !0)) : (runtimeState.stuck = 0), isPathComplete ? ((runtimeState.path = null), !1) : !0)
}

const MOVED_DISTANCE_FACTOR = 0.35,
  WALL_PROBE_DISTANCE = 0.6,
  CLEARANCE_THRESHOLD = 0.02

function slideAlongWall(world, unit, stepDistance) {
  const runtimeState = unit.rt,
    navigation = world.nav,
    perpDirX = -runtimeState.dirY,
    perpDirY = runtimeState.dirX,
    clearanceAtResult = navigation.clearanceAt(unit.pos.x, unit.pos.y),
    forwardClearance = navigation.clearanceAt(unit.pos.x + perpDirX * WALL_PROBE_DISTANCE, unit.pos.y + perpDirY * WALL_PROBE_DISTANCE),
    oppositeClearance = navigation.clearanceAt(unit.pos.x - perpDirX * WALL_PROBE_DISTANCE, unit.pos.y - perpDirY * WALL_PROBE_DISTANCE)
  if (Math.max(forwardClearance, oppositeClearance) - clearanceAtResult < CLEARANCE_THRESHOLD) return !1
  const slideStep = forwardClearance >= oppositeClearance ? stepDistance : -stepDistance
  return navigation.moveWithCollision(unit.pos, perpDirX * slideStep, perpDirY * slideStep, runtimeState.navR)
}

function updateMovement(world, unit, deltaTime) {
  const runtimeState = unit.rt
  if (runtimeState.moveMode === MOVE_DIRECTION) {
    const stepDistance = unit.stats.moveSpeed * deltaTime,
      xValue = unit.pos.x,
      yValue = unit.pos.y
    ;(world.nav.moveWithCollision(unit.pos, runtimeState.dirX * stepDistance, runtimeState.dirY * stepDistance, runtimeState.navR), (unit.facing = Math.atan2(runtimeState.dirY, runtimeState.dirX)))
    const movedX = unit.pos.x - xValue,
      movedY = unit.pos.y - yValue,
      movedDistanceSquared = movedX * movedX + movedY * movedY
    ;(movedDistanceSquared > 1e-10 && (runtimeState.moved = !0), movedDistanceSquared < stepDistance * stepDistance * MOVED_DISTANCE_FACTOR * MOVED_DISTANCE_FACTOR && slideAlongWall(world, unit, stepDistance) && (runtimeState.moved = !0))
  } else runtimeState.moveMode === MOVE_PATH && (runtimeState.path === null && computeUnitPath(world, unit, runtimeState.goalX, runtimeState.goalY, !1), advanceAlongPath(world, unit, deltaTime) || (runtimeState.moveMode = MOVE_IDLE))
}

function navigateToGoal(world, unit, goalX, goalY, deltaTime) {
  const runtimeState = unit.rt,
    currentTime = world.state.time,
    goalDeltaX = goalX - runtimeState.goalX,
    goalDeltaY = goalY - runtimeState.goalY,
    pathAge = currentTime - runtimeState.pathTime,
    path = runtimeState.path
  if (path === null) {
    if (pathAge < REPATH_TIME_THRESHOLD) return
    computeUnitPath(world, unit, goalX, goalY, !1)
  } else pathAge > 2 || (pathAge >= REPATH_TIME_THRESHOLD && goalDeltaX * goalDeltaX + goalDeltaY * goalDeltaY > REPATH_DISTANCE_THRESHOLD * REPATH_DISTANCE_THRESHOLD) ? computeUnitPath(world, unit, goalX, goalY, !1) : path.length === 1 && runtimeState.pathIdx === 0 && ((path[0].x = goalX), (path[0].y = goalY))
  advanceAlongPath(world, unit, deltaTime)
}

function moveTowards(world, unit, goalX, goalY, deltaTime) {
  const deltaX = goalX - unit.pos.x,
    deltaY = goalY - unit.pos.y,
    distance = Math.hypot(deltaX, deltaY)
  if (distance < 0.05) return !1
  const stepLength = Math.min(distance, unit.stats.moveSpeed * deltaTime),
    startX = unit.pos.x,
    startY = unit.pos.y
  world.nav.moveWithCollision(unit.pos, (deltaX / distance) * stepLength, (deltaY / distance) * stepLength, unit.rt.navR)
  const movedX = unit.pos.x - startX,
    movedY = unit.pos.y - startY
  return movedX * movedX + movedY * movedY > 1e-10 ? ((unit.facing = Math.atan2(deltaY, deltaX)), (unit.rt.moved = !0), !0) : !1
}

function teleportUnit(world, unit, targetX, targetY) {
  const runtimeState = unit.rt
  return (world.nav.nearestFree(targetX, targetY, runtimeState.navR, unit.pos, TELEPORT_SEARCH_RADIUS), (unit.prevPos.x = unit.pos.x), (unit.prevPos.y = unit.pos.y), (runtimeState.path = null), runtimeState.moveMode === MOVE_PATH && (runtimeState.moveMode = MOVE_IDLE), world.grid.rebuild(world.units), unit.pos)
}

function createDashState(world, dashMode) {
  return {
    mode: dashMode,
    dirX: 1,
    dirY: 0,
    speed: 0,
    left: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    t: 0,
    dur: 0,
    startTime: world.state.time,
    ignoreWalls: !1,
    hitRadius: -1,
    filter: null,
    hitIds: [],
    onHit: null,
    onEnd: null,
    anim: null,
  }
}

export { getPassiveFactory, faceTowards, COMBAT_MEMORY_WINDOW, NEARBY_QUERY_RADIUS, markNonEnumerable, getPassive, stopMovement, MOVE_DIRECTION, moveTowards, MAX_WINDUP_TIME, MONSTER_ACTIVE, registerCastHandler, RECENT_TARGET_WINDOW, MOVE_IDLE, isStructure, TeamContext, canTarget, getCastHandler, cancelArea, createMinionUnit, spawnArea, setDirectionMove, updateMovement, createBaseUnit, createCoreUnit, createTowerUnit, navigateToGoal, isSummonerSpell, startAction, TELEPORT_SEARCH_RADIUS, MONSTER_DEAD, teleportUnit, SEPARATION_PUSH_FACTOR, isTargetable, SUMMONER_SPELL_SPECS, registerWildcardHandler, setPathMove, registerPassiveDef, MONSTER_IDLE, MAX_SEPARATION_STEP, SEPARATION_DISTANCE_FACTOR, createMonsterUnit, tickCrowdControl, CAST_HANDLERS, registerPassiveFactory, updateAreas, updateBushVisibility, createDashState }
