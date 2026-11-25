/**
 * 雾效着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_TONEMAP } from './glsl-chunks'

const FOG_VERTEX_SHADER = `
#include <common>
#include <fog_pars_vertex>
attribute vec2 aFall;
varying vec2 vUv;
varying vec2 vFall;
void main() {
  vUv = uv;
  vFall = aFall;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,
  FOG_FRAGMENT_SHADER = `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D tNoise;
uniform float uTime;
varying vec2 vUv;
varying vec2 vFall;
void main() {
  // vUv.x：横向 0..1；vUv.y：沿水流方向的米数。vFall.x：沿程 0(源头)..1(落点)；vFall.y：1 = 跌水，0 = 平铺的溪流。
  // 噪声沿下落方向拉长七八倍并向下滚动：读成一股一股的水，而不是一块抖动的白噪点
  float t = uTime;
  float n1 = texture2D(tNoise, vec2(vUv.x * 1.7, vUv.y * 0.034 - t * 0.36)).g;
  float n2 = texture2D(tNoise, vec2(vUv.x * 3.9 + 0.37, vUv.y * 0.058 - t * 0.62)).b;
  // 固定的几股水柱(只随横向变化，极慢地左右游移)
  float strands = texture2D(tNoise, vec2(vUv.x * 2.6 + 0.11 + sin(t * 0.21) * 0.01, 0.37)).g;
  float streak = smoothstep(0.4, 0.74, n1 * 0.6 + n2 * 0.4);
  float body = smoothstep(0.26, 0.6, strands + streak * 0.3);
  // 两侧与源头渐隐：没有一条笔直的边；落点一段翻成白沫
  float side = smoothstep(0.0, 0.26, vUv.x) * smoothstep(1.0, 0.74, vUv.x);
  float head = smoothstep(0.0, 0.16, vFall.x);
  float foam = smoothstep(0.7, 1.0, vFall.x) * vFall.y * (0.55 + 0.45 * n2);
  vec3 col = mix(vec3(0.19, 0.57, 0.83), vec3(0.93, 0.99, 1.0), max(streak * 0.85, foam));
  float a = side * head * max(mix(0.34, 0.9, body) * (0.55 + 0.45 * streak), foam * 0.9);
  gl_FragColor = vec4(col, a);
  ${GLSL_TONEMAP}
}
`

export { FOG_FRAGMENT_SHADER, FOG_VERTEX_SHADER }
