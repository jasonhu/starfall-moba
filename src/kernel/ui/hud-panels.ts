/**
 * HUD 面板集合
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { HERO_TABLE } from '../../heroes/registry'
import { injectThemeStyles, bindTooltip, hasOpenDialog, isFocusVisibleButton, createEl, createIconEl, expandCssUnits, iconFor, injectStyleSheet, makeBadge, makePanel, makePanelBody, bindUiSounds, refreshHud } from './dom-kit'
import { ROLE_TINT_COLORS, heroNameForBanner } from './banner'
import { extractStatLabels } from './icon-theme'
import { RESULT_SCREEN_CSS } from './result-screen-styles'
import { itemIconFor, makeCanvasTexture } from '../render/procedural-art'
import { ItemTable } from '../equipment'

function formatGameClock(gameTimeSeconds) {
  const totalSeconds = Math.max(0, Math.floor(gameTimeSeconds))
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`
}

function formatNumber(rawAmount) {
  const roundedAmount = Math.round(rawAmount)
  return roundedAmount >= 1e4 ? `${(roundedAmount / 1e3).toFixed(1)}k` : String(roundedAmount)
}

function escapeHtml(rawText) {
  return rawText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * 绘制英雄。
 *
 * @param heroId - 英雄
 * @param nameClass - 次要输入
 */
function renderHeroNameTag(heroId, nameClass?) {
  injectSkillTagStyles()
  const selectedHERO_TABLE = HERO_TABLE[heroId],
    element = createEl("small", "sf-heroname__role", ` · ${selectedHERO_TABLE.roleName}`),
    createElElement = createEl("span", `sf-heroname${nameClass ? ` ${nameClass}` : ""}`, selectedHERO_TABLE.name, element)
  return (createElElement.style.setProperty("--role", ROLE_TINT_COLORS[selectedHERO_TABLE.role]), createElElement)
}

const SKILL_TAG_CSS = expandCssUnits(`
.sf-heroname { white-space: nowrap; }
.sf-heroname__role { font-size: 0.72em; font-weight: 600; letter-spacing: 0.04em; color: var(--role, var(--sf-c-text-2)); -webkit-text-fill-color: var(--role, var(--sf-c-text-2)); }
/* 技能类型标签：胶囊形，文字用标签色，底色为标签色 14% 不透明度，1px 同色 45% 描边。颜色只是辅助，文字永远在 */
.sf-stags { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4u 5u; vertical-align: middle; }
.sf-stag {
  --tag: 243, 207, 133;
  display: inline-flex; align-items: center; flex: none; height: 1.7em; padding: 0 0.62em; border-radius: 99px; font-size: var(--sf-fs-xs); font-weight: 700; line-height: 1; letter-spacing: 0.06em; white-space: nowrap;
  color: rgb(var(--tag)); background: rgba(var(--tag), 0.14); box-shadow: inset 0 0 0 1px rgba(var(--tag), 0.45);
}
/* 「大招」：金色实底、深色字；「被动」：青色描边、不铺底 */
.sf-stag.is-ult { color: #2b1a04; background: var(--sf-grad-gold); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6); }
.sf-stag.is-passive { --tag: 143, 233, 255; background: none; }
`)

function injectSkillTagStyles() {
  injectStyleSheet("sf-skill-tags", SKILL_TAG_CSS)
}

const ITEM_TOOLTIP_CSS = expandCssUnits(`
.sf-tip__brief { margin-top: 2u; font-size: var(--sf-fs-sm); font-weight: 600; line-height: 1.45; color: var(--sf-c-text); }
.sf-tip__statgrid { display: grid; grid-template-columns: auto auto; justify-content: space-between; gap: 1u 18u; margin-top: 6u; padding-top: 6u; box-shadow: inset 0 1px 0 var(--sf-c-line); }
.sf-tip__statgrid > span { color: var(--sf-c-text-2); }
.sf-tip__statgrid > b { color: var(--sf-c-cyan-300); font-weight: 700; text-align: right; }
.sf-tip__note { margin-top: 6u; font-size: var(--sf-fs-xs); color: var(--sf-c-text-3); }
`)

/**
 * 创建装备。
 *
 * @param itemSpec - 来源
 * @param tooltipClass - 次要输入
 * @returns 文本结果
 */
function buildItemTooltip(itemSpec, tooltipClass?) {
  injectStyleSheet("sf-hud-itemtip", ITEM_TOOLTIP_CSS)
  const briefHtml = itemSpec.brief ? `<div class="sf-tip__brief">${escapeHtml(itemSpec.brief)}</div>` : "",
    joinResult = extractStatLabels(itemSpec.stats)
      .map((statLabel) => `<span>${escapeHtml(statLabel.label)}</span><b class="sf-num">${escapeHtml(statLabel.value)}</b>`)
      .join(""),
    statsGridHtml = joinResult ? `<div class="sf-tip__statgrid">${joinResult}</div>` : "",
    passiveHtml = itemSpec.passive ? `<div class="sf-tip__passive"><b>被动 · ${escapeHtml(itemSpec.passive.name)}</b>　${escapeHtml(itemSpec.passive.desc)}</div>` : ""
  return `<div class="sf-tip__title"><span>${escapeHtml(itemSpec.name)}</span><span class="sf-tip__meta sf-num">${itemSpec.cost} 金币</span></div>${briefHtml}${statsGridHtml}${passiveHtml}`
}

function getItemTooltip(lookupKey) {
  return buildItemTooltip(lookupKey)
}

const MIN_RESULT_SCORE = 3,
  MAX_RESULT_SCORE = 16

function formatResultScore(rawScore) {
  const normalizedScore = ((rawScore - MIN_RESULT_SCORE) / (MAX_RESULT_SCORE - MIN_RESULT_SCORE)) * 10
  return Math.max(0, Math.min(10, normalizedScore)).toFixed(1)
}

/**
 * 计算英雄与评分。
 *
 * @param world - 战场
 */
function computeHeroScores(world) {
  const scoreById = new Map(),
    matchMinutes = Math.max(1, (world.endTime ?? world.time) / 60)
  for (const teamId of [0, 1]) {
    const filterResult = world.heroes.filter((unit) => unit.team === teamId),
      teamStatTotal = (statOf) =>
        Math.max(
          1,
          filterResult.reduce((runningTotal, teamHero) => runningTotal + statOf(teamHero), 0),
        ),
      aResult = teamStatTotal((killsHero) => killsHero.kills),
      aAResult = teamStatTotal((damageHero) => damageHero.dmgDealt),
      teamDamageTaken = teamStatTotal((takenHero) => takenHero.dmgTaken),
      teamTowerDamage = teamStatTotal((towerHero) => towerHero.dmgTower)
    for (const scoredHero of filterResult) {
      const kdaRatio = (scoredHero.kills + scoredHero.assists * 0.6) / Math.max(1, scoredHero.deaths),
        killParticipation = Math.min(1, (scoredHero.kills + scoredHero.assists) / aResult),
        compositeScore = 3 + Math.min(4, kdaRatio * 0.8) + killParticipation * 2.5 + (scoredHero.dmgDealt / aAResult) * 6 + (scoredHero.dmgTaken / teamDamageTaken) * 3 + (scoredHero.dmgTower / teamTowerDamage) * 2.5 + Math.min(1, scoredHero.cs / (matchMinutes * 6)) + (world.winner === teamId ? 1 : 0)
      scoreById.set(scoredHero.id, { score: Math.max(0, Math.min(MAX_RESULT_SCORE, compositeScore)), participation: killParticipation })
    }
  }
  return scoreById
}

function createCompactResultCell(labelText, columnKey) {
  const element = createEl("span", "sf-rt__c", labelText)
  return ((element.dataset.c = columnKey), element)
}

function createResultCell(columnKey, labelText, valueText, statBar?, valueClassName?) {
  const element = createEl("span", "sf-rt__cell", createEl("span", "sf-rt__lab", labelText), createEl("span", `sf-rt__val${valueClassName ? ` ${valueClassName}` : ""}`, valueText), statBar)
  return ((element.dataset.c = columnKey), element)
}

/** createHudPanel 的可选配置：signal 用于提前中止结果面板展示。 */
interface ResultPanelOptions {
  signal?: AbortSignal
}

/**
 * 创建界面。
 *
 * @param element - 界面元素
 * @param battleState - 战场
 * @param uiServices - 第三输入
 * @param panelOptions - 第四输入
 */
function createHudPanel(element, battleState, uiServices, panelOptions: ResultPanelOptions = {}) {
  if (panelOptions.signal?.aborted) return new Promise(() => {})
  ;(injectThemeStyles(), injectStyleSheet("sf-menu-result", RESULT_SCREEN_CSS))
  const playerHero = battleState.heroes.find((hero) => hero.isPlayer) ?? battleState.heroes[0],
    playerTeam = playerHero ? playerHero.team : 0,
    winningTeam = battleState.winner ?? (battleState.teams[0].kills >= battleState.teams[1].kills ? 0 : 1),
    isVictory = winningTeam === playerTeam,
    computeHeroScoresResult = computeHeroScores({ ...battleState, winner: winningTeam }),
    tooltipCleanups = [],
    findTopScorer = (teamId) => {
      let topScorerId = -1,
        topScore = -1
      for (const candidateHero of battleState.heroes) {
        const candidateScore = computeHeroScoresResult.get(candidateHero.id)?.score ?? 0
        candidateHero.team === teamId && candidateScore > topScore && ((topScore = candidateScore), (topScorerId = candidateHero.id))
      }
      return topScorerId
    },
    fResult = findTopScorer(winningTeam),
    fFResult = findTopScorer(winningTeam === 0 ? 1 : 0),
    maxDamageDealt = Math.max(1, ...battleState.heroes.map((damageDealer) => damageDealer.dmgDealt)),
    maxDamageTaken = Math.max(1, ...battleState.heroes.map((damageTaker) => damageTaker.dmgTaken)),
    ElValue = createEl("h1", "sf-result__title sf-metal", isVictory ? "胜利" : "失败"),
    createElElValue = createEl("div", "sf-result__titlewrap", createEl("i", "sf-result__wing sf-result__wing--l"), ElValue, createEl("i", "sf-result__wing sf-result__wing--r")),
    selectedTeams = battleState.teams[0],
    redTeam = battleState.teams[1],
    ElResult = createEl(
      "header",
      "sf-result__banner",
      createEl("div", "sf-result__rays"),
      createElElValue,
      createEl("p", "sf-result__sub", isVictory ? "敌方水晶已被摧毁" : "我方水晶被摧毁"),
      createEl(
        "div",
        "sf-result__summary",
        createEl("span", "sf-result__vs", createEl("small", null, "蓝方"), createEl("b", "is-blue", String(selectedTeams.kills)), createIconEl(iconFor("kill")), createEl("b", "is-red", String(redTeam.kills)), createEl("small", null, "红方")),
        createEl("span", "sf-result__chip", createIconEl(iconFor("clock")), "时长", createEl("b", null, formatGameClock(battleState.endTime ?? battleState.time))),
        createEl("span", "sf-result__chip", createIconEl(iconFor("tower")), "推塔", createEl("b", null, `${selectedTeams.towersDestroyed} : ${redTeam.towersDestroyed}`)),
      ),
    ),
    resultTable = createEl(
      "div",
      "sf-rt",
      createEl(
        "div",
        "sf-rt__head",
        createEl("span", null, "英雄"),
        createEl("span", "sf-rt__c", createEl("span", "sf-rt__h-full", "击杀 / 阵亡 / 助攻"), createEl("span", "sf-rt__h-short", "战绩")),
        createCompactResultCell("补兵", "cs"),
        createEl("span", "sf-rt__c", "经济"),
        createEl("span", "sf-rt__c", "对英雄伤害"),
        createEl("span", "sf-rt__c", "承受伤害"),
        createCompactResultCell("推塔伤害", "tower"),
        createEl("span", "sf-rt__items-h", "装备"),
        createEl("span", "sf-rt__c", "评分"),
      ),
    )
  let rowIndex = 0
  for (const aa010 of [playerTeam, playerTeam === 0 ? 1 : 0]) {
    const currentTeam = battleState.teams[aa010],
      teamHeroes = battleState.heroes.filter((teamHero) => teamHero.team === aa010),
      teamRgb = aa010 === 0 ? "77, 163, 255" : "255, 93, 93",
      teamGold = currentTeam.gold > 0 ? currentTeam.gold : teamHeroes.reduce((goldTotal, goldHero) => goldTotal + goldHero.goldEarned, 0),
      teamSummary = createEl(
        "div",
        "sf-rt__team",
        createEl("b", null, aa010 === 0 ? "蓝色方" : "红色方"),
        createEl("span", null, aa010 === playerTeam ? "我方" : "敌方"),
        createEl("span", null, createIconEl(iconFor("kill")), createEl("span", "sf-num", String(currentTeam.kills))),
        createEl("span", null, createIconEl(iconFor("tower")), createEl("span", "sf-num", String(currentTeam.towersDestroyed))),
        createEl("span", null, createIconEl(iconFor("gold")), createEl("span", "sf-num", formatNumber(teamGold))),
        makeBadge(aa010 === winningTeam ? "胜利" : "失败", aa010 === winningTeam ? "solid" : "mute"),
      )
    ;(teamSummary.style.setProperty("--team-rgb", teamRgb), resultTable.appendChild(teamSummary))
    for (const resultHero of teamHeroes) {
      const heroScore = computeHeroScoresResult.get(resultHero.id)?.score ?? 0,
        isMvp = resultHero.id === fResult,
        isLoserBest = resultHero.id === fFResult,
        badgeRow = createEl("span", "sf-rt__badges", resultHero.isPlayer ? makeBadge("你", "me") : null, isMvp ? makeBadge("MVP", "solid", iconFor("crown")) : null, isLoserBest ? makeBadge("败方最佳", "mute") : null),
        heroCell = createEl("span", "sf-rt__hero", createEl("span", "sf-rt__pic-wrap", heroNameForBanner(uiServices, resultHero.heroId, "sf-rt__pic"), createEl("span", "sf-rt__lv", String(resultHero.level))), renderHeroNameTag(resultHero.heroId, "sf-rt__name"), badgeRow),
        ResultCellValue = createResultCell("kda", "战绩", "")
      ResultCellValue.querySelector(".sf-rt__val").innerHTML = `<span class="sf-rt__kda">${resultHero.kills}<i>/</i><span class="is-d">${resultHero.deaths}</span><i>/</i><span class="is-a">${resultHero.assists}</span></span>`
      const createStatBar = (clientX, clientY) => {
          const element = createEl("span", `sf-rt__bar ${clientY}`, createEl("i"))
          return (element.style.setProperty("--v", String(Math.max(0.02, Math.min(1, clientX)))), element)
        },
        itemSlots = createEl("span", "sf-rt__items")
      for (let index = 0; index < 6; index++) {
        const itemId = resultHero.items[index] ?? null,
          PanelValue = makePanel(itemId ? itemIconFor(itemId) : null, itemId ? { label: ItemTable[itemId].name } : {})
        if (itemId) {
          const selectedItemTable = ItemTable[itemId]
          ;((PanelValue.tabIndex = 0), tooltipCleanups.push(bindTooltip(PanelValue, () => getItemTooltip(selectedItemTable))))
        }
        itemSlots.appendChild(PanelValue)
      }
      const createResultCellElement = createResultCell("score", "评分", formatResultScore(heroScore))
      createResultCellElement.classList.add("sf-rt__score")
      const heroRow = createEl(
        "div",
        `sf-rt__row${resultHero.isPlayer ? " is-me" : ""}${isMvp ? " is-mvp" : ""}`,
        heroCell,
        ResultCellValue,
        createResultCell("cs", "补兵", String(resultHero.cs)),
        createResultCell("gold", "经济", formatNumber(resultHero.goldEarned), null, "sf-rt__gold"),
        createResultCell("dmg", "伤害", formatNumber(resultHero.dmgDealt), createStatBar(resultHero.dmgDealt / maxDamageDealt, "sf-rt__bar--dealt")),
        createResultCell("taken", "承伤", formatNumber(resultHero.dmgTaken), createStatBar(resultHero.dmgTaken / maxDamageTaken, "sf-rt__bar--taken")),
        createResultCell("tower", "推塔", formatNumber(resultHero.dmgTower)),
        itemSlots,
        createResultCellElement,
      )
      ;(heroRow.style.setProperty("--team-rgb", teamRgb), (heroRow.style.animationDelay = `${0.7 + rowIndex * 0.04}s`), rowIndex++, resultTable.appendChild(heroRow))
    }
  }
  const resultBoard = createEl("section", "sf-result__board sf-panel", createEl("div", "sf-result__scroll sf-scroll", resultTable)),
    resultScreen = createEl("div", `sf-screen sf-result sf-result--${isVictory ? "win" : "lose"}`, ElResult, resultBoard),
    resultRoot = createEl("div", "sf-root sf-result-root", resultScreen),
    CanvasTextureValue = makeCanvasTexture(resultRoot, isVictory ? "victory" : "defeat"),
    bindUiSoundsResult = bindUiSounds(resultRoot, uiServices.audio)
  return new Promise((event) => {
    let isActive = !1,
      closeTimer = 0
    const disposeResultPanel = () => {
        ;(panelOptions.signal?.removeEventListener("abort", onAbort), window.clearTimeout(closeTimer), window.removeEventListener("keydown", onKeyDown))
        for (const splice0 of tooltipCleanups.splice(0)) splice0()
        ;(bindUiSoundsResult(), CanvasTextureValue.dispose(), resultRoot.remove())
      },
      onAbort = () => {
        ;((isActive = !0), refreshHud(), disposeResultPanel())
      }
    panelOptions.signal?.addEventListener("abort", onAbort)
    const closeWithAction = /**
 * 处理事件。
 *
 * @param indicator - 输入
 */
(indicator) => {
        if (!isActive) {
          ;((isActive = !0), window.removeEventListener("keydown", onKeyDown), refreshHud())
          for (const cleanup of tooltipCleanups.splice(0)) cleanup()
          ;(resultRoot.classList.add("is-closing"),
            (closeTimer = window.setTimeout(() => {
              ;(disposeResultPanel(), event(indicator))
            }, 350)))
        }
      },
      onKeyDown = (keyEvent) => {
        hasOpenDialog() ||
          keyEvent.repeat ||
          (keyEvent.key === "Enter" && isFocusVisibleButton(resultRoot)) ||
          (keyEvent.key === "Enter" ? (keyEvent.preventDefault(), uiServices.audio.ui("confirm"), closeWithAction("again")) : keyEvent.key === "Escape" && (keyEvent.preventDefault(), uiServices.audio.ui("back"), closeWithAction("menu")))
      }
    ;(resultScreen.appendChild(
      createEl(
        "footer",
        "sf-result__actions",
        makePanelBody({ label: "返回主菜单", icon: iconFor("home"), sound: "back", onClick: () => closeWithAction("menu") }),
        makePanelBody({ label: "再来一局", icon: iconFor("again"), variant: "primary", pulse: !0, sound: "confirm", onClick: () => closeWithAction("again") }),
      ),
    ),
      window.addEventListener("keydown", onKeyDown),
      element.appendChild(resultRoot),
      uiServices.audio.setMusic(isVictory ? "victory" : "defeat"))
  })
}

export { injectSkillTagStyles, createHudPanel, renderHeroNameTag, buildItemTooltip, formatNumber, escapeHtml, formatGameClock, getItemTooltip }