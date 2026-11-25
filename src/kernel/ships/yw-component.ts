/**
 * Yw 部件模型
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { ARENA_PALETTE } from '../arena-palette'
import { MATERIAL_KINDS, ModelBuilder, TERRAIN_LOOK, composeMatrix, lerpValue, scaleRgbChannels } from '../render/model-builder'
import { NodeTree } from '../node-tree'
import { inverseLerpClamped, easeOutQuad } from '../world/po-system'

const TEAM_BASE_PALETTES = [
    { stone: ARENA_PALETTE.blue.stone, stoneDark: ARENA_PALETTE.blue.stoneDark, stoneLight: 13226982, trim: ARENA_PALETTE.blue.trim, crystal: 1468648, crystalMid: 3711231, crystalHot: 9228543, glowK: 0.85, spiky: !1 },
    { stone: ARENA_PALETTE.red.stone, stoneDark: ARENA_PALETTE.red.stoneDark, stoneLight: 8153712, trim: ARENA_PALETTE.red.trim, crystal: 14039574, crystalMid: 15882790, crystalHot: 16747056, glowK: 0.35, spiky: !0 },
  ],
  BASE_GLOW_COLOR = 16773296,
  FULL_CIRCLE_RADIANS = Math.PI * 2,
  hashNoise = (lookupKey, noiseSeed) => {
    const noiseFraction = Math.sin(lookupKey * 127.1 + noiseSeed * 311.7) * 43758.5453
    return noiseFraction - Math.floor(noiseFraction)
  },
  SURFACE_MATERIAL_ALT = { mat: MATERIAL_KINDS.rock, pattern: TERRAIN_LOOK.strata, patternScale: 3, patternAmt: 0.3, grain: 0.05 },
  METAL_MATERIAL_SPEC = { gloss: 1, mat: MATERIAL_KINDS.metal },
  MATERIAL_PRESETS = { gloss: 1, mat: MATERIAL_KINDS.crystal, line: 1 }

function buildStarCrackTube(modelBuilder, radiusAtHeight, baseAngle, startHeight, endHeight, noiseSeed, radiusScale = 1.012) {
  const crackPoints = []
  for (let index = 0; index <= 4; index++) {
    const heightRatio = index / 4,
      ringHeight = lerpValue(startHeight, endHeight, heightRatio),
      crackAngle = baseAngle + (hashNoise(index, noiseSeed) - 0.5) * 0.5 * (index > 0 && index < 4 ? 1 : 0.2),
      ringRadius = radiusAtHeight(ringHeight) * radiusScale
    crackPoints.push([Math.cos(crackAngle) * ringRadius, ringHeight, Math.sin(crackAngle) * ringRadius, 0.035 * (1 - Math.abs(heightRatio - 0.5) * 1.3), 0.02])
  }
  modelBuilder.tube(crackPoints, { seg: 3, cap0: !1, cap1: !1 })
}

/**
 * 创建阵营与模型。
 *
 * @param teamIndex - 来源
 * @returns 结果对象
 */
function buildTeamBaseModel(teamIndex) {
  const selectedTEAM_BASE_PALETTES = TEAM_BASE_PALETTES[teamIndex],
    nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    coreHeight = 3.95,
    starJoint = nodeTree.add("star", rootJoint, 0, coreHeight, 0),
    innerJoint = nodeTree.add("inner", starJoint, 0, coreHeight, 0),
    ringAJoint = nodeTree.add("ringA", rootJoint, 0, coreHeight, 0),
    ringBJoint = nodeTree.add("ringB", rootJoint, 0, coreHeight, 0),
    orbitJoint = nodeTree.add("orbit", rootJoint, 0, coreHeight, 0),
    crackJoints = [0, 1, 2].map((crackIndex) => nodeTree.add(`crack${crackIndex}`, starJoint, 0, coreHeight, 0)),
    pylonJoints = [0, 1, 2, 3].map((pylonIndex) => nodeTree.add(`pylon${pylonIndex}`, rootJoint, Math.cos((pylonIndex * Math.PI) / 2 + Math.PI / 4) * 2.2, 0.9, Math.sin((pylonIndex * Math.PI) / 2 + Math.PI / 4) * 2.2)),
    modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 30),
    modelBuilder.bone(rootJoint).paint(scaleRgbChannels(selectedTEAM_BASE_PALETTES.stoneDark, 0.8), { c2: selectedTEAM_BASE_PALETTES.stone, ...SURFACE_MATERIAL_ALT }),
    modelBuilder.lathe(
      [
        [0, 2.78],
        [0.28, 2.78],
        [0.3, 2.72],
        [0.3, 2.42],
        [0.6, 2.42],
        [0.62, 2.36],
        [0.62, 2.02],
        [0.92, 2.02],
        [0.95, 1.92],
      ],
      { seg: 8, phase: 22.5 },
    ),
    modelBuilder.paint(selectedTEAM_BASE_PALETTES.trim, { ...METAL_MATERIAL_SPEC }),
    modelBuilder.lathe(
      [
        [0.25, 2.81],
        [0.32, 2.81],
        [0.325, 2.46],
      ],
      { seg: 8, phase: 22.5, cap0: !1, cap1: !1 },
    ),
    modelBuilder.lathe(
      [
        [0.57, 2.45],
        [0.64, 2.45],
        [0.645, 2.06],
      ],
      { seg: 8, phase: 22.5, cap0: !1, cap1: !1 },
    ),
    modelBuilder.paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.4 * (0.5 + 0.5 * selectedTEAM_BASE_PALETTES.glowK), mat: MATERIAL_KINDS.crystal, line: 0 }))
  for (let index = 0; index < 8; index++) {
    const segmentAngle = (index / 8) * FULL_CIRCLE_RADIANS
    modelBuilder.g(composeMatrix(Math.cos(segmentAngle) * 1.5, 0.96, Math.sin(segmentAngle) * 1.5, 0, -(segmentAngle * 180) / Math.PI, 0), () => modelBuilder.box(0, 0, 0, 0.76, 0.04, index % 2 ? 0.05 : 0.09))
  }
  ;(modelBuilder.lathe(
    [
      [0.95, 1],
      [0.97, 0.94],
      [1.02, 0.5],
      [1.03, 0.02],
    ],
    { seg: 8, phase: 22.5, cap0: !1 },
  ),
    modelBuilder.paint(selectedTEAM_BASE_PALETTES.trim, { ...METAL_MATERIAL_SPEC }),
    modelBuilder.g(composeMatrix(0, 0.97, 0), () => modelBuilder.torus(1.08, 0.08, 0.05, 16, 4, { crease: 30 })),
    pylonJoints.forEach((pylonJoint, pylonIndex) => {
      const pylonAngle = (pylonIndex * Math.PI) / 2 + Math.PI / 4
      ;(modelBuilder.bone(pylonJoint),
        modelBuilder.g(composeMatrix(Math.cos(pylonAngle) * 2.2, 0.9, Math.sin(pylonAngle) * 2.2, 0, -(pylonAngle * 180) / Math.PI - 90, 0), () => {
          ;(modelBuilder.paint(selectedTEAM_BASE_PALETTES.stoneDark, { c2: selectedTEAM_BASE_PALETTES.stoneLight, ...SURFACE_MATERIAL_ALT }),
            modelBuilder.tube(
              [
                [0, -0.3, 0, 0.42, 0.36],
                [0, 0.5, -0.2, 0.39, 0.31],
                [0, 0.52, -0.2, 0.35, 0.28],
                [0, 1.3, -0.22, 0.32, 0.25],
                [0, 1.32, -0.22, 0.29, 0.23],
                [0, 2.1, -0.04, 0.25, 0.2],
                [0, 2.12, -0.04, 0.22, 0.18],
                [0, 2.9, 0.42, 0.16, 0.14],
                [0, 3.42, 0.94, 0.04, 0.04],
              ],
              { seg: 6, up: [1, 0, 0], crease: 30 },
            ),
            modelBuilder.paint(selectedTEAM_BASE_PALETTES.trim, { ...METAL_MATERIAL_SPEC }),
            modelBuilder.g(composeMatrix(0, 0.5, -0.16, -8, 0, 0), () => modelBuilder.box(0, 0, 0, 0.9, 0.14, 0.78)),
            modelBuilder.g(composeMatrix(0, 2.1, -0.04, 12, 0, 0), () => modelBuilder.box(0, 0, 0, 0.58, 0.1, 0.48)),
            modelBuilder.paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.4, mat: MATERIAL_KINDS.crystal, line: 0 }),
            modelBuilder.g(composeMatrix(0, 1.3, -0.5, 0, 0, 0), () => modelBuilder.box(0, 0, 0, 0.08, 1.1, 0.05)),
            selectedTEAM_BASE_PALETTES.spiky &&
              (modelBuilder.paint(selectedTEAM_BASE_PALETTES.stoneDark, { c2: selectedTEAM_BASE_PALETTES.stone, ...SURFACE_MATERIAL_ALT }),
              modelBuilder.g(composeMatrix(0, 1.3, -0.36, -70, 0, 0), () => modelBuilder.crystal(0.14, 0.8, 4, 0.8, 0.1)),
              modelBuilder.g(composeMatrix(0, 2.3, -0.2, -60, 0, 0), () => modelBuilder.crystal(0.1, 0.6, 4, 0.8, 0.1))),
            modelBuilder.paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.35, ...MATERIAL_PRESETS }),
            modelBuilder.g(composeMatrix(0, 3.3, 0.9, 40, 0, 0), () => modelBuilder.crystal(0.17, 0.66, 5, 0.6, 0.3)))
        }))
    }),
    modelBuilder.bone(starJoint).paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalMid, glow: 0.16 * selectedTEAM_BASE_PALETTES.glowK, glow2: 0.32 * selectedTEAM_BASE_PALETTES.glowK, ...MATERIAL_PRESETS, gloss: 0.8 }),
    modelBuilder.g(composeMatrix(0, coreHeight - 1.8, 0), () => modelBuilder.crystal(1.25, 3.6, 6, 0.5, 0.5, 1)))
  for (let starRayIndex = 0; starRayIndex < 6; starRayIndex++) {
    const starRayAngle = (starRayIndex / 6) * FULL_CIRCLE_RADIANS
    modelBuilder.g(composeMatrix(0, coreHeight, 0, 0, -(starRayAngle * 180) / Math.PI, 0), () => modelBuilder.g(composeMatrix(0.9, 0, 0, 0, 0, -90), () => modelBuilder.crystal(0.36, 1.5, 4, 0.8, 0.05)))
  }
  ;(modelBuilder.bone(innerJoint).paint(selectedTEAM_BASE_PALETTES.crystalHot, { glow: 0.5 * selectedTEAM_BASE_PALETTES.glowK, mat: MATERIAL_KINDS.crystal, line: 0 }), modelBuilder.g(composeMatrix(0, coreHeight - 0.85, 0), () => modelBuilder.crystal(0.56, 1.7, 4, 0.5, 0.5, 1)))
  const crackRadiusAtHeight = (plaza) => 1.25 * (1 - Math.abs(plaza - coreHeight) / 1.85) * 0.98 + 0.06
  crackJoints.forEach((crackJoint, crackIndex) => {
    ;(modelBuilder.bone(crackJoint).paint(16777215, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.95, mat: MATERIAL_KINDS.crystal, line: 0 }),
      buildStarCrackTube(modelBuilder, crackRadiusAtHeight, 0.4 + crackIndex * 2.1, coreHeight - 1.1, coreHeight + 1, 30 + crackIndex, 1.03),
      buildStarCrackTube(modelBuilder, crackRadiusAtHeight, 1.5 + crackIndex * 2.1, coreHeight - 0.5, coreHeight + 1.3, 40 + crackIndex, 1.03))
  })
  for (const [ringJoint, ringRadius] of [
    [ringAJoint, 2.3],
    [ringBJoint, 2.68],
  ])
    (modelBuilder.bone(ringJoint).paint(selectedTEAM_BASE_PALETTES.trim, { ...METAL_MATERIAL_SPEC, glow: 0.08 }),
      modelBuilder.g(composeMatrix(0, coreHeight, 0), () => {
        modelBuilder.torus(ringRadius, 0.09, 0.13, 32, 4, { crease: 30, phase: 45 })
        for (let index = 0; index < 12; index++) {
          const ringStudAngle = (index / 12) * FULL_CIRCLE_RADIANS,
            isCrystalStud = index % 3 === 0
          ;(isCrystalStud ? modelBuilder.paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.55, mat: MATERIAL_KINDS.crystal, line: 0 }) : modelBuilder.paint(selectedTEAM_BASE_PALETTES.trim, { ...METAL_MATERIAL_SPEC }),
            modelBuilder.g(composeMatrix(Math.cos(ringStudAngle) * (ringRadius - 0.12), 0, Math.sin(ringStudAngle) * (ringRadius - 0.12), 0, -(ringStudAngle * 180) / Math.PI, 0), () => modelBuilder.box(0, 0, 0, isCrystalStud ? 0.34 : 0.16, isCrystalStud ? 0.18 : 0.22, isCrystalStud ? 0.2 : 0.07)))
        }
      }))
  modelBuilder.bone(orbitJoint).paint(selectedTEAM_BASE_PALETTES.crystal, { c2: selectedTEAM_BASE_PALETTES.crystalHot, glow: 0.3, ...MATERIAL_PRESETS })
  for (let orbitShardIndex = 0; orbitShardIndex < 7; orbitShardIndex++) {
    const orbitShardAngle = (orbitShardIndex / 7) * FULL_CIRCLE_RADIANS,
      orbitShardHeight = coreHeight + (hashNoise(orbitShardIndex, 3) - 0.5) * 2.6
    modelBuilder.g(composeMatrix(Math.cos(orbitShardAngle) * 1.8, orbitShardHeight, Math.sin(orbitShardAngle) * 1.8, hashNoise(orbitShardIndex, 4) * 40 - 20, 0, hashNoise(orbitShardIndex, 5) * 40 - 20), () => modelBuilder.g(composeMatrix(0, -0.2, 0), () => modelBuilder.crystal(0.12, 0.44 + hashNoise(orbitShardIndex, 6) * 0.3, 4, 0.5, 0.4)))
  }
  modelBuilder.bakeGrounding(6, 0.75, 0.9)
  const animateTeamBase = (poseBuilder, animatedUnit, visualState) => {
    const animClock = animatedUnit.time + animatedUnit.seed * 10,
      damageFraction = 1 - animatedUnit.hp,
      damageIntensity = inverseLerpClamped(damageFraction, 0.5, 0.9),
      isCriticalHealth = animatedUnit.hp < 0.25 && animatedUnit.deathT < 0
    let attackProgress = 0
    if (animatedUnit.anim === "attack") {
      const attackWindup = animatedUnit.windup
      ;((attackProgress = animatedUnit.p < attackWindup ? animatedUnit.p / attackWindup : Math.max(0, 1 - (animatedUnit.p - attackWindup) / 0.25)), (visualState.glow = 1 + 1.2 * attackProgress))
    } else visualState.glow = 1 + 0.14 * Math.sin(animClock * 1.8)
    ;((visualState.glow *= 1 + 0.5 * damageFraction - damageIntensity * (0.3 + 0.3 * Math.sin(animClock * 19) * Math.sin(animClock * 6.1))),
      isCriticalHealth && (visualState.glow *= 1 + 0.5 * Math.max(0, Math.sin(animClock * 7))),
      crackJoints.forEach((crackJoint, crackIndex) => poseBuilder.scale(crackJoint, Math.max(0.001, inverseLerpClamped(damageFraction, 0.25 * (crackIndex + 1) - 0.02, 0.25 * (crackIndex + 1) + 0.04)))),
      poseBuilder.pos(starJoint, 0, Math.sin(animClock * 0.9) * 0.16, 0),
      poseBuilder.rot(starJoint, damageIntensity * 6 * Math.sin(animClock * 2.3), animClock * 14 * (1 + 2 * attackProgress), damageIntensity * 6 * Math.cos(animClock * 1.9)),
      poseBuilder.scale(starJoint, 1 + 0.1 * attackProgress + 0.02 * Math.sin(animClock * 2.2)),
      poseBuilder.rot(innerJoint, animClock * 40, animClock * -60, 0),
      poseBuilder.scale(innerJoint, 1 + 0.2 * Math.sin(animClock * 3) + 0.5 * attackProgress))
    const ringSpinScale = 1 + damageFraction * 0.8 * Math.sin(animClock * 3.1) + damageIntensity * 0.8 * Math.sin(animClock * 7.7)
    if (
      (poseBuilder.rot(ringAJoint, 24 + damageIntensity * 18 * Math.sin(animClock * 1.4), animClock * 30 * ringSpinScale, 12 + damageIntensity * 16 * Math.cos(animClock)),
      poseBuilder.rot(ringBJoint, -30 + damageIntensity * 18 * Math.cos(animClock * 1.2), -animClock * 22 * ringSpinScale, -18 + damageFraction * 10 * Math.sin(animClock * 0.9)),
      poseBuilder.rot(orbitJoint, 0, -animClock * 18, 0),
      poseBuilder.scale(orbitJoint, 1 - damageIntensity * 0.3),
      animatedUnit.deathT >= 0)
    ) {
      const deathTime = animatedUnit.deathT,
        deathOnsetProgress = inverseLerpClamped(deathTime, 0, 0.6),
        collapseProgress = inverseLerpClamped(deathTime, 0.6, 0.9),
        deathFallProgress = inverseLerpClamped(deathTime, 0.7, 2.2)
      ;(poseBuilder.scale(starJoint, Math.max(0.001, (1 + deathOnsetProgress * 0.45 + Math.sin(deathTime * 60) * 0.03 * deathOnsetProgress) * (1 - collapseProgress))),
        poseBuilder.scale(innerJoint, (1 + deathOnsetProgress * 1.6) * (1 - collapseProgress)),
        poseBuilder.scale(ringAJoint, Math.max(0.001, (1 + collapseProgress * 2.2) * (1 - inverseLerpClamped(deathTime, 1, 1.5)))),
        poseBuilder.scale(ringBJoint, Math.max(0.001, (1 + collapseProgress * 2.8) * (1 - inverseLerpClamped(deathTime, 1, 1.5)))),
        poseBuilder.pos(ringAJoint, 0, -deathFallProgress * 2.5, 0),
        poseBuilder.pos(ringBJoint, 0, -deathFallProgress * 2.8, 0),
        poseBuilder.scale(orbitJoint, Math.max(0.001, (1 + collapseProgress * 3) * (1 - inverseLerpClamped(deathTime, 0.9, 1.4)))),
        pylonJoints.forEach((pylonJoint, pylonIndex) => {
          const pylonBaseAngle = (pylonIndex * Math.PI) / 2 + Math.PI / 4,
            pylonCollapse = easeOutQuad(deathFallProgress) * deathFallProgress
          ;(poseBuilder.rot(pylonJoint, Math.sin(pylonBaseAngle) * pylonCollapse * 66 * (0.8 + hashNoise(pylonIndex, 2) * 0.4), 0, -Math.cos(pylonBaseAngle) * pylonCollapse * 66 * (0.8 + hashNoise(pylonIndex, 3) * 0.4)), poseBuilder.pos(pylonJoint, 0, -pylonCollapse * 0.3, 0))
        }),
        poseBuilder.rot(rootJoint, 0, 0, Math.sin(deathTime * 46) * 0.5 * (1 - deathFallProgress)),
        (visualState.glow = (1 + 4 * deathOnsetProgress) * (1 - inverseLerpClamped(deathTime, 0.75, 1.3)) + 0.05))
    }
  }
  return {
    key: `core:${teamIndex}`,
    geometry: modelBuilder.build(),
    rig: nodeTree,
    height: 6.9,
    radius: 2.9,
    scale: 1,
    stride: 1,
    triangles: modelBuilder.triangleCount,
    attach: { core: { joint: starJoint, x: 0, y: 0, z: 0 }, muzzle: { joint: starJoint, x: 0, y: 0, z: 0 }, chest: { joint: rootJoint, x: 0, y: 3.2, z: 0 }, head: { joint: starJoint, x: 0, y: 1.8, z: 0 } },
    blend: () => 0,
    animate: animateTeamBase,
  }
}

export { TEAM_BASE_PALETTES, BASE_GLOW_COLOR, MATERIAL_PRESETS, SURFACE_MATERIAL_ALT, buildStarCrackTube, buildTeamBaseModel, FULL_CIRCLE_RADIANS, hashNoise, METAL_MATERIAL_SPEC }