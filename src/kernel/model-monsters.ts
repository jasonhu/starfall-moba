/**
 * 怪物程序化模型构造器（models.ts 拆分）
 * 由 tools/split-models.cjs 从 models.ts 物理拆分，声明文本逐字节保留。
 */

import { Matrix4, Quaternion, Vector3 } from 'three'
import { NodeTree } from './node-tree'
import { JUNGLE_RULES } from './game-balance'
import { inverseLerpClamped, makeBoneChainProjector, poseQuadrupedLegIk, hermiteSmoothStep, hitImpactPulse, easeOutQuad, toRgbChannels, MATERIAL_KINDS, ModelBuilder, smoothStep01, windupEaseCurve, TERRAIN_LOOK, smoothFalloff, QUADRUPED_GAIT_TABLE, poseAllLegsIk, lerpValue, composeMatrix, GEOMETRY_TWO_PI, squareValue } from './starfall.core'

function lerpRgbChannels(coordX, coordY, coordZ) {
  const toRgbChannelsResult = toRgbChannels(coordX),
    rgbChannels = toRgbChannels(coordY)
  return [toRgbChannelsResult[0] + (rgbChannels[0] - toRgbChannelsResult[0]) * coordZ, toRgbChannelsResult[1] + (rgbChannels[1] - toRgbChannelsResult[1]) * coordZ, toRgbChannelsResult[2] + (rgbChannels[2] - toRgbChannelsResult[2]) * coordZ]
}

function buildBeastRig(joints) {
  const nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    pelvisJoint = nodeTree.add("pelvis", rootJoint, 0, joints.pelvis[0], joints.pelvis[1]),
    chestJoint = nodeTree.add("chest", pelvisJoint, 0, joints.chest[0], joints.chest[1]),
    entries = []
  joints.neck.forEach((samples, secondary) => entries.push(nodeTree.add(`neck${secondary}`, secondary === 0 ? chestJoint : entries[secondary - 1], 0, samples[0], samples[1])))
  const headJoint = nodeTree.add("head", entries.length ? entries[entries.length - 1] : chestJoint, 0, joints.head[0], joints.head[1]),
    items = joints.jaw ? nodeTree.add("jaw", headJoint, 0, joints.jaw[0], joints.jaw[1]) : -1,
    entriesX = []
  joints.tail.forEach((samplesX, secondaryX) => entriesX.push(nodeTree.add(`tail${secondaryX}`, secondaryX === 0 ? pelvisJoint : entriesX[secondaryX - 1], samplesX[2] ?? 0, samplesX[0], samplesX[1])))
  const entriesY = [],
    addLegChain = (coordX, samples, coordZ, isFrontLeg) => {
      const upperLegJoint = nodeTree.add(`${coordX}U`, isFrontLeg ? isFrontLeg : pelvisJoint, samples[0][0] * coordZ, samples[0][1], samples[0][2]),
        scaledValueX = nodeTree.add(`${coordX}L`, upperLegJoint, samples[1][0] * coordZ, samples[1][1], samples[1][2]),
        scaledValueY = nodeTree.add(`${coordX}F`, scaledValueX, samples[2][0] * coordZ, samples[2][1], samples[2][2])
      entriesY.push({ upper: upperLegJoint, lower: scaledValueX, foot: scaledValueY, side: coordZ, front: isFrontLeg, bend: isFrontLeg ? joints.bendFront : joints.bendHind, rx: samples[2][0] * coordZ, ry: samples[2][1], rz: samples[2][2] })
    }
  return (addLegChain("fl", joints.front, 1, !0), addLegChain("fr", joints.front, -1, !0), addLegChain("hl", joints.hind, 1, !1), addLegChain("hr", joints.hind, -1, !1), { rig: nodeTree, root: rootJoint, pelvis: pelvisJoint, chest: chestJoint, neck: entries, head: headJoint, jaw: items, tail: entriesX, legs: entriesY })
}

function poseBeastLeg(coordX, coordY, coordZ, upperLegPitch, lowerLegPitch, footPitch = 0, upperLegSpread = 0) {
  const selectedLegs = coordX.legs[coordZ]
  ;(coordY.rot(selectedLegs.upper, upperLegPitch, 0, selectedLegs.side * upperLegSpread), coordY.rot(selectedLegs.lower, lowerLegPitch, 0, 0), coordY.rot(selectedLegs.foot, footPitch, 0, 0))
}

function animateBeastGait(rig, coordY, coordZ, element) {
  const selectedQUADRUPED_GAIT_TABLE = QUADRUPED_GAIT_TABLE[element.style],
    computed = element.amount ?? 1,
    gaitPhase = coordZ * GEOMETRY_TWO_PI,
    scaledValueX = (element.bob ?? 0) * computed,
    scaledValueY = (element.pitch ?? 0) * computed
  element.style === "bound"
    ? (coordY.move(rig.pelvis, 0, scaledValueX * Math.sin(gaitPhase + 2.2), 0), coordY.add(rig.pelvis, scaledValueY * Math.sin(gaitPhase + 0.5), 0, 0), coordY.add(rig.chest, -scaledValueY * 1.5 * Math.sin(gaitPhase + 1), 0, 0))
    : (coordY.move(rig.pelvis, 0, -scaledValueX * Math.cos(gaitPhase * 2), 0),
      coordY.add(rig.pelvis, scaledValueY * Math.sin(gaitPhase * 2 + 0.6), (element.sway ?? 0) * computed * Math.sin(gaitPhase), (element.roll ?? 0) * computed * Math.sin(gaitPhase)),
      coordY.add(rig.chest, 0, -(element.sway ?? 0) * computed * 1.6 * Math.sin(gaitPhase), 0))
  for (let index = 0; index < 4; index++) {
    const pose = rig.legs[index]
    let sum = coordZ + selectedQUADRUPED_GAIT_TABLE.off[index]
    sum -= Math.floor(sum)
    const scaledValueZ = element.stride * selectedQUADRUPED_GAIT_TABLE.duty * computed
    let legSwingAngle,
      computedX = 0,
      computedY = 0
    if (sum < selectedQUADRUPED_GAIT_TABLE.duty) legSwingAngle = scaledValueZ * (0.5 - sum / selectedQUADRUPED_GAIT_TABLE.duty)
    else {
      const delta = (sum - selectedQUADRUPED_GAIT_TABLE.duty) / (1 - selectedQUADRUPED_GAIT_TABLE.duty),
        scaledValueWidth = delta * delta * (3 - 2 * delta)
      ;((legSwingAngle = scaledValueZ * (scaledValueWidth - 0.5)), (computedX = element.lift * computed * Math.sin(Math.PI * delta) * (1 - 0.35 * delta)), (computedY = (element.curl ?? 30) * computed * Math.sin(Math.PI * Math.min(1, delta * 1.3))))
    }
    poseQuadrupedLegIk(rig, coordY, index, pose.rx, pose.ry + computedX, pose.rz + legSwingAngle, computedY)
  }
}

function applyBeastRecoil(rig, coordY, coordZ, recoilDistance = 52, recoilBackAmount = 0.3) {
  ;(coordY.add(rig.pelvis, -recoilDistance * coordZ, 0, 0), coordY.move(rig.pelvis, 0, -0.08 * coordZ, -recoilBackAmount * coordZ), poseAllLegsIk(rig, coordY, 0, 0, 12))
}

const MOSSBACK_FULL_CIRCLE = Math.PI * 2,
  MOSSBACK_DEG_TO_RAD = Math.PI / 180,
  MOSSBACK_FUR_SHADE = 9072208,
  MOSSBACK_FUR = 5521455,
  MOSSBACK_FUR_HIGHLIGHT = 13482128,
  MOSSBACK_FUR_LIGHT = 15919832,
  MOSSBACK_BARK_A = 6968898,
  MOSSBACK_BARK_B = 9074266,
  MOSSBACK_CLOTH = 6265418,
  MOSSBACK_CLOTH_SHADE = 10276698,
  MOSSBACK_LEATHER = 14182458,
  MOSSBACK_CLOTH_TRIM = 16773320,
  MOSSBACK_CRYSTAL_GLOW = 16767088,
  MOSSBACK_LEATHER_TRIM = 15260864,
  mossbackHashNoise = (primary, secondary) => {
    const angleValue = Math.sin(primary * 127.1 + secondary * 311.7) * 43758.5453
    return angleValue - Math.floor(angleValue)
  }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildMossbackModel() {
  const beastRig = buildBeastRig({
      pelvis: [0.62, -0.6],
      chest: [0.6, 0.42],
      neck: [],
      head: [0.64, 0.84],
      tail: [[0.6, -1.06]],
      front: [
        [0.4, 0.56, 0.46],
        [0.52, 0.32, 0.34],
        [0.54, 0.08, 0.58],
      ],
      hind: [
        [0.44, 0.56, -0.6],
        [0.56, 0.34, -0.44],
        [0.56, 0.08, -0.72],
      ],
      bendFront: -1,
      bendHind: 1,
    }),
    entries = beastRig.rig,
    shellJoint = entries.add("shell", beastRig.pelvis, 0, 0.9, -0.1),
    floraJoint = entries.add("flora", shellJoint, 0, 1.1, -0.15),
    builder = new ModelBuilder()
  builder.crease = 60
  const matConfig = { mat: MATERIAL_KINDS.fur, pattern: TERRAIN_LOOK.fur, patternScale: 9, patternAmt: 0.45, grain: 0.08 },
    furShadePaint = (detail, coordX, coordY, coordZ, furNormalX, furShadeNormalY) => smoothStep01(0, -0.8, furShadeNormalY)
  beastRig.legs.forEach((pose) => {
    const legSideSign = pose.side,
      boneChainProjector = makeBoneChainProjector(entries, [pose.upper, pose.lower, pose.foot], 0.5)
    ;(builder.bind(boneChainProjector).paint(MOSSBACK_FUR, { c2: 3812386, by: (primary, secondary) => smoothStep01(0.5, 0.1, secondary), ...matConfig }),
      pose.front
        ? builder.tube(
            [
              [legSideSign * 0.4, 0.62, 0.46, 0.17, 0.2],
              [legSideSign * 0.5, 0.34, 0.36, 0.14, 0.15],
              [legSideSign * 0.54, 0.13, 0.54, 0.14, 0.16],
            ],
            { seg: 7, cap0: !1 },
          )
        : builder.tube(
            [
              [legSideSign * 0.42, 0.64, -0.6, 0.19, 0.25],
              [legSideSign * 0.55, 0.36, -0.46, 0.15, 0.17],
              [legSideSign * 0.56, 0.13, -0.68, 0.13, 0.15],
            ],
            { seg: 7, cap0: !1 },
          ),
      builder.bone(pose.foot).paint(3812386, { ...matConfig }))
    const pawWidthRadius = pose.front ? 0.19 : 0.15
    builder.ball(pose.rx, 0.08, pose.rz + 0.06, pawWidthRadius, 0.09, pose.front ? 0.22 : 0.19, 1)
    const items = pose.front ? 4 : 3
    for (let index = 0; index < items; index++) {
      const ratio = index / (items - 1) - 0.5
      ;(builder.paint(MOSSBACK_LEATHER_TRIM, { c2: 16775400, gloss: 0.6, mat: MATERIAL_KINDS.leather }),
        builder.g(composeMatrix(pose.rx + ratio * pawWidthRadius * 1.5, 0.07, pose.rz + 0.22 - Math.abs(ratio) * 0.06, 78, ratio * 26 * legSideSign, 0), () => builder.crystal(pose.front ? 0.036 : 0.026, pose.front ? 0.24 : 0.13, 4, 0.8, 0.1)))
    }
  })
  const entriesX = [
      [0, 0.56, -1.08, 0.12, 0.12],
      [0, 0.6, -0.88, 0.5, 0.4],
      [0, 0.62, -0.42, 0.64, 0.47],
      [0, 0.6, 0.16, 0.56, 0.43],
      [0, 0.6, 0.6, 0.42, 0.37],
      [0, 0.63, 0.86, 0.31, 0.3],
    ],
    sum = (heroId) => {
      let computed = 0
      for (; computed < entriesX.length - 2 && entriesX[computed + 1][2] < heroId;) computed++
      const segmentFraction = Math.min(1, Math.max(0, (heroId - entriesX[computed][2]) / (entriesX[computed + 1][2] - entriesX[computed][2])))
      return [lerpValue(entriesX[computed][1], entriesX[computed + 1][1], segmentFraction), lerpValue(entriesX[computed][3], entriesX[computed + 1][3], segmentFraction), lerpValue(entriesX[computed][4], entriesX[computed + 1][4], segmentFraction)]
    },
    boneChainProjector = makeBoneChainProjector(entries, [beastRig.pelvis, beastRig.chest], 1.2)
  ;(builder.bind(boneChainProjector).paint(MOSSBACK_FUR_SHADE, { c2: MOSSBACK_FUR_HIGHLIGHT, by: furShadePaint, ...matConfig }),
    builder.tube(entriesX, { seg: 10, up: [1, 0, 0] }),
    builder.bone(beastRig.tail[0]).paint(MOSSBACK_FUR, { c2: MOSSBACK_FUR_LIGHT, ...matConfig }),
    builder.tube(
      [
        [0, 0.58, -1.02, 0.11, 0.1],
        [0, 0.56, -1.22, 0.09, 0.08],
        [0, 0.6, -1.4, 0.02, 0.02],
      ],
      { seg: 6, up: [1, 0, 0] },
    ),
    builder.bone(shellJoint))
  for (let index = 0; index < 5; index++) {
    const delta = 0.5 - index * 0.3,
      deltaX = delta - 0.4,
      lerped = (coordX, coordY, coordZ, plateRadiusEnd) => (primary, secondaryY) => {
        const barkPlateScale = lerpValue(delta, deltaX, secondaryY),
          [shellCenterY, primaryX, secondaryZ] = sum(barkPlateScale),
          lerpedX = lerpValue(coordX, coordY, primary) * MOSSBACK_DEG_TO_RAD,
          lerpedY = lerpValue(coordZ, plateRadiusEnd, secondaryY) + 0.025 * Math.sin(primary * Math.PI),
          barkFade = 1 - 0.05 * (mossbackHashNoise(Math.round(primary * 6) + index * 7, 3) > 0.5 ? 1 : 0) * secondaryY
        return [Math.cos(lerpedX) * (primaryX + lerpedY) * barkFade, shellCenterY + Math.sin(lerpedX) * (secondaryZ + lerpedY), barkPlateScale]
      }
    ;(builder.paint(index % 2 ? MOSSBACK_BARK_A : MOSSBACK_BARK_B, { c2: MOSSBACK_FUR, by: (coordX, coordY, coordZ, barkPaintU) => barkPaintU * barkPaintU * 0.6, mat: MATERIAL_KINDS.rock, pattern: TERRAIN_LOOK.bark, patternScale: 7, patternAmt: 0.6, grain: 0.1 }),
      builder.sheet(6, 2, lerped(168, 12, 0.035, 0.13), !0, 50),
      builder.paint(MOSSBACK_CLOTH, { c2: MOSSBACK_CLOTH_SHADE, by: (coordXX, coordYX, coordZX, clothPaintU, clothNormalX, clothNormalY) => smoothStep01(0.6, 1, clothNormalY), mat: MATERIAL_KINDS.cloth, grain: 0.12 }),
      builder.sheet(4, 2, lerped(128, 52, 0.055, 0.15), !1, 50))
  }
  builder.bone(floraJoint)
  const sumX = (coordX, coordY, coordZ, frondLength, frondWaveHeight) => {
    const [primary, , secondary] = sum(coordY),
      frondSpan = primary + secondary + 0.08,
      frondDirZ = Math.cos(coordZ),
      frondDirX = Math.sin(coordZ),
      entries = []
    for (let index = 0; index <= 3; index++) {
      const ratio = index / 3,
        frondReach = ratio * frondLength,
        scaledValueX = frondWaveHeight * Math.sin(ratio * 2.2) * frondLength
      entries.push([coordX + frondDirX * frondReach, frondSpan + scaledValueX, coordY + frondDirZ * frondReach, 0.15 * Math.sin(Math.min(1, ratio * 1.3 + 0.25) * Math.PI) + 0.01, 0.014])
    }
    ;(builder.paint(MOSSBACK_CLOTH, { c2: MOSSBACK_CLOTH_SHADE, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.vein, patternScale: 10, patternAmt: 0.4 }), builder.tube(entries, { seg: 4, up: [frondDirZ, 0, -frondDirX], cap0: !1 }))
  }
  ;(sumX(0.22, 0.2, 0.9, 0.5, 0.55), sumX(-0.24, 0.24, -1, 0.46, 0.6), sumX(0.36, -0.3, 1.5, 0.54, 0.5), sumX(-0.38, -0.36, -1.7, 0.5, 0.52), sumX(0.2, -0.78, 2.6, 0.5, 0.5), sumX(-0.16, -0.8, -2.7, 0.46, 0.55))
  const sumY = (cooldown, coordX, coordY, coordZ, ornamentAngle) => {
    const [primary, , secondary] = sum(coordX),
      ornamentHeight = primary + secondary + 0.06
    builder.g(composeMatrix(cooldown, ornamentHeight, coordX, ornamentAngle, 0, ornamentAngle * 0.6), () => {
      ;(builder.paint(MOSSBACK_CLOTH_TRIM, { c2: 14207136, mat: MATERIAL_KINDS.cloth }),
        builder.tube(
          [
            [0, 0, 0, coordY * 0.3],
            [0.01, coordZ * 0.6, 0, coordY * 0.22],
            [0, coordZ, 0, coordY * 0.26],
          ],
          { seg: 6 },
        ),
        builder.paint(MOSSBACK_LEATHER, { c2: 15764042, gloss: 0.35, mat: MATERIAL_KINDS.leather }),
        builder.lathe(
          [
            [coordZ - coordY * 0.12, coordY * 0.96],
            [coordZ, coordY],
            [coordZ + coordY * 0.34, coordY * 0.74],
            [coordZ + coordY * 0.56, coordY * 0.36],
            [coordZ + coordY * 0.62, 0.01],
          ],
          { seg: 9, crease: 70 },
        ),
        builder.paint(MOSSBACK_CLOTH_TRIM, { glow: 0.12, mat: MATERIAL_KINDS.cloth, line: 0 }))
      for (let beadIndex = 0; beadIndex < 5; beadIndex++) {
        const beadAngle = beadIndex * 1.26 + 0.4,
          scaledValueX = coordY * (beadIndex === 0 ? 0 : 0.6)
        builder.ball(Math.cos(beadAngle) * scaledValueX, coordZ + coordY * (beadIndex === 0 ? 0.6 : 0.36), Math.sin(beadAngle) * scaledValueX, coordY * 0.17, coordY * 0.07, coordY * 0.17, 0)
      }
    })
  }
  ;(sumY(0.1, -0.34, 0.3, 0.3, 6), sumY(-0.24, 0.06, 0.17, 0.2, -10))
  const headFurShadeAt = (label, coordX, coordY, coordZ, hornNormalX, headFurShadeNormalY) => smoothStep01(0.19, 0.07, Math.abs(label)) * smoothStep01(-0.1, 0.5, headFurShadeNormalY)
  ;(builder.bone(beastRig.head).paint(MOSSBACK_FUR, { c2: MOSSBACK_FUR_LIGHT, by: headFurShadeAt, ...matConfig }),
    builder.tube(
      [
        [0, 0.63, 0.74, 0.3, 0.29],
        [0, 0.65, 0.98, 0.31, 0.27],
        [0, 0.62, 1.2, 0.22, 0.19],
        [0, 0.58, 1.38, 0.14, 0.12],
        [0, 0.56, 1.48, 0.08, 0.07],
      ],
      { seg: 12, up: [1, 0, 0] },
    ),
    builder.paint(MOSSBACK_FUR_HIGHLIGHT, { ...matConfig }),
    builder.tube(
      [
        [0, 0.5, 0.86, 0.24, 0.1],
        [0, 0.49, 1.18, 0.16, 0.08],
        [0, 0.5, 1.4, 0.08, 0.05],
      ],
      { seg: 6, up: [1, 0, 0] },
    ),
    builder.paint(1840658, { gloss: 0.6, mat: MATERIAL_KINDS.leather }),
    builder.ball(0, 0.585, 1.5, 0.07, 0.055, 0.05, 1),
    builder.sym(() => {
      ;(builder.paint(MOSSBACK_FUR, { c2: MOSSBACK_FUR_SHADE, ...matConfig }), builder.ball(0.26, 0.9, 0.86, 0.09, 0.09, 0.05, 0), builder.paint(MOSSBACK_CRYSTAL_GLOW, { glow: 0.5, mat: MATERIAL_KINDS.crystal }), builder.ball(0.2, 0.72, 1.14, 0.04, 0.045, 0.03, 0))
    }),
    builder.bakeGrounding(1.2, 0.72, 0.9))
  const computed = 1.9,
    sumZ = (primary, world, secondary) => {
      const sum = world.time * 1.3 + world.seed * 7,
        idleSwaySin = Math.sin(sum * 2.2),
        computed = (world.mode & 2) !== 0
      let isActive = !0
      switch ((primary.pos(beastRig.pelvis, 0, idleSwaySin * 0.012, 0), primary.rot(floraJoint, idleSwaySin * 2.5, 0, Math.sin(sum * 1.7) * 2.5), primary.rot(beastRig.tail[0], 0, Math.sin(sum * 3.1) * 16, 0), world.anim)) {
        case "dead": {
          const timeValue = world.t,
            deathToppleEase = hermiteSmoothStep(inverseLerpClamped(timeValue, 0.02, 0.45)),
            items = world.seed > 0.5 ? 1 : -1
          ;(primary.rot(beastRig.root, 0, 0, items * 172 * deathToppleEase), primary.pos(beastRig.root, items * 0.3 * deathToppleEase, 1.24 * deathToppleEase + 0.25 * Math.sin(deathToppleEase * Math.PI), 0))
          const sumX = (smoothFalloff(timeValue, 0.62, 0.1) + smoothFalloff(timeValue, 0.86, 0.1)) * (1 - inverseLerpClamped(timeValue, 1, 1.1))
          ;(beastRig.legs.forEach((poseX, secondaryWidth) => poseQuadrupedLegIk(beastRig, primary, secondaryWidth, poseX.rx, poseX.ry + 0.16 * deathToppleEase - 0.14 * sumX * (secondaryWidth % 2 ? 1 : 0.6), poseX.rz + (poseX.front ? 0.14 : -0.14) * sumX, 30 * deathToppleEase)),
            (isActive = !1),
            primary.rot(beastRig.head, -16 * deathToppleEase, 0, items * 12 * deathToppleEase),
            primary.scale(floraJoint, 1 - 0.5 * inverseLerpClamped(timeValue, 0.7, 1.3)),
            (secondary.glow = 1 - inverseLerpClamped(timeValue, 0.5, 1)))
          break
        }
        case "move": {
          const stridePhase = world.stride * MOSSBACK_FULL_CIRCLE
          ;(primary.rot(beastRig.head, Math.sin(stridePhase * 2) * 4 + 4, 0, 0),
            animateBeastGait(beastRig, primary, world.stride, { style: "trot", stride: computed, lift: 0.16, bob: 0.03, pitch: 2, sway: 5, roll: 3, curl: 20 }),
            primary.add(floraJoint, 0, 0, Math.sin(stridePhase * 2) * 4),
            (isActive = !1))
          break
        }
        case "attack": {
          const windupEaseCurveResult = windupEaseCurve(world.p, world.windup),
            easeOutQuadResult = easeOutQuad(inverseLerpClamped(windupEaseCurveResult, 0, 0.27)),
            strikePhaseWeight = inverseLerpClamped(windupEaseCurveResult, 0.27, 0.36),
            strikeRecoveryEase = hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.5, 1)),
            scaledValueX = easeOutQuadResult * (1 - strikePhaseWeight),
            scaledValueY = strikePhaseWeight * (1 - strikeRecoveryEase)
          if (world.mode & 1) {
            ;(primary.move(beastRig.pelvis, 0, -0.06 * scaledValueY, 0.24 * scaledValueY), primary.add(beastRig.pelvis, 8 * scaledValueY, 0, 0), applyBeastRecoil(beastRig, primary, scaledValueX, 50, 0.16), primary.add(beastRig.head, 26 * scaledValueX, 0, 0))
            for (let index = 0; index < 2; index++) {
              const pose = beastRig.legs[index]
              poseQuadrupedLegIk(beastRig, primary, index, pose.rx + pose.side * 0.08 * scaledValueX, pose.ry + 0.95 * scaledValueX, pose.rz - 0.1 * scaledValueX + 0.2 * scaledValueY, 40 * scaledValueX)
            }
            poseAllLegsIk(beastRig, primary, 0, 0, 12)
          } else {
            ;(primary.move(beastRig.pelvis, 0, 0.08 * scaledValueX - 0.05 * scaledValueY, -0.24 * scaledValueX + 0.5 * scaledValueY), primary.add(beastRig.pelvis, -10 * scaledValueX + 8 * scaledValueY, 0, 0), primary.add(beastRig.head, -14 * scaledValueX + 12 * scaledValueY, 0, 0), poseAllLegsIk(beastRig, primary, 0, 0, 12))
            for (let legIndex = 0; legIndex < 2; legIndex++) {
              const poseX = beastRig.legs[legIndex],
                itemsX = legIndex === world.variant % 2 ? 1 : 0.8
              poseQuadrupedLegIk(beastRig, primary, legIndex, poseX.rx - poseX.side * 0.12 * scaledValueY, poseX.ry + 0.42 * scaledValueX * itemsX + 0.14 * scaledValueY * (1 - scaledValueY), poseX.rz - 0.1 * scaledValueX + 0.62 * scaledValueY, 30 * scaledValueX - 16 * scaledValueY)
            }
          }
          isActive = !1
          break
        }
        case "stunned": {
          ;(primary.rot(beastRig.head, 14, Math.sin(sum * 4) * 20, Math.cos(sum * 4) * 10), primary.add(beastRig.pelvis, 0, 0, Math.sin(sum * 2) * 4))
          break
        }
        case "airborne": {
          ;(primary.rot(beastRig.root, -18 * Math.sin(world.p * Math.PI), 0, 14), beastRig.legs.forEach((poseY, secondaryHeight) => poseQuadrupedLegIk(beastRig, primary, secondaryHeight, poseY.rx + poseY.side * 0.1, poseY.ry + 0.12, poseY.rz + (poseY.front ? 0.16 : -0.16), 30)), (isActive = !1))
          break
        }
        default:
          if (world.spawnT >= 0) {
            const ratio = world.spawnT / 1,
              easedValue = easeOutQuad(inverseLerpClamped(ratio, 0, 0.25)),
              spawnRiseFactor = hermiteSmoothStep(inverseLerpClamped(ratio, 0.45, 0.9))
            ;(primary.pos(beastRig.root, 0, -1.25 + 0.5 * easedValue + 0.75 * spawnRiseFactor, -0.4 * (1 - spawnRiseFactor)), primary.rot(beastRig.root, -34 * (1 - spawnRiseFactor), 0, 0), primary.rot(beastRig.head, 20 * (1 - spawnRiseFactor), Math.sin(ratio * 22) * 24 * easedValue * (1 - spawnRiseFactor), 0))
          } else if (computed) {
            ;(primary.rot(shellJoint, -8, 0, 0), primary.move(beastRig.pelvis, 0, -0.03, -0.04), primary.rot(beastRig.head, 8, 0, 0))
            const breathPhase = (sum * 0.8) % 1,
              sumY = smoothFalloff(breathPhase, 0.3, 0.14) + smoothFalloff(breathPhase, 0.58, 0.14),
              poseY = beastRig.legs[0]
            ;(poseAllLegsIk(beastRig, primary, 0, 0, 14), poseQuadrupedLegIk(beastRig, primary, 0, poseY.rx, poseY.ry + 0.12 * sumY, poseY.rz + 0.1 - 0.2 * sumY, 20 * sumY), (isActive = !1))
          } else {
            const headIdlePhase = (sum / 5) % 1,
              scaledValueZ = hermiteSmoothStep(inverseLerpClamped(headIdlePhase, 0.6, 0.68)) * (1 - hermiteSmoothStep(inverseLerpClamped(headIdlePhase, 0.86, 0.95)))
            ;(primary.rot(beastRig.head, 6 + Math.sin(sum * 5) * 2 + 10 * scaledValueZ, Math.sin(sum * 0.5) * 14 * (1 - scaledValueZ), Math.sin(sum * 16) * 12 * scaledValueZ), primary.add(beastRig.chest, 4 * scaledValueZ, 0, 0))
          }
      }
      const hitPulseStrength = hitImpactPulse(world.hitT)
      ;(hitPulseStrength > 0 && world.anim !== "dead" && (primary.add(beastRig.head, 16 * hitPulseStrength, 0, (world.seed > 0.5 ? 1 : -1) * 10 * hitPulseStrength), primary.move(beastRig.pelvis, 0, -0.05 * hitPulseStrength, -0.05 * hitPulseStrength), primary.add(shellJoint, -6 * hitPulseStrength, 0, 0)), isActive && poseAllLegsIk(beastRig, primary))
    }
  return {
    key: "monster:mossback",
    geometry: builder.build(),
    rig: entries,
    height: 1.6,
    radius: 1,
    scale: 1,
    stride: computed,
    triangles: builder.triangleCount,
    deathDur: 1.4,
    spawnDur: 1,
    outline: 1.4,
    attach: {
      chest: { joint: beastRig.chest, x: 0, y: 0.1, z: 0 },
      head: { joint: beastRig.head, x: 0, y: 0.1, z: 0.3 },
      muzzle: { joint: beastRig.head, x: 0, y: -0.05, z: 0.66 },
      weapon: { joint: beastRig.legs[1].foot, x: 0, y: 0, z: 0.25 },
      tail: { joint: beastRig.tail[0], x: 0, y: 0, z: -0.3 },
    },
    blend: (lastAnim, attackKind) => (attackKind === "attack" ? 0.08 : 0.16),
    animate: sumZ,
  }
}

const DRAKE_FULL_CIRCLE = Math.PI * 2,
  DRAKE_HIDE = 2898052,
  DRAKE_HIDE_SHADE = 5136568,
  DRAKE_HIDE_DARK = 1712210,
  DRAKE_SCALE = 8361676,
  DRAKE_SCALE_LIGHT = 12110058,
  DRAKE_MEMBRANE = 3811978,
  DRAKE_HIDE_MID = 9067775,
  DRAKE_LEATHER_DARK = 4186320,
  DRAKE_CRYSTAL = 10514687,
  DRAKE_CRYSTAL_HOT = 14731519,
  DRAKE_LEATHER_SHADE = 13617384,
  DRAKE_LEATHER = 6970010,
  DRAKE_LEATHER_LIGHT = 15789311,
  DRAKE_GLOW_CRYSTAL = 8384736,
  DRAKE_WING_CLOTH = 5909146,
  BREATH_WARN_PHASE = JUNGLE_RULES.breathWarn / (JUNGLE_RULES.breathWarn + JUNGLE_RULES.breathTime)

function sampleCatmullRomFrames(entries, secondary) {
  const entriesX = [],
    count = entries.length,
    clampedEntryAt = (frameIndex) => entries[Math.max(0, Math.min(count - 1, frameIndex))]
  for (let index = 0; index < count - 1; index++) {
    const iResult = clampedEntryAt(index - 1),
      iIResult = clampedEntryAt(index),
      samples = clampedEntryAt(index + 1),
      samplesX = clampedEntryAt(index + 2),
      items = index === count - 2 ? secondary + 1 : secondary
    for (let subdivIndex = 0; subdivIndex < items; subdivIndex++) {
      const ratio = subdivIndex / secondary,
        ratioSquared = ratio * ratio,
        scaledValueX = ratioSquared * ratio,
        samplesY = [0, 0, 0, 0, 0]
      for (let componentIndex = 0; componentIndex < 5; componentIndex++) samplesY[componentIndex] = 0.5 * (2 * iIResult[componentIndex] + (-iResult[componentIndex] + samples[componentIndex]) * ratio + (2 * iResult[componentIndex] - 5 * iIResult[componentIndex] + 4 * samples[componentIndex] - samplesX[componentIndex]) * ratioSquared + (-iResult[componentIndex] + 3 * iIResult[componentIndex] - 3 * samples[componentIndex] + samplesX[componentIndex]) * scaledValueX)
      entriesX.push({ p: [samplesY[0], samplesY[1], samplesY[2]], t: [0, 0, 1], d: [0, 1, 0], rx: samplesY[3], ry: samplesY[4] })
    }
  }
  for (let sampleIndex = 0; sampleIndex < entriesX.length; sampleIndex++) {
    const samplesZ = entriesX[Math.max(0, sampleIndex - 1)].p,
      samplesWidth = entriesX[Math.min(entriesX.length - 1, sampleIndex + 1)].p,
      deltaX = samplesWidth[0] - samplesZ[0],
      deltaY = samplesWidth[1] - samplesZ[1],
      deltaZ = samplesWidth[2] - samplesZ[2],
      distance = Math.hypot(deltaX, deltaY, deltaZ) || 1
    entriesX[sampleIndex].t = [deltaX / distance, deltaY / distance, deltaZ / distance]
    const distanceX = Math.hypot(deltaZ, deltaY) || 1
    entriesX[sampleIndex].d = [0, deltaZ / distanceX, -deltaY / distanceX]
  }
  return entriesX
}

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildAbyssDrakeModel() {
  const beastRig = buildBeastRig({
      pelvis: [1.75, -1.3],
      chest: [2.05, 0.9],
      neck: [
        [2.42, 1.55],
        [3.02, 2.24],
        [3.68, 2.06],
        [4.14, 2.22],
      ],
      head: [4.32, 2.58],
      jaw: [4.14, 2.63],
      tail: [
        [1.6, -2.1],
        [1.36, -2.9],
        [1.12, -3.7],
        [0.92, -4.5],
        [0.76, -5.25],
        [0.66, -5.95],
      ],
      front: [
        [0.85, 1.9, 0.95],
        [1.22, 1.05, 0.62],
        [1.28, 0.2, 1.15],
      ],
      hind: [
        [0.8, 1.7, -1.35],
        [1.22, 0.95, -0.92],
        [1.22, 0.2, -1.6],
      ],
      bendFront: -1,
      bendHind: 1,
    }),
    builder = beastRig.rig,
    composeMatrixResult = composeMatrix(0, 4.32, 2.58, 12, 0, 0, 1.1),
    transformPoint = (target, primary, secondary) => new Vector3(target, primary, secondary).applyMatrix4(composeMatrixResult),
    addAtTransformed = (coordX, coordY, coordZ, attachOffsetY, attachOffsetZ) => {
      const sResult = transformPoint(coordZ, attachOffsetY, attachOffsetZ)
      return builder.add(coordX, coordY, sResult.x, sResult.y, sResult.z)
    },
    crestJoint = addAtTransformed("crest", beastRig.head, 0, 0.37, 0.4),
    ventJoint = addAtTransformed("vent", beastRig.head, 0, -0.13, 1),
    frillJoints = [1, -1].map((mirrorSide) => addAtTransformed(`frill${mirrorSide}`, beastRig.head, mirrorSide * 0.36, 0.06, -0.08)),
    mappedResult = [1, -1].map((whiskerSide) => {
      const entries = [
          [whiskerSide * 0.15, -0.26, 1.1],
          [whiskerSide * 0.22, -0.6, 1.04],
          [whiskerSide * 0.27, -0.9, 0.82],
        ],
        entriesX = []
      entries.forEach((samplesY, secondaryDepth) => entriesX.push(addAtTransformed(`whisker${whiskerSide}_${secondaryDepth}`, secondaryDepth === 0 ? beastRig.jaw : entriesX[secondaryDepth - 1], samplesY[0], samplesY[1], samplesY[2])))
      const sSResult = transformPoint(whiskerSide * 0.3, -1.06, 0.46),
        selectedSt = entries[entries.length - 1],
        whiskerTipOffset = transformPoint(selectedSt[0], selectedSt[1], selectedSt[2])
      return (builder.chain({ joints: entriesX, tip: [sSResult.x - whiskerTipOffset.x, sSResult.y - whiskerTipOffset.y, sSResult.z - whiskerTipOffset.z], stiffness: 7, drag: 0.9, gravity: 9, maxAngle: 60, wind: 1.5 }), { js: entriesX, tip: [sSResult.x, sSResult.y, sSResult.z] })
    }),
    samples = [0.55, 2.7, 0.6],
    samplesX = [1.7, 3.25, 0.05],
    samplesY = [2.6, 3.5, 1],
    entries = [
      [4.15, 3.4, 1.25],
      [4.3, 3.1, -0.9],
      [3.2, 2.9, -2.5],
    ],
    entriesX = [0.62, 2.3, -1.9],
    entriesY = [1, -1].map((wingSide) => {
      const scaledValueY = builder.add(`wingA${wingSide}`, beastRig.chest, wingSide * samples[0], samples[1], samples[2]),
        scaledValueZ = builder.add(`wingB${wingSide}`, scaledValueY, wingSide * samplesX[0], samplesX[1], samplesX[2]),
        scaledValueWidth = builder.add(`wingH${wingSide}`, scaledValueZ, wingSide * samplesY[0], samplesY[1], samplesY[2]),
        entriesY = [0, 1, 2].map((secondaryStart) => builder.add(`wingF${secondaryStart}_${wingSide}`, scaledValueWidth, wingSide * samplesY[0], samplesY[1], samplesY[2]))
      return { a: scaledValueY, f: scaledValueZ, h: scaledValueWidth, fingers: entriesY }
    }),
    directionBetween = (samples, samplesX) => new Vector3(samplesX[0] - samples[0], samplesX[1] - samples[1], samplesX[2] - samples[2]).normalize(),
    rotationFromNormal = (primary, entries) => {
      const normalizedValue = entries.clone().addScaledVector(primary, -entries.dot(primary)).normalize(),
        crossVectorsResult = new Vector3().crossVectors(primary, normalizedValue)
      return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(primary, normalizedValue, crossVectorsResult))
    },
    setFromUnitVectorsResult = new Quaternion().setFromUnitVectors(directionBetween(samples, samplesX), new Vector3(0.2, 0.5, -0.84).normalize()),
    alignedQuaternion = new Quaternion().setFromUnitVectors(directionBetween(samplesX, samplesY), new Vector3(0.26, -0.26, 0.93).normalize()),
    samplesZ = [directionBetween(samplesY, entries[0]), directionBetween(samplesY, entries[1]), directionBetween(samplesY, entries[2])],
    normalizeResult = new Vector3().crossVectors(samplesZ[0], samplesZ[2]).normalize(),
    multiplyResult = rotationFromNormal(new Vector3(0.02, -0.3, -0.95).normalize(), new Vector3(0.8, 0.6, 0)).multiply(rotationFromNormal(samplesZ[2], normalizeResult).invert()),
    entriesZ = [
      setFromUnitVectorsResult,
      setFromUnitVectorsResult.clone().invert().multiply(alignedQuaternion),
      alignedQuaternion.clone().invert().multiply(multiplyResult),
      new Quaternion().setFromAxisAngle(normalizeResult, samplesZ[0].angleTo(samplesZ[2]) - 0.56),
      new Quaternion().setFromAxisAngle(normalizeResult, samplesZ[1].angleTo(samplesZ[2]) - 0.26),
      new Quaternion(),
    ].map((position) => {
      const quatWClamped = Math.min(1, Math.max(-1, position.w)),
        scaledValueHeight = 2 * Math.acos(quatWClamped),
        sinHalfAngle = Math.sqrt(Math.max(1e-9, 1 - quatWClamped * quatWClamped))
      return [position.x / sinHalfAngle, position.y / sinHalfAngle, position.z / sinHalfAngle, scaledValueHeight]
    }),
    modelBuilder = new ModelBuilder()
  modelBuilder.crease = 62
  const scaleMaterialConfig = { mat: MATERIAL_KINDS.leather, gloss: 0.35, pattern: TERRAIN_LOOK.scale, patternScale: 4.5, patternAmt: 0.6, grain: 0.07 },
    clawMaterialConfig = { mat: MATERIAL_KINDS.leather, gloss: 0.5 },
    buildSpikeChain = (bushMap, river, coordX, coordY, samples, capStartFlag, capEndFlag) => {
      const lengthValue = bushMap.length,
        sum = (coordX, coordY, coordZ, spikePaintU, spikeNormalX, spikeNormalY, spikeNormalZ) => smoothStep01(0.2, 0.9, -(spikeNormalX * samples[0] + spikeNormalY * samples[1] + spikeNormalZ * samples[2]))
      ;(modelBuilder.bind(river).paint(DRAKE_HIDE, { c2: DRAKE_HIDE_DARK, by: sum, ...scaleMaterialConfig }),
        modelBuilder.tube(
          bushMap.map((poseZ) => [poseZ.p[0], poseZ.p[1], poseZ.p[2], poseZ.rx, poseZ.ry]),
          { seg: coordY, up: [1, 0, 0], cap0: capStartFlag, cap1: capEndFlag, crease: 62 },
        ))
      const entries = [],
        entriesX = [],
        entriesY = [],
        entriesZ = []
      for (let index = 0; index < lengthValue; index++) {
        const selectedH = bushMap[index],
          spikeRepeatPos = (index / (lengthValue - 1)) * coordX,
          delta = spikeRepeatPos - Math.floor(spikeRepeatPos)
        ;(entries.push([selectedH.p[0], selectedH.p[1], selectedH.p[2], selectedH.rx, selectedH.ry]), entriesX.push(0.03 + 0.085 * delta), entriesY.push(delta), entriesZ.push(selectedH))
        const scaledValueX = ((index + 1) / (lengthValue - 1)) * coordX
        if (index < lengthValue - 1 && Math.floor(scaledValueX) > Math.floor(spikeRepeatPos)) {
          const pose = bushMap[index + 1],
            computed = 0.93
          ;(entries.push([lerpValue(selectedH.p[0], pose.p[0], computed), lerpValue(selectedH.p[1], pose.p[1], computed), lerpValue(selectedH.p[2], pose.p[2], computed), lerpValue(selectedH.rx, pose.rx, computed), lerpValue(selectedH.ry, pose.ry, computed)]), entriesX.push(0.03 + 0.085), entriesY.push(1), entriesZ.push(selectedH))
        }
      }
      const entryCount = entries.length
      ;(modelBuilder.bind(river).paint(DRAKE_SCALE, { c2: DRAKE_SCALE_LIGHT, by: (coordXY, coordYY, coordZY, scaleShadeU) => Math.pow(entriesY[Math.min(entryCount - 1, Math.round(scaleShadeU * (entryCount - 1)))], 3), ...clawMaterialConfig }),
        modelBuilder.sheet(
          6,
          entryCount - 1,
          (primaryY, secondaryEnd) => {
            const deltaX = Math.min(entryCount - 1, Math.round(secondaryEnd * (entryCount - 1))),
              selectedJ = entriesZ[deltaX],
              element = entries[deltaX],
              deltaY = ((160 - 140 * primaryY) * Math.PI) / 180,
              sum = primaryY < 0.01 || primaryY > 0.99 ? 0.985 : 1.04 + entriesX[deltaX],
              angleValue = Math.cos(deltaY) * element[3] * sum,
              angleValueX = Math.sin(deltaY) * element[4] * sum
            return [element[0] + angleValue, element[1] - selectedJ.d[1] * angleValueX, element[2] - selectedJ.d[2] * angleValueX]
          },
          !1,
          46,
        ))
    },
    sum = (kills, coordX, coordY, coordZ) => {
      const samples = [kills.p[0] + kills.d[0] * kills.ry * 0.9, kills.p[1] + kills.d[1] * kills.ry * 0.9, kills.p[2] + kills.d[2] * kills.ry * 0.9],
        basis = new Matrix4().makeBasis(new Vector3(kills.t[0], kills.t[1], kills.t[2]), new Vector3(kills.d[0], kills.d[1], kills.d[2]), new Vector3(1, 0, 0))
      ;(basis.setPosition(samples[0], samples[1], samples[2]),
        modelBuilder.bind(coordZ).paint(DRAKE_CRYSTAL, { c2: DRAKE_CRYSTAL_HOT, glow: 0.14, glow2: 0.55, gloss: 0.8, mat: MATERIAL_KINDS.crystal, line: 1 }),
        modelBuilder.g(basis, () =>
          modelBuilder.extrude(
            [
              [coordY * 0.5, -0.06],
              [coordY * 0.12, coordX * 0.55],
              [-coordY * 0.42, coordX],
              [-coordY * 0.3, coordX * 0.42],
              [-coordY * 0.55, -0.06],
            ],
            0.07,
            0.03,
          ),
        ))
    },
    attachHornSpike = (deaths, coordX, coordY, coordZ, bindJoint) => {
      const radialCos = Math.cos(coordX),
        angleValue = Math.sin(coordX),
        radialAxis = new Vector3(radialCos, deaths.d[1] * angleValue, deaths.d[2] * angleValue).normalize(),
        samples = [radialCos * deaths.rx * 0.99, deaths.p[1] + deaths.d[1] * angleValue * deaths.ry * 0.99, deaths.p[2] + deaths.d[2] * angleValue * deaths.ry * 0.99],
        negatedTangent = new Vector3(-deaths.t[0], -deaths.t[1], -deaths.t[2]),
        sideAxis = new Vector3().crossVectors(negatedTangent, radialAxis).normalize(),
        basis = new Matrix4().makeBasis(sideAxis, negatedTangent, radialAxis)
      ;(basis.setPosition(samples[0], samples[1], samples[2]),
        modelBuilder.bind(bindJoint).paint(lerpRgbChannels(DRAKE_HIDE, DRAKE_HIDE_SHADE, 0.55), { c2: DRAKE_HIDE, gloss: 0.6, mat: MATERIAL_KINDS.leather }),
        modelBuilder.g(basis, () =>
          modelBuilder.g(composeMatrix(0, 0, 0, -6, 0, 0), () =>
            modelBuilder.extrude(
              [
                [0, -coordZ * 0.35],
                [coordY * 0.5, 0],
                [coordY * 0.3, coordZ * 0.5],
                [0, coordZ * 0.68],
                [-coordY * 0.3, coordZ * 0.5],
                [-coordY * 0.5, 0],
              ],
              0.045,
              0,
            ),
          ),
        ))
    }
  beastRig.legs.forEach((poseWidth) => {
    const legSideSign = poseWidth.side,
      legBoneProjector = makeBoneChainProjector(builder, [poseWidth.upper, poseWidth.lower, poseWidth.foot], 0.5)
    ;(modelBuilder.bind(legBoneProjector).paint(DRAKE_HIDE, { c2: DRAKE_HIDE_DARK, by: (primaryX, secondaryX) => smoothStep01(1.2, 0.2, secondaryX), ...scaleMaterialConfig }),
      poseWidth.front
        ? modelBuilder.tube(
            [
              [legSideSign * 0.78, 2.1, 0.98, 0.42, 0.56],
              [legSideSign * 1, 1.6, 0.84, 0.38, 0.46],
              [legSideSign * 1.2, 1.08, 0.64, 0.29, 0.33],
              [legSideSign * 1.25, 0.62, 0.84, 0.25, 0.27],
              [legSideSign * 1.28, 0.28, 1.1, 0.27, 0.32],
            ],
            { seg: 9, cap0: !1 },
          )
        : modelBuilder.tube(
            [
              [legSideSign * 0.7, 1.95, -1.4, 0.46, 0.66],
              [legSideSign * 1, 1.45, -1.16, 0.42, 0.56],
              [legSideSign * 1.22, 0.98, -0.94, 0.3, 0.36],
              [legSideSign * 1.22, 0.58, -1.3, 0.25, 0.28],
              [legSideSign * 1.22, 0.28, -1.56, 0.27, 0.32],
            ],
            { seg: 9, cap0: !1 },
          ),
      modelBuilder.bone(poseWidth.upper).paint(DRAKE_CRYSTAL, { c2: DRAKE_CRYSTAL_HOT, glow: 0.15, glow2: 0.6, gloss: 0.8, mat: MATERIAL_KINDS.crystal, line: 1 }),
      modelBuilder.g(composeMatrix(poseWidth.front ? legSideSign * 1.22 : legSideSign * 1.3, poseWidth.front ? 1.16 : 1.06, poseWidth.front ? 0.4 : -0.72, poseWidth.front ? -50 : 40, 0, legSideSign * -24), () => modelBuilder.crystal(0.08, 0.5, 4, 0.75, 0.1)),
      modelBuilder.bone(poseWidth.foot).paint(DRAKE_HIDE_DARK, { c2: DRAKE_HIDE, ...scaleMaterialConfig }),
      modelBuilder.ball(poseWidth.rx, 0.2, poseWidth.rz + 0.08, 0.32, 0.2, 0.36, 1))
    for (let spikeRepeatIndex = -1; spikeRepeatIndex <= 1; spikeRepeatIndex++) {
      const scaledValueDepth = spikeRepeatIndex * 24 * legSideSign
      modelBuilder.g(composeMatrix(poseWidth.rx + spikeRepeatIndex * 0.17, 0.16, poseWidth.rz + 0.28, 0, scaledValueDepth, 0), () => {
        ;(modelBuilder.paint(DRAKE_HIDE_DARK, { c2: DRAKE_HIDE, ...scaleMaterialConfig }),
          modelBuilder.tube(
            [
              [0, 0.02, 0, 0.12, 0.11],
              [0, 0.03, 0.26, 0.1, 0.09],
              [0, -0.02, 0.4, 0.07, 0.06],
            ],
            { seg: 6, up: [1, 0, 0] },
          ),
          modelBuilder.paint(DRAKE_LEATHER_LIGHT, { c2: 16777215, gloss: 0.8, mat: MATERIAL_KINDS.leather }),
          modelBuilder.tube(
            [
              [0, 0.02, 0.36, 0.06, 0.06],
              [0, 0, 0.52, 0.04, 0.045],
              [0, -0.1, 0.64, 0.004, 0.004],
            ],
            { seg: 5, up: [1, 0, 0] },
          ))
      })
    }
  })
  const boneChainProjector = makeBoneChainProjector(builder, [beastRig.pelvis, beastRig.chest], 1.2),
    sampleCatmullRomFramesResult = sampleCatmullRomFrames(
      [
        [0, 1.52, -2.25, 0.5, 0.48],
        [0, 1.68, -1.75, 0.8, 0.72],
        [0, 1.74, -1.25, 0.94, 0.86],
        [0, 1.7, -0.45, 0.9, 0.82],
        [0, 1.8, 0.35, 1.02, 0.95],
        [0, 2.02, 0.98, 0.98, 0.98],
        [0, 2.26, 1.42, 0.78, 0.8],
      ],
      3,
    )
  buildSpikeChain(sampleCatmullRomFramesResult, boneChainProjector, 7, 14, [0, -1, 0], !1, !1)
  const entriesWidth = [beastRig.chest, ...beastRig.neck, beastRig.head],
    tailChainProjector = makeBoneChainProjector(builder, entriesWidth, 0.9),
    sampledFrames = sampleCatmullRomFrames(
      [
        [0, 2.16, 1.24, 0.8, 0.82],
        [0, 2.44, 1.6, 0.6, 0.64],
        [0, 3.02, 2.26, 0.43, 0.46],
        [0, 3.68, 2.06, 0.36, 0.38],
        [0, 4.14, 2.24, 0.32, 0.34],
        [0, 4.34, 2.52, 0.3, 0.31],
      ],
      4,
    )
  buildSpikeChain(sampledFrames, tailChainProjector, 10, 12, [0, -0.5, 0.86], !1, !1)
  const entriesHeight = [beastRig.pelvis, ...beastRig.tail],
    wingChainProjector = makeBoneChainProjector(builder, entriesHeight, 0.9, [0, 0.6, -7]),
    tailFrames = sampleCatmullRomFrames(
      [
        [0, 0.62, -6.6, 0.07, 0.08],
        [0, 0.66, -5.95, 0.15, 0.17],
        [0, 0.76, -5.25, 0.22, 0.24],
        [0, 0.92, -4.5, 0.3, 0.32],
        [0, 1.12, -3.7, 0.4, 0.42],
        [0, 1.36, -2.9, 0.52, 0.52],
        [0, 1.56, -2.2, 0.62, 0.6],
      ],
      3,
    )
  ;(buildSpikeChain(tailFrames, wingChainProjector, 9, 10, [0, -1, 0], !0, !1),
    modelBuilder.bind(wingChainProjector).paint(DRAKE_HIDE_MID, { c2: DRAKE_CRYSTAL_HOT, glow: 0.12, glow2: 0.5, gloss: 0.6, mat: MATERIAL_KINDS.crystal, line: 1, by: (coordXZ, coordYZ, coordZZ) => Math.max(smoothStep01(-6.1, -7.3, coordZZ), smoothStep01(0.9, 1.5, coordYZ), smoothStep01(0.4, 0, coordYZ)) }),
    modelBuilder.g(composeMatrix(0, 0.66, -6.35, 0, -90, 0), () =>
      modelBuilder.extrude(
        [
          [-0.75, 0],
          [-0.3, 0.42],
          [0.25, 0.78],
          [0.95, 0.6],
          [1.1, 0.05],
          [0.9, -0.5],
          [0.25, -0.62],
          [-0.3, -0.36],
        ],
        0.07,
        0.03,
      ),
    ),
    modelBuilder.paint(DRAKE_HIDE_DARK, { c2: DRAKE_HIDE_MID, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
    modelBuilder.limb([0, 0.64, -6], [0, 0.68, -7.3], 0.075, 0.02, { seg: 5 }))
  const sumX = (coordX, entries, coordZ, spreadByHeight) => {
    entries.forEach((primaryZ, secondaryNear) => {
      const poseHeight = coordX[primaryZ]
      sum(poseHeight, spreadByHeight(secondaryNear / Math.max(1, entries.length - 1)), 0.5 + poseHeight.ry * 0.5, coordZ)
    })
  }
  ;(sumX(sampledFrames, [3, 6, 9, 12, 15, 18], tailChainProjector, (coordX) => lerpValue(0.7, 0.36, coordX)), sumX(sampleCatmullRomFramesResult, [15, 11, 7, 3], boneChainProjector, (coordY) => lerpValue(0.86, 0.6, coordY)), sumX(tailFrames, [16, 13, 10, 7, 4], wingChainProjector, (coordZ) => lerpValue(0.56, 0.24, coordZ)))
  for (const mirrorSide of [1, -1]) {
    const mirrorAngle = (mirrorInputAngle) => (mirrorSide > 0 ? mirrorInputAngle : Math.PI - mirrorInputAngle)
    for (let index = 0; index < 3; index++) {
      for (let hornRepeatIndex = 0; hornRepeatIndex < 3; hornRepeatIndex++) attachHornSpike(sampleCatmullRomFramesResult[13 + hornRepeatIndex + (index % 2)], mirrorAngle(0.62 + index * 0.3 + (hornRepeatIndex % 2) * 0.1), 0.42, 0.52, boneChainProjector)
      for (let ornamentRepeatIndex = 0; ornamentRepeatIndex < 3; ornamentRepeatIndex++) attachHornSpike(sampleCatmullRomFramesResult[2 + ornamentRepeatIndex * 2 + (index % 2)], mirrorAngle(0.56 + index * 0.32 + (ornamentRepeatIndex % 2) * 0.1), 0.4, 0.5, boneChainProjector)
    }
    for (let spineRepeatIndex = 0; spineRepeatIndex < 4; spineRepeatIndex++) attachHornSpike(tailFrames[17 - spineRepeatIndex * 2], mirrorAngle(0.6 + (spineRepeatIndex % 2) * 0.4), 0.3 - spineRepeatIndex * 0.03, 0.42, wingChainProjector)
  }
  ;(modelBuilder.g(composeMatrixResult, () => {
    ;(modelBuilder.bone(beastRig.head).paint(DRAKE_HIDE, { c2: DRAKE_HIDE_SHADE, by: (coordXWidth, coordYWidth, coordZWidth, scaleShadeFactor) => scaleShadeFactor * scaleShadeFactor, ...scaleMaterialConfig }),
      modelBuilder.tube(
        [
          [0, 0.02, -0.26, 0.3, 0.28],
          [0, 0.08, 0.16, 0.41, 0.31],
          [0, 0.06, 0.52, 0.38, 0.27],
          [0, 0.01, 0.92, 0.28, 0.2],
          [0, -0.02, 1.24, 0.22, 0.155],
          [0, -0.05, 1.44, 0.13, 0.09],
        ],
        { seg: 12, up: [1, 0, 0], shape: (angle) => 1 - 0.42 * smoothStep01(0.2, 0.9, Math.sin(angle)) },
      ),
      modelBuilder.paint(DRAKE_LEATHER, { c2: DRAKE_LEATHER_SHADE, gloss: 0.7, mat: MATERIAL_KINDS.leather }))
    for (let crystalRepeatIndex = 0; crystalRepeatIndex < 3; crystalRepeatIndex++) modelBuilder.g(composeMatrix(0, 0.17 - crystalRepeatIndex * 0.045, 0.78 + crystalRepeatIndex * 0.2, -30, 0, 0), () => modelBuilder.crystal(0.045, 0.2 - crystalRepeatIndex * 0.03, 4, 0.8, 0.1))
    ;(modelBuilder.paint(DRAKE_WING_CLOTH, { c2: 9067736, glow: 0.1, glow2: 0.3, mat: MATERIAL_KINDS.cloth, line: 0 }),
      modelBuilder.tube(
        [
          [0, -0.07, 0.1, 0.26, 0.03],
          [0, -0.075, 0.9, 0.18, 0.03],
          [0, -0.07, 1.3, 0.07, 0.02],
        ],
        { seg: 4, up: [1, 0, 0] },
      ),
      modelBuilder.sym((mirrorSide) => {
        ;(modelBuilder.paint(DRAKE_HIDE_DARK, { c2: DRAKE_HIDE, gloss: 0.6, mat: MATERIAL_KINDS.leather }),
          modelBuilder.g(composeMatrix(0.3, 0.27, 0.36, 8, 14, -18), () =>
            modelBuilder.extrude(
              [
                [-0.16, -0.02],
                [0, 0.07],
                [0.12, 0.03],
                [0.1, -0.05],
                [-0.14, -0.07],
              ],
              0.52,
              0.03,
            ),
          ),
          modelBuilder.paint(DRAKE_GLOW_CRYSTAL, { glow: 0.95, mat: MATERIAL_KINDS.crystal }),
          modelBuilder.g(composeMatrix(0.375, 0.15, 0.4, 0, 72, 12), () =>
            modelBuilder.extrude(
              [
                [-0.12, 0],
                [-0.02, 0.05],
                [0.12, 0.02],
                [0.02, -0.045],
              ],
              0.05,
              0,
            ),
          ),
          modelBuilder.paint(659492, { mat: MATERIAL_KINDS.crystal, line: 0 }),
          modelBuilder.g(composeMatrix(0.4, 0.152, 0.4, 0, 72, 12), () => modelBuilder.box(0, 0, 0, 0.03, 0.085, 0.02)))
        const paintMembranePanels = (entries, coordY, coordZ, shadeMixFactor, crystalEdgeFactor) => {
          const lerpRgbChannelsResult = lerpRgbChannels(DRAKE_LEATHER, DRAKE_LEATHER_SHADE, shadeMixFactor),
            lerpedRgbChannels = lerpRgbChannels(DRAKE_LEATHER, DRAKE_LEATHER_SHADE, crystalEdgeFactor)
          ;(modelBuilder.paint(lerpRgbChannelsResult, { c2: crystalEdgeFactor >= 1 ? DRAKE_CRYSTAL_HOT : lerpedRgbChannels, glow: 0, glow2: crystalEdgeFactor >= 1 ? 0.5 : 0, gloss: 0.75, mat: MATERIAL_KINDS.leather, line: 1 }),
            modelBuilder.tube(
              entries.map((samplesZ, secondaryFar) => [samplesZ[0], samplesZ[1], samplesZ[2], lerpValue(coordY, coordZ, secondaryFar / (entries.length - 1))]),
              { seg: 6, crease: 30 },
            ))
        }
        ;(paintMembranePanels(
          [
            [0.21, 0.24, -0.06],
            [0.36, 0.36, -0.48],
            [0.45, 0.4, -0.9],
            [0.5, 0.5, -1.2],
          ],
          0.125,
          0.07,
          0,
          0.6,
        ),
          paintMembranePanels(
            [
              [0.5, 0.5, -1.2],
              [0.52, 0.7, -1.44],
              [0.5, 0.98, -1.56],
            ],
            0.07,
            0.006,
            0.6,
            1,
          ),
          paintMembranePanels(
            [
              [0.5, 0.5, -1.2],
              [0.6, 0.46, -1.48],
              [0.73, 0.38, -1.72],
            ],
            0.062,
            0.006,
            0.6,
            1,
          ),
          paintMembranePanels(
            [
              [0.36, -0.06, 0.06],
              [0.58, -0.12, -0.3],
              [0.72, -0.04, -0.66],
            ],
            0.085,
            0.006,
            0.2,
            1,
          ),
          modelBuilder.paint(DRAKE_LEATHER_LIGHT, { gloss: 0.7, mat: MATERIAL_KINDS.leather, line: 0 }))
        for (let crystalRowIndex = 0; crystalRowIndex < 5; crystalRowIndex++) {
          const sumX = 0.5 + crystalRowIndex * 0.19,
            lerpedZ = lerpValue(0.3, 0.12, crystalRowIndex / 4)
          modelBuilder.g(composeMatrix(lerpedZ, -0.1, sumX, 180, 0, 8), () => modelBuilder.crystal(0.035, crystalRowIndex === 4 ? 0.24 : 0.13, 4, 0.9, 0.05))
        }
        modelBuilder.bone(frillJoints[mirrorSide > 0 ? 0 : 1])
        const samplesWidth = [0.36, 0.06, -0.08],
          samplesHeight = [
            [0.62, 0.46, -0.5],
            [0.86, 0.12, -0.64],
            [0.7, -0.24, -0.5],
          ]
        modelBuilder.paint(DRAKE_HIDE_DARK, { c2: DRAKE_HIDE_MID, gloss: 0.5, mat: MATERIAL_KINDS.leather })
        for (const crystalTipPoint of samplesHeight) modelBuilder.limb(samplesWidth, crystalTipPoint, 0.05, 0.012, { seg: 4 })
        modelBuilder.paint(DRAKE_MEMBRANE, { c2: DRAKE_LEATHER_DARK, glow: 0.03, glow2: 0.4, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.vein, patternScale: 8, patternAmt: 0.5, by: (coordXHeight, coordYHeight, coordZHeight, membraneVeinU) => Math.pow(membraneVeinU, 4) })
        for (let segmentIndex = 0; segmentIndex < 2; segmentIndex++)
          modelBuilder.sheet(1, 3, (primaryWidth, secondaryTop) => {
            const samplesDepth = [lerpValue(samplesHeight[segmentIndex][0], samplesHeight[segmentIndex + 1][0], primaryWidth), lerpValue(samplesHeight[segmentIndex][1], samplesHeight[segmentIndex + 1][1], primaryWidth), lerpValue(samplesHeight[segmentIndex][2], samplesHeight[segmentIndex + 1][2], primaryWidth)],
              deltaZ = 1 - 0.2 * Math.sin(primaryWidth * Math.PI) * secondaryTop
            return [lerpValue(samplesWidth[0], samplesDepth[0], secondaryTop * deltaZ), lerpValue(samplesWidth[1], samplesDepth[1], secondaryTop * deltaZ), lerpValue(samplesWidth[2], samplesDepth[2], secondaryTop * deltaZ)]
          })
        modelBuilder.bone(beastRig.head)
      }),
      modelBuilder.paint(DRAKE_LEATHER, { c2: DRAKE_LEATHER_SHADE, gloss: 0.7, mat: MATERIAL_KINDS.leather }),
      modelBuilder.g(composeMatrix(0, 0.33, 0.4, -14, 0, 0), () => modelBuilder.torus(0.15, 0.035, 0.05, 8, 4, { crease: 30 })),
      modelBuilder.bone(crestJoint).paint(DRAKE_CRYSTAL, { c2: DRAKE_CRYSTAL_HOT, glow: 0.4, glow2: 0.7, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 0 }),
      modelBuilder.ball(0, 0.37, 0.4, 0.12, 0.12, 0.12, 1),
      modelBuilder.bone(ventJoint).paint(15400959, { c2: 11832575, glow: 1, mat: MATERIAL_KINDS.crystal, line: 0 }),
      modelBuilder.ball(0, -0.13, 1, 0.2, 0.17, 0.24, 1),
      modelBuilder.bone(beastRig.jaw).paint(DRAKE_HIDE, { c2: DRAKE_SCALE, by: (coordXDepth, coordYDepth, coordZDepth, jawScaleU, jawNormalX, jawNormalY) => smoothStep01(-0.1, -0.8, jawNormalY), ...scaleMaterialConfig }),
      modelBuilder.tube(
        [
          [0, -0.17, -0.1, 0.3, 0.12],
          [0, -0.22, 0.45, 0.32, 0.12],
          [0, -0.215, 0.92, 0.23, 0.095],
          [0, -0.185, 1.24, 0.15, 0.07],
          [0, -0.165, 1.38, 0.08, 0.05],
        ],
        { seg: 10, up: [1, 0, 0], shape: (tubeAngle) => 1 - 0.4 * smoothStep01(-0.2, -0.9, Math.sin(tubeAngle)) },
      ),
      modelBuilder.paint(DRAKE_WING_CLOTH, { c2: 9067736, glow: 0.1, glow2: 0.3, mat: MATERIAL_KINDS.cloth, line: 0 }),
      modelBuilder.tube(
        [
          [0, -0.165, 0.1, 0.24, 0.03],
          [0, -0.165, 0.9, 0.16, 0.03],
          [0, -0.15, 1.26, 0.07, 0.02],
        ],
        { seg: 4, up: [1, 0, 0] },
      ),
      modelBuilder.sym(() => {
        modelBuilder.paint(DRAKE_LEATHER_LIGHT, { gloss: 0.7, mat: MATERIAL_KINDS.leather, line: 0 })
        for (let spikeRowIndex = 0; spikeRowIndex < 4; spikeRowIndex++) {
          const sumY = 0.58 + spikeRowIndex * 0.2,
            lerpedWidth = lerpValue(0.26, 0.1, spikeRowIndex / 3)
          modelBuilder.g(composeMatrix(lerpedWidth + 0.02, -0.15, sumY, 0, 0, -8), () => modelBuilder.crystal(0.03, spikeRowIndex === 3 ? 0.17 : 0.09, 4, 0.9, 0.05))
        }
        ;(modelBuilder.paint(DRAKE_LEATHER, { c2: DRAKE_LEATHER_SHADE, gloss: 0.7, mat: MATERIAL_KINDS.leather }), modelBuilder.g(composeMatrix(0.26, -0.25, 0.02, 140, 0, 24), () => modelBuilder.crystal(0.06, 0.34, 4, 0.8, 0.1)))
      }))
  }),
    mappedResult.forEach((joints, secondaryBottom) => {
      const itemsX = secondaryBottom === 0 ? 1 : -1,
        entriesZ = [
          [itemsX * 0.15, -0.26, 1.1],
          [itemsX * 0.22, -0.6, 1.04],
          [itemsX * 0.27, -0.9, 0.82],
          [itemsX * 0.3, -1.06, 0.46],
        ]
      ;(modelBuilder.bind(makeBoneChainProjector(builder, joints.js, 0.9, joints.tip)).paint(DRAKE_SCALE_LIGHT, { c2: DRAKE_LEATHER_DARK, glow: 0, glow2: 0.6, mat: MATERIAL_KINDS.leather, line: 1 }),
        modelBuilder.tube(
          entriesZ.map((samplesStart, secondaryInner) => {
            const transformedTip = transformPoint(samplesStart[0], samplesStart[1], samplesStart[2])
            return [transformedTip.x, transformedTip.y, transformedTip.z, lerpValue(0.034, 0.006, secondaryInner / 3)]
          }),
          { seg: 4 },
        ))
    }),
    entriesY.forEach((hero, segmentIndex) => {
      const itemsY = segmentIndex === 0 ? 1 : -1,
        scaledValueStart = (samples) => [samples[0] * itemsY, samples[1], samples[2]],
        itResult = scaledValueStart(samples),
        wingMidJoint = scaledValueStart(samplesX),
        samplesEnd = scaledValueStart(samplesY),
        samplesNear = entries.map(scaledValueStart),
        samplesFar = scaledValueStart(entriesX)
      ;(modelBuilder.bone(hero.a).paint(DRAKE_HIDE, { c2: DRAKE_HIDE_DARK, ...scaleMaterialConfig }),
        modelBuilder.limb(itResult, wingMidJoint, 0.17, 0.11, { seg: 6, bulge: 0.2 }),
        modelBuilder.bone(hero.f),
        modelBuilder.limb(wingMidJoint, samplesEnd, 0.11, 0.08, { seg: 6, bulge: 0.12 }),
        modelBuilder.paint(DRAKE_CRYSTAL, { c2: DRAKE_CRYSTAL_HOT, glow: 0.15, glow2: 0.6, gloss: 0.8, mat: MATERIAL_KINDS.crystal, line: 1 }),
        modelBuilder.limb(wingMidJoint, [wingMidJoint[0] + itemsY * 0.1, wingMidJoint[1] + 0.3, wingMidJoint[2] - 0.5], 0.08, 0.008, { seg: 4 }),
        modelBuilder.bone(hero.h).paint(DRAKE_LEATHER_LIGHT, { c2: 16777215, gloss: 0.8, mat: MATERIAL_KINDS.leather }),
        modelBuilder.limb(samplesEnd, [samplesEnd[0] + itemsY * 0.12, samplesEnd[1] + 0.12, samplesEnd[2] + 0.5], 0.09, 0.006, { seg: 5 }),
        modelBuilder.paint(DRAKE_HIDE, { ...scaleMaterialConfig }),
        modelBuilder.ball(samplesEnd[0], samplesEnd[1], samplesEnd[2], 0.11, 0.11, 0.11, 1),
        hero.fingers.forEach((primaryHeight, secondaryOuter) => {
          ;(modelBuilder.bone(primaryHeight).paint(DRAKE_HIDE, { c2: DRAKE_HIDE_MID, gloss: 0.5, mat: MATERIAL_KINDS.leather }), modelBuilder.limb(samplesEnd, samplesNear[secondaryOuter], 0.06, 0.014, { seg: 5 }))
        }))
      const computed = 3.9,
        distance = /**
 * 处理距离。
 *
 * @param coordX - 主要输入
 * @param coordY - 输入
 * @param coordZ - 输入
 */
(coordX, coordY, coordZ) => {
          ;(modelBuilder.bind((coordXX, coordYX, coordZX, paintWeightU) => [coordX, coordY, 1 - paintWeightU]),
            modelBuilder.paint(DRAKE_MEMBRANE, {
              c2: DRAKE_HIDE_MID,
              glow: 0.03,
              glow2: 0.34,
              mat: MATERIAL_KINDS.cloth,
              pattern: TERRAIN_LOOK.vein,
              patternScale: 3,
              patternAmt: 0.6,
              by: (coordXStart, coordYStart, coordZStart) => smoothStep01(0.25, 1, Math.hypot(coordXStart - samplesEnd[0], coordYStart - samplesEnd[1], coordZStart - samplesEnd[2]) / computed),
            }),
            modelBuilder.sheet(5, 4, (primaryDepth, secondaryV2) => coordZ(primaryDepth, secondaryV2)))
        },
        lerpedHeight = (samples, samplesX, coordZ) => (coordYY, coordZY) => {
          const samplesTop = [lerpValue(samples[0], samplesX[0], coordZY), lerpValue(samples[1], samplesX[1], coordZY), lerpValue(samples[2], samplesX[2], coordZY)],
            scaledValueEnd = coordYY * (1 - (0.17 * Math.sin(Math.PI * coordZY) + 0.035 * Math.sin(Math.PI * coordZY * 3)) * coordYY * coordYY)
          return [lerpValue(samplesEnd[0], samplesTop[0], scaledValueEnd), lerpValue(samplesEnd[1], samplesTop[1], scaledValueEnd) - coordZ * Math.sin(Math.PI * coordZY) * coordYY, lerpValue(samplesEnd[2], samplesTop[2], scaledValueEnd)]
        }
      ;(distance(hero.fingers[0], hero.fingers[1], lerpedHeight(samplesNear[0], samplesNear[1], 0.14)),
        distance(hero.fingers[1], hero.fingers[2], lerpedHeight(samplesNear[1], samplesNear[2], 0.16)),
        distance(hero.fingers[2], beastRig.chest, (primaryStart, secondaryV3) => {
          const samplesBottom = [lerpValue(samplesEnd[0], samplesNear[2][0], primaryStart), lerpValue(samplesEnd[1], samplesNear[2][1], primaryStart), lerpValue(samplesEnd[2], samplesNear[2][2], primaryStart)],
            samplesInner = [lerpValue(itResult[0], samplesFar[0], primaryStart), lerpValue(itResult[1] - 0.12, samplesFar[1], primaryStart), lerpValue(itResult[2] - 0.2, samplesFar[2], primaryStart)],
            deltaWidth = 1 - 0.14 * Math.sin(Math.PI * secondaryV3) * primaryStart * primaryStart
          return [lerpValue(samplesBottom[0], samplesInner[0], secondaryV3), lerpValue(samplesBottom[1], samplesInner[1], secondaryV3) - 0.18 * Math.sin(Math.PI * secondaryV3) * (0.4 + 0.6 * primaryStart), lerpValue(samplesBottom[2], samplesInner[2], secondaryV3) * deltaWidth + (1 - deltaWidth) * 0.2]
        }),
        modelBuilder.bind((normalOffset) => [hero.f, hero.a, smoothStep01(0.9, 2.3, Math.abs(normalOffset))]),
        modelBuilder.paint(DRAKE_MEMBRANE, { c2: DRAKE_HIDE_MID, glow: 0.02, glow2: 0.2, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.vein, patternScale: 3, patternAmt: 0.6 }),
        modelBuilder.sheet(3, 2, (primaryEnd, secondaryV4) => {
          const samplesOuter = [lerpValue(itResult[0], samplesEnd[0], primaryEnd), lerpValue(itResult[1], samplesEnd[1], primaryEnd) + 0.04, lerpValue(itResult[2] + 0.05, samplesEnd[2], primaryEnd) - 0.2 * Math.sin(Math.PI * primaryEnd)],
            samplesV2 = primaryEnd < 0.5 ? [lerpValue(itResult[0], wingMidJoint[0], primaryEnd * 2), lerpValue(itResult[1], wingMidJoint[1], primaryEnd * 2), lerpValue(itResult[2], wingMidJoint[2], primaryEnd * 2)] : [lerpValue(wingMidJoint[0], samplesEnd[0], primaryEnd * 2 - 1), lerpValue(wingMidJoint[1], samplesEnd[1], primaryEnd * 2 - 1), lerpValue(wingMidJoint[2], samplesEnd[2], primaryEnd * 2 - 1)]
          return [lerpValue(samplesOuter[0], samplesV2[0], secondaryV4), lerpValue(samplesOuter[1], samplesV2[1], secondaryV4), lerpValue(samplesOuter[2], samplesV2[2], secondaryV4)]
        }))
    }),
    modelBuilder.bakeGrounding(4.4, 0.72, 0.9))
  const computed = 4.2,
    entriesDepth = [8, 18, 30, 38, 40, 34],
    sumY = (coordX, animState, effectStyle) => {
      const sum = animState.time + animState.seed * 7,
        angleValue = Math.sin((sum * DRAKE_FULL_CIRCLE) / 3.2),
        computed = (animState.mode & 2) !== 0,
        computedX = animState.hp < 0.5
      let total = 0,
        jointPitch = 0,
        computedY = 0,
        computedZ = 1,
        computedWidth = 6,
        sumX = 4 + angleValue * 2,
        frillSpread = 0.1 + 0.05 * angleValue,
        scaledValueX = 1 + 0.12 * angleValue + (computed ? 0.35 : 0) + (computedX ? 0.25 * Math.sin(sum * 9) : 0),
        computedHeight = 0,
        poseActiveFlag = !0
      const scaledValueY = (neckPitchOffset, coordY, coordZ, neckBaseOffset, headOffset, neckHeightOffset = 0) => {
        ;(coordX.add(beastRig.neck[0], neckPitchOffset, neckHeightOffset * 0.3, 0), coordX.add(beastRig.neck[1], coordY, neckHeightOffset * 0.3, 0), coordX.add(beastRig.neck[2], coordZ, neckHeightOffset * 0.25, 0), coordX.add(beastRig.neck[3], neckBaseOffset, neckHeightOffset * 0.15, 0), coordX.add(beastRig.head, headOffset, 0, 0))
      }
      switch (
        (coordX.pos(beastRig.pelvis, 0, -0.12 + angleValue * 0.03, 0),
        coordX.rot(beastRig.chest, angleValue * 1, 0, 0),
        coordX.rot(beastRig.neck[0], angleValue * 1.5, Math.sin(sum * 0.45) * 7, 0),
        coordX.rot(beastRig.neck[1], -angleValue * 1.5, Math.sin(sum * 0.45 + 0.7) * 8, 0),
        coordX.rot(beastRig.neck[2], 0, Math.sin(sum * 0.45 + 1.4) * 7, 0),
        coordX.rot(beastRig.neck[3], angleValue, Math.sin(sum * 0.45 + 2.1) * 5, 0),
        coordX.rot(beastRig.head, Math.sin(sum * 0.8) * 3, Math.sin(sum * 0.45 + 2.6) * 5, 0),
        coordX.rot(jointPitch, 0, sum * 30, 0),
        animState.anim)
      ) {
        case "dead": {
          const tValue = animState.t,
            scaledValueZ = easeOutQuad(inverseLerpClamped(tValue, 0, 0.3)) * (1 - inverseLerpClamped(tValue, 0.6, 0.9)),
            squareValueResult = squareValue(inverseLerpClamped(tValue, 0.6, 1.5)),
            squaredValue = squareValue(inverseLerpClamped(tValue, 1.3, 1.95)),
            items = animState.seed > 0.5 ? 1 : -1
          ;((total = 0.96 * scaledValueZ + 0.3 * squareValueResult * (1 - scaledValueZ)),
            (jointPitch = 26 * scaledValueZ - 46 * squareValueResult),
            (sumX = 4 + 40 * scaledValueZ + 14 * squaredValue),
            (frillSpread = scaledValueZ),
            scaledValueY(-16 * scaledValueZ + 30 * squaredValue, -18 * scaledValueZ + 36 * squaredValue, -6 * scaledValueZ + 30 * squaredValue, -24 * scaledValueZ + 16 * squaredValue, -26 * scaledValueZ - 10 * squaredValue, 0),
            coordX.add(beastRig.head, 0, 0, items * -40 * squaredValue),
            coordX.move(beastRig.pelvis, 0, 0.1 * scaledValueZ - 0.3 * squareValueResult, 0),
            coordX.rot(beastRig.root, 0, 0, items * (78 * squareValueResult + 3 * smoothFalloff(tValue, 1.62, 0.15))),
            coordX.pos(beastRig.root, items * 0.9 * squareValueResult, 0.72 * squareValueResult, 0),
            beastRig.legs.forEach((poseDepth, secondaryV5) => poseQuadrupedLegIk(beastRig, coordX, secondaryV5, poseDepth.rx + poseDepth.side * 0.1 * squareValueResult, poseDepth.ry - 0.1 * squareValueResult, poseDepth.rz + (poseDepth.front ? -0.3 : 0.3) * squareValueResult, 30 * squareValueResult)),
            (poseActiveFlag = !1),
            (computedZ = 1 - 0.5 * squareValueResult),
            (computedWidth = 6 * (1 - squareValueResult)))
          const normalizedProgress = inverseLerpClamped(tValue, 0.58, 0.72)
          coordX.scale(jointPitch, (1 + 0.8 * smoothFalloff(tValue, 0.6, 0.08)) * (1 - normalizedProgress))
          const tailFadeProgress = inverseLerpClamped(tValue, 2, 3.1)
          for (let index = 0; index < 6; index++) coordX.scale(beastRig.tail[5 - index], 1 - 0.999 * inverseLerpClamped(tailFadeProgress, index * 0.07, index * 0.07 + 0.3))
          ;((effectStyle.tint = 0.6 * inverseLerpClamped(tValue, 1.8, 2.8)), (effectStyle.tintColor = 11571455), (scaledValueX = (1 + 1.2 * smoothFalloff(tValue, 0.62, 0.14)) * (1 - 0.85 * inverseLerpClamped(tValue, 0.8, 1.6)) + 0.9 * tailFadeProgress))
          break
        }
        case "move": {
          const scaledValueWidth = animState.stride * DRAKE_FULL_CIRCLE
          ;(scaledValueY(14, 8, -6, -10, -4, Math.sin(scaledValueWidth) * 6), (computedZ = 0.12), (computedWidth = 16), animateBeastGait(beastRig, coordX, animState.stride, { style: "walk", stride: computed, lift: 0.4, bob: 0.05, pitch: 1.5, sway: 4, roll: 2.5, curl: 20 }), (poseActiveFlag = !1))
          break
        }
        case "attack": {
          const windupEase = windupEaseCurve(animState.p, animState.windup),
            lungeEase = easeOutQuad(inverseLerpClamped(windupEase, 0, 0.27)),
            windupRelease = inverseLerpClamped(windupEase, 0.27, 0.36),
            recoveryEase = hermiteSmoothStep(inverseLerpClamped(windupEase, 0.5, 1)),
            scaledValueHeight = lungeEase * (1 - windupRelease),
            scaledValueDepth = windupRelease * (1 - recoveryEase)
          if (animState.mode & 1) {
            const scaledValueStart = 34 * scaledValueHeight - 128 * scaledValueDepth
            ;(coordX.rot(beastRig.root, 0, scaledValueStart, 0), coordX.move(beastRig.pelvis, 0, -0.1 * (scaledValueHeight + scaledValueDepth), 0), (computedZ = 1 - 0.9 * Math.max(scaledValueHeight, scaledValueDepth)))
            for (let tailSegmentIndex = 0; tailSegmentIndex < 6; tailSegmentIndex++) coordX.add(beastRig.tail[tailSegmentIndex], 0, 16 * scaledValueHeight - 22 * scaledValueDepth * (1 - tailSegmentIndex * 0.1), 0)
            ;(scaledValueY(10 * scaledValueDepth, 6 * scaledValueDepth, 0, 0, 0, 40 * scaledValueDepth - 20 * scaledValueHeight), (total = 0.45 * scaledValueDepth), (jointPitch = 10 * scaledValueDepth), (computedWidth = 0))
            const peakAttackIntensity = Math.max(scaledValueHeight, scaledValueDepth)
            ;(beastRig.legs.forEach((poseStart, secondaryV6) => poseQuadrupedLegIk(beastRig, coordX, secondaryV6, poseStart.rx, poseStart.ry + 0.28 * peakAttackIntensity * Math.max(0, Math.sin(windupEase * 40 + secondaryV6 * 1.6)), poseStart.rz, 0)), (poseActiveFlag = !1), (scaledValueX += 0.3 * scaledValueHeight + 0.8 * smoothFalloff(windupEase, 0.38, 0.16)))
          } else
            (scaledValueY(-22 * scaledValueHeight + 34 * scaledValueDepth, -26 * scaledValueHeight + 40 * scaledValueDepth, 22 * scaledValueHeight + 16 * scaledValueDepth, 20 * scaledValueHeight - 30 * scaledValueDepth, 12 * scaledValueHeight - 22 * scaledValueDepth, 0),
              coordX.move(beastRig.pelvis, 0, 0.08 * scaledValueHeight - 0.14 * scaledValueDepth, -0.3 * scaledValueHeight + 0.55 * scaledValueDepth),
              coordX.add(beastRig.pelvis, -4 * scaledValueHeight + 6 * scaledValueDepth, 0, 0),
              (sumX = 4 + 34 * scaledValueHeight + 30 * windupRelease * (1 - inverseLerpClamped(windupEase, 0.36, 0.41))),
              (frillSpread = scaledValueHeight + 0.4 * scaledValueDepth),
              (total = 0.3 * scaledValueHeight + 0.14 * scaledValueDepth),
              (jointPitch = 14 * scaledValueHeight - 6 * scaledValueDepth),
              (scaledValueX += 0.3 * scaledValueHeight + 0.8 * smoothFalloff(windupEase, 0.36, 0.14)))
          break
        }
        case "cast_s1": {
          const breathProgress = inverseLerpClamped(animState.p, 0, BREATH_WARN_PHASE),
            scaledValueEnd = easeOutQuad(Math.min(1, breathProgress * 1.6)),
            exhaleProgress = inverseLerpClamped(animState.p, BREATH_WARN_PHASE, 1),
            inhaleEase = easeOutQuad(inverseLerpClamped(exhaleProgress, 0, 0.18)),
            scaledValueNear = scaledValueEnd * (1 - inhaleEase),
            lerped = inhaleEase * lerpValue(11, -11, hermiteSmoothStep(exhaleProgress))
          ;(scaledValueY(-20 * scaledValueNear + 14 * inhaleEase, -24 * scaledValueNear + 20 * inhaleEase, -8 * scaledValueNear + 8 * inhaleEase, 26 * scaledValueNear - 20 * inhaleEase, 18 * scaledValueNear - 12 * inhaleEase, lerped * 2.4),
            coordX.move(beastRig.pelvis, 0, -0.16 * scaledValueEnd + 0.06 * inhaleEase, 0.12 * scaledValueNear - 0.32 * inhaleEase * (1 - 0.4 * exhaleProgress)),
            coordX.add(beastRig.pelvis, -5 * scaledValueNear + 4 * inhaleEase, 0, 0),
            (total = scaledValueEnd),
            (jointPitch = 28 * scaledValueNear - 8 * inhaleEase + 4 * Math.sin(exhaleProgress * 30) * inhaleEase),
            (computedY = -24 * inhaleEase * (1 - exhaleProgress * 0.5)),
            (sumX = 4 + 14 * breathProgress * (1 - inhaleEase) + 40 * inhaleEase),
            (frillSpread = scaledValueEnd),
            (computedZ = 1 - 0.75 * scaledValueEnd),
            (computedHeight = breathProgress * breathProgress * (1 - inhaleEase) + 0.55 * inhaleEase * (1 - inverseLerpClamped(exhaleProgress, 0.85, 1))),
            (scaledValueX += 0.3 * breathProgress + 0.6 * breathProgress * breathProgress + 0.5 * inhaleEase))
          break
        }
        case "stunned": {
          ;(scaledValueY(26, 30, 16, 6, 10, Math.sin(sum * 2.4) * 16), coordX.add(beastRig.head, 0, 0, Math.sin(sum * 2.4 + 1) * 14), (jointPitch = -14), (total = 0.12), (sumX = 14), (scaledValueX *= 0.7))
          break
        }
        default:
          if (animState.spawnT >= 0) {
            const spawnTime = animState.spawnT,
              spawnRiseEase = easeOutQuad(inverseLerpClamped(spawnTime, 0.9, 1.4)),
              spawnSettleEase = hermiteSmoothStep(inverseLerpClamped(spawnTime, 1.3, 1.9)),
              scaledValueFar = easeOutQuad(inverseLerpClamped(spawnTime, 1.6, 1.95)) * (1 - hermiteSmoothStep(inverseLerpClamped(spawnTime, 2.15, 2.4)))
            ;(coordX.pos(beastRig.root, 0, -4.6 + 2.4 * spawnRiseEase + 2.2 * spawnSettleEase, 0),
              coordX.add(beastRig.pelvis, -22 * spawnRiseEase * (1 - spawnSettleEase), 0, 0),
              scaledValueY(-10 * (1 - spawnSettleEase) - 12 * scaledValueFar, -12 * (1 - spawnSettleEase) - 16 * scaledValueFar, -8 * scaledValueFar, -16 * scaledValueFar, -14 * (1 - spawnRiseEase) - 22 * scaledValueFar, 0),
              (total = scaledValueFar),
              (jointPitch = 24 * scaledValueFar),
              (sumX = 4 + 40 * scaledValueFar),
              (frillSpread = scaledValueFar),
              (computedZ = 0.3 + 0.7 * hermiteSmoothStep(inverseLerpClamped(spawnTime, 1.9, 2.4))),
              (scaledValueX += 0.4 * spawnRiseEase * (1 - spawnSettleEase) + 0.7 * scaledValueFar))
          } else if (computed) ((total = 0.6), (jointPitch = 8 + 3 * Math.sin(sum * 3)), coordX.move(beastRig.pelvis, 0, -0.12, 0), scaledValueY(10, 12, 0, -6, 4, 0), (sumX = 10 + 4 * Math.sin(sum * 5)), (frillSpread = 0.8), (computedZ = 0.7))
          else {
            const idleCyclePhase = (sum / 10.5) % 1,
              scaledValueTop = hermiteSmoothStep(inverseLerpClamped(idleCyclePhase, 0.7, 0.76)) * (1 - hermiteSmoothStep(inverseLerpClamped(idleCyclePhase, 0.9, 0.97)))
            ;(scaledValueY(-8 * scaledValueTop, -10 * scaledValueTop, -4 * scaledValueTop, -12 * scaledValueTop, -14 * scaledValueTop, 0), (total = 0.45 * scaledValueTop + 0.012 * (1 + Math.sin(sum * 7))), (jointPitch = 10 * scaledValueTop), (sumX = 4 + angleValue * 2 + 26 * scaledValueTop), (frillSpread = 0.1 + 0.7 * scaledValueTop), (scaledValueX += 0.5 * scaledValueTop))
            const smoothFalloffResult = smoothFalloff((sum / 4) % 1, 0.5, 0.07)
            ;(coordX.add(beastRig.tail[4], -22 * smoothFalloffResult, 0, 0), coordX.add(beastRig.tail[5], -30 * smoothFalloffResult, 0, 0))
          }
      }
      const hitPulse = hitImpactPulse(animState.hitT)
      if (hitPulse > 0 && animState.anim !== "dead") {
        const itemsX = animState.seed > 0.5 ? 1 : -1
        ;(coordX.add(beastRig.neck[2], 4 * hitPulse, itemsX * 14 * hitPulse, 0), coordX.add(beastRig.head, 6 * hitPulse, itemsX * 12 * hitPulse, itemsX * 16 * hitPulse), (jointPitch += 9 * hitPulse), (total += 0.06 * hitPulse))
      }
      for (let tailSwayIndex = 0; tailSwayIndex < 6; tailSwayIndex++) coordX.add(beastRig.tail[tailSwayIndex], Math.sin(sum * 0.9 - tailSwayIndex * 0.6) * 2, entriesDepth[tailSwayIndex] * computedZ + Math.sin(sum * 0.8 - tailSwayIndex * 0.7) * computedWidth * (0.4 + tailSwayIndex * 0.2), 0)
      const delta = 1 - Math.min(1, Math.max(0, total))
      ;(entriesY.forEach((primaryNear, secondaryV7) => {
        const itemsZ = secondaryV7 === 0 ? 1 : -1,
          entriesWidth = [primaryNear.a, primaryNear.f, primaryNear.h, primaryNear.fingers[0], primaryNear.fingers[1], primaryNear.fingers[2]]
        for (let hornSegmentIndex = 0; hornSegmentIndex < 6; hornSegmentIndex++) {
          const selectedS = entriesZ[hornSegmentIndex],
            scaledValueNear = selectedS[3] * delta * 0.5,
            angleValueY = Math.sin(scaledValueNear),
            scaledValueFar = entriesWidth[hornSegmentIndex] * 4
          ;((coordX.q[scaledValueFar] = selectedS[0] * angleValueY), (coordX.q[scaledValueFar + 1] = selectedS[1] * angleValueY * itemsZ), (coordX.q[scaledValueFar + 2] = selectedS[2] * angleValueY * itemsZ), (coordX.q[scaledValueFar + 3] = Math.cos(scaledValueNear)))
        }
        ;(coordX.pre(primaryNear.a, 0, itemsZ * computedY, itemsZ * jointPitch), coordX.add(primaryNear.f, 0, 0, itemsZ * jointPitch * 0.3))
      }),
        coordX.rot(beastRig.jaw, sumX, 0, 0),
        frillJoints.forEach((primaryFar, secondaryV8) => {
          const itemsWidth = secondaryV8 === 0 ? 1 : -1
          ;(coordX.rot(primaryFar, 0, itemsWidth * (34 - 44 * frillSpread), itemsWidth * (-8 + 14 * frillSpread)), coordX.scale(primaryFar, 0.8 + 0.3 * frillSpread))
        }),
        coordX.scale(poseActiveFlag, Math.max(0.001, computedHeight)),
        (effectStyle.glow = Math.max(0.05, scaledValueX)),
        poseActiveFlag && poseAllLegsIk(beastRig, coordX))
    }
  return {
    key: "monster:abyss_drake",
    geometry: modelBuilder.build(),
    rig: builder,
    height: 4.9,
    radius: 2.6,
    scale: 1,
    stride: computed,
    triangles: modelBuilder.triangleCount,
    deathDur: 3.2,
    spawnDur: 2.4,
    outline: 1.8,
    attach: {
      chest: { joint: beastRig.chest, x: 0, y: 0.1, z: 0.3 },
      head: { joint: beastRig.head, x: 0, y: 0.35, z: 0.3 },
      muzzle: { joint: ventJoint, x: 0, y: 0, z: 0.45 },
      weapon: { joint: ventJoint, x: 0, y: 0, z: 0.45 },
      vent: { joint: ventJoint, x: 0, y: 0, z: 0.3 },
      crest: { joint: crestJoint, x: 0, y: 0, z: 0 },
      tail: { joint: beastRig.tail[5], x: 0, y: 0, z: -0.8 },
      wingL: { joint: entriesY[0].fingers[0], x: entries[0][0] - samplesY[0], y: entries[0][1] - samplesY[1], z: entries[0][2] - samplesY[2] },
      wingR: { joint: entriesY[1].fingers[0], x: -(entries[0][0] - samplesY[0]), y: entries[0][1] - samplesY[1], z: entries[0][2] - samplesY[2] },
    },
    blend: (primary, secondary) => (secondary === "attack" ? 0.12 : secondary === "cast_s1" ? 0.18 : 0.3),
    animate: sumY,
  }
}

const EMBER_GOLEM_FULL_CIRCLE = Math.PI * 2,
  EMBER_GOLEM_HIDE = 8010282,
  EMBER_GOLEM_HIDE_DARK = 11035711,
  EMBER_GOLEM_HIDE_SHADE = 5909026,
  EMBER_GOLEM_HIDE_MID = 11565648,
  EMBER_GOLEM_ARMOR = 2759968,
  EMBER_GOLEM_ARMOR_SHADE = 6964282,
  EMBER_GOLEM_LAVA = 16734748,
  EMBER_GOLEM_LAVA_HOT = 16765562,
  EMBER_GOLEM_FUR = 15745562,
  EMBER_GOLEM_LAVA_TIP = 16760912,
  EMBER_GOLEM_ROCK = 2759194,
  EMBER_GOLEM_ROCK_GLOW = 16734774,
  EMBER_GOLEM_CRYSTAL_GLOW = 16756800,
  emberGolemHashNoise = (primary, secondary) => {
    const angleValue = Math.sin(primary * 127.1 + secondary * 311.7) * 43758.5453
    return angleValue - Math.floor(angleValue)
  }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildEmberGolemModel() {
  const beastRig = buildBeastRig({
      pelvis: [1.3, -1],
      chest: [1.42, 0.5],
      neck: [[1.6, 1.12]],
      head: [1.66, 1.5],
      jaw: [1.52, 1.6],
      tail: [[1.42, -1.72]],
      front: [
        [0.7, 1.4, 0.62],
        [0.8, 0.78, 0.48],
        [0.82, 0.13, 0.7],
      ],
      hind: [
        [0.6, 1.26, -1.05],
        [0.68, 0.7, -0.78],
        [0.66, 0.13, -1.1],
      ],
      bendFront: -1,
      bendHind: 1,
    }),
    entries = beastRig.rig,
    craterJoint = entries.add("crater", beastRig.chest, 0, 2.02, 0.1),
    coreJoint = entries.add("core", craterJoint, 0, 2.12, 0.1),
    entriesX = [0, 1, 2].map((flameIndex) => entries.add(`flame${flameIndex}`, craterJoint, 0, 2.16, 0.1)),
    entriesY = [0, 1, 2, 3].map((maneIndex) => entries.add(`mane${maneIndex}`, beastRig.chest, 0, 1.75, 0.95)),
    builder = new ModelBuilder()
  builder.crease = 62
  const furMaterialConfig = { mat: MATERIAL_KINDS.fur, pattern: TERRAIN_LOOK.fur, patternScale: 5, patternAmt: 0.5, grain: 0.08 },
    furShadePaint = (coordX, coordY, coordZ, hidePaintU, hideNormalX, hideShadeNormalY) => smoothStep01(0.05, -0.8, hideShadeNormalY),
    glossConfig = { gloss: 0.85, mat: MATERIAL_KINDS.rock, pattern: TERRAIN_LOOK.strata, patternScale: 5, patternAmt: 0.35 }
  beastRig.legs.forEach((poseEnd) => {
    const legSideSign = poseEnd.side,
      legBoneProjector = makeBoneChainProjector(entries, [poseEnd.upper, poseEnd.lower, poseEnd.foot], 0.5)
    ;(builder.bind(legBoneProjector).paint(EMBER_GOLEM_HIDE, { c2: EMBER_GOLEM_HIDE_SHADE, by: (primaryY, secondaryY) => smoothStep01(1.1, 0.2, secondaryY), ...furMaterialConfig }),
      poseEnd.front
        ? builder.tube(
            [
              [legSideSign * 0.66, 1.66, 0.6, 0.36, 0.5],
              [legSideSign * 0.76, 1.2, 0.56, 0.33, 0.4],
              [legSideSign * 0.8, 0.8, 0.5, 0.27, 0.31],
              [legSideSign * 0.81, 0.46, 0.58, 0.25, 0.27],
              [legSideSign * 0.82, 0.2, 0.68, 0.28, 0.32],
            ],
            { seg: 9, cap0: !1 },
          )
        : builder.tube(
            [
              [legSideSign * 0.52, 1.52, -1.08, 0.38, 0.56],
              [legSideSign * 0.64, 1.06, -0.94, 0.34, 0.46],
              [legSideSign * 0.68, 0.72, -0.82, 0.25, 0.3],
              [legSideSign * 0.67, 0.42, -0.98, 0.21, 0.24],
              [legSideSign * 0.66, 0.2, -1.08, 0.24, 0.28],
            ],
            { seg: 9, cap0: !1 },
          ))
    const sumZ = poseEnd.rz + (poseEnd.front ? 0.12 : 0.1),
      itemsHeight = poseEnd.front ? 0.31 : 0.26
    ;(builder.bone(poseEnd.foot).paint(EMBER_GOLEM_HIDE_SHADE, { c2: EMBER_GOLEM_HIDE, ...furMaterialConfig }), builder.ball(poseEnd.rx, 0.13, sumZ, itemsHeight, 0.15, poseEnd.front ? 0.4 : 0.36, 1))
    for (let clawRowIndex = 0; clawRowIndex < 4; clawRowIndex++) {
      const deltaHeight = (clawRowIndex - 1.5) * itemsHeight * 0.48
      ;(builder.paint(EMBER_GOLEM_ROCK, { c2: EMBER_GOLEM_ROCK_GLOW, gloss: 0.9, glow: 0, glow2: 0.55, mat: MATERIAL_KINDS.rock, line: 1 }),
        builder.g(composeMatrix(poseEnd.rx + deltaHeight, 0.12, sumZ + (poseEnd.front ? 0.32 : 0.28) - Math.abs(clawRowIndex - 1.5) * 0.04, 76, (clawRowIndex - 1.5) * 9 * legSideSign, 0), () => builder.crystal(poseEnd.front ? 0.055 : 0.045, poseEnd.front ? 0.3 : 0.22, 4, 0.75, 0.1)))
    }
    if (poseEnd.front) {
      builder.bone(poseEnd.lower)
      for (let platePairIndex = 0; platePairIndex < 2; platePairIndex++)
        (builder.paint(EMBER_GOLEM_ARMOR, { c2: EMBER_GOLEM_ARMOR_SHADE, ...glossConfig }),
          builder.g(composeMatrix(poseEnd.rx + legSideSign * 0.2, 0.66 - platePairIndex * 0.24, 0.5 + platePairIndex * 0.07, 6 + platePairIndex * 8, legSideSign * 78, legSideSign * -6), () =>
            builder.extrude(
              [
                [-0.24, -0.16],
                [0.24, -0.16],
                [0.28, 0.06],
                [0.08, 0.2],
                [-0.2, 0.16],
              ],
              0.1,
              0.035,
            ),
          ))
      ;(builder.paint(EMBER_GOLEM_LAVA, { c2: EMBER_GOLEM_LAVA_HOT, glow: 0.6, mat: MATERIAL_KINDS.crystal, pattern: TERRAIN_LOOK.lava, patternScale: 6, patternAmt: 0.7 }),
        builder.g(composeMatrix(poseEnd.rx + legSideSign * 0.265, 0.56, 0.54, 10, legSideSign * 78, 0), () => builder.box(0, 0, 0, 0.36, 0.035, 0.03)))
    }
  })
  const torsoChainProjector = makeBoneChainProjector(entries, [beastRig.pelvis, beastRig.chest], 1.2),
    entriesZ = [
      [0, 1.3, -1.78, 0.2, 0.24],
      [0, 1.32, -1.52, 0.6, 0.6],
      [0, 1.3, -1, 0.8, 0.72],
      [0, 1.26, -0.32, 0.84, 0.7],
      [0, 1.34, 0.36, 0.98, 0.78],
      [0, 1.42, 0.92, 0.72, 0.64],
      [0, 1.52, 1.26, 0.5, 0.48],
    ]
  ;(builder.bind(torsoChainProjector).paint(EMBER_GOLEM_HIDE, { c2: EMBER_GOLEM_HIDE_MID, by: furShadePaint, ...furMaterialConfig }), builder.tube(entriesZ, { seg: 12, up: [1, 0, 0] }), builder.paint(EMBER_GOLEM_HIDE_SHADE, { c2: EMBER_GOLEM_HIDE, ...furMaterialConfig }), builder.ball(0, 1.74, 0.18, 0.8, 0.44, 0.78, 2))
  const sum = (coordX, coordY, coordZ = 1.02) => {
      let computed = 0
      for (; computed < entriesZ.length - 2 && entriesZ[computed + 1][2] < coordX;) computed++
      const ratio = Math.min(1, Math.max(0, (coordX - entriesZ[computed][2]) / (entriesZ[computed + 1][2] - entriesZ[computed][2]))),
        lerped = lerpValue(entriesZ[computed][1], entriesZ[computed + 1][1], ratio),
        lerpedX = lerpValue(entriesZ[computed][3], entriesZ[computed + 1][3], ratio),
        lerpedY = lerpValue(entriesZ[computed][4], entriesZ[computed + 1][4], ratio)
      return [Math.cos(coordY) * lerpedX * coordZ, lerped + Math.sin(coordY) * lerpedY * coordZ, coordX]
    },
    ratio = (plaza, coordX, coordY, coordZ, spikeCount, spikeThickness, noiseSeed) => {
      const entries = []
      for (let index = 0; index <= spikeCount; index++) {
        const ratio = index / spikeCount,
          spikeNoiseJitter = index > 0 && index < spikeCount ? (emberGolemHashNoise(index, noiseSeed) - 0.5) * 0.22 : 0,
          hResult = sum(lerpValue(plaza, coordY, ratio) + spikeNoiseJitter, lerpValue(coordX, coordZ, ratio) + (index % 2 ? 0.07 : -0.05), 1.015)
        entries.push([hResult[0], hResult[1], hResult[2], spikeThickness * (1 - ratio * 0.6), spikeThickness * 0.5])
      }
      ;(builder.bind(torsoChainProjector).paint(EMBER_GOLEM_LAVA_HOT, { c2: EMBER_GOLEM_LAVA, glow: 0.75, glow2: 0.4, mat: MATERIAL_KINDS.crystal, pattern: TERRAIN_LOOK.lava, patternScale: 6, patternAmt: 0.7 }), builder.tube(entries, { seg: 4, up: [0, 0, 1] }))
    }
  for (const mirrorSide of [1, -1]) {
    const mirrorAngle = (mirrorInputAngle) => (mirrorSide > 0 ? mirrorInputAngle : Math.PI - mirrorInputAngle)
    ;(ratio(0.5, mirrorAngle(1), 0.95, mirrorAngle(0.35), 4, 0.05, 1), ratio(0, mirrorAngle(0.95), 0.1, mirrorAngle(0.1), 4, 0.055, 2), ratio(-0.4, mirrorAngle(1.2), -0.95, mirrorAngle(0.45), 4, 0.05, 3), ratio(-0.9, mirrorAngle(1.4), -1.4, mirrorAngle(0.9), 3, 0.04, 4))
  }
  const sumX = (lookupKey, coordX, coordY, coordZ, spikeLengthScale, spikeTipRadius) => {
    builder.tube(
      [
        [lookupKey[0], lookupKey[1], lookupKey[2], spikeTipRadius, spikeTipRadius * 0.5],
        [lookupKey[0] + coordX * spikeLengthScale * 0.5, lookupKey[1] + coordY * spikeLengthScale * 0.5 + 0.03, lookupKey[2] + coordZ * spikeLengthScale * 0.5, spikeTipRadius * 0.8, spikeTipRadius * 0.42],
        [lookupKey[0] + coordX * spikeLengthScale, lookupKey[1] + coordY * spikeLengthScale, lookupKey[2] + coordZ * spikeLengthScale, 0.012, 0.012],
      ],
      { seg: 4, up: [1, 0, 0], cap0: !1 },
    )
  }
  builder.bind(torsoChainProjector).paint(EMBER_GOLEM_HIDE_SHADE, { c2: EMBER_GOLEM_HIDE_DARK, ...furMaterialConfig })
  for (let index = 0; index < 6; index++) sumX(sum(-0.45 - index * 0.22, Math.PI / 2 + (index % 2 ? 0.12 : -0.12), 0.97), 0, 0.5, -0.86, 0.34 - index * 0.025, 0.13)
  for (const wingMirrorSide of [1, -1]) {
    const wingMirrorAngle = (mirrorInputAngle) => (wingMirrorSide > 0 ? mirrorInputAngle : Math.PI - mirrorInputAngle)
    ;(sumX(sum(-1.25, wingMirrorAngle(0.75), 0.97), wingMirrorSide * 0.5, 0.2, -0.84, 0.3, 0.12), sumX(sum(-1.5, wingMirrorAngle(0.3), 0.97), wingMirrorSide * 0.55, -0.1, -0.83, 0.28, 0.11))
  }
  ;(builder.bone(beastRig.tail[0]).paint(EMBER_GOLEM_HIDE_SHADE, { ...furMaterialConfig }), builder.ball(0, 1.4, -1.8, 0.16, 0.14, 0.14, 1), builder.bone(craterJoint))
  for (let spikeSegmentIndex = 0; spikeSegmentIndex < 6; spikeSegmentIndex++) {
    const spikeSegmentAngle = (spikeSegmentIndex / 6) * EMBER_GOLEM_FULL_CIRCLE + 0.26,
      computed = 0.5,
      scaledValueX = 0.62 + 0.2 * emberGolemHashNoise(spikeSegmentIndex, 11) + (spikeSegmentIndex === 1 || spikeSegmentIndex === 4 ? 0.14 : 0)
    ;(builder.paint(EMBER_GOLEM_ARMOR, { c2: EMBER_GOLEM_ARMOR_SHADE, ...glossConfig }),
      builder.g(composeMatrix(Math.sin(spikeSegmentAngle) * computed, 1.86, 0.1 + Math.cos(spikeSegmentAngle) * computed * 0.92, 0, (spikeSegmentAngle * 180) / Math.PI, 0), () =>
        builder.g(composeMatrix(0, 0, 0, 24, 0, (emberGolemHashNoise(spikeSegmentIndex, 12) - 0.5) * 14), () => {
          ;(builder.extrude(
            [
              [-0.3, 0],
              [0.3, 0],
              [0.34, scaledValueX * 0.5],
              [0.14, scaledValueX],
              [-0.06, scaledValueX * 0.9],
              [-0.32, scaledValueX * 0.55],
            ],
            0.16,
            0.05,
          ),
            builder.paint(EMBER_GOLEM_LAVA, { c2: EMBER_GOLEM_LAVA_HOT, glow: 0.55, mat: MATERIAL_KINDS.crystal }),
            builder.g(composeMatrix(0, scaledValueX * 0.34, -0.085), () => builder.box(0, 0, 0, 0.3, 0.05, 0.03)),
            builder.paint(EMBER_GOLEM_ARMOR, { c2: EMBER_GOLEM_ARMOR_SHADE, ...glossConfig }))
        }),
      ))
  }
  ;(builder.bone(coreJoint).paint(EMBER_GOLEM_LAVA_HOT, { c2: EMBER_GOLEM_LAVA, glow: 0.95, glow2: 0.7, mat: MATERIAL_KINDS.crystal, pattern: TERRAIN_LOOK.lava, patternScale: 5, patternAmt: 0.8 }),
    builder.lathe(
      [
        [2.04, 0.5, 0.48, 0, 0.1],
        [2.14, 0.4, 0.38, 0, 0.1],
        [2.2, 0.2, 0.2, 0, 0.1],
        [2.22, 0.02, 0.02, 0, 0.1],
      ],
      { seg: 8, cap0: !1 },
    ),
    entriesX.forEach((primaryTop, secondaryV9) => {
      builder.bone(primaryTop).paint(EMBER_GOLEM_LAVA, { c2: EMBER_GOLEM_LAVA_TIP, glow: 0.8, glow2: 0.95, mat: MATERIAL_KINDS.crystal })
      const scaledValueTop = (secondaryV9 / 3) * EMBER_GOLEM_FULL_CIRCLE + 0.5,
        angleValueZ = Math.sin(scaledValueTop) * 0.17,
        sumWidth = 0.1 + Math.cos(scaledValueTop) * 0.17,
        scaledValueBottom = 0.5 + 0.16 * (secondaryV9 % 2)
      builder.tube(
        [
          [angleValueZ, 2.14, sumWidth, 0.13, 0.13],
          [angleValueZ * 1.2, 2.14 + scaledValueBottom * 0.4, sumWidth + 0.03, 0.1, 0.1],
          [angleValueZ * 0.7, 2.14 + scaledValueBottom * 0.75, sumWidth - 0.04, 0.05, 0.05],
          [angleValueZ * 0.9, 2.14 + scaledValueBottom, sumWidth, 0.008, 0.008],
        ],
        { seg: 5, cap0: !1 },
      )
    }))
  const neckChainProjector = makeBoneChainProjector(entries, [beastRig.chest, beastRig.neck[0], beastRig.head], 0.9)
  ;(builder.bind(neckChainProjector).paint(EMBER_GOLEM_HIDE, { c2: EMBER_GOLEM_HIDE_MID, by: furShadePaint, ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.48, 1, 0.62, 0.58],
        [0, 1.58, 1.26, 0.5, 0.48],
        [0, 1.66, 1.5, 0.44, 0.42],
      ],
      { seg: 10, up: [1, 0, 0], cap0: !1 },
    ),
    builder.bone(beastRig.head).paint(EMBER_GOLEM_HIDE, { c2: EMBER_GOLEM_HIDE_DARK, by: (coordXEnd, coordYEnd, coordZEnd) => smoothStep01(1.75, 2.2, coordZEnd), ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.68, 1.36, 0.4, 0.38],
        [0, 1.74, 1.6, 0.45, 0.42],
        [0, 1.72, 1.82, 0.4, 0.34],
        [0, 1.64, 2.02, 0.26, 0.2],
        [0, 1.6, 2.2, 0.2, 0.15],
        [0, 1.58, 2.3, 0.13, 0.1],
      ],
      { seg: 10, up: [1, 0, 0] },
    ),
    builder.paint(EMBER_GOLEM_ROCK, { gloss: 0.6, mat: MATERIAL_KINDS.leather }),
    builder.ball(0, 1.62, 2.33, 0.1, 0.07, 0.06, 1),
    builder.paint(EMBER_GOLEM_ARMOR, { c2: EMBER_GOLEM_ARMOR_SHADE, ...glossConfig }),
    builder.g(composeMatrix(0, 2.1, 1.66, 74, 0, 0), () =>
      builder.extrude(
        [
          [0, -0.3],
          [0.2, -0.02],
          [0.13, 0.2],
          [-0.13, 0.2],
          [-0.2, -0.02],
        ],
        0.08,
        0.03,
      ),
    ),
    builder.sym(() => {
      ;(builder.paint(EMBER_GOLEM_HIDE_SHADE, { c2: EMBER_GOLEM_HIDE, ...furMaterialConfig }),
        builder.ball(0.36, 2.06, 1.5, 0.15, 0.15, 0.08, 1),
        builder.paint(EMBER_GOLEM_CRYSTAL_GLOW, { glow: 0.95, mat: MATERIAL_KINDS.crystal }),
        builder.g(composeMatrix(0.26, 1.88, 1.93, -10, 36, 22), () =>
          builder.extrude(
            [
              [-0.09, 0],
              [0, 0.035],
              [0.09, 0.02],
              [0.01, -0.03],
            ],
            0.05,
            0,
          ),
        ),
        builder.paint(EMBER_GOLEM_HIDE_SHADE, { ...furMaterialConfig }),
        builder.g(composeMatrix(0.27, 1.95, 1.9, -14, 34, 26), () => builder.box(0, 0, 0, 0.24, 0.05, 0.08, 0.02)),
        builder.paint(EMBER_GOLEM_HIDE, { c2: EMBER_GOLEM_HIDE_DARK, ...furMaterialConfig }),
        builder.tube(
          [
            [0.4, 1.64, 1.62, 0.1, 0.05],
            [0.52, 1.56, 1.5, 0.08, 0.04],
            [0.6, 1.46, 1.36, 0.012, 0.012],
          ],
          { seg: 4, up: [0, 0, 1], cap0: !1 },
        ),
        builder.paint(16050384, { gloss: 0.6, mat: MATERIAL_KINDS.leather }),
        builder.g(composeMatrix(0.12, 1.52, 2.2, 180, 0, 0), () => builder.crystal(0.035, 0.14, 4, 0.9, 0.05)))
    }),
    builder.bone(beastRig.jaw).paint(EMBER_GOLEM_HIDE_SHADE, { c2: EMBER_GOLEM_HIDE, ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.5, 1.56, 0.34, 0.14],
        [0, 1.46, 1.92, 0.24, 0.1],
        [0, 1.47, 2.22, 0.14, 0.07],
      ],
      { seg: 8, up: [1, 0, 0] },
    ),
    builder.paint(EMBER_GOLEM_LAVA, { c2: EMBER_GOLEM_LAVA_HOT, glow: 0.75, mat: MATERIAL_KINDS.crystal }),
    builder.tube(
      [
        [0, 1.535, 1.66, 0.24, 0.03],
        [0, 1.5, 2.12, 0.11, 0.03],
      ],
      { seg: 4, up: [1, 0, 0] },
    ),
    builder.paint(16050384, { gloss: 0.6, mat: MATERIAL_KINDS.leather }),
    builder.sym(() => builder.g(composeMatrix(0.1, 1.5, 2.14), () => builder.crystal(0.03, 0.12, 4, 0.9, 0.05))))
  const computedX = 10
  for (let maneSegmentIndex = 0; maneSegmentIndex < computedX; maneSegmentIndex++) {
    const lerped = lerpValue(-0.15, Math.PI + 0.15, maneSegmentIndex / (computedX - 1)),
      angleValue = Math.cos(lerped),
      angleValueX = Math.sin(lerped),
      samples = [angleValue * 0.56, 1.5 + angleValueX * 0.52, 1.08],
      scaledValueY = 0.62 + 0.3 * angleValueX + 0.14 * emberGolemHashNoise(maneSegmentIndex, 21),
      samplesX = [angleValue * (0.56 + scaledValueY * 0.62), 1.5 + angleValueX * (0.52 + scaledValueY * 0.7) + 0.1, 1.08 - scaledValueY * 0.62],
      total = [lerpValue(samples[0], samplesX[0], 0.5) + angleValue * 0.1, lerpValue(samples[1], samplesX[1], 0.5) + 0.1, lerpValue(samples[2], samplesX[2], 0.5) + 0.06]
    ;(builder.bone(entriesY[maneSegmentIndex % 4]).paint(EMBER_GOLEM_FUR, { c2: EMBER_GOLEM_LAVA_TIP, glow: 0.14, glow2: 0.42, mat: MATERIAL_KINDS.fur, line: 1 }),
      builder.tube(
        [
          [samples[0], samples[1], samples[2], 0.2, 0.09],
          [total[0], total[1], total[2], 0.16, 0.07],
          [samplesX[0], samplesX[1], samplesX[2], 0.012, 0.012],
        ],
        { seg: 5, up: [-angleValueX, angleValue, 0], cap0: !1 },
      ))
  }
  builder.bakeGrounding(2.6, 0.72, 0.9)
  const computedY = 3.6,
    sumY = (coordX, animState, effectStyle) => {
      const sum = animState.time + animState.seed * 7,
        angleValue = Math.sin(sum * 1.9),
        computed = (animState.mode & 2) !== 0
      let computedX = 0,
        total = 1 + 0.18 * angleValue,
        ikActiveFlag = !0
      switch (
        (coordX.pos(beastRig.pelvis, 0, angleValue * 0.02 - 0.03, 0), coordX.rot(beastRig.chest, angleValue * 1.2, 0, 0), coordX.rot(beastRig.neck[0], 10 - angleValue * 1.5, 0, 0), coordX.rot(beastRig.head, 6, 0, 0), coordX.rot(beastRig.tail[0], 0, Math.sin(sum * 3) * 10, 0), animState.anim)
      ) {
        case "dead": {
          const timeResult = animState.t,
            deathRecoilAmount = easeOutQuad(inverseLerpClamped(timeResult, 0, 0.35)) * (1 - squareValue(inverseLerpClamped(timeResult, 0.55, 0.95))),
            collapseAmount = squareValue(inverseLerpClamped(timeResult, 0.6, 1.25)),
            falloffValue = smoothFalloff(inverseLerpClamped(timeResult, 1.25, 1.6), 0.3, 0.3)
          ;((computedX = Math.max(deathRecoilAmount, 0.4 * collapseAmount)),
            coordX.move(beastRig.pelvis, 0, -0.62 * collapseAmount + 0.05 * falloffValue, 0.5 * collapseAmount),
            coordX.add(beastRig.pelvis, 4 * collapseAmount, 0, 5 * collapseAmount),
            applyBeastRecoil(beastRig, coordX, deathRecoilAmount, 50, 0.35),
            coordX.add(beastRig.chest, 6 * collapseAmount, 0, 0),
            coordX.add(beastRig.neck[0], 34 * deathRecoilAmount + 16 * collapseAmount, 0, 0),
            coordX.add(beastRig.head, -30 * deathRecoilAmount + 6 * collapseAmount, 0, 12 * collapseAmount))
          for (let index = 0; index < 2; index++) {
            const pose = beastRig.legs[index]
            poseQuadrupedLegIk(beastRig, coordX, index, pose.rx + pose.side * 0.25 * (deathRecoilAmount + collapseAmount), pose.ry + 2.6 * deathRecoilAmount, pose.rz - 0.5 * deathRecoilAmount + 0.75 * collapseAmount, 40 * deathRecoilAmount - 20 * collapseAmount)
          }
          for (let legIndex = 2; legIndex < 4; legIndex++) {
            const poseX = beastRig.legs[legIndex]
            poseQuadrupedLegIk(beastRig, coordX, legIndex, poseX.rx + poseX.side * 0.2 * collapseAmount, poseX.ry, poseX.rz - 0.5 * collapseAmount, 50 * collapseAmount)
          }
          ikActiveFlag = !1
          const deathFade = inverseLerpClamped(timeResult, 0.5, 1.1)
          ;((total = (1 + 1.2 * smoothFalloff(timeResult, 0.3, 0.3)) * (1 - deathFade)),
            coordX.scale(collapseAmount, 1 - 0.5 * deathFade),
            entriesX.forEach((hornJoint) => coordX.scale(hornJoint, Math.max(0, (1 + 1.5 * smoothFalloff(timeResult, 0.3, 0.28)) * (1 - inverseLerpClamped(timeResult, 0.45, 0.8))))),
            entriesY.forEach((maneJoint) => coordX.scale(maneJoint, 1 - 0.75 * inverseLerpClamped(timeResult, 0.6, 1.3))),
            coordX.add(ikActiveFlag, 0, 0, 4 * falloffValue),
            (effectStyle.tint = 0.55 * inverseLerpClamped(timeResult, 0.7, 1.5)),
            (effectStyle.tintColor = 7827578))
          break
        }
        case "move": {
          const scaledValueX = animState.stride * EMBER_GOLEM_FULL_CIRCLE
          ;(coordX.add(beastRig.neck[0], 6 + Math.sin(scaledValueX + 1.4) * 8, 0, 0),
            coordX.add(beastRig.head, -Math.sin(scaledValueX + 1) * 7, 0, 0),
            animateBeastGait(beastRig, coordX, animState.stride, { style: "bound", stride: computedY, lift: 0.5, bob: 0.13, pitch: 7, curl: 36 }),
            (ikActiveFlag = !1),
            (total += 0.2))
          break
        }
        case "attack": {
          const windupEase = windupEaseCurve(animState.p, animState.windup),
            attackLungeEase = easeOutQuad(inverseLerpClamped(windupEase, 0, 0.27)),
            releasePhase = inverseLerpClamped(windupEase, 0.27, 0.36),
            attackRecoveryEase = hermiteSmoothStep(inverseLerpClamped(windupEase, 0.5, 1))
          if (animState.mode & 1) {
            const scaledValueY = attackLungeEase * (1 - releasePhase),
              scaledValueZ = releasePhase * (1 - attackRecoveryEase)
            ;(coordX.move(beastRig.pelvis, 0, -0.14 * scaledValueZ, 0.3 * scaledValueZ), coordX.add(beastRig.pelvis, 8 * scaledValueZ, 0, 0), applyBeastRecoil(beastRig, coordX, scaledValueY, 56, 0.4), coordX.add(beastRig.neck[0], 36 * scaledValueY + 10 * scaledValueZ, 0, 0), coordX.add(beastRig.head, -10 * scaledValueY, 0, 0), (computedX = scaledValueY + 0.5 * scaledValueZ))
            for (let supportLegIndex = 0; supportLegIndex < 2; supportLegIndex++) {
              const poseY = beastRig.legs[supportLegIndex]
              poseQuadrupedLegIk(beastRig, coordX, supportLegIndex, poseY.rx + poseY.side * 0.2 * scaledValueY, poseY.ry + 3.2 * scaledValueY, poseY.rz - 0.55 * scaledValueY + 0.3 * scaledValueZ, 30 * scaledValueY)
            }
            ;(poseAllLegsIk(beastRig, coordX, 0, 0, 12), (ikActiveFlag = !1), (total += 0.4 * scaledValueY + 1.1 * smoothFalloff(windupEase, 0.37, 0.16)), entriesX.forEach((hornJoint) => coordX.scale(hornJoint, 1 + 1.6 * smoothFalloff(windupEase, 0.4, 0.2))))
          } else {
            const items = animState.variant % 2 === 0 ? -1 : 1,
              itemsX = items > 0 ? 0 : 1,
              scaledValueWidth = attackLungeEase * (1 - releasePhase),
              scaledValueHeight = releasePhase * (1 - attackRecoveryEase)
            ;(coordX.move(beastRig.pelvis, 0, 0.06 * scaledValueWidth - 0.08 * scaledValueHeight, -0.16 * scaledValueWidth + 0.4 * scaledValueHeight),
              coordX.add(beastRig.pelvis, -5 * scaledValueWidth + 6 * scaledValueHeight, 0, 0),
              coordX.add(beastRig.chest, 0, items * (16 * scaledValueWidth - 24 * scaledValueHeight), items * (-6 * scaledValueWidth + 8 * scaledValueHeight)),
              coordX.add(beastRig.neck[0], -8 * scaledValueWidth + 10 * scaledValueHeight, items * (-10 * scaledValueWidth + 16 * scaledValueHeight), 0),
              (computedX = 0.5 * scaledValueWidth + 0.8 * scaledValueHeight))
            const poseZ = beastRig.legs[itemsX]
            ;(poseAllLegsIk(beastRig, coordX, 0, 0, 15 & ~(1 << itemsX)),
              poseQuadrupedLegIk(beastRig, coordX, itemsX, poseZ.rx + items * (0.35 * scaledValueWidth - 0.75 * scaledValueHeight), poseZ.ry + 1 * scaledValueWidth + 0.5 * scaledValueHeight * (1 - scaledValueHeight), poseZ.rz - 0.25 * scaledValueWidth + 0.95 * scaledValueHeight, 30 * scaledValueWidth - 20 * scaledValueHeight),
              (ikActiveFlag = !1),
              (total += 0.2 * scaledValueWidth + 0.6 * smoothFalloff(windupEase, 0.36, 0.14)))
          }
          break
        }
        case "stunned": {
          ;(coordX.add(beastRig.neck[0], 22, Math.sin(sum * 5) * 14, 0), coordX.add(beastRig.head, 10, 0, Math.sin(sum * 5 + 1) * 16), coordX.add(beastRig.pelvis, 0, 0, Math.sin(sum * 2.5) * 3), (total *= 0.6))
          break
        }
        case "airborne": {
          ;(coordX.rot(beastRig.root, -14 * Math.sin(animState.p * Math.PI), 0, 8), beastRig.legs.forEach((poseNear, secondaryV10) => poseQuadrupedLegIk(beastRig, coordX, secondaryV10, poseNear.rx + poseNear.side * 0.2, poseNear.ry + 0.3, poseNear.rz + (poseNear.front ? 0.3 : -0.3), 30)), (ikActiveFlag = !1))
          break
        }
        default:
          if (animState.spawnT >= 0) {
            const ratio = animState.spawnT / 1.2,
              landRiseEase = easeOutQuad(inverseLerpClamped(ratio, 0, 0.5)),
              landShakeAmount = smoothFalloff(ratio, 0.55, 0.16),
              landHeadSnap = smoothFalloff(ratio, 0.82, 0.18)
            ;(coordX.pos(beastRig.root, Math.sin(ratio * 70) * 0.05 * landShakeAmount, -2.3 * (1 - landRiseEase), 0),
              coordX.add(beastRig.pelvis, -10 * (1 - landRiseEase), 0, Math.sin(ratio * 60) * 5 * landShakeAmount),
              coordX.add(beastRig.neck[0], -26 * landHeadSnap, 0, 0),
              coordX.add(beastRig.head, -24 * landHeadSnap, 0, 0),
              (computedX = landHeadSnap),
              (total = 0.4 + 0.6 * landRiseEase + 0.8 * landHeadSnap),
              entriesX.forEach((hornJoint) => coordX.scale(hornJoint, landRiseEase * (1 + 1.2 * landHeadSnap))))
          } else if (computed) {
            const scaledValueDepth = (sum * 0.3) % 1,
              deathCollapseEase = smoothFalloff(scaledValueDepth, 0.5, 0.12)
            ;(coordX.move(beastRig.pelvis, 0, -0.08, -0.06),
              coordX.add(beastRig.pelvis, 4, 0, 0),
              coordX.add(beastRig.neck[0], 8 - 30 * deathCollapseEase, Math.sin(sum * 9) * 1.5, 0),
              coordX.add(beastRig.head, -18 * deathCollapseEase, 0, 0),
              (computedX = 0.25 + 0.75 * deathCollapseEase),
              (total += 0.2 + 0.4 * deathCollapseEase))
          } else {
            const ratioX = (sum / 6.5) % 1,
              ratioY = Math.floor(sum / 6.5) % 2,
              scaledValueStart = hermiteSmoothStep(inverseLerpClamped(ratioX, 0.6, 0.68)) * (1 - hermiteSmoothStep(inverseLerpClamped(ratioX, 0.88, 0.97)))
            if ((coordX.add(beastRig.neck[0], 0, Math.sin(sum * 0.33) * 9 * (1 - scaledValueStart), 0), coordX.add(beastRig.head, Math.sin(sum * 0.8) * 2, Math.sin(sum * 0.33 + 0.6) * 10 * (1 - scaledValueStart), 0), ratioY === 0))
              (coordX.add(beastRig.neck[0], -18 * scaledValueStart, 0, 0), coordX.add(beastRig.head, -14 * scaledValueStart, 0, 8 * scaledValueStart), (computedX = scaledValueStart), (total += 0.3 * scaledValueStart))
            else if (scaledValueStart > 0) {
              const scaledValueEnd = scaledValueStart * Math.max(0, Math.sin(ratioX * EMBER_GOLEM_FULL_CIRCLE * 8)),
                poseWidth = beastRig.legs[0]
              ;(poseAllLegsIk(beastRig, coordX, 0, 0, 14), poseQuadrupedLegIk(beastRig, coordX, 0, poseWidth.rx, poseWidth.ry + 0.22 * scaledValueEnd, poseWidth.rz + 0.3 - 0.4 * scaledValueEnd, 20 * scaledValueEnd), (ikActiveFlag = !1), coordX.add(beastRig.neck[0], 14 * scaledValueStart, 10 * scaledValueStart, 0))
            }
          }
      }
      const hitPulse = hitImpactPulse(animState.hitT)
      if (hitPulse > 0 && animState.anim !== "dead") {
        const itemsY = animState.seed > 0.5 ? 1 : -1
        ;(coordX.add(beastRig.neck[0], 10 * hitPulse, itemsY * 16 * hitPulse, 0), coordX.add(beastRig.head, 8 * hitPulse, 0, itemsY * 14 * hitPulse), coordX.move(beastRig.pelvis, 0, -0.06 * hitPulse, -0.08 * hitPulse), (total += 0.6 * hitPulse))
      }
      ;(coordX.rot(beastRig.jaw, 4 + 30 * computedX, 0, 0),
        entriesX.forEach((primaryBottom, secondaryV11) => {
          const sumHeight = 0.85 + 0.3 * Math.sin(sum * 9 + secondaryV11 * 2.1) + 0.15 * Math.sin(sum * 17 + secondaryV11)
          ;(coordX.scale(primaryBottom, coordX.s[primaryBottom] * sumHeight), coordX.rot(primaryBottom, Math.sin(sum * 6 + secondaryV11 * 1.7) * 10, sum * 40 * (secondaryV11 % 2 ? 1 : -1), Math.cos(sum * 5 + secondaryV11) * 10))
        }),
        entriesY.forEach((primaryInner, secondaryV12) => {
          ;(coordX.scale(primaryInner, coordX.s[primaryInner] * (1 + 0.06 * Math.sin(sum * 7 + secondaryV12 * 1.6))), coordX.rot(primaryInner, Math.sin(sum * 4.3 + secondaryV12 * 1.9) * 4 - (animState.anim === "move" ? 8 : 0), 0, Math.sin(sum * 5.1 + secondaryV12 * 2.3) * 3))
        }),
        coordX.scale(coreJoint, coordX.s[coreJoint] * (1 + 0.06 * angleValue)),
        (effectStyle.glow = Math.max(0.03, total)),
        ikActiveFlag && poseAllLegsIk(beastRig, coordX))
    }
  return {
    key: "monster:ember_golem",
    geometry: builder.build(),
    rig: entries,
    height: 2.95,
    radius: 1.6,
    scale: 1,
    stride: computedY,
    triangles: builder.triangleCount,
    deathDur: 2.2,
    spawnDur: 1.2,
    outline: 1.6,
    attach: {
      chest: { joint: beastRig.chest, x: 0, y: 0, z: 0.2 },
      head: { joint: beastRig.head, x: 0, y: 0.2, z: 0.3 },
      muzzle: { joint: beastRig.head, x: 0, y: -0.12, z: 0.8 },
      weapon: { joint: beastRig.legs[1].foot, x: 0, y: 0, z: 0.3 },
      handL: { joint: beastRig.legs[0].foot, x: 0, y: 0, z: 0.3 },
      handR: { joint: beastRig.legs[1].foot, x: 0, y: 0, z: 0.3 },
      crest: { joint: craterJoint, x: 0, y: 0.3, z: 0 },
      vent: { joint: craterJoint, x: 0, y: 0.55, z: 0 },
      tail: { joint: beastRig.tail[0], x: 0, y: 0, z: -0.2 },
    },
    blend: (primaryX, secondaryX) => (secondaryX === "attack" ? 0.1 : 0.2),
    animate: sumY,
  }
}

const COLOSSUS_FULL_CIRCLE = Math.PI * 2,
  COLOSSUS_DEG_TO_RAD = Math.PI / 180,
  COLOSSUS_ARMOR = 4475512,
  COLOSSUS_ARMOR_TRIM = 7897272,
  COLOSSUS_ARMOR_DARK = 2566988,
  COLOSSUS_ARMOR_SHADE = 9071178,
  COLOSSUS_CRYSTAL = 16764768,
  COLOSSUS_CRYSTAL_HOT = 16773304,
  COLOSSUS_CORE_GLOW = 16774348,
  COLOSSUS_CORE_CRYSTAL = 16756800,
  COLOSSUS_CRYSTAL_GLOW = 16776160,
  colossusHashNoise = (primary, secondary) => {
    const angleValue = Math.sin(primary * 127.1 + secondary * 311.7) * 43758.5453
    return angleValue - Math.floor(angleValue)
  }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildStarColossusModel() {
  const nodeTree = new NodeTree(),
    delta = nodeTree.add("root", -1, 0, 0, 0),
    computed = 4,
    torsoJoint = nodeTree.add("torso", delta, 0, computed, 0),
    coreJoint = nodeTree.add("core", torsoJoint, 0, computed, 0.1),
    entries = [0, 1, 2].map((ringIndex) => nodeTree.add(`ring${ringIndex}`, torsoJoint, 0, computed, 0.1)),
    headJoint = nodeTree.add("head", torsoJoint, 0, 5.5, 0.3),
    haloJoint = nodeTree.add("halo", torsoJoint, 0, 5.35, -1),
    entriesX = [1, -1].map((shoulderSide) => nodeTree.add(`shoulder${shoulderSide}`, torsoJoint, shoulderSide * 2.05, 5.05, 0)),
    entriesY = [0, 1, 2, 3].map((plateIndex) => nodeTree.add(`plate${plateIndex}`, torsoJoint, (plateIndex % 2 ? -1 : 1) * 0.9, computed, plateIndex < 2 ? 0.75 : -0.75)),
    entriesZ = [1, -1].map((fistSide) => nodeTree.add(`fist${fistSide}`, delta, fistSide * 2.95, 2.9, 0.9)),
    entriesWidth = [2.85, 2.4, 1.98, 1.6, 1.24, 0.9],
    entriesHeight = [1.1, 0.9, 0.72, 0.56, 0.42, 0.28],
    entriesDepth = entriesWidth.map((primaryOuter, secondaryV13) => nodeTree.add(`waist${secondaryV13}`, delta, Math.cos(secondaryV13 * 2.4) * (0.34 - secondaryV13 * 0.05), primaryOuter, Math.sin(secondaryV13 * 2.4) * (0.34 - secondaryV13 * 0.05))),
    builder = new ModelBuilder()
  builder.crease = 32
  const armorMaterialConfig = { gloss: 0.55, mat: MATERIAL_KINDS.metal, pattern: TERRAIN_LOOK.meteor, patternScale: 3, patternAmt: 0.5, grain: 0.06 },
    crystalMaterialConfig = { gloss: 1, mat: MATERIAL_KINDS.metal },
    addArmorBox = (coordX, coordY, coordZ, boxRotX, boxRotY, boxRotZ, boxWidth, boxDepth) => {
      ;(builder.paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.55, mat: MATERIAL_KINDS.crystal, line: 0 }), builder.g(composeMatrix(coordX, coordY, coordZ, boxRotX, boxRotY, boxRotZ), () => builder.box(0, 0, 0, boxWidth, boxDepth, 0.07)))
    },
    emitHaloRing = (primary, secondary = 0.06) => {
      const entries = []
      for (let haloIndex = 0; haloIndex < 16; haloIndex++) {
        const haloPointAngle = (haloIndex / 16) * COLOSSUS_FULL_CIRCLE,
          scaledValueX = haloIndex % 2 === 0 ? primary * (haloIndex % 4 === 0 ? 1 : 0.72) : primary * 0.34
        entries.push([Math.cos(haloPointAngle) * scaledValueX, Math.sin(haloPointAngle) * scaledValueX])
      }
      builder.extrude(entries, secondary, 0)
    }
  ;(entriesDepth.forEach((primaryV2, secondaryV14) => {
    const elementX = entriesHeight[secondaryV14],
      bxResult = nodeTree.bx(primaryV2),
      bzResult = nodeTree.bz(primaryV2)
    ;((builder.rough = 0.04),
      builder.bone(primaryV2).paint(secondaryV14 % 2 ? COLOSSUS_ARMOR : COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }),
      builder.g(composeMatrix(bxResult, entriesWidth[secondaryV14], bzResult, colossusHashNoise(secondaryV14, 1) * 20 - 10, secondaryV14 * 57, colossusHashNoise(secondaryV14, 2) * 20 - 10), () =>
        builder.lathe(
          [
            [-elementX * 0.62, elementX * 0.18],
            [-elementX * 0.3, elementX * 0.78],
            [elementX * 0.08, elementX],
            [elementX * 0.36, elementX * 0.8],
            [elementX * 0.52, elementX * 0.3],
          ],
          { seg: 6, phase: 15 },
        ),
      ),
      (builder.rough = 0),
      builder.paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.5, mat: MATERIAL_KINDS.crystal, line: 0 }),
      builder.g(composeMatrix(bxResult, entriesWidth[secondaryV14] + elementX * 0.1, bzResult, 0, secondaryV14 * 57, 0), () => builder.torus(elementX * 1, 0.035, 0.05, 6, 4, { crease: 30, phase: 0 })))
  }),
    builder.bone(entriesDepth[5]).paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.3, glow2: 0.7, ...crystalMaterialConfig, mat: MATERIAL_KINDS.crystal, line: 1 }),
    builder.g(composeMatrix(nodeTree.bx(entriesDepth[5]), 0.92, nodeTree.bz(entriesDepth[5]), 180, 0, 0), () => builder.crystal(0.12, 0.46, 4, 0.2, 0.75)),
    [
      [18, 78],
      [102, 162],
      [-78, -18],
      [-162, -102],
    ].forEach(([coordXY, coordYZ], coordZZ) => {
      const lerpedDepth = (normalizedOffset) => lerpValue(0.86, 1.62, Math.pow((normalizedOffset - 2.95) / 2, 1.2)),
        sumDepth = 2.95 + (coordZZ < 2 ? 0.25 : 0),
        computedX = 4.95,
        scaledValueInner = (assists, primary, secondary) => {
          const delta = lerpedDepth(primary) - (secondary ? 0.34 : 0)
          return [Math.cos(assists * COLOSSUS_DEG_TO_RAD) * delta, primary, Math.sin(assists * COLOSSUS_DEG_TO_RAD) * delta * 0.86 + 0.05]
        }
      ;((builder.rough = 0.03),
        builder.bone(entriesY[coordZZ]).paint(COLOSSUS_ARMOR, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }),
        builder.sheet(4, 4, (primaryV3, secondaryV15) => scaledValueInner(lerpValue(coordYZ, coordXY, primaryV3), lerpValue(sumDepth, computedX, secondaryV15), !1), !1, 30),
        builder.paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR_SHADE, ...armorMaterialConfig }),
        builder.sheet(3, 3, (primaryV4, secondaryV16) => scaledValueInner(lerpValue(coordXY, coordYZ, primaryV4), lerpValue(sumDepth, computedX, secondaryV16), !0), !1, 30),
        builder.paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR, ...armorMaterialConfig }),
        builder.sheet(1, 4, (primaryV5, secondaryV17) => scaledValueInner(coordXY, lerpValue(sumDepth, computedX, secondaryV17), primaryV5 > 0.5), !0, 30),
        builder.sheet(1, 4, (primaryV6, secondaryV18) => scaledValueInner(coordYZ, lerpValue(sumDepth, computedX, secondaryV18), primaryV6 < 0.5), !0, 30),
        builder.sheet(4, 1, (primaryV7, secondaryV19) => scaledValueInner(lerpValue(coordXY, coordYZ, primaryV7), computedX, secondaryV19 < 0.5), !0, 30),
        builder.sheet(4, 1, (primaryV8, secondaryV20) => scaledValueInner(lerpValue(coordXY, coordYZ, primaryV8), sumDepth, secondaryV20 > 0.5), !0, 30),
        (builder.rough = 0))
      const sumStart = (coordXY + coordYZ) / 2,
        rResult = scaledValueInner(sumStart, 4, !1)
      ;(addArmorBox(rResult[0] * 1.03, 4, rResult[2] * 1.03, 0, 90 - sumStart, 0, 0.09, 1.1),
        builder.paint(COLOSSUS_CRYSTAL, { ...crystalMaterialConfig }),
        builder.sheet(
          4,
          1,
          (primaryV9, secondaryV21) => {
            const rRResult = scaledValueInner(lerpValue(coordYZ, coordXY, primaryV9), lerpValue(4.72, 4.9, secondaryV21), !1)
            return [rRResult[0] * 1.035, rRResult[1], rRResult[2] * 1.035]
          },
          !1,
          30,
        ))
    }),
    builder.bone(coreJoint).paint(COLOSSUS_CORE_CRYSTAL, { c2: COLOSSUS_CORE_GLOW, glow: 0.35, glow2: 0.6, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
    builder.ball(0, computed, 0.1, 0.56, 0.62, 0.56, 0, 0),
    builder.paint(COLOSSUS_CRYSTAL_HOT, { glow: 0.7, mat: MATERIAL_KINDS.crystal, line: 0 }))
  for (let index = 0; index < 6; index++) builder.g(composeMatrix(0, computed, 0.1, index === 5 ? 180 : 0, index * 90, index < 4 ? 90 : 0), () => builder.g(composeMatrix(0, 0.4, 0), () => builder.crystal(0.12, 0.5, 4, 0.8, 0.1)))
  const entriesStart = [1.5, 1.7, 1.9]
  ;(entries.forEach((primaryV10, secondaryV22) => {
    const selected_ = entriesStart[secondaryV22]
    ;(builder.bone(primaryV10).paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.14, ...crystalMaterialConfig, line: 1 }),
      builder.g(composeMatrix(0, computed, 0.1), () => {
        builder.torus(selected_, 0.075, 0.11, 32, 4, { crease: 30, phase: 45 })
        for (let haloSegmentIndex = 0; haloSegmentIndex < 16; haloSegmentIndex++) {
          const scaledValueOuter = (haloSegmentIndex / 16) * COLOSSUS_FULL_CIRCLE,
            computedY = haloSegmentIndex % 4 === 0
          ;(builder.paint(computedY ? COLOSSUS_CRYSTAL_HOT : COLOSSUS_CRYSTAL, { glow: computedY ? 0.7 : 0.14, ...crystalMaterialConfig, mat: computedY ? MATERIAL_KINDS.crystal : MATERIAL_KINDS.metal, line: 0 }),
            builder.g(composeMatrix(Math.cos(scaledValueOuter) * (selected_ - 0.1), 0, Math.sin(scaledValueOuter) * (selected_ - 0.1), 0, -(scaledValueOuter * 180) / Math.PI, 0), () => builder.box(0, 0, 0, computedY ? 0.3 : 0.14, computedY ? 0.16 : 0.2, computedY ? 0.16 : 0.06)))
        }
      }))
  }),
    entriesX.forEach((primaryV11, secondaryV23) => {
      const itemsDepth = secondaryV23 === 0 ? 1 : -1
      ;((builder.rough = 0.045),
        builder.bone(primaryV11).paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }),
        builder.g(composeMatrix(itemsDepth * 2.05, 5.05, 0, 0, 0, itemsDepth * -9), () => {
          ;(builder.lathe(
            [
              [-0.62, 0.3, 0.34],
              [-0.3, 0.74, 0.7],
              [0.2, 0.98, 0.9],
              [0.42, 0.92, 0.84],
              [0.52, 0.5, 0.5],
            ],
            { seg: 6, phase: 30, power: 2.6 },
          ),
            (builder.rough = 0),
            builder.paint(COLOSSUS_CRYSTAL, { ...crystalMaterialConfig }),
            builder.lathe(
              [
                [0.18, 1, 0.92],
                [0.3, 1, 0.92],
                [0.31, 0.95, 0.87],
              ],
              { seg: 6, phase: 30, power: 2.6, cap0: !1, cap1: !1 },
            ),
            builder.paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.2, glow2: 0.6, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
            builder.g(composeMatrix(itemsDepth * 0.1, 0.42, 0, 0, 0, itemsDepth * -8), () => builder.crystal(0.2, 1, 5, 0.55, 0.1)),
            builder.g(composeMatrix(itemsDepth * 0.5, 0.36, 0.14, 12, 0, itemsDepth * -30), () => builder.crystal(0.14, 0.66, 5, 0.55, 0.1)),
            builder.g(composeMatrix(itemsDepth * 0.42, 0.36, -0.2, -16, 0, itemsDepth * -24), () => builder.crystal(0.13, 0.58, 5, 0.55, 0.1)))
        }),
        addArmorBox(itemsDepth * 2, 5, 0.86, 0, 0, 0, 0.7, 0.08),
        addArmorBox(itemsDepth * 2, 4.8, 0.78, 0, 0, 0, 0.36, 0.06))
    }),
    (builder.rough = 0.04),
    builder.bone(torsoJoint).paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR, ...armorMaterialConfig }),
    builder.g(composeMatrix(0, 5.02, -0.3), () =>
      builder.lathe(
        [
          [-0.34, 0.5, 0.36],
          [0, 1.3, 0.5],
          [0.3, 1.26, 0.46],
          [0.42, 0.6, 0.3],
        ],
        { seg: 6, power: 2.6 },
      ),
    ),
    (builder.rough = 0),
    builder.bone(headJoint),
    (builder.rough = 0.02),
    builder.paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR, ...armorMaterialConfig }),
    builder.lathe(
      [
        [5.3, 0.24, 0.26, 0, 0.16],
        [5.6, 0.44, 0.4, 0, 0.14],
        [6.1, 0.48, 0.42, 0, 0.1],
        [6.32, 0.3, 0.3, 0, 0.06],
      ],
      { seg: 6, phase: 90 },
    ),
    (builder.rough = 0),
    builder.paint(COLOSSUS_ARMOR, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }),
    builder.g(composeMatrix(0, 5.86, 0.5, -6, 0, 0), () =>
      builder.extrude(
        [
          [0, -0.66],
          [0.34, -0.36],
          [0.48, 0.2],
          [0.34, 0.52],
          [0, 0.62],
          [-0.34, 0.52],
          [-0.48, 0.2],
          [-0.34, -0.36],
        ],
        0.16,
        0.05,
      ),
    ),
    builder.paint(COLOSSUS_CRYSTAL, { ...crystalMaterialConfig }),
    builder.g(composeMatrix(0, 5.86, 0.56, -6, 0, 0), () =>
      builder.extrude(
        [
          [0, -0.7],
          [0.06, -0.6],
          [0.06, -0.46],
          [0, -0.42],
          [-0.06, -0.46],
          [-0.06, -0.6],
        ],
        0.08,
        0.01,
      ),
    ),
    builder.paint(COLOSSUS_CRYSTAL_GLOW, { glow: 0.95, mat: MATERIAL_KINDS.crystal, line: 0 }),
    builder.sym(() => builder.g(composeMatrix(0.2, 5.82, 0.59, -6, 0, 12), () => builder.box(0, 0, 0, 0.24, 0.06, 0.06, 0.015))),
    builder.g(composeMatrix(0, 6.12, 0.585, -6, 0, 0), () =>
      builder.extrude(
        [
          [0, 0.3],
          [0.035, 0.05],
          [0.13, 0],
          [0.035, -0.05],
          [0, -0.26],
          [-0.035, -0.05],
          [-0.13, 0],
          [-0.035, 0.05],
        ],
        0.06,
        0,
      ),
    ))
  for (let haloRowIndex = 0; haloRowIndex < 5; haloRowIndex++) {
    const scaledValueX = Math.PI * (0.2 + 0.15 * haloRowIndex)
    ;(builder.paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.18, glow2: 0.6, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
      builder.g(composeMatrix(Math.cos(scaledValueX) * 0.5, 6.06 + Math.sin(scaledValueX) * 0.24, 0, -18, 0, 90 - (scaledValueX * 180) / Math.PI), () => builder.crystal(0.1, 0.56 + (haloRowIndex === 2 ? 0.4 : 0.14 * (haloRowIndex % 2)), 4, 0.8, 0.08)))
  }
  ;(builder.bone(haloJoint).paint(COLOSSUS_CRYSTAL, { c2: COLOSSUS_CRYSTAL_HOT, glow: 0.3, ...crystalMaterialConfig, line: 1 }),
    builder.g(composeMatrix(0, 5.35, -1, 90, 0, 0), () => {
      ;(builder.torus(1.5, 0.09, 0.05, 32, 4, { crease: 30 }), builder.torus(1.16, 0.04, 0.03, 24, 4, { crease: 30 }))
      for (let crystalIndex = 0; crystalIndex < 8; crystalIndex++) {
        const scaledValueV2 = (crystalIndex / 8) * COLOSSUS_FULL_CIRCLE
        ;(builder.paint(COLOSSUS_CRYSTAL_HOT, { c2: COLOSSUS_CRYSTAL, glow: 0.7, glow2: 0.3, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
          builder.g(composeMatrix(Math.cos(scaledValueV2) * 1.5, 0, Math.sin(scaledValueV2) * 1.5, 0, -(scaledValueV2 * 180) / Math.PI, 0), () => builder.g(composeMatrix(0.06, 0, 0, 0, 0, -90), () => builder.crystal(0.1, crystalIndex % 2 ? 0.44 : 0.74, 4, 0.82, 0.12))),
          builder.paint(COLOSSUS_CRYSTAL, { glow: 0.2, ...crystalMaterialConfig, line: 0 }),
          builder.g(composeMatrix(Math.cos(scaledValueV2) * 1.33, 0, Math.sin(scaledValueV2) * 1.33, 0, -(scaledValueV2 * 180) / Math.PI, 0), () => builder.box(0, 0, 0, 0.34, 0.035, 0.05)))
      }
    }),
    entriesZ.forEach((primaryV12, secondaryV24) => {
      const itemsStart = secondaryV24 === 0 ? 1 : -1
      ;(builder.bone(primaryV12),
        builder.g(composeMatrix(itemsStart * 2.95, 2.9, 0.9), () => {
          ;((builder.rough = 0.045),
            builder.paint(COLOSSUS_ARMOR, { c2: COLOSSUS_ARMOR_DARK, ...armorMaterialConfig }),
            builder.lathe(
              [
                [0.5, 0.56, 0.52],
                [1, 0.46, 0.44],
                [1.5, 0.36, 0.36],
                [1.72, 0.16, 0.18],
              ],
              { seg: 6, phase: 15 },
            ),
            builder.paint(COLOSSUS_ARMOR_DARK, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }),
            builder.box(0, -0.08, 0.06, 1.28, 1.14, 1.32, 0.26),
            (builder.rough = 0),
            builder.paint(COLOSSUS_ARMOR, { c2: COLOSSUS_ARMOR_TRIM, ...armorMaterialConfig }))
          for (const plateOffsetX of [-0.4, 0, 0.4]) builder.box(plateOffsetX, -0.52, 0.52, 0.34, 0.3, 0.4, 0.09)
          ;(builder.paint(COLOSSUS_CRYSTAL, { ...crystalMaterialConfig }),
            builder.g(composeMatrix(0, 0.52, 0.04), () => builder.torus(0.6, 0.07, 0.1, 8, 4, { crease: 30, phase: 22.5 })),
            builder.g(composeMatrix(0, 1.02, 0), () => builder.torus(0.47, 0.05, 0.07, 6, 4, { crease: 30 })),
            builder.paint(COLOSSUS_CRYSTAL_HOT, { glow: 0.7, mat: MATERIAL_KINDS.crystal, line: 0 }),
            builder.g(composeMatrix(0, -0.02, 0.73), () => emitHaloRing(0.34)),
            builder.g(composeMatrix(itemsStart * 0.655, -0.04, 0.06, 0, 90, 0), () => emitHaloRing(0.24)))
        }))
    }),
    builder.bakeGrounding(6.2, 0.72, 0.92))
  const scaledValueY = (coordX, shoulderX, coordY, coordZ, armRaise, armSwingRadius) => {
      if (coordY <= 0) return
      const armSwingPhase = colossusHashNoise(coordZ, 31) * COLOSSUS_FULL_CIRCLE
      ;(coordX.move(shoulderX, Math.cos(armSwingPhase) * armSwingRadius * coordY, -(armRaise - 0.3) * coordY, Math.sin(armSwingPhase) * armSwingRadius * coordY), coordX.add(shoulderX, (colossusHashNoise(coordZ, 32) * 160 - 80) * coordY, (colossusHashNoise(coordZ, 33) * 200 - 100) * coordY, (colossusHashNoise(coordZ, 34) * 160 - 80) * coordY))
    },
    sum = (coordX, animState, effectStyle) => {
      const sum = animState.time * 0.9 + animState.seed * 6,
        angleValue = Math.sin(sum * 1.2),
        computed = (animState.mode & 2) !== 0
      let computedX = 1
      const items = computed ? 2 : 1
      let total = 1 + 0.16 * Math.sin(sum * 2) + (computed ? 0.35 : 0),
        computedY = 1
      switch (
        (coordX.pos(torsoJoint, 0, angleValue * 0.14, 0),
        coordX.rot(torsoJoint, 3 + angleValue * 1, Math.sin(sum * 0.4) * 4, 0),
        coordX.rot(coreJoint, sum * 30, sum * 46, 0),
        coordX.scale(coreJoint, 1 + 0.05 * Math.sin(sum * 3)),
        coordX.rot(headJoint, Math.sin(sum * 0.8) * 3, Math.sin(sum * 0.35) * 9, 0),
        coordX.pos(headJoint, 0, Math.sin(sum * 1.2 + 0.6) * 0.06, 0),
        entriesX.forEach((primaryV13, secondaryV25) => {
          ;(coordX.pos(primaryV13, 0, Math.sin(sum * 1.2 + 1 + secondaryV25 * 1.4) * 0.1, 0), coordX.rot(primaryV13, 0, 0, Math.sin(sum * 0.9 + secondaryV25 * 2) * 3))
        }),
        entriesY.forEach((primaryV14, secondaryV26) => coordX.pos(primaryV14, 0, Math.sin(sum * 1.2 + secondaryV26 * 1.1) * 0.05, 0)),
        entriesZ.forEach((primaryV15, secondaryV27) => {
          const itemsEnd = secondaryV27 === 0 ? 1 : -1
          ;(coordX.pos(primaryV15, itemsEnd * Math.sin(sum * 0.8 + secondaryV27) * 0.08, Math.sin(sum * 1.2 + 2 + secondaryV27 * 1.7) * 0.16, Math.cos(sum * 0.7 + secondaryV27) * 0.08),
            coordX.rot(primaryV15, -8 + Math.sin(sum + secondaryV27) * 4, itemsEnd * -10, itemsEnd * Math.sin(sum * 0.9 + secondaryV27 * 2) * 4))
        }),
        entriesDepth.forEach((primaryV16, secondaryV28) => {
          ;(coordX.pos(primaryV16, Math.sin(sum * 0.9 + secondaryV28 * 1.3) * 0.07, Math.sin(sum * 1.2 - secondaryV28 * 0.7) * 0.1, Math.cos(sum * 0.8 + secondaryV28 * 1.1) * 0.07), coordX.rot(primaryV16, 0, sum * (12 + secondaryV28 * 8) * (secondaryV28 % 2 ? -1 : 1), 0))
        }),
        animState.anim)
      ) {
        case "dead": {
          const animTime = animState.t
          ;(entries.forEach((primaryV17, secondaryV29) => {
            const scaledValueV3 = easeOutQuad(inverseLerpClamped(animTime, secondaryV29 * 0.3, secondaryV29 * 0.3 + 0.7)),
              scaledValueV4 = secondaryV29 * 2.1 + 0.6
            ;(coordX.move(primaryV17, Math.cos(scaledValueV4) * 4.5 * scaledValueV3, 1.2 * Math.sin(scaledValueV3 * Math.PI) - 2.4 * scaledValueV3 * scaledValueV3, Math.sin(scaledValueV4) * 4.5 * scaledValueV3), coordX.scale(primaryV17, 1 - inverseLerpClamped(animTime, secondaryV29 * 0.3 + 0.45, secondaryV29 * 0.3 + 0.8)))
          }),
            (computedY = 0),
            (computedX = 1 + 4 * inverseLerpClamped(animTime, 0, 0.6)))
          const poseShoulderGems = (coordX, coordY, coordZ, fallStart, gemDrop) => {
            const fallProgressSquared = squareValue(inverseLerpClamped(fallStart, fallStart, fallStart + 0.55))
            ;(scaledValueY(coordX, coordX, fallProgressSquared, coordY, coordZ, gemDrop), fallProgressSquared >= 1 && coordX.move(coordX, 0, 0.06 * smoothFalloff(fallStart, fallStart + 0.62, 0.08), 0))
          }
          ;(entriesZ.forEach((primaryV18, secondaryV30) => poseShoulderGems(primaryV18, 40 + secondaryV30, 2.9, 1 + secondaryV30 * 0.16, 0.6)),
            entriesX.forEach((primaryV19, secondaryV31) => poseShoulderGems(primaryV19, 50 + secondaryV31, 5.05, 1.6 + secondaryV31 * 0.2, 1.3)),
            entriesY.forEach((primaryV20, secondaryV32) => poseShoulderGems(primaryV20, 60 + secondaryV32, 3.4, 1.7 + secondaryV32 * 0.14, 1.5)),
            entriesDepth.forEach((primaryV21, secondaryV33) => poseShoulderGems(primaryV21, 70 + secondaryV33, entriesWidth[secondaryV33], 1.5 + secondaryV33 * 0.1, 1.1)),
            poseShoulderGems(headJoint, 80, 5.6, 2, 0.9),
            coordX.scale(haloJoint, 1 - inverseLerpClamped(animTime, 0.9, 1.5)))
          const bodyScaleEase = hermiteSmoothStep(inverseLerpClamped(animTime, 2.4, 3))
          ;(coordX.pos(bodyScaleEase, 0, 1.6 * bodyScaleEase, 0),
            coordX.scale(bodyScaleEase, (1 + 0.25 * Math.sin(animTime * 40) * inverseLerpClamped(animTime, 0.6, 2.4) + 0.9 * smoothFalloff(animTime, 3.1, 0.2)) * (1 - inverseLerpClamped(animTime, 3.15, 3.4))),
            (total = (1 + 0.5 * Math.sin(animTime * 34) * inverseLerpClamped(animTime, 0.5, 2.4)) * (1 - 0.6 * inverseLerpClamped(animTime, 1, 2.4)) + 1.6 * smoothFalloff(animTime, 3.1, 0.25)),
            (effectStyle.tint = 0.4 * inverseLerpClamped(animTime, 1.6, 2.6)),
            (effectStyle.tintColor = 6975110))
          break
        }
        case "move": {
          ;(coordX.add(torsoJoint, 10, 0, 0), entriesZ.forEach((coordXZ) => coordX.move(coordXZ, 0, 0.1, -0.5)), entriesDepth.forEach((coordYWidth, coordZWidth) => coordX.move(coordYWidth, 0, 0, -0.16 * (coordZWidth + 1))))
          break
        }
        case "attack": {
          const emberWindupEase = windupEaseCurve(animState.p, animState.windup),
            emberLungeEase = easeOutQuad(inverseLerpClamped(emberWindupEase, 0, 0.27)),
            emberReleasePhase = inverseLerpClamped(emberWindupEase, 0.27, 0.36),
            emberRecoveryEase = hermiteSmoothStep(inverseLerpClamped(emberWindupEase, 0.55, 1)),
            emberLungeAmount = emberLungeEase * (1 - emberReleasePhase),
            scaledValueX = emberReleasePhase * (1 - emberRecoveryEase)
          ;(animState.variant % 2 === 0
            ? (coordX.add(torsoJoint, -4 * emberLungeAmount + 8 * scaledValueX, 22 * emberLungeAmount - 26 * scaledValueX, 0),
              coordX.move(entriesZ[1], 0.9 * emberLungeAmount - 1.5 * scaledValueX, 1.2 * emberLungeAmount - 0.2 * scaledValueX, -1.5 * emberLungeAmount + 2.6 * scaledValueX),
              coordX.add(entriesZ[1], -70 * emberLungeAmount - 86 * scaledValueX, 0, 0),
              coordX.move(entriesZ[0], 0, 0.3 * emberLungeAmount, 0.2 * emberLungeAmount - 0.4 * scaledValueX),
              coordX.add(emberWindupEase, 0, -10 * emberLungeAmount + 8 * scaledValueX, 0))
            : (coordX.add(torsoJoint, -16 * emberLungeAmount + 22 * scaledValueX, 0, 0),
              coordX.move(torsoJoint, 0, 0.25 * emberLungeAmount - 0.35 * scaledValueX, 0.3 * scaledValueX),
              entriesZ.forEach((primaryV22, secondaryV34) => {
                const itemsNear = secondaryV34 === 0 ? 1 : -1
                ;(coordX.move(primaryV22, -itemsNear * 1.5 * (emberLungeAmount + scaledValueX), 3.6 * emberLungeAmount - 1.7 * scaledValueX, -0.6 * emberLungeAmount + 1.5 * scaledValueX), coordX.add(primaryV22, -110 * emberLungeAmount + 24 * scaledValueX, 0, 0))
              }),
              coordX.add(emberWindupEase, -18 * emberLungeAmount + 14 * scaledValueX, 0, 0)),
            coordX.scale(coreJoint, 1 + 0.4 * emberLungeAmount),
            (computedX = 1 + 3 * emberLungeAmount),
            (total += 0.25 * emberLungeAmount + 0.6 * smoothFalloff(emberWindupEase, 0.36, 0.14)))
          break
        }
        case "stunned": {
          ;(coordX.add(torsoJoint, 10, 0, Math.sin(sum * 5) * 5), coordX.add(headJoint, 14, Math.sin(sum * 5) * 18, 20), (computedX = 0), entries.forEach((primaryV23, secondaryV35) => coordX.move(primaryV23, (secondaryV35 - 1) * 0.3, -0.2 * secondaryV35, 0)), (total *= 0.7))
          break
        }
        default:
          if (animState.spawnT >= 0) {
            const spawnTime = animState.spawnT,
              sumX = (coordX, coordY, coordZ, legPhaseOffset, legDropOffset) => {
                const delta = 1 - hermiteSmoothStep(inverseLerpClamped(spawnTime, 1 + legPhaseOffset * 0.1, 1.9 + legPhaseOffset * 0.1))
                ;(scaledValueY(coordX, coordX, delta, coordY, coordZ, legDropOffset), coordX.scale(coordX, coordX.s[coordX] * Math.min(1, inverseLerpClamped(spawnTime, 0.9, 1.1) + 0.001)))
              }
            ;(entriesDepth.forEach((primaryV24, secondaryV36) => sumX(primaryV24, 70 + secondaryV36, entriesWidth[secondaryV36], 5 - secondaryV36, 1.6)),
              entriesY.forEach((primaryV25, secondaryV37) => sumX(primaryV25, 60 + secondaryV37, 3.4, 3 + secondaryV37, 2.2)),
              entriesX.forEach((primaryV26, secondaryV38) => sumX(primaryV26, 50 + secondaryV38, 5.05, 5 + secondaryV38, 2.6)),
              entriesZ.forEach((primaryV27, secondaryV39) => sumX(primaryV27, 40 + secondaryV39, 2.9, 6 + secondaryV39, 1.2)),
              sumX(headJoint, 80, 5.6, 7, 1.4))
            const spawnRiseEase = easeOutQuad(inverseLerpClamped(spawnTime, 0.9, 1.5))
            ;(coordX.pos(coreJoint, 0, -3.4 * (1 - spawnRiseEase), 0),
              coordX.scale(coreJoint, Math.max(0.001, spawnRiseEase)),
              (computedY = easeOutQuad(inverseLerpClamped(spawnTime, 2.2, 2.7))),
              coordX.scale(haloJoint, Math.max(0.001, easeOutQuad(inverseLerpClamped(spawnTime, 2.4, 2.9)) * (1 + 0.25 * smoothFalloff(spawnTime, 2.8, 0.15)))),
              (computedX = 1 + 5 * (1 - inverseLerpClamped(spawnTime, 2.2, 3))),
              (total = 0.5 + 0.8 * smoothFalloff(spawnTime, 1.2, 0.4) + 0.9 * smoothFalloff(spawnTime, 2.7, 0.3) + 0.5 * inverseLerpClamped(spawnTime, 2.6, 3)))
          } else
            computed
              ? (entriesZ.forEach((primaryV28, secondaryV40) => {
                  const itemsFar = secondaryV40 === 0 ? 1 : -1
                  ;(coordX.move(primaryV28, -itemsFar * 0.9, 1.3, 0.7), coordX.add(primaryV28, -50, 0, 0))
                }),
                coordX.add(torsoJoint, 4, 0, 0))
              : entriesZ.forEach((primaryV29, secondaryV41) => coordX.add(primaryV29, Math.sin(sum * 0.6 + secondaryV41 * Math.PI) * 14, 0, 0))
      }
      const colossusHitPulse = hitImpactPulse(animState.hitT)
      colossusHitPulse > 0 &&
        animState.anim !== "dead" &&
        (entriesY.forEach((primaryV30, secondaryV42) => coordX.move(primaryV30, (secondaryV42 % 2 ? -1 : 1) * 0.16 * colossusHitPulse, 0, (secondaryV42 < 2 ? 1 : -1) * 0.16 * colossusHitPulse)),
        entriesX.forEach((primaryV31, secondaryV43) => coordX.move(primaryV31, (secondaryV43 === 0 ? 1 : -1) * 0.2 * colossusHitPulse, 0.08 * colossusHitPulse, 0)),
        coordX.add(headJoint, -8 * colossusHitPulse, 0, 0),
        coordX.scale(coreJoint, coordX.s[coreJoint] * (1 + 0.3 * colossusHitPulse)),
        (total += 0.5 * colossusHitPulse))
      const ringSpinRates = [20, 33, -14],
        ringOffsets = [16, 34, -27]
      ;(entries.forEach((primaryV32, secondaryV44) => {
        ;(coordX.rot(primaryV32, 0, animState.time * ringSpinRates[secondaryV44] * computedX + secondaryV44 * 70, 0), coordX.add(primaryV32, ringOffsets[secondaryV44], 0, 0), coordX.scale(primaryV32, coordX.s[primaryV32] * Math.max(0.001, computedY)))
      }),
        coordX.rot(haloJoint, 0, 0, animState.time * 24 * items),
        (effectStyle.glow = Math.max(0.04, total)))
    }
  return {
    key: "monster:star_colossus",
    geometry: builder.build(),
    rig: nodeTree,
    height: 7,
    radius: 3,
    scale: 1,
    stride: 3,
    triangles: builder.triangleCount,
    deathDur: 3.6,
    spawnDur: 3,
    outline: 1.8,
    attach: {
      chest: { joint: coreJoint, x: 0, y: 0, z: 0.3 },
      core: { joint: coreJoint, x: 0, y: 0, z: 0 },
      head: { joint: headJoint, x: 0, y: 0.5, z: 0.2 },
      weapon: { joint: entriesZ[1], x: 0, y: -0.4, z: 0.5 },
      handL: { joint: entriesZ[0], x: 0, y: -0.2, z: 0.4 },
      handR: { joint: entriesZ[1], x: 0, y: -0.2, z: 0.4 },
      muzzle: { joint: coreJoint, x: 0, y: 0, z: 0.6 },
      crest: { joint: haloJoint, x: 0, y: 0, z: 0 },
    },
    blend: () => 0.24,
    animate: sum,
  }
}

const FROST_GOLEM_FULL_CIRCLE = Math.PI * 2,
  FROST_GOLEM_BODY = 3559566,
  FROST_GOLEM_FUR_DARK = 2505324,
  FROST_GOLEM_BODY_SHADE = 8363208,
  FROST_GOLEM_ARMOR_SHADE = 9087188,
  FROST_GOLEM_FUR = 15266559,
  FROST_GOLEM_FUR_BASE = 11125990,
  FROST_GOLEM_CRYSTAL_COLD = 3828392,
  FROST_GOLEM_CRYSTAL = 5816575,
  FROST_GOLEM_CRYSTAL_BRIGHT = 14218495,
  FROST_GOLEM_CORE_CRYSTAL = 10479359,
  FROST_GOLEM_LEATHER = 1712696,
  FROST_GOLEM_CRYSTAL_GLOW = 13169919,
  FROST_GOLEM_CRYSTAL_RIM = 8377599,
  frostGolemHashNoise = (primary, secondary) => {
    const angleValue = Math.sin(primary * 127.1 + secondary * 311.7) * 43758.5453
    return angleValue - Math.floor(angleValue)
  }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildFrostGolemModel() {
  const joints = buildBeastRig({
      pelvis: [1.8, -0.95],
      chest: [1.8, 0.45],
      neck: [
        [2.1, 0.92],
        [2.5, 1.2],
      ],
      head: [2.85, 1.4],
      tail: [[1.98, -1.6]],
      front: [
        [0.38, 1.6, 0.6],
        [0.38, 0.92, 0.68],
        [0.38, 0.13, 0.6],
      ],
      hind: [
        [0.42, 1.65, -1],
        [0.42, 0.95, -1.36],
        [0.42, 0.13, -1.2],
      ],
      bendFront: 1,
      bendHind: -1,
    }),
    entries = joints.rig,
    earLJoint = entries.add("earL", joints.head, 0.17, 3.04, 1.34),
    earRJoint = entries.add("earR", joints.head, -0.17, 3.04, 1.34),
    antlerLJoint = entries.add("antlerL", joints.head, 0.13, 3.06, 1.4),
    antlerRJoint = entries.add("antlerR", joints.head, -0.13, 3.06, 1.4),
    crestJoint = entries.add("crest", joints.head, 0, 3.62, 1.12),
    builder = new ModelBuilder()
  builder.crease = 62
  const furMaterialConfig = { mat: MATERIAL_KINDS.fur, pattern: TERRAIN_LOOK.fur, patternScale: 7, patternAmt: 0.45, grain: 0.07 },
    furShadePaint = (coordX, coordY, coordZ, headFurPaintU, headFurNormalX, headFurShadeNormalY) => smoothStep01(0.1, -0.8, headFurShadeNormalY)
  joints.legs.forEach((poseFar) => {
    const legSideSign = poseFar.side,
      legBoneProjector = makeBoneChainProjector(entries, [poseFar.upper, poseFar.lower, poseFar.foot], 0.45)
    ;(builder.bind(legBoneProjector).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_BODY_SHADE, by: (primaryZ, secondaryZ) => smoothStep01(0.95, 0.3, secondaryZ), ...furMaterialConfig }),
      poseFar.front
        ? builder.tube(
            [
              [legSideSign * 0.4, 1.86, 0.56, 0.2, 0.3],
              [legSideSign * 0.41, 1.5, 0.62, 0.17, 0.22],
              [legSideSign * 0.39, 1.16, 0.68, 0.115, 0.13],
              [legSideSign * 0.38, 0.92, 0.69, 0.1, 0.105],
              [legSideSign * 0.38, 0.6, 0.65, 0.07, 0.075],
              [legSideSign * 0.38, 0.3, 0.61, 0.066, 0.07],
              [legSideSign * 0.38, 0.2, 0.61, 0.088, 0.092],
            ],
            { seg: 7, cap0: !1 },
          )
        : builder.tube(
            [
              [legSideSign * 0.36, 1.98, -0.98, 0.27, 0.42],
              [legSideSign * 0.42, 1.6, -1.04, 0.24, 0.36],
              [legSideSign * 0.43, 1.25, -1.2, 0.15, 0.22],
              [legSideSign * 0.42, 0.95, -1.35, 0.1, 0.115],
              [legSideSign * 0.42, 0.6, -1.29, 0.07, 0.078],
              [legSideSign * 0.42, 0.3, -1.22, 0.066, 0.07],
              [legSideSign * 0.42, 0.2, -1.21, 0.088, 0.092],
            ],
            { seg: 7, cap0: !1 },
          ),
      builder.bone(poseFar.foot).paint(FROST_GOLEM_LEATHER, { c2: 2897492, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
      builder.lathe(
        [
          [0, 0.11, 0.145, poseFar.rx, poseFar.rz + 0.035],
          [0.1, 0.105, 0.13, poseFar.rx, poseFar.rz + 0.025],
          [0.21, 0.085, 0.09, poseFar.rx, poseFar.rz + 0.005],
        ],
        { seg: 6, crease: 30 },
      ),
      builder.bone(poseFar.lower).paint(FROST_GOLEM_CRYSTAL, { c2: FROST_GOLEM_CRYSTAL_BRIGHT, glow: 0.12, glow2: 0.5, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }))
    for (let crystalSegmentIndex = 0; crystalSegmentIndex < 3; crystalSegmentIndex++) {
      const deltaDepth = (crystalSegmentIndex - 1) * 0.9 + Math.PI
      builder.g(composeMatrix(poseFar.rx + Math.sin(deltaDepth) * 0.06, 0.32, poseFar.rz + Math.cos(deltaDepth) * 0.07, -28 * Math.cos(deltaDepth), 0, 28 * Math.sin(deltaDepth)), () => builder.crystal(0.045, 0.3 - Math.abs(crystalSegmentIndex - 1) * 0.07, 4, 0.7, 0.12))
    }
  })
  const spineChainProjector = makeBoneChainProjector(entries, [joints.pelvis, joints.chest], 1.2)
  ;(builder.bind(spineChainProjector).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_ARMOR_SHADE, by: furShadePaint, ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.86, -1.66, 0.12, 0.16],
        [0, 1.84, -1.46, 0.36, 0.38],
        [0, 1.74, -1, 0.49, 0.48],
        [0, 1.72, -0.35, 0.42, 0.39],
        [0, 1.66, 0.3, 0.5, 0.53],
        [0, 1.78, 0.72, 0.42, 0.47],
        [0, 1.95, 0.98, 0.3, 0.36],
      ],
      { seg: 12, up: [1, 0, 0] },
    ),
    builder.sym(() => {
      builder.paint(FROST_GOLEM_CRYSTAL_RIM, { c2: FROST_GOLEM_CRYSTAL_BRIGHT, glow: 0.5, mat: MATERIAL_KINDS.crystal })
      const entriesHeight = [
        [-0.92, 1.86, 0.46, 34],
        [-0.58, 1.82, 0.43, 22],
        [-0.26, 1.78, 0.405, 10],
      ]
      for (const [coordXWidth, coordYHeight, coordZHeight, antlerAngle] of entriesHeight)
        (builder.g(composeMatrix(coordZHeight + 0.035, coordYHeight, coordXWidth, 0, 90, antlerAngle), () =>
          builder.extrude(
            [
              [-0.2, 0],
              [-0.04, 0.045],
              [0.24, 0.01],
              [0.02, -0.045],
            ],
            0.05,
            0,
          ),
        ),
          builder.g(composeMatrix(coordZHeight + 0.03, coordYHeight - 0.16, coordXWidth + 0.1, 0, 90, antlerAngle - 46), () =>
            builder.extrude(
              [
                [-0.1, 0],
                [0, 0.03],
                [0.14, 0],
                [0, -0.03],
              ],
              0.05,
              0,
            ),
          ))
    }))
  for (let index = 0; index < 7; index++) {
    const ratio = index / 6,
      lerped = lerpValue(0.52, -1.34, ratio),
      spineCrystalY = 2.2 + 0.03 * Math.sin(ratio * Math.PI) - 0.08 * ratio,
      lerpedX = lerpValue(0.42, 0.2, ratio) * (index % 2 ? 0.8 : 1)
    ;(builder.bind(spineChainProjector).paint(FROST_GOLEM_CRYSTAL, { c2: FROST_GOLEM_CRYSTAL_BRIGHT, glow: 0.12, glow2: 0.55, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
      builder.g(composeMatrix(0, spineCrystalY - 0.08, lerped, -24 - frostGolemHashNoise(index, 1) * 14, 0, (frostGolemHashNoise(index, 2) - 0.5) * 22), () => builder.crystal(0.07 * (1 - ratio * 0.35), lerpedX, 5, 0.6, 0.15)))
  }
  ;(builder.bone(joints.tail[0]).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_FUR, by: furShadePaint, ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.96, -1.58, 0.1, 0.09],
        [0, 1.88, -1.8, 0.11, 0.07],
        [0, 1.72, -1.98, 0.02, 0.02],
      ],
      { seg: 6, up: [1, 0, 0] },
    ))
  const neckChainProjector = makeBoneChainProjector(entries, [joints.chest, joints.neck[0], joints.neck[1], joints.head], 0.9)
  ;(builder.bind(neckChainProjector).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_ARMOR_SHADE, by: furShadePaint, ...furMaterialConfig }),
    builder.tube(
      [
        [0, 1.86, 0.78, 0.34, 0.44],
        [0, 2.14, 0.99, 0.26, 0.33],
        [0, 2.48, 1.19, 0.2, 0.25],
        [0, 2.8, 1.36, 0.17, 0.2],
      ],
      { seg: 10, up: [1, 0, 0], cap0: !1 },
    ))
  const samples = [0, 0.81, 0.585],
    samplesX = [0, -0.585, samples[1]],
    distance = /**
 * 处理距离。
 *
 * @param samples - 主要输入
 * @param coordYX - 输入
 * @param coordZX - 第三输入
 * @param spikeCount - 第四输入
 * @param spikeLength - 附加输入
 * @param spikeBaseRadius - 附加输入
 * @param bindJoint - 输入
 * @param phaseOffset - 附加输入
 */
(samples, coordYX, coordZX, spikeCount, spikeLength, spikeBaseRadius, bindJoint, phaseOffset) => {
      builder.bone(bindJoint)
      for (let spikeIndex = 0; spikeIndex < spikeCount; spikeIndex++) {
        const spikeAngle = phaseOffset + (spikeIndex / spikeCount) * FROST_GOLEM_FULL_CIRCLE,
          angleValue = Math.cos(spikeAngle),
          angleValueX = Math.sin(spikeAngle),
          scaledValueX = 1 + 0.55 * Math.max(0, -angleValueX),
          spikeBase = [samples[0] + angleValue * coordYX * 0.86, samples[1] + samplesX[1] * angleValueX * coordZX * 0.86, samples[2] + samplesX[2] * angleValueX * coordZX * 0.86]
        let scaledValueY = angleValue * 0.62,
          scaledValueZ = samplesX[1] * angleValueX * 0.62 - samples[1] * 0.75 - 0.3,
          scaledValueWidth = samplesX[2] * angleValueX * 0.62 - samples[2] * 0.75
        const distance = Math.hypot(scaledValueY, scaledValueZ, scaledValueWidth)
        ;((scaledValueY /= distance), (scaledValueZ /= distance), (scaledValueWidth /= distance))
        const scaledValueHeight = spikeLength * scaledValueX * (0.85 + 0.3 * frostGolemHashNoise(spikeIndex, spikeCount)),
          samplesY = [spikeBase[0] + scaledValueY * scaledValueHeight, spikeBase[1] + scaledValueZ * scaledValueHeight, spikeBase[2] + scaledValueWidth * scaledValueHeight]
        builder.paint(FROST_GOLEM_FUR_BASE, { c2: FROST_GOLEM_FUR, ao: 0.8, ao2: 1, mat: MATERIAL_KINDS.fur, pattern: TERRAIN_LOOK.fur, patternScale: 8, patternAmt: 0.35 })
        const samplesZ = [lerpValue(spikeBase[0], samplesY[0], 0.45), lerpValue(spikeBase[1], samplesY[1], 0.45), lerpValue(spikeBase[2], samplesY[2], 0.45)]
        builder.tube(
          [
            [spikeBase[0], spikeBase[1], spikeBase[2], spikeBaseRadius, spikeBaseRadius * 0.62],
            [samplesZ[0], samplesZ[1], samplesZ[2], spikeBaseRadius * 0.9, spikeBaseRadius * 0.56],
            [samplesY[0], samplesY[1], samplesY[2], 0.014, 0.01],
          ],
          { seg: 5, up: [-angleValueX, samplesX[1] * angleValue, samplesX[2] * angleValue], cap0: !1 },
        )
      }
    }
  ;(distance([0, 2.58, 1.25], 0.2, 0.25, 8, 0.34, 0.11, joints.neck[1], 0.2), distance([0, 2.32, 1.1], 0.27, 0.34, 9, 0.44, 0.14, joints.neck[0], 0.55), distance([0, 2.04, 0.9], 0.34, 0.44, 10, 0.52, 0.17, joints.chest, 0.1))
  const computed = 1.16,
    pivotScaleMatrix = new Matrix4()
      .makeTranslation(0, 2.85, 1.4)
      .multiply(new Matrix4().makeScale(computed, computed, computed))
      .multiply(new Matrix4().makeTranslation(0, -2.85, -1.4))
  builder.g(pivotScaleMatrix, () => {
    ;(builder.bone(joints.head).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_ARMOR_SHADE, by: (coordXNear, coordYNear, coordZNear, headPaintU, headNormalX, headShadeNormalY) => Math.max(smoothStep01(0.1, -0.8, headShadeNormalY), smoothStep01(1.85, 2.2, coordZNear) * 0.7), ...furMaterialConfig }),
      builder.tube(
        [
          [0, 2.9, 1.24, 0.15, 0.16],
          [0, 2.93, 1.4, 0.2, 0.21],
          [0, 2.92, 1.6, 0.185, 0.19],
          [0, 2.84, 1.84, 0.13, 0.135],
          [0, 2.76, 2.06, 0.1, 0.1],
          [0, 2.71, 2.2, 0.075, 0.07],
        ],
        { seg: 9, up: [1, 0, 0] },
      ),
      builder.paint(FROST_GOLEM_FUR, { mat: MATERIAL_KINDS.fur }),
      builder.g(composeMatrix(0, 3.05, 1.62, 72, 0, 0), () =>
        builder.extrude(
          [
            [-0.035, -0.16],
            [0.035, -0.16],
            [0.07, 0.04],
            [0, 0.2],
            [-0.07, 0.04],
          ],
          0.07,
          0.02,
        ),
      ),
      builder.paint(FROST_GOLEM_LEATHER, { gloss: 0.6, mat: MATERIAL_KINDS.leather }),
      builder.ball(0, 2.725, 2.235, 0.068, 0.055, 0.05, 1),
      builder.sym((mirrorSide) => {
        ;(builder.paint(FROST_GOLEM_CRYSTAL_GLOW, { glow: 0.9, mat: MATERIAL_KINDS.crystal }),
          builder.g(composeMatrix(0.168, 2.99, 1.6, 0, 62, 18), () =>
            builder.extrude(
              [
                [-0.075, 0],
                [-0.01, 0.036],
                [0.075, 0.012],
                [0.01, -0.03],
              ],
              0.04,
              0,
            ),
          ),
          builder.paint(FROST_GOLEM_FUR_DARK, { mat: MATERIAL_KINDS.fur }),
          builder.g(composeMatrix(0.165, 3.035, 1.58, 0, 60, 16), () => builder.box(0, 0, 0, 0.19, 0.035, 0.05, 0.012)),
          builder.bone(mirrorSide > 0 ? earLJoint : earRJoint).paint(FROST_GOLEM_BODY, { c2: FROST_GOLEM_FUR_BASE, ...furMaterialConfig }),
          builder.limb([0.17, 3.02, 1.34], [0.5, 3.16, 1.14], 0.085, 0.012, { seg: 5, flat: 0.42, up: [0, 0.35, 1], bulge: 0.55 }),
          builder.bone(joints.head))
      }))
  })
  const ratioX = (colorMix) => (colorMix < 0.5 ? lerpRgbChannels(FROST_GOLEM_CRYSTAL_COLD, FROST_GOLEM_CRYSTAL, colorMix / 0.5) : lerpRgbChannels(FROST_GOLEM_CRYSTAL, FROST_GOLEM_CRYSTAL_BRIGHT, (colorMix - 0.5) / 0.5)),
    lerpedY = (glowFactor) => lerpValue(0.06, 0.62, glowFactor * glowFactor),
    paintAntlerLimb = (clavL, coordX, coordY, coordZ, limbShadeMix, limbTipShadeMix) => {
      ;(builder.paint(ratioX(limbShadeMix), { c2: ratioX(limbTipShadeMix), glow: lerpedY(limbShadeMix), glow2: lerpedY(limbTipShadeMix), gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }), builder.limb(clavL, coordX, coordY, coordZ, { seg: 6, crease: 0 }))
    },
    entriesX = [
      [0.13, 3.04, 1.4],
      [0.36, 3.3, 1.2],
      [0.74, 3.42, 0.84],
      [1.14, 3.6, 0.56],
      [1.5, 3.52, 0.16],
      [1.64, 3.68, -0.14],
    ],
    entriesY: [number, number[][]][] = [
      [
        1,
        [
          [0.44, 3.52, 1.46],
          [0.4, 3.72, 1.62],
        ],
      ],
      [
        2,
        [
          [0.86, 3.72, 0.98],
          [0.82, 3.94, 1.1],
        ],
      ],
      [
        3,
        [
          [1.24, 3.86, 0.68],
          [1.34, 4.02, 0.62],
        ],
      ],
      [
        4,
        [
          [1.7, 3.74, 0.3],
          [1.84, 3.82, 0.36],
        ],
      ],
      [
        2,
        [
          [0.66, 3.6, 0.58],
          [0.6, 3.74, 0.42],
        ],
      ],
    ]
  ;(builder.sym((mirrorSide) => {
    builder.bone(mirrorSide > 0 ? antlerLJoint : antlerRJoint)
    for (let antlerSegmentIndex = 0; antlerSegmentIndex < entriesX.length - 1; antlerSegmentIndex++) paintAntlerLimb(entriesX[antlerSegmentIndex], entriesX[antlerSegmentIndex + 1], lerpValue(0.1, 0.035, antlerSegmentIndex / 4), lerpValue(0.085, 0.012, (antlerSegmentIndex + 1) / 5), antlerSegmentIndex / 5, (antlerSegmentIndex + 1) / 5)
    for (const [primaryV33, samplesV3] of entriesY) {
      const ratioX = primaryV33 / 5
      ;(paintAntlerLimb(entriesX[primaryV33], samplesV3[0], 0.06, 0.04, ratioX, ratioX + 0.25), paintAntlerLimb(samplesV3[0], samplesV3[1], 0.042, 0.008, ratioX + 0.25, Math.min(1, ratioX + 0.55)))
    }
  }),
    builder.bone(crestJoint).paint(FROST_GOLEM_CORE_CRYSTAL, { c2: 15793151, glow: 0.55, glow2: 0.85, gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }),
    builder.g(composeMatrix(0, 3.62 - 0.3, 1.12), () => builder.crystal(0.17, 0.6, 6, 0.42, 0.42, 1)))
  for (let crystalRepeatIndex = 0; crystalRepeatIndex < 3; crystalRepeatIndex++) {
    const scaledValueX = (crystalRepeatIndex / 3) * FROST_GOLEM_FULL_CIRCLE
    builder.g(composeMatrix(Math.cos(scaledValueX) * 0.34, 3.6 + (crystalRepeatIndex - 1) * 0.07, 1.12 + Math.sin(scaledValueX) * 0.34, 0, 0, 0), () => builder.g(composeMatrix(0, -0.09, 0, 14, crystalRepeatIndex * 50, 10), () => builder.crystal(0.045, 0.18, 4, 0.5, 0.5, 1)))
  }
  builder.bakeGrounding(3.2, 0.72, 0.9)
  const computedX = 3.3,
    sum = (coordX, animState, effectStyle) => {
      const sum = animState.time + animState.seed * 7,
        angleValue = Math.sin(sum * 1.5),
        computed = (animState.mode & 2) !== 0,
        poseFrostNeck = (primary, secondary) => {
          ;(coordX.add(joints.neck[0], (secondary ? 40 : 52) * primary, 0, 0), coordX.add(joints.neck[1], (secondary ? 30 : 34) * primary, 0, 0), coordX.add(joints.head, (secondary ? 32 : -14) * primary, 0, 0))
        }
      ;(coordX.pos(joints.pelvis, 0, angleValue * 0.012, 0), coordX.rot(joints.chest, angleValue * 0.8, 0, 0), coordX.rot(crestJoint, 0, sum * 40, 0), coordX.pos(crestJoint, 0, Math.sin(sum * 1.3) * 0.05, 0))
      const scaledValueX = smoothFalloff((sum * 0.37) % 1, 0.5, 0.06)
      ;(coordX.rot(earLJoint, 0, -26 * scaledValueX, 14 * scaledValueX),
        coordX.rot(earRJoint, 0, 20 * smoothFalloff((sum * 0.29 + 0.4) % 1, 0.5, 0.07), 0),
        coordX.rot(joints.tail[0], -18 * smoothFalloff((sum * 0.23) % 1, 0.5, 0.1), Math.sin(sum * 2.3) * 8, 0),
        (effectStyle.glow = 1 + 0.1 * Math.sin(sum * 2.1) + (computed ? 0.3 : 0)))
      let ikActiveFlag = !0
      switch (animState.anim) {
        case "dead": {
          const deathAnimTime = animState.t,
            collapseEase = hermiteSmoothStep(inverseLerpClamped(deathAnimTime, 0, 0.5)),
            deathFallEase = squareValue(inverseLerpClamped(deathAnimTime, 0.5, 1.1)),
            deathSettleEase = inverseLerpClamped(deathAnimTime, 1.1, 1.35),
            items = animState.seed > 0.5 ? 1 : -1
          ;(coordX.pos(joints.pelvis, 0, -0.35 * collapseEase - 0.1 * deathFallEase, 0.22 * collapseEase),
            coordX.rot(joints.pelvis, 24 * collapseEase * (1 - deathFallEase), 0, 0),
            coordX.rot(joints.chest, 8 * collapseEase, 0, 0),
            poseFrostNeck(0.5 * collapseEase + 0.2 * deathFallEase, !1),
            coordX.add(joints.head, 0, 0, items * -30 * deathFallEase),
            coordX.rot(joints.root, 0, 0, items * (86 * deathFallEase + 3 * Math.sin(deathSettleEase * Math.PI))),
            coordX.pos(joints.root, items * 0.7 * deathFallEase, 0.42 * deathFallEase, 0),
            joints.legs.forEach((poseTop, secondaryV45) => poseQuadrupedLegIk(joints, coordX, secondaryV45, poseTop.rx, poseTop.ry - 0.2 * deathFallEase, poseTop.rz + (0.22 + (poseTop.front ? -0.3 : 0.3)) * deathFallEase, 30 * deathFallEase)),
            (ikActiveFlag = !1))
          const tailCurlProgress = inverseLerpClamped(deathAnimTime, 1, 1.8)
          ;(coordX.scale(collapseEase, 1 - tailCurlProgress * (0.999 - 0.04 * Math.sin(deathAnimTime * 40))), coordX.scale(deathFallEase, 1 - inverseLerpClamped(deathAnimTime, 1.1, 1.8) * 0.999))
          const tailFadeProgress = inverseLerpClamped(deathAnimTime, 1.2, 2)
          ;(coordX.pos(deathSettleEase, 0, 0.8 * easeOutQuad(tailFadeProgress), 0),
            coordX.scale(deathSettleEase, (1 + 0.5 * smoothFalloff(tailFadeProgress, 0.2, 0.2)) * (1 - inverseLerpClamped(deathAnimTime, 1.7, 2.1))),
            (effectStyle.glow = (1 + 0.9 * smoothFalloff(deathAnimTime, 1.2, 0.3)) * (1 - 0.8 * inverseLerpClamped(deathAnimTime, 1.4, 2.1))),
            (effectStyle.tint = 0.5 * inverseLerpClamped(deathAnimTime, 1.2, 2)),
            (effectStyle.tintColor = 9348296))
          break
        }
        case "move": {
          const scaledValueY = animState.stride * FROST_GOLEM_FULL_CIRCLE
          ;(coordX.add(joints.neck[0], 10 + Math.sin(scaledValueY * 2 + 0.8) * 5, 0, 0),
            coordX.add(joints.neck[1], -4 + Math.sin(scaledValueY * 2 + 0.2) * 4, 0, 0),
            coordX.add(joints.head, 4 - Math.sin(scaledValueY * 2) * 5, 0, 0),
            animateBeastGait(joints, coordX, animState.stride, { style: "trot", stride: computedX, lift: 0.42, bob: 0.07, pitch: 2.5, sway: 2, roll: 1.5, curl: 50 }),
            coordX.add(joints.tail[0], -20, Math.sin(scaledValueY) * 14, 0),
            (ikActiveFlag = !1))
          break
        }
        case "attack": {
          const frostWindupEase = windupEaseCurve(animState.p, animState.windup),
            frostLungeEase = easeOutQuad(inverseLerpClamped(frostWindupEase, 0, 0.27)),
            frostReleasePhase = inverseLerpClamped(frostWindupEase, 0.27, 0.36),
            frostRecoveryEase = hermiteSmoothStep(inverseLerpClamped(frostWindupEase, 0.5, 1))
          if (animState.variant % 2 === 0) {
            const scaledValueZ = frostLungeEase * (1 - frostReleasePhase),
              scaledValueWidth = frostReleasePhase * (1 - frostRecoveryEase)
            ;(coordX.move(joints.pelvis, 0, -0.14 * scaledValueZ - 0.05 * scaledValueWidth, -0.3 * scaledValueZ + 0.62 * scaledValueWidth),
              coordX.add(joints.pelvis, 6 * scaledValueZ - 5 * scaledValueWidth, 0, 0),
              poseFrostNeck(0.95 * scaledValueZ, !0),
              coordX.add(joints.neck[0], -34 * scaledValueWidth, 0, 0),
              coordX.add(joints.neck[1], -26 * scaledValueWidth, 0, 0),
              coordX.add(joints.head, -30 * scaledValueWidth, 0, 0),
              (effectStyle.glow += 0.4 * scaledValueZ + 0.8 * smoothFalloff(frostWindupEase, 0.36, 0.14)))
          } else {
            const scaledValueHeight = frostLungeEase * (1 - frostReleasePhase),
              scaledValueDepth = frostReleasePhase * (1 - frostRecoveryEase)
            ;(coordX.move(joints.pelvis, 0, -0.1 * scaledValueDepth, 0.26 * scaledValueDepth), coordX.add(joints.pelvis, 7 * scaledValueDepth, 0, 0), applyBeastRecoil(joints, coordX, scaledValueHeight, 44, 0.35), coordX.add(joints.neck[0], 22 * scaledValueHeight + 16 * scaledValueDepth, 0, 0), coordX.add(joints.head, 18 * scaledValueHeight, 0, 0))
            for (let index = 0; index < 2; index++) {
              const pose = joints.legs[index],
                scaledValueStart = index === 0 ? scaledValueHeight : Math.min(1, scaledValueHeight * 1.15)
              poseQuadrupedLegIk(joints, coordX, index, pose.rx, pose.ry + 1.5 * scaledValueStart, pose.rz - 0.2 * scaledValueStart + 0.22 * scaledValueDepth, 60 * scaledValueStart)
            }
            ;((ikActiveFlag = !1), (effectStyle.glow += 0.3 * scaledValueHeight + 0.9 * smoothFalloff(frostWindupEase, 0.36, 0.14)))
          }
          break
        }
        case "stunned": {
          ;(poseFrostNeck(0.55, !1), coordX.add(joints.neck[0], 0, Math.sin(sum * 5) * 12, 0), coordX.add(joints.head, 0, 0, Math.sin(sum * 5 + 1) * 16), coordX.add(joints.pelvis, 0, 0, Math.sin(sum * 2.5) * 3))
          break
        }
        case "airborne": {
          coordX.rot(joints.root, -16 * Math.sin(animState.p * Math.PI), 0, 10)
          for (let legIndex = 0; legIndex < 4; legIndex++) poseBeastLeg(joints, coordX, legIndex, legIndex < 2 ? -40 : 34, legIndex < 2 ? 70 : -50, 20)
          ikActiveFlag = !1
          break
        }
        default:
          if (animState.spawnT >= 0) {
            const ratio = animState.spawnT / 1.2,
              landEase = hermiteSmoothStep(inverseLerpClamped(ratio, 0.15, 0.7)),
              headSnapEase = smoothFalloff(ratio, 0.84, 0.16)
            ;(poseFrostNeck(1 - landEase, !1),
              coordX.add(joints.neck[0], -16 * headSnapEase, 0, 0),
              coordX.add(joints.neck[1], -14 * headSnapEase, 0, 0),
              coordX.add(joints.head, -22 * headSnapEase, 0, 0),
              coordX.move(joints.pelvis, 0, -0.1 * (1 - landEase), 0),
              (effectStyle.tint = 0.85 * (1 - inverseLerpClamped(ratio, 0.1, 0.8))),
              (effectStyle.tintColor = 10476799),
              (effectStyle.glow = 0.3 + 0.7 * landEase + 0.7 * headSnapEase))
          } else if (computed) {
            ;(poseFrostNeck(0.7, !0), coordX.move(joints.pelvis, 0, -0.06, -0.08))
            const scaledValueEnd = (sum * 0.9) % 1,
              sumX = smoothFalloff(scaledValueEnd, 0.3, 0.14) + smoothFalloff(scaledValueEnd, 0.58, 0.14)
            poseAllLegsIk(joints, coordX, 0, 0, 14)
            const poseX = joints.legs[0]
            ;(poseQuadrupedLegIk(joints, coordX, 0, poseX.rx, poseX.ry + 0.3 * sumX, poseX.rz + 0.1 - 0.3 * sumX * Math.sin(scaledValueEnd * FROST_GOLEM_FULL_CIRCLE * 3.4), 40 * sumX), (ikActiveFlag = !1))
          } else {
            const ratioX = (sum / 7.5) % 1,
              ratioY = Math.floor(sum / 7.5) % 2,
              scaledValueNear = hermiteSmoothStep(inverseLerpClamped(ratioX, 0.62, 0.7)) * (1 - hermiteSmoothStep(inverseLerpClamped(ratioX, 0.9, 0.98)))
            if ((coordX.add(joints.neck[0], Math.sin(sum * 0.7) * 2, Math.sin(sum * 0.31) * 10 * (1 - scaledValueNear), 0), coordX.add(joints.head, Math.sin(sum * 0.9) * 2.5, Math.sin(sum * 0.31 + 0.7) * 12 * (1 - scaledValueNear), 0), ratioY === 0))
              (poseFrostNeck(scaledValueNear * 0.92, !1), coordX.add(joints.head, 0, Math.sin(sum * 6) * 6 * scaledValueNear, 0))
            else if (scaledValueNear > 0) {
              poseFrostNeck(scaledValueNear * 0.3, !0)
              const scaledValueFar = scaledValueNear * Math.max(0, Math.sin(ratioX * FROST_GOLEM_FULL_CIRCLE * 9))
              poseAllLegsIk(joints, coordX, 0, 0, 13)
              const poseY = joints.legs[1]
              ;(poseQuadrupedLegIk(joints, coordX, 1, poseY.rx, poseY.ry + 0.26 * scaledValueFar, poseY.rz + 0.12 - 0.3 * scaledValueFar, 36 * scaledValueFar), (ikActiveFlag = !1))
            }
          }
      }
      const frostHitPulse = hitImpactPulse(animState.hitT)
      if (frostHitPulse > 0 && animState.anim !== "dead") {
        const itemsX = animState.seed > 0.5 ? 1 : -1
        ;(coordX.add(joints.neck[0], -8 * frostHitPulse, itemsX * 22 * frostHitPulse, 0), coordX.add(joints.head, 0, itemsX * 16 * frostHitPulse, itemsX * 14 * frostHitPulse), coordX.move(joints.pelvis, 0, -0.05 * frostHitPulse, -0.08 * frostHitPulse))
      }
      ikActiveFlag && poseAllLegsIk(joints, coordX)
    }
  return {
    key: "monster:frost_golem",
    geometry: builder.build(),
    rig: entries,
    height: 3.95,
    radius: 1.5,
    scale: 1,
    stride: computedX,
    triangles: builder.triangleCount,
    deathDur: 2.2,
    spawnDur: 1.2,
    outline: 1.6,
    attach: {
      chest: { joint: joints.chest, x: 0, y: 0, z: 0.1 },
      head: { joint: joints.head, x: 0, y: 0.1, z: 0.3 },
      muzzle: { joint: joints.head, x: 0, y: -0.12, z: 0.85 },
      weapon: { joint: joints.head, x: 0, y: 0.6, z: 0.5 },
      crest: { joint: crestJoint, x: 0, y: 0, z: 0 },
      tail: { joint: joints.tail[0], x: 0, y: -0.2, z: -0.35 },
    },
    blend: (primaryY, secondaryY) => (secondaryY === "attack" ? 0.1 : 0.2),
    animate: sum,
  }
}
export { buildMossbackModel, buildAbyssDrakeModel, buildEmberGolemModel, buildStarColossusModel, buildFrostGolemModel }
