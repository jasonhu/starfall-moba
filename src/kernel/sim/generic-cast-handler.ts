/**
 * 通用技能施法 handler：__makeGenericCastHandler 闭包（声明即执行）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { interruptDash } from './unit-stats'
import { cancelAttackWindup } from './skill-cast'
import { navigateToGoal, faceTowards, TELEPORT_SEARCH_RADIUS, isStructure, isTargetable, spawnArea, createDashState } from './combat-core'
import { applyDamage, applyStatusEffect } from './combat-behavior'
import { CAMERA_PEEK_MAX_GROUND, LIGHT_TARGET_SCRATCH } from '../render/scene-rigs'
import { HERO_ACTION_SPECS, getSkillValueRaw } from './skill-evaluation'
import { HERO_TABLE } from '../../heroes/registry'
import { ICON_LIGHT_HIGHLIGHT } from '../render/procedural-art'
import { SHARED_SCRATCH_VECTOR_B } from '../render/foundation'
import { getMonotonicTime } from './match-lifecycle'

interface TargetFilterOptions {
  monsters?: boolean
  structures?: boolean
  exclude?: unknown
  heroesOnly?: boolean
  visibleTo?: string
}

interface DamageRatioKeys {
  ad?: string
  ap?: string
  hp?: string
}

interface GenericCastConfig {
  noAnim: boolean
  lockTime: number
  movement?: boolean
  aimSpeed?: number
  aimRange?: number
  aimLead?: number
  cast?: (castContext: any) => void
}

function startDash(sim, caster, dashConfig) {
  if (!caster.alive) return !1
  const runtime = caster.rt
  ;(runtime.dash && interruptDash(sim, caster, "interrupted"), cancelAttackWindup(caster))
  let coordX = dashConfig.dir.x,
    coordY = dashConfig.dir.y
  const distance = Math.hypot(coordX, coordY)
  distance < 1e-6 ? ((coordX = Math.cos(caster.facing)), (coordY = Math.sin(caster.facing))) : ((coordX /= distance), (coordY /= distance))
  const DashStateValue = createDashState(sim, "dash")
  return (
    (DashStateValue.dirX = coordX),
    (DashStateValue.dirY = coordY),
    (DashStateValue.speed = Math.max(0.1, dashConfig.speed)),
    (DashStateValue.left = Math.max(0, dashConfig.distance)),
    (DashStateValue.dur = DashStateValue.left / DashStateValue.speed),
    (DashStateValue.ignoreWalls = dashConfig.ignoreWalls === !0),
    (DashStateValue.hitRadius = dashConfig.onHit ? (dashConfig.hitRadius ?? caster.radius) : -1),
    (DashStateValue.filter = dashConfig.filter ?? null),
    (DashStateValue.onHit = dashConfig.onHit ?? null),
    (DashStateValue.onEnd = dashConfig.onEnd ?? null),
    (DashStateValue.anim = dashConfig.anim === void 0 ? "dash" : dashConfig.anim),
    (runtime.dash = DashStateValue),
    (runtime.path = null),
    (caster.facing = Math.atan2(coordY, coordX)),
    !0
  )
}

function startLeap(sim, caster, targetX, targetY, leapDuration, onArrive) {
  if (!caster.alive) return !1
  const rtValue = caster.rt
  ;(rtValue.dash && interruptDash(sim, caster, "interrupted"), cancelAttackWindup(caster))
  const xConfig = { x: caster.pos.x, y: caster.pos.y }
  sim.nav.nearestFree(targetX, targetY, rtValue.navR, xConfig, TELEPORT_SEARCH_RADIUS)
  const createDashStateDashStateValue = createDashState(sim, "leap")
  return (
    (createDashStateDashStateValue.fromX = caster.pos.x),
    (createDashStateDashStateValue.fromY = caster.pos.y),
    (createDashStateDashStateValue.toX = xConfig.x),
    (createDashStateDashStateValue.toY = xConfig.y),
    (createDashStateDashStateValue.dur = Math.max(0.05, leapDuration)),
    (createDashStateDashStateValue.ignoreWalls = !0),
    (createDashStateDashStateValue.onEnd = onArrive ?? null),
    (createDashStateDashStateValue.anim = "leap"),
    (rtValue.dash = createDashStateDashStateValue),
    (rtValue.path = null),
    faceTowards(caster, xConfig.x, xConfig.y),
    !0
  )
}

/**
 * 创建目标。
 *
 * @param team - 主要输入
 * @param filterOptions - 次要输入
 */
function makeTargetFilter(team, filterOptions: TargetFilterOptions = {}) {
  const allowMonsters = filterOptions.monsters !== !1,
    allowStructures = filterOptions.structures === !0
  return (candidate) =>
    !(candidate.team === team || !isTargetable(candidate) || candidate === filterOptions.exclude || (filterOptions.heroesOnly && candidate.kind !== "hero") || (!allowMonsters && candidate.kind === "monster") || (!allowStructures && isStructure(candidate)) || (filterOptions.visibleTo !== void 0 && !candidate.visible[filterOptions.visibleTo]))
}

const GENERIC_QUERY_BUFFER = []

/**
 * 处理目标与距离。
 *
 * @param sim - 主要输入
 * @param position - 坐标
 * @param radius - 半径
 * @param unitFilter - 回调
 */
function queryTargetsByDistance(sim, position, radius, unitFilter) {
  const Value = sim.grid.query(position.x, position.y, radius, GENERIC_QUERY_BUFFER),
    targets = [],
    distances = []
  for (let index = 0; index < Value; index++) {
    const selectedGENERIC_QUERY_BUFFER = GENERIC_QUERY_BUFFER[index]
    if (!selectedGENERIC_QUERY_BUFFER.alive) continue
    const distance = Math.hypot(selectedGENERIC_QUERY_BUFFER.pos.x - position.x, selectedGENERIC_QUERY_BUFFER.pos.y - position.y)
    if (distance > radius + selectedGENERIC_QUERY_BUFFER.radius || (unitFilter && !unitFilter(selectedGENERIC_QUERY_BUFFER))) continue
    let count = targets.length
    for (targets.push(selectedGENERIC_QUERY_BUFFER), distances.push(distance); count > 0 && distances[count - 1] > distance;) ((targets[count] = targets[count - 1]), (distances[count] = distances[count - 1]), count--)
    ;((targets[count] = selectedGENERIC_QUERY_BUFFER), (distances[count] = distance))
  }
  return targets
}

function dealSkillDamage(sim, attacker, target, amount, damageType, slot = null) {
  return applyDamage(sim, attacker, target, amount, damageType, "skill", slot)
}

/**
 * 处理技能与伤害。
 *
 * @param castContext - 主要输入
 * @param statKey - 次要输入
 * @param ratioKeys - 输入
 */
function scaleSkillDamage(castContext, statKey, ratioKeys: DamageRatioKeys = {}) {
  const casterStats = castContext.caster.stats
  let total = castContext.val(statKey)
  return (ratioKeys.ad && (total += castContext.val(ratioKeys.ad) * casterStats.ad), ratioKeys.ap && (total += castContext.val(ratioKeys.ap) * casterStats.ap), ratioKeys.hp && (total += castContext.val(ratioKeys.hp) * casterStats.maxHp), total)
}

function applyStun(sim, target, duration, caster) {
  return applyStatusEffect(sim, target, "stun", { duration: duration, sourceId: caster ? caster.id : -1 }) !== null
}

function applyKnockup(sim, target, duration, caster) {
  return applyStatusEffect(sim, target, "airborne", { duration: duration, sourceId: caster ? caster.id : -1 }) !== null
}

function applySlow(sim, target, slowStrength, duration, caster, statusKey) {
  return applyStatusEffect(sim, target, "slow", { duration: duration, value: slowStrength, sourceId: caster ? caster.id : -1, key: statusKey }) !== null
}

function applyAttackSpeedBuff(sim, target, attackSpeedBonus, duration, caster, statusKey) {
  return applyStatusEffect(sim, target, "attack_speed", { duration: duration, value: attackSpeedBonus, sourceId: caster ? caster.id : -1, key: statusKey, merge: "replace" })
}

function applyShieldBuff(sim, target, shieldAmount, duration, caster, statusKey) {
  return applyStatusEffect(sim, target, "shield", { duration: duration, value: shieldAmount, sourceId: caster ? caster.id : -1, key: statusKey, merge: "replace" })
}

function emitSkillFx(sim, fxKey, origin, team, fxPayload) {
  sim.fx(fxKey, origin, team, fxPayload)
}

function clonePoint(point) {
  return { x: point.x, y: point.y }
}

function emitHitFx(sim, caster, target, magicKind) {
  sim.fx(magicKind === "magic" ? "hit_magic" : "hit_physical", target.pos, caster.team, { unitId: caster.id, targetId: target.id })
}

function dealSkillHit(castContext, target, damageAmount, damageType) {
  return (emitHitFx(castContext.sim, castContext.caster, target, damageType), dealSkillDamage(castContext.sim, castContext.caster, target, damageAmount, damageType, castContext.slot))
}

function findMoveEndpoint(lookupKey, caster, direction, range) {
  const endpoint = { x: caster.pos.x, y: caster.pos.y }
  return (lookupKey.nav.moveStraight(endpoint, direction.x, direction.y, range, caster.rt.navR), endpoint)
}

function __tryVal(castContext, statKey, CAMERA_PEEK_MAX_GROUND) {
  try { const valResult = castContext.val(statKey); return valResult === void 0 ? CAMERA_PEEK_MAX_GROUND : valResult } catch (statValueLookupError) { return CAMERA_PEEK_MAX_GROUND }
}

function __tryStatic(heroId, skillSlot, statKey, CAMERA_PEEK_MAX_GROUND) {
  try { const SkillValueRawValue = getSkillValueRaw(heroId, skillSlot, statKey); return SkillValueRawValue === void 0 ? CAMERA_PEEK_MAX_GROUND : SkillValueRawValue } catch (skillValueLookupError) { return CAMERA_PEEK_MAX_GROUND }
}

function __makeGenericCastHandler(heroId, skillSlot) {
  const actionSpec = HERO_ACTION_SPECS[heroId] && HERO_ACTION_SPECS[heroId][skillSlot]
  const skillSpec = HERO_TABLE[heroId] && HERO_TABLE[heroId].skills[skillSlot]
  if (!actionSpec || !skillSpec) return null
  const castSpec = skillSpec.cast || {}
  const mobility = actionSpec.mobility
  const damageSpec = actionSpec.damage
  const crowdControlList = actionSpec.cc || []
  const buffs = actionSpec.selfBuffs || []
  const noAnimConfig: GenericCastConfig = { noAnim: !0, lockTime: 0 }

  const damageOf = (castContext, target) => {
    if (!damageSpec) return
    const extra: DamageRatioKeys = {}
    if (damageSpec.ad) extra.ad = damageSpec.ad
    if (damageSpec.ap) extra.ap = damageSpec.ap
    if (damageSpec.hp) extra.hp = damageSpec.hp
    const amount = scaleSkillDamage(castContext, damageSpec.base || 'damage', extra)
    if (amount > 0) dealSkillHit(castContext, target, amount, damageSpec.type || 'physical')
  }
  const applyCC = (castContext, target) => {
    for (const ccEffect of crowdControlList) {
      if (ccEffect.kind === 'knockup') applyKnockup(castContext.sim, target, ccEffect.duration, castContext.caster)
      else if (ccEffect.kind === 'stun') applyStun(castContext.sim, target, ccEffect.duration, castContext.caster)
      else if (ccEffect.kind === 'slow') applySlow(castContext.sim, target, ccEffect.value, ccEffect.duration, castContext.caster, heroId + '_' + skillSlot)
    }
  }
  const areaOf = (castContext) => actionSpec.aoeRadius || castSpec.radius || castContext.width || 1.5
  // 复用内置特效 key（未知 key 渲染层会静默跳过；复用可让新英雄零资产也有反馈）
  const dashConfig = { dash: 'panyue_s1_dash', impact: 'panyue_s1_impact', leap: 'panyue_ult_leap', land: 'panyue_ult_land', zone: 'panyue_ult_fissure', self: 'panyue_s2_cast', cast: 'chijin_s1_slash' }
  const hitArea = (castContext, centerPos) => {
    const areaOfResult = areaOf(castContext)
    emitSkillFx(castContext.sim, dashConfig.impact, centerPos, castContext.caster.team, { unitId: castContext.caster.id, radius: areaOfResult })
    for (const targetUnit of queryTargetsByDistance(castContext.sim, centerPos, areaOfResult, makeTargetFilter(castContext.caster.team))) { damageOf(castContext, targetUnit); applyCC(castContext, targetUnit) }
    return areaOfResult
  }

  // 位移类：dash / leap / blink
  if (mobility && (mobility.kind === 'dash' || mobility.kind === 'leap' || mobility.kind === 'blink')) {
    noAnimConfig.movement = !0
    if (mobility.kind === 'dash') {
      noAnimConfig.aimSpeed = __tryStatic(heroId, skillSlot, 'dashSpeed', 14)
      noAnimConfig.aimRange = actionSpec.reach || castSpec.range || 0
      noAnimConfig.cast = (castContext) => {
        const sim = castContext.sim, caster = castContext.caster
        const findMoveEndpointResult = findMoveEndpoint(sim, caster, castContext.dir, castContext.range)
        emitSkillFx(sim, dashConfig.dash, clonePoint(caster.pos), caster.team, { unitId: caster.id, dir: clonePoint(castContext.dir), from: clonePoint(caster.pos), to: findMoveEndpointResult })
        startDash(sim, caster, {
          dir: castContext.dir,
          distance: castContext.range,
          speed: __tryVal(castContext, 'dashSpeed', Math.max(1, castContext.range / (mobility.duration || 0.4))),
          hitRadius: castContext.width * 0.5,
          filter: makeTargetFilter(caster.team, { heroesOnly: mobility.stopsAtHero === !0 }),
          onHit: () => mobility.stopsAtHero === !0 ? !0 : void 0,
          onEnd: (interruptedKind) => { if (interruptedKind !== 'interrupted' && caster.alive) hitArea(castContext, caster.pos) },
        })
      }
    } else {
      noAnimConfig.aimLead = __tryStatic(heroId, skillSlot, 'leapTime', 0.4)
      noAnimConfig.cast = (castContext) => {
        const sim = castContext.sim, caster = castContext.caster
        const __tryValResult = __tryVal(castContext, 'leapTime', 0.5)
        const slowC = crowdControlList.find((ccEntry) => ccEntry.kind === 'slow')
        startLeap(sim, caster, castContext.targetPos.x, castContext.targetPos.y, __tryValResult, (arrivedKind) => {
          if (arrivedKind !== 'arrived' || !caster.alive) return
          const hitAreaResult = hitArea(castContext, caster.pos)
          emitSkillFx(sim, dashConfig.land, caster.pos, caster.team, { unitId: caster.id, radius: hitAreaResult })
          if (slowC) spawnArea(sim, {
            visual: dashConfig.zone, owner: caster, pos: clonePoint(caster.pos), radius: hitAreaResult,
            duration: slowC.duration, tickInterval: 0.25, firstTick: 0,
            onTick(world, area) { for (const targetUnit of queryTargetsByDistance(world, area.pos, area.radius, makeTargetFilter(caster.team))) applySlow(world, targetUnit, slowC.value, 0.6, caster, heroId + '_' + skillSlot + '_zone') },
          })
        })
        emitSkillFx(sim, dashConfig.leap, clonePoint(caster.pos), caster.team, { unitId: caster.id })
        applyStatusEffect(sim, caster, 'unstoppable', { duration: __tryValResult + 0.1, sourceId: caster.id, key: heroId + '_' + skillSlot, merge: 'replace' })
      }
    }
    return noAnimConfig
  }

  // 自身增益类
  if (castSpec.type === 'self' && buffs.length) {
    noAnimConfig.cast = (castContext) => {
      const sim = castContext.sim, caster = castContext.caster
      emitSkillFx(sim, dashConfig.self, caster.pos, caster.team, { unitId: caster.id, radius: castContext.radius })
      const __tryVal__tryValResult = __tryVal(castContext, 'duration', actionSpec.duration || 3)
      for (const buffName of buffs) {
        if (buffName === 'shield') {
          const shieldAmount = __tryVal(castContext, 'shield', 0) + __tryVal(castContext, 'hpRatio', 0) * caster.stats.maxHp
          if (shieldAmount > 0) applyShieldBuff(sim, caster, shieldAmount, __tryVal__tryValResult, caster, heroId + '_' + skillSlot)
        } else if (buffName === 'attack_speed' || buffName === 'haste') {
          const attackSpeedBonus = __tryVal(castContext, 'asBonus', __tryVal(castContext, 'haste', 0))
          if (attackSpeedBonus > 0) applyAttackSpeedBuff(sim, caster, attackSpeedBonus, __tryVal(castContext, 'asDur', __tryVal__tryValResult), caster, heroId + '_' + skillSlot)
        }
      }
      if (damageSpec) hitArea(castContext, caster.pos)
    }
    return noAnimConfig
  }

  // 默认：方向/锥形/目标 直接伤害
  noAnimConfig.aimRange = actionSpec.reach || castSpec.range || 0
  noAnimConfig.cast = (castContext) => {
    const sim = castContext.sim, caster = castContext.caster
    emitSkillFx(sim, dashConfig.cast, clonePoint(caster.pos), caster.team, { unitId: caster.id, dir: clonePoint(castContext.dir) })
    if (castContext.target) { damageOf(castContext, castContext.target); applyCC(castContext, castContext.target); return }
    const range = castContext.range || castSpec.range || 3
    const cosHalf = Math.cos(castContext.angle || 0.9)
    for (const targetUnit of queryTargetsByDistance(sim, caster.pos, range + 1.5, makeTargetFilter(caster.team))) {
      const deltaX = targetUnit.pos.x - caster.pos.x, deltaY = targetUnit.pos.y - caster.pos.y
      const distance = Math.hypot(deltaX, deltaY)
      if (distance > range + targetUnit.radius) continue
      if (distance > 1e-3 && (deltaX * castContext.dir.x + deltaY * castContext.dir.y) / distance < cosHalf) continue
      damageOf(castContext, targetUnit); applyCC(castContext, targetUnit)
    }
  }
  return noAnimConfig
}

export { clonePoint, applyStun, startDash, queryTargetsByDistance, applyAttackSpeedBuff, __makeGenericCastHandler, findMoveEndpoint, emitSkillFx, startLeap, makeTargetFilter, applyShieldBuff, scaleSkillDamage, applySlow, dealSkillHit, applyKnockup, dealSkillDamage }