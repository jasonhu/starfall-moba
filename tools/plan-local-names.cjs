#!/usr/bin/env node
/**
 * 生成「函数内部变量语义化」工作单（供 rename-locals.cjs 消费）。
 *
 * 只给高置信信号命名，不做无依据的猜测：
 *  - DOM 创建 / 事件监听 / 循环元素 / 循环下标 / 距离与累加等结构性模式；
 *  - 通过成员访问推断实体类型（hero / unit / monster / world / position）；
 *  - 兜底只覆盖调用方语义明确的函数名（handler / callback / predicate）。
 *
 * 用法: node tools/plan-local-names.cjs [--file <相对路径>] [--out <json>]
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/local-name-worklist.json'
const ROOT = path.resolve('.')
const SHORT = /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
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
  const rules = [
    [/ies$/, 'y'],
    [/sses$/, 'ss'],
    [/shes$/, 'sh'],
    [/ches$/, 'ch'],
    [/xes$/, 'x'],
    [/oes$/, 'o'],
    [/ves$/, 'f'],
    [/s$/, ''],
  ]
  for (const [re, suffix] of rules) if (re.test(name)) return name.replace(re, suffix)
  return name
}

function classify(initializer, props, features, fnName) {
  const init = (initializer || '').replace(/\s+/g, ' ')
  const memberSet = new Set(props)
  const index = features.get('paramIndex')

  if (features.has('eventListener') || /^on[A-Z]/.test(fnName)) return 'event'
  if (/createEl\(|createElement\(|getElementById\(|querySelector\(/.test(init)) return 'element'
  if (memberSet.has('style') || memberSet.has('appendChild') || memberSet.has('classList')) return 'element'
  if (features.has('mapKey')) {
    if (/^register/.test(fnName)) return index === 1 ? 'registrationValue' : 'registrationKey'
    return index === 1 ? 'lookupOption' : 'lookupKey'
  }
  if (/Math\.hypot\(/.test(init)) return 'distance'
  if (features.has('accumulator')) return 'total'
  if (features.has('loopIndex')) return 'index'
  if (features.has('loopOf')) return features.get('loopOf')
  if (memberSet.has('x') && memberSet.has('y') && !memberSet.has('team') && !memberSet.has('alive')) return 'position'

  if (memberSet.has('heroId') || memberSet.has('skills') || memberSet.has('heroName')) return 'hero'
  if (memberSet.has('monsterId') || memberSet.has('monsterType')) return 'monster'
  if (memberSet.has('minionId') || memberSet.has('lane')) return 'minion'
  if (memberSet.has('towerId') || memberSet.has('towerType')) return 'tower'
  if (memberSet.has('state') && memberSet.has('units')) return 'world'
  if (memberSet.has('state') && memberSet.has('time')) return 'battleState'
  if (memberSet.has('bushes')) return 'bushMap'
  if (memberSet.has('passive') && memberSet.has('id')) return 'unit'
  if ((memberSet.has('pos') || memberSet.has('position')) && (memberSet.has('team') || memberSet.has('alive') || memberSet.has('hp'))) return 'unit'
  if (memberSet.has('buffs') || memberSet.has('visible') || memberSet.has('rt')) return 'unit'

  if (features.has('called') && /callback|handler|factory|predicate|fn$/i.test(fnName)) return 'callback'
  if (/length$|\.length/.test(init)) return 'count'

  // 函数名驱动的参数角色：只覆盖常见且低歧义的前三个参数。
  if (index === 0) {
    if (/^register/.test(fnName)) return 'registrationKey'
    if (/^get|^find|^has/.test(fnName)) return 'lookupKey'
    if (/^is/.test(fnName)) return 'candidate'
    if (/^set|^mark/.test(fnName)) return 'targetObject'
    if (/^create|^build|^spawn|^emit/.test(fnName)) return 'sourceSpec'
    if (/^update/.test(fnName)) return 'targetState'
  }
  if (index === 1) {
    if (/^register/.test(fnName)) return 'registrationValue'
    if (/^set|^mark/.test(fnName)) return 'propertyName'
    if (/^get|^find/.test(fnName)) return 'lookupOption'
    if (/^update/.test(fnName)) return 'updateValue'
  }
  if (index === 2 && /^set|^mark/.test(fnName)) return 'value'
  return null
}

function planFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const relative = path.relative(ROOT, file)
  const worklist = []

  function visitFunction(node) {
    const fnName = labelOf(node, sf)
    const root = node
    const declarations = []

    ;(function collect(node) {
      if (!node || typeof node !== 'object') return
      if (node !== root && FN_KINDS.has(node.kind)) return
      if (ts.isIdentifier(node) && node.parent) {
        const parent = node.parent
        const isDecl =
          (parent.name === node && (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent))) ||
          (ts.isCatchClause(parent) && parent.variableDeclaration === node)
        if (isDecl && SHORT.test(node.text)) declarations.push({ node, name: node.text, initializer: ts.isVariableDeclaration(parent) && parent.initializer ? parent.initializer.getText(sf) : '' })
      }
      ts.forEachChild(node, collect)
    })(root)

    const declared = declarations

    for (const item of declared) {
      const features = new Map()
      const props = new Set()
      if (!item.initializer && item.node.parent && ts.isParameter(item.node.parent)) {
        const params = item.node.parent.parent.parameters
        features.set('paramIndex', params.indexOf(item.node.parent))
      }
      if (item.initializer && /createEl\(|createElement\(|getElementById\(|querySelector\(/.test(item.initializer)) features.set('domCreate', true)
      if (/addEventListener|\.on[a-z]+\s*=/.test(node.getText(sf).slice(0, 400)) && item.node.parent && ts.isParameter(item.node.parent)) features.set('eventListener', true)

      ;(function scan(scopeNode) {
        if (!scopeNode || typeof scopeNode !== 'object') return
        if (ts.isIdentifier(scopeNode) && scopeNode.text === item.name) {
          const parent = scopeNode.parent
          if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === scopeNode) props.add(parent.name.text)
          if (parent && ts.isCallExpression(parent) && parent.expression === scopeNode) features.set('called', true)
          if (parent && ts.isBinaryExpression(parent) && parent.left === scopeNode && parent.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) features.set('accumulator', true)
          if (parent && ts.isElementAccessExpression(parent) && parent.argumentExpression === scopeNode) features.set('indexUse', true)
          if (parent && ts.isCallExpression(parent) && parent.arguments[0] === scopeNode && ts.isPropertyAccessExpression(parent.expression) && /^(get|set|has|delete)$/.test(parent.expression.name.text)) features.set('mapKey', true)
        }
        if (ts.isForStatement(scopeNode) && scopeNode.initializer && ts.isVariableDeclarationList(scopeNode.initializer)) {
          for (const declaration of scopeNode.initializer.declarations) if (declaration.name.pos === item.node.pos) features.set('loopIndex', true)
        }
        if (ts.isForOfStatement(scopeNode) && scopeNode.initializer && ts.isVariableDeclarationList(scopeNode.initializer)) {
          for (const declaration of scopeNode.initializer.declarations) {
            if (declaration.name.pos !== item.node.pos) continue
            const source = scopeNode.expression.getText(sf)
            const rawBase = source.split('.').pop().replace(/[^A-Za-z0-9_]/g, '')
            const base = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rawBase) && rawBase.length > 1 ? singular(rawBase) : 'item'
            features.set('loopOf', base || 'item')
          }
        }
        ts.forEachChild(scopeNode, scan)
      })(node.body)

      const to = classify(item.initializer, [...props], features, fnName)
      if (!to || to === item.name) continue
      worklist.push({
        file: relative,
        fn: fnName,
        line: sf.getLineAndCharacterOfPosition(item.node.getStart(sf)).line + 1,
        from: item.name,
        to,
        rule: features.has('eventListener')
          ? 'event'
          : /Math\.hypot\(/.test(item.initializer || '')
            ? 'distance'
            : /createEl\(|createElement\(|getElementById\(|querySelector\(/.test(item.initializer || '') || [...props].some((p) => ['style', 'appendChild', 'classList'].includes(p))
              ? 'element'
              : features.get('loopOf')
                ? 'loopOf'
                : features.has('loopIndex')
                  ? 'loopIndex'
                  : features.has('accumulator')
                    ? 'accumulator'
                    : features.has('mapKey')
                      ? 'mapKey'
                      : props.size
                        ? `props:${[...props].slice(0, 4).join(',')}`
                        : 'fallback',
      })
    }
  }

  ;(function visit(node) {
    if (FN_KINDS.has(node.kind)) visitFunction(node)
    ts.forEachChild(node, visit)
  })(sf)

  // 同一函数内重名时直接放弃该条，不产生 element2 / index11 这类伪语义名。
  const used = new Map()
  const unique = []
  for (const entry of worklist) {
    const key = `${entry.file}:${entry.fn}`
    const set = used.get(key) || new Set()
    if (set.has(entry.to)) continue
    set.add(entry.to)
    used.set(key, set)
    unique.push(entry)
  }
  // 只保留结构性高置信规则；函数名兜底与无法判定的 props 组合不进入批量改名。
  const allowed = new Set(['event', 'distance', 'element', 'loopIndex', 'accumulator', 'mapKey', 'loopOf'])
  return unique.filter((entry) => allowed.has(entry.rule) && (entry.rule !== 'loopOf' || /^(item|unit|hero|minion|monster|tower|buff|point|note|event|particle|decal|target|candidate|skill|sound|report|area)$/.test(entry.to)))
}

const files = fileArg ? [path.resolve(ROOT, fileArg)] : walk(path.join(ROOT, 'src'))
const worklist = files.flatMap(planFile)
const rules = new Map()
for (const entry of worklist) rules.set(entry.rule, (rules.get(entry.rule) || 0) + 1)
fs.writeFileSync(outFile, JSON.stringify(worklist, null, 2))
console.log(JSON.stringify({ entries: worklist.length, files: files.length, outFile, rules: Object.fromEntries([...rules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) }, null, 2))
