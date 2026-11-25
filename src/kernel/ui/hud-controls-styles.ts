/**
 * HUD 控件样式与技能槽文案表
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const SKILL_SLOT_ORDER = ["s1", "s2", "ult", "recall", "heal", "flash"],
  SKILL_KEY_LABELS = { attack: "空格", s1: "Q", s2: "E", ult: "R", flash: "F", heal: "G", recall: "B" },
  SKILL_SLOT_NAMES = { s1: "一技能", s2: "二技能", ult: "大招" },
  SKILL_ICON_CENTER = { x: 0.86, y: 0.86 },
  skillIconPosition = (angleDegrees, orbitRadius) => ({ x: SKILL_ICON_CENTER.x - Math.cos((angleDegrees * Math.PI) / 180) * orbitRadius, y: SKILL_ICON_CENTER.y + Math.sin((angleDegrees * Math.PI) / 180) * orbitRadius }),
  SKILL_ICON_RADIUS = 1.52,
  SUMMONER_ICON_RADIUS = 2.62,
  SKILL_ICON_POSITIONS = { attack: SKILL_ICON_CENTER, s1: skillIconPosition(187, SKILL_ICON_RADIUS), s2: skillIconPosition(138.5, SKILL_ICON_RADIUS), ult: skillIconPosition(90, SKILL_ICON_RADIUS), recall: skillIconPosition(159.5, SUMMONER_ICON_RADIUS), heal: skillIconPosition(138.5, SUMMONER_ICON_RADIUS), flash: skillIconPosition(117.5, SUMMONER_ICON_RADIUS) },
  SUMMONER_ICON_RADIUS_ALT = 2.75,
  SUMMONER_ICON_POSITIONS = { recall: skillIconPosition(120, SUMMONER_ICON_RADIUS_ALT), heal: skillIconPosition(102.5, SUMMONER_ICON_RADIUS_ALT), flash: skillIconPosition(85, SUMMONER_ICON_RADIUS_ALT) },
  HUD_SKILLS_CSS = expandCssUnits(`
.sf-hud__skills { position: absolute; right: var(--hud-r); bottom: calc(var(--hud-b) + var(--hud-lift)); z-index: 3; width: 0; height: 0; }
.sf-hud__sk {
  --d: var(--hud-sk); --cd: 0; --x: 1; --y: 1;
  position: absolute; right: calc(var(--hud-sk) * var(--x) - var(--d) / 2); bottom: calc(var(--hud-sk) * var(--y) - var(--d) / 2); width: var(--d); height: var(--d);
  padding: 0; margin: 0; border: 0; border-radius: 50%; background: none; color: #fff; cursor: pointer; touch-action: none;
  transition: transform 0.09s var(--sf-ease-out), filter 0.15s linear;
}
/* 设计系统给所有按钮设了 touch-action: manipulation；技能键要自己处理拖动瞄准，必须彻底关掉浏览器手势 */
.sf-hud .sf-hud__sk { touch-action: none; }
.sf-hud__sk:focus-visible { outline: none; }
.sf-hud__sk.is-ult { --d: calc(var(--hud-sk) * 1.07); }
.sf-hud__sk.is-sum { --d: calc(var(--hud-sk) * 0.74); }
.sf-hud__sk.is-atk { --d: calc(var(--hud-sk) * 1.43); }
.sf-hud__sk.is-down { transform: scale(0.93); }
/* 竖屏：通用技能键换到大招键上方那组位置(见 LAYOUT_PORTRAIT)；右下技能区随之高出一截，中下的读条 / 提示条跟着上移 */
@media (orientation: portrait) {
  .sf-hud__sk.is-sum { right: calc(var(--hud-sk) * var(--xp, var(--x)) - var(--d) / 2); bottom: calc(var(--hud-sk) * var(--yp, var(--y)) - var(--d) / 2); }
  .sf-hud { --hud-ch: calc(var(--hud-sk) * 4.1 + var(--hud-b)); }
}

/* 图标面：圆形裁切 + 双层描边（深色隔离线 + 金环） */
.sf-hud__sk-face {
  position: absolute; inset: 0; border-radius: 50%; overflow: hidden; background: #0a1128;
  box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, calc(var(--d) * 0.045)) rgba(224, 177, 96, 0.82), 0 calc(var(--d) * 0.06) calc(var(--d) * 0.18) rgba(0, 0, 0, 0.55);
  transition: box-shadow 0.12s linear;
}
.sf-hud__sk-face > svg { display: block; width: 100%; height: 100%; transition: filter 0.15s linear; }
.sf-hud__sk-face::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 calc(var(--d) * -0.14) calc(var(--d) * 0.2) rgba(0, 0, 0, 0.32); pointer-events: none; }
/* 大招：金环外再套一圈青色星轨 */
.sf-hud__sk.is-ult .sf-hud__sk-face { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, calc(var(--d) * 0.045)) #ffe7ad, 0 0 0 max(3px, calc(var(--d) * 0.07)) rgba(8, 13, 31, 0.9), 0 0 0 max(4px, calc(var(--d) * 0.09)) rgba(92, 214, 247, 0.75), 0 0 calc(var(--d) * 0.3) rgba(92, 214, 247, 0.4); }
.sf-hud__sk.is-down .sf-hud__sk-face, .sf-hud__sk.is-aim .sf-hud__sk-face { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, calc(var(--d) * 0.055)) #fff4d6, 0 0 calc(var(--d) * 0.36) rgba(255, 214, 130, 0.95); }
.sf-hud__sk.is-active .sf-hud__sk-face { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2px, calc(var(--d) * 0.055)) var(--sf-c-cyan-300), 0 0 calc(var(--d) * 0.4) rgba(92, 214, 247, 0.9); }

/* 冷却：暗色扇形从 12 点方向顺时针退去，边界带一道亮线 */
.sf-hud__sk-cd {
  --a: calc((1 - var(--cd)) * 360deg);
  position: absolute; inset: 0; border-radius: 50%; display: none; pointer-events: none;
  background: conic-gradient(rgba(3, 6, 16, 0) 0deg, rgba(3, 6, 16, 0) calc(var(--a) - 2.5deg), rgba(190, 236, 255, 0.9) var(--a), rgba(3, 6, 16, 0.74) calc(var(--a) + 0.8deg), rgba(3, 6, 16, 0.74) 360deg);
}
.sf-hud__sk.is-cd .sf-hud__sk-cd { display: block; }
.sf-hud__sk.is-cd .sf-hud__sk-face > svg { filter: saturate(0.55) brightness(0.8); }
.sf-hud__sk-sec { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--d) * 0.37); font-weight: 800; line-height: 1; color: #fff; text-shadow: 0 1px 2px #000, 0 0 calc(var(--d) * 0.12) rgba(2, 4, 12, 0.95); pointer-events: none; }

/* 状态角标：未学会(锁)/缺蓝(水滴)/被控(禁止) */
.sf-hud__sk-mark { position: absolute; inset: 0; display: none; place-items: center; border-radius: 50%; pointer-events: none; }
.sf-hud__sk-mark > .sf-i { width: 44%; height: 44%; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9)); }
.sf-hud__sk.is-locked .sf-hud__sk-mark.is-lock { display: grid; background: rgba(3, 6, 16, 0.66); color: var(--sf-c-text-2); }
.sf-hud__sk.is-locked .sf-hud__sk-face > svg { filter: grayscale(1) brightness(0.55); }
.sf-hud__sk.is-nomana .sf-hud__sk-face > svg { filter: grayscale(0.9) brightness(0.72); }
.sf-hud__sk.is-nomana .sf-hud__sk-mark.is-mana { display: grid; place-items: end center; background: linear-gradient(180deg, rgba(40, 90, 190, 0.18), rgba(30, 70, 170, 0.55)); color: #9ccfff; }
.sf-hud__sk.is-nomana .sf-hud__sk-mark.is-mana > .sf-i { width: 30%; height: 30%; margin-bottom: 9%; }
.sf-hud__sk.is-forbid .sf-hud__sk-mark.is-ban { display: grid; background: rgba(120, 16, 26, 0.5); color: #ffb3b3; }
.sf-hud__sk.is-forbid .sf-hud__sk-face > svg { filter: grayscale(0.7) brightness(0.65); }
.sf-hud__sk.is-locked .sf-hud__sk-sec, .sf-hud__sk.is-locked .sf-hud__sk-cd { display: none; }

/* 技能等级点 */
.sf-hud__sk-pips { position: absolute; left: 50%; bottom: calc(var(--d) * -0.1); display: flex; gap: max(1.5px, calc(var(--d) * 0.028)); transform: translateX(-50%); pointer-events: none; }
.sf-hud__sk-pips > i { width: max(4px, calc(var(--d) * 0.085)); height: max(4px, calc(var(--d) * 0.085)); border-radius: 50%; background: #0a1128; box-shadow: 0 0 0 1px rgba(150, 178, 235, 0.6); }
.sf-hud__sk-pips > i.is-on { background: #ffe7ad; box-shadow: 0 0 0 1px #6b4614, 0 0 4px rgba(255, 214, 130, 0.9); }
.sf-hud__sk > .sf-hud__key { left: calc(var(--d) * -0.06); top: calc(var(--d) * -0.06); }
.sf-hud__sk.is-atk > .sf-hud__key { left: 6%; top: 6%; }

/* 类型标签角标：右上角两个字(键位角标在左上、等级点在下方，互不重叠)。深色半透明底 + 标签色文字，颜色只是辅助 */
.sf-hud__sk-tag {
  --tag: 243, 207, 133;
  position: absolute; right: calc(var(--d) * -0.07); top: calc(var(--d) * -0.07); z-index: 1; padding: 0.22em 0.42em 0.24em; border-radius: 99px; pointer-events: none;
  font-size: max(10px, calc(var(--d) * 0.175)); font-weight: 800; font-style: normal; line-height: 1; letter-spacing: 0.02em; white-space: nowrap;
  color: rgb(var(--tag)); background: rgba(6, 10, 24, 0.88); box-shadow: 0 0 0 1px rgba(var(--tag), 0.6), 0 1px 3px rgba(0, 0, 0, 0.6);
  transition: color 0.15s linear, box-shadow 0.15s linear, background 0.15s linear;
}
.sf-hud__sk-tag.is-ult { color: #2b1a04; background: var(--sf-grad-gold); box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 1px 3px rgba(0, 0, 0, 0.6); }
/* 通用技能键的名字(闪现 / 疗伤 / 回城)：只在触控布局显示——键鼠有 F / G / B 键帽，文案也写「按 B 回城」；
   触控的文案写的是「点『回城』」，键上得有这两个字才对得上。压在键的下沿，不挡图标中心的冷却秒数 */
.sf-hud__sk-name {
  position: absolute; left: 50%; bottom: calc(var(--d) * -0.14); z-index: 1; display: none; transform: translateX(-50%); padding: 0.18em 0.42em 0.2em; border-radius: 99px; pointer-events: none;
  font-size: max(10px, calc(var(--d) * 0.24)); font-weight: 800; font-style: normal; line-height: 1; letter-spacing: 0.04em; white-space: nowrap;
  color: #e9f2ff; background: rgba(6, 10, 24, 0.88); box-shadow: 0 0 0 1px rgba(150, 178, 235, 0.55), 0 1px 3px rgba(0, 0, 0, 0.6);
}
.sf-hud--touch .sf-hud__sk-name { display: block; }
/* 未学会：角标一并变灰 */
.sf-hud__sk.is-locked .sf-hud__sk-tag { color: #8b96b3; background: rgba(6, 10, 24, 0.88); box-shadow: 0 0 0 1px rgba(139, 150, 179, 0.5); }

/* 就绪 / 升级闪光 */
.sf-hud__sk-fx { position: absolute; inset: -18%; border-radius: 50%; opacity: 0; pointer-events: none; }
.sf-hud__sk.is-ready .sf-hud__sk-fx { background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0, rgba(190, 236, 255, 0.7) 38%, rgba(92, 214, 247, 0) 68%); animation: sf-hud-sk-ready 0.5s ease-out; }
.sf-hud__sk.is-lvup .sf-hud__sk-fx { background: radial-gradient(circle, rgba(255, 244, 214, 0) 46%, rgba(255, 231, 173, 0.95) 56%, rgba(255, 214, 130, 0) 70%); animation: sf-hud-sk-lvup 0.9s ease-out; }
.sf-hud__sk.is-lvup .sf-hud__sk-face { animation: sf-hud-sk-glow 0.9s ease-out; }
@keyframes sf-hud-sk-ready { 0% { opacity: 1; transform: scale(0.5); } 100% { opacity: 0; transform: scale(1.15); } }
@keyframes sf-hud-sk-lvup { 0% { opacity: 1; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.5); } }
@keyframes sf-hud-sk-glow { 0%, 40% { filter: brightness(1.9) saturate(1.2); } 100% { filter: none; } }

/* 普攻键：金属外环 + 深蓝内面 + 大号武器字形 */
.sf-hud__atk-face {
  position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; color: #ffe9b8;
  background: radial-gradient(circle at 50% 38%, rgba(60, 96, 180, 0.95), rgba(16, 28, 66, 0.96) 58%, rgba(6, 10, 26, 0.98));
  box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2.5px, calc(var(--d) * 0.04)) #e0b160, 0 0 0 max(3.5px, calc(var(--d) * 0.055)) rgba(8, 13, 31, 0.9), 0 0 0 max(4.5px, calc(var(--d) * 0.068)) rgba(255, 231, 173, 0.45),
    0 calc(var(--d) * 0.06) calc(var(--d) * 0.2) rgba(0, 0, 0, 0.6), inset 0 0 calc(var(--d) * 0.22) rgba(92, 214, 247, 0.28), inset 0 2px 0 rgba(255, 255, 255, 0.2);
  transition: box-shadow 0.1s linear, background 0.1s linear;
}
.sf-hud__atk-face > .sf-i { width: 50%; height: 50%; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7)); }
.sf-hud__sk.is-atk.is-down .sf-hud__atk-face { background: radial-gradient(circle at 50% 38%, #ffe7ad, #b17a2c 62%, #4a2f0c); color: #2b1a04; box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.95), 0 0 0 max(2.5px, calc(var(--d) * 0.04)) #fff4d6, 0 0 calc(var(--d) * 0.36) rgba(255, 214, 130, 0.95); }
.sf-hud__sk.is-atk.is-forbid .sf-hud__atk-face { filter: grayscale(0.8) brightness(0.65); }

.sf-hud__skills.is-dead .sf-hud__sk { filter: grayscale(1) brightness(0.55); }

/* 「取消」区：手动瞄准时出现，拖进去松手 = 不放 */
.sf-hud__cancel {
  --d: calc(var(--hud-sk) * 1.16);
  position: absolute; right: calc(var(--hud-sk) * 4.4); bottom: calc(var(--hud-sk) * 2.7); width: var(--d); height: var(--d); border-radius: 50%; display: grid; place-items: center; pointer-events: none;
  color: #ffd0d0; background: radial-gradient(circle at 50% 35%, rgba(90, 22, 34, 0.9), rgba(30, 8, 16, 0.92)); box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(2px, 2.5u) rgba(255, 120, 120, 0.75), 0 4u 14u rgba(0, 0, 0, 0.55);
  opacity: 0; transform: scale(0.6); transition: opacity 0.12s linear, transform 0.16s var(--sf-ease-spring), background 0.1s linear;
}
.sf-hud__cancel.is-on { opacity: 1; transform: none; }
.sf-hud__cancel.is-hot { transform: scale(1.14); color: #fff; background: radial-gradient(circle at 50% 35%, #ff7a6e, #c2262f 62%, #6e1019); box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(2px, 3u) #fff, 0 0 22u rgba(255, 93, 93, 0.95); }
.sf-hud__cancel > span { display: flex; flex-direction: column; align-items: center; gap: 1u; font-size: max(10px, 11u); font-weight: 800; letter-spacing: 0.1em; line-height: 1.1; }
.sf-hud__cancel .sf-i { width: calc(var(--d) * 0.36); height: calc(var(--d) * 0.36); }
/* 竖屏：屏幕窄，取消区正好落在摇杆正上方——往上抬一点，别和摇杆底盘叠在一起 */
@media (orientation: portrait) { .sf-hud__cancel { bottom: calc(var(--hud-sk) * 3.12); } }

/* 技能详情浮层：标签行 → 大白话(比正文大一号，主文字色) → 分隔线 → 数值行 → 详细描述(次文字色) */
.sf-tip .sf-hud-v { color: var(--sf-c-gold-200); font-weight: 700; }
.sf-tip .sf-hud-tiptags { display: flex; flex-wrap: wrap; align-items: center; gap: 4u 8u; margin: 4u 0 1u; }
.sf-tip .sf-hud-tipcast { font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); letter-spacing: 0.06em; }
.sf-tip .sf-hud-tipbrief { margin: 4u 0 0; font-size: var(--sf-fs-md); font-weight: 700; line-height: 1.45; color: var(--sf-c-text); }
.sf-tip .sf-hud-tipline { display: flex; flex-wrap: wrap; gap: 3u 10u; margin: 2u 0 5u; font-size: var(--sf-fs-xs); color: var(--sf-c-cyan-300); }
.sf-tip .sf-hud-tipline .is-warn { color: #ff9c9c; }
.sf-tip .sf-hud-tipbrief + .sf-hud-tipline, .sf-tip .sf-hud-tipbrief + .sf-hud-tipdesc { margin-top: 7u; padding-top: 6u; box-shadow: inset 0 1px 0 var(--sf-c-line); }
.sf-tip .sf-hud-tipdesc { color: var(--sf-c-text-2); }
/* 手机横屏(屏高很小)：详细描述最多三行，其余完整 */
@media (max-height: 460px) and (orientation: landscape) {
  .sf-tip .sf-hud-tipdesc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
}
`)

export { SKILL_SLOT_ORDER, SUMMONER_ICON_POSITIONS, SKILL_KEY_LABELS, SKILL_ICON_POSITIONS, HUD_SKILLS_CSS, SKILL_SLOT_NAMES }
