/**
 * 植被着色器：顶点/片元 GLSL 源码
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_DEFAULT_NORMAL, GLSL_HASH_NOISE, GLSL_LIGHT_TINT, GLSL_SIDE_FILL, GLSL_VERTEX_COMMON } from './glsl-chunks'

const VEGETATION_VERTEX_SHADER = `
${GLSL_VERTEX_COMMON}
attribute vec4 aParam;
attribute vec3 aColorA;
attribute vec3 aColorB;
varying vec2 vUv;
varying vec4 vParam;
varying vec3 vColorA;
varying vec3 vColorB;
varying vec3 vWorldPos;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  vParam = aParam;
  vColorA = aColorA;
  vColorB = aColorB;
  vec3 objectNormal = vec3(0.0, 1.0, 0.0);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  ${GLSL_DEFAULT_NORMAL}
}
`,
  VEGETATION_FRAGMENT_SHADER = `
${GLSL_SIDE_FILL}
${GLSL_LIGHT_TINT}
${GLSL_HASH_NOISE}
uniform float uTime;
uniform float uBound;
uniform vec2 uAlert;
uniform vec3 uShadeTintGround;
varying vec2 vUv;
varying vec4 vParam;
varying vec3 vColorA;
varying vec3 vColorB;
varying vec3 vWorldPos;
varying vec3 vViewPosition;

const float TAU = 6.2831853;

float band(float x, float c, float w, float aa) {
  return 1.0 - smoothstep(w - aa, w + aa, abs(x - c));
}
// n 角星的有符号距离(iq)：m 越小角越尖
float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.141593 / n;
  float en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
// 一圈符文：把圆环切成 n 格，每格里用哈希画几道短划
float runes(float r, float a, float r0, float w, float n, float seed, float aa) {
  float cell = floor(a / TAU * n);
  float fa = fract(a / TAU * n) - 0.5;
  float fr = (r - r0) / w;
  if (abs(fr) > 1.0) return 0.0;
  float h = hash12(vec2(cell, seed));
  float h2 = hash12(vec2(cell + 31.0, seed));
  float g = 0.0;
  g = max(g, (1.0 - smoothstep(0.08, 0.14, abs(fa - (h - 0.5) * 0.4))) * step(abs(fr), 0.8));
  g = max(g, (1.0 - smoothstep(0.1, 0.2, abs(fr - (h2 - 0.5) * 1.2))) * step(abs(fa), 0.3) * step(0.35, h));
  g = max(g, (1.0 - smoothstep(0.1, 0.2, abs(fr + (h - 0.5) * 1.0))) * step(abs(fa + 0.1), 0.22) * step(0.5, h2));
  return g * step(abs(fa), 0.4);
}
// 环形石板：返回 (明暗, 接缝蒙版)
vec2 stoneRings(float r, float a, float seed) {
  float ringI = r < 0.42 ? 0.0 : (r < 0.7 ? 1.0 : 2.0);
  float n = ringI < 0.5 ? 6.0 : (ringI < 1.5 ? 10.0 : 16.0);
  float aa = a + ringI * 0.37 + seed;
  float cell = floor(aa / TAU * n);
  float fa = abs(fract(aa / TAU * n) - 0.5);
  float tone = 0.86 + 0.26 * hash12(vec2(cell, ringI + seed * 7.0));
  float jointA = smoothstep(0.5, 0.5 - 0.035 / max(r, 0.08) / n * 6.0, fa);
  float jr = min(min(abs(r - 0.42), abs(r - 0.7)), abs(r - 0.965));
  float jointR = smoothstep(0.0, 0.014, jr);
  return vec2(tone, jointA * jointR);
}

void main() {
  float type = vParam.x;
  float seed = vParam.y;
  float t = uTime;
  vec2 p = vUv;
  float r = length(p);
  if (r > 1.0) discard;
  if (type > 6.5 && type < 7.5) {
    // AO 暗斑：预乘黑色，不受光
    float k = 1.0 - r;
    gl_FragColor = vec4(0.0, 0.0, 0.0, vParam.w * k * k);
    return;
  }
  // 建筑/泉水的铺装不越过地图边界(界外是崖壁或下沉的台地)
  if (type < 2.5 && (abs(vWorldPos.x) > uBound || abs(vWorldPos.z) > uBound)) discard;
  float a = atan(p.y, p.x) + 3.141593;
  float aa = fwidth(r) * 1.3 + 1e-4;
  vec3 paint = vec3(0.0);
  float alpha = 0.0;
  vec3 glow = vec3(0.0);
  // ln：发光线条的强度累加。最后既作为彩色镶嵌(亮底上也看得清)，又作为自发光
  float ln = 0.0;
  float nz = 0.5;
  float nz2 = 0.5;
  if (type < 5.5 || type > 8.5) {
    nz = vnoise(vWorldPos.xz * 2.3 + seed);
    nz2 = vnoise(vWorldPos.xz * 7.1 + seed * 3.0);
  }

  if (type < 0.5) {
    // ── 塔座：三环石板 + 八角金星 + 队伍色光环 ──
    vec2 sr = stoneRings(r, a, seed);
    paint = vColorB * sr.x * mix(0.62, 1.0, sr.y) * (0.92 + 0.16 * nz2);
    float st = sdStar(p, 0.4, 8.0, 3.2);
    float starLine = 1.0 - smoothstep(0.012, 0.012 + aa * 1.5, abs(st));
    paint = mix(paint, vec3(0.9, 0.68, 0.26), starLine * 0.85);
    paint = mix(paint, vColorB * 0.6, (1.0 - smoothstep(-0.02, 0.0, st)) * 0.35);
    alpha = 1.0 - smoothstep(0.965, 1.0, r + (nz - 0.5) * 0.03);
    float pulse = 0.7 + 0.3 * sin(t * 1.7 + seed * 5.0);
    ln += band(r, 0.83, 0.012, aa) * 1.5 * pulse;
    // 环上 8 颗菱形星钉
    float ca = (fract(a / TAU * 8.0) - 0.5) * TAU / 8.0 * 0.56;
    float dia = abs(ca) * 5.0 + abs(r - 0.56) * 6.0;
    ln += (1.0 - smoothstep(0.16, 0.22, dia)) * 1.2 * pulse;
  } else if (type < 1.5) {
    // ── 水晶座：大星盘 ──
    vec2 sr = stoneRings(r * 1.02, a, seed);
    paint = vColorB * sr.x * mix(0.6, 1.0, sr.y) * (0.92 + 0.16 * nz2);
    float st = sdStar(p, 0.66, 8.0, 2.6);
    float st2 = sdStar(vec2(p.x * 0.7071 - p.y * 0.7071, p.x * 0.7071 + p.y * 0.7071), 0.5, 8.0, 3.4);
    float line = max(1.0 - smoothstep(0.008, 0.008 + aa * 1.5, abs(st)), 1.0 - smoothstep(0.006, 0.006 + aa * 1.5, abs(st2)));
    paint = mix(paint, vec3(0.9, 0.68, 0.26), line * 0.88);
    paint = mix(paint, vColorB * 1.12, (1.0 - smoothstep(-0.01, 0.0, st)) * 0.5);
    alpha = 1.0 - smoothstep(0.975, 1.0, r + (nz - 0.5) * 0.02);
    float pulse = 0.75 + 0.25 * sin(t * 1.3);
    ln += band(r, 0.9, 0.008, aa) * 2.4;
    ln += band(r, 0.45, 0.006, aa) * 2.0 * pulse;
    ln += runes(r, a + t * 0.06, 0.805, 0.045, 28.0, seed, aa) * 1.9 * pulse;
    // 从中心向外流动的能量纹
    float rays = pow(abs(sin(a * 4.0)), 24.0) * smoothstep(0.42, 0.5, r) * (1.0 - smoothstep(0.6, 0.74, r));
    ln += rays * (0.6 + 0.6 * sin(r * 30.0 - t * 3.0)) * 1.4;
  } else if (type < 2.5) {
    // ── 泉水：石沿(上面压着一圈矮石环几何) + 浅水池：池底星纹、焦散、涟漪；敌方踏入时水面转红翻涌 ──
    float alert = seed < 0.75 ? uAlert.x : uAlert.y;
    float rimM = smoothstep(0.86, 0.875, r);
    vec2 sr = stoneRings(0.99, a * 1.0, seed);
    vec3 rimCol = vColorB * sr.x * mix(0.6, 1.0, smoothstep(0.0, 0.02, abs(fract(a / TAU * 24.0) - 0.5) - 0.03)) * (0.9 + 0.2 * nz2);
    rimCol = mix(rimCol, vec3(0.9, 0.68, 0.26), band(r, 0.93, 0.008, aa));
    // 池底：环形石板 + 八芒星刻纹
    vec2 fr = stoneRings(r * 1.14, a + 0.3, seed + 2.0);
    vec3 floorCol = vColorB * 0.8 * fr.x * mix(0.62, 1.0, fr.y);
    float st = sdStar(p, 0.52, 8.0, 2.8);
    float st2 = sdStar(vec2(p.x * 0.7071 - p.y * 0.7071, p.x * 0.7071 + p.y * 0.7071), 0.3, 4.0, 2.4);
    floorCol = mix(floorCol, vColorB * 1.1, (1.0 - smoothstep(-0.01, 0.0, st)) * 0.4);
    floorCol = mix(floorCol, vec3(0.9, 0.68, 0.26), (1.0 - smoothstep(0.006, 0.006 + aa * 1.5, abs(st))) * 0.8);
    // 水体：越往池心越深，吸收掉暖色
    float depth = smoothstep(0.86, 0.2, r);
    vec3 waterTint = mix(vColorA, vec3(1.0, 0.25, 0.12), alert);
    vec3 pool = floorCol * mix(vec3(0.9, 0.97, 1.0), vec3(0.5, 0.78, 0.9), depth) + waterTint * 0.07 * depth;
    // 焦散：两层反向漂移的噪声相减取脊
    vec2 cq = vWorldPos.xz * 1.5;
    float c1 = vnoise(cq + vec2(t * 0.22, t * 0.13));
    float c2 = vnoise(cq * 1.3 - vec2(t * 0.17, -t * 0.19) + 3.7);
    float caust = pow(clamp(1.0 - abs(c1 - c2) * 3.2, 0.0, 1.0), 5.0);
    pool += vec3(0.75, 1.0, 0.95) * caust * (0.1 + 0.16 * depth);
    // 涟漪：从池心缓缓外扩的细环；有敌人时变成急促的翻涌
    float rip = sin(r * mix(46.0, 30.0, alert) - t * mix(2.2, 7.0, alert) + nz * 3.0);
    pool += vec3(0.9, 1.0, 1.0) * smoothstep(0.86, 1.0, rip) * (1.0 - r) * mix(0.1, 0.3, alert);
    pool = mix(pool, pool * vec3(1.25, 0.5, 0.45) + vec3(0.12, 0.0, 0.0), alert * 0.7);
    paint = mix(pool, rimCol, rimM);
    alpha = (1.0 - smoothstep(0.985, 1.0, r)) * mix(0.96, 1.0, rimM);
    float inside = 1.0 - rimM;
    float pulse = 0.75 + 0.25 * sin(t * 1.5);
    // 池底发光星盘：细线，不再是满屏的法阵
    ln += (1.0 - smoothstep(0.005, 0.005 + aa * 1.5, abs(st2))) * 1.5 * pulse * inside;
    ln += band(r, 0.66, 0.005, aa) * 1.1 * inside;
    ln += runes(r, a - t * 0.06, 0.76, 0.045, 18.0, seed, aa) * 0.9 * pulse * inside;
    glow += waterTint * (1.0 - smoothstep(0.0, 0.34, r)) * 0.2 * pulse;
    // 警示环：敌方在泉水里时池沿亮起红圈
    ln += band(r, 0.84, 0.012, aa) * 2.0 * alert * (0.6 + 0.4 * sin(t * 9.0));
  } else if (type < 3.5) {
    // ── 小营地：风化的残环 ──
    float broken = smoothstep(0.42, 0.6, vnoise(vec2(a * 2.2, seed * 9.0)) * 0.7 + nz * 0.3);
    float ringM = band(r, 0.86, 0.075, aa * 2.0) * broken;
    float joint = smoothstep(0.02, 0.05, abs(fract(a / TAU * 18.0 + seed) - 0.5) - 0.02);
    paint = vColorB * (0.8 + 0.3 * hash12(vec2(floor(a / TAU * 18.0 + seed), seed))) * mix(0.6, 1.0, joint);
    alpha = ringM * 0.95;
    ln += runes(r, a, 0.66, 0.05, 16.0, seed, aa) * broken * 0.3 * (0.6 + 0.4 * sin(t * 1.1 + seed));
  } else if (type < 4.5) {
    // ── 增益营地：双环法阵 + 六芒；霜 = 冰晶地面，焰 = 焦土裂纹 ──
    float ember = step(0.5, vParam.w);
    float pulse = 0.7 + 0.3 * sin(t * 1.6 + seed * 3.0);
    float crack = vnoise(vWorldPos.xz * 1.9 + seed) - vnoise(vWorldPos.xz * 1.9 + seed + 4.7);
    float crackLine = 1.0 - smoothstep(0.0, 0.07, abs(crack));
    float patchM = (1.0 - smoothstep(0.55, 0.95, r + (nz - 0.5) * 0.3));
    vec3 scorched = vec3(0.09, 0.07, 0.07);
    vec3 frost = vec3(0.78, 0.9, 1.0) * (0.75 + 0.3 * nz2);
    paint = mix(frost, scorched, ember);
    // (地面的霜/焦土染色已经由地表着色器按营地主题画了：这里只留一层很淡的底和法阵线，亮度比第一版降四成)
    alpha = patchM * mix(0.18 * smoothstep(0.35, 0.65, nz + (1.0 - r) * 0.3), 0.3, ember);
    ln += crackLine * patchM * mix(0.12, 0.0, ember) * pulse;
    ln += band(r, 0.9, 0.01, aa) * 1.2 * pulse;
    ln += band(r, 0.74, 0.006, aa) * 0.9;
    ln += runes(r, a + t * 0.08, 0.82, 0.05, 22.0, seed, aa) * 1.0 * pulse;
    float st = sdStar(p, 0.5, 6.0, 2.2);
    ln += (1.0 - smoothstep(0.006, 0.006 + aa * 1.5, abs(st))) * 0.8;
  } else if (type < 5.5) {
    // ── 史诗营地：浮在水面上的巨大法阵，缓慢转动 ──
    float colossus = step(0.5, vParam.w);
    float pulse = 0.65 + 0.35 * sin(t * 1.2 + seed);
    float ca = cos(t * 0.07);
    float sa = sin(t * 0.07);
    vec2 pr = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    float st = sdStar(pr, 0.62, mix(6.0, 8.0, colossus), mix(2.0, 2.8, colossus));
    float st2 = sdStar(vec2(pr.x * ca + pr.y * sa, -pr.x * sa + pr.y * ca), 0.34, mix(3.0, 4.0, colossus), 2.0);
    // (亮度比第一版降一半：潭里最亮的应该是巨龙/巨灵本身)
    ln += (1.0 - smoothstep(0.006, 0.006 + aa * 1.5, abs(st))) * 1.1;
    ln += (1.0 - smoothstep(0.005, 0.005 + aa * 1.5, abs(st2))) * 0.9 * pulse;
    ln += band(r, 0.93, 0.009, aa) * 1.2;
    ln += band(r, 0.86, 0.004, aa) * 0.8;
    ln += band(r, 0.7, 0.005, aa) * 0.8 * pulse;
    ln += runes(r, a - t * 0.05, 0.78, 0.045, 30.0, seed, aa) * 1.0 * pulse;
    ln += runes(r, a + t * 0.09, 0.2, 0.05, 9.0, seed + 3.0, aa) * 0.8;
    // 水面被法阵映亮
    glow += vColorA * (1.0 - smoothstep(0.2, 1.0, r)) * 0.07 * pulse;
    paint = vColorB;
    alpha = (1.0 - smoothstep(0.3, 1.0, r)) * 0.16;
  } else if (type < 6.5) {
    // ── 柔光斑 ──
    float f = 1.0 - r;
    glow += vColorA * f * f * (0.8 + 0.2 * sin(t * 1.3 + seed * 6.0)) * vParam.w;
  } else if (type < 8.5) {
    // ── 涟漪圈：两道错开半个周期的细环，从中心向外扩并淡出 ──
    float period = 4.0 + 3.0 * fract(seed * 7.31);
    for (int i = 0; i < 2; i++) {
      float ph = fract(t / period + seed + float(i) * 0.5);
      float ring = band(r, 0.12 + ph * 0.82, 0.018 + 0.012 * ph, aa * 1.5) * (1.0 - ph) * smoothstep(0.0, 0.12, ph);
      glow += vColorA * ring * 0.34;
      alpha = max(alpha, ring * 0.12);
    }
    paint = vColorA;
  } else {
    // ── 地洞：深色洞口 + 一圈刨出来的浮土 ──
    vec2 hq = vec2(p.x, p.y * 1.25);
    float hr = length(hq) + (nz - 0.5) * 0.12;
    float hole = 1.0 - smoothstep(0.42, 0.56, hr);
    float mound = (1.0 - smoothstep(0.62, 0.98, hr)) * (0.55 + 0.45 * nz2);
    paint = mix(vColorB * (0.75 + 0.5 * nz2), vec3(0.012, 0.01, 0.012), hole);
    paint *= mix(1.0, 0.55, smoothstep(0.75, 0.5, hr) * (1.0 - hole));
    alpha = max(hole, mound * 0.9);
  }

  float lm = clamp(ln, 0.0, 1.0);
  paint = mix(paint, vColorA * 0.42, lm * 0.9);
  alpha = max(alpha, lm * 0.92);
  glow += vColorA * ln * 0.55;

  vec3 N = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float shadow = kitShadow();
  vec3 irr = kitTintAmbient(kitAmbient(N), kitLightTint(vWorldPos.xz)) + kitSunColor() * max(dot(N, kitSunDir()), 0.0) * shadow + kitPointLights(N, -vViewPosition);
  paint *= mix(uShadeTintGround, vec3(1.0), shadow);
  // 先对「未预乘」的受光颜色做色调映射/色彩空间转换，再预乘并叠加发光：
  // 这样 low 档直出屏幕时半透明边缘不会出现亮边(HDR 路径下这两步是空操作，结果不变)
  gl_FragColor = vec4(paint * RECIPROCAL_PI * irr, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef TONE_MAPPING
  gl_FragColor.rgb = gl_FragColor.rgb * alpha + glow * 0.9;
  #else
  gl_FragColor.rgb = gl_FragColor.rgb * alpha + glow;
  #endif
  gl_FragColor.a = alpha;
}
`,
  MONSTER_TERRAIN_PALETTE = {
    mossback: { glow: 12116090, stone: 11120804 },
    glimwing: { glow: 8382688, stone: 10793140 },
    frost_golem: { glow: 8377599, stone: 12178408 },
    ember_golem: { glow: 16742956, stone: 5916224 },
    abyss_drake: { glow: 11041023, stone: 2365512 },
    star_colossus: { glow: 16765040, stone: 4864536 },
  }

export { VEGETATION_FRAGMENT_SHADER, MONSTER_TERRAIN_PALETTE, VEGETATION_VERTEX_SHADER }
