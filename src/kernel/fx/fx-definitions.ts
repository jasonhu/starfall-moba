/**
 * 特效定义：对象池、VFX 配色/形状/样式表、噪声扭曲与插值工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, GreaterDepth, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three'
import { DECAL_FRAGMENT_SHADER, DECAL_STRIDE, DECAL_VERTEX_SHADER, DecalPen, MAX_DECALS, PERMANENT_DECAL_LIFETIME } from '../render/decal-pen'
import { PARTICLE_TONEMAP_GLSL, configureParticleMaterial } from '../render/noise-geometry'
import { ARENA_PALETTE } from '../arena-palette'
import { GLSL_ADDITIVE, GLSL_HASH_NOISE } from '../render/glsl-chunks'

class ObjectPool {
  mesh
  xrayMesh
  now = 0
  resolve = null
  data = new Float32Array(MAX_DECALS * DECAL_STRIDE)
  expire = new Float64Array(MAX_DECALS)
  followId = new Int32Array(MAX_DECALS).fill(-1)
  baseAlpha = new Float32Array(MAX_DECALS)
  vis = new Float32Array(MAX_DECALS).fill(1)
  dirty = !1
  used = new Uint8Array(MAX_DECALS)
  mode = new Uint8Array(MAX_DECALS)
  fadeRate = new Float32Array(MAX_DECALS)
  hi = 0
  pen
  buffer
  geo
  mat
  xrayMat
  tmp = new Vector3()
  xrayCount = 0
  fill = { value: 1 }
  constructor() {
    this.pen = new DecalPen(this)
    const element = new InstancedBufferGeometry()
    ;(element.setAttribute("position", new BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3)), element.setIndex([0, 3, 2, 0, 2, 1]))
    const instancedInterleavedBuffer = new InstancedInterleavedBuffer(this.data, DECAL_STRIDE, 1)
    ;(instancedInterleavedBuffer.setUsage(DynamicDrawUsage), ["aA", "aB", "aT", "aC0", "aC1"].forEach((attributeName, attributeIndex) => element.setAttribute(attributeName, new InterleavedBufferAttribute(instancedInterleavedBuffer, 4, attributeIndex * 4))), (element.instanceCount = 0), (this.geo = element), (this.buffer = instancedInterleavedBuffer))
    const valueConfig = { value: 0 },
      createDecalMaterial = (useXray) => {
        const decalMaterial = new ShaderMaterial({
          uniforms: { uNow: valueConfig, uXray: { value: useXray ? 1 : 0 }, uAlpha: { value: useXray ? 0.5 : 1 }, uFill: this.fill },
          vertexShader: DECAL_VERTEX_SHADER,
          fragmentShader: DECAL_FRAGMENT_SHADER,
          polygonOffset: !0,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
        return (configureParticleMaterial(decalMaterial), useXray && (decalMaterial.depthFunc = GreaterDepth), decalMaterial)
      }
    ;((this.mat = createDecalMaterial(!1)),
      (this.xrayMat = createDecalMaterial(!0)),
      (this.mesh = new Mesh(element, this.mat)),
      (this.mesh.name = "fx.decals"),
      (this.mesh.frustumCulled = !1),
      (this.mesh.renderOrder = 5),
      (this.xrayMesh = new Mesh(element, this.xrayMat)),
      (this.xrayMesh.name = "fx.decals.xray"),
      (this.xrayMesh.frustumCulled = !1),
      (this.xrayMesh.renderOrder = 5.5),
      (this.mesh.visible = !1),
      (this.xrayMesh.visible = !1))
  }
  alloc(decalType, decalLifetime) {
    let slotIndex = 0
    for (; slotIndex < MAX_DECALS && this.used[slotIndex];) slotIndex++
    if (slotIndex >= MAX_DECALS) {
      let earliestExpiringSlot = -1,
        earliestExpire = 1 / 0
      for (let index = 0; index < MAX_DECALS; index++) this.mode[index] === 0 && this.expire[index] < earliestExpire && ((earliestExpire = this.expire[index]), (earliestExpiringSlot = index))
      slotIndex = earliestExpiringSlot < 0 ? 0 : earliestExpiringSlot
    }
    ;((this.used[slotIndex] = 1), slotIndex >= this.hi && (this.hi = slotIndex + 1))
    const dataState = this.data,
      slotOffset = slotIndex * DECAL_STRIDE
    return (
      dataState.fill(0, slotOffset, slotOffset + DECAL_STRIDE),
      (dataState[slotOffset + 1] = 0.06),
      (dataState[slotOffset + 5] = 1),
      (dataState[slotOffset + 6] = decalType),
      (dataState[slotOffset + 8] = this.now),
      (dataState[slotOffset + 9] = decalLifetime),
      (dataState[slotOffset + 12] = dataState[slotOffset + 13] = dataState[slotOffset + 14] = 1),
      (dataState[slotOffset + 15] = 1),
      (this.baseAlpha[slotIndex] = 1),
      (this.vis[slotIndex] = 1),
      (this.followId[slotIndex] = -1),
      (this.mode[slotIndex] = 0),
      (this.expire[slotIndex] = this.now + decalLifetime),
      (this.dirty = !0),
      slotIndex
    )
  }
  add(pelvis, chest, decalZ, chestY, decalLifetime) {
    const allocValue = this.alloc(pelvis, decalLifetime),
      decalOffset = allocValue * DECAL_STRIDE
    return ((this.data[decalOffset] = chest), (this.data[decalOffset + 2] = decalZ), (this.data[decalOffset + 3] = chestY), (this.pen.slot = allocValue), this.pen)
  }
  hold(decalType, fadeDuration = 0.12) {
    const decalSlot = this.alloc(decalType, PERMANENT_DECAL_LIFETIME)
    return ((this.mode[decalSlot] = 1), (this.vis[decalSlot] = fadeDuration > 0 ? 0 : 1), (this.fadeRate[decalSlot] = fadeDuration > 0 ? 1 / fadeDuration : 0), (this.data[decalSlot * DECAL_STRIDE + 15] = 0), decalSlot)
  }
  at(decalSlot) {
    return ((this.pen.slot = decalSlot), this.pen)
  }
  release(decalSlot, fadeOutDuration = 0.18) {
    if (!(decalSlot < 0 || !this.used[decalSlot] || this.mode[decalSlot] === 0)) {
      if (fadeOutDuration <= 0) {
        this.free(decalSlot)
        return
      }
      ;((this.mode[decalSlot] = 2), (this.fadeRate[decalSlot] = 1 / fadeOutDuration))
    }
  }
  free(decalSlot) {
    ;((this.used[decalSlot] = 0), (this.mode[decalSlot] = 0), (this.followId[decalSlot] = -1))
    const decalDataOffset = decalSlot * DECAL_STRIDE
    ;((this.data[decalDataOffset + 3] = 0), (this.data[decalDataOffset + 7] = 0), (this.dirty = !0))
  }
  flush(deltaTime) {
    this.mat.uniforms.uNow.value = this.now
    const dataValue = this.data
    let activeHighMark = 0,
      xrayVisibleCount = 0
    for (let index = 0; index < this.hi; index++) {
      if (!this.used[index]) continue
      const decalOffset = index * DECAL_STRIDE,
        selectedMode = this.mode[index]
      if (selectedMode === 0) {
        if (this.now >= this.expire[index]) {
          this.free(index)
          continue
        }
      } else {
        const targetVisibility = selectedMode === 1 ? 1 : 0
        let selectedVis = this.vis[index]
        if (selectedVis !== targetVisibility) {
          const visibilityDelta = this.fadeRate[index] > 0 ? this.fadeRate[index] * deltaTime : 1
          ;((selectedVis = targetVisibility > selectedVis ? Math.min(1, selectedVis + visibilityDelta) : Math.max(0, selectedVis - visibilityDelta)), (this.vis[index] = selectedVis), (dataValue[decalOffset + 15] = this.baseAlpha[index] * selectedVis), (this.dirty = !0))
        }
        if (selectedMode === 2 && selectedVis <= 0) {
          this.free(index)
          continue
        }
      }
      const selectedFollowId = this.followId[index]
      ;(selectedFollowId >= 0 && this.resolve && this.resolve(selectedFollowId, this.tmp) && ((dataValue[decalOffset] = this.tmp.x), (dataValue[decalOffset + 2] = this.tmp.z), (this.dirty = !0)), dataValue[decalOffset + 7] > 0.5 && xrayVisibleCount++, (activeHighMark = index + 1))
    }
    ;((this.hi = activeHighMark),
      (this.xrayCount = xrayVisibleCount),
      (this.geo.instanceCount = activeHighMark),
      (this.mesh.visible = activeHighMark > 0),
      (this.xrayMesh.visible = xrayVisibleCount > 0),
      this.dirty && ((this.buffer.updateRanges.length = 0), (this.buffer.needsUpdate = !0), (this.dirty = !1)))
  }
  setFill(targetObject) {
    this.fill.value = targetObject
  }
  get activeCount() {
    let total = 0
    for (let index = 0; index < this.hi; index++) total += this.used[index]
    return total
  }
  get xrayActive() {
    return this.xrayCount
  }
  clear() {
    for (let index = 0; index < MAX_DECALS; index++) this.used[index] && this.free(index)
    this.hi = 0
  }
  dispose() {
    ;(this.geo.dispose(), this.mat.dispose(), this.xrayMat.dispose())
  }
}

const FX_TWO_PI = Math.PI * 2,
  clampToUnitInterval = (fraction) => (fraction < 0 ? 0 : fraction > 1 ? 1 : fraction),
  smoothStepVfx = (edgeStart, edgeEnd, samplePosition) => {
    const clampToUnitIntervalResult = clampToUnitInterval((samplePosition - edgeStart) / (edgeEnd - edgeStart))
    return clampToUnitIntervalResult * clampToUnitIntervalResult * (3 - 2 * clampToUnitIntervalResult)
  },
  easeOutBack = (progress, overshoot = 1.70158) => {
    const progressMinusOne = progress - 1
    return 1 + progressMinusOne * progressMinusOne * ((overshoot + 1) * progressMinusOne + overshoot)
  }

class SeededRandom {
  s
  constructor(initialSeed = 49734321) {
    this.s = initialSeed >>> 0 || 1
  }
  seed(newSeed) {
    this.s = newSeed >>> 0 || 1
  }
  next() {
    let skillValue = this.s
    return ((skillValue ^= skillValue << 13), (skillValue >>>= 0), (skillValue ^= skillValue >>> 17), (skillValue ^= skillValue << 5), (skillValue >>>= 0), (this.s = skillValue), skillValue / 4294967296)
  }
  range(idleMin, rangeMax) {
    return idleMin + (rangeMax - idleMin) * this.next()
  }
  signed() {
    return this.next() * 2 - 1
  }
  int(rangeLength) {
    return Math.floor(this.next() * rangeLength)
  }
  chance(probability) {
    return this.next() < probability
  }
}

const hexToColor = (hexColor) => new Color(hexColor),
  HERO_VFX_PALETTES = {
    panyue: { glow: hexToColor(16749080), hot: hexToColor(16761934), deep: hexToColor(14243850), accent: hexToColor(15906650), dark: hexToColor(3023384) },
    chijin: { glow: hexToColor(16734750), hot: hexToColor(16756280), deep: hexToColor(13377042), accent: hexToColor(16749608), dark: hexToColor(2494478) },
    xingli: { glow: hexToColor(9225471), hot: hexToColor(15923455), deep: hexToColor(3820188), accent: hexToColor(16767370), dark: hexToColor(1317436) },
    fengling: { glow: hexToColor(3072150), hot: hexToColor(8320702), deep: hexToColor(2070128), accent: hexToColor(15320170), dark: hexToColor(930856) },
    yeque: { glow: hexToColor(9067760), hot: hexToColor(15266047), deep: hexToColor(3811960), accent: hexToColor(12577250), dark: hexToColor(920086) },
    xiangyu: { glow: hexToColor(16747196), hot: hexToColor(16756280), deep: hexToColor(11609162), accent: hexToColor(16431971), dark: hexToColor(2365480) },
  },
  VFX_COLORS = {
    white: hexToColor(16777215),
    warm: hexToColor(16764784),
    spark: hexToColor(16757810),
    sparkDeep: hexToColor(16732688),
    magic: hexToColor(6079743),
    magicDeep: hexToColor(3824895),
    crit: hexToColor(16765498),
    critDeep: hexToColor(16730640),
    heal: hexToColor(8257440),
    healDeep: hexToColor(3133552),
    gold: hexToColor(16765002),
    goldDeep: hexToColor(15768096),
    goldHot: hexToColor(16769658),
    dust: hexToColor(12101256),
    dustDark: hexToColor(8022614),
    rock: hexToColor(9076854),
    smoke: hexToColor(4867664),
    smokeDark: hexToColor(2499628),
    ember: hexToColor(16742972),
    frost: hexToColor(9428223),
    frostDeep: hexToColor(5217535),
    shadow: hexToColor(1182752),
    red: hexToColor(16728112),
    redDeep: hexToColor(11540504),
    blue: hexToColor(4890879),
    blueDeep: hexToColor(2121952),
    green: hexToColor(10354554),
    poison: hexToColor(12120160),
    poisonDeep: hexToColor(5216812),
    black: hexToColor(0),
    greenDeep: hexToColor(2058796),
    amber: hexToColor(16761418),
    violet: hexToColor(10514687),
    violetHot: hexToColor(14731519),
    violetDeep: hexToColor(2758232),
    abyssCyan: hexToColor(8384736),
    frostHot: hexToColor(14218495),
    emberHot: hexToColor(16765562),
    spore: hexToColor(14215328),
    moth: hexToColor(9433312),
    earth: hexToColor(10124376),
    earthDark: hexToColor(6179382),
    bronze: hexToColor(14723144),
    stringGold: hexToColor(16769696),
    plume: hexToColor(16513780),
    sand: hexToColor(14206106),
    sandDark: hexToColor(11048050),
    grass: hexToColor(11059296),
    grassDark: hexToColor(7309882),
    stone: hexToColor(13683908),
    stoneDark: hexToColor(9078400),
    silk: hexToColor(15787724),
    silkDark: hexToColor(12101246),
    cinnabar: hexToColor(13120042),
    ink: hexToColor(920086),
  },
  SHAPE_TRIANGLE_COUNTS = [
    { glow: hexToColor(ARENA_PALETTE.blue.glow), hot: hexToColor(9226495), deep: hexToColor(ARENA_PALETTE.blue.dark) },
    { glow: hexToColor(ARENA_PALETTE.red.glow), hot: hexToColor(16752752), deep: hexToColor(ARENA_PALETTE.red.dark) },
    { glow: hexToColor(ARENA_PALETTE.neutral.glow), hot: hexToColor(16769162), deep: hexToColor(ARENA_PALETTE.neutral.dark) },
  ]

function triangleCountForShape(shapeIndex) {
  return SHAPE_TRIANGLE_COUNTS[shapeIndex] ?? SHAPE_TRIANGLE_COUNTS[2]
}

const FX_SHAPES = { pillar: 0, sphere: 1, slash: 2, diamond: 3, arrow: 4, cone: 6, hoop: 7, spike: 8, rock: 9, breath: 10, dagger: 11, shield: 12 },
  ROCK_SHAPES = new Set([FX_SHAPES.spike, FX_SHAPES.rock]),
  FX_STYLES = { plain: 0, rim: 1, core: 2, pillar: 3, slash: 4, hex: 5, vortex: 6, solid: 7, hoop: 8, breath: 9, plate: 10 },
  SHAPE_SEGMENT_COUNTS = { 0: 48, 1: 96, 2: 64, 3: 96, 4: 48, 5: 24, 6: 32, 7: 64, 8: 96, 9: 64, 10: 4, 11: 24, 12: 24 },
  VFX_LIFETIME = 420,
  VFX_VERTEX_SHADER = `
attribute vec4 aTint;
attribute vec4 aFxp;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObj;
varying vec3 vColor;
varying vec4 vTint;
varying vec4 vFxp;
void main() {
  if (aTint.a <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vUv = uv;
  vObj = position;
  vColor = color;
  vTint = aTint;
  vFxp = aFxp;
  mat3 m = mat3(instanceMatrix);
  // 非均匀缩放下的法线：按各轴缩放平方修正
  vec3 s2 = vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
  vNormal = normalize(mat3(viewMatrix) * (m * (normal / max(s2, vec3(1e-8)))));
  vec4 mv = viewMatrix * (instanceMatrix * vec4(position, 1.0));
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`,
  VFX_FRAGMENT_SHADER = `
uniform float uNow;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObj;
varying vec3 vColor;
varying vec4 vTint;
varying vec4 vFxp;
${GLSL_HASH_NOISE}
${GLSL_ADDITIVE}
const float PI = 3.14159265;
float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
  float d = max(dot(g, s * 0.5), g.x);
  return smoothstep(0.4, 0.485, d);
}
void main() {
  float mode = floor(vFxp.x + 0.001);
  float fxAdd = clamp((vFxp.x - mode) / 0.9, 0.0, 1.0);
  float seed = vFxp.y;
  float pr = vFxp.z;
  float k = vFxp.w;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float ndv = abs(dot(N, V));
  vec3 c = vTint.rgb * vColor;
  float a = vTint.a;
  float hot = 0.0;
  if (mode < 0.5) {
  } else if (mode < 1.5) {
    a *= min(1.0, pow(1.0 - ndv, k) * 2.2 + 0.08);
  } else if (mode < 2.5) {
    float f = pow(ndv, k);
    a *= f;
    hot = f * f * f * 0.6;
  } else if (mode < 3.5) {
    float n = fbm(vec2(vUv.x * 18.0 + seed * 31.0, vUv.y * 2.5 - uNow * 1.8));
    float fall = pow(max(0.0, 1.0 - vUv.y), k);
    a *= min(1.0, fall * (0.55 + 0.9 * n) * (0.45 + 0.55 * ndv) * 2.2) * smoothstep(0.0, 0.03, vUv.y);
    hot = fall * fall * fall * 0.3;
  } else if (mode < 4.5) {
    float v = vUv.y;
    float u = vUv.x;
    float prof = pow(v, 1.5) * (1.0 - smoothstep(0.94, 1.0, v));
    // k = 可见弧长占整段弧的比例(1 = 全弧 2.5 弧度)：按技能的扇形角裁剪
    float uu = clamp((u - 0.5) / max(k, 0.05) + 0.5, 0.0, 1.0);
    float ends = pow(max(0.0, sin(uu * PI)), 0.6);
    u = uu;
    float sw = 1.0;
    if (pr >= 0.0) {
      float h = pr * 1.8;
      sw = (1.0 - smoothstep(h - 0.06, h, u)) * smoothstep(h - 1.0, h - 0.25, u);
    }
    a *= prof * ends * sw * 1.9;
    hot = pow(v, 7.0) * ends * sw * 1.2;
  } else if (mode < 5.5) {
    vec3 d = normalize(vObj);
    vec2 hp = vec2(atan(d.z, d.x) * 2.6, asin(clamp(d.y, -1.0, 1.0)) * 3.6);
    float rim = pow(1.0 - ndv, 2.4);
    float pulse = 0.5 + 0.5 * sin(uNow * 3.0 - d.y * 5.0 + seed * 6.0);
    float cell = hexEdge(hp * 1.5);
    a *= min(1.0, rim * 1.35 + cell * (0.3 + 0.3 * pulse) * (0.5 + 0.5 * rim) + 0.07);
    hot = rim * rim * 0.3;
  } else if (mode < 6.5) {
    float n = fbm(vec2(vUv.x * 5.0 + vUv.y * k - uNow * 1.6, vUv.y * 3.0 - uNow * 2.2) + seed * 9.0);
    float th = mix(0.2, 1.0, pr);
    float body = smoothstep(th - 0.12, th + 0.18, n + (1.0 - vUv.y) * 0.5);
    a *= min(1.0, body * smoothstep(0.0, 0.08, vUv.y) * pow(max(0.0, 1.0 - vUv.y), 0.5) * (0.55 + 0.45 * ndv) * 1.4);
    hot = body * (1.0 - vUv.y) * 0.25;
  } else if (mode < 7.5) {
    float l = 0.55 + 0.45 * max(0.0, dot(N, normalize(vec3(-0.3, 0.8, 0.5))));
    c = c * l + vTint.rgb * pow(1.0 - ndv, 2.5) * 0.45;
  } else if (mode < 8.5) {
    float prof = sin(vUv.y * PI);
    a *= min(1.0, prof * prof * 2.0);
    hot = pow(prof, 6.0) * 0.5;
  } else if (mode > 9.5) {
    // 盾影：uv.x 横跨盾面、uv.y 沿长轴，四条边就是 0 / 1；包边亮、盾面淡，中央一枚盾鼻
    float ex = abs(vUv.x * 2.0 - 1.0);
    float ey = abs(vUv.y * 2.0 - 1.0);
    float rim = max(smoothstep(0.7, 0.8, ex), smoothstep(0.85, 0.9, ey));
    float inner = max(1.0 - smoothstep(0.0, 0.06, abs(ex - 0.5)), 1.0 - smoothstep(0.0, 0.035, abs(ey - 0.7))) * step(ex, 0.56) * step(ey, 0.74);
    float bd = length(vec2((vUv.x - 0.5) * 0.62, vUv.y - 0.5));
    float boss = (1.0 - smoothstep(0.0, 0.028, abs(bd - 0.1))) + (1.0 - smoothstep(0.035, 0.055, bd));
    float sheen = pr >= 0.0 ? (1.0 - smoothstep(0.0, 0.16, abs(vUv.y + ex * 0.25 - mix(-0.25, 1.35, pr)))) : 0.0;
    float fill = k * (0.6 + 0.4 * max(ex, ey)) + sheen * 0.3;
    float line = min(1.0, rim + inner * 0.55 + boss * 0.85);
    a *= min(1.0, line + fill);
    // 盾面比包边暗一档：线是亮铜色，面是半透明的深铜；最外沿再压一道深色的轮廓线，亮地面上才托得住
    c *= mix(0.45, 1.0, min(1.0, line + sheen));
    float outl = max(smoothstep(0.93, 0.975, ex), smoothstep(0.965, 0.99, ey));
    c *= 1.0 - outl * 0.85;
    hot = (rim * 0.5 + boss * 0.35 + sheen * 0.4) * (1.0 - outl);
  } else {
    // 吐息：两层反向滚动的噪声沿锥体流出；越往外越稀、边缘被侵蚀，收尾时整体由根部向外溶解
    float u = vUv.x;
    float w = vUv.y;
    float t1 = uNow * k;
    float n1 = fbm(vec2(u * 3.2 - t1, w * 7.0 + seed * 13.0));
    float n2 = fbm(vec2(u * 6.5 - t1 * 1.6 + 3.1, w * 13.0 - t1 * 0.4 + seed * 5.0));
    float n = n1 * 0.65 + n2 * 0.5;
    float th = mix(0.3, 0.85, u) + pr * 0.9 * (1.0 - u * 0.3);
    float body = smoothstep(th - 0.1, th + 0.14, n + (1.0 - u) * 0.3);
    // 丝缕：沿流动方向拉长的细纹，让气流有方向感
    float wisp = 0.4 + 0.6 * smoothstep(0.3, 0.7, fbm(vec2(u * 1.5 - t1 * 1.3, w * 22.0 + seed * 3.0)));
    float ends = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.75, 1.0, u + (n2 - 0.5) * 0.3));
    a *= min(1.0, body * wisp * ends * (0.25 + 0.75 * ndv) * 1.25);
    // 根部青白，向外过渡到本色
    float root = 1.0 - smoothstep(0.0, 0.45, u);
    float m0 = max(c.r, max(c.g, c.b));
    c = mix(c, vec3(0.82, 1.0, 1.0) * m0 * 1.25, root * 0.85);
    hot = root * root * body * 0.6;
  }
  float fxA = min(1.0, a);
  if (fxA < 0.004) discard;
  vec3 fxC = c * (1.0 + hot * 0.7) + vec3(hot * 0.3 * max(c.r, max(c.g, c.b)));
  // §7.1 亮度上限：大面积的壳 / 柱 / 罩 / 漩涡 / 吐息主体 ≤0.9(白热部分放宽到 1.6)，线状的斩弧 / 环箍 / 盾影 ≤1.6，
  // 小弹体与实体交给输出段的全局上限(3.2)
  float capL = (mode > 0.5 && mode < 1.5) || (mode > 2.5 && mode < 3.5) || (mode > 4.5 && mode < 6.5) || (mode > 8.5 && mode < 9.5) ? 0.9 + 0.7 * min(1.0, hot * 2.0) : (mode > 3.5 && mode < 4.5) || (mode > 7.5 && mode < 8.5) || mode > 9.5 ? 1.6 : 8.0;
  float capM = max(fxC.r, max(fxC.g, fxC.b));
  float capK = capL * 0.7;
  if (capM > capK) fxC *= (capK + (capM - capK) / (1.0 + (capM - capK) / (capL - capK))) / capM;
  ${PARTICLE_TONEMAP_GLSL}
}
`

function applyVertexColors(geometry, colorForVertex) {
  const AttributeValue = geometry.getAttribute("position"),
    float32Array = new Float32Array(AttributeValue.count * 3)
  for (let index = 0; index < AttributeValue.count; index++) float32Array.set(colorForVertex(AttributeValue.getX(index), AttributeValue.getY(index), AttributeValue.getZ(index), index), index * 3)
  geometry.setAttribute("color", new BufferAttribute(float32Array, 3))
}

function resetVertexColors(geometry) {
  return (applyVertexColors(geometry, () => [1, 1, 1]), geometry)
}

/**
 * 创建几何与地形。
 *
 */
function buildGroundRingGeometry() {
  const positions = [],
    uvs = [],
    normals = [],
    indices = []
  for (let index = 0; index <= 28; index++) {
    const ringFraction = index / 28,
      ringAngle = (ringFraction - 0.5) * 2.5,
      innerRadiusInset = 0.36 * Math.pow(Math.sin(Math.PI * ringFraction), 0.7) + 0.01
    for (const [ringRadius, ringUvV] of [
      [1 - innerRadiusInset, 0],
      [1, 1],
    ])
      (positions.push(Math.cos(ringAngle) * ringRadius, 0, Math.sin(ringAngle) * ringRadius), uvs.push(ringFraction, ringUvV), normals.push(0, 1, 0))
    if (index < 28) {
      const vertexBaseIndex = index * 2
      indices.push(vertexBaseIndex, vertexBaseIndex + 2, vertexBaseIndex + 1, vertexBaseIndex + 1, vertexBaseIndex + 2, vertexBaseIndex + 3)
    }
  }
  const bufferGeometry = new BufferGeometry()
  return (bufferGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3)), bufferGeometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2)), bufferGeometry.setAttribute("normal", new Float32BufferAttribute(normals, 3)), bufferGeometry.setIndex(indices), resetVertexColors(bufferGeometry))
}

/**
 * 创建几何与地形。
 *
 */
function buildGroundDiscGeometry() {
  const discPositions = [],
    discUvs = [],
    discNormals = [],
    discIndices = []
  for (let index = 0; index <= 40; index++) {
    const discAngle = (index / 40) * Math.PI * 2
    for (const [discRadius, discUvV] of [
      [0.72, 0],
      [1, 1],
    ])
      (discPositions.push(Math.cos(discAngle) * discRadius, 0, Math.sin(discAngle) * discRadius), discUvs.push(index / 40, discUvV), discNormals.push(0, 1, 0))
    if (index < 40) {
      const vertexBaseIndex = index * 2
      discIndices.push(vertexBaseIndex, vertexBaseIndex + 2, vertexBaseIndex + 1, vertexBaseIndex + 1, vertexBaseIndex + 2, vertexBaseIndex + 3)
    }
  }
  const discGeometry = new BufferGeometry()
  return (discGeometry.setAttribute("position", new Float32BufferAttribute(discPositions, 3)), discGeometry.setAttribute("uv", new Float32BufferAttribute(discUvs, 2)), discGeometry.setAttribute("normal", new Float32BufferAttribute(discNormals, 3)), discGeometry.setIndex(discIndices), resetVertexColors(discGeometry))
}

export { smoothStepVfx, FX_SHAPES, FX_STYLES, triangleCountForShape, VFX_LIFETIME, ROCK_SHAPES, resetVertexColors, applyVertexColors, hexToColor, ObjectPool, SeededRandom, VFX_COLORS, VFX_VERTEX_SHADER, VFX_FRAGMENT_SHADER, buildGroundRingGeometry, SHAPE_SEGMENT_COUNTS, FX_TWO_PI, buildGroundDiscGeometry, easeOutBack, HERO_VFX_PALETTES }
