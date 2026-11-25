/**
 * 英雄预览渲染器（选英雄界面 3D 预览）：gB -> createHeroPreview 闭包
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { ACESFilmicToneMapping, Color, DirectionalLight, FloatType, HemisphereLight, Mesh, PCFSoftShadowMap, PerspectiveCamera, PointLight, SRGBColorSpace, Scene, WebGLRenderer } from 'three'
import { BODY_PROPORTIONS, BODY_ANCHOR_HEIGHTS, SkeletonSolver, DEG_TO_RAD, HERO_MODEL_SCALE } from '../ships/skeleton-solver'
import { solveTwoBoneIK, accumulateAncestorTransform, multiplyQuaternions, SCRATCH_QUAT_B, SCRATCH_QUAT_A, ANCESTOR_INDEX_CHAIN } from '../fx/effect-spawner'
import { buildFxSpritePose, copyPoseInto, clampUnitInput, bellPulseWindow, lerpNumeric, remapSmoothStep } from './fx-sprite'
import { buildRangerModel, buildFrostGolemModel, buildArcherModel, buildTeamTowerModel, buildSuperMinionModel, buildMeleeMinionModel, buildStarColossusModel, buildSwordsmanModel, buildXiangYuModel, buildMageModel, buildAbyssDrakeModel, buildMossbackModel, buildEmberGolemModel, buildShieldBearerModel } from '../models'
import { DEATH_POSE_TUNING, applyDeathPose } from './unit-poses'
import { MATERIAL_KINDS, ModelBuilder, applyBreathingPose, composeMatrix } from './model-builder'
import { buildFenglingPoseSet } from './unit-poses-extra3'
import { UNIT_MODEL_SCALE } from '../unit-model-config'
import { buildXingliPoseSet } from './unit-poses-extra2'
import { buildYequePoseSet } from './unit-poses-extra'
import { buildTeamBaseModel } from '../ships/yw-component'
import { buildTeamBaseRuinModel } from '../ships/team-base-variant'
import { createMaterialState, createToonMaterial, SHARED_SCRATCH_QUATERNION } from './foundation'
import { buildStructureModelA } from '../ships/zu-component'
import { buildStructureModelB } from '../ships/qu-component'
import { buildTowerModel } from '../world/po-system'
import { ARENA_PALETTE } from '../arena-palette'
import { HERO_TABLE } from '../../heroes/registry'
import { OutlineRegistry } from './scene-rigs'
import { __heroRow } from '../ui/banner'

const IDENTITY_QUAT_SCRATCH = [0, 0, 0, 1]

function setEulerQuat(targetObject, propertyName, value, targetQuatArray, quatOffset) {
  const halfXRad = targetObject * DEG_TO_RAD * 0.5,
    halfYRad = propertyName * DEG_TO_RAD * 0.5,
    halfZRad = value * DEG_TO_RAD * 0.5,
    cosHalfX = Math.cos(halfXRad),
    cosHalfY = Math.cos(halfYRad),
    cosHalfZ = Math.cos(halfZRad),
    sinHalfX = Math.sin(halfXRad),
    sinHalfY = Math.sin(halfYRad),
    sinHalfZ = Math.sin(halfZRad)
  ;((targetQuatArray[quatOffset] = sinHalfX * cosHalfY * cosHalfZ + cosHalfX * sinHalfY * sinHalfZ), (targetQuatArray[quatOffset + 1] = cosHalfX * sinHalfY * cosHalfZ - sinHalfX * cosHalfY * sinHalfZ), (targetQuatArray[quatOffset + 2] = cosHalfX * cosHalfY * sinHalfZ - sinHalfX * sinHalfY * cosHalfZ), (targetQuatArray[quatOffset + 3] = cosHalfX * cosHalfY * cosHalfZ + sinHalfX * sinHalfY * sinHalfZ))
}

class TransformStack {
  constructor(jointCount) {
    ;((this.n = jointCount), (this.q = new Float32Array(jointCount * 4)), (this.t = new Float32Array(jointCount * 3)), (this.s = new Float32Array(jointCount)), this.reset())
  }
  n
  q
  t
  s
  reset() {
    ;(this.q.fill(0), this.t.fill(0), this.s.fill(1))
    for (let index = 0; index < this.n; index++) this.q[index * 4 + 3] = 1
    return this
  }
  rot(jointIndex, eulerX, eulerY = 0, eulerZ = 0) {
    return (setEulerQuat(eulerX, eulerY, eulerZ, this.q, jointIndex * 4), this)
  }
  add(pelvis, eulerX, eulerY = 0, chestY = 0) {
    return (setEulerQuat(eulerX, eulerY, chestY, IDENTITY_QUAT_SCRATCH, 0), multiplyQuaternions(this.q, pelvis * 4, IDENTITY_QUAT_SCRATCH, 0, this.q, pelvis * 4), this)
  }
  pre(jointIndex, eulerX, eulerY = 0, eulerZ = 0) {
    return (setEulerQuat(eulerX, eulerY, eulerZ, IDENTITY_QUAT_SCRATCH, 0), multiplyQuaternions(IDENTITY_QUAT_SCRATCH, 0, this.q, jointIndex * 4, this.q, jointIndex * 4), this)
  }
  pos(jointIndex, posX, posY, posZ) {
    return ((this.t[jointIndex * 3] = posX), (this.t[jointIndex * 3 + 1] = posY), (this.t[jointIndex * 3 + 2] = posZ), this)
  }
  move(jointIndex, deltaX, deltaY, deltaZ) {
    return ((this.t[jointIndex * 3] += deltaX), (this.t[jointIndex * 3 + 1] += deltaY), (this.t[jointIndex * 3 + 2] += deltaZ), this)
  }
  scale(jointIndex, scaleFactor) {
    return ((this.s[jointIndex] = scaleFactor), this)
  }
  copy(sourceStack) {
    return (this.q.set(sourceStack.q), this.t.set(sourceStack.t), this.s.set(sourceStack.s), this)
  }
  blendFrom(sourceStack, blendWeight) {
    const sourceQuats = sourceStack.q,
      qState = this.q,
      inverseWeight = 1 - blendWeight
    for (let total = 0; total < this.n * 4; total += 4) {
      const hemisphereWeight = sourceQuats[total] * qState[total] + sourceQuats[total + 1] * qState[total + 1] + sourceQuats[total + 2] * qState[total + 2] + sourceQuats[total + 3] * qState[total + 3] < 0 ? -inverseWeight : inverseWeight,
        blendX = sourceQuats[total] * hemisphereWeight + qState[total] * blendWeight,
        blendY = sourceQuats[total + 1] * hemisphereWeight + qState[total + 1] * blendWeight,
        blendZ = sourceQuats[total + 2] * hemisphereWeight + qState[total + 2] * blendWeight,
        blendW = sourceQuats[total + 3] * hemisphereWeight + qState[total + 3] * blendWeight,
        distance = Math.hypot(blendX, blendY, blendZ, blendW) || 1
      ;((qState[total] = blendX / distance), (qState[total + 1] = blendY / distance), (qState[total + 2] = blendZ / distance), (qState[total + 3] = blendW / distance))
    }
    for (let translationIndex = 0; translationIndex < this.n * 3; translationIndex++) this.t[translationIndex] = sourceStack.t[translationIndex] * inverseWeight + this.t[translationIndex] * blendWeight
    for (let scaleIndex = 0; scaleIndex < this.n; scaleIndex++) this.s[scaleIndex] = sourceStack.s[scaleIndex] * inverseWeight + this.s[scaleIndex] * blendWeight
    return this
  }
}

function aimPropAtTarget(poseStack, propJoint, aimQuat, eulerX, eulerY, eulerZ) {
  ;(setEulerQuat(eulerX, eulerY, eulerZ, SCRATCH_QUAT_A, 0), (SCRATCH_QUAT_B[0] = -aimQuat[0]), (SCRATCH_QUAT_B[1] = -aimQuat[1]), (SCRATCH_QUAT_B[2] = -aimQuat[2]), (SCRATCH_QUAT_B[3] = aimQuat[3]), multiplyQuaternions(SCRATCH_QUAT_B, 0, SCRATCH_QUAT_A, 0, poseStack.q, propJoint * 4))
}

function easeAnimationPhase(phase, windup) {
  const phaseBreakpoint = Math.min(0.6, Math.max(0.15, windup))
  return phase < phaseBreakpoint ? (phase / phaseBreakpoint) * 0.35 : 0.35 + ((phase - phaseBreakpoint) / (1 - phaseBreakpoint)) * 0.65
}

function lerpPoseVector(outVector, fromVector, toVector, lerpRatio) {
  for (let index = 0; index < outVector.length; index++) outVector[index] = fromVector[index] + (toVector[index] - fromVector[index]) * lerpRatio
}

function blendPoseKeyframes(outPose, fromPose, toPose, blendRatio) {
  return (lerpPoseVector(outPose.e, fromPose.e, toPose.e, blendRatio), lerpPoseVector(outPose.hips, fromPose.hips, toPose.hips, blendRatio), lerpPoseVector(outPose.footL, fromPose.footL, toPose.footL, blendRatio), lerpPoseVector(outPose.footR, fromPose.footR, toPose.footR, blendRatio), lerpPoseVector(outPose.root, fromPose.root, toPose.root, blendRatio), outPose)
}

function samplePoseTrack(poseTrack, phase, outPose) {
  if (phase <= poseTrack[0].t) return copyPoseInto(outPose, poseTrack[0].k)
  for (let index = 1; index < poseTrack.length; index++) {
    const selectedN = poseTrack[index]
    if (phase <= selectedN.t) {
      const previousKeyframe = poseTrack[index - 1]
      return blendPoseKeyframes(outPose, previousKeyframe.k, selectedN.k, selectedN.ease((phase - previousKeyframe.t) / (selectedN.t - previousKeyframe.t)))
    }
  }
  return copyPoseInto(outPose, poseTrack[poseTrack.length - 1].k)
}

const PoleVectorAxis = [0, 0, 0, 1],
  ARM_IK_POSITION_SCRATCH = [0, 0, 0],
  ARM_IK_QUAT_SCRATCH = [0, 0, 0, 1]

function poseLegIk(heroModel, poseStack, side, legWidth, poleX, poleY, footYaw = 0, footPitch = 0) {
  const jointSpec = heroModel.J,
    thighJoint = side > 0 ? jointSpec.thighL : jointSpec.thighR,
    shinJoint = side > 0 ? jointSpec.shinL : jointSpec.shinR,
    footJoint = side > 0 ? jointSpec.footL : jointSpec.footR,
    footPitchRad = (footPitch * Math.PI) / 180
  ;(solveTwoBoneIK(heroModel.rig, poseStack, thighJoint, shinJoint, footJoint, legWidth, poleX, poleY, Math.sin(footPitchRad) + side * 0.12, 0.1, Math.cos(footPitchRad), 1, PoleVectorAxis), aimPropAtTarget(poseStack, footJoint, PoleVectorAxis, footYaw, footPitch, 0))
}

function poseArmIk(heroModel, poseStack, side, chestJoint, handX, handY, handZ, poleX = side * 0.6, poleY = -0.6, poleZ = -0.5) {
  const jointMap = heroModel.J
  accumulateAncestorTransform(heroModel.rig, poseStack, chestJoint, ARM_IK_POSITION_SCRATCH, ARM_IK_QUAT_SCRATCH)
  const selectedARM_IK_QUAT_SCRATCH = ARM_IK_QUAT_SCRATCH[0],
    ancestorQuatY = ARM_IK_QUAT_SCRATCH[1],
    ancestorQuatZ = ARM_IK_QUAT_SCRATCH[2],
    ancestorQuatW = ARM_IK_QUAT_SCRATCH[3],
    crossX = 2 * (ancestorQuatY * handZ - ancestorQuatZ * handY),
    crossY = 2 * (ancestorQuatZ * handX - selectedARM_IK_QUAT_SCRATCH * handZ),
    crossZ = 2 * (selectedARM_IK_QUAT_SCRATCH * handY - ancestorQuatY * handX),
    ikTargetX = ARM_IK_POSITION_SCRATCH[0] + handX + ancestorQuatW * crossX + (ancestorQuatY * crossZ - ancestorQuatZ * crossY),
    ikTargetY = ARM_IK_POSITION_SCRATCH[1] + handY + ancestorQuatW * crossY + (ancestorQuatZ * crossX - selectedARM_IK_QUAT_SCRATCH * crossZ),
    ikTargetZ = ARM_IK_POSITION_SCRATCH[2] + handZ + ancestorQuatW * crossZ + (selectedARM_IK_QUAT_SCRATCH * crossY - ancestorQuatY * crossX)
  solveTwoBoneIK(heroModel.rig, poseStack, side > 0 ? jointMap.armL : jointMap.armR, side > 0 ? jointMap.foreL : jointMap.foreR, side > 0 ? jointMap.handL : jointMap.handR, ikTargetX, ikTargetY, ikTargetZ, poleX, poleY, poleZ, -1)
}

function slerpQuatToward(targetQuats, targetOffset, sourceQuats, sourceOffset, blendWeight) {
  const quatDot = targetQuats[targetOffset] * sourceQuats[sourceOffset] + targetQuats[targetOffset + 1] * sourceQuats[sourceOffset + 1] + targetQuats[targetOffset + 2] * sourceQuats[sourceOffset + 2] + targetQuats[targetOffset + 3] * sourceQuats[sourceOffset + 3],
    slerpScale = (1 - blendWeight) * (quatDot < 0 ? -1 : 1),
    slerpX = sourceQuats[sourceOffset] * slerpScale + targetQuats[targetOffset] * blendWeight,
    slerpY = sourceQuats[sourceOffset + 1] * slerpScale + targetQuats[targetOffset + 1] * blendWeight,
    slerpZ = sourceQuats[sourceOffset + 2] * slerpScale + targetQuats[targetOffset + 2] * blendWeight,
    slerpW = sourceQuats[sourceOffset + 3] * slerpScale + targetQuats[targetOffset + 3] * blendWeight,
    distance = Math.hypot(slerpX, slerpY, slerpZ, slerpW) || 1
  ;((targetQuats[targetOffset] = slerpX / distance), (targetQuats[targetOffset + 1] = slerpY / distance), (targetQuats[targetOffset + 2] = slerpZ / distance), (targetQuats[targetOffset + 3] = slerpW / distance))
}

function applyBasePoseToStack(heroModel, poseStack, basePose, postPoseCallback?) {
  const jointCount = heroModel.rig.count,
    eulerChannel = basePose.e
  for (let index = 0; index < jointCount; index++) {
    const selectedO = eulerChannel[index * 3],
      eulerY = eulerChannel[index * 3 + 1],
      eulerZ = eulerChannel[index * 3 + 2]
    ;(selectedO !== 0 || eulerY !== 0 || eulerZ !== 0) && poseStack.rot(index, selectedO, eulerY, eulerZ)
  }
  ;(poseStack.pos(heroModel.J.hips, basePose.hips[0], basePose.hips[1], basePose.hips[2]),
    poseStack.pos(heroModel.J.root, basePose.root[0], basePose.root[1], basePose.root[2]),
    postPoseCallback && postPoseCallback(),
    poseLegIk(heroModel, poseStack, 1, basePose.footL[0], basePose.footL[1], basePose.footL[2], basePose.footL[3], basePose.footL[4]),
    poseLegIk(heroModel, poseStack, -1, basePose.footR[0], basePose.footR[1], basePose.footR[2], basePose.footR[3], basePose.footR[4]))
}

const DEFAULT_GAIT_CONFIG = { stride: 2.6, stance: 0.36, lift: 0.26, bob: 0.045, drop: 0.07, lean: 12, sway: 0.03, twist: 9, width: 0.13, arm: 38, elbow: 70 },
  GAIT_CYCLE_RADIANS = Math.PI * 2

function computeFootCycle(cyclePhase, gaitConfig, ankleHeight, outFootPose) {
  const stanceRatio = gaitConfig.stance,
    strideLength = gaitConfig.stride * stanceRatio,
    forwardReach = strideLength * 0.42,
    backwardReach = -strideLength * 0.58
  if (cyclePhase < stanceRatio) {
    const stanceProgress = cyclePhase / stanceRatio
    ;((outFootPose[0] = lerpNumeric(forwardReach, backwardReach, stanceProgress)), (outFootPose[1] = ankleHeight + 0.03 * stanceProgress * stanceProgress), (outFootPose[2] = lerpNumeric(-14, 26, stanceProgress * stanceProgress)))
  } else {
    const swingProgress = (cyclePhase - stanceRatio) / (1 - stanceRatio),
      swingEase = swingProgress * swingProgress * (3 - 2 * swingProgress)
    ;((outFootPose[0] = lerpNumeric(backwardReach, forwardReach, swingEase)),
      (outFootPose[1] = ankleHeight + gaitConfig.lift * Math.sin(Math.PI * Math.pow(swingProgress, 0.8)) + gaitConfig.lift * 0.55 * Math.sin(Math.PI * swingProgress) * (1 - swingProgress)),
      (outFootPose[2] = lerpNumeric(26, -14, swingEase) + 34 * Math.sin(Math.PI * swingProgress) * (1 - swingProgress)))
  }
}

const FOOT_CYCLE_SCRATCH = [0, 0, 0]

function applyWalkPose(heroModel, poseStack, stridePhase, gaitConfig, armSwingCallback) {
  const jointMap = heroModel.J,
    durationValue = heroModel.d,
    stanceRatio = gaitConfig.stance,
    cycleCos = Math.cos(GAIT_CYCLE_RADIANS * stridePhase),
    upperBodyPhase = stridePhase - stanceRatio * 0.5,
    bodyBob = -gaitConfig.bob * Math.cos(2 * GAIT_CYCLE_RADIANS * upperBodyPhase)
  ;(poseStack.pos(jointMap.hips, gaitConfig.sway * Math.cos(GAIT_CYCLE_RADIANS * upperBodyPhase), -gaitConfig.drop + bodyBob, 0),
    poseStack.rot(jointMap.hips, gaitConfig.lean * 0.45, -gaitConfig.twist * cycleCos, -2.5 * Math.cos(GAIT_CYCLE_RADIANS * upperBodyPhase)),
    poseStack.rot(jointMap.spine, gaitConfig.lean * 0.35, gaitConfig.twist * 0.9 * cycleCos, 0),
    poseStack.rot(jointMap.chest, gaitConfig.lean * 0.2, gaitConfig.twist * 0.9 * cycleCos, 0),
    poseStack.rot(jointMap.neck, -gaitConfig.lean * 0.3, -gaitConfig.twist * 0.4 * cycleCos, 0),
    poseStack.rot(jointMap.head, -gaitConfig.lean * 0.3, -gaitConfig.twist * 0.3 * cycleCos, 0),
    gaitConfig.arm > 0 && (poseStack.rot(jointMap.armL, gaitConfig.arm * cycleCos + 8, 0, 8), poseStack.rot(jointMap.foreL, -gaitConfig.elbow + 18 * cycleCos, 0, 0), poseStack.rot(jointMap.armR, -gaitConfig.arm * cycleCos + 8, 0, -8), poseStack.rot(jointMap.foreR, -gaitConfig.elbow - 18 * cycleCos, 0, 0)),
    armSwingCallback && armSwingCallback(),
    computeFootCycle(stridePhase % 1, gaitConfig, durationValue.ankleY, FOOT_CYCLE_SCRATCH),
    poseLegIk(heroModel, poseStack, 1, gaitConfig.width, FOOT_CYCLE_SCRATCH[1], FOOT_CYCLE_SCRATCH[0], FOOT_CYCLE_SCRATCH[2], 0),
    computeFootCycle((stridePhase + 0.5) % 1, gaitConfig, durationValue.ankleY, FOOT_CYCLE_SCRATCH),
    poseLegIk(heroModel, poseStack, -1, -gaitConfig.width, FOOT_CYCLE_SCRATCH[1], FOOT_CYCLE_SCRATCH[0], FOOT_CYCLE_SCRATCH[2], 0))
}

/**
 * 更新状态与配置。
 *
 * @param heroModel - 主要输入
 * @param poseStack - 次要输入
 * @param stateName - 第三输入
 * @param deathTime - 第四输入
 * @param phase - 附加输入
 * @param time - 附加输入
 * @param commonPoses - 输入
 */
function applySpecialStatePose(heroModel, poseStack, stateName, deathTime, phase, time, commonPoses) {
  const jointMap = heroModel.J
  switch (stateName) {
    case "stunned":
      return (
        applyBasePoseToStack(heroModel, poseStack, commonPoses.stun, () => {
          const stunWobblePhase = time * 5.2
          ;(poseStack.add(jointMap.hips, Math.sin(stunWobblePhase) * 4, 0, Math.cos(stunWobblePhase) * 5), poseStack.add(jointMap.chest, Math.cos(stunWobblePhase) * 3, 0, Math.sin(stunWobblePhase) * 3), poseStack.add(jointMap.head, Math.cos(stunWobblePhase * 1.1) * 6, 0, Math.sin(stunWobblePhase * 1.1) * 8))
        }),
        !0
      )
    case "airborne":
      return (
        applyBasePoseToStack(heroModel, poseStack, commonPoses.air, () => {
          poseStack.add(jointMap.hips, -14 * Math.sin(phase * Math.PI) + 10 * phase, 0, 6 * Math.sin(phase * 9))
        }),
        !0
      )
    case "dead":
      return (samplePoseTrack(commonPoses.dead, clampUnitInput(deathTime / 1.5), commonPoses.tmp), applyBasePoseToStack(heroModel, poseStack, commonPoses.tmp), !0)
    default:
      return !1
  }
}

const IK_TARGET_SCRATCH = [0, 0, 0],
  PROP_AIM_QUAT_SCRATCH = [0, 0, 0, 1],
  BOW_ARM_QUAT_SCRATCH = new Float32Array(8)

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildChijinModel() {
  const { h: heroModel, b: modelBuilder, extra: attachmentJoints } = buildSwordsmanModel(),
    applyDeathPoseResult = applyDeathPose(heroModel),
    jointMap = heroModel.J,
    rig = heroModel.rig,
    scratchPose = applyDeathPoseResult.tmp,
    Value = modelBuilder.build(),
    gripROffset = attachmentJoints.gripR * 3,
    aimOffset = attachmentJoints.aim * 3,
    gripLOffset = attachmentJoints.gripL * 3,
    applyBowPose = (cooldown, eulerChannels, aimWeight = 0) => {
      if ((poseArmIk(heroModel, cooldown, -1, jointMap.chest, eulerChannels[gripROffset], eulerChannels[gripROffset + 1], eulerChannels[gripROffset + 2], -0.7, -0.55, -0.45), accumulateAncestorTransform(rig, cooldown, jointMap.handR, IK_TARGET_SCRATCH, PROP_AIM_QUAT_SCRATCH), aimPropAtTarget(cooldown, jointMap.propR, PROP_AIM_QUAT_SCRATCH, eulerChannels[aimOffset], eulerChannels[aimOffset + 1], eulerChannels[aimOffset + 2]), aimWeight !== 0)) {
        const propPoseQuats = cooldown.q,
          propQuatOffset = jointMap.propR * 4,
          selectedG = propPoseQuats[propQuatOffset],
          propQuatY = propPoseQuats[propQuatOffset + 1],
          propQuatZ = propPoseQuats[propQuatOffset + 2],
          propQuatW = propPoseQuats[propQuatOffset + 3]
        cooldown.pos(jointMap.propR, 2 * (selectedG * propQuatZ + propQuatW * propQuatY) * -aimWeight, 2 * (propQuatY * propQuatZ - propQuatW * selectedG) * -aimWeight, (1 - 2 * (selectedG * selectedG + propQuatY * propQuatY)) * -aimWeight)
      }
      const selectedM = eulerChannels[gripLOffset]
      if (!(selectedM < -0.5) && (poseArmIk(heroModel, cooldown, 1, jointMap.hips, 0.262, 0.09, 0.07, 1, -0.15, -0.6), selectedM > 0.01)) {
        const bowArmQuats = cooldown.q
        for (let index = 0; index < 4; index++) ((BOW_ARM_QUAT_SCRATCH[index] = bowArmQuats[jointMap.armL * 4 + index]), (BOW_ARM_QUAT_SCRATCH[4 + index] = bowArmQuats[jointMap.foreL * 4 + index]))
        ;(poseArmIk(heroModel, cooldown, 1, jointMap.propR, 0, 0, eulerChannels[gripLOffset + 1], 0.7, -0.6, -0.25), selectedM < 0.99 && (slerpQuatToward(bowArmQuats, jointMap.armL * 4, BOW_ARM_QUAT_SCRATCH, 0, selectedM), slerpQuatToward(bowArmQuats, jointMap.foreL * 4, BOW_ARM_QUAT_SCRATCH, 4, selectedM)))
      }
    },
    animateHero = (label, animState, renderOutput) => {
      const commonPoses = applyDeathPoseResult.common
      if (applySpecialStatePose(heroModel, label, animState.anim === "leap" ? "airborne" : animState.anim, animState.t, animState.p, animState.time, commonPoses)) {
        ;(applyBowPose(label, (animState.anim === "dead" ? commonPoses.tmp : animState.anim === "stunned" ? commonPoses.stun : commonPoses.air).e), animState.anim === "dead" && (renderOutput.glow = Math.max(0.15, 1 - animState.t * 1.2)))
        return
      }
      switch (animState.anim) {
        case "move": {
          ;(applyWalkPose(heroModel, label, animState.stride, DEATH_POSE_TUNING, () => {
            const strideCos = Math.cos(animState.stride * Math.PI * 2)
            ;(label.add(jointMap.chest, 0, 0, strideCos * 3), label.add(jointMap.head, 0, 0, -strideCos * 2))
          }),
            copyPoseInto(scratchPose, applyDeathPoseResult.carry),
            (scratchPose.e[aimOffset] += Math.sin(animState.stride * Math.PI * 4) * 2.5),
            applyBowPose(label, scratchPose.e))
          break
        }
        case "attack": {
          const easeAnimationPhaseResult = easeAnimationPhase(animState.p, animState.windup),
            isAltAttack = (animState.mode & 1) !== 0
          ;(samplePoseTrack(isAltAttack ? applyDeathPoseResult.atkX : animState.variant % 2 === 0 ? applyDeathPoseResult.atkA : applyDeathPoseResult.atkB, easeAnimationPhaseResult, scratchPose), applyBasePoseToStack(heroModel, label, scratchPose), applyBowPose(label, scratchPose.e), (renderOutput.glow = 1 + (isAltAttack ? 3.2 : 1.4) * bellPulseWindow(easeAnimationPhaseResult, 0.36, 0.2)))
          break
        }
        case "cast_s1": {
          ;(samplePoseTrack(applyDeathPoseResult.s1, animState.p, scratchPose), applyBasePoseToStack(heroModel, label, scratchPose), applyBowPose(label, scratchPose.e), (renderOutput.glow = 1 + 2.4 * bellPulseWindow(animState.p, 0.42, 0.3)))
          break
        }
        case "cast_s2":
        case "dash": {
          ;(applyBasePoseToStack(heroModel, label, applyDeathPoseResult.dash), applyBowPose(label, applyDeathPoseResult.dash.e), (renderOutput.glow = 2.4))
          break
        }
        case "cast_ult": {
          ;(samplePoseTrack(applyDeathPoseResult.ult, animState.p, scratchPose), applyBasePoseToStack(heroModel, label, scratchPose), applyBowPose(label, scratchPose.e), (renderOutput.glow = 1 + 1.6 * animState.p))
          break
        }
        case "spin": {
          ;(copyPoseInto(scratchPose, applyDeathPoseResult.spin),
            applyBasePoseToStack(heroModel, label, scratchPose, () => {
              const timeValue = animState.t,
                spinAngle = timeValue < 0.15 ? ((timeValue * timeValue) / 0.3) * 2.4 : (timeValue - 0.075) * 2.4
              ;(label.rot(jointMap.root, 0, -spinAngle * 360, 0), label.add(jointMap.spine, 0, 0, 4 * Math.sin(timeValue * 9)))
            }),
            applyBowPose(label, scratchPose.e),
            (renderOutput.glow = 2.6))
          break
        }
        case "channel": {
          ;(applyBasePoseToStack(heroModel, label, applyDeathPoseResult.channel, () => {
            applyBreathingPose(heroModel, label, animState.time, animState.seed, 0.8)
          }),
            applyBowPose(label, applyDeathPoseResult.channel.e, 0.5),
            (renderOutput.glow = 1 + 0.5 * (0.5 + 0.5 * Math.sin(animState.time * 5))))
          break
        }
        default: {
          copyPoseInto(scratchPose, applyDeathPoseResult.stance)
          const pulsePhase = (animState.time * 0.28 + animState.seed) % 1,
            bellPulseWindowResult = bellPulseWindow(pulsePhase, 0.5, 0.06)
          ;((scratchPose.e[gripROffset + 1] += bellPulseWindowResult * 0.035),
            (scratchPose.e[aimOffset] += bellPulseWindowResult * 5 + Math.sin(animState.time * 1.3) * 1.2),
            applyBasePoseToStack(heroModel, label, scratchPose, () => {
              applyBreathingPose(heroModel, label, animState.time, animState.seed, 1.2)
            }),
            applyBowPose(label, scratchPose.e),
            (renderOutput.glow = 1 + 0.12 * Math.sin(animState.time * 3)))
        }
      }
    }
  return {
    key: "hero:chijin",
    geometry: Value,
    rig: heroModel.rig,
    height: 2.3,
    radius: 0.64,
    scale: HERO_MODEL_SCALE,
    stride: DEATH_POSE_TUNING.stride * HERO_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.25, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.08, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.07, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.07, z: 0 },
      weapon: { joint: jointMap.propR, x: 0, y: -0.4, z: BODY_ANCHOR_HEIGHTS.head },
      muzzle: { joint: jointMap.propR, x: 0, y: -0.4, z: BODY_ANCHOR_HEIGHTS.head },
    },
    blend: (dashKind, attackKind) => (attackKind === "attack" || attackKind === "dash" || attackKind === "cast_s2" ? 0.07 : attackKind === "dead" ? 0.05 : dashKind === "dash" || dashKind === "spin" ? 0.18 : 0.13),
    animate: animateHero,
  }
}

const ROBE_COSTUME_PALETTE = {
    robe: 3108728,
    robeDark: 1919570,
    pants: 2832704,
    pantsDark: 1713451,
    wrap: 12168850,
    wrapDark: 8747874,
    leather: 9069112,
    leatherDark: 5914146,
    leatherLight: 11107660,
    iron: 5857643,
    ironLight: 9410723,
    brass: 13212229,
    brassDark: 9069862,
    skin: 14263678,
    hair: 2763310,
    hairHi: 6974064,
    cap: 1841952,
    capHi: 3815490,
    pheasant: 10515010,
    pheasantTip: 2759698,
    lining: 15327951,
    liningShade: 12564126,
    lacquer: 3811874,
    lacquerDark: 1905938,
    bone: 15260864,
    silk: 11547690,
    shaft: 13150304,
    head: 6975608,
    feather: 16052712,
    featherShade: 13223094,
    jade: 15134688,
  },
  FENGLING_RIG_PROPORTIONS = { ...BODY_PROPORTIONS, hipX: 0.125, shoulderX: 0.31, clavX: 0.09, elbowY: 1.05, wristY: 0.76, handY: 0.67 },
  FENGLING_MODEL_SCALE = 1.2,
  FENGLING_DEG_TO_RAD = Math.PI / 180,
  FENGLING_BOW_SPEC = { tip: 0.86, string: 0.2 }

const CHIJIN_GAIT_CONFIG = { ...DEFAULT_GAIT_CONFIG, stride: 2.8, stance: 0.33, lift: 0.28, bob: 0.05, drop: 0.05, lean: 14, twist: 9, width: 0.12, arm: 0 }

const CHIJIN_QUAT_SCRATCH = new Float32Array(8),
  FENGLING_HAND_IK_SCRATCH = [0, 0, 0],
  FENGLING_BOW_AIM_QUAT = [0, 0, 0, 1],
  FENGLING_BOW_AIM_EULER = [-125, -48, 0]

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildFenglingModel() {
  const { h: heroModel, b: modelBuilder, extra: attachmentJoints } = buildArcherModel(),
    FenglingPoseSetValue = buildFenglingPoseSet(heroModel),
    jointMap = heroModel.J,
    scratchPose = FenglingPoseSetValue.tmp,
    buildValue = modelBuilder.build(),
    applyBowShot = (poseStack, drawPhase, shotDuration, drawAmount, aimPose) => {
      const remapSmoothStepResult = remapSmoothStep(drawPhase, 0, shotDuration * 0.42),
        releaseRamp = remapSmoothStep(drawPhase, Math.min(0.9, shotDuration + 0.3), 1),
        releaseBlend = remapSmoothStepResult * remapSmoothStepResult * (3 - 2 * remapSmoothStepResult) * (1 - releaseRamp * releaseRamp * (3 - 2 * releaseRamp))
      blendPoseKeyframes(scratchPose, FenglingPoseSetValue.stance, aimPose, releaseBlend)
      const isDrawing = drawPhase < shotDuration
      let nockOffset = 0
      if (isDrawing) {
        const drawRemap = remapSmoothStep(drawPhase, shotDuration * 0.3, shotDuration * 0.95)
        nockOffset = drawAmount * (1 - (1 - drawRemap) * (1 - drawRemap))
      } else {
        const releasePhase = (drawPhase - shotDuration) / 0.12
        nockOffset = releasePhase < 1 ? -0.035 * Math.sin(releasePhase * Math.PI * 2.5) * (1 - releasePhase) : 0
      }
      ;(applyBasePoseToStack(heroModel, poseStack, scratchPose), poseStack.pos(attachmentJoints.nock, 0, nockOffset, 0))
      const bowBendAngle = (nockOffset / 0.5) * 16
      if ((poseStack.rot(attachmentJoints.bowUp, -bowBendAngle, 0, 0), poseStack.rot(attachmentJoints.bowDn, bowBendAngle, 0, 0), poseStack.scale(attachmentJoints.arrow, isDrawing && drawPhase > shotDuration * 0.2 ? Math.min(1, remapSmoothStep(drawPhase, shotDuration * 0.2, shotDuration * 0.3) * 1.2) : 0), releaseBlend > 0.02))
        if (isDrawing) {
          const armBlend = remapSmoothStep(drawPhase, shotDuration * 0.1, shotDuration * 0.34),
            bowArmQuats = poseStack.q
          for (let index = 0; index < 4; index++) ((CHIJIN_QUAT_SCRATCH[index] = bowArmQuats[jointMap.armR * 4 + index]), (CHIJIN_QUAT_SCRATCH[4 + index] = bowArmQuats[jointMap.foreR * 4 + index]))
          ;(poseArmIk(heroModel, poseStack, -1, attachmentJoints.nock, 0, 0.06, 0, -0.3, 0.55, -1), armBlend < 1 && (slerpQuatToward(bowArmQuats, jointMap.armR * 4, CHIJIN_QUAT_SCRATCH, 0, armBlend), slerpQuatToward(bowArmQuats, jointMap.foreR * 4, CHIJIN_QUAT_SCRATCH, 4, armBlend)))
        } else {
          const releaseArmBlend = remapSmoothStep(drawPhase, shotDuration, shotDuration + 0.16),
            handTargetY = 0.5 + 0.35 * releaseArmBlend
          poseArmIk(heroModel, poseStack, -1, attachmentJoints.nock, 0.02, handTargetY * releaseBlend + 0.06, 0.04 * releaseArmBlend, -0.3, 0.55, -1)
        }
      return isDrawing ? remapSmoothStep(drawPhase, shotDuration * 0.3, shotDuration) : Math.max(0, 1 - (drawPhase - shotDuration) / 0.15)
    },
    animateHero = (poseStack, animState, renderOutput) => {
      if ((poseStack.scale(attachmentJoints.arrow, 0), applySpecialStatePose(heroModel, poseStack, animState.anim === "leap" ? "airborne" : animState.anim, animState.t, animState.p, animState.time, FenglingPoseSetValue.common))) {
        animState.anim === "dead" && (renderOutput.glow = Math.max(0.15, 1 - animState.t * 1.2))
        return
      }
      switch (animState.anim) {
        case "move": {
          applyWalkPose(heroModel, poseStack, animState.stride, CHIJIN_GAIT_CONFIG, () => {
            const eulerChannel = FenglingPoseSetValue.runArms.e,
              strideCos = Math.cos(animState.stride * Math.PI * 2)
            ;(poseStack.rot(jointMap.armL, eulerChannel[jointMap.armL * 3] + strideCos * 6, 0, eulerChannel[jointMap.armL * 3 + 2]),
              poseStack.rot(jointMap.foreL, eulerChannel[jointMap.foreL * 3], 0, 0),
              poseStack.rot(jointMap.propL, eulerChannel[jointMap.propL * 3] + strideCos * 3, 0, eulerChannel[jointMap.propL * 3 + 2]),
              poseStack.rot(jointMap.armR, eulerChannel[jointMap.armR * 3] - strideCos * 34, 0, eulerChannel[jointMap.armR * 3 + 2]),
              poseStack.rot(jointMap.foreR, eulerChannel[jointMap.foreR * 3] - strideCos * 14, 0, 0))
          })
          break
        }
        case "attack": {
          const rResult = applyBowShot(poseStack, easeAnimationPhase(animState.p, animState.windup), 0.35, 0.54, FenglingPoseSetValue.aim)
          renderOutput.glow = 1 + rResult * ((animState.mode & 1) !== 0 ? 2.2 : 0.9)
          break
        }
        case "cast_s1": {
          const rRResult = applyBowShot(poseStack, animState.p, 0.4, 0.62, FenglingPoseSetValue.aimLow),
            castLift = animState.p > 0.4 ? Math.sin(remapSmoothStep(animState.p, 0.4, 0.62) * Math.PI) : 0
          ;(poseStack.add(jointMap.propL, 0, 0, -castLift * 10), poseStack.add(jointMap.armL, 0, castLift * 6, 0), (renderOutput.glow = 1 + rRResult * 2.4))
          break
        }
        case "cast_ult": {
          const shotGlow = applyBowShot(poseStack, animState.p, 0.4, 0.58, FenglingPoseSetValue.aimUp)
          renderOutput.glow = 1 + shotGlow * 2.6
          break
        }
        case "cast_s2":
        case "dash": {
          ;(applyBasePoseToStack(heroModel, poseStack, FenglingPoseSetValue.tuck, () => {
            const dashPhase = animState.anim === "dash" ? animState.p : 0,
              dashAngle = dashPhase * Math.PI * 2,
              hopHeight = 0.7
            ;(poseStack.rot(jointMap.root, 360 * dashPhase, 0, 0), poseStack.pos(jointMap.root, 0, hopHeight * (1 - Math.cos(dashAngle)) + 0.15 * Math.sin(dashPhase * Math.PI), -hopHeight * Math.sin(dashAngle)))
          }),
            (renderOutput.glow = 1.8))
          break
        }
        case "spin":
        case "channel": {
          ;(applyBasePoseToStack(heroModel, poseStack, FenglingPoseSetValue.channel, () => applyBreathingPose(heroModel, poseStack, animState.time, animState.seed, 0.6)), poseArmIk(heroModel, poseStack, -1, jointMap.handL, -0.02, 0.1, 0.05, -0.6, -0.4, 0.6), (renderOutput.glow = 1 + 0.4 * (0.5 + 0.5 * Math.sin(animState.time * 5))))
          break
        }
        default:
          ;(applyBasePoseToStack(heroModel, poseStack, FenglingPoseSetValue.stance, () => {
            ;(applyBreathingPose(heroModel, poseStack, animState.time, animState.seed), poseStack.add(jointMap.hips, 0, 0, Math.sin(animState.time * 0.8 + animState.seed * 4) * 1.2))
          }),
            accumulateAncestorTransform(heroModel.rig, poseStack, jointMap.handL, FENGLING_HAND_IK_SCRATCH, FENGLING_BOW_AIM_QUAT),
            aimPropAtTarget(poseStack, jointMap.propL, FENGLING_BOW_AIM_QUAT, FENGLING_BOW_AIM_EULER[0] + Math.sin(animState.time * 1.1) * 2, FENGLING_BOW_AIM_EULER[1], FENGLING_BOW_AIM_EULER[2]),
            (renderOutput.glow = 1 + 0.08 * Math.sin(animState.time * 2.6)))
      }
    }
  return {
    key: "hero:fengling",
    geometry: buildValue,
    rig: heroModel.rig,
    height: 2.06,
    radius: 0.58,
    scale: FENGLING_MODEL_SCALE,
    stride: CHIJIN_GAIT_CONFIG.stride * FENGLING_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.25, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.08, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.07, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.07, z: 0 },
      weapon: { joint: jointMap.propL, x: 0, y: -0.2, z: 0 },
      muzzle: { joint: jointMap.propL, x: 0, y: -0.5, z: 0 },
    },
    blend: (lastAnimName, attackKindName) => (attackKindName === "attack" ? 0.06 : attackKindName === "dash" || attackKindName === "dead" ? 0.05 : 0.13),
    animate: animateHero,
  }
}

const FENGLING_GAIT_CONFIG = { ...DEFAULT_GAIT_CONFIG, stride: 2.9, stance: 0.44, lift: 0.22, bob: 0.07, drop: 0.08, lean: 10, sway: 0.06, twist: 7, width: 0.22, arm: 0 },
  PANYUE_GAIT_CONFIG = { ...FENGLING_GAIT_CONFIG, lean: 30, drop: 0.16, bob: 0.03, stance: 0.36, lift: 0.26 }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildPanyueModel() {
  const { h: heroModel, b: modelBuilder } = buildShieldBearerModel(),
    FxSpritePoseValue = buildFxSpritePose(heroModel),
    jointMap = heroModel.J,
    scratchPose = FxSpritePoseValue.tmp,
    Result = modelBuilder.build(),
    animateHero = /**
 * 处理事件。
 *
 * @param detail - 输入
 * @param animState - 战场
 * @param renderOutput - 第三输入
 */
(detail, animState, renderOutput) => {
      if (applySpecialStatePose(heroModel, detail, animState.anim, animState.t, animState.p, animState.time, FxSpritePoseValue.common)) {
        animState.anim === "dead" && (renderOutput.glow = Math.max(0.12, 1 - animState.t * 1.1))
        return
      }
      const isGuarding = (animState.mode & 2) !== 0
      switch (animState.anim) {
        case "move": {
          applyWalkPose(heroModel, detail, animState.stride, FENGLING_GAIT_CONFIG, () => {
            const eulerChannel = (isGuarding ? FxSpritePoseValue.guard : FxSpritePoseValue.runArms).e,
              strideCos = Math.cos(animState.stride * Math.PI * 2)
            ;(detail.rot(jointMap.armL, eulerChannel[jointMap.armL * 3] + strideCos * 5, 0, eulerChannel[jointMap.armL * 3 + 2]),
              detail.rot(jointMap.foreL, eulerChannel[jointMap.foreL * 3], eulerChannel[jointMap.foreL * 3 + 1], 0),
              detail.rot(jointMap.armR, eulerChannel[jointMap.armR * 3] - strideCos * 12, 0, eulerChannel[jointMap.armR * 3 + 2]),
              detail.rot(jointMap.foreR, eulerChannel[jointMap.foreR * 3], 0, 0),
              detail.rot(jointMap.propR, FxSpritePoseValue.runArms.e[jointMap.propR * 3] - strideCos * 5, FxSpritePoseValue.runArms.e[jointMap.propR * 3 + 1], 0))
          })
          break
        }
        case "attack": {
          const easedPhase = easeAnimationPhase(animState.p, animState.windup),
            attackPoseTrack = (animState.mode & 1) !== 0 ? FxSpritePoseValue.slam : animState.variant % 2 === 0 ? FxSpritePoseValue.atkA : FxSpritePoseValue.atkB
          ;(samplePoseTrack(attackPoseTrack, easedPhase, scratchPose), applyBasePoseToStack(heroModel, detail, scratchPose), (renderOutput.glow = 1 + ((animState.mode & 1) !== 0 ? 2.2 : 1.2) * bellPulseWindow(easedPhase, 0.36, 0.2)))
          break
        }
        case "cast_s1":
        case "dash": {
          ;(applyWalkPose(heroModel, detail, animState.t * 3.4, PANYUE_GAIT_CONFIG, () => {
            const eulerChannel = FxSpritePoseValue.charge.e
            for (const limbJoint of [jointMap.armL, jointMap.foreL, jointMap.armR, jointMap.foreR, jointMap.propR]) detail.rot(limbJoint, eulerChannel[limbJoint * 3], eulerChannel[limbJoint * 3 + 1], eulerChannel[limbJoint * 3 + 2])
            detail.add(jointMap.head, eulerChannel[jointMap.head * 3], 0, 0)
          }),
            (renderOutput.glow = 1.8))
          break
        }
        case "cast_s2": {
          ;(samplePoseTrack(FxSpritePoseValue.s2, animState.p, scratchPose), applyBasePoseToStack(heroModel, detail, scratchPose), (renderOutput.glow = 1 + 2 * bellPulseWindow(animState.p, 0.55, 0.3)))
          break
        }
        case "cast_ult":
        case "leap": {
          ;(samplePoseTrack(FxSpritePoseValue.leap, animState.p, scratchPose), applyBasePoseToStack(heroModel, detail, scratchPose), (renderOutput.glow = 1.6 + 1.6 * animState.p))
          break
        }
        case "spin":
        case "channel": {
          ;(applyBasePoseToStack(heroModel, detail, FxSpritePoseValue.channel, () => applyBreathingPose(heroModel, detail, animState.time, animState.seed, 0.8)), (renderOutput.glow = 1 + 0.5 * (0.5 + 0.5 * Math.sin(animState.time * 5))))
          break
        }
        default:
          ;(applyBasePoseToStack(heroModel, detail, isGuarding ? FxSpritePoseValue.guard : FxSpritePoseValue.stance, () => {
            ;(applyBreathingPose(heroModel, detail, animState.time * 0.75, animState.seed, 1.5), detail.add(jointMap.propR, Math.sin(animState.time * 1.1) * 2, 0, 0))
          }),
            (renderOutput.glow = (isGuarding ? 1.5 : 1) + 0.15 * Math.sin(animState.time * 2.2)))
      }
    }
  return {
    key: "hero:panyue",
    geometry: Result,
    rig: heroModel.rig,
    height: 2.3,
    radius: 0.66,
    scale: UNIT_MODEL_SCALE,
    stride: FENGLING_GAIT_CONFIG.stride * UNIT_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.28, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.06, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.1, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.1, z: 0 },
      weapon: { joint: jointMap.propR, x: 0, y: 0, z: 0.95 },
      muzzle: { joint: jointMap.propR, x: 0, y: 0, z: 0.95 },
    },
    blend: (leapKind, incomingAttackKind) => (incomingAttackKind === "attack" ? 0.09 : incomingAttackKind === "dash" || incomingAttackKind === "leap" ? 0.08 : incomingAttackKind === "dead" ? 0.05 : leapKind === "leap" ? 0.2 : 0.16),
    animate: animateHero,
  }
}

const RANGER_PALETTE = {
    cloak: 11150408,
    cloakDark: 7345975,
    cloakLight: 13124202,
    fur: 16447472,
    furShade: 13225949,
    robe: 15986144,
    robeShade: 13353910,
    hem: 14129824,
    trim: 3104124,
    trimDark: 2048088,
    skin: 16176578,
    hair: 1841698,
    hairHi: 3814472,
    gold: 15777888,
    goldDark: 11830834,
    lip: 13121610,
    wood: 14860426,
    woodShade: 13081954,
    woodDark: 12089658,
    woodDeep: 8145446,
    string: 16771512,
  },
  XINGLI_RIG_PROPORTIONS = { ...BODY_PROPORTIONS, hipX: 0.105, shoulderX: 0.265, clavX: 0.08 },
  XINGLI_MODEL_SCALE = 1.16,
  YEQUE_DEG_TO_RAD = Math.PI / 180

const WALK_ANIM_CONFIG = { ...DEFAULT_GAIT_CONFIG, stride: 2.1, stance: 0.42, lift: 0.14, bob: 0.028, drop: 0.03, lean: 11, twist: 4, sway: 0.02, width: 0.1, arm: 0 }

const XINGLI_QUAT_SCRATCH = new Float32Array(8)

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildXingliModel() {
  const { h: heroModel, b: modelBuilder, extra: attachmentJoints } = buildRangerModel(),
    XingliPoseSetValue = buildXingliPoseSet(heroModel),
    jointMap = heroModel.J,
    scratchPose = XingliPoseSetValue.tmp,
    geometry = modelBuilder.build(),
    pipaPosOffset = attachmentJoints.pipaPos * 3,
    pluckOffset = attachmentJoints.pluck * 3,
    freeOffset = attachmentJoints.free * 3,
    [axisXVector, axisYVector, axisZVector] = attachmentJoints.ax,
    applyPipaPose = (plaza, eulerChannels, tremoloOffset = 0) => {
      plaza.pos(attachmentJoints.pipa, eulerChannels[pipaPosOffset], eulerChannels[pipaPosOffset + 1], eulerChannels[pipaPosOffset + 2])
      const armPoseQuats = plaza.q,
        leftHandBlend = 1 - clampUnitInput(eulerChannels[freeOffset + 1])
      if (leftHandBlend > 0.01) {
        for (let index = 0; index < 4; index++) ((XINGLI_QUAT_SCRATCH[index] = armPoseQuats[jointMap.armL * 4 + index]), (XINGLI_QUAT_SCRATCH[4 + index] = armPoseQuats[jointMap.foreL * 4 + index]))
        const selectedP = eulerChannels[freeOffset + 2]
        ;(poseArmIk(heroModel, plaza, 1, attachmentJoints.pipa, attachmentJoints.handL[0] + axisYVector[0] * selectedP, attachmentJoints.handL[1] + axisYVector[1] * selectedP, attachmentJoints.handL[2] + axisYVector[2] * selectedP, 0.6, -0.75, -0.3), leftHandBlend < 0.99 && (slerpQuatToward(armPoseQuats, jointMap.armL * 4, XINGLI_QUAT_SCRATCH, 0, leftHandBlend), slerpQuatToward(armPoseQuats, jointMap.foreL * 4, XINGLI_QUAT_SCRATCH, 4, leftHandBlend)))
      }
      const rightHandBlend = 1 - clampUnitInput(eulerChannels[freeOffset])
      if (rightHandBlend > 0.01) {
        for (let quatIndex = 0; quatIndex < 4; quatIndex++) ((XINGLI_QUAT_SCRATCH[quatIndex] = armPoseQuats[jointMap.armR * 4 + quatIndex]), (XINGLI_QUAT_SCRATCH[4 + quatIndex] = armPoseQuats[jointMap.foreR * 4 + quatIndex]))
        const pluckAmount = eulerChannels[pluckOffset],
          pluckOffsetY = eulerChannels[pluckOffset + 1] + tremoloOffset,
          freeAmount = eulerChannels[pluckOffset + 2]
        ;(poseArmIk(heroModel, plaza, -1, attachmentJoints.pipa, attachmentJoints.handR[0] + axisXVector[0] * pluckAmount + axisYVector[0] * pluckOffsetY + axisZVector[0] * freeAmount, attachmentJoints.handR[1] + axisXVector[1] * pluckAmount + axisYVector[1] * pluckOffsetY + axisZVector[1] * freeAmount, attachmentJoints.handR[2] + axisXVector[2] * pluckAmount + axisYVector[2] * pluckOffsetY + axisZVector[2] * freeAmount, -0.75, -0.55, -0.25),
          rightHandBlend < 0.99 && (slerpQuatToward(armPoseQuats, jointMap.armR * 4, XINGLI_QUAT_SCRATCH, 0, rightHandBlend), slerpQuatToward(armPoseQuats, jointMap.foreR * 4, XINGLI_QUAT_SCRATCH, 4, rightHandBlend)))
      }
    },
    animateHero = (poseStack, animState, renderOutput) => {
      const commonPoses = XingliPoseSetValue.common
      if (applySpecialStatePose(heroModel, poseStack, animState.anim === "leap" ? "airborne" : animState.anim, animState.t, animState.p, animState.time, commonPoses)) {
        ;(applyPipaPose(poseStack, (animState.anim === "dead" ? commonPoses.tmp : animState.anim === "stunned" ? commonPoses.stun : commonPoses.air).e), animState.anim === "dead" && (renderOutput.glow = Math.max(0.1, 1 - animState.t * 1.2)))
        return
      }
      let glowBoost = 0,
        tremoloAmount = 0
      switch (animState.anim) {
        case "move":
        case "dash": {
          const eulerChannel = XingliPoseSetValue.run.e
          ;(applyWalkPose(heroModel, poseStack, animState.stride, WALK_ANIM_CONFIG, () => {
            ;(poseStack.add(jointMap.head, eulerChannel[jointMap.head * 3], 0, 0), poseStack.rot(attachmentJoints.pipa, eulerChannel[attachmentJoints.pipa * 3] + Math.sin(animState.stride * Math.PI * 4) * 1.5, 0, eulerChannel[attachmentJoints.pipa * 3 + 2]))
          }),
            applyPipaPose(poseStack, eulerChannel))
          break
        }
        case "attack": {
          const easedPhase = easeAnimationPhase(animState.p, animState.windup)
          ;(samplePoseTrack(XingliPoseSetValue.atk, easedPhase, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applyPipaPose(poseStack, scratchPose.e), (glowBoost = bellPulseWindow(easedPhase, 0.36, 0.2) * 0.7))
          break
        }
        case "cast_s1": {
          ;(samplePoseTrack(XingliPoseSetValue.s1, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applyPipaPose(poseStack, scratchPose.e), (glowBoost = bellPulseWindow(animState.p, 0.44, 0.34)))
          break
        }
        case "cast_s2": {
          ;(samplePoseTrack(XingliPoseSetValue.s2, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applyPipaPose(poseStack, scratchPose.e), (glowBoost = bellPulseWindow(animState.p, 0.5, 0.36)))
          break
        }
        case "cast_ult":
        case "spin": {
          samplePoseTrack(XingliPoseSetValue.ult, animState.p, scratchPose)
          const tremoloEnvelope = Math.min(1, animState.p * 3) * (1 - 0.6 * animState.p)
          ;((tremoloAmount = Math.sin(animState.t * 44) * 0.035 * tremoloEnvelope),
            applyBasePoseToStack(heroModel, poseStack, scratchPose, () => {
              poseStack.add(jointMap.chest, 0, Math.sin(animState.t * 44) * 1.2 * tremoloEnvelope, 0)
            }),
            applyPipaPose(poseStack, scratchPose.e, tremoloAmount),
            (glowBoost = Math.min(1, animState.p * 3) * (0.8 + 0.2 * Math.sin(animState.t * 44))))
          break
        }
        case "channel": {
          ;(applyBasePoseToStack(heroModel, poseStack, XingliPoseSetValue.channel, () => applyBreathingPose(heroModel, poseStack, animState.time, animState.seed, 0.8)), applyPipaPose(poseStack, XingliPoseSetValue.channel.e), (glowBoost = 0.2 + 0.1 * Math.sin(animState.time * 4)))
          break
        }
        default: {
          const idlePulsePhase = (animState.time * 0.36 + animState.seed) % 1,
            idlePulse = bellPulseWindow(idlePulsePhase, 0.5, 0.07)
          ;((tremoloAmount = -idlePulse * 0.05),
            applyBasePoseToStack(heroModel, poseStack, XingliPoseSetValue.stance, () => {
              ;(applyBreathingPose(heroModel, poseStack, animState.time, animState.seed), poseStack.add(jointMap.head, idlePulse * 2, 0, 0), poseStack.add(jointMap.hips, 0, 0, Math.sin(animState.time * 0.8 + animState.seed * 4) * 1.2))
            }),
            applyPipaPose(poseStack, XingliPoseSetValue.stance.e, tremoloAmount),
            (glowBoost = idlePulse * 0.3))
        }
      }
      renderOutput.glow = 1 + glowBoost * 2.6 + 0.08 * Math.sin(animState.time * 2.6)
    }
  return {
    key: "hero:xingli",
    geometry: geometry,
    rig: heroModel.rig,
    height: 2.14,
    radius: 0.6,
    scale: XINGLI_MODEL_SCALE,
    stride: WALK_ANIM_CONFIG.stride * XINGLI_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.25, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.08, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.07, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.07, z: 0 },
      weapon: { joint: attachmentJoints.pipa, x: attachmentJoints.face[0], y: attachmentJoints.face[1], z: attachmentJoints.face[2] },
      muzzle: { joint: attachmentJoints.pipa, x: attachmentJoints.face[0], y: attachmentJoints.face[1], z: attachmentJoints.face[2] },
    },
    blend: (lastAnimLabel, incomingAnimKind) => (incomingAnimKind === "attack" ? 0.08 : incomingAnimKind === "dead" ? 0.05 : incomingAnimKind.startsWith("cast_") ? 0.07 : lastAnimLabel.startsWith("cast_") ? 0.3 : 0.14),
    animate: animateHero,
  }
}

const COSTUME_PALETTE = {
    suit: 2367536,
    suitHi: 4865894,
    suitDark: 1578015,
    sash: 4864632,
    sashDark: 2892360,
    scarf: 15526110,
    scarfShade: 13222836,
    ink: 1709606,
    leather: 4075046,
    leatherLight: 6967360,
    bronze: 11043900,
    bronzeDark: 7230756,
    steel: 10470088,
    steelDark: 6191746,
    edge: 14218482,
    plain: 12106948,
    skin: 14857872,
    hair: 1578524,
    hairHi: 3814980,
    tube: 5909022,
    tubeDark: 3413519,
    silk: 15261638,
    silkShade: 12563092,
  },
  YEQUE_RIG_PROPORTIONS = { ...BODY_PROPORTIONS, hipX: 0.11, shoulderX: 0.275, clavX: 0.08 },
  YEQUE_MODEL_SCALE = 1.17,
  FURL_ROW_COUNT = 5,
  YEQUE_ARM_SPAN_SCALE = 1.05

const YEQUE_GAIT_CONFIG = { ...DEFAULT_GAIT_CONFIG, stride: 3, stance: 0.3, lift: 0.3, bob: 0.04, drop: 0.12, lean: 24, twist: 8, width: 0.1, arm: 0 }

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildYequeModel() {
  const { h: heroModel, b: modelBuilder, extra: e } = buildMageModel(),
    YequePoseSetValue = buildYequePoseSet(heroModel),
    jointMap = heroModel.J,
    scratchPose = YequePoseSetValue.tmp,
    geometry = modelBuilder.build(),
    applyFurlPose = (missing, furlProgress) => {
      const furlPoints = e.furlPts,
        furlRowPosition = Math.min(FURL_ROW_COUNT, Math.max(0, furlProgress * FURL_ROW_COUNT)),
        rowIndex = Math.min(FURL_ROW_COUNT - 1, Math.floor(furlRowPosition)),
        rowFraction = furlRowPosition - rowIndex,
        furlX = furlPoints[rowIndex][0] + (furlPoints[rowIndex + 1][0] - furlPoints[rowIndex][0]) * rowFraction,
        furlY = furlPoints[rowIndex][1] + (furlPoints[rowIndex + 1][1] - furlPoints[rowIndex][1]) * rowFraction,
        furlZ = furlPoints[rowIndex][2] + (furlPoints[rowIndex + 1][2] - furlPoints[rowIndex][2]) * rowFraction
      for (let rowLoopIndex = 1; rowLoopIndex <= FURL_ROW_COUNT; rowLoopIndex++) rowLoopIndex <= furlRowPosition || missing.pos(e.furlRows[rowLoopIndex - 1], furlX - furlPoints[rowLoopIndex][0], furlY - furlPoints[rowLoopIndex][1], furlZ - furlPoints[rowLoopIndex][2])
    },
    animateHero = (poseStack, animState, renderOutput) => {
      if ((poseStack.scale(e.furl, 0), applySpecialStatePose(heroModel, poseStack, animState.anim === "leap" ? "airborne" : animState.anim, animState.t, animState.p, animState.time, YequePoseSetValue.common))) {
        animState.anim === "dead" && (renderOutput.glow = Math.max(0.1, 1 - animState.t * 1.3))
        return
      }
      switch (animState.anim) {
        case "move": {
          applyWalkPose(heroModel, poseStack, animState.stride, YEQUE_GAIT_CONFIG, () => {
            const eulerChannel = YequePoseSetValue.runArms.e,
              strideCos = Math.cos(animState.stride * Math.PI * 2)
            for (const limbJoint of [jointMap.armL, jointMap.foreL, jointMap.propL, jointMap.armR, jointMap.foreR, jointMap.propR]) poseStack.rot(limbJoint, eulerChannel[limbJoint * 3], eulerChannel[limbJoint * 3 + 1], eulerChannel[limbJoint * 3 + 2])
            ;(poseStack.add(jointMap.armL, strideCos * 16, 0, 0), poseStack.add(jointMap.armR, -strideCos * 5, 0, 0))
          })
          break
        }
        case "attack": {
          const easedPhase = easeAnimationPhase(animState.p, animState.windup)
          ;(samplePoseTrack(animState.variant % 2 === 0 ? YequePoseSetValue.atkA : YequePoseSetValue.atkB, easedPhase, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), (renderOutput.glow = 1 + 1.3 * bellPulseWindow(easedPhase, 0.36, 0.2)))
          break
        }
        case "cast_s1":
        case "dash": {
          ;(applyBasePoseToStack(heroModel, poseStack, YequePoseSetValue.dash), (renderOutput.glow = 2.4))
          break
        }
        case "cast_s2": {
          ;(samplePoseTrack(YequePoseSetValue.s2, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), (renderOutput.glow = 1 + 2 * bellPulseWindow(animState.p, 0.45, 0.3)))
          break
        }
        case "cast_ult": {
          ;(samplePoseTrack(YequePoseSetValue.vanish, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose, () => poseStack.rot(jointMap.root, 0, -remapSmoothStep(animState.p, 0.5, 1) * 120, 0)), poseStack.scale(e.furl, Math.min(remapSmoothStep(animState.p, 0.03, 0.09), 1 - remapSmoothStep(animState.p, 0.76, 0.82))))
          const furlVisibility = Math.min(remapSmoothStep(animState.p, 0.07, 0.3), 1 - remapSmoothStep(animState.p, 0.55, 0.77))
          ;(applyFurlPose(poseStack, furlVisibility * (2 - furlVisibility)), (renderOutput.glow = 1 + 2.4 * animState.p))
          break
        }
        case "spin":
        case "channel": {
          ;(applyBasePoseToStack(heroModel, poseStack, YequePoseSetValue.channel, () => applyBreathingPose(heroModel, poseStack, animState.time, animState.seed, 0.6)), (renderOutput.glow = 1 + 0.4 * (0.5 + 0.5 * Math.sin(animState.time * 5))))
          break
        }
        default:
          ;(applyBasePoseToStack(heroModel, poseStack, YequePoseSetValue.stance, () => {
            ;(applyBreathingPose(heroModel, poseStack, animState.time * 0.9, animState.seed, 0.6), poseStack.move(jointMap.hips, Math.sin(animState.time * 1.1 + animState.seed * 5) * 0.006, 0, 0))
          }),
            (renderOutput.glow = 1 + 0.12 * Math.sin(animState.time * 2.4)))
      }
    }
  return {
    key: "hero:yeque",
    geometry: geometry,
    rig: heroModel.rig,
    height: 2.06,
    radius: 0.58,
    scale: YEQUE_MODEL_SCALE,
    stride: YEQUE_GAIT_CONFIG.stride * YEQUE_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.25, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.08, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.07, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.07, z: 0 },
      weapon: { joint: jointMap.propR, x: 0, y: 0, z: -0.46 },
      muzzle: { joint: jointMap.propR, x: 0, y: 0, z: 0 },
    },
    blend: (incomingDashKind, attackKindLabel) => (attackKindLabel === "attack" || attackKindLabel === "dash" ? 0.06 : attackKindLabel === "dead" ? 0.05 : incomingDashKind === "dash" ? 0.14 : 0.12),
    animate: animateHero,
  }
}

const STRUCTURE_MODEL_BUILDERS = {
  "tower:1:0": () => buildTeamTowerModel(1, 0),
  "tower:2:0": () => buildTeamTowerModel(2, 0),
  "tower:3:0": () => buildTeamTowerModel(3, 0),
  "tower:1:1": () => buildTeamTowerModel(1, 1),
  "tower:2:1": () => buildTeamTowerModel(2, 1),
  "tower:3:1": () => buildTeamTowerModel(3, 1),
  "core:0": () => buildTeamBaseModel(0),
  "core:1": () => buildTeamBaseModel(1),
  "ruin:0": () => buildTeamBaseRuinModel(0),
  "ruin:1": () => buildTeamBaseRuinModel(1),
}

function buildNeutralModel() {
  return { anim: "idle", p: 0, t: 0, time: 0, stride: 0, speed: 0, variant: 0, seed: 0, hp: 1, windup: 0.35, mode: 0, deathT: -1, spawnT: -1, hitT: 99, team: 0 }
}

class Animator {
  constructor(modelDef, animSeed = 0) {
    ;((this.def = modelDef), (this.pose = new TransformStack(modelDef.rig.count)), (this.from = new TransformStack(modelDef.rig.count)), (this.skeleton = new SkeletonSolver(modelDef.rig, animSeed)), (this.input.seed = animSeed))
  }
  def
  input = buildNeutralModel()
  output = { glow: 1, tint: 0, tintColor: 16777215 }
  pose
  skeleton
  from
  blendT = 0
  blendDur = 0
  lastAnim = null
  lastKey = NaN
  snap() {
    ;((this.lastAnim = null), (this.blendDur = 0), this.skeleton.resetChains())
  }
  update(animKey, updateValue, rootOffsetX, rootOffsetY, rootOffsetZ, twistAngle, scaleFactor = 1) {
    const animInput = this.input,
      defState = this.def
    if (
      (this.lastAnim !== null && (animInput.anim !== this.lastAnim || animKey !== this.lastKey) && (this.from.copy(this.pose), (this.blendT = 0), (this.blendDur = defState.blend(this.lastAnim, animInput.anim))),
      (this.lastAnim = animInput.anim),
      (this.lastKey = animKey),
      (this.output.glow = 1),
      (this.output.tint = 0),
      this.pose.reset(),
      defState.animate(this.pose, animInput, this.output),
      this.blendT < this.blendDur)
    ) {
      const blendRatio = this.blendT / this.blendDur
      ;(this.pose.blendFrom(this.from, blendRatio * blendRatio * (3 - 2 * blendRatio)), (this.blendT += updateValue))
    }
    ;(this.skeleton.solve(this.pose, rootOffsetX, rootOffsetY, rootOffsetZ, twistAngle, scaleFactor * defState.scale), this.skeleton.simulate(this.pose, updateValue, animInput.time))
  }
  settle() {
    this.skeleton.settle(this.pose, this.input.time)
  }
  attach(ownerId, scratchAttachPoint) {
    const selectedAttach = this.def.attach[ownerId]
    return selectedAttach ? (this.skeleton.point(selectedAttach.joint, selectedAttach.x, selectedAttach.y, selectedAttach.z, scratchAttachPoint), !0) : !1
  }
}

const XIANGYU_COLOR_PALETTE = {
  robe: 0x232b36, robeDark: 0x141922,
  pants: 0x1b222b, pantsDark: 0x0f141a,
  wrap: 0x3a4552, wrapDark: 0x222a33,
  leather: 0x2b241c, leatherDark: 0x16110a, leatherLight: 0x6a6050,
  iron: 0x3a434f, ironDark: 0x222a34, ironLight: 0x9aa8b8,
  brass: 0xe2b444, brassDark: 0x8f6c1e,
  skin: 0xcfa184, hair: 0x15110e,
  beard: 0x191a1d, beardHi: 0x4a4c54,
  cap: 0x243040, capHi: 0xe2b444,
  pheasant: 0xd9b13c, pheasantTip: 0xf6e2a0,
  lining: 0x2a3441, liningShade: 0x151b23,
  lacquer: 0x171c22, lacquerDark: 0x0b0e12,
  silk: 0x2f3a47,
  shaft: 0x303842, shaftDark: 0x161b21,
  steel: 0xbcc6d2, steelDark: 0x5f6a76,
  tassel: 0xc62330, tasselDark: 0x6f1017,
  red: 0x8e2026, redDark: 0x4a0e12, redLight: 0xc23a3f,
}

const ALTERNATE_COLOR_PALETTE = XIANGYU_COLOR_PALETTE

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildXiangyuModel() {
  const { h: heroModel, b: modelBuilder, extra: e } = buildXiangYuModel(),
    deathPoseSet = applyDeathPose(heroModel),
    jointMap = heroModel.J,
    rig = heroModel.rig,
    scratchPose = deathPoseSet.tmp,
    geometry = modelBuilder.build(),
    gripROffset = e.gripR * 3,
    aimOffset = e.aim * 3,
    gripLOffset = e.gripL * 3,
    applySwordPose = (poseStack, eulerChannels, aimWeight = 0) => {
      if ((poseArmIk(heroModel, poseStack, -1, jointMap.chest, eulerChannels[gripROffset], eulerChannels[gripROffset + 1], eulerChannels[gripROffset + 2], -0.7, -0.55, -0.45), accumulateAncestorTransform(rig, poseStack, jointMap.handR, IK_TARGET_SCRATCH, PROP_AIM_QUAT_SCRATCH), aimPropAtTarget(poseStack, jointMap.propR, PROP_AIM_QUAT_SCRATCH, eulerChannels[aimOffset], eulerChannels[aimOffset + 1], eulerChannels[aimOffset + 2]), aimWeight !== 0)) {
        const propPoseQuats = poseStack.q,
          propQuatOffset = jointMap.propR * 4,
          propQuatX = propPoseQuats[propQuatOffset],
          propQuatY = propPoseQuats[propQuatOffset + 1],
          propQuatZ = propPoseQuats[propQuatOffset + 2],
          propQuatW = propPoseQuats[propQuatOffset + 3]
        poseStack.pos(jointMap.propR, 2 * (propQuatX * propQuatZ + propQuatW * propQuatY) * -aimWeight, 2 * (propQuatY * propQuatZ - propQuatW * propQuatX) * -aimWeight, (1 - 2 * (propQuatX * propQuatX + propQuatY * propQuatY)) * -aimWeight)
      }
      const swordDraw = eulerChannels[gripLOffset]
      if (!(swordDraw < -0.5) && (poseArmIk(heroModel, poseStack, 1, jointMap.hips, 0.262, 0.09, 0.07, 1, -0.15, -0.6), swordDraw > 0.01)) {
        const bowArmQuats = poseStack.q
        for (let quatIndex = 0; quatIndex < 4; quatIndex++) ((BOW_ARM_QUAT_SCRATCH[quatIndex] = bowArmQuats[jointMap.armL * 4 + quatIndex]), (BOW_ARM_QUAT_SCRATCH[4 + quatIndex] = bowArmQuats[jointMap.foreL * 4 + quatIndex]))
        ;(poseArmIk(heroModel, poseStack, 1, jointMap.propR, 0, 0, eulerChannels[gripLOffset + 1], 0.7, -0.6, -0.25), swordDraw < 0.99 && (slerpQuatToward(bowArmQuats, jointMap.armL * 4, BOW_ARM_QUAT_SCRATCH, 0, swordDraw), slerpQuatToward(bowArmQuats, jointMap.foreL * 4, BOW_ARM_QUAT_SCRATCH, 4, swordDraw)))
      }
    },
    animateHero = (poseStack, animState, renderOutput) => {
      const commonPoses = deathPoseSet.common
      if (applySpecialStatePose(heroModel, poseStack, animState.anim === "leap" ? "airborne" : animState.anim, animState.t, animState.p, animState.time, commonPoses)) {
        ;(applySwordPose(poseStack, (animState.anim === "dead" ? commonPoses.tmp : animState.anim === "stunned" ? commonPoses.stun : commonPoses.air).e), animState.anim === "dead" && (renderOutput.glow = Math.max(0.15, 1 - animState.t * 1.2)))
        return
      }
      switch (animState.anim) {
        case "move": {
          ;(applyWalkPose(heroModel, poseStack, animState.stride, DEATH_POSE_TUNING, () => {
            const strideCos = Math.cos(animState.stride * Math.PI * 2)
            ;(poseStack.add(jointMap.chest, 0, 0, strideCos * 3), poseStack.add(jointMap.head, 0, 0, -strideCos * 2))
          }),
            copyPoseInto(scratchPose, deathPoseSet.carry),
            (scratchPose.e[aimOffset] += Math.sin(animState.stride * Math.PI * 4) * 2.5),
            applySwordPose(poseStack, scratchPose.e))
          break
        }
        case "attack": {
          const easedPhase = easeAnimationPhase(animState.p, animState.windup),
            isAltAttack = (animState.mode & 1) !== 0
          ;(samplePoseTrack(isAltAttack ? deathPoseSet.atkX : animState.variant % 2 === 0 ? deathPoseSet.atkA : deathPoseSet.atkB, easedPhase, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applySwordPose(poseStack, scratchPose.e), (renderOutput.glow = 1 + (isAltAttack ? 3.2 : 1.4) * bellPulseWindow(easedPhase, 0.36, 0.2)))
          break
        }
        case "cast_s1": {
          ;(samplePoseTrack(deathPoseSet.s1, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applySwordPose(poseStack, scratchPose.e), (renderOutput.glow = 1 + 2.4 * bellPulseWindow(animState.p, 0.42, 0.3)))
          break
        }
        case "cast_s2":
        case "dash": {
          ;(applyBasePoseToStack(heroModel, poseStack, deathPoseSet.dash), applySwordPose(poseStack, deathPoseSet.dash.e), (renderOutput.glow = 2.4))
          break
        }
        case "cast_ult": {
          ;(samplePoseTrack(deathPoseSet.ult, animState.p, scratchPose), applyBasePoseToStack(heroModel, poseStack, scratchPose), applySwordPose(poseStack, scratchPose.e), (renderOutput.glow = 1 + 1.6 * animState.p))
          break
        }
        case "spin": {
          ;(copyPoseInto(scratchPose, deathPoseSet.spin),
            applyBasePoseToStack(heroModel, poseStack, scratchPose, () => {
              const tValue = animState.t,
                spinAngle = tValue < 0.15 ? ((tValue * tValue) / 0.3) * 2.4 : (tValue - 0.075) * 2.4
              ;(poseStack.rot(jointMap.root, 0, -spinAngle * 360, 0), poseStack.add(jointMap.spine, 0, 0, 4 * Math.sin(tValue * 9)))
            }),
            applySwordPose(poseStack, scratchPose.e),
            (renderOutput.glow = 2.6))
          break
        }
        case "channel": {
          ;(applyBasePoseToStack(heroModel, poseStack, deathPoseSet.channel, () => {
            applyBreathingPose(heroModel, poseStack, animState.time, animState.seed, 0.8)
          }),
            applySwordPose(poseStack, deathPoseSet.channel.e, 0.5),
            (renderOutput.glow = 1 + 0.5 * (0.5 + 0.5 * Math.sin(animState.time * 5))))
          break
        }
        default: {
          copyPoseInto(scratchPose, deathPoseSet.stance)
          const breathPhase = (animState.time * 0.28 + animState.seed) % 1,
            breathPulse = bellPulseWindow(breathPhase, 0.5, 0.06)
          ;((scratchPose.e[gripROffset + 1] += breathPulse * 0.035),
            (scratchPose.e[aimOffset] += breathPulse * 5 + Math.sin(animState.time * 1.3) * 1.2),
            applyBasePoseToStack(heroModel, poseStack, scratchPose, () => {
              applyBreathingPose(heroModel, poseStack, animState.time, animState.seed, 1.2)
            }),
            applySwordPose(poseStack, scratchPose.e),
            (renderOutput.glow = 1 + 0.12 * Math.sin(animState.time * 3)))
        }
      }
    }

  // ── 项羽外层装束 v2：整轮廓放大，彻底盖住内层
  {
    // 兜鍪：大覆钵 + 高冠脊 + 顶缨 + 护颊 + 护颈
    modelBuilder.bone(e.head).paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.85, mat: MATERIAL_KINDS.metal })
    modelBuilder.lathe(
      [
        [1.46, 0.205, 0.195],
        [1.52, 0.222, 0.212],
        [1.6, 0.215, 0.205],
        [1.68, 0.18, 0.172],
        [1.74, 0.115, 0.11],
        [1.78, 0.05, 0.048],
      ],
      { seg: 16, cap1: !1 },
    )
    modelBuilder.g(composeMatrix(0, 1.46, 0, 0, 0, 0), () =>
      modelBuilder.lathe(
        [
          [0.02, 0.232, 0.222],
          [-0.02, 0.238, 0.228],
        ],
        { seg: 16, cap0: !1, cap1: !1 },
      ),
    )
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
    modelBuilder.g(composeMatrix(0, 1.755, 0, 0, 0, 0), () => modelBuilder.torus(0.07, 0.016, 0.02, 12, 3, { crease: 30 }))
    // 高冠脊（从额顶向后竖起）
    modelBuilder.g(composeMatrix(0, 1.8, -0.02, 6, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.045, 0.02],
          [-0.03, 0.16],
          [0.02, 0.19],
          [0.05, 0.05],
          [0.045, -0.02],
        ],
        0.028,
        0.008,
      ),
    )
    // 顶缨
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.pheasant, { c2: ALTERNATE_COLOR_PALETTE.liningShade, mat: MATERIAL_KINDS.fur })
    modelBuilder.tube(
      [
        [0, 1.94, -0.02, 0.03],
        [0, 2.02, 0.0, 0.075],
        [0, 0.0 + 2.1, 0.03, 0.028],
      ],
      { seg: 7 },
    )
    // 护颊 + 护颈
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.8, mat: MATERIAL_KINDS.metal })
    modelBuilder.sym((mirrorSide) =>
      modelBuilder.g(composeMatrix(mirrorSide * 0.185, 1.42, 0.03, -10, 0, mirrorSide * 10), () =>
        modelBuilder.extrude(
          [
            [-0.055, 0.075],
            [0.055, 0.075],
            [0.065, -0.06],
            [0, -0.115],
            [-0.065, -0.06],
          ],
          0.032,
          0.01,
        ),
      ),
    )
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.leather, { c2: ALTERNATE_COLOR_PALETTE.leatherLight, gloss: 0.25, mat: MATERIAL_KINDS.leather })
    modelBuilder.g(composeMatrix(0, 1.38, -0.17, 22, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.16, 0.07],
          [0.16, 0.07],
          [0.18, -0.09],
          [0, -0.12],
          [-0.18, -0.09],
        ],
        0.03,
        0.012,
      ),
    )

    // 肩吞：巨型三层肩甲
    for (const shoulderSide of [1, -1]) {
      const clavicleBone = shoulderSide > 0 ? e.clavL : e.clavR
      modelBuilder.bone(clavicleBone)
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.95, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(shoulderSide * 0.34, 1.4, 0, 0, 0, shoulderSide * -14), () =>
        modelBuilder.lathe(
          [
            [0.1, 0.19, 0.18],
            [0.04, 0.235, 0.222],
            [-0.04, 0.245, 0.232],
            [-0.12, 0.22, 0.21],
            [-0.16, 0.17, 0.162],
          ],
          { seg: 12, cap0: !1, cap1: !1 },
        ),
      )
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(shoulderSide * 0.34, 1.33, 0, 0, 0, shoulderSide * -14), () => modelBuilder.torus(0.225, 0.014, 0.018, 12, 3, { crease: 24 }))
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.9, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(shoulderSide * 0.36, 1.24, 0.02, 0, 0, shoulderSide * -24), () =>
        modelBuilder.lathe(
          [
            [0.05, 0.16, 0.15],
            [-0.03, 0.17, 0.16],
            [-0.1, 0.135, 0.128],
          ],
          { seg: 10, cap0: !1, cap1: !1 },
        ),
      )
      // 护臂
      const shoulderArmBone = shoulderSide > 0 ? e.armL : e.armR
      modelBuilder.bone(shoulderArmBone)
      modelBuilder.g(composeMatrix(shoulderSide * 0.38, 1.19, 0, 0, 0, shoulderSide * -6), () =>
        modelBuilder.lathe(
          [
            [0.06, 0.105, 0.1],
            [-0.02, 0.11, 0.105],
            [-0.09, 0.095, 0.09],
          ],
          { seg: 9, cap0: !1, cap1: !1 },
        ),
      )
    }

    // 胸甲：正面上身板 + 护心镜 + 束带
    modelBuilder.bone(e.chest).paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.9, mat: MATERIAL_KINDS.metal })
    modelBuilder.lathe(
      [
        [1.31, 0.24, 0.2],
        [1.24, 0.262, 0.218],
        [1.14, 0.255, 0.212],
        [1.04, 0.225, 0.19],
        [0.98, 0.205, 0.176],
      ],
      { seg: 14 },
    )
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
    modelBuilder.ball(0, 1.15, 0.2, 0.075, 0.075, 0.025, 0, 180)
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.leather, { c2: ALTERNATE_COLOR_PALETTE.leatherLight, gloss: 0.2, mat: MATERIAL_KINDS.leather })
    modelBuilder.g(composeMatrix(0, 1.27, 0, 0, 0, 0), () => modelBuilder.torus(0.235, 0.022, 0.016, 16, 3, { crease: 20 }))
    modelBuilder.g(composeMatrix(0, 1.02, 0, 0, 0, 0), () => modelBuilder.torus(0.205, 0.018, 0.014, 16, 3, { crease: 20 }))

    // 面甲：遮住原脸，只留眼缝
    modelBuilder.bone(e.head).paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.95, mat: MATERIAL_KINDS.metal })
    modelBuilder.g(composeMatrix(0, 1.5, 0.075, 0, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.125, 0.075],
          [0.125, 0.075],
          [0.145, 0.0],
          [0.105, -0.075],
          [0, -0.095],
          [-0.105, -0.075],
          [-0.145, 0.0],
        ],
        0.05,
        0.014,
      ),
    )
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
    modelBuilder.g(composeMatrix(0, 1.545, 0.128, -6, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.13, 0.016],
          [0.13, 0.016],
          [0.13, -0.016],
          [-0.13, -0.016],
        ],
        0.014,
        0.005,
      ),
    )
    // 面甲下缘髯须（宽厚，改变下颌轮廓）
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.hair, { mat: MATERIAL_KINDS.fur })
    modelBuilder.g(composeMatrix(0, 1.4, 0.085, 16, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.1, 0.04],
          [0.1, 0.04],
          [0.085, -0.06],
          [0, -0.1],
          [-0.085, -0.06],
        ],
        0.05,
        0.02,
      ),
    )

    // 双臂：整段覆盖（上臂 + 前臂 + 手背）
    for (const armSide of [1, -1]) {
      const upperArmBone = armSide > 0 ? e.armL : e.armR
      const forearmBone = armSide > 0 ? e.foreL : e.foreR
      modelBuilder.bone(upperArmBone).paint(ALTERNATE_COLOR_PALETTE.wrap, { c2: ALTERNATE_COLOR_PALETTE.wrapDark, mat: MATERIAL_KINDS.cloth })
      modelBuilder.g(composeMatrix(armSide * 0.34, 1.26, 0, 0, 0, armSide * -4), () =>
        modelBuilder.lathe(
          [
            [0.1, 0.118, 0.112],
            [0.0, 0.122, 0.116],
            [-0.14, 0.112, 0.106],
            [-0.2, 0.1, 0.095],
          ],
          { seg: 10, cap0: !1, cap1: !1 },
        ),
      )
      modelBuilder.bone(forearmBone).paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.75, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(armSide * 0.34, 1.06, 0, 0, 0, armSide * -4), () =>
        modelBuilder.lathe(
          [
            [0.03, 0.108, 0.104],
            [-0.06, 0.115, 0.11],
            [-0.16, 0.1, 0.096],
            [-0.2, 0.088, 0.084],
          ],
          { seg: 10, cap0: !1, cap1: !1 },
        ),
      )
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(armSide * 0.34, 1.0, 0, 0, 0, 0), () => modelBuilder.torus(0.112, 0.012, 0.016, 10, 3, { crease: 24 }))
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.leather, { c2: ALTERNATE_COLOR_PALETTE.leatherLight, gloss: 0.25, mat: MATERIAL_KINDS.leather })
      modelBuilder.g(composeMatrix(armSide * 0.34, 0.82, 0.01, 0, 0, 0), () => modelBuilder.ball(0, 0, 0, 0.085, 0.075, 0.08, 0, 0))
    }

    // 双腿：整段覆盖（大腿 + 小腿）
    for (const legSide of [1, -1]) {
      const thighBone = legSide > 0 ? e.thighL : e.thighR
      modelBuilder.bone(thighBone).paint(ALTERNATE_COLOR_PALETTE.pants, { c2: ALTERNATE_COLOR_PALETTE.pantsDark, mat: MATERIAL_KINDS.cloth })
      modelBuilder.g(composeMatrix(legSide * 0.16, 0.86, 0, 0, 0, 0), () =>
        modelBuilder.lathe(
          [
            [0.06, 0.152, 0.148],
            [-0.08, 0.158, 0.154],
            [-0.24, 0.148, 0.144],
            [-0.36, 0.132, 0.128],
          ],
          { seg: 10, cap0: !1, cap1: !1 },
        ),
      )
    }

    // 披风：双层布片，从肩后垂下（刚性绑胸，保证不穿模）
    modelBuilder.bone(e.chest).paint(ALTERNATE_COLOR_PALETTE.lining, { c2: ALTERNATE_COLOR_PALETTE.liningShade, mat: MATERIAL_KINDS.cloth })
    for (const capeSide of [1, -1]) {
      modelBuilder.g(composeMatrix(capeSide * 0.16, 1.34, -0.2, 12, capeSide * -8, capeSide * 6), () =>
        modelBuilder.extrude(
          [
            [-0.16, 0.02],
            [0.16, 0.03],
            [0.2, -0.42],
            [0.06, -0.5],
            [-0.14, -0.46],
            [-0.2, -0.36],
          ],
          0.018,
          0.006,
        ),
      )
    }

    // 裙甲：加宽加深，六片甲叶
    modelBuilder.bone(e.hips).paint(ALTERNATE_COLOR_PALETTE.robe, { c2: ALTERNATE_COLOR_PALETTE.robeDark, mat: MATERIAL_KINDS.cloth })
    modelBuilder.lathe(
      [
        [1.0, 0.23, 0.195],
        [0.9, 0.275, 0.232],
        [0.76, 0.33, 0.278],
        [0.6, 0.365, 0.31],
        [0.52, 0.34, 0.29],
      ],
      { seg: 14, cap0: !1, cap1: !1 },
    )
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.65, mat: MATERIAL_KINDS.metal })
    for (let index = 0; index < 8; index++) {
      const plateAngle = (index / 8) * Math.PI * 2 + 0.3
      modelBuilder.g(composeMatrix(Math.cos(plateAngle) * 0.3, 0.82, Math.sin(plateAngle) * 0.255, 0, (-plateAngle * 180) / Math.PI, 0), () =>
        modelBuilder.extrude(
          [
            [-0.058, 0.15],
            [0.058, 0.15],
            [0.068, -0.07],
            [0, -0.12],
            [-0.068, -0.07],
          ],
          0.024,
          0.009,
        ),
      )
    }
    modelBuilder.paint(ALTERNATE_COLOR_PALETTE.brass, { c2: ALTERNATE_COLOR_PALETTE.brassDark, gloss: 1, mat: MATERIAL_KINDS.metal })
    modelBuilder.g(composeMatrix(0, 0.96, 0, 0, 0, 0), () => modelBuilder.torus(0.235, 0.018, 0.022, 16, 3, { crease: 20 }))

    // 护腿：胫甲 + 战靴
    for (const shinSide of [1, -1]) {
      const shinBone = shinSide > 0 ? e.shinL : e.shinR
      modelBuilder.bone(shinBone)
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.iron, { c2: ALTERNATE_COLOR_PALETTE.ironLight, gloss: 0.8, mat: MATERIAL_KINDS.metal })
      modelBuilder.g(composeMatrix(shinSide * 0.17, 0.36, 0.01, 0, 0, 0), () =>
        modelBuilder.lathe(
          [
            [0.14, 0.125, 0.12],
            [0.02, 0.135, 0.128],
            [-0.1, 0.118, 0.112],
            [-0.2, 0.098, 0.094],
          ],
          { seg: 10, cap0: !1, cap1: !1 },
        ),
      )
      modelBuilder.paint(ALTERNATE_COLOR_PALETTE.leather, { c2: ALTERNATE_COLOR_PALETTE.leatherLight, gloss: 0.25, mat: MATERIAL_KINDS.leather })
      modelBuilder.g(composeMatrix(shinSide * 0.17, 0.13, 0.05, 0, 0, 0), () =>
        modelBuilder.lathe(
          [
            [0.09, 0.13, 0.135],
            [0.0, 0.15, 0.19],
            [-0.05, 0.16, 0.235],
          ],
          { seg: 10, cap0: !1 },
        ),
      )
    }
  }

  return {
    key: "hero:xiangyu",
    geometry: geometry,
    rig: heroModel.rig,
    height: 2.3,
    radius: 0.66,
    scale: HERO_MODEL_SCALE,
    stride: DEATH_POSE_TUNING.stride * HERO_MODEL_SCALE,
    triangles: modelBuilder.triangleCount,
    attach: {
      head: { joint: jointMap.head, x: 0, y: 0.25, z: 0 },
      chest: { joint: jointMap.chest, x: 0, y: 0.08, z: 0 },
      handR: { joint: jointMap.handR, x: 0, y: -0.07, z: 0 },
      handL: { joint: jointMap.handL, x: 0, y: -0.07, z: 0 },
      weapon: { joint: jointMap.propR, x: 0, y: -0.4, z: 1.9 },
      muzzle: { joint: jointMap.propR, x: 0, y: -0.4, z: 1.9 },
    },
    blend: (dashKindLabel, attackKindType) => (attackKindType === "attack" || attackKindType === "dash" || attackKindType === "cast_s2" ? 0.07 : attackKindType === "dead" ? 0.05 : dashKindLabel === "dash" || dashKindLabel === "spin" ? 0.18 : 0.13),
    animate: animateHero,
  }
}

const MODEL_BUILDER_TABLE = {
    "hero:panyue": buildPanyueModel,
    "hero:chijin": buildChijinModel,
    "hero:xingli": buildXingliModel,
    "hero:fengling": buildFenglingModel,
    "hero:yeque": buildYequeModel,
    "hero:xiangyu": buildXiangyuModel,
    "minion:melee": buildMeleeMinionModel,
    "minion:ranged": buildStructureModelA,
    "minion:siege": buildStructureModelB,
    "minion:super": buildSuperMinionModel,
    ...STRUCTURE_MODEL_BUILDERS,
    "monster:mossback": buildMossbackModel,
    "monster:glimwing": buildTowerModel,
    "monster:frost_golem": buildFrostGolemModel,
    "monster:ember_golem": buildEmberGolemModel,
    "monster:abyss_drake": buildAbyssDrakeModel,
    "monster:star_colossus": buildStarColossusModel,
  },
  modelBuilderCache = new Map()

/**
 * 获取模型。
 *
 * @param lookupKey - 查找键
 */
function getOrBuildModel(lookupKey) {
  let getValue = modelBuilderCache.get(lookupKey)
  if (!getValue) {
    const selectedMODEL_BUILDER_TABLE = MODEL_BUILDER_TABLE[lookupKey]
    if (!selectedMODEL_BUILDER_TABLE) throw new Error(`未知模型：${lookupKey}`)
    ;((getValue = selectedMODEL_BUILDER_TABLE()), modelBuilderCache.set(lookupKey, getValue))
  }
  return getValue
}

const heroModelKey = (heroId) => `hero:${heroId}`,
  minionModelKey = (minionType) => `minion:${minionType}`,
  towerModelKey = (towerTier, towerTeam) => `tower:${towerTier}:${towerTeam}`,
  coreModelKey = (teamId) => `core:${teamId}`,
  ruinModelKey = (teamId) => `ruin:${teamId}`,
  monsterModelKey = (monsterType) => `monster:${monsterType}`

const CAST_ANIM_SPECS = {
    panyue: { cast_s1: ["dash", 0.7], cast_s2: ["cast_s2", 1.1], cast_ult: ["leap", 1] },
    chijin: { cast_s1: ["cast_s1", 0.9], cast_s2: ["dash", 0.55], cast_ult: ["spin", 1.7] },
    xingli: { cast_s1: ["cast_s1", 0.9], cast_s2: ["cast_s2", 1], cast_ult: ["cast_ult", 1.5] },
    fengling: { cast_s1: ["cast_s1", 1], cast_s2: ["dash", 0.5], cast_ult: ["cast_ult", 1.2] },
    yeque: { cast_s1: ["dash", 0.45], cast_s2: ["cast_s2", 0.8], cast_ult: ["cast_ult", 1] },
  },
  PORTRAIT_CAMERA_MARGIN = { side: 0.07, top: 0.06, bottom: 0.12 },
  PORTRAIT_FRAME_BOUNDS = { top: 3.2, halfW: 1.2 },
  PORTRAIT_CAMERA_PARAMS = {
    panyue: { drop: 0.3, dist: 3.8, yaw: -14, x: 0.06, anim: "channel" },
    chijin: { drop: 0.26, dist: 3, yaw: -12, x: -0.08 },
    xingli: { drop: 0.26, dist: 2.75, yaw: -18, x: 0.04 },
    fengling: { drop: 0.24, dist: 2.75, yaw: 26, x: 0.06, anim: "channel" },
    yeque: { drop: 0.24, dist: 2.7, yaw: -22, x: 0, anim: "attack", p: 0.17, variant: 0 },
    xiangyu: { drop: 0.28, dist: 3.4, yaw: -16, x: 0.02 },
  },
  modelBoundsCache = new Map(),
  SKELETON_PACK_SCRATCH = new Float32Array(512)

function computeSkinnedBoundsFromPose(heroModel, animator, bounds) {
  const jointCount = heroModel.rig.count,
    packedSkinMatrices = jointCount * 8 <= SKELETON_PACK_SCRATCH.length ? SKELETON_PACK_SCRATCH : new Float32Array(jointCount * 8)
  animator.skeleton.pack(packedSkinMatrices, 0)
  const positionAttr = heroModel.geometry.attributes.position,
    skinAttr = heroModel.geometry.attributes.aSkin,
    positionArray = positionAttr.array,
    skinArray = skinAttr.array,
    skinnedPosA = [0, 0, 0],
    skinnedPosB = [0, 0, 0],
    skinVertex = (boneIndex, bonePosX, bonePosY, bonePosZ, outPosition) => {
      const boneDataOffset = boneIndex * 8,
        selectedI = packedSkinMatrices[boneDataOffset + 4],
        boneQuatY = packedSkinMatrices[boneDataOffset + 5],
        boneQuatZ = packedSkinMatrices[boneDataOffset + 6],
        boneQuatW = packedSkinMatrices[boneDataOffset + 7],
        crossX = boneQuatY * bonePosZ - boneQuatZ * bonePosY + boneQuatW * bonePosX,
        crossY = boneQuatZ * bonePosX - selectedI * bonePosZ + boneQuatW * bonePosY,
        crossZ = selectedI * bonePosY - boneQuatY * bonePosX + boneQuatW * bonePosZ,
        boneScale = packedSkinMatrices[boneDataOffset + 3]
      ;((outPosition[0] = packedSkinMatrices[boneDataOffset] + boneScale * (bonePosX + 2 * (boneQuatY * crossZ - boneQuatZ * crossY))), (outPosition[1] = packedSkinMatrices[boneDataOffset + 1] + boneScale * (bonePosY + 2 * (boneQuatZ * crossX - selectedI * crossZ))), (outPosition[2] = packedSkinMatrices[boneDataOffset + 2] + boneScale * (bonePosZ + 2 * (selectedI * crossY - boneQuatY * crossX))))
    }
  for (let total = 0; total < positionAttr.count; total += 3) {
    const selectedR = positionArray[total * 3],
      vertexY = positionArray[total * 3 + 1],
      vertexZ = positionArray[total * 3 + 2]
    skinVertex(skinArray[total * 3], selectedR, vertexY, vertexZ, skinnedPosB)
    const selectedL = skinArray[total * 3 + 2]
    ;(selectedL < 0.999 && (skinVertex(skinArray[total * 3 + 1], selectedR, vertexY, vertexZ, skinnedPosA), (skinnedPosB[0] = skinnedPosA[0] + (skinnedPosB[0] - skinnedPosA[0]) * selectedL), (skinnedPosB[1] = skinnedPosA[1] + (skinnedPosB[1] - skinnedPosA[1]) * selectedL), (skinnedPosB[2] = skinnedPosA[2] + (skinnedPosB[2] - skinnedPosA[2]) * selectedL)),
      skinnedPosB[0] < bounds.minX && (bounds.minX = skinnedPosB[0]),
      skinnedPosB[0] > bounds.maxX && (bounds.maxX = skinnedPosB[0]),
      skinnedPosB[1] < bounds.minY && (bounds.minY = skinnedPosB[1]),
      skinnedPosB[1] > bounds.maxY && (bounds.maxY = skinnedPosB[1]),
      skinnedPosB[2] > bounds.maxZ && (bounds.maxZ = skinnedPosB[2]))
  }
}

const PORTRAIT_YAW_RANGE = { panyue: [-0.44, 0.44], chijin: [-0.38, 0.44], xingli: [0.25, 0.8], fengling: [0.25, 0.8], yeque: [0.25, 0.8] },
  PORTRAIT_SAMPLES_PER_AXIS = 48

/**
 * 计算英雄与模型。
 *
 * @param lookupKey - 查找键
 * @param heroModel - 次要输入
 */
function computeHeroModelBounds(lookupKey, heroModel) {
  const cachedBounds = modelBoundsCache.get(lookupKey)
  if (cachedBounds) return cachedBounds
  const minXConfig = { minX: 1 / 0, maxX: -1 / 0, minY: 0, maxY: -1 / 0, maxZ: -1 / 0 },
    attackBounds = { minX: 1 / 0, maxX: -1 / 0, minY: 0, maxY: -1 / 0, maxZ: -1 / 0 },
    animator = new Animator(heroModel, 0.37),
    animInput = animator.input
  animInput.windup = 0.35
  const sampleBounds = (idleKind, phase, variant, twistAngle, bounds) => {
      ;((animInput.anim = idleKind), (animInput.p = phase), (animInput.t = idleKind === "idle" ? 1.3 : phase * 0.8), (animInput.time = 1.3), (animInput.variant = variant), animator.snap(), animator.update(0, 0, 0, 0, 0, twistAngle, 1), animator.settle(), computeSkinnedBoundsFromPose(heroModel, animator, bounds))
    },
    [yawCenter, yawRange] = PORTRAIT_YAW_RANGE[lookupKey]
  for (let index = 0; index <= 8; index++) sampleBounds("idle", 0, 0, yawCenter + yawRange * Math.sin(((index / 8) * 2 - 1) * Math.PI * 0.5), minXConfig)
  for (const variantIndex of [0, 1]) for (const attackPhase of [0.2, 0.35, 0.5]) for (const lcllc of [yawCenter - yawRange, yawCenter, yawCenter + yawRange]) sampleBounds("attack", attackPhase, variantIndex, lcllc, attackBounds)
  const marginX = (minXConfig.maxX - minXConfig.minX) * 0.25,
    mergedBounds = { minX: Math.min(minXConfig.minX, Math.max(attackBounds.minX, minXConfig.minX - marginX)), maxX: Math.max(minXConfig.maxX, Math.min(attackBounds.maxX, minXConfig.maxX + marginX)), minY: 0, maxY: Math.max(minXConfig.maxY, Math.min(attackBounds.maxY, minXConfig.maxY * 1.12)), maxZ: minXConfig.maxZ }
  return (modelBoundsCache.set(lookupKey, mergedBounds), mergedBounds)
}

function createPreviewStage(enableShadows) {
  const scene = new Scene(),
    camera = new PerspectiveCamera(28, 1, 0.3, 80),
    keyLight = new DirectionalLight(ARENA_PALETTE.env.sun, 2.9)
  if ((keyLight.position.set(-3.2, 6.5, 5.5), enableShadows)) {
    ;((keyLight.castShadow = !0), keyLight.shadow.mapSize.set(1024, 1024))
    const shadowCamera = keyLight.shadow.camera
    ;((shadowCamera.left = shadowCamera.bottom = -4.5), (shadowCamera.right = shadowCamera.top = 4.5), (shadowCamera.near = 1), (shadowCamera.far = 24), (keyLight.shadow.bias = -6e-4), (keyLight.shadow.normalBias = 0.04))
  }
  ;(scene.add(keyLight, keyLight.target), scene.add(new HemisphereLight(14674175, 7170176, 1.9)))
  const rimLight = new PointLight(16777215, 26, 14, 1.4)
  return (rimLight.position.set(2.6, 3.4, -3.4), scene.add(rimLight), { scene: scene, camera: camera, key: keyLight, rim: rimLight })
}

function configurePreviewRenderer(renderer) {
  ;((renderer.outputColorSpace = SRGBColorSpace), (renderer.toneMapping = ACESFilmicToneMapping), (renderer.toneMappingExposure = 1.2), renderer.setClearColor(0, 0))
}

/**
 * 创建模型。
 *
 * @param glowColor - 来源
 * @param pedestalHeight - 次要输入
 */
function buildPedestalModel(glowColor, pedestalHeight) {
  const modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 30),
    modelBuilder.paint(1317946, { c2: 2898544 }),
    modelBuilder.lathe(
      [
        [-0.36, pedestalHeight * 0.84],
        [-0.16, pedestalHeight * 1],
        [-0.08, pedestalHeight * 1],
        [-0.06, pedestalHeight * 0.95],
        [0, pedestalHeight * 0.93],
      ],
      { seg: 24 },
    ),
    modelBuilder.paint(14198856, { gloss: 1 }),
    modelBuilder.lathe(
      [
        [-0.125, pedestalHeight * 1.015],
        [-0.085, pedestalHeight * 1.015],
        [-0.08, pedestalHeight * 0.97],
      ],
      { seg: 24, cap0: !1, cap1: !1 },
    ),
    modelBuilder.g(composeMatrix(0, 0.002, 0), () => modelBuilder.torus(pedestalHeight * 0.66, 0.018, 0.01, 32, 4, { crease: 30 })))
  const baseColor = [glowColor.r, glowColor.g, glowColor.b]
  ;(modelBuilder.paint(baseColor, { glow: 0.5 }), modelBuilder.g(composeMatrix(0, 0.004, 0), () => modelBuilder.torus(pedestalHeight * 0.8, 0.03, 0.01, 40, 4, { crease: 30 })))
  const runePoints = []
  for (let index = 0; index < 16; index++) {
    const runeAngle = (index / 16) * Math.PI * 2,
      runeRadius = (index % 2 === 0 ? 0.56 : 0.3) * pedestalHeight
    runePoints.push([Math.cos(runeAngle) * runeRadius, Math.sin(runeAngle) * runeRadius])
  }
  return (modelBuilder.paint([baseColor[0] * 0.5, baseColor[1] * 0.5, baseColor[2] * 0.5], { glow: 0.12 }), modelBuilder.g(composeMatrix(0, 0.004, 0, -90, 0, 0), () => modelBuilder.extrude(runePoints, 0.006, 0)), modelBuilder.build())
}

function drawPortraitFallback(ctx, canvasWidth, canvasHeight, heroId, isReady) {
  const selectedHERO_TABLE = HERO_TABLE[heroId]
  if (isReady) {
    const LinearGradientValue = ctx.createLinearGradient(0, 0, 0, canvasHeight)
    ;(LinearGradientValue.addColorStop(0, selectedHERO_TABLE.palette.secondary), LinearGradientValue.addColorStop(1, "#0b1020"), (ctx.fillStyle = LinearGradientValue), ctx.fillRect(0, 0, canvasWidth, canvasHeight))
  } else ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  const centerX = canvasWidth / 2,
    portraitSize = Math.min(canvasWidth, canvasHeight)
  ;((ctx.fillStyle = selectedHERO_TABLE.palette.primary),
    ctx.beginPath(),
    ctx.ellipse(centerX, canvasHeight * (isReady ? 0.98 : 0.9), portraitSize * 0.36, portraitSize * 0.34, 0, Math.PI, 0),
    ctx.fill(),
    (ctx.fillStyle = selectedHERO_TABLE.palette.accent),
    ctx.beginPath(),
    ctx.arc(centerX, canvasHeight * (isReady ? 0.46 : 0.42), portraitSize * 0.17, 0, Math.PI * 2),
    ctx.fill(),
    (ctx.fillStyle = selectedHERO_TABLE.palette.glow),
    (ctx.font = `bold ${Math.round(portraitSize * 0.2)}px "PingFang SC","Microsoft YaHei",sans-serif`),
    (ctx.textAlign = "center"),
    (ctx.textBaseline = "middle"),
    ctx.fillText(selectedHERO_TABLE.name.slice(0, 1), centerX, canvasHeight * (isReady ? 0.47 : 0.43)))
}

function createCanvasFallbackPreview(canvas, heroId) {
  let fallbackHeroId = heroId
  const redrawFallback = () => {
    const portraitWidth = Math.max(1, canvas.clientWidth || canvas.width),
      portraitHeight = Math.max(1, canvas.clientHeight || canvas.height)
    ;(canvas.width !== portraitWidth && (canvas.width = portraitWidth), canvas.height !== portraitHeight && (canvas.height = portraitHeight))
    const ContextValue = canvas.getContext("2d")
    ContextValue && drawPortraitFallback(ContextValue, portraitWidth, portraitHeight, fallbackHeroId, !1)
  }
  return (
    redrawFallback(),
    {
      setHero(heroId) {
        ;((fallbackHeroId = heroId), redrawFallback())
      },
      play() {},
      resize: redrawFallback,
      dispose() {},
    }
  )
}

/**
 * 创建英雄。
 *
 * @param canvas - 来源
 * @param heroId - 次要输入
 */
function createHeroPreview(canvas, heroId) {
  let renderer
  try {
    renderer = new WebGLRenderer({ canvas: canvas, antialias: !0, alpha: !0, premultipliedAlpha: !0, powerPreference: "high-performance" })
  } catch {
    return createCanvasFallbackPreview(canvas, heroId)
  }
  ;(configurePreviewRenderer(renderer), (renderer.shadowMap.enabled = !0), (renderer.shadowMap.type = PCFSoftShadowMap))
  const PreviewStageValue = createPreviewStage(!0),
    ToonMaterialValue = createToonMaterial({ vertexColors: !0, steps: 2, rim: 0.2, specular: 0.7, gloss: 40, fog: !1 })
  let pedestalMesh = null,
    heroModel,
    animator,
    outlineRegistry = null
  const MaterialStateValue = createMaterialState()
  MaterialStateValue.team.set(ARENA_PALETTE.blue.main)
  let currentHeroId = heroId,
    currentAnim = "idle",
    total = 0,
    animDuration = 0,
    attackVariant = 0,
    elapsedTime = 0,
    yawAngle = 0.3,
    isActive = !1,
    frameHandle = 0,
    lastFrameTime = performance.now()
  const setHeroModel = (panyueKind) => {
      ;((currentHeroId = panyueKind), (heroModel = getOrBuildModel(heroModelKey(panyueKind))), (animator = new Animator(heroModel, 0.37)), outlineRegistry && (outlineRegistry.removeFrom(PreviewStageValue.scene), outlineRegistry.dispose()), (outlineRegistry = new OutlineRegistry(heroModel.geometry, heroModel.rig.count, 1, { outline: 1.6 }, `preview:${panyueKind}`)), outlineRegistry.addTo(PreviewStageValue.scene))
      const glowColor = new Color(HERO_TABLE[panyueKind].palette.glow)
      ;(PreviewStageValue.rim.color.copy(glowColor).lerp(new Color(1, 1, 1), 0.35),
        pedestalMesh && (PreviewStageValue.scene.remove(pedestalMesh), pedestalMesh.geometry.dispose()),
        (pedestalMesh = new Mesh(buildPedestalModel(glowColor, panyueKind === "panyue" ? 1.5 : 1.12), ToonMaterialValue)),
        (pedestalMesh.receiveShadow = !0),
        PreviewStageValue.scene.add(pedestalMesh),
        (currentAnim = "idle"),
        (total = 0),
        animator.snap(),
        fitCamera())
    },
    fitCamera = () => {
      const aspectRatio = renderer.domElement.width / Math.max(1, renderer.domElement.height),
        computeHeroModelBoundsResult = computeHeroModelBounds(currentHeroId, heroModel),
        camera = PreviewStageValue.camera,
        halfFovTan = Math.tan((camera.fov * Math.PI) / 360),
        tanScaled = halfFovTan * aspectRatio,
        lookupKey = (computeHeroModelBoundsResult.minX + computeHeroModelBoundsResult.maxX) / 2,
        halfWidth = (computeHeroModelBoundsResult.maxX - computeHeroModelBoundsResult.minX) / 2,
        baseY = -0.36,
        modelHeight = computeHeroModelBoundsResult.maxY - baseY,
        modelDepth = Math.max(0, computeHeroModelBoundsResult.maxZ),
        viewHeight = Math.max(1, canvas.clientHeight || renderer.domElement.height / renderer.getPixelRatio()),
        topMargin = Math.min(0.24, Math.max(PORTRAIT_CAMERA_MARGIN.top, PORTRAIT_SAMPLES_PER_AXIS / viewHeight + 0.015)),
        widthFitDist = halfWidth / (tanScaled * (1 - 2 * PORTRAIT_CAMERA_MARGIN.side)) + modelDepth * 0.6,
        heightFitDist = modelHeight / (2 * halfFovTan * (1 - topMargin - PORTRAIT_CAMERA_MARGIN.bottom)) + modelDepth * 0.5,
        frameFitDist = Math.max(PORTRAIT_FRAME_BOUNDS.halfW / (tanScaled * (1 - 2 * PORTRAIT_CAMERA_MARGIN.side)), (PORTRAIT_FRAME_BOUNDS.top - baseY) / (2 * halfFovTan * (1 - topMargin - PORTRAIT_CAMERA_MARGIN.bottom))),
        cameraDist = Math.max(widthFitDist, heightFitDist, frameFitDist),
        cameraTargetY = baseY + halfFovTan * cameraDist * (1 - 2 * PORTRAIT_CAMERA_MARGIN.bottom)
      ;((camera.aspect = aspectRatio), camera.position.set(lookupKey, cameraTargetY + cameraDist * 0.12, cameraDist), camera.lookAt(lookupKey, cameraTargetY, 0), camera.updateProjectionMatrix())
    },
    resize = () => {
      if (isActive) return
      const canvasWidth = Math.max(1, canvas.clientWidth || canvas.width),
        canvasHeight = Math.max(1, canvas.clientHeight || canvas.height),
        pixelRatio = Math.min(2, window.devicePixelRatio || 1)
      ;(renderer.setPixelRatio(pixelRatio), renderer.setSize(canvasWidth, canvasHeight, !1), fitCamera())
    },
    renderFrame = (kills) => {
      if (isActive) return
      frameHandle = requestAnimationFrame(renderFrame)
      const deltaTime = Math.min(0.1, Math.max(0, (kills - lastFrameTime) / 1e3))
      if (((lastFrameTime = kills), !canvas.isConnected || document.hidden || !outlineRegistry)) return
      ;((elapsedTime += deltaTime), (yawAngle = PORTRAIT_YAW_RANGE[currentHeroId][0] + Math.sin(elapsedTime * 0.5) * PORTRAIT_YAW_RANGE[currentHeroId][1]))
      const animInput = animator.input
      ;(currentAnim !== "idle" && ((total += deltaTime), total >= animDuration && ((currentAnim = "idle"), (total = 0))),
        (animInput.anim = currentAnim),
        (animInput.time = elapsedTime),
        (animInput.t = currentAnim === "idle" ? elapsedTime : total),
        (animInput.p = currentAnim === "idle" ? 0 : Math.min(1, total / animDuration)),
        (animInput.variant = attackVariant),
        (animInput.windup = 0.35),
        (animInput.stride = 0),
        (animInput.speed = 0))
      const leapLift = currentAnim === "leap" ? 4 * 1.5 * animInput.p * (1 - animInput.p) : 0
      ;(animator.update(attackVariant * 10 + (currentAnim === "idle" ? 0 : 1), deltaTime, 0, leapLift, 0, yawAngle, 1), (MaterialStateValue.glow = animator.output.glow), outlineRegistry.begin(), outlineRegistry.push(animator.skeleton, MaterialStateValue), outlineRegistry.end(), renderer.render(PreviewStageValue.scene, PreviewStageValue.camera))
    }
  return (
    setHeroModel(heroId),
    resize(),
    (frameHandle = requestAnimationFrame(renderFrame)),
    {
      setHero(selectedHeroId) {
        isActive || selectedHeroId === currentHeroId || setHeroModel(selectedHeroId)
      },
      play(castKind) {
        if (isActive) return
        const animSpec = (__heroRow(CAST_ANIM_SPECS, currentHeroId) || {})[castKind] ?? [castKind, 0.9]
        ;((currentAnim = animSpec[0]), (animDuration = animSpec[1]), (total = 0), castKind === "attack" && attackVariant++)
      },
      resize: resize,
      dispose() {
        isActive || ((isActive = !0), cancelAnimationFrame(frameHandle), outlineRegistry?.dispose(), pedestalMesh?.geometry.dispose(), ToonMaterialValue.dispose(), PreviewStageValue.key.shadow.map?.dispose(), renderer.dispose(), renderer.forceContextLoss())
      },
    }
  )
}

export { Animator, COSTUME_PALETTE, drawPortraitFallback, minionModelKey, aimPropAtTarget, ruinModelKey, YEQUE_RIG_PROPORTIONS, MODEL_BUILDER_TABLE, createPreviewStage, coreModelKey, XINGLI_RIG_PROPORTIONS, configurePreviewRenderer, XIANGYU_COLOR_PALETTE, RANGER_PALETTE, ROBE_COSTUME_PALETTE, FENGLING_RIG_PROPORTIONS, FENGLING_BOW_SPEC, YEQUE_ARM_SPAN_SCALE, monsterModelKey, heroModelKey, CAST_ANIM_SPECS, PORTRAIT_CAMERA_PARAMS, createHeroPreview, FURL_ROW_COUNT, FENGLING_DEG_TO_RAD, getOrBuildModel, PORTRAIT_YAW_RANGE, YEQUE_DEG_TO_RAD, towerModelKey }