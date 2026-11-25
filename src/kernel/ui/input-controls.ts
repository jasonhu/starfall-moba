/**
 * 输入控制绑定
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { isTooltipOpen, hasOpenDialog, createEl, expandCssUnits, injectStyleSheet, refreshHud, scheduleUiUpdate } from './dom-kit'
import { HERO_TABLE } from '../../heroes/registry'
import { BASIC_SKILL_SPECS } from './icon-theme'
import { SKILL_SLOT_ORDER } from './hud-controls-styles'

/** 瞄准指示器：各形状字段均可选；cancel/pointer 为运行时附加标记 */
interface AimIndicator {
  kind: string
  dir?: { x: number; y: number }
  range?: number
  width?: number
  angle?: number
  pos?: { x: number; y: number }
  radius?: number
  targetId?: number
  cancel?: boolean
  pointer?: boolean
}

/** 瞄准解算结果：indicator 必填，dir/pos/targetId 是按形状附加的冗余字段 */
interface AimSolution {
  indicator: AimIndicator
  dir?: { x: number; y: number }
  pos?: { x: number; y: number }
  targetId?: number
}

function spawnClickRipple(element, clickX, clickY, isAttack) {
  const BoundingClientRectValue = element.getBoundingClientRect(),
    createElElement = createEl("i", `sf-hud__ripple${isAttack ? " is-atk" : ""}`)
  ;((createElElement.style.left = `${clickX - BoundingClientRectValue.left}px`), (createElElement.style.top = `${clickY - BoundingClientRectValue.top}px`), element.appendChild(createElElement), window.setTimeout(() => createElElement.remove(), 700))
}

function getSkillCastSpec(hero, lookupOption) {
  return lookupOption === "s1" || lookupOption === "s2" || lookupOption === "ult" ? HERO_TABLE[hero.heroId].skills[lookupOption].cast : BASIC_SKILL_SPECS[lookupOption]
}

function isSkillAimable(castSpec) {
  return castSpec.type !== "self" || castSpec.radius > 0
}

function makeDefaultAimIndicator(castSpec): AimIndicator | null {
  return castSpec.type === "self" ? (castSpec.radius > 0 ? { kind: "self", radius: castSpec.radius } : null) : castSpec.type === "target" ? { kind: "target", targetId: -1, range: castSpec.range } : { kind: "self", radius: castSpec.range }
}

const UI_TARGET_PICK_PADDING = 1

function pickEnemyInAim(world, dirX, dirY, range, maxAngleRad, targetPos?, maxPosDistance = 0) {
  const selfPlayer = world.me
  let bestTargetId = -1,
    bestScore = 1 / 0
  for (const enemyHero of world.state.heroes) {
    if (enemyHero.team === world.team || !enemyHero.alive || !enemyHero.visible[world.team]) continue
    const deltaX = enemyHero.pos.x - selfPlayer.pos.x,
      deltaY = enemyHero.pos.y - selfPlayer.pos.y,
      distance = Math.hypot(deltaX, deltaY)
    if (distance > range + enemyHero.radius + UI_TARGET_PICK_PADDING) continue
    let isActive = !1
    for (const buff of enemyHero.buffs) buff.id === "untargetable" && (isActive = !0)
    if (isActive) continue
    let targetScore
    if (targetPos) {
      const distanceToAimPoint = Math.hypot(enemyHero.pos.x - targetPos.x, enemyHero.pos.y - targetPos.y)
      if (distanceToAimPoint > maxPosDistance + enemyHero.radius) continue
      targetScore = distanceToAimPoint
    } else {
      const directionCos = distance > 1e-4 ? (deltaX * dirX + deltaY * dirY) / distance : 1,
        acosResult = Math.acos(Math.max(-1, Math.min(1, directionCos)))
      if (acosResult > maxAngleRad) continue
      targetScore = acosResult * 12 + distance
    }
    targetScore < bestScore && ((bestScore = targetScore), (bestTargetId = enemyHero.id))
  }
  return bestTargetId
}

const AIM_DEG_TO_RAD = Math.PI / 180

function buildAimIndicator(world, castSpec, dirX, dirY, magnitude): AimSolution {
  const meValue = world.me,
    xConfig = { x: dirX, y: dirY }
  switch (castSpec.type) {
    case "direction":
      return { indicator: { kind: "direction", dir: xConfig, range: castSpec.range, width: castSpec.width }, dir: xConfig }
    case "cone":
      return { indicator: { kind: "cone", dir: xConfig, range: castSpec.range, angle: castSpec.angle }, dir: xConfig }
    case "position": {
      const effectiveRange = castSpec.range * Math.max(0, Math.min(1, magnitude)),
        targetPoint = { x: meValue.pos.x + dirX * effectiveRange, y: meValue.pos.y + dirY * effectiveRange }
      return { indicator: { kind: "position", pos: targetPoint, range: castSpec.range, radius: castSpec.radius }, pos: targetPoint }
    }
    case "target": {
      const pickEnemyInAimResult = pickEnemyInAim(world, dirX, dirY, castSpec.range, 50 * AIM_DEG_TO_RAD)
      return pickEnemyInAimResult >= 0 ? { indicator: { kind: "target", targetId: pickEnemyInAimResult, range: castSpec.range }, targetId: pickEnemyInAimResult } : { indicator: { kind: "target", targetId: -1, range: castSpec.range } }
    }
    default:
      return { indicator: { kind: "self", radius: castSpec.radius } }
  }
}

/**
 * 创建指针与坐标。
 *
 * @param world - 输入
 * @param castSpec - 次要输入
 * @param groundPos - 输入
 * @param selectedTargetId - 第四输入
 * @returns 结果对象
 */
function buildPointerAimIndicator(world, castSpec, groundPos, selectedTargetId): AimSolution {
  const selfPlayer = world.me
  let dirX = groundPos.x - selfPlayer.pos.x,
    dirY = groundPos.y - selfPlayer.pos.y
  const distance = Math.hypot(dirX, dirY)
  if ((distance > 0.001 ? ((dirX /= distance), (dirY /= distance)) : ((dirX = Math.cos(selfPlayer.facing)), (dirY = Math.sin(selfPlayer.facing))), castSpec.type === "position")) {
    const effectiveCastDistance = Math.min(distance, castSpec.range),
      aimPos = { x: selfPlayer.pos.x + dirX * effectiveCastDistance, y: selfPlayer.pos.y + dirY * effectiveCastDistance }
    return { indicator: { kind: "position", pos: aimPos, range: castSpec.range, radius: castSpec.radius }, pos: aimPos }
  }
  if (castSpec.type === "target") {
    let targetId = -1
    const selectedHero = selectedTargetId >= 0 ? world.hero(selectedTargetId) : void 0
    return (
      selectedHero && selectedHero.team !== world.team && selectedHero.alive && Math.hypot(selectedHero.pos.x - selfPlayer.pos.x, selectedHero.pos.y - selfPlayer.pos.y) <= castSpec.range + selectedHero.radius + UI_TARGET_PICK_PADDING && (targetId = selectedHero.id),
      targetId < 0 && (targetId = pickEnemyInAim(world, dirX, dirY, castSpec.range, 0, groundPos, 3.5)),
      targetId < 0 && (targetId = pickEnemyInAim(world, dirX, dirY, castSpec.range, 22 * AIM_DEG_TO_RAD)),
      targetId >= 0 ? { indicator: { kind: "target", targetId: targetId, range: castSpec.range }, targetId: targetId } : { indicator: { kind: "target", targetId: -1, range: castSpec.range } }
    )
  }
  return buildAimIndicator(world, castSpec, dirX, dirY, 1)
}

const SKILL_INFO_HOLD_MS = 400

function isWithinTapDuration(pressTime, releaseTime, maxDuration = SKILL_INFO_HOLD_MS) {
  const elapsed = releaseTime - pressTime
  return !Number.isFinite(elapsed) || elapsed < 0 ? !0 : elapsed <= maxDuration
}

const JOYSTICK_CSS = expandCssUnits(`
/* 虚拟摇杆：空闲时半透明停在左下角提示位置；按下后跳到手指处 */
.sf-hud__joy { position: absolute; z-index: 2; left: calc(var(--hud-l) + var(--hud-sk) * 1.85); bottom: calc(var(--hud-b) + var(--hud-lift) + var(--hud-sk) * 1.65); width: 0; height: 0; pointer-events: none; display: none; opacity: 0.55; transition: opacity 0.25s linear; }
.sf-hud--touch .sf-hud__joy { display: block; }
.sf-hud__joy.is-active { opacity: 1; transition: none; }
.sf-hud.is-dead .sf-hud__joy { filter: grayscale(1); opacity: 0.35; }
.sf-hud__joy-base {
  --d: calc(var(--hud-sk) * 2.3); position: absolute; left: calc(var(--d) / -2); top: calc(var(--d) / -2); width: var(--d); height: var(--d); border-radius: 50%;
  background: radial-gradient(circle, rgba(40, 64, 124, 0.16) 0, rgba(8, 13, 31, 0.42) 60%, rgba(8, 13, 31, 0.6) 100%);
  box-shadow: inset 0 0 0 1.5px rgba(232, 199, 122, 0.6), inset 0 0 0 max(5px, 7u) rgba(8, 13, 31, 0.28), inset 0 0 0 max(6px, 8u) rgba(143, 233, 255, 0.22), 0 4u 18u rgba(2, 4, 12, 0.4);
}
/* 四个方向刻度 */
.sf-hud__joy-base::before { content: ''; position: absolute; inset: 9%; border-radius: 50%;
  background: conic-gradient(from -6deg, rgba(255, 231, 173, 0.85) 0 12deg, transparent 12deg 90deg, rgba(255, 231, 173, 0.85) 90deg 102deg, transparent 102deg 180deg, rgba(255, 231, 173, 0.85) 180deg 192deg, transparent 192deg 270deg, rgba(255, 231, 173, 0.85) 270deg 282deg, transparent 282deg 360deg);
  -webkit-mask-image: radial-gradient(circle closest-side, transparent 0, transparent 86%, #000 88%); mask-image: radial-gradient(circle closest-side, transparent 0, transparent 86%, #000 88%); }
.sf-hud__joy-knob {
  --d: calc(var(--hud-sk) * 0.98); position: absolute; left: calc(var(--d) / -2); top: calc(var(--d) / -2); width: var(--d); height: var(--d); border-radius: 50%; will-change: transform;
  background: radial-gradient(circle at 40% 30%, #7fa2ee, #27459a 52%, #0d1a44);
  box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(2px, 2.5u) rgba(255, 231, 173, 0.9), 0 3u 10u rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.32);
}
.sf-hud__joy.is-active .sf-hud__joy-knob { box-shadow: 0 0 0 1px rgba(8, 13, 31, 0.9), 0 0 0 max(2px, 2.5u) #fff4d6, 0 0 20u rgba(92, 214, 247, 0.75), inset 0 2px 0 rgba(255, 255, 255, 0.4); }
`),
  AIM_DIR_CHANGE_COS = Math.cos((7 * Math.PI) / 180),
  MOVE_SEND_INTERVAL_SEC = 0.08,
  AUTO_ATTACK_INTERVAL_SEC = 0.15,
  TOUCH_AIM_DEADZONE_PX = 12,
  MOUSE_AIM_DEADZONE_PX = 8,
  MOVE_TO_REPEAT_SEC = 0.09,
  SKILL_CANCEL_RADIUS_RATIO = 0.5,
  JOYSTICK_EDGE_MARGIN_PX = 8,
  SKILL_KEY_SLOT_MAP = { KeyQ: "s1", KeyE: "s2", KeyR: "ult" },
  CAPTURED_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyJ", "KeyQ", "KeyE", "KeyR", "KeyF", "KeyG", "KeyB", "KeyP", "Tab"]),
  isVec2Equal = (left, right) => Math.abs(left.x - right.x) < 1e-4 && Math.abs(left.y - right.y) < 1e-4

function isAimIndicatorEqual(newIndicator: AimIndicator | null, currentIndicator: AimIndicator | null) {
  if (newIndicator === currentIndicator) return !0
  if (!newIndicator || !currentIndicator || newIndicator.kind !== currentIndicator.kind || !!newIndicator.cancel != !!currentIndicator.cancel || !!newIndicator.pointer != !!currentIndicator.pointer) return !1
  switch (newIndicator.kind) {
    case "direction":
      return currentIndicator.kind === "direction" && newIndicator.range === currentIndicator.range && newIndicator.width === currentIndicator.width && isVec2Equal(newIndicator.dir, currentIndicator.dir)
    case "cone":
      return currentIndicator.kind === "cone" && newIndicator.range === currentIndicator.range && newIndicator.angle === currentIndicator.angle && isVec2Equal(newIndicator.dir, currentIndicator.dir)
    case "position":
      return currentIndicator.kind === "position" && newIndicator.range === currentIndicator.range && newIndicator.radius === currentIndicator.radius && isVec2Equal(newIndicator.pos, currentIndicator.pos)
    case "target":
      return currentIndicator.kind === "target" && newIndicator.range === currentIndicator.range && newIndicator.targetId === currentIndicator.targetId
    default:
      return currentIndicator.kind === "self" && newIndicator.radius === currentIndicator.radius
  }
}

/**
 * 处理输入。
 *
 * @param event - 事件
 * @param inputConfig - 事件
 * @returns 结果对象
 */
function bindInputControls(event, inputConfig) {
  injectStyleSheet("sf-hud-input", JOYSTICK_CSS)
  const { host: host, root: root } = event,
    { field: field, skills: skillBar } = inputConfig,
    nowSeconds = () => performance.now() / 1e3,
    disposers = [],
    addListener = (event, type, handler, options?) => {
      ;(event.addEventListener(type, handler, options), disposers.push(() => event.removeEventListener(type, handler, options)))
    },
    addWindowListener = (event, handler, options?) => {
      ;(window.addEventListener(event, handler, options), disposers.push(() => window.removeEventListener(event, handler, options)))
    },
    sendCommand = (command) => host.command(command),
    setModeFromPointer = (touchKind) => {
      inputConfig.forced || (touchKind === "touch" || touchKind === "pen" ? inputConfig.setMode("touch") : touchKind === "mouse" && inputConfig.setMode("kbm"))
    },
    isMousePointer = (label) => label.pointerType !== "mouse" || inputConfig.forced === "touch",
    upConfig = { up: !1, down: !1, left: !1, right: !1 }
  let joystickPointerId = null,
    total = 0,
    joyOriginY = 0,
    joyDirX = 0,
    joyDirY = 0,
    lastMoveX = 0,
    lastMoveY = 0,
    lastMoveTime = -1
  const element = createEl("div", "sf-hud__joy-knob"),
    joystick = createEl("div", "sf-hud__joy", createEl("div", "sf-hud__joy-base"), element)
  function b() {
    if (event.inputBlocked()) return
    let moveX = joyDirX,
      moveY = joyDirY
    joystickPointerId === null && ((moveX = (upConfig.right ? 1 : 0) - (upConfig.left ? 1 : 0)), (moveY = (upConfig.down ? 1 : 0) - (upConfig.up ? 1 : 0)), moveX !== 0 && moveY !== 0 && ((moveX *= Math.SQRT1_2), (moveY *= Math.SQRT1_2)))
    const isIdle = moveX === 0 && moveY === 0,
      lastMoveWasStopped = lastMoveX === 0 && lastMoveY === 0
    if (isIdle) {
      lastMoveWasStopped || ((lastMoveX = lastMoveY = 0), sendCommand({ type: "move", dir: { x: 0, y: 0 } }))
      return
    }
    const oResult = nowSeconds()
    ;(lastMoveWasStopped || moveX * lastMoveX + moveY * lastMoveY < AIM_DIR_CHANGE_COS || oResult - lastMoveTime >= MOVE_SEND_INTERVAL_SEC) && ((lastMoveX = moveX), (lastMoveY = moveY), (lastMoveTime = oResult), sendCommand({ type: "move", dir: { x: moveX, y: moveY } }))
  }
  const skillButtonWidth = () => skillBar.buttons.s1.offsetWidth || 56
  function T(startEvent) {
    joystickPointerId = startEvent.pointerId
    const getBoundingClientRectBoundingClientRectValue = root.getBoundingClientRect()
    ;((total = startEvent.clientX),
      (joyOriginY = startEvent.clientY),
      (joyDirX = joyDirY = 0),
      (joystick.style.left = `${total - getBoundingClientRectBoundingClientRectValue.left}px`),
      (joystick.style.top = `${joyOriginY - getBoundingClientRectBoundingClientRectValue.top}px`),
      (joystick.style.bottom = "auto"),
      (element.style.transform = ""),
      joystick.classList.add("is-active"))
    try {
      field.setPointerCapture(startEvent.pointerId)
    } catch {}
  }
  function E(moveEvent) {
    const joystickMaxTravel = skillButtonWidth() * 1.05
    let offsetX = moveEvent.clientX - total,
      offsetY = moveEvent.clientY - joyOriginY,
      distance = Math.hypot(offsetX, offsetY)
    if (distance > joystickMaxTravel) {
      const travelOverflowRatio = (distance - joystickMaxTravel) / distance
      ;((total += offsetX * travelOverflowRatio), (joyOriginY += offsetY * travelOverflowRatio))
      const BoundingClientRectResult = root.getBoundingClientRect()
      ;((joystick.style.left = `${total - BoundingClientRectResult.left}px`), (joystick.style.top = `${joyOriginY - BoundingClientRectResult.top}px`), (offsetX = moveEvent.clientX - total), (offsetY = moveEvent.clientY - joyOriginY), (distance = joystickMaxTravel))
    }
    ;((element.style.transform = `translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px)`), distance < joystickMaxTravel * 0.14 ? (joyDirX = joyDirY = 0) : ((joyDirX = offsetX / distance), (joyDirY = offsetY / distance)), b())
  }
  function A() {
    joystickPointerId !== null && ((joystickPointerId = null), (joyDirX = joyDirY = 0), joystick.classList.remove("is-active"), (joystick.style.left = ""), (joystick.style.top = ""), (joystick.style.bottom = ""), (element.style.transform = ""), b())
  }
  function C(deaths) {
    const fieldBounds = root.getBoundingClientRect(),
      tapXRatio = (deaths.clientX - fieldBounds.left) / Math.max(1, fieldBounds.width),
      tapYRatio = (deaths.clientY - fieldBounds.top) / Math.max(1, fieldBounds.height)
    return fieldBounds.height >= fieldBounds.width ? tapXRatio < 0.56 && tapYRatio > 0.45 : tapXRatio < 0.5 && tapYRatio > 0.3
  }
  let lookupKey = null,
    currentAimIndicator = null
  const setAimIndicator = (indicator: AimIndicator | null) => {
    isAimIndicatorEqual(indicator, currentAimIndicator) || ((currentAimIndicator = indicator), host.setAim(indicator))
  }
  function F(aimOwner) {
    aimOwner === null || lookupKey !== aimOwner || ((lookupKey = null), setAimIndicator(null), skillBar.setAiming(null, !1))
  }
  function L(slot, aimData) {
    if (event.inputBlocked()) return
    if (event.me.skills[slot].level <= 0) {
      ;(event.toast("技能尚未学会", "warn"), host.audio.ui("error"))
      return
    }
    const typeConfig: { type: string; slot: any; dir?: { x: number; y: number }; pos?: { x: number; y: number }; targetId?: number } = { type: "cast", slot: slot }
    ;(aimData && (aimData.dir && (typeConfig.dir = aimData.dir), aimData.pos && (typeConfig.pos = aimData.pos), aimData.targetId !== void 0 && (typeConfig.targetId = aimData.targetId)), sendCommand(typeConfig))
  }
  const attackInputs = new Set()
  let lastAttackTime = -1
  function q() {
    event.inputBlocked() || ((lastAttackTime = nowSeconds()), sendCommand({ type: "attack" }))
  }
  const activePointers = new Map()
  let cancelZoneBounds = null
  function rt(pointerX, pointerY) {
    if (!cancelZoneBounds) return !1
    const zoneCenterX = cancelZoneBounds.left + cancelZoneBounds.width / 2,
      zoneCenterY = cancelZoneBounds.top + cancelZoneBounds.height / 2
    return Math.hypot(pointerX - zoneCenterX, pointerY - zoneCenterY) <= (cancelZoneBounds.width / 2) * 1.2
  }
  function mt(joystickPointer) {
    const wResult = skillButtonWidth(),
      fieldBounds = root.getBoundingClientRect()
    let edgeDistance = 1 / 0
    return (
      joystickPointer.nx > 0.001 ? (edgeDistance = Math.min(edgeDistance, (fieldBounds.right - JOYSTICK_EDGE_MARGIN_PX - joystickPointer.x0) / joystickPointer.nx)) : joystickPointer.nx < -0.001 && (edgeDistance = Math.min(edgeDistance, (joystickPointer.x0 - fieldBounds.left - JOYSTICK_EDGE_MARGIN_PX) / -joystickPointer.nx)),
      joystickPointer.ny > 0.001 ? (edgeDistance = Math.min(edgeDistance, (fieldBounds.bottom - JOYSTICK_EDGE_MARGIN_PX - joystickPointer.y0) / joystickPointer.ny)) : joystickPointer.ny < -0.001 && (edgeDistance = Math.min(edgeDistance, (joystickPointer.y0 - fieldBounds.top - JOYSTICK_EDGE_MARGIN_PX) / -joystickPointer.ny)),
      Math.max(wResult * 0.45, Math.min(wResult * 1.15, edgeDistance))
    )
  }
  function nt(aimPointer) {
    if (aimPointer.btn === "attack" || aimPointer.state !== "aim") return
    const AimIndicatorValue = buildAimIndicator(event, getSkillCastSpec(event.me, aimPointer.btn), aimPointer.nx, aimPointer.ny, aimPointer.mag)
    ;(aimPointer.cancel && (AimIndicatorValue.indicator.cancel = !0), (aimPointer.sol = AimIndicatorValue), setAimIndicator(AimIndicatorValue.indicator))
  }
  function H(releasedPointer, shouldCast, eventTime = Number.NaN) {
    if ((window.clearTimeout(releasedPointer.timer), activePointers.delete(releasedPointer.id), skillBar.setDown(releasedPointer.btn, !1), releasedPointer.btn === "attack")) {
      attackInputs.delete(releasedPointer.id)
      return
    }
    const slot = releasedPointer.btn,
      selectedButtons = skillBar.buttons[slot]
    if (releasedPointer.state === "aim") {
      const aimSolution = releasedPointer.sol,
        wasCancelled = releasedPointer.cancel
      ;(F(releasedPointer.id), shouldCast && !wasCancelled && L(slot, aimSolution))
      return
    }
    ;(F(releasedPointer.id), !(releasedPointer.state === "void" || !shouldCast) && (!releasedPointer.touch || isWithinTapDuration(releasedPointer.t0, eventTime) ? (releasedPointer.state === "info" && isTooltipOpen(selectedButtons) && refreshHud(), L(slot, null)) : releasedPointer.state === "press" && scheduleUiUpdate(selectedButtons, skillBar.tipHtml(slot), 4200)))
  }
  function st(attackKind) {
    const button = skillBar.buttons[attackKind]
    ;(addListener(button, "pointerdown", (pointerEvent) => {
      if ((pointerEvent.pointerType === "mouse" && pointerEvent.button !== 0) || (pointerEvent.preventDefault(), !event.enabled || activePointers.has(pointerEvent.pointerId))) return
      try {
        button.setPointerCapture(pointerEvent.pointerId)
      } catch {}
      const isTouch = pointerEvent.pointerType !== "mouse",
        idConfig = { id: pointerEvent.pointerId, btn: attackKind, x0: pointerEvent.clientX, y0: pointerEvent.clientY, t0: pointerEvent.timeStamp, state: "press", timer: 0, touch: isTouch, nx: 0, ny: -1, mag: 0, sol: null, cancel: !1 }
      if ((activePointers.set(pointerEvent.pointerId, idConfig), skillBar.setDown(attackKind, !0), attackKind === "attack")) {
        ;(attackInputs.add(pointerEvent.pointerId), q())
        return
      }
      isTouch &&
        (idConfig.timer = window.setTimeout(() => {
          if (idConfig.state !== "press" || !activePointers.has(idConfig.id)) return
          ;((idConfig.state = "info"), scheduleUiUpdate(button, skillBar.tipHtml(attackKind), 4200))
          const SkillCastSpecValue = getSkillCastSpec(event.me, attackKind),
            DefaultAimIndicatorValue = makeDefaultAimIndicator(SkillCastSpecValue)
          DefaultAimIndicatorValue && lookupKey === null && !event.inputBlocked() && event.me.skills[attackKind].level > 0 && ((lookupKey = idConfig.id), setAimIndicator(DefaultAimIndicatorValue))
        }, SKILL_INFO_HOLD_MS))
    }),
      addListener(button, "pointermove", (pointerEvent) => {
        const Value = activePointers.get(pointerEvent.pointerId)
        if (!Value || Value.btn === "attack") return
        const slot = Value.btn,
          deltaX = pointerEvent.clientX - Value.x0,
          deltaY = pointerEvent.clientY - Value.y0,
          distance = Math.hypot(deltaX, deltaY)
        if (Value.state !== "void") {
          if (Value.state !== "aim") {
            if (distance < (Value.touch ? TOUCH_AIM_DEADZONE_PX : MOUSE_AIM_DEADZONE_PX)) return
            const getSkillCastSpecSkillCastSpecValue = getSkillCastSpec(event.me, slot)
            if (!isSkillAimable(getSkillCastSpecSkillCastSpecValue)) {
              distance >= Math.max(Value.touch ? TOUCH_AIM_DEADZONE_PX : MOUSE_AIM_DEADZONE_PX, button.offsetWidth * SKILL_CANCEL_RADIUS_RATIO) && (window.clearTimeout(Value.timer), isTooltipOpen(button) && refreshHud(), F(Value.id), (Value.state = "void"), skillBar.setDown(slot, !1))
              return
            }
            if (!(lookupKey === null || lookupKey === Value.id) || event.inputBlocked() || event.me.skills[slot].level <= 0) return
            ;(window.clearTimeout(Value.timer), isTooltipOpen(button) && refreshHud(), (Value.state = "aim"), (lookupKey = Value.id), skillBar.setAiming(slot, !0), (cancelZoneBounds = skillBar.cancelZone.getBoundingClientRect()))
          }
          ;(distance > 0.5 && ((Value.nx = deltaX / distance), (Value.ny = deltaY / distance)), (Value.mag = distance / mt(Value)), (Value.cancel = rt(pointerEvent.clientX, pointerEvent.clientY)), skillBar.setCancelHot(Value.cancel), nt(Value))
        }
      }))
    const finishSkillPress = (order, didRelease) => {
      const getValue = activePointers.get(order.pointerId)
      getValue && H(getValue, didRelease, order.timeStamp)
    }
    ;(addListener(button, "pointerup", (releaseEvent) => finishSkillPress(releaseEvent, !0)),
      addListener(button, "pointercancel", (cancelEvent) => finishSkillPress(cancelEvent, !1)),
      addListener(button, "lostpointercapture", (lostCaptureEvent) => {
        lostCaptureEvent.target === button && finishSkillPress(lostCaptureEvent, !1)
      }),
      addListener(button, "pointerenter", (enterEvent) => {
        enterEvent.pointerType !== "mouse" ||
          activePointers.size > 0 ||
          scheduleUiUpdate(button, attackKind === "attack" ? '<div class="sf-tip__title"><span>普通攻击</span></div><div>自动选择目标：优先射程内的敌方英雄，其次残血小兵、防御塔与野怪。按住可连续攻击。</div>' : skillBar.tipHtml(attackKind))
      }),
      addListener(button, "pointerleave", (leaveEvent) => {
        leaveEvent.pointerType === "mouse" && isTooltipOpen(button) && refreshHud()
      }))
  }
  st("attack")
  for (const skillSlot of SKILL_SLOT_ORDER) st(skillSlot)
  let keySkill = null
  const cursorScreenPos = { x: 0, y: 0, known: !1 }
  function D(): AimSolution | null {
    if (!keySkill) return null
    const SkillCastSpecResult = getSkillCastSpec(event.me, keySkill.slot),
      groundPoint = cursorScreenPos.known ? host.screenToGround(cursorScreenPos.x, cursorScreenPos.y) : null
    if (!groundPoint) return null
    const pickedTargetId = SkillCastSpecResult.type === "target" ? host.pickUnit(cursorScreenPos.x, cursorScreenPos.y) : -1
    return buildPointerAimIndicator(event, SkillCastSpecResult, groundPoint, pickedTargetId)
  }
  function Q() {
    if (!keySkill) return
    const dResult = D(),
      aimIndicator = dResult ? dResult.indicator : makeDefaultAimIndicator(getSkillCastSpec(event.me, keySkill.slot))
    ;(aimIndicator && (aimIndicator.pointer = !0), setAimIndicator(aimIndicator))
  }
  function $() {
    keySkill && (skillBar.setDown(keySkill.slot, !1), (keySkill = null), F("key"))
  }
  function ut(slot, code) {
    if (!event.inputBlocked()) {
      if (event.me.skills[slot].level <= 0) {
        ;(event.toast("技能尚未学会", "warn"), host.audio.ui("error"))
        return
      }
      ;(lookupKey !== null && lookupKey !== "key") || (keySkill && skillBar.setDown(keySkill.slot, !1), (keySkill = { slot: slot, code: code }), (lookupKey = "key"), skillBar.setDown(slot, !0), skillBar.setAiming(slot, !1), Q())
    }
  }
  function N() {
    $()
    for (const value of activePointers.values()) value.btn === "attack" || (value.state !== "aim" && value.state !== "info") || (window.clearTimeout(value.timer), F(value.id), (value.state = "void"))
  }
  function J() {
    if (!cursorScreenPos.known) return null
    const screenToGroundResult = host.screenToGround(cursorScreenPos.x, cursorScreenPos.y)
    if (!screenToGroundResult) return null
    const deltaX = screenToGroundResult.x - event.me.pos.x,
      deltaY = screenToGroundResult.y - event.me.pos.y,
      distance = Math.hypot(deltaX, deltaY)
    return distance > 0.001 ? { x: deltaX / distance, y: deltaY / distance } : null
  }
  let moveToPointerId = null,
    lastMoveToTime = -1
  function j(unitId) {
    if (unitId < 0) return !1
    const unitResult = event.unit(unitId)
    return !!unitResult && unitResult.alive && unitResult.team !== event.team
  }
  ;(addListener(root, "pointerdown", (pointerEvent) => setModeFromPointer(pointerEvent.pointerType), { capture: !0 }),
    addListener(field, "pointerdown", (pointerEvent) => {
      if (event.enabled) {
        if (isMousePointer(pointerEvent)) {
          if (pointerEvent.pointerType === "mouse" && pointerEvent.button !== 0) return
          joystickPointerId === null && C(pointerEvent) && (pointerEvent.preventDefault(), T(pointerEvent))
          return
        }
        if ((pointerEvent.preventDefault(), pointerEvent.button === 2)) {
          if (lookupKey !== null) {
            N()
            return
          }
          if (event.inputBlocked()) return
          const pickUnitResult = host.pickUnit(pointerEvent.clientX, pointerEvent.clientY)
          if (j(pickUnitResult)) {
            ;(sendCommand({ type: "attack", targetId: pickUnitResult }), spawnClickRipple(root, pointerEvent.clientX, pointerEvent.clientY, !0))
            return
          }
          const groundMovePos = host.screenToGround(pointerEvent.clientX, pointerEvent.clientY)
          if (!groundMovePos) return
          ;(sendCommand({ type: "moveTo", pos: groundMovePos }), spawnClickRipple(root, pointerEvent.clientX, pointerEvent.clientY, !1), (moveToPointerId = pointerEvent.pointerId), (lastMoveToTime = nowSeconds()))
          try {
            field.setPointerCapture(pointerEvent.pointerId)
          } catch {}
        } else if (pointerEvent.button === 0) {
          if (event.inputBlocked()) return
          const pickedUnitId = host.pickUnit(pointerEvent.clientX, pointerEvent.clientY)
          j(pickedUnitId) && (sendCommand({ type: "attack", targetId: pickedUnitId }), spawnClickRipple(root, pointerEvent.clientX, pointerEvent.clientY, !0))
        }
      }
    }),
    addListener(field, "pointermove", (pointerEvent) => {
      if (pointerEvent.pointerId === joystickPointerId) {
        E(pointerEvent)
        return
      }
      if (pointerEvent.pointerId === moveToPointerId && !event.inputBlocked()) {
        const oOResult = nowSeconds()
        if (oOResult - lastMoveToTime < MOVE_TO_REPEAT_SEC) return
        const groundPoint = host.screenToGround(pointerEvent.clientX, pointerEvent.clientY)
        if (!groundPoint) return
        ;((lastMoveToTime = oOResult), sendCommand({ type: "moveTo", pos: groundPoint }))
      }
    }))
  const endFieldPointer = (pointerEvent) => {
    ;(pointerEvent.pointerId === joystickPointerId && A(), pointerEvent.pointerId === moveToPointerId && (moveToPointerId = null))
  }
  ;(addListener(field, "pointerup", endFieldPointer),
    addListener(field, "pointercancel", endFieldPointer),
    addListener(field, "lostpointercapture", endFieldPointer),
    addWindowListener("pointermove", (pointerEvent) => {
      pointerEvent.pointerType === "mouse" && ((cursorScreenPos.x = pointerEvent.clientX), (cursorScreenPos.y = pointerEvent.clientY), (cursorScreenPos.known = !0), keySkill && Q())
    }))
  function Rt(code, isDown) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        return ((upConfig.up = isDown), !0)
      case "KeyS":
      case "ArrowDown":
        return ((upConfig.down = isDown), !0)
      case "KeyA":
      case "ArrowLeft":
        return ((upConfig.left = isDown), !0)
      case "KeyD":
      case "ArrowRight":
        return ((upConfig.right = isDown), !0)
      default:
        return !1
    }
  }
  const isTextInput = (keyEvent) => {
    const eventTarget = keyEvent.target
    return eventTarget instanceof HTMLInputElement || eventTarget instanceof HTMLTextAreaElement || eventTarget instanceof HTMLSelectElement
  }
  ;(addWindowListener("keydown", (keyEvent) => {
    if (!event.enabled || hasOpenDialog() || isTextInput(keyEvent) || keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey) return
    const lookupKey = keyEvent.code
    if ((!inputConfig.forced && CAPTURED_KEYS.has(lookupKey) && inputConfig.setMode("kbm"), Rt(lookupKey, !0))) {
      ;(keyEvent.preventDefault(), b())
      return
    }
    switch (lookupKey) {
      case "Space":
      case "KeyJ":
        if ((keyEvent.preventDefault(), keyEvent.repeat)) return
        ;(attackInputs.add(lookupKey), skillBar.setDown("attack", !0), q())
        break
      case "KeyQ":
      case "KeyE":
      case "KeyR":
        if (keyEvent.repeat) return
        ut(SKILL_KEY_SLOT_MAP[lookupKey], lookupKey)
        break
      case "KeyF": {
        if (keyEvent.repeat || event.inputBlocked()) return
        const jResult = J()
        L("flash", jResult ? { dir: jResult } : null)
        break
      }
      case "KeyG":
        keyEvent.repeat || L("heal", null)
        break
      case "KeyB":
        keyEvent.repeat || L("recall", null)
        break
      case "Tab":
        ;(keyEvent.preventDefault(), !keyEvent.repeat && !event.actions.isScoreboardPinned() && event.actions.setScoreboard(!0, !1))
        break
      case "KeyP":
        keyEvent.repeat || (host.audio.ui("click"), event.actions.toggleShop())
        break
      case "Escape":
        if ((keyEvent.preventDefault(), keyEvent.repeat)) return
        lookupKey !== null ? N() : event.actions.isShopOpen() ? (host.audio.ui("back"), event.actions.setShop(!1)) : event.actions.isScoreboardPinned() ? event.actions.setScoreboard(!1, !1) : event.actions.openSettings()
        break
    }
  }),
    addWindowListener("keyup", (keyEvent) => {
      const codeValue = keyEvent.code
      if (Rt(codeValue, !1)) {
        b()
        return
      }
      if (codeValue === "Space" || codeValue === "KeyJ") (attackInputs.delete(codeValue), !attackInputs.has("Space") && !attackInputs.has("KeyJ") && skillBar.setDown("attack", !1))
      else if (keySkill && keySkill.code === codeValue) {
        const slot = keySkill.slot,
          dDResult = D()
        ;($(), hasOpenDialog() || L(slot, dDResult))
      } else codeValue === "Tab" && (event.actions.isScoreboardPinned() || event.actions.setScoreboard(!1, !1))
    }))
  function V() {
    upConfig.up = upConfig.down = upConfig.left = upConfig.right = !1
    for (const pointerState of Array.from(activePointers.values())) H(pointerState, !1)
    ;(attackInputs.clear(), skillBar.setDown("attack", !1), $(), F(lookupKey), (moveToPointerId = null))
    const hadJoystick = joystickPointerId !== null
    ;(A(), hadJoystick || b(), event.actions.isScoreboardPinned() || event.actions.setScoreboard(!1, !1))
  }
  addWindowListener("blur", V)
  const onVisibilityChange = () => {
    document.hidden && V()
  }
  ;(document.addEventListener("visibilitychange", onVisibilityChange),
    disposers.push(() => document.removeEventListener("visibilitychange", onVisibilityChange)),
    addListener(root, "contextmenu", (contextEvent) => contextEvent.preventDefault()),
    addListener(
      root,
      "touchmove",
      (touchEvent) => {
        ;(touchEvent.target instanceof Element && touchEvent.target.closest(".sf-scroll, input")) || (touchEvent.cancelable && touchEvent.preventDefault())
      },
      { passive: !1 },
    ))
  const blockGesture = (gestureEvent) => gestureEvent.preventDefault()
  for (const gesturestartgesturechangegestureend of ["gesturestart", "gesturechange", "gestureend"]) (root.addEventListener(gesturestartgesturechangegestureend, blockGesture), disposers.push(() => root.removeEventListener(gesturestartgesturechangegestureend, blockGesture)))
  ;(addListener(root, "dblclick", (clickEvent) => {
    ;(clickEvent.target instanceof Element && clickEvent.target.closest(".sf-hud__card")) || clickEvent.preventDefault()
  }),
    addListener(root, "selectstart", (selectEvent) => selectEvent.preventDefault()))
  let inputBlockedResult = event.inputBlocked()
  return {
    joystick: joystick,
    reset: V,
    isAiming: () => lookupKey !== null,
    cancelAim: N,
    update(newState) {
      const newInputBlocked = newState.inputBlocked()
      if ((newInputBlocked !== inputBlockedResult && ((inputBlockedResult = newInputBlocked), newInputBlocked && (N(), (lastMoveX = lastMoveY = 0))), !newInputBlocked)) {
        if ((b(), attackInputs.size > 0 && nowSeconds() - lastAttackTime >= AUTO_ATTACK_INTERVAL_SEC && q(), keySkill)) Q()
        else if (typeof lookupKey == "number") {
          const Result = activePointers.get(lookupKey)
          Result && nt(Result)
        }
      }
    },
    onMode() {
      joystickPointerId !== null && A()
    },
    dispose() {
      V()
      for (const cleanup of disposers) cleanup()
      ;((disposers.length = 0), refreshHud())
    },
  }
}

export { bindInputControls }