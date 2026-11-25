/**
 * 地表着色器：地板/场景的顶点与片元着色器（含 TOON_FX 与风吹摆动）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_DEFAULT_NORMAL, GLSL_DITHER, GLSL_KICK, GLSL_LIGHT_TINT, GLSL_SIDE_FILL, GLSL_TIME_UNIFORM, GLSL_TONEMAP, GLSL_VERTEX_COMMON } from './glsl-chunks'

const SURFACE_VERTEX_SHADER = `
${GLSL_VERTEX_COMMON}
#include <color_pars_vertex>
${GLSL_TIME_UNIFORM}
uniform float uSway;
uniform float uSwayHeight;
#ifdef TOON_FX
attribute vec4 aFx;
#endif
varying vec4 vFx;
varying vec3 vNormal;
varying vec3 vViewPosition;
#ifdef TOON_MAP
uniform float uMapScale;
varying vec2 vUv;
#endif
#ifdef TOON_WORLD_POS
varying vec3 vWorldPos;
#endif
void main() {
  #include <color_vertex>
  #ifdef TOON_FX
  vFx = aFx;
  #else
  vFx = vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  #ifdef TOON_MAP
  vUv = uv * uMapScale;
  #endif
  vec3 objectNormal = normal;
  vec4 worldPosition = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  worldPosition = instanceMatrix * worldPosition;
  #endif
  worldPosition = modelMatrix * worldPosition;
  #ifdef TOON_WIND
  worldPosition.xyz += windOffset(worldPosition.xyz, uSway * (vFx.x + max(position.y, 0.0) * uSwayHeight));
  #endif
  #ifdef TOON_WORLD_POS
  vWorldPos = worldPosition.xyz;
  #endif
  ${GLSL_DEFAULT_NORMAL}
  vNormal = normalize(transformedNormal);
}
`,
  SURFACE_FRAGMENT_SHADER = `
${GLSL_SIDE_FILL}
#include <color_pars_fragment>
${GLSL_DITHER}
${GLSL_KICK}
#ifdef TOON_LIGHT_TINT
${GLSL_LIGHT_TINT}
#endif
uniform vec3 uColor;
uniform vec3 uTint;
uniform float uOpacity;
uniform vec3 uEmissive;
uniform float uGlowBoost;
uniform vec4 uRamp;
uniform vec3 uShadeTint;
uniform vec3 uRimColor;
uniform vec2 uRim;
uniform vec2 uSpec;
uniform vec3 uTeamColor;
uniform float uFlash;
uniform vec3 uFlashColor;
#ifdef TOON_KICKER
uniform float uKick;
uniform vec2 uKickDir;
uniform vec3 uKickColor;
#endif
#ifdef TOON_MAP
uniform sampler2D tMap;
varying vec2 vUv;
#endif
#ifdef TOON_TRIPLANAR
uniform sampler2D tMap;
uniform float uTriScale;
#endif
#ifdef TOON_MAP_TOP
uniform sampler2D tMapTop;
uniform vec3 uMapTop;
#ifdef TOON_MAP_TOP_NOISE
uniform sampler2D tMapTopNoise;
#endif
#endif
#ifdef TOON_WORLD_POS
varying vec3 vWorldPos;
#endif
uniform float uMapGain;
varying vec4 vFx;
varying vec3 vNormal;
varying vec3 vViewPosition;

float toonRamp(float ndl) {
  #if TOON_STEPS == 1
  float h = ndl * 0.5 + 0.5;
  return h * h;
  #elif TOON_STEPS == 2
  return smoothstep(uRamp.x - uRamp.w, uRamp.x + uRamp.w, ndl);
  #else
  float a = smoothstep(uRamp.x - uRamp.w, uRamp.x + uRamp.w, ndl);
  float b = smoothstep(uRamp.y - uRamp.w, uRamp.y + uRamp.w, ndl);
  return a * uRamp.z + b * (1.0 - uRamp.z);
  #endif
}

void main() {
  #ifdef TOON_FLAT
  vec3 N = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  #else
  vec3 N = normalize(vNormal);
  #if defined(DOUBLE_SIDED) && !defined(TOON_KEEP_BACK_NORMALS)
  N *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  #endif

  vec4 base = vec4(uColor, uOpacity);
  #ifdef USE_COLOR
  base.rgb *= vColor.rgb;
  #endif
  #ifdef TOON_MAP
  vec4 texel = texture2D(tMap, vUv);
  base *= vec4(texel.rgb * uMapGain, texel.a);
  #endif
  #if defined(TOON_TRIPLANAR) || defined(TOON_MAP_TOP)
  vec3 Nw = inverseTransformDirection(N, viewMatrix);
  #endif
  #ifdef TOON_TRIPLANAR
  vec3 tw = abs(Nw);
  tw = tw * tw * tw * tw;
  tw /= tw.x + tw.y + tw.z;
  vec3 tp = vWorldPos * uTriScale;
  vec3 triTex = (texture2D(tMap, tp.zy).rgb * tw.x + texture2D(tMap, tp.xz).rgb * tw.y + texture2D(tMap, tp.xy).rgb * tw.z) * uMapGain;
  #ifdef TOON_MAP_MASK
  base.rgb *= mix(vec3(1.0), triTex, vFx.z);
  #else
  base.rgb *= triTex;
  #endif
  #endif
  #ifdef TOON_MAP_TOP
  // 顶面：按世界 xz 平铺的草贴图 + 大块色斑(与地表草地同一套做法，崖顶和地面连成一片)
  // 过渡放在 0.32~0.6：崖顶中轴线附近隆起处的斜面(法线 y 0.6~0.8)也铺满草贴图，不再是一块块没有纹理的浅色三角；
  // 竖直的岩面本来就被 aFx.z 蒙版挡在外面
  float topW = smoothstep(0.32, 0.6, Nw.y);
  #ifdef TOON_MAP_MASK
  topW *= 1.0 - vFx.z;
  #endif
  vec2 tuv = vWorldPos.xz * uMapTop.x;
  vec3 tg = texture2D(tMapTop, tuv).rgb * uMapTop.y;
  #ifdef TOON_MAP_TOP_DETAIL
  tg *= texture2D(tMapTop, vec2(tuv.y, -tuv.x) * 0.371 + 0.4).rgb * 0.8 + 0.62;
  #ifdef TOON_MAP_TOP_NOISE
  vec2 tn = texture2D(tMapTopNoise, vWorldPos.xz * 0.0213).rg;
  #else
  vec2 tn = 0.5 + 0.5 * vec2(sin(vWorldPos.x * 0.13 + sin(vWorldPos.z * 0.11) * 1.7), sin(vWorldPos.z * 0.17 - vWorldPos.x * 0.09 + 1.3));
  #endif
  vec3 topTint = mix(vec3(0.84, 0.97, 1.06), vec3(1.0), smoothstep(0.34, 0.62, tn.x));
  // 日晒那一档往橄榄收(不再发黄)，幅度减半
  topTint = mix(topTint, vec3(1.08, 1.04, 0.84), smoothstep(0.5, 0.74, tn.y) * 0.5);
  tg *= mix(vec3(1.0), topTint, uMapTop.z);
  #endif
  base.rgb *= mix(vec3(1.0), tg, topW);
  // 崖顶草向灰收一点：贴图乘上顶点色之后饱和度比色表高一截(实测 0.6 上下)，崖顶是画框，不该比场内的草还艳
  base.rgb = mix(base.rgb, vec3(dot(base.rgb, vec3(0.2126, 0.7152, 0.0722))), topW * 0.16);
  #endif
  #ifdef TOON_MAP_MASK
  base.rgb *= uTint;
  #else
  base.rgb = mix(base.rgb, uTeamColor, vFx.z) * uTint;
  #endif
  #ifdef ALPHATEST
  if (base.a < ALPHATEST) discard;
  #endif
  #ifdef TOON_DITHER_FADE
  if (base.a < 0.995) {
    if (base.a <= ditherThreshold(gl_FragCoord.xy)) discard;
  }
  base.a = 1.0;
  #endif

  vec3 V = normalize(vViewPosition);
  vec3 L = kitSunDir();
  float ndl = dot(N, L);
  float lit = toonRamp(ndl) * kitShadow();
  vec3 sun = kitSunColor();

  vec3 amb = kitAmbient(N);
  #ifdef TOON_LIGHT_TINT
  amb = kitTintAmbient(amb, kitLightTint(vWorldPos.xz));
  #endif
  vec3 irradiance = amb * vFx.w + sun * lit + kitPointLights(N, -vViewPosition);
  vec3 col = base.rgb * RECIPROCAL_PI * irradiance;
  col *= mix(uShadeTint, vec3(1.0), lit);

  // 轮廓光：受光侧暖边(暗部只留一点)
  float fres = pow(1.0 - saturate(dot(N, V)), uRim.y);
  col += uRimColor * (fres * uRim.x * (0.3 + 0.7 * lit));
  #ifdef TOON_KICKER
  // 背光侧冷边：只在朝屏幕右上、且不受光的轮廓上出现，把暗面从地面上分出来
  col += uKickColor * (kitKick(N, V, uKickDir) * (1.0 - 0.6 * lit) * uKick);
  #endif

  #ifdef TOON_SPECULAR
  vec3 H = normalize(L + V);
  float sp = pow(saturate(dot(N, H)), uSpec.y);
  col += sun * RECIPROCAL_PI * smoothstep(0.42, 0.58, sp) * uSpec.x * lit;
  #endif

  col += uEmissive + base.rgb * (vFx.y * uGlowBoost);
  col = mix(col, uFlashColor * 1.8, uFlash);

  gl_FragColor = vec4(col, base.a);
  ${GLSL_TONEMAP}
}
`

export { SURFACE_FRAGMENT_SHADER, SURFACE_VERTEX_SHADER }
