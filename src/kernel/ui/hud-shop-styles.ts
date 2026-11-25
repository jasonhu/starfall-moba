/**
 * HUD 商店与面板响应式样式（CSS 字符串集）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'
import { formatBriefStats } from './icon-theme'
import { ItemTable } from '../equipment'

const HUD_SHOP_CSS_BASE = `
  .sf-hud__shop-grid { flex: none; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; grid-auto-rows: auto; gap: 6u; }
  .sf-hud__card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: 3u 8u; min-height: max(50px, 56u); padding: 5u 8u 5u 9u; }
  .sf-hud__card-top { grid-column: 1; grid-row: 1 / span 2; position: relative; margin: 0; gap: 0; }
  .sf-hud__card .sf-slot { --sf-slot: max(36px, 42u); }
  .sf-hud__card-no { position: absolute; left: -6px; top: -5px; z-index: 1; width: 16px; height: 16px; font-size: 10px; }
  .sf-hud__card-dots { position: absolute; left: 50%; bottom: -5px; z-index: 1; transform: translateX(-50%); padding: 2px 4px; border-radius: 99px; background: rgba(4, 8, 22, 0.92); }
  .sf-hud__card-name { grid-column: 2 / span 2; grid-row: 1; font-size: var(--sf-fs-sm); letter-spacing: 0; }
  .sf-hud__card-brief { display: none; }
  .sf-hud__card-price { grid-column: 2; grid-row: 2; margin: 0; padding: 0; font-size: var(--sf-fs-sm); }
  .sf-hud__card-tag { position: static; grid-column: 3; grid-row: 2; justify-self: end; }
  .sf-hud__card.is-done .sf-hud__card-tag { grid-column: 2 / span 2; justify-self: start; }
  .sf-hud__card-tag-more { display: none; }
  .sf-hud__dt-brief { font-size: var(--sf-fs-sm); }
  .sf-hud__dt-stats { flex-direction: row; flex-wrap: wrap; gap: 2u 14u; margin-top: 5u; padding-top: 5u; }
  .sf-hud__dt-stat { justify-content: flex-start; gap: 5u; }
  .sf-hud__dt-nopassive { display: none; }
  .sf-hud__dt-passive { margin-top: 5u; padding: 5u 8u; font-size: var(--sf-fs-xs); line-height: 1.45; }
`,
  HUD_SHOP_CSS_COMPACT = expandCssUnits(`
/* ── 商店按钮 + 快捷购买气泡 / 自动出装提示条（小地图下方） ── */
.sf-hud__shopbar { position: absolute; left: calc(var(--hud-l) + 4u); top: calc(var(--hud-t) + var(--hud-mini) + 12u); z-index: 3; display: flex; align-items: center; gap: 14u; }
/* 商店按钮：金色圆钮。金币数在右上角与状态栏里已经有了，这里不再重复 */
.sf-hud__shopbtn {
  --p: 0; position: relative; display: grid; place-items: center; flex: none; width: max(40px, 46u); height: max(40px, 46u); padding: 0; margin: 0; border: 0; border-radius: 50%; cursor: pointer;
  color: #2b1a04; background: var(--sf-grad-gold);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65), 0 0 0 1px #6b4614, 0 0 0 max(3px, 4u) rgba(8, 13, 31, 0.82), 0 0 0 max(4px, 5u) rgba(232, 199, 122, 0.55), 0 4u 12u rgba(2, 4, 12, 0.5);
  transition: transform 0.1s var(--sf-ease-out), filter 0.12s linear;
}
@media (hover: hover) { .sf-hud__shopbtn:hover { filter: brightness(1.12); } }
.sf-hud__shopbtn:active { transform: scale(0.93); }
.sf-hud__shopbtn > .sf-i { width: 58%; height: 58%; }
.sf-hud__shopbtn .sf-hud__key { right: -6u; top: -6u; }
.sf-hud__shopbtn.is-open { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65), 0 0 0 1px #6b4614, 0 0 0 max(3px, 4u) rgba(8, 13, 31, 0.82), 0 0 0 max(4px, 5u) #fff4d6, 0 0 16u rgba(255, 214, 130, 0.8); }
/* 自动出装关着、有推荐装备可买时：按钮外圈跟着呼吸 */
.sf-hud__shopbtn.is-ready::after { content: ''; position: absolute; inset: -7u; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 1.5px rgba(255, 231, 173, 0.85); animation: sf-hud-quick-pulse 1.4s ease-out infinite; }
/* 自动出装开着：外圈画攒钱进度环(当前金币 / 下一件的花费)，快满了就知道要自动买了 */
.sf-hud__shopbtn.is-saving::before {
  content: ''; position: absolute; inset: calc(-1 * max(6px, 7.5u)); border-radius: 50%; pointer-events: none;
  background: conic-gradient(#ffe7ad calc(var(--p) * 360deg), rgba(150, 178, 235, 0.3) 0);
  -webkit-mask: radial-gradient(farthest-side, rgba(0, 0, 0, 0) calc(100% - max(3px, 3.5u)), #000 calc(100% - max(3px, 3.5u) + 0.6px));
  mask: radial-gradient(farthest-side, rgba(0, 0, 0, 0) calc(100% - max(3px, 3.5u)), #000 calc(100% - max(3px, 3.5u) + 0.6px));
  filter: drop-shadow(0 0 3u rgba(2, 4, 12, 0.8));
}

.sf-hud__quick {
  position: relative; display: none; align-items: center; gap: 7u; height: max(40px, 46u); padding: 0 12u 0 4u; margin: 0; border: 0; border-radius: 9u; cursor: pointer;
  background: linear-gradient(180deg, rgba(64, 48, 14, 0.94), rgba(22, 16, 6, 0.95)); color: var(--sf-c-gold-100); text-align: left;
  box-shadow: inset 0 0 0 1px #f3cf85, 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 16u rgba(255, 214, 130, 0.55), 0 4u 12u rgba(2, 4, 12, 0.5);
  animation: sf-hud-quick-in 0.35s var(--sf-ease-spring) both;
}
.sf-hud__quick.is-on { display: inline-flex; }
.sf-hud__quick:active { transform: scale(0.95); }
.sf-hud__quick::before { content: ''; position: absolute; inset: -3u; border-radius: 12u; pointer-events: none; box-shadow: 0 0 0 1.5px rgba(255, 231, 173, 0.8); animation: sf-hud-quick-pulse 1.4s ease-out infinite; }
.sf-hud__quick .sf-slot, .sf-hud__autobuy .sf-slot { --sf-slot: max(32px, 38u); border-radius: 7u; }
.sf-hud__quick-text { display: flex; flex-direction: column; gap: 2u; }
.sf-hud__quick-tag, .sf-hud__autobuy-tag { font-size: max(10px, 11u); font-weight: 800; letter-spacing: 0.08em; color: #2b1a04; background: var(--sf-grad-gold); border-radius: 3u; padding: 0 5u; align-self: flex-start; line-height: 1.5; white-space: nowrap; }
.sf-hud__quick-price { display: inline-flex; align-items: center; gap: 3u; font-size: var(--sf-fs-sm); font-weight: 800; line-height: 1; white-space: nowrap; }
.sf-hud__quick-price .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__quick-name { margin-right: 2u; }
@keyframes sf-hud-quick-in { from { opacity: 0; transform: translateX(-16u) scale(0.8); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-quick-pulse { 0% { opacity: 0.9; transform: scale(0.96); } 100% { opacity: 0; transform: scale(1.12); } }

/* 自动出装提示条：沿用气泡的金色底板与位置，但不可点、没有呼吸光圈，停一会儿自己淡出 */
.sf-hud__autobuy {
  position: relative; display: none; align-items: center; gap: 7u; height: max(40px, 46u); padding: 0 13u 0 4u; border-radius: 9u; pointer-events: none;
  background: linear-gradient(180deg, rgba(64, 48, 14, 0.94), rgba(22, 16, 6, 0.95)); color: var(--sf-c-gold-100);
  box-shadow: inset 0 0 0 1px rgba(243, 207, 133, 0.7), 0 0 0 1px rgba(8, 13, 31, 0.9), 0 4u 12u rgba(2, 4, 12, 0.5);
}
.sf-hud__autobuy.is-on { display: inline-flex; animation: sf-hud-quick-in 0.35s var(--sf-ease-spring) both; }
.sf-hud__autobuy.is-on.is-out { animation: sf-hud-autobuy-out 0.3s linear both; }
.sf-hud__autobuy-ico { display: grid; place-items: center; flex: none; width: max(32px, 38u); height: max(32px, 38u); border-radius: 7u; color: var(--sf-c-gold-200); background: rgba(255, 214, 130, 0.1); box-shadow: inset 0 0 0 1px rgba(243, 207, 133, 0.4); }
.sf-hud__autobuy-ico > .sf-i { width: 60%; height: 60%; }
.sf-hud__autobuy-text { display: flex; flex-direction: column; gap: 3u; }
.sf-hud__autobuy-name { font-size: var(--sf-fs-sm); font-weight: 800; line-height: 1.1; white-space: nowrap; }
.sf-hud__autobuy.is-warn { color: #ffe2b0; box-shadow: inset 0 0 0 1px rgba(255, 184, 77, 0.8), 0 0 0 1px rgba(8, 13, 31, 0.9), 0 4u 12u rgba(2, 4, 12, 0.5); }
.sf-hud__autobuy.is-warn .sf-hud__autobuy-tag { background: linear-gradient(180deg, #ffe0ae, #ffb454); }
.sf-hud__autobuy.is-warn .sf-hud__autobuy-ico { color: var(--sf-c-amber); background: rgba(255, 184, 77, 0.12); box-shadow: inset 0 0 0 1px rgba(255, 184, 77, 0.45); }
@keyframes sf-hud-autobuy-out { to { opacity: 0; transform: translateY(-5u); } }

/* 面板开着时提示条的停靠位：面板上沿的正上方、水平居中(top 由脚本按面板位置写入)；放不下就不显示 */
.sf-hud__shop-dock { position: absolute; left: 0; right: 0; top: 0; z-index: 1; display: flex; justify-content: center; pointer-events: none; }
.sf-hud__shop-dock.is-off { visibility: hidden; }

/* ── 商店面板 ── */
.sf-hud__shop { position: absolute; inset: 0; z-index: 7; display: none; place-items: center; pointer-events: auto;
  padding: max(10u, var(--sf-safe-t)) max(12u, var(--sf-safe-r)) max(10u, var(--sf-safe-b)) max(12u, var(--sf-safe-l)); background: rgba(3, 6, 16, 0.5); }
.sf-hud__shop.is-open { display: grid; animation: sf-fade-in 0.16s linear both; }
.sf-hud__shop-panel { display: flex; flex-direction: column; width: min(100%, 960u); height: min(100%, 540u); min-height: 0; animation: sf-pop-in 0.26s var(--sf-ease-out) both; }
.sf-hud__shop-head { display: flex; align-items: center; gap: 10u; flex: none; padding: 5u 8u 0 20u; box-shadow: inset 0 -1px 0 var(--sf-c-line-strong); }
.sf-hud__shop-title { margin: 0; font-size: var(--sf-fs-xl); font-weight: 800; letter-spacing: 0.2em; line-height: 1.2; white-space: nowrap; }
.sf-hud__shop-head .sf-tabs { flex: 1; box-shadow: none; min-width: 0; }
.sf-hud__shop-head .sf-tab { padding: 0 14u; }
.sf-hud__shop-gold { color: var(--sf-c-gold-200); font-size: var(--sf-fs-md); }
/* 自动出装开关：上行「自动出装 + 开关」，下行一句小字说明当前状态。整块都是点击热区 */
.sf-hud__shop-auto { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2u; padding: 3u 7u; margin: 0; border: 0; border-radius: 7u; background: none; cursor: pointer; }
.sf-hud__shop-auto-row { display: flex; align-items: center; gap: 8u; font-size: var(--sf-fs-sm); font-weight: 700; letter-spacing: 0.06em; color: var(--sf-c-text); white-space: nowrap; }
.sf-hud__shop-auto .sf-toggle { --sf-tg-h: max(22px, 24u); --sf-tg-w: max(40px, 44u); }
.sf-hud__shop-auto-hint { font-size: max(10px, 11u); line-height: 1.25; color: var(--sf-c-text-3); white-space: nowrap; }
.sf-hud__shop-auto.is-on .sf-hud__shop-auto-hint { color: var(--sf-c-cyan-300); }
.sf-hud__shop-auto.is-warn .sf-hud__shop-auto-hint { color: var(--sf-c-amber); }
.sf-hud__shop-auto.is-flash { animation: sf-hud-auto-flash 0.9s ease-out; }
@keyframes sf-hud-auto-flash { 0% { background: rgba(255, 214, 130, 0.4); } 100% { background: rgba(255, 214, 130, 0); } }

.sf-hud__shop-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) max(232px, 268u); }
.sf-hud__shop-list { display: flex; flex-direction: column; min-height: 0; padding: 10u 12u 12u 16u; }
.sf-hud__shop-prog { flex: none; display: flex; align-items: center; gap: 10u; min-width: 0; margin-bottom: 8u; font-size: var(--sf-fs-sm); color: var(--sf-c-text-2); white-space: nowrap; }
.sf-hud__shop-prog-who { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sf-hud__shop-prog-who > b { color: var(--sf-c-text); font-weight: 700; }
.sf-hud__shop-prog-n { flex: none; margin-left: auto; }
.sf-hud__shop-prog-n > b { color: var(--sf-c-gold-200); }
.sf-hud__shop-steps { flex: none; display: flex; align-items: center; gap: 3u; }
.sf-hud__shop-steps > i { width: 18u; height: max(4px, 5u); border-radius: 3u; background: rgba(4, 8, 22, 0.8); box-shadow: inset 0 0 0 1px var(--sf-c-line-strong); }
.sf-hud__shop-steps > i.is-done { background: var(--sf-grad-gold); box-shadow: 0 0 6u rgba(255, 214, 130, 0.6); }
/* 鞋那一格：草鞋已有、进阶鞋还没买 = 半格 */
.sf-hud__shop-steps > i.is-half { background: linear-gradient(90deg, #f3cf85 0 50%, rgba(4, 8, 22, 0.8) 50% 100%); }
.sf-hud__shop-prog-n > small { margin-left: 4u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); }
.sf-hud__shop-steps > i.is-next { background: var(--sf-c-cyan-400); box-shadow: 0 0 6u rgba(92, 214, 247, 0.7); animation: sf-hud-blink 1s steps(2, jump-none) infinite; }
/* 桌面：3 列 2 行铺满(每页最多 6 件，不用滚动)；内容实在放不下时整列可滚 */
.sf-hud__shop-grid { flex: 1 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(min-content, 1fr)); gap: 8u; }

/* 卡片：序号 + 图标(+ 鞋的两个阶段点) → 名字 → 一句大白话 → 价格；右上角是状态标签 */
.sf-hud__card {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4u; min-width: 0; padding: 11u 12u 10u; margin: 0; border: 0; border-radius: 9u; cursor: pointer; text-align: left; color: var(--sf-c-text);
  background: linear-gradient(180deg, rgba(34, 54, 110, 0.5), rgba(10, 17, 40, 0.6)); box-shadow: inset 0 0 0 1px var(--sf-c-line-strong);
  transition: box-shadow 0.12s linear, background 0.12s linear, transform 0.1s var(--sf-ease-out), opacity 0.2s linear;
}
@media (hover: hover) { .sf-hud__card:hover { background: linear-gradient(180deg, rgba(48, 74, 146, 0.6), rgba(14, 24, 54, 0.7)); } }
.sf-hud__card:active { transform: scale(0.98); }
.sf-hud__card-top { display: flex; align-items: center; gap: 9u; margin-bottom: 5u; }
.sf-hud__card .sf-slot { --sf-slot: max(44px, 60u); }
.sf-hud__card-no { display: grid; place-items: center; flex: none; width: max(18px, 20u); height: max(18px, 20u); border-radius: 50%; font-size: max(10px, 11.5u); font-weight: 800; line-height: 1; color: var(--sf-c-text-2); background: rgba(4, 8, 22, 0.75); box-shadow: inset 0 0 0 1px var(--sf-c-line-strong); }
.sf-hud__card-dots { display: inline-flex; gap: 3u; }
.sf-hud__card-dots > i { width: max(6px, 8u); height: max(6px, 8u); border-radius: 50%; background: rgba(4, 8, 22, 0.8); box-shadow: inset 0 0 0 1px rgba(232, 199, 122, 0.6); }
.sf-hud__card-dots > i.is-on { background: var(--sf-grad-gold); box-shadow: 0 0 5u rgba(255, 214, 130, 0.7); }
.sf-hud__card-name { max-width: 100%; font-size: var(--sf-fs-lg); font-weight: 700; line-height: 1.3; letter-spacing: 0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sf-hud__card-brief { max-width: 100%; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: var(--sf-fs-sm); line-height: 1.45; color: var(--sf-c-text-2); }
.sf-hud__card-price { display: inline-flex; align-items: center; gap: 4u; flex: none; margin-top: auto; padding-top: 3u; font-size: var(--sf-fs-md); font-weight: 800; line-height: 1.2; color: var(--sf-c-gold-200); }
.sf-hud__card-price .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__card-tag { position: absolute; right: 7u; top: 7u; display: inline-flex; align-items: center; gap: 2u; padding: 1u 6u; border-radius: 3u; font-size: max(10px, 10.5u); font-weight: 800; line-height: 1.4; letter-spacing: 0.04em; white-space: nowrap; }
.sf-hud__card-tag:empty { display: none; }
.sf-hud__card.is-poor .sf-hud__card-price { color: #ff8d8d; }
.sf-hud__card.is-blocked .sf-slot > svg { filter: saturate(0.5) brightness(0.72); }
.sf-hud__card.is-blocked { opacity: 0.62; }
.sf-hud__card.is-afford { box-shadow: inset 0 0 0 1px rgba(232, 199, 122, 0.55); }
/* 已买：变暗；价格位置空出来 */
.sf-hud__card.is-done { opacity: 0.6; }
.sf-hud__card.is-done .sf-hud__card-price { display: none; }
/* 下一件：金色描边 + 外发光慢呼吸 */
.sf-hud__card.is-next { box-shadow: inset 0 0 0 max(2px, 2u) #f3cf85, 0 0 12u rgba(255, 214, 130, 0.35); }
.sf-hud__card.is-next::after { content: ''; position: absolute; inset: -3u; border-radius: 12u; pointer-events: none; box-shadow: 0 0 0 1.5px rgba(255, 231, 173, 0.85); animation: sf-hud-quick-pulse 1.4s ease-out infinite; }
/* 选中(详情区正在看的那件)：底色提亮 + 浅色描边；与「下一件」叠加时保留金边 */
.sf-hud__card.is-sel { background: linear-gradient(180deg, rgba(86, 124, 210, 0.42), rgba(20, 34, 72, 0.8)); box-shadow: inset 0 0 0 max(1.5px, 2u) #dfe8ff; }
.sf-hud__card.is-sel.is-done, .sf-hud__card.is-sel.is-blocked { opacity: 0.9; }
.sf-hud__card.is-sel.is-next { box-shadow: inset 0 0 0 max(2px, 2.5u) var(--sf-c-gold-100), 0 0 14u rgba(255, 214, 130, 0.5); }
.sf-hud__card-tag.is-own { color: #0f2a1a; background: linear-gradient(180deg, #b8f5cf, #6fe3a1); }
/* 鞋卡：草鞋已经在身上，升级排在后面——淡绿描边的说明标签，不抢「下一件」的风头 */
.sf-hud__card-tag.is-have { color: #b9f5d2; background: rgba(12, 40, 26, 0.75); box-shadow: inset 0 0 0 1px rgba(111, 227, 161, 0.55); }
.sf-hud__card-tag.is-next { color: #06222c; background: linear-gradient(180deg, #c9f6ff, #5cd6f7); }
.sf-hud__card-tag.is-done, .sf-hud__card-tag.is-auto { color: #2b1a04; background: var(--sf-grad-gold); }
.sf-hud__card-tag.is-step { color: var(--sf-c-text-2); background: rgba(4, 8, 22, 0.7); box-shadow: inset 0 0 0 1px var(--sf-c-line-strong); }
.sf-hud__card.is-flash { animation: sf-hud-card-buy 0.5s ease-out; }
@keyframes sf-hud-card-buy { 0% { filter: brightness(2.2); } 100% { filter: none; } }

/* 详情：标题(★ 下一件 / 第 N 件) → 图标 + 名字 → 大白话 → 属性 → 被动 → 提示 → 攒钱进度 → 购买 */
.sf-hud__shop-detail { display: flex; flex-direction: column; min-height: 0; padding: 10u 14u 12u; box-shadow: inset 1px 0 0 var(--sf-c-line-strong); background: rgba(4, 8, 22, 0.35); }
.sf-hud__dt-title { flex: none; display: flex; align-items: center; gap: 5u; margin-bottom: 7u; font-size: var(--sf-fs-sm); font-weight: 800; letter-spacing: 0.12em; line-height: 1.2; color: var(--sf-c-text-2); }
.sf-hud__dt-title.is-next { color: var(--sf-c-gold-200); text-shadow: 0 0 8u rgba(255, 214, 130, 0.45); }
.sf-hud__dt-title .sf-i { width: 1.15em; height: 1.15em; vertical-align: 0; }
.sf-hud__dt-head { display: flex; align-items: center; gap: 10u; flex: none; }
.sf-hud__dt-head .sf-slot { --sf-slot: max(46px, 56u); }
.sf-hud__dt-headtext { flex: 1; min-width: 0; }
.sf-hud__dt-name { font-size: var(--sf-fs-lg); font-weight: 800; color: var(--sf-c-gold-200); line-height: 1.25; letter-spacing: 0.04em; }
.sf-hud__dt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5u; margin-top: 3u; }
.sf-hud__dt-price { display: none; align-items: center; gap: 3u; flex: none; align-self: flex-start; font-size: var(--sf-fs-md); font-weight: 800; color: var(--sf-c-gold-200); }
.sf-hud__dt-price .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__dt-body { flex: 1; min-height: 0; margin: 8u -6u 6u 0; padding-right: 6u; }
.sf-hud__dt-brief { font-size: var(--sf-fs-md); font-weight: 600; line-height: 1.45; color: var(--sf-c-text); }
.sf-hud__dt-stats { display: flex; flex-direction: column; gap: 3u; margin-top: 8u; padding-top: 8u; box-shadow: inset 0 1px 0 var(--sf-c-line); font-size: var(--sf-fs-sm); line-height: 1.35; }
.sf-hud__dt-stat { display: flex; justify-content: space-between; gap: 10u; }
.sf-hud__dt-stat > span { color: var(--sf-c-text-2); }
.sf-hud__dt-stat > b { color: var(--sf-c-cyan-300); font-weight: 700; text-align: right; white-space: nowrap; }
.sf-hud__dt-passive { margin-top: 8u; padding: 7u 9u; border-radius: 6u; background: rgba(255, 184, 77, 0.08); box-shadow: inset 0 0 0 1px rgba(255, 184, 77, 0.28); font-size: var(--sf-fs-sm); line-height: 1.5; color: var(--sf-c-text-2); }
.sf-hud__dt-passive b { display: block; color: var(--sf-c-amber); font-weight: 700; }
.sf-hud__dt-nopassive { margin-top: 8u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); }
.sf-hud__dt-note { flex: none; margin-bottom: 5u; font-size: var(--sf-fs-sm); line-height: 1.4; color: var(--sf-c-text-3); }
.sf-hud__dt-note:empty { display: none; }
.sf-hud__dt-note.is-warn { color: #ff9c9c; }
.sf-hud__dt-note.is-good { color: var(--sf-c-green); }
.sf-hud__dt-note b { font-weight: 800; }
/* 攒钱进度：金币 / 花费，满了变绿 */
.sf-hud__dt-save { --p: 0; flex: none; display: flex; align-items: center; gap: 8u; margin-bottom: 7u; font-size: var(--sf-fs-xs); line-height: 1.2; color: var(--sf-c-text-2); white-space: nowrap; }
.sf-hud__dt-save-bar { position: relative; flex: 1; height: max(6px, 7u); border-radius: 99px; overflow: hidden; background: rgba(3, 6, 16, 0.82); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.3); }
.sf-hud__dt-save-bar > i { position: absolute; inset: 0; transform-origin: left center; transform: scaleX(var(--p)); transition: transform 0.3s var(--sf-ease-out); background: linear-gradient(90deg, #c08c3c, #ffe7ad); }
.sf-hud__dt-save.is-full .sf-hud__dt-save-bar > i { background: linear-gradient(90deg, #1f9d58, #6fe3a1); }
.sf-hud__dt-save-text > b { font-weight: 800; color: #ff9c9c; }
.sf-hud__dt-save.is-full .sf-hud__dt-save-text { font-weight: 700; color: var(--sf-c-green); }
.sf-hud__dt-empty { margin: auto; text-align: center; color: var(--sf-c-text-3); font-size: var(--sf-fs-sm); }
.sf-hud__dt-owned { flex: none; display: flex; align-items: center; justify-content: center; gap: 6u; min-height: max(36px, 40u); border-radius: 7u; font-size: var(--sf-fs-sm); font-weight: 700; color: var(--sf-c-gold-200); background: rgba(255, 214, 130, 0.08); box-shadow: inset 0 0 0 1px rgba(232, 199, 122, 0.3); }
.sf-hud__dt-owned .sf-i { width: 1.15em; height: 1.15em; vertical-align: 0; }
.sf-hud__shop-detail .sf-btn { flex: none; padding: 0 12u; letter-spacing: 0.1em; }
.sf-hud__shop-detail .sf-btn .sf-i { width: 1.15em; height: 1.15em; }
.sf-hud__shop-detail .sf-btn > .sf-hud__key { position: absolute; right: 8u; top: 50%; transform: translateY(-50%); }
/* 「还差 N · 攒够自动买」：一句话比较长，收小字号；此时回车买不了，键位角标与金币图标都不放 */
.sf-hud__shop-detail .sf-btn.is-wait { font-size: var(--sf-fs-sm); letter-spacing: 0.04em; }
.sf-hud__shop-detail .sf-btn.is-wait > .sf-hud__key, .sf-hud__shop-detail .sf-btn.is-wait > .sf-i { display: none; }

/* 装备栏 */
.sf-hud__shop-inv { display: flex; align-items: center; gap: 10u; flex: none; padding: 8u 16u 10u; box-shadow: inset 0 1px 0 var(--sf-c-line-strong); }
.sf-hud__shop-inv > .sf-heading { flex: none; width: auto; }
.sf-hud__shop-inv > .sf-heading::after { display: none; }
.sf-hud__shop-slots { display: flex; gap: 6u; }
.sf-hud__shop-slots .sf-slot { --sf-slot: max(36px, 40u); }
.sf-hud__shop-slots button.sf-slot--empty { cursor: default; }
.sf-hud__shop-hint { margin-left: auto; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); text-align: right; }

/* 矮横屏(手机)：面板几乎铺满；卡片 2 列 3 行，图标在左、右边 名字 / 大白话(一行) / 价格 */
@media (orientation: landscape) and (max-height: 460px) {
  .sf-hud__shop { padding-top: max(4px, var(--sf-safe-t)); padding-bottom: max(4px, var(--sf-safe-b)); }
  .sf-hud__shop-head { padding: 0 6u 0 14u; gap: 8u; }
  .sf-hud__shop-title { font-size: var(--sf-fs-lg); letter-spacing: 0.14em; }
  .sf-hud__shop-head .sf-tab { padding: 0 10u; min-height: 40px; }
  .sf-hud__shop-auto { padding: 2u 5u; }
  .sf-hud__shop-list { padding: 6u 10u 6u 12u; }
  .sf-hud__shop-prog { margin-bottom: 6u; }
  .sf-hud__shop-inv { padding: 5u 12u 6u; }
  .sf-hud__shop-slots .sf-slot { --sf-slot: 34px; }
  .sf-hud__shop-detail { padding: 6u 12u 8u; }
  .sf-hud__shop-hint { display: none; }
  .sf-hud__dt-title { margin-bottom: 5u; }
  .sf-hud__dt-head .sf-slot { --sf-slot: 40px; }
  .sf-hud__dt-body { margin: 5u -6u 4u 0; }
  .sf-hud__dt-save { margin-bottom: 5u; }
  .sf-hud__shop-detail .sf-btn { --sf-btn-h: 36px; }
  ${HUD_SHOP_CSS_BASE}
  /* 横屏竖向还有余量：卡片中间多放一行大白话(一行，放不下就省略) */
  .sf-hud__card { grid-template-rows: auto auto auto; gap: 1u 8u; min-height: max(62px, 70u); }
  .sf-hud__card-top { grid-row: 1 / span 3; }
  .sf-hud__card .sf-slot { --sf-slot: max(40px, 48u); }
  .sf-hud__card-brief { display: block; grid-column: 2 / span 2; grid-row: 2; font-size: max(10px, 11u); line-height: 1.35; white-space: nowrap; text-overflow: ellipsis; }
  .sf-hud__card-price, .sf-hud__card-tag { grid-row: 3; }
}
/* 竖屏：「下一件」提到最上面做成一张带购买键的大卡，下面是 2 列 3 行的卡片；提示条收窄(两行：标签 / 装备名)，给右侧击杀流让位 */
@media (orientation: portrait) {
  .sf-hud__quick-name { display: none; }
  .sf-hud__quick-tag, .sf-hud__autobuy-tag { letter-spacing: 0; }
  .sf-hud__shopbar { gap: 11u; }
  .sf-hud__autobuy { padding-right: 9u; gap: 6u; }
  .sf-hud__shop-panel { height: min(100%, 860u); }
  .sf-hud__shop-head { flex-wrap: wrap; padding: 8u 8u 0 14u; gap: 2u 10u; }
  .sf-hud__shop-title { flex: 1; }
  .sf-hud__shop-auto { order: 4; flex: 0 0 100%; flex-direction: row; align-items: center; justify-content: flex-start; gap: 10u; padding: 2u 0 3u; }
  .sf-hud__shop-auto-hint { font-size: var(--sf-fs-xs); }
  .sf-hud__shop-head .sf-tabs { order: 5; flex: 0 0 100%; }
  .sf-hud__shop-head .sf-tab { flex: 1; padding: 0 4u; }
  .sf-hud__shop-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .sf-hud__shop-detail { grid-row: 1; max-height: 330u; margin: 10u 10u 0; padding: 9u 12u 11u; border-radius: 10u; background: linear-gradient(180deg, rgba(40, 60, 118, 0.42), rgba(8, 14, 34, 0.55)); box-shadow: inset 0 0 0 1px rgba(232, 199, 122, 0.45), 0 4u 14u rgba(2, 4, 12, 0.35); }
  .sf-hud__shop-list { grid-row: 2; padding: 10u; }
  .sf-hud__dt-title { margin-bottom: 6u; }
  .sf-hud__dt-head .sf-slot { --sf-slot: max(42px, 50u); }
  .sf-hud__dt-price { display: inline-flex; }
  .sf-hud__dt-body { margin: 6u -6u 5u 0; }
  .sf-hud__shop-inv { padding: 8u 12u 10u; }
  .sf-hud__shop-hint { display: none; }
  ${HUD_SHOP_CSS_BASE}
}
`),
  ITEM_CATEGORY_ORDER = ["recommend", "attack", "magic", "defense", "boots"],
  BOOT_TIER_LABELS = { 1: "基础鞋", 2: "进阶鞋" },
  ITEM_CATEGORY_LABELS = { attack: "攻击装备", magic: "法术装备", defense: "防御装备", boots: "鞋" },
  TOAST_HOLD_SECONDS = 2.6,
  KILLFEED_INTERVAL_SECONDS = 1.2,
  TOAST_FADE_SECONDS = 0.3,
  HUD_COMPACT_BREAKPOINT_PX = 320,
  itemBrief = (item) => item.brief ?? formatBriefStats(item.stats, 2),
  itemShortName = (baseId) => ItemTable[baseId].name.slice(-2)

export { HUD_COMPACT_BREAKPOINT_PX, itemShortName, BOOT_TIER_LABELS, KILLFEED_INTERVAL_SECONDS, TOAST_FADE_SECONDS, TOAST_HOLD_SECONDS, itemBrief, HUD_SHOP_CSS_COMPACT, ITEM_CATEGORY_LABELS, ITEM_CATEGORY_ORDER }
