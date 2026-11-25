#!/usr/bin/env node
/**
 * 盘点 model-*.ts 里"伪语义名"的真实使用信号。
 *
 * 伪语义名 = 上一轮 dedupe 用序数后缀 / Extra+行号 拼出来的名字：
 *   xxxSecondary / xxxTertiary / xxxQuaternary / ... / xxxExtra867 / primaryInput / secondaryInput ...
 *
 * 每个声明收集：
 *  - 成员访问集合（.J .d .c .c2 .headY .bone() ...）
 *  - 是否被调用 / 被索引 / 作为实参传入的函数名和参数位置
 *  - 初始化表达式文本
 *  - 所在函数、行号
 *
 * 输出 JSON 到 --out（默认 /tmp/model-names.json），供语义推断与人工抽查。
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : '/tmp/model-names.json'
const ROOT = path.resolve('.')
const FILES = [
  'src/kernel/model-heroes.ts',
  'src/kernel/model-monsters.ts',
  'src/kernel/model-world.ts',
  'src/kernel/render/model-parts.ts',
  'src/kernel/render/model-builder.ts',
].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))

// 伪语义模式：序数后缀词 + Extra+数字 + 泛化输入名 + 泛化运算名
const ORDINAL = /(Secondary|Tertiary|Quaternary|Quinary|Senary|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|Fifth|Sixth|Fourth)$/
const PSEUDO = new RegExp(
  '(Extra\\d+$|' + ORDINAL.source + '|' +
  '^(primaryInput|secondaryInput|tertiaryInput|quaternaryInput|quinaryInput|extraInput|' +
  'sourceSpec|targetState|callback|builder|numericValue|numericResult|computedValue|computedResult|computedOp|' +
  'productValue|productResult|productOp|sumValue|sumResult|sumOp|differenceValue|differenceResult|differenceOp|' +
  'ratioValue|ratioResult|ratioOp|selectedT|selectedValue|values|clipValue|clampUnitResult|lerpValue))'
)

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.Constructor,
])

function fnLabel(node, sf) {
  if (node.name) return node.name.getText(sf)
  const p = node.parent
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.getText(sf)
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf)
  return '<anonymous>'
}

const report = []
for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const rel = path.relative(ROOT, file)
  const fnStack = []
  const declarations = [] // {name,line,fn,initText,node,fnNode}
  const fnLocalNames = new Map() // fnLabel -> 该函数所有原始声明名（含未改名的）

  function isDeclOf(n) {
    const p = n.parent
    return p && p.name === n && (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p))
  }
  function collectDeclNode(node, enclosing) {
    if (ts.isIdentifier(node) && isDeclOf(node) && enclosing) {
      // 记录该函数所有原始声明名（用于命名时防撞/防遮蔽）
      let names = fnLocalNames.get(enclosing.label)
      if (!names) { names = new Set(); fnLocalNames.set(enclosing.label, names) }
      names.add(node.text)
      if (PSEUDO.test(node.text)) {
        const p = node.parent
        const initText = ts.isVariableDeclaration(p) && p.initializer ? p.initializer.getText(sf).slice(0, 400) : ''
        // 解构别名：{ rig: tSecondary } -> bindingKey = 'rig'
        let bindingKey = ''
        if (ts.isBindingElement(p) && p.propertyName && ts.isIdentifier(p.propertyName)) bindingKey = p.propertyName.text
        declarations.push({ name: node.text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, fn: enclosing.label, node, fnNode: enclosing.node, initText, bindingKey })
      }
    }
  }

  function visit(node) {
    const isFn = FN_KINDS.has(node.kind)
    let pushed = false
    if (isFn) { fnStack.push({ node, label: fnLabel(node, sf) }); pushed = true }
    const enclosing = fnStack[fnStack.length - 1]
    if (enclosing) collectDeclNode(node, enclosing)
    ts.forEachChild(node, visit)
    if (pushed) fnStack.pop()
  }
  visit(sf)

  // 对每个声明，分析它在本函数内的所有标识符引用
  for (const d of declarations) {
    const props = new Set()
    const called = new Set()
    const indexUses = []
    const passedTo = []   // foo(d.name) -> foo@paramIndex
    const assignedFrom = new Set()
    let refCount = 0

    function scan(n) {
      if (!n || typeof n !== 'object') return
      // 引用同名标识符
      if (ts.isIdentifier(n) && n.text === d.name && n !== d.node) {
        refCount++
        const p = n.parent
        if (p && ts.isPropertyAccessExpression(p) && p.expression === n) props.add(p.name.text)
        if (p && ts.isCallExpression(p) && p.expression === n) called.add('self')
        if (p && ts.isElementAccessExpression(p) && p.expression === n) indexUses.push(p.argumentExpression ? p.argumentExpression.getText(sf).slice(0, 24) : '?')
        // foo(arg1, arg2, n, ...) -> 记录位置
        if (p && (ts.isCallExpression(p) || ts.isNewExpression(p))) {
          const call = p
          const idx = call.arguments ? call.arguments.indexOf(n) : -1
          if (idx >= 0) {
            const callee = call.expression.getText(sf).slice(0, 40)
            passedTo.push(`${callee}@${idx}`)
          }
        }
        // 二元比较：=== "hero" / < 0 等字面量
        if (p && ts.isBinaryExpression(p) && (p.left === n || p.right === n)) {
          const other = p.left === n ? p.right : p.left
          if (other.kind >= ts.SyntaxKind.FirstLiteralToken && other.kind <= ts.SyntaxKind.LastLiteralToken) {
            assignedFrom.add(`cmp:${other.getText(sf)}`)
          }
        }
      }
      ts.forEachChild(n, scan)
    }
    scan(d.fnNode)

    // 初始化表达式的类型信号
    const init = d.initText
    let shape = ''
    if (/\[[^\]]*\]/.test(init)) shape = 'array'
    else if (/new [A-Z]\w+/.test(init)) shape = 'new:' + (init.match(/new ([A-Z]\w+)/) || [])[1]
    else if (/\.map\(/.test(init)) shape = 'mapResult'
    else if (/^[\w.]+\(/.test(init)) shape = 'call'

    report.push({
      file: rel, line: d.line, fn: d.fn, name: d.name,
      localNames: [...(fnLocalNames.get(d.fn) || [])],
      init: init, shape, bindingKey: d.bindingKey,
      props: [...props].slice(0, 24),
      called: called.size > 0,
      indexUses: indexUses.slice(0, 6),
      passedTo: [...new Set(passedTo)].slice(0, 8),
      cmp: [...assignedFrom].slice(0, 4),
      refs: refCount,
    })
  }
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
const byName = {}
for (const r of report) byName[r.name] = (byName[r.name] || 0) + 1
console.log(`total pseudo declarations: ${report.length}`)
console.log(`files: ${FILES.length}`)
console.log('top names:', JSON.stringify(Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 30)))
console.log('out:', OUT)
