/**
 * 单位视觉：技能特效表、状态特效表与 UnitVisualView
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MONSTER_VFX_HANDLERS, CHIJIN_VFX_HANDLERS, FENGLING_VFX_HANDLERS, getFirstValue, getSkillWidth, getUnitHeight, involvesPlayer } from './unit-views'
import { VFX_RIBBON_STYLES, emitGoosePlume, HIT_FEEDBACK_TUNING, emitInkStreakDecal, emitPlumeBurst, emitTwinSlashGlow, emitInkDotBurst, VFX_EMITTERS, emitRingDecal, emitDustTrail, emitGroundImpact, emitHitSparks, emitHoopGlow, emitInkBurst, emitPillarGlow } from '../fx/emitters'
import { BATTLE_EVENT_VFX, PANYUE_SKILL_VFX, XINGLI_MOTE_SPAWN, XINGLI_VFX_PALETTE, emitMoteBurst } from './unit-skill-fx'
import { FX_SHAPES, FX_STYLES, HERO_VFX_PALETTES, VFX_COLORS, hexToColor, FX_TWO_PI } from '../fx/fx-definitions'
import { GROUND_FX_KINDS } from './decal-pen'
import { SKILL_VISUALS } from '../fx/vfx-system'
import { PARTICLE_KIND } from '../particle-atlas'
import { HERO_TABLE } from '../../heroes/registry'

const playXingliPassiveFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param combatEvent - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, combatEvent, playerState) => {
    const coordX = combatEvent.pos.x,
      coordY = combatEvent.pos.y,
      UnitHeightValue = getUnitHeight(fxContext, combatEvent.targetId, 0.55, 1.1)
    ;(emitRingDecal(fxContext, coordX, coordY, 2.3, 0.6, XINGLI_VFX_PALETTE.glow, 3, 1.8, !1, 0.2),
      fxContext.ribbons.trace(VFX_RIBBON_STYLES.string, coordX, 5.2, coordY, coordX, 0.1, coordY, 0.06, VFX_COLORS.stringGold, XINGLI_VFX_PALETTE.accent),
      fxContext.glow.spawn(FX_SHAPES.pillar, FX_STYLES.pillar, 0.42).at(coordX, 0.05, coordY).scale3(0.09, 4.6, 0.09, 0.05, 5.2, 0.05).color(XINGLI_VFX_PALETTE.accent, 1.5, 0.9).fade(0.05, 0.4).opt(0.4, 0.5, 1),
      fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, XINGLI_VFX_PALETTE.glow).spawn(coordX, UnitHeightValue, coordY, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 1.3, 2.1))
    const tintResult = fxContext.particles.use(VFX_EMITTERS.ringB).tint(XINGLI_VFX_PALETTE.hot, XINGLI_VFX_PALETTE.glow)
    ;(tintResult.spawn(coordX, UnitHeightValue, coordY, 0, 0, 0, 0.3, 0.6, 2.4),
      tintResult.spawn(coordX, UnitHeightValue, coordY, 0, 0, 0, 0.34, 0.4, 1.8, 0.08),
      emitMoteBurst(fxContext, coordX, UnitHeightValue, coordY, 10, 4.2),
      fxContext.light(coordX, coordY, UnitHeightValue, XINGLI_VFX_PALETTE.glow, 6, 7, 0.3),
      fxContext.shake(involvesPlayer(combatEvent, playerState) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.06, coordX, coordY))
  },
  playXingliS1Fx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param combatEvent - 次要输入
 */
(fxContext, combatEvent) => {
    const dirX = combatEvent.dir?.x ?? 1,
      dirY = combatEvent.dir?.y ?? 0,
      castAngle = Math.atan2(dirY, dirX),
      spawnX = combatEvent.pos.x + dirX * 0.8,
      spawnY = combatEvent.pos.y + dirY * 0.8,
      spawnHeight = 1.45
    ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, XINGLI_VFX_PALETTE.glow).spawn(spawnX, spawnHeight, spawnY, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.8, 1.3),
      fxContext.glow
        .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, 0.26)
        .at(spawnX, spawnHeight, spawnY)
        .vel(dirX * 8, 0, dirY * 8)
        .rot(0, -castAngle, -Math.PI / 2)
        .scale(0.22, 1.05)
        .color(XINGLI_VFX_PALETTE.glow, 1.8, 0.9)
        .fade(0.1, 0.4))
    const waveEmitter = fxContext.particles.use(VFX_EMITTERS.wave).tint(XINGLI_VFX_PALETTE.hot, XINGLI_VFX_PALETTE.glow)
    ;(waveEmitter.spawn(spawnX, spawnHeight, spawnY, dirX * 9, 0, dirY * 9, 0.24, 0.9, 1.7), waveEmitter.spawn(spawnX, spawnHeight, spawnY, dirX * 6, 0, dirY * 6, 0.28, 0.7, 1.4, 0.05))
    const useResult = fxContext.particles.use(VFX_EMITTERS.string)
    for (let index = 0; index < 4; index++) {
      const lateralOffset = (index - 1.5) * 0.17
      useResult.spawn(spawnX - dirY * lateralOffset - dirX * 0.3, spawnHeight + (index - 1.5) * 0.05, spawnY + dirX * lateralOffset - dirY * 0.3, dirX * 17, 0, dirY * 17, 0.15, 0.07, 0.03, index * 0.012)
    }
    fxContext.decals
      .add(GROUND_FX_KINDS.streak, spawnX + dirX * 1.5, spawnY + dirY * 1.5, 1.9, 0.26)
      .rot(castAngle, 0.14)
      .params(0, 6)
      .color(XINGLI_VFX_PALETTE.accent, 1.2, 0.8)
      .under(VFX_COLORS.black, 0)
  },
  playXingliS2Fx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param combatEvent - 次要输入
 * @param playerState - 第三输入
 */
(fxBuilder, combatEvent, playerState) => {
    const xValue = combatEvent.pos.x,
      yValue = combatEvent.pos.y,
      effectRadius = combatEvent.radius ?? 3.4,
      rng = fxBuilder.rnd
    fxBuilder.decals.add(GROUND_FX_KINDS.ring, xValue, yValue, effectRadius, 0.26).params(1, 0.08).color(XINGLI_VFX_PALETTE.glow, 1.9).under(XINGLI_VFX_PALETTE.dark, 0.35)
    const stringEmitter = fxBuilder.particles.use(VFX_EMITTERS.string),
      baseAngle = rng.next() * FX_TWO_PI
    for (let index = 0; index < 8; index++) {
      const spawnAngle = baseAngle + (index * FX_TWO_PI) / 8,
        outwardSpeed = (effectRadius * 0.92) / 0.1
      stringEmitter.spawn(xValue + Math.cos(spawnAngle) * effectRadius, 0.55, yValue + Math.sin(spawnAngle) * effectRadius, -Math.cos(spawnAngle) * outwardSpeed, 0, -Math.sin(spawnAngle) * outwardSpeed, 0.1, 0.07, 0.03, index * 0.004)
    }
    fxBuilder.after(0.1, () => {
      ;(fxBuilder.particles
        .use(VFX_EMITTERS.hitFlash)
        .tint(VFX_COLORS.white, XINGLI_VFX_PALETTE.glow)
        .spawn(xValue, 0.9, yValue, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, effectRadius * 0.5, effectRadius * 0.85),
        emitHoopGlow(fxBuilder, xValue, 0.7, yValue, effectRadius * 0.2, effectRadius * 0.98, 0.6, 0.3, XINGLI_VFX_PALETTE.hot, 1.9, 0.9),
        emitGroundImpact(fxBuilder, xValue, yValue, effectRadius, 0.4, XINGLI_VFX_PALETTE.glow, 1.6, 0.12, 0.25),
        emitRingDecal(fxBuilder, xValue, yValue, effectRadius * 0.72, 0.45, XINGLI_VFX_PALETTE.accent, 2, 1.3, !1, 0.2, 0.04),
        emitPillarGlow(fxBuilder, xValue, yValue, 0.22, 5.5, 0.32, XINGLI_VFX_PALETTE.hot, 1.6, 0.6),
        emitPlumeBurst(fxBuilder, xValue, 1.1, yValue, 3, 2.4),
        emitMoteBurst(fxBuilder, xValue, 1, yValue, 10, 5),
        fxBuilder.light(xValue, yValue, 1.8, XINGLI_VFX_PALETTE.glow, HIT_FEEDBACK_TUNING.lightMax, effectRadius * 2.4, 0.35),
        fxBuilder.shake(involvesPlayer(combatEvent, playerState) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.06, xValue, yValue))
    })
  },
  playXingliUltFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param combatEvent - 次要输入
 */
(fxContext, combatEvent) => {
    const anchorUnitId = combatEvent.unitId ?? -1,
      anchorResult = fxContext.anchor(anchorUnitId),
      centerX = anchorResult ? fxContext.a.x : combatEvent.pos.x,
      centerZ = anchorResult ? fxContext.a.z : combatEvent.pos.y,
      facingAngle = anchorResult && fxContext.a.unit ? fxContext.a.unit.facing : 0,
      facingDirX = Math.cos(facingAngle),
      facingDirZ = Math.sin(facingAngle),
      underResult = fxContext.decals.add(GROUND_FX_KINDS.moon, centerX, centerZ, 2.1, 1.1).params(0.7, 1).color(XINGLI_VFX_PALETTE.hot, 1.5).under(XINGLI_VFX_PALETTE.dark, 0.35)
    anchorResult && underResult.follow(anchorUnitId)
    const emitPillarGlowValue = emitPillarGlow(fxContext, anchorResult ? 0 : centerX, anchorResult ? 0 : centerZ, 0.18, 9, 0.6, XINGLI_VFX_PALETTE.hot, 1.5, 0.55)
    anchorResult && emitPillarGlowValue.follow(anchorUnitId)
    for (let index = 0; index < 2; index++) {
      const delayResult = emitHoopGlow(fxContext, anchorResult ? 0 : centerX, 0.3, anchorResult ? 0 : centerZ, 1.2 - index * 0.3, 0.55, 5, 0.55, XINGLI_VFX_PALETTE.glow, 1.8, 0.85).delay(index * 0.12)
      anchorResult && delayResult.follow(anchorUnitId)
    }
    const plumeCount = fxContext.lowQ ? 3 : 5
    for (let plumeIndex = 0; plumeIndex < plumeCount; plumeIndex++) {
      const plumeTier = Math.ceil(plumeIndex / 2),
        sideSign = plumeIndex === 0 ? 0 : plumeIndex % 2 === 1 ? 1 : -1,
        plumeX = centerX - facingDirX * (1.6 + plumeTier * 0.9) - facingDirZ * sideSign * plumeTier * 0.8,
        plumeZ = centerZ - facingDirZ * (1.6 + plumeTier * 0.9) + facingDirX * sideSign * plumeTier * 0.8
      emitGoosePlume(fxContext, plumeX, 3.3 + plumeTier * 0.12, plumeZ, facingDirX * 12, -1.3, facingDirZ * 12, 0.62, 1, 1.05, 0.05 + plumeTier * 0.03)
    }
    ;(emitMoteBurst(fxContext, centerX, 1.4, centerZ, 8, 2.6, 0.7), fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, XINGLI_VFX_PALETTE.glow).spawn(centerX, 1.6, centerZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 1, 1.7), fxContext.light(centerX, centerZ, 2.2, XINGLI_VFX_PALETTE.glow, 6, 8, 0.35))
  },
  playXingliMeteorFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param combatEvent - 次要输入
 */
(fxContext, combatEvent) => {
    const impactX = combatEvent.pos.x,
      impactY = combatEvent.pos.y,
      impactRadius = combatEvent.radius ?? 1.7,
      rng = fxContext.rnd,
      spawnOffsetX = XINGLI_MOTE_SPAWN.x + rng.signed() * 0.5,
      spawnOffsetZ = XINGLI_MOTE_SPAWN.z + rng.signed() * 0.5,
      travelTime = XINGLI_MOTE_SPAWN.time,
      spawnSpeedX = -spawnOffsetX / travelTime,
      verticalSpeed = -7.1 / travelTime,
      spawnSpeedZ = -spawnOffsetZ / travelTime
    emitGoosePlume(fxContext, impactX + spawnOffsetX, XINGLI_MOTE_SPAWN.y, impactY + spawnOffsetZ, spawnSpeedX, verticalSpeed, spawnSpeedZ, travelTime, 2.05, 1.08)
    const distance = Math.hypot(spawnOffsetX, spawnOffsetZ) || 1,
      ribbonOffsetX = (-spawnOffsetZ / distance) * 0.72,
      ribbonOffsetZ = (spawnOffsetX / distance) * 0.72
    for (const ribbonSide of [1, -1]) fxContext.ribbons.trace(VFX_RIBBON_STYLES.thin, impactX + spawnOffsetX * 0.28 + ribbonOffsetX * ribbonSide, XINGLI_MOTE_SPAWN.y * 0.28 + 0.4, impactY + spawnOffsetZ * 0.28 + ribbonOffsetZ * ribbonSide, impactX + ribbonOffsetX * ribbonSide, 0.55, impactY + ribbonOffsetZ * ribbonSide, travelTime * 0.28, XINGLI_VFX_PALETTE.hot, XINGLI_VFX_PALETTE.glow)
    fxContext.after(travelTime, () => {
      ;(fxContext.particles
        .use(VFX_EMITTERS.hitFlash)
        .tint(VFX_COLORS.white, XINGLI_VFX_PALETTE.glow)
        .spawn(impactX, 0.5, impactY, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, impactRadius * 0.7, impactRadius * 1.2),
        emitGoosePlume(fxContext, impactX, 0.6, impactY, spawnSpeedX * 0.012, verticalSpeed * 0.012, spawnSpeedZ * 0.012, 0.32, 2, 1.3),
        emitGroundImpact(fxContext, impactX, impactY, impactRadius, 0.36, XINGLI_VFX_PALETTE.glow, 1.8, 0.15, 0.3),
        emitRingDecal(fxContext, impactX, impactY, impactRadius * 0.62, 0.42, XINGLI_VFX_PALETTE.accent, 1, 1.5, !1, 0.16, 0.03),
        emitDustTrail(fxContext, impactX, 0.15, impactY, 2, 0.4, 1, VFX_COLORS.sand, VFX_COLORS.sandDark, 0.5),
        emitPlumeBurst(fxContext, impactX, 0.9, impactY, 3, 1.6),
        fxContext.light(impactX, impactY, 1.2, XINGLI_VFX_PALETTE.glow, 4, 6, 0.25),
        fxContext.shake(0.08, impactX, impactY))
    })
  },
  XINGLI_SKILL_VFX = { xingli_passive_burst: playXingliPassiveFx, xingli_s1_cast: playXingliS1Fx, xingli_s2_burst: playXingliS2Fx, xingli_ult_cast: playXingliUltFx, xingli_meteor: playXingliMeteorFx },
  YEQUE_VFX_PALETTE = HERO_VFX_PALETTES.yeque,
  YEQUE_S1_SPEC = HERO_TABLE.yeque.skills.s1,
  YEQUE_S2_SPEC = HERO_TABLE.yeque.skills.s2,
  YEQUE_ULT_SPEC = HERO_TABLE.yeque.skills.ult,
  BLADE_TRAIL_TUNING = { max: 8, width: 0.8, unroll: 0.3 },
  DUST_SAND_COLOR = hexToColor(13483912),
  playYequeS1Fx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param combatEvent - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, combatEvent, playerState) => {
    const dashOrigin = combatEvent.from ?? combatEvent.pos,
      dashTarget = combatEvent.to ?? combatEvent.pos
    let dashDirX = dashTarget.x - dashOrigin.x,
      dashDirY = dashTarget.y - dashOrigin.y
    const distance = Math.hypot(dashDirX, dashDirY) || 0.01
    ;((dashDirX /= distance), (dashDirY /= distance))
    const dashDuration = distance / getFirstValue(YEQUE_S1_SPEC, "dashSpeed"),
      rng = fxContext.rnd
    ;(fxContext.ribbons.trace(VFX_RIBBON_STYLES.ink, dashOrigin.x, 0.95, dashOrigin.y, dashTarget.x, 0.95, dashTarget.y, dashDuration),
      fxContext.ribbons.trace(VFX_RIBBON_STYLES.thin, dashOrigin.x, 1.05, dashOrigin.y, dashTarget.x, 1.05, dashTarget.y, dashDuration, YEQUE_VFX_PALETTE.hot, YEQUE_VFX_PALETTE.accent),
      emitInkStreakDecal(fxContext, dashOrigin.x - dashDirX * 0.5, dashOrigin.y - dashDirY * 0.5, dashTarget.x + dashDirX * 0.7, dashTarget.y + dashDirY * 0.7, getSkillWidth(YEQUE_S1_SPEC) * 0.62, 1.3, dashDuration / 1.3, YEQUE_VFX_PALETTE.hot, 1.4, 0.8),
      emitInkBurst(fxContext, dashOrigin.x, 0.7, dashOrigin.y, 1.1))
    const nResult = fxContext.n(10),
      inkDotEmitter = fxContext.particles.use(VFX_EMITTERS.inkDot)
    for (let index = 0; index < nResult; index++) {
      const randomRatio = rng.next(),
        sideSign = rng.chance(0.5) ? 1 : -1,
        inkScatterSpeed = rng.range(1.5, 4.5),
        inkDotSize = rng.range(0.09, 0.2)
      inkDotEmitter.spawn(dashOrigin.x + dashDirX * distance * randomRatio, rng.range(0.5, 1.2), dashOrigin.y + dashDirY * distance * randomRatio, -dashDirY * sideSign * inkScatterSpeed + dashDirX * 2, rng.range(0.5, 2.5), dashDirX * sideSign * inkScatterSpeed + dashDirY * 2, rng.range(0.35, 0.55), inkDotSize, inkDotSize * 0.7, randomRatio * dashDuration)
    }
    const streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(YEQUE_VFX_PALETTE.hot, YEQUE_VFX_PALETTE.accent)
    for (let streakIndex = 0; streakIndex < 3; streakIndex++) {
      const streakTravel = rng.range(0.1, 0.7),
        streakLateral = (streakIndex - 1) * 0.55
      streakEmitter.spawn(dashOrigin.x + dashDirX * distance * streakTravel - dashDirY * streakLateral, rng.range(0.5, 1.5), dashOrigin.y + dashDirY * distance * streakTravel + dashDirX * streakLateral, dashDirX * 13, 0, dashDirY * 13, 0.18, 0.08, 0.02, streakTravel * dashDuration)
    }
    ;(fxContext.after(dashDuration, () => {
      ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, YEQUE_VFX_PALETTE.hot).spawn(dashTarget.x, 1, dashTarget.y, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.7, 1.2), emitInkDotBurst(fxContext, dashTarget.x, 0.8, dashTarget.y, 5, 5, dashDirX, dashDirY, 0.6))
    }),
      combatEvent.unitId === playerState.playerId && fxContext.shake(0.08, dashOrigin.x, dashOrigin.y))
  },
  playYequeS2Fx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param combatEvent - 次要输入
 */
(fxContext, combatEvent) => {
    const castDirX = combatEvent.dir?.x ?? 1,
      castDirY = combatEvent.dir?.y ?? 0,
      atan2Atan2Result = Math.atan2(castDirY, castDirX),
      spawnX = combatEvent.pos.x + castDirX * 0.7,
      spawnY = combatEvent.pos.y + castDirY * 0.7,
      spawnHeight = 1.2,
      FirstValueValue = getFirstValue(YEQUE_S2_SPEC, "spread"),
      streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, YEQUE_VFX_PALETTE.accent)
    for (let index = -1; index <= 1; index++) {
      const fanAngle = atan2Atan2Result + index * FirstValueValue
      ;(streakEmitter.spawn(spawnX, spawnHeight, spawnY, Math.cos(fanAngle) * 22, 0, Math.sin(fanAngle) * 22, 0.13, 0.09, 0.02), streakEmitter.spawn(spawnX, spawnHeight, spawnY, Math.cos(fanAngle) * 14, 0, Math.sin(fanAngle) * 14, 0.11, 0.07, 0.02, 0.02))
    }
    ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, YEQUE_VFX_PALETTE.hot).spawn(spawnX, spawnHeight, spawnY, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.6, 1), emitInkDotBurst(fxContext, spawnX, spawnHeight, spawnY, 7, 7, castDirX, castDirY, FirstValueValue * 1.6), emitInkBurst(fxContext, combatEvent.pos.x + castDirX * 0.3, 0.9, combatEvent.pos.y + castDirY * 0.3, 0.7, !1))
  },
  playYequeUltVanishFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param combatEvent - 次要输入
 */
(fxContext, combatEvent) => {
    const effectX = combatEvent.pos.x,
      effectZ = combatEvent.pos.y,
      rng = fxContext.rnd
    let dirX = 1,
      dirZ = 0,
      trailLength = 3
    if ((fxContext.anchor(combatEvent.unitId) && fxContext.a.unit && ((dirX = Math.cos(fxContext.a.unit.facing)), (dirZ = Math.sin(fxContext.a.unit.facing))), fxContext.anchor(combatEvent.targetId))) {
      const targetOffsetX = fxContext.a.x - effectX,
        targetOffsetZ = fxContext.a.z - effectZ,
        distance = Math.hypot(targetOffsetX, targetOffsetZ)
      distance > 0.3 && ((dirX = targetOffsetX / distance), (dirZ = targetOffsetZ / distance), (trailLength = Math.min(BLADE_TRAIL_TUNING.max, distance)))
    }
    const getFirstValueFirstValueValue = getFirstValue(YEQUE_ULT_SPEC, "vanish"),
      decalLength = getFirstValueFirstValueValue + 0.45,
      trailHalfLength = trailLength / 2
    ;(fxContext.decals
      .add(GROUND_FX_KINDS.scroll, effectX + dirX * trailHalfLength, effectZ + dirZ * trailHalfLength, trailHalfLength, decalLength)
      .rot(Math.atan2(dirZ, dirX), (BLADE_TRAIL_TUNING.width * 0.5 * 1.8) / trailHalfLength)
      .params(Math.min(BLADE_TRAIL_TUNING.unroll, getFirstValueFirstValueValue) / decalLength, rng.next() * FX_TWO_PI)
      .color(VFX_COLORS.ink, 1)
      .under(DUST_SAND_COLOR, fxContext.ctx.terrain.inWater(effectX + dirX * trailHalfLength, effectZ + dirZ * trailHalfLength) ? 0.42 : 0.52),
      fxContext.glow.spawn(FX_SHAPES.cone, FX_STYLES.vortex, 0.38).at(effectX, 0.05, effectZ).scale3(0.85, 1.7, 0.85, 0.3, 2.1, 0.3).color(VFX_COLORS.ink, 1, 0.95).fade(0.04, 0.35).opt(0, 5, 1).spin(0, 11, 0),
      emitInkBurst(fxContext, effectX, 1.1, effectZ, 1.7),
      emitInkBurst(fxContext, effectX + rng.signed() * 0.3, 0.6, effectZ + rng.signed() * 0.3, 1.2, !0, 0.05),
      emitInkDotBurst(fxContext, effectX, 1, effectZ, 10, 4.5),
      fxContext.decals.add(GROUND_FX_KINDS.scorch, effectX, effectZ, 1.35, 1.5).color(VFX_COLORS.black, 0).under(VFX_COLORS.ink, 0.95),
      fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, YEQUE_VFX_PALETTE.hot).spawn(effectX, 1.1, effectZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.6, 1))
  },
  playYequeUltStrikeFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param combatEvent - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, combatEvent, playerState) => {
    const strikeX = combatEvent.pos.x,
      strikeY = combatEvent.pos.y,
      strikeOrigin = combatEvent.from ?? combatEvent.pos,
      strikeTarget = combatEvent.to ?? combatEvent.pos,
      getUnitHeightUnitHeightValue = getUnitHeight(fxContext, combatEvent.targetId, 0.5, 1.1),
      rng = fxContext.rnd
    let strikeDirX = strikeX - strikeTarget.x,
      strikeDirY = strikeY - strikeTarget.y
    const distance = Math.hypot(strikeDirX, strikeDirY) || 1
    ;((strikeDirX /= distance), (strikeDirY /= distance))
    const strikeAngle = Math.atan2(strikeDirY, strikeDirX)
    ;(fxContext.ribbons.trace(VFX_RIBBON_STYLES.thin, strikeOrigin.x, 1.05, strikeOrigin.y, strikeTarget.x, 1.05, strikeTarget.y, 0.05, VFX_COLORS.white, YEQUE_VFX_PALETTE.accent),
      emitTwinSlashGlow(fxContext, strikeX - strikeDirX * 1.7, getUnitHeightUnitHeightValue - 0.1, strikeY - strikeDirY * 1.7 + 0.5, strikeAngle, 2.1, 0.24, YEQUE_VFX_PALETTE.hot, VFX_COLORS.white, 1.25, -Math.PI / 2 + 0.4, !1, 2.6))
    const streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, YEQUE_VFX_PALETTE.accent)
    ;(streakEmitter.spawn(strikeX, getUnitHeightUnitHeightValue - 0.6, strikeY, strikeDirX * 1.5, 16, strikeDirY * 1.5, 0.14, 0.11, 0.03, 0.03),
      streakEmitter.spawn(strikeX + strikeDirX * 0.15, getUnitHeightUnitHeightValue - 0.3, strikeY + strikeDirY * 0.15, strikeDirX * 1.5, 11, strikeDirY * 1.5, 0.12, 0.08, 0.02, 0.05),
      emitHitSparks(fxContext, strikeX, getUnitHeightUnitHeightValue, strikeY, 2.1, YEQUE_VFX_PALETTE.hot, YEQUE_VFX_PALETTE.accent, strikeDirX, strikeDirY, 9, HIT_FEEDBACK_TUNING.flashBig, 11))
    for (let index = 0; index < 5; index++) {
      const streakAngle = strikeAngle + (index - 2) * 0.62 + rng.signed() * 0.18,
        streakRadius = rng.range(1.1, 1.9) * (index === 2 ? 1.3 : 1)
      emitInkStreakDecal(fxContext, strikeX + Math.cos(streakAngle) * (0.3 + streakRadius), strikeY + Math.sin(streakAngle) * (0.3 + streakRadius), strikeX + Math.cos(streakAngle) * 0.2, strikeY + Math.sin(streakAngle) * 0.2, rng.range(0.55, 0.8), 1.5, 0)
    }
    ;(emitInkBurst(fxContext, strikeX, getUnitHeightUnitHeightValue, strikeY, 1.9), emitInkDotBurst(fxContext, strikeX, getUnitHeightUnitHeightValue, strikeY, 10, 7, strikeDirX, strikeDirY, 1.3), emitInkDotBurst(fxContext, strikeX, getUnitHeightUnitHeightValue, strikeY, 5, 5, strikeDirX, strikeDirY, 1, 0.02, VFX_COLORS.cinnabar))
    const silkEmitter = fxContext.particles.use(VFX_EMITTERS.silk)
    for (let silkIndex = 0; silkIndex < fxContext.n(5); silkIndex++) {
      const silkSize = rng.range(0.16, 0.3)
      silkEmitter.spawn(strikeTarget.x + rng.signed() * 0.6, rng.range(1.2, 2.2), strikeTarget.y + rng.signed() * 0.6, rng.signed() * 1.4, rng.range(0.4, 1.8), rng.signed() * 1.4, rng.range(0.8, 1.2), silkSize, silkSize * 0.9, rng.next() * 0.1)
    }
    ;(fxContext.decals.add(GROUND_FX_KINDS.scorch, strikeX, strikeY, 1.25, 2.2).color(VFX_COLORS.black, 0).under(VFX_COLORS.ink, 0.9), fxContext.light(strikeX, strikeY, getUnitHeightUnitHeightValue, YEQUE_VFX_PALETTE.hot, HIT_FEEDBACK_TUNING.lightMax, 8, 0.3), fxContext.shake(involvesPlayer(combatEvent, playerState) ? 0.4 : 0.25, strikeX, strikeY))
  },
  YEQUE_SKILL_VFX = { yeque_s1_dash: playYequeS1Fx, yeque_s2_cast: playYequeS2Fx, yeque_ult_vanish: playYequeUltVanishFx, yeque_ult_strike: playYequeUltStrikeFx },
  ALL_UNIT_VFX = { ...BATTLE_EVENT_VFX, ...MONSTER_VFX_HANDLERS, ...PANYUE_SKILL_VFX, ...CHIJIN_VFX_HANDLERS, ...XINGLI_SKILL_VFX, ...FENGLING_VFX_HANDLERS, ...YEQUE_SKILL_VFX }

class UnitVisualView {
  views = new Map()
  list = []
  k
  stamp = 0
  constructor(fxContext) {
    this.k = fxContext
  }
  create(projectile) {
    const kindValue = this.k,
      selectedSKILL_VISUALS = SKILL_VISUALS[projectile.visual],
      colorsResult = selectedSKILL_VISUALS.colors(projectile.team),
      originX = projectile.pos.x - projectile.dir.x * projectile.traveled,
      originZ = projectile.pos.y - projectile.dir.y * projectile.traveled
    let baseHeight = 1.3
    if (kindValue.anchor(projectile.ownerId)) {
      const ownerUnit = kindValue.a.unit,
        isStructure = ownerUnit !== null && (ownerUnit.kind === "tower" || ownerUnit.kind === "core")
      ;((baseHeight = isStructure ? kindValue.a.height * 0.82 : Math.min(kindValue.a.height * 0.6, 2.2)), kindValue.anchors.attach?.(projectile.ownerId, isStructure ? "core" : "muzzle", kindValue.v) && (baseHeight = kindValue.v.y))
    }
    const mainGlowMesh = kindValue.glow.hold(selectedSKILL_VISUALS.shape, selectedSKILL_VISUALS.mode)
    ;(mainGlowMesh.color(selectedSKILL_VISUALS.mode === FX_STYLES.solid ? colorsResult.hot : colorsResult.glow, selectedSKILL_VISUALS.intensity, 0), (mainGlowMesh.add = selectedSKILL_VISUALS.add), (mainGlowMesh.k = selectedSKILL_VISUALS.k), (mainGlowMesh.progress = selectedSKILL_VISUALS.progress))
    const echoMeshes = []
    for (let index = 0; index < selectedSKILL_VISUALS.echo; index++) {
      const echoGlowMesh = kindValue.glow.hold(selectedSKILL_VISUALS.shape, selectedSKILL_VISUALS.mode)
      ;(echoGlowMesh.color(index === 0 ? colorsResult.glow : colorsResult.deep, selectedSKILL_VISUALS.intensity * (index === 0 ? 0.75 : 1.1), 0), (echoGlowMesh.add = selectedSKILL_VISUALS.add), (echoGlowMesh.k = selectedSKILL_VISUALS.k), (echoGlowMesh.progress = selectedSKILL_VISUALS.progress), echoMeshes.push(echoGlowMesh))
    }
    return {
      id: projectile.id,
      def: selectedSKILL_VISUALS,
      colors: colorsResult,
      team: projectile.team,
      seen: 0,
      mesh: mainGlowMesh,
      ribbon: -1,
      decal: -1,
      sx: originX,
      sz: originZ,
      h0: baseHeight,
      x: originX,
      y: baseHeight,
      z: originZ,
      acc: 0,
      age: 0,
      shown: !1,
      dx: projectile.dir.x,
      dz: projectile.dir.y,
      echoes: echoMeshes,
      hitAt: -1,
    }
  }
  release(projectileVisual) {
    const kValue = this.k
    kValue.glow.release(projectileVisual.mesh)
    for (const echoMesh of projectileVisual.echoes) kValue.glow.release(echoMesh)
    ;(kValue.ribbons.end(projectileVisual.ribbon), projectileVisual.decal >= 0 && kValue.decals.release(projectileVisual.decal, 0.15))
  }
  update(world) {
    const kindResult = this.k,
      frameStamp = ++this.stamp,
      alpha = world.alpha,
      deltaTime = world.dt
    for (const projectile of world.state.projectiles) {
      let Value = this.views.get(projectile.id)
      ;(Value || ((Value = this.create(projectile)), this.views.set(projectile.id, Value), this.list.push(Value)), (Value.seen = frameStamp), (Value.age += deltaTime))
      const visualDef = Value.def,
        interpolatedX = projectile.prevPos.x + (projectile.pos.x - projectile.prevPos.x) * alpha,
        interpolatedZ = projectile.prevPos.y + (projectile.pos.y - projectile.prevPos.y) * alpha
      let total = 1.25
      if (projectile.targetId >= 0) {
        let targetX = interpolatedX,
          targetZ = interpolatedZ,
          targetHeight = 1
        kindResult.anchor(projectile.targetId) && ((targetX = kindResult.a.x), (targetZ = kindResult.a.z), (targetHeight = kindResult.a.y + Math.min(kindResult.a.height * 0.5, 3.2)))
        const distance = Math.hypot(interpolatedX - Value.sx, interpolatedZ - Value.sz),
          targetDistance = Math.hypot(targetX - interpolatedX, targetZ - interpolatedZ),
          heightBlend = distance + targetDistance > 0.01 ? distance / (distance + targetDistance) : 1
        ;((total = Value.h0 + (targetHeight - Value.h0) * heightBlend), visualDef.arc > 0 && (total += 4 * heightBlend * (1 - heightBlend) * (1.6 + (distance + targetDistance) * 0.16) * visualDef.arc))
      }
      let isVisible = projectile.team === world.playerTeam || kindResult.anchors.pointVisible(interpolatedX, interpolatedZ)
      !isVisible && kindResult.anchor(projectile.ownerId) && (isVisible = kindResult.a.visible)
      let moveDirX = interpolatedX - Value.x,
        moveDirY = total - Value.y,
        moveDirZ = interpolatedZ - Value.z
      const moveDirLength = Math.hypot(moveDirX, moveDirY, moveDirZ)
      moveDirLength < 1e-4 || Value.age <= deltaTime ? ((moveDirX = projectile.dir.x), (moveDirY = 0), (moveDirZ = projectile.dir.y)) : ((moveDirX /= moveDirLength), (moveDirY /= moveDirLength), (moveDirZ /= moveDirLength))
      const glowMesh = Value.mesh
      ;(glowMesh.at(interpolatedX, total, interpolatedZ), (glowMesh.a = isVisible ? 1 : 0))
      const growScale = Math.min(1, Value.age * 12 + 0.3)
      ;(glowMesh.scale3(visualDef.scale[0] * growScale, visualDef.scale[1] * growScale, visualDef.scale[2] * growScale), visualDef.yawSpin !== 0 ? glowMesh.rot(0.25, Value.age * visualDef.yawSpin, 0) : glowMesh.rot(Value.age * visualDef.roll, -Math.atan2(moveDirZ, moveDirX), Math.atan2(moveDirY, Math.hypot(moveDirX, moveDirZ))))
      for (let index = 0; index < Value.echoes.length; index++) {
        const selectedEchoes = Value.echoes[index],
          echoTrailDistance = Math.min(visualDef.echoGap * (index + 1), Math.hypot(interpolatedX - Value.sx, interpolatedZ - Value.sz)),
          echoScale = growScale * (1 - 0.14 * (index + 1))
        ;(selectedEchoes.at(interpolatedX - moveDirX * echoTrailDistance, total - moveDirY * echoTrailDistance, interpolatedZ - moveDirZ * echoTrailDistance)
          .scale3(visualDef.scale[0] * echoScale, visualDef.scale[1] * echoScale, visualDef.scale[2] * echoScale)
          .rot(glowMesh.rx, glowMesh.ry, glowMesh.rz),
          (selectedEchoes.a = isVisible && echoTrailDistance > visualDef.echoGap * (index + 0.5) ? 0.85 - index * 0.25 : 0))
      }
      const horizontalDist = Math.hypot(moveDirX, moveDirZ)
      if ((horizontalDist > 1e-4 && ((Value.dx = moveDirX / horizontalDist), (Value.dz = moveDirZ / horizontalDist)), isVisible)) {
        if (
          (visualDef.ribbon &&
            (Value.ribbon < 0
              ? ((Value.ribbon = kindResult.ribbons.start(visualDef.ribbon, interpolatedX, total, interpolatedZ, Value.colors.tail ?? Value.colors.glow, Value.colors.tail2 ?? Value.colors.deep)), kindResult.ribbons.setWidth(Value.ribbon, visualDef.ribbonWidth))
              : kindResult.ribbons.move(Value.ribbon, interpolatedX, total, interpolatedZ)),
          visualDef.halo > 0 && kindResult.sprites.draw(PARTICLE_KIND.glow, interpolatedX, total, interpolatedZ, visualDef.halo * (0.9 + 0.1 * Math.sin(Value.age * 40)), 0, Value.colors.glow, 1.25, 0.8, 0.5),
          visualDef.ground > 0 && (Value.decal < 0 && (Value.decal = kindResult.decals.hold(GROUND_FX_KINDS.glow, 0.08)), kindResult.decals.at(Value.decal).at(interpolatedX, interpolatedZ).radius(visualDef.ground).params(1.5).color(Value.colors.glow, 0.9, 0.8).under(VFX_COLORS.black, 0)),
          visualDef.rate > 0)
        )
          for (Value.acc += deltaTime * visualDef.rate * kindResult.density; Value.acc >= 1;) ((Value.acc -= 1), visualDef.emit(kindResult, Value.colors, interpolatedX, total, interpolatedZ, moveDirX, moveDirZ))
      } else Value.ribbon >= 0 && (kindResult.ribbons.end(Value.ribbon), (Value.ribbon = -1))
      ;((Value.x = interpolatedX), (Value.y = total), (Value.z = interpolatedZ), (Value.shown = isVisible))
    }
    const listState = this.list
    for (let listIndex = listState.length - 1; listIndex >= 0; listIndex--) {
      const selectedO = listState[listIndex]
      selectedO.seen !== frameStamp && (this.release(selectedO), this.views.delete(selectedO.id), (listState[listIndex] = listState[listState.length - 1]), listState.pop())
    }
  }
  handle(combatEvent, playerId, playerTeam) {
    const fxContext = this.k,
      getValue = this.views.get(combatEvent.id),
      visualDef = SKILL_VISUALS[combatEvent.visual],
      eventX = combatEvent.pos.x,
      eventY = combatEvent.pos.y
    if (!visualDef) return
    const effectColors = getValue ? getValue.colors : visualDef.colors(2)
    let effectHeight = getValue ? getValue.y : 1.2
    if (!getValue?.shown && !fxContext.anchors.pointVisible(eventX, eventY)) return
    const effectDirX = getValue ? getValue.dx : 1,
      effectDirZ = getValue ? getValue.dz : 0
    combatEvent.type === "projectileHit"
      ? (fxContext.anchor(combatEvent.targetId) && (effectHeight = fxContext.a.y + Math.min(fxContext.a.height * 0.5, 3.2)),
        getValue && (getValue.hitAt = fxContext.now),
        visualDef.hit(fxContext, effectColors, eventX, effectHeight, eventY, combatEvent.targetId === playerId || (getValue !== void 0 && getValue.team === playerTeam && fxContext.a.unit !== null && fxContext.a.unit.kind === "hero"), effectDirX, effectDirZ))
      : visualDef.end(fxContext, effectColors, eventX, effectHeight, eventY, effectDirX, effectDirZ, !getValue || getValue.hitAt < 0 || fxContext.now - getValue.hitAt > 0.08)
  }
  get count() {
    return this.views.size
  }
  reset() {
    for (const projectileVisual of this.list) this.release(projectileVisual)
    ;((this.list.length = 0), this.views.clear())
  }
}

const STATUS_GOLD_BRIGHT = hexToColor(16765002),
  STATUS_GOLD_AMBER = hexToColor(16762910),
  STATUS_GOLD_PALE = hexToColor(16773808),
  PANYUE_HERO_PALETTE = HERO_VFX_PALETTES.panyue,
  FROST_SIGIL_BLUE = hexToColor(5816575),
  FROST_SIGIL_DEEP_BLUE = hexToColor(2780400),
  STATUS_VIOLET_LIGHT = hexToColor(10791150),
  STATUS_VIOLET_DEEP = hexToColor(5001126),
  STATUS_ICE_BLUE = hexToColor(11065599),
  STATUS_WARM_GOLD = hexToColor(16760928),
  STATUS_EMBER_ORANGE = hexToColor(16738858),
  STATUS_EMBER_LIGHT = hexToColor(16760944),
  STATUS_AQUA_BLUE = hexToColor(5813503),
  STATUS_GREEN_LIGHT = hexToColor(5828744),
  STATUS_GREEN_DEEP = hexToColor(2080864),
  YEQUE_PALETTE_ALT = HERO_VFX_PALETTES.yeque,
  FENGLING_PALETTE = HERO_VFX_PALETTES.fengling,
  CHIJIN_PALETTE = HERO_VFX_PALETTES.chijin,
  XINGLI_PALETTE_ALT = HERO_VFX_PALETTES.xingli,
  STATUS_RED_HOT = hexToColor(16726568),
  STATUS_GLOW_GOLD = hexToColor(16760928),
  SIGIL_RADIUS_SCALE = 1.22

function sinePulse(elapsedTime, pulseStart) {
  const pulseProgress = (elapsedTime - pulseStart) / 0.22
  return pulseProgress <= 0 || pulseProgress >= 1 ? 0 : Math.sin(pulseProgress * Math.PI)
}

function accumulateSteps(fxTarget, effectState, frameDelta, spawnRate) {
  effectState.acc += frameDelta * spawnRate * fxTarget.density
  const stepCount = Math.floor(effectState.acc)
  return ((effectState.acc -= stepCount), stepCount)
}

function holdDecalSlot(fxSource, effectState, decalKind, holdDuration = 0.15) {
  const decalSlot = fxSource.decals.hold(decalKind, holdDuration)
  return (effectState.slots.push(decalSlot), decalSlot)
}

const ELEMENT_COLORS = { frost: 1.6, ember: 1.85, star: 2.1 }

function scaleDecalRadius(effectPos, elementStrength) {
  return Math.max(effectPos.radius * elementStrength, 0.75 + (elementStrength - 1.3) * 0.9) + 0.15
}

function expiryFlicker(effectState, effectMeta) {
  return effectMeta.timeLeft < 5 && Number.isFinite(effectMeta.timeLeft) ? 0.55 + 0.45 * Math.cos(effectState.age * 9) : 1
}

/**
 * 创建特效。
 *
 * @param elementIndex - 主要输入
 * @param sigilColor - 次要输入
 * @param sparkColor - 第三输入
 * @param elementStrength - 第四输入
 * @param spinRate - 附加输入
 * @param particleKind - 附加输入
 * @returns 结果对象
 */
function makeSigilEffect(elementIndex, sigilColor, sparkColor, elementStrength, spinRate, particleKind) {
  return {
    create(fxSource, effectState) {
      const holdDecalSlotResult = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.sigil, 0.3)
      fxSource.decals.at(holdDecalSlotResult).y(0.065).params(elementIndex, 1).color(sigilColor, 1.7, 0.85).under(VFX_COLORS.shadow, 0.3)
    },
    update(fxTarget, updateValue, position, effectMeta, frameDelta) {
      const expiryFlickerResult = expiryFlicker(updateValue, effectMeta),
        scaleDecalRadiusResult = scaleDecalRadius(position, elementStrength)
      fxTarget.decals
        .at(updateValue.slots[0])
        .at(position.x, position.z)
        .radius(scaleDecalRadiusResult)
        .rot(updateValue.age * spinRate)
        .alpha(0.85 * expiryFlickerResult)
      const orbitAngle = updateValue.phase + updateValue.age * 2 * Math.sign(spinRate),
        orbitRadius = position.radius + 0.5
      if ((fxTarget.sprites.icon(particleKind, position.x + Math.cos(orbitAngle) * orbitRadius, position.y + position.height * 0.42 + Math.sin(updateValue.age * 3) * 0.1, position.z + Math.sin(orbitAngle) * orbitRadius, 0.46, 0, sparkColor, 1.2, 0.85 * expiryFlickerResult, 0.25, 0.2), elementIndex === 0))
        for (let accumulateStepsIndex = accumulateSteps(fxTarget, updateValue, frameDelta, 1.6); accumulateStepsIndex > 0; accumulateStepsIndex--) {
          const puffAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.puff)
            .tint(VFX_COLORS.frostHot, VFX_COLORS.frost)
            .spawn(position.x + Math.cos(puffAngle) * scaleDecalRadiusResult * 0.8, position.y + 0.15, position.z + Math.sin(puffAngle) * scaleDecalRadiusResult * 0.8, Math.cos(puffAngle) * 0.3, 0.05, Math.sin(puffAngle) * 0.3, 1.2, 0.6, 1.4)
        }
      else
        for (let puffIndex = accumulateSteps(fxTarget, updateValue, frameDelta, 3); puffIndex > 0; puffIndex--) {
          const emberAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.ember)
            .tint(sparkColor, sigilColor)
            .spawn(position.x + Math.cos(emberAngle) * scaleDecalRadiusResult * 0.85, position.y + 0.15, position.z + Math.sin(emberAngle) * scaleDecalRadiusResult * 0.85, 0, fxTarget.rnd.range(0.8, 1.6), 0, 0.8, 0.12, 0.04)
        }
    },
  }
}

export { ALL_UNIT_VFX, STATUS_RED_HOT, ELEMENT_COLORS, SIGIL_RADIUS_SCALE, STATUS_VIOLET_DEEP, FENGLING_PALETTE, FROST_SIGIL_BLUE, CHIJIN_PALETTE, STATUS_EMBER_ORANGE, holdDecalSlot, STATUS_GREEN_LIGHT, STATUS_GOLD_BRIGHT, UnitVisualView, sinePulse, STATUS_GOLD_AMBER, makeSigilEffect, PANYUE_HERO_PALETTE, STATUS_VIOLET_LIGHT, STATUS_EMBER_LIGHT, scaleDecalRadius, STATUS_GLOW_GOLD, STATUS_ICE_BLUE, expiryFlicker, YEQUE_PALETTE_ALT, STATUS_WARM_GOLD, accumulateSteps, STATUS_GOLD_PALE, STATUS_GREEN_DEEP, XINGLI_PALETTE_ALT, STATUS_AQUA_BLUE, FROST_SIGIL_DEEP_BLUE }