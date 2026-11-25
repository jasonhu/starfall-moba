/**
 * 单位属性注入着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Vector3 } from 'three'
import { GLSL_TONEMAP } from './glsl-chunks'

const UNIT_ATTRIBUTE_VERTEX_SHADER = `
attribute vec4 aTint;
attribute vec2 aKind;
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vKind;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vTint = aTint;
  vKind = aKind;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`,
  UNIT_ATTRIBUTE_FRAGMENT_SHADER = `
uniform sampler2D tNoise;
uniform float uTime;
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vKind;
varying vec3 vWorld;
void main() {
  float kind = vKind.x;
  float seed = vKind.y;
  float t = uTime;
  vec3 rgbOut;
  float aOut;
  if (kind < 0.5) {
    // 光束：横向软边 + 沿束方向的条纹(几道粗细不一的光缕)，上端渐隐、落地处也收掉
    float across = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
    float shafts = texture2D(tNoise, vec2(vUv.x * 0.37 + seed, vUv.y * 0.05 + t * 0.006 + seed * 3.0)).g;
    float drift = texture2D(tNoise, vec2(vUv.x * 0.9 + seed * 2.0 - t * 0.004, vUv.y * 0.3 - t * 0.012)).r;
    float along = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
    float a = across * along * smoothstep(0.32, 0.7, shafts) * (0.55 + 0.9 * drift) * vTint.a;
    rgbOut = vTint.rgb * a;
    aOut = 0.0;
  } else if (kind < 1.5) {
    // 雾片：径向软边 + 两层反向漂移的噪声
    vec2 c = vUv - 0.5;
    float edge = 1.0 - smoothstep(0.18, 0.5, length(c));
    float n1 = texture2D(tNoise, vWorld.xz * 0.031 + vec2(t * 0.006, -t * 0.004) + seed).r;
    float n2 = texture2D(tNoise, vWorld.xz * 0.074 - vec2(t * 0.009, t * 0.005) + seed * 2.0).g;
    float a = edge * smoothstep(0.3, 0.78, n1 * 0.6 + n2 * 0.4) * vTint.a;
    rgbOut = vTint.rgb * a;
    aOut = a;
  } else {
    // 光柱：横向高斯状、往上渐隐
    float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
    float a = across * across * (1.0 - smoothstep(0.1, 1.0, vUv.y)) * (0.8 + 0.2 * sin(t * 1.4 + seed * 6.0)) * vTint.a;
    rgbOut = vTint.rgb * a;
    aOut = 0.0;
  }
  gl_FragColor = vec4(rgbOut, aOut);
  ${GLSL_TONEMAP}
}
`,
  UNIT_ATTRIBUTE_DECLS = new Vector3(0, -0.72, -0.69).normalize()

export { UNIT_ATTRIBUTE_FRAGMENT_SHADER, UNIT_ATTRIBUTE_DECLS, UNIT_ATTRIBUTE_VERTEX_SHADER }
