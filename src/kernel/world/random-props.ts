/**
 * 随机场景道具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { ARENA_PALETTE } from '../arena-palette'
import { colorToRgb, lerp3, scale3 } from '../fx/particle-system'
import { FastRandom } from '../render/foundation'
import { MeshBuilder } from '../render/buff-view'
import { FULL_TURN_RADIANS, buildTubeAlongPath } from '../fx/fx-random'
import { buildLobedBlobMesh } from './scenery-props'

function finalizeMeshBuilder(meshBuilder) {
  return meshBuilder.build()
}

const RANDOM_PROP_ENV = ARENA_PALETTE.env,
  RANDOM_PROP_TRUNK_BASE = colorToRgb(4863280),
  RANDOM_PROP_TRUNK = colorToRgb(RANDOM_PROP_ENV.trunk)

function buildRandomProp(propSeed, canopyColors?: { dark?: number; mid?: number; light?: number }) {
  const random = new FastRandom(propSeed),
    meshBuilder = new MeshBuilder(),
    trunkHeight = random.range(1.75, 2.15),
    trunkTipX = random.range(-0.22, 0.22),
    trunkTipZ = random.range(-0.18, 0.18)
  buildTubeAlongPath(
    meshBuilder,
    [
      [0, -0.2, 0, 0.3],
      [trunkTipX * 0.3, trunkHeight * 0.4, trunkTipZ * 0.3, 0.2],
      [trunkTipX * 0.8, trunkHeight * 0.85, trunkTipZ * 0.8, 0.14],
      [trunkTipX, trunkHeight + 0.95, trunkTipZ, 0.06],
    ],
    { sides: 5, c0: RANDOM_PROP_TRUNK_BASE, c1: RANDOM_PROP_TRUNK, sway0: 0, sway1: 0.15 },
  )
  const darkCanopyColor = colorToRgb(canopyColors?.dark ?? RANDOM_PROP_ENV.canopyDark),
    midCanopyColor = colorToRgb(canopyColors?.mid ?? RANDOM_PROP_ENV.canopy),
    lightCanopyColor = colorToRgb(canopyColors?.light ?? RANDOM_PROP_ENV.canopyLight),
    puffCenter = [trunkTipX, trunkHeight + 0.35, trunkTipZ],
    lobeAngleBase = random.range(0, FULL_TURN_RADIANS)
  for (let index = 0; index < 3; index++) {
    const lobeAngle = lobeAngleBase + (index / 3) * FULL_TURN_RADIANS + random.range(-0.3, 0.3),
      lobeRadius = random.range(0.56, 0.7),
      lobeBlobRadius = random.range(0.86, 1),
      lobeCenterX = trunkTipX + Math.cos(lobeAngle) * lobeRadius,
      lobeCenterZ = trunkTipZ + Math.sin(lobeAngle) * lobeRadius,
      lobeCenterY = trunkHeight + random.range(-0.05, 0.14)
    ;(index < 2 &&
      buildTubeAlongPath(
        meshBuilder,
        [
          [trunkTipX * 0.7, trunkHeight * 0.72, trunkTipZ * 0.7, 0.08],
          [lobeCenterX * 0.75 + trunkTipX * 0.25, lobeCenterY - 0.12, lobeCenterZ * 0.75 + trunkTipZ * 0.25, 0.04],
        ],
        { sides: 3, c0: RANDOM_PROP_TRUNK_BASE, c1: RANDOM_PROP_TRUNK, sway1: 0.2 },
      ),
      buildLobedBlobMesh(meshBuilder, lobeCenterX, lobeCenterY, lobeCenterZ, lobeBlobRadius, { lobes: 8, dark: scale3(darkCanopyColor, 0.9), mid: lerp3(darkCanopyColor, midCanopyColor, 0.55), light: lerp3(darkCanopyColor, midCanopyColor, 0.95), seed: propSeed + index * 13, sway0: 0.3, sway1: 0.55, puffCenter: puffCenter, puff: 0.35, thick: 0.5 }))
  }
  const canopyBlobCount = 2 + random.int(2)
  for (let blobIndex = 0; blobIndex < canopyBlobCount; blobIndex++) {
    const blobAngle = lobeAngleBase + Math.PI / 3 + (blobIndex / canopyBlobCount) * FULL_TURN_RADIANS + random.range(-0.35, 0.35),
      blobOrbitRadius = random.range(0.32, 0.46),
      canopyBlobRadius = random.range(0.72, 0.86)
    buildLobedBlobMesh(meshBuilder, trunkTipX + Math.cos(blobAngle) * blobOrbitRadius, trunkHeight + random.range(0.5, 0.64), trunkTipZ + Math.sin(blobAngle) * blobOrbitRadius, canopyBlobRadius, {
      lobes: 8,
      dark: darkCanopyColor,
      mid: midCanopyColor,
      light: lerp3(midCanopyColor, lightCanopyColor, 0.28),
      seed: propSeed + 50 + blobIndex * 17,
      sway0: 0.4,
      sway1: 0.7,
      puffCenter: puffCenter,
      puff: 0.35,
      thick: 0.52,
    })
  }
  return (
    buildLobedBlobMesh(meshBuilder, trunkTipX + random.range(-0.12, 0.12), trunkHeight + random.range(1.02, 1.14), trunkTipZ + random.range(-0.12, 0.12), random.range(0.6, 0.7), {
      lobes: 7,
      dark: lerp3(darkCanopyColor, midCanopyColor, 0.7),
      mid: lerp3(midCanopyColor, lightCanopyColor, 0.3),
      light: lerp3(midCanopyColor, lightCanopyColor, 0.62),
      seed: propSeed + 99,
      sway0: 0.55,
      sway1: 0.85,
      puffCenter: puffCenter,
      puff: 0.3,
      thick: 0.6,
    }),
    finalizeMeshBuilder(meshBuilder)
  )
}

export { RANDOM_PROP_TRUNK, RANDOM_PROP_TRUNK_BASE, finalizeMeshBuilder, buildRandomProp, RANDOM_PROP_ENV }
