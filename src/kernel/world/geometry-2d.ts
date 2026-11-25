/**
 * 二维几何查询（点在多边形内 / 点到线段 / 点到多边形边界）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */



function isPointInPolygon(position, polygonVertices) {
  let isActive = !1
  for (let index = 0, previousVertexIndex = polygonVertices.length - 1; index < polygonVertices.length; previousVertexIndex = index++) {
    const selectedT = polygonVertices[index],
      previousVertex = polygonVertices[previousVertexIndex]
    selectedT.y > position.y != previousVertex.y > position.y && position.x < ((previousVertex.x - selectedT.x) * (position.y - selectedT.y)) / (previousVertex.y - selectedT.y) + selectedT.x && (isActive = !isActive)
  }
  return isActive
}

/**
 * 处理距离。
 *
 * @param queryPoint - 输入
 * @param segmentStart - 输入
 * @param segmentEnd - 输入
 */
function pointSegmentDistance(queryPoint, segmentStart, segmentEnd) {
  const segmentDeltaX = segmentEnd.x - segmentStart.x,
    segmentDeltaY = segmentEnd.y - segmentStart.y,
    segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY
  let projectionFraction = segmentLengthSquared > 0 ? ((queryPoint.x - segmentStart.x) * segmentDeltaX + (queryPoint.y - segmentStart.y) * segmentDeltaY) / segmentLengthSquared : 0
  return ((projectionFraction = Math.max(0, Math.min(1, projectionFraction))), Math.hypot(queryPoint.x - (segmentStart.x + segmentDeltaX * projectionFraction), queryPoint.y - (segmentStart.y + segmentDeltaY * projectionFraction)))
}

function distanceToPolygonEdge(queryPoint, polygonVertices) {
  let closestEdgeDistance = 1 / 0
  for (let index = 0, previousVertexIndex = polygonVertices.length - 1; index < polygonVertices.length; previousVertexIndex = index++) closestEdgeDistance = Math.min(closestEdgeDistance, pointSegmentDistance(queryPoint, polygonVertices[previousVertexIndex], polygonVertices[index]))
  return closestEdgeDistance
}

export { distanceToPolygonEdge, pointSegmentDistance, isPointInPolygon }
