/**
 * 比分牌样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const SCOREBOARD_CSS = expandCssUnits(`
/* ── 比分牌：贴着屏幕上沿的倒梯形，左蓝右红，中间垂下一块计时牌 ── */
.sf-hud__score { position: absolute; left: 50%; top: 0; z-index: 3; transform: translateX(-50%); padding-top: var(--sf-safe-t); filter: drop-shadow(0 4u 10u rgba(2, 4, 12, 0.55)); }
.sf-hud__score-plate {
  position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 356u; height: 40u; padding: 0 22u;
  clip-path: polygon(0 0, 100% 0, calc(100% - 16u) 100%, 16u 100%);
  background:
    linear-gradient(90deg, rgba(232, 199, 122, 0), rgba(255, 231, 173, 0.9) 22%, rgba(255, 231, 173, 0.25) 42%, rgba(255, 231, 173, 0.25) 58%, rgba(255, 231, 173, 0.9) 78%, rgba(232, 199, 122, 0)) left bottom / 100% 1.5px no-repeat,
    linear-gradient(90deg, rgba(34, 104, 214, 0.62), rgba(9, 15, 36, 0.94) 36%, rgba(9, 15, 36, 0.94) 64%, rgba(196, 44, 58, 0.62));
}
/* 击杀数靠近计时牌：蓝侧「队名 塔 击杀」靠右排，红侧镜像 */
.sf-hud__score-side { display: flex; align-items: center; justify-content: flex-end; gap: 9u; min-width: 0; }
.sf-hud__score-side.is-red { flex-direction: row-reverse; }
/* 两位数击杀也要放得下：数字列留足宽度，且不允许被压缩 */
.sf-hud__score-kills { flex: none; font-size: max(20px, 28u); font-weight: 800; line-height: 1; text-shadow: 0 1px 0 rgba(2, 4, 12, 0.9), 0 0 10u currentColor; min-width: 1.35em; text-align: center; }
.is-blue > .sf-hud__score-kills { color: #8cc6ff; }
.is-red > .sf-hud__score-kills { color: #ff8d8d; }
.sf-hud__score-kills.is-bump { animation: sf-hud-bump 0.5s var(--sf-ease-spring); }
.sf-hud__score-towers { display: inline-flex; align-items: center; gap: 3u; font-size: var(--sf-fs-xs); font-weight: 700; color: var(--sf-c-text-2); line-height: 1; }
.sf-hud__score-towers .sf-i { width: 1.25em; height: 1.25em; vertical-align: 0; }
.is-blue > .sf-hud__score-towers .sf-i { color: #6cb6ff; }
.is-red > .sf-hud__score-towers .sf-i { color: #ff7a7a; }
.sf-hud__score-team { font-size: var(--sf-fs-xs); font-weight: 700; letter-spacing: 0.1em; color: var(--sf-c-text-3); line-height: 1; }

.sf-hud__score-mid { position: relative; width: 98u; height: 40u; }
/* 计时牌比两翼多垂下一截：外层金边 + 内层深底，用两层同形裁切叠出描边 */
.sf-hud__clock { position: absolute; left: 50%; top: 0; width: 104u; height: 54u; margin-left: -52u; }
.sf-hud__clock::before, .sf-hud__clock::after { content: ''; position: absolute; clip-path: polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%); }
.sf-hud__clock::before { inset: 0; background: linear-gradient(180deg, rgba(255, 231, 173, 0.25), #f3cf85 70%, #fff4d6); }
.sf-hud__clock::after { inset: 0 1.5px 1.5px; background: linear-gradient(180deg, #0c1530, #16254f 60%, #1c2f60); }
.sf-hud__clock-in { position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; padding-top: 5u; }
.sf-hud__time { font-size: max(15px, 19u); font-weight: 800; line-height: 1.1; color: var(--sf-c-gold-100); letter-spacing: 0.04em; }
.sf-hud__wave { display: inline-flex; align-items: center; gap: 3u; margin-top: 1u; font-size: max(10px, 10.5u); font-weight: 700; line-height: 1.2; color: var(--sf-c-cyan-300); }
.sf-hud__wave .sf-i { width: 1.05em; height: 1.05em; vertical-align: 0; }
.sf-hud__wave.is-soon { color: #fff4d6; animation: sf-hud-blink 0.5s steps(2, jump-none) infinite; }
@keyframes sf-hud-bump { 0% { transform: scale(1.7); filter: brightness(2); } 100% { transform: none; filter: none; } }
@keyframes sf-hud-blink { 50% { opacity: 0.45; } }

/* ── 右上角 ── */
.sf-hud__tr { position: absolute; right: var(--hud-r); top: var(--hud-t); z-index: 3; display: flex; align-items: center; gap: 6u; }
.sf-hud__kda { gap: 4u; }
.sf-hud__kda b { font-weight: 800; }
.sf-hud__kda .is-d { color: #ff8d8d; }
.sf-hud__kda .is-a { color: var(--sf-c-text-2); }
.sf-hud__kda i { font-style: normal; color: var(--sf-c-text-4); margin: 0 -1u; }
.sf-hud__kda-cs { display: inline-flex; align-items: center; gap: 4u; margin-left: 6u; padding-left: 8u; box-shadow: inset 1px 0 0 var(--sf-c-line-strong); color: var(--sf-c-text-2); }
.sf-hud__gold { color: var(--sf-c-gold-200); min-width: 76u; }
.sf-hud__gold.is-pop > b { animation: sf-hud-goldpop 0.45s var(--sf-ease-out); }
.sf-hud__gold > b { display: inline-block; font-weight: 800; transform-origin: left center; }
@keyframes sf-hud-goldpop { 0% { transform: scale(1.35); color: #fff; } 100% { transform: none; } }
.sf-hud__tr .sf-iconbtn { width: max(38px, 40u); height: max(38px, 40u); }
.sf-hud__tr .sf-hud__key { right: -4u; bottom: -8u; min-width: max(15px, 16u); height: max(14px, 15u); font-size: max(9px, 9.5u); }

/* 横屏逐级收紧：屏越窄，比分牌与右上角越挤（按两位数击杀、五位数金币的最坏情况留位置） */
/* ≤920px(主流手机横屏)：去掉队名与补兵 */
@media (orientation: landscape) and (max-width: 920px) {
  .sf-hud__score-plate { width: 300u; padding: 0 20u; }
  .sf-hud__score-team { display: none; }
  .sf-hud__kda-cs { display: none; }
  .sf-hud__gold { min-width: 0; }
  .sf-hud__tr { gap: 5u; }
}
/* ≤700px(小手机)：比分牌只留击杀与计时，右上角再压一压 */
@media (orientation: landscape) and (max-width: 700px) {
  .sf-hud__score-plate { width: 204u; padding: 0 14u; }
  .sf-hud__score-towers { display: none; }
  .sf-hud__kda > .sf-i { display: none; }
  .sf-hud__tr { gap: 4u; }
  .sf-hud__tr .sf-hud__chip { padding: 0 8u; }
}
/* ≤620px(568 宽一类的极小屏)：居中已经放不下，比分牌改为紧贴小地图右侧 */
@media (orientation: landscape) and (max-width: 620px) {
  .sf-hud { --hud-mini: 156u; }
  .sf-hud__score { left: calc(var(--hud-l) + var(--hud-mini) + 6u); transform: none; }
}
/* 竖屏：比分牌挪到小地图右侧，第二行放个人数据与按钮（宽度只有小地图右边那一截，数值牌用紧凑样式） */
@media (orientation: portrait) {
  .sf-hud__score { left: calc(var(--hud-l) + var(--hud-mini) + 8u); right: var(--hud-r); top: 0; transform: none; }
  .sf-hud__score-plate { width: auto; padding: 0 16u; }
  .sf-hud__score-team { display: none; }
  .sf-hud__tr { top: calc(var(--hud-t) + 56u); gap: 4u; }
  .sf-hud__tr .sf-hud__chip { height: max(27px, 31u); padding: 0 7u; gap: 4u; font-size: var(--sf-fs-xs); }
  .sf-hud__kda > .sf-i, .sf-hud__kda-cs { display: none; }
  .sf-hud__gold { min-width: 0; }
  .sf-hud__tr .sf-iconbtn { width: max(36px, 40u); height: max(36px, 40u); }
}
`)

export { SCOREBOARD_CSS }
