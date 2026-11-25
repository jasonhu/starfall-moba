/**
 * 英雄注册表的「运行时快照」
 * ---------------------------------------------------------------
 * 内核与音频/技能等模块都需要「按 id 查英雄」和「固定顺序的英雄 id 列表」。
 * 这里把 `heroes/index` 的导出固化成两个只读视图，避免各模块各自
 * `Object.keys(HERO_DATA)` 造成顺序/时机不一致。
 *
 * - `HERO_IDS`：选人顺序 / AI 分位 / 模型预热用的 id 列表
 * - `HERO_TABLE`：id → 英雄规格 的浅拷贝快照（运行期不写入，仅读取）
 *
 * 注意：这是快照，不是引用。新增英雄请改 `heroes/index`，此处自动跟进。
 */
import HERO_DATA from './index'

/** 英雄 id 列表，顺序即 `heroes/index` 的声明顺序 */
export const HERO_IDS = Object.keys(HERO_DATA)

/** 英雄规格表快照（浅拷贝，避免被下游模块无意改写） */
export const HERO_TABLE = Object.assign({}, HERO_DATA)
