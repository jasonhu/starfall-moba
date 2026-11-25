/**
 * 特效系统：VfxSystem 生命周期、图标批渲染与视觉对象池
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Color, DynamicDrawUsage, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three'
import { VISION_RANGES } from '../game-balance'
import { ATLAS_COLS, ATLAS_ROWS } from '../particle-atlas'
import { InstancedSpriteBuffer, RIBBON_VERTEX_SHADER, ShapePool } from '../render/sprite-ribbons'
import { buildParticleAtlas, configureParticleMaterial } from '../render/noise-geometry'
import { FX_SHAPES, FX_STYLES, HERO_VFX_PALETTES, ObjectPool, SeededRandom, VFX_COLORS, hexToColor, triangleCountForShape } from './fx-definitions'
import { VFX_RIBBON_STYLES, HIT_FEEDBACK_TUNING, TrailBuilder, VFX_EMITTERS, emitDustTrail, emitFlashBurst, emitGlint, emitGroundImpact, emitHitSparks, emitShards, emitSparkBurst } from './emitters'
import { DECALS_FILL_RATIO_BY_QUALITY, GROUND_FX_KINDS } from '../render/decal-pen'

function createAnchorRecord() {
  return { x: 0, y: 0, z: 0, height: 2, radius: 0.6, visible: !1, opacity: 1, unit: null }
}

/**
 * 处理单位。
 *
 * @param unit - 主要输入
 * @returns 数值结果
 */
function visionRangeForUnitKind(unit) {
  switch (unit.kind) {
    case "hero":
      return VISION_RANGES.hero
    case "minion":
      return VISION_RANGES.minion
    case "tower":
      return VISION_RANGES.tower
    case "core":
      return VISION_RANGES.core
    default:
      return 0
  }
}

/**
 * 创建单位。
 *
 * @param worldContext - 来源
 * @param anchorPosition - 输入
 * @returns 结果对象
 */
function createUnitAnchorAdapter(worldContext, anchorPosition) {
  const unitDataMap = new Map()
  let lookupKey = new Float32Array(192),
    activeUnitCount = 0,
    frameState = worldContext.frame,
    unitsModule
  const xConfig = { x: 0, y: 0, z: 0, height: 2, opacity: 1 }
  return {
    begin(world) {
      ;((frameState = world), (unitsModule = worldContext.getModule("units")), unitDataMap.clear(), (activeUnitCount = 0))
      const playerTeam = world.playerTeam
      for (const unit of world.state.units) {
        if ((unitDataMap.set(unit.id, unit), unit.team !== playerTeam || !unit.alive)) continue
        const visionRangeForUnitKindResult = visionRangeForUnitKind(unit)
        if (!(visionRangeForUnitKindResult <= 0)) {
          if (activeUnitCount * 3 + 3 > lookupKey.length) {
            const float32Array = new Float32Array(lookupKey.length * 2)
            ;(float32Array.set(lookupKey), (lookupKey = float32Array))
          }
          ;((lookupKey[activeUnitCount * 3] = unit.pos.x), (lookupKey[activeUnitCount * 3 + 1] = unit.pos.y), (lookupKey[activeUnitCount * 3 + 2] = visionRangeForUnitKindResult * visionRangeForUnitKindResult), activeUnitCount++)
        }
      }
    },
    get(lookupKey, anchorOut) {
      const Value = unitDataMap.get(lookupKey)
      if (!Value) return !1
      const isVisible = Value.team === frameState.playerTeam || Value.visible[frameState.playerTeam]
      if (((anchorOut.radius = Value.radius), (anchorOut.unit = Value), unitsModule?.getInfo && unitsModule.getInfo(lookupKey, xConfig)))
        return ((anchorOut.x = xConfig.x), (anchorOut.y = xConfig.y), (anchorOut.z = xConfig.z), (anchorOut.height = xConfig.height), (anchorOut.opacity = xConfig.opacity), (anchorOut.visible = Value.alive && (isVisible || xConfig.opacity > 0.02)), !0)
      if (!worldContext.unitQuery.getPosition(lookupKey, anchorPosition)) {
        const blendAlpha = frameState.alpha
        anchorPosition.set(Value.prevPos.x + (Value.pos.x - Value.prevPos.x) * blendAlpha, 0, Value.prevPos.y + (Value.pos.y - Value.prevPos.y) * blendAlpha)
      }
      return ((anchorOut.x = anchorPosition.x), (anchorOut.y = anchorPosition.y), (anchorOut.z = anchorPosition.z), (anchorOut.height = worldContext.unitQuery.getHeight(lookupKey)), (anchorOut.opacity = 1), (anchorOut.visible = Value.alive && isVisible), !0)
    },
    unit(lookupKey) {
      return unitDataMap.get(lookupKey)
    },
    /**
     * 处理视野。
     *
     * @param queryX - 主要输入
     * @param queryZ - 次要输入
    */
    pointVisible(queryX, queryZ) {
      for (let index = 0; index < activeUnitCount; index++) {
        const deltaX = lookupKey[index * 3] - queryX,
          deltaZ = lookupKey[index * 3 + 1] - queryZ
        if (deltaX * deltaX + deltaZ * deltaZ <= lookupKey[index * 3 + 2]) return !0
      }
      return !1
    },
    attach(ownerId, scratchAttachPoint, attachKind) {
      const resolvedUnitsModule = unitsModule ?? worldContext.getModule("units")
      return resolvedUnitsModule?.getAttach ? resolvedUnitsModule.getAttach(ownerId, scratchAttachPoint, attachKind) : !1
    },
    flashTint(targetUnitId, violet, tintDuration, tintStrength) {
      ;(unitsModule ?? worldContext.getModule("units"))?.flashTint?.(targetUnitId, violet, tintDuration, tintStrength)
    },
    flashRim(targetUnitId, rimColor) {
      ;(unitsModule ?? worldContext.getModule("units"))?.flashRim?.(targetUnitId, rimColor)
    },
  }
}

const SKILL_ICON_INSTANCE_LIMIT = 512,
  ICON_BACKDROP_ATLAS_INDEX = 31,
  ICON_BACKDROP_COLOR = new Color(789016),
  ICON_INSTANCE_STRIDE = 12,
  ICON_VERTEX_SHADER = `
uniform vec2 uAtlas;
attribute vec4 aP;
attribute vec4 aC;
attribute vec4 aX;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vMix;
void main() {
  vec2 corner = position.xy;
  float cr = cos(aX.y);
  float sr = sin(aX.y);
  vec4 mv = viewMatrix * vec4(aP.xyz, 1.0);
  mv.xy += vec2(corner.x * cr - corner.y * sr, corner.x * sr + corner.y * cr) * aP.w;
  // 稍微朝相机拉近一点：贴在模型表面的图标不被模型吃掉
  mv.z += aX.w;
  gl_Position = projectionMatrix * mv;
  float cx = mod(aX.x, ${ATLAS_COLS}.0);
  float cy = floor(aX.x / ${ATLAS_COLS}.0);
  vUv = (vec2(cx, cy) + vec2(corner.x + 0.5, 0.5 - corner.y)) * uAtlas;
  vColor = aC;
  vMix = vec2(aX.z, max(aC.r, max(aC.g, aC.b)) * 0.85);
}
`

class IconBatch {
  mesh
  data = new Float32Array(SKILL_ICON_INSTANCE_LIMIT * ICON_INSTANCE_STRIDE)
  buffer
  geo
  mat
  n = 0
  range = { start: 0, count: 0 }
  constructor(atlasTexture) {
    const planeGeometry = new PlaneGeometry(1, 1),
      element = new InstancedBufferGeometry()
    ;(element.setIndex(planeGeometry.getIndex()), element.setAttribute("position", planeGeometry.getAttribute("position")))
    const instancedInterleavedBuffer = new InstancedInterleavedBuffer(this.data, ICON_INSTANCE_STRIDE, 1)
    ;(instancedInterleavedBuffer.setUsage(DynamicDrawUsage),
      ["aP", "aC", "aX"].forEach((attrName, attrIndex) => element.setAttribute(attrName, new InterleavedBufferAttribute(instancedInterleavedBuffer, 4, attrIndex * 4))),
      (element.instanceCount = 0),
      (this.geo = element),
      (this.buffer = instancedInterleavedBuffer),
      (this.mat = new ShaderMaterial({ uniforms: { uAtlas: { value: new Vector2(1 / ATLAS_COLS, 1 / ATLAS_ROWS) }, tAtlas: { value: atlasTexture } }, vertexShader: ICON_VERTEX_SHADER, fragmentShader: RIBBON_VERTEX_SHADER })),
      configureParticleMaterial(this.mat),
      (this.mesh = new Mesh(element, this.mat)),
      (this.mesh.name = "fx.sprites"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.renderOrder = 10),
      (this.mesh.visible = !1))
  }
  begin() {
    this.n = 0
  }
  draw(spark, posX, total, posZ, iconSize, rotation, tintColor, tintStrength, opacity, glowLevel, edgeFade = 0) {
    if (this.n >= SKILL_ICON_INSTANCE_LIMIT || opacity <= 0) return
    const dataState = this.data,
      dataOffset = this.n++ * ICON_INSTANCE_STRIDE
    ;((dataState[dataOffset] = posX),
      (dataState[dataOffset + 1] = total),
      (dataState[dataOffset + 2] = posZ),
      (dataState[dataOffset + 3] = iconSize),
      (dataState[dataOffset + 4] = tintColor.r * tintStrength),
      (dataState[dataOffset + 5] = tintColor.g * tintStrength),
      (dataState[dataOffset + 6] = tintColor.b * tintStrength),
      (dataState[dataOffset + 7] = opacity),
      (dataState[dataOffset + 8] = spark),
      (dataState[dataOffset + 9] = rotation),
      (dataState[dataOffset + 10] = glowLevel),
      (dataState[dataOffset + 11] = edgeFade))
  }
  icon(star8, iconX, iconY, iconZ, iconSize, rotation, accentColor, colorStrength, opacity, glowLevel, edgeFade = 0) {
    ;(this.draw(ICON_BACKDROP_ATLAS_INDEX, iconX, iconY, iconZ, iconSize * 1.9, 0, ICON_BACKDROP_COLOR, 1, 0.6 * opacity, 0, edgeFade - 0.02), this.draw(star8, iconX, iconY, iconZ, iconSize, rotation, accentColor, colorStrength, opacity, glowLevel, edgeFade))
  }
  flush() {
    const nState = this.n
    ;((this.geo.instanceCount = nState),
      (this.mesh.visible = nState > 0),
      nState !== 0 && ((this.range.start = 0), (this.range.count = nState * ICON_INSTANCE_STRIDE), (this.buffer.updateRanges.length = 0), this.buffer.updateRanges.push(this.range), (this.buffer.needsUpdate = !0)))
  }
  get count() {
    return this.n
  }
  dispose() {
    ;(this.geo.dispose(), this.mat.dispose())
  }
}

const QUALITY_VFX_BUDGETS = { low: { cap: 2048, scale: 0.45 }, medium: { cap: 4096, scale: 0.7 }, high: { cap: 6144, scale: 1 } },
  SCRATCH_FOCUS_POSITION = new Vector3()

class VfxSystem {
  ctx
  atlas
  particles
  ribbons
  decals
  glow
  sprites
  rnd = new SeededRandom(2654435769)
  a = createAnchorRecord()
  anchors
  now = 0
  dt = 0
  density = 1
  hooks = []
  onClear = []
  timers = []
  trackers = []
  tmp = new Vector3()
  constructor(renderContext) {
    ;((this.ctx = renderContext), (this.atlas = buildParticleAtlas()))
    const qualityBudget = QUALITY_VFX_BUDGETS[renderContext.settings.name] ?? QUALITY_VFX_BUDGETS.high
    ;((this.density = qualityBudget.scale),
      (this.particles = new InstancedSpriteBuffer(this.atlas, qualityBudget.cap)),
      (this.ribbons = new TrailBuilder()),
      (this.decals = new ObjectPool()),
      this.decals.setFill(DECALS_FILL_RATIO_BY_QUALITY[renderContext.settings.name] ?? 1),
      (this.glow = new ShapePool()),
      (this.sprites = new IconBatch(this.atlas)),
      (this.anchors = createUnitAnchorAdapter(renderContext, new Vector3())),
      (this.lowQ = renderContext.settings.name === "low"))
    const resolveAnchor = (lookupKey, outPosition) => (this.anchors.get(lookupKey, this.a) ? (outPosition.set(this.a.x, this.a.y, this.a.z), !0) : !1)
    ;((this.decals.resolve = resolveAnchor), (this.glow.resolve = resolveAnchor), renderContext.layers.fx.add(this.decals.mesh, this.decals.xrayMesh, this.glow.group, this.ribbons.mesh, this.particles.mesh, this.sprites.mesh))
  }
  setQuality(targetObject) {
    const qualityBudget = QUALITY_VFX_BUDGETS[targetObject.name] ?? QUALITY_VFX_BUDGETS.high
    ;((this.density = qualityBudget.scale), this.particles.setCapacity(qualityBudget.cap), this.decals.setFill(DECALS_FILL_RATIO_BY_QUALITY[targetObject.name] ?? 1), (this.lowQ = targetObject.name === "low"))
  }
  lowQ = !1
  n(requestedCount) {
    const targetParticleCount = requestedCount * this.density,
      baseParticleCount = Math.floor(targetParticleCount)
    return Math.max(1, baseParticleCount + (this.rnd.next() < targetParticleCount - baseParticleCount ? 1 : 0))
  }
  after(delay, callbackFn) {
    this.timers.push({ at: this.now + delay, fn: callbackFn })
  }
  track(unitId, duration, updateFn, endFn) {
    this.trackers.push({ unitId: unitId, t0: this.now, dur: duration, fn: updateFn, end: endFn ?? null })
  }
  trail(lookupKey, trailEnergy, trailDuration, heightOffset, trailColor, trailWidth, trailSpeed = 0, velocityZ = 0, velocityX = 0) {
    if (!this.anchors.get(lookupKey, this.a)) return
    const offsetX = -velocityX * trailSpeed,
      offsetZ = velocityZ * trailSpeed,
      startResult = this.ribbons.start(trailEnergy, this.a.x + offsetX, this.a.y + heightOffset, this.a.z + offsetZ, trailColor, trailWidth)
    startResult < 0 ||
      this.track(
        lookupKey,
        trailDuration,
        (unitPosition) => this.ribbons.move(startResult, unitPosition.x + offsetX, unitPosition.y + heightOffset, unitPosition.z + offsetZ),
        () => this.ribbons.end(startResult),
      )
  }
  anchor(lookupKey) {
    return lookupKey !== void 0 && lookupKey >= 0 && this.anchors.get(lookupKey, this.a) ? !0 : ((this.a.unit = null), !1)
  }
  light(lightX, lightY, lightZ, lightColor, lightMax, lightRadius, lightDur) {
    this.ctx.lights.pulse(lightX, lightY, lightZ, lightColor, lightMax, lightRadius, lightDur)
  }
  focusDist(pointX, pointZ) {
    return (this.ctx.rig.getFocus(SCRATCH_FOCUS_POSITION), Math.hypot(pointX - SCRATCH_FOCUS_POSITION.x, pointZ - SCRATCH_FOCUS_POSITION.z))
  }
  shake(shakeStrength, shakeX, shakeZ) {
    const focusDistResult = this.focusDist(shakeX, shakeZ),
      distanceFalloff = focusDistResult <= 12 ? 1 : focusDistResult >= 32 ? 0 : 1 - (focusDistResult - 12) / 20
    distanceFalloff > 0 && this.ctx.rig.shake(shakeStrength * distanceFalloff)
  }
  begin(frameUpdate) {
    const deltaTime = frameUpdate.dt
    ;((this.dt = deltaTime), (this.now += deltaTime))
    const nowState = this.now
    ;((this.particles.now = nowState), (this.ribbons.now = nowState), (this.decals.now = nowState), (this.glow.now = nowState), this.anchors.begin(frameUpdate), this.sprites.begin())
    const timerList = this.timers
    if (timerList.length > 0) {
      let timerWriteIndex = 0
      const lengthValue = timerList.length
      for (let index = 0; index < lengthValue; index++) {
        const selectedI = timerList[index]
        selectedI.at <= nowState ? selectedI.fn() : (timerList[timerWriteIndex++] = selectedI)
      }
      for (let timerReadIndex = lengthValue; timerReadIndex < timerList.length; timerReadIndex++) timerList[timerWriteIndex++] = timerList[timerReadIndex]
      timerList.length = timerWriteIndex
    }
    const trackerList = this.trackers
    if (trackerList.length > 0) {
      let trackerWriteIndex = 0
      const trackerCount = trackerList.length
      for (let trackerIndex = 0; trackerIndex < trackerCount; trackerIndex++) {
        const selectedA = trackerList[trackerIndex],
          trackerProgress = selectedA.dur > 0 ? (nowState - selectedA.t0) / selectedA.dur : 1,
          getValue = this.anchors.get(selectedA.unitId, this.a)
        ;(getValue && selectedA.fn(this.a, trackerProgress > 1 ? 1 : trackerProgress, deltaTime), !getValue || trackerProgress >= 1 ? selectedA.end?.() : (trackerList[trackerWriteIndex++] = selectedA))
      }
      for (let pendingTrackerIndex = trackerCount; pendingTrackerIndex < trackerList.length; pendingTrackerIndex++) trackerList[trackerWriteIndex++] = trackerList[pendingTrackerIndex]
      trackerList.length = trackerWriteIndex
    }
  }
  flush(frameData) {
    for (const hook of this.hooks) hook(frameData)
    ;(this.particles.flush(), this.ribbons.flush(), this.decals.flush(this.dt), this.glow.flush(), this.sprites.flush())
  }
  clear() {
    for (const tracker of this.trackers) tracker.end?.()
    ;((this.trackers.length = 0), (this.timers.length = 0), this.particles.clear(), this.ribbons.clear(), this.decals.clear(), this.glow.clear())
    for (const clearCallback of this.onClear) clearCallback()
  }
  get v() {
    return this.tmp
  }
  dispose() {
    ;(this.ctx.layers.fx.remove(this.decals.mesh, this.decals.xrayMesh, this.glow.group, this.ribbons.mesh, this.particles.mesh, this.sprites.mesh),
      this.particles.dispose(),
      this.ribbons.dispose(),
      this.decals.dispose(),
      this.glow.dispose(),
      this.sprites.dispose(),
      this.atlas.dispose(),
      (this.timers.length = 0),
      (this.trackers.length = 0),
      (this.hooks.length = 0),
      (this.onClear.length = 0))
  }
}

const NOOP_EFFECT_HOOK = () => {},
  HERO_GLOW_PALETTES = { glow: VFX_COLORS.moth, hot: hexToColor(16773312), deep: hexToColor(2062962) }

/**
 * 创建技能与配置。
 *
 * @param visualConfig - 来源
 * @returns 结果对象
 */
function createSkillVisualConfig(visualConfig) {
  return {
    mode: FX_STYLES.core,
    intensity: 1.8,
    add: 0.6,
    k: 1,
    roll: 0,
    yawSpin: 0,
    ribbon: VFX_RIBBON_STYLES.energy,
    ribbonWidth: 1,
    halo: 0,
    rate: 0,
    arc: 0,
    ground: 0,
    progress: -1,
    echo: 0,
    echoGap: 0.5,
    emit: NOOP_EFFECT_HOOK,
    hit: NOOP_EFFECT_HOOK,
    end: NOOP_EFFECT_HOOK,
    ...visualConfig,
  }
}

const XINGLI_TAIL_PALETTE = { ...HERO_VFX_PALETTES.xingli, tail: VFX_COLORS.stringGold, tail2: HERO_VFX_PALETTES.xingli.accent },
  YEQUE_TAIL_PALETTE = { ...HERO_VFX_PALETTES.yeque, tail: HERO_VFX_PALETTES.yeque.hot, tail2: HERO_VFX_PALETTES.yeque.deep },
  FENGLING_TAIL_PALETTE = { ...HERO_VFX_PALETTES.fengling, tail: VFX_COLORS.white, tail2: HERO_VFX_PALETTES.fengling.hot }

function emitImpactRing(vfxContext, impactColors, impactX, impactY, impactZ, ringRadius, ringSize, opacity = 0) {
  vfxContext.particles
    .use(VFX_EMITTERS.ringB)
    .tint(impactColors.hot, impactColors.glow)
    .spawn(impactX, impactY, impactZ, 0, 0, 0, ringSize, ringRadius * 0.3, ringRadius, opacity)
}

const SKILL_VISUALS = {
  xingli_basic: createSkillVisualConfig({
    shape: FX_SHAPES.slash,
    mode: FX_STYLES.slash,
    scale: [0.62, 0.62, 0.62],
    colors: () => XINGLI_TAIL_PALETTE,
    intensity: 2.3,
    add: 0.45,
    k: 0.62,
    progress: -2,
    ribbon: VFX_RIBBON_STYLES.string,
    ribbonWidth: 0.9,
    halo: 0.55,
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      ;(vfxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, hitColors.glow).spawn(hitX, hitY, hitZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.5, 0.85), emitImpactRing(vfxContext, hitColors, hitX, hitY, hitZ, 1.25, 0.24))
    },
  }),
  xingli_s1: createSkillVisualConfig({
    shape: FX_SHAPES.slash,
    mode: FX_STYLES.slash,
    scale: [1.12, 1.12, 1.12],
    colors: () => XINGLI_TAIL_PALETTE,
    intensity: 2.4,
    add: 0.35,
    k: 0.66,
    progress: -2,
    echo: 2,
    echoGap: 0.56,
    ribbon: VFX_RIBBON_STYLES.string,
    ribbonWidth: 1.5,
    halo: 1.1,
    rate: 30,
    ground: 1.1,
    emit(vfxContext, emitColors, emitX, emitY, emitZ, jitterAmount, jitterRange) {
      const random = vfxContext.rnd,
        randomSign = random.chance(0.5) ? 1 : -1,
        launchSpeed = random.range(4.5, 7.5)
      vfxContext.particles.use(VFX_EMITTERS.string).spawn(emitX - jitterAmount * random.range(0.3, 1.4), emitY + random.signed() * 0.08, emitZ - jitterRange * random.range(0.3, 1.4), -jitterRange * randomSign * launchSpeed, 0, jitterAmount * randomSign * launchSpeed, 0.12, 0.05, 0.02)
    },
    /**
     * 处理碰撞。
     *
     * @param vfxContext - 主要输入
     * @param hitColors - 次要输入
     * @param hitX - 第三输入
     * @param hitY - 第四输入
     * @param hitZ - 附加输入
     * @param enableShake - 附加输入
    */
    hit(vfxContext, hitColors, hitX, hitY, hitZ, enableShake) {
      ;(vfxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, hitColors.glow).spawn(hitX, hitY, hitZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 0.9, 1.5),
        emitImpactRing(vfxContext, hitColors, hitX, hitY, hitZ, 2, 0.28),
        emitImpactRing(vfxContext, hitColors, hitX, hitY, hitZ, 1.4, 0.3, 0.07),
        vfxContext.decals.add(GROUND_FX_KINDS.rings, hitX, hitZ, 1.3, 0.38).params(2, 0.22).color(hitColors.glow, 1.5).under(VFX_COLORS.shadow, 0.25))
      const useResult = vfxContext.particles.use(VFX_EMITTERS.mote)
      for (let index = 0; index < vfxContext.n(4); index++) useResult.spawn(hitX, hitY, hitZ, vfxContext.rnd.signed() * 3, vfxContext.rnd.range(0.5, 3), vfxContext.rnd.signed() * 3, 0.4, 0.2, 0.05)
      enableShake && vfxContext.shake(0.08, hitX, hitZ)
    },
    end(vfxContext, endColors, endX, endY, endZ) {
      emitImpactRing(vfxContext, endColors, endX, endY, endZ, 1.8, 0.32)
      const moteEmitter = vfxContext.particles.use(VFX_EMITTERS.mote)
      for (let index = 0; index < vfxContext.n(6); index++) moteEmitter.spawn(endX, endY, endZ, vfxContext.rnd.signed() * 2.5, vfxContext.rnd.range(-0.5, 2), vfxContext.rnd.signed() * 2.5, 0.5, 0.2, 0.05)
    },
  }),
  fengling_basic: createSkillVisualConfig({
    shape: FX_SHAPES.arrow,
    mode: FX_STYLES.solid,
    scale: [1.15, 1.15, 1.15],
    colors: () => FENGLING_TAIL_PALETTE,
    intensity: 1.3,
    add: 0.2,
    ribbon: VFX_RIBBON_STYLES.thin,
    ribbonWidth: 0.9,
    halo: 0.45,
    hit(vfxContext, hitColors, hitX, hitY, hitZ, sparkScale, directionX, directionZ) {
      ;(emitHitSparks(vfxContext, hitX, hitY, hitZ, 0.75, VFX_COLORS.white, hitColors.glow, directionX, directionZ, 3, HIT_FEEDBACK_TUNING.flashBasic, 6), vfxContext.particles.use(VFX_EMITTERS.plume).spawn(hitX, hitY, hitZ, vfxContext.rnd.signed() * 2 - directionX, 2, vfxContext.rnd.signed() * 2 - directionZ, 0.7, 0.34, 0.28))
    },
  }),
  fengling_s1: createSkillVisualConfig({
    shape: FX_SHAPES.arrow,
    mode: FX_STYLES.solid,
    scale: [2, 2, 2],
    colors: () => FENGLING_TAIL_PALETTE,
    intensity: 1.45,
    add: 0.25,
    roll: 4,
    ribbon: VFX_RIBBON_STYLES.white,
    ribbonWidth: 1.25,
    halo: 1,
    rate: 16,
    emit(vfxContext, emitColors, emitX, emitY, emitZ, burstSpeed, emitSpread) {
      const random = vfxContext.rnd,
        grassParticleSize = random.range(0.14, 0.26)
      vfxContext.particles
        .use(VFX_EMITTERS.grass)
        .spawn(emitX + random.signed() * 0.3, 0.1, emitZ + random.signed() * 0.3, burstSpeed * random.range(2, 5) + random.signed() * 1.5, random.range(1.2, 2.6), emitSpread * random.range(2, 5) + random.signed() * 1.5, random.range(0.35, 0.55), grassParticleSize, grassParticleSize * 0.8)
    },
    /**
     * 处理碰撞。
     *
     * @param vfxContext - 主要输入
     * @param hitColors - 次要输入
     * @param hitX - 第三输入
     * @param hitY - 第四输入
     * @param hitZ - 附加输入
     * @param enableShake - 附加输入
     * @param directionX - 附加输入
     * @param directionZ - 附加输入
    */
    hit(vfxContext, hitColors, hitX, hitY, hitZ, enableShake, directionX, directionZ) {
      ;(emitHitSparks(vfxContext, hitX, hitY, hitZ, 1.6, VFX_COLORS.white, hitColors.glow, directionX, directionZ, 6, HIT_FEEDBACK_TUNING.flashSkill, 9), emitGroundImpact(vfxContext, hitX, hitZ, 1.5, 0.3, hitColors.glow, 1.4, 0.2, 0.25))
      const tintResult = vfxContext.particles.use(VFX_EMITTERS.debris).tint(VFX_COLORS.stone, VFX_COLORS.stoneDark)
      for (let debrisIndex = 0; debrisIndex < vfxContext.n(12); debrisIndex++) {
        const spawnAngle = Math.atan2(directionZ, directionX) + vfxContext.rnd.signed() * 1,
          debrisSpeed = vfxContext.rnd.range(3, 8.5),
          debrisSize = vfxContext.rnd.range(0.18, 0.4)
        tintResult.spawn(hitX, hitY, hitZ, Math.cos(spawnAngle) * debrisSpeed, vfxContext.rnd.range(2, 6.5), Math.sin(spawnAngle) * debrisSpeed, vfxContext.rnd.range(0.55, 0.9), debrisSize, debrisSize * 0.8)
      }
      const dustEmitter = vfxContext.particles.use(VFX_EMITTERS.dust).tint(VFX_COLORS.stone, VFX_COLORS.stoneDark)
      for (let dustIndex = 0; dustIndex < vfxContext.n(3); dustIndex++) dustEmitter.spawn(hitX, hitY, hitZ, directionX * vfxContext.rnd.range(1, 3) + vfxContext.rnd.signed(), vfxContext.rnd.range(0.3, 1.2), directionZ * vfxContext.rnd.range(1, 3) + vfxContext.rnd.signed(), 0.5, 0.6, 1.4)
      const plumeEmitter = vfxContext.particles.use(VFX_EMITTERS.plume)
      for (let plumeIndex = 0; plumeIndex < vfxContext.n(3); plumeIndex++) plumeEmitter.spawn(hitX, hitY, hitZ, vfxContext.rnd.signed() * 3 - directionX * 2, vfxContext.rnd.range(1, 3.5), vfxContext.rnd.signed() * 3 - directionZ * 2, 0.9, 0.4, 0.32)
      enableShake && vfxContext.shake(HIT_FEEDBACK_TUNING.shakeSkill, hitX, hitZ)
    },
    end(vfxContext, endColors, endX, endY, endZ, directionX, directionZ, hasEffect) {
      if (!hasEffect) return
      ;(vfxContext.glow
        .spawn(FX_SHAPES.arrow, FX_STYLES.solid, 0.7)
        .at(endX + directionX * 0.2, 0.42, endZ + directionZ * 0.2)
        .scale(1.7)
        .rot(0, -Math.atan2(directionZ, directionX), -0.62)
        .color(endColors.hot, 1.3, 1)
        .fade(0, 0.7)
        .opt(0.2, 1, 0),
        vfxContext.particles.use(VFX_EMITTERS.dust).spawn(endX + directionX * 0.6, 0.12, endZ + directionZ * 0.6, directionX, 0.8, directionZ, 0.4, 0.4, 0.9))
      const particleSize = 0.2
      vfxContext.particles.use(VFX_EMITTERS.grass).spawn(endX + directionX * 0.6, 0.12, endZ + directionZ * 0.6, directionX * 2, 2.2, directionZ * 2, 0.5, particleSize, particleSize * 0.8)
    },
  }),
  yeque_s2: createSkillVisualConfig({
    shape: FX_SHAPES.dagger,
    mode: FX_STYLES.solid,
    scale: [0.86, 0.86, 0.86],
    colors: () => YEQUE_TAIL_PALETTE,
    intensity: 1.55,
    add: 0.2,
    roll: 3,
    ribbon: VFX_RIBBON_STYLES.thin,
    ribbonWidth: 0.85,
    halo: 0.5,
    rate: 14,
    emit(vfxContext, emitColors, emitX, emitY, emitZ, emitDrift, emitSpread) {
      const random = vfxContext.rnd,
        particleSize = random.range(0.06, 0.13)
      vfxContext.particles.use(VFX_EMITTERS.inkDot).spawn(emitX - emitDrift * 0.5, emitY, emitZ - emitSpread * 0.5, -emitDrift * 1.5 + random.signed(), random.range(0, 0.8), -emitSpread * 1.5 + random.signed(), 0.3, particleSize, particleSize * 0.6)
    },
    /**
     * 处理碰撞。
     *
     * @param vfxContext - 主要输入
     * @param hitColors - 次要输入
     * @param hitX - 第三输入
     * @param hitY - 第四输入
     * @param hitZ - 附加输入
     * @param enableShake - 附加输入
    */
    hit(vfxContext, hitColors, hitX, hitY, hitZ, enableShake) {
      ;(vfxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, hitColors.hot).spawn(hitX, hitY, hitZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.6, 1),
        vfxContext.particles.use(VFX_EMITTERS.glint).tint(hitColors.hot, hitColors.hot).spawn(hitX, hitY, hitZ, 0, 0, 0, 0.14, 0.7, 1.5),
        vfxContext.particles.use(VFX_EMITTERS.ink).spawn(hitX, hitY, hitZ, 0, 0.3, 0, 0.36, 0.5, 0.95, 0.02))
      const inkEmitter = vfxContext.particles.use(VFX_EMITTERS.inkDot)
      for (let inkIndex = 0; inkIndex < vfxContext.n(5); inkIndex++) {
        const particleSize = vfxContext.rnd.range(0.07, 0.16)
        inkEmitter.spawn(hitX, hitY, hitZ, vfxContext.rnd.signed() * 4, vfxContext.rnd.range(0.5, 3), vfxContext.rnd.signed() * 4, 0.4, particleSize, particleSize * 0.7)
      }
      enableShake && vfxContext.shake(0.06, hitX, hitZ)
    },
    end(vfxContext, endColors, endX, endY, endZ, directionX, directionZ, hasEffect) {
      hasEffect &&
        (vfxContext.glow
          .spawn(FX_SHAPES.dagger, FX_STYLES.solid, 0.55)
          .at(endX + directionX * 0.15, 0.3, endZ + directionZ * 0.15)
          .scale(0.86)
          .rot(0.4, -Math.atan2(directionZ, directionX), -0.7)
          .color(endColors.hot, 1.5, 1)
          .fade(0, 0.6)
          .opt(0.2, 1, 0),
        vfxContext.particles.use(VFX_EMITTERS.inkFlat).spawn(endX + directionX * 0.4, 0.07, endZ + directionZ * 0.4, 0, 0, 0, 0.7, 0.4, 0.7))
    },
  }),
  minion_ranged: createSkillVisualConfig({
    shape: FX_SHAPES.sphere,
    scale: [0.17, 0.17, 0.17],
    colors: triangleCountForShape,
    intensity: 1.6,
    ribbon: VFX_RIBBON_STYLES.thin,
    ribbonWidth: 0.75,
    halo: 0.6,
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      emitHitSparks(vfxContext, hitX, hitY, hitZ, 0.6, hitColors.hot, hitColors.glow, 0, 0, 2, HIT_FEEDBACK_TUNING.flashBasic, 4)
    },
  }),
  minion_siege: createSkillVisualConfig({
    shape: FX_SHAPES.sphere,
    scale: [0.34, 0.34, 0.34],
    colors: triangleCountForShape,
    intensity: 2.4,
    ribbon: VFX_RIBBON_STYLES.smoke,
    ribbonWidth: 1,
    halo: 1.3,
    rate: 18,
    arc: 1,
    emit(vfxContext, emitColors, emitX, emitY, emitZ) {
      vfxContext.particles.use(VFX_EMITTERS.ember).tint(emitColors.hot, emitColors.glow).spawn(emitX, emitY, emitZ, vfxContext.rnd.signed(), vfxContext.rnd.signed(), vfxContext.rnd.signed(), 0.4, 0.14, 0.04)
    },
    /**
     * 处理碰撞。
     *
     * @param vfxContext - 主要输入
     * @param hitColors - 次要输入
     * @param hitX - 第三输入
     * @param hitY - 第四输入
     * @param hitZ - 附加输入
    */
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      ;(emitFlashBurst(vfxContext, hitX, hitY, hitZ, 1.7, hitColors.hot, 0.2, !0),
        emitGroundImpact(vfxContext, hitX, hitZ, 1.4, 0.32, hitColors.glow, 1.4, 0.2, 0.3),
        emitSparkBurst(vfxContext, hitX, hitY, hitZ, 6, 7, hitColors.hot, hitColors.glow, 0, 0, 0, 0.35, 0.13),
        emitShards(vfxContext, hitX, hitY, hitZ, 3, 4, 4, hitColors.hot, hitColors.glow, 0.18),
        emitDustTrail(vfxContext, hitX, 0.3, hitZ, 3, 0.4, 1.2, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.6))
    },
  }),
  tower_bolt: createSkillVisualConfig({
    shape: FX_SHAPES.diamond,
    scale: [1.1, 0.72, 0.72],
    colors: triangleCountForShape,
    intensity: 2.4,
    add: 0.45,
    k: 1.4,
    roll: 10,
    ribbon: VFX_RIBBON_STYLES.bolt,
    ribbonWidth: 1.3,
    halo: 1.7,
    rate: 22,
    emit(vfxContext, emitColors, emitX, emitY, emitZ) {
      vfxContext.particles
        .use(VFX_EMITTERS.glint)
        .tint(emitColors.hot, emitColors.glow)
        .spawn(emitX, emitY, emitZ, vfxContext.rnd.signed() * 1.2, vfxContext.rnd.signed() * 1.2, vfxContext.rnd.signed() * 1.2, 0.22, 0.26, 0.05)
    },
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      emitFlashBurst(vfxContext, hitX, hitY, hitZ, 1.1, hitColors.hot, HIT_FEEDBACK_TUNING.flashBasic)
    },
  }),
  core_bolt: createSkillVisualConfig({
    shape: FX_SHAPES.diamond,
    scale: [1.35, 0.9, 0.9],
    colors: triangleCountForShape,
    intensity: 2.6,
    add: 0.45,
    k: 1.4,
    roll: 10,
    ribbon: VFX_RIBBON_STYLES.bolt,
    ribbonWidth: 1.8,
    halo: 2.3,
    rate: 30,
    emit(vfxContext, emitColors, emitX, emitY, emitZ) {
      vfxContext.particles
        .use(VFX_EMITTERS.glint)
        .tint(emitColors.hot, emitColors.glow)
        .spawn(emitX, emitY, emitZ, vfxContext.rnd.signed() * 2, vfxContext.rnd.signed() * 2, vfxContext.rnd.signed() * 2, 0.35, 0.36, 0.06)
    },
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      emitFlashBurst(vfxContext, hitX, hitY, hitZ, 1.9, hitColors.hot, 0.16, !0)
    },
  }),
  monster_spit: createSkillVisualConfig({
    shape: FX_SHAPES.sphere,
    scale: [0.24, 0.22, 0.22],
    colors: () => HERO_GLOW_PALETTES,
    mode: FX_STYLES.core,
    intensity: 1.7,
    add: 0.5,
    k: 1.2,
    ribbon: VFX_RIBBON_STYLES.dusty,
    ribbonWidth: 1,
    halo: 0.9,
    rate: 26,
    emit(vfxContext, emitColors, emitX, emitY, emitZ) {
      const random = vfxContext.rnd
      random.chance(0.6)
        ? vfxContext.particles
            .use(VFX_EMITTERS.puff)
            .tint(emitColors.glow, emitColors.deep)
            .spawn(emitX, emitY, emitZ, random.signed() * 0.5, random.range(-0.2, 0.3), random.signed() * 0.5, 0.35, 0.3, 0.6)
        : vfxContext.particles
            .use(VFX_EMITTERS.glint)
            .tint(emitColors.hot, emitColors.glow)
            .spawn(emitX, emitY, emitZ, random.signed() * 0.8, random.range(-0.6, 0.2), random.signed() * 0.8, 0.45, 0.2, 0.05)
    },
    /**
     * 处理碰撞。
     *
     * @param vfxContext - 主要输入
     * @param hitColors - 次要输入
     * @param hitX - 第三输入
     * @param hitY - 第四输入
     * @param hitZ - 附加输入
    */
    hit(vfxContext, hitColors, hitX, hitY, hitZ) {
      emitHitSparks(vfxContext, hitX, hitY, hitZ, 1, hitColors.hot, hitColors.glow, 0, 0, 3, HIT_FEEDBACK_TUNING.flashBasic, 4)
      const puffEmitter = vfxContext.particles.use(VFX_EMITTERS.puff).tint(hitColors.glow, hitColors.deep)
      for (let puffIndex = 0; puffIndex < vfxContext.n(4); puffIndex++) puffEmitter.spawn(hitX, hitY, hitZ, vfxContext.rnd.signed() * 1.6, vfxContext.rnd.range(0.2, 1), vfxContext.rnd.signed() * 1.6, 0.5, 0.4, 1.1)
      emitGlint(vfxContext, hitX, hitY, hitZ, 4, 2.2, hitColors.hot, hitColors.glow, 0.5, 0.22)
    },
  }),
}

export { SKILL_VISUALS, VfxSystem }
