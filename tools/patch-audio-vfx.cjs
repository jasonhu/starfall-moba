const acorn=require('acorn'),fs=require('fs');
const P='src/kernel/starfall.core.js';
let src=fs.readFileSync(P,'utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'});
let FS=null, Pb=null;
for(const st of ast.body) if(st.type==='VariableDeclaration') for(const d of st.declarations)
  if(d.id.type==='Identifier'){ if(d.id.name==='FS') FS=d.init; if(d.id.name==='Pb') Pb=d.init; }
if(!FS||!Pb) throw new Error('FS/Pb not found');

const soundKit=['At','Ti','Hc','Qm','Ey','Si','Ay','c5','Od','El','th','Tl','i1','Fc','ga','CS','It'];
const vfxKit=['_r','Gd','Xt','ad','yc','qe','sn','od','oe','xc','Mt','bn','Ha','W','rd','EP','TP','Zr','Ft','B1','Ku'];
const edits=[
 {a:Pb.start,b:Pb.end,txt:`buildVfxTemplates({ ${vfxKit.join(', ')} })`},
 {a:FS.start,b:FS.end,txt:`buildSoundBank({ ${soundKit.join(', ')} })`},
];
edits.sort((x,y)=>y.a-x.a);
for(const e of edits) src=src.slice(0,e.a)+e.txt+src.slice(e.b);
src=src.replace('import { buildClassicMap } from "../world/map/classic";',
`import { buildClassicMap } from "../world/map/classic";
import { buildSoundBank } from "../audio/definitions";
import { buildVfxTemplates } from "../vfx/templates";`);
fs.writeFileSync(P,src);
console.log('patched audio+vfx');
