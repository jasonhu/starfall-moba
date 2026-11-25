/**
 * 英雄程序化模型构造器（models.ts 拆分）
 * 由 tools/split-models.cjs 从 models.ts 物理拆分，声明文本逐字节保留。
 */

import { buildSkeleton } from './skeleton'
import { DEG2RAD, RIG_PROPORTIONS, UNIT_CAPSULE, UNIT_PALETTE } from './unit-model-config'
import { COSTUME_PALETTE, BODY_ANCHOR_HEIGHTS, lerpNumeric, YEQUE_RIG_PROPORTIONS, sampleColorGradient, MATERIAL_KINDS, RIBBON_WIDTH_PROFILE, ModelBuilder, XINGLI_RIG_PROPORTIONS, emitFurTufts, RANGER_PALETTE, ROBE_COSTUME_PALETTE, FENGLING_RIG_PROPORTIONS, FENGLING_BOW_SPEC, YEQUE_ARM_SPAN_SCALE, TERRAIN_LOOK, WARRIOR_PALETTE, clampUnit, emitTaperedTube, emitConeSkirt, lerpValue, composeMatrix, clampUnitInput, FURL_ROW_COUNT, WARRIOR_PROPORTIONS, XIANGYU_PALETTE_ALIAS, FENGLING_DEG_TO_RAD, YEQUE_DEG_TO_RAD, MODEL_ANGLE_TO_RAD } from './starfall.core'

function makeTorsoColorBinder(rig) {
  const jointSpec = rig.J,
    durationValue = rig.d,
    entries = [
      [durationValue.pelvisY + 0.02, jointSpec.hips],
      [durationValue.spineY + 0.04, jointSpec.spine],
      [durationValue.chestY + 0.02, jointSpec.chest],
    ]
  return (primary, secondary) => {
    if (secondary <= entries[0][0]) return [jointSpec.hips, jointSpec.hips, 1]
    for (let index = 1; index < entries.length; index++)
      if (secondary <= entries[index][0]) {
        const deltaX = (secondary - entries[index - 1][0]) / (entries[index][0] - entries[index - 1][0])
        return [entries[index - 1][1], entries[index][1], 1 - deltaX]
      }
    return [jointSpec.chest, jointSpec.chest, 1]
  }
}

function makeChainColorBinder(entries, samples, coordZ = -1) {
  const count = entries.length
  return (coordX, coordY, coordZ) => {
    let computed = 0,
      computedX = 0,
      ratio = 1 / 0
    for (let sampleIndex = 0; sampleIndex < count; sampleIndex++) {
      const element = samples[sampleIndex],
        elementX = samples[sampleIndex + 1],
        deltaXX = elementX[0] - element[0],
        deltaY = elementX[1] - element[1],
        deltaZ = elementX[2] - element[2],
        sum = deltaXX * deltaXX + deltaY * deltaY + deltaZ * deltaZ || 1e-6,
        deltaXY = ((coordX - element[0]) * deltaXX + (coordY - element[1]) * deltaY + (coordZ - element[2]) * deltaZ) / sum,
        clamped = clampUnit(deltaXY),
        sumX = element[0] + deltaXX * clamped - coordX,
        sumY = element[1] + deltaY * clamped - coordY,
        sumZ = element[2] + deltaZ * clamped - coordZ,
        sumWidth = sumX * sumX + sumY * sumY + sumZ * sumZ + (deltaXY < 0 || deltaXY > 1 ? 1e-4 : 0)
      sumWidth < ratio && ((ratio = sumWidth), (computed = sampleIndex), (computedX = clamped))
    }
    return computedX >= 0.5 ? (computed === count - 1 ? [entries[computed], entries[computed], 1] : [entries[computed], entries[computed + 1], 1 - (computedX - 0.5)]) : computed === 0 ? (coordZ < 0 ? [entries[0], entries[0], 1] : [entries[0], coordZ, 0.5 + computedX]) : [entries[computed], entries[computed - 1], 0.5 + computedX]
  }
}

function emitGradientRibbon(builder, entries, ribbonSpec) {
  const samples = ribbonSpec.axis ?? [1, 0, 0],
    samplesX = ribbonSpec.bow ?? [0, 0, 0],
    element = entries[entries.length - 1],
    elementX = entries[entries.length - 2]
  let deltaX = element[0] - elementX[0],
    deltaY = element[1] - elementX[1],
    deltaZ = element[2] - elementX[2]
  const distance = Math.hypot(deltaX, deltaY, deltaZ) || 1
  ;((deltaX /= distance), (deltaY /= distance), (deltaZ /= distance))
  const computed = ribbonSpec.tailLen ?? 0.12
  builder.sheet(ribbonSpec.nu ?? 4, ribbonSpec.nv ?? 8, (primaryX, secondaryX) => {
    const sampleColorGradientResult = sampleColorGradient(entries, secondaryX),
      delta = (primaryX - 0.5) * 2,
      widthResult = ribbonSpec.width(secondaryX),
      deltaWidth = 1 - delta * delta,
      sumHeight = (ribbonSpec.wave ?? 0) * Math.sin(secondaryX * 9 + delta * 1.7)
    let computedY = 0
    if (secondaryX > 0.8 && ribbonSpec.tail && ribbonSpec.tail !== "flat") {
      const deltaHeight = (secondaryX - 0.8) / 0.2
      computedY = ribbonSpec.tail === "swallow" ? -deltaHeight * (1 - Math.abs(delta)) * computed : -deltaHeight * Math.abs(delta) * computed
    }
    return [sampleColorGradientResult[0] + samples[0] * delta * widthResult + samplesX[0] * (deltaWidth + sumHeight) + deltaX * computedY, sampleColorGradientResult[1] + samples[1] * delta * widthResult + samplesX[1] * (deltaWidth + sumHeight) + deltaY * computedY, sampleColorGradientResult[2] + samples[2] * delta * widthResult + samplesX[2] * (deltaWidth + sumHeight) + deltaZ * computedY]
  })
}

function buildHeadSurface(builder, rig, coordZ, headScale = 1, centerOffsetFactor = 0.25, verticalStretch = 1) {
  const sum = rig.d.headY + centerOffsetFactor * headScale,
    headCrossSections = RIBBON_WIDTH_PROFILE.map((samples) => {
      const stretchBlend = clampUnit(-samples[0] / 0.17),
        sectionStretch = 1 + (verticalStretch - 1) * stretchBlend * stretchBlend * (3 - 2 * stretchBlend)
      return [samples[0], samples[1] * sectionStretch, samples[2] * (1 + (sectionStretch - 1) * 0.6), samples[3]]
    })
  ;(builder.bone(rig.J.head).paint(coordZ, { ao: 0.82, ao2: 1, glow: 0.07, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      headCrossSections.map((samplesX) => [sum + samplesX[0] * headScale, samplesX[1] * headScale, samplesX[2] * headScale, 0, samplesX[3] * headScale]),
      { seg: 14, crease: 180 },
    ))
  const headRingAt = (heroId) => {
    const ratio = heroId / headScale
    if (ratio <= headCrossSections[0][0]) return [headCrossSections[0][1] * headScale, headCrossSections[0][2] * headScale, headCrossSections[0][3] * headScale]
    for (let index = 1; index < headCrossSections.length; index++)
      if (ratio <= headCrossSections[index][0]) {
        const deltaX = (ratio - headCrossSections[index - 1][0]) / (headCrossSections[index][0] - headCrossSections[index - 1][0])
        return [lerpValue(headCrossSections[index - 1][1], headCrossSections[index][1], deltaX) * headScale, lerpValue(headCrossSections[index - 1][2], headCrossSections[index][2], deltaX) * headScale, lerpValue(headCrossSections[index - 1][3], headCrossSections[index][3], deltaX) * headScale]
      }
    const selectedR = headCrossSections[headCrossSections.length - 1]
    return [selectedR[1] * headScale, selectedR[2] * headScale, selectedR[3] * headScale]
  }
  return {
    cy: sum,
    s: headScale,
    ring: headRingAt,
    surf: (primary, secondary) => {
      const lResult = headRingAt(secondary - sum)
      return lResult[2] + lResult[1] * Math.sqrt(Math.max(0, 1 - (primary / lResult[0]) ** 2))
    },
  }
}

function emitHeadFurMane(builder, rig, surfaceProfile, paintStyle) {
  const skillValue = surfaceProfile.s,
    maneThickness = (paintStyle.thick ?? 0.022) * skillValue
  builder.bone(rig.J.head).paint(paintStyle.c, { c2: paintStyle.c2, gloss: paintStyle.gloss ?? 0.25, ao: 0.85, ao2: 1, mat: MATERIAL_KINDS.fur })
  const entries = [-0.2, -0.13, -0.06, 0, 0.06, 0.12, 0.17, 0.215, 0.245, 0.262],
    mappedResult = entries.map((heightRatio) => {
      const ringResult = surfaceProfile.ring(heightRatio * skillValue),
        items = heightRatio > 0.25 ? 0.2 : 1
      return [surfaceProfile.cy + heightRatio * skillValue + (heightRatio > 0.2 ? maneThickness * 0.6 : 0), ringResult[0] + maneThickness * items, ringResult[1] + maneThickness * items, 0, ringResult[2] - maneThickness * 0.2]
    })
  builder.lathe(mappedResult, {
    seg: 14,
    crease: 180,
    cap0: !1,
    shape: (primary, secondary) => {
      let stripeAngle = Math.abs(primary - Math.PI / 2)
      return (stripeAngle > Math.PI && (stripeAngle = Math.PI * 2 - stripeAngle), entries[secondary] >= paintStyle.line(stripeAngle) ? 1 : 0.8)
    },
  })
}

function buildFaceFeatures(builder, rig, surfaceProfile, featureSpec) {
  const sValue = surfaceProfile.s,
    delta = surfaceProfile.cy - 0.025 * sValue,
    eyeOffsetX = 0.098 * sValue * (featureSpec.spread ?? 1),
    scaledValueX = (featureSpec.eyeW ?? 0.05) * sValue,
    scaledValueY = (featureSpec.eyeH ?? 0.045) * sValue,
    ringProfile = surfaceProfile.ring(delta - surfaceProfile.cy),
    scaledValueZ = ringProfile[1] * Math.sqrt(Math.max(0, 1 - (eyeOffsetX / ringProfile[0]) ** 2)),
    scaledValueWidth = (Math.atan2(eyeOffsetX / (ringProfile[0] * ringProfile[0]), scaledValueZ / (ringProfile[1] * ringProfile[1])) * 180) / Math.PI,
    computed = featureSpec.irisSize ?? 0.68
  ;(builder.bone(rig.J.head),
    builder.sym(() => {
      builder.g(composeMatrix(eyeOffsetX, delta, ringProfile[2] + scaledValueZ - 0.004 * sValue, 0, scaledValueWidth * 0.8, featureSpec.slant ?? 4), () => {
        const scaledValueX = (featureSpec.lash ?? 0.014) * sValue
        if (featureSpec.lite) {
          ;(builder.paint(16512236, { line: 0 }),
            emitConeSkirt(builder, 0, 0, 0.002 * sValue, scaledValueX, scaledValueY, 0.011 * sValue, 12),
            builder.paint(featureSpec.iris, { glow: featureSpec.irisGlow ?? 0.2, line: 0 }),
            emitConeSkirt(builder, -scaledValueX * 0.1, -scaledValueY * 0.04, 0.0115 * sValue, scaledValueX * computed, scaledValueY * Math.min(0.9, computed * 1.32), 0.004 * sValue, 10),
            builder.paint(1314066, { line: 0 }),
            emitConeSkirt(builder, -scaledValueX * 0.1, -scaledValueY * 0.08, 0.0145 * sValue, scaledValueX * computed * 0.47, scaledValueY * Math.min(0.48, computed * 0.7), 0.003 * sValue, 8),
            builder.paint(16777215, { glow: 0.5, line: 0 }),
            emitConeSkirt(builder, scaledValueX * 0.16, scaledValueY * 0.36, 0.0165 * sValue, scaledValueX * 0.24, scaledValueY * 0.24, 0.002 * sValue, 6),
            builder.paint(featureSpec.brow, { line: 0 }),
            builder.box(0, scaledValueY * 0.9, 0.01 * sValue, scaledValueX * 2.25, scaledValueX, 0.016 * sValue),
            builder.g(composeMatrix(scaledValueX * 1.05, scaledValueY * 0.75, 0.008 * sValue, 0, 0, 38), () => builder.box(0, 0, 0, scaledValueX * 0.5, scaledValueX * 0.9, 0.014 * sValue)))
          return
        }
        ;(builder.paint(16512236, { line: 0 }),
          builder.ball(0, 0, 0, scaledValueX, scaledValueY, 0.012 * sValue, 1),
          builder.paint(featureSpec.iris, { glow: featureSpec.irisGlow ?? 0.2, line: 0 }),
          builder.ball(-scaledValueX * 0.1, -scaledValueY * 0.04, 0.006 * sValue, scaledValueX * computed, scaledValueY * Math.min(0.9, computed * 1.32), 0.009 * sValue, 1),
          builder.paint(1314066, { line: 0 }),
          builder.ball(-scaledValueX * 0.1, -scaledValueY * 0.08, 0.01 * sValue, scaledValueX * computed * 0.47, scaledValueY * Math.min(0.48, computed * 0.7), 0.007 * sValue, 1),
          builder.paint(16777215, { glow: 0.5, line: 0 }),
          builder.ball(scaledValueX * 0.16, scaledValueY * 0.36, 0.014 * sValue, scaledValueX * 0.24, scaledValueY * 0.24, 0.004 * sValue, 0),
          builder.paint(featureSpec.brow, { line: 0 }),
          builder.box(0, scaledValueY * 0.9, 0.008 * sValue, scaledValueX * 2.25, scaledValueX, 0.016 * sValue, scaledValueX * 0.3),
          builder.g(composeMatrix(scaledValueX * 1.05, scaledValueY * 0.75, 0.006 * sValue, 0, 0, 38), () => builder.box(0, 0, 0, scaledValueX * 0.5, scaledValueX * 0.9, 0.014 * sValue, scaledValueX * 0.3)))
      })
      const sumDepth = delta + scaledValueY + 0.04 * sValue,
        browHeight = (featureSpec.browH ?? 0.018) * sValue
      ;(builder.paint(featureSpec.brow, { line: 0 }),
        builder.g(composeMatrix(eyeOffsetX + 0.006 * sValue, sumDepth, surfaceProfile.surf(eyeOffsetX, sumDepth) + 0.003 * sValue, -14, scaledValueWidth * 0.7, featureSpec.browTilt ?? 10), () => builder.box(0, 0, 0, scaledValueX * 2.3 * (featureSpec.browLen ?? 1), browHeight, 0.016 * sValue, Math.min(0.006 * sValue, browHeight * 0.4))))
    }))
  const deltaX = surfaceProfile.cy - 0.145 * sValue
  if (featureSpec.lip !== void 0)
    if (featureSpec.smile === void 0 && featureSpec.open === void 0)
      (builder.paint(featureSpec.lip, { line: 0 }), builder.g(composeMatrix(0, deltaX, surfaceProfile.surf(0, deltaX) + 0.001, -8, 0, 0), () => builder.box(0, 0, 0, 0.06 * sValue * (featureSpec.mouthW ?? 1), 0.012 * sValue, 0.012 * sValue, 0.004 * sValue)))
    else {
      const scaledValueHeight = 0.03 * sValue * (featureSpec.mouthW ?? 1),
        computedX = featureSpec.smile ?? 0,
        clamped = clampUnit(featureSpec.open ?? 0),
        sum = (lipX) => deltaX + computedX * 0.02 * sValue * (lipX / scaledValueHeight) ** 2 + clamped * 0.006 * sValue,
        scaledValueDepth = (lipX) => clamped * 0.034 * sValue * (1 - (lipX / scaledValueHeight) ** 2),
        scaledValueStart = 0.0075 * sValue
      ;(clamped > 0.02 &&
        (builder.paint(4856858, { line: 0 }),
        builder.sheet(
          6,
          2,
          (primaryY, secondaryY) => {
            const deltaDepth = (primaryY - 0.5) * 2 * scaledValueHeight * 0.96,
              lerped = lerpValue(sum(deltaDepth) - scaledValueDepth(deltaDepth), sum(deltaDepth), secondaryY)
            return [deltaDepth, lerped, surfaceProfile.surf(deltaDepth, lerped) + 0.0025 * sValue]
          },
          !1,
        ),
        builder.paint(16183266, { line: 0 }),
        builder.sheet(
          6,
          1,
          (primaryZ, secondaryZ) => {
            const deltaStart = (primaryZ - 0.5) * 2 * scaledValueHeight * 0.86,
              lerpedX = lerpValue(sum(deltaStart) - scaledValueDepth(deltaStart) * 0.5, sum(deltaStart), secondaryZ)
            return [deltaStart, lerpedX, surfaceProfile.surf(deltaStart, lerpedX) + 0.004 * sValue]
          },
          !1,
        )),
        builder.paint(featureSpec.lip, { line: 0 }))
      const scaledValueEnd = (primary, secondary) => {
        const entries = []
        for (let index = 0; index <= 6; index++) {
          const lipSampleX = (index / 6 - 0.5) * 2 * scaledValueHeight,
            kResult = primary(lipSampleX),
            delta = 1 - 0.55 * Math.abs(index / 3 - 1) ** 2
          entries.push([lipSampleX, kResult, surfaceProfile.surf(lipSampleX, kResult) + 0.003 * sValue, secondary * delta, 0.006 * sValue])
        }
        return entries
      }
      ;(builder.tube(scaledValueEnd(sum, scaledValueStart), { seg: 4, up: [0, 1, 0] }),
        clamped > 0.02 &&
          builder.tube(
            scaledValueEnd((lipX) => sum(lipX) - scaledValueDepth(lipX) - scaledValueStart * 0.4, scaledValueStart * 0.85),
            { seg: 4, up: [0, 1, 0] },
          ))
    }
  if (featureSpec.skin !== void 0) {
    const computedY = featureSpec.nose ?? 0
    if (computedY > 0) {
      const deltaY = surfaceProfile.cy - 0.092 * sValue,
        surfResult = surfaceProfile.surf(0, deltaY)
      ;(builder.paint(featureSpec.skin, { ao: 1, ao2: 0.72, glow: 0.07, line: 0, mat: MATERIAL_KINDS.skin }),
        builder.tube(
          [
            [0, deltaY - 0.012 * sValue * computedY, surfResult - 0.004 * sValue, 0.03 * sValue * computedY, 0.012 * sValue * computedY],
            [0, deltaY + 0.004 * sValue, surfResult + 0.022 * sValue * computedY, 0.024 * sValue * computedY, 0.02 * sValue * computedY],
            [0, deltaY + 0.05 * sValue, surfaceProfile.surf(0, deltaY + 0.05 * sValue) + 0.004 * sValue, 0.014 * sValue * computedY, 0.012 * sValue],
            [0, deltaY + 0.085 * sValue, surfaceProfile.surf(0, deltaY + 0.085 * sValue) - 0.004 * sValue, 0.01 * sValue * computedY, 0.006 * sValue],
          ],
          { seg: 5, up: [1, 0, 0], crease: 180 },
        ))
    }
    if (featureSpec.ears) {
      const samples = surfaceProfile.ring(-0.04 * sValue)
      ;(builder.paint(featureSpec.skin, { ao: 0.8, glow: 0.07, mat: MATERIAL_KINDS.skin }),
        builder.sym(() => builder.g(composeMatrix(samples[0] * 0.99, surfaceProfile.cy - 0.04 * sValue, samples[2] - 0.015 * sValue, 0, -18, 0), () => builder.ball(0, 0, 0, 0.022 * sValue, 0.05 * sValue, 0.034 * sValue, 0, 180))))
    }
  }
}

function emitShinFoot(fxBuilder, rig, coordY, limbSpec) {
  const dValue = rig.d,
    joints = rig.J,
    legCenterX = coordY * dValue.hipX
  ;(fxBuilder.bone(coordY > 0 ? joints.shinL : joints.shinR),
    fxBuilder.lathe(
      [
        [dValue.ankleY - 0.03, limbSpec.rAnkle * 1.05, limbSpec.rAnkle * 1.12, legCenterX, 0],
        [dValue.ankleY + 0.07, limbSpec.rAnkle, limbSpec.rAnkle * 1.05, legCenterX, 0],
        [lerpValue(dValue.ankleY, limbSpec.top, 0.62), lerpValue(limbSpec.rAnkle, limbSpec.rTop, 0.7), lerpValue(limbSpec.rAnkle, limbSpec.rTop, 0.7), legCenterX, 0],
        [limbSpec.top, limbSpec.rTop, limbSpec.rTop, legCenterX, 0],
        [limbSpec.top + 0.005, limbSpec.rTop * 0.8, limbSpec.rTop * 0.8, legCenterX, 0],
      ],
      { seg: limbSpec.seg ?? 8 },
    ),
    fxBuilder.bone(coordY > 0 ? joints.footL : joints.footR))
  const ankleRadius = limbSpec.rAnkle,
    computed = limbSpec.toe ?? 0.02
  fxBuilder.tube(
    [
      [legCenterX, 0.055, -ankleRadius * 1.3, ankleRadius * 0.8, 0.05],
      [legCenterX, 0.07, -ankleRadius * 0.4, ankleRadius * 1.08, 0.07],
      [legCenterX, 0.065, limbSpec.len * 0.45, ankleRadius * 1.2, 0.065],
      [legCenterX, 0.055 + computed * 0.4, limbSpec.len * 0.85, ankleRadius * 1.05, 0.052],
      [legCenterX, 0.05 + computed, limbSpec.len, ankleRadius * 0.6, 0.034],
    ],
    { seg: 8, up: [1, 0, 0] },
  )
}

function emitScaledTorus(builder, coordY, coordZ, offsetZ, ringRadius, depthScale, tubeRadius = 0.014, bandWidth = 0.02, radialSegments = 10) {
  builder.g(composeMatrix(coordY, coordZ, offsetZ, 0, 0, 0, 1, 1, depthScale / ringRadius), () => builder.torus(ringRadius, tubeRadius, bandWidth, radialSegments, 4, { crease: 30 }))
}

function emitFacialFur(builder, rig, surfaceProfile, furSpec) {
  const skillResult = surfaceProfile.s,
    computed = furSpec.spread ?? 1.45,
    furThickness = (furSpec.thick ?? 0.03) * skillResult,
    computedX = furSpec.drop ?? 0.05,
    computedY = furSpec.puff ?? 0.5
  builder.bone(rig.J.head).paint(furSpec.c, { c2: furSpec.c2, gloss: furSpec.gloss ?? 0.2, ao: 0.82, ao2: 1, mat: MATERIAL_KINDS.fur })
  const lerped = (horizontalOffset) => {
      const horizontalDistance = Math.abs(horizontalOffset)
      return horizontalDistance < 0.34 ? -0.182 : horizontalDistance < 0.8 ? lerpValue(-0.182, -0.085, (horizontalDistance - 0.34) / 0.46) : lerpValue(-0.085, 0.03, clampUnit((horizontalDistance - 0.8) / Math.max(0.05, computed - 0.8)))
    },
    lerpedX = (horizontalOffset) => lerpValue(-0.252 - computedX, -0.13, Math.pow(clampUnit(Math.abs(horizontalOffset) / Math.max(0.2, computed)), 1.6)),
    sum = (cooldown, primary, secondary) => {
      const clampedRingHeight = Math.max(primary, -0.2),
        samples = surfaceProfile.ring(clampedRingHeight * skillResult),
        radialFalloff = Math.max(0.25, 1 - (clampedRingHeight - primary) * 3.2)
      return [(samples[0] * radialFalloff + secondary) * Math.sin(cooldown), surfaceProfile.cy + primary * skillResult, samples[2] + (samples[1] * radialFalloff + secondary) * Math.cos(cooldown)]
    }
  computed > 0 &&
    builder.sheet(10, 3, (primaryWidth, secondaryWidth) => {
      const lerpedY = lerpValue(-computed, computed, primaryWidth),
        lerpedZ = lerpValue(lerpedX(lerpedY), lerped(lerpedY), secondaryWidth),
        widthArchWeight = Math.sin(Math.PI * primaryWidth)
      return sum(lerpedY, lerpedZ, furThickness * (0.12 + 0.88 * Math.sin(Math.PI * Math.min(1, (1 - secondaryWidth) * 0.85 + 0.12))) * (0.35 + 0.65 * widthArchWeight))
    })
  const computedZ = furSpec.tufts ?? 5,
    scaledValueX = (furSpec.len ?? 0.2) * skillResult,
    scaledValueY = (furSpec.tuftR ?? 0.045) * skillResult,
    tuftFanHalfSpan = computed > 0 ? computed * 0.86 : 0.5
  for (let index = 0; index < computedZ; index++) {
    const scaledValueZ = computedZ === 1 ? 0 : (index / (computedZ - 1)) * 2 - 1,
      scaledValueWidth = scaledValueZ * tuftFanHalfSpan,
      delta = 1 - Math.abs(scaledValueZ),
      lerpedY = lerpValue(lerped(scaledValueWidth), lerpedX(scaledValueWidth), 0.62),
      dResult = sum(scaledValueWidth, lerpedY, furThickness * 0.55),
      tuftDirX = Math.sin(scaledValueWidth),
      tuftDirZ = Math.cos(scaledValueWidth),
      entries = [tuftDirX * (0.35 + computedY * 0.8), -1, tuftDirZ * (0.3 + computedY * 0.55) * (0.5 + 0.5 * delta)]
    emitTaperedTube(builder, dResult, entries, scaledValueX * (0.78 + 0.22 * delta), scaledValueY * (0.85 + 0.25 * delta), { curl: [tuftDirX * computedY * 0.5, computedY * 0.55, tuftDirZ * computedY * 0.4], n: 3, seg: furSpec.tuftSeg ?? 5, up: [tuftDirZ, 0, -tuftDirX], flat: 0.8, tip: 0.16 })
  }
  const scaledValueHeight = (furSpec.mustache ?? 0) * skillResult
  if (scaledValueHeight > 0) {
    const scaledValueDepth = (furSpec.mustacheR ?? 0.016) * skillResult,
      scaledValueStart = (furSpec.curl ?? 0.02) * skillResult
    builder.sym(() => {
      const entries = []
      for (let mustacheRow = 0; mustacheRow <= 3; mustacheRow++) {
        const ratioX = mustacheRow / 3,
          sumStart = 0.012 * skillResult + scaledValueHeight * ratioX,
          deltaEnd = surfaceProfile.cy - 0.122 * skillResult - 0.03 * skillResult * Math.sin(Math.PI * Math.min(1, ratioX * 1.1)) * 0.8 + scaledValueStart * ratioX * ratioX * 1.6,
          lerpedWidth = mustacheRow === 0 ? 0.7 : lerpValue(1, 0.12, Math.pow(ratioX, 1.5))
        entries.push([sumStart, deltaEnd, surfaceProfile.surf(Math.min(sumStart, surfaceProfile.ring(deltaEnd - surfaceProfile.cy)[0] * 0.96), deltaEnd) + scaledValueDepth * 0.5 + 0.02 * skillResult * ratioX * ratioX, scaledValueDepth * lerpedWidth, scaledValueDepth * 0.75 * lerpedWidth])
      }
      builder.tube(entries, { seg: 4, up: [0, 1, 0], crease: 180 })
    })
  }
}

/** emitRingFurTufts 的毛发配置：c 为主色，其余为可选毛发/链参数（默认见函数签名） */
interface RingFurTuftsConfig {
  c: number
  c2?: number
  tufts?: number
  seg?: number
  y?: number
  amp?: number
  lobes?: number
  lobeAmp?: number
  grain?: number
  team?: number
  up?: [number, number, number]
}
function emitRingFurTufts(coordX, coordY, coordZ, tuftLength, tuftRadius, position: RingFurTuftsConfig = { c: 16777215 }) {
  const computed = position.tufts ?? 9,
    entries = [],
    tuftCount = computed * 2
  for (let index = 0; index < tuftCount; index++) {
    const scaledValueX = (index / tuftCount) * Math.PI * 2
    entries.push([Math.cos(scaledValueX) * coordY, position.y ?? 0, Math.sin(scaledValueX) * coordZ, tuftRadius, tuftLength])
  }
  emitFurTufts(coordX, entries, { ...position, tufts: computed, closed: !0, up: [0, 1, 0] })
}

function emitHand(builder, rig, coordZ, handScale = 0.07, useTubeStyle = !1) {
  const durationResult = rig.d,
    handX = coordZ * durationResult.shoulderX,
    sum = durationResult.handY + 0.01
  ;(builder.bone(coordZ > 0 ? rig.J.handL : rig.J.handR),
    useTubeStyle
      ? (builder.tube(
          [
            [handX, sum + handScale * 1, 0, handScale * 0.3, handScale * 0.62],
            [handX, sum + handScale * 0.3, 0.004, handScale * 0.36, handScale * 0.86],
            [handX, sum - handScale * 0.5, 0.012, handScale * 0.32, handScale * 0.84],
            [handX, sum - handScale * 1.25, 0.04, handScale * 0.24, handScale * 0.7],
            [handX, sum - handScale * 1.8, 0.085, handScale * 0.14, handScale * 0.5],
          ],
          { seg: 6, up: [1, 0, 0], crease: 180 },
        ),
        builder.g(composeMatrix(handX, sum - handScale * 0.2, handScale * 0.8, 40, 0, 0), () => builder.ball(0, 0, 0, handScale * 0.24, handScale * 0.6, handScale * 0.26, 0, 180)))
      : (builder.lathe(
          [
            [sum - handScale * 1.05, handScale * 0.5, handScale * 0.6, handX, 0.012],
            [sum - handScale * 0.72, handScale * 0.86, handScale * 1.02, handX, 0.012],
            [sum, handScale * 0.94, handScale * 1.12, handX, 0.008],
            [sum + handScale * 0.72, handScale * 0.8, handScale * 0.9, handX, 0],
            [sum + handScale * 1.02, handScale * 0.5, handScale * 0.56, handX, 0],
          ],
          { seg: 7, power: 2.5, crease: 180 },
        ),
        builder.g(composeMatrix(handX - coordZ * handScale * 0.2, sum + handScale * 0.1, handScale * 1, 0, 0, coordZ * 24), () => builder.ball(0, 0, 0, handScale * 0.34, handScale * 0.6, handScale * 0.34, 0, 180))))
}

/**
 * 创建模型。
 *
 */
function buildSwordsmanModel() {
  const skeleton = buildSkeleton(WARRIOR_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    builder = new ModelBuilder(),
    gripRJoint = rig.add("gripR", joints.chest, 0, proportions.chestY, 0),
    aimJoint = rig.add("aim", joints.chest, 0, proportions.chestY, 0),
    gripLJoint = rig.add("gripL", joints.chest, 0, proportions.chestY, 0),
    sum = proportions.headY + 0.25,
    entries = [
      [0, sum + 0.33, -0.01],
      [0, sum + 0.45, -0.04],
      [0, sum + 0.56, -0.08],
    ],
    addChainResult = rig.addChain("pony", joints.head, entries.slice(0, 2))
  rig.chain({ joints: addChainResult, tip: [0, 0.11, -0.04], stiffness: 9, drag: 0.86, gravity: 6, maxAngle: 50, wind: 1.6 })
  const entriesX = [
      [0, 1.4, -0.16],
      [0, 1.17, -0.29],
      [0, 0.93, -0.35],
      [0, 0.7, -0.38],
      [0, 0.48, -0.39],
    ],
    addedChain = rig.addChain("scarf", joints.chest, entriesX.slice(0, 4))
  rig.chain({
    joints: addedChain,
    tip: [0, -0.22, -0.01],
    stiffness: 3.2,
    drag: 0.92,
    gravity: 8,
    maxAngle: 72,
    wind: 2.6,
    colliders: [
      { joint: joints.chest, x: 0, y: 0, z: 0.02, r: 0.3 },
      { joint: joints.hips, x: 0, y: 0, z: 0, r: 0.3 },
    ],
  })
  const entriesY = [
      [0.23, 0.96, 0.1],
      [0.28, 0.76, 0.11],
      [0.29, 0.56, 0.09],
      [0.29, 0.38, 0.08],
    ],
    sashChain = rig.addChain("sash", joints.hips, entriesY.slice(0, 3))
  rig.chain({ joints: sashChain, tip: [0, -0.18, -0.01], stiffness: 6, drag: 0.88, gravity: 10, maxAngle: 60, wind: 1 })
  const entriesZ = [
      [0, 0.9, 0.2],
      [0, 0.7, 0.225],
      [0, 0.5, 0.23],
      [0, 0.34, 0.23],
    ],
    tabChain = rig.addChain("tab", joints.hips, entriesZ.slice(0, 3))
  rig.chain({ joints: tabChain, tip: [0, -0.16, 0], stiffness: 8, drag: 0.86, gravity: 10, maxAngle: 50, wind: 0.8 })
  const entriesWidth = [
      [0, 0.9, -0.19],
      [0, 0.68, -0.23],
      [0, 0.46, -0.24],
      [0, 0.3, -0.24],
    ],
    tailChain = rig.addChain("tail", joints.hips, entriesWidth.slice(0, 3))
  rig.chain({ joints: tailChain, tip: [0, -0.16, 0], stiffness: 6, drag: 0.88, gravity: 10, maxAngle: 60, wind: 1 })
  const entriesHeight = [
      [-proportions.shoulderX, proportions.handY - 0.03, 1.1],
      [-proportions.shoulderX, proportions.handY - 0.17, 1.1],
      [-proportions.shoulderX, proportions.handY - 0.31, 1.1],
    ],
    tasselChain = rig.addChain("tassel", joints.propR, entriesHeight.slice(0, 2))
  ;(rig.chain({ joints: tasselChain, tip: [0, -0.14, 0], stiffness: 2.5, drag: 0.9, gravity: 14, maxAngle: 150, wind: 1.2 }),
    builder.sym((sideSign) => {
      const hipX = proportions.hipX
      ;(builder.bone(sideSign > 0 ? joints.thighL : joints.thighR).paint(WARRIOR_PALETTE.robeDark, { c2: WARRIOR_PALETTE.robe, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }), builder.limb([hipX, proportions.hipY + 0.04, 0], [hipX, proportions.kneeY, 0], 0.15, 0.115, { seg: 8, bulge: 0.06 }))
    }))
  for (const sideSign of [1, -1]) {
    ;(builder.paint(WARRIOR_PALETTE.leatherDark, { c2: WARRIOR_PALETTE.leather, gloss: 0.25, mat: MATERIAL_KINDS.leather }), emitShinFoot(builder, skeleton, sideSign, { top: 0.44, rTop: 0.128, rAnkle: 0.094, len: 0.26 }))
    const items = sideSign > 0 ? joints.shinL : joints.shinR
    ;(builder.bone(items).paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.6, mat: MATERIAL_KINDS.metal }),
      builder.sheet(3, 2, (primaryHeight, secondaryHeight) => {
        const lerpedHeight = lerpValue(40, 140, primaryHeight) * MODEL_ANGLE_TO_RAD,
          lerpedDepth = lerpValue(0.108, 0.138, secondaryHeight) + 0.012
        return [sideSign * proportions.hipX + Math.cos(lerpedHeight) * lerpedDepth, lerpValue(0.16, 0.45, secondaryHeight), Math.sin(lerpedHeight) * lerpedDepth]
      }),
      builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
      builder.lathe(
        [
          [0.428, 0.132, 0.132, sideSign * proportions.hipX, 0],
          [0.446, 0.14, 0.14, sideSign * proportions.hipX, 0],
          [0.464, 0.13, 0.13, sideSign * proportions.hipX, 0],
        ],
        { seg: 8, cap0: !1, cap1: !1, crease: 30 },
      ),
      builder.ball(sideSign * proportions.hipX, proportions.kneeY + 0.03, 0.13, 0.04, 0.046, 0.026, 0))
  }
  const entriesDepth = [
      [0.76, 0.13, 0.12, 0, 0],
      [0.83, 0.235, 0.19, 0, 0.005],
      [0.92, 0.262, 0.225, 0, 0.026],
      [1.02, 0.268, 0.24, 0, 0.042],
      [1.12, 0.272, 0.225, 0, 0.026],
      [1.22, 0.285, 0.2, 0, 0.008],
      [1.33, 0.295, 0.19, 0, 0],
      [1.39, 0.2, 0.15, 0, 0],
      [1.44, 0.11, 0.105, 0, 0],
    ],
    lerped = (profileHeight) => {
      for (let index = 1; index < entriesDepth.length; index++)
        if (profileHeight <= entriesDepth[index][0]) {
          const ratio = Math.max(0, (profileHeight - entriesDepth[index - 1][0]) / (entriesDepth[index][0] - entriesDepth[index - 1][0]))
          return [lerpValue(entriesDepth[index - 1][1], entriesDepth[index][1], ratio), lerpValue(entriesDepth[index - 1][2], entriesDepth[index][2], ratio), lerpValue(entriesDepth[index - 1][4], entriesDepth[index][4], ratio)]
        }
      const selectedK = entriesDepth[entriesDepth.length - 1]
      return [selectedK[1], selectedK[2], selectedK[4]]
    },
    sumX = (bushMap, samples) => bushMap.map((primaryDepth, secondaryDepth) => [primaryDepth, lerped(primaryDepth)[0] + samples[secondaryDepth], lerped(primaryDepth)[1] + samples[secondaryDepth], 0, lerped(primaryDepth)[2]])
  ;(builder.bind(makeTorsoColorBinder(skeleton)).paint(WARRIOR_PALETTE.robeDark, { c2: WARRIOR_PALETTE.robe, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(entriesDepth, { seg: 12 }),
    builder.bone(joints.neck).paint(WARRIOR_PALETTE.skin, { ao: 0.72, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      [
        [1.4, 0.092, 0.092],
        [1.54, 0.09, 0.092],
      ],
      { seg: 8, cap0: !1 },
    ),
    builder.bind(makeTorsoColorBinder(skeleton)).paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.6, ao: 0.8, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 11, patternAmt: 0.22 }),
    builder.lathe(sumX([1.03, 1.06, 1.14, 1.24, 1.34, 1.385], [0.012, 0.03, 0.026, 0.022, 0.022, 0.012]), { seg: 12, cap0: !1 }),
    builder.bone(joints.chest),
    builder.sym(() => {
      builder.g(composeMatrix(0.125, 1.25, lerped(1.25)[1] * 0.93 + 0.02, -6, 16, 0), () => {
        ;(builder.paint(WARRIOR_PALETTE.brassDark, { c2: WARRIOR_PALETTE.brass, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.g(composeMatrix(0, 0, 0, 90, 0, 0), () =>
            builder.lathe(
              [
                [0, 0.1],
                [0.018, 0.094],
                [0.03, 0.07],
                [0.036, 0.02],
              ],
              { seg: 10, cap0: !1 },
            ),
          ),
          builder.paint(WARRIOR_PALETTE.brass, { c2: 16765562, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.g(composeMatrix(0, 0, 0.012, 90, 0, 0), () => builder.torus(0.098, 0.014, 0.012, 10, 3, { crease: 30 })))
      })
    }),
    builder.bone(joints.spine).paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(0, 1.07, lerped(1.07)[1] + lerped(1.07)[2] + 0.028, 6, 0, 0), () => {
      ;(builder.extrude(
        [
          [-0.1, 0.075],
          [0, 0.1],
          [0.1, 0.075],
          [0.115, 0],
          [0.07, -0.085],
          [0, -0.11],
          [-0.07, -0.085],
          [-0.115, 0],
        ],
        0.04,
        0.016,
      ),
        builder.paint(WARRIOR_PALETTE.brassDark, { c2: WARRIOR_PALETTE.brass, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.sym(() => builder.g(composeMatrix(0.046, 0.03, 0.024, 0, 0, 16), () => builder.box(0, 0, 0, 0.07, 0.024, 0.02))),
        builder.ball(0, -0.01, 0.026, 0.024, 0.04, 0.018, 0),
        builder.sym(() => builder.ball(0.045, -0.058, 0.022, 0.016, 0.022, 0.012, 0)))
    }),
    builder.bone(joints.spine).paint(WARRIOR_PALETTE.leather, { c2: WARRIOR_PALETTE.leatherDark, gloss: 0.25, mat: MATERIAL_KINDS.leather }),
    builder.lathe(sumX([0.9, 0.915, 1, 1.015], [0.022, 0.036, 0.036, 0.022]), { seg: 12 }),
    builder.bone(joints.hips).paint(WARRIOR_PALETTE.redLight, { c2: WARRIOR_PALETTE.red, mat: MATERIAL_KINDS.cloth }),
    builder.ball(0.24, 0.965, 0.1, 0.06, 0.05, 0.052, 1),
    builder.bind(makeChainColorBinder(sashChain, entriesY, joints.hips)).paint(WARRIOR_PALETTE.red, { c2: WARRIOR_PALETTE.redDark, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, entriesY, { width: (ribbonProgress) => lerpNumeric(0.05, 0.075, ribbonProgress), axis: [0, 0, 1], bow: [0.02, 0, 0], nu: 2, nv: 5, tail: "point", tailLen: 0.1 }))
  const emitChainRibbon = (towersDestroyed, entries, coordY, coordZ, bowDepth, tailLength) => {
    builder.bind(makeChainColorBinder(towersDestroyed, entries, joints.hips)).paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth })
    const bowedEntries = entries.map((samplesY) => [samplesY[0], samplesY[1], samplesY[2] - Math.sign(bowDepth) * 0.006])
    ;(emitGradientRibbon(builder, bowedEntries, { width: (ribbonProgress) => lerpNumeric(coordY, coordZ, ribbonProgress) + 0.024, bow: [0, 0, bowDepth], nu: 2, nv: 5, tail: "swallow", tailLen: tailLength + 0.03 }),
      builder.paint(WARRIOR_PALETTE.red, { c2: WARRIOR_PALETTE.redDark, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(builder, entries, { width: (ribbonProgress) => lerpNumeric(coordY, coordZ, ribbonProgress), bow: [0, 0, bowDepth], nu: 4, nv: 5, tail: "swallow", tailLen: tailLength }))
  }
  ;(emitChainRibbon(tabChain, entriesZ, 0.14, 0.115, 0.035, 0.1),
    emitChainRibbon(tailChain, entriesWidth, 0.17, 0.14, -0.035, 0.11),
    builder.sym(() => {
      ;(builder.bone(joints.hips).paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.6, ao: 0.78, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 11, patternAmt: 0.22 }),
        builder.sheet(4, 2, (primaryStart, secondaryStart) => {
          const lerpedStart = lerpValue(-64, 64, primaryStart) * MODEL_ANGLE_TO_RAD,
            lerpedEnd = lerpValue(0.262, 0.3, secondaryStart)
          return [Math.cos(lerpedStart) * lerpedEnd, lerpValue(0.92, 0.66, secondaryStart) + (Math.round(primaryStart * 4) % 2 === 0 ? 0.014 * secondaryStart : 0), Math.sin(lerpedStart) * lerpedEnd * 0.82]
        }),
        builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [-64, 0, 64].map((angleDeg) => [Math.cos(angleDeg * MODEL_ANGLE_TO_RAD) * 0.306, 0.662, Math.sin(angleDeg * MODEL_ANGLE_TO_RAD) * 0.306 * 0.82, 0.014, 0.012]),
          { seg: 4, up: [0, 1, 0] },
        ))
    }),
    builder.sym((sideSign) => {
      const armX = proportions.shoulderX
      ;(builder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(WARRIOR_PALETTE.red, { c2: WARRIOR_PALETTE.redDark, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
        builder.limb([armX, proportions.shoulderY + 0.04, 0], [armX, proportions.elbowY - 0.02, 0], 0.112, 0.094, { seg: 8, bulge: 0.06 }),
        builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
        builder.lathe(
          [
            [proportions.elbowY + 0.07, 0.101, 0.101, armX, 0],
            [proportions.elbowY + 0.085, 0.108, 0.108, armX, 0],
            [proportions.elbowY + 0.115, 0.108, 0.108, armX, 0],
            [proportions.elbowY + 0.13, 0.103, 0.103, armX, 0],
          ],
          { seg: 8, cap0: !1, cap1: !1 },
        ),
        builder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(WARRIOR_PALETTE.redDark, { c2: WARRIOR_PALETTE.red, mat: MATERIAL_KINDS.cloth }),
        builder.ball(armX, proportions.elbowY, 0, 0.096, 0.094, 0.096, 1),
        builder.limb([armX, proportions.elbowY, 0], [armX, proportions.wristY + 0.16, 0], 0.092, 0.096, { seg: 8 }),
        builder.paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.6, mat: MATERIAL_KINDS.metal }),
        builder.lathe(
          [
            [proportions.wristY - 0.01, 0.082, 0.082, armX, 0],
            [proportions.wristY + 0.03, 0.098, 0.098, armX, 0],
            [proportions.wristY + 0.18, 0.106, 0.106, armX, 0],
            [proportions.wristY + 0.2, 0.09, 0.09, armX, 0],
          ],
          { seg: 8 },
        ),
        builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }))
      for (const cuffY of [proportions.wristY + 0.02, proportions.wristY + 0.165])
        builder.lathe(
          [
            [cuffY, 0.102, 0.102, armX, 0],
            [cuffY + 0.014, 0.112, 0.112, armX, 0],
            [cuffY + 0.028, 0.104, 0.104, armX, 0],
          ],
          { seg: 8, cap0: !1, cap1: !1, crease: 30 },
        )
    }),
    builder.paint(WARRIOR_PALETTE.skin, { glow: 0.05, ao: 0.9, mat: MATERIAL_KINDS.skin }),
    emitHand(builder, skeleton, 1, 0.078),
    emitHand(builder, skeleton, -1, 0.078))
  const emitArmGuard = (coordX, coordY, coordZ, guardHeight, guardHalfWidth, guardHalfDepth, tiltAngle) => {
    ;(builder.bone(coordX).paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.6, ao: 0.8, ao2: 1, mat: MATERIAL_KINDS.metal }),
      builder.g(composeMatrix(coordY, coordZ, 0, 0, 0, tiltAngle), () => {
        ;(builder.lathe(
          [
            [-guardHalfWidth * 0.34, guardHeight, guardHalfDepth],
            [-guardHalfWidth * 0.1, guardHeight * 1.02, guardHalfDepth * 1.02],
            [guardHalfWidth * 0.6, guardHeight * 0.72, guardHalfDepth * 0.72],
            [guardHalfWidth, guardHeight * 0.18, guardHalfDepth * 0.18],
          ],
          { seg: 10, crease: 50 },
        ),
          builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.lathe(
            [
              [-guardHalfWidth * 0.42, guardHeight * 0.98, guardHalfDepth * 0.98],
              [-guardHalfWidth * 0.3, guardHeight * 1.05, guardHalfDepth * 1.05],
              [-guardHalfWidth * 0.16, guardHeight * 1.03, guardHalfDepth * 1.03],
            ],
            { seg: 10, cap0: !1, cap1: !1, crease: 30 },
          ))
      }))
  }
  ;(builder.sym((sideSign) => {
    ;(emitArmGuard(sideSign > 0 ? joints.armL : joints.armR, 0.4, 1.3, 0.15, 0.085, 0.155, -44), emitArmGuard(sideSign > 0 ? joints.clavL : joints.clavR, 0.355, 1.435, 0.2, 0.13, 0.19, -18))
  }),
    builder.bone(joints.chest).paint(WARRIOR_PALETTE.redDark, { c2: WARRIOR_PALETTE.red, ao: 0.9, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [1.33, 0.3, 0.215],
        [1.37, 0.27, 0.2],
        [1.42, 0.19, 0.16],
        [1.47, 0.135, 0.13],
      ],
      { seg: 12, cap0: !1, cap1: !1, shape: (angle) => 1 + 0.03 * Math.sin(angle * 6) },
    ),
    builder.paint(WARRIOR_PALETTE.redLight, { c2: WARRIOR_PALETTE.red, mat: MATERIAL_KINDS.cloth }),
    builder.g(composeMatrix(0, 1.47, 0.012, 12, 0, 0, 1, 1, 0.92), () => builder.torus(0.142, 0.052, 0.046, 10, 4)),
    builder.ball(0, 1.425, 0.16, 0.048, 0.04, 0.036, 0, 180),
    builder.sym(() =>
      builder.tube(
        [
          [0.02, 1.42, 0.165, 0.03, 0.012],
          [0.07, 1.34, 0.19, 0.034, 0.012],
          [0.08, 1.27, 0.2, 0.012, 0.008],
        ],
        { seg: 4, up: [1, 0, 0] },
      ),
    ),
    builder.bind(makeChainColorBinder(addedChain, entriesX, joints.chest)).paint(WARRIOR_PALETTE.red, { c2: WARRIOR_PALETTE.redDark, mat: MATERIAL_KINDS.cloth }))
  const scarfWidthAt = (progress) => lerpNumeric(0.25, 0.37, Math.sin(progress * Math.PI * 0.5)),
    entriesStart = [0, 0.25, 0.5, 0.75, 0.9].map((sampleRatio) => sampleColorGradient(entriesX, sampleRatio))
  ;(emitGradientRibbon(builder, entriesStart, { width: (ribbonProgress) => scarfWidthAt(ribbonProgress * 0.9), bow: [0, 0, -0.07], wave: 0.22, nu: 6, nv: 8, tail: "flat" }),
    builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, [sampleColorGradient(entriesX, 0.9), sampleColorGradient(entriesX, 0.95), sampleColorGradient(entriesX, 1)], { width: (ribbonProgress) => scarfWidthAt(0.9 + ribbonProgress * 0.1), bow: [0, 0, -0.07], nu: 6, nv: 2, tail: "flat" }))
  const headSurface = buildHeadSurface(builder, skeleton, WARRIOR_PALETTE.skin, 1, 0.25, 1.1)
  ;(buildFaceFeatures(builder, skeleton, headSurface, {
    iris: 3810322,
    irisGlow: 0.05,
    irisSize: 0.6,
    brow: WARRIOR_PALETTE.beard,
    browTilt: 5,
    browH: 0.03,
    browLen: 1.05,
    eyeW: 0.05,
    eyeH: 0.046,
    slant: 2,
    lash: 0.014,
    lip: 8140070,
    skin: WARRIOR_PALETTE.skin,
    nose: 1.3,
    ears: !0,
    mouthW: 1.75,
    smile: 1,
    open: 0.85,
    lite: !0,
  }),
    emitFacialFur(builder, skeleton, headSurface, { c: WARRIOR_PALETTE.beard, c2: WARRIOR_PALETTE.beardHi, spread: 1.5, thick: 0.075, drop: 0.06, tufts: 9, len: 0.075, tuftR: 0.058, puff: 0.15, mustache: 0.095, mustacheR: 0.017, curl: 0.034, gloss: 0 }))
  {
    const sumY = (assists, radiusOffset) => {
      const samples = headSurface.ring(assists)
      return [headSurface.cy + assists, samples[0] + radiusOffset, samples[1] + radiusOffset, 0, samples[2]]
    }
    ;(builder.bone(joints.head).paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.7, mat: MATERIAL_KINDS.metal }),
      builder.lathe([sumY(0.085, 0.07), sumY(0.1, 0.045), sumY(0.17, 0.04), sumY(0.225, 0.045), [headSurface.cy + 0.275, 0.13, 0.135, 0, -0.016], [headSurface.cy + 0.305, 0.05, 0.05, 0, -0.018]], { seg: 14, cap0: !1 }),
      builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
      builder.lathe([sumY(0.1, 0.05), sumY(0.117, 0.062), sumY(0.134, 0.047)], { seg: 14, cap0: !1, cap1: !1, crease: 30 }),
      builder.lathe(
        [
          [headSurface.cy + 0.295, 0.06],
          [headSurface.cy + 0.32, 0.045],
          [headSurface.cy + 0.345, 0.03],
        ],
        { seg: 8, cap0: !1 },
      ),
      builder.ball(0, headSurface.cy + 0.165, headSurface.surf(0, headSurface.cy + 0.165) + 0.045, 0.04, 0.04, 0.02, 0, 180),
      builder.paint(WARRIOR_PALETTE.ironDark, { c2: WARRIOR_PALETTE.ironLight, gloss: 0.7, mat: MATERIAL_KINDS.metal }))
    const samples = headSurface.ring(0.05)
    ;(builder.sym(() =>
      builder.g(composeMatrix(samples[0] + 0.04, headSurface.cy + 0.03, samples[2] - 0.03, -24, 96, 0), () =>
        builder.extrude(
          [
            [-0.1, 0.09],
            [0.1, 0.09],
            [0.11, -0.03],
            [0.04, -0.13],
            [-0.06, -0.11],
            [-0.11, -0.01],
          ],
          0.022,
          0.009,
        ),
      ),
    ),
      builder.g(composeMatrix(0, headSurface.cy + 0, samples[2] - samples[1] - 0.045, -20, 180, 0), () =>
        builder.extrude(
          [
            [-0.15, 0.1],
            [0.15, 0.1],
            [0.17, -0.03],
            [0.08, -0.11],
            [-0.08, -0.11],
            [-0.17, -0.03],
          ],
          0.022,
          0.009,
        ),
      ))
  }
  builder.bind(makeChainColorBinder(addChainResult, entries, joints.head)).paint(WARRIOR_PALETTE.redLight, { c2: WARRIOR_PALETTE.red, mat: MATERIAL_KINDS.fur })
  const sumZ = headSurface.cy + 0.34
  ;(builder.ball(0, sumZ + 0.035, -0.015, 0.06, 0.05, 0.06, 1), emitTaperedTube(builder, [0, sumZ + 0.03, -0.015], [0, 1, -0.2], 0.22, 0.06, { n: 3, seg: 5, curl: [0, -0.1, -0.25], tip: 0.35 }))
  for (let index = 0; index < 7; index++) {
    const scaledValueX = (index / 7) * Math.PI * 2 + 0.5
    emitTaperedTube(builder, [Math.cos(scaledValueX) * 0.03, sumZ + 0.04, Math.sin(scaledValueX) * 0.03 - 0.015], [Math.cos(scaledValueX) * 0.9, 0.75, Math.sin(scaledValueX) * 0.9 - 0.1], 0.24, 0.05, {
      n: 3,
      seg: 4,
      curl: [Math.cos(scaledValueX) * 0.1, -1, Math.sin(scaledValueX) * 0.1],
      up: [-Math.sin(scaledValueX), 0, Math.cos(scaledValueX)],
      tip: 0.3,
    })
  }
  ;(builder.bone(joints.propR),
    builder.g(composeMatrix(-proportions.shoulderX, proportions.handY, 0), () => {
      ;(builder.paint(WARRIOR_PALETTE.shaft, { c2: 8010282, gloss: 0.35, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, 0, BODY_ANCHOR_HEIGHTS.butt + 0.06, 0.027],
            [0, 0, 0.3, 0.029],
            [0, 0, 1.18, 0.031],
          ],
          { seg: 6 },
        ),
        builder.paint(WARRIOR_PALETTE.leatherDark, { c2: WARRIOR_PALETTE.leather, gloss: 0.2, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, 0, -0.34, 0.033],
            [0, 0, 0.12, 0.034],
          ],
          { seg: 6, cap0: !1, cap1: !1 },
        ),
        builder.paint(WARRIOR_PALETTE.brass, { c2: WARRIOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, BODY_ANCHOR_HEIGHTS.butt - 0.07, 0.006],
            [0, 0, BODY_ANCHOR_HEIGHTS.butt, 0.04],
            [0, 0, BODY_ANCHOR_HEIGHTS.butt + 0.08, 0.034],
          ],
          { seg: 6, crease: 30 },
        ),
        builder.tube(
          [
            [0, 0, 1.12, 0.036],
            [0, 0, 1.16, 0.05],
            [0, 0, 1.5, 0.05],
            [0, 0, 1.54, 0.036],
          ],
          { seg: 6, crease: 30 },
        ),
        builder.paint(WARRIOR_PALETTE.steelDark, { c2: WARRIOR_PALETTE.steel, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, 1.53, 0.012, 0.03],
            [0, 0, 1.6, 0.014, 0.05],
            [0, 0, 1.76, 0.002, 0.004],
          ],
          { seg: 4, up: [1, 0, 0], crease: 0 },
        ),
        builder.tube(
          [
            [0, 0.03, BODY_ANCHOR_HEIGHTS.head, 0.016, 0.085],
            [0, 0.14, BODY_ANCHOR_HEIGHTS.head, 0.014, 0.06],
            [0, 0.3, BODY_ANCHOR_HEIGHTS.head + 0.02, 0.002, 0.004],
          ],
          { seg: 4, up: [1, 0, 0], crease: 0 },
        ))
      const weaponBaseY = BODY_ANCHOR_HEIGHTS.head,
        entriesX = [
          [0.13, 0.03],
          [0.17, 0.17],
          [0.3, 0.36],
          [0.42, 0.45],
          [0.38, 0.535],
          [0.25, 0.6],
          [0.085, 0.635],
          [-0.085, 0.635],
          [-0.25, 0.6],
          [-0.38, 0.535],
          [-0.42, 0.45],
          [-0.3, 0.36],
          [-0.17, 0.17],
          [-0.13, 0.03],
        ].map((samplesZ) => [weaponBaseY + samplesZ[0], samplesZ[1]])
      ;(builder.paint(WARRIOR_PALETTE.steelDark, { c2: WARRIOR_PALETTE.steel, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, 0, 0, 180, -90, 0), () => builder.extrude(entriesX, 0.062, 0.027)),
        builder.paint(WARRIOR_PALETTE.edge, { c2: 16769184, glow: 0.14, gloss: 1, mat: MATERIAL_KINDS.metal, line: 0 }))
      const entriesY = []
      for (let bladeSegment = 0; bladeSegment <= 8; bladeSegment++) {
        const ratioY = bladeSegment / 8,
          lerpedNear = lerpValue(-1, 1, ratioY)
        entriesY.push([0, -(0.635 - 0.19 * lerpedNear * lerpedNear) - 0.004, weaponBaseY + lerpedNear * 0.4, 0.012, 0.02 * (1 - 0.5 * lerpedNear * lerpedNear)])
      }
      builder.tube(entriesY, { seg: 4, up: [1, 0, 0], crease: 0 })
      for (const sideSign of [1, -1]) {
        ;(builder.paint(WARRIOR_PALETTE.brass, { c2: 16765562, gloss: 1, mat: MATERIAL_KINDS.metal, line: 0 }),
          builder.ball(sideSign * 0.034, -0.37, weaponBaseY, 0.016, 0.05, 0.05, 0, 180),
          builder.paint(WARRIOR_PALETTE.brassDark, { c2: WARRIOR_PALETTE.brass, gloss: 1, mat: MATERIAL_KINDS.metal, line: 0 }))
        for (let studIndex = 0; studIndex < 6; studIndex++) {
          const scaledValueZ = (studIndex / 6) * Math.PI * 2
          builder.ball(sideSign * 0.03, -0.37 + Math.cos(scaledValueZ) * 0.105, weaponBaseY + Math.sin(scaledValueZ) * 0.105, 0.008, 0.042, 0.042, 0, 180)
        }
      }
    }),
    builder.bind(makeChainColorBinder(tasselChain, entriesHeight, joints.propR)).paint(WARRIOR_PALETTE.redLight, { c2: WARRIOR_PALETTE.red, mat: MATERIAL_KINDS.fur }))
  for (let strandIndex = 0; strandIndex < 4; strandIndex++) {
    const scaledValueY = (strandIndex / 4) * Math.PI * 2 + 0.6
    emitTaperedTube(builder, [-proportions.shoulderX + Math.cos(scaledValueY) * 0.03, proportions.handY - 0.03, 1.1 + Math.sin(scaledValueY) * 0.03], [Math.cos(scaledValueY) * 0.25, -1, Math.sin(scaledValueY) * 0.25], 0.3, 0.036, { n: 3, seg: 4, tip: 0.3 })
  }
  return (builder.bakeGrounding(2.05), { h: skeleton, b: builder, extra: { gripR: gripRJoint, aim: aimJoint, gripL: gripLJoint } })
}

/**
 * 创建模型。
 *
 */
function buildArcherModel() {
  const skeleton = buildSkeleton(FENGLING_RIG_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    modelBuilder = new ModelBuilder(),
    bowMountX = proportions.shoulderX,
    bowMountY = proportions.handY,
    computed = 0.95,
    bowUpJoint = rig.add("bowUp", joints.propL, bowMountX, bowMountY, 0.12),
    bowDnJoint = rig.add("bowDn", joints.propL, bowMountX, bowMountY, -0.12),
    sum = rig.add("nock", joints.propL, bowMountX, bowMountY + FENGLING_BOW_SPEC.string, 0),
    sumX = rig.add("arrow", sum, bowMountX, bowMountY + FENGLING_BOW_SPEC.string, 0),
    capeAnchorPoints = (label) => [
      [label * 0.13, 1.36, -0.19],
      [label * 0.19, 1.14, -0.28],
      [label * 0.22, 0.92, -0.33],
      [label * 0.24, 0.7, -0.36],
    ],
    capeLChain = rig.addChain("capeL", joints.chest, capeAnchorPoints(1).slice(0, 3)),
    capeRChain = rig.addChain("capeR", joints.chest, capeAnchorPoints(-1).slice(0, 3))
  for (const chainJoints of [capeLChain, capeRChain])
    rig.chain({
      joints: chainJoints,
      tip: [0, -0.22, -0.03],
      stiffness: 4,
      drag: 0.91,
      gravity: 8,
      maxAngle: 70,
      wind: 2.4,
      colliders: [
        { joint: joints.hips, x: 0, y: -0.02, z: 0, r: 0.26 },
        { joint: joints.chest, x: 0, y: 0, z: 0, r: 0.22 },
      ],
    })
  const ratio = (primary, secondary) => {
    const items = primary >= 0 ? joints.thighL : joints.thighR
    return secondary >= 0.9 ? [joints.hips, joints.hips, 1] : [joints.hips, items, clampUnitInput((secondary - 0.52) / 0.38)]
  }
  modelBuilder.sym((sideSign) => {
    const hipX = proportions.hipX
    ;(modelBuilder.bone(sideSign > 0 ? joints.thighL : joints.thighR).paint(ROBE_COSTUME_PALETTE.pants, { c2: ROBE_COSTUME_PALETTE.pantsDark, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }), modelBuilder.limb([hipX, proportions.hipY + 0.04, 0], [hipX, proportions.kneeY, 0], 0.112, 0.086, { seg: 8, bulge: 0.04 }))
  })
  for (const legSide of [1, -1]) {
    ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, gloss: 0.25, mat: MATERIAL_KINDS.leather }), emitShinFoot(modelBuilder, skeleton, legSide, { top: 0.3, rTop: 0.088, rAnkle: 0.074, len: 0.23, toe: 0.02 }))
    const items = legSide > 0 ? joints.shinL : joints.shinR
    ;(modelBuilder.bone(items).paint(ROBE_COSTUME_PALETTE.wrap, { c2: ROBE_COSTUME_PALETTE.wrapDark, mat: MATERIAL_KINDS.cloth }),
      modelBuilder.lathe(
        [
          [0.28, 0.084, 0.084, legSide * proportions.hipX, 0],
          [0.33, 0.088, 0.088, legSide * proportions.hipX, 0],
          [0.43, 0.09, 0.09, legSide * proportions.hipX, 0],
          [0.46, 0.084, 0.084, legSide * proportions.hipX, 0],
        ],
        { seg: 8 },
      ),
      modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, mat: MATERIAL_KINDS.leather }),
      modelBuilder.g(composeMatrix(legSide * proportions.hipX, 0.37, 0, 12, 0, 0), () => modelBuilder.torus(0.091, 0.008, 0.011, 8, 3, { crease: 30 })))
  }
  {
    const entries = [
        [0.5, 0.2, 0.19, 0, 0],
        [0.62, 0.195, 0.18, 0, 0],
        [0.78, 0.18, 0.16, 0, 0],
        [0.92, 0.17, 0.14, 0, 0],
      ],
      scaledValueX = (primary, secondary) => 1 + (secondary < 2 ? 0.03 * Math.sin(primary * 6) : 0)
    ;(modelBuilder.bind(ratio).paint(ROBE_COSTUME_PALETTE.robe, { c2: ROBE_COSTUME_PALETTE.robeDark, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth, by: (primary, secondary) => (secondary - 0.5) / 0.4 }),
      modelBuilder.lathe(entries, { seg: 14, cap0: !1, cap1: !1, shape: scaledValueX }),
      modelBuilder.paint(ROBE_COSTUME_PALETTE.robeDark, { c2: ROBE_COSTUME_PALETTE.pantsDark, mat: MATERIAL_KINDS.cloth }),
      modelBuilder.lathe(
        [
          [0.49, 0.204, 0.194],
          [0.5, 0.208, 0.198],
          [0.55, 0.204, 0.192],
          [0.56, 0.198, 0.186],
        ],
        { seg: 14, cap0: !1, cap1: !1, shape: (angle) => 1 + 0.03 * Math.sin(angle * 6) },
      ))
  }
  const entriesX = [
      [0.84, 0.17, 0.14],
      [0.92, 0.172, 0.138],
      [1, 0.152, 0.118],
      [1.1, 0.172, 0.13],
      [1.21, 0.215, 0.152],
      [1.32, 0.22, 0.142],
      [1.385, 0.14, 0.108],
      [1.425, 0.072, 0.068],
    ],
    lerped = (profileHeight) => {
      for (let index = 1; index < entriesX.length; index++)
        if (profileHeight <= entriesX[index][0]) {
          const ratio = Math.max(0, (profileHeight - entriesX[index - 1][0]) / (entriesX[index][0] - entriesX[index - 1][0]))
          return [lerpValue(entriesX[index - 1][1], entriesX[index][1], ratio), lerpValue(entriesX[index - 1][2], entriesX[index][2], ratio)]
        }
      return [entriesX[entriesX.length - 1][1], entriesX[entriesX.length - 1][2]]
    },
    sumY = (entries, samples) => entries.map((primaryEnd, secondaryEnd) => [primaryEnd, lerped(primaryEnd)[0] + samples[secondaryEnd], lerped(primaryEnd)[1] + samples[secondaryEnd]])
  ;(modelBuilder.bind(makeTorsoColorBinder(skeleton)).paint(ROBE_COSTUME_PALETTE.robe, { c2: ROBE_COSTUME_PALETTE.robeDark, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
    modelBuilder.lathe(entriesX, { seg: 12 }),
    modelBuilder.bone(joints.neck).paint(ROBE_COSTUME_PALETTE.skin, { ao: 0.75, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    modelBuilder.lathe(
      [
        [1.4, 0.064, 0.064],
        [1.53, 0.062, 0.062],
      ],
      { seg: 8, cap0: !1 },
    ),
    modelBuilder.bone(joints.chest).paint(ROBE_COSTUME_PALETTE.robeDark, { c2: ROBE_COSTUME_PALETTE.pantsDark, mat: MATERIAL_KINDS.cloth }),
    modelBuilder.tube(
      [
        [0.07, 1.445, 0.05, 0.026, 0.01],
        [0.04, 1.39, 0.115, 0.028, 0.01],
        [-0.02, 1.33, 0.135, 0.028, 0.01],
      ],
      { seg: 4, up: [1, 0.4, 0] },
    ),
    modelBuilder.tube(
      [
        [-0.07, 1.445, 0.05, 0.026, 0.01],
        [-0.045, 1.4, 0.108, 0.026, 0.01],
      ],
      { seg: 4, up: [1, -0.4, 0] },
    ),
    modelBuilder.bind(makeTorsoColorBinder(skeleton)).paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leatherLight, gloss: 0.25, ao: 0.82, ao2: 1, mat: MATERIAL_KINDS.leather, pattern: TERRAIN_LOOK.scale, patternScale: 13, patternAmt: 0.3 }),
    modelBuilder.lathe(sumY([1.03, 1.06, 1.15, 1.25, 1.33, 1.37], [0.008, 0.024, 0.022, 0.02, 0.018, 0.008]), { seg: 12, cap0: !1, cap1: !1 }),
    modelBuilder.bone(joints.chest).paint(ROBE_COSTUME_PALETTE.iron, { c2: ROBE_COSTUME_PALETTE.ironLight, gloss: 0.8, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 16, patternAmt: 0.35 }),
    modelBuilder.sheet(4, 2, (primaryNear, secondaryNear) => {
      const lerpedFar = lerpValue(58, 122, primaryNear) * FENGLING_DEG_TO_RAD,
        lerpedTop = lerpValue(1.3, 1.17, secondaryNear),
        gResult = lerped(lerpedTop)
      return [Math.cos(lerpedFar) * (gResult[0] + 0.028), lerpedTop + (Math.round(primaryNear * 4) % 2 ? 0.006 : 0), Math.sin(lerpedFar) * (gResult[1] + 0.028)]
    }),
    modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, gloss: 0.3, mat: MATERIAL_KINDS.leather }),
    modelBuilder.tube(
      [
        [0.2, 1.37, 0.07, 0.03, 0.012],
        [0.08, 1.26, 0.17, 0.032, 0.012],
        [-0.08, 1.12, 0.165, 0.032, 0.012],
        [-0.18, 1.04, 0.08, 0.03, 0.012],
      ],
      { seg: 4, up: [0, 0.6, 0.8] },
    ),
    modelBuilder.tube(
      [
        [-0.2, 1.37, 0.07, 0.03, 0.012],
        [-0.08, 1.26, 0.17, 0.032, 0.012],
        [0.08, 1.12, 0.165, 0.032, 0.012],
        [0.18, 1.04, 0.08, 0.03, 0.012],
      ],
      { seg: 4, up: [0, 0.6, 0.8] },
    ),
    modelBuilder.paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    modelBuilder.ball(0, 1.19, 0.182, 0.032, 0.032, 0.016, 0),
    modelBuilder.bone(joints.spine).paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, gloss: 0.3, mat: MATERIAL_KINDS.leather }),
    modelBuilder.lathe(
      [
        [0.93, 0.178, 0.146],
        [0.945, 0.186, 0.152],
        [1, 0.168, 0.136],
        [1.015, 0.16, 0.13],
      ],
      { seg: 12 },
    ),
    modelBuilder.paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    modelBuilder.g(composeMatrix(0, 0.97, 0.15, 0, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.05, 0.012],
          [0.03, 0.022],
          [0.055, 0],
          [0.03, -0.022],
          [-0.05, -0.012],
        ],
        0.02,
        0.006,
      ),
    ))
  const emitArmGuard = (coordX, coordY, coordZ, guardHeight, guardHalfWidth, guardHalfDepth, tiltAngle, armorColor, armorHighlight, armorMaterial) => {
    ;(modelBuilder.bone(coordX).paint(armorColor, { c2: armorHighlight, gloss: armorMaterial === MATERIAL_KINDS.metal ? 0.8 : 0.25, ao: 0.82, ao2: 1, mat: armorMaterial, pattern: TERRAIN_LOOK.scale, patternScale: 14, patternAmt: 0.3 }),
      modelBuilder.g(composeMatrix(coordY, coordZ, 0, 0, 0, tiltAngle), () => {
        modelBuilder.lathe(
          [
            [-guardHalfWidth * 0.34, guardHeight, guardHalfDepth],
            [-guardHalfWidth * 0.1, guardHeight * 1.02, guardHalfDepth * 1.02],
            [guardHalfWidth * 0.6, guardHeight * 0.72, guardHalfDepth * 0.72],
            [guardHalfWidth, guardHeight * 0.2, guardHalfDepth * 0.2],
          ],
          { seg: 9, crease: 50 },
        )
      }))
  }
  ;(emitArmGuard(joints.clavL, 0.33, 1.42, 0.15, 0.075, 0.15, -22, ROBE_COSTUME_PALETTE.leatherDark, ROBE_COSTUME_PALETTE.leatherLight, MATERIAL_KINDS.leather),
    emitArmGuard(joints.armL, 0.37, 1.3, 0.12, 0.06, 0.125, -42, ROBE_COSTUME_PALETTE.iron, ROBE_COSTUME_PALETTE.ironLight, MATERIAL_KINDS.metal),
    modelBuilder.bone(joints.armL).paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    modelBuilder.g(composeMatrix(0.37, 1.3, 0, 0, 0, -42), () =>
      modelBuilder.lathe(
        [
          [-0.026, 0.118, 0.123],
          [-0.016, 0.128, 0.133],
          [-0.006, 0.122, 0.127],
        ],
        { seg: 9, cap0: !1, cap1: !1, crease: 30 },
      ),
    ),
    modelBuilder.sym((sideSign) => {
      const armX = proportions.shoulderX
      ;(modelBuilder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(ROBE_COSTUME_PALETTE.robe, { c2: ROBE_COSTUME_PALETTE.robeDark, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth }),
        modelBuilder.ball(armX, proportions.shoulderY, 0, 0.082, 0.08, 0.082, 1),
        modelBuilder.limb([armX, proportions.shoulderY, 0], [armX, proportions.elbowY, 0], 0.076, 0.064, { seg: 8 }),
        modelBuilder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
        emitScaledTorus(modelBuilder, armX, proportions.elbowY + 0.1, 0, 0.07, 0.07, 0.012, 0.03, 8),
        modelBuilder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(ROBE_COSTUME_PALETTE.robe, { c2: ROBE_COSTUME_PALETTE.robeDark, mat: MATERIAL_KINDS.cloth }),
        modelBuilder.ball(armX, proportions.elbowY, 0, 0.064, 0.064, 0.064, 1),
        modelBuilder.limb([armX, proportions.elbowY, 0], [armX, proportions.wristY, 0], 0.06, 0.052, { seg: 8 }),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.leather, { c2: ROBE_COSTUME_PALETTE.leatherDark, gloss: 0.25, mat: MATERIAL_KINDS.leather }))
      const itemsX = sideSign > 0 ? 0.24 : 0.1
      ;(modelBuilder.lathe(
        [
          [proportions.wristY - 0.01, 0.058, 0.058, armX, 0],
          [proportions.wristY + 0.02, 0.07, 0.07, armX, 0],
          [proportions.wristY + itemsX, 0.074, 0.074, armX, 0],
          [proportions.wristY + itemsX + 0.014, 0.062, 0.062, armX, 0],
        ],
        { seg: 8 },
      ),
        sideSign > 0 && (modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, mat: MATERIAL_KINDS.leather }), emitScaledTorus(modelBuilder, armX, proportions.wristY + 0.12, 0, 0.074, 0.074, 0.008, 0.012, 8)))
    }),
    modelBuilder.paint(ROBE_COSTUME_PALETTE.skin, { glow: 0.06, ao: 0.9, mat: MATERIAL_KINDS.skin }),
    emitHand(modelBuilder, skeleton, 1, 0.056),
    emitHand(modelBuilder, skeleton, -1, 0.056),
    modelBuilder.bone(joints.handR).paint(ROBE_COSTUME_PALETTE.jade, { c2: 13031104, gloss: 0.9, mat: MATERIAL_KINDS.crystal }),
    modelBuilder.g(composeMatrix(-proportions.shoulderX + 0.012, proportions.handY + 0.02, 0.05, 70, 0, -20), () => modelBuilder.torus(0.017, 0.008, 0.008, 8, 3, { crease: 40 })),
    modelBuilder.bone(joints.chest).paint(ROBE_COSTUME_PALETTE.robeDark, { c2: ROBE_COSTUME_PALETTE.robe, ao: 0.9, mat: MATERIAL_KINDS.cloth }),
    modelBuilder.sheet(8, 2, (primaryFar, secondaryFar) => {
      const lerpedBottom = lerpValue(200, 340, primaryFar) * FENGLING_DEG_TO_RAD,
        robeHemProfile = [
          [1.45, 0.11, 0.1],
          [1.4, 0.25, 0.18],
          [1.33, 0.29, 0.22],
        ][Math.round(secondaryFar * 2)]
      return [Math.cos(lerpedBottom) * robeHemProfile[1], robeHemProfile[0], Math.sin(lerpedBottom) * robeHemProfile[2] - 0.02]
    }),
    modelBuilder.paint(ROBE_COSTUME_PALETTE.lining, { c2: ROBE_COSTUME_PALETTE.liningShade, mat: MATERIAL_KINDS.cloth }),
    modelBuilder.g(composeMatrix(0, 1.455, -0.02, 10, 0, 0, 1, 1, 0.9), () => modelBuilder.torus(0.105, 0.03, 0.028, 10, 4)))
  // 数组字面量默认推断为 (number | number[])[][]，断言为元组还原 inputValue: number
  for (const [capeChain, capeSide] of [
    [capeLChain, 1],
    [capeRChain, -1],
  ] as [number[], number][]) {
    const hResult = capeAnchorPoints(capeSide),
      ribbonWidthAt = (progress) => lerpNumeric(0.13, 0.17, progress)
    ;(modelBuilder.bind(makeChainColorBinder(capeChain, hResult, joints.chest)).paint(ROBE_COSTUME_PALETTE.robe, { c2: ROBE_COSTUME_PALETTE.robeDark, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(
        modelBuilder,
        hResult.map((samplesWidth) => [samplesWidth[0], samplesWidth[1], samplesWidth[2] - 0.01]),
        { width: ribbonWidthAt, axis: [1, 0, capeSide * 0.35], bow: [0, 0, -0.03], nu: 3, nv: 6, tail: "flat", wave: 0.2 },
      ),
      modelBuilder.paint(ROBE_COSTUME_PALETTE.lining, { c2: ROBE_COSTUME_PALETTE.liningShade, mat: MATERIAL_KINDS.cloth }))
    const entriesY = [0, 0.3, 0.6, 0.86].map((sampleRatio) => sampleColorGradient(hResult, sampleRatio))
    ;(emitGradientRibbon(
      modelBuilder,
      entriesY.map((samplesHeight) => [samplesHeight[0], samplesHeight[1], samplesHeight[2] + 0.006]),
      { width: (ribbonProgress) => ribbonWidthAt(ribbonProgress * 0.86), axis: [1, 0, capeSide * 0.35], bow: [0, 0, -0.03], nu: 3, nv: 5, tail: "flat" },
    ),
      modelBuilder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(
        modelBuilder,
        [sampleColorGradient(hResult, 0.86), sampleColorGradient(hResult, 0.93), sampleColorGradient(hResult, 1)].map((samplesDepth) => [samplesDepth[0], samplesDepth[1], samplesDepth[2] + 0.006]),
        { width: (ribbonProgress) => ribbonWidthAt(0.86 + ribbonProgress * 0.14), axis: [1, 0, capeSide * 0.35], bow: [0, 0, -0.03], nu: 3, nv: 2, tail: "flat" },
      ))
  }
  ;(modelBuilder.bone(joints.hips),
    modelBuilder.g(composeMatrix(-0.25, 0.86, -0.1, -32, 0, 26), () => {
      ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { c2: ROBE_COSTUME_PALETTE.leather, gloss: 0.3, mat: MATERIAL_KINDS.leather }),
        modelBuilder.lathe(
          [
            [-0.34, 0.035, 0.03],
            [-0.3, 0.06, 0.05],
            [0.12, 0.078, 0.06],
            [0.2, 0.085, 0.066],
          ],
          { seg: 8, cap1: !1 },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        emitScaledTorus(modelBuilder, 0, 0.19, 0, 0.088, 0.068, 0.01, 0.016, 8),
        emitScaledTorus(modelBuilder, 0, -0.2, 0, 0.072, 0.058, 0.008, 0.012, 8))
      for (let featherIndex = 0; featherIndex < 7; featherIndex++) {
        const lerpedInner = lerpValue(-0.055, 0.055, featherIndex / 6),
          itemsY = featherIndex % 2 ? 0.018 : -0.016,
          scaledValueWidth = 0.44 + (featherIndex % 3) * 0.025
        ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.shaft, { c2: 10125376, mat: MATERIAL_KINDS.leather }),
          modelBuilder.tube(
            [
              [lerpedInner, 0.1, itemsY, 0.007],
              [lerpedInner * 1.2, scaledValueWidth, itemsY, 0.007],
            ],
            { seg: 3 },
          ),
          modelBuilder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
          modelBuilder.tube(
            [
              [lerpedInner * 1.2, scaledValueWidth - 0.2, itemsY, 0.011],
              [lerpedInner * 1.2, scaledValueWidth - 0.18, itemsY, 0.011],
            ],
            { seg: 3 },
          ),
          modelBuilder.paint(ROBE_COSTUME_PALETTE.feather, { c2: ROBE_COSTUME_PALETTE.featherShade, mat: MATERIAL_KINDS.fur, line: 0 }),
          modelBuilder.g(composeMatrix(lerpedInner * 1.2, scaledValueWidth - 0.07, itemsY, 0, 60 + featherIndex * 20, 0), () =>
            modelBuilder.extrude(
              [
                [-0.04, -0.1],
                [0.04, -0.1],
                [0.045, 0.07],
                [0, 0.1],
                [-0.045, 0.07],
              ],
              0.006,
              0,
            ),
          ))
      }
    }),
    modelBuilder.g(composeMatrix(0.2, 0.9, 0.02, 64, 0, -14), () => {
      ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.lacquerDark, { c2: ROBE_COSTUME_PALETTE.lacquer, gloss: 0.6, mat: MATERIAL_KINDS.leather }),
        modelBuilder.tube(
          [
            [0, 0, -0.04, 0.022, 0.012],
            [0, 0, 0.42, 0.024, 0.012],
            [0, -0.01, 0.48, 0.012, 0.008],
          ],
          { seg: 4, up: [0, 1, 0] },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.leatherDark, { mat: MATERIAL_KINDS.leather }),
        modelBuilder.tube(
          [
            [0, 0, -0.06, 0.016],
            [0, 0, -0.2, 0.016],
          ],
          { seg: 5 },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.iron, { c2: ROBE_COSTUME_PALETTE.ironLight, gloss: 0.8, mat: MATERIAL_KINDS.metal }),
        modelBuilder.g(composeMatrix(0, 0, -0.24, 90, 0, 0), () => modelBuilder.torus(0.035, 0.009, 0.009, 6, 3, { crease: 30 })))
    }))
  const headSurface = buildHeadSurface(modelBuilder, skeleton, ROBE_COSTUME_PALETTE.skin, computed, 0.25, 1.04),
    headCenterY = headSurface.cy
  ;(buildFaceFeatures(modelBuilder, skeleton, headSurface, {
    iris: 2759700,
    irisGlow: 0.05,
    irisSize: 0.62,
    brow: ROBE_COSTUME_PALETTE.hair,
    browTilt: 14,
    browH: 0.022,
    browLen: 1.1,
    eyeW: 0.052,
    eyeH: 0.034,
    slant: 6,
    lash: 0.017,
    lip: 10115656,
    skin: ROBE_COSTUME_PALETTE.skin,
    nose: 1,
    ears: !0,
    mouthW: 0.95,
    smile: -0.15,
    lite: !0,
  }),
    emitHeadFurMane(modelBuilder, skeleton, headSurface, {
      c: ROBE_COSTUME_PALETTE.hair,
      c2: ROBE_COSTUME_PALETTE.hairHi,
      thick: 0.024,
      gloss: 0.2,
      line: (heightRatio) => (heightRatio < 0.85 ? 0.17 - 0.015 * Math.cos((heightRatio / 0.85) * Math.PI * 0.5) : heightRatio < 1.4 ? lerpNumeric(0.16, -0.06, (heightRatio - 0.85) / 0.55) : -0.28),
    }),
    emitFacialFur(modelBuilder, skeleton, headSurface, { c: ROBE_COSTUME_PALETTE.hair, c2: ROBE_COSTUME_PALETTE.hairHi, spread: 0, tufts: 1, len: 0.075, tuftR: 0.026, puff: 0.1, mustache: 0.075, mustacheR: 0.012, curl: -0.012, gloss: 0.1, tuftSeg: 4 }),
    modelBuilder.bone(joints.head).paint(ROBE_COSTUME_PALETTE.hairHi, { c2: ROBE_COSTUME_PALETTE.hair, mat: MATERIAL_KINDS.fur }),
    modelBuilder.sym(() => {
      const sumEnd = headCenterY + 0.02,
        samplesStart = headSurface.ring(0.02)
      modelBuilder.tube(
        [
          [samplesStart[0] * 0.95, sumEnd + 0.07, samplesStart[2] + samplesStart[1] * 0.26, 0.01, 0.022],
          [samplesStart[0] * 0.98, sumEnd - 0, samplesStart[2] + samplesStart[1] * 0.28, 0.01, 0.02],
          [samplesStart[0] * 0.92, sumEnd - 0.06, samplesStart[2] + samplesStart[1] * 0.32, 0.004, 0.008],
        ],
        { seg: 4, crease: 180, up: [0, 0, 1] },
      )
    }))
  {
    const sumZ = (primary, secondary) => {
      const samples = headSurface.ring(primary * computed)
      return [headCenterY + primary * computed, samples[0] + secondary, samples[1] + secondary, 0, samples[2]]
    }
    ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.cap, { c2: ROBE_COSTUME_PALETTE.capHi, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
      modelBuilder.lathe([sumZ(0.13, 0.012), sumZ(0.15, 0.016), sumZ(0.17, 0.014)], { seg: 14, cap0: !1, cap1: !1, crease: 40 }),
      modelBuilder.g(composeMatrix(0, headCenterY + 0.19, -0.1, -24, 0, 0), () => {
        modelBuilder.lathe(
          [
            [-0.06, 0.11, 0.11],
            [0.04, 0.105, 0.11],
            [0.11, 0.085, 0.095],
            [0.15, 0.05, 0.06],
            [0.165, 0.02, 0.02],
          ],
          { seg: 10, crease: 50 },
        )
      }),
      modelBuilder.paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
      modelBuilder.sym(() => modelBuilder.ball(0.13, headCenterY + 0.22, -0.06, 0.022, 0.022, 0.014, 0)))
    for (const tailSide of [1, -1]) {
      const scaledValueY = (kills) => {
          const tailProgressSquared = kills * kills
          return [tailSide * (0.075 + 0.6 * (0.2 * kills + 0.1 * tailProgressSquared)), headCenterY + 0.26 + 0.6 * (0.66 * kills - 0.34 * tailProgressSquared), -0.13 - 0.6 * (0.5 * kills + 0.46 * tailProgressSquared)]
        },
        scaledValueZ = (deaths) => 0.012 + 0.038 * Math.pow(Math.sin(Math.PI * 0.86 * Math.pow(deaths, 0.7)), 0.8) * (1 - 0.3 * deaths),
        entriesZ = []
      for (let index = 0; index <= 8; index++) {
        const ratioX = index / 8,
          aResult = scaledValueY(ratioX)
        entriesZ.push([aResult[0], aResult[1], aResult[2], index === 8 ? 0.004 : scaledValueZ(ratioX), 0.006])
      }
      ;(modelBuilder.paint(ROBE_COSTUME_PALETTE.pheasant, { c2: ROBE_COSTUME_PALETTE.pheasantTip, mat: MATERIAL_KINDS.fur, by: (coordX, coordY, coordZ, chainFraction) => Math.min(1, (Math.round(chainFraction * 8) % 2 === 1 ? 0.7 : 0) + Math.max(0, chainFraction - 0.66) * 2.6) }),
        modelBuilder.tube(entriesZ, { seg: 4, up: [tailSide, 0, 0], crease: 180, cap0: !1 }),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.bone, { c2: ROBE_COSTUME_PALETTE.pheasant, mat: MATERIAL_KINDS.fur, line: 0 }),
        modelBuilder.tube(
          entriesZ.slice(0, 8).map((samplesEnd, secondaryTop) => [samplesEnd[0], samplesEnd[1], samplesEnd[2], 0.005 * (1 - (secondaryTop / 8) * 0.6), 0.011]),
          { seg: 4, up: [tailSide, 0, 0], crease: 180, cap0: !1, cap1: !1 },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.brass, { c2: ROBE_COSTUME_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        modelBuilder.limb(scaledValueY(-0.06), scaledValueY(0.07), 0.02, 0.017, { seg: 4, cap0: !1 }))
    }
  }
  const scaledValueWidth = (progress) => -0.04 + (FENGLING_BOW_SPEC.string + 0.04) * (progress * progress * 0.7 + 0.3 * Math.pow(progress, 4)),
    lerpedX = (coordX, coordY, coordZ) => {
      const entries = []
      for (let index = 0; index <= 6; index++) {
        const lerped = lerpValue(coordY, coordZ, index / 6),
          sum = coordX * (0.06 + lerped * (FENGLING_BOW_SPEC.tip - 0.06))
        entries.push([0, scaledValueWidth(lerped), sum, lerpValue(0.028, 0.016, lerped), lerpValue(0.036, 0.02, lerped)])
      }
      return entries
    }
  return (
    modelBuilder.g(composeMatrix(bowMountX, bowMountY, 0), () => {
      ;(modelBuilder.bone(joints.propL).paint(ROBE_COSTUME_PALETTE.silk, { c2: 6953492, gloss: 0.2, mat: MATERIAL_KINDS.cloth }),
        modelBuilder.tube(
          [
            [0, -0.04, -0.11, 0.026, 0.03],
            [0, -0.045, 0, 0.03, 0.034],
            [0, -0.04, 0.11, 0.026, 0.03],
          ],
          { seg: 6 },
        ))
      for (const bowEndSign of [1, -1]) {
        const itemsZ = bowEndSign > 0 ? bowUpJoint : bowDnJoint
        ;(modelBuilder.bind((coordXX, coordYX, coordZX) => [itemsZ, joints.propL, clampUnitInput((Math.abs(coordZX) - 0.1) / 0.14)]),
          modelBuilder.paint(ROBE_COSTUME_PALETTE.lacquer, { c2: ROBE_COSTUME_PALETTE.lacquerDark, gloss: 0.6, mat: MATERIAL_KINDS.leather }),
          modelBuilder.tube(lerpedX(bowEndSign, 0, 1), { seg: 5, up: [1, 0, 0] }),
          modelBuilder.bone(itemsZ).paint(ROBE_COSTUME_PALETTE.bone, { c2: 12562056, gloss: 0.9, mat: MATERIAL_KINDS.crystal }))
        const scaledValueHeight = bowEndSign * FENGLING_BOW_SPEC.tip
        ;(modelBuilder.tube(
          [
            [0, FENGLING_BOW_SPEC.string, scaledValueHeight - bowEndSign * 0.03, 0.016, 0.02],
            [0, FENGLING_BOW_SPEC.string - 0.015, scaledValueHeight + bowEndSign * 0.05, 0.014, 0.018],
            [0, FENGLING_BOW_SPEC.string - 0.07, scaledValueHeight + bowEndSign * 0.12, 0.008, 0.01],
          ],
          { seg: 4, up: [1, 0, 0] },
        ),
          modelBuilder.paint(ROBE_COSTUME_PALETTE.bone, { c2: 11048044, gloss: 0.7, mat: MATERIAL_KINDS.crystal, line: 0 }),
          modelBuilder.tube(
            lerpedX(bowEndSign, 0.25, 0.55).map((samplesNear) => [samplesNear[0], samplesNear[1] + 0.012, samplesNear[2], samplesNear[3] * 0.6, samplesNear[4] * 1.04]),
            { seg: 3, up: [1, 0, 0] },
          ))
      }
      const ratioZ = (coordX, coordY, coordZ) => [coordZ >= 0 ? bowUpJoint : bowDnJoint, sum, clampUnitInput(Math.abs(coordZ) / FENGLING_BOW_SPEC.tip)]
      modelBuilder.bind(ratioZ).paint(15919830, { line: 0, mat: MATERIAL_KINDS.cloth })
      const entriesZ = []
      for (let stringSegment = 0; stringSegment <= 8; stringSegment++) entriesZ.push([0, FENGLING_BOW_SPEC.string, lerpValue(-0.86, FENGLING_BOW_SPEC.tip, stringSegment / 8), 0.005])
      ;(modelBuilder.tube(entriesZ, { seg: 3, up: [1, 0, 0] }),
        modelBuilder.bone(sumX).paint(ROBE_COSTUME_PALETTE.shaft, { c2: 10125376, mat: MATERIAL_KINDS.leather }),
        modelBuilder.tube(
          [
            [0, FENGLING_BOW_SPEC.string, 0, 0.009],
            [0, -0.78, 0, 0.009],
          ],
          { seg: 4 },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.head, { c2: 12113116, gloss: 1, glow: 0.18, mat: MATERIAL_KINDS.metal }),
        modelBuilder.g(composeMatrix(0, -0.78, 0, 180, 0, 0), () => modelBuilder.crystal(0.028, 0.12, 4, 0.75, 0.05)),
        modelBuilder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
        modelBuilder.tube(
          [
            [0, 0.02, 0, 0.012],
            [0, 0, 0, 0.012],
          ],
          { seg: 4 },
        ),
        modelBuilder.paint(ROBE_COSTUME_PALETTE.feather, { c2: ROBE_COSTUME_PALETTE.featherShade, mat: MATERIAL_KINDS.fur, line: 0 }))
      for (let bladeIndex = 0; bladeIndex < 3; bladeIndex++)
        modelBuilder.g(composeMatrix(0, 0.11, 0, 0, bladeIndex * 120, 0), () =>
          modelBuilder.extrude(
            [
              [0, -0.07],
              [0.04, -0.04],
              [0.04, 0.05],
              [0, 0.07],
            ],
            0.006,
            0,
          ),
        )
    }),
    modelBuilder.bakeGrounding(2.05, 0.75, 0.9),
    { h: skeleton, b: modelBuilder, extra: { bowUp: bowUpJoint, bowDn: bowDnJoint, nock: sum, arrow: sumX } }
  )
}

function emitScallopedSkirt(builder, featureSpec) {
  const computed = featureSpec.a0 ?? 0,
    computedX = featureSpec.a1 ?? 360,
    skirtSegmentCount = featureSpec.n * 2,
    computedY = featureSpec.scallop ?? 0.016,
    computedZ = featureSpec.groove ?? 0.012,
    computedWidth = featureSpec.lip ?? 0.014
  builder.sheet(
    skirtSegmentCount,
    2,
    (primaryTop, secondaryBottom) => {
      const scaledValueDepth = Math.round(primaryTop * skirtSegmentCount) % 2 === 0,
        scaledValueStart = (computed + (computedX - computed) * primaryTop) * DEG2RAD,
        scaledValueEnd = (scaledValueDepth ? -computedZ : 0) + (secondaryBottom > 0.4 ? computedWidth * (secondaryBottom > 0.9 ? 1 : 0.7) : 0),
        lerpedOuter = lerpValue(featureSpec.top[0], featureSpec.bot[0], secondaryBottom) + scaledValueEnd,
        lerpedV2 = lerpValue(featureSpec.top[1], featureSpec.bot[1], secondaryBottom) + scaledValueEnd,
        lerpedV3 = lerpValue(featureSpec.yTop, featureSpec.yBot, secondaryBottom) + (secondaryBottom > 0.9 && scaledValueDepth ? computedY : 0)
      return [(featureSpec.cx ?? 0) + Math.cos(scaledValueStart) * lerpedOuter, lerpedV3, (featureSpec.cz ?? 0) + Math.sin(scaledValueStart) * lerpedV2]
    },
    featureSpec.double ?? !1,
    34,
  )
}

/**
 * 创建模型。
 *
 */
function buildShieldBearerModel() {
  const skeleton = buildSkeleton(RIG_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    builder = new ModelBuilder()
  builder.crease = 36
  const shieldJoint = rig.add("shield", joints.foreL, proportions.shoulderX + 0.17, 0.9, 0.03),
    entries = [
      [0, 0.86, 0.285],
      [0, 0.64, 0.31],
      [0, 0.44, 0.315],
      [0, 0.27, 0.315],
    ],
    tabChain = rig.addChain("tab", joints.hips, entries.slice(0, 3))
  rig.chain({ joints: tabChain, tip: [0, -0.17, 0], stiffness: 9, drag: 0.85, gravity: 10, maxAngle: 45 })
  const entriesX = [
      [0, 0.86, -0.27],
      [0, 0.62, -0.31],
      [0, 0.4, -0.32],
      [0, 0.22, -0.32],
    ],
    tailChain = rig.addChain("tail", joints.hips, entriesX.slice(0, 3))
  rig.chain({ joints: tailChain, tip: [0, -0.18, 0], stiffness: 8, drag: 0.86, gravity: 10, maxAngle: 50 })
  const computed = 1.12,
    maneBaseY = proportions.headY + 0.25 * computed,
    entriesY = [
      [0, maneBaseY + 0.2 * computed, -0.06],
      [0, maneBaseY + 0.4 * computed, -0.2],
      [0, maneBaseY + 0.58 * computed, -0.36],
    ],
    maneChain = rig.addChain("mane", joints.head, entriesY.slice(0, 2))
  ;(rig.chain({ joints: maneChain, tip: [0, 0.2, -0.16], stiffness: 16, drag: 0.8, gravity: 3, maxAngle: 26, wind: 0.8 }),
    builder.sym((sideSign) => {
      const hipX = proportions.hipX
      ;(builder.bone(sideSign > 0 ? joints.thighL : joints.thighR).paint(UNIT_PALETTE.clothDark, { c2: UNIT_PALETTE.cloth, ao: 0.85, ao2: 1, mat: MATERIAL_KINDS.cloth }),
        builder.limb([hipX, proportions.hipY + 0.06, 0], [hipX, proportions.kneeY - 0.02, 0], 0.19, 0.155, { seg: 7 }),
        builder.bone(sideSign > 0 ? joints.shinL : joints.shinR).paint(UNIT_PALETTE.leatherDark, { c2: UNIT_PALETTE.leather, gloss: 0.2, mat: MATERIAL_KINDS.leather }),
        builder.lathe(
          [
            [proportions.ankleY - 0.01, 0.135, 0.145, hipX, 0],
            [0.22, 0.156, 0.168, hipX, -0.008],
            [0.44, 0.158, 0.16, hipX, 0],
            [0.47, 0.12, 0.12, hipX, 0],
          ],
          { seg: 8 },
        ),
        builder.paint(UNIT_PALETTE.clothLight, { c2: UNIT_PALETTE.cloth, mat: MATERIAL_KINDS.cloth }))
      for (const cuffY of [0.17, 0.29])
        builder.lathe(
          [
            [cuffY, 0.158, 0.168, hipX, -0.006],
            [cuffY + 0.035, 0.162, 0.171, hipX, -0.006],
          ],
          { seg: 8, cap0: !1, cap1: !1 },
        )
      ;(builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.ball(hipX, 0.43, 0.15, 0.04, 0.045, 0.025, 0),
        builder.bone(sideSign > 0 ? joints.footL : joints.footR).paint(1906194, { c2: UNIT_PALETTE.leatherDark, gloss: 0.25, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [hipX, 0.07, -0.17, 0.12, 0.07],
            [hipX, 0.09, -0.02, 0.15, 0.09],
            [hipX, 0.08, 0.22, 0.16, 0.08],
            [hipX, 0.07, 0.35, 0.14, 0.055],
          ],
          { seg: 8, power: 3.2, up: [1, 0, 0] },
        ))
    }))
  const entriesZ = [
      [0.64, 0.2, 0.17],
      [0.74, 0.33, 0.26],
      [0.9, 0.345, 0.275],
      [1, 0.335, 0.272],
      [1.14, 0.385, 0.3],
      [1.3, 0.43, 0.325],
      [1.42, 0.415, 0.3],
      [1.5, 0.29, 0.23],
      [1.57, 0.15, 0.14],
    ],
    lerped = (profileHeight) => {
      for (let index = 1; index < entriesZ.length; index++)
        if (profileHeight <= entriesZ[index][0]) {
          const clampUnitInputResult = clampUnitInput((profileHeight - entriesZ[index - 1][0]) / (entriesZ[index][0] - entriesZ[index - 1][0]))
          return [lerpValue(entriesZ[index - 1][1], entriesZ[index][1], clampUnitInputResult), lerpValue(entriesZ[index - 1][2], entriesZ[index][2], clampUnitInputResult)]
        }
      return [entriesZ[entriesZ.length - 1][1], entriesZ[entriesZ.length - 1][2]]
    },
    sum = (samples, secondary) => [samples[0] + secondary, samples[1] + secondary]
  ;(builder.bind(makeTorsoColorBinder(skeleton)).paint(UNIT_PALETTE.clothDark, { c2: UNIT_PALETTE.cloth, ao: 0.85, ao2: 1, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(entriesZ, { seg: 12 }),
    builder.bone(joints.chest).paint(UNIT_PALETTE.clothLight, { c2: UNIT_PALETTE.cloth, mat: MATERIAL_KINDS.cloth }),
    builder.g(composeMatrix(0, 1.535, 0.01, 14, 0, 0, 1, 1, 0.92), () => builder.torus(0.17, 0.05, 0.04, 10, 4)),
    builder.bone(joints.neck).paint(UNIT_PALETTE.skin, { ao: 0.72, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      [
        [1.5, 0.125, 0.125],
        [1.66, 0.118, 0.122],
      ],
      { seg: 9, cap0: !1 },
    ),
    [
      [1.475, 1.3, joints.chest],
      [1.325, 1.165, joints.chest],
      [1.185, 1.045, joints.spine],
      [1.065, 0.94, joints.spine],
    ].forEach(([coordXY, coordYY, coordZY], skirtLayer) => {
      if (
        (builder.bone(coordZY).paint(UNIT_PALETTE.ironDark, { c2: UNIT_PALETTE.ironLight, gloss: 0.4, ao: 0.7, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 9, patternAmt: 0.25 }),
        emitScallopedSkirt(builder, { yTop: coordXY, yBot: coordYY, top: sum(lerped(coordXY), skirtLayer === 0 ? 0.012 : 0.02), bot: sum(lerped(coordYY), 0.03), n: 8 }),
        skirtLayer > 0)
      ) {
        builder.paint(UNIT_PALETTE.red, { c2: UNIT_PALETTE.redDark, mat: MATERIAL_KINDS.cloth })
        const samplesFar = sum(lerped(coordXY - 0.012), 0.034)
        builder.lathe(
          [
            [coordXY - 0.026, samplesFar[0], samplesFar[1]],
            [coordXY - 0.004, samplesFar[0], samplesFar[1]],
          ],
          { seg: 12, cap0: !1, cap1: !1 },
        )
      }
    }),
    builder.bone(joints.spine).paint(UNIT_PALETTE.leather, { c2: UNIT_PALETTE.leatherDark, gloss: 0.2, mat: MATERIAL_KINDS.leather }))
  {
    const pResult = sum(lerped(0.89), 0.04),
      pPResult = sum(lerped(0.99), 0.04)
    builder.lathe(
      [
        [0.875, pResult[0] - 0.012, pResult[1] - 0.012],
        [0.89, pResult[0], pResult[1]],
        [0.99, pPResult[0], pPResult[1]],
        [1.005, pPResult[0] - 0.012, pPResult[1] - 0.012],
      ],
      { seg: 12 },
    )
  }
  ;(builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(0, 0.94, lerped(0.94)[1] + 0.045), () => {
      ;(builder.g(composeMatrix(0, 0, 0, 0, 0, 0), () =>
        builder.extrude(
          [
            [-0.085, 0.07],
            [0.085, 0.07],
            [0.1, 0],
            [0.06, -0.075],
            [-0.06, -0.075],
            [-0.1, 0],
          ],
          0.04,
          0.016,
        ),
      ),
        builder.paint(UNIT_PALETTE.bronzeDark, { c2: UNIT_PALETTE.bronze, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.sym(() => builder.g(composeMatrix(0.042, 0.022, 0.024, 0, 0, 18), () => builder.box(0, 0, 0, 0.06, 0.022, 0.02))),
        builder.ball(0, -0.012, 0.026, 0.02, 0.034, 0.016, 0),
        builder.paint(UNIT_PALETTE.bronze, { gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, -0.085, 0.02, 90, 0, 0), () => builder.torus(0.042, 0.012, 0.012, 6, 3, { crease: 30 })))
    }))
  const emitChainRibbon = (coordX, entries, coordZ, upperWidth, bowDepth, tailLength) => {
    builder.bind(makeChainColorBinder(coordX, entries, joints.hips)).paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth })
    const bowedEntries = entries.map((samplesTop) => [samplesTop[0], samplesTop[1], samplesTop[2] - Math.sign(bowDepth) * 0.006])
    ;(emitGradientRibbon(builder, bowedEntries, { width: (ribbonProgress) => lerpNumeric(coordZ, upperWidth, ribbonProgress) + 0.026, bow: [0, 0, bowDepth], nu: 2, nv: 5, tail: "swallow", tailLen: tailLength + 0.03 }),
      builder.paint(UNIT_PALETTE.skirt, { c2: UNIT_PALETTE.skirtDark, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(builder, entries, { width: (ribbonProgress) => lerpNumeric(coordZ, upperWidth, ribbonProgress), bow: [0, 0, bowDepth], nu: 4, nv: 5, tail: "swallow", tailLen: tailLength }))
  }
  ;(emitChainRibbon(tabChain, entries, 0.15, 0.125, 0.03, 0.1),
    emitChainRibbon(tailChain, entriesX, 0.2, 0.165, -0.03, 0.12),
    builder.sym(() => {
      ;(builder.bone(joints.hips).paint(UNIT_PALETTE.ironDark, { c2: UNIT_PALETTE.ironLight, gloss: 0.4, ao: 0.75, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 9, patternAmt: 0.25 }),
        emitScallopedSkirt(builder, { yTop: 0.9, yBot: 0.72, top: [0.36, 0.29], bot: [0.4, 0.32], a0: -62, a1: 62, n: 3 }),
        emitScallopedSkirt(builder, { yTop: 0.75, yBot: 0.56, top: [0.375, 0.3], bot: [0.42, 0.335], a0: -56, a1: 56, n: 3 }),
        builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [-56, 0, 56].map((angleDeg) => [Math.cos(angleDeg * DEG2RAD) * 0.436, 0.558, Math.sin(angleDeg * DEG2RAD) * 0.35, 0.016, 0.014]),
          { seg: 4, up: [0, 1, 0] },
        ))
    }),
    builder.sym((sideSign) => {
      const armX = proportions.shoulderX
      ;(builder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(UNIT_PALETTE.cloth, { c2: UNIT_PALETTE.clothDark, ao: 0.85, ao2: 1, mat: MATERIAL_KINDS.cloth }),
        builder.limb([armX, proportions.shoulderY + 0.06, 0], [armX, proportions.elbowY - 0.03, 0], 0.16, 0.14, { seg: 7 }),
        builder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(UNIT_PALETTE.clothDark, { c2: UNIT_PALETTE.cloth, mat: MATERIAL_KINDS.cloth }),
        builder.lathe(
          [
            [proportions.wristY + 0.19, 0.15, 0.15, armX, 0],
            [proportions.wristY + 0.21, 0.153, 0.153, armX, 0],
            [proportions.elbowY + 0.05, 0.14, 0.14, armX, 0],
          ],
          { seg: 8 },
        ),
        builder.paint(UNIT_PALETTE.leather, { c2: UNIT_PALETTE.leatherDark, gloss: 0.2, mat: MATERIAL_KINDS.leather }),
        builder.lathe(
          [
            [proportions.wristY - 0.005, 0.112, 0.112, armX, 0],
            [proportions.wristY + 0.03, 0.128, 0.128, armX, 0],
            [proportions.wristY + 0.2, 0.138, 0.138, armX, 0],
          ],
          { seg: 8, cap1: !1 },
        ),
        builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }))
      for (const cuffY of [proportions.wristY + 0.02, proportions.wristY + 0.15])
        builder.lathe(
          [
            [cuffY, 0.136, 0.136, armX, 0],
            [cuffY + 0.016, 0.146, 0.146, armX, 0],
            [cuffY + 0.032, 0.14, 0.14, armX, 0],
          ],
          { seg: 8, cap0: !1, cap1: !1, crease: 30 },
        )
    }),
    builder.paint(UNIT_PALETTE.skin, { glow: 0.05, ao: 0.9, mat: MATERIAL_KINDS.skin }),
    emitHand(builder, skeleton, 1, 0.1),
    emitHand(builder, skeleton, -1, 0.1),
    builder.sym((sideSign) => {
      const itemsWidth = sideSign > 0 ? joints.clavL : joints.clavR,
        itemsHeight = sideSign > 0 ? joints.armL : joints.armR,
        sumNear = proportions.shoulderX + 0.01,
        applyMetalPaint = () => {
          builder.paint(UNIT_PALETTE.ironDark, { c2: UNIT_PALETTE.ironLight, gloss: 0.4, ao: 0.72, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 8, patternAmt: 0.25 })
        }
      ;(builder.bone(itemsWidth),
        applyMetalPaint(),
        builder.g(composeMatrix(sumNear - 0.03, 1.545, 0, 0, 0, -10), () =>
          builder.lathe(
            [
              [0, 0.2, 0.215],
              [0.065, 0.15, 0.16],
              [0.1, 0.03, 0.03],
            ],
            { seg: 8, cap0: !1, crease: 60 },
          ),
        ),
        emitScallopedSkirt(builder, { cx: sumNear, yTop: 1.59, yBot: 1.455, top: [0.15, 0.2], bot: [0.255, 0.27], a0: -112, a1: 112, n: 3, lip: 0.018, double: !0 }),
        builder.bone(itemsHeight),
        applyMetalPaint(),
        emitScallopedSkirt(builder, { cx: sumNear, yTop: 1.49, yBot: 1.345, top: [0.225, 0.245], bot: [0.3, 0.295], a0: -106, a1: 106, n: 3, lip: 0.018 }),
        emitScallopedSkirt(builder, { cx: sumNear, yTop: 1.38, yBot: 1.225, top: [0.25, 0.26], bot: [0.325, 0.31], a0: -100, a1: 100, n: 3, lip: 0.02 }),
        builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [-100, -50, 0, 50, 100].map((angleDeg) => [sumNear + Math.cos(angleDeg * DEG2RAD) * 0.342 * (angleDeg === 0 ? 1 : 1.03), 1.222, Math.sin(angleDeg * DEG2RAD) * 0.327 * 1.03, 0.018, 0.015]),
          { seg: 4, up: [0, 1, 0] },
        ),
        builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
        builder.sheet(6, 1, (primaryBottom, secondaryInner) => {
          const lerpedV4 = lerpValue(-96, 96, primaryBottom) * DEG2RAD,
            lerpedV5 = lerpValue(0.325, 0.345, secondaryInner)
          return [sumNear + Math.cos(lerpedV4) * lerpedV5, lerpValue(1.215, 1.13, secondaryInner) + (Math.round(primaryBottom * 6) % 2 === 0 ? 0 : -0.012) * secondaryInner, Math.sin(lerpedV4) * lerpedV5 * 0.95]
        }))
    }))
  const headSurface = buildHeadSurface(builder, skeleton, UNIT_PALETTE.skin, computed, 0.25, 1.1)
  ;(buildFaceFeatures(builder, skeleton, headSurface, {
    iris: 3021842,
    irisGlow: 0.04,
    irisSize: 0.5,
    brow: UNIT_PALETTE.hair,
    browTilt: 22,
    browH: 0.034,
    browLen: 1.12,
    eyeW: 0.056,
    eyeH: 0.05,
    slant: 3,
    lash: 0.016,
    lip: 7090726,
    skin: UNIT_PALETTE.skin,
    nose: 1.25,
    ears: !0,
    mouthW: 1.25,
    smile: -0.7,
    open: 0.5,
    lite: !0,
  }),
    emitHeadFurMane(builder, skeleton, headSurface, {
      c: UNIT_PALETTE.hair,
      c2: UNIT_PALETTE.hairHi,
      thick: 0.03,
      gloss: 0,
      line: (heightRatio) => (heightRatio < 0.9 ? 0.168 - 0.02 * Math.cos((heightRatio / 0.9) * Math.PI * 0.5) : heightRatio < 1.45 ? lerpNumeric(0.168, -0.06, (heightRatio - 0.9) / 0.55) : -0.3),
    }),
    emitFacialFur(builder, skeleton, headSurface, { c: UNIT_PALETTE.hair, c2: UNIT_PALETTE.hairHi, spread: 1.5, thick: 0.07, drop: 0.1, tufts: 7, len: 0.2, tuftR: 0.078, puff: 0.75, mustache: 0.15, mustacheR: 0.028, curl: 0.06, gloss: 0, tuftSeg: 4 }))
  {
    const scaledValueX = headSurface.cy + 0.135 * computed,
      samples = headSurface.ring(0.135 * computed)
    ;(builder.bone(joints.head).paint(UNIT_PALETTE.red, { c2: UNIT_PALETTE.redDark, mat: MATERIAL_KINDS.cloth }),
      builder.g(composeMatrix(0, scaledValueX, samples[2], -7, 0, 0, 1, 1, (samples[1] + 0.03) / (samples[0] + 0.03)), () => builder.torus(samples[0] + 0.028, 0.014, 0.03, 12, 4, { crease: 30 })),
      builder.ball(0, scaledValueX + 0.02, samples[2] - samples[1] - 0.045, 0.04, 0.035, 0.03, 0),
      builder.tube(
        [
          [0.03, scaledValueX + 0.01, samples[2] - samples[1] - 0.05, 0.03, 0.008],
          [0.07, scaledValueX - 0.1, samples[2] - samples[1] - 0.09, 0.034, 0.008],
          [0.08, scaledValueX - 0.2, samples[2] - samples[1] - 0.1, 0.012, 0.006],
        ],
        { seg: 4, up: [1, 0, 0] },
      ),
      builder.tube(
        [
          [-0.03, scaledValueX + 0.01, samples[2] - samples[1] - 0.05, 0.03, 0.008],
          [-0.06, scaledValueX - 0.08, samples[2] - samples[1] - 0.1, 0.034, 0.008],
          [-0.1, scaledValueX - 0.16, samples[2] - samples[1] - 0.12, 0.012, 0.006],
        ],
        { seg: 4, up: [1, 0, 0] },
      ))
  }
  builder.bind(makeChainColorBinder(maneChain, entriesY, joints.head)).paint(UNIT_PALETTE.hair, { c2: UNIT_PALETTE.hairHi, mat: MATERIAL_KINDS.fur })
  const samplesX = [0, headSurface.cy + 0.2 * computed, -0.05],
    entriesWidth = [
      [0, 0.75, 0.44, 0.125],
      [24, 0.3, 0.38, 0.11],
      [-24, 0.3, 0.38, 0.11],
      [52, 0.6, 0.3, 0.1],
      [-52, 0.6, 0.3, 0.1],
      [0, 1.7, 0.32, 0.11],
    ]
  for (const [maneAngleDeg, coordX, coordY, coordZ] of entriesWidth) {
    const angleValue = Math.sin(maneAngleDeg * DEG2RAD),
      maneAngleCos = Math.cos(maneAngleDeg * DEG2RAD)
    emitTaperedTube(builder, [samplesX[0] + angleValue * 0.1, samplesX[1] - Math.abs(angleValue) * 0.05, samplesX[2] - coordX * 0.03], [angleValue, maneAngleCos, -coordX], coordY, coordZ, { curl: [angleValue * 0.16, -0.06, -0.34], n: 3, seg: 5, flat: 0.62, up: [1, 0, 0], tip: 0.14 })
  }
  ;(builder.bone(joints.head).paint(UNIT_PALETTE.hair, { c2: UNIT_PALETTE.hairHi, mat: MATERIAL_KINDS.fur }),
    builder.lathe(
      [
        [samplesX[1] - 0.06, 0.15, 0.14, 0, samplesX[2] - 0.02],
        [samplesX[1] + 0.03, 0.12, 0.11, 0, samplesX[2] - 0.02],
        [samplesX[1] + 0.08, 0.03, 0.03, 0, samplesX[2] - 0.02],
      ],
      { seg: 8, cap0: !1, crease: 180 },
    ),
    builder.bone(joints.propR),
    builder.g(composeMatrix(-proportions.shoulderX, proportions.handY, 0), () => {
      ;(builder.paint(UNIT_PALETTE.leatherDark, { c2: UNIT_PALETTE.redDark, gloss: 0.2, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, 0, -0.15, 0.027, 0.03],
            [0, 0, 0.07, 0.03, 0.033],
          ],
          { seg: 6 },
        ),
        builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, 0, -0.165, 90, 0, 0), () =>
          builder.lathe(
            [
              [-0.014, 0.03],
              [0, 0.056],
              [0.014, 0.03],
            ],
            { seg: 6, crease: 30 },
          ),
        ),
        builder.g(composeMatrix(0, 0, 0.085), () =>
          builder.extrude(
            [
              [0, 0.115],
              [0.036, 0.014],
              [0.036, -0.014],
              [0, -0.115],
              [-0.036, -0.014],
              [-0.036, 0.014],
            ],
            0.045,
            0.012,
          ),
        ),
        builder.paint(UNIT_PALETTE.steelDark, { c2: UNIT_PALETTE.steel, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, 0.1, 0.014, 0.05],
            [0, 0, 0.3, 0.014, 0.054],
            [0, 0, 0.82, 0.011, 0.046],
            [0, 0, 0.94, 0.007, 0.028],
            [0, 0, 1.02, 0.001, 0.002],
          ],
          { seg: 4, up: [1, 0, 0], crease: 0 },
        ))
    }))
  const entriesHeight = [0.15, 0.045, 0.085, 0.1, 0.08, 0.02, -0.13],
    entriesDepth = [-0.045, -0.03, -0.012, 0, 0.012, 0.045, 0.14],
    lerpedX = (entries, secondary) => {
      const samplePosition = clampUnitInput(secondary) * (entries.length - 1),
        lowerSampleIndex = Math.min(entries.length - 2, Math.floor(samplePosition))
      return lerpValue(entries[lowerSampleIndex], entries[lowerSampleIndex + 1], samplePosition - lowerSampleIndex)
    },
    delta = -0.24 - UNIT_CAPSULE.h / 2 + 0.05,
    sumX = -0.24 + UNIT_CAPSULE.h / 2 - 0.15,
    lerpedY = (primary, river, secondary = 0) => {
      const magnitude = Math.abs(primary * 2 - 1),
        shieldHalfWidth = UNIT_CAPSULE.w * (0.93 + 0.07 * Math.cos(river * Math.PI * 2)),
        scaledValueX = (primary * 2 - 1) * shieldHalfWidth,
        lerped = lerpValue(delta + lerpedX(entriesDepth, magnitude), sumX + lerpedX(entriesHeight, magnitude), river)
      return [scaledValueX, lerped, -0.11 * (scaledValueX / UNIT_CAPSULE.w) ** 2 + secondary]
    },
    sumY = (coordX, coordY, coordZ) => [coordX * UNIT_CAPSULE.w, coordY, -0.11 * coordX * coordX + coordZ]
  return (
    builder.bone(shieldJoint),
    builder.g(composeMatrix(proportions.shoulderX + 0.17, 0.9, 0.03, 0, 90, 90), () => {
      ;(builder.paint(UNIT_PALETTE.lacquer, { c2: UNIT_PALETTE.lacquerHi, gloss: 0.25, mat: MATERIAL_KINDS.leather }),
        builder.sheet(8, 6, (primaryInner, secondaryOuter) => lerpedY(primaryInner, secondaryOuter, 0.02), !1),
        builder.paint(UNIT_PALETTE.leatherDark, { c2: UNIT_PALETTE.leather, mat: MATERIAL_KINDS.leather, ao: 0.8 }),
        builder.sheet(8, 4, (primaryOuter, secondaryV2) => lerpedY(1 - primaryOuter, secondaryV2, -0.012), !1))
      const entriesWidth = []
      for (let topEdgeIndex = 0; topEdgeIndex < 8; topEdgeIndex++) entriesWidth.push([...lerpedY(topEdgeIndex / 8, 0, 0.004), 0.026, 0.026])
      for (let rightEdgeIndex = 0; rightEdgeIndex < 4; rightEdgeIndex++) entriesWidth.push([...lerpedY(1, rightEdgeIndex / 4, 0.004), 0.026, 0.026])
      for (let bottomEdgeIndex = 0; bottomEdgeIndex < 8; bottomEdgeIndex++) entriesWidth.push([...lerpedY(1 - bottomEdgeIndex / 8, 1, 0.004), 0.026, 0.026])
      for (let leftEdgeIndex = 0; leftEdgeIndex < 4; leftEdgeIndex++) entriesWidth.push([...lerpedY(0, 1 - leftEdgeIndex / 4, 0.004), 0.026, 0.026])
      ;(builder.paint(UNIT_PALETTE.red, { c2: UNIT_PALETTE.redDark, gloss: 0.4, mat: MATERIAL_KINDS.leather }),
        builder.tube(entriesWidth, { seg: 4, closed: !0, up: [0, 0, 1], crease: 50 }),
        builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth, line: 0 }),
        builder.sheet(1, 6, (primaryV2, secondaryV3) => lerpedY(lerpValue(0.41, 0.59, primaryV2), lerpValue(0.05, 0.93, secondaryV3), 0.03), !1),
        builder.paint(12728878, { gloss: 0.3, mat: MATERIAL_KINDS.leather, line: 0 }))
      const distance = /**
 * 处理距离。
 *
 * @param coordX - 主要输入
 * @param coordY - 输入
 * @param coordZ - 第三输入
 */
(coordX, coordY, coordZ) => {
        const entries = [
            [0.2, 0.34],
            [0.52, 0.36],
            [0.76, 0.24],
            [0.78, 0.07],
            [0.6, -0.01],
            [0.42, 0.05],
            [0.42, 0.17],
            [0.54, 0.2],
          ],
          delta = entries.length - 1
        builder.sheet(
          delta,
          1,
          (primaryV3, secondaryV4) => {
            const scaledValueNear = (coordX * coordY > 0 ? primaryV3 : 1 - primaryV3) * delta,
              lowerEntryIndex = Math.min(delta - 1, Math.floor(scaledValueNear)),
              deltaNear = scaledValueNear - lowerEntryIndex,
              lerpedV6 = lerpValue(entries[lowerEntryIndex][0], entries[lowerEntryIndex + 1][0], deltaNear),
              lerpedV7 = lerpValue(entries[lowerEntryIndex][1], entries[lowerEntryIndex + 1][1], deltaNear),
              deltaFar = entries[lowerEntryIndex + 1][0] - entries[lowerEntryIndex][0],
              deltaTop = entries[lowerEntryIndex + 1][1] - entries[lowerEntryIndex][1],
              distanceX = Math.hypot(deltaFar, deltaTop) || 1,
              deltaBottom = (secondaryV4 - 0.5) * 0.05 * (1 - (scaledValueNear / delta) * 0.5)
            return sumY(coordX * (lerpedV6 + (-deltaTop / distanceX) * deltaBottom * 2.2), coordZ + coordY * (lerpedV7 + (deltaFar / distanceX) * deltaBottom), 0.034)
          },
          !1,
        )
      }
      for (const sideSign of [1, -1]) (distance(sideSign, 1, -0.24 + 0.07), distance(sideSign, -1, -0.24 - 0.1))
      ;(builder.paint(UNIT_PALETTE.bronze, { c2: UNIT_PALETTE.amber, gloss: 1, glow: 0.1, glow2: 0.26, mat: MATERIAL_KINDS.metal, line: 1 }),
        builder.ball(0, -0.24, 0.035, 0.115, 0.115, 0.075, 1),
        builder.paint(UNIT_PALETTE.bronzeDark, { c2: UNIT_PALETTE.bronze, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, -0.24, 0.035, 90, 0, 0), () => builder.torus(0.15, 0.024, 0.02, 10, 3, { crease: 30 })))
    }),
    builder.bakeGrounding(2.1),
    { h: skeleton, b: builder, extra: { shield: shieldJoint, mane: maneChain } }
  )
}

/**
 * 创建模型。
 *
 */
function buildRangerModel() {
  const skeleton = buildSkeleton(XINGLI_RIG_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    builder = new ModelBuilder(),
    samples = [-0.1, 1.02, 0.255],
    composeMatrixResult = composeMatrix(samples[0], samples[1], samples[2], -14, 8, -52, 1.14),
    samplesX = composeMatrixResult.elements,
    sum = (coordX, coordY, coordZ) => [samplesX[0] * coordX + samplesX[4] * coordY + samplesX[8] * coordZ, samplesX[1] * coordX + samplesX[5] * coordY + samplesX[9] * coordZ, samplesX[2] * coordX + samplesX[6] * coordY + samplesX[10] * coordZ],
    pipaJoint = rig.add("pipa", joints.chest, samples[0], samples[1], samples[2]),
    pipaPosJoint = rig.add("pipaPos", joints.chest, 0, proportions.chestY, 0),
    pluckJoint = rig.add("pluck", joints.chest, 0, proportions.chestY, 0),
    freeJoint = rig.add("free", joints.chest, 0, proportions.chestY, 0),
    computed = 0.97,
    hairBaseY = proportions.headY + 0.25 * computed,
    entries = [
      [0, hairBaseY - 0.1, -0.22],
      [0, 1.38, -0.33],
      [0, 1.16, -0.37],
      [0, 0.96, -0.38],
    ],
    hairChain = rig.addChain("hair", joints.head, entries.slice(0, 3))
  rig.chain({ joints: hairChain, tip: [0, -0.2, -0.01], stiffness: 7, drag: 0.88, gravity: 10, maxAngle: 50, wind: 1.2, colliders: [{ joint: joints.chest, x: 0, y: 0.05, z: -0.04, r: 0.27 }] })
  const scaledValueX = (capeScale) => [
      [capeScale * 0.1, 1, 0.14],
      [capeScale * 0.15, 0.78, 0.2],
      [capeScale * 0.17, 0.54, 0.25],
      [capeScale * 0.18, 0.32, 0.3],
    ],
    ribLChain = rig.addChain("ribL", joints.hips, scaledValueX(1).slice(0, 3)),
    ribRChain = rig.addChain("ribR", joints.hips, scaledValueX(-1).slice(0, 3))
  for (const chainJoints of [ribLChain, ribRChain]) rig.chain({ joints: chainJoints, tip: [0, -0.22, 0.04], stiffness: 4, drag: 0.92, gravity: 7, maxAngle: 70, wind: 2.2 })
  const entriesX = [
      [0, 1.3, -0.05],
      [0, 1.03, -0.15],
      [0, 0.76, -0.23],
      [0, 0.5, -0.28],
      [0, 0.26, -0.31],
    ],
    cloakChain = rig.addChain("cloak", joints.chest, entriesX.slice(0, 4))
  rig.chain({
    joints: cloakChain,
    tip: [0, -0.24, -0.03],
    stiffness: 3.4,
    drag: 0.92,
    gravity: 8,
    maxAngle: 68,
    wind: 2.4,
    colliders: [
      { joint: joints.hips, x: 0, y: -0.12, z: 0.1, r: 0.36 },
      { joint: joints.chest, x: 0, y: 0, z: 0.08, r: 0.3 },
    ],
  })
  const hemJointBinder = (primary, secondary) => {
    const computed = primary >= 0,
      items = computed ? joints.thighL : joints.thighR,
      itemsX = computed ? joints.shinL : joints.shinR
    return secondary >= 0.9 ? [joints.hips, joints.hips, 1] : secondary >= 0.5 ? [joints.hips, items, 1 - (0.9 - secondary) / 0.4] : [items, itemsX, 1 - clampUnitInput((0.5 - secondary) / 0.4) * 0.6]
  }
  builder.sym((sideSign) => {
    ;(builder.bone(sideSign > 0 ? joints.footL : joints.footR).paint(RANGER_PALETTE.cloakDark, { c2: RANGER_PALETTE.cloak, mat: MATERIAL_KINDS.cloth }),
      builder.tube(
        [
          [proportions.hipX, 0.05, -0.07, 0.06, 0.045],
          [proportions.hipX, 0.06, 0.07, 0.07, 0.055],
          [proportions.hipX, 0.075, 0.21, 0.05, 0.036],
          [proportions.hipX, 0.12, 0.25, 0.03, 0.02],
        ],
        { seg: 6 },
      ),
      builder.bone(sideSign > 0 ? joints.shinL : joints.shinR).paint(RANGER_PALETTE.robeShade, { mat: MATERIAL_KINDS.cloth }),
      builder.limb([proportions.hipX, proportions.kneeY, 0], [proportions.hipX, proportions.ankleY, 0], 0.07, 0.055, { seg: 5 }))
  })
  const entriesY = [
      [0.05, 0.46, 0.46],
      [0.09, 0.445, 0.445],
      [0.3, 0.365, 0.365],
      [0.55, 0.28, 0.27],
      [0.8, 0.215, 0.185],
      [0.94, 0.19, 0.155],
      [1, 0.16, 0.125],
    ],
    scaledValueY = (primary, secondary) => 1 + (secondary < 4 ? 0.04 * (1 - secondary / 4) * Math.sin(primary * 8) : 0)
  ;(builder.bind(hemJointBinder).paint(RANGER_PALETTE.hem, { c2: RANGER_PALETTE.robe, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth, by: (primaryX, secondaryX) => (secondaryX - 0.08) / 0.34 }),
    builder.lathe(entriesY, { seg: 16, cap0: !1, cap1: !1, shape: scaledValueY }),
    builder.paint(RANGER_PALETTE.robeShade, { c2: RANGER_PALETTE.hem, glow: 0.06, mat: MATERIAL_KINDS.cloth, line: 0 }),
    builder.lathe(
      [
        [0.05, 0.02, 0.02],
        [0.058, 0.452, 0.452],
      ],
      { seg: 16, cap1: !1 },
    ),
    builder.paint(RANGER_PALETTE.hem, { c2: RANGER_PALETTE.robe, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth }))
  const lerped = (profileHeight) => {
    for (let index = 1; index < entriesY.length; index++) if (profileHeight <= entriesY[index][0]) return lerpValue(entriesY[index - 1][1], entriesY[index][1], (profileHeight - entriesY[index - 1][0]) / (entriesY[index][0] - entriesY[index - 1][0]))
    return 0.16
  }
  ;(builder.paint(RANGER_PALETTE.trimDark, { c2: RANGER_PALETTE.trim, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.04, 0.465, 0.465],
        [0.05, 0.48, 0.48],
        [0.105, 0.455, 0.455],
        [0.11, 0.435, 0.435],
      ],
      { seg: 16, cap0: !1, cap1: !1, shape: (angle) => 1 + 0.04 * Math.sin(angle * 8) },
    ),
    builder.paint(RANGER_PALETTE.trim, { c2: RANGER_PALETTE.trimDark, mat: MATERIAL_KINDS.cloth, line: 0 }),
    builder.sheet(
      8,
      1,
      (primaryV4, secondaryV5) => {
        const lerpedV8 = lerpValue(0.97, 0.13, primaryV4) + (secondaryV5 - 0.5) * 0.07,
          lerpedV9 = lerpValue(40, 200, primaryV4) * YEQUE_DEG_TO_RAD,
          scaledValueFar = lerped(lerpedV8) * (1 + (lerpedV8 < 0.55 ? 0.04 * (1 - lerpedV8 / 0.55) * Math.sin(lerpedV9 * 8) : 0)) + 0.01
        return [Math.cos(lerpedV9) * scaledValueFar, lerpedV8, Math.sin(lerpedV9) * scaledValueFar * (lerpedV8 > 0.7 ? 0.86 : 1)]
      },
      !1,
    ),
    builder.bind(makeTorsoColorBinder(skeleton)).paint(RANGER_PALETTE.robeShade, { c2: RANGER_PALETTE.robe, mat: MATERIAL_KINDS.cloth, gloss: 0.1 }),
    builder.lathe(
      [
        [0.86, 0.185, 0.15],
        [0.95, 0.178, 0.14],
        [1.02, 0.145, 0.114],
        [1.12, 0.162, 0.13],
        [1.22, 0.195, 0.152],
        [1.32, 0.2, 0.138],
        [1.385, 0.13, 0.105],
        [1.425, 0.07, 0.066],
      ],
      { seg: 12 },
    ),
    builder.bone(joints.neck).paint(RANGER_PALETTE.skin, { ao: 0.78, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      [
        [1.4, 0.06, 0.06],
        [1.52, 0.058, 0.058],
      ],
      { seg: 8, cap0: !1 },
    ),
    builder.bone(joints.chest).paint(RANGER_PALETTE.trim, { c2: RANGER_PALETTE.trimDark, mat: MATERIAL_KINDS.cloth }),
    builder.tube(
      [
        [0.075, 1.44, 0.05, 0.03, 0.01],
        [0.045, 1.36, 0.128, 0.032, 0.01],
        [-0.03, 1.25, 0.152, 0.032, 0.01],
        [-0.11, 1.12, 0.128, 0.03, 0.01],
      ],
      { seg: 4, up: [1, 0.4, 0] },
    ),
    builder.tube(
      [
        [-0.075, 1.44, 0.05, 0.03, 0.01],
        [-0.045, 1.37, 0.122, 0.03, 0.01],
        [0, 1.31, 0.14, 0.028, 0.01],
      ],
      { seg: 4, up: [1, -0.4, 0] },
    ),
    builder.bone(joints.spine).paint(RANGER_PALETTE.trim, { c2: RANGER_PALETTE.trimDark, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.965, 0.184, 0.148],
        [0.985, 0.17, 0.134],
        [1.06, 0.153, 0.121],
        [1.075, 0.147, 0.117],
      ],
      { seg: 12 },
    ),
    builder.paint(RANGER_PALETTE.gold, { c2: RANGER_PALETTE.goldDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(0, 1.02, 0.132, 0, 0, 0), () =>
      builder.extrude(
        [
          [0, 0.04],
          [0.035, 0],
          [0, -0.04],
          [-0.035, 0],
        ],
        0.018,
        0.006,
      ),
    ))
  for (const [primary, secondary] of [
    [ribLChain, 1],
    [ribRChain, -1],
  ]) {
    const gGResult = scaledValueX(secondary)
    ;(builder.bind(makeChainColorBinder(primary, gGResult, joints.hips)).paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(builder, gGResult, { width: (ribbonProgress) => lerpValue(0.038, 0.058, ribbonProgress), axis: [1, 0, 0], bow: [0, 0, 0.012], nu: 2, nv: 6, tail: "swallow", tailLen: 0.09, wave: 0.5 }))
  }
  ;(builder.sym((sideSign) => {
    const armX = proportions.shoulderX
    ;(builder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(RANGER_PALETTE.cloakLight, { c2: RANGER_PALETTE.cloak, mat: MATERIAL_KINDS.cloth }),
      builder.limb([armX, proportions.shoulderY + 0.03, 0], [armX, proportions.elbowY + 0.03, 0], 0.096, 0.1, { seg: 8 }),
      builder.g(composeMatrix(armX, 0, 0), () => emitRingFurTufts(builder, 0.1, 0.1, 0.028, 0.026, { c: RANGER_PALETTE.fur, c2: RANGER_PALETTE.furShade, tufts: 6, seg: 5, y: proportions.elbowY + 0.03 })),
      builder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(RANGER_PALETTE.robeShade, { c2: RANGER_PALETTE.robe, mat: MATERIAL_KINDS.cloth, gloss: 0.1 }),
      builder.lathe(
        [
          [proportions.wristY - 0.04, 0.108, 0.108, armX, 0],
          [proportions.wristY + 0.01, 0.104, 0.104, armX, 0],
          [proportions.wristY + 0.14, 0.082, 0.082, armX, 0],
          [proportions.elbowY + 0.03, 0.066, 0.066, armX, 0],
        ],
        { seg: 10, cap0: !1 },
      ),
      builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth, ao: 0.8, line: 0 }),
      builder.lathe(
        [
          [proportions.wristY - 0.008, 0.062, 0.064, armX, 0],
          [proportions.wristY - 0.037, 0.103, 0.103, armX, 0],
        ],
        { seg: 10, cap0: !1, cap1: !1 },
      ),
      builder.paint(RANGER_PALETTE.robeShade, { c2: RANGER_PALETTE.robe, mat: MATERIAL_KINDS.cloth }),
      builder.lathe(
        [
          [proportions.wristY - 0.058, 0.03, 0.034, armX, 0],
          [proportions.wristY - 0.058, 0.055, 0.06, armX, 0],
          [proportions.wristY - 0.008, 0.062, 0.065, armX, 0],
        ],
        { seg: 8, cap0: !1, cap1: !1 },
      ),
      builder.paint(RANGER_PALETTE.trim, { c2: RANGER_PALETTE.trimDark, mat: MATERIAL_KINDS.cloth, line: 0 }),
      builder.lathe(
        [
          [proportions.wristY - 0.062, 0.057, 0.062, armX, 0],
          [proportions.wristY - 0.046, 0.059, 0.064, armX, 0],
        ],
        { seg: 8, cap0: !1, cap1: !1 },
      ),
      builder.paint(RANGER_PALETTE.trim, { c2: RANGER_PALETTE.trimDark, mat: MATERIAL_KINDS.cloth }),
      builder.lathe(
        [
          [proportions.wristY + 0, 0.108, 0.108, armX, 0],
          [proportions.wristY + 0.04, 0.101, 0.101, armX, 0],
        ],
        { seg: 10, cap0: !1, cap1: !1 },
      ),
      builder.g(composeMatrix(armX, 0, 0), () => emitRingFurTufts(builder, 0.108, 0.108, 0.03, 0.028, { c: RANGER_PALETTE.fur, c2: RANGER_PALETTE.furShade, tufts: 6, seg: 5, y: proportions.wristY - 0.04 })))
  }),
    builder.paint(RANGER_PALETTE.skin, { glow: 0.07, mat: MATERIAL_KINDS.skin }),
    emitHand(builder, skeleton, 1, 0.05, !0),
    emitHand(builder, skeleton, -1, 0.05, !0),
    builder.bone(joints.chest).paint(RANGER_PALETTE.cloakLight, { c2: RANGER_PALETTE.cloakDark, ao: 0.9, mat: MATERIAL_KINDS.cloth }))
  {
    const entriesZ = [
      [1.475, 0.1, 0.1],
      [1.41, 0.29, 0.2],
      [1.31, 0.385, 0.27],
      [1.17, 0.415, 0.3],
    ]
    builder.sheet(12, 3, (primaryV5, secondaryV6) => {
      const lerpedV10 = lerpValue(144, 396, primaryV5) * YEQUE_DEG_TO_RAD,
        elementY = entriesZ[Math.round(secondaryV6 * 3)],
        cloakEdgeSag = Math.pow(Math.abs(primaryV5 * 2 - 1), 6)
      return [Math.cos(lerpedV10) * elementY[1], elementY[0] - cloakEdgeSag * 0.07 * secondaryV6, Math.sin(lerpedV10) * elementY[2] - 0.015]
    })
  }
  builder.bind(makeChainColorBinder(cloakChain, entriesX, joints.chest)).paint(RANGER_PALETTE.cloak, { c2: RANGER_PALETTE.cloakDark, mat: MATERIAL_KINDS.cloth })
  const scaledValueZ = (progress) => lerpNumeric(0.3, 0.44, Math.sin(progress * Math.PI * 0.5)),
    entriesWidth = [0, 0.22, 0.44, 0.66, 0.84].map((sampleRatio) => sampleColorGradient(entriesX, sampleRatio))
  ;(emitGradientRibbon(builder, entriesWidth, { width: (ribbonProgress) => scaledValueZ(ribbonProgress * 0.84), bow: [0, 0, -0.19], wave: 0.16, nu: 6, nv: 8, tail: "flat" }),
    builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, [sampleColorGradient(entriesX, 0.84), sampleColorGradient(entriesX, 0.9)], { width: (ribbonProgress) => scaledValueZ(0.84 + ribbonProgress * 0.06), bow: [0, 0, -0.19], nu: 6, nv: 1, tail: "flat" }),
    builder.paint(RANGER_PALETTE.cloak, { c2: RANGER_PALETTE.cloakDark, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, [sampleColorGradient(entriesX, 0.9), sampleColorGradient(entriesX, 0.97)], { width: (ribbonProgress) => scaledValueZ(0.9 + ribbonProgress * 0.07), bow: [0, 0, -0.19], nu: 6, nv: 1, tail: "flat" }))
  {
    const gradientColor = sampleColorGradient(entriesX, 0.985),
      tResult = scaledValueZ(1),
      entriesHeight = []
    for (let index = 0; index <= 8; index++) {
      const scaledValueWidth = (index / 8) * 2 - 1
      entriesHeight.push([gradientColor[0] + scaledValueWidth * tResult, gradientColor[1], gradientColor[2] - 0.19 * (1 - scaledValueWidth * scaledValueWidth), 0.045, 0.04])
    }
    emitFurTufts(builder, entriesHeight, { c: RANGER_PALETTE.fur, c2: RANGER_PALETTE.furShade, tufts: 9, seg: 5, up: [0, 1, 0] })
  }
  ;(builder.bone(joints.chest), builder.g(composeMatrix(0, 1.405, 0, 15, 0, 0), () => emitRingFurTufts(builder, 0.215, 0.195, 0.1, 0.085, { c: RANGER_PALETTE.fur, c2: RANGER_PALETTE.furShade, tufts: 9, amp: 0.2, lobes: 6, lobeAmp: 0.12, seg: 7 })))
  const surfaceProfile = buildHeadSurface(builder, skeleton, RANGER_PALETTE.skin, computed)
  ;(buildFaceFeatures(builder, skeleton, surfaceProfile, {
    iris: 4860966,
    irisGlow: 0.12,
    brow: RANGER_PALETTE.hair,
    browTilt: 4,
    browH: 0.012,
    browLen: 1.08,
    eyeW: 0.05,
    eyeH: 0.046,
    slant: 5,
    lash: 0.015,
    lip: RANGER_PALETTE.lip,
    skin: RANGER_PALETTE.skin,
    nose: 0.55,
    mouthW: 0.85,
    smile: 0.35,
    lite: !0,
  }),
    emitHeadFurMane(builder, skeleton, surfaceProfile, {
      c: RANGER_PALETTE.hair,
      c2: RANGER_PALETTE.hairHi,
      thick: 0.028,
      gloss: 0,
      line: (heightRatio) => (heightRatio < 0.8 ? 0.15 - 0.045 * Math.sin((heightRatio / 0.8) * Math.PI * 0.5) : heightRatio < 1.3 ? lerpNumeric(0.105, -0.12, (heightRatio - 0.8) / 0.5) : -0.3),
    }))
  const headCenterY = surfaceProfile.cy
  ;(builder.bone(joints.head).paint(RANGER_PALETTE.hair, { c2: RANGER_PALETTE.hairHi, mat: MATERIAL_KINDS.fur }),
    builder.sym(() =>
      builder.tube(
        [
          [0.205, headCenterY + 0.07, 0.085, 0.034, 0.04],
          [0.235, headCenterY - 0.1, 0.09, 0.036, 0.036],
          [0.225, headCenterY - 0.3, 0.115, 0.028, 0.026],
          [0.21, headCenterY - 0.44, 0.13, 0.008, 0.008],
        ],
        { seg: 5, crease: 180 },
      ),
    ),
    builder.ball(0, headCenterY + 0.3 * computed, -0.04, 0.115, 0.1, 0.115, 1),
    builder.ball(0, headCenterY + 0.4 * computed, -0.06, 0.075, 0.065, 0.075, 1),
    builder.paint(RANGER_PALETTE.gold, { c2: RANGER_PALETTE.goldDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(0, headCenterY + 0.355 * computed, -0.05, -8, 0, 0), () => builder.torus(0.078, 0.012, 0.014, 8, 3, { crease: 30 })),
    builder.tube(
      [
        [0.03, headCenterY + 0.33 * computed, -0.02, 0.006],
        [0.2, headCenterY + 0.4 * computed, 0.06, 0.006],
      ],
      { seg: 3 },
    ),
    builder.g(composeMatrix(0.2, headCenterY + 0.41 * computed, 0.065, 0, 30, -30), () =>
      builder.extrude(
        [
          [0, 0.05],
          [0.03, 0.01],
          [0.018, -0.03],
          [-0.018, -0.03],
          [-0.03, 0.01],
        ],
        0.008,
        0,
      ),
    ),
    builder.paint(RANGER_PALETTE.gold, { c2: 16770728, gloss: 1, glow: 0.12, mat: MATERIAL_KINDS.metal }),
    builder.ball(0.19, headCenterY + 0.335 * computed, 0.075, 0.014, 0.018, 0.014, 0),
    builder.ball(0.215, headCenterY + 0.325 * computed, 0.055, 0.012, 0.016, 0.012, 0),
    builder.paint(RANGER_PALETTE.lip, { glow: 0.1, line: 0 }),
    builder.g(composeMatrix(0, headCenterY + 0.085 * computed, surfaceProfile.surf(0, headCenterY + 0.085 * computed) + 0.002, -12, 0, 0), () =>
      builder.extrude(
        [
          [0, 0.022],
          [0.012, 0.004],
          [0.007, -0.016],
          [-0.007, -0.016],
          [-0.012, 0.004],
        ],
        0.006,
        0,
      ),
    ))
  {
    const samplesY = surfaceProfile.ring(0.17 * computed)
    ;(builder.bone(joints.head), builder.g(composeMatrix(0, headCenterY + 0.168 * computed, samplesY[2], -9, 0, 0), () => emitRingFurTufts(builder, samplesY[0] + 0.03, samplesY[1] + 0.03, 0.052, 0.05, { c: RANGER_PALETTE.fur, c2: RANGER_PALETTE.furShade, tufts: 9, amp: 0.18, lobes: 5, seg: 6 })))
  }
  return (
    builder.bind(makeChainColorBinder(hairChain, entries, joints.head)).paint(RANGER_PALETTE.hair, { c2: RANGER_PALETTE.hairHi, mat: MATERIAL_KINDS.fur }),
    builder.tube(
      [
        [0, hairBaseY - 0.06, -0.2, 0.09, 0.05],
        [0, hairBaseY - 0.2, -0.27, 0.085, 0.05],
        [0, 1.36, -0.335, 0.072, 0.045],
        [0, 1.16, -0.37, 0.06, 0.04],
        [0, 0.98, -0.38, 0.04, 0.03],
        [0, 0.8, -0.385, 0.008, 0.008],
      ],
      { seg: 7, up: [1, 0, 0], crease: 180 },
    ),
    builder.paint(RANGER_PALETTE.cloakLight, { c2: RANGER_PALETTE.cloak, mat: MATERIAL_KINDS.cloth }),
    builder.tube(
      [
        [0, 1.2, -0.365, 0.066, 0.046],
        [0, 1.14, -0.372, 0.064, 0.044],
      ],
      { seg: 7, up: [1, 0, 0], cap0: !1, cap1: !1 },
    ),
    builder.bone(pipaJoint),
    builder.g(composeMatrixResult, () => {
      ;(builder.paint(RANGER_PALETTE.woodDeep, { c2: RANGER_PALETTE.woodDark, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
        builder.lathe(
          [
            [-0.27, 0.03, 0.02, 0, -0.01],
            [-0.235, 0.115, 0.045, 0, -0.012],
            [-0.14, 0.165, 0.056, 0, -0.016],
            [-0.03, 0.172, 0.056, 0, -0.016],
            [0.08, 0.13, 0.048, 0, -0.012],
            [0.18, 0.066, 0.036, 0, -0.006],
            [0.25, 0.034, 0.028, 0, 0],
          ],
          { seg: 10, crease: 180 },
        ),
        builder.tube(
          [
            [0, 0.23, 0, 0.03, 0.026],
            [0, 0.5, 0.004, 0.024, 0.022],
          ],
          { seg: 6 },
        ),
        builder.tube(
          [
            [0, 0.49, 0.004, 0.026, 0.022],
            [0, 0.56, -0.03, 0.03, 0.02],
            [0, 0.63, -0.1, 0.028, 0.018],
            [0, 0.645, -0.15, 0.02, 0.016],
            [0, 0.61, -0.17, 0.008, 0.008],
          ],
          { seg: 5, crease: 180 },
        ),
        builder.paint(RANGER_PALETTE.woodShade, { c2: RANGER_PALETTE.wood, gloss: 0.5, mat: MATERIAL_KINDS.leather }))
      for (const [coordXZ, coordYZ, coordZZ] of [
        [0.55, -0.025, 1],
        [0.59, -0.062, -1],
        [0.615, -0.092, 1],
        [0.635, -0.125, -1],
      ])
        builder.tube(
          [
            [coordZZ * 0.02, coordXZ, coordYZ, 0.012],
            [coordZZ * 0.085, coordXZ + 0.006, coordYZ, 0.016],
            [coordZZ * 0.1, coordXZ + 0.008, coordYZ, 0.01],
          ],
          { seg: 4 },
        )
      builder.paint(RANGER_PALETTE.woodShade, { c2: RANGER_PALETTE.wood, gloss: 0.5, mat: MATERIAL_KINDS.leather })
      const entriesHeight = [],
        entriesDepth = [
          [-0.262, 0.03],
          [-0.228, 0.108],
          [-0.14, 0.157],
          [-0.03, 0.164],
          [0.08, 0.122],
          [0.18, 0.06],
          [0.245, 0.03],
        ]
      for (const [primaryV6, secondaryV7] of entriesDepth) entriesHeight.push([secondaryV7, primaryV6])
      for (let deltaInner = entriesDepth.length - 1; deltaInner >= 0; deltaInner--) entriesHeight.push([-entriesDepth[deltaInner][1], entriesDepth[deltaInner][0]])
      ;(builder.g(composeMatrix(0, 0, 0.03), () => builder.extrude(entriesHeight, 0.024, 0.006)),
        builder.paint(RANGER_PALETTE.cloak, { c2: RANGER_PALETTE.cloakLight, gloss: 0.5, mat: MATERIAL_KINDS.leather, line: 0 }),
        builder.g(composeMatrix(0, -0.06, 0.044), () =>
          builder.extrude(
            [
              [-0.085, 0.05],
              [0.085, 0.05],
              [0.1, -0.03],
              [0.06, -0.06],
              [-0.06, -0.06],
              [-0.1, -0.03],
            ],
            0.006,
            0,
          ),
        ),
        builder.paint(RANGER_PALETTE.gold, { c2: 16773312, gloss: 1, glow: 0.2, mat: MATERIAL_KINDS.metal, line: 0 }))
      const entriesStart = []
      for (let upperArcIndex = 0; upperArcIndex <= 6; upperArcIndex++) {
        const scaledValueTop = Math.PI * (0.15 + (0.7 * upperArcIndex) / 6)
        entriesStart.push([Math.cos(scaledValueTop) * 0.05, -Math.sin(scaledValueTop) * 0.05 + 0.03])
      }
      for (let lowerArcIndex = 6; lowerArcIndex >= 0; lowerArcIndex--) {
        const scaledValueBottom = Math.PI * (0.15 + (0.7 * lowerArcIndex) / 6)
        entriesStart.push([Math.cos(scaledValueBottom) * 0.05, -Math.sin(scaledValueBottom) * 0.026 + 0.036])
      }
      ;(builder.g(composeMatrix(0, -0.075, 0.049), () => builder.extrude(entriesStart, 0.005, 0)),
        builder.paint(RANGER_PALETTE.woodDeep, { gloss: 0.5, mat: MATERIAL_KINDS.leather, line: 0 }),
        builder.box(0, -0.17, 0.05, 0.1, 0.022, 0.018, 0.004),
        builder.paint(RANGER_PALETTE.wood, { c2: 16773848, gloss: 0.4, mat: MATERIAL_KINDS.leather, line: 0 }))
      for (const ornamentY of [0.12, 0.2, 0.28, 0.36, 0.44]) builder.box(0, ornamentY, ornamentY < 0.22 ? 0.046 : 0.03, ornamentY < 0.22 ? 0.07 : 0.05, 0.012, 0.012)
      builder.paint(RANGER_PALETTE.string, { c2: 16777215, glow: 0.35, gloss: 1, mat: MATERIAL_KINDS.metal, line: 0 })
      for (const stringOffsetX of [-0.027, -0.009, 0.009, 0.027])
        builder.tube(
          [
            [stringOffsetX, -0.17, 0.062, 0.0055],
            [stringOffsetX * 0.9, 0.1, 0.056, 0.0055],
            [stringOffsetX * 0.7, 0.49, 0.036, 0.005],
          ],
          { seg: 3 },
        )
    }),
    builder.bakeGrounding(2.05, 0.75, 0.9),
    {
      h: skeleton,
      b: builder,
      extra: {
        pipa: pipaJoint,
        pipaPos: pipaPosJoint,
        pluck: pluckJoint,
        free: freeJoint,
        ax: [sum(1, 0, 0), sum(0, 1, 0), sum(0, 0, 1)],
        handR: (() => {
          const lLResult = sum(-0.09, -0.02, 0.11)
          return [lLResult[0] - 0.02, lLResult[1] + 0.03, lLResult[2] + 0.01]
        })(),
        handL: (() => {
          const samplesBottom = sum(0, 0.3, 0)
          return [samplesBottom[0] + 0.03, samplesBottom[1] - 0.06, samplesBottom[2] + 0.02]
        })(),
        face: sum(0, -0.04, 0.07),
      },
    }
  )
}

/**
 * 创建模型。
 *
 */
function buildMageModel() {
  const skeleton = buildSkeleton(YEQUE_RIG_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    builder = new ModelBuilder(),
    computed = 0.94,
    entries = [
      [0.05, 1.42, -0.16],
      [0.1, 1.32, -0.42],
      [0.12, 1.1, -0.64],
      [0.12, 0.84, -0.78],
      [0.1, 0.56, -0.86],
      [0.08, 0.28, -0.9],
    ],
    scarfChain = rig.addChain("scarf", joints.chest, entries.slice(0, 5))
  rig.chain({ joints: scarfChain, tip: [-0.02, -0.28, -0.04], stiffness: 2.6, drag: 0.93, gravity: 5, maxAngle: 80, wind: 3.4, colliders: [{ joint: joints.chest, x: 0, y: 0, z: 0, r: 0.24 }] })
  const entriesX = [
      [-0.07, 1.42, -0.15],
      [-0.14, 1.28, -0.36],
      [-0.17, 1.06, -0.5],
      [-0.18, 0.82, -0.56],
    ],
    scarfBChain = rig.addChain("scarfB", joints.chest, entriesX.slice(0, 3))
  rig.chain({ joints: scarfBChain, tip: [0, -0.24, -0.06], stiffness: 3.4, drag: 0.92, gravity: 6, maxAngle: 80, wind: 3, colliders: [{ joint: joints.chest, x: 0, y: 0, z: 0, r: 0.24 }] })
  const entriesY = [
      [-0.17, 0.94, -0.06],
      [-0.24, 0.72, -0.12],
      [-0.27, 0.5, -0.16],
      [-0.28, 0.3, -0.18],
    ],
    sashChain = rig.addChain("sash", joints.hips, entriesY.slice(0, 3))
  rig.chain({ joints: sashChain, tip: [0, -0.2, -0.02], stiffness: 5, drag: 0.9, gravity: 9, maxAngle: 65, wind: 1.4 })
  const furlJoint = rig.add("furl", joints.handL, proportions.shoulderX, proportions.handY, 0),
    furlRowAt = (plaza) => [proportions.shoulderX, proportions.handY - 0.02 - plaza * YEQUE_ARM_SPAN_SCALE, 0.05 + 0.3 * Math.sin(plaza * Math.PI * 0.55)],
    fromResult = Array.from({ length: FURL_ROW_COUNT + 1 }, (primaryV7, secondaryV8) => furlRowAt(secondaryV8 / FURL_ROW_COUNT)),
    samples = fromResult.slice(1).map((samplesInner, secondaryV9) => rig.add(`furl${secondaryV9 + 1}`, furlJoint, samplesInner[0], samplesInner[1], samplesInner[2])),
    ratio = (primary, secondary) => {
      const items = primary >= 0 ? joints.thighL : joints.thighR
      return secondary >= 0.92 ? [joints.hips, joints.hips, 1] : [joints.hips, items, clampUnitInput((secondary - 0.6) / 0.32)]
    }
  builder.sym((sideSign) => {
    const hipX = proportions.hipX
    ;(builder.bone(sideSign > 0 ? joints.thighL : joints.thighR).paint(COSTUME_PALETTE.suit, { c2: COSTUME_PALETTE.suitDark, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth }), builder.limb([hipX, proportions.hipY + 0.04, 0], [hipX, proportions.kneeY, 0], 0.108, 0.082, { seg: 8, bulge: 0.04 }))
  })
  for (const item of [1, -1]) {
    ;(builder.paint(COSTUME_PALETTE.suitDark, { c2: COSTUME_PALETTE.leather, mat: MATERIAL_KINDS.leather, gloss: 0.15 }),
      emitShinFoot(builder, skeleton, item, { top: 0.32, rTop: 0.082, rAnkle: 0.066, len: 0.22, toe: 0.01 }),
      builder.bone(item > 0 ? joints.shinL : joints.shinR).paint(COSTUME_PALETTE.suitHi, { c2: COSTUME_PALETTE.suit, mat: MATERIAL_KINDS.cloth }))
    for (const bandY of [0.32, 0.38, 0.44]) builder.g(composeMatrix(item * proportions.hipX, bandY, 0, 14, 0, 0), () => builder.torus(0.084, 0.009, 0.014, 8, 3, { crease: 30 }))
  }
  ;(builder.bind(ratio).paint(COSTUME_PALETTE.suit, { c2: COSTUME_PALETTE.suitDark, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth, by: (primaryY, secondaryY) => (secondaryY - 0.62) / 0.32 }),
    builder.lathe(
      [
        [0.62, 0.19, 0.17],
        [0.72, 0.185, 0.162],
        [0.84, 0.175, 0.145],
        [0.94, 0.168, 0.136],
      ],
      { seg: 12, cap0: !1, cap1: !1, shape: (primaryX, secondaryX) => 1 + (secondaryX < 2 ? 0.035 * Math.sin(primaryX * 5) : 0) },
    ),
    builder.paint(COSTUME_PALETTE.suitHi, { c2: COSTUME_PALETTE.suit, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.61, 0.193, 0.173],
        [0.62, 0.197, 0.177],
        [0.66, 0.193, 0.173],
      ],
      { seg: 12, cap0: !1, cap1: !1, shape: (angle) => 1 + 0.035 * Math.sin(angle * 5) },
    ),
    builder.bind(makeTorsoColorBinder(skeleton)).paint(COSTUME_PALETTE.suit, { c2: COSTUME_PALETTE.suitHi, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.86, 0.172, 0.138],
        [0.94, 0.168, 0.132],
        [1, 0.145, 0.112],
        [1.1, 0.165, 0.126],
        [1.21, 0.205, 0.146],
        [1.33, 0.215, 0.14],
        [1.39, 0.14, 0.108],
        [1.43, 0.072, 0.068],
      ],
      { seg: 12 },
    ),
    builder.bone(joints.neck).paint(COSTUME_PALETTE.skin, { ao: 0.75, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      [
        [1.4, 0.058, 0.058],
        [1.53, 0.056, 0.056],
      ],
      { seg: 8, cap0: !1 },
    ),
    builder.bone(joints.chest).paint(COSTUME_PALETTE.suitHi, { c2: COSTUME_PALETTE.suit, mat: MATERIAL_KINDS.cloth }),
    builder.tube(
      [
        [0.07, 1.44, 0.05, 0.026, 0.01],
        [0.04, 1.37, 0.118, 0.028, 0.01],
        [-0.04, 1.26, 0.142, 0.028, 0.01],
        [-0.11, 1.12, 0.122, 0.026, 0.01],
      ],
      { seg: 4, up: [1, 0.4, 0] },
    ),
    builder.tube(
      [
        [-0.07, 1.44, 0.05, 0.026, 0.01],
        [-0.045, 1.38, 0.112, 0.026, 0.01],
        [0, 1.32, 0.13, 0.024, 0.01],
      ],
      { seg: 4, up: [1, -0.4, 0] },
    ),
    builder.paint(COSTUME_PALETTE.leather, { c2: COSTUME_PALETTE.leatherLight, gloss: 0.3, mat: MATERIAL_KINDS.leather }),
    builder.tube(
      [
        [-0.19, 1.39, 0.06, 0.028, 0.012],
        [-0.07, 1.27, 0.15, 0.03, 0.012],
        [0.08, 1.12, 0.14, 0.03, 0.012],
        [0.16, 1.03, 0.07, 0.028, 0.012],
        [0.17, 1, -0.06, 0.028, 0.012],
      ],
      { seg: 4, up: [0, 0.6, 0.8] },
    ),
    builder.paint(COSTUME_PALETTE.bronze, { c2: COSTUME_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(-0.07, 1.27, 0.158, 0, 0, 40), () => builder.box(0, 0, 0, 0.04, 0.03, 0.014, 0.006)),
    builder.bone(joints.spine).paint(COSTUME_PALETTE.sash, { c2: COSTUME_PALETTE.sashDark, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.9, 0.18, 0.146],
        [0.92, 0.186, 0.15],
        [1.02, 0.158, 0.124],
        [1.04, 0.15, 0.118],
      ],
      { seg: 12 },
    ),
    builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [0.955, 0.183, 0.148],
        [0.965, 0.186, 0.151],
        [0.985, 0.17, 0.138],
      ],
      { seg: 12, cap0: !1, cap1: !1 },
    ),
    builder.bind(makeChainColorBinder(sashChain, entriesY, joints.hips)).paint(COSTUME_PALETTE.sash, { c2: COSTUME_PALETTE.sashDark, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, entriesY, { width: (ribbonProgress) => lerpValue(0.05, 0.072, ribbonProgress), axis: [0.3, 0, 1], bow: [-0.015, 0, 0], nu: 2, nv: 6, tail: "swallow", tailLen: 0.1, wave: 0.4 }),
    builder.bone(joints.hips))
  for (let index = 0; index < 3; index++)
    builder.g(composeMatrix(-0.06 + index * 0.06, 0.97, -0.16, 0, 0, 180 + (index - 1) * 14), () => {
      ;(builder.paint(COSTUME_PALETTE.leather, { mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, -0.02, 0, 0.012],
            [0, 0.06, 0, 0.012],
          ],
          { seg: 4 },
        ),
        builder.paint(COSTUME_PALETTE.plain, { c2: COSTUME_PALETTE.steelDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0.06, 0, 0.004, 0.022],
            [0, 0.11, 0, 0.004, 0.02],
            [0, 0.17, 0, 0.002, 0.003],
          ],
          { seg: 4, up: [1, 0, 0], crease: 0 },
        ))
    })
  ;(builder.sym((sideSign) => {
    const armX = proportions.shoulderX
    ;(builder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(COSTUME_PALETTE.suit, { c2: COSTUME_PALETTE.suitHi, ao: 0.9, ao2: 1, mat: MATERIAL_KINDS.cloth }),
      builder.ball(armX, proportions.shoulderY, 0, 0.078, 0.078, 0.078, 1),
      builder.limb([armX, proportions.shoulderY, 0], [armX, proportions.elbowY, 0], 0.072, 0.06, { seg: 8 }),
      builder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(COSTUME_PALETTE.suit, { c2: COSTUME_PALETTE.suitHi, mat: MATERIAL_KINDS.cloth }),
      builder.ball(armX, proportions.elbowY, 0, 0.062, 0.062, 0.062, 1),
      builder.limb([armX, proportions.elbowY, 0], [armX, proportions.wristY, 0], 0.058, 0.05, { seg: 8 }),
      builder.paint(COSTUME_PALETTE.leather, { c2: COSTUME_PALETTE.leatherLight, gloss: 0.3, mat: MATERIAL_KINDS.leather }),
      builder.lathe(
        [
          [proportions.wristY - 0.01, 0.058, 0.058, armX, 0],
          [proportions.wristY + 0.02, 0.066, 0.066, armX, 0],
          [proportions.wristY + 0.16, 0.07, 0.07, armX, 0],
          [proportions.wristY + 0.175, 0.06, 0.06, armX, 0],
        ],
        { seg: 8 },
      ),
      builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
      emitScaledTorus(builder, armX, proportions.wristY + 0.09, 0, 0.07, 0.07, 0.009, 0.022, 8))
  }),
    builder.paint(COSTUME_PALETTE.skin, { glow: 0.06, ao: 0.9, mat: MATERIAL_KINDS.skin }),
    emitHand(builder, skeleton, 1, 0.054),
    emitHand(builder, skeleton, -1, 0.054),
    builder.bone(joints.chest),
    builder.g(composeMatrix(0, 1.18, -0.23, 0, 0, -52), () => {
      ;(builder.paint(COSTUME_PALETTE.tube, { c2: COSTUME_PALETTE.tubeDark, gloss: 0.55, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, -0.34, 0, 0.05],
            [0, 0.34, 0, 0.05],
          ],
          { seg: 8 },
        ),
        builder.paint(COSTUME_PALETTE.bronze, { c2: COSTUME_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }))
      for (const outerRingY of [-0.34, 0.34])
        builder.tube(
          [
            [0, outerRingY - 0.03, 0, 0.056],
            [0, outerRingY + 0.03, 0, 0.056],
          ],
          { seg: 8, crease: 30 },
        )
      ;(builder.tube(
        [
          [0, 0.37, 0, 0.03],
          [0, 0.4, 0, 0.012],
        ],
        { seg: 6 },
      ),
        builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }))
      for (const innerRingY of [-0.14, 0.14])
        builder.tube(
          [
            [0, innerRingY - 0.012, 0, 0.054],
            [0, innerRingY + 0.012, 0, 0.054],
          ],
          { seg: 8, cap0: !1, cap1: !1 },
        )
    }))
  const surfaceProfile = buildHeadSurface(builder, skeleton, COSTUME_PALETTE.skin, computed, 0.25, 0.98),
    headCenterY = surfaceProfile.cy
  ;(buildFaceFeatures(builder, skeleton, surfaceProfile, {
    iris: 1971730,
    irisGlow: 0.04,
    irisSize: 0.6,
    brow: COSTUME_PALETTE.hair,
    browTilt: 16,
    browH: 0.02,
    browLen: 1.12,
    eyeW: 0.05,
    eyeH: 0.034,
    slant: 8,
    lash: 0.017,
    lip: 10117200,
    skin: COSTUME_PALETTE.skin,
    nose: 0.85,
    ears: !0,
    mouthW: 0.8,
    smile: -0.2,
    lite: !0,
  }),
    emitHeadFurMane(builder, skeleton, surfaceProfile, { c: COSTUME_PALETTE.hair, c2: COSTUME_PALETTE.hairHi, thick: 0.026, gloss: 0.3, line: (heightRatio) => (heightRatio < 0.8 ? 0.15 : heightRatio < 1.35 ? lerpValue(0.15, -0.08, (heightRatio - 0.8) / 0.55) : -0.3) }),
    builder.bone(joints.head).paint(COSTUME_PALETTE.hair, { c2: COSTUME_PALETTE.hairHi, gloss: 0.3, mat: MATERIAL_KINDS.fur }),
    builder.ball(0, headCenterY + 0.2, -0.17, 0.08, 0.075, 0.08, 1),
    builder.ball(0, headCenterY + 0.25, -0.21, 0.055, 0.05, 0.055, 1))
  for (const [coordX, coordY, coordZ] of [
    [0.12, 0.15, 0.03],
    [-0.13, 0.12, -0.03],
    [0.19, 0.22, 0.01],
    [-0.19, 0.2, -0.01],
  ]) {
    const sum = headCenterY + 0.15
    emitTaperedTube(builder, [coordX, sum, surfaceProfile.surf(coordX, sum) - 0.01], [coordX * 0.3, -1, 0.3], coordY, 0.03, { curl: [coordZ, 0.02, 0.08], n: 3, seg: 4, flat: 0.45, up: [1, 0, 0], tip: 0.15 })
  }
  ;(builder.paint(COSTUME_PALETTE.scarf, { c2: COSTUME_PALETTE.scarfShade, mat: MATERIAL_KINDS.cloth }),
    builder.g(composeMatrix(0, headCenterY + 0.2, -0.15, 50, 0, 0), () => builder.torus(0.074, 0.016, 0.02, 10, 3)),
    builder.tube(
      [
        [0.02, headCenterY + 0.19, -0.24, 0.024, 0.006],
        [0.05, headCenterY + 0.08, -0.29, 0.03, 0.006],
        [0.08, headCenterY - 0.04, -0.3, 0.034, 0.005],
      ],
      { seg: 4, up: [1, 0, 0] },
    ),
    builder.tube(
      [
        [-0.02, headCenterY + 0.19, -0.24, 0.024, 0.006],
        [-0.06, headCenterY + 0.1, -0.3, 0.03, 0.006],
        [-0.11, headCenterY + 0.01, -0.31, 0.034, 0.005],
      ],
      { seg: 4, up: [1, 0, 0] },
    ),
    builder.bone(joints.chest).paint(COSTUME_PALETTE.scarf, { c2: COSTUME_PALETTE.scarfShade, mat: MATERIAL_KINDS.cloth }),
    builder.g(composeMatrix(0, 1.455, 0, 8, 0, 0, 1, 1, 0.92), () => builder.torus(0.13, 0.05, 0.05, 12, 5)))
  const scaledValueX = (progress) => (0.1 + 0.06 * Math.sin(progress * Math.PI * 0.7)) * (1 - 0.4 * Math.pow(progress, 3)),
    ratioX = (primary, secondary) => Math.pow(clampUnitInput((1 - secondary) / 0.55), 1.3)
  ;(builder.bind(makeChainColorBinder(scarfChain, entries, joints.chest)).paint(COSTUME_PALETTE.scarf, { c2: COSTUME_PALETTE.ink, mat: MATERIAL_KINDS.cloth, by: ratioX }),
    emitGradientRibbon(builder, entries, { width: scaledValueX, bow: [0, 0.03, 0], wave: 0.4, nu: 4, nv: 14, tail: "swallow", tailLen: 0.26 }),
    builder.bind(makeChainColorBinder(scarfBChain, entriesX, joints.chest)).paint(COSTUME_PALETTE.scarf, { c2: COSTUME_PALETTE.ink, mat: MATERIAL_KINDS.cloth, by: (primaryZ, secondaryZ) => ratioX(primaryZ, secondaryZ + 0.2) }),
    emitGradientRibbon(builder, entriesX, { width: (ribbonProgress) => 0.08 * (1 - 0.4 * ribbonProgress), bow: [0, 0.02, 0], wave: 0.35, nu: 3, nv: 8, tail: "swallow", tailLen: 0.18 }))
  const emitStaff = (coordX, coordY, coordZ, fanWidth, hasMetalRing) => {
    ;(builder.bone(coordX),
      builder.g(composeMatrix(coordY, proportions.handY, 0), () => {
        ;(builder.paint(COSTUME_PALETTE.leather, { c2: COSTUME_PALETTE.suitDark, mat: MATERIAL_KINDS.leather }),
          builder.tube(
            [
              [0, 0, -0.06, 0.02],
              [0, 0, 0.1, 0.019],
            ],
            { seg: 6 },
          ),
          builder.paint(COSTUME_PALETTE.bronze, { c2: COSTUME_PALETTE.bronzeDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.tube(
            [
              [0, 0, -0.06, 0.026, 0.05],
              [0, 0, -0.08, 0.026, 0.05],
            ],
            { seg: 6, crease: 30 },
          ),
          hasMetalRing ? builder.g(composeMatrix(0, 0, 0.14, 0, 90, 0), () => builder.torus(0.036, 0.009, 0.01, 8, 3, { crease: 30 })) : builder.ball(0, 0, 0.115, 0.022, 0.022, 0.024, 0),
          builder.paint(hasMetalRing ? COSTUME_PALETTE.steel : COSTUME_PALETTE.plain, { c2: COSTUME_PALETTE.steelDark, gloss: 1, mat: MATERIAL_KINDS.metal }))
        const entriesEnd = []
        for (let ribIndex = 0; ribIndex <= 6; ribIndex++) {
          const ratioWidth = ribIndex / 6,
            sumFar = fanWidth * 0.5 * Math.pow(Math.sin(Math.PI * (0.22 + ratioWidth * 0.78)), 0.7)
          entriesEnd.push([0, 0, -0.08 - ratioWidth * coordZ, 0.012 * (1 - ratioWidth * 0.6), Math.max(0.004, sumFar)])
        }
        ;(builder.tube(entriesEnd, { seg: 4, up: [0, 1, 0], crease: 0 }),
          hasMetalRing &&
            (builder.paint(COSTUME_PALETTE.edge, { glow: 0.25, gloss: 1, mat: MATERIAL_KINDS.metal, line: 0 }),
            builder.tube(
              entriesEnd.slice(1).map((samplesOuter) => [samplesOuter[0], samplesOuter[1] - samplesOuter[4] * 0.92, samplesOuter[2], 0.004, 0.006]),
              { seg: 3, up: [0, 1, 0], crease: 0 },
            )))
      }))
  }
  ;(emitStaff(joints.propR, -proportions.shoulderX, 0.42, 0.09, !0), emitStaff(joints.propL, proportions.shoulderX, 0.28, 0.06, !1), builder.bone(furlJoint))
  const furlJointAt = (rowIndex) => (rowIndex <= 0 ? furlJoint : samples[Math.min(FURL_ROW_COUNT, rowIndex) - 1]),
    scaledValueY = (primary, secondary) => {
      const delta = clampUnitInput((proportions.handY - 0.02 - secondary) / YEQUE_ARM_SPAN_SCALE) * FURL_ROW_COUNT,
        deltaX = Math.min(FURL_ROW_COUNT - 1, Math.floor(delta + 1e-4))
      return [furlJointAt(deltaX), furlJointAt(deltaX + 1), clampUnitInput(1 - (delta - deltaX))]
    }
  return (
    builder.g(composeMatrix(proportions.shoulderX, proportions.handY - 0.02, 0), () => {
      ;(builder.paint(COSTUME_PALETTE.tube, { c2: COSTUME_PALETTE.tubeDark, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [-0.22, 0, 0.03, 0.02],
            [0.22, 0, 0.03, 0.02],
          ],
          { seg: 5 },
        ))
      const lerpedV11 = (coordX, coordY, coordZ = 0) => [lerpValue(-0.2, 0.2, coordX), -coordY * YEQUE_ARM_SPAN_SCALE, 0.05 + 0.3 * Math.sin(coordY * Math.PI * 0.55) + coordZ]
      ;(builder.bind(scaledValueY).paint(COSTUME_PALETTE.silk, { c2: COSTUME_PALETTE.silkShade, mat: MATERIAL_KINDS.cloth, by: (primaryWidth, secondaryWidth) => clampUnitInput((proportions.handY - 0.02 - secondaryWidth) / YEQUE_ARM_SPAN_SCALE) }), builder.sheet(2, FURL_ROW_COUNT, (primaryV8, secondaryV10) => lerpedV11(primaryV8, secondaryV10)), builder.paint(COSTUME_PALETTE.ink, { mat: MATERIAL_KINDS.cloth, line: 0 }))
      for (const [primaryV9, secondaryV11] of [
        [0.3, 0.06],
        [0.55, 0.04],
      ]) {
        const entriesNear = []
        for (let pleatIndex = 0; pleatIndex <= 6; pleatIndex++) {
          const scaledValueInner = 0.1 + (pleatIndex / 6) * 0.8,
            deltaOuter = primaryV9 - secondaryV11 * Math.abs(Math.sin(pleatIndex * 1.7)),
            bResult = lerpedV11(scaledValueInner, deltaOuter, 0.006)
          entriesNear.push([bResult[0], bResult[1], bResult[2], 0.006, 0.003])
        }
        builder.tube(entriesNear, { seg: 3, up: [0, 0, 1] })
      }
      builder.bone(samples[FURL_ROW_COUNT - 1]).paint(COSTUME_PALETTE.tube, { c2: COSTUME_PALETTE.tubeDark, gloss: 0.5, mat: MATERIAL_KINDS.leather })
      const bBResult = lerpedV11(0.5, 1)
      ;(builder.tube(
        [
          [-0.21, bBResult[1], bBResult[2], 0.024],
          [0.21, bBResult[1], bBResult[2], 0.024],
        ],
        { seg: 5 },
      ),
        builder.paint(COSTUME_PALETTE.silkShade, { c2: COSTUME_PALETTE.silk, mat: MATERIAL_KINDS.cloth }),
        builder.tube(
          [
            [-0.19, bBResult[1], bBResult[2], 0.034],
            [0.19, bBResult[1], bBResult[2], 0.034],
          ],
          { seg: 6 },
        ))
    }),
    builder.bakeGrounding(2.05, 0.72, 0.88),
    { h: skeleton, b: builder, extra: { furl: furlJoint, furlRows: samples, furlPts: fromResult } }
  )
}

/**
 * 项羽装束附件静态形状：运行时 extra 仅含 gripR/aim/gripL 三个关节索引，
 * 但预览模块按关节索引读取 head/clavL/... 等字段。此处仅补齐静态类型形状，
 * 不产生任何运行时字段（断言在编译期擦除）。
 */
interface XiangYuExtraJoints {
  gripR: number
  aim: number
  gripL: number
  head: number
  clavL: number
  clavR: number
  armL: number
  armR: number
  chest: number
  hips: number
  foreL: number
  foreR: number
  thighL: number
  thighR: number
  shinL: number
  shinR: number
}

/**
 * 创建模型。
 *
 */
function buildXiangYuModel() {
  const skeleton = buildSkeleton(WARRIOR_PROPORTIONS),
    { rig: rig, J: joints, d: proportions } = skeleton,
    builder = new ModelBuilder(),
    gripRJoint = rig.add("gripR", joints.chest, 0, proportions.chestY, 0),
    aimJoint = rig.add("aim", joints.chest, 0, proportions.chestY, 0),
    gripLJoint = rig.add("gripL", joints.chest, 0, proportions.chestY, 0),
    sum = proportions.headY + 0.25,
    entries = [
      [0, sum + 0.33, -0.01],
      [0, sum + 0.45, -0.04],
      [0, sum + 0.56, -0.08],
    ],
    ponyChain = rig.addChain("pony", joints.head, entries.slice(0, 2))
  rig.chain({ joints: ponyChain, tip: [0, 0.11, -0.04], stiffness: 9, drag: 0.86, gravity: 6, maxAngle: 50, wind: 1.6 })
  const entriesX = [
      [0, 1.4, -0.16],
      [0, 1.17, -0.29],
      [0, 0.93, -0.35],
      [0, 0.7, -0.38],
      [0, 0.48, -0.39],
    ],
    scarfChain = rig.addChain("scarf", joints.chest, entriesX.slice(0, 4))
  rig.chain({
    joints: scarfChain,
    tip: [0, -0.22, -0.01],
    stiffness: 3.2,
    drag: 0.92,
    gravity: 8,
    maxAngle: 72,
    wind: 2.6,
    colliders: [
      { joint: joints.chest, x: 0, y: 0, z: 0.02, r: 0.3 },
      { joint: joints.hips, x: 0, y: 0, z: 0, r: 0.3 },
    ],
  })
  const entriesY = [
      [0.23, 0.96, 0.1],
      [0.28, 0.76, 0.11],
      [0.29, 0.56, 0.09],
      [0.29, 0.38, 0.08],
    ],
    sashChain = rig.addChain("sash", joints.hips, entriesY.slice(0, 3))
  rig.chain({ joints: sashChain, tip: [0, -0.18, -0.01], stiffness: 6, drag: 0.88, gravity: 10, maxAngle: 60, wind: 1 })
  const entriesZ = [
      [0, 0.9, 0.2],
      [0, 0.7, 0.225],
      [0, 0.5, 0.23],
      [0, 0.34, 0.23],
    ],
    tabChain = rig.addChain("tab", joints.hips, entriesZ.slice(0, 3))
  rig.chain({ joints: tabChain, tip: [0, -0.16, 0], stiffness: 8, drag: 0.86, gravity: 10, maxAngle: 50, wind: 0.8 })
  const entriesWidth = [
      [0, 0.9, -0.19],
      [0, 0.68, -0.23],
      [0, 0.46, -0.24],
      [0, 0.3, -0.24],
    ],
    tailChain = rig.addChain("tail", joints.hips, entriesWidth.slice(0, 3))
  rig.chain({ joints: tailChain, tip: [0, -0.16, 0], stiffness: 6, drag: 0.88, gravity: 10, maxAngle: 60, wind: 1 })
  const entriesHeight = [
      [-proportions.shoulderX, proportions.handY - 0.03, 1.1],
      [-proportions.shoulderX, proportions.handY - 0.17, 1.1],
      [-proportions.shoulderX, proportions.handY - 0.31, 1.1],
    ],
    tasselChain = rig.addChain("tassel", joints.propR, entriesHeight.slice(0, 2))
  ;(rig.chain({ joints: tasselChain, tip: [0, -0.14, 0], stiffness: 2.5, drag: 0.9, gravity: 14, maxAngle: 150, wind: 1.2 }),
    builder.sym((sideSign) => {
      const hipX = proportions.hipX
      ;(builder.bone(sideSign > 0 ? joints.thighL : joints.thighR).paint(XIANGYU_PALETTE_ALIAS.robeDark, { c2: XIANGYU_PALETTE_ALIAS.robe, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }), builder.limb([hipX, proportions.hipY + 0.04, 0], [hipX, proportions.kneeY, 0], 0.15, 0.115, { seg: 8, bulge: 0.06 }))
    }))
  for (const item of [1, -1]) {
    ;(builder.paint(XIANGYU_PALETTE_ALIAS.leatherDark, { c2: XIANGYU_PALETTE_ALIAS.leather, gloss: 0.25, mat: MATERIAL_KINDS.leather }), emitShinFoot(builder, skeleton, item, { top: 0.44, rTop: 0.128, rAnkle: 0.094, len: 0.26 }))
    const items = item > 0 ? joints.shinL : joints.shinR
    ;(builder.bone(items).paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.6, mat: MATERIAL_KINDS.metal }),
      builder.sheet(3, 2, (primaryV10, secondaryV12) => {
        const lerpedV12 = lerpValue(40, 140, primaryV10) * MODEL_ANGLE_TO_RAD,
          lerpedV13 = lerpValue(0.108, 0.138, secondaryV12) + 0.012
        return [item * proportions.hipX + Math.cos(lerpedV12) * lerpedV13, lerpValue(0.16, 0.45, secondaryV12), Math.sin(lerpedV12) * lerpedV13]
      }),
      builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
      builder.lathe(
        [
          [0.428, 0.132, 0.132, item * proportions.hipX, 0],
          [0.446, 0.14, 0.14, item * proportions.hipX, 0],
          [0.464, 0.13, 0.13, item * proportions.hipX, 0],
        ],
        { seg: 8, cap0: !1, cap1: !1, crease: 30 },
      ),
      builder.ball(item * proportions.hipX, proportions.kneeY + 0.03, 0.13, 0.04, 0.046, 0.026, 0))
  }
  const entriesDepth = [
      [0.76, 0.13, 0.12, 0, 0],
      [0.83, 0.235, 0.19, 0, 0.005],
      [0.92, 0.262, 0.225, 0, 0.026],
      [1.02, 0.268, 0.24, 0, 0.042],
      [1.12, 0.272, 0.225, 0, 0.026],
      [1.22, 0.285, 0.2, 0, 0.008],
      [1.33, 0.295, 0.19, 0, 0],
      [1.39, 0.2, 0.15, 0, 0],
      [1.44, 0.11, 0.105, 0, 0],
    ],
    ratio = (profileHeight) => {
      for (let profileIndex = 1; profileIndex < entriesDepth.length; profileIndex++)
        if (profileHeight <= entriesDepth[profileIndex][0]) {
          const ratio = Math.max(0, (profileHeight - entriesDepth[profileIndex - 1][0]) / (entriesDepth[profileIndex][0] - entriesDepth[profileIndex - 1][0]))
          return [lerpValue(entriesDepth[profileIndex - 1][1], entriesDepth[profileIndex][1], ratio), lerpValue(entriesDepth[profileIndex - 1][2], entriesDepth[profileIndex][2], ratio), lerpValue(entriesDepth[profileIndex - 1][4], entriesDepth[profileIndex][4], ratio)]
        }
      const element = entriesDepth[entriesDepth.length - 1]
      return [element[1], element[2], element[4]]
    },
    sumX = (entries, samples) => entries.map((primaryV11, secondaryV13) => [primaryV11, ratio(primaryV11)[0] + samples[secondaryV13], ratio(primaryV11)[1] + samples[secondaryV13], 0, ratio(primaryV11)[2]])
  ;(builder.bind(makeTorsoColorBinder(skeleton)).paint(XIANGYU_PALETTE_ALIAS.robeDark, { c2: XIANGYU_PALETTE_ALIAS.robe, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(entriesDepth, { seg: 12 }),
    builder.bone(joints.neck).paint(XIANGYU_PALETTE_ALIAS.skin, { ao: 0.72, glow: 0.05, mat: MATERIAL_KINDS.skin }),
    builder.lathe(
      [
        [1.4, 0.092, 0.092],
        [1.54, 0.09, 0.092],
      ],
      { seg: 8, cap0: !1 },
    ),
    builder.bind(makeTorsoColorBinder(skeleton)).paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.6, ao: 0.8, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 11, patternAmt: 0.22 }),
    builder.lathe(sumX([1.03, 1.06, 1.14, 1.24, 1.34, 1.385], [0.012, 0.03, 0.026, 0.022, 0.022, 0.012]), { seg: 12, cap0: !1 }),
    builder.bone(joints.chest),
    builder.sym(() => {
      builder.g(composeMatrix(0.125, 1.25, ratio(1.25)[1] * 0.93 + 0.02, -6, 16, 0), () => {
        ;(builder.paint(XIANGYU_PALETTE_ALIAS.brassDark, { c2: XIANGYU_PALETTE_ALIAS.brass, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.g(composeMatrix(0, 0, 0, 90, 0, 0), () =>
            builder.lathe(
              [
                [0, 0.1],
                [0.018, 0.094],
                [0.03, 0.07],
                [0.036, 0.02],
              ],
              { seg: 10, cap0: !1 },
            ),
          ),
          builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: 16765562, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.g(composeMatrix(0, 0, 0.012, 90, 0, 0), () => builder.torus(0.098, 0.014, 0.012, 10, 3, { crease: 30 })))
      })
    }),
    builder.bone(joints.spine).paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
    builder.g(composeMatrix(0, 1.07, ratio(1.07)[1] + ratio(1.07)[2] + 0.028, 6, 0, 0), () => {
      ;(builder.extrude(
        [
          [-0.1, 0.075],
          [0, 0.1],
          [0.1, 0.075],
          [0.115, 0],
          [0.07, -0.085],
          [0, -0.11],
          [-0.07, -0.085],
          [-0.115, 0],
        ],
        0.04,
        0.016,
      ),
        builder.paint(XIANGYU_PALETTE_ALIAS.brassDark, { c2: XIANGYU_PALETTE_ALIAS.brass, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.sym(() => builder.g(composeMatrix(0.046, 0.03, 0.024, 0, 0, 16), () => builder.box(0, 0, 0, 0.07, 0.024, 0.02))),
        builder.ball(0, -0.01, 0.026, 0.024, 0.04, 0.018, 0),
        builder.sym(() => builder.ball(0.045, -0.058, 0.022, 0.016, 0.022, 0.012, 0)))
    }),
    builder.bone(joints.spine).paint(XIANGYU_PALETTE_ALIAS.leather, { c2: XIANGYU_PALETTE_ALIAS.leatherDark, gloss: 0.25, mat: MATERIAL_KINDS.leather }),
    builder.lathe(sumX([0.9, 0.915, 1, 1.015], [0.022, 0.036, 0.036, 0.022]), { seg: 12 }),
    builder.bone(joints.hips).paint(XIANGYU_PALETTE_ALIAS.redLight, { c2: XIANGYU_PALETTE_ALIAS.red, mat: MATERIAL_KINDS.cloth }),
    builder.ball(0.24, 0.965, 0.1, 0.06, 0.05, 0.052, 1),
    builder.bind(makeChainColorBinder(sashChain, entriesY, joints.hips)).paint(XIANGYU_PALETTE_ALIAS.red, { c2: XIANGYU_PALETTE_ALIAS.redDark, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, entriesY, { width: (ribbonProgress) => lerpNumeric(0.05, 0.075, ribbonProgress), axis: [0, 0, 1], bow: [0.02, 0, 0], nu: 2, nv: 5, tail: "point", tailLen: 0.1 }))
  const emitChainRibbon = (coordX, entries, coordZ, upperWidth, bowDepth, tailLength) => {
    builder.bind(makeChainColorBinder(coordX, entries, joints.hips)).paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth })
    const bowedEntries = entries.map((samplesV2) => [samplesV2[0], samplesV2[1], samplesV2[2] - Math.sign(bowDepth) * 0.006])
    ;(emitGradientRibbon(builder, bowedEntries, { width: (ribbonProgress) => lerpNumeric(coordZ, upperWidth, ribbonProgress) + 0.024, bow: [0, 0, bowDepth], nu: 2, nv: 5, tail: "swallow", tailLen: tailLength + 0.03 }),
      builder.paint(XIANGYU_PALETTE_ALIAS.red, { c2: XIANGYU_PALETTE_ALIAS.redDark, mat: MATERIAL_KINDS.cloth }),
      emitGradientRibbon(builder, entries, { width: (ribbonProgress) => lerpNumeric(coordZ, upperWidth, ribbonProgress), bow: [0, 0, bowDepth], nu: 4, nv: 5, tail: "swallow", tailLen: tailLength }))
  }
  ;(emitChainRibbon(tabChain, entriesZ, 0.14, 0.115, 0.035, 0.1),
    emitChainRibbon(tailChain, entriesWidth, 0.17, 0.14, -0.035, 0.11),
    builder.sym(() => {
      ;(builder.bone(joints.hips).paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.6, ao: 0.78, ao2: 1, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.scale, patternScale: 11, patternAmt: 0.22 }),
        builder.sheet(4, 2, (primaryV12, secondaryV14) => {
          const lerpedV14 = lerpValue(-64, 64, primaryV12) * MODEL_ANGLE_TO_RAD,
            lerpedV15 = lerpValue(0.262, 0.3, secondaryV14)
          return [Math.cos(lerpedV14) * lerpedV15, lerpValue(0.92, 0.66, secondaryV14) + (Math.round(primaryV12 * 4) % 2 === 0 ? 0.014 * secondaryV14 : 0), Math.sin(lerpedV14) * lerpedV15 * 0.82]
        }),
        builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [-64, 0, 64].map((angleDeg) => [Math.cos(angleDeg * MODEL_ANGLE_TO_RAD) * 0.306, 0.662, Math.sin(angleDeg * MODEL_ANGLE_TO_RAD) * 0.306 * 0.82, 0.014, 0.012]),
          { seg: 4, up: [0, 1, 0] },
        ))
    }),
    builder.sym((sideSign) => {
      const armX = proportions.shoulderX
      ;(builder.bone(sideSign > 0 ? joints.armL : joints.armR).paint(XIANGYU_PALETTE_ALIAS.red, { c2: XIANGYU_PALETTE_ALIAS.redDark, ao: 0.88, ao2: 1, mat: MATERIAL_KINDS.cloth }),
        builder.limb([armX, proportions.shoulderY + 0.04, 0], [armX, proportions.elbowY - 0.02, 0], 0.112, 0.094, { seg: 8, bulge: 0.06 }),
        builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
        builder.lathe(
          [
            [proportions.elbowY + 0.07, 0.101, 0.101, armX, 0],
            [proportions.elbowY + 0.085, 0.108, 0.108, armX, 0],
            [proportions.elbowY + 0.115, 0.108, 0.108, armX, 0],
            [proportions.elbowY + 0.13, 0.103, 0.103, armX, 0],
          ],
          { seg: 8, cap0: !1, cap1: !1 },
        ),
        builder.bone(sideSign > 0 ? joints.foreL : joints.foreR).paint(XIANGYU_PALETTE_ALIAS.redDark, { c2: XIANGYU_PALETTE_ALIAS.red, mat: MATERIAL_KINDS.cloth }),
        builder.ball(armX, proportions.elbowY, 0, 0.096, 0.094, 0.096, 1),
        builder.limb([armX, proportions.elbowY, 0], [armX, proportions.wristY + 0.16, 0], 0.092, 0.096, { seg: 8 }),
        builder.paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.6, mat: MATERIAL_KINDS.metal }),
        builder.lathe(
          [
            [proportions.wristY - 0.01, 0.082, 0.082, armX, 0],
            [proportions.wristY + 0.03, 0.098, 0.098, armX, 0],
            [proportions.wristY + 0.18, 0.106, 0.106, armX, 0],
            [proportions.wristY + 0.2, 0.09, 0.09, armX, 0],
          ],
          { seg: 8 },
        ),
        builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }))
      for (const cuffY of [proportions.wristY + 0.02, proportions.wristY + 0.165])
        builder.lathe(
          [
            [cuffY, 0.102, 0.102, armX, 0],
            [cuffY + 0.014, 0.112, 0.112, armX, 0],
            [cuffY + 0.028, 0.104, 0.104, armX, 0],
          ],
          { seg: 8, cap0: !1, cap1: !1, crease: 30 },
        )
    }),
    builder.paint(XIANGYU_PALETTE_ALIAS.skin, { glow: 0.05, ao: 0.9, mat: MATERIAL_KINDS.skin }),
    emitHand(builder, skeleton, 1, 0.078),
    emitHand(builder, skeleton, -1, 0.078))
  const emitArmGuard = (coordX, coordY, coordZ, guardHeight, guardHalfWidth, guardHalfDepth, tiltAngle) => {
    ;(builder.bone(coordX).paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.6, ao: 0.8, ao2: 1, mat: MATERIAL_KINDS.metal }),
      builder.g(composeMatrix(coordY, coordZ, 0, 0, 0, tiltAngle), () => {
        ;(builder.lathe(
          [
            [-guardHalfWidth * 0.34, guardHeight, guardHalfDepth],
            [-guardHalfWidth * 0.1, guardHeight * 1.02, guardHalfDepth * 1.02],
            [guardHalfWidth * 0.6, guardHeight * 0.72, guardHalfDepth * 0.72],
            [guardHalfWidth, guardHeight * 0.18, guardHalfDepth * 0.18],
          ],
          { seg: 10, crease: 50 },
        ),
          builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
          builder.lathe(
            [
              [-guardHalfWidth * 0.42, guardHeight * 0.98, guardHalfDepth * 0.98],
              [-guardHalfWidth * 0.3, guardHeight * 1.05, guardHalfDepth * 1.05],
              [-guardHalfWidth * 0.16, guardHeight * 1.03, guardHalfDepth * 1.03],
            ],
            { seg: 10, cap0: !1, cap1: !1, crease: 30 },
          ))
      }))
  }
  ;(builder.sym((sideSign) => {
    ;(emitArmGuard(sideSign > 0 ? joints.armL : joints.armR, 0.4, 1.3, 0.15, 0.085, 0.155, -44), emitArmGuard(sideSign > 0 ? joints.clavL : joints.clavR, 0.355, 1.435, 0.2, 0.13, 0.19, -18))
  }),
    builder.bone(joints.chest).paint(XIANGYU_PALETTE_ALIAS.redDark, { c2: XIANGYU_PALETTE_ALIAS.red, ao: 0.9, mat: MATERIAL_KINDS.cloth }),
    builder.lathe(
      [
        [1.33, 0.3, 0.215],
        [1.37, 0.27, 0.2],
        [1.42, 0.19, 0.16],
        [1.47, 0.135, 0.13],
      ],
      { seg: 12, cap0: !1, cap1: !1, shape: (angle) => 1 + 0.03 * Math.sin(angle * 6) },
    ),
    builder.paint(XIANGYU_PALETTE_ALIAS.redLight, { c2: XIANGYU_PALETTE_ALIAS.red, mat: MATERIAL_KINDS.cloth }),
    builder.g(composeMatrix(0, 1.47, 0.012, 12, 0, 0, 1, 1, 0.92), () => builder.torus(0.142, 0.052, 0.046, 10, 4)),
    builder.ball(0, 1.425, 0.16, 0.048, 0.04, 0.036, 0, 180),
    builder.sym(() =>
      builder.tube(
        [
          [0.02, 1.42, 0.165, 0.03, 0.012],
          [0.07, 1.34, 0.19, 0.034, 0.012],
          [0.08, 1.27, 0.2, 0.012, 0.008],
        ],
        { seg: 4, up: [1, 0, 0] },
      ),
    ),
    builder.bind(makeChainColorBinder(scarfChain, entriesX, joints.chest)).paint(XIANGYU_PALETTE_ALIAS.red, { c2: XIANGYU_PALETTE_ALIAS.redDark, mat: MATERIAL_KINDS.cloth }))
  const scarfWidthAt = (progress) => lerpNumeric(0.25, 0.37, Math.sin(progress * Math.PI * 0.5)),
    entriesStart = [0, 0.25, 0.5, 0.75, 0.9].map((sampleRatio) => sampleColorGradient(entriesX, sampleRatio))
  ;(emitGradientRibbon(builder, entriesStart, { width: (ribbonProgress) => scarfWidthAt(ribbonProgress * 0.9), bow: [0, 0, -0.07], wave: 0.22, nu: 6, nv: 8, tail: "flat" }),
    builder.paint(16777215, { team: 1, mat: MATERIAL_KINDS.cloth }),
    emitGradientRibbon(builder, [sampleColorGradient(entriesX, 0.9), sampleColorGradient(entriesX, 0.95), sampleColorGradient(entriesX, 1)], { width: (ribbonProgress) => scarfWidthAt(0.9 + ribbonProgress * 0.1), bow: [0, 0, -0.07], nu: 6, nv: 2, tail: "flat" }))
  const surfaceProfile = buildHeadSurface(builder, skeleton, XIANGYU_PALETTE_ALIAS.skin, 1, 0.25, 1.1)
  ;(buildFaceFeatures(builder, skeleton, surfaceProfile, {
    iris: 3810322,
    irisGlow: 0.05,
    irisSize: 0.6,
    brow: XIANGYU_PALETTE_ALIAS.beard,
    browTilt: 5,
    browH: 0.03,
    browLen: 1.05,
    eyeW: 0.05,
    eyeH: 0.046,
    slant: 2,
    lash: 0.014,
    lip: 8140070,
    skin: XIANGYU_PALETTE_ALIAS.skin,
    nose: 1.3,
    ears: !0,
    mouthW: 1.75,
    smile: 1,
    open: 0.85,
    lite: !0,
  }),
    emitFacialFur(builder, skeleton, surfaceProfile, { c: XIANGYU_PALETTE_ALIAS.beard, c2: XIANGYU_PALETTE_ALIAS.beardHi, spread: 1.5, thick: 0.075, drop: 0.06, tufts: 9, len: 0.075, tuftR: 0.058, puff: 0.15, mustache: 0.095, mustacheR: 0.017, curl: 0.034, gloss: 0 }))
  {
    const sumY = (primary, secondary) => {
      const samples = surfaceProfile.ring(primary)
      return [surfaceProfile.cy + primary, samples[0] + secondary, samples[1] + secondary, 0, samples[2]]
    }
    ;(builder.bone(joints.head).paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.7, mat: MATERIAL_KINDS.metal }),
      builder.lathe([sumY(0.085, 0.07), sumY(0.1, 0.045), sumY(0.17, 0.04), sumY(0.225, 0.045), [surfaceProfile.cy + 0.275, 0.13, 0.135, 0, -0.016], [surfaceProfile.cy + 0.305, 0.05, 0.05, 0, -0.018]], { seg: 14, cap0: !1 }),
      builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
      builder.lathe([sumY(0.1, 0.05), sumY(0.117, 0.062), sumY(0.134, 0.047)], { seg: 14, cap0: !1, cap1: !1, crease: 30 }),
      builder.lathe(
        [
          [surfaceProfile.cy + 0.295, 0.06],
          [surfaceProfile.cy + 0.32, 0.045],
          [surfaceProfile.cy + 0.345, 0.03],
        ],
        { seg: 8, cap0: !1 },
      ),
      builder.ball(0, surfaceProfile.cy + 0.165, surfaceProfile.surf(0, surfaceProfile.cy + 0.165) + 0.045, 0.04, 0.04, 0.02, 0, 180),
      builder.paint(XIANGYU_PALETTE_ALIAS.ironDark, { c2: XIANGYU_PALETTE_ALIAS.ironLight, gloss: 0.7, mat: MATERIAL_KINDS.metal }))
    const samples = surfaceProfile.ring(0.05)
    ;(builder.sym(() =>
      builder.g(composeMatrix(samples[0] + 0.04, surfaceProfile.cy + 0.03, samples[2] - 0.03, -24, 96, 0), () =>
        builder.extrude(
          [
            [-0.1, 0.09],
            [0.1, 0.09],
            [0.11, -0.03],
            [0.04, -0.13],
            [-0.06, -0.11],
            [-0.11, -0.01],
          ],
          0.022,
          0.009,
        ),
      ),
    ),
      builder.g(composeMatrix(0, surfaceProfile.cy + 0, samples[2] - samples[1] - 0.045, -20, 180, 0), () =>
        builder.extrude(
          [
            [-0.15, 0.1],
            [0.15, 0.1],
            [0.17, -0.03],
            [0.08, -0.11],
            [-0.08, -0.11],
            [-0.17, -0.03],
          ],
          0.022,
          0.009,
        ),
      ))
  }
  builder.bind(makeChainColorBinder(ponyChain, entries, joints.head)).paint(XIANGYU_PALETTE_ALIAS.redLight, { c2: XIANGYU_PALETTE_ALIAS.red, mat: MATERIAL_KINDS.fur })
  const sumZ = surfaceProfile.cy + 0.34
  ;(builder.ball(0, sumZ + 0.035, -0.015, 0.06, 0.05, 0.06, 1), emitTaperedTube(builder, [0, sumZ + 0.03, -0.015], [0, 1, -0.2], 0.22, 0.06, { n: 3, seg: 5, curl: [0, -0.1, -0.25], tip: 0.35 }))
  for (let index = 0; index < 7; index++) {
    const scaledValueX = (index / 7) * Math.PI * 2 + 0.5
    emitTaperedTube(builder, [Math.cos(scaledValueX) * 0.03, sumZ + 0.04, Math.sin(scaledValueX) * 0.03 - 0.015], [Math.cos(scaledValueX) * 0.9, 0.75, Math.sin(scaledValueX) * 0.9 - 0.1], 0.24, 0.05, {
      n: 3,
      seg: 4,
      curl: [Math.cos(scaledValueX) * 0.1, -1, Math.sin(scaledValueX) * 0.1],
      up: [-Math.sin(scaledValueX), 0, Math.cos(scaledValueX)],
      tip: 0.3,
    })
  }
  ;(builder.bone(joints.propR),
    builder.g(composeMatrix(-proportions.shoulderX, proportions.handY, 0), () => {
      // 戟杆：柘木，黑漆
      ;(builder.paint(XIANGYU_PALETTE_ALIAS.shaft, { c2: XIANGYU_PALETTE_ALIAS.shaftDark, gloss: 0.28, mat: MATERIAL_KINDS.leather }),
        builder.tube(
          [
            [0, 0, -0.46, 0.031],
            [0, 0, 0.36, 0.034],
            [0, 0, 1.38, 0.036],
          ],
          { seg: 6 },
        ),
        // 握把缠绳
        builder.paint(XIANGYU_PALETTE_ALIAS.wrap, { c2: XIANGYU_PALETTE_ALIAS.wrapDark, gloss: 0.2, mat: MATERIAL_KINDS.cloth }),
        builder.tube(
          [
            [0, 0, -0.32, 0.034],
            [0, 0, 0.16, 0.035],
          ],
          { seg: 6, cap0: !1, cap1: !1 },
        ),
        // 尾镦
        builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, -0.58, 0.008],
            [0, 0, -0.52, 0.04],
            [0, 0, -0.44, 0.036],
          ],
          { seg: 6, cap1: !1 },
        ),
        // 矛尖
        builder.paint(XIANGYU_PALETTE_ALIAS.steelDark, { c2: XIANGYU_PALETTE_ALIAS.steel, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, 1.36, 0.03],
            [0, 0, 1.6, 0.028],
            [0, 0, 1.82, 0.016],
            [0, 0, 1.98, 0.002],
          ],
          { seg: 6, cap0: !1 },
        ),
        // 侧月牙（戟枝）
        builder.paint(XIANGYU_PALETTE_ALIAS.steelDark, { c2: XIANGYU_PALETTE_ALIAS.steel, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, 0, 1.44, 0, 0, -30), () =>
          builder.extrude(
            [
              [0.03, 0.07],
              [0.26, 0.2],
              [0.5, 0.18],
              [0.62, 0.03],
              [0.53, -0.1],
              [0.34, -0.06],
              [0.17, -0.08],
              [0.03, -0.06],
            ],
            0.068,
            0.016,
          ),
        ),
        // 金环
        builder.paint(XIANGYU_PALETTE_ALIAS.brass, { c2: XIANGYU_PALETTE_ALIAS.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.g(composeMatrix(0, 0, 1.32, 0, 0, 0), () => builder.torus(0.044, 0.009, 0.013, 8, 3, { crease: 30 })),
        // 红缨
        builder.paint(XIANGYU_PALETTE_ALIAS.tassel, { c2: XIANGYU_PALETTE_ALIAS.tasselDark, mat: MATERIAL_KINDS.fur }),
        builder.tube(
          [
            [0, 0, 1.28, 0.022],
            [0.02, -0.08, 1.17, 0.07],
            [0.032, -0.2, 1.04, 0.024],
          ],
          { seg: 6 },
        ))
    })
  )
  for (let strandIndex = 0; strandIndex < 4; strandIndex++) {
    const scaledValueY = (strandIndex / 4) * Math.PI * 2 + 0.6
    emitTaperedTube(builder, [-proportions.shoulderX + Math.cos(scaledValueY) * 0.03, proportions.handY - 0.03, 1.1 + Math.sin(scaledValueY) * 0.03], [Math.cos(scaledValueY) * 0.25, -1, Math.sin(scaledValueY) * 0.25], 0.3, 0.036, { n: 3, seg: 4, tip: 0.3 })
  }
  // 仅为 extra 补静态类型形状（见 XiangYuExtraJoints）；运行时对象保持原样
  return (builder.bakeGrounding(2.05), { h: skeleton, b: builder, extra: { gripR: gripRJoint, aim: aimJoint, gripL: gripLJoint } as unknown as XiangYuExtraJoints })
}
export { buildSwordsmanModel, buildArcherModel, buildShieldBearerModel, buildRangerModel, buildMageModel, buildXiangYuModel }
