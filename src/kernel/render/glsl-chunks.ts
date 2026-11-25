/**
 * GLSL 片段库：哈希噪声/抖动/侧光填充/风吹偏移/色调映射/踢击光效
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { LIGHT_TINT_GAIN, SIDE_FILL_FACTOR, LIGHT_TINT_GRID_SIZE } from '../arena-palette'

const GLSL_HASH_NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
`,
  GLSL_TIME_UNIFORM = `
uniform float uTime;
uniform vec4 uWind;
vec3 windOffset(vec3 wp, float w) {
  float t = uTime * uWind.w;
  float phase = dot(wp.xz, uWind.xy) * 0.42;
  float gust = sin(t * 1.25 - phase) * 0.55 + sin(t * 2.9 - phase * 2.1 + wp.x * 0.61) * 0.3 + 0.35;
  float flutter = sin(t * 6.3 + wp.x * 3.3 + wp.z * 2.7) * 0.12;
  float cross = sin(t * 1.9 + wp.x * 0.9 - wp.z * 1.3) * 0.25;
  vec2 d = (uWind.xy * (gust + flutter) + vec2(-uWind.y, uWind.x) * cross) * uWind.z * w;
  return vec3(d.x, -dot(d, d) * 0.35, d.y);
}
`,
  GLSL_DITHER = `
float ditherThreshold(vec2 fragCoord) {
  return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
}
`,
  GLSL_SIDE_FILL = `
#define KIT_SIDE_FILL ${SIDE_FILL_FACTOR.toFixed(3)}
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
vec3 kitAmbient(vec3 N) {
  vec3 irr = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
    irr += getHemisphereLightIrradiance(hemisphereLights[i], N);
  }
  // 立面补光：法线越接近水平，多吃一份地面反光(被太阳晒亮的地面与对面的墙弹回来的暖光)。
  // 朝上的面(地表、台面)和朝下的面不受影响——只把岩壁、建筑和角色的背光立面托起来，暗面不发黑
  float ny = dot(N, hemisphereLights[0].direction);
  irr += hemisphereLights[0].groundColor * (KIT_SIDE_FILL * (1.0 - ny * ny));
  #endif
  return irr;
}
float kitShadow() {
  return getShadowMask();
}
vec3 kitSunDir() {
  #if NUM_DIR_LIGHTS > 0
  return directionalLights[0].direction;
  #else
  return normalize(vec3(-0.4, 0.8, 0.45));
  #endif
}
vec3 kitSunColor() {
  #if NUM_DIR_LIGHTS > 0
  return directionalLights[0].color;
  #else
  return vec3(0.0);
  #endif
}
vec3 kitPointLights(vec3 N, vec3 viewPos) {
  vec3 sum = vec3(0.0);
  #if NUM_POINT_LIGHTS > 0
  IncidentLight pl;
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    getPointLightInfo(pointLights[i], viewPos, pl);
    sum += pl.color * (dot(N, pl.direction) * 0.6 + 0.4);
  }
  #endif
  return sum;
}
`,
  GLSL_VERTEX_COMMON = `
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
`,
  GLSL_DEFAULT_NORMAL = `
#include <defaultnormal_vertex>
vec4 mvPosition = viewMatrix * worldPosition;
gl_Position = projectionMatrix * mvPosition;
vViewPosition = -mvPosition.xyz;
#include <shadowmap_vertex>
#include <fog_vertex>
`,
  GLSL_ADDITIVE = `
vec3 kitAdditive(vec3 c) {
  #ifdef TONE_MAPPING
  // 目标是「在 gamma 空间直接加上去」之后，观感接近 HDR 路径里「线性相加再色调映射」。后者在亮背景上其实加不了多少
  // (沙石地面上 1.0 的线性叠加只让显示值涨 0.2 出头)，所以这里把叠加量做成饱和曲线：显示值的增量最多 0.68，
  // 小数值基本线性。否则团战里几层辉光一叠就是一块死白，把英雄整个盖住(low 档又没有 bloom 来柔化边缘)。
  vec3 d = 0.68 * (1.0 - exp(-0.9 * max(c, vec3(0.0))));
  return pow(d, vec3(2.2));
  #else
  return c;
  #endif
}
`,
  GLSL_TONEMAP = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
`,
  GLSL_KICK = `
float kitKick(vec3 N, vec3 V, vec2 dir) {
  float edge = smoothstep(0.42, 0.64, 1.0 - saturate(dot(N, V)));
  return edge * smoothstep(0.05, 0.6, dot(N.xy, dir));
}
`,
  GLSL_LIGHT_TINT = `
#define KIT_LIGHT_TINT_GAIN ${LIGHT_TINT_GAIN.toFixed(2)}
uniform sampler2D tLightTint;
vec4 kitLightTint(vec2 worldXZ) {
  return texture2D(tLightTint, worldXZ * ${(0.5 / LIGHT_TINT_GRID_SIZE).toFixed(8)} + 0.5);
}
vec3 kitTintAmbient(vec3 ambient, vec4 lt) {
  return ambient * lt.a + lt.rgb * KIT_LIGHT_TINT_GAIN;
}
`

export { GLSL_DEFAULT_NORMAL, GLSL_SIDE_FILL, GLSL_LIGHT_TINT, GLSL_VERTEX_COMMON, GLSL_TIME_UNIFORM, GLSL_HASH_NOISE, GLSL_KICK, GLSL_TONEMAP, GLSL_DITHER, GLSL_ADDITIVE }
