/**
 * tF 世界系统
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { ARENA_PALETTE } from '../arena-palette'
import { BUCKET_LOW, colorToRgb, hashBucket, lerp3, scale3 } from '../fx/particle-system'
import { FastRandom, fbmNoise2D } from '../render/foundation'
import { isPointInPolygon } from './geometry-2d'
import { WATER_LEVEL } from './map-geometry'

const TF_SCRATCH_MATRIX = new Matrix4(),
  TF_SCRATCH_QUATERNION = new Quaternion(),
  TF_SCRATCH_EULER = new Euler(),
  TF_SCRATCH_SCALE = new Vector3(),
  TF_SCRATCH_POSITION = new Vector3()

function composeMatrixTRS(lookupKey, positionY, positionZ, rotationY, horizontalScale, verticalScale = horizontalScale, rotationX = 0, rotationZ = 0) {
  return (TF_SCRATCH_EULER.set(rotationX, rotationY, rotationZ, "YXZ"), TF_SCRATCH_QUATERNION.setFromEuler(TF_SCRATCH_EULER), TF_SCRATCH_POSITION.set(lookupKey, positionY, positionZ), TF_SCRATCH_SCALE.set(horizontalScale, verticalScale, horizontalScale), TF_SCRATCH_MATRIX.compose(TF_SCRATCH_POSITION, TF_SCRATCH_QUATERNION, TF_SCRATCH_SCALE))
}

const vectorToAngle = (offsetX, offsetZ) => Math.atan2(-offsetZ, offsetX),
  TF_ENV_PALETTE = ARENA_PALETTE.env,
  TF_AMBER = colorToRgb(TF_ENV_PALETTE.amber),
  TF_GLOW_CYAN = colorToRgb(TF_ENV_PALETTE.glowCyan),
  TF_VIOLET = colorToRgb(TF_ENV_PALETTE.violet),
  TF_FROST = colorToRgb(TF_ENV_PALETTE.frost),
  TF_EMBER_STONE = colorToRgb(16747082),
  TF_STAR_GOLD = colorToRgb(TF_ENV_PALETTE.starGold),
  TF_TEAM_BLUE_GLOW = colorToRgb(ARENA_PALETTE.blue.glow),
  TF_TEAM_RED_GLOW = colorToRgb(ARENA_PALETTE.red.glow)

/**
 * 处理怪物。
 *
 * @param bushMap - 输入
 * @param pointX - 次要输入
 * @param pointZ - 第三输入
 * @param tintRandom - 第四输入
 */
function sampleMonsterCampTint(bushMap, pointX, pointZ, tintRandom) {
  const campMap = bushMap.map
  for (const camp of campMap.camps) {
    const distance = Math.hypot(pointX - camp.pos.x, pointZ - camp.pos.y)
    if (!(distance > 13)) {
      if (camp.monsterType === "frost_golem") return lerp3(TF_FROST, [0.85, 0.95, 1], tintRandom.range(0, 0.4))
      if (camp.monsterType === "ember_golem") return lerp3(TF_EMBER_STONE, TF_STAR_GOLD, tintRandom.range(0, 0.4))
      if (camp.monsterType === "abyss_drake" && distance < 11) return lerp3(TF_VIOLET, [0.6, 0.5, 1], tintRandom.range(0, 0.4))
      if (camp.monsterType === "star_colossus" && distance < 11) return lerp3(TF_STAR_GOLD, [1, 0.95, 0.8], tintRandom.range(0, 0.4))
    }
  }
  return bushMap.baseDist(pointX, pointZ, 14) < 9
    ? pointX - pointZ < 0
      ? lerp3(TF_GLOW_CYAN, TF_TEAM_BLUE_GLOW, tintRandom.range(0.4, 0.8))
      : lerp3(TF_AMBER, TF_TEAM_RED_GLOW, tintRandom.range(0.3, 0.7))
    : tintRandom.chance(0.62)
      ? lerp3(TF_GLOW_CYAN, [0.8, 1, 0.95], tintRandom.range(0, 0.35))
      : lerp3(TF_VIOLET, TF_GLOW_CYAN, tintRandom.range(0, 0.3))
}

const TF_PETAL_COLORS = [colorToRgb(TF_ENV_PALETTE.petalWhite), colorToRgb(16770720), colorToRgb(TF_ENV_PALETTE.petalPink), colorToRgb(13623551), colorToRgb(14731519), colorToRgb(16764832)]

/**
 * 创建战场。
 *
 * @param decorGroup - 来源
 * @param decorPrefabs - 次要输入
 * @param builder - 构建器
 * @param scatterDensity - 第四输入
 * @param effects - 附加输入
 * @param placementClaims - 附加输入
 */
function buildWorldDecor(decorGroup, decorPrefabs, builder, scatterDensity, effects, placementClaims) {
  const worldMap = builder.map,
    mapBound = worldMap.bound,
    scatterRandom = new FastRandom(777),
    gridStep = 1.05
  for (let total = -mapBound; total <= mapBound; total += gridStep)
    for (let gridX = -mapBound; gridX <= mapBound; gridX += gridStep) {
      const worldX = gridX + scatterRandom.range(-0.5, 0.5) * gridStep,
        worldZ = total + scatterRandom.range(-0.5, 0.5) * gridStep,
        scatterRoll = scatterRandom.next(),
        fbmNoise2DResult = fbmNoise2D(worldX * 0.11, worldZ * 0.11, 3, 19)
      if (!builder.clutterOk(worldX, worldZ, 0.9) || builder.bushDist(worldX, worldZ) < 0.3 || builder.campDist(worldX, worldZ) < -0.6) continue
      const scatterChance = (builder.solidDist(worldX, worldZ, 4) < 1.6 ? 0.55 : 0.16 + Math.max(0, fbmNoise2DResult - 0.45) * 1.5) * scatterDensity
      if (scatterRoll > scatterChance) continue
      const groundY = builder.heightAt(worldX, worldZ) - 0.02,
        flowerRoll = scatterRandom.next(),
        fbmNoise2DFbmNoise2DResult = fbmNoise2D(worldX * 0.07 + 31, worldZ * 0.07, 2, 23)
      if (flowerRoll < 0.05 + Math.max(0, fbmNoise2DFbmNoise2DResult - 0.52) * 0.7)
        decorGroup.add(scatterRandom.pick(decorPrefabs.flowers), composeMatrixTRS(worldX, groundY, worldZ, scatterRandom.range(0, 6.28), scatterRandom.range(1.3, 1.9)), {
          tint: TF_PETAL_COLORS[Math.floor(fbmNoise2DFbmNoise2DResult * 5.99 + scatterRandom.range(0, 0.8)) % TF_PETAL_COLORS.length],
          shadow: !1,
          maskedTint: !0,
          rank: hashBucket(worldX, worldZ, 0.55, 0.25),
        })
      else {
        const tuftTintBrightness = 0.88 + fbmNoise2DResult * 0.24
        decorGroup.add(scatterRandom.pick(decorPrefabs.tufts), composeMatrixTRS(worldX, groundY, worldZ, scatterRandom.range(0, 6.28), scatterRandom.range(0.9, 1.6)), { shadow: !1, tint: [tuftTintBrightness * 0.97, tuftTintBrightness, tuftTintBrightness * 0.9], rank: hashBucket(worldX, worldZ) })
      }
    }
  builder.walls.forEach((wall, wallIndex) => {
    const wallRandom = new FastRandom(8800 + wallIndex * 13),
      wallPolygon = wall.poly
    for (let index = 0; index < wallPolygon.length; index++) {
      const selectedM = wallPolygon[index],
        nextVertex = wallPolygon[(index + 1) % wallPolygon.length],
        distance = Math.hypot(nextVertex.x - selectedM.x, nextVertex.y - selectedM.y),
        normalX = (nextVertex.y - selectedM.y) / distance,
        normalY = -(nextVertex.x - selectedM.x) / distance,
        xConfig = { x: (selectedM.x + nextVertex.x) / 2 + normalX * 0.2, y: (selectedM.y + nextVertex.y) / 2 + normalY * 0.2 },
        outwardNormalSign = isPointInPolygon(xConfig, wallPolygon) ? -1 : 1
      for (let total = wallRandom.range(0.3, 1.2); total < distance; total += wallRandom.range(0.7, 1.9)) {
        const offsetDistance = wallRandom.range(0.05, 0.42),
          decorX = selectedM.x + ((nextVertex.x - selectedM.x) * total) / distance + normalX * outwardNormalSign * offsetDistance,
          decorZ = selectedM.y + ((nextVertex.y - selectedM.y) * total) / distance + normalY * outwardNormalSign * offsetDistance
        if (builder.solidDist(decorX, decorZ) < 0.02 || builder.laneDist(decorX, decorZ) < 0.6 || builder.riverDist(decorX, decorZ) < 0.3 || builder.baseDist(decorX, decorZ) < 0.3 || builder.padDist(decorX, decorZ) < 0.3) continue
        const heightAtResult = builder.heightAt(decorX, decorZ),
          decorTypeRoll = wallRandom.next()
        if (decorTypeRoll < 0.34) {
          const rockScale = wallRandom.range(0.16, 0.34) * (offsetDistance < 0.2 ? 1.25 : 1)
          decorGroup.add(wallRandom.pick(decorPrefabs.rocks), composeMatrixTRS(decorX, heightAtResult, decorZ, wallRandom.range(0, 6.28), rockScale, rockScale * wallRandom.range(0.7, 1.1)), { shadow: !1, tint: scale3([1, 1, 1], wallRandom.range(0.85, 1.08)), rank: hashBucket(decorX, decorZ, 0.5, 0.25) })
        } else if (decorTypeRoll < 0.56) decorGroup.add(wallRandom.pick(decorPrefabs.ferns), composeMatrixTRS(decorX, heightAtResult - 0.02, decorZ, wallRandom.range(0, 6.28), wallRandom.range(0.8, 1.25)), { shadow: !1, tint: scale3([1, 1, 1], wallRandom.range(0.85, 1.05)), rank: hashBucket(decorX, decorZ) })
        else if (decorTypeRoll < 0.66) {
          const isGlowingMushroom = wallRandom.chance(0.4) && placementClaims.claim(decorX, decorZ),
            mushroomTint = isGlowingMushroom ? lerp3(sampleMonsterCampTint(builder, decorX, decorZ, wallRandom), [1, 1, 1], 0.2) : wallRandom.pick([colorToRgb(14182458), colorToRgb(14725232), colorToRgb(13208170)])
          ;(decorGroup.add(wallRandom.pick(decorPrefabs.mushrooms), composeMatrixTRS(decorX, heightAtResult, decorZ, wallRandom.range(0, 6.28), wallRandom.range(1, 1.5)), { shadow: !1, tint: mushroomTint, maskedTint: !0, glow: isGlowingMushroom ? 1 : 0, rank: isGlowingMushroom ? BUCKET_LOW : hashBucket(decorX, decorZ, 0.4, 0.3) }),
            isGlowingMushroom && effects.glows.push({ x: decorX, z: decorZ, y: heightAtResult + 0.03, r: 1.1, color: mushroomTint }))
        } else
          decorTypeRoll < 0.7 && offsetDistance > 0.15
            ? placementClaims.claim(decorX, decorZ) && (decorGroup.add(wallRandom.pick(decorPrefabs.lanterns), composeMatrixTRS(decorX, heightAtResult, decorZ, wallRandom.range(0, 6.28), wallRandom.range(0.5, 0.68)), { shadow: !1 }), effects.glows.push({ x: decorX, z: decorZ, y: heightAtResult + 0.03, r: 1.3, color: TF_AMBER }))
            : decorTypeRoll < 0.86 && decorGroup.add(wallRandom.pick(decorPrefabs.tufts), composeMatrixTRS(decorX, heightAtResult - 0.02, decorZ, wallRandom.range(0, 6.28), wallRandom.range(1.3, 2)), { shadow: !1, rank: hashBucket(decorX, decorZ) })
      }
    }
  })
  const riverLine = builder.riverLine,
    selectedF = riverLine[0],
    riverEndPoint = riverLine[riverLine.length - 1],
    distance = Math.hypot(riverEndPoint.x - selectedF.x, riverEndPoint.y - selectedF.y),
    riverDirX = (riverEndPoint.x - selectedF.x) / distance,
    riverDirZ = (riverEndPoint.y - selectedF.y) / distance,
    fastRandom = new FastRandom(1212),
    riverHalfWidth = worldMap.riverWidth / 2
  for (let riverDistance = 0; riverDistance < distance; riverDistance += 2.6) {
    const lateralOffset = (fastRandom.chance(0.5) ? 1 : -1) * fastRandom.range(riverHalfWidth - 3.2, riverHalfWidth - 1.2),
      riverX = selectedF.x + riverDirX * riverDistance - riverDirZ * lateralOffset,
      riverZ = selectedF.y + riverDirZ * riverDistance + riverDirX * lateralOffset
    if (builder.boundDist(riverX, riverZ) < 0.8 || builder.laneDist(riverX, riverZ) < 1.6 || builder.campDist(riverX, riverZ) < 0.8) continue
    const riverDecorRoll = fastRandom.next()
    if (riverDecorRoll < 0.42) {
      const lilyPadCount = 3 + fastRandom.int(3)
      let position = 0
      for (let index = 0; index < lilyPadCount; index++) {
        const lilyPadAngle = fastRandom.range(0, 6.28),
          lilyPadSpread = index === 0 ? 0 : fastRandom.range(0.55, 1.25),
          lilyX = riverX + Math.cos(lilyPadAngle) * lilyPadSpread,
          lilyZ = riverZ + Math.sin(lilyPadAngle) * lilyPadSpread
        if (builder.heightAt(lilyX, lilyZ) > WATER_LEVEL - 0.08) continue
        const lilyPadScale = index === 0 ? fastRandom.range(0.55, 0.7) : fastRandom.range(0.35, 0.55)
        ;((position = Math.max(position, lilyPadScale)),
          decorGroup.add(fastRandom.pick(decorPrefabs.lilyPads), composeMatrixTRS(lilyX, WATER_LEVEL + 0.012, lilyZ, fastRandom.range(0, 6.28), lilyPadScale, 1), { shadow: !1, tint: scale3([1, 1, 1], fastRandom.range(0.85, 1.08)) }),
          index === 1 && decorGroup.add(decorPrefabs.lotusBud, composeMatrixTRS(lilyX, WATER_LEVEL, lilyZ, fastRandom.range(0, 6.28), fastRandom.range(0.9, 1.2)), { shadow: !1, tint: colorToRgb(TF_ENV_PALETTE.petalPink), maskedTint: !0 }))
      }
      position > 0 && fastRandom.chance(0.6) && effects.ripples.push({ x: riverX, z: riverZ, r: 1.3 })
    } else if (riverDecorRoll < 0.5) {
      if (placementClaims.claim(riverX, riverZ, 10)) {
        const crystalTint = lerp3(TF_GLOW_CYAN, [1, 1, 1], fastRandom.range(0.1, 0.4)),
          crystalScale = fastRandom.range(0.2, 0.4)
        ;(decorGroup.add(fastRandom.pick(decorPrefabs.crystals), composeMatrixTRS(riverX, builder.heightAt(riverX, riverZ) - 0.02, riverZ, fastRandom.range(0, 6.28), crystalScale, crystalScale, fastRandom.range(-0.3, 0.3), fastRandom.range(-0.3, 0.3)), { shadow: !1, tint: crystalTint, glow: 1 }),
          effects.glows.push({ x: riverX, z: riverZ, y: WATER_LEVEL + 0.02, r: 1.5, color: crystalTint }),
          effects.ripples.push({ x: riverX, z: riverZ, r: 0.8 }))
      }
    } else if (riverDecorRoll < 0.66) {
      const rockClusterCount = 1 + fastRandom.int(3)
      for (let rockIndex = 0; rockIndex < rockClusterCount; rockIndex++) {
        const riverRockScale = fastRandom.range(0.25, 0.5) * (rockIndex === 0 ? 1.2 : 0.8),
          riverRockX = riverX + fastRandom.range(-0.6, 0.6) * rockIndex,
          riverRockZ = riverZ + fastRandom.range(-0.6, 0.6) * rockIndex
        decorGroup.add(fastRandom.pick(decorPrefabs.rocks), composeMatrixTRS(riverRockX, builder.heightAt(riverRockX, riverRockZ) + 0.04, riverRockZ, fastRandom.range(0, 6.28), riverRockScale, riverRockScale * 0.8), { shadow: !1, tint: [0.8, 0.86, 0.92] })
      }
      fastRandom.chance(0.5) && effects.ripples.push({ x: riverX, z: riverZ, r: 0.9 })
    }
  }
  const riverbankRandom = new FastRandom(2323)
  for (let bankOffset = 0; bankOffset < distance; bankOffset += 4.5) {
    const riverbankOffset = (riverbankRandom.chance(0.5) ? 1 : -1) * (riverHalfWidth + riverbankRandom.range(0.7, 1.3)),
      bellX = selectedF.x + riverDirX * bankOffset - riverDirZ * riverbankOffset,
      bellZ = selectedF.y + riverDirZ * bankOffset + riverDirX * riverbankOffset,
      bellScale = riverbankRandom.range(0.5, 0.62),
      bellRotation = riverbankRandom.range(0, 6.28)
    if (builder.boundDist(bellX, bellZ) < 1 || builder.laneDist(bellX, bellZ) < 1.5 || builder.solidDist(bellX, bellZ) < 0.4 || builder.bushDist(bellX, bellZ) < 0.4 || builder.campDist(bellX, bellZ) < 0.5 || !placementClaims.claim(bellX, bellZ, 9)) continue
    const lerp3Lerp3Result = lerp3(TF_GLOW_CYAN, [1, 1, 1], 0.25)
    ;(decorGroup.add(riverbankRandom.pick(decorPrefabs.bells), composeMatrixTRS(bellX, builder.heightAt(bellX, bellZ) - 0.02, bellZ, bellRotation, bellScale), { shadow: !1, tint: lerp3Lerp3Result, maskedTint: !0, glow: 1 }), effects.glows.push({ x: bellX, z: bellZ, y: 0.03, r: 1.1, color: lerp3Lerp3Result }))
  }
  builder.walls.forEach((reedsWall, reedsWallIndex) => {
    const reedsRandom = new FastRandom(6100 + reedsWallIndex * 7),
      reedPolygon = reedsWall.poly
    for (let reedIndex = 0; reedIndex < reedPolygon.length; reedIndex++) {
      const currentVertex = reedPolygon[reedIndex],
        nextReedVertex = reedPolygon[(reedIndex + 1) % reedPolygon.length],
        wallEdgeLength = Math.hypot(nextReedVertex.x - currentVertex.x, nextReedVertex.y - currentVertex.y),
        reedNormalX = (nextReedVertex.y - currentVertex.y) / wallEdgeLength,
        reedNormalY = -(nextReedVertex.x - currentVertex.x) / wallEdgeLength,
        reedProbePoint = { x: (currentVertex.x + nextReedVertex.x) / 2 + reedNormalX * 0.2, y: (currentVertex.y + nextReedVertex.y) / 2 + reedNormalY * 0.2 },
        reedsOutwardSign = isPointInPolygon(reedProbePoint, reedPolygon) ? 1 : -1
      for (let rangeIndex = reedsRandom.range(0.2, 0.9); rangeIndex < wallEdgeLength; rangeIndex += reedsRandom.range(0.8, 1.5)) {
        const reedX = currentVertex.x + ((nextReedVertex.x - currentVertex.x) * rangeIndex) / wallEdgeLength + reedNormalX * reedsOutwardSign * 0.14,
          reedZ = currentVertex.y + ((nextReedVertex.y - currentVertex.y) * rangeIndex) / wallEdgeLength + reedNormalY * reedsOutwardSign * 0.14
        builder.riverDist(reedX, reedZ) > 1 ||
          builder.laneDist(reedX, reedZ) < 1.2 ||
          (reedsRandom.chance(0.8) &&
            decorGroup.add(reedsRandom.pick(decorPrefabs.reeds), composeMatrixTRS(reedX, Math.min(0, builder.heightAt(reedX, reedZ)) - 0.05, reedZ, reedsRandom.range(0, 6.28), reedsRandom.range(0.85, 1.3)), {
              shadow: !1,
              tint: scale3([1, 1, 1], reedsRandom.range(0.85, 1.05)),
              rank: hashBucket(reedX, reedZ, 0.55, 0.25),
            }))
      }
    }
  })
}

export { composeMatrixTRS, TF_PETAL_COLORS, buildWorldDecor, sampleMonsterCampTint, vectorToAngle, TF_AMBER }
