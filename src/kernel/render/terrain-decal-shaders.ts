/**
 * 地形贴花着色器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { GLSL_DEFAULT_NORMAL, GLSL_LIGHT_TINT, GLSL_SIDE_FILL, GLSL_TIME_UNIFORM, GLSL_TONEMAP, GLSL_VERTEX_COMMON } from './glsl-chunks'
import { colorToRgb } from '../fx/particle-system'
import { ARENA_PALETTE } from '../arena-palette'

const DECAL_MESH_SEGMENTS = 8,
  TERRAIN_DECAL_VERTEX_SHADER = `
${GLSL_VERTEX_COMMON}
${GLSL_TIME_UNIFORM}
attribute vec3 color;
attribute vec4 aFx;
uniform vec4 uPushers[${DECAL_MESH_SEGMENTS}];
uniform vec4 uReveal;
varying vec3 vColor;
varying vec3 vViewPosition;
varying vec3 vWorldPos;
varying float vTip;
void main() {
  vColor = color;
  vTip = aFx.x;
  vec3 objectNormal = normal;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  float w = aFx.x;
  // 被单位拨开：向外推并压低，离得越近越明显
  vec2 push = vec2(0.0);
  float press = 0.0;
  for (int i = 0; i < ${DECAL_MESH_SEGMENTS}; i++) {
    vec4 p = uPushers[i];
    vec2 d = worldPosition.xz - p.xy;
    float dist = length(d);
    float f = 1.0 - smoothstep(p.z * 0.35, p.z, dist);
    push += (d / max(dist, 0.05)) * f * p.w;
    press += f * p.w;
  }
  worldPosition.xz += push * w * 0.55;
  worldPosition.y -= min(press, 1.0) * w * 0.38;
  // 玩家附近的草整片伏低：aFx.y 是每片叶的随机阈值，离玩家越近倒伏的叶越多、伏得越低
  float rv = (1.0 - smoothstep(uReveal.z * 0.45, uReveal.z, length(worldPosition.xz - uReveal.xy))) * uReveal.w;
  float lay = smoothstep(aFx.y * 0.7, aFx.y * 0.7 + 0.3, rv);
  worldPosition.y = mix(worldPosition.y, -0.03 + (worldPosition.y + 0.03) * (0.14 + 0.2 * aFx.y), lay);
  worldPosition.xyz += windOffset(worldPosition.xyz, w * 0.34);
  vWorldPos = worldPosition.xyz;
  ${GLSL_DEFAULT_NORMAL}
}
`,
  TERRAIN_DECAL_FRAGMENT_SHADER = `
${GLSL_SIDE_FILL}
${GLSL_LIGHT_TINT}
varying vec3 vColor;
varying vec3 vViewPosition;
varying vec3 vWorldPos;
varying float vTip;
void main() {
  vec3 N = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float shadow = kitShadow();
  vec3 sun = kitSunColor();
  float ndl = max(dot(N, kitSunDir()), 0.0);
  // 叶片薄而透光：暗部不压得太死
  vec3 irr = kitTintAmbient(kitAmbient(N) * (0.62 + 0.38 * vTip), kitLightTint(vWorldPos.xz)) + sun * ndl * (0.3 + 0.7 * shadow) * (0.7 + 0.3 * vTip) + kitPointLights(N, -vViewPosition);
  vec3 col = vColor * RECIPROCAL_PI * irr;
  // 叶尖的逆光金边
  col += vColor * sun * RECIPROCAL_PI * vTip * vTip * 0.14 * shadow;
  gl_FragColor = vec4(col, 1.0);
  ${GLSL_TONEMAP}
}
`,
  DECAL_EDGE_DARK_COLOR = colorToRgb(ARENA_PALETTE.env.reedDark),
  DECAL_EDGE_LIGHT_COLOR = colorToRgb(ARENA_PALETTE.env.reed),
  DECAL_EDGE_TIP_COLOR = colorToRgb(ARENA_PALETTE.env.reedTip),
  DECAL_CENTER_COLOR = colorToRgb(15129774)

export { TERRAIN_DECAL_FRAGMENT_SHADER, DECAL_EDGE_TIP_COLOR, TERRAIN_DECAL_VERTEX_SHADER, DECAL_EDGE_DARK_COLOR, DECAL_CENTER_COLOR, DECAL_EDGE_LIGHT_COLOR, DECAL_MESH_SEGMENTS }
