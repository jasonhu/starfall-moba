/**
 * 骨骼解算器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { buildWorldStaged } from '../world/world-builder'
import { SCRATCH_VEC_A, rotateVectorByQuaternion, multiplyQuaternions, SCRATCH_QUAT_B, SCRATCH_VEC_B, SCRATCH_QUAT_A, IK_SWAY_Z_BIAS, IK_SWAY_X_BIAS } from '../fx/effect-spawner'

const buildWorldSync = Object.assign(
    (renderContext) => {
      const WorldStagedValue = buildWorldStaged(renderContext)
      for (;;) {
        const nextStage = WorldStagedValue.next()
        if (nextStage.done) return nextStage.value
      }
    },
    { staged: buildWorldStaged },
  ),
  DEG_TO_RAD = Math.PI / 180

function quatBetweenVectors(fromX, fromY, fromZ, toX, toY, toZ, outQuat, outOffset) {
  const dotProduct = fromX * toX + fromY * toY + fromZ * toZ
  if (dotProduct < -0.9999) {
    let axisX = -fromZ,
      axisY = 0,
      axisZ = fromX
    Math.abs(fromX) < 0.1 && Math.abs(fromZ) < 0.1 && ((axisX = 0), (axisY = fromZ), (axisZ = -fromY))
    const distance = Math.hypot(axisX, axisY, axisZ) || 1
    ;((outQuat[outOffset] = axisX / distance), (outQuat[outOffset + 1] = axisY / distance), (outQuat[outOffset + 2] = axisZ / distance), (outQuat[outOffset + 3] = 0))
    return
  }
  const crossX = fromY * toZ - fromZ * toY,
    crossY = fromZ * toX - fromX * toZ,
    crossZ = fromX * toY - fromY * toX,
    quatW = 1 + dotProduct,
    quatNorm = Math.hypot(crossX, crossY, crossZ, quatW) || 1
  ;((outQuat[outOffset] = crossX / quatNorm), (outQuat[outOffset + 1] = crossY / quatNorm), (outQuat[outOffset + 2] = crossZ / quatNorm), (outQuat[outOffset + 3] = quatW / quatNorm))
}

class SkeletonSolver {
  constructor(rig, animSeed = 0) {
    this.rig = rig
    const jointCount = rig.count
    ;((this.wp = new Float32Array(jointCount * 3)),
      (this.wq = new Float32Array(jointCount * 4)),
      (this.ws = new Float32Array(jointCount)),
      (this.chains = rig.chains.map((chain) => ({ p: new Float32Array(chain.joints.length * 3), prev: new Float32Array(chain.joints.length * 3), ready: !1 }))),
      (this.phase = animSeed * 6.283))
  }
  rig
  wp
  wq
  ws
  chains
  lastX = 0
  lastY = 0
  lastZ = 0
  phase
  solve(pose, rootOffsetX, rootOffsetY, rootOffsetZ, twistAngle, scale) {
    const rigState = this.rig,
      jointCount = rigState.count,
      wpState = this.wp,
      wqState = this.wq,
      wsState = this.ws,
      localPositions = rigState.local,
      parentIndices = rigState.parent,
      halfAngleSin = Math.sin(twistAngle * 0.5),
      halfAngleCos = Math.cos(twistAngle * 0.5)
    for (let index = 0; index < jointCount; index++) {
      const selectedU = parentIndices[index],
        localPosX = localPositions[index * 3] + pose.t[index * 3],
        localPosY = localPositions[index * 3 + 1] + pose.t[index * 3 + 1],
        localPosZ = localPositions[index * 3 + 2] + pose.t[index * 3 + 2]
      if (selectedU < 0)
        ((SCRATCH_QUAT_A[0] = 0),
          (SCRATCH_QUAT_A[1] = halfAngleSin),
          (SCRATCH_QUAT_A[2] = 0),
          (SCRATCH_QUAT_A[3] = halfAngleCos),
          rotateVectorByQuaternion(SCRATCH_QUAT_A, 0, localPosX * scale, localPosY * scale, localPosZ * scale, wpState, index * 3),
          (wpState[index * 3] += rootOffsetX),
          (wpState[index * 3 + 1] += rootOffsetY),
          (wpState[index * 3 + 2] += rootOffsetZ),
          multiplyQuaternions(SCRATCH_QUAT_A, 0, pose.q, index * 4, wqState, index * 4),
          (wsState[index] = scale * pose.s[index]))
      else {
        const selectedD = wsState[selectedU]
        ;(rotateVectorByQuaternion(wqState, selectedU * 4, localPosX * selectedD, localPosY * selectedD, localPosZ * selectedD, wpState, index * 3), (wpState[index * 3] += wpState[selectedU * 3]), (wpState[index * 3 + 1] += wpState[selectedU * 3 + 1]), (wpState[index * 3 + 2] += wpState[selectedU * 3 + 2]), multiplyQuaternions(wqState, selectedU * 4, pose.q, index * 4, wqState, index * 4), (wsState[index] = selectedD * pose.s[index]))
      }
    }
  }
  resetChains() {
    for (const chain of this.chains) chain.ready = !1
  }
  simulate(pose, timeStep, time) {
    const rigValue = this.rig
    if (rigValue.chains.length === 0) return
    const wpValue = this.wp,
      wqValue = this.wq,
      wsValue = this.ws,
      rootDeltaX = wpValue[0] - this.lastX,
      rootDeltaY = wpValue[1] - this.lastY,
      rootDeltaZ = wpValue[2] - this.lastZ,
      hasRootMoved = rootDeltaX * rootDeltaX + rootDeltaY * rootDeltaY + rootDeltaZ * rootDeltaZ > 4
    ;((this.lastX = wpValue[0]), (this.lastY = wpValue[1]), (this.lastZ = wpValue[2]))
    const clampedTimeStep = Math.min(timeStep, 1 / 24)
    for (let index = 0; index < rigValue.chains.length; index++) {
      const selectedChains = rigValue.chains[index],
        chainState = this.chains[index],
        lengthValue = selectedChains.joints.length
      if (hasRootMoved && chainState.ready) for (let pointIndex = 0; pointIndex < lengthValue; pointIndex++) ((chainState.p[pointIndex * 3] += rootDeltaX), (chainState.p[pointIndex * 3 + 1] += rootDeltaY), (chainState.p[pointIndex * 3 + 2] += rootDeltaZ), (chainState.prev[pointIndex * 3] += rootDeltaX), (chainState.prev[pointIndex * 3 + 1] += rootDeltaY), (chainState.prev[pointIndex * 3 + 2] += rootDeltaZ))
      const dampingFactor = Math.pow(selectedChains.drag, clampedTimeStep * 60),
        followFactor = 1 - Math.exp(-selectedChains.stiffness * clampedTimeStep),
        maxAngleCos = Math.cos(selectedChains.maxAngle * DEG_TO_RAD),
        maxAngleSin = Math.sin(selectedChains.maxAngle * DEG_TO_RAD),
        windSway = (selectedChains.wind ?? 0) * (0.55 + 0.45 * Math.sin(time * 2.3 + this.phase + index * 1.7)) + (selectedChains.wind ?? 0) * 0.25 * Math.sin(time * 7.1 + this.phase * 2 + index)
      for (let jointIndex = 0; jointIndex < lengthValue; jointIndex++) {
        const selectedJoints = selectedChains.joints[jointIndex],
          selectedParent = rigValue.parent[selectedJoints],
          selectedR = wsValue[selectedJoints]
        ;(jointIndex > 0 && ((wpValue[selectedJoints * 3] = chainState.p[(jointIndex - 1) * 3]), (wpValue[selectedJoints * 3 + 1] = chainState.p[(jointIndex - 1) * 3 + 1]), (wpValue[selectedJoints * 3 + 2] = chainState.p[(jointIndex - 1) * 3 + 2])), multiplyQuaternions(wqValue, selectedParent * 4, pose.q, selectedJoints * 4, SCRATCH_QUAT_A, 0))
        let boneDirX, boneDirY, boneDirZ
        if (jointIndex < lengthValue - 1) {
          const nextJoint = selectedChains.joints[jointIndex + 1]
          ;((boneDirX = rigValue.local[nextJoint * 3] + pose.t[nextJoint * 3]), (boneDirY = rigValue.local[nextJoint * 3 + 1] + pose.t[nextJoint * 3 + 1]), (boneDirZ = rigValue.local[nextJoint * 3 + 2] + pose.t[nextJoint * 3 + 2]))
        } else ((boneDirX = selectedChains.tip[0]), (boneDirY = selectedChains.tip[1]), (boneDirZ = selectedChains.tip[2]))
        const distance = Math.hypot(boneDirX, boneDirY, boneDirZ) || 1e-4
        rotateVectorByQuaternion(SCRATCH_QUAT_A, 0, boneDirX / distance, boneDirY / distance, boneDirZ / distance, SCRATCH_VEC_A, 0)
        const selectedSCRATCH_VEC_A = SCRATCH_VEC_A[0],
          aimDirY = SCRATCH_VEC_A[1],
          aimDirZ = SCRATCH_VEC_A[2],
          boneLength = distance * selectedR,
          selectedA = wpValue[selectedJoints * 3],
          jointWorldY = wpValue[selectedJoints * 3 + 1],
          jointWorldZ = wpValue[selectedJoints * 3 + 2],
          targetX = selectedA + selectedSCRATCH_VEC_A * boneLength,
          targetY = jointWorldY + aimDirY * boneLength,
          targetZ = jointWorldZ + aimDirZ * boneLength,
          jointOffset = jointIndex * 3
        let total, jointPosY, jointPosZ
        if (!chainState.ready) ((total = targetX), (jointPosY = targetY), (jointPosZ = targetZ), (chainState.prev[jointOffset] = total), (chainState.prev[jointOffset + 1] = jointPosY), (chainState.prev[jointOffset + 2] = jointPosZ))
        else if (((total = chainState.p[jointOffset]), (jointPosY = chainState.p[jointOffset + 1]), (jointPosZ = chainState.p[jointOffset + 2]), clampedTimeStep > 0)) {
          const velocityX = (total - chainState.prev[jointOffset]) * dampingFactor,
            velocityY = (jointPosY - chainState.prev[jointOffset + 1]) * dampingFactor,
            velocityZ = (jointPosZ - chainState.prev[jointOffset + 2]) * dampingFactor
          ;((chainState.prev[jointOffset] = total), (chainState.prev[jointOffset + 1] = jointPosY), (chainState.prev[jointOffset + 2] = jointPosZ))
          const timeStepSquared = clampedTimeStep * clampedTimeStep
          ;((total += velocityX + IK_SWAY_X_BIAS * windSway * timeStepSquared), (jointPosY += velocityY - selectedChains.gravity * timeStepSquared), (jointPosZ += velocityZ + IK_SWAY_Z_BIAS * windSway * timeStepSquared), (total += (targetX - total) * followFactor), (jointPosY += (targetY - jointPosY) * followFactor), (jointPosZ += (targetZ - jointPosZ) * followFactor))
        }
        let segmentDirX = total - selectedA,
          segmentDirY = jointPosY - jointWorldY,
          segmentDirZ = jointPosZ - jointWorldZ,
          directionLength = Math.hypot(segmentDirX, segmentDirY, segmentDirZ)
        ;(directionLength < 1e-5 && ((segmentDirX = selectedSCRATCH_VEC_A), (segmentDirY = aimDirY), (segmentDirZ = aimDirZ), (directionLength = 1)), (segmentDirX /= directionLength), (segmentDirY /= directionLength), (segmentDirZ /= directionLength))
        const directionDot = segmentDirX * selectedSCRATCH_VEC_A + segmentDirY * aimDirY + segmentDirZ * aimDirZ
        if (directionDot < maxAngleCos) {
          let perpX = segmentDirX - selectedSCRATCH_VEC_A * directionDot,
            perpY = segmentDirY - aimDirY * directionDot,
            perpZ = segmentDirZ - aimDirZ * directionDot
          const perpLength = Math.hypot(perpX, perpY, perpZ) || 1
          ;((perpX /= perpLength), (perpY /= perpLength), (perpZ /= perpLength), (segmentDirX = selectedSCRATCH_VEC_A * maxAngleCos + perpX * maxAngleSin), (segmentDirY = aimDirY * maxAngleCos + perpY * maxAngleSin), (segmentDirZ = aimDirZ * maxAngleCos + perpZ * maxAngleSin))
        }
        if (((total = selectedA + segmentDirX * boneLength), (jointPosY = jointWorldY + segmentDirY * boneLength), (jointPosZ = jointWorldZ + segmentDirZ * boneLength), selectedChains.colliders)) {
          let isActive = !1
          for (const collider of selectedChains.colliders) {
            const colliderScale = wsValue[collider.joint]
            rotateVectorByQuaternion(wqValue, collider.joint * 4, collider.x * colliderScale, collider.y * colliderScale, collider.z * colliderScale, SCRATCH_VEC_B, 0)
            const colliderWorldX = wpValue[collider.joint * 3] + SCRATCH_VEC_B[0],
              colliderWorldY = wpValue[collider.joint * 3 + 1] + SCRATCH_VEC_B[1],
              colliderWorldZ = wpValue[collider.joint * 3 + 2] + SCRATCH_VEC_B[2],
              colliderRadius = collider.r * colliderScale,
              toColliderX = total - colliderWorldX,
              toColliderY = jointPosY - colliderWorldY,
              toColliderZ = jointPosZ - colliderWorldZ,
              distanceToCollider = Math.hypot(toColliderX, toColliderY, toColliderZ)
            distanceToCollider < colliderRadius && distanceToCollider > 1e-5 && ((total = colliderWorldX + (toColliderX / distanceToCollider) * colliderRadius), (jointPosY = colliderWorldY + (toColliderY / distanceToCollider) * colliderRadius), (jointPosZ = colliderWorldZ + (toColliderZ / distanceToCollider) * colliderRadius), (isActive = !0))
          }
          isActive && ((segmentDirX = total - selectedA), (segmentDirY = jointPosY - jointWorldY), (segmentDirZ = jointPosZ - jointWorldZ), (directionLength = Math.hypot(segmentDirX, segmentDirY, segmentDirZ) || 1), (segmentDirX /= directionLength), (segmentDirY /= directionLength), (segmentDirZ /= directionLength), (total = selectedA + segmentDirX * boneLength), (jointPosY = jointWorldY + segmentDirY * boneLength), (jointPosZ = jointWorldZ + segmentDirZ * boneLength))
        }
        ;((chainState.p[jointOffset] = total), (chainState.p[jointOffset + 1] = jointPosY), (chainState.p[jointOffset + 2] = jointPosZ), quatBetweenVectors(selectedSCRATCH_VEC_A, aimDirY, aimDirZ, segmentDirX, segmentDirY, segmentDirZ, SCRATCH_QUAT_B, 0), multiplyQuaternions(SCRATCH_QUAT_B, 0, SCRATCH_QUAT_A, 0, wqValue, selectedJoints * 4))
      }
      chainState.ready = !0
    }
  }
  settle(targetObject, propertyName, iterationCount = 40) {
    for (let index = 0; index < iterationCount; index++) this.simulate(targetObject, 1 / 30, propertyName)
  }
  pack(outBuffer, outOffset) {
    const rig = this.rig,
      jointCount = rig.count,
      worldPositions = this.wp,
      worldQuaternions = this.wq,
      worldScales = this.ws,
      bindPositions = rig.bind
    for (let index = 0; index < jointCount; index++) {
      const jointScale = worldScales[index]
      rotateVectorByQuaternion(worldQuaternions, index * 4, bindPositions[index * 3] * jointScale, bindPositions[index * 3 + 1] * jointScale, bindPositions[index * 3 + 2] * jointScale, SCRATCH_VEC_A, 0)
      const writeOffset = outOffset + index * 8
      ;((outBuffer[writeOffset] = worldPositions[index * 3] - SCRATCH_VEC_A[0]),
        (outBuffer[writeOffset + 1] = worldPositions[index * 3 + 1] - SCRATCH_VEC_A[1]),
        (outBuffer[writeOffset + 2] = worldPositions[index * 3 + 2] - SCRATCH_VEC_A[2]),
        (outBuffer[writeOffset + 3] = jointScale),
        (outBuffer[writeOffset + 4] = worldQuaternions[index * 4]),
        (outBuffer[writeOffset + 5] = worldQuaternions[index * 4 + 1]),
        (outBuffer[writeOffset + 6] = worldQuaternions[index * 4 + 2]),
        (outBuffer[writeOffset + 7] = worldQuaternions[index * 4 + 3]))
    }
  }
  point(jointIndex, offsetX, offsetY, offsetZ, position) {
    const selectedWs = this.ws[jointIndex]
    ;(rotateVectorByQuaternion(this.wq, jointIndex * 4, offsetX * selectedWs, offsetY * selectedWs, offsetZ * selectedWs, SCRATCH_VEC_A, 0), (position.x = this.wp[jointIndex * 3] + SCRATCH_VEC_A[0]), (position.y = this.wp[jointIndex * 3 + 1] + SCRATCH_VEC_A[1]), (position.z = this.wp[jointIndex * 3 + 2] + SCRATCH_VEC_A[2]))
  }
}

const BODY_PROPORTIONS = {
  ankleY: 0.09,
  kneeY: 0.45,
  hipY: 0.82,
  hipX: 0.125,
  pelvisY: 0.86,
  spineY: 1,
  chestY: 1.17,
  neckY: 1.42,
  headY: 1.47,
  clavX: 0.09,
  shoulderX: 0.3,
  shoulderY: 1.37,
  elbowY: 1.09,
  wristY: 0.83,
  handY: 0.75,
}

const WARRIOR_PALETTE = {
    red: 13384230,
    redDark: 9052184,
    redLight: 15294778,
    ironLight: 8156794,
    ironDark: 2893609,
    brass: 14852410,
    brassDark: 10118946,
    steel: 13159636,
    steelDark: 6777718,
    beard: 8007196,
    beardHi: 11094568,
    skin: 14260850,
    robe: 10119740,
    robeDark: 7096104,
    leather: 3877669,
    leatherDark: 2234646,
    shaft: 5909538,
    edge: 16756823,
  },
  WARRIOR_PROPORTIONS = { ...BODY_PROPORTIONS, hipX: 0.15, shoulderX: 0.34, clavX: 0.11 },
  HERO_MODEL_SCALE = 1.24,
  MODEL_ANGLE_TO_RAD = Math.PI / 180,
  BODY_ANCHOR_HEIGHTS = { head: 1.34, butt: -0.52 }

export { BODY_PROPORTIONS, BODY_ANCHOR_HEIGHTS, SkeletonSolver, WARRIOR_PALETTE, DEG_TO_RAD, HERO_MODEL_SCALE, WARRIOR_PROPORTIONS, buildWorldSync, MODEL_ANGLE_TO_RAD }
