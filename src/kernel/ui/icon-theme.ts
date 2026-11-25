/**
 * UI 图标与主题：SVG 渐变/图标构造、四套英雄调色板、HUD 主题色与技能图标表
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { SKILL_EFFECT_KINDS, ea } from '../skills/skill-values'
import { formatPercent } from '../equipment'
import { HERO_TABLE } from '../../heroes/registry'

/**
 * 处理技能与几何。
 *
 * @param skillSpec - 主要输入
 * @returns 文本结果
 */
function describeSkillShape(skillSpec) {
  switch (skillSpec.type) {
    case "direction":
      return "朝一个方向"
    case "cone":
      return "面前一片扇形"
    case "position":
      return "选一块地方"
    case "target":
      return "点一个敌人"
    default:
      return "原地放"
  }
}

function describeSkillRange(skillSpec) {
  return skillSpec.type === "self" ? (skillSpec.radius > 0 ? `半径 ${skillSpec.radius} 米` : "") : `距离 ${skillSpec.range} 米`
}

const BASIC_SKILL_SPECS = { flash: { type: "direction", range: ea.flash.range, width: 1.2 }, heal: { type: "self", radius: 0 }, recall: { type: "self", radius: 0 } },
  STAT_LABELS: Array<[string, string, (n: number) => string]> = [
    ["ad", "物攻", (statAmount) => `+${statAmount}`],
    ["ap", "法强", (statAmount) => `+${statAmount}`],
    ["apPct", "法强", (statAmount) => `+${formatPercent(statAmount)}`],
    ["hp", "生命", (statAmount) => `+${statAmount}`],
    ["mana", "法力", (statAmount) => `+${statAmount}`],
    ["armor", "护甲", (statAmount) => `+${statAmount}`],
    ["mr", "魔抗", (statAmount) => `+${statAmount}`],
    ["attackSpeedPct", "攻速", (statAmount) => `+${formatPercent(statAmount)}`],
    ["moveSpeed", "移速", (statAmount) => `+${statAmount}`],
    ["cdr", "冷却缩减", (statAmount) => `+${formatPercent(statAmount)}`],
    ["lifesteal", "吸血", (statAmount) => `+${formatPercent(statAmount)}(仅普攻)`],
    ["critChance", "暴击", (statAmount) => `+${formatPercent(statAmount)}`],
    ["critDamage", "暴击伤害", (statAmount) => `+${formatPercent(statAmount)}`],
    ["armorPen", "物穿", (statAmount) => `+${formatPercent(statAmount)}`],
    ["magicPen", "法穿", (statAmount) => `+${formatPercent(statAmount)}`],
    ["hpRegen", "回血", (statAmount) => `+${statAmount}/秒`],
    ["manaRegen", "回蓝", (statAmount) => `+${statAmount}/秒`],
  ]

function extractStatLabels(stats) {
  const statLabels = []
  for (const [statKey, statLabel, formatStat] of STAT_LABELS) {
    const selectedN = stats[statKey]
    selectedN !== void 0 && statLabels.push({ label: statLabel, value: formatStat(selectedN) })
  }
  return statLabels
}

function formatBriefStats(stats, maxStats = 3) {
  const statParts = []
  for (const [statKey, statLabel, formatStat] of STAT_LABELS) {
    const statAmount = stats[statKey]
    statAmount !== void 0 && statParts.length < maxStats && statParts.push(`${statLabel}${formatStat(statAmount).replace(/\(.*\)$/, "")}`)
  }
  return statParts.join("  ")
}

const SKILL_EFFECT_COLORS = {
    dash: { name: SKILL_EFFECT_KINDS.dash, short: "位移", color: "#5cd6f7" },
    control: { name: SKILL_EFFECT_KINDS.control, short: "控制", color: "#b9a2ff" },
    slow: { name: SKILL_EFFECT_KINDS.slow, short: "减速", color: "#8fc7ff" },
    burst: { name: SKILL_EFFECT_KINDS.burst, short: "爆发", color: "#ff8a7a" },
    dot: { name: SKILL_EFFECT_KINDS.dot, short: "持续", color: "#ffb454" },
    shield: { name: SKILL_EFFECT_KINDS.shield, short: "护盾", color: "#dfe8ff" },
    heal: { name: SKILL_EFFECT_KINDS.heal, short: "回复", color: "#6fe3a1" },
    buff: { name: SKILL_EFFECT_KINDS.buff, short: "增益", color: "#f3cf85" },
  },
  EQUIP_SLOT_NAMES = { recommend: "推荐", attack: "攻击", magic: "法术", defense: "防御", boots: "鞋" },
  EVENT_PRIORITIES = {
    match_start: 1,
    minions_spawn: 1,
    super_minions: 2,
    epic_spawn: 2,
    first_blood: 3,
    double_kill: 3,
    triple_kill: 3,
    quadra_kill: 4,
    penta_kill: 4,
    killing_spree: 2,
    unstoppable: 3,
    legendary: 4,
    shutdown: 2,
    ace: 4,
    tower_destroyed: 2,
    epic_slain: 3,
    victory: 4,
    defeat: 4,
  },
  KILL_FEED_LABELS = {
    first_blood: "首杀",
    double_kill: "双杀",
    triple_kill: "三杀",
    quadra_kill: "四杀",
    penta_kill: "五杀·星陨降临",
    killing_spree: "星芒乍现",
    unstoppable: "星火燎原",
    legendary: "星陨传说",
    shutdown: "终结",
  }

function hexToRgb(hexColor) {
  const replaceResult = hexColor.replace("#", ""),
    hexDigits =
      replaceResult.length === 3
        ? replaceResult
            .split("")
            .map((hexDigit) => hexDigit + hexDigit)
            .join("")
        : replaceResult,
    parseIntResult = parseInt(hexDigits, 16)
  return [(parseIntResult >> 16) & 255, (parseIntResult >> 8) & 255, parseIntResult & 255]
}

function mixColor(baseColor, blendColor, blendRatio) {
  const [baseRed, baseGreen, baseBlue] = hexToRgb(baseColor),
    [blendRed, blendGreen, blendBlue] = hexToRgb(blendColor),
    blendChannel = (baseChannel, targetChannel) =>
      Math.round(baseChannel + (targetChannel - baseChannel) * blendRatio)
        .toString(16)
        .padStart(2, "0")
  return `#${blendChannel(baseRed, blendRed)}${blendChannel(baseGreen, blendGreen)}${blendChannel(baseBlue, blendBlue)}`
}

const lightenColor = (color, lightenAmount) => mixColor(color, "#ffffff", lightenAmount),
  darkenColor = (color, darkenAmount) => mixColor(color, "#000000", darkenAmount),
  gradientStopsSvg = (bushMap) => bushMap.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity === void 0 ? "" : ` stop-opacity="${opacity}"`}/>`).join(""),
  linearGradientDef = (gradientId, x1, y1, x2, y2, stops) => `<linearGradient id="@${gradientId}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${gradientStopsSvg(stops)}</linearGradient>`,
  radialGradientDef = (gradientId, cx, cy, r, stops) => `<radialGradient id="@${gradientId}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${gradientStopsSvg(stops)}</radialGradient>`

let svgIconSeq = 0

function makeSvgIcon(iconSize, iconMarkup, className = "sf-ico") {
  const textValue = `sfi${(svgIconSeq++).toString(36)}-`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconSize} ${iconSize}" class="${className}" aria-hidden="true" focusable="false">${iconMarkup.replace(/@/g, textValue)}</svg>`
}

/**
 * 创建图标。
 *
 * @param bgColors - 来源
 * @param defsMarkup - 次要输入
 * @param foregroundMarkup - 第三输入
 */
function buildIconSvg(bgColors, defsMarkup, foregroundMarkup) {
  return makeSvgIcon(
    64,
    `<defs>${radialGradientDef("bg", 32, 27, 48, [
      [0, bgColors[0]],
      [0.5, bgColors[1]],
      [1, bgColors[2]],
    ])}${radialGradientDef("vg", 32, 32, 46, [
      [0.6, "#000", 0],
      [1, "#000", 0.5],
    ])}${linearGradientDef("gl", 0, 0, 0, 30, [
      [0, "#fff", 0.24],
      [1, "#fff", 0],
    ])}${defsMarkup}</defs><rect width="64" height="64" fill="url(#@bg)"/>${foregroundMarkup}<rect width="64" height="64" fill="url(#@vg)"/><path d="M0 0H64V19Q32 31 0 19Z" fill="url(#@gl)"/>`,
  )
}

const round2 = (number) => Math.round(number * 100) / 100

function diamondPath(centerX, centerY, radius, curveRatio = 0.18) {
  const round2Result = round2(radius * curveRatio)
  return `M${centerX} ${round2(centerY - radius)}Q${round2(centerX + round2Result)} ${round2(centerY - round2Result)} ${round2(centerX + radius)} ${centerY}Q${round2(centerX + round2Result)} ${round2(centerY + round2Result)} ${centerX} ${round2(centerY + radius)}Q${round2(centerX - round2Result)} ${round2(centerY + round2Result)} ${round2(centerX - radius)} ${centerY}Q${round2(centerX - round2Result)} ${round2(centerY - round2Result)} ${centerX} ${round2(centerY - radius)}Z`
}

function polarPoint(centerX, centerY, radius, angleDegrees) {
  const angleRadians = (angleDegrees * Math.PI) / 180
  return [round2(centerX + Math.cos(angleRadians) * radius), round2(centerY + Math.sin(angleRadians) * radius)]
}

/**
 * 处理路径。
 *
 * @param centerX - 主要输入
 * @param centerY - 次要输入
 * @param radius - 第三输入
 * @param startAngle - 第四输入
 * @param endAngle - 附加输入
 * @returns 文本结果
 */
function arcPath(centerX, centerY, radius, startAngle, endAngle) {
  const [startX, startY] = polarPoint(centerX, centerY, radius, startAngle),
    [endX, endY] = polarPoint(centerX, centerY, radius, endAngle),
    largeArcFlag = (((endAngle - startAngle) % 360) + 360) % 360 > 180 ? 1 : 0
  return `M${startX} ${startY}A${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
}

const radialGlowDef = (gradientId, glowColor, glowOpacity = 0.85) =>
    `<radialGradient id="@${gradientId}"><stop offset="0" stop-color="${glowColor}" stop-opacity="${glowOpacity}"/><stop offset="0.45" stop-color="${glowColor}" stop-opacity="${round2(glowOpacity * 0.35)}"/><stop offset="1" stop-color="${glowColor}" stop-opacity="0"/></radialGradient>`,
  gradientCircle = (gradientId, cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#@${gradientId})"/>`,
  ICON_OUTLINE_COLOR = "#070b16"

/**
 * 处理图标。
 *
 * @param yequeKind - 输入
 * @param isUltimate - 次要输入
 */
function heroIconPalette(yequeKind, isUltimate = !1) {
  const heroPalette = HERO_TABLE[yequeKind].palette,
    primaryColor = yequeKind === "yeque" ? lightenColor(heroPalette.primary, 0.12) : heroPalette.primary
  return isUltimate ? [mixColor(primaryColor, heroPalette.glow, 0.45), darkenColor(primaryColor, 0.35), darkenColor(primaryColor, 0.82)] : [mixColor(primaryColor, heroPalette.glow, 0.18), darkenColor(primaryColor, 0.5), darkenColor(primaryColor, 0.86)]
}

function renderBladeStrokes(startX, startY, strokeCount, bladeColor, lastStrokeColor?) {
  let total = ""
  for (let index = 0; index < strokeCount; index++) {
    const bladeStrokeX = Math.round((startX + index * 4.8) * 10) / 10,
      textResult = `M${bladeStrokeX} ${startY}L${bladeStrokeX + 2.2} ${startY - 8.5}`
    total += `<path d="${textResult}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.6" stroke-linecap="round"/><path d="${textResult}" stroke="${lastStrokeColor && index === strokeCount - 1 ? lastStrokeColor : bladeColor}" stroke-width="2.3" stroke-linecap="round"/>`
  }
  return total
}

const renderOutlinedPath = (pathData, strokeColor, strokeWidth = 1.8) =>
    `<path d="${pathData}" fill="none" stroke="#150e05" stroke-width="${strokeWidth + 2.8}" stroke-linejoin="round" stroke-linecap="round"/><path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`,
  LACQUER_PALETTE = {
    lacquer: "#2a2327",
    lacquerL: "#63545a",
    red: "#d04a32",
    bronze: "#d9a441",
    bronzeL: "#ffe6a8",
    bronzeD: "#7d5518",
    glow: "#ffcf70",
    hot: "#fff3cf",
    dust: "#c2a274",
    skin: "#dba87e",
    hair: "#231c1b",
    dark: "#1a1d25",
    wood: "#6b5236",
    steel: "#dfe6ee",
  },
  MAGE_CREST_PATH = "M0 -22Q4.2 -15.4 15 -15.8L14.1 4.4Q12 15.4 0 22Q-12 15.4 -14.1 4.4L-15 -15.8Q-4.2 -15.4 0 -22Z",
  LACQUER_SHIELD_GRADIENT =
    linearGradientDef("sh", -12, -20, 12, 20, [
      [0, LACQUER_PALETTE.lacquerL],
      [0.5, LACQUER_PALETTE.lacquer],
      [1, "#100d10"],
    ]) +
    radialGradientDef("boss", -1.4, -3.4, 7, [
      [0, "#fffbe9"],
      [0.45, LACQUER_PALETTE.bronze],
      [1, LACQUER_PALETTE.bronzeD],
    ])

function renderMageIcon(transform) {
  return `<g transform="${transform}"><path d="${MAGE_CREST_PATH}" fill="${LACQUER_PALETTE.bronze}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.6" stroke-linejoin="round"/><path d="${MAGE_CREST_PATH}" transform="scale(.85)" fill="url(#@sh)"/><path d="${MAGE_CREST_PATH}" transform="scale(.66)" fill="none" stroke="${LACQUER_PALETTE.red}" stroke-width="1.9" stroke-linejoin="round"/><path d="M0 -12.5V13.5" stroke="${LACQUER_PALETTE.bronze}" stroke-width="1.3" opacity=".75"/><circle cx="0" cy="-1.5" r="5.2" fill="url(#@boss)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1"/><path d="M-13.4 -14.3Q-5 -14.7 -.8 -19.4" fill="none" stroke="${LACQUER_PALETTE.bronzeL}" stroke-width="1.2" stroke-linecap="round"/></g>`
}

function renderAssassinIcon(translateX, translateY, rotation, bladeLength, flipHorizontal = !1) {
  return `<g transform="translate(${translateX} ${translateY}) rotate(${rotation})${flipHorizontal ? " scale(-1 1)" : ""}"><path d="M0 7V${bladeLength}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.4" stroke-linecap="round"/><path d="M0 7V${bladeLength}" stroke="${LACQUER_PALETTE.wood}" stroke-width="2.3" stroke-linecap="round"/><path d="M2 12Q10 11 10.500 3Q6.500 7 2 6.500Z" fill="${LACQUER_PALETTE.steel}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M0 -3L-2.800 7H2.800Z" fill="${LACQUER_PALETTE.steel}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/></g>`
}

function renderWarriorIcon(translateX, translateY, scale) {
  return `<g transform="translate(${translateX} ${translateY}) scale(${scale})"><path d="M-11.500 -2L-16 -13L-8.500 -7.500L-6.500 -16L-2.500 -8.500L0 -17.500L2.500 -8.500L6.500 -16L8.500 -7.500L16 -13L11.500 -2Z" fill="${LACQUER_PALETTE.hair}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.200" stroke-linejoin="round"/><ellipse cx="0" cy="1.500" rx="11.500" ry="8.500" fill="${LACQUER_PALETTE.skin}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.300"/><path d="M-11 -3.200Q0 -5.800 11 -3.200" fill="none" stroke="${LACQUER_PALETTE.red}" stroke-width="2.600"/><path d="M-10 -1.200L-2.600 2.600M10 -1.200L2.600 2.600" stroke="${LACQUER_PALETTE.hair}" stroke-width="2.700" stroke-linecap="round"/><ellipse cx="-5.600" cy="4" rx="2.900" ry="1.900" fill="#fff"/><circle cx="-4.900" cy="4" r="1.250" fill="${ICON_OUTLINE_COLOR}"/><ellipse cx="5.600" cy="4" rx="2.900" ry="1.900" fill="#fff"/><circle cx="4.900" cy="4" r="1.250" fill="${ICON_OUTLINE_COLOR}"/></g>`
}

const PANYUE_SKILL_ICONS = {
    passive: () =>
      buildIconSvg(
        heroIconPalette("panyue"),
        radialGlowDef("g", LACQUER_PALETTE.glow) + LACQUER_SHIELD_GRADIENT,
        `<ellipse cx="34" cy="51.500" rx="25" ry="6" fill="none" stroke="${LACQUER_PALETTE.bronze}" stroke-width="1.800" opacity=".85"/><ellipse cx="34" cy="51.500" rx="15.500" ry="3.600" fill="none" stroke="${LACQUER_PALETTE.glow}" stroke-width="1.100" opacity=".5"/>` +
          gradientCircle("g", 35, 50, 17) +
          renderOutlinedPath("M35 50L26 52.500L18 50.500L10 53M35 50L43 54L51 52L58 54.500M35 50L32 57L25 60M35 50L40 59.500", LACQUER_PALETTE.glow) +
          renderMageIcon("translate(30 28) rotate(-14)") +
          `<path d="M20 46L15.500 39.500L23 42.500Z" fill="${LACQUER_PALETTE.dust}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9" stroke-linejoin="round"/><path d="M48 46.500L53.500 41L52.500 48.500Z" fill="${LACQUER_PALETTE.dust}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9" stroke-linejoin="round"/><path d="${diamondPath(35.5, 49.5, 5.5, 0.14)}" fill="#fffdf2"/>` +
          renderBladeStrokes(41.5, 23, 3, LACQUER_PALETTE.bronze, LACQUER_PALETTE.hot),
      ),
    s1: () =>
      buildIconSvg(
        heroIconPalette("panyue"),
        radialGlowDef("g", LACQUER_PALETTE.glow) +
          LACQUER_SHIELD_GRADIENT +
          linearGradientDef("st", 1, 0, 19, 0, [
            [0, LACQUER_PALETTE.glow, 0],
            [1, LACQUER_PALETTE.hot, 0.95],
          ]),
        renderAssassinIcon(57, 13.5, 30, 42) +
          renderAssassinIcon(43.5, 8.5, -19, 46, !0) +
          '<path d="M3 21H18M0 32H15M4 43H18" fill="none" stroke="url(#@st)" stroke-width="2.800" stroke-linecap="round"/>' +
          gradientCircle("g", 42, 32, 16) +
          renderMageIcon("translate(27.500 32) rotate(11) skewY(-7) scale(.68 1.02)") +
          `<path d="M39.500 12.500Q49 32 39.500 51.500" fill="none" stroke="${LACQUER_PALETTE.hot}" stroke-width="2.300" stroke-linecap="round" opacity=".95"/><path d="M44 20Q49.500 32 44 44" fill="none" stroke="${LACQUER_PALETTE.glow}" stroke-width="1.300" stroke-linecap="round" opacity=".6"/><path d="${diamondPath(44.5, 32, 5.6, 0.14)}" fill="#fffdf2"/><path d="M52 22L56.500 19L55 25ZM53 41L57.500 43.500L52.500 45.500Z" fill="${LACQUER_PALETTE.bronzeL}"/>`,
      ),
    s2: () =>
      buildIconSvg(
        heroIconPalette("panyue"),
        radialGlowDef("g", LACQUER_PALETTE.glow) + LACQUER_SHIELD_GRADIENT,
        gradientCircle("g", 32, 34, 30) +
          `<circle cx="32" cy="34" r="27.500" fill="none" stroke="${LACQUER_PALETTE.glow}" stroke-width="1.500" stroke-dasharray="6 3.500" opacity=".6"/><circle cx="32" cy="34" r="23.500" fill="none" stroke="${LACQUER_PALETTE.bronze}" stroke-width="2.200" opacity=".9"/>` +
          renderWarriorIcon(32, 16, 0.9) +
          renderMageIcon("translate(32 39.500) scale(1.02 .92)"),
      ),
    ult: () =>
      buildIconSvg(
        heroIconPalette("panyue", !0),
        radialGlowDef("g", LACQUER_PALETTE.glow, 1) +
          LACQUER_SHIELD_GRADIENT +
          linearGradientDef("fall", 0, 0, 0, 24, [
            [0, LACQUER_PALETTE.hot, 0],
            [1, LACQUER_PALETTE.hot, 0.9],
          ]),
        `<ellipse cx="32" cy="54" rx="27" ry="6.500" fill="none" stroke="${LACQUER_PALETTE.bronze}" stroke-width="1.600" opacity=".7"/>` +
          gradientCircle("g", 32, 53, 21) +
          renderOutlinedPath("M32 53L22 50L13 54.500L4 51.500M32 53L26.500 59L18 61M32 53L42 56.500L51 52.500L60 55.500M32 53L38 61", LACQUER_PALETTE.glow, 1.9) +
          `<path d="M11 3V23M53 2V22M19.500 0V11M45 0V12" fill="none" stroke="url(#@fall)" stroke-width="2.400" stroke-linecap="round"/><path d="M46 19L55.500 6.500" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4" stroke-linecap="round"/><path d="M46 19L55.500 6.500" stroke="${LACQUER_PALETTE.steel}" stroke-width="1.900" stroke-linecap="round"/><path d="M17.500 31Q15 19.500 25 17L32 14L39 17Q49.500 19.500 46.500 31Z" fill="${LACQUER_PALETTE.dark}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.500" stroke-linejoin="round"/><path d="M17.500 31Q15 19.500 25 17" fill="none" stroke="${LACQUER_PALETTE.bronze}" stroke-width="1.200" stroke-linecap="round" opacity=".85"/>` +
          renderWarriorIcon(32, 11.5, 0.6) +
          renderMageIcon("translate(32 35) scale(.84)") +
          `<path d="${diamondPath(32, 53.5, 7, 0.14)}" fill="#fffdf2"/>`,
      ),
  },
  STEEL_PALETTE = {
    red: "#d2402a",
    deep: "#7c1f14",
    dark: "#1e1719",
    iron: "#4a4447",
    steel: "#c9ced6",
    edge: "#fff4e2",
    gold: "#e2a13a",
    goldL: "#ffd98a",
    glow: "#ff7a2a",
    hot: "#ffe7a3",
    wood: "#6b4a2e",
    heal: "#6fe3a1",
  },
  AXE_GRADIENT_DEF = linearGradientDef("ax", 1, 0, 23, 0, [
    [0, STEEL_PALETTE.iron],
    [0.45, "#8d9299"],
    [0.82, STEEL_PALETTE.steel],
    [1, STEEL_PALETTE.edge],
  ])

/**
 * 绘制图标。
 *
 * @param transform - 主要输入
 * @param weaponLength - 次要输入
 */
function renderRangerIcon(transform, weaponLength = 26) {
  const shaftMarkup =
    weaponLength > 0
      ? `<path d="M0 -10V${weaponLength}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5.600" stroke-linecap="round"/><path d="M0 -10V${weaponLength}" stroke="${STEEL_PALETTE.wood}" stroke-width="3.200" stroke-linecap="round"/><path d="M-1.600 5.500H1.600M-1.600 ${weaponLength - 4}H1.600" stroke="${STEEL_PALETTE.gold}" stroke-width="2.200"/>`
      : ""
  return (
    `<g transform="${transform}">` +
    shaftMarkup +
    `<path d="M-1.500 -13L-9.500 -8L-1.500 -2Z" fill="${STEEL_PALETTE.iron}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.200" stroke-linejoin="round"/><path d="M1 -15Q10 -15 16 -22Q27.500 -6.500 16 9Q10 2 1 1Z" fill="url(#@ax)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.500" stroke-linejoin="round"/><path d="M16 -22Q27.500 -6.500 16 9" fill="none" stroke="${STEEL_PALETTE.edge}" stroke-width="1.600" stroke-linecap="round"/><path d="M5.500 -10.500Q13 -7 5.500 -3.500" fill="none" stroke="${STEEL_PALETTE.gold}" stroke-width="1.400" stroke-linecap="round"/><rect x="-2.800" y="-16" width="5.600" height="18" rx="1.600" fill="${STEEL_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.100"/><path d="M0 -23.500L-2.600 -16H2.600Z" fill="${STEEL_PALETTE.steel}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M-2.600 2Q-7.500 7 -4.500 13Q-1 8 -.6 2Z" fill="${STEEL_PALETTE.red}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".8" stroke-linejoin="round"/></g>`
  )
}

const CHIJIN_SKILL_ICONS = {
    passive: () =>
      buildIconSvg(
        heroIconPalette("chijin"),
        radialGlowDef("g", STEEL_PALETTE.glow) + radialGlowDef("gh", STEEL_PALETTE.heal, 0.9) + AXE_GRADIENT_DEF,
        gradientCircle("g", 36, 22, 24) +
          renderRangerIcon("translate(22.500 34) rotate(-30) scale(1.160)", 21) +
          gradientCircle("gh", 48, 48, 13) +
          `<path d="M45.400 40H50.600V45.400H56V50.600H50.600V56H45.400V50.600H40V45.400H45.400Z" fill="#effff5" stroke="#12603a" stroke-width="1.400" stroke-linejoin="round"/><path d="M47 41.800H49V47H54.200" fill="none" stroke="${STEEL_PALETTE.heal}" stroke-width="1.300" stroke-linecap="round" stroke-linejoin="round"/><path d="${diamondPath(47.5, 13, 3.4)}" fill="${STEEL_PALETTE.edge}"/>`,
      ),
    s1: () =>
      buildIconSvg(
        heroIconPalette("chijin"),
        radialGlowDef("g", STEEL_PALETTE.glow) +
          AXE_GRADIENT_DEF +
          linearGradientDef("sw", 60, 0, 8, 0, [
            [0, STEEL_PALETTE.deep, 0],
            [0.35, STEEL_PALETTE.glow, 0.85],
            [0.8, STEEL_PALETTE.gold],
            [1, STEEL_PALETTE.edge],
          ]),
        gradientCircle("g", 22, 30, 22) +
          `<path d="M60 31.500A27.500 27.500 0 0 0 8 34.500L21 37.500A23 23 0 0 1 60 31.500Z" fill="url(#@sw)"/><path d="M48 18.500A27.500 27.500 0 0 0 8 34.500" fill="none" stroke="${STEEL_PALETTE.edge}" stroke-width="1.700" stroke-linecap="round"/><path d="M55 37Q44 28 30 31" fill="none" stroke="${STEEL_PALETTE.goldL}" stroke-width="1.200" stroke-linecap="round" opacity=".7"/>` +
          renderRangerIcon("translate(21 31) rotate(8) matrix(0 .8 .8 0 0 0)", 0) +
          renderBladeStrokes(38.5, 56, 1, STEEL_PALETTE.gold),
      ),
    s2: () =>
      buildIconSvg(
        heroIconPalette("chijin"),
        radialGlowDef("g", STEEL_PALETTE.glow) +
          AXE_GRADIENT_DEF +
          linearGradientDef("st", 0, 0, 30, 0, [
            [0, STEEL_PALETTE.glow, 0],
            [1, STEEL_PALETTE.hot, 0.95],
          ]),
        '<g transform="rotate(-9 32 32)">' +
          gradientCircle("g", 46, 30, 19) +
          `<path d="M0 17H24M-2 26.500H17M2 39H21" fill="none" stroke="url(#@st)" stroke-width="2.800" stroke-linecap="round"/><path d="M20 12Q34 8 46 13M22 47Q33 50 42 47" fill="none" stroke="${STEEL_PALETTE.goldL}" stroke-width="1.400" stroke-linecap="round" opacity=".75"/>` +
          renderRangerIcon("translate(37 28.500) rotate(90) scale(.9)", 30) +
          `<path d="${diamondPath(59.5, 28.5, 4)}" fill="#fffdf2"/></g>` +
          renderBladeStrokes(15, 55.5, 2, STEEL_PALETTE.gold),
      ),
    ult: () => {
      const swingArcMarkup = `<path d="M52.500 20A24 24 0 0 0 9.400 23.800L15.500 27A18.500 18.500 0 0 1 52.500 20Z" fill="url(#@sw)"/><path d="M41 9.800A24 24 0 0 0 9.400 23.800" fill="none" stroke="${STEEL_PALETTE.edge}" stroke-width="1.400" stroke-linecap="round"/>`,
        renderRangerIconResult = renderRangerIcon("translate(13 30.500) rotate(-70) matrix(0 .62 .62 0 0 0)", 0)
      return buildIconSvg(
        heroIconPalette("chijin", !0),
        radialGlowDef("g", STEEL_PALETTE.glow, 1) +
          AXE_GRADIENT_DEF +
          linearGradientDef("sw", 52, 0, 9, 0, [
            [0, STEEL_PALETTE.deep, 0],
            [0.4, STEEL_PALETTE.glow, 0.9],
            [0.85, STEEL_PALETTE.gold],
            [1, STEEL_PALETTE.edge],
          ]),
        gradientCircle("g", 32, 32, 30) +
          `<circle cx="32" cy="32" r="26.500" fill="none" stroke="${STEEL_PALETTE.hot}" stroke-width="1.100" stroke-dasharray="9 5" opacity=".65"/><g>${swingArcMarkup}${renderRangerIconResult}</g><g transform="rotate(180 32 32)">${swingArcMarkup}${renderRangerIconResult}</g><circle cx="32" cy="32" r="10.500" fill="${STEEL_PALETTE.dark}" fill-opacity=".55" stroke="${STEEL_PALETTE.gold}" stroke-width="1"/>` +
          renderBladeStrokes(26.1, 36.5, 3, STEEL_PALETTE.gold),
      )
    },
  },
  NIGHT_PALETTE = { indigo: "#3d4c9e", deep: "#161c48", moon: "#eef5ff", glow: "#a9d4ff", gold: "#ffd98a", goldD: "#b98a3a", wood: "#7a4a2c", woodL: "#c08a52", sand: "#e0c084", sandD: "#6c5634" }

function renderTankIcon(translateX, translateY, rotation, scale) {
  return `<g transform="translate(${translateX} ${translateY}) rotate(${rotation}) scale(${scale})"><path d="M-10 0H-30" stroke="${NIGHT_PALETTE.glow}" stroke-width="1.800" stroke-linecap="round" opacity=".5"/><path d="M14 0L5 -1.500Q3 -7.500 -4 -13.500Q-1.500 -6.500 -3 -1.700L-10 -2.400L-8 0L-10 2.400L-3 1.700Q-1.500 6.500 -4 13.500Q3 7.500 5 1.500Z" fill="#ffffff" stroke="${NIGHT_PALETTE.deep}" stroke-width="1.500" stroke-linejoin="round"/><path d="M14 0L10.500 -.7V.7Z" fill="${NIGHT_PALETTE.deep}"/></g>`
}

/**
 * 绘制图标。
 *
 * @param centerX - 主要输入
 * @param centerY - 次要输入
 * @param startRadius - 第三输入
 * @param endRadius - 第四输入
 * @param startAngle - 附加输入
 * @param spiralTurns - 附加输入
 */
function renderGuardIcon(centerX, centerY, startRadius, endRadius, startAngle, spiralTurns) {
  let total = ""
  for (let index = 0; index <= 30; index++) {
    const progress = index / 30,
      [pointX, pointY] = polarPoint(centerX, centerY, startRadius + (endRadius - startRadius) * progress, startAngle + spiralTurns * 360 * progress)
    total += `${index === 0 ? "M" : "L"}${pointX} ${pointY}`
  }
  return total
}

const XINGLI_SKILL_ICONS = {
    passive: () =>
      buildIconSvg(
        heroIconPalette("xingli"),
        radialGlowDef("g", NIGHT_PALETTE.glow) + radialGlowDef("gg", NIGHT_PALETTE.gold, 0.8),
        `<path d="M4 61L27 38" stroke="${NIGHT_PALETTE.gold}" stroke-width="1.300" stroke-linecap="round" opacity=".8"/>` +
          gradientCircle("g", 15, 50, 13) +
          gradientCircle("gg", 42, 23, 17) +
          `<path d="${arcPath(15, 50, 13, 281, 354)}" fill="none" stroke="${NIGHT_PALETTE.moon}" stroke-width="2.800" stroke-linecap="round"/><path d="${arcPath(15, 50, 24.5, 280, 355)}" fill="none" stroke="${NIGHT_PALETTE.glow}" stroke-width="3.300" stroke-linecap="round"/><path d="${arcPath(15, 50, 37, 279, 356)}" fill="none" stroke="#3a2a08" stroke-width="6.400" stroke-linecap="round" opacity=".55"/><path d="${arcPath(15, 50, 37, 279, 356)}" fill="none" stroke="${NIGHT_PALETTE.gold}" stroke-width="4.200" stroke-linecap="round"/><path d="${arcPath(15, 50, 37, 290, 345)}" fill="none" stroke="#fffdf2" stroke-width="1.200" stroke-linecap="round" opacity=".9"/><circle cx="15" cy="50" r="3.600" fill="#ffffff" stroke="${NIGHT_PALETTE.goldD}" stroke-width="1.200"/><circle cx="50.500" cy="16" r="1.500" fill="${NIGHT_PALETTE.gold}"/><circle cx="55" cy="29" r="1.100" fill="#fffdf2"/>`,
      ),
    s1: () =>
      buildIconSvg(
        heroIconPalette("xingli"),
        radialGlowDef("g", NIGHT_PALETTE.glow, 1) +
          linearGradientDef("ln", 22, 0, 66, 0, [
            [0, NIGHT_PALETTE.gold],
            [0.3, "#ffffff"],
            [1, NIGHT_PALETTE.glow],
          ]) +
          linearGradientDef("nk", 0, 28, 0, 36, [
            [0, NIGHT_PALETTE.woodL],
            [1, NIGHT_PALETTE.wood],
          ]),
        `<g transform="rotate(-45 32 32)"><path d="M46 23.500Q46 18 51.500 18.500Q54 13.500 59 17Q64 16 64 22Q66 25.500 62 26.500H48.500Q45.500 26.500 46 23.500Z" fill="${NIGHT_PALETTE.moon}" fill-opacity=".42" stroke="${NIGHT_PALETTE.glow}" stroke-width="1.100" stroke-linejoin="round"/><path d="M44 40.500Q44 46 49.500 45.500Q52 50.500 57 47Q62 48 62 42Q64 38.500 60 37.500H46.500Q43.500 37.500 44 40.500Z" fill="${NIGHT_PALETTE.moon}" fill-opacity=".42" stroke="${NIGHT_PALETTE.glow}" stroke-width="1.100" stroke-linejoin="round"/><path d="M26 32H70" stroke="${NIGHT_PALETTE.glow}" stroke-width="8" stroke-linecap="round" opacity=".32"/><path d="M34 25.500Q38 32 34 38.500M41 27Q44.500 32 41 37" fill="none" stroke="${NIGHT_PALETTE.moon}" stroke-width="1.500" stroke-linecap="round" opacity=".85"/><path d="M-6 32H70" stroke="url(#@ln)" stroke-width="3" stroke-linecap="round"/>` +
          gradientCircle("g", 54, 32, 10) +
          `<path d="M46 32L54 29.300L66 32L54 34.700Z" fill="#ffffff"/><path d="M8 28.500L4.500 19.500M17 28.500L13.500 19.500M11 35.500L7.500 44.500M20 35.500L16.500 44.500" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.200" stroke-linecap="round"/><path d="M8 28.500L4.500 19.500M17 28.500L13.500 19.500M11 35.500L7.500 44.500M20 35.500L16.500 44.500" stroke="${NIGHT_PALETTE.woodL}" stroke-width="2.200" stroke-linecap="round"/><circle cx="4.200" cy="18.800" r="2.400" fill="${NIGHT_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9"/><circle cx="13.200" cy="18.800" r="2.400" fill="${NIGHT_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9"/><circle cx="7.200" cy="45.200" r="2.400" fill="${NIGHT_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9"/><circle cx="16.200" cy="45.200" r="2.400" fill="${NIGHT_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9"/><path d="M-6 28H22Q30.500 25.500 31 32Q30.500 38.500 22 36H-6Z" fill="url(#@nk)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.400" stroke-linejoin="round"/><path d="M24 29.200Q28.300 29.500 28.300 32Q28.300 34.500 24 34.800" fill="none" stroke="${NIGHT_PALETTE.gold}" stroke-width="1.400" stroke-linecap="round"/><path d="M-6 32H24" stroke="#fffdf2" stroke-width="1.300" stroke-linecap="round"/></g>`,
      ),
    s2: () => {
      const renderSpoke = (angleDegrees) => {
        const [outerX, outerY] = polarPoint(32, 32, 27, angleDegrees - 16),
          [innerX, innerY] = polarPoint(32, 32, 17.5, angleDegrees)
        return `<path d="M${outerX} ${outerY}L${innerX} ${innerY}" stroke="${NIGHT_PALETTE.gold}" stroke-width="1.700" stroke-linecap="round" opacity=".75"/><circle cx="${innerX}" cy="${innerY}" r="2.900" fill="${NIGHT_PALETTE.gold}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".9"/>`
      }
      return buildIconSvg(
        heroIconPalette("xingli"),
        radialGlowDef("g", NIGHT_PALETTE.glow, 1) +
          radialGradientDef("sp", 32, 32, 26, [
            [0.15, "#ffffff"],
            [0.6, NIGHT_PALETTE.glow],
            [1, NIGHT_PALETTE.indigo, 0.5],
          ]),
        `<circle cx="32" cy="32" r="26.500" fill="none" stroke="${NIGHT_PALETTE.glow}" stroke-width="1.300" stroke-dasharray="2 4" opacity=".7"/><path d="${renderGuardIcon(32, 32, 24, 6, 200, 1.35)}" fill="none" stroke="url(#@sp)" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/><path d="${renderGuardIcon(32, 32, 24, 6, 20, 1.35)}" fill="none" stroke="url(#@sp)" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/>` +
          [50, 140, 230, 320].map(renderSpoke).join("") +
          gradientCircle("g", 32, 32, 13) +
          `<circle cx="32" cy="32" r="4.200" fill="#ffffff" stroke="${NIGHT_PALETTE.goldD}" stroke-width="1.200"/>`,
      )
    },
    ult: () =>
      buildIconSvg(
        heroIconPalette("xingli", !0),
        radialGlowDef("g", NIGHT_PALETTE.moon, 0.8) +
          radialGradientDef("mo", 39, 15, 16, [
            [0, "#ffffff"],
            [0.7, "#e3eeff"],
            [1, "#b9cdf5"],
          ]) +
          linearGradientDef("sd", 0, 44, 0, 64, [
            [0, NIGHT_PALETTE.sand],
            [1, NIGHT_PALETTE.sandD],
          ]) +
          linearGradientDef("sd2", 0, 40, 0, 60, [
            [0, "#8f7a52"],
            [1, "#3b3020"],
          ]),
        gradientCircle("g", 42, 18, 24) +
          `<circle cx="42" cy="18" r="12.500" fill="url(#@mo)" stroke="${NIGHT_PALETTE.deep}" stroke-width=".8"/><path d="M0 50Q14 40 30 45Q46 50 64 41V64H0Z" fill="url(#@sd2)"/><path d="M0 58Q18 45 36 52Q50 57 64 49V64H0Z" fill="url(#@sd)"/><path d="M0 58Q18 45 36 52Q50 57 64 49" fill="none" stroke="#fff3cf" stroke-width="1.300" stroke-linecap="round" opacity=".9"/><ellipse cx="22" cy="55.500" rx="12" ry="2.400" fill="${NIGHT_PALETTE.moon}" opacity=".3"/>` +
          renderTankIcon(48.5, 21.5, 142, 0.6) +
          renderTankIcon(34, 32.5, 142, 0.76) +
          renderTankIcon(19, 43.5, 142, 0.64),
      ),
  },
  FOREST_PALETTE = {
    teal: "#3fae8c",
    deep: "#12403f",
    ink: "#0b2422",
    cream: "#f6f3e6",
    gold: "#e9c46a",
    mint: "#9df5d2",
    leather: "#8a5a36",
    skin: "#dba87e",
    bow: "#2a262c",
    stoneL: "#c5ccd2",
    stone: "#8c959d",
    stoneD: "#555e67",
    grass: "#4fbf8f",
    grassD: "#1d6b58",
  },
  FENGLING_ARROW_PATH = `<path d="M0 -22V-12" stroke="${FOREST_PALETTE.mint}" stroke-width="1.100" stroke-linecap="round" opacity=".55"/><path d="M0 -12V5" stroke="${FOREST_PALETTE.cream}" stroke-width="1.900" stroke-linecap="round"/><path d="M-2.600 -13L0 -10L2.600 -13M-2.600 -10L0 -7L2.600 -10" fill="none" stroke="#ffffff" stroke-width="1.200" stroke-linecap="round" stroke-linejoin="round"/><path d="M-3.400 3L0 11.500L3.400 3L0 5.200Z" fill="#ffffff" stroke="${FOREST_PALETTE.ink}" stroke-width=".7" stroke-linejoin="round"/>`

/**
 * 绘制图标。
 *
 * @param translateX - 主要输入
 * @param translateY - 次要输入
 * @param scale - 第三输入
 * @returns 数值结果
 */
function renderSupportIcon(translateX, translateY, scale) {
  const renderLeaf = (offsetX, width, heightScale, leafColor) =>
    `<path d="M${translateX + offsetX - 1.6} ${translateY}Q${translateX + offsetX + width * 0.3} ${translateY - scale * heightScale * 0.6} ${translateX + offsetX + width} ${translateY - scale * heightScale}Q${translateX + offsetX + width * 0.5 + 1.4} ${translateY - scale * heightScale * 0.5} ${translateX + offsetX + 1.6} ${translateY}Z" fill="${leafColor}"/>`
  return renderLeaf(-4, -5, 0.75, FOREST_PALETTE.grassD) + renderLeaf(4.5, 5, 0.85, FOREST_PALETTE.grassD) + renderLeaf(0, 1.5, 1, FOREST_PALETTE.grass) + renderLeaf(-2, -3, 0.6, FOREST_PALETTE.grass)
}

const FENGLING_SKILL_ICONS = {
    passive: () => {
      let total = ""
      for (let index = 0; index < 5; index++) {
        const bladeX = 17.5 + index * 6.6,
          bladeLength = 4.5 + index * 2.1,
          bladePath = `M${bladeX} 58L${Math.round((bladeX + bladeLength * 0.42) * 10) / 10} ${58 - bladeLength}`
        total += `<path d="${bladePath}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.200" stroke-linecap="round"/><path d="${bladePath}" stroke="${index === 4 ? FOREST_PALETTE.gold : FOREST_PALETTE.cream}" stroke-width="2.200" stroke-linecap="round"/>`
      }
      return buildIconSvg(
        heroIconPalette("fengling"),
        radialGlowDef("g", FOREST_PALETTE.mint),
        '<g transform="rotate(-10 32 26)">' +
          gradientCircle("g", 46, 25, 17) +
          `<path d="M-2 39.500L14.500 27.500L18.500 32.500L1 46.500Z" fill="${FOREST_PALETTE.skin}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.300" stroke-linejoin="round"/><path d="M3.500 36L9.500 31.500L13.500 36.500L7.500 41Z" fill="${FOREST_PALETTE.leather}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M40 6.500L17.500 25L40 43.500" fill="none" stroke="${FOREST_PALETTE.cream}" stroke-width="1.200" stroke-linejoin="round"/><path d="M40 6.500Q50.500 13.500 47.500 25Q50.500 36.500 40 43.500" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5.800" stroke-linecap="round"/><path d="M40 6.500Q50.500 13.500 47.500 25Q50.500 36.500 40 43.500" fill="none" stroke="${FOREST_PALETTE.bow}" stroke-width="3.400" stroke-linecap="round"/><path d="M41.500 8.500Q49.500 15 46.800 24" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width=".9" stroke-linecap="round" opacity=".8"/><path d="M47.300 21.500V28.500" stroke="${FOREST_PALETTE.gold}" stroke-width="4.600"/><circle cx="40" cy="6.500" r="1.900" fill="${FOREST_PALETTE.gold}"/><circle cx="40" cy="43.500" r="1.900" fill="${FOREST_PALETTE.gold}"/><path d="M17.500 25H56" stroke="${ICON_OUTLINE_COLOR}" stroke-width="3.400" stroke-linecap="round"/><path d="M17.500 25H56" stroke="${FOREST_PALETTE.cream}" stroke-width="1.700" stroke-linecap="round"/><path d="M54 21.200L62.500 25L54 28.800L56 25Z" fill="#ffffff" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M21.500 24.300L24 20.800H30.500L28 24.300ZM21.500 25.700L24 29.200H30.500L28 25.700Z" fill="#ffffff" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".8" stroke-linejoin="round"/><circle cx="17" cy="26.500" r="3.900" fill="${FOREST_PALETTE.skin}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.300"/></g>` +
          total,
      )
    },
    s1: () =>
      buildIconSvg(
        heroIconPalette("fengling"),
        radialGlowDef("g", FOREST_PALETTE.mint) +
          linearGradientDef("rk", 28, 20, 58, 56, [
            [0, FOREST_PALETTE.stoneL],
            [0.5, FOREST_PALETTE.stone],
            [1, FOREST_PALETTE.stoneD],
          ]),
        renderSupportIcon(9, 60, 15) +
          renderSupportIcon(22, 62, 11) +
          `<path d="M29 56L26 39L34 25.500L49.500 20.500L60 30L62 48L53 57.500Z" fill="url(#@rk)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.600" stroke-linejoin="round"/><path d="M26 39L34 25.500L49.500 20.500L44.500 32L33 37Z" fill="#dfe5ea" opacity=".85"/><path d="M49.500 20.500L60 30L62 48L48 45L44.500 32Z" fill="${FOREST_PALETTE.stoneD}" opacity=".55"/>` +
          gradientCircle("g", 38.5, 36, 12) +
          `<path d="M38.500 36L45 31.500L50.500 33.500M38.500 36L44 42L43 49.500M38.500 36L47.500 39.500L54.500 45.500M38.500 36L34.500 44.500L37 51M38.500 36L37 29.500" fill="none" stroke="#0b1210" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M38.500 36L45 31.500L50.500 33.500M38.500 36L44 42L43 49.500M38.500 36L47.500 39.500L54.500 45.500M38.500 36L34.500 44.500L37 51M38.500 36L37 29.500" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width="1.100" stroke-linejoin="round" stroke-linecap="round"/><g transform="translate(38.500 36) rotate(40)"><path d="M-37 0H-1" stroke="${ICON_OUTLINE_COLOR}" stroke-width="3.800" stroke-linecap="round"/><path d="M-37 0H-1" stroke="${FOREST_PALETTE.cream}" stroke-width="2" stroke-linecap="round"/><path d="M-39 -.6L-37.500 -6.200L-32.500 -4.200L-31.500 -7L-23.500 -5L-18.500 -.6Z" fill="#ffffff" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M-39 .6L-37.500 6.200L-32.500 4.200L-31.500 7L-23.500 5L-18.500 .6Z" fill="#e3ede6" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/><path d="M-35 -4.500L-33 0L-35 4.500M-28.500 -5L-26.500 0L-28.500 5M-24.500 -4L-22.500 0L-24.500 4" fill="none" stroke="${FOREST_PALETTE.deep}" stroke-width=".8" opacity=".55"/><path d="M-17 0H-13" stroke="${FOREST_PALETTE.gold}" stroke-width="2.200"/></g><path d="M30 27L26.500 22L32.500 23.500ZM43 26.500L44.500 21L47.500 26ZM28.500 45L23.500 46.500L27 50Z" fill="${FOREST_PALETTE.stoneL}" stroke="${ICON_OUTLINE_COLOR}" stroke-width=".8" stroke-linejoin="round"/><path d="${diamondPath(38.5, 36, 4.2)}" fill="#ffffff"/>`,
      ),
    s2: () => {
      const m3723Q33500292650031M2650031L1750027L1150032500M2650031L2037500L1237M3624L4550021500M3624L3950027500 = "M37 23Q33.500 29 26.500 31M26.500 31L17.500 27L11.500 32.500M26.500 31L20 37.500L12 37M36 24L45.500 21.500M36 24L39.500 27.500"
      return buildIconSvg(
        heroIconPalette("fengling"),
        radialGlowDef("g", FOREST_PALETTE.mint) + radialGlowDef("gg", FOREST_PALETTE.gold, 1),
        `<path d="M7 53.500Q31 37 56 52" fill="none" stroke="${FOREST_PALETTE.gold}" stroke-width="1.800" stroke-linecap="round" stroke-dasharray="1 4"/><path d="M53.500 47.500L59.500 53.500L51.500 54.500Z" fill="${FOREST_PALETTE.gold}"/><g transform="rotate(-14 32 28)">` +
          gradientCircle("g", 30, 26, 22) +
          `<path d="M2 20H12M0 28H9M4 36H11" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width="1.600" stroke-linecap="round" opacity=".6"/><path d="M35 21.500Q25 14 14 17.500Q22 21.500 28 28.500Z" fill="${FOREST_PALETTE.teal}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.100" stroke-linejoin="round"/><path d="${m3723Q33500292650031M2650031L1750027L1150032500M2650031L2037500L1237M3624L4550021500M3624L3950027500}" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width="6.400" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39" cy="18.500" r="5" fill="${FOREST_PALETTE.mint}"/><path d="${m3723Q33500292650031M2650031L1750027L1150032500M2650031L2037500L1237M3624L4550021500M3624L3950027500}" fill="none" stroke="${FOREST_PALETTE.ink}" stroke-width="4.200" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39" cy="18.500" r="3.900" fill="${FOREST_PALETTE.ink}"/><path d="M40.500 14.800L45.500 9M38.500 14.600L41 8" stroke="${FOREST_PALETTE.cream}" stroke-width="1.300" stroke-linecap="round"/><path d="M46 8.500L41.500 21.500L46 35" fill="none" stroke="${FOREST_PALETTE.cream}" stroke-width="1" stroke-linejoin="round"/><path d="M46 8.500Q54 15 51.500 21.500Q54 28.500 46 35" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.600" stroke-linecap="round"/><path d="M46 8.500Q54 15 51.500 21.500Q54 28.500 46 35" fill="none" stroke="${FOREST_PALETTE.bow}" stroke-width="2.600" stroke-linecap="round"/><path d="M41.500 21.500H58" stroke="${FOREST_PALETTE.cream}" stroke-width="1.600" stroke-linecap="round"/>` +
          gradientCircle("gg", 59.5, 21.5, 8) +
          `<path d="${diamondPath(59.5, 21.5, 5.4, 0.14)}" fill="#fff6dc"/></g>`,
      )
    },
    ult: () => {
      const arrowPlacements = [
        [12, 22, 0.8],
        [25, 13, 0.95],
        [38.5, 24, 1.1],
        [52, 15, 0.8],
        [21, 40, 0.95],
        [49, 40.5, 1],
        [35, 45, 0.75],
      ]
      return buildIconSvg(
        heroIconPalette("fengling", !0),
        radialGlowDef("g", FOREST_PALETTE.mint, 0.75) +
          linearGradientDef("mt", 0, 24, 0, 50, [
            [0, "#1d5e5a"],
            [1, "#0a2624"],
          ]),
        `<path d="M0 41L8 33.500L14.500 38L25 26.500L33 35.500L41 30L50 37.500L57 32.500L64 38V64H0Z" fill="url(#@mt)"/><path d="M0 41L8 33.500L14.500 38L25 26.500L33 35.500L41 30L50 37.500L57 32.500L64 38" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width="1.400" stroke-linejoin="round" opacity=".9"/><ellipse cx="32" cy="54" rx="26" ry="6.800" fill="url(#@g)"/><ellipse cx="32" cy="54" rx="25" ry="6.500" fill="none" stroke="${FOREST_PALETTE.mint}" stroke-width="1.700"/><ellipse cx="32" cy="54" rx="15" ry="3.600" fill="none" stroke="${FOREST_PALETTE.gold}" stroke-width="1.100" opacity=".8"/>` +
          arrowPlacements.map(([arrowX, arrowY, arrowScale]) => `<g transform="translate(${arrowX} ${arrowY}) rotate(18) scale(${arrowScale})">${FENGLING_ARROW_PATH}</g>`).join("") +
          '<path d="M17 55.500H23M43 56H49M31 58H36" stroke="#ffffff" stroke-width="1.200" stroke-linecap="round" opacity=".8"/>',
      )
    },
  },
  HUD_THEME_COLORS = {
    ink: "#0e0a16",
    dark: "#1c1630",
    mid: "#4d3f86",
    accent: "#b48cff",
    glow: "#a886ff",
    steel: "#e8f0ff",
    cyan: "#bfe9e2",
    pale: "#e3d4ff",
    hp: "#f0584f",
    paper: "#e6d6a8",
    paperD: "#a58c56",
    map: "#5a4630",
  },
  DAGGER_GRADIENT_DEF = linearGradientDef("dg", 0, -4, 0, 4, [
    [0, "#ffffff"],
    [0.5, HUD_THEME_COLORS.steel],
    [0.5, "#b4c2e4"],
    [1, "#8794c8"],
  ])

function svgTransform(transform, showHilt = !0) {
  const hiltMarkup = showHilt
    ? `<path d="M-3 -1.900H-12.500V1.900H-3Z" fill="${HUD_THEME_COLORS.dark}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1"/><path d="M-5.300 -1.900V1.900M-7.800 -1.900V1.900M-10.300 -1.900V1.900" stroke="${HUD_THEME_COLORS.accent}" stroke-width=".9"/><circle cx="-15.300" cy="0" r="2.700" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="3"/><circle cx="-15.300" cy="0" r="2.700" fill="none" stroke="${HUD_THEME_COLORS.cyan}" stroke-width="1.400"/><path d="M-.5 -6.500Q-2.600 0 -.5 6.500L-3.200 6.500Q-5.300 0 -3.200 -6.500Z" fill="${HUD_THEME_COLORS.accent}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/>`
    : ""
  return (
    `<g transform="${transform}"><path d="M22 0Q10 -5.200 -.5 -3.700V3.700Q10 5.200 22 0Z" fill="url(#@dg)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.200" stroke-linejoin="round"/><path d="M1 0H20" stroke="#ffffff" stroke-width=".8" stroke-linecap="round" opacity=".9"/>` +
    hiltMarkup +
    "</g>"
  )
}

const YEQUE_SKILL_ICONS = {
    passive: () =>
      buildIconSvg(
        heroIconPalette("yeque"),
        radialGlowDef("g", HUD_THEME_COLORS.glow) +
          radialGlowDef("gr", HUD_THEME_COLORS.hp, 0.9) +
          DAGGER_GRADIENT_DEF +
          linearGradientDef("hp", 0, 45, 0, 54, [
            [0, "#ffb8a8"],
            [0.4, HUD_THEME_COLORS.hp],
            [1, "#a8222d"],
          ]),
        gradientCircle("g", 38, 24, 22) +
          gradientCircle("gr", 18, 49.5, 13) +
          `<rect x="8.500" y="44.500" width="47" height="10" rx="3.200" fill="#07050c" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.400"/><rect x="8.500" y="44.500" width="47" height="10" rx="3.200" fill="none" stroke="${HUD_THEME_COLORS.pale}" stroke-width="1" opacity=".55"/><rect x="10.200" y="46.200" width="14.500" height="6.600" rx="1.800" fill="url(#@hp)"/><path d="M27.400 45.500V53.500" stroke="${HUD_THEME_COLORS.pale}" stroke-width="1.100" stroke-dasharray="1.600 1.400"/>` +
          svgTransform("translate(38.500 26.500) rotate(135) scale(1.080)") +
          `<path d="${diamondPath(21.5, 43, 4, 0.14)}" fill="#ffffff"/>`,
      ),
    s1: () =>
      buildIconSvg(
        heroIconPalette("yeque"),
        radialGlowDef("g", HUD_THEME_COLORS.glow, 1) + DAGGER_GRADIENT_DEF,
        `<path d="M5 31Q21 24 33 11.500" fill="none" stroke="${HUD_THEME_COLORS.steel}" stroke-width="1.500" stroke-linecap="round" opacity=".7"/><path d="M24 59Q42 51 57 36" fill="none" stroke="${HUD_THEME_COLORS.steel}" stroke-width="1.500" stroke-linecap="round" opacity=".7"/><path d="M2.500 55.500Q5 47.500 13.500 44.500Q29 38 41.500 23L47 28.500Q34 45 17 55Q8 60.500 2.500 55.500Z" fill="${HUD_THEME_COLORS.ink}" stroke="${HUD_THEME_COLORS.accent}" stroke-width="1.100" stroke-linejoin="round"/><path d="M6 53.500Q14 50 22 44.500M9.500 57Q19 53 28 46" fill="none" stroke="${HUD_THEME_COLORS.mid}" stroke-width="1.100" stroke-linecap="round"/><circle cx="7" cy="44" r="1.700" fill="${HUD_THEME_COLORS.ink}" stroke="${HUD_THEME_COLORS.accent}" stroke-width=".6"/><circle cx="25" cy="57.500" r="1.300" fill="${HUD_THEME_COLORS.ink}" stroke="${HUD_THEME_COLORS.accent}" stroke-width=".6"/><circle cx="33" cy="48" r="1" fill="${HUD_THEME_COLORS.ink}"/>` +
          gradientCircle("g", 54, 14, 13) +
          svgTransform("translate(41 27.500) rotate(-44) scale(.98 1.150)", !1) +
          `<path d="${diamondPath(56.5, 12, 5.5, 0.14)}" fill="#ffffff"/>`,
      ),
    s2: () => {
      const renderFanBlade = (angleDegrees, radius, scale) => {
        const [daggerX, daggerY] = polarPoint(9, 56, radius, angleDegrees),
          [triangleX1, triangleY1] = polarPoint(9, 56, radius - 14, angleDegrees - 7),
          [triangleX2, triangleY2] = polarPoint(9, 56, radius - 14, angleDegrees + 7)
        return `<path d="M9 56L${triangleX1} ${triangleY1}L${triangleX2} ${triangleY2}Z" fill="url(#@tr)"/>` + svgTransform(`translate(${daggerX} ${daggerY}) rotate(${angleDegrees}) scale(${scale})`)
      }
      return buildIconSvg(
        heroIconPalette("yeque"),
        radialGlowDef("g", HUD_THEME_COLORS.glow, 0.9) +
          DAGGER_GRADIENT_DEF +
          radialGradientDef("tr", 9, 56, 34, [
            [0, HUD_THEME_COLORS.accent, 0.85],
            [1, HUD_THEME_COLORS.accent, 0],
          ]),
        gradientCircle("g", 36, 30, 26) + renderFanBlade(-70, 32, 0.8) + renderFanBlade(-16, 32, 0.8) + renderFanBlade(-43, 36, 0.95) + `<circle cx="9" cy="56" r="2.600" fill="${HUD_THEME_COLORS.pale}"/>`,
      )
    },
    ult: () =>
      buildIconSvg(
        heroIconPalette("yeque", !0),
        radialGlowDef("g", HUD_THEME_COLORS.steel, 0.9) +
          DAGGER_GRADIENT_DEF +
          linearGradientDef("pp", 0, 24, 0, 48, [
            [0, "#f6ecc8"],
            [0.6, HUD_THEME_COLORS.paper],
            [1, HUD_THEME_COLORS.paperD],
          ]) +
          linearGradientDef("rl", 0, 20, 0, 52, [
            [0, "#f3e6bd"],
            [0.5, HUD_THEME_COLORS.paperD],
            [1, "#6b5630"],
          ]),
        `<g transform="rotate(-13 32 36)"><path d="M10 25H47V48H10Z" fill="url(#@pp)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.400" stroke-linejoin="round"/><path d="M15 39L20 31.500L24 36.500L29.500 29.500L34.500 37.500" fill="none" stroke="${HUD_THEME_COLORS.map}" stroke-width="1.400" stroke-linejoin="round" stroke-linecap="round"/><path d="M14.500 43.500Q21 40 27 43.500T39.500 42.500" fill="none" stroke="#3f6f96" stroke-width="1.300" stroke-linecap="round"/><rect x="37.500" y="28.500" width="5" height="5" rx=".8" fill="#b8323a"/><rect x="4" y="21" width="9" height="31" rx="4.500" fill="url(#@rl)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.400"/><path d="M8.500 17.500V21M8.500 52V55.500" stroke="${HUD_THEME_COLORS.dark}" stroke-width="4.200" stroke-linecap="round"/><path d="M8.500 17.500V21M8.500 52V55.500" stroke="${HUD_THEME_COLORS.accent}" stroke-width="1.600" stroke-linecap="round"/></g>` +
          gradientCircle("g", 50, 24, 17) +
          svgTransform("translate(39.500 35) rotate(-40) scale(1.060)") +
          `<g transform="rotate(-13 32 36)"><path d="M41 24.500Q52 22 51.500 34Q51 46 41 48.500Q45.500 42 45.500 36.500Q45.500 30.500 41 24.500Z" fill="url(#@rl)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.400" stroke-linejoin="round"/></g><path d="${diamondPath(56.5, 20.5, 5, 0.14)}" fill="#ffffff"/>`,
      ),
  },
  SKILL_ICON_TABLE = { panyue: PANYUE_SKILL_ICONS, chijin: CHIJIN_SKILL_ICONS, xingli: XINGLI_SKILL_ICONS, fengling: FENGLING_SKILL_ICONS, yeque: YEQUE_SKILL_ICONS }

function ICON_FRAME_KINDS(heroKey, skillSlot) {
  return SKILL_ICON_TABLE[heroKey][skillSlot]()
}

const BASIC_SPELL_ICONS = {
  recall: () =>
    buildIconSvg(
      ["#3c86e6", "#143a86", "#050d26"],
      radialGlowDef("g", "#8fe9ff", 0.9) +
        linearGradientDef("bm", 0, 4, 0, 52, [
          [0, "#c9f6ff", 0],
          [1, "#5cd6f7", 0.55],
        ]),
      '<path d="M21 51L26.5 4H37.5L43 51Z" fill="url(#@bm)"/><ellipse cx="32" cy="51" rx="23" ry="6.6" fill="url(#@g)"/><ellipse cx="32" cy="51" rx="22" ry="6.3" fill="none" stroke="#8fe9ff" stroke-width="2"/><ellipse cx="32" cy="42" rx="15.5" ry="4.5" fill="none" stroke="#8fe9ff" stroke-width="1.6" opacity=".8"/><ellipse cx="32" cy="34" rx="10.5" ry="3" fill="none" stroke="#c9f6ff" stroke-width="1.3" opacity=".6"/>' +
        gradientCircle("g", 32, 24, 18) +
        `<path d="M32 5L40.5 24L32 46L23.5 24Z" fill="#2f8fd8" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.3" stroke-linejoin="round"/><path d="M32 5L23.5 24L32 28.5Z" fill="#f2feff"/><path d="M32 5L40.5 24L32 28.5Z" fill="#9aeaff"/><path d="M23.5 24L32 28.5V46Z" fill="#5cd6f7"/><path d="M11 31L15.5 25.5L20 31M11 38.5L15.5 33L20 38.5M44 31L48.5 25.5L53 31M44 38.5L48.5 33L53 38.5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`,
    ),
  heal: () =>
    buildIconSvg(
      ["#46c98a", "#14744a", "#04241a"],
      radialGlowDef("g", "#c9ffe0", 0.9) +
        linearGradientDef("pl", 0, 14, 0, 50, [
          [0, "#ffffff"],
          [1, "#9dffc8"],
        ]),
      gradientCircle("g", 32, 32, 28) +
        `<path d="${arcPath(32, 32, 24, 205, 335)}" fill="none" stroke="#c9ffe0" stroke-width="3.2" stroke-linecap="round"/><path d="M57.5 20.5L55.5 30.5L47.5 24Z" fill="#c9ffe0"/><path d="${arcPath(32, 32, 24, 25, 155)}" fill="none" stroke="#8fd8ff" stroke-width="3.2" stroke-linecap="round"/><path d="M6.5 43.5L8.5 33.5L16.5 40Z" fill="#8fd8ff"/><path d="M27 16H37V27H48V37H37V48H27V37H16V27H27Z" fill="url(#@pl)" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1.4" stroke-linejoin="round"/><path d="M29.5 18.5H34.5V29.5H45.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="M51 9V15M48 12H54M12 49V55M9 52H15" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>`,
    ),
  flash: () =>
    buildIconSvg(
      ["#f5b84a", "#a25f17", "#2a1405"],
      radialGlowDef("g", "#fff6dc", 1) +
        linearGradientDef("st", 14, 48, 46, 18, [
          [0, "#ffffff", 0],
          [1, "#ffffff", 0.95],
        ]),
      '<path d="M16 37L24.5 48L16 59L7.5 48Z" fill="#ffffff" fill-opacity=".1" stroke="#fff6dc" stroke-width="1.5" stroke-dasharray="2.6 2.4" stroke-linejoin="round" opacity=".8"/><path d="M13 43.5L44 15.5L48 20L19.5 50Z" fill="url(#@st)"/><path d="M9 36L33 14M24 54L51 30" stroke="#fff6dc" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>' +
        gradientCircle("g", 45, 19, 19) +
        `<path d="${diamondPath(45, 19, 16, 0.13)}" fill="#ffffff"/><path d="${diamondPath(45, 19, 10, 0.16)}" transform="rotate(45 45 19)" fill="#fff3cf"/><circle cx="45" cy="19" r="3.8" fill="#ffffff"/><path d="${diamondPath(52, 46, 3)}" fill="#fff6dc"/><circle cx="24" cy="14" r="1.2" fill="#fff6dc"/>`,
    ),
}

function renderIconFrame(spellKey) {
  return BASIC_SPELL_ICONS[spellKey]()
}

export { mixColor, formatBriefStats, KILL_FEED_LABELS, lightenColor, ICON_FRAME_KINDS, round2, BASIC_SKILL_SPECS, renderIconFrame, makeSvgIcon, darkenColor, radialGradientDef, gradientCircle, polarPoint, describeSkillShape, SKILL_ICON_TABLE, describeSkillRange, buildIconSvg, extractStatLabels, linearGradientDef, diamondPath, radialGlowDef, EVENT_PRIORITIES, EQUIP_SLOT_NAMES, SKILL_EFFECT_COLORS, ICON_OUTLINE_COLOR }