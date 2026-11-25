/**
 * QU 部件模型
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { TEAM_COLOR_TABLE, TEAM_PALETTE_KEYS, TEAM_CRYSTAL_SPEC, BUILDING_GEOMETRY_CACHE, STRUCTURE_PALETTE, SURFACE_MATERIAL, STRUCTURE_MATERIAL_SPEC, TOWER_BUILDING_SPEC, BASE_BUILDING_SPEC } from './zu-component'
import { NodeTree } from '../node-tree'
import { MATERIAL_KINDS, ModelBuilder, TERRAIN_LOOK, composeMatrix } from '../render/model-builder'
import { inverseLerpClamped, hermiteSmoothStep, hitImpactPulse, easeOutQuad, windupEaseCurve } from '../world/po-system'

/**
 * 处理配置。
 *
 * @param baseRadius - 主要输入
 */
function NEUTRAL_BASE_SPEC(baseRadius) {
  const outlinePoints = []
  for (let index = 0; index < 16; index++) {
    const pointAngle = (index / 16) * STRUCTURE_MATERIAL_SPEC + Math.PI / 2,
      pointRadius = index % 2 === 0 ? baseRadius * (index % 4 === 0 ? 1 : 0.7) : baseRadius * 0.36
    outlinePoints.push([Math.cos(pointAngle) * pointRadius, Math.sin(pointAngle) * pointRadius])
  }
  return outlinePoints
}

/**
 * 创建模型。
 *
 * @returns 结果对象
 */
function buildStructureModelB() {
  const nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    bodyJoint = nodeTree.add("body", rootJoint, 0, 0.74, 0),
    headJoint = nodeTree.add("head", bodyJoint, 0, 0.84, 0.66),
    mountJoint = nodeTree.add("mount", bodyJoint, 0, 1.2, -0.08),
    slideJoint = nodeTree.add("slide", mountJoint, 0, 1.36, -0.08),
    bowLJoint = nodeTree.add("bowL", mountJoint, 0.1, 1.36, 0.5),
    bowRJoint = nodeTree.add("bowR", mountJoint, -0.1, 1.36, 0.5),
    legOffsets = [
      [0.42, 0.46],
      [-0.42, 0.46],
      [0.42, -0.5],
      [-0.42, -0.5],
    ],
    legJoints = legOffsets.map(([legXOffset, legZOffset], legIndex) => nodeTree.add(`leg${legIndex}`, bodyJoint, legXOffset, 0.66, legZOffset)),
    modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 36),
    legJoints.forEach((legJoint, legIndex) => {
      const [legXOffset, legZOffset] = legOffsets[legIndex]
      ;(modelBuilder.bone(legJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        modelBuilder.lathe(
          [
            [0.12, 0.13, 0.15, legXOffset, legZOffset],
            [0.4, 0.125, 0.135, legXOffset, legZOffset],
            [0.74, 0.19, 0.21, legXOffset, legZOffset],
          ],
          { seg: 6, phase: 30, power: 2.3 },
        ),
        modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        modelBuilder.lathe(
          [
            [0, 0.17, 0.2, legXOffset, legZOffset + 0.02],
            [0.12, 0.155, 0.175, legXOffset, legZOffset],
            [0.15, 0.125, 0.135, legXOffset, legZOffset],
          ],
          { seg: 6, phase: 30 },
        ),
        modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.6)),
        modelBuilder.lathe(
          [
            [0.4, 0.13, 0.14, legXOffset, legZOffset],
            [0.44, 0.135, 0.145, legXOffset, legZOffset],
          ],
          { seg: 6, phase: 30, power: 2.3, cap0: !1, cap1: !1 },
        ))
    }),
    modelBuilder.bone(bodyJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    modelBuilder.tube(
      [
        [0, 0.72, -0.84, 0.3, 0.2],
        [0, 0.8, -0.6, 0.52, 0.37],
        [0, 0.84, 0, 0.58, 0.43],
        [0, 0.82, 0.5, 0.5, 0.37],
        [0, 0.8, 0.74, 0.32, 0.26],
      ],
      { seg: 8, up: [1, 0, 0], power: 2.6 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    modelBuilder.sheet(
      6,
      2,
      (clothArcRatio, clothDepthRatio) => {
        const clothArcAngle = Math.PI * (0.02 + 0.96 * clothArcRatio),
          clothDepth = -0.46 + clothDepthRatio * 0.8,
          clothFlare = clothArcRatio < 0.12 || clothArcRatio > 0.88 ? 1.06 : 1.03
        return [Math.cos(clothArcAngle) * 0.6 * clothFlare, 0.84 + Math.sin(clothArcAngle) * 0.45 * clothFlare - (clothArcRatio < 0.1 || clothArcRatio > 0.9 ? 0.1 : 0), clothDepth]
      },
      !0,
      40,
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.sym(() =>
      modelBuilder.g(composeMatrix(0.6, 0.74, -0.06, 0, 90, 0), () =>
        modelBuilder.extrude(
          NEUTRAL_BASE_SPEC(0.11).filter((outlinePoint, pointIndex) => pointIndex % 2 === 0),
          0.03,
          0.008,
        ),
      ),
    ),
    modelBuilder.bone(headJoint).paint(STRUCTURE_PALETTE.stone, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    modelBuilder.tube(
      [
        [0, 0.84, 0.62, 0.28, 0.24],
        [0, 0.8, 0.9, 0.26, 0.21],
        [0, 0.72, 1.1, 0.17, 0.13],
      ],
      { seg: 6, up: [1, 0, 0], power: 2.4 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    modelBuilder.g(composeMatrix(0, 0.86, 1, -62, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.17, -0.1],
          [0.17, -0.1],
          [0.2, 0.08],
          [0, 0.16],
          [-0.2, 0.08],
        ],
        0.05,
        0.015,
      ),
    ),
    modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.9)),
    modelBuilder.g(composeMatrix(0, 0.875, 1.03, -62, 0, 0), () => modelBuilder.box(0, 0, 0, 0.24, 0.035, 0.03)),
    modelBuilder.paint(STRUCTURE_PALETTE.stoneLight, { c2: 15133685, ...SURFACE_MATERIAL }),
    modelBuilder.sym(() => modelBuilder.g(composeMatrix(0.22, 0.96, 0.74, -40, 0, -34), () => modelBuilder.crystal(0.05, 0.22, 4, 0.7, 0.1))),
    modelBuilder.bone(mountJoint).paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    modelBuilder.lathe(
      [
        [1.14, 0.3, 0.32, 0, -0.08],
        [1.24, 0.24, 0.26, 0, -0.08],
        [1.3, 0.14, 0.16, 0, -0.08],
      ],
      { seg: 8 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.wood, { mat: MATERIAL_KINDS.leather, pattern: TERRAIN_LOOK.bark, patternScale: 8, patternAmt: 0.3 }),
    modelBuilder.box(0, 1.34, 0.06, 0.2, 0.12, 1.3, 0.03),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.box(0, 1.36, 0.6, 0.26, 0.16, 0.14, 0.03),
    modelBuilder.box(0, 1.36, -0.5, 0.24, 0.16, 0.12, 0.03),
    modelBuilder.sym((mirrorSide) => {
      ;(modelBuilder.bone(mirrorSide > 0 ? bowLJoint : bowRJoint).paint(STRUCTURE_PALETTE.stoneLight, { c2: STRUCTURE_PALETTE.stone, gloss: 0.5, mat: MATERIAL_KINDS.leather }),
        modelBuilder.tube(
          [
            [0.1, 1.36, 0.52, 0.045, 0.07],
            [0.42, 1.38, 0.44, 0.04, 0.06],
            [0.72, 1.4, 0.24, 0.03, 0.045],
            [0.86, 1.4, 0.02, 0.016, 0.02],
          ],
          { seg: 5, up: [0, 1, 0] },
        ),
        modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
        modelBuilder.box(0.5, 1.39, 0.42, 0.1, 0.1, 0.1, 0.02))
    }),
    modelBuilder.bone(slideJoint).paint(STRUCTURE_PALETTE.wood, { mat: MATERIAL_KINDS.leather }),
    modelBuilder.tube(
      [
        [0, 1.44, -0.4, 0.03],
        [0, 1.44, 0.7, 0.03],
      ],
      { seg: 5 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }))
  for (const trimAngle of [0, 90])
    modelBuilder.g(composeMatrix(0, 1.44, -0.36, 0, 0, trimAngle), () =>
      modelBuilder.extrude(
        [
          [0, 0],
          [0.09, -0.06],
          [0.09, 0.1],
          [0, 0.16],
        ],
        0.012,
        0,
      ),
    )
  ;(modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.85)), modelBuilder.g(composeMatrix(0, 1.44, 0.66, 90, 0, 0), () => modelBuilder.crystal(0.075, 0.42, 4, 0.7, 0.2, 1)), modelBuilder.bakeGrounding(1.6))
  const animateStructure = (poseBuilder, animatedUnit, visualState) => {
    const animPhase = animatedUnit.time * 1.8 + animatedUnit.seed * 6
    let bowDraw = 1
    switch (animatedUnit.anim) {
      case "dead": {
        const bUILDING_GEOMETRY_CACHEResult = BUILDING_GEOMETRY_CACHE(animatedUnit.t),
          deathFallIntensity = bUILDING_GEOMETRY_CACHEResult.fall * bUILDING_GEOMETRY_CACHEResult.fall
        ;(poseBuilder.pos(bodyJoint, 0, -0.08 * bUILDING_GEOMETRY_CACHEResult.slump - 0.38 * deathFallIntensity, 0),
          poseBuilder.rot(bodyJoint, 6 * deathFallIntensity, 0, 12 * deathFallIntensity),
          legJoints.forEach((legJoint, legIndex) => poseBuilder.rot(legJoint, (legIndex < 2 ? -60 : 60) * deathFallIntensity, 0, (legIndex % 2 === 0 ? 46 : -46) * deathFallIntensity)),
          TEAM_CRYSTAL_SPEC(poseBuilder, mountJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, 0.3, -0.3, 0.6, -30, 50),
          poseBuilder.rot(headJoint, 30 * deathFallIntensity, 0, 0),
          (bowDraw = 1 - bUILDING_GEOMETRY_CACHEResult.burst),
          (visualState.glow = Math.max(0.02, 1 - bUILDING_GEOMETRY_CACHEResult.slump * 1.3)))
        break
      }
      case "move": {
        const stridePhase = animatedUnit.stride * STRUCTURE_MATERIAL_SPEC,
          strideSwing = Math.sin(stridePhase)
        ;(poseBuilder.rot(legJoints[0], strideSwing * 30, 0, 0),
          poseBuilder.rot(legJoints[3], strideSwing * 30, 0, 0),
          poseBuilder.rot(legJoints[1], -strideSwing * 30, 0, 0),
          poseBuilder.rot(legJoints[2], -strideSwing * 30, 0, 0),
          poseBuilder.pos(bodyJoint, 0, Math.abs(Math.cos(stridePhase)) * 0.04, 0),
          poseBuilder.rot(bodyJoint, Math.cos(stridePhase * 2) * 1.5, 0, strideSwing * 3),
          poseBuilder.rot(headJoint, Math.cos(stridePhase * 2) * 4 + 4, 0, 0),
          poseBuilder.rot(mountJoint, Math.sin(stridePhase * 2 - 0.8) * 2.5, 0, -strideSwing * 2))
        break
      }
      case "attack": {
        const windupEaseCurveResult = windupEaseCurve(animatedUnit.p, animatedUnit.windup),
          easeOutQuadResult = easeOutQuad(inverseLerpClamped(windupEaseCurveResult, 0, 0.3)),
          releasePhase = inverseLerpClamped(windupEaseCurveResult, 0.33, 0.38),
          recoveryPhase = inverseLerpClamped(windupEaseCurveResult, 0.42, 1),
          releaseImpact = releasePhase * (1 - recoveryPhase) * (1 - recoveryPhase)
        ;(poseBuilder.rot(mountJoint, -12 * easeOutQuadResult * (1 - recoveryPhase) - 6 * releaseImpact, 0, 0),
          poseBuilder.rot(bodyJoint, -5 * releaseImpact + 3 * easeOutQuadResult * (1 - releasePhase), 0, 0),
          poseBuilder.pos(bodyJoint, 0, -0.06 * easeOutQuadResult * (1 - releasePhase) - 0.03 * releaseImpact, -0.14 * releaseImpact),
          legJoints.forEach((legJoint, legIndex) => poseBuilder.rot(legJoint, (legIndex < 2 ? 1 : -1) * 9 * releaseImpact, 0, 0)),
          (bowDraw = 1 + 0.3 * easeOutQuadResult * (1 - releasePhase) - 1.1 * releasePhase * (1 - hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.6, 0.95)))),
          poseBuilder.scale(slideJoint, Math.max(0.001, 1 - releasePhase + hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.7, 0.95)))),
          poseBuilder.pos(slideJoint, 0, 0, 0.5 * releasePhase * (1 - inverseLerpClamped(windupEaseCurveResult, 0.4, 0.5))),
          (visualState.glow = 1 + 0.7 * easeOutQuadResult * (1 - releasePhase) + 0.8 * releaseImpact))
        break
      }
      case "stunned": {
        ;(poseBuilder.rot(bodyJoint, Math.sin(animPhase * 2.6) * 4, 0, Math.cos(animPhase * 2.6) * 6), poseBuilder.rot(headJoint, 14, Math.sin(animPhase * 2.6) * 18, 0), (visualState.glow = 0.6))
        break
      }
      case "airborne": {
        ;(poseBuilder.rot(rootJoint, -16 * Math.sin(animatedUnit.p * Math.PI), 0, 8), legJoints.forEach((legJoint, legIndex) => poseBuilder.rot(legJoint, legIndex < 2 ? -40 : 40, 0, 0)))
        break
      }
      default:
        ;(poseBuilder.pos(bodyJoint, 0, Math.sin(animPhase) * 0.015, 0), poseBuilder.rot(headJoint, Math.sin(animPhase * 0.7) * 4, Math.sin(animPhase * 0.33) * 12, 0), poseBuilder.rot(mountJoint, Math.sin(animPhase * 0.5) * 2, 0, 0), (visualState.glow = 1 + 0.12 * Math.sin(animPhase * 1.4)))
    }
    ;(poseBuilder.rot(bowLJoint, 0, 22 * (bowDraw - 1), 0), poseBuilder.rot(bowRJoint, 0, -22 * (bowDraw - 1), 0))
    const hitPulse = hitImpactPulse(animatedUnit.hitT, 0.18)
    hitPulse > 0 && animatedUnit.anim !== "dead" && (poseBuilder.add(bodyJoint, 0, 0, 5 * hitPulse), poseBuilder.add(headJoint, 12 * hitPulse, 0, 0))
  }
  return {
    key: "minion:siege",
    geometry: modelBuilder.build(),
    rig: nodeTree,
    height: 1.8,
    radius: 0.85,
    scale: 1,
    stride: 1.9,
    triangles: modelBuilder.triangleCount,
    deathDur: 1.2,
    outline: 1.2,
    attach: { chest: { joint: bodyJoint, x: 0, y: 0.1, z: 0 }, head: { joint: headJoint, x: 0, y: 0.1, z: 0.2 }, weapon: { joint: mountJoint, x: 0, y: 0.24, z: 1.1 }, muzzle: { joint: mountJoint, x: 0, y: 0.24, z: 1.1 } },
    blend: () => 0.14,
    animate: animateStructure,
  }
}

export { NEUTRAL_BASE_SPEC, buildStructureModelB }