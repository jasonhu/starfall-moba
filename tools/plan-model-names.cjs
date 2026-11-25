#!/usr/bin/env node
/**
 * model-*.ts 伪语义名 → 领域语义名 规划器（v2）。
 *
 * 从 inventory-model-names.cjs 的盘点 JSON 推断真实语义，优先级：
 *  1. 解构别名 { rig: x } → rig（键即语义）
 *  2. 成员访问签名 → 领域角色（builder/rig/joints/palette/surface/...）
 *  3. 初始化表达式 → 运算语义（deltaX/deltaY/deltaZ/ratio/scaled/...）
 *  4. 同行参数组 → 参数位置角色（coordX/Y/Z、colorStops、spec...）
 *  5. 兜底 → 简短惯例名
 *
 * 关键：按【函数作用域】去重，不同函数复用同一个好名字；同函数内冲突用
 * 【领域维度后缀】（X/Y/Z/Width/Height/Start/End）而非 Primary/Secondary 数字序号。
 *
 * 用法: node tools/plan-model-names.cjs --in /tmp/model-names.json --out /tmp/model-plan.json
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

// 收集每个文件里出现的所有标识符文本（用于遮蔽防护的禁用种子）
const tsSrcCache = new Map()
function buildFileIdentifiers(file) {
  const abs = path.resolve('.', file)
  if (!fs.existsSync(abs)) return null
  const src = fs.readFileSync(abs, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const ids = new Set()
  ;(function walk(n) {
    if (ts.isIdentifier(n)) ids.add(n.text)
    ts.forEachChild(n, walk)
  })(sf)
  const result = { allIds: ids }
  tsSrcCache.set(file, result)
  return result
}

const args = process.argv.slice(2)
function arg(name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const IN = arg('--in', '/tmp/model-names.json')
const OUT = arg('--out', '/tmp/model-plan.json')
const items = JSON.parse(fs.readFileSync(IN, 'utf8'))

// ---------- 领域角色词典：成员签名 → 语义名 ----------
const ROLE_RULES = [
  ['builder', ['bone', 'lathe', 'sheet', 'tube', 'paint', 'sym', 'torus', 'box', 'ball', 'extrude', 'addChain', 'chain', 'bakeGrounding', 'limb', 'bind'], []],
  ['rig', ['J', 'pelvis', 'bendFront', 'bendHind'], []],
  ['joints', ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'foreL', 'foreR', 'clavL', 'clavR', 'propR', 'hips', 'spine', 'chest', 'head', 'neck', 'jaw', 'upper', 'lower', 'tip'], ['rx', 'scale']],
  ['proportions', ['headY', 'hipY', 'kneeY', 'shoulderX', 'shoulderY', 'elbowY', 'wristY', 'chestY', 'spineY', 'pelvisY', 'handY', 'chestX'], []],
  ['surfaceProfile', ['surf', 'ring', 'cy'], []],
  ['ribbonSpec', ['axis', 'bow', 'tailLen', 'nu', 'nv', 'wave', 'tail', 'width'], []],
  ['featureSpec', ['spread', 'eyeW', 'eyeH', 'irisSize', 'iris', 'brow', 'lip', 'mouthW', 'slant', 'lash', 'nose', 'ears', 'smile', 'open'], []],
  ['furSpec', ['thick', 'drop', 'puff', 'tufts', 'tuftR', 'mustache', 'curl'], []],
  ['limbSpec', ['rAnkle', 'rTop', 'toe', 'seg', 'top'], []],
  ['paintStyle', ['gloss', 'ao', 'mat', 'c2'], []],
  ['animState', ['time', 'seed', 'anim', 'stride', 'windup', 'hitT', 'spawnT', 'deathT', 'mode', 'hp'], []],
  ['pose', ['rx', 'ry', 'rz', 'side', 'front'], []],
  ['effectStyle', ['tint', 'tintColor'], []],
  ['worldState', ['team', 'variant', 't', 'p', 'windup'], ['rx', 'ry', 'rz']],
]
function roleFromProps(props) {
  const set = new Set(props)
  let best = null
  for (const [name, must, exclude] of ROLE_RULES) {
    if (exclude.some((e) => set.has(e))) continue
    const hits = must.filter((m) => set.has(m)).length
    if (hits && (!best || hits > best.hits)) best = { name, hits }
  }
  return best
}

// 解构键 → 语义名
const BINDING_MAP = { rig: 'rig', J: 'joints', d: 'proportions', p: 'position', pos: 'position', bone: 'bone', s: 'scale' }

// ---------- 初始化表达式 → 运算语义 ----------
function semanticFromInit(init) {
  const e = init.replace(/\s+/g, ' ')
  if (!e) return null
  if (/^\[/.test(e)) return 'entries'
  if (/^clampUnit\(/.test(e)) return 'clamped'
  if (/\blerpValue\(/.test(e)) return 'lerped'
  if (/^Math\.(sqrt|abs)\(/.test(e)) return 'magnitude'
  if (/^Math\.hypot\(/.test(e)) return 'distance'
  if (/^Math\.(sin|cos|atan2)\(/.test(e)) return 'angleValue'
  if (/^\S+\s*-\s*\S+/.test(e)) {
    const idx = e.match(/\[(\d)\]/)
    return idx ? ['deltaX', 'deltaY', 'deltaZ'][Number(idx[1])] || 'delta' : 'delta'
  }
  if (/\+\s*[A-Za-z]/.test(e)) return 'sum'
  if (/\*/.test(e)) return 'scaledValue'
  if (/\//.test(e)) return 'ratio'
  return null
}

function opSemantic(name) {
  if (/^difference/.test(name)) return 'delta'
  if (/^product/.test(name)) return 'scaledValue'
  if (/^sum/.test(name)) return 'sum'
  if (/^ratio/.test(name)) return 'ratio'
  if (/^computed|^numeric/.test(name)) return 'computed'
  if (/^clamp/.test(name)) return 'clamped'
  if (/^lerp/.test(name)) return 'lerped'
  if (/^selected|^values|^entries|^items/.test(name)) return 'items'
  return null
}

// ---------- 推断目标名 ----------
function infer(item, groupInfo) {
  // 1) 解构别名
  if (item.bindingKey && BINDING_MAP[item.bindingKey]) return { name: BINDING_MAP[item.bindingKey], rule: 'binding' }

  // 2) 成员签名
  const role = roleFromProps(item.props)
  if (role) return { name: role.name, rule: 'role:' + role.name }

  // 3) 集合方法
  const setMethods = ['push', 'length', 'map', 'slice', 'forEach', 'add', 'clone', 'dot']
  if (item.props.length && item.props.every((p) => setMethods.includes(p))) return { name: 'entries', rule: 'collection' }

  // 4) 初始化是 X[i] → 数组【元素】，用单数语义名
  if (/^\w+\[[^\]]+\]$/.test(item.init.replace(/\s+/g, ''))) {
    const elem = item.indexUses && item.indexUses.length >= 1 ? 'element' : 'element'
    return { name: elem, rule: 'element' }
  }

  // 5) 被多次索引（X[i] 访问）→ 数组【集合】，用复数语义名
  if (item.indexUses && item.indexUses.length >= 2) return { name: 'samples', rule: 'indexed' }

  // 6) 初始化表达式
  const sem = semanticFromInit(item.init)
  if (sem) return { name: sem, rule: 'init' }

  // 6) 运算基名
  const op = opSemantic(item.name)
  if (op) return { name: op, rule: 'op' }

  // 7) 同行参数组：按组内位置给坐标/序号语义
  if (groupInfo && groupInfo.size >= 3 && item.init === '') {
    const pos = groupInfo.index
    if (pos < 3) return { name: ['coordX', 'coordY', 'coordZ'][pos], rule: 'group-coord' }
  }
  if (groupInfo && groupInfo.size === 2 && item.init === '') {
    return { name: groupInfo.index === 0 ? 'primary' : 'secondary', rule: 'group-pair' }
  }

  // 8) 回调
  if (/^callback/.test(item.name)) return { name: 'callback', rule: 'callback' }

  // 9) 兜底
  return { name: 'value', rule: 'fallback' }
}

// ---------- 按函数作用域去重（维度/领域后缀）----------
const used = new Map()
function dedupe(item, baseName) {
  const key = item.file + '|' + item.fn
  let set = used.get(key)
  if (!set) {
    set = new Set()
    // 禁用种子：本函数所有原始声明名，防止新名撞上"未改名"的现存变量
    // （@ts-nocheck 模块 tsc 不查重复声明，必须在这里防）
    if (item.localNames) for (const n of item.localNames) set.add(n)
    used.set(key, set)
  }
  if (!set.has(baseName)) { set.add(baseName); return baseName }
  // 冲突：优先用维度/领域后缀
  const dims = ['X', 'Y', 'Z', 'Width', 'Height', 'Depth', 'Start', 'End', 'Near', 'Far', 'Top', 'Bottom', 'Inner', 'Outer']
  for (const d of dims) {
    const cand = baseName + d
    if (!set.has(cand)) { set.add(cand); return cand }
  }
  let i = 2
  while (set.has(baseName + 'V' + i)) i++
  const cand = baseName + 'V' + i
  set.add(cand)
  return cand
}

// 构建同行参数组索引
const groupMap = new Map()
for (const x of items) {
  const k = x.file + '|' + x.fn + '|' + x.line
  if (!groupMap.has(k)) groupMap.set(k, [])
  groupMap.get(k).push(x)
}

const plan = []
for (const item of items) {
  const group = groupMap.get(item.file + '|' + item.fn + '|' + item.line)
  const groupInfo = (group && group.length > 1 && group.indexOf(item) >= 0)
    ? { size: group.length, index: group.indexOf(item) } : null
  const { name: raw, rule } = infer(item, groupInfo)
  const to = dedupe(item, raw)
  plan.push({ file: item.file, fn: item.fn, line: item.line, from: item.name, to, rule })
}

fs.writeFileSync(OUT, JSON.stringify(plan, null, 2))
const ruleCount = {}
for (const p of plan) ruleCount[p.rule] = (ruleCount[p.rule] || 0) + 1
const nameCount = {}
for (const p of plan) nameCount[p.to] = (nameCount[p.to] || 0) + 1
console.log('entries:', plan.length)
console.log('rules:', JSON.stringify(Object.entries(ruleCount).sort((a, b) => b[1] - a[1])))
console.log('top names:', JSON.stringify(Object.entries(nameCount).sort((a, b) => b[1] - a[1]).slice(0, 25)))
console.log('out:', OUT)
