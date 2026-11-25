/**
 * 河流几何生成
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three'
import { MAP_GRID_HALF_EXTENT, WATER_LEVEL, monsterRadius } from './map-geometry'
import { ARENA_PALETTE, ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { makeLightUniforms } from '../render/foundation'
import { riverFlowDirection } from '../render/terrain-shaders'
import { PARTICLE_SOFT_FRAGMENT_SHADER, PARTICLE_SOFT_VERTEX_SHADER } from '../render/particle-shaders-extra'

/**
 * 创建模型。
 *
 * @param bushMap - 输入
 * @param splatMaps - 次要输入
 * @param noiseTexture - 第三输入
 * @param qualitySettings - 第四输入
 */
function buildRiverMesh(bushMap, splatMaps, noiseTexture, qualitySettings) {
  const riverLinePoints = bushMap.riverLine,
    halfRiverWidth = bushMap.map.riverWidth / 2 + 0.6,
    mapBound = bushMap.map.bound,
    vertexPositions = [],
    faceIndices = []
  for (let index = 0; index < riverLinePoints.length - 1; index++) {
    const selectedI = riverLinePoints[index],
      nextPoint = riverLinePoints[index + 1],
      distance = Math.hypot(nextPoint.x - selectedI.x, nextPoint.y - selectedI.y),
      directionX = (nextPoint.x - selectedI.x) / distance,
      directionY = (nextPoint.y - selectedI.y) / distance,
      segmentCount = Math.ceil(distance / 3)
    for (let segmentStep = 0; segmentStep < segmentCount; segmentStep++) {
      const stepDistanceStart = (segmentStep / segmentCount) * distance,
        stepDistanceEnd = ((segmentStep + 1) / segmentCount) * distance,
        midpointX = selectedI.x + (directionX * (stepDistanceStart + stepDistanceEnd)) / 2,
        midpointY = selectedI.y + (directionY * (stepDistanceStart + stepDistanceEnd)) / 2
      if (Math.max(Math.abs(midpointX), Math.abs(midpointY)) > mapBound + 3) continue
      const baseVertexIndex = vertexPositions.length / 3
      for (const meshOffset of [stepDistanceStart, stepDistanceEnd])
        for (const bankSide of [-1, 1]) {
          const bankVertexX = selectedI.x + directionX * meshOffset - directionY * halfRiverWidth * bankSide,
            bankVertexY = selectedI.y + directionY * meshOffset + directionX * halfRiverWidth * bankSide
          vertexPositions.push(Math.max(-mapBound - 0.35, Math.min(mapBound, bankVertexX)), WATER_LEVEL, Math.max(-mapBound - 0.35, Math.min(mapBound, bankVertexY)))
        }
      faceIndices.push(baseVertexIndex, baseVertexIndex + 2, baseVertexIndex + 1, baseVertexIndex + 1, baseVertexIndex + 2, baseVertexIndex + 3)
    }
  }
  const element = new BufferGeometry()
  ;(element.setAttribute("position", new Float32BufferAttribute(vertexPositions, 3)), element.setIndex(faceIndices), element.computeBoundingSphere())
  const envPalette = ARENA_PALETTE.env,
    pitSources = bushMap.map.camps.filter((monster) => monster.monsterType === "abyss_drake" || monster.monsterType === "star_colossus").map((camp) => new Vector3(camp.pos.x, camp.pos.y, monsterRadius(camp.monsterType)))
  for (; pitSources.length < 2;) pitSources.push(new Vector3(9999, 9999, 1))
  const waterMaterial = new ShaderMaterial({
      uniforms: makeLightUniforms({
        tNoise: { value: noiseTexture },
        tSplatA: { value: splatMaps.a },
        uTime: ARENA_SHARED_UNIFORMS.uTime,
        uSplatScale: { value: 1 / (MAP_GRID_HALF_EXTENT * 2) },
        uFlow: { value: riverFlowDirection(bushMap) },
        cShallow: { value: new Color(envPalette.waterShallow) },
        cDeep: { value: new Color(envPalette.water) },
        cPit: { value: new Color(1327214) },
        cSky: { value: new Color(14677247) },
        cFoam: { value: new Color(envPalette.foam) },
        uPits: { value: pitSources.slice(0, 2) },
      }),
      defines: { WATER: qualitySettings.waterDetail },
      vertexShader: PARTICLE_SOFT_VERTEX_SHADER,
      fragmentShader: PARTICLE_SOFT_FRAGMENT_SHADER,
      lights: !0,
      fog: !0,
      transparent: !0,
      depthWrite: !1,
      side: DoubleSide,
    }),
    waterMesh = new Mesh(element, waterMaterial)
  return (
    (waterMesh.name = "water"),
    (waterMesh.receiveShadow = !0),
    (waterMesh.renderOrder = 1),
    (waterMesh.frustumCulled = !1),
    {
      mesh: waterMesh,
      setQuality(targetObject) {
        waterMaterial.defines.WATER !== targetObject.waterDetail && ((waterMaterial.defines.WATER = targetObject.waterDetail), (waterMaterial.needsUpdate = !0))
      },
    }
  )
}

export { buildRiverMesh }
