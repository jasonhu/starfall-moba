/**
 * 小兵与防御塔程序化模型构造器（models.ts 拆分）
 * 由 tools/split-models.cjs 从 models.ts 物理拆分，声明文本逐字节保留。
 */

import { NodeTree } from './node-tree'
import { TEAM_COLOR_TABLE, TEAM_BASE_PALETTES, TEAM_PALETTE_KEYS, inverseLerpClamped, hermiteSmoothStep, TEAM_CRYSTAL_SPEC, NEUTRAL_BASE_SPEC, hitImpactPulse, easeOutQuad, buildBasePedestal, BASE_GLOW_COLOR, MATERIAL_KINDS, MATERIAL_PRESETS, ModelBuilder, BUILDING_GEOMETRY_CACHE, windupEaseCurve, STRUCTURE_PALETTE, SURFACE_MATERIAL, SURFACE_MATERIAL_ALT, TERRAIN_LOOK, scaleRgbChannels, buildStarCrackTube, smoothFalloff, lerpValue, composeMatrix, FULL_CIRCLE_RADIANS, STRUCTURE_MATERIAL_SPEC, hashNoise, TOWER_BUILDING_SPEC, METAL_MATERIAL_SPEC, BASE_BUILDING_SPEC } from './starfall.core'

function emitCrestSpikes(builder, coordY, coordZ) {
  const emitSpike = (target, primary, secondary) => {
    builder.g(composeMatrix(target, 0, 0), () =>
      builder.extrude(
        [
          [0, -coordY * 0.7],
          [secondary, -coordY * 0.3],
          [secondary * 0.7, primary * 0.3],
          [secondary * 0.2, primary * 0.5],
          [0, primary],
          [-secondary * 0.5, primary * 0.4],
          [-secondary, -coordY * 0.3],
        ],
        coordZ,
        0,
      ),
    )
  }
  ;(emitSpike(0, coordY * 1.05, coordY * 0.36), emitSpike(-coordY * 0.55, coordY * 0.55, coordY * 0.27), emitSpike(coordY * 0.55, coordY * 0.6, coordY * 0.27))
}

/**
 * 创建小兵与模型。
 *
 * @returns 结果对象
 */
function buildMeleeMinionModel() {
  const nodeTree = new NodeTree(),
    rootJoint = nodeTree.add("root", -1, 0, 0, 0),
    bodyJoint = nodeTree.add("body", rootJoint, 0, 0.5, 0),
    headJoint = nodeTree.add("head", bodyJoint, 0, 0.92, 0.02),
    armLJoint = nodeTree.add("armL", bodyJoint, 0.34, 0.8, 0),
    armRJoint = nodeTree.add("armR", bodyJoint, -0.34, 0.8, 0),
    legLJoint = nodeTree.add("legL", rootJoint, 0.15, 0.36, 0),
    legRJoint = nodeTree.add("legR", rootJoint, -0.15, 0.36, 0),
    emblemBJoint = nodeTree.add("emblemB", armLJoint, 0.5, 0.56, 0.2),
    emblemRJoint = nodeTree.add("emblemR", armLJoint, 0.5, 0.56, 0.2),
    builder = new ModelBuilder()
  ;((builder.crease = 38),
    builder.sym((sideSign) => {
      ;(builder.bone(sideSign > 0 ? legLJoint : legRJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        builder.lathe(
          [
            [0.1, 0.1, 0.11, 0.15, 0],
            [0.36, 0.115, 0.12, 0.15, 0],
            [0.42, 0.09, 0.09, 0.15, 0],
          ],
          { seg: 6, phase: 30 },
        ),
        builder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        builder.lathe(
          [
            [0, 0.13, 0.17, 0.15, 0.035],
            [0.1, 0.125, 0.15, 0.15, 0.02],
            [0.14, 0.1, 0.11, 0.15, 0],
          ],
          { seg: 6, phase: 30 },
        ))
    }),
    builder.bone(bodyJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    builder.lathe(
      [
        [0.34, 0.2, 0.17],
        [0.46, 0.26, 0.2],
        [0.5, 0.25, 0.19],
      ],
      { seg: 6, phase: 30, power: 2.4 },
    ),
    builder.lathe(
      [
        [0.53, 0.27, 0.2],
        [0.7, 0.36, 0.26],
        [0.88, 0.38, 0.27],
        [0.96, 0.24, 0.2],
      ],
      { seg: 6, phase: 30, power: 2.4 },
    ),
    builder.paint(16777215, TEAM_PALETTE_KEYS(0.75)),
    builder.lathe(
      [
        [0.49, 0.235, 0.18],
        [0.54, 0.25, 0.19],
      ],
      { seg: 6, phase: 30, power: 2.4, cap0: !1, cap1: !1 },
    ),
    builder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    builder.g(composeMatrix(0, 0.5, 0.205, 6, 0, 0), () =>
      builder.extrude(
        [
          [-0.13, 0],
          [0.13, 0],
          [0.12, -0.26],
          [0, -0.34],
          [-0.12, -0.26],
        ],
        0.03,
        0.008,
      ),
    ),
    builder.g(composeMatrix(0, 0.5, -0.2, -6, 0, 0), () =>
      builder.extrude(
        [
          [-0.12, 0],
          [0.12, 0],
          [0.11, -0.2],
          [-0.11, -0.2],
        ],
        0.03,
        0.008,
      ),
    ),
    builder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    builder.g(composeMatrix(0, 0.74, 0.265, -10, 0, 45), () => builder.box(0, 0, 0, 0.1, 0.1, 0.03, 0.012)),
    builder.bone(headJoint).paint(STRUCTURE_PALETTE.stone, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    builder.lathe(
      [
        [0.9, 0.15, 0.15, 0, 0.02],
        [0.98, 0.21, 0.2, 0, 0.02],
        [1.16, 0.2, 0.19, 0, 0.02],
        [1.26, 0.1, 0.1, 0, 0],
      ],
      { seg: 6, phase: 90 },
    ),
    builder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    builder.g(composeMatrix(0, 1.07, 0.185, -4, 0, 0), () =>
      builder.extrude(
        [
          [-0.12, -0.12],
          [0.12, -0.12],
          [0.14, 0.06],
          [0, 0.14],
          [-0.14, 0.06],
        ],
        0.05,
        0.015,
      ),
    ),
    builder.paint(16777215, TEAM_PALETTE_KEYS(0.9)),
    builder.box(0, 1.06, 0.216, 0.03, 0.17, 0.02),
    builder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    builder.g(composeMatrix(0, 1.24, -0.04), () =>
      builder.extrude(
        [
          [-0.025, 0],
          [0.025, 0],
          [0.04, 0.12],
          [0, 0.2],
          [-0.04, 0.12],
        ],
        0.22,
        0.015,
      ),
    ),
    builder.bone(armLJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
    builder.ball(0.36, 0.8, 0, 0.12, 0.12, 0.12, 0, 40),
    builder.limb([0.38, 0.8, 0], [0.42, 0.5, 0.06], 0.085, 0.1, { seg: 6 }),
    builder.g(composeMatrix(0.5, 0.56, 0.14, 0, 62, 0), () => {
      ;(builder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        builder.extrude(
          [
            [-0.25, 0.26],
            [0.25, 0.26],
            [0.27, -0.06],
            [0, -0.38],
            [-0.27, -0.06],
          ],
          0.06,
          0.02,
        ),
        builder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
        builder.g(composeMatrix(0, 0, 0.034), () =>
          builder.extrude(
            [
              [-0.2, 0.21],
              [0.2, 0.21],
              [0.215, -0.045],
              [0, -0.3],
              [-0.215, -0.045],
            ],
            0.02,
            0.006,
          ),
        ),
        builder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
        builder.g(composeMatrix(0, 0.285, 0), () => builder.box(0, 0, 0, 0.54, 0.05, 0.08, 0.015)))
    }),
    builder.bone(emblemBJoint).paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    builder.g(composeMatrix(0.5, 0.56, 0.14, 0, 62, 0), () => builder.g(composeMatrix(0, 0, 0.05), () => builder.extrude(NEUTRAL_BASE_SPEC(0.15), 0.03, 0))),
    builder.bone(emblemRJoint).paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    builder.g(composeMatrix(0.5, 0.56, 0.14, 0, 62, 0), () => builder.g(composeMatrix(0, 0, 0.05), () => emitCrestSpikes(builder, 0.15, 0.03))),
    builder.bone(armRJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
    builder.ball(-0.36, 0.8, 0, 0.12, 0.12, 0.12, 0, 40),
    builder.limb([-0.38, 0.8, 0], [-0.4, 0.5, 0.04], 0.085, 0.1, { seg: 6 }),
    builder.g(composeMatrix(-0.4, 0.46, 0.06), () => {
      ;(builder.paint(STRUCTURE_PALETTE.wood, { mat: MATERIAL_KINDS.leather, pattern: TERRAIN_LOOK.bark, patternScale: 10, patternAmt: 0.3 }),
        builder.tube(
          [
            [0, 0, -0.26, 0.026],
            [0, 0, 0.74, 0.024],
          ],
          { seg: 5 },
        ),
        builder.paint(14673650, { c2: 16777215, gloss: 1, mat: MATERIAL_KINDS.metal }),
        builder.tube(
          [
            [0, 0, 0.7, 0.012, 0.04],
            [0, 0, 0.92, 0.004, 0.006],
          ],
          { seg: 4, crease: 0 },
        ),
        builder.g(composeMatrix(0, 0, 0.6, 90, 0, 90), () =>
          builder.extrude(
            [
              [-0.03, 0],
              [0.03, 0],
              [0.035, 0.1],
              [0.055, 0.17],
              [0, 0.36],
              [-0.055, 0.17],
              [-0.035, 0.1],
            ],
            0.03,
            0.012,
          ),
        ),
        builder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
        builder.tube(
          [
            [0, 0, 0.54, 0.04],
            [0, 0, 0.62, 0.04],
          ],
          { seg: 6, crease: 30 },
        ))
    }),
    builder.bakeGrounding(1.3))
  const sum = (primary, world, secondary) => {
    const sum = world.time * 2.4 + world.seed * 6
    switch ((primary.scale(emblemBJoint, world.team === 1 ? 0.001 : 1), primary.scale(emblemRJoint, world.team === 1 ? 1 : 0.001), world.anim)) {
      case "dead": {
        const bUILDING_GEOMETRY_CACHEResult = BUILDING_GEOMETRY_CACHE(world.t)
        ;(primary.pos(bodyJoint, 0, -0.1 * bUILDING_GEOMETRY_CACHEResult.slump - 0.3 * bUILDING_GEOMETRY_CACHEResult.fall * bUILDING_GEOMETRY_CACHEResult.fall, 0),
          primary.rot(bodyJoint, 14 * bUILDING_GEOMETRY_CACHEResult.slump + 40 * bUILDING_GEOMETRY_CACHEResult.burst, 0, 10 * bUILDING_GEOMETRY_CACHEResult.burst),
          TEAM_CRYSTAL_SPEC(primary, headJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, 0.1, -0.5, 0.7, -120, 40),
          TEAM_CRYSTAL_SPEC(primary, armLJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, 0.5, 0.2, 0.5, 20, 80),
          TEAM_CRYSTAL_SPEC(primary, armRJoint, bUILDING_GEOMETRY_CACHEResult.burst, bUILDING_GEOMETRY_CACHEResult.fall, -0.45, 0.3, 0.5, -40, -90),
          primary.rot(legLJoint, -30 * bUILDING_GEOMETRY_CACHEResult.burst, 0, 30 * bUILDING_GEOMETRY_CACHEResult.burst),
          primary.rot(legRJoint, 20 * bUILDING_GEOMETRY_CACHEResult.burst, 0, -34 * bUILDING_GEOMETRY_CACHEResult.burst),
          (secondary.glow = Math.max(0.02, 1 - bUILDING_GEOMETRY_CACHEResult.slump * 1.2)))
        break
      }
      case "move": {
        const stridePhase = world.stride * STRUCTURE_MATERIAL_SPEC,
          strideSwing = Math.sin(stridePhase)
        ;(primary.rot(legLJoint, strideSwing * 36, 0, 0),
          primary.rot(legRJoint, -strideSwing * 36, 0, 0),
          primary.pos(bodyJoint, 0, Math.abs(Math.cos(stridePhase)) * 0.04, 0),
          primary.rot(bodyJoint, 9 + Math.cos(stridePhase * 2) * 2, -strideSwing * 7, 0),
          primary.rot(headJoint, -4 - Math.cos(stridePhase * 2 + 0.6) * 3, 0, 0),
          primary.rot(armRJoint, -24 + Math.sin(stridePhase - 0.8) * 16, 0, -6),
          primary.rot(armLJoint, -26 - strideSwing * 10, 0, 0))
        break
      }
      case "attack": {
        const windupEaseCurveResult = windupEaseCurve(world.p, world.windup),
          easeOutQuadResult = easeOutQuad(inverseLerpClamped(windupEaseCurveResult, 0, 0.26)),
          strikePhase = inverseLerpClamped(windupEaseCurveResult, 0.26, 0.36),
          recoveryPhase = hermiteSmoothStep(inverseLerpClamped(windupEaseCurveResult, 0.5, 1)),
          scaledValueX = easeOutQuadResult * (1 - strikePhase),
          scaledValueY = strikePhase * (1 - recoveryPhase),
          smoothFalloffResult = smoothFalloff(windupEaseCurveResult, 0.42, 0.1)
        ;(primary.rot(armRJoint, -130 * scaledValueX - 74 * scaledValueY + 14 * smoothFalloffResult, 0, -24 * scaledValueX + 10 * scaledValueY),
          primary.rot(bodyJoint, -12 * scaledValueX + 18 * scaledValueY, 30 * scaledValueX - 22 * scaledValueY, 0),
          primary.pos(bodyJoint, 0, 0.03 * scaledValueX - 0.04 * scaledValueY, -0.06 * scaledValueX + 0.14 * scaledValueY),
          primary.rot(legLJoint, 10 * scaledValueX - 18 * scaledValueY, 0, 0),
          primary.rot(legRJoint, -6 * scaledValueX + 12 * scaledValueY, 0, 0),
          primary.rot(armLJoint, -34 - 10 * scaledValueX, 0, 0),
          primary.rot(headJoint, 6 * scaledValueX - 6 * scaledValueY, -14 * scaledValueX + 8 * scaledValueY, 0),
          (secondary.glow = 1 + 0.3 * scaledValueX + 0.7 * smoothFalloff(windupEaseCurveResult, 0.36, 0.14)))
        break
      }
      case "stunned": {
        ;(primary.rot(bodyJoint, 8 + Math.sin(sum * 2.2) * 6, 0, Math.cos(sum * 2.2) * 8), primary.rot(headJoint, 14, Math.sin(sum * 2.2) * 20, 0), primary.rot(armLJoint, -10, 0, 20), primary.rot(armRJoint, 10, 0, -20), (secondary.glow = 0.6))
        break
      }
      case "airborne": {
        ;(primary.rot(rootJoint, -20 * Math.sin(world.p * Math.PI), 0, 0), primary.rot(armLJoint, -60, 0, 70), primary.rot(armRJoint, -60, 0, -70), primary.rot(legLJoint, -30, 0, 14), primary.rot(legRJoint, 20, 0, -14))
        break
      }
      default:
        ;(primary.pos(bodyJoint, 0, Math.sin(sum) * 0.012, 0),
          primary.rot(headJoint, 0, Math.sin(sum * 0.4) * 8, 0),
          primary.rot(armLJoint, -22 + Math.sin(sum) * 2, 0, 0),
          primary.rot(armRJoint, -8 + Math.sin(sum + 1) * 3, 0, 0),
          (secondary.glow = 1 + 0.12 * Math.sin(sum * 1.3)))
    }
    const hitFlinch = hitImpactPulse(world.hitT, 0.18)
    hitFlinch > 0 && world.anim !== "dead" && (primary.add(bodyJoint, -10 * hitFlinch, 0, 0), primary.add(headJoint, 12 * hitFlinch, 0, 0))
  }
  return {
    key: "minion:melee",
    geometry: builder.build(),
    rig: nodeTree,
    height: 1.42,
    radius: 0.5,
    scale: 1,
    stride: 1.5,
    triangles: builder.triangleCount,
    deathDur: 1.1,
    outline: 1.2,
    attach: {
      chest: { joint: bodyJoint, x: 0, y: 0.2, z: 0 },
      head: { joint: headJoint, x: 0, y: 0.2, z: 0 },
      weapon: { joint: armRJoint, x: -0.06, y: -0.34, z: 0.9 },
      muzzle: { joint: armRJoint, x: -0.06, y: -0.34, z: 0.9 },
      handL: { joint: armLJoint, x: 0.16, y: -0.24, z: 0.14 },
      handR: { joint: armRJoint, x: -0.06, y: -0.34, z: 0.06 },
    },
    blend: (lastAnim, attackKind) => (attackKind === "attack" ? 0.07 : 0.12),
    animate: sum,
  }
}

/**
 * 创建小兵与模型。
 *
 * @returns 结果对象
 */
function buildSuperMinionModel() {
  const nodeTree = new NodeTree(),
    delta = nodeTree.add("root", -1, 0, 0, 0),
    hipsJoint = nodeTree.add("hips", delta, 0, 0.8, 0),
    chestJoint = nodeTree.add("chest", hipsJoint, 0, 1.22, 0),
    headJoint = nodeTree.add("head", chestJoint, 0, 1.76, 0.05),
    armLJoint = nodeTree.add("armL", chestJoint, 0.58, 1.56, 0),
    armRJoint = nodeTree.add("armR", chestJoint, -0.58, 1.56, 0),
    foreLJoint = nodeTree.add("foreL", armLJoint, 0.64, 1.12, 0),
    foreRJoint = nodeTree.add("foreR", armRJoint, -0.64, 1.12, 0),
    maulJoint = nodeTree.add("maul", foreRJoint, -0.64, 0.76, 0.04),
    legLJoint = nodeTree.add("legL", hipsJoint, 0.23, 0.76, 0),
    legRJoint = nodeTree.add("legR", hipsJoint, -0.23, 0.76, 0),
    flag0Joint = nodeTree.add("flag0", chestJoint, 0.3, 2.56, -0.36),
    flag1Joint = nodeTree.add("flag1", flag0Joint, 0.68, 2.52, -0.36)
  nodeTree.chain({ joints: [flag0Joint, flag1Joint], tip: [0.36, -0.03, 0], stiffness: 10, drag: 0.88, gravity: 4, maxAngle: 60, wind: 4 })
  const emblemBJoint = nodeTree.add("emblemB", chestJoint, 0, 1.42, 0.42),
    emblemRJoint = nodeTree.add("emblemR", chestJoint, 0, 1.42, 0.42),
    modelBuilder = new ModelBuilder()
  ;((modelBuilder.crease = 36),
    modelBuilder.sym((sideSign) => {
      ;(modelBuilder.bone(sideSign > 0 ? legLJoint : legRJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        modelBuilder.lathe(
          [
            [0.14, 0.16, 0.18, 0.23, 0.01],
            [0.46, 0.17, 0.18, 0.23, 0],
            [0.8, 0.21, 0.2, 0.23, 0],
          ],
          { seg: 6, phase: 30, power: 2.3 },
        ),
        modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        modelBuilder.lathe(
          [
            [0, 0.21, 0.27, 0.23, 0.05],
            [0.14, 0.19, 0.22, 0.23, 0.02],
            [0.18, 0.16, 0.17, 0.23, 0],
          ],
          { seg: 6, phase: 30 },
        ),
        modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.6)),
        modelBuilder.lathe(
          [
            [0.46, 0.175, 0.185, 0.23, 0],
            [0.5, 0.18, 0.19, 0.23, 0],
          ],
          { seg: 6, phase: 30, power: 2.3, cap0: !1, cap1: !1 },
        ))
    }),
    modelBuilder.bone(hipsJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
    modelBuilder.lathe(
      [
        [0.66, 0.24, 0.2],
        [0.8, 0.36, 0.28],
        [0.98, 0.34, 0.27],
        [1.06, 0.3, 0.24],
      ],
      { seg: 8, power: 2.4, phase: 22.5 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    modelBuilder.g(composeMatrix(0, 0.84, 0.29, 6, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.2, 0],
          [0.2, 0],
          [0.18, -0.36],
          [0, -0.48],
          [-0.18, -0.36],
        ],
        0.035,
        0.01,
      ),
    ),
    modelBuilder.g(composeMatrix(0, 0.84, -0.28, -6, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.2, 0],
          [0.2, 0],
          [0.17, -0.34],
          [-0.17, -0.34],
        ],
        0.035,
        0.01,
      ),
    ),
    modelBuilder.sym(() =>
      modelBuilder.g(composeMatrix(0.36, 0.84, 0, 0, 90, -8), () =>
        modelBuilder.extrude(
          [
            [-0.14, 0],
            [0.14, 0],
            [0.11, -0.26],
            [-0.11, -0.26],
          ],
          0.035,
          0.01,
        ),
      ),
    ),
    modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.7)),
    modelBuilder.lathe(
      [
        [1.03, 0.31, 0.25],
        [1.08, 0.33, 0.265],
      ],
      { seg: 8, power: 2.4, phase: 22.5, cap0: !1, cap1: !1 },
    ),
    modelBuilder.bone(chestJoint).paint(STRUCTURE_PALETTE.stone, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    modelBuilder.lathe(
      [
        [1.06, 0.34, 0.27],
        [1.2, 0.52, 0.37],
        [1.46, 0.62, 0.41],
        [1.66, 0.56, 0.37],
        [1.76, 0.3, 0.26],
      ],
      { seg: 8, power: 2.4, phase: 22.5 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    modelBuilder.g(composeMatrix(0, 1.42, 0.38, -6, 0, 0), () =>
      modelBuilder.extrude(
        [
          [0, -0.26],
          [0.22, -0.12],
          [0.24, 0.16],
          [0, 0.26],
          [-0.24, 0.16],
          [-0.22, -0.12],
        ],
        0.07,
        0.02,
      ),
    ),
    modelBuilder.bone(emblemBJoint).paint(16777215, TEAM_PALETTE_KEYS(0.7)),
    modelBuilder.g(composeMatrix(0, 1.42, 0.425, -6, 0, 0), () => modelBuilder.extrude(NEUTRAL_BASE_SPEC(0.17), 0.03, 0)),
    modelBuilder.bone(emblemRJoint).paint(16777215, TEAM_PALETTE_KEYS(0.7)),
    modelBuilder.g(composeMatrix(0, 1.42, 0.425, -6, 0, 0), () => emitCrestSpikes(modelBuilder, 0.16, 0.03)),
    modelBuilder.bone(chestJoint).paint(STRUCTURE_PALETTE.wood, { mat: MATERIAL_KINDS.leather }),
    modelBuilder.limb([0.3, 1.5, -0.34], [0.3, 2.74, -0.36], 0.03, 0.026, { seg: 5 }),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.g(composeMatrix(0.3, 2.72, -0.36), () => modelBuilder.crystal(0.05, 0.2, 4, 0.6, 0.3)),
    modelBuilder.bind((progress) => (progress < 0.5 ? [flag0Joint, flag0Joint, 1] : [flag1Joint, flag0Joint, Math.min(1, (progress - 0.5) / 0.3)])),
    modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
    modelBuilder.sheet(4, 2, (primary, secondary) => [0.32 + primary * 0.74, 2.68 - secondary * 0.54 * (1 - primary * 0.35) - primary * 0.1, -0.36 + 0.04 * Math.sin(primary * 6) * secondary]),
    modelBuilder.bone(headJoint).paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
    modelBuilder.lathe(
      [
        [1.72, 0.17, 0.18, 0, 0.05],
        [1.82, 0.23, 0.23, 0, 0.05],
        [1.98, 0.22, 0.22, 0, 0.04],
        [2.1, 0.1, 0.11, 0, 0.02],
      ],
      { seg: 6, phase: 90 },
    ),
    modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
    modelBuilder.g(composeMatrix(0, 1.9, 0.25, -4, 0, 0), () =>
      modelBuilder.extrude(
        [
          [-0.14, -0.13],
          [0.14, -0.13],
          [0.16, 0.07],
          [0, 0.16],
          [-0.16, 0.07],
        ],
        0.06,
        0.018,
      ),
    ),
    modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.9)),
    modelBuilder.box(0, 1.89, 0.288, 0.035, 0.2, 0.02),
    modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
    modelBuilder.sym(() =>
      modelBuilder.tube(
        [
          [0.2, 1.96, 0.04, 0.05, 0.05],
          [0.34, 2.06, 0.02, 0.04, 0.04],
          [0.38, 2.22, 0.02, 0.008, 0.008],
        ],
        { seg: 5 },
      ),
    ),
    modelBuilder.sym((sideSign) => {
      const items = sideSign > 0 ? sideSign : armRJoint
      ;(modelBuilder.bone(items).paint(STRUCTURE_PALETTE.stone, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
        modelBuilder.g(composeMatrix(0.66, 1.64, 0, 0, 0, -16), () => {
          ;(modelBuilder.lathe(
            [
              [-0.12, 0.3, 0.28],
              [0, 0.31, 0.29],
              [0.13, 0.23, 0.21],
              [0.19, 0.06, 0.06],
            ],
            { seg: 6, crease: 34, power: 2.4 },
          ),
            modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
            modelBuilder.lathe(
              [
                [-0.13, 0.315, 0.295],
                [-0.07, 0.32, 0.3],
              ],
              { seg: 6, power: 2.4, cap0: !1, cap1: !1 },
            ),
            modelBuilder.paint(STRUCTURE_PALETTE.cloth, { ...TEAM_COLOR_TABLE }),
            modelBuilder.g(composeMatrix(0.2, -0.1, 0, 0, 90, 14), () =>
              modelBuilder.extrude(
                [
                  [-0.2, 0],
                  [0.2, 0],
                  [0.16, -0.24],
                  [0, -0.32],
                  [-0.16, -0.24],
                ],
                0.03,
                0.008,
              ),
            ))
        }),
        modelBuilder.paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stone, ...SURFACE_MATERIAL }),
        modelBuilder.limb([0.62, 1.54, 0], [0.64, 1.14, 0], 0.15, 0.13, { seg: 6 }),
        modelBuilder.bone(sideSign > 0 ? foreLJoint : foreRJoint).paint(STRUCTURE_PALETTE.stone, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
        modelBuilder.ball(0.64, 1.12, 0, 0.14, 0.14, 0.14, 0, 60),
        modelBuilder.limb([0.64, 1.12, 0], [0.64, 0.8, 0], 0.13, 0.17, { seg: 6 }),
        modelBuilder.paint(STRUCTURE_PALETTE.iron, { ...TOWER_BUILDING_SPEC }),
        modelBuilder.box(0.64, 0.7, 0.01, 0.25, 0.24, 0.27, 0.06),
        modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.6)),
        modelBuilder.box(0.64, 0.835, 0, 0.3, 0.03, 0.3))
    }),
    modelBuilder.bone(maulJoint),
    modelBuilder.g(composeMatrix(-0.64, 0.72, 0.04), () => {
      ;(modelBuilder.paint(STRUCTURE_PALETTE.wood, { mat: MATERIAL_KINDS.leather, pattern: TERRAIN_LOOK.bark, patternScale: 8, patternAmt: 0.3 }),
        modelBuilder.tube(
          [
            [0, 0, -0.5, 0.04],
            [0, 0, 1.06, 0.045],
          ],
          { seg: 6 },
        ),
        modelBuilder.paint(STRUCTURE_PALETTE.stoneDark, { c2: STRUCTURE_PALETTE.stoneLight, ...SURFACE_MATERIAL }),
        modelBuilder.box(0, 0, 1.24, 0.46, 0.4, 0.44, 0.07),
        modelBuilder.paint(STRUCTURE_PALETTE.brass, { ...BASE_BUILDING_SPEC }),
        modelBuilder.box(0, 0, 1.24, 0.5, 0.14, 0.48, 0.03),
        modelBuilder.tube(
          [
            [0, 0, -0.52, 0.06],
            [0, 0, -0.44, 0.06],
          ],
          { seg: 6, crease: 30 },
        ),
        modelBuilder.paint(16777215, TEAM_PALETTE_KEYS(0.75)),
        modelBuilder.sym(() => modelBuilder.g(composeMatrix(0.23, 0, 1.24, 0, 0, -90), () => modelBuilder.crystal(0.1, 0.16, 4, 0.9, 0.1))))
    }),
    modelBuilder.bakeGrounding(2.2))
  const sum = (coordX, animState, coordZ) => {
    const sum = animState.time * 1.6 + animState.seed * 6
    switch ((coordX.scale(emblemBJoint, animState.team === 1 ? 0.001 : 1), coordX.scale(emblemRJoint, animState.team === 1 ? 1 : 0.001), coordX.rot(armRJoint, -20, 0, -10), coordX.rot(foreRJoint, -100, 0, 0), coordX.rot(armLJoint, 6, 0, 10), coordX.rot(foreLJoint, -20, 0, 0), animState.anim)) {
      case "dead": {
        const buildingGeometryCache = BUILDING_GEOMETRY_CACHE(animState.t * 0.85)
        ;(coordX.pos(hipsJoint, 0, -0.14 * buildingGeometryCache.slump - 0.46 * buildingGeometryCache.fall * buildingGeometryCache.fall, 0),
          coordX.rot(hipsJoint, 10 * buildingGeometryCache.slump + 30 * buildingGeometryCache.burst, 0, 8 * buildingGeometryCache.burst),
          coordX.rot(chestJoint, 20 * buildingGeometryCache.burst, 0, -10 * buildingGeometryCache.burst),
          TEAM_CRYSTAL_SPEC(coordX, headJoint, buildingGeometryCache.burst, buildingGeometryCache.fall, 0.2, 0.6, 1.4, 140, 30),
          TEAM_CRYSTAL_SPEC(coordX, armLJoint, buildingGeometryCache.burst, buildingGeometryCache.fall, 0.6, 0, 1, 20, 90),
          TEAM_CRYSTAL_SPEC(coordX, armRJoint, buildingGeometryCache.burst, buildingGeometryCache.fall, -0.6, 0.2, 1, 40, -90),
          coordX.rot(foreRJoint, -100 + 90 * buildingGeometryCache.burst, 0, 0),
          coordX.rot(legLJoint, -20 * buildingGeometryCache.burst, 0, 24 * buildingGeometryCache.burst),
          coordX.rot(legRJoint, 14 * buildingGeometryCache.burst, 0, -26 * buildingGeometryCache.burst),
          (coordZ.glow = Math.max(0.02, 1 - buildingGeometryCache.slump * 1.3)))
        break
      }
      case "move": {
        const stridePhase = animState.stride * STRUCTURE_MATERIAL_SPEC,
          strideSwing = Math.sin(stridePhase)
        ;(coordX.rot(legLJoint, strideSwing * 30, 0, 0),
          coordX.rot(legRJoint, -strideSwing * 30, 0, 0),
          coordX.pos(hipsJoint, 0, Math.abs(Math.cos(stridePhase)) * 0.06 - 0.02, 0),
          coordX.rot(hipsJoint, 7, -strideSwing * 6, strideSwing * 2),
          coordX.rot(chestJoint, 2 + Math.cos(stridePhase * 2) * 2, strideSwing * 8, 0),
          coordX.rot(armLJoint, 6 - strideSwing * 22, 0, 10),
          coordX.rot(maulJoint, Math.sin(stridePhase * 2 - 1) * 4, 0, 0))
        break
      }
      case "attack": {
        const windupEase = windupEaseCurve(animState.p, animState.windup),
          easedValue = easeOutQuad(inverseLerpClamped(windupEase, 0, 0.26)),
          normalizedProgress = inverseLerpClamped(windupEase, 0.26, 0.36),
          strikeRecoveryEase = hermiteSmoothStep(inverseLerpClamped(windupEase, 0.55, 1)),
          scaledValueX = easedValue * (1 - normalizedProgress),
          scaledValueY = normalizedProgress * (1 - strikeRecoveryEase),
          falloffValue = smoothFalloff(windupEase, 0.42, 0.1)
        ;(coordX.rot(armRJoint, -20 - 140 * scaledValueX - 44 * scaledValueY + 10 * falloffValue, 0, -10 - 10 * scaledValueX),
          coordX.rot(foreRJoint, -100 + 50 * scaledValueX + 84 * scaledValueY, 0, 0),
          coordX.rot(armLJoint, 6 - 120 * scaledValueX - 40 * scaledValueY, 0, 10 - 30 * scaledValueX - 20 * scaledValueY),
          coordX.rot(foreLJoint, -20 - 60 * scaledValueX, 0, 0),
          coordX.rot(maulJoint, -30 * scaledValueX + 34 * scaledValueY, 0, 0),
          coordX.rot(chestJoint, -14 * scaledValueX + 24 * scaledValueY, 14 * scaledValueX - 10 * scaledValueY, 0),
          coordX.rot(hipsJoint, -4 * scaledValueX + 10 * scaledValueY, 0, 0),
          coordX.pos(hipsJoint, 0, 0.05 * scaledValueX - 0.12 * scaledValueY, 0.14 * scaledValueY),
          coordX.rot(legLJoint, 8 * scaledValueX - 20 * scaledValueY, 0, 0),
          coordX.rot(legRJoint, -6 * scaledValueX + 14 * scaledValueY, 0, 0),
          (coordZ.glow = 1 + 0.3 * scaledValueX + 0.8 * smoothFalloff(windupEase, 0.36, 0.16)))
        break
      }
      case "stunned": {
        ;(coordX.rot(hipsJoint, 6 + Math.sin(sum * 2.6) * 4, 0, Math.cos(sum * 2.6) * 6), coordX.rot(headJoint, 16, Math.sin(sum * 2.6) * 20, 0), (coordZ.glow = 0.6))
        break
      }
      case "airborne": {
        ;(coordX.rot(delta, -18 * Math.sin(animState.p * Math.PI), 0, 0), coordX.rot(legLJoint, -30, 0, 10), coordX.rot(legRJoint, 16, 0, -10), coordX.rot(armLJoint, -50, 0, 60))
        break
      }
      default:
        ;(coordX.pos(hipsJoint, 0, Math.sin(sum) * 0.014, 0), coordX.rot(chestJoint, Math.sin(sum) * 1.6, 0, 0), coordX.rot(headJoint, 0, Math.sin(sum * 0.4) * 9, 0), (coordZ.glow = 1 + 0.15 * Math.sin(sum * 2)))
    }
    const hitPulse = hitImpactPulse(animState.hitT, 0.18)
    hitPulse > 0 && animState.anim !== "dead" && (coordX.add(chestJoint, -8 * hitPulse, 0, 0), coordX.add(headJoint, 10 * hitPulse, 0, 0))
  }
  return {
    key: "minion:super",
    geometry: modelBuilder.build(),
    rig: nodeTree,
    height: 2.5,
    radius: 0.9,
    scale: 1,
    stride: 2.4,
    triangles: modelBuilder.triangleCount,
    deathDur: 1.3,
    outline: 1.3,
    attach: {
      chest: { joint: chestJoint, x: 0, y: 0.15, z: 0 },
      head: { joint: headJoint, x: 0, y: 0.2, z: 0 },
      weapon: { joint: maulJoint, x: 0, y: 0, z: 1.3 },
      muzzle: { joint: maulJoint, x: 0, y: 0, z: 1.3 },
      handL: { joint: foreLJoint, x: 0, y: -0.4, z: 0 },
      handR: { joint: foreRJoint, x: 0, y: -0.4, z: 0 },
    },
    blend: (primary, secondary) => (secondary === "attack" ? 0.08 : 0.15),
    animate: sum,
  }
}

function emitGroovedColumn(builder, coordY, coordZ, segmentCount, radiusAtHeight, capTop, paintColor) {
  const entries = [],
    entriesX = [],
    delta = (coordZ - coordY) / segmentCount
  for (let index = 0; index < segmentCount; index++) {
    const sum = coordY + index * delta,
      sumX = sum + delta
    ;(entries.push([sum, radiusAtHeight(sum) * (index % 2 ? 0.985 : 1)], [sumX - 0.05, radiusAtHeight(sumX - 0.05) * (index % 2 ? 0.985 : 1)]), index < segmentCount - 1 && entries.push([sumX - 0.05, radiusAtHeight(sumX) - 0.045], [sumX, radiusAtHeight(sumX) - 0.045]), entriesX.push(sum + delta / 2))
  }
  ;(builder.lathe(entries, { seg: 8, phase: 22.5, crease: 30, cap0: !1, cap1: capTop }), builder.paint(paintColor, { mat: MATERIAL_KINDS.rock, line: 0 }))
  for (let grooveIndex = 0; grooveIndex < segmentCount - 1; grooveIndex++) {
    const grooveHeight = coordY + (grooveIndex + 1) * delta
    builder.lathe(
      [
        [grooveHeight - 0.047, radiusAtHeight(grooveHeight) - 0.04],
        [grooveHeight - 0.003, radiusAtHeight(grooveHeight) - 0.04],
      ],
      { seg: 8, phase: 22.5, crease: 30, cap0: !1, cap1: !1 },
    )
  }
  return entriesX
}

/**
 * 创建防御塔与阵营与模型。
 *
 * @param teamId - 来源
 * @param paletteIndex - 次要输入
 * @returns 结果对象
 */
function buildTeamTowerModel(teamId, paletteIndex) {
  const element = TEAM_BASE_PALETTES[paletteIndex],
    entries = new NodeTree(),
    delta = entries.add("root", -1, 0, 0, 0),
    towerScale = teamId === 3 ? 1.15 : 1,
    sum = 4.1 + teamId * 0.4,
    computed = 2.5,
    sumX = sum + 1.35,
    lowerJoint = entries.add("lower", delta, 0, 0.35, 0),
    upperJoint = entries.add("upper", lowerJoint, 0, computed, 0),
    coreJoint = entries.add("core", delta, 0, sumX, 0),
    fromResult = Array.from({ length: teamId }, (primaryX, secondaryX) => entries.add(`ring${secondaryX}`, delta, 0, sumX - 0.15 + secondaryX * 0.2, 0)),
    tipJoint = entries.add("tip", delta, 0, sumX + 1.5, 0),
    alertJoint = entries.add("alert", tipJoint, 0, sumX + 1.9, 0),
    armorPlates = [0, 1, 2, 3].map((chunkIndex) => entries.add(`chunk${chunkIndex}`, chunkIndex < 2 ? lowerJoint : upperJoint, 0, chunkIndex < 2 ? 1.7 : 3.2, 0)),
    mappedResult = [0, 1, 2].map((crackIndex) => entries.add(`crack${crackIndex}`, crackIndex === 0 ? upperJoint : lowerJoint, 0, crackIndex === 0 ? 3.2 : 1.6, 0)),
    items = teamId === 3 ? entries.add("flag", upperJoint, 0, sum - 0.5, 0) : -1,
    builder = new ModelBuilder()
  builder.crease = 30
  const lerped = (clavL) => lerpValue(0.96, 0.62, (clavL - 0.35) / (sum - 0.35)) * towerScale
  ;(builder.bone(delta), buildBasePedestal(builder, element, 1.58))
  for (let index = 0; index < 4; index++) {
    const sumY = (index * Math.PI) / 2 + Math.PI / 4,
      angleValue = Math.cos(sumY) * 1.36,
      angleValueX = Math.sin(sumY) * 1.36
    ;(builder.paint(element.stoneDark, { c2: element.stone, ...SURFACE_MATERIAL_ALT }),
      builder.lathe(
        [
          [0.16, 0.13, 0.13, angleValue, angleValueX],
          [0.56, 0.09, 0.09, angleValue, angleValueX],
          [0.6, 0.13, 0.13, angleValue, angleValueX],
        ],
        { seg: 6 },
      ),
      builder.paint(element.crystal, { c2: element.crystalHot, glow: 0.5, glow2: 0.8, ...MATERIAL_PRESETS, line: 0 }),
      builder.g(composeMatrix(angleValue, 0.6, angleValueX), () => builder.crystal(0.085, 0.3 + (teamId - 1) * 0.08, 4, 0.6, 0.25)))
  }
  ;(builder.bone(lowerJoint).paint(element.stoneDark, { c2: element.stone, by: (primary, secondary) => (secondary - 0.35) / (computed - 0.35), ...SURFACE_MATERIAL_ALT }),
    builder.lathe(
      [
        [0.35, lerped(0.35) * 1.16],
        [0.5, lerped(0.5) * 1.16],
        [0.56, lerped(0.56) * 1.04],
      ],
      { seg: 8, phase: 22.5, crease: 30, cap0: !1, cap1: !1 },
    ))
  const scaleRgbChannelsResult = scaleRgbChannels(element.stoneDark, 0.62)
  ;(emitGroovedColumn(builder, 0.56, computed, 4, lerped, !0, scaleRgbChannelsResult),
    builder.bone(upperJoint).paint(element.stone, { c2: element.stoneLight, by: (primaryX, secondaryX) => (secondaryX - computed) / (sum - computed), ...SURFACE_MATERIAL_ALT }),
    emitGroovedColumn(builder, computed, sum - 0.3, 3 + (teamId > 1 ? 1 : 0), lerped, !1, scaleRgbChannelsResult),
    builder.paint(element.stone, { c2: element.stoneLight, by: (primaryY, secondaryY) => (secondaryY - computed) / (sum - computed), ...SURFACE_MATERIAL_ALT }),
    builder.lathe(
      [
        [sum - 0.3, lerped(sum - 0.3)],
        [sum - 0.1, lerped(sum) * 1.5],
        [sum + 0.12, lerped(sum) * 1.62],
        [sum + 0.2, lerped(sum) * 1.2],
      ],
      { seg: 8, phase: 22.5, cap0: !1 },
    ),
    builder.paint(element.trim, { ...METAL_MATERIAL_SPEC }),
    builder.lathe(
      [
        [sum - 0.12, lerped(sum) * 1.56],
        [sum + 0.14, lerped(sum) * 1.68],
        [sum + 0.16, lerped(sum) * 1.5],
      ],
      { seg: 8, phase: 22.5, cap0: !1, cap1: !1 },
    ),
    builder.lathe(
      [
        [computed - 0.07, lerped(computed) * 1.07],
        [computed + 0.07, lerped(computed) * 1.07],
      ],
      { seg: 8, phase: 22.5 },
    ))
  for (let bladeIndex = 0; bladeIndex < 4; bladeIndex++) {
    const bladeAngle = (bladeIndex * Math.PI) / 2
    for (const [bladeJoint, bladeStartHeight, endHeight] of [
      [lowerJoint, 1.25, 2.2],
      [upperJoint, computed + 0.3, sum - 0.55],
    ]) {
      builder.bone(bladeJoint).paint(element.crystal, { c2: element.crystalHot, glow: 0.35, glow2: 0.6, ...MATERIAL_PRESETS, line: 0 })
      const sumZ = (bladeStartHeight + endHeight) / 2,
        deltaX = (endHeight - bladeStartHeight) / 2
      builder.g(composeMatrix(Math.cos(bladeAngle) * (lerped(sumZ) * 0.925 + 0.015), sumZ, Math.sin(bladeAngle) * (lerped(sumZ) * 0.925 + 0.015), 0, 90 - (bladeAngle * 180) / Math.PI, 0), () =>
        builder.g(composeMatrix(0, 0, 0, -((0.34 * towerScale) / (sum - 0.35)) * (180 / Math.PI), 0, 0), () =>
          builder.extrude(
            [
              [-0.06, -deltaX],
              [0.06, -deltaX],
              [0.09, 0],
              [0.06, deltaX],
              [0, deltaX + 0.12],
              [-0.06, deltaX],
              [-0.09, 0],
            ],
            0.07,
            0,
          ),
        ),
      )
    }
  }
  ;(armorPlates.forEach((primaryY, secondaryY) => {
    const sum = (secondaryY * Math.PI) / 2 + Math.PI / 4,
      sumX = secondaryY < 2 ? 1.5 + secondaryY * 0.5 : computed + 0.55 + (secondaryY - 2) * 0.6
    ;(builder.bone(primaryY).paint(element.stone, { c2: element.stoneLight, ...SURFACE_MATERIAL_ALT }),
      builder.g(composeMatrix(Math.cos(sum) * lerped(sumX) * 0.99, sumX, Math.sin(sum) * lerped(sumX) * 0.99, 0, 90 - (sum * 180) / Math.PI, 0), () => {
        ;(builder.box(0, 0, 0, 0.5 * towerScale, 0.6, 0.16, 0.05), builder.paint(element.trim, { ...METAL_MATERIAL_SPEC }), builder.box(0, 0, 0.085, 0.1, 0.1, 0.03))
      }))
  }),
    mappedResult.forEach((primaryZ, secondaryZ) => {
      builder.bone(primaryZ).paint(element.crystalHot, { c2: element.crystal, glow: 0.8, ...MATERIAL_PRESETS, line: 0 })
      const crackStartHeight = secondaryZ === 0 ? computed + 0.2 : 0.7 + (secondaryZ - 1) * 0.5,
        itemsX = secondaryZ === 0 ? sum - 0.5 : computed - 0.1
      ;(buildStarCrackTube(builder, lerped, 0.5 + secondaryZ * 2.2, crackStartHeight, itemsX, 3 + secondaryZ), buildStarCrackTube(builder, lerped, 2.3 + secondaryZ * 2.2, crackStartHeight + 0.3, itemsX - 0.4, 9 + secondaryZ))
    }))
  const sumWidth = 1.9 + teamId * 0.2
  for (let spikeIndex = 0; spikeIndex < 4; spikeIndex++) {
    const sumHeight = (spikeIndex * Math.PI) / 2 + Math.PI / 4
    ;(builder.bone(upperJoint),
      builder.g(composeMatrix(0, sum + 0.1, 0, 0, -(sumHeight * 180) / Math.PI + 90, 0), () => {
        builder.paint(element.stone, { c2: element.stoneLight, ...SURFACE_MATERIAL_ALT })
        const scaledValueX = (element.spiky ? 1.22 : 1.1) * towerScale
        ;(builder.tube(
          [
            [0, 0, 0.7 * towerScale, 0.2, 0.16],
            [0, sumWidth * 0.3, scaledValueX, 0.19, 0.14],
            [0, sumWidth * 0.62, scaledValueX + 0.08, 0.15, 0.11],
            [0, sumWidth * 0.88, scaledValueX - 0.2, 0.09, 0.07],
            [0, sumWidth, scaledValueX - 0.52, 0.01, 0.01],
          ],
          { seg: 5, up: [1, 0, 0] },
        ),
          builder.paint(element.trim, { ...METAL_MATERIAL_SPEC }),
          builder.g(composeMatrix(0, sumWidth * 0.3, scaledValueX + 0.02, 12, 0, 0), () => builder.box(0, 0, 0, 0.44, 0.12, 0.34, 0.03)),
          element.spiky && (builder.paint(element.stoneDark, { c2: element.stone, ...SURFACE_MATERIAL_ALT }), builder.g(composeMatrix(0, sumWidth * 0.5, scaledValueX + 0.18, 70, 0, 0), () => builder.crystal(0.09, 0.5, 4, 0.8, 0.1))),
          builder.paint(element.crystal, { c2: element.crystalHot, glow: 0.35, ...MATERIAL_PRESETS }),
          builder.g(composeMatrix(0, sumWidth * 0.62, scaledValueX + 0.2, 60, 0, 0), () => builder.crystal(0.07, 0.24, 4, 0.6, 0.3)))
      }))
  }
  if (
    (teamId >= 2 &&
      (builder.bone(upperJoint),
      builder.sym(() => {
        ;(builder.paint(element.stone, { c2: element.stoneLight, ...SURFACE_MATERIAL_ALT }),
          builder.g(composeMatrix(lerped(3.2) * 0.9, 3.2, 0), () =>
            builder.extrude(
              [
                [0, -0.9],
                [0.46, -0.3],
                [0.78 + (teamId - 2) * 0.16, 1 + (teamId - 2) * 0.3],
                [0.34, 0.56],
                [0, 0.8],
              ],
              0.16,
              0.05,
            ),
          ),
          builder.paint(element.trim, { ...METAL_MATERIAL_SPEC }),
          builder.g(composeMatrix(lerped(3.2) * 0.9 + 0.3, 3.3, 0), () => builder.box(0, 0, 0, 0.08, 0.6, 0.2, 0.02)),
          builder.paint(element.crystal, { c2: element.crystalHot, glow: 0.35, glow2: 0.6, ...MATERIAL_PRESETS }),
          builder.g(composeMatrix(lerped(3.2) * 0.9 + 0.62 + (teamId - 2) * 0.14, 3.9 + (teamId - 2) * 0.3, 0, 0, 0, -22), () => builder.crystal(0.09, 0.5, 4, 0.7, 0.2)))
      })),
    teamId === 3)
  ) {
    for (let crestIndex = 0; crestIndex < 4; crestIndex++) {
      const scaledValueX = (crestIndex * Math.PI) / 2
      ;(builder.bone(upperJoint).paint(element.trim, { ...METAL_MATERIAL_SPEC }),
        builder.g(composeMatrix(Math.cos(scaledValueX) * lerped(sum) * 1.5, sum + 0.14, Math.sin(scaledValueX) * lerped(sum) * 1.5, 0, -(scaledValueX * 180) / Math.PI, 0), () => builder.g(composeMatrix(0, 0, 0, 0, 0, -24), () => builder.crystal(0.11, 1, 4, 0.8, 0.12))))
    }
    builder.bone(items).paint(792624, { team: 0.85, mat: MATERIAL_KINDS.cloth, pattern: TERRAIN_LOOK.weave, patternScale: 8, patternAmt: 0.35 })
    for (const sheetSideSign of [1, -1])
      builder.sheet(2, 3, (primaryWidth, secondaryWidth) => [(primaryWidth - 0.5) * 0.62 * (1 - secondaryWidth * 0.2), sum - 0.5 - secondaryWidth * 1.5 + (secondaryWidth > 0.9 ? Math.abs(primaryWidth - 0.5) * 0.3 : 0), sheetSideSign * (lerped(sum - 0.5 - secondaryWidth * 1.5) * 0.93 + 0.06 + 0.05 * Math.sin(secondaryWidth * 3))])
    builder.bone(upperJoint).paint(element.trim, { ...METAL_MATERIAL_SPEC })
    for (const boxSideSign of [1, -1]) builder.box(0, sum - 0.47, boxSideSign * (lerped(sum - 0.5) * 0.93 + 0.07), 0.72, 0.07, 0.07, 0.02)
  }
  builder.bone(coreJoint).paint(element.crystal, { c2: element.crystalMid, glow: 0.24 * element.glowK, glow2: 0.42 * element.glowK, ...MATERIAL_PRESETS, gloss: 0.8 })
  const sumDepth = 0.5 + teamId * 0.05
  ;(builder.g(composeMatrix(0, sumX - 0.85, 0), () => builder.crystal(sumDepth, 1.7, 6, 0.5, 0.5, 1)),
    builder.paint(element.crystalHot, { glow: 0.65 * element.glowK, mat: MATERIAL_KINDS.crystal, line: 0 }),
    builder.g(composeMatrix(0, sumX - 0.45, 0), () => builder.crystal(sumDepth * 0.45, 0.9, 4, 0.5, 0.5, 1)),
    fromResult.forEach((primaryHeight, secondaryHeight) => {
      const sumY = 1.05 + secondaryHeight * 0.28
      ;(builder.bone(primaryHeight).paint(element.trim, { ...METAL_MATERIAL_SPEC }),
        builder.g(composeMatrix(0, sumX - 0.15 + secondaryHeight * 0.2, 0), () => {
          ;(builder.torus(sumY, 0.09, 0.035, 20, 4, { crease: 30 }), builder.paint(element.crystal, { c2: element.crystalHot, glow: 0.5, mat: MATERIAL_KINDS.crystal, line: 0 }))
          for (let index = 0; index < 4; index++) {
            const sumZ = (index * Math.PI) / 2 + secondaryHeight * 0.6
            builder.g(composeMatrix(Math.cos(sumZ) * sumY, 0, Math.sin(sumZ) * sumY, 0, -(sumZ * 180) / Math.PI, 0), () => builder.box(0, 0, 0, 0.12, 0.09, 0.22))
          }
        }))
    }),
    builder.bone(tipJoint).paint(element.crystal, { c2: element.crystalHot, glow: 0.3, glow2: 0.6, ...MATERIAL_PRESETS }),
    builder.g(composeMatrix(0, sumX + 1.2, 0), () => builder.crystal(0.16, 1 + teamId * 0.25, 4, 0.75, 0.15)))
  const sumStart = 2 + teamId
  for (let crystalIndex = 0; crystalIndex < sumStart; crystalIndex++) {
    const scaledValueY = (crystalIndex / sumStart) * FULL_CIRCLE_RADIANS
    builder.g(composeMatrix(Math.cos(scaledValueY) * 0.58, sumX + 1.3 + (crystalIndex % 2) * 0.16, Math.sin(scaledValueY) * 0.58), () =>
      builder.g(composeMatrix(0, -0.14, 0, hashNoise(crystalIndex, 1) * 20 - 10, 0, hashNoise(crystalIndex, 2) * 20 - 10), () => builder.crystal(0.085, 0.3 + hashNoise(crystalIndex, 3) * 0.14, 4, 0.5, 0.4)),
    )
  }
  builder.bone(alertJoint).paint(BASE_GLOW_COLOR, { c2: 16777215, glow: 0.95, mat: MATERIAL_KINDS.crystal, line: 0 })
  for (let alertGemIndex = 0; alertGemIndex < 4; alertGemIndex++) {
    const scaledValueZ = (alertGemIndex / 4) * FULL_CIRCLE_RADIANS + 0.4
    builder.g(composeMatrix(Math.cos(scaledValueZ) * 0.44, sumX + 1.9, Math.sin(scaledValueZ) * 0.44, 0, -(scaledValueZ * 180) / Math.PI, 0), () => builder.g(composeMatrix(0, 0, 0, 0, 0, -90), () => builder.crystal(0.07, 0.36, 4, 0.8, 0.2)))
  }
  builder.bakeGrounding(8, 0.75, 0.9)
  const sumEnd = sumX + 2.2 + teamId * 0.25,
    sumNear = (coordX, animState, coordZ) => {
      const sum = animState.time + animState.seed * 10,
        delta = 1 - animState.hp
      ;(armorPlates.forEach((primaryDepth, secondaryDepth) => {
        const itemsY = secondaryDepth < 2 ? 0.25 : secondaryDepth === 2 ? 0.5 : 0.75,
          sumWidth = inverseLerpClamped(delta, itemsY - 0.01 + secondaryDepth * 0.03, itemsY + 0.05 + secondaryDepth * 0.03)
        sumWidth > 0 && (coordX.scale(primaryDepth, Math.max(0.001, 1 - sumWidth)), coordX.pos(primaryDepth, 0, -sumWidth * 1.2, 0))
      }),
        mappedResult.forEach((primaryStart, secondaryStart) => coordX.scale(primaryStart, Math.max(0.001, inverseLerpClamped(delta, 0.25 * (secondaryStart + 1) - 0.02, 0.25 * (secondaryStart + 1) + 0.04)))))
      const damageProgress = inverseLerpClamped(delta, 0.45, 0.85),
        computed = (animState.mode & 2) !== 0
      let computedX = 0,
        computedY = 1,
        computedZ = 0
      if (animState.anim === "attack") {
        const windupDuration = animState.windup
        ;((computedX = animState.p < windupDuration ? animState.p / windupDuration : Math.max(0, 1 - (animState.p - windupDuration) / 0.25)), (computedZ = smoothFalloff(animState.p, windupDuration + 0.04, 0.09)), (computedY = 1 + 3 * computedX), animState.p >= windupDuration ? (coordZ.glow = 1 + 1.6 * computedX) : (coordZ.glow = 1 + 1 * computedX * computedX))
      } else coordZ.glow = 1 + 0.12 * Math.sin(sum * 2)
      if (
        ((coordZ.glow *= 1 - damageProgress * (0.35 + 0.25 * Math.sin(sum * 17) * Math.sin(sum * 7.3))),
        coordX.pos(coreJoint, 0, Math.sin(sum * 1.3) * 0.12 - damageProgress * 0.25, 0),
        coordX.rot(coreJoint, 0, sum * 26 * computedY, damageProgress * 8 * Math.sin(sum * 3)),
        coordX.scale(coreJoint, 1 + 0.25 * computedX + 0.03 * Math.sin(sum * 2.6)),
        fromResult.forEach((primaryEnd, secondaryEnd) => {
          const itemsZ = secondaryEnd % 2 === 0 ? 1 : -1
          ;(coordX.rot(primaryEnd, 16 + secondaryEnd * 14 + damageProgress * 16 * Math.sin(sum * 2 + secondaryEnd), itemsZ * sum * (34 + secondaryEnd * 12) * computedY, 10 - secondaryEnd * 16 + damageProgress * 12 * Math.cos(sum * 1.7 + secondaryEnd) + delta * 14),
            coordX.pos(primaryEnd, 0, Math.sin(sum * 1.1 + secondaryEnd * 2) * 0.08 - damageProgress * 0.2 * secondaryEnd, 0),
            coordX.scale(primaryEnd, 1 + 0.08 * computedX + 0.28 * computedZ))
        }),
        coordX.pos(tipJoint, 0, Math.sin(sum * 1.3 + 1) * 0.14, 0),
        coordX.rot(tipJoint, 0, sum * (computed ? 160 : 50), 0),
        coordX.scale(alertJoint, computed ? 1 + 0.2 * Math.sin(sum * 12) : 0.001),
        coordX.rot(alertJoint, 0, computed ? sum * 220 : 0, 0),
        items >= 0 && coordX.rot(items, Math.sin(sum * 1.4) * 1.5, 0, Math.sin(sum * 1.1) * 2),
        animState.deathT >= 0)
      ) {
        const deathTime = animState.deathT,
          earlyDeathProgress = inverseLerpClamped(deathTime, 0, 0.35),
          deathSpreadProgress = inverseLerpClamped(deathTime, 0.2, 1.3),
          deathCollapseProgress = inverseLerpClamped(deathTime, 0.9, 2.2),
          items = animState.seed > 0.5 ? 1 : -1
        ;(coordX.scale(deathTime, Math.max(0.001, (1 + earlyDeathProgress * 0.5) * (1 - inverseLerpClamped(deathTime, 0.25, 0.45)))),
          fromResult.forEach((primaryNear, secondaryNear) => {
            const ringCollapseProgress = inverseLerpClamped(deathTime, 0.1, 0.9)
            ;(coordX.scale(primaryNear, Math.max(0.001, (1 + ringCollapseProgress * 0.8) * (1 - inverseLerpClamped(deathTime, 0.6, 1)))),
              coordX.pos(primaryNear, items * ringCollapseProgress * (0.5 + secondaryNear * 0.4), -ringCollapseProgress * ringCollapseProgress * 3.5, ringCollapseProgress * (secondaryNear - 0.5) * 0.8),
              coordX.rot(primaryNear, 16 + ringCollapseProgress * 120, 0, 10 + ringCollapseProgress * 80 * items))
          }),
          coordX.pos(earlyDeathProgress, items * deathSpreadProgress * 2, -deathSpreadProgress * deathSpreadProgress * (sumX + 1), 0),
          coordX.rot(earlyDeathProgress, 0, 0, -items * deathSpreadProgress * 140),
          coordX.scale(earlyDeathProgress, Math.max(0.001, 1 - inverseLerpClamped(deathTime, 1, 1.5))),
          mappedResult.forEach((crackJoint) => coordX.scale(crackJoint, 1)))
        const upperCollapse = deathSpreadProgress * deathSpreadProgress
        ;(coordX.rot(upperJoint, 0, 0, -items * upperCollapse * 84),
          coordX.pos(upperJoint, items * upperCollapse * 0.3, -upperCollapse * 0.9 - deathCollapseProgress * 1.2, 0),
          coordX.scale(upperJoint, Math.max(0.001, 1 - deathCollapseProgress)),
          coordX.pos(damageProgress, 0, -deathCollapseProgress * 1.4, 0),
          coordX.scale(damageProgress, 1 - deathCollapseProgress * 0.9),
          coordX.scale(delta, 1 - inverseLerpClamped(deathTime, 1.9, 2.4) * 0.999),
          coordX.rot(delta, 0, 0, Math.sin(deathTime * 50) * 0.6 * (1 - deathCollapseProgress)),
          (coordZ.glow = (1 + 3 * smoothFalloff(deathTime, 0.3, 0.2)) * (1 - inverseLerpClamped(deathTime, 0.4, 1))))
      }
    }
  return {
    key: `tower:${teamId}:${paletteIndex}`,
    geometry: builder.build(),
    rig: entries,
    height: sumEnd,
    radius: 1.7,
    scale: 1,
    stride: 1,
    triangles: builder.triangleCount,
    deathDur: 2.4,
    attach: { core: { joint: coreJoint, x: 0, y: 0, z: 0 }, muzzle: { joint: coreJoint, x: 0, y: 0, z: 0 }, chest: { joint: delta, x: 0, y: 2.6, z: 0 }, head: { joint: tipJoint, x: 0, y: 1, z: 0 } },
    blend: () => 0,
    animate: sumNear,
  }
}
export { buildMeleeMinionModel, buildSuperMinionModel, buildTeamTowerModel }
