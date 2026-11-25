/**
 * pO 世界系统
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { NodeTree } from '../node-tree'
import { MATERIAL_KINDS, ModelBuilder, TERRAIN_LOOK, composeMatrix, lerpValue, smoothStep01 } from '../render/model-builder'

const clampUnitInterval = (fraction) => (fraction < 0 ? 0 : fraction > 1 ? 1 : fraction),
  inverseLerpClamped = (sample, rangeStart, rangeEnd) => clampUnitInterval((sample - rangeStart) / (rangeEnd - rangeStart)),
  smoothFalloff = (position, center, falloffRadius) => {
    const normalizedDistance = Math.abs(position - center) / falloffRadius
    return normalizedDistance >= 1 ? 0 : 1 - normalizedDistance * normalizedDistance * (3 - 2 * normalizedDistance)
  },
  hermiteSmoothStep = (ratio) => ratio * ratio * (3 - 2 * ratio),
  easeOutQuad = (completion) => 1 - (1 - completion) * (1 - completion),
  squareValue = (operand) => operand * operand

function windupEaseCurve(attackProgress, windupThreshold) {
  const clampedWindupThreshold = Math.min(0.6, Math.max(0.15, windupThreshold))
  return attackProgress < clampedWindupThreshold ? (attackProgress / clampedWindupThreshold) * 0.35 : 0.35 + ((attackProgress - clampedWindupThreshold) / (1 - clampedWindupThreshold)) * 0.65
}

function makeBoneChainProjector(boneTree, bushMap, blendWidth = 0.6, extraBonePosition?) {
  const count = bushMap.length,
    jointPositions = bushMap.map((jointId) => [boneTree.bx(jointId), boneTree.by(jointId), boneTree.bz(jointId)])
  extraBonePosition && jointPositions.push(extraBonePosition)
  const lastSegmentIndex = jointPositions.length - 2,
    blendHalfWidth = Math.max(0.001, blendWidth * 0.5)
  return (queryX, queryY, queryZ) => {
    if (lastSegmentIndex < 0) return [bushMap[0], bushMap[0], 1]
    let closestSegmentIndex = 0,
      projectionRatio = 0,
      closestDistanceSq = 1 / 0
    for (let index = 0; index <= lastSegmentIndex; index++) {
      const selectedA = jointPositions[index],
        nextBonePosition = jointPositions[index + 1],
        segmentDeltaX = nextBonePosition[0] - selectedA[0],
        segmentDeltaY = nextBonePosition[1] - selectedA[1],
        segmentDeltaZ = nextBonePosition[2] - selectedA[2],
        segmentLengthSq = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY + segmentDeltaZ * segmentDeltaZ || 1e-9,
        rawProjection = ((queryX - selectedA[0]) * segmentDeltaX + (queryY - selectedA[1]) * segmentDeltaY + (queryZ - selectedA[2]) * segmentDeltaZ) / segmentLengthSq,
        clampedProjection = rawProjection < 0 ? 0 : rawProjection > 1 ? 1 : rawProjection,
        projectionOffsetX = selectedA[0] + segmentDeltaX * clampedProjection - queryX,
        projectionOffsetY = selectedA[1] + segmentDeltaY * clampedProjection - queryY,
        projectionOffsetZ = selectedA[2] + segmentDeltaZ * clampedProjection - queryZ,
        distanceSq = projectionOffsetX * projectionOffsetX + projectionOffsetY * projectionOffsetY + projectionOffsetZ * projectionOffsetZ
      distanceSq < closestDistanceSq && ((closestDistanceSq = distanceSq), (closestSegmentIndex = index), (projectionRatio = index === lastSegmentIndex ? Math.max(0, rawProjection) : clampedProjection))
    }
    const bestSegmentIndex = closestSegmentIndex,
      segmentProjectionRatio = projectionRatio
    if (segmentProjectionRatio > 1 - blendHalfWidth && bestSegmentIndex + 1 < count) {
      const endBlendFactor = (segmentProjectionRatio - 1) / blendHalfWidth
      return endBlendFactor >= 0 ? [bushMap[bestSegmentIndex + 1], bushMap[bestSegmentIndex], Math.min(1, 0.5 + 0.5 * endBlendFactor)] : [bushMap[bestSegmentIndex], bushMap[bestSegmentIndex + 1], 0.5 - 0.5 * endBlendFactor]
    }
    return segmentProjectionRatio < blendHalfWidth && bestSegmentIndex > 0 ? [bushMap[bestSegmentIndex], bushMap[bestSegmentIndex - 1], 0.5 + (0.5 * segmentProjectionRatio) / blendHalfWidth] : [bushMap[bestSegmentIndex], bushMap[bestSegmentIndex], 1]
  }
}

function hitImpactPulse(hitTime, pulseDuration = 0.22) {
  if (hitTime < 0 || hitTime >= pulseDuration) return 0
  const hitProgress = hitTime / pulseDuration
  return Math.min(1, hitProgress * 7) * (1 - hitProgress) * (1 - hitProgress)
}

const GLIMWING_FULL_TURN = Math.PI * 2,
  GLIMWING_CLOTH = 2054758,
  GLIMWING_CLOTH_SHADE = 7334104,
  GLIMWING_CRYSTAL_HOT = 16767088,
  GLIMWING_CRYSTAL_MID = 16747098,
  GLIMWING_FUR = 15261896,
  GLIMWING_HIDE = 6969978,
  GLIMWING_ANTENNA = 13172720,
  GLIMWING_CRYSTAL = 1714746

/**
 * 创建防御塔与模型。
 *
 * @returns 结果对象
 */
function buildTowerModel() {
  const skeleton = new NodeTree(),
    rootJoint = skeleton.add("root", -1, 0, 0, 0),
    bodyJoint = skeleton.add("body", rootJoint, 0, 1.15, 0.08),
    abdomenFrontJoint = skeleton.add("abd1", bodyJoint, 0, 1.12, -0.14),
    abdomenRearJoint = skeleton.add("abd2", abdomenFrontJoint, 0, 1.08, -0.38),
    headJoint = skeleton.add("head", bodyJoint, 0, 1.2, 0.3),
    antennaJoints = [1, -1].map((antennaSide) => skeleton.add(`ant${antennaSide}`, headJoint, antennaSide * 0.07, 1.3, 0.4)),
    frontWingJoints = [1, -1].map((frontWingSide) => skeleton.add(`fw${frontWingSide}`, bodyJoint, frontWingSide * 0.1, 1.22, 0.14)),
    hindWingJoints = [1, -1].map((hindWingSide) => skeleton.add(`hw${hindWingSide}`, bodyJoint, hindWingSide * 0.1, 1.18, -0.04)),
    tailJoints = [1, -1].map((tailSide) => {
      const tailBaseJoint = skeleton.add(`tail${tailSide}a`, hindWingJoints[tailSide > 0 ? 0 : 1], tailSide * 0.6, 1.14, -0.84),
        tailTipJoint = skeleton.add(`tail${tailSide}b`, tailBaseJoint, tailSide * 0.66, 1.1, -1.14)
      return (skeleton.chain({ joints: [tailBaseJoint, tailTipJoint], tip: [tailSide * 0.04, -0.04, -0.3], stiffness: 9, drag: 0.9, gravity: 4, maxAngle: 70, wind: 2 }), [tailBaseJoint, tailTipJoint])
    }),
    modelBuilder = new ModelBuilder()
  modelBuilder.crease = 60
  const matConfig = { mat: MATERIAL_KINDS.fur, pattern: TERRAIN_LOOK.fur, patternScale: 14, patternAmt: 0.5, grain: 0.06 }
  ;(modelBuilder.bone(bodyJoint).paint(GLIMWING_FUR, { c2: 16775396, by: (furCoordX, furCoordY, furCoordZ, furGradient, furNormalX, furNormalY) => smoothStep01(-0.2, 0.8, furNormalY), ...matConfig }),
    modelBuilder.ball(0, 1.16, 0.1, 0.17, 0.16, 0.23, 1),
    modelBuilder.paint(16775396, { ...matConfig }),
    modelBuilder.g(composeMatrix(0, 1.19, 0.2, 90, 0, 0), () =>
      modelBuilder.lathe(
        [
          [0, 0.15],
          [0.07, 0.23],
          [0.1, 0.11],
        ],
        { seg: 9, shape: (revolveAngle) => 1 + 0.14 * Math.sin(revolveAngle * 9) },
      ),
    ))
  const BoneChainProjectorValue = makeBoneChainProjector(skeleton, [bodyJoint, abdomenFrontJoint, abdomenRearJoint], 0.8, [0, 1.04, -0.62]),
    furStripePattern = (plaza, stripeCoordY, stripeCoordZ) => (Math.sin((stripeCoordZ + 0.02) * 30) > 0.25 ? 1 : 0)
  ;(modelBuilder.bind(BoneChainProjectorValue).paint(GLIMWING_FUR, { c2: GLIMWING_HIDE, by: furStripePattern, ...matConfig }),
    modelBuilder.tube(
      [
        [0, 1.14, -0.04, 0.17, 0.16],
        [0, 1.12, -0.12, 0.165, 0.16],
        [0, 1.115, -0.2, 0.16, 0.155],
        [0, 1.105, -0.28, 0.15, 0.145],
        [0, 1.095, -0.36, 0.135, 0.13],
        [0, 1.08, -0.44, 0.115, 0.11],
        [0, 1.065, -0.52, 0.085, 0.08],
        [0, 1.045, -0.62, 0.02, 0.02],
      ],
      { seg: 8, up: [1, 0, 0], cap0: !1 },
    ),
    modelBuilder.bone(bodyJoint).paint(GLIMWING_HIDE, { mat: MATERIAL_KINDS.leather }),
    modelBuilder.sym(() => {
      for (let tendrilIndex = 0; tendrilIndex < 3; tendrilIndex++)
        modelBuilder.tube(
          [
            [0.1, 1.04, 0.2 - tendrilIndex * 0.12, 0.02],
            [0.17, 0.92, 0.26 - tendrilIndex * 0.13, 0.014],
            [0.13, 0.84, 0.3 - tendrilIndex * 0.1, 0.004],
          ],
          { seg: 3 },
        )
    }),
    modelBuilder.bone(headJoint).paint(GLIMWING_FUR, { ...matConfig }),
    modelBuilder.ball(0, 1.2, 0.34, 0.12, 0.115, 0.12, 1),
    modelBuilder.sym((mirrorSide) => {
      ;(modelBuilder.paint(GLIMWING_CRYSTAL, { c2: 3828362, gloss: 1, mat: MATERIAL_KINDS.crystal }),
        modelBuilder.ball(0.08, 1.215, 0.4, 0.048, 0.052, 0.045, 1),
        modelBuilder.bone(antennaJoints[mirrorSide > 0 ? 0 : 1]).paint(GLIMWING_ANTENNA, { c2: 15794168, glow: 0.15, glow2: 0.45, mat: MATERIAL_KINDS.cloth, line: 1 }),
        modelBuilder.tube(
          [
            [0.07, 1.3, 0.4, 0.012],
            [0.16, 1.48, 0.56, 0.01],
            [0.3, 1.56, 0.78, 0.004],
          ],
          { seg: 3 },
        ),
        modelBuilder.sheet(4, 1, (membraneU, membraneV) => {
          const membraneBase = [lerpValue(0.08, 0.3, membraneU), lerpValue(1.32, 1.56, Math.sin(membraneU * 1.4)), lerpValue(0.42, 0.78, membraneU)],
            membraneRibWidth = 0.085 * Math.sin(Math.min(1, membraneU * 1.15) * Math.PI) * (1 + 0.2 * Math.sin(membraneU * 30))
          return [membraneBase[0] + (membraneV - 0.5) * 2 * membraneRibWidth * 0.8, membraneBase[1] + (membraneV - 0.5) * 2 * membraneRibWidth * 0.2, membraneBase[2] - (membraneV - 0.5) * 2 * membraneRibWidth * 0.5]
        }),
        modelBuilder.bone(headJoint))
    }))
  const paintClothPattern = () => {
      modelBuilder.paint(GLIMWING_CLOTH, { c2: GLIMWING_CLOTH_SHADE, glow: 0.03, glow2: 0.3, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.vein, patternScale: 8, patternAmt: 0.6, by: (clothCoordX, clothCoordY, clothCoordZ, clothGradient) => Math.max(clothGradient * clothGradient, smoothStep01(0.75, 1.3, Math.abs(clothCoordX))) })
    },
    addCrystalSpike = (label, spikeY, spikeZ, spikeHeight) => {
      ;(modelBuilder.paint(GLIMWING_CRYSTAL_MID, { glow: 0.45, mat: MATERIAL_KINDS.crystal, line: 0 }),
        modelBuilder.g(composeMatrix(label, spikeY, spikeZ), () =>
          modelBuilder.lathe(
            [
              [-0.012, spikeHeight],
              [0.012, spikeHeight],
            ],
            { seg: 8 },
          ),
        ),
        modelBuilder.paint(GLIMWING_CRYSTAL_HOT, { glow: 0.8, mat: MATERIAL_KINDS.crystal, line: 0 }),
        modelBuilder.g(composeMatrix(label, spikeY, spikeZ), () =>
          modelBuilder.lathe(
            [
              [-0.02, spikeHeight * 0.6],
              [0.02, spikeHeight * 0.6],
            ],
            { seg: 8 },
          ),
        ),
        modelBuilder.paint(GLIMWING_CRYSTAL, { mat: MATERIAL_KINDS.crystal, line: 0 }),
        modelBuilder.g(composeMatrix(label, spikeY, spikeZ), () =>
          modelBuilder.lathe(
            [
              [-0.026, spikeHeight * 0.24],
              [0.026, spikeHeight * 0.24],
            ],
            { seg: 6 },
          ),
        ))
    }
  ;(modelBuilder.sym((bodySide) => {
    const bodySideIndex = bodySide > 0 ? 0 : 1
    ;(modelBuilder.bone(frontWingJoints[bodySideIndex]),
      paintClothPattern(),
      modelBuilder.sheet(5, 3, (wingMembraneU, wingMembraneV) => {
        const wingOuterProfile = [lerpValue(0.1, 1.36, wingMembraneU), 1.22 + 0.1 * Math.sin(wingMembraneU * Math.PI) + 0.05 * wingMembraneU, lerpValue(0.2, 0.7, Math.pow(wingMembraneU, 0.7))],
          wingInnerProfile = [lerpValue(0.1, 1.02, wingMembraneU), 1.2 + 0.03 * wingMembraneU, lerpValue(0.02, -0.3, wingMembraneU) + 0.08 * Math.sin(wingMembraneU * Math.PI * 2.5) * wingMembraneU]
        return [lerpValue(wingOuterProfile[0], wingInnerProfile[0], wingMembraneV), lerpValue(wingOuterProfile[1], wingInnerProfile[1], wingMembraneV) - 0.04 * Math.sin(wingMembraneV * Math.PI), lerpValue(wingOuterProfile[2], wingInnerProfile[2], wingMembraneV)]
      }),
      modelBuilder.paint(GLIMWING_CLOTH, { c2: GLIMWING_CLOTH_SHADE, mat: MATERIAL_KINDS.leather }),
      modelBuilder.tube(
        [
          [0.1, 1.23, 0.2, 0.022],
          [0.76, 1.33, 0.54, 0.016],
          [1.36, 1.275, 0.7, 0.005],
        ],
        { seg: 4 },
      ),
      addCrystalSpike(0.84, 1.275, 0.24, 0.15),
      modelBuilder.bone(hindWingJoints[bodySideIndex]),
      paintClothPattern(),
      modelBuilder.sheet(4, 3, (tailMembraneU, tailMembraneV) => {
        const tailOuterProfile = [lerpValue(0.1, 1, tailMembraneU), 1.19 + 0.03 * tailMembraneU, lerpValue(-0.02, -0.34, tailMembraneU)],
          tailInnerProfile = [lerpValue(0.08, 0.6, tailMembraneU), 1.15, lerpValue(-0.2, -0.86, Math.sin((tailMembraneU * Math.PI) / 2))]
        return [lerpValue(tailOuterProfile[0], tailInnerProfile[0], tailMembraneV) + 0.08 * Math.sin(tailMembraneV * Math.PI) * tailMembraneU, lerpValue(tailOuterProfile[1], tailInnerProfile[1], tailMembraneV) - 0.03 * Math.sin(tailMembraneV * Math.PI), lerpValue(tailOuterProfile[2], tailInnerProfile[2], tailMembraneV)]
      }),
      addCrystalSpike(0.6, 1.178, -0.42, 0.11),
      modelBuilder.bind(makeBoneChainProjector(skeleton, tailJoints[bodySideIndex], 0.8, [bodySide * 0.7, 1.06, -1.44])),
      modelBuilder.paint(GLIMWING_CLOTH_SHADE, { c2: 15269880, glow: 0.3, glow2: 0.6, mat: MATERIAL_KINDS.cloth, line: 1 }),
      modelBuilder.sheet(1, 4, (finU, finV) => {
        const finHalfWidth = 0.06 * (1 - finV * 0.75) + (finV > 0.8 ? 0.05 * (finV - 0.8) * 5 : 0)
        return [0.6 + 0.1 * finV + (finU - 0.5) * 2 * finHalfWidth, 1.14 - 0.08 * finV, -0.84 - 0.6 * finV]
      }))
  }),
    modelBuilder.bakeGrounding(1.6, 0.85, 1))
  const animateGlimwing = (rigBuilder, world, appearanceState) => {
    const animPhase = world.time + world.seed * 6.3,
      isGuarding = (world.mode & 2) !== 0
    let swayRate = isGuarding ? 7 : 4,
      motionAmplitude = 1,
      limbTilt = 0,
      rootBobOffset = Math.sin((animPhase * GLIMWING_FULL_TURN) / 1.6) * 0.12,
      total = 1 + 0.15 * Math.sin(animPhase * 3) + (isGuarding ? 0.3 : 0)
    switch (((appearanceState.tint = 0.1), (appearanceState.tintColor = world.seed > 0.5 ? 10479871 : 13172656), world.anim)) {
      case "dead": {
        const timeValue = world.t,
          smoothedDeathProgress = hermiteSmoothStep(inverseLerpClamped(timeValue, 0.05, 0.8))
        ;((motionAmplitude = 1 - inverseLerpClamped(timeValue, 0, 0.25)),
          (rootBobOffset *= motionAmplitude),
          (limbTilt = -0.25 * smoothedDeathProgress),
          rigBuilder.pos(rootJoint, Math.sin(smoothedDeathProgress * 7) * 0.3 * (1 - smoothedDeathProgress), -1.05 * smoothedDeathProgress, 0),
          rigBuilder.rot(rootJoint, 12 * Math.sin(smoothedDeathProgress * 9) * (1 - smoothedDeathProgress), smoothedDeathProgress * 300, 18 * Math.sin(smoothedDeathProgress * 8 + 1) * (1 - smoothedDeathProgress)),
          rigBuilder.rot(abdomenFrontJoint, 14 * smoothedDeathProgress, 0, 0),
          (total = Math.max(0.03, 1 - inverseLerpClamped(timeValue, 0.5, 1))),
          (appearanceState.tint = 0.1 + 0.4 * inverseLerpClamped(timeValue, 0.6, 1.1)),
          (appearanceState.tintColor = 8949920))
        break
      }
      case "attack": {
        const windupEaseCurveResult = windupEaseCurve(world.p, world.windup),
          easeOutQuadResult = easeOutQuad(inverseLerpClamped(windupEaseCurveResult, 0, 0.3)),
          strikeOnsetRatio = inverseLerpClamped(windupEaseCurveResult, 0.3, 0.38),
          strikeRecoveryEase = hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.5, 1)),
          attackWindupWeight = easeOutQuadResult * (1 - strikeOnsetRatio),
          attackStrikeWeight = strikeOnsetRatio * (1 - strikeRecoveryEase)
        ;(rigBuilder.rot(bodyJoint, -26 * attackWindupWeight + 18 * attackStrikeWeight, 0, 0), rigBuilder.pos(rootJoint, 0, 0.14 * attackWindupWeight, -0.2 * attackWindupWeight + 0.26 * attackStrikeWeight), (motionAmplitude = 1 - 0.85 * Math.max(attackWindupWeight, attackStrikeWeight)), (limbTilt = 0.75 * attackWindupWeight - 0.5 * attackStrikeWeight), (total += 0.4 * attackWindupWeight + 0.8 * smoothFalloff(windupEaseCurveResult, 0.36, 0.14)))
        break
      }
      case "move": {
        ;(rigBuilder.rot(bodyJoint, 20, 0, 0), (swayRate = 5.5))
        break
      }
      case "stunned": {
        ;(rigBuilder.rot(rootJoint, 0, 0, Math.sin(animPhase * 8) * 12), rigBuilder.rot(headJoint, 20, Math.sin(animPhase * 7) * 20, 0), (rootBobOffset -= 0.3), (motionAmplitude = 0.5))
        break
      }
      case "airborne": {
        ;(rigBuilder.rot(rootJoint, -30 * Math.sin(world.p * Math.PI), 0, 20), (limbTilt = 0.4))
        break
      }
      default:
        if (world.spawnT >= 0) {
          const spawnProgress = world.spawnT / 1,
            spawnEase = 1 - easeOutQuad(inverseLerpClamped(spawnProgress, 0, 0.9)),
            spawnSpinAngle = spawnEase * 5.5 + world.seed * 3
          ;(rigBuilder.pos(rootJoint, Math.sin(spawnSpinAngle) * 1.6 * spawnEase, 1.9 * spawnEase, Math.cos(spawnSpinAngle) * 1.6 * spawnEase - 0.8 * spawnEase), rigBuilder.rot(rootJoint, 0, (-spawnSpinAngle * 180) / Math.PI + 90 * spawnEase, -28 * spawnEase), (swayRate = 7), (total += 0.6 * spawnEase))
        } else (rigBuilder.rot(bodyJoint, Math.sin(animPhase * 0.9) * 4, Math.sin(animPhase * 0.5) * 8, 0), rigBuilder.rot(headJoint, 0, Math.sin(animPhase * 0.7 + 1) * 14, 0))
    }
    const hitImpactStrength = hitImpactPulse(world.hitT, 0.3)
    ;(hitImpactStrength > 0 && world.anim !== "dead" && (rigBuilder.move(rootJoint, 0, 0.1 * hitImpactStrength, -0.4 * hitImpactStrength), rigBuilder.add(rootJoint, -50 * hitImpactStrength, 0, (world.seed > 0.5 ? 1 : -1) * 40 * hitImpactStrength)), rigBuilder.move(rootJoint, 0, rootBobOffset, 0))
    const flutterPhase = animPhase * swayRate * GLIMWING_FULL_TURN,
      wingFlutter = Math.sin(flutterPhase) * motionAmplitude,
      hindWingFlutter = Math.sin(flutterPhase - 0.8) * motionAmplitude
    for (let index = 0; index < 2; index++) {
      const sideSign = index === 0 ? 1 : -1
      ;(rigBuilder.rot(frontWingJoints[index], 0, sideSign * -12 * limbTilt, sideSign * (10 + wingFlutter * 40 + limbTilt * 60)),
        rigBuilder.rot(hindWingJoints[index], 0, sideSign * 10 * limbTilt, sideSign * (4 + hindWingFlutter * 32 + limbTilt * 50)),
        rigBuilder.rot(antennaJoints[index], Math.sin(animPhase * 2.3 + index) * 8 - 10 * limbTilt, sideSign * Math.sin(animPhase * 1.7 + index * 2) * 8, 0))
    }
    ;(rigBuilder.add(bodyJoint, -wingFlutter * 3, 0, 0), rigBuilder.add(abdomenFrontJoint, 6 + Math.sin(animPhase * 2.1) * 5 + wingFlutter * 3, 0, 0), rigBuilder.add(abdomenRearJoint, 8 + Math.sin(animPhase * 2.1 - 0.7) * 6, 0, 0), (appearanceState.glow = total))
  }
  return {
    key: "monster:glimwing",
    geometry: modelBuilder.build(),
    rig: skeleton,
    height: 1.9,
    radius: 1.05,
    scale: 0.86,
    stride: 1.5,
    triangles: modelBuilder.triangleCount,
    deathDur: 1.2,
    spawnDur: 1,
    outline: 1.3,
    attach: {
      chest: { joint: bodyJoint, x: 0, y: 0, z: 0 },
      head: { joint: headJoint, x: 0, y: 0.08, z: 0.1 },
      muzzle: { joint: headJoint, x: 0, y: -0.04, z: 0.26 },
      weapon: { joint: headJoint, x: 0, y: -0.04, z: 0.26 },
      wingL: { joint: frontWingJoints[0], x: 1.2, y: 0.05, z: 0.5 },
      wingR: { joint: frontWingJoints[1], x: -1.2, y: 0.05, z: 0.5 },
      tail: { joint: abdomenRearJoint, x: 0, y: -0.04, z: -0.24 },
    },
    blend: (lastAnim, attackKind) => (attackKind === "attack" ? 0.08 : 0.14),
    animate: animateGlimwing,
  }
}

export { inverseLerpClamped, makeBoneChainProjector, hermiteSmoothStep, hitImpactPulse, easeOutQuad, windupEaseCurve, smoothFalloff, buildTowerModel, squareValue }