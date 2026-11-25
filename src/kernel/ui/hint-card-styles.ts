/**
 * 提示卡样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const HINT_CARD_CSS = expandCssUnits(`
/* ── 提示卡 ── */
.sf-hud__gcard {
  --edge: 232, 199, 122;
  display: none; width: 100%; box-sizing: border-box; padding: 6u 8u 7u 11u; border-radius: 10u; background: var(--hud-plate);
  box-shadow: inset 0 0 0 1px rgba(var(--edge), 0.55), inset 0 1px 0 1px rgba(143, 233, 255, 0.12), 0 6u 18u rgba(2, 4, 12, 0.5);
}
.sf-hud__gcard.is-on { display: block; }
.sf-hud__gcard.is-in { animation: sf-hud-gcard-in 0.26s var(--sf-ease-out) both; }
.sf-hud__gcard-head { display: flex; align-items: center; gap: 7u; min-height: max(22px, 24u); }
.sf-hud__gcard-badge {
  flex: none; display: inline-grid; place-items: center; min-width: max(30px, 34u); height: max(17px, 19u); padding: 0 5u; border-radius: 99px;
  font-family: var(--sf-font-num); font-weight: 800; font-size: max(10px, 11u); line-height: 1; letter-spacing: 0.04em; color: #06202c; background: linear-gradient(180deg, #c9f6ff, #5cd6f7);
}
.sf-hud__gcard-badge .sf-i { width: 1.2em; height: 1.2em; vertical-align: 0; }
.sf-hud__gcard-title { font-size: var(--sf-fs-sm); font-weight: 800; letter-spacing: 0.08em; line-height: 1.2; color: var(--sf-c-gold-200); white-space: nowrap; text-shadow: var(--hud-shadow-text); }
.sf-hud__gcard-dots { display: flex; align-items: center; gap: max(3px, 4u); margin-left: auto; }
.sf-hud__gcard-dots > i { width: max(6px, 7u); height: max(6px, 7u); border-radius: 50%; background: rgba(150, 178, 235, 0.22); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.55); }
.sf-hud__gcard-dots > i.is-done { background: #ffe7ad; box-shadow: 0 0 0 1px #6b4614, 0 0 5u rgba(255, 214, 130, 0.85); }
.sf-hud__gcard-dots > i.is-cur { background: #5cd6f7; box-shadow: 0 0 0 max(2px, 2u) rgba(92, 214, 247, 0.32); }
.sf-hud__gcard-skip {
  position: relative; flex: none; margin: 0 0 0 4u; padding: 0 10u; min-width: 64px; height: max(32px, 30u); border: 0; border-radius: 99px; cursor: pointer;
  font: inherit; font-size: var(--sf-fs-xs); font-weight: 700; line-height: 1; color: var(--sf-c-text-2); background: rgba(150, 178, 235, 0.16); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.3);
}
/* 手指的落点比按钮再大一圈(上下左右各外扩 8px)；卡片其余部分仍不拦截指针 */
.sf-hud__gcard-skip::after { content: ''; position: absolute; inset: -8px; }
@media (hover: hover) { .sf-hud__gcard-skip:hover { color: var(--sf-c-text); background: rgba(150, 178, 235, 0.28); } }
.sf-hud__gcard-skip:active { transform: scale(0.94); }
.sf-hud__gcard-body { margin-top: 3u; font-size: var(--sf-fs-sm); font-weight: 600; line-height: 1.55; color: var(--sf-c-text); text-shadow: var(--hud-shadow-text); }
.sf-hud__gcard-body b { color: var(--sf-c-gold-200); font-weight: 800; }
.sf-hud__gcard-body .sf-kbd { min-width: max(19px, 21u); height: max(19px, 21u); padding: 0 5u; margin: 0 1u; vertical-align: -0.28em; font-size: max(11px, 11.5u); color: var(--sf-c-gold-100); }
/* 做到了：徽标变绿打勾，卡片亮一下 */
.sf-hud__gcard.is-done { --edge: 111, 227, 161; animation: sf-hud-gcard-done 0.6s ease-out both; }
.sf-hud__gcard.is-done .sf-hud__gcard-badge { color: #052414; background: linear-gradient(180deg, #c8ffe0, #6fe3a1); }
.sf-hud__gcard.is-done .sf-hud__gcard-title { color: #b9f5d2; }
/* 小贴士 / 结束语 */
.sf-hud__gcard.is-tip { --edge: 92, 214, 247; }
.sf-hud__gcard.is-tip .sf-hud__gcard-title { color: var(--sf-c-cyan-300); }
.sf-hud__gcard.is-warn { --edge: 255, 184, 77; }
.sf-hud__gcard.is-warn .sf-hud__gcard-badge { color: #2b1a04; background: linear-gradient(180deg, #ffe2a6, #ffb84d); }
.sf-hud__gcard.is-warn .sf-hud__gcard-title { color: #ffd08a; }
.sf-hud__gcard.is-outro .sf-hud__gcard-skip { display: none; }
@keyframes sf-hud-gcard-in { from { opacity: 0; transform: translateY(-8u); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-gcard-done { 0% { filter: brightness(1.9); } 100% { filter: none; } }

/* ── 控件光圈 ── */
.sf-hud__gglow { position: absolute; inset: -9%; z-index: 4; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 max(2px, 2.5u) #5cd6f7, 0 0 14u rgba(92, 214, 247, 0.85), inset 0 0 10u rgba(92, 214, 247, 0.4); }
.sf-hud__gglow::before, .sf-hud__gglow::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 max(2px, 2u) rgba(143, 233, 255, 0.95); animation: sf-hud-gglow 1.2s ease-out infinite; }
.sf-hud__gglow::after { animation-delay: 0.6s; }
/* 摇杆空闲时是半透明的：被点名时提到全亮 */
.sf-hud__joy.is-guide-host { opacity: 1; }
@keyframes sf-hud-gglow { from { transform: scale(1); opacity: 0.95; } to { transform: scale(1.5); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .sf-hud__gglow::before, .sf-hud__gglow::after { animation: none; opacity: 0; } }
/* 竖屏 / 小屏：卡片内边距收一点 */
@media (max-width: 480px) { .sf-hud__gcard { padding: 5px 6px 6px 9px; } .sf-hud__gcard-head { gap: 6px; } }
/* 手机横屏(屏高不足 460px)：卡片正下方就是玩家英雄头顶的血条，再往北是正在交手的敌人，三行的卡片会把它们盖住。
   压成一行：徽标(第几课) + 正文 + 跳过；课名与进度点收起。正文短的一行放下，长的折成两行，都比原来矮一行 */
@media (orientation: landscape) and (max-height: 460px) {
  .sf-hud__gcard { padding: 4px 6px 4px 8px; }
  .sf-hud__gcard.is-on { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 7px; }
  .sf-hud__gcard-head { display: contents; }
  .sf-hud__gcard-title, .sf-hud__gcard-dots { display: none; }
  .sf-hud__gcard-badge { grid-column: 1; grid-row: 1; align-self: center; }
  .sf-hud__gcard-body { grid-column: 2; grid-row: 1; margin-top: 0; line-height: 1.4; }
  .sf-hud__gcard-skip { grid-column: 3; grid-row: 1; align-self: center; height: 32px; margin: 0; }
}
`)

export { HINT_CARD_CSS }
