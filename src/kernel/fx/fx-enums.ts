/**
 * 特效枚举与样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_TONEMAP } from '../render/glsl-chunks'

const RING_STYLE_SHADOW = 0,
  RING_STYLE_MINION = 1,
  RING_STYLE_ENEMY_HERO = 2,
  RING_STYLE_PLAYER = 3,
  RING_VERTEX_SHADER = `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aPosR;
attribute vec4 aCol;
attribute vec4 aStyle;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vStyle;
void main() {
  vUv = position.xz;
  vCol = aCol;
  vStyle = aStyle;
  vec4 mvPosition = viewMatrix * vec4(aPosR.xyz + position * aPosR.w * 1.5, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,
  RING_FRAGMENT_SHADER = `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vStyle;
void main() {
  // 四边形比标称半径大 1.5 倍，留给外发光
  vec2 p = vUv * 1.5;
  float r = length(p);
  float style = vStyle.x;
  float aa = fwidth(r) * 1.2 + 1e-4;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  vec3 glow = vec3(0.0);
  if (style < 0.5) {
    // 接触阴影：vStyle.z > 1 时是沿 vStyle.y 方向拉长的椭圆(长轴 = 标称半径，短轴 = 半径 / z)
    float cs0 = cos(vStyle.y);
    float sn0 = sin(vStyle.y);
    vec2 e = vec2(p.x * cs0 + p.y * sn0, (-p.x * sn0 + p.y * cs0) * max(1.0, vStyle.z));
    r = length(e);
    float a = 1.0 - smoothstep(0.15, 1.05, r);
    alpha = a * a * vCol.a;
    col = vCol.rgb;
  } else {
    float cs = cos(vStyle.y);
    float sn = sin(vStyle.y);
    // q.x 指向单位朝向
    vec2 q = vec2(p.x * cs + p.y * sn, -p.x * sn + p.y * cs);
    float ring = 0.0;
    float fill = 0.0;
    if (style < 1.5) {
      ring = 1.0 - smoothstep(0.05, 0.05 + aa, abs(r - 0.92));
      fill = smoothstep(0.5, 0.92, r) * step(r, 0.92) * 0.18;
    } else {
      float w = style < 2.5 ? 0.055 : 0.07;
      ring = 1.0 - smoothstep(w, w + aa, abs(r - 0.93));
      // 朝向缺口 + 箭头
      float ang = atan(q.y, q.x);
      float gap = smoothstep(0.2, 0.26, abs(ang));
      ring *= gap;
      vec2 t = q - vec2(1.0, 0.0);
      float tri = max(abs(t.y) * 1.25 + t.x * 0.9 - 0.2, -t.x - 0.16);
      float arrow = 1.0 - smoothstep(0.0, aa * 1.5, tri);
      ring = max(ring, arrow);
      fill = smoothstep(0.45, 0.93, r) * step(r, 0.93) * 0.16;
      if (style > 2.5) {
        // 玩家：内圈一环缓慢转动的刻度
        float a2 = atan(p.y, p.x) + uTime * 0.6;
        float dash = smoothstep(0.25, 0.35, abs(fract(a2 / 6.2831853 * 12.0) - 0.5));
        float inner = (1.0 - smoothstep(0.022, 0.022 + aa, abs(r - 0.76))) * dash;
        ring = max(ring, inner * 0.85);
        fill *= 1.35;
      }
    }
    float halo = exp(-pow(max(r - 0.93, 0.0) * 7.0, 2.0)) * step(0.93, r) * 0.35;
    float a = saturate(ring + fill) * vCol.a;
    alpha = a;
    col = vCol.rgb * (0.85 + 0.6 * ring);
    glow = vCol.rgb * (ring * 0.55 + halo) * vCol.a;
  }
  if (alpha + glow.r + glow.g + glow.b < 0.004) discard;
  gl_FragColor = vec4(col * alpha + glow, alpha);
  ${GLSL_TONEMAP}
}
`

export { RING_FRAGMENT_SHADER, RING_STYLE_PLAYER, RING_VERTEX_SHADER, RING_STYLE_ENEMY_HERO, RING_STYLE_MINION, RING_STYLE_SHADOW }
