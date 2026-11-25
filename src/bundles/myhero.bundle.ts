/**
 * 最小闭环英雄示例 —— 展示"加一个英雄"的最短路径。
 *
 * 这个 bundle 只做一件事：把 myhero 寄宿在樊哙(panyue)身上——
 * 模型/骨架/动作、特效配色、立绘、图标、音效全部复用，
 * 只换数值数据（src/heroes/myhero.ts）和技能规格。
 *
 * 它演示了 HeroBundle 的核心承诺：
 *   加英雄 = 写数据 + 写 bundle + 注册一行；零改内核、零写几何 DSL。
 *
 * 默认 demo=true 不装进阵容；想启用只需把 demo 改成 false，
 * 并在 src/heroes/index.ts 取消 myhero 的注释。
 */

import { defineHeroBundle } from './types'
import { myhero } from '../heroes/myhero'

export const myheroBundle = defineHeroBundle({
  id: 'myhero',
  data: myhero,
  demo: true, // 改成 false 即启用
  // 全部走别名回退：installer 会自动 alias 模型/视觉/图标/音效到 panyue
  model: { aliasFrom: 'panyue' },
  // combat 省略 -> 内核 __defaultActionSpec 按数值自动生成
  // visual 省略 -> 复用宿主
  // audio 省略 -> 复用宿主
})
