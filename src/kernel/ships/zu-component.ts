/**
 * ZU 部件模型
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MATERIAL_KINDS, ModelBuilder, TERRAIN_LOOK, composeMatrix } from '../render/model-builder'
import { inverseLerpClamped, hermiteSmoothStep, hitImpactPulse, easeOutQuad, windupEaseCurve, smoothFalloff } from '../world/po-system'
import { NodeTree } from '../node-tree'

const STRUCTURE_PALETTE = { stone: 8031408, stoneLight: 10004680, stoneDark: 5266554, iron: 4541794, brass: 13214810, cloth: 792624, wood: 6969932 },
  STRUCTURE_MATERIAL_SPEC = Math.PI * 2,
  SURFACE_MATERIAL = { mat: MATERIAL_KINDS.rock, pattern: TERRAIN_LOOK.strata, patternScale: 6, patternAmt: 0.35, grain: 0.06 },
  TOWER_BUILDING_SPEC = { gloss: 0.6, mat: MATERIAL_KINDS.metal },
  BASE_BUILDING_SPEC = { gloss: 0.9, mat: MATERIAL_KINDS.metal },
  TEAM_COLOR_TABLE = { team: 0.82, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.weave, patternScale: 12, patternAmt: 0.35 },
  TEAM_PALETTE_KEYS = (glowIntensity) => ({ team: 1, glow: glowIntensity, mat: MATERIAL_KINDS.crystal, line: 0 })

function BUILDING_GEOMETRY_CACHE(animStateTime) {
  return { slump: easeOutQuad(inverseLerpClamped(animStateTime, 0, 0.22)), burst: easeOutQuad(inverseLerpClamped(animStateTime, 0.22, 0.6)), fall: inverseLerpClamped(animStateTime, 0.3, 0.75) }
}

function TEAM_CRYSTAL_SPEC(poseBuilder, crystalJoint, burstProgress, fallProgress, burstOffsetX, burstOffsetZ, fallDroop, tumbleX, tumbleZ) {
  ;(poseBuilder.move(crystalJoint, burstOffsetX * burstProgress, 0.5 * Math.sin(Math.min(1, burstProgress) * Math.PI) * (1 - fallProgress) - fallDroop * fallProgress * fallProgress, burstOffsetZ * burstProgress), poseBuilder.add(crystalJoint, tumbleX * burstProgress, 0, tumbleZ * burstProgress))
}

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildStructureModelA() {
  const nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    bodyJoint = nodeTree.add("body", rootJoint, 0, 0.52, 0),
    headJoint = nodeTree.add("head", bodyJoint, 0, 1.02, 0.02),
    flameJoint = nodeTree.add("flame", headJoint, 0, 1.24, 0.02),
    armLJoint = nodeTree.add("armL", bodyJoint, 0.27, 0.9, 0.02),
    armRJoint = nodeTree.add("armR", bodyJoint, -0.27, 0.9, 0.02),
    legLJoint = nodeTree.add("legL", rootJoint, 0.12, 0.4, 0),
    legRJoint = nodeTree.add("legR", rootJoint, -0.12, 0.4, 0),
    modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 38),
    modelBuilder.sym((sideSign) => {
      ;(modelBuilder.bone(sideSign > 0 ? legLJoint : legRJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        modelBuilder.lathe(
          [
            [0.08, 0.075, 0.08, 0.12, 0],
            [0.4, 0.09, 0.09, 0.12, 0],
            [0.46, 0.07, 0.07, 0.12, 0],
          ],
          { seg: 6, phase: 30 },
        ),
        modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        modelBuilder.lathe(
          [
            [0, 0.1, 0.14, 0.12, 0.03],
            [0.08, 0.095, 0.12, 0.12, 0.015],
            [0.11, 0.075, 0.08, 0.12, 0],
          ],
          { seg: 6, phase: 30 },
        ))
    }),
    modelBuilder.bone(bodyJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    modelBuilder.lathe(
      [
        [0.4, 0.15, 0.13],
        [0.56, 0.2, 0.16],
        [0.8, 0.24, 0.18],
        [0.98, 0.26, 0.19],
        [1.04, 0.14, 0.13],
      ],
      { seg: 6, phase: 30, power: 2.3 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    modelBuilder.g(composeMatrix(0, 0.92, 0.175, 8, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.15, 0.06],
          [0.15, 0.06],
          [0.13, -0.38],
          [0, -0.52],
          [-0.13, -0.38],
        ],
        0.03,
        0.008,
      ),
    ),
    modelBuilder.g(composeMatrix(0, 0.92, -0.17, -8, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.15, 0.06],
          [0.15, 0.06],
          [0.12, -0.4],
          [-0.12, -0.4],
        ],
        0.03,
        0.008,
      ),
    ),
    modelBuilder.lathe(
      [
        [0.92, 0.3, 0.23],
        [1, 0.27, 0.2],
        [1.045, 0.15, 0.14],
      ],
      { seg: 6, phase: 30, power: 2.3, cap0: !1 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.g(composeMatrix(0, 0.8, 0.2, 8, 0, 45), () => modelBuilder.box(0, 0, 0, 0.07, 0.07, 0.03, 0.01)),
    modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.7)),
    modelBuilder.lathe(
      [
        [0.5, 0.165, 0.14],
        [0.535, 0.185, 0.15],
      ],
      { seg: 6, phase: 30, power: 2.3, cap0: !1, cap1: !1 },
    ),
    modelBuilder.bone(headJoint).paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    modelBuilder.lathe(
      [
        [1.02, 0.07, 0.07, 0, 0.02],
        [1.08, 0.17, 0.17, 0, 0.02],
        [1.11, 0.17, 0.17, 0, 0.02],
      ],
      { seg: 8, phase: 22.5 },
    ))
  for (let index = 0; index < 8; index++) {
    const ringStudAngle = (index / 8) * STRUCTURE_MATERIAL_SPEC + Math.PI / 8
    modelBuilder.box(Math.cos(ringStudAngle) * 0.15, 1.235, 0.02 + Math.sin(ringStudAngle) * 0.15, 0.024, 0.26, 0.024)
  }
  ;(modelBuilder.lathe(
    [
      [1.36, 0.19, 0.19, 0, 0.02],
      [1.4, 0.2, 0.2, 0, 0.02],
      [1.5, 0.1, 0.1, 0, 0.02],
      [1.62, 0.015, 0.015, 0, 0.02],
    ],
    { seg: 8, phase: 22.5 },
  ),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.ball(0, 1.64, 0.02, 0.03, 0.035, 0.03, 0),
    modelBuilder.bone(flameJoint).paint(16777215, TEAM_PALETTE_KEYS(0.95)),
    modelBuilder.lathe(
      [
        [1.115, 0.13, 0.13, 0, 0.02],
        [1.24, 0.145, 0.145, 0, 0.02],
        [1.355, 0.13, 0.13, 0, 0.02],
      ],
      { seg: 8, phase: 22.5 },
    ),
    modelBuilder.sym((sideSign) => {
      ;(modelBuilder.bone(sideSign > 0 ? armLJoint : armRJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        modelBuilder.ball(0.28, 0.9, 0.02, 0.085, 0.085, 0.085, 0, 40),
        modelBuilder.limb([0.3, 0.9, 0.02], [0.33, 0.6, 0.06], 0.06, 0.07, { seg: 6 }),
        modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        modelBuilder.box(0.33, 0.55, 0.07, 0.11, 0.11, 0.12, 0.03),
        modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.6)),
        modelBuilder.box(0.33, 0.615, 0.065, 0.13, 0.025, 0.13))
    }),
    modelBuilder.bakeGrounding(1.5, 0.78, 0.95))
  const animateStructure = (poseBuilder, animatedUnit, visualState) => {
    const animClock = animatedUnit.time * 2 + animatedUnit.seed * 6,
      flamePulseScale = 1 + 0.05 * Math.sin(animClock * 5.3) + 0.03 * Math.sin(animClock * 9.1)
    switch ((poseBuilder.scale(flameJoint, flamePulseScale), (visualState.glow = 0.9 + 0.2 * Math.sin(animClock * 1.7)), animatedUnit.anim)) {
      case "dead": {
        const bUILDING_GEOMETRY_CACHEResult = BUILDING_GEOMETRY_CACHE(animatedUnit.t)
        ;(poseBuilder.pos(bodyJoint, 0, -0.1 * bUILDING_GEOMETRY_CACHEResult.slump - 0.4 * bUILDING_GEOMETRY_CACHEResult.fall * bUILDING_GEOMETRY_CACHEResult.fall, 0),
          poseBuilder.rot(bodyJoint, 10 * bUILDING_GEOMETRY_CACHEResult.slump + 50 * bUILDING_GEOMETRY_CACHEResult.burst, 0, -14 * bUILDING_GEOMETRY_CACHEResult.burst),
          TEAM_CRYSTAL_SPEC(poseBuilder, headJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, -0.2, 0.5, 0.9, 150, -50),
          poseBuilder.scale(flameJoint, Math.max(0.001, 1 - bUILDING_GEOMETRY_CACHEResult.slump)),
          TEAM_CRYSTAL_SPEC(poseBuilder, armLJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, 0.4, 0.1, 0.6, 30, 80),
          TEAM_CRYSTAL_SPEC(poseBuilder, armRJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, -0.4, -0.1, 0.6, -30, -80),
          poseBuilder.rot(legLJoint, -24 * bUILDING_GEOMETRY_CACHEResult.burst, 0, 30 * bUILDING_GEOMETRY_CACHEResult.burst),
          poseBuilder.rot(legRJoint, 16 * bUILDING_GEOMETRY_CACHEResult.burst, 0, -30 * bUILDING_GEOMETRY_CACHEResult.burst),
          (visualState.glow = Math.max(0.02, 1 - bUILDING_GEOMETRY_CACHEResult.slump * 1.3)))
        break
      }
      case "move": {
        const stridePhase = animatedUnit.stride * STRUCTURE_MATERIAL_SPEC,
          strideSwing = Math.sin(stridePhase)
        ;(poseBuilder.rot(legLJoint, strideSwing * 32, 0, 0),
          poseBuilder.rot(legRJoint, -strideSwing * 32, 0, 0),
          poseBuilder.pos(bodyJoint, 0, Math.abs(Math.cos(stridePhase)) * 0.035, 0),
          poseBuilder.rot(bodyJoint, 10, -strideSwing * 6, 0),
          poseBuilder.rot(headJoint, -6 + Math.sin(stridePhase * 2 - 0.9) * 6, 0, Math.sin(stridePhase - 0.6) * 5),
          poseBuilder.rot(armLJoint, -strideSwing * 20 - 6, 0, 4),
          poseBuilder.rot(armRJoint, strideSwing * 20 - 6, 0, -4))
        break
      }
      case "attack": {
        const windupEaseCurveResult = windupEaseCurve(animatedUnit.p, animatedUnit.windup),
          easeOutQuadResult = easeOutQuad(inverseLerpClamped(windupEaseCurveResult, 0, 0.27)),
          windupMidProgress = inverseLerpClamped(windupEaseCurveResult, 0.27, 0.36),
          attackReleaseProgress = hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.5, 1)),
          attackAnticipation = easeOutQuadResult * (1 - windupMidProgress),
          windupCharge = windupMidProgress * (1 - attackReleaseProgress)
        ;(poseBuilder.rot(bodyJoint, -16 * attackAnticipation + 18 * windupCharge, 0, 0),
          poseBuilder.pos(bodyJoint, 0, 0.04 * attackAnticipation - 0.03 * windupCharge, -0.05 * attackAnticipation + 0.08 * windupCharge),
          poseBuilder.rot(headJoint, -18 * attackAnticipation + 24 * windupCharge - 8 * smoothFalloff(windupEaseCurveResult, 0.44, 0.1), 0, 0),
          poseBuilder.rot(armLJoint, -100 * easeOutQuadResult * (1 - attackReleaseProgress) - 30 * windupCharge, 0, -26 * easeOutQuadResult * (1 - attackReleaseProgress)),
          poseBuilder.rot(armRJoint, -100 * easeOutQuadResult * (1 - attackReleaseProgress) - 30 * windupCharge, 0, 26 * easeOutQuadResult * (1 - attackReleaseProgress)),
          poseBuilder.scale(flameJoint, flamePulseScale * (1 + 0.5 * attackAnticipation - 0.25 * windupCharge)),
          (visualState.glow = 1 + 0.7 * attackAnticipation + 0.8 * smoothFalloff(windupEaseCurveResult, 0.36, 0.12)))
        break
      }
      case "stunned": {
        ;(poseBuilder.rot(bodyJoint, 10 + Math.sin(animClock * 2.4) * 6, 0, Math.cos(animClock * 2.4) * 10), poseBuilder.rot(headJoint, 0, Math.sin(animClock * 2.4) * 25, 14), (visualState.glow = 0.5))
        break
      }
      case "airborne": {
        ;(poseBuilder.rot(rootJoint, -24 * Math.sin(animatedUnit.p * Math.PI), 0, 12), poseBuilder.rot(armLJoint, -80, 0, 50), poseBuilder.rot(armRJoint, -40, 0, -30), poseBuilder.rot(legLJoint, -26, 0, 10), poseBuilder.rot(legRJoint, 18, 0, -10))
        break
      }
      default:
        ;(poseBuilder.pos(bodyJoint, 0, Math.sin(animClock) * 0.014, 0), poseBuilder.rot(headJoint, Math.sin(animClock * 0.8) * 3, Math.sin(animClock * 0.45) * 10, 0), poseBuilder.rot(armLJoint, -8 + Math.sin(animClock) * 3, 0, 3), poseBuilder.rot(armRJoint, -8 - Math.sin(animClock) * 3, 0, -3))
    }
    const hitFlinchPulse = hitImpactPulse(animatedUnit.hitT, 0.18)
    hitFlinchPulse > 0 && animatedUnit.anim !== "dead" && (poseBuilder.add(bodyJoint, -10 * hitFlinchPulse, 0, 0), poseBuilder.add(headJoint, 16 * hitFlinchPulse, 0, 8 * hitFlinchPulse))
  }
  return {
    key: "minion:ranged",
    geometry: modelBuilder.build(),
    rig: nodeTree,
    height: 1.7,
    radius: 0.45,
    scale: 1,
    stride: 1.4,
    triangles: modelBuilder.triangleCount,
    deathDur: 1.1,
    outline: 1.2,
    attach: {
      chest: { joint: bodyJoint, x: 0, y: 0.25, z: 0 },
      head: { joint: headJoint, x: 0, y: 0.25, z: 0 },
      weapon: { joint: flameJoint, x: 0, y: 0, z: 0.16 },
      muzzle: { joint: flameJoint, x: 0, y: 0, z: 0.16 },
      core: { joint: flameJoint, x: 0, y: 0, z: 0 },
    },
    blend: (lastAnim, attackKind) => (attackKind === "attack" ? 0.07 : 0.14),
    animate: animateStructure,
  }
}

export { TEAM_COLOR_TABLE, TEAM_PALETTE_KEYS, TEAM_CRYSTAL_SPEC, BUILDING_GEOMETRY_CACHE, STRUCTURE_PALETTE, SURFACE_MATERIAL, buildStructureModelA, STRUCTURE_MATERIAL_SPEC, TOWER_BUILDING_SPEC, BASE_BUILDING_SPEC }