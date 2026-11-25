# 加一个新英雄

一个英雄在内核里由 **8 个注册点**组成。按下面的顺序做，可以把一件事拆成"先能跑、再变好看"。

| # | 注册点 | 位置 | 换英雄必须改吗 |
|---|---|---|---|
| 1 | 英雄数据 `Se` | `src/heroes/<id>.ts` → `src/heroes/index.ts` | ✅ 必须 |
| 2 | 技能玩法规格 `Oa` | 内核 62816 起（自动兜底见下） | ✅ 必须（或让兜底生成） |
| 3 | 模型 + 骨架 + 动作 `Gx` | 内核 43570–47000（5 个 builder）+ 51176 注册表 | ✅ 否则报"未知模型" |
| 4 | 战斗特效模板 `Pb` | 内核 29855 起 | 建议 |
| 5 | 一次性特效事件 `ED` | 内核 31627 | 建议 |
| 6 | 音效 `FS` / 普攻音映射 `ET·AT` | 内核 1132 起 / 4427 起 | 建议 |
| 7 | 技能图标 `XB` | 内核 54333–55080 | 建议（可复用别的英雄） |
| 8 | AI 决策分支 | 内核 63536、63628、63661、63681 | 玩家操作可不改；AI 用就必改 |

---

## 方案 A：最小闭环（约 20 分钟，复用现有外观）

**目标**：新英雄能出现在选人界面、能进对局、技能有效果，外观先借用樊哙。

### 1. 写数据

复制 `src/heroes/_template.ts` 为 `src/heroes/myhero.ts`，改 `id` / 数值 / 技能文案 / 出装。
注意：
- `build` 里的装备 id 必须在 `ItemTable`（内核 53950）里存在，否则启动直接抛错；
- `values` 里的键（`damage`/`adRatio`/`knockup`/`slow`/`dashSpeed`…）会同时被 **UI 文案渲染** 和 **兜底技能规格** 读取，尽量沿用现有键名。

### 2. 注册数据

`src/heroes/index.ts`：

```ts
import { myhero } from './myhero'
export const heroes = { panyue, chijin, xingli, fengling, yeque, myhero }
```

内核的 `kr = Object.keys(HERO_DATA)` 会自动把它加进阵容池、模型预热、选人列表。

### 3. 借外观（否则起局时报"未知模型：hero:myhero"）

`src/extensions/install.ts`：

```ts
const ENABLE_DEMO_HERO = true   // 打开示例开关

if (ENABLE_DEMO_HERO) {
  aliasHeroModel('myhero', 'panyue')   // 模型/骨架/动作全部复用樊哙
  aliasHeroIcons('myhero', 'panyue')   // 技能图标复用
}
```

### 4. 技能规格

两种做法：

**(a) 让内核兜底生成** —— 什么都不用写。
我在内核里加了一个 `__defaultActionSpec(id)`：英雄没有手写 `Oa` 条目时，按 `Se` 里的 `values` 自动推：
- `apRatio` 存在 → 法术伤害，否则物理；
- `knockup` / `stun` / `slow` → 对应控制；
- `cast.type === 'direction'` 且有 `dashSpeed` → 位移；
- `hits` / `tick` → 多段伤害。

**(b) 手写一条**（要精确控制时）：

```ts
import { actionSpecKit } from './api'
const kit = actionSpecKit()          // 暴露内核的 buildActionSpec / makeDamage / makeDash / skillValue / skillRange

registerActionSpec('myhero', {
  s1: kit.build('myhero', 's1', {
    roles: ['engage', 'chase'],
    damage: kit.damage('physical', { ad: 'adRatio' }),
    cc: [{ kind: 'slow', duration: kit.val('myhero', 's1', 'slowDur'), value: kit.val('myhero', 's1', 'slow') }],
    mobility: kit.dash('myhero', 's1', true),
    reach: kit.range('myhero', 's1') + kit.val('myhero', 's1', 'impactRadius'),
    aoeRadius: kit.val('myhero', 's1', 'impactRadius'),
    dodgeable: true,
  }),
  // s2 / ult 同理
} as any)
```

---

## 方案 B：自建外观（模型 / 动作 / 特效 / 音效 / 图标）

### 1. 模型与动作（内核 43570–47000 区）

5 个英雄各有一个 builder，返回结构统一：

```js
return {
  key: 'hero:myhero',
  geometry,        // 合批后的角色几何（含顶点色、AO bake）
  rig,             // 骨骼/节点层级，attach 里挂点：head/chest/handR/handL/weapon/muzzle
  height, radius, scale, stride,
  attach: { head: {...}, chest: {...}, handR: {...}, handL: {...}, weapon: {...}, muzzle: {...} },
  blend: (from, to) => 过渡时长,
  animate(pose, state) { /* 每帧按 state（idle/run/attack/dash/cast/ult/dead…）摆姿势 */ },
}
```

写法参考 `function UU()`（樊哙，45099）。可复用的原语：
- `ge(rig, parent, pose)` —— 用一个姿势快照生成关节姿态；
- `zs([[t, pose, easing], …])` —— 把若干姿势串成关键帧；
- `Ls` / `Wa` —— 骨骼与几何构建器（`paint` 写顶点色、`lathe` 车削、`bone` 绑骨）。

然后在注册表 51176 加一行：`"hero:myhero": MYBUILDER,`

### 2. 特效

- 持续型（护盾环、旋风、裂隙）：加进 `Pb`（29855），key 命名建议 `myhero_s2_aura`；
- 一次性（起手、命中、落地）：写一个形如 `(fx, ev, power) => { … }` 的函数，加进 `ED`（31627），并让技能事件名对上。
  可复用的效果原语：`qo`（面片辉光）、`bn`（冲击环）、`Ha`（尘土）、`xx`/`vs`（闪光与光照）、`n.shake`（镜头震动）。

### 3. 音效（内核 1132 起，`At()` DSL）

```js
myhero_s1_cast: At('技能释放', '突刺·起手', (s) => {
  s.noise({ flt: 'bandpass', fc: 1800, q: 1.2, a: 0.002, d: 0.09, g: 0.5 })
  s.osc({ w: 'triangle', f: 520, f1: 240, a: 0.002, d: 0.12, g: 0.35 })
}, { loud: -18, len: 0.5, rev: 0.2 }),
```

再加两处映射：`ET`（普攻挥击音）、`AT`（普攻命中音），都在 4427 附近。

### 4. 技能图标（SVG，内核 54333 起）

每个英雄有一套 `$B` 那种 `{passive, s1, s2, ult}` 的 SVG 生成函数（`dn()` 包壳 + `Rs()` 取配色），然后在 54750 的 `XB` 注册表加一行。不做就 `aliasHeroIcons` 复用别人的。

### 5. AI（内核 63536–63720）

四个函数各有一个 `switch (n.heroId)`：
- `nV` 对拼/追击判断；`sV` 击杀连招；`Uk` 消耗；`oy` 清线/刷野。

玩家自己操作不受影响；要让 AI 会用新英雄，每个 switch 加一个 `case 'myhero':`。

---

## 验证清单

```bash
npm run build && npx serve dist   # 或 python3 -m http.server -d dist
```

1. 启动看控制台：`[starfall] heroes / models / actionSpecs` 三行是否都包含新 id；
2. 选人界面出现新英雄卡片（头像来自 `Gx` 的预览渲染）；
3. 进对局：模型、移动、普攻、三个技能、死亡与复活都正常；
4. 检查 `build` 装备是否存在、技能文案占位符是否都能被 `values` 解析。


---

## 实战案例：项羽（本工程已实装）

`src/heroes/xiangyu.ts` + `src/heroes/xiangyu.spec.ts`，是"只写数据、外观寄宿"的完整样板。

### 落码的 5 步

1. **数据**：`xiangyu.ts` 写基础属性、成长、被动、三个技能（含 `values` 数值表）、出装、配色、外观描述。
2. **注册**：`src/heroes/index.ts` 里加一行 → 内核 `kr = Object.keys(HERO_DATA)` 自动带上。
3. **技能规格**：`xiangyu.spec.ts` 用 `buildActionSpec / makeDamage / makeDash / skillValue / skillRange`
   映射成 AI 与执行器能读的形态（护盾走 `selfBuffs: ['shield']`，冲刺走 `makeDash`）。
   不写这层会退化为内核的 `__defaultActionSpec` 兜底：能打，但护盾/攻速增益丢失。
4. **外观寄宿**：`aliasHeroVisual('xiangyu','chijin')` 一次对齐
   模型 + 特效配色(`ws`) + 立绘取景框(`v3`) + 模型缩放(`XO`)。少任一项，对局里都会读到 `undefined`。
5. **音效寄宿**：`aliasHeroSfx('xiangyu','chijin')`。注意音效分三张表：
   `FS`（战斗事件）、`GS`（技能施法 `cast_<id>_s1`）、其余 UI 组；
   查找表 `r1` 在**启动时一次性合并**，所以必须写 `r1`，只改 `FS` 没用。

### 验证口径（无 WebGL 环境下）

```bash
npm run build && python3 -m http.server 8899 --directory dist
# 控制台应出现
[starfall] heroes = panyue,chijin,xingli,fengling,yeque,xiangyu
[starfall] xiangyu spec = s1 reach 10.2 / aoe 2.4 / dash 7.8 | s2 dur 3.5 buffs ["shield"] | ult reach 13.2 / aoe 4.2 / delay 0.6 / cc 2
```

数值非 NaN、`buffs` 非空，说明技能规格被内核正确解算。

### 已知边界

- **外观与程咬金完全一致**（同一套骨架与配色）。要真正不同，得在内核写新的程序化模型 builder，
  成本远高于数据层。
- **没有专属 AI case**：内核 `nV()` 里我给了一个 `default` 通用分支（护盾→大招→冲刺的顺序），
  保守但不会站着不动；想要专属打法，在 `nV()` 的 switch 里照着 panyue/chijin 加一个 `case "xiangyu"`。
- **没有技能专属音效/特效**：技能施法音效沿用程咬金的（同名派生），特效模板与事件处理未新增，
  所以三个技能只有通用打击特效。要加，见 `ADD_SOUND_VFX.md`。


---

## 第二个坑：内核里 14 张"按英雄 id 查表"的表

`TypeError: Cannot read properties of undefined (reading 'survive')` 就是这么来的：
选人界面给每个英雄渲染能力雷达图，取的是 `hH[heroId]`，新英雄没有这一行。

全量清单（都已处理）：

| 表 | 内容 | 处理方式 |
|---|---|---|
| `ET` / `AT` | 普攻挥击/命中音 | `aliasHeroSfx()` 写入 |
| `ws` | 特效配色（glow/hot/deep/accent/dark） | `aliasHeroVisual()` 复制 + `\|\| ws.chijin` 兜底 |
| `XO` | 模型缩放 | 复制 + 原代码本就 `?? 1` |
| `v3` | 立绘取景框 | `aliasHeroVisual()` 复制 |
| `XB` | 技能/头像图标 | `aliasHeroIcons()` 复制 |
| `cB` | 施法动作映射（`cast_s1 → ["dash",0.7]`） | `heroRow(cB, id)` |
| `fB` | 卡面镜头（drop/dist/yaw/anim） | `heroRow(fB, id)` |
| `hH` | 能力雷达五项 | `heroRow(hH, id)` + 全 6 分默认 |
| `Oa` | 技能玩法规格 | `registerActionSpec()` 注册 |
| `jG` | AI 性格（fleeHp/engage/initiator…） | `heroRow(jG, id)` + 中性默认 |
| `pV` | 施法动作名 → 技能槽 | `heroRow(pV, id)`（调用处本就判空） |
| `OG` | AI 技能优先级顺序 | 默认参数改 `\|\| ["s2","ult","s1"]` |
| `f6` | 威胁评估（技能槽 + 射程） | 调用处本就 `s &&` 判空 |
| `d6` | 补刀节奏系数 | `?? 1` |

### 统一机制 `heroRow(table, id)`

内核里新加了一个查找助手：

```js
__heroRow = (table, id) => table[id] || table[globalThis.__STARFALL_HERO_BASE__[id]]
```

`aliasHeroVisual(newId, baseId)` 会把 `newId → baseId` 记进 `__STARFALL_HERO_BASE__`。
所以**以后再加英雄，只要调用 `aliasHeroVisual`，这 14 张表里的"查表类"自动回退到宿主**，
不需要再逐张补。只有 `Oa`（技能规格）和 `ET/AT`（音效）要单独登记。

### 自检办法

启动日志里有一行：

```
[starfall] radar ok = 6/6
```

它逐个英雄真实渲染了一次雷达图 SVG。数字不等于英雄总数，就说明还有英雄在查表时命中了 `undefined`。


---

## 项羽已升级为"真·独立英雄"

之前是数据 + 寄宿外观，现在是自己的模型：

### 1. 模型（内核 `SX()` / `XY()`）

- `SX()`：在共享人形骨架上重做武器 —— **长戟**（柘木漆杆 + 握把缠绳 + 尾镦 + 矛尖 + 侧月牙戟枝 + 金环 + 红缨），
  刚性绑定到 `propR` 关节。
- `XY()`：装甲装配层，配色整表换成玄黑重甲 / 赤红披风 / 鎏金饰件（`nX` / `jX` 两套调色板）。
- 体型：`height 2.44`、`radius 0.72`，比程咬金更壮。
- 实测：**6202 三角形**，构建通过。

### 2. 动作

沿用同一套动作状态机（move / attack / cast_s1 / cast_s2 / cast_ult / dash / spin / stunned / dead / airborne），
但姿态集与武器尺寸不同，挥戟轨迹是新的。
自检会逐个动作真实调用 `animate()`：**anims ok = 11/11**。

### 3. 技能（`xiangyu.spec.ts`）

破釜一击（冲撞 + 击飞）、霸王之勇（护盾 + 攻速）、垓下突围（跃击 + 击飞 + 减速区）。
实测 `s1 reach 10.2 / dash 7.8`、`ult 13.2 / aoe 4.2 / delay 0.6 / cc 2`。

### 4. 音效（5 条，WebAudio 现场合成）

`atk_xiangyu_swing`、`atk_xiangyu_hit`、`cast_xiangyu_s1`、`cast_xiangyu_s2`、`cast_xiangyu_ult`
（戟风、入肉、冲锋、怒吼、落地）。总音效数 40 → 45。

### 5. 图标（自绘 SVG）

三个技能图标独立绘制（戟刺 / 盾徽 / 落地冲击圈），不套用他人图标。自检 **icons ok = 18/18**。

### 尚未完成

**技能专属视觉特效（VFX）**：目前三个技能播放的是通用打击特效，没有起手/命中/落地的定制光效。
做法见 `ADD_SOUND_VFX.md`：在 `src/vfx/templates.ts` 加持续型模板，或用 `registerVfxHandler` 挂一次性事件。


### 补充坑：图标表有 4 个键，不是 3 个

每个英雄的图标集是 `{ passive, s1, s2, ult }`。只画 3 个技能图标，
点开英雄详情时会读 `XB[heroId].passive` → `is not a function` 直接崩。
自检已扩到 4×6=24 项（`icons ok = 24/24`）。


### 实机反馈后的一轮修正（配色/取景/武器）

1. **色号用 0x 字面量重写**：之前用十进制换算，实际渲染偏洋红。现在 `jX` / `nX` 全部改成
   `robe: 0x1c1813` 这种直写十六进制（JS 里同一个数字，但不会再算错位）。
2. **身高从 2.44 改回 2.3**：`height` 参与选人界面相机取景，我调高 0.14 米导致相机后退、
   人在卡面上变小。想显壮要靠几何，不是改这个数字。
3. **戟加粗**：杆径 0.026→0.036、矛尖加长、月牙放大约 30%、缨加大。


### 第三轮：自建外层装束（兜鍪 / 肩吞 / 护心镜 / 裙甲）

关键发现：`i.bone(joint)` **只负责蒙皮权重**，几何坐标是模型绝对坐标（y 从地面算起），
所以可以直接按身高加装，不用换算骨骼局部系。

- 兜鍪：覆钵（lathe）+ 帽檐 + 顶缨（tube）+ 双侧护颊（extrude 镜像）+ 额前金饰
- 肩吞：两层重甲护肩 + 金环，左右各一
- 护心镜：胸前的鎏金圆盘 + 皮革横带
- 裙甲：战裙（lathe）+ 六片甲叶（按角度环形排布）+ 腰间金环

三角形 6202 → **7356**，11 个动作仍全部通过。

**踩坑**：XY 里 `i` 是关节索引表（`i = n.J`），几何构建器是 `t`。
我第一次把整段写成了 `i.lathe(...)`，报 `i.bone is not a function`。


### 第四轮：轮廓整体放大（v2）

上一版的问题不是"没加东西"，而是**加的件尺寸和内层几乎一样大，被盖住了**。
这一版把关键轮廓放大 30%~50%，并补披风、护臂、护腿：

| 部件 | 尺寸变化 |
|---|---|
| 兜鍪覆钵 | r 0.148 → **0.222**，加高冠脊（竖直挤出片） |
| 顶缨 | 顶端 y 1.94 → **2.1** |
| 肩吞 | r 0.178 → **0.245**，三层结构 + 护臂 |
| 胸甲 | 新增整体上身板 r 0.262（原来没有外壳） |
| 裙甲 | r 0.30 → **0.365**，甲叶 6 → 8 片 |
| 披风 | 新增左右两片（刚性绑胸，不走布料模拟） |
| 护腿 | 新增胫甲 + 战靴 |

三角形 7356 → **8312**。


### 第五轮：配色根因 + 全身覆盖

**关键根因**：底座 `SX()`（克隆自 `SU()`）里所有 `paint` 用的都是 `nX`，
而 `nX = {...ne, ...}` 继承的是**程咬金原调色板 `ne`**。
所以前几轮怎么改 `jX`，人物身上仍是他的橙褐色 —— 我改错了对象。

验证方式：直接读几何的 `color` 顶点属性做颜色直方图。
改色前后两次构建的直方图**逐位相同**，才定位到 `nX` 继承 `ne` 这条线。

修法：新建统一调色板 `PX`，`const nX = PX` 与 `const jX = PX` 同时指向它，
底座身体与外层甲就共用一套冷铁青金配色。

同时补了全身覆盖：面甲（遮脸留眼缝）、髯须、双臂上下段、双腿大腿段、护腿、战靴。
三角 8312 → **8948**。

改色后直方图出现 `#52647a`（钢青）等新色，肤色 `#9f5b3b` 仍在（手/脸边缘）。


### 第六轮：去红（红缨/裙摆色键） + 放大体型

上一版"甲色变了但人还是像"，原因是 `nX.red` 这一族仍是大红，
程咬金的红缨、红裙摆、红甲缘都走这个键。

- `red/redDark/redLight` 由 `0x8e2026/0x4a0e12/0xc23a3f` 改为 `0x8a7654/0x3f3628/0xd8c27c`（铜金族）
- 武器缨穗仍保留 `tassel 0xc62330`（唯一的红，作为识别色）
- `scale` 由共用的 `fw=1.24` 改为项羽专属 **1.36**（`fw` 是程咬金共用常量，不能动）

直方图变化：`#450405`（暗红）消失，出现 `#412e17`（铜金）。
