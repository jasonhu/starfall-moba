/**
 * 特效发射器：VFX_EMITTERS 发射表、拖尾构建器、命中反馈调参与区域特效视图
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, InterleavedBuffer, InterleavedBufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three'
import { MAX_SPRITES, RIBBON_COMPOSE_SHADER, RIBBON_FRAGMENT_SHADER, RibbonState, SPRITE_CAPACITY, SPRITE_LAYOUTS, SPRITE_STRIDE, makeRibbonSpec, makeSpriteSpec } from '../render/sprite-ribbons'
import { configureParticleMaterial } from '../render/noise-geometry'
import { buildVfxTemplates } from '../../vfx/templates'
import { PARTICLE_KIND } from '../particle-atlas'
import { FX_SHAPES, FX_STYLES, HERO_VFX_PALETTES, VFX_COLORS, hexToColor, FX_TWO_PI } from './fx-definitions'
import { GROUND_FX_KINDS } from '../render/decal-pen'

class TrailBuilder {
  mesh
  now = 0
  ribbons = []
  data
  buffer
  geo
  mat
  range = { start: 0, count: 0 }
  lastHi = 0
  constructor() {
    const vertexCount = SPRITE_CAPACITY * MAX_SPRITES * 2
    this.data = new Float32Array(vertexCount * SPRITE_STRIDE)
    for (let index = 0; index < SPRITE_CAPACITY; index++) this.ribbons.push(new RibbonState())
    const bufferGeometry = new BufferGeometry(),
      interleavedBuffer = new InterleavedBuffer(this.data, SPRITE_STRIDE)
    ;(interleavedBuffer.setUsage(DynamicDrawUsage),
      bufferGeometry.setAttribute("position", new InterleavedBufferAttribute(interleavedBuffer, 3, 0)),
      bufferGeometry.setAttribute("aTan", new InterleavedBufferAttribute(interleavedBuffer, 3, 3)),
      bufferGeometry.setAttribute("aRib", new InterleavedBufferAttribute(interleavedBuffer, 4, 6)),
      bufferGeometry.setAttribute("aCol", new InterleavedBufferAttribute(interleavedBuffer, 4, 10)),
      bufferGeometry.setAttribute("aFx", new InterleavedBufferAttribute(interleavedBuffer, 2, 14)))
    const float32Array = new Float32Array(vertexCount * 2),
      indices = []
    for (let ribbonIndex = 0; ribbonIndex < SPRITE_CAPACITY; ribbonIndex++) {
      const ribbonUvV = (ribbonIndex * 0.6180339) % 1
      for (let spriteIndex = 0; spriteIndex < MAX_SPRITES; spriteIndex++) {
        const spriteVertexIndex = (ribbonIndex * MAX_SPRITES + spriteIndex) * 2
        ;((float32Array[spriteVertexIndex * 2] = -1), (float32Array[spriteVertexIndex * 2 + 1] = ribbonUvV), (float32Array[spriteVertexIndex * 2 + 2] = 1), (float32Array[spriteVertexIndex * 2 + 3] = ribbonUvV), spriteIndex < MAX_SPRITES - 1 && indices.push(spriteVertexIndex, spriteVertexIndex + 1, spriteVertexIndex + 2, spriteVertexIndex + 1, spriteVertexIndex + 3, spriteVertexIndex + 2))
      }
    }
    ;(bufferGeometry.setAttribute("uv", new BufferAttribute(float32Array, 2)),
      bufferGeometry.setIndex(indices),
      bufferGeometry.setDrawRange(0, 0),
      (this.geo = bufferGeometry),
      (this.buffer = interleavedBuffer),
      (this.mat = new ShaderMaterial({ uniforms: { uNow: { value: 0 } }, vertexShader: RIBBON_FRAGMENT_SHADER, fragmentShader: RIBBON_COMPOSE_SHADER, side: DoubleSide })),
      configureParticleMaterial(this.mat),
      (this.mesh = new Mesh(bufferGeometry, this.mat)),
      (this.mesh.name = "fx.ribbons"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.renderOrder = 8))
  }
  alloc() {
    for (const ribbon of this.ribbons)
      if (!ribbon.active) return ((ribbon.active = !0), (ribbon.stale = !1), (ribbon.once = !1), (ribbon.emitting = !0), (ribbon.count = 0), (ribbon.head = -1), (ribbon.widthScale = 1), (ribbon.gen = (ribbon.gen + 1) & 65535), ribbon)
    return null
  }
  pushPoint(ribbon, pointX, pointY, pointZ, birthTime) {
    ;((ribbon.head = (ribbon.head + 1) % MAX_SPRITES), (ribbon.px[ribbon.head] = pointX), (ribbon.py[ribbon.head] = pointY), (ribbon.pz[ribbon.head] = pointZ), (ribbon.birth[ribbon.head] = birthTime), ribbon.count < MAX_SPRITES - 1 && ribbon.count++)
  }
  start(ribbonStyle, pointX, pointY, pointZ, goldHot, altColor) {
    const element = this.alloc()
    return element ? ((element.style = ribbonStyle), element.c0.copy(goldHot ?? ribbonStyle.c0), element.c1.copy(altColor ?? goldHot ?? ribbonStyle.c1), (element.hx = pointX), (element.hy = pointY), (element.hz = pointZ), this.pushPoint(element, pointX, pointY, pointZ, this.now), this.ribbons.indexOf(element) | (element.gen << 8)) : -1
  }
  get(ribbonId) {
    if (ribbonId < 0) return null
    const selectedRibbons = this.ribbons[ribbonId & 255]
    return selectedRibbons && selectedRibbons.active && selectedRibbons.gen === ribbonId >> 8 ? selectedRibbons : null
  }
  move(lookupKey, pointX, pointY, pointZ) {
    const element = this.get(lookupKey)
    if (!element || !element.emitting) return
    ;((element.hx = pointX), (element.hy = pointY), (element.hz = pointZ))
    const headIndex = element.head,
      deltaX = pointX - element.px[headIndex],
      deltaY = pointY - element.py[headIndex],
      deltaZ = pointZ - element.pz[headIndex],
      ribbonStyle = element.style
    ;(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > ribbonStyle.step * ribbonStyle.step || this.now - element.birth[headIndex] > ribbonStyle.life / (MAX_SPRITES - 3)) && this.pushPoint(element, pointX, pointY, pointZ, this.now)
  }
  setWidth(lookupKey, propertyName) {
    const Value = this.get(lookupKey)
    Value && (Value.widthScale = propertyName)
  }
  end(lookupKey) {
    const getValue = this.get(lookupKey)
    !getValue || !getValue.emitting || ((getValue.emitting = !1), (getValue.endTime = this.now), this.pushPoint(getValue, getValue.hx, getValue.hy, getValue.hz, this.now))
  }
  trace(ribbonStyle, startX, startY, startZ, endX, endY, endZ, timeSpan, startColor, accent, arcHeight = 0) {
    const element = this.alloc()
    if (!element) return
    ;((element.style = ribbonStyle), element.c0.copy(startColor ?? ribbonStyle.c0), element.c1.copy(accent ?? startColor ?? ribbonStyle.c1))
    const segmentCount = MAX_SPRITES - 2
    for (let index = 0; index <= segmentCount; index++) {
      const progress = index / segmentCount
      this.pushPoint(element, startX + (endX - startX) * progress, startY + (endY - startY) * progress + Math.sin(progress * Math.PI) * arcHeight, startZ + (endZ - startZ) * progress, this.now + timeSpan * progress)
    }
    ;((element.count = MAX_SPRITES - 1), (element.hx = endX), (element.hy = endY), (element.hz = endZ), (element.emitting = !1), (element.endTime = this.now))
  }
  line(event, startX, startY, startZ, endX, endY, endZ, lineColor, widthScale = 1) {
    const element = this.alloc()
    if (!element) return
    ;((element.style = event), element.c0.copy(lineColor ?? event.c0), element.c1.copy(lineColor ?? event.c1), (element.once = !0), (element.widthScale = widthScale))
    const segmentCount = 6
    for (let index = 0; index <= segmentCount; index++) {
      const segmentProgress = index / segmentCount
      this.pushPoint(element, startX + (endX - startX) * segmentProgress, startY + (endY - startY) * segmentProgress, startZ + (endZ - startZ) * segmentProgress, this.now)
    }
    ;((element.hx = endX), (element.hy = endY), (element.hz = endZ), (element.emitting = !1))
  }
  flush() {
    this.mat.uniforms.uNow.value = this.now
    const nowState = this.now,
      dataState = this.data
    let lastActiveIndex = 0
    for (let index = 0; index < SPRITE_CAPACITY; index++) {
      const element = this.ribbons[index],
        ribbonDataOffset = index * MAX_SPRITES * 2 * SPRITE_STRIDE
      if (!element.active) {
        element.stale && (dataState.fill(0, ribbonDataOffset, ribbonDataOffset + MAX_SPRITES * 2 * SPRITE_STRIDE), (element.stale = !1), (lastActiveIndex = index + 1))
        continue
      }
      lastActiveIndex = index + 1
      const ribbonStyle = element.style,
        ribbonLife = ribbonStyle.life
      let writeIndex = 0,
        lastPointX = 0,
        lastPointY = 0,
        lastPointZ = 0,
        isActive = !1
      const pointCount = element.count + (element.emitting ? 1 : 0)
      for (let pointIndex = 0; pointIndex < MAX_SPRITES; pointIndex++) {
        let pointX, inputY, pointLife, pointLifeRatio
        if (pointIndex < pointCount) {
          if (element.emitting && pointIndex === 0) ((pointX = element.hx), (inputY = element.hy), (pointLife = element.hz), (pointLifeRatio = 0))
          else {
            const pointRingIndex = (element.head - (element.emitting ? pointIndex - 1 : pointIndex) + MAX_SPRITES * 2) % MAX_SPRITES
            ;((pointX = element.px[pointRingIndex]), (inputY = element.py[pointRingIndex]), (pointLife = element.pz[pointRingIndex]), (pointLifeRatio = element.once ? pointIndex / (pointCount - 1) : (nowState - element.birth[pointRingIndex]) / ribbonLife))
          }
          ;(pointLifeRatio < 1 && (isActive = !0), (lastPointX = pointX), (lastPointY = inputY), (lastPointZ = pointLife))
        } else ((pointX = lastPointX), (inputY = lastPointY), (pointLife = lastPointZ), (pointLifeRatio = 2))
        const vertexWriteOffset = ribbonDataOffset + writeIndex * 2 * SPRITE_STRIDE
        ;((dataState[vertexWriteOffset] = pointX), (dataState[vertexWriteOffset + 1] = inputY), (dataState[vertexWriteOffset + 2] = pointLife), (dataState[vertexWriteOffset + 7] = pointLifeRatio), writeIndex++)
      }
      if (element.once) {
        for (let fadePointIndex = 0; fadePointIndex < MAX_SPRITES; fadePointIndex++) {
          const pointDataOffset = ribbonDataOffset + fadePointIndex * 2 * SPRITE_STRIDE,
            selectedE = dataState[pointDataOffset + 7],
            fadeMask = selectedE <= 1 ? 1 : 0,
            fadeWidth = fadeMask * Math.min(1, Math.min(selectedE, 1 - selectedE) * 5 + 0.25)
          this.writePoint(pointDataOffset, element, ribbonStyle, fadePointIndex, ribbonStyle.width * 0.5 * fadeWidth, fadeMask * ribbonStyle.alpha * element.widthScale, 0, selectedE)
        }
        ;((element.active = !1), (element.stale = !0))
        continue
      }
      if (!isActive && !element.emitting) {
        ;((element.active = !1), dataState.fill(0, ribbonDataOffset, ribbonDataOffset + MAX_SPRITES * 2 * SPRITE_STRIDE))
        continue
      }
      for (let spriteIndex = 0; spriteIndex < MAX_SPRITES; spriteIndex++) {
        const liveDataOffset = ribbonDataOffset + spriteIndex * 2 * SPRITE_STRIDE,
          liveLife = dataState[liveDataOffset + 7]
        if (liveLife >= 1) {
          this.writePoint(liveDataOffset, element, ribbonStyle, spriteIndex, 0, 0, 1, 1)
          continue
        }
        const clampedLife = liveLife < 0 ? 0 : liveLife,
          pointWidth = ribbonStyle.width * 0.5 * element.widthScale * (1 + (ribbonStyle.taper - 1) * clampedLife),
          pointAlpha = liveLife < 0 ? 0 : ribbonStyle.alpha * (1 - clampedLife) * (1 - clampedLife * clampedLife)
        this.writePoint(liveDataOffset, element, ribbonStyle, spriteIndex, pointWidth, pointAlpha, clampedLife, clampedLife)
      }
    }
    const highestActiveIndex = Math.max(lastActiveIndex, this.lastHi)
    ;((this.lastHi = lastActiveIndex),
      this.geo.setDrawRange(0, lastActiveIndex * (MAX_SPRITES - 1) * 6),
      highestActiveIndex > 0 && ((this.range.start = 0), (this.range.count = highestActiveIndex * MAX_SPRITES * 2 * SPRITE_STRIDE), (this.buffer.updateRanges.length = 0), this.buffer.updateRanges.push(this.range), (this.buffer.needsUpdate = !0)),
      (this.mesh.visible = lastActiveIndex > 0))
  }
  /**
   * 处理坐标。
   *
   * @param dataOffset - 主要输入
   * @param ribbon - 界面元素
   * @param ribbonStyle - 第三输入
   * @param pointIndex - 第四输入
   * @param pointWidth - 附加输入
   * @param coreValue - 附加输入
   * @param colorMix - 附加输入
   * @param pointLife - 附加输入
  */
  writePoint(dataOffset, ribbon, ribbonStyle, pointIndex, pointWidth, coreValue, colorMix, pointLife) {
    const dataValue = this.data,
      strideOffset = 2 * SPRITE_STRIDE,
      prevVertexOffset = pointIndex > 0 ? dataOffset - strideOffset : dataOffset,
      nextVertexOffset = pointIndex < MAX_SPRITES - 1 ? dataOffset + strideOffset : dataOffset
    let tangentX = dataValue[prevVertexOffset] - dataValue[nextVertexOffset],
      tangentY = dataValue[prevVertexOffset + 1] - dataValue[nextVertexOffset + 1],
      tangentZ = dataValue[prevVertexOffset + 2] - dataValue[nextVertexOffset + 2]
    tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ < 1e-10 && (pointIndex > 0 ? ((tangentX = dataValue[prevVertexOffset + 3]), (tangentY = dataValue[prevVertexOffset + 4]), (tangentZ = dataValue[prevVertexOffset + 5])) : (tangentX = 1))
    const colorR = (ribbon.c0.r + (ribbon.c1.r - ribbon.c0.r) * colorMix) * (ribbonStyle.i0 + (ribbonStyle.i1 - ribbonStyle.i0) * colorMix),
      colorG = (ribbon.c0.g + (ribbon.c1.g - ribbon.c0.g) * colorMix) * (ribbonStyle.i0 + (ribbonStyle.i1 - ribbonStyle.i0) * colorMix),
      colorB = (ribbon.c0.b + (ribbon.c1.b - ribbon.c0.b) * colorMix) * (ribbonStyle.i0 + (ribbonStyle.i1 - ribbonStyle.i0) * colorMix),
      selectedC = dataValue[dataOffset],
      vertexY = dataValue[dataOffset + 1],
      vertexZ = dataValue[dataOffset + 2]
    for (let index = 0; index < 2; index++) {
      const vertexOffset = dataOffset + index * SPRITE_STRIDE
      ;((dataValue[vertexOffset] = selectedC),
        (dataValue[vertexOffset + 1] = vertexY),
        (dataValue[vertexOffset + 2] = vertexZ),
        (dataValue[vertexOffset + 3] = tangentX),
        (dataValue[vertexOffset + 4] = tangentY),
        (dataValue[vertexOffset + 5] = tangentZ),
        (dataValue[vertexOffset + 6] = pointWidth),
        (dataValue[vertexOffset + 7] = pointLife),
        (dataValue[vertexOffset + 8] = coreValue),
        (dataValue[vertexOffset + 9] = ribbonStyle.flat),
        (dataValue[vertexOffset + 10] = colorR),
        (dataValue[vertexOffset + 11] = colorG),
        (dataValue[vertexOffset + 12] = colorB),
        (dataValue[vertexOffset + 13] = ribbonStyle.add),
        (dataValue[vertexOffset + 14] = ribbonStyle.noise),
        (dataValue[vertexOffset + 15] = ribbonStyle.core))
    }
  }
  clear() {
    for (const ribbon of this.ribbons) (ribbon.active && (ribbon.stale = !0), (ribbon.active = !1))
  }
  dispose() {
    ;(this.geo.dispose(), this.mat.dispose())
  }
}

const VFX_EMITTERS = {
    spark: makeSpriteSpec({
      scale: 2.2,
      sprite: PARTICLE_KIND.streak,
      orient: SPRITE_LAYOUTS.stretch,
      add: 0.45,
      color: 16760896,
      color2: 16734736,
      intensity: 1.7,
      intensity2: 1.1,
      gravity: 13,
      drag: 3.2,
      stretch: 0.045,
      fadeIn: 0.01,
      fadeOut: 0.35,
    }),
    streak: makeSpriteSpec({ scale: 2.5, sprite: PARTICLE_KIND.streak, orient: SPRITE_LAYOUTS.stretch, color: 16777215, intensity: 1.8, intensity2: 1, drag: 2.2, stretch: 0.05, fadeIn: 0.02, fadeOut: 0.35, add: 0.5 }),
    glint: makeSpriteSpec({ pull: 0.3, scale: 1.4, sprite: PARTICLE_KIND.spark, add: 0.55, color: 16777215, intensity: 1.7, intensity2: 1.1, drag: 2.4, spin: 2.5, fadeIn: 0.15, fadeOut: 0.35 }),
    flash: makeSpriteSpec({ sprite: PARTICLE_KIND.glow, add: 0.55, color: 16777215, intensity: 1.05, intensity2: 0.65, alpha: 0.9, fadeIn: 0.02, fadeOut: 0.1 }),
    burst: makeSpriteSpec({ sprite: PARTICLE_KIND.burst, add: 0.6, color: 16777215, intensity: 1.25, intensity2: 0.8, fadeIn: 0.02, fadeOut: 0.15, spin: 0.8 }),
    dust: makeSpriteSpec({
      sprite: PARTICLE_KIND.smoke,
      sprite2: PARTICLE_KIND.smoke2,
      add: 0,
      color: 12890772,
      color2: 10785394,
      alpha: 0.62,
      alpha2: 0.28,
      drag: 2.8,
      gravity: -0.5,
      spin: 0.9,
      fadeIn: 0.08,
      fadeOut: 0.3,
      vary: 0.22,
    }),
    smoke: makeSpriteSpec({ sprite: PARTICLE_KIND.smoke, sprite2: PARTICLE_KIND.smoke2, add: 0, color: 5920096, color2: 2762800, alpha: 0.7, alpha2: 0.3, drag: 1.6, gravity: -1.1, spin: 0.7, fadeIn: 0.1, fadeOut: 0.35, vary: 0.25 }),
    debris: makeSpriteSpec({ scale: 1.2, sprite: PARTICLE_KIND.shard, add: 0, color: 10720902, color2: 8221030, gravity: 22, drag: 0.5, spin: 10, fadeIn: 0.01, fadeOut: 0.78, vary: 0.35 }),
    shard: makeSpriteSpec({ scale: 1.3, sprite: PARTICLE_KIND.diamond, add: 0.35, color: 16777215, intensity: 1.8, intensity2: 1, gravity: 14, drag: 1.2, spin: 9, fadeIn: 0.01, fadeOut: 0.6, vary: 0.2 }),
    ember: makeSpriteSpec({
      pull: 0.35,
      scale: 1.6,
      sprite: PARTICLE_KIND.ember,
      add: 0.55,
      color: 16756800,
      color2: 16728080,
      intensity: 1.7,
      intensity2: 1,
      gravity: -2.4,
      drag: 1.4,
      fadeIn: 0.05,
      fadeOut: 0.4,
      vary: 0.3,
    }),
    flame: makeSpriteSpec({
      pull: 0.45,
      scale: 1.15,
      sprite: PARTICLE_KIND.flame,
      add: 0.2,
      color: 16756272,
      color2: 14691344,
      intensity: 1.3,
      intensity2: 0.9,
      gravity: -4.5,
      drag: 1.6,
      rot: 0,
      fadeIn: 0.1,
      fadeOut: 0.5,
      vary: 0.2,
    }),
    star: makeSpriteSpec({ pull: 0.3, scale: 1.25, sprite: PARTICLE_KIND.star, add: 0.4, color: 16777215, intensity: 1.7, intensity2: 1.1, drag: 2.2, spin: 3, fadeIn: 0.08, fadeOut: 0.45 }),
    feather: makeSpriteSpec({ scale: 1.3, sprite: PARTICLE_KIND.feather, add: 0.22, color: 16777215, color2: 13631464, intensity: 1.15, gravity: 2.4, drag: 2.6, spin: 4, fadeIn: 0.05, fadeOut: 0.6 }),
    leaf: makeSpriteSpec({ scale: 1.35, sprite: PARTICLE_KIND.leaf, add: 0.2, color: 12124120, color2: 6283432, intensity: 1.4, gravity: 0.8, drag: 2.2, spin: 6, fadeIn: 0.06, fadeOut: 0.5 }),
    wisp: makeSpriteSpec({
      pull: 0.5,
      sprite: PARTICLE_KIND.wisp,
      sprite2: PARTICLE_KIND.smoke,
      add: 0.12,
      color: 5913256,
      color2: 1708080,
      alpha: 0.8,
      alpha2: 0.3,
      gravity: -1.8,
      drag: 1.8,
      spin: 1.2,
      fadeIn: 0.1,
      fadeOut: 0.35,
      vary: 0.2,
    }),
    coin: makeSpriteSpec({ scale: 1.5, sprite: PARTICLE_KIND.coin, add: 0.2, color: 16767072, color2: 16760880, intensity: 1.5, gravity: 14, drag: 0, spin: 5, fadeIn: 0.02, fadeOut: 0.85 }),
    ringB: makeSpriteSpec({ sprite: PARTICLE_KIND.ring, add: 0.5, color: 16777215, intensity: 2, intensity2: 1, fadeIn: 0.03, fadeOut: 0.25 }),
    plus: makeSpriteSpec({ pull: 0.4, scale: 1.5, sprite: PARTICLE_KIND.plus, add: 0.35, color: 11075520, color2: 3727488, intensity: 2, intensity2: 1.2, gravity: -1.2, drag: 1.2, rot: 0, fadeIn: 0.12, fadeOut: 0.5 }),
    hex: makeSpriteSpec({ scale: 1.3, sprite: PARTICLE_KIND.hex, add: 0.4, color: 15267583, color2: 9423103, intensity: 2, intensity2: 1.2, gravity: 6, drag: 1.6, spin: 5, fadeIn: 0.02, fadeOut: 0.5 }),
    rune: makeSpriteSpec({
      pull: 0.3,
      scale: 1.4,
      sprite: PARTICLE_KIND.rune1,
      sprite2: PARTICLE_KIND.rune2,
      add: 0.45,
      color: 16777215,
      intensity: 2.1,
      intensity2: 1.2,
      gravity: -0.8,
      drag: 1.5,
      rot: 0,
      fadeIn: 0.15,
      fadeOut: 0.55,
    }),
    ripple: makeSpriteSpec({ sprite: PARTICLE_KIND.ring, orient: SPRITE_LAYOUTS.flat, add: 0.5, color: 16777215, intensity: 1.6, intensity2: 0.8, fadeIn: 0.05, fadeOut: 0.3 }),
    drop: makeSpriteSpec({ scale: 1.3, sprite: PARTICLE_KIND.drop, add: 0.3, color: 13168752, color2: 6269484, intensity: 1.4, gravity: 16, drag: 0.8, rot: 0, fadeIn: 0.02, fadeOut: 0.7 }),
    frost: makeSpriteSpec({ pull: 0.3, scale: 1.4, sprite: PARTICLE_KIND.frost, add: 0.45, color: 15268095, color2: 8376575, intensity: 2, intensity2: 1.1, gravity: 0.6, drag: 2, spin: 2, fadeIn: 0.12, fadeOut: 0.5 }),
    crescent: makeSpriteSpec({ sprite: PARTICLE_KIND.crescent, add: 0.4, color: 16777215, intensity: 1.6, intensity2: 0.9, fadeIn: 0.03, fadeOut: 0.2 }),
    arrow: makeSpriteSpec({ scale: 1.4, sprite: PARTICLE_KIND.arrow, orient: SPRITE_LAYOUTS.stretch, add: 0.35, color: 16056312, color2: 10354648, intensity: 1.9, stretch: 0.012, fadeIn: 0.04, fadeOut: 0.92 }),
    bubble: makeSpriteSpec({ sprite: PARTICLE_KIND.bubble, add: 0.5, color: 16777215, intensity: 1.5, gravity: -1.5, drag: 1.5, fadeIn: 0.15, fadeOut: 0.6 }),
    bolt: makeSpriteSpec({ sprite: PARTICLE_KIND.bolt, add: 0.3, pull: 0.5, color: 16765002, intensity: 1.4, drag: 4, fadeIn: 0.02, fadeOut: 0.3 }),
    hitFlash: makeSpriteSpec({ sprite: PARTICLE_KIND.glow, add: 0.7, pull: 0.6, color: 16777215, intensity: 2.2, intensity2: 1.2, fadeIn: 0, fadeOut: 0.25 }),
    chip: makeSpriteSpec({
      scale: 1.6,
      sprite: PARTICLE_KIND.streak,
      orient: SPRITE_LAYOUTS.stretch,
      add: 0.6,
      color: 16771248,
      color2: 16742944,
      intensity: 2,
      intensity2: 1,
      gravity: 9,
      drag: 5,
      stretch: 0.03,
      fadeIn: 0,
      fadeOut: 0.3,
    }),
    scale: makeSpriteSpec({ scale: 1.2, sprite: PARTICLE_KIND.scale, add: 0.4, color: 13150463, color2: 6965976, intensity: 1.5, intensity2: 0.9, gravity: 1.5, drag: 2.2, spin: 6, fadeIn: 0.05, fadeOut: 0.55 }),
    puff: makeSpriteSpec({
      sprite: PARTICLE_KIND.puff,
      sprite2: PARTICLE_KIND.smoke2,
      add: 0.3,
      color: 12099839,
      color2: 3811962,
      intensity: 1.2,
      intensity2: 0.7,
      alpha: 0.75,
      alpha2: 0.25,
      drag: 2.6,
      gravity: -0.6,
      spin: 1.4,
      fadeIn: 0.06,
      fadeOut: 0.35,
      vary: 0.2,
    }),
    broadleaf: makeSpriteSpec({ scale: 1.1, sprite: PARTICLE_KIND.broadleaf, add: 0, color: 9417818, color2: 6261306, gravity: 2.2, drag: 3, spin: 7, fadeIn: 0.03, fadeOut: 0.6, vary: 0.25 }),
    splash: makeSpriteSpec({ sprite: PARTICLE_KIND.splash, orient: SPRITE_LAYOUTS.flat, add: 0.35, color: 15925243, color2: 12578800, intensity: 1.05, intensity2: 0.7, alpha: 0.9, alpha2: 0.4, fadeIn: 0.04, fadeOut: 0.35 }),
    droplet: makeSpriteSpec({ scale: 1.1, sprite: PARTICLE_KIND.drop, add: 0.3, color: 15400955, color2: 10477800, intensity: 1.15, gravity: 14, drag: 0.6, rot: 0, fadeIn: 0.02, fadeOut: 0.6 }),
    star8: makeSpriteSpec({ pull: 0.3, scale: 1.3, sprite: PARTICLE_KIND.star8, add: 0.5, color: 16773304, color2: 16764768, intensity: 1.8, intensity2: 1.1, drag: 1.8, spin: 1.5, fadeIn: 0.08, fadeOut: 0.5 }),
    goose: makeSpriteSpec({ sprite: PARTICLE_KIND.goose, orient: SPRITE_LAYOUTS.stretch, stretch: 0, add: 0.4, color: 15923455, color2: 10276095, intensity: 1.75, intensity2: 1, fadeIn: 0.06, fadeOut: 0.55 }),
    gooseShade: makeSpriteSpec({ sprite: PARTICLE_KIND.goose, orient: SPRITE_LAYOUTS.stretch, stretch: 0, add: 0, color: 1713240, alpha: 0.6, alpha2: 0.2, fadeIn: 0.06, fadeOut: 0.5 }),
    wave: makeSpriteSpec({ sprite: PARTICLE_KIND.wave, orient: SPRITE_LAYOUTS.stretch, stretch: 0, add: 0.5, color: 15923455, color2: 9225471, intensity: 1.8, intensity2: 1, drag: 3, fadeIn: 0.04, fadeOut: 0.35 }),
    mote: makeSpriteSpec({ pull: 0.3, sprite: PARTICLE_KIND.dot, add: 0.65, color: 16773320, color2: 16762976, intensity: 2.2, intensity2: 1.1, drag: 2.2, fadeIn: 0.1, fadeOut: 0.4 }),
    string: makeSpriteSpec({ sprite: PARTICLE_KIND.streak, orient: SPRITE_LAYOUTS.stretch, add: 0.6, color: 16773832, color2: 16762976, intensity: 2.1, intensity2: 1.1, drag: 0.6, stretch: 0.05, fadeIn: 0, fadeOut: 0.45 }),
    ink: makeSpriteSpec({ sprite: PARTICLE_KIND.ink, add: 0, color: 920086, color2: 1840168, alpha: 0.94, alpha2: 0.45, drag: 3.2, gravity: 1.2, spin: 0.7, fadeIn: 0.03, fadeOut: 0.45, vary: 0.1 }),
    inkFlat: makeSpriteSpec({ sprite: PARTICLE_KIND.ink, orient: SPRITE_LAYOUTS.flat, add: 0, color: 920086, color2: 1840168, alpha: 0.88, alpha2: 0.6, fadeIn: 0.02, fadeOut: 0.55 }),
    inkDot: makeSpriteSpec({ sprite: PARTICLE_KIND.ember, add: 0, color: 920086, color2: 1840168, alpha: 0.95, alpha2: 0.7, gravity: 12, drag: 1.2, fadeIn: 0.01, fadeOut: 0.7 }),
    inkRise: makeSpriteSpec({ pull: 0.3, sprite: PARTICLE_KIND.ember, add: 0, color: 1445922, color2: 2366004, alpha: 0.85, alpha2: 0.3, gravity: -1.4, drag: 1.6, fadeIn: 0.12, fadeOut: 0.45 }),
    silk: makeSpriteSpec({ sprite: PARTICLE_KIND.shard, add: 0, color: 15919828, color2: 13615776, gravity: 2.4, drag: 2.8, spin: 5, fadeIn: 0.03, fadeOut: 0.6, vary: 0.12 }),
    grass: makeSpriteSpec({ sprite: PARTICLE_KIND.leaf, add: 0, color: 11059296, color2: 7309882, gravity: 8, drag: 2.6, spin: 10, fadeIn: 0.02, fadeOut: 0.65, vary: 0.25 }),
    plume: makeSpriteSpec({ scale: 1.25, sprite: PARTICLE_KIND.feather, add: 0.12, color: 16777215, color2: 15790838, intensity: 1.15, gravity: 1.5, drag: 2.8, spin: 3.2, fadeIn: 0.05, fadeOut: 0.6 }),
  },
  VFX_RIBBON_STYLES = {
    dust: makeRibbonSpec({ width: 1.3, life: 0.5, color: 12890772, color2: 10127984, add: 0, noise: 0.85, taper: 1.5, core: 0, alpha: 0.55, step: 0.35 }),
    energy: makeRibbonSpec({ width: 0.5, life: 0.25, color: 16777215, intensity: 1.5, intensity2: 0.9, add: 0.3, taper: 0.1, core: 0.4, step: 0.2 }),
    thin: makeRibbonSpec({ width: 0.16, life: 0.12, color: 16777215, intensity: 1.9, intensity2: 1, add: 0.5, taper: 0, core: 0.6, step: 0.2 }),
    bolt: makeRibbonSpec({ width: 0.62, life: 0.13, color: 16777215, intensity: 1.7, intensity2: 1, add: 0.35, taper: 0.2, core: 0.75, step: 0.15 }),
    dusty: makeRibbonSpec({ width: 0.42, life: 0.16, color: 13172720, color2: 3123360, intensity: 1.3, intensity2: 0.7, add: 0.3, noise: 0.6, taper: 0.4, core: 0.3, step: 0.18 }),
    fire: makeRibbonSpec({ width: 1.5, life: 0.5, color: 16742934, color2: 13114380, intensity: 1.35, intensity2: 0.9, add: 0.2, noise: 0.9, taper: 0.5, core: 0.2, step: 0.3 }),
    wind: makeRibbonSpec({ width: 0.6, life: 0.4, color: 8057538, color2: 2082948, intensity: 1.2, intensity2: 0.8, add: 0.3, noise: 0.7, taper: 0.2, core: 0.2, alpha: 0.75, step: 0.25 }),
    shadow: makeRibbonSpec({ width: 1.3, life: 0.45, color: 9067775, color2: 1708080, intensity: 1.3, intensity2: 0.6, add: 0.35, noise: 0.8, taper: 0.6, core: 0.25, alpha: 0.9, step: 0.3 }),
    smoke: makeRibbonSpec({ width: 0.6, life: 0.6, color: 9078416, color2: 4867664, add: 0, noise: 0.9, taper: 1.6, core: 0, alpha: 0.5, step: 0.3 }),
    ink: makeRibbonSpec({ width: 1.15, life: 0.5, color: 1182748, color2: 657424, add: 0, noise: 0.8, taper: 0.85, core: 0, alpha: 0.94, step: 0.3 }),
    string: makeRibbonSpec({ width: 0.12, life: 0.14, color: 16773832, color2: 16762976, intensity: 2.1, intensity2: 1.1, add: 0.55, taper: 0.5, core: 0.75, step: 0.2 }),
    white: makeRibbonSpec({ width: 0.2, life: 0.2, color: 16777215, color2: 14086884, intensity: 1.8, intensity2: 0.9, add: 0.45, taper: 0.05, core: 0.7, step: 0.25 }),
    warn: makeRibbonSpec({ width: 0.13, life: 1, color: 16726568, intensity: 1.6, add: 0.45, noise: 0.25, core: 0.7 }),
    link: makeRibbonSpec({ width: 0.14, life: 1, color: 16777215, intensity: 1.5, add: 0.45, noise: 0.2, core: 0.5 }),
  },
  SPHERE_GLOW_INTENSITY_SCALE = 0.6,
  SPHERE_CORE_INTENSITY_SCALE = 0.55,
  PILLAR_GLOW_INTENSITY_SCALE = 0.55,
  HOOP_GLOW_INTENSITY_SCALE = 0.65,
  FX_GLOW_INTENSITY_SCALE = 0.6

function emitSparkBurst(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, bronze = VFX_COLORS.spark, tintAltColor = VFX_COLORS.sparkDeep, directionX = 0, directionY = 0, directionMix = 0, lifeSpan = 0.4, spriteSize = 0.14) {
  const tintResult = fxSystem.particles.use(VFX_EMITTERS.spark).tint(bronze, tintAltColor),
    rng = fxSystem.rnd,
    nResult = fxSystem.n(requestedCount)
  for (let index = 0; index < nResult; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      verticalSpeedFactor = rng.range(0.1, 1),
      lateralSpeedScale = Math.sqrt(1 - verticalSpeedFactor * verticalSpeedFactor * 0.6),
      adjustedSpeed = burstSpeed * rng.range(0.45, 1)
    tintResult.spawn(
      spawnX,
      spawnY,
      spawnZ,
      (Math.cos(spawnAngle) * lateralSpeedScale * (1 - directionMix) + directionX * directionMix * rng.range(0.6, 1.3)) * adjustedSpeed,
      verticalSpeedFactor * adjustedSpeed * 0.9,
      (Math.sin(spawnAngle) * lateralSpeedScale * (1 - directionMix) + directionY * directionMix * rng.range(0.6, 1.3)) * adjustedSpeed,
      lifeSpan * rng.range(0.6, 1.2),
      spriteSize * rng.range(0.7, 1.3),
      spriteSize * 0.4,
    )
  }
}

function emitGlint(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, tintPrimary, tintAltColor = tintPrimary, lifeSpan = 0.6, spriteSize = 0.34) {
  const glintEmitter = fxSystem.particles.use(VFX_EMITTERS.glint).tint(tintPrimary === VFX_COLORS.white ? tintAltColor : tintPrimary, tintAltColor),
    rng = fxSystem.rnd,
    nNResult = fxSystem.n(requestedCount)
  for (let index = 0; index < nNResult; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      verticalSpeedOffset = rng.range(-0.3, 1),
      lateralSpeedScale = Math.sqrt(Math.max(0, 1 - verticalSpeedOffset * verticalSpeedOffset)),
      adjustedSpeed = burstSpeed * rng.range(0.35, 1)
    glintEmitter.spawn(spawnX, spawnY, spawnZ, Math.cos(spawnAngle) * lateralSpeedScale * adjustedSpeed, verticalSpeedOffset * adjustedSpeed, Math.sin(spawnAngle) * lateralSpeedScale * adjustedSpeed, lifeSpan * rng.range(0.6, 1.2), spriteSize * rng.range(0.6, 1.3), spriteSize * 0.2, rng.range(0, 0.06))
  }
}

function emitFlashBurst(fxSystem, spawnX, spawnY, spawnZ, spriteSize, flashColor, lifeSpan = 0.22, emitExtraBurst = !1) {
  ;(fxSystem.particles
    .use(VFX_EMITTERS.flash)
    .tint(flashColor)
    .spawn(spawnX, spawnY, spawnZ, 0, 0, 0, lifeSpan, spriteSize * 0.55, spriteSize),
    emitExtraBurst &&
      fxSystem.particles
        .use(VFX_EMITTERS.burst)
        .tint(flashColor)
        .spawn(spawnX, spawnY, spawnZ, 0, 0, 0, lifeSpan * 0.9, spriteSize * 0.7, spriteSize * 1.5))
}

function emitDustPuff(fxSystem, spawnX, spawnZ, requestedCount, spreadRadius, burstSpeed, tintPrimary = VFX_COLORS.dust, tintAltColor = VFX_COLORS.dustDark, spriteSize = 1.1, lifeSpan = 0.8) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.dust).tint(tintPrimary, tintAltColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount),
    baseAngle = rng.next() * FX_TWO_PI
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = baseAngle + (index / particleCount) * FX_TWO_PI + rng.range(-0.2, 0.2),
      xDirection = Math.cos(spawnAngle),
      zDirection = Math.sin(spawnAngle),
      adjustedSpeed = burstSpeed * rng.range(0.7, 1.15)
    tintedEmitter.spawn(spawnX + xDirection * spreadRadius, rng.range(0.15, 0.4), spawnZ + zDirection * spreadRadius, xDirection * adjustedSpeed, rng.range(0.2, 1.2), zDirection * adjustedSpeed, lifeSpan * rng.range(0.7, 1.2), spriteSize * rng.range(0.5, 0.8), spriteSize * rng.range(1.2, 1.8))
  }
}

function emitDustTrail(fxSystem, spawnX, spawnY, spawnZ, requestedCount, spreadRadius, sizeScale, tintPrimary = VFX_COLORS.dust, tintAltColor = VFX_COLORS.dustDark, lifeSpan = 0.7) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.dust).tint(tintPrimary, tintAltColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      offsetRadius = Math.sqrt(rng.next()) * spreadRadius
    tintedEmitter.spawn(
      spawnX + Math.cos(spawnAngle) * offsetRadius,
      spawnY + rng.range(0, 0.4),
      spawnZ + Math.sin(spawnAngle) * offsetRadius,
      Math.cos(spawnAngle) * rng.range(0.3, 1.4),
      rng.range(0.4, 1.6),
      Math.sin(spawnAngle) * rng.range(0.3, 1.4),
      lifeSpan * rng.range(0.7, 1.2),
      sizeScale * rng.range(0.5, 0.8),
      sizeScale * rng.range(1.1, 1.7),
    )
  }
}

function emitRockChips(fxSystem, spawnX, spawnZ, requestedCount, burstSpeed, lifeSpan, spreadRadius = 0.3, smokeDark = VFX_COLORS.rock, tintAltColor = VFX_COLORS.dustDark, sizeInput = 0.3) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.debris).tint(smokeDark, tintAltColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      adjustedSpeed = burstSpeed * rng.range(0.3, 1),
      offsetRadius = spreadRadius * Math.sqrt(rng.next()),
      spriteSize = sizeInput * rng.range(0.5, 1.4)
    tintedEmitter.spawn(spawnX + Math.cos(spawnAngle) * offsetRadius, 0.2, spawnZ + Math.sin(spawnAngle) * offsetRadius, Math.cos(spawnAngle) * adjustedSpeed, lifeSpan * rng.range(0.5, 1.2), Math.sin(spawnAngle) * adjustedSpeed, rng.range(0.7, 1.2), spriteSize, spriteSize * 0.8)
  }
}

function emitShards(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, lifeSpan, tintPrimary, tintAltColor = tintPrimary, sizeInput = 0.26) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.shard).tint(tintPrimary, tintAltColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      adjustedSpeed = burstSpeed * rng.range(0.3, 1),
      spriteSize = sizeInput * rng.range(0.5, 1.3)
    tintedEmitter.spawn(spawnX, spawnY, spawnZ, Math.cos(spawnAngle) * adjustedSpeed, lifeSpan * rng.range(0.3, 1.2), Math.sin(spawnAngle) * adjustedSpeed, rng.range(0.6, 1.1), spriteSize, spriteSize * 0.5)
  }
}

function emitEmbers(fxSystem, spawnX, spawnY, spawnZ, requestedCount, spreadRadius, burstSpeed, emberHot = VFX_COLORS.spark, tintAltColor = VFX_COLORS.ember, lifeSpan = 1, spriteSize = 0.16) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.ember).tint(emberHot, tintAltColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      offsetRadius = Math.sqrt(rng.next()) * spreadRadius
    tintedEmitter.spawn(
      spawnX + Math.cos(spawnAngle) * offsetRadius,
      spawnY + rng.range(0, 0.5),
      spawnZ + Math.sin(spawnAngle) * offsetRadius,
      Math.cos(spawnAngle) * burstSpeed * rng.range(0.2, 1),
      burstSpeed * rng.range(0.4, 1.4),
      Math.sin(spawnAngle) * burstSpeed * rng.range(0.2, 1),
      lifeSpan * rng.range(0.5, 1.2),
      spriteSize * rng.range(0.6, 1.4),
      spriteSize * 0.3,
      rng.range(0, 0.15),
    )
  }
}

const HIT_FEEDBACK_TUNING = { flashBasic: 0.09, flashSkill: 0.14, flashBig: 0.2, chipLife: 0.25, chipCone: Math.PI / 3, shakeSkill: 0.12, shakeEpic: 0.4, lightMax: 8, lightDur: 0.35 },
  TEAM_RING_COLORS = { enemy: { edge: VFX_COLORS.red, under: VFX_COLORS.redDeep }, ally: { edge: VFX_COLORS.blue, under: VFX_COLORS.blueDeep }, mine: { edge: VFX_COLORS.green, under: VFX_COLORS.greenDeep }, monster: { edge: VFX_COLORS.amber, under: VFX_COLORS.violetDeep } }

/**
 * 发送碰撞。
 *
 * @param fxSystem - 来源
 * @param spawnX - 次要输入
 * @param spawnY - 第三输入
 * @param spawnZ - 第四输入
 * @param spriteSize - 附加输入
 * @param flashTintColor - 输入
 * @param chipTintColor - 输入
 * @param directionX - 附加输入
 * @param directionY - 附加输入
 * @param requestedCount - 附加输入
 * @param lifeSpan - 技能
 * @param burstSpeed - 附加输入
 */
function emitHitSparks(fxSystem, spawnX, spawnY, spawnZ, spriteSize, flashTintColor, chipTintColor, directionX, directionY, requestedCount, lifeSpan = HIT_FEEDBACK_TUNING.flashBasic, burstSpeed = 9) {
  fxSystem.particles
    .use(VFX_EMITTERS.hitFlash)
    .tint(VFX_COLORS.white, flashTintColor)
    .spawn(spawnX, spawnY, spawnZ, 0, 0, 0, lifeSpan, spriteSize * 0.7, spriteSize)
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.chip).tint(flashTintColor, chipTintColor),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount),
    baseAngle = directionX === 0 && directionY === 0 ? rng.next() * FX_TWO_PI : Math.atan2(directionY, directionX),
    coneHalfAngle = directionX === 0 && directionY === 0 ? Math.PI : HIT_FEEDBACK_TUNING.chipCone * 0.5
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = baseAngle + rng.signed() * coneHalfAngle,
      adjustedSpeed = burstSpeed * rng.range(0.55, 1.1)
    tintedEmitter.spawn(spawnX, spawnY, spawnZ, Math.cos(spawnAngle) * adjustedSpeed, rng.range(-0.2, 0.9) * adjustedSpeed * 0.45, Math.sin(spawnAngle) * adjustedSpeed, HIT_FEEDBACK_TUNING.chipLife * rng.range(0.6, 1.15), 0.13 * rng.range(0.7, 1.2), 0.04, lifeSpan * 0.4)
  }
}

/**
 * 发送地形。
 *
 * @param fxSystem - 来源
 * @param decalX - 次要输入
 * @param decalY - 第三输入
 * @param decalRadius - 第四输入
 * @param decalAngle - 附加输入
 * @param ringColor - 输入
 * @param ringIntensity - 附加输入
 * @param ringWidth - 附加输入
 * @param underOpacity - 附加输入
 * @param decalDelay - 附加输入
 */
function emitGroundImpact(fxSystem, decalX, decalY, decalRadius, decalAngle, ringColor, ringIntensity = 1.6, ringWidth = 0.15, underOpacity = 0.35, decalDelay = 0) {
  const underResult = fxSystem.decals
    .add(GROUND_FX_KINDS.ring, decalX, decalY, decalRadius, decalAngle)
    .params(ringWidth, 1)
    .color(ringColor, ringIntensity)
    .under(VFX_COLORS.shadow, Math.min(1, underOpacity * 1.8 + 0.1))
  decalDelay > 0 && underResult.delay(decalDelay)
}

function emitScorchDecal(fxSystem, decalX, decalY, decalRadius, decalAngle, scorchColor = VFX_COLORS.black, underColor = VFX_COLORS.shadow, underOpacity = 0.8) {
  fxSystem.decals.add(GROUND_FX_KINDS.scorch, decalX, decalY, decalRadius, decalAngle).color(scorchColor, 1.6).under(underColor, underOpacity)
}

function emitSphereGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY, spawnScale, glowColor, glowIntensity = 1.6, glowAlpha = 0.9) {
  return fxSystem.glow
    .spawn(FX_SHAPES.sphere, FX_STYLES.rim, spawnScale)
    .at(centerX, centerY, centerZ)
    .scale(scaleX, scaleY)
    .color(glowColor, glowIntensity * SPHERE_GLOW_INTENSITY_SCALE, glowAlpha)
    .fade(0.05, 0.25)
    .opt(0.3, 2.6, 1)
}

function emitSphereCoreGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY, spawnScale, glowColor, glowIntensity = 2, glowAlpha = 1) {
  return fxSystem.glow
    .spawn(FX_SHAPES.sphere, FX_STYLES.core, spawnScale)
    .at(centerX, centerY, centerZ)
    .scale(scaleX, scaleY)
    .color(glowColor, glowIntensity * SPHERE_CORE_INTENSITY_SCALE, glowAlpha)
    .fade(0.05, 0.2)
    .opt(0.5, 2.2, 1)
}

function emitPillarGlow(fxSystem, centerX, centerZ, pillarRadius, pillarHeight, spawnScale, glowColor, glowIntensity = 1.8, glowAlpha = 0.9, baseY = 0.05) {
  return fxSystem.glow
    .spawn(FX_SHAPES.pillar, FX_STYLES.pillar, spawnScale)
    .at(centerX, baseY, centerZ)
    .scale3(pillarRadius * 0.6, pillarHeight * 0.5, pillarRadius * 0.6, pillarRadius, pillarHeight, pillarRadius)
    .color(glowColor, glowIntensity * PILLAR_GLOW_INTENSITY_SCALE, glowAlpha)
    .fade(0.08, 0.35)
    .opt(0.25, 1.15, 1)
}

function emitHoopGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY, riseSpeed, spawnScale, glowColor, glowIntensity = 1.8, glowAlpha = 0.9) {
  return fxSystem.glow
    .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, spawnScale)
    .at(centerX, centerY, centerZ)
    .vel(0, riseSpeed, 0)
    .scale(scaleX, scaleY)
    .color(glowColor, glowIntensity * HOOP_GLOW_INTENSITY_SCALE, glowAlpha)
    .fade(0.1, 0.45)
    .opt(0.3, 2, 1)
}

const SLASH_K_NORMALIZER = 2.5

function emitSlashGlow(fxSystem, centerX, centerY, centerZ, tiltAngle, slashScale, spawnScale, glowColor, glowIntensity = 2.2, spinAngle = 0, normalizeProgress = !0, glowAlpha = 1) {
  const optResult = fxSystem.glow
    .spawn(FX_SHAPES.slash, FX_STYLES.slash, spawnScale)
    .at(centerX, centerY, centerZ)
    .scale(slashScale * 0.92, slashScale)
    .rot(spinAngle, -tiltAngle, 0)
    .color(glowColor, glowIntensity * FX_GLOW_INTENSITY_SCALE, glowAlpha)
    .fade(0.02, 0.5)
    .opt(0.2, 1, 1)
  return (normalizeProgress || (optResult.progress = -2), optResult)
}

function emitRockBarrage(fxSystem, centerX, centerZ, requestedCount, burstSpeed, launchSpeed, sizeInput, glowColor = VFX_COLORS.white) {
  const rng = fxSystem.rnd,
    rockCount = Math.max(1, Math.round(requestedCount * (0.5 + 0.5 * fxSystem.density)))
  for (let index = 0; index < rockCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      adjustedSpeed = burstSpeed * rng.range(0.4, 1),
      launchVelocity = launchSpeed * rng.range(0.6, 1.1),
      speedDivisor = 20,
      glowScale = (2 * launchVelocity) / speedDivisor,
      spriteSize = sizeInput * rng.range(0.5, 1.2),
      colorResult = fxSystem.glow
        .spawn(FX_SHAPES.rock, FX_STYLES.plain, glowScale)
        .at(centerX + Math.cos(spawnAngle) * 0.4, 0.1, centerZ + Math.sin(spawnAngle) * 0.4)
        .vel(Math.cos(spawnAngle) * adjustedSpeed, launchVelocity, Math.sin(spawnAngle) * adjustedSpeed, speedDivisor)
        .scale(spriteSize, spriteSize * 0.7)
        .color(glowColor, 1)
    ;((colorResult.ease = 3), colorResult.rot(rng.next() * 3, rng.next() * 6, rng.next() * 3).spin(rng.range(-7, 7), rng.range(-5, 5), rng.range(-7, 7)))
  }
}

function emitShieldGlow(fxSystem, centerX, centerY, centerZ, baseYaw, shieldScale, spawnScale, glowColor, glowIntensity = 1.6, glowAlpha = 0.9, decayRate = 0.16, yawOffset = 0, rollAngle = 0) {
  return fxSystem.glow
    .spawn(FX_SHAPES.shield, FX_STYLES.plate, spawnScale)
    .at(centerX, centerY, centerZ)
    .scale(shieldScale * 0.72, shieldScale)
    .rot(0, -(baseYaw + yawOffset), rollAngle)
    .color(glowColor, glowIntensity * FX_GLOW_INTENSITY_SCALE, glowAlpha)
    .fade(0.06, 0.45)
    .opt(0.25, decayRate, 2)
}

function emitTwinSlashGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, slashColor, altColor, glowK, baseAngle = 0, flipAngle = !1, glowIntensity = 2.3, slashCollector?, altIntensity = glowIntensity * 1.15) {
  const slashAngle = flipAngle ? baseAngle + Math.PI : baseAngle,
    fadeResult = emitSlashGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY, scaleZ, slashColor, glowIntensity, slashAngle, !1, 0.9).fade(0.2, 0.45)
  fadeResult.scale(scaleY * 0.85, scaleY).k = glowK / SLASH_K_NORMALIZER
  const fadedSlashGlow = emitSlashGlow(fxSystem, centerX, centerY, centerZ, scaleX, scaleY * 1.02, scaleZ * 0.55, altColor, altIntensity, slashAngle, !0).fade(0.02, 0.6)
  return ((fadedSlashGlow.scale(scaleY * 0.88, scaleY * 1.02).k = glowK / SLASH_K_NORMALIZER), slashCollector && slashCollector.push(fadeResult, fadedSlashGlow), fadeResult)
}

function emitRingDecal(fxSystem, decalX, decalY, decalRadius, decalAngle, ringColor, ringWidth = 3, ringIntensity = 1.6, invertParam = !1, paramValue = 0.16, decalDelay = 0) {
  const ringDecal = fxSystem.decals
    .add(GROUND_FX_KINDS.rings, decalX, decalY, decalRadius, decalAngle)
    .params(ringWidth, invertParam ? -paramValue : paramValue)
    .color(ringColor, ringIntensity)
    .under(VFX_COLORS.shadow, 0.3)
  decalDelay > 0 && ringDecal.delay(decalDelay)
}

function emitEarthChunks(fxSystem, spawnX, spawnZ, requestedCount, burstSpeed, lifeSpan, spreadRadius = 0.3, spriteSize = 0.3) {
  emitRockChips(fxSystem, spawnX, spawnZ, requestedCount, burstSpeed, lifeSpan, spreadRadius, VFX_COLORS.earth, VFX_COLORS.earthDark, spriteSize)
}

function emitSoftSparkBurst(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, tintPrimary, tintAltColor, directionX = 0, directionY = 0, directionMix = 0) {
  emitSparkBurst(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, tintPrimary, tintAltColor, directionX, directionY, directionMix, 0.28, 0.11)
}

function emitPlumeBurst(fxSystem, spawnX, spawnY, spawnZ, requestedCount, spreadRadius, directionX = 0, directionY = 0, spinAngle = 0) {
  const useResult = fxSystem.particles.use(VFX_EMITTERS.plume),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = rng.next() * FX_TWO_PI,
      offsetRadius = spreadRadius * rng.range(0.4, 1)
    useResult.spawn(spawnX, spawnY + rng.signed() * 0.3, spawnZ, Math.cos(spawnAngle) * offsetRadius + directionX, rng.range(0.6, 2.4), Math.sin(spawnAngle) * offsetRadius + directionY, rng.range(0.9, 1.4), 0.42, 0.34, spinAngle + rng.next() * 0.05)
  }
}

function emitGoosePlume(fxSystem, spawnX, spawnY, spawnZ, velocityX, velocityY, velocityZ, lifeSpan, spriteSize, shadeScale = 1, rotation = 0) {
  ;(fxSystem.particles.use(VFX_EMITTERS.gooseShade).spawn(spawnX, spawnY, spawnZ, velocityX, velocityY, velocityZ, lifeSpan, spriteSize * 1.1, spriteSize * 1.1 * shadeScale, rotation), fxSystem.particles.use(VFX_EMITTERS.goose).spawn(spawnX, spawnY, spawnZ, velocityX, velocityY, velocityZ, lifeSpan, spriteSize, spriteSize * shadeScale, rotation))
}

function emitGrassBurst(fxSystem, spawnX, spawnZ, requestedCount, spreadRadius, burstSpeed, lateralSpeed, liftSpeed = 2.2, spinAngle = 0) {
  const grassEmitter = fxSystem.particles.use(VFX_EMITTERS.grass),
    rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount)
  for (let index = 0; index < particleCount; index++) {
    const spriteSize = rng.range(0.16, 0.3)
    grassEmitter.spawn(
      spawnX + rng.signed() * spreadRadius,
      0.12,
      spawnZ + rng.signed() * spreadRadius,
      burstSpeed * rng.range(0.5, 1.1) + rng.signed() * 0.8,
      liftSpeed * rng.range(0.5, 1.2),
      lateralSpeed * rng.range(0.5, 1.1) + rng.signed() * 0.8,
      rng.range(0.4, 0.7),
      spriteSize,
      spriteSize * 0.8,
      spinAngle + rng.next() * 0.04,
    )
  }
}

function emitInkDotBurst(fxSystem, spawnX, spawnY, spawnZ, requestedCount, burstSpeed, directionX = 0, directionY = 0, coneAngle = Math.PI, rotation = 0, cinnabar = null) {
  const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.inkDot)
  cinnabar && tintedEmitter.tint(cinnabar)
  const rng = fxSystem.rnd,
    particleCount = fxSystem.n(requestedCount),
    baseAngle = directionX === 0 && directionY === 0 ? rng.next() * FX_TWO_PI : Math.atan2(directionY, directionX)
  for (let index = 0; index < particleCount; index++) {
    const spawnAngle = baseAngle + rng.signed() * coneAngle,
      adjustedSpeed = burstSpeed * rng.range(0.4, 1),
      spriteSize = rng.range(0.08, 0.2)
    tintedEmitter.spawn(spawnX, spawnY, spawnZ, Math.cos(spawnAngle) * adjustedSpeed, rng.range(0.2, 1) * adjustedSpeed * 0.5, Math.sin(spawnAngle) * adjustedSpeed, rng.range(0.35, 0.6), spriteSize, spriteSize * 0.7, rotation + rng.next() * 0.04)
  }
}

function emitInkBurst(fxSystem, spawnX, spawnY, spawnZ, spriteSize, emitFlat = !0, phase = 0) {
  ;(fxSystem.particles.use(VFX_EMITTERS.ink).spawn(spawnX, spawnY, spawnZ, 0, 0.4, 0, 0.42, spriteSize * 0.6, spriteSize, phase),
    emitFlat && fxSystem.particles.use(VFX_EMITTERS.inkFlat).spawn(spawnX + fxSystem.rnd.signed() * 0.2, 0.07, spawnZ + fxSystem.rnd.signed() * 0.2, 0, 0, 0, 1.1, spriteSize * 0.5, spriteSize * 0.9, phase + 0.03))
}

function emitInkStreakDecal(fxSystem, startX, startY, endX, endY, streakWidth, decalAngle, fadeParam = 0, streakColor = VFX_COLORS.black, sharpness = 0, underOpacity = 0.75) {
  const deltaX = endX - startX,
    deltaY = endY - startY,
    distance = Math.hypot(deltaX, deltaY) * 0.5 || 0.01
  fxSystem.decals
    .add(GROUND_FX_KINDS.ink, (startX + endX) * 0.5, (startY + endY) * 0.5, distance, decalAngle)
    .rot(Math.atan2(deltaY, deltaX), (streakWidth * 0.5) / distance)
    .params(fadeParam > 0 ? 1 / fadeParam : 0, sharpness)
    .color(streakColor, 1.6)
    .under(VFX_COLORS.ink, underOpacity)
}

const AIM_DIRECTION_COLOR = hexToColor(2799871),
  AIM_POSITION_COLOR = hexToColor(7330047),
  AIM_UNDER_COLOR = hexToColor(402490),
  AIM_CANCEL_COLOR = hexToColor(16730682),
  AIM_CANCEL_UNDER_COLOR = hexToColor(3803656),
  AIM_DECAL_Y_OFFSET = 0.1,
  AIM_DECAL_KIND_SLOTS = { direction: [-1, GROUND_FX_KINDS.rect, -1], cone: [-1, GROUND_FX_KINDS.cone, -1], position: [GROUND_FX_KINDS.range, GROUND_FX_KINDS.zone, GROUND_FX_KINDS.glow], target: [GROUND_FX_KINDS.range, -1, GROUND_FX_KINDS.lock], self: [-1, GROUND_FX_KINDS.zone, GROUND_FX_KINDS.glow] }

class AimIndicator {
  k
  aim = null
  kind = null
  slots = [-1, -1, -1]
  constructor(fxSystem) {
    this.k = fxSystem
  }
  set(targetObject) {
    this.aim = targetObject
  }
  release() {
    const decals = this.k.decals
    for (let index = 0; index < 3; index++) (this.slots[index] >= 0 && decals.release(this.slots[index], 0.1), (this.slots[index] = -1))
    this.kind = null
  }
  ensure(aimKind) {
    if (this.kind === aimKind) return
    ;(this.release(), (this.kind = aimKind))
    const selectedAIM_DECAL_KIND_SLOTS = AIM_DECAL_KIND_SLOTS[aimKind]
    for (let index = 0; index < 3; index++) selectedAIM_DECAL_KIND_SLOTS[index] >= 0 && (this.slots[index] = this.k.decals.hold(selectedAIM_DECAL_KIND_SLOTS[index], 0.08))
  }
  style(decalSlot, tintColor, underColor, glowIntensity, extraIntensity, underOpacity) {
    this.k.decals.at(decalSlot).y(AIM_DECAL_Y_OFFSET).color(tintColor, glowIntensity, extraIntensity).under(underColor, underOpacity).xray()
  }
  update(world) {
    const kindValue = this.k,
      aimState = this.aim,
      worldState = world.state
    if (!aimState || !kindValue.anchor(worldState.playerId) || !kindValue.a.unit || !kindValue.a.unit.alive) {
      this.kind && this.release()
      return
    }
    const coordX = kindValue.a.x,
      coordZ = kindValue.a.z
    this.ensure(aimState.kind)
    const decals = kindValue.decals,
      isCancelled = aimState.cancel === !0,
      directionColor = isCancelled ? AIM_CANCEL_COLOR : AIM_DIRECTION_COLOR,
      positionColor = isCancelled ? AIM_CANCEL_COLOR : AIM_POSITION_COLOR,
      underColor = isCancelled ? AIM_CANCEL_UNDER_COLOR : AIM_UNDER_COLOR,
      [rangeSlot, zoneSlot, targetSlot] = this.slots
    switch (aimState.kind) {
      case "direction": {
        const distance = Math.hypot(aimState.dir.x, aimState.dir.y) || 1,
          dirX = aimState.dir.x / distance,
          dirY = aimState.dir.y / distance,
          halfRange = aimState.range / 2
        ;(this.style(zoneSlot, directionColor, underColor, 1.25, 0.9, 0.55),
          decals
            .at(zoneSlot)
            .at(coordX + dirX * halfRange, coordZ + dirY * halfRange)
            .radius(halfRange)
            .rot(Math.atan2(dirY, dirX), Math.max(0.3, aimState.width / 2) / halfRange))
        break
      }
      case "cone": {
        ;(this.style(zoneSlot, directionColor, underColor, 1.25, 0.9, 0.55),
          decals
            .at(zoneSlot)
            .at(coordX, coordZ)
            .radius(aimState.range)
            .rot(Math.atan2(aimState.dir.y, aimState.dir.x))
            .params(aimState.angle / 2, 1))
        break
      }
      case "position": {
        let offsetX = aimState.pos.x - coordX,
          offsetY = aimState.pos.y - coordZ
        const offsetDistance = Math.hypot(offsetX, offsetY)
        ;(offsetDistance > aimState.range && offsetDistance > 0 && ((offsetX *= aimState.range / offsetDistance), (offsetY *= aimState.range / offsetDistance)),
          this.style(rangeSlot, directionColor, underColor, 1.1, 0.75, 0.35),
          decals.at(rangeSlot).at(coordX, coordZ).radius(aimState.range).params(0.008, 0),
          this.style(zoneSlot, positionColor, underColor, 1.25, 0.95, 0.5),
          decals
            .at(zoneSlot)
            .at(coordX + offsetX, coordZ + offsetY)
            .radius(Math.max(0.6, aimState.radius))
            .params(16, 0),
          this.style(targetSlot, directionColor, VFX_COLORS.black, 0.5, 0.8, 0),
          decals
            .at(targetSlot)
            .at(coordX + offsetX, coordZ + offsetY)
            .radius(Math.max(0.6, aimState.radius))
            .params(0.7))
        break
      }
      case "target": {
        ;(this.style(rangeSlot, directionColor, underColor, 1.3, 0.75, 0.35), decals.at(rangeSlot).at(coordX, coordZ).radius(aimState.range).params(0.008, 0))
        const targetHeight = kindValue.a.y + kindValue.a.height * 0.45
        kindValue.anchor(aimState.targetId) && kindValue.a.visible
          ? (this.style(targetSlot, positionColor, underColor, 1.4, 1, 0.5),
            decals
              .at(targetSlot)
              .at(kindValue.a.x, kindValue.a.z)
              .radius(kindValue.a.radius + 0.75),
            kindValue.ribbons.line(VFX_RIBBON_STYLES.link, coordX, targetHeight, coordZ, kindValue.a.x, kindValue.a.y + kindValue.a.height * 0.45, kindValue.a.z, directionColor, 1))
          : decals.at(targetSlot).alpha(0)
        break
      }
      case "self": {
        const effectRadius = aimState.radius > 0 ? aimState.radius : 1.4
        ;(this.style(zoneSlot, positionColor, underColor, 1.25, 0.95, 0.5),
          decals
            .at(zoneSlot)
            .at(coordX, coordZ)
            .radius(effectRadius)
            .params(aimState.radius > 0 ? 16 : 0, 0),
          this.style(targetSlot, directionColor, VFX_COLORS.black, 0.45, 0.8, 0),
          decals.at(targetSlot).at(coordX, coordZ).radius(effectRadius).params(0.6))
        break
      }
    }
  }
  reset() {
    ;((this.aim = null), this.release())
  }
}

const AREA_ALPHA_AGE_DIVISOR = 30,
  AREA_ALPHA_AGE_SCALE = 1 / AREA_ALPHA_AGE_DIVISOR,
  HOSTILE_ZONE_COLOR = hexToColor(16726568)

function holdZoneDecalSlot(fxSystem, zoneView, decalKind, fadeDuration = 0.12) {
  const heldDecalSlot = fxSystem.decals.hold(decalKind, fadeDuration)
  return (zoneView.slots.push(heldDecalSlot), heldDecalSlot)
}

function drawZoneDecal(fxSystem, zoneView, decalWidth, decalLength, underColor) {
  const teamColors = zoneView.hostile ? TEAM_RING_COLORS.enemy : zoneView.mine ? TEAM_RING_COLORS.mine : TEAM_RING_COLORS.ally,
    holdZoneDecalSlotResult = holdZoneDecalSlot(fxSystem, zoneView, GROUND_FX_KINDS.zone)
  return (
    fxSystem.decals
      .at(holdZoneDecalSlotResult)
      .params(decalWidth, decalLength)
      .color(zoneView.hostile ? HOSTILE_ZONE_COLOR : teamColors.edge, zoneView.hostile ? 1.7 : 1.4, zoneView.hostile ? 0.95 : 0.85)
      .under(underColor, 0.12),
    holdZoneDecalSlotResult
  )
}

function updateZoneDecalRadii(fxSystem, zoneView, radiusScale) {
  for (let index = 0; index < zoneView.slots.length; index++)
    fxSystem.decals
      .at(zoneView.slots[index])
      .at(zoneView.x, zoneView.z)
      .radius(zoneView.radius * (radiusScale ? radiusScale(index) : 1))
}

function consumeEmissionBudget(fxSystem, zoneView, deltaTime, emitRate) {
  zoneView.acc += deltaTime * emitRate * fxSystem.density
  const emissionCount = Math.floor(zoneView.acc)
  return ((zoneView.acc -= emissionCount), emissionCount)
}

const PANYUE_AREA_PALETTE = HERO_VFX_PALETTES.panyue,
  CHIJIN_VFX_PALETTE = HERO_VFX_PALETTES.chijin,
  XINGLI_AREA_PALETTE = HERO_VFX_PALETTES.xingli,
  FENGLING_VFX_PALETTE = HERO_VFX_PALETTES.fengling,
  AREA_SPARK_TINT_COLOR = hexToColor(16760928),
  AREA_GLOW_TINT_COLOR = hexToColor(15249520),
  VFX_TEMPLATE_TABLE = buildVfxTemplates({ _r: TEAM_RING_COLORS, Gd: holdZoneDecalSlot, GROUND_FX_KINDS, ad: drawZoneDecal, yc: PANYUE_AREA_PALETTE, FX_SHAPES, FX_STYLES, od: updateZoneDecalRadii, oe: FX_TWO_PI, xc: consumeEmissionBudget, VFX_EMITTERS, bn: emitGroundImpact, Ha: emitDustPuff, VFX_COLORS, rd: CHIJIN_VFX_PALETTE, EP: AREA_GLOW_TINT_COLOR, TP: AREA_SPARK_TINT_COLOR, Zr: XINGLI_AREA_PALETTE, PARTICLE_KIND, B1: emitGoosePlume, Ku: FENGLING_VFX_PALETTE })

class AreaEffectView {
  views = new Map()
  list = []
  k
  stamp = 0
  phaseN = 0
  constructor(fxSystem) {
    this.k = fxSystem
  }
  release(decalView, isExpired) {
    const kValue = this.k
    isExpired && decalView.def.end && decalView.def.end(kValue, decalView)
    for (const slot of decalView.slots) kValue.decals.release(slot, 0.2)
    for (const glowMesh of decalView.meshes) kValue.glow.release(glowMesh)
    ;((decalView.slots.length = 0), (decalView.meshes.length = 0))
  }
  update(world) {
    const kindResult = this.k,
      stamp = ++this.stamp
    for (const area of world.state.areas) {
      let Result = this.views.get(area.id)
      ;(Result || ((Result = this.make(area, world)), this.views.set(area.id, Result), this.list.push(Result), Result.def.create(kindResult, Result)), (Result.seen = stamp), this.sync(Result, area, world), Result.def.update(kindResult, Result, world.dt))
    }
    const listState = this.list
    for (let index = listState.length - 1; index >= 0; index--) {
      const selectedI = listState[index]
      selectedI.seen !== stamp && (this.release(selectedI, selectedI.age >= selectedI.duration - 0.12), this.views.delete(selectedI.id), (listState[index] = listState[listState.length - 1]), listState.pop())
    }
  }
  make(unitState, worldState) {
    return (
      (this.phaseN = (this.phaseN + 2.399) % FX_TWO_PI),
      {
        id: unitState.id,
        def: VFX_TEMPLATE_TABLE[unitState.visual] ?? VFX_TEMPLATE_TABLE.fountain_zone,
        seen: 0,
        x: unitState.pos.x,
        z: unitState.pos.y,
        radius: unitState.radius,
        team: unitState.team,
        ownerId: unitState.ownerId,
        hostile: unitState.team !== worldState.playerTeam,
        mine: unitState.ownerId === worldState.state.playerId,
        age: unitState.age,
        t: 0,
        duration: unitState.duration,
        slots: [],
        edge: -1,
        meshes: [],
        acc: 0,
        phase: this.phaseN,
      }
    )
  }
  sync(viewState, unitState, deltaTime) {
    const fxSystem = this.k
    ;((viewState.radius = unitState.radius),
      (viewState.duration = unitState.duration),
      (viewState.age = Math.max(0, unitState.age - (1 - deltaTime.alpha) * AREA_ALPHA_AGE_SCALE)),
      (viewState.t = unitState.duration > 0 ? Math.min(1, viewState.age / unitState.duration) : 1),
      unitState.followUnitId >= 0 && fxSystem.anchor(unitState.followUnitId) ? ((viewState.x = fxSystem.a.x), (viewState.z = fxSystem.a.z)) : ((viewState.x = unitState.pos.x), (viewState.z = unitState.pos.y)))
  }
  get count() {
    return this.views.size
  }
  reset() {
    for (const decalView of this.list) this.release(decalView, !1)
    ;((this.list.length = 0), this.views.clear())
  }
}

const HIT_EVENT_LOG_BY_SYSTEM = new WeakMap()

/**
 * 处理事件与碰撞。
 *
 * @param lookupKey - 查找键
 * @param eventType - 次要输入
 * @param hitX - 第三输入
 * @param hitY - 第四输入
 * @param hitZ - 附加输入
 */
function recordHitEvent(lookupKey, eventType, hitX, hitY, hitZ) {
  let hitLog = HIT_EVENT_LOG_BY_SYSTEM.get(lookupKey)
  hitLog || ((hitLog = []), HIT_EVENT_LOG_BY_SYSTEM.set(lookupKey, hitLog))
  for (let index = hitLog.length - 1; index >= 0; index--) lookupKey.now - hitLog[index].t > 2 && hitLog.splice(index, 1)
  hitLog.push({ type: eventType, x: hitX, y: hitY, z: hitZ, t: lookupKey.now })
}

/**
 * 查找事件与碰撞。
 *
 * @param lookupKey - 查找键
 * @param hitX - 输入
 * @param hitZ - 第三输入
 * @param eventType - 第四输入
 */
function findRecentHitEvent(lookupKey, hitX, hitZ, eventType) {
  const hitLog = HIT_EVENT_LOG_BY_SYSTEM.get(lookupKey)
  if (!hitLog) return null
  for (let index = hitLog.length - 1; index >= 0; index--) {
    const hitEvent = hitLog[index]
    if (!(lookupKey.now - hitEvent.t > 1 || (eventType && hitEvent.type !== eventType)) && Math.hypot(hitEvent.x - hitX, hitEvent.z - hitZ) < 14) return hitEvent
  }
  return null
}

const FX_ANCHOR_SCRATCH_POSITION = new Vector3(),
  BREATH_WARN_UNDER_COLOR = new Color(8405247),
  FX_HIT_SCRATCH_POSITION = new Vector3()

/**
 * 处理坐标。
 *
 * @param fxSystem - 输入
 * @param unitId - 次要输入
 * @param dirX - 第三输入
 * @param dirZ - 第四输入
 * @param outPosition - 附加输入
 */
function resolveAttachPoint(fxSystem, unitId, dirX, dirZ, outPosition) {
  return fxSystem.anchors.attach?.(unitId, "vent", outPosition) || fxSystem.anchors.attach?.(unitId, "muzzle", outPosition)
    ? !0
    : fxSystem.anchor(unitId)
      ? (outPosition.set(fxSystem.a.x + dirX * (fxSystem.a.radius * 1.3 + 0.6), fxSystem.a.y + fxSystem.a.height * 0.5, fxSystem.a.z + dirZ * (fxSystem.a.radius * 1.3 + 0.6)), !0)
      : !1
}

const showDrakeBreathWarning = (fxSystem, breathConfig) => {
    const breathDirection = breathConfig.dir ?? { x: 1, y: 0 },
      distance = Math.hypot(breathDirection.x, breathDirection.y) || 1,
      dirX = breathDirection.x / distance,
      dirY = breathDirection.y / distance,
      coneRadius = breathConfig.radius ?? 7.5,
      halfAngle = (breathConfig.angle ?? Math.PI / 3) * 0.5,
      duration = Math.max(0.2, breathConfig.value ?? 0.9),
      rotationAngle = Math.atan2(dirY, dirX),
      unitId = breathConfig.unitId ?? -1
    if (unitId < 0 || !fxSystem.anchor(unitId)) {
      fxSystem.decals
        .add(GROUND_FX_KINDS.coneWarn, breathConfig.pos.x, breathConfig.pos.y, coneRadius, duration + 0.12)
        .y(0.09)
        .rot(rotationAngle)
        .params(halfAngle, -1)
        .color(TEAM_RING_COLORS.monster.edge, 1.6, 0.95)
        .under(BREATH_WARN_UNDER_COLOR, 0.7)
        .xray()
      return
    }
    const heldConeDecal = fxSystem.decals.hold(GROUND_FX_KINDS.coneWarn, 0.06)
    ;(fxSystem.decals.at(heldConeDecal).at(breathConfig.pos.x, breathConfig.pos.y).radius(coneRadius).y(0.09).rot(rotationAngle).params(halfAngle, 0).color(TEAM_RING_COLORS.monster.edge, 1.6, 0.95).under(BREATH_WARN_UNDER_COLOR, 0.7).xray(),
      fxSystem.track(
        unitId,
        duration + 0.12,
        (trackProgress, beamValue) => {
          fxSystem.decals.at(heldConeDecal).params(halfAngle, beamValue)
        },
        () => fxSystem.decals.release(heldConeDecal, 0.12),
      ))
    const warnGlow = fxSystem.glow.hold(FX_SHAPES.sphere, FX_STYLES.core)
    ;(warnGlow.color(VFX_COLORS.violetHot, 1.25, 0), (warnGlow.add = 0.55), (warnGlow.k = 1.4))
    let total = 0
    fxSystem.track(
      unitId,
      duration,
      (trackProgress, breathProgress, deltaTime) => {
        if (!resolveAttachPoint(fxSystem, unitId, dirX, dirY, FX_ANCHOR_SCRATCH_POSITION)) return
        const glowScale = 0.12 + 0.36 * breathProgress * breathProgress
        ;(warnGlow.at(FX_ANCHOR_SCRATCH_POSITION.x, FX_ANCHOR_SCRATCH_POSITION.y, FX_ANCHOR_SCRATCH_POSITION.z).scale(glowScale), (warnGlow.a = 0.25 + 0.5 * breathProgress), (total += deltaTime * (14 + 30 * breathProgress) * fxSystem.density))
        const tintedEmitter = fxSystem.particles.use(VFX_EMITTERS.glint).tint(VFX_COLORS.violetHot, VFX_COLORS.abyssCyan)
        for (; total >= 1;) ((total -= 1), tintedEmitter.orbit(FX_ANCHOR_SCRATCH_POSITION.x, FX_ANCHOR_SCRATCH_POSITION.y + fxSystem.rnd.range(-0.6, 0.4), FX_ANCHOR_SCRATCH_POSITION.z, fxSystem.rnd.range(1.4, 2.2), 0.05, fxSystem.rnd.next() * FX_TWO_PI, fxSystem.rnd.range(3, 6), fxSystem.rnd.range(-0.2, 0.6), 0.35, 0.26, 0.08))
      },
      () => fxSystem.glow.release(warnGlow),
    )
  },
  BREATH_END_TIME_BY_SYSTEM = new WeakMap(),
  emitDrakeBreath = (lookupKey, breathConfig, breathOption) => {
    const dirVector = breathConfig.dir ?? { x: 1, y: 0 },
      distance = Math.hypot(dirVector.x, dirVector.y) || 1,
      dirX = dirVector.x / distance,
      dirY = dirVector.y / distance,
      coneRadius = breathConfig.radius ?? 7.5,
      halfAngle = (breathConfig.angle ?? Math.PI / 3) * 0.5,
      duration = Math.max(0.2, breathConfig.value ?? 0.8),
      unitId = breathConfig.unitId ?? -1,
      xValue = breathConfig.pos.x,
      coordY = breathConfig.pos.y
    let endTimeMap = BREATH_END_TIME_BY_SYSTEM.get(lookupKey)
    ;(endTimeMap || ((endTimeMap = new Map()), BREATH_END_TIME_BY_SYSTEM.set(lookupKey, endTimeMap)), endTimeMap.set(unitId, lookupKey.now + duration + 0.15))
    const atan2Atan2Result = Math.atan2(dirY, dirX),
      breathGlow = lookupKey.glow.hold(FX_SHAPES.breath, FX_STYLES.breath)
    ;(breathGlow.color(VFX_COLORS.violet, 1.05, 0), (breathGlow.add = 0.4), (breathGlow.k = 2.6), (breathGlow.progress = 0))
    const totalDuration = duration + 0.25
    let total = 0,
      scorchBudget = 0,
      streakBudget = 0
    const rng = lookupKey.rnd,
      emitBreathStep = (progress, shoulderX) => {
        const elapsedTime = progress * totalDuration,
          beamAngle = atan2Atan2Result + (-0.17 + 0.34 * Math.min(1, elapsedTime / duration)),
          beamDirectionX = Math.cos(beamAngle),
          beamDirectionZ = Math.sin(beamAngle)
        resolveAttachPoint(lookupKey, unitId, beamDirectionX, beamDirectionZ, FX_ANCHOR_SCRATCH_POSITION) || FX_ANCHOR_SCRATCH_POSITION.set(xValue + beamDirectionX * 2, 2.2, coordY + beamDirectionZ * 2)
        const projectedDistance = (FX_ANCHOR_SCRATCH_POSITION.x - xValue) * beamDirectionX + (FX_ANCHOR_SCRATCH_POSITION.z - coordY) * beamDirectionZ,
          beamLength = Math.max(3, coneRadius - projectedDistance + 0.4),
          beamWidth = Math.tan(halfAngle) * coneRadius * 0.92,
          pitchAngle = -Math.atan2(Math.max(0, FX_ANCHOR_SCRATCH_POSITION.y - 0.9), beamLength),
          beamGrowth = Math.min(1, elapsedTime / 0.12)
        if (
          (breathGlow
            .at(FX_ANCHOR_SCRATCH_POSITION.x, FX_ANCHOR_SCRATCH_POSITION.y, FX_ANCHOR_SCRATCH_POSITION.z)
            .scale3(beamLength * (0.35 + 0.65 * beamGrowth), beamWidth * 0.36 * beamGrowth, beamWidth * beamGrowth)
            .rot(0, -beamAngle, pitchAngle),
          (breathGlow.a = Math.min(1, elapsedTime / 0.08) * 0.6),
          (breathGlow.progress = elapsedTime > duration ? Math.min(1, (elapsedTime - duration) / 0.25) : 0),
          !(elapsedTime > duration))
        ) {
          for (
            lookupKey.sprites.draw(PARTICLE_KIND.glow, FX_ANCHOR_SCRATCH_POSITION.x, FX_ANCHOR_SCRATCH_POSITION.y, FX_ANCHOR_SCRATCH_POSITION.z, 1.15 * beamGrowth, 0, VFX_COLORS.abyssCyan, 1.2, 0.75, 0.6),
              lookupKey.sprites.draw(PARTICLE_KIND.glow, FX_ANCHOR_SCRATCH_POSITION.x + beamDirectionX * 0.25, FX_ANCHOR_SCRATCH_POSITION.y - 0.05, FX_ANCHOR_SCRATCH_POSITION.z + beamDirectionZ * 0.25, 0.55 * beamGrowth, 0, VFX_COLORS.violetHot, 2.6, 1, 0.85),
              total += shoulderX * 40 * lookupKey.density;
            total >= 1;
          ) {
            total -= 1
            const particleAngle = beamAngle + rng.signed() * halfAngle * 0.85,
              particleSpeed = rng.range(7, 12),
              particleCos = Math.cos(particleAngle),
              particleSin = Math.sin(particleAngle)
            rng.chance(0.42)
              ? lookupKey.particles.use(VFX_EMITTERS.puff).spawn(FX_ANCHOR_SCRATCH_POSITION.x + particleCos * 0.4, FX_ANCHOR_SCRATCH_POSITION.y - 0.1, FX_ANCHOR_SCRATCH_POSITION.z + particleSin * 0.4, particleCos * particleSpeed, -rng.range(1.2, 2.4), particleSin * particleSpeed, rng.range(0.5, 0.75), 0.8, rng.range(2.2, 3.2))
              : lookupKey.particles
                  .use(VFX_EMITTERS.streak)
                  .tint(VFX_COLORS.violetHot, VFX_COLORS.abyssCyan)
                  .spawn(FX_ANCHOR_SCRATCH_POSITION.x, FX_ANCHOR_SCRATCH_POSITION.y, FX_ANCHOR_SCRATCH_POSITION.z, particleCos * particleSpeed * 1.7, -rng.range(1, 3), particleSin * particleSpeed * 1.7, rng.range(0.26, 0.42), 0.24, 0.07)
          }
          for (streakBudget += shoulderX * 10; streakBudget >= 1;) {
            streakBudget -= 1
            const streakAngle = beamAngle + rng.signed() * halfAngle * 0.7,
              streakStart = projectedDistance + 1,
              streakLength = (coneRadius - streakStart) * rng.range(0.4, 0.62),
              streakDistance = streakStart + streakLength * 0.5 + rng.next() * Math.max(0, coneRadius - streakStart - streakLength)
            lookupKey.decals
              .add(GROUND_FX_KINDS.streak, xValue + Math.cos(streakAngle) * streakDistance, coordY + Math.sin(streakAngle) * streakDistance, streakLength * 0.5, 0.34)
              .rot(streakAngle, 0.1)
              .params(0.6, 3.2)
              .color(VFX_COLORS.violetHot, 1.45, 0.8)
              .under(VFX_COLORS.violetDeep, 0.18)
          }
          for (scorchBudget += shoulderX * 16; scorchBudget >= 1;) {
            scorchBudget -= 1
            const scorchAngle = beamAngle + rng.signed() * halfAngle * 0.8,
              scorchDistance = rng.range(projectedDistance + 1.2, coneRadius * 0.95)
            lookupKey.decals
              .add(GROUND_FX_KINDS.scorch, xValue + Math.cos(scorchAngle) * scorchDistance, coordY + Math.sin(scorchAngle) * scorchDistance, rng.range(0.9, 1.5), 1.5 + (duration - elapsedTime))
              .params(1)
              .color(VFX_COLORS.abyssCyan, 1.4)
              .under(VFX_COLORS.violetDeep, 0.8)
          }
        }
      }
    if (unitId >= 0 && lookupKey.anchor(unitId))
      lookupKey.track(
        unitId,
        totalDuration,
        (trackProgress, progress, deltaTime) => emitBreathStep(progress, deltaTime),
        () => lookupKey.glow.release(breathGlow),
      )
    else {
      lookupKey.glow.release(breathGlow)
      return
    }
    ;(resolveAttachPoint(lookupKey, unitId, dirX, dirY, FX_HIT_SCRATCH_POSITION) && (emitHitSparks(lookupKey, FX_HIT_SCRATCH_POSITION.x, FX_HIT_SCRATCH_POSITION.y, FX_HIT_SCRATCH_POSITION.z, 1.8, VFX_COLORS.violetHot, VFX_COLORS.violet, dirX, dirY, 6, HIT_FEEDBACK_TUNING.flashSkill, 9), lookupKey.light(FX_HIT_SCRATCH_POSITION.x, FX_HIT_SCRATCH_POSITION.z, FX_HIT_SCRATCH_POSITION.y, VFX_COLORS.violet, 2.2, 5.5, HIT_FEEDBACK_TUNING.lightDur)), lookupKey.shake(0.12, xValue, coordY))
  }

function emitDrakeBreathAftermath(lookupKey, lookupOption, unitId) {
  const breathEndTime = BREATH_END_TIME_BY_SYSTEM.get(lookupKey)?.get(lookupOption)
  if (breathEndTime === void 0 || lookupKey.now > breathEndTime || !lookupKey.anchor(unitId)) return
  const centerX = lookupKey.a.x,
    zValue = lookupKey.a.z,
    centerY = lookupKey.a.y + lookupKey.a.height * 0.5,
    rng = lookupKey.rnd,
    tintedEmitter = lookupKey.particles.use(VFX_EMITTERS.puff)
  for (let index = 0; index < lookupKey.n(3); index++) tintedEmitter.spawn(centerX + rng.signed() * 0.3, centerY + rng.signed() * 0.3, zValue + rng.signed() * 0.3, rng.signed() * 1.6, rng.range(0.4, 1.4), rng.signed() * 1.6, rng.range(0.45, 0.65), 0.7, 1.7)
  ;(emitGlint(lookupKey, centerX, centerY, zValue, 3, 2.5, VFX_COLORS.violetHot, VFX_COLORS.violet, 0.4, 0.26), lookupKey.anchors.flashTint?.(unitId, VFX_COLORS.violet, 0.5, 0.3))
}

export { VFX_RIBBON_STYLES, AimIndicator, AreaEffectView, emitGoosePlume, findRecentHitEvent, emitRockChips, emitSparkBurst, HIT_FEEDBACK_TUNING, emitDustPuff, emitSphereGlow, emitDrakeBreath, emitInkStreakDecal, emitFlashBurst, showDrakeBreathWarning, emitPillarGlow, emitPlumeBurst, emitDustTrail, FX_ANCHOR_SCRATCH_POSITION, emitSoftSparkBurst, emitEarthChunks, emitDrakeBreathAftermath, VFX_TEMPLATE_TABLE, emitTwinSlashGlow, recordHitEvent, emitInkDotBurst, emitInkBurst, TrailBuilder, emitShards, SLASH_K_NORMALIZER, VFX_EMITTERS, emitGroundImpact, emitRingDecal, emitSphereCoreGlow, emitEmbers, emitGlint, emitGrassBurst, emitSlashGlow, emitHitSparks, emitShieldGlow, emitHoopGlow, AREA_ALPHA_AGE_SCALE, emitScorchDecal, emitRockBarrage }
