/**
 * 单位骨架构建 buildSkeleton（按 RIG_PROPORTIONS 生成 root→hips→spine→chest 层级）（原 starfall.core.js 第 38759-38813 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
import { NodeTree } from './node-tree'
function buildSkeleton(rigProportions) {
  const rig = new NodeTree(),
    rootJoint = rig.add("root", -1, 0, 0, 0),
    hipsJoint = rig.add("hips", rootJoint, 0, rigProportions.pelvisY, 0),
    spineJoint = rig.add("spine", hipsJoint, 0, rigProportions.spineY, 0),
    chestJoint = rig.add("chest", spineJoint, 0, rigProportions.chestY, 0),
    neckJoint = rig.add("neck", chestJoint, 0, rigProportions.neckY, 0),
    headJoint = rig.add("head", neckJoint, 0, rigProportions.headY, 0),
    buildArmChain = (heroId, bodySide) => {
      const clavicleJoint = rig.add(`clav${bodySide}`, chestJoint, heroId * rigProportions.clavX, rigProportions.shoulderY - 0.02, 0),
        armJoint = rig.add(`arm${bodySide}`, clavicleJoint, heroId * rigProportions.shoulderX, rigProportions.shoulderY, 0),
        forearmJoint = rig.add(`fore${bodySide}`, armJoint, heroId * rigProportions.shoulderX, rigProportions.elbowY, 0),
        handJoint = rig.add(`hand${bodySide}`, forearmJoint, heroId * rigProportions.shoulderX, rigProportions.wristY, 0),
        propJoint = rig.add(`prop${bodySide}`, handJoint, heroId * rigProportions.shoulderX, rigProportions.handY, 0)
      return [clavicleJoint, armJoint, forearmJoint, handJoint, propJoint]
    },
    [leftClavicleJoint, leftArmJoint, leftForearmJoint, leftHandJoint, leftPropJoint] = buildArmChain(1, "L"),
    [rightClavicleJoint, rightArmJoint, rightForearmJoint, rightHandJoint, rightPropJoint] = buildArmChain(-1, "R"),
    buildLegChain = (sideSign, bodySide) => {
      const thighJoint = rig.add(`thigh${bodySide}`, hipsJoint, sideSign * rigProportions.hipX, rigProportions.hipY, 0),
        shinJoint = rig.add(`shin${bodySide}`, thighJoint, sideSign * rigProportions.hipX, rigProportions.kneeY, 0),
        footJoint = rig.add(`foot${bodySide}`, shinJoint, sideSign * rigProportions.hipX, rigProportions.ankleY, 0)
      return [thighJoint, shinJoint, footJoint]
    },
    [leftThighJoint, leftShinJoint, leftFootJoint] = buildLegChain(1, "L"),
    [rightThighJoint, rightShinJoint, rightFootJoint] = buildLegChain(-1, "R")
  return {
    rig: rig,
    d: rigProportions,
    J: {
      root: rootJoint,
      hips: hipsJoint,
      spine: spineJoint,
      chest: chestJoint,
      neck: neckJoint,
      head: headJoint,
      clavL: leftClavicleJoint,
      armL: leftArmJoint,
      foreL: leftForearmJoint,
      handL: leftHandJoint,
      propL: leftPropJoint,
      clavR: rightClavicleJoint,
      armR: rightArmJoint,
      foreR: rightForearmJoint,
      handR: rightHandJoint,
      propR: rightPropJoint,
      thighL: leftThighJoint,
      shinL: leftShinJoint,
      footL: leftFootJoint,
      thighR: rightThighJoint,
      shinR: rightShinJoint,
      footR: rightFootJoint,
    },
  }
}

export { buildSkeleton }
