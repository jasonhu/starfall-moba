/**
 * 特效批量绘制
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { FastRandom, fbmNoise2D } from '../render/foundation'
import { PROJECTION_SCALE } from '../render/scene-rigs'
import { isPointInPolygon } from '../world/geometry-2d'
import { signedDistanceToPolygon } from '../world/map-geometry'
import { composeMatrixTRS, TF_PETAL_COLORS, sampleMonsterCampTint, vectorToAngle, TF_AMBER } from '../world/tf-system'
import { BUCKET_LOW, colorToRgb, hashBucket, scale3 } from './particle-system'

const VEGETATION_HEIGHT_DIVISOR = 3.6,
  VEGETATION_CASTER_RADIUS_FACTOR = 1.6,
  VEGETATION_CASTER_HEIGHT_FACTOR = 2.5

function boostRgbSaturation(rgbColor, saturationBoost) {
  const peakChannel = Math.max(rgbColor[0], rgbColor[1], rgbColor[2]),
    saturationFloor = Math.min(rgbColor[0], rgbColor[1], rgbColor[2]) * saturationBoost,
    saturationGain = peakChannel > saturationFloor + 1e-4 ? peakChannel / (peakChannel - saturationFloor) : 1
  return [(rgbColor[0] - saturationFloor) * saturationGain, (rgbColor[1] - saturationFloor) * saturationGain, (rgbColor[2] - saturationFloor) * saturationGain]
}

function sampleCanopyTint(positionX, positionZ, tintRandom) {
  const tintGradient = (positionX - positionZ) / 110,
    fbmNoise2DResult = fbmNoise2D(positionX * 0.06, positionZ * 0.06, 2, 77),
    tintVariation = Math.max(0, tintGradient) * 0.22 + (fbmNoise2DResult - 0.5) * 0.3,
    baseBrightness = tintRandom.range(0.78, 0.94)
  return [baseBrightness * (1 + tintVariation * 0.5), baseBrightness * (1 + tintVariation * 0.08), baseBrightness * (1 - tintVariation * 0.35)]
}

const VEGETATION_PROJECTION_SCALE = PROJECTION_SCALE,
  VEGETATION_MIN_PLACEMENT_RADIUS = 0.55,
  VEGETATION_GROUND_OFFSET = 0.7

function computeCanopyHeightLimit(bushMap, positionX, positionZ, terrainHeight) {
  const mapBound = bushMap.map.bound
  let heightLimit = 14
  for (const heightOffset of [-1.1, 0, 1.1])
    for (let total = 0.5; total < heightLimit; total += 0.5) {
      const sampleX = positionX + heightOffset,
        sampleZ = positionZ - total
      if (Math.abs(sampleX) > mapBound || Math.abs(sampleZ) > mapBound) break
      if (bushMap.solidDist(sampleX, sampleZ, 2) > 0.05) {
        heightLimit = total
        break
      }
    }
  const projectionHeightCap = ((heightLimit + VEGETATION_GROUND_OFFSET) / VEGETATION_PROJECTION_SCALE - terrainHeight) / VEGETATION_HEIGHT_DIVISOR,
    casterHeightCap = (heightLimit + VEGETATION_GROUND_OFFSET - terrainHeight * VEGETATION_PROJECTION_SCALE) / (VEGETATION_CASTER_RADIUS_FACTOR * 0.8 + VEGETATION_CASTER_HEIGHT_FACTOR * VEGETATION_PROJECTION_SCALE)
  return Math.min(projectionHeightCap, casterHeightCap)
}

function scatterPlateauVegetation(vegetationBatch, vegetationLibrary, terrainMap, plateauPatches, sceneDecorations, placementClaims) {
  plateauPatches.forEach((plateauPatch, patchIndex) => {
    const patchRandom = new FastRandom(5e3 + patchIndex * 31),
      patchPolygon = plateauPatch.poly
    let minX = 1 / 0,
      maxX = -1 / 0,
      minY = 1 / 0,
      maxY = -1 / 0
    for (const polyVertex of patchPolygon) ((minX = Math.min(minX, polyVertex.x)), (maxX = Math.max(maxX, polyVertex.x)), (minY = Math.min(minY, polyVertex.y)), (maxY = Math.max(maxY, polyVertex.y)))
    const xConfig = { x: 0, y: 0 },
      isRidge = plateauPatch.kind === "ridge",
      isWidePatch = plateauPatch.inradius > 3.1,
      nearBase = terrainMap.baseDist((minX + maxX) / 2, (minY + maxY) / 2, 20) < 10,
      gridSpacing = isWidePatch ? 2.3 : 1.8,
      placedTrees = [],
      distance = (pointX, chest) => plateauPatch.niches.some((position) => Math.hypot(position.x - pointX, position.z - chest) < 1.6)
    for (let gridZ = minY; gridZ <= maxY; gridZ += gridSpacing)
      for (let gridX = minX; gridX <= maxX; gridX += gridSpacing) {
        if (((xConfig.x = gridX + patchRandom.range(-0.5, 0.5) * gridSpacing), (xConfig.y = gridZ + patchRandom.range(-0.5, 0.5) * gridSpacing), !isPointInPolygon(xConfig, patchPolygon))) continue
        const insetDistance = -signedDistanceToPolygon(xConfig, patchPolygon)
        if (insetDistance < (isRidge ? 1.2 : 1.35)) continue
        const coordX = xConfig.x,
          coordY = xConfig.y
        if (distance(coordX, coordY)) continue
        const surfaceY = plateauPatch.topY(insetDistance) - 0.04,
          placementRoll = patchRandom.next(),
          baseCanopyScale = Math.min(isRidge ? 0.72 : nearBase ? 0.9 : 1.08, (isWidePatch ? patchRandom.range(0.82, 1.08) : patchRandom.range(0.62, 0.8)) * Math.min(1.1, 0.7 + insetDistance * 0.12)),
          canopyHeightLimit = insetDistance >= (isWidePatch ? 1.9 : 1.55) ? computeCanopyHeightLimit(terrainMap, coordX, coordY, surfaceY) : 0
        if (canopyHeightLimit >= VEGETATION_MIN_PLACEMENT_RADIUS && placementRoll < (isRidge ? 0.22 : isWidePatch ? (nearBase ? 0.5 : 0.64) : 0.45)) {
          let isActive = !0
          for (const placedTree of placedTrees) Math.hypot(placedTree[0] - coordX, placedTree[1] - coordY) < (placedTree[2] + 1) * 1.15 && (isActive = !1)
          if (isActive) {
            const canopyScale = Math.min(baseCanopyScale, canopyHeightLimit),
              heightScale = canopyScale * patchRandom.range(0.95, 1.1),
              treeChoiceRoll = patchRandom.next(),
              isNearRiver = terrainMap.riverDist(coordX, coordY) < 6
            ;(treeChoiceRoll < 0.09
              ? vegetationBatch.add(vegetationLibrary.accentTrees[treeChoiceRoll < 0.05 ? 0 : 1], composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), canopyScale, heightScale), { tint: scale3([1, 1, 1], patchRandom.range(0.92, 1.04)) })
              : isNearRiver && treeChoiceRoll < 0.6
                ? vegetationBatch.add(patchRandom.pick(vegetationLibrary.willows), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), canopyScale, heightScale), { tint: sampleCanopyTint(coordX, coordY, patchRandom) })
                : isWidePatch && insetDistance > 3 && treeChoiceRoll > 0.9 && canopyHeightLimit > 1
                  ? vegetationBatch.add(patchRandom.pick(vegetationLibrary.pines), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), canopyScale * 0.85, heightScale * 0.85), { tint: sampleCanopyTint(coordX, coordY, patchRandom) })
                  : vegetationBatch.add(patchRandom.pick(vegetationLibrary.trees), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), canopyScale, heightScale), { tint: sampleCanopyTint(coordX, coordY, patchRandom) }),
              placedTrees.push([coordX, coordY, canopyScale]),
              sceneDecorations.aoBlobs.push({ x: coordX, y: surfaceY + 0.06, z: coordY, r: 2 * canopyScale, strength: 0.38 }),
              sceneDecorations.casters.push({ x: coordX, z: coordY, height: surfaceY + VEGETATION_CASTER_HEIGHT_FACTOR * canopyScale, radius: VEGETATION_CASTER_RADIUS_FACTOR * canopyScale * 1.05, strength: 0.72 }))
            continue
          }
        }
        if (placementRoll < 0.86) {
          const vegetationRoll = patchRandom.next()
          if (vegetationRoll < 0.3) {
            const shrubScale = patchRandom.range(0.75, 1.2)
            ;(vegetationBatch.add(patchRandom.pick(vegetationLibrary.shrubs), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), shrubScale), { tint: sampleCanopyTint(coordX, coordY, patchRandom), rank: BUCKET_LOW }), sceneDecorations.aoBlobs.push({ x: coordX, y: surfaceY + 0.06, z: coordY, r: 0.95 * shrubScale, strength: 0.3 }))
          } else if (vegetationRoll < (isRidge ? 0.62 : 0.46)) {
            const boulderScale = patchRandom.range(0.45, 0.85) * (isRidge ? 1.15 : 1)
            ;(vegetationBatch.add(patchRandom.pick(vegetationLibrary.boulders), composeMatrixTRS(coordX, surfaceY + 0.05, coordY, patchRandom.range(0, 6.28), boulderScale, boulderScale * patchRandom.range(0.8, 1.2)), { tint: scale3([1, 1, 1], patchRandom.range(0.9, 1.1)), rank: BUCKET_LOW }),
              sceneDecorations.aoBlobs.push({ x: coordX, y: surfaceY + 0.06, z: coordY, r: 1.3 * boulderScale, strength: 0.34 }))
          } else if (vegetationRoll < 0.6 && insetDistance > 0.95 && !isRidge)
            if (placementClaims.claim(coordX, coordY)) {
              const sampleMonsterCampTintResult = sampleMonsterCampTint(terrainMap, coordX, coordY, patchRandom),
                crystalScale = patchRandom.range(0.75, 1.2),
                isBigCrystal = isWidePatch && insetDistance > 2.2 && patchRandom.chance(0.3)
              ;(vegetationBatch.add(patchRandom.pick(isBigCrystal ? vegetationLibrary.bigCrystals : vegetationLibrary.crystals), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), crystalScale), { tint: sampleMonsterCampTintResult, glow: patchRandom.range(0.75, 1), rank: BUCKET_LOW }),
                sceneDecorations.glows.push({ x: coordX, z: coordY, y: surfaceY + 0.05, r: isBigCrystal ? 3.2 : 2, color: sampleMonsterCampTintResult }),
                sceneDecorations.aoBlobs.push({ x: coordX, y: surfaceY + 0.06, z: coordY, r: isBigCrystal ? 1.5 : 0.9, strength: 0.25 }))
            } else vegetationBatch.add(patchRandom.pick(vegetationLibrary.ferns), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), patchRandom.range(1.1, 1.6)), { shadow: !1, rank: hashBucket(coordX, coordY) })
          else if (vegetationRoll < 0.68)
            if (placementClaims.claim(coordX, coordY)) {
              const lanternScale = patchRandom.range(0.9, 1.3)
              ;(vegetationBatch.add(patchRandom.pick(vegetationLibrary.lanterns), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), lanternScale), { rank: BUCKET_LOW }), sceneDecorations.glows.push({ x: coordX, z: coordY, y: surfaceY + 0.05, r: 1.6, color: TF_AMBER }))
            } else vegetationBatch.add(patchRandom.pick(vegetationLibrary.ferns), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), patchRandom.range(1, 1.5)), { shadow: !1, rank: hashBucket(coordX, coordY) })
          else if (vegetationRoll < 0.75 && insetDistance < 1.9 && !isRidge) {
            const chanceResult = patchRandom.chance(0.4)
            ;(vegetationBatch.add(patchRandom.pick(chanceResult ? vegetationLibrary.tallPillars : vegetationLibrary.pillars), composeMatrixTRS(coordX, surfaceY - 0.05, coordY, patchRandom.range(0, 6.28), patchRandom.range(0.9, 1.1), 1, patchRandom.range(-0.05, 0.05), patchRandom.range(-0.05, 0.05)), {
              tint: scale3([1, 0.99, 0.95], patchRandom.range(0.85, 1)),
              glow: 0.5,
            }),
              sceneDecorations.aoBlobs.push({ x: coordX, y: surfaceY + 0.06, z: coordY, r: 0.85, strength: 0.34 }))
          } else
            vegetationRoll < 0.8
              ? vegetationBatch.add(patchRandom.pick(vegetationLibrary.flowers), composeMatrixTRS(coordX, surfaceY + 0.02, coordY, patchRandom.range(0, 6.28), patchRandom.range(1.5, 2.2)), { tint: patchRandom.pick(TF_PETAL_COLORS), shadow: !1, maskedTint: !0, rank: hashBucket(coordX, coordY, 0.55, 0.25) })
              : vegetationRoll < 0.92
                ? vegetationBatch.add(patchRandom.pick(vegetationLibrary.ferns), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), patchRandom.range(1, 1.6)), { shadow: !1, rank: hashBucket(coordX, coordY) })
                : vegetationBatch.add(patchRandom.pick(vegetationLibrary.tufts), composeMatrixTRS(coordX, surfaceY, coordY, patchRandom.range(0, 6.28), patchRandom.range(1.3, 2)), { shadow: !1, rank: hashBucket(coordX, coordY) })
        }
      }
    if (!isRidge)
      for (let tuftGridZ = minY; tuftGridZ <= maxY; tuftGridZ += 0.95)
        for (let tuftGridX = minX; tuftGridX <= maxX; tuftGridX += 0.95) {
          if (((xConfig.x = tuftGridX + patchRandom.range(-0.45, 0.45)), (xConfig.y = tuftGridZ + patchRandom.range(-0.45, 0.45)), !isPointInPolygon(xConfig, patchPolygon))) continue
          const tuftInsetDistance = -signedDistanceToPolygon(xConfig, patchPolygon)
          tuftInsetDistance < 1.35 || !patchRandom.chance(0.3) || vegetationBatch.add(patchRandom.pick(vegetationLibrary.tufts), composeMatrixTRS(xConfig.x, plateauPatch.topY(tuftInsetDistance) - 0.03, xConfig.y, patchRandom.range(0, 6.28), patchRandom.range(1.2, 1.9)), { shadow: !1, tint: [0.95, 1, 0.9], rank: hashBucket(xConfig.x, xConfig.y) })
        }
    for (const rimPoint of plateauPatch.rim) {
      const ozValue = rimPoint.oz,
        vectorToAngleResult = vectorToAngle(rimPoint.ox, rimPoint.oz),
        rimInsetX = rimPoint.x - rimPoint.ox * rimPoint.inset,
        rimInsetZ = rimPoint.z - rimPoint.oz * rimPoint.inset
      if (!rimPoint.bare && ozValue > -0.75 && !isRidge) {
        const drapeCount = patchRandom.chance(0.75) ? 2 : 1
        for (let index = 0; index < drapeCount; index++) {
          const rimJitter = patchRandom.range(-0.45, 0.45)
          vegetationBatch.add(patchRandom.pick(vegetationLibrary.drapes), composeMatrixTRS(rimInsetX - rimPoint.oz * rimJitter + rimPoint.ox * 0.04, rimPoint.y - 0.05, rimInsetZ + rimPoint.ox * rimJitter + rimPoint.oz * 0.04, vectorToAngleResult + patchRandom.range(-0.25, 0.25), patchRandom.range(0.9, 1.35)), {
            shadow: !1,
            tint: scale3([1, 1, 0.94], patchRandom.range(0.88, 1.06)),
            rank: hashBucket(rimInsetX + index * 0.37, rimInsetZ - index * 0.21, 0.5, 0.25),
          })
        }
      }
      const vineChance = ozValue > 0.3 || rimPoint.ox < -0.3 ? 0.2 : ozValue > -0.5 ? 0.06 : 0
      if (!isRidge && patchRandom.chance(vineChance)) {
        const vineInset = Math.max(0.02, rimPoint.inset - 0.26)
        vegetationBatch.add(patchRandom.pick(vegetationLibrary.vines), composeMatrixTRS(rimPoint.x - rimPoint.ox * vineInset, rimPoint.y - 0.12, rimPoint.z - rimPoint.oz * vineInset, vectorToAngleResult, patchRandom.range(0.9, 1.25), patchRandom.range(0.7, Math.max(0.8, Math.min(1.7, rimPoint.y - 0.9)))), {
          shadow: !1,
          tint: scale3([1, 1, 1], patchRandom.range(0.85, 1.08)),
          rank: hashBucket(rimPoint.x, rimPoint.z, 0.5, 0.3),
        })
      }
      if (ozValue > -0.2 && patchRandom.chance(0.07)) {
        const claimResult = placementClaims.claim(rimPoint.x, rimPoint.z, 10),
          bracketTint = claimResult ? boostRgbSaturation(sampleMonsterCampTint(terrainMap, rimPoint.x, rimPoint.z, patchRandom), 0.7) : colorToRgb(14262384)
        ;(vegetationBatch.add(patchRandom.pick(vegetationLibrary.brackets), composeMatrixTRS(rimPoint.x - rimPoint.ox * 0.06, patchRandom.range(0.25, 0.42), rimPoint.z - rimPoint.oz * 0.06, vectorToAngleResult, patchRandom.range(0.9, 1.4)), {
          shadow: !1,
          tint: bracketTint,
          maskedTint: !0,
          glow: claimResult ? 0.45 : 0,
          rank: claimResult ? BUCKET_LOW : hashBucket(rimPoint.x, rimPoint.z),
        }),
          claimResult && sceneDecorations.glows.push({ x: rimPoint.x + rimPoint.ox * 0.4, z: rimPoint.z + rimPoint.oz * 0.4, y: 0.03, r: 1, color: bracketTint }))
      }
      if (patchRandom.chance(0.4)) {
        const rockScale = patchRandom.range(0.28, 0.5),
          rockJitter = patchRandom.range(-0.4, 0.4),
          rockX = rimPoint.x - rimPoint.ox * 0.22 - rimPoint.oz * rockJitter,
          rockZ = rimPoint.z - rimPoint.oz * 0.22 + rimPoint.ox * rockJitter
        terrainMap.riverDist(rockX, rockZ) > 0.2 && vegetationBatch.add(patchRandom.pick(vegetationLibrary.rocks), composeMatrixTRS(rockX, -0.04, rockZ, patchRandom.range(0, 6.28), rockScale, rockScale * patchRandom.range(0.7, 1.05)), { tint: scale3([1, 1, 1], patchRandom.range(0.82, 1.05)), rank: hashBucket(rockX, rockZ, 0.5, 0.25) })
      }
    }
  })
}

export { scatterPlateauVegetation }
