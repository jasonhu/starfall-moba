/**
 * 状态特效表：眩晕/沉默/buff 视觉工厂与索引
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { VFX_EMITTERS, AREA_ALPHA_AGE_SCALE } from '../fx/emitters'
import { STATUS_RED_HOT, CHIJIN_PALETTE, ELEMENT_COLORS, FENGLING_PALETTE, SIGIL_RADIUS_SCALE, STATUS_VIOLET_DEEP, FROST_SIGIL_BLUE, STATUS_EMBER_ORANGE, STATUS_GREEN_LIGHT, STATUS_GOLD_BRIGHT, STATUS_GOLD_AMBER, XINGLI_PALETTE_ALT, PANYUE_HERO_PALETTE, YEQUE_PALETTE_ALT, STATUS_VIOLET_LIGHT, STATUS_EMBER_LIGHT, accumulateSteps, STATUS_GLOW_GOLD, expiryFlicker, STATUS_ICE_BLUE, holdDecalSlot, makeSigilEffect, STATUS_WARM_GOLD, STATUS_GOLD_PALE, scaleDecalRadius, sinePulse, STATUS_GREEN_DEEP, STATUS_AQUA_BLUE, FROST_SIGIL_DEEP_BLUE } from './unit-visual-effects'
import { FX_SHAPES, FX_STYLES, VFX_COLORS, FX_TWO_PI, triangleCountForShape } from '../fx/fx-definitions'
import { PARTICLE_KIND } from '../particle-atlas'
import { GROUND_FX_KINDS } from './decal-pen'

const STATUS_FX_DEFS = {
    stun: {
      create(fxSource, effectState, position) {
        const spawnHeight = position.y + position.height * 0.9,
          tintResult = fxSource.particles.use(VFX_EMITTERS.bolt).tint(STATUS_GOLD_AMBER, STATUS_GOLD_BRIGHT)
        for (let index = 0; index < 4; index++) {
          const boltAngle = (index * FX_TWO_PI) / 4 + 0.6
          tintResult.spawn(position.x + Math.cos(boltAngle) * 0.5, spawnHeight + 0.2, position.z + Math.sin(boltAngle) * 0.3, Math.cos(boltAngle) * 2.5, 1.5, Math.sin(boltAngle) * 1.5, 0.3, 0.5, 0.8)
        }
        fxSource.particles.use(VFX_EMITTERS.flash).tint(STATUS_GOLD_AMBER).spawn(position.x, spawnHeight, position.z, 0, 0, 0, 0.2, 0.8, 1.6)
      },
      update(fxTarget, updateValue, effectPos, effectMeta, frameDelta) {
        const centerHeight = effectPos.y + effectPos.height * 0.9,
          orbitRadius = 0.5 + effectPos.radius * 0.45
        for (let index = 0; index < 3; index++) {
          const spinAngle = updateValue.age * 5.2 + (index * FX_TWO_PI) / 3,
            flickerScale = Math.sin(spinAngle) < 0 ? 0.75 : 1
          fxTarget.sprites.icon(PARTICLE_KIND.star, effectPos.x + Math.cos(spinAngle) * orbitRadius, centerHeight + Math.sin(spinAngle) * 0.14, effectPos.z + Math.sin(spinAngle) * orbitRadius * 0.5, 0.62 * flickerScale, spinAngle * 1.3, STATUS_GOLD_AMBER, 1.25, flickerScale, 0.15, 0.6)
        }
        for (let accumulateStepsIndex = accumulateSteps(fxTarget, updateValue, frameDelta, 5); accumulateStepsIndex > 0; accumulateStepsIndex--)
          fxTarget.particles
            .use(VFX_EMITTERS.glint)
            .tint(STATUS_GOLD_PALE, STATUS_GOLD_BRIGHT)
            .spawn(effectPos.x + fxTarget.rnd.signed() * orbitRadius, centerHeight, effectPos.z + fxTarget.rnd.signed() * orbitRadius * 0.5, 0, 0.5, 0, 0.4, 0.26, 0.06)
      },
    },
    airborne: {
      create(fxSource, effectState) {
        const holdDecalSlotResult = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.glow, 0.05)
        fxSource.decals.at(holdDecalSlotResult).params(1.2).color(VFX_COLORS.black, 0, 0.9).under(VFX_COLORS.shadow, 0.7)
      },
      update(fxTarget, updateResult, effectPos, effectMeta, frameDelta) {
        fxTarget.decals
          .at(updateResult.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.7)
        for (let stepIndex = accumulateSteps(fxTarget, updateResult, frameDelta, 16); stepIndex > 0; stepIndex--) {
          const spawnAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.streak)
            .tint(VFX_COLORS.white, VFX_COLORS.dust)
            .spawn(effectPos.x + Math.cos(spawnAngle) * effectPos.radius, 0.2, effectPos.z + Math.sin(spawnAngle) * effectPos.radius, 0, fxTarget.rnd.range(4, 8), 0, 0.25, 0.1, 0.04)
        }
      },
    },
    root: {
      create(fxSource, effectState, effectPos) {
        const rangeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.range, 0.1)
        fxSource.decals.at(rangeSlot).params(0.05, 8).color(PANYUE_HERO_PALETTE.glow, 1.8, 0.95).under(VFX_COLORS.shadow, 0.45)
        for (let spikeIndex = 0; spikeIndex < 4; spikeIndex++) {
          const spikeGlow = fxSource.glow.hold(FX_SHAPES.spike, FX_STYLES.plain)
          ;(spikeGlow.color(VFX_COLORS.white, 1), effectState.meshes.push(spikeGlow))
        }
        fxSource.particles.use(VFX_EMITTERS.dust)
        for (let dustIndex = 0; dustIndex < 4; dustIndex++) fxSource.particles.spawn(effectPos.x + fxSource.rnd.signed() * 0.5, 0.2, effectPos.z + fxSource.rnd.signed() * 0.5, fxSource.rnd.signed(), 1, fxSource.rnd.signed(), 0.5, 0.5, 1.1)
      },
      update(fxTarget, effectState, effectPos) {
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.6)
        const spikeGrowth = Math.min(1, effectState.age * 7)
        for (let meshIndex = 0; meshIndex < effectState.meshes.length; meshIndex++) {
          const meshAngle = effectState.phase + (meshIndex * FX_TWO_PI) / effectState.meshes.length,
            orbitRadius = effectPos.radius + 0.25
          effectState.meshes[meshIndex]
            .at(effectPos.x + Math.cos(meshAngle) * orbitRadius, -0.03, effectPos.z + Math.sin(meshAngle) * orbitRadius)
            .scale3(0.42, (0.85 + (meshIndex % 2) * 0.3) * spikeGrowth, 0.42)
            .rot(0, -meshAngle, 0.38)
        }
      },
      end(ribbon, effectState) {
        for (const mesh of effectState.meshes) {
          ribbon.particles.use(VFX_EMITTERS.debris)
          for (let index = 0; index < 2; index++) ribbon.particles.spawn(mesh.x, 0.5, mesh.z, ribbon.rnd.signed() * 2, ribbon.rnd.range(1, 3), ribbon.rnd.signed() * 2, 0.6, 0.2, 0.16)
        }
      },
    },
    slow: {
      create(fxSource, effectState) {
        const swirlSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.swirl, 0.15)
        fxSource.decals.at(swirlSlot).params(3, 2.4).color(STATUS_VIOLET_LIGHT, 0.9, 0.7).under(STATUS_VIOLET_DEEP, 0.18)
        const rangeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.range, 0.15)
        fxSource.decals.at(rangeSlot).params(0.05, 12).color(STATUS_VIOLET_LIGHT, 1.25, 0.75).under(VFX_COLORS.shadow, 0.2)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const slowIntensity = Math.min(1, 0.5 + effectMeta.value),
          auraRadius = effectPos.radius + 0.4 + effectMeta.value * 0.5
        ;(fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(auraRadius)
          .alpha(0.45 + 0.3 * slowIntensity),
          fxTarget.decals.at(effectState.slots[1]).at(effectPos.x, effectPos.z).radius(auraRadius))
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 5 + 6 * slowIntensity); stepIndex > 0; stepIndex--) {
          const streakAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.streak)
            .tint(STATUS_VIOLET_LIGHT, STATUS_VIOLET_DEEP)
            .spawn(effectPos.x + Math.cos(streakAngle) * auraRadius * 0.75, effectPos.y + fxTarget.rnd.range(0.5, 1), effectPos.z + Math.sin(streakAngle) * auraRadius * 0.75, 0, -1.5, 0, 0.4, 0.16, 0.05)
        }
      },
    },
    shield: {
      create(fxSource, effectState, effectPos, unitSource) {
        const shieldMesh = fxSource.glow.hold(FX_SHAPES.sphere, FX_STYLES.hex),
          unitResult = fxSource.anchors.unit(unitSource.sourceId),
          isPanyue = unitResult !== void 0 && unitResult.kind === "hero" && unitResult.heroId === "panyue"
        ;(shieldMesh.color(isPanyue ? STATUS_WARM_GOLD : STATUS_ICE_BLUE, 1.25, 0), (shieldMesh.add = 0.4), effectState.meshes.push(shieldMesh))
      },
      update(fxTarget, effectState, effectPos, effectMeta) {
        const selectedMeshes = effectState.meshes[0],
          growFactor = Math.min(1, effectState.age * 8),
          shieldFlicker = effectMeta.timeLeft < 0.8 ? 0.6 + 0.4 * Math.sin(effectState.age * 22) : 1,
          shieldScale = (effectPos.radius + 0.75) * (0.6 + 0.4 * growFactor)
        ;(selectedMeshes.at(effectPos.x, effectPos.y + effectPos.height * 0.46, effectPos.z).scale3(shieldScale, Math.max(shieldScale, effectPos.height * 0.56), shieldScale), selectedMeshes.rot(0, effectState.age * 0.5, 0), (selectedMeshes.a = 0.85 * growFactor * shieldFlicker))
      },
    },
    haste: {
      create(fxSource, effectState) {
        const swirlSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.swirl, 0.2)
        fxSource.decals.at(swirlSlot).params(3, -1.8).color(FENGLING_PALETTE.glow, 0.9, 0.4).under(FENGLING_PALETTE.deep, 0.06)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const movingUnit = effectPos.unit
        if (!movingUnit) return
        const driftSpeedX = (movingUnit.pos.x - movingUnit.prevPos.x) / AREA_ALPHA_AGE_SCALE,
          driftSpeedZ = (movingUnit.pos.y - movingUnit.prevPos.y) / AREA_ALPHA_AGE_SCALE,
          distance = Math.hypot(driftSpeedX, driftSpeedZ)
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.6)
          .alpha(distance > 0.5 ? 0.2 : 0.42)
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, distance > 0.5 ? 26 : 16); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            spawnOffsetX = effectRandom.signed() * (effectPos.radius + 0.35),
            spawnOffsetZ = effectRandom.signed() * (effectPos.radius + 0.35)
          distance > 0.5
            ? fxTarget.particles
                .use(VFX_EMITTERS.streak)
                .tint(FENGLING_PALETTE.glow, FENGLING_PALETTE.deep)
                .spawn(effectPos.x + spawnOffsetX - (driftSpeedX / distance) * 0.4, effectPos.y + effectRandom.range(0.2, 1.6), effectPos.z + spawnOffsetZ - (driftSpeedZ / distance) * 0.4, -driftSpeedX * 0.7, effectRandom.signed() * 0.3, -driftSpeedZ * 0.7, 0.34, 0.2, 0.07)
            : fxTarget.particles
                .use(VFX_EMITTERS.streak)
                .tint(VFX_COLORS.white, FENGLING_PALETTE.glow)
                .orbit(effectPos.x, effectPos.y + effectRandom.range(0.15, 0.75), effectPos.z, effectPos.radius + 0.3, effectPos.radius + 0.6, effectRandom.next() * FX_TWO_PI, 8, effectRandom.range(0.3, 1), 0.44, 0.24, 0.07)
        }
      },
    },
    burn: {
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 18); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            sparkX = effectPos.x + effectRandom.signed() * effectPos.radius * 0.8,
            sparkZ = effectPos.z + effectRandom.signed() * effectPos.radius * 0.8,
            sparkY = effectPos.y + effectRandom.range(0.2, effectPos.height * 0.7)
          effectRandom.chance(0.7)
            ? fxTarget.particles.use(VFX_EMITTERS.flame).spawn(sparkX, sparkY, sparkZ, 0, effectRandom.range(1, 2.2), 0, effectRandom.range(0.35, 0.55), 0.95, 0.4)
            : fxTarget.particles
                .use(VFX_EMITTERS.ember)
                .tint(STATUS_EMBER_LIGHT, STATUS_EMBER_ORANGE)
                .spawn(sparkX, sparkY, sparkZ, effectRandom.signed() * 0.5, effectRandom.range(1, 2.5), effectRandom.signed() * 0.5, 0.6, 0.13, 0.04)
        }
      },
    },
    untargetable: {
      create(fxSource, effectState) {
        const glowSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.glow, 0.1)
        fxSource.decals.at(glowSlot).params(1.2).color(VFX_COLORS.black, 0, 0.9).under(VFX_COLORS.ink, 0.75)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.8)
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 20); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            riseAngle = effectRandom.next() * FX_TWO_PI,
            riseRadius = effectPos.radius * effectRandom.range(0.5, 1.2),
            inkMistSize = effectRandom.range(0.1, 0.22)
          fxTarget.particles.use(VFX_EMITTERS.inkRise).spawn(effectPos.x + Math.cos(riseAngle) * riseRadius, effectPos.y + effectRandom.range(0.1, 1.5), effectPos.z + Math.sin(riseAngle) * riseRadius, effectRandom.signed() * 0.4, effectRandom.range(0.4, 1.2), effectRandom.signed() * 0.4, 0.5, inkMistSize, inkMistSize * 1.6)
        }
      },
    },
    unstoppable: {
      create(fxSource, effectState) {
        const rangeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.range, 0.1)
        fxSource.decals.at(rangeSlot).params(0.05, 12).color(STATUS_GOLD_BRIGHT, 1.6, 0.9).under(VFX_COLORS.shadow, 0.3)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.7)
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 22); stepIndex > 0; stepIndex--) {
          const streakAngle = fxTarget.rnd.next() * FX_TWO_PI,
            streakRadius = effectPos.radius + 0.35
          fxTarget.particles
            .use(VFX_EMITTERS.streak)
            .tint(STATUS_GOLD_PALE, STATUS_GOLD_BRIGHT)
            .spawn(effectPos.x + Math.cos(streakAngle) * streakRadius, effectPos.y + 0.1, effectPos.z + Math.sin(streakAngle) * streakRadius, 0, fxTarget.rnd.range(3.5, 6.5), 0, 0.4, 0.14, 0.05)
        }
      },
    },
    recall: {
      create(fxSource, effectState) {
        const runeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.rune, 0.3)
        fxSource.decals.at(runeSlot).params(6, 1.6).color(STATUS_AQUA_BLUE, 1.7, 0.9).under(VFX_COLORS.shadow, 0.3)
        const pillarGlow = fxSource.glow.hold(FX_SHAPES.pillar, FX_STYLES.pillar)
        ;(pillarGlow.color(STATUS_AQUA_BLUE, 1.1, 0), (pillarGlow.add = 0.3), (pillarGlow.k = 1.2), effectState.meshes.push(pillarGlow))
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const recallProgress = effectMeta.duration > 0 ? 1 - effectMeta.timeLeft / effectMeta.duration : 0,
          pillarScale = 1.9 - 0.9 * recallProgress
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(pillarScale + 0.2)
        const pillarMesh = effectState.meshes[0]
        ;(pillarMesh.at(effectPos.x, 0.05, effectPos.z).scale3(pillarScale * 0.62, 3 + 5 * recallProgress, pillarScale * 0.62), (pillarMesh.a = 0.2 + 0.65 * recallProgress))
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 2.4 + recallProgress * 2); stepIndex > 0; stepIndex--) {
          fxTarget.glow
            .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, 0.9)
            .at(effectPos.x, 0.15, effectPos.z)
            .vel(0, 2.6 + recallProgress * 2, 0)
            .scale(pillarScale, pillarScale * 0.6)
            .color(STATUS_AQUA_BLUE, 1.2, 0.9)
            .fade(0.15, 0.5)
            .opt(0.3, 2, 1)
          for (let orbitIndex = 0; orbitIndex < 3; orbitIndex++)
            fxTarget.particles
              .use(VFX_EMITTERS.glint)
              .tint(VFX_COLORS.white, STATUS_AQUA_BLUE)
              .orbit(effectPos.x, 0.1, effectPos.z, pillarScale, pillarScale * 0.4, fxTarget.rnd.next() * FX_TWO_PI, 5, fxTarget.rnd.range(2, 4), 0.8, 0.3, 0.08)
        }
      },
    },
    restore: {
      create(fxSource, effectState) {
        const glowSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.glow, 0.2)
        fxSource.decals.at(glowSlot).params(1.3).color(STATUS_GREEN_LIGHT, 1.1, 0.85).under(VFX_COLORS.black, 0)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        ;(fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.9),
          (Math.floor(effectState.age / 0.7) !== Math.floor((effectState.age - frameDelta) / 0.7) || effectState.age <= frameDelta) &&
            fxTarget.glow
              .spawn(FX_SHAPES.hoop, FX_STYLES.hoop, 0.8)
              .at(effectPos.x, effectPos.y + 0.2, effectPos.z)
              .vel(0, 2.2, 0)
              .scale(effectPos.radius + 0.5, effectPos.radius + 0.25)
              .color(STATUS_GREEN_LIGHT, 1, 0.9)
              .fade(0.15, 0.5)
              .opt(0.3, 2, 1))
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 16); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            plusAngle = effectRandom.next() * FX_TWO_PI,
            spawnRadius = effectRandom.range(0.5, effectPos.radius + 0.6)
          effectRandom.chance(0.3)
            ? fxTarget.particles.use(VFX_EMITTERS.plus).spawn(effectPos.x + Math.cos(plusAngle) * spawnRadius, effectPos.y + effectRandom.range(0.3, 1), effectPos.z + Math.sin(plusAngle) * spawnRadius, 0, effectRandom.range(1, 1.8), 0, 0.8, 0.26, 0.4)
            : fxTarget.particles
                .use(VFX_EMITTERS.glint)
                .tint(STATUS_GREEN_LIGHT, STATUS_GREEN_DEEP)
                .spawn(effectPos.x + Math.cos(plusAngle) * spawnRadius, effectPos.y + effectRandom.range(0.1, 0.8), effectPos.z + Math.sin(plusAngle) * spawnRadius, 0, effectRandom.range(1.2, 2.4), 0, 0.8, 0.34, 0.08)
        }
      },
    },
    fountain: {
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const triangleCountForShapeResult = triangleCountForShape(effectPos.unit ? effectPos.unit.team : 2)
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 8); stepIndex > 0; stepIndex--) {
          const fountainAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.glint)
            .tint(triangleCountForShapeResult.glow, triangleCountForShapeResult.deep)
            .spawn(effectPos.x + Math.cos(fountainAngle) * (effectPos.radius + 0.3), effectPos.y + 0.1, effectPos.z + Math.sin(fountainAngle) * (effectPos.radius + 0.3), 0, fxTarget.rnd.range(1, 2.2), 0, 0.9, 0.32, 0.08)
        }
      },
    },
    respawn_guard: {
      create(fxSource, effectState) {
        const guardShield = fxSource.glow.hold(FX_SHAPES.sphere, FX_STYLES.rim)
        ;(guardShield.color(STATUS_GOLD_BRIGHT, 1.2, 0), (guardShield.add = 0.4), (guardShield.k = 2.6), effectState.meshes.push(guardShield))
        const rangeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.range, 0.1)
        fxSource.decals.at(rangeSlot).params(0.04, 0).color(STATUS_GOLD_BRIGHT, 1.7, 0.9).under(VFX_COLORS.shadow, 0.25)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const guardMesh = effectState.meshes[0],
          pulseFactor = 1 + 0.05 * Math.sin(effectState.age * 6),
          guardScale = (effectPos.radius + 0.85) * pulseFactor
        ;(guardMesh.at(effectPos.x, effectPos.y + effectPos.height * 0.46, effectPos.z).scale3(guardScale, Math.max(guardScale, effectPos.height * 0.58), guardScale),
          (guardMesh.a = 0.75),
          fxTarget.decals
            .at(effectState.slots[0])
            .at(effectPos.x, effectPos.z)
            .radius(effectPos.radius + 0.9))
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 6); stepIndex > 0; stepIndex--) {
          const sparkAngle = fxTarget.rnd.next() * FX_TWO_PI
          fxTarget.particles
            .use(VFX_EMITTERS.glint)
            .tint(STATUS_GOLD_PALE, STATUS_GOLD_BRIGHT)
            .spawn(effectPos.x + Math.cos(sparkAngle) * guardScale, effectPos.y + fxTarget.rnd.range(0.2, 1.8), effectPos.z + Math.sin(sparkAngle) * guardScale, 0, 0.8, 0, 0.6, 0.26, 0.06)
        }
      },
    },
    frost_insight: makeSigilEffect(0, FROST_SIGIL_DEEP_BLUE, FROST_SIGIL_BLUE, ELEMENT_COLORS.frost, 0.35, PARTICLE_KIND.frost),
    ember_might: makeSigilEffect(1, STATUS_EMBER_ORANGE, STATUS_EMBER_LIGHT, ELEMENT_COLORS.ember, -0.45, PARTICLE_KIND.flame),
    star_blessing: {
      create(fxSource, effectState) {
        const sigilSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.sigil, 0.3)
        fxSource.decals.at(sigilSlot).y(0.068).params(2, 1).color(STATUS_GOLD_BRIGHT, 1.5, 0.75).under(VFX_COLORS.shadow, 0.25)
      },
      update(fxTarget, effectState, effectPos, effectMeta) {
        const expiryFlickerResult = expiryFlicker(effectState, effectMeta)
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(scaleDecalRadius(effectPos, ELEMENT_COLORS.star))
          .rot(effectState.age * 0.25)
          .alpha(0.75 * expiryFlickerResult)
        const starCount = fxTarget.lowQ ? 1 : 3,
          starRadius = effectPos.radius + 0.55
        for (let starIndex = 0; starIndex < starCount; starIndex++) {
          const starAngle = effectState.phase + effectState.age * 1.7 + (starIndex * FX_TWO_PI) / 3,
            starHeight = effectPos.y + effectPos.height * (0.45 + 0.18 * Math.sin(starAngle + 0.6))
          fxTarget.sprites.icon(PARTICLE_KIND.star8, effectPos.x + Math.cos(starAngle) * starRadius, starHeight, effectPos.z + Math.sin(starAngle) * starRadius, 0.42, effectState.age * 0.8, STATUS_GOLD_AMBER, 1.3, 0.95 * expiryFlickerResult, 0.15, 0.2)
        }
      },
    },
    xingli_mark: {
      create(fxSource, effectState) {
        const ringSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.rings, 0.15)
        fxSource.decals.at(ringSlot).y(0.07).params(1, 1).color(XINGLI_PALETTE_ALT.hot, 1.6, 0.9).under(XINGLI_PALETTE_ALT.dark, 0.3)
      },
      update(fxTarget, effectState, effectPos, effectMeta) {
        const markCount = Math.max(1, Math.min(3, effectMeta.stacks))
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius * SIGIL_RADIUS_SCALE)
          .params(markCount, 1)
          .alpha(markCount >= 3 ? 1 : 0.8)
        const growFactor = Math.min(1, effectState.age * 8),
          markRadius = effectPos.radius + 0.5
        for (let markIndex = 0; markIndex < markCount; markIndex++) {
          const markAngle = effectState.phase + effectState.age * 2.6 + (markIndex * FX_TWO_PI) / 3,
            markScale = 0.42 * (markIndex === markCount - 1 ? 0.6 + 0.4 * growFactor : 1),
            markHeight = effectPos.y + effectPos.height * 0.55 + Math.sin(effectState.age * 3.2 + markIndex * 2.1) * 0.12
          fxTarget.sprites.icon(PARTICLE_KIND.glow, effectPos.x + Math.cos(markAngle) * markRadius, markHeight, effectPos.z + Math.sin(markAngle) * markRadius, markScale * 1.5, 0, XINGLI_PALETTE_ALT.accent, 1.9, 1, 0.5, 0.2)
        }
      },
    },
    tower_focus: {
      create(fxSource, effectState) {
        const lockSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.lock, 0.1)
        fxSource.decals.at(lockSlot).y(0.075).color(STATUS_RED_HOT, 1.8, 0.95).under(VFX_COLORS.shadow, 0.45)
      },
      update(fxTarget, effectState, effectPos, effectMeta) {
        const stackCount = Math.min(5, Math.max(1, effectMeta.stacks))
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.55 + 0.06 * stackCount)
          .alpha(0.7 + 0.3 * Math.abs(Math.sin(effectState.age * (3 + stackCount))))
        const focusRadius = effectPos.radius + 0.5
        for (let focusIndex = 0; focusIndex < stackCount; focusIndex++) {
          const focusAngle = effectState.phase - effectState.age * 3 + (focusIndex * FX_TWO_PI) / stackCount
          fxTarget.sprites.icon(PARTICLE_KIND.diamond, effectPos.x + Math.cos(focusAngle) * focusRadius, effectPos.y + 0.4, effectPos.z + Math.sin(focusAngle) * focusRadius, 0.4, 0, STATUS_RED_HOT, 1.3, 1, 0.2, 0.2)
        }
      },
    },
    panyue_passive: {
      update(fxTarget, effectState, effectPos, effectMeta) {
        if (effectMeta.stacks < 2) return
        const heroUnit = effectPos.unit,
          facingAngle = heroUnit ? heroUnit.facing : 0
        let handX = effectPos.x + Math.cos(facingAngle) * 0.55 + Math.sin(facingAngle) * 0.38,
          handY = effectPos.y + effectPos.height * 0.42,
          handZ = effectPos.z + Math.sin(facingAngle) * 0.55 - Math.cos(facingAngle) * 0.38
        heroUnit && fxTarget.anchors.attach?.(heroUnit.id, "handL", fxTarget.v) && ((handX = fxTarget.v.x + Math.cos(facingAngle) * 0.12), (handY = fxTarget.v.y - 0.12), (handZ = fxTarget.v.z + Math.sin(facingAngle) * 0.12))
        const glowScale = 0.62 + 0.14 * Math.sin(effectState.age * 9)
        ;(fxTarget.sprites.icon(PARTICLE_KIND.glow, handX, handY, handZ, glowScale * 1.25, 0, PANYUE_HERO_PALETTE.hot, 1.9, 0.95, 0.6, 0.45), fxTarget.sprites.draw(PARTICLE_KIND.spark, handX, handY, handZ, glowScale * 1.15, effectState.age * 1.5, PANYUE_HERO_PALETTE.hot, 1.6, 0.9, 0.7, 0.46))
      },
    },
    chijin_ember: {
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        const heroUnit = effectPos.unit,
          facingAngle = heroUnit ? heroUnit.facing : 0
        let emberX = effectPos.x - Math.sin(facingAngle) * 0.45,
          emberY = effectPos.y + effectPos.height * 0.95,
          emberZ = effectPos.z + Math.cos(facingAngle) * 0.45
        heroUnit && fxTarget.anchors.attach?.(heroUnit.id, "weapon", fxTarget.v) && ((emberX = fxTarget.v.x), (emberY = fxTarget.v.y), (emberZ = fxTarget.v.z))
        const emberScale = 0.7 + 0.16 * Math.sin(effectState.age * 11)
        ;(fxTarget.sprites.icon(PARTICLE_KIND.glow, emberX, emberY, emberZ, emberScale * 1.2, 0, STATUS_GLOW_GOLD, 2, 0.95, 0.6, 0.4), fxTarget.sprites.draw(PARTICLE_KIND.spark, emberX, emberY, emberZ, emberScale, effectState.age * 2.2, STATUS_GLOW_GOLD, 1.7, 0.9, 0.7, 0.41))
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 7); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd
          fxTarget.particles
            .use(VFX_EMITTERS.spark)
            .tint(STATUS_GLOW_GOLD, STATUS_EMBER_ORANGE)
            .spawn(emberX + effectRandom.signed() * 0.15, emberY + effectRandom.signed() * 0.15, emberZ + effectRandom.signed() * 0.15, effectRandom.signed() * 1.6, effectRandom.range(0.5, 2.5), effectRandom.signed() * 1.6, 0.3, 0.1, 0.03)
        }
      },
    },
    chijin_blaze: {
      create(fxSource, effectState) {
        const swirlSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.swirl, 0.15)
        fxSource.decals.at(swirlSlot).y(0.07).params(3, -2.4).color(CHIJIN_PALETTE.glow, 1.7, 0.9).under(CHIJIN_PALETTE.dark, 0.5)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.8)
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 18); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            blazeAngle = effectRandom.next() * FX_TWO_PI,
            blazeRadius = effectPos.radius + effectRandom.range(0.1, 0.4)
          effectRandom.chance(0.4)
            ? fxTarget.particles.use(VFX_EMITTERS.dust).spawn(effectPos.x + Math.cos(blazeAngle) * blazeRadius, effectPos.y + 0.15, effectPos.z + Math.sin(blazeAngle) * blazeRadius, Math.sin(blazeAngle) * 1.6, effectRandom.range(0.3, 0.9), -Math.cos(blazeAngle) * 1.6, 0.5, 0.5, 1.1)
            : fxTarget.particles
                .use(VFX_EMITTERS.streak)
                .tint(STATUS_EMBER_LIGHT, CHIJIN_PALETTE.deep)
                .orbit(effectPos.x, effectPos.y + effectRandom.range(0.15, 0.8), effectPos.z, blazeRadius, blazeRadius + 0.35, blazeAngle, -11, effectRandom.range(0.2, 0.8), effectRandom.range(0.26, 0.36), 0.36, 0.16)
        }
      },
    },
    fengling_gale: {
      create(fxSource, effectState) {
        const rangeSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.range, 0.2)
        fxSource.decals.at(rangeSlot).y(0.07).params(0.035, 0).color(FENGLING_PALETTE.accent, 1.6, 0).under(VFX_COLORS.shadow, 0.25)
      },
      update(fxTarget, effectState, effectPos, effectMeta) {
        const featherCount = Math.max(1, Math.min(5, effectMeta.stacks)),
          isMaxStacks = featherCount >= 5
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius * SIGIL_RADIUS_SCALE)
          .alpha(isMaxStacks ? 0.9 : 0)
        const featherRadius = effectPos.radius + 0.5
        for (let featherIndex = 0; featherIndex < featherCount; featherIndex++) {
          const featherAngle = effectState.phase + effectState.age * (isMaxStacks ? 5.5 : 3.2) + (featherIndex * FX_TWO_PI) / featherCount
          fxTarget.sprites.icon(PARTICLE_KIND.feather, effectPos.x + Math.cos(featherAngle) * featherRadius, effectPos.y + effectPos.height * 0.42 + Math.sin(featherAngle * 2 + featherIndex) * 0.1, effectPos.z + Math.sin(featherAngle) * featherRadius, 0.52, -featherAngle - Math.PI / 2, VFX_COLORS.plume, isMaxStacks ? 1.35 : 1.15, 0.95, 0.15, 0.2)
        }
      },
    },
    fengling_crit: {
      update(fxTarget, effectState, effectPos) {
        const heroUnit = effectPos.unit,
          facingAngle = heroUnit ? heroUnit.facing : 0
        let muzzleX = effectPos.x + Math.cos(facingAngle) * 0.7,
          muzzleY = effectPos.y + effectPos.height * 0.6,
          muzzleZ = effectPos.z + Math.sin(facingAngle) * 0.7
        heroUnit && fxTarget.anchors.attach?.(heroUnit.id, "muzzle", fxTarget.v) && ((muzzleX = fxTarget.v.x + Math.cos(facingAngle) * 0.2), (muzzleY = fxTarget.v.y), (muzzleZ = fxTarget.v.z + Math.sin(facingAngle) * 0.2))
        const sparkScale = 0.6 + 0.15 * Math.sin(effectState.age * 10)
        fxTarget.sprites.icon(PARTICLE_KIND.spark, muzzleX, muzzleY, muzzleZ, sparkScale * 1.3, effectState.age * 3, FENGLING_PALETTE.accent, 1.6, 1, 0.5, 0.3)
      },
    },
    yeque_shadow: {
      create(fxSource, effectState) {
        const glowSlot = holdDecalSlot(fxSource, effectState, GROUND_FX_KINDS.glow, 0.2)
        fxSource.decals.at(glowSlot).params(1.3).color(VFX_COLORS.black, 0, 0.8).under(VFX_COLORS.ink, 0.55)
      },
      update(fxTarget, effectState, effectPos, effectMeta, frameDelta) {
        fxTarget.decals
          .at(effectState.slots[0])
          .at(effectPos.x, effectPos.z)
          .radius(effectPos.radius + 0.75)
        const pulseStrength = Math.max(sinePulse(effectState.age, 0.1), sinePulse(effectState.age, 0.5)),
          heroUnit = effectPos.unit
        if (pulseStrength > 0 && heroUnit) {
          const facingAngle = heroUnit.facing
          let shadowX = effectPos.x + Math.cos(facingAngle) * 0.4 - Math.sin(facingAngle) * 0.35,
            shadowY = effectPos.y + effectPos.height * 0.5,
            shadowZ = effectPos.z + Math.sin(facingAngle) * 0.4 + Math.cos(facingAngle) * 0.35
          ;(fxTarget.anchors.attach?.(heroUnit.id, "weapon", fxTarget.v) && ((shadowX = fxTarget.v.x), (shadowY = fxTarget.v.y), (shadowZ = fxTarget.v.z)), fxTarget.sprites.draw(PARTICLE_KIND.spark, shadowX, shadowY, shadowZ, 0.4 + pulseStrength * 0.55, 0.4, YEQUE_PALETTE_ALT.hot, 2.1, pulseStrength, 0.75, 0.45))
        }
        for (let stepIndex = accumulateSteps(fxTarget, effectState, frameDelta, 6); stepIndex > 0; stepIndex--) {
          const effectRandom = fxTarget.rnd,
            mistSize = effectRandom.range(0.08, 0.16)
          fxTarget.particles.use(VFX_EMITTERS.inkRise).spawn(effectPos.x + effectRandom.signed() * effectPos.radius, effectPos.y + effectRandom.range(0.1, 0.6), effectPos.z + effectRandom.signed() * effectPos.radius, 0, effectRandom.range(0.5, 1.1), 0, 0.6, mistSize, mistSize * 1.3)
        }
      },
    },
  },
  STATUS_FX_KEYS = Object.keys(STATUS_FX_DEFS),
  STATUS_FX_INDEX = new Map(STATUS_FX_KEYS.map((statusKey, statusIndex) => [statusKey, statusIndex]))

export { STATUS_FX_DEFS, STATUS_FX_INDEX }
