/**
 * 特效生成器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */



function multiplyQuaternions(quatA, quatAOffset, quatB, quatBOffset, resultQuat, resultOffset) {
  const selectedN = quatA[quatAOffset],
    quatAY = quatA[quatAOffset + 1],
    quatAZ = quatA[quatAOffset + 2],
    quatAW = quatA[quatAOffset + 3],
    selectedE = quatB[quatBOffset],
    quatBY = quatB[quatBOffset + 1],
    quatBZ = quatB[quatBOffset + 2],
    quatBW = quatB[quatBOffset + 3]
  ;((resultQuat[resultOffset] = selectedN * quatBW + quatAW * selectedE + quatAY * quatBZ - quatAZ * quatBY), (resultQuat[resultOffset + 1] = quatAY * quatBW + quatAW * quatBY + quatAZ * selectedE - selectedN * quatBZ), (resultQuat[resultOffset + 2] = quatAZ * quatBW + quatAW * quatBZ + selectedN * quatBY - quatAY * selectedE), (resultQuat[resultOffset + 3] = quatAW * quatBW - selectedN * selectedE - quatAY * quatBY - quatAZ * quatBZ))
}

function rotateVectorByQuaternion(rotationQuat, quatOffset, vectorX, vectorY, vectorZ, resultVector, resultOffset, vectorScale = 1) {
  const scaledQuatX = rotationQuat[quatOffset] * vectorScale,
    scaledQuatY = rotationQuat[quatOffset + 1] * vectorScale,
    scaledQuatZ = rotationQuat[quatOffset + 2] * vectorScale,
    quatW = rotationQuat[quatOffset + 3],
    crossTermX = 2 * (scaledQuatY * vectorZ - scaledQuatZ * vectorY),
    crossTermY = 2 * (scaledQuatZ * vectorX - scaledQuatX * vectorZ),
    crossTermZ = 2 * (scaledQuatX * vectorY - scaledQuatY * vectorX)
  ;((resultVector[resultOffset] = vectorX + quatW * crossTermX + (scaledQuatY * crossTermZ - scaledQuatZ * crossTermY)), (resultVector[resultOffset + 1] = vectorY + quatW * crossTermY + (scaledQuatZ * crossTermX - scaledQuatX * crossTermZ)), (resultVector[resultOffset + 2] = vectorZ + quatW * crossTermZ + (scaledQuatX * crossTermY - scaledQuatY * crossTermX)))
}

function quaternionFromBasisVectors(basisM11, basisM21, basisM31, basisM12, basisM22, basisM32, basisM13, basisM23, basisM33, resultQuat, resultOffset) {
  const matrixTrace = basisM11 + basisM22 + basisM33
  if (matrixTrace > 0) {
    const traceScale = 0.5 / Math.sqrt(matrixTrace + 1)
    ;((resultQuat[resultOffset + 3] = 0.25 / traceScale), (resultQuat[resultOffset] = (basisM32 - basisM23) * traceScale), (resultQuat[resultOffset + 1] = (basisM13 - basisM31) * traceScale), (resultQuat[resultOffset + 2] = (basisM21 - basisM12) * traceScale))
  } else if (basisM11 > basisM22 && basisM11 > basisM33) {
    const dominantXScale = 2 * Math.sqrt(1 + basisM11 - basisM22 - basisM33)
    ;((resultQuat[resultOffset + 3] = (basisM32 - basisM23) / dominantXScale), (resultQuat[resultOffset] = 0.25 * dominantXScale), (resultQuat[resultOffset + 1] = (basisM12 + basisM21) / dominantXScale), (resultQuat[resultOffset + 2] = (basisM13 + basisM31) / dominantXScale))
  } else if (basisM22 > basisM33) {
    const dominantYScale = 2 * Math.sqrt(1 + basisM22 - basisM11 - basisM33)
    ;((resultQuat[resultOffset + 3] = (basisM13 - basisM31) / dominantYScale), (resultQuat[resultOffset] = (basisM12 + basisM21) / dominantYScale), (resultQuat[resultOffset + 1] = 0.25 * dominantYScale), (resultQuat[resultOffset + 2] = (basisM23 + basisM32) / dominantYScale))
  } else {
    const dominantZScale = 2 * Math.sqrt(1 + basisM33 - basisM11 - basisM22)
    ;((resultQuat[resultOffset + 3] = (basisM21 - basisM12) / dominantZScale), (resultQuat[resultOffset] = (basisM13 + basisM31) / dominantZScale), (resultQuat[resultOffset + 1] = (basisM23 + basisM32) / dominantZScale), (resultQuat[resultOffset + 2] = 0.25 * dominantZScale))
  }
}

const SCRATCH_VEC_A = [0, 0, 0],
  SCRATCH_VEC_B = [0, 0, 0],
  SCRATCH_QUAT_A = [0, 0, 0, 1],
  SCRATCH_QUAT_B = [0, 0, 0, 1],
  SCRATCH_QUAT_C = [0, 0, 0, 1],
  IK_SWAY_X_BIAS = 0.82,
  IK_SWAY_Z_BIAS = -0.57

const SCRATCH_POSITION_DELTA = [0, 0, 0],
  ACCUMULATED_ROTATION_QUAT = [0, 0, 0, 1],
  ANCESTOR_INDEX_CHAIN = []

function accumulateAncestorTransform(skeleton, pose, handR, outTranslation, outRotation) {
  ANCESTOR_INDEX_CHAIN.length = 0
  for (let index = handR; index > 0; index = skeleton.parent[index]) ANCESTOR_INDEX_CHAIN.push(index)
  let total = 0,
    translationY = 0,
    translationZ = 0
  ;((ACCUMULATED_ROTATION_QUAT[0] = 0), (ACCUMULATED_ROTATION_QUAT[1] = 0), (ACCUMULATED_ROTATION_QUAT[2] = 0), (ACCUMULATED_ROTATION_QUAT[3] = 1))
  for (let ancestorIndex = ANCESTOR_INDEX_CHAIN.length - 1; ancestorIndex >= 0; ancestorIndex--) {
    const selectedANCESTOR_INDEX_CHAIN = ANCESTOR_INDEX_CHAIN[ancestorIndex]
    ;(rotateVectorByQuaternion(ACCUMULATED_ROTATION_QUAT, 0, skeleton.local[selectedANCESTOR_INDEX_CHAIN * 3] + pose.t[selectedANCESTOR_INDEX_CHAIN * 3], skeleton.local[selectedANCESTOR_INDEX_CHAIN * 3 + 1] + pose.t[selectedANCESTOR_INDEX_CHAIN * 3 + 1], skeleton.local[selectedANCESTOR_INDEX_CHAIN * 3 + 2] + pose.t[selectedANCESTOR_INDEX_CHAIN * 3 + 2], SCRATCH_POSITION_DELTA, 0), (total += SCRATCH_POSITION_DELTA[0]), (translationY += SCRATCH_POSITION_DELTA[1]), (translationZ += SCRATCH_POSITION_DELTA[2]), multiplyQuaternions(ACCUMULATED_ROTATION_QUAT, 0, pose.q, selectedANCESTOR_INDEX_CHAIN * 4, ACCUMULATED_ROTATION_QUAT, 0))
  }
  ;((outTranslation[0] = total), (outTranslation[1] = translationY), (outTranslation[2] = translationZ), (outRotation[0] = ACCUMULATED_ROTATION_QUAT[0]), (outRotation[1] = ACCUMULATED_ROTATION_QUAT[1]), (outRotation[2] = ACCUMULATED_ROTATION_QUAT[2]), (outRotation[3] = ACCUMULATED_ROTATION_QUAT[3]))
}

const ANCESTOR_TRANSLATION_SCRATCH = [0, 0, 0],
  ANCESTOR_ROTATION_SCRATCH = [0, 0, 0, 1],
  IK_CROSS_TARGET_SCRATCH = [0, 0, 0],
  IK_ROTATED_AXIS_SCRATCH = [0, 0, 0],
  SCRATCH_QUAT_D = [0, 0, 0, 1],
  SCRATCH_QUAT_E = [0, 0, 0, 1],
  SCRATCH_QUAT_F = [0, 0, 0, 1],
  IK_CHAIN_VECTOR_SCRATCH = [0, 0, 0],
  IK_PERPENDICULAR_SCRATCH = [0, 0, 0]

function crossProductToQuaternion(baseX, baseY, baseZ, targetX, targetY, targetZ, outQuaternion) {
  const basisCrossX = targetY * baseZ - targetZ * baseY,
    basisCrossY = targetZ * baseX - targetX * baseZ,
    basisCrossZ = targetX * baseY - targetY * baseX
  quaternionFromBasisVectors(baseX, baseY, baseZ, basisCrossX, basisCrossY, basisCrossZ, targetX, targetY, targetZ, outQuaternion, 0)
}

function solveTwoBoneIK(skeleton, pose, upper, lower, tip, targetX, targetY, targetZ, poleX, poleY, poleZ, referenceAxisZ = 1, outRotation?) {
  const selectedParent = skeleton.parent[upper]
  ;(accumulateAncestorTransform(skeleton, pose, selectedParent, ANCESTOR_TRANSLATION_SCRATCH, ANCESTOR_ROTATION_SCRATCH), rotateVectorByQuaternion(ANCESTOR_ROTATION_SCRATCH, 0, skeleton.local[upper * 3] + pose.t[upper * 3], skeleton.local[upper * 3 + 1] + pose.t[upper * 3 + 1], skeleton.local[upper * 3 + 2] + pose.t[upper * 3 + 2], IK_CROSS_TARGET_SCRATCH, 0))
  const upperJointWorldX = ANCESTOR_TRANSLATION_SCRATCH[0] + IK_CROSS_TARGET_SCRATCH[0],
    upperJointWorldY = ANCESTOR_TRANSLATION_SCRATCH[1] + IK_CROSS_TARGET_SCRATCH[1],
    upperJointWorldZ = ANCESTOR_TRANSLATION_SCRATCH[2] + IK_CROSS_TARGET_SCRATCH[2]
  ;(rotateVectorByQuaternion(ANCESTOR_ROTATION_SCRATCH, 0, targetX - upperJointWorldX, targetY - upperJointWorldY, targetZ - upperJointWorldZ, IK_CROSS_TARGET_SCRATCH, 0, -1), rotateVectorByQuaternion(ANCESTOR_ROTATION_SCRATCH, 0, poleX, poleY, poleZ, IK_ROTATED_AXIS_SCRATCH, 0, -1))
  const selectedLocal = skeleton.local[lower * 3],
    lowerBoneY = skeleton.local[lower * 3 + 1],
    lowerBoneZ = skeleton.local[lower * 3 + 2],
    tipBoneX = skeleton.local[tip * 3],
    tipBoneY = skeleton.local[tip * 3 + 1],
    tipBoneZ = skeleton.local[tip * 3 + 2],
    distance = Math.hypot(selectedLocal, lowerBoneY, lowerBoneZ),
    tipSegmentLength = Math.hypot(tipBoneX, tipBoneY, tipBoneZ)
  let targetDistance = Math.hypot(IK_CROSS_TARGET_SCRATCH[0], IK_CROSS_TARGET_SCRATCH[1], IK_CROSS_TARGET_SCRATCH[2])
  targetDistance < 1e-5 && ((IK_CROSS_TARGET_SCRATCH[1] = -1), (targetDistance = 1e-5))
  const targetDirectionX = IK_CROSS_TARGET_SCRATCH[0] / targetDistance,
    targetDirectionY = IK_CROSS_TARGET_SCRATCH[1] / targetDistance,
    targetDirectionZ = IK_CROSS_TARGET_SCRATCH[2] / targetDistance
  targetDistance = Math.min(Math.max(targetDistance, Math.abs(distance - tipSegmentLength) + 0.001), distance + tipSegmentLength - 0.001)
  const bendAngleCos = Math.min(1, Math.max(-1, (distance * distance + targetDistance * targetDistance - tipSegmentLength * tipSegmentLength) / (2 * distance * targetDistance))),
    bendAngleSin = Math.sqrt(1 - bendAngleCos * bendAngleCos)
  let axisTargetDot = IK_ROTATED_AXIS_SCRATCH[0] * targetDirectionX + IK_ROTATED_AXIS_SCRATCH[1] * targetDirectionY + IK_ROTATED_AXIS_SCRATCH[2] * targetDirectionZ,
    perpAxisX = IK_ROTATED_AXIS_SCRATCH[0] - targetDirectionX * axisTargetDot,
    perpAxisY = IK_ROTATED_AXIS_SCRATCH[1] - targetDirectionY * axisTargetDot,
    perpAxisZ = IK_ROTATED_AXIS_SCRATCH[2] - targetDirectionZ * axisTargetDot,
    perpAxisLength = Math.hypot(perpAxisX, perpAxisY, perpAxisZ)
  ;(perpAxisLength < 1e-4 && ((axisTargetDot = targetDirectionZ), (perpAxisX = -targetDirectionX * axisTargetDot), (perpAxisY = -targetDirectionY * axisTargetDot), (perpAxisZ = 1 - targetDirectionZ * axisTargetDot), (perpAxisLength = Math.hypot(perpAxisX, perpAxisY, perpAxisZ) || 1)),
    (perpAxisX /= perpAxisLength),
    (perpAxisY /= perpAxisLength),
    (perpAxisZ /= perpAxisLength),
    (IK_PERPENDICULAR_SCRATCH[0] = targetDirectionY * perpAxisZ - targetDirectionZ * perpAxisY),
    (IK_PERPENDICULAR_SCRATCH[1] = targetDirectionZ * perpAxisX - targetDirectionX * perpAxisZ),
    (IK_PERPENDICULAR_SCRATCH[2] = targetDirectionX * perpAxisY - targetDirectionY * perpAxisX))
  const bentDirectionX = targetDirectionX * bendAngleCos + perpAxisX * bendAngleSin,
    bentDirectionY = targetDirectionY * bendAngleCos + perpAxisY * bendAngleSin,
    bentDirectionZ = targetDirectionZ * bendAngleCos + perpAxisZ * bendAngleSin
  ;((IK_CHAIN_VECTOR_SCRATCH[0] = (targetDirectionX * targetDistance - bentDirectionX * distance) / tipSegmentLength), (IK_CHAIN_VECTOR_SCRATCH[1] = (targetDirectionY * targetDistance - bentDirectionY * distance) / tipSegmentLength), (IK_CHAIN_VECTOR_SCRATCH[2] = (targetDirectionZ * targetDistance - bentDirectionZ * distance) / tipSegmentLength))
  const boneDirectionToQuaternion = (boneDirX, boneDirY, boneDirZ, outQuaternion) => {
    const distance = Math.hypot(boneDirX, boneDirY, boneDirZ) || 1,
      unitDirX = boneDirX / distance,
      unitDirY = boneDirY / distance,
      unitDirZ = boneDirZ / distance
    let alignCrossX = unitDirY * referenceAxisZ,
      alignCrossY = -unitDirX * referenceAxisZ,
      alignCrossZ = 0
    const alignCrossLength = Math.hypot(alignCrossX, alignCrossY, alignCrossZ)
    ;(alignCrossLength < 1e-4 ? ((alignCrossX = 1), (alignCrossY = 0), (alignCrossZ = 0)) : ((alignCrossX /= alignCrossLength), (alignCrossY /= alignCrossLength), (alignCrossZ /= alignCrossLength)), crossProductToQuaternion(unitDirX, unitDirY, unitDirZ, alignCrossX, alignCrossY, alignCrossZ, outQuaternion))
  }
  ;(boneDirectionToQuaternion(selectedLocal, lowerBoneY, lowerBoneZ, SCRATCH_QUAT_D),
    crossProductToQuaternion(bentDirectionX, bentDirectionY, bentDirectionZ, IK_PERPENDICULAR_SCRATCH[0], IK_PERPENDICULAR_SCRATCH[1], IK_PERPENDICULAR_SCRATCH[2], SCRATCH_QUAT_E),
    (SCRATCH_QUAT_D[0] = -SCRATCH_QUAT_D[0]),
    (SCRATCH_QUAT_D[1] = -SCRATCH_QUAT_D[1]),
    (SCRATCH_QUAT_D[2] = -SCRATCH_QUAT_D[2]),
    multiplyQuaternions(SCRATCH_QUAT_E, 0, SCRATCH_QUAT_D, 0, SCRATCH_QUAT_F, 0),
    (pose.q[upper * 4] = SCRATCH_QUAT_F[0]),
    (pose.q[upper * 4 + 1] = SCRATCH_QUAT_F[1]),
    (pose.q[upper * 4 + 2] = SCRATCH_QUAT_F[2]),
    (pose.q[upper * 4 + 3] = SCRATCH_QUAT_F[3]),
    rotateVectorByQuaternion(SCRATCH_QUAT_F, 0, IK_CHAIN_VECTOR_SCRATCH[0], IK_CHAIN_VECTOR_SCRATCH[1], IK_CHAIN_VECTOR_SCRATCH[2], IK_CROSS_TARGET_SCRATCH, 0, -1),
    rotateVectorByQuaternion(SCRATCH_QUAT_F, 0, IK_PERPENDICULAR_SCRATCH[0], IK_PERPENDICULAR_SCRATCH[1], IK_PERPENDICULAR_SCRATCH[2], IK_ROTATED_AXIS_SCRATCH, 0, -1),
    boneDirectionToQuaternion(tipBoneX, tipBoneY, tipBoneZ, SCRATCH_QUAT_D),
    crossProductToQuaternion(IK_CROSS_TARGET_SCRATCH[0], IK_CROSS_TARGET_SCRATCH[1], IK_CROSS_TARGET_SCRATCH[2], IK_ROTATED_AXIS_SCRATCH[0], IK_ROTATED_AXIS_SCRATCH[1], IK_ROTATED_AXIS_SCRATCH[2], SCRATCH_QUAT_E),
    (SCRATCH_QUAT_D[0] = -SCRATCH_QUAT_D[0]),
    (SCRATCH_QUAT_D[1] = -SCRATCH_QUAT_D[1]),
    (SCRATCH_QUAT_D[2] = -SCRATCH_QUAT_D[2]),
    multiplyQuaternions(SCRATCH_QUAT_E, 0, SCRATCH_QUAT_D, 0, pose.q, lower * 4),
    outRotation && (multiplyQuaternions(ANCESTOR_ROTATION_SCRATCH, 0, SCRATCH_QUAT_F, 0, SCRATCH_QUAT_C, 0), multiplyQuaternions(SCRATCH_QUAT_C, 0, pose.q, lower * 4, outRotation, 0)))
}

export { SCRATCH_VEC_A, rotateVectorByQuaternion, solveTwoBoneIK, accumulateAncestorTransform, multiplyQuaternions, SCRATCH_QUAT_B, SCRATCH_VEC_B, SCRATCH_QUAT_A, ANCESTOR_INDEX_CHAIN, IK_SWAY_Z_BIAS, IK_SWAY_X_BIAS }
