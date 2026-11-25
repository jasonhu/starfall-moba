/**
 * 几何体工具函数
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, Vector2 } from 'three'
import { makeLightUniforms } from './foundation'
import { ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { VEGETATION_FRAGMENT_SHADER, VEGETATION_VERTEX_SHADER } from './vegetation-shaders'

function buildInterleavedFloatAttribute(decalInstances, bound) {
  const count = decalInstances.length,
    float32Array = new Float32Array(count * 12),
    uvData = new Float32Array(count * 8),
    decorParamData = new Float32Array(count * 16),
    colorAData = new Float32Array(count * 12),
    colorBData = new Float32Array(count * 12),
    quadIndices = [],
    cornerOffsets = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
  decalInstances.forEach((decalEntry, decalIndex) => {
    for (let index = 0; index < 4; index++) {
      const [cornerOffsetX, cornerOffsetZ] = cornerOffsets[index],
        vertexIndex = decalIndex * 4 + index
      ;((float32Array[vertexIndex * 3] = decalEntry.x + cornerOffsetX * decalEntry.radius),
        (float32Array[vertexIndex * 3 + 1] = decalEntry.y),
        (float32Array[vertexIndex * 3 + 2] = decalEntry.z + cornerOffsetZ * decalEntry.radius),
        (uvData[vertexIndex * 2] = cornerOffsetX),
        (uvData[vertexIndex * 2 + 1] = cornerOffsetZ),
        (decorParamData[vertexIndex * 4] = decalEntry.type),
        (decorParamData[vertexIndex * 4 + 1] = decalEntry.seed ?? 0),
        (decorParamData[vertexIndex * 4 + 2] = decalEntry.radius),
        (decorParamData[vertexIndex * 4 + 3] = decalEntry.w ?? 0),
        colorAData.set(decalEntry.colorA, vertexIndex * 3),
        colorBData.set(decalEntry.colorB, vertexIndex * 3))
    }
    const quadStartIndex = decalIndex * 4
    quadIndices.push(quadStartIndex, quadStartIndex + 3, quadStartIndex + 2, quadStartIndex, quadStartIndex + 2, quadStartIndex + 1)
  })
  const element = new BufferGeometry()
  ;(element.setAttribute("position", new BufferAttribute(float32Array, 3)),
    element.setAttribute("uv", new BufferAttribute(uvData, 2)),
    element.setAttribute("aParam", new BufferAttribute(decorParamData, 4)),
    element.setAttribute("aColorA", new BufferAttribute(colorAData, 3)),
    element.setAttribute("aColorB", new BufferAttribute(colorBData, 3)),
    element.setIndex(quadIndices))
  const vegetationMaterial = new ShaderMaterial({
      uniforms: makeLightUniforms({ uTime: ARENA_SHARED_UNIFORMS.uTime, uBound: { value: bound }, uAlert: { value: new Vector2(0, 0) } }),
      vertexShader: VEGETATION_VERTEX_SHADER,
      fragmentShader: VEGETATION_FRAGMENT_SHADER,
      lights: !0,
      fog: !1,
      transparent: !0,
      premultipliedAlpha: !0,
      depthWrite: !1,
      polygonOffset: !0,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    decalMesh = new Mesh(element, vegetationMaterial)
  ;((decalMesh.name = "decals"), (decalMesh.receiveShadow = !0), (decalMesh.renderOrder = 3), (decalMesh.frustumCulled = !1))
  const fountainAlert = vegetationMaterial.uniforms.uAlert.value
  return {
    mesh: decalMesh,
    setFountainAlert(targetObject, propertyName) {
      targetObject === 0 ? (fountainAlert.x = propertyName) : (fountainAlert.y = propertyName)
    },
  }
}

export { buildInterleavedFloatAttribute }
