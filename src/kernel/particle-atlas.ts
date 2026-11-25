/**
 * 粒子图集与缓动常量：ATLAS_COLS/ATLAS_ROWS/ATLAS_CELL_SIZE、PARTICLE_KIND（40 种粒子类型）、clamp01/smoothstep/TWO_PI（原 starfall.core.js 第 23896-23946 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 粒子形状 kind → 图集索引 */
export type ParticleKind = Record<string, number>
const ATLAS_COLS = 8,
  ATLAS_ROWS = 5,
  ATLAS_CELL_SIZE = 128,
  PARTICLE_KIND: ParticleKind = {
    dot: 0,
    glow: 1,
    spark: 2,
    star: 3,
    smoke: 4,
    streak: 5,
    shard: 6,
    feather: 7,
    rune1: 8,
    rune2: 9,
    rune3: 10,
    ring: 11,
    flame: 12,
    leaf: 13,
    crescent: 14,
    hex: 15,
    diamond: 16,
    coin: 17,
    plus: 18,
    wisp: 19,
    arrow: 20,
    lock: 21,
    swirl: 22,
    burst: 23,
    bubble: 24,
    chevron: 25,
    ember: 26,
    frost: 27,
    smoke2: 28,
    bolt: 29,
    drop: 30,
    soft: 31,
    goose: 32,
    wave: 33,
    ink: 34,
    scale: 35,
    puff: 36,
    broadleaf: 37,
    splash: 38,
    star8: 39,
  },
  clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value),
  smoothstep = (edge0: number, edge1: number, value: number): number => {
    const clamp01Result = clamp01((value - edge0) / (edge1 - edge0))
    return clamp01Result * clamp01Result * (3 - 2 * clamp01Result)
  },
  TWO_PI = Math.PI * 2

export { ATLAS_COLS, ATLAS_ROWS, ATLAS_CELL_SIZE, PARTICLE_KIND, clamp01, smoothstep, TWO_PI }
