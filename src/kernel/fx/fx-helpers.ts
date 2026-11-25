/**
 * 特效辅助函数
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { colorToRgb } from './particle-system'
import { ARENA_PALETTE } from '../arena-palette'
import { BASE_PAD_RADIUS, TOWER_PAD_RADIUS, WATER_LEVEL, monsterRadius } from '../world/map-geometry'
import { MONSTER_TERRAIN_PALETTE } from '../render/vegetation-shaders'

function buildArenaDecor(bushMap) {
  const arenaMap = bushMap.map,
    arenaDecals = [],
    teamPadPalettes = [
      { glow: colorToRgb(ARENA_PALETTE.blue.glow), stone: colorToRgb(11122386) },
      { glow: colorToRgb(ARENA_PALETTE.red.glow), stone: colorToRgb(6969440) },
    ]
  arenaMap.towers.forEach((unit, towerIndex) => {
    const towerPadPalette = teamPadPalettes[unit.team]
    arenaDecals.push({ type: 0, x: unit.pos.x, y: 0.02, z: unit.pos.y, radius: TOWER_PAD_RADIUS, colorA: towerPadPalette.glow, colorB: towerPadPalette.stone, seed: towerIndex * 0.37 })
  })
  for (const base of arenaMap.bases) {
    const selectedS = teamPadPalettes[base.team]
    ;(arenaDecals.push({ type: 1, x: base.core.x, y: 0.02, z: base.core.y, radius: BASE_PAD_RADIUS, colorA: selectedS.glow, colorB: selectedS.stone, seed: base.team }),
      arenaDecals.push({ type: 2, x: base.fountain.x, y: 0.03, z: base.fountain.y, radius: base.fountainRadius, colorA: selectedS.glow, colorB: selectedS.stone, seed: base.team + 0.5 }))
  }
  for (const camp of arenaMap.camps) {
    const selectedMONSTER_TERRAIN_PALETTE = MONSTER_TERRAIN_PALETTE[camp.monsterType],
      monsterRadiusResult = monsterRadius(camp.monsterType),
      isBossCamp = camp.monsterType === "abyss_drake" || camp.monsterType === "star_colossus",
      isGolemCamp = camp.monsterType === "frost_golem" || camp.monsterType === "ember_golem"
    if (camp.monsterType === "mossback") {
      const openSideXSign = bushMap.wallDist(camp.pos.x + 1.2, camp.pos.y, 8) < bushMap.wallDist(camp.pos.x - 1.2, camp.pos.y, 8) ? 1 : -1,
        openSideZSign = bushMap.wallDist(camp.pos.x, camp.pos.y + 1.2, 8) < bushMap.wallDist(camp.pos.x, camp.pos.y - 1.2, 8) ? 1 : -1
      arenaDecals.push({ type: 9, x: camp.pos.x + openSideXSign * 1.35, y: 0.02, z: camp.pos.y + openSideZSign * 1.35, radius: 1.15, colorA: colorToRgb(0), colorB: colorToRgb(9073488), seed: camp.id * 0.37 })
    }
    arenaDecals.push({
      type: isBossCamp ? 5 : isGolemCamp ? 4 : 3,
      x: camp.pos.x,
      y: isBossCamp ? WATER_LEVEL + 0.035 : 0.02,
      z: camp.pos.y,
      radius: monsterRadiusResult,
      colorA: colorToRgb(selectedMONSTER_TERRAIN_PALETTE.glow),
      colorB: colorToRgb(selectedMONSTER_TERRAIN_PALETTE.stone),
      seed: camp.id * 0.61,
      w: camp.monsterType === "ember_golem" || camp.monsterType === "star_colossus" ? 1 : 0,
    })
  }
  return arenaDecals
}

export { buildArenaDecor }
