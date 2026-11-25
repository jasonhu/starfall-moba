/**
 * 音频总控：总线/压缩/混响、音量与静音、以及首次手势解锁（AudioMixer）
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { isTargetInDirectionalCone, SpeechAnnouncer } from './speech-announcer'
import { SfxEngine } from './sfx-engine'
import { MusicDirector } from './music'
import { MONSTER_STATS, VISION_RANGES } from '../game-balance'
import { SFX_RUNTIME_CUE_TABLE } from './sfx-cues'
import { ANNOUNCE_PRIORITY, AREA_SFX, HERO_ATTACK_SFX, HERO_HIT_SFX, KILL_STREAK_EVENTS, MAJOR_EVENTS, MONSTER_KIND, PROJECTILE_HIT_SFX, PROJECTILE_LAUNCH_SFX, isBossMonster } from '../attack-sfx-map'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

class AudioMixer {
  ctx = null
  mixer = null
  music = null
  vols = { master: 0.8, sfx: 0.9, music: 0.5 }
  wantTrack = "none"
  hidden = !1
  disposed = !1
  voice = new SpeechAnnouncer()
  timer = 0
  lastTime = -1
  lastSeed = -1
  lastHero = ""
  units = new Map()
  unitsOld = new Map()
  refreshCount = 0
  cores = []
  projOwner = new Map()
  hitProj = new Set()
  towerHits = new Set()
  areaVoices = new Map()
  breathVoice = null
  strums = new Map()
  shadowLeft = 0
  sight = []
  sightReady = !1
  lx = 0
  ly = 0
  spGain = 1
  spPan = 0
  spLp = 0
  annFreeAt = 0
  heat = 0
  intensity = 0
  tension = 0
  ovI = null
  ovT = null
  toneDead = !1
  hbTimer = 0
  recallVoice = null
  frame = 0
  debug = {
    play: (cDrum, playOptions) => {
      this.mixer?.play(cDrum, playOptions)
    },
    stats: () => ({
      state: this.ctx?.state ?? "none",
      time: this.ctx?.currentTime ?? 0,
      voices: this.mixer?.voiceCount ?? 0,
      notes: this.mixer?.noteCount ?? 0,
      played: this.mixer?.stats.played ?? 0,
      throttled: this.mixer?.stats.throttled ?? 0,
      capped: this.mixer?.stats.capped ?? 0,
      stolen: this.mixer?.stats.stolen ?? 0,
      peakVoices: this.mixer?.stats.peakVoices ?? 0,
      intensity: this.ovI ?? this.intensity,
      tension: this.ovT ?? this.tension,
      track: this.music?.track ?? this.wantTrack,
    }),
    override: (intensityOverride, tensionOverride) => {
      ;((this.ovI = intensityOverride), (this.ovT = tensionOverride))
    },
  }
  constructor() {
    if ((typeof document < "u" && document.addEventListener("visibilitychange", this.onVisibility), typeof window < "u"))
      for (const gestureEvent of AUDIO_UNLOCK_GESTURE_EVENTS) window.addEventListener(gestureEvent, this.onGesture, { capture: !0, passive: !0 })
  }
  unlock() {
    if (!(this.disposed || typeof window > "u")) {
      if (!this.ctx) {
        const audioContextCtor = window.AudioContext ?? window.webkitAudioContext
        if (!audioContextCtor) return
        try {
          this.ctx = new audioContextCtor({ latencyHint: "interactive" })
        } catch {
          try {
            this.ctx = new audioContextCtor()
          } catch {
            return
          }
        }
        ;((this.mixer = new SfxEngine(this.ctx)),
          this.mixer.kit.reseed(Date.now()),
          (this.music = new MusicDirector(this.mixer)),
          this.mixer.setVolumes(this.vols.master, this.vols.sfx, this.vols.music),
          this.wantTrack !== "none" && this.music.setTrack(this.wantTrack),
          (this.timer = window.setInterval(this.pump, 60)))
      }
      this.ctx.state !== "running" && !this.hidden && this.ctx.resume().catch(ignoreAudioError)
    }
  }
  pump = () => {
    !this.mixer || !this.music || this.ctx?.state !== "running" || (this.mixer.sweep(), this.music.tick())
  }
  onGesture = () => {
    ;(!this.ctx || this.ctx.state !== "running") && this.unlock()
  }
  get live() {
    return this.mixer !== null && !this.hidden && (this.ctx === null || this.ctx.state === "running")
  }
  removeGestureListeners() {
    if (!(typeof window > "u")) for (const gestureEvent of AUDIO_UNLOCK_GESTURE_EVENTS) window.removeEventListener(gestureEvent, this.onGesture, { capture: !0 })
  }
  onVisibility = () => {
    ;((this.hidden = document.hidden), this.hidden && this.voice.stop())
    const ctxState = this.ctx,
      sfxMixer = this.mixer
    !ctxState ||
      !sfxMixer ||
      (this.hidden
        ? (sfxMixer.fadeMaster(0, 0.015),
          window.setTimeout(() => {
            this.hidden && ctxState.state === "running" && ctxState.suspend().catch(ignoreAudioError)
          }, 90))
        : ctxState
            .resume()
            .then(() => sfxMixer.fadeMaster(this.vols.master, 0.08))
            .catch(ignoreAudioError))
  }
  setVolumes(targetObject) {
    ;((this.vols = { master: targetObject.master, sfx: targetObject.sfx, music: targetObject.music }),
      this.voice.setVolume(targetObject.master * targetObject.sfx),
      this.mixer && !this.hidden ? this.mixer.setVolumes(targetObject.master, targetObject.sfx, targetObject.music) : this.mixer && this.mixer.setVolumes(0, targetObject.sfx, targetObject.music))
  }
  setMusic(battleKind) {
    ;((this.wantTrack = battleKind), battleKind !== "battle" && this.leaveBattle(), this.music?.setTrack(battleKind))
  }
  leaveBattle() {
    ;(this.toneDead && ((this.toneDead = !1), this.mixer?.setMusicTone(2e4)),
      this.areaVoices.forEach((areaVoice) => areaVoice.h.stop(0.2)),
      this.areaVoices.clear(),
      this.breathVoice?.h.stop(0.2),
      (this.breathVoice = null),
      this.recallVoice?.stop(0.1),
      (this.recallVoice = null),
      (this.hbTimer = 0),
      (this.heat = 0),
      (this.shadowLeft = 0))
  }
  attachOffline(audioContext, clock) {
    return (
      (this.mixer = new SfxEngine(audioContext, { clock: clock })),
      (this.music = new MusicDirector(this.mixer)),
      this.mixer.setVolumes(this.vols.master, this.vols.sfx, this.vols.music),
      this.wantTrack !== "none" && this.music.setTrack(this.wantTrack),
      this.mixer
    )
  }
  ui(uiCue) {
    this.live && this.mixer?.play(`ui_${uiCue}`)
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      typeof document < "u" && document.removeEventListener("visibilitychange", this.onVisibility),
      this.removeGestureListeners(),
      this.timer && window.clearInterval(this.timer),
      this.voice.dispose(),
      this.music?.dispose(),
      this.mixer?.dispose(),
      this.ctx && this.ctx.state !== "closed" && this.ctx.close().catch(ignoreAudioError),
      (this.music = null),
      (this.mixer = null),
      (this.ctx = null),
      this.resetMatch())
  }
  resetMatch() {
    ;(this.units.clear(),
      this.unitsOld.clear(),
      (this.cores.length = 0),
      this.projOwner.clear(),
      this.areaVoices.forEach((areaVoice) => areaVoice.h.stop(0.2)),
      this.areaVoices.clear(),
      this.breathVoice?.h.stop(0.2),
      (this.breathVoice = null),
      this.strums.clear(),
      (this.shadowLeft = 0),
      this.recallVoice?.stop(0.1),
      (this.recallVoice = null),
      (this.heat = 0),
      (this.annFreeAt = 0),
      (this.hbTimer = 0))
  }
  /**
   * 更新单位。
   *
   * @param world - 战场
  */
  refreshUnits(world) {
    const worldConfig = world.config
    ;((world.time + 1 < this.lastTime || worldConfig.seed !== this.lastSeed || worldConfig.playerHero !== this.lastHero) && (this.resetMatch(), (this.lastSeed = worldConfig.seed), (this.lastHero = worldConfig.playerHero)),
      (this.lastTime = world.time),
      ++this.refreshCount > 900 && ((this.refreshCount = 0), (this.unitsOld = this.units), (this.units = new Map())),
      (this.cores.length = 0))
    for (const unit of world.units) (this.units.set(unit.id, unit), unit.kind === "core" && this.cores.push(unit))
  }
  unit(lookupKey) {
    return this.units.get(lookupKey) ?? this.unitsOld.get(lookupKey)
  }
  player(world) {
    const unitResult = this.unit(world.playerId)
    return unitResult && unitResult.kind === "hero" ? unitResult : void 0
  }
  seen(unit) {
    return unit.team === 0 || unit.visible[0]
  }
  posSeen(world, position) {
    const sightCache = this.sight
    if (!this.sightReady) {
      sightCache.length = 0
      for (const unit of world.units) {
        if (unit.team !== 0 || !unit.alive) continue
        const visionRange = unit.kind === "hero" ? VISION_RANGES.hero : unit.kind === "minion" ? VISION_RANGES.minion : unit.kind === "tower" ? VISION_RANGES.tower : VISION_RANGES.core
        sightCache.push(unit.pos.x, unit.pos.y, visionRange * visionRange)
      }
      this.sightReady = !0
    }
    for (let index = 0; index < sightCache.length; index += 3) {
      const dx = position.x - sightCache[index],
        dy = position.y - sightCache[index + 1]
      if (dx * dx + dy * dy <= sightCache[index + 2]) return !0
    }
    return !1
  }
  locate(position, range, floorGain) {
    const dx = position.x - this.lx,
      dy = position.y - this.ly,
      distance = Math.hypot(dx, dy)
    if (distance > range && floorGain <= 0) return !1
    const falloffStart = 3,
      attenuationFactor = distance <= falloffStart ? 1 : Math.max(0, 1 - (distance - falloffStart) / (range - falloffStart))
    return (
      (this.spGain = Math.max(floorGain, Math.pow(attenuationFactor, 1.6))),
      (this.spPan = Math.max(-1, Math.min(1, dx / 13)) * 0.85),
      (this.spLp = distance > 8 ? 17e3 * Math.pow(0.13, Math.min(1, (distance - 8) / 18)) : 0),
      this.spGain > 0.004
    )
  }
  at(cue, position, gain, options?) {
    const sfxMixer = this.mixer
    return !sfxMixer || !this.locate(position, SFX_RUNTIME_CUE_TABLE[cue].range, options?.floor ?? 0) ? null : sfxMixer.play(cue, { gain: gain * this.spGain, pan: this.spPan, lp: this.spLp, pitch: options?.pitch, v: options?.v, dur: options?.dur, prio: options?.prio })
  }
  /**
   * 处理事件。
   *
   * @param events - 主要输入
   * @param world - 战场
  */
  handleEvents(events, world) {
    const sfxMixer = this.mixer
    if (!sfxMixer || !this.live || events.length === 0) return
    ;(this.refreshUnits(world), (this.sightReady = !1))
    const playerId = world.playerId,
      playerResult = this.player(world)
    playerResult && ((this.lx = playerResult.pos.x), (this.ly = playerResult.pos.y))
    let isActive = !1,
      playerGotGold = !1
    ;(this.hitProj.clear(), this.towerHits.clear())
    for (const scanEvent of events)
      scanEvent.type === "announce"
        ? KILL_STREAK_EVENTS.has(scanEvent.key) && (isActive = !0)
        : scanEvent.type === "gold"
          ? scanEvent.unitId === playerId && scanEvent.reason !== "passive" && (playerGotGold = !0)
          : scanEvent.type === "projectileHit" && (this.hitProj.add(scanEvent.id), (scanEvent.visual === "tower_bolt" || scanEvent.visual === "core_bolt") && this.towerHits.add(scanEvent.targetId))
    let pendingAnnounces = null
    for (const event of events)
      switch (event.type) {
        case "attack": {
          const attacker = this.unit(event.unitId)
          if (!attacker || !this.seen(attacker)) break
          const attackerIsPlayer = event.unitId === playerId,
            targetIsPlayer = event.targetId === playerId
          attacker.kind === "hero"
            ? this.at(HERO_ATTACK_SFX[attacker.heroId], attacker.pos, attackerIsPlayer ? 1 : 0.6, { prio: attackerIsPlayer ? 2 : 1 })
            : attacker.kind === "minion"
              ? (attacker.minionType === "melee" || attacker.minionType === "super") && this.at("minion_swing", attacker.pos, targetIsPlayer ? 0.8 : 0.45, { pitch: attacker.minionType === "super" ? 0.7 : 1 })
              : attacker.kind === "tower" || attacker.kind === "core"
                ? this.at("tower_charge", attacker.pos, targetIsPlayer ? 1 : 0.6, { pitch: attacker.kind === "core" ? 0.8 : 1, prio: targetIsPlayer ? 2 : 1 })
                : MONSTER_STATS[attacker.monsterType].projectileSpeed === 0 && this.at("monster_swing", attacker.pos, 0.7, { v: MONSTER_KIND[attacker.monsterType] })
          break
        }
        case "damage": {
          const victimIsPlayer = event.targetId === playerId,
            sourceIsPlayer = event.sourceId === playerId,
            sourceUnit = this.unit(event.sourceId),
            targetUnit = this.unit(event.targetId),
            targetHidden = targetUnit !== void 0 && !victimIsPlayer && !this.seen(targetUnit)
          if (((victimIsPlayer || (sourceIsPlayer && !targetHidden)) && this.noteCombat(victimIsPlayer ? sourceUnit : targetUnit), victimIsPlayer && playerResult && event.amount > 0)) {
            const damageRatio = event.amount / Math.max(1, playerResult.stats.maxHp)
            damageRatio >= 0.1 ? sfxMixer.play("player_hurt_heavy", { gain: Math.min(1, 0.7 + damageRatio * 1.5) }) : damageRatio >= 0.008 && sfxMixer.play("player_hurt", { gain: Math.min(1, 0.55 + damageRatio * 4), v: Math.min(1, damageRatio * 10) })
          }
          if (event.skill) {
            sourceIsPlayer && targetUnit && targetUnit.kind === "hero" && !targetHidden && sfxMixer.play("skill_hit")
            break
          }
          if (!sourceUnit || targetHidden || (!victimIsPlayer && !sourceIsPlayer && !targetUnit && !this.posSeen(world, event.pos))) break
          const targetIsHero = targetUnit !== void 0 && targetUnit.kind === "hero"
          if (sourceUnit.kind === "hero") {
            const selectedHERO_HIT_SFX = HERO_HIT_SFX[sourceUnit.heroId]
            selectedHERO_HIT_SFX && event.dtype === "physical" && this.at(selectedHERO_HIT_SFX, event.pos, sourceIsPlayer ? 1 : victimIsPlayer ? 0.9 : 0.6, { prio: sourceIsPlayer || victimIsPlayer ? 2 : 1 })
          } else
            sourceUnit.kind === "minion"
              ? sourceUnit.minionType === "melee"
                ? this.at("minion_melee_hit", event.pos, victimIsPlayer ? 0.75 : targetIsHero ? 0.5 : 0.3)
                : sourceUnit.minionType === "super" && this.at("super_hit", event.pos, victimIsPlayer ? 0.85 : targetIsHero ? 0.6 : 0.4)
              : sourceUnit.kind === "monster" &&
                MONSTER_STATS[sourceUnit.monsterType].projectileSpeed === 0 &&
                (MONSTER_STATS[sourceUnit.monsterType].epic ? this.at("epic_hit", event.pos, victimIsPlayer ? 1 : 0.8, { v: isBossMonster(sourceUnit.monsterType) }) : this.at("monster_hit", event.pos, victimIsPlayer ? 0.9 : 0.65, { v: MONSTER_KIND[sourceUnit.monsterType] }))
          break
        }
        case "heal":
          event.targetId === playerId && playerResult && event.amount >= playerResult.stats.maxHp * 0.04 && sfxMixer.play("fx_heal", { gain: 0.8 })
          break
        case "skillCast": {
          const casterIsPlayer = event.unitId === playerId,
            casterUnit = this.unit(event.unitId)
          if (!casterIsPlayer && !(casterUnit ? this.seen(casterUnit) : this.posSeen(world, event.pos))) break
          const castCue = event.slot === "recall" || event.slot === "heal" || event.slot === "flash" ? `cast_${event.slot}` : `cast_${event.heroId}_${event.slot}`
          this.at(castCue, event.pos, casterIsPlayer ? 1 : 0.7, { prio: casterIsPlayer ? 3 : 2 })
          break
        }
        case "fx":
          this.onFx(event, world, playerId, playerResult, playerGotGold)
          break
        case "projectileSpawn": {
          ;(this.projOwner.size > 600 && this.projOwner.clear(), this.projOwner.set(event.id, event.ownerId))
          const ownerIsPlayer = event.ownerId === playerId,
            ownerUnit = this.unit(event.ownerId)
          if (!ownerIsPlayer && !(ownerUnit ? this.seen(ownerUnit) : this.posSeen(world, event.pos))) break
          const ownerIsHero = ownerUnit !== void 0 && ownerUnit.kind === "hero",
            launchGain = ownerIsPlayer ? 1 : ownerIsHero ? 0.65 : event.visual === "tower_bolt" || event.visual === "core_bolt" ? 0.7 : event.visual === "minion_siege" ? 0.5 : 0.38,
            voiceVariant = event.visual === "xingli_basic" ? this.strum(event.ownerId, world.time) : void 0
          this.at(PROJECTILE_LAUNCH_SFX[event.visual], event.pos, launchGain, { pitch: event.visual === "core_bolt" ? 0.8 : 1, prio: ownerIsPlayer ? 2 : void 0, v: voiceVariant })
          break
        }
        case "projectileHit": {
          const hitTargetIsPlayer = event.targetId === playerId,
            projectileOwnerIsPlayer = this.projOwner.get(event.id) === playerId,
            hitTargetUnit = this.unit(event.targetId)
          if (!hitTargetIsPlayer && (hitTargetUnit ? !this.seen(hitTargetUnit) : !projectileOwnerIsPlayer && !this.posSeen(world, event.pos))) break
          const isTowerBolt = event.visual === "tower_bolt" || event.visual === "core_bolt",
            hitCue = isTowerBolt && hitTargetIsPlayer ? "tower_hit_player" : PROJECTILE_HIT_SFX[event.visual],
            isRangedProjectile = event.visual === "minion_ranged" || event.visual === "minion_siege" || event.visual === "monster_spit",
            hitTargetIsHero = hitTargetUnit !== void 0 && hitTargetUnit.kind === "hero",
            hitGain = hitTargetIsPlayer || projectileOwnerIsPlayer ? 1 : isRangedProjectile ? (hitTargetIsHero ? 0.5 : 0.32) : isTowerBolt ? 0.65 : 0.6,
            hitVoiceVariant = event.visual === "fengling_s1" && hitTargetIsHero ? 1 : 0
          this.at(hitCue, event.pos, hitGain, { pitch: event.visual === "core_bolt" ? 0.8 : 1, prio: hitTargetIsPlayer || projectileOwnerIsPlayer ? 2 : void 0, v: hitVoiceVariant })
          break
        }
        case "projectileEnd": {
          ;(this.projOwner.delete(event.id),
            (event.visual === "xingli_s1" || event.visual === "fengling_s1" || event.visual === "yeque_s2") &&
              !this.hitProj.has(event.id) &&
              this.posSeen(world, event.pos) &&
              this.at("proj_fizzle", event.pos, 0.7, { v: event.visual === "yeque_s2" ? 1 : 0 }))
          break
        }
        case "areaSpawn": {
          let selectedAREA_SFX = AREA_SFX[event.visual]
          if (!selectedAREA_SFX) break
          let areaTeam = 2
          for (const area of world.areas)
            if (area.id === event.id) {
              areaTeam = area.team
              break
            }
          const isTelegraph = event.visual === "telegraph"
          if ((isTelegraph && areaTeam !== 0 && (selectedAREA_SFX = "area_telegraph_enemy"), !isTelegraph && areaTeam !== 0 && !this.posSeen(world, event.pos))) break
          const areaGain = areaTeam === 0 ? 0.9 : 1,
            atResult = this.at(selectedAREA_SFX, event.pos, areaGain, { dur: event.duration })
          atResult && event.duration > 0.8 && this.areaVoices.set(event.id, { h: atResult, key: selectedAREA_SFX, gain: areaGain })
          break
        }
        case "areaEnd": {
          const Value = this.areaVoices.get(event.id)
          Value && (Value.h.stop(0.25), this.areaVoices.delete(event.id))
          break
        }
        case "death": {
          if (event.kind === "hero")
            event.unitId === playerId
              ? (sfxMixer.play("death_player"), this.recallVoice?.stop(0.1), (this.recallVoice = null))
              : event.team === 0
                ? this.at("death_hero_ally", event.pos, 0.9)
                : (event.killerId === playerId || this.posSeen(world, event.pos)) && this.at("death_hero_enemy", event.pos, event.killerId === playerId ? 1 : 0.8, { prio: event.killerId === playerId ? 3 : 2 })
          else if (event.kind === "minion") {
            if (event.killerId !== playerId && !this.posSeen(world, event.pos)) break
            const deadUnit = this.unit(event.unitId),
              isBigMinion = deadUnit !== void 0 && deadUnit.kind === "minion" && (deadUnit.minionType === "siege" || deadUnit.minionType === "super")
            this.at(isBigMinion ? "death_minion_big" : "death_minion", event.pos, event.killerId === playerId ? 0.9 : 0.45)
          } else if (event.kind === "monster") {
            const deadMonster = this.unit(event.unitId)
            ;(deadMonster && deadMonster.kind === "monster" && !MONSTER_STATS[deadMonster.monsterType].epic && this.at("death_monster", event.pos, 0.8, { v: MONSTER_KIND[deadMonster.monsterType] }),
              this.breathVoice && this.breathVoice.unitId === event.unitId && (this.breathVoice.h.stop(0.15), (this.breathVoice = null)))
          }
          break
        }
        case "heroKill": {
          if (isActive) break
          if (event.killerId === playerId) sfxMixer.play("kill_player")
          else if (event.victimId !== playerId) {
            const victimUnit = this.unit(event.victimId),
              killerUnit = this.unit(event.killerId),
              isAllyKill = victimUnit ? victimUnit.team === 1 : killerUnit !== void 0 && killerUnit.team === 0
            sfxMixer.play(isAllyKill ? "kill_ally" : "kill_enemy")
          }
          break
        }
        case "levelUp":
          event.unitId === playerId && sfxMixer.play("levelup_player")
          break
        case "respawn":
          event.unitId === playerId && sfxMixer.play("respawn_player")
          break
        case "gold":
          if (event.unitId !== playerId) break
          event.reason === "lasthit" || event.reason === "monster"
            ? sfxMixer.play("coin", { v: Math.min(1, event.amount / 120) })
            : event.reason === "kill"
              ? sfxMixer.play("coin_big")
              : (event.reason === "assist" || event.reason === "tower") && sfxMixer.play("coin_big", { gain: 0.7 })
          break
        case "itemBought":
          event.unitId === playerId && sfxMixer.play("buy", event.auto ? { gain: 0.6 } : void 0)
          break
        case "monsterSpawn":
          MONSTER_STATS[event.monsterType].epic ? this.at("epic_roar", event.pos, 1, { v: isBossMonster(event.monsterType), floor: 0.3 }) : this.posSeen(world, event.pos) && this.at("monster_spawn", event.pos, 0.8, { v: MONSTER_KIND[event.monsterType] })
          break
        case "epicSlain":
          this.at("epic_fall", event.pos, 1, { v: isBossMonster(event.monsterType), floor: 0.3 })
          break
        case "announce":
          ;(pendingAnnounces ??= []).push({ key: event.key, team: event.team })
          break
        case "reject":
          event.unitId === playerId && sfxMixer.play("reject")
          break
        case "gameOver":
          ;(this.recallVoice?.stop(0.1), (this.recallVoice = null), this.music?.track === "battle" && this.setMusic(event.winner === 0 ? "victory" : "defeat"))
          break
      }
    pendingAnnounces && this.playAnnounces(pendingAnnounces)
  }
  /**
   * 处理特效。
   *
   * @param fxEvent - 输入
   * @param world - 次要输入
   * @param playerId - 第三输入
   * @param player - 第四输入
   * @param playerGotGold - 附加输入
  */
  onFx(fxEvent, world, playerId, player, playerGotGold) {
    const textValue = `fx_${fxEvent.key}`,
      involvesPlayer = fxEvent.unitId === playerId || fxEvent.targetId === playerId
    switch (fxEvent.key) {
      case "level_up":
      case "respawn":
        if (fxEvent.unitId === playerId || (fxEvent.unitId === void 0 && player && Math.hypot(fxEvent.pos.x - player.pos.x, fxEvent.pos.y - player.pos.y) < 1)) return
        break
      case "gold_gain":
        if (fxEvent.unitId === playerId || (fxEvent.unitId === void 0 && playerGotGold)) return
        break
      case "hit_tower":
        if (fxEvent.targetId !== void 0 && this.towerHits.has(fxEvent.targetId)) return
        break
      case "hit_physical":
      case "hit_magic":
        if (fxEvent.unitId === void 0 && fxEvent.targetId !== playerId) return
        break
      case "tower_destroyed":
      case "core_destroyed":
        this.at(textValue, fxEvent.pos, 1, { floor: fxEvent.key === "core_destroyed" ? 0.6 : 0 })
        return
      case "drake_breath_warn":
      case "drake_breath":
        this.onBreath(fxEvent, world, playerId, player)
        return
    }
    if (!involvesPlayer && fxEvent.team !== 0) {
      const fxSourceUnit = fxEvent.unitId !== void 0 ? this.unit(fxEvent.unitId) : void 0
      if (!(fxSourceUnit ? this.seen(fxSourceUnit) : this.posSeen(world, fxEvent.pos))) return
    }
    if (fxEvent.targetId !== void 0 && fxEvent.targetId !== playerId) {
      const fxTargetUnit = this.unit(fxEvent.targetId)
      if (fxTargetUnit && !this.seen(fxTargetUnit)) return
    }
    const isHit = fxEvent.key === "hit_physical" || fxEvent.key === "hit_magic" || fxEvent.key === "hit_tower",
      fxGain = isHit ? (involvesPlayer ? 0.8 : 0.45) : involvesPlayer ? 1 : 0.75
    this.at(textValue, fxEvent.pos, fxGain, { prio: involvesPlayer && !isHit ? 3 : void 0 })
  }
  onBreath(fxEvent, world, playerId, player) {
    const breathSourceUnit = fxEvent.unitId !== void 0 ? this.unit(fxEvent.unitId) : void 0
    if (!(breathSourceUnit ? this.seen(breathSourceUnit) : this.posSeen(world, fxEvent.pos))) return
    const isWarning = fxEvent.key === "drake_breath_warn",
      hitsPlayer = fxEvent.targetId === playerId || (player !== void 0 && player.alive && isTargetInDirectionalCone(player.pos, player.radius, fxEvent))
    this.breathVoice?.h.stop(0.08)
    const breathDuration = Math.min(1.6, Math.max(0.3, fxEvent.value ?? (isWarning ? 0.9 : 0.8))),
      breathVoiceHandle = this.at(`fx_${fxEvent.key}`, fxEvent.pos, hitsPlayer ? 1 : 0.7, { dur: breathDuration, prio: hitsPlayer ? 3 : 2 })
    this.breathVoice = breathVoiceHandle && fxEvent.unitId !== void 0 ? { h: breathVoiceHandle, unitId: fxEvent.unitId } : null
  }
  strum(lookupKey, time) {
    const getValue = this.strums.get(lookupKey)
    return !getValue || time - getValue.t > 3 || time < getValue.t ? (this.strums.set(lookupKey, { i: 0, t: time }), 0) : (getValue.i++, (getValue.t = time), getValue.i)
  }
  playAnnounces(announcements) {
    const sfxMixer = this.mixer
    if (!sfxMixer) return
    announcements.sort((firstAnnounce, secondAnnounce) => ANNOUNCE_PRIORITY[secondAnnounce.key] - ANNOUNCE_PRIORITY[firstAnnounce.key])
    const currentAudioTime = sfxMixer.now()
    let total = Math.max(0, this.annFreeAt - currentAudioTime),
      spoken = !1
    for (let index = 0; index < announcements.length && index < 2 && !(total > 2.4); index++) {
      const selectedT = announcements[index],
        textResult = `ann_${selectedT.key}`,
        isMajorEnemyEvent = selectedT.team === 1 && MAJOR_EVENTS.has(selectedT.key)
      if (!sfxMixer.play(textResult, { v: isMajorEnemyEvent ? 1 : 0, when: total })) continue
      spoken || (spoken = this.voice.say(selectedT.key, isMajorEnemyEvent, total + 0.12))
      const announceDuration = SFX_RUNTIME_CUE_TABLE[textResult].len * 0.75
      ;(selectedT.key !== "victory" && selectedT.key !== "defeat" && sfxMixer.duck(0.5, total + announceDuration), (total += announceDuration), (this.annFreeAt = currentAudioTime + total))
    }
  }
  noteCombat(combatUnit) {
    if (!combatUnit) return
    const isHighThreat = combatUnit.kind === "hero" || combatUnit.kind === "tower" || combatUnit.kind === "core" || (combatUnit.kind === "monster" && MONSTER_STATS[combatUnit.monsterType].epic)
    this.heat = Math.max(this.heat, isHighThreat ? 1 : 0.3)
  }
  update(world, updateValue) {
    const sfxMixer = this.mixer,
      music = this.music
    if (!sfxMixer || !music || !this.live) return
    sfxMixer.sweep()
    const frameDelta = Math.min(0.25, Math.max(0, updateValue))
    let intensityTarget = 0,
      tensionTarget = 0,
      playerDead = !1
    if (world && !world.over) {
      this.refreshUnits(world)
      const playerHeroUnit = this.player(world)
      if (playerHeroUnit)
        if (((this.lx = playerHeroUnit.pos.x), (this.ly = playerHeroUnit.pos.y), playerHeroUnit.alive)) {
          let nearbyAllies = 0
          for (const allyHero of world.heroes) allyHero.team !== 1 || !allyHero.alive || !allyHero.visible[0] || (Math.hypot(allyHero.pos.x - playerHeroUnit.pos.x, allyHero.pos.y - playerHeroUnit.pos.y) < 14 && nearbyAllies++)
          ;(nearbyAllies > 0 && (intensityTarget = Math.min(1, 0.55 + 0.15 * nearbyAllies)),
            playerHeroUnit.inCombat && (intensityTarget = Math.max(intensityTarget, 0.85)),
            world.time - playerHeroUnit.lastHitTime < 2.5 && (intensityTarget = Math.max(intensityTarget, 0.45)),
            (intensityTarget = Math.max(intensityTarget, this.heat)),
            this.tickPlayerBeds(sfxMixer, playerHeroUnit, frameDelta))
        } else ((playerDead = !0), (intensityTarget = 0.1))
      tensionTarget = Math.max(0, Math.min(0.5, (world.time - 420) / 400))
      for (const core of this.cores) {
        if (!core.alive) continue
        core.invulnerable || (tensionTarget = Math.max(tensionTarget, 0.65))
        const coreHpRatio = core.hp / Math.max(1, core.stats.maxHp)
        coreHpRatio < 0.6 && (tensionTarget = Math.max(tensionTarget, 0.65 + ((0.6 - coreHpRatio) / 0.6) * 0.35))
      }
      ;(++this.frame & 3) === 0 && this.trackAreas(world)
    }
    this.heat *= Math.exp(-frameDelta / 3)
    const intensitySmoothing = intensityTarget > this.intensity ? 0.7 : 4
    ;((this.intensity += (intensityTarget - this.intensity) * (1 - Math.exp(-frameDelta / intensitySmoothing))),
      (this.tension += (tensionTarget - this.tension) * (1 - Math.exp(-frameDelta / 3))),
      music.setMood(this.ovI ?? this.intensity, this.ovT ?? this.tension),
      playerDead !== this.toneDead && ((this.toneDead = playerDead), sfxMixer.setMusicTone(playerDead ? 700 : 2e4)),
      music.tick())
  }
  tickPlayerBeds(sfxMixer, player, deltaTime) {
    const hpRatio = player.hp / Math.max(1, player.stats.maxHp)
    if (hpRatio < 0.25 && player.hp > 0) {
      if (((this.hbTimer -= deltaTime), this.hbTimer <= 0)) {
        const lowHealthSeverity = 1 - hpRatio / 0.25
        ;(sfxMixer.play("heartbeat", { gain: 0.6 + 0.4 * lowHealthSeverity }), (this.hbTimer = 0.95 - 0.25 * lowHealthSeverity))
      }
    } else this.hbTimer = 0
    let recallTimeLeft = 0,
      shadowTimeLeft = 0
    for (const buff of player.buffs) buff.id === "recall" ? (recallTimeLeft = buff.timeLeft) : buff.id === "yeque_shadow" && (shadowTimeLeft = buff.timeLeft)
    ;(shadowTimeLeft > this.shadowLeft + 0.2 && sfxMixer.play("yeque_refresh"),
      (this.shadowLeft = shadowTimeLeft),
      recallTimeLeft > 0.3 && !this.recallVoice ? (this.recallVoice = sfxMixer.play("recall_channel", { dur: Math.max(1, recallTimeLeft) })) : recallTimeLeft <= 0 && this.recallVoice && (this.recallVoice.stop(0.12), (this.recallVoice = null)))
  }
  trackAreas(world) {
    this.areaVoices.size !== 0 &&
      this.areaVoices.forEach((areaVoice, lookupOption) => {
        let areaStillActive = !1
        for (const area of world.areas)
          if (area.id === lookupOption) {
            ;((areaStillActive = !0), this.locate(area.pos, SFX_RUNTIME_CUE_TABLE[areaVoice.key].range + 4, 0) ? areaVoice.h.set(areaVoice.gain * this.spGain, this.spPan) : areaVoice.h.set(0, 0))
            break
          }
        areaStillActive || (areaVoice.h.stop(0.25), this.areaVoices.delete(lookupOption))
      })
  }
}

const AUDIO_UNLOCK_GESTURE_EVENTS = ["pointerdown", "touchend", "keydown"]

function ignoreAudioError() {}

function createAudioMixer() {
  return new AudioMixer()
}

export { createAudioMixer }