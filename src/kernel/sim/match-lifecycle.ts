/**
 * 对局生命周期：startMatch + createUnitViews 闭包（对局启动/单位视图装配）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Color, Group, Vector3 } from 'three'
import { Animator, minionModelKey, ruinModelKey, MODEL_BUILDER_TABLE, coreModelKey, monsterModelKey, heroModelKey, getOrBuildModel, towerModelKey } from '../render/hero-preview'
import { NodeTree } from '../node-tree'
import { ModelBuilder, getLodDistance } from '../render/model-builder'
import { LineBatch } from '../render/line-batch'
import { InstanceBatch } from '../render/instance-batch'
import { OutlineRegistry, SUN_DIRECTION } from '../render/scene-rigs'
import { createMaterialState } from '../render/foundation'
import { ARENA_PALETTE } from '../arena-palette'
import { RING_STYLE_PLAYER, RING_STYLE_ENEMY_HERO, RING_STYLE_MINION, RING_STYLE_SHADOW } from '../fx/fx-enums'
import { HERO_TABLE } from '../../heroes/registry'
import { AREA_ALPHA_AGE_SCALE } from '../fx/emitters'
import { buildWorldSync } from '../ships/skeleton-solver'
import { createVisualKit } from '../render/buff-view'
import { createFxOverlay } from '../fx/particle-system'
import { buildStagedAssets, loadAssetsStaged } from '../render/sprite-ribbons'
import { BANNER_ANIM_CACHE, HERO_ID_LIST, ROLE_TINT_COLORS, heroNameForBanner, killFeedLine } from '../ui/banner'
import { createProgressBar, injectThemeStyles, laneLabels, createEl, createIconEl, iconFor, injectStyleSheet, createLaneIcon, makeBadge, makeIconByName } from '../ui/dom-kit'
import { z0 } from '../skills/skill-values'
import { LOADING_SCREEN_CSS } from '../ui/loading-screen-styles'
import { makeCanvasTexture } from '../render/procedural-art'
import { isOverlayAvailable } from '../ui/rh-widget'
import { Simulation } from './simulation'
import { showAppCardDialog, injectHudStyle } from '../ui/dom-snapshot'
import { createHudRoot } from '../ui/hud-root'
import { GameLoop } from './game-loop'

function isKnownModelKey(modelKey) {
  return modelKey in MODEL_BUILDER_TABLE
}

function getModelKeys() {
  return Object.keys(MODEL_BUILDER_TABLE)
}

const fallbackModelCache = new Map()

/**
 * 创建模型。
 *
 * @param baseRadius - 来源
 * @param bodyHeight - 次要输入
 */
function buildFallbackModel(baseRadius, bodyHeight) {
  const lookupKey = `fallback:${baseRadius.toFixed(2)}:${bodyHeight.toFixed(2)}`
  let Value = fallbackModelCache.get(lookupKey)
  if (Value) return Value
  const nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    bodyJoint = nodeTree.add("body", rootJoint, 0, bodyHeight * 0.4, 0),
    modelBuilder = new ModelBuilder(),
    profileHeight = baseRadius * 0.8
  return (
    modelBuilder.bone(bodyJoint).paint(10133672, { c2: 13159636 }),
    modelBuilder.lathe(
      [
        [0, profileHeight * 0.9],
        [bodyHeight * 0.1, profileHeight],
        [bodyHeight * 0.55, profileHeight * 0.85],
        [bodyHeight * 0.8, profileHeight * 0.6],
        [bodyHeight, profileHeight * 0.15],
      ],
      { seg: 8, crease: 30 },
    ),
    modelBuilder.paint(16777215, { team: 1 }),
    modelBuilder.lathe(
      [
        [bodyHeight * 0.42, profileHeight * 0.95],
        [bodyHeight * 0.5, profileHeight * 0.94],
        [bodyHeight * 0.52, profileHeight * 0.8],
      ],
      { seg: 8, cap0: !1 },
    ),
    modelBuilder.bakeGrounding(bodyHeight),
    (Value = {
      key: lookupKey,
      geometry: modelBuilder.build(),
      rig: nodeTree,
      height: bodyHeight,
      radius: baseRadius,
      scale: 1,
      stride: 2,
      triangles: modelBuilder.triangleCount,
      attach: { chest: { joint: bodyJoint, x: 0, y: bodyHeight * 0.2, z: 0 } },
      blend: () => 0.12,
      /**
       * 处理动画。
       *
       * @param skeletonBuilder - 构建器
       * @param animInput - 战场
      */
      animate(skeletonBuilder, animInput) {
        if (animInput.anim === "dead") {
          const deathProgress = Math.min(1, animInput.t / 0.8)
          ;(skeletonBuilder.rot(rootJoint, -80 * deathProgress * deathProgress, 0, 0), skeletonBuilder.scale(rootJoint, 1 - 0.5 * deathProgress))
        } else
          animInput.anim === "move"
            ? skeletonBuilder.pos(bodyJoint, 0, Math.abs(Math.sin(animInput.stride * Math.PI * 2)) * 0.12, 0)
            : animInput.anim === "attack"
              ? skeletonBuilder.rot(bodyJoint, 30 * Math.sin(Math.min(1, animInput.p / 0.5) * Math.PI), 0, 0)
              : skeletonBuilder.pos(bodyJoint, 0, Math.sin(animInput.time * 2 + animInput.seed * 6) * 0.02, 0)
      },
    }),
    fallbackModelCache.set(lookupKey, Value),
    Value
  )
}

const REVEAL_BY_KIND = { hero: !1, minion: !1, monster: !1, tower: !0, core: !0 },
  MODEL_SCALE_BY_KIND = { hero: 1.32, minion: 1.28, monster: 1.17, tower: 1, core: 1 },
  HERO_SCALE_CLAMP_RANGE = [3.05, 3.55],
  heroModelScaleByHero = { panyue: 1.07, chijin: 0.97 },
  DISTANCE_FALLOFF_BASE = 20,
  HIT_FLASH_WINDOW = 0.16,
  HIT_FLASH_MIN_GAP = 0.25,
  HIT_FLASH_BOOST_GAIN = 0.85,
  HIT_FLASH_ALPHA_SUBTLE = 0.1,
  HIT_FLASH_ALPHA_STRONG = 0.04,
  WHITE_COLOR = new Color(1, 1, 1),
  SHIELD_BREAK_DURATION = 0.45,
  QUALITY_FX_PARAMS = { high: { shadow: 0.14, xray: 0.2 }, medium: { shadow: 0.25, xray: 0.25 }, low: { shadow: 0.25, xray: 0.25 } }

/**
 * 获取单位与模型。
 *
 * @param unitDef - 英雄
 */
function getUnitModelForDef(unitDef) {
  switch (unitDef.kind) {
    case "hero":
      return heroModelKey(unitDef.heroId)
    case "minion":
      return minionModelKey(unitDef.minionType)
    case "tower":
      return towerModelKey(unitDef.tier, unitDef.team)
    case "core":
      return coreModelKey(unitDef.team)
    case "monster":
      return monsterModelKey(unitDef.monsterType)
  }
}

/**
 * 获取模型。
 *
 * @param unitDef - 输入
 */
function getFallbackModelForDef(unitDef) {
  switch (unitDef.kind) {
    case "hero":
      return buildFallbackModel(unitDef.radius, 2.2)
    case "minion":
      return buildFallbackModel(unitDef.radius, unitDef.minionType === "super" ? 2 : 1.2)
    case "tower":
      return buildFallbackModel(unitDef.radius, 8)
    case "core":
      return buildFallbackModel(unitDef.radius, 6)
    case "monster":
      return buildFallbackModel(unitDef.radius, 1 + unitDef.radius * 1.4)
  }
}

/**
 * 获取时长。
 *
 * @param unitDef - 输入
 * @returns 数值结果
 */
function getDeathDuration(unitDef) {
  if (unitDef.kind === "core") return 1 / 0
  if (unitDef.kind === "hero") return 0
  if (unitDef.def.deathDur !== void 0) return unitDef.def.deathDur
  switch (unitDef.kind) {
    case "minion":
      return 1.2
    case "monster":
      return unitDef.radius >= 1.8 ? 2.8 : 1.5
    default:
      return 2.4
  }
}

function getOutlineWidth(modelDef) {
  return modelDef.outline !== void 0 ? modelDef.outline : modelDef.key.startsWith("minion:") ? 1.2 : 1.5
}

function getShadowSliceCount(modelKey) {
  return modelKey.startsWith("hero:")
    ? 2
    : modelKey === "minion:melee"
      ? 24
      : modelKey.startsWith("minion:")
        ? 12
        : modelKey.startsWith("tower:")
          ? 3
          : modelKey.startsWith("monster:glimwing") || modelKey.startsWith("monster:mossback")
            ? 4
            : 2
}

const scratchWorldPointA = new Vector3(),
  scratchWorldPointB = new Vector3(),
  scratchAttachPoint = { x: 0, y: 0, z: 0 },
  scratchScreenCenter = { x: 0, y: 0, visible: !1 },
  scratchScreenEdge = { x: 0, y: 0, visible: !1 },
  screenCornerOffsets = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]

/**
 * 创建单位。
 *
 * @param sceneContext - 来源
 */
function createUnitViews(sceneContext) {
  const unitViewsGroup = new Group()
  ;((unitViewsGroup.name = "unit-views"), sceneContext.layers.units.add(unitViewsGroup))
  const unitViewsById = new Map(),
    stateUnitsById = new Map(),
    unitViews = [],
    batchByModelKey = new Map(),
    outlineBatches = [],
    ruinProps = [],
    lineBatch = new LineBatch(320),
    instanceBatch = new InstanceBatch(16),
    distance = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z) || 1,
    sunDirX = -SUN_DIRECTION.x / distance,
    sunDirZ = -SUN_DIRECTION.z / distance,
    sunDirectionAngle = Math.atan2(sunDirZ, sunDirX)
  ;(unitViewsGroup.add(lineBatch.mesh), unitViewsGroup.add(instanceBatch.mesh))
  let qualityName = sceneContext.settings.name,
    outlineEnabled = qualityName !== "low",
    shadowsEnabled = sceneContext.settings.shadows,
    total = 0,
    result = 0,
    lastSimTime = -1
  const teamBlessings = [0, 0]
  let isActive = !1,
    needsRuinsRefresh = !1,
    isPrewarming = !1
  const MaterialStateValue = createMaterialState(),
    focusPoint = new Vector3()
  let screenMinX = -1 / 0,
    screenMaxX = 1 / 0,
    screenMinZ = -1 / 0,
    screenMaxZ = 1 / 0
  const blueConfig = {
    blue: new Color(ARENA_PALETTE.blue.main),
    red: new Color(ARENA_PALETTE.red.main),
    neutral: new Color(ARENA_PALETTE.neutral.main),
    player: new Color(ARENA_PALETTE.player.main),
    shadow: new Color(659488),
    redIron: new Color(0.4, 0.2, 0.15),
    deadTint: new Color(8949920),
    xSelf: new Color(10354522),
    blessRing: new Color(16764768),
    shield: [new Color(5813503), new Color(16738882)],
    xAlly: new Color(5810943),
    xEnemy: new Color(16734792),
    xNeutral: new Color(15911008),
  }
  let playerTeam = sceneContext.frame.playerTeam
  const teamColorFor = (indicator) => (indicator === 0 ? blueConfig.blue : indicator === 1 ? blueConfig.red : blueConfig.neutral),
    rangeByBatch = new Map(),
    configureLodRange = (modelDef, lodRange) => {
      const selectedQUALITY_FX_PARAMS = QUALITY_FX_PARAMS[qualityName],
        effectiveModelScale = Math.max(0.001, modelDef.scale)
      ;((lodRange.outline = getLodDistance(modelDef.geometry, 0)), (lodRange.shadow = getLodDistance(modelDef.geometry, selectedQUALITY_FX_PARAMS.shadow / effectiveModelScale)), (lodRange.xray = getLodDistance(modelDef.geometry, selectedQUALITY_FX_PARAMS.xray / effectiveModelScale)))
    },
    setupOutlineRender = (lookupKey, modelDef) => {
      const outlineConfig = { outline: 1 / 0, shadow: 1 / 0, xray: 1 / 0 }
      ;(configureLodRange(modelDef, outlineConfig), rangeByBatch.set(lookupKey, { def: modelDef, range: outlineConfig }))
      const resetDrawRange = (renderer, scene, camera, geometry) => {
        geometry.setDrawRange(0, 1 / 0)
      }
      ;(lookupKey.outline &&
        ((lookupKey.outline.onBeforeRender = (renderer, scene, camera, geometry) => {
          geometry.setDrawRange(0, outlineConfig.outline)
        }),
        (lookupKey.outline.onAfterRender = resetDrawRange)),
        lookupKey.xray &&
          ((lookupKey.xray.onBeforeRender = (renderer, scene, camera, geometry) => {
            geometry.setDrawRange(0, outlineConfig.xray)
          }),
          (lookupKey.xray.onAfterRender = resetDrawRange)),
        (lookupKey.mesh.onBeforeShadow = (renderer, scene, camera, renderObject, geometry) => {
          geometry.setDrawRange(0, outlineConfig.shadow)
        }),
        (lookupKey.mesh.onAfterShadow = (renderer, scene, camera, renderObject, geometry) => {
          geometry.setDrawRange(0, 1 / 0)
        }))
    },
    getOrCreateBatch = (modelDef) => {
      let getValue = batchByModelKey.get(modelDef.key)
      if (!getValue) {
        const isUnitModel = modelDef.key.startsWith("hero:") || modelDef.key.startsWith("minion:") || modelDef.key.startsWith("monster:")
        ;((getValue = new OutlineRegistry(modelDef.geometry, modelDef.rig.count, getShadowSliceCount(modelDef.key), { outline: getOutlineWidth(modelDef), xray: isUnitModel }, modelDef.key)), getValue.setShadows(shadowsEnabled), getValue.setOutlineVisible(outlineEnabled), setupOutlineRender(getValue, modelDef), getValue.addTo(unitViewsGroup), batchByModelKey.set(modelDef.key, getValue), outlineBatches.push(getValue))
      }
      return getValue
    },
    createUnitView = (unitState, frameState) => {
      const UnitModelForDefValue = getUnitModelForDef(unitState),
        unitModel = isKnownModelKey(UnitModelForDefValue) ? getOrBuildModel(UnitModelForDefValue) : getFallbackModelForDef(unitState),
        animationPhase = (unitState.id * 0.618034) % 1,
        createMaterialStateMaterialStateValue = createMaterialState()
      ;(createMaterialStateMaterialStateValue.team.copy(teamColorFor(unitState.team)), unitState.kind === "minion" && unitState.team === 1 && createMaterialStateMaterialStateValue.body.copy(blueConfig.redIron))
      let selectedMODEL_SCALE_BY_KIND = MODEL_SCALE_BY_KIND[unitState.kind]
      if (unitState.kind === "hero") {
        const scaledModelHeight = unitModel.height * unitModel.scale * selectedMODEL_SCALE_BY_KIND
        selectedMODEL_SCALE_BY_KIND *= (scaledModelHeight > HERO_SCALE_CLAMP_RANGE[1] ? HERO_SCALE_CLAMP_RANGE[1] / scaledModelHeight : scaledModelHeight < HERO_SCALE_CLAMP_RANGE[0] ? HERO_SCALE_CLAMP_RANGE[0] / scaledModelHeight : 1) * (heroModelScaleByHero[unitState.heroId] ?? 1)
      }
      const idConfig = {
        id: unitState.id,
        kind: unitState.kind,
        team: unitState.team,
        def: unitModel,
        puppet: new Animator(unitModel, animationPhase),
        batch: getOrCreateBatch(unitModel),
        look: createMaterialStateMaterialStateValue,
        seen: !0,
        isPlayer: unitState.id === frameState.playerId,
        alive: !0,
        x: unitState.pos.x,
        y: 0,
        z: unitState.pos.y,
        lift: 0,
        yaw: 0,
        hasYaw: !1,
        opacity: 0,
        targetOpacity: 1,
        flash: 0,
        flashBoost: 0,
        flashStart: -999,
        flashSeen: unitState.lastHitTime,
        sx: unitState.pos.x,
        sz: unitState.pos.y,
        stride: animationPhase,
        speed: 0,
        variant: 0,
        lastStart: unitState.animStart,
        lastAnim: unitState.anim,
        dying: -1,
        deathDur: 0,
        scale: selectedMODEL_SCALE_BY_KIND,
        culled: !1,
        fresh: !0,
        pop: !isActive,
        radius: Math.max(unitState.radius, unitModel.radius * unitModel.scale * selectedMODEL_SCALE_BY_KIND),
        height: unitModel.height * unitModel.scale * selectedMODEL_SCALE_BY_KIND,
        hp: 1,
        ring: unitState.kind === "hero" ? (unitState.id === frameState.playerId ? RING_STYLE_PLAYER : RING_STYLE_ENEMY_HERO) : unitState.kind === "minion" ? RING_STYLE_MINION : -1,
        tintAmount: 0,
        tintColor: new Color(1, 1, 1),
        pulseColor: new Color(1, 1, 1),
        pulseAmount: 0,
        pulseDur: 0,
        pulseLeft: 0,
        rimDur: 0,
        rimLeft: 0,
        spawnT: isActive && unitState.kind === "monster" && (unitModel.spawnDur ?? 0) > 0 && unitState.alive ? 0 : -1,
        hitT: 99,
        mode: 0,
        special: !1,
        shield: REVEAL_BY_KIND[unitState.kind] && unitState.invulnerable && unitState.alive ? 1 : 0,
        shieldBreak: -1,
        windup: unitState.kind === "hero" ? HERO_TABLE[unitState.heroId].basicAttack.windup : REVEAL_BY_KIND[unitState.kind] ? 0.3 : 0.35,
      }
      return ((idConfig.deathDur = getDeathDuration(idConfig)), idConfig)
    },
    addRuinProp = (worldX, worldZ, teamId, propAge) => {
      const ruinModelKeyResult = ruinModelKey(teamId)
      if (!isKnownModelKey(ruinModelKeyResult)) return
      const OrBuildModelValue = getOrBuildModel(ruinModelKeyResult),
        ruinAnimator = new Animator(OrBuildModelValue, (((worldX * 12.9898 + worldZ * 78.233) % 1) + 1) % 1),
        MaterialStateResult = createMaterialState()
      ;(MaterialStateResult.team.copy(teamColorFor(teamId)), ruinProps.push({ puppet: ruinAnimator, batch: getOrCreateBatch(OrBuildModelValue), look: MaterialStateResult, x: worldX, z: worldZ, age: propAge }))
    },
    syncTowerRuins = /**
 * 处理事件。
 *
 * @param frameState - 战场
 */
(frameState) => {
      for (const tower of frameState.map.towers) {
        let towerStillStanding = !1
        for (const stateUnit of frameState.units)
          if (stateUnit.kind === "tower" && Math.abs(stateUnit.pos.x - tower.pos.x) < 0.5 && Math.abs(stateUnit.pos.y - tower.pos.y) < 0.5) {
            towerStillStanding = !0
            break
          }
        towerStillStanding || addRuinProp(tower.pos.x, tower.pos.y, tower.team, 10)
      }
    }
  syncTowerRuins(sceneContext.frame.state)
  const resetUnitViews = () => {
      ;(unitViewsById.clear(), (unitViews.length = 0), (ruinProps.length = 0), (isActive = !1), (needsRuinsRefresh = !0))
    },
    updateScreenBounds = () => {
      const camera = sceneContext.camera
      scratchWorldPointB.setFromMatrixPosition(camera.matrixWorld)
      let boundMinX = 1 / 0,
        boundMaxX = -1 / 0,
        boundMinZ = 1 / 0,
        boundMaxZ = -1 / 0
      for (const [lookupKey, screenCornerY] of screenCornerOffsets) {
        if ((scratchWorldPointA.set(lookupKey, screenCornerY, 0.5).unproject(camera).sub(scratchWorldPointB), scratchWorldPointA.y > -1e-4)) {
          ;((screenMinX = screenMinZ = -1 / 0), (screenMaxX = screenMaxZ = 1 / 0))
          return
        }
        const rayScale = -scratchWorldPointB.y / scratchWorldPointA.y,
          hitX = scratchWorldPointB.x + scratchWorldPointA.x * rayScale,
          hitZ = scratchWorldPointB.z + scratchWorldPointA.z * rayScale
        ;(hitX < boundMinX && (boundMinX = hitX), hitX > boundMaxX && (boundMaxX = hitX), hitZ < boundMinZ && (boundMinZ = hitZ), hitZ > boundMaxZ && (boundMaxZ = hitZ))
      }
      ;((screenMinX = boundMinX), (screenMaxX = boundMaxX), (screenMinZ = boundMinZ), (screenMaxZ = boundMaxZ))
    },
    isWithinScreenBounds = (worldX, worldZ, unitRadius, unitHeight) => {
      const cullMargin = unitRadius + 1.5
      return worldX > screenMinX - cullMargin - unitHeight * 0.9 && worldX < screenMaxX + cullMargin && worldZ > screenMinZ - cullMargin && worldZ < screenMaxZ + cullMargin + unitHeight * 1.3
    },
    syncUnitView = (unitView, stateUnit, frame) => {
      const state = frame.state,
        alpha = frame.alpha
      ;((unitView.seen = !0), (unitView.isPlayer = stateUnit.id === state.playerId))
      const interpX = stateUnit.prevPos.x + (stateUnit.pos.x - stateUnit.prevPos.x) * alpha,
        interpZ = stateUnit.prevPos.y + (stateUnit.pos.y - stateUnit.prevPos.y) * alpha,
        wasAlive = unitView.alive
      ;((unitView.alive = stateUnit.alive),
        (unitView.x = interpX),
        (unitView.z = interpZ),
        (unitView.y = REVEAL_BY_KIND[stateUnit.kind] ? 0 : sceneContext.terrain.heightAt(interpX, interpZ) * 0.6),
        (unitView.hp = stateUnit.stats.maxHp > 0 ? stateUnit.hp / stateUnit.stats.maxHp : 1),
        stateUnit.alive && !wasAlive && ((unitView.fresh = !0), (unitView.opacity = 0)))
      const targetYaw = REVEAL_BY_KIND[stateUnit.kind] ? 0 : Math.PI / 2 - stateUnit.facing
      if (!unitView.hasYaw || unitView.fresh) ((unitView.yaw = targetYaw), (unitView.hasYaw = !0))
      else {
        let yawDelta = targetYaw - unitView.yaw
        yawDelta -= Math.round(yawDelta / (Math.PI * 2)) * Math.PI * 2
        const turnSpeed = stateUnit.kind === "hero" ? 18 : stateUnit.kind === "minion" ? 12 : 9
        unitView.yaw += yawDelta * (1 - Math.exp(-turnSpeed * frame.dt))
      }
      const isVisibleToPlayer = stateUnit.team === frame.playerTeam || REVEAL_BY_KIND[stateUnit.kind] || stateUnit.kind === "monster" || stateUnit.visible[frame.playerTeam]
      let targetOpacity = isVisibleToPlayer ? 1 : 0
      if (isVisibleToPlayer) {
        stateUnit.bushId >= 0 && (targetOpacity = 0.62)
        for (let index = 0; index < stateUnit.buffs.length; index++)
          if (stateUnit.buffs[index].id === "untargetable") {
            targetOpacity = Math.min(targetOpacity, 0.42)
            break
          }
      }
      const renderTime = state.time - (1 - alpha) * AREA_ALPHA_AGE_SCALE
      if (stateUnit.kind === "hero" && !stateUnit.alive) {
        const deathElapsed = renderTime - stateUnit.animStart
        targetOpacity = Math.min(targetOpacity, deathElapsed < 2.2 ? 1 : 0)
      }
      unitView.targetOpacity = targetOpacity
      const sinceLastHit = renderTime - stateUnit.lastHitTime
      stateUnit.lastHitTime !== unitView.flashSeen && ((unitView.flashSeen = stateUnit.lastHitTime), (stateUnit.lastHitTime - unitView.flashStart >= HIT_FLASH_MIN_GAP || stateUnit.lastHitTime < unitView.flashStart) && (unitView.flashStart = stateUnit.lastHitTime))
      const sinceFlashStart = renderTime - unitView.flashStart,
        flashIntensity = sinceFlashStart >= 0 && sinceFlashStart < HIT_FLASH_WINDOW && stateUnit.alive ? (1 - sinceFlashStart / HIT_FLASH_WINDOW) ** 2 : 0
      ;((unitView.flashBoost = flashIntensity * HIT_FLASH_BOOST_GAIN), (unitView.flash = flashIntensity * (REVEAL_BY_KIND[stateUnit.kind] || (stateUnit.kind === "monster" && stateUnit.radius >= 1.2) ? HIT_FLASH_ALPHA_STRONG : HIT_FLASH_ALPHA_SUBTLE)))
      const animInput = unitView.puppet.input,
        startedAttack = stateUnit.anim === "attack" && (stateUnit.animStart !== unitView.lastStart || unitView.lastAnim !== "attack")
      ;(startedAttack && (unitView.variant++, (unitView.special = !1)), (unitView.lastStart = stateUnit.animStart), (unitView.lastAnim = stateUnit.anim), (animInput.anim = stateUnit.anim))
      const animElapsedTime = Math.max(0, renderTime - stateUnit.animStart)
      if (
        ((animInput.t = animElapsedTime),
        (animInput.p = stateUnit.animDur > 0 ? Math.min(1, animElapsedTime / stateUnit.animDur) : 0),
        (animInput.hp = unitView.hp),
        (animInput.windup = unitView.windup),
        (animInput.deathT = -1),
        (animInput.variant = unitView.variant),
        (animInput.team = unitView.team),
        (animInput.mode = 0),
        (unitView.hitT = sinceLastHit >= 0 ? sinceLastHit : 99),
        (animInput.hitT = unitView.hitT),
        unitView.spawnT >= 0)
      ) {
        const spawnDuration = unitView.def.spawnDur ?? 0
        ;(unitView.spawnT >= spawnDuration || sinceLastHit < unitView.spawnT || !stateUnit.alive) && (unitView.spawnT = -1)
      }
      if (
        ((animInput.spawnT = unitView.spawnT),
        stateUnit.kind === "monster"
          ? (startedAttack && (unitView.special = unitView.variant % 3 === 0), unitView.special && stateUnit.anim === "attack" && (animInput.mode |= 1), stateUnit.targetId >= 0 && (animInput.mode |= 2))
          : (stateUnit.kind === "tower" || stateUnit.kind === "core") &&
            (stateUnit.invulnerable && (animInput.mode |= 1),
            stateUnit.targetId >= 0 && unitViewsById.get(stateUnit.targetId)?.kind === "hero" && (animInput.mode |= 2),
            stateUnit.invulnerable && stateUnit.alive
              ? ((unitView.shield = Math.min(1, unitView.shield + frame.dt * 2.5)), (unitView.shieldBreak = -1))
              : unitView.shield > 0 && ((unitView.shieldBreak = Math.max(0, unitView.shieldBreak) + frame.dt / SHIELD_BREAK_DURATION), unitView.shieldBreak >= 1 && ((unitView.shield = 0), (unitView.shieldBreak = -1)))),
        stateUnit.kind === "hero")
      ) {
        for (let buffIndex = 0; buffIndex < stateUnit.buffs.length; buffIndex++) {
          const selectedBuffs = stateUnit.buffs[buffIndex]
          startedAttack && ((selectedBuffs.id === "panyue_passive" && selectedBuffs.stacks >= 2) || selectedBuffs.id === "fengling_crit" || selectedBuffs.id === "chijin_ember") ? (unitView.special = !0) : selectedBuffs.id === "panyue_bulwark" && (animInput.mode |= 2)
        }
        unitView.special && stateUnit.anim === "attack" && (animInput.mode |= 1)
      }
      ;((unitView.mode = animInput.mode),
        stateUnit.anim === "leap" ? (unitView.lift = 4 * 3.4 * animInput.p * (1 - animInput.p)) : stateUnit.anim === "airborne" ? (unitView.lift = 4 * Math.min(2.2, Math.max(0.8, stateUnit.animDur * 1.7)) * animInput.p * (1 - animInput.p)) : (unitView.lift = 0))
    },
    markUnitDying = (unitView) => {
      ;((unitView.dying = 0), (unitView.alive = !1), unitView.kind === "tower" && unitView.team !== 2 && addRuinProp(unitView.x, unitView.z, unitView.team, 0))
    },
    updateUnitView = (unitView, frame) => {
      const dt = frame.dt,
        opacityDelta = unitView.targetOpacity - unitView.opacity
      ;(unitView.pop ? (unitView.opacity = unitView.targetOpacity) : (unitView.opacity += opacityDelta * (1 - Math.exp(-(opacityDelta > 0 ? 9 : 6) * dt))), (unitView.pop = !1), Math.abs(unitView.targetOpacity - unitView.opacity) < 0.01 && (unitView.opacity = unitView.targetOpacity))
      const moveX = unitView.x - unitView.sx,
        moveZ = unitView.z - unitView.sz,
        distance = Math.hypot(moveX, moveZ)
      if (
        ((unitView.sx = unitView.x),
        (unitView.sz = unitView.z),
        distance < 3 && dt > 0 && ((unitView.stride = (unitView.stride + distance / (unitView.def.stride * unitView.scale)) % 1), (unitView.speed += (distance / dt - unitView.speed) * Math.min(1, dt * 12))),
        unitView.spawnT >= 0 && (unitView.spawnT += dt),
        unitView.opacity <= 0.01 || !isWithinScreenBounds(unitView.x, unitView.z, unitView.radius, unitView.height + unitView.lift))
      ) {
        ;((unitView.culled = !0), (unitView.fresh = !1))
        return
      }
      const animInput = unitView.puppet.input
      ;((animInput.time = total),
        (animInput.stride = unitView.stride),
        (animInput.speed = unitView.speed),
        unitView.dying >= 0 &&
          ((animInput.anim = "dead"),
          (animInput.t = unitView.dying),
          (animInput.p = Number.isFinite(unitView.deathDur) ? Math.min(1, unitView.dying / unitView.deathDur) : Math.min(1, unitView.dying / 3)),
          (animInput.deathT = unitView.dying),
          (animInput.hp = 0),
          (animInput.spawnT = -1),
          (animInput.hitT = 99)),
        (unitView.culled || unitView.fresh) && unitView.puppet.snap(),
        (unitView.culled = !1),
        (unitView.fresh = !1),
        unitView.puppet.update(unitView.lastStart + unitView.mode * 1e-4 + (animInput.spawnT >= 0 ? 5e-4 : 0), dt, unitView.x, unitView.y + unitView.lift, unitView.z, unitView.yaw, unitView.scale))
      const lookState = unitView.look,
        animOutput = unitView.puppet.output
      ;((lookState.opacity = unitView.opacity), (lookState.flash = unitView.flash), (lookState.glow = animOutput.glow))
      const flashScale = 1 + unitView.flashBoost
      ;(lookState.body.copy(unitView.kind === "minion" && unitView.team === 1 ? blueConfig.redIron : WHITE_COLOR).multiplyScalar(flashScale), lookState.team.copy(teamColorFor(unitView.team)).multiplyScalar(flashScale))
      let tintAmount = unitView.tintAmount,
        tintColor = unitView.tintColor
      if (unitView.pulseLeft > 0) {
        unitView.pulseLeft -= dt
        const pulseTint = unitView.pulseLeft > 0 ? unitView.pulseAmount * (unitView.pulseLeft / unitView.pulseDur) : 0
        pulseTint > tintAmount && ((tintAmount = pulseTint), (tintColor = unitView.pulseColor))
      }
      animOutput.tint > tintAmount ? (lookState.tint.setHex(animOutput.tintColor), (lookState.tintAmount = animOutput.tint)) : (lookState.tint.copy(tintColor), (lookState.tintAmount = tintAmount))
      let rimStrength = 0
      const blessingCount = unitView.alive && unitView.dying < 0 && unitView.team !== 2 && (unitView.kind === "hero" || unitView.kind === "minion") ? teamBlessings[unitView.team] : 0
      if (
        (blessingCount > 0 && ((rimStrength = blessingCount < 5 ? 0.3 + 0.22 * Math.cos(total * 9) : 0.52), unitView.kind === "minion" && (lookState.glow *= 1.3)),
        unitView.rimLeft > 0 && ((unitView.rimLeft -= dt), unitView.rimLeft > 0 && (rimStrength = Math.max(rimStrength, Math.min(1, (unitView.rimLeft / unitView.rimDur) * 3)))),
        (lookState.rim = rimStrength),
        (lookState.xrayAmount = unitView.alive && unitView.dying < 0 && unitView.spawnT < 0 ? 1 : 0),
        lookState.xray.copy(unitView.isPlayer ? blueConfig.xSelf : unitView.team === 2 ? blueConfig.xNeutral : unitView.team === playerTeam ? blueConfig.xAlly : blueConfig.xEnemy),
        unitView.dying >= 0 && Number.isFinite(unitView.deathDur))
      ) {
        const deathRemaining = unitView.deathDur - unitView.dying
        deathRemaining < 0.4 && (lookState.opacity = Math.max(0, unitView.opacity * (deathRemaining / 0.4)))
      }
      if ((unitView.batch.push(unitView.puppet.skeleton, lookState), result++, unitView.shield > 0 && unitView.team !== 2 && unitView.dying < 0)) {
        const shieldBreakProgress = Math.max(0, unitView.shieldBreak)
        unitView.kind === "core"
          ? instanceBatch.push(unitView.x, 0.95, unitView.z, 3.05, 5.4, 16, blueConfig.shield[unitView.team], unitView.shield * unitView.opacity, shieldBreakProgress)
          : instanceBatch.push(unitView.x, 0.36, unitView.z, unitView.height > 9.2 ? 2.1 : 1.9, unitView.height - 3.3, 12, blueConfig.shield[unitView.team], unitView.shield * unitView.opacity, shieldBreakProgress)
      }
      if (!REVEAL_BY_KIND[unitView.kind] && unitView.dying < 0) {
        const shadowY = sceneContext.terrain.inWater(unitView.x, unitView.z) ? sceneContext.terrain.waterLevel + 0.03 : unitView.y / 0.6 + 0.05,
          shadowAlpha = unitView.opacity * (shadowsEnabled ? 1 : 1.4),
          liftScale = 1 / (1 + unitView.lift * 0.35),
          shadowOffset = unitView.radius * 0.25 + unitView.lift * 0.5
        if (
          (lineBatch.push(unitView.x, shadowY, unitView.z, unitView.radius * 0.62 * liftScale, blueConfig.shadow, 0.45 * shadowAlpha * liftScale, RING_STYLE_SHADOW),
          lineBatch.push(unitView.x + sunDirX * shadowOffset, shadowY, unitView.z + sunDirZ * shadowOffset, unitView.radius * 1.5 * liftScale, blueConfig.shadow, 0.3 * shadowAlpha * liftScale, RING_STYLE_SHADOW, sunDirectionAngle, 1.45),
          unitView.ring >= 0 && unitView.alive)
        ) {
          const ringColor = unitView.isPlayer ? blueConfig.player : teamColorFor(unitView.team)
          ;(lineBatch.push(unitView.x, shadowY + 0.01, unitView.z, unitView.radius * (unitView.kind === "hero" ? 1.3 : 1.15), ringColor, (unitView.kind === "hero" ? 0.85 : 0.6) * shadowAlpha, unitView.ring, Math.PI / 2 - unitView.yaw),
            blessingCount > 0 && unitView.kind === "minion" && lineBatch.push(unitView.x, shadowY + 0.012, unitView.z, unitView.radius * 1.34, blueConfig.blessRing, (blessingCount < 5 ? 0.35 + 0.25 * Math.cos(total * 9) : 0.6) * shadowAlpha, RING_STYLE_MINION))
        }
      }
    },
    nameConfig = {
      name: "units",
      get instanceCount() {
        return result
      },
      update(frame) {
        const state = frame.state
        ;((total += frame.dt), (playerTeam = frame.playerTeam), (teamBlessings[0] = state.teams[0].blessingLeft), (teamBlessings[1] = state.teams[1].blessingLeft), state.time < lastSimTime - 0.5 && resetUnitViews(), (lastSimTime = state.time), needsRuinsRefresh && ((needsRuinsRefresh = !1), syncTowerRuins(state)), updateScreenBounds())
        for (let index = 0; index < unitViews.length; index++) unitViews[index].seen = !1
        stateUnitsById.clear()
        const stateUnits = state.units
        for (let unitIndex = 0; unitIndex < stateUnits.length; unitIndex++) {
          const selected$ = stateUnits[unitIndex]
          stateUnitsById.set(selected$.id, selected$)
          let Result = unitViewsById.get(selected$.id)
          ;(Result ? Result.dying >= 0 && ((Result.dying = -1), (Result.fresh = !0)) : ((Result = createUnitView(selected$, state)), unitViewsById.set(selected$.id, Result), unitViews.push(Result)), syncUnitView(Result, selected$, frame))
        }
        isActive = !0
        for (let batchIndex = 0; batchIndex < outlineBatches.length; batchIndex++) outlineBatches[batchIndex].begin()
        ;(lineBatch.begin(), instanceBatch.begin(), (result = 0))
        for (let viewIndex = unitViews.length - 1; viewIndex >= 0; viewIndex--) {
          const selectedI = unitViews[viewIndex]
          if (!selectedI.seen) {
            if (selectedI.dying < 0) {
              if (selectedI.kind === "hero" || selectedI.deathDur <= 0) {
                ;(unitViewsById.delete(selectedI.id), unitViews.splice(viewIndex, 1))
                continue
              }
              markUnitDying(selectedI)
            }
            if (((selectedI.dying += frame.dt), (selectedI.flash = 0), (selectedI.flashBoost = 0), selectedI.dying >= selectedI.deathDur)) {
              ;(unitViewsById.delete(selectedI.id), unitViews.splice(viewIndex, 1))
              continue
            }
          }
          updateUnitView(selectedI, frame)
        }
        for (let ruinIndex = 0; ruinIndex < ruinProps.length; ruinIndex++) {
          const selectedR = ruinProps[ruinIndex]
          if (((selectedR.age += frame.dt), !isWithinScreenBounds(selectedR.x, selectedR.z, 3, 3))) continue
          const animInput = selectedR.puppet.input
          ;((animInput.anim = "idle"),
            (animInput.time = total),
            (animInput.t = selectedR.age),
            (animInput.p = Math.min(1, selectedR.age / 1.2)),
            selectedR.puppet.update(0, frame.dt, selectedR.x, 0, selectedR.z, 0, 1),
            (selectedR.look.glow = selectedR.puppet.output.glow),
            selectedR.batch.push(selectedR.puppet.skeleton, selectedR.look),
            result++)
        }
        if (isPrewarming) {
          sceneContext.rig.getFocus(focusPoint)
          for (const getModelKey of getModelKeys()) {
            const getOrBuildModelOrBuildModelValue = getOrBuildModel(getModelKey),
              gResult = getOrCreateBatch(getOrBuildModelOrBuildModelValue)
            if (gResult.count > 0) continue
            const animator = new Animator(getOrBuildModelOrBuildModelValue, 0)
            ;(animator.update(0, 0, focusPoint.x, 0, focusPoint.z, 0, 1), gResult.push(animator.skeleton, MaterialStateValue))
          }
          instanceBatch.push(focusPoint.x, 0.36, focusPoint.z, 1.9, 4, 12, blueConfig.shield[0], 1, 0)
        }
        for (let outlineEndIndex = 0; outlineEndIndex < outlineBatches.length; outlineEndIndex++) outlineBatches[outlineEndIndex].end()
        ;(lineBatch.end(), instanceBatch.end())
      },
      prewarm() {
        for (const modelKey of getModelKeys()) getOrCreateBatch(getOrBuildModel(modelKey))
        return (
          (isPrewarming = !0),
          () => {
            isPrewarming = !1
          }
        )
      },
      setQuality(targetObject) {
        ;((qualityName = targetObject.name), (outlineEnabled = targetObject.name !== "low"), (shadowsEnabled = targetObject.shadows))
        for (const outlineBatch of outlineBatches) {
          ;(outlineBatch.setShadows(shadowsEnabled), outlineBatch.setOutlineVisible(outlineEnabled))
          const batchRange = rangeByBatch.get(outlineBatch)
          batchRange && configureLodRange(batchRange.def, batchRange.range)
        }
      },
      /**
       * 查找单位。
       *
       * @param clientX - 输入
       * @param clientY - 输入
       * @param frameState - 第三输入
      */
      pickUnit(clientX, clientY, frameState) {
        let pickedUnitId = -1,
          bestScore = 1 / 0
        for (let index = 0; index < unitViews.length; index++) {
          const unitView = unitViews[index]
          if (!unitView.seen || !unitView.alive || unitView.id === frameState.playerId || unitView.opacity < 0.3 || unitView.culled) continue
          const pickAimHeight = Math.min(1.6, unitView.height * 0.45)
          if ((sceneContext.worldToScreen(unitView.x, unitView.y + unitView.lift + pickAimHeight, unitView.z, scratchScreenCenter), !scratchScreenCenter.visible)) continue
          sceneContext.worldToScreen(unitView.x + unitView.radius + 0.3, unitView.y + unitView.lift + pickAimHeight, unitView.z, scratchScreenEdge)
          const hitRadiusX = Math.max(24, Math.abs(scratchScreenEdge.x - scratchScreenCenter.x) * 1.2),
            hitRadiusZ = Math.max(hitRadiusX, hitRadiusX * Math.min(2.2, unitView.height / (unitView.radius * 2.6 + 0.4))),
            screenDx = scratchScreenCenter.x - clientX,
            screenDy = scratchScreenCenter.y - clientY,
            isEnemy = unitView.team !== playerTeam
          let pickScore = (screenDx / hitRadiusX) ** 2 + (screenDy / hitRadiusZ) ** 2
          if (pickScore > 1) {
            if (!isEnemy) continue
            const falloffScore = (screenDx / (hitRadiusX + DISTANCE_FALLOFF_BASE)) ** 2 + (screenDy / (hitRadiusZ + DISTANCE_FALLOFF_BASE)) ** 2
            if (falloffScore > 1) continue
            pickScore = 2 + falloffScore
          }
          let pickWeight = isEnemy ? (unitView.kind === "hero" ? 0.5 : 0.8) : 1.6
          ;(isEnemy && REVEAL_BY_KIND[unitView.kind] && stateUnitsById.get(unitView.id)?.invulnerable && (pickWeight = 1.5), pickScore * pickWeight < bestScore && ((bestScore = pickScore * pickWeight), (pickedUnitId = unitView.id)))
        }
        return pickedUnitId
      },
      getInfo(lookupKey, unitInfo) {
        const unitView = unitViewsById.get(lookupKey)
        return unitView
          ? ((unitInfo.id = lookupKey),
            (unitInfo.kind = unitView.kind),
            (unitInfo.x = unitView.x),
            (unitInfo.y = unitView.y + unitView.lift),
            (unitInfo.z = unitView.z),
            (unitInfo.height = unitView.height),
            (unitInfo.radius = unitView.radius),
            (unitInfo.opacity = unitView.opacity),
            (unitInfo.facing = Math.PI / 2 - unitView.yaw),
            (unitInfo.alive = unitView.dying < 0 && unitView.alive),
            (unitInfo.variant = unitView.variant),
            (unitInfo.spawning = unitView.spawnT >= 0 && unitView.dying < 0),
            !0)
          : !1
      },
      getAttach(lookupKey, attachJoint, outPosition) {
        const unitView = unitViewsById.get(lookupKey)
        return unitView ? (!unitView.culled && (unitView.puppet.attach(attachJoint, scratchAttachPoint) || unitView.puppet.attach("chest", scratchAttachPoint)) ? outPosition.set(scratchAttachPoint.x, scratchAttachPoint.y, scratchAttachPoint.z) : outPosition.set(unitView.x, unitView.y + unitView.lift + unitView.height * 0.6, unitView.z), !0) : !1
      },
      setTint(lookupKey, lookupOption, value) {
        const unitView = unitViewsById.get(lookupKey)
        unitView && (unitView.tintColor.set(lookupOption), (unitView.tintAmount = value))
      },
      flashTint(lookupKey, lookupOption, pulseAmount, pulseDuration) {
        const unitView = unitViewsById.get(lookupKey)
        !unitView || !(pulseDuration > 0) || (unitView.pulseColor.set(lookupOption), (unitView.pulseAmount = pulseAmount), (unitView.pulseDur = pulseDuration), (unitView.pulseLeft = pulseDuration))
      },
      flashRim(lookupKey, rimDuration) {
        const unitView = unitViewsById.get(lookupKey)
        !unitView || !(rimDuration > 0) || ((unitView.rimDur = rimDuration), (unitView.rimLeft = rimDuration))
      },
      reset() {
        ;(resetUnitViews(), (lastSimTime = -1))
      },
      dispose() {
        sceneContext.layers.units.remove(unitViewsGroup)
        for (const outlineBatch of outlineBatches) outlineBatch.dispose()
        ;(rangeByBatch.clear(), lineBatch.dispose(), instanceBatch.dispose(), unitViewsById.clear(), stateUnitsById.clear(), (unitViews.length = 0), (ruinProps.length = 0), batchByModelKey.clear(), (outlineBatches.length = 0))
      },
    }
  return (
    sceneContext.setUnitQuery({
      getPosition(lookupKey, outPosition) {
        const unitView = unitViewsById.get(lookupKey)
        return unitView ? (outPosition.set(unitView.x, unitView.y + unitView.lift, unitView.z), !0) : !1
      },
      getHeight(lookupKey) {
        const unitView = unitViewsById.get(lookupKey)
        return unitView ? unitView.height : 2
      },
    }),
    nameConfig
  )
}

const assetBuilders = [buildWorldSync, createUnitViews, createVisualKit, createFxOverlay]

function buildMatchAssets(sceneContext, matchState, buildOptions) {
  return buildStagedAssets(sceneContext, matchState, buildOptions, assetBuilders)
}

async function loadMatchAssetsAsync(stageElement, matchState, buildOptions, onProgress) {
  return await loadAssetsStaged(stageElement, matchState, buildOptions, assetBuilders, onProgress)
}

function preloadPortraits(menuHost, heroIds) {
  const loadPromises = [],
    seenPortraits = new Set()
  for (const heroId of heroIds) {
    let lookupKey = ""
    try {
      lookupKey = menuHost.portrait(heroId)
    } catch {
      lookupKey = ""
    }
    !lookupKey ||
      seenPortraits.has(lookupKey) ||
      BANNER_ANIM_CACHE.has(lookupKey) ||
      (seenPortraits.add(lookupKey),
      loadPromises.push(
        new Promise<void>((event) => {
          const portraitImage = new Image(),
            onPortraitLoaded = () => {
              ;(BANNER_ANIM_CACHE.add(lookupKey), event())
            }
          ;((portraitImage.src = lookupKey), typeof portraitImage.decode == "function" ? portraitImage.decode().then(onPortraitLoaded, () => event()) : (portraitImage.addEventListener("load", onPortraitLoaded), portraitImage.addEventListener("error", () => event())))
        }),
      ))
  }
  return Promise.all(loadPromises).then(() => {})
}

const gameTips = [
    "摧毁敌方水晶才算胜利——别只顾着击杀，记得带兵线推塔。",
    "防御塔会优先攻击小兵：等己方兵线进塔，再去攻击塔下的敌人。",
    "每条路要按 一塔 → 二塔 → 高地塔 的顺序拆，前面的没破，后面的塔和水晶打不动。",
    "补到最后一击可获得全额金币，只是站在附近只能拿到三成多。",
    "草丛可以隐藏身形，但在草里出手会暴露 1.5 秒。",
    "金币够了会自动购买推荐装备；想自己挑，随时打开商店。",
    "打掉蓝buff：技能冷却更短、回蓝更快；打掉红buff：普攻附带灼烧和减速。",
    "河道巨龙给全队金币和经验；星陨巨灵让全队变强、小兵也更猛。别一个人去打，等队友一起。",
    "残血别硬撑：回城要原地站 5 秒才能回到泉水，移动、攻击或受伤都会打断。",
    "被防御塔连续命中，伤害会越打越高——及时退出攻击范围。",
    "连杀会抬高你的赏金，被终结时对手将获得额外金币。",
    "樊哙的大盾最扛打：让他先冲，其他人跟上。",
    "程咬金放完技能后的下一下普攻会回血，换血别光放技能。",
    "王昭君的技能打中同一个人三次会眩晕，被她连中两下就该躲了。",
    "李广站着不动连续射击会越射越快，优先打断他。",
    "荆轲专挑残血下手：血量低于四成时离他远一点。",
  ],
  controlTips = {
    kbm: ["按住 Q / E / R 能看到技能范围，松开施放；按住时点鼠标右键或按 Esc 取消。", "鼠标右键点地面移动、点敌人攻击；按空格会自动打最合适的目标。"],
    touch: ["轻点技能键会自动瞄准；按住拖动可以自己瞄准，拖到「取消」圈里松手就不放。", "原地按住技能键不动，可以看这个技能的说明。"],
  }

function buildInterleavedTips(controlScheme) {
  const interleavedTips = gameTips.slice(),
    selectedControlTips = controlTips[controlScheme],
    tipsPerSegment = Math.floor(interleavedTips.length / (selectedControlTips.length + 1))
  return (selectedControlTips.forEach((controlTip, tipIndex) => interleavedTips.splice((tipIndex + 1) * tipsPerSegment + tipIndex, 0, controlTip)), interleavedTips)
}

function buildLineupCard(menuHost, heroId, teamIndex, isPlayer, cardIndex) {
  const selectedHERO_TABLE = HERO_TABLE[heroId],
    element = createEl("span", "sf-lcard__role", createIconEl(makeIconByName(selectedHERO_TABLE.role)), selectedHERO_TABLE.roleName),
    createElElement = createEl(
      "div",
      `sf-lcard${isPlayer ? " is-me" : ""}`,
      heroNameForBanner(menuHost, heroId, "sf-lcard__pic"),
      createEl("span", "sf-lcard__tag", isPlayer ? makeBadge("你", "me") : makeBadge("AI", "mute")),
      createEl("span", "sf-lcard__info", element, createEl("span", "sf-lcard__name", selectedHERO_TABLE.name), createEl("span", "sf-lcard__title", selectedHERO_TABLE.title), createEl("span", "sf-lcard__lane", createIconEl(createLaneIcon(selectedHERO_TABLE.lane)), laneLabels[selectedHERO_TABLE.lane])),
    )
  return (
    createElElement.setAttribute("aria-label", `${z0(selectedHERO_TABLE)}，${selectedHERO_TABLE.title}`),
    createElElement.style.setProperty("--hero", selectedHERO_TABLE.palette.glow),
    createElElement.style.setProperty("--role", ROLE_TINT_COLORS[selectedHERO_TABLE.role]),
    (createElElement.style.animationDelay = `${0.1 + (teamIndex === 0 ? cardIndex : 4 - cardIndex) * 0.07}s`),
    createElElement
  )
}

function buildLoadingScreen(element, playerHero, menuHost) {
  ;(injectThemeStyles(), injectStyleSheet("sf-menu-loading", LOADING_SCREEN_CSS))
  const buildTeamSection = (target) =>
      createEl(
        "section",
        `sf-loading__team sf-loading__team--${target === 0 ? "blue" : "red"}`,
        createEl("h3", "sf-loading__team-name", target === 0 ? "蓝色方" : "红色方", createEl("small", null, target === 0 ? "我方" : `敌方 · AI ${killFeedLine[playerHero.difficulty].label}`)),
        createEl("div", "sf-loading__cards", ...HERO_ID_LIST.map((heroId, cardIndex) => buildLineupCard(menuHost, heroId, target, target === 0 && heroId === playerHero.heroId, cardIndex))),
      ),
    tipTextEl = createEl("span"),
    tipRowEl = createEl("p", "sf-loading__tip", createIconEl(iconFor("info")), tipTextEl),
    statusLabelEl = createEl("span", "sf-loading__label", "正在准备战场…"),
    percentEl = createEl("span", "sf-loading__pct sf-num", "0%"),
    ProgressBarValue = createProgressBar(),
    ElValue = createEl(
      "div",
      "sf-screen sf-loading",
      createEl(
        "header",
        "sf-loading__head",
        createEl("h2", "sf-title sf-metal", "星陨高原"),
        createEl("p", "sf-loading__mode", "5v5 对战", createEl("i"), `你的英雄：${z0(playerHero.heroId)}`, createEl("i"), `对手难度：${killFeedLine[playerHero.difficulty].label}`),
      ),
      createEl("div", "sf-loading__versus", buildTeamSection(0), createEl("div", "sf-loading__vs", createEl("span"), createEl("b", "sf-metal", "VS")), buildTeamSection(1)),
      createEl("footer", "sf-loading__foot", tipRowEl, createEl("div", "sf-loading__bar", statusLabelEl, percentEl, ProgressBarValue.el)),
    ),
    loadingRootEl = createEl("div", "sf-root sf-loading-root", ElValue),
    CanvasTextureValue = makeCanvasTexture(loadingRootEl, "menu")
  element.appendChild(loadingRootEl)
  const InterleavedTipsValue = buildInterleavedTips(isOverlayAvailable())
  let tipIndex = (HERO_ID_LIST.indexOf(playerHero.heroId) * 5 + Math.floor(Math.random() * InterleavedTipsValue.length)) % InterleavedTipsValue.length
  tipTextEl.textContent = InterleavedTipsValue[tipIndex]
  let tipTimeoutId = 0
  const setIntervalResult = window.setInterval(() => {
    ;(tipRowEl.classList.add("is-out"),
      (tipTimeoutId = window.setTimeout(() => {
        ;((tipIndex = (tipIndex + 1) % InterleavedTipsValue.length), (tipTextEl.textContent = InterleavedTipsValue[tipIndex]), tipRowEl.classList.remove("is-out"))
      }, 360)))
  }, 4200)
  let isClosed = !1,
    lookupKey = 0
  return {
    setProgress(progress, propertyName?) {
      isClosed || ((lookupKey = Math.max(lookupKey, Math.max(0, Math.min(1, progress)))), ProgressBarValue.set(lookupKey), (percentEl.textContent = `${Math.round(lookupKey * 100)}%`), propertyName && (statusLabelEl.textContent = propertyName))
    },
    close() {
      isClosed ||
        ((isClosed = !0),
        window.clearInterval(setIntervalResult),
        window.clearTimeout(tipTimeoutId),
        loadingRootEl.classList.add("is-closing"),
        window.setTimeout(() => {
          ;(CanvasTextureValue.dispose(), loadingRootEl.remove())
        }, 400))
    },
  }
}

function createSimulation(seedConfig, simOptions?) {
  return new Simulation(seedConfig, simOptions)
}

const MATCH_END_GRACE_MS = 2600,
  MIN_LOADING_DISPLAY_MS = 1200,
  TIME_BUDGET_DIVISOR = 0.6,
  INTRO_WAIT_MS = 1500,
  MAX_SIM_STEPS = 6,
  EVENT_BATCH_THRESHOLD = MAX_SIM_STEPS + 2,
  TRACKED_EVENT_TYPES = new Set(["attack", "damage", "heal", "fx", "skillCast", "projectileHit", "gold", "itemBought", "reject"])

/**
 * 处理事件。
 *
 * @param events - 主要输入
 * @param keepFromIndex - 次要输入
 */
function filterReplayEvents(events, keepFromIndex) {
  const filteredEvents = []
  for (let index = 0; index < events.length; index++) {
    const selectedN = events[index]
    ;(index >= keepFromIndex || !TRACKED_EVENT_TYPES.has(selectedN.type)) && filteredEvents.push(selectedN)
  }
  return filteredEvents
}

const RENDER_LAYERS = { world: 0.05, scene: 0.2, warm: 0.5, hud: 0.92 },
  buildAssets = buildMatchAssets,
  loadAssetsAsync = loadMatchAssetsAsync,
  getEngine = (renderView) => renderView.engine,
  getMonotonicTime = () => performance.now()

function waitForNextFrame() {
  return new Promise<void>((resolveFrame) => {
    let frameReady = !1
    const onFrameReady = () => {
      frameReady || ((frameReady = !0), resolveFrame())
    }
    ;(requestAnimationFrame(() => window.setTimeout(onFrameReady, 0)), window.setTimeout(onFrameReady, 160))
  })
}

const sleep = (delayMs) => new Promise((resolveSleep) => window.setTimeout(resolveSleep, delayMs))

type MatchFinished = { kind: string; state?: unknown; endTime?: number }

async function startMatch(appContext, playerHero, matchOptions, cancelToken) {
  injectHudStyle()
  const { app: appElement, audio: audio, perf: perf } = appContext
  appContext.setPhase("loading")
  const LoadingScreenValue = buildLoadingScreen(appElement, playerHero, appContext.menuHost),
    MonotonicTimeValue = getMonotonicTime(),
    element = document.createElement("div")
  element.className = "app-match"
  const createElementElement = document.createElement("div")
  ;((createElementElement.className = "app-stage"), element.appendChild(createElementElement))
  let renderView = null,
    hudRoot = null,
    isHudDisposed = !1,
    isMatchDisposed = !1,
    abortMatch = () => {
      isMatchDisposed = !0
      try {
        ;(hudRoot?.dispose(), renderView?.dispose())
      } catch (cleanupError) {
        console.error(cleanupError)
      }
      ;((renderView = null), element.remove(), LoadingScreenValue.close())
    }
  const isCancelled = () => (cancelToken.cancelled ? (abortMatch(), !0) : !1)
  try {
    if ((LoadingScreenValue.setProgress(RENDER_LAYERS.world, "集结双方英雄…"), await waitForNextFrame(), isCancelled())) return null
    const seedConfig = { seed: matchOptions.seed, playerHero: playerHero.heroId, difficulty: playerHero.difficulty, autoPlay: matchOptions.autoPlay, autoBuy: appContext.getSettings().autoBuy },
      SimulationValue = createSimulation(seedConfig),
      matchState = SimulationValue.state
    if ((LoadingScreenValue.setProgress(RENDER_LAYERS.scene, "铺展星陨高原…"), await waitForNextFrame(), isCancelled())) return null
    appElement.insertBefore(element, appElement.firstChild)
    const quality = appContext.getSettings().quality,
      makeProgressFn = (startProgress, shoulderX) => (fraction) => LoadingScreenValue.setProgress(startProgress + (shoulderX - startProgress) * Math.max(0, Math.min(1, fraction)))
    if (typeof loadAssetsAsync == "function") {
      if (((renderView = await loadAssetsAsync(createElementElement, matchState, { quality: quality }, makeProgressFn(RENDER_LAYERS.scene, RENDER_LAYERS.warm))), isCancelled())) return null
    } else renderView = buildAssets(createElementElement, matchState, { quality: quality })
    if ((renderView.setCameraShake?.(appContext.getSettings().cameraShake), LoadingScreenValue.setProgress(typeof loadAssetsAsync == "function" ? RENDER_LAYERS.warm : 0.62, "点亮星辉与光影…"), await waitForNextFrame(), isCancelled())) return null
    if ((renderView.resize(), typeof renderView.prewarmAsync == "function")) {
      if ((await renderView.prewarmAsync(makeProgressFn(RENDER_LAYERS.warm, 0.9)), isCancelled())) return null
      renderView.render(matchState, 1, 0)
    } else {
      if ((renderView.render(matchState, 1, 0), LoadingScreenValue.setProgress(0.82, "点亮星辉与光影…"), await waitForNextFrame(), isCancelled())) return null
      renderView.render(matchState, 1, 1 / 60)
    }
    if (
      (renderView.snapCamera?.(),
      LoadingScreenValue.setProgress(RENDER_LAYERS.hud, "布置战斗界面…"),
      await Promise.race([
        preloadPortraits(
          appContext.menuHost,
          matchState.heroes.map((stateHero) => stateHero.heroId),
        ),
        sleep(INTRO_WAIT_MS),
      ]),
      await waitForNextFrame(),
      isCancelled())
    )
      return null
    let resolveFinished: (value: MatchFinished) => void = () => {},
      isFinished = !1
    const finishedPromise = new Promise<MatchFinished>((resolveFinished) => {
        resolveFinished = resolveFinished
      }),
      finishMatch = (towersDestroyed) => {
        isFinished || ((isFinished = !0), resolveFinished(towersDestroyed))
      },
      pauseReasons = new Set()
    let isRunning = !1
    const updateInputEnabled = () => {
        let hasBlockingPause = !1
        for (const pauseReason of pauseReasons) pauseReason !== "hud" && (hasBlockingPause = !0)
        isHudDisposed || hudRoot?.setInputEnabled(isRunning && !hasBlockingPause)
      },
      setPauseReason = (lookupKey, isPaused) => {
        ;(isPaused ? pauseReasons.add(lookupKey) : pauseReasons.delete(lookupKey), gameLoop.setPaused(pauseReasons.size > 0), updateInputEnabled())
      }
    let isPlayerDead = !1,
      deathTintAmount = 0,
      lastDeathTint = -1,
      hasPostGrade = !1,
      isStageGray = !1
    const ElementValue = document.createElement("div"),
      setStageGray = (shouldGray) => {
        shouldGray !== isStageGray && ((isStageGray = shouldGray), createElementElement.classList.toggle("is-gray", shouldGray))
      },
      updateDeathTint = (dtMs) => {
        const targetTint = isPlayerDead && !matchState.over ? 1 : 0
        if (deathTintAmount !== targetTint) {
          const tintStep = dtMs / TIME_BUDGET_DIVISOR
          deathTintAmount = deathTintAmount < targetTint ? Math.min(targetTint, deathTintAmount + tintStep) : Math.max(targetTint, deathTintAmount - tintStep)
        }
        const renderViewLocal = renderView
        if (!renderViewLocal) return
        if (typeof renderViewLocal.setDeathTint == "function") {
          ;(deathTintAmount !== lastDeathTint && (renderViewLocal.setDeathTint(deathTintAmount), (lastDeathTint = deathTintAmount)), setStageGray(!1))
          return
        }
        const EngineValue = getEngine(renderViewLocal),
          postGrade = EngineValue?.postEnabled === !0 ? EngineValue.grade : void 0
        ;(postGrade && (deathTintAmount !== lastDeathTint || !hasPostGrade) && ((postGrade.desaturate = deathTintAmount * 0.9), (postGrade.dim = deathTintAmount * 0.16), (lastDeathTint = deathTintAmount)), (hasPostGrade = !!postGrade), setStageGray(!postGrade && targetTint === 1))
      }
    let hudOverlayAvoidRect = null
    const commandConfig = {
        command: (targetPlayerId) => SimulationValue.command(matchState.playerId, targetPlayerId),
        setAim: (aimTarget) => renderView?.setAim(aimTarget),
        screenToGround: (clientX, clientY) => (renderView ? renderView.screenToGround(clientX, clientY) : null),
        worldToScreen: (worldX, height) => (renderView ? renderView.worldToScreen(worldX, height) : { x: 0, y: 0, visible: !1 }),
        pickUnit: (clientX, clientY) => (renderView ? renderView.pickUnit(clientX, clientY, matchState) : -1),
        setCameraPeek: (peekTarget) => renderView?.setCameraPeek(peekTarget),
        setPaused: (isPaused) => setPauseReason("hud", isPaused),
        quit: () => finishMatch({ kind: "quit" }),
        getSettings: appContext.getSettings,
        updateSettings: appContext.updateSettings,
        getFps: () => perf.fps,
        audio: audio,
        portrait: appContext.portrait,
        setOverlayAvoid: (avoidRect) => {
          ;((hudOverlayAvoidRect = avoidRect), renderView?.setOverlayAvoid?.(avoidRect))
        },
      },
      HudRootValue = createHudRoot(element, commandConfig, matchState, {
        dimTarget: ElementValue,
        onDeathChange: (isDead) => {
          isPlayerDead = isDead
        },
        inputEnabled: !1,
      })
    hudRoot = HudRootValue
    let eventsDuration = 0,
      hudDuration = 0,
      audioDuration = 0,
      lastFrameNow = -1,
      matchEndAt = -1,
      needsResize = !1
    const isFastSim = matchOptions.speed > 1,
      gameLoop = new GameLoop(
        {
          step: () => SimulationValue.step(),
          drain: () => SimulationValue.drainEvents(),
          /**
           * 处理事件。
           *
           * @param eventBatch - 输入
           * @param stepCount - 输入
           * @param lastCount - 输入
          */
          events(eventBatch, stepCount, lastCount) {
            const eventsToHandle = stepCount > EVENT_BATCH_THRESHOLD ? filterReplayEvents(eventBatch, lastCount) : eventBatch,
              getMonotonicTimeMonotonicTimeValue = getMonotonicTime()
            renderView?.handleEvents(eventsToHandle, matchState)
            const MonotonicTimeResult = getMonotonicTime()
            isHudDisposed || HudRootValue.handleEvents(eventBatch, matchState)
            const afterHudEventsTime = getMonotonicTime()
            ;(audio.handleEvents(eventsToHandle, matchState), (eventsDuration = MonotonicTimeResult - getMonotonicTimeMonotonicTimeValue), (hudDuration = afterHudEventsTime - MonotonicTimeResult), (audioDuration = getMonotonicTime() - afterHudEventsTime))
          },
          frame(frameTiming) {
            const frameStartTime = getMonotonicTime()
            ;(needsResize && ((needsResize = !1), renderView?.resize()), updateDeathTint(frameTiming.dt), renderView?.render(matchState, frameTiming.alpha, frameTiming.dt))
            const afterRenderTime = getMonotonicTime()
            isHudDisposed || HudRootValue.update(matchState, frameTiming.dt)
            const afterHudUpdateTime = getMonotonicTime()
            frameTiming.paused || audio.update(matchState, frameTiming.dt)
            const afterAudioUpdateTime = getMonotonicTime(),
              frameInterval = lastFrameNow >= 0 && frameTiming.dt > 0 ? frameTiming.now - lastFrameNow : 0
            ;((lastFrameNow = frameTiming.now),
              perf.frame(frameTiming.simMs, eventsDuration + (afterRenderTime - frameStartTime), hudDuration + (afterHudUpdateTime - afterRenderTime), audioDuration + (afterAudioUpdateTime - afterHudUpdateTime), afterAudioUpdateTime - frameTiming.now, frameInterval, frameTiming.steps),
              (eventsDuration = hudDuration = audioDuration = 0),
              matchState.over && (matchEndAt < 0 ? ((matchEndAt = frameTiming.now), (gameLoop.speed = 1)) : frameTiming.now - matchEndAt >= MATCH_END_GRACE_MS && finishMatch({ kind: "finished", state: matchState, endTime: matchState.endTime ?? matchState.time })))
          },
          error(loopError) {
            appContext.onLoopError(loopError)
          },
        },
        { now: getMonotonicTime, raf: (onRaf) => requestAnimationFrame(onRaf), caf: (rafId) => cancelAnimationFrame(rafId) },
        { stepDt: AREA_ALPHA_AGE_SCALE, maxFrameDt: isFastSim ? 1 : 0.25, maxSteps: isFastSim ? 30 : MAX_SIM_STEPS, speed: matchOptions.speed, simBudgetMs: isFastSim ? 240 : 80, gapResetSec: isFastSim ? 1 / 0 : 5 },
      ),
      onResize = () => {
        needsResize = !0
      },
      resizeObserver = typeof ResizeObserver == "function" ? new ResizeObserver(onResize) : null
    ;(resizeObserver?.observe(createElementElement), window.addEventListener("resize", onResize), window.addEventListener("orientationchange", onResize))
    const onVisibilityChange = () => gameLoop.resetClock()
    document.addEventListener("visibilitychange", onVisibilityChange)
    const onSettingsResult = appContext.onSettings((settingsPatch) => {
      ;(settingsPatch.autoBuy !== void 0 && !matchState.over && SimulationValue.command(matchState.playerId, { type: "autoBuy", enabled: settingsPatch.autoBuy }),
        renderView && (settingsPatch.quality !== void 0 && renderView.setQuality(settingsPatch.quality), settingsPatch.cameraShake !== void 0 && renderView.setCameraShake?.(settingsPatch.cameraShake)))
    })
    let contextLostDialog = null
    const rebuildRenderView = () => {
        const oldRenderView = renderView
        renderView = null
        try {
          oldRenderView?.dispose()
        } catch (disposeError) {
          console.error(disposeError)
        }
        ;(createElementElement.replaceChildren(),
          (renderView = buildAssets(createElementElement, matchState, { quality: appContext.getSettings().quality })),
          renderView.setCameraShake?.(appContext.getSettings().cameraShake),
          renderView.resize(),
          renderView.render(matchState, 1, 0),
          renderView.snapCamera?.(),
          hudOverlayAvoidRect && renderView.setOverlayAvoid?.(hudOverlayAvoidRect),
          (lastDeathTint = -1),
          (hasPostGrade = !1))
      },
      onContextLost = (contextEvent) => {
        isHalted ||
          !renderView ||
          contextLostDialog ||
          (contextEvent.preventDefault(),
          setPauseReason("context", !0),
          (contextLostDialog = showAppCardDialog(element, {
            title: "画面已中断",
            lines: ["图形设备被系统收回(常见于切到后台过久或显存不足)。", "对局已暂停，战况完好无损。"],
            buttons: [
              {
                label: "恢复画面",
                primary: !0,
                onClick() {
                  if (((contextLostDialog = null), !isHalted))
                    try {
                      ;(rebuildRenderView(), setPauseReason("context", !1))
                    } catch (restoreError) {
                      appContext.onLoopError(restoreError)
                    }
                },
              },
              {
                label: "返回主菜单",
                onClick() {
                  ;((contextLostDialog = null), finishMatch({ kind: "quit" }))
                },
              },
            ],
          })))
      },
      onContextRestored = () => {
        isHalted || !contextLostDialog || (contextLostDialog.close(), (contextLostDialog = null), (needsResize = !0), setPauseReason("context", !1))
      }
    ;(createElementElement.addEventListener("webglcontextlost", onContextLost, !0), createElementElement.addEventListener("webglcontextrestored", onContextRestored, !0))
    const disposeHud = () => {
      if (!isHudDisposed) {
        isHudDisposed = !0
        try {
          HudRootValue.dispose()
        } catch (disposeError) {
          console.error(disposeError)
        }
      }
    }
    let isHalted = !1
    const haltMatch = () => {
        if (!isHalted) {
          ;((isHalted = !0),
            gameLoop.stop(),
            finishMatch({ kind: "quit" }),
            resizeObserver?.disconnect(),
            window.removeEventListener("resize", onResize),
            window.removeEventListener("orientationchange", onResize),
            document.removeEventListener("visibilitychange", onVisibilityChange),
            createElementElement.removeEventListener("webglcontextlost", onContextLost, !0),
            createElementElement.removeEventListener("webglcontextrestored", onContextRestored, !0),
            onSettingsResult(),
            contextLostDialog?.close(),
            (contextLostDialog = null),
            disposeHud())
          try {
            audio.update(null, 0)
          } catch (audioError) {
            console.error(audioError)
          }
          element.remove()
        }
      },
      configConfig = {
        config: seedConfig,
        world: SimulationValue,
        state: matchState,
        get renderer() {
          return renderView
        },
        hud: HudRootValue,
        loop: gameLoop,
        stage: createElementElement,
        finished: finishedPromise,
        setPause: setPauseReason,
        disposeHud: disposeHud,
        halt: haltMatch,
        dispose() {
          if ((haltMatch(), !isMatchDisposed)) {
            isMatchDisposed = !0
            try {
              renderView?.dispose()
            } catch (disposeError) {
              console.error(disposeError)
            }
            renderView = null
          }
        },
      }
    ;((abortMatch = () => {
      ;(configConfig.dispose(), LoadingScreenValue.close())
    }),
      HudRootValue.update(matchState, 0),
      LoadingScreenValue.setProgress(1, "进入战场"))
    const remainingLoadMs = matchOptions.fastLoad ? 0 : MIN_LOADING_DISPLAY_MS - (getMonotonicTime() - MonotonicTimeValue)
    return (remainingLoadMs > 0 && (await sleep(remainingLoadMs)), await waitForNextFrame(), isCancelled() ? null : (perf.reset(), audio.setMusic("battle"), LoadingScreenValue.close(), appContext.setPhase("match"), (isRunning = !0), updateInputEnabled(), gameLoop.start(), configConfig))
  } catch (startMatchError) {
    throw (abortMatch(), startMatchError)
  }
}

export { getModelKeys, heroModelScaleByHero, startMatch, getMonotonicTime }