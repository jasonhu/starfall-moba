/**
 * 小地图渲染
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { createEl, expandCssUnits, injectStyleSheet, svgToDataUrl } from './dom-kit'
import { UI_THEME_COLORS } from './svg-icons'
import { MONSTER_STATS } from '../game-balance'
import { HERO_TABLE } from '../../heroes/registry'

const clampValue = (input, min, max) => (input < min ? min : input > max ? max : input),
  MINIMAP_STYLE = (progress) => (progress < 0 ? 0 : progress > 1 ? 1 : progress)

/**
 * 创建地图。
 *
 * @param host - 来源
 */
function buildMinimapRadar(host) {
  const portraitCache = new Map()
  return (lookupKey) => {
    let Value = portraitCache.get(lookupKey)
    if (Value === void 0) {
      Value = null
      try {
        const portraitResult = host.portrait(lookupKey)
        portraitResult && ((Value = new Image()), (Value.decoding = "async"), (Value.src = portraitResult))
      } catch {
        Value = null
      }
      portraitCache.set(lookupKey, Value)
    }
    return Value && Value.complete && Value.naturalWidth > 0 ? Value : null
  }
}

const MINIMAP_STAR_URL = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0Q8.8 7.2 16 8Q8.8 8.8 8 16Q7.2 8.8 0 8Q7.2 7.2 8 0Z" fill="#ffe7ad"/></svg>'),
  MINIMAP_CSS =
    expandCssUnits(`
.sf-hud__mini {
  position: absolute; left: var(--hud-l); top: var(--hud-t); z-index: 3; width: var(--hud-mini); height: var(--hud-mini); padding: max(2px, 3u); border-radius: 9u;
  background: linear-gradient(180deg, rgba(20, 33, 72, 0.94), rgba(7, 12, 30, 0.96)); box-shadow: 0 6u 18u rgba(2, 4, 12, 0.55);
  touch-action: none; cursor: crosshair;
}
/* 金色星轨描边：与面板同一手法，左上/右下两角最亮 */
.sf-hud__mini::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: conic-gradient(from 315deg at 50% 50%, rgba(255, 231, 173, 0.95) 0deg, rgba(224, 177, 96, 0.4) 40deg, rgba(160, 180, 230, 0.22) 110deg,
    rgba(224, 177, 96, 0.36) 150deg, rgba(255, 231, 173, 0.85) 180deg, rgba(224, 177, 96, 0.36) 212deg, rgba(160, 180, 230, 0.22) 250deg, rgba(224, 177, 96, 0.4) 322deg, rgba(255, 231, 173, 0.95) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
.sf-hud__mini::after { content: ''; position: absolute; left: -6u; top: -6u; width: 14u; height: 14u; pointer-events: none; background-repeat: no-repeat; background-size: contain; }
.sf-hud__mini > canvas { display: block; width: 100%; height: 100%; border-radius: 6u; }
.sf-hud__mini.is-peek { box-shadow: 0 6u 18u rgba(2, 4, 12, 0.55), 0 0 0 1px rgba(143, 233, 255, 0.7), 0 0 14u rgba(92, 214, 247, 0.45); }
@media (orientation: portrait) { .sf-hud { --hud-mini: 136u; } }
`) + `.sf-hud__mini::after { background-image: ${MINIMAP_STAR_URL}; }`,
  TEAM_COLORS = [UI_THEME_COLORS.blue, UI_THEME_COLORS.red],
  MONSTER_MARKER_COLORS = { mossback: "#e2cf7a", glimwing: "#e2cf7a", frost_golem: "#4da3ff", ember_golem: "#ff5d5d", abyss_drake: "#c09bff", star_colossus: "#ffd76a" },
  MONSTER_MARKER_SHAPES = { mossback: "diamond", glimwing: "diamond", frost_golem: "dot", ember_golem: "dot", abyss_drake: "triangle", star_colossus: "diamond" },
  GUIDE_PING_RGB = "255, 214, 130",
  PING_DURATIONS = { kill: 1.8, alert: 2.4, tower: 2.6, epic: 2.6 }

/**
 * 创建地图。
 *
 * @param world - 战场
 */
function createMinimap(world) {
  injectStyleSheet("sf-hud-mini", MINIMAP_CSS)
  const { host: gameHost } = world,
    mapConfig = world.state.map,
    worldHalfExtent = mapConfig.bound + 3,
    element = document.createElement("canvas"),
    createElElement = createEl("div", "sf-hud__mini", element)
  ;(createElElement.setAttribute("data-hud-hit", ""), createElElement.setAttribute("role", "img"), createElElement.setAttribute("aria-label", "小地图：按住拖动可观察战场"))
  const ContextValue = element.getContext("2d"),
    ElementValue = document.createElement("canvas"),
    MinimapRadarValue = buildMinimapRadar(gameHost)
  let canvasSize = 0,
    worldToPixelScale = 1,
    uiScale = 1,
    isActive = !0,
    lastResizeAt = -1,
    lastRepaintAt = -1,
    layoutWidth = 0
  const heroIconCache = new Map(),
    labelCache = new Map(),
    pings = [],
    onConfig = { on: !1, x: 0, y: 0, t0: 0 },
    alertTimeByUnit = new Map(),
    ownStructureIds = new Set()
  for (const builder of world.state.units) (builder.kind === "tower" || builder.kind === "core") && builder.team === world.team && ownStructureIds.add(builder.id)
  const visibleHeroes = [],
    structures = [],
    worldToMapX = (towersDestroyed) => (towersDestroyed + worldHalfExtent) * worldToPixelScale,
    worldToMapY = (worldY) => (worldY + worldHalfExtent) * worldToPixelScale
  function T(ctx, points) {
    ctx.beginPath()
    for (let index = 0; index < points.length; index++) index === 0 ? ctx.moveTo(worldToMapX(points[index].x), worldToMapY(points[index].y)) : ctx.lineTo(worldToMapX(points[index].x), worldToMapY(points[index].y))
    ctx.closePath()
  }
  function E(ctx, points) {
    ctx.beginPath()
    for (let index = 0; index < points.length; index++) index === 0 ? ctx.moveTo(worldToMapX(points[index].x), worldToMapY(points[index].y)) : ctx.lineTo(worldToMapX(points[index].x), worldToMapY(points[index].y))
  }
  function A() {
    ElementValue.width = ElementValue.height = canvasSize
    const getContextContextValue = ElementValue.getContext("2d")
    if (!getContextContextValue) return
    const mapBound = mapConfig.bound
    ;((getContextContextValue.fillStyle = "#070d1a"), getContextContextValue.fillRect(0, 0, canvasSize, canvasSize))
    const bResult = worldToMapX(-mapBound),
      wResult = worldToMapY(-mapBound),
      mapPixelSpan = 2 * mapBound * worldToPixelScale,
      mapFrameCornerRadius = 4 * worldToPixelScale
    ;(getContextContextValue.save(),
      getContextContextValue.beginPath(),
      getContextContextValue.moveTo(bResult + mapFrameCornerRadius, wResult),
      getContextContextValue.arcTo(bResult + mapPixelSpan, wResult, bResult + mapPixelSpan, wResult + mapPixelSpan, mapFrameCornerRadius),
      getContextContextValue.arcTo(bResult + mapPixelSpan, wResult + mapPixelSpan, bResult, wResult + mapPixelSpan, mapFrameCornerRadius),
      getContextContextValue.arcTo(bResult, wResult + mapPixelSpan, bResult, wResult, mapFrameCornerRadius),
      getContextContextValue.arcTo(bResult, wResult, bResult + mapPixelSpan, wResult, mapFrameCornerRadius),
      getContextContextValue.closePath(),
      getContextContextValue.clip())
    const RadialGradientValue = getContextContextValue.createRadialGradient(canvasSize / 2, canvasSize / 2, canvasSize * 0.05, canvasSize / 2, canvasSize / 2, canvasSize * 0.72)
    ;(RadialGradientValue.addColorStop(0, "#2c6a50"),
      RadialGradientValue.addColorStop(1, "#1b4238"),
      (getContextContextValue.fillStyle = RadialGradientValue),
      getContextContextValue.fillRect(0, 0, canvasSize, canvasSize),
      (getContextContextValue.lineCap = "round"),
      (getContextContextValue.lineJoin = "round"),
      E(getContextContextValue, mapConfig.river),
      (getContextContextValue.strokeStyle = "#236f95"),
      (getContextContextValue.lineWidth = mapConfig.riverWidth * worldToPixelScale),
      getContextContextValue.stroke(),
      E(getContextContextValue, mapConfig.river),
      (getContextContextValue.strokeStyle = "rgba(110, 205, 235, 0.55)"),
      (getContextContextValue.lineWidth = mapConfig.riverWidth * worldToPixelScale * 0.5),
      getContextContextValue.stroke())
    for (const lane of [mapConfig.lanes.top, mapConfig.lanes.bot, mapConfig.lanes.mid])
      (E(getContextContextValue, lane), (getContextContextValue.strokeStyle = "#8f7d55"), (getContextContextValue.lineWidth = mapConfig.laneWidth * worldToPixelScale * 0.78), getContextContextValue.stroke(), E(getContextContextValue, lane), (getContextContextValue.strokeStyle = "#b9a577"), (getContextContextValue.lineWidth = mapConfig.laneWidth * worldToPixelScale * 0.5), getContextContextValue.stroke())
    for (const base of mapConfig.bases) {
      const baseTeamRgb = base.team === 0 ? "77, 163, 255" : "255, 93, 93"
      ;(T(getContextContextValue, base.area),
        (getContextContextValue.fillStyle = `rgba(${baseTeamRgb}, 0.32)`),
        getContextContextValue.fill(),
        (getContextContextValue.strokeStyle = `rgba(${baseTeamRgb}, 0.75)`),
        (getContextContextValue.lineWidth = Math.max(1, 1.2 * uiScale)),
        getContextContextValue.stroke(),
        getContextContextValue.beginPath(),
        getContextContextValue.arc(worldToMapX(base.fountain.x), worldToMapY(base.fountain.y), base.fountainRadius * worldToPixelScale, 0, Math.PI * 2),
        (getContextContextValue.fillStyle = `rgba(${baseTeamRgb}, 0.55)`),
        getContextContextValue.fill())
    }
    getContextContextValue.fillStyle = "rgba(132, 178, 74, 0.9)"
    for (const bush of mapConfig.bushes) (T(getContextContextValue, bush), getContextContextValue.fill())
    for (const wall of mapConfig.walls) (T(getContextContextValue, wall), (getContextContextValue.fillStyle = "#131d30"), getContextContextValue.fill(), (getContextContextValue.strokeStyle = "#42557a"), (getContextContextValue.lineWidth = Math.max(1, 1.1 * uiScale)), getContextContextValue.stroke())
    getContextContextValue.restore()
    const createRadialGradientRadialGradientValue = getContextContextValue.createRadialGradient(canvasSize / 2, canvasSize / 2, canvasSize * 0.42, canvasSize / 2, canvasSize / 2, canvasSize * 0.74)
    ;(createRadialGradientRadialGradientValue.addColorStop(0, "rgba(4, 8, 22, 0)"), createRadialGradientRadialGradientValue.addColorStop(1, "rgba(4, 8, 22, 0.55)"), (getContextContextValue.fillStyle = createRadialGradientRadialGradientValue), getContextContextValue.fillRect(0, 0, canvasSize, canvasSize))
  }
  function C() {
    const cssWidth = layoutWidth > 0 ? layoutWidth : element.clientWidth
    if (cssWidth <= 0) return
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1),
      canvasPixelSize = Math.max(64, Math.round(cssWidth * pixelRatio))
    ;((isActive = !1), canvasPixelSize !== canvasSize && ((canvasSize = canvasPixelSize), (element.width = element.height = canvasPixelSize), (worldToPixelScale = canvasSize / (2 * worldHalfExtent)), (uiScale = canvasSize / 172), heroIconCache.clear(), labelCache.clear(), A(), (lastRepaintAt = -1)))
  }
  function R(lookupKey) {
    let getValue = labelCache.get(lookupKey)
    if (getValue) return getValue
    labelCache.size > 6 && labelCache.clear()
    const labelFontSize = Math.round(8.5 * uiScale),
      labelPadding = Math.ceil(2.4 * uiScale) + 1
    ;((getValue = document.createElement("canvas")), (getValue.width = Math.ceil(labelFontSize * 0.62 * lookupKey.length) + labelPadding * 2), (getValue.height = labelFontSize + labelPadding * 2))
    const ContextResult = getValue.getContext("2d")
    return ContextResult
      ? ((ContextResult.font = `700 ${labelFontSize}px "DIN Alternate", "Roboto Condensed", sans-serif`),
        (ContextResult.textAlign = "center"),
        (ContextResult.textBaseline = "middle"),
        (ContextResult.lineWidth = Math.max(2, 2.4 * uiScale)),
        (ContextResult.strokeStyle = "rgba(6, 10, 22, 0.9)"),
        ContextResult.strokeText(lookupKey, getValue.width / 2, getValue.height / 2),
        (ContextResult.fillStyle = "#f4ecff"),
        ContextResult.fillText(lookupKey, getValue.width / 2, getValue.height / 2),
        labelCache.set(lookupKey, getValue),
        getValue)
      : null
  }
  function I(hero, isLocalPlayer) {
    const lookupKey = `${hero.heroId}|${isLocalPlayer ? "me" : hero.team}`
    let Result = heroIconCache.get(lookupKey)
    if (Result) return Result
    const lResult = MinimapRadarValue(hero.heroId)
    if (!lResult) return null
    const iconRadius = (isLocalPlayer ? 7.4 : 6.2) * uiScale,
      outerRingRadius = iconRadius + 1.4 * uiScale,
      iconSize = Math.ceil(outerRingRadius * 2) + 2,
      iconCenter = iconSize / 2
    ;((Result = document.createElement("canvas")), (Result.width = Result.height = iconSize))
    const iconCtx = Result.getContext("2d")
    return iconCtx
      ? (iconCtx.beginPath(),
        iconCtx.arc(iconCenter, iconCenter, outerRingRadius, 0, Math.PI * 2),
        (iconCtx.fillStyle = "rgba(6, 10, 22, 0.92)"),
        iconCtx.fill(),
        iconCtx.save(),
        iconCtx.beginPath(),
        iconCtx.arc(iconCenter, iconCenter, iconRadius, 0, Math.PI * 2),
        iconCtx.clip(),
        iconCtx.drawImage(lResult, iconCenter - iconRadius, iconCenter - iconRadius, iconRadius * 2, iconRadius * 2),
        iconCtx.restore(),
        iconCtx.beginPath(),
        iconCtx.arc(iconCenter, iconCenter, iconRadius, 0, Math.PI * 2),
        (iconCtx.strokeStyle = isLocalPlayer ? UI_THEME_COLORS.me : TEAM_COLORS[hero.team]),
        (iconCtx.lineWidth = Math.max(1.2, 1.7 * uiScale)),
        iconCtx.stroke(),
        heroIconCache.set(lookupKey, Result),
        Result)
      : null
  }
  function P(ctx, centerX, centerY, size) {
    ;(ctx.beginPath(), ctx.moveTo(centerX, centerY - size), ctx.lineTo(centerX + size, centerY), ctx.lineTo(centerX, centerY + size), ctx.lineTo(centerX - size, centerY), ctx.closePath())
  }
  function F(ctx, centerX, centerY, size) {
    ;(ctx.beginPath(), ctx.moveTo(centerX, centerY - size * 1.1), ctx.lineTo(centerX + size, centerY + size * 0.8), ctx.lineTo(centerX - size, centerY + size * 0.8), ctx.closePath())
  }
  function L(ctx, dotKind, centerX, centerY, size) {
    dotKind === "dot" ? (ctx.beginPath(), ctx.arc(centerX, centerY, size, 0, Math.PI * 2)) : dotKind === "triangle" ? F(ctx, centerX, centerY, size) : P(ctx, centerX, centerY, size)
  }
  function B(ctx) {
    const campStates = world.state.camps
    for (const camp of mapConfig.camps) {
      const campState = campStates[camp.id] && campStates[camp.id].campId === camp.id ? campStates[camp.id] : campStates.find((candidate) => candidate.campId === camp.id),
        isEpic = MONSTER_STATS[camp.monsterType].epic,
        selectedMONSTER_MARKER_SHAPES = MONSTER_MARKER_SHAPES[camp.monsterType],
        isDot = selectedMONSTER_MARKER_SHAPES === "dot",
        markerRadius = (isEpic ? 5.2 : isDot ? 2.9 : 2.6) * uiScale,
        bBResult = worldToMapX(camp.pos.x),
        wWResult = worldToMapY(camp.pos.y),
        selectedMONSTER_MARKER_COLORS = MONSTER_MARKER_COLORS[camp.monsterType]
      if (!campState || campState.alive) {
        ;(L(ctx, selectedMONSTER_MARKER_SHAPES, bBResult, wWResult, markerRadius),
          (ctx.fillStyle = selectedMONSTER_MARKER_COLORS),
          ctx.fill(),
          (ctx.lineWidth = Math.max(1, 1.2 * uiScale)),
          (ctx.strokeStyle = "rgba(6, 10, 22, 0.9)"),
          ctx.stroke(),
          isDot
            ? (ctx.beginPath(), ctx.arc(bBResult, wWResult, markerRadius + 2 * uiScale, 0, Math.PI * 2), (ctx.strokeStyle = selectedMONSTER_MARKER_COLORS), (ctx.lineWidth = Math.max(1, uiScale)), ctx.stroke())
            : isEpic &&
              (L(ctx, selectedMONSTER_MARKER_SHAPES, bBResult, wWResult, markerRadius + 2.4 * uiScale),
              (ctx.strokeStyle = selectedMONSTER_MARKER_COLORS),
              (ctx.lineWidth = Math.max(1, uiScale)),
              ctx.stroke(),
              camp.monsterType === "star_colossus" && (L(ctx, selectedMONSTER_MARKER_SHAPES, bBResult, wWResult, markerRadius + 4.6 * uiScale), (ctx.globalAlpha = 0.7), ctx.stroke(), (ctx.globalAlpha = 1))))
        continue
      }
      ;(L(ctx, selectedMONSTER_MARKER_SHAPES, bBResult, wWResult, markerRadius), (ctx.fillStyle = "rgba(6, 10, 22, 0.6)"), ctx.fill(), (ctx.strokeStyle = selectedMONSTER_MARKER_COLORS), (ctx.globalAlpha = 0.55), (ctx.lineWidth = Math.max(1, uiScale)), ctx.stroke(), (ctx.globalAlpha = 1))
      const respawnDuration = Math.max(camp.respawn, camp.firstSpawn, 1),
        clampValueResult = clampValue(1 - campState.respawnIn / respawnDuration, 0, 1)
      if ((ctx.beginPath(), ctx.arc(bBResult, wWResult, markerRadius + (isDot ? 2 : 1.8) * uiScale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampValueResult), (ctx.strokeStyle = selectedMONSTER_MARKER_COLORS), (ctx.lineWidth = Math.max(1, 1.3 * uiScale)), ctx.stroke(), isEpic)) {
        const respawnSeconds = Math.ceil(campState.respawnIn),
          respawnLabel = respawnSeconds >= 60 ? `${Math.floor(respawnSeconds / 60)}:${String(respawnSeconds % 60).padStart(2, "0")}` : String(respawnSeconds),
          rResult = R(respawnLabel)
        rResult && ctx.drawImage(rResult, Math.round(bBResult - rResult.width / 2), Math.round(wWResult + markerRadius + 8 * uiScale - rResult.height / 2))
      }
    }
  }
  function G(ctx) {
    for (const structure of structures) {
      const mapX = worldToMapX(structure.pos.x),
        mapY = worldToMapY(structure.pos.y),
        selectedTEAM_COLORS = TEAM_COLORS[structure.team === 1 ? 1 : 0]
      if (structure.kind === "core") {
        const coreRadius = 6.4 * uiScale
        ;(P(ctx, mapX, mapY, coreRadius + 2 * uiScale), (ctx.fillStyle = "rgba(6, 10, 22, 0.85)"), ctx.fill(), P(ctx, mapX, mapY, coreRadius), (ctx.fillStyle = selectedTEAM_COLORS), ctx.fill(), P(ctx, mapX, mapY, coreRadius * 0.45), (ctx.fillStyle = "#ffffff"), ctx.fill())
      } else {
        const towerHalfSize = 3.3 * uiScale
        ;((ctx.fillStyle = "rgba(6, 10, 22, 0.9)"),
          ctx.fillRect(mapX - towerHalfSize - uiScale, mapY - towerHalfSize - uiScale, (towerHalfSize + uiScale) * 2, (towerHalfSize + uiScale) * 2),
          (ctx.fillStyle = selectedTEAM_COLORS),
          ctx.fillRect(mapX - towerHalfSize, mapY - towerHalfSize, towerHalfSize * 2, towerHalfSize * 2),
          (ctx.fillStyle = "rgba(255, 255, 255, 0.85)"),
          ctx.fillRect(mapX - towerHalfSize * 0.38, mapY - towerHalfSize * 0.38, towerHalfSize * 0.76, towerHalfSize * 0.76))
      }
    }
  }
  function q(ctx, hero, currentTime) {
    const mapX = worldToMapX(hero.pos.x),
      mapY = worldToMapY(hero.pos.y),
      isLocalPlayer = hero.id === world.state.playerId,
      heroRadius = (isLocalPlayer ? 7.4 : 6.2) * uiScale,
      markerColor = isLocalPlayer ? UI_THEME_COLORS.me : TEAM_COLORS[hero.team]
    if (isLocalPlayer) {
      const pulse = 0.5 + 0.5 * Math.sin(currentTime * 4)
      ;(ctx.beginPath(), ctx.arc(mapX, mapY, heroRadius + (3 + pulse * 2.5) * uiScale, 0, Math.PI * 2), (ctx.strokeStyle = `rgba(183, 243, 107, ${0.55 - pulse * 0.3})`), (ctx.lineWidth = Math.max(1, 1.4 * uiScale)), ctx.stroke())
      const facingX = Math.cos(hero.facing),
        facingY = Math.sin(hero.facing),
        arrowTipDistance = heroRadius + 5.5 * uiScale,
        arrowBaseDistance = heroRadius + 1.2 * uiScale,
        arrowWingWidth = 3.2 * uiScale
      ;(ctx.beginPath(),
        ctx.moveTo(mapX + facingX * arrowTipDistance, mapY + facingY * arrowTipDistance),
        ctx.lineTo(mapX + facingX * arrowBaseDistance - facingY * arrowWingWidth, mapY + facingY * arrowBaseDistance + facingX * arrowWingWidth),
        ctx.lineTo(mapX + facingX * arrowBaseDistance + facingY * arrowWingWidth, mapY + facingY * arrowBaseDistance - facingX * arrowWingWidth),
        ctx.closePath(),
        (ctx.fillStyle = UI_THEME_COLORS.me),
        ctx.fill())
    }
    const iResult = I(hero, isLocalPlayer)
    if (iResult) {
      ctx.drawImage(iResult, Math.round(mapX - iResult.width / 2), Math.round(mapY - iResult.height / 2))
      return
    }
    ;(ctx.beginPath(),
      ctx.arc(mapX, mapY, heroRadius + 1.4 * uiScale, 0, Math.PI * 2),
      (ctx.fillStyle = "rgba(6, 10, 22, 0.92)"),
      ctx.fill(),
      ctx.beginPath(),
      ctx.arc(mapX, mapY, heroRadius, 0, Math.PI * 2),
      (ctx.fillStyle = HERO_TABLE[hero.heroId].palette.primary),
      ctx.fill(),
      (ctx.strokeStyle = markerColor),
      (ctx.lineWidth = Math.max(1.2, 1.7 * uiScale)),
      ctx.stroke())
  }
  function et(ctx) {
    const screenWidth = window.innerWidth,
      screenHeight = window.innerHeight,
      screenToGroundResult = gameHost.screenToGround(0, 0),
      groundTopRight = gameHost.screenToGround(screenWidth, 0),
      groundBottomRight = gameHost.screenToGround(screenWidth, screenHeight),
      groundBottomLeft = gameHost.screenToGround(0, screenHeight)
    !screenToGroundResult ||
      !groundTopRight ||
      !groundBottomRight ||
      !groundBottomLeft ||
      (ctx.beginPath(),
      ctx.moveTo(worldToMapX(screenToGroundResult.x), worldToMapY(screenToGroundResult.y)),
      ctx.lineTo(worldToMapX(groundTopRight.x), worldToMapY(groundTopRight.y)),
      ctx.lineTo(worldToMapX(groundBottomRight.x), worldToMapY(groundBottomRight.y)),
      ctx.lineTo(worldToMapX(groundBottomLeft.x), worldToMapY(groundBottomLeft.y)),
      ctx.closePath(),
      (ctx.fillStyle = "rgba(255, 255, 255, 0.07)"),
      ctx.fill(),
      (ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"),
      (ctx.lineWidth = Math.max(1, 1.1 * uiScale)),
      ctx.stroke())
  }
  function ct(ctx, currentTime) {
    for (let index = pings.length - 1; index >= 0; index--) {
      const selectedY = pings[index],
        selectedPING_DURATIONS = PING_DURATIONS[selectedY.kind],
        pingProgress = (currentTime - selectedY.t0) / selectedPING_DURATIONS
      if (pingProgress >= 1) {
        pings.splice(index, 1)
        continue
      }
      const mapX = worldToMapX(selectedY.x),
        mapY = worldToMapY(selectedY.y),
        ringCount = selectedY.kind === "kill" ? 2 : 3
      for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
        const ringPhase = pingProgress * ringCount - ringIndex
        ringPhase <= 0 ||
          ringPhase >= 1 ||
          (ctx.beginPath(),
          ctx.arc(mapX, mapY, (3 + ringPhase * (selectedY.kind === "kill" ? 13 : 18)) * uiScale, 0, Math.PI * 2),
          (ctx.strokeStyle = selectedY.color),
          (ctx.globalAlpha = (1 - ringPhase) * 0.95),
          (ctx.lineWidth = Math.max(1.2, (2.4 - ringPhase * 1.4) * uiScale)),
          ctx.stroke())
      }
      if (((ctx.globalAlpha = Math.min(1, (1 - pingProgress) * 2.5)), selectedY.kind === "kill")) {
        const killMarkSize = 3.6 * uiScale
        ;(ctx.beginPath(),
          ctx.moveTo(mapX - killMarkSize, mapY - killMarkSize),
          ctx.lineTo(mapX + killMarkSize, mapY + killMarkSize),
          ctx.moveTo(mapX + killMarkSize, mapY - killMarkSize),
          ctx.lineTo(mapX - killMarkSize, mapY + killMarkSize),
          (ctx.lineWidth = Math.max(2.4, 3.4 * uiScale)),
          (ctx.strokeStyle = "rgba(6, 10, 22, 0.9)"),
          ctx.stroke(),
          (ctx.lineWidth = Math.max(1.4, 1.9 * uiScale)),
          (ctx.strokeStyle = selectedY.color),
          ctx.stroke())
      } else selectedY.kind === "alert" && Math.floor((currentTime - selectedY.t0) * 6) % 2 === 0 && ((ctx.fillStyle = "#fff1f1"), ctx.fillRect(mapX - uiScale, mapY - 11 * uiScale, 2 * uiScale, 6 * uiScale), ctx.fillRect(mapX - uiScale, mapY - 4 * uiScale, 2 * uiScale, 2 * uiScale))
      ctx.globalAlpha = 1
    }
  }
  function rt(ctx, currentTime, localHero) {
    const guideX = worldToMapX(onConfig.x),
      guideY = worldToMapY(onConfig.y)
    if (localHero) {
      const playerMapX = worldToMapX(localHero.pos.x),
        playerMapY = worldToMapY(localHero.pos.y)
      Math.hypot(guideX - playerMapX, guideY - playerMapY) > 12 * uiScale &&
        (ctx.save(),
        ctx.setLineDash([4 * uiScale, 3.5 * uiScale]),
        (ctx.lineDashOffset = -((currentTime - onConfig.t0) * 14 * uiScale)),
        ctx.beginPath(),
        ctx.moveTo(playerMapX, playerMapY),
        ctx.lineTo(guideX, guideY),
        (ctx.lineWidth = Math.max(2.6, 3.2 * uiScale)),
        (ctx.strokeStyle = "rgba(6, 10, 22, 0.75)"),
        ctx.stroke(),
        (ctx.lineWidth = Math.max(1.4, 1.7 * uiScale)),
        (ctx.strokeStyle = `rgba(${GUIDE_PING_RGB}, 0.95)`),
        ctx.stroke(),
        ctx.restore())
    }
    const pingPeriod = 1.2
    for (let index = 0; index < 2; index++) {
      const guidePingPhase = ((((currentTime - onConfig.t0) / pingPeriod + index * 0.5) % 1) + 1) % 1
      ;(ctx.beginPath(), ctx.arc(guideX, guideY, (4 + guidePingPhase * 11) * uiScale, 0, Math.PI * 2), (ctx.strokeStyle = `rgba(${GUIDE_PING_RGB}, ${(1 - guidePingPhase) * 0.95})`), (ctx.lineWidth = Math.max(1.4, (2.6 - guidePingPhase * 1.4) * uiScale)), ctx.stroke())
    }
    ;(ctx.beginPath(),
      ctx.arc(guideX, guideY, 5.6 * uiScale, 0, Math.PI * 2),
      (ctx.lineWidth = Math.max(2.4, 2.8 * uiScale)),
      (ctx.strokeStyle = "rgba(6, 10, 22, 0.8)"),
      ctx.stroke(),
      (ctx.lineWidth = Math.max(1.2, 1.5 * uiScale)),
      (ctx.strokeStyle = `rgb(${GUIDE_PING_RGB})`),
      ctx.stroke())
  }
  function mt(currentTime) {
    if (!ContextValue || canvasSize === 0) return
    const gameState = world.state
    ;(ContextValue.setTransform(1, 0, 0, 1, 0, 0), ContextValue.drawImage(ElementValue, 0, 0), B(ContextValue), (visibleHeroes.length = 0), (structures.length = 0))
    const playerTeam = world.team,
      unitDotSize = Math.max(1.6, 2 * uiScale)
    for (const unit of gameState.units)
      if (unit.alive) {
        if (unit.kind === "tower" || unit.kind === "core") {
          structures.push(unit)
          continue
        }
        unit.kind !== "monster" &&
          ((unit.team !== playerTeam && !unit.visible[playerTeam]) ||
            (unit.kind === "hero" ? visibleHeroes.push(unit) : ((ContextValue.fillStyle = unit.team === 0 ? "#7fc0ff" : "#ff8a8a"), ContextValue.fillRect(worldToMapX(unit.pos.x) - unitDotSize / 2, worldToMapY(unit.pos.y) - unitDotSize / 2, unitDotSize, unitDotSize))))
      }
    ;(G(ContextValue), et(ContextValue))
    let playerHero = null
    for (const enemyHero of visibleHeroes) enemyHero.team !== playerTeam && q(ContextValue, enemyHero, currentTime)
    for (const allyHero of visibleHeroes) allyHero.team === playerTeam && (allyHero.id === gameState.playerId ? (playerHero = allyHero) : q(ContextValue, allyHero, currentTime))
    ;(onConfig.on && rt(ContextValue, currentTime, playerHero), playerHero && q(ContextValue, playerHero, currentTime), ct(ContextValue, currentTime))
  }
  function nt(position, pingKind, color) {
    ;(pings.length > 12 && pings.shift(), pings.push({ x: position.x, y: position.y, t0: world.now, kind: pingKind, color: color }))
  }
  let peekPointerId = null
  const pointerToWorld = (pointerEvent) => {
      const BoundingClientRectValue = element.getBoundingClientRect(),
        mapBound = mapConfig.bound
      return { x: clampValue(((pointerEvent.clientX - BoundingClientRectValue.left) / Math.max(1, BoundingClientRectValue.width)) * 2 * worldHalfExtent - worldHalfExtent, -mapBound, mapBound), y: clampValue(((pointerEvent.clientY - BoundingClientRectValue.top) / Math.max(1, BoundingClientRectValue.height)) * 2 * worldHalfExtent - worldHalfExtent, -mapBound, mapBound) }
    },
    clearCameraPeek = () => {
      peekPointerId !== null && ((peekPointerId = null), createElElement.classList.remove("is-peek"), gameHost.setCameraPeek(null))
    },
    handlePointerDown = (pointerEvent) => {
      if ((pointerEvent.preventDefault(), pointerEvent.pointerType === "mouse" && pointerEvent.button === 2)) {
        world.inputBlocked() || gameHost.command({ type: "moveTo", pos: pointerToWorld(pointerEvent) })
        return
      }
      if (!(pointerEvent.pointerType === "mouse" && pointerEvent.button !== 0) && peekPointerId === null) {
        peekPointerId = pointerEvent.pointerId
        try {
          createElElement.setPointerCapture(pointerEvent.pointerId)
        } catch {}
        ;(createElElement.classList.add("is-peek"), gameHost.setCameraPeek(pointerToWorld(pointerEvent)))
      }
    },
    handlePointerMove = (firstElementChild) => {
      firstElementChild.pointerId === peekPointerId && gameHost.setCameraPeek(pointerToWorld(firstElementChild))
    },
    handlePointerEnd = (pointerEvent) => {
      pointerEvent.pointerId === peekPointerId && clearCameraPeek()
    }
  ;(createElElement.addEventListener("pointerdown", handlePointerDown),
    createElElement.addEventListener("pointermove", handlePointerMove),
    createElElement.addEventListener("pointerup", handlePointerEnd),
    createElElement.addEventListener("pointercancel", handlePointerEnd),
    createElElement.addEventListener("lostpointercapture", (pointerEvent) => {
      pointerEvent.target === createElElement && handlePointerEnd(pointerEvent)
    }))
  const handleResize = () => {
    isActive = !0
  }
  window.addEventListener("resize", handleResize)
  const resizeObserver =
    typeof ResizeObserver == "function"
      ? new ResizeObserver((entries) => {
          const observedWidth = entries.length > 0 ? entries[entries.length - 1].contentRect.width : 0
          observedWidth > 0 && observedWidth !== layoutWidth && ((layoutWidth = observedWidth), (isActive = !0))
        })
      : null
  return (
    resizeObserver?.observe(element),
    {
      el: createElElement,
      setGuide(guidePosition) {
        if (!guidePosition) {
          ;(onConfig.on && (lastRepaintAt = -1), (onConfig.on = !1))
          return
        }
        const isNewGuide = !onConfig.on
        ;(isNewGuide && (onConfig.t0 = world.now), (onConfig.on = !0), (onConfig.x = guidePosition.x), (onConfig.y = guidePosition.y), isNewGuide && canvasSize > 0 && ((lastRepaintAt = world.now), mt(world.now)))
      },
      update(worldState) {
        const currentTime = worldState.now
        ;(isActive || (!resizeObserver && currentTime - lastResizeAt > 1)) && ((lastResizeAt = currentTime), C())
        const repaintInterval = pings.length > 0 || peekPointerId !== null || onConfig.on ? 1 / 30 : 1 / 12
        currentTime - lastRepaintAt >= repaintInterval && ((lastRepaintAt = currentTime), mt(currentTime))
      },
      /**
       * 处理事件。
       *
       * @param gameEvent - 输入
       * @param worldState - 输入
      */
      handleEvent(gameEvent, worldState) {
        switch (gameEvent.type) {
          case "heroKill": {
            const heroResult = worldState.hero(gameEvent.victimId)
            heroResult && nt(heroResult.pos, "kill", heroResult.team === worldState.team ? UI_THEME_COLORS.red : UI_THEME_COLORS.gold200)
            break
          }
          case "damage": {
            if (!ownStructureIds.has(gameEvent.targetId)) break
            const lastAlertAt = alertTimeByUnit.get(gameEvent.targetId) ?? -99
            if (worldState.now - lastAlertAt < 5) break
            const unitResult = worldState.unit(gameEvent.sourceId)
            if (!unitResult || unitResult.kind !== "hero") break
            ;(alertTimeByUnit.set(gameEvent.targetId, worldState.now), nt(gameEvent.pos, "alert", UI_THEME_COLORS.red))
            break
          }
          case "towerDestroyed":
            ;(ownStructureIds.delete(gameEvent.unitId), nt(gameEvent.pos, "tower", gameEvent.team === worldState.team ? UI_THEME_COLORS.red : UI_THEME_COLORS.gold200))
            break
          case "monsterSpawn":
            MONSTER_STATS[gameEvent.monsterType].epic && nt(gameEvent.pos, "epic", MONSTER_MARKER_COLORS[gameEvent.monsterType])
            break
          case "epicSlain":
            nt(gameEvent.pos, "epic", gameEvent.team === worldState.team ? UI_THEME_COLORS.gold200 : UI_THEME_COLORS.red)
            break
        }
      },
      dispose() {
        ;(clearCameraPeek(), resizeObserver?.disconnect(), window.removeEventListener("resize", handleResize), heroIconCache.clear(), labelCache.clear())
      },
    }
  )
}

export { MINIMAP_STYLE, createMinimap }
