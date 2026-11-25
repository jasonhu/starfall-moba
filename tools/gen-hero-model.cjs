const fs = require('fs')
const P = 'src/kernel/starfall.core.js'
const L = fs.readFileSync(P, 'utf8').split('\n')
const slice = (a, b) => L.slice(a - 1, b).join('\n')

// ── 1. 取程咬金底座 SU（42127-42599）与装配 AU（42750-42866）
let base = slice(42127, 42599)
let rig = slice(42750, 42866)
if (!base.startsWith('function SU()') || !rig.startsWith('function AU()')) throw new Error('范围漂移，重新核对行号')

// ── 2. 底座：改名 + 换调色板 + 把斧子换成戟
base = base.replace('function SU()', 'function SX()').replace(/ne\./g, 'nX.')
const axeStart = base.indexOf('  ;(i.bone(e.propR),')
const axeEnd = base.indexOf('  for (let R = 0; R < 4; R++) {')
if (axeStart < 0 || axeEnd < 0) throw new Error('找不到武器段')
const halberd = `  ;(i.bone(e.propR),
    i.g(pt(-s.shoulderX, s.handY, 0), () => {
      // 戟杆：柘木，黑漆
      ;(i.paint(nX.shaft, { c2: nX.shaftDark, gloss: 0.28, mat: K.leather }),
        i.tube(
          [
            [0, 0, -0.46, 0.026],
            [0, 0, 0.36, 0.029],
            [0, 0, 1.52, 0.031],
          ],
          { seg: 6 },
        ),
        // 握把缠绳
        i.paint(nX.wrap, { c2: nX.wrapDark, gloss: 0.2, mat: K.cloth }),
        i.tube(
          [
            [0, 0, -0.32, 0.034],
            [0, 0, 0.16, 0.035],
          ],
          { seg: 6, cap0: !1, cap1: !1 },
        ),
        // 尾镦
        i.paint(nX.brass, { c2: nX.brassDark, gloss: 1, mat: K.metal }),
        i.tube(
          [
            [0, 0, -0.56, 0.006],
            [0, 0, -0.5, 0.034],
            [0, 0, -0.44, 0.03],
          ],
          { seg: 6, cap1: !1 },
        ),
        // 矛尖
        i.paint(nX.steelDark, { c2: nX.steel, gloss: 1, mat: K.metal }),
        i.tube(
          [
            [0, 0, 1.5, 0.024],
            [0, 0, 1.72, 0.021],
            [0, 0, 1.9, 0.012],
            [0, 0, 2.04, 0.002],
          ],
          { seg: 6, cap0: !1 },
        ),
        // 侧月牙（戟枝）
        i.paint(nX.steelDark, { c2: nX.steel, gloss: 1, mat: K.metal }),
        i.g(pt(0, 0, 1.62, 0, 0, -26), () =>
          i.extrude(
            [
              [0.02, 0.055],
              [0.2, 0.15],
              [0.38, 0.14],
              [0.47, 0.03],
              [0.42, -0.06],
              [0.3, -0.03],
              [0.16, -0.05],
              [0.02, -0.045],
            ],
            0.05,
            0.013,
          ),
        ),
        // 金环
        i.paint(nX.brass, { c2: nX.brassDark, gloss: 1, mat: K.metal }),
        i.g(pt(0, 0, 1.46, 0, 0, 0), () => i.torus(0.036, 0.008, 0.011, 8, 3, { crease: 30 })),
        // 红缨
        i.paint(nX.tassel, { c2: nX.tasselDark, mat: K.fur }),
        i.tube(
          [
            [0, 0, 1.42, 0.018],
            [0.015, -0.07, 1.33, 0.055],
            [0.025, -0.17, 1.22, 0.02],
          ],
          { seg: 6 },
        ))
    })
  )
`
base = base.slice(0, axeStart) + halberd + base.slice(axeEnd)

// ── 3. 装配：改名 + 换调色板 + 关键数值（体型/武器挂点/身高）
rig = rig
  .replace('function AU()', 'function XY()')
  .replace(/jt\./g, 'jX.')
  .replace('} = SU(),', '} = SX(),')
  .replace('key: "hero:chijin"', 'key: "hero:xiangyu"')
  .replace('height: 2.3,', 'height: 2.44,')
  .replace('radius: 0.64,', 'radius: 0.72,')
  .replace('weapon: { joint: i.propR, x: 0, y: -0.4, z: Co.head },', 'weapon: { joint: i.propR, x: 0, y: -0.4, z: 1.95 },')
  .replace('muzzle: { joint: i.propR, x: 0, y: -0.4, z: Co.head },', 'muzzle: { joint: i.propR, x: 0, y: -0.4, z: 1.95 },')
if (!rig.includes('key: "hero:xiangyu"')) throw new Error('装配段改名失败')

const palettes = `
// ── 项羽专属调色板（玄黑重甲 / 赤红披风 / 鎏金饰件）
const nX = {
    ...ne,
    shaft: 3020053, shaftDark: 1774090,
    wrap: 9121600, wrapDark: 6183494,
    steel: 11516875, steelDark: 5920844,
    brass: 14261800, brassDark: 8933930,
    tassel: 12064024, tasselDark: 6882312,
    red: 11278506, redLight: 14577206,
  },
  jX = {
    ...jt,
    robe: 2368306, robeDark: 1316384,
    pants: 2104616, pantsDark: 1250570,
    wrap: 5386539, wrapDark: 3426626,
    leather: 5197633, leatherDark: 2896689, leatherLight: 7365984,
    iron: 4145733, ironLight: 6251101,
    brass: 14261800, brassDark: 8933930,
    skin: 13809755, hair: 1440785,
    cap: 1243684, capHi: 2494500,
    pheasant: 11278506, pheasantTip: 16496036,
    lining: 12484507, liningShade: 9723242,
    lacquer: 1774090, lacquerDark: 1053730,
    silk: 10185806,
  }
`
const fnBlock = palettes + '\n' + base + '\n' + rig

const src = fs.readFileSync(P, 'utf8')
if (src.includes('function SX()')) throw new Error('已经生成过')
const anchor = 'const Gx = {'
if (!src.includes(anchor)) throw new Error('找不到 Gx')
fs.writeFileSync(P, src.replace(anchor, fnBlock + '\n' + anchor))
console.log('已生成 SX/XY 与新调色板')
