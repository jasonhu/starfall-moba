/**
 * 粒子系统：ParticleSystem 发射/更新、目标指示视图与三维几何/颜色工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Matrix3, Matrix4, NoColorSpace, RGBAFormat, UnsignedByteType, Vector3 } from 'three'
import { CanvasCache, DAMAGE_TYPE_KINDS, DprCache, FLOAT_TEXT_FADE_END, FLOAT_TEXT_FADE_START, FLOAT_TEXT_LIFT, FLOAT_TEXT_MAX_STACK, FLOAT_TEXT_MIN_GAP, FLOAT_TEXT_OFFSETS, FLOAT_TEXT_POOL_SIZE, FLOAT_TEXT_STYLES, HudMarkers, TextRasterizer, floatTextEaseOut } from '../render/text-rasterizer'
import { VFX_COLORS, hexToColor, smoothStepVfx } from './fx-definitions'
import { ARENA_PALETTE } from '../arena-palette'
import { GROUND_FX_KINDS } from '../render/decal-pen'
import { VFX_RIBBON_STYLES } from './emitters'
import { VfxSystem } from './vfx-system'
import { buildClassicMap } from '../../world/map/classic'
import { BASE_PAD_RADIUS, MAP_GRID_HALF_EXTENT, SHADOW_LENGTH_FACTOR, TERRAIN_PALETTE_INDEX, TOWER_PAD_RADIUS, monsterRadius, paintSegmentIntoGrid, signedDistanceToPolygon, smoothstepClamped } from '../world/map-geometry'

class ParticleSystem {
  pool = []
  strips = []
  dpr = 1
  stagger = new Map()
  heals = new Map()
  now = 0
  a = { x: 0, y: 0, z: 0, height: 2, radius: 0.6, visible: !1, opacity: 1, unit: null }
  p = { x: 0, y: 0 }
  text
  icons
  team = 0
  constructor(textRasterizer, iconRenderer, initialDpr) {
    ;((this.text = textRasterizer), (this.icons = iconRenderer))
    for (let index = 0; index < FLOAT_TEXT_POOL_SIZE; index++)
      this.pool.push({
        live: !1,
        style: 0,
        text: "",
        sprite: null,
        wx: 0,
        wy: 0,
        wz: 0,
        ox: 0,
        oy: 0,
        dir: 1,
        t: 0,
        life: 1,
        scale: 1,
        alpha: 1,
        crit: !1,
        coin: !1,
        src: -1,
        dst: -1,
        amount: 0,
        last: 0,
        prio: 2,
        lift: 0,
        liftNow: 0,
      })
    this.setDpr(initialDpr)
  }
  setDpr(targetObject) {
    ;(targetObject === this.dpr && this.strips.length > 0) || ((this.dpr = targetObject), (this.strips = FLOAT_TEXT_STYLES.map((textStyle) => new TextRasterizer(textStyle, targetObject))))
  }
  take() {
    let selectedPool = this.pool[0]
    for (const pooledText of this.pool) {
      if (!pooledText.live) return pooledText
      pooledText.t / pooledText.life > selectedPool.t / selectedPool.life && (selectedPool = pooledText)
    }
    return selectedPool
  }
  spawn(lookupKey, pillar, worldX, worldZ, styleId, displayText, flashSkill, textAlpha, isCritical) {
    const aState = this.a
    let worldY = 1.8,
      anchorX = worldX,
      floatTextZ = worldZ
    pillar.get(lookupKey, aState) && ((anchorX = aState.x), (floatTextZ = aState.z), (worldY = aState.y + Math.min(aState.height * 0.62, 3.4)))
    let Value = this.stagger.get(lookupKey)
    ;(Value || ((Value = { t: -9, n: 0 }), this.stagger.set(lookupKey, Value)), (Value.n = this.now - Value.t < 0.8 ? Value.n + 1 : 0), (Value.t = this.now))
    const selectedFLOAT_TEXT_OFFSETS = FLOAT_TEXT_OFFSETS[Value.n % FLOAT_TEXT_OFFSETS.length]
    if (Value.n > 0) for (const pooledText of this.pool) pooledText.live && pooledText.dst === lookupKey && pooledText.t < pooledText.life * 0.85 && (pooledText.lift += isCritical ? FLOAT_TEXT_LIFT * 1.4 : FLOAT_TEXT_LIFT)
    const element = this.take()
    return (
      (element.live = !0),
      (element.style = styleId),
      (element.text = displayText),
      (element.sprite = null),
      (element.wx = anchorX),
      (element.wy = worldY),
      (element.wz = floatTextZ),
      (element.ox = selectedFLOAT_TEXT_OFFSETS[0] + 30),
      (element.oy = selectedFLOAT_TEXT_OFFSETS[1]),
      (element.dir = Value.n % 2 === 0 ? 1 : -1),
      (element.t = 0),
      (element.life = isCritical ? 1.15 : 0.95),
      (element.scale = flashSkill),
      (element.alpha = textAlpha),
      (element.crit = isCritical),
      (element.coin = !1),
      (element.src = -1),
      (element.dst = lookupKey),
      (element.amount = 0),
      (element.last = 0),
      (element.prio = 2),
      (element.lift = 0),
      (element.liftNow = 0),
      element
    )
  }
  mergeable(sourceId, targetId, styleId, damageAmount) {
    for (const element of this.pool) if (!(!element.live || element.src !== sourceId || element.dst !== targetId || element.style !== styleId) && (element.t < FLOAT_TEXT_FADE_START || (element.t < FLOAT_TEXT_FADE_END && Math.abs(element.last - damageAmount) < 1))) return element
    return null
  }
  minorFull(targetId) {
    let minorCount = 0,
      targetCount = 0
    for (const pooledText of this.pool) !pooledText.live || pooledText.prio !== 1 || (minorCount++, pooledText.dst === targetId && targetCount++)
    return minorCount >= FLOAT_TEXT_MIN_GAP || targetCount >= FLOAT_TEXT_MAX_STACK
  }
  hidden(targetUnit, playerId) {
    return targetUnit !== void 0 && targetUnit.id !== playerId && targetUnit.team !== this.team && targetUnit.team !== 2 && !targetUnit.visible[this.team]
  }
  handle(combatEvents, playerState, unitLookup, playerTeam) {
    const localPlayerId = playerState.playerId
    this.team = playerTeam === 1 ? 1 : 0
    for (const combatEvent of combatEvents)
      switch (combatEvent.type) {
        case "damage": {
          if (combatEvent.amount < 1) break
          const involvesLocalPlayer = combatEvent.sourceId === localPlayerId || combatEvent.targetId === localPlayerId,
            unitResult = unitLookup.unit(combatEvent.targetId)
          if (this.hidden(unitResult, localPlayerId) || (!involvesLocalPlayer && (unitResult === void 0 || unitResult.kind !== "hero"))) break
          const damageType = combatEvent.crit ? DAMAGE_TYPE_KINDS.crit : damageTypeFromLabel(combatEvent.dtype),
            mergeableResult = this.mergeable(combatEvent.sourceId, combatEvent.targetId, damageType, combatEvent.amount)
          if (mergeableResult) {
            ;((mergeableResult.amount += combatEvent.amount), (mergeableResult.last = combatEvent.amount))
            const roundedMergedDamage = Math.round(mergeableResult.amount)
            ;((mergeableResult.text = combatEvent.crit ? `${roundedMergedDamage}!` : String(roundedMergedDamage)), (mergeableResult.t = Math.min(mergeableResult.t, 0.04)))
            break
          }
          if (!involvesLocalPlayer && this.minorFull(combatEvent.targetId)) break
          const roundedEventDamage = Math.round(combatEvent.amount),
            spawnValue = this.spawn(combatEvent.targetId, unitLookup, combatEvent.pos.x, combatEvent.pos.y, damageType, combatEvent.crit ? `${roundedEventDamage}!` : String(roundedEventDamage), involvesLocalPlayer ? 1 : 0.7, involvesLocalPlayer ? 1 : 0.72, combatEvent.crit)
          spawnValue && ((spawnValue.src = combatEvent.sourceId), (spawnValue.amount = combatEvent.amount), (spawnValue.last = combatEvent.amount), (spawnValue.prio = involvesLocalPlayer ? 2 : 1), combatEvent.targetId === localPlayerId && combatEvent.sourceId !== localPlayerId && ((spawnValue.ox -= 60), (spawnValue.dir = -1)))
          break
        }
        case "heal": {
          const getValue = this.heals.get(combatEvent.targetId)
          getValue ? (getValue.sum += combatEvent.amount) : this.heals.set(combatEvent.targetId, { sum: combatEvent.amount, t: this.now })
          break
        }
        case "gold": {
          if (combatEvent.unitId !== localPlayerId || combatEvent.amount < 1) break
          const goldFloatText = this.spawn(localPlayerId, unitLookup, combatEvent.pos.x, combatEvent.pos.y, DAMAGE_TYPE_KINDS.gold, `+${Math.round(combatEvent.amount)}`, combatEvent.reason === "passive" ? 0.8 : 1, 1, !1)
          goldFloatText && ((goldFloatText.coin = !0), (goldFloatText.life = 1.2), (goldFloatText.oy -= 26))
          break
        }
        case "levelUp": {
          if (this.hidden(unitLookup.unit(combatEvent.unitId), localPlayerId)) break
          const spawnResult = this.spawn(combatEvent.unitId, unitLookup, 0, 0, DAMAGE_TYPE_KINDS.gold, "", 1, 1, !1)
          spawnResult && ((spawnResult.sprite = this.text.get(`升级 Lv.${combatEvent.level}`, 17, "#ffe58a", "rgba(60,34,0,0.95)", 800)), (spawnResult.life = 1.5), (spawnResult.oy -= 34))
          break
        }
      }
  }
  draw(spark, deltaTime, total, unitLookup, projectToScreen, viewportWidth, viewportHeight, uiScale) {
    if (((this.now += deltaTime), this.heals.size > 0))
      for (const [lookupKey, healEntry] of this.heals) {
        if (this.now - healEntry.t < 0.45) continue
        this.heals.delete(lookupKey)
        const healTargetUnit = unitLookup.unit(lookupKey)
        if (healEntry.sum >= 15 && healTargetUnit && (lookupKey === total.playerId || healTargetUnit.kind === "hero") && !this.hidden(healTargetUnit, total.playerId)) {
          const healFloatText = this.spawn(lookupKey, unitLookup, healTargetUnit.pos.x, healTargetUnit.pos.y, DAMAGE_TYPE_KINDS.heal, `+${Math.round(healEntry.sum)}`, lookupKey === total.playerId ? 1 : 0.8, 1, !1)
          healFloatText && ((healFloatText.ox -= 58), (healFloatText.oy -= 14), (healFloatText.dir = -1))
        }
      }
    this.stagger.size > 256 && this.stagger.clear()
    const pState = this.p,
      liftSmoothFactor = Math.min(1, deltaTime * 14)
    for (const pooledText of this.pool) pooledText.live && ((pooledText.t += deltaTime), (pooledText.liftNow += (pooledText.lift - pooledText.liftNow) * liftSmoothFactor), pooledText.t >= pooledText.life && (pooledText.live = !1))
    for (let priorityPass = 1; priorityPass <= 2; priorityPass++) this.drawPass(spark, priorityPass, projectToScreen, viewportWidth, viewportHeight, uiScale, pState)
    spark.globalAlpha = 1
  }
  drawPass(canvasContext, priorityPass, projectToScreen, viewportWidth, viewportHeight, uiScale, screenPosition) {
    for (const element of this.pool) {
      if (!element.live || (priorityPass === 1) != (element.prio === 1)) continue
      const lifeProgress = element.t / element.life
      if (!projectToScreen(element.wx, element.wy, element.wz, screenPosition) || screenPosition.x < -80 || screenPosition.x > viewportWidth + 80 || screenPosition.y < -80 || screenPosition.y > viewportHeight + 80) continue
      const easeOutProgress = 1 - (1 - lifeProgress) * (1 - lifeProgress),
        screenX = screenPosition.x + (element.ox + element.dir * 16 * lifeProgress) * uiScale,
        screenY = screenPosition.y + (element.oy - 18 - 40 * easeOutProgress - element.liftNow) * uiScale,
        textScaleFactor = element.crit ? 2 - 1 * floatTextEaseOut(Math.min(1, element.t / 0.26)) : 1.4 - 0.4 * Math.min(1, element.t / 0.12),
        textScale = element.scale * textScaleFactor * uiScale,
        effectiveAlpha = element.alpha * (lifeProgress < 0.62 ? 1 : 1 - (lifeProgress - 0.62) / 0.38)
      if (((canvasContext.globalAlpha = effectiveAlpha), element.sprite)) {
        const spriteWidth = element.sprite.w * textScale,
          spriteHeight = element.sprite.h * textScale
        canvasContext.drawImage(element.sprite.canvas, screenX - spriteWidth / 2, screenY - spriteHeight / 2, spriteWidth, spriteHeight)
      } else {
        const selectedStrips = this.strips[element.style]
        if (element.coin) {
          const coinIconWidth = selectedStrips.measure(element.text) * textScale
          this.icons.draw(canvasContext, "coin", screenX - coinIconWidth / 2 - 9 * textScale, screenY, 15 * textScale)
        }
        selectedStrips.draw(canvasContext, element.text, screenX, screenY, textScale)
      }
    }
  }
  reset() {
    for (const pooledText of this.pool) pooledText.live = !1
    ;(this.stagger.clear(), this.heals.clear())
  }
}

function damageTypeFromLabel(magicKind) {
  return magicKind === "magic" ? DAMAGE_TYPE_KINDS.magic : magicKind === "true" ? DAMAGE_TYPE_KINDS.true : DAMAGE_TYPE_KINDS.physical
}

const TARGET_POINTER_COLOR = hexToColor(ARENA_PALETTE.player.main),
  TARGET_LOCK_ENEMY_COLOR = hexToColor(16730682),
  TARGET_LOCK_MONSTER_COLOR = hexToColor(16762954),
  TARGET_RANGE_COLOR = hexToColor(16753210),
  TARGET_THREAT_COLOR = hexToColor(16725542),
  TARGET_RANGE_UNDER_COLOR = hexToColor(3803142),
  TARGET_RANGE_MARGIN = 6,
  MAX_THREAT_TOWERS = 2

class TargetIndicatorView {
  k
  pointer = -1
  lock = -1
  warn = -1
  towers = []
  facing = 0
  stamp = 0
  enabled = !0
  constructor(vfxContext) {
    this.k = vfxContext
  }
  drop(decalSlotName) {
    this[decalSlotName] >= 0 && (this.k.decals.release(this[decalSlotName], 0.15), (this[decalSlotName] = -1))
  }
  update(worldView) {
    const kindValue = this.k,
      decals = kindValue.decals,
      gameState = worldView.state,
      updateStamp = ++this.stamp,
      playerUnit = this.enabled && kindValue.anchor(gameState.playerId) && kindValue.a.unit && kindValue.a.unit.alive ? kindValue.a.unit : null
    if (!playerUnit) {
      ;(this.drop("pointer"), this.drop("lock"), this.drop("warn"))
      for (const tower of this.towers) decals.release(tower.slot, 0.15)
      this.towers.length = 0
      return
    }
    const coordX = kindValue.a.x,
      coordY = kindValue.a.y,
      coordZ = kindValue.a.z,
      unitRadius = kindValue.a.radius,
      unitHeight = kindValue.a.height
    let facingDelta = playerUnit.facing - this.facing
    ;((facingDelta = Math.atan2(Math.sin(facingDelta), Math.cos(facingDelta))),
      (this.facing += facingDelta * Math.min(1, worldView.dt * 16)),
      this.pointer < 0 && ((this.pointer = decals.hold(GROUND_FX_KINDS.pointer, 0.2)), (this.facing = playerUnit.facing)),
      decals
        .at(this.pointer)
        .at(coordX, coordZ)
        .y(0.07)
        .radius(unitRadius + 0.95)
        .rot(this.facing)
        .color(TARGET_POINTER_COLOR, 1.5, 0.9)
        .under(VFX_COLORS.shadow, 0.35))
    let isActive = !1
    if (playerUnit.targetId >= 0 && kindValue.anchor(playerUnit.targetId) && kindValue.a.visible) {
      const targetUnit = kindValue.a.unit
      targetUnit &&
        targetUnit.team !== playerUnit.team &&
        (this.lock < 0 && (this.lock = decals.hold(GROUND_FX_KINDS.lock, 0.1)),
        decals
          .at(this.lock)
          .at(kindValue.a.x, kindValue.a.z)
          .y(0.08)
          .radius(kindValue.a.radius + 0.7)
          .color(targetUnit.team === 2 ? TARGET_LOCK_MONSTER_COLOR : TARGET_LOCK_ENEMY_COLOR, 1.9, 0.95)
          .under(VFX_COLORS.shadow, 0.4),
        (isActive = !0))
    }
    isActive || this.drop("lock")
    let nearestTower = null,
      secondTower = null,
      nearestTowerDistance = 1 / 0,
      secondDistance = 1 / 0
    for (const enemyStructure of gameState.units) {
      if ((enemyStructure.kind !== "tower" && enemyStructure.kind !== "core") || !enemyStructure.alive || enemyStructure.team === playerUnit.team) continue
      const distance = Math.hypot(enemyStructure.pos.x - playerUnit.pos.x, enemyStructure.pos.y - playerUnit.pos.y)
      distance >= enemyStructure.stats.attackRange + TARGET_RANGE_MARGIN || (distance < nearestTowerDistance ? ((secondTower = nearestTower), (secondDistance = nearestTowerDistance), (nearestTower = enemyStructure), (nearestTowerDistance = distance)) : distance < secondDistance && ((secondTower = enemyStructure), (secondDistance = distance)))
    }
    let hasThreatTower = !1
    for (let index = 0; index < MAX_THREAT_TOWERS; index++) {
      const threatTower = index === 0 ? nearestTower : secondTower
      if (!threatTower) break
      const towerDistance = index === 0 ? nearestTowerDistance : secondDistance,
        attackRange = threatTower.stats.attackRange
      let towerMarker = null
      for (const existingMarker of this.towers) existingMarker.id === threatTower.id && (towerMarker = existingMarker)
      ;(towerMarker || ((towerMarker = { id: threatTower.id, slot: decals.hold(GROUND_FX_KINDS.range, 0.25), seen: updateStamp }), this.towers.push(towerMarker)), (towerMarker.seen = updateStamp))
      const isTargetingPlayer = threatTower.targetId === gameState.playerId,
        isInRange = towerDistance <= attackRange + unitRadius,
        smoothStepVfxResult = smoothStepVfx(attackRange + TARGET_RANGE_MARGIN, attackRange + TARGET_RANGE_MARGIN - 3, towerDistance),
        rangeColor = isTargetingPlayer || isInRange ? TARGET_THREAT_COLOR : TARGET_RANGE_COLOR,
        rangeIntensity = isTargetingPlayer ? 0.8 + 0.2 * Math.sin(kindValue.now * 12) : 1
      if (
        (decals
          .at(towerMarker.slot)
          .at(threatTower.pos.x, threatTower.pos.y)
          .y(0.08)
          .radius(attackRange)
          .params(isTargetingPlayer ? 0.016 : isInRange ? 0.013 : 0.011, isTargetingPlayer ? 0 : 40)
          .color(rangeColor, isTargetingPlayer ? 2.2 : isInRange ? 1.8 : 1.6, smoothStepVfxResult * rangeIntensity * (isInRange ? 1 : 0.9))
          .under(TARGET_RANGE_UNDER_COLOR, isTargetingPlayer ? 0.5 : 0.3),
        isTargetingPlayer && kindValue.anchor(threatTower.id))
      ) {
        hasThreatTower = !0
        let xValue = kindValue.a.x,
          warnY = kindValue.a.y + kindValue.a.height * 0.82,
          zValue = kindValue.a.z
        kindValue.anchors.attach?.(threatTower.id, "core", kindValue.v) && ((xValue = kindValue.v.x), (warnY = kindValue.v.y), (zValue = kindValue.v.z))
        const pulsePhase = (kindValue.now % 0.3) / 0.3
        kindValue.ribbons.line(VFX_RIBBON_STYLES.warn, xValue, warnY, zValue, coordX, coordY + unitHeight * 0.5, coordZ, TARGET_THREAT_COLOR, 0.3 + 0.7 * (1 - pulsePhase) * (1 - pulsePhase))
      }
    }
    for (let towerIndex = this.towers.length - 1; towerIndex >= 0; towerIndex--) this.towers[towerIndex].seen !== updateStamp && (decals.release(this.towers[towerIndex].slot, 0.25), this.towers.splice(towerIndex, 1))
    hasThreatTower
      ? (this.warn < 0 && (this.warn = decals.hold(GROUND_FX_KINDS.glow, 0.1)),
        decals
          .at(this.warn)
          .at(coordX, coordZ)
          .y(0.065)
          .radius(unitRadius + 1.5)
          .params(1.2)
          .color(TARGET_THREAT_COLOR, 1.2, 0.55 + 0.35 * Math.sin(kindValue.now * 12))
          .under(TARGET_RANGE_UNDER_COLOR, 0.5))
      : this.drop("warn")
  }
  reset() {
    ;((this.pointer = -1), (this.lock = -1), (this.warn = -1), (this.towers.length = 0))
  }
  dispose() {
    ;(this.drop("pointer"), this.drop("lock"), this.drop("warn"))
    for (const tower of this.towers) this.k.decals.release(tower.slot, 0)
    this.towers.length = 0
  }
}

const MAX_OVERLAY_DPR = 2

/**
 * 创建特效。
 *
 * @param overlayHost - 来源
 * @returns 结果对象
 */
function createFxOverlay(overlayHost) {
  const element = document.createElement("canvas")
  ;((element.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;"), overlayHost.overlayRoot.appendChild(element))
  const ContextValue = element.getContext("2d")
  if (!ContextValue) throw new Error("2D canvas 不可用")
  let renderPixelRatio = 1,
    viewportWidth = 1,
    viewportHeight = 1
  const dprCache = new DprCache(1),
    canvasCache = new CanvasCache(1),
    hudMarkers = new HudMarkers(dprCache, canvasCache),
    particleSystem = new ParticleSystem(dprCache, canvasCache, 1),
    barsConfig = { bars: !0, floaters: !0, marks: !0 },
    effectKit = overlayHost.getModule("fx")?.kit,
    fallbackVfxSystem = effectKit ? null : new VfxSystem(overlayHost),
    activeVfxSystem = effectKit ?? fallbackVfxSystem,
    targetIndicator = new TargetIndicatorView(activeVfxSystem),
    onVfxHook = (label) => targetIndicator.update(label)
  activeVfxSystem.hooks.push(onVfxHook)
  const onVfxClear = () => targetIndicator.reset()
  activeVfxSystem.onClear.push(onVfxClear)
  const getAnchors = () => activeVfxSystem.anchors,
    resizeOverlay = () => {
      ;((viewportWidth = Math.max(1, overlayHost.viewport.width)), (viewportHeight = Math.max(1, overlayHost.viewport.height)), (renderPixelRatio = Math.min(MAX_OVERLAY_DPR, Math.max(1, window.devicePixelRatio || 1))))
      const canvasPixelWidth = Math.round(viewportWidth * renderPixelRatio),
        canvasPixelHeight = Math.round(viewportHeight * renderPixelRatio)
      ;(element.width !== canvasPixelWidth && (element.width = canvasPixelWidth), element.height !== canvasPixelHeight && (element.height = canvasPixelHeight), dprCache.setDpr(renderPixelRatio), canvasCache.setDpr(renderPixelRatio), particleSystem.setDpr(renderPixelRatio))
    }
  resizeOverlay()
  const viewProjectionMatrix = new Matrix4(),
    projectToScreen = (worldX, worldY, worldZ, screenPosition) => {
      const matrixElements = viewProjectionMatrix.elements,
        perspectiveDivisor = matrixElements[3] * worldX + matrixElements[7] * worldY + matrixElements[11] * worldZ + matrixElements[15]
      return perspectiveDivisor <= 0.05 ? !1 : ((screenPosition.x = (((matrixElements[0] * worldX + matrixElements[4] * worldY + matrixElements[8] * worldZ + matrixElements[12]) / perspectiveDivisor) * 0.5 + 0.5) * viewportWidth), (screenPosition.y = (0.5 - ((matrixElements[1] * worldX + matrixElements[5] * worldY + matrixElements[9] * worldZ + matrixElements[13]) / perspectiveDivisor) * 0.5) * viewportHeight), !0)
    }
  return {
    name: "overlay",
    update(worldFrame) {
      ;(fallbackVfxSystem && (fallbackVfxSystem.begin(worldFrame), fallbackVfxSystem.flush(worldFrame)), (viewportWidth !== overlayHost.viewport.width || viewportHeight !== overlayHost.viewport.height) && resizeOverlay())
      const activeCamera = overlayHost.camera
      ;(viewProjectionMatrix.multiplyMatrices(activeCamera.projectionMatrix, activeCamera.matrixWorldInverse), ContextValue.setTransform(renderPixelRatio, 0, 0, renderPixelRatio, 0, 0), ContextValue.clearRect(0, 0, viewportWidth, viewportHeight))
      const viewportUiScale = Math.min(1.4, Math.max(0.7, Math.min(viewportWidth / 1280, viewportHeight / 720)))
      ;(barsConfig.bars && hudMarkers.draw(ContextValue, worldFrame, getAnchors(), projectToScreen, viewportWidth, viewportHeight, viewportUiScale), barsConfig.floaters && particleSystem.draw(ContextValue, worldFrame.dt, worldFrame.state, getAnchors(), projectToScreen, viewportWidth, viewportHeight, viewportUiScale))
    },
    handleEvents(combatEvents, playerState) {
      barsConfig.floaters && particleSystem.handle(combatEvents, playerState, getAnchors(), overlayHost.frame.playerTeam)
    },
    resize: resizeOverlay,
    setVisible(marksKind, propertyName) {
      ;((barsConfig[marksKind] = propertyName), marksKind === "marks" && (targetIndicator.enabled = propertyName))
    },
    reset() {
      ;(hudMarkers.reset(), particleSystem.reset(), targetIndicator.reset())
    },
    setAvoid(bushMap) {
      if (!bushMap) {
        hudMarkers.avoid = null
        return
      }
      const BoundingClientRectValue = overlayHost.container.getBoundingClientRect()
      hudMarkers.avoid = bushMap.map((obstacleRect) => ({ left: obstacleRect.left - BoundingClientRectValue.left, top: obstacleRect.top - BoundingClientRectValue.top, right: obstacleRect.right - BoundingClientRectValue.left, bottom: obstacleRect.bottom - BoundingClientRectValue.top }))
    },
    dispose() {
      const vfxHookIndex = activeVfxSystem.hooks.indexOf(onVfxHook)
      vfxHookIndex >= 0 && activeVfxSystem.hooks.splice(vfxHookIndex, 1)
      const clearHookIndex = activeVfxSystem.onClear.indexOf(onVfxClear)
      ;(clearHookIndex >= 0 && activeVfxSystem.onClear.splice(clearHookIndex, 1), targetIndicator.dispose(), fallbackVfxSystem?.dispose(), element.remove())
    },
  }
}

const CLASSIC_MAP_BOUND = 57.5,
  CLASSIC_MAP_HALF_EXTENT = 76,
  makePointXY = (pointX, pointY) => ({ x: pointX, y: pointY }),
  swapPointXY = (sourcePoint) => ({ x: sourcePoint.y, y: sourcePoint.x }),
  negateXY = (sourcePoint) => ({ x: -sourcePoint.y, y: -sourcePoint.x }),
  copyXY = (sourcePoint) => ({ x: sourcePoint.x, y: sourcePoint.y }),
  negateSwapXY = (sourcePoint) => swapPointXY(negateXY(sourcePoint))

function reflectAcrossAllDirections(sourcePoints) {
  return [copyXY, negateXY, swapPointXY, negateSwapXY].map((reflectFn) => sourcePoints.map(reflectFn))
}

const __MAP = buildClassicMap({ $t: makePointXY, $h: swapPointXY, I0: negateXY, Ax: copyXY, h8: negateSwapXY })

const CLASSIC_WALL_POLYGONS = __MAP.Oz, CLASSIC_BUSH_RECTANGLES = __MAP.Bz, CLASSIC_CORNER_BUSH = __MAP.n_, CLASSIC_MONSTER_CAMP_DEFS = __MAP.Hz

const buildClassicMonsterCamps = __MAP.$z

const CLASSIC_TOP_LANE_WAYPOINTS = __MAP.s_, CLASSIC_LANE_WAYPOINTS = __MAP.Gz

const buildClassicBase = __MAP.i_

const CLASSIC_TOWER_SITES = __MAP.a_

const buildClassicTowerList = __MAP.Vz

function getClassicMapData() {
  return globalThis.__STARFALL_MAP__ ? globalThis.__STARFALL_MAP__() : __MAP.u8()
}

/**
 * 绘制距离。
 *
 * @param distanceField - 主要输入
 * @param gridSize - 次要输入
 * @param polygon - 第三输入
 * @param solidDistance - 输入
 */
function paintPolygonDistanceField(distanceField, gridSize, polygon, solidDistance) {
  const cellScale = gridSize / (MAP_GRID_HALF_EXTENT * 2),
    minColumn = Math.max(0, Math.floor((polygon.minX - solidDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    maxColumn = Math.min(gridSize - 1, Math.ceil((polygon.maxX + solidDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    minRow = Math.max(0, Math.floor((polygon.minY - solidDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    maxRow = Math.min(gridSize - 1, Math.ceil((polygon.maxY + solidDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    xConfig = { x: 0, y: 0 }
  for (let index = minRow; index <= maxRow; index++) {
    xConfig.y = (index + 0.5) / cellScale - MAP_GRID_HALF_EXTENT
    for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex++) {
      xConfig.x = (columnIndex + 0.5) / cellScale - MAP_GRID_HALF_EXTENT
      const signedDistanceToPolygonResult = signedDistanceToPolygon(xConfig, polygon.poly),
        cellIndex = index * gridSize + columnIndex
      signedDistanceToPolygonResult < distanceField[cellIndex] && (distanceField[cellIndex] = signedDistanceToPolygonResult)
    }
  }
}

/**
 * 绘制距离。
 *
 * @param distanceField - 主要输入
 * @param gridSize - 次要输入
 * @param circleCenter - 输入
 * @param circleRadius - 第四输入
 * @param fillDistance - 附加输入
 */
function paintCircleDistanceField(distanceField, gridSize, circleCenter, circleRadius, fillDistance) {
  const cellScale = gridSize / (MAP_GRID_HALF_EXTENT * 2),
    minColumn = Math.max(0, Math.floor((circleCenter.x - circleRadius - fillDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    maxColumn = Math.min(gridSize - 1, Math.ceil((circleCenter.x + circleRadius + fillDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    minRow = Math.max(0, Math.floor((circleCenter.y - circleRadius - fillDistance + MAP_GRID_HALF_EXTENT) * cellScale)),
    maxRow = Math.min(gridSize - 1, Math.ceil((circleCenter.y + circleRadius + fillDistance + MAP_GRID_HALF_EXTENT) * cellScale))
  for (let index = minRow; index <= maxRow; index++) {
    const worldY = (index + 0.5) / cellScale - MAP_GRID_HALF_EXTENT
    for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex++) {
      const worldX = (columnIndex + 0.5) / cellScale - MAP_GRID_HALF_EXTENT,
        distance = Math.hypot(worldX - circleCenter.x, worldY - circleCenter.y) - circleRadius,
        cellIndex = index * gridSize + columnIndex
      distance < distanceField[cellIndex] && (distanceField[cellIndex] = distance)
    }
  }
}

function horizontalHeadingAndCotangent(worldPoint) {
  const distance = Math.hypot(worldPoint.x, worldPoint.z) || 1
  return { hx: worldPoint.x / distance, hz: worldPoint.z / distance, cot: distance / Math.max(0.05, worldPoint.y) }
}

function buildShadowOcclusionGrid(solidField, gridSize, mapBound, lightDirection) {
  const { hx: headingX, hz: headingZ, cot: cotangent } = horizontalHeadingAndCotangent(lightDirection),
    shadowLength = SHADOW_LENGTH_FACTOR * cotangent,
    cellScale = gridSize / (MAP_GRID_HALF_EXTENT * 2),
    fillResult = new Float32Array(gridSize * gridSize).fill(1),
    sampleSteps = 7
  for (let index = 0; index < gridSize; index++) {
    const worldRow = (index + 0.5) / cellScale - MAP_GRID_HALF_EXTENT
    for (let columnIndex = 0; columnIndex < gridSize; columnIndex++) {
      const worldColumn = (columnIndex + 0.5) / cellScale - MAP_GRID_HALF_EXTENT,
        cellIndex = index * gridSize + columnIndex,
        selectedN = solidField[cellIndex],
        edgeDistance = mapBound - Math.max(Math.abs(worldColumn), Math.abs(worldRow))
      if (selectedN <= 0 || edgeDistance < -1 || (selectedN > shadowLength + 0.6 && edgeDistance > shadowLength + 0.6)) continue
      let maxOcclusion = 0
      for (let stepIndex = 1; stepIndex <= sampleSteps; stepIndex++) {
        const stepDistance = (shadowLength * stepIndex) / sampleSteps,
          sampleX = worldColumn + headingX * stepDistance,
          sampleZ = worldRow + headingZ * stepDistance
        let sampleOcclusion = 0
        if (Math.max(Math.abs(sampleX), Math.abs(sampleZ)) > mapBound + 0.25) sampleZ < mapBound - 9 && (sampleOcclusion = 1)
        else {
          const sampleCol = Math.min(gridSize - 1, Math.max(0, Math.floor((sampleX + MAP_GRID_HALF_EXTENT) * cellScale))),
            sampleRow = Math.min(gridSize - 1, Math.max(0, Math.floor((sampleZ + MAP_GRID_HALF_EXTENT) * cellScale)))
          sampleOcclusion = Math.min(1, Math.max(0, (-solidField[sampleRow * gridSize + sampleCol] - 0.05) / 0.3))
        }
        ;((sampleOcclusion *= 1 - 0.55 * smoothstepClamped(0.55, 1, stepIndex / sampleSteps)), sampleOcclusion > maxOcclusion && (maxOcclusion = sampleOcclusion))
      }
      fillResult[cellIndex] = 1 - maxOcclusion
    }
  }
  const float32Array = new Float32Array(gridSize * gridSize)
  for (let blurPass = 0; blurPass < 2; blurPass++) {
    for (let horizontalRow = 0; horizontalRow < gridSize; horizontalRow++)
      for (let horizontalColumn = 0; horizontalColumn < gridSize; horizontalColumn++) {
        const leftNeighborColumn = Math.max(0, horizontalColumn - 1),
          rightNeighborColumn = Math.min(gridSize - 1, horizontalColumn + 1)
        float32Array[horizontalRow * gridSize + horizontalColumn] = (fillResult[horizontalRow * gridSize + leftNeighborColumn] + fillResult[horizontalRow * gridSize + horizontalColumn] + fillResult[horizontalRow * gridSize + rightNeighborColumn]) / 3
      }
    for (let verticalRow = 0; verticalRow < gridSize; verticalRow++) {
      const topNeighborRow = Math.max(0, verticalRow - 1),
        bottomNeighborRow = Math.min(gridSize - 1, verticalRow + 1)
      for (let verticalColumn = 0; verticalColumn < gridSize; verticalColumn++) fillResult[verticalRow * gridSize + verticalColumn] = (float32Array[topNeighborRow * gridSize + verticalColumn] + float32Array[verticalRow * gridSize + verticalColumn] + float32Array[bottomNeighborRow * gridSize + verticalColumn]) / 3
    }
  }
  return fillResult
}

function paintShadowBlobs(shadowTexture, casters, lightDirection) {
  const textureImage = shadowTexture.b.image,
    pixelData = textureImage.data,
    imageWidth = textureImage.width,
    { hx: headingX, hz: headingZ, cot: cotangent } = horizontalHeadingAndCotangent(lightDirection),
    cellScale = imageWidth / (MAP_GRID_HALF_EXTENT * 2)
  for (const shadowCaster of casters) {
    const casterCenterX = shadowCaster.x - headingX * shadowCaster.height * cotangent,
      casterCenterZ = shadowCaster.z - headingZ * shadowCaster.height * cotangent,
      casterRadius = shadowCaster.radius,
      minColumn = Math.max(0, Math.floor((casterCenterX - casterRadius + MAP_GRID_HALF_EXTENT) * cellScale)),
      maxColumn = Math.min(imageWidth - 1, Math.ceil((casterCenterX + casterRadius + MAP_GRID_HALF_EXTENT) * cellScale)),
      minRow = Math.max(0, Math.floor((casterCenterZ - casterRadius + MAP_GRID_HALF_EXTENT) * cellScale)),
      maxRow = Math.min(imageWidth - 1, Math.ceil((casterCenterZ + casterRadius + MAP_GRID_HALF_EXTENT) * cellScale))
    for (let index = minRow; index <= maxRow; index++) {
      const worldZ = (index + 0.5) / cellScale - MAP_GRID_HALF_EXTENT
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex++) {
        const worldX = (columnIndex + 0.5) / cellScale - MAP_GRID_HALF_EXTENT,
          distance = Math.hypot(worldX - casterCenterX, worldZ - casterCenterZ) / casterRadius
        if (distance >= 1) continue
        const shadowStrength = 1 - shadowCaster.strength * (1 - smoothstepClamped(0.55, 1, distance)),
          pixelIndex = (index * imageWidth + columnIndex) * 4 + 2
        pixelData[pixelIndex] = Math.min(pixelData[pixelIndex], Math.round(255 * shadowStrength))
      }
    }
  }
  shadowTexture.b.needsUpdate = !0
}

/**
 * 创建地形。
 *
 * @param terrainMap - 输入
 * @param gridSize - 次要输入
 * @param lightDirection - 第三输入
 * @returns 结果对象
 */
function buildTerrainFieldTextures(terrainMap, gridSize, lightDirection) {
  const cellCount = gridSize * gridSize,
    tERRAIN_PALETTE_INDEX = TERRAIN_PALETTE_INDEX,
    mapConfig = terrainMap.map,
    laneHalfWidth = mapConfig.laneWidth / 2,
    riverHalfWidth = mapConfig.riverWidth / 2,
    laneField = new Float32Array(cellCount).fill(laneHalfWidth + tERRAIN_PALETTE_INDEX.lane),
    riverField = new Float32Array(cellCount).fill(riverHalfWidth + tERRAIN_PALETTE_INDEX.river),
    solidField = new Float32Array(cellCount).fill(tERRAIN_PALETTE_INDEX.solid),
    baseField = new Float32Array(cellCount).fill(tERRAIN_PALETTE_INDEX.base),
    bushField = new Float32Array(cellCount).fill(tERRAIN_PALETTE_INDEX.bush),
    campField = new Float32Array(cellCount).fill(tERRAIN_PALETTE_INDEX.camp),
    padField = new Float32Array(cellCount).fill(tERRAIN_PALETTE_INDEX.pad)
  for (const lanesasany of Object.values(mapConfig.lanes) as any[]) for (let index = 1; index < lanesasany.length; index++) paintSegmentIntoGrid(laneField, gridSize, lanesasany[index - 1], lanesasany[index], laneHalfWidth + tERRAIN_PALETTE_INDEX.lane)
  const riverPolyline = terrainMap.riverLine
  for (let riverPointIndex = 1; riverPointIndex < riverPolyline.length; riverPointIndex++) paintSegmentIntoGrid(riverField, gridSize, riverPolyline[riverPointIndex - 1], riverPolyline[riverPointIndex], riverHalfWidth + tERRAIN_PALETTE_INDEX.river)
  for (const wall of terrainMap.walls) paintPolygonDistanceField(solidField, gridSize, wall, tERRAIN_PALETTE_INDEX.solid)
  for (const basePolygon of terrainMap.bases) paintPolygonDistanceField(baseField, gridSize, basePolygon, tERRAIN_PALETTE_INDEX.base)
  for (const bushPolygon of terrainMap.bushes) paintPolygonDistanceField(bushField, gridSize, bushPolygon, tERRAIN_PALETTE_INDEX.bush)
  for (const monsterCamp of mapConfig.camps) paintCircleDistanceField(campField, gridSize, monsterCamp.pos, monsterRadius(monsterCamp.monsterType), tERRAIN_PALETTE_INDEX.camp)
  for (const tower of mapConfig.towers) paintCircleDistanceField(padField, gridSize, tower.pos, TOWER_PAD_RADIUS, tERRAIN_PALETTE_INDEX.pad)
  for (const baseCore of mapConfig.bases) paintCircleDistanceField(padField, gridSize, baseCore.core, BASE_PAD_RADIUS, tERRAIN_PALETTE_INDEX.pad)
  const ShadowOcclusionGridValue = buildShadowOcclusionGrid(solidField, gridSize, mapConfig.bound, lightDirection),
    uint8Array = new Uint8Array(cellCount * 4),
    detailPixels = new Uint8Array(cellCount * 4),
    encodeDistance = (clavL, distanceScale) => Math.min(255, Math.max(0, Math.round((clavL / distanceScale) * 127.5 + 127.5))),
    worldToCellScale = (MAP_GRID_HALF_EXTENT * 2) / gridSize
  for (let rowIndex = 0; rowIndex < gridSize; rowIndex++) {
    const worldZ = (rowIndex + 0.5) * worldToCellScale - MAP_GRID_HALF_EXTENT
    for (let columnIndex = 0; columnIndex < gridSize; columnIndex++) {
      const worldX = (columnIndex + 0.5) * worldToCellScale - MAP_GRID_HALF_EXTENT,
        cellIndex = rowIndex * gridSize + columnIndex,
        pixelOffset = cellIndex * 4
      ;((uint8Array[pixelOffset] = encodeDistance(laneField[cellIndex] - laneHalfWidth, tERRAIN_PALETTE_INDEX.lane)),
        (uint8Array[pixelOffset + 1] = encodeDistance(riverField[cellIndex] - riverHalfWidth, tERRAIN_PALETTE_INDEX.river)),
        (uint8Array[pixelOffset + 2] = encodeDistance(Math.min(solidField[cellIndex], mapConfig.bound - Math.max(Math.abs(worldX), Math.abs(worldZ))), tERRAIN_PALETTE_INDEX.solid)),
        (uint8Array[pixelOffset + 3] = encodeDistance(baseField[cellIndex], tERRAIN_PALETTE_INDEX.base)),
        (detailPixels[pixelOffset] = encodeDistance(bushField[cellIndex], tERRAIN_PALETTE_INDEX.bush)),
        (detailPixels[pixelOffset + 1] = encodeDistance(campField[cellIndex], tERRAIN_PALETTE_INDEX.camp)),
        (detailPixels[pixelOffset + 2] = Math.round(ShadowOcclusionGridValue[cellIndex] * 255)),
        (detailPixels[pixelOffset + 3] = encodeDistance(padField[cellIndex], tERRAIN_PALETTE_INDEX.pad)))
    }
  }
  const createTexture = (pixelBytes) => {
    const terrainTexture = new DataTexture(pixelBytes, gridSize, gridSize, RGBAFormat, UnsignedByteType)
    return ((terrainTexture.wrapS = terrainTexture.wrapT = ClampToEdgeWrapping), (terrainTexture.minFilter = LinearFilter), (terrainTexture.magFilter = LinearFilter), (terrainTexture.generateMipmaps = !1), (terrainTexture.colorSpace = NoColorSpace), (terrainTexture.needsUpdate = !0), terrainTexture)
  }
  return { a: createTexture(uint8Array), b: createTexture(detailPixels) }
}

function colorToRgb(amber) {
  const parsedColor = new Color(amber)
  return [parsedColor.r, parsedColor.g, parsedColor.b]
}

function lerp3(stone, targetVector, blendFactor) {
  return [stone[0] + (targetVector[0] - stone[0]) * blendFactor, stone[1] + (targetVector[1] - stone[1]) * blendFactor, stone[2] + (targetVector[2] - stone[2]) * blendFactor]
}

function scale3(outer, scaleFactor) {
  return [outer[0] * scaleFactor, outer[1] * scaleFactor, outer[2] * scaleFactor]
}

const clamp01Scalar = (rawScalar) => (rawScalar < 0 ? 0 : rawScalar > 1 ? 1 : rawScalar),
  lerpScalar = (shelf, targetScalar, niche) => shelf + (targetScalar - shelf) * niche,
  smoothStepScalar = (edgeStart, edgeEnd, sampleScalar) => {
    const clamp01ScalarResult = clamp01Scalar((sampleScalar - edgeStart) / (edgeEnd - edgeStart))
    return clamp01ScalarResult * clamp01ScalarResult * (3 - 2 * clamp01ScalarResult)
  },
  scratchVecA = new Vector3(),
  scratchVecB = new Vector3(),
  scratchMat3 = new Matrix3(),
  SIGN_NEGATIVE = -1,
  BUCKET_MIN = 0,
  BUCKET_LOW = 1,
  BUCKET_MID = 2,
  BUCKET_HIGH = 3,
  BUCKET_MAX = 5

function hashBucket(hashKeyX, hashKeyZ, lowThreshold = 0.45, midThreshold = 0.3) {
  let hashSeed = (Math.imul(Math.round(hashKeyX * 97) | 0, 374761393) ^ Math.imul(Math.round(hashKeyZ * 89) | 0, 668265263)) | 0
  hashSeed = Math.imul(hashSeed ^ (hashSeed >>> 13), 1274126177)
  const hashUnit = ((hashSeed ^ (hashSeed >>> 16)) >>> 0) / 4294967296
  return hashUnit < lowThreshold ? BUCKET_LOW : hashUnit < lowThreshold + midThreshold ? BUCKET_MID : BUCKET_HIGH
}

/**
 * 更新评分。
 *
 * @param sceneMesh - 主要输入
 * @param sceneryRank - 输入
 * @param shadowRank - 输入
 */
function applyRankDrawRange(sceneMesh, sceneryRank, shadowRank) {
  const meshGeometry = sceneMesh.geometry,
    rankEnds = meshGeometry.userData.rankEnds
  if (!rankEnds) return
  const selectedI = rankEnds[Math.min(BUCKET_HIGH, Math.max(BUCKET_MIN, sceneryRank)) + 1]
  if ((meshGeometry.setDrawRange(0, selectedI), !sceneMesh.castShadow)) return
  const shadowStart = rankEnds[0],
    shadowEnd = Math.max(shadowStart, rankEnds[Math.min(sceneryRank, shadowRank) + 1])
  ;((sceneMesh.onBeforeShadow = () => meshGeometry.setDrawRange(shadowStart, shadowEnd - shadowStart)), (sceneMesh.onAfterShadow = () => meshGeometry.setDrawRange(0, selectedI)))
}

export { BUCKET_MIN, BUCKET_HIGH, buildTerrainFieldTextures, SIGN_NEGATIVE, lerpScalar, createFxOverlay, paintShadowBlobs, applyRankDrawRange, scratchVecB, smoothStepScalar, colorToRgb, scratchVecA, clamp01Scalar, hashBucket, BUCKET_MAX, lerp3, BUCKET_LOW, scratchMat3, scale3, getClassicMapData, BUCKET_MID }