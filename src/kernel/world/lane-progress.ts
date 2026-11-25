/**
 * 车道几何：折线投影（世界坐标↔车道进度）、三路车道名单与进度缓存
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */



function projectParamOnSegment(pointX, pointY, segmentStartX, segmentStartY, segmentEndX, segmentEndY) {
  const segmentDeltaX = segmentEndX - segmentStartX,
    segmentDeltaY = segmentEndY - segmentStartY,
    segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY
  if (segmentLengthSquared < 1e-12) return 0
  const projectionParam = ((pointX - segmentStartX) * segmentDeltaX + (pointY - segmentStartY) * segmentDeltaY) / segmentLengthSquared
  return projectionParam < 0 ? 0 : projectionParam > 1 ? 1 : projectionParam
}

class PolylineProjector {
  pts
  cum
  total
  tx = 1
  ty = 0
  lateral = 0
  constructor(lanePoints) {
    ;((this.pts = lanePoints), (this.cum = [0]))
    for (let index = 1; index < lanePoints.length; index++) this.cum.push(this.cum[index - 1] + Math.hypot(lanePoints[index].x - lanePoints[index - 1].x, lanePoints[index].y - lanePoints[index - 1].y))
    this.total = this.cum[this.cum.length - 1]
  }
  project(camera, pointY) {
    const ptsState = this.pts
    let nearestSquaredDistance = 1 / 0,
      projectedPathLength = 0
    for (let index = 1; index < ptsState.length; index++) {
      const selectedS = ptsState[index - 1],
        nextPoint = ptsState[index],
        projectParamOnSegmentResult = projectParamOnSegment(camera, pointY, selectedS.x, selectedS.y, nextPoint.x, nextPoint.y),
        projectionOffsetX = selectedS.x + (nextPoint.x - selectedS.x) * projectParamOnSegmentResult - camera,
        projectionOffsetY = selectedS.y + (nextPoint.y - selectedS.y) * projectParamOnSegmentResult - pointY,
        squaredDistance = projectionOffsetX * projectionOffsetX + projectionOffsetY * projectionOffsetY
      squaredDistance < nearestSquaredDistance && ((nearestSquaredDistance = squaredDistance), (projectedPathLength = this.cum[index - 1] + (this.cum[index] - this.cum[index - 1]) * projectParamOnSegmentResult))
    }
    return ((this.lateral = Math.sqrt(nearestSquaredDistance)), projectedPathLength)
  }
  pointAt(pathDistance, position) {
    const ptsValue = this.pts,
      cumState = this.cum,
      clampedDistance = pathDistance < 0 ? 0 : pathDistance > this.total ? this.total : pathDistance
    let segmentEndIndex = 1
    for (; segmentEndIndex < ptsValue.length - 1 && cumState[segmentEndIndex] < clampedDistance;) segmentEndIndex++
    const segmentStartPoint = ptsValue[segmentEndIndex - 1],
      segmentEndPoint = ptsValue[segmentEndIndex],
      segmentLength = cumState[segmentEndIndex] - cumState[segmentEndIndex - 1],
      segmentTravelRatio = segmentLength > 1e-9 ? (clampedDistance - cumState[segmentEndIndex - 1]) / segmentLength : 0
    return ((position.x = segmentStartPoint.x + (segmentEndPoint.x - segmentStartPoint.x) * segmentTravelRatio), (position.y = segmentStartPoint.y + (segmentEndPoint.y - segmentStartPoint.y) * segmentTravelRatio), segmentLength > 1e-9 && ((this.tx = (segmentEndPoint.x - segmentStartPoint.x) / segmentLength), (this.ty = (segmentEndPoint.y - segmentStartPoint.y) / segmentLength)), position)
  }
}

const LANE_NAMES = ["top", "mid", "bot"]

class LaneProgress {
  paths
  lateral = 0
  constructor(gameMap) {
    this.paths = { top: new PolylineProjector(gameMap.lanes.top), mid: new PolylineProjector(gameMap.lanes.mid), bot: new PolylineProjector(gameMap.lanes.bot) }
  }
  total(laneName) {
    return this.paths[laneName].total
  }
  prog(teamId, laneName, pointX, pointY) {
    const selectedPaths = this.paths[laneName],
      projectResult = selectedPaths.project(pointX, pointY)
    return ((this.lateral = selectedPaths.lateral), teamId === 0 ? projectResult : selectedPaths.total - projectResult)
  }
  /**
   * 处理坐标。
   *
   * @param joint - 骨骼关节
   * @param laneName - 次要输入
   * @param pathDistance - 第三输入
   * @param outPoint - 输入
   * @param sideOffset - 附加输入
  */
  point(joint, laneName, pathDistance, outPoint, sideOffset = 0) {
    const lanePath = this.paths[laneName]
    if ((lanePath.pointAt(joint === 0 ? pathDistance : lanePath.total - pathDistance, outPoint), sideOffset !== 0)) {
      const sideSign = joint === 0 ? 1 : -1
      ;((outPoint.x += -lanePath.ty * sideSign * sideOffset), (outPoint.y += lanePath.tx * sideSign * sideOffset))
    }
    return outPoint
  }
  nearestLane(pointX, pointY) {
    let nearestLaneName = "mid",
      nearestLaneDistance = 1 / 0
    for (const laneName of LANE_NAMES) {
      const lanePath = this.paths[laneName]
      ;(lanePath.project(pointX, pointY), lanePath.lateral < nearestLaneDistance && ((nearestLaneDistance = lanePath.lateral), (nearestLaneName = laneName)))
    }
    return ((this.lateral = nearestLaneDistance), nearestLaneName)
  }
}

const laneProgressCache = new WeakMap()

function getLaneProgress(lookupKey) {
  let Value = laneProgressCache.get(lookupKey)
  return (Value || ((Value = new LaneProgress(lookupKey)), laneProgressCache.set(lookupKey, Value)), Value)
}

export { PolylineProjector, getLaneProgress, LANE_NAMES, projectParamOnSegment }
