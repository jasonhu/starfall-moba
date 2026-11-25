#!/usr/bin/env node
/**
 * 改名工作单的 AST 精确校验器（不写盘）。
 *
 * @ts-nocheck 模块里 tsc 查不出重复声明，改名后可能撞同函数内已有变量/其他目标名。
 * 本工具做三件校验：
 *   1) 每个工作项能唯一定位到 (file,line,from) 声明；
 *   2) 同函数 AST 区间内，两个声明不会改成同名；
 *   3) 改成的目标名不会撞同函数区间内「未参与改名」的变量；
 *   4) 目标名不是假语义化（primaryInput→primaryinput、valueX、序数/Extra 后缀等）；
 *   5) 目标名不会撞「祖先/后代嵌套函数」中声明的变量（遮蔽冲突，tsc 在 @ts-nocheck 下也查不出）。
 * 通过后把带 _fnStart/_fnEnd 的工作单写到 --verified（供 rename-locals.cjs 用，字段无害）。
 *
 * 用法: node tools/verify-rename-worklist.cjs <worklist.json> --verified /tmp/xxx-verified.json
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const wlFile = args.find((a) => !a.startsWith('--'))
const vIdx = args.indexOf('--verified')
const VERIFIED = vIdx >= 0 ? args[vIdx + 1] : null
if (!wlFile) { console.error('用法: verify-rename-worklist.cjs <worklist.json> [--verified out.json]'); process.exit(2) }

const ROOT = path.resolve('.')
const wl = JSON.parse(fs.readFileSync(wlFile, 'utf8'))
if (!Array.isArray(wl)) throw new Error('工作单必须是数组')

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
])

const declCache = new Map()
function declsOf(file) {
  if (declCache.has(file)) return declCache.get(file)
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const stack = []
  const arr = []
  ;(function visit(n) {
    const isFn = FN_KINDS.has(n.kind)
    let pushed = false
    if (isFn) { stack.push(n); pushed = true }
    const env = stack[stack.length - 1]
    if (env && ts.isIdentifier(n)) {
      const p = n.parent
      if (p && p.name === n && (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p))) {
        // fnChain: 从最外层到最内层的函数起点数组，用于检测嵌套作用域遮蔽撞名
        arr.push({
          name: n.text,
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          fnStart: env.getStart(sf),
          fnEnd: env.end,
          fnChain: stack.map((f) => f.getStart(sf)),
        })
      }
    }
    ts.forEachChild(n, visit)
    if (pushed) stack.pop()
  })(sf)
  declCache.set(file, arr)
  return arr
}

const failures = []
// 校验 4：假语义化目标名（转小写变体 / 序数 / Extra 数字 / valueX 系列）
// 与 inventory-pseudo-all.cjs 的 suspect() 保持同源：目标名本身不能再落回伪语义集合，
// 否则改名后复扫不归零（曾漏 selectedValue：盘点器判伪、本工具未拦）。
const MECH_ROOT = 'numeric|computed|product|sum|difference|ratio|selected|input|local|min|max|round|floor|ceil|abs|sin|cos|tan|atan2|hypot|sqrt|pow|clamp|clip|lerp|map|add|find|slice|indexOf|next|range|remainder|step|hold|now|elapsed|total|scaled|shifted|lerped|smoothed|rounded|clamped'
const BANNED = new RegExp(
  '^(primaryinput|secondaryinput|tertiaryinput|quaternaryinput|quinaryinput|extrainput|' +
  'numericvalue|numericresult|computedvalue|computedresult|productvalue|productresult|' +
  'sumvalue|sumresult|differencevalue|differenceresult|ratiovalue|ratioresult|' +
  'selectedvalue|sourcespec|targetstate|values|clipvalue|clampunitresult|lerpvalue|' +
  'value|valuelist|valuex|valuey|valuez|valueedge|valuetip|valuebase|valueinner|valueouter|' +
  'valuemid|valuestart|valueend|valuelow|valuehigh|valuecore|valuerim|callback)$' +
  '|(Secondary|Tertiary|Quaternary|Quinary|Senary|Seventh|Eighth|Ninth|Tenth|Fourth|Fifth|Sixth|Extra\\d|Value\\d|Input\\d)$|Instance$|Result$|' +
  '^(' + MECH_ROOT + ')(Result|Value|Op)$',
  'i'
)
for (const w of wl) {
  if (typeof w.to === 'string' && BANNED.test(w.to)) {
    failures.push({ reason: 'PSEUDO_TARGET_NAME', from: w.from, to: w.to, line: w.line, file: w.file })
  }
}
let resolved = 0
let strippedAnonFn = 0
for (const w of wl) {
  // 盘点器的匿名 fn 标签是 <anonymous@N>，而 rename-locals.cjs 的 fnLabel 是 <anonymous>。
  // 去掉该字段后按 (name,line) 定位（调用方需保证同行同名唯一，本工具下方会校验）。
  if (typeof w.fn === 'string' && w.fn.startsWith('<anonymous')) { delete w.fn; strippedAnonFn++ }
  const file = path.resolve(ROOT, w.file)
  const arr = declsOf(file)
  const cand = arr.filter((d) => d.name === w.from && d.line === w.line)
  if (cand.length !== 1) {
    failures.push({ ...w, reason: cand.length ? 'AMBIGUOUS' : 'NOT_FOUND', candidates: cand.length })
    continue
  }
  w._fnStart = cand[0].fnStart
  w._fnEnd = cand[0].fnEnd
  resolved++
}

// 剥离 fn 后按 (file,line,from) 定位：若同名声明在同一行出现多次会歧义
const keyCount = {}
for (const w of wl) { const k = w.file + '|' + w.line + '|' + w.from; keyCount[k] = (keyCount[k] || 0) + 1 }
for (const [k, c] of Object.entries(keyCount)) {
  if (c > 1) failures.push({ reason: 'DUPLICATE_KEY_AFTER_FN_STRIP', key: k, count: c })
}

// 同函数区间内：两个声明改成同名
const byRegion = {}
for (const w of wl) {
  if (w._fnStart === undefined) continue
  const k = w.file + '|' + w._fnStart
  ;(byRegion[k] || (byRegion[k] = [])).push(w)
}
for (const [k, v] of Object.entries(byRegion)) {
  const byTo = {}
  for (const w of v) (byTo[w.to] || (byTo[w.to] = [])).push(w)
  for (const [to, items] of Object.entries(byTo)) {
    if (items.length > 1) failures.push({ reason: 'TARGET_DUP_IN_FUNCTION', region: k, to, froms: items.map((x) => x.from + '@' + x.line) })
  }
}

// 目标名撞同函数区间内未改声明
for (const file of new Set(wl.map((w) => w.file))) {
  const full = path.resolve(ROOT, file)
  const changedByRegion = {}
  for (const w of wl) {
    if (w.file !== file || w._fnStart === undefined) continue
    const k = w._fnStart + '-' + w._fnEnd
    ;(changedByRegion[k] || (changedByRegion[k] = new Map())).set(w.to, w)
  }
  for (const d of declsOf(full)) {
    const map = changedByRegion[d.fnStart + '-' + d.fnEnd]
    if (!map) continue
    const hit = map.get(d.name)
    if (hit && !(hit.from === d.name && hit.line === d.line)) {
      failures.push({ reason: 'COLLIDE_WITH_UNCHANGED', file, decl: d.name + '@' + d.line, from: hit.from + '@' + hit.line, to: hit.to })
    }
  }
}

// 校验 5：嵌套函数遮蔽撞名。
// shop-panel 踩坑：外层 let detailPriceElement 与内层 qt() 内 const 都改成同名，
// 内层遮蔽外层，导致「给外层赋值」实际落到内层 const → Cannot assign to constant。
// 同函数区间（a.fnStart===b.fnStart）由校验 2/3 覆盖；这里只处理祖先-后代关系。
for (const file of new Set(wl.map((w) => w.file))) {
  const full = path.resolve(ROOT, file)
  const allDecls = declsOf(full)
  // (line|name) -> 改名工作项（若该声明参与了改名）
  const wByDecl = new Map()
  for (const w of wl) {
    if (w.file !== file || w._fnStart === undefined) continue
    if (w.from === w.to) continue // no-op 不参与遮蔽检测（便于自检时构造 from===to 全量清单）
    wByDecl.set(w.line + '|' + w.from, w)
  }
  const finalName = (d) => {
    const w = wByDecl.get(d.line + '|' + d.name)
    return w ? w.to : d.name
  }
  for (let i = 0; i < allDecls.length; i++) {
    for (let j = i + 1; j < allDecls.length; j++) {
      const a = allDecls[i], b = allDecls[j]
      const fa = finalName(a), fb = finalName(b)
      if (fa !== fb) continue
      // 至少一个是改名项，否则是代码原本就有的合法遮蔽，不归本工具管
      if (!wByDecl.has(a.line + '|' + a.name) && !wByDecl.has(b.line + '|' + b.name)) continue
      if (a.fnStart === b.fnStart) continue // 同区间交给校验 2/3
      const aNested = (a.fnChain || [a.fnStart]).includes(b.fnStart)
      const bNested = (b.fnChain || [b.fnStart]).includes(a.fnStart)
      if (!aNested && !bNested) continue // 兄弟作用域，互不影响
      // inner = 函数链更深者，outer = 更浅者
      const aDepth = (a.fnChain || []).length, bDepth = (b.fnChain || []).length
      const inner = aDepth >= bDepth ? a : b
      const outer = aDepth >= bDepth ? b : a
      failures.push({
        reason: 'SHADOW_COLLIDE',
        file,
        to: fa,
        inner: inner.name + '@' + inner.line,
        outer: outer.name + '@' + outer.line,
        innerDepth: inner.fnChain.length,
        outerDepth: outer.fnChain.length,
      })
    }
  }
}

console.log(JSON.stringify({ total: wl.length, resolved, strippedAnonFn, failures: failures.length, detail: failures.slice(0, 40) }, null, 2))
if (VERIFIED && failures.length === 0) fs.writeFileSync(VERIFIED, JSON.stringify(wl, null, 2))
if (failures.length) process.exitCode = 1
