/**
 * 实例化渲染着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_ADDITIVE, GLSL_TONEMAP } from './glsl-chunks'

const INSTANCE_MAX_PER_FRAME = 32,
  INSTANCE_VERTEX_SHADER = `
#include <common>
attribute vec4 aPosR;
attribute vec4 aDim;
attribute vec3 aCol;
varying vec2 vCell;
varying vec3 vN;
varying vec3 vW;
varying vec3 vCol;
varying vec3 vT;
void main() {
  // position.x = 绕一圈的 0..1，position.y = 自下而上的 0..1
  float a = position.x * 6.2831853;
  float t = position.y;
  float crack = aDim.w;
  // 略微收顶；解除时整圈外扩
  float R = aPosR.w * (1.0 - 0.12 * t * t) * (1.0 + 0.22 * crack);
  vec3 n = vec3(cos(a), 0.0, sin(a));
  vec3 w = vec3(aPosR.x, aPosR.y + t * aDim.x, aPosR.z) + n * R;
  // 六边格坐标：周向 aDim.y 格，纵向按格宽换算(格子保持正六边形)
  float cellW = 6.2831853 * aPosR.w / aDim.y;
  vCell = vec2(position.x * aDim.y, t * aDim.x / cellW);
  vN = n;
  vW = w;
  vCol = aCol;
  vT = vec3(t, aDim.z, crack);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`,
  INSTANCE_FRAGMENT_SHADER = `
#include <common>
${GLSL_ADDITIVE}
uniform float uTime;
varying vec2 vCell;
varying vec3 vN;
varying vec3 vW;
varying vec3 vCol;
varying vec3 vT;
void main() {
  // 到最近格心的六边形距离 d：格心 0，格边 0.5
  const vec2 s = vec2(1.0, 1.7320508);
  vec2 p = vCell;
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = abs(dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw);
  float d = max(dot(q, s * 0.5), q.x);
  float t = vT.x;
  float crack = vT.z;
  // 格线：离格边 1.3 个像素以内(总宽两三个像素)；解除时线向格心收拢变粗
  float aa = fwidth(d) + 1e-4;
  float edge = 0.5 - d;
  float lw = aa * 1.0 + crack * 0.3;
  float line = 1.0 - smoothstep(lw, lw + aa, edge);
  // 填充：薄玻璃，靠近格边略浓
  float fill = 0.5 + 0.5 * smoothstep(0.1, 0.5, d);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 1.6);
  // 扫光：自下而上，两秒一次
  float sweep = fract(uTime * 0.5);
  float band = exp(-pow((t - sweep) * 5.0, 2.0)) * smoothstep(0.0, 0.1, sweep) * (1.0 - smoothstep(0.85, 1.0, sweep));
  // 上下两端渐隐
  float fade = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.84, 1.0, t)) * vT.y * (1.0 - crack);
  float glow = (line * (0.3 + 0.8 * band + 0.4 * fres + 1.6 * crack) + fill * (0.035 + 0.16 * band + 0.1 * fres)) * fade;
  float alpha = (line * 0.3 + fill * 0.1) * fade;
  if (glow + alpha < 0.004) discard;
  // 填充的本色(预乘) + 叠加的发光
  gl_FragColor = vec4(vCol * alpha * 0.45 + kitAdditive(vCol * glow), alpha);
  ${GLSL_TONEMAP}
}
`

export { INSTANCE_VERTEX_SHADER, INSTANCE_FRAGMENT_SHADER, INSTANCE_MAX_PER_FRAME }
