/**
 * 场景装饰道具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { FastRandom } from '../render/foundation'
import { FULL_TURN_RADIANS, buildPuffedBlobMesh, buildCrystalShard, buildTubeAlongPath } from '../fx/fx-random'
import { colorToRgb, lerp3, lerpScalar, scale3 } from '../fx/particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { MeshBuilder } from '../render/buff-view'
import { MONSTER_KIND_INDEX, WATER_LEVEL, monsterRadius } from './map-geometry'
import { composeMatrixTRS, vectorToAngle } from './tf-system'
import { SCENERY_FOG_PALETTE } from '../sim/hero-engage'

function buildLobedBlobMesh(blobMesh, baseX, baseY, baseZ, blobRadius, unit) {
  const lobeCount = unit.lobes,
    blobRandom = new FastRandom(unit.seed * 31 + 7),
    puffRadius = (unit.thick ?? 0.42) * blobRadius,
    baseAngleOffset = blobRandom.range(0, FULL_TURN_RADIANS),
    tintJitterFactor = blobRandom.range(-0.06, 0.06),
    jitterTint = (cooldown, tintScale) => [cooldown[0] * tintScale * (1 + tintJitterFactor), cooldown[1] * tintScale, cooldown[2] * tintScale * (1 - tintJitterFactor)],
    bottomSway = unit.sway0 ?? 0.3,
    topSway = unit.sway1 ?? 0.7,
    distance = /**
 * 处理距离。
 *
 * @param offsetX - 主要输入
 * @param chest - 输入
 * @param offsetZ - 第三输入
 * @param vertexTint - 第四输入
 * @param normalX - 附加输入
 * @param normalY - 附加输入
 * @param normalZ - 输入
 * @param vertexSway - 附加输入
 */
(offsetX, chest, offsetZ, vertexTint, normalX, normalY, normalZ, vertexSway) => {
      let puffNormalX = normalX,
        normalYComponent = normalY,
        puffNormalZ = normalZ
      if (unit.puffCenter && unit.puff) {
        let puffDeltaX = baseX + offsetX - unit.puffCenter[0],
          puffDeltaY = baseY + chest - unit.puffCenter[1],
          puffDeltaZ = baseZ + offsetZ - unit.puffCenter[2]
        const distance = Math.hypot(puffDeltaX, puffDeltaY, puffDeltaZ) || 1
        ;((puffDeltaX /= distance), (puffDeltaY /= distance), (puffDeltaZ /= distance), (puffNormalX = lerpScalar(puffNormalX, puffDeltaX, unit.puff)), (normalYComponent = lerpScalar(normalYComponent, puffDeltaY, unit.puff)), (puffNormalZ = lerpScalar(puffNormalZ, puffDeltaZ, unit.puff)))
      }
      const normalLength = Math.hypot(puffNormalX, normalYComponent, puffNormalZ) || 1
      return blobMesh.vertex(baseX + offsetX, baseY + chest, baseZ + offsetZ, vertexTint, puffNormalX / normalLength, normalYComponent / normalLength, puffNormalZ / normalLength, vertexSway, 0, unit.team ?? 0, 1)
    },
    meshPositions = blobMesh.positions,
    emitTriangle = (firstVertex, secondVertex, thirdVertex, flipWinding) => {
      const edgeAX = meshPositions[secondVertex * 3] - meshPositions[firstVertex * 3],
        edgeAZ = meshPositions[secondVertex * 3 + 2] - meshPositions[firstVertex * 3 + 2],
        edgeBX = meshPositions[thirdVertex * 3] - meshPositions[firstVertex * 3],
        edgeBZ = meshPositions[thirdVertex * 3 + 2] - meshPositions[firstVertex * 3 + 2]
      edgeAZ * edgeBX - edgeAX * edgeBZ > 0 === flipWinding ? blobMesh.tri(firstVertex, secondVertex, thirdVertex) : blobMesh.tri(firstVertex, thirdVertex, secondVertex)
    },
    distanceResult = distance(blobRandom.range(-0.05, 0.05) * blobRadius, puffRadius, blobRandom.range(-0.05, 0.05) * blobRadius, jitterTint(unit.light, 1), 0, 1, 0, topSway),
    topVertices = [],
    midVertices = [],
    rimVertices = [],
    underVertices = []
  for (let index = 0; index < lobeCount; index++) {
    const lobeAngle = baseAngleOffset + (index / lobeCount) * FULL_TURN_RADIANS,
      lobeCosine = Math.cos(lobeAngle),
      lobeSine = Math.sin(lobeAngle),
      topLobeRadius = blobRadius * 0.42 * blobRandom.range(0.92, 1.08)
    topVertices.push(distance(lobeCosine * topLobeRadius, puffRadius * blobRandom.range(0.86, 0.94), lobeSine * topLobeRadius, jitterTint(lerp3(unit.mid, unit.light, 0.62), blobRandom.range(0.96, 1.04)), lobeCosine * 0.3, 0.95, lobeSine * 0.3, lerpScalar(bottomSway, topSway, 0.8)))
    const midLobeAngle = lobeAngle + Math.PI / lobeCount,
      midLobeCosine = Math.cos(midLobeAngle),
      midLobeSine = Math.sin(midLobeAngle),
      midLobeRadius = blobRadius * 0.78 * blobRandom.range(0.94, 1.06)
    midVertices.push(distance(midLobeCosine * midLobeRadius, puffRadius * blobRandom.range(0.52, 0.64), midLobeSine * midLobeRadius, jitterTint(unit.mid, blobRandom.range(0.94, 1.04)), midLobeCosine * 0.62, 0.78, midLobeSine * 0.62, lerpScalar(bottomSway, topSway, 0.45)))
  }
  for (let rimIndex = 0; rimIndex < lobeCount * 2; rimIndex++) {
    const rimAngle = baseAngleOffset + (rimIndex / (lobeCount * 2)) * FULL_TURN_RADIANS,
      isEvenRim = rimIndex % 2 === 0,
      rimRadius = blobRadius * (isEvenRim ? blobRandom.range(0.97, 1.05) : blobRandom.range(0.86, 0.9)),
      rimCosine = Math.cos(rimAngle),
      rimSine = Math.sin(rimAngle),
      rimOffsetY = puffRadius * (isEvenRim ? blobRandom.range(0.06, 0.14) : blobRandom.range(0.16, 0.24))
    ;(rimVertices.push(distance(rimCosine * rimRadius, rimOffsetY, rimSine * rimRadius, jitterTint(isEvenRim ? lerp3(unit.dark, unit.mid, 0.72) : lerp3(unit.dark, unit.mid, 0.4), 1), rimCosine * 0.86, 0.5, rimSine * 0.86, bottomSway)),
      underVertices.push(distance(rimCosine * rimRadius * 0.7, -puffRadius * 0.32, rimSine * rimRadius * 0.7, jitterTint(unit.dark, 0.7), rimCosine * 0.5, -0.85, rimSine * 0.5, bottomSway)))
  }
  for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex++) {
    const nextLobeIndex = (lobeIndex + 1) % lobeCount,
      prevLobeIndex = (lobeIndex + lobeCount - 1) % lobeCount
    ;(emitTriangle(distanceResult, topVertices[lobeIndex], topVertices[nextLobeIndex], !0), emitTriangle(topVertices[lobeIndex], midVertices[prevLobeIndex], midVertices[lobeIndex], !0), emitTriangle(topVertices[lobeIndex], midVertices[lobeIndex], topVertices[nextLobeIndex], !0))
    const evenRimIndex = lobeIndex * 2,
      oddRimIndex = lobeIndex * 2 + 1,
      nextEvenRimIndex = (lobeIndex * 2 + 2) % (lobeCount * 2)
    ;(emitTriangle(midVertices[lobeIndex], rimVertices[evenRimIndex], rimVertices[oddRimIndex], !0), emitTriangle(midVertices[lobeIndex], rimVertices[oddRimIndex], rimVertices[nextEvenRimIndex], !0), emitTriangle(midVertices[lobeIndex], rimVertices[nextEvenRimIndex], midVertices[nextLobeIndex], !0))
  }
  for (let underIndex = 0; underIndex < lobeCount * 2; underIndex++) {
    const nextUnderIndex = (underIndex + 1) % (lobeCount * 2)
    ;(emitTriangle(rimVertices[underIndex], rimVertices[nextUnderIndex], underVertices[nextUnderIndex], !1), emitTriangle(rimVertices[underIndex], underVertices[nextUnderIndex], underVertices[underIndex], !1))
  }
}

const SCENERY_FULL_TURN = Math.PI * 2,
  SCENERY_ENV_PALETTE = ARENA_PALETTE.env

function buildFrostBranch(branchSeed) {
  const fastRandom = new FastRandom(branchSeed),
    branchMesh = new MeshBuilder(),
    branchBaseColor = colorToRgb(5922674),
    branchTipColor = colorToRgb(14216447),
    branchHeight = fastRandom.range(1.3, 1.7),
    branchLean = fastRandom.range(-0.25, 0.25)
  buildTubeAlongPath(
    branchMesh,
    [
      [0, -0.15, 0, 0.12],
      [branchLean * 0.5, branchHeight * 0.55, 0.05, 0.08],
      [branchLean, branchHeight, 0.1, 0.04],
    ],
    { sides: 5, c0: scale3(branchBaseColor, 0.8), c1: lerp3(branchBaseColor, branchTipColor, 0.5) },
  )
  const twigCount = 3 + fastRandom.int(2)
  for (let index = 0; index < twigCount; index++) {
    const twigAngle = (index / twigCount) * SCENERY_FULL_TURN + fastRandom.range(-0.4, 0.4),
      twigHeight = branchHeight * fastRandom.range(0.4, 0.8),
      twigLength = fastRandom.range(0.45, 0.8),
      twigBaseX = branchLean * (twigHeight / branchHeight)
    ;(buildTubeAlongPath(
      branchMesh,
      [
        [twigBaseX, twigHeight, 0.05, 0.05],
        [twigBaseX + Math.cos(twigAngle) * twigLength * 0.6, twigHeight + twigLength * 0.45, Math.sin(twigAngle) * twigLength * 0.6, 0.03],
        [twigBaseX + Math.cos(twigAngle) * twigLength, twigHeight + twigLength * 0.8, Math.sin(twigAngle) * twigLength, 0.012],
      ],
      { sides: 3, c0: branchBaseColor, c1: branchTipColor },
    ),
      buildCrystalShard(branchMesh, twigBaseX + Math.cos(twigAngle) * twigLength, twigHeight + twigLength * 0.72, Math.sin(twigAngle) * twigLength, 0.2, 0.035, fastRandom.range(-0.4, 0.4), fastRandom.range(-0.4, 0.4), [0.6, 0.8, 1], [0.9, 0.97, 1], 0.5, branchSeed + index))
  }
  return branchMesh.build()
}

function buildCharredStump(stumpSeed) {
  const stumpRandom = new FastRandom(stumpSeed),
    meshBuilder = new MeshBuilder(),
    barkColor = colorToRgb(2761252),
    charColor = colorToRgb(5917770),
    stumpHeight = stumpRandom.range(0.7, 1.15)
  ;(buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.15, 0, 0.36],
      [0.02, stumpHeight * 0.4, 0, 0.27],
      [0.05, stumpHeight * 0.85, 0.02, 0.22],
      [0.1, stumpHeight, 0.06, 0.12],
    ],
    { sides: 7, c0: barkColor, c1: charColor },
  ),
    buildPuffedBlobMesh(meshBuilder, 0.05, stumpHeight * 0.86, 0.02, 0.17, 0.07, 0.17, { detail: 0, seed: stumpSeed, bottom: [1, 0.35, 0.08], top: [1, 0.62, 0.2], glow: 0.8 }))
  for (let index = 0; index < 2; index++) {
    const flameAngle = stumpRandom.range(0, SCENERY_FULL_TURN),
      flameSpread = 0.3,
      flameTip = 0.03,
      flameCosX = Math.cos(flameAngle) * flameSpread,
      flameSinZ = Math.sin(flameAngle) * flameSpread,
      flameTipX = -Math.sin(flameAngle) * flameTip,
      flameTipZ = Math.cos(flameAngle) * flameTip,
      flameColor = [1, 0.42, 0.1],
      vertexResult = meshBuilder.vertex(flameCosX - flameTipX, 0.08, flameSinZ - flameTipZ, flameColor, Math.cos(flameAngle), 0, Math.sin(flameAngle), 0, 0.9),
      flameBaseEndVertex = meshBuilder.vertex(flameCosX + flameTipX, 0.08, flameSinZ + flameTipZ, flameColor, Math.cos(flameAngle), 0, Math.sin(flameAngle), 0, 0.9),
      flameTipVertex = meshBuilder.vertex(flameCosX * 0.82, stumpHeight * 0.6, flameSinZ * 0.82, flameColor, Math.cos(flameAngle), 0, Math.sin(flameAngle), 0, 0.5)
    ;(meshBuilder.tri(vertexResult, flameBaseEndVertex, flameTipVertex), meshBuilder.tri(vertexResult, flameTipVertex, flameBaseEndVertex))
  }
  const rootBranchAngle = stumpRandom.range(0, SCENERY_FULL_TURN)
  return (
    buildTubeAlongPath(
      meshBuilder,
      [
        [0.05, stumpHeight * 0.7, 0, 0.07],
        [Math.cos(rootBranchAngle) * 0.4, stumpHeight * 0.95, Math.sin(rootBranchAngle) * 0.4, 0.03],
      ],
      { sides: 3, c0: barkColor, c1: charColor },
    ),
    meshBuilder.build()
  )
}

function buildVent(ventSeed) {
  const ventRandom = new FastRandom(ventSeed),
    ventMesh = new MeshBuilder(),
    ventBaseColor = colorToRgb(2365980),
    ventTipColor = colorToRgb(5913140)
  ;(buildTubeAlongPath(
    ventMesh,
    [
      [0, -0.06, 0, 0.42],
      [0, 0.14, 0, 0.3],
      [0, 0.26, 0, 0.19],
      [0, 0.2, 0, 0.13],
    ],
    { sides: 7, c0: ventBaseColor, c1: ventTipColor },
  ),
    buildPuffedBlobMesh(ventMesh, 0, 0.17, 0, 0.13, 0.04, 0.13, { detail: 0, seed: ventSeed, bottom: [1, 0.4, 0.1], top: [1, 0.75, 0.3], glow: 1 }))
  for (let index = 0; index < 3; index++) {
    const ventAngle = ventRandom.range(0, SCENERY_FULL_TURN)
    buildPuffedBlobMesh(ventMesh, Math.cos(ventAngle) * 0.4, 0.05, Math.sin(ventAngle) * 0.4, 0.13, 0.1, 0.11, { detail: 0, bump: 0.25, seed: ventSeed + index, bottom: ventBaseColor, top: ventTipColor, flat: !0 })
  }
  return ventMesh.build()
}

function buildLog(logSeed) {
  const logRandom = new FastRandom(logSeed),
    logMesh = new MeshBuilder(),
    logBaseColor = colorToRgb(5917242),
    logTipColor = colorToRgb(8022608),
    logLength = logRandom.range(1.9, 2.4),
    logRadius = 0.36
  buildTubeAlongPath(
    logMesh,
    [
      [-logLength / 2, logRadius * 0.9, 0, logRadius],
      [-logLength * 0.15, logRadius * 0.92, 0.04, logRadius * 0.96],
      [logLength * 0.2, logRadius * 0.88, -0.03, logRadius * 0.92],
      [logLength / 2, logRadius * 0.86, 0, logRadius * 0.86],
    ],
    { sides: 8, c0: logBaseColor, c1: logTipColor },
  )
  for (const logEnd of [-1, 1]) {
    const endOffsetX = (logEnd * logLength) / 2,
      endCapRadius = (logEnd < 0 ? logRadius : logRadius * 0.86) * 0.78,
      endCenterY = logEnd < 0 ? logRadius * 0.9 : logRadius * 0.86,
      endCenterVertex = logMesh.vertex(endOffsetX - logEnd * 0.12, endCenterY, 0, [0.03, 0.025, 0.02], logEnd, 0, 0),
      endRingVertices = []
    for (let index = 0; index < 8; index++) {
      const ringAngle = (index / 8) * SCENERY_FULL_TURN
      endRingVertices.push(logMesh.vertex(endOffsetX + logEnd * 0.005, endCenterY + Math.sin(ringAngle) * endCapRadius, Math.cos(ringAngle) * endCapRadius, [0.14, 0.11, 0.08], logEnd, 0, 0))
    }
    for (let ringIndex = 0; ringIndex < 8; ringIndex++) logEnd > 0 ? logMesh.tri(endCenterVertex, endRingVertices[ringIndex], endRingVertices[(ringIndex + 1) % 8]) : logMesh.tri(endCenterVertex, endRingVertices[(ringIndex + 1) % 8], endRingVertices[ringIndex])
  }
  return (
    buildPuffedBlobMesh(logMesh, logRandom.range(-0.4, 0.4), logRadius * 1.72, 0, 0.5, 0.09, 0.3, { detail: 0, bump: 0.2, seed: logSeed, bottom: colorToRgb(5212744), top: colorToRgb(9420632) }),
    buildPuffedBlobMesh(logMesh, logLength * 0.28, logRadius * 1.75, 0.06, 0.12, 0.07, 0.12, { detail: 0, seed: logSeed + 1, bottom: colorToRgb(12081198), top: colorToRgb(14711368) }),
    logMesh.build()
  )
}

function buildRootTangle(tangleSeed, tangleBaseY) {
  const tangleRandom = new FastRandom(tangleSeed),
    tangleMesh = new MeshBuilder(),
    rootTipColor = colorToRgb(4864556),
    rootBaseColor = colorToRgb(8020552),
    rootCount = 3
  for (let index = 0; index < rootCount; index++) {
    const rootSpanX = (index - 1) * tangleRandom.range(0.45, 0.7),
      rootEndX = rootSpanX + tangleRandom.range(-0.35, 0.35),
      rootThickness = tangleRandom.range(0.09, 0.14)
    buildTubeAlongPath(
      tangleMesh,
      [
        [-0.75, tangleBaseY + 0.05, rootSpanX * 0.6, rootThickness * 0.8],
        [-0.25, tangleBaseY + 0.22, rootSpanX * 0.8, rootThickness],
        [-0.02, tangleBaseY - 0.25, rootSpanX, rootThickness],
        [-0.08, tangleBaseY * 0.5, (rootSpanX + rootEndX) / 2, rootThickness * 0.9],
        [-0.05, 0.3, rootEndX, rootThickness * 0.8],
        [-0.02, -0.1, rootEndX + tangleRandom.range(-0.15, 0.15), rootThickness * 0.55],
      ],
      { sides: 5, c0: rootBaseColor, c1: rootTipColor },
    )
  }
  return tangleMesh.build()
}

function buildLampFlower(flowerSeed) {
  const flowerRandom = new FastRandom(flowerSeed),
    flowerMesh = new MeshBuilder(),
    petalColor = colorToRgb(4160072),
    stemHeight = flowerRandom.range(0.55, 0.8),
    stemX = 0.28
  buildTubeAlongPath(
    flowerMesh,
    [
      [0, -0.1, 0, 0.06],
      [0.08, stemHeight * 0.6, 0, 0.05],
      [stemX, stemHeight, 0, 0.04],
    ],
    { sides: 4, c0: scale3(petalColor, 0.7), c1: petalColor, sway1: 0.3 },
  )
  for (const petalSide of [-1, 1]) {
    const leafBaseVertex = flowerMesh.vertex(0, 0, 0, scale3(petalColor, 0.8), 0, 1, 0, 0),
      leafMidVertex = flowerMesh.vertex(0.1, 0.22, petalSide * 0.3, petalColor, 0, 1, 0, 0.3),
      leafTipVertex = flowerMesh.vertex(0.3, 0.1, petalSide * 0.42, colorToRgb(7317584), 0, 1, 0, 0.5)
    ;(flowerMesh.tri(leafBaseVertex, leafMidVertex, leafTipVertex), flowerMesh.tri(leafBaseVertex, leafTipVertex, leafMidVertex))
  }
  const petalRadius = 0.3,
    flowerCenterVertex = flowerMesh.vertex(stemX, stemHeight, 0, [0.85, 0.8, 0.7], 0.3, 1, 0, 0.4, 0.2, 1)
  for (let index = 0; index < 5; index++) {
    const petalAngle = (index / 5) * SCENERY_FULL_TURN + flowerSeed,
      petalArc = 0.5,
      petalVertex = (vertexAngle, vertexRadius, vertexHeight) => flowerMesh.vertex(stemX + Math.cos(vertexAngle) * vertexRadius, stemHeight + vertexHeight, Math.sin(vertexAngle) * vertexRadius, [1, 1, 1], Math.cos(vertexAngle) * 0.4, 0.9, Math.sin(vertexAngle) * 0.4, 0.5, 0.25, 1),
      dResult = petalVertex(petalAngle - petalArc, petalRadius * 0.62, 0.06),
      dDResult = petalVertex(petalAngle, petalRadius, 0.16),
      petalTopVertex = petalVertex(petalAngle + petalArc, petalRadius * 0.62, 0.06)
    ;(flowerMesh.quad(flowerCenterVertex, petalTopVertex, dDResult, dResult), flowerMesh.quad(dResult, dDResult, petalTopVertex, flowerCenterVertex))
  }
  return (buildPuffedBlobMesh(flowerMesh, stemX, stemHeight + 0.1, 0, 0.11, 0.11, 0.11, { detail: 1, seed: flowerSeed, bottom: [1, 0.72, 0.3], top: [1, 0.9, 0.55], glow: 1, swayBottom: 0.4, swayTop: 0.4 }), flowerMesh.build())
}

function buildStarArc(arcSeed) {
  const arcRandom = new FastRandom(arcSeed),
    arcMesh = new MeshBuilder(),
    arcTipColor = colorToRgb(9078678),
    arcBaseColor = colorToRgb(5196898),
    arcRadius = arcRandom.range(1.5, 2.1),
    arcSpan = arcRandom.range(1.2, 1.6),
    arcSegments = 6,
    arcPathPoints = []
  for (let index = 0; index <= arcSegments; index++) {
    const pathAngle = -0.15 + (arcSpan * index) / arcSegments
    arcPathPoints.push([0, Math.sin(pathAngle) * arcRadius, -Math.cos(pathAngle) * arcRadius + arcRadius * 0.75, 0.19 - index * 0.008])
  }
  buildTubeAlongPath(arcMesh, arcPathPoints, { sides: 4, c0: arcBaseColor, c1: arcTipColor, cap: !0 })
  for (let starIndex = 0; starIndex < arcSegments; starIndex++) {
    const starAngle = -0.15 + (arcSpan * (starIndex + 0.5)) / arcSegments,
      starY = Math.sin(starAngle) * arcRadius,
      starZ = -Math.cos(starAngle) * arcRadius + arcRadius * 0.75,
      starColor = [0.75, 0.55, 1],
      starTopVertex = arcMesh.vertex(0.2, starY - 0.07, starZ - 0.02, starColor, 1, 0, 0, 0, 0.7),
      starBottomVertex = arcMesh.vertex(0.2, starY + 0.07, starZ + 0.02, starColor, 1, 0, 0, 0, 0.7),
      starRightVertex = arcMesh.vertex(0.2, starY + 0.05, starZ + 0.09, starColor, 1, 0, 0, 0, 0.7),
      starLeftVertex = arcMesh.vertex(0.2, starY - 0.09, starZ + 0.05, starColor, 1, 0, 0, 0, 0.7)
    ;(arcMesh.quad(starTopVertex, starBottomVertex, starRightVertex, starLeftVertex), arcMesh.quad(starLeftVertex, starRightVertex, starBottomVertex, starTopVertex))
  }
  return (buildPuffedBlobMesh(arcMesh, 0, 0.06, -arcRadius * 0.26, 0.42, 0.2, 0.36, { detail: 0, bump: 0.22, seed: arcSeed, bottom: arcBaseColor, top: arcTipColor, flat: !0 }), arcMesh.build())
}

function buildMeteor(meteorSeed) {
  const meteorRandom = new FastRandom(meteorSeed),
    meteorMesh = new MeshBuilder(),
    meteorCoreColor = colorToRgb(2763840),
    meteorTailColor = colorToRgb(5725054),
    meteorSize = meteorRandom.range(0.55, 0.85)
  ;(buildPuffedBlobMesh(meteorMesh, 0, meteorSize * 0.3, 0, meteorSize, meteorSize * 0.72, meteorSize * 0.9, { detail: 0, bump: 0.32, seed: meteorSeed, bottom: scale3(meteorCoreColor, 0.7), top: meteorTailColor, flat: !0 }),
    buildPuffedBlobMesh(meteorMesh, meteorSize * 0.85, meteorSize * 0.08, meteorSize * 0.3, meteorSize * 0.42, meteorSize * 0.32, meteorSize * 0.36, { detail: 0, bump: 0.3, seed: meteorSeed + 3, bottom: meteorCoreColor, top: meteorTailColor, flat: !0 }))
  const shardCount = 5 + meteorRandom.int(3)
  for (let index = 0; index < shardCount; index++) {
    const shardAngle = (index / shardCount) * SCENERY_FULL_TURN + meteorRandom.range(-0.3, 0.3),
      shardRadius = meteorSize * meteorRandom.range(0.7, 0.95)
    buildCrystalShard(meteorMesh, Math.cos(shardAngle) * shardRadius, meteorSize * meteorRandom.range(0.25, 0.55), Math.sin(shardAngle) * shardRadius, meteorSize * meteorRandom.range(0.5, 0.8), meteorSize * 0.09, Math.sin(shardAngle) * 0.9, -Math.cos(shardAngle) * 0.9, [1, 0.72, 0.3], [1, 0.9, 0.6], 0.9, meteorSeed + index)
  }
  return meteorMesh.build()
}

function buildRune(runeSeed) {
  const runeRandom = new FastRandom(runeSeed),
    runeMesh = new MeshBuilder(),
    runeTopColor = colorToRgb(10133684),
    runeBaseColor = colorToRgb(6317696),
    runeHeight = runeRandom.range(0.28, 0.38)
  buildPuffedBlobMesh(runeMesh, 0, runeHeight * 0.42, 0, 0.26, runeHeight * 0.62, 0.19, { detail: 0, bump: 0.14, seed: runeSeed, bottom: runeBaseColor, top: runeTopColor, flat: !0 })
  const runeColor = [1, 1, 1],
    runeLeftBottom = runeMesh.vertex(-0.03, 0.06, 0.2, runeColor, 0, 0.2, 1, 0, 0.8, 1),
    runeRightBottom = runeMesh.vertex(0.03, 0.06, 0.2, runeColor, 0, 0.2, 1, 0, 0.8, 1),
    runeRightTop = runeMesh.vertex(0.025, runeHeight * 0.72, 0.15, runeColor, 0, 0.2, 1, 0, 0.8, 1),
    runeLeftTop = runeMesh.vertex(-0.025, runeHeight * 0.72, 0.15, runeColor, 0, 0.2, 1, 0, 0.8, 1)
  return (runeMesh.quad(runeLeftBottom, runeRightBottom, runeRightTop, runeLeftTop), runeMesh.build())
}

function buildFrostShrub(shrubSeed) {
  const shrubMesh = new MeshBuilder()
  return (
    buildLobedBlobMesh(shrubMesh, 0, 0.22, 0, 0.55, { lobes: 5, dark: colorToRgb(4156026), mid: colorToRgb(9418952), light: colorToRgb(15267071), seed: shrubSeed, sway0: 0.05, sway1: 0.2, thick: 0.6 }),
    buildLobedBlobMesh(shrubMesh, 0.4, 0.14, 0.2, 0.36, { lobes: 5, dark: colorToRgb(4156026), mid: colorToRgb(10274004), light: colorToRgb(15923711), seed: shrubSeed + 3, sway0: 0.05, sway1: 0.2, thick: 0.6 }),
    shrubMesh.build()
  )
}

function collectNearbyCliffRims(cliffList, centerX, centerZ, maxDistance) {
  const nearbyRims = []
  for (const cliffEntry of cliffList)
    for (const cliffRim of cliffEntry.rim) {
      const deltaX = centerX - cliffRim.x,
        deltaZ = centerZ - cliffRim.z,
        distance = Math.hypot(deltaX, deltaZ)
      distance > maxDistance || distance < 0.5 || (deltaX / distance) * cliffRim.ox + (deltaZ / distance) * cliffRim.oz < 0.35 || nearbyRims.push({ rp: cliffRim, cliff: cliffEntry, dist: distance })
    }
  return (nearbyRims.sort((leftRim, rightRim) => leftRim.dist - rightRim.dist), nearbyRims)
}

function selectSpacedCandidates(rimCandidates, maxCount, minSpacing, propertyRandom) {
  const pickedCandidates = []
  for (const propCandidate of rimCandidates) {
    if (pickedCandidates.length >= maxCount) break
    pickedCandidates.some((pickedCandidate) => Math.hypot(pickedCandidate.rp.x - propCandidate.rp.x, pickedCandidate.rp.z - propCandidate.rp.z) < minSpacing) || propertyRandom.chance(0.25) || pickedCandidates.push(propCandidate)
  }
  return pickedCandidates
}

const SCENERY_CAMP_COLORS = { 1: colorToRgb(10477823), 2: colorToRgb(16747068), 3: colorToRgb(13166736), 4: colorToRgb(SCENERY_ENV_PALETTE.amber), 5: colorToRgb(11832575), 6: colorToRgb(16767104) }

function buildSceneryProps(propInstances, sharedModels, builder, cliffRims, effectLayers, placementTracker, lightEmitters, fogEffects) {
  const frostBranchConfig = {
      frostBranch: [buildFrostBranch(401), buildFrostBranch(409)],
      frostShrub: buildFrostShrub(419),
      charStump: [buildCharredStump(421), buildCharredStump(431)],
      vent: buildVent(433),
      log: buildLog(439),
      lampFlower: [buildLampFlower(443), buildLampFlower(449)],
      starArc: [buildStarArc(457), buildStarArc(461)],
      meteor: [buildMeteor(463), buildMeteor(467)],
      rune: [buildRune(479), buildRune(487)],
    },
    rootTangleCache = new Map(),
    cachedTangles = [],
    rimPosition = (rimCandidate, insetOffset) => {
      const insetDistance = rimCandidate.rp.inset + insetOffset
      return [rimCandidate.rp.x - rimCandidate.rp.ox * insetDistance, rimCandidate.cliff.topY(insetDistance) - 0.03, rimCandidate.rp.z - rimCandidate.rp.oz * insetDistance]
    }
  for (const camp of builder.map.camps) {
    const selectedMONSTER_KIND_INDEX = MONSTER_KIND_INDEX[camp.monsterType],
      campRandom = new FastRandom(4400 + camp.id * 7),
      monsterRadiusResult = monsterRadius(camp.monsterType),
      coordX = camp.pos.x,
      coordY = camp.pos.y,
      selectedSCENERY_CAMP_COLORS = SCENERY_CAMP_COLORS[selectedMONSTER_KIND_INDEX],
      isLargeCamp = selectedMONSTER_KIND_INDEX >= 5,
      collectNearbyCliffRimsResult = collectNearbyCliffRims(cliffRims, coordX, coordY, monsterRadiusResult + (isLargeCamp ? 9 : 7))
    placementTracker.reserve(coordX, coordY)
    const propPlacementCount = Math.round(monsterRadiusResult * (selectedMONSTER_KIND_INDEX === 1 ? 1.4 : 3.2))
    for (let index = 0; index < propPlacementCount; index++) {
      if (selectedMONSTER_KIND_INDEX !== 1 && campRandom.chance(0.4)) continue
      const lookupKey = selectedMONSTER_KIND_INDEX === 1 ? Math.PI * (0.15 + (0.7 * index) / Math.max(1, propPlacementCount - 1)) + Math.PI : (index / propPlacementCount) * SCENERY_FULL_TURN + campRandom.range(-0.08, 0.08),
        spawnRadius = monsterRadiusResult + campRandom.range(-0.1, 0.25),
        spawnX = coordX + Math.cos(lookupKey) * spawnRadius,
        spawnZ = coordY + Math.sin(lookupKey) * spawnRadius
      if (builder.solidDist(spawnX, spawnZ) < 0.25 || builder.laneDist(spawnX, spawnZ) < 0.6) continue
      const heightAtResult = builder.heightAt(spawnX, spawnZ)
      if (selectedMONSTER_KIND_INDEX === 1) propInstances.add(campRandom.pick(frostBranchConfig.rune), composeMatrixTRS(spawnX, heightAtResult - 0.03, spawnZ, vectorToAngle(coordX - spawnX, coordY - spawnZ) - Math.PI / 2, campRandom.range(0.95, 1.15)), { shadow: !1, tint: lerp3(selectedSCENERY_CAMP_COLORS, [1, 1, 1], 0.2), maskedTint: !0, glow: 1 })
      else {
        const propScale = campRandom.range(0.8, 1.2) * (isLargeCamp ? 1.15 : 1)
        ;(propInstances.add(campRandom.pick(sharedModels.ruinStones), composeMatrixTRS(spawnX, heightAtResult - 0.05, spawnZ, -lookupKey + Math.PI / 2 + campRandom.range(-0.25, 0.25), propScale, propScale * (isLargeCamp ? 1.1 : 1), campRandom.range(-0.12, 0.12), campRandom.range(-0.12, 0.12)), {
          shadow: !1,
          tint: selectedMONSTER_KIND_INDEX === 2 ? [0.42, 0.36, 0.36] : isLargeCamp ? [0.78, 0.82, 0.98] : [0.95, 0.95, 0.9],
        }),
          isLargeCamp && campRandom.chance(0.25) && effectLayers.ripples.push({ x: spawnX, z: spawnZ, r: 0.8 }))
      }
    }
    switch (selectedMONSTER_KIND_INDEX) {
      case 1: {
        for (const rimSite of selectSpacedCandidates(collectNearbyCliffRimsResult, 4, 2.6, campRandom)) {
          const [crystalX, crystalY, crystalZ] = rimPosition(rimSite, campRandom.range(0.5, 1.1)),
            propVariantRoll = campRandom.next()
          if (propVariantRoll < 0.45) {
            const chanceResult = campRandom.chance(0.4),
              crystalTint = lerp3(colorToRgb(SCENERY_ENV_PALETTE.frost), [0.9, 0.97, 1], campRandom.range(0.1, 0.5))
            ;(propInstances.add(campRandom.pick(chanceResult ? sharedModels.bigCrystals : sharedModels.crystals), composeMatrixTRS(crystalX, crystalY, crystalZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.7, 1)), { tint: crystalTint, glow: 0.85 }),
              placementTracker.reserve(crystalX, crystalZ),
              effectLayers.glows.push({ x: crystalX, z: crystalZ, y: crystalY + 0.05, r: chanceResult ? 2.6 : 1.8, color: crystalTint }),
              effectLayers.aoBlobs.push({ x: crystalX, y: crystalY + 0.06, z: crystalZ, r: chanceResult ? 1.3 : 0.9, strength: 0.25 }))
          } else
            propVariantRoll < 0.75
              ? (propInstances.add(campRandom.pick(frostBranchConfig.frostBranch), composeMatrixTRS(crystalX, crystalY, crystalZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.9, 1.15)), { glow: 1 }), effectLayers.aoBlobs.push({ x: crystalX, y: crystalY + 0.06, z: crystalZ, r: 0.8, strength: 0.3 }))
              : propInstances.add(frostBranchConfig.frostShrub, composeMatrixTRS(crystalX, crystalY, crystalZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.9, 1.3)))
        }
        ;(fogEffects.push({ kind: "fog", x: coordX, y: 0.35, z: coordY, width: 10, color: SCENERY_FOG_PALETTE.cold, alpha: 0.11 }),
          lightEmitters.push({ x: coordX, y: 0.15, z: coordY, radius: monsterRadiusResult * 0.95, color: scale3(selectedSCENERY_CAMP_COLORS, 1.05), count: 14, mode: 1, range: 2, size: 0.7 }))
        break
      }
      case 2: {
        for (const stumpRim of selectSpacedCandidates(collectNearbyCliffRimsResult, 3, 2.8, campRandom)) {
          const [stumpX, stumpY, stumpZ] = rimPosition(stumpRim, campRandom.range(0.5, 1))
          ;(propInstances.add(campRandom.pick(frostBranchConfig.charStump), composeMatrixTRS(stumpX, stumpY, stumpZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.9, 1.2)), { glow: 1 }), effectLayers.aoBlobs.push({ x: stumpX, y: stumpY + 0.06, z: stumpZ, r: 0.9, strength: 0.34 }))
        }
        for (let ventIndex = 0; ventIndex < 3; ventIndex++) {
          const rangeLookupKey = campRandom.range(0, SCENERY_FULL_TURN),
            ventRadius = monsterRadiusResult * campRandom.range(0.82, 1),
            ventX = coordX + Math.cos(rangeLookupKey) * ventRadius,
            ventZ = coordY + Math.sin(rangeLookupKey) * ventRadius
          builder.solidDist(ventX, ventZ) < 0.5 ||
            builder.laneDist(ventX, ventZ) < 0.8 ||
            (propInstances.add(frostBranchConfig.vent, composeMatrixTRS(ventX, 0, ventZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.8, 1)), { shadow: !1, glow: 1 }),
            effectLayers.glows.push({ x: ventX, z: ventZ, y: 0.03, r: 1.2, color: selectedSCENERY_CAMP_COLORS }),
            lightEmitters.push({ x: ventX, y: 0.2, z: ventZ, radius: 0.25, color: selectedSCENERY_CAMP_COLORS, count: 3, mode: 1, range: 2.2, size: 0.7 }))
        }
        lightEmitters.push({ x: coordX, y: 0.1, z: coordY, radius: monsterRadiusResult * 0.9, color: scale3(selectedSCENERY_CAMP_COLORS, 1.1), count: 12, mode: 1, range: 2.6, size: 0.7 })
        break
      }
      case 3: {
        const selected_ = collectNearbyCliffRimsResult[0]
        if (selected_) {
          const rootHeightKey = Math.round(selected_.rp.y * 10) / 10
          let Value = rootTangleCache.get(rootHeightKey)
          ;(Value || ((Value = buildRootTangle(491 + rootHeightKey * 10, selected_.rp.y)), rootTangleCache.set(rootHeightKey, Value), cachedTangles.push(Value)), propInstances.add(Value, composeMatrixTRS(selected_.rp.x - selected_.rp.ox * (selected_.rp.inset - 0.12), 0, selected_.rp.z - selected_.rp.oz * (selected_.rp.inset - 0.12), vectorToAngle(selected_.rp.ox, selected_.rp.oz), 1)))
          const distance = collectNearbyCliffRimsResult.find((otherRim) => Math.hypot(otherRim.rp.x - selected_.rp.x, otherRim.rp.z - selected_.rp.z) > 2.5) ?? selected_,
            [logX, logY, logZ] = rimPosition(distance, 1)
          ;(propInstances.add(frostBranchConfig.log, composeMatrixTRS(logX, logY, logZ, vectorToAngle(distance.rp.ox, distance.rp.oz) + Math.PI / 2 + campRandom.range(-0.3, 0.3), 0.95)), effectLayers.aoBlobs.push({ x: logX, y: logY + 0.06, z: logZ, r: 1.3, strength: 0.36 }))
        }
        for (let mushroomIndex = 0; mushroomIndex < 4; mushroomIndex++) {
          const mushroomAngle = campRandom.range(0, SCENERY_FULL_TURN),
            mushroomX = coordX + Math.cos(mushroomAngle) * monsterRadiusResult * campRandom.range(0.85, 1.05),
            mushroomZ = coordY + Math.sin(mushroomAngle) * monsterRadiusResult * campRandom.range(0.85, 1.05)
          builder.solidDist(mushroomX, mushroomZ) < 0.3 ||
            builder.laneDist(mushroomX, mushroomZ) < 0.6 ||
            propInstances.add(campRandom.pick(sharedModels.mushrooms), composeMatrixTRS(mushroomX, 0, mushroomZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.8, 1.2)), { shadow: !1, tint: campRandom.pick([colorToRgb(14182458), colorToRgb(14725232)]), maskedTint: !0, glow: 0 })
        }
        lightEmitters.push({ x: coordX, y: 0.2, z: coordY, radius: monsterRadiusResult * 0.9, color: scale3(selectedSCENERY_CAMP_COLORS, 0.9), count: 6, mode: 0, range: 1.2, size: 0.6 })
        break
      }
      case 4: {
        for (const lampRim of selectSpacedCandidates(collectNearbyCliffRimsResult, 4, 1.7, campRandom)) {
          const [lampX, lampY, lampZ] = rimPosition(lampRim, campRandom.range(0.1, 0.35)),
            lerp3Lerp3Result = lerp3(colorToRgb(SCENERY_ENV_PALETTE.petalPink), colorToRgb(SCENERY_ENV_PALETTE.petalWhite), campRandom.next())
          ;(propInstances.add(campRandom.pick(frostBranchConfig.lampFlower), composeMatrixTRS(lampX, lampY, lampZ, vectorToAngle(lampRim.rp.ox, lampRim.rp.oz) + campRandom.range(-0.4, 0.4), campRandom.range(0.9, 1.25)), { tint: lerp3Lerp3Result, maskedTint: !0, glow: 1 }),
            placementTracker.reserve(lampX, lampZ),
            effectLayers.glows.push({ x: lampX, z: lampZ, y: lampY + 0.05, r: 1.4, color: selectedSCENERY_CAMP_COLORS }),
            lightEmitters.push({ x: lampX, y: lampY + 0.8, z: lampZ, radius: 0.5, color: selectedSCENERY_CAMP_COLORS, count: 2, mode: 0, range: 0.7, size: 0.6 }))
        }
        lightEmitters.push({ x: coordX, y: 0.5, z: coordY, radius: monsterRadiusResult, color: scale3(selectedSCENERY_CAMP_COLORS, 0.9), count: 7, mode: 0, range: 1.4, size: 0.6 })
        break
      }
      case 5: {
        for (const starRim of selectSpacedCandidates(collectNearbyCliffRimsResult, 4, 4.2, campRandom)) {
          const [starX, starY, starZ] = rimPosition(starRim, campRandom.range(0.7, 1.2))
          ;(propInstances.add(campRandom.pick(frostBranchConfig.starArc), composeMatrixTRS(starX, starY, starZ, vectorToAngle(starRim.rp.ox, starRim.rp.oz) + campRandom.range(-0.4, 0.4), campRandom.range(0.85, 1.1)), { glow: 1 }), effectLayers.aoBlobs.push({ x: starX, y: starY + 0.06, z: starZ, r: 0.9, strength: 0.32 }))
        }
        ;(fogEffects.push({ kind: "fog", x: coordX, y: WATER_LEVEL + 0.35, z: coordY, width: 12, color: lerp3(SCENERY_FOG_PALETTE.cold, SCENERY_FOG_PALETTE.violet, 0.3), alpha: 0.11 }),
          fogEffects.push({ kind: "beam", x: coordX - 1.5, y: WATER_LEVEL, z: coordY + 1, width: 3.6, length: 11, color: lerp3(SCENERY_FOG_PALETTE.warm, SCENERY_FOG_PALETTE.violet, 0.35), alpha: 0.06 }),
          lightEmitters.push({ x: coordX, y: WATER_LEVEL + 0.05, z: coordY, radius: monsterRadiusResult * 0.95, color: scale3(selectedSCENERY_CAMP_COLORS, 1.1), count: 20, mode: 1, range: 2.4, size: 0.9 }))
        break
      }
      default: {
        for (const meteorRim of selectSpacedCandidates(collectNearbyCliffRimsResult, 4, 3.6, campRandom)) {
          const [meteorX, meteorY, meteorZ] = rimPosition(meteorRim, campRandom.range(0.6, 1.2))
          ;(propInstances.add(campRandom.pick(frostBranchConfig.meteor), composeMatrixTRS(meteorX, meteorY - 0.22, meteorZ, campRandom.range(0, SCENERY_FULL_TURN), campRandom.range(0.9, 1.3), void 0, campRandom.range(-0.2, 0.2), campRandom.range(-0.2, 0.2)), { glow: 1 }),
            placementTracker.reserve(meteorX, meteorZ),
            effectLayers.glows.push({ x: meteorX, z: meteorZ, y: meteorY + 0.05, r: 1.5, color: selectedSCENERY_CAMP_COLORS }),
            effectLayers.aoBlobs.push({ x: meteorX, y: meteorY + 0.06, z: meteorZ, r: 1.1, strength: 0.34 }))
        }
        ;(fogEffects.push({ kind: "fog", x: coordX, y: WATER_LEVEL + 0.3, z: coordY, width: 11, color: SCENERY_FOG_PALETTE.steam, alpha: 0.09 }),
          fogEffects.push({ kind: "beam", x: coordX + 1.2, y: WATER_LEVEL, z: coordY - 0.8, width: 3.8, length: 12, color: SCENERY_FOG_PALETTE.warm, alpha: 0.075 }),
          lightEmitters.push({ x: coordX, y: WATER_LEVEL + 0.05, z: coordY, radius: monsterRadiusResult * 0.9, color: scale3(selectedSCENERY_CAMP_COLORS, 1.1), count: 20, mode: 1, range: 3, size: 0.85 }))
      }
    }
  }
  for (const valuesl of Object.values(frostBranchConfig)) Array.isArray(valuesl) ? valuesl.forEach((configModel) => configModel.dispose()) : valuesl.dispose()
  cachedTangles.forEach((cachedTangleModel) => cachedTangleModel.dispose())
}

export { buildLobedBlobMesh, buildSceneryProps }
