/**
 * 精灵与拖尾：实例化精灵缓冲、图集布局、带状拖尾几何与渲染设置
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Euler, Float32BufferAttribute, Fog, Group, HalfFloatType, IcosahedronGeometry, InstancedBufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer, InstancedMesh, InterleavedBufferAttribute, Matrix4, Mesh, OctahedronGeometry, PCFShadowMap, PCFSoftShadowMap, PlaneGeometry, Quaternion, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Vector2, Vector3, WebGLRenderTarget } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CameraRig, DecalLayer, GpuTimer, LightRig, disposeSceneResources, isGpuTimingEnabled } from './scene-rigs'
import { PostRenderer, acquireRenderer, deathGrayscaleCssFilter, groundPlane, releaseRenderer, scratchRay, supportsFloatRenderTargets, viewDirection } from './post-pipeline'
import { COLOR_GRADE, CUSTOM_TONE_MAPPING, FastRandom, advanceGlobalTime, createToonMaterial, disposeTextureCache, hashNoise2D, installCustomToneMapping, setUnitPatternsEnabled } from './foundation'
import { ARENA_PALETTE } from '../arena-palette'
import { QUALITY_PRESETS } from '../quality-presets'
import { ROCK_SHAPES, SHAPE_SEGMENT_COUNTS, SeededRandom, VFX_FRAGMENT_SHADER, VFX_LIFETIME, VFX_VERTEX_SHADER, applyVertexColors, buildGroundDiscGeometry, buildGroundRingGeometry, easeOutBack, resetVertexColors } from '../fx/fx-definitions'
import { ParticleSprite } from '../particle-sprite'
import { PARTICLE_TONEMAP_GLSL, configureParticleMaterial } from './noise-geometry'
import { ATLAS_COLS, ATLAS_ROWS } from '../particle-atlas'
import { GLSL_ADDITIVE, GLSL_HASH_NOISE } from './glsl-chunks'

class RenderSettings {
  renderer
  canvas
  scene
  rig
  lights
  lightTint = new DecalLayer()
  grade
  viewport = { width: 1, height: 1, dpr: 1 }
  quality
  settings
  time = 0
  frame = 0
  onQualityChanged = null
  onResized = null
  onContextRestored = null
  handleRestored = () => this.onContextRestored?.()
  container
  gpuTimer = null
  post = null
  hdrOk
  stats: { fps: number; drawCalls: number; triangles: number; gpu?: { supported: boolean; shadow: number; scene: number; post: number; total: number; windows: number } } = { fps: 60, drawCalls: 0, triangles: 0 }
  fpsAccum = 0
  fpsFrames = 0
  disposed = !1
  rect = { left: 0, top: 0, width: 1, height: 1 }
  rectFrame = 0
  deathTint = 0
  tintUsed = !1
  cssFilter = ""
  adaptiveResolution = typeof navigator < "u" && !navigator.webdriver
  resScale = 1
  slowTime = 0
  slowFrames = 0
  slowWindows = 0
  constructor(element, initialQuality) {
    this.container = element
    const acquireRendererResult = acquireRenderer()
    ;((this.renderer = acquireRendererResult),
      (acquireRendererResult.outputColorSpace = SRGBColorSpace),
      installCustomToneMapping(),
      (acquireRendererResult.toneMapping = CUSTOM_TONE_MAPPING),
      (acquireRendererResult.toneMappingExposure = 1),
      (acquireRendererResult.shadowMap.type = PCFSoftShadowMap),
      (acquireRendererResult.shadowMap.needsUpdate = !0),
      acquireRendererResult.info.reset(),
      acquireRendererResult.setClearColor(ARENA_PALETTE.env.fog, 1),
      (this.canvas = acquireRendererResult.domElement))
    const canvasStyle = this.canvas.style
    ;((canvasStyle.filter = ""),
      (canvasStyle.position = "absolute"),
      (canvasStyle.left = "0"),
      (canvasStyle.top = "0"),
      (canvasStyle.width = "100%"),
      (canvasStyle.height = "100%"),
      (canvasStyle.display = "block"),
      (canvasStyle.touchAction = "none"),
      element.appendChild(this.canvas),
      this.canvas.addEventListener("webglcontextrestored", this.handleRestored),
      (this.scene = new Scene()),
      (this.scene.fog = new Fog(ARENA_PALETTE.env.fog, 42, 520)),
      (this.rig = new CameraRig()),
      (this.lights = new LightRig(this.scene)),
      (this.grade = {
        exposure: 0.98,
        bloomStrength: 0.55,
        saturation: COLOR_GRADE.saturation,
        vibrance: COLOR_GRADE.vibrance,
        contrast: COLOR_GRADE.contrast,
        pivot: COLOR_GRADE.pivot,
        vignette: 0.2,
        shadowTint: new Color(-0.01, -0.002, 0.022),
        highlightTint: new Color(0.018, 0.008, -0.014),
        haze: 0.06,
        hazeColor: new Color(ARENA_PALETTE.env.haze),
        desaturate: 0,
        dim: 0,
      }),
      (this.hdrOk = supportsFloatRenderTargets(acquireRendererResult)),
      isGpuTimingEnabled() && (this.gpuTimer = new GpuTimer(acquireRendererResult)),
      (this.quality = initialQuality),
      (this.settings = QUALITY_PRESETS[initialQuality]),
      this.applyQuality(),
      this.resize())
  }
  effective(qualityLevel) {
    const selectedQUALITY_PRESETS = QUALITY_PRESETS[qualityLevel]
    return selectedQUALITY_PRESETS.post && !this.hdrOk ? { ...selectedQUALITY_PRESETS, post: !1, bloom: 0, grade: !1, msaa: 0 } : selectedQUALITY_PRESETS
  }
  applyQuality() {
    const activeSettings = (this.settings = this.effective(this.quality)),
      renderer = this.renderer
    renderer.shadowMap.enabled = activeSettings.shadows
    const shadowMapType = activeSettings.shadowType === "pcf" ? PCFShadowMap : PCFSoftShadowMap
    if (
      (renderer.shadowMap.type !== shadowMapType && ((renderer.shadowMap.type = shadowMapType), (renderer.shadowMap.needsUpdate = !0)),
      this.lights.applyQuality(activeSettings),
      setUnitPatternsEnabled(activeSettings.unitPatterns),
      (this.grade.bloomStrength = activeSettings.bloom),
      (this.grade.haze = activeSettings.haze),
      activeSettings.post)
    )
      if (this.post) this.post.applyQuality(activeSettings)
      else {
        this.post = new PostRenderer(renderer, this.scene, this.rig.camera, this.grade, activeSettings)
        const gpuTimer = this.gpuTimer
        gpuTimer && (this.post.onPostBegin = () => gpuTimer.begin("post"))
      }
    else this.post && (this.post.dispose(), (this.post = null))
    ;(this.tintUsed && this.applyDeathTint(),
      (renderer.toneMappingExposure = this.grade.exposure),
      this.scene.traverse((sceneObject) => {
        const material = sceneObject.material
        if (Array.isArray(material)) for (const materialEntry of material) materialEntry.needsUpdate = !0
        else material && (material.needsUpdate = !0)
      }))
  }
  setQuality(targetObject) {
    targetObject !== this.quality && ((this.quality = targetObject), (this.resScale = 1), (this.slowWindows = 0), this.applyQuality(), this.resize(), this.onQualityChanged?.(this.settings))
  }
  get postEnabled() {
    return this.post !== null
  }
  get postPipeline() {
    return this.post
  }
  resize() {
    const viewportWidth = Math.max(1, this.container.clientWidth || window.innerWidth),
      viewportHeight = Math.max(1, this.container.clientHeight || window.innerHeight),
      pixelRatio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.settings.dprCap) * this.resScale),
      viewport = this.viewport
    ;((viewport.width = viewportWidth),
      (viewport.height = viewportHeight),
      (viewport.dpr = pixelRatio),
      this.renderer.setPixelRatio(pixelRatio),
      this.renderer.setSize(viewportWidth, viewportHeight, !1),
      this.post?.setSize(viewportWidth, viewportHeight, pixelRatio),
      this.rig.setAspect(viewportWidth / viewportHeight),
      this.readRect(),
      this.onResized?.())
  }
  readRect() {
    const BoundingClientRectValue = this.canvas.getBoundingClientRect()
    ;((this.rect.left = BoundingClientRectValue.left), (this.rect.top = BoundingClientRectValue.top), (this.rect.width = BoundingClientRectValue.width), (this.rect.height = BoundingClientRectValue.height), (this.rectFrame = this.frame))
  }
  setDeathTint(tintAmount) {
    const clampedTintAmount = Math.min(1, Math.max(0, tintAmount))
    ;(clampedTintAmount === this.deathTint && this.tintUsed) || ((this.deathTint = clampedTintAmount), (this.tintUsed = !0), this.applyDeathTint())
  }
  applyDeathTint() {
    const deathTint = this.deathTint
    ;((this.grade.desaturate = this.post ? deathTint * 0.9 : 0), (this.grade.dim = this.post ? deathTint * 0.16 : 0))
    const grayscaleFilter = this.post ? "" : deathGrayscaleCssFilter(deathTint)
    grayscaleFilter !== this.cssFilter && ((this.cssFilter = grayscaleFilter), (this.canvas.style.filter = grayscaleFilter))
  }
  prewarm() {
    if (this.disposed) return
    const revealedObjects = [],
      unculledObjects = []
    ;(this.scene.traverse((sceneObject) => {
      sceneObject.isLight || (sceneObject.visible || ((sceneObject.visible = !0), revealedObjects.push(sceneObject)), sceneObject.frustumCulled && ((sceneObject.frustumCulled = !1), unculledObjects.push(sceneObject)))
    }),
      this.lightTint.bind(!0))
    try {
      this.lights.fitShadow(this.rig.camera)
      const renderer = this.renderer
      for (let index = 0; index < 2; index++) this.post ? this.post.render(0) : (renderer.setRenderTarget(null), renderer.render(this.scene, this.rig.camera))
    } finally {
      this.lightTint.bind(!1)
      for (const revealedObject of revealedObjects) revealedObject.visible = !1
      for (const unculledObject of unculledObjects) unculledObject.frustumCulled = !0
    }
  }
  *prewarmStages() {
    if (this.disposed) return
    const renderer = this.renderer,
      camera = this.rig.camera,
      revealedObjects = [],
      unculledObjects = [],
      renderableMeshes = []
    this.scene.traverse((sceneObject) => {
      if (sceneObject.isLight) return
      ;(sceneObject.visible || ((sceneObject.visible = !0), revealedObjects.push(sceneObject)), sceneObject.frustumCulled && ((sceneObject.frustumCulled = !1), unculledObjects.push(sceneObject)))
      const renderableCandidate = sceneObject
      ;(renderableCandidate.isMesh || sceneObject.isPoints || sceneObject.isLine || sceneObject.isSprite) && renderableCandidate.material && renderableMeshes.push(sceneObject)
    })
    const compileTarget = this.post ? new WebGLRenderTarget(16, 16, { type: HalfFloatType, depthBuffer: !0, stencilBuffer: !1 }) : null
    let isActive = !1
    this.lightTint.bind(!0)
    try {
      this.lights.fitShadow(camera)
      const compileObjects = []
      for (const sceneChild of this.scene.children)
        if (!sceneChild.isLight)
          if (sceneChild.isMesh || sceneChild.children.length === 0) compileObjects.push(sceneChild)
          else for (const nestedChild of sceneChild.children) compileObjects.push(nestedChild)
      let hasExternalLights = !1
      ;(this.scene.traverse((sceneObject) => {
        sceneObject.isLight && sceneObject.parent !== this.scene && (hasExternalLights = !0)
      }),
        hasExternalLights && ((compileObjects.length = 0), compileObjects.push(this.scene)))
      let compileStartTime = performance.now()
      for (let index = 0; index < compileObjects.length; index++)
        (renderer.setRenderTarget(compileTarget), renderer.compile(compileObjects[index], camera, this.scene), performance.now() - compileStartTime > 10 && index < compileObjects.length - 1 && (renderer.setRenderTarget(null), yield (0.035 * (index + 1)) / compileObjects.length, (compileStartTime = performance.now())))
      ;(renderer.setRenderTarget(null), this.post?.precompile(renderer, camera), yield 0.04)
      const programsToWarmUp = (renderer.info.programs ?? []).slice(),
        initialProgramCount = Math.max(1, programsToWarmUp.length)
      let idleCounter = 0
      for (; programsToWarmUp.length > 0 && idleCounter < 4e3;) {
        const warmupSliceStart = performance.now()
        let didProgress = !1
        for (let programIndex = 0; programIndex < programsToWarmUp.length;) {
          const lookupKey = programsToWarmUp[programIndex]
          if (lookupKey.isReady && !lookupKey.isReady()) {
            programIndex++
            continue
          }
          if ((lookupKey.getUniforms(), programsToWarmUp.splice(programIndex, 1), (didProgress = !0), performance.now() - warmupSliceStart > 8)) break
        }
        ;((idleCounter = didProgress ? 0 : idleCounter + 1), yield 0.04 + 0.66 * (1 - programsToWarmUp.length / initialProgramCount))
      }
      const rendererProperties = renderer.properties,
        meshSignatureMap = new Map()
      for (const renderableMesh of renderableMeshes) {
        const mesh = renderableMesh,
          materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        let signature = `${mesh.isSkinnedMesh ? "s" : ""}${mesh.isInstancedMesh ? (mesh.instanceColor ? "I" : "i") : ""}${mesh.castShadow ? "c" : ""}${mesh.receiveShadow ? "r" : ""}`
        for (const material of materials) {
          const currentProgram = rendererProperties.get(material).currentProgram
          signature += `|${currentProgram ? currentProgram.id : material.uuid}:${material.side}${material.map ? "m" : ""}${material.alphaTest > 0 ? "a" : ""}`
        }
        const customDepthMaterial = mesh.customDepthMaterial
        customDepthMaterial && (signature += `|d:${customDepthMaterial.type}:${customDepthMaterial.defines ? Object.keys(customDepthMaterial.defines).join(",") : ""}`)
        const geometrySignature = mesh.geometry ? Object.keys(mesh.geometry.attributes).sort().join(",") : ""
        ;((signature += `|${geometrySignature}`), meshSignatureMap.has(signature) || meshSignatureMap.set(signature, renderableMesh))
      }
      for (const hiddenMesh of renderableMeshes) hiddenMesh.visible = !1
      isActive = !0
      const uniqueMeshes = [...meshSignatureMap.values()]
      let batchStartTime = performance.now()
      for (let meshIndex = 0; meshIndex < uniqueMeshes.length; meshIndex++) {
        const selectedP = uniqueMeshes[meshIndex]
        ;((selectedP.visible = !0),
          renderer.setRenderTarget(compileTarget),
          renderer.render(this.scene, camera),
          (selectedP.visible = !1),
          performance.now() - batchStartTime > 10 && (renderer.setRenderTarget(null), yield 0.7 + 0.1 * ((meshIndex + 1) / uniqueMeshes.length), (batchStartTime = performance.now())))
      }
      ;(renderer.setRenderTarget(null), yield 0.8)
      const shadowAutoUpdate = renderer.shadowMap.autoUpdate
      renderer.shadowMap.autoUpdate = !1
      try {
        let batchSize = 1
        batchStartTime = performance.now()
        for (let batchStart = 0; batchStart < renderableMeshes.length;) {
          const batchEndIndex = Math.min(renderableMeshes.length, batchStart + batchSize)
          for (let showIndex = batchStart; showIndex < batchEndIndex; showIndex++) renderableMeshes[showIndex].visible = !0
          const nowTotal = performance.now()
          ;(renderer.setRenderTarget(compileTarget), renderer.render(this.scene, camera))
          const renderDuration = performance.now() - nowTotal
          for (let hideIndex = batchStart; hideIndex < batchEndIndex; hideIndex++) renderableMeshes[hideIndex].visible = !1
          ;((batchStart = batchEndIndex),
            (batchSize = renderDuration < 3 ? Math.min(64, batchSize * 2) : renderDuration > 12 ? Math.max(1, batchSize >> 1) : batchSize),
            performance.now() - batchStartTime > 12 && (renderer.setRenderTarget(null), yield 0.8 + 0.12 * (batchStart / renderableMeshes.length), (batchStartTime = performance.now())))
        }
      } finally {
        renderer.shadowMap.autoUpdate = shadowAutoUpdate
      }
      for (const visibleMesh of renderableMeshes) visibleMesh.visible = !0
      ;((isActive = !1), renderer.setRenderTarget(null), yield 0.92)
      for (let passIndex = 0; passIndex < 2; passIndex++) (this.post ? this.post.render(0) : (renderer.setRenderTarget(null), renderer.render(this.scene, camera)), passIndex === 0 && (yield 0.96))
    } finally {
      if (isActive) for (const activeMesh of renderableMeshes) activeMesh.visible = !0
      for (const revealedObject of revealedObjects) revealedObject.visible = !1
      for (const unculledObject of unculledObjects) unculledObject.frustumCulled = !0
      ;(this.lightTint.bind(!1), this.disposed || renderer.setRenderTarget(null), compileTarget?.dispose())
    }
  }
  updateCamera(deltaTime) {
    this.rig.update(deltaTime)
  }
  render(deltaTime, shouldRender = !0) {
    if (this.disposed || ((this.time += deltaTime), this.frame++, advanceGlobalTime(deltaTime), this.lights.update(deltaTime), !shouldRender)) return
    this.lights.fitShadow(this.rig.camera)
    const sceneFog = this.scene.fog,
      isDebugView = this.rig.isDebugView
    ;((sceneFog.near = isDebugView ? 600 : 42), (sceneFog.far = isDebugView ? 3e3 : 520), this.frame - this.rectFrame >= 60 && this.readRect())
    const renderer = this.renderer
    ;(renderer.info.reset(), this.lightTint.bind(!0))
    const gpuTimer = this.gpuTimer
    ;(gpuTimer && (gpuTimer.attach(!0), gpuTimer.begin("scene")),
      this.post ? this.post.render(deltaTime) : (renderer.setRenderTarget(null), renderer.render(this.scene, this.rig.camera)),
      gpuTimer && (gpuTimer.frameEnd(), gpuTimer.attach(!1), (this.stats.gpu = gpuTimer.timings)),
      this.lightTint.bind(!1),
      (this.stats.drawCalls = renderer.info.render.calls),
      (this.stats.triangles = renderer.info.render.triangles),
      (this.fpsAccum += deltaTime),
      this.fpsFrames++,
      this.adaptiveResolution && this.trackPerformance(deltaTime),
      this.fpsAccum >= 0.5 && ((this.stats.fps = Math.round(this.fpsFrames / this.fpsAccum)), (this.fpsAccum = 0), (this.fpsFrames = 0)))
  }
  trackPerformance(deltaTime) {
    if (((this.slowTime += deltaTime), this.slowFrames++, this.slowTime < 1.5)) return
    const averageFrameTime = this.slowTime / this.slowFrames
    ;((this.slowTime = 0),
      (this.slowFrames = 0),
      averageFrameTime > 1 / 26 && this.resScale > 0.61 ? ++this.slowWindows >= 3 && ((this.slowWindows = 0), (this.resScale = Math.max(0.6, this.resScale * 0.85)), this.resize()) : (this.slowWindows = 0))
  }
  getStats() {
    return this.stats
  }
  get gpuTimings() {
    return this.gpuTimer ? this.gpuTimer.timings : null
  }
  /**
   * 处理地形。
   *
   * @param clientX - 输入
   * @param clientY - 输入
  */
  screenToGround(clientX, clientY) {
    const rectState = this.rect
    if (rectState.width <= 0 || rectState.height <= 0) return null
    const lookupKey = ((clientX - rectState.left) / rectState.width) * 2 - 1,
      ndcY = -(((clientY - rectState.top) / rectState.height) * 2 - 1),
      camera = this.rig.camera
    ;(scratchRay.origin.setFromMatrixPosition(camera.matrixWorld), scratchRay.direction.set(lookupKey, ndcY, 0.5).unproject(camera).sub(scratchRay.origin).normalize())
    const intersectPlaneResult = scratchRay.intersectPlane(groundPlane, viewDirection)
    return intersectPlaneResult ? { x: intersectPlaneResult.x, y: intersectPlaneResult.z } : null
  }
  worldToScreen(lookupKey, worldY, worldZ, screenPoint) {
    const camera = this.rig.camera
    viewDirection.set(lookupKey, worldY, worldZ).applyMatrix4(camera.matrixWorldInverse)
    const isInFrontOfCamera = viewDirection.z < 0
    viewDirection.applyMatrix4(camera.projectionMatrix)
    const rectValue = this.rect
    return ((screenPoint.x = rectValue.left + (viewDirection.x * 0.5 + 0.5) * rectValue.width), (screenPoint.y = rectValue.top + (-viewDirection.y * 0.5 + 0.5) * rectValue.height), (screenPoint.visible = isInFrontOfCamera && Math.abs(viewDirection.x) <= 1.05 && Math.abs(viewDirection.y) <= 1.05), screenPoint)
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      disposeSceneResources(this.scene),
      disposeTextureCache(),
      this.post?.dispose(),
      (this.post = null),
      this.lights.dispose(),
      this.lightTint.dispose(),
      this.gpuTimer?.dispose(),
      (this.gpuTimer = null),
      this.scene.clear(),
      this.canvas.removeEventListener("webglcontextrestored", this.handleRestored),
      (this.canvas.style.filter = ""),
      this.canvas.remove(),
      releaseRenderer(this.renderer))
  }
}

const DEFAULT_TERRAIN_QUERY = { heightAt: () => 0, waterLevel: 0, inWater: () => !1 }

/**
 * 获取单位。
 *
 * @param unit - 输入
 * @returns 数值结果
 */
function getDefaultUnitHeight(unit) {
  switch (unit.kind) {
    case "hero":
      return 2.5
    case "minion":
      return unit.minionType === "super" || unit.minionType === "siege" ? 2 : 1.5
    case "tower":
      return 8
    case "core":
      return 7
    case "monster":
      return 1.2 + unit.radius * 1.6
  }
}

function awaitNextFrame() {
  return new Promise<void>((event) => {
    if (typeof document < "u" && document.hidden && typeof MessageChannel < "u") {
      const messageChannel = new MessageChannel()
      ;((messageChannel.port1.onmessage = () => {
        ;(messageChannel.port1.close(), event())
      }),
        messageChannel.port2.postMessage(0))
      return
    }
    let isResolved = !1
    const resolveOnce = () => {
      isResolved || ((isResolved = !0), event())
    }
    ;(requestAnimationFrame(resolveOnce), window.setTimeout(resolveOnce, 50))
  })
}

function buildStagedAssets(containerElement, bushMap, renderConfig, assetBuilders) {
  const RenderContextValue = createRenderContext(containerElement, bushMap, renderConfig)
  for (const item of assetBuilders) RenderContextValue.modules.push(item(RenderContextValue.ctx))
  return RenderContextValue.api
}

async function loadAssetsStaged(containerElement, stagedAssetKind, renderConfig, bushMap, onProgress) {
  const createRenderContextRenderContextValue = createRenderContext(containerElement, stagedAssetKind, renderConfig),
    assetCount = Math.max(1, bushMap.length)
  let total = 0
  const costWeights = bushMap.map((assetBuilder) => {
    const costWeight = assetBuilder.staged ? 6 : 1
    return ((total += costWeight), costWeight)
  })
  let loadedFraction = 0
  ;(onProgress?.(0), await awaitNextFrame())
  for (let index = 0; index < assetCount && index < bushMap.length && !createRenderContextRenderContextValue.isDisposed(); index++) {
    const selectedS = bushMap[index],
      assetCostFraction = costWeights[index] / total
    if (selectedS.staged) {
      const stagedResult = selectedS.staged(createRenderContextRenderContextValue.ctx)
      for (;;) {
        const assetStageStep = stagedResult.next()
        if (assetStageStep.done) {
          createRenderContextRenderContextValue.modules.push(assetStageStep.value)
          break
        }
        if ((onProgress?.(loadedFraction + assetCostFraction * Math.min(1, Math.max(0, assetStageStep.value))), await awaitNextFrame(), createRenderContextRenderContextValue.isDisposed())) {
          stagedResult.return(void 0)
          break
        }
      }
    } else createRenderContextRenderContextValue.modules.push(selectedS(createRenderContextRenderContextValue.ctx))
    ;((loadedFraction += assetCostFraction), onProgress?.(Math.min(1, loadedFraction)), await awaitNextFrame())
  }
  return createRenderContextRenderContextValue.api
}

function createRenderContext(element, bushMap, renderConfig) {
  getComputedStyle(element).position === "static" && (element.style.position = "relative")
  const renderSettings = new RenderSettings(element, renderConfig.quality),
    createElementElement = document.createElement("div")
  ;((createElementElement.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none;"), element.appendChild(createElementElement))
  const terrainConfig = { terrain: new Group(), units: new Group(), fx: new Group() }
  ;((terrainConfig.terrain.name = "terrain"), (terrainConfig.units.name = "units"), (terrainConfig.fx.name = "fx"), renderSettings.scene.add(terrainConfig.terrain, terrainConfig.units, terrainConfig.fx))
  const findPlayerHero = (detail) => {
      const heroes = detail.heroes
      for (let index = 0; index < heroes.length; index++) if (heroes[index].id === detail.playerId) return heroes[index]
      return null
    },
    getPlayerTeam = (missing) => findPlayerHero(missing)?.team ?? 0,
    stateConfig = { state: bushMap, alpha: 1, dt: 0, time: 0, frame: 0, playerTeam: getPlayerTeam(bushMap) },
    unitById = new Map()
  let cachedFrame = -1
  const lookupUnit = (lookupKey) => {
      if (cachedFrame !== stateConfig.frame) {
        unitById.clear()
        for (const unit of stateConfig.state.units) unitById.set(unit.id, unit)
        cachedFrame = stateConfig.frame
      }
      return unitById.get(lookupKey)
    },
    getPositionConfig = {
      /**
       * 获取坐标。
       *
       * @param unitId - 输入
       * @param outPosition - 输入
      */
      getPosition(unitId, outPosition) {
        const dResult = lookupUnit(unitId)
        if (!dResult) return !1
        const alpha = stateConfig.alpha
        return (outPosition.set(dResult.prevPos.x + (dResult.pos.x - dResult.prevPos.x) * alpha, 0, dResult.prevPos.y + (dResult.pos.y - dResult.prevPos.y) * alpha), !0)
      },
      getHeight(unitId) {
        const dDResult = lookupUnit(unitId)
        return dDResult ? getDefaultUnitHeight(dDResult) : 2
      },
    },
    modules = [],
    rendererConfig = {
      renderer: renderSettings.renderer,
      scene: renderSettings.scene,
      camera: renderSettings.rig.camera,
      rig: renderSettings.rig,
      lights: renderSettings.lights,
      lightTint: renderSettings.lightTint,
      grade: renderSettings.grade,
      layers: terrainConfig,
      map: bushMap.map,
      container: element,
      overlayRoot: createElementElement,
      viewport: renderSettings.viewport,
      get quality() {
        return renderSettings.quality
      },
      get settings() {
        return renderSettings.settings
      },
      frame: stateConfig,
      unitQuery: getPositionConfig,
      terrain: DEFAULT_TERRAIN_QUERY,
      setUnitQuery(unitQuery) {
        rendererConfig.unitQuery = unitQuery
      },
      worldToScreen: (worldX, worldY, worldZ, outScreenPoint) => renderSettings.worldToScreen(worldX, worldY, worldZ, outScreenPoint),
      screenToGround: (clientX, clientY) => renderSettings.screenToGround(clientX, clientY),
      getModule(moduleName) {
        return modules.find((module) => module.name === moduleName)
      },
    },
    mapBound = bushMap.map.bound
  renderSettings.rig.bounds = { minX: -mapBound, maxX: mapBound, minZ: -mapBound, maxZ: mapBound }
  let isPrewarmed = !1,
    isPrewarming = !1
  ;((renderSettings.onQualityChanged = (quality) => {
    for (const module of modules) module.setQuality?.(quality)
  }),
    (renderSettings.onResized = () => {
      for (const module of modules) module.resize?.(renderSettings.viewport)
    }),
    (renderSettings.onContextRestored = () => {
      isPrewarmed = !1
    }))
  const followPlayer = (worldState, alpha) => {
    const oResult = findPlayerHero(worldState)
    oResult && renderSettings.rig.setFollow(oResult.prevPos.x + (oResult.pos.x - oResult.prevPos.x) * alpha, oResult.prevPos.y + (oResult.pos.y - oResult.prevPos.y) * alpha)
  }
  ;(followPlayer(bushMap, 1), renderSettings.rig.update(0))
  const xConfig = { x: 0, y: 0, visible: !1 },
    edgeScreenPoint = { x: 0, y: 0, visible: !1 },
    unitPosition = new Vector3(),
    distance = /**
 * 处理距离。
 *
 * @param screenX - 主要输入
 * @param chest - 输入
 * @param world - 战场
 */
(screenX, chest, world) => {
      let nearestUnitId = -1,
        bestRatio = 1 / 0
      for (const unit of world.units) {
        if (!unit.alive || unit.id === world.playerId || (unit.team !== stateConfig.playerTeam && !unit.visible[stateConfig.playerTeam]) || !rendererConfig.unitQuery.getPosition(unit.id, unitPosition)) continue
        const unitScreenOffset = Math.min(1.4, rendererConfig.unitQuery.getHeight(unit.id) * 0.45)
        if ((renderSettings.worldToScreen(unitPosition.x, unitPosition.y + unitScreenOffset, unitPosition.z, xConfig), !xConfig.visible)) continue
        renderSettings.worldToScreen(unitPosition.x + unit.radius + 0.35, unitPosition.y + unitScreenOffset, unitPosition.z, edgeScreenPoint)
        const maxPickDistance = Math.max(26, Math.abs(edgeScreenPoint.x - xConfig.x) * 1.25),
          distance = Math.hypot(xConfig.x - screenX, xConfig.y - chest)
        if (distance > maxPickDistance) continue
        const pickRatio = distance / maxPickDistance
        pickRatio < bestRatio && ((bestRatio = pickRatio), (nearestUnitId = unit.id))
      }
      return nearestUnitId
    }
  let isDisposed = !1,
    activeAim = null
  const updateReach = /**
 * 处理事件。
 *
 * @param towersDestroyed - 输入
 * @param alpha - 次要输入
 */
(towersDestroyed, alpha) => {
    const cameraRig = renderSettings.rig,
      oOResult = findPlayerHero(towersDestroyed)
    if (activeAim && activeAim.pointer && activeAim.kind === "position" && oOResult && oOResult.alive) {
      ;(cameraRig.setReach(null), unitPosition.set(activeAim.pos.x, 0, activeAim.pos.y).project(renderSettings.rig.camera), cameraRig.setPointerReach(Math.max(-1, Math.min(1, unitPosition.y)), activeAim.range + Math.min(activeAim.radius, 2.5) * 0.3))
      return
    }
    if ((cameraRig.setPointerReach(null), !activeAim || activeAim.pointer || activeAim.kind === "self" || activeAim.kind === "target")) {
      cameraRig.setReach(null)
      return
    }
    if (!oOResult || !oOResult.alive) {
      cameraRig.setReach(null)
      return
    }
    const playerX = oOResult.prevPos.x + (oOResult.pos.x - oOResult.prevPos.x) * alpha,
      playerY = oOResult.prevPos.y + (oOResult.pos.y - oOResult.prevPos.y) * alpha
    let aimVectorX, inputOffsetY, reachDistance
    if (activeAim.kind === "position") {
      ;((aimVectorX = activeAim.pos.x - playerX), (inputOffsetY = activeAim.pos.y - playerY))
      const distance = Math.hypot(aimVectorX, inputOffsetY)
      reachDistance = Math.min(distance, activeAim.range) + Math.min(activeAim.radius, 2.5)
    } else ((aimVectorX = activeAim.dir.x), (inputOffsetY = activeAim.dir.y), (reachDistance = activeAim.range))
    const inputMagnitude = Math.hypot(aimVectorX, inputOffsetY)
    inputMagnitude < 1e-4 ? cameraRig.setReach(null) : cameraRig.setReach(playerX + (aimVectorX / inputMagnitude) * reachDistance, playerY + (inputOffsetY / inputMagnitude) * reachDistance)
  }
  let hasTallFocus = !1
  const updateTallFocus = (world) => {
      const playerHero = findPlayerHero(world)
      let focusHeight = 0
      if (playerHero && playerHero.alive) {
        const focusRadius = hasTallFocus ? 11.5 : 9.5
        for (const monster of world.units) {
          if (monster.kind !== "monster" || !monster.alive || monster.radius < 1.8 || !monster.visible[stateConfig.playerTeam]) continue
          const monsterOffsetY = monster.pos.y - playerHero.pos.y
          monsterOffsetY < 3 && Math.hypot(monster.pos.x - playerHero.pos.x, monsterOffsetY) < focusRadius && (focusHeight = Math.max(focusHeight, monster.radius >= 2.3 ? 1.5 : 1))
        }
      }
      ;((hasTallFocus = focusHeight > 0), renderSettings.rig.setTallFocus(focusHeight))
    },
    prewarmAll = () => {
      if (isDisposed) return
      ;((isPrewarmed = !0), (stateConfig.dt = 0), renderSettings.updateCamera(0))
      const cleanups = []
      for (const item of modules) {
        const prewarmResult = item.prewarm?.()
        prewarmResult && cleanups.push(prewarmResult)
      }
      try {
        for (const module of modules) module.update(stateConfig)
        renderSettings.prewarm()
      } finally {
        for (const cleanup of cleanups) cleanup()
      }
    },
    prewarmSync = () => {
      if (!isDisposed) {
        prewarmAll()
        for (const item of modules) item.update(stateConfig)
        renderSettings.render(0, !0)
      }
    },
    stepsConfig = { steps: 0, total: 0, max: 0, slow: [] },
    prewarmAsync = async (onProgress) => {
      if (isDisposed || isPrewarming) return
      isPrewarming = !0
      const cleanups = []
      ;((stepsConfig.steps = 0), (stepsConfig.total = 0), (stepsConfig.max = 0), (stepsConfig.slow.length = 0))
      let stageStartTime = performance.now()
      const recordStep = (progress) => {
        const stepDuration = performance.now() - stageStartTime
        ;(stepsConfig.steps++, (stepsConfig.total += stepDuration), stepDuration > stepsConfig.max && (stepsConfig.max = stepDuration), stepDuration > 50 && stepsConfig.slow.push([Math.round(progress * 1e3) / 1e3, Math.round(stepDuration)]))
      }
      try {
        ;((stateConfig.dt = 0), renderSettings.updateCamera(0), onProgress?.(0))
        for (const item of modules) {
          if (!item.prewarm) continue
          stageStartTime = performance.now()
          const prewarmCleanup = item.prewarm()
          if ((prewarmCleanup && cleanups.push(prewarmCleanup), recordStep(0), await awaitNextFrame(), isDisposed)) return
        }
        stageStartTime = performance.now()
        for (const module of modules) module.update(stateConfig)
        if ((recordStep(0.06), onProgress?.(0.06), await awaitNextFrame(), isDisposed)) return
        const prewarmStagesResult = renderSettings.prewarmStages()
        for (;;) {
          stageStartTime = performance.now()
          const prewarmStageStep = prewarmStagesResult.next()
          if (prewarmStageStep.done) {
            recordStep(1)
            break
          }
          // strict:false 下 IteratorResult 不随 done 检查收窄，value 仍含 void；此分支已排除 done，运行时必为 yield 的 number，故显式断言。
          if ((recordStep(0.06 + 0.94 * (prewarmStageStep.value as unknown as number)), onProgress?.(0.06 + 0.94 * (prewarmStageStep.value as unknown as number)), await awaitNextFrame(), isDisposed)) {
            prewarmStagesResult.return()
            return
          }
        }
        isPrewarmed = !0
      } finally {
        if (!isDisposed) for (const builder of cleanups) builder()
        isPrewarming = !1
      }
      if (!isDisposed) {
        for (const activeModule of modules) activeModule.update(stateConfig)
        ;(renderSettings.render(0, !0), onProgress?.(1))
      }
    },
    updateAndRender = (indicator, alpha, deltaTime, shouldRender) => {
      if (isDisposed || isPrewarming) return
      const clampedDelta = Math.min(Math.max(deltaTime, 0), 0.1)
      ;(shouldRender && !isPrewarmed && ((stateConfig.state = indicator), (stateConfig.alpha = alpha), (stateConfig.playerTeam = getPlayerTeam(indicator)), followPlayer(indicator, alpha), prewarmAll()),
        (stateConfig.state = indicator),
        (stateConfig.alpha = alpha),
        (stateConfig.dt = clampedDelta),
        (stateConfig.time = renderSettings.time + clampedDelta),
        (stateConfig.frame = renderSettings.frame + 1),
        (stateConfig.playerTeam = getPlayerTeam(indicator)),
        followPlayer(indicator, alpha),
        updateReach(indicator, alpha),
        updateTallFocus(indicator),
        renderSettings.updateCamera(clampedDelta))
      for (const item of modules) item.update(stateConfig)
      renderSettings.render(clampedDelta, shouldRender)
    }
  return {
    api: {
      engine: renderSettings,
      context: rendererConfig,
      render(worldState, alpha, readBuffer) {
        updateAndRender(worldState, alpha, readBuffer, !0)
      },
      advance(worldState, speed, deltaTime) {
        updateAndRender(worldState, speed, deltaTime, !1)
      },
      reset() {
        if (!isDisposed) {
          for (const item of modules) item.reset?.()
          renderSettings.rig.snap()
        }
      },
      handleEvents(events, eventContext) {
        if (!(isDisposed || events.length === 0)) for (const item of modules) item.handleEvents?.(events, eventContext)
      },
      setAim(aimTarget) {
        activeAim = aimTarget
        for (const item of modules) item.setAim?.(aimTarget)
      },
      setQuality(quality) {
        quality !== renderSettings.quality && (renderSettings.setQuality(quality), (isPrewarmed = !1))
      },
      resize() {
        renderSettings.resize()
      },
      screenToGround(clientX, clientY) {
        return renderSettings.screenToGround(clientX, clientY)
      },
      worldToScreen(worldPosition, height = 0) {
        return renderSettings.worldToScreen(worldPosition.x, height, worldPosition.y, { x: 0, y: 0, visible: !1 })
      },
      pickUnit(clientX, clientY, world) {
        for (const item of modules) if (item.pickUnit) return item.pickUnit(clientX, clientY, world)
        return distance(clientX, clientY, world)
      },
      setCameraPeek(peekPosition) {
        peekPosition ? renderSettings.rig.setPeek(peekPosition.x, peekPosition.y) : renderSettings.rig.setPeek(null)
      },
      getStats() {
        return renderSettings.getStats()
      },
      setCameraShake(enabled) {
        renderSettings.rig.shakeEnabled = enabled
      },
      snapCamera() {
        renderSettings.rig.snap()
      },
      setDeathTint(tintAmount) {
        renderSettings.setDeathTint(tintAmount)
      },
      setOverlayAvoid(avoidRects) {
        modules.find((module) => module.name === "overlay")?.setAvoid?.(avoidRects)
      },
      prewarm: prewarmSync,
      prewarmAsync: prewarmAsync,
      warmStats: stepsConfig,
      dispose() {
        if (!isDisposed) {
          isDisposed = !0
          for (let index = modules.length - 1; index >= 0; index--) modules[index].dispose()
          ;((modules.length = 0), renderSettings.dispose(), createElementElement.remove())
        }
      },
    },
    ctx: rendererConfig,
    modules: modules,
    isDisposed: () => isDisposed,
  }
}

/**
 * 创建几何。
 *
 */
function buildArrowGeometry() {
  const geometryParts = [],
    toNonIndexedResult = new CylinderGeometry(0.03, 0.03, 1.45, 6, 1).toNonIndexed()
  ;(toNonIndexedResult.rotateZ(-Math.PI / 2), toNonIndexedResult.translate(-0.05, 0, 0), applyVertexColors(toNonIndexedResult, () => [0.82, 0.76, 0.62]), geometryParts.push(toNonIndexedResult))
  const arrowheadGeometry = new ConeGeometry(0.11, 0.4, 6, 1).toNonIndexed()
  ;(arrowheadGeometry.rotateZ(-Math.PI / 2), arrowheadGeometry.translate(0.86, 0, 0), applyVertexColors(arrowheadGeometry, () => [1.5, 1.5, 1.5]), geometryParts.push(arrowheadGeometry))
  for (let index = 0; index < 3; index++) {
    const bufferGeometry = new BufferGeometry()
    ;(bufferGeometry.setAttribute("position", new Float32BufferAttribute([-0.78, 0.03, 0, -0.42, 0.03, 0, -0.86, 0.19, 0, -0.78, 0.03, 0, -0.86, 0.19, 0, -0.42, 0.03, 0], 3)),
      bufferGeometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1], 3)),
      bufferGeometry.setAttribute("uv", new Float32BufferAttribute(new Array(12).fill(0), 2)),
      bufferGeometry.rotateX((index * Math.PI * 2) / 3),
      applyVertexColors(bufferGeometry, () => [1.1, 1.1, 1.1]),
      geometryParts.push(bufferGeometry))
  }
  const mergeGeometriesResult = mergeGeometries(geometryParts, !1)
  for (const item of geometryParts) item.dispose()
  return mergeGeometriesResult
}

/**
 * 创建几何。
 *
 */
function buildWingGeometry() {
  const positions = [],
    normals = [],
    uvs = [],
    colors = [],
    addTriangle = (vertexA, vertexB, vertexC, colorValue) => {
      for (const item of [1, -1]) {
        const triangleVertices = item === 1 ? [vertexA, vertexC, vertexB] : [vertexA, vertexB, vertexC]
        for (const vertex of triangleVertices) (positions.push(vertex[0], item * 0.03, vertex[1]), normals.push(0, item, 0), uvs.push(0, 0), colors.push(colorValue, colorValue, colorValue))
      }
    }
  for (let index = 0; index < 3; index++) {
    const rotationAngle = (index * Math.PI * 2) / 3,
      polarPoint = (heroId, angleOffset) => [Math.cos(rotationAngle + angleOffset) * heroId, Math.sin(rotationAngle + angleOffset) * heroId],
      centerPoint = [0, 0]
    ;(addTriangle(centerPoint, polarPoint(0.34, -0.55), polarPoint(0.62, 0.05), 0.75), addTriangle(centerPoint, polarPoint(0.62, 0.05), polarPoint(0.3, 0.6), 0.6), addTriangle(polarPoint(0.34, -0.55), polarPoint(1, 0.42), polarPoint(0.62, 0.05), 1.5), addTriangle(polarPoint(0.62, 0.05), polarPoint(1, 0.42), polarPoint(0.72, 0.5), 1))
  }
  const geometry = new BufferGeometry()
  return (geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)), geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3)), geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2)), geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)), geometry)
}

/**
 * 创建几何。
 *
 */
function buildHornGeometry() {
  const positions = [],
    uvs = [],
    normals = [],
    indices = []
  for (let index = 0; index <= 10; index++) {
    const heightRatio = index / 10,
      axialPosition = heightRatio,
      ringRadius = 0.07 + 0.93 * Math.pow(heightRatio, 0.8)
    for (let radialIndex = 0; radialIndex <= 20; radialIndex++) {
      const radialRatio = radialIndex / 20,
        polarAngle = radialRatio * Math.PI * 2,
        cosPolarAngle = Math.cos(polarAngle),
        sinPolarAngle = Math.sin(polarAngle)
      positions.push(axialPosition, cosPolarAngle * ringRadius * 0.8, sinPolarAngle * ringRadius)
      const normalizeResult = new Vector3(-0.6, cosPolarAngle, sinPolarAngle).normalize()
      if ((normals.push(normalizeResult.x, normalizeResult.y, normalizeResult.z), uvs.push(heightRatio, radialRatio), index < 10 && radialIndex < 20)) {
        const vertexIndex = index * 21 + radialIndex
        indices.push(vertexIndex, vertexIndex + 20 + 1, vertexIndex + 1, vertexIndex + 1, vertexIndex + 20 + 1, vertexIndex + 20 + 2)
      }
    }
  }
  const geometry = new BufferGeometry()
  return (geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)), geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2)), geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3)), geometry.setIndex(indices), resetVertexColors(geometry))
}

/**
 * 创建几何。
 *
 * @param quads - 来源
 */
function buildQuadFanGeometry(quads) {
  const positions = [],
    colors = []
  for (const [vertexA, vertexB, vertexC, colorValue] of quads) {
    positions.push(...vertexA, ...vertexB, ...vertexC)
    for (let index = 0; index < 3; index++) colors.push(colorValue, colorValue, colorValue * 1.04)
  }
  const geometry = new BufferGeometry()
  return (geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)), geometry.setAttribute("uv", new Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)), geometry.setAttribute("color", new Float32BufferAttribute(colors, 3)), geometry.computeVertexNormals(), geometry)
}

/**
 * 创建几何。
 *
 */
function buildFeatherGeometry() {
  const profilePoints = [
      [0, 0.07],
      [0.08, 0.105],
      [0.3, 0.125],
      [0.6, 0.1],
      [0.85, 0.055],
      [1, 0],
    ],
    quads = []
  for (let index = 0; index < profilePoints.length - 1; index++) {
    const [pointU, pointV] = profilePoints[index],
      [nextPointU, nextPointV] = profilePoints[index + 1],
      profileHalfWidth = 0.036 * (1 - pointU * 0.8),
      nextHalfWidth = 0.036 * (1 - nextPointU * 0.8)
    for (const item of [1, -1])
      for (const depthSign of [1, -1]) {
        const vertexCornerA = [pointU + -0.3, item * profileHalfWidth, 0],
          vertexCornerB = [nextPointU + -0.3, item * nextHalfWidth, 0],
          vertexCornerC = [pointU + -0.3, 0, depthSign * pointV],
          vertexCornerD = [nextPointU + -0.3, 0, depthSign * nextPointV],
          shadeFactor = item > 0 ? (depthSign > 0 ? 1.55 : 1.15) : depthSign > 0 ? 0.95 : 0.75
        item * depthSign > 0 ? quads.push([vertexCornerA, vertexCornerC, vertexCornerB, shadeFactor], [vertexCornerB, vertexCornerC, vertexCornerD, shadeFactor]) : quads.push([vertexCornerA, vertexCornerB, vertexCornerC, shadeFactor], [vertexCornerB, vertexCornerD, vertexCornerC, shadeFactor])
      }
  }
  const addFeatherQuads = (baseX, tipX, halfWidth, grassD, halfDepth) => {
    const vertexFromMask = (cornerMask) => [(cornerMask & 1 ? tipX : baseX) + -0.3, cornerMask & 2 ? halfWidth : -halfWidth, cornerMask & 4 ? grassD : -grassD]
    for (const [cornerA, cornerB, cornerC, cornerD, shade] of [
      [0, 1, 3, 2, 0.8],
      [4, 6, 7, 5, 1],
      [0, 4, 5, 1, 0.6],
      [2, 3, 7, 6, 1.2],
      [0, 2, 6, 4, 0.7],
      [1, 5, 7, 3, 0.9],
    ])
      quads.push([vertexFromMask(cornerA), vertexFromMask(cornerB), vertexFromMask(cornerC), halfDepth * shade], [vertexFromMask(cornerA), vertexFromMask(cornerC), vertexFromMask(cornerD), halfDepth * shade])
  }
  return (addFeatherQuads(-0.045, 0.02, 0.032, 0.16, 0.62), addFeatherQuads(-0.42, -0.045, 0.034, 0.04, 0.2), addFeatherQuads(-0.5, -0.42, 0.05, 0.07, 0.55), buildQuadFanGeometry(quads))
}

const FEATHER_LENGTH_PROFILE = [0.15, 0.045, 0.085, 0.1, 0.08, 0.02, -0.13],
  FEATHER_WIDTH_PROFILE = [-0.045, -0.03, -0.012, 0, 0.012, 0.045, 0.14]

function sampleProfileCurve(profile, position) {
  const sampleIndex = Math.min(1, Math.max(0, position)) * (profile.length - 1),
    lowerIndex = Math.min(profile.length - 2, Math.floor(sampleIndex))
  return (profile[lowerIndex] + (profile[lowerIndex + 1] - profile[lowerIndex]) * (sampleIndex - lowerIndex)) / 1.45
}

/**
 * 创建几何。
 *
 */
function buildLeafGeometry() {
  const positions = [],
    uvs = [],
    normals = [],
    indices = []
  for (let index = 0; index <= 8; index++) {
    const lengthRatio = index / 8
    for (let widthIndex = 0; widthIndex <= 12; widthIndex++) {
      const widthRatio = widthIndex / 12,
        normalizedEdgeOffset = Math.abs(widthRatio * 2 - 1),
        leafWidth = 0.31 * (0.93 + 0.07 * Math.cos(lengthRatio * Math.PI * 2)),
        lateralOffset = (widthRatio * 2 - 1) * leafWidth,
        halfWidth = 0.031 + sampleProfileCurve(FEATHER_WIDTH_PROFILE, normalizedEdgeOffset),
        leafLength = 0.897 + sampleProfileCurve(FEATHER_LENGTH_PROFILE, normalizedEdgeOffset),
        leafSpan = halfWidth + (leafLength - halfWidth) * lengthRatio
      if ((positions.push(-0.075 * (lateralOffset / 0.31) * (lateralOffset / 0.31), leafSpan, lateralOffset), uvs.push(widthRatio, lengthRatio), normals.push(1, 0, 0), widthIndex < 12 && index < 8)) {
        const vertexIndex = index * 13 + widthIndex
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 12 + 1, vertexIndex + 1, vertexIndex + 12 + 2, vertexIndex + 12 + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  return (geometry.setAttribute("position", new Float32BufferAttribute(positions, 3)), geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2)), geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3)), geometry.setIndex(indices), resetVertexColors(geometry))
}

/**
 * 更新特效。
 *
 * @param geometry - 界面元素
 * @param fxFactorAt - 输入
 */
function applyFxAttribute(geometry, fxFactorAt) {
  const AttributeValue = geometry.getAttribute("position"),
    uint8Array = new Uint8Array(AttributeValue.count * 4)
  for (let index = 0; index < AttributeValue.count; index++) ((uint8Array[index * 4 + 1] = Math.max(0, Math.min(1, fxFactorAt(AttributeValue.getX(index), AttributeValue.getY(index), AttributeValue.getZ(index)))) * 255), (uint8Array[index * 4 + 3] = 255))
  geometry.setAttribute("aFx", new BufferAttribute(uint8Array, 4, !0))
}

/**
 * 创建几何。
 *
 */
function buildRockShardGeometry() {
  const coneGeometry = new ConeGeometry(0.5, 1, 5, 2)
  coneGeometry.translate(0, 0.5, 0)
  const getAttributeAttributeValue = coneGeometry.getAttribute("position")
  for (let index = 0; index < getAttributeAttributeValue.count; index++) {
    const YValue = getAttributeAttributeValue.getY(index)
    if (YValue > 0.02 && YValue < 0.98) {
      const noiseSeedX = Math.round(getAttributeAttributeValue.getX(index) * 100),
        noiseSeedZ = Math.round(getAttributeAttributeValue.getZ(index) * 100)
      ;(getAttributeAttributeValue.setX(index, getAttributeAttributeValue.getX(index) * (0.8 + 0.5 * hashNoise2D(noiseSeedX, noiseSeedZ, 5))), getAttributeAttributeValue.setZ(index, getAttributeAttributeValue.getZ(index) * (0.8 + 0.5 * hashNoise2D(noiseSeedX, noiseSeedZ, 9))))
    }
  }
  const shardGeometry = coneGeometry.toNonIndexed()
  return (
    coneGeometry.dispose(),
    shardGeometry.computeVertexNormals(),
    applyVertexColors(shardGeometry, (vertexX, vertexY) => {
      const heightFactor = Math.max(0, (vertexY - 0.5) / 0.5)
      return [0.15 + 0.85 * heightFactor, 0.125 + 0.42 * heightFactor, 0.11 - 0.02 * heightFactor]
    }),
    applyFxAttribute(shardGeometry, (vertexX, vertexY) => Math.max(0, (vertexY - 0.55) / 0.45) * 0.55),
    shardGeometry
  )
}

/**
 * 创建几何。
 *
 */
function buildBoulderGeometry() {
  const fastRandom = new FastRandom(31),
    boulderGeometry = new IcosahedronGeometry(1, 0),
    displacedVertexMap = new Map(),
    AttributeResult = boulderGeometry.getAttribute("position")
  for (let index = 0; index < AttributeResult.count; index++) {
    const lookupKey = `${AttributeResult.getX(index).toFixed(3)},${AttributeResult.getY(index).toFixed(3)},${AttributeResult.getZ(index).toFixed(3)}`
    let Value = displacedVertexMap.get(lookupKey)
    if (!Value) {
      const displacementScale = fastRandom.range(0.62, 1.12)
      ;((Value = [AttributeResult.getX(index) * displacementScale, AttributeResult.getY(index) * displacementScale * 0.82, AttributeResult.getZ(index) * displacementScale]), displacedVertexMap.set(lookupKey, Value))
    }
    AttributeResult.setXYZ(index, Value[0], Value[1], Value[2])
  }
  return (
    boulderGeometry.computeVertexNormals(),
    applyVertexColors(boulderGeometry, (vertexX, vertexY, vertexZ, vertexIndex) => {
      const shade = 0.14 + 0.05 * (((vertexIndex / 3) | 0) % 3) + vertexY * 0.03
      return [shade * 1.04, shade, shade * 0.94]
    }),
    applyFxAttribute(boulderGeometry, () => 0),
    boulderGeometry
  )
}

/**
 * 创建几何。
 *
 */
function buildCrystalShardGeometry() {
  const shardGeometry = new OctahedronGeometry(1, 0)
  return (
    shardGeometry.scale(1, 0.36, 0.36),
    shardGeometry.computeVertexNormals(),
    applyVertexColors(shardGeometry, (height) => {
      const brightness = 0.75 + 0.5 * Math.max(0, height)
      return [brightness, brightness, brightness]
    }),
    shardGeometry
  )
}

const SHAPE_POOL_QUAT_SCRATCH = new Quaternion(),
  SHAPE_POOL_EULER_SCRATCH = new Euler(0, 0, 0, "YZX"),
  SHAPE_POOL_POSITION_SCRATCH = new Vector3(),
  SHAPE_POOL_SCALE_SCRATCH = new Vector3(),
  SHAPE_POOL_MATRIX_SCRATCH = new Matrix4(),
  SHAPE_POOL_COLOR_SCRATCH = new Color()

class ShapePool {
  group = new Group()
  now = 0
  resolve = null
  meshes = []
  tint = []
  fxp = []
  counts = []
  pool = []
  free = []
  live = []
  mat
  litMat
  seedN = 0
  dummy = new ParticleSprite()
  constructor() {
    ;((this.group.name = "fx.meshes"),
      (this.mat = new ShaderMaterial({ uniforms: { uNow: { value: 0 } }, vertexShader: VFX_VERTEX_SHADER, fragmentShader: VFX_FRAGMENT_SHADER, vertexColors: !0, side: DoubleSide })),
      configureParticleMaterial(this.mat),
      (this.litMat = createToonMaterial({ vertexColors: !0, flat: !0, steps: 2, rim: 0.35, glowBoost: 3.2 })))
    const unitCylinderGeometry = new CylinderGeometry(1, 1, 1, 24, 1, !0)
    unitCylinderGeometry.translate(0, 0.5, 0)
    const cylinderGeometry = new CylinderGeometry(1, 0.28, 1, 24, 5, !0)
    ;(cylinderGeometry.translate(0, 0.5, 0),
      [resetVertexColors(unitCylinderGeometry), resetVertexColors(new SphereGeometry(1, 24, 16)), buildGroundRingGeometry(), buildCrystalShardGeometry(), buildArrowGeometry(), buildWingGeometry(), resetVertexColors(cylinderGeometry), buildGroundDiscGeometry(), buildRockShardGeometry(), buildBoulderGeometry(), buildHornGeometry(), buildFeatherGeometry(), buildLeafGeometry()].forEach((shapeGeometry, lookupOption) => {
        const selectedSHAPE_SEGMENT_COUNTS = SHAPE_SEGMENT_COUNTS[lookupOption],
          hasResult = ROCK_SHAPES.has(lookupOption),
          instancedMesh = new InstancedMesh(shapeGeometry, hasResult ? this.litMat : this.mat, selectedSHAPE_SEGMENT_COUNTS)
        ;(instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage), (instancedMesh.frustumCulled = !1), (instancedMesh.count = 0), (instancedMesh.visible = !1))
        const instancedBufferAttribute = new InstancedBufferAttribute(new Float32Array(selectedSHAPE_SEGMENT_COUNTS * 4), 4),
          fxpAttribute = new InstancedBufferAttribute(new Float32Array(selectedSHAPE_SEGMENT_COUNTS * 4), 4)
        ;(instancedBufferAttribute.setUsage(DynamicDrawUsage),
          fxpAttribute.setUsage(DynamicDrawUsage),
          hasResult
            ? ((instancedMesh.castShadow = !0), (instancedMesh.receiveShadow = !0), instancedMesh.setColorAt(0, SHAPE_POOL_COLOR_SCRATCH.setRGB(1, 1, 1)), instancedMesh.instanceColor.setUsage(DynamicDrawUsage), (instancedMesh.name = "fx.lit" + lookupOption))
            : (shapeGeometry.setAttribute("aTint", instancedBufferAttribute), shapeGeometry.setAttribute("aFxp", fxpAttribute), (instancedMesh.renderOrder = 7), (instancedMesh.name = "fx.glow" + lookupOption)),
          this.meshes.push(instancedMesh),
          this.tint.push(instancedBufferAttribute),
          this.fxp.push(fxpAttribute),
          this.counts.push(0),
          this.group.add(instancedMesh))
      }))
    for (let index = 0; index < VFX_LIFETIME; index++) {
      const lookupKey = new ParticleSprite()
      ;(this.pool.push(lookupKey), this.free.push(lookupKey))
    }
  }
  take(shape, mode, life, isManual) {
    const popResult = this.free.pop()
    return popResult
      ? ((popResult.alive = !0),
        (popResult.shape = shape),
        (popResult.mode = mode),
        (popResult.t0 = this.now),
        (popResult.life = life),
        (popResult.manual = isManual),
        (popResult.x = popResult.y = popResult.z = 0),
        (popResult.vx = popResult.vy = popResult.vz = 0),
        (popResult.gravity = 0),
        (popResult.sx0 = popResult.sy0 = popResult.sz0 = popResult.sx1 = popResult.sy1 = popResult.sz1 = 1),
        (popResult.ease = 1),
        (popResult.rx = popResult.ry = popResult.rz = 0),
        (popResult.wx = popResult.wy = popResult.wz = 0),
        (popResult.r = popResult.g = popResult.b = 1),
        (popResult.a = 1),
        (popResult.fadeIn = 0.08),
        (popResult.fadeOut = 0.4),
        (popResult.add = 1),
        (popResult.k = 2),
        (popResult.progress = -1),
        (popResult.seed = this.seedN = (this.seedN + 0.6180339) % 1),
        (popResult.followId = -1),
        this.live.push(popResult),
        popResult)
      : this.dummy
  }
  spawn(shape, pillar, life) {
    return this.take(shape, pillar, life, !1)
  }
  hold(sphere, mode) {
    return this.take(sphere, mode, 1, !0)
  }
  release(sprite) {
    sprite && (sprite.alive = !1)
  }
  flush() {
    this.mat.uniforms.uNow.value = this.now
    const shapeCounts = this.counts
    for (let lookupKey = 0; lookupKey < shapeCounts.length; lookupKey++) shapeCounts[lookupKey] = 0
    const liveState = this.live
    let liveCount = 0
    for (let spriteIndex = 0; spriteIndex < liveState.length; spriteIndex++) {
      const selectedE = liveState[spriteIndex],
        age = this.now - selectedE.t0,
        progress = selectedE.manual ? 0 : age / selectedE.life
      if (!selectedE.alive || progress >= 1) {
        ;((selectedE.alive = !1), this.free.push(selectedE))
        continue
      }
      if (((liveState[liveCount++] = selectedE), age < 0)) continue
      const shapeValue = selectedE.shape,
        selectedT = shapeCounts[shapeValue]
      if (selectedT >= SHAPE_SEGMENT_COUNTS[shapeValue]) continue
      let easedProgress = progress,
        squashAmount = 0
      if (selectedE.ease === 1) easedProgress = 1 - (1 - progress) * (1 - progress)
      else if (selectedE.ease === 2) easedProgress = easeOutBack(Math.min(1, progress * 2.2))
      else if (selectedE.ease === 3) easedProgress = progress * progress
      else if (selectedE.ease === 4) {
        easedProgress = easeOutBack(Math.min(1, progress * 4))
        const squashRatio = (progress - 0.65) / 0.35
        squashRatio > 0 && (squashAmount = squashRatio * squashRatio)
      }
      const scaleX = selectedE.sx0 + (selectedE.sx1 - selectedE.sx0) * easedProgress,
        scaleY = selectedE.sy0 + (selectedE.sy1 - selectedE.sy0) * easedProgress,
        scaleZ = selectedE.sz0 + (selectedE.sz1 - selectedE.sz0) * easedProgress
      let posX = selectedE.x + selectedE.vx * age,
        total = selectedE.y + selectedE.vy * age - 0.5 * selectedE.gravity * age * age,
        posZ = selectedE.z + selectedE.vz * age
      ;(selectedE.followId >= 0 && this.resolve && this.resolve(selectedE.followId, SHAPE_POOL_POSITION_SCRATCH) && ((posX += SHAPE_POOL_POSITION_SCRATCH.x), (total += SHAPE_POOL_POSITION_SCRATCH.y), (posZ += SHAPE_POOL_POSITION_SCRATCH.z)),
        squashAmount > 0 && (total -= scaleY * squashAmount * 1.05),
        SHAPE_POOL_EULER_SCRATCH.set(selectedE.rx + selectedE.wx * age, selectedE.ry + selectedE.wy * age, selectedE.rz + selectedE.wz * age),
        SHAPE_POOL_QUAT_SCRATCH.setFromEuler(SHAPE_POOL_EULER_SCRATCH),
        SHAPE_POOL_POSITION_SCRATCH.set(posX, total, posZ),
        SHAPE_POOL_SCALE_SCRATCH.set(scaleX, scaleY, scaleZ),
        SHAPE_POOL_MATRIX_SCRATCH.compose(SHAPE_POOL_POSITION_SCRATCH, SHAPE_POOL_QUAT_SCRATCH, SHAPE_POOL_SCALE_SCRATCH))
      const selectedMeshes = this.meshes[shapeValue]
      if ((selectedMeshes.setMatrixAt(selectedT, SHAPE_POOL_MATRIX_SCRATCH), ROCK_SHAPES.has(shapeValue))) selectedMeshes.setColorAt(selectedT, SHAPE_POOL_COLOR_SCRATCH.setRGB(selectedE.r, selectedE.g, selectedE.b))
      else {
        let alpha = selectedE.a
        if (!selectedE.manual && (selectedE.fadeIn > 0 && progress < selectedE.fadeIn && (alpha *= progress / selectedE.fadeIn), progress > selectedE.fadeOut)) {
          const fadeFactor = 1 - (progress - selectedE.fadeOut) / (1 - selectedE.fadeOut)
          alpha *= fadeFactor * fadeFactor
        }
        const tintArray = this.tint[shapeValue].array,
          fxpArray = this.fxp[shapeValue].array,
          arrayOffset = selectedT * 4
        ;((tintArray[arrayOffset] = selectedE.r),
          (tintArray[arrayOffset + 1] = selectedE.g),
          (tintArray[arrayOffset + 2] = selectedE.b),
          (tintArray[arrayOffset + 3] = alpha),
          (fxpArray[arrayOffset] = selectedE.mode + Math.min(1, Math.max(0, selectedE.add)) * 0.9),
          (fxpArray[arrayOffset + 1] = selectedE.seed),
          (fxpArray[arrayOffset + 2] = selectedE.progress >= 0 ? selectedE.progress : selectedE.progress <= -2 ? -1 : progress),
          (fxpArray[arrayOffset + 3] = selectedE.k))
      }
      shapeCounts[shapeValue] = selectedT + 1
    }
    liveState.length = liveCount
    for (let shapeIndex = 0; shapeIndex < shapeCounts.length; shapeIndex++) {
      const shapeMesh = this.meshes[shapeIndex],
        shapeCount = shapeCounts[shapeIndex]
      ;((shapeMesh.count = shapeCount),
        (shapeMesh.visible = shapeCount > 0),
        shapeCount !== 0 && ((shapeMesh.instanceMatrix.needsUpdate = !0), ROCK_SHAPES.has(shapeIndex) ? shapeMesh.instanceColor && (shapeMesh.instanceColor.needsUpdate = !0) : ((this.tint[shapeIndex].needsUpdate = !0), (this.fxp[shapeIndex].needsUpdate = !0))))
    }
  }
  /**
   * 处理几何。
   *
  */
  get activeShapes() {
    let result = 0
    for (const shapeCount of this.counts) shapeCount > 0 && result++
    return result
  }
  clear() {
    for (const sprite of this.live) sprite.alive = !1
  }
  dispose() {
    for (const shapeMesh of this.meshes) (shapeMesh.geometry.dispose(), shapeMesh.dispose())
    ;(this.mat.dispose(), this.litMat.dispose())
  }
}

const SPRITE_ATTRIBUTE_STRIDE = 28,
  MAX_PARTICLE_CAPACITY = 6144,
  SPRITE_LAYOUTS = { billboard: 0, stretch: 1, flat: 2 }

/**
 * 创建精灵与配置。
 *
 * @param spriteConfig - 主要输入
 * @returns 结果对象
 */
function makeSpriteSpec(spriteConfig) {
  const intensity = spriteConfig.intensity ?? 1
  return {
    sprite: spriteConfig.sprite,
    sprite2: spriteConfig.sprite2 ?? spriteConfig.sprite,
    add: spriteConfig.add ?? 1,
    c0: new Color(spriteConfig.color ?? 16777215),
    c1: new Color(spriteConfig.color2 ?? spriteConfig.color ?? 16777215),
    i0: intensity,
    i1: spriteConfig.intensity2 ?? intensity,
    a0: spriteConfig.alpha ?? 1,
    a1: spriteConfig.alpha2 ?? spriteConfig.alpha ?? 1,
    fadeIn: spriteConfig.fadeIn ?? 0.06,
    fadeOut: spriteConfig.fadeOut ?? 0.45,
    gravity: spriteConfig.gravity ?? 0,
    drag: spriteConfig.drag ?? 0,
    orient: spriteConfig.orient ?? SPRITE_LAYOUTS.billboard,
    stretch: spriteConfig.stretch ?? 0,
    spin: spriteConfig.spin ?? 0,
    rot: spriteConfig.rot ?? NaN,
    vary: spriteConfig.vary ?? 0,
    scale: spriteConfig.scale ?? 1,
    pull: spriteConfig.pull ?? 0,
  }
}

const PARTICLE_VERTEX_SHADER = `
uniform float uNow;
uniform vec2 uAtlas;
attribute vec4 aP;
attribute vec4 aV;
attribute vec4 aM;
attribute vec4 aS;
attribute vec4 aC0;
attribute vec4 aC1;
attribute vec4 aX;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vMix;
void main() {
  float age = uNow - aP.w;
  float life = aV.w;
  float t = life > 0.0 ? age / life : 2.0;
  if (age < 0.0 || t >= 1.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float motion = step(3.5, aS.w);
  float orient = aS.w - motion * 4.0;
  vec3 pos;
  vec3 vel;
  float rot;
  if (motion < 0.5) {
    // 弹道：线性阻尼 + 重力(有阻尼时趋向终端速度)
    float k = aM.y;
    float g = aM.x;
    if (k > 0.001) {
      float e = exp(-k * age);
      float f = (1.0 - e) / k;
      pos = aP.xyz + aV.xyz * f;
      vel = aV.xyz * e;
      pos.y -= g * (age - f) / k;
      vel.y -= g * (1.0 - e) / k;
    } else {
      pos = aP.xyz + aV.xyz * age;
      vel = aV.xyz;
      pos.y -= 0.5 * g * age * age;
      vel.y -= g * age;
    }
    // 受重力的碎屑落到地面就停住
    if (g > 0.0) pos.y = max(pos.y, 0.05);
    rot = aM.z + aM.w * age;
  } else {
    // 环绕：半径 r0→r1，角度 θ0 + ω·age，竖直匀速(可带重力)
    float r = mix(aV.x, aV.z, t);
    float th = aM.z + aM.w * age;
    float cs = cos(th);
    float sn = sin(th);
    pos = aP.xyz + vec3(cs * r, aV.y * age - 0.5 * aM.x * age * age, sn * r);
    vel = vec3(-sn * r * aM.w + cs * (aV.z - aV.x) / life, aV.y - aM.x * age, cs * r * aM.w + sn * (aV.z - aV.x) / life);
    rot = -th;
  }
  float grow = 1.0 - (1.0 - t) * (1.0 - t);
  float size = mix(aS.x, aS.y, grow);
  float alpha = mix(aC0.a, aC1.a, t) * smoothstep(0.0, max(aX.z, 1e-4), t) * (1.0 - smoothstep(aX.w, 1.0, t));
  vec3 color = mix(aC0.rgb, aC1.rgb, t);
  vec2 corner = position.xy;
  vec4 mv;
  if (orient < 0.5) {
    float cr = cos(rot);
    float sr = sin(rot);
    mv = viewMatrix * vec4(pos, 1.0);
    mv.xy += vec2(corner.x * cr - corner.y * sr, corner.x * sr + corner.y * cr) * size;
    // 朝相机拉近半个身位(+ 样式指定的额外量)：贴近地面的公告板下半截不会被地面裁掉
    mv.z += size * 0.5 + aS.z;
  } else if (orient < 1.5) {
    mv = viewMatrix * vec4(pos, 1.0);
    vec3 vv = (viewMatrix * vec4(vel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 d = sp > 1e-4 ? vv.xy / sp : vec2(1.0, 0.0);
    float len = size + aS.z * length(vel);
    mv.xy += d * (corner.x * len) + vec2(-d.y, d.x) * (corner.y * size);
    mv.z += size * 0.5;
  } else {
    float cr = cos(rot);
    float sr = sin(rot);
    vec2 q = vec2(corner.x * cr - corner.y * sr, corner.x * sr + corner.y * cr) * size;
    mv = viewMatrix * vec4(pos + vec3(q.x, 0.0, q.y), 1.0);
  }
  gl_Position = projectionMatrix * mv;
  float cell = aX.x;
  float cx = mod(cell, ${ATLAS_COLS}.0);
  float cy = floor(cell / ${ATLAS_COLS}.0);
  vUv = (vec2(cx, cy) + vec2(corner.x + 0.5, 0.5 - corner.y)) * uAtlas;
  vColor = vec4(color, alpha);
  vMix = vec2(aX.y, max(color.r, max(color.g, color.b)) * 0.85);
}
`,
  RIBBON_VERTEX_SHADER = `
uniform sampler2D tAtlas;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vMix;
${GLSL_ADDITIVE}
void main() {
  vec4 tx = texture2D(tAtlas, vUv);
  float fxA = min(1.0, tx.r * vColor.a);
  if (fxA < 0.004) discard;
  float fxAdd = vMix.x;
  // 亮核主要是把本色提亮，只掺一点白：大量粒子叠在一起时颜色不至于被冲成纯白
  vec3 fxC = vColor.rgb * (tx.g + tx.b * 0.6) + vec3(tx.b * vMix.y * 0.3);
  ${PARTICLE_TONEMAP_GLSL}
}
`

class InstancedSpriteBuffer {
  mesh
  now = 0
  spawned = 0
  data
  buffer
  geo
  mat
  cap
  cursor = 0
  dirtyStart = 0
  dirtyCount = 0
  rangeA = { start: 0, count: 0 }
  rangeB = { start: 0, count: 0 }
  rnd = new SeededRandom(5370206)
  aliveUntil = 0
  st = makeSpriteSpec({ sprite: 0 })
  r0 = 1
  g0 = 1
  b0 = 1
  r1 = 1
  g1 = 1
  b1 = 1
  constructor(atlasTexture, capacity) {
    ;((this.cap = Math.min(MAX_PARTICLE_CAPACITY, capacity)), (this.data = new Float32Array(MAX_PARTICLE_CAPACITY * SPRITE_ATTRIBUTE_STRIDE)))
    const planeGeometry = new PlaneGeometry(1, 1),
      instancedBufferGeometry = new InstancedBufferGeometry()
    ;(instancedBufferGeometry.setIndex(planeGeometry.getIndex()), instancedBufferGeometry.setAttribute("position", planeGeometry.getAttribute("position")))
    const instancedInterleavedBuffer = new InstancedInterleavedBuffer(this.data, SPRITE_ATTRIBUTE_STRIDE, 1)
    ;(instancedInterleavedBuffer.setUsage(DynamicDrawUsage),
      instancedInterleavedBuffer.onUpload(() => {
        this.dirtyCount = 0
      }),
      ["aP", "aV", "aM", "aS", "aC0", "aC1", "aX"].forEach((attributeName, attributeOffset) => instancedBufferGeometry.setAttribute(attributeName, new InterleavedBufferAttribute(instancedInterleavedBuffer, 4, attributeOffset * 4))),
      (instancedBufferGeometry.instanceCount = this.cap),
      (this.buffer = instancedInterleavedBuffer),
      (this.geo = instancedBufferGeometry),
      (this.mat = new ShaderMaterial({ uniforms: { uNow: { value: 0 }, uAtlas: { value: new Vector2(1 / ATLAS_COLS, 1 / ATLAS_ROWS) }, tAtlas: { value: atlasTexture } }, vertexShader: PARTICLE_VERTEX_SHADER, fragmentShader: RIBBON_VERTEX_SHADER, depthTest: !0 })),
      configureParticleMaterial(this.mat),
      (this.mesh = new Mesh(instancedBufferGeometry, this.mat)),
      (this.mesh.name = "fx.particles"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.renderOrder = 9))
  }
  setCapacity(capacity) {
    ;((this.cap = Math.max(256, Math.min(MAX_PARTICLE_CAPACITY, capacity))), this.cursor >= this.cap && (this.cursor = 0), (this.geo.instanceCount = this.cap))
  }
  get capacity() {
    return this.cap
  }
  use(spriteSpec) {
    return ((this.st = spriteSpec), (this.r0 = spriteSpec.c0.r * spriteSpec.i0), (this.g0 = spriteSpec.c0.g * spriteSpec.i0), (this.b0 = spriteSpec.c0.b * spriteSpec.i0), (this.r1 = spriteSpec.c1.r * spriteSpec.i1), (this.g1 = spriteSpec.c1.g * spriteSpec.i1), (this.b1 = spriteSpec.c1.b * spriteSpec.i1), this)
  }
  tint(white, abyssCyan = white) {
    const stState = this.st
    return ((this.r0 = white.r * stState.i0), (this.g0 = white.g * stState.i0), (this.b0 = white.b * stState.i0), (this.r1 = abyssCyan.r * stState.i1), (this.g1 = abyssCyan.g * stState.i1), (this.b1 = abyssCyan.b * stState.i1), this)
  }
  write(orientation, rotation, spinRate, life, startSize, endSize, birthDelay) {
    const stValue = this.st,
      dataState = this.data,
      cursor = this.cursor,
      dataOffset = cursor * SPRITE_ATTRIBUTE_STRIDE,
      intensityVariation = stValue.vary > 0 ? 1 - stValue.vary * this.rnd.next() : 1
    return (
      (dataState[dataOffset + 3] = this.now + birthDelay),
      (dataState[dataOffset + 7] = life),
      this.now + birthDelay + life > this.aliveUntil && (this.aliveUntil = this.now + birthDelay + life),
      (dataState[dataOffset + 8] = stValue.gravity),
      (dataState[dataOffset + 9] = stValue.drag),
      (dataState[dataOffset + 10] = rotation),
      (dataState[dataOffset + 11] = spinRate),
      (dataState[dataOffset + 12] = startSize * stValue.scale),
      (dataState[dataOffset + 13] = endSize * stValue.scale),
      (dataState[dataOffset + 14] = stValue.orient === SPRITE_LAYOUTS.stretch ? stValue.stretch : stValue.pull),
      (dataState[dataOffset + 15] = orientation),
      (dataState[dataOffset + 16] = this.r0 * intensityVariation),
      (dataState[dataOffset + 17] = this.g0 * intensityVariation),
      (dataState[dataOffset + 18] = this.b0 * intensityVariation),
      (dataState[dataOffset + 19] = stValue.a0),
      (dataState[dataOffset + 20] = this.r1 * intensityVariation),
      (dataState[dataOffset + 21] = this.g1 * intensityVariation),
      (dataState[dataOffset + 22] = this.b1 * intensityVariation),
      (dataState[dataOffset + 23] = stValue.a1),
      (dataState[dataOffset + 24] = stValue.sprite2 !== stValue.sprite && this.rnd.next() < 0.5 ? stValue.sprite2 : stValue.sprite),
      (dataState[dataOffset + 25] = stValue.add),
      (dataState[dataOffset + 26] = stValue.fadeIn),
      (dataState[dataOffset + 27] = stValue.fadeOut),
      this.dirtyCount === 0 && (this.dirtyStart = cursor),
      this.dirtyCount < this.cap && this.dirtyCount++,
      (this.cursor = cursor + 1 >= this.cap ? 0 : cursor + 1),
      this.spawned++,
      dataOffset
    )
  }
  spawn(posX, posY, posZ, velocityX, velocityY, velocityZ, flashSkill, startSize, endSize, birthDelay = 0) {
    const spriteSpec = this.st,
      rotation = Number.isNaN(spriteSpec.rot) ? this.rnd.next() * 6.2831853 : spriteSpec.rot,
      spinRate = spriteSpec.spin !== 0 ? spriteSpec.spin * this.rnd.signed() : 0,
      writeResult = this.write(spriteSpec.orient, rotation, spinRate, flashSkill, startSize, endSize, birthDelay),
      dataValue = this.data
    ;((dataValue[writeResult] = posX), (dataValue[writeResult + 1] = posY), (dataValue[writeResult + 2] = posZ), (dataValue[writeResult + 4] = velocityX), (dataValue[writeResult + 5] = velocityY), (dataValue[writeResult + 6] = velocityZ))
  }
  orbit(posX, posY, posZ, startRadius, endRadius, rotation, spinRate, verticalSpeed, life, startSize, endSize, birthDelay = 0) {
    const writeCursor = this.write(this.st.orient + 4, rotation, spinRate, life, startSize, endSize, birthDelay),
      spriteData = this.data
    ;((spriteData[writeCursor] = posX), (spriteData[writeCursor + 1] = posY), (spriteData[writeCursor + 2] = posZ), (spriteData[writeCursor + 4] = startRadius), (spriteData[writeCursor + 5] = verticalSpeed), (spriteData[writeCursor + 6] = endRadius))
  }
  flush() {
    ;((this.mat.uniforms.uNow.value = this.now), (this.mesh.visible = this.now < this.aliveUntil))
    const dirtyCount = this.dirtyCount
    if (dirtyCount === 0) return
    const spriteBuffer = this.buffer
    if (((spriteBuffer.updateRanges.length = 0), dirtyCount < this.cap)) {
      const dirtyEnd = this.dirtyStart + dirtyCount
      dirtyEnd <= this.cap
        ? ((this.rangeA.start = this.dirtyStart * SPRITE_ATTRIBUTE_STRIDE), (this.rangeA.count = dirtyCount * SPRITE_ATTRIBUTE_STRIDE), spriteBuffer.updateRanges.push(this.rangeA))
        : ((this.rangeA.start = this.dirtyStart * SPRITE_ATTRIBUTE_STRIDE),
          (this.rangeA.count = (this.cap - this.dirtyStart) * SPRITE_ATTRIBUTE_STRIDE),
          (this.rangeB.start = 0),
          (this.rangeB.count = (dirtyEnd - this.cap) * SPRITE_ATTRIBUTE_STRIDE),
          spriteBuffer.updateRanges.push(this.rangeA, this.rangeB))
    }
    spriteBuffer.needsUpdate = !0
  }
  liveCount() {
    const spriteData = this.data
    let liveCount = 0
    for (let index = 0; index < this.cap; index++) {
      const dataOffset = index * SPRITE_ATTRIBUTE_STRIDE,
        age = this.now - spriteData[dataOffset + 3]
      age >= 0 && age < spriteData[dataOffset + 7] && liveCount++
    }
    return liveCount
  }
  clear() {
    const spriteData = this.data
    for (let index = 0; index < MAX_PARTICLE_CAPACITY; index++) spriteData[index * SPRITE_ATTRIBUTE_STRIDE + 7] = 0
    ;((this.cursor = 0), (this.dirtyStart = 0), (this.dirtyCount = this.cap), (this.aliveUntil = 0))
  }
  dispose() {
    ;(this.geo.dispose(), this.mat.dispose())
  }
}

const SPRITE_CAPACITY = 56,
  MAX_SPRITES = 16,
  SPRITE_STRIDE = 16

/**
 * 创建配置。
 *
 * @param ribbonConfig - 主要输入
 * @returns 结果对象
 */
function makeRibbonSpec(ribbonConfig) {
  const intensity = ribbonConfig.intensity ?? 1
  return {
    width: ribbonConfig.width,
    life: ribbonConfig.life,
    c0: new Color(ribbonConfig.color),
    c1: new Color(ribbonConfig.color2 ?? ribbonConfig.color),
    i0: intensity,
    i1: ribbonConfig.intensity2 ?? intensity,
    add: ribbonConfig.add ?? 1,
    taper: ribbonConfig.taper ?? 0,
    noise: ribbonConfig.noise ?? 0,
    flat: ribbonConfig.flat ? 1 : 0,
    core: ribbonConfig.core ?? 0.5,
    alpha: ribbonConfig.alpha ?? 1,
    step: ribbonConfig.step ?? 0.25,
  }
}

class RibbonState {
  active = !1
  emitting = !1
  once = !1
  stale = !1
  gen = 0
  style = makeRibbonSpec({ width: 0.1, life: 0.1, color: 16777215 })
  c0 = new Color()
  c1 = new Color()
  widthScale = 1
  px = new Float32Array(MAX_SPRITES)
  py = new Float32Array(MAX_SPRITES)
  pz = new Float32Array(MAX_SPRITES)
  birth = new Float32Array(MAX_SPRITES)
  head = -1
  count = 0
  hx = 0
  hy = 0
  hz = 0
  endTime = 0
}

const RIBBON_FRAGMENT_SHADER = `
attribute vec3 aTan;
attribute vec4 aRib;
attribute vec4 aCol;
attribute vec2 aFx;
varying vec4 vCol;
varying vec4 vRib;
varying vec2 vFx;
void main() {
  float side = uv.x;
  float hw = aRib.x;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  if (aRib.w > 0.5) {
    vec2 t = aTan.xz;
    float l = length(t);
    t = l > 1e-5 ? t / l : vec2(1.0, 0.0);
    mv = viewMatrix * vec4(position + vec3(-t.y, 0.0, t.x) * (side * hw), 1.0);
  } else {
    vec3 tv = (viewMatrix * vec4(aTan, 0.0)).xyz;
    vec3 nv = cross(tv, mv.xyz);
    float l = length(nv);
    nv = l > 1e-6 ? nv / l : vec3(0.0, 1.0, 0.0);
    mv.xyz += nv * (side * hw);
  }
  gl_Position = projectionMatrix * mv;
  vCol = aCol;
  vRib = vec4(side, aRib.y, aRib.z, uv.y);
  vFx = aFx;
}
`,
  RIBBON_COMPOSE_SHADER = `
uniform float uNow;
varying vec4 vCol;
varying vec4 vRib;
varying vec2 vFx;
${GLSL_HASH_NOISE}
${GLSL_ADDITIVE}
void main() {
  float v = vRib.x;
  float prof = max(0.0, 1.0 - v * v);
  float a = prof * sqrt(prof);
  if (vFx.x > 0.0) {
    // 噪声顺着带子向尾部流动，把边缘侵蚀成火舌/烟缕
    float n = fbm(vec2(vRib.y * 5.0 + vRib.w * 3.0 - uNow * 2.6, v * 1.6 + vRib.w * 7.0));
    a *= mix(1.0, smoothstep(0.25, 0.75, n + prof * 0.45 - vRib.y * 0.35), vFx.x);
  }
  float fxA = min(1.0, a * vRib.z);
  if (fxA < 0.004) discard;
  float fxAdd = vCol.a;
  float m = max(vCol.r, max(vCol.g, vCol.b));
  float core = vFx.y * prof * prof * prof;
  vec3 fxC = vCol.rgb * (1.0 + core * 0.6) + vec3(m * core * 0.3);
  ${PARTICLE_TONEMAP_GLSL}
}
`

export { makeSpriteSpec, buildStagedAssets, InstancedSpriteBuffer, RIBBON_VERTEX_SHADER, SPRITE_STRIDE, RibbonState, SPRITE_LAYOUTS, ShapePool, SPRITE_CAPACITY, RIBBON_FRAGMENT_SHADER, RIBBON_COMPOSE_SHADER, loadAssetsStaged, MAX_SPRITES, makeRibbonSpec }