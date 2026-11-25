/**
 * 应用启动与性能统计：bootApp + FrameStats/StatsCollector/finishBoot 闭包
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { Color, WebGLRenderer } from 'three'
import { HERO_IDS, HERO_TABLE } from '../../heroes/registry'
import { Animator, drawPortraitFallback, createPreviewStage, configurePreviewRenderer, heroModelKey, PORTRAIT_CAMERA_PARAMS, createHeroPreview, getOrBuildModel } from '../render/hero-preview'
import { OutlineRegistry } from '../render/scene-rigs'
import { __heroRow } from '../ui/banner'
import { createMaterialState } from '../render/foundation'
import { ARENA_PALETTE } from '../arena-palette'
import { getStoredSetting, setStoredSetting } from '../ui/hud-root'
import { MINIMAP_TUNING, MINIMAP_WIDGET_STATE, minimapUnitDot, minimapWorldToScreen } from '../ui/minimap-widgets'
import { injectThemeStyles, hasOpenDialog, createTabs, showModalDialog, isFocusVisibleButton, createEl, createIconEl, iconFor, injectStyleSheet, makePanelBody, closeDialogs, bindUiSounds, refreshHud, uToCalc } from '../ui/dom-kit'
import { getClassicMapData } from '../fx/particle-system'
import { ECONOMY, JUNGLE_RULES, MONSTER_STATS } from '../game-balance'
import { createHudPanel, formatGameClock } from '../ui/hud-panels'
import { HOWTO_PANEL_CSS } from '../ui/howto-styles'
import { HOME_SCREEN_CSS, LOGO_STREAK_CSS, SVG_BRAND_MARK } from '../ui/svg-icon-assets'
import { updateSetting, getBooleanSetting } from '../ui/coach-panel'
import { createHeroSelect, openDialog } from '../ui/rh-widget'
import { makeCanvasTexture } from '../render/procedural-art'
import { showAppCardDialog, injectHudStyle } from '../ui/dom-snapshot'
import { detectGraphicsQuality } from '../render/post-pipeline'
import { createAudioMixer } from '../audio/audio-mixer'
import { startMatch } from '../sim/match-lifecycle'

interface MenuFlowOptions {
  signal?: AbortSignal
  start?: string
}

interface SettingsPatch {
  quality?: string | null
  showFps?: boolean
  autoBuy?: boolean | null
  tutorial?: boolean | null
  objectiveHints?: boolean | null
}

type SettingsListener = (settingsPatch: SettingsPatch) => void

declare global {
  interface Window {
    __moba?: unknown
    __mobaBooted?: boolean
  }
}

const PORTRAIT_CANVAS_SIZE = 192,
  portraitCache = new Map()

function drawPortraitToCanvas(heroId, sourceCanvas) {
  const selectedHERO_TABLE = HERO_TABLE[heroId],
    element = document.createElement("canvas")
  element.width = element.height = PORTRAIT_CANVAS_SIZE
  const ContextValue = element.getContext("2d")
  if (!ContextValue) return ""
  if (!sourceCanvas) return (drawPortraitFallback(ContextValue, PORTRAIT_CANVAS_SIZE, PORTRAIT_CANVAS_SIZE, heroId, !0), element.toDataURL("image/png"))
  const pORTRAIT_CANVAS_SIZE = PORTRAIT_CANVAS_SIZE,
    portraitGradientBottomColor = new Color(selectedHERO_TABLE.palette.primary).lerp(new Color(659494), 0.72),
    portraitGradientTopColor = new Color(selectedHERO_TABLE.palette.primary).lerp(new Color(1055292), 0.35),
    LinearGradientValue = ContextValue.createLinearGradient(0, 0, 0, pORTRAIT_CANVAS_SIZE)
  ;(LinearGradientValue.addColorStop(0, `#${portraitGradientTopColor.getHexString()}`), LinearGradientValue.addColorStop(1, `#${portraitGradientBottomColor.getHexString()}`), (ContextValue.fillStyle = LinearGradientValue), ContextValue.fillRect(0, 0, pORTRAIT_CANVAS_SIZE, pORTRAIT_CANVAS_SIZE))
  const glowColor = new Color(selectedHERO_TABLE.palette.glow),
    RadialGradientValue = ContextValue.createRadialGradient(pORTRAIT_CANVAS_SIZE * 0.5, pORTRAIT_CANVAS_SIZE * 0.42, pORTRAIT_CANVAS_SIZE * 0.05, pORTRAIT_CANVAS_SIZE * 0.5, pORTRAIT_CANVAS_SIZE * 0.46, pORTRAIT_CANVAS_SIZE * 0.62)
  ;(RadialGradientValue.addColorStop(0, `rgba(${Math.round(glowColor.r * 255)},${Math.round(glowColor.g * 255)},${Math.round(glowColor.b * 255)},0.55)`),
    RadialGradientValue.addColorStop(1, "rgba(0,0,0,0)"),
    (ContextValue.fillStyle = RadialGradientValue),
    ContextValue.fillRect(0, 0, pORTRAIT_CANVAS_SIZE, pORTRAIT_CANVAS_SIZE),
    (ContextValue.strokeStyle = "rgba(255,255,255,0.08)"),
    (ContextValue.lineWidth = 1))
  for (let index = 0; index < 5; index++) (ContextValue.beginPath(), ContextValue.moveTo(-20 + index * 52, pORTRAIT_CANVAS_SIZE), ContextValue.lineTo(60 + index * 52, 0), ContextValue.stroke())
  ;((ContextValue.imageSmoothingQuality = "high"), ContextValue.drawImage(sourceCanvas, 0, 0, pORTRAIT_CANVAS_SIZE, pORTRAIT_CANVAS_SIZE))
  const createLinearGradientLinearGradientValue = ContextValue.createLinearGradient(0, pORTRAIT_CANVAS_SIZE * 0.7, 0, pORTRAIT_CANVAS_SIZE)
  return (createLinearGradientLinearGradientValue.addColorStop(0, "rgba(6,10,26,0)"), createLinearGradientLinearGradientValue.addColorStop(1, "rgba(6,10,26,0.5)"), (ContextValue.fillStyle = createLinearGradientLinearGradientValue), ContextValue.fillRect(0, 0, pORTRAIT_CANVAS_SIZE, pORTRAIT_CANVAS_SIZE), element.toDataURL("image/png"))
}

let portraitRenderContext = null,
  portraitRenderFailed = !1,
  portraitPrecacheScheduled = !1

function disposePortraitRenderer() {
  const previousRenderContext = portraitRenderContext
  ;((portraitRenderContext = null), previousRenderContext && (previousRenderContext.renderer.dispose(), previousRenderContext.renderer.forceContextLoss()))
}

/**
 * 绘制英雄。
 *
 * @param lookupKey - 查找键
 */
function renderHeroPortrait(lookupKey) {
  let textValue = ""
  if (!portraitRenderFailed)
    try {
      if (!portraitRenderContext) {
        const renderCanvasSize = Math.round(PORTRAIT_CANVAS_SIZE * 1.5),
          element = document.createElement("canvas")
        element.width = element.height = renderCanvasSize
        const previewRenderer = new WebGLRenderer({ canvas: element, antialias: !0, alpha: !0, premultipliedAlpha: !0, preserveDrawingBuffer: !0 })
        ;(configurePreviewRenderer(previewRenderer), previewRenderer.setPixelRatio(1), previewRenderer.setSize(renderCanvasSize, renderCanvasSize, !1), (portraitRenderContext = { renderer: previewRenderer, stage: createPreviewStage(!1) }))
      }
      const { renderer: activeRenderer, stage: previewStage } = portraitRenderContext,
        OrBuildModelValue = getOrBuildModel(heroModelKey(lookupKey)),
        heroAnimator = new Animator(OrBuildModelValue, 0.37),
        outlineRegistry = new OutlineRegistry(OrBuildModelValue.geometry, OrBuildModelValue.rig.count, 1, { outline: 1.7 }, `portrait:${lookupKey}`)
      ;(outlineRegistry.setShadows(!1), outlineRegistry.addTo(previewStage.scene))
      try {
        const glowColor = new Color(HERO_TABLE[lookupKey].palette.glow)
        previewStage.rim.color.copy(glowColor).lerp(new Color(1, 1, 1), 0.3)
        const cameraParams = __heroRow(PORTRAIT_CAMERA_PARAMS, lookupKey) || {},
          animatorInput = heroAnimator.input
        ;((animatorInput.anim = cameraParams.anim ?? "idle"),
          (animatorInput.time = 1.3),
          (animatorInput.p = cameraParams.p ?? 0),
          (animatorInput.t = animatorInput.anim === "idle" || animatorInput.anim === "channel" ? 1.3 : animatorInput.p * 0.8),
          (animatorInput.windup = 0.35),
          (animatorInput.variant = cameraParams.variant ?? 0),
          heroAnimator.update(0, 0, 0, 0, 0, (cameraParams.yaw * Math.PI) / 180, 1),
          heroAnimator.settle())
        const MaterialStateValue = createMaterialState()
        ;(MaterialStateValue.team.set(ARENA_PALETTE.blue.main), (MaterialStateValue.glow = heroAnimator.output.glow), outlineRegistry.begin(), outlineRegistry.push(heroAnimator.skeleton, MaterialStateValue), outlineRegistry.end())
        const xConfig = { x: 0, y: 0, z: 0 }
        heroAnimator.attach("head", xConfig) || (xConfig.y = OrBuildModelValue.height * OrBuildModelValue.scale * 0.86)
        const portraitCamera = previewStage.camera,
          focusHeight = xConfig.y - cameraParams.drop
        ;((portraitCamera.aspect = 1),
          (portraitCamera.fov = 24),
          portraitCamera.position.set(xConfig.x + cameraParams.x, focusHeight + 0.1, xConfig.z + cameraParams.dist),
          portraitCamera.lookAt(xConfig.x + cameraParams.x, focusHeight, xConfig.z),
          portraitCamera.updateProjectionMatrix(),
          activeRenderer.clear(),
          activeRenderer.render(previewStage.scene, portraitCamera),
          (textValue = drawPortraitToCanvas(lookupKey, activeRenderer.domElement)))
      } finally {
        ;(outlineRegistry.removeFrom(previewStage.scene), outlineRegistry.dispose())
      }
    } catch {
      ;((portraitRenderFailed = !0), disposePortraitRenderer())
    }
  return (textValue || (textValue = drawPortraitToCanvas(lookupKey, null)), portraitCache.set(lookupKey, textValue), textValue)
}

function schedulePortraitPrecache() {
  if (portraitPrecacheScheduled) return
  if (HERO_IDS.find((lookupKey) => !portraitCache.has(lookupKey)) === void 0) {
    disposePortraitRenderer()
    return
  }
  portraitPrecacheScheduled = !0
  const precacheNext = () => {
    portraitPrecacheScheduled = !1
    const uncachedHeroId = HERO_IDS.find((pendingHeroId) => !portraitCache.has(pendingHeroId))
    ;(uncachedHeroId !== void 0 && renderHeroPortrait(uncachedHeroId), schedulePortraitPrecache())
  }
  typeof window.requestIdleCallback == "function" ? window.requestIdleCallback(precacheNext, { timeout: 400 }) : window.setTimeout(precacheNext, 60)
}

/**
 * 获取英雄。
 *
 * @param lookupKey - 查找键
 */
function getHeroPortrait(lookupKey) {
  const Value = portraitCache.get(lookupKey)
  if (Value !== void 0) return Value
  const renderHeroPortraitResult = renderHeroPortrait(lookupKey)
  return (schedulePortraitPrecache(), renderHeroPortraitResult)
}

function readJsonStorage(storageKey) {
  const StoredSettingValue = getStoredSetting(storageKey)
  if (StoredSettingValue === null || StoredSettingValue === "") return null
  try {
    return JSON.parse(StoredSettingValue)
  } catch {
    return null
  }
}

function loadMergedSettings(storedSettings) {
  const mergedSettings = { ...minimapWorldToScreen, ...storedSettings },
    JsonStorageValue = readJsonStorage(minimapUnitDot)
  return (
    JsonStorageValue &&
      typeof JsonStorageValue == "object" &&
      (MINIMAP_WIDGET_STATE(JsonStorageValue.quality) && (mergedSettings.quality = JsonStorageValue.quality),
      (mergedSettings.masterVolume = MINIMAP_TUNING(JsonStorageValue.masterVolume, mergedSettings.masterVolume)),
      (mergedSettings.sfxVolume = MINIMAP_TUNING(JsonStorageValue.sfxVolume, mergedSettings.sfxVolume)),
      (mergedSettings.musicVolume = MINIMAP_TUNING(JsonStorageValue.musicVolume, mergedSettings.musicVolume)),
      typeof JsonStorageValue.showFps == "boolean" && (mergedSettings.showFps = JsonStorageValue.showFps),
      typeof JsonStorageValue.cameraShake == "boolean" && (mergedSettings.cameraShake = JsonStorageValue.cameraShake),
      typeof JsonStorageValue.autoBuy == "boolean" && (mergedSettings.autoBuy = JsonStorageValue.autoBuy),
      typeof JsonStorageValue.tutorial == "boolean" && (mergedSettings.tutorial = JsonStorageValue.tutorial),
      typeof JsonStorageValue.objectiveHints == "boolean" && (mergedSettings.objectiveHints = JsonStorageValue.objectiveHints)),
    mergedSettings
  )
}

function saveSettingsToStorage(settingsToSave) {
  setStoredSetting(minimapUnitDot, JSON.stringify(settingsToSave))
}

function buildKeyCap(keyLabel, columnSpan, capTone?) {
  const element = createEl("span", "sf-key", keyLabel)
  return ((element.style.gridColumn = `span ${columnSpan}`), capTone && (element.dataset.tone = capTone), element)
}

function buildHowtoRow(rowTone, dotGlyph, rowLabel, detailHtml) {
  const element = createEl("span", "sf-howto__dot", dotGlyph)
  element.dataset.tone = rowTone
  const createElElement = createEl("span")
  return ((createElElement.innerHTML = detailHtml), createEl("li", null, element, createEl("span", null, createEl("b", null, rowLabel), " ", createElElement)))
}

function buildKeyboardHowtoPane() {
  const element = createEl(
      "div",
      "sf-keys",
      buildKeyCap("Esc", 3, "ui"),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("Tab", 3, "ui"),
      buildKeyCap("Q", 2, "skill"),
      buildKeyCap("W", 2, "move"),
      buildKeyCap("E", 2, "skill"),
      buildKeyCap("R", 2, "skill"),
      buildKeyCap("P", 2, "ui"),
      buildKeyCap("", 3),
      buildKeyCap("A", 2, "move"),
      buildKeyCap("S", 2, "move"),
      buildKeyCap("D", 2, "move"),
      buildKeyCap("F", 2, "sum"),
      buildKeyCap("G", 2, "sum"),
      buildKeyCap("", 3),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("", 2),
      buildKeyCap("B", 2, "sum"),
      buildKeyCap("J", 2, "atk"),
      buildKeyCap("", 3),
      buildKeyCap("空格", 8, "atk"),
      buildKeyCap("", 2),
    ),
    mouseDiagram = createEl("div", "sf-mouse")
  mouseDiagram.innerHTML =
    '<svg viewBox="0 0 80 124" aria-hidden="true"><rect x="6" y="6" width="68" height="112" rx="34" fill="rgba(20,34,72,.7)" stroke="rgba(150,178,235,.4)" stroke-width="2"/><path d="M40 6C21.200 6 6 21.200 6 40V52H38V6Z" fill="#ff8a7a"/><path d="M40 6C58.800 6 74 21.200 74 40V52H42V6Z" fill="#5cd6f7"/><rect x="35" y="20" width="10" height="22" rx="5" fill="#0a1128" stroke="rgba(255,255,255,.5)" stroke-width="1.500"/><text x="21" y="38" text-anchor="middle" font-size="13" fill="#08101f">左</text><text x="59" y="38" text-anchor="middle" font-size="13" fill="#08101f">右</text></svg>'
  const ElValue = createEl(
    "ul",
    "sf-howto__list",
    buildHowtoRow("move", "移", "移动", "<em>W A S D</em> 或方向键；<em>鼠标右键</em>点地面寻路移动"),
    buildHowtoRow("atk", "攻", "普攻", "<em>空格 / J</em> 自动选择目标；<em>左键或右键</em>点敌人指定攻击"),
    buildHowtoRow("skill", "技", "技能", "<em>Q</em> 一技能 · <em>E</em> 二技能 · <em>R</em> 大招：按下显示指示器，松开朝鼠标位置施放；<em>Esc / 右键</em>取消"),
    buildHowtoRow("sum", "通", "通用技能", "<em>F</em> 闪现(朝鼠标) · <em>G</em> 疗伤 · <em>B</em> 回城"),
    buildHowtoRow("ui", "界", "界面", "<em>Tab</em> 按住看战况 · <em>P</em> 商店 · <em>Esc</em> 设置 / 暂停"),
  )
  return createEl("div", "sf-howto__pane", createEl("div", "sf-howto__fig sf-inset", element, mouseDiagram), ElValue)
}

function buildTouchHowtoPane() {
  const element = createEl("div", "sf-touchfig"),
    touchDotSvg = (dotCenterX, dotCenterY, dotNumber, dotColor) =>
      `<circle cx="${dotCenterX}" cy="${dotCenterY}" r="10.5" fill="${dotColor}" stroke="#08101f" stroke-width="1.5"/><text x="${dotCenterX}" y="${dotCenterY + 5}" text-anchor="middle" font-size="14" fill="#08101f">${dotNumber}</text>`,
    touchZoneSvg = (zoneCenterX, zoneCenterY, zoneRadius, zoneColor) => `<circle cx="${zoneCenterX}" cy="${zoneCenterY}" r="${zoneRadius}" fill="${zoneColor}" fill-opacity=".22" stroke="${zoneColor}" stroke-width="1.600"/>`
  element.innerHTML =
    '<svg viewBox="0 0 400 200" aria-hidden="true"><rect x="3" y="3" width="394" height="194" rx="22" fill="rgba(10,17,40,.75)" stroke="rgba(232,199,122,.55)" stroke-width="2"/><rect x="12" y="12" width="376" height="176" rx="14" fill="rgba(28,47,96,.35)"/><rect x="22" y="22" width="54" height="54" rx="5" fill="#b9a2ff" fill-opacity=".2" stroke="#b9a2ff" stroke-width="1.600"/><path d="M30 68L68 30" stroke="#b9a2ff" stroke-width="1.400" opacity=".7"/><rect x="150" y="18" width="100" height="16" rx="8" fill="rgba(150,178,235,.16)" stroke="rgba(150,178,235,.35)"/><rect x="330" y="18" width="20" height="16" rx="4" fill="#b9a2ff" fill-opacity=".2" stroke="#b9a2ff" stroke-width="1.400"/><rect x="356" y="18" width="20" height="16" rx="4" fill="#b9a2ff" fill-opacity=".2" stroke="#b9a2ff" stroke-width="1.400"/><circle cx="196" cy="74" r="19" fill="#ff8a7a" fill-opacity=".14" stroke="#ff8a7a" stroke-width="1.400" stroke-dasharray="4 3"/><text x="196" y="78.500" text-anchor="middle" font-size="12" fill="#ff8a7a">取消</text><circle cx="74" cy="140" r="34" fill="#5cd6f7" fill-opacity=".1" stroke="#5cd6f7" stroke-width="1.600"/><circle cx="86" cy="130" r="14" fill="#5cd6f7" fill-opacity=".7"/>' +
    touchZoneSvg(340, 150, 30, "#ff8a7a") +
    touchZoneSvg(278, 162, 18, "#f3cf85") +
    touchZoneSvg(292, 112, 18, "#f3cf85") +
    touchZoneSvg(340, 86, 18, "#f3cf85") +
    touchZoneSvg(232, 174, 11, "#6fe3a1") +
    touchZoneSvg(246, 140, 11, "#6fe3a1") +
    touchZoneSvg(264, 80, 11, "#6fe3a1") +
    '<rect x="22" y="88" width="34" height="18" rx="6" fill="#b9a2ff" fill-opacity=".2" stroke="#b9a2ff" stroke-width="1.400"/><path d="M340 86L306 52" stroke="#f3cf85" stroke-width="1.800" stroke-dasharray="3.500 3"/><path d="M301 47l2.500 10 7.500-7.500z" fill="#f3cf85"/>' +
    touchDotSvg(74, 140, "1", "#5cd6f7") +
    touchDotSvg(340, 150, "2", "#ff8a7a") +
    touchDotSvg(340, 86, "3", "#f3cf85") +
    touchDotSvg(246, 140, "4", "#6fe3a1") +
    touchDotSvg(49, 49, "5", "#b9a2ff") +
    touchDotSvg(39, 97, "6", "#b9a2ff") +
    touchDotSvg(353, 40, "7", "#b9a2ff") +
    "</svg>"
  const createElElValue = createEl(
    "ul",
    "sf-howto__list",
    buildHowtoRow("move", "1", "摇杆", "左下区域按住拖动，控制英雄移动"),
    buildHowtoRow("atk", "2", "普攻", "按住连续攻击，自动选择最合适的目标"),
    buildHowtoRow("skill", "3", "技能", "<em>轻点</em> = 智能施法；<em>按住拖动</em> = 手动瞄准，松手施放；拖到<em>「取消」</em>区松手则取消；<em>原地长按</em>查看技能说明"),
    buildHowtoRow("sum", "4", "通用技能", "闪现(可拖动选方向) · 疗伤 · 回城"),
    buildHowtoRow("ui", "5", "小地图", "点按并拖动可观察战场，松手回到英雄"),
    buildHowtoRow("ui", "6", "商店", "金币够了会自动买推荐装备；想自己挑就点开商店(关掉自动出装后，钱够时这里会弹出一键购买)"),
    buildHowtoRow("ui", "7", "战况 / 暂停", "右上角两个按钮：看双方战况、暂停与设置"),
  )
  return createEl("div", "sf-howto__pane", createEl("div", "sf-howto__fig sf-inset", element), createElElValue)
}

const MONSTER_ICON_COLORS = { mossback: "#e2cf7a", glimwing: "#e2cf7a", frost_golem: "#4da3ff", ember_golem: "#ff5d5d", abyss_drake: "#c09bff", star_colossus: "#ffd76a" },
  TEAM_ICON_COLORS = ["#4da3ff", "#ff5d5d"],
  ICON_OUTLINE_COLOR = "#060a16",
  roundToOneDecimal = (rawCoordinate) => Math.round(rawCoordinate * 10) / 10

/**
 * 处理图标。
 *
 * @param frost_golemKind - 输入
 * @param iconCenterX - 次要输入
 * @param iconCenterY - 第三输入
 * @param iconSize - 第四输入
 * @returns 文本结果
 */
function monsterIconSvg(frost_golemKind, iconCenterX, iconCenterY, iconSize) {
  const selectedMONSTER_ICON_COLORS = MONSTER_ICON_COLORS[frost_golemKind],
    iconRingSvg = (ringRadiusScale, ringStrokeWidth) => `<circle cx="${iconCenterX}" cy="${iconCenterY}" r="${roundToOneDecimal(iconSize * ringRadiusScale)}" fill="none" stroke="${selectedMONSTER_ICON_COLORS}" stroke-width="${ringStrokeWidth}" opacity=".8"/>`
  if (frost_golemKind === "frost_golem" || frost_golemKind === "ember_golem") return `${iconRingSvg(1.7, 1)}<circle cx="${iconCenterX}" cy="${iconCenterY}" r="${iconSize}" fill="${selectedMONSTER_ICON_COLORS}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1"/>`
  if (frost_golemKind === "abyss_drake")
    return `${iconRingSvg(1.9, 1.2)}<path d="M${iconCenterX} ${roundToOneDecimal(iconCenterY - iconSize * 1.25)}L${roundToOneDecimal(iconCenterX + iconSize * 1.1)} ${roundToOneDecimal(iconCenterY + iconSize * 0.85)}H${roundToOneDecimal(iconCenterX - iconSize * 1.1)}Z" fill="${selectedMONSTER_ICON_COLORS}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/>`
  const pathScale = frost_golemKind === "star_colossus" ? 1.25 : 0.8,
    textResult = `<path d="M${iconCenterX} ${roundToOneDecimal(iconCenterY - iconSize * pathScale)}L${roundToOneDecimal(iconCenterX + iconSize * pathScale)} ${iconCenterY}L${iconCenterX} ${roundToOneDecimal(iconCenterY + iconSize * pathScale)}L${roundToOneDecimal(iconCenterX - iconSize * pathScale)} ${iconCenterY}Z" fill="${selectedMONSTER_ICON_COLORS}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1" stroke-linejoin="round"/>`
  return frost_golemKind === "star_colossus" ? `${iconRingSvg(1.75, 1.1)}${iconRingSvg(2.4, 0.9)}${textResult}` : textResult
}

const towerIconSvg = (towerCenterX, towerCenterY, towerHalfSize, teamIndex) => `<rect x="${roundToOneDecimal(towerCenterX - towerHalfSize)}" y="${roundToOneDecimal(towerCenterY - towerHalfSize)}" width="${roundToOneDecimal(towerHalfSize * 2)}" height="${roundToOneDecimal(towerHalfSize * 2)}" rx="${roundToOneDecimal(towerHalfSize * 0.3)}" fill="${TEAM_ICON_COLORS[teamIndex]}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="1"/>`,
  baseIconSvg = (baseCenterX, baseCenterY, baseSize, teamIndex) =>
    `<circle cx="${baseCenterX}" cy="${baseCenterY}" r="${roundToOneDecimal(baseSize * 1.55)}" fill="${TEAM_ICON_COLORS[teamIndex]}" fill-opacity=".22" stroke="${TEAM_ICON_COLORS[teamIndex]}" stroke-width="1.2"/><path d="M${baseCenterX} ${roundToOneDecimal(baseCenterY - baseSize * 1.2)}L${roundToOneDecimal(baseCenterX + baseSize * 0.8)} ${baseCenterY}L${baseCenterX} ${roundToOneDecimal(baseCenterY + baseSize * 1.2)}L${roundToOneDecimal(baseCenterX - baseSize * 0.8)} ${baseCenterY}Z" fill="#f2feff" stroke="${TEAM_ICON_COLORS[teamIndex]}" stroke-width="1.4" stroke-linejoin="round"/>`

function buildIconGlyph(iconMarkup) {
  const element = createEl("span", "sf-howto__glyph")
  return ((element.innerHTML = iconMarkup.startsWith("<svg") ? iconMarkup : `<svg viewBox="0 0 20 20" aria-hidden="true">${iconMarkup}</svg>`), element)
}

function buildHowtoLegendRow(glyphElement, legendLabel, legendDetail) {
  const element = createEl("span")
  return ((element.innerHTML = legendDetail), createEl("li", null, glyphElement, createEl("span", null, createEl("b", null, legendLabel), " ", element)))
}

function buildWinGuidePane() {
  const ClassicMapDataValue = getClassicMapData(),
    mapScale = 88 / ClassicMapDataValue.bound,
    mapPointSvg = (mapPosition) => `${roundToOneDecimal(100 + mapPosition.x * mapScale)} ${roundToOneDecimal(100 + mapPosition.y * mapScale)}`,
    toDiagramX = (mapPosition) => roundToOneDecimal(100 + mapPosition.x * mapScale),
    toDiagramY = (mapPosition) => roundToOneDecimal(100 + mapPosition.y * mapScale),
    mapPathSvg = (bushMap) => bushMap.map((pathPoint, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${mapPointSvg(pathPoint)}`).join("")
  let total = `<svg viewBox="0 -15 200 230" role="img" aria-label="战场示意图：蓝方在左下，红方在右上，三条路，河道从左上到右下"><rect x="2" y="2" width="196" height="196" rx="12" fill="#0b1630" stroke="rgba(232,199,122,.55)" stroke-width="2"/><path d="${mapPathSvg(ClassicMapDataValue.river)}" fill="none" stroke="#2f86b8" stroke-width="${roundToOneDecimal(ClassicMapDataValue.riverWidth * mapScale)}" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`
  for (const topmidbot of ["top", "mid", "bot"]) total += `<path d="${mapPathSvg(ClassicMapDataValue.lanes[topmidbot])}" fill="none" stroke="#b9a577" stroke-width="5.500" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`
  for (const camp of ClassicMapDataValue.camps) total += monsterIconSvg(camp.monsterType, toDiagramX(camp.pos), toDiagramY(camp.pos), MONSTER_STATS[camp.monsterType].epic ? 5 : camp.monsterType === "frost_golem" || camp.monsterType === "ember_golem" ? 3.6 : 3.2)
  for (const tower of ClassicMapDataValue.towers) total += towerIconSvg(toDiagramX(tower.pos), toDiagramY(tower.pos), 3.4, tower.team)
  for (const base of ClassicMapDataValue.bases) total += baseIconSvg(toDiagramX(base.core), toDiagramY(base.core), 6.5, base.team)
  total += '<text x="5" y="211.500" font-size="11.500" fill="#9ccfff">◣ 我方水晶</text><text x="195" y="-4" font-size="11.500" fill="#ff9c9c" text-anchor="end">敌方水晶 ◥</text></svg>'
  const element = createEl("div", "sf-winfig")
  element.innerHTML = `${total}<p>图上的记号和对局里的小地图是同一套</p>`
  const lookupMonsterInfo = (monsterType) => {
      const monsterCamp = ClassicMapDataValue.camps.find((monster) => monster.monsterType === monsterType)
      return { first: formatGameClock(monsterCamp ? monsterCamp.firstSpawn : 0).replace(/^0/, ""), reward: MONSTER_STATS[monsterType].reward ?? "" }
    },
    lResult = lookupMonsterInfo("abyss_drake"),
    lLResult = lookupMonsterInfo("star_colossus"),
    proximityGoldPercent = Math.round(ECONOMY.proximityGoldRatio * 100),
    ElResult = createEl(
      "ul",
      "sf-howto__list",
      buildHowtoLegendRow(buildIconGlyph(baseIconSvg(10, 10, 5.4, 1)), "怎么赢", "摧毁<em>敌方水晶</em>就赢。你在左下角的蓝色方，敌方水晶在右上角。"),
      buildHowtoLegendRow(buildIconGlyph(towerIconSvg(10, 10, 5.5, 1)), "推塔", "上、中、下三条路，每条路按 <em>一塔 → 二塔 → 高地塔</em> 的顺序拆；拆掉任意一路的高地塔，才打得动水晶。塔先打小兵，跟着小兵进塔。"),
      buildHowtoLegendRow(buildIconGlyph(iconFor("gold")), "补兵", `给小兵<em>最后一击</em>拿全额金币，只站在旁边只有约 ${proximityGoldPercent}%。金币够了会<em>自动买</em>推荐装备。`),
      buildHowtoLegendRow(buildIconGlyph(monsterIconSvg("frost_golem", 10, 10, 4.6)), MONSTER_STATS.frost_golem.name, `野区的大野怪。${MONSTER_STATS.frost_golem.reward ?? ""}。`),
      buildHowtoLegendRow(buildIconGlyph(monsterIconSvg("ember_golem", 10, 10, 4.6)), MONSTER_STATS.ember_golem.name, `野区的大野怪。${MONSTER_STATS.ember_golem.reward ?? ""}。`),
      buildHowtoLegendRow(buildIconGlyph(monsterIconSvg("abyss_drake", 10, 11, 4.4)), MONSTER_STATS.abyss_drake.name, `左上河道，<em>${lResult.first}</em> 刷新。${lResult.reward}。它会吐息：看到地上的扇形预警就走出去。`),
      buildHowtoLegendRow(buildIconGlyph(monsterIconSvg("star_colossus", 10, 10, 3.6)), MONSTER_STATS.star_colossus.name, `右下河道，<em>${lLResult.first}</em> 刷新。${lLResult.reward}(${JUNGLE_RULES.blessingDuration} 秒一过就没了，趁这会儿推塔)。`),
    )
  return createEl("div", "sf-howto__pane sf-howto__pane--win", createEl("div", "sf-howto__fig sf-inset", element), ElResult)
}

/**
 * 处理界面。
 *
 * @param dialogRoot - 主要输入
 * @param dialogOptions - 次要输入
 */
function openHowtoDialog(dialogRoot, dialogOptions?) {
  injectStyleSheet("sf-menu-howto", HOWTO_PANEL_CSS)
  const isCoarsePointer = typeof matchMedia == "function" && matchMedia("(pointer: coarse)").matches,
    element = createEl("div"),
    onTabChange = (keysKind) => {
      ;((element.textContent = ""), element.appendChild(keysKind === "keys" ? buildKeyboardHowtoPane() : keysKind === "touch" ? buildTouchHowtoPane() : buildWinGuidePane()))
    },
    TabsValue = createTabs({
      tabs: [
        { id: "keys", label: "键盘鼠标", icon: iconFor("keyboard") },
        { id: "touch", label: "触控", icon: iconFor("touch") },
        { id: "win", label: "怎么赢", icon: iconFor("crown") },
      ],
      value: isCoarsePointer ? "touch" : "keys",
      onChange: onTabChange,
    })
  return (onTabChange(TabsValue.get()), showModalDialog(dialogRoot, { title: "操作说明", content: createEl("div", "sf-howto", TabsValue.el, element), width: uToCalc(900) }))
}

function buildHomeScreen(homeHost) {
  injectStyleSheet("sf-menu-title", HOME_SCREEN_CSS + LOGO_STREAK_CSS)
  const element = createEl("h1", "sf-logo__name", ..."星陨战纪".split("").map((titleChar) => createEl("span", null, titleChar)))
  element.setAttribute("aria-label", "星陨战纪")
  const logoEmblem = createEl("div", "sf-logo__emblem")
  logoEmblem.innerHTML = SVG_BRAND_MARK
  const logoBlock = createEl("div", "sf-logo", createEl("div", "sf-logo__streak"), logoEmblem, element, createEl("div", "sf-logo__sub", createEl("i"), createEl("b", null, "STARFALL"), createEl("i")), createEl("p", "sf-logo__tag", "坠星召来历代英杰 · 5v5 对决")),
    PanelBodyValue = makePanelBody({ label: "开始对战", variant: "primary", size: "lg", pulse: !0, sound: "confirm", onClick: () => homeHost.onStart() }),
    tutorialToggle = createEl("button", "sf-home__guide", createEl("i", "sf-home__guide-box", createIconEl(iconFor("check"))), createEl("span", null, "新手引导"), createEl("small", null, "(第一次玩建议打开)"))
  ;((tutorialToggle.type = "button"), tutorialToggle.setAttribute("role", "checkbox"))
  const syncTutorialState = () => tutorialToggle.setAttribute("aria-checked", getBooleanSetting(homeHost.host.getSettings(), "tutorial") ? "true" : "false")
  ;(syncTutorialState(),
    tutorialToggle.addEventListener("click", () => {
      ;(updateSetting(homeHost.host, "tutorial", !getBooleanSetting(homeHost.host.getSettings(), "tutorial")), homeHost.host.audio.ui("click"), syncTutorialState())
    }))
  const makePanelBodyPanelBodyValue = makePanelBody({ label: "操作说明", icon: iconFor("keyboard"), onClick: () => openHowtoDialog(homeHost.root) }),
    PanelBodyResult = makePanelBody({
      label: "设置",
      icon: iconFor("settings"),
      onClick: () =>
        openDialog(homeHost.root, {
          get: () => homeHost.host.getSettings(),
          update: (settingsPatch) => {
            ;(homeHost.host.updateSettings(settingsPatch), syncTutorialState())
          },
          audio: homeHost.host.audio,
          mode: "menu",
        }),
    }),
    homeScreen = createEl(
      "div",
      "sf-screen sf-home",
      createEl("div", "sf-home__logo", logoBlock),
      createEl("nav", "sf-home__menu", createEl("div", "sf-home__start", PanelBodyValue, tutorialToggle), createEl("div", "sf-home__row", makePanelBodyPanelBodyValue, PanelBodyResult)),
      createEl("p", "sf-home__foot", createEl("span", null, "1 名玩家 + 9 名 AI"), createEl("i"), createEl("span", null, "全部美术与音效均为程序化生成"), createEl("i"), createEl("span", null, "v0.1")),
    )
  let isActive = !1
  const onHomeKeydown = (cooldown) => {
    isActive || hasOpenDialog() || cooldown.repeat || isFocusVisibleButton(homeScreen) || ((cooldown.key === "Enter" || cooldown.key === " ") && (cooldown.preventDefault(), homeHost.host.audio.ui("confirm"), homeHost.onStart()))
  }
  return (
    window.addEventListener("keydown", onHomeKeydown),
    {
      el: homeScreen,
      freeze: () => {
        isActive = !0
      },
      dispose: () => window.removeEventListener("keydown", onHomeKeydown),
    }
  )
}

const LAST_CHOICE_STORAGE_KEY = "starfall.lastChoice.v1",
  DEFAULT_LAST_CHOICE = { heroId: "chijin", difficulty: "easy" }

function loadLastChoice() {
  const readJsonStorageJsonStorageValue = readJsonStorage(LAST_CHOICE_STORAGE_KEY)
  if (!readJsonStorageJsonStorageValue || typeof readJsonStorageJsonStorageValue != "object") return { ...DEFAULT_LAST_CHOICE }
  const lastHeroId = typeof readJsonStorageJsonStorageValue.heroId == "string" && readJsonStorageJsonStorageValue.heroId in HERO_TABLE ? readJsonStorageJsonStorageValue.heroId : DEFAULT_LAST_CHOICE.heroId,
    storedDifficulty = readJsonStorageJsonStorageValue.difficulty,
    chosenDifficulty = storedDifficulty === "easy" || storedDifficulty === "normal" || storedDifficulty === "hard" ? storedDifficulty : DEFAULT_LAST_CHOICE.difficulty
  return { heroId: lastHeroId, difficulty: chosenDifficulty }
}

function saveLastChoice(lastChoice) {
  setStoredSetting(LAST_CHOICE_STORAGE_KEY, JSON.stringify({ heroId: lastChoice.heroId, difficulty: lastChoice.difficulty }))
}

function openMenuFlow(element, menuHost, menuOptions: MenuFlowOptions = {}) {
  return (
    injectThemeStyles(),
    new Promise((resolveMenuFlow) => {
      if (menuOptions.signal?.aborted) return
      const menuRootElement = createEl("div", "sf-root sf-menu-root"),
        CanvasTextureValue = makeCanvasTexture(menuRootElement, "menu"),
        bindUiSoundsResult = bindUiSounds(menuRootElement, menuHost.audio)
      element.appendChild(menuRootElement)
      let loadLastChoiceResult = loadLastChoice(),
        currentScreen = null,
        screenActive = !1,
        abortHandled = !1,
        abortTimerId = 0
      const screenRegistry = new Map(),
        disposeScreens = () => {
          if (!abortHandled) {
            ;((abortHandled = !0), menuOptions.signal?.removeEventListener("abort", onMenuAbort), window.clearTimeout(abortTimerId))
            for (const [disposeTimerId, leavingScreen] of screenRegistry) (window.clearTimeout(disposeTimerId), leavingScreen.dispose())
            ;(screenRegistry.clear(), currentScreen?.dispose(), (currentScreen = null), bindUiSoundsResult(), CanvasTextureValue.dispose(), menuRootElement.remove())
          }
        },
        onMenuAbort = () => {
          ;((screenActive = !0), refreshHud(), closeDialogs(menuRootElement), disposeScreens())
        }
      menuOptions.signal?.addEventListener("abort", onMenuAbort)
      const switchScreen = (nextScreen) => {
          refreshHud()
          const previousScreen = currentScreen
          if (((currentScreen = nextScreen), previousScreen)) {
            ;(previousScreen.freeze(), previousScreen.el.classList.add("is-leaving"))
            const lookupKey = window.setTimeout(() => {
              ;(screenRegistry.delete(lookupKey), previousScreen.dispose(), previousScreen.el.remove())
            }, 260)
            screenRegistry.set(lookupKey, previousScreen)
          }
          menuRootElement.appendChild(nextScreen.el)
        },
        onMenuBack = () => {
          screenActive || switchScreen(buildHomeScreen({ host: menuHost, root: menuRootElement, onStart: openHeroSelect }))
        },
        openHeroSelect = () => {
          screenActive ||
            switchScreen(
              createHeroSelect({
                host: menuHost,
                root: menuRootElement,
                initial: loadLastChoiceResult,
                onBack: onMenuBack,
                onChange: (selectedChoice) => {
                  ;((loadLastChoiceResult = selectedChoice), saveLastChoice(selectedChoice))
                },
                onConfirm: onHeroConfirm,
              }),
            )
        },
        onHeroConfirm = (confirmedChoice) => {
          screenActive ||
            ((screenActive = !0),
            (loadLastChoiceResult = confirmedChoice),
            saveLastChoice(confirmedChoice),
            refreshHud(),
            currentScreen?.freeze(),
            (menuRootElement.style.transition = "opacity 0.35s linear"),
            (menuRootElement.style.opacity = "0"),
            (menuRootElement.style.pointerEvents = "none"),
            (abortTimerId = window.setTimeout(() => {
              ;(disposeScreens(), resolveMenuFlow(confirmedChoice))
            }, 360)))
        }
      ;(menuHost.audio.setMusic("menu"), menuOptions.start === "select" ? openHeroSelect() : onMenuBack())
    })
  )
}

function finishBoot() {
  window.__mobaBooted = !0
  const element = document.getElementById("boot")
  !element || element.classList.contains("is-done") || (element.classList.add("is-done"), window.setTimeout(() => element.remove(), 600))
}

function isWebGL2Available() {
  try {
    const element = document.createElement("canvas").getContext("webgl2")
    return element ? (element.getExtension("WEBGL_lose_context")?.loseContext(), !0) : !1
  } catch {
    return !1
  }
}

function formatError(unknownError) {
  if (unknownError instanceof Error) return unknownError.message ? `${unknownError.name}: ${unknownError.message}` : unknownError.name
  if (typeof unknownError == "string") return unknownError
  try {
    const stringifyResult = JSON.stringify(unknownError)
    return typeof stringifyResult == "string" ? stringifyResult : String(unknownError)
  } catch {
    return String(unknownError)
  }
}

const MAX_SIM_SPEED = 64,
  parseBoolParam = (rawFlag) => rawFlag !== null && rawFlag !== "0" && rawFlag !== "false" && rawFlag !== "off",
  parseNullableBoolParam = (rawNullableFlag) => (rawNullableFlag === null ? null : parseBoolParam(rawNullableFlag))

function parseHashParams(hashText) {
  const lookupKey = hashText.replace(/^#/, "")
  if (lookupKey === "") return new URLSearchParams()
  if (lookupKey.includes("=") || lookupKey.includes("&")) return new URLSearchParams(lookupKey)
  const hashParams = new URLSearchParams()
  return (lookupKey === "demo" ? (hashParams.set("skipmenu", "1"), hashParams.set("auto", "1")) : hashParams.set(lookupKey, "1"), hashParams)
}

function parseLaunchOptions(queryString, hashFragment = "") {
  const uRLSearchParams = new URLSearchParams(queryString),
    parseHashParamsResult = parseHashParams(hashFragment),
    readOption = (lookupKey) => uRLSearchParams.get(lookupKey) ?? parseHashParamsResult.get(lookupKey),
    iResult = readOption("hero"),
    iIResult = readOption("difficulty"),
    qualityOption = readOption("quality")
  let parsedSeed = null
  const seedText = readOption("seed")
  if (seedText !== null && seedText.trim() !== "") {
    const lookupKey = Number(seedText)
    Number.isFinite(lookupKey) && (parsedSeed = Math.floor(Math.abs(lookupKey)) >>> 0)
  }
  let simSpeed = 1
  const speedText = readOption("speed")
  if (speedText !== null) {
    const numberResult = Number(speedText)
    Number.isFinite(numberResult) && numberResult > 0 && (simSpeed = Math.min(MAX_SIM_SPEED, Math.max(0.1, numberResult)))
  }
  return {
    hero: iResult !== null && HERO_IDS.includes(iResult) ? iResult : null,
    difficulty: iIResult === "easy" || iIResult === "normal" || iIResult === "hard" ? iIResult : null,
    seed: parsedSeed,
    skipMenu: parseBoolParam(readOption("skipmenu")),
    auto: parseBoolParam(readOption("auto")),
    speed: simSpeed,
    quality: qualityOption === "low" || qualityOption === "medium" || qualityOption === "high" ? qualityOption : null,
    showFps: parseBoolParam(readOption("fps")),
    autoBuy: parseNullableBoolParam(readOption("autobuy")),
    tutorial: parseNullableBoolParam(readOption("tutorial")),
    objectiveHints: parseNullableBoolParam(readOption("hints")),
  }
}

class StatsCollector {
  buf: Float64Array
  n = 0
  head = 0
  sum = 0
  last = 0
  peak = 0
  constructor(bufferCapacity = 240) {
    this.buf = new Float64Array(Math.max(1, Math.floor(bufferCapacity)))
  }
  push(newSample) {
    const bufState = this.buf
    ;(this.n === bufState.length ? (this.sum -= bufState[this.head]) : this.n++, (bufState[this.head] = newSample), (this.sum += newSample), (this.head = (this.head + 1) % bufState.length), (this.last = newSample), newSample > this.peak && (this.peak = newSample))
  }
  get count() {
    return this.n
  }
  get avg() {
    return this.n > 0 ? this.sum / this.n : 0
  }
  get max() {
    let maxSample = 0
    for (let index = 0; index < this.n; index++) this.buf[index] > maxSample && (maxSample = this.buf[index])
    return maxSample
  }
  percentile(percentileRank) {
    if (this.n === 0) return 0
    const sortResult = Array.from(this.buf.subarray(0, this.n)).sort((leftSample, rightSample) => leftSample - rightSample),
      percentileIndex = Math.min(this.n - 1, Math.max(0, Math.ceil(percentileRank * this.n) - 1))
    return sortResult[percentileIndex]
  }
  reset() {
    ;((this.n = 0), (this.head = 0), (this.sum = 0), (this.last = 0), (this.peak = 0))
  }
}

const roundToThreeDecimals = (rawNumber) => Math.round(rawNumber * 1e3) / 1e3

class FrameStats {
  sim
  render
  hud
  audio
  work
  interval
  steps
  frames = 0
  constructor(bufferCapacity = 240) {
    ;((this.sim = new StatsCollector(bufferCapacity)), (this.render = new StatsCollector(bufferCapacity)), (this.hud = new StatsCollector(bufferCapacity)), (this.audio = new StatsCollector(bufferCapacity)), (this.work = new StatsCollector(bufferCapacity)), (this.interval = new StatsCollector(bufferCapacity)), (this.steps = new StatsCollector(bufferCapacity)))
  }
  frame(simMs, renderMs, hudMs, audioMs, workMs, intervalMs, stepCount) {
    ;(this.frames++, this.sim.push(simMs), this.render.push(renderMs), this.hud.push(hudMs), this.audio.push(audioMs), this.work.push(workMs), this.steps.push(stepCount), intervalMs > 0 && this.interval.push(intervalMs))
  }
  get fps() {
    const avgIntervalMs = this.interval.avg
    return avgIntervalMs > 0 ? 1e3 / avgIntervalMs : 0
  }
  static summarize(statsCollector) {
    return { avg: roundToThreeDecimals(statsCollector.avg), p95: roundToThreeDecimals(statsCollector.percentile(0.95)), max: roundToThreeDecimals(statsCollector.max), peak: roundToThreeDecimals(statsCollector.peak), last: roundToThreeDecimals(statsCollector.last) }
  }
  snapshot() {
    return {
      fps: roundToThreeDecimals(this.fps),
      frames: this.frames,
      stepsPerFrame: roundToThreeDecimals(this.steps.avg),
      sim: FrameStats.summarize(this.sim),
      render: FrameStats.summarize(this.render),
      hud: FrameStats.summarize(this.hud),
      audio: FrameStats.summarize(this.audio),
      work: FrameStats.summarize(this.work),
      interval: FrameStats.summarize(this.interval),
    }
  }
  reset() {
    this.frames = 0
    for (const step of [this.sim, this.render, this.hud, this.audio, this.work, this.interval, this.steps]) step.reset()
  }
}

function createSettingsDraft(baseSettings, optionOverrides, onDraftChange) {
  const savedSettings = { ...baseSettings },
    pendingChanges = {}
  for (const keyst of Object.keys(optionOverrides)) {
    const selectedT = optionOverrides[keyst]
    selectedT !== void 0 && (pendingChanges[keyst] = selectedT)
  }
  const currentDraft = { ...savedSettings, ...pendingChanges }
  return {
    current: currentDraft,
    saved: savedSettings,
    update(draftPatch) {
      for (const keyso of Object.keys(draftPatch)) {
        const selectedO = draftPatch[keyso]
        selectedO !== void 0 && ((savedSettings[keyso] = selectedO), delete pendingChanges[keyso])
      }
      ;(Object.assign(currentDraft, savedSettings, pendingChanges), onDraftChange({ ...savedSettings }))
    },
  }
}

const BOOT_MIN_SPLASH_MS = 650,
  BOOT_MAX_WAIT_MS = 1100,
  BOOT_POLL_INTERVAL_MS = 50,
  RESIZE_LOOP_RE = /ResizeObserver loop/i

function generateRunId() {
  return ((Date.now() & 16777215) * 257 + Math.floor(Math.random() * 2147483647)) >>> 0
}

function bootApp() {
  injectHudStyle()
  const parseLaunchOptionsResult = parseLaunchOptions(location.search, location.hash)
  let element = document.getElementById("app")
  element || ((element = document.createElement("div")), (element.id = "app"), document.body.appendChild(element))
  const rootElement = element,
    frameStats = new FrameStats(240),
    bootErrors = []
  let bootStage = "boot",
    activeMatch = null,
    cancelledConfig = { cancelled: !1 },
    bootGeneration = 0,
    errorDialog = null,
    bootAttempts = 0,
    appAlive = !1,
    bootAbortController = new AbortController(),
    pendingCleanup = null
  const runPendingCleanup = () => {
      const cleanupTask = pendingCleanup
      ;((pendingCleanup = null), cleanupTask?.())
    },
    disposeMatch = (matchWorld) => {
      ;(runPendingCleanup(), matchWorld.halt())
      let disposeStarted = !1
      const idleDispose = () => {
        if (!disposeStarted) {
          ;((disposeStarted = !0), pendingCleanup === idleDispose && (pendingCleanup = null))
          try {
            matchWorld.dispose()
          } catch (disposeError) {
            console.error(disposeError)
          }
        }
      }
      pendingCleanup = idleDispose
      const retryDispose = () => {
        typeof window.requestIdleCallback == "function" ? window.requestIdleCallback(idleDispose, { timeout: 1500 }) : window.setTimeout(idleDispose, 0)
      }
      window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(retryDispose)), BOOT_MAX_WAIT_MS)
    },
    restartApp = () => {
      if (!appAlive) {
        try {
          location.reload()
        } catch {}
        return
      }
      ;(bootGeneration++, (cancelledConfig.cancelled = !0), errorDialog?.close(), (errorDialog = null))
      try {
        activeMatch?.dispose()
      } catch (cleanupError) {
        console.error(cleanupError)
      }
      activeMatch = null
      try {
        ;(runPendingCleanup(), bootAbortController.abort(), closeDialogs(), refreshHud())
      } catch (reloadError) {
        console.error(reloadError)
      }
      ;(rootElement.replaceChildren(), P("title"))
    },
    handleBootError = (reportedError, isFatal) => {
      const formatErrorResult = formatError(reportedError)
      if (RESIZE_LOOP_RE.test(formatErrorResult)) return
      if ((bootErrors.length >= BOOT_POLL_INTERVAL_MS && bootErrors.shift(), bootErrors.push(formatErrorResult), finishBoot(), errorDialog)) {
        errorDialog.addDetail(formatErrorResult)
        return
      }
      activeMatch?.setPause("error", !0)
      const errorButtons = [{ label: "重新开始", primary: !0, onClick: restartApp }]
      ;(!isFatal &&
        (!activeMatch || activeMatch.loop.running) &&
        errorButtons.push({
          label: activeMatch ? "继续游戏" : "继续",
          primary: !1,
          onClick() {
            ;((errorDialog = null), activeMatch?.setPause("error", !1))
          },
        }),
        (errorDialog = showAppCardDialog(rootElement, {
          title: "出了点状况",
          tone: "error",
          lines: [isFatal ? "游戏遇到无法继续的错误。点击「重新开始」回到标题页。" : "游戏运行时出现了一个错误。可以尝试继续，或重新开始。"],
          detail: formatErrorResult,
          buttons: errorButtons,
        })))
    }
  ;(window.addEventListener("error", (errorEvent) => {
    ;(!errorEvent.error && !errorEvent.message) || handleBootError(errorEvent.error ?? errorEvent.message, !1)
  }),
    window.addEventListener("unhandledrejection", (rejectionEvent) => handleBootError(rejectionEvent.reason, !1)))
  let settingsDraft, audioMixer
  try {
    injectThemeStyles()
    const lookupKey: SettingsPatch = {}
    ;(parseLaunchOptionsResult.quality && (lookupKey.quality = parseLaunchOptionsResult.quality),
      parseLaunchOptionsResult.showFps && (lookupKey.showFps = !0),
      parseLaunchOptionsResult.autoBuy !== null && (lookupKey.autoBuy = parseLaunchOptionsResult.autoBuy),
      parseLaunchOptionsResult.tutorial !== null && (lookupKey.tutorial = parseLaunchOptionsResult.tutorial),
      parseLaunchOptionsResult.objectiveHints !== null && (lookupKey.objectiveHints = parseLaunchOptionsResult.objectiveHints),
      (settingsDraft = createSettingsDraft(loadMergedSettings({ quality: detectGraphicsQuality() }), lookupKey, saveSettingsToStorage)),
      (audioMixer = createAudioMixer()))
  } catch (initError) {
    ;(console.error(initError),
      bootErrors.push(formatError(initError)),
      finishBoot(),
      showAppCardDialog(rootElement, {
        title: "启动失败",
        tone: "error",
        page: !0,
        lines: ["游戏初始化时出错，无法继续。请重新载入页面；若问题依旧，换用新版浏览器再试。"],
        detail: formatError(initError),
        buttons: [
          {
            label: "重新载入",
            primary: !0,
            onClick() {
              try {
                location.reload()
              } catch {}
            },
          },
        ],
      }))
    return
  }
  appAlive = !0
  const currentSettings = settingsDraft.current,
    applyVolumes = () => audioMixer.setVolumes({ master: currentSettings.masterVolume, sfx: currentSettings.sfxVolume, music: currentSettings.musicVolume })
  applyVolumes()
  const settingsListeners = new Set<SettingsListener>(),
    getSettings = () => currentSettings,
    updateSettings = (towersDestroyed) => {
      ;(settingsDraft.update(towersDestroyed), applyVolumes())
      for (const settingsListener of settingsListeners) settingsListener(towersDestroyed)
    },
    portraitDataCache = new Map(),
    cachedHeroPortrait = (lookupKey) => {
      let getValue = portraitDataCache.get(lookupKey)
      if (getValue === void 0) {
        try {
          getValue = getHeroPortrait(lookupKey)
        } catch (portraitError) {
          ;(console.warn(portraitError), (getValue = ""))
        }
        portraitDataCache.set(lookupKey, getValue)
      }
      return getValue
    },
    getSettingsConfig = { getSettings: getSettings, updateSettings: updateSettings, audio: audioMixer, portrait: cachedHeroPortrait, createHeroPreview: createHeroPreview },
    phaseConfig = {
      get phase() {
        return bootStage
      },
      get world() {
        return activeMatch?.world ?? null
      },
      get state() {
        return activeMatch?.state ?? null
      },
      get renderer() {
        return activeMatch?.renderer ?? null
      },
      get hud() {
        return activeMatch?.hud ?? null
      },
      get loop() {
        return activeMatch?.loop ?? null
      },
      get config() {
        return activeMatch?.config ?? null
      },
      get session() {
        return activeMatch
      },
      audio: audioMixer,
      perf: frameStats,
      settings: currentSettings,
      params: parseLaunchOptionsResult,
      get matches() {
        return bootAttempts
      },
      errors: bootErrors,
      restart: restartApp,
    }
  window.__moba = phaseConfig
  const appConfig = {
      app: rootElement,
      audio: audioMixer,
      menuHost: getSettingsConfig,
      perf: frameStats,
      getSettings: getSettings,
      updateSettings: updateSettings,
      onSettings(event) {
        return (settingsListeners.add(event), () => settingsListeners.delete(event))
      },
      portrait: cachedHeroPortrait,
      onLoopError: (loopError) => {
        ;(console.error(loopError), handleBootError(loopError, !0))
      },
      setPhase(targetObject) {
        bootStage = targetObject
      },
    },
    waitMs = (assists) => new Promise((resolveDelay) => window.setTimeout(resolveDelay, assists))
  async function I(startMode) {
    const startGeneration = ++bootGeneration
    cancelledConfig = { cancelled: !1 }
    const cancelState = cancelledConfig
    bootAbortController = new AbortController()
    const abortSignal = bootAbortController.signal
    let directKind = startMode
    for (;;) {
      let matchChoice
      if (directKind === "direct") matchChoice = { heroId: parseLaunchOptionsResult.hero ?? "chijin", difficulty: parseLaunchOptionsResult.difficulty ?? "normal" }
      else if (((bootStage = "menu"), (matchChoice = await openMenuFlow(rootElement, getSettingsConfig, { start: directKind, signal: abortSignal })), startGeneration !== bootGeneration)) return
      ;(runPendingCleanup(), bootAttempts++)
      const matchHandle = await startMatch(appConfig, matchChoice, { seed: parseLaunchOptionsResult.seed ?? generateRunId(), autoPlay: parseLaunchOptionsResult.auto, speed: parseLaunchOptionsResult.speed, fastLoad: directKind === "direct" }, cancelState)
      if (startGeneration !== bootGeneration) {
        matchHandle?.dispose()
        return
      }
      if (!matchHandle) return
      activeMatch = matchHandle
      const matchResult = await matchHandle.finished
      if (startGeneration !== bootGeneration) return
      if (matchResult.kind === "quit") {
        ;(disposeMatch(matchHandle), (activeMatch = null), (directKind = "title"))
        continue
      }
      ;((bootStage = "result"), matchHandle.disposeHud(), currentSettings.tutorial && !matchHandle.config.autoPlay && updateSettings({ tutorial: !1 }))
      const HudPanelValue = createHudPanel(rootElement, matchResult.state, getSettingsConfig, { signal: abortSignal })
      if ((await waitMs(BOOT_MIN_SPLASH_MS), startGeneration !== bootGeneration)) return
      ;(disposeMatch(matchHandle), (activeMatch = null))
      const againKind = await HudPanelValue
      if (startGeneration !== bootGeneration) return
      directKind = againKind === "again" ? "select" : "title"
    }
  }
  function P(indicator) {
    I(indicator).catch((startError) => {
      ;(console.error(startError), handleBootError(startError, !0))
    })
  }
  const checkWebGL2 = () => {
    if (!isWebGL2Available()) {
      ;((bootStage = "unsupported"),
        finishBoot(),
        showAppCardDialog(rootElement, {
          title: "无法启动星陨战纪",
          page: !0,
          lines: ["游戏需要 WebGL2 图形加速，但当前浏览器或设备没有提供。"],
          list: ["把浏览器更新到最新版本(Chrome、Edge、Safari 15 以上、Firefox 均可)", "在浏览器设置里开启「硬件加速」后重启浏览器", "关闭省电模式，或换一台设备再试"],
          buttons: [{ label: "重新检测", primary: !0, onClick: checkWebGL2 }],
        }))
      return
    }
    if ((P(parseLaunchOptionsResult.skipMenu ? "direct" : "title"), finishBoot(), !parseLaunchOptionsResult.skipMenu)) {
      const precachePortrait = () => {
        cachedHeroPortrait("chijin")
      }
      typeof window.requestIdleCallback == "function" ? window.requestIdleCallback(precachePortrait, { timeout: 3e3 }) : window.setTimeout(precachePortrait, 1200)
    }
  }
  checkWebGL2()
}

export { bootApp }