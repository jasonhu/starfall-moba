#!/usr/bin/env node
/**
 * model*.ts 伪语义变量「语义信号」盘点器。
 *
 * 与 inventory-model-names.cjs 的区别：
 *  - 覆盖 valueX/Y/Z/Width...、valueV1..V37、addResult/addAddResult、xxxInstance 等新批次；
 *  - 对每个声明收集「所有使用行的源码片段」，供人工判定业务含义；
 *  - 对 rig.add("name",...) / rig.addChain("name",...) 直接抽取关节名字符串。
 *
 * 用法: node tools/inventory-model-semantic.cjs --out /tmp/model-semantic.json
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : '/tmp/model-semantic.json'
const ROOT = path.resolve('.')
const fileArg = args.find((a) => a.startsWith('--file='))
const FILES = fileArg
  ? [fileArg.slice('--file='.length)]
  : [
      'src/kernel/model-heroes.ts',
      'src/kernel/model-monsters.ts',
      'src/kernel/model-world.ts',
      'src/kernel/render/model-parts.ts',
      'src/kernel/render/model-builder.ts',
    ].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f))

// 宽口径伪语义：先全列出，人工判定哪些是真伪语义
const SUSPECT = [
  /^value([A-Z]|$)/,
  /^(add|create|make|build|set|get)(Add|Create|Make|Build|Set|Get)*Result$/,
  /Instance$/,
  /(Secondary|Tertiary|Quaternary|Quinary|Senary|Seventh|Eighth|Ninth|Tenth|Fourth|Fifth|Sixth)$/,
  /^(primaryInput|secondaryInput|tertiaryInput|quaternaryInput|quinaryInput|extraInput)/,
  /Extra\d+$/,
  /^(sourceSpec|targetState|callback|numericValue|numericResult|computedValue|computedResult|productValue|productResult|sumValue|sumResult|differenceValue|differenceResult|ratioValue|ratioResult|selectedValue|selectedT|values|clipValue|clampUnitResult|lerpValue)/,
]
function suspect(name) { return SUSPECT.some((re) => re.test(name)) }

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

const report = []
for (const file of FILES) {
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
        // 抽取 rig.add("jointName", ...) / rig.addChain("chainName", ...)
        let jointName = ''
        const m = init.match(/\.add(?:Chain)?\(\s*["']([^"']+)["']/)
        if (m) jointName = m[1]
        let bindingKey = ''
        if (ts.isBindingElement(p) && p.propertyName && ts.isIdentifier(p.propertyName)) bindingKey = p.propertyName.text
        decls.push({
          file: path.relative(ROOT, file), fn: env.label, fnLine: lineOf(env.node, sf),
          line: lineOf(node, sf), name: node.text, init, jointName, bindingKey,
          fnNode: env.node,
        })
      }
    }
    ts.forEachChild(node, visit)
    if (pushed) stack.pop()
  }
  visit(sf)

  // 收集每个声明在函数内的所有引用行
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
        if (p && ts.isPropertyAccessExpression(p) && p.name === n) props.add('<' + p.expression.getText(sf).slice(0, 20) + '>.' + n.text)
      }
      ts.forEachChild(n, scan)
    }
    scan(d.fnNode)
    const usages = [...useLines].sort((a, b) => a - b).map((ln) => ({ line: ln, text: (lines[ln - 1] || '').trim().slice(0, 200) }))
    report.push({
      file: d.file, fn: d.fn, fnLine: d.fnLine, line: d.line, name: d.name,
      jointName: d.jointName, bindingKey: d.bindingKey, init: d.init.slice(0, 300),
      props: [...props].slice(0, 16), passedTo: [...passedTo].slice(0, 10), usages,
    })
  }
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
const byName = {}
for (const r of report) byName[r.name] = (byName[r.name] || 0) + 1
console.log('total declarations:', report.length)
console.log('unique names:', Object.keys(byName).length)
console.log('with jointName signal:', report.filter((r) => r.jointName).length)
console.log('top:', JSON.stringify(Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 50)))
console.log('out:', OUT)
