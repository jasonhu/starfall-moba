/**
 * HUD 根节点
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { injectThemeStyles, createEl, createIconEl, expandCssUnits, iconFor, injectStyleSheet, makeIconButton, bindUiSounds, refreshHud } from './dom-kit'
import { bindClassToggle, createCssVarWriter, createFormattedTextWriter, createStatusStrip, createTextWriter, toggleClassOn } from './status-strip'
import { MINIMAP_STYLE, createMinimap } from './minimap'
import { bannerTeamClass, createBanner, heroBannerLabel, makeBannerTag } from './banner'
import { z0 } from '../skills/skill-values'
import { MONSTER_STATS } from '../game-balance'
import { CastFailMessage, ItemTable, formatTowerLabel } from '../equipment'
import { BUFF_DESCRIPTIONS } from '../render/procedural-art'
import { DEATH_OVERLAY_CSS } from './death-overlay-styles'
import { isOverlayAvailable, openDialog } from './rh-widget'
import { HUD_ZINDEX_CSS } from './hud-zindex-styles'
import { SCOREBOARD_CSS } from './scoreboard-styles'
import { createScoreboard, formatScoreboardClock } from './scoreboard-panel'
import { createSkillBar } from './skill-bar'
import { getItemSellValue, evaluatePurchase, BLOCK_REASON_LABELS, createShopPanel } from './shop-panel'
import { createCoachPanel } from './coach-panel'
import { bindInputControls } from './input-controls'

const settingsCache = new Map()

function getLocalStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function getStoredSetting(lookupKey) {
  const Value = settingsCache.get(lookupKey)
  if (Value !== void 0) return Value
  try {
    return getLocalStorage()?.getItem(lookupKey) ?? null
  } catch {
    return null
  }
}

function setStoredSetting(lookupKey, propertyName) {
  settingsCache.set(lookupKey, propertyName)
  try {
    getLocalStorage()?.setItem(lookupKey, propertyName)
  } catch {}
}

function createGrayOverlay(hudContext, overlayOptions) {
  const element = createEl("div", "sf-hud__gray"),
    cssFeatureApi = typeof window.CSS < "u" ? window.CSS : null,
    supportsGrayscaleFilter = !!cssFeatureApi && (cssFeatureApi.supports("backdrop-filter", "grayscale(1)") || cssFeatureApi.supports("-webkit-backdrop-filter", "grayscale(1)"))
  ;((overlayOptions.dimTarget || !supportsGrayscaleFilter) && element.classList.add("is-tint"), overlayOptions.dimTarget && overlayOptions.dimTarget.classList.add("sf-hud-dim"))
  const ElValue = createEl("div", "sf-hud__lowhp"),
    createElElValue = createEl("b", "sf-num", "0"),
    ElResult = createEl("div", "sf-hud__death-count", createElElValue),
    createElElement = createEl("div", "sf-hud__death-killer"),
    deathTipElement = createEl("div", "sf-hud__death-tip"),
    TextWriterValue = createTextWriter(deathTipElement),
    deathOverlayElement = createEl("div", "sf-hud__death", ElResult, createEl("div", "sf-hud__death-main", createEl("h2", "sf-hud__death-title sf-metal", "你已阵亡"), createEl("div", "sf-hud__death-label", "秒后复活"), createElElement, deathTipElement)),
    FormattedTextWriterValue = createFormattedTextWriter(createElElValue),
    CssVarWriterValue = createCssVarWriter(ElResult, "--p", 1 / 180),
    bindClassToggleResult = bindClassToggle(ElValue, "is-on")
  let isActive = !1,
    respawnTimeBase = 1
  function g(isDead, deadPlayerState) {
    ;((isActive = isDead),
      hudContext.root.classList.toggle("is-dead", isDead),
      overlayOptions.dimTarget?.classList.toggle("is-on", isDead),
      isDead ? ((respawnTimeBase = Math.max(1, deadPlayerState.respawnIn)), TextWriterValue(deadPlayerState.autoBuy ? "阵亡期间金币照涨，自动出装照买。" : "阵亡期间金币照涨，可以打开商店买装备。")) : (createElElement.textContent = ""),
      overlayOptions.onDeathChange?.(isDead))
  }
  return {
    els: [element, ElValue, deathOverlayElement],
    update(deathUpdateState) {
      const selfPlayer = deathUpdateState.me
      ;(!selfPlayer.alive !== isActive && g(!selfPlayer.alive, selfPlayer),
        isActive && (selfPlayer.respawnIn > respawnTimeBase && (respawnTimeBase = selfPlayer.respawnIn), FormattedTextWriterValue(Math.ceil(selfPlayer.respawnIn)), CssVarWriterValue(MINIMAP_STYLE(selfPlayer.respawnIn / respawnTimeBase))),
        bindClassToggleResult(selfPlayer.alive && selfPlayer.hp > 0 && selfPlayer.hp / Math.max(1, selfPlayer.stats.maxHp) < 0.25))
    },
    /**
     * 处理事件。
     *
     * @param killEvent - 主要输入
     * @param world - 战场
    */
    handleEvent(killEvent, world) {
      if (killEvent.type !== "heroKill" || killEvent.victimId !== world.state.playerId) return
      createElElement.textContent = ""
      const heroResult = world.hero(killEvent.killerId)
      if ((createElElement.appendChild(createEl("span", "is-dim", "击杀者")), heroResult)) createElElement.append(heroBannerLabel(world.host, heroResult, world.team), createEl("span", "is-red", `敌方 ${z0(heroResult.heroId)}`), createEl("span", "is-dim sf-num", `Lv.${heroResult.level}`))
      else {
        const element = world.unit(killEvent.killerId),
          killerTeam = world.team === 0 ? 1 : 0,
          killerKind = element?.kind,
          killerLabel = killerKind === "tower" ? "敌方防御塔" : killerKind === "core" ? "敌方水晶" : element && element.kind === "monster" ? MONSTER_STATS[element.monsterType].name : killerKind === "minion" ? "敌方小兵" : "战场"
        createElElement.append(makeBannerTag(iconFor(killerKind === "tower" || killerKind === "core" ? "tower" : killerKind === "monster" ? "monster" : "cs"), bannerTeamClass(killerTeam, world.team)), createEl("span", "is-red", killerLabel))
      }
      const filterResult = killEvent.assistIds.map((assistId) => world.hero(assistId)).filter((assistHero) => !!assistHero)
      if (filterResult.length > 0) {
        const deathAssistsElement = createEl("span", "sf-hud__death-assists")
        for (const slice04 of filterResult.slice(0, 4)) deathAssistsElement.appendChild(heroBannerLabel(world.host, slice04, world.team))
        createElElement.append(createEl("span", "is-dim", "助攻"), deathAssistsElement)
      }
    },
    dispose() {
      ;(hudContext.root.classList.remove("is-dead"), overlayOptions.dimTarget?.classList.remove("sf-hud-dim", "is-on"))
    },
  }
}

const TOAST_BASE_SECONDS = 1.7,
  TOAST_TONE_ICONS = { warn: iconFor("cancel"), info: iconFor("info"), good: iconFor("check") }

function createToastLayer(toastContext) {
  const element = createEl("div", "sf-hud__toasts")
  element.setAttribute("aria-live", "assertive")
  const activeToasts = []
  function s(messageText, warnKind = "warn", durationSeconds = TOAST_BASE_SECONDS) {
    const toastDurationSeconds = Math.max(durationSeconds, 0.9 + messageText.length * 0.12)
    for (const toastEntry of activeToasts)
      if (toastEntry.text === messageText && !toastEntry.leaving) {
        ;((toastEntry.until = toastContext.now + toastDurationSeconds), toastEntry.el.classList.remove("is-again"), toastEntry.el.offsetWidth, toastEntry.el.classList.add("is-again"))
        return
      }
    const toastElement = createEl("div", `sf-hud__toast${warnKind === "warn" ? "" : ` is-${warnKind}`}`, createIconEl(TOAST_TONE_ICONS[warnKind]), messageText)
    for (element.appendChild(toastElement), activeToasts.push({ el: toastElement, text: messageText, until: toastContext.now + toastDurationSeconds, leaving: !1 }); activeToasts.length > 3;) activeToasts.shift()?.el.remove()
  }
  return {
    el: element,
    show: s,
    update(toastState) {
      for (let index = activeToasts.length - 1; index >= 0; index--) {
        const selectedE = activeToasts[index]
        !selectedE.leaving && toastState.now >= selectedE.until ? ((selectedE.leaving = !0), selectedE.el.classList.add("is-out")) : selectedE.leaving && toastState.now >= selectedE.until + 0.26 && (selectedE.el.remove(), activeToasts.splice(index, 1))
      }
    },
    /**
     * 处理事件。
     *
     * @param gameEvent - 主要输入
     * @param toastWorld - 战场
    */
    handleEvent(gameEvent, toastWorld) {
      if (gameEvent.type === "reject" && gameEvent.unitId === toastWorld.state.playerId) s(CastFailMessage[gameEvent.reason], "warn")
      else if (gameEvent.type === "fx" && gameEvent.key === "buff_gain" && gameEvent.unitId === toastWorld.state.playerId) {
        let longestBuffId = null,
          longestBuffTimeLeft = -1
        for (const buff of toastWorld.me.buffs) (buff.id === "frost_insight" || buff.id === "ember_might") && buff.timeLeft > longestBuffTimeLeft && ((longestBuffTimeLeft = buff.timeLeft), (longestBuffId = buff.id))
        longestBuffId && s(BUFF_DESCRIPTIONS[longestBuffId], "info")
      }
    },
  }
}

function createChannelBar() {
  const element = createEl("span", "sf-num"),
    channelBarElement = createEl("div", "sf-hud__channel", createEl("div", "sf-hud__channel-label", "回城中", element, createEl("small", null, "移动、攻击或受击会打断")), createEl("div", "sf-hud__channel-bar", createEl("i"))),
    setRecallBarVisible = bindClassToggle(channelBarElement, "is-on"),
    createCssVarWriterCssVarWriterValue = createCssVarWriter(channelBarElement, "--p", 1 / 200),
    createTextWriterTextWriterValue = createTextWriter(element)
  return {
    el: channelBarElement,
    update(channelState) {
      let recallTimeLeft = -1,
        recallDuration = 1
      for (const recallBuff of channelState.me.buffs) recallBuff.id === "recall" && ((recallTimeLeft = recallBuff.timeLeft), (recallDuration = recallBuff.duration > 0 ? recallBuff.duration : 1))
      const isRecalling = recallTimeLeft >= 0 && channelState.me.alive
      ;(setRecallBarVisible(isRecalling), isRecalling && (createCssVarWriterCssVarWriterValue(MINIMAP_STYLE(1 - recallTimeLeft / recallDuration)), createTextWriterTextWriterValue(recallTimeLeft.toFixed(1))))
    },
  }
}

function createFpsMeter(fpsContext) {
  const element = createEl("div", "sf-hud__fps"),
    setFpsVisible = bindClassToggle(element, "is-on"),
    setFpsMid = bindClassToggle(element, "is-mid"),
    setFpsLow = bindClassToggle(element, "is-low"),
    TextWriterResult = createTextWriter(element)
  let lastFpsSampleTime = -1
  return {
    el: element,
    update(fpsState) {
      const showFpsSetting = fpsContext.host.getSettings().showFps
      if ((setFpsVisible(showFpsSetting), !showFpsSetting || fpsState.now - lastFpsSampleTime < 0.5)) return
      lastFpsSampleTime = fpsState.now
      const roundedFps = Math.round(fpsContext.host.getFps())
      ;(TextWriterResult(`${roundedFps} FPS`), setFpsLow(roundedFps < 28), setFpsMid(roundedFps >= 28 && roundedFps < 50))
    },
  }
}

const TIPS_DISMISSED_KEY = "starfall.hud.tips.v1"

function areTipsDismissed() {
  return getStoredSetting(TIPS_DISMISSED_KEY) === "1"
}

/**
 * 创建界面。
 *
 * @param tipsContext - 来源
 * @param tipsDisplaySeconds - 次要输入
 */
function createTipsPanel(tipsContext, tipsDisplaySeconds) {
  const element = createEl("div", "sf-hud__tips-list"),
    closeTipsButton = createEl("button", "sf-iconbtn sf-iconbtn--quiet", createIconEl(iconFor("close")))
  ;((closeTipsButton.type = "button"), (closeTipsButton.tabIndex = -1), closeTipsButton.setAttribute("aria-label", "关闭操作提示"), (closeTipsButton.dataset.sfSnd = "back"))
  const tipsPanelElement = createEl("div", "sf-hud__tips", element, closeTipsButton)
  let tipsShownAt = -1,
    tipsDismissed = tipsDisplaySeconds <= 0 || areTipsDismissed(),
    tipsHideAt = 0
  const makeKeyCapSpans = (...bushMap) => bushMap.map((keyLabel) => createEl("span", "sf-kbd", keyLabel))
  function c(kbmKind) {
    ;((element.textContent = ""),
      kbmKind === "kbm"
        ? element.append(
            createEl("span", null, ...makeKeyCapSpans("W", "A", "S", "D"), "移动"),
            createEl("span", null, ...makeKeyCapSpans("右键"), "点地移动 / 攻击"),
            createEl("span", null, ...makeKeyCapSpans("空格"), "普攻"),
            createEl("span", null, ...makeKeyCapSpans("Q", "E", "R"), "技能：按住瞄准，松开施放"),
            createEl("span", null, ...makeKeyCapSpans("F", "G", "B"), "闪现 / 疗伤 / 回城"),
            createEl("span", null, ...makeKeyCapSpans("P"), "商店"),
            createEl("span", null, ...makeKeyCapSpans("Tab"), "战况"),
            createEl("span", null, ...makeKeyCapSpans("Esc"), "暂停"),
          )
        : element.append(
            createEl("span", null, createIconEl(iconFor("joystick")), createEl("b", null, "左下拖动"), "移动"),
            createEl("span", null, createIconEl(iconFor("touch")), createEl("b", null, "轻点技能"), "自动瞄准"),
            createEl("span", null, createIconEl(iconFor("target")), createEl("b", null, "按住拖动"), "手动瞄准，松手施放"),
            createEl("span", null, createIconEl(iconFor("cancel")), "拖到", createEl("b", null, "取消"), "松手放弃"),
            createEl("span", null, createIconEl(iconFor("info")), createEl("b", null, "长按技能"), "看说明"),
          ))
  }
  c(tipsContext.mode)
  function f() {
    tipsDismissed || ((tipsDismissed = !0), tipsPanelElement.classList.add("is-out"), (tipsHideAt = tipsContext.now + 0.36))
  }
  return (
    closeTipsButton.addEventListener("click", () => {
      ;(f(), setStoredSetting(TIPS_DISMISSED_KEY, "1"))
    }),
    {
      el: tipsPanelElement,
      dismiss: f,
      onMode(newInputMode) {
        tipsDismissed || c(newInputMode)
      },
      update(tipsState) {
        if (tipsDismissed) {
          tipsHideAt > 0 && tipsState.now >= tipsHideAt && ((tipsHideAt = 0), tipsPanelElement.classList.remove("is-on"))
          return
        }
        tipsShownAt < 0 ? ((tipsShownAt = tipsState.now), tipsPanelElement.classList.add("is-on")) : tipsState.now - tipsShownAt > tipsDisplaySeconds && f()
      },
    }
  )
}

function injectHudOverlayStyles() {
  injectStyleSheet("sf-hud-overlays", DEATH_OVERLAY_CSS)
}

function orDefault(overlayOverride) {
  return overlayOverride ?? isOverlayAvailable()
}

function injectHudBaseStyles() {
  injectStyleSheet("sf-hud-base", HUD_ZINDEX_CSS)
}

const KILL_FEED_CSS = expandCssUnits(`
.sf-hud__feed { position: absolute; right: var(--hud-r); top: calc(var(--hud-t) + max(46px, 50u)); z-index: 3; display: flex; flex-direction: column; align-items: flex-end; gap: 5u; }
.sf-hud__kf {
  --tone: 77, 163, 255;
  position: relative; display: flex; align-items: center; gap: 6u; height: 34u; padding: 0 10u 0 30u; border-radius: 0 6u 6u 0;
  background: linear-gradient(90deg, rgba(var(--tone), 0), rgba(var(--tone), 0.3) 26%, rgba(var(--tone), 0.12) 70%), linear-gradient(90deg, rgba(9, 15, 36, 0), rgba(9, 15, 36, 0.88) 14%, rgba(9, 15, 36, 0.93));
  box-shadow: inset -3px 0 0 rgba(var(--tone), 0.95);
  animation: sf-hud-kf-in 0.32s var(--sf-ease-out) both;
}
.sf-hud__kf.is-foe { --tone: 255, 93, 93; }
.sf-hud__kf.is-me { box-shadow: inset -3px 0 0 var(--sf-c-me); }
.sf-hud__kf.is-me::after { content: ''; position: absolute; left: 22%; right: 0; top: 0; bottom: 0; border-radius: 0 6u 6u 0; pointer-events: none; box-shadow: inset 0 1px 0 rgba(183, 243, 107, 0.55), inset 0 -1px 0 rgba(183, 243, 107, 0.55); }
.sf-hud__kf.is-out { animation: sf-hud-kf-out 0.4s var(--sf-ease-in) both; }
.sf-hud__kf .sf-hud__face { --sz: 26u; }
.sf-hud__kf-assists { display: flex; align-items: center; margin-right: 2u; }
.sf-hud__kf-assists .sf-hud__face { --sz: 17u; margin-left: -4u; box-shadow: 0 0 0 1.5px var(--ring); }
.sf-hud__kf-assists .sf-hud__face:first-child { margin-left: 0; }
.sf-hud__kf-plus { font-size: var(--sf-fs-xs); font-weight: 800; color: var(--sf-c-text-2); margin: 0 1u 0 2u; }
.sf-hud__kf-ico { width: 15u; height: 15u; color: #fff; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.8)); }
.sf-hud__kf-ico > svg { display: block; width: 100%; height: 100%; }
.sf-hud__kf-text { font-size: var(--sf-fs-xs); font-weight: 700; color: var(--sf-c-text); letter-spacing: 0.04em; white-space: nowrap; text-shadow: var(--hud-shadow-text); }
@keyframes sf-hud-kf-in { from { opacity: 0; transform: translateX(40u); } to { opacity: 1; transform: none; } }
@keyframes sf-hud-kf-out { to { opacity: 0; transform: translateX(24u); } }
@media (orientation: portrait) {
  .sf-hud__feed { top: calc(var(--hud-t) + max(96px, 106u)); }
  /* 竖屏：顶部指引位(引导卡 / 当前目标)横贯整屏，就在击杀流第三条的位置——有指引时只留最新的两条 */
  .sf-hud.is-coach .sf-hud__kf:nth-last-child(n+3) { display: none; }
}
`),
  KILL_FEED_LIFETIME_SEC = 6.5,
  KILL_FEED_MAX_ENTRIES = 4

function createKillFeed(feedContext) {
  injectStyleSheet("sf-hud-feed", KILL_FEED_CSS)
  const element = createEl("div", "sf-hud__feed")
  element.setAttribute("aria-live", "polite")
  const feedEntries = []
  function s(feedEntryElement) {
    for (element.appendChild(feedEntryElement), feedEntries.push({ el: feedEntryElement, until: feedContext.now + KILL_FEED_LIFETIME_SEC, leaving: !1 }); feedEntries.length > KILL_FEED_MAX_ENTRIES;) feedEntries.shift()?.el.remove()
  }
  const createFeedIcon = (iconKey) => {
    const element = createEl("span", "sf-hud__kf-ico")
    return ((element.innerHTML = iconFor(iconKey)), element)
  }
  return {
    el: element,
    update(feedState) {
      for (let feedEntryIndex = feedEntries.length - 1; feedEntryIndex >= 0; feedEntryIndex--) {
        const feedEntry = feedEntries[feedEntryIndex]
        !feedEntry.leaving && feedState.now >= feedEntry.until ? ((feedEntry.leaving = !0), feedEntry.el.classList.add("is-out")) : feedEntry.leaving && feedState.now >= feedEntry.until + 0.42 && (feedEntry.el.remove(), feedEntries.splice(feedEntryIndex, 1))
      }
    },
    /**
     * 处理事件。
     *
     * @param feedEvent - 输入
     * @param feedWorld - 战场
    */
    handleEvent(feedEvent, feedWorld) {
      if (feedEvent.type === "heroKill") {
        const victimHero = feedWorld.hero(feedEvent.victimId)
        if (!victimHero) return
        const killerHero = feedWorld.hero(feedEvent.killerId),
          killerUnit = killerHero ?? feedWorld.unit(feedEvent.killerId),
          killerTeam = killerHero ? killerHero.team : victimHero.team === 0 ? 1 : 0,
          involvesPlayer = victimHero.isPlayer || !!killerHero?.isPlayer || feedEvent.assistIds.indexOf(feedWorld.state.playerId) >= 0,
          killFeedEntry = createEl("div", `sf-hud__kf ${killerTeam === feedWorld.team ? "is-ally" : "is-foe"}${involvesPlayer ? " is-me" : ""}`),
          assistHeroes = feedEvent.assistIds.map((assistHeroId) => feedWorld.hero(assistHeroId)).filter((resolvedAssistHero) => !!resolvedAssistHero)
        if (assistHeroes.length > 0) {
          const assistsElement = createEl("span", "sf-hud__kf-assists")
          for (const assistBadgeHero of assistHeroes.slice(0, 4)) assistsElement.appendChild(heroBannerLabel(feedWorld.host, assistBadgeHero, feedWorld.team))
          killFeedEntry.append(assistsElement, createEl("span", "sf-hud__kf-plus", "+"))
        }
        if (killerHero) killFeedEntry.appendChild(heroBannerLabel(feedWorld.host, killerHero, feedWorld.team))
        else {
          const kindValue = killerUnit?.kind,
            iconForResult = iconFor(kindValue === "tower" || kindValue === "core" ? "tower" : kindValue === "monster" ? "monster" : "cs")
          killFeedEntry.appendChild(makeBannerTag(iconForResult, bannerTeamClass(killerTeam, feedWorld.team)))
        }
        ;(killFeedEntry.append(createFeedIcon("kill"), heroBannerLabel(feedWorld.host, victimHero, feedWorld.team, "is-dead")), s(killFeedEntry))
      } else if (feedEvent.type === "towerDestroyed") {
        const isEnemyTowerDestroyed = feedEvent.team !== feedWorld.team,
          towerEntryElement = createEl("div", `sf-hud__kf ${isEnemyTowerDestroyed ? "is-ally" : "is-foe"}`)
        ;(towerEntryElement.append(createEl("span", "sf-hud__kf-text", `${isEnemyTowerDestroyed ? "我方摧毁" : "敌方摧毁"}`), createFeedIcon("tower"), createEl("span", "sf-hud__kf-text", formatTowerLabel(feedEvent.lane, feedEvent.tier)), makeBannerTag(iconFor("tower"), `${bannerTeamClass(feedEvent.team, feedWorld.team)} is-dead`)),
          s(towerEntryElement))
      } else if (feedEvent.type === "epicSlain") {
        const isOurEpicKill = feedEvent.team === feedWorld.team,
          epicEntryElement = createEl("div", `sf-hud__kf ${isOurEpicKill ? "is-ally" : "is-foe"}`)
        ;(epicEntryElement.append(createEl("span", "sf-hud__kf-text", `${isOurEpicKill ? "我方击败" : "敌方击败"}`), createFeedIcon("monster"), createEl("span", "sf-hud__kf-text", MONSTER_STATS[feedEvent.monsterType].name)), s(epicEntryElement))
      }
    },
    dispose() {
      feedEntries.length = 0
    },
  }
}

/**
 * 创建评分。
 *
 * @param scoreContext - 来源
 * @returns 结果对象
 */
function createScoreBar(scoreContext) {
  injectStyleSheet("sf-hud-top", SCOREBOARD_CSS)
  const element = (cssClass, spanText = "") => createEl("span", cssClass, spanText),
    elementResult = element("sf-hud__score-kills sf-num", "0"),
    enemyKillsElement = element("sf-hud__score-kills sf-num", "0"),
    allyTowerCountElement = element("sf-num", "0"),
    enemyTowerCountElement = element("sf-num", "0"),
    allyTowersElement = createEl("span", "sf-hud__score-towers", createIconEl(iconFor("tower")), allyTowerCountElement),
    enemyTowersElement = createEl("span", "sf-hud__score-towers", createIconEl(iconFor("tower")), enemyTowerCountElement)
  ;((allyTowersElement.title = "我方已推掉的塔"), (enemyTowersElement.title = "敌方已推掉的塔"))
  const matchClockElement = element("sf-hud__time sf-num", "00:00"),
    nextWaveTextElement = element("sf-num", ""),
    nextWaveElement = createEl("span", "sf-hud__wave", createIconEl(iconFor("hourglass")), nextWaveTextElement)
  nextWaveElement.title = "下一波小兵"
  const scorePlateElement = createEl(
      "div",
      "sf-hud__score",
      createEl(
        "div",
        "sf-hud__score-plate",
        createEl("div", "sf-hud__score-side is-blue", element("sf-hud__score-team", "蓝"), allyTowersElement, elementResult),
        createEl("div", "sf-hud__score-mid"),
        createEl("div", "sf-hud__score-side is-red", element("sf-hud__score-team", "红"), enemyTowersElement, enemyKillsElement),
      ),
      createEl("div", "sf-hud__clock", createEl("div", "sf-hud__clock-in", matchClockElement, nextWaveElement)),
    ),
    killCountElement = createEl("b", "sf-num", "0"),
    deathCountElement = createEl("b", "sf-num is-d", "0"),
    assistCountElement = createEl("b", "sf-num is-a", "0"),
    csCountElement = createEl("b", "sf-num", "0"),
    kdaChipElement = createEl("div", "sf-hud__chip sf-hud__kda", createIconEl(iconFor("kill")), killCountElement, createEl("i", null, "/"), deathCountElement, createEl("i", null, "/"), assistCountElement, createEl("span", "sf-hud__kda-cs", createIconEl(iconFor("cs")), csCountElement))
  kdaChipElement.title = "击杀 / 阵亡 / 助攻 · 补兵"
  const goldCountElement = createEl("b", "sf-num", "0"),
    goldChipElement = createEl("div", "sf-hud__chip sf-hud__gold", createIconEl(iconFor("gold")), goldCountElement)
  goldChipElement.title = "金币"
  const makeIconButtonElement = makeIconButton({ icon: iconFor("scoreboard"), label: "战况", onClick: () => scoreContext.actions.toggleScoreboard() })
  makeIconButtonElement.appendChild(createEl("span", "sf-hud__key", "Tab"))
  const settingsButton = makeIconButton({ icon: iconFor("pause"), label: "暂停 / 设置", onClick: () => scoreContext.actions.openSettings() })
  settingsButton.appendChild(createEl("span", "sf-hud__key", "Esc"))
  const topBarRightRow = createEl("div", "sf-hud__tr", kdaChipElement, goldChipElement, makeIconButtonElement, settingsButton),
    createFormattedTextWriterFormattedTextWriterValue = createFormattedTextWriter(elementResult),
    FormattedTextWriterResult = createFormattedTextWriter(enemyKillsElement),
    writeAllyTowerCount = createFormattedTextWriter(allyTowerCountElement),
    writeEnemyTowerCount = createFormattedTextWriter(enemyTowerCountElement),
    writeMatchClock = createFormattedTextWriter(matchClockElement, formatScoreboardClock),
    writeNextWaveText = createTextWriter(nextWaveTextElement),
    writeKillCount = createFormattedTextWriter(killCountElement),
    writeDeathCount = createFormattedTextWriter(deathCountElement),
    writeAssistCount = createFormattedTextWriter(assistCountElement),
    writeCsCount = createFormattedTextWriter(csCountElement),
    writeGoldCount = createFormattedTextWriter(goldCountElement)
  let lastAllyKills = -1,
    lastEnemyKills = -1,
    lastGoldAmount = -1,
    waveSoonActive = !1
  return {
    els: [scorePlateElement, topBarRightRow],
    update(scoreWorld) {
      const scoreGameState = scoreWorld.state,
        selectedTeams = scoreGameState.teams[scoreWorld.team],
        enemyTeamStats = scoreGameState.teams[scoreWorld.team === 0 ? 1 : 0]
      ;(createFormattedTextWriterFormattedTextWriterValue(selectedTeams.kills),
        FormattedTextWriterResult(enemyTeamStats.kills),
        selectedTeams.kills !== lastAllyKills && (lastAllyKills >= 0 && toggleClassOn(elementResult, "is-bump"), (lastAllyKills = selectedTeams.kills)),
        enemyTeamStats.kills !== lastEnemyKills && (lastEnemyKills >= 0 && toggleClassOn(enemyKillsElement, "is-bump"), (lastEnemyKills = enemyTeamStats.kills)),
        writeAllyTowerCount(selectedTeams.towersDestroyed),
        writeEnemyTowerCount(enemyTeamStats.towersDestroyed),
        writeMatchClock(Math.floor(scoreGameState.time)))
      const nextWaveSeconds = Math.ceil(scoreGameState.nextWaveIn)
      writeNextWaveText(nextWaveSeconds > 0 ? `${nextWaveSeconds}秒` : "出兵")
      const isWaveImminent = nextWaveSeconds > 0 && nextWaveSeconds <= 3
      isWaveImminent !== waveSoonActive && ((waveSoonActive = isWaveImminent), nextWaveElement.classList.toggle("is-soon", isWaveImminent))
      const meValue = scoreWorld.me
      ;(writeKillCount(meValue.kills), writeDeathCount(meValue.deaths), writeAssistCount(meValue.assists), writeCsCount(meValue.cs))
      const currentGold = Math.floor(meValue.gold)
      ;(writeGoldCount(currentGold), currentGold !== lastGoldAmount && (lastGoldAmount >= 0 && currentGold - lastGoldAmount >= 15 && toggleClassOn(goldChipElement, "is-pop"), (lastGoldAmount = currentGold)))
    },
  }
}

const SLOW_UPDATE_THRESHOLD_MS = 2,
  HUD_OVERRIDE_CSS = expandCssUnits(`
/* 对局结束：收起操作类部件，把画面留给终局演出与结算页 */
.sf-hud__skills, .sf-hud__joy, .sf-hud__shopbar, .sf-hud__status { transition: opacity 0.5s linear; }
.sf-hud.is-over .sf-hud__skills, .sf-hud.is-over .sf-hud__joy, .sf-hud.is-over .sf-hud__shopbar, .sf-hud.is-over .sf-hud__status { opacity: 0; pointer-events: none; }
.sf-hud.is-over .sf-hud__skills *, .sf-hud.is-over .sf-hud__shopbar *, .sf-hud.is-over .sf-hud__status * { pointer-events: none; }
/* 宿主关闭了输入(加载页还盖着 / 提示层开着)：控件与战场都不接指针，暂停对话框除外 */
.sf-hud.is-locked .sf-hud__field, .sf-hud.is-locked button, .sf-hud.is-locked [data-hud-hit] { pointer-events: none; }
.sf-hud.is-locked .sf-dialog-scrim, .sf-hud.is-locked .sf-dialog-scrim button { pointer-events: auto; }
`)

function findPlayerHero(heroLookupState) {
  for (const candidateHero of heroLookupState.heroes) if (candidateHero.id === heroLookupState.playerId) return candidateHero
  return heroLookupState.heroes[0]
}

interface HudRootOptions {
  input?: string
  inputEnabled?: boolean
  dimTarget?: HTMLElement | null
  onDeathChange?: (isDead: boolean) => void
  tipsSeconds?: number
  autoPause?: boolean
}

interface HudPart {
  onMode?(mode: string): void
  update?(config: any, payload?: any): void
  handleEvent?(event: any, config: any): void
  afterEvents?(config: any): void
  dispose?(): void
}

/**
 * 创建界面。
 *
 * @param element - 界面元素
 * @param builder - 构建器
 * @param initialGameState - 第三输入
 * @param hudOptions - 第四输入
 * @returns 结果对象
 */
function createHudRoot(element, builder, initialGameState, hudOptions: HudRootOptions = {}) {
  ;(injectThemeStyles(), injectHudBaseStyles(), injectHudOverlayStyles(), injectStyleSheet("sf-hud-index", HUD_OVERRIDE_CSS))
  const forcedInputMode = hudOptions.input === "touch" || hudOptions.input === "kbm" ? hudOptions.input : null,
    hudRootElement = createEl("div", "sf-root sf-hud")
  let settingsDialog = null,
    isDisposed = !1
  const rootConfig = {
      root: hudRootElement,
      host: builder,
      state: initialGameState,
      me: findPlayerHero(initialGameState),
      team: findPlayerHero(initialGameState).team,
      mode: orDefault(forcedInputMode),
      paused: !1,
      enabled: hudOptions.inputEnabled !== !1,
      now: performance.now() / 1e3,
      toast: (toastMessage, toastTone) => ToastLayerValue.show(toastMessage, toastTone),
      inputBlocked: () => !rootConfig.enabled || !rootConfig.me.alive || rootConfig.paused || rootConfig.state.over,
      hero(targetHeroId) {
        for (const matchedHero of rootConfig.state.heroes) if (matchedHero.id === targetHeroId) return matchedHero
      },
      /**
       * 处理单位。
       *
       * @param targetUnitId - 输入
      */
      unit(targetUnitId) {
        if (!(targetUnitId < 0)) {
          for (const matchedUnit of rootConfig.state.units) if (matchedUnit.id === targetUnitId) return matchedUnit
        }
      },
      actions: null,
    },
    inputFieldElement = createEl("div", "sf-hud__field"),
    MinimapValue = createMinimap(rootConfig),
    ScoreBarValue = createScoreBar(rootConfig),
    KillFeedValue = createKillFeed(rootConfig),
    BannerValue = createBanner(),
    StatusStripValue = createStatusStrip(rootConfig),
    SkillBarValue = createSkillBar(rootConfig),
    ShopPanelValue = createShopPanel(rootConfig),
    ScoreboardValue = createScoreboard(rootConfig),
    GrayOverlayValue = createGrayOverlay(rootConfig, { dimTarget: hudOptions.dimTarget ?? null, onDeathChange: hudOptions.onDeathChange }),
    ToastLayerValue = createToastLayer(rootConfig),
    ChannelBarValue = createChannelBar(),
    FpsMeterValue = createFpsMeter(rootConfig),
    CoachPanelValue = createCoachPanel(rootConfig, { banner: BannerValue, minimap: MinimapValue }),
    TipsPanelValue = createTipsPanel(rootConfig, CoachPanelValue.replacesTips ? 0 : (hudOptions.tipsSeconds ?? 8))
  function b(touchKind) {
    if (!(touchKind === rootConfig.mode && hudRootElement.classList.contains(`sf-hud--${touchKind}`))) {
      ;((rootConfig.mode = touchKind), hudRootElement.classList.toggle("sf-hud--touch", touchKind === "touch"), hudRootElement.classList.toggle("sf-hud--kbm", touchKind === "kbm"))
      for (const modeAwarePart of hudParts) modeAwarePart.onMode?.(touchKind)
    }
  }
  const setShopConfig = {
    setShop(targetObject) {
      targetObject !== ShopPanelValue.isOpen() && ((targetObject && rootConfig.state.over) || (refreshHud(), targetObject && (ScoreboardValue.setOpen(!1, !1), bindInputControlsResult.cancelAim()), ShopPanelValue.setOpen(targetObject)))
    },
    toggleShop: () => setShopConfig.setShop(!ShopPanelValue.isOpen()),
    isShopOpen: () => ShopPanelValue.isOpen(),
    setScoreboard(scoreboardOpen, scoreboardPinned) {
      ;(scoreboardOpen && scoreboardPinned && ShopPanelValue.setOpen(!1), ScoreboardValue.setOpen(scoreboardOpen, scoreboardPinned))
    },
    toggleScoreboard: () => setShopConfig.setScoreboard(!ScoreboardValue.isPinned(), !0),
    isScoreboardPinned: () => ScoreboardValue.isPinned(),
    openSettings() {
      settingsDialog ||
        isDisposed ||
        rootConfig.state.over ||
        (refreshHud(),
        bindInputControlsResult.reset(),
        (rootConfig.paused = !0),
        builder.setPaused(!0),
        (settingsDialog = openDialog(hudRootElement, {
          mode: "match",
          get: () => ({ ...builder.getSettings(), autoBuy: rootConfig.me.autoBuy === !0 }),
          update: (settingsDraft) => {
            ;(settingsDraft.autoBuy !== void 0 && !rootConfig.state.over && builder.command({ type: "autoBuy", enabled: settingsDraft.autoBuy }), builder.updateSettings(settingsDraft))
          },
          autoBuyNote: () => (builder.getSettings().autoBuy && rootConfig.me.autoBuy !== !0 && !rootConfig.state.over ? "卖了推荐装，本局已关闭。点一下重新打开。" : null),
          audio: builder.audio,
          onReplayTutorial: () => CoachPanelValue.restartGuide(),
          onQuit: () => builder.quit(),
          onClose: () => {
            ;((settingsDialog = null), (rootConfig.paused = !1), isDisposed || builder.setPaused(!1))
          },
        })))
    },
    buy(purchasedItemId) {
      if (rootConfig.state.over) return !1
      const evaluatePurchaseResult = evaluatePurchase(rootConfig.me, purchasedItemId)
      return evaluatePurchaseResult.ok ? (builder.command({ type: "buy", itemId: purchasedItemId }), builder.audio.ui("buy"), rootConfig.toast(`已购买 ${ItemTable[purchasedItemId].name}`, "good"), !0) : (builder.audio.ui("error"), rootConfig.toast(BLOCK_REASON_LABELS[evaluatePurchaseResult.block], "warn"), !1)
    },
    sell(itemSlotIndex) {
      const selectedItems = rootConfig.me.items[itemSlotIndex]
      !selectedItems || rootConfig.state.over || (builder.command({ type: "sell", index: itemSlotIndex }), builder.audio.ui("confirm"), rootConfig.toast(`已出售 ${ItemTable[selectedItems].name}，返还 ${getItemSellValue(selectedItems)} 金币`, "info"))
    },
  }
  rootConfig.actions = setShopConfig
  const bindInputControlsResult = bindInputControls(rootConfig, { field: inputFieldElement, skills: SkillBarValue, forced: forcedInputMode, setMode: b })
  hudRootElement.append(...GrayOverlayValue.els.slice(0, 2), inputFieldElement, bindInputControlsResult.joystick, MinimapValue.el, ...ShopPanelValue.els.slice(0, 1), ...ScoreBarValue.els, KillFeedValue.el, FpsMeterValue.el, StatusStripValue.el, SkillBarValue.el, BannerValue.el, ...CoachPanelValue.els, ChannelBarValue.el, TipsPanelValue.el, ToastLayerValue.el, GrayOverlayValue.els[2], ScoreboardValue.el, ShopPanelValue.els[1])
  const hudPartRegistry: Array<[string, HudPart]> = [
      ["minimap", MinimapValue],
      ["topbar", ScoreBarValue],
      ["feed", KillFeedValue],
      ["banner", BannerValue],
      ["coach", CoachPanelValue],
      ["status", StatusStripValue],
      ["skills", SkillBarValue],
      ["shop", ShopPanelValue],
      ["scoreboard", ScoreboardValue],
      ["death", GrayOverlayValue],
      ["toasts", ToastLayerValue],
      ["channel", ChannelBarValue],
      ["fps", FpsMeterValue],
      ["tips", TipsPanelValue],
      ["input", bindInputControlsResult],
    ],
    hudParts = hudPartRegistry.map((hudPartEntry) => hudPartEntry[1]),
    updatableParts = hudParts.filter((partWithUpdate) => partWithUpdate.update),
    eventHandlingParts = hudParts.filter((partWithHandleEvent) => partWithHandleEvent.handleEvent),
    afterEventParts = hudParts.filter((partWithAfterEvents) => partWithAfterEvents.afterEvents)
  let profilingOn = !1
  const profileStatsMap = new Map(),
    getPartStats = (lookupKey) => {
      let getValue = profileStatsMap.get(lookupKey)
      return (getValue || profileStatsMap.set(lookupKey, (getValue = { calls: 0, total: 0, max: 0, slow: 0, evBatches: 0, evTotal: 0, evMax: 0, evCur: 0 })), getValue)
    }
  function B(updatePayload) {
    for (let index = 0; index < updatableParts.length; index++) {
      const selectedC = updatableParts[index],
        updateStartMs = performance.now()
      selectedC.update(rootConfig, updatePayload)
      const updateDurationMs = performance.now() - updateStartMs,
        lResult = getPartStats(selectedC)
      ;(lResult.calls++, (lResult.total += updateDurationMs), updateDurationMs > lResult.max && (lResult.max = updateDurationMs), updateDurationMs > SLOW_UPDATE_THRESHOLD_MS && lResult.slow++)
    }
  }
  function G(batchEvents) {
    for (let index = 0; index < eventHandlingParts.length; index++) {
      const selectedR = eventHandlingParts[index],
        eventHandlingStartMs = performance.now()
      for (let ttIndex = 0; ttIndex < batchEvents.length; ttIndex++) selectedR.handleEvent(batchEvents[ttIndex], rootConfig)
      getPartStats(selectedR).evCur += performance.now() - eventHandlingStartMs
    }
    for (let afterEventIndex = 0; afterEventIndex < afterEventParts.length; afterEventIndex++) {
      const selectedI = afterEventParts[afterEventIndex],
        afterEventsStartTime = performance.now()
      ;(selectedI.afterEvents(rootConfig), (getPartStats(selectedI).evCur += performance.now() - afterEventsStartTime))
    }
    for (const value of profileStatsMap.values()) value.evCur <= 0 || (value.evBatches++, (value.evTotal += value.evCur), value.evCur > value.evMax && (value.evMax = value.evCur), (value.evCur = 0))
  }
  ;(b(rootConfig.mode), hudRootElement.classList.toggle("is-locked", !rootConfig.enabled), element.appendChild(hudRootElement))
  const bindUiSoundsResult = bindUiSounds(hudRootElement, builder.audio),
    handleVisibilityChange = () => {
      document.hidden && hudOptions.autoPause !== !1 && !rootConfig.state.over && setShopConfig.openSettings()
    }
  document.addEventListener("visibilitychange", handleVisibilityChange)
  const avoidUpdateInterval = 0.4
  let lastAvoidUpdateTime = -1 / 0,
    textValue = ""
  function nt(currentTime) {
    if (!builder.setOverlayAvoid || currentTime - lastAvoidUpdateTime < avoidUpdateInterval) return
    lastAvoidUpdateTime = currentTime
    const avoidRects = [],
      collectAvoidRect = (measuredElement) => {
        if (!measuredElement) return
        const BoundingClientRectValue = measuredElement.getBoundingClientRect()
        BoundingClientRectValue.width < 2 || BoundingClientRectValue.height < 2 || avoidRects.push({ left: Math.round(BoundingClientRectValue.left), top: Math.round(BoundingClientRectValue.top), right: Math.round(BoundingClientRectValue.right), bottom: Math.round(BoundingClientRectValue.bottom) })
      }
    for (const scoreBarElement of ScoreBarValue.els) collectAvoidRect(scoreBarElement)
    if ((collectAvoidRect(MinimapValue.el), BannerValue.isShowing())) collectAvoidRect(BannerValue.el.firstElementChild)
    else for (const coachChildElement of Array.from(CoachPanelValue.els[CoachPanelValue.els.length - 1].children)) collectAvoidRect(coachChildElement)
    let total = ""
    for (const avoidRect of avoidRects) total += `${avoidRect.left},${avoidRect.top},${avoidRect.right},${avoidRect.bottom};`
    total !== textValue && ((textValue = total), builder.setOverlayAvoid(avoidRects))
  }
  let isMatchOver = !1
  function st(freshState) {
    ;((rootConfig.state = freshState), (rootConfig.me = findPlayerHero(freshState)))
  }
  return {
    el: hudRootElement,
    update(hudStateUpdate, updateValue) {
      if (!isDisposed) {
        if ((st(hudStateUpdate), (rootConfig.now = performance.now() / 1e3), hudStateUpdate.over !== isMatchOver && ((isMatchOver = hudStateUpdate.over), hudRootElement.classList.toggle("is-over", isMatchOver), isMatchOver && (ShopPanelValue.setOpen(!1), ScoreboardValue.setOpen(!1, !1), bindInputControlsResult.reset())), profilingOn)) B(updateValue)
        else for (let updatablePartIndex = 0; updatablePartIndex < updatableParts.length; updatablePartIndex++) updatableParts[updatablePartIndex].update(rootConfig, updateValue)
        nt(rootConfig.now)
      }
    },
    /**
     * 处理事件。
     *
     * @param gameEvents - 主要输入
     * @param incomingState - 次要输入
    */
    handleEvents(gameEvents, incomingState) {
      if (!(isDisposed || gameEvents.length === 0)) {
        if ((st(incomingState), (rootConfig.now = performance.now() / 1e3), profilingOn)) {
          G(gameEvents)
          return
        }
        for (let index = 0; index < gameEvents.length; index++) {
          const selectedTt = gameEvents[index]
          for (let eventIndex = 0; eventIndex < eventHandlingParts.length; eventIndex++) eventHandlingParts[eventIndex].handleEvent(selectedTt, rootConfig)
        }
        for (let afterEventHandlerIndex = 0; afterEventHandlerIndex < afterEventParts.length; afterEventHandlerIndex++) afterEventParts[afterEventHandlerIndex].afterEvents(rootConfig)
      }
    },
    dispose() {
      if (!isDisposed) {
        ;((isDisposed = !0), document.removeEventListener("visibilitychange", handleVisibilityChange), settingsDialog?.close())
        for (const hudPart of hudParts) hudPart.dispose?.()
        ;(bindUiSoundsResult(), refreshHud(), builder.setAim(null), builder.setCameraPeek(null), builder.setOverlayAvoid?.(null), hudRootElement.remove())
      }
    },
    setShopOpen: (shopShouldOpen) => setShopConfig.setShop(shopShouldOpen),
    setScoreboardOpen: (scoreboardShouldOpen) => setShopConfig.setScoreboard(scoreboardShouldOpen, !0),
    openSettings: () => setShopConfig.openSettings(),
    announce(announceKey, announceTeam, announceUnitId, announceVictimId) {
      BannerValue.demo({ type: "announce", key: announceKey, team: announceTeam, unitId: announceUnitId, victimId: announceVictimId }, rootConfig)
    },
    getInputMode: () => rootConfig.mode,
    setInputEnabled(shouldEnableInput) {
      shouldEnableInput === rootConfig.enabled || isDisposed || ((rootConfig.enabled = shouldEnableInput), hudRootElement.classList.toggle("is-locked", !shouldEnableInput), shouldEnableInput || (refreshHud(), bindInputControlsResult.reset()))
    },
    setProfiling(profilingEnabled) {
      ;((profilingOn = profilingEnabled), profilingEnabled && profileStatsMap.clear())
    },
    coach: { restartGuide: () => CoachPanelValue.restartGuide(), debug: () => CoachPanelValue.debug() },
    getProfile() {
      const profileEntries = []
      for (const [partName, lookupKey] of hudPartRegistry) {
        const Result = profileStatsMap.get(lookupKey)
        Result &&
          profileEntries.push({
            part: partName,
            calls: Result.calls,
            avg: Result.calls > 0 ? Result.total / Result.calls : 0,
            max: Result.max,
            slow: Result.slow,
            evBatches: Result.evBatches,
            evAvg: Result.evBatches > 0 ? Result.evTotal / Result.evBatches : 0,
            evMax: Result.evMax,
          })
      }
      return profileEntries.sort((leftProfile, rightProfile) => rightProfile.max - leftProfile.max)
    },
  }
}

export { getStoredSetting, setStoredSetting, createHudRoot }