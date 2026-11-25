/**
 * 线段批渲染
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { CustomBlending, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import { ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { RING_FRAGMENT_SHADER, RING_VERTEX_SHADER } from '../fx/fx-enums'

class LineBatch {
  mesh
  geo
  posR
  col
  style
  capacity
  count = 0
  material
  constructor(ringCapacity = 160) {
    ;((this.capacity = ringCapacity),
      (this.geo = new InstancedBufferGeometry()),
      this.geo.setAttribute("position", new Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3)),
      this.geo.setIndex([0, 2, 1, 0, 3, 2]),
      (this.posR = new InstancedBufferAttribute(new Float32Array(ringCapacity * 4), 4)),
      (this.col = new InstancedBufferAttribute(new Float32Array(ringCapacity * 4), 4)),
      (this.style = new InstancedBufferAttribute(new Float32Array(ringCapacity * 4), 4)))
    for (const instanceAttribute of [this.posR, this.col, this.style]) instanceAttribute.setUsage(DynamicDrawUsage)
    ;(this.geo.setAttribute("aPosR", this.posR),
      this.geo.setAttribute("aCol", this.col),
      this.geo.setAttribute("aStyle", this.style),
      (this.material = new ShaderMaterial({
        uniforms: { ...UniformsUtils.clone(UniformsLib.fog), uTime: ARENA_SHARED_UNIFORMS.uTime },
        vertexShader: RING_VERTEX_SHADER,
        fragmentShader: RING_FRAGMENT_SHADER,
        transparent: !0,
        depthWrite: !1,
        fog: !0,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneMinusSrcAlphaFactor,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })),
      (this.mesh = new Mesh(this.geo, this.material)),
      (this.mesh.name = "unit-rings"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.matrixAutoUpdate = !1),
      (this.mesh.renderOrder = 4),
      (this.mesh.visible = !1))
  }
  begin() {
    this.count = 0
  }
  push(candidateUnit, centerY, centerZ, ringRadius, shadow, ringAlpha, ringStyle, facingAngle = 0, ellipseStretch = 1) {
    if (this.count >= this.capacity) return
    const ringIndex = this.count++,
      positionRadiusArray = this.posR.array
    ;((positionRadiusArray[ringIndex * 4] = candidateUnit), (positionRadiusArray[ringIndex * 4 + 1] = centerY), (positionRadiusArray[ringIndex * 4 + 2] = centerZ), (positionRadiusArray[ringIndex * 4 + 3] = ringRadius))
    const colorArray = this.col.array
    ;((colorArray[ringIndex * 4] = shadow.r), (colorArray[ringIndex * 4 + 1] = shadow.g), (colorArray[ringIndex * 4 + 2] = shadow.b), (colorArray[ringIndex * 4 + 3] = ringAlpha))
    const styleArray = this.style.array
    ;((styleArray[ringIndex * 4] = ringStyle), (styleArray[ringIndex * 4 + 1] = facingAngle), (styleArray[ringIndex * 4 + 2] = ellipseStretch))
  }
  end() {
    ;((this.geo.instanceCount = this.count), (this.mesh.visible = this.count > 0), this.count !== 0 && ((this.posR.needsUpdate = !0), (this.col.needsUpdate = !0), (this.style.needsUpdate = !0)))
  }
  dispose() {
    ;(this.geo.dispose(), this.material.dispose())
  }
}

export { LineBatch }
