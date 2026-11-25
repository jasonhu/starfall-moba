const fs=require('fs')
const P='src/kernel/starfall.core.js'
let s=fs.readFileSync(P,'utf8')

// 1) 模型注册表
if(!s.includes('"hero:xiangyu": XY')) s=s.replace('    "hero:jU": ','').replace('    "hero:yeque": jU,', '    "hero:yeque": jU,\n    "hero:xiangyu": XY,')

// 2) 其余按英雄索引的表：找到表定义，复制 yeque 那行并按表改写数值
const tables={
  ws:`xiangyu: { glow: Lt(16747196), hot: Lt(16756280), deep: Lt(11609162), accent: Lt(16431971), dark: Lt(2365480) },`,
  v3:`xiangyu: [-0.42, 0.46], `,
  XO:`xiangyu: 1.03, `,
  cB:`xiangyu: { cast_s1: ["dash", 0.62], cast_s2: ["cast_s2", 1.25], cast_ult: ["cast_ult", 1.1] },`,
  fB:`xiangyu: { drop: 0.28, dist: 3.4, yaw: -16, x: 0.02 },`,
  hH:`xiangyu: { survive: 8.4, damage: 6.6, control: 8.2, mobility: 6.4, ease: 6.8 },`,
  jG:`xiangyu: { fleeHp: 0.24, recallHp: 0.35, engage: 0.88, initiator: !0, diveBackline: 0.35, support: !1 },`,
  pV:`xiangyu: { cast_s1: "s1", dash: "s1", cast_s2: "s2", cast_ult: "ult" },`,
  d6:`xiangyu: 1.15 `,
  OG:`xiangyu: ["ult", "s1", "s2"] `,
}
for(const [name,entry] of Object.entries(tables)){
  if(s.includes(`xiangyu:`) && name!=='ws') {
    // 跳过已处理
  }
  const decl=new RegExp(`\\n(\\s*)${name.replace('$','\\$')} = \\{`)
  const m=decl.exec(s)
  if(!m) { console.warn('未找到表',name); continue }
  const head=m.index+m[0].length
  const seg=s.slice(head, s.indexOf('\nconst ', head)>0? s.indexOf('\nconst ', head): head+4000)
  const ln=/^(\s+)yeque: .*$/m.exec(seg)
  if(!ln){ console.warn('未找到 yeque 行',name); continue }
  const indent=ln[1]
  const insert='\n'+indent+entry
  const at=head+ln.index+ln[0].length
  s=s.slice(0,at)+insert+s.slice(at)
}
fs.writeFileSync(P,s)
console.log('注册完成')
