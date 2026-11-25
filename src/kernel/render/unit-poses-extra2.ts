/**
 * 单位姿态补充2
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { EASING_FUNCTIONS, applyPose, parsePoseSpec, readPoseBones, spriteWorldTransform } from './fx-sprite'

function buildXingliPoseSet(spriteSpec) {
  const applyPoseResult = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.01, 0],
      hips: [0, -10, 2],
      spine: [1, 4, -2],
      chest: [2, 4, 0],
      neck: [6, 2, 0],
      head: [8, 6, -3],
      footL: [0.11, 0.09, 0.06, 0, 10],
      footR: [-0.12, 0.09, -0.05, 0, -16],
    }),
    attackPluckPose = applyPose(spriteSpec, applyPoseResult, { hips: [0, -16, 2], chest: [-2, -4, 0], head: [2, 14, -2], pipa: [-8, 0, 4], pluck: [0.02, 0.13, 0.07] }),
    attackPluckRecoverPose = applyPose(spriteSpec, applyPoseResult, { hipsPos: [0, -0.03, 0.04], hips: [2, -2, 0], chest: [6, 10, 0], head: [0, -6, 0], pipa: [14, 0, -4], pipaPos: [0, 0, 0.05], pluck: [-0.03, -0.14, 0.02] }),
    attackPluckFinishPose = applyPose(spriteSpec, attackPluckRecoverPose, { pluck: [-0.1, -0.2, 0.12] }),
    parsePoseSpecResult = parsePoseSpec([
      [0, applyPoseResult],
      [0.2, attackPluckPose, EASING_FUNCTIONS.out],
      [0.35, attackPluckRecoverPose, EASING_FUNCTIONS.in3],
      [0.5, attackPluckFinishPose, EASING_FUNCTIONS.out],
      [1, applyPoseResult, EASING_FUNCTIONS.io],
    ]),
    skillOneWindupPose = applyPose(spriteSpec, applyPoseResult, { hipsPos: [0, -0.03, -0.05], hips: [-2, -22, 0], spine: [-4, -6, 0], chest: [-6, -12, 0], head: [2, 30, 0], pipa: [-12, 0, 8], pluck: [0.04, 0.06, 0] }),
    skillOneStrikePose = applyPose(spriteSpec, applyPoseResult, {
      hipsPos: [0, -0.07, 0.12],
      hips: [8, 6, 0],
      spine: [8, 6, 0],
      chest: [10, 12, 0],
      neck: [-8, 0, 0],
      head: [-10, -14, 0],
      footL: [0.11, 0.09, 0.26, 0, 8],
      footR: [-0.12, 0.1, -0.14, 16, -20],
      pipa: [42, -8, -6],
      pipaPos: [0.02, 0.05, 0.1],
      pluck: [-0.16, -0.06, 0.26],
    }),
    firstSkillAnimation = parsePoseSpec([
      [0, applyPoseResult],
      [0.24, skillOneWindupPose, EASING_FUNCTIONS.out],
      [0.42, skillOneStrikePose, EASING_FUNCTIONS.in3],
      [0.72, skillOneStrikePose, EASING_FUNCTIONS.lin],
      [1, applyPoseResult, EASING_FUNCTIONS.io],
    ]),
    skillTwoWindupPose = applyPose(spriteSpec, applyPoseResult, { hipsPos: [0, -0.03, 0.05], hips: [4, -4, 0], chest: [8, 6, 0], head: [-4, -4, 0], pipa: [20, 0, -6], pipaPos: [0, 0, 0.05], pluck: [-0.18, 0.02, 0.24] }),
    skillTwoStrikePose = applyPose(spriteSpec, applyPoseResult, {
      hipsPos: [0, -0.02, -0.07],
      hips: [-6, -14, 0],
      spine: [-6, 0, 0],
      chest: [-8, -6, 0],
      neck: [-6, 0, 0],
      head: [-12, 10, 0],
      footR: [-0.12, 0.09, -0.16, 0, -20],
      pipa: [-16, 6, 16],
      pipaPos: [0.02, 0.06, -0.03],
      pluck: [0.07, 0.1, -0.01],
      free: [0, 0, -0.1],
    }),
    skillTwoAnimation = parsePoseSpec([
      [0, applyPoseResult],
      [0.3, skillTwoWindupPose, EASING_FUNCTIONS.out],
      [0.5, skillTwoStrikePose, EASING_FUNCTIONS.in3],
      [0.78, skillTwoStrikePose, EASING_FUNCTIONS.lin],
      [1, applyPoseResult, EASING_FUNCTIONS.io],
    ]),
    ultimatePose = applyPose(spriteSpec, applyPoseResult, {
      hipsPos: [0, 0.03, -0.02],
      hips: [-4, 0, 0],
      spine: [-6, 0, 0],
      chest: [-10, 0, 0],
      neck: [-12, 0, 0],
      head: [-20, 0, 0],
      footL: [0.1, 0.11, 0.04, 14, 8],
      footR: [-0.11, 0.11, -0.04, 14, -12],
      pipa: [-10, 4, 12],
      pipaPos: [0.03, 0.1, 0],
      pluck: [0, 0.02, 0.01],
    }),
    ultimateAnimation = parsePoseSpec([
      [0, applyPoseResult],
      [0.4, ultimatePose, EASING_FUNCTIONS.out],
      [1, ultimatePose, EASING_FUNCTIONS.lin],
    ]),
    runPose = applyPose(spriteSpec, null, { pipa: [-6, 0, 4], pipaPos: [0, 0.02, -0.01], head: [-4, 0, 0] }),
    channelPose = applyPose(spriteSpec, applyPoseResult, { hipsPos: [0, -0.03, 0], chest: [6, 0, 0], neck: [10, 0, 0], head: [16, 0, 0], pipa: [-6, 0, 6], pluck: [0.05, 0.02, -0.02] }),
    spriteWorldTransformResult = spriteWorldTransform(spriteSpec, applyPoseResult, { lying: { free: [1, 1, 0], pipaPos: [0.5, -0.1, -0.02], pipa: [14, 0, 70], armL: [-6, 0, 60], foreL: [-24, 0, 0], armR: [-4, 0, -66], foreR: [-16, 0, 0] } })
  return { stance: applyPoseResult, tmp: readPoseBones(spriteSpec), atk: parsePoseSpecResult, s1: firstSkillAnimation, s2: skillTwoAnimation, ult: ultimateAnimation, run: runPose, channel: channelPose, common: spriteWorldTransformResult }
}

export { buildXingliPoseSet }
