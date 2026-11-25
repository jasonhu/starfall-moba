/**
 * 单位着色器：骨骼蒙皮、程序化花纹、描边与 X 光材质所需的顶点/片元着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_DEFAULT_NORMAL, GLSL_DITHER, GLSL_HASH_NOISE, GLSL_KICK, GLSL_LIGHT_TINT, GLSL_SIDE_FILL, GLSL_TONEMAP, GLSL_VERTEX_COMMON } from './glsl-chunks'
import { LIGHT_TINT_GAIN } from '../arena-palette'

const BONE_SKIN_GLSL = `
uniform highp sampler2D uBones;
attribute vec3 aSkin;
vec3 qrot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
void boneXf(float idx, out vec4 ps, out vec4 q) {
  int x = int(idx + 0.5) * 2;
  ps = texelFetch(uBones, ivec2(x, gl_InstanceID), 0);
  q = texelFetch(uBones, ivec2(x + 1, gl_InstanceID), 0);
}
`,
  BONE_TRANSFORM_GLSL = `
  vec4 ps0;
  vec4 q0;
  vec4 ps1;
  vec4 q1;
  boneXf(aSkin.x, ps0, q0);
  vec3 skinnedPos = ps0.xyz + ps0.w * qrot(q0, position);
  vec3 skinnedNormal = qrot(q0, normal);
  if (aSkin.z < 0.999) {
    boneXf(aSkin.y, ps1, q1);
    skinnedPos = mix(ps1.xyz + ps1.w * qrot(q1, position), skinnedPos, aSkin.z);
    skinnedNormal = mix(qrot(q1, normal), skinnedNormal, aSkin.z);
  }
`,
  UNIT_VERTEX_SHADER = `
${GLSL_VERTEX_COMMON}
#include <color_pars_vertex>
${BONE_SKIN_GLSL}
${GLSL_LIGHT_TINT}
attribute vec4 aFx;
attribute vec4 aMat;
attribute vec4 aInstA;
attribute vec3 aInstTeam;
attribute vec4 aInstTint;
attribute vec3 aInstBody;
varying vec4 vFx;
varying vec4 vInstA;
varying vec3 vTeam;
varying vec4 vTint;
varying vec3 vBody;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec4 vLt;
varying vec4 vObj;
varying vec3 vObjN;
flat varying vec4 vMat;
void main() {
  #include <color_vertex>
  vFx = aFx;
  vMat = aMat;
  vInstA = aInstA;
  vTeam = aInstTeam;
  vTint = aInstTint;
  vBody = aInstBody;
  ${BONE_TRANSFORM_GLSL}
  vec3 objectNormal = skinnedNormal;
  vec4 worldPosition = vec4(skinnedPos, 1.0);
  // 环境染色在顶点采一次就够(贴图 1 米一个 texel)；vObj.w = 离地高度(冷边在脚底渐隐)
  vLt = kitLightTint(skinnedPos.xz);
  vObj = vec4(position, skinnedPos.y);
  vObjN = normal;
  ${GLSL_DEFAULT_NORMAL}
  vNormal = normalize(transformedNormal);
}
`,
  UNIT_PATTERN_GLSL = `
void unitPattern(int id, vec2 q, float t, out float tone, out float edge, out float glowMul) {
  tone = 1.0;
  edge = 0.0;
  glowMul = 1.0;
  if (id == 1) {
    // 鳞 / 甲片：错排的圆弧鳞。根部被上一排压住(暗)，下缘翘起(亮边)，逐片明暗略有不同
    float row = floor(q.y);
    float x = q.x + 0.5 * mod(row, 2.0);
    vec2 f = vec2(fract(x) - 0.5, q.y - row);
    float d = length(vec2(f.x, (f.y - 0.62) * 0.86)) / 0.6;
    float inside = 1.0 - smoothstep(0.84, 1.0, d);
    tone = (0.86 + 0.24 * hash12(vec2(floor(x), row))) * mix(0.78, 1.08, 1.0 - f.y);
    tone = mix(0.58, tone, inside);
    edge = smoothstep(0.55, 0.84, d) * inside * step(f.y, 0.62);
  } else if (id == 2) {
    // 岩层：被低频噪声扭曲的水平层理，层间一道暗缝，层的上沿受光
    float y = q.y + (vnoise(q * 0.35) - 0.5) * 1.3;
    float fy = fract(y);
    tone = (0.84 + 0.3 * hash12(vec2(floor(y), 3.0))) * (0.94 + 0.12 * vnoise(q * 2.3));
    tone *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.1, fy));
    edge = smoothstep(0.8, 0.98, fy) * 0.5;
  } else if (id == 3) {
    // 毛笔触：顺着毛向(物体空间的竖直方向)拉长的明暗条
    float n = vnoise(vec2(q.x * 3.2, q.y * 0.55));
    float n2 = vnoise(vec2(q.x * 7.0 + 3.7, q.y * 1.1 + 1.3));
    tone = 0.8 + 0.3 * n + 0.16 * (n2 - 0.5);
    edge = smoothstep(0.62, 0.9, n) * 0.25;
  } else if (id == 4) {
    // 织纹：经纬交替的方格，每格一根鼓起的线
    vec2 c = floor(q);
    vec2 f = fract(q);
    float odd = mod(c.x + c.y, 2.0);
    float u = mix(f.y, f.x, odd);
    float v = mix(f.x, f.y, odd);
    tone = (0.9 + 0.16 * sin(u * 3.14159)) * (0.9 + 0.1 * smoothstep(0.0, 0.14, v) * smoothstep(1.0, 0.86, v));
  } else if (id == 5) {
    // 树皮：竖向的沟槽，被噪声扭弯
    float w = vnoise(q * vec2(0.6, 0.25)) * 2.2;
    float r = abs(fract(q.x + w) - 0.5) * 2.0;
    tone = (0.9 + 0.22 * vnoise(q * vec2(2.0, 0.7))) * (1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.32, r)));
    edge = smoothstep(0.7, 1.0, r) * 0.3;
  } else if (id == 6) {
    // 熔纹：暗壳 + 缓慢流动、明灭的发光裂纹
    vec2 fl = vec2(t * 0.05, t * 0.08);
    float n = vnoise(q * 0.9 + fl);
    float n2 = vnoise(q * 1.9 - fl * 1.7 + 5.2);
    float r = abs(n - 0.5) * 2.0 + abs(n2 - 0.5) * 0.6;
    float crack = 1.0 - smoothstep(0.04, 0.26, r);
    float pulse = 0.72 + 0.28 * sin(t * 1.7 + n2 * 9.0);
    tone = mix(0.14, 1.0, crack);
    glowMul = crack * pulse;
  } else if (id == 7) {
    // 翼脉 / 叶脉：主脉 + 斜向细支脉
    float v1 = 1.0 - smoothstep(0.0, 0.1, abs(fract(q.x) - 0.5));
    float v2 = 1.0 - smoothstep(0.0, 0.07, abs(fract(q.y * 2.0 + abs(fract(q.x) - 0.5) * 2.4) - 0.5));
    tone = (0.94 + 0.12 * vnoise(q * 1.7)) * (1.0 - 0.34 * v1) * (1.0 - 0.16 * v2);
    edge = v1 * 0.35;
  } else if (id == 8) {
    // 陨铁交叉纹：三组互成 60° 的平行片晶，随机几条发亮
    float l = 0.0;
    for (int i = 0; i < 3; i++) {
      float a = float(i) * 1.0472 + 0.35;
      float u = dot(q, vec2(cos(a), sin(a)));
      float band = floor(u);
      float fu = fract(u);
      float on = step(0.56, hash12(vec2(band, float(i) * 7.0 + 1.0)));
      l = max(l, on * smoothstep(0.0, 0.12, fu) * smoothstep(1.0, 0.88, fu) * (0.6 + 0.4 * hash12(vec2(band, float(i) + 11.0))));
    }
    tone = 0.86 + 0.26 * l;
    edge = l * 0.6;
  }
}
`,
  UNIT_FRAGMENT_SHADER = `
${GLSL_SIDE_FILL}
#include <color_pars_fragment>
${GLSL_DITHER}
${GLSL_HASH_NOISE}
${GLSL_KICK}
#define KIT_LIGHT_TINT_GAIN ${LIGHT_TINT_GAIN.toFixed(2)}
uniform vec4 uRamp;
uniform vec3 uShadeTint;
uniform vec3 uSkinShade;
uniform vec3 uRimColor;
uniform vec2 uRim;
uniform vec2 uSpec;
uniform float uGlowBoost;
uniform float uKick;
uniform vec2 uKickDir;
uniform vec3 uKickColor;
uniform float uTime;
varying vec4 vFx;
varying vec4 vInstA;
varying vec3 vTeam;
varying vec4 vTint;
varying vec3 vBody;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec4 vLt;
varying vec4 vObj;
varying vec3 vObjN;
flat varying vec4 vMat;

// 各材质类别的参数：x = 高光强度，y = 高光锐度，z = 明暗交界的柔和倍率，w = 假环境反射强度
const vec4 MAT_PARAMS[7] = vec4[7](
  vec4(0.0, 24.0, 1.7, 0.0),
  vec4(0.1, 14.0, 1.5, 0.0),
  vec4(0.3, 10.0, 1.0, 0.0),
  vec4(1.15, 52.0, 0.8, 0.7),
  vec4(0.85, 70.0, 0.9, 0.2),
  vec4(0.0, 24.0, 2.2, 0.0),
  vec4(0.22, 28.0, 0.6, 0.0)
);
#ifdef UNIT_PATTERNS
${UNIT_PATTERN_GLSL}
#endif

void main() {
  float opacity = vInstA.x;
  if (opacity < 0.995) {
    if (opacity <= ditherThreshold(gl_FragCoord.xy)) discard;
  }
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  int cat = clamp(int(vMat.w * 8.0 + 0.5), 0, 6);
  vec4 mp = MAT_PARAMS[cat];

  // 本体乘色只作用在非队伍色区域；队伍色只染蒙版区域；整体染色(石化/冰冻/阵亡变灰)按 vTint.a 的强度向灰度化后的染色过渡
  vec3 base = mix(vColor.rgb * vBody, vTeam, vFx.z);
  float lum = dot(base, vec3(0.3, 0.55, 0.15));
  base = mix(base, vTint.rgb * mix(lum, 1.0, 0.25) * 1.6, vTint.a);

  float patEdge = 0.0;
  float glowMul = 1.0;
  // 有纹样的金属面：高光打碎到纹样的棱边上(见下面的高光一节)。1 = 不打碎
  float specBreak = 1.0;
  #ifdef UNIT_PATTERNS
  int pat = int(vMat.x * 8.0 + 0.5);
  // 屏幕空间导数放在分支外面算(分支里求导在个别驱动上不可靠)
  vec3 objFw = fwidth(vObj.xyz);
  if (pat > 0 && vMat.z > 0.004) {
    // 三向投影：绑定姿态坐标按法线主轴投到二维。绝大多数像素只有一个轴有权重、只算一次；
    // 两个轴权重接近的过渡带里两边都算再混合，球面和圆柱上不留接缝。格子小到接近像素时淡出(远处不闪)
    vec3 w = abs(vObjN);
    w *= w;
    w *= w;
    w /= w.x + w.y + w.z;
    float cells = vMat.y * 32.0;
    vec3 fw = objFw * cells;
    float toneSum = 0.0;
    float edgeSum = 0.0;
    float glowSum = 0.0;
    float wSum = 0.0;
    float tone;
    float edge;
    float gm;
    if (w.y > 0.06) {
      unitPattern(pat, vObj.xz * cells, uTime, tone, edge, gm);
      float f = w.y * (1.0 - smoothstep(0.3, 0.8, max(fw.x, fw.z)));
      toneSum += mix(w.y, w.y * tone, f / w.y);
      edgeSum += edge * f;
      glowSum += mix(w.y, w.y * gm, f / w.y);
      wSum += w.y;
    }
    if (w.x > 0.06) {
      unitPattern(pat, vObj.zy * cells, uTime, tone, edge, gm);
      float f = w.x * (1.0 - smoothstep(0.3, 0.8, max(fw.z, fw.y)));
      toneSum += mix(w.x, w.x * tone, f / w.x);
      edgeSum += edge * f;
      glowSum += mix(w.x, w.x * gm, f / w.x);
      wSum += w.x;
    }
    if (w.z > 0.06) {
      unitPattern(pat, vObj.xy * cells, uTime, tone, edge, gm);
      float f = w.z * (1.0 - smoothstep(0.3, 0.8, max(fw.x, fw.y)));
      toneSum += mix(w.z, w.z * tone, f / w.z);
      edgeSum += edge * f;
      glowSum += mix(w.z, w.z * gm, f / w.z);
      wSum += w.z;
    }
    float k = vMat.z;
    base *= mix(1.0, toneSum / wSum, k);
    patEdge = edgeSum / wSum * k;
    glowMul = mix(1.0, glowSum / wSum, k);
    specBreak = mix(1.0, 0.16 + 0.84 * min(1.0, edgeSum / wSum * 1.5), min(1.0, k * 4.0));
  }
  #endif

  vec3 L = kitSunDir();
  float ndl = dot(N, L);
  float soft = uRamp.w * mp.z;
  float a = smoothstep(uRamp.x - soft, uRamp.x + soft, ndl);
  float b = smoothstep(uRamp.y - soft, uRamp.y + soft, ndl);
  float lit = (a * uRamp.z + b * (1.0 - uRamp.z)) * kitShadow();
  vec3 sun = kitSunColor();
  float ao = vFx.w;
  #ifndef USE_SHADOWMAP
  // 没有阴影贴图的画质档(low)：模型没有自阴影，凹处与檐下全靠顶点里烘的遮蔽撑明暗——让它再压一截主光，
  // 浅色的塔身、城垣才不会整面一个亮度。有阴影贴图的档位不走这里
  lit *= mix(0.72, 1.0, ao);
  #endif
  float metal = cat == 3 ? 1.0 : 0.0;

  // 技能闪光的点光是按「离地一两米、照亮地面」调的强度；单位就站在光源边上，按平方衰减会比地面亮十倍，
  // 整个人被打成一团白。所以单位只吃一部分点光，并做软上限：只留下染色与提亮的感觉
  vec3 pl = kitPointLights(N, -vViewPosition) * 0.5;
  pl /= 1.0 + max(pl.r, max(pl.g, pl.b)) * 0.8;
  // 环境光 = 半球光 × 天光可见度 + 环境染色(站在红方基地里带一层暖红补光，站在河里带青色)
  vec3 amb = (kitAmbient(N) * vLt.a + vLt.rgb * KIT_LIGHT_TINT_GAIN) * ao;
  vec3 irradiance = amb + sun * lit * mix(1.0, ao, 0.4) + pl;
  // 金属的漫反射压暗一截，亮度让给高光与环境反射
  vec3 col = base * RECIPROCAL_PI * irradiance * (1.0 - 0.42 * metal);
  // 暗部乘色：统一偏冷紫；皮肤的暗部偏暖(血色)
  col *= mix(cat == 1 ? uSkinShade : uShadeTint, vec3(1.0), lit);

  float fres = pow(1.0 - saturate(dot(N, V)), uRim.y);
  // 受光侧暖边
  col += uRimColor * (fres * uRim.x * (0.3 + 0.7 * lit) * mix(0.55, 1.0, ao));
  // 背光侧冷边：朝屏幕右上、不受光的轮廓上一道冷色亮边，把暗面从地面上分出来；脚底半米内渐隐(不然会和地面的接触暗部打架)
  col += uKickColor * (kitKick(N, V, uKickDir) * (1.0 - 0.6 * lit) * uKick * smoothstep(0.0, 0.5, vObj.w) * mix(0.6, 1.0, ao));

  // 风格化高光：类别自带的强度与旧的 aFx.x(高光强度)取较大者；纹样的棱边(鳞缘、片晶)再加一点
  vec3 H = normalize(L + V);
  float sAmt = max(mp.x, vFx.x * uSpec.x);
  float sPow = mp.x > 0.0 ? mp.y : uSpec.y;
  float sp = pow(saturate(dot(N, H)), sPow);
  // 金属 / 晶体 / 岩，以及只靠旧的 aFx.x 出高光的面：硬边亮斑；皮肤 / 皮革：边缘柔一些
  float hard = cat >= 3 || mp.x == 0.0 ? 0.08 : 0.3;
  // 金属的高光带上金属自己的颜色(深色的铁亮得有限，铜与亮钢才接近主光的亮度)。大块平直的甲片会整片对上高光方向：
  // 原先一律按主光的亮度加上去，深色札甲上就是一块块不规则的米白斑；现在是一片提亮的金属色(最亮的甲片 L* 85~92)
  // 带纹样的金属(札甲的甲片、陨铁的片晶)再把高光打碎到纹样的棱边上：读成一片片甲缘在反光，而不是整块面翻白；
  // 远处纹样淡出后只留两成，对局镜头下不再冒零星白点
  vec3 specCol = sun * RECIPROCAL_PI;
  float specMask = smoothstep(0.5 - hard, 0.5 + hard, sp);
  if (cat == 3) {
    specCol *= 0.3 + base;
    specMask *= specBreak;
  }
  col += specCol * (specMask * sAmt * (1.0 + patEdge) * lit);
  col += sun * RECIPROCAL_PI * base * patEdge * 0.5 * lit;
  // 假环境反射：反射方向朝上取天光(冷)、朝下取地面反光(暖)
  float env = max(mp.w, vFx.x * 0.22);
  if (env > 0.0) {
    vec3 R = reflect(-V, N);
    #if NUM_HEMI_LIGHTS > 0
    // 地平线以上取天光(冷)、以下取地面反光(暖)，交界收紧成一道明暗线——金属感主要靠这条线
    float ry = dot(R, hemisphereLights[0].direction);
    vec3 envCol = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, smoothstep(-0.14, 0.2, ry));
    #else
    vec3 envCol = kitAmbient(R);
    #endif
    col += base * envCol * (RECIPROCAL_PI * env * (0.55 + 0.9 * fres));
  }
  if (cat == 4) {
    // 晶体：轮廓提亮 + 背光透射(光从背面穿过来)
    col += base * (kitAmbient(N) * RECIPROCAL_PI * fres * 1.2 + sun * RECIPROCAL_PI * saturate(-ndl) * 0.4);
  } else if (cat == 5) {
    // 毛：轮廓上一层柔和的绒光
    col += base * (kitAmbient(N) + sun * lit * 0.6) * (RECIPROCAL_PI * 0.45 * sqrt(fres));
  }

  col += base * (vFx.y * uGlowBoost * vInstA.z * glowMul);
  // 受击闪白：整体提亮并叠一层暖白，但保留自身的明暗与配色(直接换成纯白的话，被集火的单位会连成一团白色剪影)
  col = mix(col, col * 1.45 + vec3(0.6, 0.58, 0.54), vInstA.y);

  gl_FragColor = vec4(col, 1.0);
  ${GLSL_TONEMAP}
}
`,
  UNIT_SKIN_VERTEX_SHADER = `
#include <common>
${BONE_SKIN_GLSL}
attribute vec4 aInstA;
varying vec2 vHighPrecisionZW;
varying float vOpacity;
void main() {
  ${BONE_TRANSFORM_GLSL}
  vOpacity = aInstA.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(skinnedPos, 1.0);
  vHighPrecisionZW = gl_Position.zw;
}
`,
  UNIT_SKIN_FRAGMENT_SHADER = `
#include <common>
#include <packing>
varying vec2 vHighPrecisionZW;
varying float vOpacity;
void main() {
  // 半透明(草丛内/淡出中)的单位不投影
  if (vOpacity < 0.75) discard;
  #ifdef USE_REVERSED_DEPTH_BUFFER
  float fragCoordZ = vHighPrecisionZW[0] / vHighPrecisionZW[1];
  #else
  float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
  #endif
  gl_FragColor = packDepthToRGBA(fragCoordZ);
}
`,
  OUTLINE_VERTEX_SHADER = `
#include <common>
#include <fog_pars_vertex>
${BONE_SKIN_GLSL}
attribute vec4 aOutline;
attribute vec4 aFx;
attribute vec4 aInstA;
attribute vec3 aInstTeam;
attribute vec3 aInstBody;
uniform float uLine;
varying float vOpacity;
varying float vRim;
varying vec3 vBase;
void main() {
  ${BONE_TRANSFORM_GLSL}
  vec3 n = qrot(q0, aOutline.xyz);
  if (aSkin.z < 0.999) n = mix(qrot(q1, aOutline.xyz), n, aSkin.z);
  vec4 mvPosition = viewMatrix * vec4(skinnedPos, 1.0);
  // 线宽按视距换算成恒定的屏幕像素；被缩没的部件(骨骼缩放趋零)不留描边残点
  float sc = ps0.w;
  if (aSkin.z < 0.999) sc = mix(ps1.w, ps0.w, aSkin.z);
  float w = aOutline.w * uLine * -mvPosition.z * min(1.0, sc * 4.0);
  mvPosition = viewMatrix * vec4(skinnedPos + normalize(n) * w, 1.0);
  vOpacity = aInstA.x;
  vRim = aInstA.w;
  // 描边带一点本体色(本体色压暗后与统一的深色各半)：比一律深蓝更干净，浅色件不会被勾出一圈脏边
  vBase = mix(color * aInstBody, aInstTeam, aFx.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,
  OUTLINE_FRAGMENT_SHADER = `
#include <common>
#include <fog_pars_fragment>
${GLSL_DITHER}
uniform vec3 uColor;
varying float vOpacity;
varying float vRim;
varying vec3 vBase;
void main() {
  if (vOpacity < 0.995) {
    if (vOpacity <= ditherThreshold(gl_FragCoord.xy)) discard;
  }
  vec3 line = mix(vBase * 0.35, uColor, 0.5);
  // 逐实例的描边掺金(InstanceLook.rim)：0.5 上下是暗金(星陨祝福期间常驻)，1 是亮金(河道巨龙击杀奖励的一闪)；亮度压在泛光阈值以下
  line = mix(line, vec3(1.0, 0.74, 0.26) * (0.34 + 0.86 * vRim), min(1.0, vRim * 1.7));
  gl_FragColor = vec4(line, 1.0);
  ${GLSL_TONEMAP}
}
`,
  XRAY_VERTEX_SHADER = `
#include <common>
${BONE_SKIN_GLSL}
attribute vec4 aInstA;
attribute vec4 aInstX;
uniform float uPull;
varying vec4 vX;
void main() {
  ${BONE_TRANSFORM_GLSL}
  vec4 mv = viewMatrix * vec4(skinnedPos, 1.0);
  mv.xyz *= 1.0 - uPull / max(uPull * 2.0, -mv.z);
  gl_Position = projectionMatrix * mv;
  vX = vec4(aInstX.rgb, aInstX.a * aInstA.x);
  // 不需要剪影的实例整个挪出裁剪空间
  if (vX.a <= 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`,
  XRAY_FRAGMENT_SHADER = `
#include <common>
${GLSL_DITHER}
varying vec4 vX;
void main() {
  if (vX.a * 0.72 <= ditherThreshold(gl_FragCoord.xy)) discard;
  gl_FragColor = vec4(vX.rgb, 1.0);
  ${GLSL_TONEMAP}
}
`

export { XRAY_FRAGMENT_SHADER, OUTLINE_FRAGMENT_SHADER, OUTLINE_VERTEX_SHADER, UNIT_VERTEX_SHADER, UNIT_SKIN_FRAGMENT_SHADER, XRAY_VERTEX_SHADER, UNIT_FRAGMENT_SHADER, UNIT_SKIN_VERTEX_SHADER }
