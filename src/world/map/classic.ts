/**
 * 经典三路地图 —— 从内核 u8() 及周边常量整块搬运。
 * 这里就是"地图长什么样"的全部真相：外框、三路路点、防御塔位置、墙体多边形、
 * 草丛矩形、野区刷新点、双方基地与泉水。
 *
 * 换地图：改这里的数值，或在启动前给 globalThis.__STARFALL_MAP__ 赋一个返回同结构对象的函数。
 * 坐标工具（$t/$h/I0/Ax/h8）由内核注入，避免两边各写一份。
 */
import type { MapKit } from './types'

/**
 * 创建地图。
 *
 * @param mapKit - 来源
 * @returns 结果对象
 */
export function buildClassicMap(mapKit: MapKit) {
  const { $t: makePointXY, $h: swapPointXY, I0: negateXY, Ax: copyXY, h8: negateSwapXY } = mapKit as any

  // 地图外框与半边长（原内核契约）
  const mapBound = 57.5
  const halfSideLength = 76

  const topLaneWaypoints = [makePointXY(-52, 42), makePointXY(-52, -45), makePointXY(-51, -49), makePointXY(-49, -51), makePointXY(-45, -52), makePointXY(42, -52)]

  const topConfig = { top: topLaneWaypoints, mid: [makePointXY(-43, 43), makePointXY(-36, 36), makePointXY(0, 0), makePointXY(36, -36), makePointXY(43, -43)], bot: topLaneWaypoints.map(negateXY) }

  const towerSites = [
  { lane: "top", tier: 3, pos: makePointXY(-48.6, 27) },
  { lane: "top", tier: 2, pos: makePointXY(-55.4, 4) },
  { lane: "top", tier: 1, pos: makePointXY(-48.6, -24) },
  { lane: "mid", tier: 3, pos: makePointXY(-32.4, 27.6) },
  { lane: "mid", tier: 2, pos: makePointXY(-18.6, 23.4) },
  { lane: "mid", tier: 1, pos: makePointXY(-12.9, 8.1) },
  { lane: "bot", tier: 3, pos: negateXY(makePointXY(-48.6, 27)) },
  { lane: "bot", tier: 2, pos: negateXY(makePointXY(-55.4, 4)) },
  { lane: "bot", tier: 1, pos: negateXY(makePointXY(-48.6, -24)) },
  ]

  function i_(teamIndex) {
  const toTeamSide = teamIndex === 0 ? copyXY : swapPointXY,
  $tResult = makePointXY(-54, 54),
  spawnOffsets = [makePointXY(0, 0), makePointXY(1.8, 0.6), makePointXY(-0.6, -1.8), makePointXY(1.6, -1.6), makePointXY(2.8, -2.8)]
  return {
  team: teamIndex,
  core: toTeamSide(makePointXY(-47, 47)),
  fountain: toTeamSide($tResult),
  fountainRadius: 4.5,
  spawns: spawnOffsets.map((position) => toTeamSide(makePointXY($tResult.x + position.x, $tResult.y + position.y))),
  minionSpawn: { top: toTeamSide(makePointXY(-52, 37)), mid: toTeamSide(makePointXY(-41, 41)), bot: toTeamSide(makePointXY(-37, 52)) },
  area: [makePointXY(-57.5, 32), makePointXY(-39.5, 32), makePointXY(-32, 39.5), makePointXY(-32, 57.5), makePointXY(-57.5, 57.5)].map(toTeamSide),
  }
  }

  function Vz() {
  const towerDefs = []
  for (const blueTowerSite of towerSites) towerDefs.push({ team: 0, lane: blueTowerSite.lane, tier: blueTowerSite.tier, pos: blueTowerSite.pos })
  for (const redTowerSite of towerSites) towerDefs.push({ team: 1, lane: redTowerSite.lane, tier: redTowerSite.tier, pos: swapPointXY(redTowerSite.pos) })
  return towerDefs
  }

  const wallPolygons = [
  [makePointXY(-46.5, 35), makePointXY(-42.5, 35), makePointXY(-30.5, 23), makePointXY(-34, 17.5), makePointXY(-46.5, 19)],
  [makePointXY(-46.5, 13), makePointXY(-41.5, 12.5), makePointXY(-41, -11.5), makePointXY(-46.5, -12)],
  [makePointXY(-46.5, -18), makePointXY(-40.5, -18.5), makePointXY(-34, -19.5), makePointXY(-30.5, -23), makePointXY(-46.5, -39)],
  [makePointXY(-26, 18.5), makePointXY(-14, 6.5), makePointXY(-17.5, 3), makePointXY(-29.5, 15)],
  [makePointXY(-14, -6.5), makePointXY(-25, -17.5), makePointXY(-28.5, -14), makePointXY(-17.5, -3)],
  [makePointXY(-36, 6), makePointXY(-30, 7), makePointXY(-24.5, 1.5), makePointXY(-25, -3), makePointXY(-31, -7.5), makePointXY(-36, -6.5)],
  ]

  const bushPolygons = [
  [makePointXY(-57.3, -40), makePointXY(-54.6, -40), makePointXY(-54.6, -31), makePointXY(-57.3, -31)],
  [makePointXY(-46.3, 13.6), makePointXY(-42.2, 13.4), makePointXY(-42.2, 18.6), makePointXY(-46.3, 18.6)],
  [makePointXY(-30, 22.5), makePointXY(-26.5, 19), makePointXY(-29, 16.5), makePointXY(-32, 20)],
  [makePointXY(-25.5, -18), makePointXY(-30, -22.5), makePointXY(-32, -20.5), makePointXY(-27.5, -16)],
  [makePointXY(-14, 4), makePointXY(-10.5, 1.2), makePointXY(-10.5, -1.2), makePointXY(-14, -4)],
  ]

  const cornerBushPolygon = [makePointXY(-57.3, -57.3), makePointXY(-51, -57.3), makePointXY(-57.3, -51)]

  const campSpecs = [
  { monsterType: "frost_golem", pos: makePointXY(-36.5, 12.5), spawns: [makePointXY(0, 0)], firstSpawn: 25, respawn: 90 },
  { monsterType: "glimwing", pos: makePointXY(-35, -13), spawns: [makePointXY(-1, -0.2), makePointXY(1, 0.3)], firstSpawn: 25, respawn: 55 },
  { monsterType: "mossback", pos: makePointXY(-20.5, 0), spawns: [makePointXY(0, 0)], firstSpawn: 25, respawn: 55 },
  ]

  function $z() {
  const campDefs = [],
  campPlacementVariants = [
  { f: copyXY, side: 0, lower: !1 },
  { f: negateXY, side: 0, lower: !0 },
  { f: swapPointXY, side: 1, lower: !1 },
  { f: negateSwapXY, side: 1, lower: !0 },
  ]
  for (const campPlacement of campPlacementVariants)
  for (const campSpec of campSpecs) {
  const effectiveMonsterType = campSpec.monsterType === "frost_golem" && campPlacement.lower ? "ember_golem" : campSpec.monsterType,
  fResult = campPlacement.f(campSpec.pos)
  campDefs.push({ id: campDefs.length, side: campPlacement.side, monsterType: effectiveMonsterType, pos: fResult, spawns: campSpec.spawns.map((spawnOffset) => campPlacement.f(spawnOffset)), firstSpawn: campSpec.firstSpawn, respawn: campSpec.respawn })
  }
  return (
  campDefs.push({ id: campDefs.length, side: 2, monsterType: "abyss_drake", pos: makePointXY(-24, -24), spawns: [makePointXY(0, 0)], firstSpawn: 120, respawn: 150 }),
  campDefs.push({ id: campDefs.length, side: 2, monsterType: "star_colossus", pos: makePointXY(24, 24), spawns: [makePointXY(0, 0)], firstSpawn: 270, respawn: 210 }),
  campDefs
  )
  }

  function u8() {
  return {
  bound: mapBound,
  half: halfSideLength,
  lanes: topConfig,
  laneWidth: 10,
  bases: [i_(0), i_(1)],
  towers: Vz(),
  walls: wallPolygons.flatMap(e_),
  bushes: [...bushPolygons.flatMap(e_), cornerBushPolygon, cornerBushPolygon.map(negateXY)],
  camps: $z(),
  river: [makePointXY(-52, -52), makePointXY(0, 0), makePointXY(52, 52)],
  riverWidth: 10.6,
  }
  }

  function e_(bushMap) {
  return [copyXY, negateXY, swapPointXY, negateSwapXY].map((pointTransform) => bushMap.map(pointTransform))
  }

  return { s_: topLaneWaypoints, Gz: topConfig, a_: towerSites, i_, Vz, Oz: wallPolygons, Bz: bushPolygons, n_: cornerBushPolygon, Hz: campSpecs, $z, u8, e_ }
}
