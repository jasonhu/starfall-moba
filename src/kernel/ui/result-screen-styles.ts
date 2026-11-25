/**
 * 结算页样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const RESULT_SCREEN_CSS = expandCssUnits(`
.sf-result { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10u; padding: max(10u, var(--sf-safe-t)) max(28u, var(--sf-safe-r)) max(14u, var(--sf-safe-b)) max(28u, var(--sf-safe-l)); background: rgba(3, 6, 16, 0.35); --tone: var(--sf-c-gold-200); --tone-rgb: 255, 214, 130; }
.sf-result--lose { --tone: #9fb0d0; --tone-rgb: 150, 170, 215; }

/* ── 标题横幅 ── */
.sf-result__banner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2u; padding-top: 2u; isolation: isolate; }
.sf-result__rays { --r: max(190px, 380u); position: absolute; left: calc(50% - var(--r)); top: calc(46% - var(--r)); width: calc(var(--r) * 2); height: calc(var(--r) * 2); z-index: -1; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, rgba(var(--tone-rgb), 0.2) 0deg 5deg, rgba(var(--tone-rgb), 0) 5deg 15deg);
  -webkit-mask-image: radial-gradient(circle, #000 0, rgba(0, 0, 0, 0.5) 22%, transparent 62%); mask-image: radial-gradient(circle, #000 0, rgba(0, 0, 0, 0.5) 22%, transparent 62%);
  animation: sf-spin 60s linear infinite; }
.sf-result--lose .sf-result__rays { display: none; }
.sf-result__titlewrap { position: relative; }
.sf-result__title { position: relative; margin: 0; font-weight: 900; font-size: max(44px, 84u); line-height: 1.08; letter-spacing: 0.34em; margin-right: -0.34em; white-space: nowrap; }
.sf-result--win .sf-result__title { filter: drop-shadow(0 max(1px, 2u) 0 #6b4614) drop-shadow(0 max(2px, 5u) 0 rgba(24, 12, 0, 0.75)) drop-shadow(0 0 34u rgba(255, 200, 110, 0.6)); animation: sf-result-win 0.9s var(--sf-ease-out) both; }
.sf-result--lose .sf-result__title { background-image: linear-gradient(180deg, #e3ebfb 0%, #9fb0d0 38%, #56648a 56%, #3a4566 62%, #8a6470 84%, #c98a92 100%); filter: drop-shadow(0 max(1px, 2u) 0 #10162c) drop-shadow(0 max(2px, 5u) 0 rgba(0, 0, 0, 0.7)) drop-shadow(0 0 26u rgba(182, 60, 70, 0.35)); animation: sf-result-lose 1.1s var(--sf-ease-out) both; }
@keyframes sf-result-win { 0% { opacity: 0; transform: scale(2.4); filter: brightness(3); } 55% { opacity: 1; transform: scale(0.96); } 100% { opacity: 1; transform: none; } }
@keyframes sf-result-lose { 0% { opacity: 0; transform: translateY(-40u) rotate(-2deg); } 55% { opacity: 1; transform: translateY(4u) rotate(0.6deg); } 100% { opacity: 1; transform: none; } }
.sf-result__wing { position: absolute; top: 50%; width: max(60px, 190u); height: 2px; background: linear-gradient(90deg, rgba(var(--tone-rgb), 0), var(--tone)); animation: sf-fade-in 0.8s 0.5s linear both; }
.sf-result__wing::after { content: ''; position: absolute; right: -4u; top: 50%; width: 8u; height: 8u; margin-top: -4u; transform: rotate(45deg); background: var(--tone); box-shadow: 0 0 10u var(--tone); }
.sf-result__wing--l { right: calc(100% + 26u); }
.sf-result__wing--r { left: calc(100% + 26u - 0.34em); transform: scaleX(-1); }
.sf-result__sub { display: none; margin: 0; font-size: var(--sf-fs-sm); letter-spacing: 0.4em; margin-right: -0.4em; color: var(--sf-c-text-2); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); animation: sf-rise-in 0.6s 0.45s var(--sf-ease-out) both; }
.sf-result__summary { display: flex; align-items: center; gap: 18u; margin-top: 2u; animation: sf-rise-in 0.6s 0.55s var(--sf-ease-out) both; }
.sf-result__vs { display: flex; align-items: center; gap: 12u; font-size: max(20px, 30u); font-weight: 800; line-height: 1; }
.sf-result__vs b { font-family: var(--sf-font-num); }
.sf-result__vs .is-blue { color: var(--sf-c-blue); text-shadow: 0 0 12u rgba(77, 163, 255, 0.6); }
.sf-result__vs .is-red { color: var(--sf-c-red); text-shadow: 0 0 12u rgba(255, 93, 93, 0.6); }
.sf-result__vs .sf-i { width: 0.8em; height: 0.8em; color: var(--sf-c-text-3); }
.sf-result__vs small { font-weight: 600; font-size: var(--sf-fs-xs); letter-spacing: 0.14em; color: var(--sf-c-text-3); }
.sf-result__chip { display: inline-flex; align-items: center; gap: 6u; font-size: var(--sf-fs-sm); letter-spacing: 0.08em; color: var(--sf-c-text-2); white-space: nowrap; }
.sf-result__chip .sf-i { color: var(--sf-c-gold-300); }
.sf-result__chip b { font-family: var(--sf-font-num); font-size: var(--sf-fs-md); color: var(--sf-c-text); }

/* ── 战绩表 ── */
.sf-result__board { display: flex; flex-direction: column; min-height: 0; animation: sf-rise-in 0.6s 0.65s var(--sf-ease-out) both; }
.sf-result__scroll { flex: 1; min-height: 0; padding: 6u 12u 8u; }
.sf-rt { --cols: minmax(0, 1.7fr) 100u 52u 74u minmax(0, 1.05fr) minmax(0, 0.9fr) 70u auto 62u; display: flex; flex-direction: column; gap: 3u; min-width: 0; }
.sf-rt__head, .sf-rt__row { display: grid; grid-template-columns: var(--cols); align-items: center; column-gap: 10u; padding: 0 10u; }
.sf-rt__head { position: sticky; top: 0; z-index: 2; height: max(22px, 24u); font-size: var(--sf-fs-xs); letter-spacing: 0.12em; color: var(--sf-c-text-3); background: linear-gradient(180deg, #0d1736 70%, rgba(13, 23, 54, 0)); }
.sf-rt__head > span { white-space: nowrap; }
.sf-rt__c { text-align: center; }
.sf-rt__items-h { width: calc(max(24px, 29u) * 6 + max(3px, 4u) * 5); text-align: center; }
.sf-rt__h-short { display: none; }
.sf-rt__team { display: flex; align-items: center; gap: 14u; height: max(22px, 26u); padding: 0 10u; margin-top: 4u; border-radius: 5u; font-size: var(--sf-fs-xs); letter-spacing: 0.1em; color: var(--sf-c-text-2); background: linear-gradient(90deg, rgba(var(--team-rgb), 0.3), rgba(var(--team-rgb), 0.04) 70%); box-shadow: inset max(3px, 3u) 0 0 rgb(var(--team-rgb)); }
.sf-rt__team:first-of-type { margin-top: 0; }
.sf-rt__team b { font-weight: 800; font-size: var(--sf-fs-sm); letter-spacing: 0.2em; color: rgb(var(--team-rgb)); }
.sf-rt__team span { display: inline-flex; align-items: center; gap: 4u; white-space: nowrap; }
.sf-rt__team .sf-num { font-size: var(--sf-fs-sm); color: var(--sf-c-text); }
.sf-rt__team .sf-badge { margin-left: auto; }
.sf-rt__row { position: relative; min-height: max(34px, 37u); border-radius: 6u; background: rgba(20, 34, 72, 0.4); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.08); font-size: var(--sf-fs-sm); animation: sf-rise-in 0.4s var(--sf-ease-out) both; }
.sf-rt__row.is-me { background: linear-gradient(90deg, rgba(183, 243, 107, 0.2), rgba(183, 243, 107, 0.05) 60%, rgba(20, 34, 72, 0.4)); box-shadow: inset 0 0 0 1px rgba(183, 243, 107, 0.5), inset max(3px, 3u) 0 0 var(--sf-c-me); }
.sf-rt__row.is-mvp:not(.is-me) { background: linear-gradient(90deg, rgba(255, 214, 130, 0.16), rgba(20, 34, 72, 0.4) 55%); box-shadow: inset 0 0 0 1px rgba(255, 214, 130, 0.38); }
.sf-rt__hero { display: flex; align-items: center; gap: 9u; min-width: 0; }
.sf-rt__pic-wrap { position: relative; flex: none; }
.sf-rt__pic { width: max(28px, 31u); height: max(28px, 31u); border-radius: 6u; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(1.5px, 2u) rgba(var(--team-rgb), 0.8); }
.sf-rt__lv { position: absolute; right: -5u; bottom: -4u; min-width: max(15px, 17u); height: max(15px, 17u); padding: 0 3u; display: grid; place-items: center; border-radius: 99px; font-family: var(--sf-font-num); font-weight: 700; font-size: max(10px, 11u); line-height: 1; color: var(--sf-c-gold-100); background: #0a1128; box-shadow: 0 0 0 1px var(--sf-c-gold-500); }
.sf-rt__name { flex: none; font-weight: 700; font-size: var(--sf-fs-md); letter-spacing: 0.08em; color: var(--sf-c-text); white-space: nowrap; }
.sf-rt__badges { display: flex; align-items: center; gap: 4u; min-width: 0; overflow: hidden; }
.sf-rt__cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2u; min-width: 0; text-align: center; }
.sf-rt__lab { display: none; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.06em; }
.sf-rt__val { font-family: var(--sf-font-num); font-variant-numeric: tabular-nums; font-size: var(--sf-fs-md); color: var(--sf-c-text); white-space: nowrap; }
.sf-rt__kda { letter-spacing: 0.04em; }
.sf-rt__kda i { font-style: normal; color: var(--sf-c-text-4); margin: 0 0.18em; }
.sf-rt__kda .is-d { color: #ff9a9a; }
.sf-rt__kda .is-a { color: var(--sf-c-text-2); }
.sf-rt__gold { color: var(--sf-c-gold-200); }
.sf-rt__bar { width: 100%; max-width: 110u; height: max(3px, 4u); border-radius: 99px; background: rgba(4, 8, 22, 0.7); overflow: hidden; }
.sf-rt__bar i { display: block; height: 100%; width: calc(var(--v) * 100%); border-radius: inherit; background: rgb(var(--team-rgb)); transform-origin: 0 50%; animation: sf-bar-grow 0.9s 0.9s var(--sf-ease-out) both; }
.sf-rt__bar--taken i { background: #9fb0d0; }
@keyframes sf-bar-grow { from { transform: scaleX(0); } to { transform: none; } }
.sf-rt__items { display: flex; gap: max(3px, 4u); }
.sf-rt__items .sf-slot { --sf-slot: max(24px, 29u); border-radius: 5u; box-shadow: 0 0 0 1px rgba(150, 178, 235, 0.3); }
.sf-rt__items .sf-slot--empty { box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.16); }
.sf-rt__score .sf-rt__val { font-weight: 700; font-size: var(--sf-fs-lg); color: var(--sf-c-text); }
.sf-rt__row.is-mvp .sf-rt__score .sf-rt__val { color: var(--sf-c-gold-200); text-shadow: 0 0 10u rgba(255, 214, 130, 0.6); }

.sf-result__actions { display: flex; justify-content: center; gap: 16u; animation: sf-rise-in 0.6s 0.8s var(--sf-ease-out) both; }
.sf-result__actions .sf-btn { min-width: max(150px, 220u); }
.sf-result-root.is-closing { animation: sf-fade-out 0.35s linear both; pointer-events: none; }

/* ── 矮屏（横屏手机）：横幅压成一行 ── */
@media (max-height: 520px) and (orientation: landscape) {
  .sf-result { gap: 6u; padding-top: max(4u, var(--sf-safe-t)); padding-bottom: max(8u, var(--sf-safe-b)); }
  .sf-result__banner { flex-direction: row; justify-content: center; gap: 22u; }
  .sf-result__title { font-size: max(34px, 52u); }
  .sf-result__wing { display: none; }
  .sf-rt__h-full { display: none; }
  .sf-rt__h-short { display: inline; }
  .sf-result__summary { margin-top: 0; }
  .sf-result__rays { top: calc(50% - var(--r)); }
  .sf-rt { --cols: minmax(0, 1.5fr) 92u 46u 66u minmax(0, 1fr) minmax(0, 0.85fr) 62u auto 54u; }
  .sf-rt__head, .sf-rt__row { column-gap: 7u; padding: 0 8u; }
  .sf-result__actions .sf-btn { --sf-btn-h: max(40px, 46u); }
  /* 英雄列窄：只留名字(职业看头像)，把地方让给「你 / MVP」徽标 */
  .sf-rt__name .sf-heroname__role { display: none; }
}

/* ── 小横屏（如 667×375）：去掉补兵与推塔两列，保持一行一人 ── */
@media (orientation: landscape) and (max-width: 780px) {
  .sf-rt { --cols: minmax(0, 1.5fr) 84u minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 0.9fr) auto 50u; }
  .sf-rt__cell[data-c='cs'], .sf-rt__cell[data-c='tower'], .sf-rt__head > [data-c='cs'], .sf-rt__head > [data-c='tower'] { display: none; }
  .sf-rt__items { gap: 2px; }
  .sf-rt__items .sf-slot { --sf-slot: 22px; }
  .sf-rt__items-h { width: 142px; }
  .sf-rt__badges .sf-badge { padding: 0 4u; }
  .sf-result__chip:last-child { display: none; }
}

/* ── 竖屏：每位英雄一张卡片 ── */
@media (orientation: portrait) {
  .sf-result { padding-left: max(10u, var(--sf-safe-l)); padding-right: max(10u, var(--sf-safe-r)); }
  .sf-result__sub { display: block; }
  .sf-result__summary { flex-wrap: wrap; justify-content: center; gap: 6u 16u; margin-top: 6u; }
  .sf-result__wing { display: none; }
  .sf-result__scroll { padding: 8u; }
  .sf-rt { gap: 6u; }
  .sf-rt__head { display: none; }
  .sf-rt__row { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: 'hero hero score' 'kda cs gold' 'dmg taken tower' 'items items items'; row-gap: 7u; padding: 9u 10u; }
  .sf-rt__hero { grid-area: hero; }
  .sf-rt__score { grid-area: score; align-items: flex-end; }
  .sf-rt__cell[data-c='kda'] { grid-area: kda; }
  .sf-rt__cell[data-c='cs'] { grid-area: cs; }
  .sf-rt__cell[data-c='gold'] { grid-area: gold; }
  .sf-rt__cell[data-c='dmg'] { grid-area: dmg; }
  .sf-rt__cell[data-c='taken'] { grid-area: taken; }
  .sf-rt__cell[data-c='tower'] { grid-area: tower; }
  .sf-rt__items { grid-area: items; justify-content: flex-start; }
  .sf-rt__items .sf-slot { --sf-slot: max(30px, 36u); }
  .sf-rt__lab { display: block; }
  .sf-rt__cell { flex-direction: row; justify-content: flex-start; gap: 6u; flex-wrap: wrap; }
  .sf-rt__score { flex-direction: row; justify-content: flex-end; }
  .sf-rt__bar { flex-basis: 100%; max-width: none; }
  .sf-result__actions { gap: 10u; }
  .sf-result__actions .sf-btn { flex: 1; min-width: 0; padding: 0 10u; }
}
`)

export { RESULT_SCREEN_CSS }
