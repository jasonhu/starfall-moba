/**
 * 画质预设 QUALITY_PRESETS —— low / medium / high 三档
 * ---------------------------------------------------------------
 * 每档描述：像素比上限、阴影、后处理（Bloom + 调色）、植被/道具密度、大气与水面细节。
 * 各档字段必须齐全（由 QualityPreset 约束），新增字段时三档都要补。
 */

/** 单档画质预设 */
export interface QualityPreset {
  /** 档位名，与键名一致 */
  name: 'low' | 'medium' | 'high'
  /** 设备像素比上限 */
  dprCap: number
  /** 是否启用阴影 */
  shadows: boolean
  /** 阴影贴图边长（0 表示不分配） */
  shadowMapSize: number
  /** 是否启用后处理（Bloom + 调色） */
  post: boolean
  /** MSAA 采样数（0 表示关闭） */
  msaa: number
  /** Bloom 强度 */
  bloom: number
  /** Bloom 降采样层数 */
  bloomLevels: number
  /** 是否启用调色（色彩分级） */
  grade: boolean
  /** 动态点光源数量 */
  pointLights: number
  /** 植被密度系数 */
  foliage: number
  /** 地面细节等级 */
  groundDetail: number
  /** 空气浮尘密度 */
  motes: number
  /** 阴影过滤算法（对应 three 的 shadowMap.type） */
  shadowType: 'basic' | 'pcf' | 'pcfsoft' | 'vsm'
  /** 阴影模糊半径 */
  shadowRadius: number
  /** 雾霾强度 */
  haze: number
  /** Bloom 亮度阈值 */
  bloomThreshold: number
  /** 大气散射等级 */
  atmos: number
  /** 水面细节等级 */
  waterDetail: number
  /** 是否启用单位表面花纹 */
  unitPatterns: boolean
  /** 场景道具密度 */
  props: number
  /** 远景装饰等级 */
  sceneryRank: number
  /** 阴影质量等级 */
  shadowRank: number
}

export const QUALITY_PRESETS = {
  low: {
    name: 'low',
    dprCap: 1,
    shadows: false,
    shadowMapSize: 0,
    post: false,
    msaa: 0,
    bloom: 0,
    bloomLevels: 0,
    grade: false,
    pointLights: 0,
    foliage: 0.5,
    groundDetail: 0,
    motes: 0.4,
    shadowType: 'pcfsoft',
    shadowRadius: 1,
    haze: 0,
    bloomThreshold: 1.35,
    atmos: 0,
    waterDetail: 0,
    unitPatterns: false,
    props: 0.5,
    sceneryRank: 1,
    shadowRank: 0,
  },
  medium: {
    name: 'medium',
    dprCap: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    post: true,
    msaa: 2,
    bloom: 0.4,
    bloomLevels: 4,
    grade: true,
    pointLights: 2,
    foliage: 0.75,
    groundDetail: 1,
    motes: 0.7,
    shadowType: 'pcfsoft',
    shadowRadius: 1,
    haze: 0.05,
    bloomThreshold: 1.35,
    atmos: 1,
    waterDetail: 1,
    unitPatterns: true,
    props: 0.75,
    sceneryRank: 2,
    shadowRank: 0,
  },
  high: {
    name: 'high',
    dprCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    post: true,
    msaa: 4,
    bloom: 0.55,
    bloomLevels: 5,
    grade: true,
    pointLights: 4,
    foliage: 1,
    groundDetail: 2,
    motes: 1,
    shadowType: 'pcf',
    shadowRadius: 2,
    haze: 0.06,
    bloomThreshold: 1.35,
    atmos: 2,
    waterDetail: 2,
    unitPatterns: true,
    props: 1,
    sceneryRank: 3,
    shadowRank: 3,
  },
} satisfies Record<string, QualityPreset>
