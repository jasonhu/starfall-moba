/**
 * 纹理生成工厂
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three'
import { FastRandom, fbmNoise2D, valueNoise2D } from './foundation'

const clampToByteRange = (rawChannel) => (rawChannel < 0 ? 0 : rawChannel > 255 ? 255 : rawChannel)

const clampToUnitRange = (rawUnit) => (rawUnit < 0 ? 0 : rawUnit > 1 ? 1 : rawUnit),
  smoothStepBetween = (lowerEdge, upperEdge, samplePoint) => {
    const clampToUnitRangeResult = clampToUnitRange((samplePoint - lowerEdge) / (upperEdge - lowerEdge))
    return clampToUnitRangeResult * clampToUnitRangeResult * (3 - 2 * clampToUnitRangeResult)
  }

function createTileableDataTexture(pixelData, resolution, anisotropyLevel) {
  const dataTexture = new DataTexture(pixelData, resolution, resolution, RGBAFormat, UnsignedByteType)
  return ((dataTexture.wrapS = dataTexture.wrapT = RepeatWrapping), (dataTexture.colorSpace = NoColorSpace), (dataTexture.generateMipmaps = !0), (dataTexture.minFilter = LinearMipmapLinearFilter), (dataTexture.magFilter = LinearFilter), (dataTexture.anisotropy = anisotropyLevel), (dataTexture.needsUpdate = !0), dataTexture)
}

const NOISE_CELL_GRID_SIZE = 5

/**
 * 创建地形。
 *
 * @param position - 坐标
 * @param textureResolution - 次要输入
 * @param anisotropyLevel - 第三输入
 * @returns 结果对象
 */
function generateTerrainNoiseTextures(position, textureResolution = 512, anisotropyLevel = 8) {
  const nOISE_CELL_GRID_SIZE = NOISE_CELL_GRID_SIZE,
    random = new FastRandom(4127),
    cellCount = nOISE_CELL_GRID_SIZE * nOISE_CELL_GRID_SIZE,
    float32Array = new Float32Array(cellCount),
    featurePointY = new Float32Array(cellCount),
    uint8Array = new Uint8Array(cellCount),
    cellJitterX = new Float32Array(cellCount),
    cellJitterY = new Float32Array(cellCount),
    cellEdgeVariant = new Uint8Array(cellCount)
  for (let index = 0; index < cellCount; index++) {
    ;((float32Array[index] = (index % nOISE_CELL_GRID_SIZE) + 0.5 + random.range(-0.26, 0.26)), (featurePointY[index] = Math.floor(index / nOISE_CELL_GRID_SIZE) + 0.5 + random.range(-0.26, 0.26)))
    const cellTypeRoll = random.next()
    ;((uint8Array[index] = cellTypeRoll < 0.3 ? 0 : cellTypeRoll < 0.58 ? 1 : cellTypeRoll < 0.8 ? 2 : 3), (cellJitterX[index] = random.range(-0.13, 0.13)), (cellJitterY[index] = random.range(-0.13, 0.13)), (cellEdgeVariant[index] = random.chance(0.5) ? 1 : 0))
  }
  const boundaryMaterialNoise = new Float32Array(cellCount * 3),
    boundaryNoiseScale = new Float32Array(cellCount * 3),
    boundaryNormalX = new Float32Array(cellCount * 3),
    boundaryNormalY = new Float32Array(cellCount * 3),
    boundaryCarveFlag = new Uint8Array(cellCount * 3)
  for (let boundarySlotIndex = 0; boundarySlotIndex < cellCount * 3; boundarySlotIndex++) ((boundaryMaterialNoise[boundarySlotIndex] = random.range(-1, 1)), (boundaryNoiseScale[boundarySlotIndex] = random.range(0.06, 1)), (boundaryNormalX[boundarySlotIndex] = random.range(-1, 1)), (boundaryNormalY[boundarySlotIndex] = random.range(-1, 1)), (boundaryCarveFlag[boundarySlotIndex] = random.chance(0.16) ? 1 : 0))
  const pixelCount = textureResolution * textureResolution,
    heightField = new Float32Array(pixelCount),
    materialField = new Float32Array(pixelCount),
    heightMaskField = new Float32Array(pixelCount),
    uint16Array = new Uint16Array(pixelCount),
    detailField = new Float32Array(pixelCount),
    edgeFadeWidth = 0.05
  for (let fieldRow = 0; fieldRow < textureResolution; fieldRow++)
    for (let fieldColumn = 0; fieldColumn < textureResolution; fieldColumn++) {
      const unitX = fieldColumn / textureResolution,
        unitY = fieldRow / textureResolution,
        cellGridX = unitX * nOISE_CELL_GRID_SIZE,
        cellGridY = unitY * nOISE_CELL_GRID_SIZE,
        cellColumnIndex = Math.floor(cellGridX),
        cellRowIndex = Math.floor(cellGridY)
      let nearestCellDistance = 9,
        secondNearestDistance = 9,
        nearestCellIndex = 0,
        nearestOffsetX = 0,
        nearestOffsetY = 0
      for (let neighborRowOffset = -1; neighborRowOffset <= 1; neighborRowOffset++)
        for (let neighborColumnOffset = -1; neighborColumnOffset <= 1; neighborColumnOffset++) {
          const wrappedColumn = (cellColumnIndex + neighborColumnOffset + nOISE_CELL_GRID_SIZE) % nOISE_CELL_GRID_SIZE,
            wrappedRow = (cellRowIndex + neighborRowOffset + nOISE_CELL_GRID_SIZE) % nOISE_CELL_GRID_SIZE,
            neighborCellIndex = wrappedRow * nOISE_CELL_GRID_SIZE + wrappedColumn,
            offsetX = cellGridX - (float32Array[neighborCellIndex] - wrappedColumn + cellColumnIndex + neighborColumnOffset),
            offsetY = cellGridY - (featurePointY[neighborCellIndex] - wrappedRow + cellRowIndex + neighborRowOffset),
            absOffsetX = Math.abs(offsetX),
            absOffsetY = Math.abs(offsetY),
            distance = Math.hypot(offsetX, offsetY) * 0.2 + Math.max(absOffsetX, absOffsetY) * 0.8
          distance < nearestCellDistance ? ((secondNearestDistance = nearestCellDistance), (nearestCellDistance = distance), (nearestCellIndex = neighborCellIndex), (nearestOffsetX = offsetX), (nearestOffsetY = offsetY)) : distance < secondNearestDistance && (secondNearestDistance = distance)
        }
      let total = (secondNearestDistance - nearestCellDistance) * 0.5,
        boundaryType = 0
      const selectedL = uint8Array[nearestCellIndex]
      if (selectedL === 1 || selectedL === 3) {
        const boundaryDeltaX = nearestOffsetX - cellJitterX[nearestCellIndex]
        if (((boundaryType = boundaryDeltaX > 0 ? 1 : 0), (total = Math.min(total, Math.abs(boundaryDeltaX))), selectedL === 3 && boundaryType === cellEdgeVariant[nearestCellIndex])) {
          const horizontalBoundaryDelta = nearestOffsetY - cellJitterY[nearestCellIndex]
          ;(horizontalBoundaryDelta > 0 && (boundaryType = 2), (total = Math.min(total, Math.abs(horizontalBoundaryDelta))))
        }
      } else if (selectedL === 2) {
        const horizontalBoundaryGap = nearestOffsetY - cellJitterY[nearestCellIndex]
        ;((boundaryType = horizontalBoundaryGap > 0 ? 1 : 0), (total = Math.min(total, Math.abs(horizontalBoundaryGap))))
      }
      const nearestBoundaryIndex = nearestCellIndex * 3 + boundaryType,
        fbmNoise2DResult = fbmNoise2D(unitX * 6, unitY * 6, 3, 5, 6),
        valueNoise2DResult = valueNoise2D(unitX * 28, unitY * 28, 9, 28),
        valueNoise2DValueNoise2DResult = valueNoise2D(unitX * 90, unitY * 90, 13, 90)
      total += (valueNoise2DResult - 0.5) * 0.008
      const edgeThreshold = 0.0085 + (fbmNoise2DResult - 0.5) * 0.003,
        pixelIndex = fieldRow * textureResolution + fieldColumn,
        heightMask = clampToUnitRange((total - edgeThreshold) / 0.009),
        heightEdgeFade = clampToUnitRange((total - edgeThreshold) / edgeFadeWidth)
      let terrainHeight = (1 - (1 - heightEdgeFade) * (1 - heightEdgeFade)) * (0.86 + (fbmNoise2DResult - 0.5) * 0.3 + (valueNoise2DValueNoise2DResult - 0.5) * 0.07),
        materialTone = 0.5 + boundaryMaterialNoise[nearestBoundaryIndex] * 0.055 + (fbmNoise2DResult - 0.5) * 0.09 + (valueNoise2DValueNoise2DResult - 0.5) * 0.035
      const crackMask = smoothStepBetween(0.78, 0.92, valueNoise2D(unitX * 19 + 3.7, unitY * 19, 31, 19)) * (1 - smoothStepBetween(0.02, 0.13, total - edgeThreshold))
      if (((terrainHeight -= crackMask * 0.4), (materialTone -= crackMask * 0.05), boundaryCarveFlag[nearestBoundaryIndex] && total > edgeThreshold + 0.035)) {
        const fbmNoise2DFbmNoise2DResult = fbmNoise2D(unitX * 7 + boundaryNoiseScale[nearestBoundaryIndex] * 13, unitY * 7 + boundaryNoiseScale[nearestBoundaryIndex] * 5, 2, 77, 7),
          veinCarveMask = 1 - smoothStepBetween(0.004, 0.013, Math.abs(fbmNoise2DFbmNoise2DResult - 0.5))
        ;((terrainHeight -= veinCarveMask * 0.5), (materialTone -= veinCarveMask * 0.1))
      }
      ;((heightField[pixelIndex] = heightMask > 0 ? Math.max(0.02, terrainHeight) * heightMask : 0), (materialField[pixelIndex] = materialTone), (heightMaskField[pixelIndex] = heightMask), (uint16Array[pixelIndex] = nearestBoundaryIndex), (detailField[pixelIndex] = clampToUnitRange(fbmNoise2D(unitX * 4 + 9.3, unitY * 4 + 2.1, 3, 41, 4) * 0.8 + (1 - smoothStepBetween(0, 0.13, total - edgeThreshold)) * 0.34 - 0.05)))
    }
  const dataPixels = new Uint8Array(pixelCount * 4),
    normalPixels = new Uint8Array(pixelCount * 4),
    sampleHeightWrapped = (sampleColumn, sampleRow) => heightField[((sampleRow + textureResolution) % textureResolution) * textureResolution + ((sampleColumn + textureResolution) % textureResolution)],
    normalStrength = 2.4 / (800 / textureResolution) / 2
  for (let outputRow = 0; outputRow < textureResolution; outputRow++)
    for (let outputColumn = 0; outputColumn < textureResolution; outputColumn++) {
      const outputPixelIndex = outputRow * textureResolution + outputColumn,
        selectedK = uint16Array[outputPixelIndex],
        selected_ = heightMaskField[outputPixelIndex]
      let normalX = -(sampleHeightWrapped(outputColumn + 1, outputRow) - sampleHeightWrapped(outputColumn - 1, outputRow)) * normalStrength + boundaryNormalX[selectedK] * 0.03 * selected_,
        normalY = -(sampleHeightWrapped(outputColumn, outputRow + 1) - sampleHeightWrapped(outputColumn, outputRow - 1)) * normalStrength + boundaryNormalY[selectedK] * 0.03 * selected_
      const normalInverseLength = 1 / Math.hypot(normalX, normalY, 1)
      ;((normalX *= normalInverseLength), (normalY *= normalInverseLength))
      const lightFactor = (normalX * position.x + normalInverseLength * position.y + normalY * position.z) / position.y
      ;((dataPixels[outputPixelIndex * 4] = clampToByteRange(materialField[outputPixelIndex] * 255)),
        (dataPixels[outputPixelIndex * 4 + 1] = clampToByteRange(selected_ * 255)),
        (dataPixels[outputPixelIndex * 4 + 2] = clampToByteRange(boundaryNoiseScale[selectedK] * 255)),
        (dataPixels[outputPixelIndex * 4 + 3] = clampToByteRange(lightFactor * 127.5)),
        (normalPixels[outputPixelIndex * 4] = clampToByteRange((normalX * 0.5 + 0.5) * 255)),
        (normalPixels[outputPixelIndex * 4 + 1] = clampToByteRange((normalY * 0.5 + 0.5) * 255)),
        (normalPixels[outputPixelIndex * 4 + 2] = clampToByteRange(heightField[outputPixelIndex] * 255)),
        (normalPixels[outputPixelIndex * 4 + 3] = clampToByteRange(detailField[outputPixelIndex] * 255)))
    }
  return { data: createTileableDataTexture(dataPixels, textureResolution, anisotropyLevel), normal: createTileableDataTexture(normalPixels, textureResolution, anisotropyLevel) }
}

export { generateTerrainNoiseTextures, smoothStepBetween, createTileableDataTexture, clampToUnitRange, clampToByteRange }
