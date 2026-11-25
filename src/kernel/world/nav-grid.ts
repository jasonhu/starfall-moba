/**
 * 导航网格：地形可通行距离场 + 加权 A* 寻路 + 圆形/胶囊碰撞查询
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { distanceToPolygonEdge, isPointInPolygon } from './geometry-2d'

const NAV_CELL_SIZE = 0.5,
  NAV_CELLS_PER_UNIT = 1 / NAV_CELL_SIZE,
  NAV_HALF_EXTENT = 58,
  NAV_GOAL_TOLERANCE = 0.06,
  NAV_HEURISTIC_WEIGHT = 1.12,
  NAV_TRACE_STEP = 0.3,
  NAV_WALL_CLAMP = 6,
  NAV_OBSTACLE_INFLATE = NAV_WALL_CLAMP,
  NAV_MAX_EXPANSIONS = 4e4,
  DIAGONAL_COST = Math.SQRT2,
  navBaseGridCache = new Map()

function buildNavBaseField(fieldSpec, gridSize) {
  const lookupKey = `${fieldSpec.bound}|${JSON.stringify(fieldSpec.walls)}`,
    Value = navBaseGridCache.get(lookupKey)
  if (Value) return Value
  const float32Array = new Float32Array(gridSize * gridSize),
    wallPolygons = fieldSpec.walls,
    wallBounds = wallPolygons.map((wallPolygon) => {
      let minCoordX = 1 / 0,
        minCoordY = 1 / 0,
        maxCoordX = -1 / 0,
        maxCoordY = -1 / 0
      for (const wallPoint of wallPolygon) (wallPoint.x < minCoordX && (minCoordX = wallPoint.x), wallPoint.x > maxCoordX && (maxCoordX = wallPoint.x), wallPoint.y < minCoordY && (minCoordY = wallPoint.y), wallPoint.y > maxCoordY && (maxCoordY = wallPoint.y))
      return { minX: minCoordX, minY: minCoordY, maxX: maxCoordX, maxY: maxCoordY }
    }),
    xConfig = { x: 0, y: 0 }
  for (let index = 0; index < gridSize; index++) {
    const worldX = -NAV_HALF_EXTENT + index * NAV_CELL_SIZE
    for (let colIndex = 0; colIndex < gridSize; colIndex++) {
      const cellWorldX = -NAV_HALF_EXTENT + colIndex * NAV_CELL_SIZE
      let cellClearance = Math.min(fieldSpec.bound - Math.abs(cellWorldX), fieldSpec.bound - Math.abs(worldX), NAV_WALL_CLAMP)
      ;((xConfig.x = cellWorldX), (xConfig.y = worldX))
      for (let wallIndex = 0; wallIndex < wallPolygons.length; wallIndex++) {
        const selectedO = wallBounds[wallIndex],
          wallBoxGapX = Math.max(selectedO.minX - cellWorldX, 0, cellWorldX - selectedO.maxX),
          wallBoxGapY = Math.max(selectedO.minY - worldX, 0, worldX - selectedO.maxY)
        if ((wallBoxGapX > 0 || wallBoxGapY > 0) && Math.hypot(wallBoxGapX, wallBoxGapY) >= cellClearance) continue
        const distanceToPolygonEdgeResult = distanceToPolygonEdge(xConfig, wallPolygons[wallIndex]),
          signedClearance = isPointInPolygon(xConfig, wallPolygons[wallIndex]) ? -distanceToPolygonEdgeResult : distanceToPolygonEdgeResult
        signedClearance < cellClearance && (cellClearance = signedClearance)
      }
      float32Array[index * gridSize + colIndex] = cellClearance
    }
  }
  return (navBaseGridCache.set(lookupKey, float32Array), float32Array)
}

class NavGrid {
  n
  clear
  base
  obstacles = []
  gScore
  parent
  opened
  closed
  heapNode
  heapKey
  heapSize = 0
  gen = 0
  nodeBuf
  gx = 0
  gy = 0
  stats = { searches: 0, expansions: 0 }
  lastPathPartial = !1
  constructor(fieldSpec) {
    const gridSize = Math.round((NAV_HALF_EXTENT * 2) / NAV_CELL_SIZE) + 1
    ;((this.n = gridSize), (this.base = buildNavBaseField(fieldSpec, gridSize)), (this.clear = new Float32Array(this.base)))
    const cellCount = gridSize * gridSize
    ;((this.gScore = new Float32Array(cellCount)),
      (this.parent = new Int32Array(cellCount)),
      (this.opened = new Uint32Array(cellCount)),
      (this.closed = new Uint32Array(cellCount)),
      (this.heapNode = new Int32Array(cellCount * 2)),
      (this.heapKey = new Float32Array(cellCount * 2)),
      (this.nodeBuf = new Int32Array(cellCount)))
  }
  sample(clearanceGrid, worldX, worldY) {
    const nState = this.n
    let gridX = (worldX + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT,
      gridY = (worldY + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT
    ;(gridX < 0 ? (gridX = 0) : gridX > nState - 1 && (gridX = nState - 1), gridY < 0 ? (gridY = 0) : gridY > nState - 1 && (gridY = nState - 1))
    let colIndex = gridX | 0,
      rowIndex = gridY | 0
    ;(colIndex > nState - 2 && (colIndex = nState - 2), rowIndex > nState - 2 && (rowIndex = nState - 2))
    const colFraction = gridX - colIndex,
      rowFraction = gridY - rowIndex,
      cellIndex = rowIndex * nState + colIndex,
      selectedT = clearanceGrid[cellIndex],
      eastClearance = clearanceGrid[cellIndex + 1],
      nextRowClearance = clearanceGrid[cellIndex + nState],
      diagClearance = clearanceGrid[cellIndex + nState + 1]
    return (selectedT + (eastClearance - selectedT) * colFraction) * (1 - rowFraction) + (nextRowClearance + (diagClearance - nextRowClearance) * colFraction) * rowFraction
  }
  clearanceAt(worldX, worldY) {
    return this.sample(this.clear, worldX, worldY)
  }
  isFree(worldX, worldY, minClearance) {
    return this.sample(this.clear, worldX, worldY) >= minClearance
  }
  isFreeTerrain(worldX, worldY, minClearance) {
    return this.sample(this.base, worldX, worldY) >= minClearance
  }
  gradient(worldX, worldY) {
    const clearanceGrid = this.clear,
      gradientX = this.sample(clearanceGrid, worldX + 0.25, worldY) - this.sample(clearanceGrid, worldX - 0.25, worldY),
      gradientY = this.sample(clearanceGrid, worldX, worldY + 0.25) - this.sample(clearanceGrid, worldX, worldY - 0.25),
      distance = Math.hypot(gradientX, gradientY)
    distance < 1e-6 ? ((this.gx = 0), (this.gy = 0)) : ((this.gx = gradientX / distance), (this.gy = gradientY / distance))
  }
  trace(clearanceGrid, startX, startY, endX, endY, minClearance) {
    const deltaX = endX - startX,
      deltaY = endY - startY,
      distance = Math.hypot(deltaX, deltaY)
    if (distance < 1e-6) return this.sample(clearanceGrid, startX, startY) >= minClearance
    const unitX = deltaX / distance,
      unitY = deltaY / distance
    let total = 0
    for (;;) {
      const sampleResult = this.sample(clearanceGrid, startX + unitX * total, startY + unitY * total)
      if (sampleResult < minClearance) return !1
      if (total >= distance) return !0
      const safeStep = (sampleResult - minClearance) * 0.9
      ;((total += safeStep > 0.2 ? safeStep : 0.2), total > distance && (total = distance))
    }
  }
  segmentFree(startX, startY, endX, endY, navClearance) {
    return this.trace(this.clear, startX, startY, endX, endY, navClearance)
  }
  lineOfSight(startX, startY, endX, endY) {
    return this.trace(this.base, startX, startY, endX, endY, 0)
  }
  stamp(position, minColX, minRowY, waterShallow, maxRowY) {
    const nValue = this.n,
      inflateRadius = position.r + NAV_OBSTACLE_INFLATE,
      lowerColumn = Math.max(minColX, Math.floor((position.x - inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      upperColumn = Math.min(waterShallow, Math.ceil((position.x + inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      lowerRow = Math.max(minRowY, Math.floor((position.y - inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      upperRow = Math.min(maxRowY, Math.ceil((position.y + inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT))
    for (let index = lowerRow; index <= upperRow; index++) {
      const offsetY = -NAV_HALF_EXTENT + index * NAV_CELL_SIZE - position.y
      for (let columnIndex = lowerColumn; columnIndex <= upperColumn; columnIndex++) {
        const offsetX = -NAV_HALF_EXTENT + columnIndex * NAV_CELL_SIZE - position.x,
          distance = Math.hypot(offsetX, offsetY) - position.r,
          cellIndex = index * nValue + columnIndex
        distance < this.clear[cellIndex] && (this.clear[cellIndex] = distance)
      }
    }
  }
  addObstacle(obstacleId, obstacleX, obstacleY, radius) {
    const idConfig = { id: obstacleId, x: obstacleX, y: obstacleY, r: radius }
    ;(this.obstacles.push(idConfig), this.stamp(idConfig, 0, 0, this.n - 1, this.n - 1))
  }
  removeObstacle(obstacleId) {
    const findIndexResult = this.obstacles.findIndex((obstacle) => obstacle.id === obstacleId)
    if (findIndexResult < 0) return
    const selectedObstacles = this.obstacles[findIndexResult]
    this.obstacles.splice(findIndexResult, 1)
    const gridSize = this.n,
      inflateRadius = selectedObstacles.r + NAV_OBSTACLE_INFLATE,
      minColumn = Math.max(0, Math.floor((selectedObstacles.x - inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      maxColumn = Math.min(gridSize - 1, Math.ceil((selectedObstacles.x + inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      minRow = Math.max(0, Math.floor((selectedObstacles.y - inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)),
      maxRow = Math.min(gridSize - 1, Math.ceil((selectedObstacles.y + inflateRadius + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT))
    for (let index = minRow; index <= maxRow; index++) {
      const rowOffset = index * gridSize
      for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex++) this.clear[rowOffset + columnIndex] = this.base[rowOffset + columnIndex]
    }
    for (const obstacle of this.obstacles) this.stamp(obstacle, minColumn, minRow, maxColumn, maxRow)
  }
  /**
   * 处理碰撞。
   *
   * @param position - 主要输入
   * @param deltaX - 次要输入
   * @param deltaY - 第三输入
   * @param minClearance - 第四输入
  */
  moveWithCollision(position, deltaX, deltaY, minClearance) {
    const distance = Math.hypot(deltaX, deltaY)
    if (distance < 1e-9) return !1
    const stepCount = distance > NAV_TRACE_STEP ? Math.ceil(distance / NAV_TRACE_STEP) : 1,
      stepX = deltaX / stepCount,
      stepY = deltaY / stepCount
    let isActive = !1
    for (let index = 0; index < stepCount && this.stepOnce(position, stepX, stepY, minClearance); index++) isActive = !0
    return isActive
  }
  stepOnce(position, stepX, stepY, minClearance) {
    const clearanceGrid = this.clear
    let total = position.x + stepX,
      nextY = position.y + stepY,
      sampledClearance = this.sample(clearanceGrid, total, nextY)
    if (sampledClearance >= minClearance) return ((position.x = total), (position.y = nextY), !0)
    for (let index = 0; index < 3 && (this.gradient(total, nextY), !(this.gx === 0 && this.gy === 0)); index++) {
      const pushDistance = minClearance - sampledClearance + 0.004
      if (((total += this.gx * pushDistance), (nextY += this.gy * pushDistance), (sampledClearance = this.sample(clearanceGrid, total, nextY)), sampledClearance >= minClearance)) return ((position.x = total), (position.y = nextY), !0)
    }
    return stepX !== 0 && this.sample(clearanceGrid, position.x + stepX, position.y) >= minClearance ? ((position.x += stepX), !0) : stepY !== 0 && this.sample(clearanceGrid, position.x, position.y + stepY) >= minClearance ? ((position.y += stepY), !0) : !1
  }
  moveStraight(position, dirX, dirY, maxDistance, minClearance) {
    const clearanceGrid = this.clear,
      safeClearance = minClearance - 0.05
    let total = 0
    for (; total < maxDistance;) {
      const stepLength = Math.min(0.2, maxDistance - total)
      if (this.sample(clearanceGrid, position.x + dirX * (total + stepLength), position.y + dirY * (total + stepLength)) < safeClearance) break
      total += stepLength
    }
    return ((position.x += dirX * total), (position.y += dirY * total), total)
  }
  nearestNode(worldX, worldY, minClearance, ringLimit) {
    const gridSize = this.n,
      clearanceGrid = this.clear
    let centerColumn = Math.round((worldX + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT),
      centerRow = Math.round((worldY + NAV_HALF_EXTENT) * NAV_CELLS_PER_UNIT)
    if (((centerColumn = centerColumn < 0 ? 0 : centerColumn > gridSize - 1 ? gridSize - 1 : centerColumn), (centerRow = centerRow < 0 ? 0 : centerRow > gridSize - 1 ? gridSize - 1 : centerRow), clearanceGrid[centerRow * gridSize + centerColumn] >= minClearance)) return centerRow * gridSize + centerColumn
    let bestNode = -1,
      bestDistance = 1 / 0,
      foundRing = -1
    for (let index = 1; index <= ringLimit && !(foundRing >= 0 && index > foundRing + 2); index++) {
      const minColumn = centerColumn - index,
        maxColumn = centerColumn + index,
        minRow = centerRow - index,
        maxRow = centerRow + index
      for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
        if (rowIndex < 0 || rowIndex >= gridSize) continue
        const columnStep = rowIndex === minRow || rowIndex === maxRow ? 1 : maxColumn - minColumn
        for (let total = minColumn; total <= maxColumn; total += columnStep) {
          if (total < 0 || total >= gridSize) continue
          const cellIndex = rowIndex * gridSize + total
          if (clearanceGrid[cellIndex] < minClearance) continue
          const offsetX = -NAV_HALF_EXTENT + total * NAV_CELL_SIZE - worldX,
            offsetY = -NAV_HALF_EXTENT + rowIndex * NAV_CELL_SIZE - worldY,
            distanceSq = offsetX * offsetX + offsetY * offsetY
          distanceSq < bestDistance && ((bestDistance = distanceSq), (bestNode = cellIndex), foundRing < 0 && (foundRing = index))
        }
      }
    }
    return bestNode
  }
  nearestFree(worldX, worldY, minClearance, outPosition, searchRadius = 12) {
    if (this.sample(this.clear, worldX, worldY) >= minClearance) return ((outPosition.x = worldX), (outPosition.y = worldY), !0)
    const nearestNodeResult = this.nearestNode(worldX, worldY, minClearance + 0.02, Math.ceil(searchRadius * NAV_CELLS_PER_UNIT))
    return nearestNodeResult < 0 ? !1 : ((outPosition.x = -NAV_HALF_EXTENT + (nearestNodeResult % this.n) * NAV_CELL_SIZE), (outPosition.y = -NAV_HALF_EXTENT + Math.floor(nearestNodeResult / this.n) * NAV_CELL_SIZE), !0)
  }
  heapPush(nodeIndex, priority) {
    const heapNodes = this.heapNode,
      heapKeys = this.heapKey
    let insertIndex = this.heapSize++
    for (; insertIndex > 0;) {
      const parentIndex = (insertIndex - 1) >> 1
      if (heapKeys[parentIndex] <= priority) break
      ;((heapNodes[insertIndex] = heapNodes[parentIndex]), (heapKeys[insertIndex] = heapKeys[parentIndex]), (insertIndex = parentIndex))
    }
    ;((heapNodes[insertIndex] = nodeIndex), (heapKeys[insertIndex] = priority))
  }
  heapPop() {
    const heapNodes = this.heapNode,
      heapKeys = this.heapKey,
      topNode = heapNodes[0],
      lastIndex = --this.heapSize
    if (lastIndex > 0) {
      const tailNode = heapNodes[lastIndex],
        selectedE = heapKeys[lastIndex]
      let holeIndex = 0
      for (;;) {
        let childIndex = holeIndex * 2 + 1
        if (childIndex >= lastIndex || (childIndex + 1 < lastIndex && heapKeys[childIndex + 1] < heapKeys[childIndex] && childIndex++, heapKeys[childIndex] >= selectedE)) break
        ;((heapNodes[holeIndex] = heapNodes[childIndex]), (heapKeys[holeIndex] = heapKeys[childIndex]), (holeIndex = childIndex))
      }
      ;((heapNodes[holeIndex] = tailNode), (heapKeys[holeIndex] = selectedE))
    }
    return topNode
  }
  /**
   * 查找路径。
   *
   * @param startX - 输入
   * @param lookupOption - 输入
   * @param goalX - 第三输入
   * @param goalY - 第四输入
   * @param minClearance - 输入
   * @param hazardCircles - 输入
   * @param heuristicWeight - 附加输入
  */
  findPath(startX, lookupOption, goalX, goalY, minClearance, hazardCircles, heuristicWeight = NAV_HEURISTIC_WEIGHT) {
    const gridSize = this.n,
      clearanceGrid = this.clear,
      requiredClearance = minClearance + NAV_GOAL_TOLERANCE,
      activeHazards = hazardCircles && hazardCircles.length > 0 ? hazardCircles : null,
      startNode = this.nearestNode(startX, lookupOption, requiredClearance, 8),
      goalNode = this.nearestNode(goalX, goalY, requiredClearance, 40)
    if (startNode < 0 || goalNode < 0) return null
    this.stats.searches++
    const goalColumn = goalNode % gridSize,
      goalRow = (goalNode / gridSize) | 0,
      searchGen = ++this.gen,
      gScores = this.gScore,
      parents = this.parent,
      opened = this.opened,
      closed = this.closed,
      heapLimit = this.heapNode.length - 8
    ;((this.heapSize = 0), (gScores[startNode] = 0), (parents[startNode] = -1), (opened[startNode] = searchGen), this.heapPush(startNode, 0))
    let goalReached = startNode === goalNode,
      closestNodeToGoal = startNode,
      bestHeuristic = 1 / 0,
      expansions = 0
    for (; !goalReached && this.heapSize > 0;) {
      const heapPopResult = this.heapPop()
      if (closed[heapPopResult] === searchGen) continue
      if (((closed[heapPopResult] = searchGen), heapPopResult === goalNode)) {
        goalReached = !0
        break
      }
      if (++expansions > NAV_MAX_EXPANSIONS || this.heapSize > heapLimit) break
      const currentColumn = heapPopResult % gridSize,
        currentRow = (heapPopResult / gridSize) | 0,
        selectedG = gScores[heapPopResult]
      for (let index = -1; index <= 1; index++) {
        const neighborRow = currentRow + index
        if (!(neighborRow < 0 || neighborRow >= gridSize))
          for (let colOffset = -1; colOffset <= 1; colOffset++) {
            if (colOffset === 0 && index === 0) continue
            const neighborCol = currentColumn + colOffset
            if (neighborCol < 0 || neighborCol >= gridSize) continue
            const neighborIndex = neighborRow * gridSize + neighborCol
            if (closed[neighborIndex] === searchGen || clearanceGrid[neighborIndex] < requiredClearance || (activeHazards && pointHitsAnyCircle(activeHazards, -NAV_HALF_EXTENT + neighborCol * NAV_CELL_SIZE, -NAV_HALF_EXTENT + neighborRow * NAV_CELL_SIZE))) continue
            const isDiagonal = colOffset !== 0 && index !== 0
            if (isDiagonal && (clearanceGrid[currentRow * gridSize + neighborCol] < requiredClearance || clearanceGrid[neighborRow * gridSize + currentColumn] < requiredClearance)) continue
            const neighborG = selectedG + (isDiagonal ? DIAGONAL_COST : 1)
            if (opened[neighborIndex] === searchGen && neighborG >= gScores[neighborIndex]) continue
            ;((gScores[neighborIndex] = neighborG), (parents[neighborIndex] = heapPopResult), (opened[neighborIndex] = searchGen))
            const colDistance = neighborCol > goalColumn ? neighborCol - goalColumn : goalColumn - neighborCol,
              rowDistance = neighborRow > goalRow ? neighborRow - goalRow : goalRow - neighborRow,
              heuristicCost = colDistance > rowDistance ? colDistance + rowDistance * (DIAGONAL_COST - 1) : rowDistance + colDistance * (DIAGONAL_COST - 1)
            ;(heuristicCost < bestHeuristic && ((bestHeuristic = heuristicCost), (closestNodeToGoal = neighborIndex)), this.heapPush(neighborIndex, neighborG + heuristicCost * heuristicWeight))
          }
      }
    }
    ;((this.stats.expansions += expansions), (this.lastPathPartial = !goalReached))
    const pathBuffer = this.nodeBuf
    let pathLength = 0
    for (let traceNode = goalReached ? goalNode : closestNodeToGoal; traceNode >= 0; traceNode = parents[traceNode]) pathBuffer[pathLength++] = traceNode
    const pathPoints = []
    for (let pointIndex = pathLength - 1; pointIndex >= 0; pointIndex--) {
      const pathNode = pathBuffer[pointIndex]
      pathPoints.push({ x: -NAV_HALF_EXTENT + (pathNode % gridSize) * NAV_CELL_SIZE, y: -NAV_HALF_EXTENT + ((pathNode / gridSize) | 0) * NAV_CELL_SIZE })
    }
    if (goalReached && this.sample(clearanceGrid, goalX, goalY) >= minClearance) {
      const selectedA = pathPoints[pathPoints.length - 1]
      this.trace(clearanceGrid, selectedA.x, selectedA.y, goalX, goalY, minClearance) && pathPoints.push({ x: goalX, y: goalY })
    }
    const smoothedPath = []
    let anchorX = startX,
      currentX = lookupOption,
      anchorCursor = 0
    const count = pathPoints.length
    for (; anchorCursor < count;) {
      let farthestIndex = anchorCursor
      for (let lookaheadIndex = anchorCursor + 1; lookaheadIndex < count && !(!this.trace(clearanceGrid, anchorX, currentX, pathPoints[lookaheadIndex].x, pathPoints[lookaheadIndex].y, requiredClearance) || (activeHazards && capsuleHitsAnyCircle(activeHazards, anchorX, currentX, pathPoints[lookaheadIndex].x, pathPoints[lookaheadIndex].y))); lookaheadIndex++) farthestIndex = lookaheadIndex
      ;(smoothedPath.push(pathPoints[farthestIndex]), (anchorX = pathPoints[farthestIndex].x), (currentX = pathPoints[farthestIndex].y), (anchorCursor = farthestIndex + 1))
    }
    return smoothedPath
  }
}

/**
 * 处理碰撞。
 *
 * @param hazardCircles - 主要输入
 * @param pointX - 次要输入
 * @param pointY - 第三输入
 */
function pointHitsAnyCircle(hazardCircles, pointX, pointY) {
  for (let index = 0; index < hazardCircles.length; index++) {
    const selectedN = hazardCircles[index],
      offsetX = pointX - selectedN.x,
      offsetY = pointY - selectedN.y
    if (offsetX * offsetX + offsetY * offsetY < selectedN.r * selectedN.r) return !0
  }
  return !1
}

/**
 * 处理碰撞。
 *
 * @param hazardCircles - 输入
 * @param startX - 次要输入
 * @param startY - 第三输入
 * @param endX - 第四输入
 * @param endY - 附加输入
 */
function capsuleHitsAnyCircle(hazardCircles, startX, startY, endX, endY) {
  const deltaX = endX - startX,
    deltaY = endY - startY,
    segmentLengthSq = deltaX * deltaX + deltaY * deltaY
  for (let index = 0; index < hazardCircles.length; index++) {
    const hazardCircle = hazardCircles[index]
    let projection = segmentLengthSq > 1e-9 ? ((hazardCircle.x - startX) * deltaX + (hazardCircle.y - startY) * deltaY) / segmentLengthSq : 0
    projection = projection < 0 ? 0 : projection > 1 ? 1 : projection
    const offsetX = startX + deltaX * projection - hazardCircle.x,
      offsetY = startY + deltaY * projection - hazardCircle.y
    if (offsetX * offsetX + offsetY * offsetY < hazardCircle.r * hazardCircle.r) return !0
  }
  return !1
}

export { capsuleHitsAnyCircle, NavGrid }
