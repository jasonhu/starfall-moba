/**
 * 地图几何：地形高度场、墙体/草丛/营地多边形、可行走判定与网格栅格化
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { distanceToPolygonEdge, isPointInPolygon, pointSegmentDistance } from './geometry-2d'

const WATER_LEVEL = -0.13,
  RIVER_SHORE_SLOPE = 0.52,
  MAP_GRID_HALF_EXTENT = 64,
  TERRAIN_PALETTE_INDEX = { lane: 6, river: 6, solid: 4, base: 6, bush: 3, camp: 6, pad: 6 }

function monsterRadius(monsterType) {
  switch (monsterType) {
    case "abyss_drake":
    case "star_colossus":
      return 5.2
    case "frost_golem":
    case "ember_golem":
      return 3.6
    default:
      return 2.8
  }
}

const TOWER_PAD_RADIUS = 3.3,
  BASE_PAD_RADIUS = 6.6,
  MONSTER_KIND_INDEX = { frost_golem: 1, ember_golem: 2, mossback: 3, glimwing: 4, abyss_drake: 5, star_colossus: 6 },
  MAX_CAMP_COUNT = 14,
  SHADOW_LENGTH_FACTOR = 2.6,
  smoothstepClamped = (edgeStart, edgeEnd, sampleDistance) => {
    const clampedProgress = Math.min(1, Math.max(0, (sampleDistance - edgeStart) / (edgeEnd - edgeStart)))
    return clampedProgress * clampedProgress * (3 - 2 * clampedProgress)
  }

function polygonBounds(polygonPoints) {
  let minX = 1 / 0,
    maxX = -1 / 0,
    minY = 1 / 0,
    maxY = -1 / 0
  for (const vertex of polygonPoints) ((minX = Math.min(minX, vertex.x)), (maxX = Math.max(maxX, vertex.x)), (minY = Math.min(minY, vertex.y)), (maxY = Math.max(maxY, vertex.y)))
  return { poly: polygonPoints, minX: minX, maxX: maxX, minY: minY, maxY: maxY }
}

function signedDistanceToPolygon(point, polygon) {
  const distanceToPolygonEdgeResult = distanceToPolygonEdge(point, polygon)
  return isPointInPolygon(point, polygon) ? -distanceToPolygonEdgeResult : distanceToPolygonEdgeResult
}

class MapGeometry {
  map
  walls
  bushes
  bases
  riverLine
  laneSegs = []
  pads = []
  tmp = { x: 0, y: 0 }
  constructor(bushMap) {
    ;((this.map = bushMap), (this.walls = bushMap.walls.map(polygonBounds)), (this.bushes = bushMap.bushes.map(polygonBounds)), (this.bases = bushMap.bases.map((base) => polygonBounds(base.area))))
    for (const lanesasany of Object.values(bushMap.lanes) as any[]) for (let index = 1; index < lanesasany.length; index++) this.laneSegs.push([lanesasany[index - 1], lanesasany[index]])
    const riverPoints = bushMap.river,
      selectedE = riverPoints[0],
      riverSecondPoint = riverPoints[1],
      riverLastPoint = riverPoints[riverPoints.length - 1],
      riverPenultimatePoint = riverPoints[riverPoints.length - 2],
      distance = /**
 * 处理距离。
 *
 * @param position - 坐标
 * @param targetPosition - 输入
 * @param extendLength - 第三输入
 * @returns 结果对象
 */
(position, targetPosition, extendLength) => {
        const deltaX = position.x - targetPosition.x,
          deltaY = position.y - targetPosition.y,
          distance = Math.hypot(deltaX, deltaY) || 1
        return { x: position.x + (deltaX / distance) * extendLength, y: position.y + (deltaY / distance) * extendLength }
      }
    this.riverLine = [distance(selectedE, riverSecondPoint, 40), ...riverPoints, distance(riverLastPoint, riverPenultimatePoint, 40)]
    for (const tower of bushMap.towers) this.pads.push({ pos: tower.pos, r: TOWER_PAD_RADIUS })
    for (const baseWithCore of bushMap.bases) this.pads.push({ pos: baseWithCore.core, r: BASE_PAD_RADIUS })
  }
  pt(coordX, coordY) {
    return ((this.tmp.x = coordX), (this.tmp.y = coordY), this.tmp)
  }
  laneDist(lookupKey, coordY) {
    const ptResult = this.pt(lookupKey, coordY)
    let nearestLaneDistance = 1 / 0
    for (const laneSeg of this.laneSegs) nearestLaneDistance = Math.min(nearestLaneDistance, pointSegmentDistance(ptResult, laneSeg[0], laneSeg[1]))
    return nearestLaneDistance - this.map.laneWidth / 2
  }
  riverDist(coordX, coordY) {
    const queryPoint = this.pt(coordX, coordY)
    let nearestRiverDistance = 1 / 0
    const riverLine = this.riverLine
    for (let index = 1; index < riverLine.length; index++) nearestRiverDistance = Math.min(nearestRiverDistance, pointSegmentDistance(queryPoint, riverLine[index - 1], riverLine[index]))
    return nearestRiverDistance - this.map.riverWidth / 2
  }
  wallDist(coordX, coordY, maxSearchDistance = 8) {
    const queryPoint = this.pt(coordX, coordY)
    let result = maxSearchDistance
    for (const wall of this.walls) coordX < wall.minX - result || coordX > wall.maxX + result || coordY < wall.minY - result || coordY > wall.maxY + result || (result = Math.min(result, signedDistanceToPolygon(queryPoint, wall.poly)))
    return result
  }
  boundDist(coordX, coordY) {
    return this.map.bound - Math.max(Math.abs(coordX), Math.abs(coordY))
  }
  solidDist(coordX, coordY, maxSearchDistance = 8) {
    return Math.min(this.wallDist(coordX, coordY, maxSearchDistance), this.boundDist(coordX, coordY))
  }
  baseDist(coordX, coordY, maxSearchDistance = 8) {
    const queryPoint = this.pt(coordX, coordY)
    let nearestBaseDistance = maxSearchDistance
    for (const baseBounds of this.bases) coordX < baseBounds.minX - nearestBaseDistance || coordX > baseBounds.maxX + nearestBaseDistance || coordY < baseBounds.minY - nearestBaseDistance || coordY > baseBounds.maxY + nearestBaseDistance || (nearestBaseDistance = Math.min(nearestBaseDistance, signedDistanceToPolygon(queryPoint, baseBounds.poly)))
    return nearestBaseDistance
  }
  bushDist(coordX, coordY, maxSearchDistance = 4) {
    const queryPoint = this.pt(coordX, coordY)
    let nearestBushDistance = maxSearchDistance
    for (const bushBounds of this.bushes) coordX < bushBounds.minX - nearestBushDistance || coordX > bushBounds.maxX + nearestBushDistance || coordY < bushBounds.minY - nearestBushDistance || coordY > bushBounds.maxY + nearestBushDistance || (nearestBushDistance = Math.min(nearestBushDistance, signedDistanceToPolygon(queryPoint, bushBounds.poly)))
    return nearestBushDistance
  }
  campDist(coordX, coordY) {
    let nearestCampDistance = 1 / 0
    for (const camp of this.map.camps) nearestCampDistance = Math.min(nearestCampDistance, Math.hypot(coordX - camp.pos.x, coordY - camp.pos.y) - monsterRadius(camp.monsterType))
    return nearestCampDistance
  }
  padDist(coordX, coordY) {
    let nearestPadDistance = 1 / 0
    for (const pad of this.pads) nearestPadDistance = Math.min(nearestPadDistance, Math.hypot(coordX - pad.pos.x, coordY - pad.pos.y) - pad.r)
    return nearestPadDistance
  }
  fountainDist(coordX, coordY) {
    let nearestFountainDistance = 1 / 0
    for (const base of this.map.bases) nearestFountainDistance = Math.min(nearestFountainDistance, Math.hypot(coordX - base.fountain.x, coordY - base.fountain.y) - base.fountainRadius)
    return nearestFountainDistance
  }
  heightAt(coordX, coordY) {
    const riverDistResult = this.riverDist(coordX, coordY)
    if (riverDistResult > 0.4) return 0
    const smoothstepClampedResult = smoothstepClamped(1, -1.5, this.laneDist(coordX, coordY))
    return -(RIVER_SHORE_SLOPE * (1 - 0.42 * smoothstepClampedResult)) * smoothstepClamped(0.4, -1.9, riverDistResult)
  }
  inWater(coordX, coordY) {
    return this.heightAt(coordX, coordY) < WATER_LEVEL && this.boundDist(coordX, coordY) > -1
  }
  clutterOk(coordX, coordY, minLaneClearance = 0.3) {
    return !(this.solidDist(coordX, coordY) < 0.15 || this.laneDist(coordX, coordY) < minLaneClearance || this.riverDist(coordX, coordY) < 0.8 || this.baseDist(coordX, coordY) < 0.6 || this.padDist(coordX, coordY) < 0.5)
  }
}

function paintSegmentIntoGrid(gridDistances, gridSize, segmentStart, segmentEnd, searchMargin) {
  const cellsPerUnit = gridSize / (MAP_GRID_HALF_EXTENT * 2),
    minGridX = Math.max(0, Math.floor((Math.min(segmentStart.x, segmentEnd.x) - searchMargin + MAP_GRID_HALF_EXTENT) * cellsPerUnit)),
    maxGridX = Math.min(gridSize - 1, Math.ceil((Math.max(segmentStart.x, segmentEnd.x) + searchMargin + MAP_GRID_HALF_EXTENT) * cellsPerUnit)),
    minGridY = Math.max(0, Math.floor((Math.min(segmentStart.y, segmentEnd.y) - searchMargin + MAP_GRID_HALF_EXTENT) * cellsPerUnit)),
    maxGridY = Math.min(gridSize - 1, Math.ceil((Math.max(segmentStart.y, segmentEnd.y) + searchMargin + MAP_GRID_HALF_EXTENT) * cellsPerUnit)),
    xConfig = { x: 0, y: 0 }
  for (let index = minGridY; index <= maxGridY; index++) {
    xConfig.y = (index + 0.5) / cellsPerUnit - MAP_GRID_HALF_EXTENT
    for (let cellGridX = minGridX; cellGridX <= maxGridX; cellGridX++) {
      xConfig.x = (cellGridX + 0.5) / cellsPerUnit - MAP_GRID_HALF_EXTENT
      const pointSegmentDistanceResult = pointSegmentDistance(xConfig, segmentStart, segmentEnd),
        cellIndex = index * gridSize + cellGridX
      pointSegmentDistanceResult < gridDistances[cellIndex] && (gridDistances[cellIndex] = pointSegmentDistanceResult)
    }
  }
}

export { smoothstepClamped, monsterRadius, MONSTER_KIND_INDEX, signedDistanceToPolygon, WATER_LEVEL, TERRAIN_PALETTE_INDEX, MapGeometry, TOWER_PAD_RADIUS, BASE_PAD_RADIUS, MAX_CAMP_COUNT, SHADOW_LENGTH_FACTOR, MAP_GRID_HALF_EXTENT, paintSegmentIntoGrid }