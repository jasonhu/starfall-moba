/**
 * 战斗特效模板表（原 kernel 内 Pb 对象，逐字符搬运）
 * 持续型特效：护盾环、旋风、裂隙、光环等。
 * 追加/替换：改这里，或运行时 registerVfx(name, template)。
 */
import type { VfxKit } from './types'

/**
 * 创建特效。
 *
 * @param vfxKit - 来源
 * @returns 结果对象
 */
export function buildVfxTemplates(vfxKit: VfxKit): Record<string, unknown> {
  // 内核传入的属性名在内核侧已语义化（GROUND_FX_KINDS / FX_SHAPES / …），
  // 而本文件内部沿用搬迁时的短名。对象解构按「属性名」匹配，所以这里必须写成别名，
  // 否则拿到 undefined（历史事故：AreaEffectView 读 Xt.telegraph / qe.shield 崩溃）。
  const {
    _r: teamRingColors,
    Gd: holdZoneDecalSlot,
    GROUND_FX_KINDS: groundFxKinds,
    ad: drawZoneDecal,
    yc: panyueAreaPalette,
    FX_SHAPES: fxShapes,
    FX_STYLES: fxStyles,
    od: updateZoneDecalRadii,
    oe: twoPi,
    xc: consumeEmissionBudget,
    VFX_EMITTERS: vfxEmitters,
    bn: emitGroundImpact,
    Ha: emitDustPuff,
    VFX_COLORS: vfxColors,
    rd: chijinVfxPalette,
    EP: areaGlowTintColor,
    TP: areaSparkTintColor,
    Zr: xingliAreaPalette,
    PARTICLE_KIND: particleKind,
    B1: emitGoosePlume,
    Ku: fenglingVfxPalette,
  } = vfxKit as any

  // 依赖完整性闸门：缺任何一个都只会在运行时以「Cannot read properties of undefined」炸掉，
  // 现场极难定位。这里启动即明确报出缺哪个 key。
  const REQUIRED = [
    '_r', 'Gd', 'GROUND_FX_KINDS', 'ad', 'yc', 'FX_SHAPES', 'FX_STYLES',
    'od', 'oe', 'xc', 'VFX_EMITTERS', 'bn', 'Ha', 'VFX_COLORS',
    'rd', 'EP', 'TP', 'Zr', 'PARTICLE_KIND', 'B1', 'Ku',
  ]
  const missing = REQUIRED.filter((requiredKey) => (vfxKit as any)[requiredKey] === undefined)
  if (missing.length) {
    console.error('[vfx] buildVfxTemplates 缺少依赖（key 不匹配或未导出）:', missing.join(', '))
  }

  return {
    telegraph: {
      create(fxSystem, unit) {
        const teamRingColor = unit.team === 2 ? teamRingColors.monster : unit.hostile ? teamRingColors.enemy : unit.mine ? teamRingColors.mine : teamRingColors.ally,
          telegraphDecalSlot = holdZoneDecalSlot(fxSystem, unit, groundFxKinds.telegraph, 0.06),
          isHostile = unit.hostile || unit.team === 2
        fxSystem.decals
          .at(telegraphDecalSlot)
          .y(0.09)
          .color(teamRingColor.edge, isHostile ? 1.7 : 1.4, isHostile ? 0.95 : 0.8)
          .under(teamRingColor.under, 0.6)
          .xray()
      },
      update(fxSystem, position) {
        fxSystem.decals.at(position.slots[0]).at(position.x, position.z).radius(position.radius).params(position.t)
      },
    },
    panyue_s2_aura: {
      create(fxSystem, zoneView) {
        drawZoneDecal(fxSystem, zoneView, 0, 0, panyueAreaPalette.dark)
        for (let index = 0; index < 3; index++) {
          const shieldGlow = fxSystem.glow.hold(fxShapes.shield, fxStyles.plate)
          ;(shieldGlow.color(panyueAreaPalette.hot, 1.15, 0), (shieldGlow.add = 0.25), (shieldGlow.k = 0.16), zoneView.meshes.push(shieldGlow))
        }
      },
      update(fxSystem, zoneView, deltaTime) {
        updateZoneDecalRadii(fxSystem, zoneView)
        const count = zoneView.meshes.length,
          growInFactor = Math.min(1, zoneView.age * 5),
          fadeOutFactor = Math.max(0, Math.min(1, (zoneView.duration - zoneView.age) * 4))
        for (let index = 0; index < count; index++) {
          const orbitAngle = zoneView.phase + zoneView.age * 1.1 + (index * twoPi) / count,
            selectedMeshes = zoneView.meshes[index]
          ;(selectedMeshes
            .at(zoneView.x + Math.cos(orbitAngle) * 2.05, 0.08, zoneView.z + Math.sin(orbitAngle) * 2.05)
            .scale(1.75 * growInFactor)
            .rot(0, -orbitAngle, 0.05),
            (selectedMeshes.a = 0.85 * fadeOutFactor),
            (selectedMeshes.progress = (zoneView.age * 0.62 + index / count) % 1))
        }
        for (let xcIndex = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 6); xcIndex > 0; xcIndex--) {
          const scatterAngle = fxSystem.rnd.next() * twoPi,
            dustScatterRadius = zoneView.radius * fxSystem.rnd.range(0.55, 1)
          fxSystem.particles.use(vfxEmitters.dust).spawn(zoneView.x + Math.cos(scatterAngle) * dustScatterRadius, 0.15, zoneView.z + Math.sin(scatterAngle) * dustScatterRadius, -Math.cos(scatterAngle) * 1.4, 0.4, -Math.sin(scatterAngle) * 1.4, 0.7, 0.5, 0.9)
        }
      },
      end(ribbon, zoneView) {
        ;(emitGroundImpact(ribbon, zoneView.x, zoneView.z, zoneView.radius * 0.5, 0.35, panyueAreaPalette.glow, 1.1, 0.5, 0.2), emitDustPuff(ribbon, zoneView.x, zoneView.z, 5, 1.4, 2.5, vfxColors.dust, vfxColors.dustDark, 1, 0.6))
      },
    },
    panyue_ult_fissure: {
      create(fxSystem, zoneView) {
        drawZoneDecal(fxSystem, zoneView, 0, 1, panyueAreaPalette.dark)
      },
      update(fxSystem, zoneView, deltaTime) {
        updateZoneDecalRadii(fxSystem, zoneView)
        for (let remainingParticles = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 12); remainingParticles > 0; remainingParticles--) {
          const random = fxSystem.rnd,
            scatterAngle = random.next() * twoPi,
            scatterRadius = zoneView.radius * Math.sqrt(random.next()) * 0.95,
            spawnX = zoneView.x + Math.cos(scatterAngle) * scatterRadius,
            spawnZ = zoneView.z + Math.sin(scatterAngle) * scatterRadius,
            particleTypeRoll = random.next()
          if (particleTypeRoll < 0.55) fxSystem.particles.use(vfxEmitters.dust).spawn(spawnX, 0.1, spawnZ, 0, random.range(0.5, 1.2), 0, 0.9, 0.5, 1.2)
          else if (particleTypeRoll < 0.88) {
            const debrisSize = random.range(0.12, 0.22)
            fxSystem.particles
              .use(vfxEmitters.debris)
              .tint(vfxColors.earth, vfxColors.earthDark)
              .spawn(spawnX, 0.1, spawnZ, random.signed() * 0.6, random.range(2.2, 4), random.signed() * 0.6, 0.6, debrisSize, debrisSize * 0.8)
          } else
            fxSystem.particles
              .use(vfxEmitters.ember)
              .tint(panyueAreaPalette.hot, panyueAreaPalette.deep)
              .spawn(spawnX, 0.1, spawnZ, random.signed() * 0.3, random.range(0.8, 1.8), random.signed() * 0.3, random.range(0.5, 0.8), 0.13, 0.04)
        }
      },
    },
    chijin_ult_spin: {
      create(fxSystem, zoneView) {
        drawZoneDecal(fxSystem, zoneView, 0, 2, chijinVfxPalette.dark)
        const vortexCoreGlow = fxSystem.glow.hold(fxShapes.cone, fxStyles.vortex)
        ;(vortexCoreGlow.color(areaGlowTintColor, 0.9, 0), (vortexCoreGlow.add = 0.3), (vortexCoreGlow.k = 4), (vortexCoreGlow.progress = 0.3), zoneView.meshes.push(vortexCoreGlow))
        for (let slashIndex = 0; slashIndex < 2; slashIndex++) {
          const slashGlow = fxSystem.glow.hold(fxShapes.slash, fxStyles.slash)
          ;(slashGlow.color(slashIndex === 0 ? chijinVfxPalette.glow : chijinVfxPalette.accent, 1.25, 0), (slashGlow.add = 0.2), (slashGlow.k = 0.62), (slashGlow.progress = -2), zoneView.meshes.push(slashGlow))
        }
      },
      update(fxSystem, zoneView, deltaTime) {
        updateZoneDecalRadii(fxSystem, zoneView)
        const spinGrowFactor = Math.min(1, zoneView.age * 4),
          spinFadeFactor = Math.max(0, Math.min(1, (zoneView.duration - zoneView.age) * 3)),
          coreScale = zoneView.radius * 0.55 * spinGrowFactor,
          coreMesh = zoneView.meshes[0]
        ;(coreMesh
          .at(zoneView.x, 0.05, zoneView.z)
          .scale3(coreScale, 2.1 * spinGrowFactor, coreScale)
          .rot(0, zoneView.age * 7, 0),
          (coreMesh.a = (fxSystem.lowQ ? 0.2 : 0.4) * spinFadeFactor))
        for (let meshIndex = 1; meshIndex < zoneView.meshes.length; meshIndex++) {
          const slashMesh = zoneView.meshes[meshIndex],
            slashScale = zoneView.radius * 0.94 * (0.4 + 0.6 * spinGrowFactor)
          ;(slashMesh
            .at(zoneView.x, 0.85 + (meshIndex - 1) * 0.45, zoneView.z)
            .scale(slashScale)
            .rot(meshIndex === 1 ? 0.1 : -0.1, zoneView.phase + zoneView.age * 12 + meshIndex * Math.PI, 0),
            (slashMesh.a = 0.55 * spinFadeFactor))
        }
        for (let remainingParticles = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 22); remainingParticles > 0; remainingParticles--) {
          const random = fxSystem.rnd,
            scatterAngle = random.next() * twoPi
          random.chance(0.6)
            ? fxSystem.particles
                .use(vfxEmitters.dust)
                .tint(vfxColors.sand, vfxColors.dustDark)
                .orbit(zoneView.x, random.range(0.15, 0.6), zoneView.z, zoneView.radius * random.range(0.45, 0.7), zoneView.radius * random.range(0.9, 1.05), scatterAngle, -5, random.range(0.3, 1), random.range(0.4, 0.6), 0.5, 1)
            : fxSystem.particles
                .use(vfxEmitters.spark)
                .tint(areaSparkTintColor, chijinVfxPalette.deep)
                .orbit(zoneView.x, random.range(0.4, 1.4), zoneView.z, zoneView.radius * random.range(0.7, 0.9), zoneView.radius * random.range(0.95, 1.1), scatterAngle, -9, random.range(0.5, 2), random.range(0.16, 0.24), 0.1, 0.03)
        }
      },
      end(fxSystem, zoneView) {
        ;(emitGroundImpact(fxSystem, zoneView.x, zoneView.z, zoneView.radius, 0.4, chijinVfxPalette.glow, 1.3, 0.5, 0.25), emitDustPuff(fxSystem, zoneView.x, zoneView.z, 8, zoneView.radius * 0.5, 3, vfxColors.sand, vfxColors.dustDark, 1.1, 0.6))
      },
    },
    xingli_s2_well: {
      create(fxSystem, zoneView) {
        const swirlDecalSlot = holdZoneDecalSlot(fxSystem, zoneView, groundFxKinds.swirl, 0.08)
        fxSystem.decals.at(swirlDecalSlot).params(2, -3).color(xingliAreaPalette.glow, 1.2, 0.55).under(xingliAreaPalette.dark, 0.14)
        const hoopGlow = fxSystem.glow.hold(fxShapes.hoop, fxStyles.hoop)
        ;(hoopGlow.color(xingliAreaPalette.glow, 1.2, 0.85), (hoopGlow.add = 0.3), zoneView.meshes.push(hoopGlow))
      },
      update(fxSystem, zoneView, deltaTime) {
        const shrinkFactor = 1 - 0.72 * zoneView.t * zoneView.t
        fxSystem.decals.at(zoneView.slots[0]).at(zoneView.x, zoneView.z).radius(zoneView.radius)
        const hoopMesh = zoneView.meshes[0]
        ;(hoopMesh.at(zoneView.x, 0.7 + zoneView.t * 0.6, zoneView.z).scale(zoneView.radius * shrinkFactor), hoopMesh.rot(0, zoneView.age * 3, 0))
        for (let spriteIndex = 0; spriteIndex < 4; spriteIndex++) {
          const spriteAngle = zoneView.phase + zoneView.age * (4 + zoneView.t * 6) + (spriteIndex * twoPi) / 4,
            spriteX = zoneView.x + Math.cos(spriteAngle) * zoneView.radius * shrinkFactor,
            spriteZ = zoneView.z + Math.sin(spriteAngle) * zoneView.radius * shrinkFactor
          fxSystem.sprites.draw(particleKind.glow, spriteX, 0.75 + zoneView.t * 0.6, spriteZ, 0.62, 0, xingliAreaPalette.accent, 2.1, 1, 0.7)
        }
        for (let remainingParticles = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 26); remainingParticles > 0; remainingParticles--) {
          const random = fxSystem.rnd
          fxSystem.particles.use(vfxEmitters.mote).orbit(zoneView.x, random.range(0.1, 0.9), zoneView.z, zoneView.radius * random.range(0.7, 1.05), zoneView.radius * 0.15, random.next() * twoPi, 5, 0.6, 0.3, 0.2, 0.06)
        }
      },
    },
    xingli_ult_storm: {
      create(fxSystem, zoneView) {
        drawZoneDecal(fxSystem, zoneView, -9, 0, xingliAreaPalette.dark)
        const moonDecalSlot = holdZoneDecalSlot(fxSystem, zoneView, groundFxKinds.moon, 0.3)
        fxSystem.decals.at(moonDecalSlot).params(0.74, 0.6).color(xingliAreaPalette.hot, 1, 0.4).under(xingliAreaPalette.dark, 0.1)
      },
      update(fxSystem, zoneView, deltaTime) {
        updateZoneDecalRadii(fxSystem, zoneView, (slotIndex) => (slotIndex === 1 ? 0.5 : 1))
        for (let remainingParticles = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 7); remainingParticles > 0; remainingParticles--) {
          const random = fxSystem.rnd,
            scatterAngle = random.next() * twoPi,
            scatterRadius = zoneView.radius * Math.sqrt(random.next()) * 0.9,
            spawnX = zoneView.x + Math.cos(scatterAngle) * scatterRadius,
            spawnZ = zoneView.z + Math.sin(scatterAngle) * scatterRadius
          if (random.chance(0.5)) {
            const plumeFallDuration = random.range(0.5, 0.65)
            emitGoosePlume(fxSystem, spawnX + 3.2, 4.6, spawnZ - 2.4, -6.4 / plumeFallDuration, -3.4 / plumeFallDuration, 4.8 / plumeFallDuration, plumeFallDuration, 0.9, 1.05)
          } else fxSystem.particles.use(vfxEmitters.plume).spawn(spawnX, random.range(1.5, 3), spawnZ, random.signed() * 0.5, -0.4, random.signed() * 0.5, random.range(0.9, 1.3), 0.34, 0.28)
        }
      },
      end(fxSystem, zoneView) {
        emitGroundImpact(fxSystem, zoneView.x, zoneView.z, zoneView.radius, 0.5, xingliAreaPalette.glow, 1.1, 0.85, 0.2)
      },
    },
    fengling_ult_rain: {
      create(fxSystem, zoneView) {
        drawZoneDecal(fxSystem, zoneView, 30, 0, fenglingVfxPalette.dark)
        const glowDecalSlot = holdZoneDecalSlot(fxSystem, zoneView, groundFxKinds.glow, 0.25)
        fxSystem.decals.at(glowDecalSlot).params(0.6).color(vfxColors.black, 0, 0.32).under(fenglingVfxPalette.dark, 0.05)
      },
      update(fxSystem, zoneView, deltaTime) {
        updateZoneDecalRadii(fxSystem, zoneView)
        for (let remainingParticles = consumeEmissionBudget(fxSystem, zoneView, deltaTime, 10); remainingParticles > 0; remainingParticles--) {
          const random = fxSystem.rnd,
            scatterAngle = random.next() * twoPi,
            scatterRadius = zoneView.radius * Math.sqrt(random.next()) * 0.95,
            spawnX = zoneView.x + Math.cos(scatterAngle) * scatterRadius,
            spawnZ = zoneView.z + Math.sin(scatterAngle) * scatterRadius,
            fallDuration = random.range(0.16, 0.22)
          ;(fxSystem.particles
            .use(vfxEmitters.arrow)
            .tint(vfxColors.plume, fenglingVfxPalette.hot)
            .spawn(spawnX + 1.4, 10, spawnZ + 0.9, -1.4 / fallDuration, -10 / fallDuration, -0.9 / fallDuration, fallDuration, 0.5, 0.45),
            fxSystem.particles.use(vfxEmitters.dust).spawn(spawnX, 0.12, spawnZ, 0, random.range(0.4, 0.9), 0, 0.32, 0.26, 0.6, fallDuration))
        }
      },
      end(fxSystem, zoneView) {
        emitGroundImpact(fxSystem, zoneView.x, zoneView.z, zoneView.radius, 0.5, fenglingVfxPalette.glow, 1, 0.85, 0.2)
      },
    },
    fountain_zone: { create() {}, update() {} },
  }
}
