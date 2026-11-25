/**
 * HeroBundle —— 一个英雄的"完整说明书"。
 *
 * 重构的核心：旧工程里加一个英雄要改 8 处（数据 / 规格 / 模型 / 特效 /
 * 音效 / 图标 / AI / 场景），且大部分硬编码在内核 70k 行里。
 * Bundle 把这 8 处收敛成"一个文件 + 一个 install 调用"：
 * 内核只保留无法安全外移的模型几何（见 model），其余全部是数据。
 *
 * 设计要点：
 *  - 可选字段省略时，installer 一律走"回退/别名"策略，保证新英雄先能跑；
 *  - 字段齐全时，installer 走完整注入，行为与手写硬编码等价；
 *  - 任何字段都不要求改内核逻辑（新增的只有 registerHeroTables 一个通用钩子）。
 */

import type { HeroSpec } from '../heroes/types'
import type { Kernel } from '../extensions/api'

/** 施法动作规格（damage / cc / mobility / selfBuffs 的声明式描述） */
export interface ActionSpecBundle {
  roles: string[]
  damage?: { type: string; ad?: string; ap?: string; hits?: number; interval?: number }
  cc?: Array<{ kind: string; duration: number; value?: number }>
  mobility?: { kind: string; stopsAtFirstHero?: boolean; duration?: number }
  selfBuffs?: string[]
  duration?: number
  delay?: number
  reach?: number
  aoeRadius?: number
  dodgeable?: boolean
  stopsAtFirstHero?: boolean
  [key: string]: unknown
}

/** 三个技能槽 + 被动的规格集合 */
export interface CombatSpec {
  s1: ActionSpecBundle
  s2: ActionSpecBundle
  ult: ActionSpecBundle
}

/**
 * 视觉层 —— 注入内核那批"按英雄 id 索引"的表。
 * 字段与内核 registerHeroTables 的 parts 一一对应。
 */
export interface VisualBundle {
  /** 特效配色（5 色，十进制整数；内核用 Lt() 转色） */
  palette?: { glow: number; hot: number; deep: number; accent: number; dark: number }
  /** 立绘取景框 [ymin, ymax] */
  portrait?: [number, number]
  /** 模型缩放系数 */
  scale?: number
  /** 施法动画映射：slot -> [clip 名, 时长] */
  cast?: Record<string, [string, number]>
  /** 命中特效落点 */
  hit?: { drop: number; dist: number; yaw: number; x: number }
  /** AI 能力雷达（生存/伤害/控制/机动/上手） */
  ability?: { survive: number; damage: number; control: number; mobility: number; ease: number }
  /** AI 战术性格 */
  tactics?: {
    fleeHp: number; recallHp: number; engage: number
    initiator: boolean; diveBackline: number; support: boolean
  }
  /** AI 技能键位映射 */
  skillMap?: Record<string, string>
  /** AI 移速系数 */
  speed?: number
  /** AI 技能释放优先级 */
  skillOrder?: string[]
  /** 技能图标 SVG 内容（不含最外层 svg，由内核 dn() 包装） */
  icons?: { passive?: string; s1?: string; s2?: string; ult?: string }
  /** 图标背景三色，缺省用内核默认 */
  iconBg?: Record<string, [string, string, string]>
}

/** 一条程序化音效的声明（复用内核 defineSound 的 DSL） */
export interface SoundDef {
  /** 事件名，如 atk_xiangyu_swing */
  name: string
  /** 分组：ges 组名，如 '英雄普攻' */
  group: string
  /** 人话描述 */
  label: string
  /** 合成配方：交给内核的 sound builder 回调 */
  build: (n: any) => void
  /** 混音参数 */
  mix?: { loud?: number; len?: number; gap?: number; rev?: number }
}

/** 音效层：普攻挥砍/命中映射 + 事件定义列表 */
export interface AudioBundle {
  swingEvent?: string
  hitEvent?: string
  sounds?: SoundDef[]
}

/** 模型来源：因为几何 DSL 在内核私有作用域，模型 builder 必须留在内核 */
export interface ModelBundle {
  /** 内核 Gx 注册表里的 key，如 'hero:xiangyu'；缺省则用 aliasFrom 复用 */
  key?: string
  /** 复用的宿主英雄 id（"最小闭环"路径：借皮先跑起来） */
  aliasFrom?: string
}

/** 一个英雄的完整描述 */
export interface HeroBundle {
  id: string
  /** 英雄数值/技能/文案数据（复用原 heroes 层类型） */
  data: HeroSpec
  /** 技能玩法规格。缺省时内核 __defaultActionSpec 兜底 */
  combat?: (k: Kernel) => CombatSpec
  /** 视觉表。缺省时按 aliasFrom 复用宿主 */
  visual?: VisualBundle
  /** 音效。缺省时按 aliasFrom 复制宿主音效 */
  audio?: AudioBundle
  /** 模型来源 */
  model: ModelBundle
  /** 是否为示例英雄（默认不装进阵容） */
  demo?: boolean
}

/** bundle 的构建辅助：提供类型推导，无运行时行为 */
export function defineHeroBundle(result: HeroBundle): HeroBundle {
  return result
}
