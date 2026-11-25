/**
 * RH 界面控件
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { bindTooltip, laneLabels, hasOpenDialog, showModalDialog, isFocusVisibleButton, createEl, createIconEl, iconFor, injectStyleSheet, createLaneIcon, makeBadge, makeIconButton, makeIconByName, makePanel, makePanelBody, makeSegmentedControl, uToCalc } from './dom-kit'
import { mountMiniMapWidgets } from './minimap-widgets'
import { injectSkillTagStyles, escapeHtml, getItemTooltip, renderHeroNameTag } from './hud-panels'
import { ItemTable } from '../equipment'
import { ABILITY_KEYS, HERO_ID_LIST, ROLE_TINT_COLORS, __heroRow, ROLE_BRIEF_TEXTS, ABILITY_LABELS, heroNameForBanner, heroRoleTag, killFeedLine, streakBannerText } from './banner'
import { HERO_TABLE } from '../../heroes/registry'
import { HERO_SELECT_CSS, SKILL_KEY_BINDINGS, SKILL_SLOT_KEYS, SKILL_SLOT_LABELS, SUMMONER_SPELL_KEYS, formatRangeLabel } from './hero-select-styles'
import { skillTagHtml } from './status-strip'
import { ICON_FRAME_KINDS, describeSkillRange, describeSkillShape, renderIconFrame } from './icon-theme'
import { US, ea } from '../skills/skill-values'
import { skillTagLabel } from './skill-bar'
import { itemIconFor } from '../render/procedural-art'

function renderDifficultyStars(difficulty, starCount = 3) {
  const element = createEl("span", "sf-stars")
  element.setAttribute("aria-label", `难度 ${difficulty} / ${starCount}`)
  for (let index = 0; index < starCount; index++) element.appendChild(createIconEl(iconFor(index < difficulty ? "star" : "star_empty"), index < difficulty ? "is-on" : ""))
  return element
}

function isOverlayAvailable() {
  if (typeof window > "u") return "kbm"
  const hasTouchSupport = "ontouchstart" in window || (typeof navigator < "u" && navigator.maxTouchPoints > 0)
  let isActive = !1
  try {
    isActive = window.matchMedia("(pointer: coarse)").matches
  } catch {
    isActive = !1
  }
  return hasTouchSupport && isActive ? "touch" : "kbm"
}

/**
 * 处理界面。
 *
 * @param rootElement - 主要输入
 * @param builder - 构建器
 */
function openDialog(rootElement, builder) {
  const dialogConfig = { dialog: null },
    mountMiniMapWidgetsResult = mountMiniMapWidgets({
      ...builder,
      onResume: () => {
        ;(dialogConfig.dialog?.close(), builder.onResume?.())
      },
      onQuit: () => {
        ;(dialogConfig.dialog?.close(), builder.onQuit?.())
      },
    }),
    showModalDialogResult = showModalDialog(rootElement, {
      title: builder.title ?? (builder.mode === "match" ? "游戏暂停" : "设置"),
      content: mountMiniMapWidgetsResult.el,
      footer: mountMiniMapWidgetsResult.footer,
      width: uToCalc(780),
      cls: "sf-dialog--settings",
      onClose: () => {
        ;(mountMiniMapWidgetsResult.dispose(), builder.onClose?.())
      },
    })
  return ((dialogConfig.dialog = showModalDialogResult), showModalDialogResult)
}

/**
 * 处理技能。
 *
 * @param skillText - 主要输入
 */
function highlightSkillNumbers(skillText) {
  return escapeHtml(skillText).replace(/\(\+[^)]*\)|\d+(?:\.\d+)?%?(?:\/\d+(?:\.\d+)?%?)*/g, (matchedText) =>
    matchedText.startsWith("(") ? `<i data-k="${matchedText.includes("物攻") ? "ad" : matchedText.includes("法强") ? "ap" : "hp"}">${matchedText}</i>` : `<b>${matchedText.replace(/\//g, "/<wbr>")}</b>`,
  )
}

function getRecommendedBuild(hero) {
  const someResult = hero.build.some((itemId) => ItemTable[itemId].category === "boots" && ItemTable[itemId].tier === 2)
  return hero.build.filter((bootsKind) => !(someResult && bootsKind === "boots")).slice(0, 6)
}

/**
 * 绘制英雄。
 *
 * @param heroId - 主要输入
 */
function renderHeroRoster(heroId) {
  const heroAbilityRow = __heroRow(heroRoleTag, heroId) || { survive: 6, damage: 6, control: 6, mobility: 6, ease: 6 },
    glowColor = HERO_TABLE[heroId].palette.glow,
    radarCenterX = 88,
    radarCenterY = 82,
    radarRadius = 54,
    radarPoint = (detail, radiusScale) => {
      const angleRadians = (-90 + detail * 72) * (Math.PI / 180)
      return [Math.round((radarCenterX + Math.cos(angleRadians) * radarRadius * radiusScale) * 10) / 10, Math.round((radarCenterY + Math.sin(angleRadians) * radarRadius * radiusScale) * 10) / 10]
    },
    ringPoints = (missing) => ABILITY_KEYS.map((abilityKey, abilityIndex) => radarPoint(abilityIndex, missing).join(",")).join(" "),
    joinResult = ABILITY_KEYS.map((abilityKey, abilityIndex) => radarPoint(abilityIndex, Math.max(0.12, heroAbilityRow[abilityKey] / 10)).join(",")).join(" "),
    abilityAxisLabels = ABILITY_KEYS.map((abilityKey, abilityIndex) => {
      const [abilityLabelX, abilityLabelY] = radarPoint(abilityIndex, 1.25),
        startVariant = Math.abs(abilityLabelX - radarCenterX) < 6 ? "middle" : abilityLabelX > radarCenterX ? "start" : "end"
      return `<text x="${abilityLabelX + (startVariant === "start" ? -8 : startVariant === "end" ? 8 : 0)}" y="${abilityLabelY + 4.5}" text-anchor="${startVariant}">${ABILITY_LABELS[abilityKey]}</text>`
    }).join(""),
    abilityDots = ABILITY_KEYS.map((abilityKey, abilityIndex) => {
      const [dotX, dotY] = radarPoint(abilityIndex, Math.max(0.12, heroAbilityRow[abilityKey] / 10))
      return `<circle cx="${dotX}" cy="${dotY}" r="2.6" fill="#fff"/>`
    }).join("")
  return (
    `<svg viewBox="0 0 176 160" role="img" aria-label="能力雷达图"><polygon points="${ringPoints(1)}" fill="rgba(4,8,22,.55)" stroke="rgba(150,178,235,.4)" stroke-width="1"/><polygon points="${ringPoints(0.66)}" fill="none" stroke="rgba(150,178,235,.2)" stroke-width="1"/><polygon points="${ringPoints(0.33)}" fill="none" stroke="rgba(150,178,235,.2)" stroke-width="1"/>` +
    ABILITY_KEYS.map((abilityKey, abilityIndex) => `<line x1="${radarCenterX}" y1="${radarCenterY}" x2="${radarPoint(abilityIndex, 1)[0]}" y2="${radarPoint(abilityIndex, 1)[1]}" stroke="rgba(150,178,235,.2)" stroke-width="1"/>`).join("") +
    `<polygon points="${joinResult}" fill="${glowColor}" fill-opacity=".34" stroke="${glowColor}" stroke-width="2" stroke-linejoin="round"/>` +
    abilityDots +
    abilityAxisLabels +
    "</svg>"
  )
}

/**
 * 创建英雄。
 *
 * @param config - 构建器
 */
function createHeroSelect(config) {
  ;(injectStyleSheet("sf-menu-select", HERO_SELECT_CSS), injectSkillTagStyles())
  const { host: host } = config
  let selectedHeroId = config.initial.heroId,
    selectedDifficulty = config.initial.difficulty,
    textValue = "s1",
    heroPreview = null,
    isLocked = !1
  const disposers = [],
    element = createEl("div", "sf-screen sf-select"),
    ElValue = createEl(
      "header",
      "sf-select__top",
      makeIconButton({ icon: iconFor("back"), label: "返回标题", sound: "back", onClick: () => config.onBack() }),
      createEl("h2", "sf-title sf-metal", "选择英雄"),
      createEl("p", "sf-select__lead", "星陨高原的坠星之力，召来了不同时代的英杰。"),
      createEl(
        "div",
        "sf-select__top-right",
        createEl("span", "sf-select__hint", createEl("span", "sf-kbd", "←"), createEl("span", "sf-kbd", "→"), "切换英雄", createEl("span", "sf-kbd", "Enter"), "开始"),
        makeIconButton({ icon: iconFor("settings"), label: "设置", onClick: () => openDialog(config.root, { get: () => host.getSettings(), update: (settings) => host.updateSettings(settings), audio: host.audio, mode: "menu" }) }),
      ),
    ),
    createElElement = createEl("div", "sf-select__roster")
  ;(createElElement.setAttribute("role", "listbox"), createElElement.setAttribute("aria-label", "英雄列表"))
  const heroCards = new Map()
  HERO_ID_LIST.forEach((lookupKey, heroIndex) => {
    const selectedHERO_TABLE = HERO_TABLE[lookupKey],
      element = createEl("span", "sf-hcard__role", createIconEl(makeIconByName(selectedHERO_TABLE.role))),
      heroCardButton = createEl(
        "button",
        "sf-hcard",
        createEl("span", "sf-hcard__pic-wrap", heroNameForBanner(host, lookupKey, "sf-hcard__pic"), element),
        createEl(
          "span",
          "sf-hcard__info",
          createEl("span", "sf-hcard__name", renderHeroNameTag(lookupKey)),
          createEl("span", "sf-hcard__title", selectedHERO_TABLE.title),
          createEl("span", "sf-hcard__meta", createEl("span", null, createIconEl(createLaneIcon(selectedHERO_TABLE.lane)), laneLabels[selectedHERO_TABLE.lane]), createEl("span", null, "难度", renderDifficultyStars(selectedHERO_TABLE.difficulty))),
        ),
      )
    ;((heroCardButton.type = "button"),
      heroCardButton.setAttribute("role", "option"),
      (heroCardButton.dataset.hero = lookupKey),
      (heroCardButton.dataset.sfSnd = "select"),
      heroCardButton.style.setProperty("--hero", selectedHERO_TABLE.palette.glow),
      heroCardButton.style.setProperty("--role", ROLE_TINT_COLORS[selectedHERO_TABLE.role]),
      (heroCardButton.style.animationDelay = `${0.06 * heroIndex}s`),
      heroCardButton.addEventListener("click", () => M(lookupKey)),
      heroCards.set(lookupKey, heroCardButton),
      createElElement.appendChild(heroCardButton))
  })
  const createElElValue = createEl("canvas", "sf-select__canvas"),
    heroPlate = createEl("div", "sf-select__plate"),
    ElResult = createEl(
      "div",
      "sf-select__stage",
      createEl("div", "sf-select__glow"),
      createEl("div", "sf-select__rings", createEl("div", "sf-select__ring"), createEl("div", "sf-select__ring sf-select__ring--in")),
      createElElValue,
      heroPlate,
      createEl("div", "sf-select__nav sf-select__nav--prev", makeIconButton({ icon: iconFor("chevron_left"), label: "上一位英雄", sound: "select", onClick: () => k(-1) })),
      createEl("div", "sf-select__nav sf-select__nav--next", makeIconButton({ icon: iconFor("chevron_right"), label: "下一位英雄", sound: "select", onClick: () => k(1) })),
    ),
    difficultyDesc = createEl("p", "sf-select__diff-desc"),
    SegmentedControlValue = makeSegmentedControl({
      options: streakBannerText.map((difficultyLevel) => ({ value: difficultyLevel, label: killFeedLine[difficultyLevel].label })),
      value: selectedDifficulty,
      label: "对手难度",
      onChange: (chosenDifficulty) => {
        ;((selectedDifficulty = chosenDifficulty), (difficultyDesc.textContent = killFeedLine[chosenDifficulty].desc), config.onChange?.({ heroId: selectedHeroId, difficulty: selectedDifficulty }))
      },
    })
  difficultyDesc.textContent = killFeedLine[selectedDifficulty].desc
  const PanelBodyValue = makePanelBody({ label: "开始对战", variant: "primary", size: "lg", pulse: !0, sound: "ready", onClick: () => S() }),
    startSection = createEl("div", "sf-select__go", createEl("div", "sf-select__diff", createEl("div", "sf-select__diff-head", createEl("h3", "sf-heading", "对手难度"), SegmentedControlValue.el), difficultyDesc), PanelBodyValue),
    detailBody = createEl("div", "sf-select__detail-body sf-scroll"),
    detailPanel = createEl("aside", "sf-select__detail sf-panel", detailBody)
  element.append(ElValue, createEl("div", "sf-select__main", createElElement, ElResult, startSection, detailPanel))
  function k(step) {
    const currentHeroIndex = HERO_ID_LIST.indexOf(selectedHeroId)
    M(HERO_ID_LIST[(currentHeroIndex + step + HERO_ID_LIST.length) % HERO_ID_LIST.length])
  }
  function M(heroId) {
    if (heroId !== selectedHeroId) {
      ;((selectedHeroId = heroId), (textValue = "s1"), E(!0))
      try {
        heroPreview?.setHero(heroId)
      } catch {}
      config.onChange?.({ heroId: selectedHeroId, difficulty: selectedDifficulty })
    }
  }
  function S() {
    isLocked || ((isLocked = !0), (PanelBodyValue.disabled = !0), config.onConfirm({ heroId: selectedHeroId, difficulty: selectedDifficulty }))
  }
  function b(passiveKind) {
    try {
      heroPreview?.play(passiveKind === "passive" ? "attack" : passiveKind === "s1" ? "cast_s1" : passiveKind === "s2" ? "cast_s2" : "cast_ult")
    } catch {}
  }
  const isKeyboardMouseMode = isOverlayAvailable() === "kbm"
  function T(hero, skillSlot) {
    const element = createEl("div", "sf-skilldesc sf-inset"),
      skillDescHeader = createEl("div", "sf-skilldesc__head"),
      skillTags = createEl("div", "sf-skilldesc__tags"),
      skillDescText = createEl("p", "sf-skilldesc__text"),
      activeSkill = skillSlot === "passive" ? null : hero.skills[skillSlot],
      describedSkill = activeSkill ?? hero.passive
    if (
      (skillDescHeader.append(createEl("span", "sf-skilldesc__name", describedSkill.name)),
      activeSkill && skillSlot !== "passive" && isKeyboardMouseMode && skillDescHeader.append(createEl("span", "sf-kbd", SKILL_KEY_BINDINGS[skillSlot])),
      skillDescHeader.append(createEl("span", "sf-skilldesc__slot", SKILL_SLOT_LABELS[skillSlot])),
      (skillTags.innerHTML = skillTagHtml(skillSlot, describedSkill.tags)),
      activeSkill && skillTags.append(createEl("span", "sf-skilldesc__cast", describeSkillShape(activeSkill.cast))),
      element.append(skillDescHeader, skillTags),
      describedSkill.brief && element.append(createEl("p", "sf-skilldesc__brief", describedSkill.brief)),
      activeSkill)
    ) {
      const describeSkillRangeResult = describeSkillRange(activeSkill.cast)
      ;(element.append(createEl("div", "sf-skilldesc__meta", makeBadge(`冷却 ${formatRangeLabel(activeSkill.cooldown)} 秒`, "cyan", iconFor("clock")), makeBadge(`消耗 ${formatRangeLabel(activeSkill.manaCost)}`, "blue", iconFor("mana")), describeSkillRangeResult ? makeBadge(describeSkillRangeResult, "mute") : null)),
        (skillDescText.innerHTML = highlightSkillNumbers(US(activeSkill))))
    } else (element.append(createEl("div", "sf-skilldesc__meta")), (skillDescText.innerHTML = highlightSkillNumbers(hero.passive.desc)))
    return (element.append(skillDescText), element)
  }
  function E(animateSwap) {
    const selectedHero = HERO_TABLE[selectedHeroId]
    ;(element.style.setProperty("--hero", selectedHero.palette.glow),
      element.style.setProperty("--role", ROLE_TINT_COLORS[selectedHero.role]),
      heroCards.forEach((heroCard, cardHeroId) => {
        const isSelectedHero = cardHeroId === selectedHeroId
        ;(heroCard.classList.toggle("is-active", isSelectedHero), heroCard.setAttribute("aria-selected", String(isSelectedHero)))
      }),
      (heroPlate.textContent = ""),
      heroPlate.append(createEl("h3", "sf-select__name", createEl("span", "sf-metal", selectedHero.name), createEl("small", "sf-select__name-role", createIconEl(makeIconByName(selectedHero.role)), selectedHero.roleName)), createEl("span", "sf-select__sub", selectedHero.title)))
    for (const element of disposers.splice(0)) element()
    ;((detailBody.textContent = ""), (detailBody.scrollTop = 0))
    const heroTags = createEl(
        "div",
        "sf-select__tags",
        makeBadge(selectedHero.roleName, "gold", makeIconByName(selectedHero.role)),
        makeBadge(laneLabels[selectedHero.lane], "cyan", createLaneIcon(selectedHero.lane)),
        makeBadge(selectedHero.attackType === "melee" ? "近战" : "远程", "mute"),
        createEl("span", "sf-dim", "难度"),
        renderDifficultyStars(selectedHero.difficulty),
      ),
      roleBrief = createEl("p", "sf-select__rolebrief", createEl("b", null, `${selectedHero.roleName}：`), ROLE_BRIEF_TEXTS[selectedHero.role]),
      heroTips = createEl("p", "sf-select__tips sf-inset", createIconEl(iconFor("info")), createEl("span", null, selectedHero.tips)),
      radarChart = createEl("div", "sf-radar")
    radarChart.innerHTML = renderHeroRoster(selectedHeroId)
    const baseStats = selectedHero.base,
      statRows = [
        ["生命", String(baseStats.hp)],
        ["法力", String(baseStats.mana)],
        ["物攻", String(baseStats.ad)],
        ["攻速", baseStats.attackSpeed.toFixed(2)],
        ["护甲", String(baseStats.armor)],
        ["魔抗", String(baseStats.mr)],
        ["移速", baseStats.moveSpeed.toFixed(1)],
        ["射程", baseStats.attackRange.toFixed(1)],
      ],
      statList = createEl("dl", "sf-statlist", ...statRows.map(([statLabel, statValue]) => createEl("div", null, createEl("dt", null, statLabel), createEl("dd", "sf-num", statValue)))),
      skillsContainer = createEl("div", "sf-skills"),
      skillDetail = createEl("div"),
      slotButtons = new Map(),
      showSkillDetail = (selectedSkillSlot) => {
        ;((textValue = selectedSkillSlot), slotButtons.forEach((slotButton, mappedSlotKey) => slotButton.classList.toggle("is-active", mappedSlotKey === selectedSkillSlot)), (skillDetail.textContent = ""), skillDetail.appendChild(T(selectedHero, selectedSkillSlot)))
      }
    for (const skillSlot of SKILL_SLOT_KEYS) {
      const skillTagLabelElement = skillTagLabel(skillSlot, skillSlot === "passive" ? selectedHero.passive.tags : selectedHero.skills[skillSlot].tags),
        skillTag = createEl("span", "sf-skill__tag", skillTagLabelElement ? skillTagLabelElement.text : SKILL_SLOT_LABELS[skillSlot])
      skillTagLabelElement && (skillTag.style.color = skillTagLabelElement.color)
      const skillButton = createEl("button", "sf-skill", makePanel(ICON_FRAME_KINDS(selectedHeroId, skillSlot)), skillTag)
      ;((skillButton.type = "button"),
        (skillButton.dataset.slot = skillSlot),
        (skillButton.dataset.sfSnd = "click"),
        skillButton.setAttribute("aria-label", `${SKILL_SLOT_LABELS[skillSlot]}：${skillSlot === "passive" ? selectedHero.passive.name : selectedHero.skills[skillSlot].name}`),
        skillButton.addEventListener("click", () => {
          ;(showSkillDetail(skillSlot), b(skillSlot))
        }),
        slotButtons.set(skillSlot, skillButton),
        skillsContainer.appendChild(skillButton))
    }
    showSkillDetail(textValue)
    const summonerSpells = createEl("div", "sf-skills__sum")
    for (const spellKey of SUMMONER_SPELL_KEYS) {
      const spell = ea[spellKey],
        makePanelElement = makePanel(renderIconFrame(spellKey), { round: !0, label: spell.name })
      ;((makePanelElement.tabIndex = 0),
        disposers.push(
          bindTooltip(
            makePanelElement,
            () =>
              `<div class="sf-tip__title"><span>${spell.name}</span><span class="sf-tip__meta sf-num">通用技能 · 冷却 ${spell.cooldown} 秒</span></div><div style="font-weight:700;color:var(--sf-c-text)">${escapeHtml(spell.brief)}</div><div>${escapeHtml(spell.desc)}</div>`,
          ),
        ),
        summonerSpells.appendChild(makePanelElement))
    }
    skillsContainer.appendChild(summonerSpells)
    const RecommendedBuildValue = getRecommendedBuild(selectedHero),
      buildSection = createEl("div", "sf-build")
    let total = 0
    for (const itemId of RecommendedBuildValue) {
      const item = ItemTable[itemId]
      total += item.cost
      const itemPanel = makePanel(itemIconFor(itemId), { label: item.name })
      ;((itemPanel.tabIndex = 0), disposers.push(bindTooltip(itemPanel, () => getItemTooltip(item))), buildSection.appendChild(itemPanel))
    }
    if (
      (buildSection.appendChild(createEl("span", "sf-build__cost sf-num", createIconEl(iconFor("gold")), String(total))),
      detailBody.append(
        heroTags,
        roleBrief,
        heroTips,
        createEl("h4", "sf-heading", "技能"),
        skillsContainer,
        skillDetail,
        createEl("h4", "sf-heading", "能力"),
        createEl("div", "sf-select__abil", radarChart, statList),
        createEl("h4", "sf-heading", "推荐出装"),
        buildSection,
        createEl("h4", "sf-heading", "人物"),
        createEl("p", "sf-select__lore", selectedHero.lore),
      ),
      animateSwap)
    )
      for (const animatedPanel of [heroPlate, detailBody]) (animatedPanel.classList.remove("is-swap"), animatedPanel.offsetWidth, animatedPanel.classList.add("is-swap"))
  }
  const handleKeyDown = (kills) => {
    if (hasOpenDialog() || isLocked) return
    const inputVariant = document.activeElement instanceof HTMLElement ? document.activeElement.tagName : ""
    switch (kills.key) {
      case "ArrowLeft":
      case "ArrowUp":
        if (inputVariant === "INPUT") return
        ;(kills.preventDefault(), host.audio.ui("select"), k(-1))
        break
      case "ArrowRight":
      case "ArrowDown":
        if (inputVariant === "INPUT") return
        ;(kills.preventDefault(), host.audio.ui("select"), k(1))
        break
      case "Enter":
        if ((isFocusVisibleButton(element) && !document.activeElement.classList.contains("sf-hcard")) || kills.repeat) return
        ;(kills.preventDefault(), host.audio.ui("ready"), S())
        break
      case "Escape":
        ;(kills.preventDefault(), host.audio.ui("back"), config.onBack())
        break
    }
  }
  window.addEventListener("keydown", handleKeyDown)
  const resizeObserver = typeof ResizeObserver < "u" ? new ResizeObserver(() => heroPreview?.resize()) : null,
    handleResize = () => heroPreview?.resize()
  let previewFrameId = 0
  const initPreview = () => {
      if (!createElElValue.isConnected || createElElValue.clientWidth === 0) {
        previewFrameId = requestAnimationFrame(initPreview)
        return
      }
      try {
        ;((heroPreview = host.createHeroPreview(createElElValue, selectedHeroId)), heroPreview.resize())
      } catch {
        heroPreview = null
      }
      ;(resizeObserver?.observe(ElResult), window.addEventListener("resize", handleResize))
    },
    setTimeoutResult = window.setTimeout(() => {
      previewFrameId = requestAnimationFrame(initPreview)
    }, 280)
  let swipeStartX = null
  const onPointerDown = (pointerEvent) => {
      pointerEvent.pointerType !== "mouse" && pointerEvent.target === createElElValue && (swipeStartX = pointerEvent.clientX)
    },
    onPointerUp = /**
 * 处理事件。
 *
 * @param pointerEvent - 主要输入
 */
(pointerEvent) => {
      if (swipeStartX === null) return
      const swipeDeltaX = pointerEvent.clientX - swipeStartX
      ;((swipeStartX = null), Math.abs(swipeDeltaX) > 48 && (host.audio.ui("select"), k(swipeDeltaX < 0 ? 1 : -1)))
    }
  return (
    ElResult.addEventListener("pointerdown", onPointerDown),
    ElResult.addEventListener("pointerup", onPointerUp),
    ElResult.addEventListener("pointercancel", () => (swipeStartX = null)),
    E(!1),
    {
      el: element,
      freeze: () => {
        isLocked = !0
      },
      dispose: () => {
        ;(window.clearTimeout(setTimeoutResult), cancelAnimationFrame(previewFrameId), window.removeEventListener("keydown", handleKeyDown), window.removeEventListener("resize", handleResize), resizeObserver?.disconnect())
        for (const splice0 of disposers.splice(0)) splice0()
        try {
          heroPreview?.dispose()
        } catch {}
        heroPreview = null
      },
    }
  )
}

export { renderHeroRoster, createHeroSelect, isOverlayAvailable, openDialog }