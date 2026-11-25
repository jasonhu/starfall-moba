#!/usr/bin/env node
/**
 * 跨文件作用域感知重命名器
 * ---------------------------------------------------------------
 * 对 src/kernel/*.js 应用 {old:new} 标识符映射，只改真正作为
 * 「绑定/引用」出现的 Identifier，排除属性名、非简写对象 key、
 * 标签与字符串字面量。改写前备份到 .rename-backup/<相对路径>。
 *
 * 安全闸门：若某 oldName 在文件内被「内层局部声明」遮蔽（函数参数、
 * let/const/class/function 声明且不在顶层），默认拒绝该映射并报警，
 * 避免误伤同名局部变量。可用 --force-shadow 强制（需人工确认）。
 *
 * 用法:
 *   node tools/rename-across.cjs <mapping.json> [--dry] [--write] [--force-shadow]
 * 默认 dry-run（只报告不写入）。--write 才落盘并备份。
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

const args = process.argv.slice(2)
const mapArg = args.find((a) => !a.startsWith('--'))
const DRY = !args.includes('--write')
const FORCE = args.includes('--force-shadow')
if (!mapArg) {
  console.error('用法: rename-across.cjs <mapping.json> [--dry] [--write] [--force-shadow]')
  process.exit(2)
}
const mapping = JSON.parse(fs.readFileSync(mapArg, 'utf8'))

const KERNEL_DIR = path.resolve('src/kernel')
// 递归扫描（2026-11-19）：分层后模块分布在 audio/ skills/ ui/ 等子目录，
// 只扫顶层的旧行为会漏改调用方。备份路径保留相对目录结构。
const files = []
;(function walkDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walkDir(p)
    else if (name.endsWith('.js')) files.push(p)
  }
})(KERNEL_DIR)

function findKey(parent, child) {
  if (!parent) return null
  for (const k of Object.keys(parent)) {
    if (parent[k] === child) return k
    if (Array.isArray(parent[k]) && parent[k].indexOf(child) >= 0) return k
  }
  return null
}
// ⚠️ 已废弃：本工具会把简写属性 `{ Xt }` 的 key 一起改掉，从而破坏与解构方的契约
// （真实事故：vfx kit 的 Xt/qe 被改成 GROUND_FX_KINDS/FX_SHAPES，templates.ts 解构旧名拿到 undefined，
//  运行时 Cannot read properties of undefined (reading 'telegraph')）。
// 请改用 tools/rename-scoped.cjs —— 它会把简写属性正确展开为 `{ Xt: 新名 }`。
function isExcluded(parent, key) {
  if (!parent) return false
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return true
  // 属性名一律不改（含简写属性的 key）；简写属性由调用方展开处理
  if (parent.type === 'Property' && key === 'key' && !parent.computed) return true
  if (parent.type === 'LabeledStatement' && key === 'label') return true
  if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return true
  return false
}

// 安全检查：映射里的名字若出现在简写属性位置（`{ Xt }`），本工具无法安全处理（需要展开成 `{ Xt: 新名 }`）
const shorthandHits = []
for (const file of files) {
  const src0 = fs.readFileSync(file, 'utf8')
  let ast0
  try {
    ast0 = acorn.parse(src0, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  } catch {
    continue
  }
  ;(function walk(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return
    if (n.type === 'Property' && n.shorthand && n.key && n.key.type === 'Identifier' && Object.prototype.hasOwnProperty.call(mapping, n.key.name)) {
      shorthandHits.push(`${file}:${n.loc.start.line} { ${n.key.name} }`)
    }
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      walk(n[k])
    }
  })(ast0)
}
if (shorthandHits.length) {
  console.error('⛔ 拒绝执行：以下简写属性会被连带改掉对象键，从而破坏与解构方的契约')
  shorthandHits.slice(0, 20).forEach((h) => console.error('   ' + h))
  console.error('   请改用 tools/rename-scoped.cjs（它会把 `{ Xt }` 正确展开为 `{ Xt: 新名 }`）')
  process.exit(4)
}

let totalChanges = 0
const blocked = []

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  // 1) 遮蔽检测：收集所有「声明绑定」及其是否顶层
  const decls = [] // {name, top}
  const isTop = (anc) => !!anc && anc.length === 3 && anc[0].type === 'Program' && anc[1].type === 'VariableDeclaration'
  walk.fullAncestor(ast, (n, st, anc) => {
    let top = false
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') { top = isTop(anc); decls.push({ name: n.id.name, top, node: n.id }) }
    else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) { top = !!anc && anc.length === 2 && anc[0].type === 'Program'; decls.push({ name: n.id.name, top, node: n.id }) }
    else if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      for (const p of n.params) if (p.type === 'Identifier') decls.push({ name: p.name, top: false, node: p })
    }
  })
  const shadowed = new Set()
  for (const old of Object.keys(mapping)) if (decls.some((d) => d.name === old && !d.top)) shadowed.add(old)
  if (shadowed.size && !FORCE) {
    blocked.push(`${path.basename(file)}: 内层遮蔽 ${[...shadowed].join(',')}`)
    continue
  }

  // 2) 收集要替换的 Identifier 偏移
  const edits = []
  walk.fullAncestor(ast, (node, _st, ancestors) => {
    if (node.type !== 'Identifier') return
    if (!Object.prototype.hasOwnProperty.call(mapping, node.name)) return
    const parent = ancestors[ancestors.length - 2]
    const key = findKey(parent, node)
    if (isExcluded(parent, key)) return
    edits.push({ start: node.start, end: node.end, old: node.name, neu: mapping[node.name] })
  })
  // 2b) import/export 说明符里的绑定名：acorn-walk 的 fullAncestor 不会遍历
  //     ImportSpecifier/ExportSpecifier 的 local/exported 子节点，需单独处理。
  //     这些位置的标识符一律是绑定名（可能在 mapping 里），用字符范围补采。
  for (const n of ast.body) {
    if (n.type === 'ExportNamedDeclaration' && n.specifiers) {
      for (const sp of n.specifiers) {
        for (const slot of ['local', 'exported']) {
          const id = sp[slot]
          if (id && id.type === 'Identifier' && Object.prototype.hasOwnProperty.call(mapping, id.name)) {
            edits.push({ start: id.start, end: id.end, old: id.name, neu: mapping[id.name] })
          }
        }
      }
    }
    if ((n.type === 'ImportDeclaration') && n.specifiers) {
      for (const sp of n.specifiers) {
        for (const slot of ['local', 'imported']) {
          const id = sp[slot]
          if (id && id.type === 'Identifier' && Object.prototype.hasOwnProperty.call(mapping, id.name)) {
            // imported 是源模块导出名：只有目标模块也改名时才应改，这里保留原样避免破坏对外契约
            if (slot === 'imported') continue
            edits.push({ start: id.start, end: id.end, old: id.name, neu: mapping[id.name] })
          }
        }
      }
    }
  }

  if (!edits.length) continue

  // 3) 从后往前替换（避免偏移漂移）
  let out = src
  const dedup = [...new Map(edits.map((e) => [e.start + ':' + e.end, e])).values()]
  for (const e of dedup.slice().sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.neu + out.slice(e.end)
  }
  edits.length = 0
  edits.push(...dedup)
  totalChanges += edits.length
  const perFile = {}
  for (const e of edits) perFile[e.old] = (perFile[e.old] || 0) + 1
  console.log(`${DRY ? '[dry]' : '[write]'} ${path.relative(KERNEL_DIR, file)}: ${edits.length} 处  ${JSON.stringify(perFile)}`)

  if (!DRY) {
    const bakDir = path.resolve('.rename-backup')
    const rel = path.relative(KERNEL_DIR, file)
    const bakPath = path.join(bakDir, rel)
    fs.mkdirSync(path.dirname(bakPath), { recursive: true })
    fs.writeFileSync(bakPath, src)
    fs.writeFileSync(file, out)
  }
}

if (blocked.length) {
  console.error('\n⛔ 因遮蔽检测未处理（加 --force-shadow 可强制）:')
  blocked.forEach((b) => console.error('  ' + b))
}
console.log(`\n合计 ${totalChanges} 处改名，模式=${DRY ? 'dry-run（未写入）' : 'WRITE（已写入并备份到 .rename-backup/）'}`)
process.exit(blocked.length ? 1 : 0)
