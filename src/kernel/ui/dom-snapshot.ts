/**
 * DOM 快照工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { HUD_CSS, HUD_LOGO_SVG, HUD_STYLE_ELEMENT_ID } from './hud-styles'

/**
 * 处理界面。
 *
 */
function injectHudStyle() {
  if (document.getElementById(HUD_STYLE_ELEMENT_ID)) return
  const element = document.createElement("style")
  ;((element.id = HUD_STYLE_ELEMENT_ID), (element.textContent = HUD_CSS), (document.head ?? document.documentElement).appendChild(element))
}

/**
 * 处理界面。
 *
 * @param element - 界面元素
 * @param dialogConfig - 次要输入
 */
function showAppCardDialog(element, dialogConfig) {
  injectHudStyle()
  const createElementElement = document.createElement("div")
  ;((createElementElement.className = `app-layer${dialogConfig.page ? " app-layer--page" : ""}`), createElementElement.setAttribute("role", "alertdialog"), createElementElement.setAttribute("aria-modal", "true"), createElementElement.setAttribute("aria-label", dialogConfig.title))
  const cardElement = document.createElement("div")
  ;((cardElement.className = `app-card${dialogConfig.tone === "error" ? " app-card--error" : ""}`), (cardElement.innerHTML = HUD_LOGO_SVG))
  const titleElement = document.createElement("h2")
  ;((titleElement.className = "app-card__title"), (titleElement.textContent = dialogConfig.title), cardElement.appendChild(titleElement))
  for (const builder of dialogConfig.lines) {
    const lineElement = document.createElement("p")
    ;((lineElement.className = "app-card__text"), (lineElement.textContent = builder), cardElement.appendChild(lineElement))
  }
  if (dialogConfig.list && dialogConfig.list.length > 0) {
    const listElement = document.createElement("ul")
    listElement.className = "app-card__list"
    for (const listItemText of dialogConfig.list) {
      const listItemElement = document.createElement("li")
      ;((listItemElement.textContent = listItemText), listElement.appendChild(listItemElement))
    }
    cardElement.appendChild(listElement)
  }
  let detailElement = null
  const appendDetail = (detailLine) => {
      detailElement || ((detailElement = document.createElement("pre")), (detailElement.className = "app-card__detail"), cardElement.insertBefore(detailElement, buttonBar))
      const detailLines = detailElement.textContent
        ? detailElement.textContent.split(`
`)
        : []
      ;(detailLines.push(detailLine),
        (detailElement.textContent = detailLines.slice(-6).join(`
`)))
    },
    buttonBar = document.createElement("div")
  buttonBar.className = "app-card__btns"
  let isActive = !1
  const closeDialog = () => {
    isActive || ((isActive = !0), window.removeEventListener("keydown", handleDialogKeyEvent, !0), window.removeEventListener("keyup", handleDialogKeyEvent, !0), createElementElement.remove())
  }
  let primaryButton = null
  for (const buttonConfig of dialogConfig.buttons) {
    const buttonElement = document.createElement("button")
    ;((buttonElement.type = "button"),
      (buttonElement.className = `app-btn${buttonConfig.primary ? " app-btn--primary" : ""}`),
      (buttonElement.textContent = buttonConfig.label),
      buttonElement.addEventListener("click", () => {
        ;(closeDialog(), buttonConfig.onClick())
      }),
      buttonBar.appendChild(buttonElement),
      buttonConfig.primary && !primaryButton && (primaryButton = buttonElement))
  }
  ;(cardElement.appendChild(buttonBar), dialogConfig.detail && appendDetail(dialogConfig.detail))
  const stopEventPropagation = (cooldown) => cooldown.stopPropagation()
  for (const eventType of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "wheel", "contextmenu", "keydown", "keyup"]) createElementElement.addEventListener(eventType, stopEventPropagation)
  const handleDialogKeyEvent = (keyEvent) => {
    isActive ||
      !createElementElement.isConnected ||
      (keyEvent.target instanceof Node && createElementElement.contains(keyEvent.target)) ||
      (keyEvent.stopPropagation(), keyEvent.type === "keydown" && (keyEvent.key === "Tab" || keyEvent.key === "Enter" || keyEvent.key === " ") && (keyEvent.preventDefault(), primaryButton?.focus({ preventScroll: !0 })))
  }
  return (window.addEventListener("keydown", handleDialogKeyEvent, !0), window.addEventListener("keyup", handleDialogKeyEvent, !0), createElementElement.appendChild(cardElement), element.appendChild(createElementElement), primaryButton?.focus({ preventScroll: !0 }), { el: createElementElement, addDetail: appendDetail, close: closeDialog })
}

export { showAppCardDialog, injectHudStyle }
