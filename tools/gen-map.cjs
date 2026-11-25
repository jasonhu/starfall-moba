const acorn=require('acorn'),fs=require('fs');
const src=fs.readFileSync('tools/original-bundle.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'});
const nodes={};
for(const st of ast.body){
  if(st.type==='VariableDeclaration') for(const d of st.declarations)
    if(d.id.type==='Identifier'&&d.id.name) nodes[d.id.name]={kind:'var',node:d.init};
  if(st.type==='FunctionDeclaration'&&st.id) nodes[st.id.name]={kind:'fn',node:st};
}
const order=['s_','Gz','a_','i_','Vz','Oz','Bz','n_','Hz','$z','u8','e_'];
const parts=order.map(n=>{
  const rec=nodes[n]; if(!rec) throw new Error('missing '+n);
  const text=src.slice(rec.node.start,rec.node.end);
  return rec.kind==='var' ? `const ${n} = ${text}` : text;
}).map(t=>t.split('\n').map(l=>l?('  '+l.trimStart()):l).join('\n'));
fs.writeFileSync('src/world/map/classic.ts',
`/**
 * 经典三路地图 —— 从内核 u8() 及周边常量整块搬运。
 * 这里就是"地图长什么样"的全部真相：外框、三路路点、防御塔位置、墙体多边形、
 * 草丛矩形、野区刷新点、双方基地与泉水。
 *
 * 换地图：改这里的数值，或在启动前给 globalThis.__STARFALL_MAP__ 赋一个返回同结构对象的函数。
 * 坐标工具（$t/$h/I0/Ax/h8）由内核注入，避免两边各写一份。
 */
import type { MapKit } from './types'

export function buildClassicMap(kit: MapKit) {
  const { $t, $h, I0, Ax, h8 } = kit as any

${parts.join('\n\n')}

  return { s_, Gz, a_, i_, Vz, Oz, Bz, n_, Hz, $z, u8, e_ }
}
`);
console.log('rewritten classic.ts');
