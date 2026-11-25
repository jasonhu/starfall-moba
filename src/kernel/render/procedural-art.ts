/**
 * 程序化美术：种子随机/分形噪声、canvas 纹理、SVG 图标路径工具与配色
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { SCENE_SKY_PALETTES } from '../scene-sky-palettes'
import { JUNGLE_RULES, TOWER_RULES } from '../game-balance'
import { ItemTable, formatPercent } from '../equipment'
import { ICON_OUTLINE_COLOR, buildIconSvg, darkenColor, describeSkillRange, describeSkillShape, diamondPath, linearGradientDef, gradientCircle, lightenColor, mixColor, polarPoint, radialGlowDef, radialGradientDef, round2 } from '../ui/icon-theme'

function makeSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 1831565813) >>> 0
    let scrambledState = state
    return ((scrambledState = Math.imul(scrambledState ^ (scrambledState >>> 15), scrambledState | 1)), (scrambledState ^= scrambledState + Math.imul(scrambledState ^ (scrambledState >>> 7), scrambledState | 61)), ((scrambledState ^ (scrambledState >>> 14)) >>> 0) / 4294967296)
  }
}

function fractalNoise(random, sampleCount, roughness) {
  let latticeSize = 2
  for (; latticeSize + 1 < sampleCount;) latticeSize *= 2
  const fillResult = new Array(latticeSize + 1).fill(0)
  ;((fillResult[0] = random()), (fillResult[latticeSize] = random()))
  let amplitude = 0.9
  for (let index = latticeSize; index > 1; index /= 2) {
    const halfStep = index / 2
    for (let total = halfStep; total < latticeSize; total += index) fillResult[total] = (fillResult[total - halfStep] + fillResult[total + halfStep]) / 2 + (random() - 0.5) * amplitude
    amplitude *= roughness
  }
  let minSampleValue = 1 / 0,
    maxSampleValue = -1 / 0
  for (const sample of fillResult) ((minSampleValue = Math.min(minSampleValue, sample)), (maxSampleValue = Math.max(maxSampleValue, sample)))
  const normalizedNoise = []
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const latticePos = (sampleIndex / (sampleCount - 1)) * latticeSize,
      lowerLatticeIndex = Math.min(latticeSize - 1, Math.floor(latticePos)),
      interpolatedNoise = fillResult[lowerLatticeIndex] + (fillResult[lowerLatticeIndex + 1] - fillResult[lowerLatticeIndex]) * (latticePos - lowerLatticeIndex)
    normalizedNoise.push((interpolatedNoise - minSampleValue) / (maxSampleValue - minSampleValue || 1))
  }
  return normalizedNoise
}

function makeCanvasTexture(hostElement, mood = "menu") {
  const element = document.createElement("canvas")
  ;((element.className = "sf-backdrop"), (element.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;"), hostElement.insertBefore(element, hostElement.firstChild))
  const ContextValue = element.getContext("2d", { alpha: !1 }),
    ElementValue = document.createElement("canvas"),
    getContextContextValue = ElementValue.getContext("2d", { alpha: !1 }),
    createElementElementValue = document.createElement("canvas"),
    ContextResult = createElementElementValue.getContext("2d")
  let currentMood = mood,
    canvasWidth = 0,
    canvasHeight = 0,
    pixelRatio = 1,
    horizonY = 0,
    beamX = 0,
    stars = [],
    motes = []
  const meteors = []
  let frameId = 0,
    lastFrameTime = 0,
    total = 0,
    meteorCountdown = 0.6,
    isActive = !1
  function M() {
    if (!getContextContextValue || !ContextResult) return
    const selectedSCENE_SKY_PALETTES = SCENE_SKY_PALETTES[currentMood],
      SeededRandomValue = makeSeededRandom(20260511)
    ;((ElementValue.width = createElementElementValue.width = element.width), (ElementValue.height = createElementElementValue.height = element.height), getContextContextValue.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0), ContextResult.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0), ContextResult.clearRect(0, 0, canvasWidth, canvasHeight))
    const LinearGradientValue = getContextContextValue.createLinearGradient(0, 0, 0, horizonY)
    for (const [skyStopOffset, skyStopColor] of selectedSCENE_SKY_PALETTES.sky) LinearGradientValue.addColorStop(skyStopOffset, skyStopColor)
    ;((getContextContextValue.fillStyle = LinearGradientValue), getContextContextValue.fillRect(0, 0, canvasWidth, canvasHeight), getContextContextValue.save(), getContextContextValue.translate(canvasWidth * 0.5, horizonY * 0.4), getContextContextValue.rotate(-0.42))
    const createLinearGradientLinearGradientValue = getContextContextValue.createLinearGradient(0, -canvasHeight * 0.2, 0, canvasHeight * 0.2)
    ;(createLinearGradientLinearGradientValue.addColorStop(0, `rgba(${selectedSCENE_SKY_PALETTES.star}, 0)`),
      createLinearGradientLinearGradientValue.addColorStop(0.5, `rgba(${selectedSCENE_SKY_PALETTES.star}, 0.075)`),
      createLinearGradientLinearGradientValue.addColorStop(1, `rgba(${selectedSCENE_SKY_PALETTES.star}, 0)`),
      (getContextContextValue.fillStyle = createLinearGradientLinearGradientValue),
      getContextContextValue.fillRect(-canvasWidth, -canvasHeight * 0.2, canvasWidth * 2, canvasHeight * 0.4),
      getContextContextValue.restore())
    const starArcCenterX = canvasWidth * 0.24,
      starArcCenterY = -canvasHeight * 0.12
    getContextContextValue.lineCap = "round"
    for (let index = 0; index < 26; index++) {
      const arcRadius = canvasHeight * (0.3 + SeededRandomValue() * 0.95),
        arcStartAngle = 0.15 + SeededRandomValue() * 1.5,
        arcSweep = 0.1 + SeededRandomValue() * 0.22
      ;((getContextContextValue.strokeStyle = `rgba(${selectedSCENE_SKY_PALETTES.star}, ${0.035 + SeededRandomValue() * 0.075})`), (getContextContextValue.lineWidth = 0.6 + SeededRandomValue() * 0.8), getContextContextValue.beginPath(), getContextContextValue.arc(starArcCenterX, starArcCenterY, arcRadius, arcStartAngle, arcStartAngle + arcSweep), getContextContextValue.stroke())
    }
    const horizonGlowRadius = Math.max(canvasWidth * 0.62, canvasHeight * 0.75),
      RadialGradientValue = getContextContextValue.createRadialGradient(beamX, horizonY, 0, beamX, horizonY, horizonGlowRadius)
    ;(RadialGradientValue.addColorStop(0, selectedSCENE_SKY_PALETTES.horizonGlow), RadialGradientValue.addColorStop(1, "rgba(0, 0, 0, 0)"), (getContextContextValue.fillStyle = RadialGradientValue), getContextContextValue.fillRect(0, 0, canvasWidth, canvasHeight))
    const ridgeLayers = [
        { base: 0.015, amp: 0.2, rough: 0.56, top: selectedSCENE_SKY_PALETTES.ridge[0], bottom: selectedSCENE_SKY_PALETTES.horizon, rim: 1, mist: 0.2 },
        { base: 0.075, amp: 0.15, rough: 0.52, top: selectedSCENE_SKY_PALETTES.ridge[1], bottom: selectedSCENE_SKY_PALETTES.ridge[0], rim: 0.5, mist: 0.12 },
        { base: 0.16, amp: 0.11, rough: 0.6, top: selectedSCENE_SKY_PALETTES.ridge[2], bottom: selectedSCENE_SKY_PALETTES.ridge[2], rim: 0.18, mist: 0 },
      ],
      ridgeSampleCount = Math.max(96, Math.ceil(canvasWidth / 2.5)),
      ridgeMaxHeight = Math.min(canvasHeight, canvasWidth * 1.15)
    ridgeLayers.forEach((ridge, ridgeIndex) => {
      const fractalNoiseResult = fractalNoise(SeededRandomValue, ridgeSampleCount, ridge.rough),
        ridgeYAt = (ridgeSampleIndex) => {
          const farRidgeJaggedOffset = ridgeIndex === 2 ? ((ridgeSampleIndex * 7) % 5) * 0.0016 * canvasHeight : 0
          return horizonY + canvasHeight * ridge.base - fractalNoiseResult[ridgeSampleIndex] ** 1.25 * ridgeMaxHeight * ridge.amp - farRidgeJaggedOffset
        }
      ;(ContextResult.beginPath(), ContextResult.moveTo(0, canvasHeight))
      for (let index = 0; index < ridgeSampleCount; index++) ContextResult.lineTo((index / (ridgeSampleCount - 1)) * canvasWidth, ridgeYAt(index))
      ;(ContextResult.lineTo(canvasWidth, canvasHeight), ContextResult.closePath())
      const ridgeGradient = ContextResult.createLinearGradient(0, horizonY - ridgeMaxHeight * ridge.amp, 0, horizonY + canvasHeight * (ridge.base + 0.1))
      ;(ridgeGradient.addColorStop(0, ridge.top), ridgeGradient.addColorStop(1, ridge.bottom), (ContextResult.fillStyle = ridgeGradient), ContextResult.fill(), (ContextResult.lineWidth = 1.3), (ContextResult.strokeStyle = selectedSCENE_SKY_PALETTES.rim))
      for (let rimSegmentIndex = 1; rimSegmentIndex < ridgeSampleCount; rimSegmentIndex++) {
        const rimX = (rimSegmentIndex / (ridgeSampleCount - 1)) * canvasWidth,
          rimAlpha = Math.max(0, 1 - Math.abs(rimX - beamX) / (canvasWidth * 0.5))
        rimAlpha <= 0.02 || ((ContextResult.globalAlpha = rimAlpha * rimAlpha * ridge.rim), ContextResult.beginPath(), ContextResult.moveTo(((rimSegmentIndex - 1) / (ridgeSampleCount - 1)) * canvasWidth, ridgeYAt(rimSegmentIndex - 1)), ContextResult.lineTo(rimX, ridgeYAt(rimSegmentIndex)), ContextResult.stroke())
      }
      if (((ContextResult.globalAlpha = 1), ridge.mist > 0)) {
        const mistY = horizonY + canvasHeight * (ridge.base + 0.02),
          mistGradient = ContextResult.createLinearGradient(0, mistY - canvasHeight * 0.07, 0, mistY + canvasHeight * 0.06)
        ;(mistGradient.addColorStop(0, "rgba(0, 0, 0, 0)"),
          mistGradient.addColorStop(0.6, selectedSCENE_SKY_PALETTES.horizonGlow.replace(/[\d.]+\)$/, `${ridge.mist})`)),
          mistGradient.addColorStop(1, "rgba(0, 0, 0, 0)"),
          (ContextResult.fillStyle = mistGradient),
          ContextResult.fillRect(0, mistY - canvasHeight * 0.07, canvasWidth, canvasHeight * 0.13))
      }
    })
    const drawBeam = (beamCenterX, beamHeight, beamHalfWidth) => {
      const beamTopY = canvasHeight - beamHeight
      ;((ContextResult.fillStyle = "#03050c"),
        ContextResult.beginPath(),
        ContextResult.moveTo(beamCenterX - beamHalfWidth, canvasHeight),
        ContextResult.lineTo(beamCenterX - beamHalfWidth * 0.55, beamTopY + beamHeight * 0.22),
        ContextResult.lineTo(beamCenterX, beamTopY),
        ContextResult.lineTo(beamCenterX + beamHalfWidth * 0.55, beamTopY + beamHeight * 0.22),
        ContextResult.lineTo(beamCenterX + beamHalfWidth, canvasHeight),
        ContextResult.closePath(),
        ContextResult.fill())
      const beamGlowCenterY = beamTopY - beamHeight * 0.07,
        createRadialGradientRadialGradientValue = ContextResult.createRadialGradient(beamCenterX, beamGlowCenterY, 0, beamCenterX, beamGlowCenterY, beamHeight * 0.2)
      ;(createRadialGradientRadialGradientValue.addColorStop(0, `rgba(${selectedSCENE_SKY_PALETTES.beam}, 0.9)`),
        createRadialGradientRadialGradientValue.addColorStop(0.18, `rgba(${selectedSCENE_SKY_PALETTES.beam}, 0.32)`),
        createRadialGradientRadialGradientValue.addColorStop(1, `rgba(${selectedSCENE_SKY_PALETTES.beam}, 0)`),
        (ContextResult.fillStyle = createRadialGradientRadialGradientValue),
        ContextResult.fillRect(beamCenterX - beamHeight * 0.25, beamGlowCenterY - beamHeight * 0.25, beamHeight * 0.5, beamHeight * 0.5))
      const beamCoreSize = Math.max(3, beamHeight * 0.03)
      ;((ContextResult.fillStyle = `rgb(${selectedSCENE_SKY_PALETTES.beam})`), ContextResult.beginPath(), ContextResult.moveTo(beamCenterX, beamGlowCenterY - beamCoreSize * 1.6), ContextResult.lineTo(beamCenterX + beamCoreSize, beamGlowCenterY), ContextResult.lineTo(beamCenterX, beamGlowCenterY + beamCoreSize * 1.6), ContextResult.lineTo(beamCenterX - beamCoreSize, beamGlowCenterY), ContextResult.closePath(), ContextResult.fill())
    }
    ;(drawBeam(canvasWidth * 0.055, canvasHeight * 0.42, Math.max(14, canvasWidth * 0.022)), drawBeam(canvasWidth * 0.955, canvasHeight * 0.33, Math.max(12, canvasWidth * 0.018)))
    const LinearGradientResult = ContextResult.createLinearGradient(0, horizonY, 0, canvasHeight)
    ;(LinearGradientResult.addColorStop(0, "rgba(3, 5, 12, 0)"), LinearGradientResult.addColorStop(1, "rgba(3, 5, 12, 0.8)"), (ContextResult.fillStyle = LinearGradientResult), ContextResult.fillRect(0, horizonY, canvasWidth, canvasHeight - horizonY))
    const distance = ContextResult.createRadialGradient(canvasWidth / 2, canvasHeight * 0.45, Math.min(canvasWidth, canvasHeight) * 0.35, canvasWidth / 2, canvasHeight * 0.45, Math.hypot(canvasWidth, canvasHeight) * 0.62)
    ;(distance.addColorStop(0, "rgba(0, 0, 0, 0)"), distance.addColorStop(1, "rgba(0, 0, 0, 0.55)"), (ContextResult.fillStyle = distance), ContextResult.fillRect(0, 0, canvasWidth, canvasHeight))
  }
  function S() {
    const measuredWidth = Math.max(1, hostElement.clientWidth),
      measuredHeight = Math.max(1, hostElement.clientHeight)
    if (measuredWidth === canvasWidth && measuredHeight === canvasHeight) return
    ;((canvasWidth = measuredWidth),
      (canvasHeight = measuredHeight),
      (pixelRatio = Math.min(window.devicePixelRatio || 1, canvasWidth * canvasHeight > 16e5 ? 1 : 1.5)),
      (element.width = Math.round(canvasWidth * pixelRatio)),
      (element.height = Math.round(canvasHeight * pixelRatio)),
      (horizonY = canvasHeight * (canvasWidth >= canvasHeight ? 0.74 : 0.8)),
      (beamX = canvasWidth * 0.79))
    const makeSeededRandomSeededRandomValue = makeSeededRandom(7),
      starCount = Math.round(Math.min(260, Math.max(90, (canvasWidth * canvasHeight) / 5200)))
    stars = []
    for (let index = 0; index < starCount; index++) {
      const starY = makeSeededRandomSeededRandomValue() ** 1.5 * horizonY * 0.96,
        isGlintStar = makeSeededRandomSeededRandomValue() > 0.94
      stars.push({ x: makeSeededRandomSeededRandomValue() * canvasWidth, y: starY, r: isGlintStar ? 1.3 + makeSeededRandomSeededRandomValue() * 0.9 : 0.45 + makeSeededRandomSeededRandomValue() * 0.8, phase: makeSeededRandomSeededRandomValue() * Math.PI * 2, speed: 0.6 + makeSeededRandomSeededRandomValue() * 2.2, base: 0.35 + makeSeededRandomSeededRandomValue() * 0.5, glint: isGlintStar })
    }
    motes = []
    const moteCount = Math.round(Math.min(46, Math.max(18, canvasWidth / 34)))
    for (let moteIndex = 0; moteIndex < moteCount; moteIndex++) motes.push({ x: makeSeededRandomSeededRandomValue() * canvasWidth, y: makeSeededRandomSeededRandomValue() * canvasHeight, r: 0.6 + makeSeededRandomSeededRandomValue() * 1.5, speed: 6 + makeSeededRandomSeededRandomValue() * 16, drift: 4 + makeSeededRandomSeededRandomValue() * 10, phase: makeSeededRandomSeededRandomValue() * Math.PI * 2 })
    ;(M(), w(0))
  }
  function b() {
    const fromRight = Math.random() > 0.25,
      meteorSpeed = Math.max(canvasWidth, canvasHeight) * (0.55 + Math.random() * 0.45),
      launchAngle = (fromRight ? Math.PI * 0.8 : Math.PI * 0.22) + (Math.random() - 0.5) * 0.25
    meteors.push({
      x: fromRight ? canvasWidth * (0.35 + Math.random() * 0.7) : canvasWidth * Math.random() * 0.5,
      y: -20 + Math.random() * horizonY * 0.3,
      vx: Math.cos(launchAngle) * meteorSpeed,
      vy: Math.sin(launchAngle) * meteorSpeed,
      life: 0,
      max: 0.55 + Math.random() * 0.6,
      len: Math.max(canvasWidth, canvasHeight) * (0.1 + Math.random() * 0.12),
      w: 1.1 + Math.random() * 1.6,
    })
  }
  function w(towersDestroyed) {
    if (!ContextValue) return
    const skyPalette = SCENE_SKY_PALETTES[currentMood]
    ;(ContextValue.setTransform(1, 0, 0, 1, 0, 0), ContextValue.drawImage(ElementValue, 0, 0), ContextValue.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0))
    for (const star of stars) {
      const starBrightness = star.base * (0.62 + 0.38 * Math.sin(total * star.speed + star.phase))
      if (((ContextValue.fillStyle = `rgba(${skyPalette.star}, ${starBrightness.toFixed(3)})`), star.glint)) {
        const glintSize = star.r * (3.2 + 1.2 * Math.sin(total * star.speed * 0.7 + star.phase))
        ;(ContextValue.fillRect(star.x - glintSize, star.y - 0.4, glintSize * 2, 0.8), ContextValue.fillRect(star.x - 0.4, star.y - glintSize, 0.8, glintSize * 2))
      }
      ;(ContextValue.beginPath(), ContextValue.arc(star.x, star.y, star.r, 0, Math.PI * 2), ContextValue.fill())
    }
    const beamPulse = 0.8 + 0.2 * Math.sin(total * 0.9),
      beamGlowTop = horizonY * 0.06,
      beamBottomY = horizonY + canvasHeight * 0.04,
      beamSpread = Math.max(22, Math.min(canvasWidth, canvasHeight) * 0.045),
      beamGradient = ContextValue.createLinearGradient(0, beamGlowTop, 0, horizonY)
    ;(beamGradient.addColorStop(0, `rgba(${skyPalette.beam}, 0)`),
      beamGradient.addColorStop(0.75, `rgba(${skyPalette.beam}, ${(0.1 * beamPulse).toFixed(3)})`),
      beamGradient.addColorStop(1, `rgba(${skyPalette.beam}, ${(0.3 * beamPulse).toFixed(3)})`),
      (ContextValue.fillStyle = beamGradient),
      ContextValue.beginPath(),
      ContextValue.moveTo(beamX - beamSpread * 0.22, beamGlowTop),
      ContextValue.lineTo(beamX + beamSpread * 0.22, beamGlowTop),
      ContextValue.lineTo(beamX + beamSpread, beamBottomY),
      ContextValue.lineTo(beamX - beamSpread, beamBottomY),
      ContextValue.closePath(),
      ContextValue.fill())
    const beamCoreGradient = ContextValue.createLinearGradient(0, beamGlowTop, 0, horizonY)
    ;(beamCoreGradient.addColorStop(0, `rgba(${skyPalette.beam}, 0)`), beamCoreGradient.addColorStop(1, `rgba(${skyPalette.beam}, ${(0.85 * beamPulse).toFixed(3)})`), (ContextValue.fillStyle = beamCoreGradient), ContextValue.fillRect(beamX - 1, beamGlowTop, 2, beamBottomY - beamGlowTop))
    const glowRadius = Math.min(canvasWidth, canvasHeight) * 0.26 * beamPulse,
      RadialGradientResult = ContextValue.createRadialGradient(beamX, horizonY, 0, beamX, horizonY, glowRadius)
    ;(RadialGradientResult.addColorStop(0, `rgba(${skyPalette.beam}, 0.62)`),
      RadialGradientResult.addColorStop(0.3, `rgba(${skyPalette.beam}, 0.2)`),
      RadialGradientResult.addColorStop(1, `rgba(${skyPalette.beam}, 0)`),
      (ContextValue.fillStyle = RadialGradientResult),
      ContextValue.fillRect(beamX - glowRadius, horizonY - glowRadius, glowRadius * 2, glowRadius * 2),
      skyPalette.meteorRate > 0 && ((meteorCountdown -= towersDestroyed), meteorCountdown <= 0 && (b(), (meteorCountdown = (0.5 + Math.random()) / skyPalette.meteorRate))),
      (ContextValue.lineCap = "round"))
    for (let index = meteors.length - 1; index >= 0; index--) {
      const selectedP = meteors[index]
      ;((selectedP.life += towersDestroyed), (selectedP.x += selectedP.vx * towersDestroyed), (selectedP.y += selectedP.vy * towersDestroyed))
      const lifeProgress = selectedP.life / selectedP.max
      if (lifeProgress >= 1 || selectedP.y > horizonY + canvasHeight * 0.06) {
        meteors.splice(index, 1)
        continue
      }
      const powerValue = Math.sin(Math.PI * Math.min(1, lifeProgress * 1.15)) ** 0.7,
        distance = Math.hypot(selectedP.vx, selectedP.vy),
        tailX = selectedP.x - (selectedP.vx / distance) * selectedP.len,
        tailY = selectedP.y - (selectedP.vy / distance) * selectedP.len,
        meteorGradient = ContextValue.createLinearGradient(selectedP.x, selectedP.y, tailX, tailY)
      ;(meteorGradient.addColorStop(0, `rgba(255, 255, 255, ${powerValue.toFixed(3)})`),
        meteorGradient.addColorStop(0.25, `rgba(${skyPalette.meteor}, ${(powerValue * 0.6).toFixed(3)})`),
        meteorGradient.addColorStop(1, `rgba(${skyPalette.meteor}, 0)`),
        (ContextValue.strokeStyle = meteorGradient),
        (ContextValue.lineWidth = selectedP.w),
        ContextValue.beginPath(),
        ContextValue.moveTo(selectedP.x, selectedP.y),
        ContextValue.lineTo(tailX, tailY),
        ContextValue.stroke(),
        (ContextValue.fillStyle = `rgba(255, 255, 255, ${powerValue.toFixed(3)})`),
        ContextValue.beginPath(),
        ContextValue.arc(selectedP.x, selectedP.y, selectedP.w * 1.1, 0, Math.PI * 2),
        ContextValue.fill())
    }
    ;(ContextValue.setTransform(1, 0, 0, 1, 0, 0), ContextValue.drawImage(createElementElementValue, 0, 0), ContextValue.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0))
    for (const mote of motes) {
      ;((mote.y -= mote.speed * towersDestroyed * skyPalette.moteDir), (mote.x += Math.sin(total * 0.6 + mote.phase) * mote.drift * towersDestroyed), mote.y < -6 && (mote.y = canvasHeight + 6), mote.y > canvasHeight + 6 && (mote.y = -6))
      const moteAlpha = (0.12 + 0.4 * (mote.y / canvasHeight)) * (0.6 + 0.4 * Math.sin(total * 1.7 + mote.phase))
      ;((ContextValue.fillStyle = `rgba(${skyPalette.mote}, ${moteAlpha.toFixed(3)})`), ContextValue.beginPath(), ContextValue.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2), ContextValue.fill())
    }
  }
  function T(timestamp) {
    if (isActive) return
    frameId = requestAnimationFrame(T)
    const elapsedMs = timestamp - lastFrameTime
    if (elapsedMs < 31) return
    lastFrameTime = timestamp
    const deltaSeconds = Math.min(0.1, elapsedMs / 1e3)
    ;((total += deltaSeconds), w(deltaSeconds))
  }
  const resizeObserver = typeof ResizeObserver < "u" ? new ResizeObserver(S) : null
  return (
    resizeObserver?.observe(hostElement),
    window.addEventListener("resize", S),
    S(),
    (frameId = requestAnimationFrame(T)),
    {
      el: element,
      setMood: (targetObject) => {
        targetObject !== currentMood && ((currentMood = targetObject), (meteors.length = 0), M())
      },
      dispose: () => {
        ;((isActive = !0), cancelAnimationFrame(frameId), resizeObserver?.disconnect(), window.removeEventListener("resize", S), element.remove())
      },
    }
  )
}

function riverNameFor(gridPosition) {
  return gridPosition.x + gridPosition.y < 0 ? "左上河道" : "右下河道"
}

/**
 * 处理状态效果。
 *
 * @param abyss_drakeKind - 输入
 * @param isAlly - 次要输入
 */
function describeCampBuff(abyss_drakeKind, isAlly) {
  const jUNGLE_RULES = JUNGLE_RULES,
    teamLabel = isAlly ? "全队" : "敌方全队"
  return abyss_drakeKind === "abyss_drake"
    ? `${teamLabel} +${jUNGLE_RULES.drakeTeamGold} 金币 +${jUNGLE_RULES.drakeTeamXp} 经验`
    : abyss_drakeKind === "star_colossus"
      ? isAlly
        ? `全队 ${jUNGLE_RULES.blessingDuration} 秒内伤害 +${formatPercent(jUNGLE_RULES.blessingDamage)}、持续回血、小兵更强`
        : `敌方全队 ${jUNGLE_RULES.blessingDuration} 秒内更强，先避一避`
      : isAlly
        ? "全队获得奖励"
        : "敌方获得奖励"
}

const BUFF_DESCRIPTIONS = { frost_insight: `拿到蓝buff：冷却缩减 +${formatPercent(JUNGLE_RULES.frostCdr)}，回蓝更快(${JUNGLE_RULES.buffDuration} 秒)`, ember_might: `拿到红buff：普攻附带灼烧和减速(${JUNGLE_RULES.buffDuration} 秒)` },
  BUFF_DESCRIPTION_BUILDERS = {
    stun: () => "无法移动、攻击和施放技能。",
    airborne: () => "被击飞：无法移动、攻击和施放技能。",
    root: () => "无法移动，仍可攻击与施放技能。",
    slow: (effect) => (effect.value > 0 ? `移速降低 ${formatPercent(effect.value)}。` : "移速降低。"),
    silence: () => "无法施放技能。",
    shield: (effect) => (effect.value > 0 ? `可吸收 ${Math.round(effect.value)} 点伤害。` : "吸收即将受到的伤害。"),
    haste: (lookupKey) => (lookupKey.value > 0 ? `移速提高 ${formatPercent(lookupKey.value)}。` : "移速提高。"),
    attack_speed: (effect) => (effect.value > 0 ? `攻速提高 ${formatPercent(effect.value)}。` : "攻速提高。"),
    dmg_reduction: (effect) => (effect.value > 0 ? `受到的伤害降低 ${formatPercent(effect.value)}。` : "受到的伤害降低。"),
    untargetable: () => "不可被选中，免疫一切伤害。",
    unstoppable: () => "免疫控制效果。",
    burn: (effect) => (effect.value > 0 ? `持续灼烧，每跳受到 ${Math.round(effect.value)} 点真实伤害。` : "持续受到灼烧伤害。"),
    recall: () => "原地站满时间就传送回泉水。移动、攻击或挨打会打断。",
    restore: () => "疗伤中：持续回血回蓝。被英雄或防御塔打到会打断。",
    fountain: () => "在泉水里：快速回血回蓝。",
    respawn_guard: () => "刚刚复活，短时间内免疫伤害。",
    frost_insight: () => `蓝buff：冷却缩减 +${formatPercent(JUNGLE_RULES.frostCdr)}(总上限 40%)，回蓝更快。打掉蓝buff 怪获得，持续 ${JUNGLE_RULES.buffDuration} 秒。`,
    ember_might: () => `红buff：普攻附带灼烧，并让目标减速 ${formatPercent(JUNGLE_RULES.emberSlow)}。打掉红buff 怪获得，持续 ${JUNGLE_RULES.buffDuration} 秒。`,
    star_blessing: () => `巨灵buff(星陨祝福)：伤害 +${formatPercent(JUNGLE_RULES.blessingDamage)}，持续回血，我方小兵更强。打掉星陨巨灵后全队获得，持续 ${JUNGLE_RULES.blessingDuration} 秒。`,
    panyue_passive: (effect) => `盾击蓄势 ${effect.stacks}/3：第三次普攻改用大盾砸地，附带额外伤害与减速。`,
    panyue_bulwark: () => "拥盾而立：护盾生效中，盾破或到期即结束。",
    chijin_ember: () => "下一次普攻变为重斧，并回复自身生命。",
    chijin_blaze: (effect) => (effect.value > 0 ? `攻速提高 ${formatPercent(effect.value)}。` : "攻速大幅提高。"),
    chijin_spin: () => "斧影持续劈砍周围敌人；期间免疫减速并获得减伤。",
    xingli_mark: (effect) => `余音 ${effect.stacks}/3：叠满后弦音共振，造成伤害并眩晕。`,
    fengling_gale: (effect) => `连射 ${effect.stacks}/5：每层提高攻速，满层后移速提高、普攻附带额外伤害。`,
    fengling_crit: () => "下一次普攻必定暴击。",
    yeque_shadow: () => "刚刚得手：一、二技能的冷却已刷新。",
    tower_focus: (effect) => `塔在打你：塔的伤害越打越疼，现在 +${formatPercent(Math.min(TOWER_RULES.rampMax, effect.stacks * TOWER_RULES.rampPerHit))}。塔下没有小兵就先退出来。`,
  }

function describeMonsterBuff(monsterBuff) {
  return BUFF_DESCRIPTION_BUILDERS[monsterBuff.id](monsterBuff)
}

function describeSkillFull(skill) {
  const describeSkillRangeResult = describeSkillRange(skill)
  return describeSkillRangeResult ? `${describeSkillShape(skill)} · ${describeSkillRangeResult}` : describeSkillShape(skill)
}

/**
 * 处理路径。
 *
 * @param centerX - 主要输入
 * @param centerY - 次要输入
 * @param spikeCount - 第三输入
 * @param outerRadius - 第四输入
 * @param innerRadius - 附加输入
 * @param startAngle - 附加输入
 * @returns 文本结果
 */
function starPath(centerX, centerY, spikeCount, outerRadius, innerRadius, startAngle = -90) {
  let total = ""
  for (let index = 0; index < spikeCount * 2; index++) {
    const angle = ((startAngle + (index * 180) / spikeCount) * Math.PI) / 180,
      radius = index % 2 === 0 ? outerRadius : innerRadius
    total += `${index === 0 ? "M" : "L"}${round2(centerX + Math.cos(angle) * radius)} ${round2(centerY + Math.sin(angle) * radius)}`
  }
  return `${total}Z`
}

const heroIconShades = (baseColor) => [mixColor(baseColor, "#182246", 0.55), mixColor(baseColor, "#0b1128", 0.8), "#050914"],
  ICON_LIGHT_HIGHLIGHT = "#f4f7fb",
  HUD_TEXT_SECONDARY = "#aeb8c6",
  HUD_TEXT_MUTED = "#56627a",
  HUD_ICON_BROWN = "#8a5a34",
  HUD_ICON_DARK_BROWN = "#3d2817",
  rectGradientDef = (gradientId, startX, startY, endX, endY) =>
    linearGradientDef(gradientId, startX, startY, endX, endY, [
      [0, ICON_LIGHT_HIGHLIGHT],
      [0.5, HUD_TEXT_SECONDARY],
      [1, HUD_TEXT_MUTED],
    ]),
  makeShadedGradientDef = (gradientId, baseColor, startX, startY, endX, endY) =>
    linearGradientDef(gradientId, startX, startY, endX, endY, [
      [0, lightenColor(baseColor, 0.55)],
      [0.5, baseColor],
      [1, darkenColor(baseColor, 0.5)],
    ]),
  iconOutlineStroke = (strokeWidth = 1.3) => `stroke="${ICON_OUTLINE_COLOR}" stroke-width="${strokeWidth}" stroke-linejoin="round"`,
  BOOT_ICON_PATH = "M15 7H30V28Q30 33 35 35.5L44 40Q49 42.5 49 48V51H15Z",
  BOOT_SOLE_PATH = "M14 51H50V55Q50 57 48 57H16Q14 57 14 55Z",
  BOOT_CUFF_PATH = "M13.5 6H31.5V13H13.5Z"

/**
 * 创建图标。
 *
 * @param baseColor - 来源
 * @param defsMarkup - 次要输入
 * @param bodyOverlay - 第三输入
 * @param bodyExtra - 第四输入
 */
function buildSimpleIconSvg(baseColor, defsMarkup, bodyOverlay, bodyExtra) {
  return buildIconSvg(
    heroIconShades(baseColor),
    makeShadedGradientDef("bt", baseColor, 14, 6, 46, 54) + radialGlowDef("g", lightenColor(baseColor, 0.3), 0.6) + defsMarkup,
    gradientCircle("g", 32, 32, 28) +
      bodyOverlay +
      `<path d="${BOOT_ICON_PATH}" fill="url(#@bt)" ${iconOutlineStroke()}/><path d="M30 28Q30 33 35 35.5L44 40" fill="none" stroke="${darkenColor(baseColor, 0.45)}" stroke-width="1.1" opacity=".7"/><path d="M17.5 13V49" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".35"/><path d="${BOOT_SOLE_PATH}" fill="${darkenColor(baseColor, 0.72)}" ${iconOutlineStroke(1.2)}/><path d="${BOOT_CUFF_PATH}" fill="${lightenColor(baseColor, 0.35)}" ${iconOutlineStroke(1.2)}/>` +
      bodyExtra,
  )
}

const ITEM_ICON_BUILDERS = {
  boots: (baseColor) => {
    const mixColorResult = mixColor(baseColor, "#e9c873", 0.6),
      strokedPath = (pathData) =>
        `<path d="${pathData}" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/><path d="${pathData}" fill="none" stroke="${lightenColor(mixColorResult, 0.35)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
    let total = ""
    for (let strapX = 13; strapX <= 49; strapX += 4.5) total += `M${strapX} 43.5L${strapX + 3} 51.5`
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("sl", 0, 40, 0, 54, [
        [0, lightenColor(mixColorResult, 0.45)],
        [0.5, mixColorResult],
        [1, darkenColor(mixColorResult, 0.5)],
      ]) + radialGlowDef("g", lightenColor(baseColor, 0.3), 0.55),
      gradientCircle("g", 32, 36, 28) +
        `<path d="M1 24H9M0 33H7M2 42H6" stroke="${lightenColor(baseColor, 0.45)}" stroke-width="1.8" stroke-linecap="round" opacity=".65"/>` +
        strokedPath("M14 42Q10 25 21 22Q30 20.5 31.5 31") +
        `<path d="M8 46Q8 42 12 42H46Q52 42 56.5 37.5Q60 41 58 47Q55.5 53.5 48 53.5H13Q8 53.5 8 49.5Z" fill="url(#@sl)" ${iconOutlineStroke(1.4)}/><path d="${total}" stroke="${darkenColor(mixColorResult, 0.55)}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/><path d="M10.5 44H47Q52 44 55.5 41" fill="none" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" opacity=".45"/>` +
        strokedPath("M23 42Q25 31 31.5 31Q39 33 45 42") +
        strokedPath("M41 42Q45 33.5 51.5 39") +
        `<circle cx="31.5" cy="31" r="3.2" fill="${lightenColor(mixColorResult, 0.5)}" ${iconOutlineStroke(1.1)}/>`,
    )
  },
  boots_guard: (baseColor) =>
    buildSimpleIconSvg(
      baseColor,
      rectGradientDef("pl", 16, 10, 30, 36),
      "",
      `<path d="M17 13H28V28.5L22.5 34L17 28.5Z" fill="url(#@pl)" ${iconOutlineStroke(1.1)}/><path d="M22.5 15V31" stroke="#ffffff" stroke-width="1" opacity=".7"/><path d="M37 36.5L44 40Q49 42.5 49 48V51H35.5Z" fill="url(#@pl)" ${iconOutlineStroke(1.1)}/><circle cx="19.5" cy="15.5" r="1" fill="${ICON_OUTLINE_COLOR}"/><circle cx="25.5" cy="15.5" r="1" fill="${ICON_OUTLINE_COLOR}"/><circle cx="39" cy="48" r="1" fill="${ICON_OUTLINE_COLOR}"/><circle cx="45.5" cy="48" r="1" fill="${ICON_OUTLINE_COLOR}"/><path d="M11.5 3.5H33.5L31.5 9.5H13.5Z" fill="${lightenColor(baseColor, 0.45)}" ${iconOutlineStroke(1.1)}/>`,
    ),
  boots_arcane: (baseColor) =>
    buildSimpleIconSvg(
      baseColor,
      radialGlowDef("gs", "#ffe7ad", 1),
      "",
      '<path d="M13.5 6H31.5V9.2H13.5Z" fill="#f3cf85"/>' +
        gradientCircle("gs", 23, 25, 12) +
        `<path d="${diamondPath(23, 25, 7.5, 0.2)}" fill="#fff4d6" stroke="#8a5a14" stroke-width=".7"/><path d="M14.5 54H49.5" stroke="#8fe9ff" stroke-width="1.6" stroke-linecap="round"/><path d="${diamondPath(45, 22, 3.4)}" fill="#ffffff"/><path d="${diamondPath(52, 33, 2.4)}" fill="#c9f6ff"/><circle cx="40" cy="12" r="1.2" fill="#c9f6ff"/>`,
    ),
  boots_fury: (baseColor) =>
    buildSimpleIconSvg(
      baseColor,
      linearGradientDef("wg", 2, 10, 24, 38, [
        [0, "#ffffff"],
        [1, lightenColor(baseColor, 0.55)],
      ]),
      `<path d="M0 50H9M3 44H9" stroke="${lightenColor(baseColor, 0.5)}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
      `<path d="M25 27Q9 23 2 9Q13 14 25 18Z" fill="url(#@wg)" ${iconOutlineStroke(1.1)}/><path d="M25 32Q11 31 3 21Q13 24.5 25 25.5Z" fill="url(#@wg)" ${iconOutlineStroke(1.1)}/><path d="M25 37Q14 38.5 7 32.5Q15 33.5 25 32Z" fill="url(#@wg)" ${iconOutlineStroke(1.1)}/><circle cx="25.5" cy="27.5" r="3" fill="#f3cf85" ${iconOutlineStroke(1)}/>`,
    ),
  starfall_blade: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("bl", 0, 2, 0, 42, [
        [0, "#fffbe9"],
        [0.45, baseColor],
        [1, darkenColor(baseColor, 0.4)],
      ]) +
        radialGlowDef("g", baseColor, 0.85) +
        radialGlowDef("gs", "#fff6dc", 1),
      `<path d="M60 22L42 40M52 8L40 20" stroke="${lightenColor(baseColor, 0.4)}" stroke-width="1.3" stroke-linecap="round" opacity=".5"/><g transform="rotate(40 32 32)">` +
        gradientCircle("g", 32, 20, 24) +
        `<path d="M32 1L40 13L38.4 42H25.6L24 13Z" fill="url(#@bl)" ${iconOutlineStroke()}/><path d="M32 1L40 13L38.4 42H32Z" fill="#6a2f00" opacity=".26"/><path d="M32 7V40" stroke="#fffdf2" stroke-width="1.3" stroke-linecap="round" opacity=".9"/><path d="M16.5 39.5Q24 44 32 41.5Q40 44 47.5 39.5L45.5 47Q38 46 32 48.5Q26 46 18.5 47Z" fill="#3a4257" stroke="#f3cf85" stroke-width="1.2" stroke-linejoin="round"/><rect x="29.4" y="47.6" width="5.2" height="8" fill="${HUD_ICON_DARK_BROWN}" ${iconOutlineStroke(1)}/><path d="M32 55L35.4 58.6L32 62.2L28.6 58.6Z" fill="${baseColor}" ${iconOutlineStroke(1)}/>` +
        gradientCircle("gs", 32, 44.5, 7) +
        `<path d="${diamondPath(32, 44.5, 4.6)}" fill="#fffdf2"/>` +
        gradientCircle("gs", 32, 3, 9) +
        `<path d="${diamondPath(32, 3, 5.5, 0.14)}" fill="#ffffff"/></g>`,
    ),
  sunchaser_bow: (baseColor) => {
    const m25525Q19552295Q311336521Q422939532Q423536543Q315122545Q19559255615 = "M25.5 2.5Q19.5 5 22 9.5Q31 13 36.5 21Q42 29 39.5 32Q42 35 36.5 43Q31 51 22 54.5Q19.5 59 25.5 61.5",
      drawArrow = (offsetY, opacity) =>
        `<g transform="translate(0 ${offsetY})" opacity="${opacity}"><path d="M13 32H52" stroke="#fff7da" stroke-width="1.8" stroke-linecap="round"/><path d="M50 27.5L60 32L50 36.5L53 32Z" fill="#ffffff"/></g>`
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("bw", 0, 2, 0, 62, [
        [0, "#4a3018"],
        [0.16, baseColor],
        [0.5, lightenColor(baseColor, 0.5)],
        [0.84, baseColor],
        [1, "#4a3018"],
      ]) + radialGlowDef("g", baseColor, 0.8),
      gradientCircle("g", 36, 30, 26) +
        '<g transform="rotate(-38 32 32)">' +
        drawArrow(-10, 0.22) +
        drawArrow(10, 0.38) +
        `<path d="M22.5 6.5L11 32L22.5 57.5" fill="none" stroke="#fff7da" stroke-width="1.1" stroke-linejoin="round"/><path d="${m25525Q19552295Q311336521Q422939532Q423536543Q315122545Q19559255615}" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="6.6" stroke-linecap="round"/><path d="${m25525Q19552295Q311336521Q422939532Q423536543Q315122545Q19559255615}" fill="none" stroke="url(#@bw)" stroke-width="4.4" stroke-linecap="round"/><path d="M30 13.5Q35 17.5 38 23M30 50.5Q35 46.5 38 41" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".55"/><rect x="37" y="27" width="5.6" height="10" rx="1.6" fill="#7a4a1c" ${iconOutlineStroke(1)}/><path d="M37 30.3H42.6M37 33.7H42.6" stroke="#f3cf85" stroke-width=".9"/><path d="M11 32H53" stroke="${ICON_OUTLINE_COLOR}" stroke-width="3.6" stroke-linecap="round"/><path d="M11 32H53" stroke="#fff7da" stroke-width="1.8" stroke-linecap="round"/><path d="M50 27L61.5 32L50 37L53.5 32Z" fill="#ffffff" ${iconOutlineStroke(1)}/><path d="M11 32L8 28H13L16.5 32L13 36H8Z" fill="#ff8a3a" ${iconOutlineStroke(0.9)}/></g>`,
    )
  },
  blood_scythe: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("bl", 27.5, 0, 36.5, 0, [
        [0, HUD_TEXT_MUTED],
        [0.28, ICON_LIGHT_HIGHLIGHT],
        [0.62, "#d9dee6"],
        [1, baseColor],
      ]) + radialGlowDef("g", baseColor, 0.7),
      '<g transform="rotate(42 32 32)">' +
        gradientCircle("g", 32, 22, 22) +
        `<path d="M28 1.5L36 10V43H28Z" fill="url(#@bl)" ${iconOutlineStroke()}/><path d="M30.3 7V41" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/><path d="M36 10V43" stroke="${baseColor}" stroke-width="1.6" opacity=".9"/><path d="M26.5 43H37.5V46.6H26.5Z" fill="#f3cf85" ${iconOutlineStroke(1)}/><rect x="29.2" y="46.6" width="5.6" height="8.4" fill="${darkenColor(baseColor, 0.55)}" ${iconOutlineStroke(1)}/><path d="M29.2 49.3H34.8M29.2 52.1H34.8" stroke="#f3cf85" stroke-width=".9"/><circle cx="32" cy="59" r="4" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="4.6"/><circle cx="32" cy="59" r="4" fill="none" stroke="#f3cf85" stroke-width="2.4"/></g><path d="M45 30Q48.5 35 45 38.2Q41.5 35 45 30Z" fill="#ff5a55" ${iconOutlineStroke(0.8)}/><path d="M38 41Q40.3 44.4 38 46.6Q35.7 44.4 38 41Z" fill="#ff5a55" ${iconOutlineStroke(0.8)}/>`,
    ),
  piercing_spear: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      rectGradientDef("hd", -8, -16, 8, 8) + radialGlowDef("g", "#ffffff", 0.7),
      `<g fill="none" stroke="${lightenColor(baseColor, 0.25)}" stroke-width="2.6" stroke-linecap="round" opacity=".8"><path d="M21 17A19 19 0 0 0 11.5 39"/><path d="M19 49.5A19 19 0 0 0 46 46.5"/><path d="M49.5 38A19 19 0 0 0 49 27"/></g><path d="M14 26L20 29M40 51L38 45M52.5 33L46.5 33" stroke="${lightenColor(baseColor, 0.5)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/><path d="M9 57L42 22" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5.6" stroke-linecap="round"/><path d="M9 57L42 22" stroke="${HUD_ICON_BROWN}" stroke-width="3" stroke-linecap="round"/><path d="M38.5 25Q31.5 25.5 29.5 34Q34.5 32 40.5 31Z" fill="#e0453f" ${iconOutlineStroke(0.9)}/><circle cx="9" cy="57" r="2.8" fill="${HUD_TEXT_SECONDARY}" ${iconOutlineStroke(1)}/><g transform="translate(44 20) rotate(45)"><path d="M0 2L-9.5 1.5L-15 -5L-13.5 4.5L-9 8.5H0Z" fill="url(#@hd)" ${iconOutlineStroke()}/><path d="M-1 5H-9.5L-13 0" fill="none" stroke="#ffffff" stroke-width=".9" stroke-linejoin="round" opacity=".7"/><path d="M0 -16L6.2 -3L0 3.5L-6.2 -3Z" fill="url(#@hd)" ${iconOutlineStroke()}/><path d="M0 -14V2" stroke="#ffffff" stroke-width="1" opacity=".8"/><rect x="-3.4" y="7.5" width="6.8" height="3.6" rx="1" fill="#f3cf85" ${iconOutlineStroke(0.9)}/></g>` +
        gradientCircle("g", 56.5, 8.5, 8) +
        `<path d="${diamondPath(56.5, 8.5, 4.2, 0.14)}" fill="#ffffff"/>`,
    ),
  phantom_edge: (baseColor) => {
    const m2742Q205213257Q401548575Q415553812Q3052435542Z = "M27 42Q20.5 21 32.5 7Q40 -1.5 48.5 7.5Q41.5 5.5 38 12Q30.5 24 35.5 42Z"
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("bl", 22, 0, 46, 0, [
        [0, "#ffffff"],
        [0.45, lightenColor(baseColor, 0.55)],
        [1, baseColor],
      ]) +
        radialGlowDef("g", baseColor, 0.8) +
        radialGlowDef("gs", "#ffffff", 1),
      `<g transform="translate(-1 2) rotate(30 32 32)"><path d="${m2742Q205213257Q401548575Q415553812Q3052435542Z}" transform="translate(-8 3)" fill="${baseColor}" opacity=".26"/>` +
        gradientCircle("g", 34, 20, 22) +
        `<path d="${m2742Q205213257Q401548575Q415553812Q3052435542Z}" fill="url(#@bl)" ${iconOutlineStroke()}/><path d="M29.5 40Q24 22 34 9.5Q39.5 3 45 6" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/><path d="M22 42H40.5Q42.5 42 42.5 44.2Q42.5 46.4 40.5 46.4H22Q20 46.4 20 44.2Q20 42 22 42Z" fill="#2a2244" stroke="${lightenColor(baseColor, 0.2)}" stroke-width="1.1"/><rect x="28.6" y="46.4" width="5.4" height="9.2" fill="#15131f" ${iconOutlineStroke(1)}/><path d="M28.6 49.4H34M28.6 52.4H34" stroke="${baseColor}" stroke-width="1"/><path d="M31.3 55.6L35 59.3L31.3 63L27.6 59.3Z" fill="${lightenColor(baseColor, 0.2)}" ${iconOutlineStroke(1)}/>` +
        gradientCircle("gs", 48, 7, 9) +
        `<path d="${diamondPath(48, 7, 6.5, 0.12)}" fill="#ffffff"/></g>`,
    )
  },
  astral_staff: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("st", 35, 5, 55, 25, [
        [0, "#ffffff"],
        [1, baseColor],
      ]) + radialGlowDef("g", baseColor, 1),
      `<path d="M16 59L38 26" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5.8" stroke-linecap="round"/><path d="M16 59L38 26" stroke="#9fb7e8" stroke-width="3" stroke-linecap="round"/><path d="M22 46.5L26 49.2M29.5 35.5L33.5 38.2" stroke="#f3cf85" stroke-width="2" stroke-linecap="round"/><path d="M38 26Q28 20 33 8M38 26Q46 32 57 26" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5" stroke-linecap="round"/><path d="M38 26Q28 20 33 8M38 26Q46 32 57 26" fill="none" stroke="#f3cf85" stroke-width="2.6" stroke-linecap="round"/><circle cx="38" cy="26" r="3.2" fill="#fff4d6" ${iconOutlineStroke(1)}/>` +
        gradientCircle("g", 45, 15, 17) +
        `<ellipse cx="45" cy="15" rx="14" ry="4.6" transform="rotate(-25 45 15)" fill="none" stroke="#c9f6ff" stroke-width="1.1" opacity=".8"/><path d="${diamondPath(45, 15, 11, 0.22)}" fill="url(#@st)" stroke="${darkenColor(baseColor, 0.5)}" stroke-width=".8"/><path d="${diamondPath(45, 15, 5)}" fill="#ffffff"/><circle cx="16" cy="59" r="2.6" fill="#f3cf85" ${iconOutlineStroke(1)}/><circle cx="14" cy="22" r="1.3" fill="#c9f6ff"/><path d="${diamondPath(20, 13, 2.8)}" fill="#ffffff"/>`,
    ),
  void_crown: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      makeShadedGradientDef("cr", baseColor, 8, 10, 56, 52) +
        radialGradientDef("vo", 32, 34, 8.5, [
          [0, "#000000"],
          [0.55, "#1c0845"],
          [1, baseColor],
        ]) +
        radialGlowDef("g", baseColor, 0.85),
      gradientCircle("g", 32, 32, 28) +
        `<path d="M11 44L7.5 19L21 30L32 10.5L43 30L56.5 19L53 44Z" fill="url(#@cr)" ${iconOutlineStroke()}/><path d="M21 30L22.5 44M43 30L41.5 44" stroke="${darkenColor(baseColor, 0.55)}" stroke-width="1.1" opacity=".55"/><path d="M7.5 19L21 30L32 10.5" fill="none" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" opacity=".55"/><path d="M10.5 44H53.5V51Q53.5 53.5 51 53.5H13Q10.5 53.5 10.5 51Z" fill="#241c42" stroke="${lightenColor(baseColor, 0.4)}" stroke-width="1.2"/><path d="M20 46L22.6 48.8L20 51.6L17.4 48.8ZM44 46L46.6 48.8L44 51.6L41.4 48.8ZM32 46L34.6 48.8L32 51.6L29.4 48.8Z" fill="${lightenColor(baseColor, 0.6)}"/><circle cx="7.5" cy="19" r="2.8" fill="#ece2ff" ${iconOutlineStroke(1)}/><circle cx="56.5" cy="19" r="2.8" fill="#ece2ff" ${iconOutlineStroke(1)}/><circle cx="32" cy="10.5" r="3.2" fill="#ece2ff" ${iconOutlineStroke(1)}/><circle cx="32" cy="34" r="7.8" fill="url(#@vo)" stroke="#ece2ff" stroke-width="1.3"/><path d="M27.5 32Q29.5 28.5 33.5 29" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`,
    ),
  winter_scepter: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("ic", 30, 6, 56, 32, [
        [0, "#ffffff"],
        [1, baseColor],
      ]) + radialGlowDef("g", baseColor, 0.9),
      `<path d="M14 59L37 27" stroke="${ICON_OUTLINE_COLOR}" stroke-width="5.8" stroke-linecap="round"/><path d="M14 59L37 27" stroke="#c4d8e8" stroke-width="3" stroke-linecap="round"/><path d="M20 47.5L24 50.5M27 37.5L31 40.5" stroke="#5c7fa6" stroke-width="2" stroke-linecap="round"/><path d="M35 33L27 27L36 27.5Z" fill="#e8fbff" ${iconOutlineStroke(1)}/><path d="M39 33L47 36L40.5 29Z" fill="${baseColor}" ${iconOutlineStroke(1)}/>` +
        gradientCircle("g", 43, 19, 20) +
        `<path d="${starPath(43, 19, 6, 14.5, 5.2)}" fill="url(#@ic)" stroke="#1b4a66" stroke-width="1.1" stroke-linejoin="round"/><path d="M43 4.5V33.5M30.4 11.8L55.6 26.2M30.4 26.2L55.6 11.8" stroke="#ffffff" stroke-width=".9" opacity=".75"/><path d="${starPath(43, 19, 6, 5.6, 3.4)}" fill="#ffffff"/><circle cx="14" cy="59" r="2.6" fill="#c4d8e8" ${iconOutlineStroke(1)}/><g stroke="#e8fbff" stroke-width="1.2" stroke-linecap="round"><path d="M14 14V22M10.5 16L17.5 20M10.5 20L17.5 16"/><path d="M53 42V48M50.4 43.5L55.6 46.5M50.4 46.5L55.6 43.5"/></g>`,
    ),
  sage_codex: (baseColor) => {
    let total = "",
      bookLinesPath = ""
    for (let index = 0; index < 7; index++) {
      const bookX = 9.5 + index * 5.2,
        bookY = 13 + (index % 2) * 1.2
      ;((total += `<rect x="${bookX.toFixed(1)}" y="${bookY.toFixed(1)}" width="4.8" height="38" rx="1" fill="url(#@bm)" ${iconOutlineStroke(0.9)}/>`),
        index > 0 && (bookLinesPath += `M${(bookX + 1.3).toFixed(1)} 27h2.2M${(bookX + 1.3).toFixed(1)} 31h2.2M${(bookX + 1.3).toFixed(1)} 35h2.2M${(bookX + 1.3).toFixed(1)} 39h2.2`))
    }
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("bm", 0, 12, 0, 52, [
        [0, lightenColor(baseColor, 0.5)],
        [0.5, baseColor],
        [1, darkenColor(baseColor, 0.45)],
      ]) +
        linearGradientDef("rl", 45, 0, 56, 0, [
          [0, darkenColor(baseColor, 0.35)],
          [0.45, lightenColor(baseColor, 0.35)],
          [1, darkenColor(baseColor, 0.6)],
        ]) +
        radialGlowDef("g", "#fff6dc", 0.85),
      '<g transform="rotate(-8 32 32)">' +
        gradientCircle("g", 28, 33, 24) +
        total +
        `<path d="${bookLinesPath}" stroke="#5a3a12" stroke-width="1.3" stroke-linecap="round"/><path d="M8.5 20.5H47M8.5 45H47" stroke="${ICON_OUTLINE_COLOR}" stroke-width="3.2" stroke-linecap="round"/><path d="M8.5 20.5H47M8.5 45H47" stroke="#c8523c" stroke-width="1.7" stroke-linecap="round"/><rect x="45.5" y="10" width="10" height="44" rx="5" fill="url(#@rl)" ${iconOutlineStroke(1.2)}/><ellipse cx="50.5" cy="13" rx="3.6" ry="1.8" fill="${darkenColor(baseColor, 0.62)}"/><path d="M45.5 20.5H55.5M45.5 45H55.5" stroke="#c8523c" stroke-width="1.7"/><path d="M48 17V50" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".5"/><path d="M50.5 54V60" stroke="#c8523c" stroke-width="1.5" stroke-linecap="round"/><path d="M48.8 59.5H52.2L51.3 63H49.7Z" fill="#c8523c"/></g><path d="${diamondPath(51, 9, 3.6)}" fill="#ffffff"/><path d="${diamondPath(8, 54, 2.4)}" fill="#fff6dc"/>`,
    )
  },
  guardian_plate: (baseColor) =>
    buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("pl", 10, 8, 54, 56, [
        [0, lightenColor(baseColor, 0.6)],
        [0.45, baseColor],
        [1, darkenColor(baseColor, 0.55)],
      ]) + radialGlowDef("g", "#ffcf70", 1),
      `<path d="M32 13L41 9Q48 7.5 54 12.5L57.5 25L48 30V44Q42 54 32 57.5Q22 54 16 44V30L6.5 25L10 12.5Q16 7.5 23 9Z" fill="url(#@pl)" ${iconOutlineStroke(1.5)}/><path d="M6.5 25L10 12.5Q16 7.5 23 9L20.5 22Q13.5 22 6.5 25Z" fill="${lightenColor(baseColor, 0.5)}" ${iconOutlineStroke(1.1)}/><path d="M57.5 25L54 12.5Q48 7.5 41 9L43.5 22Q50.5 22 57.5 25Z" fill="${baseColor}" ${iconOutlineStroke(1.1)}/><path d="M23 9L32 13L41 9L38.5 17.5Q32 20.5 25.5 17.5Z" fill="${darkenColor(baseColor, 0.5)}" ${iconOutlineStroke(1.1)}/><path d="M32 20V57" stroke="#ffffff" stroke-width="1.2" opacity=".4"/><path d="M19.5 30.5Q26 36.5 32 33.5Q38 36.5 44.5 30.5M18 40Q32 46.5 46 40M21.5 47.5Q32 52.5 42.5 47.5" fill="none" stroke="${darkenColor(baseColor, 0.6)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/><circle cx="13" cy="17" r="1.2" fill="${ICON_OUTLINE_COLOR}"/><circle cx="51" cy="17" r="1.2" fill="${ICON_OUTLINE_COLOR}"/>` +
        gradientCircle("g", 32, 27, 9) +
        '<path d="M32 22L36.2 27L32 32L27.8 27Z" fill="#ffcf70" stroke="#fffdf2" stroke-width="1"/>',
    ),
  starweave_cloak: (baseColor) => {
    const m17521Q135165185135Q1858524595Q2755328Q365539595Q45585455135Q50516546521Q48526542526Q3953036265Q3230528265Q2453021526Q15526517521Z =
        "M17.5 21Q13.5 16.5 18.5 13.5Q18.5 8.5 24.5 9.5Q27.5 5 32 8Q36.5 5 39.5 9.5Q45.5 8.5 45.5 13.5Q50.5 16.5 46.5 21Q48.5 26.5 42.5 26Q39.5 30 36 26.5Q32 30.5 28 26.5Q24.5 30 21.5 26Q15.5 26.5 17.5 21Z",
      m1157Q2155053257Q4255055357 = "M11 57Q21.5 50.5 32 57Q42.5 50.5 53 57"
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("ck", 0, 10, 0, 58, [
        [0, lightenColor(baseColor, 0.35)],
        [0.45, baseColor],
        [1, mixColor(baseColor, "#0a1838", 0.72)],
      ]) +
        linearGradientDef("fr", 0, 5, 0, 30, [
          [0, "#ffffff"],
          [1, "#e2d3b4"],
        ]) +
        radialGlowDef("g", baseColor, 0.7),
      gradientCircle("g", 32, 36, 30) +
        `<path d="M22 15L45 15.5Q56 34 54 58Q43 51.5 32 58Q21 51.5 10 58Q8 34 19 15.5Z" fill="url(#@ck)" ${iconOutlineStroke(1.4)}/><path d="M26 27Q24 41 21 53M38 27Q40 41 43 53M32 29V56" fill="none" stroke="${darkenColor(baseColor, 0.6)}" stroke-width="1.2" stroke-linecap="round" opacity=".4"/><path d="M19 15.5Q11 30 10.5 50" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".35"/><path d="${m1157Q2155053257Q4255055357}" fill="none" stroke="${ICON_OUTLINE_COLOR}" stroke-width="7" stroke-linecap="round"/><path d="${m1157Q2155053257Q4255055357}" fill="none" stroke="#efe3c8" stroke-width="4.8" stroke-linecap="round"/><path d="M15 53.5V57M20 51.5V55M25.5 52.5V56M32 55V58.5M38.5 52.5V56M44 51.5V55M49 53.5V57" stroke="#b9a57e" stroke-width=".9" stroke-linecap="round"/><path d="${m17521Q135165185135Q1858524595Q2755328Q365539595Q45585455135Q50516546521Q48526542526Q3953036265Q3230528265Q2453021526Q15526517521Z}" fill="url(#@fr)" ${iconOutlineStroke(1.3)}/><path d="M21 17.5L23 20.5M26 13L27.5 16M37 13L36 16M43 17.5L41 20.5M25 22.5L26.5 24.5M39 22.5L37.5 24.5M32 22.5V25.5" stroke="#b9a57e" stroke-width="1" stroke-linecap="round"/><ellipse cx="32" cy="14.5" rx="5.4" ry="2.7" fill="#061220"/><circle cx="32" cy="27.5" r="2.8" fill="#f3cf85" ${iconOutlineStroke(1)}/>`,
    )
  },
  undying_heart: (baseColor) => {
    let total = ""
    for (let index = 0; index < 8; index++) {
      const [dotX, dotY] = polarPoint(32, 32, 20.2, index * 45 + 22.5)
      total += `<circle cx="${dotX}" cy="${dotY}" r="1.3" fill="#fff4d6" stroke="#6b4614" stroke-width=".5"/>`
    }
    const drawCornerStroke = (pathData) => `<path d="${pathData}" stroke="${ICON_OUTLINE_COLOR}" stroke-width="6" stroke-linecap="round"/><path d="${pathData}" stroke="${HUD_ICON_BROWN}" stroke-width="3.6" stroke-linecap="round"/>`
    return buildIconSvg(
      heroIconShades(baseColor),
      linearGradientDef("rm", 10, 10, 54, 54, [
        [0, "#fff1c4"],
        [0.45, "#d9a548"],
        [1, "#6b4614"],
      ]) +
        radialGradientDef("ht", 27, 25, 26, [
          [0, lightenColor(baseColor, 0.62)],
          [0.5, baseColor],
          [1, darkenColor(baseColor, 0.55)],
        ]) +
        radialGlowDef("g", baseColor, 0.85) +
        radialGlowDef("gc", "#fff0f3", 0.9),
      gradientCircle("g", 32, 32, 31) +
        drawCornerStroke("M7 7L17 17") +
        drawCornerStroke("M57 7L47 17") +
        drawCornerStroke("M7 57L17 47") +
        drawCornerStroke("M57 57L47 47") +
        `<circle cx="32" cy="32" r="23" fill="url(#@rm)" ${iconOutlineStroke(1.5)}/><circle cx="32" cy="32" r="17.2" fill="url(#@ht)" stroke="#6b4614" stroke-width="1.2"/>` +
        total +
        '<path d="M19.5 25A14.5 14.5 0 0 1 30 17.7" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>' +
        gradientCircle("gc", 32, 32, 12) +
        `<path d="M32 42L23.3 33Q20 27.5 24.7 24.7Q29.2 22.8 32 27.4Q34.8 22.8 39.3 24.7Q44 27.5 40.7 33Z" fill="#fff3f5" stroke="${darkenColor(baseColor, 0.5)}" stroke-width="1" stroke-linejoin="round"/><path d="M26 28.5Q27.2 26.3 29.3 26.6" fill="none" stroke="${baseColor}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`,
    )
  },
  thorn_mail: (baseColor) => {
    let total = ""
    for (let index = 0; index < 8; index++) {
      const [dotX, dotY] = polarPoint(32, 33, 14.5, index * 45 - 90)
      total += `<circle cx="${dotX}" cy="${dotY}" r="1.3" fill="#f1f8d8" stroke="${darkenColor(baseColor, 0.6)}" stroke-width=".5"/>`
    }
    return buildIconSvg(
      heroIconShades(baseColor),
      radialGradientDef("bd", 26, 26, 30, [
        [0, lightenColor(baseColor, 0.5)],
        [0.5, baseColor],
        [1, darkenColor(baseColor, 0.6)],
      ]) +
        linearGradientDef("sp", 0, 4, 0, 62, [
          [0, "#f8fbe6"],
          [1, darkenColor(baseColor, 0.15)],
        ]),
      `<path d="${starPath(32, 33, 8, 28.5, 15, -67.5)}" fill="url(#@sp)" ${iconOutlineStroke(1.2)}/><circle cx="32" cy="33" r="20" fill="url(#@bd)" ${iconOutlineStroke(1.5)}/><circle cx="32" cy="33" r="17.3" fill="none" stroke="${darkenColor(baseColor, 0.55)}" stroke-width="1.2" opacity=".6"/><circle cx="32" cy="33" r="10.5" fill="none" stroke="${darkenColor(baseColor, 0.6)}" stroke-width="1.3" opacity=".65"/><path d="M32 13V22.5M32 43.5V53M12 33H21.5M42.5 33H52" stroke="${darkenColor(baseColor, 0.6)}" stroke-width="1.1" opacity=".5"/>` +
        total +
        `<path d="M17.5 25.5A16.5 16.5 0 0 1 28.5 16.8" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".5"/><circle cx="32" cy="33" r="7" fill="${darkenColor(baseColor, 0.35)}" ${iconOutlineStroke(1.2)}/><path d="${starPath(32, 33, 4, 9, 3, -90)}" fill="url(#@sp)" ${iconOutlineStroke(1)}/><circle cx="32" cy="33" r="1.6" fill="#ffffff"/>`,
    )
  },
}

function itemIconFor(itemId) {
  return ITEM_ICON_BUILDERS[itemId](ItemTable[itemId].color)
}

const SVG_FILL_CURRENT = 'fill="currentColor"',
  SVG_STROKE_CURRENT = (strokeWidth = 2.2) => `fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`

/**
 * 创建路径与界面。
 *
 * @returns 文本结果
 */
function makeStarHudPath() {
  let total = ""
  for (let index = 0; index < 8; index++) {
    const pointAngle = (index * 360) / 8,
      starVertices = [
        [pointAngle - 13, 7.4],
        [pointAngle - 8, 10.2],
        [pointAngle + 8, 10.2],
        [pointAngle + 13, 7.4],
      ]
    for (const [vertexAngle, vertexRadius] of starVertices) {
      const angleRad = ((vertexAngle - 90) * Math.PI) / 180
      total += `${total ? "L" : "M"}${(12 + Math.cos(angleRad) * vertexRadius).toFixed(2)} ${(12 + Math.sin(angleRad) * vertexRadius).toFixed(2)}`
    }
  }
  return `${total}ZM12 8.4a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2Z`
}

export { makeCanvasTexture, starPath, BUFF_DESCRIPTIONS, SVG_STROKE_CURRENT, describeSkillFull, itemIconFor, describeMonsterBuff, SVG_FILL_CURRENT, riverNameFor, makeStarHudPath, ICON_LIGHT_HIGHLIGHT, describeCampBuff }