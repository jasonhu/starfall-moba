/**
 * 战斗横幅：击杀/连杀提示条创建与动画
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { HERO_IDS, HERO_TABLE } from '../../heroes/registry'
import { LIGHT_TARGET_SCRATCH } from '../render/scene-rigs'
import { createEl, createIconEl, iconFor, injectStyleSheet, makeIconByName } from './dom-kit'
import { z0 } from '../skills/skill-values'
import { BANNER_ANIM_FAST, BANNER_ANIM_MID, BANNER_ANIM_SLOW, BANNER_MAX_STREAK, BANNER_SCALE_BY_STREAK, BANNER_WIDTH_BY_STREAK, HUD_BANNER_CSS } from './hud-banner-styles'
import { EVENT_PRIORITIES, KILL_FEED_LABELS } from './icon-theme'
import { MONSTER_STATS } from '../game-balance'
import { describeCampBuff, riverNameFor } from '../render/procedural-art'
import { formatTowerLabel } from '../equipment'

const HERO_ID_LIST = HERO_IDS,
  ROLE_TINT_COLORS = { tank: "#8fb8e8", fighter: "#ff9466", mage: "#9aa8ff", marksman: "#7fe6b6", assassin: "#c3a0ff" },
  ABILITY_LABELS = { survive: "生存", damage: "输出", control: "控制", mobility: "机动", ease: "上手" },
  ABILITY_KEYS = ["survive", "damage", "control", "mobility", "ease"],
  ROLE_BRIEF_TEXTS = {
    tank: "皮厚能扛，冲在最前面替队友挡伤害",
    fighter: "能打也能扛，贴上去近身缠斗",
    mage: "站在后排放法术，伤害高、身板脆",
    marksman: "远远地普攻输出，越到后期越厉害",
    assassin: "专挑残血和脆皮下手，来去都快",
  },
  __heroRow = /**
 * 处理英雄。
 *
 * @param table - 输入
 * @param heroId - 英雄
 */
(table, heroId) => {
    // 按英雄 id 查表；新英雄没登记时，回退到它在 __STARFALL_HERO_BASE__ 里登记的外观宿主
    const selectedTable = table[heroId]
    if (selectedTable) return selectedTable
    const selected__STARFALL_HERO_BASE__ = (globalThis.__STARFALL_HERO_BASE__ || {})[heroId]
    return selected__STARFALL_HERO_BASE__ ? table[selected__STARFALL_HERO_BASE__] : void 0
  },
  heroRoleTag = {
    panyue: { survive: 9.6, damage: 4.6, control: 9.4, mobility: 5.4, ease: 9 },
    chijin: { survive: 7.2, damage: 7.6, control: 4.4, mobility: 7.4, ease: 7 },
    xingli: { survive: 4.2, damage: 9, control: 8, mobility: 2.6, ease: 6.2 },
    fengling: { survive: 3.8, damage: 9.6, control: 5, mobility: 6.8, ease: 6.6 },
    yeque: { survive: 5.4, damage: 9.2, control: 3.4, mobility: 9.6, ease: 3.6 },
    xiangyu: { survive: 8.4, damage: 6.6, control: 8.2, mobility: 6.4, ease: 6.8 },
  },
  killFeedLine = {
    easy: { label: "简单", desc: "敌人反应慢、技能不准、很少越线；队友也不强，输赢看你。适合第一次玩。" },
    normal: { label: "普通", desc: "AI 会补兵换血、游走抱团，接近普通玩家。" },
    hard: { label: "困难", desc: "AI 反应快，会集火、反蹲与连招收割。" },
  },
  streakBannerText = ["easy", "normal", "hard"],
  BANNER_ANIM_CACHE = new Set()

function heroNameForBanner(portraitHost, heroId, cssClasses?) {
  const selectedHERO_TABLE = HERO_TABLE[heroId],
    element = createEl("span", `sf-portrait${cssClasses ? ` ${cssClasses}` : ""}`, createIconEl(makeIconByName(selectedHERO_TABLE.role), "sf-portrait__fallback"))
  ;(element.style.setProperty("--sf-hero-a", selectedHERO_TABLE.palette.primary), element.style.setProperty("--sf-hero-b", selectedHERO_TABLE.palette.secondary), element.style.setProperty("--sf-hero-c", selectedHERO_TABLE.palette.glow))
  let lookupKey = ""
  try {
    lookupKey = portraitHost.portrait(heroId)
  } catch {
    lookupKey = ""
  }
  if (lookupKey) {
    const ElementValue = document.createElement("img")
    ;((ElementValue.alt = z0(selectedHERO_TABLE)), (ElementValue.draggable = !1))
    const hasResult = BANNER_ANIM_CACHE.has(lookupKey)
    ;((ElementValue.decoding = hasResult ? "sync" : "async"),
      hasResult && element.classList.add("is-loaded"),
      ElementValue.addEventListener("load", () => {
        ;(BANNER_ANIM_CACHE.add(lookupKey), element.classList.add("is-loaded"))
      }),
      ElementValue.addEventListener("error", () => {
        ;(element.classList.remove("is-loaded"), ElementValue.remove())
      }),
      (ElementValue.src = lookupKey),
      element.appendChild(ElementValue))
  }
  return element
}

function bannerTeamClass(teamId, ownTeamId, isPlayer = !1) {
  return isPlayer ? "is-me" : teamId === ownTeamId ? "is-blue" : "is-red"
}

function heroBannerLabel(portraitHost, heroUnit, ownTeamId, cssClasses = "") {
  return heroNameForBanner(portraitHost, heroUnit.heroId, `sf-hud__face ${bannerTeamClass(heroUnit.team, ownTeamId, heroUnit.isPlayer)}${cssClasses ? ` ${cssClasses}` : ""}`)
}

function makeBannerTag(iconName, cssClasses = "") {
  return createEl("span", `sf-hud__face sf-hud__face--glyph${cssClasses ? ` ${cssClasses}` : ""}`, createIconEl(iconName))
}

function createBanner() {
  injectStyleSheet("sf-hud-banner", HUD_BANNER_CSS)
  const element = createEl("div", "sf-hud__banner-wrap")
  element.setAttribute("aria-live", "polite")
  const pendingBanners = []
  let activeBanner = null
  const pendingEvents = []
  let lastEpicMonsterType = null,
    lastEpicSpawnPos = null,
    lastTowerEvent = null
  const eventSnapshots = new Map(),
    recordEvent = (lookupKey) => {
      ;(lookupKey.type === "announce" && eventSnapshots.set(lookupKey, { epic: lastEpicMonsterType, epicPos: lastEpicSpawnPos, tower: lastTowerEvent }), pendingEvents.push(lookupKey))
    },
    seenEpicMonsters = new Set()
  function f(bannerConfig) {
    for (pendingBanners.push(bannerConfig); pendingBanners.length > BANNER_MAX_STREAK;) {
      let lowestTierIndex = 0
      for (let index = 1; index < pendingBanners.length; index++) pendingBanners[index].tier < pendingBanners[lowestTierIndex].tier && (lowestTierIndex = index)
      pendingBanners.splice(lowestTierIndex, 1)
    }
  }
  function d(cooldown, currentTime) {
    const bannerElement = createEl(
      "div",
      `sf-hud__banner is-t${cooldown.tier} is-${cooldown.tone}${cooldown.left || cooldown.right ? "" : " is-noface"}${cooldown.wide ? " is-wide" : ""}`,
      createEl("i", "sf-hud__banner-rays"),
      createEl("i", "sf-hud__banner-spark"),
      createEl("i", "sf-hud__banner-spark"),
      createEl("i", "sf-hud__banner-spark"),
      createEl("i", "sf-hud__banner-spark"),
      cooldown.left ? createEl("span", "sf-hud__banner-face is-l", cooldown.left) : null,
      createEl("div", "sf-hud__banner-text", createEl("div", "sf-hud__banner-title sf-metal", cooldown.title), cooldown.sub ? createEl("div", "sf-hud__banner-sub", ...cooldown.sub) : null),
      cooldown.right ? createEl("span", `sf-hud__banner-face is-r${cooldown.slain ? " is-slain" : ""}`, cooldown.right) : null,
    )
    ;(element.appendChild(bannerElement), (activeBanner = { el: bannerElement, tier: cooldown.tier, shownAt: currentTime, hideAt: currentTime + Math.max(BANNER_SCALE_BY_STREAK[cooldown.tier], cooldown.hold ?? 0), removeAt: 0 }))
  }
  const makeUnitLabel = (unit, viewerWorld) => (unit.isPlayer ? createEl("span", "is-me", "你") : createEl("span", bannerTeamClass(unit.team, viewerWorld.team), `${unit.team === viewerWorld.team ? "我方" : "敌方"}${unit.name}`))
  function u(plaza, matchedAnnounce, world) {
    const heroResult = world.hero(plaza.victimId)
    if (!heroResult) return null
    const killerHero = world.hero(plaza.killerId),
      involvesPlayer = heroResult.isPlayer || !!killerHero?.isPlayer || plaza.assistIds.indexOf(world.state.playerId) >= 0
    if (!matchedAnnounce && (!involvesPlayer || heroResult.isPlayer)) return null
    const heroBannerLabelResult = heroBannerLabel(world.host, heroResult, world.team, "is-dead")
    if (!killerHero) {
      const killerKind = world.unit(plaza.killerId)?.kind,
        killerKindLabel = killerKind === "tower" || killerKind === "core" ? "防御塔" : killerKind === "monster" ? "野怪" : killerKind === "minion" ? "小兵" : "战场",
        iconForResult = iconFor(killerKind === "tower" || killerKind === "core" ? "tower" : killerKind === "monster" ? "monster" : "cs"),
        opposingTeamId = heroResult.team === 0 ? 1 : 0
      return { tier: 2, tone: heroResult.team === world.team ? "foe" : "ally", title: "助攻", sub: [makeUnitLabel(heroResult, world), `被${killerKindLabel}击杀`], left: makeBannerTag(iconForResult, bannerTeamClass(opposingTeamId, world.team)), right: heroBannerLabelResult, slain: !0 }
    }
    const killerTone = killerHero.team === world.team ? "ally" : "foe",
      announceKey = matchedAnnounce?.key ?? null
    let bannerTitle = announceKey ? (KILL_FEED_LABELS[announceKey] ?? "击杀") : killerHero.isPlayer ? "击杀" : "助攻",
      bannerTier = announceKey ? EVENT_PRIORITIES[announceKey] : 2,
      subtitleParts
    return (
      announceKey === "shutdown"
        ? (subtitleParts = [makeUnitLabel(killerHero, world), "终结了", makeUnitLabel(heroResult, world), "的连杀"])
        : announceKey === "killing_spree" || announceKey === "unstoppable" || announceKey === "legendary"
          ? (subtitleParts = [makeUnitLabel(killerHero, world), `已连续击杀 ${plaza.streak} 人`])
          : (subtitleParts = [makeUnitLabel(killerHero, world), "击杀了", makeUnitLabel(heroResult, world)]),
      announceKey === "legendary" && plaza.streak > 7 && (bannerTitle = `${bannerTitle}·${plaza.streak}连杀`),
      killerHero.isPlayer && bannerTier < 4 && announceKey && (bannerTier = bannerTier + 1),
      killerHero.isPlayer && plaza.bounty > 0 && subtitleParts.push(createEl("span", "is-gold", createIconEl(iconFor("gold")), `+${Math.round(plaza.bounty)}`)),
      { tier: bannerTier, tone: killerTone, title: bannerTitle, sub: subtitleParts, left: heroBannerLabel(world.host, killerHero, world.team), right: heroBannerLabelResult, slain: !0 }
    )
  }
  function m(lookupKey, battleWorld) {
    const isOurTeam = lookupKey.team === battleWorld.team,
      eventTone = lookupKey.team === 2 ? "neutral" : isOurTeam ? "ally" : "foe",
      selectedEVENT_PRIORITIES = EVENT_PRIORITIES[lookupKey.key],
      actorHero = lookupKey.unitId !== void 0 ? battleWorld.hero(lookupKey.unitId) : void 0,
      tierConfig = { tier: selectedEVENT_PRIORITIES, tone: eventTone, left: null, right: null, slain: !1 },
      Value = eventSnapshots.get(lookupKey),
      epicMonsterType = Value ? Value.epic : lastEpicMonsterType,
      epicMonsterPos = Value ? Value.epicPos : lastEpicSpawnPos,
      destroyedTower = Value ? Value.tower : lastTowerEvent
    switch (lookupKey.key) {
      case "match_start":
        return { ...tierConfig, title: "对战开始", sub: ["摧毁敌方水晶就赢"], hold: BANNER_ANIM_FAST }
      case "minions_spawn":
        return { ...tierConfig, title: "小兵出发", sub: ["跟着小兵去打架更安全"], hold: BANNER_ANIM_FAST }
      case "super_minions":
        return { ...tierConfig, title: isOurTeam ? "我方超级兵出击" : "敌方超级兵出击", sub: [isOurTeam ? "敌方高地塔已破，这一路的兵更强了" : "我方高地塔被破，注意回防"], hold: BANNER_ANIM_FAST }
      case "epic_spawn": {
        const epicMonsterName = epicMonsterType ? MONSTER_STATS[epicMonsterType].name : "史诗野怪",
          element = [createEl("span", null, (epicMonsterType && MONSTER_STATS[epicMonsterType].reward) || "打掉它，全队都有奖励")],
          isFirstEpicAnnounce = !!epicMonsterType && !seenEpicMonsters.has(epicMonsterType)
        return (
          isFirstEpicAnnounce && element.push(createEl("span", "is-dim", epicMonsterPos ? `小地图${riverNameFor(epicMonsterPos)} · 别一个人去` : "别一个人去")),
          epicMonsterType && seenEpicMonsters.add(epicMonsterType),
          { ...tierConfig, title: `${epicMonsterName}已刷新`, sub: element, left: makeBannerTag(iconFor("monster")), hold: isFirstEpicAnnounce ? BANNER_ANIM_SLOW : BANNER_ANIM_MID, wide: !0 }
        )
      }
      case "epic_slain": {
        const slainEpicName = epicMonsterType ? MONSTER_STATS[epicMonsterType].name : "史诗野怪",
          buffDescription = epicMonsterType ? describeCampBuff(epicMonsterType, isOurTeam) : isOurTeam ? "全队获得奖励" : "敌方获得奖励",
          slainSubtitleParts = isOurTeam && actorHero ? [makeUnitLabel(actorHero, battleWorld), "拿下", "·", buffDescription] : [buffDescription]
        return { ...tierConfig, title: isOurTeam ? `我方击败${slainEpicName}` : `敌方夺得${slainEpicName}`, sub: slainSubtitleParts, left: actorHero ? heroBannerLabel(battleWorld.host, actorHero, battleWorld.team) : null, right: makeBannerTag(iconFor("monster"), "is-dead"), slain: !0, hold: BANNER_ANIM_MID }
      }
      case "tower_destroyed": {
        const towerLabel = destroyedTower ? formatTowerLabel(destroyedTower.lane, destroyedTower.tier) : "防御塔",
          towerSubtitleParts = isOurTeam ? (actorHero ? [makeUnitLabel(actorHero, battleWorld), "拆掉了这座塔"] : ["我方小兵拆掉了这座塔"]) : ["被敌方拆掉了，注意防守"]
        return {
          ...tierConfig,
          title: isOurTeam ? `敌方${towerLabel}告破` : `我方${towerLabel}失守`,
          sub: towerSubtitleParts,
          left: actorHero ? heroBannerLabel(battleWorld.host, actorHero, battleWorld.team) : null,
          right: makeBannerTag(iconFor("tower"), `${bannerTeamClass(isOurTeam ? (battleWorld.team === 0 ? 1 : 0) : battleWorld.team, battleWorld.team)} is-dead`),
          slain: !0,
        }
      }
      case "ace":
        return { ...tierConfig, title: "团灭", sub: [isOurTeam ? "敌方全员阵亡，趁现在推塔！" : "我方全员阵亡，守住水晶！"] }
      case "victory":
      case "defeat":
        return { ...tierConfig, title: isOurTeam ? "敌方水晶已摧毁" : "我方水晶被摧毁", sub: [isOurTeam ? "我方获胜" : "敌方获胜"] }
      default: {
        const selectedKILL_FEED_LABELS = KILL_FEED_LABELS[lookupKey.key]
        if (!selectedKILL_FEED_LABELS) return null
        const victimHero = lookupKey.victimId !== void 0 ? battleWorld.hero(lookupKey.victimId) : void 0
        return { ...tierConfig, title: selectedKILL_FEED_LABELS, sub: actorHero && victimHero ? [makeUnitLabel(actorHero, battleWorld), "击杀了", makeUnitLabel(victimHero, battleWorld)] : null, left: actorHero ? heroBannerLabel(battleWorld.host, actorHero, battleWorld.team) : null, right: victimHero ? heroBannerLabel(battleWorld.host, victimHero, battleWorld.team, "is-dead") : null, slain: !!victimHero }
      }
    }
  }
  function x(battleWorld) {
    if (pendingEvents.length === 0) return
    const processedAnnounces = new Set()
    for (let index = 0; index < pendingEvents.length; index++) {
      const lookupKey = pendingEvents[index]
      if (lookupKey.type === "heroKill") {
        let linkedAnnounce = null
        for (let announceIndex = index + 1; announceIndex < pendingEvents.length; announceIndex++) {
          const candidateAnnounce = pendingEvents[announceIndex]
          if (candidateAnnounce.type === "announce" && !processedAnnounces.has(candidateAnnounce) && candidateAnnounce.key in KILL_FEED_LABELS && candidateAnnounce.unitId === lookupKey.killerId && candidateAnnounce.victimId === lookupKey.victimId) {
            linkedAnnounce = candidateAnnounce
            break
          }
        }
        linkedAnnounce && processedAnnounces.add(linkedAnnounce)
        const uResult = u(lookupKey, linkedAnnounce, battleWorld)
        uResult && f(uResult)
      } else if (!processedAnnounces.has(lookupKey)) {
        const mResult = m(lookupKey, battleWorld)
        mResult && f(mResult)
      }
    }
    ;((pendingEvents.length = 0), eventSnapshots.clear())
  }
  return {
    el: element,
    /**
     * 处理事件。
     *
     * @param gameEvent - 输入
    */
    handleEvent(gameEvent) {
      gameEvent.type === "heroKill" || gameEvent.type === "announce"
        ? recordEvent(gameEvent)
        : gameEvent.type === "monsterSpawn"
          ? MONSTER_STATS[gameEvent.monsterType].epic && ((lastEpicMonsterType = gameEvent.monsterType), (lastEpicSpawnPos = gameEvent.pos))
          : gameEvent.type === "epicSlain"
            ? (lastEpicMonsterType = gameEvent.monsterType)
            : gameEvent.type === "towerDestroyed" && (lastTowerEvent = gameEvent)
    },
    afterEvents(battleWorld) {
      x(battleWorld)
    },
    demo(sampleEvent, battleWorld) {
      ;(recordEvent(sampleEvent), x(battleWorld))
    },
    isShowing: () => activeBanner !== null || pendingBanners.length > 0,
    update(timeState) {
      const currentTime = timeState.now
      ;(activeBanner &&
        (activeBanner.removeAt === 0
          ? (currentTime >= activeBanner.hideAt || (pendingBanners.length > 0 && currentTime >= activeBanner.shownAt + BANNER_WIDTH_BY_STREAK[activeBanner.tier])) && (activeBanner.el.classList.add("is-out"), (activeBanner.removeAt = currentTime + 0.24))
          : currentTime >= activeBanner.removeAt && (activeBanner.el.remove(), (activeBanner = null))),
        !activeBanner && pendingBanners.length > 0 && d(pendingBanners.shift(), currentTime))
    },
    dispose() {
      ;((pendingBanners.length = 0), (pendingEvents.length = 0), eventSnapshots.clear())
    },
  }
}

export { ABILITY_KEYS, bannerTeamClass, HERO_ID_LIST, heroBannerLabel, makeBannerTag, ROLE_TINT_COLORS, BANNER_ANIM_CACHE, heroNameForBanner, __heroRow, createBanner, ROLE_BRIEF_TEXTS, ABILITY_LABELS, heroRoleTag, killFeedLine, streakBannerText }