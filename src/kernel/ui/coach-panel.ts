/**
 * 教学面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { createEl, createIconEl, expandCssUnits, iconFor, injectStyleSheet } from './dom-kit'
import { HINT_CARD_CSS } from './hint-card-styles'
import { BOT_GOAL_LABELS, MatchFlow } from './match-flow'
import { createGuideArrow } from './hud-arrows'
import { trackEpicObjectives } from '../sim/epic-objectives'

function getBooleanSetting(lookupKey, lookupOption) {
  const selectedN = lookupKey[lookupOption]
  return typeof selectedN == "boolean" ? selectedN : !0
}

function updateSetting(gameHost, updateValue, newSettingValue) {
  const tConfig = { [updateValue]: newSettingValue }
  gameHost.updateSettings(tConfig)
}

/**
 * 创建状态。
 *
 * @returns 结果对象
 */
function createEpicTrackerState() {
  return {
    epicSince: new Map(),
    epicTold: new Set(),
    epicHelpAt: new Map(),
    epicSoonOff: new Set(),
    lastId: null,
    lastKey: "",
    pushLane: null,
    farmSeenAt: -1 / 0,
    groupLane: null,
    groupAt: -1 / 0,
    groupCand: null,
    groupCandSince: 0,
  }
}

const COACH_TIMING = { interval: 0.5, confirm: 1, minHold: 4, warnLinger: 1.5, groupHold: 8 },
  isPriorityHint = (hint) => hint.priority <= 3,
  isPushLaneHint = (hint) => hint.id === "push_lane" || hint.id === "push_now"

function getHintSwitchHold(currentHint, incomingHint) {
  const cOACH_TIMING = COACH_TIMING
  return (currentHint.id === "group" && isPushLaneHint(incomingHint)) || (isPushLaneHint(currentHint) && incomingHint.id === "group") ? cOACH_TIMING.groupHold : cOACH_TIMING.minHold
}

class VisibilityMemory {
  current = null
  since = -1 / 0
  pendingKey = ""
  pendingSince = 0
  warnGoneAt = -1
  reset() {
    ;((this.current = null), (this.since = -1 / 0), (this.pendingKey = ""), (this.warnGoneAt = -1))
  }
  feed(incomingHint, observationTime) {
    const coachTiming = COACH_TIMING,
      currentHint = this.current
    if (!incomingHint) {
      const hadCurrentHint = currentHint !== null
      return (this.reset(), hadCurrentHint)
    }
    return currentHint
      ? incomingHint.key === currentHint.key
        ? ((this.current = incomingHint), (this.pendingKey = ""), (this.warnGoneAt = -1), !1)
        : isPriorityHint(incomingHint)
          ? this.adopt(incomingHint, observationTime)
          : isPriorityHint(currentHint)
            ? (this.warnGoneAt < 0 && (this.warnGoneAt = observationTime), observationTime - this.warnGoneAt >= coachTiming.warnLinger - 1e-6 ? this.adopt(incomingHint, observationTime) : !1)
            : (this.pendingKey !== incomingHint.key && ((this.pendingKey = incomingHint.key), (this.pendingSince = observationTime)),
              observationTime - this.pendingSince >= coachTiming.confirm - 1e-6 && observationTime - this.since >= getHintSwitchHold(currentHint, incomingHint) - 1e-6 ? this.adopt(incomingHint, observationTime) : !1)
      : this.adopt(incomingHint, observationTime)
  }
  feedHidden(incomingHint, observationTime) {
    const currentHint = this.current
    return !incomingHint || !currentHint || incomingHint.key === currentHint.key ? this.feed(incomingHint, observationTime) : this.adopt(incomingHint, observationTime)
  }
  adopt(incomingHint, adoptionTime) {
    return ((this.current = incomingHint), (this.since = adoptionTime), (this.pendingKey = ""), (this.warnGoneAt = -1), !0)
  }
}

function parseHintText(hintText) {
  const textSegments = [],
    markupPattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let scanCursor = 0
  for (let index = markupPattern.exec(hintText); index; index = markupPattern.exec(hintText))
    (index.index > scanCursor && textSegments.push({ t: "text", s: hintText.slice(scanCursor, index.index) }), index[1] !== void 0 ? textSegments.push({ t: "key", s: index[1] }) : textSegments.push({ t: "bold", s: index[2] }), (scanCursor = index.index + index[0].length))
  return (scanCursor < hintText.length && textSegments.push({ t: "text", s: hintText.slice(scanCursor) }), textSegments)
}

function stripHintMarkup(hintText) {
  return parseHintText(hintText)
    .map((segment) => segment.s)
    .join("")
}

function createGuideCard(onSkipGuide) {
  injectStyleSheet("sf-hud-guide", HINT_CARD_CSS)
  const element = createEl("span", "sf-hud__gcard-badge sf-num"),
    createElElement = createEl("b", "sf-hud__gcard-title"),
    progressDots = createEl("span", "sf-hud__gcard-dots"),
    dotElements = []
  for (let index = 0; index < BOT_GOAL_LABELS.length; index++) {
    const ElValue = createEl("i")
    ;(dotElements.push(ElValue), progressDots.appendChild(ElValue))
  }
  progressDots.setAttribute("aria-hidden", "true")
  const createElElValue = createEl("button", "sf-hud__gcard-skip", "跳过引导")
  ;((createElElValue.type = "button"),
    (createElElValue.tabIndex = -1),
    (createElElValue.dataset.sfSnd = "back"),
    createElElValue.addEventListener("click", (clickEvent) => {
      ;(clickEvent.stopPropagation(), onSkipGuide())
    }))
  const cardBody = createEl("div", "sf-hud__gcard-body"),
    cardRoot = createEl("div", "sf-hud__gcard", createEl("div", "sf-hud__gcard-head", element, createElElement, progressDots, createElElValue), cardBody)
  ;(cardRoot.setAttribute("role", "status"), cardRoot.setAttribute("aria-live", "polite"))
  let isActive = !1,
    textValue = "",
    textResult = "",
    lastRenderedDone = !1,
    lastBadgeVariant = "",
    lastDotStates = ""
  function m(hintText) {
    cardBody.textContent = ""
    for (const parseHintTextp of parseHintText(hintText)) parseHintTextp.t === "key" ? cardBody.appendChild(createEl("span", "sf-kbd", parseHintTextp.s)) : parseHintTextp.t === "bold" ? cardBody.appendChild(createEl("b", null, parseHintTextp.s)) : cardBody.appendChild(document.createTextNode(parseHintTextp.s))
    cardRoot.setAttribute("aria-label", stripHintMarkup(hintText))
  }
  function x(guideCard) {
    const checkVariant = guideCard.done ? "check" : guideCard.kind === "tip" ? "info" : `${guideCard.lesson}/${BOT_GOAL_LABELS.length}`
    checkVariant !== lastBadgeVariant && ((lastBadgeVariant = checkVariant), (element.textContent = ""), checkVariant === "check" ? element.appendChild(createIconEl(iconFor("check"))) : checkVariant === "info" ? element.appendChild(createIconEl(iconFor("info"))) : (element.textContent = checkVariant))
  }
  return {
    el: cardRoot,
    visible: () => isActive,
    render(scene) {
      const guideCard = scene.card
      if (!guideCard) return (isActive && ((isActive = !1), cardRoot.classList.remove("is-on", "is-in"), (textValue = ""), delete cardRoot.dataset.step), !1)
      let justCompletedStep = !1
      ;((!isActive || guideCard.id !== textValue) &&
        ((isActive = !0),
        (textValue = guideCard.id),
        (cardRoot.className = `sf-hud__gcard is-on${guideCard.kind === "tip" ? " is-tip" : ""}${guideCard.kind === "outro" ? " is-outro" : ""}${guideCard.warn ? " is-warn" : ""}`),
        cardRoot.offsetWidth,
        cardRoot.classList.add("is-in"),
        (cardRoot.dataset.step = guideCard.id),
        (cardRoot.dataset.kind = guideCard.kind),
        (createElElement.textContent = guideCard.title),
        (textResult = ""),
        (lastRenderedDone = !1),
        (lastBadgeVariant = "")),
        guideCard.text !== textResult && ((textResult = guideCard.text), m(guideCard.text)),
        guideCard.done !== lastRenderedDone && ((lastRenderedDone = guideCard.done), cardRoot.classList.toggle("is-done", guideCard.done), (justCompletedStep = guideCard.done && guideCard.kind === "step")),
        (cardRoot.dataset.done = guideCard.done ? "1" : "0"),
        x(guideCard))
      let total = ""
      for (let index = 0; index < dotElements.length; index++) total += scene.lessonsDone[index] ? "d" : index === scene.lesson - 1 ? "c" : "."
      if (total !== lastDotStates) {
        lastDotStates = total
        for (let dotIndex = 0; dotIndex < dotElements.length; dotIndex++) dotElements[dotIndex].className = total[dotIndex] === "d" ? "is-done" : total[dotIndex] === "c" ? "is-cur" : ""
      }
      return justCompletedStep
    },
  }
}

const GUIDE_TARGET_SELECTORS = { joystick: ".sf-hud__joy-base", attack: '.sf-hud__sk[data-btn="attack"]', s1: '.sf-hud__sk[data-btn="s1"]', recall: '.sf-hud__sk[data-btn="recall"]', shop: ".sf-hud__shopbtn" }

/**
 * 创建光照。
 *
 * @param gameWorld - 来源
 * @returns 结果对象
 */
function createGuideHighlight(gameWorld) {
  injectStyleSheet("sf-hud-guide", HINT_CARD_CSS)
  const element = createEl("i", "sf-hud__gglow")
  element.setAttribute("aria-hidden", "true")
  let highlightedTargetKey = null,
    highlightedElement = null
  function i() {
    ;(highlightedElement && (highlightedElement.classList.remove("is-guide"), highlightedElement.parentElement?.classList.remove("is-guide-host")), element.remove(), (highlightedElement = null))
  }
  return {
    current: () => highlightedTargetKey,
    set(targetObject) {
      if ((targetObject === highlightedTargetKey && (targetObject === null || (highlightedElement && highlightedElement.isConnected && element.parentElement === highlightedElement))) || (i(), (highlightedTargetKey = targetObject), !targetObject)) return
      const guideTargetEl = gameWorld.root.querySelector(GUIDE_TARGET_SELECTORS[targetObject])
      guideTargetEl && ((highlightedElement = guideTargetEl), guideTargetEl.classList.add("is-guide"), guideTargetEl.parentElement?.classList.add("is-guide-host"), guideTargetEl.appendChild(element))
    },
    dispose() {
      ;(i(), (highlightedTargetKey = null))
    },
  }
}

const OBJECTIVE_CSS = expandCssUnits(`
.sf-hud__obj {
  --tone: 143, 233, 255;
  display: none; align-items: center; gap: 6u; max-width: 100%; box-sizing: border-box; height: max(22px, 26u); padding: 0 12u 0 7u; border-radius: 99px;
  background: linear-gradient(180deg, rgba(20, 33, 72, 0.7), rgba(7, 12, 30, 0.74)); box-shadow: inset 0 0 0 1px rgba(var(--tone), 0.4), 0 3u 10u rgba(2, 4, 12, 0.4);
  font-size: var(--sf-fs-sm); line-height: 1; color: var(--sf-c-text); white-space: nowrap; pointer-events: none;
}
.sf-hud__obj.is-on { display: inline-flex; }
.sf-hud__obj.is-in { animation: sf-hud-obj-in 0.22s var(--sf-ease-out) both; }
.sf-hud__obj > .sf-i { flex: none; width: 1.2em; height: 1.2em; color: rgb(var(--tone)); vertical-align: 0; }
.sf-hud__obj-tag { flex: none; font-size: var(--sf-fs-xs); font-weight: 800; letter-spacing: 0.08em; color: rgb(var(--tone)); }
.sf-hud__obj-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; letter-spacing: 0.02em; text-shadow: var(--hud-shadow-text); }
.sf-hud__obj.is-swap .sf-hud__obj-text { animation: sf-hud-obj-swap 0.2s linear both; }
.sf-hud__obj.is-warn { --tone: 255, 184, 77; box-shadow: inset 0 0 0 max(1px, 1.5u) rgba(var(--tone), 0.75), 0 0 12u rgba(255, 184, 77, 0.28), 0 3u 10u rgba(2, 4, 12, 0.4); }
.sf-hud__obj.is-warn .sf-hud__obj-text { color: #ffe9c4; }
.sf-hud__obj.is-go { --tone: 255, 231, 173; box-shadow: inset 0 0 0 1px rgba(var(--tone), 0.65), 0 3u 10u rgba(2, 4, 12, 0.4); }
.sf-hud__obj.is-go .sf-hud__obj-text { color: var(--sf-c-gold-100); }
@keyframes sf-hud-obj-in { from { opacity: 0; transform: translateY(-5u); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-obj-swap { from { opacity: 0; } to { opacity: 1; } }
/* 窄屏放不下「当前目标」四个字：只留图标 */
@media (max-width: 460px) { .sf-hud__obj-tag { display: none; } .sf-hud__obj { padding: 0 10px 0 6px; } }
`)

function createObjectiveWidget() {
  injectStyleSheet("sf-hud-objective", OBJECTIVE_CSS)
  const element = createEl("span", "sf-hud__obj-text"),
    objectiveRoot = createEl("div", "sf-hud__obj", createIconEl(iconFor("target")), createEl("span", "sf-hud__obj-tag", "当前目标"), element)
  ;(objectiveRoot.setAttribute("role", "status"), objectiveRoot.setAttribute("aria-live", "polite"))
  let isObjectiveVisible = !1,
    lastObjectiveKey = "",
    lastObjectiveText = "",
    lastObjectiveTone = ""
  return {
    el: objectiveRoot,
    visible: () => isObjectiveVisible,
    render(objectiveData) {
      if (!objectiveData) {
        isObjectiveVisible && ((isObjectiveVisible = !1), objectiveRoot.classList.remove("is-on", "is-in", "is-swap"), (lastObjectiveKey = ""), delete objectiveRoot.dataset.key)
        return
      }
      ;(isObjectiveVisible ? objectiveData.key !== lastObjectiveKey && (objectiveRoot.classList.remove("is-swap"), objectiveRoot.offsetWidth, objectiveRoot.classList.add("is-swap")) : ((isObjectiveVisible = !0), objectiveRoot.classList.add("is-on"), objectiveRoot.offsetWidth, objectiveRoot.classList.add("is-in")),
        objectiveData.key !== lastObjectiveKey && ((lastObjectiveKey = objectiveData.key), (objectiveRoot.dataset.key = objectiveData.key)),
        objectiveRoot.dataset.id !== objectiveData.id && (objectiveRoot.dataset.id = objectiveData.id),
        objectiveData.tone !== lastObjectiveTone && ((lastObjectiveTone = objectiveData.tone), objectiveRoot.classList.toggle("is-warn", objectiveData.tone === "warn"), objectiveRoot.classList.toggle("is-go", objectiveData.tone === "go")),
        objectiveData.text !== lastObjectiveText && ((lastObjectiveText = objectiveData.text), (element.textContent = objectiveData.text)))
    },
  }
}

const COACH_PANEL_CSS = expandCssUnits(`
.sf-hud__coach {
  position: absolute; left: 50%; top: calc(var(--hud-t) + 58u); z-index: 4; width: min(520u, 60vw); transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; pointer-events: none; transition: opacity 0.2s linear;
}
/* 横幅出现：让位 */
.sf-hud__coach.is-yield { opacity: 0; }
.sf-hud__coach.is-yield button { pointer-events: none; }
.sf-hud.is-over .sf-hud__coach { display: none; }
/* 手机横屏(屏高不足 460px)：两侧让开小地图与右上角；贴紧比分条下沿(屏幕矮，指引位下面紧挨着玩家英雄的头顶) */
@media (orientation: landscape) and (max-height: 460px) {
  .sf-hud__coach { top: calc(var(--hud-t) + 50u); width: min(440px, calc(100vw - 2 * (var(--hud-mini) + 40u))); }
}
/* 竖屏：放在商店按钮那一行的正下方，左右各留 8px */
@media (orientation: portrait) {
  .sf-hud__coach { top: calc(var(--hud-t) + var(--hud-mini) + max(58px, 66u)); width: calc(100vw - 16px); }
}
`),
  OBJECTIVE_LINGER_SEC = 3,
  OBJECTIVE_LOG_LIMIT = 400

/**
 * 创建界面。
 *
 * @param world - 战场
 * @param hudWidgets - 次要输入
 * @returns 结果对象
 */
function createCoachPanel(world, hudWidgets) {
  injectStyleSheet("sf-hud-coach", COACH_PANEL_CSS)
  const { host: gameHost } = world,
    isAutoPlay = world.state.config.autoPlay === !0,
    GuideArrowValue = createGuideArrow(world, () => element),
    GuideHighlightValue = createGuideHighlight(world),
    ObjectiveWidgetValue = createObjectiveWidget(),
    GuideCardValue = createGuideCard(() => {
      matchFlow && (matchFlow.skip(), w(), updateSetting(gameHost, "tutorial", !1), world.toast("已关闭新手引导，可在设置里重新打开", "info"))
    }),
    element = createEl("div", "sf-hud__coach", GuideCardValue.el, ObjectiveWidgetValue.el)
  let BooleanSettingValue = getBooleanSetting(gameHost.getSettings(), "tutorial"),
    matchFlow = BooleanSettingValue && !isAutoPlay ? new MatchFlow(world.state, world.me) : null
  const isGuideActive = matchFlow !== null,
    stateConfig = { state: world.state, me: world.me, mode: world.mode, shopOpen: !1, objectiveHints: !0 }
  let flowMinimapPoint = null,
    arrowHint = null
  const EpicTrackerStateValue = createEpicTrackerState(),
    visibilityMemory = new VisibilityMemory()
  let lastObjectiveCheckTime = -1 / 0,
    objectivePoint = null,
    objectiveLingerUntil = 0
  const objectiveLog = []
  let isYielding = !1,
    isCoachClassOn = !1,
    minimapGuidePoint = null
  function b() {
    matchFlow = new MatchFlow(world.state, world.me)
  }
  function w() {
    ;((matchFlow = null), GuideCardValue.render({ card: null, lesson: 1, lessonsDone: [], highlight: null, arrow: null, minimap: null, finished: !0 }), GuideHighlightValue.set(null), GuideArrowValue.set(null), (arrowHint = null), (flowMinimapPoint = null))
  }
  return {
    els: [GuideArrowValue.el, element],
    replacesTips: isGuideActive,
    restartGuide() {
      isAutoPlay || (w(), b())
    },
    debug() {
      const guideDebugInfo = matchFlow ? matchFlow.debug() : null,
        guideCardElement = GuideCardValue.el
      return {
        guideOn: matchFlow !== null,
        guide: guideDebugInfo,
        card: GuideCardValue.visible()
          ? {
              id: guideCardElement.dataset.step ?? "",
              kind: guideCardElement.dataset.kind ?? "",
              done: guideCardElement.dataset.done === "1",
              title: guideCardElement.querySelector(".sf-hud__gcard-title")?.textContent ?? "",
              text: guideCardElement.getAttribute("aria-label") ?? "",
            }
          : null,
        highlight: GuideHighlightValue.current(),
        arrow: arrowHint ? { x: arrowHint.pos.x, y: arrowHint.pos.y, label: arrowHint.label, mode: GuideArrowValue.mode() } : null,
        minimap: minimapGuidePoint ? { x: minimapGuidePoint.x, y: minimapGuidePoint.y } : null,
        objective: visibilityMemory.current,
        objectiveVisible: ObjectiveWidgetValue.visible() && !isYielding,
        yielding: isYielding,
        log: objectiveLog.slice(),
      }
    },
    handleEvent(gameEvent, gameWorld) {
      matchFlow && matchFlow.onEvent(gameEvent, gameWorld.state)
    },
    onMode(gameMode) {
      stateConfig.mode = gameMode
    },
    update(gameWorld) {
      const matchState = gameWorld.state,
        selfPlayer = gameWorld.me,
        SettingsValue = gameHost.getSettings(),
        getBooleanSettingBooleanSettingValue = getBooleanSetting(SettingsValue, "tutorial")
      getBooleanSettingBooleanSettingValue !== BooleanSettingValue && ((BooleanSettingValue = getBooleanSettingBooleanSettingValue), getBooleanSettingBooleanSettingValue ? !isAutoPlay && !matchState.over && b() : w())
      let isCardVisible = !1
      if (matchFlow) {
        ;((stateConfig.state = matchState), (stateConfig.me = selfPlayer), (stateConfig.mode = gameWorld.mode), (stateConfig.shopOpen = gameWorld.actions.isShopOpen()), (stateConfig.objectiveHints = getBooleanSetting(SettingsValue, "objectiveHints")))
        const updateResult = matchFlow.update(stateConfig)
        updateResult.finished
          ? (w(), updateSetting(gameHost, "tutorial", !1))
          : (GuideCardValue.render(updateResult) && gameHost.audio.ui("confirm"), (isCardVisible = updateResult.card !== null), GuideHighlightValue.set(updateResult.highlight), GuideArrowValue.set(updateResult.arrow), (arrowHint = updateResult.arrow ? { pos: updateResult.arrow.pos, label: updateResult.arrow.label } : null), (flowMinimapPoint = updateResult.minimap))
      }
      if ((GuideArrowValue.update?.(gameWorld, 0), matchState.time - lastObjectiveCheckTime >= COACH_TIMING.interval || matchState.time < lastObjectiveCheckTime)) {
        lastObjectiveCheckTime = matchState.time
        const trackEpicObjectivesResult = trackEpicObjectives(matchState, selfPlayer, gameWorld.mode, EpicTrackerStateValue)
        if (ObjectiveWidgetValue.visible() ? visibilityMemory.feed(trackEpicObjectivesResult, matchState.time) : visibilityMemory.feedHidden(trackEpicObjectivesResult, matchState.time)) {
          const activeObjective = visibilityMemory.current
          activeObjective
            ? (objectiveLog.length >= OBJECTIVE_LOG_LIMIT && objectiveLog.shift(),
              objectiveLog.push({ t: Math.round(matchState.time * 10) / 10, id: activeObjective.id, key: activeObjective.key, tone: activeObjective.tone, text: activeObjective.text }),
              activeObjective.pos ? ((objectivePoint = { x: activeObjective.pos.x, y: activeObjective.pos.y }), (objectiveLingerUntil = gameWorld.now + OBJECTIVE_LINGER_SEC)) : (objectivePoint = null))
            : (objectivePoint = null)
        }
      }
      const shouldShowObjective = getBooleanSetting(SettingsValue, "objectiveHints") && !isCardVisible && selfPlayer.alive && !matchState.over
      ObjectiveWidgetValue.render(shouldShowObjective ? visibilityMemory.current : null)
      const isShowingResult = hudWidgets.banner.isShowing()
      ;(isShowingResult !== isYielding && ((isYielding = isShowingResult), element.classList.toggle("is-yield", isShowingResult)),
        objectivePoint && isYielding && (objectiveLingerUntil = gameWorld.now + OBJECTIVE_LINGER_SEC),
        flowMinimapPoint && selfPlayer.alive && !matchState.over ? (minimapGuidePoint = flowMinimapPoint) : objectivePoint && shouldShowObjective && !isYielding && gameWorld.now < objectiveLingerUntil ? (minimapGuidePoint = objectivePoint) : (minimapGuidePoint = null),
        hudWidgets.minimap.setGuide(minimapGuidePoint))
      const isCoachActive = isCardVisible || ObjectiveWidgetValue.visible()
      isCoachActive !== isCoachClassOn && ((isCoachClassOn = isCoachActive), gameWorld.root.classList.toggle("is-coach", isCoachActive))
    },
    dispose() {
      ;(GuideHighlightValue.dispose(), GuideArrowValue.dispose?.(), hudWidgets.minimap.setGuide(null), world.root.classList.remove("is-coach"), (matchFlow = null))
    },
  }
}

export { updateSetting, getBooleanSetting, createCoachPanel }