#!/usr/bin/env node
/**
 * 函数内部变量的安全改名器。
 *
 * 输入工作单 JSON（数组），每项：
 *   { "file": "src/kernel/.../x.ts", "fn": "functionName", "line": 12, "from": "n", "to": "targetUnit" }
 *
 * 安全保证：
 *  - 用 TypeScript LanguageService 的 findRenameLocations 做作用域解析（局部遮蔽不会误改）。
 *  - 只接受「解析到指定声明处」的改名；属性名、对象键、标签由语言服务自动排除。
 *  - 简写属性 `{ n }` 由语言服务的 prefixText 展开为 `{ n: targetUnit }`，跨模块对象键契约不变。
 *  - 所有引用必须落在声明所在的函数 AST 区间内，否则整条工作单失败（防止跨函数串改）。
 *
 * 用法: node tools/rename-locals.cjs <worklist.json> [--dry|--write]
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const worklistFile = args.find((a) => !a.startsWith('--'))
if (!worklistFile) {
  console.error('用法: rename-locals.cjs <worklist.json> [--dry|--write]')
  process.exit(2)
}
const WRITE = args.includes('--write')
const ALLOW_JSDOC = args.includes('--allow-jsdoc-refs')
const worklist = JSON.parse(fs.readFileSync(worklistFile, 'utf8'))
if (!Array.isArray(worklist)) throw new Error('工作单必须是数组')

const ROOT = path.resolve('.')
const allFiles = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.ts')) allFiles.push(full)
  }
})(path.join(ROOT, 'src'))

const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json')
const configJson = ts.readConfigFile(configPath, ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(configJson.config, ts.sys, ROOT)
const options = { ...parsed.options, noEmit: true }

const versions = new Map()
const snapshots = new Map()
function readFile(file) {
  if (snapshots.has(file)) return snapshots.get(file).getText(0, snapshots.get(file).getLength())
  return fs.readFileSync(file, 'utf8')
}
function getSnapshot(file) {
  if (!snapshots.has(file)) {
    const text = readFile(file)
    versions.set(file, '0')
    snapshots.set(file, ts.ScriptSnapshot.fromString(text))
  }
  return snapshots.get(file)
}
function updateSnapshot(file, text) {
  versions.set(file, String(Number(versions.get(file) || 0) + 1))
  snapshots.set(file, ts.ScriptSnapshot.fromString(text))
}
const host = {
  getScriptFileNames: () => allFiles,
  getScriptVersion: (file) => versions.get(file) || '0',
  getScriptSnapshot: (file) => {
    if (!fs.existsSync(file)) return undefined
    return getSnapshot(file)
  },
  getCurrentDirectory: () => ROOT,
  getCompilationSettings: () => options,
  getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
  fileExists: (file) => fs.existsSync(file),
  readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: (dir) => fs.existsSync(dir),
}
const service = ts.createLanguageService(host, ts.createDocumentRegistry())

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
])

function functionLabel(node, sf) {
  if (node.name) return node.name.getText(sf)
  const parent = node.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.getText(sf)
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sf)
  return '<anonymous>'
}

/** 抓取文件里所有「函数内部声明的短名标识符」候选，供工作单定位。 */
function indexDeclarations(file) {
  const src = readFile(file)
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const index = []
  const functionStack = []
  function visit(node) {
    const isFn = FN_KINDS.has(node.kind)
    let pushed = false
    if (isFn) {
      functionStack.push({ node, label: functionLabel(node, sf) })
      pushed = true
    }
    const enclosing = functionStack[functionStack.length - 1]
    if (enclosing && ts.isIdentifier(node)) {
      const parent = node.parent
      const isDecl =
        (parent && parent.name === node && (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent))) ||
        (parent && ts.isCatchClause(parent) && parent.variableDeclaration === node)
      if (isDecl) {
        index.push({
          pos: node.getStart(sf),
          end: node.end,
          name: node.text,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          fn: enclosing.label,
          fnStart: enclosing.node.getStart(sf),
          fnEnd: enclosing.node.end,
        })
      }
    }
    ts.forEachChild(node, visit)
    if (pushed) functionStack.pop()
  }
  visit(sf)
  return { src, sf, index }
}

const cache = new Map()
function declarationsOf(file) {
  if (!cache.has(file)) cache.set(file, indexDeclarations(file))
  return cache.get(file)
}

const editsByFile = new Map()
const failures = []
let applied = 0

for (const entry of worklist) {
  const file = path.resolve(ROOT, entry.file)
  if (!fs.existsSync(file)) {
    failures.push({ ...entry, reason: 'FILE_NOT_FOUND' })
    continue
  }
  const { index } = declarationsOf(file)
  let candidates = index.filter((d) => d.name === entry.from && d.line === entry.line && (!entry.fn || d.fn === entry.fn))
  if (entry.occurrence) candidates = [candidates[entry.occurrence - 1]].filter(Boolean)
  if (candidates.length !== 1) {
    failures.push({ ...entry, reason: candidates.length ? 'AMBIGUOUS_DECLARATION' : 'DECLARATION_NOT_FOUND', candidates: candidates.length })
    continue
  }
  const declaration = candidates[0]
  const renameInfo = service.getRenameInfo(file, declaration.pos, {
    allowRenameOfImportPath: false,
    findInStrings: false,
    findInComments: false,
  })
  if (!renameInfo.canRename) {
    failures.push({ ...entry, reason: 'RENAME_NOT_ALLOWED', message: renameInfo.localizedErrorMessage })
    continue
  }
  const locations = service.findRenameLocations(file, declaration.pos, false, false, true)
  if (!locations || !locations.length) {
    failures.push({ ...entry, reason: 'NO_LOCATIONS' })
    continue
  }
  const { src: currentSrc } = declarationsOf(file)
  function isInsideComment(pos) {
    // 判断位置是否落在 /** ... */ 或 /* ... */ 注释块内
    let i = 0
    while (i < pos && i < currentSrc.length) {
      if (currentSrc[i] === '/' && currentSrc[i + 1] === '*') {
        const end = currentSrc.indexOf('*/', i + 2)
        if (end < 0) return pos >= i
        if (pos >= i && pos < end + 2) return true
        i = end + 2
      } else if (currentSrc[i] === '/' && currentSrc[i + 1] === '/') {
        const end = currentSrc.indexOf('\n', i + 2)
        i = end < 0 ? currentSrc.length : end + 1
      } else i++
    }
    return false
  }
  const outside = locations.filter((loc) => loc.fileName === file && (loc.textSpan.start < declaration.fnStart || loc.textSpan.start >= declaration.fnEnd))
  const realOutside = ALLOW_JSDOC ? outside.filter((loc) => !isInsideComment(loc.textSpan.start)) : outside
  if (realOutside.length) {
    failures.push({ ...entry, reason: 'REF_OUTSIDE_FUNCTION', count: realOutside.length })
    continue
  }
  const fileEdits = editsByFile.get(file) || []
  for (const loc of locations) {
    if (loc.fileName !== file) {
      failures.push({ ...entry, reason: 'REF_IN_OTHER_FILE', other: loc.fileName })
      continue
    }
    fileEdits.push({
      start: loc.textSpan.start,
      end: loc.textSpan.start + loc.textSpan.length,
      text: `${loc.prefixText || ''}${entry.to}${loc.suffixText || ''}`,
      source: `${entry.fn}:${entry.from}@${entry.line}`,
    })
  }
  editsByFile.set(file, fileEdits)
  applied++
}

const written = []
for (const [file, rawEdits] of editsByFile) {
  const { src } = declarationsOf(file)
  const edits = [...new Map(rawEdits.map((e) => [`${e.start}:${e.end}:${e.text}`, e])).values()].sort((a, b) => b.start - a.start)
  let out = src
  for (const edit of edits) {
    if (out.slice(edit.start, edit.end) !== src.slice(edit.start, edit.end)) {
      failures.push({ file, reason: 'EDIT_OVERLAP', source: edit.source })
      continue
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  }
  if (WRITE) {
    const backup = path.join(ROOT, '.localname-backup', path.relative(ROOT, file))
    fs.mkdirSync(path.dirname(backup), { recursive: true })
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, src)
    fs.writeFileSync(file, out)
    updateSnapshot(file, out)
  }
  written.push({ file: path.relative(ROOT, file), edits: edits.length })
}

console.log(JSON.stringify({ applied, write: WRITE, files: written.length, failures }, null, 2))
for (const item of written) console.log(`${WRITE ? '[write]' : '[dry]'} ${item.file}: ${item.edits} 处`)
if (failures.length) process.exitCode = 1
