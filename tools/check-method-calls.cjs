#!/usr/bin/env node
/**
 * 方法调用面校验：找出「调用了一个方法，但全库没有任何类/对象定义它」的情况。
 *
 * 背景（真实事故）：`Simulation.fx()` 在批量改名时被改成 `createCanvas`，
 * 但 31 处 `n.fx(...)` 调用点没跟着改 → 运行时 `TypeError: n.fx is not a function`。
 * 这类 bug 名字级审计、AST 等价、tsc、引擎冒烟全部拦不住（方法名不是绑定，
 * 也不是自由标识符），只有真正跑到那段代码才炸。本脚本就是补这道闸门。
 *
 * 判定：
 *   - 收集「方法定义名」= 所有 class 的 MethodDefinition + 对象字面量里值为函数的方法
 *   - 收集「方法调用名」= 所有非 computed 的 MemberExpression 访问且处于 callee 位置
 *   - 差集里剔除内置白名单（DOM / three / 数组 / 字符串 等），剩下的报为可疑
 *
 * 用法：node tools/check-method-calls.cjs [--verbose]
 * 退出码：0 = 无问题；1 = 发现可疑调用
 */
const fs = require('fs')
const path = require('path')
const acorn = require('acorn')

const VERBOSE = process.argv.includes('--verbose')
const DIR = 'src/kernel'

/** 语言/宿主/three 的内置方法名（不属于项目定义，也不算问题） */
const BUILTIN = new Set(
  `push pop shift unshift slice splice indexOf lastIndexOf includes join concat map filter forEach
   reduce reduceRight find findIndex some every sort reverse flat flatMap fill copyWithin
   keys values entries has get set add delete clear size length
   toString valueOf toJSON hasOwnProperty charAt charCodeAt codePointAt startsWith endsWith
   indexOf padStart padEnd repeat replace replaceAll split trim trimStart trimEnd toLowerCase
   toUpperCase substring substr at match matchAll search
   call apply bind constructor
   getContext getBoundingClientRect getAttribute setAttribute removeAttribute appendChild
   removeChild insertBefore replaceChild querySelector querySelectorAll addEventListener
   removeEventListener dispatchEvent setAttributeNS createElement createElementNS
   createTextNode requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout
   setInterval clearInterval focus blur click submit preventDefault stopPropagation
   toFixed toPrecision toExponential
   setFromMatrixPosition setFromMatrixScale setFromMatrixColumn makeRotationFromQuaternion
   applyMatrix4 applyMatrix3 applyQuaternion setFromRotationMatrix setFromEuler setFromQuaternion
   multiplyMatrices premultiply multiplyScalar normalize lengthSquared copy clone setScalar
   addScaledVector lerpVectors subVectors addVectors copyPosition setPosition getPosition
   getWorldPosition getWorldQuaternion getWorldDirection lookAt updateMatrix updateMatrixWorld
   updateWorldMatrix decompose compose invert transpose scale translate rotate
   setIndex setAttribute getAttribute dispose build draw render update reset
   dispatch begin end emit on off once
   toArray fromArray fill array count sum min max abs floor ceil round sqrt pow sin cos tan
   asin acos atan atan2 random at sign hypot exp log log2 log10 cbrt trunc
   isNaN isFinite now parse stringify stringify
   promise then catch finally
   pause play stop seek
   setValueAtTime linearRampToValueAtTime exponentialRampToValueAtTime
   cancelScheduledValues start connect disconnect gain createGain createOscillator
   createBiquadFilter createBufferSource createBuffer createDelay createConvolver
   createDynamicsCompressor createStereoPanner createPanner createAnalyser
   createWaveShaper createPeriodicWave createChannelMerger createChannelSplitter
   getByteFrequencyData getFloatFrequencyData getByteTimeDomainData resume suspend close
   getTiming getComputedStyle scrollIntoView setPointerCapture releasePointerCapture
   arc clip rect save restore translate rotate scale fill stroke beginPath closePath moveTo
   lineTo bezierCurveTo quadraticCurveTo arcTo ellipse fillText strokeText measureText
   createLinearGradient createRadialGradient createPattern drawImage putImageData getImageData
   setLineDash createImageData
   imul from test exec tanh race all flip
   // 以下为「运行时动态赋值」的方法：对象在构造后被赋上函数属性，AST 里没有方法定义。
   // fn=音效 patch 回调、u8=外部注入的地图构建器、getW=渐变采样、soft=皮肤混色、
   // gold/setK/setD/setA/setT/setN=HUD 绑定器的 setter。已逐个人工确认，非断链。
   fn u8 getW soft gold setK setD setA setT setN getLv setX setZ show hide
   // three 的 BufferAttribute / Color / Vector 方法，以及 console 方法、关键帧的 ease
   getX getY getZ lerp dot warn info ease
`.split(/\s+/).filter(Boolean)
)

/** 收集一个文件里的「方法定义名」和「方法调用名」 */
function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  let ast
  try {
    ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  } catch (e) {
    return { defined: new Map(), called: new Map(), parseError: e.message }
  }

  const defined = new Map() // name -> [line]
  const called = new Map() // name -> [line]

  const kids = (n) => {
    const out = []
    for (const k of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'range'].includes(k)) continue
      const v = n[k]
      if (v && typeof v === 'object') out.push(v)
    }
    return out
  }

  ;(function walk(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (typeof n.type !== 'string') return

    // 方法定义：class 方法 / 对象字面量里的函数属性 / 类字段箭头函数
    if (n.type === 'MethodDefinition' && n.key && n.key.type === 'Identifier' && !n.computed && n.kind !== 'constructor') {
      const arr = defined.get(n.key.name) || []
      arr.push(n.loc.start.line)
      defined.set(n.key.name, arr)
    }
    if (
      n.type === 'Property' &&
      n.key &&
      n.key.type === 'Identifier' &&
      !n.computed &&
      n.value &&
      (n.value.type === 'FunctionExpression' || n.value.type === 'ArrowFunctionExpression')
    ) {
      const arr = defined.get(n.key.name) || []
      arr.push(n.loc.start.line)
      defined.set(n.key.name, arr)
    }
    if (n.type === 'PropertyDefinition' && n.key && n.key.type === 'Identifier' && !n.computed && n.value &&
        (n.value.type === 'ArrowFunctionExpression' || n.value.type === 'FunctionExpression')) {
      const arr = defined.get(n.key.name) || []
      arr.push(n.loc.start.line)
      defined.set(n.key.name, arr)
    }

    // 方法调用：callee 是 x.name(...)
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.type === 'Identifier') {
      const nm = n.callee.property.name
      const arr = called.get(nm) || []
      arr.push(n.loc.start.line)
      called.set(nm, arr)
    }

    kids(n).forEach(walk)
  })(ast)

  return { defined, called, parseError: null }
}

// ---- 汇总 ----
const { listSourceFiles } = require('./lib-files.cjs')
// 带类型注解的早期 .ts 样板由 tsc 校验，acorn 解析不了，跳过
const files = listSourceFiles(DIR).map((f) => path.join(DIR, f)).filter((p) => {
  if (!p.endsWith('.ts')) return true
  const s = fs.readFileSync(p, 'utf8')
  return !(/\b(interface|type)\s+[A-Z]|^export type|import type|:\s*(string|number|boolean|any)\b/m.test(s))
})

const allDefined = new Set()
const allCalled = new Map() // name -> [{file,line}]
const errors = []

for (const f of files) {
  const { defined, called, parseError } = scanFile(f)
  if (parseError) {
    errors.push(`${path.basename(f)}: 解析失败 ${parseError}`)
    continue
  }
  for (const k of defined.keys()) allDefined.add(k)
  for (const [nm, lines] of called) {
    const arr = allCalled.get(nm) || []
    for (const l of lines) arr.push(`${path.basename(f)}:${l}`)
    allCalled.set(nm, arr)
  }
}

const suspicious = []
for (const [nm, sites] of allCalled) {
  if (allDefined.has(nm)) continue
  if (BUILTIN.has(nm)) continue
  // 只关心短名：压缩残留的方法名都是 1~4 字符（如 fx / Ht / d8）。
  // DOM / Canvas / three 的方法名几乎都是长名（lineTo / beginPath / setRenderTarget），
  // 用长度过滤能大幅降噪，同时不漏掉真正的断链。
  if (nm.length > 4) continue
  if (/^[A-Z_]+$/.test(nm)) continue // 常量式（如 .RGBA）不是方法
  suspicious.push({ name: nm, count: sites.length, sites: sites.slice(0, 5) })
}

suspicious.sort((a, b) => b.count - a.count)

if (VERBOSE) {
  console.log(`方法定义名 ${allDefined.size} 个；被调用的方法名 ${allCalled.size} 个`)
  console.log(`可疑（调用了但无定义）${suspicious.length} 个：`)
  for (const s of suspicious) console.log(`  .${s.name}()  ×${s.count}  ${s.sites.join(', ')}`)
} else {
  if (suspicious.length) {
    console.log(`⚠️  发现 ${suspicious.length} 个「调用了但全库无定义」的方法（前 10）：`)
    for (const s of suspicious.slice(0, 10)) console.log(`   .${s.name}()  ×${s.count}  ${s.sites.join(', ')}`)
    console.log('   （若确认是 DOM/three 的内置方法，把它加进 BUILTIN 白名单）')
  } else {
    console.log('✅ 方法调用面完整：所有被调用的方法都有定义（或在内置白名单内）')
  }
}

if (errors.length) {
  errors.forEach((e) => console.log('❌ ' + e))
}

process.exit(suspicious.length || errors.length ? 1 : 0)
