/**
 * 模型构建器：矩阵组合、材质预设、地形配色、程序化网格构建（ModelBuilder）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Quaternion, ShapeUtils, Uint16BufferAttribute, Uint32BufferAttribute, Vector2, Vector3 } from 'three'

type ColorLike = string | number | number[] | Color

interface PaintOptions {
  c2?: ColorLike
  gloss?: number
  glow?: number
  glow2?: number
  team?: number
  ao?: number
  ao2?: number
  line?: number
  mat?: number
  pattern?: number
  patternScale?: number
  patternAmt?: number
  by?: (x: number, y: number, z: number, gradient: number, nx: number, ny: number, nz: number) => number
  grain?: number
}

interface LimbSpec {
  seg?: number
  power?: number
  phase?: number
  shape?: (angle: number, index: number) => number
  cap0?: boolean
  cap1?: boolean
  crease?: number
  closed?: boolean
  up?: number[]
}

interface LimbOptions extends LimbSpec {
  bulge?: number
  flat?: number
}

interface TorusOptions {
  y?: number
  power?: number
  phase?: number
  crease?: number
}

interface TaperedTubeJoints {
  n?: number
  curl?: number[]
  tip?: number
  flat?: number
  seg?: number
  up?: number[]
}

function applyBreathingPose(rig, coordY, coordZ, phaseOffset, amplitudeScale = 1) {
  const jointSpec = rig.J,
    breathWave = Math.sin(coordZ * 2.1 + phaseOffset * 6.28)
  return (
    coordY.add(jointSpec.chest, breathWave * 1.4 * amplitudeScale, 0, 0),
    coordY.add(jointSpec.spine, breathWave * 0.6 * amplitudeScale, 0, 0),
    coordY.move(jointSpec.hips, 0, breathWave * 0.006 * amplitudeScale, 0),
    coordY.add(jointSpec.head, -breathWave * 0.8 * amplitudeScale, Math.sin(coordZ * 0.7 + phaseOffset * 9) * 3 * amplitudeScale, 0),
    coordY.add(jointSpec.armL, 0, 0, breathWave * 1.2 * amplitudeScale),
    coordY.add(jointSpec.armR, 0, 0, -breathWave * 1.2 * amplitudeScale),
    breathWave
  )
}

const DEGREES_TO_RAD = Math.PI / 180,
  scratchColor = new Color()

function toRgbChannels(lookupKey: ColorLike): number[] {
  return Array.isArray(lookupKey) ? lookupKey : (scratchColor.set(lookupKey), [scratchColor.r, scratchColor.g, scratchColor.b])
}

function scaleRgbChannels(stoneDark, scaleFactor) {
  const toRgbChannelsResult = toRgbChannels(stoneDark)
  return [toRgbChannelsResult[0] * scaleFactor, toRgbChannelsResult[1] * scaleFactor, toRgbChannelsResult[2] * scaleFactor]
}

const clampUnit = (rawValue) => (rawValue < 0 ? 0 : rawValue > 1 ? 1 : rawValue),
  lerpValue = (rAnkle, primary, secondary) => rAnkle + (primary - rAnkle) * secondary,
  smoothStep01 = (coordX, coordY, coordZ) => {
    const clamped = clampUnit((coordZ - coordX) / (coordY - coordX))
    return clamped * clamped * (3 - 2 * clamped)
  }

function composeMatrix(shoulderX = 0, handY = 0, coordX = 0, coordY = 0, coordZ = 0, rotationZ = 0, scaleX = 1, scaleY = scaleX, scaleZ = scaleX) {
  const composedMatrix = new Matrix4(),
    setFromEulerResult = new Quaternion().setFromEuler(new Euler(coordY * DEGREES_TO_RAD, coordZ * DEGREES_TO_RAD, rotationZ * DEGREES_TO_RAD, "YXZ"))
  return composedMatrix.compose(new Vector3(shoulderX, handY, coordX), setFromEulerResult, new Vector3(scaleX, scaleY, scaleZ))
}

const MATERIAL_KINDS = { cloth: 0, skin: 1, leather: 2, metal: 3, crystal: 4, fur: 5, rock: 6 },
  TERRAIN_LOOK = { scale: 1, strata: 2, fur: 3, weave: 4, bark: 5, lava: 6, vein: 7, meteor: 8 },
  modelVariantCache = new Map()

function buildVariant(lookupKey) {
  let Value = modelVariantCache.get(lookupKey)
  if (Value) return Value
  const sum = (1 + Math.sqrt(5)) / 2,
    entries = [-1, sum, 0, 1, sum, 0, -1, -sum, 0, 1, -sum, 0, 0, -1, sum, 0, 1, sum, 0, -1, -sum, 0, 1, -sum, sum, 0, -1, sum, 0, 1, -sum, 0, -1, -sum, 0, 1]
  for (let total = 0; total < entries.length; total += 3) {
    const distance = Math.hypot(entries[total], entries[total + 1], entries[total + 2])
    ;((entries[total] /= distance), (entries[total + 1] /= distance), (entries[total + 2] /= distance))
  }
  let entriesX = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1]
  for (let subdivisionStep = 0; subdivisionStep < lookupKey; subdivisionStep++) {
    const midpointCache = new Map(),
      sumX = (missing, secondVertexIndex) => {
        const lookupKey = missing < secondVertexIndex ? missing * 65536 + secondVertexIndex : secondVertexIndex * 65536 + missing
        let getValue = midpointCache.get(lookupKey)
        if (getValue === void 0) {
          const sum = entries[missing * 3] + entries[secondVertexIndex * 3],
            sumX = entries[missing * 3 + 1] + entries[secondVertexIndex * 3 + 1],
            sumY = entries[missing * 3 + 2] + entries[secondVertexIndex * 3 + 2],
            distance = Math.hypot(sum, sumX, sumY)
          ;((getValue = entries.length / 3), entries.push(sum / distance, sumX / distance, sumY / distance), midpointCache.set(lookupKey, getValue))
        }
        return getValue
      },
      entriesY = []
    for (let faceOffset = 0; faceOffset < entriesX.length; faceOffset += 3) {
      const selectedI = entriesX[faceOffset],
        element = entriesX[faceOffset + 1],
        elementX = entriesX[faceOffset + 2],
        rResult = sumX(selectedI, element),
        rRResult = sumX(element, elementX),
        thirdMidpoint = sumX(elementX, selectedI)
      entriesY.push(selectedI, rResult, thirdMidpoint, element, rRResult, rResult, elementX, thirdMidpoint, rRResult, rResult, rRResult, thirdMidpoint)
    }
    entriesX = entriesY
  }
  return ((Value = { v: entries, t: entriesX }), modelVariantCache.set(lookupKey, Value), Value)
}

const cosineEasePow = (primary, secondary) => {
    const easedCosine = Math.cos(primary)
    return secondary === 2 ? easedCosine : Math.sign(easedCosine) * Math.pow(Math.abs(easedCosine), 2 / secondary)
  },
  sineEasePow = (primary, secondary) => {
    const easedSine = Math.sin(primary)
    return secondary === 2 ? easedSine : Math.sign(easedSine) * Math.pow(Math.abs(easedSine), 2 / secondary)
  }

function hashUnitRandom(coordX, coordY, coordZ, hashSalt) {
  let sum = (Math.imul(coordX, 374761393) + Math.imul(coordY, 668265263) + Math.imul(coordZ, 2147483647) + Math.imul(hashSalt, 1274126177)) | 0
  return ((sum = Math.imul(sum ^ (sum >>> 13), 1274126177)), (sum ^= sum >>> 16), (sum >>> 0) / 4294967296)
}

/**
 * 获取距离。
 *
 * @param geometry - 输入
 * @param lookupOption - 输入
 * @returns 数值结果
 */
function getLodDistance(geometry, lookupOption) {
  const lodConfig = geometry.userData.lod
  if (!lodConfig) return 1 / 0
  if (lookupOption <= 0) return lodConfig.outlined
  let computed = 0,
    lengthValue = lodConfig.sizes.length
  for (; computed < lengthValue;) {
    const midpointIndex = (computed + lengthValue) >> 1
    lodConfig.sizes[midpointIndex] >= lookupOption ? (computed = midpointIndex + 1) : (lengthValue = midpointIndex)
  }
  return computed > 0 ? lodConfig.ends[computed - 1] : 0
}

class ModelBuilder {
  pos = []
  nor = []
  col = []
  fx = []
  skin = []
  line = []
  mat = []
  idx = []
  crease = 40
  rough = 0
  c = [1, 1, 1]
  c2 = null
  gloss = 0
  glow = 0
  glow2 = -1
  team = 0
  ao = 1
  ao2 = -1
  lineW = 1
  matX = 0
  matY = 0
  matZ = 0
  matW = 0
  by = null
  grain = 0
  boneId = 0
  soft = null
  m = new Matrix4()
  stack = []
  prims = []
  get vertexCount() {
    return this.pos.length / 3
  }
  get triangleCount() {
    return this.idx.length / 3
  }
  paint(brass, unit: PaintOptions = {}) {
    ;((this.c = toRgbChannels(brass)),
      (this.c2 = unit.c2 !== void 0 ? toRgbChannels(unit.c2) : null),
      (this.gloss = unit.gloss ?? 0),
      (this.glow = unit.glow ?? 0),
      (this.glow2 = unit.glow2 ?? -1),
      (this.team = unit.team ?? 0),
      (this.ao = unit.ao ?? 1),
      (this.ao2 = unit.ao2 ?? -1),
      (this.lineW = unit.line ?? (this.glow > 0.5 ? 0 : 1)))
    const computed = unit.mat ?? (this.gloss >= 0.75 ? (this.glow > 0.05 ? MATERIAL_KINDS.crystal : MATERIAL_KINDS.metal) : this.gloss >= 0.3 ? MATERIAL_KINDS.leather : MATERIAL_KINDS.cloth),
      computedX = unit.pattern ?? 0
    return (
      (this.matX = computedX / 8),
      (this.matY = computedX > 0 ? clampUnit((unit.patternScale ?? 4) / 32) : 0),
      (this.matZ = computedX > 0 ? clampUnit(unit.patternAmt ?? 0.5) : 0),
      (this.matW = computed / 8),
      (this.by = unit.by ?? null),
      (this.grain = unit.grain ?? 0),
      this
    )
  }
  bone(jointId) {
    return ((this.boneId = jointId), (this.soft = null), this)
  }
  bind(skinBinder) {
    return ((this.soft = skinBinder), this)
  }
  g(primary, secondary) {
    return (this.stack.push(this.m.clone()), this.m.multiply(primary), secondary(), this.m.copy(this.stack.pop()), this)
  }
  sym(drawSide) {
    return (drawSide(1), this.g(new Matrix4().makeScale(-1, 1, 1), () => drawSide(-1)), this)
  }
  emit(entries, colors, coordY = null, coordZ = this.crease) {
    const ratio = entries.length / 3,
      startIndex = this.idx.length,
      samples = this.m.elements,
      computed = this.m.determinant() < 0,
      float32Array = new Float32Array(entries.length)
    for (let index = 0; index < ratio; index++) {
      const element = entries[index * 3],
        elementX = entries[index * 3 + 1],
        elementY = entries[index * 3 + 2]
      if (((float32Array[index * 3] = samples[0] * element + samples[4] * elementX + samples[8] * elementY + samples[12]), (float32Array[index * 3 + 1] = samples[1] * element + samples[5] * elementX + samples[9] * elementY + samples[13]), (float32Array[index * 3 + 2] = samples[2] * element + samples[6] * elementX + samples[10] * elementY + samples[14]), this.rough > 0)) {
        const hashSeedX = Math.round(float32Array[index * 3] * 400),
          hashSeedY = Math.round(float32Array[index * 3 + 1] * 400),
          total = Math.round(float32Array[index * 3 + 2] * 400)
        ;((float32Array[index * 3] += (hashUnitRandom(hashSeedX, hashSeedY, total, 1) - 0.5) * 2 * this.rough), (float32Array[index * 3 + 1] += (hashUnitRandom(hashSeedX, hashSeedY, total, 2) - 0.5) * 2 * this.rough), (float32Array[index * 3 + 2] += (hashUnitRandom(hashSeedX, hashSeedY, total, 3) - 0.5) * 2 * this.rough))
      }
    }
    const ratioX = colors.length / 3,
      int32Array = new Int32Array(colors.length),
      samplesX = new Float32Array(colors.length),
      samplesY = new Float32Array(colors.length),
      uint8Array = new Uint8Array(ratioX)
    for (let triangleIndex = 0; triangleIndex < ratioX; triangleIndex++) {
      const selectedE = colors[triangleIndex * 3],
        secondVertexIndex = computed ? colors[triangleIndex * 3 + 2] : colors[triangleIndex * 3 + 1],
        thirdVertexIndex = computed ? colors[triangleIndex * 3 + 1] : colors[triangleIndex * 3 + 2]
      ;((int32Array[triangleIndex * 3] = selectedE), (int32Array[triangleIndex * 3 + 1] = secondVertexIndex), (int32Array[triangleIndex * 3 + 2] = thirdVertexIndex))
      const scaledValueX = float32Array[secondVertexIndex * 3] - float32Array[selectedE * 3],
        scaledValueY = float32Array[secondVertexIndex * 3 + 1] - float32Array[selectedE * 3 + 1],
        scaledValueZ = float32Array[secondVertexIndex * 3 + 2] - float32Array[selectedE * 3 + 2],
        scaledValueWidth = float32Array[thirdVertexIndex * 3] - float32Array[selectedE * 3],
        scaledValueHeight = float32Array[thirdVertexIndex * 3 + 1] - float32Array[selectedE * 3 + 1],
        scaledValueDepth = float32Array[thirdVertexIndex * 3 + 2] - float32Array[selectedE * 3 + 2],
        scaledValueStart = scaledValueY * scaledValueDepth - scaledValueZ * scaledValueHeight,
        scaledValueEnd = scaledValueZ * scaledValueWidth - scaledValueX * scaledValueDepth,
        scaledValueNear = scaledValueX * scaledValueHeight - scaledValueY * scaledValueWidth,
        distance = Math.hypot(scaledValueStart, scaledValueEnd, scaledValueNear)
      distance < 1e-10 || ((uint8Array[triangleIndex] = 1), (samplesX[triangleIndex * 3] = scaledValueStart), (samplesX[triangleIndex * 3 + 1] = scaledValueEnd), (samplesX[triangleIndex * 3 + 2] = scaledValueNear), (samplesY[triangleIndex * 3] = scaledValueStart / distance), (samplesY[triangleIndex * 3 + 1] = scaledValueEnd / distance), (samplesY[triangleIndex * 3 + 2] = scaledValueNear / distance))
    }
    const entriesX = new Int32Array(ratio + 1)
    for (let triangleCountIndex = 0; triangleCountIndex < ratioX; triangleCountIndex++) if (uint8Array[triangleCountIndex]) for (let cornerCountIndex = 0; cornerCountIndex < 3; cornerCountIndex++) entriesX[int32Array[triangleCountIndex * 3 + cornerCountIndex] + 1]++
    for (let vertexOffsetIndex = 0; vertexOffsetIndex < ratio; vertexOffsetIndex++) entriesX[vertexOffsetIndex + 1] += entriesX[vertexOffsetIndex]
    const vertexTriangleStarts = entriesX.slice(0, ratio),
      samplesZ = new Int32Array(entriesX[ratio])
    for (let triangleFillIndex = 0; triangleFillIndex < ratioX; triangleFillIndex++) if (uint8Array[triangleFillIndex]) for (let cornerFillIndex = 0; cornerFillIndex < 3; cornerFillIndex++) samplesZ[vertexTriangleStarts[int32Array[triangleFillIndex * 3 + cornerFillIndex]]++] = triangleFillIndex
    const scaledValueFar = coordZ >= 180 ? -2 : Math.cos(coordZ * DEGREES_TO_RAD),
      array = new Array(ratio)
    let ratioY = this.pos.length / 3
    for (let triangleEmitIndex = 0; triangleEmitIndex < ratioX; triangleEmitIndex++) {
      if (!uint8Array[triangleEmitIndex]) continue
      const selectedU = samplesY[triangleEmitIndex * 3],
        elementZ = samplesY[triangleEmitIndex * 3 + 1],
        elementWidth = samplesY[triangleEmitIndex * 3 + 2]
      for (let cornerEmitIndex = 0; cornerEmitIndex < 3; cornerEmitIndex++) {
        const selectedD = int32Array[triangleEmitIndex * 3 + cornerEmitIndex]
        let accumNormalX = 0,
          accumNormalY = 0,
          accumNormalZ = 0
        for (let elementHeight = entriesX[selectedD]; elementHeight < entriesX[selectedD + 1]; elementHeight++) {
          const selectedG = samplesZ[elementHeight]
          ;(selectedG === triangleEmitIndex || selectedU * samplesY[selectedG * 3] + elementZ * samplesY[selectedG * 3 + 1] + elementWidth * samplesY[selectedG * 3 + 2] >= scaledValueFar) && ((accumNormalX += samplesX[selectedG * 3]), (accumNormalY += samplesX[selectedG * 3 + 1]), (accumNormalZ += samplesX[selectedG * 3 + 2]))
        }
        const distanceX = Math.hypot(accumNormalX, accumNormalY, accumNormalZ) || 1
        ;((accumNormalX /= distanceX), (accumNormalY /= distanceX), (accumNormalZ /= distanceX))
        let selectedV = array[selectedD]
        selectedV || (selectedV = array[selectedD] = [])
        let computedX = -1
        for (let normalGroupOffset = 0; normalGroupOffset < selectedV.length; normalGroupOffset += 4)
          if (selectedV[normalGroupOffset] * accumNormalX + selectedV[normalGroupOffset + 1] * accumNormalY + selectedV[normalGroupOffset + 2] * accumNormalZ > 0.9995) {
            computedX = selectedV[normalGroupOffset + 3]
            break
          }
        ;(computedX < 0 && ((computedX = ratioY++), selectedV.push(accumNormalX, accumNormalY, accumNormalZ, computedX), this.writeVertex(float32Array[selectedD * 3], float32Array[selectedD * 3 + 1], float32Array[selectedD * 3 + 2], accumNormalX, accumNormalY, accumNormalZ, coordY ? coordY[selectedD] : 0)), this.idx.push(computedX))
      }
    }
    if (this.idx.length > startIndex) {
      let ratioZ = 1 / 0,
        ratioWidth = 1 / 0,
        ratioHeight = 1 / 0,
        ratioDepth = -1 / 0,
        ratioStart = -1 / 0,
        ratioEnd = -1 / 0
      for (let vertexBoundsIndex = 0; vertexBoundsIndex < ratio; vertexBoundsIndex++)
        ((ratioZ = Math.min(ratioZ, float32Array[vertexBoundsIndex * 3])), (ratioDepth = Math.max(ratioDepth, float32Array[vertexBoundsIndex * 3])), (ratioWidth = Math.min(ratioWidth, float32Array[vertexBoundsIndex * 3 + 1])), (ratioStart = Math.max(ratioStart, float32Array[vertexBoundsIndex * 3 + 1])), (ratioHeight = Math.min(ratioHeight, float32Array[vertexBoundsIndex * 3 + 2])), (ratioEnd = Math.max(ratioEnd, float32Array[vertexBoundsIndex * 3 + 2])))
      this.prims.push({ start: startIndex, count: this.idx.length - startIndex, size: Math.max(ratioDepth - ratioZ, ratioStart - ratioWidth, ratioEnd - ratioHeight), outlined: this.lineW > 0 })
    }
  }
  writeVertex(coordX, coordY, coordZ, normalX, normalY, normalZ, gradientCoord) {
    ;(this.pos.push(coordX, coordY, coordZ), this.nor.push(normalX, normalY, normalZ))
    const cState = this.c,
      c2State = this.c2,
      items = this.by ? clampUnit(this.by(coordX, coordY, coordZ, gradientCoord, normalX, normalY, normalZ)) : gradientCoord
    let computed = 1
    if (
      (this.grain > 0 && (computed = 1 + (hashUnitRandom(Math.round(coordX * 400), Math.round(coordY * 400), Math.round(coordZ * 400), 7) - 0.5) * 2 * this.grain),
      c2State ? this.col.push((cState[0] + (c2State[0] - cState[0]) * items) * computed, (cState[1] + (c2State[1] - cState[1]) * items) * computed, (cState[2] + (c2State[2] - cState[2]) * items) * computed) : this.col.push(cState[0] * computed, cState[1] * computed, cState[2] * computed),
      this.fx.push(this.gloss, this.glow2 >= 0 ? lerpValue(this.glow, this.glow2, items) : this.glow, this.team, this.ao2 >= 0 ? lerpValue(this.ao, this.ao2, items) : this.ao),
      this.line.push(this.lineW),
      this.mat.push(this.matX, this.matY, this.matZ, this.matW),
      this.soft)
    ) {
      const softResult = this.soft(coordX, coordY, coordZ, items)
      this.skin.push(softResult[0], softResult[1], softResult[2])
    } else this.skin.push(this.boneId, this.boneId, 1)
  }
  skinRings(entries, entriesX, coordZ, segmentsPerRing, isReady, capEnd, isClosed, creaseAngle, startCapCoord = 0, endCapCoord = 1) {
    const entriesY = [],
      items = isClosed ? coordZ : coordZ - 1
    for (let index = 0; index < items; index++) {
      const total = index * segmentsPerRing,
        nextRingStart = ((index + 1) % coordZ) * segmentsPerRing
      for (let segmentIndex = 0; segmentIndex < segmentsPerRing; segmentIndex++) {
        const nextSegment = (segmentIndex + 1) % segmentsPerRing
        entriesY.push(total + segmentIndex, nextRingStart + segmentIndex, total + nextSegment, total + nextSegment, nextRingStart + segmentIndex, nextRingStart + nextSegment)
      }
    }
    if (!isClosed) {
      if (isReady) {
        const ratio = entries.length / 3
        let startCenterX = 0,
          startCenterY = 0,
          startCenterZ = 0
        for (let startCapSegment = 0; startCapSegment < segmentsPerRing; startCapSegment++) ((startCenterX += entries[startCapSegment * 3]), (startCenterY += entries[startCapSegment * 3 + 1]), (startCenterZ += entries[startCapSegment * 3 + 2]))
        ;(entries.push(startCenterX / segmentsPerRing, startCenterY / segmentsPerRing, startCenterZ / segmentsPerRing), entriesX.push(startCapCoord))
        for (let startCapFanIndex = 0; startCapFanIndex < segmentsPerRing; startCapFanIndex++) entriesY.push(ratio, startCapFanIndex, (startCapFanIndex + 1) % segmentsPerRing)
      }
      if (capEnd) {
        const delta = (coordZ - 1) * segmentsPerRing,
          ratioX = entries.length / 3
        let endCenterX = 0,
          endCenterY = 0,
          endCenterZ = 0
        for (let endCapSegment = 0; endCapSegment < segmentsPerRing; endCapSegment++) ((endCenterX += entries[(delta + endCapSegment) * 3]), (endCenterY += entries[(delta + endCapSegment) * 3 + 1]), (endCenterZ += entries[(delta + endCapSegment) * 3 + 2]))
        ;(entries.push(endCenterX / segmentsPerRing, endCenterY / segmentsPerRing, endCenterZ / segmentsPerRing), entriesX.push(endCapCoord))
        for (let endCapFanIndex = 0; endCapFanIndex < segmentsPerRing; endCapFanIndex++) entriesY.push(ratioX, delta + ((endCapFanIndex + 1) % segmentsPerRing), delta + endCapFanIndex)
      }
    }
    this.emit(entries, entriesY, entriesX, creaseAngle)
  }
  lathe(entries, limbSpec: LimbSpec = {}) {
    const computed = limbSpec.seg ?? 10,
      computedX = limbSpec.power ?? 2,
      phaseStartAngle = (limbSpec.phase ?? 0) * DEGREES_TO_RAD,
      entriesX = [],
      entriesY = [],
      profilePointCount = entries.length
    for (let index = 0; index < profilePointCount; index++) {
      const element = entries[index],
        selectedF = element[1],
        computedY = element[2] ?? selectedF,
        computedZ = element[3] ?? 0,
        computedWidth = element[4] ?? 0
      for (let segmentIndex = 0; segmentIndex < computed; segmentIndex++) {
        const scaledValueX = phaseStartAngle + (segmentIndex / computed) * Math.PI * 2,
          items = limbSpec.shape ? limbSpec.shape(scaledValueX, index) : 1
        ;(entriesX.push(computedZ + cosineEasePow(scaledValueX, computedX) * selectedF * items, element[0], computedWidth + sineEasePow(scaledValueX, computedX) * computedY * items), entriesY.push(index / (profilePointCount - 1)))
      }
    }
    return (this.skinRings(entriesX, entriesY, profilePointCount, computed, limbSpec.cap0 ?? !0, limbSpec.cap1 ?? !0, !1, limbSpec.crease), this)
  }
  tube(entries, limbSpec: LimbSpec = {}) {
    const computed = limbSpec.seg ?? 8,
      computedX = limbSpec.power ?? 2,
      phaseStartAngle = (limbSpec.phase ?? 0) * DEGREES_TO_RAD,
      computedY = limbSpec.closed ?? !1,
      pathPointCount = entries.length,
      entriesX = [],
      entriesY = [],
      samples = limbSpec.up ?? [1, 0, 0]
    let computedZ = 0,
      computedWidth = 0,
      computedHeight = 0
    for (let index = 0; index < pathPointCount; index++) {
      const element = entries[index],
        elementX = entries[computedY ? (index + pathPointCount - 1) % pathPointCount : Math.max(0, index - 1)],
        elementY = entries[computedY ? (index + 1) % pathPointCount : Math.min(pathPointCount - 1, index + 1)]
      let deltaX = elementY[0] - elementX[0],
        deltaY = elementY[1] - elementX[1],
        deltaZ = elementY[2] - elementX[2]
      const distance = Math.hypot(deltaX, deltaY, deltaZ) || 1
      ;((deltaX /= distance), (deltaY /= distance), (deltaZ /= distance))
      let sum = samples[0] * deltaX + samples[1] * deltaY + samples[2] * deltaZ,
        deltaXX = samples[0] - deltaX * sum,
        deltaYX = samples[1] - deltaY * sum,
        deltaZX = samples[2] - deltaZ * sum,
        normalLength = Math.hypot(deltaXX, deltaYX, deltaZX)
      ;(normalLength < 0.15 && (index > 0 ? ((sum = computedZ * deltaX + computedWidth * deltaY + computedHeight * deltaZ), (deltaXX = computedZ - deltaX * sum), (deltaYX = computedWidth - deltaY * sum), (deltaZX = computedHeight - deltaZ * sum)) : ((deltaXX = -deltaZ * deltaX), (deltaYX = -deltaZ * deltaY), (deltaZX = 1 - deltaZ * deltaZ)), (normalLength = Math.hypot(deltaXX, deltaYX, deltaZX) || 1)),
        (deltaXX /= normalLength),
        (deltaYX /= normalLength),
        (deltaZX /= normalLength),
        (computedZ = deltaXX),
        (computedWidth = deltaYX),
        (computedHeight = deltaZX))
      const scaledValueX = deltaYX * deltaZ - deltaZX * deltaY,
        scaledValueY = deltaZX * deltaX - deltaXX * deltaZ,
        scaledValueZ = deltaXX * deltaY - deltaYX * deltaX,
        selectedX = element[3],
        computedDepth = element[4] ?? selectedX
      for (let segmentIndex = 0; segmentIndex < computed; segmentIndex++) {
        const scaledValueWidth = phaseStartAngle + (segmentIndex / computed) * Math.PI * 2,
          items = limbSpec.shape ? limbSpec.shape(scaledValueWidth, index) : 1,
          scaledValueHeight = cosineEasePow(scaledValueWidth, computedX) * selectedX * items,
          scaledValueDepth = sineEasePow(scaledValueWidth, computedX) * computedDepth * items
        ;(entriesX.push(element[0] + deltaXX * scaledValueHeight + scaledValueX * scaledValueDepth, element[1] + deltaYX * scaledValueHeight + scaledValueY * scaledValueDepth, element[2] + deltaZX * scaledValueHeight + scaledValueZ * scaledValueDepth), entriesY.push(computedY ? index / pathPointCount : index / (pathPointCount - 1)))
      }
    }
    return (this.skinRings(entriesX, entriesY, pathPointCount, computed, limbSpec.cap0 ?? !0, limbSpec.cap1 ?? !0, computedY, limbSpec.crease), this)
  }
  ball(coordX, elbowY, coordY, coordZ, radiusY = coordZ, radiusZ = coordZ, detailLevel = 1, creaseAngle?) {
    const variant = buildVariant(detailLevel),
      entries = [],
      entriesX = []
    for (let total = 0; total < variant.v.length; total += 3) (entries.push(coordX + variant.v[total] * coordZ, elbowY + variant.v[total + 1] * radiusY, coordY + variant.v[total + 2] * radiusZ), entriesX.push(variant.v[total + 1] * 0.5 + 0.5))
    return (this.emit(entries, variant.t, entriesX, creaseAngle ?? 180), this)
  }
  box(coordX, coordY, coordZ, width, height, depth, bevelRadius = 0, creaseAngle?) {
    const ratio = width / 2,
      ratioX = height / 2,
      ratioY = depth / 2,
      effectiveBevelRadius = Math.min(bevelRadius, ratio * 0.98, ratioX * 0.98, ratioY * 0.98),
      entries = [],
      entriesX = [],
      entriesY = [],
      samples = [ratio, ratioX, ratioY],
      cornerCode = (coordX, coordY, coordZ, signZ) => coordX * 8 + (coordY > 0 ? 4 : 0) + (coordZ > 0 ? 2 : 0) + (signZ > 0 ? 1 : 0)
    for (let index = 0; index < 3; index++) {
      const total = (index + 1) % 3,
        thirdAxis = (index + 2) % 3
      for (const primarySign of [-1, 1])
        for (const secondarySign of [-1, 1])
          for (const tertiarySign of [-1, 1]) {
            const samplesX = [0, 0, 0]
            ;((samplesX[index] = primarySign * samples[index]), (samplesX[total] = secondarySign * (samples[total] - effectiveBevelRadius)), (samplesX[thirdAxis] = tertiarySign * (samples[thirdAxis] - effectiveBevelRadius)), entries.push(coordX + samplesX[0], coordY + samplesX[1], coordZ + samplesX[2]), entriesX.push(ratioX > 0 ? samplesX[1] / (2 * ratioX) + 0.5 : 0))
          }
    }
    const samplesY = [coordX, coordY, coordZ],
      scaledValueX = (clavL) => {
        let total = 0,
          centroidOffsetY = 0,
          centroidOffsetZ = 0
        for (const item of clavL) ((total += entries[item * 3] - samplesY[0]), (centroidOffsetY += entries[item * 3 + 1] - samplesY[1]), (centroidOffsetZ += entries[item * 3 + 2] - samplesY[2]))
        const selected_ = clavL[0],
          element = clavL[1],
          elementX = clavL[2],
          firstEdgeX = entries[element * 3] - entries[selected_ * 3],
          scaledValueX = entries[element * 3 + 1] - entries[selected_ * 3 + 1],
          scaledValueY = entries[element * 3 + 2] - entries[selected_ * 3 + 2],
          scaledValueZ = entries[elementX * 3] - entries[selected_ * 3],
          scaledValueWidth = entries[elementX * 3 + 1] - entries[selected_ * 3 + 1],
          scaledValueHeight = entries[elementX * 3 + 2] - entries[selected_ * 3 + 2],
          sortedEntries = (scaledValueX * scaledValueHeight - scaledValueY * scaledValueWidth) * total + (scaledValueY * scaledValueZ - firstEdgeX * scaledValueHeight) * centroidOffsetY + (firstEdgeX * scaledValueWidth - scaledValueX * scaledValueZ) * centroidOffsetZ >= 0 ? clavL : [...clavL].reverse()
        for (let index = 1; index < sortedEntries.length - 1; index++) entriesY.push(sortedEntries[0], sortedEntries[index], sortedEntries[index + 1])
      }
    for (let axisIndex = 0; axisIndex < 3; axisIndex++) for (const secondary of [-1, 1]) scaledValueX([cornerCode(axisIndex, secondary, -1, -1), cornerCode(axisIndex, secondary, 1, -1), cornerCode(axisIndex, secondary, 1, 1), cornerCode(axisIndex, secondary, -1, 1)])
    if (effectiveBevelRadius > 0) {
      for (let bevelAxisIndex = 0; bevelAxisIndex < 3; bevelAxisIndex++) {
        const nextBevelAxis = (bevelAxisIndex + 1) % 3,
          bevelThirdAxis = (bevelAxisIndex + 2) % 3
        for (const primary of [-1, 1]) for (const secondaryX of [-1, 1]) scaledValueX([cornerCode(nextBevelAxis, primary, secondaryX, -1), cornerCode(nextBevelAxis, primary, secondaryX, 1), cornerCode(bevelThirdAxis, secondaryX, 1, primary), cornerCode(bevelThirdAxis, secondaryX, -1, primary)])
      }
      for (const coordXX of [-1, 1]) for (const coordYX of [-1, 1]) for (const coordZX of [-1, 1]) scaledValueX([cornerCode(0, coordXX, coordYX, coordZX), cornerCode(1, coordYX, coordZX, coordXX), cornerCode(2, coordZX, coordXX, coordYX)])
    }
    return (this.emit(entries, entriesY, entriesX, creaseAngle), this)
  }
  crystal(coordX, coordY, coordZ = 6, upperHeightRatio = 0.35, lowerHeightRatio = 0.18, upperRadiusRatio = 0.85) {
    return this.lathe(
      [
        [0, 0.001],
        [coordY * lowerHeightRatio, coordX],
        [coordY * (1 - upperHeightRatio), coordX * upperRadiusRatio],
        [coordY, 0.001],
      ],
      { seg: coordZ, cap0: !1, cap1: !1, crease: 0 },
    )
  }
  extrude(coordX, coordY, coordZ = 0, creaseAngle?) {
    let outlinePoints = coordX,
      total = 0
    for (let index = 0, delta = outlinePoints.length - 1; index < outlinePoints.length; delta = index++) total += outlinePoints[delta][0] * outlinePoints[index][1] - outlinePoints[index][0] * outlinePoints[delta][1]
    total < 0 && (outlinePoints = [...outlinePoints].reverse())
    const outlinePointCount = outlinePoints.length
    let ratio = 1 / 0,
      ratioX = -1 / 0
    for (const item of outlinePoints) ((ratio = Math.min(ratio, item[1])), (ratioX = Math.max(ratioX, item[1])))
    const ratioY = (yPosition) => (ratioX > ratio ? (yPosition - ratio) / (ratioX - ratio) : 0),
      entries = []
    for (let sourceOutlineIndex = 0; sourceOutlineIndex < outlinePointCount; sourceOutlineIndex++) {
      const selectedA = outlinePoints[(sourceOutlineIndex + outlinePointCount - 1) % outlinePointCount],
        element = outlinePoints[sourceOutlineIndex],
        elementX = outlinePoints[(sourceOutlineIndex + 1) % outlinePointCount]
      let deltaX = element[0] - selectedA[0],
        deltaY = element[1] - selectedA[1],
        deltaXX = elementX[0] - element[0],
        deltaYX = elementX[1] - element[1]
      const distance = Math.hypot(deltaX, deltaY) || 1,
        distanceX = Math.hypot(deltaXX, deltaYX) || 1
      ;((deltaX /= distance), (deltaY /= distance), (deltaXX /= distanceX), (deltaYX /= distanceX))
      let deltaZ = -deltaY - deltaYX,
        sum = deltaX + deltaXX
      const distanceY = Math.hypot(deltaZ, sum) || 1
      ;((deltaZ /= distanceY), (sum /= distanceY))
      const miterScale = Math.max(0.4, deltaZ * -deltaY + sum * deltaX)
      entries.push([element[0] + (deltaZ * coordZ) / miterScale, element[1] + (sum * coordZ) / miterScale])
    }
    const entriesX = [],
      entriesY = [],
      entriesZ = [],
      ratioZ = coordY / 2,
      bevelInset = Math.min(coordZ, ratioZ * 0.95),
      entriesWidth =
        coordZ > 0
          ? [
              [entries, -ratioZ],
              [outlinePoints, -ratioZ + bevelInset],
              [outlinePoints, ratioZ - bevelInset],
              [entries, ratioZ],
            ]
          : [
              [outlinePoints, -ratioZ],
              [outlinePoints, ratioZ],
            ]
    for (const [layerOutline, layerZ] of entriesWidth) for (const samples of layerOutline) (entriesX.push(samples[0], samples[1], layerZ), entriesY.push(ratioY(samples[1])))
    for (let layerIndex = 0; layerIndex < entriesWidth.length - 1; layerIndex++)
      for (let outlineIndex = 0; outlineIndex < outlinePointCount; outlineIndex++) {
        const nextOutlineIndex = (outlineIndex + 1) % outlinePointCount,
          sumX = layerIndex * outlinePointCount + outlineIndex,
          sumY = layerIndex * outlinePointCount + nextOutlineIndex,
          sumZ = (layerIndex + 1) * outlinePointCount + nextOutlineIndex,
          sumWidth = (layerIndex + 1) * outlinePointCount + outlineIndex
        entriesZ.push(sumX, sumY, sumZ, sumX, sumZ, sumWidth)
      }
    const selectedLength1 = entriesWidth[entriesWidth.length - 1][0],
      triangulateShapeResult = ShapeUtils.triangulateShape(
        selectedLength1.map((samples) => new Vector2(samples[0], samples[1])),
        [],
      ),
      deltaWidth = (entriesWidth.length - 1) * outlinePointCount
    for (const samplesX of triangulateShapeResult) {
      const selectedY = selectedLength1[samplesX[0]],
        samplesY = selectedLength1[samplesX[1]],
        samplesZ = selectedLength1[samplesX[2]],
        deltaXY = (samplesY[0] - selectedY[0]) * (samplesZ[1] - selectedY[1]) - (samplesY[1] - selectedY[1]) * (samplesZ[0] - selectedY[0]) > 0,
        items = deltaXY ? samplesX[1] : samplesX[2],
        itemsX = deltaXY ? samplesX[2] : samplesX[1]
      ;(entriesZ.push(deltaWidth + samplesX[0], deltaWidth + items, deltaWidth + itemsX), entriesZ.push(samplesX[0], itemsX, items))
    }
    return (this.emit(entriesX, entriesZ, entriesY, creaseAngle), this)
  }
  sheet(coordX, coordY, coordZ, doubleSided = !0, creaseAngle?) {
    const entries = [],
      entriesX = []
    for (let index = 0; index <= coordY; index++)
      for (let columnIndex = 0; columnIndex <= coordX; columnIndex++) {
        const sResult = coordZ(columnIndex / coordX, index / coordY)
        ;(entries.push(sResult[0], sResult[1], sResult[2]), entriesX.push(index / coordY))
      }
    const entriesY = [],
      entriesZ = [],
      sum = coordX + 1
    for (let rowIndex = 0; rowIndex < coordY; rowIndex++)
      for (let cellColumnIndex = 0; cellColumnIndex < coordX; cellColumnIndex++) {
        const sumX = rowIndex * sum + cellColumnIndex,
          sumY = sumX + 1,
          sumZ = sumX + sum,
          sumWidth = sumZ + 1
        ;(entriesY.push(sumX, sumY, sumWidth, sumX, sumWidth, sumZ), entriesZ.push(sumX, sumWidth, sumY, sumX, sumZ, sumWidth))
      }
    return (this.emit(entries, entriesY, entriesX, creaseAngle ?? 180), doubleSided && this.emit(entries, entriesZ, entriesX, creaseAngle ?? 180), this)
  }
  torus(coordX, coordY, coordZ = coordY, majorSegments = 20, tubeSegments = 6, torusOptions: TorusOptions = {}) {
    const entries = []
    for (let index = 0; index < majorSegments; index++) {
      const majorRingAngle = (index / majorSegments) * Math.PI * 2
      entries.push([Math.cos(majorRingAngle) * coordX, torusOptions.y ?? 0, Math.sin(majorRingAngle) * coordX, coordZ, coordY])
    }
    return this.tube(entries, { seg: tubeSegments, closed: !0, up: [0, 1, 0], power: torusOptions.power, phase: torusOptions.phase, crease: torusOptions.crease })
  }
  limb(samples, samplesX, coordZ, endRadius, limbOptions: LimbOptions = {}) {
    const computed = limbOptions.bulge ?? 0,
      entries = [],
      items = computed !== 0 ? 4 : 1,
      computedX = limbOptions.flat ?? 1
    for (let index = 0; index <= items; index++) {
      const ratio = index / items,
        lerped = lerpValue(coordZ, endRadius, ratio) * (1 + computed * Math.sin(Math.PI * ratio))
      entries.push([lerpValue(samples[0], samplesX[0], ratio), lerpValue(samples[1], samplesX[1], ratio), lerpValue(samples[2], samplesX[2], ratio), lerped, lerped * computedX])
    }
    return this.tube(entries, limbOptions)
  }
  /**
   * 处理地形。
   *
   * @param coordX - 主要输入
   * @param coordY - 次要输入
   * @param coordZ - 第三输入
  */
  bakeGrounding(coordX, coordY = 0.7, coordZ = 0.86) {
    const ratio = this.pos.length / 3
    for (let index = 0; index < ratio; index++) {
      if (this.fx[index * 4 + 1] > 0.05) continue
      const selectedNor = this.nor[index * 3 + 1],
        selectedPos = this.pos[index * 3 + 1],
        lerped = lerpValue(coordY, 1, smoothStep01(-0.95, 0.25, selectedNor))
      this.fx[index * 4 + 3] *= lerped
      const lerpedX = lerpValue(coordZ, 1, clampUnit(selectedPos / (coordX * 0.45))) * lerpValue(0.9, 1, smoothStep01(-0.9, 0.1, selectedNor))
      ;((this.col[index * 3] *= lerpedX), (this.col[index * 3 + 1] *= lerpedX), (this.col[index * 3 + 2] *= lerpedX))
    }
  }
  build() {
    const element = new BufferGeometry()
    ;(element.setAttribute("position", new Float32BufferAttribute(this.pos, 3)), element.setAttribute("normal", new Float32BufferAttribute(this.nor, 3)), element.setAttribute("color", new Float32BufferAttribute(this.col, 3)))
    const entries = new Uint8Array(this.fx.length)
    for (let index = 0; index < entries.length; index++) entries[index] = Math.round(clampUnit(this.fx[index]) * 255)
    ;(element.setAttribute("aFx", new BufferAttribute(entries, 4, !0)), element.setAttribute("aSkin", new Float32BufferAttribute(this.skin, 3)))
    const entriesX = new Uint8Array(this.mat.length)
    for (let materialIndex = 0; materialIndex < entriesX.length; materialIndex++) entriesX[materialIndex] = Math.round(clampUnit(this.mat[materialIndex]) * 255)
    element.setAttribute("aMat", new BufferAttribute(entriesX, 4, !0))
    const ratio = this.pos.length / 3,
      positionNormalMap = new Map(),
      samples = new Array(ratio)
    for (let vertexIndex = 0; vertexIndex < ratio; vertexIndex++) {
      const lookupKey = `${Math.round(this.pos[vertexIndex * 3] * 1500)},${Math.round(this.pos[vertexIndex * 3 + 1] * 1500)},${Math.round(this.pos[vertexIndex * 3 + 2] * 1500)}`
      samples[vertexIndex] = lookupKey
      let Result = positionNormalMap.get(lookupKey)
      ;(Result || ((Result = [0, 0, 0]), positionNormalMap.set(lookupKey, Result)), (Result[0] += this.nor[vertexIndex * 3]), (Result[1] += this.nor[vertexIndex * 3 + 1]), (Result[2] += this.nor[vertexIndex * 3 + 2]))
    }
    const int8Array = new Int8Array(ratio * 4)
    for (let outlineVertexIndex = 0; outlineVertexIndex < ratio; outlineVertexIndex++) {
      const samplesX = positionNormalMap.get(samples[outlineVertexIndex]),
        distance = Math.hypot(samplesX[0], samplesX[1], samplesX[2]),
        weldedNormalX = distance > 0.2 ? samplesX[0] / distance : this.nor[outlineVertexIndex * 3],
        scaledValueX = distance > 0.2 ? samplesX[1] / distance : this.nor[outlineVertexIndex * 3 + 1],
        scaledValueY = distance > 0.2 ? samplesX[2] / distance : this.nor[outlineVertexIndex * 3 + 2]
      ;((int8Array[outlineVertexIndex * 4] = Math.round(weldedNormalX * 127)), (int8Array[outlineVertexIndex * 4 + 1] = Math.round(scaledValueX * 127)), (int8Array[outlineVertexIndex * 4 + 2] = Math.round(scaledValueY * 127)), (int8Array[outlineVertexIndex * 4 + 3] = Math.round(clampUnit(this.line[outlineVertexIndex]) * 127)))
    }
    element.setAttribute("aOutline", new BufferAttribute(int8Array, 4, !0))
    const sortResult = this.prims.map((coordX, coordY) => ({ p: coordX, i: coordY })).sort((worldState, worldStateX) => (worldState.p.outlined === worldStateX.p.outlined ? worldStateX.p.size - worldState.p.size || worldState.i - worldStateX.i : worldState.p.outlined ? -1 : 1)),
      sortedIndices = new Array(this.idx.length),
      sizesConfig = { sizes: [], ends: [], outlined: 0, total: this.idx.length }
    let computed = 0
    for (const { p: position } of sortResult) {
      for (let indexOffset = 0; indexOffset < position.count; indexOffset++) sortedIndices[computed++] = this.idx[position.start + indexOffset]
      position.outlined && (sizesConfig.sizes.push(position.size), sizesConfig.ends.push(computed), (sizesConfig.outlined = computed))
    }
    return ((element.userData.lod = sizesConfig), element.setIndex(ratio > 65535 ? new Uint32BufferAttribute(sortedIndices, 1) : new Uint16BufferAttribute(sortedIndices, 1)), element.computeBoundingBox(), element.computeBoundingSphere(), element)
  }
}

function sampleColorGradient(entries, secondary) {
  const delta = entries.length - 1,
    clamped = clampUnit(secondary) * delta,
    deltaX = Math.min(delta - 1, Math.floor(clamped)),
    deltaY = clamped - deltaX
  return [lerpValue(entries[deltaX][0], entries[deltaX + 1][0], deltaY), lerpValue(entries[deltaX][1], entries[deltaX + 1][1], deltaY), lerpValue(entries[deltaX][2], entries[deltaX + 1][2], deltaY)]
}

const RIBBON_WIDTH_PROFILE = [
  [-0.25, 0.035, 0.035, 0.075],
  [-0.215, 0.1, 0.095, 0.052],
  [-0.15, 0.168, 0.162, 0.026],
  [-0.06, 0.214, 0.208, 0.008],
  [0.03, 0.236, 0.232, 0],
  [0.12, 0.23, 0.234, -0.008],
  [0.19, 0.192, 0.202, -0.014],
  [0.235, 0.12, 0.13, -0.018],
  [0.256, 0.02, 0.02, -0.02],
]

function emitConeSkirt(coordX, coordY, coordZ, baseHeight, radiusX, radiusY, apexRise, segmentCount) {
  const entries = [coordY, coordZ, baseHeight + apexRise],
    entriesX = []
  for (let index = 0; index < segmentCount; index++) {
    const skirtAngle = (index / segmentCount) * Math.PI * 2
    ;(entries.push(coordY + Math.cos(skirtAngle) * radiusX, coordZ + Math.sin(skirtAngle) * radiusY, baseHeight), entriesX.push(0, 1 + index, 1 + ((index + 1) % segmentCount)))
  }
  coordX.emit(entries, entriesX, null, 180)
}

function emitTaperedTube(builder, samples, samplesX, tubeLength, baseRadius, joints: TaperedTubeJoints = {}) {
  const computed = joints.n ?? 4,
    distance = Math.hypot(samplesX[0], samplesX[1], samplesX[2]) || 1,
    samplesY = joints.curl ?? [0, 0, 0],
    computedX = joints.tip ?? 0.08,
    entries = []
  for (let index = 0; index <= computed; index++) {
    const ratio = index / computed,
      axialDistance = tubeLength * ratio,
      scaledValueX = tubeLength * ratio * ratio,
      lerped = baseRadius * (index === 0 ? 0.72 : lerpValue(1, computedX, Math.pow(ratio, 1.4)) * (1 + 0.18 * Math.sin(Math.PI * Math.min(1, ratio * 1.6))))
    entries.push([samples[0] + (samplesX[0] / distance) * axialDistance + samplesY[0] * scaledValueX, samples[1] + (samplesX[1] / distance) * axialDistance + samplesY[1] * scaledValueX, samples[2] + (samplesX[2] / distance) * axialDistance + samplesY[2] * scaledValueX, lerped, lerped * (joints.flat ?? 0.8)])
  }
  builder.tube(entries, { seg: joints.seg ?? 5, up: joints.up ?? [1, 0, 0], crease: 180 })
}

function emitFurTufts(builder, entries, furSpec) {
  const computed = furSpec.tufts ?? 8,
    computedX = furSpec.amp ?? 0.22,
    computedY = furSpec.closed ?? !1,
    tuftSampleCount = computed * 2,
    pathPointCount = entries.length,
    entriesX = [],
    items = computedY ? tuftSampleCount : tuftSampleCount + 1
  for (let index = 0; index < items; index++) {
    const scaledValueX = computedY ? (index / tuftSampleCount) * pathPointCount : (index / tuftSampleCount) * (pathPointCount - 1),
      pathPointIndex = Math.floor(scaledValueX) % pathPointCount,
      itemsX = computedY ? (pathPointIndex + 1) % pathPointCount : Math.min(pathPointCount - 1, pathPointIndex + 1),
      delta = scaledValueX - Math.floor(scaledValueX),
      element = entries[pathPointIndex],
      elementX = entries[itemsX],
      sum = index % 2 === 0 ? 1 + computedX : 1 - computedX * 0.55,
      lerped = lerpValue(element[3], elementX[3], delta),
      lerpedX = lerpValue(element[4] ?? element[3], elementX[4] ?? elementX[3], delta),
      scaledValueY = computedY ? 1 : 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.min(index, tuftSampleCount - index) / 1.5) * 0.5)
    entriesX.push([lerpValue(element[0], elementX[0], delta), lerpValue(element[1], elementX[1], delta), lerpValue(element[2], elementX[2], delta), lerped * sum * scaledValueY, lerpedX * sum * scaledValueY])
  }
  const computedZ = furSpec.lobes ?? 5,
    computedWidth = furSpec.lobeAmp ?? 0.1
  ;(builder.paint(furSpec.c, { c2: furSpec.c2 ?? furSpec.c, mat: MATERIAL_KINDS.fur, grain: furSpec.grain ?? 0.05, team: furSpec.team ?? 0, by: (coordX, coordY, coordZ, gradientCoord, normalX, normalY) => 0.5 - 0.62 * normalY }),
    builder.tube(entriesX, { seg: furSpec.seg ?? 7, closed: computedY, up: furSpec.up ?? [0, 1, 0], crease: 70, shape: (primary, secondary) => 1 + computedWidth * Math.cos(computedZ * primary + secondary * 2.1) }))
}

export { toRgbChannels, sampleColorGradient, MATERIAL_KINDS, RIBBON_WIDTH_PROFILE, ModelBuilder, smoothStep01, emitFurTufts, TERRAIN_LOOK, scaleRgbChannels, clampUnit, applyBreathingPose, emitTaperedTube, emitConeSkirt, lerpValue, composeMatrix, getLodDistance }