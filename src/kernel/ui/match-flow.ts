/**
 * 对局流程控制面板
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { MONSTER_STATS } from '../game-balance'
import { formatTowerLabel } from '../equipment'
import { HERO_TABLE } from '../../heroes/registry'

const RETREAT_HP_THRESHOLD = 270,
  BOT_GROUP_TIME_SEC = 570,
  BOT_TUNING = {
    retreatHp: [0.3, 0.36],
    defendRecent: 3,
    defendRadius: 10,
    pushNowDist: [20, 24],
    aggroPad: [1, 2.5],
    epicFresh: 8,
    epicMates: [14, 20],
    epicHurt: 0.97,
    epicHelpLinger: 6,
    epicNear: [18, 22],
    epicSoon: 15,
    groupDist: [25, 20],
    groupSwitch: 3,
    groupForget: 12,
    backDist: [16, 12],
    farmDist: [14, 17],
    farmUntil: 150,
    farmLinger: 8,
    fountainHp: 0.85,
  },
  BOT_ROLE_ORDER = (position, toPosition) => {
    const xDelta = position.x - toPosition.x,
      yDelta = position.y - toPosition.y
    return xDelta * xDelta + yDelta * yDelta
  },
  BOT_LANE_ORDER = (fromPosition, toPosition) => Math.sqrt(BOT_ROLE_ORDER(fromPosition, toPosition))

function estimateAttackReady(attacker, myMinions, rangeBonus = 0) {
  const effectiveAttackRange = attacker.stats.attackRange + rangeBonus,
    attackRangeSquared = effectiveAttackRange * effectiveAttackRange
  for (const minion of myMinions) if (BOT_ROLE_ORDER(minion.pos, attacker.pos) <= attackRangeSquared) return !0
  return !1
}

/**
 * 查找单位。
 *
 * @param bushMap - 输入
 * @param player - 输入
 */
function findNearestUnit(bushMap, player) {
  let result = null,
    nearestDistanceSq = 1 / 0
  for (const camp of bushMap.map.camps) {
    if (camp.side !== player.team || (camp.monsterType !== "frost_golem" && camp.monsterType !== "ember_golem")) continue
    const bOT_ROLE_ORDERResult = BOT_ROLE_ORDER(camp.pos, player.pos)
    bOT_ROLE_ORDERResult < nearestDistanceSq && ((nearestDistanceSq = bOT_ROLE_ORDERResult), (result = camp))
  }
  return result
}

function forEachVisibleUnit(world, team, lane, tier = 1) {
  for (const tower of world.map.towers) if (tower.team === team && tower.lane === lane && tower.tier === tier) return tower.pos
  return null
}

const BOT_GOAL_LABELS = ["移动", "普攻补兵", "放技能", "回城与出装", "推塔", "获胜"],
  TUTORIAL_STEP_IDS = ["move", "go", "attack", "lasthit", "skill", "recall", "shop", "push", "win"],
  TUTORIAL_STEP_LESSON = { move: 1, go: 1, attack: 2, lasthit: 2, skill: 3, recall: 4, shop: 4, push: 5, win: 6 },
  BOT_TIMINGS = {
    startAt: 2,
    moveDist: 8,
    moveTimeout: 30,
    goDist: 12,
    goTimeout: 60,
    nearEnemy: 14,
    attackReach: 6,
    attackWait: 90,
    attackTimeout: 45,
    lastHits: 2,
    monsterKills: 1,
    lasthitTimeout: 60,
    skillTimeout: 40,
    recallHp: 0.4,
    recallHpHold: 1.5,
    recallHpOk: 0.6,
    recallAfter: 60,
    recallTimeout: 45,
    shopTimeout: 12,
    pushDist: 22,
    pushAt: 240,
    pushLinger: 20,
    pushTimeout: 40,
    winShow: 8,
    outroShow: 3,
    checkShow: 0.8,
    tipShow: 5,
    tipGap: 15,
  }

const distance2DSquared = /**
 * 处理距离。
 *
 * @param fromPosition - 输入
 * @param toPosition - 输入
 * @returns 数值结果
 */
(fromPosition, toPosition) => {
  const xDelta = fromPosition.x - toPosition.x,
    yDelta = fromPosition.y - toPosition.y
  return xDelta * xDelta + yDelta * yDelta
}

function hasCcBuff(player, buffId) {
  for (const buff of player.buffs) if (buff.id === buffId) return !0
  return !1
}

class MatchFlow {
  team
  playerId
  jungler
  foeTowerIds = new Set()
  cur = "move"
  phase = "wait"
  tPhase = 0
  done = { move: !1, go: !1, attack: !1, lasthit: !1, skill: !1, recall: !1, shop: !1, push: !1, win: !1 }
  variant = ""
  target = null
  targetLabel = ""
  targetId = -1
  skipped = !1
  lastTime
  lastPos
  moved = 0
  attacked = !1
  lastHits = 0
  monsterKills = 0
  casted = !1
  recallDone = !1
  leftFountain = !1
  backAtFountain = !1
  shopOpened = !1
  autoBought = !1
  sinceTowerHit = -1
  sinceSkill = -1
  lowHpFor = 0
  scanAt = -1
  enemyNear = !1
  enemyInReach = !1
  seenTips = new Set()
  pendingTips = []
  activeTip = null
  tipLeft = 0
  lastTipEnd = -1 / 0
  s2Level
  ultLevel
  view = { card: null, lesson: 1, lessonsDone: [!1, !1, !1, !1, !1, !1], highlight: null, arrow: null, minimap: null, finished: !1 }
  constructor(world, hero) {
    ;((this.team = hero.team),
      (this.playerId = hero.id),
      (this.jungler = hero.lane === "jungle"),
      (this.lastTime = world.time),
      (this.lastPos = { x: hero.pos.x, y: hero.pos.y }),
      (this.s2Level = hero.skills.s2.level),
      (this.ultLevel = hero.skills.ult.level))
    for (const unit of world.units) unit.kind === "tower" && unit.team !== hero.team && this.foeTowerIds.add(unit.id)
  }
  get finished() {
    return this.cur === "end"
  }
  skip() {
    ;((this.skipped = !0), (this.cur = "end"), (this.activeTip = null), (this.pendingTips.length = 0))
  }
  debug() {
    return {
      step: this.cur,
      phase: this.phase,
      variant: this.variant,
      t: this.tPhase,
      done: TUTORIAL_STEP_IDS.filter((stepId) => this.done[stepId]),
      tips: [...this.seenTips],
      tip: this.activeTip ? this.activeTip.id : null,
      skipped: this.skipped,
      moved: this.moved,
      lastHits: this.jungler ? this.monsterKills : this.lastHits,
    }
  }
  /**
   * 处理事件。
   *
   * @param gameEvent - 主要输入
   * @param world - 战场
  */
  onEvent(gameEvent, world) {
    const playerId = this.playerId
    switch (gameEvent.type) {
      case "attack":
        gameEvent.unitId === playerId && (this.attacked = !0)
        break
      case "gold":
        if (gameEvent.unitId !== playerId) break
        gameEvent.reason === "lasthit" ? this.lastHits++ : gameEvent.reason === "monster" && this.monsterKills++
        break
      case "skillCast":
        gameEvent.unitId === playerId && (gameEvent.slot === "s1" || gameEvent.slot === "s2" || gameEvent.slot === "ult") && (this.casted = !0)
        break
      case "fx":
        gameEvent.key === "recall_done" && gameEvent.unitId === playerId && (this.recallDone = !0)
        break
      case "itemBought":
        gameEvent.unitId === playerId && gameEvent.auto === !0 && world.time > 5 && (this.autoBought = !0)
        break
      case "damage":
        gameEvent.sourceId === playerId && this.sinceTowerHit < 0 && this.foeTowerIds.has(gameEvent.targetId) && (this.sinceTowerHit = 0)
        break
    }
  }
  update(uiState) {
    const { state: battleState, me: player } = uiState,
      bOT_TIMINGS = BOT_TIMINGS,
      viewState = this.view
    let deltaTime = battleState.time - this.lastTime
    if (((this.lastTime = battleState.time), deltaTime > 0 ? deltaTime > 5 && (deltaTime = 5) : (deltaTime = 0), this.step() === "end")) return this.hidden(!0)
    uiState.shopOpen && (this.shopOpened = !0)
    const distanceMoved = Math.sqrt(distance2DSquared(player.pos, this.lastPos))
    if ((player.alive && distanceMoved <= Math.max(2, player.stats.moveSpeed * deltaTime * 1.5 + 0.5) && (this.moved += distanceMoved), (this.lastPos.x = player.pos.x), (this.lastPos.y = player.pos.y), battleState.over || !player.alive)) return this.hidden(!1)
    const hasCcBuffResult = hasCcBuff(player, "fountain"),
      selectedBases = battleState.map.bases[this.team],
      fountainExitRadius = selectedBases.fountainRadius + 4
    ;(distance2DSquared(player.pos, selectedBases.fountain) > fountainExitRadius * fountainExitRadius ? ((this.leftFountain = !0), (this.backAtFountain = !1)) : hasCcBuffResult && this.leftFountain && (this.backAtFountain = !0),
      this.sinceSkill >= 0 && (this.sinceSkill += deltaTime),
      this.sinceTowerHit >= 0 && (this.sinceTowerHit += deltaTime))
    const hpFraction = player.hp / Math.max(1, player.stats.maxHp)
    ;((this.lowHpFor = hpFraction < bOT_TIMINGS.recallHp && !player.inCombat && !hasCcBuffResult ? this.lowHpFor + deltaTime : 0),
      (battleState.time - this.scanAt >= 0.2 || battleState.time < this.scanAt) && ((this.scanAt = battleState.time), this.scanNear(battleState, player), this.detectTips(uiState)),
      this.levelTips(uiState),
      this.activeTip && ((this.tipLeft -= deltaTime), this.tipLeft <= 0 && ((this.activeTip = null), (this.lastTipEnd = battleState.time))),
      (this.activeTip && this.phase !== "wait") || (this.tPhase += deltaTime))
    for (let index = 0; index < 16; index++) {
      const currentStepId = this.step()
      if (currentStepId === "end") return this.hidden(!0)
      if (currentStepId === "outro") {
        if (this.tPhase >= bOT_TIMINGS.outroShow) {
          this.cur = "end"
          continue
        }
        break
      }
      if (this.phase === "wait") {
        if (currentStepId === "recall" && !this.done.shop && this.autoBought && !this.shopOpened) {
          this.enter("shop", battleState, player)
          continue
        }
        if (this.alreadyDone(currentStepId, player)) {
          this.finish(currentStepId, battleState, player)
          continue
        }
        if (this.trigger(currentStepId, battleState, player)) {
          ;((this.phase = "show"), (this.tPhase = 0))
          continue
        }
        break
      }
      if (this.phase === "show") {
        if (this.completed(currentStepId, battleState, player)) {
          if (currentStepId === "win") {
            this.finish(currentStepId, battleState, player)
            continue
          }
          ;((this.phase = "check"), (this.tPhase = 0))
          break
        }
        if (currentStepId === "recall" && this.variant === "low") {
          if (hpFraction >= bOT_TIMINGS.recallHpOk) {
            this.sinceSkill >= bOT_TIMINGS.recallAfter ? this.finish(currentStepId, battleState, player) : ((this.phase = "wait"), (this.tPhase = 0), (this.lowHpFor = 0))
            continue
          }
          break
        }
        if (this.tPhase >= this.timeout(currentStepId)) {
          this.finish(currentStepId, battleState, player)
          continue
        }
        break
      }
      if (this.tPhase >= bOT_TIMINGS.checkShow) {
        this.finish(currentStepId, battleState, player)
        continue
      }
      break
    }
    if (!this.activeTip && this.pendingTips.length > 0) {
      for (let tipIndex = this.pendingTips.length - 1; tipIndex >= 0; tipIndex--) this.pendingTips[tipIndex].expire >= battleState.time || (this.seenTips.delete(this.pendingTips[tipIndex].id), this.pendingTips.splice(tipIndex, 1))
      const isStepVisible = this.cur === "outro" || this.phase !== "wait"
      if (battleState.time - this.lastTipEnd >= bOT_TIMINGS.tipGap) {
        const findIndexResult = this.pendingTips.findIndex((tip) => tip.urgent || !isStepVisible)
        findIndexResult >= 0 && ((this.activeTip = this.pendingTips[findIndexResult]), this.pendingTips.splice(findIndexResult, 1), (this.tipLeft = bOT_TIMINGS.tipShow))
      }
    }
    const displayStepId = this.step()
    if (displayStepId === "end") return this.hidden(!0)
    ;((viewState.finished = !1), (viewState.lesson = displayStepId === "outro" ? 6 : TUTORIAL_STEP_LESSON[displayStepId]), viewState.lessonsDone.fill(!0))
    for (const stepId of TUTORIAL_STEP_IDS) this.done[stepId] || (viewState.lessonsDone[TUTORIAL_STEP_LESSON[stepId] - 1] = !1)
    return (
      (viewState.highlight = null),
      (viewState.arrow = null),
      (viewState.minimap = null),
      this.activeTip
        ? (viewState.card = { kind: "tip", id: this.activeTip.id, lesson: viewState.lesson, title: "小贴士", text: this.activeTip.text, done: !1, warn: this.activeTip.warn })
        : displayStepId === "outro"
          ? (viewState.card = { kind: "outro", id: "outro", lesson: 6, title: "引导结束", text: uiState.objectiveHints ? "引导结束，接下来看屏幕上方的目标提示。" : "引导结束，祝你旗开得胜！", done: !0, warn: !1 })
          : this.phase === "wait"
            ? (viewState.card = null)
            : (viewState.card = { kind: "step", id: displayStepId, lesson: viewState.lesson, title: BOT_GOAL_LABELS[viewState.lesson - 1], text: this.text(displayStepId, uiState), done: this.phase === "check", warn: !1 }),
      displayStepId !== "outro" &&
        this.phase === "show" &&
        (this.activeTip || (viewState.highlight = this.highlightOf(displayStepId, uiState.mode)),
        (displayStepId === "go" || displayStepId === "push") && this.target
          ? ((viewState.arrow = { pos: this.target, label: this.targetLabel }), (viewState.minimap = this.target))
          : displayStepId === "win" && (viewState.minimap = battleState.map.bases[this.team === 0 ? 1 : 0].core)),
      viewState
    )
  }
  step() {
    return this.cur
  }
  hidden(isFinished) {
    const viewValue = this.view
    return ((viewValue.card = null), (viewValue.highlight = null), (viewValue.arrow = null), (viewValue.minimap = null), (viewValue.finished = isFinished), isFinished && viewValue.lessonsDone.fill(!0), viewValue)
  }
  enter(goKind, world, player) {
    if (((this.cur = goKind), (this.phase = "wait"), (this.tPhase = 0), (this.variant = ""), (this.target = null), (this.targetLabel = ""), (this.targetId = -1), goKind === "go"))
      if (this.jungler) {
        const findNearestUnitResult = findNearestUnit(world, player)
        findNearestUnitResult && ((this.target = findNearestUnitResult.pos), (this.targetLabel = MONSTER_STATS[findNearestUnitResult.monsterType].name))
      } else player.lane !== "jungle" && ((this.target = forEachVisibleUnit(world, this.team, player.lane)), (this.targetLabel = `我方${formatTowerLabel(player.lane, 1)}`))
  }
  finish(skillKind, world, player) {
    ;((this.done[skillKind] = !0), skillKind === "skill" && this.sinceSkill < 0 && (this.sinceSkill = 0))
    const nextStepId = TUTORIAL_STEP_IDS.find((stepId) => !this.done[stepId])
    if (!nextStepId) {
      ;((this.cur = "outro"), (this.phase = "show"), (this.tPhase = 0), (this.target = null))
      return
    }
    this.enter(nextStepId, world, player)
  }
  alreadyDone(stepId, player) {
    const botTimings = BOT_TIMINGS
    switch (stepId) {
      case "move":
        return this.moved >= botTimings.moveDist
      case "go":
        return !this.target || distance2DSquared(player.pos, this.target) < botTimings.goDist * botTimings.goDist
      case "attack":
        return this.attacked
      case "lasthit":
        return this.jungler ? this.monsterKills >= botTimings.monsterKills : this.lastHits >= botTimings.lastHits
      case "skill":
        return this.casted
      case "recall":
        return this.recallDone
      case "shop":
        return this.shopOpened
      case "push":
        return this.sinceTowerHit >= 0
      default:
        return !1
    }
  }
  trigger(stepId, world, player) {
    const botTimings = BOT_TIMINGS
    switch (stepId) {
      case "move":
        return world.time >= botTimings.startAt
      case "attack":
        return this.enemyNear || this.tPhase >= botTimings.attackWait
      case "recall":
        return this.lowHpFor >= botTimings.recallHpHold ? ((this.variant = "low"), !0) : this.sinceSkill >= botTimings.recallAfter ? ((this.variant = "timed"), !0) : !1
      case "push": {
        const findPushTowerResult = this.findPushTower(world, player)
        if (findPushTowerResult) return ((this.variant = "minions"), this.setTower(findPushTowerResult), !0)
        if (world.time >= botTimings.pushAt) {
          const frontTowerResult = this.frontTower(world, player)
          return (frontTowerResult && ((this.variant = "late"), this.setTower(frontTowerResult)), !0)
        }
        return !1
      }
      default:
        return !0
    }
  }
  completed(stepId, world, player) {
    const botTimings = BOT_TIMINGS
    switch (stepId) {
      case "move":
        return this.moved >= botTimings.moveDist
      case "go":
        return !this.target || distance2DSquared(player.pos, this.target) < botTimings.goDist * botTimings.goDist
      case "attack":
        return this.attacked
      case "lasthit":
        return this.jungler ? this.monsterKills >= botTimings.monsterKills : this.lastHits >= botTimings.lastHits
      case "skill":
        return this.casted
      case "recall":
        return this.recallDone || this.backAtFountain
      case "shop":
        return this.shopOpened
      case "push":
        return this.sinceTowerHit >= botTimings.pushLinger || (this.targetId >= 0 && !world.units.some((unit) => unit.id === this.targetId && unit.alive))
      case "win":
        return this.tPhase >= botTimings.winShow
      default:
        return !1
    }
  }
  /**
   * 处理时长。
   *
   * @param stepId - 主要输入
  */
  timeout(stepId) {
    const botTimings = BOT_TIMINGS
    switch (stepId) {
      case "move":
        return botTimings.moveTimeout
      case "go":
        return botTimings.goTimeout
      case "attack":
        return botTimings.attackTimeout
      case "lasthit":
        return botTimings.lasthitTimeout
      case "skill":
        return botTimings.skillTimeout
      case "recall":
        return botTimings.recallTimeout
      case "shop":
        return botTimings.shopTimeout
      case "push":
        return botTimings.pushTimeout
      default:
        return botTimings.winShow
    }
  }
  highlightOf(stepId, touchKind) {
    switch (stepId) {
      case "move":
        return touchKind === "touch" ? "joystick" : null
      case "attack":
        return "attack"
      case "skill":
        return "s1"
      case "recall":
        return "recall"
      case "shop":
        return "shop"
      default:
        return null
    }
  }
  text(stepId, uiState) {
    const isKeyboardMouse = uiState.mode === "kbm",
      selfPlayer = uiState.me
    switch (stepId) {
      case "move":
        return isKeyboardMouse ? "按 `W` `A` `S` `D` 移动，或鼠标右键点地面。" : "拖动左下角的摇杆移动。"
      case "go":
        return this.jungler ? `你是打野：跟着箭头去**${this.targetLabel}**，打野怪升级。` : `跟着箭头去**${this.targetLabel}**，小兵马上就到。`
      case "attack": {
        const targetUnitLabel = this.jungler ? "野怪" : "敌方小兵"
        return this.enemyInReach ? (isKeyboardMouse ? "按 `空格` 普攻，会自动打最合适的敌人。" : "按住右下角的大按钮普攻。") : isKeyboardMouse ? `走近${targetUnitLabel}，再按 \`空格\` 普攻。` : `走近${targetUnitLabel}，再按住右下角的大按钮普攻。`
      }
      case "lasthit":
        return this.jungler
          ? `把野怪打死，金币和经验都归你。(${Math.min(this.monsterKills, BOT_TIMINGS.monsterKills)}/${BOT_TIMINGS.monsterKills})`
          : `小兵快死时补上**最后一击**，金币全拿。(${Math.min(this.lastHits, BOT_TIMINGS.lastHits)}/${BOT_TIMINGS.lastHits})`
      case "skill": {
        const s1Brief = HERO_TABLE[selfPlayer.heroId].skills.s1.brief,
          skillBriefClause = s1Brief ? `：${s1Brief}。` : "。"
        return isKeyboardMouse ? `按 \`Q\` 放一技能${skillBriefClause}按住能看到范围，松开施放。` : `轻点一技能${skillBriefClause}按住拖动可以自己瞄准。`
      }
      case "recall":
        return isKeyboardMouse ? "血少了就按 `B` 回城：原地站 5 秒，回泉水很快补满。" : "血少了就点「回城」：原地站 5 秒，回泉水很快补满。"
      case "shop":
        return selfPlayer.autoBuy
          ? isKeyboardMouse
            ? "金币够了会**自动购买**推荐装备。想自己挑，按 `P` 打开商店。"
            : "金币够了会**自动购买**推荐装备。想自己挑，点小地图下面的商店。"
          : isKeyboardMouse
            ? "金币够了就按 `P` 打开商店，照着**推荐**页买下一件。"
            : "金币够了就点小地图下面的商店，照着**推荐**页买下一件。"
      case "push":
        return this.variant === "late" ? "塔会先打小兵：等小兵进塔再上去打，塔下没兵就退出来。" : "小兵进塔了！塔会先打小兵，趁现在打塔。塔下没兵就退出来。"
      default:
        return "一路打掉 **一塔 → 二塔 → 高地塔**，就能打水晶。水晶爆了就赢！"
    }
  }
  setTower(tower) {
    ;((this.target = { x: tower.pos.x, y: tower.pos.y }), (this.targetId = tower.id), (this.targetLabel = tower.kind === "tower" ? `敌方${formatTowerLabel(tower.lane, tower.tier)}` : "敌方防御塔"))
  }
  /**
   * 查找防御塔。
   *
   * @param world - 战场
   * @param lookupOption - 输入
  */
  findPushTower(world, lookupOption) {
    const pushRadiusSquared = BOT_TIMINGS.pushDist * BOT_TIMINGS.pushDist
    let nearestTower = null
    for (const tower of world.units)
      if (!(tower.kind !== "tower" || !tower.alive || tower.team === this.team || tower.invulnerable) && !(distance2DSquared(tower.pos, lookupOption.pos) > pushRadiusSquared)) {
        if (!nearestTower) {
          nearestTower = []
          for (const minion of world.units) minion.kind === "minion" && minion.alive && minion.team === this.team && nearestTower.push(minion)
        }
        if (estimateAttackReady(tower, nearestTower)) return tower
      }
    return null
  }
  /**
   * 处理防御塔。
   *
   * @param world - 战场
   * @param player - 输入
  */
  frontTower(world, player) {
    let nearestTower = null,
      nearestTowerScore = 1 / 0
    for (const tower of world.units) {
      if (tower.kind !== "tower" || !tower.alive || tower.team === this.team || tower.invulnerable) continue
      const towerDistanceSq = player.lane !== "jungle" && tower.lane === player.lane ? -1 : distance2DSquared(tower.pos, player.pos)
      towerDistanceSq < nearestTowerScore && ((nearestTowerScore = towerDistanceSq), (nearestTower = tower))
    }
    return nearestTower
  }
  scanNear(world, player) {
    const nearEnemyRadiusSq = BOT_TIMINGS.nearEnemy * BOT_TIMINGS.nearEnemy,
      effectiveAttackRange = player.stats.attackRange + BOT_TIMINGS.attackReach
    ;((this.enemyNear = !1), (this.enemyInReach = !1))
    for (const unit of world.units) {
      if (!unit.alive || !(this.jungler ? unit.kind === "monster" : unit.kind === "minion" && unit.team !== this.team && unit.visible[this.team])) continue
      const distance2DSquaredResult = distance2DSquared(unit.pos, player.pos)
      if (distance2DSquaredResult > nearEnemyRadiusSq) continue
      this.enemyNear = !0
      const attackReachRadius = effectiveAttackRange + unit.radius
      if (distance2DSquaredResult <= attackReachRadius * attackReachRadius) {
        this.enemyInReach = !0
        return
      }
    }
  }
  queueTip(lookupKey, tipText, world, tipLifetimeSeconds, isWarning = !1, isUrgent = !1) {
    this.seenTips.has(lookupKey) || (this.seenTips.add(lookupKey), this.pendingTips.push({ id: lookupKey, text: tipText, warn: isWarning, urgent: isUrgent, expire: world.time + tipLifetimeSeconds }))
  }
  levelTips(uiState) {
    const { me: player, state: battleState } = uiState,
      isKbmMode = uiState.mode === "kbm",
      selectedHERO_TABLE = HERO_TABLE[player.heroId]
    if (player.skills.s2.level > 0 && this.s2Level === 0) {
      const s2Brief = selectedHERO_TABLE.skills.s2.brief
      this.queueTip("tip_s2", `二技能解锁了${s2Brief ? `：${s2Brief}` : ""}。${isKbmMode ? "按 `E` 施放。" : ""}`, battleState, 40)
    }
    if (player.skills.ult.level > 0 && this.ultLevel === 0) {
      const ultBrief = selectedHERO_TABLE.skills.ult.brief
      this.queueTip("tip_ult", `大招解锁了${ultBrief ? `：${ultBrief}` : ""}。${isKbmMode ? "按 `R` 施放。" : ""}`, battleState, 40)
    }
    ;((this.s2Level = player.skills.s2.level), (this.ultLevel = player.skills.ult.level))
  }
  detectTips(uiState) {
    const { state: battleState, me: player } = uiState
    if (!this.seenTips.has("tip_tower"))
      for (const buff of player.buffs) {
        if (buff.id !== "tower_focus") continue
        const focusingTower = battleState.units.find((candidateUnit) => candidateUnit.id === buff.sourceId)
        if (!focusingTower) continue
        const towerAggroRadius = focusingTower.stats.attackRange + player.radius + BOT_TUNING.aggroPad[0]
        if (distance2DSquared(focusingTower.pos, player.pos) > towerAggroRadius * towerAggroRadius) break
        const allyMinions = []
        for (const minion of battleState.units) minion.kind === "minion" && minion.alive && minion.team === this.team && allyMinions.push(minion)
        estimateAttackReady(focusingTower, allyMinions) || this.queueTip("tip_tower", "塔在打你！塔下没有小兵别硬冲，越打越疼。", battleState, 3, !0, !0)
        break
      }
    if ((player.bushId >= 0 && this.queueTip("tip_bush", "草丛里敌人看不见你；出手会暴露 1.5 秒。", battleState, 4), !this.seenTips.has("tip_buff_blue") || !this.seenTips.has("tip_buff_red"))) {
      const nearEnemyRadiusSq = BOT_TIMINGS.nearEnemy * BOT_TIMINGS.nearEnemy
      for (const monster of battleState.units) {
        if (monster.kind !== "monster" || !monster.alive || (monster.monsterType !== "frost_golem" && monster.monsterType !== "ember_golem") || distance2DSquared(monster.pos, player.pos) > nearEnemyRadiusSq) continue
        const selectedMONSTER_STATS = MONSTER_STATS[monster.monsterType]
        this.queueTip(monster.monsterType === "frost_golem" ? "tip_buff_blue" : "tip_buff_red", `**${selectedMONSTER_STATS.name}**：${selectedMONSTER_STATS.reward ?? "打掉它有增益"}。`, battleState, 25)
      }
    }
  }
}

export { BOT_GROUP_TIME_SEC, RETREAT_HP_THRESHOLD, BOT_GOAL_LABELS, BOT_LANE_ORDER, forEachVisibleUnit, MatchFlow, findNearestUnit, estimateAttackReady, BOT_ROLE_ORDER, BOT_TUNING }
