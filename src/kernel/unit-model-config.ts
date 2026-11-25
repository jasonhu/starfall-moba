/**
 * 单位模型配置：配色 UNIT_PALETTE / 骨骼比例 RIG_PROPORTIONS / 缩放与胶囊尺寸（原 starfall.core.js 第 41857-41899 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 单位模型调色板（部件名 → 十进制 RGB 整数） */
export type UnitPalette = Record<string, number>
/** 骨骼关键关节的归一化高度/横向比例 */
export interface RigProportions {
  ankleY: number; kneeY: number; hipY: number; hipX: number; pelvisY: number; spineY: number
  chestY: number; neckY: number; headY: number; clavX: number; shoulderX: number; shoulderY: number
  elbowY: number; wristY: number; handY: number
  [key: string]: number
}
/** 单位碰撞胶囊（h=高, w=半宽） */
export interface UnitCapsule { h: number; w: number }

const UNIT_PALETTE: UnitPalette = {
    ironLight: 8161432,
    ironDark: 3423046,
    bronze: 14263361,
    bronzeDark: 9726250,
    lacquer: 1775645,
    lacquerHi: 3814464,
    red: 11022378,
    redDark: 7216924,
    cloth: 8015408,
    clothDark: 5518370,
    clothLight: 10119746,
    skirt: 9190186,
    skirtDark: 6038297,
    steel: 13226714,
    steelDark: 8161428,
    skin: 14263932,
    hair: 2235420,
    hairHi: 4010544,
    leather: 4994600,
    leatherDark: 2891544,
    amber: 16761690,
  },
  RIG_PROPORTIONS: RigProportions = {
    ankleY: 0.11,
    kneeY: 0.42,
    hipY: 0.76,
    hipX: 0.19,
    pelvisY: 0.8,
    spineY: 0.98,
    chestY: 1.2,
    neckY: 1.54,
    headY: 1.56,
    clavX: 0.16,
    shoulderX: 0.47,
    shoulderY: 1.43,
    elbowY: 1.06,
    wristY: 0.73,
    handY: 0.61,
  },
  UNIT_MODEL_SCALE = 1.33,
  DEG2RAD = Math.PI / 180,
  UNIT_CAPSULE: UnitCapsule = { h: 1.45, w: 0.45 }

export { UNIT_PALETTE, RIG_PROPORTIONS, UNIT_MODEL_SCALE, DEG2RAD, UNIT_CAPSULE }
