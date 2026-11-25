#!/usr/bin/env node
/**
 * 区域特效模板全量自检：对 Pb 里的每个模板跑一遍 create + update。
 *
 * 背景（真实事故）：`AreaEffectView.update` → `def.create(...)` 读 `Xt.telegraph` / `qe.shield`，
 * 而 templates.ts 的解构 key 是旧短名、内核传的是新语义名 → 两者都是 undefined，
 * 运行时抛 `Cannot read properties of undefined (reading 'shield')`，且发生在渲染循环里，
 * 会每帧报错、画面卡死。
 *
 * 本脚本用万能 Proxy stub 充当渲染宿主（n）与实例状态（t），把 templates.ts 里
 * 每个模板的 create/update 都真实执行一遍。任何一个模板读了 undefined 都会立刻暴露，
 * 比在浏览器里等 AI 放技能可靠得多。
 *
 * 用法：node tools/check-vfx-templates.cjs
 * 退出码：0 = 全部通过；1 = 有模板抛错
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const OUT = path.resolve('tools/.engine-bundle.cjs')

// 1) 现打一份内核（避免用到修复前的旧产物）
esbuild.buildSync({
  entryPoints: [require('fs').existsSync('src/kernel/starfall.core.ts') ? 'src/kernel/starfall.core.ts' : 'src/kernel/starfall.core.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: OUT,
  logLevel: 'silent',
  target: 'es2022',
})

// 2) 安装共用 DOM stub，再加载内核
require('./lib-dom-stub.cjs').installDomStub()

const K = require(OUT)
const Pb = K.VfxTemplates || K.Pb
if (!Pb || typeof Pb !== 'object') {
  console.error('❌ 内核未导出区域特效模板表（VfxTemplates）')
  process.exit(1)
}

/** 万能 chainable stub：任意属性/调用都返回自身，可读写 */
function makeStub(name = 'stub') {
  const target = function () {}
  const p = new Proxy(target, {
    get(t, k) {
      if (k === Symbol.toPrimitive || k === 'valueOf') return () => 0
      if (k === Symbol.iterator) return function* () {}
      if (k === 'then') return undefined
      if (k === 'length') return 0
      if (k === '__name') return name
      if (!(k in t)) t[k] = makeStub(`${name}.${String(k)}`)
      return t[k]
    },
    set(t, k, v) {
      t[k] = v
      return true
    },
    apply() {
      return makeStub(`${name}()`)
    },
    construct() {
      return makeStub(`new ${name}`)
    },
  })
  return p
}

/** 实例状态：字段要真实（数字/数组），否则模板里的循环与算术会被 stub 吃掉 */
function makeInstance() {
  return {
    id: 1,
    x: 2,
    z: -3,
    radius: 3,
    team: 0,
    team2: 2,
    hostile: true,
    mine: false,
    ownerId: 7,
    age: 0.4,
    t: 0.4,
    duration: 1.2,
    phase: 0.7,
    slots: [],
    meshes: [],
    edge: -1,
    acc: 0,
    seen: 1,
  }
}

// 2) 逐模板执行
const results = []
let failures = 0

for (const [name, def] of Object.entries(Pb)) {
  if (!def || typeof def !== 'object') {
    results.push({ name, ok: false, err: '定义不是对象' })
    failures++
    continue
  }
  const n = makeStub('n')
  const t = makeInstance()
  const steps = []
  try {
    if (typeof def.create === 'function') {
      def.create(n, t)
      steps.push('create')
    }
    if (typeof def.update === 'function') {
      def.update(n, t, 0.016)
      steps.push('update')
    }
    if (typeof def.update === 'function') {
      // 再跑一次 update，覆盖「已存在实例」的分支（读 slots/meshes 的分支）
      t.age = 1.0
      t.t = 0.83
      def.update(n, t, 0.016)
      steps.push('update#2')
    }
    results.push({ name, ok: true, steps })
  } catch (e) {
    failures++
    results.push({ name, ok: false, err: `${e.name}: ${e.message}`, steps })
  }
}

// 3) 报告
const total = results.length
const passed = results.filter((r) => r.ok).length
if (failures) {
  console.log(`❌ 区域特效模板自检失败：${passed}/${total} 通过\n`)
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ${r.name}  →  ${r.err}`)
  }
} else {
  console.log(`✅ 区域特效模板自检通过：${passed}/${total}（每个模板均执行 create + update×2）`)
}

// 顺带列出模板名，便于人工核对覆盖面
console.log('   模板:', Object.keys(Pb).join(', '))

process.exit(failures ? 1 : 0)
