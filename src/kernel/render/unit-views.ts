/**
 * 单位视图：影子/血条/增益图标/朝向指示的视觉组件与交叉淡入
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { VFX_RIBBON_STYLES, HIT_FEEDBACK_TUNING, emitDrakeBreath, showDrakeBreathWarning, emitPlumeBurst, FX_ANCHOR_SCRATCH_POSITION, emitSoftSparkBurst, emitTwinSlashGlow, recordHitEvent, SLASH_K_NORMALIZER, VFX_EMITTERS, emitDustPuff, emitDustTrail, emitEmbers, emitGlint, emitGroundImpact, emitHitSparks, emitPillarGlow, emitRockChips, emitShards, emitSlashGlow, emitSparkBurst, emitSphereGlow, emitGrassBurst } from '../fx/emitters'
import { FX_SHAPES, FX_STYLES, HERO_VFX_PALETTES, VFX_COLORS, hexToColor, FX_TWO_PI, triangleCountForShape } from '../fx/fx-definitions'
import { GROUND_FX_KINDS } from './decal-pen'
import { HERO_TABLE } from '../../heroes/registry'

const playMonsterDeathSequence = /**
 * 播放怪物。
 *
 * @param builder - 构建器
 * @param deathEventSpec - 次要输入
 */
(builder, deathEventSpec) => {
  const coordX = deathEventSpec.pos.x,
    coordY = deathEventSpec.pos.y,
    unitResult = builder.anchors.unit(deathEventSpec.unitId ?? -1),
    monsterType = unitResult && unitResult.kind === "monster" ? unitResult.monsterType : null,
    monsterRadius = unitResult ? unitResult.radius : 0.9,
    sourceUnitId = deathEventSpec.unitId ?? -1,
    randomStream = builder.rnd,
    anchorHeight = builder.anchor(sourceUnitId) ? builder.a.height : 2
  switch ((recordHitEvent(builder, monsterType ?? "mossback", coordX, anchorHeight * 0.6, coordY), monsterType)) {
    case "frost_golem": {
      ;(emitDustTrail(builder, coordX, 0.2, coordY, 4, monsterRadius, 1.6, VFX_COLORS.frostHot, VFX_COLORS.frostDeep, 0.9),
        builder.after(1, () => {
          const frostScatterEmitter = builder.particles.use(VFX_EMITTERS.frost)
          for (let index = 0; index < builder.n(14); index++)
            frostScatterEmitter.spawn(coordX + randomStream.signed() * monsterRadius, randomStream.range(0.6, 2.2), coordY + randomStream.signed() * monsterRadius, randomStream.signed() * 2.5, randomStream.range(0.5, 2.5), randomStream.signed() * 2.5, randomStream.range(0.7, 1.1), 0.34, 0.12, randomStream.range(0, 0.7))
          emitShards(builder, coordX, 1.4, coordY, 10, 4, 4, VFX_COLORS.frostHot, VFX_COLORS.frost, 0.22)
        }),
        builder.after(1.6, () => {
          ;(emitHitSparks(builder, coordX, 1.2, coordY, 1.6, VFX_COLORS.frostHot, VFX_COLORS.frost, 0, 0, 4, HIT_FEEDBACK_TUNING.flashSkill, 3),
            builder.decals
              .add(GROUND_FX_KINDS.sigil, coordX, coordY, monsterRadius + 0.8, 0.8)
              .params(0, 0.6)
              .color(VFX_COLORS.frost, 1.3, 0.9)
              .under(VFX_COLORS.shadow, 0.2))
        }))
      break
    }
    case "ember_golem": {
      const useResult = builder.particles.use(VFX_EMITTERS.flame)
      for (let index = 0; index < builder.n(10); index++)
        useResult.spawn(coordX + randomStream.signed() * 0.4, randomStream.range(2.2, 3), coordY + randomStream.signed() * 0.4, randomStream.signed() * 1.2, randomStream.range(3, 6), randomStream.signed() * 1.2, randomStream.range(0.35, 0.6), 1, 0.5, randomStream.range(0, 0.35))
      ;(emitEmbers(builder, coordX, 2.4, coordY, 16, 0.6, 3, VFX_COLORS.emberHot, VFX_COLORS.ember, 1.3, 0.18),
        builder.after(1.3, () => {
          ;(emitDustTrail(builder, coordX, 0.3, coordY, 4, monsterRadius, 1.8, VFX_COLORS.smoke, VFX_COLORS.smokeDark, 1.3), emitEmbers(builder, coordX, 0.8, coordY, 8, monsterRadius, 1.2, VFX_COLORS.emberHot, VFX_COLORS.ember, 1.2, 0.14), emitRockChips(builder, coordX, coordY, 5, 2.5, 4, monsterRadius * 0.5, VFX_COLORS.smokeDark, VFX_COLORS.smoke, 0.24))
        }),
        builder.after(1, () =>
          builder.decals
            .add(GROUND_FX_KINDS.scorch, coordX, coordY, monsterRadius + 0.6, 2.4)
            .color(VFX_COLORS.ember, 1.3)
            .under(VFX_COLORS.shadow, 0.7),
        ))
      break
    }
    case "mossback": {
      ;(emitDustTrail(builder, coordX, 0.2, coordY, 3, monsterRadius, 1.2, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.8),
        builder.after(0.6, () => {
          const tintResult = builder.particles.use(VFX_EMITTERS.glint).tint(VFX_COLORS.spore, VFX_COLORS.poisonDeep)
          for (let glintIndex = 0; glintIndex < builder.n(14); glintIndex++)
            tintResult.spawn(coordX + randomStream.signed() * 0.6, randomStream.range(0.6, 1.2), coordY + randomStream.signed() * 0.6, randomStream.signed() * 0.8, randomStream.range(0.4, 1.2), randomStream.signed() * 0.8, randomStream.range(1, 1.6), 0.26, 0.1, randomStream.range(0, 0.4))
          const broadleafEmitter = builder.particles.use(VFX_EMITTERS.broadleaf)
          for (let leafIndex = 0; leafIndex < builder.n(4); leafIndex++) broadleafEmitter.spawn(coordX, 0.9, coordY, randomStream.signed() * 2, randomStream.range(1.5, 3), randomStream.signed() * 2, randomStream.range(0.8, 1.1), 0.3, 0.26)
        }))
      break
    }
    case "glimwing": {
      builder.after(0.7, () => {
        const mothScaleEmitter = builder.particles.use(VFX_EMITTERS.scale).tint(VFX_COLORS.moth, VFX_COLORS.magicDeep)
        for (let scaleIndex = 0; scaleIndex < builder.n(10); scaleIndex++) mothScaleEmitter.spawn(coordX + randomStream.signed() * 0.7, randomStream.range(0.2, 0.6), coordY + randomStream.signed() * 0.7, randomStream.signed() * 0.8, randomStream.range(0.6, 1.6), randomStream.signed() * 0.8, randomStream.range(0.8, 1.2), 0.2, 0.08)
        emitGlint(builder, coordX, 0.5, coordY, 6, 1.4, VFX_COLORS.moth, VFX_COLORS.magicDeep, 0.9, 0.22)
      })
      break
    }
    case "abyss_drake": {
      ;(builder.after(0.6, () => {
        const attachResult = builder.anchors.attach?.(sourceUnitId, "crest", FX_ANCHOR_SCRATCH_POSITION),
          crestWorldX = attachResult ? FX_ANCHOR_SCRATCH_POSITION.x : coordX,
          crestWorldY = attachResult ? FX_ANCHOR_SCRATCH_POSITION.y : 4,
          crestWorldZ = attachResult ? FX_ANCHOR_SCRATCH_POSITION.z : coordY
        ;(emitHitSparks(builder, crestWorldX, crestWorldY, crestWorldZ, 2.6, VFX_COLORS.violetHot, VFX_COLORS.violet, 0, 0, 10, HIT_FEEDBACK_TUNING.flashBig, 8), emitShards(builder, crestWorldX, crestWorldY, crestWorldZ, 10, 6, 5, VFX_COLORS.violetHot, VFX_COLORS.violet, 0.26), builder.light(crestWorldX, crestWorldZ, crestWorldY, VFX_COLORS.violet, 6, 10, HIT_FEEDBACK_TUNING.lightDur))
      }),
        builder.after(1.7, () => {
          ;(emitGroundSplash(builder, coordX + randomStream.signed() * 1.5, coordY + randomStream.signed() * 1.5, 2.2, 14), builder.shake(0.2, coordX, coordY))
        }),
        builder.after(2, () => {
          const violetScaleEmitter = builder.particles.use(VFX_EMITTERS.scale).tint(VFX_COLORS.violetHot, VFX_COLORS.abyssCyan)
          for (let scaleOrbitIndex = 0; scaleOrbitIndex < builder.n(26); scaleOrbitIndex++)
            violetScaleEmitter.orbit(
              coordX + randomStream.signed() * 2.5,
              randomStream.range(0.3, 1.6),
              coordY + randomStream.signed() * 2.5,
              randomStream.range(0.1, 0.6),
              randomStream.range(0.2, 0.8),
              randomStream.next() * FX_TWO_PI,
              randomStream.range(1, 3),
              randomStream.range(1.5, 3),
              randomStream.range(1, 1.4),
              0.22,
              0.08,
              randomStream.range(0, 1),
            )
          emitGlint(builder, coordX, 1.5, coordY, 10, 2.5, VFX_COLORS.abyssCyan, VFX_COLORS.violet, 1.2, 0.3)
        }))
      break
    }
    case "star_colossus": {
      for (let pulseIndex = 0; pulseIndex < 3; pulseIndex++)
        builder.after(pulseIndex * 0.3, () => {
          const emitAngle = randomStream.next() * FX_TWO_PI
          ;(builder.glow
            .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, 0.9)
            .at(coordX, 4.2, coordY)
            .vel(Math.cos(emitAngle) * 6, 4, Math.sin(emitAngle) * 6, 9)
            .scale(2.2, 1.6)
            .rot(randomStream.next(), randomStream.next() * 3, randomStream.next())
            .spin(3, 2, 4)
            .color(VFX_COLORS.gold, 1.4, 0.9)
            .fade(0.02, 0.6)
            .opt(0.4, 2, 1),
            emitSparkBurst(builder, coordX, 4.2, coordY, 6, 7, VFX_COLORS.goldHot, VFX_COLORS.gold))
        })
      ;(builder.after(1.1, () => {
        ;(emitGroundSplash(builder, coordX - 2, coordY + 1, 2.4, 16), emitGroundSplash(builder, coordX + 2, coordY - 1, 2.4, 16), builder.shake(0.3, coordX, coordY))
      }),
        builder.after(2.6, () => {
          ;(builder.glow.spawn(FX_SHAPES.sphere, FX_STYLES.core, 0.9).at(coordX, 3, coordY).vel(0, 6, 0).scale(0.6, 1.2).color(VFX_COLORS.goldHot, 1.8, 1).fade(0.05, 0.5).opt(0.7, 1.4, 1),
            builder.after(0.8, () => {
              emitHitSparks(builder, coordX, 7.5, coordY, 3, VFX_COLORS.goldHot, VFX_COLORS.gold, 0, 0, 10, HIT_FEEDBACK_TUNING.flashBig, 10)
              const starEmitter = builder.particles.use(VFX_EMITTERS.star8)
              for (let starIndex = 0; starIndex < builder.n(28); starIndex++) {
                const spawnAngle = randomStream.next() * FX_TWO_PI,
                  spawnRadius = Math.sqrt(randomStream.next()) * 6
                starEmitter.spawn(coordX + Math.cos(spawnAngle) * spawnRadius, randomStream.range(6, 9), coordY + Math.sin(spawnAngle) * spawnRadius, randomStream.signed() * 0.6, -randomStream.range(2.5, 4.5), randomStream.signed() * 0.6, randomStream.range(1.4, 2), 0.36, 0.14, randomStream.range(0, 0.6))
              }
            }))
        }))
      break
    }
    default:
      emitDustTrail(builder, coordX, 0.3, coordY, 5, monsterRadius, 1.3, VFX_COLORS.dust, VFX_COLORS.dustDark, 1)
      break
  }
}

/**
 * 发送地形。
 *
 * @param fxContext - 来源
 * @param centerX - 次要输入
 * @param centerZ - 第三输入
 * @param splashRadius - 第四输入
 * @param dropletCount - 附加输入
 */
function emitGroundSplash(fxContext, centerX, centerZ, splashRadius, dropletCount) {
  const randomStream = fxContext.rnd
  fxContext.particles.use(VFX_EMITTERS.splash).spawn(centerX, 0.02, centerZ, 0, 0, 0, 0.55, splashRadius * 0.4, splashRadius * 1.6)
  const dropletEmitter = fxContext.particles.use(VFX_EMITTERS.droplet)
  for (let index = 0; index < fxContext.n(dropletCount); index++) {
    const sprayAngle = randomStream.next() * FX_TWO_PI,
      spraySpeed = randomStream.range(1, 3) * splashRadius * 0.6
    dropletEmitter.spawn(centerX + Math.cos(sprayAngle) * splashRadius * 0.25, 0.1, centerZ + Math.sin(sprayAngle) * splashRadius * 0.25, Math.cos(sprayAngle) * spraySpeed, randomStream.range(3, 6) * Math.sqrt(splashRadius), Math.sin(sprayAngle) * spraySpeed, randomStream.range(0.5, 0.8), 0.16, 0.1)
  }
}

/**
 * 播放怪物。
 *
 * @param fxContext - 构建器
 * @param centerX - 次要输入
 * @param centerZ - 第三输入
 * @param monsterType - 输入
 */
function playMonsterDeathBurst(fxContext, centerX, centerZ, monsterType) {
  const randomStream = fxContext.rnd
  switch (monsterType) {
    case "frost_golem": {
      fxContext.decals.add(GROUND_FX_KINDS.sigil, centerX, centerZ, 3.2, 1.4).params(0, 0.3).color(VFX_COLORS.frost, 1.4, 0.95).under(VFX_COLORS.shadow, 0.25)
      const frostPuffEmitter = fxContext.particles.use(VFX_EMITTERS.puff).tint(VFX_COLORS.frostHot, VFX_COLORS.frost)
      for (let index = 0; index < fxContext.n(10); index++) {
        const puffAngle = randomStream.next() * FX_TWO_PI
        frostPuffEmitter.spawn(centerX + Math.cos(puffAngle) * 1.2, 0.4, centerZ + Math.sin(puffAngle) * 1.2, Math.cos(puffAngle) * 1.2, randomStream.range(0.2, 0.8), Math.sin(puffAngle) * 1.2, randomStream.range(1, 1.4), 1.2, 3, randomStream.range(0, 0.3))
      }
      const frostEmitter = fxContext.particles.use(VFX_EMITTERS.frost)
      for (let frostIndex = 0; frostIndex < fxContext.n(12); frostIndex++) frostEmitter.orbit(centerX, 0.2, centerZ, 2.4, 0.8, randomStream.next() * FX_TWO_PI, 2, randomStream.range(0.8, 2.2), randomStream.range(0.8, 1.2), 0.3, 0.1, randomStream.range(0, 0.4))
      break
    }
    case "ember_golem": {
      ;(fxContext.decals.add(GROUND_FX_KINDS.cracks, centerX, centerZ, 3, 1.6).params(0, 0.6).color(VFX_COLORS.ember, 1.5).under(VFX_COLORS.shadow, 0.7),
        emitRockChips(fxContext, centerX, centerZ, 12, 3, 7, 1.2, VFX_COLORS.smokeDark, VFX_COLORS.smoke, 0.32),
        emitEmbers(fxContext, centerX, 0.3, centerZ, 12, 1.4, 2.4, VFX_COLORS.emberHot, VFX_COLORS.ember, 1, 0.16),
        emitDustTrail(fxContext, centerX, 0.3, centerZ, 5, 1.2, 1.8, VFX_COLORS.dust, VFX_COLORS.smoke, 1))
      break
    }
    case "mossback": {
      ;(emitRockChips(fxContext, centerX, centerZ, 8, 2.2, 4, 0.5, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.24), emitDustTrail(fxContext, centerX, 0.2, centerZ, 4, 0.5, 1.4, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.9))
      break
    }
    case "glimwing": {
      const amberGlintEmitter = fxContext.particles.use(VFX_EMITTERS.glint).tint(VFX_COLORS.amber, VFX_COLORS.moth)
      for (let glintIndex = 0; glintIndex < fxContext.n(16); glintIndex++) amberGlintEmitter.orbit(centerX, 3.5 - glintIndex * 0.15, centerZ, 1.6 - glintIndex * 0.06, 0.2, glintIndex * 0.7, 3, -1.5, 0.9, 0.3, 0.08, glintIndex * 0.05)
      break
    }
    case "abyss_drake": {
      ;(fxContext.decals.add(GROUND_FX_KINDS.swirl, centerX, centerZ, 5.5, 1.3).params(4, -2.5).color(VFX_COLORS.abyssCyan, 1.3, 0.9).under(VFX_COLORS.violetDeep, 0.6),
        fxContext.after(1, () => {
          ;(emitGroundSplash(fxContext, centerX, centerZ, 3.2, 26),
            fxContext.glow.spawn(FX_SHAPES.pillar, FX_STYLES.pillar, 0.7).at(centerX, 0, centerZ).scale3(1.6, 2, 1.6, 2.4, 7, 2.4).color(VFX_COLORS.abyssCyan, 1, 0.6).fade(0.05, 0.4).opt(0.25, 1.2, 1),
            emitGroundImpact(fxContext, centerX, centerZ, 6, 0.6, VFX_COLORS.abyssCyan, 1.4, 0.15, 0.3))
        }),
        fxContext.after(1.8, () => fxContext.shake(0.3, centerX, centerZ)))
      break
    }
    case "star_colossus": {
      fxContext.decals.add(GROUND_FX_KINDS.telegraph, centerX, centerZ, 4, 1.05).y(0.09).color(VFX_COLORS.gold, 1.5, 0.9).under(VFX_COLORS.violetDeep, 0.4).params(0.5)
      const ribbonStartX = centerX + 6,
        ribbonStartZ = centerZ - 4,
        startResult = fxContext.ribbons.start(VFX_RIBBON_STYLES.fire, ribbonStartX, 22, ribbonStartZ, VFX_COLORS.goldHot, VFX_COLORS.gold),
        heldCoreGlow = fxContext.glow.hold(FX_SHAPES.sphere, FX_STYLES.core)
      ;(heldCoreGlow.color(VFX_COLORS.goldHot, 1.8, 1), (heldCoreGlow.add = 0.8), (heldCoreGlow.k = 1.3), heldCoreGlow.scale(0.8))
      let total = 0
      const animateRibbon = () => {
        total += fxContext.dt
        const ribbonProgress = Math.min(1, total / 1),
          ribbonX = ribbonStartX + (centerX - ribbonStartX) * ribbonProgress,
          ribbonHeight = 22 * (1 - ribbonProgress * ribbonProgress),
          ribbonEndZ = ribbonStartZ + (centerZ - ribbonStartZ) * ribbonProgress
        if ((heldCoreGlow.at(ribbonX, ribbonHeight, ribbonEndZ), startResult >= 0 && fxContext.ribbons.move(startResult, ribbonX, ribbonHeight, ribbonEndZ), ribbonProgress < 1)) fxContext.after(0, animateRibbon)
        else {
          ;(fxContext.glow.release(heldCoreGlow), fxContext.ribbons.end(startResult), emitHitSparks(fxContext, centerX, 1, centerZ, 4, VFX_COLORS.goldHot, VFX_COLORS.gold, 0, 0, 14, HIT_FEEDBACK_TUNING.flashBig, 12), emitSphereGlow(fxContext, centerX, 0.5, centerZ, 1, 6, 0.5, VFX_COLORS.gold, 1.4, 0.7), emitGroundSplash(fxContext, centerX, centerZ, 3.6, 30))
          const palePuffEmitter = fxContext.particles.use(VFX_EMITTERS.puff).tint(VFX_COLORS.white, VFX_COLORS.frost)
          for (let index = 0; index < fxContext.n(10); index++) palePuffEmitter.spawn(centerX + randomStream.signed() * 2, 0.4, centerZ + randomStream.signed() * 2, randomStream.signed() * 1.5, randomStream.range(1.5, 3), randomStream.signed() * 1.5, randomStream.range(1.2, 1.8), 1.6, 3.6, randomStream.range(0, 0.3))
          ;(fxContext.light(centerX, centerZ, 3, VFX_COLORS.gold, HIT_FEEDBACK_TUNING.lightMax, 14, HIT_FEEDBACK_TUNING.lightDur), fxContext.shake(HIT_FEEDBACK_TUNING.shakeEpic, centerX, centerZ))
        }
      }
      fxContext.after(0, animateRibbon)
      break
    }
    default:
      emitDustPuff(fxContext, centerX, centerZ, 6, 0.4, 2.5, VFX_COLORS.dust, VFX_COLORS.dustDark, 1.1, 0.9)
  }
}

/**
 * 处理单位。
 *
 * @param fxContext - 主要输入
 * @param targetUnitId - 次要输入
 * @param ribbonStartX - 第三输入
 * @param ribbonStartY - 第四输入
 * @param ribbonStartZ - 附加输入
 * @param trackDuration - 附加输入
 * @param tintStartColor - 输入
 * @param tintEndColor - 输入
 * @param onComplete - 输入
 */
function trackEnergyRibbonToUnit(fxContext, targetUnitId, ribbonStartX, ribbonStartY, ribbonStartZ, trackDuration, tintStartColor, tintEndColor, onComplete) {
  const energyRibbonId = fxContext.ribbons.start(VFX_RIBBON_STYLES.energy, ribbonStartX, ribbonStartY, ribbonStartZ, tintStartColor, tintEndColor)
  energyRibbonId >= 0 && fxContext.ribbons.setWidth(energyRibbonId, 1.4)
  const wobbleAmplitude = fxContext.rnd.signed() * 2.5
  fxContext.track(
    targetUnitId,
    trackDuration,
    (position, trackProgress) => {
      const smoothProgress = trackProgress * trackProgress * (3 - 2 * trackProgress),
        xValue = position.x,
        coordZ = position.z,
        trailHeight = position.y + position.height * 0.55,
        offsetZ = -(coordZ - ribbonStartZ),
        offsetX = xValue - ribbonStartX,
        distance = Math.hypot(offsetZ, offsetX) || 1,
        wobbleOffset = Math.sin(trackProgress * Math.PI) * wobbleAmplitude,
        trailX = ribbonStartX + (xValue - ribbonStartX) * smoothProgress + (offsetZ / distance) * wobbleOffset,
        trailZ = ribbonStartZ + (coordZ - ribbonStartZ) * smoothProgress + (offsetX / distance) * wobbleOffset,
        trailY = ribbonStartY + (trailHeight - ribbonStartY) * smoothProgress + Math.sin(trackProgress * Math.PI) * 3
      ;(energyRibbonId >= 0 && fxContext.ribbons.move(energyRibbonId, trailX, trailY, trailZ), fxContext.rnd.next() < 0.5 && fxContext.particles.use(VFX_EMITTERS.glint).tint(tintStartColor, tintEndColor).spawn(trailX, trailY, trailZ, 0, 0.3, 0, 0.35, 0.28, 0.06))
    },
    () => {
      ;(fxContext.ribbons.end(energyRibbonId), onComplete())
    },
  )
}

/**
 * 播放状态效果与特效与阵营。
 *
 * @param fxBuilder - 特效构建器
 * @param centerX - 次要输入
 * @param centerZ - 第三输入
 * @param teamId - 第四输入
 * @param abyss_drakeKind - 输入
 * @param heroRoster - 附加输入
 */
function playTeamUltBuffFx(fxBuilder, centerX, centerZ, teamId, abyss_drakeKind, heroRoster) {
  const triangleCountForShapeResult = triangleCountForShape(teamId)
  if (abyss_drakeKind === "abyss_drake") {
    ;(emitPillarGlow(fxBuilder, centerX, centerZ, 0.5, 7, 0.9, VFX_COLORS.violet, 1.3, 0.6), emitGroundImpact(fxBuilder, centerX, centerZ, 6, 0.8, VFX_COLORS.abyssCyan, 1.4, 0.1, 0.25), fxBuilder.light(centerX, centerZ, 3, VFX_COLORS.violet, 6, 12, HIT_FEEDBACK_TUNING.lightDur))
    let heroIndex = 0
    for (const allyHero of heroRoster.heroes) {
      if (allyHero.team !== teamId || !allyHero.alive || fxBuilder.focusDist(allyHero.pos.x, allyHero.pos.y) > 46) continue
      const allyHeroId = allyHero.id
      ;(fxBuilder.after(0.15 + heroIndex * 0.08, () =>
        trackEnergyRibbonToUnit(fxBuilder, allyHeroId, centerX, 3, centerZ, 0.8, VFX_COLORS.violetHot, VFX_COLORS.abyssCyan, () => {
          if (!fxBuilder.anchor(allyHeroId)) return
          const anchorRadius = fxBuilder.a.radius
          ;(fxBuilder.decals
            .add(GROUND_FX_KINDS.sigil, fxBuilder.a.x, fxBuilder.a.z, anchorRadius * 2.1 + 0.5, 1.2)
            .params(3, 0.3)
            .color(VFX_COLORS.violet, 1.6, 1)
            .under(VFX_COLORS.violetDeep, 0.35)
            .follow(allyHeroId),
            emitHitSparks(fxBuilder, fxBuilder.a.x, fxBuilder.a.y + fxBuilder.a.height * 0.5, fxBuilder.a.z, 1.6, VFX_COLORS.violetHot, VFX_COLORS.violet, 0, 0, 4, HIT_FEEDBACK_TUNING.flashSkill, 4),
            fxBuilder.anchors.flashRim?.(allyHeroId, 1.5))
          const coinEmitter = fxBuilder.particles.use(VFX_EMITTERS.coin),
            goldGlintEmitter = fxBuilder.particles.use(VFX_EMITTERS.glint).tint(VFX_COLORS.goldHot, VFX_COLORS.abyssCyan)
          for (let coinIndex = 0; coinIndex < fxBuilder.n(8); coinIndex++) {
            const orbitAngle = fxBuilder.rnd.next() * FX_TWO_PI,
              orbitRadius = anchorRadius + fxBuilder.rnd.range(0.1, 0.6)
            ;(coinIndex % 2 === 0 ? coinEmitter : goldGlintEmitter).orbit(fxBuilder.a.x, fxBuilder.a.y + 0.2, fxBuilder.a.z, orbitRadius, orbitRadius * 0.6, orbitAngle, 2.5, fxBuilder.rnd.range(1.5, 2.6), fxBuilder.rnd.range(0.8, 1.1), 0.26, 0.14, coinIndex * 0.06)
          }
        }),
      ),
        heroIndex++)
    }
    return
  }
  ;(emitPillarGlow(fxBuilder, centerX, centerZ, 0.7, 9, 1, VFX_COLORS.gold, 1.3, 0.6), emitGroundImpact(fxBuilder, centerX, centerZ, 9, 0.9, triangleCountForShapeResult.glow, 1.4, 0.08, 0.25), fxBuilder.light(centerX, centerZ, 4, VFX_COLORS.gold, HIT_FEEDBACK_TUNING.lightMax, 16, HIT_FEEDBACK_TUNING.lightDur))
  for (const teamHero of heroRoster.heroes) {
    if (teamHero.team !== teamId || !teamHero.alive || fxBuilder.focusDist(teamHero.pos.x, teamHero.pos.y) > 46) continue
    const goldHeroId = teamHero.id
    fxBuilder.after(0.3 + fxBuilder.rnd.next() * 0.3, () => {
      if (!fxBuilder.anchor(goldHeroId)) return
      const anchorX = fxBuilder.a.x,
        zValue = fxBuilder.a.z,
        starRadius = fxBuilder.a.radius
      ;(fxBuilder.decals
        .add(GROUND_FX_KINDS.star, anchorX, zValue, starRadius * 2.1 + 0.6, 1.2)
        .params(8, 2.2)
        .color(VFX_COLORS.gold, 1.5, 0.95)
        .under(VFX_COLORS.shadow, 0.25)
        .follow(goldHeroId),
        fxBuilder.decals
          .add(GROUND_FX_KINDS.sigil, anchorX, zValue, starRadius * 2.1 + 0.4, 1)
          .params(2, 0.4)
          .color(VFX_COLORS.gold, 1.5, 1)
          .under(VFX_COLORS.shadow, 0.3)
          .follow(goldHeroId))
      const starEmitter = fxBuilder.particles.use(VFX_EMITTERS.star8)
      for (let starIndex = 0; starIndex < fxBuilder.n(10); starIndex++) starEmitter.spawn(anchorX + fxBuilder.rnd.signed() * 1.2, fxBuilder.rnd.range(4, 6), zValue + fxBuilder.rnd.signed() * 1.2, 0, -fxBuilder.rnd.range(3.5, 5), 0, fxBuilder.rnd.range(0.7, 1), 0.32, 0.16, starIndex * 0.05)
    })
  }
}

const MONSTER_VFX_HANDLERS = { monster_slain: playMonsterDeathSequence, drake_breath_warn: showDrakeBreathWarning, drake_breath: emitDrakeBreath },
  SHADOW_VIEW_MAX_DISTANCE = 28,
  SHADOW_LARGE_UNIT_RADIUS = 1.2

class UnitShadowView {
  k
  states = new Map()
  stamp = 0
  constructor(viewContext) {
    this.k = viewContext
  }
  update(world) {
    const kindValue = this.k,
      terrainData = kindValue.ctx.terrain,
      frameStamp = ++this.stamp,
      playerTeam = world.playerTeam
    for (const worldUnit of world.state.units) {
      if (!worldUnit.alive || (worldUnit.kind !== "hero" && worldUnit.kind !== "monster" && worldUnit.kind !== "minion") || (worldUnit.team !== playerTeam && worldUnit.team !== 2 && !worldUnit.visible[playerTeam]) || kindValue.focusDist(worldUnit.pos.x, worldUnit.pos.y) > SHADOW_VIEW_MAX_DISTANCE) continue
      let Value = this.states.get(worldUnit.id)
      if ((Value || ((Value = { ripple: 0, bush: worldUnit.bushId, anim: worldUnit.anim, seen: frameStamp }), this.states.set(worldUnit.id, Value)), (Value.seen = frameStamp), !kindValue.anchor(worldUnit.id))) continue
      const anchorX = kindValue.a.x,
        anchorZ = kindValue.a.z,
        anchorRadius = kindValue.a.radius,
        isMoving = Math.abs(worldUnit.pos.x - worldUnit.prevPos.x) + Math.abs(worldUnit.pos.y - worldUnit.prevPos.y) > 0.001,
        inWaterResult = terrainData.inWater(anchorX, anchorZ),
        isLargeUnit = anchorRadius >= SHADOW_LARGE_UNIT_RADIUS || (worldUnit.kind === "hero" && worldUnit.heroId === "panyue")
      if (
        (Value.anim !== worldUnit.anim &&
          ((Value.anim === "dash" || Value.anim === "leap" || Value.anim === "airborne") &&
            worldUnit.anim !== "dash" &&
            worldUnit.anim !== "leap" &&
            (inWaterResult ? emitGroundSplash(kindValue, anchorX, anchorZ, Math.max(1.2, anchorRadius * 2), isLargeUnit ? 16 : 9) : isLargeUnit && emitDustPuff(kindValue, anchorX, anchorZ, 8, anchorRadius * 0.6, 2.6, VFX_COLORS.dust, VFX_COLORS.dustDark, 1 + anchorRadius * 0.3, 0.7)),
          (Value.anim = worldUnit.anim)),
        inWaterResult && kindValue.now >= Value.ripple)
      ) {
        const rippleRadius = anchorRadius * 2.2 + 0.6
        if (
          (kindValue.particles
            .use(VFX_EMITTERS.ripple)
            .tint(VFX_COLORS.white, VFX_COLORS.frost)
            .spawn(anchorX, terrainData.waterLevel + 0.03, anchorZ, 0, 0, 0, isMoving ? 0.7 : 1.1, rippleRadius * 0.5, rippleRadius * (isMoving ? 1.6 : 1.3)),
          isMoving && (worldUnit.anim === "dash" || isLargeUnit))
        ) {
          const dropletEmitter = kindValue.particles.use(VFX_EMITTERS.droplet)
          for (let index = 0; index < kindValue.n(3); index++) {
            const sprayAngle = kindValue.rnd.next() * FX_TWO_PI
            dropletEmitter.spawn(anchorX + Math.cos(sprayAngle) * anchorRadius, terrainData.waterLevel + 0.1, anchorZ + Math.sin(sprayAngle) * anchorRadius, Math.cos(sprayAngle) * 1.5, kindValue.rnd.range(2, 3.5), Math.sin(sprayAngle) * 1.5, 0.45, 0.12, 0.08)
          }
        }
        Value.ripple = kindValue.now + (isMoving ? (worldUnit.anim === "dash" ? 0.12 : 0.25) : 1.2)
      }
      if (worldUnit.kind === "hero" && Value.bush !== worldUnit.bushId) {
        const leafSpawnX = anchorX,
          leafSpawnZ = anchorZ,
          leafEmitter = kindValue.particles.use(VFX_EMITTERS.broadleaf)
        for (let leafIndex = 0; leafIndex < kindValue.n(6); leafIndex++) {
          const leafAngle = kindValue.rnd.next() * FX_TWO_PI
          leafEmitter.spawn(
            leafSpawnX + Math.cos(leafAngle) * anchorRadius * 0.8,
            kindValue.rnd.range(0.4, 1.1),
            leafSpawnZ + Math.sin(leafAngle) * anchorRadius * 0.8,
            Math.cos(leafAngle) * kindValue.rnd.range(1, 2.4),
            kindValue.rnd.range(1.5, 3),
            Math.sin(leafAngle) * kindValue.rnd.range(1, 2.4),
            kindValue.rnd.range(0.6, 0.9),
            0.26,
            0.2,
          )
        }
        Value.bush = worldUnit.bushId
      }
    }
    if ((frameStamp & 31) === 0) for (const [lookupKey, shadowState] of this.states) frameStamp - shadowState.seen > 60 && this.states.delete(lookupKey)
  }
  reset() {
    this.states.clear()
  }
}

function getUnitHeight(fxContext, lookupOption, heightRatio = 0.5, fallbackHeight = 1) {
  return fxContext.anchor(lookupOption) ? fxContext.a.y + fxContext.a.height * heightRatio : fallbackHeight
}

function involvesPlayer(combatEvent, playerState) {
  return combatEvent.unitId === playerState.playerId || combatEvent.targetId === playerState.playerId
}

function getSkillRange(skillCast) {
  return skillCast.cast.type === "self" ? skillCast.cast.radius : skillCast.cast.range
}

function getSkillWidth(skillCast) {
  return skillCast.cast.type === "direction" ? skillCast.cast.width : 1
}

function getFirstValue(skillSpec, specIndex) {
  const specEntry = skillSpec.values[specIndex]
  return typeof specEntry == "number" ? specEntry : specEntry ? specEntry[0] : 0
}

const CHIJIN_HERO_PALETTE = HERO_VFX_PALETTES.chijin,
  CHIJIN_S2_SPEC = HERO_TABLE.chijin.skills.s2,
  CHIJIN_ULT_SPEC = HERO_TABLE.chijin.skills.ult,
  CHIJIN_ACCENT_COLOR = hexToColor(16760928),
  CHIJIN_SLASH_INNER_SIZE = 1.45,
  CHIJIN_SLASH_OUTER_SIZE = 2.6

function emitChijinSlash(fxContext, centerX, centerY, centerZ, slashScaleX, slashScaleY, slashScaleZ, glowStrength, baseAngle, flipAngle, slashCollector?) {
  return emitTwinSlashGlow(fxContext, centerX, centerY, centerZ, slashScaleX, slashScaleY, slashScaleZ, CHIJIN_HERO_PALETTE.glow, CHIJIN_ACCENT_COLOR, glowStrength, baseAngle, flipAngle, CHIJIN_SLASH_INNER_SIZE, slashCollector, CHIJIN_SLASH_OUTER_SIZE)
}

function emitChijinCrossSlash(fxContext, centerX, centerY, centerZ, tiltAngle, slashScale, spawnScale, slashK, spinAngle, slashCollector) {
  const emitSlashGlowValue = emitSlashGlow(fxContext, centerX, centerY, centerZ, tiltAngle, slashScale, spawnScale, CHIJIN_HERO_PALETTE.glow, CHIJIN_SLASH_INNER_SIZE, spinAngle, !1, 0.8)
  emitSlashGlowValue.k = slashK / SLASH_K_NORMALIZER
  const accentSlashGlow = emitSlashGlow(fxContext, centerX, centerY + 0.04, centerZ, tiltAngle, slashScale * 1.03, spawnScale * 0.7, CHIJIN_ACCENT_COLOR, CHIJIN_SLASH_OUTER_SIZE * 0.8, spinAngle, !1, 0.7)
  ;((accentSlashGlow.k = slashK / SLASH_K_NORMALIZER), slashCollector.push(emitSlashGlowValue, accentSlashGlow))
}

function emitSweepDustArc(fxContext, centerX, centerZ, arcRadius, startAngle, endAngle, dustScale, dustCount) {
  const randomStream = fxContext.rnd,
    nResult = fxContext.n(dustCount),
    sweepDirection = Math.sign(endAngle - startAngle) || 1
  for (let index = 0; index < nResult; index++) {
    const arcProgress = (index + randomStream.next()) / nResult,
      arcAngle = startAngle + (endAngle - startAngle) * arcProgress,
      sweepRadius = arcRadius * randomStream.range(0.7, 0.98),
      dustX = centerX + Math.cos(arcAngle) * sweepRadius,
      dustZ = centerZ + Math.sin(arcAngle) * sweepRadius,
      tangentX = -Math.sin(arcAngle) * sweepDirection,
      tangentZ = Math.cos(arcAngle) * sweepDirection,
      particleScale = arcProgress * dustScale
    ;(fxContext.particles.use(VFX_EMITTERS.dust).spawn(dustX, 0.2, dustZ, tangentX * 2.2 + Math.cos(arcAngle) * 1.2, randomStream.range(0.6, 1.6), tangentZ * 2.2 + Math.sin(arcAngle) * 1.2, randomStream.range(0.45, 0.7), 0.6, 1.3, particleScale),
      index % 2 === 0 &&
        fxContext.particles
          .use(VFX_EMITTERS.spark)
          .tint(CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep)
          .spawn(dustX, randomStream.range(0.3, 0.9), dustZ, tangentX * randomStream.range(5, 9), randomStream.range(1, 3.5), tangentZ * randomStream.range(5, 9), 0.26, 0.11, 0.04, particleScale))
  }
}

const playChijinPassiveHitFx = /**
 * 播放特效与碰撞。
 *
 * @param fxContext - 主要输入
 * @param hitEvent - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, hitEvent, playerState) => {
    const hitX = hitEvent.pos.x,
      yValue = hitEvent.pos.y,
      UnitHeightValue = getUnitHeight(fxContext, hitEvent.targetId, 0.5, 1)
    let facingAngle = 0
    fxContext.anchor(hitEvent.unitId) && (facingAngle = Math.atan2(yValue - fxContext.a.z, hitX - fxContext.a.x))
    const facingDirX = Math.cos(facingAngle),
      facingDirZ = Math.sin(facingAngle)
    ;(emitChijinSlash(fxContext, hitX - facingDirX * 1.75, UnitHeightValue + 0.35, yValue - facingDirZ * 1.75 + 0.55, facingAngle, 2, 0.26, 2.1, Math.PI / 2 - 0.45, !1),
      emitHitSparks(fxContext, hitX, UnitHeightValue, yValue, 1.7, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep, facingDirX, facingDirZ, 9, HIT_FEEDBACK_TUNING.flashSkill, 10),
      emitSoftSparkBurst(fxContext, hitX, UnitHeightValue - 0.2, yValue, 8, 8, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep, facingDirX, facingDirZ, 0.5),
      fxContext.decals
        .add(GROUND_FX_KINDS.streak, hitX + facingDirX * 0.4, yValue + facingDirZ * 0.4, 1.3, 0.5)
        .rot(facingAngle, 0.16)
        .params(0, 0)
        .color(CHIJIN_HERO_PALETTE.glow, 1.6)
        .under(CHIJIN_HERO_PALETTE.dark, 0.6),
      emitGroundImpact(fxContext, hitX, yValue, 1.3, 0.26, CHIJIN_HERO_PALETTE.glow, 1.3, 0.25, 0.25),
      involvesPlayer(hitEvent, playerState) && fxContext.shake(0.1, hitX, yValue))
  },
  playChijinS1SlashFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param slashSpec - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, slashSpec, playerState) => {
    const centerX = slashSpec.pos.x,
      centerZ = slashSpec.pos.y,
      directionX = slashSpec.dir?.x ?? 1,
      directionY = slashSpec.dir?.y ?? 0,
      slashHeading = Math.atan2(directionY, directionX),
      slashRadius = slashSpec.radius ?? 5.5,
      coneAngle = slashSpec.angle ?? 1.92,
      halfConeAngle = coneAngle / 2,
      randomStream = fxContext.rnd
    ;(fxContext.decals.add(GROUND_FX_KINDS.cone, centerX, centerZ, slashRadius, 0.6).rot(slashHeading).params(halfConeAngle, 0.35).color(CHIJIN_HERO_PALETTE.glow, 1.8).under(CHIJIN_HERO_PALETTE.dark, 0.4), emitChijinSlash(fxContext, centerX, 1, centerZ, slashHeading, slashRadius, 0.34, coneAngle, 0.06, !0), emitSweepDustArc(fxContext, centerX, centerZ, slashRadius, slashHeading + halfConeAngle, slashHeading - halfConeAngle, 0.13, 14))
    const streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, CHIJIN_HERO_PALETTE.hot),
      nNResult = fxContext.n(6)
    for (let index = 0; index < nNResult; index++) {
      const streakJitter = randomStream.next(),
        streakAngle = slashHeading + halfConeAngle - coneAngle * streakJitter,
        streakRadius = slashRadius * randomStream.range(0.55, 0.9)
      streakEmitter.spawn(centerX + Math.cos(streakAngle) * streakRadius, randomStream.range(0.6, 1.5), centerZ + Math.sin(streakAngle) * streakRadius, Math.sin(streakAngle) * 11, randomStream.signed() * 0.6, -Math.cos(streakAngle) * 11, 0.14, 0.1, 0.03, streakJitter * 0.12)
    }
    ;(fxContext.particles
      .use(VFX_EMITTERS.hitFlash)
      .tint(VFX_COLORS.white, CHIJIN_ACCENT_COLOR)
      .spawn(centerX + directionX * 1.1, 1.1, centerZ + directionY * 1.1, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 1, 1.7),
      fxContext.light(centerX + directionX * slashRadius * 0.5, centerZ + directionY * slashRadius * 0.5, 1.5, CHIJIN_HERO_PALETTE.glow, 7, slashRadius * 1.6, 0.3),
      fxContext.shake(involvesPlayer(slashSpec, playerState) ? HIT_FEEDBACK_TUNING.shakeSkill : 0.06, centerX, centerZ))
  },
  playChijinS2DashFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param dashSpec - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, dashSpec, playerState) => {
    const dashStart = dashSpec.from ?? dashSpec.pos,
      dashEnd = dashSpec.to ?? dashSpec.pos
    let directionX = dashEnd.x - dashStart.x,
      directionY = dashEnd.y - dashStart.y
    const distance = Math.hypot(directionX, directionY) || 0.01
    ;((directionX /= distance), (directionY /= distance))
    const atan2Atan2Result = Math.atan2(directionY, directionX),
      dashDuration = distance / getFirstValue(CHIJIN_S2_SPEC, "dashSpeed"),
      casterUnitId = dashSpec.unitId ?? -1,
      randomStream = fxContext.rnd,
      dustEmitter = fxContext.particles.use(VFX_EMITTERS.dust)
    for (let index = 0; index < fxContext.n(5); index++)
      dustEmitter.spawn(dashStart.x + randomStream.signed() * 0.4, randomStream.range(0.1, 0.5), dashStart.y + randomStream.signed() * 0.4, -directionX * randomStream.range(2, 5) + randomStream.signed(), randomStream.range(0.4, 1.6), -directionY * randomStream.range(2, 5) + randomStream.signed(), randomStream.range(0.45, 0.75), 0.6, 1.4)
    ;(fxContext.decals
      .add(GROUND_FX_KINDS.streak, (dashStart.x + dashEnd.x) / 2, (dashStart.y + dashEnd.y) / 2, distance / 2 + 0.4, 0.6)
      .rot(atan2Atan2Result, (getSkillWidth(CHIJIN_S2_SPEC) * 0.4) / (distance / 2 + 0.4))
      .params(0.6, 0.6 / dashDuration)
      .color(CHIJIN_HERO_PALETTE.glow, 1.5, 0.85)
      .under(CHIJIN_HERO_PALETTE.dark, 0.45),
      fxContext.anchor(casterUnitId) && (fxContext.trail(casterUnitId, VFX_RIBBON_STYLES.dust, dashDuration + 0.05, 0.45), fxContext.trail(casterUnitId, VFX_RIBBON_STYLES.energy, dashDuration + 0.06, 1.2, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep)))
    for (let slashIndex = 0; slashIndex < 3; slashIndex++) {
      const dashProgress = 0.28 + slashIndex * 0.26,
        slashX = dashStart.x + directionX * distance * dashProgress,
        slashZ = dashStart.y + directionY * distance * dashProgress,
        slashCollector = []
      emitChijinSlash(fxContext, slashX - directionX * 0.7, 1.05, slashZ - directionY * 0.7, atan2Atan2Result, 1.35, 0.3, 1.9, (slashIndex % 2 === 0 ? 1 : -1) * 1.05, slashIndex % 2 === 1, slashCollector)
      for (const slashEffect of slashCollector) slashEffect.delay(dashProgress * dashDuration)
      emitSoftSparkBurst(fxContext, slashX, 0.9, slashZ, 2, 6, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep, directionX, directionY, 0.6)
    }
    ;(fxContext.after(dashDuration, () => {
      ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, CHIJIN_ACCENT_COLOR).spawn(dashEnd.x, 1, dashEnd.y, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.9, 1.4), emitSoftSparkBurst(fxContext, dashEnd.x, 0.8, dashEnd.y, 5, 7, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep, directionX, directionY, 0.5))
      const dustEmitter = fxContext.particles.use(VFX_EMITTERS.dust)
      for (let dustIndex = 0; dustIndex < fxContext.n(3); dustIndex++) dustEmitter.spawn(dashEnd.x + randomStream.signed() * 0.3, 0.2, dashEnd.y + randomStream.signed() * 0.3, directionX * randomStream.range(1, 3), randomStream.range(0.4, 1.2), directionY * randomStream.range(1, 3), 0.5, 0.6, 1.3)
    }),
      dashSpec.unitId === playerState.playerId && fxContext.shake(0.08, dashStart.x, dashStart.y))
  },
  playChijinUltStartFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param castSpec - 次要输入
 * @param playerState - 第三输入
 */
(fxContext, castSpec, playerState) => {
    const centerX = castSpec.pos.x,
      centerZ = castSpec.pos.y,
      SkillRangeValue = getSkillRange(CHIJIN_ULT_SPEC),
      casterUnitId = castSpec.unitId ?? -1,
      anchorResult = fxContext.anchor(casterUnitId),
      randomStream = fxContext.rnd
    ;(emitGroundImpact(fxContext, centerX, centerZ, SkillRangeValue, 0.42, CHIJIN_HERO_PALETTE.glow, 1.9, 0.12, 0.4), emitDustPuff(fxContext, centerX, centerZ, 12, 0.8, 6.5, VFX_COLORS.dust, VFX_COLORS.dustDark, 1.3, 0.7))
    const streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, CHIJIN_HERO_PALETTE.hot),
      streakCount = fxContext.n(12)
    for (let index = 0; index < streakCount; index++) streakEmitter.orbit(centerX, randomStream.range(0.3, 1.6), centerZ, SkillRangeValue * randomStream.range(0.15, 0.3), SkillRangeValue * randomStream.range(0.8, 1.05), randomStream.next() * FX_TWO_PI, -8, randomStream.range(0, 1), randomStream.range(0.26, 0.36), 0.14, 0.04)
    const unitFacing = anchorResult && fxContext.a.unit ? fxContext.a.unit.facing : 0
    for (let crossSlashIndex = 0; crossSlashIndex < 2; crossSlashIndex++) {
      const slashCollector = []
      emitChijinCrossSlash(fxContext, anchorResult ? 0 : centerX, 1 + crossSlashIndex * 0.3, anchorResult ? 0 : centerZ, unitFacing + crossSlashIndex * Math.PI, SkillRangeValue * 0.75, 0.4, 1.9, crossSlashIndex === 0 ? 0.1 : -0.1, slashCollector)
      for (const slashEffect of slashCollector)
        (slashEffect
          .spin(0, 13, 0)
          .scale(SkillRangeValue * 0.35, SkillRangeValue * 0.95)
          .fade(0.1, 0.5),
          anchorResult && slashEffect.follow(casterUnitId))
    }
    ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, CHIJIN_ACCENT_COLOR).spawn(centerX, 1.2, centerZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBig, 1.6, 2.6),
      emitSoftSparkBurst(fxContext, centerX, 1, centerZ, 10, 9, CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep),
      fxContext.light(centerX, centerZ, 1.8, CHIJIN_HERO_PALETTE.glow, HIT_FEEDBACK_TUNING.lightMax, 10, 0.35),
      fxContext.shake(involvesPlayer(castSpec, playerState) ? 0.3 : 0.15, centerX, centerZ))
  },
  playChijinUltTickFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param tickSpec - 次要输入
 */
(fxContext, tickSpec) => {
    const centerX = tickSpec.pos.x,
      centerZ = tickSpec.pos.y,
      ringRadius = tickSpec.radius ?? 4.2,
      randomStream = fxContext.rnd,
      casterUnitId = tickSpec.unitId ?? -1,
      casterAnchored = fxContext.anchor(casterUnitId),
      underResult = fxContext.decals.add(GROUND_FX_KINDS.ring, centerX, centerZ, ringRadius, 0.3).params(0.55, 1).color(CHIJIN_HERO_PALETTE.glow, 1.2, 0.7).under(CHIJIN_HERO_PALETTE.dark, 0.2)
    casterAnchored && underResult.follow(casterUnitId)
    const baseAngle = randomStream.next() * FX_TWO_PI
    for (let index = 0; index < 2; index++) {
      const slashCollector = []
      emitChijinCrossSlash(fxContext, casterAnchored ? 0 : centerX, 0.95 + index * 0.4, casterAnchored ? 0 : centerZ, baseAngle + index * Math.PI, ringRadius * 0.97, 0.32, 2, index === 0 ? 0.1 : -0.1, slashCollector)
      for (const slashEffect of slashCollector) (slashEffect.spin(0, 15, 0).fade(0.12, 0.45), casterAnchored && slashEffect.follow(casterUnitId))
    }
    const sparkEmitter = fxContext.particles.use(VFX_EMITTERS.spark).tint(CHIJIN_ACCENT_COLOR, CHIJIN_HERO_PALETTE.deep),
      sparkCount = fxContext.n(8)
    for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex++) {
      const sparkAngle = randomStream.next() * FX_TWO_PI,
        sparkRadius = ringRadius * randomStream.range(0.8, 1)
      sparkEmitter.spawn(centerX + Math.cos(sparkAngle) * sparkRadius, randomStream.range(0.5, 1.5), centerZ + Math.sin(sparkAngle) * sparkRadius, Math.sin(sparkAngle) * randomStream.range(6, 10), randomStream.range(0.5, 3), -Math.cos(sparkAngle) * randomStream.range(6, 10), randomStream.range(0.2, 0.3), 0.12, 0.04)
    }
  },
  CHIJIN_VFX_HANDLERS = { chijin_passive_hit: playChijinPassiveHitFx, chijin_s1_slash: playChijinS1SlashFx, chijin_s2_dash: playChijinS2DashFx, chijin_ult_start: playChijinUltStartFx, chijin_ult_tick: playChijinUltTickFx },
  FENGLING_HERO_PALETTE = HERO_VFX_PALETTES.fengling,
  FENGLING_S2_SPEC = HERO_TABLE.fengling.skills.s2

function emitFenglingSlash(fxContext, centerX, centerY, centerZ, slashAngle, slashScale, spinAngle = 0) {
  const emitSlashGlowResult = emitSlashGlow(fxContext, centerX - Math.cos(slashAngle) * slashScale * 0.8, centerY, centerZ - Math.sin(slashAngle) * slashScale * 0.8 + 0.3, slashAngle, slashScale, 0.16, FENGLING_HERO_PALETTE.hot, 2.2, Math.PI / 2, !1, 0.95)
  ;(emitSlashGlowResult
    .rot(Math.PI / 2 - 0.35, -slashAngle, spinAngle)
    .scale(slashScale * 0.92, slashScale * 1.06)
    .fade(0.02, 0.35),
    (emitSlashGlowResult.k = 0.5))
}

const playFenglingS1CastFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param castSpec - 次要输入
 */
(fxContext, castSpec) => {
    const directionX = castSpec.dir?.x ?? 1,
      directionY = castSpec.dir?.y ?? 0,
      castAngle = Math.atan2(directionY, directionX),
      castX = castSpec.pos.x + directionX * 0.8,
      castZ = castSpec.pos.y + directionY * 0.8,
      castHeight = 1.4,
      randomStream = fxContext.rnd
    ;(fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, FENGLING_HERO_PALETTE.hot).spawn(castX, castHeight, castZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashBasic, 0.7, 1.2),
      emitFenglingSlash(fxContext, castX, castHeight, castZ, castAngle, 1),
      fxContext.glow
        .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, 0.22)
        .at(castX + directionX * 0.3, castHeight, castZ + directionY * 0.3)
        .vel(directionX * 12, 0, directionY * 12)
        .rot(0, -castAngle, -Math.PI / 2)
        .scale(0.15, 0.75)
        .color(VFX_COLORS.white, 1.5, 0.85)
        .fade(0.1, 0.35))
    const streakEmitter = fxContext.particles.use(VFX_EMITTERS.streak).tint(VFX_COLORS.white, FENGLING_HERO_PALETTE.hot)
    for (let index = 0; index < 3; index++) streakEmitter.spawn(castX + randomStream.signed() * 0.12, castHeight + randomStream.signed() * 0.15, castZ + randomStream.signed() * 0.12, directionX * randomStream.range(20, 28), 0, directionY * randomStream.range(20, 28), randomStream.range(0.12, 0.18), 0.1, 0.03, index * 0.015)
    for (const sideSign of [1, -1]) emitGrassBurst(fxContext, castSpec.pos.x + directionX * 0.6, castSpec.pos.y + directionY * 0.6, 4, 0.3, directionX * 1.5 - directionY * sideSign * 3.2, directionY * 1.5 + directionX * sideSign * 3.2)
    fxContext.decals
      .add(GROUND_FX_KINDS.streak, castX + directionX * 2.2, castZ + directionY * 2.2, 2.6, 0.3)
      .rot(castAngle, 0.1)
      .params(0, 6)
      .color(VFX_COLORS.white, 1.1, 0.7)
      .under(VFX_COLORS.black, 0)
  },
  playFenglingS2DashFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param dashSpec - 次要输入
 */
(fxContext, dashSpec) => {
    const dashStart = dashSpec.from ?? dashSpec.pos,
      dashEnd = dashSpec.to ?? dashSpec.pos
    let directionX = dashEnd.x - dashStart.x,
      directionY = dashEnd.y - dashStart.y
    const distance = Math.hypot(directionX, directionY) || 0.01
    ;((directionX /= distance), (directionY /= distance))
    const dashAngle = Math.atan2(directionY, directionX),
      dashDuration = distance / getFirstValue(FENGLING_S2_SPEC, "dashSpeed"),
      casterUnitId = dashSpec.unitId ?? -1
    ;(emitDustTrail(fxContext, dashStart.x, 0.2, dashStart.y, 4, 0.35, 0.95, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.5),
      emitGrassBurst(fxContext, dashStart.x, dashStart.y, 5, 0.35, -directionX * 2, -directionY * 2, 2.6),
      fxContext.decals
        .add(GROUND_FX_KINDS.streak, (dashStart.x + dashEnd.x) / 2, (dashStart.y + dashEnd.y) / 2, distance / 2 + 0.3, 0.4)
        .rot(dashAngle, 0.32 / (distance / 2 + 0.3))
        .params(0.2, 0.4 / dashDuration)
        .color(FENGLING_HERO_PALETTE.glow, 1.2, 0.75)
        .under(VFX_COLORS.black, 0),
      fxContext.anchor(casterUnitId) && (fxContext.trail(casterUnitId, VFX_RIBBON_STYLES.white, dashDuration + 0.05, 0.55, VFX_COLORS.white, FENGLING_HERO_PALETTE.glow), fxContext.trail(casterUnitId, VFX_RIBBON_STYLES.thin, dashDuration + 0.05, 1.25, FENGLING_HERO_PALETTE.hot, FENGLING_HERO_PALETTE.glow)),
      fxContext.after(dashDuration, () => {
        ;(emitDustTrail(fxContext, dashEnd.x, 0.15, dashEnd.y, 2, 0.3, 0.8, VFX_COLORS.dust, VFX_COLORS.dustDark, 0.4), emitPlumeBurst(fxContext, dashEnd.x, 1.2, dashEnd.y, 2, 1.4, -directionX * 1.5, -directionY * 1.5))
      }))
  },
  playFenglingUltCastFx = /**
 * 播放特效。
 *
 * @param fxContext - 特效构建器
 * @param castSpec - 次要输入
 */
(fxContext, castSpec) => {
    const centerX = castSpec.pos.x,
      centerZ = castSpec.pos.y,
      randomStream = fxContext.rnd,
      unitFacing = fxContext.anchor(castSpec.unitId) && fxContext.a.unit ? fxContext.a.unit.facing : 0,
      arrowEmitter = fxContext.particles.use(VFX_EMITTERS.arrow).tint(VFX_COLORS.plume, FENGLING_HERO_PALETTE.hot),
      arrowCount = fxContext.n(12)
    for (let index = 0; index < arrowCount; index++)
      arrowEmitter.spawn(centerX + randomStream.signed() * 0.4, 1.8 + randomStream.next() * 0.5, centerZ + randomStream.signed() * 0.4, randomStream.signed() * 2.2, randomStream.range(26, 36), randomStream.signed() * 2.2, randomStream.range(0.28, 0.36), 0.5, 0.4, randomStream.next() * 0.16)
    ;(emitPillarGlow(fxContext, centerX, centerZ, 0.24, 9, 0.4, FENGLING_HERO_PALETTE.glow, 1.5, 0.5),
      emitFenglingSlash(fxContext, centerX + Math.cos(unitFacing) * 0.5, 1.7, centerZ + Math.sin(unitFacing) * 0.5, unitFacing, 1.05, 0.9),
      emitGroundImpact(fxContext, centerX, centerZ, 1.8, 0.34, FENGLING_HERO_PALETTE.glow, 1.2, 0.2, 0.2),
      emitPlumeBurst(fxContext, centerX, 1.5, centerZ, 5, 2.6),
      emitGrassBurst(fxContext, centerX, centerZ, 5, 0.6, 0, 0, 3),
      fxContext.particles.use(VFX_EMITTERS.hitFlash).tint(VFX_COLORS.white, FENGLING_HERO_PALETTE.hot).spawn(centerX, 2.1, centerZ, 0, 0, 0, HIT_FEEDBACK_TUNING.flashSkill, 0.9, 1.5),
      fxContext.light(centerX, centerZ, 2, FENGLING_HERO_PALETTE.glow, 5, 7, 0.3))
  },
  playFenglingUltTickFx = /**
 * 播放特效。
 *
 * @param fxContext - 主要输入
 * @param tickSpec - 次要输入
 */
(fxContext, tickSpec) => {
    const centerX = tickSpec.pos.x,
      centerZ = tickSpec.pos.y,
      ringRadius = tickSpec.radius ?? 5,
      randomStream = fxContext.rnd
    let arrowDriftX = -1.6,
      arrowDriftZ = -1.1
    if (fxContext.anchor(tickSpec.unitId)) {
      const offsetX = centerX - fxContext.a.x,
        offsetZ = centerZ - fxContext.a.z,
        distance = Math.hypot(offsetX, offsetZ)
      distance > 0.5 && ((arrowDriftX = (offsetX / distance) * 2.6), (arrowDriftZ = (offsetZ / distance) * 2.6))
    }
    const spawnHeight = 10,
      particlePool = fxContext.particles,
      arrowCount = fxContext.n(16)
    for (let index = 0; index < arrowCount; index++) {
      const spawnAngle = randomStream.next() * FX_TWO_PI,
        spawnRadius = Math.sqrt(randomStream.next()) * ringRadius * 0.96,
        spawnX = centerX + Math.cos(spawnAngle) * spawnRadius,
        spawnZ = centerZ + Math.sin(spawnAngle) * spawnRadius,
        arrowFlightTime = randomStream.range(0.15, 0.2),
        spinOffset = randomStream.next() * 0.3
      ;(particlePool
        .use(VFX_EMITTERS.arrow)
        .tint(VFX_COLORS.plume, FENGLING_HERO_PALETTE.hot)
        .spawn(spawnX - arrowDriftX, spawnHeight, spawnZ - arrowDriftZ, arrowDriftX / arrowFlightTime, -spawnHeight / arrowFlightTime, arrowDriftZ / arrowFlightTime, arrowFlightTime, 0.56, 0.5, spinOffset),
        particlePool.use(VFX_EMITTERS.dust).spawn(spawnX, 0.12, spawnZ, arrowDriftX * 0.25, randomStream.range(0.5, 1.1), arrowDriftZ * 0.25, 0.35, 0.3, 0.7, spinOffset + arrowFlightTime),
        index % 3 === 0
          ? emitGrassBurst(fxContext, spawnX, spawnZ, 1, 0.1, arrowDriftX * 0.6, arrowDriftZ * 0.6, 2.4, spinOffset + arrowFlightTime)
          : particlePool
              .use(VFX_EMITTERS.chip)
              .tint(VFX_COLORS.white, FENGLING_HERO_PALETTE.glow)
              .spawn(spawnX, 0.15, spawnZ, randomStream.signed() * 2.5, randomStream.range(2, 4.5), randomStream.signed() * 2.5, 0.18, 0.1, 0.03, spinOffset + arrowFlightTime))
    }
    fxContext.decals.add(GROUND_FX_KINDS.ring, centerX, centerZ, ringRadius, 0.4).params(0.82, 1).color(FENGLING_HERO_PALETTE.glow, 1.1, 0.8).under(FENGLING_HERO_PALETTE.dark, 0.2)
  },
  FENGLING_VFX_HANDLERS = { fengling_s1_cast: playFenglingS1CastFx, fengling_s2_dash: playFenglingS2DashFx, fengling_ult_cast: playFenglingUltCastFx, fengling_ult_tick: playFenglingUltTickFx }

function computeFacingDirection(fxContext, unitEvent, targetX, targetZ, facingOut) {
  if (((facingOut.x = 0), (facingOut.z = 0), !fxContext.anchor(unitEvent.unitId))) return
  const deltaX = targetX - fxContext.a.x,
    deltaZ = targetZ - fxContext.a.z,
    distance = Math.hypot(deltaX, deltaZ)
  distance < 0.001 || ((facingOut.x = deltaX / distance), (facingOut.z = deltaZ / distance))
}

const facingScratch = { x: 0, z: 0 }

/**
 * 获取状态效果与图标。
 *
 * @param fxContext - 主要输入
 * @param unitEvent - 次要输入
 * @param sparkX - 第三输入
 * @param sparkY - 第四输入
 * @param sparkZ - 附加输入
 */
function readBuffIcons(fxContext, unitEvent, sparkX, sparkY, sparkZ) {
  const heroUnitAnchor = fxContext.anchors.unit(unitEvent.unitId ?? -1)
  if (!(!heroUnitAnchor || heroUnitAnchor.kind !== "hero")) {
    for (const unitBuff of heroUnitAnchor.buffs)
      if (unitBuff.id === "ember_might") {
        emitSparkBurst(fxContext, sparkX, sparkY, sparkZ, 4, 5, VFX_COLORS.emberHot, VFX_COLORS.ember, facingScratch.x, facingScratch.z, 0.4, 0.35, 0.12)
        return
      }
  }
}

export { getUnitHeight, facingScratch, playTeamUltBuffFx, computeFacingDirection, getFirstValue, MONSTER_VFX_HANDLERS, UnitShadowView, CHIJIN_VFX_HANDLERS, getSkillWidth, involvesPlayer, FENGLING_VFX_HANDLERS, readBuffIcons, getSkillRange, playMonsterDeathBurst }