/**
 * 网格工具A
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BUCKET_LOW, BUCKET_MID, BUCKET_MIN, colorToRgb, hashBucket, lerp3, scale3, smoothStepScalar } from '../fx/particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { FastRandom, fbmNoise2D } from '../render/foundation'
import { composeMatrixTRS } from './tf-system'
import { WATER_LEVEL } from './map-geometry'

const GRID_A_ROCK_DARK = colorToRgb(ARENA_PALETTE.env.rockDark),
  GRID_A_ROCK = colorToRgb(ARENA_PALETTE.env.rock),
  GRID_A_ROCK_LIGHT = colorToRgb(ARENA_PALETTE.env.rockLight),
  GRID_A_ROCK_WARM = colorToRgb(ARENA_PALETTE.env.rockWarm),
  GRID_A_MOSS = colorToRgb(ARENA_PALETTE.env.moss),
  GRID_A_DARK_FOLIAGE = colorToRgb(3104576),
  GRID_A_STONE = colorToRgb(5211208),
  GRID_A_STONE_DARK = colorToRgb(4937848),
  GRID_A_STONE_WARM = colorToRgb(7301700),
  GRID_A_FOG = colorToRgb(ARENA_PALETTE.env.fog),
  GRID_A_PLATEAU_HEIGHT = 2.7,
  GRID_A_PLATEAU_EDGE_HEIGHT = GRID_A_PLATEAU_HEIGHT + 0.2,
  GRID_A_LEDGE_HEIGHT = 0.55,
  GRID_A_LOWLAND_DEPTH = -1.95,
  GRID_A_SLOPE_LIMIT = 0.9,
  GRID_A_HALF = 0.5

function scatterBoundaryVegetation(geometryBuilder, propLibrary, bushMap, builder, effectsBuffer) {
  const arenaBound = bushMap.map.bound,
    scatterRandom = new FastRandom(31415),
    scatterExtent = arenaBound + 26,
    scatterStep = 2.8,
    placedPositions = []
  for (let total = -scatterExtent; total <= scatterExtent; total += scatterStep)
    for (let gridX = -scatterExtent; gridX <= scatterExtent; gridX += scatterStep) {
      const scatterX = gridX + scatterRandom.range(-0.5, 0.5) * scatterStep,
        scatterZ = total + scatterRandom.range(-0.5, 0.5) * scatterStep,
        distanceBeyondBound = Math.max(Math.abs(scatterX), Math.abs(scatterZ)) - arenaBound
      if (distanceBeyondBound < 1.4) continue
      const edgeDistResult = builder.edgeDist(scatterX, scatterZ)
      if (distanceBeyondBound > edgeDistResult - 1.6) continue
      const southWeightResult = builder.southWeight(scatterX, scatterZ)
      if (bushMap.riverDist(scatterX, scatterZ) < 1.6 || (southWeightResult > 0.5 && distanceBeyondBound < 3.6) || (bushMap.baseDist(scatterX, scatterZ, 12) < 4.2 && distanceBeyondBound < 3.4)) continue
      const heightAtResult = builder.heightAt(scatterX, scatterZ),
        speciesRoll = scatterRandom.next(),
        vegetationDensity = 0.5 + fbmNoise2D(scatterX * 0.05, scatterZ * 0.05, 2, 12) * 0.5
      if (speciesRoll < (0.62 * vegetationDensity + 0.16) * (distanceBeyondBound < 9 ? 1.3 : 1)) {
        let isActive = !0
        for (let index = placedPositions.length - 1; index >= Math.max(0, placedPositions.length - 60); index--) {
          const selectedC = placedPositions[index]
          Math.hypot(selectedC[0] - scatterX, selectedC[1] - scatterZ) < 1.7 && (isActive = !1)
        }
        if (!isActive) continue
        placedPositions.push([scatterX, scatterZ, 1])
        const vegetationRank = scatterX < -arenaBound && distanceBeyondBound < 7 ? BUCKET_MIN : distanceBeyondBound > 9 && hashBucket(scatterX, scatterZ, 0.6, 0.4) !== BUCKET_LOW ? BUCKET_MID : BUCKET_LOW,
          chanceResult = scatterRandom.chance(0.42 + (scatterZ < 0 ? 0.2 : 0)),
          fbmNoise2DResult = fbmNoise2D(scatterX * 0.04 + 9, scatterZ * 0.04, 2, 88),
          tintBase = scatterRandom.range(0.85, 1.08) * (southWeightResult > 0.5 ? 0.72 : 1),
          distanceTintBoost = smoothStepScalar(4, 34, distanceBeyondBound) * 0.5,
          vegetationTint = [tintBase * (0.95 + fbmNoise2DResult * 0.25) * (1 + distanceTintBoost * 0.5), tintBase * (1 + distanceTintBoost * 0.62), tintBase * (1 - fbmNoise2DResult * 0.25) * (1 + distanceTintBoost * 1.1)]
        if (chanceResult) {
          const pineScale = scatterRandom.range(0.85, 1.35) * (southWeightResult > 0.5 ? 0.8 : 1)
          geometryBuilder.add(scatterRandom.pick(propLibrary.pines), composeMatrixTRS(scatterX, heightAtResult - 0.1, scatterZ, scatterRandom.range(0, 6.28), pineScale, pineScale * scatterRandom.range(0.9, 1.2)), { tint: vegetationTint, rank: vegetationRank })
        } else {
          const treeScale = scatterRandom.range(1, 1.55) * (southWeightResult > 0.5 ? 0.8 : 1)
          geometryBuilder.add(scatterRandom.pick(distanceBeyondBound < 3.2 ? propLibrary.trees : propLibrary.farTrees), composeMatrixTRS(scatterX, heightAtResult - 0.1, scatterZ, scatterRandom.range(0, 6.28), treeScale, treeScale * scatterRandom.range(0.95, 1.15)), { tint: vegetationTint, rank: vegetationRank })
        }
      } else if (speciesRoll < 0.74) {
        const boulderScale = scatterRandom.range(0.7, 1.9)
        geometryBuilder.add(scatterRandom.pick(propLibrary.boulders), composeMatrixTRS(scatterX, heightAtResult - 0.1, scatterZ, scatterRandom.range(0, 6.28), boulderScale, boulderScale * scatterRandom.range(0.8, 1.5)), { tint: scale3([1, 1, 1], scatterRandom.range(0.9, 1.1)), rank: BUCKET_LOW })
      } else if (speciesRoll < 0.8) geometryBuilder.add(scatterRandom.pick(propLibrary.shrubs), composeMatrixTRS(scatterX, heightAtResult - 0.05, scatterZ, scatterRandom.range(0, 6.28), scatterRandom.range(1, 1.7)), { rank: BUCKET_LOW })
      else if (speciesRoll < 0.815 && distanceBeyondBound > 4 && southWeightResult < 0.5) {
        const crystalTint = lerp3(colorToRgb(ARENA_PALETTE.env.crystal), colorToRgb(9411839), scatterRandom.next()),
          crystalScale = scatterRandom.range(1.5, 2.6)
        ;(geometryBuilder.add(scatterRandom.pick(propLibrary.bigCrystals), composeMatrixTRS(scatterX, heightAtResult - 0.2, scatterZ, scatterRandom.range(0, 6.28), crystalScale, crystalScale, scatterRandom.range(-0.15, 0.15), scatterRandom.range(-0.15, 0.15)), { tint: crystalTint, glow: 0.9, rank: BUCKET_LOW }),
          effectsBuffer.glows.push({ x: scatterX, z: scatterZ, y: heightAtResult + 0.1, r: 5.5, color: crystalTint }))
      } else
        speciesRoll < 0.83 &&
          southWeightResult < 0.5 &&
          geometryBuilder.add(scatterRandom.pick(propLibrary.tallPillars), composeMatrixTRS(scatterX, heightAtResult - 0.1, scatterZ, scatterRandom.range(0, 6.28), scatterRandom.range(1.2, 1.7), scatterRandom.range(1.2, 1.9), scatterRandom.range(-0.08, 0.08), scatterRandom.range(-0.08, 0.08)), {
            tint: [0.95, 0.95, 0.92],
            glow: 0.9,
            rank: BUCKET_LOW,
          })
    }
  const fastRandom = new FastRandom(16180)
  for (let creeperX = -arenaBound + 0.6; creeperX < arenaBound - 0.6; creeperX += fastRandom.range(0.4, 1.3)) {
    const creeperZ = arenaBound + 0.34
    if (bushMap.riverDist(creeperX, creeperZ) < 1.2 || bushMap.baseDist(creeperX, arenaBound - 0.6) < 0.3) continue
    const creeperRoll = fastRandom.next()
    creeperRoll < 0.7
      ? geometryBuilder.add(fastRandom.pick(propLibrary.drapes), composeMatrixTRS(creeperX, 0.4, creeperZ + 0.14, -Math.PI / 2 + fastRandom.range(-0.3, 0.3), fastRandom.range(1, 1.5)), { shadow: !1, tint: scale3([0.86, 0.92, 0.8], fastRandom.range(0.62, 0.9)), rank: hashBucket(creeperX, creeperZ, 0.5, 0.25) })
      : creeperRoll < 0.85
        ? geometryBuilder.add(fastRandom.pick(propLibrary.ferns), composeMatrixTRS(creeperX, 0.4, creeperZ - 0.04, fastRandom.range(0, 6.28), fastRandom.range(0.7, 1)), { shadow: !1, rank: hashBucket(creeperX, creeperZ) })
        : creeperRoll < 0.93 && geometryBuilder.add(fastRandom.pick(propLibrary.vines), composeMatrixTRS(creeperX, 0.36, creeperZ + 0.3, -Math.PI / 2, fastRandom.range(0.9, 1.2), fastRandom.range(0.8, 1.5)), { shadow: !1 })
  }
  const rockRandom = new FastRandom(4409)
  for (let rockX = -arenaBound + 0.8; rockX < arenaBound - 0.8; rockX += rockRandom.range(0.7, 2.1)) {
    const rockZ = arenaBound + 0.78 + rockRandom.range(0, 0.25)
    if (bushMap.riverDist(rockX, rockZ) < 1.4) continue
    const rockScale = rockRandom.range(0.22, 0.48)
    geometryBuilder.add(rockRandom.pick(propLibrary.rocks), composeMatrixTRS(rockX, builder.heightAt(rockX, rockZ) + 0.02, rockZ, rockRandom.range(0, 6.28), rockScale, rockScale * rockRandom.range(0.7, 1.1)), { shadow: !1, tint: scale3([0.8, 0.8, 0.86], rockRandom.range(0.6, 0.85)), rank: hashBucket(rockX, rockZ, 0.55, 0.25) })
  }
  ;[
    [-arenaBound + 1.05, -arenaBound - 1.15, GRID_A_PLATEAU_HEIGHT - 0.45, 0.95],
    [-arenaBound + 4.75, -arenaBound - 1.2, GRID_A_PLATEAU_HEIGHT - 0.45, 0.8],
    [-arenaBound - 1.15, -arenaBound + 1.35, GRID_A_PLATEAU_HEIGHT - 0.45, 0.85],
    [-arenaBound - 1.2, -arenaBound + 4.65, GRID_A_PLATEAU_HEIGHT - 0.45, 0.9],
    [-arenaBound + 1, -arenaBound + 0.3, WATER_LEVEL - 0.1, 0.42],
    [-arenaBound + 4.9, -arenaBound + 0.35, WATER_LEVEL - 0.12, 0.5],
    [-arenaBound + 0.3, -arenaBound + 1.2, WATER_LEVEL - 0.1, 0.4],
    [-arenaBound + 0.35, -arenaBound + 4.9, WATER_LEVEL - 0.12, 0.46],
  ].forEach(([boulderX, boulderZ, boulderY, boulderSize], boulderIndex) => {
    geometryBuilder.add(propLibrary.boulders[boulderIndex % propLibrary.boulders.length], composeMatrixTRS(boulderX, boulderY, boulderZ, boulderIndex * 1.7, boulderSize, boulderSize * 0.85), { tint: [0.74, 0.8, 0.88], rank: BUCKET_LOW })
  })
  const flowerRandom = new FastRandom(27182),
    flowerGridStep = 1.7,
    flowerColors = [colorToRgb(16777215), colorToRgb(16769146), colorToRgb(16752324), colorToRgb(10473727)]
  for (let flowerGridZ = -scatterExtent; flowerGridZ <= scatterExtent; flowerGridZ += flowerGridStep)
    for (let flowerGridX = -scatterExtent; flowerGridX <= scatterExtent; flowerGridX += flowerGridStep) {
      const flowerX = flowerGridX + flowerRandom.range(-0.5, 0.5) * flowerGridStep,
        flowerZ = flowerGridZ + flowerRandom.range(-0.5, 0.5) * flowerGridStep,
        flowerDistanceBeyondBound = Math.max(Math.abs(flowerX), Math.abs(flowerZ)) - arenaBound
      if (flowerDistanceBeyondBound < 1.2 || flowerDistanceBeyondBound > builder.edgeDist(flowerX, flowerZ) - 1.2 || bushMap.riverDist(flowerX, flowerZ) < 1.2 || !flowerRandom.chance(0.7)) continue
      const flowerGroundY = builder.heightAt(flowerX, flowerZ) - 0.04
      flowerRandom.chance(0.06)
        ? geometryBuilder.add(flowerRandom.pick(propLibrary.flowers), composeMatrixTRS(flowerX, flowerGroundY, flowerZ, flowerRandom.range(0, 6.28), flowerRandom.range(1.6, 2.4)), { tint: flowerRandom.pick(flowerColors), shadow: !1, maskedTint: !0, rank: hashBucket(flowerX, flowerZ, 0.5, 0.25) })
        : flowerRandom.chance(0.55) && geometryBuilder.add(flowerRandom.pick(propLibrary.tufts), composeMatrixTRS(flowerX, flowerGroundY, flowerZ, flowerRandom.range(0, 6.28), flowerRandom.range(1.5, 2.6)), { shadow: !1, tint: [0.8, 0.95, 0.75], rank: hashBucket(flowerX, flowerZ, 0.4, 0.3) })
    }
}

export { GRID_A_STONE_DARK, GRID_A_HALF, GRID_A_STONE, GRID_A_LEDGE_HEIGHT, scatterBoundaryVegetation, GRID_A_ROCK, GRID_A_ROCK_LIGHT, GRID_A_DARK_FOLIAGE, GRID_A_PLATEAU_EDGE_HEIGHT, GRID_A_SLOPE_LIMIT, GRID_A_STONE_WARM, GRID_A_ROCK_DARK, GRID_A_ROCK_WARM, GRID_A_FOG, GRID_A_MOSS, GRID_A_LOWLAND_DEPTH, GRID_A_PLATEAU_HEIGHT }
