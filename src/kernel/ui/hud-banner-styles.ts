/**
 * HUD 横幅样式
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { expandCssUnits } from './dom-kit'

const HUD_BANNER_CSS = expandCssUnits(`
.sf-hud__banner-wrap { position: absolute; left: 0; right: 0; top: calc(var(--hud-t) + max(54px, 64u)); z-index: 4; display: flex; justify-content: center; pointer-events: none; }
.sf-hud__banner {
  --tone: 92, 214, 247; --fs: max(14px, 17u); --face: 0px;
  position: relative; isolation: isolate; display: flex; align-items: center; justify-content: center; gap: 12u; min-width: min(300u, 80vw); max-width: 96vw; padding: 5u 64u 6u;
  animation: sf-hud-bn-in 0.4s var(--sf-ease-out) both;
}
.sf-hud__banner.is-ally { --tone: 77, 163, 255; }
.sf-hud__banner.is-foe { --tone: 255, 93, 93; }
.sf-hud__banner.is-out { animation: sf-hud-bn-out 0.22s var(--sf-ease-in) both; }
/* 底带：中间实、两端渐隐；上沿一道亮的星轨线，下沿一道淡的。
   底色留两成通透：镜头拉近后，英雄以北十来米的敌人正好在横幅后面，不能被盖死 */
.sf-hud__banner::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  background:
    linear-gradient(90deg, rgba(255, 231, 173, 0), rgba(255, 231, 173, 0.95) 28%, #fff4d6 50%, rgba(255, 231, 173, 0.95) 72%, rgba(255, 231, 173, 0)) left top / 100% 1.5px no-repeat,
    linear-gradient(90deg, rgba(255, 231, 173, 0), rgba(255, 231, 173, 0.6) 30%, rgba(255, 231, 173, 0.6) 70%, rgba(255, 231, 173, 0)) left bottom / 100% 1px no-repeat,
    linear-gradient(90deg, rgba(var(--tone), 0), rgba(var(--tone), 0.36) 20%, rgba(8, 13, 31, 0.8) 40%, rgba(8, 13, 31, 0.8) 60%, rgba(var(--tone), 0.36) 80%, rgba(var(--tone), 0));
}
/* 上沿正中的菱形星 */
.sf-hud__banner::after {
  content: ''; position: absolute; left: 50%; top: 0; width: 9u; height: 9u; margin: -4.5u 0 0 -4.5u; transform: rotate(45deg);
  background: linear-gradient(135deg, #fff4d6, #e0b160); box-shadow: 0 0 10u rgba(255, 214, 130, 0.9);
}
.sf-hud__banner-text { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.sf-hud__banner-title {
  margin: 0; font-weight: 900; font-size: var(--fs); line-height: 1.22; letter-spacing: 0.22em; margin-right: -0.22em; white-space: nowrap;
  animation: sf-hud-bn-slam 0.5s var(--sf-ease-out) both;
}
/* 中立播报(开战/兵线/野怪现身)：青白色的星辉金属字 */
.sf-hud__banner.is-neutral .sf-hud__banner-title {
  background-image: linear-gradient(180deg, #ffffff 0%, #d9f8ff 30%, #7fdcf5 54%, #2b8fb8 62%, #a5ebff 82%, #f0fdff 100%);
  filter: drop-shadow(0 1u 0 rgba(6, 30, 48, 0.9)) drop-shadow(0 3u 8u rgba(0, 0, 0, 0.55));
}
.sf-hud__banner.is-foe .sf-hud__banner-title {
  background-image: linear-gradient(180deg, #fff3ee 0%, #ffc2b3 28%, #f25b50 54%, #9c1f2b 62%, #ff8d7a 82%, #ffe6dd 100%);
  filter: drop-shadow(0 1u 0 rgba(60, 6, 12, 0.9)) drop-shadow(0 3u 8u rgba(0, 0, 0, 0.55));
}
.sf-hud__banner-sub { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0 5u; margin-top: 1u; font-size: var(--sf-fs-sm); font-weight: 600; line-height: 1.35; color: var(--sf-c-text); text-align: center; text-shadow: var(--hud-shadow-text); }
/* 每一段自己不折行，放不下时整段换到下一行 */
.sf-hud__banner-sub > * { white-space: nowrap; }
.sf-hud__banner-sub .is-dim { color: var(--sf-c-text-2); font-weight: 600; }
.sf-hud__banner-sub .is-blue { color: #9ccfff; font-weight: 800; }
.sf-hud__banner-sub .is-red { color: #ff9c9c; font-weight: 800; }
.sf-hud__banner-sub .is-me { color: var(--sf-c-me); font-weight: 800; }
.sf-hud__banner-sub .is-gold { display: inline-flex; align-items: center; gap: 2u; color: var(--sf-c-gold-200); font-weight: 800; }
.sf-hud__banner-sub .sf-i { width: 1.1em; height: 1.1em; vertical-align: 0; }
.sf-hud__banner-face { position: absolute; top: 50%; display: grid; place-items: center; width: var(--face); height: var(--face); margin-top: calc(var(--face) / -2); }
.sf-hud__banner-face.is-l { left: 6u; animation: sf-hud-bn-face-l 0.45s var(--sf-ease-spring) both; }
.sf-hud__banner-face.is-r { right: 6u; animation: sf-hud-bn-face-r 0.45s var(--sf-ease-spring) 0.08s both; }
.sf-hud__banner-face .sf-hud__face { --sz: var(--face); box-shadow: 0 0 0 max(2px, 2.5u) var(--ring), 0 0 0 max(3px, 4u) rgba(8, 13, 31, 0.9), 0 0 14u rgba(var(--tone), 0.8); }
/* 被杀者头像上划一道 */
.sf-hud__banner-face.is-r.is-slain::after { content: ''; position: absolute; left: -8%; right: -8%; top: 50%; height: max(2px, 3u); margin-top: -1.5u; border-radius: 2u; transform: rotate(-38deg); background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 30%, #ff8d8d 70%, rgba(255, 93, 93, 0)); box-shadow: 0 0 8u rgba(255, 93, 93, 0.9); }

/* ── 强度分级 ── */
.sf-hud__banner.is-t2 { --fs: min(max(17px, 23u), 6vw); --face: max(34px, 42u); padding: 6u 70u 7u; }
.sf-hud__banner.is-t3 { --fs: min(max(22px, 32u), 7.4vw); --face: max(42px, 54u); padding: 7u 84u 8u; min-width: min(380u, 90vw); }
.sf-hud__banner.is-t4 { --fs: min(max(27px, 42u), 7.6vw); --face: max(48px, 64u); padding: 8u 96u 10u; min-width: min(460u, 94vw); }
.sf-hud__banner.is-t4 .sf-hud__banner-title { letter-spacing: 0.3em; margin-right: -0.3em; }
.sf-hud__banner.is-noface { padding-left: 44u; padding-right: 44u; }
/* 3 级起：标题后面一轮放射光；4 级再加闪烁星点与标题扫光 */
.sf-hud__banner-rays {
  --r: max(110px, 190u); position: absolute; left: 50%; top: 50%; z-index: -2; width: calc(var(--r) * 2); height: calc(var(--r) * 2); margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1); border-radius: 50%; display: none;
  background: repeating-conic-gradient(from 0deg, rgba(255, 226, 160, 0.34) 0deg 4deg, rgba(255, 226, 160, 0) 4deg 12deg);
  -webkit-mask-image: radial-gradient(ellipse 100% 46% at center, #000 0, rgba(0, 0, 0, 0.55) 30%, transparent 70%); mask-image: radial-gradient(ellipse 100% 46% at center, #000 0, rgba(0, 0, 0, 0.55) 30%, transparent 70%);
  animation: sf-spin 40s linear infinite;
}
.sf-hud__banner.is-foe .sf-hud__banner-rays { background: repeating-conic-gradient(from 0deg, rgba(255, 130, 120, 0.3) 0deg 4deg, rgba(255, 130, 120, 0) 4deg 12deg); }
.sf-hud__banner.is-t3 .sf-hud__banner-rays, .sf-hud__banner.is-t4 .sf-hud__banner-rays { display: block; }
.sf-hud__banner.is-t4 .sf-hud__banner-rays { --r: max(150px, 260u); }
.sf-hud__banner-spark { position: absolute; z-index: -1; width: 16u; height: 16u; display: none; background: radial-gradient(circle, #fff 0, rgba(255, 244, 214, 0.9) 18%, rgba(255, 214, 130, 0) 62%); clip-path: polygon(50% 0, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0 50%, 42% 42%); animation: sf-hud-bn-spark 1.1s ease-in-out infinite; }
.sf-hud__banner.is-t4 .sf-hud__banner-spark { display: block; }
.sf-hud__banner-spark:nth-child(2) { left: 20%; top: -12u; }
.sf-hud__banner-spark:nth-child(3) { right: 18%; top: -6u; animation-delay: 0.35s; width: 22u; height: 22u; }
.sf-hud__banner-spark:nth-child(4) { left: 30%; bottom: -10u; animation-delay: 0.6s; width: 12u; height: 12u; }
.sf-hud__banner-spark:nth-child(5) { right: 28%; bottom: -12u; animation-delay: 0.15s; }
.sf-hud__banner.is-t4::before { animation: sf-hud-bn-flash 0.6s ease-out both; }

@keyframes sf-hud-bn-in { from { opacity: 0; transform: scaleX(0.35); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-bn-out { to { opacity: 0; transform: translateY(-10u) scale(0.97); } }
@keyframes sf-hud-bn-slam { 0% { opacity: 0; transform: scale(2.3); filter: brightness(3); } 60% { opacity: 1; transform: scale(0.96); } 100% { transform: none; } }
@keyframes sf-hud-bn-face-l { from { opacity: 0; transform: translateX(-40u) scale(0.6); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-bn-face-r { from { opacity: 0; transform: translateX(40u) scale(0.6); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-bn-spark { 0%, 100% { opacity: 0.2; transform: scale(0.5) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(45deg); } }
@keyframes sf-hud-bn-flash { 0% { filter: brightness(3.5); } 100% { filter: none; } }

@media (orientation: portrait) {
  .sf-hud__banner-wrap { top: calc(var(--hud-t) + var(--hud-mini) + max(58px, 68u)); }
  .sf-hud__banner.is-t2 { padding-left: 58u; padding-right: 58u; }
  .sf-hud__banner.is-t3 { padding-left: 70u; padding-right: 70u; }
  .sf-hud__banner.is-t4 { padding-left: 78u; padding-right: 78u; --fs: min(max(24px, 34u), 6.6vw); }
  .sf-hud__banner.is-t4 .sf-hud__banner-title { letter-spacing: 0.14em; margin-right: -0.14em; }
  /* 副行长的横幅(史诗野怪刷新)：屏幕窄，两侧留白收到只让开左边的图标，副行小一号——奖励说明一行、提示一行，不再折成三行 */
  .sf-hud__banner.is-wide { min-width: 96vw; padding-left: calc(var(--face) + 16u); padding-right: 12u; }
  .sf-hud__banner.is-wide .sf-hud__banner-sub { font-size: max(11px, 11.5u); gap: 0 4u; letter-spacing: -0.01em; }
}
/* 横屏手机(屏高不足 480px)：横幅正下方紧挨着玩家英雄头顶的血条(英雄脚在屏高约 46% 处)。各档压矮一号并上提，别盖到自己头上 */
@media (orientation: landscape) and (max-height: 480px) {
  .sf-hud__banner-wrap { top: calc(var(--hud-t) + 46px); }
  .sf-hud__banner.is-t2 { --fs: 15px; --face: 30px; padding-top: 3px; padding-bottom: 4px; }
  .sf-hud__banner.is-t3 { --fs: 18px; --face: 34px; padding-top: 3px; padding-bottom: 4px; }
  .sf-hud__banner.is-t4 { --fs: 21px; --face: 38px; padding-top: 4px; padding-bottom: 5px; }
}
`),
  BANNER_SCALE_BY_STREAK = { 1: 1.6, 2: 2, 3: 2.4, 4: 3 },
  BANNER_WIDTH_BY_STREAK = { 1: 1, 2: 1.25, 3: 1.6, 4: 2.1 },
  BANNER_MAX_STREAK = 4,
  BANNER_ANIM_FAST = 2.4,
  BANNER_ANIM_MID = 3.4,
  BANNER_ANIM_SLOW = 4.2

export { BANNER_SCALE_BY_STREAK, BANNER_ANIM_FAST, BANNER_ANIM_MID, BANNER_MAX_STREAK, BANNER_WIDTH_BY_STREAK, BANNER_ANIM_SLOW, HUD_BANNER_CSS }
