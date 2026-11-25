/**
 * 特效几何
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Matrix4 } from 'three'
import { ARENA_PALETTE } from '../arena-palette'
import { colorToRgb, scale3 } from './particle-system'
import { pointSegmentDistance } from '../world/geometry-2d'
import { FastRandom } from '../render/foundation'
import { composeMatrixTRS, vectorToAngle } from '../world/tf-system'

const EFFECT_FULL_TURN_RADIANS = Math.PI * 2,
  EFFECT_ENV_PALETTE = ARENA_PALETTE.env,
  EFFECT_CRYSTAL_TINT_COLOR = colorToRgb(11775136),
  EFFECT_STONE_DARK_COLOR = colorToRgb(8223356),
  EFFECT_CRYSTAL_TIP_COLOR = colorToRgb(13023644),
  EFFECT_AMBER_LIGHT_COLOR = colorToRgb(EFFECT_ENV_PALETTE.amber),
  EFFECT_BLOB_BASE_COLOR = colorToRgb(14264650),
  EFFECT_SCRATCH_MATRIX = new Matrix4()

type LanePolyline = Array<{ x: number; y: number }>

function projectToNearestLane(bushMap: { map: { lanes: Record<string, LanePolyline> } }, position) {
  let nearestDistance = 1 / 0
  const xConfig = { x: position.x, y: position.y }
  for (const lane of Object.values(bushMap.map.lanes))
    for (let index = 1; index < lane.length; index++) {
      const selectedI = lane[index - 1],
        segmentEndPoint = lane[index],
        pointSegmentDistanceResult = pointSegmentDistance(position, selectedI, segmentEndPoint)
      if (pointSegmentDistanceResult < nearestDistance) {
        nearestDistance = pointSegmentDistanceResult
        const segmentLengthSquared = (segmentEndPoint.x - selectedI.x) ** 2 + (segmentEndPoint.y - selectedI.y) ** 2 || 1,
          laneProjectionRatio = Math.min(1, Math.max(0, ((position.x - selectedI.x) * (segmentEndPoint.x - selectedI.x) + (position.y - selectedI.y) * (segmentEndPoint.y - selectedI.y)) / segmentLengthSquared))
        ;((xConfig.x = selectedI.x + (segmentEndPoint.x - selectedI.x) * laneProjectionRatio), (xConfig.y = selectedI.y + (segmentEndPoint.y - selectedI.y) * laneProjectionRatio))
      }
    }
  return xConfig
}

function scatterNicheDecor(decorGeometryBuilder, shrineScenery, builder, cliffWalls, effectsBuffer, spatialClaimGrid, moteSources) {
  const terrainMap = builder.map,
    decorRandom = new FastRandom(9091)
  cliffWalls.forEach((cliffWall) => {
    for (const nich of cliffWall.niches) {
      const vectorToAngleResult = vectorToAngle(nich.ox, nich.oz),
        nicheOutwardX = nich.x + nich.ox * 1.4,
        nicheOutwardZ = nich.z + nich.oz * 1.4,
        nicheNearCamp = builder.campDist(nicheOutwardX, nicheOutwardZ) < 6,
        nicheDecorRoll = decorRandom.next(),
        scale3Result = scale3([1, 1, 1], decorRandom.range(0.9, 1.04))
      ;(nicheNearCamp && nicheDecorRoll < 0.55) || nicheDecorRoll < 0.12
        ? (decorGeometryBuilder.add(shrineScenery.watcher, composeMatrixTRS(nich.x - nich.ox * 0.08, nich.y - 0.04, nich.z - nich.oz * 0.08, vectorToAngleResult + decorRandom.range(-0.12, 0.12), 0.92), { tint: scale3Result }),
          effectsBuffer.aoBlobs.push({ x: nich.x, y: nich.y + 0.03, z: nich.z, r: 0.75, strength: 0.42 }))
        : nicheDecorRoll < 0.36
          ? (decorGeometryBuilder.add(decorRandom.pick(shrineScenery.steles), composeMatrixTRS(nich.x - nich.ox * 0.12, nich.y, nich.z - nich.oz * 0.12, vectorToAngleResult + decorRandom.range(-0.2, 0.2), 0.95, 0.95, 0, decorRandom.range(-0.1, 0.02)), { tint: scale3Result, glow: 1 }),
            effectsBuffer.aoBlobs.push({ x: nich.x, y: nich.y + 0.03, z: nich.z, r: 0.8, strength: 0.4 }))
          : (decorGeometryBuilder.add(shrineScenery.starLamp, composeMatrixTRS(nich.x + nich.ox * 0.08, nich.y - 0.02, nich.z + nich.oz * 0.08, vectorToAngleResult + Math.PI / 8, 1.08), { tint: scale3Result, glow: 1 }),
            effectsBuffer.aoBlobs.push({ x: nich.x, y: nich.y + 0.03, z: nich.z, r: 0.6, strength: 0.38 }),
            spatialClaimGrid.reserve(nich.x, nich.z),
            effectsBuffer.glows.push({ x: nicheOutwardX - nich.ox * 0.3, z: nicheOutwardZ - nich.oz * 0.3, y: 0.03, r: 1.8, color: EFFECT_AMBER_LIGHT_COLOR }),
            moteSources.push({ x: nich.x, y: nich.y + 1.2, z: nich.z, radius: 0.5, color: EFFECT_AMBER_LIGHT_COLOR, count: 2, mode: 0, range: 0.6, size: 0.6 }))
    }
  })
  const teamTintColors = [colorToRgb(3108832), colorToRgb(14169388)]
  for (const tower of terrainMap.towers) {
    const total = projectToNearestLane(builder, tower.pos)
    let flagDirectionX = tower.pos.x - total.x,
      flagDirectionY = tower.pos.y - total.y
    const distance = Math.hypot(flagDirectionX, flagDirectionY)
    distance < 0.3 ? ((flagDirectionX = 0.7), (flagDirectionY = 0.7)) : ((flagDirectionX /= distance), (flagDirectionY /= distance))
    const flagOffsetX = flagDirectionX * 0.8,
      flagDirectionZ = flagDirectionY * 0.8 - 0.6,
      flagOffsetLength = Math.hypot(flagOffsetX, flagDirectionZ) || 1
    decorGeometryBuilder.add(shrineScenery.flag, composeMatrixTRS(tower.pos.x + (flagOffsetX / flagOffsetLength) * 1.4, 0, tower.pos.y + (flagDirectionZ / flagOffsetLength) * 1.4, decorRandom.range(-0.3, 0.3), 1), { tint: teamTintColors[tower.team], maskedTint: !0 })
  }
  const mooringPostPositions = [],
    mapBound = terrainMap.bound
  for (let gridZ = -mapBound + 1; gridZ < mapBound - 1; gridZ += 0.35)
    for (let gridX = -mapBound + 1; gridX < mapBound - 1; gridX += 0.35) {
      const laneDistResult = builder.laneDist(gridX, gridZ)
      if (laneDistResult < 0.3 || laneDistResult > 0.65) continue
      const riverDistResult = builder.riverDist(gridX, gridZ)
      riverDistResult < 0.55 || riverDistResult > 0.9 || builder.solidDist(gridX, gridZ) < 0.5 || mooringPostPositions.some((placedPost) => Math.hypot(placedPost.x - gridX, placedPost.y - gridZ) < 2.2) || mooringPostPositions.push({ x: gridX, y: gridZ })
    }
  for (const item of mooringPostPositions) decorGeometryBuilder.add(decorRandom.pick(shrineScenery.mooringPosts), composeMatrixTRS(item.x, 0, item.y, decorRandom.range(0, EFFECT_FULL_TURN_RADIANS), decorRandom.range(0.95, 1.1), 1, decorRandom.range(-0.06, 0.06), decorRandom.range(-0.06, 0.06)), { tint: scale3([1, 1, 1], decorRandom.range(0.88, 1.02)) })
  // terrainMap 来自隐式 any 的 builder.map；Object.values(any) 被推断为 unknown[]，
  // 此处 lanes 的值是折线点数组，补类型断言（非 as any）以恢复元素类型
  for (const lanePolyline of Object.values(terrainMap.lanes) as unknown as LanePolyline[]) {
    let rangeTotal = decorRandom.range(4, 9)
    for (let index = 1; index < lanePolyline.length; index++) {
      const selectedH = lanePolyline[index - 1],
        segmentEndPoint = lanePolyline[index],
        laneSegmentLength = Math.hypot(segmentEndPoint.x - selectedH.x, segmentEndPoint.y - selectedH.y),
        laneDirX = (segmentEndPoint.x - selectedH.x) / laneSegmentLength,
        laneDirY = (segmentEndPoint.y - selectedH.y) / laneSegmentLength
      for (; rangeTotal < laneSegmentLength; rangeTotal += decorRandom.range(9, 15)) {
        const sideSign = decorRandom.chance(0.5) ? 1 : -1,
          sideOffsetDistance = terrainMap.laneWidth / 2 + decorRandom.range(0.75, 1.3),
          candidateX = selectedH.x + laneDirX * rangeTotal - laneDirY * sideSign * sideOffsetDistance,
          candidateZ = selectedH.y + laneDirY * rangeTotal + laneDirX * sideSign * sideOffsetDistance,
          laneDecorRoll = decorRandom.next(),
          decorYaw = decorRandom.range(0, EFFECT_FULL_TURN_RADIANS)
        builder.laneDist(candidateX, candidateZ) < 0.55 ||
          builder.riverDist(candidateX, candidateZ) < 1.4 ||
          builder.baseDist(candidateX, candidateZ) < 1 ||
          builder.padDist(candidateX, candidateZ) < 0.8 ||
          builder.solidDist(candidateX, candidateZ) < 0.8 ||
          builder.bushDist(candidateX, candidateZ) < 0.6 ||
          builder.campDist(candidateX, candidateZ) < 0.5 ||
          (laneDecorRoll < 0.45
            ? decorGeometryBuilder.add(decorRandom.pick(shrineScenery.fallenSteles), composeMatrixTRS(candidateX, 0, candidateZ, decorYaw, decorRandom.range(0.85, 1)), { shadow: !1, tint: scale3([1, 1, 1], decorRandom.range(0.86, 1)), glow: 1 })
            : decorGeometryBuilder.add(decorRandom.pick(shrineScenery.inlayArcs), composeMatrixTRS(candidateX, 0, candidateZ, decorYaw, decorRandom.range(0.8, 1.05)), { shadow: !1, tint: scale3([1, 1, 1], decorRandom.range(0.82, 0.98)), glow: 1 }))
      }
      rangeTotal -= laneSegmentLength
    }
  }
}

export { EFFECT_STONE_DARK_COLOR, EFFECT_SCRATCH_MATRIX, EFFECT_BLOB_BASE_COLOR, EFFECT_FULL_TURN_RADIANS, scatterNicheDecor, EFFECT_CRYSTAL_TIP_COLOR, EFFECT_AMBER_LIGHT_COLOR, EFFECT_CRYSTAL_TINT_COLOR }