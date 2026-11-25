/**
 * 操作说明面板样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const HOWTO_PANEL_CSS = expandCssUnits(`
.sf-howto { display: flex; flex-direction: column; gap: 14u; }
.sf-howto__pane { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 22u; align-items: center; animation: sf-fade-in 0.25s linear both; }
.sf-howto__fig { display: flex; align-items: center; justify-content: center; gap: 18u; padding: 16u; min-width: 0; }
.sf-howto__list { display: flex; flex-direction: column; gap: 9u; margin: 0; padding: 0; list-style: none; min-width: 0; }
.sf-howto__list li { display: grid; grid-template-columns: auto 1fr; gap: 3u 10u; align-items: baseline; font-size: var(--sf-fs-sm); line-height: 1.55; color: var(--sf-c-text-2); }
.sf-howto__list b { font-weight: 700; font-size: var(--sf-fs-md); color: var(--sf-c-text); letter-spacing: 0.08em; white-space: nowrap; }
.sf-howto__list em { font-style: normal; color: var(--sf-c-gold-200); }
.sf-howto__dot { display: inline-grid; place-items: center; width: max(18px, 20u); height: max(18px, 20u); border-radius: 50%; transform: translateY(0.2em); font-family: var(--sf-font-num); font-weight: 700; font-size: var(--sf-fs-xs); color: #08101f; background: var(--tone); box-shadow: 0 0 8u var(--tone); }
.sf-howto [data-tone='move'] { --tone: #5cd6f7; }
.sf-howto [data-tone='atk'] { --tone: #ff8a7a; }
.sf-howto [data-tone='skill'] { --tone: #f3cf85; }
.sf-howto [data-tone='sum'] { --tone: #6fe3a1; }
.sf-howto [data-tone='ui'] { --tone: #b9a2ff; }

/* 键盘示意 */
.sf-keys { display: grid; grid-template-columns: repeat(13, max(13px, 15u)); grid-auto-rows: max(26px, 30u); gap: max(3px, 4u); }
.sf-key {
  display: grid; place-items: center; border-radius: 5u; font-family: var(--sf-font-num); font-weight: 700; font-size: var(--sf-fs-xs); line-height: 1; color: var(--sf-c-text-4);
  background: rgba(20, 34, 72, 0.6); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.16), 0 2u 0 rgba(4, 8, 22, 0.8);
}
.sf-key[data-tone] { color: #08101f; background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 70%, #fff), var(--tone)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 2u 0 rgba(4, 8, 22, 0.8), 0 0 10u color-mix(in srgb, var(--tone) 55%, transparent); }
.sf-mouse { width: max(58px, 76u); flex: none; }
.sf-mouse svg { display: block; width: 100%; height: auto; overflow: visible; }
.sf-mouse text, .sf-touchfig text { font-family: var(--sf-font-num); font-weight: 700; }

/* 触控示意 */
.sf-touchfig { width: 100%; max-width: max(300px, 430u); }
.sf-touchfig svg { display: block; width: 100%; height: auto; }

/* 「怎么赢」：示意地图 + 带图例记号的说明 */
.sf-winfig { display: flex; flex-direction: column; align-items: center; gap: 4u; width: 100%; }
.sf-winfig svg { display: block; width: 100%; max-width: max(210px, 300u); height: auto; }
.sf-winfig text { font-family: var(--sf-font); font-weight: 700; }
.sf-winfig p { margin: 0; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); text-align: center; }
.sf-howto__glyph { display: inline-block; width: max(18px, 20u); height: max(18px, 20u); transform: translateY(0.25em); }
.sf-howto__glyph svg { display: block; width: 100%; height: 100%; overflow: visible; }
.sf-howto__pane--win { align-items: start; }
.sf-howto__pane--win .sf-howto__list { gap: 7u; }

@media (orientation: portrait), (max-width: 620px) {
  .sf-howto__pane { grid-template-columns: 1fr; gap: 14u; }
  .sf-winfig svg { max-width: min(62vw, 250px); }
}
@media (max-height: 480px) and (orientation: landscape) {
  .sf-howto { gap: 8u; }
  .sf-howto__fig { padding: 8u; }
  .sf-howto__list { gap: 5u; }
  .sf-howto__pane--win { grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr); gap: 12u; }
  .sf-howto__pane--win .sf-howto__list { gap: 3u; }
  .sf-howto__pane--win .sf-howto__list li { line-height: 1.4; }
  .sf-winfig svg { max-width: 164px; }
  .sf-winfig p { display: none; }
}
`)

export { HOWTO_PANEL_CSS }
