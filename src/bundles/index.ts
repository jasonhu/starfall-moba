/**
 * Bundle 注册表 —— 加新英雄的唯一入口。
 *
 * 旧工程加一个英雄要改内核 + 4 个 TS 文件；现在只要：
 *   1. 写 src/heroes/<id>.ts（数值数据，可省）
 *   2. 写 src/bundles/<id>.bundle.ts（声明完整说明书）
 *   3. 在这里 import 并加进数组一行
 * 不需要碰内核、不需要改 install.ts。
 */

import type { HeroBundle } from './types'
import { xiangyuBundle } from './xiangyu.bundle'
import { myheroBundle } from './myhero.bundle'

export const bundles: HeroBundle[] = [
  xiangyuBundle,
  myheroBundle, // demo=true，默认不装；改 false 即启用（见该文件说明）
  // 新英雄照上面加一行即可
]

export { defineHeroBundle } from './types'
export type { HeroBundle, VisualBundle, AudioBundle, CombatSpec } from './types'
export { installHeroBundle, installAllBundles } from './installer'
export type { InstallReport } from './installer'
