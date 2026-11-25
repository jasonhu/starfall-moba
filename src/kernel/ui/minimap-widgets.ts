/**
 * 小地图控件
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { createSlider, injectThemeStyles, createEl, createIconEl, expandCssUnits, iconFor, injectStyleSheet, createToggle, makePanelBody, makeSegmentedControl } from './dom-kit'

const minimapWorldToScreen = { quality: "high", masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.5, showFps: !1, cameraShake: !0, autoBuy: !0, tutorial: !0, objectiveHints: !0 },
  minimapUnitDot = "starfall.settings.v1",
  MINIMAP_TUNING = (rawSetting, fallbackSetting) => (typeof rawSetting == "number" && Number.isFinite(rawSetting) ? Math.max(0, Math.min(1, rawSetting)) : fallbackSetting),
  MINIMAP_WIDGET_STATE = (lowKind) => lowKind === "low" || lowKind === "medium" || lowKind === "high"

const TUTORIAL_REPLAY_DELAY_MS = 700,
  QUALITY_DESCRIPTIONS = { low: "关闭阴影与后期特效，帧率最高，适合低端设备或省电。", medium: "中等精度阴影与轻量泛光，画面与流畅度均衡。", high: "高精度阴影、泛光、调色与抗锯齿，画面最佳。" },
  SETTINGS_CSS = expandCssUnits(`
.sf-settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, max(250px, 300u)), 1fr)); gap: 16u 36u; }
.sf-settings__group { display: flex; flex-direction: column; gap: 2u; min-width: 0; }
.sf-settings__group > .sf-heading { margin-bottom: 6u; }
.sf-settings .sf-field { grid-template-columns: minmax(max(92px, 104u), max-content) 1fr; }
.sf-settings__row { cursor: pointer; border-radius: 6u; }
.sf-settings__quality { margin-top: 2u; }
/* 带说明小字的开关行：说明紧贴在行下面 */
.sf-settings__row.has-hint { min-height: max(34px, 38u); }
.sf-settings__row.has-hint + .sf-field__hint { margin: -1u 0 8u; }
.sf-settings .sf-field__hint.is-warn { color: var(--sf-c-amber); }
/* 「重看」：做成带描边的小按钮(原来是贴在开关左边的一行灰色小字，像说明文字，手机上也不好点) */
.sf-settings__replay {
  flex: none; display: inline-grid; place-items: center; min-width: max(44px, 48u); min-height: max(32px, 34u); padding: 0 11u; border-radius: 99px;
  font-size: var(--sf-fs-sm); font-weight: 700; line-height: 1; color: var(--sf-c-text); white-space: nowrap; text-decoration: none;
  background: rgba(150, 178, 235, 0.12); box-shadow: inset 0 0 0 1px rgba(150, 178, 235, 0.55);
}
@media (hover: hover) { .sf-settings__replay:hover { color: var(--sf-c-text); background: rgba(150, 178, 235, 0.24); } }
.sf-settings__replay:active { transform: scale(0.95); }
.sf-settings__foot { display: flex; align-items: center; gap: 12u; width: 100%; }
.sf-settings__foot > .sf-link { margin-right: auto; }
.sf-dialog--settings .sf-dialog__foot { padding-top: 12u; padding-bottom: 14u; }
@media (orientation: portrait) {
  .sf-settings__foot { flex-wrap: wrap; justify-content: flex-end; }
  .sf-settings__foot > .sf-link { flex-basis: 100%; justify-content: flex-start; }
}
`)

/**
 * 处理地图。
 *
 * @param builder - 构建器
 * @returns 结果对象
 */
function mountMiniMapWidgets(builder) {
  ;(injectThemeStyles(), injectStyleSheet("sf-settings", SETTINGS_CSS))
  const uiMode = builder.mode ?? "menu",
    formatVolumePercent = (volumeFraction) => `${Math.round(volumeFraction * 100)}`,
    element = createEl("p", "sf-field__hint"),
    SegmentedControlValue = makeSegmentedControl({
      options: [
        { value: "low", label: "低" },
        { value: "medium", label: "中" },
        { value: "high", label: "高" },
      ],
      value: builder.get().quality,
      label: "画质",
      onChange: (qualityLevel) => {
        ;(builder.update({ quality: qualityLevel }), (element.textContent = QUALITY_DESCRIPTIONS[qualityLevel]))
      },
    })
  let tutorialReplayTimer = 0
  const cancelTutorialReplay = () => {
      ;(window.clearTimeout(tutorialReplayTimer), (tutorialReplayTimer = 0))
    },
    createToggleRow = (event, settingIcon, settingKey, hintText?, leadingControl?) => {
      const ToggleValue = createToggle({
          value: builder.get()[settingKey],
          label: event,
          onChange: (isEnabled) => {
            ;(settingKey === "tutorial" && cancelTutorialReplay(), builder.update({ [settingKey]: isEnabled }), settingKey === "autoBuy" && u())
          },
        }),
        element = createEl("div", `sf-field sf-settings__row${hintText ? " has-hint" : ""}`, createEl("span", "sf-field__label", createIconEl(settingIcon), event), createEl("span", "sf-field__ctl", leadingControl, ToggleValue.el))
      return ((element.dataset.sfSnd = "click"), element.addEventListener("click", () => ToggleValue.flip()), { row: element, toggle: ToggleValue, hint: hintText ? createEl("p", "sf-field__hint", hintText) : null })
    },
    rResult = createToggleRow("显示帧率", iconFor("fps"), "showFps"),
    rRResult = createToggleRow("镜头震动", iconFor("shake"), "cameraShake"),
    replayButton = uiMode === "match" ? createEl("button", "sf-link sf-settings__replay", "重看") : null,
    textValue = "金币够了自动购买推荐出装的下一件，阵亡时也会买。",
    autoBuyRow = createToggleRow("自动出装", iconFor("shop"), "autoBuy", textValue)
  function u() {
    if (!autoBuyRow.hint) return
    const autoBuyWarning = builder.autoBuyNote?.() ?? null
    ;((autoBuyRow.hint.textContent = autoBuyWarning ?? textValue), autoBuyRow.hint.classList.toggle("is-warn", autoBuyWarning !== null))
  }
  const objectiveHintsRow = createToggleRow("当前目标提示", iconFor("target"), "objectiveHints", "在屏幕上方提示现在该做什么。"),
    tutorialRow = createToggleRow("新手引导", iconFor("info"), "tutorial", "开局一步步教操作；打完一局后自动关闭。", replayButton)
  replayButton &&
    ((replayButton.type = "button"),
    (replayButton.dataset.sfSnd = "confirm"),
    replayButton.setAttribute("aria-label", "从第一步重看新手引导"),
    replayButton.addEventListener("click", (clickEvent) => {
      ;(clickEvent.stopPropagation(), cancelTutorialReplay())
      const restartTutorial = () => {
        ;((tutorialReplayTimer = 0), builder.update({ tutorial: !0 }))
      }
      ;(builder.get().tutorial ? (builder.onReplayTutorial ? builder.onReplayTutorial() : (builder.update({ tutorial: !1 }), (tutorialReplayTimer = window.setTimeout(restartTutorial, TUTORIAL_REPLAY_DELAY_MS)))) : restartTutorial(),
        tutorialRow.toggle.set(!0),
        (replayButton.textContent = "已从头开始"),
        window.setTimeout(() => {
          replayButton.textContent = "重看"
        }, 1600))
    }))
  const createVolumeRow = (volumeLabel, volumeIcon, musicvolumeKind) => {
      const element = createEl("span", "sf-field__val sf-num", formatVolumePercent(builder.get()[musicvolumeKind])),
        SliderValue = createSlider({
          value: builder.get()[musicvolumeKind],
          label: volumeLabel,
          onInput: (volumeValue) => {
            ;((element.textContent = formatVolumePercent(volumeValue)), builder.update({ [musicvolumeKind]: volumeValue }))
          },
          onCommit: () => {
            musicvolumeKind !== "musicVolume" && builder.audio?.ui("select")
          },
        })
      return { row: createEl("div", "sf-field", createEl("span", "sf-field__label", createIconEl(volumeIcon), volumeLabel), createEl("span", "sf-field__ctl", SliderValue.el, element)), slider: SliderValue, val: element }
    },
    pResult = createVolumeRow("主音量", iconFor("volume"), "masterVolume"),
    pPResult = createVolumeRow("音效", iconFor("sfx"), "sfxVolume"),
    musicVolumeRow = createVolumeRow("音乐", iconFor("music"), "musicVolume"),
    ElValue = createEl(
      "div",
      "sf-settings",
      createEl("section", "sf-settings__group sf-settings__group--assist", createEl("h3", "sf-heading", "对战辅助"), autoBuyRow.row, autoBuyRow.hint, objectiveHintsRow.row, objectiveHintsRow.hint, tutorialRow.row, tutorialRow.hint),
      createEl(
        "section",
        "sf-settings__group",
        createEl("h3", "sf-heading", "画面"),
        createEl("div", "sf-field", createEl("span", "sf-field__label", createIconEl(iconFor("quality")), "画质"), createEl("span", "sf-field__ctl sf-settings__quality", SegmentedControlValue.el)),
        element,
        rResult.row,
        rRResult.row,
      ),
      createEl("section", "sf-settings__group", createEl("h3", "sf-heading", "声音"), pResult.row, pPResult.row, musicVolumeRow.row),
    ),
    refreshSettings = () => {
      const Value = builder.get()
      ;(SegmentedControlValue.set(Value.quality),
        (element.textContent = QUALITY_DESCRIPTIONS[Value.quality]),
        rResult.toggle.set(Value.showFps),
        rRResult.toggle.set(Value.cameraShake),
        autoBuyRow.toggle.set(Value.autoBuy),
        u(),
        objectiveHintsRow.toggle.set(Value.objectiveHints),
        tutorialRow.toggle.set(Value.tutorial || tutorialReplayTimer !== 0),
        pResult.slider.set(Value.masterVolume),
        (pResult.val.textContent = formatVolumePercent(Value.masterVolume)),
        pPResult.slider.set(Value.sfxVolume),
        (pPResult.val.textContent = formatVolumePercent(Value.sfxVolume)),
        musicVolumeRow.slider.set(Value.musicVolume),
        (musicVolumeRow.val.textContent = formatVolumePercent(Value.musicVolume)))
    }
  refreshSettings()
  const createElElValue = createEl("button", "sf-link", createIconEl(iconFor("again")), "恢复默认")
  ;((createElElValue.type = "button"),
    (createElElValue.dataset.sfSnd = "click"),
    createElElValue.addEventListener("click", () => {
      const { quality: quality, tutorial: tutorialSetting, ...audioSettings } = minimapWorldToScreen
      ;(builder.update(audioSettings), refreshSettings())
    }))
  const ElResult = createEl("div", "sf-settings__foot", createElElValue)
  let confirmQuitTimerId = 0
  if (uiMode === "match") {
    const makePanelBodyElement = makePanelBody({ label: "返回主菜单", icon: iconFor("home"), variant: "ghost", sound: "back" }),
      querySelectorElement = makePanelBodyElement.querySelector(".sf-btn__label")
    let isActive = !1
    ;(makePanelBodyElement.addEventListener("click", () => {
      if (isActive) {
        ;(window.clearTimeout(confirmQuitTimerId), builder.onQuit?.())
        return
      }
      ;((isActive = !0),
        makePanelBodyElement.classList.remove("sf-btn--ghost"),
        makePanelBodyElement.classList.add("sf-btn--danger"),
        (querySelectorElement.textContent = "再点一次确认退出"),
        (confirmQuitTimerId = window.setTimeout(() => {
          ;((isActive = !1), makePanelBodyElement.classList.add("sf-btn--ghost"), makePanelBodyElement.classList.remove("sf-btn--danger"), (querySelectorElement.textContent = "返回主菜单"))
        }, 3e3)))
    }),
      ElResult.append(makePanelBodyElement, makePanelBody({ label: "继续游戏", icon: iconFor("play"), variant: "primary", sound: "confirm", onClick: () => builder.onResume?.() })))
  } else ElResult.append(makePanelBody({ label: "完成", variant: "primary", sound: "confirm", onClick: () => builder.onResume?.() }))
  return { el: ElValue, footer: ElResult, refresh: refreshSettings, dispose: () => window.clearTimeout(confirmQuitTimerId) }
}

export { MINIMAP_TUNING, minimapWorldToScreen, minimapUnitDot, mountMiniMapWidgets, MINIMAP_WIDGET_STATE }