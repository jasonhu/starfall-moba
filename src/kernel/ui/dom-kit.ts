/**
 * DOM 工具箱：元素创建、图标注入、样式类切换与 HUD 节点操作原语
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { UI_THEME_CSS, UI_COMPONENT_CSS } from './svg-icons'
import { SVG_FILL_CURRENT, SVG_STROKE_CURRENT, makeStarHudPath, starPath } from '../render/procedural-art'
import { buildIconSvg, darkenColor, diamondPath, linearGradientDef, gradientCircle, lightenColor, makeSvgIcon, radialGlowDef, radialGradientDef } from './icon-theme'

function expandCssUnits(cssText) {
  return preprocessCssColorMix(cssText).replace(/(^|[\s(,:])(-?(?:\d+\.?\d*|\.\d+))u(?![\w%])/g, (fullMatch, leadingChar, numberText) => `${leadingChar}calc(var(--sf-u) * ${numberText})`)
}

function expandColorMixFallback(cssText) {
  let total = "",
    cursor = 0
  for (;;) {
    const colorMixStart = cssText.indexOf("color-mix(", cursor)
    if (colorMixStart < 0) return total + cssText.slice(cursor)
    total += cssText.slice(cursor, colorMixStart)
    let parenDepth = 0,
      scanIndex = colorMixStart + 9
    const commaIndices = []
    for (; scanIndex < cssText.length; scanIndex++) {
      const selectedN = cssText[scanIndex]
      if (selectedN === "(") parenDepth++
      else if (selectedN === ")") {
        if ((parenDepth--, parenDepth === 0)) break
      } else selectedN === "," && parenDepth === 1 && commaIndices.push(scanIndex)
    }
    const fallbackColor =
      commaIndices.length >= 2
        ? cssText
            .slice(commaIndices[0] + 1, commaIndices[1])
            .trim()
            .replace(/\s+[\d.]+%$/, "")
        : "currentColor"
    ;((total += fallbackColor), (cursor = scanIndex + 1))
  }
}

function preprocessCssColorMix(cssText) {
  return cssText.replace(/([;{]\s*)([\w-]+)(\s*:\s*)([^;{}]*color-mix\([^;{}]*)/g, (fullMatch, separator, propertyName, colonSeparator, propertyValue) => `${separator}${propertyName}${colonSeparator}${expandColorMixFallback(propertyValue)}; ${propertyName}${colonSeparator}${propertyValue}`)
}

const uToCalc = (unitCount) => `calc(var(--sf-u) * ${unitCount})`

function injectStyleSheet(styleSheetId, cssText) {
  if (typeof document > "u" || document.getElementById(styleSheetId)) return
  const element = document.createElement("style")
  ;((element.id = styleSheetId), (element.textContent = cssText), document.head.appendChild(element))
}

function svgToDataUrl(svgMarkup) {
  return `url("data:image/svg+xml,${encodeURIComponent(svgMarkup).replace(/'/g, "%27").replace(/"/g, "%22")}")`
}

function createEl(tagName, className?, ...children) {
  const element = document.createElement(tagName)
  return (className && (element.className = className), appendChildren(element, ...children), element)
}

function appendChildren(element, ...children) {
  for (const child of children) child == null || child === !1 || element.appendChild(typeof child == "string" || typeof child == "number" ? document.createTextNode(String(child)) : child)
}

function createIconEl(iconMarkup, iconName?) {
  const element = document.createElement("span")
  return ((element.className = iconName ? `sf-i ${iconName}` : "sf-i"), (element.innerHTML = iconMarkup), element)
}

interface PanelOptions {
  button?: boolean
  round?: boolean
  cls?: string
  size?: string
  label?: string
}

/**
 * 创建界面。
 *
 * @param slotContent - 主要输入
 * @param panelOptions - 次要输入
 */
function makePanel(slotContent, panelOptions: PanelOptions = {}) {
  const element = document.createElement(panelOptions.button ? "button" : "span")
  return (
    (element.className = `sf-slot${panelOptions.round ? " sf-slot--round" : ""}${slotContent === null ? " sf-slot--empty" : ""}${panelOptions.cls ? ` ${panelOptions.cls}` : ""}`),
    panelOptions.size && element.style.setProperty("--sf-slot", panelOptions.size),
    panelOptions.label && element.setAttribute("aria-label", panelOptions.label),
    panelOptions.button && ((element as HTMLButtonElement).type = "button"),
    slotContent && (element.innerHTML = slotContent),
    element
  )
}

/**
 * 创建界面。
 *
 * @param buttonOptions - 主要输入
 */
function makePanelBody(buttonOptions) {
  const variant = buttonOptions.variant ?? "secondary",
    element = createEl(
      "button",
      `sf-btn${variant !== "secondary" ? ` sf-btn--${variant}` : ""}${buttonOptions.size && buttonOptions.size !== "md" ? ` sf-btn--${buttonOptions.size}` : ""}${buttonOptions.block ? " sf-btn--block" : ""}${buttonOptions.pulse ? " sf-btn--pulse" : ""}${buttonOptions.cls ? ` ${buttonOptions.cls}` : ""}`,
    )
  return (
    (element.type = "button"),
    (element.dataset.sfSnd = buttonOptions.sound ?? "click"),
    buttonOptions.pulse && element.appendChild(createEl("i", "sf-btn__glow")),
    buttonOptions.icon && element.appendChild(createIconEl(buttonOptions.icon)),
    element.appendChild(createEl("span", "sf-btn__label", buttonOptions.label)),
    buttonOptions.onClick && element.addEventListener("click", buttonOptions.onClick),
    element
  )
}

function makeIconButton(event) {
  const element = createEl("button", `sf-iconbtn${event.quiet ? " sf-iconbtn--quiet" : ""}${event.cls ? ` ${event.cls}` : ""}`, createIconEl(event.icon))
  return ((element.type = "button"), element.setAttribute("aria-label", event.label), (element.title = event.label), (element.dataset.sfSnd = event.sound ?? "click"), event.onClick && element.addEventListener("click", event.onClick), element)
}

function makeSegmentedControl(controlOptions) {
  let currentSelection = controlOptions.value
  const element = createEl("div", `sf-seg${controlOptions.block ? " sf-seg--block" : ""}`)
  ;(element.setAttribute("role", "radiogroup"), controlOptions.label && element.setAttribute("aria-label", controlOptions.label))
  const optionButtons = controlOptions.options.map((event) => {
    const optionButton = createEl("button", "sf-seg__opt", event.label)
    return (
      (optionButton.type = "button"),
      optionButton.setAttribute("role", "radio"),
      (optionButton.dataset.sfSnd = "select"),
      optionButton.addEventListener("click", () => {
        currentSelection !== event.value && (i(event.value), controlOptions.onChange(event.value))
      }),
      element.appendChild(optionButton),
      optionButton
    )
  })
  function i(nextSelection) {
    ;((currentSelection = nextSelection),
      controlOptions.options.forEach((option, index) => {
        const isOptionSelected = option.value === nextSelection
        ;(optionButtons[index].classList.toggle("is-active", isOptionSelected), optionButtons[index].setAttribute("aria-checked", String(isOptionSelected)))
      }))
  }
  return (i(currentSelection), { el: element, get: () => currentSelection, set: i })
}

function createTabs(event) {
  let selectedTabId = event.value
  const element = createEl("div", "sf-tabs")
  element.setAttribute("role", "tablist")
  const tabButtons = event.tabs.map((tab) => {
    const createElElement = createEl("button", "sf-tab", tab.icon ? createIconEl(tab.icon) : null, tab.label)
    return (
      (createElElement.type = "button"),
      createElElement.setAttribute("role", "tab"),
      (createElElement.dataset.sfSnd = "select"),
      createElElement.addEventListener("click", () => {
        selectedTabId !== tab.id && (i(tab.id), event.onChange(tab.id))
      }),
      element.appendChild(createElElement),
      createElElement
    )
  })
  function i(nextTabId) {
    ;((selectedTabId = nextTabId),
      event.tabs.forEach((tab, index) => {
        const isSelected = tab.id === nextTabId
        ;(tabButtons[index].classList.toggle("is-active", isSelected), tabButtons[index].setAttribute("aria-selected", String(isSelected)))
      }))
  }
  return (i(selectedTabId), { el: element, get: () => selectedTabId, set: i })
}

function createSlider(sliderOptions) {
  const sliderMin = sliderOptions.min ?? 0,
    sliderMax = sliderOptions.max ?? 1,
    element = createEl("input", "sf-slider")
  ;((element.type = "range"), (element.min = String(sliderMin)), (element.max = String(sliderMax)), (element.step = String(sliderOptions.step ?? 0.01)), sliderOptions.label && element.setAttribute("aria-label", sliderOptions.label))
  const updateFill = () => {
    const numberResult = Number(element.value)
    element.style.setProperty("--sf-fill", `${((numberResult - sliderMin) / (sliderMax - sliderMin || 1)) * 100}%`)
  }
  return (
    (element.value = String(sliderOptions.value)),
    updateFill(),
    element.addEventListener("input", () => {
      ;(updateFill(), sliderOptions.onInput(Number(element.value)))
    }),
    element.addEventListener("change", () => sliderOptions.onCommit?.(Number(element.value))),
    {
      el: element,
      get: () => Number(element.value),
      set: (targetObject) => {
        ;((element.value = String(targetObject)), updateFill())
      },
    }
  )
}

function createToggle(event) {
  let isChecked = event.value
  const element = createEl("button", "sf-toggle")
  ;((element.type = "button"), element.setAttribute("role", "switch"), event.label && element.setAttribute("aria-label", event.label), (element.dataset.sfSnd = "click"))
  const setChecked = (nextChecked) => {
      ;((isChecked = nextChecked), element.setAttribute("aria-checked", String(nextChecked)))
    },
    flipChecked = () => {
      ;(setChecked(!isChecked), event.onChange(isChecked))
    }
  return (
    element.addEventListener("click", (clickEvent) => {
      ;(clickEvent.stopPropagation(), flipChecked())
    }),
    setChecked(isChecked),
    { el: element, get: () => isChecked, set: setChecked, flip: flipChecked }
  )
}

function createProgressBar() {
  const element = createEl("div", "sf-progress", createEl("div", "sf-progress__fill"), createEl("div", "sf-progress__spark"))
  return (
    element.setAttribute("role", "progressbar"),
    element.setAttribute("aria-valuemin", "0"),
    element.setAttribute("aria-valuemax", "100"),
    {
      el: element,
      set: (progress) => {
        const clampedProgress = Math.max(0, Math.min(1, progress))
        ;(element.style.setProperty("--sf-p", String(clampedProgress)), element.setAttribute("aria-valuenow", String(Math.round(clampedProgress * 100))))
      },
    }
  )
}

function makeBadge(roleName, goldKind = "gold", iconName?) {
  return createEl("span", `sf-badge${goldKind !== "gold" ? ` sf-badge--${goldKind}` : ""}`, iconName ? createIconEl(iconName) : null, roleName)
}

const uiSoundNames = new Set(["click", "hover", "confirm", "back", "select", "buy", "error", "ready", "countdown"])

interface SoundElement extends HTMLElement {
  disabled?: boolean
}

/**
 * 处理音效。
 *
 * @param rootElement - 界面元素
 * @param audio - 音效
 */
function bindUiSounds(rootElement, audio) {
  let lastHoveredSoundEl: SoundElement | null = null
  const findSoundElement = (eventTarget): SoundElement | null => (eventTarget instanceof Element ? eventTarget.closest<SoundElement>("[data-sf-snd]") : null),
    unlockAudio = () => audio.unlock(),
    playHoverSound = (river) => {
      if (river.pointerType !== "mouse") return
      const sResult = findSoundElement(river.target)
      sResult !== lastHoveredSoundEl && ((lastHoveredSoundEl = sResult), sResult && !sResult.disabled && audio.ui("hover"))
    },
    playClickSound = /**
 * 处理事件。
 *
 * @param detail - 输入
 */
(detail) => {
      const sSResult = findSoundElement(detail.target)
      if (!sSResult || sSResult.disabled) return
      const lookupKey = sSResult.dataset.sfSnd ?? ""
      uiSoundNames.has(lookupKey) && audio.ui(lookupKey)
    }
  return (
    rootElement.addEventListener("pointerdown", unlockAudio, !0),
    window.addEventListener("keydown", unlockAudio, !0),
    rootElement.addEventListener("pointerover", playHoverSound),
    rootElement.addEventListener("click", playClickSound, !0),
    () => {
      ;(rootElement.removeEventListener("pointerdown", unlockAudio, !0), window.removeEventListener("keydown", unlockAudio, !0), rootElement.removeEventListener("pointerover", playHoverSound), rootElement.removeEventListener("click", playClickSound, !0))
    }
  )
}

interface OpenDialog {
  scrim: HTMLElement
  close: () => void
}

const closeIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  openDialogs = new Set<OpenDialog>()

function hasOpenDialog() {
  for (const openDialog of openDialogs) if (openDialog.scrim.isConnected) return !0
  return !1
}

function closeDialogs(containerElement?) {
  for (const fromopenDialog of Array.from(openDialogs)) (containerElement && fromopenDialog.scrim.isConnected && !containerElement.contains(fromopenDialog.scrim)) || (fromopenDialog.close(), fromopenDialog.scrim.remove())
}

function isFocusVisibleButton(containerElement) {
  const activeElement = document.activeElement
  return !(activeElement instanceof HTMLButtonElement) || (containerElement && !containerElement.contains(activeElement)) ? !1 : isFocusVisible(activeElement)
}

/**
 * 判断视野。
 *
 * @param element - 输入
 */
function isFocusVisible(element) {
  try {
    return element.matches(":focus-visible")
  } catch {
    return !0
  }
}

/**
 * 处理界面。
 *
 * @param element - 界面元素
 * @param dialogOptions - 次要输入
 */
function showModalDialog(element, dialogOptions) {
  const isClosable = dialogOptions.closable !== !1
  let isActive = !1
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null,
    previousFocus = activeElement && isFocusVisible(activeElement) ? activeElement : null,
    ElValue = createEl("h2", "sf-dialog__title sf-metal", dialogOptions.title),
    closeButton = isClosable ? createEl("button", "sf-iconbtn sf-iconbtn--quiet", createIconEl(closeIconSvg)) : null
  closeButton && ((closeButton.type = "button"), closeButton.setAttribute("aria-label", "关闭"), (closeButton.dataset.sfSnd = "back"))
  const createElElValue = createEl("div", "sf-dialog__body sf-scroll")
  appendChildren(createElElValue, ...(Array.isArray(dialogOptions.content) ? dialogOptions.content : [dialogOptions.content]))
  const footerElement = dialogOptions.footer ? createEl("div", "sf-dialog__foot") : null
  footerElement && appendChildren(footerElement, ...(Array.isArray(dialogOptions.footer) ? dialogOptions.footer : [dialogOptions.footer]))
  const dialogPanel = createEl("div", `sf-dialog sf-panel${dialogOptions.cls ? ` ${dialogOptions.cls}` : ""}`, createEl("div", "sf-dialog__head", ElValue, closeButton), createElElValue, footerElement)
  ;(dialogPanel.setAttribute("role", "dialog"), dialogPanel.setAttribute("aria-modal", "true"), dialogPanel.setAttribute("aria-label", dialogOptions.title), (dialogPanel.tabIndex = -1), dialogOptions.width && dialogPanel.style.setProperty("--sf-dialog-w", dialogOptions.width))
  const scrimElement = createEl("div", "sf-dialog-scrim", dialogPanel),
    lookupKey = { scrim: scrimElement, close: () => closeDialog() },
    closeDialog = () => {
      isActive ||
        ((isActive = !0),
        openDialogs.delete(lookupKey),
        window.removeEventListener("keydown", handleKeyDown, !0),
        document.removeEventListener("focusin", handleFocusIn),
        scrimElement.classList.add("is-leaving"),
        window.setTimeout(() => scrimElement.remove(), 180),
        previousFocus && previousFocus.isConnected ? previousFocus.focus({ preventScroll: !0 }) : document.activeElement instanceof HTMLElement && scrimElement.contains(document.activeElement) && document.activeElement.blur(),
        dialogOptions.onClose?.())
    },
    handleKeyDown = (keyEvent) => {
      if (!scrimElement.isConnected) {
        closeDialog()
        return
      }
      keyEvent.key !== "Escape" || !isClosable || (keyEvent.stopPropagation(), keyEvent.preventDefault(), closeDialog())
    },
    handleFocusIn = (focusEvent) => {
      isActive || !scrimElement.isConnected || scrimElement.nextElementSibling?.classList.contains("sf-dialog-scrim") || (focusEvent.target instanceof Node && !scrimElement.contains(focusEvent.target) && dialogPanel.focus({ preventScroll: !0 }))
    }
  return (
    scrimElement.addEventListener("pointerdown", (pointerEvent) => {
      pointerEvent.target === scrimElement && isClosable && closeDialog()
    }),
    closeButton?.addEventListener("click", closeDialog),
    window.addEventListener("keydown", handleKeyDown, !0),
    document.addEventListener("focusin", handleFocusIn),
    element.appendChild(scrimElement),
    openDialogs.add(lookupKey),
    dialogPanel.focus({ preventScroll: !0 }),
    { el: scrimElement, body: createElElValue, close: closeDialog }
  )
}

let tooltipEl = null,
  tooltipAnchorEl = null,
  tooltipHideTimer = 0,
  tooltipDismissBound = !1,
  lastPointerX = NaN,
  lastPointerY = NaN

/** 记录最后一次鼠标坐标（由内核的全局 pointermove/pointerdown 监听写入） */
export function setLastPointerPos(pointerX, propertyName) {
  lastPointerX = pointerX
  lastPointerY = propertyName
}

function bindTooltipDismiss() {
  tooltipDismissBound ||
    ((tooltipDismissBound = !0),
    document.addEventListener(
      "pointerdown",
      (pointerEvent) => {
        tooltipAnchorEl && pointerEvent.target instanceof Node && !tooltipAnchorEl.contains(pointerEvent.target) && hideTooltip()
      },
      !0,
    ))
}

function hideTooltip() {
  ;(window.clearTimeout(tooltipHideTimer), (tooltipAnchorEl = null), tooltipEl && tooltipEl.classList.remove("is-open"))
}

function showTooltip(anchorElement, tooltipContent) {
  if (!anchorElement.isConnected) return
  const element = anchorElement.closest(".sf-root") ?? document.body
  ;(tooltipEl || ((tooltipEl = document.createElement("div")), (tooltipEl.className = "sf-tip"), tooltipEl.setAttribute("role", "tooltip")),
    tooltipEl.parentElement !== element && element.appendChild(tooltipEl),
    (tooltipEl.textContent = ""),
    typeof tooltipContent == "string" ? (tooltipEl.innerHTML = tooltipContent) : tooltipEl.appendChild(tooltipContent),
    (tooltipAnchorEl = anchorElement),
    (tooltipEl.style.transform = "none"),
    (tooltipEl.style.left = "0px"),
    (tooltipEl.style.top = "0px"))
  const BoundingClientRectValue = anchorElement.getBoundingClientRect(),
    tooltipWidth = tooltipEl.offsetWidth,
    tooltipHeight = tooltipEl.offsetHeight,
    tooltipGap = 8,
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight
  let tooltipLeft = BoundingClientRectValue.left + BoundingClientRectValue.width / 2 - tooltipWidth / 2
  tooltipLeft = Math.max(8, Math.min(viewportWidth - tooltipWidth - 8, tooltipLeft))
  let tooltipTop = BoundingClientRectValue.top - tooltipHeight - tooltipGap
  ;(tooltipTop < 8 && (tooltipTop = Math.min(viewportHeight - tooltipHeight - 8, BoundingClientRectValue.bottom + tooltipGap)),
    (tooltipEl.style.left = `${Math.round(tooltipLeft)}px`),
    (tooltipEl.style.top = `${Math.round(Math.max(8, tooltipTop))}px`),
    (tooltipEl.style.transform = ""),
    tooltipEl.offsetWidth,
    tooltipEl.classList.add("is-open"))
}

interface TooltipOptions {
  touch?: "tap" | "longpress"
}

function bindTooltip(anchorElement, getTooltipContent, tooltipOptions: TooltipOptions = {}) {
  const touchMode = tooltipOptions.touch ?? "tap"
  let pressTimer = 0,
    startX = 0,
    startY = 0,
    isPointerActive = !1
  const showBoundTooltip = () => showTooltip(anchorElement, getTooltipContent()),
    handlePointerEnter = (pointerEvent) => {
      pointerEvent.pointerType === "mouse" && (pointerEvent.clientX === lastPointerX && pointerEvent.clientY === lastPointerY ? (isPointerActive = !0) : showBoundTooltip())
    },
    handlePointerLeave = (pointerEvent) => {
      ;((isPointerActive = !1), pointerEvent.pointerType === "mouse" && tooltipAnchorEl === anchorElement && hideTooltip())
    },
    scheduleTooltipHide = () => {
      ;(window.clearTimeout(tooltipHideTimer),
        (tooltipHideTimer = window.setTimeout(() => {
          tooltipAnchorEl === anchorElement && hideTooltip()
        }, 4200)))
    },
    handlePointerDown = (pointerEvent) => {
      pointerEvent.pointerType !== "mouse" &&
        ((startX = pointerEvent.clientX),
        (startY = pointerEvent.clientY),
        window.clearTimeout(pressTimer),
        touchMode === "longpress" &&
          (pressTimer = window.setTimeout(() => {
            ;(showBoundTooltip(), scheduleTooltipHide())
          }, 350)))
    },
    distance = /**
 * 处理距离。
 *
 * @param pointerEvent - 主要输入
 */
(pointerEvent) => {
      if (pointerEvent.pointerType === "mouse") {
        isPointerActive && ((isPointerActive = !1), showBoundTooltip())
        return
      }
      Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) > 10 && window.clearTimeout(pressTimer)
    },
    handlePointerUp = (pointerEvent) => {
      pointerEvent.pointerType !== "mouse" && (window.clearTimeout(pressTimer), touchMode === "tap" && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) <= 10 && (tooltipAnchorEl === anchorElement ? hideTooltip() : (showBoundTooltip(), scheduleTooltipHide())))
    },
    handlePointerCancel = () => window.clearTimeout(pressTimer),
    handleFocus = () => {
      isFocusVisible(anchorElement) && showBoundTooltip()
    },
    handleBlur = () => {
      tooltipAnchorEl === anchorElement && hideTooltip()
    }
  return (
    bindTooltipDismiss(),
    anchorElement.addEventListener("pointerenter", handlePointerEnter),
    anchorElement.addEventListener("pointerleave", handlePointerLeave),
    anchorElement.addEventListener("pointerdown", handlePointerDown),
    anchorElement.addEventListener("pointermove", distance),
    anchorElement.addEventListener("pointerup", handlePointerUp),
    anchorElement.addEventListener("pointercancel", handlePointerCancel),
    anchorElement.addEventListener("focus", handleFocus),
    anchorElement.addEventListener("blur", handleBlur),
    () => {
      ;(window.clearTimeout(pressTimer),
        tooltipAnchorEl === anchorElement && hideTooltip(),
        anchorElement.removeEventListener("pointerenter", handlePointerEnter),
        anchorElement.removeEventListener("pointerleave", handlePointerLeave),
        anchorElement.removeEventListener("pointerdown", handlePointerDown),
        anchorElement.removeEventListener("pointermove", distance),
        anchorElement.removeEventListener("pointerup", handlePointerUp),
        anchorElement.removeEventListener("pointercancel", handlePointerCancel),
        anchorElement.removeEventListener("focus", handleFocus),
        anchorElement.removeEventListener("blur", handleBlur))
    }
  )
}

function refreshHud() {
  hideTooltip()
}

function scheduleUiUpdate(anchorElement, tooltipContent, delayMs = 0) {
  ;(bindTooltipDismiss(),
    window.clearTimeout(tooltipHideTimer),
    showTooltip(anchorElement, tooltipContent),
    delayMs > 0 &&
      (tooltipHideTimer = window.setTimeout(() => {
        tooltipAnchorEl === anchorElement && hideTooltip()
      }, delayMs)))
}

function isTooltipOpen(anchorElement) {
  return tooltipAnchorEl === anchorElement && !!tooltipEl && tooltipEl.classList.contains("is-open")
}

function injectThemeStyles() {
  ;(injectStyleSheet("sf-theme-tokens", UI_THEME_CSS), injectStyleSheet("sf-theme-components", UI_COMPONENT_CSS))
}

const BLADE_ICON_PATH = `<path d="M21.2 2.8l-1 5.6-8.9 8.9-3.6-3.6 8.9-8.9z" ${SVG_FILL_CURRENT}/><path d="M4.6 12.6l6.8 6.8M7.2 16.8l-3.6 3.6" ${SVG_STROKE_CURRENT(2.5)}/>`,
  LANE_SLOT_BACKDROP_SVG =
    '<rect x="2.8" y="2.8" width="18.4" height="18.4" rx="3" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-opacity=".5" stroke-width="1.4"/><rect x="4.6" y="15.6" width="3.8" height="3.8" rx=".8" fill="currentColor" fill-opacity=".55"/><rect x="15.6" y="4.6" width="3.8" height="3.8" rx=".8" fill="currentColor" fill-opacity=".55"/>',
  HUD_ICON_PATHS = {
    kill: BLADE_ICON_PATH,
    death: `<path fill-rule="evenodd" d="M12 2.4c-4.8 0-8.2 3.2-8.2 7.7 0 2.6 1.2 4.6 3 5.9v2.8c0 .9.7 1.6 1.6 1.6h7.2c.9 0 1.6-.7 1.6-1.6V16c1.8-1.3 3-3.3 3-5.9 0-4.5-3.400-7.700-8.200-7.700zM8.700 8.600a2.300 2.300 0 1 0 0 4.600a2.300 2.300 0 1 0 0-4.600zM15.300 8.600a2.300 2.300 0 1 0 0 4.600a2.300 2.300 0 1 0 0-4.600zM12 13.400l-1.300 2.400h2.600zM10 17.600h.9v2.800H10zM13.100 17.600h.9v2.800h-.9z" ${SVG_FILL_CURRENT}/>`,
    assist: `<g ${SVG_FILL_CURRENT}><rect x="6.600" y="10" width="11" height="11.400" rx="3.600"/><rect x="6.600" y="4.800" width="2.300" height="8" rx="1.150"/><rect x="9.500" y="2.800" width="2.300" height="9" rx="1.150"/><rect x="12.400" y="3.200" width="2.300" height="9" rx="1.150"/><rect x="15.300" y="5.200" width="2.300" height="8" rx="1.150"/><rect x="2.900" y="11" width="2.500" height="7.200" rx="1.250" transform="rotate(-32 4.150 14.600)"/></g>`,
    cs: `<path fill-rule="evenodd" d="M5.500 9.500l-2-5.700 5 2.700a8.500 8.500 0 0 1 7 0l5-2.700-2 5.700c1 1.300 1.500 2.800 1.500 4.500 0 4-3.400 7-8 7s-8-3-8-7c0-1.700.5-3.200 1.500-4.500zM6.800 12.800l4 1.400v1.600l-4-.6zM17.200 12.800l-4 1.400v1.600l4-.6z" ${SVG_FILL_CURRENT}/>`,
    damage: `<path d="${starPath(12, 12, 8, 10.4, 4.6)}" ${SVG_FILL_CURRENT}/>`,
    shield: `<path fill-rule="evenodd" d="M12 2.200l8 3v6.300c0 5-3.400 8.500-8 10.300-4.600-1.800-8-5.300-8-10.300V5.200zM12 5l-5.400 2v4.500c0 3.300 2.200 5.900 5.400 7.300z" ${SVG_FILL_CURRENT}/>`,
    tower: `<path d="M12 1.800l3.600 6.200-1.700 7.500h-3.800L8.400 8z" ${SVG_FILL_CURRENT}/><path d="M5.500 10.500Q12 14 18.500 10.500" ${SVG_STROKE_CURRENT(1.6)} opacity=".7"/><path d="M7 17.200h10l1.800 4.300H5.200z" ${SVG_FILL_CURRENT}/>`,
    core: `<path d="M12 1.800l6 7.200-6 9.200-6-9.200z" ${SVG_FILL_CURRENT}/><path d="M4 16.500Q12 22.500 20 16.500" ${SVG_STROKE_CURRENT(1.8)}/><path d="M7.500 20.800h9" ${SVG_STROKE_CURRENT(1.8)}/>`,
    monster: `<path d="M5 3.500C7.500 8.500 8 14 6 20.500M11 2.500C13.500 8 14 14.500 12 21.500M17 3.500C19.500 8.500 20 14 18 20.500" ${SVG_STROKE_CURRENT(2.6)}/>`,
    heart: `<path d="M12 21l-8.200-8.200C1.500 10.300 2 6.300 5 4.600c2.400-1.300 5.200-.5 7 1.900 1.800-2.400 4.600-3.200 7-1.900 3 1.700 3.500 5.700 1.200 8.200z" ${SVG_FILL_CURRENT}/>`,
    mana: `<path d="M12 2.200c3.200 4.200 6.500 8 6.500 12a6.500 6.500 0 0 1-13 0c0-4 3.300-7.800 6.500-12z" ${SVG_FILL_CURRENT}/>`,
    level: `<path d="M12 3l7.500 8H15v4.500H9V11H4.500zM9 17.500h6v2.800H9z" ${SVG_FILL_CURRENT}/>`,
    crown: `<path d="M3.500 17.500L2 7l5.500 4.200L12 3.500l4.500 7.700L22 7l-1.500 10.500zM4 19.300h16v2.200H4z" ${SVG_FILL_CURRENT}/>`,
    settings: `<path fill-rule="evenodd" d="${makeStarHudPath()}" ${SVG_FILL_CURRENT}/>`,
    pause: `<rect x="5.500" y="4" width="4.600" height="16" rx="1.500" ${SVG_FILL_CURRENT}/><rect x="13.900" y="4" width="4.600" height="16" rx="1.500" ${SVG_FILL_CURRENT}/>`,
    play: `<path d="M7 3.800v16.400c0 .8.900 1.300 1.600.8l12-8.200c.6-.4.6-1.200 0-1.600l-12-8.200c-.7-.5-1.600 0-1.600.8z" ${SVG_FILL_CURRENT}/>`,
    close: `<path d="M5.500 5.500l13 13M18.500 5.500l-13 13" ${SVG_STROKE_CURRENT(2.8)}/>`,
    check: `<path d="M4.500 12.500l5 5L19.500 7" ${SVG_STROKE_CURRENT(2.9)}/>`,
    plus: `<path d="M12 4.500v15M4.500 12h15" ${SVG_STROKE_CURRENT(2.8)}/>`,
    minus: `<path d="M4.500 12h15" ${SVG_STROKE_CURRENT(2.8)}/>`,
    back: `<path d="M10.500 5L3.500 12l7 7M4.500 12H20.500" ${SVG_STROKE_CURRENT(2.6)}/>`,
    chevron_left: `<path d="M14.500 4.500L7 12l7.500 7.500" ${SVG_STROKE_CURRENT(2.8)}/>`,
    chevron_right: `<path d="M9.500 4.500L17 12l-7.500 7.500" ${SVG_STROKE_CURRENT(2.8)}/>`,
    chevron_up: `<path d="M4.500 14.500L12 7l7.500 7.500" ${SVG_STROKE_CURRENT(2.8)}/>`,
    chevron_down: `<path d="M4.500 9.500L12 17l7.500-7.500" ${SVG_STROKE_CURRENT(2.8)}/>`,
    home: `<path d="M12 2.800L2.500 11h2.800v9.200h5v-6h3.400v6h5V11h2.800z" ${SVG_FILL_CURRENT}/>`,
    again: `<path d="M19.500 12a7.500 7.500 0 1 1-2.400-5.500" ${SVG_STROKE_CURRENT(2.5)}/><path d="M20.500 2.800v5.400h-5.400z" ${SVG_FILL_CURRENT}/>`,
    lock: `<path d="M8 10.200V7.800a4 4 0 0 1 8 0v2.400" ${SVG_STROKE_CURRENT(2.3)}/><path fill-rule="evenodd" d="M6.500 10h11c1 0 1.800.8 1.800 1.800v7.400c0 1-.8 1.800-1.800 1.800h-11c-1 0-1.800-.8-1.800-1.800v-7.400c0-1 .8-1.800 1.800-1.800zM12 13.200a1.700 1.700 0 0 0-.9 3.100v2h1.800v-2a1.700 1.700 0 0 0-.9-3.100z" ${SVG_FILL_CURRENT}/>`,
    info: `<circle cx="12" cy="12" r="9" ${SVG_STROKE_CURRENT(2)}/><path d="M12 11v6" ${SVG_STROKE_CURRENT(2.4)}/><circle cx="12" cy="7.600" r="1.400" ${SVG_FILL_CURRENT}/>`,
    clock: `<circle cx="12" cy="12" r="9" ${SVG_STROKE_CURRENT(2)}/><path d="M12 6.800V12l3.600 2.400" ${SVG_STROKE_CURRENT(2.2)}/>`,
    hourglass: `<path d="M6 3h12M6 21h12M7.500 3v3.500c0 2.500 4.500 4 4.500 5.500s-4.500 3-4.500 5.500V21M16.500 3v3.500c0 2.500-4.500 4-4.500 5.500s4.500 3 4.500 5.500V21" ${SVG_STROKE_CURRENT(2)}/>`,
    eye: `<path d="M1.800 12C4.500 7.500 8 5.300 12 5.300S19.500 7.500 22.200 12c-2.700 4.500-6.200 6.700-10.200 6.700S4.500 16.500 1.800 12z" ${SVG_STROKE_CURRENT(2)}/><circle cx="12" cy="12" r="3.200" ${SVG_FILL_CURRENT}/>`,
    target: `<circle cx="12" cy="12" r="7" ${SVG_STROKE_CURRENT(2)}/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" ${SVG_STROKE_CURRENT(2.2)}/><circle cx="12" cy="12" r="1.800" ${SVG_FILL_CURRENT}/>`,
    cancel: `<circle cx="12" cy="12" r="9" ${SVG_STROKE_CURRENT(2.3)}/><path d="M5.800 5.800l12.400 12.400" ${SVG_STROKE_CURRENT(2.3)}/>`,
    shop: `<path fill-rule="evenodd" d="M9 2.800h6l-1.300 3.400c3.600 2.200 6.300 6.200 6.300 9.800 0 3.600-3 5.500-8 5.500s-8-1.900-8-5.500c0-3.600 2.700-7.600 6.300-9.800zM${diamondPath(12, 14, 4.6, 0.2).slice(1)}" ${SVG_FILL_CURRENT}/>`,
    scoreboard: `<g ${SVG_FILL_CURRENT}><rect x="2.800" y="3.600" width="4.400" height="4.400" rx="1.100"/><rect x="9.300" y="4.600" width="12" height="2.400" rx="1.200"/><rect x="2.800" y="9.800" width="4.400" height="4.400" rx="1.100"/><rect x="9.300" y="10.800" width="12" height="2.400" rx="1.200"/><rect x="2.800" y="16" width="4.400" height="4.400" rx="1.100"/><rect x="9.300" y="17" width="12" height="2.400" rx="1.200"/></g>`,
    volume: `<path d="M3 9.200h3.600L12 4.500v15l-5.400-4.700H3z" ${SVG_FILL_CURRENT}/><path d="M15.300 8.500a5 5 0 0 1 0 7M18 5.800a8.800 8.800 0 0 1 0 12.400" ${SVG_STROKE_CURRENT(2.1)}/>`,
    mute: `<path d="M3 9.200h3.600L12 4.500v15l-5.400-4.700H3z" ${SVG_FILL_CURRENT}/><path d="M15.500 9l5.500 6M21 9l-5.500 6" ${SVG_STROKE_CURRENT(2.3)}/>`,
    sfx: `<path d="M3 9.200h3.600L12 4.500v15l-5.400-4.700H3z" ${SVG_FILL_CURRENT}/><path d="M${diamondPath(18, 12, 4.8, 0.2).slice(1)}" ${SVG_FILL_CURRENT}/>`,
    music: `<path d="M8.800 18V5.800l10.400-2.300V15.500" ${SVG_STROKE_CURRENT(2.2)}/><ellipse cx="6.300" cy="18" rx="3" ry="2.500" ${SVG_FILL_CURRENT}/><ellipse cx="16.700" cy="15.500" rx="3" ry="2.500" ${SVG_FILL_CURRENT}/>`,
    quality: `<path d="M12 2.500l7.500 6.500-7.500 12.500L4.500 9z" ${SVG_STROKE_CURRENT(2)}/><path d="M4.500 9h15M9 9l3 12.500M15 9l-3 12.500M12 2.500L9 9M12 2.500l3 6.500" ${SVG_STROKE_CURRENT(1.3)}/>`,
    fps: `<path d="M3.500 17a8.500 8.500 0 1 1 17 0" ${SVG_STROKE_CURRENT(2.3)}/><path d="M12 17l4.500-7" ${SVG_STROKE_CURRENT(2.5)}/><circle cx="12" cy="17" r="2" ${SVG_FILL_CURRENT}/>`,
    shake: `<rect x="6.500" y="6" width="11" height="12" rx="2.200" ${SVG_STROKE_CURRENT(2.2)}/><circle cx="12" cy="12" r="2.400" ${SVG_FILL_CURRENT}/><path d="M2.500 8.500v7M21.500 8.500v7" ${SVG_STROKE_CURRENT(2.2)}/>`,
    keyboard: `<rect x="2" y="5.500" width="20" height="13" rx="2.500" ${SVG_STROKE_CURRENT(2)}/><path d="M6 9.500h1M10 9.500h1M14 9.500h1M18 9.500h.300M6 12.500h1M10 12.500h1M14 12.500h1M18 12.500h.300M8 15.500h8" ${SVG_STROKE_CURRENT(1.8)}/>`,
    mouse: `<rect x="6.500" y="2.500" width="11" height="19" rx="5.500" ${SVG_STROKE_CURRENT(2)}/><path d="M12 2.500v7M6.500 9.500h11" ${SVG_STROKE_CURRENT(1.8)}/>`,
    touch: `<path d="M9.200 11.500V5.200a1.900 1.900 0 0 1 3.800 0v5.300l4.600 1.200c1.200.3 2 1.500 1.800 2.700l-.8 4.800c-.2 1.200-1.200 2-2.400 2h-4.500c-.8 0-1.500-.4-2-1l-4-5.200c-.6-.8-.4-1.900.4-2.400.7-.4 1.500-.3 2.100.2z" ${SVG_FILL_CURRENT}/><path d="M5.500 6.500a5.700 5.700 0 0 1 11.200-1.500" ${SVG_STROKE_CURRENT(1.7)} opacity=".7"/>`,
    joystick: `<circle cx="12" cy="12" r="9.500" ${SVG_STROKE_CURRENT(1.8)} opacity=".6"/><circle cx="12" cy="12" r="4.400" ${SVG_FILL_CURRENT}/>`,
    star: `<path d="${starPath(12, 12.6, 5, 10.2, 4.3)}" ${SVG_FILL_CURRENT}/>`,
    star_empty: `<path d="${starPath(12, 12.6, 5, 9.4, 4.1)}" ${SVG_STROKE_CURRENT(1.7)}/>`,
    spark: `<path d="${diamondPath(12, 12, 10.5, 0.18)}" ${SVG_FILL_CURRENT}/>`,
  },
  getHudIconPath = (iconName) => HUD_ICON_PATHS[iconName],
  svgFillAttr = SVG_FILL_CURRENT,
  svgStrokeAttr = SVG_STROKE_CURRENT

/**
 * 创建图标。
 *
 */
function createGoldIcon() {
  return makeSvgIcon(
    24,
    `<defs>${linearGradientDef("c", 4, 2, 20, 22, [
      [0, "#fff6d8"],
      [0.45, "#f3cf85"],
      [1, "#a8742c"],
    ])}${radialGradientDef("h", 9, 8, 9, [
      [0, "#ffffff", 0.9],
      [1, "#ffffff", 0],
    ])}</defs><circle cx="12" cy="12" r="10" fill="url(#@c)" stroke="#6b4614" stroke-width="1.200"/><circle cx="12" cy="12" r="7.200" fill="none" stroke="#8d6226" stroke-width="1" opacity=".8"/><path d="${diamondPath(12, 12, 5.6, 0.22)}" fill="#7a5220"/><path d="${diamondPath(12, 11.5, 5.2, 0.22)}" fill="#fff4d6"/><circle cx="9" cy="8" r="6" fill="url(#@h)"/>`,
    "sf-ico sf-ico--color",
  )
}

function iconFor(iconName) {
  return iconName === "gold" ? createGoldIcon() : makeSvgIcon(24, HUD_ICON_PATHS[iconName])
}

const roleIconPaths = {
  tank: `<path fill-rule="evenodd" d="M12 1.800l8.500 3.200v6.500c0 5.200-3.600 8.900-8.500 10.700-4.900-1.800-8.500-5.500-8.500-10.700V5zM12 4.700L6.200 6.900v4.600c0 3.600 2.400 6.300 5.800 7.800 3.400-1.500 5.800-4.200 5.800-7.800V6.900zM12 7.500l3.500 4.300-3.500 4.700-3.500-4.700z" ${SVG_FILL_CURRENT}/>`,
  fighter: `${BLADE_ICON_PATH}<g transform="matrix(-1 0 0 1 24 0)">${BLADE_ICON_PATH}</g>`,
  mage: `<path d="${diamondPath(10, 13.5, 8.8, 0.2)}" ${SVG_FILL_CURRENT}/><path d="${diamondPath(18.8, 5.6, 4, 0.2)}" ${SVG_FILL_CURRENT}/><path d="${diamondPath(19.5, 18.2, 2.6, 0.2)}" ${SVG_FILL_CURRENT}/>`,
  marksman: `<path d="M6.500 2.800c8.500 3 8.500 15.400 0 18.400" ${SVG_STROKE_CURRENT(2.5)}/><path d="M6.500 2.800v18.400" ${SVG_STROKE_CURRENT(1.3)}/><path d="M2.500 12h14" ${SVG_STROKE_CURRENT(2.2)}/><path d="M15.500 7.800L22.300 12l-6.800 4.200z" ${SVG_FILL_CURRENT}/>`,
  assassin: `<path d="M12 22.500l-3.400-12.300L12 7.200l3.400 3-3.400 12.300z" ${SVG_FILL_CURRENT}/><path d="M6.800 7h10.400" ${SVG_STROKE_CURRENT(2.6)}/><path d="M12 1.800v4" ${SVG_STROKE_CURRENT(3)}/><path d="M4 13.500l2.500 4M20 13.500l-2.500 4" ${SVG_STROKE_CURRENT(1.7)} opacity=".75"/>`,
}

function makeIconByName(roleName) {
  return makeSvgIcon(24, roleIconPaths[roleName])
}

const laneIconPaths = {
  top: `${LANE_SLOT_BACKDROP_SVG}<path d="M6.500 14.500V8.500q0-2 2-2h6" ${SVG_STROKE_CURRENT(2.6)}/>`,
  mid: `${LANE_SLOT_BACKDROP_SVG}<path d="M8.300 15.700l7.400-7.400" ${SVG_STROKE_CURRENT(2.6)}/>`,
  bot: `${LANE_SLOT_BACKDROP_SVG}<path d="M9.500 17.500h6q2 0 2-2v-6" ${SVG_STROKE_CURRENT(2.6)}/>`,
  jungle: `${LANE_SLOT_BACKDROP_SVG}<path d="M12.200 6.200c2.800 1.600 3.800 4.400 2.600 7.400-.5 1.300-1.500 2.300-2.800 2.800-2.200-1.600-3-4-2.200-6.600.4-1.400 1.200-2.600 2.400-3.600zM12 11v6.800" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`,
}

function createLaneIcon(lane) {
  return makeSvgIcon(24, laneIconPaths[lane])
}

const laneLabels = { top: "上路", mid: "中路", bot: "下路", jungle: "打野" },
  statusEffects = {
    stun: { name: "眩晕", kind: "debuff" },
    airborne: { name: "击飞", kind: "debuff" },
    root: { name: "定身", kind: "debuff" },
    slow: { name: "减速", kind: "debuff" },
    silence: { name: "沉默", kind: "debuff" },
    shield: { name: "护盾", kind: "buff" },
    haste: { name: "加速", kind: "buff" },
    attack_speed: { name: "攻速提升", kind: "buff" },
    dmg_reduction: { name: "减伤", kind: "buff" },
    untargetable: { name: "不可选中", kind: "buff" },
    unstoppable: { name: "免疫控制", kind: "buff" },
    burn: { name: "灼烧", kind: "debuff" },
    recall: { name: "回城中", kind: "neutral" },
    restore: { name: "疗伤中", kind: "buff" },
    fountain: { name: "泉水回复", kind: "buff" },
    respawn_guard: { name: "复活保护", kind: "buff" },
    frost_insight: { name: "蓝buff", kind: "buff" },
    ember_might: { name: "红buff", kind: "buff" },
    star_blessing: { name: "巨灵buff", kind: "buff" },
    panyue_passive: { name: "覆盾震地", kind: "buff" },
    panyue_bulwark: { name: "拥盾怒目", kind: "buff" },
    chijin_ember: { name: "越砍越勇", kind: "buff" },
    chijin_blaze: { name: "半路杀出 · 攻速", kind: "buff" },
    chijin_spin: { name: "抡圆了砍", kind: "buff" },
    xingli_mark: { name: "余音", kind: "debuff" },
    fengling_gale: { name: "连射", kind: "buff" },
    fengling_crit: { name: "下一箭必暴", kind: "buff" },
    yeque_shadow: { name: "得手", kind: "buff" },
    tower_focus: { name: "防御塔锁定", kind: "debuff" },
  },
  SVG_FILL_ATTR = svgFillAttr,
  SVG_STROKE_ATTR = svgStrokeAttr

/**
 * 创建英雄与图标。
 *
 * @param baseColor - 来源
 * @param portraitSvg - 次要输入
 */
function buildHeroPortraitIcon(baseColor, portraitSvg) {
  return buildIconSvg(
    [lightenColor(baseColor, 0.3), darkenColor(baseColor, 0.3), darkenColor(baseColor, 0.82)],
    radialGlowDef("g", lightenColor(baseColor, 0.55), 0.75),
    gradientCircle("g", 32, 30, 27) + `<g transform="translate(8.8 10) scale(1.96)" style="color:#060a16" opacity=".5">${portraitSvg}</g><g transform="translate(8 8) scale(2)" style="color:#ffffff">${portraitSvg}</g>`,
  )
}

export { createProgressBar, makeIconByName, createSlider, SVG_STROKE_ATTR, isTooltipOpen, uToCalc, injectThemeStyles, buildHeroPortraitIcon, expandCssUnits, bindTooltip, getHudIconPath, laneLabels, hasOpenDialog, makeIconButton, scheduleUiUpdate, statusEffects, makeSegmentedControl, createTabs, showModalDialog, isFocusVisibleButton, SVG_FILL_ATTR, injectStyleSheet, HUD_ICON_PATHS, createEl, createIconEl, iconFor, createToggle, svgToDataUrl, createLaneIcon, makePanelBody, closeDialogs, bindUiSounds, makePanel, makeBadge, refreshHud }