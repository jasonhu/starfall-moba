#!/usr/bin/env node
/**
 * 全量「函数内部变量语义化」工作单生成器（plan-local-names.cjs 的完全覆盖版）。
 *
 * 与旧版区别：
 *  - 旧版只保留 7 类高置信结构性规则，覆盖率 ~6%；
 *  - 本版对 100% 的函数内短名声明生成语义名，信号来源按优先级：
 *      1) 结构性：循环下标 / 遍历元素 / DOM / 距离 / 累加 / Map 键 / 事件
 *      2) 初始化表达式：new 类名、调用方法名、属性名、元素访问基名、
 *         三元比较值、二元运算符、数组/对象字面量、字符串字面量
 *      3) 使用上下文：成员访问集合、布尔赋值、条件判断、比较字面量、push 目标
 *      4) 参数位置 + 函数名
 *      5) 兜底：按初始化类型给角色名（numericValue / booleanFlag / items / config ...）
 *
 * 安全：
 *  - 新名避开函数内的自由引用（防止改名后遮蔽外部绑定改变语义）与 JS 保留字。
 *  - 同函数内重名时追加来源词或序号，不产生外部冲突。
 *
 * 输出工作单（file/fn/line/from/to/occurrence/rule）供 rename-locals.cjs 消费。
 * 用法: node tools/plan-all-names.cjs [--file <相对路径>] [--out <json>]
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/all-names-worklist.json'
const ROOT = path.resolve('.')
const SHORT = /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/
const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.Constructor, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
])
const RESERVED = new Set(`break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval undefined NaN Infinity window document globalThis Math Object Array JSON console Number String Boolean Promise Map Set WeakMap WeakSet Symbol Date RegExp Error Reflect Proxy`.split(' '))
const COMPARISON_OPS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}
function labelOf(node, sf) {
  if (node.name) return node.name.getText(sf)
  const parent = node.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.getText(sf)
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sf)
  return '<anonymous>'
}
function singular(name) {
  const rules = [[/ies$/, 'y'], [/sses$/, 'ss'], [/shes$/, 'sh'], [/ches$/, 'ch'], [/xes$/, 'x'], [/oes$/, 'o'], [/ves$/, 'f'], [/s$/, '']]
  for (const [re, suffix] of rules) if (re.test(name)) return name.replace(re, suffix)
  return name
}
function camel(s) {
  const clean = String(s || '').replace(/[^A-Za-z0-9_$]/g, '')
  if (!clean || /^[0-9]/.test(clean)) return ''
  return clean.charAt(0).toLowerCase() + clean.slice(1)
}
function pascal(s) {
  const c = camel(s)
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : ''
}
function unwrap(e) {
  let x = e
  for (let i = 0; i < 8 && x; i++) {
    if (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x) ||
        (ts.SyntaxKind.SatisfiesExpression && x.kind === ts.SyntaxKind.SatisfiesExpression) || ts.isTypeAssertionExpression(x)) x = x.expression
    else break
  }
  return x || e
}
function baseName(expr, sf) {
  const raw = expr.getText(sf).split('.').pop().replace(/[^A-Za-z0-9_$]/g, '')
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw) ? raw : ''
}

function initSignal(init, sf) {
  if (!init) return { kind: 'param' }
  const e = unwrap(init)
  if (ts.isNewExpression(e)) return { kind: 'new', source: baseName(e.expression, sf) }
  if (ts.isCallExpression(e)) {
    const c = e.expression
    if (ts.isPropertyAccessExpression(c)) return { kind: 'call', source: c.name.text, obj: c.expression.getText(sf), args: e.arguments.map((a) => a.getText(sf)) }
    return { kind: 'call', source: baseName(c, sf), args: e.arguments.map((a) => a.getText(sf)) }
  }
  if (ts.isPropertyAccessExpression(e)) return { kind: 'prop', source: e.name.text, obj: e.expression.getText(sf) }
  if (ts.isElementAccessExpression(e)) return { kind: 'elem', source: baseName(e.expression, sf) }
  if (ts.isConditionalExpression(e)) return { kind: 'cond' }
  if (ts.isBinaryExpression(e)) return { kind: 'binary', op: e.operatorToken.getText(sf) }
  if (ts.isPrefixUnaryExpression(e) || ts.isPostfixUnaryExpression(e)) return { kind: 'unary', op: ts.SyntaxKind[e.operator] || '' }
  if (ts.isArrayLiteralExpression(e)) return { kind: 'array', len: e.elements.length }
  if (ts.isObjectLiteralExpression(e)) return { kind: 'object', firstKey: e.properties[0] && e.properties[0].name ? e.properties[0].name.getText(sf) : '' }
  if (ts.isNumericLiteral(e)) return { kind: 'number' }
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { kind: 'string', source: e.text }
  if (ts.isTemplateExpression(e)) return { kind: 'string', source: '' }
  if (ts.isFunctionExpression(e) || ts.isArrowFunction(e)) return { kind: 'arrow' }
  if (ts.isIdentifier(e)) return { kind: 'ident', source: e.text }
  if (ts.isObjectLiteralExpression(e)) return { kind: 'object' }
  return { kind: 'other', source: e.getText(sf).slice(0, 24) }
}

function usageSignals(item, fnNode, sf) {
  const u = {
    props: new Set(), called: false, accumulator: false, indexUse: false, mapKey: false,
    eventListener: false, assignedBool: false, comparedLiterals: new Set(), isCondition: false,
    passedTo: new Set(), arrayTarget: false, returned: false, loopIndexSource: null, loopOf: null,
    domCreate: false, paramIndex: undefined, isCatch: false, assignedToThis: null,
    isDestructured: false, methodCalls: new Set(),
  }
  const nm = item.name
  const declPos = item.node.getStart(sf)
  const scan = (n) => {
    if (!n || typeof n !== 'object') return
    if (ts.isIdentifier(n) && n.text === nm && n.getStart(sf) !== declPos) {
      const p = n.parent
      if (p) {
        if (ts.isPropertyAccessExpression(p) && p.expression === n) {
          u.props.add(p.name.text)
          // n.foo() → foo 是 n 的方法；方法数多说明 n 是 DSL builder 对象
          if (p.parent && ts.isCallExpression(p.parent) && p.parent.expression === p) u.methodCalls.add(p.name.text)
        }
        if (ts.isCallExpression(p) && p.expression === n) u.called = true
        if (ts.isElementAccessExpression(p) && p.argumentExpression === n) u.indexUse = true
        if (ts.isBinaryExpression(p)) {
          // 参数/局部变量被赋给 this.xxx → 用 xxx 作为语义名（构造函数最常见）
          if (p.left && ts.isPropertyAccessExpression(p.left) && p.left.expression.kind === ts.SyntaxKind.ThisKeyword && p.right === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            u.assignedToThis = p.left.name.text
          }
          if (p.left === n && p.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) u.accumulator = true
          if (COMPARISON_OPS.has(p.operatorToken.kind)) {
            const other = p.left === n ? p.right : p.left
            if (other && (ts.isStringLiteral(other) || ts.isNumericLiteral(other))) u.comparedLiterals.add(String(other.text).toLowerCase())
          }
          if (p.left === n && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const r = unwrap(p.right)
            if (r && ((ts.isPrefixUnaryExpression(r) && r.operator === ts.SyntaxKind.ExclamationToken) || r.kind === ts.SyntaxKind.TrueKeyword || r.kind === ts.SyntaxKind.FalseKeyword)) u.assignedBool = true
          }
        }
        if (ts.isCallExpression(p)) {
          if (p.arguments.includes(n)) {
            const callee = p.expression
            const cname = ts.isPropertyAccessExpression(callee) ? callee.name.text : baseName(callee, sf)
            if (cname) u.passedTo.add(cname)
            if (p.arguments[0] === n && ts.isPropertyAccessExpression(callee) && /^(get|set|has|delete)$/.test(callee.name.text)) u.mapKey = true
          }
          if (ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'push' && p.expression.expression === n) u.arrayTarget = true
        }
        if ((ts.isIfStatement(p) || ts.isWhileStatement(p)) && p.expression === n) u.isCondition = true
        if (ts.isReturnStatement(p) && p.expression === n) u.returned = true
      }
    }
    if (ts.isForStatement(n) && n.initializer && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) {
        if (d.name.getStart(sf) !== declPos) continue
        let src = 'index'
        const cond = n.condition
        if (cond && ts.isBinaryExpression(cond)) {
          const r = cond.right
          if (r && ts.isPropertyAccessExpression(r) && r.name.text === 'length') {
            const b = baseName(r.expression, sf)
            if (b && b.length > 1) src = singular(b)
          }
        }
        u.loopIndexSource = src
      }
    }
    if (ts.isForOfStatement(n) && n.initializer && ts.isVariableDeclarationList(n.initializer)) {
      for (const d of n.initializer.declarations) {
        if (d.name.getStart(sf) !== declPos) continue
        const b = baseName(n.expression, sf)
        u.loopOf = b && b.length > 1 ? singular(b) : 'item'
      }
    }
    ts.forEachChild(n, scan)
  }
  scan(fnNode.body || fnNode)
  u.isDestructured = !!item.isDestructured
  if (item.initializer && /createEl\(|createElement\(|getElementById\(|querySelector\(/.test(item.initializer)) u.domCreate = true
  if (/addEventListener|\.on[a-z]+\s*=/.test(fnNode.getText(sf).slice(0, 500)) && item.node.parent && ts.isParameter(item.node.parent)) u.eventListener = true
  if (!item.initializer && item.node.parent) {
    if (ts.isParameter(item.node.parent)) {
      try { u.paramIndex = item.node.parent.parent.parameters.indexOf(item.node.parent) } catch (e) { u.paramIndex = undefined }
    } else if (ts.isCatchClause(item.node.parent)) u.isCatch = true
  }
  return u
}

function derive(item, sig, u, fnName, callSiteBest) {
  const fn = (fnName || '').toLowerCase()
  const s = sig
  const props = u.props
  const has = (...names) => names.some((n) => props.has(n))

  // ---- 0. 解构别名是跨模块对象键契约，禁止改名 ----
  if (u.isDestructured) return { name: item.name, rule: 'destructured' }
  // DSL builder 对象：被调方法 >=3，命名 builder（发音/渲染构建器），优先于调用点推断
  if (u.methodCalls.size >= 3 && s.kind === 'param') {
    const role = /audio|osc|noise|gain|sfx/i.test(fn) ? 'soundBuilder' : /fx|vfx|particle|emit/i.test(fn) ? 'fxBuilder' : 'builder'
    return { name: role, rule: 'dslBuilder' }
  }

  // ---- 1. 结构性（高置信）----
  if (u.eventListener) return { name: 'event', rule: 'event' }
  if (u.isCatch) return { name: 'caughtError', rule: 'catch' }
  if (u.domCreate || has('style', 'appendChild', 'classList', 'innerHTML', 'textContent', 'className', 'setAttribute')) return { name: 'element', rule: 'element' }
  if (u.loopOf) return { name: u.loopOf, rule: 'loopOf' }
  if (u.loopIndexSource) return { name: u.loopIndexSource === 'index' ? 'index' : `${u.loopIndexSource}Index`, rule: 'loopIndex' }
  if (u.accumulator) return { name: 'total', rule: 'accumulator' }
  if (/Math\.hypot\(/.test(item.initializer || '')) return { name: 'distance', rule: 'distance' }
  if (u.mapKey) {
    if (/^register/.test(fnName)) return { name: u.paramIndex === 1 ? 'registeredValue' : 'registrationKey', rule: 'mapKey' }
    return { name: u.paramIndex === 1 ? 'lookupOption' : 'lookupKey', rule: 'mapKey' }
  }

  // ---- 2. 初始化表达式 ----
  if (s.kind === 'new') {
    const n = camel(s.source)
    if (n) return { name: /array|buffer|list|typed/i.test(n) ? n : n + 'Instance', rule: 'new' }
  }
  if (s.kind === 'call') {
    const m = camel(s.source)
    if (m) {
      if (/^(create|make|build|spawn|emit|alloc)/.test(m)) return { name: m.replace(/^(create|make|build)/, '') + 'Value' || 'createdValue', rule: 'call' }
      if (/^(get|fetch|read|query)/.test(m)) return { name: m.replace(/^(get|fetch|read|query)/, '') + 'Value' || 'fetchedValue', rule: 'call' }
      if (/^on[A-Z]/.test(fnName) && /listener/.test(m)) return { name: 'listener', rule: 'call' }
      return { name: m + 'Result', rule: 'call' }
    }
  }
  if (s.kind === 'prop') {
    const p = camel(s.source)
    // 单字母/超短属性名扩成语义名（坐标 x/y/z、运行时 rt、自身 me 等）
    const shortProps = { x: 'coordX', y: 'coordY', z: 'coordZ', w: 'coordW', rt: 'runtime', me: 'selfPlayer', r: 'radiusValue', h: 'heroRef', k: 'kindValue', m: 'manaValue', s: 'skillValue', d: 'durationValue', t: 'timeValue' }
    if (p && shortProps[p]) return { name: shortProps[p], rule: 'prop-expanded' }
    if (p && p !== 'length') {
      if (/^this$/.test(s.obj) && p.length <= 4) return { name: p + 'State', rule: 'prop' }
      return { name: p, rule: 'prop' }
    }
    if (p === 'length') return { name: 'count', rule: 'prop' }
  }
  if (s.kind === 'elem') {
    const b = camel(s.source)
    if (b) return { name: 'selected' + pascal(b), rule: 'elem' }
  }
  if (s.kind === 'cond') {
    const lit = [...u.comparedLiterals][0]
    if (lit && /^[a-z_]+$/.test(lit) && lit.length > 1) return { name: lit + 'Variant', rule: 'cond' }
    return { name: 'selectedValue', rule: 'cond' }
  }
  if (s.kind === 'binary') {
    const map = { '/': 'ratio', '*': 'product', '+': 'sum', '-': 'difference', '%': 'remainder', '**': 'power', '+=': 'total', '-=': 'difference', '<<': 'shifted', '>>': 'shifted' }
    const r = map[s.op] || 'computed'
    return { name: r + 'Value', rule: 'binary' }
  }
  if (s.kind === 'unary') {
    if (/Exclamation/.test(s.op || '')) return { name: 'isActive', rule: 'unary' }
    return { name: 'numericValue', rule: 'unary' }
  }
  if (s.kind === 'array') {
    if (u.arrayTarget) return { name: 'items', rule: 'array' }
    return { name: 'values', rule: 'array' }
  }
  if (s.kind === 'object') {
    const k = camel(s.firstKey)
    if (k && k !== 'length') return { name: k + 'Config', rule: 'object' }
    return { name: 'config', rule: 'object' }
  }
  if (s.kind === 'string') {
    const v = camel(s.source)
    if (v && v.length > 2) return { name: v, rule: 'string' }
    return { name: 'textValue', rule: 'string' }
  }
  if (s.kind === 'arrow') {
    if (/rnd|random|seed/.test(fn) || /Math\.imul/.test(item.initializer || '')) return { name: 'randomSource', rule: 'arrow' }
    return { name: 'callback', rule: 'arrow' }
  }
  if (s.kind === 'ident') {
    const v = camel(s.source)
    if (v && v.length > 4) return { name: v, rule: 'ident' }
  }

  // ---- 3. 成员访问推断实体 ----
  if (has('heroId', 'skills', 'heroName', 'h')) return { name: 'hero', rule: 'entity' }
  if (has('monsterId', 'monsterType')) return { name: 'monster', rule: 'entity' }
  if (has('minionId', 'minionType', 'lane')) return { name: 'minion', rule: 'entity' }
  if (has('towerId', 'towerType')) return { name: 'tower', rule: 'entity' }
  if (has('state', 'units') || has('state', 'time')) return { name: 'world', rule: 'entity' }
  if (has('bushes', 'map')) return { name: 'bushMap', rule: 'entity' }
  if (has('buffs', 'rt', 'visible', 'alive', 'team')) return { name: 'unit', rule: 'entity' }
  if (has('x', 'y') && !has('team', 'alive', 'hp')) return { name: 'position', rule: 'entity' }

  // ---- 4. 使用上下文 ----
  if (u.assignedBool || (u.isCondition && props.size === 0)) return { name: 'isReady', rule: 'bool' }
  if (u.comparedLiterals.size) {
    const lit = [...u.comparedLiterals][0]
    if (/^[a-z_]+$/.test(lit) && lit.length > 1) return { name: lit + 'Kind', rule: 'compare' }
  }
  if (u.called) return { name: 'callback', rule: 'called' }
  if (u.returned) return { name: 'result', rule: 'return' }

  // ---- 5. 参数位置 + 函数名 ----
  const idx = u.paramIndex
  if (idx === 0) {
    if (/^register/.test(fnName)) return { name: 'registrationKey', rule: 'param' }
    if (/^(get|find|has|is|can)/.test(fnName)) return { name: 'lookupKey', rule: 'param' }
    if (/^set|^mark/.test(fnName)) return { name: 'targetObject', rule: 'param' }
    if (/^create|^build|^spawn|^emit/.test(fnName)) return { name: 'sourceSpec', rule: 'param' }
    if (/^update/.test(fnName)) return { name: 'targetState', rule: 'param' }
  }
  if (idx === 1) {
    if (/^register/.test(fnName)) return { name: 'registrationValue', rule: 'param' }
    if (/^set|^mark/.test(fnName)) return { name: 'propertyName', rule: 'param' }
    if (/^(get|find)/.test(fnName)) return { name: 'lookupOption', rule: 'param' }
    if (/^update/.test(fnName)) return { name: 'updateValue', rule: 'param' }
  }
  if (idx === 2 && /^set|^mark/.test(fnName)) return { name: 'value', rule: 'param' }

  // ---- 5.5 赋给 this.xxx 的参数 → 直接用 xxx ----
  if (u.assignedToThis) {
    const f = camel(u.assignedToThis)
    if (f && f !== item.name && /^[a-z]/.test(f)) return { name: f, rule: 'thisAssign' }
  }

  // ---- 6. 兜底：调用点实参语义 > 参数位置角色 ----
  if (s.kind === 'param' && idx !== undefined) {
    const fromCall = callSiteBest && callSiteBest.get(idx)
    if (fromCall && fromCall !== item.name) return { name: fromCall, rule: 'callSite' }
    const positional = ['primaryInput', 'secondaryInput', 'tertiaryInput', 'quaternaryInput']
    return { name: positional[idx] || `extraInput${idx + 1}`, rule: 'fallback-param' }
  }
  const role = {
    number: 'numericValue', param: 'inputValue', other: 'localValue', unspecified: 'inputValue',
  }[s.kind]
  return { name: role || 'localValue', rule: 'fallback-' + s.kind }
}

/**
 * 跨文件调用点推断：收集每个具名函数在调用处第 N 个实参的语义名。
 * 编译压缩后函数体的参数名丢失，但调用方常传入已语义化的变量（kit/seed/ctx），
 * 这是恢复参数语义最可靠的信号来源。
 */
function buildCallSiteNames(files) {
  const byName = new Map() // fnName -> Map<argIndex, Map<argSemantic, count>>
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    ;(function visit(n) {
      if (ts.isCallExpression(n)) {
        const callee = unwrap(n.expression)
        const fnName = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null)
        if (fnName) {
          let positions = byName.get(fnName)
          if (!positions) { positions = new Map(); byName.set(fnName, positions) }
          n.arguments.forEach((arg, i) => {
            const a = unwrap(arg)
            let semantic = null
            if (ts.isIdentifier(a)) semantic = a.text
            else if (ts.isPropertyAccessExpression(a)) semantic = a.name.text
            // 变量名必须小驼峰且全小写开头：大写开头的是类型/类名（AudioBuffer/ChannelData），
            // 不能作为局部变量名。全大写常量名也排除。
            if (!semantic || semantic.length < 4 || RESERVED.has(semantic) || SHORT.test(semantic)) return
            if (!/^[a-z]/.test(semantic) || /^[A-Z0-9_]+$/.test(semantic)) return
            let counter = positions.get(i)
            if (!counter) { counter = new Map(); positions.set(i, counter) }
            counter.set(semantic, (counter.get(semantic) || 0) + 1)
          })
        }
      }
      ts.forEachChild(n, visit)
    })(sf)
  }
  // fnName -> argIndex -> 最高频语义名
  const result = new Map()
  for (const [fnName, positions] of byName) {
    const best = new Map()
    for (const [i, counter] of positions) {
      const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1])
      const top = sorted[0]
      if (!top) continue
      // 置信度：出现 >=2 次，或唯一候选（该位置只见过一种实参）。
      // 单次且有多种候选时噪声大（如 v(key) 被调用一次恰好传 river），不采用。
      const total = [...counter.values()].reduce((a, b) => a + b, 0)
      const confident = top[1] >= 2 || total === 1
      if (confident) best.set(i, camel(top[0]))
    }
    result.set(fnName, best)
  }
  return result
}

function planFile(file, callSiteNames) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const relative = path.relative(ROOT, file)
  const worklist = []

  // 全文件标识符集合：任何已出现的名字都不作为新名，杜绝跨作用域重复声明。
  const fileForbidden = new Set(RESERVED)
  ;(function collectAllIds(n) {
    if (!n || typeof n !== 'object') return
    if (ts.isIdentifier(n)) fileForbidden.add(n.text)
    ts.forEachChild(n, collectAllIds)
  })(sf)
  const fileUsed = new Set()

    ;(function visit(node) {
      if (String(ts.SyntaxKind[node.kind] || '').startsWith('JSDoc')) return
      if (FN_KINDS.has(node.kind)) {
      const fnName = labelOf(node, sf)
      const root = node
      const declarations = []
      ;(function collect(n) {
        if (!n || typeof n !== 'object') return
        if (n !== root && FN_KINDS.has(n.kind)) return
        if (ts.isIdentifier(n) && n.parent) {
          const p = n.parent
          const isDecl = (p.name === n && (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p))) || (ts.isCatchClause(p) && p.variableDeclaration === n)
          if (isDecl && SHORT.test(n.text)) {
            const init = ts.isVariableDeclaration(p) && p.initializer ? p.initializer.getText(sf) : ''
            // 带 propertyName 的 BindingElement（如 { GROUND_FX_KINDS: Xt }）是解构别名，
            // 属性名是跨模块契约，变量名可改但需保留契约；这里统一跳过，避免历史事故重演。
            const isDestructured = ts.isBindingElement(p) && !!p.propertyName
            declarations.push({ node: n, name: n.text, initText: init, initAst: ts.isVariableDeclaration(p) ? p.initializer : null, isDestructured })
          }
        }
        ts.forEachChild(n, collect)
      })(root)

      // 全文件所有标识符都禁止用作新名：嵌套函数作用域与父作用域互相可见，
      // 只按当前函数收集会漏掉兄弟/嵌套声明，导致 sumValue/inputValue 重复声明。
      const forbidden = fileForbidden

      for (const item of declarations) {
        const sig = initSignal(item.initAst, sf)
        const u = usageSignals(item, root, sf)
        let { name, rule } = derive(item, sig, u, fnName, callSiteNames.get(fnName))
        // 名称清洗：非法或保留字则降级
        if (!name || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || RESERVED.has(name)) { name = 'localValue'; rule = 'sanitize' }
        // 去重：先尝试来源词，再退到序号。fileUsed 全文件共享，杜绝跨函数撞名。
        let candidate = name
        if (forbidden.has(candidate) || fileUsed.has(candidate)) {
          const qualifiers = []
          if (sig.kind === 'call' && sig.source && camel(sig.source) !== name) qualifiers.push(camel(sig.source) + pascal(name))
          if (sig.kind === 'new' && sig.source && camel(sig.source) !== name) qualifiers.push(camel(sig.source))
          if (sig.kind === 'prop' && sig.source && camel(sig.source) !== name) qualifiers.push(camel(sig.source) + 'Value')
          // 数值角色用 Op 后缀区分不同运算结果，避免 productValueOf 这种半吊子名
          if (sig.kind === 'binary') qualifiers.push(name.replace(/Value$/, 'Op'))
          qualifiers.push(name.replace(/Value$/, 'Result'))
          // 后缀必须是完整语义词，不能用 2/Alt（会重新落入短名判定）
          const ordinals = ['Secondary', 'Tertiary', 'Quaternary', 'Fifth', 'Sixth', 'Seventh', 'Eighth']
          for (const o of ordinals) qualifiers.push(name + o)
          candidate = qualifiers.find((q) => q && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(q) && !forbidden.has(q) && !fileUsed.has(q)) || name
        }
        fileUsed.add(candidate)
        if (candidate === item.name) continue
        worklist.push({
          file: relative, fn: fnName,
          line: sf.getLineAndCharacterOfPosition(item.node.getStart(sf)).line + 1,
          from: item.name, to: candidate, rule,
        })
      }
    }
    ts.forEachChild(node, visit)
  })(sf)

  return worklist
}

const files = fileArg ? [path.resolve(ROOT, fileArg)] : walk(path.join(ROOT, 'src'))
const callSiteNames = buildCallSiteNames(files)
const rawWorklist = files.flatMap((f) => planFile(f, callSiteNames))

// 标注 occurrence：同一 (file,fn,line,from) 出现多次时，按生成顺序编号。
// rename-locals 的候选顺序也是 AST 深度优先，与此一致，按编号取对应声明。
const occurrenceCount = new Map()
for (const e of rawWorklist) {
  const k = `${e.file}|${e.fn}|${e.line}|${e.from}`
  occurrenceCount.set(k, (occurrenceCount.get(k) || 0) + 1)
}
const seen = new Map()
const worklist = rawWorklist.map((e) => {
  const k = `${e.file}|${e.fn}|${e.line}|${e.from}`
  const n = (seen.get(k) || 0) + 1
  seen.set(k, n)
  // 只有同组多条时才写 occurrence（单条无需，保持兼容）
  return occurrenceCount.get(k) > 1 ? { ...e, occurrence: n } : e
})
const rules = new Map()
for (const e of worklist) rules.set(e.rule, (rules.get(e.rule) || 0) + 1)
fs.writeFileSync(outFile, JSON.stringify(worklist, null, 2))
const names = new Map()
for (const e of worklist) names.set(e.to, (names.get(e.to) || 0) + 1)
console.log(JSON.stringify({
  entries: worklist.length, files: files.length, outFile,
  topNames: [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
  rules: [...rules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
}, null, 2))
