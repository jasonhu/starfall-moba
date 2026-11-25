# `@ts-nocheck` 根因诊断清单

> 生成时间：2026-11-21 19:20–19:45
> 方法：在隔离副本 `/tmp/tscheck-sandbox` 中移除 50 个 `.ts` 文件的 `@ts-nocheck` 后运行 `tsc --noEmit`，
> 工作区源码全程未改动。原始错误明细：`/tmp/tscheck-errors.txt`（939 条）。

## 1. 总览

| 错误码 | 数量 | 归类 | 是否逐条确认 |
|---|---:|---|---|
| TS2554 参数个数不匹配 | 444 | 签名/参数缺失 | 已聚类，修法已实测 |
| TS2339 属性不存在 | 371 | 类型推断为 `{}` / 联合类型 | 已抽样，逐条见补录 |
| TS2448 声明前使用 | 32 | 压缩搬迁顺序错（真 TDZ） | 已逐条导出 |
| TS2561 对象字面量多余属性 | 25 | `chain()` 签名错配 | 已确认单一根因 |
| TS2362/2363/2365 运算类型 | 38 | `Num` 联合类型未收窄等 | 逐条诊断中 |
| TS2345/2349/2353/2551/2698/2322/2794/2538 | 29 | 混杂 | 逐条诊断中 |
| **合计** | **939** | | |

## 2. 已实证的根因与修法

### 2.1 高价值批量修复点（改一处消多条）

| 修复点 | 消除条数 | 实测 | 根因 |
|---|---:|---|---|
| `src/kernel/node-tree.ts:56` 的 `chain(jointIds: number[]): void` → 参数为 config 对象 | **24** | 939→915 ✅ | 调用点传 `{joints, tip, stiffness, ...}` 高层配置，签名却写低层 `number[]` |
| `builder.extrude(...)` 第 4 参标可选 | 约 66（4→3 类的一部分） | 待实测 | 多处调用只传 3 参 |
| `audio-mixer.at(..., options?)` | 4 | 939→935 ✅ | 内部用 `options?.floor`，签名却必填 |

### 2.2 反直觉结论：多数错误码根因分散

- `audio-mixer.at(options?)` 只消 4 条 → 117 条 "4→3" TS2554 分散在多个不同函数（hero-preview 28 / model-monsters 28 / model-heroes 19 / model-world 17 / input-controls 15 …）。
- 给 `sfx-engine` 构造器参数补类型只消 2 条（939→937）→ TS2339 里 `.clock/.dynamics` 只是少数，大量是 `.uniforms/.font/.map` 等其他推断点。
- **结论：不可按错误码批量套同一修法，须按具体调用点/类型分别处理。**

### 2.3 真缺陷（非纯类型标注，必须人工改代码）

- **TS2448 / `model-builder.ts:436-445`**（15 条）：箭头函数内局部变量 `entries`（重排结果）与外部坐标数组 `entries` 同名，导致 `entries[element*3]` 在声明前使用——运行时真 TDZ 抛错。修法：重命名内部变量。
- **TS2448 / 其余 17 条**：分散在 `model-monsters`、`model-heroes`、`match-lifecycle`、`coach-panel`、`shop-panel`，均为压缩搬迁导致的声明顺序颠倒，需逐处核对。

## 3. 工作量地图（四大类按文件）

```
108 foundation.ts      93 model-heroes.ts    71 model-monsters.ts
 69 sfx-cues.ts         60 model-builder.ts   47 hero-preview.ts
 34 model-world.ts      32 hud-root.ts        28 text-rasterizer.ts
 28 boot.ts             26 input-controls.ts  24 dom-kit.ts
 24 generic-cast-handler.ts   19 hud-panels.ts  14 world-builder.ts
 14 skill-bar.ts        14 synth-voice.ts     13 sfx-engine.ts …
```

前 6 个文件约占 47%。

## 4. 关键类型线索

- `src/heroes/types.ts:13`：`export type Num = number | number[]`——技能数值可随等级为数组。
  大量 `+=` 算术错误（TS2362/2363/2365）源于把 `Num` 字段当 `number` 直接运算。
  **已实证**（`passive-registration.ts:128/344/452`、`skill-evaluation.ts:330`）：
  `CHIJIN_PASSIVE.damage`、`XINGLI_PASSIVE.hpRatio`、`passiveConfig.threshold/bonus` 都来自
  `HERO_TABLE.*.passive.values`，其数值字段被标成 `Num`，直接参与 `+`/`*`/`>=` 即报错。
  运行时这些值实际都是 number（数组形态用于按等级取值，用在别处），**属类型标注问题非运行缺陷**。
  **修法不可图省事改类型定义为 `Record<string, number>`**——xiangyu 的 `damage: [60,90,120]`
  确实是数组（按等级取值）。正确做法：复用 `kernel/skills/skill-values.ts` 的取值逻辑，加
  `num(v: Num, level=1): number` + `numView(values: SkillValues): Record<string, number>`，
  在 5 个被动常量声明处一次性归一化，下游 20 条错误全消，skill-evaluation 可复用同一 helper。
- `createEl(tagName, className?, ...children)`（`dom-kit.ts:60`）签名本身正确；
  相关 TS2554 经核查**不是符号污染**（agent 复核确认无第二定义、无局部遮蔽）。
- 异构数组字面量丢元组形状是另一大类根因：`MUSIC_*_INTRO_CHORDS`（`music.ts`）、
  `STAT_LABELS`（`icon-theme.ts`）等，加 `Array<[number, number, number[], number]>`
  或 `Array<[string, string, (n:number)=>string]>` 元组标注即可，与 `Num` 无关。
- `sprite-ribbons.ts:674` 是 `strict:false` 配置根因：非严格模式下 IteratorResult
  判别联合在 `if (done) break` 后不收窄，`.value` 仍为 `number|void`（tsc 最小复现已验证
  `strict:true` 能正常收窄）。

## 5. 补录：67 条零散错误逐条诊断

### 5.1 混杂类逐条诊断（agent 产出，26 条）

| 文件:行 | 码 | 根因 | 修法 | 严重度 |
|---|---|---|---|---|
| src/kernel/audio/audio-mixer.ts:84 | TS2551 | 源码 window.AudioContext ?? window.webkitAudioContext 使用了旧 Safari 前缀；当前 lib.dom.d.ts 已移除 webkitAu | 补全局声明：declare global { interface Window { webkitAudioContext?: typeof AudioContext } }；或就近断言 (w | 标注问题 |
| src/kernel/audio/synth-voice.ts:93 | TS2551 | 基类 SynthVoice.schedule() 调用 this.onStep(...)，但基类未声明 onStep；实际由 music.ts 的四个子类 MusicTrackBpm66/1 | 在 SynthVoice 基类增加可覆写的默认实现 onStep(step: number, nextT: number, stepDur: number) {}（若改为 abstract  | 标注问题 |
| src/kernel/core/boot.ts:839 | TS2349 | const settingsListeners = new Set() 未提供类型参数，被推断为 Set<unknown>；随后 for (const settingsListener of | 改为 new Set<(towersDestroyed: number) => void>()（按实际注册回调签名），或退一步用 Set<Function>；同时核对 add() 处回调签名 | 标注问题 |
| src/kernel/model-heroes.ts:2065 | TS2353 | emitRingFurTufts(..., position = { c: 16777215 }) 的默认参数使 position 被推断为 { c: number }；调用传入 c2、tu | 给 position 显式标注对象类型：{ c: number; c2?: number; tufts?: number; seg?: number; y?: number; amp?: n | 标注问题 |
| src/kernel/model-heroes.ts:2109 | TS2353 | 同 2065：emitRingFurTufts 的 position 默认参数被推断为 { c: number }，c2/tufts/seg/y 被判为多余属性。 | 同 2065：显式标注 position 参数为包含 c2/tufts/seg/y 等可选字段的对象类型。 | 标注问题 |
| src/kernel/model-heroes.ts:2147 | TS2353 | 同 2065：emitRingFurTufts 的 position 默认参数被推断为 { c: number }，c2/tufts/amp/lobes/lobeAmp/seg 被判为多余属 | 同 2065：显式标注 position 参数为包含 c2/tufts/amp/lobes/lobeAmp/seg 等可选字段的对象类型。 | 标注问题 |
| src/kernel/model-heroes.ts:2230 | TS2353 | 同 2065：emitRingFurTufts 的 position 默认参数被推断为 { c: number }，c2/tufts/amp/lobes/seg 被判为多余属性。 | 同 2065：显式标注 position 参数为包含 c2/tufts/amp/lobes/seg 等可选字段的对象类型。 | 标注问题 |
| src/kernel/model-monsters.ts:542 | TS2698 | const entryCount = entries.length 是 number，却被写成 { c2: DRAKE_HIDE_DARK, by: sum, ...entryCount } | 核对原始 bundle 意图：若应展开材质配置，改为展开正确的对象（如 ...clawMaterialConfig 或对应的配置常量）；若纯属误写，删除 ...entryCount。 | 真缺陷 |
| src/kernel/render/procedural-art.ts:111 | TS2322 | SceneSkyPalette 接口仅声明 sky/horizon/horizonGlow/beam/ridge 并带 [key: string]: unknown 索引签名，rim 未显式 | 在 SceneSkyPalette 接口补齐数据文件中实际存在的字段类型：rim: string; star: string; meteor: string; meteorRate: num | 标注问题 |
| src/kernel/render/sprite-ribbons.ts:405 | TS2794 | new Promise((event) => {...}) 未提供泛型，resolve 推断为 (value: unknown) => void；回调中 event() 无参调用与必需的 1 | 改为 new Promise<void>((resolve) => {...})，并把内部 event() 改名为 resolve()。 | 标注问题 |
| src/kernel/render/sprite-ribbons.ts:412 | TS2794 | 同 405：同一个 new Promise 未加 <void>，resolveOnce 内 event() 无参调用。 | 在 401 行的 new Promise 上加 <void> 即可同时消除 405 与 412 两条。 | 标注问题 |
| src/kernel/sim/match-lifecycle.ts:797 | TS2794 | loadPromises.push(new Promise((event) => {...})) 未给泛型，resolve 为 (value: unknown) => void，onPort | 改为 new Promise<void>((resolve) => {...})，内部 event() 改为 resolve()。 | 标注问题 |
| src/kernel/sim/match-lifecycle.ts:799 | TS2794 | 同上 Promise 未加 <void>：portraitImage.decode().then(onPortraitLoaded, () => event()) 的 reject 回调中  | 给 795 行 new Promise 加 <void>，并把两处 event() 改为 resolve()。 | 标注问题 |
| src/kernel/sim/match-lifecycle.ts:799 | TS2794 | 同上 Promise 未加 <void>：addEventListener('error', () => event()) 回调中 event() 无参调用。 | 给 795 行 new Promise 加 <void>，并把两处 event() 改为 resolve()。 | 标注问题 |
| src/kernel/sim/match-lifecycle.ts:950 | TS2794 | waitForNextFrame 中 new Promise((resolveFrame) => {...}) 未加泛型，resolve 为 (value: unknown) => void | 改为 new Promise<void>((resolveFrame) => {...})。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:231 | TS2345 | XINGLI_PASSIVE = HERO_TABLE.xingli.passive.values，values 类型为 SkillValues = Record<string, Num>， | 数据 xingli.ts 中 cap 实际是标量 300。可在调用点用 XINGLI_PASSIVE.cap as number 并注明 cap 为标量；更彻底的做法是把 PassiveSp | 标注问题 |
| src/kernel/ui/hud-root.ts:422 | TS2345 | createFormattedTextWriter(element, callback = String) 的默认参数 String 使 callback 被推断为 StringConstr | 在 status-strip.ts 把签名改为 function createFormattedTextWriter(element, callback: (value: any) => s | 标注问题 |
| src/kernel/ui/icon-theme.ts:61 | TS2349 | STAT_LABELS 是普通数组字面量，元素被推断为 (string / ((n:any)=>string))[] 而非元组；解构出的 formatStat 类型含 string，调用 f | 给 STAT_LABELS 显式标注 Array<[string, string, (n: any) => string]>（比 as const 更合适，避免字面量类型过窄）。 | 标注问题 |
| src/kernel/ui/icon-theme.ts:70 | TS2349 | 同 61：STAT_LABELS 元素被推断为联合数组，formatBriefStats 中 formatStat(statAmount) 不可调用。 | 同 61：给 STAT_LABELS 加元组类型标注，两处错误一并消除。 | 标注问题 |
| src/kernel/ui/scoreboard-panel.ts:41 | TS2345 | createFormattedTextWriter 的 callback 因默认参数 String 被推断为 StringConstructor，传入 formatScoreboardClo | 改 createFormattedTextWriter 签名，callback 标注为 (value: any) => string = String（与 hud-root.ts:422 同 | 标注问题 |
| src/kernel/ui/scoreboard-panel.ts:102 | TS2345 | 同 41：createFormattedTextWriter 的 callback 被推断为 StringConstructor，传入 formatNumber 不兼容。 | 同 41：一处修改 createFormattedTextWriter 签名即可。 | 标注问题 |
| src/kernel/ui/scoreboard-panel.ts:103 | TS2345 | 同 41：createFormattedTextWriter 的 callback 被推断为 StringConstructor，传入箭头函数 (primaryInputSecondary) | 同 41：一处修改 createFormattedTextWriter 签名即可。 | 标注问题 |
| src/kernel/ui/status-strip.ts:127 | TS2345 | 双重推断问题：createFormattedTextWriter 的 callback 被推断为 StringConstructor；且 valuesTertiary 是未标注的数组字面量， | callback 标注为 (value: any) => string = String；并给 valuesTertiary 显式元组类型 Array<[string, (me: any)  | 标注问题 |
| src/kernel/ui/status-strip.ts:175 | TS2345 | createFormattedTextWriter 的 callback 因默认参数 String 被推断为 StringConstructor，传入 (primaryInputExtra3 | 改 createFormattedTextWriter 签名，callback 标注为 (value: any) => string = String。 | 标注问题 |
| src/kernel/ui/status-strip.ts:176 | TS2345 | 同 175：createFormattedTextWriter 的 callback 被推断为 StringConstructor，传入 (primaryInputExtra399) =>  | 同 175：一处修改 createFormattedTextWriter 签名即可。 | 标注问题 |
| src/kernel/ui/status-strip.ts:264 | TS2349 | valuesTertiary 是未标注的数组字面量，元素被推断为 (string / ((me:any)=>number) / StringConstructor / ((v:any)=>s | 给 valuesTertiary 显式元组类型 Array<[string, (me: any) => number, (v: any) => string]>，与 status-strip | 标注问题 |
### 5.2 算术 / 运算类型类逐条诊断（41 条，agent 正式版）

| 文件:行 | 码 | 根因 | 修法 | 严重度 |
|---|---|---|---|---|
| src/kernel/audio/music.ts:397 | TS2362 | 局部常量 MUSIC_VICTORY_INTRO_CHORDS 是异构数组字面量（如 [0,38,[50,57,62,66],12]），TS 推断元素类型为 (number/number[] | 给常量加元组标注：const MUSIC_VICTORY_INTRO_CHORDS: Array<[number, number, number[], number]> = [...]（起始 | 标注问题 |
| src/kernel/audio/music.ts:466 | TS2362 | MUSIC_DEFEAT_INTRO_CHORDS 同为异构数组字面量，introChord[3] 推断为 number/number[]，不能与 stepDur 相乘。 | 同上：const MUSIC_DEFEAT_INTRO_CHORDS: Array<[number, number, number[], number]> = [...]。 | 标注问题 |
| src/kernel/audio/music.ts:469 | TS2365 | MUSIC_DEFEAT_INTRO_CHORDS 的 introChord[1] 推断为 number/number[]，不能与数字 36 做 < 比较。 | 由该数组常量的元组标注一并解决（introChord[1] 成为 number）；无需在比较处加类型守卫。 | 标注问题 |
| src/kernel/audio/music.ts:469 | TS2365 | 同一表达式中 introChord[1] + 12 的左侧仍为 number/number[]（异构数组推断）。 | 由该数组常量的元组标注一并解决。 | 标注问题 |
| src/kernel/core/boot.ts:623 | TS2362 | StatsCollector 的 buf 字段声明为裸 `buf`（无类型、无初始化，隐式 any）；Array.from(any) 在 TS 5.9 推断为 unknown[]，导致 so | 把字段显式标注为实际赋值类型 `buf: Float64Array`（构造函数已赋值 new Float64Array(...)）。这样 subarray() 返回 Float64Array | 标注问题 |
| src/kernel/core/boot.ts:623 | TS2363 | 同上，sort 比较器参数 rightSample 为 unknown（源于 Array.from(any) → unknown[]）。 | 同 buf: Float64Array 字段标注，一处修复同时消除本行两条错误。 | 标注问题 |
| src/kernel/model-heroes.ts:1125 | TS2362 | `for (const [capeChain, inputValue] of [[capeLChain,1],[capeRChain,-1]])` 的元组形态被数组字面量推断抹平：首元素是  | 给迭代表加元组标注，例如 `as [ReturnType<typeof rig.addChain>, number][]`，使 inputValue 固定为 number。 | 标注问题 |
| src/kernel/model-heroes.ts:1132 | TS2362 | 同一 for 循环里的 inputValue * 0.35（第二个 ribbon 的 axis），根因同上。 | 由上述迭代表的元组标注一并解决。 | 标注问题 |
| src/kernel/model-heroes.ts:1138 | TS2362 | 同一 for 循环里的 inputValue * 0.35（第三个 ribbon 的 axis），根因同上。 | 由上述迭代表的元组标注一并解决。 | 标注问题 |
| src/kernel/model-monsters.ts:2468 | TS2362 | entriesY 是形如 [[1,[[...],[...]]], ...] 的异构数组字面量，TS 推断元素为 (number/number[][])[]，解构出的 primaryV33 为 | 在 entriesY 定义处加元组标注：const entriesY: Array<[number, number[][]]> = [...]（首元素是 entriesX 索引，次元素是采样 | 标注问题 |
| src/kernel/model-monsters.ts:2469 | TS2538 | 同一解构变量 primaryV33 作为 entriesX 的下标，类型为 number/number[][]（联合含数组），不能用作索引类型。 | 由 entriesY 的元组标注一并解决（primaryV33 成为 number）。 | 标注问题 |
| src/kernel/render/procedural-art.ts:230 | TS2365 | SceneSkyPalette 接口只显式声明 sky/horizon/horizonGlow/beam/ridge，其余运行期键靠 `[key: string]: unknown` 兜底； | 在 src/kernel/scene-sky-palettes.ts 的 SceneSkyPalette 接口补齐显式字段：meteorRate: number、moteDir: numbe | 标注问题 |
| src/kernel/render/procedural-art.ts:230 | TS2363 | 同一行 (0.5 + Math.random()) / skyPalette.meteorRate 的右操作数为 unknown（接口未声明 meteorRate）。 | 由 SceneSkyPalette 接口补 meteorRate: number 一并解决。 | 标注问题 |
| src/kernel/render/procedural-art.ts:261 | TS2363 | skyPalette.moteDir 未被接口显式声明，经 [key:string]:unknown 得到 unknown，不能作为乘法右操作数。 | 由 SceneSkyPalette 接口补 moteDir: number 一并解决。 | 标注问题 |
| src/kernel/render/sprite-ribbons.ts:674 | TS2363 | 生成器 prewarmStages() 的 next() 返回 IteratorYieldResult<number>/IteratorReturnResult<void>；前面虽有 `if | 两种落地方式：①在 done-break 后写 `const progress = nextNextResult.value as number` 并注释说明生成器只 yield numbe | 标注问题 |
| src/kernel/render/sprite-ribbons.ts:674 | TS2363 | 同一次迭代中的第二处 0.94 * nextNextResult.value，根因为非严格模式下 IteratorResult 判别联合未收窄。 | 由上述 progress 局部标注或 for-of 改写一并解决。 | 标注问题 |
| src/kernel/render/text-rasterizer.ts:164 | TS2362 | `for (const [rootX, rootHeight, rootColor] of [[4,8,"#c89a4a"],[8,12,...],[12,7,...]])` 是异构元组数组 | 给该迭代表加元组标注：`as Array<[number, number, string]>`（x 坐标、高度、颜色）。 | 标注问题 |
| src/kernel/render/text-rasterizer.ts:164 | TS2363 | 同一解构的 rootHeight 为 string/number，14.5 - rootHeight 右操作数非法。 | 由该迭代表的元组标注一并解决。 | 标注问题 |
| src/kernel/render/text-rasterizer.ts:164 | TS2365 | 同一解构的 rootX 为 string/number，rootX + 2.6 无法应用于 string/number 与 number。 | 由该迭代表的元组标注一并解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:23 | TS2362 | PANYUE_PASSIVE = HERO_TABLE.panyue.passive.values，类型为 SkillValues = Record<string, Num>（Num=num | 在数据入口统一收窄：复用 kernel/skills/skill-values.ts 中 Nh 的取值逻辑，新增 `num(v: Num, level=1): number`（Array.i | 标注问题 |
| src/kernel/sim/passive-registration.ts:23 | TS2363 | 同一被动对象的 hpRatio（数据为 0.04）类型为 Num，maxHp * hpRatio 右操作数非法。 | 由上述 numView(PANYUE_PASSIVE) 统一收窄为 number 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:27 | TS2362 | PANYUE_PASSIVE.hits（标量 3）类型为 Num，>= 右侧的 hits - 1 报错。 | 由上述 numView(PANYUE_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:31 | TS2362 | maxStacks: PANYUE_PASSIVE.hits - 1，hits 仍为 Num。 | 由上述 numView(PANYUE_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:128 | TS2365 | CHIJIN_PASSIVE.damage（数据为 80）类型为 Num，与 adRatio*ad 相加时报 'Num' 与 'number' 不可运算。 | 把常量声明改为 `const CHIJIN_PASSIVE = numView(HERO_TABLE.chijin.passive.values)`（numView 同前）。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:128 | TS2362 | 同一行 CHIJIN_PASSIVE.adRatio（0.5）类型为 Num，作为乘法左操作数非法。 | 由上述 numView(CHIJIN_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:131 | TS2363 | CHIJIN_PASSIVE.healHpRatio（0.05）类型为 Num，maxHp * healHpRatio 右操作数非法。 | 由上述 numView(CHIJIN_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:230 | TS2363 | XINGLI_PASSIVE.stacks（3）类型为 Num，applyStatusEffectResult.stacks < stacks 右操作数非法。 | 把常量声明改为 `const XINGLI_PASSIVE = numView(HERO_TABLE.xingli.passive.values)`（numView 同前）。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:344 | TS2363 | FENGLING_PASSIVE.asPerStack（0.06）类型为 Num，BuffStackCountValue * asPerStack 右操作数非法。 | 把常量声明改为 `const FENGLING_PASSIVE = numView(HERO_TABLE.fengling.passive.values)`（numView 同前）。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:344 | TS2365 | FENGLING_PASSIVE.maxStacks（5）类型为 Num，与 BuffStackCountValue 做 >= 比较时右侧非法。 | 由上述 numView(FENGLING_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:347 | TS2365 | 第二处 FENGLING_PASSIVE.maxStacks 比较，根因同为 Num 未收窄。 | 由上述 numView(FENGLING_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:347 | TS2365 | FENGLING_PASSIVE.bonus（20）与 bonusPerLevel * attacker.level 相加，左侧为 Num。 | 由上述 numView(FENGLING_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:347 | TS2362 | FENGLING_PASSIVE.bonusPerLevel（4）类型为 Num，作为乘法左操作数非法。 | 由上述 numView(FENGLING_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:452 | TS2363 | YEQUE_PASSIVE.threshold（0.4）类型为 Num，maxHp * threshold 右操作数非法。 | 把常量声明改为 `const YEQUE_PASSIVE = numView(HERO_TABLE.yeque.passive.values)`（numView 同前）。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:452 | TS2365 | YEQUE_PASSIVE.bonus（0.18）类型为 Num，1 + bonus 右侧非法。 | 由上述 numView(YEQUE_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:452 | TS2365 | YEQUE_PASSIVE.monsterBonus（0.25）类型为 Num，1 + monsterBonus 右侧非法。 | 由上述 numView(YEQUE_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/passive-registration.ts:455 | TS2363 | YEQUE_PASSIVE.healHpRatio（0.08）类型为 Num，maxHp * healHpRatio 右操作数非法。 | 由上述 numView(YEQUE_PASSIVE) 解决。 | 标注问题 |
| src/kernel/sim/skill-evaluation.ts:330 | TS2363 | passiveConfig = HERO_TABLE.yeque.passive.values 类型为 Record<string, Num>，threshold 为 number/numb | 与 passive-registration.ts 共用 numView：`const passiveConfig = numView(HERO_TABLE.yeque.passive.va | 标注问题 |
| src/kernel/sim/skill-evaluation.ts:330 | TS2365 | passiveConfig.bonus（0.18）为 Num，1 + bonus 右侧非法。 | 由 numView(passiveConfig) 或 num() 收窄解决。 | 标注问题 |
| src/kernel/sim/skill-evaluation.ts:330 | TS2365 | passiveConfig.monsterBonus（0.25）为 Num，1 + monsterBonus 右侧非法。 | 由 numView(passiveConfig) 或 num() 收窄解决。 | 标注问题 |
| src/kernel/ui/icon-theme.ts:60 | TS2538 | STAT_LABELS 是形如 ["ad","物攻",(statAmount)=>string] 的异构数组字面量，TS 推断元素为 (string/((statAmount:any)=>s | 在 STAT_LABELS 定义处加元组标注：`const STAT_LABELS: Array<[string, string, (statAmount: number) => strin | 标注问题 |
| src/kernel/ui/icon-theme.ts:69 | TS2538 | 同一个 STAT_LABELS 数组，formatBriefStats 中解构出的 statKey 同为 string/函数联合，stats[statKey] 索引非法。 | 由 STAT_LABELS 的元组标注一并解决。 | 标注问题 |

## 6. 结论

- 939 个错误中，**66/67 条零散错误是类型标注缺失**，仅 1 条是真运行缺陷
  （`model-monsters.ts:542` 展开数字 `...entryCount` 导致 DRAKE_HIDE 材质配置静默丢弃）。
  这说明 @ts-nocheck 掩盖的主要是「类型信息缺失」，而非大规模运行时 bug——
  但也确实藏了 1 个会静默影响表现的缺陷。
- 修复不能按错误码一刀切：实测 `at(options?)` 只消 4 条、构造器补类型只消 2 条；
  但 `chain()` 签名修复一处消 24 条、`extrude()` 第 4 参可选化预计消 60+ 条。
  **优先级：先改 `chain`/`extrude`/`Num` 类型 3 个高精度修复点，再逐文件补参数与字段类型。**
- TS2448（32 条声明前使用）是压缩搬迁的真实顺序问题，其中 `model-builder.ts:436-445`
  的内部 `entries` 与外部同名导致真 TDZ，必须人工重命名，不能靠加类型解决。
- 工作量集中在前 6 个文件（约 47%）：foundation / model-heroes / model-monsters /
  sfx-cues / model-builder / hero-preview。
- 67 条零散错误的精确根因分布（agent 正式诊断）：Num 联合未收窄 20 条 /
  异构数组丢元组形状 14 条 / 字段类型丢失或索引签名 unknown 5 条 /
  strict:false 判别联合不收窄 2 条 / 其余混杂 26 条。
  **最高性价比修法**：`numView()` 被动数值归一化（消 20 条）、
  异构数组加元组标注（消 14 条）、`createFormattedTextWriter` 回调签名（消 7 条）、
  `new Promise<void>`（消 6 条）。

## 7. 复现方法

```bash
cp -r src /tmp/tscheck-sandbox/ && cp tsconfig.json package.json /tmp/tscheck-sandbox/
ln -s "$(pwd)/node_modules" /tmp/tscheck-sandbox/node_modules
cd /tmp/tscheck-sandbox
# 移除 50 个 .ts 的 @ts-nocheck 行后
./node_modules/.bin/tsc --noEmit --pretty false
# 得到 939 条错误，明细存 /tmp/tscheck-errors.txt
```

