/**
 * Bloom 着色器：FULLSCREEN_VERT / BLOOM_PREFILTER_FRAG / BLUR_FRAG / BLOOM_COMPOSITE_FRAG / BLOOM_LEVELS / BLOOM_LEVEL_WEIGHTS（原 starfall.core.js 第 22588-22651 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
const FULLSCREEN_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
  BLOOM_PREFILTER_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform vec2 uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture2D(tDiffuse, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture2D(tDiffuse, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  // 钳位：个别极亮的像素(高光/特效核心)不至于在降采样后炸成一大团
  c = min(c, vec3(12.0));
  float br = max(c.r, max(c.g, c.b));
  // 软拐点：阈值附近平滑过渡，避免高亮边缘闪烁
  float knee = uThreshold.y;
  float soft = clamp(br - uThreshold.x + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float w = max(soft, br - uThreshold.x) / max(br, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}
`,
  BLUR_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * 4.0;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tDiffuse, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c * 0.125, 1.0);
}
`,
  BLOOM_COMPOSITE_FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tBase;
uniform vec2 uTexel;
uniform float uSpread;
uniform vec2 uWeight;
varying vec2 vUv;
void main() {
  vec2 d = uTexel * uSpread;
  vec3 c = texture2D(tDiffuse, vUv + vec2(-d.x * 2.0, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(d.x * 2.0, 0.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(0.0, -d.y * 2.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(0.0, d.y * 2.0)).rgb;
  c += texture2D(tDiffuse, vUv + vec2(-d.x, d.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(d.x, d.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(-d.x, -d.y)).rgb * 2.0;
  c += texture2D(tDiffuse, vUv + vec2(d.x, -d.y)).rgb * 2.0;
  gl_FragColor = vec4(c * (uWeight.x / 12.0) + texture2D(tBase, vUv).rgb * uWeight.y, 1.0);
}
`,
  BLOOM_LEVELS = 6,
  BLOOM_LEVEL_WEIGHTS = [1, 0.85, 0.6, 0.4, 0.25, 0.15]

export { FULLSCREEN_VERT, BLOOM_PREFILTER_FRAG, BLUR_FRAG, BLOOM_COMPOSITE_FRAG, BLOOM_LEVELS, BLOOM_LEVEL_WEIGHTS }
