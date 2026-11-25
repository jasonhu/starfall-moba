/**
 * 网格工具B
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three'
import { GRID_A_HALF, GRID_A_SLOPE_LIMIT, GRID_A_PLATEAU_HEIGHT } from './grid-a'
import { WATER_LEVEL } from './map-geometry'
import { lerpScalar } from '../fx/particle-system'
import { ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { FOG_FRAGMENT_SHADER, FOG_VERTEX_SHADER } from '../render/fog-shaders'

function buildWaterfalls(bushMap, terrainSampler, noiseTexture, effectsBuffer) {
  const arenaBound = bushMap.map.bound,
    waterfallSections = [],
    makeVertex = (detail, vertexY, vertexZ) => new Vector3(detail, vertexY, vertexZ),
    crestHeight = GRID_A_PLATEAU_HEIGHT - GRID_A_HALF,
    rowProfiles = [
      [2.15, 0],
      [1.02, crestHeight + 0.05],
      [0.5, crestHeight - 0.06],
      [0.3, 1.72],
      [0.2, GRID_A_SLOPE_LIMIT + 0.36],
      [0.1, GRID_A_SLOPE_LIMIT - 0.08],
      [-0.06, WATER_LEVEL + 0.02],
    ],
    rowWidthOffsets = [0, 0, 0.05, 0.12, 0.2, 0.3, 0.42],
    aConfig = { a: -arenaBound + 1.5, c: -arenaBound + 4.3 },
    zSpan = { a: -arenaBound + 4.2, c: -arenaBound + 1.8 }
  ;(waterfallSections.push({
    rows: rowProfiles.map(([edgeOutset, rowHeight], rowIndex) => {
      const edgeZ = -arenaBound - edgeOutset,
        waterfallHeight = rowIndex === 0 ? terrainSampler.heightAt((aConfig.a + aConfig.c) / 2, edgeZ) + 0.06 : rowHeight
      return [makeVertex(aConfig.a - rowWidthOffsets[rowIndex], waterfallHeight, edgeZ), makeVertex(aConfig.c + rowWidthOffsets[rowIndex], waterfallHeight, edgeZ)]
    }),
    bulge: makeVertex(0, 0, 0.16),
    fall: 1,
  }),
    waterfallSections.push({
      rows: rowProfiles.map(([edgeOutset, rowHeight], rowIndex) => {
        const outerEdgeX = -arenaBound - edgeOutset,
          waterfallHeight = rowIndex === 0 ? terrainSampler.heightAt(outerEdgeX, (zSpan.a + zSpan.c) / 2) + 0.06 : rowHeight
        return [makeVertex(outerEdgeX, waterfallHeight, zSpan.a + rowWidthOffsets[rowIndex]), makeVertex(outerEdgeX, waterfallHeight, zSpan.c - rowWidthOffsets[rowIndex])]
      }),
      bulge: makeVertex(0.16, 0, 0),
      fall: 1,
    }),
    effectsBuffer.glows.push({ x: -arenaBound + 2.9, z: -arenaBound + 0.8, y: WATER_LEVEL + 0.03, r: 2.6, color: [0.8, 0.95, 1] }),
    effectsBuffer.glows.push({ x: -arenaBound + 0.8, z: -arenaBound + 3, y: WATER_LEVEL + 0.03, r: 2.2, color: [0.8, 0.95, 1] }))
  for (const [rippleX, rippleZ, rippleRadius] of [
    [-arenaBound + 2.2, -arenaBound + 0.55, 1],
    [-arenaBound + 3.6, -arenaBound + 0.5, 0.8],
    [-arenaBound + 0.55, -arenaBound + 2.4, 0.9],
    [-arenaBound + 0.5, -arenaBound + 3.6, 0.75],
  ])
    effectsBuffer.ripples.push({ x: rippleX, z: rippleZ, r: rippleRadius })
  const edgeTerrainHeight = terrainSampler.heightAt(arenaBound - 3.5, arenaBound + 2.2) + 0.12
  ;(waterfallSections.push({
    rows: [
      [makeVertex(arenaBound - 6.4, WATER_LEVEL, arenaBound - 0.5), makeVertex(arenaBound - 0.2, WATER_LEVEL, arenaBound - 0.5)],
      [makeVertex(arenaBound - 6.6, WATER_LEVEL - 0.02, arenaBound + 0.45), makeVertex(arenaBound - 0.2, WATER_LEVEL - 0.02, arenaBound + 0.45)],
      [makeVertex(arenaBound - 6.8, lerpScalar(WATER_LEVEL, edgeTerrainHeight, 0.5), arenaBound + 1), makeVertex(arenaBound + 0.1, lerpScalar(WATER_LEVEL, edgeTerrainHeight, 0.5), arenaBound + 1)],
      [makeVertex(arenaBound - 7, edgeTerrainHeight, arenaBound + 1.5), makeVertex(arenaBound + 0.4, edgeTerrainHeight, arenaBound + 1.5)],
    ],
    bulge: makeVertex(0, 0.1, 0.22),
    fall: 1,
  }),
    waterfallSections.push({
      rows: [
        [makeVertex(arenaBound - 7.2, edgeTerrainHeight, arenaBound + 1.2), makeVertex(arenaBound + 0.8, edgeTerrainHeight, arenaBound + 1.2)],
        [makeVertex(arenaBound - 4.4, edgeTerrainHeight - 0.08, arenaBound + 6.5), makeVertex(arenaBound + 4.4, edgeTerrainHeight - 0.08, arenaBound + 4.8)],
        [makeVertex(arenaBound - 0.2, edgeTerrainHeight - 0.16, arenaBound + 12), makeVertex(arenaBound + 8, edgeTerrainHeight - 0.16, arenaBound + 8.6)],
        [makeVertex(arenaBound + 4.5, edgeTerrainHeight - 0.25, arenaBound + 17), makeVertex(arenaBound + 11.5, edgeTerrainHeight - 0.25, arenaBound + 12)],
      ],
      bulge: makeVertex(0, 0, 0),
      fall: 0,
    }),
    effectsBuffer.glows.push({ x: arenaBound - 3.2, z: arenaBound + 1.9, y: edgeTerrainHeight + 0.05, r: 3.4, color: [0.8, 0.95, 1] }))
  const vertexPositions = [],
    uvCoords = [],
    fallAttributes = [],
    triangleIndices = [],
    crossSectionSegments = 4,
    surfaceVertex = new Vector3(),
    vector3 = new Vector3(),
    previousRowMidpoint = new Vector3()
  for (const waterfallSection of waterfallSections) {
    const vertexOffset = vertexPositions.length / 3,
      count = waterfallSection.rows.length,
      cumulativeDistances = [0]
    for (let index = 1; index < count; index++) (vector3.addVectors(waterfallSection.rows[index][0], waterfallSection.rows[index][1]).multiplyScalar(0.5), previousRowMidpoint.addVectors(waterfallSection.rows[index - 1][0], waterfallSection.rows[index - 1][1]).multiplyScalar(0.5), cumulativeDistances.push(cumulativeDistances[index - 1] + vector3.distanceTo(previousRowMidpoint)))
    const sectionLength = cumulativeDistances[count - 1] || 1
    for (let stripRowIndex = 0; stripRowIndex < count; stripRowIndex++) {
      const rowFraction = cumulativeDistances[stripRowIndex] / sectionLength,
        bulgeWeight = Math.sin(rowFraction * Math.PI) * 0.6 + rowFraction * 0.4
      for (let crossSectionSampleIndex = 0; crossSectionSampleIndex <= crossSectionSegments; crossSectionSampleIndex++) {
        const crossSectionFraction = crossSectionSampleIndex / crossSectionSegments
        ;(surfaceVertex.lerpVectors(waterfallSection.rows[stripRowIndex][0], waterfallSection.rows[stripRowIndex][1], crossSectionFraction).addScaledVector(waterfallSection.bulge, bulgeWeight * Math.sin(crossSectionFraction * Math.PI) * 1.3), vertexPositions.push(surfaceVertex.x, surfaceVertex.y, surfaceVertex.z), uvCoords.push(crossSectionFraction, cumulativeDistances[stripRowIndex]), fallAttributes.push(rowFraction, waterfallSection.fall))
      }
    }
    for (let rowSegmentIndex = 0; rowSegmentIndex < count - 1; rowSegmentIndex++)
      for (let crossSectionQuadIndex = 0; crossSectionQuadIndex < crossSectionSegments; crossSectionQuadIndex++) {
        const quadStartIndex = vertexOffset + rowSegmentIndex * (crossSectionSegments + 1) + crossSectionQuadIndex
        triangleIndices.push(quadStartIndex, quadStartIndex + crossSectionSegments + 1, quadStartIndex + 1, quadStartIndex + 1, quadStartIndex + crossSectionSegments + 1, quadStartIndex + crossSectionSegments + 2)
      }
  }
  const element = new BufferGeometry()
  ;(element.setAttribute("position", new Float32BufferAttribute(vertexPositions, 3)), element.setAttribute("uv", new Float32BufferAttribute(uvCoords, 2)), element.setAttribute("aFall", new Float32BufferAttribute(fallAttributes, 2)), element.setIndex(triangleIndices))
  const waterfallMaterial = new ShaderMaterial({ uniforms: { ...UniformsUtils.clone(UniformsLib.fog), tNoise: { value: noiseTexture }, uTime: ARENA_SHARED_UNIFORMS.uTime }, vertexShader: FOG_VERTEX_SHADER, fragmentShader: FOG_FRAGMENT_SHADER, transparent: !0, depthWrite: !1, side: DoubleSide, fog: !0 }),
    waterfallMesh = new Mesh(element, waterfallMaterial)
  return ((waterfallMesh.name = "waterfalls"), (waterfallMesh.renderOrder = 2), (waterfallMesh.frustumCulled = !1), waterfallMesh)
}

export { buildWaterfalls }
