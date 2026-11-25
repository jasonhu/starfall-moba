#!/usr/bin/env node
/**
 * 全库「序数/泛化后缀」伪语义声明盘点器。
 *
 * 识别第四轮 dedupe-worklist.cjs 按全文件去重时引入的机械名：
 *   primaryInputSecondary / secondaryInputTertiary / xxxExtra867 /
 *   numericValue / computedResult / sumValue / productValue / xxxInstance ...
 *
 * 对每个声明收集业务信号：init 表达式、所有使用行源码、成员访问、调用点参数位、
 * 解构键、关节名字符串（rig.add("name")）。供逐函数按业务含义取名。
 *
 * 用法: node tools/inventory-pseudo-all.cjs [--out /tmp/pseudo-all.json] [--file=src/...]
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : '/tmp/pseudo-all.json'
const ROOT = path.resolve('.')
const fileArg = args.find((a) => a.startsWith('--file='))

// 真·遗留伪语义（已排除 sum/item/rig/hero 等合法领域词）
const ORD = /(Secondary|Tertiary|Quaternary|Quinary|Senary|Seventh|Eighth|Ninth|Tenth|Fourth|Fifth|Sixth)$/
const GEN = /^(primaryInput|secondaryInput|tertiaryInput|quaternaryInput|quinaryInput|extraInput|numericValue|numericResult|computedValue|computedResult|productValue|productResult|sumValue|sumResult|differenceValue|differenceResult|ratioValue|ratioResult|selectedValue|sourceSpec|targetState|values$|clipValue|clampUnitResult|lerpValue)/
// callback 单独判断：只认裸 callback 或 callback+序数/维度后缀（callbackFn/callbackHandler 是合法业务名）
const CALLBACK_BAD = /^callback$|^callback(X|Y|Z|Width|Height|Depth|Secondary|Tertiary|Quaternary|Extra\d)/
const INST = /Instance$/
const EXTRA = /Extra\d+$/
// Result 后缀盲区补丁：机械的「函数名/缩写 + Result」也是压缩恢复伪语义
// （addResult=关节id、gdResult=贴花槽、minResult=淡入强度、sinResult=正弦值…）。
// 只认「已知机械词根」+ Result 及重复词根，不把合法业务结果名（castResult/queryResult）一刀切。
const MECHANICAL_ROOT = /^(numeric|computed|product|sum|difference|ratio|selected|input|local|min|max|round|floor|ceil|abs|sin|cos|tan|atan2|hypot|sqrt|pow|clamp|clip|lerp|map|add|find|slice|indexOf|next|range|remainder|step|hold|now|elapsed|total|scaled|shifted|lerped|remainder|smoothed|rounded|clamped|windupEase|hitImpactPulse|smoothStep|hermiteSmoothStep|inverseLerpClamped|colorToRgb|lerp3|gd)$/
// 重复词根：addAdd / gdGd / roundRound / minMin / sinSin / hypotHypot 等（大小写不敏感比对两段）
const DUP_ROOT = (root) => {
  const m = root.match(/^([A-Za-z]{2,})\1$/i)
  return !!m
}
// 机械后缀补丁：Result 已清完；同类机械中间量还以 Value / Op 结尾
// （sumOp/differenceOp/computedOp/localValue/inputValue/scaledValue…）。
// 三种后缀统一交给 MECHANICAL_ROOT 白名单判定，绝不把有业务词根的名
// （skillValue/manaValue/colorValue/angleValue…）一刀切。
const MECH_SUFFIX_BAD = (name) => {
  const m = name.match(/^(.*?)(Result|Value|Op)$/)
  if (!m) return false
  const root = m[1]
  if (!root) return false
  return MECHANICAL_ROOT.test(root) || DUP_ROOT(root)
}
function suspect(name) { return ORD.test(name) || GEN.test(name) || CALLBACK_BAD.test(name) || INST.test(name) || EXTRA.test(name) || MECH_SUFFIX_BAD(name) }

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
])
function fnLabel(node, sf) {
  if (node.name) return node.name.getText(sf)
  const p = node.parent
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.getText(sf)
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf)
  return '<anonymous@' + (sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1) + '>'
}
function lineOf(node, sf) { return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 }

let files = []
if (fileArg) {
  files = [path.join(ROOT, fileArg.slice('--file='.length))].filter((f) => fs.existsSync(f))
} else {
  ;(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'dist-release', '.git'].includes(entry.name)) walk(full)
      } else if (entry.name.endsWith('.ts')) files.push(full)
    }
  })(path.join(ROOT, 'src'))
}

const report = []
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const stack = []
  const decls = []

  function visit(node) {
    const isFn = FN_KINDS.has(node.kind)
    let pushed = false
    if (isFn) { stack.push({ node, label: fnLabel(node, sf) }); pushed = true }
    const env = stack[stack.length - 1]
    if (env && ts.isIdentifier(node)) {
      const p = node.parent
      const isDecl = p && p.name === node && (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p))
      if (isDecl && suspect(node.text)) {
        const init = (ts.isVariableDeclaration(p) && p.initializer) ? p.initializer.getText(sf) : ''
        let jointName = ''
        const m = init.match(/\.add(?:Chain)?\(\s*["']([^"']+)["']/)
        if (m) jointName = m[1]
        let bindingKey = ''
        if (ts.isBindingElement(p) && p.propertyName && ts.isIdentifier(p.propertyName)) bindingKey = p.propertyName.text
        decls.push({
          file: path.relative(ROOT, file), fn: env.label, fnLine: lineOf(env.node, sf),
          fnStart: env.node.getStart(sf), fnEnd: env.node.end,
          line: lineOf(node, sf), name: node.text, init, jointName, bindingKey,
          fnNode: env.node,
        })
      }
    }
    ts.forEachChild(node, visit)
    if (pushed) stack.pop()
  }
  visit(sf)

  for (const d of decls) {
    const useLines = new Set()
    const props = new Set()
    const passedTo = new Set()
    function scan(n) {
      if (!n || typeof n !== 'object') return
      if (ts.isIdentifier(n) && n.text === d.name) {
        useLines.add(lineOf(n, sf))
        const p = n.parent
        if (p && ts.isPropertyAccessExpression(p) && p.expression === n) props.add(p.name.text)
        if (p && (ts.isCallExpression(p) || ts.isNewExpression(p))) {
          const idx = p.arguments ? p.arguments.indexOf(n) : -1
          if (idx >= 0) passedTo.add(p.expression.getText(sf).slice(0, 36) + '@' + idx)
        }
      }
      ts.forEachChild(n, scan)
    }
    scan(d.fnNode)
    const usages = [...useLines].sort((a, b) => a - b).map((ln) => ({ line: ln, text: (lines[ln - 1] || '').trim().slice(0, 220) }))
    report.push({
      file: d.file, fn: d.fn, fnLine: d.fnLine, fnStart: d.fnStart, fnEnd: d.fnEnd,
      line: d.line, name: d.name, jointName: d.jointName, bindingKey: d.bindingKey,
      init: d.init.slice(0, 300), props: [...props].slice(0, 16),
      passedTo: [...passedTo].slice(0, 10), usages,
    })
  }
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
const byFile = {}
for (const r of report) byFile[r.file] = (byFile[r.file] || 0) + 1
const byName = {}
for (const r of report) byName[r.name] = (byName[r.name] || 0) + 1
console.log('total pseudo declarations:', report.length)
console.log('files:', Object.keys(byFile).length)
console.log('unique names:', Object.keys(byName).length)
console.log('with jointName signal:', report.filter((r) => r.jointName).length)
console.log('top files:', JSON.stringify(Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)))
console.log('out:', OUT)
