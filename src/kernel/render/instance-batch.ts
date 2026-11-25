/**
 * 实例化渲染批次
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { CustomBlending, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial } from 'three'
import { INSTANCE_FRAGMENT_SHADER, INSTANCE_MAX_PER_FRAME, INSTANCE_VERTEX_SHADER } from './instance-shaders'
import { ARENA_SHARED_UNIFORMS } from '../arena-palette'

class InstanceBatch {
  mesh
  geo
  posR
  dim
  col
  capacity
  count = 0
  material
  constructor(initialCapacity = 16) {
    this.capacity = initialCapacity
    const element = new InstancedBufferGeometry(),
      quadVertexPositions = [],
      quadIndices = []
    for (let index = 0; index <= INSTANCE_MAX_PER_FRAME; index++) quadVertexPositions.push(index / INSTANCE_MAX_PER_FRAME, 0, 0, index / INSTANCE_MAX_PER_FRAME, 1, 0)
    for (let segmentIndex = 0; segmentIndex < INSTANCE_MAX_PER_FRAME; segmentIndex++) {
      const segmentVertexBase = segmentIndex * 2
      quadIndices.push(segmentVertexBase, segmentVertexBase + 1, segmentVertexBase + 2, segmentVertexBase + 2, segmentVertexBase + 1, segmentVertexBase + 3)
    }
    ;(element.setAttribute("position", new Float32BufferAttribute(quadVertexPositions, 3)),
      element.setIndex(quadIndices),
      (this.posR = new InstancedBufferAttribute(new Float32Array(initialCapacity * 4), 4)),
      (this.dim = new InstancedBufferAttribute(new Float32Array(initialCapacity * 4), 4)),
      (this.col = new InstancedBufferAttribute(new Float32Array(initialCapacity * 3), 3)))
    for (const instanceAttribute of [this.posR, this.dim, this.col]) instanceAttribute.setUsage(DynamicDrawUsage)
    ;(element.setAttribute("aPosR", this.posR),
      element.setAttribute("aDim", this.dim),
      element.setAttribute("aCol", this.col),
      (element.instanceCount = 0),
      (this.geo = element),
      (this.material = new ShaderMaterial({
        uniforms: { uTime: ARENA_SHARED_UNIFORMS.uTime },
        vertexShader: INSTANCE_VERTEX_SHADER,
        fragmentShader: INSTANCE_FRAGMENT_SHADER,
        transparent: !0,
        depthWrite: !1,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
      })),
      (this.mesh = new Mesh(element, this.material)),
      (this.mesh.name = "unit-shields"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.matrixAutoUpdate = !1),
      (this.mesh.renderOrder = 5),
      (this.mesh.visible = !1))
  }
  begin() {
    this.count = 0
  }
  push(candidateUnit, shieldBaseY, shieldCenterZ, shieldRadius, shadow, shieldHexColumns, shieldColor, shieldOpacity, shieldBreakProgress) {
    if (this.count >= this.capacity) return
    const instanceIndex = this.count++,
      positionData = this.posR.array
    ;((positionData[instanceIndex * 4] = candidateUnit), (positionData[instanceIndex * 4 + 1] = shieldBaseY), (positionData[instanceIndex * 4 + 2] = shieldCenterZ), (positionData[instanceIndex * 4 + 3] = shieldRadius))
    const dimensionData = this.dim.array
    ;((dimensionData[instanceIndex * 4] = shadow), (dimensionData[instanceIndex * 4 + 1] = shieldHexColumns), (dimensionData[instanceIndex * 4 + 2] = shieldOpacity), (dimensionData[instanceIndex * 4 + 3] = shieldBreakProgress))
    const colorData = this.col.array
    ;((colorData[instanceIndex * 3] = shieldColor.r), (colorData[instanceIndex * 3 + 1] = shieldColor.g), (colorData[instanceIndex * 3 + 2] = shieldColor.b))
  }
  end() {
    ;((this.geo.instanceCount = this.count), (this.mesh.visible = this.count > 0), this.count !== 0 && ((this.posR.needsUpdate = !0), (this.dim.needsUpdate = !0), (this.col.needsUpdate = !0)))
  }
  dispose() {
    ;(this.geo.dispose(), this.material.dispose())
  }
}

export { InstanceBatch }
