/**
 * 单位姿态3
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { applyPose, readPoseBones, spriteWorldTransform } from './fx-sprite'

function buildFenglingPoseSet(spriteSpec) {
  const applyPoseResult = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.02, 0],
      hips: [0, -22, -2],
      spine: [0, 4, 1],
      chest: [-2, 4, 0],
      neck: [0, 8, 0],
      head: [-2, 10, 0],
      footL: [0.14, 0.09, 0.12, 0, 0],
      footR: [-0.15, 0.09, -0.1, 0, -34],
      armL: [-6, 0, 22],
      foreL: [-30, 0, 0],
      propL: [-50, 0, -30],
      armR: [22, 0, -14],
      foreR: [-24, 0, 0],
    }),
    aimPose = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.08, 0],
      hips: [0, -48, 0],
      spine: [0, -16, 0],
      chest: [-2, -22, 0],
      neck: [0, 36, 0],
      head: [0, 44, 0],
      footL: [0.1, 0.09, 0.32, 0, -24],
      footR: [-0.12, 0.09, -0.28, 0, -80],
      armL: [0, 6, 88],
      foreL: [0, 0, 0],
      propL: [0, 90, 0],
    }),
    aimLowPose = applyPose(spriteSpec, aimPose, { hipsPos: [0, -0.18, -0.02], spine: [4, -16, 0], footL: [0.12, 0.09, 0.4, 0, -24], footR: [-0.14, 0.09, -0.34, 0, -80] }),
    aimUpPose = applyPose(spriteSpec, aimPose, { hipsPos: [0, -0.12, -0.04], spine: [0, -16, 12], chest: [-2, -22, 20], neck: [-10, 36, -8], head: [-24, 44, 0], armL: [0, 6, 104] }),
    runArmsPose = applyPose(spriteSpec, null, { armL: [-20, 0, 14], foreL: [-50, 0, 0], propL: [-30, 0, 20], armR: [0, 0, -12], foreR: [-70, 0, 0] }),
    tuckPose = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.16, 0],
      hips: [34, 0, 0],
      spine: [22, 0, 0],
      chest: [16, 0, 0],
      head: [24, 0, 0],
      footL: [0.12, 0.38, 0.16, 30, 0],
      footR: [-0.12, 0.3, 0.02, 40, 0],
      armL: [-40, 0, 30],
      foreL: [-70, 0, 0],
      propL: [-20, 0, 30],
      armR: [-34, 0, -26],
      foreR: [-90, 0, 0],
    }),
    channelPose = applyPose(spriteSpec, null, {
      hipsPos: [0, -0.04, 0],
      hips: [0, -10, 0],
      spine: [2, 2, 0],
      chest: [2, 4, 0],
      neck: [4, 0, 0],
      head: [10, 4, 0],
      footL: [0.15, 0.09, 0.06, 0, 6],
      footR: [-0.15, 0.09, -0.04, 0, -16],
      armL: [-38, 0, 14],
      foreL: [-56, 0, 0],
      propL: [-34, 0, -8],
    }),
    spriteWorldTransformResult = spriteWorldTransform(spriteSpec, applyPoseResult, { limp: { propL: [-30, 0, 20] }, lying: { armL: [-6, 0, 70], propL: [20, 90, -20] } })
  return { stance: applyPoseResult, aim: aimPose, aimLow: aimLowPose, aimUp: aimUpPose, tmp: readPoseBones(spriteSpec), runArms: runArmsPose, tuck: tuckPose, channel: channelPose, common: spriteWorldTransformResult }
}

export { buildFenglingPoseSet }
