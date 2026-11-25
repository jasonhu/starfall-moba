/**
 * 画布工厂
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { clampToByteRange } from './texture-factory'
import { FastRandom, createCanvas, fbmNoise2D, forEachNeighbor } from './foundation'

function fillCanvasWithPattern(builder, canvasResolution, tileResolution, pixelColorSampler) {
  const element = document.createElement("canvas")
  element.width = element.height = tileResolution
  const ContextValue = element.getContext("2d")
  if (!ContextValue) return
  const ImageDataValue = ContextValue.createImageData(tileResolution, tileResolution),
    pixelData = ImageDataValue.data
  for (let index = 0; index < tileResolution; index++)
    for (let pixelColumn = 0; pixelColumn < tileResolution; pixelColumn++) {
      const [redChannel, greenChannel, blueChannel] = pixelColorSampler(pixelColumn / tileResolution, index / tileResolution),
        pixelByteOffset = (index * tileResolution + pixelColumn) * 4
      ;((pixelData[pixelByteOffset] = clampToByteRange(redChannel)), (pixelData[pixelByteOffset + 1] = clampToByteRange(greenChannel)), (pixelData[pixelByteOffset + 2] = clampToByteRange(blueChannel)), (pixelData[pixelByteOffset + 3] = 255))
    }
  ContextValue.putImageData(ImageDataValue, 0, 0)
  const PatternValue = builder.createPattern(element, "repeat")
  if (!PatternValue) return
  const tileScale = canvasResolution / tileResolution
  ;(builder.save(), (builder.imageSmoothingEnabled = !0), (builder.imageSmoothingQuality = "high"), builder.scale(tileScale, tileScale), (builder.fillStyle = PatternValue), builder.fillRect(0, 0, tileResolution, tileResolution), builder.restore())
}

function createGrassTexture(textureResolution = 1024) {
  return createCanvas(
    textureResolution,
    textureResolution,
    (drawContext) => {
      const resolutionScale = textureResolution / 512
      fillCanvasWithPattern(drawContext, textureResolution, 256, (patternU, patternV) => {
        const fbmNoise2DResult = fbmNoise2D(patternU * 7, patternV * 7, 4, 13, 7),
          fbmNoise2DFbmNoise2DResult = fbmNoise2D(patternU * 48, patternV * 48, 2, 29, 48),
          grassTone = 120 + (fbmNoise2DResult - 0.5) * 40 + (fbmNoise2DFbmNoise2DResult - 0.5) * 16
        return [grassTone * 0.98, grassTone * 1.02, grassTone * 0.96]
      })
      const grassRandom = new FastRandom(2024)
      drawContext.lineCap = "round"
      const drawGrassBlade = (bladeCenterX, bladeCenterY, bladeOrientation, bladeSpan, bladeHalfWidth, curveBend, bladeBaseGreen, bladeAlpha) => {
          const bladeTipX = bladeCenterX + Math.cos(bladeOrientation) * bladeSpan,
            bladeTipY = bladeCenterY + Math.sin(bladeOrientation) * bladeSpan,
            perpendicularX = Math.cos(bladeOrientation + Math.PI / 2),
            perpendicularY = Math.sin(bladeOrientation + Math.PI / 2),
            bladeCurveControlX = (bladeCenterX + bladeTipX) / 2 + perpendicularX * curveBend * bladeSpan,
            bladeCurveControlY = (bladeCenterY + bladeTipY) / 2 + perpendicularY * curveBend * bladeSpan,
            LinearGradientValue = drawContext.createLinearGradient(bladeCenterX, bladeCenterY, bladeTipX, bladeTipY),
            bladeRed = Math.round(bladeBaseGreen * 0.55)
          ;(LinearGradientValue.addColorStop(0, `rgba(${bladeRed},${Math.round(bladeRed * 1.06)},${Math.round(bladeRed * 0.95)},${bladeAlpha * 0.5})`),
            LinearGradientValue.addColorStop(1, `rgba(${Math.round(bladeBaseGreen)},${Math.round(Math.min(255, bladeBaseGreen * 1.05))},${Math.round(bladeBaseGreen * 0.78)},${bladeAlpha})`),
            (drawContext.fillStyle = LinearGradientValue),
            drawContext.beginPath(),
            drawContext.moveTo(bladeCenterX - perpendicularX * bladeHalfWidth, bladeCenterY - perpendicularY * bladeHalfWidth),
            drawContext.quadraticCurveTo(bladeCurveControlX - perpendicularX * bladeHalfWidth * 0.6, bladeCurveControlY - perpendicularY * bladeHalfWidth * 0.6, bladeTipX, bladeTipY),
            drawContext.quadraticCurveTo(bladeCurveControlX + perpendicularX * bladeHalfWidth * 0.6, bladeCurveControlY + perpendicularY * bladeHalfWidth * 0.6, bladeCenterX + perpendicularX * bladeHalfWidth, bladeCenterY + perpendicularY * bladeHalfWidth),
            drawContext.closePath(),
            drawContext.fill())
        },
        tuftCount = Math.round(150 * resolutionScale * resolutionScale)
      for (let index = 0; index < tuftCount; index++) {
        const tuftCenterX = grassRandom.range(0, textureResolution),
          tuftCenterY = grassRandom.range(0, textureResolution),
          tuftBaseAngle = -Math.PI / 2 + grassRandom.range(-0.7, 0.7),
          bladesPerTuft = 4 + grassRandom.int(5),
          chanceResult = grassRandom.chance(0.6),
          tuftRadius = grassRandom.range(22, 44) * resolutionScale
        forEachNeighbor(textureResolution, tuftCenterX, tuftCenterY, tuftRadius * 1.3, (shadowCenterX, shadowCenterY) => {
          const RadialGradientValue = drawContext.createRadialGradient(shadowCenterX, shadowCenterY, 0, shadowCenterX, shadowCenterY, tuftRadius * 0.55)
          ;(RadialGradientValue.addColorStop(0, "rgba(46,62,44,0.3)"), RadialGradientValue.addColorStop(1, "rgba(46,62,44,0)"), (drawContext.fillStyle = RadialGradientValue), drawContext.beginPath(), drawContext.arc(shadowCenterX, shadowCenterY, tuftRadius * 0.55, 0, Math.PI * 2), drawContext.fill())
        })
        for (let bladeIndex = 0; bladeIndex < bladesPerTuft; bladeIndex++) {
          const bladeAngle = tuftBaseAngle + ((bladeIndex + 0.5) / bladesPerTuft - 0.5) * 1.5 + grassRandom.range(-0.1, 0.1),
            bladeLength = tuftRadius * grassRandom.range(0.65, 1.1),
            bladeWidth = grassRandom.range(2.2, 3.8) * resolutionScale,
            bladeCurveOffset = grassRandom.range(-0.22, 0.22),
            bladeGreenLevel = chanceResult ? grassRandom.range(165, 215) : grassRandom.range(120, 160),
            bladeOpacity = grassRandom.range(0.4, 0.62)
          forEachNeighbor(textureResolution, tuftCenterX, tuftCenterY, bladeLength + 6, (bladeCenterX, bladeCenterY) => drawGrassBlade(bladeCenterX, bladeCenterY, bladeAngle, bladeLength, bladeWidth, bladeCurveOffset, bladeGreenLevel, bladeOpacity))
        }
      }
      const stemClusterCount = Math.round((textureResolution * textureResolution) / (420 * resolutionScale * resolutionScale))
      for (let clusterIndex = 0; clusterIndex < stemClusterCount; clusterIndex++) {
        const stemClusterX = grassRandom.range(0, textureResolution),
          stemClusterY = grassRandom.range(0, textureResolution),
          stemBaseAngle = -Math.PI / 2 + grassRandom.range(-0.9, 0.9),
          isBrightStem = grassRandom.chance(0.5),
          stemsPerCluster = 3 + grassRandom.int(4)
        for (let stemIndex = 0; stemIndex < stemsPerCluster; stemIndex++) {
          const stemCenterX = stemClusterX + grassRandom.range(-7, 7) * resolutionScale,
            stemCenterY = stemClusterY + grassRandom.range(-5, 5) * resolutionScale,
            stemLength = grassRandom.range(7, 15) * resolutionScale,
            stemAngle = stemBaseAngle + grassRandom.range(-0.45, 0.45),
            stemBaseBrightness = isBrightStem ? grassRandom.range(150, 200) : grassRandom.range(66, 104),
            stemAlpha = grassRandom.range(0.2, 0.42)
          ;((drawContext.strokeStyle = `rgba(${Math.round(stemBaseBrightness * (isBrightStem ? 1 : 0.92))},${Math.round(stemBaseBrightness * 1.04)},${Math.round(stemBaseBrightness * (isBrightStem ? 0.8 : 0.95))},${stemAlpha})`),
            (drawContext.lineWidth = grassRandom.range(1.2, 2.4) * resolutionScale),
            forEachNeighbor(textureResolution, stemCenterX, stemCenterY, stemLength + 4, (stemPointX, stemPointY) => {
              ;(drawContext.beginPath(), drawContext.moveTo(stemPointX, stemPointY), drawContext.lineTo(stemPointX + Math.cos(stemAngle) * stemLength, stemPointY + Math.sin(stemAngle) * stemLength), drawContext.stroke())
            }))
        }
      }
    },
    { repeat: !0, anisotropy: 8 },
  )
}

export { createGrassTexture, fillCanvasWithPattern }
