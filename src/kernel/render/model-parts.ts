/**
 * 模型部件生成函数
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MeshBuilder } from './buff-view'
import { lerp3, scale3 } from '../fx/particle-system'

function buildButtress(palette) {
  const meshBuilder = new MeshBuilder(),
    computed = 0.42,
    darkStoneColor = palette.stoneDark,
    stoneColor = palette.stone,
    entries = [
      [0.5, -0.1],
      [0.5, 0.35],
      [0.38, 0.5],
      [0.3, 1.5],
      [0.18, 1.65],
      [0.1, 2.3],
      [0, 2.4],
    ],
    distance = /**
 * 处理距离。
 *
 * @param cornerA - 主要输入
 * @param chest - 输入
 * @param cornerC - 第三输入
 * @param cornerD - 第四输入
 * @param faceColorA - 附加输入
 * @param faceColorB - 附加输入
 */
(cornerA, chest, cornerC, cornerD, faceColorA, faceColorB) => {
      const deltaX = chest[0] - cornerA[0],
        deltaY = chest[1] - cornerA[1],
        deltaZ = chest[2] - cornerA[2],
        deltaXX = cornerD[0] - cornerA[0],
        deltaYX = cornerD[1] - cornerA[1],
        deltaZX = cornerD[2] - cornerA[2]
      let faceNormalX = deltaY * deltaZX - deltaZ * deltaYX,
        scaledValueX = deltaZ * deltaXX - deltaX * deltaZX,
        scaledValueY = deltaX * deltaYX - deltaY * deltaXX
      const distance = Math.hypot(faceNormalX, scaledValueX, scaledValueY) || 1
      ;((faceNormalX /= distance), (scaledValueX /= distance), (scaledValueY /= distance))
      const vertexResult = meshBuilder.vertex(cornerA[0], cornerA[1], cornerA[2], faceColorA, faceNormalX, scaledValueX, scaledValueY),
        cornerBVertex = meshBuilder.vertex(chest[0], chest[1], chest[2], faceColorA, faceNormalX, scaledValueX, scaledValueY),
        cornerCVertex = meshBuilder.vertex(cornerC[0], cornerC[1], cornerC[2], faceColorB, faceNormalX, scaledValueX, scaledValueY),
        cornerDVertex = meshBuilder.vertex(cornerD[0], cornerD[1], cornerD[2], faceColorB, faceNormalX, scaledValueX, scaledValueY)
      meshBuilder.quad(vertexResult, cornerBVertex, cornerCVertex, cornerDVertex)
    }
  for (let index = 0; index < entries.length - 1; index++) {
    const [contourRadius, contourHeight] = entries[index],
      [primary, secondary] = entries[index + 1],
      ratio = index / (entries.length - 1),
      ratioX = (index + 1) / (entries.length - 1),
      stoneShade = lerp3(darkStoneColor, stoneColor, ratio),
      lerpedVector = lerp3(darkStoneColor, stoneColor, ratioX)
    ;(distance([contourRadius, contourHeight, computed], [contourRadius, contourHeight, -computed], [primary, secondary, -computed], [primary, secondary, computed], stoneShade, lerpedVector),
      distance([-0.1, contourHeight, computed], [contourRadius, contourHeight, computed], [primary, secondary, computed], [-0.1, secondary, computed], scale3(stoneShade, 0.9), scale3(lerpedVector, 0.9)),
      distance([contourRadius, contourHeight, -computed], [-0.1, contourHeight, -computed], [-0.1, secondary, -computed], [primary, secondary, -computed], scale3(stoneShade, 0.9), scale3(lerpedVector, 0.9)))
  }
  return (distance([0.39, 0.5, computed + 0.005], [0.39, 0.5, -computed - 0.005], [0.385, 0.58, -computed - 0.005], [0.385, 0.58, computed + 0.005], palette.trim, palette.trim), meshBuilder.build())
}

export { buildButtress }
