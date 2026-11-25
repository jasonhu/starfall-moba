/**
 * 世界场景搭建器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Euler, Frustum, Group, LinearSRGBColorSpace, Matrix4, Mesh, Points, Quaternion, SRGBColorSpace, ShaderMaterial, SphereGeometry, UniformsLib, UniformsUtils, Vector2, Vector3, Vector4 } from 'three'
import { CellGeometryBuilder, MeshBuilder, polygonArea, polygonCentroid } from '../render/buff-view'
import { GRID_C_CLIFF_GLOW_STOPS, GRID_C_BASE_DISTANCE, GRID_C_CLIFF_BANDS, computePolygonRimFrames, GRID_C_GLOW_LOW, buildMapBorder, extrudeRibbonBand } from './grid-c'
import { LANE_DECOR_COLOR_A, LANE_DECOR_MARGIN, LANE_DECOR_COLOR_D, LANE_DECOR_WIDTH_SCALE, LANE_DECOR_COLOR_B, LANE_DECOR_COLOR_C } from '../sim/hero-engage'
import { FastRandom, buildNoiseTexture, createToonMaterial, fbmNoise2D, hashNoise2D, makeLightUniforms, rockTexture } from '../render/foundation'
import { BUCKET_MIN, buildTerrainFieldTextures, SIGN_NEGATIVE, paintShadowBlobs, applyRankDrawRange, colorToRgb, lerp3, lerpScalar, scale3, smoothStepScalar } from '../fx/particle-system'
import { FULL_TURN_RADIANS, buildPuffedBlobMesh, buildCrystalShard, buildTubeAlongPath, buildBaseDecorations, getSubdividedIcosphere, buildTaperedFrustum } from '../fx/fx-random'
import { RANDOM_PROP_TRUNK, RANDOM_PROP_TRUNK_BASE, finalizeMeshBuilder, buildRandomProp, RANDOM_PROP_ENV } from './random-props'
import { buildLobedBlobMesh, buildSceneryProps } from './scenery-props'
import { MONSTER_KIND_INDEX, MapGeometry, WATER_LEVEL, monsterRadius, signedDistanceToPolygon } from './map-geometry'
import { ARENA_PALETTE, ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { scatterBoundaryVegetation, GRID_A_LOWLAND_DEPTH, GRID_A_PLATEAU_HEIGHT } from './grid-a'
import { DECAL_CENTER_COLOR, DECAL_EDGE_DARK_COLOR, DECAL_EDGE_LIGHT_COLOR, DECAL_EDGE_TIP_COLOR, DECAL_MESH_SEGMENTS, TERRAIN_DECAL_FRAGMENT_SHADER, TERRAIN_DECAL_VERTEX_SHADER } from '../render/terrain-decal-shaders'
import { isPointInPolygon } from './geometry-2d'
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from '../render/water-shaders'
import { EFFECT_STONE_DARK_COLOR, EFFECT_SCRATCH_MATRIX, EFFECT_BLOB_BASE_COLOR, EFFECT_FULL_TURN_RADIANS, scatterNicheDecor, EFFECT_CRYSTAL_TIP_COLOR, EFFECT_AMBER_LIGHT_COLOR, EFFECT_CRYSTAL_TINT_COLOR } from '../fx/effect-geometry'
import { GLSL_HASH_NOISE, GLSL_TONEMAP } from '../render/glsl-chunks'
import { SUN_DIRECTION, SUN_GROUND_DIRECTION, SUN_HEIGHT_RATIO, disposeSceneResources } from '../render/scene-rigs'
import { MOUNTAIN_BASE_HEIGHT, buildMountainRange } from '../render/toon-material-factory'
import { buildTerrainGround, generateTerrainTextures } from './geometry-projection'
import { buildRiverMesh } from './river-geometry'
import { buildArenaDecor } from '../fx/fx-helpers'
import { scatterPlateauVegetation } from '../fx/fx-batch'
import { buildWorldDecor } from './tf-system'
import { buildWaterfalls } from './grid-b'
import { buildInterleavedFloatAttribute } from '../render/geometry-utils'
import { buildAtmosphereLayer } from './map-nav-utils'
import { linearGradientDef } from '../ui/icon-theme'

interface WorldLanePoint { x: number; y: number }
interface WorldCliffSpec { niches?: { x: number; y: number }[] }
interface WorldSideConfig {
  cliffs?: number
  campsBases?: number
  props?: number
  curbs?: number
  scatter?: number
  decals?: number
  aoBlobs?: number
  glows?: number
  atmos?: number
}

function roundAndResamplePolygon(polygon, segmentLength, maxSegmentLength, noiseFn) {
  const factor = polygonArea(polygon) < 0 ? [...polygon].reverse() : [...polygon],
    lengthValue = factor.length,
    pointList = []
  for (let index = 0; index < lengthValue; index++) {
    const selectedI = factor[(index + lengthValue - 1) % lengthValue],
      point = factor[index],
      pointEdge = factor[(index + 1) % lengthValue],
      deltaX = selectedI.x - point.x,
      incomingEdgeY = selectedI.y - point.y,
      total = pointEdge.x - point.x,
      deltaY = pointEdge.y - point.y,
      distance = Math.hypot(deltaX, incomingEdgeY),
      nextEdgeDistance = Math.hypot(total, deltaY),
      isCorner = -deltaX * deltaY + incomingEdgeY * total > 1e-6,
      cornerCut = Math.min(maxSegmentLength, distance * 0.3, nextEdgeDistance * 0.3)
    if (!isCorner || cornerCut < 0.05) {
      pointList.push({ x: point.x, y: point.y })
      continue
    }
    const xConfig = { x: point.x + (deltaX / distance) * cornerCut, y: point.y + (incomingEdgeY / distance) * cornerCut },
      factorEdge = { x: point.x + (total / nextEdgeDistance) * cornerCut, y: point.y + (deltaY / nextEdgeDistance) * cornerCut }
    for (const factorTip of [0, 0.5, 1]) {
      const planeOffset = 1 - factorTip
      pointList.push({ x: planeOffset * planeOffset * xConfig.x + 2 * planeOffset * factorTip * point.x + factorTip * factorTip * factorEdge.x, y: planeOffset * planeOffset * xConfig.y + 2 * planeOffset * factorTip * point.y + factorTip * factorTip * factorEdge.y })
    }
  }
  const rimPoints = []
  let unitSize = 0
  for (let sampleIndex = 0; sampleIndex < pointList.length; sampleIndex++) {
    const selectedO = pointList[sampleIndex],
      pointTip = pointList[(sampleIndex + 1) % pointList.length],
      spanDistance = Math.hypot(pointTip.x - selectedO.x, pointTip.y - selectedO.y),
      sampleCount = Math.max(1, Math.round(spanDistance / segmentLength))
    for (let indexEdge = 0; indexEdge < sampleCount; indexEdge++) {
      let weightedSum = indexEdge / sampleCount
      ;(indexEdge > 0 && (weightedSum += (noiseFn(unitSize) - 0.5) * (0.5 / sampleCount)), rimPoints.push({ x: selectedO.x + (pointTip.x - selectedO.x) * weightedSum, y: selectedO.y + (pointTip.y - selectedO.y) * weightedSum }), unitSize++)
    }
  }
  return computePolygonRimFrames(rimPoints)
}

const WORLD_SCRATCH_MATRIX = new Matrix4(),
  WORLD_SCRATCH_QUATERNION = new Quaternion(),
  WORLD_SCRATCH_EULER = new Euler(),
  WORLD_UNIT_SCALE = new Vector3(1, 1, 1),
  WORLD_SCRATCH_VECTOR = new Vector3()

function scatterLaneCurbs(targetBuilder, builder) {
  const map = builder.map,
    weightedSum = map.laneWidth / 2 + LANE_DECOR_MARGIN,
    rng = new FastRandom(4242)
  let total = 0
  for (const lane of Object.values<WorldLanePoint[]>(map.lanes))
    for (const factor of [-1, 1]) {
      let curbOffset = rng.range(0, 0.6)
      for (let index = 1; index < lane.length; index++) {
        const point = lane[index - 1],
          pointEdge = lane[index],
          distance = Math.hypot(pointEdge.x - point.x, pointEdge.y - point.y),
          progress = (pointEdge.x - point.x) / distance,
          laneDirectionY = (pointEdge.y - point.y) / distance,
          scaledExtent = -laneDirectionY * factor,
          laneNormalY = progress * factor
        let weightedSumEdge = curbOffset
        for (; weightedSumEdge < distance;) {
          const curbSegmentLength = rng.range(0.9, 1.4),
            curbMidOffset = weightedSumEdge + curbSegmentLength / 2,
            randomJitter = rng.range(0.03, 0.07)
          if (((weightedSumEdge += curbSegmentLength + randomJitter), curbMidOffset > distance)) break
          const lookupKey = point.x + progress * curbMidOffset + scaledExtent * weightedSum,
            coordY = point.y + laneDirectionY * curbMidOffset + laneNormalY * weightedSum,
            skipRoll = rng.next(),
            variantRoll = rng.next(),
            blendFactor = rng.next(),
            rand01 = rng.next()
          if (
            Math.abs(builder.laneDist(lookupKey, coordY) - LANE_DECOR_MARGIN) > 0.07 ||
            builder.riverDist(lookupKey, coordY) < 0.9 ||
            builder.baseDist(lookupKey, coordY) < 0.35 ||
            builder.padDist(lookupKey, coordY) < 0.45 ||
            builder.wallDist(lookupKey, coordY, 2) < 0.14 ||
            builder.boundDist(lookupKey, coordY) < 0.25 ||
            skipRoll < 0.15
          )
            continue
          const isRoughCurb = variantRoll < 0.1,
            tipRadius = (0.06 + rand01 * 0.06) * (isRoughCurb ? 0.6 : 1),
            bearingAngle = Math.atan2(-laneDirectionY, progress) + (isRoughCurb ? (rng.next() - 0.5) * 0.3 : (rng.next() - 0.5) * 0.05)
          ;(WORLD_SCRATCH_EULER.set(isRoughCurb ? (rng.next() - 0.5) * 0.16 : 0, bearingAngle, isRoughCurb ? (rng.next() - 0.5) * 0.12 : 0, "YXZ"), WORLD_SCRATCH_QUATERNION.setFromEuler(WORLD_SCRATCH_EULER), WORLD_SCRATCH_VECTOR.set(lookupKey, isRoughCurb ? -0.02 : 0, coordY), WORLD_SCRATCH_MATRIX.compose(WORLD_SCRATCH_VECTOR, WORLD_SCRATCH_QUATERNION, WORLD_UNIT_SCALE))
          const tintBlend = builder.solidDist(lookupKey, coordY, 3) < 1.8 || builder.riverDist(lookupKey, coordY) < 3 ? rng.range(0.15, 0.5) : rng.range(0, 0.12),
            scale3Result = scale3(lerp3(lerp3(LANE_DECOR_COLOR_A, LANE_DECOR_COLOR_B, blendFactor), LANE_DECOR_COLOR_D, tintBlend), 0.92 + blendFactor * 0.14),
            atResult = targetBuilder.at(lookupKey, coordY, !1),
            triangleCount = atResult.triangleCount
          ;(buildTaperedFrustum(atResult, WORLD_SCRATCH_MATRIX, curbSegmentLength, LANE_DECOR_WIDTH_SCALE * rng.range(0.9, 1.1), tipRadius, 0.035, scale3Result, lerp3(LANE_DECOR_COLOR_C, LANE_DECOR_COLOR_D, tintBlend * 0.6)), (total += atResult.triangleCount - triangleCount))
        }
        curbOffset = Math.max(0, weightedSumEdge - distance)
      }
    }
  return total
}

function emitTaperedBlade(fxBuilder, baseX, baseZ, baseY, extentParam, extentParamEdge, extentParamTip, extentParamBase, extentParamInner, extentParamOuter, colorFrom, colorTo, extentParamMid, variantFlag = 3) {
  const scaledExtent = -extentParamEdge * extentParamBase,
    scaledExtentEdge = extentParam * extentParamBase,
    items = []
  for (let index = 0; index <= variantFlag; index++) {
    const blendFactor = index / variantFlag,
      coordX = baseX + extentParam * extentParamTip * blendFactor,
      coordZ = baseY + extentParamEdge * extentParamTip * blendFactor,
      coordY = baseZ + Math.sin(blendFactor * Math.PI * 0.6) * extentParamInner - blendFactor * blendFactor * extentParamOuter,
      factor = index === variantFlag ? 0 : 1 - blendFactor * 0.55,
      bladeColor = lerp3(colorFrom, colorTo, blendFactor)
    index === variantFlag ? items.push(fxBuilder.vertex(coordX, coordY, coordZ, bladeColor, 0, 1, 0, extentParamMid * blendFactor)) : items.push(fxBuilder.vertex(coordX - scaledExtent * factor, coordY, coordZ - scaledExtentEdge * factor, bladeColor, 0, 1, 0, extentParamMid * blendFactor), fxBuilder.vertex(coordX + scaledExtent * factor, coordY, coordZ + scaledExtentEdge * factor, bladeColor, 0, 1, 0, extentParamMid * blendFactor))
  }
  for (let bladeStep = 0; bladeStep < variantFlag - 1; bladeStep++) fxBuilder.quad(items[bladeStep * 2], items[bladeStep * 2 + 1], items[bladeStep * 2 + 3], items[bladeStep * 2 + 2])
  fxBuilder.tri(items[(variantFlag - 1) * 2], items[(variantFlag - 1) * 2 + 1], items[variantFlag * 2])
}

function buildWillowTree(seed) {
  const fastRandom = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomAmount = fastRandom.range(2, 2.4),
    blobX = fastRandom.range(-0.3, 0.3)
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.28],
      [blobX * 0.4, randomAmount * 0.5, 0, 0.19],
      [blobX, randomAmount, 0.05, 0.12],
      [blobX * 1.1, randomAmount + 0.7, 0.05, 0.05],
    ],
    { sides: 5, c0: RANDOM_PROP_TRUNK_BASE, c1: RANDOM_PROP_TRUNK, sway1: 0.15 },
  )
  const foliageDark = colorToRgb(2779730),
    foliageLight = colorToRgb(5938274),
    paletteColor = colorToRgb(11128946),
    sampleTable = [blobX, randomAmount + 0.2, 0],
    randomAngle = fastRandom.range(0, FULL_TURN_RADIANS),
    sampleTableEdge = []
  for (let index = 0; index < 3; index++) {
    const randomAngleEdge = randomAngle + (index / 3) * FULL_TURN_RADIANS + fastRandom.range(-0.25, 0.25),
      randomAmountEdge = fastRandom.range(0.55, 0.7),
      blobRadius = fastRandom.range(0.85, 1),
      blobXEdge = blobX + Math.cos(randomAngleEdge) * randomAmountEdge,
      blobZ = Math.sin(randomAngleEdge) * randomAmountEdge,
      blobY = randomAmount + fastRandom.range(0, 0.15)
    ;(sampleTableEdge.push([blobXEdge, blobY, blobZ, blobRadius]), buildLobedBlobMesh(meshBuilder, blobXEdge, blobY, blobZ, blobRadius, { lobes: 8, dark: foliageDark, mid: lerp3(foliageDark, foliageLight, 0.7), light: foliageLight, seed: seed + index * 7, sway0: 0.35, sway1: 0.6, puffCenter: sampleTable, puff: 0.35, thick: 0.5 }))
  }
  buildLobedBlobMesh(meshBuilder, blobX, randomAmount + 0.68, 0, 0.82, { lobes: 8, dark: lerp3(foliageDark, foliageLight, 0.5), mid: foliageLight, light: paletteColor, seed: seed + 41, sway0: 0.5, sway1: 0.8, puffCenter: sampleTable, puff: 0.25, thick: 0.5 })
  const ringIndex = 9
  for (let indexEdge = 0; indexEdge < ringIndex; indexEdge++) {
    const selectedF = sampleTableEdge[indexEdge % 3],
      randomAngleTip = fastRandom.range(0, FULL_TURN_RADIANS),
      coordX = selectedF[0] + Math.cos(randomAngleTip) * selectedF[3] * fastRandom.range(0.6, 0.92),
      coordZ = selectedF[2] + Math.sin(randomAngleTip) * selectedF[3] * fastRandom.range(0.6, 0.92),
      coordY = selectedF[1] + 0.02,
      randomAmountTip = fastRandom.range(0.8, 1.35),
      unitSize = 0.045,
      cosOffset = Math.cos(randomAngleTip + 1.57) * unitSize,
      sinOffset = Math.sin(randomAngleTip + 1.57) * unitSize,
      vertexResult = meshBuilder.vertex(coordX - cosOffset, coordY, coordZ - sinOffset, foliageLight, Math.cos(randomAngleTip), 0.3, Math.sin(randomAngleTip), 0.4),
      offsetLeafVertex = meshBuilder.vertex(coordX + cosOffset, coordY, coordZ + sinOffset, foliageLight, Math.cos(randomAngleTip), 0.3, Math.sin(randomAngleTip), 0.4),
      blendColor = meshBuilder.vertex(coordX - cosOffset * 0.7, coordY - randomAmountTip * 0.55, coordZ - sinOffset * 0.7, lerp3(foliageLight, paletteColor, 0.5), Math.cos(randomAngleTip), 0.3, Math.sin(randomAngleTip), 0.9),
      blendColorEdge = meshBuilder.vertex(coordX + cosOffset * 0.7, coordY - randomAmountTip * 0.55, coordZ + sinOffset * 0.7, lerp3(foliageLight, paletteColor, 0.5), Math.cos(randomAngleTip), 0.3, Math.sin(randomAngleTip), 0.9),
      vertexHandle = meshBuilder.vertex(coordX, coordY - randomAmountTip, coordZ, paletteColor, Math.cos(randomAngleTip), 0.3, Math.sin(randomAngleTip), 1.4)
    ;(meshBuilder.quad(vertexResult, offsetLeafVertex, blendColorEdge, blendColor), meshBuilder.tri(blendColor, blendColorEdge, vertexHandle))
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildFarTree(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    blobY = rng.range(1.7, 2.3)
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.26],
      [0, blobY + 0.5, 0, 0.1],
    ],
    { sides: 4, c0: RANDOM_PROP_TRUNK_BASE, c1: RANDOM_PROP_TRUNK },
  )
  const canopydarkColor = colorToRgb(RANDOM_PROP_ENV.canopyDark),
    canopyColor = colorToRgb(RANDOM_PROP_ENV.canopy),
    canopylightColor = colorToRgb(RANDOM_PROP_ENV.canopyLight),
    blobRadius = rng.range(1.2, 1.5),
    seedValues = [0, blobY, 0]
  return (
    buildLobedBlobMesh(meshBuilder, 0, blobY, 0, blobRadius, { lobes: 6, dark: canopydarkColor, mid: lerp3(canopydarkColor, canopyColor, 0.7), light: canopyColor, seed: seed, sway0: 0.25, sway1: 0.55, puffCenter: seedValues, puff: 0.3, thick: 0.6 }),
    buildLobedBlobMesh(meshBuilder, rng.range(-0.3, 0.3), blobY + blobRadius * 0.5, rng.range(-0.3, 0.3), blobRadius * 0.68, {
      lobes: 6,
      dark: lerp3(canopydarkColor, canopyColor, 0.6),
      mid: lerp3(canopyColor, canopylightColor, 0.4),
      light: canopylightColor,
      seed: seed + 3,
      sway0: 0.5,
      sway1: 0.8,
      puffCenter: seedValues,
      puff: 0.3,
      thick: 0.6,
    }),
    finalizeMeshBuilder(meshBuilder)
  )
}

function buildPineTree(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomAmount = rng.range(3.2, 4.4)
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.22],
      [0, randomAmount * 0.5, 0, 0.12],
    ],
    { sides: 5, c0: RANDOM_PROP_TRUNK_BASE, c1: RANDOM_PROP_TRUNK },
  )
  const vertexIndex = 3,
    paletteColor = colorToRgb(1857096),
    paletteColorEdge = colorToRgb(6202722)
  for (let index = 0; index < vertexIndex; index++) {
    const scaledExtent = randomAmount * (0.22 + index * 0.24),
      coordY = scaledExtent + randomAmount * 0.36,
      randomAmountEdge = (1.25 - index * 0.33) * rng.range(0.9, 1.1),
      indexEdge = 7,
      lerp3Lerp3Result = lerp3(paletteColor, paletteColorEdge, index * 0.18),
      blendColor = lerp3(paletteColor, paletteColorEdge, 0.45 + index * 0.2),
      vertexHandle = meshBuilder.vertex(0, coordY, 0, blendColor, 0, 1, 0, 0.5 + index * 0.2),
      items = []
    for (let noiseX = 0; noiseX < indexEdge; noiseX++) {
      const azimuth = (noiseX / indexEdge) * FULL_TURN_RADIANS + index * 0.4,
        noisyExtent = randomAmountEdge * (0.9 + hashNoise2D(noiseX, index, seed) * 0.2),
        normalX = Math.cos(azimuth) * 0.8,
        normalZ = Math.sin(azimuth) * 0.8
      items.push(meshBuilder.vertex(Math.cos(azimuth) * noisyExtent, scaledExtent - (noiseX % 2) * 0.12, Math.sin(azimuth) * noisyExtent, lerp3Lerp3Result, normalX, 0.6, normalZ, 0.3 + index * 0.15))
    }
    for (let indexTip = 0; indexTip < indexEdge; indexTip++) meshBuilder.tri(items[indexTip], vertexHandle, items[(indexTip + 1) % indexEdge])
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildShrub(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    canopydarkColor = colorToRgb(RANDOM_PROP_ENV.canopyDark),
    canopyColor = colorToRgb(RANDOM_PROP_ENV.canopy),
    canopylightColor = lerp3(canopyColor, colorToRgb(RANDOM_PROP_ENV.canopyLight), 0.55),
    randomAmount = 2 + rng.int(2),
    seedValues = [0, 0.1, 0]
  for (let index = 0; index < randomAmount; index++) {
    const randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomJitter = index === 0 ? 0 : rng.range(0.28, 0.5),
      blobRadius = index === 0 ? rng.range(0.52, 0.66) : rng.range(0.34, 0.46)
    buildLobedBlobMesh(meshBuilder, Math.cos(randomAngle) * randomJitter, blobRadius * (index === 0 ? 0.42 : 0.22), Math.sin(randomAngle) * randomJitter, blobRadius, { lobes: 6, dark: canopydarkColor, mid: canopyColor, light: canopylightColor, seed: seed + index * 5, sway0: 0.05, sway1: 0.3, puffCenter: seedValues, puff: 0.35, thick: 0.62 })
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildFacetedRock(targetBuilder, vertexX, vertexY, vertexZ, extentParam, extentParamEdge, extentParamTip, noiseY, subdivision, colorFrom, colorTo) {
  const SubdividedIcosphereValue = getSubdividedIcosphere(subdivision),
    rng = new FastRandom(noiseY * 31 + 7),
    sampleTable = [],
    factor = subdivision > 0 ? 6 : 3
  for (let index = 0; index < factor; index++) {
    const randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomAmount = index === 0 ? rng.range(0.75, 0.95) : rng.range(-0.1, 0.55),
      horizontalRadius = Math.sqrt(Math.max(0, 1 - randomAmount * randomAmount))
    sampleTable.push([Math.cos(randomAngle) * horizontalRadius, randomAmount, Math.sin(randomAngle) * horizontalRadius, rng.range(0.52, 0.82)])
  }
  const vertexHandle = targetBuilder.vertexCount
  for (let vertIndex = 0; vertIndex < SubdividedIcosphereValue.verts.length; vertIndex++) {
    let [unitX, unitY, factorEdge] = SubdividedIcosphereValue.verts[vertIndex]
    for (const [factorTip, factorBase, factorInner, factorOuter] of sampleTable) {
      const planeOffset = unitX * factorTip + unitY * factorBase + factorEdge * factorInner - factorOuter
      planeOffset > 0 && ((unitX -= factorTip * planeOffset), (unitY -= factorBase * planeOffset), (factorEdge -= factorInner * planeOffset))
    }
    const noiseScale = 1 + (hashNoise2D(vertIndex, noiseY, 71) - 0.5) * 0.1,
      displacedY = Math.max(-0.42, unitY * noiseScale),
      heightBlend = Math.min(1, Math.max(0, (displacedY + 0.42) / 1.2)),
      scale3Scale3Result = scale3(lerp3(colorFrom, colorTo, heightBlend * heightBlend * (3 - 2 * heightBlend)), 0.94 + hashNoise2D(vertIndex, noiseY, 5) * 0.12)
    targetBuilder.vertex(vertexX + unitX * noiseScale * extentParam, vertexY + displacedY * extentParamEdge, vertexZ + factorEdge * noiseScale * extentParamTip, scale3Scale3Result, 0, 1, 0, 0, 0, 0, 0.68 + 0.32 * heightBlend)
  }
  for (const [factorMid, factorStart, factorEnd] of SubdividedIcosphereValue.tris) targetBuilder.tri(vertexHandle + factorMid, vertexHandle + factorStart, vertexHandle + factorEnd)
}

function buildRock(seed, variantFlag) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    rockdarkColor = colorToRgb(RANDOM_PROP_ENV.rockDark),
    rocklightColor = colorToRgb(RANDOM_PROP_ENV.rockLight),
    randomAmount = variantFlag ? 2 + rng.int(2) : 1
  for (let index = 0; index < randomAmount; index++) {
    const randomAmountEdge = index === 0 ? 1 : rng.range(0.42, 0.66),
      randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomAmountTip = index === 0 ? 0 : rng.range(0.68, 0.95)
    buildFacetedRock(
      meshBuilder,
      Math.cos(randomAngle) * randomAmountTip,
      randomAmountEdge * rng.range(0.28, 0.42),
      Math.sin(randomAngle) * randomAmountTip,
      randomAmountEdge * rng.range(0.9, 1.2),
      randomAmountEdge * rng.range(0.62, 0.9),
      randomAmountEdge * rng.range(0.8, 1.1),
      seed + index * 7,
      variantFlag && index === 0 ? 1 : 0,
      lerp3(rockdarkColor, rocklightColor, 0.15),
      lerp3(rockdarkColor, rocklightColor, 0.85),
    )
  }
  return (meshBuilder.computeNormals(35), finalizeMeshBuilder(meshBuilder))
}

function buildCrystalCluster(seed, variantFlag) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomAmount = variantFlag ? 5 + rng.int(3) : 3 + rng.int(2),
    seedValues = [0.5, 0.5, 0.5],
    seedValuesEdge = [1, 1, 1]
  for (let index = 0; index < randomAmount; index++) {
    const isCorner = index === 0,
      randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomJitter = isCorner ? 0 : rng.range(0.22, 0.5) * (variantFlag ? 1.5 : 1),
      randomAmountEdge = (isCorner ? rng.range(1.1, 1.5) : rng.range(0.45, 0.95)) * (variantFlag ? 1.7 : 1),
      randomJitterEdge = randomAmountEdge * rng.range(0.13, 0.18),
      randomJitterTip = isCorner ? rng.range(-0.12, 0.12) : rng.range(0.25, 0.6)
    buildCrystalShard(meshBuilder, Math.cos(randomAngle) * randomJitter, 0, Math.sin(randomAngle) * randomJitter, randomAmountEdge, randomJitterEdge, Math.sin(randomAngle) * randomJitterTip, -Math.cos(randomAngle) * randomJitterTip, seedValues, seedValuesEdge, isCorner ? 1 : 0.8, seed + index)
  }
  return (buildPuffedBlobMesh(meshBuilder, 0, 0.05, 0, variantFlag ? 0.9 : 0.5, 0.22, variantFlag ? 0.9 : 0.5, { detail: 0, bump: 0.2, seed: seed, bottom: [0.22, 0.24, 0.3], top: [0.4, 0.43, 0.5], flat: !0 }), finalizeMeshBuilder(meshBuilder))
}

function buildPillar(seed, variantFlag) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    c1Color = colorToRgb(12170924),
    c0Color = colorToRgb(8223874),
    randomAmount = variantFlag ? rng.range(2.3, 3.2) : rng.range(0.9, 1.6),
    unitSize = 0.34
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, unitSize * 1.75],
      [0, 0.22, 0, unitSize * 1.75],
      [0, 0.34, 0, unitSize * 1.25],
    ],
    { sides: 4, c0: c0Color, c1: c1Color, cap: !1 },
  )
  const segmentCount = Math.max(2, Math.round(randomAmount / 0.7))
  let total = 0.34
  for (let index = 0; index < segmentCount; index++) {
    const progress = (randomAmount - 0.34) / segmentCount,
      randomJitter = index === 0 ? 0 : rng.range(-0.03, 0.03)
    ;(buildTubeAlongPath(
      meshBuilder,
      [
        [randomJitter, total, randomJitter, unitSize * 1.02],
        [randomJitter, total + progress * 0.1, randomJitter, unitSize],
        [randomJitter, total + progress * 0.9, randomJitter, unitSize * 0.98],
        [randomJitter, total + progress, randomJitter, unitSize * 1.02],
      ],
      { sides: 8, c0: lerp3(c0Color, c1Color, 0.3 + index * 0.12), c1: c1Color, cap: index === segmentCount - 1 },
    ),
      (total += progress))
  }
  const weightedSum = 0.34 + (randomAmount - 0.34) * 0.62
  return (
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, weightedSum, 0, unitSize * 1.06],
        [0, weightedSum + 0.1, 0, unitSize * 1.06],
      ],
      { sides: 8, c0: [1, 1, 1], c1: [1, 1, 1], glow: 1 },
    ),
    buildPuffedBlobMesh(meshBuilder, rng.range(-0.1, 0.1), randomAmount + 0.08, rng.range(-0.1, 0.1), unitSize * 0.9, 0.2, unitSize * 0.8, { detail: 0, bump: 0.25, seed: seed, bottom: c0Color, top: c1Color, flat: !0 }),
    finalizeMeshBuilder(meshBuilder)
  )
}

function buildMushroom(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomAmount = 2 + rng.int(2),
    seedValues = [0.78, 0.74, 0.64]
  for (let index = 0; index < randomAmount; index++) {
    const randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomJitter = index === 0 ? 0 : rng.range(0.24, 0.42),
      randomJitterEdge = index === 0 ? rng.range(0.42, 0.58) : rng.range(0.2, 0.36),
      cosOffset = Math.cos(randomAngle) * randomJitter,
      sinOffset = Math.sin(randomAngle) * randomJitter,
      randomJitterTip = rng.range(-0.08, 0.08)
    buildTubeAlongPath(
      meshBuilder,
      [
        [cosOffset, -0.05, sinOffset, randomJitterEdge * 0.15],
        [cosOffset + randomJitterTip * 0.5, randomJitterEdge * 0.6, sinOffset + randomJitterTip * 0.5, randomJitterEdge * 0.1],
        [cosOffset + randomJitterTip, randomJitterEdge, sinOffset + randomJitterTip, randomJitterEdge * 0.12],
      ],
      { sides: 5, c0: scale3(seedValues, 0.7), c1: seedValues },
    )
    const blobRadius = randomJitterEdge * rng.range(0.52, 0.68),
      blendColor = meshBuilder.vertex(cosOffset + randomJitterTip, randomJitterEdge - blobRadius * 0.1, sinOffset + randomJitterTip, scale3(seedValues, 0.9), 0, -1, 0),
      items = []
    for (let rockIndex = 0; rockIndex < 7; rockIndex++) {
      const azimuth = (rockIndex / 7) * FULL_TURN_RADIANS
      items.push(meshBuilder.vertex(cosOffset + randomJitterTip + Math.cos(azimuth) * blobRadius * 0.96, randomJitterEdge + blobRadius * 0.1, sinOffset + randomJitterTip + Math.sin(azimuth) * blobRadius * 0.96, scale3(seedValues, 1.08), Math.cos(azimuth) * 0.4, -0.8, Math.sin(azimuth) * 0.4))
    }
    for (let indexEdge = 0; indexEdge < 7; indexEdge++) meshBuilder.tri(blendColor, items[indexEdge], items[(indexEdge + 1) % 7])
    buildPuffedBlobMesh(meshBuilder, cosOffset + randomJitterTip, randomJitterEdge + blobRadius * 0.1, sinOffset + randomJitterTip, blobRadius, blobRadius * 0.52, blobRadius, { detail: 1, bump: 0.03, seed: seed + index, bottom: [0.55, 0.55, 0.55], top: [1, 1, 1], glow: 0.35, team: 1, cutBelow: -0.05 })
    for (let indexTip = 0; indexTip < 3; indexTip++) {
      const randomAngleEdge = rng.range(0, FULL_TURN_RADIANS),
        randomJitterBase = blobRadius * rng.range(0.3, 0.6),
        coordY = randomJitterEdge + blobRadius * 0.1 + blobRadius * 0.52 * Math.sqrt(Math.max(0, 1 - (randomJitterBase * randomJitterBase) / (blobRadius * blobRadius))) + 0.006,
        coordX = cosOffset + randomJitterTip + Math.cos(randomAngleEdge) * randomJitterBase,
        coordZ = sinOffset + randomJitterTip + Math.sin(randomAngleEdge) * randomJitterBase,
        randomJitterInner = blobRadius * rng.range(0.1, 0.16),
        vertices = [1, 0.97, 0.86],
        vertexHandle = meshBuilder.vertex(coordX - randomJitterInner, coordY, coordZ, vertices, 0, 1, 0),
        vertexHandleEdge = meshBuilder.vertex(coordX, coordY, coordZ + randomJitterInner, vertices, 0, 1, 0),
        vertexHandleTip = meshBuilder.vertex(coordX + randomJitterInner, coordY, coordZ, vertices, 0, 1, 0),
        vertexHandleBase = meshBuilder.vertex(coordX, coordY, coordZ - randomJitterInner, vertices, 0, 1, 0)
      meshBuilder.quad(vertexHandle, vertexHandleEdge, vertexHandleTip, vertexHandleBase)
    }
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildBracketFungus(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomAmount = 2 + rng.int(2)
  for (let index = 0; index < randomAmount; index++) {
    const coordY = index * rng.range(0.16, 0.24),
      randomJitter = rng.range(0.2, 0.32) * (1 - index * 0.15),
      coordZ = rng.range(-0.15, 0.15),
      vertices = [0.45, 0.45, 0.45],
      verticesEdge = [0.86, 0.86, 0.86],
      vertexHandle = meshBuilder.vertex(-0.03, coordY + 0.07, coordZ, vertices, 0.2, 1, 0, 0, 0, 1, 0.7),
      items = [],
      bladeIndex = 6
    for (let indexEdge = 0; indexEdge <= bladeIndex; indexEdge++) {
      const azimuth = -Math.PI / 2 + (indexEdge / bladeIndex) * Math.PI
      items.push(meshBuilder.vertex(Math.cos(azimuth) * randomJitter, coordY, coordZ + Math.sin(azimuth) * randomJitter * 1.2, verticesEdge, Math.cos(azimuth) * 0.5, 0.8, Math.sin(azimuth) * 0.5, 0, 0.5, 1))
    }
    for (let indexTip = 0; indexTip < bladeIndex; indexTip++) meshBuilder.tri(vertexHandle, items[indexTip + 1], items[indexTip])
    const vertexHandleEdge = meshBuilder.vertex(-0.03, coordY - 0.07, coordZ, [0.7, 0.66, 0.56], 0, -1, 0)
    for (let indexBase = 0; indexBase < bladeIndex; indexBase++) meshBuilder.tri(vertexHandleEdge, items[indexBase], items[indexBase + 1])
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildLanternOrBell(seed, variantFlag, variantFlagEdge, variantFlagTip, variantFlagBase = !1) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    c0Color = colorToRgb(3107397),
    c1Color = colorToRgb(5938262),
    randomAmount = 2 + rng.int(2),
    factor = variantFlagBase ? 0.6 : 1
  for (let index = 0; index < randomAmount; index++) {
    const randomAngle = (index / randomAmount) * FULL_TURN_RADIANS + rng.range(-0.5, 0.5),
      randomAmountEdge = rng.range(0.9, 1.5) * factor,
      randomJitter = rng.range(0.35, 0.6) * factor,
      cosComponent = Math.cos(randomAngle),
      sinComponent = Math.sin(randomAngle),
      blobX = cosComponent * randomJitter,
      blobZ = sinComponent * randomJitter
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, -0.05, 0, 0.05 * factor],
        [cosComponent * randomJitter * 0.25, randomAmountEdge * 0.6, sinComponent * randomJitter * 0.25, 0.04 * factor],
        [cosComponent * randomJitter * 0.7, randomAmountEdge, sinComponent * randomJitter * 0.7, 0.03 * factor],
        [blobX, randomAmountEdge * 0.86, blobZ, 0.02 * factor],
      ],
      { sides: 3, c0: c0Color, c1: c1Color, sway0: 0, sway1: 0.5 },
    )
    const blobRadius = rng.range(0.13, 0.18) * (variantFlagBase ? 0.75 : 1)
    buildPuffedBlobMesh(meshBuilder, blobX, randomAmountEdge * 0.86 - blobRadius * 1.1, blobZ, blobRadius, blobRadius * 1.25, blobRadius, { detail: 1, seed: seed + index, bottom: variantFlag, top: variantFlagEdge, glow: variantFlagTip, swayBottom: 0.55, swayTop: 0.5, team: variantFlagBase ? 1 : 0 })
  }
  for (let shapeIndex = 0; shapeIndex < 4; shapeIndex++) {
    const randomAngleEdge = (shapeIndex / 4) * FULL_TURN_RADIANS + rng.range(-0.3, 0.3)
    emitTaperedBlade(meshBuilder, 0, 0.02, 0, Math.cos(randomAngleEdge), Math.sin(randomAngleEdge), 0.36 * factor, 0.07 * factor, 0.14 * factor, 0.06, c0Color, c1Color, 0.15, 2)
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildFern(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(3107400),
    paletteColorEdge = colorToRgb(8368730),
    randomAmount = 5 + rng.int(3)
  for (let index = 0; index < randomAmount; index++) {
    const randomAngle = (index / randomAmount) * FULL_TURN_RADIANS + rng.range(-0.35, 0.35),
      randomAmountEdge = rng.range(0.42, 0.7)
    emitTaperedBlade(meshBuilder, 0, 0, 0, Math.cos(randomAngle), Math.sin(randomAngle), randomAmountEdge, rng.range(0.07, 0.1), randomAmountEdge * rng.range(0.45, 0.7), randomAmountEdge * 0.3, paletteColor, lerp3(paletteColorEdge, [0.7, 0.9, 0.5], rng.next() * 0.4), 0.6)
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildVine(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(3828286),
    paletteColorEdge = colorToRgb(7317584),
    paletteColorTip = colorToRgb(10274918),
    facetIndex = 4,
    unitSize = 0.045,
    items = [],
    randomAngle = rng.range(0, FULL_TURN_RADIANS)
  for (let index = 0; index <= facetIndex; index++) {
    const progress = index / facetIndex,
      sinOffset = Math.sin(randomAngle + progress * 4) * 0.07 * progress,
      coordX = 0.06 + 0.03 * Math.sin(randomAngle * 2 + progress * 3),
      coordY = -progress,
      scaledExtent = unitSize * (1 - progress * 0.7)
    items.push(meshBuilder.vertex(coordX, coordY, sinOffset - scaledExtent, paletteColor, 1, 0.2, 0, progress * 0.5), meshBuilder.vertex(coordX, coordY, sinOffset + scaledExtent, paletteColor, 1, 0.2, 0, progress * 0.5))
  }
  for (let indexEdge = 0; indexEdge < facetIndex; indexEdge++) meshBuilder.quad(items[indexEdge * 2], items[indexEdge * 2 + 1], items[indexEdge * 2 + 3], items[indexEdge * 2 + 2])
  for (let indexTip = 0; indexTip < 6; indexTip++) {
    const progressEdge = (indexTip + 0.6) / 6.4,
      factor = indexTip % 2 === 0 ? 1 : -1,
      coordZ = Math.sin(randomAngle + progressEdge * 4) * 0.07 * progressEdge,
      randomJitter = rng.range(0.09, 0.14),
      blendColor = lerp3(paletteColorEdge, paletteColorTip, rng.next()),
      blendColorEdge = meshBuilder.vertex(0.07, -progressEdge, coordZ, scale3(blendColor, 0.8), 1, 0.3, 0, progressEdge * 0.6),
      vertexHandle = meshBuilder.vertex(0.1, -progressEdge - randomJitter * 0.25, coordZ + factor * randomJitter, blendColor, 1, 0.3, 0, progressEdge * 0.8),
      vertexHandleEdge = meshBuilder.vertex(0.09, -progressEdge - randomJitter * 1.2, coordZ + factor * randomJitter * 0.35, blendColor, 1, 0.3, 0, progressEdge * 0.9)
    meshBuilder.tri(blendColorEdge, vertexHandle, vertexHandleEdge)
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildDrape(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    cliffgrassColor = colorToRgb(RANDOM_PROP_ENV.cliffGrass),
    paletteColor = colorToRgb(10668128),
    randomAmount = 3 + rng.int(2)
  for (let index = 0; index < randomAmount; index++) {
    const randomAmountEdge = rng.range(-0.7, 0.7),
      randomJitter = rng.range(0.34, 0.6)
    emitTaperedBlade(meshBuilder, rng.range(-0.1, 0.05), 0.02, rng.range(-0.25, 0.25), Math.cos(randomAmountEdge), Math.sin(randomAmountEdge), randomJitter, rng.range(0.05, 0.075), randomJitter * 0.3, randomJitter * rng.range(0.7, 1.1), scale3(cliffgrassColor, rng.range(0.85, 1.05)), paletteColor, 1, 2)
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildReed(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    c0Color = colorToRgb(4880956),
    paletteColor = colorToRgb(11059046)
  for (let index = 0; index < 6; index++) {
    const randomAngle = rng.range(0, FULL_TURN_RADIANS),
      randomJitter = Math.cos(randomAngle) * rng.range(0, 0.16),
      randomJitterEdge = Math.sin(randomAngle) * rng.range(0, 0.16),
      coordY = rng.range(0.7, 1.25),
      randomJitterTip = rng.range(0.05, 0.3),
      randomJitterBase = rng.range(0.03, 0.045),
      cosComponent = Math.cos(randomAngle),
      sinComponent = Math.sin(randomAngle),
      vertexHandle = meshBuilder.vertex(randomJitter - sinComponent * randomJitterBase, 0, randomJitterEdge + cosComponent * randomJitterBase, c0Color, 0, 1, 0, 0),
      vertexHandleEdge = meshBuilder.vertex(randomJitter + sinComponent * randomJitterBase, 0, randomJitterEdge - cosComponent * randomJitterBase, c0Color, 0, 1, 0, 0),
      blendColor = meshBuilder.vertex(randomJitter + cosComponent * randomJitterTip * 0.4 - sinComponent * randomJitterBase * 0.7, coordY * 0.6, randomJitterEdge + sinComponent * randomJitterTip * 0.4 + cosComponent * randomJitterBase * 0.7, lerp3(c0Color, paletteColor, 0.6), 0, 1, 0, 0.45),
      blendColorEdge = meshBuilder.vertex(randomJitter + cosComponent * randomJitterTip * 0.4 + sinComponent * randomJitterBase * 0.7, coordY * 0.6, randomJitterEdge + sinComponent * randomJitterTip * 0.4 - cosComponent * randomJitterBase * 0.7, lerp3(c0Color, paletteColor, 0.6), 0, 1, 0, 0.45),
      vertexHandleTip = meshBuilder.vertex(randomJitter + cosComponent * randomJitterTip, coordY, randomJitterEdge + sinComponent * randomJitterTip, paletteColor, 0, 1, 0, 1)
    ;(meshBuilder.quad(vertexHandle, vertexHandleEdge, blendColorEdge, blendColor), meshBuilder.tri(blendColor, blendColorEdge, vertexHandleTip))
  }
  const c0ColorEdge = colorToRgb(6964784)
  for (let treeIndex = 0; treeIndex < 2; treeIndex++) {
    const randomAngleEdge = rng.range(0, FULL_TURN_RADIANS),
      cosOffset = Math.cos(randomAngleEdge) * 0.1,
      sinOffset = Math.sin(randomAngleEdge) * 0.1,
      randomAmount = rng.range(1, 1.4)
    ;(buildTubeAlongPath(
      meshBuilder,
      [
        [cosOffset, 0, sinOffset, 0.018],
        [cosOffset, randomAmount, sinOffset, 0.014],
      ],
      { sides: 3, c0: c0Color, c1: lerp3(c0Color, paletteColor, 0.5), sway0: 0, sway1: 0.6 },
    ),
      buildTubeAlongPath(
        meshBuilder,
        [
          [cosOffset, randomAmount - 0.02, sinOffset, 0.045],
          [cosOffset, randomAmount + 0.22, sinOffset, 0.045],
          [cosOffset, randomAmount + 0.3, sinOffset, 0.012],
        ],
        { sides: 4, c0: c0ColorEdge, c1: scale3(c0ColorEdge, 1.25), sway0: 0.6, sway1: 0.75 },
      ))
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildFlower(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(5214280),
    variantIndex = 3
  for (let index = 0; index < variantIndex; index++) {
    const randomAngle = (index / variantIndex) * FULL_TURN_RADIANS + rng.range(-0.4, 0.4),
      randomJitter = rng.range(0.08, 0.2),
      coordX = Math.cos(randomAngle) * randomJitter,
      coordZ = Math.sin(randomAngle) * randomJitter,
      coordY = rng.range(0.12, 0.22),
      blendColor = meshBuilder.vertex(coordX - 0.012, 0, coordZ, scale3(paletteColor, 0.7), 0, 1, 0, 0),
      blendColorEdge = meshBuilder.vertex(coordX + 0.012, 0, coordZ, scale3(paletteColor, 0.7), 0, 1, 0, 0),
      vertexHandle = meshBuilder.vertex(coordX, coordY, coordZ, paletteColor, 0, 1, 0, 0.5)
    meshBuilder.tri(blendColor, blendColorEdge, vertexHandle)
    const randomJitterEdge = rng.range(0.1, 0.13),
      vertexHandleEdge = meshBuilder.vertex(coordX, coordY + 0.025, coordZ, [1, 0.85, 0.4], 0, 1, 0, 0.5),
      randomAngleEdge = rng.range(0, FULL_TURN_RADIANS)
    for (let indexEdge = 0; indexEdge < 5; indexEdge++) {
      const azimuth = randomAngleEdge + (indexEdge / 5) * FULL_TURN_RADIANS,
        unitSize = 0.42,
        vertexHandleTip = meshBuilder.vertex(coordX + Math.cos(azimuth - unitSize) * randomJitterEdge * 0.75, coordY + 0.012, coordZ + Math.sin(azimuth - unitSize) * randomJitterEdge * 0.75, [0.92, 0.92, 0.92], 0, 1, 0, 0.5, 0, 1),
        vertexHandleBase = meshBuilder.vertex(coordX + Math.cos(azimuth) * randomJitterEdge, coordY + 0.004, coordZ + Math.sin(azimuth) * randomJitterEdge, [1, 1, 1], 0, 1, 0, 0.5, 0, 1),
        vertexHandleInner = meshBuilder.vertex(coordX + Math.cos(azimuth + unitSize) * randomJitterEdge * 0.75, coordY + 0.012, coordZ + Math.sin(azimuth + unitSize) * randomJitterEdge * 0.75, [0.92, 0.92, 0.92], 0, 1, 0, 0.5, 0, 1)
      meshBuilder.quad(vertexHandleEdge, vertexHandleInner, vertexHandleBase, vertexHandleTip)
    }
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildGrassTuft(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(5212740),
    paletteColorEdge = colorToRgb(8368206),
    paletteColorTip = colorToRgb(11849576),
    propIndex = 3
  for (let index = 0; index < propIndex; index++) {
    const randomAngle = (index / propIndex) * FULL_TURN_RADIANS + rng.range(-0.6, 0.6),
      coordY = rng.range(0.2, 0.36),
      randomJitter = rng.range(0.035, 0.05),
      randomJitterEdge = rng.range(0.08, 0.2),
      cosOffset = Math.cos(randomAngle),
      sinOffset = Math.sin(randomAngle),
      vertexHandle = meshBuilder.vertex(cosOffset * 0.03 + sinOffset * randomJitter, 0, sinOffset * 0.03 - cosOffset * randomJitter, paletteColor, 0, 1, 0, 0),
      vertexHandleEdge = meshBuilder.vertex(cosOffset * 0.03 - sinOffset * randomJitter, 0, sinOffset * 0.03 + cosOffset * randomJitter, paletteColor, 0, 1, 0, 0),
      vertexHandleTip = meshBuilder.vertex(cosOffset * randomJitterEdge * 0.5 + sinOffset * randomJitter * 0.7, coordY * 0.6, sinOffset * randomJitterEdge * 0.5 - cosOffset * randomJitter * 0.7, paletteColorEdge, 0, 1, 0, 0.5),
      vertexHandleBase = meshBuilder.vertex(cosOffset * randomJitterEdge * 0.5 - sinOffset * randomJitter * 0.7, coordY * 0.6, sinOffset * randomJitterEdge * 0.5 + cosOffset * randomJitter * 0.7, paletteColorEdge, 0, 1, 0, 0.5),
      vertexHandleInner = meshBuilder.vertex(cosOffset * randomJitterEdge, coordY, sinOffset * randomJitterEdge, paletteColorTip, 0, 1, 0, 1)
    ;(meshBuilder.quad(vertexHandle, vertexHandleEdge, vertexHandleBase, vertexHandleTip), meshBuilder.tri(vertexHandleTip, vertexHandleBase, vertexHandleInner))
  }
  return finalizeMeshBuilder(meshBuilder)
}

function buildBanner() {
  const meshBuilder = new MeshBuilder(),
    c1Color = colorToRgb(5915446),
    c0Color = colorToRgb(15251530),
    unitSize = 4.2
  ;(buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.09],
      [0, unitSize, 0, 0.07],
    ],
    { sides: 6, c0: scale3(c1Color, 0.7), c1: c1Color },
  ),
    buildTubeAlongPath(
      meshBuilder,
      [
        [-0.62, unitSize - 0.35, 0, 0.045],
        [0.62, unitSize - 0.35, 0, 0.045],
      ],
      { sides: 5, c0: c0Color, c1: c0Color },
    ),
    buildCrystalShard(meshBuilder, 0, unitSize - 0.05, 0, 0.5, 0.11, 0, 0, c0Color, scale3(c0Color, 1.3), 0.25, 5))
  const sageIndex = 4,
    indexEdge = 6,
    unitSizeEdge = 1.1,
    unitSizeTip = 2.5,
    planeOffset = unitSize - 0.38,
    items = []
  for (let index = 0; index <= indexEdge; index++) {
    const itemsEdge = [],
      progress = index / indexEdge
    for (let indexTip = 0; indexTip <= sageIndex; indexTip++) {
      const progressEdge = indexTip / sageIndex,
        coordX = (progressEdge - 0.5) * unitSizeEdge,
        factor = index === indexEdge ? Math.abs(progressEdge - 0.5) * 2 * 0.36 - 0.36 : 0,
        coordY = planeOffset - progress * unitSizeTip - factor,
        isCorner = Math.abs(progressEdge - 0.5) > 0.38,
        weightedSum = 0.82 + 0.18 * (1 - progress) + (isCorner ? 0.06 : 0),
        vertexColor = isCorner || index === 0 ? c0Color : [weightedSum, weightedSum, weightedSum]
      itemsEdge.push(meshBuilder.vertex(coordX, coordY, 0.06, vertexColor, 0, 0.15, 1, progress * progress * 0.9, 0, isCorner || index === 0 ? 0 : 1, 1))
    }
    items.push(itemsEdge)
  }
  for (let indexBase = 0; indexBase < indexEdge; indexBase++) for (let indexInner = 0; indexInner < sageIndex; indexInner++) meshBuilder.quad(items[indexBase][indexInner], items[indexBase + 1][indexInner], items[indexBase + 1][indexInner + 1], items[indexBase][indexInner + 1])
  const coordYEdge = planeOffset - unitSizeTip * 0.42,
    coordXEdge = 0.2,
    vertexHandle = meshBuilder.vertex(0, coordYEdge + coordXEdge * 1.5, 0.075, c0Color, 0, 0, 1, 0.16, 0.3),
    vertexHandleEdge = meshBuilder.vertex(-coordXEdge, coordYEdge, 0.075, c0Color, 0, 0, 1, 0.2, 0.3),
    vertexHandleTip = meshBuilder.vertex(0, coordYEdge - coordXEdge * 1.5, 0.075, c0Color, 0, 0, 1, 0.26, 0.3),
    vertexHandleBase = meshBuilder.vertex(coordXEdge, coordYEdge, 0.075, c0Color, 0, 0, 1, 0.2, 0.3)
  return (meshBuilder.quad(vertexHandle, vertexHandleEdge, vertexHandleTip, vertexHandleBase), finalizeMeshBuilder(meshBuilder))
}

function buildBrazier() {
  const meshBuilder = new MeshBuilder()
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.5],
      [0, 0.25, 0, 0.5],
      [0, 0.4, 0, 0.3],
      [0, 1.5, 0, 0.24],
      [0, 1.65, 0, 0.42],
      [0, 1.85, 0, 0.46],
    ],
    { sides: 6, c0: [0.6, 0.62, 0.68], c1: [1, 1, 1], cap: !0 },
  )
  const c0Color = colorToRgb(15251530)
  return (
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, 1.86, 0, 0.5],
        [0, 1.96, 0, 0.5],
      ],
      { sides: 6, c0: c0Color, c1: c0Color, cap: !0 },
    ),
    finalizeMeshBuilder(meshBuilder)
  )
}

function buildBrazierCrystal() {
  const meshBuilder = new MeshBuilder()
  return (buildCrystalShard(meshBuilder, 0, 2.25, 0, 0.95, 0.2, 0, 0, [0.75, 0.75, 0.75], [1, 1, 1], 1, 3), buildCrystalShard(meshBuilder, 0, 2.3, 0, 0.42, 0.2, Math.PI, 0, [0.75, 0.75, 0.75], [1, 1, 1], 1, 4), finalizeMeshBuilder(meshBuilder))
}

function buildRuinStone(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(11118240),
    paletteColorEdge = colorToRgb(7302776),
    blobRadius = rng.range(0.4, 0.7),
    blobDepth = rng.range(0.22, 0.45),
    blobHeight = rng.range(0.28, 0.4)
  return (buildPuffedBlobMesh(meshBuilder, 0, blobDepth * 0.45, 0, blobRadius, blobDepth, blobHeight, { detail: 0, bump: 0.12, seed: seed, bottom: paletteColorEdge, top: paletteColor, flat: !0 }), finalizeMeshBuilder(meshBuilder))
}

function buildLilyPad(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    paletteColor = colorToRgb(4165461),
    paletteColorEdge = colorToRgb(7977058),
    paletteColorTip = colorToRgb(5216848),
    pillarIndex = 10,
    randomAmount = rng.range(0.45, 0.8),
    vertexHandle = meshBuilder.vertex(0, 0.012, 0, paletteColor, 0, 1, 0),
    items = [],
    itemsEdge = []
  for (let index = 0; index <= pillarIndex; index++) {
    const azimuth = randomAmount * 0.5 + (index / pillarIndex) * (FULL_TURN_RADIANS - randomAmount),
      sinOffset = 0.94 + 0.06 * Math.sin(index * 2.1 + seed)
    ;(items.push(meshBuilder.vertex(Math.cos(azimuth) * 0.55, 0.014, Math.sin(azimuth) * 0.55, index % 2 === 0 ? paletteColorEdge : paletteColorTip, 0, 1, 0)),
      itemsEdge.push(meshBuilder.vertex(Math.cos(azimuth) * sinOffset, 0.03, Math.sin(azimuth) * sinOffset, scale3(paletteColorEdge, 0.92), Math.cos(azimuth) * 0.3, 0.95, Math.sin(azimuth) * 0.3)))
  }
  for (let indexEdge = 0; indexEdge < pillarIndex; indexEdge++) (meshBuilder.tri(vertexHandle, items[indexEdge + 1], items[indexEdge]), meshBuilder.quad(items[indexEdge], items[indexEdge + 1], itemsEdge[indexEdge + 1], itemsEdge[indexEdge]))
  return finalizeMeshBuilder(meshBuilder)
}

function buildLotusBud() {
  const meshBuilder = new MeshBuilder()
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.1, 0, 0.02],
      [0, 0.22, 0, 0.018],
    ],
    { sides: 3, c0: colorToRgb(4160072), c1: colorToRgb(5938262), sway1: 0.3 },
  )
  const decalIndex = 5,
    vertexHandle = meshBuilder.vertex(0, 0.5, 0, [1, 1, 1], 0, 1, 0, 0.4, 0.15, 1),
    vertexHandleEdge = meshBuilder.vertex(0, 0.2, 0, [0.75, 0.75, 0.75], 0, -1, 0, 0.3, 0, 1),
    items = []
  for (let index = 0; index < decalIndex; index++) {
    const azimuth = (index / decalIndex) * FULL_TURN_RADIANS
    items.push(meshBuilder.vertex(Math.cos(azimuth) * 0.1, 0.31, Math.sin(azimuth) * 0.1, [0.9, 0.9, 0.9], Math.cos(azimuth), 0.3, Math.sin(azimuth), 0.35, 0.1, 1))
  }
  for (let indexEdge = 0; indexEdge < decalIndex; indexEdge++) (meshBuilder.tri(items[indexEdge], vertexHandle, items[(indexEdge + 1) % decalIndex]), meshBuilder.tri(vertexHandleEdge, items[indexEdge], items[(indexEdge + 1) % decalIndex]))
  return finalizeMeshBuilder(meshBuilder)
}

function buildPropLibrary() {
  const noiseFn = (variantCount, noiseFn, baseSeed) => Array.from({ length: variantCount }, (index, indexEdge) => noiseFn(baseSeed + indexEdge * 101)),
    amberColor = colorToRgb(RANDOM_PROP_ENV.amber),
    treesConfig = {
      trees: noiseFn(4, (propIndex) => buildRandomProp(propIndex), 11),
      accentTrees: [buildRandomProp(211, { dark: 12085892, mid: 15247800, light: 16770026 }), buildRandomProp(223, { dark: 9071156, mid: 12884554, light: 15257742 })],
      willows: noiseFn(2, buildWillowTree, 307),
      farTrees: noiseFn(3, buildFarTree, 17),
      pines: noiseFn(3, buildPineTree, 23),
      shrubs: noiseFn(3, buildShrub, 37),
      rocks: noiseFn(4, (rockIndex) => buildRock(rockIndex, !1), 41),
      boulders: noiseFn(3, (boulderIndex) => buildRock(boulderIndex, !0), 53),
      crystals: noiseFn(3, (crystalIndex) => buildCrystalCluster(crystalIndex, !1), 67),
      bigCrystals: noiseFn(2, (bigCrystalIndex) => buildCrystalCluster(bigCrystalIndex, !0), 79),
      pillars: noiseFn(2, (pillarIndex) => buildPillar(pillarIndex, !1), 83),
      tallPillars: noiseFn(2, (tallPillarIndex) => buildPillar(tallPillarIndex, !0), 97),
      mushrooms: noiseFn(3, buildMushroom, 103),
      brackets: noiseFn(2, buildBracketFungus, 109),
      lanterns: noiseFn(2, (lanternIndex) => buildLanternOrBell(lanternIndex, scale3(amberColor, 1), [1, 0.5, 0.18], 1), 113),
      bells: noiseFn(2, (bellIndex) => buildLanternOrBell(bellIndex, [0.8, 0.8, 0.8], [1, 1, 1], 0.5, !0), 211),
      ferns: noiseFn(3, buildFern, 157),
      vines: noiseFn(3, buildVine, 163),
      drapes: noiseFn(3, buildDrape, 167),
      reeds: noiseFn(2, buildReed, 173),
      flowers: noiseFn(3, buildFlower, 127),
      tufts: noiseFn(4, buildGrassTuft, 131),
      ruinStones: noiseFn(3, buildRuinStone, 139),
      lilyPads: noiseFn(2, buildLilyPad, 149),
      lotusBud: buildLotusBud(),
      banner: buildBanner(),
      brazier: buildBrazier(),
      brazierCrystal: buildBrazierCrystal(),
    },
    items = []
  for (const itemsEdge of Object.values(treesConfig)) Array.isArray(itemsEdge) ? items.push(...itemsEdge) : items.push(itemsEdge)
  return { ...treesConfig, dispose: () => items.forEach((item) => item.dispose()) }
}

function interpolateGlowStops(glowPosition) {
  const gRID_C_CLIFF_GLOW_STOPS = GRID_C_CLIFF_GLOW_STOPS
  if (glowPosition <= gRID_C_CLIFF_GLOW_STOPS[0][0]) return gRID_C_CLIFF_GLOW_STOPS[0][1]
  for (let index = 1; index < gRID_C_CLIFF_GLOW_STOPS.length; index++) if (glowPosition <= gRID_C_CLIFF_GLOW_STOPS[index][0]) return lerpScalar(gRID_C_CLIFF_GLOW_STOPS[index - 1][1], gRID_C_CLIFF_GLOW_STOPS[index][1], (glowPosition - gRID_C_CLIFF_GLOW_STOPS[index - 1][0]) / (gRID_C_CLIFF_GLOW_STOPS[index][0] - gRID_C_CLIFF_GLOW_STOPS[index - 1][0]))
  return gRID_C_CLIFF_GLOW_STOPS[gRID_C_CLIFF_GLOW_STOPS.length - 1][1]
}

function measureRimInset(rimInset, position) {
  const factor = { x: 0, y: 0 }
  let unitSize = 0,
    unitSizeEdge = 0
  const unitSizeTip = 0.12
  for (let total = unitSizeTip; total < 16; total += unitSizeTip) {
    ;((factor.x = position.x + position.nx * total), (factor.y = position.z + position.nz * total))
    const factorEdge = -signedDistanceToPolygon(factor, rimInset)
    if (factorEdge > unitSize) ((unitSize = factorEdge), (unitSizeEdge = total))
    else if (factorEdge < unitSize - 0.02) break
  }
  return { maxD: Math.max(unitSize, 0.05), k: unitSizeEdge > 0 ? unitSizeEdge / Math.max(unitSize, 0.05) : 1 }
}

const WORLD_ENV_PALETTE = ARENA_PALETTE.env,
  WORLD_ROCK_DARK = colorToRgb(WORLD_ENV_PALETTE.rockDark),
  WORLD_ROCK = colorToRgb(WORLD_ENV_PALETTE.rock),
  WORLD_ROCK_LIGHT = colorToRgb(WORLD_ENV_PALETTE.rockLight),
  WORLD_ROCK_WARM = colorToRgb(WORLD_ENV_PALETTE.rockWarm),
  WORLD_MOSS = colorToRgb(WORLD_ENV_PALETTE.moss),
  WORLD_CLIFF_GRASS = colorToRgb(WORLD_ENV_PALETTE.cliffGrass),
  WORLD_CLIFF_GRASS_LIGHT = colorToRgb(WORLD_ENV_PALETTE.cliffGrassLight),
  WORLD_CLIFF_ROCK_A = colorToRgb(9411154),
  WORLD_CLIFF_ROCK_B = colorToRgb(7037254),
  WORLD_GROOVE_SIZE = 0.12,
  WORLD_NICHE_RIM_HEIGHT = 0.85,
  WORLD_BASE_INSET = 1

/**
 * 创建几何。
 *
 * @param sourcespec - 来源
 * @param cliffPolygon - 次要输入
 * @param noiseY - 第三输入
 * @param cliffSpec - 第四输入
 * @returns 结果对象
 */
function buildCliffGeometry(sourcespec, cliffPolygon, noiseY, cliffSpec: WorldCliffSpec = {}) {
  const roundAndResamplePolygonResult = roundAndResamplePolygon(cliffPolygon, 1.1, 0.85, (sampleIndex) => hashNoise2D(sampleIndex, noiseY, 3)),
    rng = new FastRandom(noiseY * 7919 + 13),
    factor = roundAndResamplePolygonResult.length,
    rimPoints = [],
    pointList = []
  let stepIndex = 0,
    randomAmount = 1 + rng.int(4)
  for (let index = 0; index < factor; index++) {
    const point = roundAndResamplePolygonResult[index]
    if ((randomAmount--, randomAmount <= 0 && index > 0 && index < factor - 1)) {
      const pointEdge = roundAndResamplePolygonResult[index - 1],
        pointTip = roundAndResamplePolygonResult[index + 1],
        distance = Math.hypot(point.x - pointEdge.x, point.z - pointEdge.z) || 1,
        edgeLength = Math.hypot(pointTip.x - point.x, pointTip.z - point.z) || 1,
        prevGrooveInset = Math.min(WORLD_GROOVE_SIZE, distance * 0.3),
        minValueEdge = Math.min(WORLD_GROOVE_SIZE, edgeLength * 0.3)
      ;(rimPoints.push({ x: point.x + ((pointEdge.x - point.x) / distance) * prevGrooveInset, y: point.z + ((pointEdge.z - point.z) / distance) * prevGrooveInset }),
        pointList.push({ col: stepIndex, groove: 0, niche: 0 }),
        rimPoints.push({ x: point.x, y: point.z }),
        pointList.push({ col: stepIndex, groove: 1, niche: 0 }),
        stepIndex++,
        rimPoints.push({ x: point.x + ((pointTip.x - point.x) / edgeLength) * minValueEdge, y: point.z + ((pointTip.z - point.z) / edgeLength) * minValueEdge }),
        pointList.push({ col: stepIndex, groove: 0, niche: 0 }),
        (randomAmount = 1 + rng.int(4)))
    } else (rimPoints.push({ x: point.x, y: point.z }), pointList.push({ col: stepIndex, groove: 0, niche: 0 }))
  }
  const weightedSum = stepIndex + 1,
    computePolygonRimFramesResult = computePolygonRimFrames(rimPoints),
    factorEdge = computePolygonRimFramesResult.length,
    rimInsets = computePolygonRimFramesResult.map((item) => measureRimInset(cliffPolygon, item))
  let unitSize = 0
  for (const factorTip of rimInsets) unitSize = Math.max(unitSize, factorTip.maxD)
  const ridgeVariant = unitSize < 2.62 ? "ridge" : hashNoise2D(noiseY, 11, 5) < 0.5 ? "terrace" : "steep",
    minValueTip = ridgeVariant === "ridge" ? 1.75 + hashNoise2D(noiseY, 7, 1) * 0.35 : 2.3 + Math.min(0.7, unitSize * 0.13) + hashNoise2D(noiseY, 7, 1) * 0.35,
    items = []
  for (const nich of cliffSpec.niches ?? []) {
    let factorBase = -1,
      position = 2.5
    for (let indexEdge = 0; indexEdge < factorEdge; indexEdge++) {
      const edgeLengthEdge = Math.hypot(computePolygonRimFramesResult[indexEdge].x - nich.x, computePolygonRimFramesResult[indexEdge].z - nich.y)
      edgeLengthEdge < position && rimInsets[indexEdge].maxD > WORLD_BASE_INSET + 0.9 && ((position = edgeLengthEdge), (factorBase = indexEdge))
    }
    if (!(factorBase < 0)) {
      items.push(factorBase)
      for (let indexTip = -3; indexTip <= 3; indexTip++) {
        const nicheRimIndex = (factorBase + indexTip + factorEdge) % factorEdge,
          factorInner = Math.abs(indexTip) <= 1 ? 1 : Math.abs(indexTip) === 2 ? 0.65 : 0.2
        pointList[nicheRimIndex].niche = Math.max(pointList[nicheRimIndex].niche, factorInner)
      }
    }
  }
  const pointListEdge = []
  for (let indexBase = 0; indexBase < weightedSum; indexBase++) {
    const isCorner = ridgeVariant === "terrace",
      chanceResult = rng.chance(isCorner ? 0.15 : 0.35)
    pointListEdge.push({
      inset: rng.range(0, isCorner ? 0.34 : 0.22),
      rimDy: (rng.next() - 0.5) * (ridgeVariant === "ridge" ? 0.9 : 0.7),
      ledgeY: chanceResult ? rng.range(0.35, 0.6) : lerpScalar(0.55, minValueTip * 0.68, rng.next()),
      shelf: chanceResult ? rng.range(0.02, 0.06) : isCorner ? rng.range(0.25, 0.6) : rng.range(0.1, 0.3),
      tone: rng.range(0.86, 1.12),
      bare: rng.chance(0.28),
      moss: rng.next(),
      batter: rng.range(0, 0.16),
      groove: rng.range(0.08, 0.3),
    })
  }
  const noiseFn = (bandIndex) => {
      const factor = pointList[bandIndex],
        factorEdge = pointListEdge[factor.col],
        scaledExtent = (fbmNoise2D(computePolygonRimFramesResult[bandIndex].s * 0.16, noiseY * 0.37, 2, noiseY) - 0.5) * 0.5
      return minValueTip + factorEdge.rimDy + scaledExtent - factor.groove * 0.14
    },
    filterResult = GRID_C_CLIFF_BANDS.filter((band, bandIndex) => bandIndex < 3 || band < unitSize - 0.25 || bandIndex === GRID_C_CLIFF_BANDS.length - 1),
    weightedSumEdge = 7 + filterResult.length,
    pointListTip = []
  extrudeRibbonBand(
    sourcespec,
    computePolygonRimFramesResult,
    !0,
    weightedSumEdge,
    (rimPoint, bandIndex, rowIndex) => {
      const selectedM = rimInsets[bandIndex],
        bandEntry = pointList[bandIndex],
        bandValue = pointListEdge[bandEntry.col],
        grooveDepth = bandEntry.groove,
        nicheDepth = bandEntry.niche,
        grooveStart = (hashNoise2D(bandIndex * 7 + rowIndex, noiseY, 41) - 0.5) * 0.13 * (1 - nicheDepth),
        grooveEnd = (hashNoise2D(bandIndex * 5 + rowIndex, noiseY, 43) - 0.5) * 0.16 * (1 - nicheDepth),
        grooveInner = bandValue.groove,
        _Result = noiseFn(bandIndex),
        lerpScalarResult = lerpScalar(bandValue.ledgeY, WORLD_NICHE_RIM_HEIGHT, nicheDepth),
        shelfHeight = 0.1 + lerpScalar(bandValue.shelf, WORLD_BASE_INSET, nicheDepth) + bandValue.inset * (1 - nicheDepth) + grooveDepth * grooveInner,
        coreDistance = Math.max(GRID_C_BASE_DISTANCE, shelfHeight + 0.3 + bandValue.batter)
      let edgeX,
        edgeZ,
        edgeNormalX,
        edgeNormalZ = 1,
        edgeWeight = 1
      switch (rowIndex) {
        case 0:
          ;((edgeX = 0), (edgeZ = -0.05), (edgeNormalX = lerp3(WORLD_ROCK_DARK, WORLD_ROCK, 0.25)), (edgeNormalZ = 0.62))
          break
        case 1:
          ;((edgeX = 0.05 + Math.max(0, grooveStart) + grooveDepth * grooveInner), (edgeZ = lerpScalarResult - 0.13 + grooveEnd * 0.5), (edgeNormalX = lerp3(WORLD_ROCK_DARK, WORLD_ROCK_LIGHT, 0.42)), (edgeNormalZ = 0.92 - grooveDepth * 0.3))
          break
        case 2:
          ;((edgeX = 0.1 + grooveDepth * grooveInner), (edgeZ = lerpScalarResult), (edgeNormalX = lerp3(WORLD_ROCK, WORLD_ROCK_LIGHT, 0.6)), (edgeNormalZ = 1 - grooveDepth * 0.35))
          break
        case 3:
          ;((edgeX = shelfHeight - 0.03), (edgeZ = lerpScalarResult + 0.04), (edgeNormalX = lerp3(lerp3(WORLD_ROCK, WORLD_ROCK_LIGHT, 0.45), WORLD_MOSS, smoothStepScalar(0.35, 0.8, bandValue.moss) * 0.6 * (1 - nicheDepth))), (edgeNormalZ = 0.72 - grooveDepth * 0.15), (edgeWeight = 0.75))
          break
        case 4:
          ;((edgeX = shelfHeight + 0.03 + grooveStart + bandValue.batter * 0.5), (edgeZ = lerpScalar(lerpScalarResult, _Result, 0.5) + grooveEnd), (edgeNormalX = lerp3(WORLD_ROCK, WORLD_ROCK_LIGHT, 0.3)), (edgeNormalZ = 0.95 - grooveDepth * 0.35))
          break
        case 5:
          ;((edgeX = shelfHeight + 0.07 + grooveStart * 0.6 + bandValue.batter), (edgeZ = _Result - 0.2), (edgeNormalX = lerp3(WORLD_ROCK, WORLD_ROCK_LIGHT, bandValue.bare ? 0.7 : 0.45)), (edgeNormalZ = 1 - grooveDepth * 0.4))
          break
        case 6:
          ;((edgeX = shelfHeight + 0.2 + bandValue.batter), (edgeZ = _Result - 0.03), (edgeNormalX = bandValue.bare ? lerp3(WORLD_ROCK_LIGHT, WORLD_ROCK_WARM, 0.7) : lerp3(WORLD_MOSS, WORLD_CLIFF_GRASS, 0.45)), (edgeNormalZ = 1 - grooveDepth * 0.4), (edgeWeight = bandValue.bare ? 1 : 0.35))
          break
        default: {
          const localOffset = rowIndex - 7
          edgeX = localOffset === 0 ? coreDistance : Math.max(filterResult[localOffset], coreDistance + localOffset * 0.12)
          const clampDistance = Math.min(edgeX, selectedM.maxD),
            pointX = rimPoint.x + rimPoint.nx * clampDistance * selectedM.k,
            pointZ = rimPoint.z + rimPoint.nz * clampDistance * selectedM.k,
            smoothStepScalarResult = smoothStepScalar(0, 1, (clampDistance - GRID_C_BASE_DISTANCE) / Math.max(0.25, Math.min(1.8, selectedM.maxD - GRID_C_BASE_DISTANCE)))
          {
            edgeZ = lerpScalar(_Result, minValueTip, smoothStepScalarResult) + interpolateGlowStops(clampDistance)
            const fbmNoise2DResult = fbmNoise2D(pointX * 0.22, pointZ * 0.22, 2, noiseY),
              fbmNoise2DFbmNoise2DResult = fbmNoise2D(pointX * 0.5 + 7.1, pointZ * 0.5 + 1.3, 2, noiseY + 3)
            let grassColor = lerp3(WORLD_CLIFF_GRASS, WORLD_CLIFF_GRASS_LIGHT, smoothStepScalar(0.3, 0.7, fbmNoise2DResult))
            ;((grassColor = lerp3(grassColor, WORLD_CLIFF_ROCK_A, smoothStepScalar(0.58, 0.8, fbmNoise2DFbmNoise2DResult) * 0.6)), (grassColor = lerp3(grassColor, WORLD_CLIFF_ROCK_B, smoothStepScalar(0.7, 0.85, 1 - fbmNoise2DFbmNoise2DResult) * smoothStepScalar(0.5, 0.7, fbmNoise2DResult) * 0.55)))
            const blendWeight = Math.min(1, (clampDistance - GRID_C_BASE_DISTANCE) / 0.7)
            ;((edgeNormalX = bandValue.bare ? lerp3(lerp3(WORLD_ROCK_LIGHT, WORLD_ROCK_WARM, 0.5), grassColor, 0.45 + 0.55 * blendWeight) : lerp3(lerp3(WORLD_MOSS, WORLD_CLIFF_GRASS, 0.6), grassColor, blendWeight)), (edgeWeight = bandValue.bare ? GRID_C_GLOW_LOW + (1 - blendWeight) * 0.4 : GRID_C_GLOW_LOW))
          }
          return ((edgeNormalZ = localOffset === 0 ? 1 - grooveDepth * 0.3 : 1), { t: clampDistance * selectedM.k, y: edgeZ, color: localOffset === 0 ? scale3(edgeNormalX, bandValue.tone) : edgeNormalX, ao: edgeNormalZ, tex: edgeWeight })
        }
      }
      return { t: Math.min(edgeX, selectedM.maxD) * selectedM.k, y: edgeZ, color: scale3(edgeNormalX, bandValue.tone * (1 - grooveDepth * 0.22)), ao: edgeNormalZ, tex: edgeWeight }
    },
    (bucketIndex) => (bucketIndex < 6 ? BUCKET_MIN : SIGN_NEGATIVE),
  )
  for (let indexInner = 0; indexInner < factorEdge; indexInner++) {
    const selectedL = pointList[indexInner]
    if (selectedL.groove) continue
    const selectedV = pointListEdge[selectedL.col],
      selectedH = computePolygonRimFramesResult[indexInner],
      weightedSumTip = 0.1 + lerpScalar(selectedV.shelf, WORLD_BASE_INSET, selectedL.niche) + selectedV.inset * (1 - selectedL.niche) + selectedV.batter
    pointListTip.push({ x: selectedH.x, z: selectedH.z, ox: -selectedH.nx, oz: -selectedH.nz, y: noiseFn(indexInner), inset: (weightedSumTip + 0.2) * rimInsets[indexInner].k, bare: selectedV.bare || selectedL.niche > 0.1 })
  }
  const nicheRimPoints = items.map((item) => {
    const rimFrame = computePolygonRimFramesResult[item],
      rimOffset = (0.1 + WORLD_BASE_INSET * 0.5) * rimInsets[item].k
    return { x: rimFrame.x + rimFrame.nx * rimOffset, z: rimFrame.z + rimFrame.nz * rimOffset, y: WORLD_NICHE_RIM_HEIGHT + 0.04, ox: -rimFrame.nx, oz: -rimFrame.nz }
  })
  return { poly: cliffPolygon, kind: ridgeVariant, height: minValueTip, inradius: unitSize, topY: (ridgeHeight) => minValueTip + interpolateGlowStops(ridgeHeight), rim: pointListTip, niches: nicheRimPoints }
}

function createEmptyEffectsBuffer() {
  return { glows: [], aoBlobs: [], casters: [], ripples: [] }
}

class SpatialClaimGrid {
  constructor(sampleSpacing = 8) {
    this.spacing = sampleSpacing
  }
  spacing
  cells = new Map()
  key(gridX, gridZ) {
    return (gridX + 512) * 4096 + (gridZ + 512)
  }
  claim(cellX, cellZ, defaultValue = this.spacing) {
    const spacing = this.spacing,
      cellGridX = Math.floor(cellX / spacing),
      cellGridZ = Math.floor(cellZ / spacing),
      cellSearchRadius = Math.ceil(defaultValue / spacing)
    for (let index = -cellSearchRadius; index <= cellSearchRadius; index++)
      for (let cellIndex = -cellSearchRadius; cellIndex <= cellSearchRadius; cellIndex++) {
        const Value = this.cells.get(this.key(cellGridX + cellIndex, cellGridZ + index))
        if (Value) {
          for (const factor of Value) if (Math.hypot(factor[0] - cellX, factor[1] - cellZ) < defaultValue) return !1
        }
      }
    return (this.reserve(cellX, cellZ), !0)
  }
  reserve(cellX, cellZ) {
    const lookupKey = this.key(Math.floor(cellX / this.spacing), Math.floor(cellZ / this.spacing)),
      getValue = this.cells.get(lookupKey)
    getValue ? getValue.push([cellX, cellZ]) : this.cells.set(lookupKey, [[cellX, cellZ]])
  }
}

/**
 * 创建地形。
 *
 * @param bushMap - 输入
 * @returns 结果对象
 */
function createOuterTerrainSampler(bushMap) {
  const bound = bushMap.map.bound,
    noiseFn = (edgeValue, fadeValue) => smoothStepScalar(bound - 13, bound - 1.5, fadeValue),
    noiseFnEdge = (target, blendFactor) => {
      const sampleAngle = Math.atan2(blendFactor, target)
      return 17.5 + fbmNoise2D(Math.cos(sampleAngle) * 2.2 + 5, Math.sin(sampleAngle) * 2.2 + 5, 3, 91) * 4.5
    }
  return {
    heightAt: (worldX, worldZ) => {
      const planeOffset = Math.max(Math.abs(worldX), Math.abs(worldZ)) - bound,
        eResult = noiseFn(worldX, worldZ),
        scaledExtent = (fbmNoise2D(worldX * 0.07 + 3.1, worldZ * 0.07 + 1.7, 3, 57) - 0.35) * 3.2 * smoothStepScalar(1.5, 8, planeOffset),
        sResult = noiseFnEdge(worldX, worldZ),
        plateauBlend = smoothStepScalar(sResult - 5, sResult, planeOffset),
        planeOffsetEdge = GRID_A_PLATEAU_HEIGHT + 0.12 + scaledExtent * (1 - plateauBlend * 0.7) - plateauBlend * 0.5,
        noiseScale = GRID_A_LOWLAND_DEPTH - 0.03 * planeOffset + (fbmNoise2D(worldX * 0.11, worldZ * 0.11, 2, 61) - 0.5) * 0.5
      let terrainHeight = lerpScalar(planeOffsetEdge, noiseScale, eResult)
      const riverDistResult = bushMap.riverDist(worldX, worldZ)
      return (riverDistResult < 2.5 && (terrainHeight -= smoothStepScalar(2.5, 0.2, riverDistResult) * lerpScalar(0, 0.5, eResult)), terrainHeight)
    },
    southWeight: noiseFn,
    edgeDist: noiseFnEdge,
  }
}

/**
 * 发送草丛。
 *
 * @param targetBuilder - 来源
 * @param baseX - 次要输入
 * @param baseZ - 第三输入
 * @param baseY - 第四输入
 * @param extentParam - 附加输入
 * @param extentParamEdge - 附加输入
 * @param extentParamTip - 附加输入
 * @param extentParamBase - 附加输入
 * @param extentParamInner - 附加输入
 * @param blendFactor - 附加输入
 * @param isReady - 布尔标志
 * @param extentParamOuter - 附加输入
 */
function emitBushDecalBlade(targetBuilder, baseX, baseZ, baseY, extentParam, extentParamEdge, extentParamTip, extentParamBase, extentParamInner, blendFactor, isReady, extentParamOuter) {
  const scaledExtent = -extentParamBase * extentParamEdge,
    scaledExtentEdge = extentParamTip * extentParamEdge,
    leafIndex = 4,
    items = [],
    blendColor = scale3(lerp3(DECAL_EDGE_DARK_COLOR, DECAL_EDGE_LIGHT_COLOR, blendFactor * 0.25), 0.82),
    blendColorEdge = lerp3(DECAL_EDGE_LIGHT_COLOR, scale3(DECAL_EDGE_LIGHT_COLOR, 1.1), blendFactor),
    blendColorTip = lerp3(DECAL_EDGE_TIP_COLOR, scale3(DECAL_EDGE_LIGHT_COLOR, 1.2), 0.25 + blendFactor * 0.4)
  for (let index = 0; index < leafIndex; index++) {
    const progress = index / (leafIndex - 1),
      scaledExtentTip = progress * progress * (0.6 + 0.4 * progress) * extentParamInner,
      weightedSum = baseX + extentParamTip * scaledExtentTip,
      weightedSumEdge = baseZ + extentParamBase * scaledExtentTip,
      coordY = baseY + extentParam * progress * (1 - 0.2 * progress * progress * Math.abs(extentParamInner) * 2.2),
      scaledExtentBase = (1 - progress * 0.8) * (index === leafIndex - 1 ? 0.22 : 1),
      blendColorBase = progress < 0.34 ? lerp3(blendColor, blendColorEdge, progress / 0.34) : lerp3(blendColorEdge, blendColorTip, (progress - 0.34) / 0.66)
    items.push(targetBuilder.vertex(weightedSum - scaledExtent * scaledExtentBase, coordY, weightedSumEdge - scaledExtentEdge * scaledExtentBase, blendColorBase, 0, 1, 0, progress * progress, extentParamOuter), targetBuilder.vertex(weightedSum + scaledExtent * scaledExtentBase, coordY, weightedSumEdge + scaledExtentEdge * scaledExtentBase, blendColorBase, 0, 1, 0, progress * progress, extentParamOuter))
  }
  for (let indexEdge = 0; indexEdge < leafIndex - 1; indexEdge++) targetBuilder.quad(items[indexEdge * 2], items[indexEdge * 2 + 1], items[indexEdge * 2 + 3], items[indexEdge * 2 + 2])
  if (isReady) {
    const coordX = baseX + extentParamTip * extentParamInner,
      coordZ = baseZ + extentParamBase * extentParamInner,
      coordYEdge = baseY + extentParam * 0.88,
      vertexHandle = targetBuilder.vertex(coordX, coordYEdge, coordZ, DECAL_CENTER_COLOR, 0, 1, 0, 0.9, extentParamOuter),
      vertexHandleEdge = targetBuilder.vertex(coordX - scaledExtent * 1.3, coordYEdge + 0.18, coordZ - scaledExtentEdge * 1.3, DECAL_CENTER_COLOR, 0, 1, 0, 1, extentParamOuter),
      vertexHandleTip = targetBuilder.vertex(coordX + scaledExtent * 1.3, coordYEdge + 0.18, coordZ + scaledExtentEdge * 1.3, DECAL_CENTER_COLOR, 0, 1, 0, 1, extentParamOuter),
      blendColorInner = targetBuilder.vertex(coordX + extentParamTip * 0.08, coordYEdge + 0.46, coordZ + extentParamBase * 0.08, scale3(DECAL_CENTER_COLOR, 1.06), 0, 1, 0, 1, extentParamOuter)
    targetBuilder.quad(vertexHandle, vertexHandleTip, blendColorInner, vertexHandleEdge)
  }
}

/**
 * 创建草丛与几何。
 *
 * @param sourcespec - 来源
 * @param decalPolygon - 次要输入
 * @param seed - 第三输入
 */
function buildBushDecalGeometry(sourcespec, decalPolygon, seed) {
  const rng = new FastRandom(seed)
  let progress = 1 / 0,
    progressEdge = -1 / 0,
    progressTip = 1 / 0,
    progressBase = -1 / 0
  for (const factor of sourcespec) ((progress = Math.min(progress, factor.x)), (progressEdge = Math.max(progressEdge, factor.x)), (progressTip = Math.min(progressTip, factor.y)), (progressBase = Math.max(progressBase, factor.y)))
  const unitSize = 0.2,
    items = [],
    factorEdge = { x: 0, y: 0 }
  for (let index = progressTip; index <= progressBase; index += unitSize)
    for (let indexEdge = progress; indexEdge <= progressEdge; indexEdge += unitSize) ((factorEdge.x = indexEdge + rng.range(-0.5, 0.5) * unitSize), (factorEdge.y = index + rng.range(-0.5, 0.5) * unitSize), isPointInPolygon(factorEdge, sourcespec) && (signedDistanceToPolygon(factorEdge, sourcespec) > -0.1 || decalPolygon.solidDist(factorEdge.x, factorEdge.y) < 0.1 || items.push([factorEdge.x, factorEdge.y])))
  for (let indexTip = items.length - 1; indexTip > 0; indexTip--) {
    const intTotal = rng.int(indexTip + 1),
      selectedC = items[indexTip]
    ;((items[indexTip] = items[intTotal]), (items[intTotal] = selectedC))
  }
  const meshBuilder = new MeshBuilder()
  for (const [weightedSum, weightedSumEdge] of items) {
    ;((factorEdge.x = weightedSum), (factorEdge.y = weightedSumEdge))
    const factorTip = -signedDistanceToPolygon(factorEdge, sourcespec),
      interiorDepthRatio = Math.min(1, factorTip / 0.9),
      randomJitter = (0.95 + rng.range(0, 0.45)) * (0.72 + 0.28 * interiorDepthRatio),
      randomAmount = rng.range(0, Math.PI * 2),
      randomJitterEdge = rng.range(0.1, 0.4),
      isCorner = interiorDepthRatio > 0.6 && rng.chance(0.009)
    emitBushDecalBlade(meshBuilder, weightedSum, weightedSumEdge, decalPolygon.heightAt(weightedSum, weightedSumEdge) - 0.03, isCorner ? randomJitter * 1.2 : randomJitter, 0.07 * rng.range(0.6, 1.4), Math.cos(randomAmount), Math.sin(randomAmount), randomJitterEdge, rng.next(), isCorner, rng.next())
  }
  return meshBuilder.build()
}

/**
 * 创建草丛。
 *
 * @param bushmap - 输入
 * @param bushSpec - 次要输入
 */
function createBushField(bushmap, bushSpec) {
  const shaderMaterial = new ShaderMaterial({
      uniforms: makeLightUniforms({ uTime: ARENA_SHARED_UNIFORMS.uTime, uWind: ARENA_SHARED_UNIFORMS.uWind, uPushers: { value: Array.from({ length: DECAL_MESH_SEGMENTS }, () => new Vector4(0, 0, 1, 0)) }, uReveal: { value: new Vector4(0, 0, 1, 0) } }),
      vertexShader: TERRAIN_DECAL_VERTEX_SHADER,
      fragmentShader: TERRAIN_DECAL_FRAGMENT_SHADER,
      lights: !0,
      fog: !0,
      side: DoubleSide,
    }),
    group = new Group()
  group.name = "bushes"
  const pointList = []
  bushmap.map.bushes.forEach((item, itemIndex) => {
    const BushDecalGeometryValue = buildBushDecalGeometry(item, bushmap, 9e3 + itemIndex * 17),
      decalMesh = new Mesh(BushDecalGeometryValue, shaderMaterial)
    ;((decalMesh.name = `bush:${itemIndex}`),
      (decalMesh.receiveShadow = !0),
      (decalMesh.castShadow = !1),
      (decalMesh.matrixAutoUpdate = !1),
      BushDecalGeometryValue.boundingSphere && (BushDecalGeometryValue.boundingSphere.radius += 0.6),
      group.add(decalMesh),
      pointList.push({ mesh: decalMesh, fullCount: BushDecalGeometryValue.index ? BushDecalGeometryValue.index.count : 0 }))
  })
  const factor = shaderMaterial.uniforms.uPushers.value,
    noiseFn = /**
 * 处理事件。
 *
 * @param detail - 输入
 */
(detail) => {
      for (const factor of pointList) {
        const foliageIndexCount = Math.floor((factor.fullCount * Math.min(1, detail.foliage)) / 3) * 3
        factor.mesh.geometry.setDrawRange(0, foliageIndexCount)
      }
    }
  return (
    noiseFn(bushSpec),
    {
      group: group,
      material: shaderMaterial,
      setPushers(targetObject, propertyName) {
        for (let index = 0; index < DECAL_MESH_SEGMENTS; index++) index < propertyName ? factor[index].set(targetObject[index * 4], targetObject[index * 4 + 1], targetObject[index * 4 + 2], targetObject[index * 4 + 3]) : (factor[index].w = 0)
      },
      setReveal(lookupKey, propertyname, factor, revealProgress) {
        shaderMaterial.uniforms.uReveal.value.set(lookupKey, propertyname, factor, revealProgress)
      },
      setQuality: noiseFn,
    }
  )
}

function createMoteField(sourcespec, moteSpec) {
  const rng = new FastRandom(2718),
    pointList = []
  for (const factor of sourcespec)
    for (let index = 0; index < factor.count; index++) {
      const randomAmount = rng.range(0, Math.PI * 2),
        unitComponent = Math.sqrt(rng.next()) * factor.radius,
        randomAmountEdge = (factor.size ?? 1) * rng.range(0.7, 1.3)
      pointList.push({
        p: [factor.x + Math.cos(randomAmount) * unitComponent, factor.y + (factor.mode === 0 ? rng.range(0, factor.range) : 0), factor.z + Math.sin(randomAmount) * unitComponent],
        seed: [rng.next(), rng.range(0.7, 1.3), randomAmountEdge, factor.mode],
        color: [factor.color[0] * rng.range(0.8, 1.2), factor.color[1] * rng.range(0.8, 1.2), factor.color[2] * rng.range(0.8, 1.2)],
        motion: factor.mode === 1 ? [rng.range(0.1, 0.35), factor.range * rng.range(0.7, 1.2), rng.range(1.5, 4)] : [rng.range(0.25, 0.7), rng.range(0.12, 0.35), rng.range(1.2, 3.5)],
      })
    }
  for (let bushIndex = pointList.length - 1; bushIndex > 0; bushIndex--) {
    const intResult = rng.int(bushIndex + 1),
      selectedS = pointList[bushIndex]
    ;((pointList[bushIndex] = pointList[intResult]), (pointList[intResult] = selectedS))
  }
  const factorEdge = pointList.length,
    float32Array = new Float32Array(factorEdge * 3),
    floatArray = new Float32Array(factorEdge * 4),
    floatArrayEdge = new Float32Array(factorEdge * 3),
    floatArrayTip = new Float32Array(factorEdge * 3)
  pointList.forEach((item, itemIndex) => {
    ;(float32Array.set(item.p, itemIndex * 3), floatArray.set(item.seed, itemIndex * 4), floatArrayEdge.set(item.color, itemIndex * 3), floatArrayTip.set(item.motion, itemIndex * 3))
  })
  const element = new BufferGeometry()
  ;(element.setAttribute("position", new BufferAttribute(float32Array, 3)), element.setAttribute("aSeed", new BufferAttribute(floatArray, 4)), element.setAttribute("aColor", new BufferAttribute(floatArrayEdge, 3)), element.setAttribute("aMotion", new BufferAttribute(floatArrayTip, 3)))
  const shaderMaterial = new ShaderMaterial({ uniforms: { uTime: ARENA_SHARED_UNIFORMS.uTime, uScale: { value: 300 } }, vertexShader: WATER_VERTEX_SHADER, fragmentShader: WATER_FRAGMENT_SHADER, transparent: !0, depthWrite: !1, blending: AdditiveBlending }),
    points = new Points(element, shaderMaterial)
  ;((points.name = "motes"), (points.frustumCulled = !1), (points.renderOrder = 6))
  const noiseFn = (label) => element.setDrawRange(0, Math.floor(factorEdge * Math.min(1, label.motes)))
  return (
    noiseFn(moteSpec),
    {
      points: points,
      setQuality: noiseFn,
      resize(viewport, pixelRatioCap) {
        shaderMaterial.uniforms.uScale.value = ((viewport * 0.5) / Math.tan((pixelRatioCap * Math.PI) / 360)) * 0.16
      },
    }
  )
}

function emitFrustumAt(targetBuilder, frustumX, frustumY, frustumZ, frustumLength, tipRadius, baseRadius, frustumColorA, frustumColorB, extentParam = 0) {
  ;(EFFECT_SCRATCH_MATRIX.makeTranslation(frustumX, frustumY - tipRadius / 2 + 0.04, frustumZ), buildTaperedFrustum(targetBuilder, EFFECT_SCRATCH_MATRIX, frustumLength, baseRadius, tipRadius, 0, frustumColorA, frustumColorB, extentParam))
}

function buildStarLamp() {
  const meshBuilder = new MeshBuilder()
  ;(buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.1, 0, 0.36],
      [0, 0.1, 0, 0.36],
      [0, 0.14, 0, 0.3],
      [0, 0.24, 0, 0.3],
      [0, 0.28, 0, 0.2],
    ],
    { sides: 8, c0: EFFECT_STONE_DARK_COLOR, c1: EFFECT_CRYSTAL_TINT_COLOR },
  ),
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, 0.28, 0, 0.15],
        [0, 0.82, 0, 0.11],
        [0, 0.86, 0, 0.17],
        [0, 0.93, 0, 0.19],
      ],
      { sides: 8, c0: lerp3(EFFECT_STONE_DARK_COLOR, EFFECT_CRYSTAL_TINT_COLOR, 0.5), c1: EFFECT_CRYSTAL_TINT_COLOR, cap: !0 },
    ))
  for (let index = 0; index < 4; index++) {
    const azimuth = (index / 4) * EFFECT_FULL_TURN_RADIANS + Math.PI / 4,
      cosOffset = Math.cos(azimuth) * 0.16,
      sinOffset = Math.sin(azimuth) * 0.16
    buildTubeAlongPath(
      meshBuilder,
      [
        [cosOffset, 0.93, sinOffset, 0.03],
        [cosOffset, 1.2, sinOffset, 0.03],
      ],
      { sides: 4, c0: EFFECT_STONE_DARK_COLOR, c1: EFFECT_CRYSTAL_TINT_COLOR },
    )
  }
  return (
    buildCrystalShard(meshBuilder, 0, 0.95, 0, 0.26, 0.085, 0, 0, scale3(EFFECT_AMBER_LIGHT_COLOR, 0.85), [1, 0.86, 0.55], 1, 7),
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, 1.19, 0, 0.27],
        [0, 1.23, 0, 0.29],
        [0, 1.3, 0, 0.17],
        [0, 1.44, 0, 0.045],
        [0, 1.52, 0, 0.03],
      ],
      { sides: 8, c0: EFFECT_STONE_DARK_COLOR, c1: lerp3(EFFECT_CRYSTAL_TINT_COLOR, EFFECT_CRYSTAL_TIP_COLOR, 0.5), cap: !0 },
    ),
    buildPuffedBlobMesh(meshBuilder, 0, 1.55, 0, 0.045, 0.045, 0.045, { detail: 0, seed: 3, bottom: EFFECT_BLOB_BASE_COLOR, top: scale3(EFFECT_BLOB_BASE_COLOR, 1.2), glow: 0.2 }),
    meshBuilder.build()
  )
}

function emitRibbonAlongPolyline(targetBuilder, noiseFn, normalX, normalY, normalZ, extentParam, extentParamEdge, noiseY) {
  const vertices = [0.62, 0.9, 0.95],
    distance = /**
 * 处理距离。
 *
 * @param stepCount - 主要输入
 * @param chest - 输入
 */
(stepCount, chest) => {
      for (let index = 0; index < stepCount.length - 1; index++) {
        const [factor, factorEdge] = stepCount[index],
          [factorTip, factorBase] = stepCount[index + 1],
          planeOffset = factorTip - factor,
          planeOffsetEdge = factorBase - factorEdge,
          distance = Math.hypot(planeOffset, planeOffsetEdge) || 1,
          scaledExtent = (-planeOffsetEdge / distance) * chest,
          scaledExtentEdge = (planeOffset / distance) * chest,
          factorInner = [noiseFn(factor - scaledExtent, factorEdge - scaledExtentEdge, 0.012), noiseFn(factor + scaledExtent, factorEdge + scaledExtentEdge, 0.012), noiseFn(factorTip + scaledExtent, factorBase + scaledExtentEdge, 0.012), noiseFn(factorTip - scaledExtent, factorBase - scaledExtentEdge, 0.012)].map((sampleOffset) => targetBuilder.vertex(sampleOffset[0], sampleOffset[1], sampleOffset[2], vertices, normalX, normalY, normalZ, 0, extentParamEdge, 0, 1))
        ;(targetBuilder.quad(factorInner[0], factorInner[1], factorInner[2], factorInner[3]), targetBuilder.quad(factorInner[3], factorInner[2], factorInner[1], factorInner[0]))
      }
    }
  for (let index = 0; index < 3; index++) {
    const scaledExtent = extentParam * (0.42 + index * 0.22),
      noiseScale = 0.5 + hashNoise2D(index, noiseY, 5) * 0.8,
      noiseScaleEdge = 1.5 + hashNoise2D(index, noiseY, 9) * 1.2,
      sampleTable = []
    for (let moteIndex = 0; moteIndex <= 6; moteIndex++) {
      const weightedSum = noiseScale + (noiseScaleEdge * moteIndex) / 6
      sampleTable.push([Math.cos(weightedSum) * scaledExtent, Math.sin(weightedSum) * scaledExtent])
    }
    distance(sampleTable, extentParam * 0.022)
  }
  const sampleTableEdge = []
  for (let indexEdge = 0; indexEdge <= 16; indexEdge++) {
    const azimuth = (indexEdge / 16) * EFFECT_FULL_TURN_RADIANS,
      scaledExtentEdge = extentParam * (indexEdge % 2 === 0 ? 0.2 : 0.09)
    sampleTableEdge.push([Math.cos(azimuth) * scaledExtentEdge, Math.sin(azimuth) * scaledExtentEdge])
  }
  distance(sampleTableEdge, extentParam * 0.02)
}

function buildStele(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    unitSize = 1.1,
    unitSizeEdge = 0.2,
    randomAmount = rng.range(1.35, 1.6),
    randomJitter = rng.range(0.2, 0.45) * (rng.chance(0.5) ? 1 : -1),
    noiseFn = (missing, bandIndex, bandCount) => [missing, bandIndex, bandCount],
    factor = -0.15,
    progress = unitSize / 2,
    scaledExtent = progress * 0.9,
    progressEdge = unitSizeEdge / 2,
    planeOffset = randomAmount - Math.max(0, randomJitter),
    frontTopHeight = randomAmount + Math.min(0, randomJitter),
    mappedVertices = [noiseFn(-progressEdge, factor, -progress), noiseFn(progressEdge, factor, -progress), noiseFn(progressEdge, factor, progress), noiseFn(-progressEdge, factor, progress), noiseFn(-progressEdge * 0.85, planeOffset, -scaledExtent), noiseFn(progressEdge * 0.85, planeOffset, -scaledExtent), noiseFn(progressEdge * 0.85, frontTopHeight, scaledExtent), noiseFn(-progressEdge * 0.85, frontTopHeight, scaledExtent)],
    distance = /**
 * 处理距离。
 *
 * @param startX - 主要输入
 * @param chest - 输入
 * @param startZ - 第三输入
 * @param startY - 第四输入
 * @param extentParam - 附加输入
 * @param extentParamEdge - 附加输入
 */
(startX, chest, startZ, startY, extentParam, extentParamEdge) => {
      const factorOuter = mappedVertices[startX],
        factorMid = mappedVertices[chest],
        factorStart = mappedVertices[startZ],
        planeOffsetTip = factorMid[0] - factorOuter[0],
        planeOffsetBase = factorMid[1] - factorOuter[1],
        planeOffsetInner = factorMid[2] - factorOuter[2],
        planeOffsetOuter = factorStart[0] - factorOuter[0],
        planeOffsetMid = factorStart[1] - factorOuter[1],
        planeOffsetStart = factorStart[2] - factorOuter[2]
      let normalX = planeOffsetBase * planeOffsetStart - planeOffsetInner * planeOffsetMid,
        normalY = planeOffsetInner * planeOffsetOuter - planeOffsetTip * planeOffsetStart,
        normalZ = planeOffsetTip * planeOffsetMid - planeOffsetBase * planeOffsetOuter
      const distance = Math.hypot(normalX, normalY, normalZ) || 1
      ;((normalX /= distance), (normalY /= distance), (normalZ /= distance))
      const vertexHandle = [startX, chest, startZ, startY].map((item, itemIndex) => meshBuilder.vertex(mappedVertices[item][0], mappedVertices[item][1], mappedVertices[item][2], itemIndex < 2 ? extentParam : extentParamEdge, normalX, normalY, normalZ, 0, 0, 0, itemIndex < 2 ? 0.75 : 1))
      meshBuilder.quad(vertexHandle[0], vertexHandle[1], vertexHandle[2], vertexHandle[3])
    },
    blendColor = lerp3(EFFECT_STONE_DARK_COLOR, EFFECT_CRYSTAL_TINT_COLOR, 0.35)
  return (
    distance(1, 2, 6, 5, blendColor, EFFECT_CRYSTAL_TINT_COLOR),
    distance(3, 0, 4, 7, blendColor, scale3(EFFECT_CRYSTAL_TINT_COLOR, 0.9)),
    distance(0, 1, 5, 4, blendColor, EFFECT_CRYSTAL_TINT_COLOR),
    distance(2, 3, 7, 6, blendColor, EFFECT_CRYSTAL_TINT_COLOR),
    distance(4, 5, 6, 7, EFFECT_CRYSTAL_TIP_COLOR, EFFECT_CRYSTAL_TIP_COLOR),
    emitRibbonAlongPolyline(meshBuilder, (curvePoint, curveTangent, curveWidth) => [progressEdge * 0.93 + curveWidth, 0.2 + (randomAmount - 0.35) * 0.52 + curveTangent, curvePoint], 1, 0, 0, 0.42, 0.4, seed),
    buildPuffedBlobMesh(meshBuilder, 0, 0.02, 0.1, 0.34, 0.14, 0.62, { detail: 0, bump: 0.2, seed: seed, bottom: EFFECT_STONE_DARK_COLOR, top: EFFECT_CRYSTAL_TINT_COLOR, flat: !0 }),
    meshBuilder.build()
  )
}

function buildFallenStele(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    frustumLength = rng.range(1.1, 1.5)
  return (
    EFFECT_SCRATCH_MATRIX.makeRotationZ(rng.range(0.03, 0.09)).setPosition(0, 0.02, 0),
    buildTaperedFrustum(meshBuilder, EFFECT_SCRATCH_MATRIX, frustumLength, 0.95, 0.16, 0.03, EFFECT_CRYSTAL_TINT_COLOR, lerp3(EFFECT_STONE_DARK_COLOR, EFFECT_CRYSTAL_TINT_COLOR, 0.4)),
    emitRibbonAlongPolyline(meshBuilder, (curvePoint, curveTangent, curveWidth) => [curvePoint, 0.185 + curveWidth + curvePoint * 0.05, curveTangent], 0, 1, 0, 0.36, 0.3, seed),
    EFFECT_SCRATCH_MATRIX.makeRotationY(rng.range(0.3, 0.9)).setPosition(frustumLength * 0.5 + 0.32, 0, rng.range(-0.2, 0.2)),
    buildTaperedFrustum(meshBuilder, EFFECT_SCRATCH_MATRIX, 0.42, 0.5, 0.13, 0.03, scale3(EFFECT_CRYSTAL_TINT_COLOR, 0.94), EFFECT_STONE_DARK_COLOR),
    meshBuilder.build()
  )
}

function buildBannerFlag() {
  const meshBuilder = new MeshBuilder(),
    c1Color = colorToRgb(5915446)
  ;(buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.1, 0, 0.055],
      [0, 2.6, 0, 0.04],
    ],
    { sides: 5, c0: scale3(c1Color, 0.7), c1: c1Color },
  ),
    buildPuffedBlobMesh(meshBuilder, 0, 2.66, 0, 0.07, 0.09, 0.07, { detail: 0, seed: 5, bottom: EFFECT_BLOB_BASE_COLOR, top: scale3(EFFECT_BLOB_BASE_COLOR, 1.25), glow: 0.15 }))
  const segmentIndex = 3,
    unitSize = 2.52,
    unitSizeEdge = 0.72,
    unitSizeTip = 1.05
  let previousRowVertices = null
  for (let index = 0; index <= segmentIndex; index++) {
    const progress = index / segmentIndex,
      scaledExtent = (unitSizeEdge / 2) * (1 - progress),
      coordZ = 0.04 + progress * unitSizeTip,
      weightedSum = 0.86 + 0.14 * (1 - progress),
      vertexHandle = meshBuilder.vertex(0, unitSize - unitSizeEdge / 2 + scaledExtent, coordZ, [weightedSum, weightedSum, weightedSum], 1, 0.1, 0, progress * progress * 1.1, 0, 1, 1),
      vertexHandleEdge = meshBuilder.vertex(0, unitSize - unitSizeEdge / 2 - scaledExtent, coordZ, [weightedSum * 0.9, weightedSum * 0.9, weightedSum * 0.9], 1, 0.1, 0, progress * progress * 1.1, 0, 1, 1)
    ;(previousRowVertices && (meshBuilder.quad(previousRowVertices[0], previousRowVertices[1], vertexHandleEdge, vertexHandle), meshBuilder.quad(vertexHandle, vertexHandleEdge, previousRowVertices[1], previousRowVertices[0])), (previousRowVertices = [vertexHandle, vertexHandleEdge]))
  }
  return meshBuilder.build()
}

function buildMooringPost(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    randomJitter = rng.range(0.36, 0.44)
  return (
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, -0.08, 0, 0.17],
        [0, randomJitter * 0.5, 0, 0.14],
        [0, randomJitter * 0.56, 0, 0.115],
        [0, randomJitter * 0.66, 0, 0.115],
        [0, randomJitter * 0.72, 0, 0.15],
        [0, randomJitter, 0, 0.13],
      ],
      { sides: 6, c0: EFFECT_STONE_DARK_COLOR, c1: EFFECT_CRYSTAL_TINT_COLOR, cap: !0 },
    ),
    meshBuilder.build()
  )
}

function buildWatcher() {
  const meshBuilder = new MeshBuilder(),
    c0Color = lerp3(EFFECT_STONE_DARK_COLOR, EFFECT_CRYSTAL_TINT_COLOR, 0.3)
  ;(emitFrustumAt(meshBuilder, 0, 0.34, 0, 0.82, 0.38, 0.82, EFFECT_CRYSTAL_TINT_COLOR, c0Color),
    emitFrustumAt(meshBuilder, 0, 0.46, 0, 0.66, 0.12, 0.66, EFFECT_CRYSTAL_TIP_COLOR, EFFECT_CRYSTAL_TINT_COLOR),
    buildTubeAlongPath(
      meshBuilder,
      [
        [0, 0.46, 0, 0.3],
        [0, 0.9, 0, 0.25],
        [0, 1.45, 0, 0.23],
        [0.01, 1.82, 0, 0.3],
        [0.02, 1.96, 0, 0.2],
      ],
      { sides: 8, c0: c0Color, c1: EFFECT_CRYSTAL_TINT_COLOR, cap: !0 },
    ),
    buildPuffedBlobMesh(meshBuilder, 0.04, 2.12, 0, 0.22, 0.26, 0.21, { detail: 1, bump: 0.03, seed: 11, bottom: lerp3(c0Color, EFFECT_CRYSTAL_TINT_COLOR, 0.5), top: EFFECT_CRYSTAL_TIP_COLOR, puffCenter: [0, 2, 0], puff: 0.3 }))
  const vertices = [0.06, 0.06, 0.09],
    vertexHandle = meshBuilder.vertex(0.2, 2.08, 0, vertices, 1, 0, 0),
    items = []
  for (let index = 0; index < 7; index++) {
    const azimuth = (index / 7) * EFFECT_FULL_TURN_RADIANS
    items.push(meshBuilder.vertex(0.215, 2.08 + Math.sin(azimuth) * 0.15, Math.cos(azimuth) * 0.11, scale3(vertices, 1.6), 1, 0, 0))
  }
  for (let curveIndex = 0; curveIndex < 7; curveIndex++) meshBuilder.tri(vertexHandle, items[curveIndex], items[(curveIndex + 1) % 7])
  for (const item of [-1, 1])
    buildTubeAlongPath(
      meshBuilder,
      [
        [0.02, 1.8, item * 0.27, 0.085],
        [0.14, 1.55, item * 0.3, 0.075],
        [0.3, 1.42, item * 0.14, 0.06],
      ],
      { sides: 5, c0: EFFECT_CRYSTAL_TINT_COLOR, c1: lerp3(EFFECT_CRYSTAL_TINT_COLOR, EFFECT_CRYSTAL_TIP_COLOR, 0.5), cap: !0 },
    )
  const noiseFn = (river) => {
    const items = []
    for (let index = 0; index <= 8; index++) {
      const azimuth = (index / 8) * EFFECT_FULL_TURN_RADIANS,
        cosOffset = Math.cos(azimuth) * 0.2,
        sinOffset = Math.sin(azimuth) * 0.2
      items.push(river === "x" ? [0.36, 1.46 + sinOffset, cosOffset, 0.02] : [0.36 + cosOffset, 1.46 + sinOffset * 0.35, sinOffset * 0.94, 0.02])
    }
    buildTubeAlongPath(meshBuilder, items, { sides: 4, c0: EFFECT_BLOB_BASE_COLOR, c1: scale3(EFFECT_BLOB_BASE_COLOR, 1.15), glow: 0.12 })
  }
  return (noiseFn("x"), noiseFn("z"), buildPuffedBlobMesh(meshBuilder, 0.36, 1.46, 0, 0.055, 0.055, 0.055, { detail: 0, seed: 2, bottom: [0.7, 0.95, 1], top: [0.9, 1, 1], glow: 0.9 }), meshBuilder.build())
}

function buildInlayArc(seed) {
  const rng = new FastRandom(seed),
    meshBuilder = new MeshBuilder(),
    unitSize = 0.95,
    unitSizeEdge = 1.3,
    randomAmount = rng.range(1.2, 1.9),
    ribbonIndex = 7,
    coordY = 0.035,
    eFFECT_CRYSTAL_TINT_COLOR = EFFECT_CRYSTAL_TINT_COLOR,
    items = []
  for (let index = 0; index <= ribbonIndex; index++) {
    const weightedSum = -randomAmount / 2 + (randomAmount * index) / ribbonIndex,
      colorScale = 0.9 + hashNoise2D(index, seed, 3) * 0.18
    items.push(meshBuilder.vertex(Math.cos(weightedSum) * unitSize, coordY, Math.sin(weightedSum) * unitSize, scale3(eFFECT_CRYSTAL_TINT_COLOR, colorScale), 0, 1, 0), meshBuilder.vertex(Math.cos(weightedSum) * unitSizeEdge, coordY, Math.sin(weightedSum) * unitSizeEdge, scale3(eFFECT_CRYSTAL_TINT_COLOR, colorScale * 0.95), 0, 1, 0))
  }
  for (let indexEdge = 0; indexEdge < ribbonIndex; indexEdge++) meshBuilder.quad(items[indexEdge * 2], items[indexEdge * 2 + 2], items[indexEdge * 2 + 3], items[indexEdge * 2 + 1])
  const vertices = [0.62, 0.9, 0.95]
  for (let indexTip = 0; indexTip < ribbonIndex; indexTip++) {
    const weightedSumEdge = -randomAmount / 2 + (randomAmount * (indexTip + 0.5)) / ribbonIndex,
      unitSizeTip = 0.02,
      cosOffset = Math.cos(weightedSumEdge),
      sinOffset = Math.sin(weightedSumEdge),
      factor = [
        [cosOffset * (unitSize + 0.08) + sinOffset * unitSizeTip, sinOffset * (unitSize + 0.08) - cosOffset * unitSizeTip],
        [cosOffset * (unitSizeEdge - 0.08) + sinOffset * unitSizeTip, sinOffset * (unitSizeEdge - 0.08) - cosOffset * unitSizeTip],
        [cosOffset * (unitSizeEdge - 0.08) - sinOffset * unitSizeTip, sinOffset * (unitSizeEdge - 0.08) + cosOffset * unitSizeTip],
        [cosOffset * (unitSize + 0.08) - sinOffset * unitSizeTip, sinOffset * (unitSize + 0.08) + cosOffset * unitSizeTip],
      ].map((item) => meshBuilder.vertex(item[0], coordY + 0.008, item[1], vertices, 0, 1, 0, 0, 0.3, 0, 1))
    meshBuilder.quad(factor[0], factor[1], factor[2], factor[3])
  }
  return meshBuilder.build()
}

function buildShrineScenery() {
  const starLampConfig = { starLamp: buildStarLamp(), steles: [buildStele(61), buildStele(67)], fallenSteles: [buildFallenStele(71), buildFallenStele(73)], flag: buildBannerFlag(), mooringPosts: [buildMooringPost(79), buildMooringPost(83)], watcher: buildWatcher(), inlayArcs: [buildInlayArc(89), buildInlayArc(97)] },
    items = []
  for (const itemsEdge of Object.values(starLampConfig)) Array.isArray(itemsEdge) ? items.push(...itemsEdge) : items.push(itemsEdge)
  return { ...starLampConfig, dispose: () => items.forEach((item) => item.dispose()) }
}

const WORLD_NICHE_MIN_SPAN = 9

function findWallNicheSites(builder) {
  const map = builder.map,
    items = [],
    factor = map.walls.map(() => [])
  return (
    map.walls.forEach((rimPolygon, itemIndex) => {
      const rimPoints = []
      for (let index = 0; index < rimPolygon.length; index++) {
        const prevPoint = rimPolygon[index],
          nextPoint = rimPolygon[(index + 1) % rimPolygon.length],
          distance = Math.hypot(nextPoint.x - prevPoint.x, nextPoint.y - prevPoint.y)
        if (distance < 6.5) continue
        const normalX = (nextPoint.x - prevPoint.x) / distance,
          normalY = (nextPoint.y - prevPoint.y) / distance
        let signedNormalY = normalY,
          normalYNegated = -normalX
        if ((isPointInPolygon({ x: (prevPoint.x + nextPoint.x) / 2 + signedNormalY * 0.2, y: (prevPoint.y + nextPoint.y) / 2 + normalYNegated * 0.2 }, rimPolygon) && ((signedNormalY = -signedNormalY), (normalYNegated = -normalYNegated)), !(normalYNegated < -0.35)))
          for (let total = 2.6; total <= distance - 2.6; total += 1.3) {
            const offsetPoint = { x: prevPoint.x + normalX * total, y: prevPoint.y + normalY * total },
              offsetX = offsetPoint.x + signedNormalY * 1.2,
              offsetY = offsetPoint.y + normalYNegated * 1.2
            if (builder.riverDist(offsetX, offsetY) < 1.5 || builder.baseDist(offsetX, offsetY) < 2 || builder.padDist(offsetX, offsetY) < 1 || builder.bushDist(offsetX, offsetY) < 0.5 || builder.boundDist(offsetPoint.x, offsetPoint.y) < 3) continue
            const laneDistResult = builder.laneDist(offsetX, offsetY),
              campDistResult = builder.campDist(offsetX, offsetY)
            let accumX = 0
            ;(laneDistResult > -0.5 && laneDistResult < 7 ? (accumX = 2 - laneDistResult * 0.15) : campDistResult < 7 && (accumX = 1 - campDistResult * 0.05), !(accumX <= 0) && ((accumX += normalYNegated * 0.4 + hashNoise2D(Math.round(offsetPoint.x * 3), Math.round(offsetPoint.y * 3), 17) * 0.3), rimPoints.push({ p: offsetPoint, score: accumX })))
          }
      }
      rimPoints.sort((pointA, pointB) => pointB.score - pointA.score)
      let accumY = 0
      for (const item of rimPoints) {
        if (accumY >= 3) break
        items.some((candidatePoint) => Math.hypot(candidatePoint.x - item.p.x, candidatePoint.y - item.p.y) < WORLD_NICHE_MIN_SPAN) || (items.push(item.p), factor[itemIndex].push(item.p), accumY++)
      }
    }),
    factor
  )
}

function buildSkyDome() {
  const sphereGeometry = new SphereGeometry(820, 24, 12),
    shaderMaterial = new ShaderMaterial({
      uniforms: { cHorizon: { value: new Color(ARENA_PALETTE.env.horizon) }, cZenith: { value: new Color(ARENA_PALETTE.env.zenith) }, cFog: { value: new Color(ARENA_PALETTE.env.fog) } },
      vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
      fragmentShader: `
      uniform vec3 cHorizon;
      uniform vec3 cZenith;
      uniform vec3 cFog;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = mix(cHorizon, cZenith, smoothstep(0.0, 0.55, h));
        col = mix(col, cFog, smoothstep(0.06, -0.12, h));
        gl_FragColor = vec4(col, 1.0);
        ${GLSL_TONEMAP}
      }
    `,
      side: BackSide,
      depthWrite: !1,
      fog: !1,
    }),
    mesh = new Mesh(sphereGeometry, shaderMaterial)
  return ((mesh.name = "sky-dome"), (mesh.renderOrder = -10), (mesh.frustumCulled = !1), mesh)
}

function buildCloudSea() {
  const circleGeometry = new CircleGeometry(900, 48)
  circleGeometry.rotateX(-Math.PI / 2)
  const shaderMaterial = new ShaderMaterial({
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog),
        uTime: ARENA_SHARED_UNIFORMS.uTime,
        uSunXZ: { value: new Vector2(SUN_DIRECTION.x, SUN_DIRECTION.z).normalize() },
        cLight: { value: new Color(ARENA_PALETTE.env.cloud) },
        cShade: { value: new Color(ARENA_PALETTE.env.cloudShade) },
        cDeep: { value: new Color(8365784) },
      },
      vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
      fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      ${GLSL_HASH_NOISE}
      uniform float uTime;
      uniform vec2 uSunXZ;
      uniform vec3 cLight;
      uniform vec3 cShade;
      uniform vec3 cDeep;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = vWorldPos.xz * 0.012;
        vec2 drift = vec2(uTime * 0.006, uTime * 0.0035);
        float n = fbm(p + drift);
        float n2 = fbm(p * 2.7 - drift * 1.6 + 7.3);
        float c = n * 0.65 + n2 * 0.35;
        // 云团：亮顶、蓝灰的谷；朝向太阳的一侧镶暖亮边，背光一侧压暗
        float lit = n - fbm(p + drift + uSunXZ * 0.045);
        vec3 col = mix(cDeep, cShade, smoothstep(0.25, 0.5, c));
        col = mix(col, cLight, smoothstep(0.45, 0.72, c));
        col += vec3(1.0, 0.93, 0.8) * clamp(lit * 3.4, -0.1, 0.24);
        // 高空更大一层云缓慢投下的云影
        float sh = fbm(p * 0.35 - drift * 0.6 + 3.1);
        col *= 1.0 - 0.16 * smoothstep(0.5, 0.72, sh);
        gl_FragColor = vec4(col * 1.05, 1.0);
        ${GLSL_TONEMAP}
      }
    `,
      fog: !0,
    }),
    mesh = new Mesh(circleGeometry, shaderMaterial)
  return ((mesh.position.y = MOUNTAIN_BASE_HEIGHT), (mesh.name = "cloud-sea"), (mesh.frustumCulled = !1), mesh.updateMatrix(), (mesh.matrixAutoUpdate = !1), mesh)
}

function buildSkyGroup() {
  const group = new Group()
  return ((group.name = "sky"), group.add(buildSkyDome(), buildCloudSea(), buildMountainRange()), group)
}

const WORLD_CAMP_GLOW_COLORS = { 1: 9427199, 2: 16742956, 3: 12114040, 4: ARENA_PALETTE.env.amber, 5: ARENA_PALETTE.env.violet, 6: 16764768 },
  WORLD_SCRATCH_COLOR = new Color()

/**
 * 处理光照。
 *
 * @param builder - 构建器
 * @param bushmap - 输入
 * @param glowSpec - 第三输入
 */
function bakeLightTint(builder, bushmap, glowSpec) {
  const map = bushmap.map
  builder.clear()
  for (const base of map.bases) {
    const factor = base.team === 0 ? ARENA_PALETTE.blue.glow : ARENA_PALETTE.red.glow,
      polygonCentroidResult = polygonCentroid(base.area)
    ;(builder.stamp(polygonCentroidResult.x, polygonCentroidResult.y, 18, factor, 0.18), builder.stamp(base.fountain.x, base.fountain.y, 6, factor, 0.35))
  }
  for (const tower of map.towers) builder.stamp(tower.pos.x, tower.pos.y, 5, tower.team === 0 ? ARENA_PALETTE.blue.glow : ARENA_PALETTE.red.glow, 0.2)
  const river = map.river
  for (let index = 0; index < river.length - 1; index++) {
    const point = river[index],
      pointEdge = river[index + 1],
      distance = Math.hypot(pointEdge.x - point.x, pointEdge.y - point.y)
    for (let total = 0; total <= distance; total += 3) builder.stamp(point.x + ((pointEdge.x - point.x) * total) / distance, point.y + ((pointEdge.y - point.y) * total) / distance, 5.5, ARENA_PALETTE.env.waterShallow, 0.12)
  }
  for (const camp of map.camps) {
    const selectedMONSTER_KIND_INDEX = MONSTER_KIND_INDEX[camp.monsterType],
      monsterRadiusResult = monsterRadius(camp.monsterType)
    builder.stamp(camp.pos.x, camp.pos.y, selectedMONSTER_KIND_INDEX >= 5 ? 8 : selectedMONSTER_KIND_INDEX <= 2 ? 7 : 6, WORLD_CAMP_GLOW_COLORS[selectedMONSTER_KIND_INDEX], selectedMONSTER_KIND_INDEX === 3 ? 0.12 : 0.25 * (monsterRadiusResult > 5 ? 1 : 0.9))
  }
  for (const glow of glowSpec.glows) (WORLD_SCRATCH_COLOR.setRGB(glow.color[0], glow.color[1], glow.color[2], LinearSRGBColorSpace), builder.stamp(glow.x, glow.z, Math.max(1.5, glow.r * 1.5), WORLD_SCRATCH_COLOR.getHex(SRGBColorSpace), 0.3))
  for (const polygon of map.bushes) {
    const bushCentroid = polygonCentroid(polygon)
    builder.stamp(bushCentroid.x, bushCentroid.y, 3, 12111706, 0.1)
  }
  for (const caster of glowSpec.casters) builder.occlude(caster.x, caster.z, caster.radius * 1.5, 0.25)
  for (const wall of bushmap.walls) {
    const poly = wall.poly
    for (let cliffIndex = 0; cliffIndex < poly.length; cliffIndex++) {
      const pointTip = poly[cliffIndex],
        pointBase = poly[(cliffIndex + 1) % poly.length],
        edgeLength = Math.hypot(pointBase.x - pointTip.x, pointBase.y - pointTip.y)
      for (let indexEdge = 1; indexEdge < edgeLength; indexEdge += 2.2) {
        const coordX = pointTip.x + ((pointBase.x - pointTip.x) * indexEdge) / edgeLength + SUN_GROUND_DIRECTION.x * 1.3,
          coordY = pointTip.y + ((pointBase.y - pointTip.y) * indexEdge) / edgeLength + SUN_GROUND_DIRECTION.y * 1.3
        bushmap.wallDist(coordX, coordY, 3) > 0.2 && builder.occlude(coordX, coordY, 2.2, 0.25)
      }
    }
  }
  builder.bake()
}

const WORLD_SHADOW_CULL_LENGTH = 10,
  WORLD_MAP_TOP_GAIN_LOW = 3.6,
  WORLD_MAP_TOP_GAIN_HIGH = 4.6,
  WORLD_CLIFF_MERGE_CHUNK = 35,
  WORLD_CULL_FRUSTUM = new Frustum(),
  WORLD_CULL_MATRIX = new Matrix4(),
  WORLD_SKY_VISIBILITY_MARGIN = 11,
  WORLD_SCRATCH_UNPROJECT = new Vector3(),
  WORLD_SCRATCH_CAMERA_POS = new Vector3()

/**
 * 创建战场。
 *
 * @param bushmap - 输入
 * @returns 结果对象
 */
function* buildWorldStaged(bushmap) {
  const config = {},
    sideConfig: WorldSideConfig = {}
  let lastTimestamp = performance.now()
  const noiseFn = (scatterIndex) => {
      const currentTimestamp = performance.now()
      ;((config[scatterIndex] = Math.round((config[scatterIndex] ?? 0) + currentTimestamp - lastTimestamp)), (lastTimestamp = currentTimestamp))
    },
    noiseFnEdge = () => {
      lastTimestamp = performance.now()
    },
    map = bushmap.map,
    mapgeometryinstance = new MapGeometry(map),
    MaxAnisotropyValue = bushmap.renderer.capabilities.getMaxAnisotropy(),
    TerrainFieldTexturesValue = buildTerrainFieldTextures(mapgeometryinstance, 768, SUN_DIRECTION)
  ;(noiseFn("splat"), yield 0.2, noiseFnEdge())
  const NoiseTextureValue = buildNoiseTexture(256, 7)
  noiseFn("noise")
  const terrain = bushmap.layers.terrain,
    settings = bushmap.settings,
    generateTerrainTexturesResult = generateTerrainTextures(MaxAnisotropyValue)
  let factor = null
  for (let index = 1; !factor; index++) {
    const rand01 = generateTerrainTexturesResult.next()
    rand01.done ? (factor = rand01.value) : (noiseFn("ground"), yield 0.2 + 0.05 * index, noiseFnEdge())
  }
  const TerrainGroundValue = buildTerrainGround(mapgeometryinstance, TerrainFieldTexturesValue, NoiseTextureValue, settings, MaxAnisotropyValue, factor)
  terrain.add(TerrainGroundValue.mesh)
  const RiverMeshValue = buildRiverMesh(mapgeometryinstance, TerrainFieldTexturesValue, NoiseTextureValue, settings)
  ;(terrain.add(RiverMeshValue.mesh), noiseFn("ground"), yield 0.45, noiseFnEdge())
  const rockTextureResult = rockTexture(),
    ToonMaterialValue = createToonMaterial({
      vertexColors: !0,
      ramp: [0.05, 0.42, 0.55],
      softness: 0.1,
      map: rockTextureResult,
      triplanar: 0.3,
      mapGain: 1.75,
      mapMask: !0,
      rim: 0.08,
      kicker: 0.1,
      shadeTint: ARENA_PALETTE.env.shadeRock,
      mapTop: TerrainGroundValue.grassTexture,
      mapTopScale: 0.1,
      mapTopGain: settings.groundDetail > 0 ? WORLD_MAP_TOP_GAIN_HIGH : WORLD_MAP_TOP_GAIN_LOW,
      mapTopNoise: NoiseTextureValue,
      mapTopDetail: settings.groundDetail > 0,
      mapTopPatch: 0.6,
    }),
    createToonMaterialToonMaterialValue = createToonMaterial({ vertexColors: !0, ramp: [0, 0.42, 0.6], softness: 0.3, rim: 0.12, rimPower: 2.6, kicker: 0.12, wind: 0.42, glowBoost: 1.7, shadeTint: ARENA_PALETTE.env.shadeRock }),
    ToonMaterialResult = createToonMaterial({ vertexColors: !0, steps: 1, rim: 0, wind: 0.3, glowBoost: 1.5, side: DoubleSide, flipBackNormals: !1 }),
    findWallNicheSitesResult = findWallNicheSites(mapgeometryinstance),
    baseCellBuilder = new CellGeometryBuilder(32),
    items = []
  for (let wallIndex = 0; wallIndex < map.walls.length; wallIndex++) {
    const selectedWalls = map.walls[wallIndex],
      centroid = polygonCentroid(selectedWalls)
    ;(items.push(buildCliffGeometry(baseCellBuilder.at(centroid.x, centroid.y, !0), selectedWalls, 100 + wallIndex * 7, { niches: findWallNicheSitesResult[wallIndex] })), wallIndex % 8 === 7 && wallIndex < map.walls.length - 1 && (noiseFn("cliffs"), yield 0.45 + 0.1 * ((wallIndex + 1) / map.walls.length), noiseFnEdge()))
  }
  sideConfig.cliffs = baseCellBuilder.triangleCount
  const group = new Group()
  ;((group.name = "cliffs"), terrain.add(group))
  const pointList = [],
    noiseFnTip = (propSpec) => {
      for (const item of propSpec) {
        item.frustumCulled = !1
        const cloneResult = item.geometry.boundingBox.clone()
        if (item.castShadow) {
          const scaledExtent = WORLD_SHADOW_CULL_LENGTH * SUN_HEIGHT_RATIO,
            scaledExtentEdge = SUN_GROUND_DIRECTION.x * scaledExtent,
            scaledExtentTip = SUN_GROUND_DIRECTION.y * scaledExtent
          ;(scaledExtentEdge > 0 ? (cloneResult.max.x += scaledExtentEdge) : (cloneResult.min.x += scaledExtentEdge), scaledExtentTip > 0 ? (cloneResult.max.z += scaledExtentTip) : (cloneResult.min.z += scaledExtentTip))
        }
        ;(cloneResult.expandByScalar(0.8), pointList.push({ mesh: item, box: cloneResult }))
      }
    }
  ;(noiseFn("cliffs"), yield 0.56, noiseFnEdge(), noiseFnTip(baseCellBuilder.build(ToonMaterialValue, ToonMaterialValue, group, "cliff", WORLD_CLIFF_MERGE_CHUNK)), noiseFn("cliffs"), yield 0.58, noiseFnEdge())
  const OuterTerrainSamplerValue = createOuterTerrainSampler(mapgeometryinstance),
    groupEdge = new Group()
  ;((groupEdge.name = "border"), terrain.add(groupEdge), noiseFnTip(buildMapBorder(mapgeometryinstance, OuterTerrainSamplerValue, groupEdge, ToonMaterialValue)), noiseFn("border"), yield 0.6, noiseFnEdge())
  const PropLibraryValue = buildPropLibrary(),
    ShrineSceneryValue = buildShrineScenery()
  ;(noiseFn("props"), yield 0.62, noiseFnEdge())
  const cellGeometryBuilder = new CellGeometryBuilder(32),
    EmptyEffectsBufferValue = createEmptyEffectsBuffer(),
    spatialclaimgridinstance = new SpatialClaimGrid(8),
    pointListEdge = [],
    itemsEdge = [],
    ArenaDecorValue = buildArenaDecor(mapgeometryinstance)
  ;(buildSceneryProps(cellGeometryBuilder, PropLibraryValue, mapgeometryinstance, items, EmptyEffectsBufferValue, spatialclaimgridinstance, pointListEdge, itemsEdge),
    buildBaseDecorations(cellGeometryBuilder, PropLibraryValue, ShrineSceneryValue, mapgeometryinstance, OuterTerrainSamplerValue, items, EmptyEffectsBufferValue, spatialclaimgridinstance, pointListEdge, itemsEdge),
    (sideConfig.campsBases = cellGeometryBuilder.triangleCount),
    noiseFn("props"),
    yield 0.64,
    noiseFnEdge(),
    scatterNicheDecor(cellGeometryBuilder, ShrineSceneryValue, mapgeometryinstance, items, EmptyEffectsBufferValue, spatialclaimgridinstance, pointListEdge),
    (sideConfig.props = cellGeometryBuilder.triangleCount - sideConfig.campsBases),
    (sideConfig.curbs = scatterLaneCurbs(cellGeometryBuilder, mapgeometryinstance)),
    noiseFn("props"),
    yield 0.66,
    noiseFnEdge())
  const triangleCount = cellGeometryBuilder.triangleCount
  ;(scatterPlateauVegetation(cellGeometryBuilder, PropLibraryValue, mapgeometryinstance, items, EmptyEffectsBufferValue, spatialclaimgridinstance), noiseFn("scatter"), yield 0.72, noiseFnEdge(), buildWorldDecor(cellGeometryBuilder, PropLibraryValue, mapgeometryinstance, 1, EmptyEffectsBufferValue, spatialclaimgridinstance), noiseFn("scatter"), yield 0.78, noiseFnEdge(), scatterBoundaryVegetation(cellGeometryBuilder, PropLibraryValue, mapgeometryinstance, OuterTerrainSamplerValue, EmptyEffectsBufferValue), (sideConfig.scatter = cellGeometryBuilder.triangleCount - triangleCount), noiseFn("scatter"), yield 0.84, noiseFnEdge())
  const groupTip = new Group()
  ;((groupTip.name = "scenery"), terrain.add(groupTip), noiseFnTip(cellGeometryBuilder.build(createToonMaterialToonMaterialValue, ToonMaterialResult, groupTip, "scenery")), PropLibraryValue.dispose(), ShrineSceneryValue.dispose(), terrain.add(buildWaterfalls(mapgeometryinstance, OuterTerrainSamplerValue, NoiseTextureValue, EmptyEffectsBufferValue)), noiseFn("merge"))
  const noiseFnBase = (decalIndex) => {
    for (const item of pointList) applyRankDrawRange(item.mesh, decalIndex.sceneryRank, decalIndex.shadowRank)
  }
  ;(noiseFnBase(settings), yield 0.9, noiseFnEdge(), paintShadowBlobs(TerrainFieldTexturesValue, EmptyEffectsBufferValue.casters, SUN_DIRECTION))
  for (const glow of EmptyEffectsBufferValue.glows) ArenaDecorValue.push({ type: 6, x: glow.x, y: glow.y, z: glow.z, radius: glow.r * 1.3, colorA: glow.color, colorB: [0, 0, 0], seed: Math.abs(glow.x * 7.3 + glow.z * 3.1) % 1, w: 0.38 })
  const paletteColor = colorToRgb(14677759)
  for (const ripple of EmptyEffectsBufferValue.ripples) ArenaDecorValue.push({ type: 8, x: ripple.x, y: WATER_LEVEL + 0.02, z: ripple.z, radius: ripple.r * 1.6, colorA: paletteColor, colorB: [0, 0, 0], seed: Math.abs(ripple.x * 0.731 + ripple.z * 0.377) % 1 })
  for (const tower of map.towers) EmptyEffectsBufferValue.aoBlobs.push({ x: tower.pos.x, y: 0.04, z: tower.pos.y, r: 2.6, strength: 0.42 })
  for (const base of map.bases) EmptyEffectsBufferValue.aoBlobs.push({ x: base.core.x, y: 0.04, z: base.core.y, r: 4.2, strength: 0.42 })
  for (const aoBlob of EmptyEffectsBufferValue.aoBlobs) ArenaDecorValue.push({ type: 7, x: aoBlob.x, y: aoBlob.y, z: aoBlob.z, radius: aoBlob.r, colorA: [0, 0, 0], colorB: [0, 0, 0], w: aoBlob.strength })
  const InterleavedFloatAttributeValue = buildInterleavedFloatAttribute(ArenaDecorValue, map.bound)
  ;(terrain.add(InterleavedFloatAttributeValue.mesh), (sideConfig.decals = ArenaDecorValue.length), (sideConfig.aoBlobs = EmptyEffectsBufferValue.aoBlobs.length), (sideConfig.glows = EmptyEffectsBufferValue.glows.length))
  const BushFieldValue = createBushField(mapgeometryinstance, settings)
  ;(terrain.add(BushFieldValue.group), noiseFn("bushes"), bakeLightTint(bushmap.lightTint, mapgeometryinstance, EmptyEffectsBufferValue))
  for (const glowEdge of EmptyEffectsBufferValue.glows) glowEdge.r < 1.2 || pointListEdge.push({ x: glowEdge.x, y: glowEdge.y + 0.3, z: glowEdge.z, radius: Math.min(2.2, glowEdge.r * 0.6), color: glowEdge.color, count: glowEdge.r > 3 ? 4 : 2, mode: 0, range: 1.6, size: 0.75 })
  const paletteColorEdge = colorToRgb(16773808)
  for (const polygon of map.bushes) {
    const centroidEdge = polygonCentroid(polygon)
    pointListEdge.push({ x: centroidEdge.x, y: 0.9, z: centroidEdge.y, radius: 2.6, color: paletteColorEdge, count: 5, mode: 0, range: 1.2, size: 0.6 })
  }
  const riverline = mapgeometryinstance.riverLine,
    paletteColorTip = colorToRgb(12580095)
  for (let scatterIndex = 0; scatterIndex < riverline.length - 1; scatterIndex++) {
    const selectedSt = riverline[scatterIndex],
      factorEdge = riverline[scatterIndex + 1],
      distance = Math.hypot(factorEdge.x - selectedSt.x, factorEdge.y - selectedSt.y)
    for (let total = 0; total < distance; total += 3.2) {
      const coordX = selectedSt.x + ((factorEdge.x - selectedSt.x) * total) / distance,
        coordY = selectedSt.y + ((factorEdge.y - selectedSt.y) * total) / distance
      mapgeometryinstance.boundDist(coordX, coordY) < 1 || pointListEdge.push({ x: coordX, y: WATER_LEVEL + 0.05, z: coordY, radius: map.riverWidth * 0.42, color: paletteColorTip, count: 2, mode: 1, range: 1.3, size: 0.6 })
    }
  }
  const MoteFieldValue = createMoteField(pointListEdge, settings)
  terrain.add(MoteFieldValue.points)
  const AtmosphereLayerValue = buildAtmosphereLayer(mapgeometryinstance, items, itemsEdge, NoiseTextureValue, settings)
  ;(terrain.add(AtmosphereLayerValue.mesh), (sideConfig.atmos = AtmosphereLayerValue.count))
  const SkyGroupValue = buildSkyGroup()
  ;(terrain.add(SkyGroupValue), noiseFn("misc"))
  const heightAtConfig = { heightAt: (primaryinputEdge, secondaryinputEdge) => mapgeometryinstance.heightAt(primaryinputEdge, secondaryinputEdge), waterLevel: WATER_LEVEL, inWater: (waterX, waterZ) => mapgeometryinstance.inWater(waterX, waterZ) }
  bushmap.terrain = heightAtConfig

  // ── 扩展钩子：允许外部追加自定义场景元素（几何/材质用内核导出的小工具包） ──
  if (globalThis.__STARFALL_SCENE_EXTRAS__) {
    for (const starfallSceneExtras of globalThis.__STARFALL_SCENE_EXTRAS__) {
      try {
        starfallSceneExtras({ scene: terrain, map: map, terrain: heightAtConfig, kit: { Mesh: Mesh, Geometry: BufferGeometry, Material: ShaderMaterial, Vector3: Vector3, Group: Group } })
      } catch (factorTip) {
        console.warn("[starfall] scene extra failed:", factorTip)
      }
    }
  }
  const floatArray = new Float32Array(DECAL_MESH_SEGMENTS * 4),
    vector3 = new Vector3(),
    noiseFnInner = () => MoteFieldValue.resize(bushmap.viewport.height * bushmap.viewport.dpr, bushmap.camera.fov)
  noiseFnInner()
  const seedValues = [0, 0],
    factorBase = map.bases.map((unit) => ({ team: unit.team, x: unit.fountain.x, y: unit.fountain.y, r2: unit.fountainRadius * unit.fountainRadius }))
  return {
    name: "terrain",
    timings: config,
    counts: sideConfig,
    update(world) {
      ;(WORLD_CULL_MATRIX.multiplyMatrices(bushmap.camera.projectionMatrix, bushmap.camera.matrixWorldInverse), WORLD_CULL_FRUSTUM.setFromProjectionMatrix(WORLD_CULL_MATRIX))
      for (const item of pointList) item.mesh.visible = WORLD_CULL_FRUSTUM.intersectsBox(item.box)
      let isdebugview = bushmap.rig.isDebugView
      if (!isdebugview) {
        const camera = bushmap.camera,
          weightedSum = map.bound + WORLD_SKY_VISIBILITY_MARGIN
        WORLD_SCRATCH_CAMERA_POS.setFromMatrixPosition(camera.matrixWorld)
        for (let index = 0; index < 4 && !isdebugview; index++)
          if (
            (WORLD_SCRATCH_UNPROJECT
              .set(index & 1 ? 1 : -1, index & 2 ? 1 : -1, 0.5)
              .unproject(camera)
              .sub(WORLD_SCRATCH_CAMERA_POS),
            WORLD_SCRATCH_UNPROJECT.y > -1e-4)
          )
            isdebugview = !0
          else {
            const progress = -WORLD_SCRATCH_CAMERA_POS.y / WORLD_SCRATCH_UNPROJECT.y
            isdebugview = Math.max(Math.abs(WORLD_SCRATCH_CAMERA_POS.x + WORLD_SCRATCH_UNPROJECT.x * progress), Math.abs(WORLD_SCRATCH_CAMERA_POS.z + WORLD_SCRATCH_UNPROJECT.z * progress)) > weightedSum
          }
      }
      SkyGroupValue.visible = isdebugview
      const state = world.state
      let unitSize = 0,
        isActive = !1,
        unitSizeEdge = 0,
        unitSizeTip = 0
      for (const unit of state.units)
        if (!(!unit.alive || !(unit.team === world.playerTeam || unit.visible[world.playerTeam]))) {
          if (unit.kind === "hero")
            for (const ot of factorBase) {
              if (unit.team === ot.team) continue
              const deltaX = unit.pos.x - ot.x,
                deltaY = unit.pos.y - ot.y
              deltaX * deltaX + deltaY * deltaY < ot.r2 && (ot.team === 0 ? (unitSizeEdge = 1) : (unitSizeTip = 1))
            }
          unit.bushId < 0 ||
            (bushmap.unitQuery.getPosition(unit.id, vector3) &&
              (unit.id === state.playerId && (BushFieldValue.setReveal(vector3.x, vector3.z, 3.4, 1), (isActive = !0)),
              unitSize < DECAL_MESH_SEGMENTS && ((floatArray[unitSize * 4] = vector3.x), (floatArray[unitSize * 4 + 1] = vector3.z), (floatArray[unitSize * 4 + 2] = unit.radius + 0.95), (floatArray[unitSize * 4 + 3] = 1), unitSize++)))
        }
      ;(BushFieldValue.setPushers(floatArray, unitSize), isActive || BushFieldValue.setReveal(0, 0, 1, 0))
      const alertSmoothingFactor = Math.min(1, world.dt * 4)
      ;((seedValues[0] += (unitSizeEdge - seedValues[0]) * alertSmoothingFactor), (seedValues[1] += (unitSizeTip - seedValues[1]) * alertSmoothingFactor), InterleavedFloatAttributeValue.setFountainAlert(0, seedValues[0]), InterleavedFloatAttributeValue.setFountainAlert(1, seedValues[1]))
    },
    setQuality(targetobject) {
      ;(TerrainGroundValue.setQuality(targetobject), RiverMeshValue.setQuality(targetobject))
      const isCorner = targetobject.groundDetail > 0
      ;(ToonMaterialValue.setMapTopDetail(isCorner), (ToonMaterialValue.uniforms.uMapTop.value.y = isCorner ? WORLD_MAP_TOP_GAIN_HIGH : WORLD_MAP_TOP_GAIN_LOW), BushFieldValue.setQuality(targetobject), MoteFieldValue.setQuality(targetobject), AtmosphereLayerValue.setQuality(targetobject), noiseFnBase(targetobject))
    },
    resize: noiseFnInner,
    dispose() {
      ;(disposeSceneResources(terrain), terrain.clear(), TerrainFieldTexturesValue.a.dispose(), TerrainFieldTexturesValue.b.dispose(), NoiseTextureValue.dispose(), bushmap.lightTint.clear())
    },
  }
}

export { buildWorldStaged }