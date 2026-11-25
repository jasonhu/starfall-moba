/**
 * HUD 状态栏样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { statusEffects, expandCssUnits } from './dom-kit'

const HUD_STAT_CSS = expandCssUnits(`
.sf-hud { --hud-lift: 0px; }
.sf-hud__status {
  --w: 458u;
  position: absolute; bottom: 0; z-index: 3; left: min(50%, calc(100% - var(--hud-cw) - var(--w) / 2 - 6u)); transform: translateX(-50%);
  display: flex; align-items: flex-end; gap: 8u; width: var(--w); padding: 7u 10u max(6u, var(--sf-safe-b)); border-radius: 12u 12u 0 0;
  background: var(--hud-plate); box-shadow: 0 -4u 16u rgba(2, 4, 12, 0.5), inset 0 1px 0 rgba(143, 233, 255, 0.12);
}
/* 上沿的金色星轨线：中间亮，向两侧渐隐 */
.sf-hud__status::before { content: ''; position: absolute; left: 10u; right: 10u; top: 0; height: 1.5px; pointer-events: none; background: linear-gradient(90deg, rgba(255, 231, 173, 0), rgba(255, 231, 173, 0.95) 18%, rgba(224, 177, 96, 0.35) 50%, rgba(255, 231, 173, 0.95) 82%, rgba(255, 231, 173, 0)); }
.sf-hud__status.is-dead .sf-hud__st-bars, .sf-hud__status.is-dead .sf-hud__st-items { filter: saturate(0.25) brightness(0.8); }

/* ── 头像 ── */
.sf-hud__st-por { position: relative; flex: none; width: 62u; height: 62u; margin: -18u 2u 2u 2u; }
.sf-hud__st-por > .sf-portrait { width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 0 0 max(2px, 2.5u) #0a1128, 0 0 0 max(3.5px, 4.5u) var(--sf-c-gold-400), 0 0 14u rgba(255, 214, 130, 0.35), 0 4u 10u rgba(0, 0, 0, 0.6); transition: filter 0.4s linear; }
.sf-hud__status.is-dead .sf-hud__st-por > .sf-portrait { filter: grayscale(1) brightness(0.55); }
.sf-hud__st-respawn { position: absolute; inset: 0; display: none; place-items: center; font-size: max(20px, 27u); font-weight: 800; color: #fff; text-shadow: 0 1px 3px #000, 0 0 12u rgba(255, 93, 93, 0.9); }
.sf-hud__status.is-dead .sf-hud__st-respawn { display: grid; }
.sf-hud__st-lv {
  position: absolute; right: -5u; bottom: -3u; display: grid; place-items: center; min-width: max(20px, 23u); height: max(20px, 23u); padding: 0 3u; border-radius: 50%;
  font-size: max(11px, 13u); font-weight: 800; line-height: 1; color: #2b1a04; background: var(--sf-grad-gold); box-shadow: 0 0 0 max(1.5px, 2u) #0a1128, 0 2u 5u rgba(0, 0, 0, 0.6);
}
.sf-hud__st-lv.is-up { animation: sf-hud-lvup 0.9s var(--sf-ease-out); }
@keyframes sf-hud-lvup { 0% { transform: scale(2.2); box-shadow: 0 0 0 2px #0a1128, 0 0 0 0 rgba(255, 244, 214, 0.95); } 60% { transform: scale(0.94); } 100% { transform: none; box-shadow: 0 0 0 2px #0a1128, 0 0 0 22u rgba(255, 244, 214, 0); } }
.sf-hud__st-passive { --sf-slot: max(22px, 25u); position: absolute; left: -6u; bottom: -4u; }
/* 名签：压在头像上沿正中，职业图标(职业色) + 名字 */
.sf-hud__st-name {
  position: absolute; left: 50%; top: -9u; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 2u; height: max(15px, 16u); padding: 0 6u 0 4u; border-radius: 99px; pointer-events: none;
  font-size: max(10px, 11u); font-weight: 800; line-height: 1; letter-spacing: 0.06em; white-space: nowrap; color: var(--sf-c-text);
  background: rgba(6, 10, 24, 0.9); box-shadow: 0 0 0 1px var(--sf-c-gold-line), 0 1px 3px rgba(0, 0, 0, 0.6);
}
.sf-hud__st-name .sf-i { width: 1.15em; height: 1.15em; vertical-align: 0; color: var(--role, var(--sf-c-gold-300)); }

/* ── 生命 / 法力 / 经验 ── */
.sf-hud__st-bars { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3u; }
.sf-hud__st-stats { display: flex; align-items: baseline; justify-content: space-between; gap: 4u; height: max(13px, 14u); padding: 0 2u; font-size: max(10px, 11u); line-height: 1; color: var(--sf-c-text-3); white-space: nowrap; cursor: default; }
.sf-hud__st-stats b { margin-left: 2u; font-weight: 700; color: var(--sf-c-text); }
.sf-hud__bar { --p: 1; --s: 0; --seg: 100%; position: relative; height: 20u; border-radius: 4u; overflow: hidden; background: rgba(3, 6, 16, 0.82); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.3); }
.sf-hud__bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transform-origin: left center; }
.sf-hud__bar-trail { background: linear-gradient(180deg, #ffd9c9, #ff7a5c); transform: scaleX(var(--p)); transition: transform 0.55s cubic-bezier(0.3, 0, 0.2, 1) 0.2s; }
.sf-hud__bar-fill { transform: scaleX(var(--p)); transition: transform 0.12s linear; }
.is-hp > .sf-hud__bar-fill { background: linear-gradient(180deg, #a6f7c0 0%, #4fd98a 38%, #1f9d58 100%); }
.is-hp.is-mid > .sf-hud__bar-fill { background: linear-gradient(180deg, #ffe7a6 0%, #f3bb48 38%, #c07e16 100%); }
.is-hp.is-low > .sf-hud__bar-fill { background: linear-gradient(180deg, #ffb8a8 0%, #f0584f 38%, #a8222d 100%); }
.is-mp > .sf-hud__bar-fill { background: linear-gradient(180deg, #a9d6ff 0%, #4da3ff 40%, #1e5fc4 100%); }
.sf-hud__bar-shield { transform: translateX(calc(var(--p) * 100%)) scaleX(var(--s)); background: linear-gradient(180deg, #ffffff, #cfe2ff); transition: transform 0.12s linear; }
/* 每 1000 生命一道刻度：血厚的英雄一眼能看出来 */
.sf-hud__bar-ticks { background: repeating-linear-gradient(90deg, rgba(3, 6, 16, 0) 0, rgba(3, 6, 16, 0) calc(var(--seg) - 1px), rgba(3, 6, 16, 0.6) calc(var(--seg) - 1px), rgba(3, 6, 16, 0.6) var(--seg)); }
.sf-hud__bar-gloss { background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 48%, rgba(0, 0, 0, 0.16)); }
.sf-hud__bar-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5u; font-size: max(11px, 12.5u); font-weight: 800; line-height: 1; color: #fff; text-shadow: 0 1px 1px rgba(2, 4, 12, 0.95), 0 0 4u rgba(2, 4, 12, 0.9); white-space: nowrap; }
.sf-hud__bar-text em { font-style: normal; color: #dff0ff; }
.sf-hud__bar-text em:empty { display: none; }
.sf-hud__bar.is-mp { height: 13u; }
.sf-hud__bar.is-mp .sf-hud__bar-text { font-size: max(10px, 10.5u); }
.sf-hud__xp { --p: 0; position: relative; height: max(3px, 4u); border-radius: 2u; overflow: hidden; background: rgba(3, 6, 16, 0.82); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.22); }
.sf-hud__xp > i { position: absolute; inset: 0; transform-origin: left center; transform: scaleX(var(--p)); transition: transform 0.3s var(--sf-ease-out); background: linear-gradient(90deg, #c08c3c, #ffe7ad); box-shadow: 0 0 6u rgba(255, 214, 130, 0.8); }

/* ── 装备 ── */
.sf-hud__st-items { flex: none; display: grid; grid-template-columns: repeat(3, auto); gap: 3u; }
.sf-hud__st-items .sf-slot { --sf-slot: 27u; border-radius: 5u; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(224, 177, 96, 0.5); }
.sf-hud__st-items .sf-slot--empty { box-shadow: inset 0 0 0 1px var(--sf-c-line-strong); }
/* 新到手的装备(手动买的、自动出装买的都算)：那一格亮一下再落定 */
.sf-hud__st-items .sf-slot.is-new { animation: sf-hud-item-new 1.1s var(--sf-ease-out); }
@keyframes sf-hud-item-new {
  0% { transform: scale(1.5); filter: brightness(2.4); box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, 2.5u) #fff4d6, 0 0 0 0 rgba(255, 231, 173, 0.9); }
  35% { transform: scale(0.94); filter: brightness(1.5); }
  100% { transform: none; filter: none; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(224, 177, 96, 0.5), 0 0 0 16u rgba(255, 231, 173, 0); }
}

/* ── 金币 + 商店入口（与小地图下方的商店按钮是同一个入口，放在装备旁边顺手） ── */
.sf-hud__st-shop {
  flex: none; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4u; width: 46u; padding: 0; margin: 0; border: 0; border-radius: 6u; cursor: pointer;
  color: var(--sf-c-gold-200); background: linear-gradient(180deg, rgba(74, 54, 14, 0.7), rgba(22, 16, 6, 0.8)); box-shadow: inset 0 0 0 1px rgba(243, 207, 133, 0.55), inset 0 1px 0 1px rgba(255, 244, 214, 0.12);
  transition: transform 0.1s var(--sf-ease-out), filter 0.12s linear;
}
@media (hover: hover) { .sf-hud__st-shop:hover { filter: brightness(1.25); } }
.sf-hud__st-shop:active { transform: scale(0.95); }
.sf-hud__st-shop-ico { display: grid; place-items: center; width: 24u; height: 24u; border-radius: 50%; color: #2b1a04; background: var(--sf-grad-gold); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 0 1px #6b4614; }
.sf-hud__st-shop-ico > .sf-i { width: 64%; height: 64%; }
.sf-hud__st-shop-gold { font-size: max(11px, 12.5u); font-weight: 800; line-height: 1; }
/* 窄横屏放不下：收起这个入口，状态栏变窄（左侧的商店按钮还在） */
@media (orientation: landscape) and (max-width: 760px) {
  .sf-hud__status { --w: 404u; }
  .sf-hud__st-shop { display: none; }
}

/* ── 状态图标行 ── */
.sf-hud__buffs { position: absolute; left: 80u; right: 6u; bottom: calc(100% + 5u); display: flex; flex-wrap: wrap-reverse; gap: 4u; pointer-events: none; }
.sf-hud__buff {
  --t: 1; position: relative; flex: none; width: max(22px, 25u); height: max(22px, 25u); border-radius: 5u; overflow: hidden; pointer-events: auto;
  box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(111, 227, 161, 0.75), 0 2u 6u rgba(0, 0, 0, 0.5);
  animation: sf-hud-buff-in 0.22s var(--sf-ease-spring) both;
}
.sf-hud__buff.is-debuff { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(255, 93, 93, 0.9), 0 2u 6u rgba(0, 0, 0, 0.5); }
.sf-hud__buff.is-neutral { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(143, 233, 255, 0.75), 0 2u 6u rgba(0, 0, 0, 0.5); }
.sf-hud__buff > svg { display: block; width: 100%; height: 100%; }
/* 已流逝的部分盖上暗色扇形：从 12 点方向顺时针扩大 */
.sf-hud__buff-cd { position: absolute; inset: -30%; background: conic-gradient(rgba(3, 6, 16, 0.72) calc((1 - var(--t)) * 360deg), rgba(3, 6, 16, 0) 0); pointer-events: none; }
.sf-hud__buff-n { position: absolute; right: 1px; bottom: 0; font-size: max(10px, 11u); font-weight: 800; line-height: 1.05; color: #fff; text-shadow: 0 0 2px #000, 0 1px 1px #000, 0 0 3px #000; }
@keyframes sf-hud-buff-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }

/* 竖屏：铺满底边的一条；技能区与摇杆整体上移让位 */
@media (orientation: portrait) {
  .sf-hud { --hud-lift: max(58px, 68u); }
  .sf-hud__status { left: 0; right: 0; width: auto; transform: none; border-radius: 0; padding-left: max(10u, var(--sf-safe-l)); padding-right: max(10u, var(--sf-safe-r)); align-items: center; }
  .sf-hud__st-por { width: 48u; height: 48u; margin: -12u 3u 3u 3u; }
  .sf-hud__st-stats { display: none; }
  .sf-hud__st-shop { display: none; }
  .sf-hud__st-items { grid-template-columns: repeat(6, auto); }
  .sf-hud__st-items .sf-slot { --sf-slot: 28u; }
  .sf-hud__st-passive { --sf-slot: max(20px, 22u); left: -7u; top: -9u; bottom: auto; }
  .sf-hud__st-lv { right: -7u; }
  /* 竖屏：左上角是被动图标，名签排在它右边，只写名字(职业图标省掉)，状态图标行相应右移一点 */
  .sf-hud__st-name { left: calc(max(20px, 22u) - 5u); top: -10u; transform: none; height: max(14px, 15u); padding: 0 5u; font-size: max(10px, 10u); }
  .sf-hud__st-name .sf-i { display: none; }
  /* 状态图标只排到技能区左缘为止，多了向上换行 */
  .sf-hud__buffs { left: max(68u, 66px); right: calc(var(--hud-sk) * 2.9 + var(--hud-r)); }
}
`),
  HUD_STAT_FADE_ALPHA = 0.4,
  STATUS_IDS = Object.keys(statusEffects),
  STATUS_ID_TO_INDEX = new Map(STATUS_IDS.map((statusId, statusIndex) => [statusId, statusIndex])),
  HUD_STAT_MAX_LINES = 10

export { HUD_STAT_FADE_ALPHA, HUD_STAT_MAX_LINES, STATUS_ID_TO_INDEX, HUD_STAT_CSS }
