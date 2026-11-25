/**
 * 选英雄界面：技能槽文案、快捷键映射与界面样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const SKILL_SLOT_LABELS = { passive: "被动", s1: "一技能", s2: "二技能", ult: "大招" },
  SKILL_KEY_BINDINGS = { s1: "Q", s2: "E", ult: "R" },
  SKILL_SLOT_KEYS = ["passive", "s1", "s2", "ult"],
  SUMMONER_SPELL_KEYS = ["flash", "heal", "recall"],
  HERO_SELECT_CSS = expandCssUnits(`
.sf-select { display: flex; flex-direction: column; padding: max(8u, var(--sf-safe-t)) max(20u, var(--sf-safe-r)) max(14u, var(--sf-safe-b)) max(20u, var(--sf-safe-l)); --hero: #8fe9ff; }
.sf-select__top { display: flex; align-items: center; gap: 14u; flex: none; height: max(44px, 58u); }
.sf-select__top .sf-title { flex: none; font-size: max(19px, 30u); white-space: nowrap; }
.sf-select__lead { min-width: 0; margin: 0 0 0 4u; padding-left: 14u; font-size: var(--sf-fs-sm); letter-spacing: 0.1em; color: var(--sf-c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: inset 1px 0 0 var(--sf-c-line-strong); }
.sf-select__top-right { margin-left: auto; flex: none; display: flex; align-items: center; gap: 14u; }
.sf-select__hint { display: flex; align-items: center; gap: 6u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.08em; white-space: nowrap; }
.sf-select__main {
  flex: 1; min-height: 0; display: grid; gap: 12u 18u;
  grid-template-columns: clamp(150px, 268u, 30vw) minmax(0, 1fr) clamp(272px, 424u, 38vw);
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas: 'roster stage detail' 'roster go detail';
}

/* ── 英雄卡 ── */
.sf-select__roster { grid-area: roster; display: flex; flex-direction: column; gap: max(5px, 9u); min-height: 0; }
.sf-hcard {
  --hero: #8fe9ff;
  position: relative; flex: 1 1 0; min-height: 0; max-height: 122u; display: flex; align-items: center; gap: 12u; padding: 0 12u 0 9u; margin: 0; border: 0; cursor: pointer; text-align: left;
  color: var(--sf-c-text); border-radius: 9u; overflow: hidden;
  background: linear-gradient(90deg, rgba(20, 34, 72, 0.82), rgba(10, 17, 40, 0.72));
  box-shadow: inset 0 0 0 1px var(--sf-c-line-strong);
  transition: transform var(--sf-t-mid) var(--sf-ease-out), box-shadow var(--sf-t-mid) linear, background var(--sf-t-mid) linear;
  animation: sf-left-in 0.5s var(--sf-ease-out) both;
}
.sf-hcard::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3u; background: var(--hero); opacity: 0.5; transition: opacity var(--sf-t-mid) linear, width var(--sf-t-mid) var(--sf-ease-out); }
.sf-hcard::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--hero) 30%, transparent), transparent 70%); opacity: 0; transition: opacity var(--sf-t-mid) linear; pointer-events: none; }
.sf-hcard > * { position: relative; z-index: 1; }
@media (hover: hover) { .sf-hcard:hover { transform: translateX(3u); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hero) 60%, transparent); } .sf-hcard:hover::after { opacity: 0.5; } }
.sf-hcard:active { transform: scale(0.985); }
.sf-hcard.is-active { transform: translateX(6u); box-shadow: inset 0 0 0 max(1px, 1.5u) var(--sf-c-gold-200), 0 0 18u color-mix(in srgb, var(--hero) 45%, transparent), var(--sf-shadow-1); }
.sf-hcard.is-active::before { opacity: 1; width: 5u; box-shadow: 0 0 10u var(--hero); }
.sf-hcard.is-active::after { opacity: 1; }
.sf-hcard__pic { height: min(84u, 76%); width: auto; aspect-ratio: 1; border-radius: 8u; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(2px, 2u) color-mix(in srgb, var(--hero) 55%, #5a6a90); }
.sf-hcard__pic-wrap { position: relative; flex: none; height: 100%; display: flex; align-items: center; }
.sf-hcard__role { position: absolute; right: -7u; bottom: 10%; display: grid; place-items: center; width: max(18px, 24u); height: max(18px, 24u); border-radius: 50%; color: #08101f; background: var(--role); box-shadow: 0 0 0 max(1.5px, 2u) #0a1128; }
.sf-hcard__role .sf-i { width: 62%; height: 62%; }
.sf-hcard__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5u; }
.sf-hcard__name { font-weight: 800; font-size: max(15px, 22u); line-height: 1.15; letter-spacing: 0.1em; white-space: nowrap; }
.sf-hcard__name .sf-heroname__role { font-size: 0.62em; font-weight: 700; letter-spacing: 0.06em; }
.sf-hcard__title { font-size: var(--sf-fs-xs); line-height: 1.2; letter-spacing: 0.22em; color: var(--sf-c-text-3); white-space: nowrap; }
.sf-hcard.is-active .sf-hcard__name { color: var(--sf-c-gold-100); }
.sf-hcard.is-active .sf-hcard__title { color: var(--sf-c-text-2); }
.sf-hcard__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 3u 10u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-2); line-height: 1.2; white-space: nowrap; }
.sf-hcard__meta > span { display: inline-flex; align-items: center; gap: 4u; }
.sf-hcard__meta .sf-i { width: 1.2em; height: 1.2em; }
.sf-hcard__meta .sf-stars { font-size: var(--sf-fs-xs); }

/* ── 立绘舞台 ── */
.sf-select__stage { grid-area: stage; position: relative; min-height: 0; min-width: 0; }
.sf-select__glow { position: absolute; left: 8%; right: 8%; bottom: 2%; height: 34%; border-radius: 50%; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--hero) 46%, transparent), transparent 68%); filter: blur(6u); opacity: 0.8; transition: background 0.4s linear; pointer-events: none; }
/* 立绘背后的星轨环（立绘画布透明时可见）：只做 transform 动画 */
.sf-select__rings { position: absolute; inset: 0 0 6% 0; display: grid; place-items: center; pointer-events: none; }
.sf-select__ring { grid-area: 1 / 1; height: min(82%, 96vw); aspect-ratio: 1; border-radius: 50%; opacity: 0.6;
  background: conic-gradient(from 0deg, color-mix(in srgb, var(--hero) 80%, transparent) 0deg, transparent 70deg, transparent 180deg, color-mix(in srgb, var(--hero) 55%, transparent) 200deg, transparent 290deg, color-mix(in srgb, var(--hero) 80%, transparent) 360deg);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px)); mask: radial-gradient(closest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px));
  animation: sf-spin 48s linear infinite; }
.sf-select__ring--in { height: min(62%, 72vw); opacity: 0.4; animation-duration: 36s; animation-direction: reverse; }
/* 画布蒙版三层相交：四角的椭圆渐隐 + 左右两边、底边的线性渐隐。椭圆那层在边的中段几乎不透明，
   长兵器(程咬金的斧、樊哙的盾)伸出画布时会被边缘一刀切断；加上线性渐隐后是渐渐淡出 */
.sf-select__canvas {
  position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%), linear-gradient(180deg, #000 0, #000 93%, transparent 100%), radial-gradient(ellipse 72% 78% at 50% 50%, #000 62%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%), linear-gradient(180deg, #000 0, #000 93%, transparent 100%), radial-gradient(ellipse 72% 78% at 50% 50%, #000 62%, transparent 100%);
  -webkit-mask-composite: source-in; mask-composite: intersect;
}
.sf-select__plate { position: absolute; left: 0; top: 4u; right: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4u; pointer-events: none; }
.sf-select__plate.is-swap { animation: sf-plate-in 0.45s var(--sf-ease-out) both; }
@keyframes sf-plate-in { from { opacity: 0; transform: translateX(-16u); } to { opacity: 1; transform: none; } }
.sf-select__name { display: flex; align-items: baseline; margin: 0; font-weight: 900; font-size: max(30px, 62u); line-height: 1.05; letter-spacing: 0.12em; white-space: nowrap; }
/* 「 · 坦克」：约 0.5em、职业色，带职业图标 */
.sf-select__name-role { display: inline-flex; align-items: center; gap: 0.18em; margin-left: 0.1em; font-size: 0.5em; font-weight: 800; letter-spacing: 0.1em; color: var(--role); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8); }
.sf-select__name-role .sf-i { width: 1em; height: 1em; vertical-align: 0; }
.sf-select__name-role::before { content: '·'; margin-right: 0.1em; color: var(--sf-c-text-3); }
.sf-select__sub { display: flex; align-items: center; gap: 10u; font-size: var(--sf-fs-md); letter-spacing: 0.3em; color: var(--sf-c-text); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); }
.sf-select__sub::before { content: ''; width: 26u; height: 2px; background: linear-gradient(90deg, var(--hero), transparent); }
.sf-select__nav { position: absolute; top: 50%; transform: translateY(-50%); }
.sf-select__nav--prev { left: 0; }
.sf-select__nav--next { right: 0; }
.sf-select__nav .sf-iconbtn { border-radius: 50%; }

/* ── 难度 + 开始 ── */
.sf-select__go { grid-area: go; display: flex; align-items: stretch; gap: 14u; padding: 10u 12u; border-radius: var(--sf-r-md); background: linear-gradient(180deg, rgba(20, 34, 72, 0.78), rgba(8, 14, 34, 0.86)); box-shadow: inset 0 0 0 1px var(--sf-c-line-strong), inset 0 1px 0 rgba(143, 233, 255, 0.12); }
.sf-select__diff { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5u; }
.sf-select__diff-head { display: flex; align-items: center; gap: 10u; }
.sf-select__diff-head .sf-heading { flex: none; }
.sf-select__diff-head .sf-heading::after { display: none; }
.sf-select__diff-head .sf-seg { flex: 1; max-width: 300u; }
.sf-select__diff-head .sf-seg__opt { padding: 0 6u; }
.sf-select__diff-desc { margin: 0; min-height: 1.5em; font-size: var(--sf-fs-xs); line-height: 1.5; color: var(--sf-c-text-2); }
.sf-select__go .sf-btn--lg { flex: none; align-self: center; padding: 0 30u; }

/* ── 详情 ── */
.sf-select__detail { grid-area: detail; display: flex; flex-direction: column; min-height: 0; min-width: 0; animation: sf-right-in 0.5s 0.1s var(--sf-ease-out) both; }
.sf-select__detail-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10u; padding: 14u 18u 14u; }
.sf-select__detail-body > * { flex: none; }
.sf-select__detail-body.is-swap > * { animation: sf-rise-in 0.4s var(--sf-ease-out) both; }
.sf-select__detail-body.is-swap > *:nth-child(2) { animation-delay: 0.04s; }
.sf-select__detail-body.is-swap > *:nth-child(3) { animation-delay: 0.08s; }
.sf-select__detail-body.is-swap > *:nth-child(4) { animation-delay: 0.12s; }
.sf-select__detail-body.is-swap > *:nth-child(n + 5) { animation-delay: 0.16s; }
.sf-select__tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6u; }
.sf-select__tags .sf-stars { margin-left: 2u; }
.sf-select__lore { margin: 0; padding-left: 10u; font-size: var(--sf-fs-sm); line-height: 1.65; color: var(--sf-c-text-2); box-shadow: inset max(2px, 2u) 0 0 color-mix(in srgb, var(--hero) 70%, transparent); }
/* 职业一句大白话：详情的第一句话 */
.sf-select__rolebrief { margin: 0; font-size: var(--sf-fs-md); font-weight: 700; line-height: 1.45; color: var(--sf-c-text); }
.sf-select__rolebrief b { color: var(--role); font-weight: 800; }
.sf-select__tips { margin: 0; display: flex; gap: 8u; padding: 7u 10u; font-size: var(--sf-fs-sm); line-height: 1.6; color: var(--sf-c-text); }
.sf-select__tips .sf-i { flex: none; margin-top: 0.2em; color: var(--sf-c-gold-300); }
.sf-select__abil { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4u 14u; }
.sf-radar { width: max(140px, 158u); margin: -4u 0 -6u; }
.sf-radar svg { display: block; width: 100%; height: auto; overflow: visible; }
.sf-radar text { font-family: var(--sf-font); font-size: 12.5px; font-weight: 600; fill: var(--sf-c-text-2); }
.sf-statlist { flex: 1 1 max(126px, 160u); min-width: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3u 10u; margin: 0; }
.sf-statlist div { display: flex; align-items: baseline; justify-content: space-between; gap: 6u; padding-bottom: 2u; font-size: var(--sf-fs-xs); box-shadow: inset 0 -1px 0 var(--sf-c-line); white-space: nowrap; }
.sf-statlist dt { color: var(--sf-c-text-3); }
.sf-statlist dd { margin: 0; font-size: var(--sf-fs-sm); color: var(--sf-c-text); }
.sf-skills { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8u 10u; }
.sf-skills__sum { margin-left: auto; display: flex; align-items: center; gap: max(4px, 6u); height: max(42px, 54u); padding-left: 10u; box-shadow: inset 1px 0 0 var(--sf-c-line-strong); }
.sf-skills__sum .sf-slot { --sf-slot: max(26px, 32u); cursor: help; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(1.5px, 2u) rgba(150, 178, 235, 0.5); }
.sf-skill { display: flex; flex-direction: column; align-items: center; gap: 5u; padding: 0; margin: 0; border: 0; background: none; cursor: pointer; color: var(--sf-c-text-3); font-size: var(--sf-fs-xs); letter-spacing: 0.06em; }
.sf-skill .sf-slot { --sf-slot: max(42px, 54u); transition: transform var(--sf-t-fast) var(--sf-ease-out), box-shadow var(--sf-t-fast) linear; }
.sf-skill[data-slot='passive'] .sf-slot { border-radius: 50%; }
@media (hover: hover) { .sf-skill:hover .sf-slot { transform: translateY(-2u); filter: brightness(1.12); } }
.sf-skill:active .sf-slot { transform: scale(0.94); }
.sf-skill.is-active { color: var(--sf-c-gold-200); }
.sf-skill.is-active .sf-slot { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, 2.5u) var(--sf-c-gold-100), 0 0 16u color-mix(in srgb, var(--hero) 80%, transparent); }
.sf-skill__tag { font-weight: 700; }
.sf-skilldesc { padding: 9u 12u 10u; min-height: 6.6em; }
.sf-skilldesc__head { display: flex; align-items: center; flex-wrap: wrap; gap: 4u 8u; margin-bottom: 5u; }
.sf-skilldesc__name { font-weight: 800; font-size: var(--sf-fs-lg); color: var(--sf-c-gold-100); letter-spacing: 0.1em; margin-right: 2u; }
.sf-skilldesc__slot { margin-left: auto; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.08em; white-space: nowrap; }
.sf-skilldesc__tags { display: flex; flex-wrap: wrap; align-items: center; gap: 4u 8u; }
.sf-skilldesc__cast { font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.06em; }
/* 一句大白话：比正文大一号、主文字色，排在数值与详细描述前面 */
.sf-skilldesc__brief { margin: 5u 0 0; font-size: var(--sf-fs-md); font-weight: 700; line-height: 1.5; color: var(--sf-c-text); }
.sf-skilldesc__meta { display: flex; flex-wrap: wrap; gap: 4u 6u; margin: 7u 0 5u; padding-top: 7u; box-shadow: inset 0 1px 0 var(--sf-c-line); }
.sf-skilldesc__text { margin: 0; font-size: var(--sf-fs-sm); line-height: 1.7; color: var(--sf-c-text-2); }
.sf-skilldesc__text b { font-family: var(--sf-font-num); font-weight: 700; color: var(--sf-c-gold-200); }
.sf-skilldesc__text i { font-style: normal; font-weight: 600; white-space: nowrap; }
.sf-skilldesc__text i[data-k='ad'] { color: #ffa066; }
.sf-skilldesc__text i[data-k='ap'] { color: #9cb4ff; }
.sf-skilldesc__text i[data-k='hp'] { color: #7fe6a0; }
.sf-build { display: flex; flex-wrap: wrap; align-items: center; gap: max(5px, 8u); }
.sf-build .sf-slot { --sf-slot: max(38px, 46u); cursor: help; }
.sf-build__cost { margin-left: auto; display: inline-flex; align-items: center; gap: 4u; font-size: var(--sf-fs-sm); color: var(--sf-c-gold-200); white-space: nowrap; }

/* ── 矮屏（横屏手机） ── */
@media (max-height: 520px) and (orientation: landscape) {
  .sf-select { padding-top: max(4u, var(--sf-safe-t)); padding-bottom: max(8u, var(--sf-safe-b)); }
  .sf-select__main { gap: 8u 12u; }
  .sf-hcard { gap: 9u; padding: 0 8u 0 7u; }
  .sf-hcard__info { gap: 3u; }
  .sf-hcard__title { display: none; }
  .sf-select__lead { display: none; }
  .sf-select__name { font-size: max(26px, 46u); }
  .sf-select__main { grid-template-columns: clamp(150px, 232u, 26vw) minmax(0, 1fr) clamp(272px, 400u, 37vw); }
  .sf-select__go { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'seg btn' 'desc desc'; align-items: center; gap: 5u 9u; padding: 7u 9u 6u; }
  .sf-select__diff, .sf-select__diff-head { display: contents; }
  .sf-select__diff-head .sf-heading { display: none; }
  .sf-select__diff-head .sf-seg { grid-area: seg; max-width: none; }
  .sf-select__diff-desc { grid-area: desc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sf-select__diff-desc::before { content: '对手难度 · '; color: var(--sf-c-gold-300); }
  .sf-select__go .sf-btn--lg { grid-area: btn; --sf-btn-h: max(40px, 50u); padding: 0 18u; font-size: max(15px, 20u); letter-spacing: 0.14em; }
  .sf-select__detail-body { padding: 12u 14u; gap: 10u; }
  .sf-select__hint { display: none; }
  /* 详情栏窄：技能图标与通用技能收小一点，四个技能 + 三个通用技能排在同一行 */
  .sf-skills { gap: 6px 6px; }
  .sf-skill .sf-slot { --sf-slot: 40px; }
  .sf-skills__sum { gap: 3px; height: 40px; padding-left: 7px; }
  .sf-skills__sum .sf-slot { --sf-slot: 22px; }
}

/* ── 小横屏（如 667×375）：英雄卡只留头像与名字，给立绘和详情腾地方 ── */
@media (max-height: 520px) and (orientation: landscape) and (max-width: 780px) {
  .sf-select__main { grid-template-columns: max(60px, 78u) minmax(0, 1fr) clamp(250px, 39vw, 300px); }
  .sf-select__roster { gap: 4px; }
  .sf-hcard { flex-direction: column; justify-content: center; gap: 1px; padding: 2px; text-align: center; }
  .sf-hcard__pic-wrap { height: auto; flex: 0 1 auto; min-height: 0; }
  .sf-hcard__pic { height: max(30px, 38u); }
  .sf-hcard__role { display: none; }
  .sf-hcard__info { flex: none; align-items: center; }
  .sf-hcard__name { font-size: var(--sf-fs-sm); letter-spacing: 0.04em; }
  .sf-hcard__name .sf-heroname__role { display: none; }
  .sf-hcard__meta { display: none; }
  .sf-select__go .sf-seg__opt { padding: 0 2u; letter-spacing: 0.02em; }
  .sf-select__go .sf-btn--lg { padding: 0 12u; letter-spacing: 0.06em; }
  .sf-select__nav .sf-iconbtn { width: 36px; height: 36px; }
}

/* ── 竖屏：纵向堆叠 ── */
@media (orientation: portrait) {
  .sf-select { padding-left: max(12u, var(--sf-safe-l)); padding-right: max(12u, var(--sf-safe-r)); }
  .sf-select__hint { display: none; }
  .sf-select__main {
    grid-template-columns: minmax(0, 1fr); gap: 10u;
    grid-template-rows: auto minmax(120px, 30fr) minmax(0, 44fr) auto;
    grid-template-areas: 'roster' 'stage' 'detail' 'go';
  }
  .sf-select__roster { flex-direction: row; gap: max(5px, 8u); }
  .sf-hcard { flex-direction: column; justify-content: center; max-height: none; gap: 5u; padding: 8u 2u 7u; text-align: center; animation-name: sf-drop-in; }
  .sf-hcard::before { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 3u; }
  .sf-hcard.is-active::before { width: auto; height: 4u; }
  .sf-hcard::after { background: linear-gradient(0deg, color-mix(in srgb, var(--hero) 30%, transparent), transparent 80%); }
  .sf-hcard.is-active, .sf-hcard:hover { transform: translateY(-3u); }
  .sf-hcard__pic-wrap { height: auto; }
  .sf-hcard__pic { width: max(44px, 58u); height: auto; }
  .sf-hcard__role { right: -5u; bottom: -3u; }
  .sf-hcard__info { flex: none; align-items: center; gap: 0; }
  .sf-hcard__name { font-size: var(--sf-fs-md); }
  /* 竖屏的卡片窄：只写名字，职业看头像右下角的职业徽标 */
  .sf-hcard__name .sf-heroname__role, .sf-hcard__title, .sf-hcard__meta { display: none; }
  .sf-select__lead { display: none; }
  .sf-select__name { font-size: max(28px, 48u); }
  .sf-select__nav { top: auto; bottom: 2u; transform: none; }
  .sf-select__go { flex-direction: column; gap: 9u; padding: 10u; }
  .sf-select__diff-head .sf-seg { max-width: none; }
  .sf-select__go .sf-btn--lg { align-self: stretch; }
  .sf-select__detail-body { padding: 12u 12u; gap: 10u; }
}
`),
  formatRangeLabel = (skillValuesByLevel) => {
    const selectedN = skillValuesByLevel[0],
      lastSkillValue = skillValuesByLevel[skillValuesByLevel.length - 1]
    return selectedN === lastSkillValue ? String(selectedN) : `${selectedN}~${lastSkillValue}`
  }

export { formatRangeLabel, SKILL_SLOT_LABELS, SKILL_KEY_BINDINGS, SUMMONER_SPELL_KEYS, HERO_SELECT_CSS, SKILL_SLOT_KEYS }
