/**
 * 后处理片元着色器 POSTFX_FRAGMENT（tDiffuse + tBloom + 饱和度/自然饱和度）（原 starfall.core.js 第 22835-22889 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
const POSTFX_FRAGMENT = `
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uSaturation;
uniform float uVibrance;
uniform vec2 uContrast;
uniform float uVignette;
uniform float uAspect;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uHaze;
uniform vec3 uHazeColor;
uniform float uDesaturate;
uniform float uDim;
#include <tonemapping_pars_fragment>
#include <colorspace_pars_fragment>
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c = CustomToneMapping(c);
  #ifdef GRADE
  // 对比：幂函数式，围绕支点(线性值)拉开；纯黑不动，暗部不会被整体减掉一截
  c = uContrast.y * pow(max(c, 0.0) / uContrast.y, vec3(uContrast.x));
  // 饱和 + 自然饱和
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / max(mx, 1e-4);
  c = max(mix(vec3(l), c, uSaturation + uVibrance * (1.0 - sat)), 0.0);
  // 色彩分离：暗部偏青紫、亮部偏暖
  float lc = clamp(l, 0.0, 1.0);
  c += uShadowTint * (1.0 - lc) * (1.0 - lc) + uHighlightTint * lc * lc;
  // 远景薄霾：屏幕上沿就是远处，给一点冷亮的空气感
  float hz = smoothstep(0.55, 1.0, vUv.y);
  c = mix(c, uHazeColor, uHaze * hz * sqrt(hz));
  vec2 q = (vUv - 0.5) * vec2(min(uAspect, 1.8) / 1.8, 1.0);
  float v = smoothstep(0.38, 0.95, length(q));
  c *= 1.0 - uVignette * v * v;
  #endif
  float g = dot(max(c, 0.0), vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3(g) * vec3(0.92, 0.97, 1.08), uDesaturate);
  c *= 1.0 - uDim;
  gl_FragColor = sRGBTransferOETF(vec4(clamp(c, 0.0, 1.0), 1.0));
  // 抖动：消除大面积渐变(雾/暗角/云海)的色带
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}
`

export { POSTFX_FRAGMENT }
