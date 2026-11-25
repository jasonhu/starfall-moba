const acorn=require('acorn'), walk=require('acorn-walk'), fs=require('fs');
const src=fs.readFileSync('src/kernel/starfall.core.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true,allowAwaitOutsideFunction:true});
const topDecl=new Set(), targets={};
for(const st of ast.body){
  if(st.type==='VariableDeclaration'){
    for(const d of st.declarations){
      if(d.id.type==='Identifier'){
        topDecl.add(d.id.name);
        if(['FS','Pb','ED','Gz','u8','Oa','Gx','ln','XB'].includes(d.id.name)) targets[d.id.name]=d.init;
      }
    }
  } else if(st.type==='FunctionDeclaration'){ topDecl.add(st.id.name); if(['u8','dU','nw'].includes(st.id.name)) targets[st.id.name]=st; }
  else if(st.type==='ClassDeclaration'){ topDecl.add(st.id.name); }
}
const GLOBAL=new Set(['Math','Object','Array','Number','String','Boolean','JSON','Set','Map','WeakMap','WeakSet','Promise','Error','Date','console','window','document','performance','Float32Array','Uint8Array','Uint16Array','Uint32Array','Int32Array','Int16Array','Int8Array','ArrayBuffer','Symbol','parseFloat','parseInt','isNaN','isFinite','Infinity','NaN','RegExp','Reflect','Proxy','getComputedStyle','requestAnimationFrame','setTimeout','clearTimeout','localStorage','DataView','Image','Audio','AudioContext','navigator','location','self','globalThis','fetch','structuredClone','Intl','btoa','atob','MutationObserver','ResizeObserver','CustomEvent','Event','OffscreenCanvas','Blob','URL','crypto','TextEncoder','TextDecoder','Function','undefined']);
const report={};
for(const [name,node] of Object.entries(targets)){
  if(!node){report[name]=['<nf>'];continue;}
  const used=new Set(), declared=new Set();
  walk.full(node,(n)=>{
    if(n.type==='Identifier'&&n.name) used.add(n.name);
    if(n.type==='VariableDeclarator'&&n.id.type==='Identifier') declared.add(n.id.name);
    if((n.type==='FunctionDeclaration'||n.type==='ClassDeclaration')&&n.id) declared.add(n.id.name);
    if(n.type==='ArrowFunctionExpression'||n.type==='FunctionExpression') n.params.forEach(p=>{ if(p.type==='Identifier')declared.add(p.name); });
    if(n.type==='ObjectPattern') n.properties.forEach(x=>{ if(x.value&&x.value.type==='Identifier')declared.add(x.value.name); });
  });
  report[name]=[...used].filter(u=>!declared.has(u)&&!GLOBAL.has(u));
}
for(const [k,v] of Object.entries(report)) console.log(k,'free('+v.length+'):', v.slice(0,200).join(' '));
