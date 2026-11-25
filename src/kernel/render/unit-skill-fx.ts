/**
 * 英雄技能视觉：普攻/技能命中特效 handler 表与英雄调色板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { computeFacingDirection, facingScratch, getFirstValue, getSkillRange, getSkillWidth, getUnitHeight, involvesPlayer, readBuffIcons } from './unit-views'
import { VFX_RIBBON_STYLES, findRecentHitEvent, HIT_FEEDBACK_TUNING, VFX_EMITTERS, emitDustPuff, emitDustTrail, emitEarthChunks, emitEmbers, emitFlashBurst, emitGlint, emitGroundImpact, emitHitSparks, emitHoopGlow, emitPillarGlow, emitRockChips, emitShards, emitSlashGlow, emitSparkBurst, emitSphereGlow, emitSphereCoreGlow, emitShieldGlow, emitScorchDecal, emitRockBarrage } from '../fx/emitters'
import { FX_SHAPES, FX_STYLES, HERO_VFX_PALETTES, VFX_COLORS, FX_TWO_PI, triangleCountForShape } from '../fx/fx-definitions'
import { GROUND_FX_KINDS } from './decal-pen'
import { HERO_TABLE } from '../../heroes/registry'

const playPhysicalHitFx = /**
 * 播放特效与碰撞。
 *
 * @param fxBuilder - 主要输入
 * @param hitEvent - 次要输入
 */
(fxBuilder, hitEvent) => {
    const coordX = hitEvent.pos.x,
      coordY = hitEvent.pos.y,
      UnitHeightValue = getUnitHeight(fxBuilder, hitEvent.targetId, 0.5, 1),
      isCharacterUnit = fxBuilder.a.unit !== null && (fxBuilder.a.unit.kind === "hero" || fxBuilder.a.unit.kind === "monster")
    ;(computeFacingDirection(fxBuilder, hitEvent, coordX, coordY, facingScratch),
      emitHitSparks(fxBuilder, coordX, UnitHeightValue, coordY, isCharacterUnit ? 1.25 : 0.9, VFX_COLORS.warm, VFX_COLORS.sparkDeep, facingScratch.x, facingScratch.z, isCharacterUnit ? 7 : 4, HIT_FEEDBACK_TUNING.flashBasic, 9),
      emitGroundImpact(fxBuilder, coordX, coordY, isCharacterUnit ? 1.05 : 0.75, 0.22, VFX_COLORS.spark, 1.3, 0.3, 0.2),
      isCharacterUnit && fxBuilder.particles.use(VFX_EMITTERS.crescent).tint(VFX_COLORS.warm, VFX_COLORS.sparkDeep).spawn(coordX, UnitHeightValue, coordY, 0, 0, 0, 0.12, 0.8, 1.5),
      readBuffIcons(fxBuilder, hitEvent, coordX, UnitHeightValue, coordY))
  },
  playMagicHitFx = /**
 * 播放特效与碰撞。
 *
 * @param fxBuilder - 主要输入
 * @param hitEvent - 次要输入
 */
(fxBuilder, hitEvent) => {
    const xValue = hitEvent.pos.x,
      yValue = hitEvent.pos.y,
      getUnitHeightUnitHeightValue = getUnitHeight(fxBuilder, hitEvent.targetId, 0.5, 1),
      isUnitTarget = fxBuilder.a.unit !== null && (fxBuilder.a.unit.kind === "hero" || fxBuilder.a.unit.kind === "monster")
    ;(computeFacingDirection(fxBuilder, hitEvent, xValue, yValue, facingScratch),
      emitHitSparks(fxBuilder, xValue, getUnitHeightUnitHeightValue, yValue, isUnitTarget ? 1.25 : 0.9, VFX_COLORS.magic, VFX_COLORS.magicDeep, facingScratch.x, facingScratch.z, isUnitTarget ? 5 : 3, HIT_FEEDBACK_TUNING.flashBasic, 7),
      emitGroundImpact(fxBuilder, xValue, yValue, isUnitTarget ? 1.05 : 0.75, 0.24, VFX_COLORS.magic, 1.3, 0.3, 0.2),
      emitGlint(fxBuilder, xValue, getUnitHeightUnitHeightValue, yValue, isUnitTarget ? 4 : 2, 3, VFX_COLORS.magic, VFX_COLORS.magicDeep, 0.35, 0.28),
      readBuffIcons(fxBuilder, hitEvent, xValue, getUnitHeightUnitHeightValue, yValue))
  },
  playCritHitFx = /**
 * 播放特效与碰撞。
 *
 * @param fxBuilder - 主要输入
 * @param hitEvent - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, hitEvent, localPlayer) => {
    const hitX = hitEvent.pos.x,
      hitY = hitEvent.pos.y,
      UnitHeightResult = getUnitHeight(fxBuilder, hitEvent.targetId, 0.5, 1)
    computeFacingDirection(fxBuilder, hitEvent, hitX, hitY, facingScratch)
    const facingX = facingScratch.x === 0 && facingScratch.z === 0 ? 1 : facingScratch.x,
      facingZ = facingScratch.x === 0 && facingScratch.z === 0 ? 0 : facingScratch.z
    ;(emitHitSparks(fxBuilder, hitX, UnitHeightResult, hitY, 2, VFX_COLORS.crit, VFX_COLORS.critDeep, facingX, facingZ, 12, HIT_FEEDBACK_TUNING.flashBig, 12),
      fxBuilder.particles
        .use(VFX_EMITTERS.streak)
        .tint(VFX_COLORS.white, VFX_COLORS.crit)
        .spawn(hitX - facingX * 0.9, UnitHeightResult + 0.7, hitY - facingZ * 0.9, facingX * 26, -16, facingZ * 26, 0.1, 0.42, 0.12),
      fxBuilder.particles.use(VFX_EMITTERS.crescent).tint(VFX_COLORS.crit, VFX_COLORS.critDeep).spawn(hitX, UnitHeightResult, hitY, 0, 0, 0, 0.2, 1.4, 2.8),
      emitGroundImpact(fxBuilder, hitX, hitY, 1.5, 0.3, VFX_COLORS.critDeep, 1.5, 0.2, 0.35),
      readBuffIcons(fxBuilder, hitEvent, hitX, UnitHeightResult, hitY),
      involvesPlayer(hitEvent, localPlayer) && (fxBuilder.shake(HIT_FEEDBACK_TUNING.shakeSkill, hitX, hitY), fxBuilder.light(hitX, hitY, UnitHeightResult, VFX_COLORS.crit, 4, 5, 0.2)))
  },
  playTowerHitFx = /**
 * 播放特效与碰撞与防御塔。
 *
 * @param fxBuilder - 主要输入
 * @param targetUnit - 输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, targetUnit, localPlayer) => {
    const hitX = targetUnit.pos.x,
      hitY = targetUnit.pos.y,
      unitHeight = getUnitHeight(fxBuilder, targetUnit.targetId, 0.45, 1),
      triangleCountForShapeResult = triangleCountForShape(targetUnit.team)
    ;(emitHitSparks(fxBuilder, hitX, unitHeight, hitY, 1.7, triangleCountForShapeResult.hot, triangleCountForShapeResult.glow, 0, 0, 8, HIT_FEEDBACK_TUNING.flashSkill, 8),
      emitShards(fxBuilder, hitX, unitHeight, hitY, 4, 5, 4, triangleCountForShapeResult.hot, triangleCountForShapeResult.glow, 0.2),
      emitGroundImpact(fxBuilder, hitX, hitY, 1.25, 0.3, triangleCountForShapeResult.glow, 1.5, 0.2, 0.3),
      emitRockChips(fxBuilder, hitX, hitY, 4, 3.5, 4, 0.3, VFX_COLORS.rock, VFX_COLORS.dustDark, 0.2),
      emitDustTrail(fxBuilder, hitX, 0.2, hitY, 2, 0.3, 0.9, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.5),
      targetUnit.targetId === localPlayer.playerId && (fxBuilder.shake(0.1, hitX, hitY), fxBuilder.light(hitX, hitY, unitHeight, triangleCountForShapeResult.glow, 5, 5, 0.25)))
  },
  playHealFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param targetUnit - 次要输入
 */
(fxBuilder, targetUnit) => {
    const targetUnitId = targetUnit.unitId ?? -1,
      anchorResult = fxBuilder.anchor(targetUnitId),
      centerX = anchorResult ? fxBuilder.a.x : targetUnit.pos.x,
      centerZ = anchorResult ? fxBuilder.a.z : targetUnit.pos.y,
      centerY = anchorResult ? fxBuilder.a.y : 0,
      effectRadius = anchorResult ? fxBuilder.a.radius : 0.6,
      underResult = fxBuilder.decals
        .add(GROUND_FX_KINDS.glow, centerX, centerZ, 1.5 + effectRadius, 0.8)
        .params(1.4)
        .color(VFX_COLORS.heal, 1)
        .under(VFX_COLORS.black, 0),
      healRingDecal = fxBuilder.decals
        .add(GROUND_FX_KINDS.ring, centerX, centerZ, 1.3 + effectRadius, 0.45)
        .params(0.25, 1)
        .color(VFX_COLORS.healDeep, 1.4)
        .under(VFX_COLORS.shadow, 0.2),
      emitHoopGlowValue = emitHoopGlow(fxBuilder, anchorResult ? 0 : centerX, (anchorResult ? 0 : centerY) + 0.25, anchorResult ? 0 : centerZ, effectRadius + 0.55, effectRadius + 0.25, 2.4, 0.6, VFX_COLORS.heal, 1.5, 0.85)
    anchorResult && (underResult.follow(targetUnitId), healRingDecal.follow(targetUnitId), emitHoopGlowValue.follow(targetUnitId))
    const useResult = fxBuilder.particles.use(VFX_EMITTERS.plus),
      randomSource = fxBuilder.rnd,
      nResult = fxBuilder.n(7)
    for (let index = 0; index < nResult; index++) {
      const spawnAngle = randomSource.next() * FX_TWO_PI,
        spawnRadius = randomSource.range(0.4, effectRadius + 0.5)
      useResult.spawn(centerX + Math.cos(spawnAngle) * spawnRadius, centerY + randomSource.range(0.3, 1.1), centerZ + Math.sin(spawnAngle) * spawnRadius, 0, randomSource.range(1.2, 2), 0, randomSource.range(0.55, 0.8), 0.28, 0.4, randomSource.range(0, 0.2))
    }
    emitGlint(fxBuilder, centerX, centerY + 1, centerZ, 4, 1.6, VFX_COLORS.heal, VFX_COLORS.healDeep, 0.6, 0.26)
  },
  playShieldBreakFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param targetUnit - 次要输入
 */
(fxBuilder, targetUnit) => {
    const hitX = targetUnit.pos.x,
      hitY = targetUnit.pos.y,
      unitHeight = getUnitHeight(fxBuilder, targetUnit.unitId, 0.5, 1.1),
      shieldRadius = (fxBuilder.a.unit ? fxBuilder.a.radius : 0.6) + 0.7
    ;(emitHitSparks(fxBuilder, hitX, unitHeight, hitY, 1.6, VFX_COLORS.frost, VFX_COLORS.frostDeep, 0, 0, 6, HIT_FEEDBACK_TUNING.flashSkill, 6), emitSphereGlow(fxBuilder, hitX, unitHeight, hitY, shieldRadius, shieldRadius * 1.5, 0.22, VFX_COLORS.frost, 1.4, 0.8))
    const hexParticles = fxBuilder.particles.use(VFX_EMITTERS.hex),
      randomSource = fxBuilder.rnd,
      nNResult = fxBuilder.n(8)
    for (let index = 0; index < nNResult; index++) {
      const shardAngle = randomSource.next() * FX_TWO_PI,
        shardRise = randomSource.range(-0.2, 0.9),
        shardSpread = Math.sqrt(1 - shardRise * shardRise * 0.8),
        shardSpeed = randomSource.range(3, 6.5)
      hexParticles.spawn(hitX + Math.cos(shardAngle) * shardSpread * shieldRadius * 0.8, unitHeight + shardRise * shieldRadius * 0.8, hitY + Math.sin(shardAngle) * shardSpread * shieldRadius * 0.8, Math.cos(shardAngle) * shardSpread * shardSpeed, shardRise * shardSpeed + 1.5, Math.sin(shardAngle) * shardSpread * shardSpeed, randomSource.range(0.4, 0.65), 0.36, 0.2)
    }
    emitShards(fxBuilder, hitX, unitHeight, hitY, 6, 6, 4, VFX_COLORS.white, VFX_COLORS.frost, 0.2)
  }

function spawnTwinPillars(fxBuilder, worldX, worldZ, followUnitId, pillarColor, coreColor, pillarHeight) {
  const pillarX = followUnitId >= 0 ? 0 : worldX,
    pillarZ = followUnitId >= 0 ? 0 : worldZ,
    optResult = fxBuilder.glow
      .spawn(FX_SHAPES.pillar, FX_STYLES.pillar, 0.5)
      .at(pillarX, 0.05, pillarZ)
      .scale3(0.75, pillarHeight * 0.6, 0.75, 0.12, pillarHeight, 0.12)
      .color(pillarColor, 1.1, 0.55)
      .fade(0.06, 0.4)
      .opt(0.3, 0.9, 1),
    corePillarGlow = fxBuilder.glow
      .spawn(FX_SHAPES.pillar, FX_STYLES.pillar, 0.42)
      .at(pillarX, 0.05, pillarZ)
      .scale3(0.22, pillarHeight * 0.8, 0.22, 0.05, pillarHeight * 1.1, 0.05)
      .color(coreColor, 1.6, 0.85)
      .fade(0.04, 0.45)
      .opt(0.45, 0.7, 1)
  followUnitId >= 0 && (optResult.follow(followUnitId), corePillarGlow.follow(followUnitId))
}

const playLevelUpFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param leveledUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, leveledUnit, localPlayer) => {
    const unitId = leveledUnit.unitId ?? -1,
      isAnchored = fxBuilder.anchor(unitId),
      centerX = isAnchored ? fxBuilder.a.x : leveledUnit.pos.x,
      centerZ = isAnchored ? fxBuilder.a.z : leveledUnit.pos.y,
      followUnitId = isAnchored ? unitId : -1,
      runeDecal = fxBuilder.decals.add(GROUND_FX_KINDS.rune, centerX, centerZ, 1.6, 0.9).params(5, 1.4).color(VFX_COLORS.gold, 1.5, 0.95).under(VFX_COLORS.shadow, 0.25)
    ;(isAnchored && runeDecal.follow(unitId), spawnTwinPillars(fxBuilder, centerX, centerZ, followUnitId, VFX_COLORS.gold, VFX_COLORS.goldHot, 6.5))
    for (let index = 0; index < 2; index++) {
      const delayResult = emitHoopGlow(fxBuilder, isAnchored ? 0 : centerX, 0.2, isAnchored ? 0 : centerZ, 0.95 - index * 0.12, 0.6, 3.6, 0.55, VFX_COLORS.goldHot, 1.5, 0.85).delay(index * 0.12)
      isAnchored && delayResult.follow(unitId)
    }
    const tintResult = fxBuilder.particles.use(VFX_EMITTERS.star).tint(VFX_COLORS.goldHot, VFX_COLORS.gold),
      randomSource = fxBuilder.rnd,
      starCount = fxBuilder.n(9)
    for (let starIndex = 0; starIndex < starCount; starIndex++) tintResult.orbit(centerX, randomSource.range(0.1, 0.6), centerZ, randomSource.range(0.6, 1), randomSource.range(0.25, 0.6), randomSource.next() * FX_TWO_PI, randomSource.range(2, 5), randomSource.range(2.2, 3.8), randomSource.range(0.6, 0.9), 0.26, 0.1, randomSource.range(0, 0.25))
    fxBuilder.light(centerX, centerZ, 2, VFX_COLORS.gold, unitId === localPlayer.playerId ? 6 : 3.5, 6, HIT_FEEDBACK_TUNING.lightDur)
  },
  playRespawnFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param respawnUnit - 输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, respawnUnit, localPlayer) => {
    const respawnX = respawnUnit.pos.x,
      respawnZ = respawnUnit.pos.y,
      isLocalPlayer = respawnUnit.unitId === localPlayer.playerId,
      teamPalette = triangleCountForShape(respawnUnit.team),
      teamGlowColor = isLocalPlayer ? VFX_COLORS.green : teamPalette.glow
    ;(spawnTwinPillars(fxBuilder, respawnX, respawnZ, -1, teamGlowColor, teamPalette.hot, 9), fxBuilder.decals.add(GROUND_FX_KINDS.rune, respawnX, respawnZ, 1.6, 1.1).params(6, -0.9).color(teamGlowColor, 1.5, 0.95).under(VFX_COLORS.shadow, 0.25), emitGroundImpact(fxBuilder, respawnX, respawnZ, 2.2, 0.45, teamGlowColor, 1.4, 0.15, 0.25))
    const streakParticles = fxBuilder.particles.use(VFX_EMITTERS.streak).tint(teamPalette.hot, teamGlowColor),
      randomSource = fxBuilder.rnd,
      streakCount = fxBuilder.n(10)
    for (let index = 0; index < streakCount; index++) {
      const spawnAngle = randomSource.next() * FX_TWO_PI,
        spawnRadius = randomSource.range(0.2, 0.9)
      streakParticles.spawn(respawnX + Math.cos(spawnAngle) * spawnRadius, randomSource.range(5, 8), respawnZ + Math.sin(spawnAngle) * spawnRadius, 0, -randomSource.range(10, 14), 0, randomSource.range(0.35, 0.5), 0.12, 0.06, randomSource.range(0, 0.3))
    }
    ;(emitGlint(fxBuilder, respawnX, 1.2, respawnZ, 7, 2.6, VFX_COLORS.white, teamGlowColor, 0.7, 0.3), fxBuilder.light(respawnX, respawnZ, 2.5, teamGlowColor, isLocalPlayer ? 6 : 4, 7, HIT_FEEDBACK_TUNING.lightDur), isLocalPlayer && fxBuilder.shake(0.1, respawnX, respawnZ))
  },
  playRecallStartFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param recallUnit - 次要输入
 */
(fxBuilder, recallUnit) => {
    const recallX = recallUnit.pos.x,
      recallZ = recallUnit.pos.y
    emitGroundImpact(fxBuilder, recallX, recallZ, 1.5, 0.35, VFX_COLORS.blue, 1.4, 1, 0.2)
    const glintParticles = fxBuilder.particles.use(VFX_EMITTERS.glint).tint(VFX_COLORS.white, VFX_COLORS.blue),
      randomSource = fxBuilder.rnd,
      glintCount = fxBuilder.n(8)
    for (let index = 0; index < glintCount; index++) glintParticles.orbit(recallX, randomSource.range(0.1, 0.4), recallZ, randomSource.range(1.2, 1.6), 0.45, randomSource.next() * FX_TWO_PI, randomSource.range(4, 7), randomSource.range(1, 2.2), randomSource.range(0.45, 0.7), 0.26, 0.1, randomSource.range(0, 0.15))
  },
  playRecallDoneFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param recallUnit - 次要输入
 */
(fxBuilder, recallUnit) => {
    const recallX = recallUnit.pos.x,
      recallZ = recallUnit.pos.y
    ;(spawnTwinPillars(fxBuilder, recallX, recallZ, -1, VFX_COLORS.blue, VFX_COLORS.frost, 8),
      fxBuilder.decals.add(GROUND_FX_KINDS.star, recallX, recallZ, 1.5, 0.55).params(6, 2.6).color(VFX_COLORS.frost, 1.5, 0.95).under(VFX_COLORS.shadow, 0.2),
      emitGroundImpact(fxBuilder, recallX, recallZ, 2, 0.4, VFX_COLORS.blue, 1.4, 0.15, 0.2),
      emitGlint(fxBuilder, recallX, 1.2, recallZ, 9, 3.6, VFX_COLORS.white, VFX_COLORS.blue, 0.6, 0.3),
      fxBuilder.light(recallX, recallZ, 2, VFX_COLORS.blue, 5, 6, HIT_FEEDBACK_TUNING.lightDur))
  },
  playFlashFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param flashEvent - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, flashEvent, localPlayer) => {
    const flashFrom = flashEvent.from ?? flashEvent.pos,
      flashTo = flashEvent.to ?? flashEvent.pos
    let flashDirX = flashTo.x - flashFrom.x,
      flashDirY = flashTo.y - flashFrom.y
    const distance = Math.hypot(flashDirX, flashDirY) || 1
    ;((flashDirX /= distance), (flashDirY /= distance))
    const flashHeight = 1.1
    ;(emitHitSparks(fxBuilder, flashFrom.x, flashHeight, flashFrom.y, 1.5, VFX_COLORS.goldHot, VFX_COLORS.gold, -flashDirX, -flashDirY, 4, HIT_FEEDBACK_TUNING.flashSkill, 5), fxBuilder.decals.add(GROUND_FX_KINDS.ring, flashFrom.x, flashFrom.y, 1.3, 0.3).params(1, 0.15).color(VFX_COLORS.gold, 1.4).under(VFX_COLORS.shadow, 0.2))
    const streakParticles = fxBuilder.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, VFX_COLORS.gold),
      randomSource = fxBuilder.rnd,
      streakCount = fxBuilder.n(8)
    for (let index = 0; index < streakCount; index++) {
      const streakSpeed = randomSource.range(10, 22)
      streakParticles.spawn(flashFrom.x + randomSource.signed() * 0.45, flashHeight + randomSource.signed() * 0.6, flashFrom.y + randomSource.signed() * 0.45, flashDirX * streakSpeed + randomSource.signed() * 1.5, randomSource.signed() * 1.2, flashDirY * streakSpeed + randomSource.signed() * 1.5, randomSource.range(0.12, 0.22), 0.14, 0.05)
    }
    ;(fxBuilder.ribbons.trace(VFX_RIBBON_STYLES.energy, flashFrom.x, flashHeight, flashFrom.y, flashTo.x, flashHeight, flashTo.y, 0.07, VFX_COLORS.goldHot, VFX_COLORS.gold),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.streak, (flashFrom.x + flashTo.x) / 2, (flashFrom.y + flashTo.y) / 2, distance / 2, 0.28)
        .rot(Math.atan2(flashDirY, flashDirX), 0.45 / distance)
        .params(0, 9)
        .color(VFX_COLORS.gold, 1.3)
        .under(VFX_COLORS.black, 0),
      fxBuilder.after(0.06, () => {
        ;(emitHitSparks(fxBuilder, flashTo.x, flashHeight, flashTo.y, 1.9, VFX_COLORS.goldHot, VFX_COLORS.gold, flashDirX, flashDirY, 6, HIT_FEEDBACK_TUNING.flashSkill, 6),
          emitGroundImpact(fxBuilder, flashTo.x, flashTo.y, 1.6, 0.32, VFX_COLORS.gold, 1.5, 0.15, 0.25),
          emitGlint(fxBuilder, flashTo.x, flashHeight, flashTo.y, 6, 3.6, VFX_COLORS.white, VFX_COLORS.gold, 0.45, 0.28),
          fxBuilder.light(flashTo.x, flashTo.y, 1.5, VFX_COLORS.gold, 4, 6, 0.25))
      }),
      flashEvent.unitId === localPlayer.playerId && fxBuilder.shake(0.08, flashTo.x, flashTo.y))
  },
  playGoldGainFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param goldEvent - 次要输入
 */
(fxBuilder, goldEvent) => {
    const gainX = goldEvent.pos.x,
      gainZ = goldEvent.pos.y,
      goldAmount = goldEvent.value ?? 30,
      randomSource = fxBuilder.rnd,
      particlePool = fxBuilder.particles
    emitFlashBurst(fxBuilder, gainX, 0.8, gainZ, 0.8, VFX_COLORS.gold, 0.12)
    const coinCount = Math.min(8, Math.max(3, Math.round(2 + goldAmount / 24))),
      isAnchored = fxBuilder.anchor(goldEvent.unitId),
      coinTargetX = isAnchored ? fxBuilder.a.x : gainX,
      coinTargetZ = isAnchored ? fxBuilder.a.z : gainZ,
      coinTargetY = isAnchored ? fxBuilder.a.y + fxBuilder.a.height * 0.5 : 0.3,
      coinGravity = VFX_EMITTERS.coin.gravity
    particlePool.use(VFX_EMITTERS.coin)
    for (let index = 0; index < coinCount; index++) {
      const coinSpawnX = gainX + randomSource.signed() * 0.4,
        coinSpawnZ = gainZ + randomSource.signed() * 0.4,
        coinSpawnY = 0.6 + randomSource.next() * 0.5,
        flightTime = (isAnchored ? 0.5 : 0.6) + index * 0.035 + randomSource.next() * 0.08,
        targetOffsetX = isAnchored ? 0 : randomSource.signed() * 1.4,
        targetOffsetZ = isAnchored ? 0 : randomSource.signed() * 1.4
      particlePool.spawn(coinSpawnX, coinSpawnY, coinSpawnZ, (coinTargetX + targetOffsetX - coinSpawnX) / flightTime, (coinTargetY - coinSpawnY) / flightTime + 0.5 * coinGravity * flightTime, (coinTargetZ + targetOffsetZ - coinSpawnZ) / flightTime, flightTime, 0.3, 0.24, index * 0.025)
    }
    if (isAnchored) {
      particlePool.use(VFX_EMITTERS.glint).tint(VFX_COLORS.goldHot, VFX_COLORS.gold)
      for (let glintIndex = 0; glintIndex < 2; glintIndex++) particlePool.spawn(coinTargetX + randomSource.signed() * 0.3, coinTargetY + randomSource.signed() * 0.3, coinTargetZ + randomSource.signed() * 0.3, randomSource.signed(), 1 + randomSource.next(), randomSource.signed(), 0.35, 0.36, 0.1, 0.5 + glintIndex * 0.07)
    }
  }

function emitImpactDebris(fxBuilder, impactX, impactY, impactZ, hotColor, glowColor, blastScale) {
  ;(emitFlashBurst(fxBuilder, impactX, impactY, impactZ, 1.6 * blastScale, hotColor, 0.14, !0), emitSparkBurst(fxBuilder, impactX, impactY, impactZ, 6, 8, hotColor, glowColor, 0, 0, 0, 0.4, 0.14), emitRockChips(fxBuilder, impactX, impactZ, 4, 4, 7, 0.4, VFX_COLORS.rock, VFX_COLORS.dustDark, 0.26), emitDustTrail(fxBuilder, impactX, impactY, impactZ, 3, 0.6, 1.5 * blastScale, VFX_COLORS.smoke, VFX_COLORS.smokeDark, 1))
}

function emitRingDebris(fxBuilder, impactX, impactZ, debrisCount, barrageDepth, barrageHeight, hotColor, glowColor) {
  ;(emitRockBarrage(fxBuilder, impactX, impactZ, Math.round(debrisCount * 0.35), barrageHeight, barrageDepth, 0.5), emitRockChips(fxBuilder, impactX, impactZ, debrisCount, barrageHeight * 1.2, barrageDepth * 1.1, 1.1, VFX_COLORS.rock, VFX_COLORS.dustDark, 0.34), emitShards(fxBuilder, impactX, 2.5, impactZ, Math.round(debrisCount * 0.6), barrageHeight, barrageDepth * 0.9, hotColor, glowColor, 0.3))
}

const playTowerDestroyedFx = /**
 * 播放特效与防御塔。
 *
 * @param fxBuilder - 特效构建器
 * @param towerUnit - 输入
 */
(fxBuilder, towerUnit) => {
    const towerX = towerUnit.pos.x,
      towerZ = towerUnit.pos.y,
      teamPalette = triangleCountForShape(towerUnit.team),
      randomSource = fxBuilder.rnd
    ;(emitFlashBurst(fxBuilder, towerX, 3, towerZ, 4.5, teamPalette.hot, 0.2, !0),
      emitSphereGlow(fxBuilder, towerX, 1.5, towerZ, 1, 5, 0.38, teamPalette.glow, 1.4, 0.7),
      emitPillarGlow(fxBuilder, towerX, towerZ, 1.2, 7, 0.5, teamPalette.glow, 1.3, 0.6),
      emitGroundImpact(fxBuilder, towerX, towerZ, 6.5, 0.6, teamPalette.glow, 1.6, 0.1, 0.4),
      fxBuilder.light(towerX, towerZ, 3.5, teamPalette.glow, HIT_FEEDBACK_TUNING.lightMax, 16, HIT_FEEDBACK_TUNING.lightDur),
      fxBuilder.shake(0.45, towerX, towerZ),
      emitRingDebris(fxBuilder, towerX, towerZ, 26, 12, 7.5, teamPalette.hot, teamPalette.glow),
      emitDustPuff(fxBuilder, towerX, towerZ, 14, 1.4, 6, VFX_COLORS.dust, VFX_COLORS.dustDark, 2.2, 1.5),
      emitDustTrail(fxBuilder, towerX, 0.8, towerZ, 8, 1.8, 2.4, VFX_COLORS.dust, VFX_COLORS.smoke, 1.6),
      fxBuilder.decals.add(GROUND_FX_KINDS.cracks, towerX, towerZ, 4.6, 4).params(0, 0.1).color(teamPalette.glow, 1.3).under(VFX_COLORS.shadow, 0.9),
      emitScorchDecal(fxBuilder, towerX, towerZ, 4.3, 5, teamPalette.glow))
    for (let index = 0; index < 3; index++) {
      const debrisAngle = randomSource.next() * FX_TWO_PI,
        debrisDistance = randomSource.range(0.8, 2.4),
        debrisHeight = randomSource.range(1, 4)
      fxBuilder.after(0.2 + index * 0.22 + randomSource.next() * 0.1, () => emitImpactDebris(fxBuilder, towerX + Math.cos(debrisAngle) * debrisDistance, debrisHeight, towerZ + Math.sin(debrisAngle) * debrisDistance, teamPalette.hot, teamPalette.glow, 0.8))
    }
    const smokeParticles = fxBuilder.particles.use(VFX_EMITTERS.smoke),
      smokeCount = fxBuilder.n(14)
    for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex++)
      smokeParticles.spawn(towerX + randomSource.signed() * 1.3, randomSource.range(0.4, 1.5), towerZ + randomSource.signed() * 1.3, randomSource.signed() * 0.5, randomSource.range(1.6, 3.2), randomSource.signed() * 0.5, randomSource.range(1.3, 2), 1.5, 3.4, 0.2 + randomSource.next() * 2)
    emitEmbers(fxBuilder, towerX, 0.5, towerZ, 18, 2, 1.6, teamPalette.hot, teamPalette.glow, 2, 0.18)
  },
  playCoreDestroyedFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param coreUnit - 输入
 */
(fxBuilder, coreUnit) => {
    const coreX = coreUnit.pos.x,
      coreZ = coreUnit.pos.y,
      teamPalette = triangleCountForShape(coreUnit.team),
      randomSource = fxBuilder.rnd
    ;(fxBuilder.decals.add(GROUND_FX_KINDS.ring, coreX, coreZ, 9, 0.5).params(1, 0.08).color(teamPalette.hot, 1.6).under(VFX_COLORS.shadow, 0.3), emitSphereCoreGlow(fxBuilder, coreX, 4, coreZ, 4.5, 0.6, 0.5, teamPalette.hot, 2).opt(1, 1.2, 3))
    const glintParticles = fxBuilder.particles.use(VFX_EMITTERS.glint).tint(teamPalette.hot, teamPalette.glow),
      glintCount = fxBuilder.n(22)
    for (let index = 0; index < glintCount; index++) glintParticles.orbit(coreX, randomSource.range(1, 6), coreZ, randomSource.range(5, 8), 0.4, randomSource.next() * FX_TWO_PI, randomSource.range(3, 6), randomSource.range(-1, 1), 0.5, 0.45, 0.18, randomSource.range(0, 0.1))
    ;(fxBuilder.light(coreX, coreZ, 4, teamPalette.hot, 6, 12, HIT_FEEDBACK_TUNING.lightDur),
      fxBuilder.shake(0.25, coreX, coreZ),
      fxBuilder.after(0.5, () => {
        ;(emitFlashBurst(fxBuilder, coreX, 4, coreZ, 8, teamPalette.hot, 0.22, !0),
          emitSphereGlow(fxBuilder, coreX, 2, coreZ, 1.5, 10, 0.55, teamPalette.glow, 1.5, 0.7),
          emitPillarGlow(fxBuilder, coreX, coreZ, 1.8, 11, 0.85, teamPalette.glow, 1.4, 0.6),
          emitPillarGlow(fxBuilder, coreX, coreZ, 0.6, 12, 0.6, teamPalette.hot, 1.8, 0.8),
          emitGroundImpact(fxBuilder, coreX, coreZ, 10, 0.7, teamPalette.glow, 1.8, 0.08, 0.45),
          emitGroundImpact(fxBuilder, coreX, coreZ, 14, 0.9, teamPalette.hot, 1.3, 0.15, 0.3, 0.16),
          emitRingDebris(fxBuilder, coreX, coreZ, 40, 15, 10, teamPalette.hot, teamPalette.glow),
          emitDustPuff(fxBuilder, coreX, coreZ, 22, 2.4, 9, VFX_COLORS.dust, VFX_COLORS.dustDark, 3, 1.9),
          fxBuilder.decals.add(GROUND_FX_KINDS.rune, coreX, coreZ, 7.5, 3).params(8, 0.5).color(teamPalette.glow, 1.5).under(VFX_COLORS.shadow, 0.35),
          fxBuilder.decals.add(GROUND_FX_KINDS.cracks, coreX, coreZ, 9, 4).params(0, 0.2).color(teamPalette.glow, 1.5).under(VFX_COLORS.shadow, 0.9),
          emitScorchDecal(fxBuilder, coreX, coreZ, 7.5, 4, teamPalette.glow),
          fxBuilder.light(coreX, coreZ, 5, teamPalette.glow, HIT_FEEDBACK_TUNING.lightMax, 22, HIT_FEEDBACK_TUNING.lightDur),
          fxBuilder.shake(0.5, coreX, coreZ))
        for (let index = 0; index < 7; index++) {
          const debrisAngle = randomSource.next() * FX_TWO_PI,
            debrisDistance = randomSource.range(2, 7),
            debrisHeight = randomSource.range(0.8, 4.5)
          fxBuilder.after(0.2 + index * 0.27 + randomSource.next() * 0.1, () => {
            ;(emitImpactDebris(fxBuilder, coreX + Math.cos(debrisAngle) * debrisDistance, debrisHeight, coreZ + Math.sin(debrisAngle) * debrisDistance, teamPalette.hot, teamPalette.glow, 1.1), emitGroundImpact(fxBuilder, coreX + Math.cos(debrisAngle) * debrisDistance, coreZ + Math.sin(debrisAngle) * debrisDistance, 2.2, 0.35, teamPalette.glow, 1.3, 0.2, 0.2), fxBuilder.shake(0.15, coreX, coreZ))
          })
        }
        const sparkParticles = fxBuilder.particles.use(VFX_EMITTERS.glint).tint(teamPalette.hot, teamPalette.glow),
          sparkCount = fxBuilder.n(36)
        for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex++) {
          const sparkAngle = randomSource.next() * FX_TWO_PI,
            sparkRadius = Math.sqrt(randomSource.next()) * 9
          sparkParticles.spawn(coreX + Math.cos(sparkAngle) * sparkRadius, randomSource.range(5, 11), coreZ + Math.sin(sparkAngle) * sparkRadius, randomSource.signed() * 0.6, -randomSource.range(1.5, 3.5), randomSource.signed() * 0.6, randomSource.range(1.2, 2), 0.38, 0.12, 0.4 + randomSource.next() * 2.4)
        }
        const smokeParticles = fxBuilder.particles.use(VFX_EMITTERS.smoke),
          smokeCount = fxBuilder.n(22)
        for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex++)
          smokeParticles.spawn(coreX + randomSource.signed() * 3, randomSource.range(0.4, 2), coreZ + randomSource.signed() * 3, randomSource.signed() * 0.7, randomSource.range(1.8, 3.6), randomSource.signed() * 0.7, randomSource.range(1.6, 2.4), 2.2, 4.4, 0.3 + randomSource.next() * 2.6)
        emitEmbers(fxBuilder, coreX, 0.6, coreZ, 26, 4, 2.2, teamPalette.hot, teamPalette.glow, 2.4, 0.22)
      }))
  },
  playBuffGainFx = /**
 * 播放状态效果与特效。
 *
 * @param soundBuilder - 音效构建器
 * @param buffEvent - 次要输入
 */
(soundBuilder, buffEvent) => {
    const targetUnitId = buffEvent.unitId ?? -1,
      isAnchored = soundBuilder.anchor(targetUnitId),
      effectX = isAnchored ? soundBuilder.a.x : buffEvent.pos.x,
      effectZ = isAnchored ? soundBuilder.a.z : buffEvent.pos.y,
      buffRadius = isAnchored ? soundBuilder.a.radius : 0.6
    let buffVariant = 2
    const targetUnit = soundBuilder.a.unit
    if (isAnchored && targetUnit) for (const activeBuff of targetUnit.buffs) activeBuff.duration - activeBuff.timeLeft > 0.5 || (activeBuff.id === "frost_insight" ? (buffVariant = 0) : activeBuff.id === "ember_might" && (buffVariant = 1))
    const deepColor = buffVariant === 0 ? VFX_COLORS.frostDeep : buffVariant === 1 ? VFX_COLORS.ember : VFX_COLORS.gold,
      hotColor = buffVariant === 0 ? VFX_COLORS.frostHot : buffVariant === 1 ? VFX_COLORS.emberHot : VFX_COLORS.goldHot,
      playBuffEffect = () => {
        const isTargetAnchored = soundBuilder.anchor(targetUnitId),
          effectCenterX = isTargetAnchored ? soundBuilder.a.x : effectX,
          effectCenterZ = isTargetAnchored ? soundBuilder.a.z : effectZ,
          effectCenterY = isTargetAnchored ? soundBuilder.a.y + soundBuilder.a.height * 0.5 : 1,
          sigilDecal = soundBuilder.decals
            .add(GROUND_FX_KINDS.sigil, effectCenterX, effectCenterZ, buffRadius * (buffVariant === 0 ? 1.6 : buffVariant === 1 ? 1.85 : 2.1) + 0.35, 0.9)
            .params(buffVariant === 2 ? 2 : buffVariant, 0.35)
            .rot(0)
            .color(deepColor, 1.6, 1)
            .under(VFX_COLORS.shadow, 0.3),
          pillarGlow = soundBuilder.glow
            .spawn(FX_SHAPES.pillar, FX_STYLES.pillar, 0.5)
            .at(isTargetAnchored ? 0 : effectCenterX, 0.05, isTargetAnchored ? 0 : effectCenterZ)
            .scale3(0.4, 2.2, 0.4, 0.12, 3, 0.12)
            .color(hotColor, 1.3, 0.75)
            .fade(0.05, 0.4)
            .opt(0.35, 0.8, 1)
        if ((isTargetAnchored && (sigilDecal.follow(targetUnitId), pillarGlow.follow(targetUnitId)), emitHitSparks(soundBuilder, effectCenterX, effectCenterY, effectCenterZ, 1.4, hotColor, deepColor, 0, 0, 5, HIT_FEEDBACK_TUNING.flashSkill, 4), buffVariant === 0)) {
          const frostParticles = soundBuilder.particles.use(VFX_EMITTERS.frost)
          for (let index = 0; index < soundBuilder.n(8); index++) frostParticles.orbit(effectCenterX, 0.2, effectCenterZ, buffRadius + 0.4, buffRadius + 0.9, (index / 8) * FX_TWO_PI, 3, soundBuilder.rnd.range(0.6, 1.6), 0.8, 0.26, 0.12, soundBuilder.rnd.range(0, 0.15))
        } else buffVariant === 1 ? emitEmbers(soundBuilder, effectCenterX, 0.4, effectCenterZ, 10, buffRadius + 0.3, 2, hotColor, deepColor, 0.9, 0.16) : emitGlint(soundBuilder, effectCenterX, effectCenterY, effectCenterZ, 8, 3, VFX_COLORS.white, deepColor, 0.7, 0.3)
        soundBuilder.light(effectCenterX, effectCenterZ, 1.8, deepColor, 4, 6, 0.3)
      },
      findRecentHitEventResult = findRecentHitEvent(soundBuilder, effectX, effectZ, buffVariant === 0 ? "frost_golem" : buffVariant === 1 ? "ember_golem" : null)
    if (findRecentHitEventResult && isAnchored) {
      const heldGlow = soundBuilder.glow.hold(FX_SHAPES.sphere, FX_STYLES.core)
      ;(heldGlow.color(hotColor, 1.6, 0.95), (heldGlow.add = 0.6), (heldGlow.k = 1.6), heldGlow.scale(0.35))
      const hitX = findRecentHitEventResult.x,
        coordZ = findRecentHitEventResult.z,
        hitY = findRecentHitEventResult.y,
        startResult = soundBuilder.ribbons.start(VFX_RIBBON_STYLES.energy, hitX, hitY, coordZ, hotColor, deepColor)
      soundBuilder.track(
        targetUnitId,
        0.6,
        (position, trackProgress) => {
          const easeFactor = trackProgress * trackProgress * (3 - 2 * trackProgress),
            interpolatedX = hitX + (position.x - hitX) * easeFactor,
            interpolatedZ = coordZ + (position.z - coordZ) * easeFactor,
            interpolatedY = hitY + (position.y + position.height * 0.5 - hitY) * easeFactor + Math.sin(trackProgress * Math.PI) * 1.6
          ;(heldGlow.at(interpolatedX, interpolatedY, interpolatedZ), startResult >= 0 && soundBuilder.ribbons.move(startResult, interpolatedX, interpolatedY, interpolatedZ))
        },
        () => {
          ;(soundBuilder.glow.release(heldGlow), soundBuilder.ribbons.end(startResult), playBuffEffect())
        },
      )
    } else playBuffEffect()
  },
  BATTLE_EVENT_VFX = {
    hit_physical: playPhysicalHitFx,
    hit_magic: playMagicHitFx,
    hit_crit: playCritHitFx,
    hit_tower: playTowerHitFx,
    heal: playHealFx,
    shield_break: playShieldBreakFx,
    level_up: playLevelUpFx,
    respawn: playRespawnFx,
    recall_start: playRecallStartFx,
    recall_done: playRecallDoneFx,
    flash: playFlashFx,
    gold_gain: playGoldGainFx,
    tower_destroyed: playTowerDestroyedFx,
    core_destroyed: playCoreDestroyedFx,
    buff_gain: playBuffGainFx,
  }

/**
 * 播放英雄与特效。
 *
 * @param fxBuilder - 特效构建器
 * @param deathX - 次要输入
 * @param deathZ - 第三输入
 * @param unitTeam - 第四输入
 * @param isPlayerInvolved - 附加输入
 */
function playHeroDeathFx(fxBuilder, deathX, deathZ, unitTeam, isPlayerInvolved) {
  const teamPalette = triangleCountForShape(unitTeam)
  ;(emitHitSparks(fxBuilder, deathX, 1.2, deathZ, 2, teamPalette.hot, teamPalette.glow, 0, 0, 6, HIT_FEEDBACK_TUNING.flashBig, 5),
    emitSphereGlow(fxBuilder, deathX, 1.1, deathZ, 0.5, 2.4, 0.3, teamPalette.glow, 1.4, 0.7),
    emitGroundImpact(fxBuilder, deathX, deathZ, 2.6, 0.5, teamPalette.glow, 1.5, 0.1, 0.3),
    emitPillarGlow(fxBuilder, deathX, deathZ, 0.35, 3.8, 0.6, teamPalette.glow, 1.3, 0.6),
    emitShards(fxBuilder, deathX, 1.2, deathZ, 8, 5, 6, teamPalette.hot, teamPalette.glow, 0.24))
  const glintParticles = fxBuilder.particles.use(VFX_EMITTERS.glint).tint(teamPalette.hot, teamPalette.glow),
    randomSource = fxBuilder.rnd,
    glintCount = fxBuilder.n(12)
  for (let index = 0; index < glintCount; index++) glintParticles.orbit(deathX, randomSource.range(0.3, 1.6), deathZ, randomSource.range(0.2, 0.9), randomSource.range(0.05, 0.4), randomSource.next() * FX_TWO_PI, randomSource.range(2, 5), randomSource.range(2, 4.5), randomSource.range(0.9, 1.4), 0.32, 0.1, randomSource.range(0, 0.4))
  ;(emitScorchDecal(fxBuilder, deathX, deathZ, 1.6, 2.5), fxBuilder.light(deathX, deathZ, 1.6, teamPalette.glow, isPlayerInvolved ? 6 : 4, 7, HIT_FEEDBACK_TUNING.lightDur), fxBuilder.shake(isPlayerInvolved ? 0.3 : 0.15, deathX, deathZ))
}

function playMinionDeathFx(fxBuilder, deathX, deathZ, unitTeam) {
  const teamPalette = triangleCountForShape(unitTeam)
  ;(emitFlashBurst(fxBuilder, deathX, 0.7, deathZ, 0.8, teamPalette.hot, 0.1), emitShards(fxBuilder, deathX, 0.7, deathZ, 3, 4, 4, teamPalette.hot, teamPalette.glow, 0.16), emitRockChips(fxBuilder, deathX, deathZ, 3, 2.5, 4, 0.3, VFX_COLORS.rock, VFX_COLORS.dustDark, 0.2), emitDustTrail(fxBuilder, deathX, 0.2, deathZ, 2, 0.3, 0.9, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.55))
}

/**
 * 发送特效。
 *
 * @param fxBuilder - 来源
 * @param slashX - 次要输入
 * @param slashY - 第三输入
 * @param slashZ - 第四输入
 * @param slashAngle - 附加输入
 * @param hotColor - 附加输入
 * @param glowColor - 附加输入
 * @param slashWidth - 附加输入
 * @param slashIndex - 附加输入
 */
function emitMeleeSlashFx(fxBuilder, slashX, slashY, slashZ, slashAngle, hotColor, glowColor, slashWidth, slashIndex) {
  const slashTilt = (slashIndex % 2 === 0 ? 1 : -1) * 0.45,
    emitSlashGlowValue = emitSlashGlow(fxBuilder, slashX, slashY, slashZ, slashAngle, slashWidth, 0.14, hotColor, 2.2, slashTilt, !0, 0.95)
  ;((emitSlashGlowValue.k = 0.7), fxBuilder.particles.use(VFX_EMITTERS.streak).tint(hotColor, glowColor))
  const randomSource = fxBuilder.rnd,
    sparkCount = 2 + (randomSource.next() < 0.5 ? 1 : 0),
    slashSign = slashIndex % 2 === 0 ? 1 : -1
  for (let index = 0; index < sparkCount; index++) {
    const sparkAngle = slashAngle + slashSign * (0.5 - index * 0.45) + randomSource.signed() * 0.12,
      sparkVelocityX = -Math.sin(sparkAngle) * slashSign,
      sparkVelocityZ = Math.cos(sparkAngle) * slashSign
    fxBuilder.particles.spawn(slashX + Math.cos(sparkAngle) * slashWidth * 0.85, slashY + randomSource.signed() * 0.25, slashZ + Math.sin(sparkAngle) * slashWidth * 0.85, sparkVelocityX * 9, randomSource.signed() * 0.6, sparkVelocityZ * 9, 0.12, 0.09, 0.03)
  }
}

const PANYUE_VFX_PALETTE = HERO_VFX_PALETTES.panyue,
  PANYUE_S1_SPEC = HERO_TABLE.panyue.skills.s1,
  PANYUE_ULT_SPEC = HERO_TABLE.panyue.skills.ult

function getUnitFacing(lookupKey, lookupOption, fallbackFacing = 0) {
  return lookupKey.anchor(lookupOption) && lookupKey.a.unit ? lookupKey.a.unit.facing : fallbackFacing
}

function emitRadialSlash(fxBuilder, slashX, slashZ, slashCount, slashRadius, slashWidth, slashHeight, startAngle, slashSpeed = 4, startDelay = 0) {
  for (let index = 0; index < slashCount; index++) {
    const slashAngle = startAngle + (index * FX_TWO_PI) / slashCount,
      slashDirX = Math.cos(slashAngle),
      slashDirZ = Math.sin(slashAngle),
      radialSlash = emitSlashGlow(fxBuilder, slashX + slashDirX * (slashRadius - slashWidth * 0.7), 0.25, slashZ + slashDirZ * (slashRadius - slashWidth * 0.7), slashAngle, slashWidth, slashHeight, index % 2 === 0 ? PANYUE_VFX_PALETTE.hot : PANYUE_VFX_PALETTE.glow, 2, 0, !1, 0.9)
    ;(radialSlash
      .rot(0, -slashAngle, 0.5)
      .vel(slashDirX * slashSpeed, 0.6, slashDirZ * slashSpeed)
      .scale(slashWidth * 0.7, slashWidth * 1.15)
      .fade(0.05, 0.35),
      (radialSlash.k = 0.62),
      startDelay > 0 && radialSlash.delay(startDelay))
  }
}

const playPanyuePassiveFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param hitUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, hitUnit, localPlayer) => {
    const hitX = hitUnit.pos.x,
      hitZ = hitUnit.pos.y
    let facingX = 1,
      facingZ = 0
    if (fxBuilder.anchor(hitUnit.unitId)) {
      const distance = Math.hypot(hitX - fxBuilder.a.x, hitZ - fxBuilder.a.z) || 1
      ;((facingX = (hitX - fxBuilder.a.x) / distance), (facingZ = (hitZ - fxBuilder.a.z) / distance))
    }
    const facingAngle = Math.atan2(facingZ, facingX)
    ;(fxBuilder.decals.add(GROUND_FX_KINDS.cracks, hitX, hitZ, 1.5, 1.1).params(0, 0.2).color(PANYUE_VFX_PALETTE.glow, 1.5).under(VFX_COLORS.shadow, 0.8),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.shieldMark, hitX - facingX * 0.25, hitZ - facingZ * 0.25, 1.15, 0.7)
        .rot(facingAngle, 0.72)
        .params(0.6, 0.3)
        .color(PANYUE_VFX_PALETTE.hot, 1.8)
        .under(VFX_COLORS.shadow, 0.6))
    const emitSlashGlowResult = emitSlashGlow(fxBuilder, hitX - facingX * 1.15, 0.18, hitZ - facingZ * 1.15, facingAngle, 1.9, 0.2, PANYUE_VFX_PALETTE.hot, 2.3, 0, !1)
    ;((emitSlashGlowResult.scale(1.3, 2.1).k = 0.55),
      emitGroundImpact(fxBuilder, hitX, hitZ, 1.9, 0.28, PANYUE_VFX_PALETTE.glow, 1.4, 0.3, 0.25),
      emitHitSparks(fxBuilder, hitX, 0.5, hitZ, 1.3, PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.deep, facingX, facingZ, 6, HIT_FEEDBACK_TUNING.flashSkill, 8),
      emitSparkBurst(fxBuilder, hitX, 0.3, hitZ, 5, 6, VFX_COLORS.bronze, PANYUE_VFX_PALETTE.deep, facingX, facingZ, 0.4, 0.3, 0.11),
      emitDustPuff(fxBuilder, hitX, hitZ, 5, 0.4, 3, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.9, 0.5),
      emitEarthChunks(fxBuilder, hitX, hitZ, 4, 3.5, 5, 0.3, 0.22),
      fxBuilder.shake(involvesPlayer(hitUnit, localPlayer) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.06, hitX, hitZ),
      fxBuilder.light(hitX, hitZ, 1, PANYUE_VFX_PALETTE.glow, 4, 5, 0.25))
  },
  playPanyueDashFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param dashUnit - 次要输入
 */
(fxBuilder, dashUnit) => {
    const dashX = dashUnit.pos.x,
      dashZ = dashUnit.pos.y,
      dashDirX = dashUnit.dir?.x ?? 1,
      dashDirZ = dashUnit.dir?.y ?? 0,
      atan2Atan2Result = Math.atan2(dashDirZ, dashDirX),
      SkillRangeValue = getSkillRange(PANYUE_S1_SPEC),
      dashDuration = SkillRangeValue / getFirstValue(PANYUE_S1_SPEC, "dashSpeed"),
      randomSource = fxBuilder.rnd,
      dustParticles = fxBuilder.particles.use(VFX_EMITTERS.dust),
      dustCount = fxBuilder.n(7)
    for (let index = 0; index < dustCount; index++) {
      const dustSpeed = randomSource.range(3, 7)
      dustParticles.spawn(dashX + randomSource.signed() * 0.5, randomSource.range(0.1, 0.6), dashZ + randomSource.signed() * 0.5, -dashDirX * dustSpeed + randomSource.signed() * 1.5, randomSource.range(0.5, 2), -dashDirZ * dustSpeed + randomSource.signed() * 1.5, randomSource.range(0.5, 0.9), 0.7, 1.6)
    }
    ;(emitEarthChunks(fxBuilder, dashX, dashZ, 4, 3.5, 4.5, 0.4, 0.24),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.streak, dashX + dashDirX * SkillRangeValue * 0.5, dashZ + dashDirZ * SkillRangeValue * 0.5, SkillRangeValue * 0.5, 0.55)
        .rot(atan2Atan2Result, (getSkillWidth(PANYUE_S1_SPEC) * 0.5) / (SkillRangeValue * 0.5))
        .params(0.5, 1 / (dashDuration / 0.55))
        .color(PANYUE_VFX_PALETTE.glow, 1.2, 0.8)
        .under(PANYUE_VFX_PALETTE.dark, 0.4))
    const followUnitId = dashUnit.unitId ?? -1
    if (!fxBuilder.anchor(followUnitId)) return
    ;(fxBuilder.trail(followUnitId, VFX_RIBBON_STYLES.dust, dashDuration + 0.05, 0.5),
      fxBuilder.trail(followUnitId, VFX_RIBBON_STYLES.energy, dashDuration + 0.05, 1.2, PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.deep),
      emitShieldGlow(fxBuilder, dashDirX * 0.95, 0.05, dashDirZ * 0.95, atan2Atan2Result, 2.5, dashDuration + 0.1, PANYUE_VFX_PALETTE.hot, 1.9, 0.95, 0.2, 0.44, 0.1)
        .follow(followUnitId)
        .fade(0.12, 0.75))
    for (let slashIndex = 0; slashIndex < 2; slashIndex++) {
      const followResult = emitSlashGlow(fxBuilder, dashDirX * (0.55 - slashIndex * 0.35), 1.3 - slashIndex * 0.9, dashDirZ * (0.55 - slashIndex * 0.35), atan2Atan2Result, 1.9 + slashIndex * 0.5, dashDuration + 0.1, slashIndex === 0 ? PANYUE_VFX_PALETTE.hot : PANYUE_VFX_PALETTE.glow, slashIndex === 0 ? 2.2 : 1.5, 0, !1, 0.95).follow(followUnitId)
      followResult.scale(1.4 + slashIndex * 0.4, 1.9 + slashIndex * 0.5).fade(0.15, 0.7).k = 0.66
    }
    let total = 0
    fxBuilder.track(followUnitId, dashDuration, (trailPosition, trackProgress, trackDelta) => {
      for (total += trackDelta; total > 0.04;) {
        ;((total -= 0.04), fxBuilder.particles.use(VFX_EMITTERS.dust).spawn(trailPosition.x + randomSource.signed() * 0.5, 0.25, trailPosition.z + randomSource.signed() * 0.5, -dashDirX * 2 + randomSource.signed(), randomSource.range(0.4, 1.4), -dashDirZ * 2 + randomSource.signed(), randomSource.range(0.4, 0.7), 0.7, 1.5))
        const streakSide = randomSource.chance(0.5) ? 1 : -1
        fxBuilder.particles
          .use(VFX_EMITTERS.streak)
          .tint(PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.glow)
          .spawn(trailPosition.x + dashDirX * 0.9 - dashDirZ * streakSide * 0.7, randomSource.range(0.4, 2), trailPosition.z + dashDirZ * 0.9 + dashDirX * streakSide * 0.7, -dashDirX * 9 - dashDirZ * streakSide * 2, randomSource.signed() * 0.5, -dashDirZ * 9 + dashDirX * streakSide * 2, 0.16, 0.1, 0.03)
      }
    })
  },
  playPanyueS1ImpactFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param impactUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, impactUnit, localPlayer) => {
    const impactX = impactUnit.pos.x,
      impactZ = impactUnit.pos.y,
      impactRadius = impactUnit.radius ?? getFirstValue(PANYUE_S1_SPEC, "impactRadius"),
      randomSource = fxBuilder.rnd,
      UnitFacingValue = getUnitFacing(fxBuilder, impactUnit.unitId, randomSource.next() * FX_TWO_PI),
      impactDirX = Math.cos(UnitFacingValue),
      impactDirZ = Math.sin(UnitFacingValue)
    ;(emitHitSparks(fxBuilder, impactX + impactDirX * 0.9, 1, impactZ + impactDirZ * 0.9, 2.2, PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.deep, impactDirX, impactDirZ, 8, HIT_FEEDBACK_TUNING.flashSkill, 10),
      emitShieldGlow(fxBuilder, impactX + impactDirX * 1, 0.05, impactZ + impactDirZ * 1, UnitFacingValue, 2.9, 0.26, PANYUE_VFX_PALETTE.hot, 2.3, 1, 0.3, 0, 0.06)
        .vel(impactDirX * 2.5, 0, impactDirZ * 2.5)
        .fade(0.04, 0.3))
    const impactSlash = emitSlashGlow(fxBuilder, impactX - impactDirX * 0.3, 1, impactZ - impactDirZ * 0.3, UnitFacingValue, impactRadius * 0.95, 0.26, PANYUE_VFX_PALETTE.hot, 2.3, 0, !1)
    ;((impactSlash
      .scale(impactRadius * 0.55, impactRadius * 0.98)
      .vel(impactDirX * 3, 0, impactDirZ * 3)
      .fade(0.04, 0.35).k = 0.7),
      emitGroundImpact(fxBuilder, impactX, impactZ, impactRadius, 0.4, PANYUE_VFX_PALETTE.glow, 1.9, 0.15, 0.4),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.cracks, impactX, impactZ, impactRadius * 0.95, 1.4)
        .params(0, 0.25)
        .color(PANYUE_VFX_PALETTE.glow, 1.7)
        .under(VFX_COLORS.shadow, 0.85),
      emitRadialSlash(fxBuilder, impactX, impactZ, 4, impactRadius * 0.72, 1.25, 0.3, UnitFacingValue + Math.PI / 4, 5),
      emitDustPuff(fxBuilder, impactX, impactZ, 10, impactRadius * 0.5, 5, VFX_COLORS.dust, VFX_COLORS.dustDark, 1.4, 0.85),
      emitEarthChunks(fxBuilder, impactX, impactZ, 10, 5.5, 7.5, impactRadius * 0.4),
      emitSparkBurst(fxBuilder, impactX + impactDirX * 0.9, 0.8, impactZ + impactDirZ * 0.9, 6, 8, VFX_COLORS.bronze, PANYUE_VFX_PALETTE.deep, impactDirX, impactDirZ, 0.5, 0.3, 0.12),
      fxBuilder.light(impactX, impactZ, 1.5, PANYUE_VFX_PALETTE.glow, HIT_FEEDBACK_TUNING.lightMax, 8, 0.35),
      fxBuilder.shake(involvesPlayer(impactUnit, localPlayer) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.07, impactX, impactZ))
  },
  playPanyueS2Fx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param castUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, castUnit, localPlayer) => {
    const castX = castUnit.pos.x,
      castZ = castUnit.pos.y,
      castRadius = castUnit.radius ?? 4.5,
      randomSource = fxBuilder.rnd,
      targetUnitId = castUnit.unitId ?? -1,
      isAnchored = fxBuilder.anchor(targetUnitId),
      castHeight = isAnchored ? fxBuilder.a.height : 2.4,
      getUnitFacingUnitFacingValue = getUnitFacing(fxBuilder, targetUnitId, 0)
    for (let index = 0; index < 5; index++) {
      const shieldAngle = getUnitFacingUnitFacingValue + (index * FX_TWO_PI) / 5,
        delayedShieldGlow = emitShieldGlow(fxBuilder, (isAnchored ? 0 : castX) + Math.cos(shieldAngle) * 1.3, 0.05, (isAnchored ? 0 : castZ) + Math.sin(shieldAngle) * 1.3, shieldAngle, 2.3, 0.5, index === 0 ? PANYUE_VFX_PALETTE.hot : PANYUE_VFX_PALETTE.accent, 1.8, 0.9, 0.18).delay(index * 0.015)
      ;(delayedShieldGlow.vel(Math.cos(shieldAngle) * 0.9, 0, Math.sin(shieldAngle) * 0.9), isAnchored && delayedShieldGlow.follow(targetUnitId))
    }
    ;(emitGroundImpact(fxBuilder, castX, castZ, castRadius, 0.48, PANYUE_VFX_PALETTE.glow, 1.8, 0.25, 0.4), emitGroundImpact(fxBuilder, castX, castZ, castRadius, 0.52, PANYUE_VFX_PALETTE.hot, 1, 0.1, 0.2, 0.12))
    const streakParticles = fxBuilder.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, PANYUE_VFX_PALETTE.hot),
      streakCount = fxBuilder.n(6)
    for (let streakIndex = 0; streakIndex < streakCount; streakIndex++) {
      const spawnAngle = randomSource.next() * FX_TWO_PI,
        spawnRadius = randomSource.range(0.15, 0.55)
      streakParticles.spawn(castX + Math.cos(spawnAngle) * spawnRadius, castHeight * 0.92 + randomSource.range(0, 0.3), castZ + Math.sin(spawnAngle) * spawnRadius, Math.cos(spawnAngle) * 1.6, randomSource.range(6, 10), Math.sin(spawnAngle) * 1.6, randomSource.range(0.18, 0.26), 0.13, 0.04, randomSource.next() * 0.06)
    }
    ;(fxBuilder.particles
      .use(VFX_EMITTERS.hitFlash)
      .tint(VFX_COLORS.white, PANYUE_VFX_PALETTE.hot)
      .spawn(castX, castHeight * 0.6, castZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 1.2, 2),
      emitDustPuff(fxBuilder, castX, castZ, 10, 1.2, 4.2, VFX_COLORS.dust, VFX_COLORS.dustDark, 1.2, 0.75),
      emitEarthChunks(fxBuilder, castX, castZ, 5, 4, 5.5, 1.1, 0.24),
      fxBuilder.light(castX, castZ, 1.6, PANYUE_VFX_PALETTE.glow, 6, 8, 0.35),
      fxBuilder.shake(involvesPlayer(castUnit, localPlayer) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.06, castX, castZ))
  },
  playPanyueUltLeapFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 特效构建器
 * @param leapUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, leapUnit, localPlayer) => {
    const leapOrigin = leapUnit.from ?? leapUnit.pos,
      leapX = leapOrigin.x,
      leapZ = leapOrigin.y,
      followUnitId = leapUnit.unitId ?? -1,
      FirstValueValue = getFirstValue(PANYUE_ULT_SPEC, "leapTime")
    ;(fxBuilder.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, PANYUE_VFX_PALETTE.hot).spawn(leapX, 0.5, leapZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 1.2, 1.9),
      emitGroundImpact(fxBuilder, leapX, leapZ, 2.5, 0.36, PANYUE_VFX_PALETTE.glow, 1.5, 0.15, 0.35),
      fxBuilder.decals.add(GROUND_FX_KINDS.cracks, leapX, leapZ, 2, 1.1).params(0, 0.15).color(PANYUE_VFX_PALETTE.glow, 1.5).under(VFX_COLORS.shadow, 0.85),
      emitDustPuff(fxBuilder, leapX, leapZ, 11, 0.5, 5.2, VFX_COLORS.dust, VFX_COLORS.dustDark, 1.4, 0.85),
      emitEarthChunks(fxBuilder, leapX, leapZ, 6, 4.5, 8, 0.5),
      emitRockBarrage(fxBuilder, leapX, leapZ, 2, 3.5, 6.5, 0.28),
      fxBuilder.anchor(followUnitId) && (fxBuilder.trail(followUnitId, VFX_RIBBON_STYLES.energy, FirstValueValue, 1.3, PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.deep), fxBuilder.trail(followUnitId, VFX_RIBBON_STYLES.dust, FirstValueValue * 0.55, 0.4)),
      fxBuilder.shake(leapUnit.unitId === localPlayer.playerId ? 0.15 : 0.08, leapX, leapZ))
  },
  playPanyueUltLandFx = /**
 * 播放特效。
 *
 * @param fxBuilder - 主要输入
 * @param landUnit - 次要输入
 * @param localPlayer - 第三输入
 */
(fxBuilder, landUnit, localPlayer) => {
    const landX = landUnit.pos.x,
      landZ = landUnit.pos.y,
      landRadius = landUnit.radius ?? 4.5,
      randomSource = fxBuilder.rnd,
      UnitFacingResult = getUnitFacing(fxBuilder, landUnit.unitId, randomSource.next() * FX_TWO_PI)
    ;(fxBuilder.particles
      .use(VFX_EMITTERS.hitFlash)
      .tint(PANYUE_VFX_PALETTE.hot, PANYUE_VFX_PALETTE.glow)
      .spawn(landX, 0.8, landZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBig, landRadius * 0.4, landRadius * 0.7),
      fxBuilder.particles
        .use(VFX_EMITTERS.burst)
        .tint(PANYUE_VFX_PALETTE.hot)
        .spawn(landX, 0.8, landZ, 0, 0, 0, 0.18, landRadius * 0.5, landRadius * 1.1),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.shieldMark, landX, landZ, landRadius * 0.6, 1.9)
        .rot(UnitFacingResult, 0.72)
        .params(1, 0.55)
        .color(PANYUE_VFX_PALETTE.hot, 2)
        .under(VFX_COLORS.shadow, 0.85),
      emitGroundImpact(fxBuilder, landX, landZ, landRadius * 0.5, 0.34, PANYUE_VFX_PALETTE.hot, 1.7, 0.15, 0.3),
      emitGroundImpact(fxBuilder, landX, landZ, landRadius * 0.78, 0.42, PANYUE_VFX_PALETTE.glow, 1.8, 0.2, 0.35, 0.06),
      emitGroundImpact(fxBuilder, landX, landZ, landRadius, 0.5, PANYUE_VFX_PALETTE.glow, 2.1, 0.3, 0.45, 0.12),
      emitRadialSlash(fxBuilder, landX, landZ, 6, landRadius * 0.55, 1.7, 0.34, randomSource.next() * FX_TWO_PI, 7),
      emitRadialSlash(fxBuilder, landX, landZ, 6, landRadius * 0.9, 1.5, 0.3, randomSource.next() * FX_TWO_PI, 5, 0.1),
      fxBuilder.decals
        .add(GROUND_FX_KINDS.cracks, landX, landZ, landRadius * 1.04, getFirstValue(PANYUE_ULT_SPEC, "zoneDur") + 0.4)
        .params(0, 0.1)
        .color(PANYUE_VFX_PALETTE.glow, 1.25)
        .under(VFX_COLORS.shadow, 0.9),
      emitRockBarrage(fxBuilder, landX, landZ, 4, 7, 9.5, 0.42),
      emitEarthChunks(fxBuilder, landX, landZ, 22, 8.5, 11, landRadius * 0.5, 0.34),
      emitDustPuff(fxBuilder, landX, landZ, 16, landRadius * 0.55, 6.5, VFX_COLORS.dust, VFX_COLORS.dustDark, 2.1, 1.2),
      emitDustTrail(fxBuilder, landX, 0.5, landZ, 6, landRadius * 0.35, 2, VFX_COLORS.dust, VFX_COLORS.dustDark, 1),
      emitSparkBurst(fxBuilder, landX, 0.5, landZ, 8, 9, VFX_COLORS.bronze, PANYUE_VFX_PALETTE.deep, 0, 0, 0, 0.4, 0.14),
      fxBuilder.light(landX, landZ, 2.2, PANYUE_VFX_PALETTE.glow, HIT_FEEDBACK_TUNING.lightMax, 14, 0.35),
      fxBuilder.shake(involvesPlayer(landUnit, localPlayer) ? 0.45 : 0.3, landX, landZ))
  },
  PANYUE_SKILL_VFX = { panyue_passive_hit: playPanyuePassiveFx, panyue_s1_dash: playPanyueDashFx, panyue_s1_impact: playPanyueS1ImpactFx, panyue_s2_cast: playPanyueS2Fx, panyue_ult_leap: playPanyueUltLeapFx, panyue_ult_land: playPanyueUltLandFx },
  XINGLI_VFX_PALETTE = HERO_VFX_PALETTES.xingli,
  XINGLI_MOTE_SPAWN = { x: 2.3, y: 7.6, z: -1.7, time: 0.11 }

function emitMoteBurst(fxBuilder, moteX, moteY, moteZ, requestedMoteCount, burstSpeed, moteLifetime = 0.55) {
  const moteParticles = fxBuilder.particles.use(VFX_EMITTERS.mote),
    randomSource = fxBuilder.rnd,
    moteCount = fxBuilder.n(requestedMoteCount)
  for (let index = 0; index < moteCount; index++) {
    const moteAngle = randomSource.next() * FX_TWO_PI,
      moteRise = randomSource.range(-0.2, 1),
      moteSpread = Math.sqrt(Math.max(0, 1 - moteRise * moteRise)),
      moteSpeed = burstSpeed * randomSource.range(0.35, 1)
    moteParticles.spawn(moteX, moteY, moteZ, Math.cos(moteAngle) * moteSpread * moteSpeed, moteRise * moteSpeed, Math.sin(moteAngle) * moteSpread * moteSpeed, moteLifetime * randomSource.range(0.6, 1.2), 0.22 * randomSource.range(0.7, 1.3), 0.05, randomSource.range(0, 0.05))
  }
}

export { PANYUE_SKILL_VFX, emitMoteBurst, XINGLI_VFX_PALETTE, emitMeleeSlashFx, XINGLI_MOTE_SPAWN, playMinionDeathFx, BATTLE_EVENT_VFX, playHeroDeathFx }
