/**
 * HUD 侧边栏样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const HUD_SIDEBAR_CSS = expandCssUnits(`
.sf-hud__sb { position: absolute; inset: 0; z-index: 6; display: none; place-items: center; pointer-events: none;
  padding: max(8u, var(--sf-safe-t)) max(12u, var(--sf-safe-r)) max(8u, var(--sf-safe-b)) max(12u, var(--sf-safe-l)); }
.sf-hud__sb.is-open { display: grid; }
.sf-hud__sb.is-pinned { pointer-events: auto; background: rgba(3, 6, 16, 0.4); }
.sf-hud__sb-panel { display: flex; flex-direction: column; width: min(100%, 780u); max-height: 100%; min-height: 0; animation: sf-pop-in 0.2s var(--sf-ease-out) both; }
.sf-hud__sb-head { display: flex; align-items: center; gap: 12u; flex: none; padding: 7u 8u 5u 20u; box-shadow: inset 0 -1px 0 var(--sf-c-line-strong); }
.sf-hud__sb-title { margin: 0; font-size: var(--sf-fs-lg); font-weight: 800; letter-spacing: 0.24em; line-height: 1.3; }
.sf-hud__sb-time { display: inline-flex; align-items: center; gap: 4u; font-size: var(--sf-fs-sm); font-weight: 700; color: var(--sf-c-text-2); margin-right: auto; }
.sf-hud__sb-time .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__sb-hint { font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); }
.sf-hud__sb-close { display: none; }
.sf-hud__sb.is-pinned .sf-hud__sb-close { display: inline-grid; }
.sf-hud__sb.is-pinned .sf-hud__sb-hint { display: none; }
.sf-hud__sb-body { flex: 1; min-height: 0; padding: 6u 12u 10u; --cols: minmax(0, 1.5fr) minmax(64u, 0.8fr) minmax(40u, 0.5fr) minmax(52u, 0.6fr) auto; }
.sf-hud__sb-cols, .sf-hud__sb-row { display: grid; grid-template-columns: var(--cols); align-items: center; gap: 0 10u; padding: 0 8u 0 6u; }
.sf-hud__sb-cols { height: 20u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.08em; }
.sf-hud__sb-cols span { white-space: nowrap; }
.sf-hud__sb-short { display: none; }
.sf-hud__sb-cols > :not(:first-child), .sf-hud__sb-row > :not(:first-child) { text-align: center; justify-self: center; }
.sf-hud__sb-team { display: flex; align-items: center; gap: 12u; height: 25u; margin-top: 3u; padding: 0 10u; border-radius: 5u 5u 0 0; font-size: var(--sf-fs-sm); font-weight: 800; letter-spacing: 0.12em; }
.sf-hud__sb-team.is-blue { color: #9ccfff; background: linear-gradient(90deg, rgba(34, 104, 214, 0.5), rgba(34, 104, 214, 0.06)); box-shadow: inset 3px 0 0 var(--sf-c-blue); }
.sf-hud__sb-team.is-red { color: #ff9c9c; background: linear-gradient(90deg, rgba(196, 44, 58, 0.5), rgba(196, 44, 58, 0.06)); box-shadow: inset 3px 0 0 var(--sf-c-red); }
.sf-hud__sb-team span { display: inline-flex; align-items: center; gap: 4u; font-size: var(--sf-fs-xs); font-weight: 700; letter-spacing: 0.02em; color: var(--sf-c-text-2); }
.sf-hud__sb-team .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__sb-row { height: 36u; background: rgba(20, 34, 72, 0.4); box-shadow: inset 0 -1px 0 var(--sf-c-line); font-size: var(--sf-fs-md); font-weight: 700; }
.sf-hud__sb-row:nth-child(odd) { background: rgba(20, 34, 72, 0.22); }
.sf-hud__sb-row.is-me { background: linear-gradient(90deg, rgba(183, 243, 107, 0.2), rgba(183, 243, 107, 0.04)); box-shadow: inset 0 0 0 1px rgba(183, 243, 107, 0.5); }
.sf-hud__sb-hero { display: flex; align-items: center; gap: 9u; min-width: 0; }
.sf-hud__sb-hero .sf-hud__face { --sz: 28u; }
.sf-hud__sb-facebox { position: relative; flex: none; }
.sf-hud__sb-lv { position: absolute; right: -5u; bottom: -4u; display: grid; place-items: center; min-width: max(14px, 15u); height: max(14px, 15u); padding: 0 2u; border-radius: 99px; font-size: max(10px, 10.5u); font-weight: 800; line-height: 1; color: #2b1a04; background: var(--sf-grad-gold); box-shadow: 0 0 0 1.5px #0a1128; }
.sf-hud__sb-name { display: inline-flex; align-items: center; gap: 3u; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sf-hud__sb-rolei { display: none; flex: none; width: 1.15em; height: 1.15em; vertical-align: 0; color: var(--role); }
.sf-hud__sb-respawn { display: none; align-items: center; gap: 3u; flex: none; font-size: var(--sf-fs-xs); color: #ff9c9c; }
.sf-hud__sb-respawn .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__sb-row.is-dead .sf-hud__sb-respawn { display: inline-flex; }
.sf-hud__sb-row.is-dead .sf-hud__sb-name { color: var(--sf-c-text-3); }
.sf-hud__sb-row.is-dead .sf-hud__face > img { filter: grayscale(1) brightness(0.6); }
.sf-hud__sb-kda i { font-style: normal; color: var(--sf-c-text-4); margin: 0 3u; }
.sf-hud__sb-kda .is-d { color: #ff8d8d; }
.sf-hud__sb-kda .is-a { color: var(--sf-c-text-2); }
.sf-hud__sb-gold { color: var(--sf-c-gold-200); }
.sf-hud__sb-items { display: flex; gap: 3u; }
.sf-hud__sb-items .sf-slot { --sf-slot: 25u; border-radius: 4u; box-shadow: 0 0 0 1px rgba(224, 177, 96, 0.5); }
.sf-hud__sb-items .sf-slot--empty { box-shadow: inset 0 0 0 1px var(--sf-c-line); }

@media (orientation: landscape) and (max-height: 470px) {
  .sf-hud__sb-row { height: 31u; }
  .sf-hud__sb-team { height: 22u; }
  .sf-hud__sb-head { padding-top: 4u; padding-bottom: 3u; }
  .sf-hud__sb-body { padding-bottom: 6u; }
  .sf-hud__sb-hero .sf-hud__face { --sz: 25u; }
  .sf-hud__sb-items .sf-slot { --sf-slot: 23u; }
}
/* 竖屏：装备换到第二行，其余列收窄 */
@media (orientation: portrait) {
  .sf-hud__sb-body { padding: 6u 8u 10u; --cols: minmax(0, 1.5fr) minmax(70u, 0.9fr) minmax(34u, 0.4fr) minmax(46u, 0.5fr); }
  .sf-hud__sb-cols > :last-child { display: none; }
  .sf-hud__sb-long { display: none; }
  .sf-hud__sb-short { display: inline; }
  .sf-hud__sb-row { height: auto; padding-top: 5u; padding-bottom: 5u; row-gap: 4u; }
  .sf-hud__sb-items { grid-column: 1 / -1; justify-self: start !important; padding-left: 37u; }
  .sf-hud__sb-items .sf-slot { --sf-slot: 22u; }
  .sf-hud__sb-hint { display: none; }
  .sf-hud__sb-name .sf-heroname__role { display: none; }
  .sf-hud__sb-rolei { display: inline-block; }
}
`)

export { HUD_SIDEBAR_CSS }
