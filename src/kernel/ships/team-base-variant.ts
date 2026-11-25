/**
 * 队伍基地变体
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MATERIAL_PRESETS, METAL_MATERIAL_SPEC, SURFACE_MATERIAL_ALT, TEAM_BASE_PALETTES, hashNoise } from './yw-component'
import { NodeTree } from '../node-tree'
import { MATERIAL_KINDS, ModelBuilder, TERRAIN_LOOK, composeMatrix, lerpValue, scaleRgbChannels } from '../render/model-builder'

function buildBasePedestal(modelBuilder, basePalette, pedestalRadius) {
  ;(modelBuilder.paint(basePalette.stoneDark, { c2: basePalette.stone, ...SURFACE_MATERIAL_ALT }),
    modelBuilder.lathe(
      [
        [0, pedestalRadius],
        [0.16, pedestalRadius],
        [0.18, pedestalRadius * 0.97],
        [0.18, pedestalRadius * 0.84],
        [0.33, pedestalRadius * 0.84],
        [0.35, pedestalRadius * 0.81],
      ],
      { seg: 8, phase: 22.5, crease: 30 },
    ),
    modelBuilder.paint(basePalette.trim, { ...METAL_MATERIAL_SPEC }),
    modelBuilder.lathe(
      [
        [0.14, pedestalRadius * 1.012],
        [0.19, pedestalRadius * 1.012],
      ],
      { seg: 8, phase: 22.5, crease: 30, cap0: !1, cap1: !1 },
    ))
}

/**
 * 创建阵营与模型。
 *
 * @param teamKey - 来源
 */
function buildTeamBaseRuinModel(teamKey) {
  const selectedTEAM_BASE_PALETTES = TEAM_BASE_PALETTES[teamKey],
    nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    stumpJoint = nodeTree.add("stump", rootJoint, 0, 0.35, 0),
    modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 28),
    modelBuilder.bone(rootJoint).paint(1709588, { c2: 3813418, mat: MATERIAL_KINDS.rock, by: (positionX, positionY, positionZ) => Math.hypot(positionX, positionZ) / 2.9, line: 0 }),
    modelBuilder.lathe(
      [
        [0.04, 2.9],
        [0.05, 0.02],
      ],
      { seg: 12, cap0: !1, cap1: !1, shape: (profilePosition) => 0.78 + 0.22 * Math.sin(profilePosition * 3 + 1) * Math.sin(profilePosition * 5) },
    ),
    (modelBuilder.rough = 0.03),
    buildBasePedestal(modelBuilder, selectedTEAM_BASE_PALETTES, 1.58),
    modelBuilder.bone(stumpJoint).paint(selectedTEAM_BASE_PALETTES.stoneDark, { c2: selectedTEAM_BASE_PALETTES.stone, ...SURFACE_MATERIAL_ALT }),
    modelBuilder.lathe(
      [
        [0.35, 0.98],
        [1, 0.9],
        [1.5, 0.86],
      ],
      { seg: 8, phase: 22.5, cap1: !1, shape: (profilePosition, profileIndex) => (profileIndex === 2 ? 0.75 + 0.3 * hashNoise(Math.round(profilePosition * 3), 5) : 1) },
    ),
    modelBuilder.lathe(
      [
        [1.02, 0.02],
        [1.06, 0.84],
      ],
      { seg: 8, phase: 22.5, cap0: !1, cap1: !1 },
    ))
  for (let index = 0; index < 4; index++) {
    const crystalAngle = index * 1.7 + 0.3
    modelBuilder.g(composeMatrix(Math.cos(crystalAngle) * 0.55, 1, Math.sin(crystalAngle) * 0.55, hashNoise(index, 1) * 30 - 15, index * 80, hashNoise(index, 2) * 30 - 15), () => modelBuilder.crystal(0.22, 0.7 + hashNoise(index, 3) * 0.6, 4, 0.5, 0.05))
  }
  modelBuilder.bone(rootJoint)
  for (let rubbleIndex = 0; rubbleIndex < 11; rubbleIndex++) {
    const rubbleAngle = rubbleIndex * 2.4 + 0.5,
      rubbleRingRadius = 1.1 + hashNoise(rubbleIndex, 7) * 1.5,
      rubbleSize = 0.22 + hashNoise(rubbleIndex, 8) * 0.4
    ;(modelBuilder.paint(rubbleIndex % 3 === 0 ? selectedTEAM_BASE_PALETTES.stoneLight : selectedTEAM_BASE_PALETTES.stone, { c2: selectedTEAM_BASE_PALETTES.stoneDark, ...SURFACE_MATERIAL_ALT }),
      modelBuilder.g(composeMatrix(Math.cos(rubbleAngle) * rubbleRingRadius, rubbleSize * 0.35 + (rubbleRingRadius < 1.5 ? 0.3 : 0), Math.sin(rubbleAngle) * rubbleRingRadius, hashNoise(rubbleIndex, 9) * 60, hashNoise(rubbleIndex, 10) * 180, hashNoise(rubbleIndex, 11) * 60), () => modelBuilder.box(0, 0, 0, rubbleSize * 1.4, rubbleSize, rubbleSize * 1.1, rubbleSize * 0.2)))
  }
  modelBuilder.rough = 0
  for (let shardIndex = 0; shardIndex < 5; shardIndex++) {
    const shardAngle = shardIndex * 1.26 + 1.1,
      shardRadius = 0.9 + hashNoise(shardIndex, 13) * 1.3
    ;(modelBuilder.paint(scaleRgbChannels(selectedTEAM_BASE_PALETTES.crystal, 0.55), { c2: selectedTEAM_BASE_PALETTES.crystal, glow: 0.12, ...MATERIAL_PRESETS }),
      modelBuilder.g(composeMatrix(Math.cos(shardAngle) * shardRadius, 0.1 + (shardRadius < 1.5 ? 0.32 : 0), Math.sin(shardAngle) * shardRadius, 60 + hashNoise(shardIndex, 14) * 40, shardIndex * 77, hashNoise(shardIndex, 15) * 60), () => modelBuilder.crystal(0.14, 0.5 + hashNoise(shardIndex, 16) * 0.5, 5, 0.5, 0.2)))
  }
  for (let gemIndex = 0; gemIndex < 9; gemIndex++) {
    const gemAngle = gemIndex * 2.1 + 0.9,
      gemRadius = 0.5 + hashNoise(gemIndex, 21) * 2
    ;(modelBuilder.paint(16742956, { c2: 16765562, glow: 0.7, mat: MATERIAL_KINDS.crystal, line: 0 }), modelBuilder.ball(Math.cos(gemAngle) * gemRadius, 0.08 + (gemRadius < 1.5 ? 0.34 : 0), Math.sin(gemAngle) * gemRadius, 0.07, 0.035, 0.06, 0))
  }
  return (
    modelBuilder.paint(6969932, { mat: MATERIAL_KINDS.leather }),
    modelBuilder.limb([1.05, 0.3, 0.5], [1.5, 1.9, 0.26], 0.04, 0.03, { seg: 5 }),
    modelBuilder.paint(792624, { team: 0.8, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.weave, patternScale: 8, patternAmt: 0.35 }),
    modelBuilder.sheet(3, 2, (sheetU, sheetV) => {
      const foldHeight = sheetV > 0.6 ? 0.16 * Math.abs(Math.sin(sheetU * 9)) : 0
      return [lerpValue(1.5, 1.24, sheetV) + sheetU * 0.5, 1.9 - sheetV * 0.9 - sheetU * 0.2 + foldHeight * 0.3 - foldHeight * 0.5, 0.26 + lerpValue(0, 0.14, sheetV) + sheetU * 0.18]
    }),
    modelBuilder.bakeGrounding(2.4, 0.7, 0.85),
    {
      key: `ruin:${teamKey}`,
      geometry: modelBuilder.build(),
      rig: nodeTree,
      height: 2.2,
      radius: 2.9,
      scale: 1,
      stride: 1,
      triangles: modelBuilder.triangleCount,
      attach: {},
      blend: () => 0,
      /**
       * 处理动画。
       *
       * @param poseBuilder - 主要输入
       * @param world - 战场
       * @param output - 输入
      */
      animate(poseBuilder, world, output) {
        const animProgress = world.p
        ;(poseBuilder.scale(rootJoint, 0.3 + 0.7 * animProgress),
          poseBuilder.pos(rootJoint, 0, -0.3 * (1 - animProgress), 0),
          poseBuilder.scale(stumpJoint, 0.4 + 0.6 * animProgress * animProgress),
          (output.glow = (0.6 + 0.4 * Math.sin(world.time * 1.3 + world.seed * 6)) * (1 + 1.2 * Math.max(0, 1 - world.t / 12))))
      },
    }
  )
}

export { buildBasePedestal, buildTeamBaseRuinModel }