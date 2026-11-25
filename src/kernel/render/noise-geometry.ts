/**
 * 噪声与几何工具：径向噪声场、星形/多边形路径、程序化几何与 GLSL 片段
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { AddEquation, ClampToEdgeWrapping, CustomBlending, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, OneFactor, OneMinusSrcAlphaFactor, RGBAFormat, UnsignedByteType } from 'three'
import { FastRandom, fbmNoise2D } from './foundation'
import { ATLAS_CELL_SIZE, ATLAS_COLS, ATLAS_ROWS, PARTICLE_KIND, TWO_PI, clamp01, smoothstep } from '../particle-atlas'

function makeRadialNoiseField(noiseSeed) {
  return (sampleX, sampleY, outputColor) => {
    const distance = Math.hypot(sampleX, sampleY),
      coarseNoise = fbmNoise2D(sampleX * 1.7 + 5.3, sampleY * 1.7 + 2.1, 3, noiseSeed) - 0.5,
      fineNoise = fbmNoise2D(sampleX * 4.1 + 1.3, sampleY * 4.1 + 8.7, 2, noiseSeed + 9) - 0.5,
      noiseDistance = distance + coarseNoise * 0.7 + fineNoise * 0.22
    ;((outputColor[0] = smoothstep(0.92, 0.28, noiseDistance) * smoothstep(1, 0.82, distance)), (outputColor[1] = clamp01(0.72 + sampleY * 0.16 + coarseNoise * 0.5 + fineNoise * 0.25)), (outputColor[2] = 0))
  }
}

/**
 * 处理路径。
 *
 * @param builder - 构建器
 * @param pointCount - 次要输入
 * @param outerRadius - 第三输入
 * @param innerRadius - 第四输入
 * @param startAngle - 附加输入
 */
function traceStarPath(builder, pointCount, outerRadius, innerRadius, startAngle = Math.PI / 2) {
  builder.beginPath()
  for (let index = 0; index < pointCount * 2; index++) {
    const vertexAngle = startAngle + (index * Math.PI) / pointCount,
      pointRadius = index % 2 === 0 ? outerRadius : innerRadius
    index === 0 ? builder.moveTo(Math.cos(vertexAngle) * pointRadius, Math.sin(vertexAngle) * pointRadius) : builder.lineTo(Math.cos(vertexAngle) * pointRadius, Math.sin(vertexAngle) * pointRadius)
  }
  builder.closePath()
}

function strokeParticle(strokeContext, baseStrokeWidth, pathCallback) {
  ;((strokeContext.lineCap = "round"), (strokeContext.lineJoin = "round"), (strokeContext.strokeStyle = "rgba(255,255,255,0.28)"), (strokeContext.lineWidth = baseStrokeWidth * 2.6), pathCallback(), strokeContext.stroke(), (strokeContext.strokeStyle = "#fff"), (strokeContext.lineWidth = baseStrokeWidth), pathCallback(), strokeContext.stroke())
}

/**
 * 创建粒子。
 *
 * @param randomSeed - 主要输入
 */
function makeParticlePainter(randomSeed) {
  return (drawContext) => {
    const particleRandom = new FastRandom(randomSeed)
    ;(strokeParticle(drawContext, 0.15, () => {
      ;(drawContext.beginPath(), drawContext.moveTo(0, -0.62), drawContext.lineTo(0, 0.62))
      const spokeCount = 2 + particleRandom.int(2)
      for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex++) {
        const spokeStartY = particleRandom.range(-0.5, 0.5),
          spokeSide = particleRandom.chance(0.5) ? 1 : -1,
          spokeLength = particleRandom.range(0.28, 0.5)
        ;(drawContext.moveTo(0, spokeStartY), drawContext.lineTo(spokeSide * spokeLength, spokeStartY + particleRandom.range(-0.3, 0.3)), particleRandom.chance(0.5) && drawContext.lineTo(spokeSide * spokeLength, spokeStartY + particleRandom.range(-0.45, 0.45)))
      }
      particleRandom.chance(0.7) && (drawContext.moveTo(0.42, 0.5), drawContext.arc(0, 0.5, 0.42, 0, Math.PI * particleRandom.range(0.5, 1)))
    }),
      (drawContext.fillStyle = "#fff"))
    for (let index = 0; index < 2; index++) (drawContext.beginPath(), drawContext.arc(particleRandom.range(-0.5, 0.5), particleRandom.range(-0.6, 0.6), 0.1, 0, TWO_PI), drawContext.fill())
  }
}

const PARTICLE_PIXEL_SHADERS = {
  [PARTICLE_KIND.dot]: {
    pix: (sampleX, sampleY, outputColor) => {
      const distance = Math.hypot(sampleX, sampleY),
        clamp01Result = clamp01(1 - distance)
      ;((outputColor[0] = clamp01Result * clamp01Result), (outputColor[1] = 1), (outputColor[2] = 0))
    },
  },
  [PARTICLE_KIND.glow]: {
    pix: (sampleX, sampleY, outputColor) => {
      const radiusSquared = sampleX * sampleX + sampleY * sampleY,
        glowRadius = Math.sqrt(radiusSquared)
      ;((outputColor[0] = clamp01(Math.exp(-radiusSquared * 4.5) * 0.85 + Math.exp(-radiusSquared * 30) * 0.5) * smoothstep(1, 0.75, glowRadius)), (outputColor[1] = 1), (outputColor[2] = Math.exp(-radiusSquared * 34)))
    },
  },
  [PARTICLE_KIND.spark]: {
    pix: (sampleX, sampleY, outputColor) => {
      const horizontalOffset = Math.abs(sampleX),
        verticalOffset = Math.abs(sampleY),
        horizontalLobe = Math.exp(-sampleY * sampleY * 110) * Math.pow(clamp01(1 - horizontalOffset), 1.8),
        verticalLobe = Math.exp(-sampleX * sampleX * 110) * Math.pow(clamp01(1 - verticalOffset), 1.8),
        diagonalSum = (sampleX + sampleY) * 0.7071,
        diagonalDiff = (sampleX - sampleY) * 0.7071,
        crossGlow = (Math.exp(-diagonalDiff * diagonalDiff * 200) * Math.pow(clamp01(1 - Math.abs(diagonalSum) * 2), 2) + Math.exp(-diagonalSum * diagonalSum * 200) * Math.pow(clamp01(1 - Math.abs(diagonalDiff) * 2), 2)) * 0.7,
        expResult = Math.exp(-(sampleX * sampleX + sampleY * sampleY) * 11)
      ;((outputColor[0] = clamp01(Math.max(horizontalLobe, verticalLobe) + crossGlow + expResult * 0.9)), (outputColor[1] = 1), (outputColor[2] = clamp01(expResult * 1.2 + Math.max(horizontalLobe, verticalLobe) * 0.5)))
    },
  },
  [PARTICLE_KIND.star]: {
    core: 0.25,
    path: /**
 * 处理路径。
 *
 * @param drawContext - 主要输入
 * @param backdropContext - 次要输入
 */
(drawContext, backdropContext) => {
      ;((drawContext.fillStyle = "#fff"), (drawContext.shadowColor = "#fff"), (drawContext.shadowBlur = 5), traceStarPath(drawContext, 5, 0.9, 0.42), drawContext.fill())
      const RadialGradientValue = backdropContext.createRadialGradient(0, 0.1, 0, 0, 0, 0.95)
      ;(RadialGradientValue.addColorStop(0, "#fff"), RadialGradientValue.addColorStop(1, "#b0b0b0"), (backdropContext.fillStyle = RadialGradientValue), backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4))
    },
  },
  [PARTICLE_KIND.smoke]: { pix: makeRadialNoiseField(11) },
  [PARTICLE_KIND.smoke2]: { pix: makeRadialNoiseField(47) },
  [PARTICLE_KIND.streak]: {
    pix: (sampleX, sampleY, outputColor) => {
      const intensityFactor = (sampleX + 1) * 0.5,
        spreadWidth = 0.1 + 0.42 * intensityFactor * intensityFactor,
        streakIntensity = Math.exp(-(sampleY * sampleY) / (spreadWidth * spreadWidth)) * smoothstep(-1, -0.7, sampleX) * smoothstep(1, 0.72, sampleX)
      ;((outputColor[0] = clamp01(streakIntensity * (0.25 + 0.75 * intensityFactor))), (outputColor[1] = 1), (outputColor[2] = clamp01(streakIntensity * intensityFactor * intensityFactor * 0.9)))
    },
  },
  [PARTICLE_KIND.shard]: {
    path: /**
 * 处理路径。
 *
 * @param shapeContext - 主要输入
 * @param backdropContext - 构建器
 */
(shapeContext, backdropContext) => {
      const polygonPoints = [
          [-0.55, -0.5],
          [0.3, -0.75],
          [0.8, -0.1],
          [0.45, 0.62],
          [-0.3, 0.8],
          [-0.82, 0.15],
        ],
        polygonFiller = (shapeContext, vertexIndices) => {
          ;(shapeContext.beginPath(), vertexIndices.forEach((vertexIndex, sequenceIndex) => (sequenceIndex === 0 ? shapeContext.moveTo(polygonPoints[vertexIndex][0], polygonPoints[vertexIndex][1]) : shapeContext.lineTo(polygonPoints[vertexIndex][0], polygonPoints[vertexIndex][1]))), shapeContext.closePath(), shapeContext.fill())
        }
      ;((shapeContext.fillStyle = "#fff"),
        polygonFiller(shapeContext, [0, 1, 2, 3, 4, 5]),
        (backdropContext.fillStyle = "#8c8c8c"),
        backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4),
        (backdropContext.fillStyle = "#ffffff"),
        backdropContext.beginPath(),
        backdropContext.moveTo(-0.3, 0.8),
        backdropContext.lineTo(0.45, 0.62),
        backdropContext.lineTo(0.05, 0.05),
        backdropContext.lineTo(-0.82, 0.15),
        backdropContext.closePath(),
        backdropContext.fill(),
        (backdropContext.fillStyle = "#5a5a5a"),
        backdropContext.beginPath(),
        backdropContext.moveTo(-0.55, -0.5),
        backdropContext.lineTo(0.3, -0.75),
        backdropContext.lineTo(0.05, 0.05),
        backdropContext.closePath(),
        backdropContext.fill())
    },
  },
  [PARTICLE_KIND.feather]: {
    core: 0.15,
    path: /**
 * 处理路径。
 *
 * @param featherContext - 构建器
 * @param backdropContext - 构建器
 */
(featherContext, backdropContext) => {
      ;((featherContext.fillStyle = "#fff"),
        featherContext.beginPath(),
        featherContext.moveTo(0.92, 0),
        featherContext.quadraticCurveTo(0.35, 0.42, -0.5, 0.26),
        featherContext.lineTo(-0.34, 0.08),
        featherContext.lineTo(-0.62, 0.02),
        featherContext.lineTo(-0.36, -0.1),
        featherContext.quadraticCurveTo(-0.2, -0.36, -0.52, -0.24),
        featherContext.quadraticCurveTo(0.35, -0.42, 0.92, 0),
        featherContext.closePath(),
        featherContext.fill(),
        (featherContext.strokeStyle = "#fff"),
        (featherContext.lineWidth = 0.08),
        featherContext.beginPath(),
        featherContext.moveTo(-0.92, 0),
        featherContext.lineTo(0.8, 0),
        featherContext.stroke())
      const LinearGradientValue = backdropContext.createLinearGradient(-1, 0, 1, 0)
      ;(LinearGradientValue.addColorStop(0, "#9a9a9a"), LinearGradientValue.addColorStop(1, "#ffffff"), (backdropContext.fillStyle = LinearGradientValue), backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4), (backdropContext.strokeStyle = "rgba(90,90,90,0.55)"), (backdropContext.lineWidth = 0.025))
      for (let index = -4; index <= 6; index++) {
        const barbOffset = index * 0.13
        ;(backdropContext.beginPath(), backdropContext.moveTo(barbOffset, 0), backdropContext.lineTo(barbOffset - 0.16, 0.4), backdropContext.moveTo(barbOffset, 0), backdropContext.lineTo(barbOffset - 0.16, -0.4), backdropContext.stroke())
      }
      ;((backdropContext.strokeStyle = "#fff"), (backdropContext.lineWidth = 0.04), backdropContext.beginPath(), backdropContext.moveTo(-0.92, 0), backdropContext.lineTo(0.8, 0), backdropContext.stroke())
    },
  },
  [PARTICLE_KIND.rune1]: { core: 0.6, path: makeParticlePainter(3) },
  [PARTICLE_KIND.rune2]: { core: 0.6, path: makeParticlePainter(18) },
  [PARTICLE_KIND.rune3]: { core: 0.6, path: makeParticlePainter(77) },
  [PARTICLE_KIND.ring]: {
    pix: (sampleX, sampleY, outputColor) => {
      const ringRadius = Math.hypot(sampleX, sampleY),
        ringDistance = Math.abs(ringRadius - 0.76)
      ;((outputColor[0] = clamp01(smoothstep(0.12, 0.04, ringDistance) + Math.exp(-ringDistance * ringDistance * 40) * 0.3) * smoothstep(1, 0.93, ringRadius)), (outputColor[1] = 1), (outputColor[2] = smoothstep(0.05, 0, ringDistance) * 0.6))
    },
  },
  [PARTICLE_KIND.flame]: {
    pix: (sampleX, sampleY, outputColor) => {
      const clamp01Clamp01Result = clamp01((sampleY + 0.92) / 1.84),
        flameNoise = (fbmNoise2D(sampleX * 2.2 + 3.1, sampleY * 2.6 + 1.7, 3, 5) - 0.5) * 0.5 * clamp01Clamp01Result,
        flameWidth = 0.6 * Math.sin(Math.PI * Math.pow(clamp01Clamp01Result, 0.55)) * (1 - clamp01Clamp01Result * 0.25) + 0.02,
        flameAxis = Math.abs(sampleX + flameNoise),
        flameIntensity = smoothstep(flameWidth, flameWidth * 0.25, flameAxis) * smoothstep(0, 0.06, clamp01Clamp01Result) * smoothstep(1, 0.9, clamp01Clamp01Result)
      ;((outputColor[0] = flameIntensity), (outputColor[1] = clamp01(0.55 + (1 - clamp01Clamp01Result) * 0.5)), (outputColor[2] = smoothstep(flameWidth * 0.55, 0, flameAxis) * clamp01(1 - clamp01Clamp01Result * 1.5) * flameIntensity))
    },
  },
  [PARTICLE_KIND.leaf]: {
    core: 0.1,
    path: /**
 * 处理路径。
 *
 * @param leafContext - 构建器
 * @param backdropContext - 次要输入
 */
(leafContext, backdropContext) => {
      ;((leafContext.fillStyle = "#fff"), leafContext.beginPath(), leafContext.moveTo(-0.85, -0.1), leafContext.quadraticCurveTo(-0.1, 0.62, 0.88, 0.12), leafContext.quadraticCurveTo(0, -0.18, -0.85, -0.1), leafContext.closePath(), leafContext.fill())
      const createLinearGradientLinearGradientValue = backdropContext.createLinearGradient(0, -0.3, 0, 0.5)
      ;(createLinearGradientLinearGradientValue.addColorStop(0, "#8a8a8a"), createLinearGradientLinearGradientValue.addColorStop(1, "#fff"), (backdropContext.fillStyle = createLinearGradientLinearGradientValue), backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4))
    },
  },
  [PARTICLE_KIND.crescent]: {
    pix: (sampleX, sampleY, outputColor) => {
      const sampleRadius = Math.hypot(sampleX, sampleY),
        offsetRadius = Math.hypot(sampleX - 0.42, sampleY),
        smoothstepResult = smoothstep(0.93, 0.86, sampleRadius),
        offsetFade = smoothstep(0.8, 0.9, offsetRadius),
        crescentIntensity = smoothstepResult * offsetFade
      ;((outputColor[0] = crescentIntensity), (outputColor[1] = 1), (outputColor[2] = crescentIntensity * smoothstep(0.6, 0.9, sampleRadius) * 0.8))
    },
  },
  [PARTICLE_KIND.hex]: {
    core: 0.4,
    path: (drawContext) => {
      ;((drawContext.fillStyle = "rgba(255,255,255,0.16)"), traceStarPath(drawContext, 3, 0.86, 0.86, Math.PI / 2), drawContext.fill(), strokeParticle(drawContext, 0.14, () => traceStarPath(drawContext, 3, 0.78, 0.78, Math.PI / 2)))
    },
  },
  [PARTICLE_KIND.diamond]: {
    pix: (sampleX, sampleY, outputColor) => {
      const edgeDistance = Math.abs(sampleX) / 0.5 + Math.abs(sampleY) / 0.92,
        diamondIntensity = smoothstep(1, 0.9, edgeDistance)
      ;((outputColor[0] = diamondIntensity), (outputColor[1] = sampleX < 0 ? (sampleY > 0 ? 1 : 0.62) : sampleY > 0 ? 0.8 : 0.45), (outputColor[2] = smoothstep(0.5, 0, edgeDistance) * 0.5))
    },
  },
  [PARTICLE_KIND.coin]: {
    path: /**
 * 处理路径。
 *
 * @param coinContext - 构建器
 * @param backdropContext - 构建器
 */
(coinContext, backdropContext) => {
      ;((coinContext.fillStyle = "#fff"),
        coinContext.beginPath(),
        coinContext.arc(0, 0, 0.8, 0, TWO_PI),
        coinContext.fill(),
        (backdropContext.fillStyle = "#c8c8c8"),
        backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4),
        (backdropContext.fillStyle = "#8a8a8a"),
        backdropContext.beginPath(),
        backdropContext.arc(0, 0, 0.6, 0, TWO_PI),
        backdropContext.fill(),
        (backdropContext.fillStyle = "#ffffff"),
        traceStarPath(backdropContext, 4, 0.46, 0.17),
        backdropContext.fill(),
        (backdropContext.strokeStyle = "#fff"),
        (backdropContext.lineWidth = 0.09),
        backdropContext.beginPath(),
        backdropContext.arc(0, 0, 0.7, Math.PI * 0.55, Math.PI * 1),
        backdropContext.stroke())
    },
  },
  [PARTICLE_KIND.plus]: {
    core: 0.5,
    path: /**
 * 处理路径。
 *
 * @param drawContext - 主要输入
 */
(drawContext) => {
      ;((drawContext.fillStyle = "#fff"), (drawContext.shadowColor = "#fff"), (drawContext.shadowBlur = 8))
      const armHalfWidth = 0.22
      ;(drawContext.fillRect(-armHalfWidth, -0.78, armHalfWidth * 2, 1.56), drawContext.fillRect(-0.78, -armHalfWidth, 1.56, armHalfWidth * 2))
    },
  },
  [PARTICLE_KIND.wisp]: {
    pix: (sampleX, sampleY, outputColor) => {
      const waveCenter = 0.34 * Math.sin(sampleY * 2.6 + 0.4),
        verticalFalloff = Math.pow(clamp01(1 - Math.abs(sampleY) / 0.92), 0.8),
        wispWidth = 0.07 + 0.2 * verticalFalloff * (0.6 + 0.4 * fbmNoise2D(sampleY * 2 + 3, 0.5, 2, 21)),
        horizontalDelta = sampleX - waveCenter
      ;((outputColor[0] = clamp01(Math.exp(-(horizontalDelta * horizontalDelta) / (wispWidth * wispWidth)) * verticalFalloff)), (outputColor[1] = clamp01(0.7 + sampleY * 0.25)), (outputColor[2] = 0))
    },
  },
  [PARTICLE_KIND.arrow]: {
    core: 0.5,
    path: /**
 * 处理路径。
 *
 * @param arrowContext - 构建器
 */
(arrowContext) => {
      ;((arrowContext.strokeStyle = "#fff"),
        (arrowContext.fillStyle = "#fff"),
        (arrowContext.lineCap = "round"),
        (arrowContext.lineWidth = 0.17),
        arrowContext.beginPath(),
        arrowContext.moveTo(-0.8, 0),
        arrowContext.lineTo(0.5, 0),
        arrowContext.stroke(),
        arrowContext.beginPath(),
        arrowContext.moveTo(0.94, 0),
        arrowContext.lineTo(0.3, 0.36),
        arrowContext.lineTo(0.46, 0),
        arrowContext.lineTo(0.3, -0.36),
        arrowContext.closePath(),
        arrowContext.fill(),
        (arrowContext.lineWidth = 0.13),
        arrowContext.beginPath())
      for (const shaftX of [-0.72, -0.48]) (arrowContext.moveTo(shaftX, 0), arrowContext.lineTo(shaftX - 0.16, 0.3), arrowContext.moveTo(shaftX, 0), arrowContext.lineTo(shaftX - 0.16, -0.3))
      arrowContext.stroke()
    },
  },
  [PARTICLE_KIND.lock]: {
    core: 0.5,
    path: /**
 * 处理路径。
 *
 * @param lockContext - 构建器
 */
(lockContext) => {
      ;(strokeParticle(lockContext, 0.14, () => {
        lockContext.beginPath()
        for (let arcIndex = 0; arcIndex < 4; arcIndex++) {
          const arcAngle = (arcIndex * Math.PI) / 2 + Math.PI / 4
          ;(lockContext.moveTo(Math.cos(arcAngle - 0.5) * 0.66, Math.sin(arcAngle - 0.5) * 0.66), lockContext.arc(0, 0, 0.66, arcAngle - 0.5, arcAngle + 0.5))
          const spokeAngle = (arcIndex * Math.PI) / 2
          ;(lockContext.moveTo(Math.cos(spokeAngle) * 0.9, Math.sin(spokeAngle) * 0.9), lockContext.lineTo(Math.cos(spokeAngle) * 0.5, Math.sin(spokeAngle) * 0.5))
        }
      }),
        (lockContext.fillStyle = "#fff"),
        lockContext.beginPath(),
        lockContext.arc(0, 0, 0.13, 0, TWO_PI),
        lockContext.fill())
    },
  },
  [PARTICLE_KIND.swirl]: {
    pix: (sampleX, sampleY, outputColor) => {
      const swirlRadius = Math.hypot(sampleX, sampleY),
        swirlPhase = ((((Math.atan2(sampleY, sampleX) / TWO_PI + 0.5) * 2 + swirlRadius * 1.9) % 1) + 1) % 1,
        swirlBand = smoothstep(0.24, 0.02, Math.abs(swirlPhase - 0.5)),
        swirlMask = smoothstep(0.06, 0.3, swirlRadius) * smoothstep(0.96, 0.6, swirlRadius)
      ;((outputColor[0] = clamp01(swirlBand * swirlMask)), (outputColor[1] = 1), (outputColor[2] = clamp01(swirlBand * swirlBand * swirlMask * 0.5)))
    },
  },
  [PARTICLE_KIND.burst]: {
    pix: (sampleX, sampleY, outputColor) => {
      const burstRadius = Math.hypot(sampleX, sampleY),
        rayAngle = Math.atan2(sampleY, sampleX),
        rayWidth = 0.55 + 0.4 * ((((Math.floor(((rayAngle + Math.PI) / TWO_PI) * 12 + 0.5) % 12) * 7919) % 13) / 13),
        rayIntensity = Math.pow(Math.abs(Math.cos(rayAngle * 6)), 26) * smoothstep(rayWidth, rayWidth * 0.2, burstRadius),
        coreGlow = Math.exp(-burstRadius * burstRadius * 14)
      ;((outputColor[0] = clamp01(rayIntensity * 0.9 + coreGlow) * smoothstep(1, 0.9, burstRadius)), (outputColor[1] = 1), (outputColor[2] = clamp01(coreGlow * 1.1 + rayIntensity * 0.3)))
    },
  },
  [PARTICLE_KIND.bubble]: {
    pix: (sampleX, sampleY, outputColor) => {
      const bubbleRadius = Math.hypot(sampleX, sampleY),
        bubbleRim = smoothstep(0.11, 0.02, Math.abs(bubbleRadius - 0.78)),
        outerGlow = smoothstep(0.82, 0.3, bubbleRadius) * 0.12,
        bubbleGlint = Math.exp(-((sampleX + 0.38) * (sampleX + 0.38) + (sampleY - 0.42) * (sampleY - 0.42)) * 28) * 0.9
      ;((outputColor[0] = clamp01(bubbleRim * 0.85 + outerGlow + bubbleGlint) * smoothstep(1, 0.9, bubbleRadius)), (outputColor[1] = 1), (outputColor[2] = bubbleGlint))
    },
  },
  [PARTICLE_KIND.chevron]: {
    core: 0.5,
    path: /**
 * 处理路径。
 *
 * @param drawContext - 构建器
 */
(drawContext) => {
      strokeParticle(drawContext, 0.22, () => {
        ;(drawContext.beginPath(), drawContext.moveTo(-0.4, 0.62), drawContext.lineTo(0.42, 0), drawContext.lineTo(-0.4, -0.62))
      })
    },
  },
  [PARTICLE_KIND.ember]: {
    pix: (sampleX, sampleY, outputColor) => {
      const emberRadius = Math.hypot(sampleX, sampleY),
        emberNoise = fbmNoise2D(sampleX * 2.4 + 9.1, sampleY * 2.4 + 4.4, 2, 31) - 0.5,
        emberIntensity = smoothstep(0.8, 0.25, emberRadius + emberNoise * 0.6)
      ;((outputColor[0] = emberIntensity), (outputColor[1] = 1), (outputColor[2] = smoothstep(0.45, 0, emberRadius + emberNoise * 0.4)))
    },
  },
  [PARTICLE_KIND.frost]: {
    core: 0.5,
    path: /**
 * 处理路径。
 *
 * @param frostContext - 构建器
 */
(frostContext) => {
      strokeParticle(frostContext, 0.11, () => {
        frostContext.beginPath()
        for (let spokeIndex = 0; spokeIndex < 6; spokeIndex++) {
          const spokeAngle = (spokeIndex * Math.PI) / 3,
            spokeDirX = Math.cos(spokeAngle),
            spokeDirY = Math.sin(spokeAngle)
          ;(frostContext.moveTo(0, 0), frostContext.lineTo(spokeDirX * 0.84, spokeDirY * 0.84))
          for (const branchLength of [0.46, 0.66])
            for (const branchSide of [-1, 1]) {
              const branchAngle = spokeAngle + branchSide * 0.9
              ;(frostContext.moveTo(spokeDirX * branchLength, spokeDirY * branchLength), frostContext.lineTo(spokeDirX * branchLength + Math.cos(branchAngle) * 0.2, spokeDirY * branchLength + Math.sin(branchAngle) * 0.2))
            }
        }
      })
    },
  },
  [PARTICLE_KIND.bolt]: {
    core: 0.6,
    path: /**
 * 处理路径。
 *
 * @param drawContext - 构建器
 */
(drawContext) => {
      strokeParticle(drawContext, 0.17, () => {
        ;(drawContext.beginPath(), drawContext.moveTo(0.3, 0.86), drawContext.lineTo(-0.3, 0.12), drawContext.lineTo(0.18, 0.02), drawContext.lineTo(-0.34, -0.86))
      })
    },
  },
  [PARTICLE_KIND.drop]: {
    pix: (sampleX, sampleY, outputColor) => {
      const verticalLevel = clamp01((sampleY + 0.85) / 1.7),
        dropWidth = 0.52 * Math.sqrt(clamp01(1 - verticalLevel)) * smoothstep(0, 0.22, verticalLevel) + 0.01,
        dropIntensity = smoothstep(dropWidth, dropWidth * 0.6, Math.abs(sampleX)) * smoothstep(1, 0.92, verticalLevel)
      ;((outputColor[0] = dropIntensity), (outputColor[1] = clamp01(0.7 + (sampleX < 0 ? 0.3 : 0) * smoothstep(0.3, 0.1, verticalLevel))), (outputColor[2] = Math.exp(-((sampleX + 0.14) * (sampleX + 0.14) + (sampleY + 0.4) * (sampleY + 0.4)) * 40) * 0.8))
    },
  },
  [PARTICLE_KIND.soft]: {
    pix: (sampleX, sampleY, outputColor) => {
      const radiusSquared = sampleX * sampleX + sampleY * sampleY
      ;((outputColor[0] = Math.exp(-radiusSquared * 3.2) * smoothstep(1, 0.7, Math.sqrt(radiusSquared))), (outputColor[1] = 1), (outputColor[2] = 0))
    },
  },
  [PARTICLE_KIND.goose]: {
    core: 0.22,
    path: /**
 * 处理路径。
 *
 * @param gooseContext - 构建器
 * @param backdropContext - 构建器
 */
(gooseContext, backdropContext) => {
      gooseContext.fillStyle = "#fff"
      for (const wingSide of [1, -1])
        (gooseContext.beginPath(),
          gooseContext.moveTo(0.2, 0.1 * wingSide),
          gooseContext.quadraticCurveTo(0.34, 0.36 * wingSide, 0.2, 0.56 * wingSide),
          gooseContext.quadraticCurveTo(0.08, 0.8 * wingSide, -0.26, 0.95 * wingSide),
          gooseContext.quadraticCurveTo(-0.1, 0.72 * wingSide, -0.16, 0.56 * wingSide),
          gooseContext.quadraticCurveTo(-0.26, 0.4 * wingSide, -0.2, 0.3 * wingSide),
          gooseContext.quadraticCurveTo(-0.3, 0.22 * wingSide, -0.28, 0.1 * wingSide),
          gooseContext.closePath(),
          gooseContext.fill())
      ;(gooseContext.beginPath(),
        gooseContext.ellipse(-0.06, 0, 0.36, 0.15, 0, 0, TWO_PI),
        gooseContext.fill(),
        gooseContext.beginPath(),
        gooseContext.moveTo(-0.32, 0.1),
        gooseContext.lineTo(-0.62, 0.11),
        gooseContext.lineTo(-0.56, 0),
        gooseContext.lineTo(-0.62, -0.11),
        gooseContext.lineTo(-0.32, -0.1),
        gooseContext.closePath(),
        gooseContext.fill(),
        gooseContext.beginPath(),
        gooseContext.moveTo(0.24, 0.1),
        gooseContext.quadraticCurveTo(0.5, 0.045, 0.78, 0.04),
        gooseContext.quadraticCurveTo(0.87, 0.085, 0.92, 0.03),
        gooseContext.lineTo(0.98, 0),
        gooseContext.lineTo(0.92, -0.03),
        gooseContext.quadraticCurveTo(0.87, -0.085, 0.78, -0.04),
        gooseContext.quadraticCurveTo(0.5, -0.045, 0.24, -0.1),
        gooseContext.closePath(),
        gooseContext.fill())
      const createRadialGradientRadialGradientValue = backdropContext.createRadialGradient(0, 0, 0.1, 0, 0, 1)
      ;(createRadialGradientRadialGradientValue.addColorStop(0, "#ffffff"), createRadialGradientRadialGradientValue.addColorStop(0.5, "#e8e8e8"), createRadialGradientRadialGradientValue.addColorStop(1, "#808080"), (backdropContext.fillStyle = createRadialGradientRadialGradientValue), backdropContext.fillRect(-1.2, -1.2, 2.4, 2.4), (backdropContext.lineCap = "round"))
      for (const eyeSide of [1, -1]) {
        ;((backdropContext.strokeStyle = "rgba(60,60,60,0.55)"),
          (backdropContext.lineWidth = 0.035),
          backdropContext.beginPath(),
          backdropContext.moveTo(0.2, 0.16 * eyeSide),
          backdropContext.quadraticCurveTo(-0.05, 0.2 * eyeSide, -0.28, 0.14 * eyeSide),
          backdropContext.stroke(),
          (backdropContext.strokeStyle = "rgba(70,70,70,0.5)"),
          (backdropContext.lineWidth = 0.022))
        for (let detailIndex = 0; detailIndex < 4; detailIndex++) {
          const detailRatio = detailIndex / 3
          ;(backdropContext.beginPath(), backdropContext.moveTo(0.08 - detailRatio * 0.12, (0.42 + detailRatio * 0.2) * eyeSide), backdropContext.lineTo(-0.18 - detailRatio * 0.06, (0.44 + detailRatio * 0.4) * eyeSide), backdropContext.stroke())
        }
      }
    },
  },
  [PARTICLE_KIND.wave]: {
    pix: (sampleX, sampleY, outputColor) => {
      const waveProbe = (target, waveDistance, waveSpread, grassD) => {
          const waveOffsetX = sampleX - target,
            atan2Atan2Result = Math.atan2(sampleY, waveOffsetX)
          if (Math.abs(atan2Atan2Result) >= waveSpread) return 0
          const angularFalloff = Math.pow(Math.cos((atan2Atan2Result / waveSpread) * Math.PI * 0.5), 0.7),
            distance = Math.abs(Math.hypot(waveOffsetX, sampleY) - waveDistance) / (grassD * angularFalloff + 1e-4)
          return smoothstep(1, 0.45, distance) * angularFalloff
        },
        sResult = waveProbe(-0.55, 1.36, 0.66, 0.09),
        sSResult = waveProbe(-0.62, 1.06, 0.5, 0.06)
      ;((outputColor[0] = clamp01(sResult + sSResult * 0.55)), (outputColor[1] = 1), (outputColor[2] = clamp01(sResult * sResult * 0.7)))
    },
  },
  [PARTICLE_KIND.ink]: {
    pix: (sampleX, sampleY, outputColor) => {
      const inkRadius = Math.hypot(sampleX, sampleY),
        inkAngle = Math.atan2(sampleY, sampleX),
        inkNoise = fbmNoise2D(sampleX * 2.3 + 1.7, sampleY * 2.3 + 5.1, 3, 61) - 0.5
      let total = 0.4 + inkNoise * 0.26 + 0.05 * Math.sin(inkAngle * 5 + 1.3),
        inkIntensity = 0
      for (let index = 0; index < 5; index++) {
        const lobeAngle = (index / 5) * TWO_PI + Math.sin(index * 5.3) * 0.4 + 0.3,
          lobeWeight = 0.14 + 0.26 * (0.5 + 0.5 * Math.sin(index * 3.1 + 1))
        let angleDelta = inkAngle - lobeAngle
        ;((angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta))), (total += lobeWeight * Math.exp(-angleDelta * angleDelta * 34)))
        const lobeRadius = 0.52 + lobeWeight * 0.95,
          lobeWidth = 0.045 + 0.03 * Math.sin(index * 2.7 + 0.5)
        inkIntensity = Math.max(inkIntensity, smoothstep(lobeWidth, lobeWidth * 0.6, Math.hypot(sampleX - Math.cos(lobeAngle) * lobeRadius, sampleY - Math.sin(lobeAngle) * lobeRadius)))
      }
      inkIntensity = Math.max(inkIntensity, smoothstep(total, total - 0.08, inkRadius))
      for (let lobeIndex = 0; lobeIndex < 8; lobeIndex++) {
        const speckAngle = (lobeIndex / 8) * TWO_PI + Math.sin(lobeIndex * 7.7) * 0.3 + 0.9,
          speckRadius = 0.7 + 0.18 * Math.sin(lobeIndex * 4.3 + 2),
          speckWidth = 0.025 + 0.035 * (0.5 + 0.5 * Math.sin(lobeIndex * 6.1))
        inkIntensity = Math.max(inkIntensity, smoothstep(speckWidth, speckWidth * 0.6, Math.hypot(sampleX - Math.cos(speckAngle) * speckRadius, sampleY - Math.sin(speckAngle) * speckRadius)))
      }
      ;((outputColor[0] = inkIntensity * smoothstep(1, 0.94, inkRadius)), (outputColor[1] = clamp01(0.78 + inkNoise * 0.5)), (outputColor[2] = 0))
    },
  },
  [PARTICLE_KIND.scale]: {
    pix: (sampleX, sampleY, outputColor) => {
      const scaleLevel = (sampleX + 1) * 0.5,
        scaleWidth = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, scaleLevel * 1.08)), 0.75) * (1 - 0.3 * scaleLevel) + 0.001,
        scaleRatio = Math.abs(sampleY) / scaleWidth,
        scaleIntensity = smoothstep(1, 0.86, scaleRatio) * smoothstep(-0.98, -0.9, sampleX) * smoothstep(0.99, 0.9, sampleX)
      ;((outputColor[0] = scaleIntensity), (outputColor[1] = clamp01(0.55 + 0.45 * (1 - scaleRatio) - 0.12 * scaleLevel + 0.25 * smoothstep(0.8, 0.95, scaleRatio))), (outputColor[2] = clamp01(Math.exp(-scaleRatio * scaleRatio * 30) * smoothstep(-0.6, 0.2, sampleX) * 0.55 + smoothstep(0.82, 0.95, scaleRatio) * scaleIntensity * 0.3)))
    },
  },
  [PARTICLE_KIND.puff]: {
    pix: (sampleX, sampleY, outputColor) => {
      const puffRadius = Math.hypot(sampleX, sampleY),
        puffNoise = fbmNoise2D(sampleX * 2.1 + 3.1, sampleY * 2.1 + 7.7, 3, 91) - 0.5,
        puffDetail = fbmNoise2D(sampleX * 5.3 + 1.9, sampleY * 5.3 + 4.4, 2, 23) - 0.5,
        puffShape = puffRadius + puffNoise * 0.8 + puffDetail * 0.3,
        puffAngle = Math.atan2(sampleY, sampleX),
        puffVariation = 0.5 + 0.5 * Math.sin(puffAngle * 2 + puffRadius * 9 + puffNoise * 6)
      ;((outputColor[0] = smoothstep(0.95, 0.25, puffShape) * smoothstep(1, 0.85, puffRadius)), (outputColor[1] = clamp01(0.62 + sampleY * 0.12 + puffVariation * 0.3 + puffDetail * 0.3)), (outputColor[2] = clamp01(Math.exp(-puffRadius * puffRadius * 9) * 0.35)))
    },
  },
  [PARTICLE_KIND.broadleaf]: {
    pix: (sampleX, sampleY, outputColor) => {
      const leafLevel = (sampleX + 0.82) / 1.74,
        leafWidth = 0.46 * Math.pow(clamp01(Math.sin(Math.PI * clamp01(leafLevel))), 0.85) * (1 + 0.15 * (0.5 - Math.abs(leafLevel - 0.55))) + 0.001,
        leafBody = smoothstep(1, 0.9, Math.abs(sampleY) / leafWidth) * smoothstep(-0.86, -0.8, sampleX) * smoothstep(0.95, 0.9, sampleX),
        leafSeam = Math.exp(-sampleY * sampleY * 900) * smoothstep(-0.98, -0.92, sampleX) * smoothstep(-0.74, -0.8, sampleX),
        veinGlow = Math.exp(-sampleY * sampleY * 600),
        veinPhase = Math.abs(((((sampleX * 2.6 - Math.abs(sampleY) * 2.2) % 1) + 1) % 1) - 0.5),
        veinLines = smoothstep(0.06, 0, veinPhase) * smoothstep(0.95, 0.4, Math.abs(sampleY) / leafWidth)
      ;((outputColor[0] = clamp01(Math.max(leafBody, leafSeam))), (outputColor[1] = clamp01(0.82 + 0.18 * (sampleY > 0 ? 1 : 0.6) - veinGlow * 0.35 - veinLines * 0.22 - (1 - Math.abs(sampleY) / leafWidth) * 0.05)), (outputColor[2] = 0))
    },
  },
  [PARTICLE_KIND.splash]: {
    pix: (sampleX, sampleY, outputColor) => {
      const splashRadius = Math.hypot(sampleX, sampleY),
        splashAngle = Math.atan2(sampleY, sampleX),
        splashVariation = 0.5 + 0.5 * Math.sin(splashAngle * 7 + 1.3) * Math.sin(splashAngle * 3 - 0.4),
        splashCore = Math.exp(-((splashRadius - 0.62) * (splashRadius - 0.62)) * 600) * smoothstep(0.2, 0.55, splashVariation)
      let dropletPeak = 0,
        dropletGlow = 0
      for (let dropletIndex = 0; dropletIndex < 15; dropletIndex++) {
        const dropletAngle = (dropletIndex / 15) * TWO_PI + Math.sin(dropletIndex * 7.31) * 0.18,
          dropletRadius = 0.76 + 0.12 * Math.sin(dropletIndex * 3.7 + 0.5),
          dropletWidth = 0.055 + 0.04 * (0.5 + 0.5 * Math.sin(dropletIndex * 5.13)),
          offsetX = sampleX - Math.cos(dropletAngle) * dropletRadius,
          offsetY = sampleY - Math.sin(dropletAngle) * dropletRadius,
          dropletRatio = Math.hypot(offsetX, offsetY) / dropletWidth
        ;((dropletPeak = Math.max(dropletPeak, smoothstep(1, 0.75, dropletRatio))), (dropletGlow = Math.max(dropletGlow, Math.exp((-(offsetX + dropletWidth * 0.3) * (offsetX + dropletWidth * 0.3)) / (dropletWidth * dropletWidth * 0.08) - ((offsetY - dropletWidth * 0.3) * (offsetY - dropletWidth * 0.3)) / (dropletWidth * dropletWidth * 0.08)))))
      }
      ;((outputColor[0] = clamp01(Math.max(splashCore * 0.75, dropletPeak))), (outputColor[1] = clamp01(0.8 + 0.2 * (sampleY > 0 ? 1 : 0.7))), (outputColor[2] = clamp01(dropletGlow * 0.8 + splashCore * 0.2)))
    },
  },
  [PARTICLE_KIND.star8]: {
    pix: (sampleX, sampleY, outputColor) => {
      const starRadius = Math.hypot(sampleX, sampleY)
      let starIntensity = 0
      for (let starSpikeIndex = 0; starSpikeIndex < 8; starSpikeIndex++) {
        const spikeAngle = (starSpikeIndex * Math.PI) / 4 + Math.PI / 2,
          spikeReach = starSpikeIndex % 2 === 0 ? 0.96 : 0.56,
          spikeDirX = Math.cos(spikeAngle),
          spikeDirY = Math.sin(spikeAngle),
          projectedLength = sampleX * spikeDirX + sampleY * spikeDirY
        if (projectedLength <= 0) continue
        const lateralOffset = Math.abs(-sampleX * spikeDirY + sampleY * spikeDirX),
          spikeWidth = 0.16 * clamp01(1 - projectedLength / spikeReach) + 0.004
        starIntensity = Math.max(starIntensity, smoothstep(spikeWidth, spikeWidth * 0.35, lateralOffset) * smoothstep(spikeReach, spikeReach * 0.9, projectedLength))
      }
      const starCore = Math.exp(-starRadius * starRadius * 26)
      ;((outputColor[0] = clamp01(starIntensity + starCore * 0.85)), (outputColor[1] = 1), (outputColor[2] = clamp01(starCore * 1.1 + starIntensity * 0.35 * smoothstep(0.5, 0, starRadius))))
    },
  },
}

/**
 * 创建粒子。
 *
 */
function buildParticleAtlas() {
  const atlasWidth = ATLAS_COLS * ATLAS_CELL_SIZE,
    atlasHeight = ATLAS_ROWS * ATLAS_CELL_SIZE,
    element = (backgroundFill): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const element = document.createElement("canvas")
      ;((element.width = atlasWidth), (element.height = atlasHeight))
      const ContextValue = element.getContext("2d", { willReadFrequently: !0 })
      if (!ContextValue) throw new Error("2D canvas 不可用")
      return ((ContextValue.fillStyle = backgroundFill), ContextValue.fillRect(0, 0, atlasWidth, atlasHeight), [element, ContextValue])
    },
    [, maskContext] = element("#000"),
    [, glowContext] = element("#fff"),
    uint8Array = new Uint8Array(atlasWidth * atlasHeight * 4),
    float32Array = new Float32Array(ATLAS_COLS * ATLAS_ROWS),
    pixelShaderIndices = [],
    cellScale = (ATLAS_CELL_SIZE / 2) * 0.86
  for (let index = 0; index < ATLAS_COLS * ATLAS_ROWS; index++) {
    const selectedPARTICLE_PIXEL_SHADERS = PARTICLE_PIXEL_SHADERS[index]
    if (!selectedPARTICLE_PIXEL_SHADERS) continue
    const cellOriginX = (index % ATLAS_COLS) * ATLAS_CELL_SIZE,
      cellOriginY = Math.floor(index / ATLAS_COLS) * ATLAS_CELL_SIZE
    if (selectedPARTICLE_PIXEL_SHADERS.path) {
      for (const fxBuilder of [maskContext, glowContext]) (fxBuilder.save(), fxBuilder.beginPath(), fxBuilder.rect(cellOriginX, cellOriginY, ATLAS_CELL_SIZE, ATLAS_CELL_SIZE), fxBuilder.clip(), fxBuilder.setTransform(cellScale, 0, 0, -cellScale, cellOriginX + ATLAS_CELL_SIZE / 2, cellOriginY + ATLAS_CELL_SIZE / 2))
      ;(selectedPARTICLE_PIXEL_SHADERS.path(maskContext, glowContext), maskContext.restore(), glowContext.restore(), (float32Array[index] = selectedPARTICLE_PIXEL_SHADERS.core ?? 0))
    } else selectedPARTICLE_PIXEL_SHADERS.pix && pixelShaderIndices.push(index)
  }
  const maskPixels = maskContext.getImageData(0, 0, atlasWidth, atlasHeight).data,
    glowPixels = glowContext.getImageData(0, 0, atlasWidth, atlasHeight).data
  for (let pixelY = 0; pixelY < atlasHeight; pixelY++)
    for (let pixelX = 0; pixelX < atlasWidth; pixelX++) {
      const pixelOffset = (pixelY * atlasWidth + pixelX) * 4,
        particleKindIndex = Math.floor(pixelY / ATLAS_CELL_SIZE) * ATLAS_COLS + Math.floor(pixelX / ATLAS_CELL_SIZE),
        selectedC = maskPixels[pixelOffset]
      ;((uint8Array[pixelOffset] = selectedC), (uint8Array[pixelOffset + 1] = glowPixels[pixelOffset]), (uint8Array[pixelOffset + 2] = Math.min(255, ((selectedC * selectedC) / 255) * float32Array[particleKindIndex])), (uint8Array[pixelOffset + 3] = 255))
    }
  const shaderOutput = new Float32Array(3)
  for (const shaderIndex of pixelShaderIndices) {
    const pixelShader = PARTICLE_PIXEL_SHADERS[shaderIndex].pix,
      shaderOriginX = (shaderIndex % ATLAS_COLS) * ATLAS_CELL_SIZE,
      shaderOriginY = Math.floor(shaderIndex / ATLAS_COLS) * ATLAS_CELL_SIZE
    for (let pixelRow = 0; pixelRow < ATLAS_CELL_SIZE; pixelRow++)
      for (let pixelCol = 0; pixelCol < ATLAS_CELL_SIZE; pixelCol++) {
        const shaderSampleX = (pixelCol + 0.5 - ATLAS_CELL_SIZE / 2) / cellScale,
          shaderSampleY = -(pixelRow + 0.5 - ATLAS_CELL_SIZE / 2) / cellScale,
          shaderPixelOffset = ((shaderOriginY + pixelRow) * atlasWidth + shaderOriginX + pixelCol) * 4
        if (Math.abs(shaderSampleX) >= 1 || Math.abs(shaderSampleY) >= 1) {
          ;((uint8Array[shaderPixelOffset] = 0), (uint8Array[shaderPixelOffset + 1] = 255), (uint8Array[shaderPixelOffset + 2] = 0), (uint8Array[shaderPixelOffset + 3] = 255))
          continue
        }
        ;(pixelShader(shaderSampleX, shaderSampleY, shaderOutput), (uint8Array[shaderPixelOffset] = clamp01(shaderOutput[0]) * 255), (uint8Array[shaderPixelOffset + 1] = clamp01(shaderOutput[1]) * 255), (uint8Array[shaderPixelOffset + 2] = clamp01(shaderOutput[2]) * 255), (uint8Array[shaderPixelOffset + 3] = 255))
      }
  }
  const atlasTexture = new DataTexture(uint8Array, atlasWidth, atlasHeight, RGBAFormat, UnsignedByteType)
  return ((atlasTexture.colorSpace = NoColorSpace), (atlasTexture.wrapS = atlasTexture.wrapT = ClampToEdgeWrapping), (atlasTexture.generateMipmaps = !0), (atlasTexture.minFilter = LinearMipmapLinearFilter), (atlasTexture.magFilter = LinearFilter), (atlasTexture.anisotropy = 2), (atlasTexture.needsUpdate = !0), (atlasTexture.name = "fx.atlas"), atlasTexture)
}

const PARTICLE_TONEMAP_GLSL = `
  #ifdef TONE_MAPPING
  // 遮挡部分(权重 1 - fxAdd)与叠加部分(权重 fxAdd)分别映射再合成。两部分不能先混色再统一乘系数：
  // 半叠加的粒子(0 < fxAdd < 1)那样算，覆盖率趋近 0 的外圈也会带着半份亮度，叠出一块边缘生硬的死白。
  gl_FragColor = vec4(fxC, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 fxOver = gl_FragColor.rgb * (fxA * (1.0 - fxAdd));
  gl_FragColor = vec4(kitAdditive(fxC * (fxA * fxAdd)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(fxOver + gl_FragColor.rgb, fxA * (1.0 - fxAdd));
  #else
  // HDR 路径的软上限(§7.1)：亮度 2.0 以下原样，以上平滑压向 3.2——只有小核心能明显越过 bloom 阈值 1.35，
  // 几层亮光叠在同一处也不会冲成一大团白
  float fxM = max(fxC.r, max(fxC.g, fxC.b));
  if (fxM > 2.0) fxC *= (2.0 + (fxM - 2.0) / (1.0 + (fxM - 2.0) / 1.2)) / fxM;
  gl_FragColor = vec4(fxC * fxA, fxA * (1.0 - fxAdd));
  #endif
`

/**
 * 处理粒子。
 *
 * @param particleMaterial - 主要输入
 */
function configureParticleMaterial(particleMaterial) {
  ;((particleMaterial.transparent = !0),
    (particleMaterial.depthWrite = !1),
    (particleMaterial.blending = CustomBlending),
    (particleMaterial.blendEquation = AddEquation),
    (particleMaterial.blendSrc = OneFactor),
    (particleMaterial.blendDst = OneMinusSrcAlphaFactor),
    (particleMaterial.blendSrcAlpha = OneFactor),
    (particleMaterial.blendDstAlpha = OneMinusSrcAlphaFactor),
    (particleMaterial.premultipliedAlpha = !0))
}

export { configureParticleMaterial, buildParticleAtlas, PARTICLE_TONEMAP_GLSL }