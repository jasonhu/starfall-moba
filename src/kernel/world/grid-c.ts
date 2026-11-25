/**
 * 网格工具C
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Mesh } from 'three'
import { BUCKET_MIN, SIGN_NEGATIVE, colorToRgb, lerp3, lerpScalar, scale3, smoothStepScalar } from '../fx/particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { fbmNoise2D, hashNoise2D } from '../render/foundation'
import { GRID_A_STONE_DARK, GRID_A_HALF, GRID_A_STONE, GRID_A_LEDGE_HEIGHT, GRID_A_ROCK, GRID_A_ROCK_LIGHT, GRID_A_DARK_FOLIAGE, GRID_A_PLATEAU_EDGE_HEIGHT, GRID_A_SLOPE_LIMIT, GRID_A_STONE_WARM, GRID_A_ROCK_DARK, GRID_A_ROCK_WARM, GRID_A_FOG, GRID_A_MOSS, GRID_A_LOWLAND_DEPTH, GRID_A_PLATEAU_HEIGHT } from './grid-a'
import { SUN_GROUND_DIRECTION } from '../render/scene-rigs'
import { MeshBuilder } from '../render/buff-view'

function computePolygonRimFrames(polygonPoints, isClosedRing?) {
  const count = polygonPoints.length,
    rimFrames = []
  let total = 0
  for (let index = 0; index < count; index++) {
    const selectedN = polygonPoints[(index + count - 1) % count],
      currentPoint = polygonPoints[index],
      nextPoint = polygonPoints[(index + 1) % count]
    let incomingEdgeDx = currentPoint.x - selectedN.x,
      incomingEdgeDy = currentPoint.y - selectedN.y,
      nextEdgeDx = nextPoint.x - currentPoint.x,
      outgoingEdgeDy = nextPoint.y - currentPoint.y
    const distance = Math.hypot(incomingEdgeDx, incomingEdgeDy),
      nextEdgeLength = Math.hypot(nextEdgeDx, outgoingEdgeDy)
    ;(distance < 1e-6 && ((incomingEdgeDx = nextEdgeDx), (incomingEdgeDy = outgoingEdgeDy)), nextEdgeLength < 1e-6 && ((nextEdgeDx = incomingEdgeDx), (outgoingEdgeDy = incomingEdgeDy)))
    const incomingEdgeLength = Math.hypot(incomingEdgeDx, incomingEdgeDy) || 1,
      outgoingEdgeLength = Math.hypot(nextEdgeDx, outgoingEdgeDy) || 1,
      incomingNormalX = -incomingEdgeDy / incomingEdgeLength,
      incomingNormalY = incomingEdgeDx / incomingEdgeLength,
      nextEdgeNormalX = -outgoingEdgeDy / outgoingEdgeLength,
      outgoingNormalY = nextEdgeDx / outgoingEdgeLength
    let bisectorX = incomingNormalX + nextEdgeNormalX,
      bisectorY = incomingNormalY + outgoingNormalY
    const bisectorLength = Math.hypot(bisectorX, bisectorY) || 1
    ;((bisectorX /= bisectorLength), (bisectorY /= bisectorLength))
    const miterCos = Math.max(0.35, bisectorX * incomingNormalX + bisectorY * incomingNormalY)
    ;(index > 0 && (total += Math.hypot(currentPoint.x - polygonPoints[index - 1].x, currentPoint.y - polygonPoints[index - 1].y)), rimFrames.push({ x: currentPoint.x, z: currentPoint.y, nx: bisectorX, nz: bisectorY, s: total, miter: 1 / miterCos }))
  }
  return rimFrames
}

function extrudeRibbonBand(builder, rimFrames, isClosedRing, rowCount, sampleVertex, rankSelector) {
  const lengthValue = rimFrames.length,
    vertexRows = []
  for (let index = 0; index < rowCount; index++) {
    const vertexRow = []
    for (let rimIndex = 0; rimIndex < lengthValue; rimIndex++) {
      const selectedT = rimFrames[rimIndex],
        iResult = sampleVertex(selectedT, rimIndex, index)
      vertexRow.push(builder.vertex(selectedT.x + selectedT.nx * iResult.t, iResult.y, selectedT.z + selectedT.nz * iResult.t, iResult.color, 0, 1, 0, 0, iResult.glow ?? 0, iResult.tex ?? 0, iResult.ao ?? 1))
    }
    vertexRows.push(vertexRow)
  }
  const columnCount = isClosedRing ? lengthValue : lengthValue - 1
  for (let rowIndex = 0; rowIndex < rowCount - 1; rowIndex++) {
    rankSelector && builder.setRank(rankSelector(rowIndex))
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const nextRimIndex = (columnIndex + 1) % lengthValue
      builder.quad(vertexRows[rowIndex][columnIndex], vertexRows[rowIndex + 1][columnIndex], vertexRows[rowIndex + 1][nextRimIndex], vertexRows[rowIndex][nextRimIndex])
    }
  }
  return (rankSelector && builder.setRank(BUCKET_MIN), vertexRows)
}

const GRID_C_GLOW_LOW = 0.4,
  GRID_C_BASE_DISTANCE = 0.8,
  GRID_C_CLIFF_BANDS = [GRID_C_BASE_DISTANCE, 1.3, 1.95, 2.8, 3.9, 5.3, 7.2, 30],
  GRID_C_CLIFF_GLOW_STOPS = [
    [GRID_C_BASE_DISTANCE, 0],
    [1.5, 0.08],
    [2.6, 0.22],
    [4.2, 0.36],
    [7, 0.46],
    [30, 0.48],
  ]

function sampleSquarePerimeter(halfExtent, sampleSpacing) {
  const corners = [
      { x: -halfExtent, y: -halfExtent },
      { x: -halfExtent, y: halfExtent },
      { x: halfExtent, y: halfExtent },
      { x: halfExtent, y: -halfExtent },
    ],
    perimeterPoints = [],
    sideStartIndices = []
  for (let index = 0; index < 4; index++) {
    const selectedE = corners[index],
      nextCorner = corners[(index + 1) % 4],
      distance = Math.hypot(nextCorner.x - selectedE.x, nextCorner.y - selectedE.y),
      sideSampleCount = Math.round(distance / sampleSpacing)
    sideStartIndices.push(perimeterPoints.length)
    for (let sampleIndex = 0; sampleIndex < sideSampleCount; sampleIndex++) perimeterPoints.push({ x: selectedE.x + ((nextCorner.x - selectedE.x) * sampleIndex) / sideSampleCount, y: selectedE.y + ((nextCorner.y - selectedE.y) * sampleIndex) / sideSampleCount })
  }
  return { pts: perimeterPoints, sideStart: sideStartIndices }
}

const GRID_C_TOP_ROWS = 7,
  GRID_C_TOP_ROW_OFFSET = GRID_C_TOP_ROWS,
  GRID_C_SLOPE_ROWS = 8,
  GRID_C_TOTAL_RING_ROWS = GRID_C_TOP_ROWS + GRID_C_SLOPE_ROWS + 4

/**
 * 创建地图。
 *
 * @param bushMap - 输入
 * @param terrainBuilder - 构建器
 * @param borderGroup - 第三输入
 * @param borderMaterial - 第四输入
 */
function buildMapBorder(bushMap, terrainBuilder, borderGroup, borderMaterial) {
  const borderMeshes = [],
    arenaBound = bushMap.map.bound,
    { pts: perimeterPoints, sideStart: sideStartIndices } = sampleSquarePerimeter(arenaBound, 1.25),
    computePolygonRimFramesResult = computePolygonRimFrames(perimeterPoints),
    rimFrameCount = computePolygonRimFramesResult.length,
    blueStoneColor = colorToRgb(ARENA_PALETTE.blue.stone),
    blueStoneDarkColor = colorToRgb(ARENA_PALETTE.blue.stoneDark),
    redStoneColor = colorToRgb(6969954),
    redStoneDarkColor = colorToRgb(ARENA_PALETTE.red.stoneDark),
    createSidePalette = (lookupKey) => {
      const stoneColor = lookupKey ? redStoneColor : blueStoneColor,
        stoneDarkColor = lookupKey ? redStoneDarkColor : blueStoneDarkColor,
        colorScale = lookupKey ? 1 : 0.8
      return { top: scale3(lerp3(stoneDarkColor, stoneColor, lookupKey ? 0.75 : 0.45), colorScale), face: scale3(lerp3(stoneDarkColor, stoneColor, lookupKey ? 0.55 : 0.3), colorScale), outer: scale3(stoneDarkColor, lookupKey ? 0.9 : 0.75), foot: scale3(stoneDarkColor, lookupKey ? 0.7 : 0.58) }
    },
    sidePalettes = [createSidePalette(!1), createSidePalette(!0)],
    sampleBorderVertex = (position, rimPointIndex, rowIndex) => {
      const southWeightResult = terrainBuilder.southWeight(position.x, position.z),
        noiseSeed = rimPointIndex * 13 + 7,
        profileJitter = (hashNoise2D(noiseSeed, rowIndex, 5) - 0.5) * 0.1,
        hasRockPatch = hashNoise2D(rimPointIndex, 77, 3) < 0.15 ? 1 : 0,
        isPlateauEdge = bushMap.baseDist(position.x - position.nx * 0.5, position.z - position.nz * 0.5) < 0.4,
        smoothStepScalarResult = smoothStepScalar(0.6, -0.8, bushMap.riverDist(position.x, position.z)),
        southRiverBlend = smoothStepScalarResult * southWeightResult,
        northRiverBlend = smoothStepScalarResult * (1 - southWeightResult),
        plateauHeight = isPlateauEdge ? GRID_A_PLATEAU_EDGE_HEIGHT : lerpScalar(GRID_A_PLATEAU_HEIGHT + (fbmNoise2D(position.s * 0.2, 3.3, 3, 15) - 0.5) * 0.8, GRID_A_PLATEAU_HEIGHT, northRiverBlend),
        lerpScalarResult = lerpScalar(0.9 + (fbmNoise2D(position.s * 0.45, 8.1, 2, 21) - 0.5) * 0.9, GRID_A_SLOPE_LIMIT, northRiverBlend),
        isRedSide = position.x - position.z > 0,
        selectedX = sidePalettes[isRedSide ? 1 : 0]
      let rimOffset,
        vertexHeight,
        vertexColor,
        vertexAo = 1,
        textureCoord = 1
      const vertexColorScale = 0.9 + hashNoise2D(rimPointIndex, 31, 9) * 0.2,
        alternatingTint = rimPointIndex % 2 === 0 ? 1.06 : 0.93,
        isRockZone = hashNoise2D(Math.floor(rimPointIndex / 3), 41, 17) < 0.3
      if (rowIndex < GRID_C_TOP_ROWS) {
        const hasLedgeDetail = !isPlateauEdge && hashNoise2D(rimPointIndex, 53, 29) < 0.2 ? 1 : 0,
          ledgeVariation = isPlateauEdge ? 0 : ((hashNoise2D(rimPointIndex, 19, 77) - 0.5) * 0.6 + hasLedgeDetail * 0.3) * (1 - northRiverBlend),
          plateauProfile = isPlateauEdge
            ? [
                [0, -0.05],
                [0.03, 0.13],
                [GRID_A_LEDGE_HEIGHT - 0.07, 0.15],
                [GRID_A_LEDGE_HEIGHT, plateauHeight * 0.5],
                [GRID_A_LEDGE_HEIGHT + 0.01, plateauHeight - 0.2],
                [GRID_A_LEDGE_HEIGHT + 0.02, plateauHeight - 0.03],
                [GRID_A_LEDGE_HEIGHT + 0.12, plateauHeight],
              ]
            : [
                [0, -0.05 - northRiverBlend * 0.7],
                [Math.max(0.04, 0.08 + profileJitter * 0.6 + hasRockPatch * 0.1 + ledgeVariation * 0.25), lerpScalarResult - 0.1],
                [Math.max(0.2, 0.28 + profileJitter + hasRockPatch * 0.08 + ledgeVariation * 0.6), lerpScalarResult + 0.06],
                [Math.max(0.26, 0.36 + profileJitter + hasRockPatch * 0.14 + ledgeVariation), lerpScalar(lerpScalarResult, plateauHeight, 0.5)],
                [Math.max(0.34, 0.46 + profileJitter + hasRockPatch * 0.12 + ledgeVariation), lerpScalar(lerpScalarResult, plateauHeight, 0.82)],
                [Math.max(0.42, 0.56 + profileJitter + hasRockPatch * 0.1 + ledgeVariation * 0.8), plateauHeight - 0.12],
                [0.98 + Math.max(0, ledgeVariation * 0.4), plateauHeight],
              ],
          lowlandProfileHeight = 0.42 * (1 - southRiverBlend),
          lowlandProfile = [
            [0, -0.05],
            [0.05, lowlandProfileHeight * 0.9 - southRiverBlend * 0.3],
            [0.2, lowlandProfileHeight - southRiverBlend * 0.32],
            [0.48, lowlandProfileHeight - southRiverBlend * 0.34],
            [0.57, lowlandProfileHeight - 0.1 - southRiverBlend * 0.4],
            [0.6, lowlandProfileHeight - 0.17 - southRiverBlend * 0.45],
            [0.72, lerpScalar(-0.9, GRID_A_LOWLAND_DEPTH, 0.82)],
          ]
        ;((rimOffset = lerpScalar(plateauProfile[rowIndex][0], lowlandProfile[rowIndex][0], southWeightResult)), (vertexHeight = lerpScalar(plateauProfile[rowIndex][1], lowlandProfile[rowIndex][1], southWeightResult)))
        const accentColor = isRockZone ? lerp3(GRID_A_ROCK_LIGHT, GRID_A_ROCK_WARM, 0.55) : lerp3(GRID_A_MOSS, GRID_A_STONE, 0.5),
          rockColorScale = 0.92 + hashNoise2D(rimPointIndex >> 1, 7, 63) * 0.16,
          rockRowColors = [lerp3(GRID_A_ROCK_DARK, GRID_A_ROCK, 0.2), lerp3(GRID_A_ROCK_DARK, GRID_A_ROCK, 0.65 - hasRockPatch * 0.3), lerp3(GRID_A_ROCK_LIGHT, GRID_A_MOSS, hashNoise2D(rimPointIndex, 5, 51) * 0.4), scale3(GRID_A_ROCK, rockColorScale), scale3(lerp3(GRID_A_ROCK, GRID_A_ROCK_DARK, 0.25), 2 - rockColorScale), isRockZone ? lerp3(GRID_A_ROCK, GRID_A_ROCK_LIGHT, 0.45) : lerp3(GRID_A_ROCK, GRID_A_MOSS, 0.55), accentColor],
          edgeStoneColors = [selectedX.foot, scale3(selectedX.face, alternatingTint), scale3(selectedX.face, 0.9), scale3(selectedX.face, alternatingTint), scale3(selectedX.face, alternatingTint * 1.04), scale3(selectedX.top, alternatingTint), selectedX.top],
          fbmNoise2DResult = fbmNoise2D(position.s * 0.31, 5.7, 2, 19),
          rockMossColor = lerp3(lerp3(GRID_A_ROCK_LIGHT, GRID_A_ROCK_WARM, 0.6), GRID_A_MOSS, smoothStepScalar(0.5, 0.75, fbmNoise2DResult) * 0.6),
          lowlandRowColors = [scale3(GRID_A_ROCK, 0.8), lerp3(GRID_A_ROCK_LIGHT, GRID_A_MOSS, fbmNoise2DResult * 0.5), rockMossColor, scale3(rockMossColor, 1.04), scale3(lerp3(GRID_A_ROCK_LIGHT, GRID_A_ROCK_WARM, 0.7), 0.8), scale3(GRID_A_ROCK_DARK, 0.66 * alternatingTint), scale3(GRID_A_ROCK_DARK, 0.5 * alternatingTint)],
          cliffTopColors = [selectedX.foot, scale3(selectedX.face, alternatingTint), scale3(selectedX.top, alternatingTint), scale3(selectedX.top, alternatingTint), scale3(selectedX.top, 1.06), scale3(selectedX.outer, alternatingTint), scale3(selectedX.foot, alternatingTint)],
          sunShade = smoothStepScalar(0.1, 0.6, -(position.nx * SUN_GROUND_DIRECTION.x + position.nz * SUN_GROUND_DIRECTION.y)),
          isMiddleTopRow = rowIndex >= 1 && rowIndex <= 5,
          northRowColor = isPlateauEdge ? edgeStoneColors[rowIndex] : isMiddleTopRow ? scale3(rockRowColors[rowIndex], 0.82 * lerpScalar(1, 0.8, sunShade) * (1 - hasLedgeDetail * 0.2)) : rockRowColors[rowIndex],
          southRowColor = isPlateauEdge ? cliffTopColors[rowIndex] : lowlandRowColors[rowIndex]
        ;((vertexColor = lerp3(northRowColor, southRowColor, southWeightResult)),
          rowIndex === 0 ? (vertexAo = lerpScalar(isPlateauEdge ? 0.6 : 0.72, 0.72, southWeightResult)) : isMiddleTopRow && !isPlateauEdge ? (vertexAo = lerpScalar(1 - sunShade * 0.27 - hasLedgeDetail * 0.2, rowIndex >= 5 ? 0.7 : 1, southWeightResult)) : isPlateauEdge && rowIndex === 2 && (vertexAo = 0.75),
          rowIndex === GRID_C_TOP_ROWS - 1 && (vertexAo = lerpScalar(vertexAo, 0.55, southWeightResult)),
          isPlateauEdge && (textureCoord = 0.3),
          northRiverBlend > 0 && rowIndex >= 3 && ((vertexHeight -= northRiverBlend * (rowIndex === 3 ? 0.1 : GRID_A_HALF)), (vertexColor = lerp3(vertexColor, [0.2, 0.36, 0.5], northRiverBlend * 0.6))),
          northRiverBlend > 0 && rowIndex < 3 && (vertexColor = lerp3(vertexColor, [0.1, 0.2, 0.28], northRiverBlend * 0.7)))
      } else {
        const edgeDistance = terrainBuilder.edgeDist(position.x, position.z) * lerpScalar(1, 0.93, southWeightResult),
          slopeWidths = [2, 3.6, 5.6, 8, 10.6, 13.2, edgeDistance - 2.2, edgeDistance],
          slopeRowIndex = rowIndex - GRID_C_TOP_ROW_OFFSET
        if (slopeRowIndex < GRID_C_SLOPE_ROWS) {
          ;((rimOffset = slopeWidths[slopeRowIndex]), slopeRowIndex < GRID_C_SLOPE_ROWS - 2 && (rimOffset = Math.min(rimOffset, edgeDistance - 3 - (GRID_C_SLOPE_ROWS - 2 - slopeRowIndex) * 0.4)))
          const sampleX = position.x + position.nx * rimOffset * position.miter,
            sampleZ = position.z + position.nz * rimOffset * position.miter
          vertexHeight = terrainBuilder.heightAt(sampleX, sampleZ)
          const fbmNoise2DFbmNoise2DResult = fbmNoise2D(sampleX * 0.16, sampleZ * 0.16, 3, 33),
            stoneNoise = fbmNoise2D(sampleX * 0.05 + 4, sampleZ * 0.05, 2, 71)
          let lerp3Lerp3Result = lerp3(GRID_A_DARK_FOLIAGE, GRID_A_STONE, fbmNoise2DFbmNoise2DResult)
          ;((lerp3Lerp3Result = lerp3(lerp3Lerp3Result, GRID_A_STONE_WARM, smoothStepScalar(0.55, 0.75, stoneNoise) * 0.6)),
            (lerp3Lerp3Result = scale3(lerp3Lerp3Result, lerpScalar(1, 0.6, southWeightResult))),
            (lerp3Lerp3Result = lerp3(lerp3Lerp3Result, GRID_A_FOG, smoothStepScalar(4, 40, rimOffset) * 0.55)),
            slopeRowIndex === 0 && (lerp3Lerp3Result = isRockZone ? lerp3(lerp3(GRID_A_ROCK_LIGHT, GRID_A_MOSS, 0.6 + southWeightResult * 0.3), lerp3Lerp3Result, 0.5) : lerp3(GRID_A_MOSS, lerp3Lerp3Result, 0.6)),
            slopeRowIndex === GRID_C_SLOPE_ROWS - 1 && (lerp3Lerp3Result = lerp3(GRID_A_ROCK_LIGHT, GRID_A_ROCK_WARM, 0.5)),
            isPlateauEdge && slopeRowIndex === 0 && (lerp3Lerp3Result = lerp3(lerp3(selectedX.top, lerp3Lerp3Result, 0.45), lerp3Lerp3Result, southWeightResult)),
            (vertexColor = lerp3Lerp3Result),
            (textureCoord = slopeRowIndex === GRID_C_SLOPE_ROWS - 1 ? 1 : slopeRowIndex === 0 ? 0.6 : GRID_C_GLOW_LOW))
        } else {
          const lowlandRowIndex = slopeRowIndex - GRID_C_SLOPE_ROWS,
            lowlandRowProfile = [
              [0.9, -3.5],
              [2.4, -14],
              [3.2, -30],
              [5.5, -52],
            ][lowlandRowIndex]
          ;((rimOffset = edgeDistance + lowlandRowProfile[0] + (hashNoise2D(noiseSeed, rowIndex, 81) - 0.5) * 0.9),
            (vertexHeight = terrainBuilder.heightAt(position.x + position.nx * edgeDistance * position.miter, position.z + position.nz * edgeDistance * position.miter) + lowlandRowProfile[1] + (hashNoise2D(noiseSeed, rowIndex, 83) - 0.5) * 2.5),
            (vertexColor = [GRID_A_ROCK, lerp3(GRID_A_ROCK, GRID_A_ROCK_DARK, 0.6), lerp3(GRID_A_ROCK_DARK, GRID_A_STONE_DARK, 0.5), GRID_A_STONE_DARK][lowlandRowIndex]))
        }
      }
      return { t: rimOffset * position.miter, y: vertexHeight, color: scale3(vertexColor, vertexColorScale), ao: vertexAo, tex: textureCoord }
    }
  for (let index = 0; index < 4; index++) {
    const selectedR = sideStartIndices[index],
      sideEndIndex = index === 3 ? rimFrameCount : sideStartIndices[index + 1],
      sideRimFrames = [],
      sideRimIndices = []
    for (let frameIndex = selectedR; frameIndex <= sideEndIndex; frameIndex++) (sideRimFrames.push(computePolygonRimFramesResult[frameIndex % rimFrameCount]), sideRimIndices.push(frameIndex % rimFrameCount))
    const meshBuilder = new MeshBuilder()
    ;(extrudeRibbonBand(
      meshBuilder,
      sideRimFrames,
      !1,
      GRID_C_TOTAL_RING_ROWS,
      (rimFrame, rimPointIndex, rowIndex) => sampleBorderVertex(rimFrame, sideRimIndices[rimPointIndex], rowIndex),
      (rowIndex) => (rowIndex < GRID_C_TOP_ROWS - 1 ? BUCKET_MIN : SIGN_NEGATIVE),
    ),
      meshBuilder.computeNormals(24))
    const borderMesh = new Mesh(meshBuilder.build(), borderMaterial)
    ;((borderMesh.name = `border:${index}`), (borderMesh.castShadow = !0), (borderMesh.receiveShadow = !0), (borderMesh.matrixAutoUpdate = !1), borderGroup.add(borderMesh), borderMeshes.push(borderMesh))
  }
  return borderMeshes
}

export { GRID_C_CLIFF_GLOW_STOPS, GRID_C_BASE_DISTANCE, GRID_C_CLIFF_BANDS, computePolygonRimFrames, GRID_C_GLOW_LOW, buildMapBorder, extrudeRibbonBand }