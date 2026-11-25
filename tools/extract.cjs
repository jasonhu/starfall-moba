const acorn=require('acorn'), fs=require('fs');
const P='src/kernel/starfall.core.js';
const src=fs.readFileSync(P,'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true});

const decls={};            // name -> node(init) or function node
const varDecls={};         // name -> {declStart,declEnd,initStart,initEnd}
for(const st of ast.body){
  if(st.type==='VariableDeclaration'){
    for(const d of st.declarations){
      if(d.id.type!=='Identifier') continue;
      decls[d.id.name]=d.init;
      varDecls[d.id.name]={stStart:st.start,stEnd:st.end,initStart:d.init&&d.init.start,initEnd:d.init&&d.init.end};
    }
  } else if(st.type==='FunctionDeclaration' && st.id){
    decls[st.id.name]=st;
  }
}
const obj=n=>src.slice(n.start,n.end);

/* ---------- 1. 音效表 ---------- */
const soundKit=['At','Ti','Hc','Qm','Ey','Si','Ay','c5','Od','El','th','Tl','i1','Fc','ga','CS','It'];
let sound=obj(decls.FS);
fs.mkdirSync('src/audio',{recursive:true});
fs.writeFileSync('src/audio/definitions.ts',
`/**
 * 音效事件表（原 kernel 内 FS 对象，逐字符搬运）
 * 依赖的合成工具从内核注入，模块本身不 import 内核，避免循环依赖。
 * 追加/替换音效：直接改这里，或用 extensions/api 的 registerSound 运行时注入。
 */
import type { SoundKit } from './types'

export function buildSoundBank(kit: SoundKit): Record<string, unknown> {
  const { ${soundKit.join(', ')} } = kit as any
  return ${sound}
}
`);

/* ---------- 2. 特效模板表 ---------- */
const vfxKit=['_r','Gd','Xt','ad','yc','qe','sn','od','oe','xc','Mt','bn','Ha','W','rd','EP','TP','Zr','Ft','B1','Ku'];
let vfx=obj(decls.Pb);
fs.mkdirSync('src/vfx',{recursive:true});
fs.writeFileSync('src/vfx/templates.ts',
`/**
 * 战斗特效模板表（原 kernel 内 Pb 对象，逐字符搬运）
 * 持续型特效：护盾环、旋风、裂隙、光环等。
 * 追加/替换：改这里，或运行时 registerVfx(name, template)。
 */
import type { VfxKit } from './types'

export function buildVfxTemplates(kit: VfxKit): Record<string, unknown> {
  const { ${vfxKit.join(', ')} } = kit as any
  return ${vfx}
}
`);

/* ---------- 3. 地图数据 ---------- */
const mapNames=['s_','Gz','a_','i_','Vz','Oz','Bz','n_','Hz','$z','u8','e_'];
const mapText={};
for(const n of mapNames){
  const node=decls[n];
  if(!node){ throw new Error('missing map symbol '+n); }
  if(node.type==='FunctionDeclaration') mapText[n]=src.slice(node.start,node.end);
  else mapText[n]=src.slice(node.start,node.end);
}
fs.mkdirSync('src/world/map',{recursive:true});
fs.writeFileSync('src/world/map/classic.ts',
`/**
 * 经典三路地图 —— 从内核 u8() 及周边常量整块搬运。
 * 这里就是"地图长什么样"的全部真相：外框、三路路点、防御塔位置、墙体多边形、
 * 草丛矩形、野区刷新点、双方基地/泉水。
 *
 * 想换地图：改这里的数值，或者在启动前给 globalThis.__STARFALL_MAP__ 赋一个同结构工厂。
 */
import type { MapKit, GameMap } from './types'

export function buildClassicMap(kit: MapKit) {
  const { $t, $h, I0, Ax, h8 } = kit as any

${mapNames.map((n)=>indent(mapText[n])).join('\n\n')}

  return { s_, Gz, a_, i_, Vz, Oz, Bz, n_, Hz, $z, u8, e_ }
}
`.replace(/\$\{mapNames[^}]*\}/, mapNames.map((n)=>indent(mapText[n])).join('\n\n')));

function indent(t){ return t.split('\n').map(l=>l?('  '+l.trimStart()):l).join('\n'); }
console.log('generated: src/audio/definitions.ts, src/vfx/templates.ts, src/world/map/classic.ts');
