/**
 * 记分板面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { createEl, createIconEl, iconFor, injectStyleSheet, makeIconButton, makeIconByName } from './dom-kit'
import { HUD_SIDEBAR_CSS } from './hud-sidebar-styles'
import { bindClassToggle, createFormattedTextWriter, createTextWriter } from './status-strip'
import { HERO_TABLE } from '../../heroes/registry'
import { formatNumber, renderHeroNameTag } from './hud-panels'
import { ROLE_TINT_COLORS, heroBannerLabel } from './banner'
import { z0 } from '../skills/skill-values'
import { itemIconFor } from '../render/procedural-art'

/**
 * 格式化评分。
 *
 * @param clockSeconds - 主要输入
 * @returns 文本结果
 */
function formatScoreboardClock(clockSeconds) {
  const totalSeconds = Math.max(0, Math.floor(clockSeconds)),
    minutes = Math.floor(totalSeconds / 60),
    secondsWithinMinute = totalSeconds % 60
  return `${minutes < 10 ? "0" : ""}${minutes}:${secondsWithinMinute < 10 ? "0" : ""}${secondsWithinMinute}`
}

/**
 * 创建评分。
 *
 * @param world - 战场
 * @returns 结果对象
 */
function createScoreboard(world) {
  injectStyleSheet("sf-hud-sb", HUD_SIDEBAR_CSS)
  let isActive = !1,
    isScoreboardPinned = !1,
    lastUpdateTime = -1
  const element = createEl("span", "sf-num", "00:00"),
    FormattedTextWriterValue = createFormattedTextWriter(element, formatScoreboardClock),
    IconButtonValue = makeIconButton({ icon: iconFor("close"), label: "关闭战况", quiet: !0, sound: "back", cls: "sf-hud__sb-close", onClick: () => world.actions.setScoreboard(!1, !1) }),
    ElValue = createEl("header", "sf-hud__sb-head", createEl("h2", "sf-hud__sb-title sf-metal", "战况"), createEl("span", "sf-hud__sb-time", createIconEl(iconFor("clock")), element), createEl("span", "sf-hud__sb-hint", "松开 Tab 关闭"), IconButtonValue),
    createElElement = createEl(
      "div",
      "sf-hud__sb-body sf-scroll",
      createEl(
        "div",
        "sf-hud__sb-cols",
        createEl("span", null, "英雄"),
        createEl("span", null, createEl("span", "sf-hud__sb-long", "击杀 / 阵亡 / 助攻"), createEl("span", "sf-hud__sb-short", "杀 / 亡 / 助")),
        createEl("span", null, "补兵"),
        createEl("span", null, "经济"),
        createEl("span", null, "装备"),
      ),
    ),
    rowsByHeroId = new Map(),
    teamStatWriters = []
  function d(tagHero) {
    const selectedHERO_TABLE = HERO_TABLE[tagHero.heroId],
      IconElValue = createIconEl(makeIconByName(selectedHERO_TABLE.role), "sf-hud__sb-rolei"),
      element = createEl("span", "sf-hud__sb-name", IconElValue, renderHeroNameTag(tagHero.heroId))
    return (element.style.setProperty("--role", ROLE_TINT_COLORS[selectedHERO_TABLE.role]), element.setAttribute("aria-label", z0(selectedHERO_TABLE)), element)
  }
  function h(rowHero) {
    const element = createEl("span", "sf-hud__sb-lv sf-num"),
      respawnText = createEl("span", "sf-num"),
      killsText = createEl("b", "sf-num"),
      deathsText = createEl("b", "sf-num is-d"),
      assistsText = createEl("b", "sf-num is-a"),
      csText = createEl("span", "sf-num"),
      goldText = createEl("span", "sf-hud__sb-gold sf-num"),
      itemSlots = createEl("span", "sf-hud__sb-items"),
      itemSlotElements = []
    for (let index = 0; index < rowHero.items.length; index++) {
      const itemSlotEl = createEl("span", "sf-slot sf-slot--empty")
      ;(itemSlotElements.push(itemSlotEl), itemSlots.appendChild(itemSlotEl))
    }
    const heroRow = createEl(
      "div",
      `sf-hud__sb-row${rowHero.isPlayer ? " is-me" : ""}`,
      createEl(
        "span",
        "sf-hud__sb-hero",
        createEl("span", "sf-hud__sb-facebox", heroBannerLabel(world.host, rowHero, world.team), element),
        d(rowHero),
        rowHero.isPlayer ? createEl("span", "sf-badge sf-badge--me", "你") : null,
        createEl("span", "sf-hud__sb-respawn", createIconEl(iconFor("hourglass")), respawnText),
      ),
      createEl("span", "sf-hud__sb-kda", killsText, createEl("i", null, "/"), deathsText, createEl("i", null, "/"), assistsText),
      csText,
      goldText,
      itemSlots,
    )
    return {
      el: heroRow,
      setLv: createFormattedTextWriter(element),
      setK: createFormattedTextWriter(killsText),
      setD: createFormattedTextWriter(deathsText),
      setA: createFormattedTextWriter(assistsText),
      setCs: createFormattedTextWriter(csText),
      setGold: createFormattedTextWriter(goldText, formatNumber),
      setRespawn: createFormattedTextWriter(respawnText, (respawnSeconds) => `${respawnSeconds}秒`),
      setDead: bindClassToggle(heroRow, "is-dead"),
      slots: itemSlotElements,
      items: rowHero.items.map(() => null),
    }
  }
  const teamOrder = world.team === 0 ? [0, 1] : [1, 0]
  for (const teamId of teamOrder) {
    const isOwnTeam = teamId === world.team,
      createElElValue = createEl("b", "sf-num"),
      ElResult = createEl("b", "sf-num"),
      teamGoldText = createEl("b", "sf-num")
    ;(createElElement.appendChild(
      createEl("div", `sf-hud__sb-team ${isOwnTeam ? "is-blue" : "is-red"}`, isOwnTeam ? "我方" : "敌方", createEl("span", null, createIconEl(iconFor("kill")), createElElValue), createEl("span", null, createIconEl(iconFor("tower")), ElResult), createEl("span", null, createIconEl(iconFor("gold")), teamGoldText)),
    ),
      (teamStatWriters[teamId] = { kills: createFormattedTextWriter(createElElValue), towers: createFormattedTextWriter(ElResult), gold: createTextWriter(teamGoldText) }))
    const teamRows = createEl("div")
    for (const teamHero of world.state.heroes) {
      if (teamHero.team !== teamId) continue
      const hResult = h(teamHero)
      ;(rowsByHeroId.set(teamHero.id, hResult), teamRows.appendChild(hResult.el))
    }
    createElElement.appendChild(teamRows)
  }
  const scoreboardPanel = createEl("div", "sf-hud__sb-panel sf-panel", ElValue, createElElement),
    scoreboardRoot = createEl("div", "sf-hud__sb", scoreboardPanel)
  scoreboardRoot.addEventListener("pointerdown", (pointerEvent) => {
    isScoreboardPinned && pointerEvent.target === scoreboardRoot && world.actions.setScoreboard(!1, !1)
  })
  function p() {
    const matchState = world.state
    FormattedTextWriterValue(Math.floor(matchState.time))
    for (const statTeamId of teamOrder) {
      const selectedTeams = matchState.teams[statTeamId]
      ;(teamStatWriters[statTeamId].kills(selectedTeams.kills), teamStatWriters[statTeamId].towers(selectedTeams.towersDestroyed))
      let total = 0
      for (const goldHero of matchState.heroes) goldHero.team === statTeamId && (total += goldHero.goldEarned)
      teamStatWriters[statTeamId].gold(formatNumber(total))
    }
    for (const stateHero of matchState.heroes) {
      const Value = rowsByHeroId.get(stateHero.id)
      if (Value) {
        ;(Value.setLv(stateHero.level),
          Value.setK(stateHero.kills),
          Value.setD(stateHero.deaths),
          Value.setA(stateHero.assists),
          Value.setCs(stateHero.cs),
          Value.setGold(Math.floor(stateHero.goldEarned)),
          Value.setDead(!stateHero.alive),
          stateHero.alive || Value.setRespawn(Math.ceil(stateHero.respawnIn)))
        for (let slotIndex = 0; slotIndex < Value.slots.length; slotIndex++) {
          const itemId = stateHero.items[slotIndex] ?? null
          itemId !== Value.items[slotIndex] && ((Value.items[slotIndex] = itemId), (Value.slots[slotIndex].innerHTML = itemId ? itemIconFor(itemId) : ""), Value.slots[slotIndex].classList.toggle("sf-slot--empty", !itemId))
        }
      }
    }
  }
  return {
    el: scoreboardRoot,
    isOpen: () => isActive,
    isPinned: () => isActive && isScoreboardPinned,
    setOpen(targetObject, propertyName) {
      ;(targetObject === isActive && propertyName === isScoreboardPinned) || ((isActive = targetObject), (isScoreboardPinned = targetObject && propertyName), scoreboardRoot.classList.toggle("is-open", isActive), scoreboardRoot.classList.toggle("is-pinned", isScoreboardPinned), isActive && ((lastUpdateTime = world.now), p()))
    },
    update(updateState) {
      !isActive || updateState.now - lastUpdateTime < 0.25 || ((lastUpdateTime = updateState.now), p())
    },
  }
}

export { createScoreboard, formatScoreboardClock }