import * as THREE from 'three'
import { mergeGeometries as officialMerge } from 'three/addons/utils/BufferGeometryUtils.js'
import fs from 'fs'

// 从内核抽取 BI / _b（压缩态实现），注入 three 的 BufferGeometry / BufferAttribute
const core = fs.readFileSync('src/kernel/starfall.core.js', 'utf8').split('\n')
const block = core.slice(8516, 8632).join('\n') // 8517..8632

const Bn = THREE.BufferGeometry
const On = THREE.BufferAttribute
const factory = new Function('Bn', 'On', `${block}; return { BI, _b }`)
const { BI } = factory(Bn, On)

function makeGeo(offset, segs) {
  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  for (let i = 0; i < segs; i++) {
    positions.push(i + offset, i * 2, 0)
    normals.push(0, 0, 1)
    uvs.push(i / segs, 0)
    if (i > 0) indices.push(i - 1, i)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  return g
}

const cases = [
  { name: '两段带索引几何体', geos: () => [makeGeo(0, 5), makeGeo(10, 4)], groups: false },
  { name: '带 groups 合并', geos: () => [makeGeo(0, 3), makeGeo(5, 3)], groups: true },
]

let pass = true
for (const c of cases) {
  const mine = BI(c.geos(), c.groups)
  const theirs = officialMerge(c.geos(), c.groups)
  const attrsA = Object.keys(mine.attributes).sort().join(',')
  const attrsB = Object.keys(theirs.attributes).sort().join(',')
  let same = attrsA === attrsB
  for (const k of Object.keys(mine.attributes)) {
    const a = mine.attributes[k].array
    const b = theirs.attributes[k]?.array
    if (!b || a.length !== b.length) {
      same = false
      continue
    }
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) same = false
  }
  const idxA = mine.index ? Array.from(mine.index.array).join(',') : '-'
  const idxB = theirs.index ? Array.from(theirs.index.array).join(',') : '-'
  const idxSame = idxA === idxB
  const groupsSame = JSON.stringify(mine.groups) === JSON.stringify(theirs.groups)
  console.log(`${same && idxSame && groupsSame ? '✅' : '❌'} ${c.name}: 属性[${attrsA}] 索引一致=${idxSame} groups一致=${groupsSame}`)
  if (!(same && idxSame && groupsSame)) pass = false
}
console.log(pass ? '\n✅ 内核内联的 mergeGeometries 与官方 addon 行为完全一致，可安全替换' : '\n❌ 行为不一致，不可替换')
process.exit(pass ? 0 : 1)
