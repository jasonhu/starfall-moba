/**
 * 场景装置：轮廓注册表、相机/灯光/贴花装置、GPU 计时与帧统计
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, ClampToEdgeWrapping, Color, DataTexture, DirectionalLight, DynamicDrawUsage, FloatType, HemisphereLight, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Mesh, Material, NearestFilter, NoColorSpace, PerspectiveCamera, PointLight, RGBAFormat, Texture, UnsignedByteType, Vector2, Vector3 } from 'three'
import { createOutlineMaterial, createUnitMaterial, createUnitSkinMaterial, createXrayMaterial, patternedMaterials, setLightTint } from './foundation'
import { ARENA_PALETTE, ARENA_SHARED_UNIFORMS, LIGHT_TINT_GRID_SIZE } from '../arena-palette'

interface OutlineMaterialOptions {
  xray?: boolean
  outline?: number
  outlineColor?: number
}

class OutlineRegistry {
  mesh
  count = 0
  triangles
  source
  bones
  capacity
  geo
  tex
  data
  instA
  instTeam
  instTint
  instBody
  instX = null
  wantXray
  material
  depth
  outline = null
  outlineMat = null
  xray = null
  xrayMat = null
  xrayOn = !0
  constructor(element, boneCount, instanceCapacity, materialOptions: OutlineMaterialOptions = {}, meshName = "unit-batch") {
    ;((this.source = element),
      (this.bones = boneCount),
      (this.capacity = Math.max(1, instanceCapacity)),
      (this.triangles = (element.index ? element.index.count : element.attributes.position.count) / 3),
      (this.wantXray = materialOptions.xray === !0),
      element.attributes.aMat || element.setAttribute("aMat", new BufferAttribute(new Uint8Array(element.attributes.position.count * 4), 4, !0)),
      this.allocate(),
      (this.material = createUnitMaterial(this.tex, materialOptions, meshName)),
      (this.depth = createUnitSkinMaterial(this.tex)))
    const unitMesh = new Mesh(this.geo, this.material)
    if (
      ((unitMesh.name = meshName),
      (unitMesh.customDepthMaterial = this.depth),
      (unitMesh.castShadow = !0),
      (unitMesh.receiveShadow = !0),
      (unitMesh.frustumCulled = !1),
      (unitMesh.matrixAutoUpdate = !1),
      (unitMesh.visible = !1),
      (unitMesh.renderOrder = 2),
      (this.mesh = unitMesh),
      this.wantXray)
    ) {
      this.xrayMat = createXrayMaterial(this.tex)
      const xrayMesh = new Mesh(this.geo, this.xrayMat)
      ;((xrayMesh.name = `${meshName}:xray`), (xrayMesh.frustumCulled = !1), (xrayMesh.matrixAutoUpdate = !1), (xrayMesh.visible = !1), (xrayMesh.renderOrder = 1), (this.xray = xrayMesh))
    }
    const outlineWidth = materialOptions.outline ?? 0
    if (outlineWidth > 0) {
      this.outlineMat = createOutlineMaterial(this.tex, outlineWidth, materialOptions.outlineColor ?? 1778227)
      const outlineMesh = new Mesh(this.geo, this.outlineMat)
      ;((outlineMesh.name = `${meshName}:outline`), (outlineMesh.frustumCulled = !1), (outlineMesh.matrixAutoUpdate = !1), (outlineMesh.visible = !1), (outlineMesh.renderOrder = 2), (this.outline = outlineMesh))
    }
  }
  addTo(targetScene) {
    ;(targetScene.add(this.mesh), this.outline && targetScene.add(this.outline), this.xray && targetScene.add(this.xray))
  }
  removeFrom(sourceScene) {
    ;(sourceScene.remove(this.mesh), this.outline && sourceScene.remove(this.outline), this.xray && sourceScene.remove(this.xray))
  }
  setOutlineVisible(targetObject) {
    this.outlineOn = targetObject
  }
  setXrayVisible(xrayVisible) {
    this.xrayOn = xrayVisible
  }
  outlineOn = !0
  allocate() {
    const bufferCapacity = this.capacity,
      instancedBufferGeometry = new InstancedBufferGeometry(),
      sourceGeometry = this.source
    instancedBufferGeometry.setIndex(sourceGeometry.index)
    for (const positionnormalcoloraFxaMataSkinaOutline of ["position", "normal", "color", "aFx", "aMat", "aSkin", "aOutline"]) instancedBufferGeometry.setAttribute(positionnormalcoloraFxaMataSkinaOutline, sourceGeometry.attributes[positionnormalcoloraFxaMataSkinaOutline])
    ;((this.instA = new InstancedBufferAttribute(new Float32Array(bufferCapacity * 4), 4)),
      (this.instTeam = new InstancedBufferAttribute(new Float32Array(bufferCapacity * 3), 3)),
      (this.instTint = new InstancedBufferAttribute(new Float32Array(bufferCapacity * 4), 4)),
      (this.instBody = new InstancedBufferAttribute(new Float32Array(bufferCapacity * 3).fill(1), 3)),
      this.instBody.setUsage(DynamicDrawUsage),
      this.instA.setUsage(DynamicDrawUsage),
      this.instTeam.setUsage(DynamicDrawUsage),
      this.instTint.setUsage(DynamicDrawUsage),
      instancedBufferGeometry.setAttribute("aInstA", this.instA),
      instancedBufferGeometry.setAttribute("aInstTeam", this.instTeam),
      instancedBufferGeometry.setAttribute("aInstTint", this.instTint),
      instancedBufferGeometry.setAttribute("aInstBody", this.instBody),
      this.wantXray && ((this.instX = new InstancedBufferAttribute(new Float32Array(bufferCapacity * 4), 4)), this.instX.setUsage(DynamicDrawUsage), instancedBufferGeometry.setAttribute("aInstX", this.instX)),
      (instancedBufferGeometry.instanceCount = 0),
      (this.geo = instancedBufferGeometry),
      (this.data = new Float32Array(this.bones * 8 * bufferCapacity)))
    const boneTexture = new DataTexture(this.data, this.bones * 2, bufferCapacity, RGBAFormat, FloatType)
    ;((boneTexture.minFilter = boneTexture.magFilter = NearestFilter), (boneTexture.generateMipmaps = !1), (boneTexture.needsUpdate = !0), (this.tex = boneTexture))
  }
  grow() {
    const lookupKey = this.data,
      arrayValue = this.instA.array,
      teamColorArray = this.instTeam.array,
      tintColorArray = this.instTint.array,
      bodyColorArray = this.instBody.array,
      xrayColorArray = this.instX ? this.instX.array : null,
      geoState = this.geo,
      texState = this.tex
    ;((this.capacity *= 2),
      this.allocate(),
      this.data.set(lookupKey),
      this.instA.array.set(arrayValue),
      this.instTeam.array.set(teamColorArray),
      this.instTint.array.set(tintColorArray),
      this.instBody.array.set(bodyColorArray),
      this.instX && xrayColorArray && this.instX.array.set(xrayColorArray),
      (this.mesh.geometry = this.geo),
      (this.material.uniforms.uBones.value = this.tex),
      (this.depth.uniforms.uBones.value = this.tex),
      this.outline && this.outlineMat && ((this.outline.geometry = this.geo), (this.outlineMat.uniforms.uBones.value = this.tex)),
      this.xray && this.xrayMat && ((this.xray.geometry = this.geo), (this.xrayMat.uniforms.uBones.value = this.tex)),
      geoState.dispose(),
      texState.dispose())
  }
  begin() {
    this.count = 0
  }
  push(candidateUnit, unitAppearance) {
    this.count >= this.capacity && this.grow()
    const instanceIndex = this.count++
    candidateUnit.pack(this.data, instanceIndex * this.bones * 8)
    const effectArray = this.instA.array
    ;((effectArray[instanceIndex * 4] = unitAppearance.opacity), (effectArray[instanceIndex * 4 + 1] = unitAppearance.flash), (effectArray[instanceIndex * 4 + 2] = unitAppearance.glow), (effectArray[instanceIndex * 4 + 3] = unitAppearance.rim))
    const teamColorBuffer = this.instTeam.array
    ;((teamColorBuffer[instanceIndex * 3] = unitAppearance.team.r), (teamColorBuffer[instanceIndex * 3 + 1] = unitAppearance.team.g), (teamColorBuffer[instanceIndex * 3 + 2] = unitAppearance.team.b))
    const tintColorBuffer = this.instTint.array
    ;((tintColorBuffer[instanceIndex * 4] = unitAppearance.tint.r), (tintColorBuffer[instanceIndex * 4 + 1] = unitAppearance.tint.g), (tintColorBuffer[instanceIndex * 4 + 2] = unitAppearance.tint.b), (tintColorBuffer[instanceIndex * 4 + 3] = unitAppearance.tintAmount))
    const bodyColorBuffer = this.instBody.array
    if (((bodyColorBuffer[instanceIndex * 3] = unitAppearance.body.r), (bodyColorBuffer[instanceIndex * 3 + 1] = unitAppearance.body.g), (bodyColorBuffer[instanceIndex * 3 + 2] = unitAppearance.body.b), this.instX)) {
      const xrayColorBuffer = this.instX.array
      ;((xrayColorBuffer[instanceIndex * 4] = unitAppearance.xray.r), (xrayColorBuffer[instanceIndex * 4 + 1] = unitAppearance.xray.g), (xrayColorBuffer[instanceIndex * 4 + 2] = unitAppearance.xray.b), (xrayColorBuffer[instanceIndex * 4 + 3] = unitAppearance.xrayAmount))
    }
  }
  end() {
    const instanceCount = this.count
    ;((this.mesh.visible = instanceCount > 0),
      this.outline && (this.outline.visible = instanceCount > 0 && this.outlineOn),
      this.xray && (this.xray.visible = instanceCount > 0 && this.xrayOn),
      (this.geo.instanceCount = instanceCount),
      instanceCount !== 0 &&
        ((this.tex.needsUpdate = !0),
        (this.instA.needsUpdate = !0),
        (this.instTeam.needsUpdate = !0),
        (this.instTint.needsUpdate = !0),
        (this.instBody.needsUpdate = !0),
        this.instX && (this.instX.needsUpdate = !0)))
  }
  setShadows(castShadow) {
    this.mesh.castShadow = castShadow
  }
  dispose() {
    ;(this.geo.dispose(), this.tex.dispose(), patternedMaterials.delete(this.material), this.material.dispose(), this.depth.dispose(), this.outlineMat?.dispose(), this.xrayMat?.dispose())
  }
}

const SCENE_DEG_TO_RAD = Math.PI / 180,
  CAMERA_BASE_PITCH_DEG = 46,
  CAMERA_FOV_DEG = 32,
  CAMERA_BASE_DISTANCE = 27.5,
  PROJECTION_SCALE = 1 / Math.tan(CAMERA_BASE_PITCH_DEG * SCENE_DEG_TO_RAD),
  CAMERA_MAX_PITCH_DEG = 54,
  CAMERA_MIN_VIEW_HALF_HEIGHT = 7.5,
  CAMERA_MAX_FOV_DEG = 44,
  CAMERA_LEAD_BASE = 0.07,
  CAMERA_LEAD_TALL = 0.14,
  CAMERA_BOUND_NEAR_BASE = 0.42,
  CAMERA_BOUND_NEAR_TALL = 0.6,
  CAMERA_BOUND_FAR_BASE = 0.5,
  CAMERA_BOUND_FAR_TALL = 0.35,
  CAMERA_HALF_WIDTH_LIMIT = 0.5,
  CAMERA_REACH_NEAR_LIMIT = 0.8,
  CAMERA_REACH_FAR_BASE = 0.66,
  CAMERA_REACH_FAR_TALL = 0.35,
  CAMERA_REACH_WIDTH_FACTOR = 0.86,
  CAMERA_PEEK_MAX_GROUND = 0.4,
  CAMERA_REACH_WIDTH_LIMIT = 0.6,
  CAMERA_POINTER_PAN_MIN_RATIO = -0.1,
  CAMERA_POINTER_PAN_BASE = 0.72,
  CAMERA_POINTER_PAN_TALL = 0.35,
  CAMERA_TALL_FOCUS_OFFSET = 2.6,
  CAMERA_TALL_DISTANCE_SWELL = 0.13

class CameraRig {
  camera
  shakeEnabled = !0
  bounds = { minX: -57.5, maxX: 57.5, minZ: -57.5, maxZ: 57.5 }
  pitch = CAMERA_BASE_PITCH_DEG * SCENE_DEG_TO_RAD
  distance = CAMERA_BASE_DISTANCE
  lead = 0
  tall = 0
  tanHalf = Math.tan((CAMERA_FOV_DEG / 2) * SCENE_DEG_TO_RAD)
  reach = null
  reachX = 0
  reachZ = 0
  pointerPan = 0
  tallWant = 0
  tallK = 0
  aspect = 16 / 9
  follow = new Vector3()
  peek = null
  focus = new Vector3()
  snapped = !1
  trauma = 0
  shakeTime = 0
  topView = !1
  topHalf = 76
  override = null
  constructor() {
    ;((this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, this.aspect, 1, 900)), this.camera.up.set(0, 1, 0), this.applyLens())
  }
  setAspect(aspectRatio) {
    ;((this.aspect = aspectRatio > 0 ? aspectRatio : 16 / 9), this.applyLens())
  }
  applyLens() {
    const camera = this.camera
    if (((camera.aspect = this.aspect), this.topView)) {
      camera.fov = 30
      const topViewHalfFovTangent = Math.tan((camera.fov / 2) * SCENE_DEG_TO_RAD)
      ;((this.distance = (this.topHalf * 1.04) / (topViewHalfFovTangent * Math.min(1, this.aspect))), (this.pitch = 89.9 * SCENE_DEG_TO_RAD), (this.lead = 0), (camera.near = 20), (camera.far = this.distance + 300))
    } else if (this.override) ((camera.fov = this.override.fov), (this.pitch = this.override.pitch * SCENE_DEG_TO_RAD), (this.distance = this.override.distance), (this.lead = 0), (camera.near = 1), (camera.far = 1600))
    else {
      const portraitFactor = Math.min(1, Math.max(0, (1 - this.aspect) / 0.4))
      let cAMERA_FOV_DEG = CAMERA_FOV_DEG,
        cAMERA_BASE_DISTANCE = CAMERA_BASE_DISTANCE
      const minViewHalfHeight = CAMERA_MIN_VIEW_HALF_HEIGHT / this.aspect
      ;(cAMERA_BASE_DISTANCE * Math.tan((cAMERA_FOV_DEG / 2) * SCENE_DEG_TO_RAD) < minViewHalfHeight && ((cAMERA_FOV_DEG = Math.min(CAMERA_MAX_FOV_DEG, (Math.atan(minViewHalfHeight / cAMERA_BASE_DISTANCE) * 2) / SCENE_DEG_TO_RAD)), (cAMERA_BASE_DISTANCE = Math.max(cAMERA_BASE_DISTANCE, minViewHalfHeight / Math.tan((cAMERA_FOV_DEG / 2) * SCENE_DEG_TO_RAD)))),
        (camera.fov = cAMERA_FOV_DEG),
        (this.tall = portraitFactor),
        (this.distance = cAMERA_BASE_DISTANCE),
        (this.pitch = (CAMERA_BASE_PITCH_DEG + (CAMERA_MAX_PITCH_DEG - CAMERA_BASE_PITCH_DEG) * portraitFactor) * SCENE_DEG_TO_RAD),
        (this.tanHalf = Math.tan((cAMERA_FOV_DEG / 2) * SCENE_DEG_TO_RAD)),
        (this.lead = this.groundZ(CAMERA_LEAD_BASE + (CAMERA_LEAD_TALL - CAMERA_LEAD_BASE) * portraitFactor)),
        (camera.near = 2),
        (camera.far = 900))
    }
    camera.updateProjectionMatrix()
  }
  groundZ(groundRatio) {
    const scaledTangent = groundRatio * this.tanHalf
    return (-scaledTangent * this.distance) / (Math.sin(this.pitch) - scaledTangent * Math.cos(this.pitch))
  }
  halfWidthAt(groundOffset) {
    return (this.distance - groundOffset * Math.cos(this.pitch)) * this.tanHalf * this.aspect
  }
  setReach(lookupKey, propertyName = 0) {
    lookupKey === null ? (this.reach = null) : (this.reach ??= new Vector3()).set(lookupKey, 0, propertyName)
  }
  /**
   * 设置指针与坐标。
   *
   * @param pointerX - 目标
   * @param pointerDistance - 输入
  */
  setPointerReach(pointerX, pointerDistance = 0) {
    if (pointerX === null) {
      this.pointerPan = 0
      return
    }
    const panMinGroundRatio = -(CAMERA_POINTER_PAN_BASE + (CAMERA_POINTER_PAN_TALL - CAMERA_POINTER_PAN_BASE) * this.tall),
      panGroundOffset = this.groundZ(panMinGroundRatio) - this.lead,
      pointerGroundReach = Math.max(0, pointerDistance - panGroundOffset),
      panWeight = Math.min(1, Math.max(0, (CAMERA_POINTER_PAN_MIN_RATIO - pointerX) / (CAMERA_POINTER_PAN_MIN_RATIO - panMinGroundRatio)))
    this.pointerPan = pointerGroundReach * panWeight * panWeight * (3 - 2 * panWeight)
  }
  setTallFocus(desiredTall) {
    this.tallWant = Math.max(0, desiredTall)
  }
  setTopView(topViewEnabled, topViewHalfHeight = 76) {
    ;((this.topView = topViewEnabled), (this.topHalf = topViewHalfHeight), this.applyLens(), (this.snapped = !1))
  }
  get isTopView() {
    return this.topView
  }
  get isDebugView() {
    return this.topView || this.override !== null
  }
  setOverride(cameraOverride) {
    ;((this.override = cameraOverride ? { pitch: cameraOverride.pitch, distance: cameraOverride.distance, yaw: cameraOverride.yaw ?? 0, fov: cameraOverride.fov ?? CAMERA_FOV_DEG } : null), this.applyLens(), (this.snapped = !1))
  }
  setFollow(lookupKey, followZ) {
    this.follow.set(lookupKey, 0, followZ)
  }
  setPeek(lookupKey, peekZ = 0) {
    lookupKey === null ? (this.peek = null) : (this.peek ??= new Vector3()).set(lookupKey, 0, peekZ)
  }
  snap() {
    this.snapped = !1
  }
  shake(shakeSkill) {
    this.shakeEnabled && (this.trauma = Math.min(1, this.trauma + shakeSkill))
  }
  getFocus(outFocus) {
    return outFocus.copy(this.focus)
  }
  getDistance() {
    return this.distance
  }
  update(deltaTime) {
    const sceneCamera = this.camera,
      cameraBounds = this.bounds
    let lookupKey, total
    if (this.topView) ((lookupKey = 0), (total = 0))
    else {
      const focusAnchor = this.peek ?? this.follow
      if (((lookupKey = focusAnchor.x), (total = focusAnchor.z - (this.peek ? 0 : this.lead)), !this.override)) {
        let targetReachX = 0,
          targetReachZ = 0
        if (this.reach && !this.peek) {
          const reachXDelta = this.reach.x - lookupKey,
            reachZDelta = this.reach.z - total,
            groundZResult = this.groundZ(CAMERA_REACH_NEAR_LIMIT),
            farReachGroundZ = this.groundZ(-(CAMERA_REACH_FAR_BASE + (CAMERA_REACH_FAR_TALL - CAMERA_REACH_FAR_BASE) * this.tall))
          ;((targetReachZ = reachZDelta - Math.min(farReachGroundZ, Math.max(groundZResult, reachZDelta))), (targetReachZ = Math.min(this.lead - this.groundZ(CAMERA_PEEK_MAX_GROUND), Math.max(this.lead - this.groundZ(-0.5), targetReachZ))))
          const reachWindowHalfWidth = this.halfWidthAt(reachZDelta - targetReachZ) * CAMERA_REACH_WIDTH_FACTOR
          targetReachX = reachXDelta - Math.min(reachWindowHalfWidth, Math.max(-reachWindowHalfWidth, reachXDelta))
          const reachWidthLimit = this.halfWidthAt(this.lead - targetReachZ) * CAMERA_REACH_WIDTH_LIMIT
          targetReachX = Math.min(reachWidthLimit, Math.max(-reachWidthLimit, targetReachX))
        } else this.pointerPan > 0 && !this.peek && (targetReachZ = Math.min(this.lead - this.groundZ(CAMERA_PEEK_MAX_GROUND), this.pointerPan))
        const smoothFactor = this.snapped ? 1 - Math.exp(-(this.reach || this.pointerPan > 0 ? 7 : 5) * deltaTime) : 1
        ;((this.reachX += (targetReachX - this.reachX) * smoothFactor), (this.reachZ += (targetReachZ - this.reachZ) * smoothFactor))
        const targetTallK = this.reach || this.pointerPan > 0 || this.peek ? 0 : this.tallWant
        ;((this.tallK += (targetTallK - this.tallK) * (this.snapped ? 1 - Math.exp(-6 * deltaTime) : 1)), this.peek || ((lookupKey += this.reachX), (total += this.reachZ - CAMERA_TALL_FOCUS_OFFSET * this.tallK)))
        const tallState = this.tall,
          boundsHalfWidth = this.halfWidthAt(0) * CAMERA_HALF_WIDTH_LIMIT,
          nearBoundMargin = -this.groundZ(CAMERA_BOUND_NEAR_BASE + (CAMERA_BOUND_NEAR_TALL - CAMERA_BOUND_NEAR_BASE) * tallState),
          farBoundMargin = this.groundZ(-(CAMERA_BOUND_FAR_BASE + (CAMERA_BOUND_FAR_TALL - CAMERA_BOUND_FAR_BASE) * tallState))
        ;((lookupKey = Math.min(Math.max(cameraBounds.maxX - boundsHalfWidth, 0), Math.max(Math.min(cameraBounds.minX + boundsHalfWidth, 0), lookupKey))), (total = Math.min(Math.max(cameraBounds.maxZ - farBoundMargin, 0), Math.max(Math.min(cameraBounds.minZ + nearBoundMargin, 0), total))))
      }
    }
    if (!this.snapped) (this.focus.set(lookupKey, 0, total), (this.snapped = !0))
    else {
      const focusXDelta = lookupKey - this.focus.x,
        focusZDelta = total - this.focus.z
      if (focusXDelta * focusXDelta + focusZDelta * focusZDelta > 2025) this.focus.set(lookupKey, 0, total)
      else {
        const focusSmoothFactor = 1 - Math.exp(-(this.peek ? 14 : 9) * deltaTime)
        ;((this.focus.x += focusXDelta * focusSmoothFactor), (this.focus.z += focusZDelta * focusSmoothFactor))
      }
    }
    const viewYaw = this.override ? this.override.yaw * SCENE_DEG_TO_RAD : 0,
      cameraDistance = this.topView || this.override ? this.distance : this.distance * (1 + CAMERA_TALL_DISTANCE_SWELL * this.tallK),
      horizontalRadius = Math.cos(this.pitch) * cameraDistance,
      cameraHeight = Math.sin(this.pitch) * cameraDistance
    if (
      (sceneCamera.position.set(this.focus.x + Math.sin(viewYaw) * horizontalRadius, cameraHeight, this.focus.z + Math.cos(viewYaw) * horizontalRadius),
      sceneCamera.up.set(0, 1, 0),
      this.topView && sceneCamera.up.set(0, 0, -1),
      sceneCamera.lookAt(this.focus.x, 0, this.focus.z),
      this.trauma > 0)
    ) {
      this.shakeTime += deltaTime
      const shakeTime = this.shakeTime,
        traumaSquared = this.trauma * this.trauma,
        shakeOffsetX = Math.sin(shakeTime * 61.3) * 0.6 + Math.sin(shakeTime * 37.1 + 1.3) * 0.4,
        shakeOffsetY = Math.sin(shakeTime * 53.7 + 2.1) * 0.6 + Math.sin(shakeTime * 29.9 + 0.4) * 0.4,
        shakeRoll = Math.sin(shakeTime * 44.3 + 4.2),
        shakeScale = (this.distance * Math.tan((sceneCamera.fov / 2) * SCENE_DEG_TO_RAD) * Math.min(1, this.aspect)) / 10.4
      ;(sceneCamera.translateX(shakeOffsetX * traumaSquared * 0.55 * shakeScale), sceneCamera.translateY(shakeOffsetY * traumaSquared * 0.45 * shakeScale), sceneCamera.rotateZ(shakeRoll * traumaSquared * 0.012), (this.trauma = Math.max(0, this.trauma - deltaTime * 2.4)))
    }
    sceneCamera.updateMatrixWorld()
  }
}

function disposeSceneResources(scene) {
  const texturesToDispose = new Set<Texture>(),
    materialsToDispose = new Set<Material & { uniforms?: Record<string, { value: unknown }> }>()
  scene.traverse((sceneObject) => {
    const disposableObject = sceneObject
    disposableObject.geometry?.dispose()
    const materialList = Array.isArray(disposableObject.material) ? disposableObject.material : disposableObject.material ? [disposableObject.material] : []
    for (const materialItem of materialList) materialsToDispose.add(materialItem)
    sceneObject.dispose?.()
  })
  for (const material of materialsToDispose) {
    const materialUniforms = material.uniforms
    if (materialUniforms)
      for (const uniformName in materialUniforms) {
        const uniformTexture = materialUniforms[uniformName].value
        uniformTexture instanceof Texture && texturesToDispose.add(uniformTexture)
      }
    for (const valuesitem of Object.values(material)) valuesitem instanceof Texture && texturesToDispose.add(valuesitem)
    material.dispose()
  }
  for (const texture of texturesToDispose) texture.dispose()
}

const GL_TIME_ELAPSED_EXT = 35007,
  GL_GPU_DISJOINT_EXT = 36795,
  GPU_TIMING_WINDOW_FRAMES = 60,
  GPU_TIMER_STATE = { timer: null },
  GPU_TIMER_PATCHED_RENDERERS = new WeakSet()

class GpuTimer {
  timings = { supported: !1, shadow: 0, scene: 0, post: 0, total: 0, windows: 0 }
  gl
  active = null
  pending = []
  sums = { shadow: 0, scene: 0, post: 0 }
  frames = 0
  dirty = !1
  constructor(lookupKey) {
    this.gl = lookupKey.getContext()
    let isActive = !1
    try {
      isActive = typeof this.gl.createQuery == "function" && this.gl.getExtension("EXT_disjoint_timer_query_webgl2") !== null
    } catch {
      isActive = !1
    }
    if (((this.timings.supported = isActive), !isActive)) {
      console.info("[moba] GPU 计时不可用：这台设备/浏览器没有 EXT_disjoint_timer_query_webgl2")
      return
    }
    if (!GPU_TIMER_PATCHED_RENDERERS.has(lookupKey)) {
      GPU_TIMER_PATCHED_RENDERERS.add(lookupKey)
      const rendererShadowMap = lookupKey.shadowMap,
        originalShadowRender = rendererShadowMap.render
      rendererShadowMap.render = function (...renderArgs) {
        const activeTimer = GPU_TIMER_STATE.timer
        if (!activeTimer) {
          originalShadowRender.apply(rendererShadowMap, renderArgs)
          return
        }
        ;(activeTimer.begin("shadow"), originalShadowRender.apply(rendererShadowMap, renderArgs), activeTimer.begin("scene"))
      }
    }
  }
  attach(ownerId) {
    ownerId ? (GPU_TIMER_STATE.timer = this) : GPU_TIMER_STATE.timer === this && (GPU_TIMER_STATE.timer = null)
  }
  begin(segmentName) {
    if (!this.timings.supported) return
    if (this.active) {
      if (this.active.seg === segmentName) return
      this.end()
    }
    const glState = this.gl,
      QueryValue = glState.createQuery()
    QueryValue && (glState.beginQuery(GL_TIME_ELAPSED_EXT, QueryValue), (this.active = { query: QueryValue, seg: segmentName }))
  }
  end() {
    this.active && (this.gl.endQuery(GL_TIME_ELAPSED_EXT), this.pending.push(this.active), (this.active = null))
  }
  frameEnd() {
    if (!this.timings.supported) return
    this.end()
    const glValue = this.gl,
      ParameterValue = glValue.getParameter(GL_GPU_DISJOINT_EXT)
    for (ParameterValue && (this.dirty = !0); this.pending.length > 0;) {
      const selectedPending = this.pending[0]
      if (!glValue.getQueryParameter(selectedPending.query, glValue.QUERY_RESULT_AVAILABLE)) break
      const QueryParameterValue = glValue.getQueryParameter(selectedPending.query, glValue.QUERY_RESULT)
      ;(glValue.deleteQuery(selectedPending.query), this.pending.shift(), ParameterValue || (this.sums[selectedPending.seg] += QueryParameterValue))
    }
    for (; this.pending.length > 600;) {
      const shiftResult = this.pending.shift()
      shiftResult && glValue.deleteQuery(shiftResult.query)
    }
    if (++this.frames < GPU_TIMING_WINDOW_FRAMES) return
    const timingStats = this.timings
    if (!this.dirty) {
      const nanosToMs = 1e-6 / this.frames
      ;((timingStats.shadow = this.sums.shadow * nanosToMs),
        (timingStats.scene = this.sums.scene * nanosToMs),
        (timingStats.post = this.sums.post * nanosToMs),
        (timingStats.total = timingStats.shadow + timingStats.scene + timingStats.post),
        timingStats.windows++,
        console.info(`[moba] GPU ms/帧 阴影 ${timingStats.shadow.toFixed(2)} · 场景 ${timingStats.scene.toFixed(2)} · 后期 ${timingStats.post.toFixed(2)} · 合计 ${timingStats.total.toFixed(2)}`))
    }
    ;((this.sums.shadow = this.sums.scene = this.sums.post = 0), (this.frames = 0), (this.dirty = !1))
  }
  dispose() {
    if ((this.attach(!1), !!this.timings.supported)) {
      this.active && (this.gl.endQuery(GL_TIME_ELAPSED_EXT), this.gl.deleteQuery(this.active.query), (this.active = null))
      for (const pendingQuery of this.pending) this.gl.deleteQuery(pendingQuery.query)
      this.pending.length = 0
    }
  }
}

function isGpuTimingEnabled() {
  try {
    return typeof location < "u" && new URLSearchParams(location.search).get("gpuTimings") === "1"
  } catch {
    return !1
  }
}

const SUN_DIRECTION = new Vector3(-0.66, 1, 0.36).normalize(),
  SUN_GROUND_DIRECTION = new Vector2(-SUN_DIRECTION.x, -SUN_DIRECTION.z).normalize(),
  SUN_HEIGHT_RATIO = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z) / SUN_DIRECTION.y,
  SUN_INTENSITY = 3.1,
  HEMI_INTENSITY = 1.45,
  HEMI_GROUND_MULTIPLIER = 2,
  SHADOW_FIT_ALT_GROUND_Y = 10,
  SHADOW_FIT_MAX_RAY_LENGTH = 160,
  SHADOW_FIT_NDC_CORNERS = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
  LIGHT_TARGET_SCRATCH = new Vector3(),
  LIGHT_UNPROJECT_SCRATCH = new Vector3(),
  LIGHT_CORNER_SCRATCH = new Vector3(),
  SUN_RIGHT_AXIS = new Vector3().crossVectors(new Vector3(0, 1, 0), SUN_DIRECTION).normalize(),
  SUN_UP_AXIS = new Vector3().crossVectors(SUN_DIRECTION, SUN_RIGHT_AXIS).normalize()

class LightRig {
  sun
  hemi
  pulses = []
  scene
  mapSize = 0
  constructor(lightScene) {
    ;((this.scene = lightScene),
      (this.sun = new DirectionalLight(ARENA_PALETTE.env.sun, SUN_INTENSITY)),
      this.sun.position.copy(SUN_DIRECTION).multiplyScalar(80),
      (this.sun.shadow.bias = -5e-4),
      (this.sun.shadow.normalBias = 0.06),
      lightScene.add(this.sun),
      lightScene.add(this.sun.target),
      (this.hemi = new HemisphereLight(ARENA_PALETTE.env.sky, ARENA_PALETTE.env.bounce, HEMI_INTENSITY)),
      this.hemi.groundColor.multiplyScalar(HEMI_GROUND_MULTIPLIER),
      lightScene.add(this.hemi))
  }
  applyQuality(qualitySettings) {
    ;((this.sun.castShadow = qualitySettings.shadows),
      qualitySettings.shadows &&
        qualitySettings.shadowMapSize !== this.mapSize &&
        ((this.mapSize = qualitySettings.shadowMapSize), this.sun.shadow.mapSize.set(qualitySettings.shadowMapSize, qualitySettings.shadowMapSize), this.sun.shadow.map?.dispose(), (this.sun.shadow.map = null)))
    const usePcfSoftShadows = qualitySettings.shadowType === "pcf"
    for (this.sun.shadow.radius = usePcfSoftShadows ? qualitySettings.shadowRadius : 1, this.sun.shadow.bias = usePcfSoftShadows ? -6e-4 : -5e-4, this.sun.shadow.normalBias = usePcfSoftShadows ? 0.07 : 0.06; this.pulses.length > qualitySettings.pointLights;) {
      const popResult = this.pulses.pop()
      popResult && this.scene.remove(popResult.light)
    }
    for (; this.pulses.length < qualitySettings.pointLights;) {
      const pulseLight = new PointLight(16777215, 0, 10, 1.6)
      ;(pulseLight.position.set(0, -50, 0), this.scene.add(pulseLight), this.pulses.push({ light: pulseLight, life: 0, duration: 1, peak: 0 }))
    }
  }
  pulse(lookupKey, pulseDepth, pulseHeight, pulseColor, pulsePeakIntensity, pulseLightRange, pulseDuration) {
    if (this.pulses.length === 0) return
    let selectedPulses = this.pulses[0]
    for (const candidatePulse of this.pulses) candidatePulse.life < selectedPulses.life && (selectedPulses = candidatePulse)
    ;(selectedPulses.light.position.set(lookupKey, pulseHeight, pulseDepth), selectedPulses.light.color.set(pulseColor), (selectedPulses.light.distance = pulseLightRange), (selectedPulses.peak = pulsePeakIntensity), (selectedPulses.duration = Math.max(0.05, pulseDuration)), (selectedPulses.life = selectedPulses.duration), (selectedPulses.light.intensity = pulsePeakIntensity))
  }
  update(frameDelta) {
    for (const activePulse of this.pulses) {
      if (activePulse.life <= 0) continue
      activePulse.life -= frameDelta
      const pulseLifeRatio = Math.max(0, activePulse.life / activePulse.duration)
      ;((activePulse.light.intensity = activePulse.peak * pulseLifeRatio * pulseLifeRatio), activePulse.life <= 0 && ((activePulse.light.intensity = 0), (activePulse.light.position.y = -50)))
    }
  }
  fitShadow(inputCamera) {
    if (!this.sun.castShadow) return
    let rightDotMin = 1 / 0,
      rightDotMax = -1 / 0,
      upDotMin = 1 / 0,
      upDotMax = -1 / 0,
      depthDotMin = 1 / 0,
      depthDotMax = -1 / 0
    LIGHT_TARGET_SCRATCH.setFromMatrixPosition(inputCamera.matrixWorld)
    const maxRayLength = Math.max(SHADOW_FIT_MAX_RAY_LENGTH, LIGHT_TARGET_SCRATCH.y * 2.5)
    for (const [lookupKey, cornerNdcY] of SHADOW_FIT_NDC_CORNERS) {
      LIGHT_UNPROJECT_SCRATCH.set(lookupKey, cornerNdcY, 0.5).unproject(inputCamera).sub(LIGHT_TARGET_SCRATCH).normalize()
      for (let index = 0; index < 2; index++) {
        const groundY = index === 0 ? 0 : SHADOW_FIT_ALT_GROUND_Y
        let rayDistance = LIGHT_UNPROJECT_SCRATCH.y < -1e-4 ? (groundY - LIGHT_TARGET_SCRATCH.y) / LIGHT_UNPROJECT_SCRATCH.y : maxRayLength
        ;((rayDistance < 0 || rayDistance > maxRayLength) && (rayDistance = rayDistance < 0 ? 0 : maxRayLength), LIGHT_CORNER_SCRATCH.copy(LIGHT_UNPROJECT_SCRATCH).multiplyScalar(rayDistance).add(LIGHT_TARGET_SCRATCH))
        const dotResult = LIGHT_CORNER_SCRATCH.dot(SUN_RIGHT_AXIS),
          cornerUpProjection = LIGHT_CORNER_SCRATCH.dot(SUN_UP_AXIS),
          cornerDepthDot = LIGHT_CORNER_SCRATCH.dot(SUN_DIRECTION)
        ;(dotResult < rightDotMin && (rightDotMin = dotResult), dotResult > rightDotMax && (rightDotMax = dotResult), cornerUpProjection < upDotMin && (upDotMin = cornerUpProjection), cornerUpProjection > upDotMax && (upDotMax = cornerUpProjection), cornerDepthDot < depthDotMin && (depthDotMin = cornerDepthDot), cornerDepthDot > depthDotMax && (depthDotMax = cornerDepthDot))
      }
    }
    const shadowSpan = Math.ceil(Math.max(rightDotMax - rightDotMin, upDotMax - upDotMin) / 4 + 0.25) * 4,
      shadowHalfSpan = shadowSpan / 2,
      worldPerTexel = shadowSpan / Math.max(1, this.sun.shadow.mapSize.x),
      targetRightOffset = Math.round((rightDotMin + rightDotMax) / 2 / worldPerTexel) * worldPerTexel,
      targetUpOffset = Math.round((upDotMin + upDotMax) / 2 / worldPerTexel) * worldPerTexel,
      targetDirectionOffset = (depthDotMin + depthDotMax) / 2,
      sunDistance = Math.ceil(((depthDotMax - depthDotMin) / 2 + 60) / 4) * 4,
      sunState = this.sun
    ;(sunState.target.position.set(0, 0, 0).addScaledVector(SUN_RIGHT_AXIS, targetRightOffset).addScaledVector(SUN_UP_AXIS, targetUpOffset).addScaledVector(SUN_DIRECTION, targetDirectionOffset), sunState.position.copy(sunState.target.position).addScaledVector(SUN_DIRECTION, sunDistance), sunState.target.updateMatrixWorld())
    const shadowCamera = sunState.shadow.camera
    ;(shadowCamera.right !== shadowHalfSpan || shadowCamera.far !== sunDistance * 2 + 20) && ((shadowCamera.left = -shadowHalfSpan), (shadowCamera.right = shadowHalfSpan), (shadowCamera.top = shadowHalfSpan), (shadowCamera.bottom = -shadowHalfSpan), (shadowCamera.near = 1), (shadowCamera.far = sunDistance * 2 + 20), shadowCamera.updateProjectionMatrix())
  }
  dispose() {
    ;(this.sun.shadow.map?.dispose(), this.scene.remove(this.sun, this.sun.target, this.hemi))
    for (const pulseEntry of this.pulses) this.scene.remove(pulseEntry.light)
    this.pulses.length = 0
  }
}

const BLUR_TEMP_SIZE = 128,
  DECAL_COLOR_SCRATCH = new Color()

function blurImageTwice(sourcePixels, destPixels, blurBuffer, imageWidth, channelCount) {
  const lastIndex = imageWidth - 1
  for (let index = 0; index < imageWidth; index++)
    for (let column = 0; column < imageWidth; column++) {
      const prevColumn = column > 0 ? column - 1 : 0,
        nextColumn = column < lastIndex ? column + 1 : lastIndex
      for (let channel = 0; channel < channelCount; channel++) blurBuffer[(index * imageWidth + column) * channelCount + channel] = (sourcePixels[(index * imageWidth + prevColumn) * channelCount + channel] + sourcePixels[(index * imageWidth + column) * channelCount + channel] * 2 + sourcePixels[(index * imageWidth + nextColumn) * channelCount + channel]) * 0.25
    }
  for (let row = 0; row < imageWidth; row++) {
    const prevRow = row > 0 ? row - 1 : 0,
      nextRow = row < lastIndex ? row + 1 : lastIndex
    for (let columnCursor = 0; columnCursor < imageWidth; columnCursor++) for (let channelCursor = 0; channelCursor < channelCount; channelCursor++) destPixels[(row * imageWidth + columnCursor) * channelCount + channelCursor] = (blurBuffer[(prevRow * imageWidth + columnCursor) * channelCount + channelCursor] + blurBuffer[(row * imageWidth + columnCursor) * channelCount + channelCursor] * 2 + blurBuffer[(nextRow * imageWidth + columnCursor) * channelCount + channelCursor]) * 0.25
  }
}

class DecalLayer {
  texture
  size = BLUR_TEMP_SIZE
  rgb
  occ
  bakedRgb
  bakedOcc
  bytes
  stamps = 0
  constructor() {
    const pixelCount = BLUR_TEMP_SIZE * BLUR_TEMP_SIZE
    ;((this.rgb = new Float32Array(pixelCount * 3)), (this.occ = new Float32Array(pixelCount)), (this.bakedRgb = new Float32Array(pixelCount * 3)), (this.bakedOcc = new Float32Array(pixelCount)), (this.bytes = new Uint8Array(pixelCount * 4)))
    for (let index = 0; index < pixelCount; index++) this.bytes[index * 4 + 3] = 255
    const dataTexture = new DataTexture(this.bytes, BLUR_TEMP_SIZE, BLUR_TEMP_SIZE, RGBAFormat, UnsignedByteType)
    ;((dataTexture.name = "moba.lightTint"), (dataTexture.colorSpace = NoColorSpace), (dataTexture.wrapS = dataTexture.wrapT = ClampToEdgeWrapping), (dataTexture.minFilter = dataTexture.magFilter = LinearFilter), (dataTexture.generateMipmaps = !1), (dataTexture.needsUpdate = !0), (this.texture = dataTexture))
  }
  get count() {
    return this.stamps
  }
  splat(gridX, gridY, splatRadius, writePixelWeight) {
    const bLUR_TEMP_SIZE = BLUR_TEMP_SIZE,
      gridToPixelScale = bLUR_TEMP_SIZE / (LIGHT_TINT_GRID_SIZE * 2),
      effectiveRadius = Math.max(0.75, splatRadius),
      centerX = (gridX + LIGHT_TINT_GRID_SIZE) * gridToPixelScale - 0.5,
      centerY = (gridY + LIGHT_TINT_GRID_SIZE) * gridToPixelScale - 0.5,
      radiusInPixels = effectiveRadius * gridToPixelScale,
      footprintMinX = Math.max(0, Math.floor(centerX - radiusInPixels)),
      footprintMaxX = Math.min(bLUR_TEMP_SIZE - 1, Math.ceil(centerX + radiusInPixels)),
      footprintMinY = Math.max(0, Math.floor(centerY - radiusInPixels)),
      footprintMaxY = Math.min(bLUR_TEMP_SIZE - 1, Math.ceil(centerY + radiusInPixels)),
      weightScale = 1 / (radiusInPixels * radiusInPixels)
    for (let index = footprintMinY; index <= footprintMaxY; index++)
      for (let pixelX = footprintMinX; pixelX <= footprintMaxX; pixelX++) {
        const normalizedDistanceSq = ((pixelX - centerX) * (pixelX - centerX) + (index - centerY) * (index - centerY)) * weightScale
        if (normalizedDistanceSq >= 1) continue
        const splatWeight = (1 - normalizedDistanceSq) * (1 - normalizedDistanceSq)
        writePixelWeight(index * bLUR_TEMP_SIZE + pixelX, splatWeight)
      }
  }
  stamp(stampGridX, stampGridY, stampRadius, lookupKey, colorStrength) {
    DECAL_COLOR_SCRATCH.set(lookupKey)
    const tintRed = DECAL_COLOR_SCRATCH.r * colorStrength,
      tintGreen = DECAL_COLOR_SCRATCH.g * colorStrength,
      tintBlue = DECAL_COLOR_SCRATCH.b * colorStrength,
      rgbState = this.rgb
    ;(this.splat(stampGridX, stampGridY, stampRadius, (stampPixelIndex, pixelWeight) => {
      const rgbOffset = stampPixelIndex * 3
      ;(tintRed * pixelWeight > rgbState[rgbOffset] && (rgbState[rgbOffset] = tintRed * pixelWeight), tintGreen * pixelWeight > rgbState[rgbOffset + 1] && (rgbState[rgbOffset + 1] = tintGreen * pixelWeight), tintBlue * pixelWeight > rgbState[rgbOffset + 2] && (rgbState[rgbOffset + 2] = tintBlue * pixelWeight))
    }),
      this.stamps++)
  }
  occlude(occludeGridX, occludeGridY, occludeRadius, occludeStrength) {
    const clampedStrength = Math.min(1, Math.max(0, occludeStrength)),
      occState = this.occ
    ;(this.splat(occludeGridX, occludeGridY, occludeRadius, (occPixelIndex, occPixelWeight) => {
      clampedStrength * occPixelWeight > occState[occPixelIndex] && (occState[occPixelIndex] = clampedStrength * occPixelWeight)
    }),
      this.stamps++)
  }
  clear() {
    ;(this.rgb.fill(0), this.occ.fill(0), (this.stamps = 0), this.bake())
  }
  bake() {
    const textureSize = BLUR_TEMP_SIZE,
      totalPixels = textureSize * textureSize,
      float32Array = new Float32Array(totalPixels * 3)
    ;(blurImageTwice(this.rgb, this.bakedRgb, float32Array, textureSize, 3), blurImageTwice(this.bakedRgb, this.bakedRgb, float32Array, textureSize, 3), blurImageTwice(this.occ, this.bakedOcc, float32Array, textureSize, 1), blurImageTwice(this.bakedOcc, this.bakedOcc, float32Array, textureSize, 1))
    const outputBytes = this.bytes,
      lastPixel = textureSize - 1
    for (let index = 0; index < textureSize; index++)
      for (let pixelColumn = 0; pixelColumn < textureSize; pixelColumn++) {
        const pixelIndex = index * textureSize + pixelColumn
        ;((pixelColumn === 0 || index === 0 || pixelColumn === lastPixel || index === lastPixel) && ((this.bakedRgb[pixelIndex * 3] = this.bakedRgb[pixelIndex * 3 + 1] = this.bakedRgb[pixelIndex * 3 + 2] = 0), (this.bakedOcc[pixelIndex] = 0)),
          (outputBytes[pixelIndex * 4] = Math.min(255, Math.round(this.bakedRgb[pixelIndex * 3] * 255))),
          (outputBytes[pixelIndex * 4 + 1] = Math.min(255, Math.round(this.bakedRgb[pixelIndex * 3 + 1] * 255))),
          (outputBytes[pixelIndex * 4 + 2] = Math.min(255, Math.round(this.bakedRgb[pixelIndex * 3 + 2] * 255))),
          (outputBytes[pixelIndex * 4 + 3] = Math.min(255, Math.round((1 - this.bakedOcc[pixelIndex]) * 255))))
      }
    this.texture.needsUpdate = !0
  }
  sample(sampleGridX, sampleGridY, outColor) {
    const tintTextureSize = BLUR_TEMP_SIZE,
      sampleGridScale = tintTextureSize / (LIGHT_TINT_GRID_SIZE * 2),
      samplePixelX = Math.min(tintTextureSize - 1, Math.max(0, Math.floor((sampleGridX + LIGHT_TINT_GRID_SIZE) * sampleGridScale))),
      samplePixelIndex = Math.min(tintTextureSize - 1, Math.max(0, Math.floor((sampleGridY + LIGHT_TINT_GRID_SIZE) * sampleGridScale))) * tintTextureSize + samplePixelX
    return (outColor && outColor.setRGB(this.bakedRgb[samplePixelIndex * 3], this.bakedRgb[samplePixelIndex * 3 + 1], this.bakedRgb[samplePixelIndex * 3 + 2]), 1 - this.bakedOcc[samplePixelIndex])
  }
  bind(enabled) {
    setLightTint(enabled ? this.texture : null)
  }
  dispose() {
    ;(ARENA_SHARED_UNIFORMS.tLightTint.value === this.texture && setLightTint(null), this.texture.dispose())
  }
}

export { PROJECTION_SCALE, CameraRig, DecalLayer, GpuTimer, SUN_HEIGHT_RATIO, LightRig, OutlineRegistry, isGpuTimingEnabled, SUN_DIRECTION, CAMERA_PEEK_MAX_GROUND, LIGHT_TARGET_SCRATCH, disposeSceneResources, SUN_GROUND_DIRECTION }