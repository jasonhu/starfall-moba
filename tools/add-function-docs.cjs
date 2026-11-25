#!/usr/bin/env node
/**
 * 为缺少文档的函数补 JSDoc。
 *
 * 只处理「有必要说明」的函数：导出函数、或函数体超过 4 行；
 * 一行式箭头回调（map/filter 的 lambda）不补，避免注释噪音。
 *
 * 描述由函数名动词 + 业务对象词典生成，参数说明取自已语义化的参数名；
 * 返回类型从 return 语句推断，推断不出就不写 @returns，绝不臆测。
 *
 * 用法: node tools/add-function-docs.cjs [--dry|--write] [--file <相对路径>]
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
const ROOT = path.resolve('.')
const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
])

const VERBS = [
  [/^compute|^calc/, '计算'],
  [/^is|^has|^can|^should/, '判断'],
  [/^create|^build|^spawn|^generate|^make/, '创建'],
  [/^register/, '注册'],
  [/^get|^fetch|^read/, '获取'],
  [/^find|^search|^locate|^pick/, '查找'],
  [/^update|^refresh|^apply/, '更新'],
  [/^set|^mark/, '设置'],
  [/^add|^push|^insert/, '添加'],
  [/^remove|^delete|^clear/, '移除'],
  [/^parse|^decode/, '解析'],
  [/^format|^encode/, '格式化'],
  [/^normalize|^clamp/, '归一化'],
  [/^render|^draw|^paint/, '绘制'],
  [/^play|^start/, '播放'],
  [/^stop|^pause/, '停止'],
  [/^handle|^on[A-Z]/, '处理'],
  [/^emit|^send|^dispatch/, '发送'],
  [/^load|^install/, '装载'],
  [/^validate|^check/, '校验'],
]
const NOUNS = [
  [/hero/i, '英雄'], [/skill/i, '技能'], [/damage/i, '伤害'], [/buff/i, '状态效果'], [/unit/i, '单位'],
  [/world/i, '战场'], [/map/i, '地图'], [/path/i, '路径'], [/visib/i, '视野'], [/target/i, '目标'],
  [/audio/i, '音频'], [/sound|sfx/i, '音效'], [/particle/i, '粒子'], [/vfx|effect|fx/i, '特效'],
  [/pointer/i, '指针'], [/input/i, '输入'], [/event/i, '事件'], [/state/i, '状态'], [/time|duration/i, '时长'],
  [/position|point/i, '坐标'], [/distance/i, '距离'], [/collision|hit/i, '碰撞'], [/bush/i, '草丛'],
  [/minion/i, '小兵'], [/monster/i, '怪物'], [/tower/i, '防御塔'], [/team/i, '阵营'], [/vision/i, '视野'],
  [/geometry|shape/i, '几何'], [/mesh|model/i, '模型'], [/shader/i, '着色器'], [/sprite/i, '精灵'],
  [/icon/i, '图标'], [/dialog|panel|hud/i, '界面'], [/config|spec/i, '配置'], [/score|rank/i, '评分'],
  [/inventory/i, '背包'], [/equipment|item/i, '装备'], [/animation|anim/i, '动画'], [/camera/i, '相机'],
  [/terrain|ground/i, '地形'], [/audio|music/i, '音乐'], [/speech|voice/i, '语音'], [/light/i, '光照'],
]
const PARAM_ROLES = [
  [/^index/, '索引'], [/^event/, '事件'], [/^element/, '界面元素'], [/^distance/, '距离'],
  [/^callback$|^handler$|^factory$|^listener/, '回调'], [/^key$|^lookupKey$|^registrationKey/, '查找键'],
  [/^value/, '取值'], [/^unit$|^targetUnit$|^foeUnit/, '单位'], [/^hero/, '英雄'], [/^position$|^coordX$|^coordY$|^coordZ/, '坐标'],
  [/^state$|^battleState$|^runtime/, '运行时状态'], [/^world/, '战场'], [/^total/, '累计值'],
  [/^item/, '元素'], [/^target/, '目标'], [/^source/, '来源'], [/^selfPlayer/, '玩家自身'],
  [/^point/, '坐标点'], [/^radius/, '半径'], [/^range/, '射程'], [/^duration/, '持续时间'],
  [/^primaryInput/, '主要输入'], [/^secondaryInput/, '次要输入'], [/^tertiaryInput/, '第三输入'],
  [/^quaternaryInput/, '第四输入'], [/^extraInput/, '附加输入'], [/^sourceSpec/, '来源规格'],
  [/^soundBuilder/, '音效构建器'], [/^fxBuilder/, '特效构建器'], [/^builder/, '构建器'],
  [/^seed/, '随机种子'], [/^ctx$|^audioContext/, '音频上下文'], [/^kind$|^lowpassKind$|^whiteKind/, '类型'],
  [/^timeValue/, '时间值'], [/^numericValue/, '数值'], [/^selectedValue/, '选定值'],
]
function describeParam(name) {
  for (const [re, text] of PARAM_ROLES) if (re.test(name)) return text
  // 语义名本身已可读（如 TextureValue / jointSpec / foeUnit），转为中文描述
  if (/texture/i.test(name)) return '纹理'
  if (/joint/i.test(name)) return '骨骼关节'
  if (/mesh/i.test(name)) return '网格'
  if (/color|tint/i.test(name)) return '颜色'
  if (/sound|audio/i.test(name)) return '音效'
  if (/particle|emit/i.test(name)) return '粒子'
  if (/skill/i.test(name)) return '技能'
  if (/damage/i.test(name)) return '伤害'
  if (/^is[A-Z]/.test(name)) return '布尔标志'
  return '输入'
}
function describeName(name) {
  if (name === '<anonymous>' || name.startsWith('<')) return '回调'
  let verb = '处理'
  for (const [re, text] of VERBS) if (re.test(name)) { verb = text; break }
  const words = name.replace(/^([a-z]+?)(?=[A-Z])/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  const nounParts = []
  for (const [re, text] of NOUNS) if (re.test(words) && !nounParts.includes(text)) nounParts.push(text)
  const noun = nounParts.slice(0, 3).join('与') || '相关逻辑'
  return `${verb}${noun}`
}
function inferReturn(node, sf) {
  const body = node.body
  if (!body) return 'unknown'
  let kind = 'void'
  ;(function scan(n) {
    if (!n || typeof n !== 'object') return
    if (FN_KINDS.has(n.kind) && n !== node) return
    if (ts.isReturnStatement(n) && n.expression) {
      const expr = n.expression
      if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword || expr.kind === ts.SyntaxKind.ExclamationToken) kind = 'boolean'
      else if (ts.isNumericLiteral(expr) || ts.isBinaryExpression(expr)) kind = kind === 'boolean' ? 'boolean' : 'number'
      else if (ts.isStringLiteral(expr) || ts.isTemplateExpression(expr)) kind = kind === 'number' ? 'unknown' : 'string'
      else if (ts.isObjectLiteralExpression(expr) || ts.isArrayLiteralExpression(expr)) kind = 'object'
    }
    ts.forEachChild(n, scan)
  })(body)
  return kind
}
function labelOf(node, sf) {
  if (node.name) return node.name.getText(sf)
  const parent = node.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.getText(sf)
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText(sf)
  if (parent && ts.isCallExpression(parent) && parent.expression === node) return '<anonymous>'
  return '<anonymous>'
}

function docsForFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const insertions = []
  ;(function visit(node) {
    if (FN_KINDS.has(node.kind)) {
      const label = labelOf(node, sf)
      const start = node.getStart(sf)
      const bodyLines = node.body ? sf.getLineAndCharacterOfPosition(node.body.end).line - sf.getLineAndCharacterOfPosition(node.body.pos).line : 0
      const exported = !!(node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      const leading = src.slice(Math.max(0, start - 400), start)
      const hasDoc = /\/\*\*[\s\S]*?\*\/\s*$/.test(leading)
      const isArrowOneLiner = node.kind === ts.SyntaxKind.ArrowFunction && bodyLines <= 1
      if (!hasDoc && label !== '<anonymous>' && (exported || bodyLines >= 4) && !isArrowOneLiner) {
        const params = (node.parameters || []).map((p) => p.name.getText(sf)).filter((n) => !/^_/.test(n))
        const description = describeName(label)
        // 参数还没语义化、或函数名无法推断业务对象时不写 JSDoc：
        // 「@param n - 输入」是注释噪音，不是说明。
        const hasSemanticParams = !params.some((name) => /^[A-Za-z_$][A-Za-z0-9_$]{0,3}$/.test(name))
        if (hasSemanticParams && !/相关逻辑$/.test(description)) {
          const lines = [`/**`, ` * ${description}。`, ` *`]
          for (const param of params) lines.push(` * @param ${param} - ${describeParam(param)}`)
          const ret = inferReturn(node, sf)
          if (ret === 'boolean') lines.push(` * @returns 是否满足条件`)
          else if (ret === 'number') lines.push(` * @returns 数值结果`)
          else if (ret === 'string') lines.push(` * @returns 文本结果`)
          else if (ret === 'object') lines.push(` * @returns 结果对象`)
          lines.push(` */`, '')
          insertions.push({ pos: start, text: lines.join('\n') })
        }
      }
    }
    ts.forEachChild(node, visit)
  })(sf)
  return { src, insertions }
}

const files = fileArg ? [path.resolve(ROOT, fileArg)] : (function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
})(path.join(ROOT, 'src'))

let total = 0
const perFile = []
for (const file of files) {
  const { src, insertions } = docsForFile(file)
  if (!insertions.length) continue
  let out = src
  for (const insertion of [...insertions].sort((a, b) => b.pos - a.pos)) out = out.slice(0, insertion.pos) + insertion.text + out.slice(insertion.pos)
  if (WRITE) {
    const backup = path.join(ROOT, '.docs-backup', path.relative(ROOT, file))
    fs.mkdirSync(path.dirname(backup), { recursive: true })
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, src)
    fs.writeFileSync(file, out)
  }
  total += insertions.length
  perFile.push({ file: path.relative(ROOT, file), count: insertions.length })
}
console.log(JSON.stringify({ write: WRITE, functions: total, files: perFile.length }, null, 2))
for (const item of perFile.sort((a, b) => b.count - a.count).slice(0, 20)) console.log(`${WRITE ? '[write]' : '[dry]'} ${item.file}: ${item.count}`)
