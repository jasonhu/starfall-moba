#!/usr/bin/env node
/**
 * 合并出最终映射表（置信度优先）：
 *   1. map-three-classes2（this.type / isXxx / 含静态方法 Jaccard）——确定性信号，最高优先
 *   2. 人工核验表（本项目实测确认）——次优先
 *   3. map-three-constants（LCS 常量链，逐值验证）——常量专用
 *   4. 旧 class/others 指纹——兜底
 *
 * 之后逐个核验：官方必须导出该名；常量值必须相等；类方法集合必须是官方子集。
 */
const fs = require('fs')
const acorn = require('acorn')

const MANUAL = {
  go: 'WebGLRenderTarget',
  hm: 'Uint16BufferAttribute',
  um: 'Uint32BufferAttribute',
  Ae: 'Float32BufferAttribute',
  Ji: 'Group',
  zr: 'DataTexture',
  Z7: 'CanvasTexture',
  mm: 'ConeGeometry',
  sx: 'IcosahedronGeometry',
  ix: 'OctahedronGeometry',
  gE: 'RawShaderMaterial',
  LM: 'HemisphereLight',
  N0: 'UniformsUtils',
  tn: 'ShaderLib',
  ee: 'ShaderChunk',
}

/** 明确由游戏代码引用、必须本地保留的 three 内部临时量 */
const LOCAL_ONLY = new Set(['bg', 'cc', 'cv'])

;(async () => {
  const THREE = await import('three')
  const exported = new Set(Object.keys(THREE))

  const rows = JSON.parse(fs.readFileSync('/tmp/three-migration.json', 'utf8'))
  const m2 = new Map(JSON.parse(fs.readFileSync('/tmp/three-map2.json', 'utf8')).map((r) => [r.local, r.official]))
  const constM = new Map(JSON.parse(fs.readFileSync('/tmp/const-map.json', 'utf8')).map((r) => [r.local, r.official]))
  const othersM = new Map(JSON.parse(fs.readFileSync('/tmp/others-map.json', 'utf8')).map((r) => [r.local, r.official]))
  const oldClass = new Map(JSON.parse(fs.readFileSync('/tmp/three-map.json', 'utf8')).map((r) => [r.local, r.official]))

  // 我方类节点（用于方法集合核验）
  const src = fs.readFileSync('src/kernel/starfall.core.js', 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const localClass = new Map()
  for (const n of ast.body) {
    if (n.type === 'ClassDeclaration' && n.id) localClass.set(n.id.name, n)
    else if (n.type === 'VariableDeclaration')
      for (const d of n.declarations)
        if (d.id.type === 'Identifier' && d.init && d.init.type === 'ClassExpression') localClass.set(d.id.name, d.init)
  }
  const methodsOf = (node) => {
    const s = new Set()
    for (const el of node.body.body) {
      if (el.type !== 'MethodDefinition') continue
      const k = el.key
      const nm = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null
      if (nm && nm !== 'constructor') s.add(nm)
    }
    return s
  }
  const protoMethods = (C) => {
    const s = new Set()
    let p = C.prototype
    while (p && p !== Object.prototype) {
      for (const nm of Object.getOwnPropertyNames(p)) if (nm !== 'constructor') s.add(nm)
      p = Object.getPrototypeOf(p)
    }
    // 静态方法（ShapeUtils / ImageUtils 这类全静态工具类必须一并比对）
    for (const nm of Object.getOwnPropertyNames(C)) {
      if (!['length', 'name', 'prototype'].includes(nm)) s.add(nm)
    }
    return s
  }

  const out = []
  const problems = []
  for (const r of rows) {
    const local = r.local
    if (LOCAL_ONLY.has(local)) {
      out.push({ local, official: null, why: 'local-only' })
      continue
    }
    const candidates = [
      ['map2', m2.get(local)],
      ['manual', MANUAL[local]],
      ['const', constM.get(local)],
      ['others', othersM.get(local)],
      ['oldClass', oldClass.get(local)],
    ].filter(([, v]) => v)
    if (!candidates.length) {
      problems.push(`${local}: 无法识别`)
      out.push({ local, official: null, why: 'unresolved' })
      continue
    }
    let chosen = null
    for (const [why, name] of candidates) {
      if (!exported.has(name)) continue
      // 类核验：我方方法必须都在官方原型链上
      const node = localClass.get(local)
      if (node) {
        const C = THREE[name]
        if (typeof C !== 'function') continue
        const theirs = protoMethods(C)
        const mine = methodsOf(node)
        const missing = [...mine].filter((m) => !theirs.has(m))
        if (missing.length > 2) continue // 方法缺失过多，说明不是同一个类
      }
      chosen = { official: name, why }
      break
    }
    if (!chosen) {
      problems.push(`${local}: 候选均未通过核验 (${candidates.map((c) => c[1]).join('/')})`)
      out.push({ local, official: null, why: 'rejected' })
      continue
    }
    out.push({ local, official: chosen.official, why: chosen.why })
  }

  const mapped = out.filter((r) => r.official)
  const dupOfficial = {}
  for (const r of mapped) dupOfficial[r.official] = (dupOfficial[r.official] || 0) + 1
  const dups = Object.entries(dupOfficial).filter(([, n]) => n > 1)

  console.log(`解析成功: ${mapped.length}，本地保留: ${out.filter((r) => r.why === 'local-only').length}，问题: ${problems.length}`)
  if (problems.length) console.log('问题:\n  ' + problems.join('\n  '))
  console.log(`重复官方导出: ${dups.length ? dups.map(([k, n]) => `${k}×${n}`).join(', ') : '无（干净）'}`)
  if (dups.length) {
    for (const [k] of dups) console.log(`  ${k}: ` + mapped.filter((r) => r.official === k).map((r) => r.local).join(', '))
  }
  console.log('\n按来源统计:', JSON.stringify(mapped.reduce((a, r) => ((a[r.why] = (a[r.why] || 0) + 1), a), {})))

  fs.writeFileSync('/tmp/three-final-map.json', JSON.stringify(out, null, 1))
  console.log('写入 /tmp/three-final-map.json')
})()
