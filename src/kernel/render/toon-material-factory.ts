/**
 * 卡通材质工厂
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Mesh, Vector3 } from 'three'
import { FastRandom, createToonMaterial, fbmNoise2D, hashNoise2D } from './foundation'
import { colorToRgb, lerp3, scale3 } from '../fx/particle-system'
import { MeshBuilder } from './buff-view'

const MOUNTAIN_BASE_HEIGHT = -46

function buildMountainPeak(meshBuilder, centerX, centerZ, baseRadius, peakHeight, angleOffset, baseColor, snowColor) {
  const ringLayers = []
  for (let index = 0; index <= 4; index++) {
    const heightFraction = index / 4,
      ringVertexIndices = [],
      ringBaseY = MOUNTAIN_BASE_HEIGHT - 12 + (peakHeight + 12) * heightFraction,
      ringRadius = baseRadius * Math.pow(1 - heightFraction, 0.85) + (index === 4 ? 0 : baseRadius * 0.03)
    for (let vertexSegment = 0; vertexSegment < 9; vertexSegment++) {
      const ringAngle = (vertexSegment / 9) * Math.PI * 2 + angleOffset,
        vertexRadius = ringRadius * (0.78 + hashNoise2D(vertexSegment + index * 13, angleOffset * 100, 7) * 0.5),
        vertexY = ringBaseY + (index > 0 && index < 4 ? (hashNoise2D(vertexSegment, index + angleOffset * 50, 9) - 0.5) * peakHeight * 0.16 : 0),
        snowBlend = Math.min(1, Math.max(0, (heightFraction - 0.52) * 3.5 + (hashNoise2D(vertexSegment, index, 11) - 0.5) * 0.4)),
        vertexColor = lerp3(scale3(baseColor, 0.8 + heightFraction * 0.35), snowColor, snowBlend)
      ringVertexIndices.push(meshBuilder.vertex(centerX + Math.cos(ringAngle) * vertexRadius, vertexY, centerZ + Math.sin(ringAngle) * vertexRadius, vertexColor))
    }
    ringLayers.push(ringVertexIndices)
  }
  for (let layerIndex = 0; layerIndex < 4; layerIndex++)
    for (let quadSegment = 0; quadSegment < 9; quadSegment++) {
      const nextSegment = (quadSegment + 1) % 9
      meshBuilder.quad(ringLayers[layerIndex][quadSegment], ringLayers[layerIndex + 1][quadSegment], ringLayers[layerIndex + 1][nextSegment], ringLayers[layerIndex][nextSegment])
    }
}

function buildMountainRange() {
  const ToonMaterialValue = createToonMaterial({ vertexColors: !0, flat: !0, steps: 2, softness: 0.14, rim: 0, lightTint: !1, glowBoost: 1.1 }),
    meshBuilder = new MeshBuilder(),
    mountainRandom = new FastRandom(8086),
    peakBaseColor = colorToRgb(7308984),
    peakSnowColor = colorToRgb(15923199),
    peakCount = 34
  for (let index = 0; index < peakCount; index++) {
    const peakAngle = (index / peakCount) * Math.PI * 2 + mountainRandom.range(-0.06, 0.06),
      peakDistance = mountainRandom.range(240, 430),
      peakRadius = mountainRandom.range(70, 190) * (0.7 + 0.5 * fbmNoise2D(Math.cos(peakAngle) * 2, Math.sin(peakAngle) * 2, 2, 5))
    buildMountainPeak(meshBuilder, Math.cos(peakAngle) * peakDistance, Math.sin(peakAngle) * peakDistance, peakRadius * mountainRandom.range(0.55, 0.85), peakRadius, mountainRandom.next() * 6.28, peakBaseColor, peakSnowColor)
  }
  const spireLowerColor = colorToRgb(8160407),
    spireBottomColor = colorToRgb(5068398),
    spireTopColor = colorToRgb(6991182)
  for (let spireIndex = 0; spireIndex < 9; spireIndex++) {
    const spireAngle = mountainRandom.range(0, Math.PI * 2),
      spireRadius = mountainRandom.range(112, 190),
      spireCenterX = Math.cos(spireAngle) * spireRadius,
      spireCenterZ = Math.sin(spireAngle) * spireRadius,
      spireBodyRadius = mountainRandom.range(5, 13),
      spireBaseY = mountainRandom.range(-16, 6),
      spireHeight = spireBodyRadius * mountainRandom.range(1.2, 2),
      spireSegments = 8,
      spireUpperVertices = [],
      spireLowerVertices = [],
      vertexResult = meshBuilder.vertex(spireCenterX, spireBaseY + 0.6, spireCenterZ, spireTopColor),
      spireBottomTip = meshBuilder.vertex(spireCenterX + mountainRandom.range(-1, 1), spireBaseY - spireHeight, spireCenterZ + mountainRandom.range(-1, 1), spireBottomColor)
    for (let spireSegment = 0; spireSegment < spireSegments; spireSegment++) {
      const spireSegmentAngle = (spireSegment / spireSegments) * Math.PI * 2,
        spireVertexRadius = spireBodyRadius * mountainRandom.range(0.8, 1.15)
      ;(spireUpperVertices.push(meshBuilder.vertex(spireCenterX + Math.cos(spireSegmentAngle) * spireVertexRadius, spireBaseY + mountainRandom.range(-0.3, 0.3), spireCenterZ + Math.sin(spireSegmentAngle) * spireVertexRadius, lerp3(spireTopColor, spireLowerColor, 0.35))), spireLowerVertices.push(meshBuilder.vertex(spireCenterX + Math.cos(spireSegmentAngle) * spireVertexRadius * 0.72, spireBaseY - spireHeight * 0.4, spireCenterZ + Math.sin(spireSegmentAngle) * spireVertexRadius * 0.72, spireLowerColor)))
    }
    for (let spireFaceIndex = 0; spireFaceIndex < spireSegments; spireFaceIndex++) {
      const nextSpireSegment = (spireFaceIndex + 1) % spireSegments
      ;(meshBuilder.tri(vertexResult, spireUpperVertices[nextSpireSegment], spireUpperVertices[spireFaceIndex]), meshBuilder.quad(spireUpperVertices[spireFaceIndex], spireUpperVertices[nextSpireSegment], spireLowerVertices[nextSpireSegment], spireLowerVertices[spireFaceIndex]), meshBuilder.tri(spireLowerVertices[spireFaceIndex], spireLowerVertices[nextSpireSegment], spireBottomTip))
    }
  }
  {
    const normalizeResult = new Vector3(-0.32, 1, 0.22).normalize(),
      crossSectionBasisU = new Vector3(1, 0, 0).cross(normalizeResult).normalize(),
      crossSectionBasisV = normalizeResult.clone().cross(crossSectionBasisU).normalize(),
      beamBaseColor = colorToRgb(4877e3),
      beamTipColor = colorToRgb(11066623),
      beamOrigin = new Vector3(150, MOUNTAIN_BASE_HEIGHT - 20, -205),
      beamBaseVertices = [],
      beamTipVertices = []
    for (let rimSegment = 0; rimSegment < 6; rimSegment++) {
      const rimAngle = (rimSegment / 6) * Math.PI * 2,
        addScaledVectorResult = crossSectionBasisU.clone().multiplyScalar(Math.cos(rimAngle)).addScaledVector(crossSectionBasisV, Math.sin(rimAngle)),
        beamBaseRimVertex = beamOrigin.clone().addScaledVector(addScaledVectorResult, 24 * 0.8),
        beamTipRimVertex = beamOrigin
          .clone()
          .addScaledVector(normalizeResult, 150 * 0.72)
          .addScaledVector(addScaledVectorResult, 24)
      ;(beamBaseVertices.push(meshBuilder.vertex(beamBaseRimVertex.x, beamBaseRimVertex.y, beamBaseRimVertex.z, beamBaseColor, 0, 1, 0, 0, 0.25)), beamTipVertices.push(meshBuilder.vertex(beamTipRimVertex.x, beamTipRimVertex.y, beamTipRimVertex.z, lerp3(beamBaseColor, beamTipColor, 0.6), 0, 1, 0, 0, 0.5)))
    }
    const beamApex = beamOrigin.clone().addScaledVector(normalizeResult, 150),
      beamApexVertex = meshBuilder.vertex(beamApex.x, beamApex.y, beamApex.z, beamTipColor, 0, 1, 0, 0, 0.8)
    for (let rimFaceIndex = 0; rimFaceIndex < 6; rimFaceIndex++) {
      const nextRimIndex = (rimFaceIndex + 1) % 6
      ;(meshBuilder.quad(beamBaseVertices[rimFaceIndex], beamTipVertices[rimFaceIndex], beamTipVertices[nextRimIndex], beamBaseVertices[nextRimIndex]), meshBuilder.tri(beamTipVertices[rimFaceIndex], beamApexVertex, beamTipVertices[nextRimIndex]))
    }
  }
  meshBuilder.computeNormals()
  const mountainMesh = new Mesh(meshBuilder.build(), ToonMaterialValue)
  return ((mountainMesh.name = "mountains"), (mountainMesh.matrixAutoUpdate = !1), (mountainMesh.frustumCulled = !1), mountainMesh)
}

export { MOUNTAIN_BASE_HEIGHT, buildMountainRange }
