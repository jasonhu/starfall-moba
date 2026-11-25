/**
 * 几何投影工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Color, Mesh, ShaderMaterial, Vector2, Vector3 } from 'three'
import { FastRandom, createCanvas, fbmNoise2D, forEachNeighbor, hashNoise2D, makeLightUniforms } from '../render/foundation'
import { createGrassTexture, fillCanvasWithPattern } from '../render/canvas-factory'
import { generateTerrainNoiseTextures, smoothStepBetween, createTileableDataTexture, clampToUnitRange } from '../render/texture-factory'
import { SUN_DIRECTION } from '../render/scene-rigs'
import { ARENA_PALETTE, ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { TERRAIN_FRAGMENT_SHADER, TERRAIN_VERTEX_SHADER, buildTerrainBoundary, riverFlowDirection, sampleLanePath, waterDetailLevel } from '../render/terrain-shaders'
import { MAP_GRID_HALF_EXTENT, MAX_CAMP_COUNT, MONSTER_KIND_INDEX, WATER_LEVEL } from './map-geometry'

function createDirtTexture(textureSize, sunDirectionX, sunDirectionZ) {
  const shadowOffsetX = -sunDirectionX,
    shadowOffsetZ = sunDirectionZ
  return createCanvas(
    textureSize,
    textureSize,
    (builder) => {
      fillCanvasWithPattern(builder, textureSize, 256, (pixelX, pixelY) => {
        const fbmNoise2DResult = fbmNoise2D(pixelX * 5, pixelY * 5, 4, 51, 5),
          fbmNoise2DFbmNoise2DResult = fbmNoise2D(pixelX * 60, pixelY * 60, 2, 63, 60),
          speckleNoise = fbmNoise2D(pixelX * 10 + 4.1, pixelY * 10, 3, 77, 10)
        let dirtBrightness = 126 + (fbmNoise2DResult - 0.5) * 50 + (fbmNoise2DFbmNoise2DResult - 0.5) * 26
        return (Math.abs(speckleNoise - 0.5) < 0.014 && (dirtBrightness -= 22), [dirtBrightness * 1.02, dirtBrightness * 0.99, dirtBrightness * 0.94])
      })
      const pebbleRandom = new FastRandom(808),
        pebbleCount = Math.round((textureSize * textureSize) / 3200)
      for (let index = 0; index < pebbleCount; index++) {
        const pebbleCenterX = pebbleRandom.range(0, textureSize),
          pebbleCenterY = pebbleRandom.range(0, textureSize),
          pebbleRadius = pebbleRandom.range(2, 7.5) * (pebbleRandom.chance(0.12) ? 1.8 : 1),
          pebbleRotation = pebbleRandom.range(0, Math.PI),
          pebbleGray = pebbleRandom.range(128, 190),
          ellipseAspectRatio = pebbleRandom.range(0.6, 0.95)
        forEachNeighbor(textureSize, pebbleCenterX, pebbleCenterY, pebbleRadius + 4, (neighborX, neighborY) => {
          ;((builder.fillStyle = "rgba(40,34,30,0.32)"),
            builder.beginPath(),
            builder.ellipse(neighborX + shadowOffsetX * pebbleRadius * 0.4, neighborY + shadowOffsetZ * pebbleRadius * 0.4, pebbleRadius, pebbleRadius * ellipseAspectRatio, pebbleRotation, 0, Math.PI * 2),
            builder.fill(),
            (builder.fillStyle = `rgb(${Math.round(pebbleGray)},${Math.round(pebbleGray * 0.97)},${Math.round(pebbleGray * 0.92)})`),
            builder.beginPath(),
            builder.ellipse(neighborX, neighborY, pebbleRadius, pebbleRadius * ellipseAspectRatio, pebbleRotation, 0, Math.PI * 2),
            builder.fill(),
            (builder.fillStyle = "rgba(255,255,250,0.3)"),
            builder.beginPath(),
            builder.ellipse(neighborX - shadowOffsetX * pebbleRadius * 0.3, neighborY - shadowOffsetZ * pebbleRadius * 0.3, pebbleRadius * 0.5, pebbleRadius * ellipseAspectRatio * 0.42, pebbleRotation, 0, Math.PI * 2),
            builder.fill())
        })
      }
    },
    { repeat: !0, anisotropy: 8 },
  )
}

function createCausticsTexture(textureSize = 256) {
  const fullTurnRadians = Math.PI * 2,
    cellPoints = []
  for (let index = 0; index < 7; index++) for (let seedPointX = 0; seedPointX < 7; seedPointX++) cellPoints.push(seedPointX + 0.5 + (hashNoise2D(seedPointX, index, 311) - 0.5) * 0.86, index + 0.5 + (hashNoise2D(seedPointX, index, 313) - 0.5) * 0.86)
  const float32Array = new Float32Array(textureSize * textureSize)
  for (let pixelRow = 0; pixelRow < textureSize; pixelRow++)
    for (let pixelColumn = 0; pixelColumn < textureSize; pixelColumn++) {
      const texelU = pixelColumn / textureSize,
        texelV = pixelRow / textureSize,
        warpedU = texelU + 0.03 * Math.sin(fullTurnRadians * (2 * texelV + texelU) + 1.3) + 0.014 * Math.sin(fullTurnRadians * (5 * texelV - 3 * texelU) + 4),
        warpedV = texelV + 0.03 * Math.sin(fullTurnRadians * (2 * texelU - texelV) + 2.9) + 0.014 * Math.sin(fullTurnRadians * (4 * texelU + 5 * texelV) + 0.6),
        warpedGridX = (((warpedU % 1) + 1) % 1) * 7,
        warpedGridV = (((warpedV % 1) + 1) % 1) * 7,
        gridCellX = Math.floor(warpedGridX),
        gridCellY = Math.floor(warpedGridV)
      let nearestDistance = 9,
        secondNearestDistance = 9
      for (let cellOffsetY = -1; cellOffsetY <= 1; cellOffsetY++)
        for (let cellOffsetX = -1; cellOffsetX <= 1; cellOffsetX++) {
          const neighborCellX = (gridCellX + cellOffsetX + 7) % 7,
            neighborCellY = (gridCellY + cellOffsetY + 7) % 7,
            neighborSeedIndex = (neighborCellY * 7 + neighborCellX) * 2,
            distance = Math.hypot(cellPoints[neighborSeedIndex] - neighborCellX + gridCellX + cellOffsetX - warpedGridX, cellPoints[neighborSeedIndex + 1] - neighborCellY + gridCellY + cellOffsetY - warpedGridV)
          distance < nearestDistance ? ((secondNearestDistance = nearestDistance), (nearestDistance = distance)) : distance < secondNearestDistance && (secondNearestDistance = distance)
        }
      const edgeDistance = secondNearestDistance - nearestDistance,
        causticIntensity = 1 - smoothStepBetween(0, 0.13, edgeDistance)
      float32Array[pixelRow * textureSize + pixelColumn] = clampToUnitRange(causticIntensity * causticIntensity * 0.85 + (1 - smoothStepBetween(0, 0.5, edgeDistance)) * 0.2)
    }
  const uint8Array = new Uint8Array(textureSize * textureSize * 4),
    halfTextureSize = textureSize >> 1
  for (let outputRow = 0; outputRow < textureSize; outputRow++)
    for (let outputColumn = 0; outputColumn < textureSize; outputColumn++) {
      const rgbaOffset = (outputRow * textureSize + outputColumn) * 4
      ;((uint8Array[rgbaOffset] = float32Array[outputRow * textureSize + outputColumn] * 255), (uint8Array[rgbaOffset + 1] = float32Array[((textureSize - 1 - outputRow + halfTextureSize) % textureSize) * textureSize + ((outputColumn + halfTextureSize + 37) % textureSize)] * 255), (uint8Array[rgbaOffset + 2] = 0), (uint8Array[rgbaOffset + 3] = 255))
    }
  return createTileableDataTexture(uint8Array, textureSize, 2)
}

/**
 * 创建地形。
 *
 * @param anisotropyLimit - 主要输入
 * @returns 结果对象
 */
function* generateTerrainTextures(anisotropyLimit) {
  const maxAnisotropy = Math.min(8, anisotropyLimit),
    distance = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z) || 1,
    GrassTextureValue = createGrassTexture(1024)
  yield
  const DirtTextureValue = createDirtTexture(512, SUN_DIRECTION.x / distance, SUN_DIRECTION.z / distance)
  yield
  const generateTerrainNoiseTexturesResult = generateTerrainNoiseTextures(SUN_DIRECTION, 512, maxAnisotropy)
  yield
  const CausticsTextureValue = createCausticsTexture(256)
  for (const texture of [GrassTextureValue, DirtTextureValue]) texture.anisotropy = maxAnisotropy
  return { grass: GrassTextureValue, dirt: DirtTextureValue, stone: generateTerrainNoiseTexturesResult, caust: CausticsTextureValue }
}

/**
 * 创建地形。
 *
 * @param bushMap - 输入
 * @param splatMaps - 次要输入
 * @param noiseTexture - 第三输入
 * @param qualitySettings - 第四输入
 * @param anisotropyLimit - 附加输入
 * @param cachedTextures - 附加输入
 */
function buildTerrainGround(bushMap, splatMaps, noiseTexture, qualitySettings, anisotropyLimit, cachedTextures) {
  let terrainTextures = cachedTextures
  if (!terrainTextures) {
    const generateTerrainTexturesResult = generateTerrainTextures(anisotropyLimit)
    for (;;) {
      const textureStep = generateTerrainTexturesResult.next()
      if (textureStep.done) {
        terrainTextures = textureStep.value
        break
      }
    }
  }
  const { grass: grassTexture, dirt: dirtTexture, stone: stoneTextures, caust: causticsTexture } = terrainTextures,
    environmentPalette = ARENA_PALETTE.env,
    arenaMap = bushMap.map,
    makeColor = (sourceColor, brightnessScale = 1) => new Color(sourceColor).multiplyScalar(brightnessScale),
    baseCorePositions = arenaMap.bases.map((baseEntry) => new Vector2(baseEntry.core.x, baseEntry.core.y)),
    baseAxes = []
  for (const base of arenaMap.bases) {
    const laneWaypoints = [...sampleLanePath(arenaMap, base), base.fountain]
    for (let index = 0; index < 4; index++) {
      const laneWaypoint = laneWaypoints[index] ?? base.fountain
      baseAxes.push(new Vector2(laneWaypoint.x - base.core.x, laneWaypoint.y - base.core.y).normalize())
    }
  }
  const campMarkers = []
  for (let campIndex = 0; campIndex < MAX_CAMP_COUNT; campIndex++) {
    const selectedCamps = arenaMap.camps[campIndex]
    campMarkers.push(selectedCamps ? new Vector3(selectedCamps.pos.x, selectedCamps.pos.y, MONSTER_KIND_INDEX[selectedCamps.monsterType]) : new Vector3(9999, 9999, 0))
  }
  const terrainMaterial = new ShaderMaterial({
      uniforms: makeLightUniforms({
        tSplatA: { value: splatMaps.a },
        tSplatB: { value: splatMaps.b },
        tNoise: { value: noiseTexture },
        tGrass: { value: grassTexture },
        tStone: { value: stoneTextures.data },
        tStoneN: { value: stoneTextures.normal },
        tDirt: { value: dirtTexture },
        tCaust: { value: causticsTexture },
        uTime: ARENA_SHARED_UNIFORMS.uTime,
        uSplatScale: { value: 1 / (MAP_GRID_HALF_EXTENT * 2) },
        uWaterLevel: { value: WATER_LEVEL },
        uFlow: { value: riverFlowDirection(bushMap) },
        uLaneGain: { value: 1.04 },
        uLaneHalf: { value: arenaMap.laneWidth / 2 },
        cGrass: { value: makeColor(environmentPalette.grass) },
        cGrassWarm: { value: makeColor(environmentPalette.grassWarm) },
        cGrassCool: { value: makeColor(environmentPalette.grassCool) },
        cGrassDark: { value: makeColor(environmentPalette.grassDark) },
        cLane: { value: makeColor(environmentPalette.lane) },
        cLaneAlt: { value: makeColor(environmentPalette.laneAlt) },
        cLaneEarth: { value: makeColor(environmentPalette.laneDark) },
        cGrout: { value: makeColor(environmentPalette.laneGrout) },
        cMoss: { value: makeColor(environmentPalette.moss) },
        cDirt: { value: makeColor(environmentPalette.dirt) },
        cHumus: { value: makeColor(environmentPalette.dirtDark) },
        cSand: { value: makeColor(environmentPalette.sand) },
        cGravel: { value: makeColor(9274994) },
        cScatter: { value: makeColor(environmentPalette.water).lerp(makeColor(6265512), 0.35) },
        cCaustic: { value: makeColor(environmentPalette.caustic) },
        cSkyRefl: { value: makeColor(12375794) },
        cStar: { value: makeColor(10481919) },
        cLeaf: { value: [makeColor(13208116), makeColor(9145918), makeColor(10704174)] },
        cPetal: { value: [makeColor(environmentPalette.petalPink), makeColor(environmentPalette.petalWhite)] },
        cBaseStone: { value: [makeColor(ARENA_PALETTE.blue.plaza), makeColor(ARENA_PALETTE.red.plaza)] },
        cBaseTrim: { value: [makeColor(ARENA_PALETTE.blue.trim), makeColor(ARENA_PALETTE.red.trim)] },
        cBaseGlow: { value: [makeColor(ARENA_PALETTE.blue.glow), makeColor(ARENA_PALETTE.red.glow)] },
        uBaseCore: { value: baseCorePositions },
        uBaseAxis: { value: baseAxes },
        uCamps: { value: campMarkers },
      }),
      defines: { DETAIL: qualitySettings.groundDetail, WATER: waterDetailLevel(qualitySettings) },
      vertexShader: TERRAIN_VERTEX_SHADER,
      fragmentShader: TERRAIN_FRAGMENT_SHADER,
      lights: !0,
      fog: !0,
    }),
    terrainMesh = new Mesh(buildTerrainBoundary(bushMap), terrainMaterial)
  return (
    (terrainMesh.name = "ground"),
    (terrainMesh.receiveShadow = !0),
    (terrainMesh.castShadow = !1),
    (terrainMesh.frustumCulled = !1),
    {
      mesh: terrainMesh,
      material: terrainMaterial,
      grassTexture: grassTexture,
      setQuality(targetObject) {
        const waterDetailLevelResult = waterDetailLevel(targetObject)
        ;(terrainMaterial.defines.DETAIL !== targetObject.groundDetail || terrainMaterial.defines.WATER !== waterDetailLevelResult) && ((terrainMaterial.defines.DETAIL = targetObject.groundDetail), (terrainMaterial.defines.WATER = waterDetailLevelResult), (terrainMaterial.needsUpdate = !0))
      },
    }
  )
}

export { buildTerrainGround, generateTerrainTextures }
