/**
 * 后处理管线：全屏四边形、着色器通道、模板/覆盖材质通道、合成与 PostRenderer
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferGeometry, Clock, Color, DataTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Mesh, NoBlending, OrthographicCamera, Plane, RawShaderMaterial, Ray, ShaderMaterial, UniformsUtils, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer } from 'three'
import { BLOOM_COMPOSITE_FRAG, BLOOM_LEVELS, BLOOM_LEVEL_WEIGHTS, BLOOM_PREFILTER_FRAG, BLUR_FRAG, FULLSCREEN_VERT } from '../bloom-shaders'
import { POSTFX_FRAGMENT } from '../postfx-shader'

const COPY_SHADER = {
  name: "CopyShader",
  uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
  vertexShader: `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`,
}

class RenderPass {
  declare isPass: boolean
  declare enabled: boolean
  declare needsSwap: boolean
  declare clear: boolean
  declare renderToScreen: boolean

  constructor() {
    ;((this.isPass = !0), (this.enabled = !0), (this.needsSwap = !0), (this.clear = !1), (this.renderToScreen = !1))
  }
  setSize(...args: any[]) {}
  render(...args: any[]) {
    console.error("THREE.Pass: .render() must be implemented in derived pass.")
  }
  dispose() {}
}

const FULLSCREEN_ORTHO_CAMERA = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

class FullscreenQuadGeometry extends BufferGeometry {
  declare setAttribute: (name: string, attr: Float32BufferAttribute) => this
  constructor() {
    ;(super(), this.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)), this.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2)))
  }
}

const fullscreenQuadGeometry = new FullscreenQuadGeometry()

class FullscreenQuad {
  declare _mesh: Mesh

  constructor(initialMaterial?: any) {
    this._mesh = new Mesh(fullscreenQuadGeometry, initialMaterial)
  }
  dispose() {
    this._mesh.geometry.dispose()
  }
  render(renderer) {
    renderer.render(this._mesh, FULLSCREEN_ORTHO_CAMERA)
  }
  get material() {
    return this._mesh.material
  }
  set material(newMaterial) {
    this._mesh.material = newMaterial
  }
}

class ShaderPass extends RenderPass {
  declare textureID: any
  declare uniforms: any
  declare material: any
  declare _fsQuad: FullscreenQuad

  constructor(shaderMaterial, textureUniformName = "tDiffuse") {
    ;(super(),
      (this.textureID = textureUniformName),
      (this.uniforms = null),
      (this.material = null),
      shaderMaterial instanceof ShaderMaterial
        ? ((this.uniforms = shaderMaterial.uniforms), (this.material = shaderMaterial))
        : shaderMaterial &&
          ((this.uniforms = UniformsUtils.clone(shaderMaterial.uniforms)),
          (this.material = new ShaderMaterial({
            name: shaderMaterial.name !== void 0 ? shaderMaterial.name : "unspecified",
            defines: Object.assign({}, shaderMaterial.defines),
            uniforms: this.uniforms,
            vertexShader: shaderMaterial.vertexShader,
            fragmentShader: shaderMaterial.fragmentShader,
          }))),
      (this._fsQuad = new FullscreenQuad(this.material)))
  }
  render(...renderArgs: any[]) {
    const [renderer, writeBuffer, readBuffer] = renderArgs
    ;(this.uniforms[this.textureID] && (this.uniforms[this.textureID].value = readBuffer.texture),
      (this._fsQuad.material = this.material),
      this.renderToScreen
        ? (renderer.setRenderTarget(null), this._fsQuad.render(renderer))
        : (renderer.setRenderTarget(writeBuffer), this.clear && renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil), this._fsQuad.render(renderer)))
  }
  dispose() {
    ;(this.material.dispose(), this._fsQuad.dispose())
  }
}

class SceneRenderPass extends RenderPass {
  declare scene: any
  declare camera: any
  declare clear: boolean
  declare needsSwap: boolean
  declare inverse: boolean

  constructor(scene, camera) {
    ;(super(), (this.scene = scene), (this.camera = camera), (this.clear = !0), (this.needsSwap = !1), (this.inverse = !1))
  }
  render(builder, writeBuffer, readBuffer) {
    const ContextValue = builder.getContext(),
      renderState = builder.state
    ;(renderState.buffers.color.setMask(!1), renderState.buffers.depth.setMask(!1), renderState.buffers.color.setLocked(!0), renderState.buffers.depth.setLocked(!0))
    let stencilRefValue, stencilClearValue
    ;(this.inverse ? ((stencilRefValue = 0), (stencilClearValue = 1)) : ((stencilRefValue = 1), (stencilClearValue = 0)),
      renderState.buffers.stencil.setTest(!0),
      renderState.buffers.stencil.setOp(ContextValue.REPLACE, ContextValue.REPLACE, ContextValue.REPLACE),
      renderState.buffers.stencil.setFunc(ContextValue.ALWAYS, stencilRefValue, 4294967295),
      renderState.buffers.stencil.setClear(stencilClearValue),
      renderState.buffers.stencil.setLocked(!0),
      builder.setRenderTarget(readBuffer),
      this.clear && builder.clear(),
      builder.render(this.scene, this.camera),
      builder.setRenderTarget(writeBuffer),
      this.clear && builder.clear(),
      builder.render(this.scene, this.camera),
      renderState.buffers.color.setLocked(!1),
      renderState.buffers.depth.setLocked(!1),
      renderState.buffers.color.setMask(!0),
      renderState.buffers.depth.setMask(!0),
      renderState.buffers.stencil.setLocked(!1),
      renderState.buffers.stencil.setFunc(ContextValue.EQUAL, 1, 4294967295),
      renderState.buffers.stencil.setOp(ContextValue.KEEP, ContextValue.KEEP, ContextValue.KEEP),
      renderState.buffers.stencil.setLocked(!0))
  }
}

class StencilResetPass extends RenderPass {
  declare needsSwap: boolean

  constructor() {
    ;(super(), (this.needsSwap = !1))
  }
  render(world) {
    ;(world.state.buffers.stencil.setLocked(!1), world.state.buffers.stencil.setTest(!1))
  }
}

class PostPipeline {
  declare renderer: any
  declare _pixelRatio: any
  declare _width: any
  declare _height: any
  declare renderTarget1: any
  declare renderTarget2: any
  declare writeBuffer: any
  declare readBuffer: any
  declare renderToScreen: boolean
  declare passes: any[]
  declare copyPass: ShaderPass
  declare clock: Clock

  constructor(renderer, initialRenderTarget) {
    if (((this.renderer = renderer), (this._pixelRatio = renderer.getPixelRatio()), initialRenderTarget === void 0)) {
      const SizeValue = renderer.getSize(new Vector2())
      ;((this._width = SizeValue.width), (this._height = SizeValue.height), (initialRenderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: HalfFloatType })), (initialRenderTarget.texture.name = "EffectComposer.rt1"))
    } else ((this._width = initialRenderTarget.width), (this._height = initialRenderTarget.height))
    ;((this.renderTarget1 = initialRenderTarget),
      (this.renderTarget2 = initialRenderTarget.clone()),
      (this.renderTarget2.texture.name = "EffectComposer.rt2"),
      (this.writeBuffer = this.renderTarget1),
      (this.readBuffer = this.renderTarget2),
      (this.renderToScreen = !0),
      (this.passes = []),
      (this.copyPass = new ShaderPass(COPY_SHADER)),
      (this.copyPass.material.blending = NoBlending),
      (this.clock = new Clock()))
  }
  swapBuffers() {
    const previousReadBuffer = this.readBuffer
    ;((this.readBuffer = this.writeBuffer), (this.writeBuffer = previousReadBuffer))
  }
  addPass(pass) {
    ;(this.passes.push(pass), pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio))
  }
  insertPass(pass, passIndex) {
    ;(this.passes.splice(passIndex, 0, pass), pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio))
  }
  removePass(pass) {
    const passIndex = this.passes.indexOf(pass)
    passIndex !== -1 && this.passes.splice(passIndex, 1)
  }
  isLastEnabledPass(lookupKey) {
    for (let index = lookupKey + 1; index < this.passes.length; index++) if (this.passes[index].enabled) return !1
    return !0
  }
  render(deltaTime) {
    deltaTime === void 0 && (deltaTime = this.clock.getDelta())
    const RenderTargetValue = this.renderer.getRenderTarget()
    let isActive = !1
    for (let index = 0, lengthValue = this.passes.length; index < lengthValue; index++) {
      const selectedPasses = this.passes[index]
      if (selectedPasses.enabled !== !1) {
        if (((selectedPasses.renderToScreen = this.renderToScreen && this.isLastEnabledPass(index)), selectedPasses.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, isActive), selectedPasses.needsSwap)) {
          if (isActive) {
            const getContextContextValue = this.renderer.getContext(),
              stencilBuffer = this.renderer.state.buffers.stencil
            ;(stencilBuffer.setFunc(getContextContextValue.NOTEQUAL, 1, 4294967295), this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime), stencilBuffer.setFunc(getContextContextValue.EQUAL, 1, 4294967295))
          }
          this.swapBuffers()
        }
        SceneRenderPass !== void 0 && (selectedPasses instanceof SceneRenderPass ? (isActive = !0) : selectedPasses instanceof StencilResetPass && (isActive = !1))
      }
    }
    this.renderer.setRenderTarget(RenderTargetValue)
  }
  reset(initialRenderTarget) {
    if (initialRenderTarget === void 0) {
      const getSizeSizeValue = this.renderer.getSize(new Vector2())
      ;((this._pixelRatio = this.renderer.getPixelRatio()),
        (this._width = getSizeSizeValue.width),
        (this._height = getSizeSizeValue.height),
        (initialRenderTarget = this.renderTarget1.clone()),
        initialRenderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio))
    }
    ;(this.renderTarget1.dispose(),
      this.renderTarget2.dispose(),
      (this.renderTarget1 = initialRenderTarget),
      (this.renderTarget2 = initialRenderTarget.clone()),
      (this.writeBuffer = this.renderTarget1),
      (this.readBuffer = this.renderTarget2))
  }
  setSize(targetObject, propertyName) {
    ;((this._width = targetObject), (this._height = propertyName))
    const scaledWidth = this._width * this._pixelRatio,
      bufferHeight = this._height * this._pixelRatio
    ;(this.renderTarget1.setSize(scaledWidth, bufferHeight), this.renderTarget2.setSize(scaledWidth, bufferHeight))
    for (let index = 0; index < this.passes.length; index++) this.passes[index].setSize(scaledWidth, bufferHeight)
  }
  setPixelRatio(pixelRatio) {
    ;((this._pixelRatio = pixelRatio), this.setSize(this._width, this._height))
  }
  dispose() {
    ;(this.renderTarget1.dispose(), this.renderTarget2.dispose(), this.copyPass.dispose())
  }
}

class OverrideMaterialPass extends RenderPass {
  declare scene: any
  declare camera: any
  declare overrideMaterial: any
  declare clearColor: any
  declare clearAlpha: any
  declare clear: boolean
  declare clearDepth: boolean
  declare needsSwap: boolean
  declare _oldClearColor: Color

  constructor(scene, camera, overrideMaterial = null, clearColor = null, clearAlpha = null) {
    ;(super(),
      (this.scene = scene),
      (this.camera = camera),
      (this.overrideMaterial = overrideMaterial),
      (this.clearColor = clearColor),
      (this.clearAlpha = clearAlpha),
      (this.clear = !0),
      (this.clearDepth = !1),
      (this.needsSwap = !1),
      (this._oldClearColor = new Color()))
  }
  render(renderer, writeBuffer, readBuffer) {
    const previousAutoClear = renderer.autoClear
    renderer.autoClear = !1
    let previousClearAlpha, previousOverrideMaterial
    ;(this.overrideMaterial !== null && ((previousOverrideMaterial = this.scene.overrideMaterial), (this.scene.overrideMaterial = this.overrideMaterial)),
      this.clearColor !== null && (renderer.getClearColor(this._oldClearColor), renderer.setClearColor(this.clearColor, renderer.getClearAlpha())),
      this.clearAlpha !== null && ((previousClearAlpha = renderer.getClearAlpha()), renderer.setClearAlpha(this.clearAlpha)),
      this.clearDepth == !0 && renderer.clearDepth(),
      renderer.setRenderTarget(this.renderToScreen ? null : readBuffer),
      this.clear === !0 && renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil),
      renderer.render(this.scene, this.camera),
      this.clearColor !== null && renderer.setClearColor(this._oldClearColor),
      this.clearAlpha !== null && renderer.setClearAlpha(previousClearAlpha),
      this.overrideMaterial !== null && (this.scene.overrideMaterial = previousOverrideMaterial),
      (renderer.autoClear = previousAutoClear))
  }
}

class PostTargets extends RenderPass {
  declare needsSwap: boolean

  threshold = new Vector2(1.35, 0.25)
  levels = 5
  onBegin = null
  down = []
  up = []
  quad = new FullscreenQuad()
  prefilter
  downMat
  upMat
  black
  constructor() {
    ;(super(), (this.needsSwap = !1))
    const createShaderMaterial = (fragmentShader, shaderUniforms) => new ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: fragmentShader, uniforms: shaderUniforms, depthTest: !1, depthWrite: !1, toneMapped: !1 })
    ;((this.prefilter = createShaderMaterial(BLOOM_PREFILTER_FRAG, { tDiffuse: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: this.threshold } })),
      (this.downMat = createShaderMaterial(BLUR_FRAG, { tDiffuse: { value: null }, uTexel: { value: new Vector2() } })),
      (this.upMat = createShaderMaterial(BLOOM_COMPOSITE_FRAG, { tDiffuse: { value: null }, tBase: { value: null }, uTexel: { value: new Vector2() }, uSpread: { value: 1 }, uWeight: { value: new Vector2(1, 1) } })),
      (this.black = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)),
      (this.black.needsUpdate = !0))
    for (let index = 0; index < BLOOM_LEVELS; index++) (this.down.push(this.makeTarget()), this.up.push(this.makeTarget()))
  }
  makeTarget() {
    const bloomTarget = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: !1, magFilter: LinearFilter, minFilter: LinearFilter })
    return ((bloomTarget.texture.generateMipmaps = !1), bloomTarget)
  }
  get precompileSet() {
    return { materials: [this.prefilter, this.downMat, this.upMat], target: this.down[0] }
  }
  get texture() {
    return this.enabled ? this.up[0].texture : this.black
  }
  setSize(width, height) {
    let mipWidth = Math.max(2, Math.round(width / 2)),
      mipHeight = Math.max(2, Math.round(height / 2))
    for (let levelIndex = 0; levelIndex < BLOOM_LEVELS; levelIndex++) (this.down[levelIndex].setSize(mipWidth, mipHeight), this.up[levelIndex].setSize(mipWidth, mipHeight), (mipWidth = Math.max(2, Math.round(mipWidth / 2))), (mipHeight = Math.max(2, Math.round(mipHeight / 2))))
  }
  render(renderer, writeBuffer, readBuffer) {
    this.onBegin?.()
    const bloomLevelCount = Math.min(BLOOM_LEVELS, Math.max(2, this.levels)),
      quadState = this.quad
    ;((quadState.material = this.prefilter),
      (this.prefilter.uniforms.tDiffuse.value = readBuffer.texture),
      this.prefilter.uniforms.uTexel.value.set(0.5 / readBuffer.width, 0.5 / readBuffer.height),
      renderer.setRenderTarget(this.down[0]),
      quadState.render(renderer),
      (quadState.material = this.downMat))
    for (let downsampleLevel = 1; downsampleLevel < bloomLevelCount; downsampleLevel++) {
      const selectedDown = this.down[downsampleLevel - 1]
      ;((this.downMat.uniforms.tDiffuse.value = selectedDown.texture), this.downMat.uniforms.uTexel.value.set(1 / selectedDown.width, 1 / selectedDown.height), renderer.setRenderTarget(this.down[downsampleLevel]), quadState.render(renderer))
    }
    quadState.material = this.upMat
    let currentBloomTarget = this.down[bloomLevelCount - 1]
    for (let upsampleLevel = bloomLevelCount - 2; upsampleLevel >= 0; upsampleLevel--)
      ((this.upMat.uniforms.tDiffuse.value = currentBloomTarget.texture),
        (this.upMat.uniforms.tBase.value = this.down[upsampleLevel].texture),
        this.upMat.uniforms.uTexel.value.set(0.5 / currentBloomTarget.width, 0.5 / currentBloomTarget.height),
        this.upMat.uniforms.uWeight.value.set(upsampleLevel === bloomLevelCount - 2 ? BLOOM_LEVEL_WEIGHTS[bloomLevelCount - 1] : 1, BLOOM_LEVEL_WEIGHTS[upsampleLevel]),
        renderer.setRenderTarget(this.up[upsampleLevel]),
        quadState.render(renderer),
        (currentBloomTarget = this.up[upsampleLevel]))
    renderer.setRenderTarget(null)
  }
  dispose() {
    for (const downTarget of this.down) downTarget.dispose()
    for (const upTarget of this.up) upTarget.dispose()
    ;(this.prefilter.dispose(), this.downMat.dispose(), this.upMat.dispose(), this.black.dispose(), this.quad.dispose())
  }
}

class CompositePass extends RenderPass {
  material
  quad
  bloom
  grade
  gradeOn = !0
  onBegin = null
  constructor(bloomPass, gradeOptions) {
    ;(super(),
      (this.bloom = bloomPass),
      (this.grade = gradeOptions),
      (this.material = new RawShaderMaterial({
        vertexShader: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
        fragmentShader: POSTFX_FRAGMENT,
        uniforms: {
          tDiffuse: { value: null },
          tBloom: { value: null },
          toneMappingExposure: { value: 1 },
          uBloom: { value: 0 },
          uSaturation: { value: 1 },
          uVibrance: { value: 0 },
          uContrast: { value: new Vector2(1, 0.148) },
          uVignette: { value: 0 },
          uAspect: { value: 1 },
          uShadowTint: { value: gradeOptions.shadowTint },
          uHighlightTint: { value: gradeOptions.highlightTint },
          uHaze: { value: 0 },
          uHazeColor: { value: gradeOptions.hazeColor },
          uDesaturate: { value: 0 },
          uDim: { value: 0 },
        },
        defines: { GRADE: "" },
        depthTest: !1,
        depthWrite: !1,
      })),
      (this.quad = new FullscreenQuad(this.material)))
  }
  setGradeEnabled(isEnabled) {
    isEnabled !== this.gradeOn && ((this.gradeOn = isEnabled), isEnabled ? (this.material.defines.GRADE = "") : delete this.material.defines.GRADE, (this.material.needsUpdate = !0))
  }
  render(renderer, writeBuffer, readBuffer) {
    this.onBegin?.()
    const compositeUniforms = this.material.uniforms,
      gradeSettings = this.grade
    ;((compositeUniforms.tDiffuse.value = readBuffer.texture),
      (compositeUniforms.tBloom.value = this.bloom.texture),
      (compositeUniforms.toneMappingExposure.value = gradeSettings.exposure),
      (compositeUniforms.uBloom.value = this.bloom.enabled ? gradeSettings.bloomStrength : 0),
      (compositeUniforms.uSaturation.value = gradeSettings.saturation),
      (compositeUniforms.uVibrance.value = gradeSettings.vibrance),
      compositeUniforms.uContrast.value.set(gradeSettings.contrast, Math.pow(Math.max(0.02, gradeSettings.pivot), 2.2)),
      (compositeUniforms.uVignette.value = gradeSettings.vignette),
      (compositeUniforms.uAspect.value = readBuffer.width / Math.max(1, readBuffer.height)),
      (compositeUniforms.uHaze.value = gradeSettings.haze),
      (compositeUniforms.uDesaturate.value = gradeSettings.desaturate),
      (compositeUniforms.uDim.value = gradeSettings.dim),
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer),
      this.quad.render(renderer))
  }
  dispose() {
    ;(this.material.dispose(), this.quad.dispose())
  }
}

class PostRenderer {
  composer
  renderPass
  bloomPass
  finalPass
  grade
  target
  set onPostBegin(onBeginHandler) {
    ;((this.bloomPass.onBegin = onBeginHandler), (this.finalPass.onBegin = onBeginHandler))
  }
  constructor(renderer, scene, camera, gradeOptions, qualitySettings) {
    ;((this.grade = gradeOptions),
      (this.target = new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: qualitySettings.msaa, depthBuffer: !0, stencilBuffer: !1 })),
      (this.target.texture.name = "moba.scene"),
      (this.composer = new PostPipeline(renderer, this.target)),
      (this.renderPass = new OverrideMaterialPass(scene, camera)),
      (this.bloomPass = new PostTargets()),
      (this.finalPass = new CompositePass(this.bloomPass, gradeOptions)),
      this.composer.addPass(this.renderPass),
      this.composer.addPass(this.bloomPass),
      this.composer.addPass(this.finalPass),
      this.applyQuality(qualitySettings))
  }
  applyQuality(qualitySettings) {
    ;((this.bloomPass.enabled = qualitySettings.bloom > 0), (this.bloomPass.levels = qualitySettings.bloomLevels), (this.bloomPass.threshold.x = qualitySettings.bloomThreshold), this.finalPass.setGradeEnabled(qualitySettings.grade))
    for (const composerTarget of [this.composer.renderTarget1, this.composer.renderTarget2]) composerTarget.samples !== qualitySettings.msaa && ((composerTarget.samples = qualitySettings.msaa), composerTarget.dispose())
  }
  setSize(width, height, pixelRatio) {
    ;(this.composer.setPixelRatio(pixelRatio), this.composer.setSize(width, height))
  }
  render(deltaTime) {
    this.composer.render(deltaTime)
  }
  get sceneTarget() {
    return this.composer.renderTarget1
  }
  precompile(renderer, scene) {
    const getRenderTargetRenderTargetValue = renderer.getRenderTarget(),
      bufferGeometry = new BufferGeometry()
    ;(bufferGeometry.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)), bufferGeometry.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2)))
    const precompileMesh = new Mesh(bufferGeometry, this.finalPass.material)
    precompileMesh.frustumCulled = !1
    const bloomPrecompileSet = this.bloomPass.precompileSet
    renderer.setRenderTarget(bloomPrecompileSet.target)
    for (const bloomMaterial of bloomPrecompileSet.materials) ((precompileMesh.material = bloomMaterial), renderer.compile(precompileMesh, scene))
    ;(renderer.setRenderTarget(null), (precompileMesh.material = this.finalPass.material), renderer.compile(precompileMesh, scene), renderer.setRenderTarget(getRenderTargetRenderTargetValue), bufferGeometry.dispose())
  }
  dispose() {
    ;(this.bloomPass.dispose(), this.finalPass.dispose(), this.composer.dispose(), this.target.dispose())
  }
}

function supportsFloatRenderTargets(renderer) {
  return renderer.capabilities.isWebGL2 !== !1 && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"))
}

function detectGpuRendererName() {
  try {
    const element = document.createElement("canvas"),
      glContext = element.getContext("webgl2") ?? element.getContext("webgl")
    if (!glContext) return null
    const ExtensionValue = glContext.getExtension("WEBGL_debug_renderer_info"),
      toLowerCaseResult = String(ExtensionValue ? glContext.getParameter(ExtensionValue.UNMASKED_RENDERER_WEBGL) : glContext.getParameter(glContext.RENDERER)).toLowerCase()
    return (glContext.getExtension("WEBGL_lose_context")?.loseContext(), toLowerCaseResult)
  } catch {
    return null
  }
}

function detectGraphicsQuality() {
  if (typeof navigator > "u" || typeof document > "u") return "medium"
  const detectGpuRendererNameResult = detectGpuRendererName()
  if (detectGpuRendererNameResult === null || /swiftshader|llvmpipe|software|basic render/.test(detectGpuRendererNameResult)) return "low"
  const userAgent = navigator.userAgent,
    hasCoarsePointer = typeof matchMedia == "function" && matchMedia("(pointer: coarse)").matches,
    isMobileDevice = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(userAgent) || (hasCoarsePointer && Math.min(screen.width, screen.height) < 900),
    deviceMemory = (navigator as any).deviceMemory ?? 8,
    cpuCoreCount = navigator.hardwareConcurrency ?? 8
  if (isMobileDevice) {
    const testResult = /adreno \(tm\) [3-5]\d\d|mali-4|mali-t|powervr/.test(detectGpuRendererNameResult)
    return deviceMemory <= 3 || cpuCoreCount <= 4 || testResult ? "low" : "medium"
  }
  const isLegacyIntelGpu = /intel/.test(detectGpuRendererNameResult) && !/arc/.test(detectGpuRendererNameResult)
  return deviceMemory <= 2 || cpuCoreCount <= 2 || isLegacyIntelGpu ? "medium" : "high"
}

const scratchRay = new Ray(),
  viewDirection = new Vector3(),
  groundPlane = new Plane(new Vector3(0, 1, 0), 0)

let rendererAwaitingRecycle = null

function isWebGLContextLost(renderer) {
  try {
    return renderer.getContext().isContextLost()
  } catch {
    return !0
  }
}

function acquireRenderer() {
  const recycledRenderer = rendererAwaitingRecycle
  if (((rendererAwaitingRecycle = null), recycledRenderer)) {
    if (!isWebGLContextLost(recycledRenderer)) return recycledRenderer
    recycledRenderer.dispose()
  }
  const newRenderer = new WebGLRenderer({ antialias: !0, alpha: !1, stencil: !1, depth: !0, powerPreference: "high-performance" })
  return ((newRenderer.info.autoReset = !1), newRenderer)
}

function scheduleDeferredRendererRelease(renderer) {
  const ContextResult = renderer.getContext()
  let gpuFenceSync = null
  try {
    ;((gpuFenceSync = typeof ContextResult.fenceSync == "function" ? ContextResult.fenceSync(ContextResult.SYNC_GPU_COMMANDS_COMPLETE, 0) : null), ContextResult.flush())
  } catch {
    gpuFenceSync = null
  }
  if (!gpuFenceSync) return
  let retryCount = 0
  const deferredRelease = () => {
    if (rendererAwaitingRecycle !== renderer || isWebGLContextLost(renderer)) return
    const clientWaitSyncResult = ContextResult.clientWaitSync(gpuFenceSync, 0, 0)
    if (clientWaitSyncResult === ContextResult.TIMEOUT_EXPIRED && ++retryCount < 150) {
      window.setTimeout(deferredRelease, 200)
      return
    }
    ;(ContextResult.deleteSync(gpuFenceSync), (clientWaitSyncResult === ContextResult.ALREADY_SIGNALED || clientWaitSyncResult === ContextResult.CONDITION_SATISFIED) && (renderer.setPixelRatio(1), renderer.setSize(1, 1, !1)))
  }
  window.setTimeout(deferredRelease, 200)
}

function releaseRenderer(renderer) {
  ;(renderer.setRenderTarget(null), renderer.renderLists.dispose())
  const isWebGLContextLostResult = isWebGLContextLost(renderer)
  if (!isWebGLContextLostResult && !rendererAwaitingRecycle) {
    ;((rendererAwaitingRecycle = renderer), scheduleDeferredRendererRelease(renderer))
    return
  }
  ;(renderer.dispose(), isWebGLContextLostResult || renderer.forceContextLoss())
}

function deathGrayscaleCssFilter(deathIntensity) {
  return deathIntensity > 0.004 ? `grayscale(${(deathIntensity * 0.9).toFixed(3)}) brightness(${(1 - deathIntensity * 0.16).toFixed(3)})` : ""
}

export { deathGrayscaleCssFilter, releaseRenderer, viewDirection, detectGraphicsQuality, PostRenderer, acquireRenderer, supportsFloatRenderTargets, scratchRay, groundPlane }