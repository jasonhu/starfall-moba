/**
 * 特效随机绘制
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Euler, Matrix4, Vector3 } from 'three'
import { ENGAGE_SCRATCH_MATRIX, ENGAGE_SCRATCH_POSITION, ENGAGE_SCRATCH_NORMAL } from '../sim/hero-engage'
import { FastRandom, hashNoise2D } from '../render/foundation'
import { colorToRgb, lerp3, lerpScalar, scale3 } from './particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { MeshBuilder, polygonCentroid } from '../render/buff-view'
import { buildButtress } from '../render/model-parts'
import { composeMatrixTRS, vectorToAngle } from '../world/tf-system'
import { GRID_A_LEDGE_HEIGHT, GRID_A_PLATEAU_EDGE_HEIGHT } from '../world/grid-a'

function buildTaperedFrustum(meshBuilder, transformMatrix, baseWidth, baseDepth, topHeight, taperInset, baseStoneColor, accentStoneColor, frustumGlow = 0) {
  const baseHalfWidth = baseWidth / 2,
    baseHalfDepth = baseDepth / 2,
    topHalfWidth = baseHalfWidth - taperInset,
    topHalfDepth = baseHalfDepth - taperInset,
    baseHeight = -0.04,
    frustumCorners = [
      [-baseHalfWidth, baseHeight, -baseHalfDepth],
      [-baseHalfWidth, baseHeight, baseHalfDepth],
      [baseHalfWidth, baseHeight, baseHalfDepth],
      [baseHalfWidth, baseHeight, -baseHalfDepth],
      [-topHalfWidth, topHeight, -topHalfDepth],
      [-topHalfWidth, topHeight, topHalfDepth],
      [topHalfWidth, topHeight, topHalfDepth],
      [topHalfWidth, topHeight, -topHalfDepth],
    ]
  ENGAGE_SCRATCH_MATRIX.getNormalMatrix(transformMatrix)
  const emitFrustumFace = (label, secondCornerIndex, thirdCornerIndex, fourthCornerIndex, lookupKey, faceNormalY, faceNormalZ, lowerFaceColor, upperFaceColor) => {
      ENGAGE_SCRATCH_NORMAL.set(lookupKey, faceNormalY, faceNormalZ).applyMatrix3(ENGAGE_SCRATCH_MATRIX).normalize()
      const faceCorners = []
      ;([label, secondCornerIndex, thirdCornerIndex, fourthCornerIndex].forEach((cornerIndex, cornerSlot) => {
        ;(ENGAGE_SCRATCH_POSITION.set(frustumCorners[cornerIndex][0], frustumCorners[cornerIndex][1], frustumCorners[cornerIndex][2]).applyMatrix4(transformMatrix), faceCorners.push(meshBuilder.vertex(ENGAGE_SCRATCH_POSITION.x, ENGAGE_SCRATCH_POSITION.y, ENGAGE_SCRATCH_POSITION.z, cornerSlot < 2 ? lowerFaceColor : upperFaceColor, ENGAGE_SCRATCH_NORMAL.x, ENGAGE_SCRATCH_NORMAL.y, ENGAGE_SCRATCH_NORMAL.z, 0, frustumGlow, 0, cornerSlot < 2 ? 0.7 : 1)))
      }),
        meshBuilder.quad(faceCorners[0], faceCorners[1], faceCorners[2], faceCorners[3]))
    },
    taperSlope = taperInset / Math.max(0.02, topHeight)
  ;(emitFrustumFace(4, 5, 6, 7, 0, 1, 0, baseStoneColor, baseStoneColor), emitFrustumFace(1, 2, 6, 5, 0, taperSlope, 1, accentStoneColor, baseStoneColor), emitFrustumFace(3, 0, 4, 7, 0, taperSlope, -1, accentStoneColor, baseStoneColor), emitFrustumFace(0, 1, 5, 4, -1, taperSlope, 0, accentStoneColor, baseStoneColor), emitFrustumFace(2, 3, 7, 6, 1, taperSlope, 0, accentStoneColor, baseStoneColor))
}

const FULL_TURN_RADIANS = Math.PI * 2,
  ICOSPHERE_SUBDIVISION_CACHE = new Map()

function getSubdividedIcosphere(lookupKey) {
  let Value = ICOSPHERE_SUBDIVISION_CACHE.get(lookupKey)
  if (Value) return Value
  const goldenRatio = (1 + Math.sqrt(5)) / 2
  let icosaVertices = [
    [-1, goldenRatio, 0],
    [1, goldenRatio, 0],
    [-1, -goldenRatio, 0],
    [1, -goldenRatio, 0],
    [0, -1, goldenRatio],
    [0, 1, goldenRatio],
    [0, -1, -goldenRatio],
    [0, 1, -goldenRatio],
    [goldenRatio, 0, -1],
    [goldenRatio, 0, 1],
    [-goldenRatio, 0, -1],
    [-goldenRatio, 0, 1],
  ]
  icosaVertices = icosaVertices.map((rawVertex) => {
    const distance = Math.hypot(rawVertex[0], rawVertex[1], rawVertex[2])
    return [rawVertex[0] / distance, rawVertex[1] / distance, rawVertex[2] / distance]
  })
  let icosaFaces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ]
  for (let index = 0; index < lookupKey; index++) {
    const edgeMidpointCache = new Map(),
      distance = /**
 * 处理距离。
 *
 * @param vertexAIndex - 主要输入
 * @param chest - 输入
 */
(vertexAIndex, chest) => {
        const lookupKey = vertexAIndex < chest ? vertexAIndex * 1e5 + chest : chest * 1e5 + vertexAIndex
        let getValue = edgeMidpointCache.get(lookupKey)
        if (getValue === void 0) {
          const selectedS = icosaVertices[vertexAIndex],
            vertexBPosition = icosaVertices[chest],
            midpointX = selectedS[0] + vertexBPosition[0],
            midpointY = selectedS[1] + vertexBPosition[1],
            midpointZ = selectedS[2] + vertexBPosition[2],
            distance = Math.hypot(midpointX, midpointY, midpointZ)
          ;((getValue = icosaVertices.length), icosaVertices.push([midpointX / distance, midpointY / distance, midpointZ / distance]), edgeMidpointCache.set(lookupKey, getValue))
        }
        return getValue
      },
      subdividedFaces = []
    for (const [faceVertexA, faceVertexB, faceThirdVertex] of icosaFaces) {
      const distanceResult = distance(faceVertexA, faceVertexB),
        edgeBCMidpoint = distance(faceVertexB, faceThirdVertex),
        edgeCAMidpoint = distance(faceThirdVertex, faceVertexA)
      subdividedFaces.push([faceVertexA, distanceResult, edgeCAMidpoint], [faceVertexB, edgeBCMidpoint, distanceResult], [faceThirdVertex, edgeCAMidpoint, edgeBCMidpoint], [distanceResult, edgeBCMidpoint, edgeCAMidpoint])
    }
    icosaFaces = subdividedFaces
  }
  return ((Value = { verts: icosaVertices, tris: icosaFaces }), ICOSPHERE_SUBDIVISION_CACHE.set(lookupKey, Value), Value)
}

function buildPuffedBlobMesh(blobMeshBuilder, blobCenterX, blobCenterY, blobCenterZ, blobRadiusX, blobRadiusY, blobRadiusZ, unit) {
  const SubdividedIcosphereValue = getSubdividedIcosphere(unit.detail ?? 1),
    blobSeed = unit.seed ?? 1,
    bumpAmount = unit.bump ?? 0,
    blobPositions = [],
    blobNormals = []
  for (let index = 0; index < SubdividedIcosphereValue.verts.length; index++) {
    const selectedVerts = SubdividedIcosphereValue.verts[index],
      bumpFactor = 1 + (hashNoise2D(index, blobSeed, 71) - 0.5) * 2 * bumpAmount,
      deformedX = blobCenterX + selectedVerts[0] * blobRadiusX * bumpFactor,
      deformedY = blobCenterY + selectedVerts[1] * blobRadiusY * bumpFactor,
      deformedZ = blobCenterZ + selectedVerts[2] * blobRadiusZ * bumpFactor
    blobPositions.push([deformedX, deformedY, deformedZ])
    let surfaceNormalX = selectedVerts[0] / blobRadiusX,
      surfaceNormalY = selectedVerts[1] / blobRadiusY,
      surfaceNormalZ = selectedVerts[2] / blobRadiusZ,
      distance = Math.hypot(surfaceNormalX, surfaceNormalY, surfaceNormalZ) || 1
    if (((surfaceNormalX /= distance), (surfaceNormalY /= distance), (surfaceNormalZ /= distance), unit.puffCenter && unit.puff)) {
      let puffDirX = deformedX - unit.puffCenter[0],
        puffDirY = deformedY - unit.puffCenter[1],
        puffDirZ = deformedZ - unit.puffCenter[2]
      ;((distance = Math.hypot(puffDirX, puffDirY, puffDirZ) || 1),
        (puffDirX /= distance),
        (puffDirY /= distance),
        (puffDirZ /= distance),
        (surfaceNormalX = lerpScalar(surfaceNormalX, puffDirX, unit.puff)),
        (surfaceNormalY = lerpScalar(surfaceNormalY, puffDirY, unit.puff)),
        (surfaceNormalZ = lerpScalar(surfaceNormalZ, puffDirZ, unit.puff)),
        (distance = Math.hypot(surfaceNormalX, surfaceNormalY, surfaceNormalZ) || 1),
        (surfaceNormalX /= distance),
        (surfaceNormalY /= distance),
        (surfaceNormalZ /= distance))
    }
    blobNormals.push([surfaceNormalX, surfaceNormalY, surfaceNormalZ])
  }
  const blobColorAt = (plaza) => {
      const heightFraction = Math.min(1, Math.max(0, (SubdividedIcosphereValue.verts[plaza][1] + 1) / 2)),
        gradientColor = lerp3(unit.bottom, unit.top, heightFraction * heightFraction * (3 - 2 * heightFraction))
      return scale3(gradientColor, 0.93 + hashNoise2D(plaza, blobSeed, 5) * 0.14)
    },
    blobSwayAt = (swayVertexIndex) => lerpScalar(unit.swayBottom ?? 0, unit.swayTop ?? 0, (SubdividedIcosphereValue.verts[swayVertexIndex][1] + 1) / 2)
  if (unit.flat)
    for (const [triVertexA, triVertexB, triVertexC] of SubdividedIcosphereValue.tris) {
      const selectedD = blobPositions[triVertexA],
        triVertexBPos = blobPositions[triVertexB],
        vertexCPosition = blobPositions[triVertexC],
        edgeBAX = triVertexBPos[0] - selectedD[0],
        edgeBAY = triVertexBPos[1] - selectedD[1],
        edgeBAZ = triVertexBPos[2] - selectedD[2],
        edgeCAX = vertexCPosition[0] - selectedD[0],
        edgeCAY = vertexCPosition[1] - selectedD[1],
        edgeCAZ = vertexCPosition[2] - selectedD[2]
      let triNormalX = edgeBAY * edgeCAZ - edgeBAZ * edgeCAY,
        triNormalY = edgeBAZ * edgeCAX - edgeBAX * edgeCAZ,
        triNormalZ = edgeBAX * edgeCAY - edgeBAY * edgeCAX
      const normalLength = Math.hypot(triNormalX, triNormalY, triNormalZ) || 1
      ;((triNormalX /= normalLength), (triNormalY /= normalLength), (triNormalZ /= normalLength))
      const colorVariation = 0.86 + 0.2 * Math.max(0, triNormalY) + (hashNoise2D(triVertexA + triVertexB * 7, triVertexC, blobSeed) - 0.5) * 0.12,
        vertexResult = blobMeshBuilder.vertex(selectedD[0], selectedD[1], selectedD[2], scale3(blobColorAt(triVertexA), colorVariation), triNormalX, triNormalY, triNormalZ, 0, unit.glow ?? 0, unit.team ?? 0, unit.ao ?? 1),
        vertexBHandle = blobMeshBuilder.vertex(triVertexBPos[0], triVertexBPos[1], triVertexBPos[2], scale3(blobColorAt(triVertexB), colorVariation), triNormalX, triNormalY, triNormalZ, 0, unit.glow ?? 0, unit.team ?? 0, unit.ao ?? 1),
        vertexC = blobMeshBuilder.vertex(vertexCPosition[0], vertexCPosition[1], vertexCPosition[2], scale3(blobColorAt(triVertexC), colorVariation), triNormalX, triNormalY, triNormalZ, 0, unit.glow ?? 0, unit.team ?? 0, unit.ao ?? 1)
      blobMeshBuilder.tri(vertexResult, vertexBHandle, vertexC)
    }
  else {
    const baseVertexCount = blobMeshBuilder.vertexCount
    for (let vertexIndex = 0; vertexIndex < blobPositions.length; vertexIndex++) blobMeshBuilder.vertex(blobPositions[vertexIndex][0], blobPositions[vertexIndex][1], blobPositions[vertexIndex][2], blobColorAt(vertexIndex), blobNormals[vertexIndex][0], blobNormals[vertexIndex][1], blobNormals[vertexIndex][2], blobSwayAt(vertexIndex), unit.glow ?? 0, unit.team ?? 0, unit.ao ?? 1)
    const cutoffHeight = unit.cutBelow ?? -2
    for (const [faceVertexA, faceVertexB, faceVertexC] of SubdividedIcosphereValue.tris) (SubdividedIcosphereValue.verts[faceVertexA][1] < cutoffHeight && SubdividedIcosphereValue.verts[faceVertexB][1] < cutoffHeight && SubdividedIcosphereValue.verts[faceVertexC][1] < cutoffHeight) || blobMeshBuilder.tri(baseVertexCount + faceVertexA, baseVertexCount + faceVertexB, baseVertexCount + faceVertexC)
  }
}

/**
 * 创建路径。
 *
 * @param builder - 构建器
 * @param pathPoints - 次要输入
 * @param tubeStyle - 第三输入
 */
function buildTubeAlongPath(builder, pathPoints, tubeStyle) {
  const sideCount = tubeStyle.sides ?? 6,
    tubeRings = [],
    lengthValue = pathPoints.length
  for (let index = 0; index < lengthValue; index++) {
    const selectedT = pathPoints[index],
      prevPoint = pathPoints[Math.max(0, index - 1)],
      nextPoint = pathPoints[Math.min(lengthValue - 1, index + 1)]
    let tangentX = nextPoint[0] - prevPoint[0],
      tangentY = nextPoint[1] - prevPoint[1],
      tangentZ = nextPoint[2] - prevPoint[2]
    const distance = Math.hypot(tangentX, tangentY, tangentZ) || 1
    ;((tangentX /= distance), (tangentY /= distance), (tangentZ /= distance))
    let basisX = 1,
      basisY = 0,
      basisZ = 0
    Math.abs(tangentX) > 0.9 && ((basisX = 0), (basisZ = 1))
    const tangentDot = basisX * tangentX + basisY * tangentY + basisZ * tangentZ
    ;((basisX -= tangentX * tangentDot), (basisY -= tangentY * tangentDot), (basisZ -= tangentZ * tangentDot))
    const basisLength = Math.hypot(basisX, basisY, basisZ) || 1
    ;((basisX /= basisLength), (basisY /= basisLength), (basisZ /= basisLength))
    const perpX = tangentY * basisZ - tangentZ * basisY,
      perpY = tangentZ * basisX - tangentX * basisZ,
      perpZ = tangentX * basisY - tangentY * basisX,
      pathFraction = lengthValue > 1 ? index / (lengthValue - 1) : 0,
      lerp3Lerp3Result = lerp3(tubeStyle.c0, tubeStyle.c1, pathFraction),
      lerpScalarResult = lerpScalar(tubeStyle.sway0 ?? 0, tubeStyle.sway1 ?? 0, pathFraction),
      ringVertices = []
    for (let sideIndex = 0; sideIndex < sideCount; sideIndex++) {
      const ringAngle = (sideIndex / sideCount) * FULL_TURN_RADIANS,
        ringCos = Math.cos(ringAngle),
        ringSin = Math.sin(ringAngle),
        offsetX = basisX * ringCos + perpX * ringSin,
        offsetY = basisY * ringCos + perpY * ringSin,
        offsetZ = basisZ * ringCos + perpZ * ringSin
      ringVertices.push(builder.vertex(selectedT[0] + offsetX * selectedT[3], selectedT[1] + offsetY * selectedT[3], selectedT[2] + offsetZ * selectedT[3], lerp3Lerp3Result, offsetX, offsetY, offsetZ, lerpScalarResult, tubeStyle.glow ?? 0, 0, 1))
    }
    tubeRings.push(ringVertices)
  }
  for (let segmentIndex = 0; segmentIndex < lengthValue - 1; segmentIndex++)
    for (let quadSideIndex = 0; quadSideIndex < sideCount; quadSideIndex++) {
      const nextSideIndex = (quadSideIndex + 1) % sideCount
      builder.quad(tubeRings[segmentIndex][quadSideIndex], tubeRings[segmentIndex + 1][quadSideIndex], tubeRings[segmentIndex + 1][nextSideIndex], tubeRings[segmentIndex][nextSideIndex])
    }
  if (tubeStyle.cap) {
    const endPoint = pathPoints[lengthValue - 1],
      capCenterVertex = builder.vertex(endPoint[0], endPoint[1], endPoint[2], scale3(tubeStyle.c1, 1.08), 0, 1, 0, tubeStyle.sway1 ?? 0, tubeStyle.glow ?? 0, 0, 1)
    for (let capSideIndex = 0; capSideIndex < sideCount; capSideIndex++) builder.tri(tubeRings[lengthValue - 1][capSideIndex], capCenterVertex, tubeRings[lengthValue - 1][(capSideIndex + 1) % sideCount])
  }
}

function buildCrystalShard(crystalMeshBuilder, crystalX, crystalY, crystalZ, shardHeight, shardRadius, rotationX, rotationZ, shardBaseColor, shardTipColor, shardGlow, shardSeed) {
  const setPositionResult = new Matrix4().makeRotationFromEuler(new Euler(rotationX, hashNoise2D(shardSeed, 3, 9) * FULL_TURN_RADIANS, rotationZ)).setPosition(crystalX, crystalY, crystalZ),
    scratchVector = new Vector3(),
    transformPoint = (localX, localY, localZ) => (scratchVector.set(localX, localY, localZ).applyMatrix4(setPositionResult), [scratchVector.x, scratchVector.y, scratchVector.z]),
    upperRingY = shardHeight * 0.72,
    lowerRing = [],
    upperRing = []
  for (let lookupKey = 0; lookupKey < 6; lookupKey++) {
    const shardRingAngle = (lookupKey / 6) * FULL_TURN_RADIANS
    ;(lowerRing.push(transformPoint(Math.cos(shardRingAngle) * shardRadius * 0.75, -0.15, Math.sin(shardRingAngle) * shardRadius * 0.75)), upperRing.push(transformPoint(Math.cos(shardRingAngle) * shardRadius, upperRingY, Math.sin(shardRingAngle) * shardRadius)))
  }
  const xResult = transformPoint(0, shardHeight, 0),
    distance = /**
 * 处理距离。
 *
 * @param crystalVertexA - 主要输入
 * @param crystalVertexB - 输入
 * @param crystalVertexC - 第三输入
 * @param crystalColorA - 第四输入
 * @param crystalColorB - 附加输入
 * @param crystalColorC - 附加输入
 * @param crystalGlowStrength - 输入
 */
(crystalVertexA, crystalVertexB, crystalVertexC, crystalColorA, crystalColorB, crystalColorC, crystalGlowStrength) => {
      const edgeBAx = crystalVertexB[0] - crystalVertexA[0],
        edgeBAy = crystalVertexB[1] - crystalVertexA[1],
        edgeBAz = crystalVertexB[2] - crystalVertexA[2],
        edgeCAx = crystalVertexC[0] - crystalVertexA[0],
        edgeCAy = crystalVertexC[1] - crystalVertexA[1],
        edgeCAz = crystalVertexC[2] - crystalVertexA[2]
      let crystalNormalX = edgeBAy * edgeCAz - edgeBAz * edgeCAy,
        crystalNormalY = edgeBAz * edgeCAx - edgeBAx * edgeCAz,
        crystalNormalZ = edgeBAx * edgeCAy - edgeBAy * edgeCAx
      const distance = Math.hypot(crystalNormalX, crystalNormalY, crystalNormalZ) || 1
      ;((crystalNormalX /= distance), (crystalNormalY /= distance), (crystalNormalZ /= distance))
      const crystalHandleA = crystalMeshBuilder.vertex(crystalVertexA[0], crystalVertexA[1], crystalVertexA[2], crystalColorA, crystalNormalX, crystalNormalY, crystalNormalZ, 0, crystalGlowStrength * 0.55, 0, 1),
        crystalHandleB = crystalMeshBuilder.vertex(crystalVertexB[0], crystalVertexB[1], crystalVertexB[2], crystalColorB, crystalNormalX, crystalNormalY, crystalNormalZ, 0, crystalGlowStrength, 0, 1),
        crystalHandleC = crystalMeshBuilder.vertex(crystalVertexC[0], crystalVertexC[1], crystalVertexC[2], crystalColorC, crystalNormalX, crystalNormalY, crystalNormalZ, 0, crystalGlowStrength, 0, 1)
      crystalMeshBuilder.tri(crystalHandleA, crystalHandleB, crystalHandleC)
    }
  for (let facetIndex = 0; facetIndex < 6; facetIndex++) {
    const nextFacetIndex = (facetIndex + 1) % 6,
      facetBrightness = 0.8 + hashNoise2D(facetIndex, shardSeed, 17) * 0.4,
      scale3Result = scale3(shardBaseColor, facetBrightness),
      scale3Scale3Result = scale3(shardTipColor, facetBrightness)
    ;(distance(lowerRing[facetIndex], upperRing[facetIndex], upperRing[nextFacetIndex], scale3Result, scale3Scale3Result, scale3Scale3Result, shardGlow), distance(lowerRing[facetIndex], upperRing[nextFacetIndex], lowerRing[nextFacetIndex], scale3Result, scale3Scale3Result, scale3Result, shardGlow), distance(upperRing[facetIndex], xResult, upperRing[nextFacetIndex], scale3Scale3Result, scale3(shardTipColor, 1.25), scale3Scale3Result, shardGlow))
  }
}

const FULL_REVOLUTION_RADIANS = Math.PI * 2,
  TEAM_GATE_PALETTES = [
    {
      stone: colorToRgb(ARENA_PALETTE.blue.stone),
      stoneDark: colorToRgb(ARENA_PALETTE.blue.stoneDark),
      trim: colorToRgb(ARENA_PALETTE.blue.trim),
      glow: colorToRgb(ARENA_PALETTE.blue.glow),
      crystal: [scale3(colorToRgb(ARENA_PALETTE.blue.glow), 0.7), lerp3(colorToRgb(ARENA_PALETTE.blue.glow), [1, 1, 1], 0.35)],
      crystalTint: colorToRgb(ARENA_PALETTE.blue.glow),
      crystalGlow: 1,
      cloth: colorToRgb(3108832),
    },
    {
      stone: colorToRgb(6969954),
      stoneDark: colorToRgb(ARENA_PALETTE.red.stoneDark),
      trim: colorToRgb(ARENA_PALETTE.red.trim),
      glow: colorToRgb(ARENA_PALETTE.red.glow),
      crystal: [colorToRgb(14039574), colorToRgb(15882790)],
      crystalTint: colorToRgb(15222814),
      crystalGlow: 0.4,
      cloth: colorToRgb(14169388),
    },
  ],
  SCRATCH_GATE_MATRIX = new Matrix4()

function buildGatePillar(gatePalette) {
  const pillarMeshBuilder = new MeshBuilder(),
    darkStoneColor = gatePalette.stoneDark,
    stoneColor = gatePalette.stone
  buildTubeAlongPath(
    pillarMeshBuilder,
    [
      [0, -0.2, 0, 0.92],
      [0, 0.45, 0, 0.92],
      [0, 0.55, 0, 0.78],
      [0, 0.8, 0, 0.78],
      [0, 0.9, 0, 0.62],
      [0, 3.1, 0, 0.54],
      [0, 3.22, 0, 0.72],
      [0, 3.5, 0, 0.76],
      [0, 3.6, 0, 0.6],
    ],
    { sides: 4, c0: darkStoneColor, c1: stoneColor, cap: !0 },
  )
  for (const ringHeight of [1.25, 2.75])
    buildTubeAlongPath(
      pillarMeshBuilder,
      [
        [0, ringHeight, 0, 0.64],
        [0, ringHeight + 0.14, 0, 0.63],
      ],
      { sides: 4, c0: gatePalette.trim, c1: scale3(gatePalette.trim, 1.15) },
    )
  for (let index = 0; index < 4; index++) {
    const pillarRingAngle = (index / 4) * FULL_REVOLUTION_RADIANS + Math.PI / 4,
      pillarRingCos = Math.cos(pillarRingAngle),
      pillarRingSin = Math.sin(pillarRingAngle),
      ringRadius = 0.415,
      trimThickness = 0.05,
      trimOffsetX = -pillarRingSin * trimThickness,
      trimOffsetZ = pillarRingCos * trimThickness,
      pillarGlowColor = gatePalette.glow,
      ringVertexBottomA = pillarMeshBuilder.vertex(pillarRingCos * ringRadius - trimOffsetX, 1.55, pillarRingSin * ringRadius - trimOffsetZ, pillarGlowColor, pillarRingCos, 0, pillarRingSin, 0, 0.35),
      ringVertexBottomB = pillarMeshBuilder.vertex(pillarRingCos * ringRadius + trimOffsetX, 1.55, pillarRingSin * ringRadius + trimOffsetZ, pillarGlowColor, pillarRingCos, 0, pillarRingSin, 0, 0.35),
      ringVertexTopB = pillarMeshBuilder.vertex(pillarRingCos * (ringRadius - 0.02) + trimOffsetX, 2.6, pillarRingSin * (ringRadius - 0.02) + trimOffsetZ, pillarGlowColor, pillarRingCos, 0, pillarRingSin, 0, 0.35),
      ringVertexTopA = pillarMeshBuilder.vertex(pillarRingCos * (ringRadius - 0.02) - trimOffsetX, 2.6, pillarRingSin * (ringRadius - 0.02) - trimOffsetZ, pillarGlowColor, pillarRingCos, 0, pillarRingSin, 0, 0.35)
    pillarMeshBuilder.quad(ringVertexBottomA, ringVertexBottomB, ringVertexTopB, ringVertexTopA)
  }
  for (let crystalIndex = 0; crystalIndex < 4; crystalIndex++) {
    const crystalAngle = (crystalIndex / 4) * FULL_REVOLUTION_RADIANS
    buildCrystalShard(pillarMeshBuilder, Math.cos(crystalAngle) * 0.5, 3.55, Math.sin(crystalAngle) * 0.5, 0.38, 0.09, 0, 0, gatePalette.trim, scale3(gatePalette.trim, 1.2), 0.1, crystalIndex)
  }
  return pillarMeshBuilder.build()
}

function buildGateCrystal(crystalPalette) {
  const meshBuilder = new MeshBuilder()
  return (
    buildCrystalShard(meshBuilder, 0, 4, 0, 1.15, 0.26, 0, 0, crystalPalette.crystal[0], crystalPalette.crystal[1], crystalPalette.crystalGlow, 3),
    buildCrystalShard(meshBuilder, 0, 4.05, 0, 0.5, 0.26, Math.PI, 0, crystalPalette.crystal[0], lerp3(crystalPalette.crystal[0], crystalPalette.crystal[1], 0.6), crystalPalette.crystalGlow, 4),
    meshBuilder.build()
  )
}

function buildMerlon(merlonPalette) {
  const merlonMeshBuilder = new MeshBuilder()
  return (
    SCRATCH_GATE_MATRIX.identity(),
    buildTaperedFrustum(merlonMeshBuilder, SCRATCH_GATE_MATRIX, 0.95, 0.6, 0.62, 0.02, merlonPalette.stone, lerp3(merlonPalette.stoneDark, merlonPalette.stone, 0.5)),
    SCRATCH_GATE_MATRIX.makeTranslation(0, 0.62, 0),
    buildTaperedFrustum(merlonMeshBuilder, SCRATCH_GATE_MATRIX, 1.05, 0.7, 0.12, 0.03, lerp3(merlonPalette.stone, [1, 1, 1], 0.12), merlonPalette.stone),
    merlonMeshBuilder.build()
  )
}

function buildWallEmblem(emblemPalette, isAwayTeam) {
  const emblemMeshBuilder = new MeshBuilder(),
    emblemRadius = 0.85,
    emblemSegments = 16,
    emblemCenterVertex = emblemMeshBuilder.vertex(0.1, 0, 0, emblemPalette.stone, 1, 0, 0),
    emblemOuterRing = [],
    emblemInnerRing = []
  for (let index = 0; index < emblemSegments; index++) {
    const emblemAngle = (index / emblemSegments) * FULL_REVOLUTION_RADIANS
    ;(emblemOuterRing.push(emblemMeshBuilder.vertex(0.1, Math.sin(emblemAngle) * emblemRadius * 0.9, Math.cos(emblemAngle) * emblemRadius * 0.9, lerp3(emblemPalette.stoneDark, emblemPalette.stone, 0.7), 1, 0, 0)),
      emblemInnerRing.push(emblemMeshBuilder.vertex(0, Math.sin(emblemAngle) * emblemRadius, Math.cos(emblemAngle) * emblemRadius, emblemPalette.stoneDark, 0.5, Math.sin(emblemAngle) * 0.86, Math.cos(emblemAngle) * 0.86)))
  }
  for (let emblemSegIndex = 0; emblemSegIndex < emblemSegments; emblemSegIndex++) {
    const nextSegmentIndex = (emblemSegIndex + 1) % emblemSegments
    ;(emblemMeshBuilder.tri(emblemCenterVertex, emblemOuterRing[emblemSegIndex], emblemOuterRing[nextSegmentIndex]), emblemMeshBuilder.quad(emblemOuterRing[emblemSegIndex], emblemInnerRing[emblemSegIndex], emblemInnerRing[nextSegmentIndex], emblemOuterRing[nextSegmentIndex]))
  }
  const emblemTrimColor = lerp3(emblemPalette.glow, emblemPalette.trim, 0.25),
    emblemBarDepth = 0.115,
    distance = /**
 * 处理距离。
 *
 * @param outlinePoints - 主要输入
 * @param outlineWidth - 输入
 * @param outlineFillMode - 第三输入
 */
(outlinePoints, outlineWidth, outlineFillMode?) => {
      const outlinePointCount = outlinePoints.length
      for (let index = 0; index < outlinePointCount; index++) {
        const [outlinePointX, outlinePointZ] = outlinePoints[index],
          [outlineNextX, outlineNextZ] = outlinePoints[(index + 1) % outlinePointCount],
          outlineEdgeX = outlineNextX - outlinePointX,
          outlineEdgeZ = outlineNextZ - outlinePointZ,
          distance = Math.hypot(outlineEdgeX, outlineEdgeZ) || 1,
          outlineNormalX = (-outlineEdgeZ / distance) * outlineWidth,
          outlineNormalZ = (outlineEdgeX / distance) * outlineWidth,
          outlineVertexA = emblemMeshBuilder.vertex(emblemBarDepth, outlinePointX - outlineNormalX, outlinePointZ - outlineNormalZ, emblemTrimColor, 1, 0, 0, 0, 0.4),
          outlineVertexB = emblemMeshBuilder.vertex(emblemBarDepth, outlinePointX + outlineNormalX, outlinePointZ + outlineNormalZ, emblemTrimColor, 1, 0, 0, 0, 0.4),
          outlineVertexC = emblemMeshBuilder.vertex(emblemBarDepth, outlineNextX + outlineNormalX, outlineNextZ + outlineNormalZ, emblemTrimColor, 1, 0, 0, 0, 0.4),
          outlineVertexD = emblemMeshBuilder.vertex(emblemBarDepth, outlineNextX - outlineNormalX, outlineNextZ - outlineNormalZ, emblemTrimColor, 1, 0, 0, 0, 0.4)
        ;(emblemMeshBuilder.quad(outlineVertexA, outlineVertexB, outlineVertexC, outlineVertexD), emblemMeshBuilder.quad(outlineVertexD, outlineVertexC, outlineVertexB, outlineVertexA))
      }
    },
    decorRingPoints = []
  for (let decorRingIndex = 0; decorRingIndex < 20; decorRingIndex++) {
    const decorRingAngle = (decorRingIndex / 20) * FULL_REVOLUTION_RADIANS
    decorRingPoints.push([Math.sin(decorRingAngle) * emblemRadius * 0.72, Math.cos(decorRingAngle) * emblemRadius * 0.72])
  }
  if ((distance(decorRingPoints, 0.03), isAwayTeam))
    for (const petalIndex of [-1, 0, 1]) {
      const petalWidth = petalIndex === 0 ? 0.56 : 0.4,
        petalOffset = petalIndex * 0.26,
        petalBaseX = -0.34
      distance(
        [
          [petalBaseX, petalOffset - 0.13],
          [petalBaseX + petalWidth * 0.45, petalOffset - 0.15 + petalIndex * 0.03],
          [petalBaseX + petalWidth, petalOffset + petalIndex * 0.06],
          [petalBaseX + petalWidth * 0.5, petalOffset + 0.13 + petalIndex * 0.03],
          [petalBaseX, petalOffset + 0.13],
        ],
        0.028,
      )
    }
  else {
    const starRingPoints = []
    for (let starRingIndex = 0; starRingIndex < 16; starRingIndex++) {
      const starRingAngle = (starRingIndex / 16) * FULL_REVOLUTION_RADIANS,
        starRadius = emblemRadius * (starRingIndex % 2 === 0 ? 0.6 : 0.27)
      starRingPoints.push([Math.cos(starRingAngle) * starRadius, Math.sin(starRingAngle) * starRadius])
    }
    distance(starRingPoints, 0.03)
  }
  return emblemMeshBuilder.build()
}

function buildLowLamp(lampPalette) {
  const lampMeshBuilder = new MeshBuilder()
  return (
    buildTubeAlongPath(
      lampMeshBuilder,
      [
        [0, -0.05, 0, 0.2],
        [0, 0.1, 0, 0.2],
        [0, 0.14, 0, 0.13],
        [0, 0.22, 0, 0.11],
        [0, 0.26, 0, 0.16],
      ],
      { sides: 8, c0: lampPalette.stoneDark, c1: lampPalette.stone, cap: !0 },
    ),
    buildPuffedBlobMesh(lampMeshBuilder, 0, 0.32, 0, 0.075, 0.09, 0.075, { detail: 0, seed: 5, bottom: lampPalette.glow, top: lerp3(lampPalette.glow, [1, 1, 1], 0.5), glow: 1 }),
    lampMeshBuilder.build()
  )
}

/**
 * 创建阵营。
 *
 * @param teamIndex - 来源
 * @returns 结果对象
 */
function buildTeamGateKit(teamIndex) {
  const selectedTEAM_GATE_PALETTES = TEAM_GATE_PALETTES[teamIndex],
    gatePillarConfig = { gatePillar: buildGatePillar(selectedTEAM_GATE_PALETTES), gateCrystal: buildGateCrystal(selectedTEAM_GATE_PALETTES), merlon: buildMerlon(selectedTEAM_GATE_PALETTES), buttress: buildButtress(selectedTEAM_GATE_PALETTES), emblem: buildWallEmblem(selectedTEAM_GATE_PALETTES, teamIndex === 1), lowLamp: buildLowLamp(selectedTEAM_GATE_PALETTES) }
  return { ...gatePillarConfig, dispose: () => Object.values(gatePillarConfig).forEach((gatePart) => gatePart.dispose()) }
}

function addBrazierAssembly(parentGroup, brazierKit, brazierPalette, brazierX, brazierY, brazierZ, brazierScale, glowEmitterList, particleEmitterList) {
  ;(parentGroup.add(brazierKit.brazier, composeMatrixTRS(brazierX, brazierY, brazierZ, 0.4, brazierScale), { tint: brazierPalette.stone }),
    parentGroup.add(brazierKit.brazierCrystal, composeMatrixTRS(brazierX, brazierY, brazierZ, 0.9, brazierScale), { tint: brazierPalette.crystalTint, glow: brazierPalette.crystalGlow }),
    glowEmitterList.glows.push({ x: brazierX, z: brazierZ, y: brazierY + 0.06, r: 2.6 * brazierScale, color: brazierPalette.glow }),
    particleEmitterList.push({ x: brazierX, y: brazierY + 2.2 * brazierScale, z: brazierZ, radius: 0.5, color: brazierPalette.glow, count: 3, mode: 1, range: 1.6, size: 0.8 }))
}

function buildFountainRing(fountainBuilder, fountainX, fountainZ, fountainRadius, fountainPalette, mapBound) {
  const atResult = fountainBuilder.at(fountainX, fountainZ, !1),
    ringSegments = 40,
    innerRadius = fountainRadius * 0.875,
    outerRadius = fountainRadius * 0.985,
    bevelWidth = 0.1,
    lightStoneColor = lerp3(fountainPalette.stone, [1, 1, 1], 0.06),
    ringDarkStoneColor = fountainPalette.stoneDark
  for (let index = 0; index < ringSegments; index++) {
    const segmentStartAngle = (index / ringSegments) * Math.PI * 2,
      segmentEndAngle = ((index + 1) / ringSegments) * Math.PI * 2,
      segmentMidAngle = (segmentStartAngle + segmentEndAngle) / 2,
      startCos = Math.cos(segmentStartAngle),
      startSin = Math.sin(segmentStartAngle),
      endCos = Math.cos(segmentEndAngle),
      endSin = Math.sin(segmentEndAngle)
    if (Math.max(Math.abs(fountainX + Math.cos(segmentMidAngle) * outerRadius), Math.abs(fountainZ + Math.sin(segmentMidAngle) * outerRadius)) > mapBound - 0.05) continue
    const stoneVariation = 0.92 + ((index * 7) % 5) * 0.03,
      variedStoneColor = scale3(lightStoneColor, stoneVariation),
      angleInset = 0.012,
      makeRingVertex = (towersDestroyed, ringCosFactor, ringSinFactor, vertexHeightY, vertexColor, vertexNormalX, vertexNormalY, vertexNormalZ) => atResult.vertex(fountainX + ringCosFactor * towersDestroyed, vertexHeightY, fountainZ + ringSinFactor * towersDestroyed, vertexColor, vertexNormalX, vertexNormalY, vertexNormalZ),
      innerStartCos = Math.cos(segmentStartAngle + angleInset),
      innerStartSin = Math.sin(segmentStartAngle + angleInset),
      innerEndCos = Math.cos(segmentEndAngle - angleInset),
      innerEndSin = Math.sin(segmentEndAngle - angleInset)
    atResult.quad(makeRingVertex(innerRadius + 0.02, innerStartCos, innerStartSin, bevelWidth, variedStoneColor, 0, 1, 0), makeRingVertex(innerRadius + 0.02, innerEndCos, innerEndSin, bevelWidth, variedStoneColor, 0, 1, 0), makeRingVertex(outerRadius - 0.02, innerEndCos, innerEndSin, bevelWidth, variedStoneColor, 0, 1, 0), makeRingVertex(outerRadius - 0.02, innerStartCos, innerStartSin, bevelWidth, variedStoneColor, 0, 1, 0))
    const midCos = Math.cos(segmentMidAngle),
      midSin = Math.sin(segmentMidAngle)
    ;(atResult.quad(makeRingVertex(outerRadius, startCos, startSin, -0.02, ringDarkStoneColor, midCos, 0.3, midSin), makeRingVertex(outerRadius - 0.02, startCos, startSin, bevelWidth, variedStoneColor, midCos, 0.3, midSin), makeRingVertex(outerRadius - 0.02, endCos, endSin, bevelWidth, variedStoneColor, midCos, 0.3, midSin), makeRingVertex(outerRadius, endCos, endSin, -0.02, ringDarkStoneColor, midCos, 0.3, midSin)),
      atResult.quad(makeRingVertex(innerRadius, endCos, endSin, -0.02, ringDarkStoneColor, -midCos, 0.3, -midSin), makeRingVertex(innerRadius + 0.02, endCos, endSin, bevelWidth, variedStoneColor, -midCos, 0.3, -midSin), makeRingVertex(innerRadius + 0.02, startCos, startSin, bevelWidth, variedStoneColor, -midCos, 0.3, -midSin), makeRingVertex(innerRadius, startCos, startSin, -0.02, ringDarkStoneColor, -midCos, 0.3, -midSin)))
  }
}

function buildBaseDecorations(decorationsRoot, decorKit, guardKit, bushMap, terrainSampler, decorPolygons, decorGlowList, occupiedAreaTracker, decorParticleList, pillarMarkerList) {
  const battleMap = bushMap.map,
    mapHalfSize = battleMap.bound,
    teamGateKits = [buildTeamGateKit(0), buildTeamGateKit(1)]
  for (const base of battleMap.bases) {
    const basePalette = TEAM_GATE_PALETTES[base.team],
      selectedH = teamGateKits[base.team],
      baseRandom = new FastRandom(600 + base.team),
      mapEdges = [
        { ax: -mapHalfSize, az: -mapHalfSize, dx: 0, dz: 1, nx: -1, nz: 0 },
        { ax: -mapHalfSize, az: mapHalfSize, dx: 1, dz: 0, nx: 0, nz: 1 },
        { ax: mapHalfSize, az: mapHalfSize, dx: 0, dz: -1, nx: 1, nz: 0 },
        { ax: mapHalfSize, az: -mapHalfSize, dx: -1, dz: 0, nx: 0, nz: -1 },
      ]
    for (const mapEdge of mapEdges) {
      const isEdgePositionValid = (deaths, checkPosZ) => bushMap.baseDist(deaths - mapEdge.nx * 0.6, checkPosZ - mapEdge.nz * 0.6) < -0.5 && (base.team === 0 ? deaths - checkPosZ < 0 : deaths - checkPosZ > 0),
        vectorToAngleResult = vectorToAngle(-mapEdge.nx, -mapEdge.nz)
      for (let total = 0.9; total < mapHalfSize * 2 - 0.5; total += 1.45) {
        const merlonX = mapEdge.ax + mapEdge.dx * total,
          merlonZ = mapEdge.az + mapEdge.dz * total
        if (!isEdgePositionValid(merlonX, merlonZ) || terrainSampler.southWeight(merlonX, merlonZ) > 0.3) continue
        const ledgeOffset = GRID_A_LEDGE_HEIGHT + 0.42
        decorationsRoot.add(selectedH.merlon, composeMatrixTRS(merlonX + mapEdge.nx * ledgeOffset, GRID_A_PLATEAU_EDGE_HEIGHT - 0.04, merlonZ + mapEdge.nz * ledgeOffset, vectorToAngleResult + Math.PI / 2, 1, baseRandom.range(0.92, 1.08)), { tint: scale3([1, 1, 1], baseRandom.range(0.92, 1.04)) })
      }
      let placementIndex = 0
      for (let edgeDistance = 2.2; edgeDistance < mapHalfSize * 2 - 1; edgeDistance += 3) {
        const edgePosX = mapEdge.ax + mapEdge.dx * edgeDistance,
          edgePosZ = mapEdge.az + mapEdge.dz * edgeDistance
        if (!isEdgePositionValid(edgePosX, edgePosZ)) continue
        const southWeightResult = terrainSampler.southWeight(edgePosX, edgePosZ)
        if ((placementIndex++, southWeightResult > 0.55)) {
          placementIndex % 3 === 0 && addBrazierAssembly(decorationsRoot, decorKit, basePalette, edgePosX + mapEdge.nx * 0.3, 0.38, edgePosZ + mapEdge.nz * 0.3, 0.5, decorGlowList, decorParticleList)
          continue
        }
        if (southWeightResult > 0.3) continue
        const structureX = edgePosX + mapEdge.nx * GRID_A_LEDGE_HEIGHT,
          structureZ = edgePosZ + mapEdge.nz * GRID_A_LEDGE_HEIGHT
        placementIndex % 2 === 0 ? decorationsRoot.add(selectedH.buttress, composeMatrixTRS(structureX, 0.1, structureZ, vectorToAngleResult, 1, (GRID_A_PLATEAU_EDGE_HEIGHT - 0.25) / 2.4), {}) : placementIndex % 4 === 1 && decorationsRoot.add(selectedH.emblem, composeMatrixTRS(structureX - mapEdge.nx * 0.02, GRID_A_PLATEAU_EDGE_HEIGHT * 0.56, structureZ - mapEdge.nz * 0.02, vectorToAngleResult, 1), { glow: 1 })
        const fixtureX = edgePosX + mapEdge.nx * 1.9,
          fixtureZ = edgePosZ + mapEdge.nz * 1.9,
          fixtureHeight = terrainSampler.heightAt(fixtureX, fixtureZ) - 0.05
        placementIndex % 4 === 2
          ? addBrazierAssembly(decorationsRoot, decorKit, basePalette, fixtureX, fixtureHeight, fixtureZ, 1, decorGlowList, decorParticleList)
          : placementIndex % 4 === 0 && decorationsRoot.add(decorKit.banner, composeMatrixTRS(fixtureX, fixtureHeight, fixtureZ, vectorToAngleResult + Math.PI / 2 + baseRandom.range(-0.12, 0.12), 1.05, baseRandom.range(1, 1.2)), { tint: basePalette.cloth, maskedTint: !0 })
      }
    }
    const coordX = base.fountain.x,
      coordY = base.fountain.y,
      baseFountainRadius = base.fountainRadius
    buildFountainRing(decorationsRoot, coordX, coordY, baseFountainRadius, basePalette, mapHalfSize)
    for (let index = 0; index < 4; index++) {
      const lampAngle = Math.PI / 4 + (index / 4) * Math.PI * 2,
        lampX = coordX + Math.cos(lampAngle) * baseFountainRadius * 0.93,
        lampZ = coordY + Math.sin(lampAngle) * baseFountainRadius * 0.93
      Math.max(Math.abs(lampX), Math.abs(lampZ)) > mapHalfSize - 0.3 || decorationsRoot.add(selectedH.lowLamp, composeMatrixTRS(lampX, 0.08, lampZ, lampAngle, 1), { shadow: !1, glow: 1 })
    }
    ;(pillarMarkerList.push({ kind: "pillar", x: coordX, y: 0.05, z: coordY, width: 2.6, length: 6, color: basePalette.glow, alpha: 0.08 }), occupiedAreaTracker.reserve(coordX, coordY))
    const signResult = Math.sign(coordX),
      fountainYSign = Math.sign(coordY)
    for (const watcherSide of [-1, 1]) {
      const watcherX = signResult * (mapHalfSize + 2.1) - (watcherSide < 0 ? signResult * 5.2 : 0),
        watcherZ = fountainYSign * (mapHalfSize + 2.1) - (watcherSide > 0 ? fountainYSign * 5.2 : 0)
      if (terrainSampler.southWeight(watcherX, watcherZ) > 0.3) continue
      const watcherHeight = terrainSampler.heightAt(watcherX, watcherZ) - 0.05
      decorationsRoot.add(guardKit.watcher, composeMatrixTRS(watcherX, watcherHeight, watcherZ, vectorToAngle(coordX - watcherX, coordY - watcherZ), 1.25), { tint: lerp3(basePalette.stone, [1, 1, 1], 0.3) })
    }
    const bigCrystalX = signResult * (mapHalfSize + 3.4),
      bigCrystalZ = fountainYSign * (mapHalfSize + 3.4),
      bigCrystalSouthWeight = terrainSampler.southWeight(bigCrystalX, bigCrystalZ),
      bigCrystalHeight = terrainSampler.heightAt(bigCrystalX, bigCrystalZ) - 0.3,
      crystalScale = bigCrystalSouthWeight > 0.5 ? 1.5 : 2.3
    ;(decorationsRoot.add(decorKit.bigCrystals[base.team % decorKit.bigCrystals.length], composeMatrixTRS(bigCrystalX, bigCrystalHeight, bigCrystalZ, 0.7, crystalScale), { tint: basePalette.crystalTint, glow: basePalette.crystalGlow }),
      decorGlowList.glows.push({ x: bigCrystalX, z: bigCrystalZ, y: bigCrystalHeight + 0.4, r: 7, color: basePalette.glow }),
      decorParticleList.push({ x: bigCrystalX, y: bigCrystalHeight + 1, z: bigCrystalZ, radius: 2.4, color: basePalette.glow, count: 12, mode: 1, range: 5, size: 1.1 }),
      decorParticleList.push({ x: coordX, y: 0.1, z: coordY, radius: baseFountainRadius * 0.82, color: basePalette.glow, count: 40, mode: 1, range: 3.4, size: 1 }),
      decorParticleList.push({ x: base.core.x, y: 0.2, z: base.core.y, radius: 5.5, color: basePalette.glow, count: 16, mode: 1, range: 2.6, size: 0.8 }))
  }
  ;(decorPolygons.forEach((decorationPolygon, polygonIndex) => {
    const polygonCentroidResult = polygonCentroid(decorationPolygon.poly),
      polygonTeam = polygonCentroidResult.x - polygonCentroidResult.y < 0 ? 0 : 1,
      polygonPalette = TEAM_GATE_PALETTES[polygonTeam],
      polygonGateKit = teamGateKits[polygonTeam],
      fastRandom = new FastRandom(900 + polygonIndex)
    for (const polyVertex of decorationPolygon.poly) {
      if (bushMap.baseDist(polyVertex.x, polyVertex.y, 12) > 6.5) continue
      const centroidOffsetX = polygonCentroidResult.x - polyVertex.x,
        centroidOffsetZ = polygonCentroidResult.y - polyVertex.y,
        centroidDistance = Math.hypot(centroidOffsetX, centroidOffsetZ) || 1,
        gateOffsetDistance = 1.55,
        gateX = polyVertex.x + (centroidOffsetX / centroidDistance) * gateOffsetDistance,
        gateZ = polyVertex.y + (centroidOffsetZ / centroidDistance) * gateOffsetDistance,
        gateHeight = decorationPolygon.height + fastRandom.range(1, 1.5),
        gateScale = gateHeight / 3.6,
        gateRotation = fastRandom.range(-0.1, 0.1) + Math.PI / 4
      ;(decorationsRoot.add(polygonGateKit.gatePillar, composeMatrixTRS(gateX, 0, gateZ, gateRotation, 1, gateScale), { tint: scale3([1, 1, 1], fastRandom.range(0.94, 1.03)), glow: 1 }),
        decorationsRoot.add(polygonGateKit.gateCrystal, composeMatrixTRS(gateX, gateHeight + 0.35 - 3.6, gateZ, gateRotation, 0.9), { glow: 1 }),
        decorationsRoot.add(guardKit.flag, composeMatrixTRS(gateX - (centroidOffsetX / centroidDistance) * 0.5, gateHeight - 1.9, gateZ - (centroidOffsetZ / centroidDistance) * 0.5, fastRandom.range(-0.3, 0.3), 1.05), { tint: polygonPalette.cloth, maskedTint: !0 }),
        occupiedAreaTracker.reserve(gateX, gateZ),
        decorGlowList.glows.push({ x: gateX, z: gateZ, y: decorationPolygon.topY(1.2) + 0.05, r: 2.4, color: polygonPalette.glow }),
        decorGlowList.aoBlobs.push({ x: gateX, y: decorationPolygon.topY(1.2) + 0.06, z: gateZ, r: 1.4, strength: 0.4 }),
        decorParticleList.push({ x: gateX, y: gateHeight + 0.6, z: gateZ, radius: 0.5, color: polygonPalette.glow, count: 3, mode: 1, range: 1.6, size: 0.8 }))
    }
  }),
    teamGateKits[0].dispose(),
    teamGateKits[1].dispose())
}

export { FULL_TURN_RADIANS, buildPuffedBlobMesh, buildCrystalShard, buildTubeAlongPath, buildBaseDecorations, getSubdividedIcosphere, buildTaperedFrustum }