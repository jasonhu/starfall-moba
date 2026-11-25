/**
 * 状态条面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { INFO_ICON_PATH } from './svg-path-assets'
import { ICON_FRAME_KINDS, SKILL_EFFECT_COLORS } from './icon-theme'
import { buildItemTooltip, escapeHtml } from './hud-panels'
import { bindTooltip, statusEffects, createEl, createIconEl, iconFor, injectStyleSheet, makeIconByName, makePanel } from './dom-kit'
import { HUD_STAT_CSS, HUD_STAT_FADE_ALPHA, HUD_STAT_MAX_LINES, STATUS_ID_TO_INDEX } from './hud-stat-styles'
import { HERO_TABLE } from '../../heroes/registry'
import { ROLE_TINT_COLORS, heroNameForBanner } from './banner'
import { z0 } from '../skills/skill-values'
import { describeMonsterBuff, itemIconFor } from '../render/procedural-art'
import { ItemTable } from '../equipment'
import { MINIMAP_STYLE } from './minimap'

function getInfoIconPath(statusId) {
  return INFO_ICON_PATH[statusId]()
}

function hexToRgbString(hexColor) {
  const parseIntResult = parseInt(hexColor.slice(1), 16)
  return `${(parseIntResult >> 16) & 255}, ${(parseIntResult >> 8) & 255}, ${parseIntResult & 255}`
}

function skillTagHtml(ultKind, effectTags) {
  let total = ultKind === "ult" ? '<span class="sf-stag is-ult">大招</span>' : ultKind === "passive" ? '<span class="sf-stag is-passive">被动</span>' : ""
  for (const effectTag of effectTags ?? []) {
    const selectedSKILL_EFFECT_COLORS = SKILL_EFFECT_COLORS[effectTag]
    total += `<span class="sf-stag" style="--tag:${hexToRgbString(selectedSKILL_EFFECT_COLORS.color)}">${selectedSKILL_EFFECT_COLORS.name}</span>`
  }
  return total ? `<span class="sf-stags">${total}</span>` : ""
}

function createTextWriter(textElement) {
  let lastDisplayedText = null
  return (text) => {
    text !== lastDisplayedText && ((lastDisplayedText = text), (textElement.textContent = text))
  }
}

function createFormattedTextWriter(textElement, formatValue: (value: number) => string = String) {
  let lastDisplayedNumber = NaN
  return (number) => {
    number !== lastDisplayedNumber && ((lastDisplayedNumber = number), (textElement.textContent = formatValue(number)))
  }
}

function createCssVarWriter(element, cssVarName, step = 0.002) {
  let lastSnappedRatio = NaN
  return (ratio) => {
    const snappedRatio = Math.round(ratio / step) * step
    snappedRatio !== lastSnappedRatio && ((lastSnappedRatio = snappedRatio), element.style.setProperty(cssVarName, snappedRatio.toFixed(4)))
  }
}

function bindClassToggle(element, className) {
  let wasActive = null
  return (active) => {
    active !== wasActive && ((wasActive = active), element.classList.toggle(className, active))
  }
}

function toggleClassOn(element, className) {
  ;(element.classList.remove(className), element.offsetWidth, element.classList.add(className))
}

function buildPassiveTooltipHtml(hero) {
  const passive = hero.passive
  return (
    `<div class="sf-tip__title"><span>${escapeHtml(passive.name)}</span><span class="sf-tip__meta">被动</span></div><div class="sf-hud-tiptags">${skillTagHtml("passive", passive.tags)}</div>` +
    (passive.brief ? `<div class="sf-hud-tipbrief">${escapeHtml(passive.brief)}</div>` : "") +
    `<div class="sf-hud-tipdesc">${escapeHtml(passive.desc)}</div>`
  )
}

function createStatusStrip(config) {
  injectStyleSheet("sf-hud-status", HUD_STAT_CSS)
  const { host: host } = config,
    heroId = config.me.heroId,
    selectedHERO_TABLE = HERO_TABLE[heroId],
    disposers = [],
    element = createEl("span", "sf-hud__st-respawn sf-num"),
    ElValue = createEl("span", "sf-hud__st-lv sf-num", "1"),
    makePanelElement = makePanel(ICON_FRAME_KINDS(heroId, "passive"), { round: !0, cls: "sf-hud__st-passive", label: `被动：${selectedHERO_TABLE.passive.name}` })
  ;(makePanelElement.setAttribute("data-hud-hit", ""), disposers.push(bindTooltip(makePanelElement, () => buildPassiveTooltipHtml(selectedHERO_TABLE))))
  const createElElement = createEl("span", "sf-hud__st-name", createIconEl(makeIconByName(selectedHERO_TABLE.role)), selectedHERO_TABLE.name)
  ;(createElElement.style.setProperty("--role", ROLE_TINT_COLORS[selectedHERO_TABLE.role]), createElElement.setAttribute("aria-label", z0(selectedHERO_TABLE)))
  const createElElValue = createEl("div", "sf-hud__st-por", heroNameForBanner(host, heroId), element, createElElement, ElValue, makePanelElement),
    ElResult = createEl("span", "sf-num"),
    shieldText = createEl("em", "sf-num"),
    maxHpText = createEl("span", "sf-num"),
    hpBar = createEl(
      "div",
      "sf-hud__bar is-hp",
      createEl("i", "sf-hud__bar-trail"),
      createEl("i", "sf-hud__bar-fill"),
      createEl("i", "sf-hud__bar-shield"),
      createEl("i", "sf-hud__bar-ticks"),
      createEl("i", "sf-hud__bar-gloss"),
      createEl("span", "sf-hud__bar-text", ElResult, shieldText, maxHpText),
    ),
    manaText = createEl("span", "sf-hud__bar-text sf-num"),
    manaBar = createEl("div", "sf-hud__bar is-mp", createEl("i", "sf-hud__bar-fill"), createEl("i", "sf-hud__bar-gloss"), manaText),
    xpBar = createEl("div", "sf-hud__xp", createEl("i"))
  ;(xpBar.setAttribute("data-hud-hit", ""),
    disposers.push(
      bindTooltip(xpBar, () => {
        const selfPlayer = config.me
        return selfPlayer.xpToNext > 0
          ? `<div class="sf-tip__title"><span>等级 ${selfPlayer.level}</span><span class="sf-tip__meta sf-num">${Math.floor(selfPlayer.xp)} / ${selfPlayer.xpToNext}</span></div><div>获得经验可提升等级，技能会自动升级。</div>`
          : `<div class="sf-tip__title"><span>等级 ${selfPlayer.level}</span><span class="sf-tip__meta">已满级</span></div>`
      }),
    ))
  // 异构数组应为「标签 / 取值函数 / 格式化函数」三元组；显式标注以固定各列签名
  const statLines: Array<[string, (unit: { stats: { ap: number; ad: number; armor: number; mr: number; moveSpeed: number } }) => number, (value: number) => string]> = [
      selectedHERO_TABLE.role === "mage" ? ["法强", (mageUnit) => Math.round(mageUnit.stats.ap), String] : ["物攻", (physicalUnit) => Math.round(physicalUnit.stats.ad), String],
      ["护甲", (playerUnit) => Math.round(playerUnit.stats.armor), String],
      ["魔抗", (playerUnit) => Math.round(playerUnit.stats.mr), String],
      ["移速", (playerUnit) => Math.round(playerUnit.stats.moveSpeed * 10) / 10, (moveSpeed) => moveSpeed.toFixed(1)],
    ],
    statsDisplay = createEl("div", "sf-hud__st-stats")
  statsDisplay.setAttribute("data-hud-hit", "")
  const statLineWriters = statLines.map(([statLabel, , formatStatValue]) => {
    const element = createEl("b", "sf-num")
    return (statsDisplay.appendChild(createEl("span", null, statLabel, element)), createFormattedTextWriter(element, formatStatValue))
  })
  disposers.push(
    bindTooltip(statsDisplay, () => {
      const stats = config.me.stats,
        formatPercent = (ratio) => `${Math.round(ratio * 100)}%`,
        tooltipStatRows = [
          ["物攻", String(Math.round(stats.ad))],
          ["法强", String(Math.round(stats.ap))],
          ["护甲", String(Math.round(stats.armor))],
          ["魔抗", String(Math.round(stats.mr))],
          ["攻速", stats.attackSpeed.toFixed(2)],
          ["移速", stats.moveSpeed.toFixed(1)],
          ["冷却缩减", formatPercent(stats.cdr)],
          ["吸血", formatPercent(stats.lifesteal)],
          ["暴击", formatPercent(stats.critChance)],
          ["暴击伤害", formatPercent(stats.critDamage)],
          ["物穿", formatPercent(stats.armorPen)],
          ["法穿", formatPercent(stats.magicPen)],
          ["回血", `${stats.hpRegen.toFixed(1)}/秒`],
          ["回蓝", `${stats.manaRegen.toFixed(1)}/秒`],
          ["射程", stats.attackRange.toFixed(1)],
          ["", ""],
        ]
      return `<div class="sf-tip__title"><span>${escapeHtml(z0(selectedHERO_TABLE))}</span><span class="sf-tip__meta">属性</span></div><div style="display:grid;grid-template-columns:auto auto auto auto;gap:1px 10px;margin-top:4px">${tooltipStatRows.map(([statLabel, statValue]) => `<span style="color:var(--sf-c-text-3)">${statLabel}</span><b class="sf-num" style="color:var(--sf-c-text);text-align:right">${statValue}</b>`).join("")}</div><div style="margin-top:5px;font-size:var(--sf-fs-xs);color:var(--sf-c-text-3)">冷却缩减上限 ${formatPercent(HUD_STAT_FADE_ALPHA)}；吸血只对普攻生效。</div>`
    }),
  )
  const barsContainer = createEl("div", "sf-hud__st-bars", statsDisplay, hpBar, manaBar, xpBar),
    itemSlotsContainer = createEl("div", "sf-hud__st-items"),
    itemSlotStates = []
  for (let index = 0; index < config.me.items.length; index++) {
    const lookupKey = makePanel(null)
    ;(lookupKey.setAttribute("data-hud-hit", ""), itemSlotsContainer.appendChild(lookupKey), itemSlotStates.push({ el: lookupKey, id: null, off: null }))
  }
  const goldText = createEl("span", "sf-hud__st-shop-gold sf-num", "0"),
    shopButton = createEl("button", "sf-hud__st-shop", createEl("span", "sf-hud__st-shop-ico", createIconEl(iconFor("shop"))), goldText)
  ;((shopButton.type = "button"), (shopButton.tabIndex = -1), (shopButton.dataset.sfSnd = "click"), shopButton.setAttribute("aria-label", "金币 / 打开商店"), shopButton.addEventListener("click", () => config.actions.toggleShop()))
  const FormattedTextWriterValue = createFormattedTextWriter(goldText),
    buffsContainer = createEl("div", "sf-hud__buffs"),
    buffViews = new Map(),
    activeBuffs = [],
    statusHud = createEl("div", "sf-hud__status", buffsContainer, createElElValue, barsContainer, itemSlotsContainer, shopButton)
  statusHud.setAttribute("data-hud-hit", "")
  const CssVarWriterValue = createCssVarWriter(hpBar, "--p"),
    createCssVarWriterCssVarWriterValue = createCssVarWriter(hpBar, "--s"),
    CssVarWriterResult = createCssVarWriter(manaBar, "--p"),
    writeXpProgress = createCssVarWriter(xpBar, "--p", 0.005),
    createFormattedTextWriterFormattedTextWriterValue = createFormattedTextWriter(ElResult),
    FormattedTextWriterResult = createFormattedTextWriter(maxHpText, (maxHp) => `/ ${maxHp}`),
    writeShield = createFormattedTextWriter(shieldText, (shield) => (shield > 0 ? `+${shield}` : "")),
    TextWriterValue = createTextWriter(manaText),
    writeLevel = createFormattedTextWriter(ElValue),
    writeRespawnTime = createFormattedTextWriter(element),
    bindClassToggleResult = bindClassToggle(statusHud, "is-dead"),
    setMidHpClass = bindClassToggle(hpBar, "is-mid"),
    setLowHpClass = bindClassToggle(hpBar, "is-low")
  let lastRoundedHpMax = -1,
    lastDisplayedMana = -1,
    lastRoundedMaxMana = -1,
    isActive = !1
  function Q(items) {
    for (let index = 0; index < itemSlotStates.length; index++) {
      const selectedS = itemSlotStates[index],
        itemId = items.items[index] ?? null
      itemId !== selectedS.id &&
        ((selectedS.id = itemId),
        selectedS.off?.(),
        (selectedS.off = null),
        selectedS.el.classList.toggle("sf-slot--empty", itemId === null),
        (selectedS.el.innerHTML = itemId ? itemIconFor(itemId) : ""),
        itemId ? (selectedS.el.setAttribute("aria-label", ItemTable[itemId].name), (selectedS.off = bindTooltip(selectedS.el, () => buildItemTooltip(ItemTable[itemId]))), isActive && toggleClassOn(selectedS.el, "is-new")) : (selectedS.el.removeAttribute("aria-label"), selectedS.el.classList.remove("is-new")))
    }
    isActive = !0
  }
  function $(statusId) {
    const activeBuff = config.me.buffs.find((buff) => buff.id === statusId),
      selectedStatusEffects = statusEffects[statusId],
      durationText = activeBuff && Number.isFinite(activeBuff.timeLeft) ? `${activeBuff.timeLeft >= 10 ? Math.ceil(activeBuff.timeLeft) : activeBuff.timeLeft.toFixed(1)} 秒` : "持续",
      stackCountSuffix = activeBuff && activeBuff.stacks > 1 ? ` ×${activeBuff.stacks}` : ""
    return `<div class="sf-tip__title"><span>${escapeHtml(selectedStatusEffects.name)}${stackCountSuffix}</span><span class="sf-tip__meta sf-num">${durationText}</span></div><div>${activeBuff ? escapeHtml(describeMonsterBuff(activeBuff)) : ""}</div>`
  }
  function ut(unit) {
    activeBuffs.length = 0
    for (const buff of unit.buffs) {
      let isDuplicate = !1
      for (let index = 0; index < activeBuffs.length; index++)
        if (activeBuffs[index].id === buff.id) {
          ;(buff.timeLeft > activeBuffs[index].timeLeft && (activeBuffs[index] = buff), (isDuplicate = !0))
          break
        }
      isDuplicate || activeBuffs.push(buff)
    }
    if ((activeBuffs.length > 1 && activeBuffs.sort((leftBuff, rightBuff) => (STATUS_ID_TO_INDEX.get(leftBuff.id) ?? 0) - (STATUS_ID_TO_INDEX.get(rightBuff.id) ?? 0)), activeBuffs.length > HUD_STAT_MAX_LINES && (activeBuffs.length = HUD_STAT_MAX_LINES), buffViews.size > 0))
      for (const [statusId, isReady] of buffViews) {
        let isStillPresent = !1
        for (const listedBuff of activeBuffs) listedBuff.id === statusId && (isStillPresent = !0)
        isStillPresent || (isReady.off(), isReady.el.remove(), buffViews.delete(statusId))
      }
    for (let buffIndex = 0; buffIndex < activeBuffs.length; buffIndex++) {
      const selectedC = activeBuffs[buffIndex]
      let Value = buffViews.get(selectedC.id)
      if (!Value) {
        const statusEffect = statusEffects[selectedC.id],
          element = createEl("i", "sf-hud__buff-cd"),
          stackCountText = createEl("b", "sf-hud__buff-n sf-num"),
          buffIcon = createEl("span", `sf-hud__buff is-${statusEffect.kind}`)
        ;((buffIcon.innerHTML = getInfoIconPath(selectedC.id)), buffIcon.append(element, stackCountText), buffIcon.setAttribute("aria-label", statusEffect.name))
        const buffStatusId = selectedC.id
        ;((Value = { el: buffIcon, setT: createCssVarWriter(buffIcon, "--t", 1 / 90), setN: createTextWriter(stackCountText), off: bindTooltip(buffIcon, () => $(buffStatusId)) }), buffViews.set(selectedC.id, Value))
        const referenceBuffIcon = buffsContainer.children[buffIndex] ?? null
        buffsContainer.insertBefore(buffIcon, referenceBuffIcon)
      }
      ;(Value.setT(Number.isFinite(selectedC.timeLeft) && selectedC.duration > 0 && Number.isFinite(selectedC.duration) ? MINIMAP_STYLE(selectedC.timeLeft / selectedC.duration) : 1), Value.setN(selectedC.stacks > 1 ? String(selectedC.stacks) : ""))
    }
  }
  return {
    el: statusHud,
    update(worldState) {
      const meValue = worldState.me,
        playerStats = meValue.stats,
        shieldAmount = Math.max(0, meValue.shield),
        hpBarMax = Math.max(1, playerStats.maxHp, meValue.hp + shieldAmount),
        currentHp = meValue.alive ? Math.max(0, meValue.hp) : 0
      ;(CssVarWriterValue(currentHp / hpBarMax), createCssVarWriterCssVarWriterValue(shieldAmount / hpBarMax), createFormattedTextWriterFormattedTextWriterValue(Math.ceil(currentHp)), FormattedTextWriterResult(Math.round(playerStats.maxHp)), writeShield(Math.round(shieldAmount)))
      const hpRatio = currentHp / Math.max(1, playerStats.maxHp)
      ;(setLowHpClass(hpRatio < 0.25), setMidHpClass(hpRatio >= 0.25 && hpRatio < 0.5))
      const roundedHpBarMax = Math.round(hpBarMax)
      roundedHpBarMax !== lastRoundedHpMax && ((lastRoundedHpMax = roundedHpBarMax), hpBar.style.setProperty("--seg", `${((1e3 / hpBarMax) * 100).toFixed(3)}%`))
      const roundedMaxMana = Math.round(playerStats.maxMana),
        currentMana = Math.floor(Math.max(0, meValue.mana))
      ;(CssVarWriterResult(roundedMaxMana > 0 ? currentMana / roundedMaxMana : 0),
        (currentMana !== lastDisplayedMana || roundedMaxMana !== lastRoundedMaxMana) && ((lastDisplayedMana = currentMana), (lastRoundedMaxMana = roundedMaxMana), TextWriterValue(`${currentMana} / ${roundedMaxMana}`)),
        writeXpProgress(meValue.xpToNext > 0 ? MINIMAP_STYLE(meValue.xp / meValue.xpToNext) : 1),
        writeLevel(meValue.level),
        FormattedTextWriterValue(Math.floor(meValue.gold)),
        bindClassToggleResult(!meValue.alive),
        meValue.alive || writeRespawnTime(Math.ceil(meValue.respawnIn)))
      for (let index = 0; index < statLines.length; index++) statLineWriters[index](statLines[index][1](meValue))
      ;(Q(meValue), ut(meValue))
    },
    handleEvent(gameEvent, world) {
      gameEvent.type === "levelUp" && gameEvent.unitId === world.state.playerId && toggleClassOn(ElValue, "is-up")
    },
    dispose() {
      for (const disposeTooltip of disposers) disposeTooltip()
      for (const itemSlot of itemSlotStates) itemSlot.off?.()
      for (const value of buffViews.values()) value.off()
      buffViews.clear()
    },
  }
}

export { createFormattedTextWriter, bindClassToggle, createCssVarWriter, createStatusStrip, hexToRgbString, skillTagHtml, toggleClassOn, createTextWriter }