/**
 * 技能栏面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BASIC_SKILL_SPECS, ICON_FRAME_KINDS, SKILL_EFFECT_COLORS, describeSkillRange, describeSkillShape, renderIconFrame } from './icon-theme'
import { Nh, ea, lm } from '../skills/skill-values'
import { injectSkillTagStyles, escapeHtml } from './hud-panels'
import { createEl, createIconEl, iconFor, injectStyleSheet, makeIconByName } from './dom-kit'
import { HUD_SKILLS_CSS, SKILL_ICON_POSITIONS, SKILL_KEY_LABELS, SKILL_SLOT_NAMES, SKILL_SLOT_ORDER, SUMMONER_ICON_POSITIONS } from './hud-controls-styles'
import { HERO_TABLE } from '../../heroes/registry'
import { bindClassToggle, createCssVarWriter, hexToRgbString, skillTagHtml, toggleClassOn, createTextWriter } from './status-strip'
import { describeSkillFull } from '../render/procedural-art'
import { MINIMAP_STYLE } from './minimap'

function getSkillIconFrame(lookupKey, lookupOption) {
  return lookupOption === "s1" || lookupOption === "s2" || lookupOption === "ult" ? ICON_FRAME_KINDS(lookupKey, lookupOption) : renderIconFrame(lookupOption)
}

function skillTagLabel(ultKind, skillTags) {
  if (ultKind === "ult") return { text: "大招", color: "#ffe7ad" }
  if (ultKind === "passive") return { text: "被动", color: "#8fe9ff" }
  const selectedT = skillTags?.[0]
  return selectedT ? { text: SKILL_EFFECT_COLORS[selectedT].short, color: SKILL_EFFECT_COLORS[selectedT].color } : null
}

function getSkillUnlockLevel(skillSlot) {
  for (let index = 1; index <= 15; index++) if (lm(index)[skillSlot] >= 1) return index
  return 1
}

/**
 * 格式化技能。
 *
 * @param skillSpec - 主要输入
 * @param skillLevel - 次要输入
 */
function formatSkillDescription(skillSpec, skillLevel) {
  const effectiveLevel = Math.max(1, skillLevel)
  return escapeHtml(skillSpec.desc).replace(/\{(\w+)(%?)\}/g, (matchedPlaceholder, valueKey, percentSuffix) => {
    if (skillSpec.values[valueKey] === void 0) return ""
    const nhResult = Nh(skillSpec, valueKey, effectiveLevel)
    return `<span class="sf-hud-v sf-num">${percentSuffix === "%" ? `${Math.round(nhResult * 100)}%` : Number.isInteger(nhResult) ? String(nhResult) : String(Math.round(nhResult * 100) / 100)}</span>`
  })
}

/**
 * 创建技能。
 *
 * @param battleState - 来源
 * @returns 结果对象
 */
function createSkillBar(battleState) {
  ;(injectStyleSheet("sf-hud-skills", HUD_SKILLS_CSS), injectSkillTagStyles())
  const heroId = battleState.me.heroId,
    selectedHERO_TABLE = HERO_TABLE[heroId],
    element = createEl("div", "sf-hud__skills"),
    config = {},
    // 技能按钮字典按槽位在运行期动态填充；标注为元素字典以消除 '{}' 无属性错误
    slotButtons: Record<string, ReturnType<typeof createEl>> = {},
    positionSkillIcon = (element, recallKind) => {
      ;(element.style.setProperty("--x", SKILL_ICON_POSITIONS[recallKind].x.toFixed(3)),
        element.style.setProperty("--y", SKILL_ICON_POSITIONS[recallKind].y.toFixed(3)),
        (recallKind === "recall" || recallKind === "heal" || recallKind === "flash") && (element.style.setProperty("--xp", SUMMONER_ICON_POSITIONS[recallKind].x.toFixed(3)), element.style.setProperty("--yp", SUMMONER_ICON_POSITIONS[recallKind].y.toFixed(3))))
    },
    attackIcon = selectedHERO_TABLE.attackType === "melee" ? iconFor("kill") : selectedHERO_TABLE.role === "mage" ? makeIconByName("mage") : makeIconByName("marksman"),
    createElElement = createEl("button", "sf-hud__sk is-atk", createEl("span", "sf-hud__atk-face", createIconEl(attackIcon)), createEl("span", "sf-hud__key", SKILL_KEY_LABELS.attack))
  ;((createElElement.type = "button"), (createElElement.tabIndex = -1), (createElElement.dataset.btn = "attack"), createElElement.setAttribute("aria-label", "普通攻击"), positionSkillIcon(createElElement, "attack"), (slotButtons.attack = createElElement))
  for (const skillSlot of SKILL_SLOT_ORDER) {
    const isHeroSkill = skillSlot === "s1" || skillSlot === "s2" || skillSlot === "ult",
      skillFaceElement = createEl("span", "sf-hud__sk-face")
    skillFaceElement.innerHTML = getSkillIconFrame(heroId, skillSlot)
    const ElValue = createEl("b", "sf-hud__sk-sec sf-num"),
      levelPipsElement = isHeroSkill ? createEl("span", "sf-hud__sk-pips") : null,
      levelPips = []
    if (levelPipsElement) {
      const maxSkillLevel = selectedHERO_TABLE.skills[skillSlot].maxLevel
      for (let index = 0; index < maxSkillLevel; index++) {
        const createElElValue = createEl("i")
        ;(levelPips.push(createElElValue), levelPipsElement.appendChild(createElElValue))
      }
    }
    const skillTag = isHeroSkill ? skillTagLabel(skillSlot, selectedHERO_TABLE.skills[skillSlot].tags) : null
    let skillTagElement = null
    skillTag && ((skillTagElement = createEl("i", `sf-hud__sk-tag${skillSlot === "ult" ? " is-ult" : ""}`, skillTag.text)), skillTagElement.style.setProperty("--tag", hexToRgbString(skillTag.color)))
    const skillButton = createEl(
      "button",
      `sf-hud__sk ${skillSlot === "ult" ? "is-ult" : isHeroSkill ? "" : "is-sum"}`,
      skillFaceElement,
      createEl("i", "sf-hud__sk-cd"),
      createEl("span", "sf-hud__sk-mark is-mana", createIconEl(iconFor("mana"))),
      createEl("span", "sf-hud__sk-mark is-ban", createIconEl(iconFor("cancel"))),
      createEl("span", "sf-hud__sk-mark is-lock", createIconEl(iconFor("lock"))),
      ElValue,
      createEl("i", "sf-hud__sk-fx"),
      levelPipsElement,
      createEl("span", "sf-hud__key", SKILL_KEY_LABELS[skillSlot]),
      skillTagElement,
      isHeroSkill ? null : createEl("i", "sf-hud__sk-name", ea[skillSlot].name),
    )
    ;((skillButton.type = "button"),
      (skillButton.tabIndex = -1),
      (skillButton.dataset.btn = skillSlot),
      skillButton.setAttribute("aria-label", isHeroSkill ? `${SKILL_SLOT_NAMES[skillSlot]} ${selectedHERO_TABLE.skills[skillSlot].name}` : ea[skillSlot].name),
      positionSkillIcon(skillButton, skillSlot),
      (slotButtons[skillSlot] = skillButton),
      (config[skillSlot] = {
        el: skillButton,
        setCd: createCssVarWriter(skillButton, "--cd", 1 / 360),
        setSec: createTextWriter(ElValue),
        setOnCd: bindClassToggle(skillButton, "is-cd"),
        setLocked: bindClassToggle(skillButton, "is-locked"),
        setNoMana: bindClassToggle(skillButton, "is-nomana"),
        setForbid: bindClassToggle(skillButton, "is-forbid"),
        pips: levelPips,
        level: -1,
        wasCd: !1,
      }))
  }
  element.append(slotButtons.recall, slotButtons.heal, slotButtons.flash, slotButtons.s1, slotButtons.s2, slotButtons.ult, createElElement)
  const cancelZoneElement = createEl("div", "sf-hud__cancel", createEl("span", null, createIconEl(iconFor("close")), "取消"))
  element.appendChild(cancelZoneElement)
  const bindClassToggleResult = bindClassToggle(element, "is-dead"),
    setAttackForbid = bindClassToggle(createElElement, "is-forbid"),
    setRecallActive = bindClassToggle(slotButtons.recall, "is-active"),
    setHealActive = bindClassToggle(slotButtons.heal, "is-active")
  let aimedSlot = null
  function x(tipSlot) {
    const selectedSkills = battleState.me.skills[tipSlot],
      keyLabelHtml = battleState.mode === "kbm" ? `<span class="sf-kbd">${SKILL_KEY_LABELS[tipSlot]}</span>` : "",
      cooldownWarnHtml = selectedSkills.cd > 0.05 ? `<span class="is-warn">剩余 ${selectedSkills.cd >= 10 ? Math.ceil(selectedSkills.cd) : selectedSkills.cd.toFixed(1)} 秒</span>` : ""
    if (tipSlot === "s1" || tipSlot === "s2" || tipSlot === "ult") {
      const heroSkill = selectedHERO_TABLE.skills[tipSlot],
        skillLevel = selectedSkills.level,
        levelIndex = Math.max(0, Math.min(heroSkill.maxLevel, Math.max(1, skillLevel)) - 1),
        cooldownSeconds = skillLevel > 0 && selectedSkills.cdMax > 0 && selectedSkills.cd > 0 ? selectedSkills.cdMax : heroSkill.cooldown[levelIndex] * (1 - battleState.me.stats.cdr),
        manaCost = skillLevel > 0 ? selectedSkills.cost : heroSkill.manaCost[levelIndex],
        levelLabel = skillLevel > 0 ? `Lv.${skillLevel}/${heroSkill.maxLevel}` : `${getSkillUnlockLevel(tipSlot)} 级解锁`,
        lowManaWarnHtml = skillLevel > 0 && battleState.me.mana < manaCost ? '<span class="is-warn">法力不足</span>' : "",
        tagCastHtml = heroSkill.brief || heroSkill.tags?.length ? `<div class="sf-hud-tiptags">${skillTagHtml(tipSlot, heroSkill.tags)}<span class="sf-hud-tipcast">${describeSkillShape(heroSkill.cast)}</span></div>` : "",
        rangeDescription = tagCastHtml ? describeSkillRange(heroSkill.cast) : describeSkillFull(heroSkill.cast)
      return (
        `<div class="sf-tip__title"><span>${escapeHtml(heroSkill.name)}</span><span class="sf-tip__meta sf-num">${SKILL_SLOT_NAMES[tipSlot]} · ${levelLabel}</span></div>` +
        tagCastHtml +
        (heroSkill.brief ? `<div class="sf-hud-tipbrief">${escapeHtml(heroSkill.brief)}</div>` : "") +
        `<div class="sf-hud-tipline"><span>冷却 <b class="sf-num">${Math.round(cooldownSeconds * 10) / 10}</b> 秒</span><span>消耗 <b class="sf-num">${manaCost}</b> 法力</span>${rangeDescription ? `<span>${rangeDescription}</span>` : ""}${cooldownWarnHtml}${lowManaWarnHtml}${keyLabelHtml}</div><div class="sf-hud-tipdesc">${formatSkillDescription(heroSkill, skillLevel)}</div>`
      )
    }
    const selectedEa = ea[tipSlot],
      describeSkillRangeResult = describeSkillRange(BASIC_SKILL_SPECS[tipSlot])
    return `<div class="sf-tip__title"><span>${escapeHtml(selectedEa.name)}</span><span class="sf-tip__meta">通用技能</span></div><div class="sf-hud-tipbrief">${escapeHtml(selectedEa.brief)}</div><div class="sf-hud-tipline"><span>冷却 <b class="sf-num">${selectedEa.cooldown}</b> 秒</span>${describeSkillRangeResult ? `<span>${describeSkillRangeResult}</span>` : ""}${cooldownWarnHtml}${keyLabelHtml}</div><div class="sf-hud-tipdesc">${escapeHtml(selectedEa.desc)}</div>`
  }
  return {
    el: element,
    buttons: slotButtons,
    cancelZone: cancelZoneElement,
    tipHtml: x,
    setDown(targetObject, propertyName) {
      slotButtons[targetObject].classList.toggle("is-down", propertyName)
    },
    setAiming(slotToAim, isAiming) {
      ;(aimedSlot && aimedSlot !== slotToAim && slotButtons[aimedSlot].classList.remove("is-aim"), (aimedSlot = slotToAim), slotToAim && slotButtons[slotToAim].classList.add("is-aim"), cancelZoneElement.classList.toggle("is-on", !!slotToAim && isAiming), (!slotToAim || !isAiming) && cancelZoneElement.classList.remove("is-hot"))
    },
    setCancelHot(isHot) {
      cancelZoneElement.classList.toggle("is-hot", isHot)
    },
    update(currentState) {
      const selfPlayer = currentState.me
      bindClassToggleResult(!selfPlayer.alive)
      let isActive = !1,
        isSilenced = !1,
        isRecalling = !1,
        isRestoring = !1
      for (const playerBuff of selfPlayer.buffs) playerBuff.id === "stun" || playerBuff.id === "airborne" ? (isActive = !0) : playerBuff.id === "silence" ? (isSilenced = !0) : playerBuff.id === "recall" ? (isRecalling = !0) : playerBuff.id === "restore" && (isRestoring = !0)
      ;(setAttackForbid(selfPlayer.alive && isActive), setRecallActive(isRecalling), setHealActive(isRestoring))
      for (const slotKey of SKILL_SLOT_ORDER) {
        const selectedI = config[slotKey],
          skillRuntime = selfPlayer.skills[slotKey],
          isOnCooldown = skillRuntime.cd > 0.03,
          isLocked = skillRuntime.level <= 0
        if (
          (selectedI.setOnCd(isOnCooldown),
          isOnCooldown ? (selectedI.setCd(skillRuntime.cdMax > 0 ? MINIMAP_STYLE(skillRuntime.cd / skillRuntime.cdMax) : 1), selectedI.setSec(skillRuntime.cd >= 9.95 ? String(Math.ceil(skillRuntime.cd)) : skillRuntime.cd.toFixed(1))) : (selectedI.setSec(""), selectedI.wasCd && selfPlayer.alive && toggleClassOn(selectedI.el, "is-ready")),
          (selectedI.wasCd = isOnCooldown),
          selectedI.setLocked(isLocked),
          selectedI.setNoMana(!isLocked && skillRuntime.cost > 0 && selfPlayer.mana < skillRuntime.cost),
          selectedI.setForbid(selfPlayer.alive && !isLocked && (isActive || isSilenced)),
          skillRuntime.level !== selectedI.level)
        ) {
          for (let index = 0; index < selectedI.pips.length; index++) selectedI.pips[index].classList.toggle("is-on", index < skillRuntime.level)
          ;(selectedI.level >= 0 && skillRuntime.level > selectedI.level && toggleClassOn(selectedI.el, "is-lvup"), (selectedI.level = skillRuntime.level))
        }
      }
    },
  }
}

export { skillTagLabel, createSkillBar }