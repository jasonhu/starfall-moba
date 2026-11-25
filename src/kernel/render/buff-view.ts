/**
 * 单位 buff 视图与网格构建器（MeshBuilder / CellGeometryBuilder）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Mesh, Uint16BufferAttribute, Uint32BufferAttribute } from 'three'
import { STATUS_FX_DEFS, STATUS_FX_INDEX } from './status-effect-fx'
import { HERO_VFX_PALETTES, FX_TWO_PI } from '../fx/fx-definitions'
import { PARTICLE_KIND } from '../particle-atlas'
import { ALL_UNIT_VFX, UnitVisualView, STATUS_GOLD_AMBER } from './unit-visual-effects'
import { VfxSystem } from '../fx/vfx-system'
import { AimIndicator, AreaEffectView, emitDrakeBreathAftermath } from '../fx/emitters'
import { playTeamUltBuffFx, UnitShadowView, playMonsterDeathBurst } from './unit-views'
import { HERO_TABLE } from '../../heroes/registry'
import { emitMeleeSlashFx, playHeroDeathFx, playMinionDeathFx } from './unit-skill-fx'
import { MONSTER_STATS } from '../game-balance'
import { BUCKET_HIGH, BUCKET_LOW, BUCKET_MAX, BUCKET_MIN, SIGN_NEGATIVE, clamp01Scalar, scratchMat3, scratchVecA, scratchVecB } from '../fx/particle-system'

class UnitBuffView {
  views = new Map()
  list = []
  k
  stamp = 0
  phaseN = 0
  constructor(vfxSystem) {
    this.k = vfxSystem
  }
  release(decal) {
    const kindValue = this.k
    decal.def.end?.(kindValue, decal)
    for (const slot of decal.slots) kindValue.decals.release(slot, 0.2)
    for (const mesh of decal.meshes) kindValue.glow.release(mesh)
    ;((decal.slots.length = 0), (decal.meshes.length = 0))
  }
  update(world) {
    const kValue = this.k,
      currentStamp = ++this.stamp,
      deltaTime = world.dt
    for (const unit of world.state.units) {
      if (unit.buffs.length === 0 || !unit.alive || (unit.team !== world.playerTeam && !unit.visible[world.playerTeam])) continue
      let isActive = !1
      for (const buff of unit.buffs) {
        const Value = STATUS_FX_INDEX.get(buff.id)
        if (Value === void 0) continue
        const lookupKey = unit.id * 64 + Value
        let getValue = this.views.get(lookupKey)
        if (getValue && getValue.seen === currentStamp) continue
        if (!isActive) {
          if (!kValue.anchors.get(unit.id, kValue.a)) break
          isActive = !0
        }
        const pickStrongestBuffResult = pickStrongestBuff(unit.buffs, buff.id)
        ;(getValue ||
          ((this.phaseN = (this.phaseN + 2.399) % FX_TWO_PI),
          (getValue = { key: lookupKey, def: STATUS_FX_DEFS[buff.id], seen: currentStamp, slots: [], meshes: [], acc: 0, age: 0, phase: this.phaseN }),
          this.views.set(lookupKey, getValue),
          this.list.push(getValue),
          getValue.def.create?.(kValue, getValue, kValue.a, pickStrongestBuffResult)),
          (getValue.seen = currentStamp),
          (getValue.age += deltaTime),
          getValue.def.update(kValue, getValue, kValue.a, pickStrongestBuffResult, deltaTime))
      }
    }
    this.blessedMinions(world)
    const listState = this.list
    for (let index = listState.length - 1; index >= 0; index--) {
      const selectedA = listState[index]
      selectedA.seen !== currentStamp && (this.release(selectedA), this.views.delete(selectedA.key), (listState[index] = listState[listState.length - 1]), listState.pop())
    }
  }
  /**
   * 处理小兵。
   *
   * @param world - 战场
  */
  blessedMinions(world) {
    const kindResult = this.k,
      teams = world.state.teams
    if (!(teams[0].blessingLeft > 0) && !(teams[1].blessingLeft > 0)) return
    const playerTeam = world.playerTeam
    for (const minion of world.state.units) {
      if (minion.kind !== "minion" || !minion.alive || (minion.team !== 0 && minion.team !== 1)) continue
      const blessingLeft = teams[minion.team].blessingLeft
      if (!(blessingLeft > 0) || (minion.team !== playerTeam && !minion.visible[playerTeam]) || kindResult.focusDist(minion.pos.x, minion.pos.y) > 30 || !kindResult.anchors.get(minion.id, kindResult.a)) continue
      const iconOpacity = blessingLeft < 5 ? 0.55 + 0.45 * Math.cos(kindResult.now * 9) : 1
      kindResult.sprites.icon(PARTICLE_KIND.star8, kindResult.a.x, kindResult.a.y + kindResult.a.height + 0.35 + Math.sin(kindResult.now * 3 + minion.id) * 0.06, kindResult.a.z, 0.36, kindResult.now * 0.8, STATUS_GOLD_AMBER, 1.25, 0.9 * iconOpacity, 0.15, 0.1)
    }
  }
  get count() {
    return this.views.size
  }
  reset() {
    for (const buffView of this.list) this.release(buffView)
    ;((this.list.length = 0), this.views.clear())
  }
}

/**
 * 查找状态效果。
 *
 * @param buffs - 输入
 * @param buffId - 次要输入
 */
function pickStrongestBuff(buffs, buffId) {
  let result = null
  for (const buff of buffs) buff.id === buffId && (!result || buff.value > result.value || (buff.value === result.value && buff.stacks > result.stacks)) && (result = buff)
  return result
}

const FOCUS_DISTANCE = 46

function createVisualKit(gameContext) {
  const vfxSystem = new VfxSystem(gameContext),
    unitVisualView = new UnitVisualView(vfxSystem),
    areaEffectView = new AreaEffectView(vfxSystem),
    unitBuffView = new UnitBuffView(vfxSystem),
    aimIndicator = new AimIndicator(vfxSystem),
    stateConfig = { state: gameContext.frame.state, playerId: gameContext.frame.state.playerId, playerTeam: gameContext.frame.playerTeam },
    unitShadowView = new UnitShadowView(vfxSystem),
    particlesSpawnedConfig = { particlesSpawned: 0, particleCapacity: 0, decals: 0, projectiles: 0, areas: 0, statuses: 0, drawCalls: 0, particlesLive: 0 },
    slashCountByHero = new Map()
  let deathGradeActive = !1,
    desaturation = 0
  const updateDesaturation = (world) => {
      if (!deathGradeActive && desaturation === 0) return
      let playerHeroDead = !1
      for (const hero of world.state.heroes) hero.id === world.state.playerId && (playerHeroDead = !hero.alive)
      const targetDesaturation = deathGradeActive && playerHeroDead ? 0.82 : 0
      if (desaturation === targetDesaturation) return
      const interpStep = world.dt * (targetDesaturation > desaturation ? 1.6 : 3)
      ;((desaturation = Math.abs(targetDesaturation - desaturation) <= interpStep ? targetDesaturation : desaturation + Math.sign(targetDesaturation - desaturation) * interpStep), (gameContext.grade.desaturate = desaturation))
    },
    syncStateConfig = (plaza) => {
      ;((stateConfig.state = plaza), (stateConfig.playerId = plaza.playerId))
      let playerTeam = 0
      for (const hero of plaza.heroes) hero.id === plaza.playerId && (playerTeam = hero.team)
      stateConfig.playerTeam = playerTeam
    },
    isEventVisible = (fxEvent) => {
      if (fxEvent.targetId !== void 0 && fxEvent.key.startsWith("hit_") && vfxSystem.anchor(fxEvent.targetId)) {
        const targetUnit = vfxSystem.a.unit
        if (targetUnit && targetUnit.team !== stateConfig.playerTeam && targetUnit.team !== 2 && targetUnit.id !== stateConfig.playerId && !targetUnit.visible[stateConfig.playerTeam]) return !1
      }
      return fxEvent.team === stateConfig.playerTeam || (vfxSystem.anchor(fxEvent.unitId) && vfxSystem.a.visible) || (vfxSystem.anchor(fxEvent.targetId) && vfxSystem.a.visible) || vfxSystem.anchors.pointVisible(fxEvent.pos.x, fxEvent.pos.y)
        ? !0
        : fxEvent.to !== void 0 && vfxSystem.anchors.pointVisible(fxEvent.to.x, fxEvent.to.y)
    },
    playUnitVfx = (label) => {
      const selectedALL_UNIT_VFX = ALL_UNIT_VFX[label.key]
      selectedALL_UNIT_VFX && selectedALL_UNIT_VFX(vfxSystem, label, stateConfig)
    },
    handleGameEvent = (gameEvent, world) => {
      switch (gameEvent.type) {
        case "fx":
          if ((vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) > FOCUS_DISTANCE && !(gameEvent.to && vfxSystem.focusDist(gameEvent.to.x, gameEvent.to.y) <= FOCUS_DISTANCE)) || !isEventVisible(gameEvent)) return
          playUnitVfx(gameEvent)
          break
        case "projectileHit":
        case "projectileEnd":
          if (vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) > FOCUS_DISTANCE) return
          unitVisualView.handle(gameEvent, stateConfig.playerId, stateConfig.playerTeam)
          break
        case "attack": {
          if (!vfxSystem.anchor(gameEvent.unitId) || !vfxSystem.a.visible) return
          const attackingHero = vfxSystem.a.unit
          if (!attackingHero || attackingHero.kind !== "hero" || HERO_TABLE[attackingHero.heroId].attackType !== "melee" || vfxSystem.focusDist(vfxSystem.a.x, vfxSystem.a.z) > FOCUS_DISTANCE) return
          const heroPalette = HERO_VFX_PALETTES[attackingHero.heroId] || HERO_VFX_PALETTES.chijin,
            lookupKey = attackingHero.id,
            slashCount = (slashCountByHero.get(lookupKey) ?? 0) + 1
          slashCountByHero.set(lookupKey, slashCount)
          const meleeSlashDelay = Math.max(0.03, (attackingHero.animDur > 0 ? attackingHero.animDur : 0.5) * HERO_TABLE[attackingHero.heroId].basicAttack.windup - 0.05)
          vfxSystem.after(meleeSlashDelay, () => {
            if (!vfxSystem.anchor(lookupKey) || !vfxSystem.a.unit || !vfxSystem.a.unit.alive || vfxSystem.a.unit.anim !== "attack") return
            const facing = vfxSystem.a.unit.facing
            emitMeleeSlashFx(vfxSystem, vfxSystem.a.x + Math.cos(facing) * 0.3, vfxSystem.a.y + vfxSystem.a.height * 0.5, vfxSystem.a.z + Math.sin(facing) * 0.3, facing, heroPalette.glow, heroPalette.deep, attackingHero.stats.attackRange * 0.72 + 0.3, slashCount)
          })
          break
        }
        case "death": {
          if (vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) > FOCUS_DISTANCE || (gameEvent.team !== stateConfig.playerTeam && !vfxSystem.anchors.pointVisible(gameEvent.pos.x, gameEvent.pos.y))) return
          gameEvent.kind === "hero" ? playHeroDeathFx(vfxSystem, gameEvent.pos.x, gameEvent.pos.y, gameEvent.team, gameEvent.unitId === stateConfig.playerId || gameEvent.killerId === stateConfig.playerId) : gameEvent.kind === "minion" && playMinionDeathFx(vfxSystem, gameEvent.pos.x, gameEvent.pos.y, gameEvent.team)
          break
        }
        case "monsterSpawn":
          if (world.time < 1 || vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) > FOCUS_DISTANCE) return
          playMonsterDeathBurst(vfxSystem, gameEvent.pos.x, gameEvent.pos.y, gameEvent.monsterType)
          break
        case "epicSlain":
          if (vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) > FOCUS_DISTANCE + (MONSTER_STATS[gameEvent.monsterType].epic ? 20 : 0)) return
          playTeamUltBuffFx(vfxSystem, gameEvent.pos.x, gameEvent.pos.y, gameEvent.team, gameEvent.monsterType, world)
          break
        case "damage":
          if (gameEvent.dtype === "magic" && vfxSystem.focusDist(gameEvent.pos.x, gameEvent.pos.y) <= FOCUS_DISTANCE) {
            const unitResult = vfxSystem.anchors.unit(gameEvent.sourceId)
            unitResult && unitResult.kind === "monster" && unitResult.monsterType === "abyss_drake" && emitDrakeBreathAftermath(vfxSystem, gameEvent.sourceId, gameEvent.targetId)
          }
          break
      }
    },
    countVisibleMeshes = () => {
      let visibleMeshCount = 0
      return (
        gameContext.layers.fx.traverse((node) => {
          const mesh = node
          mesh.isMesh && mesh.visible && (!mesh.parent || mesh.parent.visible) && visibleMeshCount++
        }),
        visibleMeshCount
      )
    }
  return {
    name: "fx",
    kit: vfxSystem,
    update(world) {
      ;(syncStateConfig(world.state), vfxSystem.begin(world), unitVisualView.update(world), areaEffectView.update(world), unitBuffView.update(world), unitShadowView.update(world), aimIndicator.update(world), updateDesaturation(world), vfxSystem.flush(world))
    },
    handleEvents(events, world) {
      syncStateConfig(world)
      for (const event of events) handleGameEvent(event, world)
    },
    setAim(lookupKey) {
      aimIndicator.set(lookupKey)
    },
    setQuality(targetObject) {
      vfxSystem.setQuality(targetObject)
    },
    setAnchors(anchors) {
      vfxSystem.anchors = anchors
    },
    setDeathGrade(active) {
      deathGradeActive = active
    },
    playFx(fxEvent, world) {
      ;(syncStateConfig(world), playUnitVfx(fxEvent))
    },
    reset() {
      ;(unitVisualView.reset(), areaEffectView.reset(), unitBuffView.reset(), unitShadowView.reset(), aimIndicator.reset(), slashCountByHero.clear(), vfxSystem.clear())
    },
    getStats() {
      return (
        (particlesSpawnedConfig.particlesSpawned = vfxSystem.particles.spawned),
        (particlesSpawnedConfig.particleCapacity = vfxSystem.particles.capacity),
        (particlesSpawnedConfig.decals = vfxSystem.decals.activeCount),
        (particlesSpawnedConfig.projectiles = unitVisualView.count),
        (particlesSpawnedConfig.areas = areaEffectView.count),
        (particlesSpawnedConfig.statuses = unitBuffView.count),
        (particlesSpawnedConfig.drawCalls = countVisibleMeshes()),
        (particlesSpawnedConfig.particlesLive = vfxSystem.particles.liveCount()),
        particlesSpawnedConfig
      )
    },
    dispose() {
      ;(desaturation > 0 && (gameContext.grade.desaturate = 0), unitVisualView.reset(), areaEffectView.reset(), unitBuffView.reset(), aimIndicator.reset(), vfxSystem.dispose())
    },
  }
}

class MeshBuilder {
  positions = []
  normals = []
  colors = []
  fx = []
  indices = []
  rankRuns = []
  rank = BUCKET_MIN
  setRank(rank) {
    rank !== this.rank && ((this.rank = rank), this.rankRuns.push(this.indices.length, rank))
  }
  get vertexCount() {
    return this.positions.length / 3
  }
  get triangleCount() {
    return this.indices.length / 3
  }
  vertex(x, y, z, color, normalX = 0, normalY = 1, normalZ = 0, fxX = 0, fxY = 0, fxZ = 0, fxW = 1) {
    const vertexIndex = this.positions.length / 3
    return (this.positions.push(x, y, z), this.normals.push(normalX, normalY, normalZ), this.colors.push(color[0], color[1], color[2]), this.fx.push(fxX, fxY, fxZ, fxW), vertexIndex)
  }
  tri(indexA, indexB, indexC) {
    this.indices.push(indexA, indexB, indexC)
  }
  quad(indexA, indexB, indexC, indexD) {
    this.indices.push(indexA, indexB, indexC, indexA, indexC, indexD)
  }
  append(element, transformMatrix, tint, glow = 1, sway = 1, maskedTint = !1) {
    const positionAttribute = element.attributes.position,
      normalAttribute = element.attributes.normal,
      colorAttribute = element.attributes.color,
      fxAttribute = element.attributes.aFx,
      baseVertexIndex = this.positions.length / 3
    scratchMat3.getNormalMatrix(transformMatrix)
    for (let index = 0; index < positionAttribute.count; index++) {
      ;(scratchVecA.fromBufferAttribute(positionAttribute, index).applyMatrix4(transformMatrix),
        this.positions.push(scratchVecA.x, scratchVecA.y, scratchVecA.z),
        normalAttribute ? scratchVecB.fromBufferAttribute(normalAttribute, index).applyMatrix3(scratchMat3).normalize() : scratchVecB.set(0, 1, 0),
        this.normals.push(scratchVecB.x, scratchVecB.y, scratchVecB.z))
      const red = colorAttribute ? colorAttribute.getX(index) : 1,
        green = colorAttribute ? colorAttribute.getY(index) : 1,
        blue = colorAttribute ? colorAttribute.getZ(index) : 1,
        tintIntensity = maskedTint ? (fxAttribute ? fxAttribute.getZ(index) : 0) : 1
      ;(tint && tintIntensity > 0 ? this.colors.push(red * (1 + (tint[0] - 1) * tintIntensity), green * (1 + (tint[1] - 1) * tintIntensity), blue * (1 + (tint[2] - 1) * tintIntensity)) : this.colors.push(red, green, blue),
        fxAttribute ? this.fx.push(fxAttribute.getX(index) * sway, fxAttribute.getY(index) * glow, 0, fxAttribute.getW(index)) : this.fx.push(0, 0, 0, 1))
    }
    const indexAttribute = element.index
    if (indexAttribute) for (let indexCursor = 0; indexCursor < indexAttribute.count; indexCursor++) this.indices.push(baseVertexIndex + indexAttribute.getX(indexCursor))
    else for (let vertexIndex = 0; vertexIndex < positionAttribute.count; vertexIndex++) this.indices.push(baseVertexIndex + vertexIndex)
  }
  computeNormals(smoothingAngle = 180) {
    const positions = this.positions,
      indices = this.indices,
      triangleCount = indices.length / 3,
      float32Array = new Float32Array(triangleCount * 3),
      unitFaceNormals = new Float32Array(triangleCount * 3)
    for (let total = 0; total < triangleCount; total++) {
      const lookupKey = indices[total * 3] * 3,
        vertexBOffset = indices[total * 3 + 1] * 3,
        vertexCOffset = indices[total * 3 + 2] * 3,
        edgeABX = positions[vertexBOffset] - positions[lookupKey],
        edgeABY = positions[vertexBOffset + 1] - positions[lookupKey + 1],
        edgeABZ = positions[vertexBOffset + 2] - positions[lookupKey + 2],
        edgeACX = positions[vertexCOffset] - positions[lookupKey],
        edgeACY = positions[vertexCOffset + 1] - positions[lookupKey + 1],
        edgeACZ = positions[vertexCOffset + 2] - positions[lookupKey + 2],
        normalX = edgeABY * edgeACZ - edgeABZ * edgeACY,
        normalY = edgeABZ * edgeACX - edgeABX * edgeACZ,
        normalZ = edgeABX * edgeACY - edgeABY * edgeACX,
        distance = Math.hypot(normalX, normalY, normalZ) || 1
      ;((float32Array[total * 3] = normalX), (float32Array[total * 3 + 1] = normalY), (float32Array[total * 3 + 2] = normalZ), (unitFaceNormals[total * 3] = normalX / distance), (unitFaceNormals[total * 3 + 1] = normalY / distance), (unitFaceNormals[total * 3 + 2] = normalZ / distance))
    }
    const normals = this.normals
    if (smoothingAngle >= 180) {
      normals.fill(0)
      for (let accumTriangle = 0; accumTriangle < triangleCount; accumTriangle++)
        for (let accumCorner = 0; accumCorner < 3; accumCorner++) {
          const accumVertexOffset = indices[accumTriangle * 3 + accumCorner] * 3
          ;((normals[accumVertexOffset] += float32Array[accumTriangle * 3]), (normals[accumVertexOffset + 1] += float32Array[accumTriangle * 3 + 1]), (normals[accumVertexOffset + 2] += float32Array[accumTriangle * 3 + 2]))
        }
      for (let normalIndex = 0; normalIndex < normals.length; normalIndex += 3) {
        const normalLength = Math.hypot(normals[normalIndex], normals[normalIndex + 1], normals[normalIndex + 2]) || 1
        ;((normals[normalIndex] /= normalLength), (normals[normalIndex + 1] /= normalLength), (normals[normalIndex + 2] /= normalLength))
      }
      return
    }
    const vertexCount = positions.length / 3,
      uint32Array = new Uint32Array(vertexCount),
      map = new Map()
    let uniqueVertexCount = 0
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const positionKey = `${Math.round(positions[vertexIndex * 3] * 500)},${Math.round(positions[vertexIndex * 3 + 1] * 500)},${Math.round(positions[vertexIndex * 3 + 2] * 500)}`
      let Result = map.get(positionKey)
      ;(Result === void 0 && ((Result = uniqueVertexCount++), map.set(positionKey, Result)), (uint32Array[vertexIndex] = Result))
    }
    const bucketOffsets = new Uint32Array(uniqueVertexCount + 1)
    for (let countIndex = 0; countIndex < indices.length; countIndex++) bucketOffsets[uint32Array[indices[countIndex]] + 1]++
    for (let bucketIndex = 0; bucketIndex < uniqueVertexCount; bucketIndex++) bucketOffsets[bucketIndex + 1] += bucketOffsets[bucketIndex]
    const bucketWriteCursors = bucketOffsets.slice(0, uniqueVertexCount),
      sortedIndices = new Uint32Array(indices.length)
    for (let sortTriangle = 0; sortTriangle < triangleCount; sortTriangle++) for (let sortCorner = 0; sortCorner < 3; sortCorner++) sortedIndices[bucketWriteCursors[uint32Array[indices[sortTriangle * 3 + sortCorner]]]++] = sortTriangle
    const smoothingCosThreshold = Math.cos((smoothingAngle * Math.PI) / 180),
      array = new Array(vertexCount),
      uint8Array = new Uint8Array(vertexCount)
    for (let faceIndex = 0; faceIndex < triangleCount; faceIndex++) {
      const faceNormalX = unitFaceNormals[faceIndex * 3],
        selectedO = unitFaceNormals[faceIndex * 3 + 1],
        faceNormalZ = unitFaceNormals[faceIndex * 3 + 2]
      for (let index = 0; index < 3; index++) {
        const selectedS = indices[faceIndex * 3 + index]
        let accumNormalX = 0,
          accumNormalY = 0,
          accumNormalZ = 0
        const selectedC = uint32Array[selectedS]
        for (let neighborOffset = bucketOffsets[selectedC]; neighborOffset < bucketOffsets[selectedC + 1]; neighborOffset++) {
          const selectedM = sortedIndices[neighborOffset]
          unitFaceNormals[selectedM * 3] * faceNormalX + unitFaceNormals[selectedM * 3 + 1] * selectedO + unitFaceNormals[selectedM * 3 + 2] * faceNormalZ < smoothingCosThreshold || ((accumNormalX += float32Array[selectedM * 3]), (accumNormalY += float32Array[selectedM * 3 + 1]), (accumNormalZ += float32Array[selectedM * 3 + 2]))
        }
        const accumNormalLength = Math.hypot(accumNormalX, accumNormalY, accumNormalZ) || 1
        ;((accumNormalX /= accumNormalLength), (accumNormalY /= accumNormalLength), (accumNormalZ /= accumNormalLength))
        let selectedP = array[selectedS]
        selectedP || (selectedP = array[selectedS] = [])
        let weldedIndex = -1
        for (let candidateOffset = 0; candidateOffset < selectedP.length; candidateOffset += 4)
          if (selectedP[candidateOffset + 1] * accumNormalX + selectedP[candidateOffset + 2] * accumNormalY + selectedP[candidateOffset + 3] * accumNormalZ > 0.9995) {
            weldedIndex = selectedP[candidateOffset]
            break
          }
        ;(weldedIndex < 0 &&
          (uint8Array[selectedS]
            ? ((weldedIndex = this.positions.length / 3),
              this.positions.push(positions[selectedS * 3], positions[selectedS * 3 + 1], positions[selectedS * 3 + 2]),
              this.normals.push(0, 0, 0),
              this.colors.push(this.colors[selectedS * 3], this.colors[selectedS * 3 + 1], this.colors[selectedS * 3 + 2]),
              this.fx.push(this.fx[selectedS * 4], this.fx[selectedS * 4 + 1], this.fx[selectedS * 4 + 2], this.fx[selectedS * 4 + 3]))
            : ((uint8Array[selectedS] = 1), (weldedIndex = selectedS)),
          (normals[weldedIndex * 3] = accumNormalX),
          (normals[weldedIndex * 3 + 1] = accumNormalY),
          (normals[weldedIndex * 3 + 2] = accumNormalZ),
          selectedP.push(weldedIndex, accumNormalX, accumNormalY, accumNormalZ)),
          (indices[faceIndex * 3 + index] = weldedIndex))
      }
    }
  }
  build() {
    const bufferGeometry = new BufferGeometry()
    ;(bufferGeometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3)), bufferGeometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3)), bufferGeometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3)))
    const fxBytes = new Uint8Array(this.fx.length)
    for (let index = 0; index < fxBytes.length; index++) fxBytes[index] = Math.round(clamp01Scalar(this.fx[index]) * 255)
    bufferGeometry.setAttribute("aFx", new BufferAttribute(fxBytes, 4, !0))
    const vertexCount = this.positions.length / 3
    let indices = this.indices
    const lengthValue = indices.length,
      rankEnds = [0, lengthValue, lengthValue, lengthValue, lengthValue],
      rankRuns = this.rankRuns
    if (rankRuns.length > 0) {
      const fromResult = Array.from({ length: BUCKET_MAX }, () => [])
      let bUCKET_MIN = BUCKET_MIN,
        consumedCount = 0
      for (let total = 0; total <= rankRuns.length; total += 2) {
        const runEnd = total < rankRuns.length ? rankRuns[total] : lengthValue,
          selectedL = fromResult[Math.min(BUCKET_HIGH, Math.max(SIGN_NEGATIVE, bUCKET_MIN)) + 1]
        for (let indexCursor = consumedCount; indexCursor < runEnd; indexCursor++) selectedL.push(indices[indexCursor])
        ;((consumedCount = runEnd), total < rankRuns.length && (bUCKET_MIN = rankRuns[total + 1]))
      }
      indices = []
      for (let bucketIndex = 0; bucketIndex < BUCKET_MAX; bucketIndex++) {
        for (const sourceIndex of fromResult[bucketIndex]) indices.push(sourceIndex)
        rankEnds[bucketIndex] = indices.length
      }
    }
    return ((bufferGeometry.userData.rankEnds = rankEnds), bufferGeometry.setIndex(vertexCount > 65535 ? new Uint32BufferAttribute(indices, 1) : new Uint16BufferAttribute(indices, 1)), bufferGeometry.computeBoundingBox(), bufferGeometry.computeBoundingSphere(), bufferGeometry)
  }
}

/** CellGeometryBuilder.add 的可选外观参数；tint 采用 unknown 以兼容调用方的多种三元色表示。 */
interface CellAddOptions {
  shadow?: boolean
  rank?: number
  tint?: unknown
  glow?: number
  sway?: number
  maskedTint?: boolean
}

class CellGeometryBuilder {
  constructor(cellSize = 32) {
    this.cell = cellSize
  }
  cell
  cells = new Map()
  builder(x, z, shadow) {
    const lookupKey = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)},${shadow ? 1 : 0}`
    let cellBuilder = this.cells.get(lookupKey)
    return (cellBuilder || ((cellBuilder = new MeshBuilder()), this.cells.set(lookupKey, cellBuilder)), cellBuilder)
  }
  add(pelvis, chest, options: CellAddOptions = {}) {
    const elements = chest.elements,
      shadow = options.shadow ?? !0,
      erValue = this.builder(elements[12], elements[14], shadow)
    ;(erValue.setRank(options.rank ?? (shadow ? BUCKET_MIN : BUCKET_LOW)), erValue.append(pelvis, chest, options.tint, options.glow ?? 1, options.sway ?? 1, options.maskedTint ?? !1))
  }
  at(x, z, shadow = !0, rank = shadow ? BUCKET_MIN : BUCKET_LOW) {
    const builderErValue = this.builder(x, z, shadow)
    return (builderErValue.setRank(rank), builderErValue)
  }
  get triangleCount() {
    let total = 0
    for (const cellBuilder of this.cells.values()) total += cellBuilder.triangleCount
    return total
  }
  build(shadowMaterial, material, parent, namePrefix, smoothingAngle = 0) {
    const meshes = []
    for (const [cellKey, cellBuilder] of this.cells) {
      if (cellBuilder.vertexCount === 0) continue
      smoothingAngle > 0 && cellBuilder.computeNormals(smoothingAngle)
      const endsWithResult = cellKey.endsWith(",1"),
        mesh = new Mesh(cellBuilder.build(), endsWithResult ? shadowMaterial : material)
      ;((mesh.name = `${namePrefix}:${cellKey}`), (mesh.castShadow = endsWithResult), (mesh.receiveShadow = !0), (mesh.matrixAutoUpdate = !1), parent.add(mesh), meshes.push(mesh))
    }
    return (this.cells.clear(), meshes)
  }
}

function polygonArea(points) {
  let total = 0
  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index++) total += points[previousIndex].x * points[index].y - points[index].x * points[previousIndex].y
  return total / 2
}

function polygonCentroid(points) {
  let total = 0,
    sumY = 0
  for (const point of points) ((total += point.x), (sumY += point.y))
  return { x: total / points.length, y: sumY / points.length }
}

export { CellGeometryBuilder, MeshBuilder, polygonArea, createVisualKit, polygonCentroid }