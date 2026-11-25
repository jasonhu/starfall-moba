/**
 * 水面着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_ADDITIVE, GLSL_TONEMAP } from './glsl-chunks'

const WATER_VERTEX_SHADER = `
uniform float uTime;
uniform float uScale;
attribute vec4 aSeed;
attribute vec3 aColor;
attribute vec3 aMotion;
varying vec3 vColor;
varying float vAlpha;
void main() {
  // aSeed: 相位, 速度, 尺寸, 模式；aMotion: 水平幅度, 垂直范围, 闪烁频率
  float ph = aSeed.x * 6.2831853;
  float t = uTime * aSeed.y;
  vec3 p = position;
  float fade = 1.0;
  if (aSeed.w > 0.5) {
    float k = fract(t * 0.12 + aSeed.x);
    p.y += k * aMotion.y;
    p.x += sin(t * 0.7 + ph) * aMotion.x * (0.3 + k);
    p.z += cos(t * 0.6 + ph * 1.7) * aMotion.x * (0.3 + k);
    fade = smoothstep(0.0, 0.15, k) * (1.0 - smoothstep(0.6, 1.0, k));
  } else {
    p.x += sin(t * 0.31 + ph) * aMotion.x + sin(t * 0.83 + ph * 2.3) * aMotion.x * 0.4;
    p.z += cos(t * 0.27 + ph * 1.3) * aMotion.x + cos(t * 0.71 + ph * 0.7) * aMotion.x * 0.4;
    p.y += sin(t * 0.43 + ph * 2.1) * aMotion.y;
  }
  float tw = 0.55 + 0.45 * sin(uTime * aMotion.z + ph * 3.0);
  vAlpha = fade * tw;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSeed.z * uScale / max(1.0, -mv.z);
}
`,
  WATER_FRAGMENT_SHADER = `
#include <common>
#include <fog_pars_fragment>
${GLSL_ADDITIVE}
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  // 亮核 + 柔和光晕
  float a = (1.0 - r);
  a = a * a * 0.6 + smoothstep(0.35, 0.0, r) * 0.9;
  gl_FragColor = vec4(kitAdditive(vColor * a * vAlpha * 1.6), 1.0);
  ${GLSL_TONEMAP}
}
`

export { WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER }
