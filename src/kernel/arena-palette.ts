/**
 * 内核切片 · 竞技场配色与光染色（队伍蓝/红/中立/玩家 + 环境色 + 共享 uniform）（原 starfall.core.js 第 3812-3890 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
import {
  Color,
  Vector2,
  Vector4,
  DataTexture,
  RGBAFormat,
  NoColorSpace,
  UnsignedByteType,
  NearestFilter,
} from 'three'

const ARENA_PALETTE = {
    blue: { main: 4165631, light: 11064575, dark: 1916826, glow: 3713279, stone: 12832224, stoneDark: 8688822, trim: 15251530, plaza: 9413318 },
    red: { main: 16730942, light: 16756890, dark: 9314076, glow: 16734774, stone: 5917264, stoneDark: 3024169, trim: 15768124, plaza: 5917264 },
    neutral: { main: 14861930, light: 16773296, dark: 8020528, glow: 16767088, stone: 10133672, stoneDark: 6054508, trim: 14206608, plaza: 9210504 },
    player: { main: 11992924, light: 15138736, dark: 5213980, glow: 14221178, stone: 15133685, stoneDark: 11122383, trim: 15777872, plaza: 9413318 },
    env: {
      sun: 16770740,
      sky: 11981055,
      bounce: 12758660,
      fog: 13624048,
      haze: 14149365,
      horizon: 14676479,
      zenith: 6269166,
      cloud: 16777215,
      cloudShade: 11125990,
      grass: 7314762,
      grassWarm: 10728536,
      grassCool: 5214050,
      grassDark: 4026438,
      cliffGrass: 5935440,
      cliffGrassLight: 7313998,
      lane: 12628109,
      laneAlt: 11576722,
      laneDark: 9730127,
      laneGrout: 7232068,
      dirt: 9073488,
      dirtDark: 7232068,
      sand: 13287318,
      rock: 8354950,
      rockDark: 5986920,
      rockLight: 11117471,
      rockWarm: 13221798,
      moss: 5933650,
      waterShallow: 8380630,
      water: 3123140,
      waterDeep: 1798044,
      foam: 15925243,
      caustic: 13172720,
      reed: 9416266,
      reedTip: 14277002,
      reedDark: 5077548,
      canopy: 4165470,
      canopyLight: 10276698,
      canopyDark: 2056012,
      trunk: 7228732,
      crystal: 3523839,
      crystalDeep: 5926143,
      starGold: 16766586,
      ember: 16742972,
      frost: 7327999,
      abyss: 10514687,
      amber: 16757575,
      glowCyan: 6285512,
      violet: 10779903,
      petalWhite: 16774112,
      petalPink: 16765408,
      outline: 1778227,
      shadeUnit: 12898559,
      shadeRock: 15133183,
      rimWarm: 16771524,
      kickCool: 12575487,
    },
  },
  SIDE_FILL_FACTOR = 0.45,
  LIGHT_TINT_GRID_SIZE = 64,
  LIGHT_TINT_GAIN = 1.6,
  NEUTRAL_LIGHT_TINT_TEXTURE = (() => {
    const neutralTintTexture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType)
    return ((neutralTintTexture.name = "moba.lightTint.neutral"), (neutralTintTexture.colorSpace = NoColorSpace), (neutralTintTexture.minFilter = neutralTintTexture.magFilter = NearestFilter), (neutralTintTexture.generateMipmaps = !1), (neutralTintTexture.needsUpdate = !0), neutralTintTexture)
  })(),
  ARENA_SHARED_UNIFORMS = {
    uTime: { value: 0 },
    uWind: { value: new Vector4(0.82, -0.57, 1, 1) },
    uShadeTint: { value: new Color(ARENA_PALETTE.env.shadeUnit) },
    uShadeTintGround: { value: new Color().setRGB(1, 0.95, 1.1) },
    uKickDir: { value: new Vector2(0.78, 0.62).normalize() },
    uKickColor: { value: new Color(ARENA_PALETTE.env.kickCool).multiplyScalar(1.15) },
    tLightTint: { value: NEUTRAL_LIGHT_TINT_TEXTURE },
  }

export { ARENA_PALETTE, SIDE_FILL_FACTOR, LIGHT_TINT_GRID_SIZE, LIGHT_TINT_GAIN, NEUTRAL_LIGHT_TINT_TEXTURE, ARENA_SHARED_UNIFORMS }
