/**
 * 渲染基座：随机流/程序化噪声/画布纹理工厂/色调映射与卡通材质
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BackSide, CanvasTexture, ClampToEdgeWrapping, Color, CustomToneMapping, DataTexture, FrontSide, GreaterDepth, LinearFilter, LinearMipmapLinearFilter, NearestFilter, NoColorSpace, Quaternion, RGBAFormat, RepeatWrapping, SRGBColorSpace, ShaderChunk, ShaderMaterial, UniformsLib, UniformsUtils, UnsignedByteType, Vector2, Vector3, Vector4 } from 'three'
import type { Texture } from 'three'
import { NEUTRAL_LIGHT_TINT_TEXTURE, ARENA_PALETTE, ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { SURFACE_FRAGMENT_SHADER, SURFACE_VERTEX_SHADER } from './surface-shaders'
import { OUTLINE_FRAGMENT_SHADER, OUTLINE_VERTEX_SHADER, UNIT_FRAGMENT_SHADER, UNIT_SKIN_FRAGMENT_SHADER, UNIT_SKIN_VERTEX_SHADER, UNIT_VERTEX_SHADER, XRAY_FRAGMENT_SHADER, XRAY_VERTEX_SHADER } from './unit-shaders'

const DEG2RAD = Math.PI / 180;

const SHARED_SCRATCH_VECTOR_A = new Vector3(),
  SHARED_SCRATCH_VECTOR_B = new Vector3(),
  SHARED_SCRATCH_QUATERNION = new Quaternion()

function setLightTint(targetObject) {
  ARENA_SHARED_UNIFORMS.tLightTint.value = targetObject ?? NEUTRAL_LIGHT_TINT_TEXTURE
}

function advanceGlobalTime(deltaTime) {
  ARENA_SHARED_UNIFORMS.uTime.value += Math.min(deltaTime, 0.1)
}

const CUSTOM_TONE_MAPPING = CustomToneMapping,
  COLOR_GRADE = { contrast: 1.08, pivot: 0.42, saturation: 1.06, vibrance: 0.07 },
  CUSTOM_TONEMAP_GLSL = `vec3 CustomToneMapping( vec3 color ) {
	const float StartCompression = 0.76;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak >= StartCompression ) {
		float d = 1.0 - StartCompression;
		float newPeak = 1.0 - d * d / ( peak + d - StartCompression );
		color *= newPeak / peak;
		float g = 1.0 - 1.0 / ( Desaturation * ( peak - newPeak ) + 1.0 );
		color = mix( color, vec3( newPeak ), g );
	}
	#ifdef TONE_MAPPING
	// 只有直出屏幕的材质定义了 TONE_MAPPING：把基础调色并进来(走后期时由 FinalPass 调色)
	const float Pivot = ${Math.pow(COLOR_GRADE.pivot, 2.2).toFixed(4)};
	color = Pivot * pow( max( color, vec3( 0.0 ) ) / Pivot, vec3( ${COLOR_GRADE.contrast.toFixed(3)} ) );
	float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	float mx = max( color.r, max( color.g, color.b ) );
	float mn = min( color.r, min( color.g, color.b ) );
	color = max( mix( vec3( l ), color, ${COLOR_GRADE.saturation.toFixed(3)} + ${COLOR_GRADE.vibrance.toFixed(3)} * ( 1.0 - ( mx - mn ) / max( mx, 1e-4 ) ) ), vec3( 0.0 ) );
	#endif
	return color;
}`

/**
 * 装载地图。
 *
 */
function installCustomToneMapping() {
  const toneMappingChunkSource = ShaderChunk.tonemapping_pars_fragment
  if (toneMappingChunkSource.includes("StartCompression = 0.76")) return
  const vec3CustomToneMappingvec3colorreturncolor = "vec3 CustomToneMapping( vec3 color ) { return color; }"
  toneMappingChunkSource.includes(vec3CustomToneMappingvec3colorreturncolor) ? (ShaderChunk.tonemapping_pars_fragment = toneMappingChunkSource.replace(vec3CustomToneMappingvec3colorreturncolor, CUSTOM_TONEMAP_GLSL)) : console.warn("[moba] 未找到 CustomToneMapping 的默认实现，色调映射未安装")
}

let FastRandom = class {
  s
  constructor(seed) {
    this.s = seed >>> 0 || 1
  }
  next() {
    this.s = (this.s + 1831565813) >>> 0
    let skillValue = this.s
    return ((skillValue = Math.imul(skillValue ^ (skillValue >>> 15), skillValue | 1)), (skillValue ^= skillValue + Math.imul(skillValue ^ (skillValue >>> 7), skillValue | 61)), ((skillValue ^ (skillValue >>> 14)) >>> 0) / 4294967296)
  }
  range(idleMin, idleMax) {
    return idleMin + (idleMax - idleMin) * this.next()
  }
  int(count) {
    return Math.floor(this.next() * count)
  }
  pick(ferns) {
    return ferns[this.int(ferns.length)]
  }
  chance(probability) {
    return this.next() < probability
  }
  gauss() {
    return (this.next() + this.next() + this.next()) / 1.5 - 1
  }
}

function hashNoise2D(gridX, gridY, seed = 0) {
  let hashValue = (Math.imul(gridX | 0, 374761393) + Math.imul(gridY | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0
  return ((hashValue = Math.imul(hashValue ^ (hashValue >>> 13), 1274126177)), (hashValue ^= hashValue >>> 16), (hashValue >>> 0) / 4294967296)
}

const smoothstep01 = (t) => t * t * (3 - 2 * t)

function valueNoise2D(x, y, seed = 0, periodX = 0, periodY = periodX) {
  const gridCellX = Math.floor(x),
    gridCellY = Math.floor(y),
    smoothstep01Result = smoothstep01(x - gridCellX),
    smoothstep01Smoothstep01Result = smoothstep01(y - gridCellY),
    wrapX = (xCoord) => (periodX > 0 ? ((xCoord % periodX) + periodX) % periodX : xCoord),
    wrapY = (yCoord) => (periodY > 0 ? ((yCoord % periodY) + periodY) % periodY : yCoord),
    hashNoise2DResult = hashNoise2D(wrapX(gridCellX), wrapY(gridCellY), seed),
    hashNoise2DHashNoise2DResult = hashNoise2D(wrapX(gridCellX + 1), wrapY(gridCellY), seed),
    hashTopLeft = hashNoise2D(wrapX(gridCellX), wrapY(gridCellY + 1), seed),
    hashTopRight = hashNoise2D(wrapX(gridCellX + 1), wrapY(gridCellY + 1), seed)
  return hashNoise2DResult + (hashNoise2DHashNoise2DResult - hashNoise2DResult) * smoothstep01Result + (hashTopLeft - hashNoise2DResult) * smoothstep01Smoothstep01Result + (hashNoise2DResult - hashNoise2DHashNoise2DResult - hashTopLeft + hashTopRight) * smoothstep01Result * smoothstep01Smoothstep01Result
}

function fbmNoise2D(x, y, octaves = 4, seed = 0, periodX = 0, periodY = periodX) {
  let amplitude = 0.5,
    total = 0,
    amplitudeSum = 0,
    frequency = 1
  for (let index = 0; index < octaves; index++) ((total += amplitude * valueNoise2D(x * frequency, y * frequency, seed + index * 17, periodX > 0 ? periodX * frequency : 0, periodY > 0 ? periodY * frequency : 0)), (amplitudeSum += amplitude), (amplitude *= 0.5), (frequency *= 2))
  return total / amplitudeSum
}

function configureTexture(texture, options) {
  const useRepeatWrapping = options.repeat ?? !0
  ;((texture.wrapS = texture.wrapT = useRepeatWrapping ? RepeatWrapping : ClampToEdgeWrapping), (texture.colorSpace = (options.srgb ?? !0) ? SRGBColorSpace : NoColorSpace))
  const useMipmaps = options.mipmaps ?? !0
  ;((texture.generateMipmaps = useMipmaps), (texture.minFilter = options.nearest ? NearestFilter : useMipmaps ? LinearMipmapLinearFilter : LinearFilter), (texture.magFilter = options.nearest ? NearestFilter : LinearFilter), (texture.anisotropy = options.anisotropy ?? 4), (texture.needsUpdate = !0))
}

function createCanvas(width, height, drawCallback, textureOptions = {}) {
  const element = document.createElement("canvas")
  ;((element.width = width), (element.height = height))
  const ContextValue = element.getContext("2d", { willReadFrequently: !1 })
  if (!ContextValue) throw new Error("2D canvas 不可用")
  drawCallback(ContextValue, width, height)
  const canvasTexture = new CanvasTexture(element)
  return (configureTexture(canvasTexture, textureOptions), canvasTexture)
}

function forEachNeighbor(extent, centerX, centerY, radius, onNeighbor) {
  for (let index = -1; index <= 1; index++)
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const neighborX = centerX + offsetX * extent,
        neighborY = centerY + index * extent
      neighborX + radius < 0 || neighborX - radius > extent || neighborY + radius < 0 || neighborY - radius > extent || onNeighbor(neighborX, neighborY)
    }
}

function buildNoiseTexture(size = 256, seed = 7) {
  const uint8Array = new Uint8Array(size * size * 4),
    gradientSize = 16,
    gradients = []
  for (let index = 0; index < gradientSize; index++) for (let gradientX = 0; gradientX < gradientSize; gradientX++) gradients.push(gradientX + hashNoise2D(gradientX, index, seed + 91), index + hashNoise2D(gradientX, index, seed + 92))
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        pixelOffset = (y * size + x) * 4
      ;((uint8Array[pixelOffset] = fbmNoise2D(u * 4, v * 4, 4, seed, 4) * 255), (uint8Array[pixelOffset + 1] = fbmNoise2D(u * 12, v * 12, 4, seed + 31, 12) * 255), (uint8Array[pixelOffset + 2] = fbmNoise2D(u * 40, v * 40, 3, seed + 67, 40) * 255))
      const gridX = u * gradientSize,
        scaledY = v * gradientSize,
        cellX = Math.floor(gridX),
        cellY = Math.floor(scaledY)
      let minDistanceSq = 9
      for (let offsetY = -1; offsetY <= 1; offsetY++)
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const wrappedCellX = (cellX + offsetX + gradientSize) % gradientSize,
            wrappedCellY = (cellY + offsetY + gradientSize) % gradientSize,
            gradientOffset = (wrappedCellY * gradientSize + wrappedCellX) * 2,
            distanceX = gradients[gradientOffset] - wrappedCellX + (cellX + offsetX) - gridX,
            distanceY = gradients[gradientOffset + 1] - wrappedCellY + (cellY + offsetY) - scaledY,
            distanceSq = distanceX * distanceX + distanceY * distanceY
          distanceSq < minDistanceSq && (minDistanceSq = distanceSq)
        }
      uint8Array[pixelOffset + 3] = Math.min(1, Math.sqrt(minDistanceSq)) * 255
    }
  const dataTexture = new DataTexture(uint8Array, size, size, RGBAFormat, UnsignedByteType)
  return (configureTexture(dataTexture, { srgb: !1, repeat: !0, mipmaps: !0 }), dataTexture)
}

const textureCache = new Map()

function cachedTexture(lookupKey, createTexture) {
  let Value = textureCache.get(lookupKey)
  return (Value || ((Value = createTexture()), textureCache.set(lookupKey, Value)), Value)
}

function disposeTextureCache() {
  for (const texture of textureCache.values()) texture.dispose()
  textureCache.clear()
}

const clampByte = (byte) => (byte < 0 ? 0 : byte > 255 ? 255 : byte)

function rockTexture() {
  return cachedTexture("rock", () =>
    createCanvas(
      256,
      256,
      (builder, canvasSize) => {
        const textureSize = canvasSize,
          ImageDataValue = builder.createImageData(textureSize, textureSize),
          pixels = ImageDataValue.data
        for (let index = 0; index < textureSize; index++)
          for (let x = 0; x < textureSize; x++) {
            const u = x / textureSize,
              v = index / textureSize,
              fbmNoise2DResult = fbmNoise2D(u * 4, v * 4, 3, 3, 4),
              fbmNoise2DFbmNoise2DResult = fbmNoise2D(u * 2 + fbmNoise2DResult * 0.6, v * 9 + fbmNoise2DResult * 1.6, 3, 11, 2, 9),
              layerDistance = Math.abs(((v * 7 + fbmNoise2DResult * 1.4) % 1) - 0.5)
            let total = 196 + (fbmNoise2DFbmNoise2DResult - 0.5) * 56
            layerDistance < 0.04 && (total -= 18 * (1 - layerDistance / 0.04))
            const detailNoise = fbmNoise2D(u * 48, v * 48, 2, 23, 48)
            total += (detailNoise - 0.5) * 30
            const pixelOffset = (index * textureSize + x) * 4
            ;((pixels[pixelOffset] = clampByte(total)), (pixels[pixelOffset + 1] = clampByte(total * 0.985)), (pixels[pixelOffset + 2] = clampByte(total * 1)), (pixels[pixelOffset + 3] = 255))
          }
        builder.putImageData(ImageDataValue, 0, 0)
        const random = new FastRandom(99)
        builder.lineCap = "round"
        for (let crackIndex = 0; crackIndex < 46; crackIndex++) {
          const crackCenterX = random.range(0, textureSize),
            crackCenterY = random.range(0, textureSize),
            crackLength = random.range(10, 42),
            crackAngle = random.range(-0.25, 0.25)
          ;((builder.strokeStyle = random.chance(0.5) ? "rgba(255,255,255,0.16)" : "rgba(40,44,60,0.14)"),
            (builder.lineWidth = random.range(1, 2.6)),
            forEachNeighbor(textureSize, crackCenterX, crackCenterY, crackLength, (centerX, centerY) => {
              ;(builder.beginPath(), builder.moveTo(centerX - Math.cos(crackAngle) * crackLength * 0.5, centerY - Math.sin(crackAngle) * crackLength * 0.5), builder.lineTo(centerX + Math.cos(crackAngle) * crackLength * 0.5, centerY + Math.sin(crackAngle) * crackLength * 0.5), builder.stroke())
            }))
        }
      },
      { repeat: !0, anisotropy: 4 },
    ),
  )
}

function makeLightUniforms(extraUniforms) {
  return { ...UniformsUtils.clone(UniformsLib.lights), ...UniformsUtils.clone(UniformsLib.fog), tLightTint: ARENA_SHARED_UNIFORMS.tLightTint, uShadeTintGround: ARENA_SHARED_UNIFORMS.uShadeTintGround, uKickDir: ARENA_SHARED_UNIFORMS.uKickDir, uKickColor: ARENA_SHARED_UNIFORMS.uKickColor, ...extraUniforms }
}

/** ToonMaterial 构造选项；字段全部可选，缺省值与原有逻辑保持一致。 */
interface ToonMaterialOptions {
  ramp?: number[]
  steps?: number
  softness?: number
  emissive?: number
  emissiveIntensity?: number
  wind?: number
  windByHeight?: number
  color?: number
  opacity?: number
  glowBoost?: number
  shadeTint?: number
  rimColor?: number
  rim?: number
  rimPower?: number
  kicker?: number
  specular?: number
  gloss?: number
  teamColor?: number
  map?: Texture | null
  mapScale?: number
  triplanar?: number
  mapGain?: number
  mapTop?: Texture | null
  mapTopNoise?: Texture | null
  mapTopScale?: number
  mapTopGain?: number
  mapTopPatch?: number
  lightTint?: boolean
  fx?: boolean
  mapMask?: boolean
  mapTopDetail?: boolean
  flat?: boolean
  flipBackNormals?: boolean
  transparent?: boolean
  fog?: boolean
  vertexColors?: boolean
  side?: number
  depthWrite?: boolean
  alphaTest?: number
  polygonOffset?: number
}

/** ToonMaterial 写入的 defines 键；除 TOON_STEPS 外均为可删除的开关。 */
interface ToonDefines {
  TOON_STEPS: number
  TOON_FX?: string
  TOON_TRIPLANAR?: string
  TOON_MAP?: string
  TOON_MAP_MASK?: string
  TOON_MAP_TOP?: string
  TOON_MAP_TOP_DETAIL?: string
  TOON_MAP_TOP_NOISE?: string
  TOON_LIGHT_TINT?: string
  TOON_WORLD_POS?: string
  TOON_FLAT?: string
  TOON_KEEP_BACK_NORMALS?: string
  TOON_WIND?: string
  TOON_SPECULAR?: string
  TOON_KICKER?: string
  TOON_DITHER_FADE?: string
}

/**
 * three 未随包提供 .d.ts（由 allowJs 推断），uniform 的 value 承载
 * Color/Vector/数值/纹理等异构内容，无法给出更窄的公共类型。
 */
interface ToonUniform {
  value: any
}
type ToonUniforms = Record<string, ToonUniform>

class ToonMaterial extends ShaderMaterial {
  isToonMaterial = !0
  opts: ToonMaterialOptions
  // three 由 JS 推断，TS 子类看不到基类字段；declare 只补类型、不产生运行时字段
  declare uniforms: ToonUniforms
  declare defines: ToonDefines
  declare vertexShader: string
  declare fragmentShader: string
  declare lights: boolean
  declare fog: boolean
  declare vertexColors: boolean
  declare side: number
  declare transparent: boolean
  declare depthWrite: boolean
  declare alphaTest: number
  declare polygonOffset: boolean
  declare polygonOffsetFactor: number
  declare polygonOffsetUnits: number
  declare needsUpdate: boolean
  declare uniformsNeedUpdate: boolean
  // three 由 JS 推断，TS 子类看不到基类方法；declare 属性只补类型、不产生运行时成员
  declare dispose: () => void
  constructor(bushMap: ToonMaterialOptions = {}) {
    ;(super(), (this.opts = { ...bushMap }))
    const toonSteps = bushMap.ramp ? 3 : (bushMap.steps ?? 2),
      rampSoftness = bushMap.softness ?? 0.08,
      multiplyScalarResult = new Color(bushMap.emissive ?? 0).multiplyScalar(bushMap.emissive !== void 0 ? (bushMap.emissiveIntensity ?? 1) : 0),
      toonRamp = bushMap.ramp ? new Vector4(bushMap.ramp[0], bushMap.ramp[1], bushMap.ramp[2], rampSoftness) : new Vector4(toonSteps === 3 ? -0.08 : 0.06, 0.5, 0.58, rampSoftness)
    this.uniforms = makeLightUniforms({
      uTime: ARENA_SHARED_UNIFORMS.uTime,
      uWind: ARENA_SHARED_UNIFORMS.uWind,
      uSway: { value: bushMap.wind ?? 0 },
      uSwayHeight: { value: bushMap.windByHeight ?? 0 },
      uColor: { value: new Color(bushMap.color ?? 16777215) },
      uTint: { value: new Color(1, 1, 1) },
      uOpacity: { value: bushMap.opacity ?? 1 },
      uEmissive: { value: multiplyScalarResult },
      uGlowBoost: { value: bushMap.glowBoost ?? 3 },
      uRamp: { value: toonRamp },
      uShadeTint: bushMap.shadeTint !== void 0 ? { value: new Color(bushMap.shadeTint) } : ARENA_SHARED_UNIFORMS.uShadeTint,
      uRimColor: { value: new Color(bushMap.rimColor ?? ARENA_PALETTE.env.rimWarm) },
      uRim: { value: new Vector2(bushMap.rim ?? 0.25, bushMap.rimPower ?? 3) },
      uKick: { value: bushMap.kicker ?? 0 },
      uSpec: { value: new Vector2(bushMap.specular ?? 0, bushMap.gloss ?? 40) },
      uTeamColor: { value: new Color(bushMap.teamColor ?? 16777215) },
      uFlash: { value: 0 },
      uFlashColor: { value: new Color(1, 1, 1) },
      tMap: { value: bushMap.map ?? null },
      uMapScale: { value: bushMap.mapScale ?? 1 },
      uTriScale: { value: bushMap.triplanar ?? 0 },
      uMapGain: { value: bushMap.mapGain ?? 1 },
      tMapTop: { value: bushMap.mapTop ?? null },
      tMapTopNoise: { value: bushMap.mapTopNoise ?? null },
      uMapTop: { value: new Vector3(bushMap.mapTopScale ?? 0.1, bushMap.mapTopGain ?? 2.1, bushMap.mapTopPatch ?? 1) },
    })
    const tOON_STEPSConfig: ToonDefines = { TOON_STEPS: toonSteps },
      useTriplanar = !!bushMap.map && (bushMap.triplanar ?? 0) > 0,
      useLightTint = bushMap.lightTint ?? !0
    ;((bushMap.fx ?? !0) && (tOON_STEPSConfig.TOON_FX = ""),
      useTriplanar ? (tOON_STEPSConfig.TOON_TRIPLANAR = "") : bushMap.map && (tOON_STEPSConfig.TOON_MAP = ""),
      bushMap.mapMask && (tOON_STEPSConfig.TOON_MAP_MASK = ""),
      bushMap.mapTop && ((tOON_STEPSConfig.TOON_MAP_TOP = ""), (bushMap.mapTopDetail ?? !0) && (tOON_STEPSConfig.TOON_MAP_TOP_DETAIL = ""), bushMap.mapTopNoise && (tOON_STEPSConfig.TOON_MAP_TOP_NOISE = "")),
      useLightTint && (tOON_STEPSConfig.TOON_LIGHT_TINT = ""),
      (useTriplanar || bushMap.mapTop || useLightTint) && (tOON_STEPSConfig.TOON_WORLD_POS = ""),
      bushMap.flat && (tOON_STEPSConfig.TOON_FLAT = ""),
      bushMap.flipBackNormals === !1 && (tOON_STEPSConfig.TOON_KEEP_BACK_NORMALS = ""),
      (bushMap.wind ?? 0) > 0 && (tOON_STEPSConfig.TOON_WIND = ""),
      (bushMap.specular ?? 0) > 0 && (tOON_STEPSConfig.TOON_SPECULAR = ""),
      (bushMap.kicker ?? 0) > 0 && (tOON_STEPSConfig.TOON_KICKER = ""),
      bushMap.transparent || (tOON_STEPSConfig.TOON_DITHER_FADE = ""),
      (this.defines = tOON_STEPSConfig),
      (this.vertexShader = SURFACE_VERTEX_SHADER),
      (this.fragmentShader = SURFACE_FRAGMENT_SHADER),
      (this.lights = !0),
      (this.fog = bushMap.fog ?? !0),
      (this.vertexColors = bushMap.vertexColors ?? !1),
      (this.side = bushMap.side ?? FrontSide),
      (this.transparent = bushMap.transparent ?? !1),
      bushMap.depthWrite !== void 0 && (this.depthWrite = bushMap.depthWrite),
      bushMap.alphaTest && (this.alphaTest = bushMap.alphaTest),
      bushMap.polygonOffset && ((this.polygonOffset = !0), (this.polygonOffsetFactor = -bushMap.polygonOffset), (this.polygonOffsetUnits = -bushMap.polygonOffset)))
  }
  get color() {
    return this.uniforms.uColor.value
  }
  get emissive() {
    return this.uniforms.uEmissive.value
  }
  get teamColor() {
    return this.uniforms.uTeamColor.value
  }
  get tint() {
    return this.uniforms.uTint.value
  }
  get rimColor() {
    return this.uniforms.uRimColor.value
  }
  get flash() {
    return this.baseFlash
  }
  set flash(flashAmount) {
    ;((this.baseFlash = flashAmount), (this.uniforms.uFlash.value = flashAmount))
  }
  get fade() {
    return this.baseFade
  }
  set fade(fadeAmount) {
    ;((this.baseFade = fadeAmount), (this.uniforms.uOpacity.value = fadeAmount))
  }
  baseFlash = 0
  baseFade = 1
  dirtyFromParams = !1
  /**
   * 设置地图。
   *
   * @param enabled - 目标
  */
  setMapTopDetail(enabled) {
    !this.opts.mapTop ||
      (this.defines.TOON_MAP_TOP_DETAIL !== void 0) === enabled ||
      ((this.opts.mapTopDetail = enabled), enabled ? (this.defines.TOON_MAP_TOP_DETAIL = "") : delete this.defines.TOON_MAP_TOP_DETAIL, (this.needsUpdate = !0))
  }
  onBeforeRender(renderer, scene, camera, geometry, object) {
    const toonState = object.userData.toon,
      uniforms = this.uniforms
    toonState
      ? ((uniforms.uFlash.value = toonState.flash),
        uniforms.uFlashColor.value.copy(toonState.flashColor),
        (uniforms.uOpacity.value = toonState.opacity * this.baseFade),
        uniforms.uTeamColor.value.copy(toonState.teamColor),
        uniforms.uTint.value.copy(toonState.tint),
        (this.uniformsNeedUpdate = !0),
        (this.dirtyFromParams = !0))
      : this.dirtyFromParams &&
        ((uniforms.uFlash.value = this.baseFlash),
        uniforms.uFlashColor.value.setRGB(1, 1, 1),
        (uniforms.uOpacity.value = this.baseFade),
        uniforms.uTeamColor.value.set(this.opts.teamColor ?? 16777215),
        uniforms.uTint.value.setRGB(1, 1, 1),
        (this.uniformsNeedUpdate = !0),
        (this.dirtyFromParams = !1))
  }
  clone() {
    const clonedMaterial = new ToonMaterial(this.opts),
      sourceUniforms = this.uniforms,
      clonedUniforms = clonedMaterial.uniforms
    for (const uColoruEmissiveuRimColoruTeamColoruTintuFlashColor of ["uColor", "uEmissive", "uRimColor", "uTeamColor", "uTint", "uFlashColor"]) clonedUniforms[uColoruEmissiveuRimColoruTeamColoruTintuFlashColor].value.copy(sourceUniforms[uColoruEmissiveuRimColoruTeamColoruTintuFlashColor].value)
    return (
      clonedUniforms.uShadeTint !== ARENA_SHARED_UNIFORMS.uShadeTint && clonedUniforms.uShadeTint.value.copy(sourceUniforms.uShadeTint.value),
      clonedUniforms.uRamp.value.copy(sourceUniforms.uRamp.value),
      clonedUniforms.uRim.value.copy(sourceUniforms.uRim.value),
      clonedUniforms.uSpec.value.copy(sourceUniforms.uSpec.value),
      clonedUniforms.uMapTop.value.copy(sourceUniforms.uMapTop.value),
      (clonedUniforms.uKick.value = sourceUniforms.uKick.value),
      (clonedUniforms.uSway.value = sourceUniforms.uSway.value),
      (clonedUniforms.uSwayHeight.value = sourceUniforms.uSwayHeight.value),
      (clonedUniforms.uGlowBoost.value = sourceUniforms.uGlowBoost.value),
      (clonedUniforms.tMap.value = sourceUniforms.tMap.value),
      (clonedUniforms.tMapTop.value = sourceUniforms.tMapTop.value),
      (clonedUniforms.tMapTopNoise.value = sourceUniforms.tMapTopNoise.value),
      (clonedMaterial.flash = this.baseFlash),
      (clonedMaterial.fade = this.baseFade),
      clonedMaterial
    )
  }
}

function createToonMaterial(options: ToonMaterialOptions = {}) {
  return new ToonMaterial(options)
}

let unitPatternsEnabled = !0

const patternedMaterials = new Set<ShaderMaterial>()

/**
 * 设置单位。
 *
 * @param enabled - 目标
 */
function setUnitPatternsEnabled(enabled) {
  if (enabled !== unitPatternsEnabled) {
    unitPatternsEnabled = enabled
    for (const patternedMaterial of patternedMaterials) (enabled ? (patternedMaterial.defines.UNIT_PATTERNS = "") : delete patternedMaterial.defines.UNIT_PATTERNS, (patternedMaterial.needsUpdate = !0))
  }
}

function defaultKickStrength(unitId) {
  return unitId.startsWith("hero:") || unitId.startsWith("preview:") || unitId.startsWith("portrait:") ? 0.55 : unitId.startsWith("monster:") ? 0.5 : unitId.startsWith("minion:") ? 0.4 : 0.3
}

/**
 * 创建单位。
 *
 * @param bones - 来源
 * @param options - 次要输入
 * @param unitId - 第三输入
 */
function createUnitMaterial(bones, options, unitId) {
  const shaderMaterial = new ShaderMaterial({
    uniforms: makeLightUniforms({
      uBones: { value: bones },
      uTime: ARENA_SHARED_UNIFORMS.uTime,
      uRamp: { value: new Vector4(-0.08, 0.5, 0.58, 0.08) },
      uShadeTint: options.shadeTint !== void 0 ? { value: new Color(options.shadeTint) } : ARENA_SHARED_UNIFORMS.uShadeTint,
      uSkinShade: { value: new Color(15245456) },
      uRimColor: { value: new Color(options.rimColor ?? ARENA_PALETTE.env.rimWarm) },
      uRim: { value: new Vector2(options.rim ?? 0.3, options.rimPower ?? 3) },
      uKick: { value: options.kicker ?? defaultKickStrength(unitId) },
      uSpec: { value: new Vector2(options.specular ?? 0.9, options.gloss ?? 36) },
      uGlowBoost: { value: options.glowBoost ?? 3 },
    }),
    defines: unitPatternsEnabled ? { UNIT_PATTERNS: "" } : {},
    vertexShader: UNIT_VERTEX_SHADER,
    fragmentShader: UNIT_FRAGMENT_SHADER,
    lights: !0,
    fog: !0,
    vertexColors: !0,
  })
  return (patternedMaterials.add(shaderMaterial), shaderMaterial)
}

function createUnitSkinMaterial(bones) {
  return new ShaderMaterial({ uniforms: { uBones: { value: bones } }, vertexShader: UNIT_SKIN_VERTEX_SHADER, fragmentShader: UNIT_SKIN_FRAGMENT_SHADER })
}

const scratchVec2 = new Vector2()

function createOutlineMaterial(bones, outlineWidth, outlineColor) {
  const shaderMaterial = new ShaderMaterial({
    uniforms: { ...UniformsUtils.clone(UniformsLib.fog), uBones: { value: bones }, uLine: { value: 0.001 }, uColor: { value: new Color(outlineColor) } },
    vertexShader: OUTLINE_VERTEX_SHADER,
    fragmentShader: OUTLINE_FRAGMENT_SHADER,
    side: BackSide,
    fog: !0,
    vertexColors: !0,
  })
  return (
    (shaderMaterial.onBeforeRender = (renderer, scene, camera) => {
      ;(renderer.getSize(scratchVec2), (shaderMaterial.uniforms.uLine.value = (outlineWidth * 2) / (camera.projectionMatrix.elements[5] * Math.max(1, scratchVec2.y))))
    }),
    shaderMaterial
  )
}

function createXrayMaterial(bones) {
  return new ShaderMaterial({ uniforms: { uBones: { value: bones }, uPull: { value: 0.7 } }, vertexShader: XRAY_VERTEX_SHADER, fragmentShader: XRAY_FRAGMENT_SHADER, depthFunc: GreaterDepth, depthWrite: !1 })
}

function createMaterialState() {
  return { opacity: 1, flash: 0, glow: 1, team: new Color(1, 1, 1), tint: new Color(1, 1, 1), tintAmount: 0, body: new Color(1, 1, 1), xray: new Color(1, 1, 1), xrayAmount: 0, rim: 0 }
}

export { installCustomToneMapping, createOutlineMaterial, COLOR_GRADE, createUnitSkinMaterial, makeLightUniforms, createToonMaterial, createXrayMaterial, createUnitMaterial, SHARED_SCRATCH_VECTOR_A, buildNoiseTexture, SHARED_SCRATCH_VECTOR_B, createCanvas, SHARED_SCRATCH_QUATERNION, disposeTextureCache, rockTexture, patternedMaterials, setUnitPatternsEnabled, FastRandom, setLightTint, forEachNeighbor, hashNoise2D, advanceGlobalTime, CUSTOM_TONE_MAPPING, createMaterialState, valueNoise2D, fbmNoise2D }