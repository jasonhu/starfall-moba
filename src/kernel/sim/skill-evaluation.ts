/**
 * 技能评估：玩法规格表、施法取值与战斗收益估算
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { HERO_TABLE } from '../../heroes/registry'
import { Nh } from '../skills/skill-values'
import { LIGHT_TARGET_SCRATCH } from '../render/scene-rigs'
import { ICON_LIGHT_HIGHLIGHT } from '../render/procedural-art'
import { AI_TUNING, SKILL_SLOTS } from '../ai-tactics'
import { projectParamOnSegment } from '../world/lane-progress'
import { AREA_ALPHA_AGE_SCALE } from '../fx/emitters'

const CAST_DELAY_SCALE = 0.4

function getCastDelay(lookupKey, lookupOption) {
  return HERO_TABLE[lookupKey].skills[lookupOption].castTime * CAST_DELAY_SCALE
}

function getSkillValueRaw(heroId, skillSlot, statKey) {
  return Nh(HERO_TABLE[heroId].skills[skillSlot], statKey, 1)
}

function getCastRange(heroId, skillSlot) {
  const castSpec = HERO_TABLE[heroId].skills[skillSlot].cast
  return "range" in castSpec ? castSpec.range : 0
}

/**
 * 创建配置。
 *
 * @param heroId - 来源
 * @param skillSlot - 次要输入
 * @param specOverrides - 第三输入
 * @returns 结果对象
 */
function buildActionSpec(heroId, skillSlot, specOverrides) {
  const selectedSkills = HERO_TABLE[heroId].skills[skillSlot],
    castSpec = selectedSkills.cast
  let castParam,
    castReach,
    effectRadius = 0
  switch (castSpec.type) {
    case "direction":
      ;((castParam = "dir"), (castReach = castSpec.range + castSpec.width * 0.5))
      break
    case "cone":
      ;((castParam = "dir"), (castReach = castSpec.range), (effectRadius = castSpec.range))
      break
    case "position":
      ;((castParam = "pos"), (castReach = castSpec.range + castSpec.radius), (effectRadius = castSpec.radius))
      break
    case "target":
      ;((castParam = "target"), (castReach = castSpec.range))
      break
    default:
      ;((castParam = "none"), (castReach = castSpec.radius), (effectRadius = castSpec.radius))
      break
  }
  return {
    heroId: heroId,
    slot: skillSlot,
    name: selectedSkills.name,
    cast: castSpec,
    param: castParam,
    reach: castReach,
    aoeRadius: effectRadius,
    autoAimsEnemy: !0,
    damage: null,
    cc: [],
    mobility: null,
    delay: 0,
    projectileSpeed: 0,
    blockedByMinions: !1,
    stopsAtFirstHero: !1,
    hitsNonHeroes: !0,
    duration: 0,
    lock: selectedSkills.castTime,
    selfBuffs: [],
    immunity: null,
    dodgeable: !1,
    ...specOverrides,
  }
}

const skillValue = getSkillValueRaw,
  skillRange = getCastRange,
  makeDash = (heroId, skillSlot, stopsAtHero = !1) => {
    const skillRangeResult = skillRange(heroId, skillSlot)
    return { kind: "dash", distance: skillRangeResult, duration: skillRangeResult / skillValue(heroId, skillSlot, "dashSpeed"), wallBlocked: !0, stopsAtHero: stopsAtHero, destination: "aim" }
  },
  makeDamage = (damageType, extra = {}) => ({ type: damageType, base: "damage", hits: 1, interval: 0, repeatRatio: 1, nonHeroRatio: 1, ...extra }),
  HERO_ACTION_SPECS = {
    panyue: {
      s1: buildActionSpec("panyue", "s1", {
        roles: ["engage", "chase"],
        damage: makeDamage("physical", { ad: "adRatio" }),
        cc: [{ kind: "knockup", duration: skillValue("panyue", "s1", "knockup"), value: 0 }],
        mobility: makeDash("panyue", "s1", !0),
        lock: makeDash("panyue", "s1").duration,
        reach: skillRange("panyue", "s1") + skillValue("panyue", "s1", "impactRadius"),
        aoeRadius: skillValue("panyue", "s1", "impactRadius"),
        dodgeable: !0,
      }),
      s2: buildActionSpec("panyue", "s2", {
        roles: ["defense", "engage"],
        damage: makeDamage("magic"),
        cc: [{ kind: "slow", duration: skillValue("panyue", "s2", "slowDur"), value: skillValue("panyue", "s2", "slow") }],
        duration: skillValue("panyue", "s2", "duration"),
        selfBuffs: ["shield", "panyue_bulwark"],
      }),
      ult: buildActionSpec("panyue", "ult", {
        roles: ["engage", "zone"],
        damage: makeDamage("physical", { hp: "hpRatio" }),
        cc: [
          { kind: "knockup", duration: skillValue("panyue", "ult", "knockup"), value: 0 },
          { kind: "slow", duration: skillValue("panyue", "ult", "zoneDur"), value: skillValue("panyue", "ult", "slow") },
        ],
        mobility: { kind: "leap", distance: skillRange("panyue", "ult"), duration: skillValue("panyue", "ult", "leapTime"), wallBlocked: !1, stopsAtHero: !1, destination: "aim" },
        delay: skillValue("panyue", "ult", "leapTime"),
        duration: skillValue("panyue", "ult", "zoneDur"),
        lock: skillValue("panyue", "ult", "leapTime"),
        immunity: "unstoppable",
        dodgeable: !0,
      }),
    },
    chijin: {
      s1: buildActionSpec("chijin", "s1", {
        roles: ["burst", "waveclear"],
        damage: makeDamage("physical", { ad: "adRatio" }),
        cc: [{ kind: "slow", duration: skillValue("chijin", "s1", "slowDur"), value: skillValue("chijin", "s1", "slow") }],
        delay: getCastDelay("chijin", "s1"),
      }),
      s2: buildActionSpec("chijin", "s2", {
        roles: ["chase", "escape", "steroid"],
        damage: makeDamage("physical", { ad: "adRatio" }),
        mobility: makeDash("chijin", "s2"),
        lock: makeDash("chijin", "s2").duration,
        duration: skillValue("chijin", "s2", "asDur"),
        selfBuffs: ["chijin_blaze"],
      }),
      ult: buildActionSpec("chijin", "ult", {
        roles: ["burst", "zone", "waveclear"],
        damage: makeDamage("physical", { ad: "adRatio", hits: Math.round(skillValue("chijin", "ult", "duration") / skillValue("chijin", "ult", "tick")), interval: skillValue("chijin", "ult", "tick") }),
        delay: HERO_TABLE.chijin.skills.ult.castTime,
        duration: skillValue("chijin", "ult", "duration"),
        lock: 0,
        selfBuffs: ["chijin_spin", "dmg_reduction"],
        dodgeable: !0,
      }),
    },
    xingli: {
      s1: buildActionSpec("xingli", "s1", { roles: ["poke", "waveclear"], damage: makeDamage("magic", { ap: "apRatio" }), delay: getCastDelay("xingli", "s1"), projectileSpeed: skillValue("xingli", "s1", "speed"), dodgeable: !0 }),
      s2: buildActionSpec("xingli", "s2", {
        roles: ["engage", "zone", "waveclear"],
        damage: makeDamage("magic", { ap: "apRatio" }),
        cc: [
          { kind: "pull", duration: 0, value: skillValue("xingli", "s2", "pull") },
          { kind: "slow", duration: skillValue("xingli", "s2", "slowDur"), value: skillValue("xingli", "s2", "slow") },
        ],
        delay: skillValue("xingli", "s2", "delay"),
        dodgeable: !0,
      }),
      ult: buildActionSpec("xingli", "ult", {
        roles: ["burst", "zone", "waveclear"],
        damage: makeDamage("magic", { ap: "apRatio", hits: skillValue("xingli", "ult", "waves"), interval: skillValue("xingli", "ult", "duration") / skillValue("xingli", "ult", "waves") }),
        cc: [
          { kind: "slow", duration: skillValue("xingli", "ult", "slowDur"), value: skillValue("xingli", "ult", "slow") },
          { kind: "stun", duration: HERO_TABLE.xingli.passive.values.stun, value: 0 },
        ],
        delay: skillValue("xingli", "ult", "delay"),
        duration: skillValue("xingli", "ult", "duration"),
        dodgeable: !0,
      }),
    },
    fengling: {
      s1: buildActionSpec("fengling", "s1", {
        roles: ["poke", "waveclear"],
        damage: makeDamage("physical", { ad: "adRatio", nonHeroRatio: skillValue("fengling", "s1", "minionRatio") }),
        cc: [{ kind: "slow", duration: skillValue("fengling", "s1", "slowDur"), value: skillValue("fengling", "s1", "slow") }],
        delay: getCastDelay("fengling", "s1"),
        projectileSpeed: skillValue("fengling", "s1", "speed"),
        stopsAtFirstHero: !0,
        dodgeable: !0,
      }),
      s2: buildActionSpec("fengling", "s2", {
        roles: ["escape", "steroid"],
        autoAimsEnemy: !1,
        mobility: makeDash("fengling", "s2"),
        lock: makeDash("fengling", "s2").duration,
        duration: skillValue("fengling", "s2", "critWindow"),
        hitsNonHeroes: !1,
        selfBuffs: ["haste", "fengling_crit"],
      }),
      ult: buildActionSpec("fengling", "ult", {
        roles: ["zone", "waveclear", "burst"],
        damage: makeDamage("physical", { ad: "adRatio", hits: Math.round(skillValue("fengling", "ult", "duration") / skillValue("fengling", "ult", "tick")), interval: skillValue("fengling", "ult", "tick") }),
        cc: [{ kind: "slow", duration: skillValue("fengling", "ult", "slowDur"), value: skillValue("fengling", "ult", "slow") }],
        delay: skillValue("fengling", "ult", "delay"),
        duration: skillValue("fengling", "ult", "duration"),
        dodgeable: !0,
      }),
    },
    yeque: {
      s1: buildActionSpec("yeque", "s1", { roles: ["chase", "burst", "escape", "waveclear"], damage: makeDamage("physical", { ad: "adRatio" }), mobility: makeDash("yeque", "s1"), lock: makeDash("yeque", "s1").duration }),
      s2: buildActionSpec("yeque", "s2", {
        roles: ["poke", "burst", "waveclear"],
        damage: makeDamage("physical", { ad: "adRatio", hits: skillValue("yeque", "s2", "blades"), repeatRatio: skillValue("yeque", "s2", "repeatRatio") }),
        cc: [{ kind: "slow", duration: skillValue("yeque", "s2", "slowDur"), value: skillValue("yeque", "s2", "slow") }],
        delay: getCastDelay("yeque", "s2"),
        projectileSpeed: skillValue("yeque", "s2", "speed"),
        blockedByMinions: !0,
        stopsAtFirstHero: !0,
        dodgeable: !0,
      }),
      ult: buildActionSpec("yeque", "ult", {
        roles: ["execute", "chase", "burst"],
        damage: makeDamage("physical", { ad: "adRatio", missing: "missingRatio" }),
        mobility: { kind: "blink", distance: skillRange("yeque", "ult"), duration: skillValue("yeque", "ult", "vanish"), wallBlocked: !1, stopsAtHero: !1, destination: "behindTarget" },
        delay: skillValue("yeque", "ult", "vanish"),
        lock: skillValue("yeque", "ult", "vanish"),
        hitsNonHeroes: !1,
        immunity: "untargetable",
      }),
    },
  }

/**
 * 处理配置。
 *
 * @param heroId - 主要输入
 */
function __defaultActionSpec(heroId) {
  const config = {};
  for (const s1s2ult of ["s1", "s2", "ult"]) {
    const skillSpec = HERO_TABLE[heroId].skills[s1s2ult];
    if (!skillSpec) continue;
    const skillStats = skillSpec.values || {};
    const dmgType = skillStats.apRatio !== undefined ? "magic" : "physical";
    // 伤害映射按数值键动态填充；显式列出字段以消除 '{}' 无属性错误
    const damageConfig: { ad?: string; ap?: string; hp?: string; hits?: number | number[]; interval?: number | number[] } = {};
    if (skillStats.adRatio !== undefined) damageConfig.ad = "adRatio";
    if (skillStats.apRatio !== undefined) damageConfig.ap = "apRatio";
    if (skillStats.hpRatio !== undefined) damageConfig.hp = "hpRatio";
    if (skillStats.hits) damageConfig.hits = skillStats.hits;
    if (skillStats.tick) damageConfig.interval = skillStats.tick;
    const entry = {
      roles: skillSpec.tags && skillSpec.tags.includes("dash") ? ["engage", "chase"] : ["poke"],
      damage: makeDamage(dmgType, damageConfig),
      cc: [],
      mobility: null,
      delay: skillStats.delay !== undefined ? skillStats.delay : 0,
      projectileSpeed: skillStats.speed !== undefined ? skillStats.speed : 0,
      hitsNonHeroes: !0,
      duration: skillStats.duration !== undefined ? skillStats.duration : 0,
      lock: skillSpec.castTime,
      selfBuffs: [],
      immunity: null,
      dodgeable: !1,
    };
    if (skillStats.knockup) entry.cc.push({ kind: "knockup", duration: skillStats.knockup, value: 0 });
    if (skillStats.stun) entry.cc.push({ kind: "stun", duration: skillStats.stun, value: 0 });
    if (skillStats.slow) entry.cc.push({ kind: "slow", duration: skillStats.slowDur || 1, value: skillStats.slow });
    if (skillSpec.cast && skillSpec.cast.type === "direction" && (skillStats.dashSpeed || skillStats.speed)) entry.mobility = makeDash(heroId, s1s2ult, !0);
    if (entry.mobility) entry.lock = entry.mobility.duration;
    // entry 为自动抽取的对象字面量，reach 由运行期按施法范围补写；经 unknown 中转断言允许该赋值
    (entry as unknown as { reach?: number }).reach = skillRange(heroId, s1s2ult);
    config[s1s2ult] = entry;
  }
  return config;
}

const SKILL_PRIORITY_BY_HERO = { panyue: ["ult", "s1", "s2"], chijin: ["s2", "ult", "s1"], xingli: ["s2", "ult", "s1"], fengling: ["s1", "ult", "s2"], yeque: ["s2", "s1", "ult"] },
  AREA_THREAT_KIND_BY_VISUAL = {
    telegraph: "incoming",
    xingli_s2_well: "incoming",
    chijin_ult_spin: "damage",
    xingli_ult_storm: "damage",
    fengling_ult_rain: "damage",
    panyue_ult_fissure: "slow",
    panyue_s2_aura: "none",
    fountain_zone: "none",
  }

function damageReductionMultiplier(unit) {
  let reductionFactor = 1
  for (const damageBuff of unit.buffs) damageBuff.id === "dmg_reduction" && (reductionFactor *= 1 - Math.min(1, Math.max(0, damageBuff.value)))
  return reductionFactor < 1 ? Math.max(0.2, reductionFactor) : 1
}

/**
 * 更新伤害。
 *
 * @param result - 输入
 * @param trueKind - 输入
 * @param attackerUnit - 第三输入
 * @param defenderUnit - 第四输入
 * @returns 数值结果
 */
function applyDamageMitigation(result, trueKind, attackerUnit, defenderUnit) {
  if (trueKind === "true") return result
  const effectiveResistance = trueKind === "physical" ? defenderUnit.stats.armor * (1 - attackerUnit.stats.armorPen) : defenderUnit.stats.mr * (1 - attackerUnit.stats.magicPen)
  return (result * 600) / (600 + Math.max(0, effectiveResistance))
}

/**
 * 计算技能与伤害。
 *
 * @param heroUnit - 英雄
 * @param skillSlot - 次要输入
 * @param targetUnit - 第三输入
 * @param hitCount - 第四输入
 * @returns 数值结果
 */
function computeSkillDamageBase(heroUnit, skillSlot, targetUnit?, hitCount?) {
  const damageSpec = HERO_ACTION_SPECS[heroUnit.heroId][skillSlot].damage,
    skillLevel = heroUnit.skills[skillSlot].level
  if (!damageSpec || skillLevel <= 0) return 0
  const skillSpec = HERO_TABLE[heroUnit.heroId].skills[skillSlot],
    scaleStat = (rawStat) => (rawStat ? Nh(skillSpec, rawStat, skillLevel) : 0)
  let total = scaleStat(damageSpec.base) + scaleStat(damageSpec.ad) * heroUnit.stats.ad + scaleStat(damageSpec.ap) * heroUnit.stats.ap + scaleStat(damageSpec.hp) * heroUnit.stats.maxHp
  ;(targetUnit && damageSpec.missing && (total += scaleStat(damageSpec.missing) * Math.max(0, targetUnit.stats.maxHp - targetUnit.hp)), targetUnit && targetUnit.kind !== "hero" && (total *= damageSpec.nonHeroRatio))
  const effectiveHits = Math.max(0, Math.min(damageSpec.hits, hitCount ?? damageSpec.hits))
  return effectiveHits <= 0 ? 0 : total * (1 + (effectiveHits - 1) * damageSpec.repeatRatio)
}

function passiveExecuteBonus(heroUnit, targetUnit) {
  if (heroUnit.heroId !== "yeque" || targetUnit.kind === "tower" || targetUnit.kind === "core") return 1
  // 被动数值在契约中声明为 Num（number | number[]），此处实际按标量参与运算；经 unknown 中转断言为 number 字段
  const passiveConfig = HERO_TABLE.yeque.passive.values as unknown as { threshold: number; bonus: number; monsterBonus: number }
  let bonusMultiplier = 1
  return (targetUnit.hp < targetUnit.stats.maxHp * passiveConfig.threshold && (bonusMultiplier *= 1 + passiveConfig.bonus), targetUnit.kind === "monster" && (bonusMultiplier *= 1 + passiveConfig.monsterBonus), bonusMultiplier)
}

/**
 * 计算技能与伤害。
 *
 * @param heroUnit - 英雄
 * @param skillSlot - 次要输入
 * @param targetUnit - 第三输入
 * @param hitCount - 第四输入
 * @returns 数值结果
 */
function computeSkillDamage(heroUnit, skillSlot, targetUnit, hitCount?) {
  const damageSpec = HERO_ACTION_SPECS[heroUnit.heroId][skillSlot].damage
  if (!damageSpec) return 0
  const rawDamage = computeSkillDamageBase(heroUnit, skillSlot, targetUnit, hitCount) * passiveExecuteBonus(heroUnit, targetUnit) * damageReductionMultiplier(targetUnit)
  return applyDamageMitigation(rawDamage, damageSpec.type, heroUnit, targetUnit)
}

/**
 * 计算伤害。
 *
 * @param heroUnit - 英雄
 * @param targetUnit - 次要输入
 */
function computeBasicAttackDamage(heroUnit, targetUnit) {
  const heroStats = heroUnit.stats,
    basicAttackDamageType = heroUnit.kind === "hero" ? HERO_TABLE[heroUnit.heroId].basicAttack.damageType : "physical",
    critChance = targetUnit.kind === "tower" || targetUnit.kind === "core" ? 0 : heroStats.critChance
  let rawBasicAttackDamage = heroStats.ad * (1 + critChance * (heroStats.critDamage - 1)) * damageReductionMultiplier(targetUnit)
  return (heroUnit.kind === "hero" && (rawBasicAttackDamage *= passiveExecuteBonus(heroUnit, targetUnit)), applyDamageMitigation(rawBasicAttackDamage, basicAttackDamageType, heroUnit, targetUnit))
}

/**
 * 处理技能。
 *
 * @param heroUnit - 英雄
 * @param targetUnit - 次要输入
 * @param skillPriority - 第三输入
 */
function chooseCastableSkill(heroUnit, targetUnit, skillPriority = SKILL_PRIORITY_BY_HERO[heroUnit.heroId] || ["s2", "ult", "s1"]) {
  let availableMana = heroUnit.mana,
    total = 0
  for (const skillSlot of skillPriority) {
    const skillSpec = heroUnit.skills[skillSlot]
    skillSpec.level <= 0 || skillSpec.cd > 0 || availableMana < skillSpec.cost || ((availableMana -= skillSpec.cost), (total += computeSkillDamage(heroUnit, skillSlot, targetUnit)))
  }
  return total
}

const MOVE_GOAL_TOLERANCE = 0.9,
  STUCK_CHECK_INTERVAL = 1.4,
  STUCK_DISTANCE_THRESHOLD = 0.35

class UnitCommander {
  v
  goalX = 1e9
  goalY = 1e9
  checkX = 0
  checkY = 0
  checkAt = 0
  stuckCount = 0
  moved = !1
  lastCastAt = -99
  begin(viewState) {
    ;((this.v = viewState), (this.moved = !1))
  }
  moveTo(targetX, targetY, ignoreWindup = !1) {
    if (this.moved) return
    const vState = this.v,
      heroUnit = vState.hero
    if (!ignoreWindup && vState.attackWindup()) {
      this.moved = !0
      return
    }
    if (((this.moved = !0), Math.hypot(targetX - heroUnit.pos.x, targetY - heroUnit.pos.y) < 0.4)) {
      this.halt()
      return
    }
    const currentTime = vState.time,
      orderStateResult = vState.orderState(),
      distance = Math.hypot(targetX - this.goalX, targetY - this.goalY) < MOVE_GOAL_TOLERANCE
    if (orderStateResult === 2 && distance) {
      if (currentTime - this.checkAt >= STUCK_CHECK_INTERVAL) {
        const hasMovedSinceCheck = Math.hypot(heroUnit.pos.x - this.checkX, heroUnit.pos.y - this.checkY) > STUCK_DISTANCE_THRESHOLD
        if (((this.checkAt = currentTime), (this.checkX = heroUnit.pos.x), (this.checkY = heroUnit.pos.y), hasMovedSinceCheck || vState.busy())) this.stuckCount = 0
        else if ((this.stuckCount++, this.stuckCount >= 2)) {
          const escapeAngle = vState.rng.range(0, Math.PI * 2)
          ;(vState.command({ type: "moveTo", pos: vState.nearestWalkable({ x: heroUnit.pos.x + Math.cos(escapeAngle) * 3, y: heroUnit.pos.y + Math.sin(escapeAngle) * 3 }) }), (this.goalX = 1e9), (this.stuckCount = 0))
        } else vState.command({ type: "moveTo", pos: vState.nearestWalkable({ x: targetX, y: targetY }) })
      }
      return
    }
    ;((this.goalX = targetX), (this.goalY = targetY), (this.checkAt = currentTime), (this.checkX = heroUnit.pos.x), (this.checkY = heroUnit.pos.y), vState.command({ type: "moveTo", pos: { x: targetX, y: targetY } }))
  }
  moveDir(directionX, directionY, ignoreWindup = !1) {
    if (this.moved) return
    const vValue = this.v
    if (!ignoreWindup && vValue.attackWindup()) {
      this.moved = !0
      return
    }
    ;((this.moved = !0), (this.goalX = 1e9), vValue.command({ type: "move", dir: { x: directionX, y: directionY } }))
  }
  attack(targetId) {
    if (this.moved) return
    this.moved = !0
    const viewState = this.v
    ;(viewState.orderState() === 3 && viewState.orderTargetId() === targetId) || ((this.goalX = 1e9), viewState.command({ type: "attack", targetId: targetId }))
  }
  halt() {
    if (this.moved) return
    this.moved = !0
    const viewState = this.v
    ;(viewState.orderState() !== 0 && !viewState.attackWindup() && viewState.command({ type: "stop" }), (this.goalX = 1e9))
  }
  castAt(skillSlot, targetPoint) {
    ;((this.lastCastAt = this.v.time), this.v.command({ type: "cast", slot: skillSlot, pos: { x: targetPoint.x, y: targetPoint.y } }))
  }
  castDir(skillSlot, directionX, directionY) {
    ;((this.lastCastAt = this.v.time), this.v.command({ type: "cast", slot: skillSlot, dir: { x: directionX, y: directionY } }))
  }
  castTarget(skillSlot, targetId) {
    ;((this.lastCastAt = this.v.time), this.v.command({ type: "cast", slot: skillSlot, targetId: targetId }))
  }
  castSelf(skillSlot) {
    ;((this.lastCastAt = this.v.time), this.v.command({ type: "cast", slot: skillSlot }))
  }
  forget() {
    this.goalX = 1e9
  }
}

function resolveDifficulty(easyKind, enemyCount) {
  return easyKind === "easy" ? (enemyCount === 1 ? "novice" : "easy") : enemyCount === 1 ? easyKind : "normal"
}

function hitCountFalloff(hitCount) {
  return hitCount >= 5 ? 0.55 : hitCount > 1 ? 0.75 : 0.85
}

function effectiveHp(targetUnit) {
  return (targetUnit.hp + targetUnit.shield) * (1 + ((targetUnit.stats.armor + targetUnit.stats.mr) * 0.5) / 600)
}

function estimateAttackDps(heroUnit) {
  const heroStats = heroUnit.stats
  return heroStats.ad * heroStats.attackSpeed * (1 + heroStats.critChance * (heroStats.critDamage - 1))
}

function estimateFightHorizon(heroUnit, canUseSkill) {
  const fightHorizon = AI_TUNING.fightHorizon
  let total = estimateAttackDps(heroUnit) * fightHorizon * (heroUnit.stats.attackRange < 4 ? 0.8 : 1)
  for (let index = 0; index < SKILL_SLOTS.length; index++) {
    const selectedSKILL_SLOTS = SKILL_SLOTS[index]
    if (heroUnit.skills[selectedSKILL_SLOTS].level <= 0) continue
    const damageSpec = HERO_ACTION_SPECS[heroUnit.heroId][selectedSKILL_SLOTS].damage
    if (!damageSpec) continue
    const skillDamage = computeSkillDamageBase(heroUnit, selectedSKILL_SLOTS) * hitCountFalloff(damageSpec.hits)
    total += canUseSkill(selectedSKILL_SLOTS) ? skillDamage : skillDamage * 0.2
  }
  return total
}

function allyProximityFactor(allyDistance) {
  return allyDistance <= AI_TUNING.allyNear ? 1 : allyDistance >= AI_TUNING.allyFar ? 0 : 1 - (allyDistance - AI_TUNING.allyNear) / (AI_TUNING.allyFar - AI_TUNING.allyNear)
}

function foeProximityFactor(foeDistance) {
  return foeDistance <= AI_TUNING.foeNear ? 1 : foeDistance >= AI_TUNING.foeFar ? 0 : 1 - (foeDistance - AI_TUNING.foeNear) / (AI_TUNING.foeFar - AI_TUNING.foeNear)
}

/**
 * 处理技能与伤害。
 *
 * @param heroUnit - 英雄
 * @param targetUnit - 次要输入
 * @param canUseSkill - 输入
 */
function estimateSkillDamage(heroUnit, targetUnit, canUseSkill) {
  let total = 2 * computeBasicAttackDamage(heroUnit, targetUnit)
  for (let index = 0; index < SKILL_SLOTS.length; index++) {
    const skillSlot = SKILL_SLOTS[index]
    if (heroUnit.skills[skillSlot].level <= 0 || !canUseSkill(skillSlot)) continue
    const damageSpec = HERO_ACTION_SPECS[heroUnit.heroId][skillSlot].damage
    damageSpec && (total += computeSkillDamage(heroUnit, skillSlot, targetUnit) * hitCountFalloff(damageSpec.hits))
  }
  return total
}

function expectedDps(heroUnit) {
  return heroUnit.stats.ad * heroUnit.stats.attackSpeed * 1.4 * AI_TUNING.fightHorizon
}

/**
 * 处理时长。
 *
 * @param totalDamage - 累计值
 * @param damageFactor - 次要输入
 * @param defenseFactor - 第三输入
 * @param resistanceFactor - 第四输入
 */
function estimateTimeToKill(totalDamage, damageFactor, defenseFactor, resistanceFactor) {
  const scaledDamage = totalDamage * damageFactor,
    scaledDefense = defenseFactor * resistanceFactor
  return scaledDefense <= 1 ? 9 : Math.min(9, Math.sqrt(scaledDamage / scaledDefense))
}

/**
 * 处理距离。
 *
 * @param pointX - 主要输入
 * @param pointY - 次要输入
 * @param segmentStartX - 第三输入
 * @param segmentStartY - 第四输入
 * @param segmentEndX - 附加输入
 * @param segmentEndY - 附加输入
 * @returns 数值结果
 */
function pointSegmentDistanceSq(pointX, pointY, segmentStartX, segmentStartY, segmentEndX, segmentEndY) {
  const projectParamOnSegmentResult = projectParamOnSegment(pointX, pointY, segmentStartX, segmentStartY, segmentEndX, segmentEndY),
    offsetX = segmentStartX + (segmentEndX - segmentStartX) * projectParamOnSegmentResult - pointX,
    offsetY = segmentStartY + (segmentEndY - segmentStartY) * projectParamOnSegmentResult - pointY
  return offsetX * offsetX + offsetY * offsetY
}

function dist2(pointFrom, pointTo) {
  return Math.hypot(pointFrom.x - pointTo.x, pointFrom.y - pointTo.y)
}

function clampToRange(inputAmount, lowerBound, upperBound) {
  return inputAmount < lowerBound ? lowerBound : inputAmount > upperBound ? upperBound : inputAmount
}

/**
 * 判断坐标。
 *
 * @param targetPoint - 输入
 * @param targetRadius - 次要输入
 * @param coneSource - 第三输入
 * @param extraPadding - 第四输入
 */
function isPointInCone(targetPoint, targetRadius, coneSource, extraPadding = 0) {
  const offsetX = targetPoint.x - coneSource.pos.x,
    offsetY = targetPoint.y - coneSource.pos.y,
    distance = Math.hypot(offsetX, offsetY),
    effectiveRadius = targetRadius + extraPadding
  return distance > coneSource.radius + effectiveRadius ? !1 : distance <= effectiveRadius ? !0 : Math.atan2(Math.abs(offsetY * coneSource.dir.x - offsetX * coneSource.dir.y), offsetX * coneSource.dir.x + offsetY * coneSource.dir.y) <= coneSource.angle * 0.5 + Math.asin(effectiveRadius / distance)
}

/**
 * 判断目标与碰撞。
 *
 * @param targetPoint - 输入
 * @param targetRadius - 半径
 * @param coneSource - 第三输入
 * @param aimPoint - 输入
 * @param validatePoint - 输入
 * @param outputPoint - 输入
 * @param extraPadding - 附加输入
 */
function canHitTarget(targetPoint, targetRadius, coneSource, aimPoint, validatePoint, outputPoint, extraPadding = 0.4) {
  if (!isPointInCone(targetPoint, targetRadius, coneSource, extraPadding)) return !1
  const offsetX = targetPoint.x - coneSource.pos.x,
    offsetY = targetPoint.y - coneSource.pos.y,
    distance = Math.hypot(offsetX, offsetY),
    effectiveTargetRadius = targetRadius + extraPadding,
    lateralOffset = offsetY * coneSource.dir.x - offsetX * coneSource.dir.y,
    angleOffAxis = Math.atan2(Math.abs(lateralOffset), offsetX * coneSource.dir.x + offsetY * coneSource.dir.y),
    angleLimit = coneSource.angle * 0.5 + (distance > effectiveTargetRadius ? Math.asin(effectiveTargetRadius / distance) : Math.PI),
    arcDistance = distance * Math.max(0, angleLimit - angleOffAxis)
  if (coneSource.radius + effectiveTargetRadius - distance < arcDistance && distance > 0.3) return ((outputPoint.x = offsetX / distance), (outputPoint.y = offsetY / distance), !0)
  let sideSign = lateralOffset >= 0 ? 1 : -1
  return (
    Math.abs(lateralOffset) < 0.25 && (sideSign = (aimPoint.y - targetPoint.y) * coneSource.dir.x - (aimPoint.x - targetPoint.x) * coneSource.dir.y >= 0 ? 1 : -1),
    (outputPoint.x = -coneSource.dir.y * sideSign),
    (outputPoint.y = coneSource.dir.x * sideSign),
    (scratchPointAlt.x = targetPoint.x + outputPoint.x * 1.6),
    (scratchPointAlt.y = targetPoint.y + outputPoint.y * 1.6),
    validatePoint(scratchPointAlt) || ((outputPoint.x = -outputPoint.x), (outputPoint.y = -outputPoint.y)),
    !0
  )
}

const scratchPointAlt = { x: 0, y: 0 }

const scratchPoint = { x: 0, y: 0 },
  AIM_SCATTER_POINT = { x: 0, y: 0 }

function hasBuffById(targetUnit, buffId) {
  for (let index = 0; index < targetUnit.buffs.length; index++) if (targetUnit.buffs[index].id === buffId) return !0
  return !1
}

/**
 * 处理时长。
 *
 * @param targetUnit - 输入
 */
function maxCrowdControlDuration(targetUnit) {
  let maxDuration = 0
  for (let index = 0; index < targetUnit.buffs.length; index++) {
    const selectedBuffs = targetUnit.buffs[index]
    ;(selectedBuffs.id === "stun" || selectedBuffs.id === "airborne" || selectedBuffs.id === "root") && (maxDuration = Math.max(maxDuration, selectedBuffs.timeLeft))
  }
  return maxDuration
}

function isTargetSlowed(targetUnit) {
  return hasBuffById(targetUnit, "slow")
}

function canCastComboSkill(worldState, skillSlot, ignoreComboGap = !1) {
  return worldState.v.skillReady(skillSlot) ? (ignoreComboGap ? !0 : worldState.time - worldState.act.lastCastAt < worldState.prof.comboGap ? !1 : !worldState.v.attackWindup()) : !1
}

function availableManaFraction(worldState, skillSlot) {
  return (worldState.me.mana - worldState.me.skills[skillSlot].cost) / Math.max(1, worldState.me.stats.maxMana)
}

/**
 * 处理坐标。
 *
 * @param worldState - 主要输入
 * @param targetUnit - 次要输入
 * @param castDelay - 输入
 * @param projectileSpeed - 第四输入
 * @param outputPoint - 输入
 */
function predictLeadAimPoint(worldState, targetUnit, castDelay, projectileSpeed, outputPoint) {
  const selfPlayer = worldState.me
  let velocityX = (targetUnit.pos.x - targetUnit.prevPos.x) / AREA_ALPHA_AGE_SCALE,
    velocityY = (targetUnit.pos.y - targetUnit.prevPos.y) / AREA_ALPHA_AGE_SCALE
  ;(Math.hypot(velocityX, velocityY) > 12 || maxCrowdControlDuration(targetUnit) > 0.05) && ((velocityX = 0), (velocityY = 0))
  let total = castDelay
  return (projectileSpeed > 0 && (total += Math.hypot(targetUnit.pos.x - selfPlayer.pos.x, targetUnit.pos.y - selfPlayer.pos.y) / projectileSpeed), (total = Math.min(1, total) * worldState.prof.aimLead), (outputPoint.x = targetUnit.pos.x + velocityX * total), (outputPoint.y = targetUnit.pos.y + velocityY * total), outputPoint)
}

function castDirectionWithError(worldState, skillSlot, aimPoint) {
  const meValue = worldState.me,
    aimAngle = Math.atan2(aimPoint.y - meValue.pos.y, aimPoint.x - meValue.pos.x) + worldState.v.rng.range(-1, 1) * worldState.prof.aimError
  worldState.act.castDir(skillSlot, Math.cos(aimAngle), Math.sin(aimAngle))
}

function castAtWithScatter(worldState, skillSlot, aimPoint) {
  const selfPlayer = worldState.me,
    distance = Math.hypot(aimPoint.x - selfPlayer.pos.x, aimPoint.y - selfPlayer.pos.y) * worldState.prof.aimError,
    scatterAngle = worldState.v.rng.range(0, Math.PI * 2),
    scatterDistance = worldState.v.rng.next() * distance
  ;((AIM_SCATTER_POINT.x = aimPoint.x + Math.cos(scatterAngle) * scatterDistance), (AIM_SCATTER_POINT.y = aimPoint.y + Math.sin(scatterAngle) * scatterDistance), worldState.act.castAt(skillSlot, AIM_SCATTER_POINT))
}

/**
 * 处理坐标。
 *
 * @param worldState - 主要输入
 * @param aimPoint - 输入
 * @param effectRadius - 第三输入
 * @param castDelay - 第四输入
 */
function countFoesNearAimPoint(worldState, aimPoint, effectRadius, castDelay) {
  let foeCount = 0
  for (const foeUnit of worldState.foes) (predictLeadAimPoint(worldState, foeUnit, castDelay, 0, scratchPoint), Math.hypot(scratchPoint.x - aimPoint.x, scratchPoint.y - aimPoint.y) <= effectRadius + foeUnit.radius * 0.5 && foeCount++)
  return foeCount
}

/**
 * 查找坐标。
 *
 * @param worldState - 输入
 * @param primaryTarget - 输入
 * @param effectRadius - 输入
 * @param maxRange - 第四输入
 * @param castDelay - 输入
 * @param bestAimPoint - 输入
 */
function findBestAoeAimPoint(worldState, primaryTarget, effectRadius, maxRange, castDelay, bestAimPoint) {
  const selfPlayer = worldState.me
  predictLeadAimPoint(worldState, primaryTarget, castDelay, 0, bestAimPoint)
  let countFoesNearAimPointResult = countFoesNearAimPoint(worldState, bestAimPoint, effectRadius, castDelay)
  const coordX = bestAimPoint.x,
    coordY = bestAimPoint.y
  for (const candidateFoe of worldState.foes) {
    if (candidateFoe === primaryTarget) continue
    predictLeadAimPoint(worldState, candidateFoe, castDelay, 0, scratchPoint)
    const centerX = (coordX + scratchPoint.x) * 0.5,
      centerY = (coordY + scratchPoint.y) * 0.5
    if (Math.hypot(centerX - coordX, centerY - coordY) > effectRadius * 0.8 || Math.hypot(centerX - selfPlayer.pos.x, centerY - selfPlayer.pos.y) > maxRange) continue
    ;((AIM_SCATTER_POINT.x = centerX), (AIM_SCATTER_POINT.y = centerY))
    const midpointFoeCount = countFoesNearAimPoint(worldState, AIM_SCATTER_POINT, effectRadius, castDelay)
    midpointFoeCount > countFoesNearAimPointResult && ((countFoesNearAimPointResult = midpointFoeCount), (bestAimPoint.x = centerX), (bestAimPoint.y = centerY))
  }
  return countFoesNearAimPointResult
}

/**
 * 判断小兵。
 *
 * @param worldState - 输入
 * @param targetPoint - 输入
 * @param casterRadius - 第三输入
 */
function isLineBlockedByMinions(worldState, targetPoint, casterRadius) {
  const selfPlayer = worldState.me,
    aimOffsetX = targetPoint.x - selfPlayer.pos.x,
    aimOffsetY = targetPoint.y - selfPlayer.pos.y,
    distance = Math.hypot(aimOffsetX, aimOffsetY)
  if (distance < 0.5) return !1
  const aimDirX = aimOffsetX / distance,
    aimDirY = aimOffsetY / distance
  for (const foeMinion of worldState.foeMinions) {
    const minionOffsetX = foeMinion.pos.x - selfPlayer.pos.x,
      minionOffsetY = foeMinion.pos.y - selfPlayer.pos.y,
      projectedDistance = minionOffsetX * aimDirX + minionOffsetY * aimDirY
    if (!(projectedDistance < 0.3 || projectedDistance > distance - 0.3) && Math.abs(minionOffsetX * aimDirY - minionOffsetY * aimDirX) < casterRadius + foeMinion.radius) return !0
  }
  return !1
}

function computeClusterCenter(candidateUnits, clusterRadius, centerPoint) {
  if (candidateUnits.length === 0) return 0
  let total = 0,
    sumY = 0
  for (const candidateUnit of candidateUnits) ((total += candidateUnit.pos.x), (sumY += candidateUnit.pos.y))
  ;((centerPoint.x = total / candidateUnits.length), (centerPoint.y = sumY / candidateUnits.length))
  let clusterCount = 0
  for (const clusterUnit of candidateUnits) Math.hypot(clusterUnit.pos.x - centerPoint.x, clusterUnit.pos.y - centerPoint.y) <= clusterRadius + clusterUnit.radius && clusterCount++
  return clusterCount
}

/**
 * 处理目标。
 *
 * @param worldState - 主要输入
 * @param candidateUnits - 次要输入
 * @param aimDirX - 第三输入
 * @param aimDirY - 第四输入
 * @param bandLength - 附加输入
 * @param bandWidth - 附加输入
 */
function countTargetsInBand(worldState, candidateUnits, aimDirX, aimDirY, bandLength, bandWidth) {
  const selfPlayer = worldState.me,
    distance = Math.hypot(aimDirX, aimDirY) || 1,
    normDirX = aimDirX / distance,
    normDirY = aimDirY / distance
  let targetCount = 0
  for (const candidateUnit of candidateUnits) {
    const unitOffsetX = candidateUnit.pos.x - selfPlayer.pos.x,
      unitOffsetY = candidateUnit.pos.y - selfPlayer.pos.y,
      projectedDistance = unitOffsetX * normDirX + unitOffsetY * normDirY
    projectedDistance < 0 || projectedDistance > bandLength + candidateUnit.radius || (Math.abs(unitOffsetX * normDirY - unitOffsetY * normDirX) <= bandWidth + candidateUnit.radius && targetCount++)
  }
  return targetCount
}

function canCastAlongLine(worldState, aimDirX, aimDirY, castRange) {
  const selfPlayer = worldState.me
  return ((scratchPoint.x = selfPlayer.pos.x + aimDirX * castRange), (scratchPoint.y = selfPlayer.pos.y + aimDirY * castRange), worldState.v.lineClear(selfPlayer.pos, scratchPoint) ? worldState.diving || worldState.v.enemyStructureCovering(scratchPoint, AI_TUNING.towerMargin) === null : !1)
}

function getScaledSkillValue(heroUnit, skillSlot, statKey) {
  return Nh(HERO_TABLE[heroUnit.heroId].skills[skillSlot], statKey, Math.max(1, heroUnit.me.skills[skillSlot].level))
}

export { getSkillValueRaw, castDirectionWithError, AREA_THREAT_KIND_BY_VISUAL, castAtWithScatter, scratchPoint, getCastRange, canCastAlongLine, isTargetSlowed, computeClusterCenter, getCastDelay, pointSegmentDistanceSq, makeDamage, getScaledSkillValue, countTargetsInBand, computeSkillDamage, SKILL_PRIORITY_BY_HERO, HERO_ACTION_SPECS, hasBuffById, computeBasicAttackDamage, estimateAttackDps, UnitCommander, clampToRange, findBestAoeAimPoint, __defaultActionSpec, predictLeadAimPoint, allyProximityFactor, isLineBlockedByMinions, buildActionSpec, canHitTarget, chooseCastableSkill, makeDash, dist2, effectiveHp, estimateFightHorizon, estimateSkillDamage, estimateTimeToKill, expectedDps, foeProximityFactor, skillRange, resolveDifficulty, maxCrowdControlDuration, canCastComboSkill, availableManaFraction, skillValue }