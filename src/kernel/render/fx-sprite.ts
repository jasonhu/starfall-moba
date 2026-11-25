/**
 * FX 精灵与屏幕特效工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */



const EASING_FUNCTIONS = { lin: (progress) => progress, in: (progress) => progress * progress, out: (progress) => 1 - (1 - progress) * (1 - progress), io: (progress) => progress * progress * (3 - 2 * progress), in3: (progress) => progress * progress * progress },
  clampUnitInput = (progress) => (progress < 0 ? 0 : progress > 1 ? 1 : progress),
  remapSmoothStep = (progress, lowerBound, upperBound) => clampUnitInput((progress - lowerBound) / (upperBound - lowerBound)),
  lerpNumeric = (startAmount, endAmount, blendFactor) => startAmount + (endAmount - startAmount) * blendFactor,
  bellPulseWindow = (phase, pulseCenter, pulseHalfWidth) => {
    const clampUnitInputResult = clampUnitInput(1 - Math.abs(phase - pulseCenter) / pulseHalfWidth)
    return clampUnitInputResult * clampUnitInputResult * (3 - 2 * clampUnitInputResult)
  }

function readPoseBones(spriteSpec) {
  const durationValue = spriteSpec.d
  return {
    e: new Float32Array(spriteSpec.rig.count * 3),
    hips: new Float32Array(3),
    footL: new Float32Array([durationValue.hipX + 0.04, durationValue.ankleY, 0, 0, 0]),
    footR: new Float32Array([-durationValue.hipX - 0.04, durationValue.ankleY, 0, 0, 0]),
    root: new Float32Array(3),
  }
}

function copyPoseInto(targetPose, carry) {
  return (targetPose.e.set(carry.e), targetPose.hips.set(carry.hips), targetPose.footL.set(carry.footL), targetPose.footR.set(carry.footR), targetPose.root.set(carry.root), targetPose)
}

function applyPose(spriteSpec, reusePose, poseOverrides) {
  const PoseBonesValue = readPoseBones(spriteSpec)
  reusePose && copyPoseInto(PoseBonesValue, reusePose)
  for (const hipsposKind in poseOverrides) {
    const lookupKey = poseOverrides[hipsposKind]
    if (hipsposKind === "hipsPos") PoseBonesValue.hips.set(lookupKey)
    else if (hipsposKind === "rootPos") PoseBonesValue.root.set(lookupKey)
    else if (hipsposKind === "footL" || hipsposKind === "footR") {
      const targetFootPose = hipsposKind === "footL" ? PoseBonesValue.footL : PoseBonesValue.footR
      for (let index = 0; index < lookupKey.length; index++) targetFootPose[index] = lookupKey[index]
    } else {
      const idResult = spriteSpec.rig.id(hipsposKind)
      ;((PoseBonesValue.e[idResult * 3] = lookupKey[0] ?? 0), (PoseBonesValue.e[idResult * 3 + 1] = lookupKey[1] ?? 0), (PoseBonesValue.e[idResult * 3 + 2] = lookupKey[2] ?? 0))
    }
  }
  return PoseBonesValue
}

function parsePoseSpec(bushMap) {
  return bushMap.map(([keyframeTime, keyframePose, easingFunction]) => ({ t: keyframeTime, k: keyframePose, ease: easingFunction ?? EASING_FUNCTIONS.io }))
}

/**
 * 处理战场。
 *
 * @param spriteSpec - 主要输入
 * @param stancePose - 次要输入
 * @param transformOverrides - 第三输入
 * @returns 结果对象
 */
/** spriteWorldTransform 的可选姿态覆盖：limp/lying 为按骨骼名的旋转数组，lieY 为躺姿高度。 */
interface SpriteTransformOverrides {
  limp?: Record<string, number[]>
  lying?: Record<string, number[]>
  lieY?: number
}

function spriteWorldTransform(spriteSpec, stancePose, transformOverrides: SpriteTransformOverrides = {}) {
  const dValue = spriteSpec.d,
    hipAnkleHeight = dValue.hipY - dValue.ankleY,
    limpOverrides = transformOverrides.limp ?? {},
    applyPoseResult = applyPose(spriteSpec, stancePose, {
      hipsPos: [0, -0.12 * hipAnkleHeight, 0],
      hips: [6, 0, 0],
      spine: [10, 0, 0],
      chest: [8, 0, 0],
      neck: [14, 0, 0],
      head: [18, 0, 0],
      armL: [6, 0, 14],
      foreL: [-14, 0, 0],
      armR: [6, 0, -14],
      foreR: [-14, 0, 0],
      ...limpOverrides,
    }),
    airbornePose = applyPose(spriteSpec, null, {
      hips: [-24, 0, 0],
      spine: [-10, 0, 0],
      chest: [-12, 0, 0],
      head: [-16, 0, 0],
      footL: [dValue.hipX + 0.04, dValue.ankleY + 0.3 * hipAnkleHeight, 0.34 * hipAnkleHeight, 30, 10],
      footR: [-dValue.hipX - 0.04, dValue.ankleY + 0.16 * hipAnkleHeight, 0.16 * hipAnkleHeight, 40, -10],
      armL: [-30, 0, 70],
      foreL: [-30, 0, 0],
      armR: [-20, 0, -80],
      foreR: [-40, 0, 0],
      ...limpOverrides,
    }),
    collapsePose = applyPose(spriteSpec, stancePose, { hipsPos: [0, -0.4 * hipAnkleHeight, -0.12 * hipAnkleHeight], hips: [-20, 0, 0], spine: [-14, 0, 0], chest: [-12, 0, 0], head: [-24, 0, 0], armL: [-10, 0, 50], armR: [-10, 0, -50], ...limpOverrides }),
    lyingHeight = transformOverrides.lieY ?? 0.17,
    lyingPose = applyPose(spriteSpec, null, {
      hipsPos: [0, lyingHeight - dValue.pelvisY, -0.5 * hipAnkleHeight],
      hips: [-84, 0, 0],
      spine: [-4, 0, 0],
      chest: [-2, 6, 0],
      neck: [0, 10, 0],
      head: [0, 24, 0],
      footL: [dValue.hipX + 0.08, dValue.ankleY + 0.03, 0.55 * hipAnkleHeight, 50, 24],
      footR: [-dValue.hipX - 0.05, dValue.ankleY + 0.25 * hipAnkleHeight, 0.3 * hipAnkleHeight, 20, -20],
      armL: [-6, 0, 62],
      foreL: [-30, 0, 0],
      armR: [-4, 0, -74],
      foreR: [-14, 0, 0],
      ...limpOverrides,
      ...(transformOverrides.lying ?? {}),
    }),
    parsePoseSpecResult = parsePoseSpec([
      [0, stancePose],
      [0.16, collapsePose, EASING_FUNCTIONS.out],
      [0.42, lyingPose, EASING_FUNCTIONS.in],
      [1, lyingPose, EASING_FUNCTIONS.lin],
    ])
  return { stance: stancePose, stun: applyPoseResult, air: airbornePose, dead: parsePoseSpecResult, tmp: readPoseBones(spriteSpec) }
}

/**
 * 创建特效与精灵。
 *
 * @param spriteSpec - 来源
 * @returns 结果对象
 */
function buildFxSpritePose(spriteSpec) {
  const stancePose = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.06, 0],
      hips: [3, 14, 0],
      spine: [3, -6, 0],
      chest: [2, -8, 0],
      head: [0, -4, 0],
      footL: [0.27, 0.11, 0.14, 0, 16],
      footR: [-0.29, 0.11, -0.12, 0, -24],
      armL: [-26, 0, 20],
      foreL: [-80, -44, 0],
      armR: [-6, 0, -16],
      foreR: [-24, 0, 0],
      propR: [66, -12, 0],
    }),
    guardPose = applyPose(spriteSpec, stancePose, { hipsPos: [0, -0.14, 0.02], hips: [6, 18, 0], chest: [6, -10, 0], armL: [-50, 0, 8], foreL: [-84, -76, 0], armR: [-20, 0, -22], foreR: [-50, 0, 0], propR: [50, -20, 0] }),
    attackWindupPose = applyPose(spriteSpec, stancePose, {
      hipsPos: [0.03, -0.08, -0.06],
      hips: [0, -12, 0],
      spine: [-2, -8, 0],
      chest: [-6, -12, 0],
      head: [0, 22, 0],
      armR: [-150, 0, -46],
      foreR: [-70, 0, 0],
      propR: [-10, -20, 0],
      armL: [-22, 0, 26],
    }),
    attackStrikePose = applyPose(spriteSpec, stancePose, {
      hipsPos: [-0.03, -0.15, 0.14],
      hips: [8, 14, 0],
      spine: [8, 8, 0],
      chest: [10, 12, 0],
      head: [-8, -24, 0],
      footL: [0.27, 0.11, 0.3, 0, 16],
      armR: [-58, 44, -18],
      foreR: [-12, 0, 0],
      propR: [58, 26, 0],
      armL: [6, 0, 34],
      foreL: [-64, -36, 0],
    }),
    attackFollowThroughPose = applyPose(spriteSpec, attackStrikePose, { hips: [10, 20, 0], chest: [12, 16, 0], armR: [-28, 64, -10], foreR: [-20, 0, 0], propR: [84, 36, 0] }),
    attackAKeyframes = parsePoseSpec([
      [0, stancePose],
      [0.22, attackWindupPose, EASING_FUNCTIONS.out],
      [0.35, attackStrikePose, EASING_FUNCTIONS.in3],
      [0.52, attackFollowThroughPose, EASING_FUNCTIONS.out],
      [1, stancePose, EASING_FUNCTIONS.io],
    ]),
    atkBWindupPose = applyPose(spriteSpec, stancePose, { hipsPos: [0, -0.1, -0.04], hips: [0, 18, 0], chest: [-2, 8, 0], armL: [-10, 0, 40], foreL: [-92, -20, 0], armR: [-50, 60, -20], foreR: [-50, 0, 0], propR: [60, 50, 0] }),
    atkBStrikePose = applyPose(spriteSpec, stancePose, {
      hipsPos: [0.03, -0.14, 0.14],
      hips: [8, -16, 0],
      spine: [6, -8, 0],
      chest: [6, -12, 0],
      head: [-6, 26, 0],
      footR: [-0.29, 0.11, 0.1, 0, -10],
      armR: [-50, -46, -76],
      foreR: [-10, 0, 0],
      propR: [50, -30, 0],
      armL: [-46, 0, 34],
      foreL: [-70, -84, 0],
    }),
    atkBKeyframes = parsePoseSpec([
      [0, stancePose],
      [0.22, atkBWindupPose, EASING_FUNCTIONS.out],
      [0.35, atkBStrikePose, EASING_FUNCTIONS.in3],
      [0.55, atkBStrikePose, EASING_FUNCTIONS.out],
      [1, stancePose, EASING_FUNCTIONS.io],
    ]),
    slamWindupPose = applyPose(spriteSpec, stancePose, {
      hipsPos: [0, 0, -0.08],
      hips: [-10, 6, 0],
      spine: [-10, 0, 0],
      chest: [-14, 0, 0],
      head: [10, 0, 0],
      armL: [-150, 0, 16],
      foreL: [-50, -80, 0],
      armR: [-120, 0, -40],
      foreR: [-60, 0, 0],
      propR: [10, 0, 0],
    }),
    slamImpactPose = applyPose(spriteSpec, stancePose, {
      hipsPos: [0, -0.24, 0.16],
      hips: [26, 6, 0],
      spine: [14, 0, 0],
      chest: [14, 0, 0],
      head: [-28, 0, 0],
      footL: [0.3, 0.11, 0.32, 0, 12],
      footR: [-0.3, 0.11, -0.16, 10, -20],
      armL: [-58, 0, 6],
      foreL: [-66, -84, 0],
      shield: [0, 0, -18],
      armR: [-30, 0, -30],
      foreR: [-40, 0, 0],
      propR: [70, -20, 0],
    }),
    slamKeyframes = parsePoseSpec([
      [0, stancePose],
      [0.24, slamWindupPose, EASING_FUNCTIONS.out],
      [0.35, slamImpactPose, EASING_FUNCTIONS.in3],
      [0.62, slamImpactPose, EASING_FUNCTIONS.lin],
      [1, stancePose, EASING_FUNCTIONS.io],
    ]),
    s2WindupPose = applyPose(spriteSpec, stancePose, { hipsPos: [0, 0.03, -0.05], chest: [-12, 0, 0], head: [6, 0, 0], armL: [-62, 0, 26], foreL: [-96, -60, 0], armR: [-10, 0, -44], foreR: [-50, 0, 0] }),
    s2StrikePose = applyPose(spriteSpec, guardPose, {
      hipsPos: [0, -0.26, 0.08],
      hips: [14, 12, 0],
      chest: [10, -6, 0],
      armL: [-44, 0, 4],
      foreL: [-86, -84, 0],
      neck: [-16, 0, 0],
      head: [-26, 0, 0],
      armR: [10, 0, -50],
      foreR: [-30, 0, 0],
      propR: [40, -30, 0],
    }),
    s2Keyframes = parsePoseSpec([
      [0, stancePose],
      [0.3, s2WindupPose, EASING_FUNCTIONS.out],
      [0.55, s2StrikePose, EASING_FUNCTIONS.in3],
      [0.8, s2StrikePose, EASING_FUNCTIONS.lin],
      [1, guardPose, EASING_FUNCTIONS.io],
    ]),
    leapStartPose = applyPose(spriteSpec, stancePose, { hipsPos: [0, -0.28, 0], hips: [18, 0, 0], chest: [10, 0, 0], armR: [20, 0, -30], propR: [80, -10, 0] }),
    leapRisePose = applyPose(spriteSpec, null, {
      hips: [-16, 0, 0],
      spine: [-10, 0, 0],
      chest: [-12, 0, 0],
      head: [12, 0, 0],
      footL: [0.24, 0.42, 0.12, 30, 10],
      footR: [-0.24, 0.3, -0.22, 50, -10],
      armR: [-150, 0, -70],
      foreR: [-30, 0, 0],
      propR: [-20, 0, 0],
      armL: [-120, 0, 60],
      foreL: [-60, -40, 0],
    }),
    leapLandPose = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.1, 0.1],
      hips: [32, 0, 0],
      spine: [14, 0, 0],
      chest: [14, 0, 0],
      head: [-32, 0, 0],
      footL: [0.3, 0.2, 0.3, -10, 10],
      footR: [-0.3, 0.2, -0.24, 40, -16],
      armL: [-70, 0, 4],
      foreL: [-60, -84, 0],
      shield: [0, 0, -24],
      armR: [-40, 0, -60],
      foreR: [-30, 0, 0],
      propR: [40, -20, 0],
    }),
    leapRecoverPose = applyPose(spriteSpec, leapLandPose, { hipsPos: [0, -0.32, 0.16], footL: [0.32, 0.11, 0.34, 0, 12], footR: [-0.32, 0.11, -0.18, 10, -20], armL: [-56, 0, 4], shield: [0, 0, -30] }),
    leapKeyframes = parsePoseSpec([
      [0, leapStartPose],
      [0.3, leapRisePose, EASING_FUNCTIONS.out],
      [0.62, leapRisePose, EASING_FUNCTIONS.lin],
      [0.86, leapLandPose, EASING_FUNCTIONS.in],
      [1, leapRecoverPose, EASING_FUNCTIONS.in],
    ]),
    runArmsPose = applyPose(spriteSpec, null, { armL: [-28, 0, 18], foreL: [-76, -44, 0], armR: [0, 0, -18], foreR: [-40, 0, 0], propR: [50, -10, 0] }),
    chargePose = applyPose(spriteSpec, null, { armL: [-58, 0, 2], foreL: [-84, -62, 0], armR: [44, 0, -26], foreR: [-20, 0, 0], propR: [100, -10, 0], head: [-16, 0, 0] }),
    channelPose = applyPose(spriteSpec, stancePose, { hipsPos: [0, -0.2, 0], hips: [8, 0, 0], chest: [6, 0, 0], head: [12, 0, 0], armR: [-40, 30, -4], foreR: [-40, 0, 0], propR: [130, 0, 0], armL: [-6, 0, 24], foreL: [-46, -30, 0] }),
    spriteWorldTransformResult = spriteWorldTransform(spriteSpec, stancePose, { limp: { propR: [84, -8, 0], foreL: [-30, -30, 0] }, lying: { armR: [-4, 0, -70], propR: [70, -10, 0], armL: [-6, 0, 56], foreL: [-20, -20, 0] }, lieY: 0.3 })
  return { stance: stancePose, guard: guardPose, tmp: readPoseBones(spriteSpec), atkA: attackAKeyframes, atkB: atkBKeyframes, slam: slamKeyframes, s2: s2Keyframes, leap: leapKeyframes, runArms: runArmsPose, charge: chargePose, channel: channelPose, common: spriteWorldTransformResult }
}

export { EASING_FUNCTIONS, buildFxSpritePose, lerpNumeric, spriteWorldTransform, applyPose, clampUnitInput, bellPulseWindow, readPoseBones, remapSmoothStep, copyPoseInto, parsePoseSpec }