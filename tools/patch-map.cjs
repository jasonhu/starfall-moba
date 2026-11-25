const acorn=require('acorn'),fs=require('fs');
const P='src/kernel/starfall.core.js';
let src=fs.readFileSync(P,'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true});
const find=(name)=>{for(const st of ast.body){
  if(st.type==='VariableDeclaration') for(const d of st.declarations) if(d.id.type==='Identifier'&&d.id.name===name) return {st,d};
  if(st.type==='FunctionDeclaration'&&st.id.name===name) return {fn:st};
}};
const edits=[];
const push=(a,b,txt,label)=>{edits.push({a,b,txt,label});};

// Oz..Hz 声明（同一 const 语句，只替换 Oz 起的部分）
{const {st,d}=find('Oz');
 const start=src.lastIndexOf('Oz',d.init.start);
 push(start,st.end,"const __MAP = buildClassicMap({ $t, $h, I0, Ax, h8 })\nconst Oz = __MAP.Oz, Bz = __MAP.Bz, n_ = __MAP.n_, Hz = __MAP.Hz","map:terrain-data");}
{const {fn}=find('$z'); push(fn.start,fn.end,'const $z = __MAP.$z','map:camps');}
{const {st}=find('Gz'); push(st.start,st.end,'const s_ = __MAP.s_, Gz = __MAP.Gz','map:lanes');}
{const {fn}=find('i_'); push(fn.start,fn.end,'const i_ = __MAP.i_','map:base');}
{const {st}=find('a_'); push(st.start,st.end,'const a_ = __MAP.a_','map:towers');}
{const {fn}=find('Vz'); push(fn.start,fn.end,'const Vz = __MAP.Vz','map:tower-pairs');}
{const {fn}=find('u8'); push(fn.start,fn.end,
`function u8() {
  return globalThis.__STARFALL_MAP__ ? globalThis.__STARFALL_MAP__() : __MAP.u8()
}`,'map:entry');}

edits.sort((x,y)=>y.a-x.a);
for(const e of edits){
  if(e.a<0||e.b<=e.a) throw new Error('bad range '+e.label);
  src=src.slice(0,e.a)+e.txt+src.slice(e.b);
}
src=src.replace('import HERO_DATA from "../heroes/index";',
`import HERO_DATA from "../heroes/index";
import { buildClassicMap } from "../world/map/classic";`);
fs.writeFileSync(P,src);
console.log('patched map:',edits.length,'edits');
