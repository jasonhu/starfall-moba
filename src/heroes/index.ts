import type { HeroSpec } from './types'
import { panyue } from './panyue'
import { chijin } from './chijin'
import { xingli } from './xingli'
import { fengling } from './fengling'
import { yeque } from './yeque'
import { xiangyu } from './xiangyu'
// import { myhero } from './myhero'  // 示例英雄：启用时取消注释

/**
 * 英雄注册表（单一真源）
 * 内核启动时把它注入为自己的 Se 表；新增英雄只要在这里加一行。
 */
export const heroes: Record<string, HeroSpec> = {
  panyue,
  chijin,
  xingli,
  fengling,
  yeque,
  xiangyu,
}

/** 英雄选择/阵容顺序（内核用它做随机选人、AI 分位、模型预热） */
export const heroOrder: string[] = Object.keys(heroes)

export type { HeroSpec } from './types'
export * from './types'

export default heroes

/**
 * 处理英雄。
 *
 * @param result - 输入
 */
export function defineHero(result: HeroSpec): HeroSpec {
  return result
}
