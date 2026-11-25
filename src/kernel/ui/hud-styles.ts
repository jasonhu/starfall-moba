/**
 * HUD 样式：HUD_STYLE_ELEMENT_ID / HUD_FONT_STACK / HUD_CSS / HUD_LOGO_SVG（原 starfall.core.js 第 67610-67662 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
const HUD_STYLE_ELEMENT_ID = "starfall-app-style",
  HUD_FONT_STACK = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",system-ui,sans-serif',
  HUD_CSS = `
.app-match { position: absolute; inset: 0; overflow: hidden; isolation: isolate; background: #070a14; }
.app-stage { position: absolute; inset: 0; overflow: hidden; transition: filter 0.6s linear; }
.app-stage.is-gray { filter: grayscale(0.92) brightness(0.8); }

.app-layer {
  position: absolute; inset: 0; z-index: 900; display: grid; place-items: center; box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  font-family: ${HUD_FONT_STACK}; font-size: 14px; line-height: 1.6; color: #eaf0ff;
  background: rgba(3, 6, 16, 0.78); overflow: auto; -webkit-user-select: none; user-select: none;
  animation: app-layer-in 0.25s ease-out both;
}
.app-layer--page { background: radial-gradient(120% 90% at 50% 0%, #16264f 0%, #0a1128 46%, #050814 100%); }
.app-layer * { box-sizing: border-box; }
@keyframes app-layer-in { from { opacity: 0; } to { opacity: 1; } }
.app-card {
  position: relative; width: min(100%, 460px); padding: 22px 24px 20px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(20, 34, 72, 0.96), rgba(10, 17, 40, 0.97));
  box-shadow: 0 0 0 1px rgba(224, 177, 96, 0.55), 0 0 0 4px rgba(8, 13, 31, 0.6), 0 18px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(143, 233, 255, 0.16);
  text-align: center; animation: app-card-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
@keyframes app-card-in { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
.app-card__mark { display: block; width: 56px; height: 56px; margin: 0 auto 6px; filter: drop-shadow(0 0 8px rgba(255, 214, 130, 0.55)); }
.app-card--error .app-card__mark { filter: drop-shadow(0 0 8px rgba(255, 110, 110, 0.5)); }
.app-card__title {
  margin: 0 0 8px; font-size: 20px; font-weight: 800; letter-spacing: 0.16em; margin-right: -0.16em; color: #ffe7ad;
  background: linear-gradient(180deg, #fffbe9 0%, #f3cf85 55%, #b98434 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.app-card--error .app-card__title { background-image: linear-gradient(180deg, #fff1ec 0%, #ff9d8a 55%, #c2473f 100%); }
.app-card__text { margin: 0 0 6px; color: #b3c1e0; }
.app-card__list { margin: 8px 0 4px; padding: 10px 14px 10px 30px; text-align: left; color: #b3c1e0; background: rgba(5, 8, 20, 0.5); border-radius: 6px; }
.app-card__list li { margin: 2px 0; }
.app-card__detail {
  margin: 10px 0 0; padding: 8px 10px; max-height: 96px; overflow: auto; text-align: left; white-space: pre-wrap; word-break: break-all;
  font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #9fb0d0; background: rgba(5, 8, 20, 0.6); border-radius: 6px;
  -webkit-user-select: text; user-select: text;
}
.app-card__btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 16px; }
.app-btn {
  min-width: 124px; min-height: 42px; padding: 0 20px; border: 0; border-radius: 6px; cursor: pointer;
  font: inherit; font-weight: 700; letter-spacing: 0.12em; color: #eaf0ff; background: rgba(40, 64, 124, 0.7);
  box-shadow: inset 0 0 0 1px rgba(143, 233, 255, 0.35); touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: filter 0.12s linear, transform 0.08s linear;
}
.app-btn:hover { filter: brightness(1.15); }
.app-btn:active { transform: translateY(1px) scale(0.98); }
.app-btn:focus-visible { outline: 2px solid #8fe9ff; outline-offset: 2px; }
.app-btn--primary { color: #2a1a04; background: linear-gradient(180deg, #ffe7ad, #e0b160 60%, #c08c3c); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 14px rgba(255, 214, 130, 0.35); }
`,
  HUD_LOGO_SVG =
    '<svg class="app-card__mark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="app-mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe9"/><stop offset=".55" stop-color="#f3cf85"/><stop offset="1" stop-color="#a8742c"/></linearGradient></defs><ellipse cx="32" cy="34" rx="26" ry="9" fill="none" stroke="#8fe9ff" stroke-opacity=".7" stroke-width="1.6" transform="rotate(-18 32 34)"/><path d="M32 4Q34.6 26.4 58 32Q34.6 37.6 32 60Q29.4 37.6 6 32Q29.4 26.4 32 4Z" fill="url(#app-mk)"/><circle cx="32" cy="32" r="4" fill="#fffdf2"/></svg>'

export { HUD_STYLE_ELEMENT_ID, HUD_FONT_STACK, HUD_CSS, HUD_LOGO_SVG }
