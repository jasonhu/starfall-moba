#!/usr/bin/env node
/**
 * 行为等价验证：同一组输入下，新旧两版函数产生的「调用轨迹」必须逐参数一致。
 *
 * 用途：语义化重构（改函数名/参数名/局部变量）后，证明「只是改名，逻辑零改动」。
 * 比 AST 对比更强：它直接比较运行时的实际参数值（含默认值、条件分支、循环展开）。
 *
 * 用法：
 *   node tools/verify-behavior.cjs <旧文件> <新文件> <cases.json>
 *
 * cases.json：
 *   {
 *     "sfxSwingWhoosh": [[440, 0, 1, 0.8, 1.2, 1, "@node"]],
 *     "sfxPitchDropHit": [[0, 0.6, "@node"]]
 *   }
 *   说明：组长之间用数组；字符串 "@node" 会被替换成一个独立节点对象。
 *
 * 内置 stub 覆盖音频合成器面（osc/fm/noise/filt/ramp/pan/gain/ring/drive/ctx.createGain），
 * 其他模块如需别的方法，用 --extra 传入方法名列表（默认全部返回节点并记录）。
 */
const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const [OLD, NEW, CASES] = process.argv.slice(2)
if (!OLD || !NEW || !CASES) {
  console.error('用法: node tools/verify-behavior.cjs <旧文件> <新文件> <cases.json>')
  process.exit(1)
}

const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'))

/** 打包成 CJS 以便 require */
function bundle(file, tag) {
  const out = path.resolve(`/tmp/verify-behavior-${tag}.cjs`)
  esbuild.buildSync({
    entryPoints: [file],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: out,
    logLevel: 'silent',
    target: 'es2022',
  })
  return require(out)
}

/** 记录型 stub：每次调用把 [方法名, ...序列化参数] 压入 log */
function makeKit(log) {
  let seq = 0
  // 节点上的「值属性」返回标记字符串（供 ramp(...) 这类传值用），
  // 其余属性返回可调用函数（供 node.connect(...) 这类链式调用），并记录调用
  const VALUE_PROPS = new Set(['frequency', 'gain', 'Q', 'value', 'detune', 'pan'])
  const mkNode = (kind) => {
    const id = `${kind}#${++seq}`
    return new Proxy(
      { __node: id },
      {
        get(t, k) {
          if (k === '__node') return id
          if (k === Symbol.toPrimitive) return () => 0
          if (k === 'then') return undefined
          if (VALUE_PROPS.has(String(k))) return `${id}.${String(k)}`
          return (...args) => {
            rec(`${id}.${String(k)}`, args)
            return mkNode(`${id}.${String(k)}`)
          }
        },
      },
    )
  }
  const ser = (v) => {
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6)
    if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v)
    if (Array.isArray(v)) return '[' + v.map(ser).join(',') + ']'
    if (typeof v === 'object') {
      const id = v.__node
      if (id) return `<${id}>`
      return '{' + Object.keys(v).sort().map((k) => `${k}:${ser(v[k])}`).join(',') + '}'
    }
    return String(v)
  }
  const rec = (name, args) => log.push(`${name}(${args.map(ser).join(', ')})`)

  const kit = {
    filt: (...a) => (rec('filt', a), mkNode('filter')),
    ramp: (...a) => rec('ramp', a),
    osc: (...a) => rec('osc', a),
    fm: (...a) => rec('fm', a),
    noise: (...a) => rec('noise', a),
    ring: (...a) => rec('ring', a),
    pan: (...a) => (rec('pan', a), mkNode('pan')),
    gain: (...a) => (rec('gain', a), mkNode('gain')),
    drive: (...a) => (rec('drive', a), mkNode('drive')),
    ctx: { createGain: () => (rec('createGain', []), mkNode('ctxGain')) },
  }
  return { kit, mkNode }
}

/** 把 "@node" 占位替换成真实节点 */
function materialize(args, mkNode) {
  return args.map((a) => (a === '@node' ? mkNode('dest') : a))
}

const oldMod = bundle(OLD, 'old')
const newMod = bundle(NEW, 'new')

const results = []
let pass = 0
let fail = 0

for (const [fnName, argSets] of Object.entries(cases)) {
  const oldFn = oldMod[fnName]
  const newFn = newMod[fnName]
  if (typeof oldFn !== 'function' || typeof newFn !== 'function') {
    results.push({ fnName, ok: false, err: `导出缺失（old=${typeof oldFn}, new=${typeof newFn}）` })
    fail++
    continue
  }
  let fnOk = true
  for (let i = 0; i < argSets.length; i++) {
    const logOld = []
    const logNew = []
    const a = makeKit(logOld)
    const b = makeKit(logNew)
    try {
      oldFn(a.kit, ...materialize(argSets[i], a.mkNode))
    } catch (e) {
      fnOk = false
      results.push({ fnName, ok: false, err: `旧版第 ${i + 1} 组抛错: ${e.message}` })
      break
    }
    try {
      newFn(b.kit, ...materialize(argSets[i], b.mkNode))
    } catch (e) {
      fnOk = false
      results.push({ fnName, ok: false, err: `新版第 ${i + 1} 组抛错: ${e.message}` })
      break
    }
    const same = logOld.length === logNew.length && logOld.every((l, j) => l === logNew[j])
    if (!same) {
      fnOk = false
      const idx = logOld.findIndex((l, j) => l !== logNew[j])
      results.push({
        fnName,
        ok: false,
        err: `第 ${i + 1} 组调用轨迹不同（第 ${idx + 1} 条起）`,
        detail: { old: logOld.slice(idx, idx + 2), new: logNew.slice(idx, idx + 2) },
      })
      break
    }
  }
  if (fnOk) {
    pass++
    results.push({ fnName, ok: true, calls: argSets.length })
  } else {
    fail++
  }
}

console.log(`对比 ${OLD}\n     ${NEW}\n`)
for (const r of results) {
  if (r.ok) console.log(`  ✅ ${r.fnName}  (${r.calls} 组输入，调用轨迹完全一致)`)
  else {
    console.log(`  ❌ ${r.fnName}  ${r.err}`)
    if (r.detail) {
      console.log(`      旧: ${r.detail.old.join('  |  ')}`)
      console.log(`      新: ${r.detail.new.join('  |  ')}`)
    }
  }
}
console.log(`\n结果：${pass}/${pass + fail} 个函数行为一致`)
process.exit(fail ? 1 : 0)
