# 换音效 / 加特效

## 音效：`src/audio/definitions.ts`

内核里原本 566 行的 `FS` 音效表已整块搬出，内核只剩一句
`FS = buildSoundBank({ At, Ti, Hc, ... })`。

### 结构

```ts
myhero_s1_cast: At(
  '技能释放',            // 分组（供设置面板分类/音量）
  '突刺·起手',           // 显示名
  (s, variant) => {      // 合成脚本：往 s 上挂振荡器/噪声
    s.noise({ flt: 'bandpass', fc: 1800, q: 1.2, a: 0.002, d: 0.09, g: 0.5 })
    s.osc({ w: 'triangle', f: 520, f1: 240, a: 0.002, d: 0.12, g: 0.35 })
  },
  { loud: -18, len: 0.5, gap: 0.08, rev: 0.2, poly: 2, prio: 2 },
)
```

第二个选项对象是**混音参数**：`loud`（分贝）、`len`（总线占用时长，防叠音）、`gap`（最小间隔）、
`rev`（混响量）、`poly`（复音数）、`prio`（优先级抢占）、`jitter`、`variants`（同一事件的变体）。

可用的合成原语（都来自 `s`）：`osc`（振荡器/滑音/颤音）、`noise`（白/粉/棕噪 + 滤波）、
`filt`、`gain`、`lfo`、`ring`（环形调制）、`drive`（失真）、`sub`（子混音）、`scatter`（散射多次）、
`ramp`（包络曲线）。全是实时合成，没有任何音频文件。

### 三种加法

1. **改现有音色**：直接改这里的参数（`fc` 调亮度、`q` 调金属感、`a/d` 调打击感）。
2. **加新音效**：在表里加一条，然后在 `ET`（普攻挥击）/ `AT`（普攻命中）或技能事件名里引用它。
3. **运行时注入**：

```ts
import { registerSound } from './extensions/api'
registerSound('myhero_ult_land', kernel.defineSound('技能释放', '落地冲击', (s) => { ... }, { loud: -12, len: 0.9, rev: 0.3 }))
```

## 特效：`src/vfx/templates.ts`（持续型）

`Pb` 表已搬出内核，当前 8 条模板，写法是

```ts
panyue_s2_aura: {
  create(fx, ev) { /* 建挂点、贴花、占位网格 */ },
  update(fx, ev, dt) { /* 每帧：环绕、缩放、透明度、粒子发射 */ },
  end(fx, ev) { /* 收尾：冲击环、尘土、清挂点 */ },
},
```

常用原语：`fx.glow.hold(...)`（面片辉光）、`fx.decals.at(...)`（地面贴花）、
`fx.particles.use(...).spawn(...)`（粒子）、`fx.rnd`（确定性随机）、`fx.shake/light`（镜头与光照）。

加一条 → 在技能事件里按名字引用（`registerVfx('myhero_s2_aura', template)` 也可运行时注入）。

## 一次性特效：`ED`

`ED` 是"事件名 → 处理函数"的映射（起手、命中、落地那一下）。函数本身写在内核里（要读单位、
朝向、命中数量等上下文），所以这里只做**挂接**：

```ts
import { registerVfxHandler } from './extensions/api'
registerVfxHandler('myhero_s1_cast', (fx, ev, power) => { ... })
```

## 事件名约定（重要）

- 普攻：`atk_<hero>_swing` / `atk_<hero>_hit`
- 技能：`cast_<hero>_s1|s2|ult`、`fx_<hero>_...`、`area_<hero>_...`
- 通用：`death_*`、`kill_*`、`levelup_player`、`coin*`、`buy`

音效与特效靠**同一个事件名**对齐，名字对上了不需要额外接线。
