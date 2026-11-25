export interface Vec2 { x: number; y: number }

/** 地图坐标工具（内核注入） */
export interface MapKit {
  $t: (x: number, y: number) => Vec2
  $h: (p: Vec2) => Vec2
  I0: (p: Vec2) => Vec2
  Ax: (p: Vec2) => Vec2
  h8: (p: Vec2) => Vec2
}

export interface BaseLayout {
  team: number
  core: Vec2
  fountain: Vec2
  fountainRadius: number
  spawns: Vec2[]
  minionSpawn: { top: Vec2; mid: Vec2; bot: Vec2 }
  area: Vec2[]
}

export interface TowerDef { team: number; lane: string; tier: number; pos: Vec2 }
export interface CampDef {
  id: number; side: number; monsterType: string; pos: Vec2
  spawns: Vec2[]; firstSpawn: number; respawn: number
}

/** 地图数据契约：改这里就等于换地图 */
export interface GameMap {
  bound: number
  half: number
  lanes: { top: Vec2[]; mid: Vec2[]; bot: Vec2[] }
  laneWidth: number
  bases: BaseLayout[]
  towers: TowerDef[]
  walls: Vec2[][]
  bushes: Vec2[][]
  camps: CampDef[]
  river: Vec2[]
  riverWidth: number
}
