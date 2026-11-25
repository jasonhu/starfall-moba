/**
 * 商店面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BaseAttackRange, ItemList, ItemTable } from '../equipment'
import { HERO_IDS, HERO_TABLE } from '../../heroes/registry'
import { hasOpenDialog, createTabs, createEl, createIconEl, iconFor, injectStyleSheet, createToggle, makeIconButton, makePanel, makePanelBody } from './dom-kit'
import { BOOT_TIER_LABELS, HUD_COMPACT_BREAKPOINT_PX, HUD_SHOP_CSS_COMPACT, ITEM_CATEGORY_LABELS, ITEM_CATEGORY_ORDER, KILLFEED_INTERVAL_SECONDS, TOAST_FADE_SECONDS, TOAST_HOLD_SECONDS, itemBrief, itemShortName } from './hud-shop-styles'
import { bindClassToggle, createCssVarWriter, createFormattedTextWriter, createTextWriter, toggleClassOn } from './status-strip'
import { itemIconFor } from '../render/procedural-art'
import { EQUIP_SLOT_NAMES, extractStatLabels } from './icon-theme'
import { z0 } from '../skills/skill-values'
import { MINIMAP_STYLE } from './minimap'

function findOwnedBoots(itemIds) {
  let result = null
  for (const itemId of itemIds) itemId && ItemTable[itemId].category === "boots" && (result = itemId)
  return result
}

function getNextBuildItem(hero) {
  const buildOrder = HERO_TABLE[hero.heroId].build,
    ownedItems = hero.items,
    findOwnedBootsResult = findOwnedBoots(ownedItems),
    inventoryFull = ownedItems.indexOf(null) < 0,
    claimedSlots = ownedItems.map(() => !1)
  let isActive = !1
  for (const buildItemId of buildOrder) {
    const selectedItemTable = ItemTable[buildItemId]
    if (selectedItemTable.category === "boots") {
      if (findOwnedBootsResult && (ItemTable[findOwnedBootsResult].tier === 2 || selectedItemTable.tier === 1)) continue
      return isActive && !findOwnedBootsResult ? null : buildItemId
    }
    let alreadyOwned = !1
    for (let index = 0; index < ownedItems.length; index++)
      if (!claimedSlots[index] && ownedItems[index] === buildItemId) {
        ;((claimedSlots[index] = !0), (alreadyOwned = !0))
        break
      }
    if (!alreadyOwned) {
      if (!inventoryFull) return buildItemId
      isActive = !0
    }
  }
  return null
}

/**
 * 获取特效与装备。
 *
 * @param heroState - 输入
 * @param lookupOption - 输入
 * @returns 数值结果
 */
function getEffectiveItemCost(heroState, lookupOption) {
  const itemConfig = ItemTable[lookupOption]
  if (itemConfig.category === "boots") {
    const ownedBootsId = findOwnedBoots(heroState.items)
    if (ownedBootsId) return itemConfig.cost - Math.floor(ItemTable[ownedBootsId].cost * BaseAttackRange)
  }
  return itemConfig.cost
}

/**
 * 判断装备。
 *
 * @param heroState - 输入
 * @param itemId - 次要输入
 * @returns 数值结果
 */
function canBuyItem(heroState, itemId) {
  const itemConfig = ItemTable[itemId]
  if (itemConfig.category === "boots") {
    const ownedBootsId = findOwnedBoots(heroState.items)
    if (ownedBootsId) return itemConfig.tier !== 1 && ownedBootsId !== itemId
  }
  return heroState.items.indexOf(null) >= 0
}

function isRecommendedItem(heroId, itemId) {
  return HERO_TABLE[heroId].build.includes(itemId)
}

function getBuildSteps(heroState) {
  const buildOrder = HERO_TABLE[heroState.heroId].build,
    ownedItems = heroState.items,
    ownedBootsId = findOwnedBoots(ownedItems),
    NextBuildItemValue = getNextBuildItem(heroState),
    buildSteps = []
  let baseBootsId = null,
    finalBootsId = null
  for (const bootItemId of buildOrder) {
    const bootItemConfig = ItemTable[bootItemId]
    bootItemConfig.category === "boots" && (bootItemConfig.tier === 1 ? (baseBootsId = baseBootsId ?? bootItemId) : (finalBootsId = bootItemId))
  }
  if (baseBootsId || finalBootsId) {
    const targetBootsId = finalBootsId ?? baseBootsId,
      hasFinalBoots = finalBootsId !== null
    let doneKind
    ownedBootsId && (ItemTable[ownedBootsId].tier === 2 || !hasFinalBoots) ? (doneKind = "done") : (doneKind = ownedBootsId ? "base" : "todo")
    const buyItemId = doneKind === "done" ? null : doneKind === "base" ? targetBootsId : (baseBootsId ?? targetBootsId)
    buildSteps.push({ finalId: targetBootsId, baseId: hasFinalBoots ? baseBootsId : null, stage: doneKind, buyId: buyItemId, cost: buyItemId ? getEffectiveItemCost(heroState, buyItemId) : 0, next: !1, order: 1 })
  }
  const matchedSlots = ownedItems.map(() => !1)
  for (const buildItemId of buildOrder) {
    if (ItemTable[buildItemId].category === "boots") continue
    let alreadyOwned = !1
    for (let index = 0; index < ownedItems.length; index++)
      if (!matchedSlots[index] && ownedItems[index] === buildItemId) {
        ;((matchedSlots[index] = !0), (alreadyOwned = !0))
        break
      }
    buildSteps.push({ finalId: buildItemId, baseId: null, stage: alreadyOwned ? "done" : "todo", buyId: alreadyOwned ? null : buildItemId, cost: alreadyOwned ? 0 : ItemTable[buildItemId].cost, next: !1, order: buildSteps.length + 1 })
  }
  if (NextBuildItemValue) {
    const nextBuildStep = buildSteps.find((buildStep) => buildStep.buyId === NextBuildItemValue)
    nextBuildStep && (nextBuildStep.next = !0)
  }
  return buildSteps
}

function isBuildComplete(heroState) {
  return getBuildSteps(heroState).every((buildStep) => buildStep.stage === "done")
}

function getAutoBuyStatus(heroState) {
  const getNextBuildItemNextBuildItemValue = getNextBuildItem(heroState)
  return !getNextBuildItemNextBuildItemValue || !canBuyItem(heroState, getNextBuildItemNextBuildItemValue) ? (isBuildComplete(heroState) ? "done" : "paused") : heroState.gold >= getEffectiveItemCost(heroState, getNextBuildItemNextBuildItemValue) ? "ready" : "saving"
}

const MIN_ITEM_COST = Math.min(...HERO_IDS.flatMap((heroId) => HERO_TABLE[heroId].build.map((buildItemId) => ItemTable[buildItemId].cost))),
  getItemSellValue = (itemId) => Math.floor(ItemTable[itemId].cost * BaseAttackRange)

function getEquippedBoots(heroState) {
  for (const itemId of heroState.items) if (itemId && ItemTable[itemId].category === "boots") return itemId
  return null
}

function evaluatePurchase(heroState, itemId) {
  const itemConfig = ItemTable[itemId]
  let replacedBootsId = null
  if (itemConfig.category === "boots") {
    const EquippedBootsValue = getEquippedBoots(heroState)
    if (EquippedBootsValue) {
      if (EquippedBootsValue === itemId) return { ok: !1, block: "boots_same", cost: itemConfig.cost, replaces: null }
      if (itemConfig.tier === 1) return { ok: !1, block: "boots_owned", cost: itemConfig.cost, replaces: null }
      replacedBootsId = EquippedBootsValue
    }
  }
  const EffectiveItemCostValue = getEffectiveItemCost(heroState, itemId)
  return canBuyItem(heroState, itemId) ? (heroState.gold < EffectiveItemCostValue ? { ok: !1, block: "gold", cost: EffectiveItemCostValue, replaces: replacedBootsId } : { ok: !0, block: "ok", cost: EffectiveItemCostValue, replaces: replacedBootsId }) : { ok: !1, block: "full", cost: EffectiveItemCostValue, replaces: replacedBootsId }
}

const BLOCK_REASON_LABELS = { gold: "金币不足", full: "装备栏已满", boots_owned: "已有鞋子", boots_same: "已拥有" }

function getNextRecommendedItem(heroState) {
  return getNextBuildItem(heroState)
}

function getAutoBuyProgress(heroState) {
  const NextBuildItemResult = getNextBuildItem(heroState)
  if (!NextBuildItemResult || !canBuyItem(heroState, NextBuildItemResult)) return -1
  const getEffectiveItemCostEffectiveItemCostValue = getEffectiveItemCost(heroState, NextBuildItemResult)
  return getEffectiveItemCostEffectiveItemCostValue <= 0 ? 1 : Math.max(0, Math.min(1, heroState.gold / getEffectiveItemCostEffectiveItemCostValue))
}

/**
 * 创建界面。
 *
 * @param world - 战场
 */
function createShopPanel(world) {
  injectStyleSheet("sf-hud-shop", HUD_SHOP_CSS_COMPACT)
  const { host: worldHost } = world,
    getItemConfig = (itemId) => ItemTable[itemId]
  let shopOpen = !1,
    lookupKey = "recommend",
    currentSelection = null,
    selectedBuyId = null,
    cardConfigs = [],
    textValue = "",
    quickBuyItemId = null
  const element = createEl("button", "sf-hud__shopbtn", createIconEl(iconFor("shop")), createEl("span", "sf-hud__key", "P"))
  ;((element.type = "button"), (element.tabIndex = -1), (element.dataset.sfSnd = "click"), element.setAttribute("aria-label", "商店"), element.addEventListener("click", () => world.actions.toggleShop()))
  const bindClassToggleResult = bindClassToggle(element, "is-open"),
    toggleReadyClass = bindClassToggle(element, "is-ready"),
    toggleSavingClass = bindClassToggle(element, "is-saving"),
    CssVarWriterValue = createCssVarWriter(element, "--p", 0.01),
    makePanelElement = makePanel(null),
    createElElement = createEl("span", "sf-hud__quick-name"),
    quickPriceElement = createEl("span", "sf-num"),
    quickBuyButton = createEl("button", "sf-hud__quick", makePanelElement, createEl("span", "sf-hud__quick-text", createEl("span", "sf-hud__quick-tag", "推荐 · 可购买"), createEl("span", "sf-hud__quick-price", createIconEl(iconFor("gold")), createElElement, quickPriceElement)))
  ;((quickBuyButton.type = "button"),
    (quickBuyButton.tabIndex = -1),
    quickBuyButton.addEventListener("click", () => {
      quickBuyItemId && world.actions.buy(quickBuyItemId)
    }))
  const toggleQuickActive = bindClassToggle(quickBuyButton, "is-on"),
    toastItemPanel = makePanel(null),
    ElValue = createEl("span", "sf-hud__autobuy-ico", createIconEl(iconFor("info"))),
    toastTagElement = createEl("span", "sf-hud__autobuy-tag"),
    toastTextElement = createEl("span", "sf-hud__autobuy-name"),
    autoBuyToast = createEl("div", "sf-hud__autobuy", toastItemPanel, ElValue, createEl("span", "sf-hud__autobuy-text", toastTagElement, toastTextElement))
  ;(autoBuyToast.setAttribute("role", "status"), autoBuyToast.setAttribute("aria-live", "polite"))
  const toastQueue = []
  let activeToast = null,
    toastStartAt = 0,
    toastFadeAt = 0
  function C(deaths, startTime) {
    ;((activeToast = deaths),
      (toastStartAt = startTime),
      (toastFadeAt = 0),
      (toastItemPanel.hidden = deaths.itemId === null),
      (ElValue.hidden = deaths.itemId !== null),
      deaths.itemId && ((toastItemPanel.innerHTML = itemIconFor(deaths.itemId)), toastItemPanel.classList.remove("sf-slot--empty")),
      (toastTagElement.textContent = deaths.tag),
      (toastTextElement.textContent = deaths.text),
      (toastTextElement.hidden = deaths.text === ""),
      autoBuyToast.classList.toggle("is-warn", deaths.warn),
      autoBuyToast.classList.remove("is-out"),
      toggleClassOn(autoBuyToast, "is-on"),
      R(),
      F())
  }
  function R() {
    if (!shopOpen) {
      autoBuyToast.parentElement !== shopBar && shopBar.appendChild(autoBuyToast)
      return
    }
    autoBuyToast.parentElement !== toastDock && toastDock.appendChild(autoBuyToast)
    const panelOffsetTop = shopDialog.offsetTop,
      toastHeight = autoBuyToast.offsetHeight || 46
    ;((toastDock.style.top = `${Math.max(0, Math.round(panelOffsetTop - toastHeight - 8))}px`), toastDock.classList.toggle("is-off", panelOffsetTop < toastHeight + 12))
  }
  function I(toastEntry) {
    for (toastQueue.push(toastEntry); toastQueue.length > 3;) toastQueue.shift()
  }
  function P(indicator) {
    if (!activeToast) {
      const shiftResult = toastQueue.shift()
      shiftResult && C(shiftResult, indicator)
      return
    }
    if (toastFadeAt > 0) {
      indicator >= toastFadeAt && ((toastFadeAt = 0), (activeToast = null), autoBuyToast.classList.remove("is-on", "is-out"), F())
      return
    }
    const elapsedTime = indicator - toastStartAt,
      nextToast = toastQueue.length > 0 && elapsedTime >= KILLFEED_INTERVAL_SECONDS ? toastQueue.shift() : void 0
    nextToast ? C(nextToast, indicator) : elapsedTime >= TOAST_HOLD_SECONDS && (autoBuyToast.classList.add("is-out"), (toastFadeAt = indicator + TOAST_FADE_SECONDS))
  }
  function F() {
    toggleQuickActive(quickBuyItemId !== null && activeToast === null)
  }
  const shopBar = createEl("div", "sf-hud__shopbar", element, quickBuyButton, autoBuyToast),
    toastDock = createEl("div", "sf-hud__shop-dock"),
    TabsValue = createTabs({
      tabs: ITEM_CATEGORY_ORDER.map((categoryKey) => ({ id: categoryKey, label: EQUIP_SLOT_NAMES[categoryKey] })),
      value: lookupKey,
      onChange: (selectedTab) => {
        ;((lookupKey = selectedTab), (currentSelection = null), ft())
      },
    }),
    ToggleValue = createToggle({
      value: world.me.autoBuy === !0,
      label: "自动出装",
      onChange: (autoBuyEnabled) => {
        world.state.over || (worldHost.command({ type: "autoBuy", enabled: autoBuyEnabled }), worldHost.updateSettings({ autoBuy: autoBuyEnabled }), Ue())
      },
    }),
    createElElValue = createEl("span", "sf-hud__shop-auto-hint"),
    TextWriterValue = createTextWriter(createElElValue),
    ElResult = createEl("div", "sf-hud__shop-auto", createEl("span", "sf-hud__shop-auto-row", "自动出装", ToggleValue.el), createElElValue)
  ;((ElResult.dataset.sfSnd = "click"), ElResult.addEventListener("click", () => ToggleValue.flip()))
  const toggleAutoRowOn = bindClassToggle(ElResult, "is-on"),
    toggleAutoRowWarn = bindClassToggle(ElResult, "is-warn")
  let autoBuyNotice = null,
    soldRecommendedGear = !1,
    sellTurnedOff = !1
  const goldTextElement = createEl("b", "sf-num", "0"),
    FormattedTextWriterValue = createFormattedTextWriter(goldTextElement),
    IconButtonValue = makeIconButton({ icon: iconFor("close"), label: "关闭商店", quiet: !0, sound: "back", onClick: () => world.actions.setShop(!1) }),
    shopHeader = createEl("header", "sf-hud__shop-head", createEl("h2", "sf-hud__shop-title sf-metal", "商店"), TabsValue.el, ElResult, createEl("span", "sf-hud__chip sf-hud__shop-gold", createIconEl(iconFor("gold")), goldTextElement), IconButtonValue),
    boughtCountElement = createEl("b", "sf-num"),
    stepDotsElement = createEl("span", "sf-hud__shop-steps"),
    baseOwnedHint = createEl("small"),
    buildProgressPanel = createEl("div", "sf-hud__shop-prog", createEl("span", "sf-hud__shop-prog-who", createEl("b", null, z0(world.me.heroId)), " 的推荐出装"), createEl("span", "sf-hud__shop-prog-n", "已买 ", boughtCountElement, baseOwnedHint), stepDotsElement),
    cardGrid = createEl("div", "sf-hud__shop-grid"),
    shopList = createEl("div", "sf-hud__shop-list sf-scroll", buildProgressPanel, cardGrid),
    detailPanel = createEl("aside", "sf-hud__shop-detail"),
    inventorySlots = [],
    inventoryGrid = createEl("div", "sf-hud__shop-slots")
  for (let index = 0; index < world.me.items.length; index++) {
    const PanelValue = makePanel(null, { button: !0 })
    ;((PanelValue.dataset.sfSnd = "select"),
      PanelValue.addEventListener("click", () => {
        world.me.items[index] && ((currentSelection = { kind: "inv", index: index }), Ue())
      }),
      inventorySlots.push(PanelValue),
      inventoryGrid.appendChild(PanelValue))
  }
  const inventoryFooter = createEl("footer", "sf-hud__shop-inv", createEl("h3", "sf-heading", "我的装备"), inventoryGrid, createEl("span", "sf-hud__shop-hint", `点选装备可出售，返还 ${Math.round(BaseAttackRange * 100)}%`)),
    shopDialog = createEl("div", "sf-hud__shop-panel sf-panel", shopHeader, createEl("div", "sf-hud__shop-body", shopList, detailPanel), inventoryFooter)
  ;(shopDialog.setAttribute("role", "dialog"), shopDialog.setAttribute("aria-label", "商店"))
  const shopRoot = createEl("div", "sf-hud__shop", shopDialog, toastDock)
  shopRoot.addEventListener("pointerdown", (pointerEvent) => {
    pointerEvent.target === shopRoot && world.actions.setShop(!1)
  })
  function lt(buildStep, heroState) {
    return buildStep.buyId ? buildStep.buyId : ItemTable[buildStep.finalId].category === "boots" ? (getEquippedBoots(heroState) ?? buildStep.finalId) : buildStep.finalId
  }
  let lastClickedCard = null,
    lastClickAt = 0
  function gt(itemOrder, itemId, isBootsItem) {
    const eResult = getItemConfig(itemId),
      makePanelPanelValue = makePanel(itemIconFor(itemId)),
      element = createEl("span", "sf-hud__card-name", eResult.name),
      cardBriefElement = createEl("span", "sf-hud__card-brief", itemBrief(eResult)),
      cardPriceElement = createEl("b", "sf-num"),
      cardTagElement = createEl("span", "sf-hud__card-tag"),
      upgradeDots = isBootsItem ? [createEl("i"), createEl("i")] : null,
      cardButton = createEl(
        "button",
        "sf-hud__card",
        createEl("span", "sf-hud__card-top", itemOrder > 0 ? createEl("span", "sf-hud__card-no sf-num", String(itemOrder)) : null, makePanelPanelValue, upgradeDots ? createEl("span", "sf-hud__card-dots", ...upgradeDots) : null),
        element,
        cardBriefElement,
        createEl("span", "sf-hud__card-price", createIconEl(iconFor("gold")), cardPriceElement),
        cardTagElement,
      )
    ;((cardButton.type = "button"), (cardButton.dataset.sfSnd = "select"), (cardButton.dataset.item = itemId))
    const elConfig = { el: cardButton, order: itemOrder, id: itemId, slot: makePanelPanelValue, name: element, brief: cardBriefElement, price: cardPriceElement, tag: cardTagElement, dots: upgradeDots, autoUntil: 0 }
    return (
      cardButton.addEventListener("click", () => {
        const clickTime = performance.now(),
          isDoubleClick = lastClickedCard === elConfig && clickTime - lastClickAt < HUD_COMPACT_BREAKPOINT_PX
        if (((lastClickedCard = elConfig), (lastClickAt = isDoubleClick ? 0 : clickTime), isDoubleClick)) {
          const buyTargetId = elConfig.order > 0 ? (getBuildSteps(world.me)[elConfig.order - 1]?.buyId ?? null) : elConfig.id
          buyTargetId && world.actions.buy(buyTargetId)
          return
        }
        ;((currentSelection = elConfig.order > 0 ? { kind: "card", order: elConfig.order } : { kind: "shop", id: elConfig.id }), Ue())
      }),
      cardGrid.appendChild(cardButton),
      elConfig
    )
  }
  function ft() {
    const selfPlayer = world.me
    if (((cardGrid.textContent = ""), (cardConfigs = []), (lastClickedCard = null), lookupKey === "recommend")) for (const getBuildStepsTt of getBuildSteps(selfPlayer)) cardConfigs.push(gt(getBuildStepsTt.order, lt(getBuildStepsTt, selfPlayer), ItemTable[getBuildStepsTt.finalId].category === "boots"))
    else {
      const sortResult = ItemList.filter((itemEntry) => itemEntry.category === lookupKey).sort((firstItem, secondItem) => firstItem.cost - secondItem.cost)
      for (const sortedItem of sortResult) cardConfigs.push(gt(0, sortedItem.id, !1))
    }
    ;((!currentSelection || currentSelection.kind !== "inv") && (currentSelection = _t(selfPlayer)), (shopList.scrollTop = 0), Ue())
  }
  function _t(heroState) {
    if (lookupKey === "recommend") {
      const BuildStepsValue = getBuildSteps(heroState),
        defaultStep = BuildStepsValue.find((candidateStep) => candidateStep.next) ?? BuildStepsValue.find((pendingStep) => pendingStep.stage !== "done") ?? BuildStepsValue[0]
      return defaultStep ? { kind: "card", order: defaultStep.order } : null
    }
    return cardConfigs[0] ? { kind: "shop", id: cardConfigs[0].id } : null
  }
  function Dt(heroState, buildSteps) {
    if (!currentSelection) return null
    if (currentSelection.kind === "inv") {
      const selectedItems = heroState.items[currentSelection.index]
      return selectedItems ? { id: selectedItems, kind: "inv", title: "我的装备", star: !1, invIndex: currentSelection.index } : null
    }
    if (currentSelection.kind === "card") {
      const selectedZt = buildSteps?.[currentSelection.order - 1]
      if (!selectedZt) return null
      if (!selectedZt.buyId) return { id: lt(selectedZt, heroState), kind: "own", title: "已买", star: !1, invIndex: -1 }
      const stepTitle = selectedZt.stage === "base" && selectedZt.baseId ? `已有${itemShortName(selectedZt.baseId)} · 稍后升级` : `第 ${selectedZt.order} 件`
      return { id: selectedZt.buyId, kind: "buy", title: selectedZt.next ? (selectedZt.stage === "base" ? "下一件 · 升级" : "下一件") : stepTitle, star: selectedZt.next, invIndex: -1 }
    }
    const isNextRecommended = getNextRecommendedItem(heroState) === currentSelection.id
    return { id: currentSelection.id, kind: "buy", title: isNextRecommended ? "下一件" : ITEM_CATEGORY_LABELS[getItemConfig(currentSelection.id).category], star: isNextRecommended, invIndex: -1 }
  }
  let detailItem = null,
    detailNoteElement = null,
    savingBarElement = null,
    savingTextElement = null,
    detailPriceElement = null,
    detailActionButton = null,
    actionLabelElement = null
  function qt(detailItem) {
    if (((detailPanel.textContent = ""), (detailNoteElement = savingBarElement = savingTextElement = detailPriceElement = detailActionButton = actionLabelElement = null), (detailItem = detailItem), !detailItem)) {
      detailPanel.appendChild(createEl("div", "sf-hud__dt-empty", "选择一件装备查看详情"))
      return
    }
    const eEResult = getItemConfig(detailItem.id),
      itemId = detailItem.id,
      element = createEl("div", `sf-hud__dt-title${detailItem.star ? " is-next" : ""}`, detailItem.star ? createIconEl(iconFor("star")) : detailItem.kind === "own" ? createIconEl(iconFor("check")) : null, detailItem.title),
      itemMetaElement = createEl(
        "div",
        "sf-hud__dt-meta",
        createEl("span", "sf-badge sf-badge--mute", EQUIP_SLOT_NAMES[eEResult.category]),
        eEResult.category === "boots" ? createEl("span", `sf-badge${eEResult.tier === 2 ? "" : " sf-badge--mute"}`, BOOT_TIER_LABELS[eEResult.tier]) : null,
      ),
      priceNumberElement = createEl("b", "sf-num")
    detailPriceElement = priceNumberElement
    const detailHeader = createEl(
        "div",
        "sf-hud__dt-head",
        makePanel(itemIconFor(itemId)),
        createEl("div", "sf-hud__dt-headtext", createEl("div", "sf-hud__dt-name", eEResult.name), itemMetaElement),
        detailItem.kind === "buy" ? createEl("span", "sf-hud__dt-price", createIconEl(iconFor("gold")), priceNumberElement) : null,
      ),
      statsContainer = createEl("div", "sf-hud__dt-stats")
    for (const statEntry of extractStatLabels(eEResult.stats)) statsContainer.appendChild(createEl("span", "sf-hud__dt-stat", createEl("span", null, statEntry.label), createEl("b", "sf-num", statEntry.value)))
    const detailBody = createEl("div", "sf-hud__dt-body sf-scroll", eEResult.brief ? createEl("div", "sf-hud__dt-brief", eEResult.brief) : null, statsContainer)
    if (
      (eEResult.passive ? detailBody.appendChild(createEl("div", "sf-hud__dt-passive", createEl("b", null, `被动 · ${eEResult.passive.name}`), eEResult.passive.desc)) : detailBody.appendChild(createEl("div", "sf-hud__dt-nopassive", "(无被动)")),
      (detailNoteElement = createEl("div", "sf-hud__dt-note")),
      detailPanel.append(element, detailHeader, detailBody, detailNoteElement),
      detailItem.kind === "own")
    ) {
      detailPanel.appendChild(createEl("div", "sf-hud__dt-owned", createIconEl(iconFor("check")), "已经在装备栏里了"))
      return
    }
    if (detailItem.kind === "inv") {
      const inventoryIndex = detailItem.invIndex
      detailActionButton = makePanelBody({
        label: "出售",
        icon: iconFor("gold"),
        variant: "danger",
        block: !0,
        sound: "none",
        onClick: () => {
          const autoBuyWasOn = world.me.autoBuy === !0
          ;(world.actions.sell(inventoryIndex), autoBuyWasOn && world.me.autoBuy !== !0 && (sellTurnedOff = !0))
        },
      })
    } else
      ((savingTextElement = createEl("span", "sf-hud__dt-save-text sf-num")),
        (savingBarElement = createEl("div", "sf-hud__dt-save", "金币", createEl("span", "sf-hud__dt-save-bar", createEl("i")), savingTextElement)),
        detailPanel.appendChild(savingBarElement),
        (detailActionButton = makePanelBody({ label: "购买", icon: iconFor("gold"), variant: "primary", block: !0, sound: "none", onClick: () => world.actions.buy(itemId) })),
        (detailActionButton.style.pointerEvents = "auto"),
        detailActionButton.appendChild(createEl("span", "sf-hud__key", "回车")))
    ;((actionLabelElement = detailActionButton.querySelector(".sf-btn__label")), detailPanel.appendChild(detailActionButton))
  }
  function te(heroState) {
    const detailItemLocal = detailItem
    if (!detailItemLocal || !detailNoteElement) return
    const element = detailNoteElement
    if (((element.textContent = ""), (element.className = "sf-hud__dt-note"), detailItemLocal.kind === "own" || !detailActionButton || !actionLabelElement)) return
    if (detailItemLocal.kind === "inv") {
      const ItemSellValueValue = getItemSellValue(detailItemLocal.id)
      ;(heroState.autoBuy && isRecommendedItem(heroState.heroId, detailItemLocal.id)
        ? (element.classList.add("is-warn"), element.append("这是推荐装备：卖掉后本局自动出装会关闭"))
        : element.append("出售后返还 ", createEl("b", "sf-num sf-gold", String(ItemSellValueValue)), " 金币"),
        (actionLabelElement.textContent = `出售 +${ItemSellValueValue}`))
      return
    }
    const itemConfig = getItemConfig(detailItemLocal.id),
      evaluatePurchaseResult = evaluatePurchase(heroState, detailItemLocal.id),
      currentGold = Math.floor(heroState.gold),
      goldShortfall = Math.max(1, Math.ceil(evaluatePurchaseResult.cost - heroState.gold))
    if (
      (evaluatePurchaseResult.replaces
        ? (element.classList.add("is-good"), element.append(`替换${ItemTable[evaluatePurchaseResult.replaces].name}，已抵 `, createEl("b", "sf-num", String(itemConfig.cost - evaluatePurchaseResult.cost))))
        : evaluatePurchaseResult.block === "full"
          ? (element.classList.add("is-warn"), element.append("装备栏已满，先卖掉一件再买"))
          : evaluatePurchaseResult.block === "boots_owned"
            ? (element.classList.add("is-warn"), element.append("已经有鞋了，可以直接买进阶鞋替换"))
            : evaluatePurchaseResult.block === "boots_same" && (element.classList.add("is-warn"), element.append("已经穿着这双鞋了")),
      detailPriceElement && (detailPriceElement.textContent = String(evaluatePurchaseResult.cost)),
      savingBarElement && savingTextElement)
    ) {
      const showSavingBar = evaluatePurchaseResult.block === "ok" || evaluatePurchaseResult.block === "gold"
      ;((savingBarElement.hidden = !showSavingBar),
        showSavingBar &&
          (savingBarElement.style.setProperty("--p", MINIMAP_STYLE(evaluatePurchaseResult.cost > 0 ? heroState.gold / evaluatePurchaseResult.cost : 1).toFixed(3)),
          savingBarElement.classList.toggle("is-full", evaluatePurchaseResult.ok),
          (savingTextElement.textContent = ""),
          evaluatePurchaseResult.ok ? savingTextElement.append(`✓ ${currentGold}/${evaluatePurchaseResult.cost}`) : savingTextElement.append("还差 ", createEl("b", null, String(goldShortfall)))))
    }
    const waitingAutoBuy = evaluatePurchaseResult.block === "gold" && heroState.autoBuy === !0 && getNextRecommendedItem(heroState) === detailItemLocal.id
    ;((actionLabelElement.textContent = waitingAutoBuy ? `还差 ${goldShortfall} · 攒够自动买` : `购买 ${evaluatePurchaseResult.cost}`), detailActionButton.classList.toggle("is-wait", waitingAutoBuy), detailActionButton.classList.toggle("is-disabled", !evaluatePurchaseResult.ok))
  }
  let textResult = "",
    lastInventoryKey = "",
    refreshAt = 0
  function Me(heroState) {
    const lookupKey = heroState.autoBuy === !0
    ;(ToggleValue.get() !== lookupKey && ToggleValue.set(lookupKey), toggleAutoRowOn(lookupKey), autoBuyNotice && world.now >= autoBuyNotice.until && (autoBuyNotice = null))
    let autoBuyNoticeText,
      isWarning = !1
    if (autoBuyNotice) ((autoBuyNoticeText = autoBuyNotice.text), (isWarning = autoBuyNotice.warn))
    else if (!lookupKey) ((autoBuyNoticeText = soldRecommendedGear ? "卖了推荐装，本局已关闭" : "已关闭，自己点购买"), (isWarning = soldRecommendedGear))
    else {
      const AutoBuyStatusValue = getAutoBuyStatus(heroState)
      AutoBuyStatusValue === "paused" ? ((autoBuyNoticeText = "装备栏已满，已暂停"), (isWarning = !0)) : AutoBuyStatusValue === "done" ? (autoBuyNoticeText = "推荐出装已买齐") : (autoBuyNoticeText = "钱够自动买下一件")
    }
    ;(TextWriterValue(autoBuyNoticeText), toggleAutoRowWarn(isWarning))
  }
  function Ue() {
    const meValue = world.me,
      currentTime = world.now,
      joinResult = meValue.items.join(",")
    ;(FormattedTextWriterValue(Math.floor(meValue.gold)), Me(meValue))
    const buildSteps = lookupKey === "recommend" ? getBuildSteps(meValue) : null
    if (buildSteps && currentSelection?.kind === "card" && joinResult !== lastInventoryKey) {
      const lookupKey = buildSteps[currentSelection.order - 1],
        nextStep = buildSteps.find((buildStep) => buildStep.next)
      lookupKey && nextStep && lookupKey.buyId !== selectedBuyId && (currentSelection = { kind: "card", order: nextStep.order })
    }
    ;((lastInventoryKey = joinResult), currentSelection?.kind === "inv" && !meValue.items[currentSelection.index] && (currentSelection = _t(meValue)))
    const itemCountMap = new Map()
    for (const itemId of meValue.items) itemId && itemCountMap.set(itemId, (itemCountMap.get(itemId) ?? 0) + 1)
    let earliestAutoUntil = 0
    for (const cardConfig of cardConfigs) {
      const cardBuildStep = buildSteps ? buildSteps[cardConfig.order - 1] : null
      let element = cardConfig.id
      if (cardBuildStep) {
        element = cardBuildStep.buyId
        const ltResult = lt(cardBuildStep, meValue)
        if (ltResult !== cardConfig.id) {
          cardConfig.id = ltResult
          const itemConfig = getItemConfig(ltResult)
          ;((cardConfig.slot.innerHTML = itemIconFor(ltResult)), (cardConfig.name.textContent = itemConfig.name), (cardConfig.brief.textContent = itemBrief(itemConfig)), (cardConfig.el.dataset.item = ltResult))
        }
        cardConfig.dots && (cardConfig.dots[0].classList.toggle("is-on", cardBuildStep.stage !== "todo"), cardConfig.dots[1].classList.toggle("is-on", cardBuildStep.stage === "done"))
      }
      const purchaseCheck = element ? evaluatePurchase(meValue, element) : null,
        stepDone = !!cardBuildStep && cardBuildStep.stage === "done",
        purchaseBlocked = !!purchaseCheck && (purchaseCheck.block === "full" || purchaseCheck.block === "boots_owned" || purchaseCheck.block === "boots_same"),
        cardSelected = currentSelection?.kind === "card" ? currentSelection.order === cardConfig.order && cardConfig.order > 0 : currentSelection?.kind === "shop" && cardConfig.order === 0 && currentSelection.id === cardConfig.id,
        cardClassList = cardConfig.el.classList
      cardClassList.toggle("is-afford", !!purchaseCheck && purchaseCheck.ok)
      const baseItemPending = !!cardBuildStep && cardBuildStep.stage === "base" && !cardBuildStep.next
      ;(cardClassList.toggle("is-poor", !!purchaseCheck && purchaseCheck.block === "gold" && !baseItemPending), cardClassList.toggle("is-blocked", purchaseBlocked), cardClassList.toggle("is-done", stepDone), cardClassList.toggle("is-next", !!cardBuildStep && cardBuildStep.next), cardClassList.toggle("is-sel", cardSelected))
      const priceText = purchaseCheck ? String(purchaseCheck.cost) : ""
      cardConfig.price.textContent !== priceText && (cardConfig.price.textContent = priceText)
      let tagText = "",
        tagClass = "",
        tagExtraText = ""
      const ownedCount = itemCountMap.get(cardConfig.id) ?? 0
      ;(cardConfig.autoUntil > 0 && (currentTime >= cardConfig.autoUntil || !stepDone) && (cardConfig.autoUntil = 0),
        cardConfig.autoUntil > 0
          ? (([tagText, tagClass] = ["已自动购买", "is-auto"]), (earliestAutoUntil = earliestAutoUntil > 0 ? Math.min(earliestAutoUntil, cardConfig.autoUntil) : cardConfig.autoUntil))
          : cardBuildStep
            ? stepDone
              ? ([tagText, tagClass] = ["✓ 已买", "is-done"])
              : cardBuildStep.next
                ? ([tagText, tagClass, tagExtraText] = ["下一件", "is-next", cardBuildStep.stage === "base" ? " · 升级" : ""])
                : cardBuildStep.stage === "base" && cardBuildStep.baseId
                  ? ([tagText, tagClass, tagExtraText] = [`已有${itemShortName(cardBuildStep.baseId)}`, "is-have", " · 稍后升级"])
                  : purchaseBlocked
                    ? ([tagText, tagClass] = ["栏位已满", "is-step"])
                    : ([tagText, tagClass] = [`第 ${cardBuildStep.order} 件`, "is-step"])
            : ownedCount > 0
              ? ([tagText, tagClass] = [ownedCount > 1 ? `已有 ×${ownedCount}` : "已有", "is-own"])
              : purchaseBlocked && purchaseCheck && ([tagText, tagClass] = [BLOCK_REASON_LABELS[purchaseCheck.block], "is-step"]),
        cardConfig.tag.textContent !== tagText + tagExtraText && ((cardConfig.tag.textContent = tagText), tagExtraText && cardConfig.tag.appendChild(createEl("span", "sf-hud__card-tag-more", tagExtraText))))
      const tagClassName = `sf-hud__card-tag ${tagClass}`
      cardConfig.tag.className !== tagClassName && (cardConfig.tag.className = tagClassName)
    }
    refreshAt = earliestAutoUntil
    const progressKey = buildSteps ? joinResult : "-"
    if (progressKey !== textResult && ((textResult = progressKey), (buildProgressPanel.hidden = !buildSteps), buildSteps)) {
      boughtCountElement.textContent = `${buildSteps.filter((buildStep) => buildStep.stage === "done").length}/${buildSteps.length}`
      const findLookupKey = buildSteps.find((buildStep) => buildStep.stage === "base" && buildStep.baseId)
      ;((baseOwnedHint.textContent = findLookupKey?.baseId ? `(${itemShortName(findLookupKey.baseId)}已有)` : ""), (stepDotsElement.textContent = ""))
      for (const progressStep of buildSteps) stepDotsElement.appendChild(createEl("i", progressStep.stage === "done" ? "is-done" : progressStep.next ? "is-next" : progressStep.stage === "base" ? "is-half" : ""))
    }
    for (let RtIndex = 0; RtIndex < inventorySlots.length; RtIndex++) {
      const slotItemId = meValue.items[RtIndex],
        slotPanel = inventorySlots[RtIndex]
      ;(slotPanel.dataset.item !== (slotItemId ?? "") &&
        ((slotPanel.dataset.item = slotItemId ?? ""), (slotPanel.innerHTML = slotItemId ? itemIconFor(slotItemId) : ""), slotPanel.classList.toggle("sf-slot--empty", !slotItemId), slotPanel.setAttribute("aria-label", slotItemId ? `${ItemTable[slotItemId].name}（点选可出售）` : "空装备栏")),
        slotPanel.classList.toggle("is-active", currentSelection?.kind === "inv" && currentSelection.index === RtIndex))
    }
    selectedBuyId = currentSelection?.kind === "card" ? (buildSteps?.[currentSelection.order - 1]?.buyId ?? null) : null
    const dtResult = Dt(meValue, buildSteps),
      detailKey = dtResult ? `${dtResult.kind}|${dtResult.id}|${dtResult.title}|${dtResult.invIndex}` : ""
    ;(detailKey !== textValue && ((textValue = detailKey), qt(dtResult)), te(meValue))
  }
  let previousAutoBuy = null,
    pausedNoticeShown = !1,
    completeNoticeShown = !1
  function Ma(heroState) {
    const autoBuyOn = heroState.autoBuy === !0
    if (previousAutoBuy === null) return ((previousAutoBuy = autoBuyOn), (completeNoticeShown = getAutoBuyStatus(heroState) === "done"), !0)
    const wasOffBySell = sellTurnedOff
    return (
      (sellTurnedOff = !1),
      autoBuyOn === previousAutoBuy
        ? !1
        : ((previousAutoBuy = autoBuyOn),
          autoBuyOn
            ? ((soldRecommendedGear = !1), world.toast("自动出装：已开启", "good"))
            : wasOffBySell
              ? ((soldRecommendedGear = !0), I({ tag: "自动出装已关闭", text: "商店顶部可重新打开", itemId: null, warn: !0 }), (autoBuyNotice = null), shopOpen && toggleClassOn(ElResult, "is-flash"))
              : ((soldRecommendedGear = !1), world.toast("自动出装：已关闭", "info")),
          !0)
    )
  }
  function Wf(heroState) {
    const autoBuyOn = heroState.autoBuy === !0,
      autoBuyProgress = autoBuyOn ? getAutoBuyProgress(heroState) : -1
    ;(toggleSavingClass(autoBuyProgress >= 0), autoBuyProgress >= 0 && CssVarWriterValue(autoBuyProgress))
    const nextItemId = autoBuyOn ? null : getNextRecommendedItem(heroState),
      purchaseCheck = nextItemId ? evaluatePurchase(heroState, nextItemId) : null,
      quickBuyId = nextItemId && purchaseCheck && purchaseCheck.ok && !shopOpen ? nextItemId : null
    if (
      (quickBuyId !== quickBuyItemId && ((quickBuyItemId = quickBuyId), toggleReadyClass(!!quickBuyId), quickBuyId && ((makePanelElement.innerHTML = itemIconFor(quickBuyId)), makePanelElement.classList.remove("sf-slot--empty"), quickBuyButton.setAttribute("aria-label", `快捷购买 ${ItemTable[quickBuyId].name}`)), F()),
      quickBuyId && purchaseCheck && ((createElElement.textContent = ItemTable[quickBuyId].name), (quickPriceElement.textContent = String(purchaseCheck.cost))),
      autoBuyOn)
    ) {
      const getAutoBuyStatusAutoBuyStatusValue = getAutoBuyStatus(heroState)
      ;(getAutoBuyStatusAutoBuyStatusValue === "paused" && !pausedNoticeShown && ((pausedNoticeShown = !0), I({ tag: "自动出装暂停", text: "装备栏满了", itemId: null, warn: !0 })),
        getAutoBuyStatusAutoBuyStatusValue === "done" && !completeNoticeShown && ((completeNoticeShown = !0), I({ tag: "推荐出装已买齐", text: "", itemId: null, warn: !1 })))
    }
  }
  let lastGold = -1
  const inventorySnapshot = []
  function ou(heroState) {
    const currentGold = Math.floor(heroState.gold)
    let inventoryChanged = currentGold !== lastGold || inventorySnapshot.length !== heroState.items.length
    for (let index = 0; index < heroState.items.length && !inventoryChanged; index++) inventoryChanged = inventorySnapshot[index] !== heroState.items[index]
    if (inventoryChanged) {
      ;((lastGold = currentGold), (inventorySnapshot.length = heroState.items.length))
      for (let itemIndex = 0; itemIndex < heroState.items.length; itemIndex++) inventorySnapshot[itemIndex] = heroState.items[itemIndex]
    }
    return inventoryChanged
  }
  const onKeyDown = (keyEvent) => {
    !shopOpen ||
      (keyEvent.code !== "Enter" && keyEvent.code !== "NumpadEnter") ||
      !world.enabled ||
      world.paused ||
      hasOpenDialog() ||
      keyEvent.ctrlKey ||
      keyEvent.metaKey ||
      keyEvent.altKey ||
      (keyEvent.preventDefault(), !(keyEvent.repeat || !detailItem || detailItem.kind !== "buy") && world.actions.buy(detailItem.id))
  }
  return (
    window.addEventListener("keydown", onKeyDown),
    {
      els: [shopBar, shopRoot],
      isOpen: () => shopOpen,
      setOpen(targetObject) {
        targetObject !== shopOpen &&
          ((shopOpen = targetObject), shopRoot.classList.toggle("is-open", targetObject), bindClassToggleResult(targetObject), targetObject && ((lookupKey = "recommend"), TabsValue.set(lookupKey), (currentSelection = null), (textValue = ""), (textResult = ""), (autoBuyNotice = null), (lastInventoryKey = world.me.items.join(",")), ft()), R(), Wf(world.me))
      },
      update(worldState) {
        const playerState = worldState.me,
          maResult = Ma(playerState)
        ;(ou(playerState) || maResult ? (Wf(playerState), shopOpen && Ue()) : shopOpen && ((refreshAt > 0 && worldState.now >= refreshAt) || (autoBuyNotice !== null && worldState.now >= autoBuyNotice.until)) && Ue(), P(worldState.now))
      },
      /**
       * 处理事件。
       *
       * @param gameEvent - 主要输入
       * @param gameWorld - 战场
      */
      handleEvent(gameEvent, gameWorld) {
        if (gameEvent.type !== "itemBought" || gameEvent.unitId !== gameWorld.state.playerId) return
        const boughtItemConfig = ItemTable[gameEvent.itemId]
        if (gameEvent.auto) {
          const buyNoticeTag = boughtItemConfig.category === "boots" && boughtItemConfig.tier === 2 ? "已自动升级" : "已自动购买"
          ;(I({ tag: buyNoticeTag, text: boughtItemConfig.name, itemId: gameEvent.itemId, warn: !1 }), shopOpen && (autoBuyNotice = { text: `${buyNoticeTag} ${boughtItemConfig.name}`, warn: !1, until: gameWorld.now + TOAST_HOLD_SECONDS }))
        }
        if (shopOpen) {
          for (const item of cardConfigs) item.id === gameEvent.itemId && (toggleClassOn(item.el, "is-flash"), gameEvent.auto && (item.autoUntil = gameWorld.now + TOAST_HOLD_SECONDS))
          gameEvent.auto && toggleClassOn(ElResult, "is-flash")
        }
      },
      dispose() {
        window.removeEventListener("keydown", onKeyDown)
      },
    }
  )
}

export { getNextBuildItem, getItemSellValue, getEffectiveItemCost, evaluatePurchase, BLOCK_REASON_LABELS, isRecommendedItem, createShopPanel, MIN_ITEM_COST, canBuyItem }