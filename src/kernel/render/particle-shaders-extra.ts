/**
 * 粒子/草丛辅助着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_DEFAULT_NORMAL, GLSL_LIGHT_TINT, GLSL_SIDE_FILL, GLSL_TONEMAP, GLSL_VERTEX_COMMON } from './glsl-chunks'
import { TERRAIN_PALETTE_INDEX } from '../world/map-geometry'

const PARTICLE_SOFT_VERTEX_SHADER = `
${GLSL_VERTEX_COMMON}
varying vec3 vWorldPos;
varying vec3 vViewPosition;
void main() {
  vec3 objectNormal = vec3(0.0, 1.0, 0.0);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  ${GLSL_DEFAULT_NORMAL}
}
`,
  PARTICLE_SOFT_FRAGMENT_SHADER = `
${GLSL_SIDE_FILL}
${GLSL_LIGHT_TINT}
uniform sampler2D tNoise;
uniform sampler2D tSplatA;
uniform float uTime;
uniform float uSplatScale;
uniform vec2 uFlow;
uniform vec3 uShadeTintGround;
uniform vec3 cShallow;
uniform vec3 cDeep;
uniform vec3 cPit;
uniform vec3 cSky;
uniform vec3 cFoam;
uniform vec3 uPits[2];
varying vec3 vWorldPos;
varying vec3 vViewPosition;
const float TAU = 6.2831853;
void main() {
  vec2 wp = vWorldPos.xz;
  vec4 sa = texture2D(tSplatA, wp * uSplatScale + 0.5);
  float shore = -(sa.g - 0.5) * ${(TERRAIN_PALETTE_INDEX.river * 2).toFixed(1)};
  float dLane = (sa.r - 0.5) * ${(TERRAIN_PALETTE_INDEX.lane * 2).toFixed(1)};
  float t = uTime;
  vec4 n1 = texture2D(tNoise, wp * 0.061 - uFlow * t * 0.022);
  vec4 n2 = texture2D(tNoise, wp * 0.113 - uFlow * t * 0.041 + vec2(0.37, 0.71));
  // 波纹法线(世界空间 → 视图空间)
  vec3 Nw = normalize(vec3((n1.g - 0.5) * 0.4 + (n2.b - 0.5) * 0.3, 1.0, (n1.b - 0.5) * 0.4 + (n2.g - 0.5) * 0.3));
  vec3 N = normalize((viewMatrix * vec4(Nw, 0.0)).xyz);
  vec3 V = normalize(vViewPosition);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  float ford = 1.0 - smoothstep(-1.2, 0.8, dLane);
  float depthF = smoothstep(0.1, 2.8, shore) * (1.0 - 0.32 * ford);
  // 河心的水色往浅色收一点(对色：河水中段 L* 60~64)
  vec3 tint = mix(cShallow, cDeep, depthF * 0.86);
  float alpha = mix(0.1, 0.4, depthF);

  // 两个史诗潭：水色加深(河底几乎看不见，突出潭的深)
  float pit = 0.0;
  vec2 pq = vec2(0.0);
  for (int i = 0; i < 2; i++) {
    vec2 d = wp - uPits[i].xy;
    float k = 1.0 - smoothstep(uPits[i].z * 0.72, uPits[i].z * 1.22, length(d));
    if (k > pit) {
      pit = k;
      pq = d;
    }
  }
  tint = mix(tint, cPit, pit * 0.9);
  alpha = mix(alpha, 0.74, pit * 0.85);

  float shadow = kitShadow();
  vec3 sun = kitSunColor();
  vec3 L = kitSunDir();
  vec3 amb = kitTintAmbient(kitAmbient(N), kitLightTint(wp));
  vec3 irr = amb + sun * max(dot(N, L), 0.0) * shadow;
  vec3 col = tint * RECIPROCAL_PI * irr;
  // 大块缓慢流动的明暗水纹：手绘感的浅色涡流
  float swirl = texture2D(tNoise, vec2(dot(wp, vec2(-uFlow.y, uFlow.x)) * 0.05, dot(wp, uFlow) * 0.018 - t * 0.012)).r;
  float swirl2 = texture2D(tNoise, vec2(dot(wp, vec2(-uFlow.y, uFlow.x)) * 0.11 + 0.4, dot(wp, uFlow) * 0.04 - t * 0.02)).g;
  float band = smoothstep(0.5, 0.68, swirl * 0.6 + swirl2 * 0.4);
  col = mix(col, col * 1.25 + vec3(0.015, 0.035, 0.035), band * 0.5 * depthF);
  alpha += band * 0.06 * depthF;
  #if WATER >= 2
  if (pit > 0.01) {
    // 潭内旋涡：极坐标里缓慢旋进的亮纹
    float pr = length(pq);
    float pa = atan(pq.y, pq.x) / TAU;
    float sw = texture2D(tNoise, vec2(pa * 2.0 + pr * 0.11 - t * 0.02, pr * 0.085 + t * 0.012)).g;
    float streak = smoothstep(0.5, 0.62, sw) * (1.0 - smoothstep(0.62, 0.78, sw));
    col += tint * RECIPROCAL_PI * irr * streak * pit * 1.1;
    alpha += streak * pit * 0.1;
  }
  #endif
  // 天光反射
  col = mix(col, cSky * (0.55 + 0.45 * shadow), fres * 0.5);
  alpha = mix(alpha, 0.85, fres * 0.6);

  #if WATER >= 2
  // 太阳碎闪：只在水纹亮带上零星出现
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), 220.0);
  float glint = smoothstep(0.3, 0.8, sp) * shadow * (0.25 + 0.75 * band);
  col += sun * glint * 0.9;
  alpha = max(alpha, glint);
  #endif

  // ── 泡沫 ──
  float fn = n1.r * 0.6 + n2.r * 0.4;
  // 拍岸沫：贴着水线，宽度被噪声撕碎，3.5 秒一个进退约 0.25 米的周期
  float lap = 0.125 + 0.125 * sin(t * (TAU / 3.5) + fn * 5.0 + dot(wp, vec2(0.23, 0.17)));
  float edgeW = 0.1 + 0.22 * fn + lap * 0.8;
  float edge = 1.0 - smoothstep(edgeW * 0.45, edgeW, shore - 0.3);
  float foam = edge * (0.5 + 0.5 * n2.b);
  // 向岸推进的一道细浪
  foam += smoothstep(0.72, 0.93, sin((shore - t * 0.3) * 5.0 + fn * 8.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.45, 1.5, shore)) * 0.34;
  #if WATER >= 1
  // 漂沫：顺流漂移的碎沫，成簇，靠岸处多
  // (沿流向拉长的噪声取细带：一缕一缕的，不是点)
  vec2 fuv = vec2(dot(wp, vec2(-uFlow.y, uFlow.x)) * 0.36, dot(wp, uFlow) * 0.06 - t * 0.021);
  vec4 fl = texture2D(tNoise, fuv);
  float clump = smoothstep(0.52, 0.7, n1.r * 0.7 + (1.0 - smoothstep(0.4, 2.2, shore)) * 0.3);
  float streak = (1.0 - smoothstep(0.015, 0.05, abs(fl.b - 0.5))) * smoothstep(0.5, 0.64, fl.g);
  foam += streak * clump * 0.42 * (1.0 - pit * 0.7);
  #endif
  foam = clamp(foam, 0.0, 1.0);
  vec3 foamCol = cFoam * RECIPROCAL_PI * (amb + sun * shadow * 0.9);
  col = mix(col, foamCol, foam);
  alpha = max(alpha, foam * 0.78);
  col *= mix(uShadeTintGround, vec3(1.0), shadow);
  // 边界淡出：水面带两侧多出来的部分不应盖住岸
  alpha *= smoothstep(-0.9, -0.3, shore);

  gl_FragColor = vec4(col, alpha);
  ${GLSL_TONEMAP}
}
`

export { PARTICLE_SOFT_VERTEX_SHADER, PARTICLE_SOFT_FRAGMENT_SHADER }
