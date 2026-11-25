/**
 * HUD 箭头指示器
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { createEl, expandCssUnits, injectStyleSheet } from './dom-kit'
import { bindClassToggle, createTextWriter } from './status-strip'

const GUIDE_ARROW_CSS = expandCssUnits(`
.sf-hud__garrow { position: absolute; left: 0; top: 0; z-index: 2; width: 0; height: 0; display: none; pointer-events: none; }
.sf-hud__garrow.is-on { display: block; }
/* 目标脚下的椭圆光圈(只在目标进了屏幕时显示) */
.sf-hud__garrow-ring { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
.sf-hud__garrow-ring::before, .sf-hud__garrow-ring::after {
  content: ''; position: absolute; left: calc(var(--w) / -2); top: calc(var(--w) * -0.29); width: var(--w); height: calc(var(--w) * 0.58); border-radius: 50%;
  border: max(2px, 2.5u) solid #ffe7ad; box-shadow: 0 0 10u rgba(255, 214, 130, 0.8), inset 0 0 8u rgba(255, 214, 130, 0.5);
  animation: sf-hud-garrow-ring 1.4s ease-out infinite;
}
.sf-hud__garrow-ring { --w: max(72px, 104u); }
.sf-hud__garrow-ring::after { animation-delay: 0.7s; }
.sf-hud__garrow.is-edge .sf-hud__garrow-ring { display: none; }
/* 箭头本体：外层负责对位，中层负责朝向，内层沿朝向弹动 */
.sf-hud__garrow-mark { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
.sf-hud__garrow-rot { position: absolute; left: 0; top: 0; width: 0; height: 0; }
/* 箭头要在亮的石板地、暗的草地上都看得清：饱和的金色实心 + 一圈深色描边(用两层同形裁切叠出来) + 外发光 */
.sf-hud__garrow-tip {
  --s: max(36px, 46u); position: absolute; left: calc(var(--s) * -1); top: calc(var(--s) / -2); width: var(--s); height: var(--s);
  filter: drop-shadow(0 2px 3px rgba(2, 4, 12, 0.7)) drop-shadow(0 0 8u rgba(255, 196, 64, 0.95));
  animation: sf-hud-garrow-bob 0.8s ease-in-out infinite;
}
.sf-hud__garrow-tip::before, .sf-hud__garrow-tip::after { content: ''; position: absolute; inset: 0; clip-path: polygon(0 30%, 44% 30%, 44% 4%, 100% 50%, 44% 96%, 44% 70%, 0 70%); }
.sf-hud__garrow-tip::before { background: #1c1204; }
.sf-hud__garrow-tip::after { inset: 9%; background: linear-gradient(90deg, #d8891a, #ffc93c 45%, #fff3b0); }
.sf-hud__garrow-label {
  position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) translate(var(--lx, 0px), var(--ly, 0px)); display: flex; flex-direction: column; align-items: center; padding: 2u 9u; border-radius: 10u; white-space: nowrap;
  font-size: var(--sf-fs-xs); font-weight: 800; letter-spacing: 0.06em; line-height: 1.5; color: #2b1a04; background: linear-gradient(180deg, #fff4d6, #e0b160);
  box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.85), 0 3u 8u rgba(2, 4, 12, 0.5);
}
/* 第二行：距离(只在贴边时有) */
.sf-hud__garrow-dist { font-family: var(--sf-font-num); font-weight: 800; line-height: 1.2; letter-spacing: 0.02em; opacity: 0.82; }
.sf-hud__garrow-dist:empty { display: none; }
@keyframes sf-hud-garrow-bob { 0%, 100% { transform: translateX(-28%); } 50% { transform: translateX(0); } }
@keyframes sf-hud-garrow-ring { 0% { transform: scale(0.55); opacity: 1; } 100% { transform: scale(1.15); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .sf-hud__garrow-tip, .sf-hud__garrow-ring::before, .sf-hud__garrow-ring::after { animation: none; } }
`),
  EDGE_INSET_RATIOS = { left: 0.2, right: 0.2, top: 0.22, bottom: 0.32 },
  IN_VIEW_MARGINS = { x: 0.07, top: 0.14, bottom: 0.2, relax: 0.035 },
  RING_WORLD_HEIGHT = 8.5,
  ARROW_LABEL_OFFSETS = { h: 14, h2: 20 },
  SCREEN_TOP_AVOIDANCE = { halfW: 62, above: 46, height: 3.7 },
  EDGE_REFRESH_FRAMES = 12,
  EDGE_TOP_LIMIT_RATIO = 0.45

function createGuideArrow(battleWorld, getOverlayElement) {
  injectStyleSheet("sf-hud-garrow", GUIDE_ARROW_CSS)
  const element = createEl("i", "sf-hud__garrow-ring"),
    ElValue = createEl("i", "sf-hud__garrow-tip"),
    createElElement = createEl("i", "sf-hud__garrow-rot", ElValue),
    createElElValue = createEl("span"),
    ElResult = createEl("span", "sf-hud__garrow-dist"),
    labelElement = createEl("span", "sf-hud__garrow-label", createElElValue, ElResult),
    arrowMarkElement = createEl("div", "sf-hud__garrow-mark", createElElement, labelElement),
    arrowRootElement = createEl("div", "sf-hud__garrow", element, arrowMarkElement)
  arrowRootElement.setAttribute("aria-hidden", "true")
  const bindClassToggleResult = bindClassToggle(arrowRootElement, "is-on"),
    setEdgeClass = bindClassToggle(arrowRootElement, "is-edge"),
    TextWriterValue = createTextWriter(createElElValue),
    createTextWriterTextWriterValue = createTextWriter(ElResult)
  let labelFontSizePx = 12
  const measureLabelWidth = (labelText) => (labelText.length * labelFontSizePx * 1.06) / 2 + 11
  let guideTarget = null,
    isActive = !1,
    isArrowVisible = !1,
    leftConfig = { left: 0, top: 0, w: 0, h: 0 },
    needsBoundsRefresh = !0
  const onResize = () => {
    needsBoundsRefresh = !0
  }
  window.addEventListener("resize", onResize)
  let lastRotationDeg = NaN,
    lastLabelOffsetX = NaN,
    lastLabelOffsetY = NaN
  const xConfig = { x: 0, y: 0 }
  let overlayBottomY = 0,
    eDGE_REFRESH_FRAMES = EDGE_REFRESH_FRAMES,
    topAvoidSide = 1
  function C(deaths) {
    if (!guideTarget) return
    if (needsBoundsRefresh || leftConfig.w === 0) {
      const BoundingClientRectValue = battleWorld.root.getBoundingClientRect()
      if (((leftConfig = { left: BoundingClientRectValue.left, top: BoundingClientRectValue.top, w: BoundingClientRectValue.width, h: BoundingClientRectValue.height }), (needsBoundsRefresh = !1), (labelFontSizePx = parseFloat(getComputedStyle(labelElement).fontSize) || 12), (eDGE_REFRESH_FRAMES = EDGE_REFRESH_FRAMES), leftConfig.w === 0)) return
    }
    if (++eDGE_REFRESH_FRAMES >= EDGE_REFRESH_FRAMES) {
      eDGE_REFRESH_FRAMES = 0
      const tResult = getOverlayElement?.()
      let overlayContentBottom = 0
      if (tResult) {
        const overlayTop = tResult.getBoundingClientRect().top
        for (const overlayChild of Array.from(tResult.children)) overlayChild instanceof HTMLElement && overlayChild.offsetHeight > 0 && (overlayContentBottom = Math.max(overlayContentBottom, overlayTop + overlayChild.offsetTop + overlayChild.offsetHeight))
      }
      overlayBottomY = overlayContentBottom > 0 ? overlayContentBottom - leftConfig.top : 0
    }
    const { host: worldHost } = deaths,
      coordW = leftConfig.w,
      heroRef = leftConfig.h,
      arrowTipSize = Math.max(36, 46 * Math.min(3.2, Math.max(0.78, Math.min(coordW / 1280, heroRef / 720)))),
      worldToScreenResult = worldHost.worldToScreen(guideTarget.pos, 0),
      targetScreenX = worldToScreenResult.x - leftConfig.left,
      targetScreenY = worldToScreenResult.y - leftConfig.top,
      viewMarginSlack = isActive ? 0 : IN_VIEW_MARGINS.relax,
      isTargetInView = worldToScreenResult.visible && targetScreenX >= coordW * (IN_VIEW_MARGINS.x - viewMarginSlack) && targetScreenX <= coordW * (1 - IN_VIEW_MARGINS.x + viewMarginSlack) && targetScreenY >= heroRef * (IN_VIEW_MARGINS.top - viewMarginSlack) && targetScreenY <= heroRef * (1 - IN_VIEW_MARGINS.bottom + viewMarginSlack)
    ;((isActive = !isTargetInView), setEdgeClass(isActive))
    let arrowScreenX, arrowScreenY, arrowAngleDeg, rawLabelOffsetX, rawLabelOffsetY
    if (isTargetInView) {
      element.style.transform = `translate3d(${targetScreenX.toFixed(1)}px, ${targetScreenY.toFixed(1)}px, 0)`
      const ringScreenPos = worldHost.worldToScreen(guideTarget.pos, RING_WORLD_HEIGHT)
      ;((arrowScreenX = ringScreenPos.x - leftConfig.left), (arrowScreenY = Math.max(heroRef * 0.16, ringScreenPos.y - leftConfig.top, Math.min(overlayBottomY + arrowTipSize + 8 + 2 * ARROW_LABEL_OFFSETS.h + 4, targetScreenY - 4))), (arrowAngleDeg = 90), (rawLabelOffsetX = 0), (rawLabelOffsetY = -(arrowTipSize + 8 + ARROW_LABEL_OFFSETS.h)), TextWriterValue(guideTarget.label), createTextWriterTextWriterValue(""))
    } else {
      const playerPos = deaths.me.pos
      let directionX = guideTarget.pos.x - playerPos.x,
        directionYToTarget = guideTarget.pos.y - playerPos.y
      const distance = Math.hypot(directionX, directionYToTarget),
        inverseDistance = distance > 0.001 ? 1 / distance : 0
      ;((directionX *= inverseDistance), (directionYToTarget *= inverseDistance))
      const playerScreenPos = worldHost.worldToScreen(playerPos, 0)
      ;((xConfig.x = playerPos.x + directionX * 4), (xConfig.y = playerPos.y + directionYToTarget * 4))
      const edgeAnchorScreenPos = worldHost.worldToScreen(xConfig, 0)
      let screenDirectionX = edgeAnchorScreenPos.x - playerScreenPos.x,
        screenDirectionY = edgeAnchorScreenPos.y - playerScreenPos.y
      const screenDirectionLength = Math.hypot(screenDirectionX, screenDirectionY)
      ;(screenDirectionLength < 0.001 ? ((screenDirectionX = directionX), (screenDirectionY = directionYToTarget)) : ((screenDirectionX /= screenDirectionLength), (screenDirectionY /= screenDirectionLength)), screenDirectionX === 0 && screenDirectionY === 0 && (screenDirectionY = -1))
      const edgeInsetLeft = coordW * EDGE_INSET_RATIOS.left,
        edgeInsetRight = coordW * (1 - EDGE_INSET_RATIOS.right),
        edgeTopLimitY = Math.min(heroRef * EDGE_TOP_LIMIT_RATIO, Math.max(heroRef * EDGE_INSET_RATIOS.top, overlayBottomY + 8)),
        edgeBottomLimitY = heroRef * (1 - EDGE_INSET_RATIOS.bottom),
        edgeInsetCenterX = (edgeInsetLeft + edgeInsetRight) / 2,
        edgeInsetCenterY = (edgeTopLimitY + edgeBottomLimitY) / 2,
        horizontalEdgeDistance = screenDirectionX !== 0 ? (screenDirectionX > 0 ? edgeInsetRight - edgeInsetCenterX : edgeInsetLeft - edgeInsetCenterX) / screenDirectionX : 1 / 0,
        verticalEdgeDistance = screenDirectionY !== 0 ? (screenDirectionY > 0 ? edgeBottomLimitY - edgeInsetCenterY : edgeTopLimitY - edgeInsetCenterY) / screenDirectionY : 1 / 0,
        edgeHitDistance = Math.min(horizontalEdgeDistance, verticalEdgeDistance)
      ;((arrowScreenX = edgeInsetCenterX + screenDirectionX * edgeHitDistance), (arrowScreenY = edgeInsetCenterY + screenDirectionY * edgeHitDistance))
      const xResult = measureLabelWidth(guideTarget.label),
        labelPushDistance = arrowTipSize + 8 + Math.abs(screenDirectionX) * xResult + Math.abs(screenDirectionY) * ARROW_LABEL_OFFSETS.h2
      if (((rawLabelOffsetX = -screenDirectionX * labelPushDistance), (rawLabelOffsetY = -screenDirectionY * labelPushDistance), verticalEdgeDistance <= horizontalEdgeDistance && screenDirectionY < 0)) {
        const topAvoidScreenPos = worldHost.worldToScreen(playerPos, SCREEN_TOP_AVOIDANCE.height),
          topAvoidAnchorX = topAvoidScreenPos.x - leftConfig.left,
          topAvoidThresholdY = topAvoidScreenPos.y - leftConfig.top - SCREEN_TOP_AVOIDANCE.above,
          labelBottomY = arrowScreenY + rawLabelOffsetY + ARROW_LABEL_OFFSETS.h2,
          topAvoidanceHalfW = SCREEN_TOP_AVOIDANCE.halfW + arrowTipSize * 0.5 + 6,
          topAvoidAnchorHalfW = SCREEN_TOP_AVOIDANCE.halfW + xResult + 6
        topAvoidThresholdY < labelBottomY + 4 &&
          (Math.abs(arrowScreenX - topAvoidAnchorX) < topAvoidanceHalfW || Math.abs(arrowScreenX + rawLabelOffsetX - topAvoidAnchorX) < topAvoidAnchorHalfW) &&
          (screenDirectionX > 0.1 ? (topAvoidSide = 1) : screenDirectionX < -0.1 && (topAvoidSide = -1), (arrowScreenX = topAvoidAnchorX + topAvoidSide * Math.max(topAvoidanceHalfW, topAvoidAnchorHalfW - topAvoidSide * rawLabelOffsetX)), (arrowScreenX = Math.min(coordW - xResult - 8 - rawLabelOffsetX, Math.max(xResult + 8 - rawLabelOffsetX, arrowScreenX))))
      }
      ;((arrowAngleDeg = (Math.atan2(screenDirectionY, screenDirectionX) * 180) / Math.PI), TextWriterValue(guideTarget.label), createTextWriterTextWriterValue(`${Math.max(1, Math.round(distance))} 米`))
    }
    arrowMarkElement.style.transform = `translate3d(${arrowScreenX.toFixed(1)}px, ${arrowScreenY.toFixed(1)}px, 0)`
    const arrowRotationDeg = Math.round(arrowAngleDeg)
    arrowRotationDeg !== lastRotationDeg && ((lastRotationDeg = arrowRotationDeg), (createElElement.style.transform = `rotate(${arrowRotationDeg}deg)`))
    const labelOffsetX = Math.round(rawLabelOffsetX),
      labelOffsetY = Math.round(rawLabelOffsetY)
    ;(labelOffsetX !== lastLabelOffsetX || labelOffsetY !== lastLabelOffsetY) && ((lastLabelOffsetX = labelOffsetX), (lastLabelOffsetY = labelOffsetY), labelElement.style.setProperty("--lx", `${labelOffsetX}px`), labelElement.style.setProperty("--ly", `${labelOffsetY}px`))
  }
  return {
    el: arrowRootElement,
    set(targetObject) {
      ;((guideTarget = targetObject), targetObject || ((isArrowVisible = !1), bindClassToggleResult(!1)))
    },
    mode: () => (isArrowVisible ? (isActive ? "edge" : "screen") : null),
    update(world, priority?) {
      const shouldShowArrow = !!guideTarget && world.me.alive && !world.state.over
      ;(shouldShowArrow && C(world), (isArrowVisible = shouldShowArrow && leftConfig.w > 0), bindClassToggleResult(isArrowVisible))
    },
    dispose() {
      ;(window.removeEventListener("resize", onResize), (guideTarget = null))
    },
  }
}

export { createGuideArrow }