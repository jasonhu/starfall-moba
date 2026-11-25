/**
 * 文本与 HUD 光栅化：DPR 缓存、canvas 文字光栅化、状态/队伍配色与 HUD 标记绘制
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MONSTER_STATS } from '../game-balance'

const CJK_FONT_STACK = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif',
  LATIN_FONT_STACK = '"Trebuchet MS","Arial Black","Helvetica Neue",Arial,sans-serif'

function createTextCanvas(width, height, dpr): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas")
  ;((element.width = Math.max(1, Math.ceil(width * dpr))), (element.height = Math.max(1, Math.ceil(height * dpr))))
  const ContextValue = element.getContext("2d")
  if (!ContextValue) throw new Error("2D canvas 不可用")
  return (ContextValue.scale(dpr, dpr), [element, ContextValue])
}

class DprCache {
  map = new Map()
  dpr
  gen = 0
  constructor(pixelRatio) {
    this.dpr = pixelRatio
  }
  setDpr(targetObject) {
    targetObject !== this.dpr && ((this.dpr = targetObject), this.map.clear(), this.gen++)
  }
  get dprKey() {
    return this.gen * 16777216
  }
  get(lookupKey, fontSize, fillColor, strokeColor, fontWeight = 700, fontFamily = CJK_FONT_STACK) {
    const cacheKey = `${lookupKey}|${fontSize}|${fillColor}|${strokeColor}|${fontWeight}|${fontFamily === CJK_FONT_STACK ? 0 : 1}`
    let Value = this.map.get(cacheKey)
    if (Value) return Value
    this.map.size > 400 && this.map.clear()
    const textValue = `${fontWeight} ${fontSize}px ${fontFamily}`,
      [measuringCanvas, measuringContext] = createTextCanvas(4, 4, 1)
    measuringContext.font = textValue
    const measuredTextWidth = Math.ceil(measuringContext.measureText(lookupKey).width)
    measuringCanvas.width = 0
    const padding = Math.ceil(fontSize * 0.22) + 2,
      canvasWidth = measuredTextWidth + padding * 2,
      canvasHeight = Math.ceil(fontSize * 1.3) + padding,
      [canvas, context] = createTextCanvas(canvasWidth, canvasHeight, this.dpr)
    return (
      (context.font = textValue),
      (context.textAlign = "center"),
      (context.textBaseline = "middle"),
      (context.lineJoin = "round"),
      (context.lineWidth = Math.max(2, fontSize * 0.24)),
      (context.strokeStyle = strokeColor),
      context.strokeText(lookupKey, canvasWidth / 2, canvasHeight / 2 + 0.5),
      (context.fillStyle = fillColor),
      context.fillText(lookupKey, canvasWidth / 2, canvasHeight / 2 + 0.5),
      (Value = { canvas: canvas, w: canvasWidth, h: canvasHeight }),
      this.map.set(cacheKey, Value),
      Value
    )
  }
}

const DAMAGE_TEXT_CHARS = "0123456789+-!"

class TextRasterizer {
  canvas
  cell
  height
  advance = []
  dpr
  constructor(fontStyle, pixelRatio) {
    this.dpr = pixelRatio
    const textResult = `${fontStyle.italic ? "italic " : ""}900 ${fontStyle.size}px ${LATIN_FONT_STACK}`,
      padding = Math.ceil(fontStyle.size * 0.2) + 2,
      [measureCanvas, measureContext] = createTextCanvas(4, 4, 1)
    measureContext.font = textResult
    let maxGlyphWidth = 0
    for (const glyph of DAMAGE_TEXT_CHARS) {
      const glyphWidth = measureContext.measureText(glyph).width
      ;(this.advance.push(glyphWidth * 0.92), glyphWidth > maxGlyphWidth && (maxGlyphWidth = glyphWidth))
    }
    ;((measureCanvas.width = 0), (this.cell = Math.ceil(maxGlyphWidth) + padding * 2), (this.height = Math.ceil(fontStyle.size * 1.25) + padding))
    const [atlasCanvas, builder] = createTextCanvas(this.cell * DAMAGE_TEXT_CHARS.length, this.height, pixelRatio)
    ;((builder.font = textResult), (builder.textAlign = "center"), (builder.textBaseline = "middle"), (builder.lineJoin = "round"))
    const LinearGradientValue = builder.createLinearGradient(0, this.height * 0.15, 0, this.height * 0.85)
    ;(LinearGradientValue.addColorStop(0, fontStyle.top), LinearGradientValue.addColorStop(1, fontStyle.bottom))
    for (let index = 0; index < DAMAGE_TEXT_CHARS.length; index++) {
      const glyphCenterX = index * this.cell + this.cell / 2,
        glyphCenterY = this.height / 2 + 0.5
      ;((builder.lineWidth = Math.max(3, fontStyle.size * 0.26)),
        (builder.strokeStyle = "rgba(8,10,20,0.9)"),
        builder.strokeText(DAMAGE_TEXT_CHARS[index], glyphCenterX, glyphCenterY + 1),
        (builder.lineWidth = Math.max(2, fontStyle.size * 0.14)),
        (builder.strokeStyle = fontStyle.stroke),
        builder.strokeText(DAMAGE_TEXT_CHARS[index], glyphCenterX, glyphCenterY),
        (builder.fillStyle = LinearGradientValue),
        builder.fillText(DAMAGE_TEXT_CHARS[index], glyphCenterX, glyphCenterY))
    }
    this.canvas = atlasCanvas
  }
  measure(text) {
    let total = 0
    for (let index = 0; index < text.length; index++) {
      const glyphIndex = DAMAGE_TEXT_CHARS.indexOf(text[index])
      glyphIndex >= 0 && (total += this.advance[glyphIndex])
    }
    return total
  }
  draw(spark, text, textCenterX, textCenterY, textScale) {
    const textWidth = this.measure(text) * textScale
    let total = textCenterX - textWidth / 2
    const dprState = this.dpr,
      glyphDrawHeight = this.height * textScale,
      cellWidth = this.cell * textScale
    for (let index = 0; index < text.length; index++) {
      const glyphIndex = DAMAGE_TEXT_CHARS.indexOf(text[index])
      if (glyphIndex < 0) continue
      const glyphWidth = this.advance[glyphIndex] * textScale
      ;(spark.drawImage(this.canvas, glyphIndex * this.cell * dprState, 0, this.cell * dprState, this.height * dprState, total + glyphWidth / 2 - cellWidth / 2, textCenterY - glyphDrawHeight / 2, cellWidth, glyphDrawHeight), (total += glyphWidth))
    }
  }
}

const STAR_POLYGON_SIDES = 16

function traceStarPolygon(ctx, centerX, centerY, pointCount, outerRadius, innerRadius, startAngle = -Math.PI / 2) {
  ctx.beginPath()
  for (let index = 0; index < pointCount * 2; index++) {
    const angle = startAngle + (index * Math.PI) / pointCount,
      radius = index % 2 === 0 ? outerRadius : innerRadius
    index === 0 ? ctx.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius) : ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius)
  }
  ctx.closePath()
}

const STATUS_EFFECT_KINDS = {
  stun(ctx) {
    ;((ctx.fillStyle = "#ffd84a"), (ctx.strokeStyle = "#5a3a00"), (ctx.lineWidth = 1.2), traceStarPolygon(ctx, 8, 8.4, 5, 7, 3.1), ctx.fill(), ctx.stroke())
  },
  airborne(ctx) {
    ;((ctx.fillStyle = "#dff3ff"),
      (ctx.strokeStyle = "#1c3a66"),
      (ctx.lineWidth = 1.2),
      ctx.beginPath(),
      ctx.moveTo(8, 1.5),
      ctx.lineTo(14, 8),
      ctx.lineTo(10.4, 8),
      ctx.lineTo(10.4, 14.5),
      ctx.lineTo(5.6, 14.5),
      ctx.lineTo(5.6, 8),
      ctx.lineTo(2, 8),
      ctx.closePath(),
      ctx.fill(),
      ctx.stroke())
  },
  root(ctx) {
    ;((ctx.strokeStyle = "#4a3410"), (ctx.lineWidth = 1.1))
    for (const [rootX, rootHeight, rootColor] of [
      [4, 8, "#c89a4a"],
      [8, 12, "#ffcf70"],
      [12, 7, "#c89a4a"],
    ] as [number, number, string][])
      ((ctx.fillStyle = rootColor), ctx.beginPath(), ctx.moveTo(rootX - 2.6, 14.5), ctx.lineTo(rootX, 14.5 - rootHeight), ctx.lineTo(rootX + 2.6, 14.5), ctx.closePath(), ctx.fill(), ctx.stroke())
  },
  silence(ctx) {
    ;((ctx.strokeStyle = "#d8b4ff"), (ctx.lineWidth = 2), ctx.beginPath(), ctx.arc(8, 8, 5.6, 0, Math.PI * 2), ctx.moveTo(4.2, 4.2), ctx.lineTo(11.8, 11.8), ctx.stroke())
  },
  slow(ctx) {
    ;((ctx.strokeStyle = "#b4b8ff"), (ctx.lineWidth = 2.1), (ctx.lineCap = "round"), (ctx.lineJoin = "round"), ctx.beginPath())
    for (const chevronY of [3.4, 8.2]) (ctx.moveTo(3.2, chevronY), ctx.lineTo(8, chevronY + 4.4), ctx.lineTo(12.8, chevronY))
    ctx.stroke()
  },
  burn(ctx) {
    ;((ctx.fillStyle = "#ff7a2a"),
      (ctx.strokeStyle = "#6a1a00"),
      (ctx.lineWidth = 1.1),
      ctx.beginPath(),
      ctx.moveTo(8, 1.5),
      ctx.quadraticCurveTo(14.5, 8, 11.5, 13),
      ctx.quadraticCurveTo(8, 16, 4.5, 13),
      ctx.quadraticCurveTo(1.8, 8.5, 6, 5.5),
      ctx.quadraticCurveTo(6.5, 8, 8, 8),
      ctx.quadraticCurveTo(9.5, 5, 8, 1.5),
      ctx.fill(),
      ctx.stroke(),
      (ctx.fillStyle = "#ffd86a"),
      ctx.beginPath(),
      ctx.ellipse(8, 11.5, 2.2, 2.8, 0, 0, Math.PI * 2),
      ctx.fill())
  },
  mark(ctx) {
    ;((ctx.lineCap = "round"),
      (ctx.strokeStyle = "#4a3200"),
      (ctx.lineWidth = 4.6),
      ctx.beginPath(),
      ctx.arc(0.5, 8, 9, -0.82, 0.82),
      ctx.stroke(),
      (ctx.strokeStyle = "#ffd98a"),
      (ctx.lineWidth = 2.6),
      ctx.beginPath(),
      ctx.arc(0.5, 8, 9, -0.82, 0.82),
      ctx.stroke(),
      (ctx.strokeStyle = "#fff6da"),
      (ctx.lineWidth = 1),
      ctx.beginPath(),
      ctx.arc(0.5, 8, 9.3, -0.5, 0.5),
      ctx.stroke())
  },
  focus(ctx) {
    ;((ctx.strokeStyle = "#ff4a38"),
      (ctx.lineWidth = 1.8),
      ctx.beginPath(),
      ctx.arc(8, 8, 5, 0, Math.PI * 2),
      ctx.moveTo(8, 0.8),
      ctx.lineTo(8, 4.6),
      ctx.moveTo(8, 11.4),
      ctx.lineTo(8, 15.2),
      ctx.moveTo(0.8, 8),
      ctx.lineTo(4.6, 8),
      ctx.moveTo(11.4, 8),
      ctx.lineTo(15.2, 8),
      ctx.stroke(),
      (ctx.fillStyle = "#ff4a38"),
      ctx.beginPath(),
      ctx.arc(8, 8, 1.5, 0, Math.PI * 2),
      ctx.fill())
  },
  gale(ctx) {
    ;((ctx.lineCap = "round"), (ctx.lineJoin = "round"))
    const drawGaleGlyph = () => {
      ;(ctx.beginPath(),
        ctx.moveTo(2.6, 13.4),
        ctx.lineTo(11.2, 4.8),
        ctx.stroke(),
        ctx.beginPath(),
        ctx.moveTo(14.2, 1.8),
        ctx.lineTo(13.2, 7.2),
        ctx.lineTo(8.8, 2.8),
        ctx.closePath(),
        ctx.fill(),
        ctx.stroke(),
        ctx.beginPath(),
        ctx.moveTo(2.6, 13.4),
        ctx.lineTo(2.4, 10),
        ctx.moveTo(2.6, 13.4),
        ctx.lineTo(6, 13.6),
        ctx.moveTo(4.6, 11.4),
        ctx.lineTo(4.4, 8.2),
        ctx.moveTo(4.6, 11.4),
        ctx.lineTo(7.8, 11.6),
        ctx.stroke())
    }
    ;((ctx.strokeStyle = "#0f4a3a"), (ctx.fillStyle = "#0f4a3a"), (ctx.lineWidth = 3.2), drawGaleGlyph(), (ctx.strokeStyle = "#f4fff8"), (ctx.fillStyle = "#9dffd8"), (ctx.lineWidth = 1.4), drawGaleGlyph())
  },
  ghost(ctx) {
    ;((ctx.fillStyle = "rgba(190,150,255,0.9)"),
      (ctx.strokeStyle = "#2a1460"),
      (ctx.lineWidth = 1.1),
      ctx.beginPath(),
      ctx.arc(8, 7, 5.2, Math.PI, 0),
      ctx.lineTo(13.2, 14),
      ctx.lineTo(10.6, 12),
      ctx.lineTo(8, 14),
      ctx.lineTo(5.4, 12),
      ctx.lineTo(2.8, 14),
      ctx.closePath(),
      ctx.fill(),
      ctx.stroke())
  },
  lock(ctx) {
    ;((ctx.strokeStyle = "#e8e2cc"), (ctx.fillStyle = "#e8e2cc"), (ctx.lineWidth = 1.8), ctx.beginPath(), ctx.arc(8, 6.2, 3.2, Math.PI, 0), ctx.stroke(), ctx.fillRect(3.6, 6.6, 8.8, 7.4))
  },
  coin(ctx) {
    ;((ctx.fillStyle = "#ffd84a"),
      (ctx.strokeStyle = "#7a4a00"),
      (ctx.lineWidth = 1.3),
      ctx.beginPath(),
      ctx.arc(8, 8, 6.2, 0, Math.PI * 2),
      ctx.fill(),
      ctx.stroke(),
      (ctx.fillStyle = "#fff4b8"),
      traceStarPolygon(ctx, 8, 8, 4, 3.8, 1.5),
      ctx.fill())
  },
}

class CanvasCache {
  map = new Map()
  dpr
  constructor(pixelRatio) {
    this.dpr = pixelRatio
  }
  setDpr(newPixelRatio) {
    newPixelRatio !== this.dpr && ((this.dpr = newPixelRatio), this.map.clear())
  }
  draw(targetCtx, lookupOption, iconCenterX, iconCenterY, iconSize) {
    let getValue = this.map.get(lookupOption)
    if (!getValue) {
      const iconDpr = this.dpr * 2,
        [iconCanvas, iconCtx] = createTextCanvas(STAR_POLYGON_SIDES, STAR_POLYGON_SIDES, iconDpr)
      ;(STATUS_EFFECT_KINDS[lookupOption](iconCtx), (getValue = iconCanvas), this.map.set(lookupOption, getValue))
    }
    targetCtx.drawImage(getValue, iconCenterX - iconSize / 2, iconCenterY - iconSize / 2, iconSize, iconSize)
  }
}

const TEAM_RELATIONS = { self: { fill: "#58d83e", name: "#c4ff9a" }, ally: { fill: "#3f9cf6", name: "#a8d6ff" }, enemy: { fill: "#f0483a", name: "#ff9c8c" }, neutral: { fill: "#f0a630", name: "#ffe2a0" } },
  HUD_PANEL_BACKDROP = "rgba(8,12,24,0.86)",
  HUD_GOLD_TEXT_COLOR = "#ffe6b0",
  HUD_PRIMARY_TEXT_COLOR = "#f4f8ff",
  HUD_ACCENT_BLUE = "#4aa8ff",
  HUD_DARK_BACKDROP = "rgba(6,10,20,0.72)",
  HUD_MUTED_TEXT_COLOR = "#8a8f9c",
  CROWD_CONTROL_KINDS = ["stun", "airborne", "root", "silence"]

function pickStatusIconEmoji(label) {
  const separatorIndex = label.indexOf(" · ")
  return separatorIndex > 0 ? label.slice(0, separatorIndex) : label
}

class HudMarkers {
  avoid = null
  defaults = [
    { left: 0, top: 0, right: 0, bottom: 0 },
    { left: 0, top: 0, right: 0, bottom: 0 },
  ]
  states = new Map()
  stamp = 0
  text
  icons
  a = { x: 0, y: 0, z: 0, height: 2, radius: 0.6, visible: !1, opacity: 1, unit: null }
  p = { x: 0, y: 0 }
  foot = { x: 0, y: 0 }
  order = []
  heroSlots = []
  slotPool = []
  constructor(textRasterizer, iconCache) {
    ;((this.text = textRasterizer), (this.icons = iconCache))
  }
  stateOf(unit) {
    let Result = this.states.get(unit.id)
    return (Result || ((Result = { trail: unit.hp, hold: 0, lastHp: unit.hp, flash: 0, seen: 0, name: null, nameKey: -1, lv: null, lvKey: -1 }), this.states.set(unit.id, Result)), Result)
  }
  advance(unit, speed, dt) {
    ;(unit.hp < speed.lastHp - 0.5 ? ((speed.hold = 0.32), (speed.flash = 0.14)) : unit.hp > speed.trail && (speed.trail = unit.hp),
      (speed.lastHp = unit.hp),
      speed.flash > 0 && (speed.flash -= dt),
      speed.trail > unit.hp && (speed.hold > 0 ? (speed.hold -= dt) : (speed.trail = Math.max(unit.hp, speed.trail - unit.stats.maxHp * 0.9 * dt - (speed.trail - unit.hp) * 4 * dt))))
  }
  draw(hudCtx, world, camera, projectToScreen, viewWidth, viewHeight, hudScale) {
    const frameStamp = ++this.stamp,
      dt = world.dt,
      state = world.state,
      drawOrder = this.order
    drawOrder.length = 0
    for (const minion of state.units) minion.kind === "minion" && drawOrder.push(minion)
    for (const monster of state.units) monster.kind === "monster" && drawOrder.push(monster)
    for (const structure of state.units) (structure.kind === "tower" || structure.kind === "core") && drawOrder.push(structure)
    for (const otherHero of state.units) otherHero.kind === "hero" && otherHero.id !== state.playerId && drawOrder.push(otherHero)
    for (const playerHero of state.units) playerHero.id === state.playerId && drawOrder.push(playerHero)
    const aState = this.a,
      pState = this.p,
      heroSlots = this.heroSlots
    heroSlots.length = 0
    let avoidRects = this.avoid
    if (!avoidRects) {
      avoidRects = this.defaults
      const topAvoidRect = avoidRects[0],
        selectedX = avoidRects[1]
      ;((topAvoidRect.left = viewWidth / 2 - 190 * hudScale), (topAvoidRect.right = viewWidth / 2 + 190 * hudScale), (topAvoidRect.bottom = 52 * hudScale), (selectedX.left = viewWidth / 2 - 170 * hudScale), (selectedX.right = viewWidth / 2 + 170 * hudScale), (selectedX.top = 58 * hudScale), (selectedX.bottom = 98 * hudScale))
    }
    for (const unit of drawOrder) {
      if (!unit.alive) continue
      const stateOfResult = this.stateOf(unit)
      if (((stateOfResult.seen = frameStamp), this.advance(unit, stateOfResult, dt), !camera.get(unit.id, aState) || !aState.visible || !projectToScreen(aState.x, aState.y + aState.height + 0.22, aState.z, pState) || pState.x < -70 || pState.x > viewWidth + 70 || pState.y > viewHeight + 60)) continue
      const isStructure = unit.kind === "tower" || unit.kind === "core",
        isEpicMonster = unit.kind === "monster" && MONSTER_STATS[unit.monsterType].epic,
        isLargeUnit = isStructure || isEpicMonster
      if (pState.y < -30 && (!isLargeUnit || !projectToScreen(aState.x, aState.y + (isStructure ? 2.4 : 1.2), aState.z, this.foot) || this.foot.y < 30 * hudScale)) continue
      const barCenterX = Math.round(pState.x)
      let barCenterY = Math.max((isStructure ? 20 : 16) * hudScale, pState.y)
      if (isLargeUnit && pState.y < 150 * hudScale) {
        const avoidHalfWidth = (unit.kind === "core" ? 64 : isEpicMonster ? 52 : 54) * hudScale,
          avoidClearance = (isEpicMonster ? 34 : 14) * hudScale
        for (let attempt = 0; attempt < 3; attempt++) {
          let isActive = !1
          for (const avoidRect of avoidRects) barCenterX + avoidHalfWidth <= avoidRect.left || barCenterX - avoidHalfWidth >= avoidRect.right || barCenterY - avoidClearance >= avoidRect.bottom || barCenterY <= avoidRect.top || ((barCenterY = avoidRect.bottom + avoidClearance + 4 * hudScale), (isActive = !0))
          if (!isActive) break
        }
      }
      const markerAlpha = aState.opacity >= 0.4 ? 1 : aState.opacity / 0.4
      if (!(markerAlpha <= 0.02))
        switch (((hudCtx.globalAlpha = markerAlpha), unit.kind)) {
          case "hero": {
            const newSlot = this.slotPool[heroSlots.length] ?? (this.slotPool[heroSlots.length] = { u: unit, bs: stateOfResult, x: 0, y: 0, fade: 1, self: !1 })
            ;((newSlot.u = unit), (newSlot.bs = stateOfResult), (newSlot.x = barCenterX), (newSlot.y = barCenterY), (newSlot.fade = markerAlpha), (newSlot.self = unit.id === state.playerId), heroSlots.push(newSlot))
            break
          }
          case "minion":
            unit.hp < unit.stats.maxHp - 0.5 && this.simple(hudCtx, unit, stateOfResult, barCenterX, barCenterY, 34 * hudScale, 4 * hudScale, unit.team === world.playerTeam ? TEAM_RELATIONS.ally.fill : TEAM_RELATIONS.enemy.fill, !1)
            break
          case "monster": {
            if (!isEpicMonster && unit.hp >= unit.stats.maxHp - 0.5) break
            const monsterBarWidth = (isEpicMonster ? 96 : 40 + unit.radius * 24) * hudScale
            if ((this.simple(hudCtx, unit, stateOfResult, barCenterX, barCenterY, monsterBarWidth, (isEpicMonster ? 8 : 5) * hudScale, TEAM_RELATIONS.neutral.fill, isEpicMonster), isEpicMonster)) {
              const nameSprite = this.text.get(MONSTER_STATS[unit.monsterType].name, Math.round(12 * hudScale), TEAM_RELATIONS.neutral.name, "rgba(10,8,2,0.9)")
              hudCtx.drawImage(nameSprite.canvas, barCenterX - nameSprite.w / 2, barCenterY - 10 * hudScale - nameSprite.h, nameSprite.w, nameSprite.h)
            }
            break
          }
          case "tower":
          case "core": {
            const isAlly = unit.team === world.playerTeam,
              towerBarWidth = (unit.kind === "core" ? 128 : 100) * hudScale,
              towerBarHeight = (unit.kind === "core" ? 9 : 8) * hudScale
            ;(this.simple(hudCtx, unit, stateOfResult, barCenterX, barCenterY, towerBarWidth, towerBarHeight, unit.invulnerable ? HUD_MUTED_TEXT_COLOR : isAlly ? TEAM_RELATIONS.ally.fill : TEAM_RELATIONS.enemy.fill, !0), unit.invulnerable && this.icons.draw(hudCtx, "lock", barCenterX - towerBarWidth / 2 - 9 * hudScale, barCenterY - towerBarHeight / 2, 13 * hudScale))
            break
          }
        }
    }
    this.declutter(heroSlots, hudScale)
    for (const heroSlot of heroSlots) ((hudCtx.globalAlpha = heroSlot.fade), this.hero(hudCtx, heroSlot.u, heroSlot.bs, heroSlot.x, heroSlot.y, hudScale, world))
    if (((hudCtx.globalAlpha = 1), (frameStamp & 63) === 0)) for (const [staleUnitId, trackedState] of this.states) trackedState.seen < frameStamp - 60 && this.states.delete(staleUnitId)
  }
  declutter(slots, scale) {
    if (slots.length < 2) return
    const minHorizontalGap = 104 * scale,
      minVerticalGap = 31 * scale
    slots.sort((position, otherSlot) => (position.self ? -1 : otherSlot.self ? 1 : otherSlot.y - position.y))
    for (let index = 1; index < slots.length; index++) {
      const selectedT = slots[index],
        coordY = selectedT.y
      for (let attempt = 0; attempt < 4; attempt++) {
        let moved = !1
        for (let earlierIndex = 0; earlierIndex < index; earlierIndex++) {
          const earlierSlot = slots[earlierIndex]
          if (Math.abs(earlierSlot.x - selectedT.x) >= minHorizontalGap || Math.abs(earlierSlot.y - selectedT.y) >= minVerticalGap) continue
          const candidateY = earlierSlot.y - minVerticalGap
          coordY - candidateY > minVerticalGap * 2.1 || ((selectedT.y = candidateY), (moved = !0))
        }
        if (!moved) break
      }
    }
    slots.sort((slot, otherSlot) => (slot.self ? 1 : otherSlot.self ? -1 : 0))
  }
  simple(ctx, unit, unitState, centerX, centerY, barWidth, barHeight, barColor, showTicks) {
    const barLeftX = Math.round(centerX - barWidth / 2),
      barY = Math.round(centerY - barHeight),
      maxHp = unit.stats.maxHp
    ;((ctx.fillStyle = HUD_PANEL_BACKDROP), ctx.fillRect(barLeftX - 1, barY - 1, barWidth + 2, barHeight + 2))
    const fillWidth = (barWidth * Math.max(0, unit.hp)) / maxHp
    if (
      (unitState.trail > unit.hp && ((ctx.fillStyle = HUD_GOLD_TEXT_COLOR), ctx.fillRect(barLeftX + fillWidth, barY, (barWidth * (unitState.trail - unit.hp)) / maxHp, barHeight)),
      (ctx.fillStyle = barColor),
      ctx.fillRect(barLeftX, barY, fillWidth, barHeight),
      (ctx.fillStyle = "rgba(255,255,255,0.24)"),
      ctx.fillRect(barLeftX, barY, fillWidth, barHeight * 0.4),
      showTicks)
    ) {
      ctx.fillStyle = HUD_DARK_BACKDROP
      const tickStep = maxHp > 9e3 ? 2e3 : 1e3
      for (let total = tickStep; total < maxHp; total += tickStep) ctx.fillRect(barLeftX + Math.round((barWidth * total) / maxHp), barY, 1, barHeight * 0.6)
    }
    unitState.flash > 0 && ((ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, unitState.flash * 6)})`), ctx.fillRect(barLeftX, barY, fillWidth, barHeight))
  }
  /**
   * 处理英雄。
   *
   * @param ctx - 构建器
   * @param unit - 输入
   * @param unitState - 第三输入
   * @param centerX - 第四输入
   * @param centerY - 附加输入
   * @param scale - 附加输入
   * @param world - 战场
  */
  hero(ctx, unit, unitState, centerX, centerY, scale, world) {
    const isSelf = unit.id === world.state.playerId,
      teamColors = isSelf ? TEAM_RELATIONS.self : unit.team === world.playerTeam ? TEAM_RELATIONS.ally : TEAM_RELATIONS.enemy,
      selfScale = isSelf ? 1.08 : 1,
      barWidth = Math.round(92 * scale * selfScale),
      barHeight = Math.round(9 * scale * selfScale),
      manaBarHeight = Math.max(2, Math.round(3 * scale)),
      portraitRadius = 8.5 * scale * selfScale,
      barX = Math.round(centerX - barWidth / 2 + portraitRadius * 0.5),
      barY = Math.round(centerY - barHeight - manaBarHeight - 1),
      maxHp = unit.stats.maxHp,
      maxHpWithShield = Math.max(maxHp, unit.hp + unit.shield)
    ;((ctx.fillStyle = HUD_PANEL_BACKDROP), ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + manaBarHeight + 5))
    const hpFillWidth = (barWidth * Math.max(0, unit.hp)) / maxHpWithShield,
      shieldFillWidth = (barWidth * unit.shield) / maxHpWithShield
    ;(unitState.trail > unit.hp && ((ctx.fillStyle = HUD_GOLD_TEXT_COLOR), ctx.fillRect(barX + hpFillWidth + shieldFillWidth, barY, Math.min(barWidth - hpFillWidth - shieldFillWidth, (barWidth * (unitState.trail - unit.hp)) / maxHpWithShield), barHeight)),
      (ctx.fillStyle = teamColors.fill),
      ctx.fillRect(barX, barY, hpFillWidth, barHeight),
      shieldFillWidth > 0 && ((ctx.fillStyle = HUD_PRIMARY_TEXT_COLOR), ctx.fillRect(barX + hpFillWidth, barY, shieldFillWidth, barHeight)),
      (ctx.fillStyle = "rgba(255,255,255,0.26)"),
      ctx.fillRect(barX, barY, hpFillWidth + shieldFillWidth, barHeight * 0.42),
      (ctx.fillStyle = HUD_DARK_BACKDROP))
    for (let total = 1e3; total < maxHpWithShield; total += 1e3) {
      const isMajorTick = total % 5e3 === 0
      ctx.fillRect(barX + Math.round((barWidth * total) / maxHpWithShield) - (isMajorTick ? 1 : 0), barY, isMajorTick ? 2 : 1, isMajorTick ? barHeight : barHeight * 0.8)
    }
    ;(unitState.flash > 0 && ((ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, unitState.flash * 6)})`), ctx.fillRect(barX, barY, hpFillWidth, barHeight)),
      unit.stats.maxMana > 0 && ((ctx.fillStyle = "rgba(20,34,60,0.9)"), ctx.fillRect(barX, barY + barHeight + 1, barWidth, manaBarHeight), (ctx.fillStyle = HUD_ACCENT_BLUE), ctx.fillRect(barX, barY + barHeight + 1, (barWidth * Math.max(0, unit.mana)) / unit.stats.maxMana, manaBarHeight)))
    const portraitCenterX = barX - portraitRadius * 0.9,
      portraitCenterY = barY + (barHeight + manaBarHeight) / 2
    ;(ctx.beginPath(), ctx.arc(portraitCenterX, portraitCenterY, portraitRadius, 0, Math.PI * 2), (ctx.fillStyle = "#0c1428"), ctx.fill(), (ctx.lineWidth = Math.max(1, 1.4 * scale)), (ctx.strokeStyle = isSelf ? "#d8ff7a" : "#f0c860"), ctx.stroke())
    const dprKey = this.text.dprKey,
      levelKey = unit.level * 4096 + Math.round(scale * selfScale * 100) + dprKey
    ;(!unitState.lv || unitState.lvKey !== levelKey) && ((unitState.lv = this.text.get(String(unit.level), Math.round(10.5 * scale * selfScale), "#ffffff", "rgba(8,12,24,0.9)", 800, LATIN_FONT_STACK)), (unitState.lvKey = levelKey))
    const levelSprite = unitState.lv
    ctx.drawImage(levelSprite.canvas, portraitCenterX - levelSprite.w / 2, portraitCenterY - levelSprite.h / 2, levelSprite.w, levelSprite.h)
    const nameKey = (isSelf ? 1 : unit.team === world.playerTeam ? 2 : 3) * 4096 + Math.round(scale * selfScale * 100) + dprKey
    ;(!unitState.name || unitState.nameKey !== nameKey) && ((unitState.name = this.text.get(pickStatusIconEmoji(unit.name), Math.round((isSelf ? 12 : 11) * scale * selfScale), teamColors.name, "rgba(6,10,20,0.92)", isSelf ? 800 : 600)), (unitState.nameKey = nameKey))
    const nameSprite = unitState.name,
      nameY = barY - 3 * scale - nameSprite.h,
      previousAlpha = ctx.globalAlpha
    ;((ctx.globalAlpha = previousAlpha * (isSelf ? 1 : 0.85)), ctx.drawImage(nameSprite.canvas, centerX - nameSprite.w / 2, nameY, nameSprite.w, nameSprite.h), (ctx.globalAlpha = previousAlpha), this.statusRow(ctx, unit.buffs, centerX, nameY - 7 * scale, scale))
  }
  statusRow(ctx, buffs, centerX, rowY, scale) {
    if (buffs.length === 0) return
    const iconIds = floatTextScratch
    iconIds.length = 0
    let dominantControlBuff = null,
      markStacks = 0,
      focusStacks = 0,
      galeStacks = 0
    for (const buff of buffs)
      switch (buff.id) {
        case "stun":
        case "airborne":
        case "root":
        case "silence":
          ;(iconIds.includes(buff.id) || iconIds.push(buff.id), (!dominantControlBuff || CROWD_CONTROL_KINDS.indexOf(buff.id) < CROWD_CONTROL_KINDS.indexOf(dominantControlBuff.id) || (buff.id === dominantControlBuff.id && buff.timeLeft > dominantControlBuff.timeLeft)) && (dominantControlBuff = buff))
          break
        case "slow":
        case "burn":
          iconIds.includes(buff.id) || iconIds.push(buff.id)
          break
        case "untargetable":
          iconIds.includes("ghost") || iconIds.push("ghost")
          break
        case "xingli_mark":
          markStacks = Math.max(markStacks, buff.stacks)
          break
        case "tower_focus":
          focusStacks = Math.max(focusStacks, buff.stacks)
          break
        case "fengling_gale":
          galeStacks = Math.max(galeStacks, buff.stacks)
          break
      }
    const iconSize = 15 * scale,
      iconGap = 2 * scale,
      iconCount = iconIds.length + Math.min(3, markStacks) + (focusStacks > 0 ? 1 : 0) + (galeStacks > 0 ? 1 : 0)
    if (iconCount === 0) return
    let total = centerX - ((iconSize + iconGap) * iconCount - iconGap) / 2 + iconSize / 2
    const iconY = rowY - iconSize / 2
    for (const iconId of iconIds) (this.icons.draw(ctx, iconId, total, iconY, iconSize), (total += iconSize + iconGap))
    for (let index = 0; index < Math.min(3, markStacks); index++) (this.icons.draw(ctx, "mark", total, iconY, iconSize), (total += iconSize + iconGap))
    if (
      (focusStacks > 0 && (this.icons.draw(ctx, "focus", total, iconY, iconSize), this.stackNum(ctx, focusStacks, total, iconY, scale, "#ff8a78"), (total += iconSize + iconGap)),
      galeStacks > 0 && (this.icons.draw(ctx, "gale", total, iconY, iconSize), this.stackNum(ctx, galeStacks, total, iconY, scale, "#c8ffe8")),
      dominantControlBuff && dominantControlBuff.duration > 0 && Number.isFinite(dominantControlBuff.duration))
    ) {
      const timerWidth = 44 * scale,
        timerHeight = Math.max(2, 3 * scale),
        timerX = Math.round(centerX - timerWidth / 2),
        timerY = Math.round(rowY - iconSize - 5 * scale)
      ;((ctx.fillStyle = HUD_PANEL_BACKDROP), ctx.fillRect(timerX - 1, timerY - 1, timerWidth + 2, timerHeight + 2), (ctx.fillStyle = "#ffd84a"), ctx.fillRect(timerX, timerY, timerWidth * Math.max(0, Math.min(1, dominantControlBuff.timeLeft / dominantControlBuff.duration)), timerHeight))
    }
  }
  stackNum(ctx, count, x, y, scale, color) {
    const countSprite = this.text.get(String(count), Math.round(10 * scale), color, "rgba(6,10,20,0.95)", 800, LATIN_FONT_STACK)
    ctx.drawImage(countSprite.canvas, x + 2 * scale, y + 1 * scale, countSprite.w, countSprite.h)
  }
  reset() {
    this.states.clear()
  }
}

const floatTextScratch = [],
  DAMAGE_TYPE_KINDS = { physical: 0, magic: 1, true: 2, crit: 3, heal: 4, gold: 5 },
  FLOAT_TEXT_STYLES = [
    { size: 21, top: "#fff6e0", bottom: "#ffb45a", stroke: "#8a3a08" },
    { size: 21, top: "#eafcff", bottom: "#6fd0ff", stroke: "#134a94" },
    { size: 21, top: "#ffffff", bottom: "#dfe4f0", stroke: "#4a5068" },
    { size: 31, top: "#fff8b0", bottom: "#ff9a1e", stroke: "#9a2400", italic: !0 },
    { size: 20, top: "#e6ffe0", bottom: "#5fe87a", stroke: "#0f6a2c" },
    { size: 19, top: "#fff6b8", bottom: "#ffc02a", stroke: "#7a4a00" },
  ],
  FLOAT_TEXT_OFFSETS = [
    [0, 0],
    [16, -4],
    [-14, -6],
    [24, -2],
    [-22, -4],
    [8, -8],
    [-8, -8],
    [0, -10],
  ],
  FLOAT_TEXT_LIFT = 21,
  FLOAT_TEXT_POOL_SIZE = 72,
  FLOAT_TEXT_FADE_START = 0.3,
  FLOAT_TEXT_FADE_END = 0.75,
  FLOAT_TEXT_MIN_GAP = 8,
  FLOAT_TEXT_MAX_STACK = 2,
  floatTextEaseOut = (progress) => {
    const offset = progress - 1
    return 1 + offset * offset * (2.9 * offset + 1.9)
  }

export { DAMAGE_TYPE_KINDS, CanvasCache, DprCache, HudMarkers, FLOAT_TEXT_LIFT, FLOAT_TEXT_FADE_END, FLOAT_TEXT_OFFSETS, FLOAT_TEXT_MAX_STACK, TextRasterizer, floatTextEaseOut, FLOAT_TEXT_POOL_SIZE, FLOAT_TEXT_STYLES, FLOAT_TEXT_MIN_GAP, FLOAT_TEXT_FADE_START }