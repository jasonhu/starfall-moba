#!/usr/bin/env node
/**
 * 盘点函数内部仍未语义化的短名，以及函数级注释覆盖。
 *
 * 与 inventory-shortnames.cjs 的区别：
 *  - 后者只看顶层声明；本工具遍历 TypeScript AST，逐个函数收集参数/局部变量/catch 绑定。
 *  - 直接解析 .ts（含 @ts-nocheck 的存量压缩模块），不依赖 transpile 后的行号。
 *  - 输出 /tmp/localname-inventory.json，供改名工作单使用。
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOT = path.resolve('src')
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

function functionLabel(node, sf) {
  if (node.name) return node.name.getText(sf)
  const parent = node.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.getText(sf)
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sf)
  return `<anonymous@${sf.getLineAndCharacterOfPosition(node.pos).line + 1}>`
}

function collectPatternNames(pattern, out) {
  if (!pattern) return
  if (ts.isIdentifier(pattern)) out.push(pattern)
  else if (ts.isBindingElement(pattern)) collectPatternNames(pattern.name, out)
  else if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
    for (const element of pattern.elements) collectPatternNames(element, out)
  } else if (ts.isParameter(pattern)) collectPatternNames(pattern.name, out)
}

function analyzeFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const functions = []
  const locals = []
  let currentFunction = null

  function visit(node) {
    // JSDoc 里的 @param name 不是真实声明，跳过整个 JSDoc 子树，
    // 否则注解名（t/e/n）会被误计为短名局部变量。
    if (node.kind === ts.SyntaxKind.JSDocComment || (String(ts.SyntaxKind[node.kind] || '').startsWith('JSDoc'))) return
    const isFn = FN_KINDS.has(node.kind)
    let previous = currentFunction
    if (isFn) {
      currentFunction = {
        label: functionLabel(node, sf),
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        shortParams: [],
        shortLocals: [],
        hasDoc: false,
      }
      const ranges = node.getChildren(sf).filter((child) => child.kind === ts.SyntaxKind.JSDocComment)
      currentFunction.hasDoc = ranges.length > 0 || /(^|\n)\s*\/\*\*/.test(src.slice(Math.max(0, node.pos - 260), node.getStart(sf)))
      functions.push(currentFunction)
      if (node.parameters) {
        for (const parameter of node.parameters) {
          const names = []
          collectPatternNames(parameter, names)
          for (const id of names) {
            if (!SHORT.test(id.text)) continue
            const item = { name: id.text, line: sf.getLineAndCharacterOfPosition(id.getStart(sf)).line + 1, kind: 'param' }
            currentFunction.shortParams.push(item)
            locals.push({ ...item, file: path.relative(process.cwd(), file), fn: currentFunction.label })
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node) && currentFunction && ts.isIdentifier(node.name) && SHORT.test(node.name.text)) {
      const item = { name: node.name.text, line: sf.getLineAndCharacterOfPosition(node.name.getStart(sf)).line + 1, kind: 'let' }
      currentFunction.shortLocals.push(item)
      locals.push({ ...item, file: path.relative(process.cwd(), file), fn: currentFunction.label })
    }
    if (ts.isCatchClause(node) && node.variableDeclaration && ts.isIdentifier(node.variableDeclaration.name) && SHORT.test(node.variableDeclaration.name.text) && currentFunction) {
      const id = node.variableDeclaration.name
      const item = { name: id.text, line: sf.getLineAndCharacterOfPosition(id.getStart(sf)).line + 1, kind: 'catch' }
      currentFunction.shortLocals.push(item)
      locals.push({ ...item, file: path.relative(process.cwd(), file), fn: currentFunction.label })
    }

    ts.forEachChild(node, visit)
    if (isFn) currentFunction = previous
  }
  visit(sf)

  const commentLines = src.split('\n').filter((line) => /^\s*(\/\/|\/\*|\*)/.test(line)).length
  return {
    file: path.relative(process.cwd(), file),
    lines: src.split('\n').length,
    nocheck: src.startsWith('// @ts-nocheck'),
    functions: functions.length,
    documented: functions.filter((f) => f.hasDoc).length,
    shortCount: locals.filter((l) => l.file === path.relative(process.cwd(), file)).length,
    functionsWithShort: functions.filter((f) => f.shortParams.length || f.shortLocals.length).length,
    commentLines,
    locals: locals.filter((l) => l.file === path.relative(process.cwd(), file)),
  }
}

const files = walk(ROOT)
const report = files.map(analyzeFile)
const total = report.reduce((sum, item) => sum + item.shortCount, 0)
const nameCounts = new Map()
for (const item of report) for (const local of item.locals) nameCounts.set(local.name, (nameCounts.get(local.name) || 0) + 1)
const summary = {
  files: files.length,
  functions: report.reduce((sum, item) => sum + item.functions, 0),
  documentedFunctions: report.reduce((sum, item) => sum + item.documented, 0),
  shortLocals: total,
  nocheckFiles: report.filter((item) => item.nocheck).length,
  topNames: [...nameCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
}
fs.writeFileSync('/tmp/localname-inventory.json', JSON.stringify({ summary, report }, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('\nTOP 25 文件（按内部短名数量）:')
for (const item of [...report].sort((a, b) => b.shortCount - a.shortCount).slice(0, 25)) {
  console.log(String(item.shortCount).padStart(4), String(item.functionsWithShort).padStart(4), item.nocheck ? 'NC' : '  ', item.file)
}
