/**
 * 场景天空配色表 SCENE_SKY_PALETTES：菜单 / 胜利 / 失败三套（原 starfall.core.js 第 51975-52033 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
/** 单个场景的天空/地平线/山脊配色 */
export interface SceneSkyPalette {
  sky: Array<[number, string]>
  horizon: string
  horizonGlow: string
  beam: string
  ridge: string[]
  rim: string
  meteorRate: number
  moteDir: number
  [key: string]: unknown
}
const SCENE_SKY_PALETTES: Record<string, SceneSkyPalette> = {
  menu: {
    sky: [
      [0, "#02040d"],
      [0.34, "#060d2a"],
      [0.62, "#0d2152"],
      [0.8, "#1a4a82"],
      [1, "#27719a"],
    ],
    horizon: "#3aa0c8",
    horizonGlow: "rgba(92, 214, 247, 0.34)",
    beam: "255, 226, 160",
    ridge: ["#16346a", "#0c1d45", "#050a1c"],
    rim: "rgba(160, 220, 255, 0.5)",
    star: "225, 238, 255",
    meteor: "201, 246, 255",
    meteorRate: 0.42,
    mote: "255, 226, 160",
    moteDir: 1,
  },
  victory: {
    sky: [
      [0, "#050410"],
      [0.34, "#0e1034"],
      [0.62, "#262258"],
      [0.8, "#70502e"],
      [1, "#c98d3c"],
    ],
    horizon: "#ffd98a",
    horizonGlow: "rgba(255, 214, 130, 0.42)",
    beam: "255, 240, 200",
    ridge: ["#3c3260", "#1a1838", "#07060f"],
    rim: "rgba(255, 226, 160, 0.6)",
    star: "255, 244, 214",
    meteor: "255, 231, 173",
    meteorRate: 0.9,
    mote: "255, 231, 173",
    moteDir: 1,
  },
  defeat: {
    sky: [
      [0, "#030409"],
      [0.34, "#090c18"],
      [0.62, "#141a2c"],
      [0.8, "#2a2636"],
      [1, "#4a2c34"],
    ],
    horizon: "#8a4a52",
    horizonGlow: "rgba(182, 60, 70, 0.26)",
    beam: "190, 120, 130",
    ridge: ["#1c2234", "#10131f", "#05060b"],
    rim: "rgba(170, 130, 150, 0.35)",
    star: "170, 180, 205",
    meteor: "170, 180, 205",
    meteorRate: 0,
    mote: "150, 150, 165",
    moteDir: -1,
  },
}

export { SCENE_SKY_PALETTES }
