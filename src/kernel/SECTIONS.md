# 内核分区索引（starfall.core.js）

> **导航以符号名为准，不要信行号。** 行号会随每次改动漂移；旧版索引曾因漂移严重误导切片判断（把粒子特效当成音频引擎）。
> 采集日期 2026-11-18，锚点行号仅供快速定位，改动后请用 `grep -nF '符号'` 重新确认。

## Three.js 已改用官方 npm 包（2026-11-18）

> **最重要的结构事实**：内核里原先内联了 **Three.js r180 的 tree-shake 版本（16,364 行）**，
> 现已删除并改为 `import { ... } from 'three'`（`package.json` 锁定 `three@0.180.0`）。
> 导入时保留压缩短别名（`Vector3 as dt`、`Color as Ut` …），因此其余游戏代码零改动。

- 判定依据与映射方法见 `docs/04-Starfall-Three库识别与替换方案.md`。
- 替换后 core：67,639 → 51,410 行。
- **同时删除的 11 个"伪游戏模块"**（它们其实是 Three.js 内部代码，此前命名全错）：
  `audio-constants.js`（three 常量 149 个）、`matrix3.js`（Matrix3）、`triangulation.js`（Earcut）、
  `shader-utils.js`、`gl-buffer.js`、`vector-utils.js`、`vector-math.js`、`geo-utils.js`、
  `hero-models-data.js`、`curve-data.js`、`pathfinding.js`（实为 `WebGLUniformsGroup`）。
- **游戏运行期会改写 three**：`ShaderChunk.tonemapping_pars_fragment` 被替换为自定义色调映射
  （`$M()`，启动即执行）。该补丁在官方 r180 上已验证生效（`engine-smoke` 有断言）。

## 已物理抽出（真正的游戏代码，独立文件）

> **`models.js`（6,746 行）：程序化模型层**——14 个模型构造器（fO 四足巨兽 / CU 持弓 / SU 持剑 / SX+XY 项羽 / zU 持盾 / VU 法系 / MO 法阵 / JU·KU·Ec 建筑道具）+ 94 个专用辅助与配色；由 `tools/extract-models.cjs` 自动抽取（保持声明文本与顺序），core 从其中导入 14 个构造器。

> **`svg-icons.js`（594 行）**：SVG 图标与 UI 主题色（`UI_THEME_COLORS` + 界面图标/徽记）。

> 另有 `arena-palette.js`（竞技场配色 Yt/aL/yl/BM/HM/fs，6 个声明 AST 等价）

| 内容 | 文件 | 备注 |
|---|---|---|
| 数值平衡（13 个表/函数） | `game-balance.js` | `MINION_STATS`/`TOWER_STATS`/`CORE_STATS`/`MONSTER_STATS`/`WAVE_SCHEDULE`/`TOWER_RULES`/`JUNGLE_RULES`/`ECONOMY`/`VISION_RANGES`/`LATE_GAME_SCALING`/`xpToNext`/`heroRespawnSeconds` |
| 音效合成原语（19 个） | `sfx-synth.js` | `sfxSwingWhoosh`/`sfxStringDraw`/`sfxFmImpact`/`sfxExplosion`/`sfxChordPad`/`sfxLowThud`/`sfxGlassChime`/`sfxSustainedWind`/`sfxFormantChant`/`sfxPitchDropHit`/`sfxDeepBoom`/`sfxNoiseSnare`/`sfxTripleTap`/`sfxNoiseHiss`/`sfxClickTick`/`sfxBrightPing`/`sfxMetalRing`/`sfxNoiseWhoosh`/`sfxBellTone` |
| 装备数据表（已语义化重命名） | `equipment.js` | `ItemTable` 等 8 符号 |
| AI 难度预设 | `ai-difficulty.js` | `AI_DIFFICULTY_PRESETS`（novice 等档位） |
| AI 战术参数 | `ai-tactics.js` | `HERO_AI_PERSONALITY`/`AI_TUNING`/`SKILL_SLOTS`（已语义化） |
| 合成器声部 | `synth-voice.js` | `SynthVoice` |
| 通用节点树 | `node-tree.js` | `NodeTree`（音频与骨架共用层级容器） |
| 单位骨架构建 | `skeleton.js` | `buildSkeleton` |
| 战斗音效映射 | `attack-sfx-map.js` | `HERO_ATTACK_SFX`/`HERO_HIT_SFX`/`PROJECTILE_LAUNCH_SFX`/`PROJECTILE_HIT_SFX`/`AREA_SFX`/`MONSTER_KIND`/`ANNOUNCE_PRIORITY` 等 |
| 粒子精灵 | `particle-sprite.js` | `ParticleSprite` |
| 画质预设 | `quality-presets.js` | `QUALITY_PRESETS`（low/medium/high 三档） |
| 后处理着色器 | `postfx-shader.js` | `POSTFX_FRAGMENT` |
| Bloom 着色器 | `bloom-shaders.js` | `FULLSCREEN_VERT`/`BLOOM_PREFILTER_FRAG`/`BLUR_FRAG`/`BLOOM_COMPOSITE_FRAG`/`BLOOM_LEVELS`/`BLOOM_LEVEL_WEIGHTS` |
| 粒子图集与缓动 | `particle-atlas.js` | `ATLAS_COLS/ROWS/CELL_SIZE`、`PARTICLE_KIND`(40 种)、`clamp01`/`smoothstep`/`TWO_PI` |
| 单位模型配置 | `unit-model-config.js` | `UNIT_PALETTE`/`RIG_PROPORTIONS`/`UNIT_MODEL_SCALE`/`UNIT_CAPSULE`/`DEG2RAD` |
| 场景天空配色 | `scene-sky-palettes.js` | `SCENE_SKY_PALETTES`（菜单/胜利/失败三套） |
| HUD 样式 | `ui/hud-styles.js` | `HUD_STYLE_ELEMENT_ID`/`HUD_FONT_STACK`/`HUD_CSS`/`HUD_LOGO_SVG` |

### 音频子系统（2026-11-19 批次 2，全部迁出 core）

音频原先是 core 的第 1–3,530 行（3,5xx 行），现已按「数学基底 → 合成原语 → 音效表 → 声部/引擎 → 音乐 → 播报 → 总控」的依赖方向拆成 8 个文件，依赖单向、无环：

| 文件 | 行数 | 内容 |
|---|---|---|
| `audio/audio-math.js` | 164 | `It`(MIDI→Hz) / `Ur`(频率夹紧) / `Km`+`AS`(滤波补偿) / `NoiseGenerator`（确定性噪声，白/粉/棕三色） |
| `audio/sfx-primitives.js` | 465 | 振荡器/噪声/FM 的薄封装（`Or`/`ja`/`Ty`/`Hc`/`Ti`/`Si`/`W0`/`Od`/`c5`/`th`/`El`/`Fc`…）+ **音效定义 DSL `defineSfxCue`** |
| `audio/sfx-cues.js` | 1,500 | 英雄技能音效表 `GS`(51 条) 与状态/系统音效表 `XS`、`buildSoundBank` 产物 `FS`、音符表、`__registerSound*` |
| `audio/sound-voice.js` | 165 | `SoundVoice` —— 单个合成器声部（包络/调制/滤波） |
| `audio/sfx-engine.js` | 205 | `SfxEngine` —— 事件→声部分派、限流、空间化；`cm`(和弦分桶) 已归还音乐层 |
| `audio/music.js` | 547 | `MusicTrackBpm66/100/108/132` + `MusicDirector`（场景切换/淡入淡出） |
| `audio/speech-announcer.js` | 102 | `SpeechAnnouncer` —— 战况播报排队与优先级 |
| `audio/audio-mixer.js` | 598 | `AudioMixer` —— 总线/压缩/混响/音量静音/首次手势解锁（`zT()` 为唯一入口） |

配套的两个非音频模块（音频表依赖它们，故一并归位）：

| 文件 | 内容 |
|---|---|
| `src/heroes/registry.js` | `HERO_IDS` / `HERO_TABLE` —— 英雄表快照（原 core 的 `kr`/`Se`，运行期只读，已验证无任何写入点） |
| `kernel/skills/skill-values.js` | `Nh`(取技能值) / `lm`(槽位计数) / `US`+`Cy`(描述渲染) / `f5`(等级成长) / `ea`(召唤师技能) / `z0`(英雄显示名) / `SKILL_EFFECT_KINDS` / `eh` |

**音频层语义化（2026-11-19 批次 2 附）**：14 个合成原语与 6 组泛音列全部改成语义名——
`Or→playLowThud`、`ja→playMetalClash`、`Ty→playWarHorn`、`Hc→playDrumHit`、`Ti→playNoiseSweep`、
`Si→playPluckedString`、`Zm→playStringNote`、`NS→playReedCall`、`W0→playBambooFlute`、`Od→playPluckLead`、
`c5→playMonsterGrowl`、`th→playImpactTick`、`El→playSlashHiss`、`Fc→playDistortedBoom`；
`i1/CS/Tl/ga/pl/Sy/Jd→BELL/METAL/GLASS/CHIME/CRYSTAL/CLASH/DRUM_PARTIALS`；
`LS→MELODY_BASE_MIDI`、`PS→TEAM_VARIANTS`、`a1→UI_CUE_DEFAULTS`、`DS→FANFARE_MELODIES`、
`yi→makeAnnounceCue`、`zS→ANNOUNCE_CUES`、`ky→snapToScaleTone`、`IS→playFanfareMelody`（206 处，α 等价已验）。
**注意**：`buildSoundBank({ Ti, Hc, ... })` 的键名是 `src/audio/definitions` 的解构契约，必须保持原压缩名，
只改值 → 已展开为 `Ti: playNoiseSweep` 形式（简写属性会被改名器连带改键，这是踩过的坑）。

### 世界/导航层（2026-11-19 批次 3，纯几何部分已迁出）

| 文件 | 行 | 内容 |
|---|---|---|
| `world/geometry-2d.js` | 34 | `isPointInPolygon` / `distanceToPolygonEdge` / `pointSegmentDistance` |
| `world/map-geometry.js` | 166 | `MapGeometry`（高度场、墙体/草丛/营地多边形）、`WATER_LEVEL`/`TERRAIN_PALETTE_INDEX`/`TOWER_PAD_RADIUS`/`BASE_PAD_RADIUS`/`MAP_GRID_HALF_EXTENT` 等常量、`polygonBounds`/`signedDistanceToPolygon`/`paintSegmentIntoGrid` |
| `world/nav-grid.js` | 384 | `NavGrid`（距离场 + 加权 A*，`NAV_CELL_SIZE`/`NAV_HEURISTIC_WEIGHT`/`NAV_MAX_EXPANSIONS` 等全部语义化）、`buildNavBaseField`、`pointHitsAnyCircle`/`capsuleHitsAnyCircle` |
| `world/lane-progress.js` | 102 | `PolylineProjector`（世界坐标↔车道进度）、`LANE_NAMES`、`LaneProgress`、`getLaneProgress`（WeakMap 缓存） |

**场景搭建器迁出状态**：`buildPropLibrary`/`buildRandomProp`/`buildSceneryProps`/`buildShrineScenery`
等较早批次已迁出；**`buildWorldStaged` 于 2026-11-20 三大闭包批次迁到 `world/world-builder.js`（1,981 行）**——
先用 `expand-closure.cjs` 递归纳入其依赖闭包（58 组声明 / 83 符号，闭包外 core 逃逸 0），再整组抽取，避开双向环。
`trackEpicObjectives`（sim 战术逻辑）、`TeamAi`（AI 决策）仍属 sim 层，待后续批次处理。

> 现存 **146 个模块** + core（**436 行，已是薄入口**：142 import / 4 export / 仅 2 个 glue 函数）。
> 薄入口批次完成时的验证：`tsc` 0 error、`audit-all-modules` 0 问题、`check-import-surface` 全通过（扫描 172 个模块）、`check-unbound-core-refs` 0 漏绑（145 模块）、`check-vfx-templates` 8/8、引擎冒烟 32/32、`npm run build` 成功（172 模块内联）、有界面 Playwright 进对局 0 pageerror（`sounds = 45, vfx = 8`，6/6 模型动画、24/24 图标、6/6 雷达，canvas 1440×900）。
> **core 剩余 2 个顶层声明** `__registerHeroTables`/`__installActionHandlers` 是「数据驱动加英雄」的入口 glue，按设计留在 core，不再外拆。

### FX / 粒子系统层（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `fx/fx-definitions.js` | — | `ObjectPool` / `SeededRandom` / `VFX_COLORS` / `FX_SHAPES` / `FX_STYLES` / `hexToColor` / `applyVertexColors` |
| `fx/emitters.js` | — | `VFX_EMITTERS` / `HIT_FEEDBACK_TUNING` / `TrailBuilder` / `AreaEffectView` / `emitHitSparks` / `emitGroundImpact` / `emitSparkBurst` / `emitDustPuff` / `emitPillarGlow` |
| `fx/vfx-system.js` | — | `VfxSystem` / `IconBatch` / `SKILL_VISUALS` / `QUALITY_VFX_BUDGETS` |
| `fx/particle-system.js` | 669 | `ParticleSystem` / `TargetIndicatorView` / `colorToRgb` / `lerp3` / `scale3`；core `27,878 → 27,253` 行 |

**粒子系统语义化（160 处，`tools/rename-maps/2026-11-19-particle-system.json`）**：
`Mn→lerpScalar`、`ci→smoothStepScalar`、`g8→clamp01Scalar`、`gs→hashBucket`、
`ep→scratchVecA`、`cd→scratchVecB`、`r_→scratchMat3`、
`li/Ir/x8/Ix/l_→BUCKET_LOW/MIN/MID/HIGH/MAX`、`Lx→SIGN_NEGATIVE`。
注意 `particle-system.js` 使用了 core 的 `buildClassicMap`，已补 `import { buildClassicMap } from '../../world/map/classic'`（实际文件为 `.ts`，无 `.js` 后缀）。

### 战斗事件视觉簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `render/unit-skill-fx.js` | 666 | `BATTLE_EVENT_VFX`（战斗事件→handler 表）、`PANYUE_SKILL_VFX`（盘月技能视觉表）、`PANYUE_VFX_PALETTE` / `XINGLI_VFX_PALETTE`、死亡/命中/回城/升级等 handler、工具函数；core `27,253 → 26,616` 行 |

本项目语义化 **188 处**（`tools/rename-maps/2026-11-19-unit-skill-fx.json`，双向 α 等价已验）：
`xD→BATTLE_EVENT_VFX`、`ED→PANYUE_SKILL_VFX`、`nD→playPhysicalHitFx`、`sD→playMagicHitFx`、
`iD→playCritHitFx`、`rD→playShieldBreakFx`、`oD→playHealFx`、`yD→playHeroDeathFx`、`vD→playMinionDeathFx`、
`bD→emitMeleeSlashFx`、`He→PANYUE_VFX_PALETTE`、`Pn→XINGLI_VFX_PALETTE`、`Ex→emitMoteBurst`。
core 侧 54 处引用同步改名（import 的 8 个导出符号）；**对外 export 别名 `PANYUE_SKILL_VFX as VfxEventHandlers` 保持不变**。
抽取时踩坑复现：新模块漏 import `HERO_TABLE`（第 6 道闸门抓到），已补 `import { HERO_TABLE } from '../../heroes/registry.js'`。

### 战斗模拟核心簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `sim/combat-core.js` | 861 | 施法 handler 注册表（`CAST_HANDLERS` / `registerCastHandler` / `getCastHandler`）、状态效果与区域（`spawnArea`/`endArea`/`tickCrowdControl`）、目标筛选（`canTarget`/`isTargetable`/`isStructure`）、单位创建与寻路（`createBaseUnit`/`moveTowards`/`teleportUnit`）；core `26,616 → 25,824` 行 |

本项目语义化 **232 处**（`tools/rename-maps/2026-11-19-combat-core.json`，双向 α 等价已验）：
`tm→CAST_HANDLERS`、`Oi→registerCastHandler`、`ly→registerWildcardHandler`、`Wk→getCastHandler`、
`Zo→spawnArea`、`O3→endArea`、`Xk→cancelArea`、`Ss→isStructure`、`Ui→canTarget`、`Bm→faceTowards`、
`eu→startAction`、`zd→setAnimation`、`em→isSummonerSpell`、`jk→SUMMONER_SPELL_SPECS`、
`Qh/Jh/Fm→MOVE_IDLE/MOVE_DIRECTION/MOVE_PATH`（`Fm` 仅模块内用，未导出）。
**遮蔽跳过**：`dy`（core 有同名局部变量），改名器自动拒绝，保留短名。
core 侧 129 处引用同步改名（import 的 48 个符号）。
**冒烟测试升级**：`engine-smoke.cjs` 新增单独 bundle `combat-core.js` 并直测 handler 注册往返/通配回退/目标判定/移动模式，**23 → 32 项**（全绿，仍无浏览器/GPU）。
有界面 Playwright `check-skill.py` 验证项羽 Q 位移正常（法力 430→385、CD 7.7s、0 pageerror）。

### 单位视觉表簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `render/unit-visual-effects.js` | 496 | 杏里/夜雀技能视觉表（`XINGLI_SKILL_VFX` / `YEQUE_SKILL_VFX`）、总合并表 `ALL_UNIT_VFX`、`UnitVisualView`、状态特效工厂（`makeSigilEffect` 等）；core `25,824 → 25,354` 行 |

语义化 **138 处**（`tools/rename-maps/2026-11-19-unit-visual-effects.json`，双向 α 等价已验）：
`PD→XINGLI_SKILL_VFX`、`HD→YEQUE_SKILL_VFX`、`$D→ALL_UNIT_VFX`、`Ci→YEQUE_VFX_PALETTE`、
`oi→accumulateSteps`、`Ks→holdDecalSlot`、`Vb→sinePulse`、`Wb→makeSigilEffect`。

**抽取工具加固（本批次，`tools/extract-symbols.cjs`）**：根治两个反复踩的坑——
① `importSrc` 现接受 `../` 开头的源（`HERO_TABLE` 来自 `../heroes/registry`，之前被 `./` 前缀过滤导致每批都要手工补）；
② 生成 import 时按输出目录相对 `src/kernel/` 的层级**自动重算路径**（抽到 `render/`/`sim/` 子目录不再手工修 `./`→`../`）。
5 组路径重算自测通过，后续批次应直接受益。

**改名映射教训**：`playYequеS1Fx` 曾混入西里尔字母 `е`（U+0435），语义化映射写完后必须用 node 校验全 ASCII，否则会生成伪装成 ASCII 的标识符。

### 状态特效表簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `render/status-effect-fx.js` | 505 | 状态特效定义表 `STATUS_FX_DEFS`（stun/airborne/root/shield/burn/各类英雄 buff 共 22 种）、`STATUS_FX_KEYS` / `STATUS_FX_INDEX`；core `25,354 → 24,865` 行 |

语义化 11 处（`tools/rename-maps/2026-11-19-status-effect-fx.json`）：`d8→STATUS_FX_DEFS`、`az→STATUS_FX_KEYS`、`oz→STATUS_FX_INDEX`。
**遮蔽验证**：core 里另有 `oz` 对象属性（`k.oz`、`{ ox, oz }`），改名器正确只改标识符引用、不碰属性名与 key（α 等价双向通过）。
**工具加固首次见效**：本批 import 路径（含 `../fx/`、`./unit-visual-effects.js`、`../particle-atlas.js`）全部由 `extract-symbols.cjs` 自动生成正确，无需手工修。

### 选英雄界面样式簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `ui/hero-select-styles.js` | 241 | 技能槽中文名/快捷键映射、选英雄界面 CSS（`HERO_SELECT_CSS`）、`formatRangeLabel`；core `24,865 → 24,637` 行 |

语义化 27 处（`tools/rename-maps/2026-11-19-hero-select-styles.json`）：`I2→SKILL_SLOT_LABELS`、`MH→SKILL_KEY_BINDINGS`、`kH→SKILL_SLOT_KEYS`、`TH→HERO_SELECT_CSS`、`A4→formatRangeLabel`。
抽取工具按输出目录自动把 import `expandCssUnits` 定位到同目录 `./dom-kit.js`（无需手工修）。

### 技能评估簇（2026-11-19 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `sim/skill-evaluation.js` | 648 | 玩法规格表 `HERO_ACTION_SPECS`、施法取值（`skillValue`/`skillRange`/`makeDash`/`makeDamage`）、AI 战斗收益估算（`effectiveHp`/`expectedDps`/`estimateTimeToKill`）；core `24,637 → 24,057` 行 |

语义化 **286 处**（`tools/rename-maps/2026-11-19-skill-evaluation.json`，双向 α 等价已验）：
`ze→skillValue`、`k1→skillRange`、`d0→makeDash`、`Gi→makeDamage`、`$a→getSkillValueRaw`、
`bi→buildActionSpec`、`Oa→HERO_ACTION_SPECS`、`Bt→scratchPoint`。
**内部短名对齐对外语义名**：core 里原本就导出 `ze as skillValue` 等别名，本次把内部名也改成 `skillValue`，export 变成冗余但合法的 `skillValue as skillValue`（导出名不变，契约安全）。
冒烟 32/32 中的 `skillValue`/`makeDash`/`makeDamage` 三项正好直测本簇；有界面 Q 技能释放正常（法力 430→386、CD 7.4s）。

### 单位状态簇（2026-11-20 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `sim/unit-stats.js` | 491 | 冲刺状态（`endDash`/`interruptDash`/`updateDash`）、金币经验（`grantGold`/`grantXp`/`levelUpUnit`）、属性重算（`recomputeStats`）、野怪营地（`initJungleCamps`/`spawnCamp`）；core `24,057 → 23,609` 行 |

语义化 75 处（`tools/rename-maps/2026-11-20-unit-stats.json`，双向 α 等价已验）：
`Zk→endDash`、`iu→interruptDash`、`py→updateDash`、`D0→grantGold`、`nm→grantXp`、
`_o→recomputeStats`、`bW→levelUpUnit`、`RW→spawnCamp`、`w6→pruneDeadUnits`。

### buff 视图与网格构建器簇（2026-11-20 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `render/buff-view.js` | 475 | `UnitBuffView` 类、`MeshBuilder` / `CellGeometryBuilder`（three 网格构建）、`createVisualKit`、多边形工具 `polygonArea` / `polygonCentroid`；core `23,609 → 23,163` 行 |

语义化 28 处（`tools/rename-maps/2026-11-20-buff-view.json`，双向 α 等价已验）：
`lz→pickStrongestBuff`、`Jr→FOCUS_DISTANCE`、`cz→createVisualKit`、`Qz→polygonArea`、`xf→polygonCentroid`。
抽取自动生成 three 别名 import（`BufferAttribute as On` 等 6 个）+ 11 个模块来源，路径全部正确。

### 植被着色器簇（2026-11-20 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `render/vegetation-shaders.js` | 295 | 植被顶点/片元 GLSL 源码 `VEGETATION_VERTEX_SHADER` / `VEGETATION_FRAGMENT_SHADER`、怪物地形配色 `MONSTER_TERRAIN_PALETTE`；core `23,163 → 22,881` 行 |

语义化 12 处（`tools/rename-maps/2026-11-20-vegetation-shaders.json`，双向 α 等价已验）。
**切片方法论修正**：`plan-clusters.cjs` 按**行号**判断逃逸，遇到大型 GLSL/CSS 模板字符串会失准（报「0 逃逸」但实际切在字符串中间）。改用 `plan-layers.cjs` 的**符号组** + `extract-symbols.cjs` dry-run 逐个核验，批量扫描 43 组后仅 7 组真正零逃逸。后续切片以符号组为准，不信行号簇的逃逸数。

### HUD 商店样式簇（2026-11-20 最新批次）

| 文件 | 行 | 内容 |
|---|---|---|
| `ui/hud-shop-styles.js` | 289 | 两套 HUD/商店响应式 CSS（`HUD_SHOP_CSS_BASE` / `HUD_SHOP_CSS_COMPACT`）、装备分类表 `ITEM_CATEGORY_ORDER`/`ITEM_CATEGORY_LABELS`、toast 时间常量；core `22,881 → 22,607` 行 |

语义化 48 处（`tools/rename-maps/2026-11-20-hud-shop-styles.json`，双向 α 等价已验）：
`K4→HUD_SHOP_CSS_BASE`、`_G→HUD_SHOP_CSS_COMPACT`、`wG→ITEM_CATEGORY_ORDER`、
`Y2→TOAST_HOLD_SECONDS`、`EG→HUD_COMPACT_BREAKPOINT_PX`、`Z4→itemBrief`。

### 样式与着色器批量簇（2026-11-20，一次 14 组）

用「符号组 + extract-symbols dry-run」批量扫出 14 个真零逃逸组并一次抽取，模块 63 → 77、core `22,607 → 21,247` 行：

| 目录 | 模块（内容） |
|---|---|
| `ui/` | `hud-controls-styles`（技能键位表/HUD 技能 CSS）、`result-screen-styles`、`hud-stat-styles`、`death-overlay-styles`、`hud-banner-styles`、`svg-icon-assets`（SVG logo/brand）、`loading-screen-styles`、`scoreboard-styles`、`hud-sidebar-styles`、`hint-card-styles` |
| `render/` | `particle-shaders-extra`、`instance-shaders`、`terrain-decal-shaders`、`geometry-utils`（`buildInterleavedFloatAttribute`） |

语义化 **206 处**（`tools/rename-maps/2026-11-20-hud-batch.json`）：`A3→SKILL_SLOT_ORDER`、`N2→SKILL_KEY_LABELS`、
`f$→HUD_SKILLS_CSS`、`NH→SVG_LOGO_DATA_URI`、`VO→INSTANCE_VERTEX_SHADER`、`EF→TERRAIN_DECAL_VERTEX_SHADER`、
`TF→buildInterleavedFloatAttribute` 等。
**15 个文件（core + 14 模块）逐一 α 等价通过**；全 104 模块闸门 / tsc / 冒烟 32/32 / build / 有界面点检（CSS 与 GLSL 均未误伤）全绿。

### 零散小簇（2026-11-20，10 组）

再扫出 11 个 ≤71 行的零逃逸组，抽出 10 个（`oy` 因抽出后依赖变化失败，保留在 core，仅 1 小函数）：

| 目录 | 模块 |
|---|---|
| `world/` | `river-geometry`（`buildRiverMesh`） |
| `render/` | `instance-batch`（`InstanceBatch`）、`unit-attribute-shaders`、`water-shaders`、`model-parts`（`buildButtress`）、`fog-shaders` |
| `ui/` | `howto-styles`、`svg-path-assets`、`hud-zindex-styles` |
| `fx/` | `fx-helpers`（`buildArenaDecor`） |

语义化 58 处（`tools/rename-maps/2026-11-20-small-batch.json`）：`dU→buildRiverMesh`、`DN→buildButtress`、
`SF→buildArenaDecor`、`VF→WATER_VERTEX_SHADER`、`fF→FOG_VERTEX_SHADER` 等；10 文件逐一 α 等价通过。
模块 77 → 87、core `21,247 → 20,738` 行；全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿。

### 闭包依赖簇（2026-11-20，拆解互相依赖的硬骨头）

**新增工具 `tools/expand-closure.cjs`**：给定种子顶层符号，递归纳入它依赖的所有 core 顶层声明，直到闭包自包含（逃逸 0），输出完整抽取符号列表。这是拆解剩余「互相依赖组」的正确方法——单独抽会逃逸 N 个 core 符号，把逃逸符号一起纳入闭包即可整体搬走。

抽取 4 个闭包组（core `20,738 → 19,446` 行，模块 87 → 91）：

| 文件 | 内容 |
|---|---|
| `ui/banner.js` | 击杀/连杀横幅（`createBanner` + 14 个依赖） |
| `render/fx-sprite.js` | FX 精灵姿态（`buildFxSpritePose` / `applyPose` / `lerpNumeric` 等） |
| `ui/hud-panels.js` | HUD 面板集合（`createHudPanel` 等） |
| `ui/match-flow.js` | 对局流程控制（`MatchFlow` 类 + 机器人调参） |

语义化 **299 处**（`tools/rename-maps/2026-11-20-closure-batch.json`）：`Fi→lerpNumeric`（线性插值，初误判为 bone map 已纠正）、`hr→distance2DSquared`、`Ml→HERO_ID_LIST`、`FU→buildFxSpritePose`、`QH→createHudPanel` 等。
**5 文件（core + models.js + 4 模块）逐一 α 等价通过**。
**踩坑**：`$$` 符号在批量脚本里被 core import 误写成 `$`（shell/正则把 `$$` 当特殊字符），已手工修正为 `import { $$ }`。
**竞态教训**：闭包扩展 + 抽取必须**串行**——批量脚本里 FU/QH 抽取改变了 core，导致后续 MatchFlow 闭包基于旧状态而失败；逐个重算后成功。

### 三大闭包抽取（2026-11-20，core 8,300 → 5,053 行）

三个互相依赖的大闭包，均先 `expand-closure.cjs` 重算闭包确认「闭包外 core 逃逸 0」，再串行逐个抽取（避免竞态）：

| 文件 | 行数 | 闭包规模 | 内容 |
|---|---|---|---|
| `world/world-builder.js` | 1,981 | 58 组声明 / 83 符号 | `buildWorldStaged` 完整场景搭建器（地图/河道/植被/建筑道具装配）；three 23 + 其它模块 27 来源，core 0 依赖 |
| `sim/simulation.js` | 1,178 | 58 组声明 / 75 符号 | `Simulation` 主模拟闭包（对局状态机、单位/技能/经济/胜负循环）；其它模块 14 来源，core 0 依赖 |
| `ships/skeleton-solver.js` | 2,230 | 63 组声明 / 93 符号 | `SkeletonSolver` 骨架求解器（骨骼层级/姿态/IK）；three 23 + 其它模块 28 来源，core 0 依赖 |

模块 136 → 139。三块抽取后 core 仅剩 `UU/jU/AU/XY/PU` 大 fx 闭包、`render` 大闭包 `gB`、`createUnitViews`、
`__makeGenericCastHandler`、`startMatch`、`bootApp` 与少量 glue。语义化映射留待后续（拆完再统一做）。
验证：`tsc` 0 error、`check-import-surface`（166 模块）、`check-unbound-core-refs`（139 模块 0 漏绑）、
`audit-all-modules` 0 问题、引擎冒烟 32/32、有界面 Playwright 进对局 0 pageerror。

### 核心运行块 + 薄入口收尾（2026-11-20，core 5,053 → 436 行）

按 `expand-closure` 串行抽完所有剩余大闭包，再切走纯数据/副作用块，core 收敛为薄入口：

| 文件 | 行数 | 内容 |
|---|---|---|
| `render/hero-preview.js` | 1,725 | `gB`→`createHeroPreview` 闭包（84 符号）：选英雄界面 3D 预览渲染 + 全套 fx 动画工具（含 UU/AU/PU/jU/XY） |
| `sim/match-lifecycle.js` | 1,213 | `startMatch` 闭包（55 符号，含 `createUnitViews`）：对局启动/单位视图装配 |
| `core/boot.js` | 947 | `bootApp` 闭包（52 符号）：应用启动 + `FrameStats`/`StatsCollector`/`finishBoot` |
| `sim/generic-cast-handler.js` | 272 | `__makeGenericCastHandler` 闭包（20 符号）：数据驱动通用施法 handler |
| `render/geometry-helpers.js` | 192 | 30 个几何/骨骼纯工具（`Ds`/`_a`/`YU`/`Bj`/…） |
| `sim/passive-registration.js` | 550 | 六英雄 passive 注册副作用块（`slice-block` 按行切 L353-895）+ 装备/通用 passive |

**注意（副作用块切片的坑）**：`passive-registration.js` 用 `slice-block.cjs` 按行切，工具**不传递 import 绑定**——
切完新模块缺 45 个符号的 import（HERO_TABLE/tu/isStructure/…），且误带一行尾部的 `ui/hud-styles.js` import（路径错）。
修法：删残留行 → 按 core 的 import 索引反查每个符号的源模块 → rebase 路径后补 import。
执行时序：core 顶部 `import './sim/passive-registration.js'` 保证 passive 注册先于 `bootApp()`（ESM 副作用顺序），
有界面点检已验证 6/6 英雄技能/模型/音效正常、0 pageerror。

模块 139 → 146，core 5,053 → 436。全闸门 / tsc / audit / import-surface / unbound / vfx 8/8 / 冒烟 32/32 / build / 有界面点检全绿。

### 持续瘦身体（2026-11-20，10 组，core 9,522 → 8,300 行）

模块 126 → 136：`map-nav-utils`（world）、`unit-poses-extra3`/`line-batch`/`toon-material-factory`（render）、
`dom-snapshot`（ui）、`random-props`（world）、`effect-geometry`/`effect-spawner`（fx）、`skill-cast`/`combat-behavior`（sim）。
全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿（拆解 checkpoint）。

### 核心瘦身体（2026-11-20，10 组，core 13,105 → 9,522 行，首次跌破万行）

模块 116 → 126：
- `render/`：`unit-poses-extra2`、`canvas-factory`
- `ships/`：`team-base-variant`
- `sim/`：`game-loop`（游戏主循环）、`hero-agent`（英雄代理决策）
- `world/`：`geometry-projection`、`scenery-props`
- `fx/`：`fx-enums`、`fx-random`
- `ui/`：`hud-root`

全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿（拆解 checkpoint，语义化另行）。

### 闭包再批量簇（2026-11-20，12 组，core 15,981 → 13,105 行）

继续用闭包工具拆解，模块 104 → 116：
- `render/`：`unit-poses-extra`（姿态补充）、`texture-factory`（纹理生成）
- `ui/`：`scoreboard-panel`、`hud-arrows`、`shop-panel`、`input-controls`、`coach-panel`
- `fx/`：`fx-batch`（特效批绘制）、`sim/`：`hero-engage`（英雄交战决策）
- `world/`：`grid-a`/`grid-b`/`grid-c`（地图网格工具）

全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿（拆解 checkpoint，语义化另行）。

### 闭包批量簇（2026-11-20，14 组，core 19,446 → 15,981 行）

用 `expand-closure.cjs` 批量拆解剩余互相依赖组，模块 91 → 104：

| 目录 | 模块 |
|---|---|
| `render/` | `unit-poses`（骨骼姿态）、`fx-sprite` 已述 |
| `sim/` | `team-ai`（`TeamAi` + 机器人调参）、`epic-objectives`（史诗目标追踪） |
| `ui/` | `minimap-widgets`、`minimap`、`status-strip`、`skill-bar`、`rh-widget` |
| `world/` | `tf-system`、`po-system` |
| `ships/` | `yw-component`、`zu-component`、`qu-component`（部件模型） |

**工具两处加固**：
① `expand-closure.cjs` 扩展闭包时排除 core 已 import 的符号（否则误把「已抽到其它模块的符号」当 core 声明纳入）；
② `extract-symbols.cjs` 生成 needCore import 时也 rebase 路径（抽到 `sim/` 时 `./starfall.core.js` → `../starfall.core.js`，曾导致 `epic-objectives.js` 路径错误、冒烟崩溃）。
**批量脚本坑**：符号列表含 `$`（如 `$x`）时用 `execSync` 字符串形式会被 shell 变量展开吞掉，必须逐组手动跑或传数组参数。
全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿（此批为拆解 checkpoint，语义化另行提交）。

**闭包批次语义化（同日续）**：`tools/rename-maps/2026-11-20-closure-batch2.json` **385 处**（14 文件逐一 α 等价）：
`TU→applyDeathPose`、`ck→skillTagLabel`（初误判 isBasicOrSkillSlot 已纠正）、`ty→skillTagHtml`、
`lk→hexToRgbString`、`vo→createTextWriter`、`Vn→createFormattedTextWriter`、`br→createCssVarWriter`、
`pO→buildTowerModel`、`Yw→buildTeamBaseModel`、`rs→hashNoise`、`jc→FULL_CIRCLE_RADIANS`。
**语义核对教训**：批量映射里的猜阴性名字必须逐个看函数体验证——本批纠正了 7 处误判（ck/ty/lk/vo/Vn/br/Yw）。
全闸门 / tsc / 冒烟 32/32 / build / 有界面点检全绿。
> 补 import 用 `tools/fix-missing-imports.cjs --write`（自动查导出模块并补齐）。

## 语义化重命名（2026-11-18 起，主人新要求）

主人要求：切出的类/函数/内部变量改用**符合业务语义的命名**。这是方案③（反混淆）的局部推进，
采用「**逐模块、作用域封闭、验证闭环**」策略，不做全局重命名。

- 已完成批次：
  - **1**：`equipment.js` 8 符号 → `ItemTable/ItemList/BaseAttackRange/CastFailMessage/formatPercent/LaneName/TowerName/formatTowerLabel`（core 84 处）
  - **2**：单位模型配置 `de/DU/xw/xd` → `UNIT_PALETTE/RIG_PROPORTIONS/UNIT_MODEL_SCALE/UNIT_CAPSULE`；`d4` → `SCENE_SKY_PALETTES`；`jG/se/J1` → `HERO_AI_PERSONALITY/AI_TUNING/SKILL_SLOTS`（192 处）
  - **9**：内核 19 个系统类（`DT→AudioMixer`、`TV→HeroAgent`、`wq→Simulation`、`RI→RenderSettings`、`WL→CameraRig` 等，62 处）
  - **10**：`L1→SoundVoice`、`bI→PostRenderer`、`dP→TrailBuilder`、`Be→MeshBuilder`、`sw→TransformStack`、`aP→ShapePool`、`om→RandomStream`、`XM→SeededRandom`、`Sq→GameLoop`、`RS→NoiseGenerator`、`Ky→MusicDirector`、`xI→PostTargets`（80 处）
  - **8**：19 个音效原语语义化（`Qi→sfxSwingWhoosh`、`zl→sfxStringDraw`、`en→sfxFmImpact`、`Q6→sfxExplosion`、`Nl→sfxChordPad`、`A0→sfxLowThud`、`J6→sfxGlassChime`、`wy→sfxSustainedWind`、`$3→sfxFormantChant`、`My→sfxPitchDropHit`、`Ym→sfxDeepBoom`、`Sl→sfxNoiseSnare`、`MS→sfxTripleTap`、`kS→sfxNoiseHiss`、`SS→sfxClickTick`、`TS→sfxBrightPing`、`rm→sfxMetalRing`、`tM→sfxNoiseWhoosh`、`Lo→sfxBellTone`，175 处）并从 `game-balance.js` 拆出到 `sfx-synth.js`（拆分前后 32 个声明 AST 逐项相等）
  - **7**：`constants-core.js`→`game-balance.js`，13 个数值表/函数语义化（`Y6→MINION_STATS`、`v0→WAVE_SCHEDULE`、`K6→TOWER_STATS`、`yr→TOWER_RULES`、`eo→CORE_STATS`、`Xm→CORE_RULES`、`yn→JUNGLE_RULES`、`rn→MONSTER_STATS`、`va→ECONOMY`、`Qd→LATE_GAME_SCALING`、`ui→VISION_RANGES`、`Z6→xpToNext`、`wS→heroRespawnSeconds`，187 处）
  - **6**：`j6/Tq/Eq/Aq` → `HUD_STYLE_ELEMENT_ID/HUD_FONT_STACK/HUD_CSS/HUD_LOGO_SVG`；`uI/pI/mI/gI/Hg/gb` → `FULLSCREEN_VERT/BLOOM_PREFILTER_FRAG/BLUR_FRAG/BLOOM_COMPOSITE_FRAG/BLOOM_LEVELS/BLOOM_LEVEL_WEIGHTS`（44 处）；文件改名 `hud-style-const→hud-styles`、`shader-snippet→bloom-shaders`
  - **5**：`Wa/Gh/fm/Sb/yI/zk` → `NodeTree/buildSkeleton/SynthVoice/ParticleSprite/POSTFX_FRAGMENT/AI_DIFFICULTY_PRESETS`（46 处）；文件改名 `audio-class→node-tree`、`audio-voice→skeleton`、`audio-instrument→synth-voice`、`sprite-class→particle-sprite`、`ui-template→postfx-shader`、`math-utils→ai-difficulty`
  - **4**：`attack-sfx-map.js` 10 符号 → `HERO_ATTACK_SFX`/`HERO_HIT_SFX`/`PROJECTILE_LAUNCH_SFX`/`PROJECTILE_HIT_SFX`/`AREA_SFX`/`MONSTER_KIND`/`isBossMonster`/`ANNOUNCE_PRIORITY`/`KILL_STREAK_EVENTS`/`MAJOR_EVENTS`；`xb` → `QUALITY_PRESETS`（54 处）；`ui-data.js`→`quality-presets.js`
  - **3**：粒子图集 `ji/ih/Xs` → `ATLAS_COLS/ATLAS_ROWS/ATLAS_CELL_SIZE`；`Ft` → `PARTICLE_KIND`；`Ve/Le/Ro` → `clamp01/smoothstep/TWO_PI`；`m0` → `DEG2RAD`（292 处）
- **文件也一并改名**（原名与内容不符）：`projectile-data.js`→`unit-model-config.js`、`vfx-data.js`→`scene-sky-palettes.js`、`ai-tactics-data.js`→`ai-tactics.js`、`terrain-const.js`→`particle-atlas.js`。
- 对外 export 别名不变（如仍导出 `ItemTable`），只是内部短名与对外语义名对齐；`X as X` 冗余写法合法，保留不额外改。
- **验证闭环（每次重命名必跑，全绿才可提交）**：
  1. `tools/rename-across.cjs <map.json> --dry` → 遮蔽检测 + 波及面预览（遮蔽会拒绝，除确认后加 `--force-shadow`）。
  2. `--write` 执行（自动备份原文件到 `.rename-backup/`）。
  3. `tools/verify-rename.cjs <backup> <now> <map.json>` → **α 等价验证**：把映射应用到旧文件 AST 后须与新文件逐字节一致，证明「只改名、逻辑零改动」。
  4. `tools/audit-all-modules.cjs` → 全模块引用审计 0 问题。
  5. `npx tsc --noEmit` + `npm run build`。
  6. `node tools/engine-smoke.cjs` → **引擎逻辑冒烟 18 项**（无浏览器/无 GPU/无渲染，stub DOM/WebAudio 后加载内核，读注册表+建图+造规格）。
- 工具已修的关键点：
  1. acorn-walk 不遍历 import/export specifier 子节点 → 重命名器与验证器都单独处理 `local/exported/imported`（否则 export 列表漏改 → ReferenceError）。
  2. acorn-walk 对 `Property` 只访问 `value`，**简写属性 `{ Ft }` 的 key 会被漏掉** → 验证器改为完整递归遍历（曾造成假阳性"α-等价失败"）。
  3. 查表必须 `Object.prototype.hasOwnProperty.call(mapping, name)` —— 否则 `map['constructor']` 会命中 `Object.prototype.constructor`（临时脚本踩过这个坑）。
- 产物体积：语义名变长，体积略增（第一批 +775 B），符合预期；不再是物理切片的「字节不变」。

## 不可切的死结已消失

原「shader 系统主块（~4000 行）切不动」的问题**已自动消解**——它本来就是 Three.js 内部代码，已随内联副本一并删除，改由官方包提供。

| 英雄数值表（6 座） | `../heroes/*.ts` | `Se = Object.assign({}, HERO_DATA)` |
| 音效定义库 | `../audio/definitions.ts` | core 内只剩 `FS = buildSoundBank({…})` |
| 特效模板 | `../vfx/templates.ts` | core 内只剩 `Pb = buildVfxTemplates({…})` |
| 地图数据 | `../world/map/classic.ts` | core 内有别名 `__MAP` |
| 扩展层 / bundle 机制 | `../extensions/`、`../bundles/` | 数据驱动加英雄，零改内核 |

## core 内分区（按符号导航）

| 内容 | 关键符号（搜这个） | 锚点行 |
|---|---|---|
| 音高/频率常量、波表 | `It` `RS` `L1` | 18 / 40 / 168 |
| 音效播放引擎（噪声、卷积混响、voice 池、空间衰减） | `Ny` `fm` `DT` | 2294 / 2481 / 3247 |
| 音频管理器工厂 | `zT` | 3823 |
| 数值取值 / 玩法规格读取 | `Nh` | 778 |
| 矩阵/向量数学类 | `dt` `Je` | ~4650 / 5116 |
| Three.js shader chunk 字符串链 | `SE` → `tn` | 11517 → 15197 |
| 后处理 / 场景类 | `zv` | 16038 |
| 模型注册表（key → builder，`qc()` 缓存） | `Gx` `qc` | 搜符号 |
| 装备表 | `ln` | 搜符号 |
| 技能图标 SVG + 注册表 | `$B` `XB` | 搜符号 |
| HUD / DOM 层 | `.sf-home` | 搜字符串 |
| 技能玩法规格表 `Oa` | `Oa` `bi` `Gi` | 搜符号 |
| **通用施法 handler 工厂**（重构新增） | `__makeGenericCastHandler` | 70103 |
| handler 安装器（重构新增） | `installActionHandlers` | 搜符号 |
| 英雄视觉表注入（重构新增） | `__registerHeroTables` | 70070 |
| 内核对外 export 块 | `^export {` | 文件末尾 |

## 记忆法

`Se`=数据 · `Oa`=玩法规格 · `Gx`=模型 · `Pb`/`ED`=特效 · `FS`=音效 · `XB`=图标 · `ln`=装备 · `kr`=英雄列表 · `tm`=施法 handler 表

## 切片作业规范（后续切片请遵守）

1. **先跑依赖分析**：`node tools/analyze-slice-deps.cjs <起> <止> <标签>`，确认跨边界符号数。
2. **只切单向依赖块**（段内→段外 = 0）：双向依赖块会产生循环 import + 顶层 const 的 TDZ 崩溃风险，不要按行号硬切。
3. **AST 精确抽取**：用 `tools/do-slice-constants.cjs` 的模式（acorn node.start/end），不要按行号切半截语句。
4. **行为等价验证**（无浏览器，遵守主人"不烧 GPU"约定）：切片前后对顶层声明做规范化 AST 序列化比对，须 100% 一致、零丢失、零重复声明；再跑 `tsc --noEmit` 和 `npm run build`。
5. **哈希验证（充分非必要）**：从**文件头** import 的模块，rollup 内联后产物 SHA256 与切片前字节一致（如切片 1 的 `a50ae478…`）；从**文件中部** import 的模块，rollup 会按依赖图把块内容提前内联，导致声明顺序变化、哈希改变但**产物大小不变**（如切片 2）。哈希一致可直接放行；**哈希变了不等于逻辑变了**，按第 6 步复核。
6. **哈希变化时的复核**：① 全顶层声明规范化 AST 比对须 100% 一致、零丢失；② 提取产物内联 JS 跑 `node --check`；③ 确认被提前的函数引用的是同块符号/内置函数、不引用尚未初始化的顶层 `const`（无 TDZ 风险）；④ 确认导出符号在产物中全部存在。四项全过才可提交。
7. **多切片后必做全模块审计**：`node tools/audit-all-modules.cjs`。关键教训——`analyze-slice-deps.cjs` 只扫单文件，切片多次后符号已移到别的模块，它检测不到跨模块引用。实测教训：`vector-utils.js` 的 `oR` 引用 `audio-constants.js` 的 `W3`、`shader-utils.js` 引用 50 个音频常量、`vector-math.js` 引用 `Gs/Dr/mi/fo`——analyze 全报"零依赖"但都漏了 import，运行时会 ReferenceError。全审计抓到后，用 `node tools/fix-missing-imports.cjs --write` 自动补齐（它查符号在哪个模块导出并生成 import）。每次切片后顺序：全审计 → 补 import → 再审计到 0 问题 → AST 等价 → tsc → build → 产物 `node --check`。
8. 更新本文件 + git commit。

## 浏览器验证（Playwright，有界面）

`tools/playwright/` 下两个脚本用**系统 Chrome 的有界面模式**跑真实渲染（不要用无头，主人要求可见）：

```bash
/opt/homebrew/Caskroom/miniconda/base/bin/python tools/playwright/check-match.py   # 菜单→选项羽→进对局→截图
/opt/homebrew/Caskroom/miniconda/base/bin/python tools/playwright/check-skill.py   # 跳过引导→W 移动→Q 冲锋→查法力/CD
```

- 依赖 Python 版 Playwright（conda base 已装），`channel="chrome"` 复用系统浏览器，无需下载 chromium
- 需要 8899 静态服务在线：`python3 -m http.server 8899 --bind 127.0.0.1 --directory dist`
- 已验证结论（2026-11-19 凌晨）：6 英雄自检全过、选英雄 3D 模型/技能面板/雷达/推荐出装正常、对局战场地形/水晶/单位/小地图/HUD 正常、W 移动与 Q 冲锋真实生效（法力 430→385、CD 7.8s），控制台零报错

## 薄入口后的语义化推进（2026-11-20）

core 收敛为 435 行薄入口后，语义化重心转向**刚拆出的新模块**（这里短名最密集、也最需维护）。本轮两批：

| 批次 | 模块 | 符号数 | 改名处数 | 内容 |
|---|---|---|---|---|
| `2026-11-20-passive-registration.json` | `sim/passive-registration.js` | 27 | 147 | 五英雄被动表别名（`PANYUE_PASSIVE`/`CHIJIN_PASSIVE`/…）、数值常量、`randomPointInRadius`/`castXingliMeteorBarrage`/`passiveValue` |
| `2026-11-20-simulation.json` | `sim/simulation.js`（+ geometry-helpers/core 的 import 同步） | 60 | 197 | 投射物（`spawnProjectile`/`updateHomingProjectile`）、普攻（`startBasicAttack`/`resolveHeroBasicAttack`）、装备（`buyItem`/`sellItem`）、兵线 AI（`spawnMinionWave`/`updateMinionUnit`）、空间索引（`SPATIAL_CELL_SIZE`…） |

两批均经 `rename-across.cjs`（作用域安全 + 遮蔽检测）执行，六道闸门全绿、`npm run build` 成功、
有界面 Playwright 对局 + 技能点检 0 pageerror（项羽 Q CD 7.8s / 法力 430→385 正常）。
**跨文件 import 同步由工具自动完成**：`tS` 同时被 `geometry-helpers.js`/core import，改名时 import specifier 一并更新。
**命名冲突预检**：全库搜目标新名，`LANE_NAMES` 已占用 → 改用 `MINION_LANE_NAMES`。

### 薄入口后的核心模块语义化（2026-11-20，三批 / 155 符号 / 736 处）

core 收成 435 行薄入口后，语义化重心转向三个最高价值的核心业务模块（逐个读函数体核对语义后才建映射，非无差别批量改）：

| 批次 | 模块 | 符号数 | 改名处数 | 关键内容 |
|---|---|---|---|---|
| `2026-11-20-match-lifecycle.json` | `sim/match-lifecycle.js` | 50 | 147 | fallback 模型构建 `buildFallbackModel`、单位模型分派 `getUnitModelForDef`、loading 界面 `buildLoadingScreen`、阵容卡 `buildLineupCard`、对局提示 `gameTips`、`filterReplayEvents`、视觉 scratch 常量 |
| `2026-11-20-boot.json` | `core/boot.js` | 48 | 216 | 头像渲染 `renderHeroPortrait`/`drawPortraitToCanvas`、首页 `buildHomeScreen`、操作说明三面板、设置持久化 `loadMergedSettings`、URL 参数 `parseLaunchOptions`、`FrameStats`/`StatsCollector` 配套工具 |
| `2026-11-20-hero-preview.json` | `render/hero-preview.js` | 57 | 373 | 六英雄模型构建器 `build{Panyue,Chijin,Xingli,Fengling,Yeque,Xiangyu}Model`、骨骼 IK `poseLegIk`/`poseArmIk`、姿态插值 `blendPoseKeyframes`、选英雄预览 `MODEL_BUILDER_TABLE`/`getOrBuildModel`、模型 key 族、头像 fallback |

**验证（每批全过）**：六道静态闸门 + `tsc` 0 error + `check-vfx-templates` 8/8 + 引擎冒烟 32/32 + `npm run build`（172 模块内联）；有界面 Playwright `check-match.py`（对局/技能）+ `check-dialogs.py`（首页设置 / 对局暂停 / 继续游戏）**全程 0 pageerror**。`hero-preview` 批次跨 5 个文件同步 export/import specifier（373 处），`check-import-surface` 全通过证明契约一致。

**关键教训**：`match-lifecycle` 的 `to`（`performance.now()` 封装）虽是短名，但 26 个文件存在同名局部绑定/对象 key（`{ to }`、`to: t`），dry-run 抓到会破坏 `generic-cast-handler.js` 简写属性契约 → **主动放弃该符号改名**（低语义价值、高风险面）。改名器遮蔽检测只保证作用域正确，不保证跨文件同名安全，需靠 dry-run 报告人工判断。

累计 **43 个改名映射批次**。顶层函数已语义化 130 + 155 = 285（下表统计未含本轮，保守起见以批次表为准）。

### Three.js 压缩别名恢复（2026-11-20，126 别名 / 990 处引用 / 424 处冗余 as）

第一阶段（`apply-three-swap.cjs`）把内联 three r180 换成 npm 包时，为免改动 1,700+ 处引用，生成了 `import { Vector3 as dt }` 这类**压缩别名**。本阶段按主人定调「three 是标准库、直接引入同版本即可，无需再映射成另一套语义名」，把这些别名**直接恢复成官方类名**（`dt → Vector3`、`f1 → RGBA_S3TC_DXT3_Format`、`cx → WebGLRenderer`、`Ut → Color`…），而非改造成另一套自定义短名。

- 映射表 `2026-11-20-three-restore.json` 从源码 three import **自动提取**（126 别名，全库一致性 100%：每个别名全局映射到唯一官方名），比 `/tmp/*map*.json` 旧表可靠。
- 前置审计两项均 0：① 无短名被非-three 绑定占用（避免全局改名误伤局部）；② 无官方类名在本文件被占用（恢复后无重名冲突）。
- **真实遮蔽冲突 1 处**：`hero-preview.js` 同时 `import { FloatType as fo }` 且局部 `const fo`（前臂骨骼），全局改名会误伤 → 先把局部 `fo → forearmBone`，消除遮蔽后再跑。`rename-across.cjs` 的遮蔽闸门在此抓到并阻止，是必要防线。
- 改名后 import 呈 `import { Vector3 as Vector3 }` 冗余形态，另用脚本在 three import 块内清理 `X as X` 共 424 处，最终 import 为 `import { Euler, Matrix4, Vector3 } from 'three'`；three 压缩别名残留归零。
- **验证全过**：六道静态闸门 + `tsc` 0 error + VFX 8/8 + 冒烟 32/32 + `npm run build`（172 模块）；有界面 Playwright `check-match.py`（6/6 模型动画、0 pageerror）+ `check-dialogs.py`（首页设置 / 对局暂停 / 继续游戏全通过）。

**原则固化**：three.js / 标准第三方库的压缩别名 = 直接恢复官方名，不做二次语义映射；业务自有符号才按业务语义命名。累计 **44 个改名映射批次**。

### 核心模块 TypeScript 类型化（2026-11-20，首批 3 个模块，kernel .ts 3→6）

按主人最初诉求「重构成 TS 类型、有业务含义、便于维护」，启动 `.js → .ts` 类型化。tsconfig 为宽松模式（`strict:false`/`checkJs:false`），转换只在目标文件加类型，不动 tsconfig（避免全库类型检查风暴）。

| 提交 | 模块 | 类型契约 | 特点 |
|---|---|---|---|
| `adcc9e9` | `sim/game-loop.js→.ts` | `FadeTimerOptions`/`LoopEnv`/`LoopHooks`/`FrameInfo`/`GameLoopOptions` | 逻辑类范式：全字段/方法签名 + 参数 `t/e/s→options/frameSeconds/steps` 业务命名 |
| `9b66bf2` | `equipment.js→.ts` | `ItemSpec`/`ItemStats`/`ItemPassive`/`ItemCategory` | 数据表范式：数据逐字节不变 + 装备结构显式化 |
| `20f6f79` | `game-balance.js→.ts` | `CombatantStats`/`TowerStats`/`EconomyRules`/`WaveSchedule`/`VisionRanges` | 数值表范式：13 导出 + 2 函数签名，22 引用方同步 |

**转换范式（可复用，每批严格照做）**：
1. 新建同名 `.ts`：逻辑/数据逐字节保留，只加 interface/type + 参数与返回值签名 + 业务参数命名（α 等价）。
2. **α 等价验证**：用 esbuild 把旧 `.js` 与新 `.ts` 各自 bundle 成 cjs，同一确定性输入序列驱动，深比较全部导出值 + 函数多组输入输出（纯逻辑类比较内部状态序列）。不通过不得继续。
3. 物理转换：删旧 `.js`，把所有引用方 `from '.../xxx.js'` 改成**无后缀** `from '.../xxx'`（Vite bundler 按现有 `.ts` 惯例解析；`.js` 文件里写 `.js` 后缀会找不到 `.ts`）。
4. 六道闸门 + `tsc --noEmit`（新 `.ts` 必须 0 error）+ `npm run build` + 有界面 Playwright（`check-match.py` / `check-dialogs.py`）0 pageerror，全部通过才提交。

**选择标准**：优先零/低依赖、边界清晰、数据结构或逻辑稳定的模块（数据表、工具类、独立类）。高耦合的战斗大闭包（`simulation.js`/`combat-core.js`）留待类型体系更完整后再做。`check-import-surface.cjs` 已支持 `.js→.ts` 路径映射。

**续批（同日下午，均严格套用上述范式，全闸门 + build + 有界面点检全过）**：
- `e5d5620` 第二批：`ai-difficulty.js→.ts`（`AiDifficultyPreset`）、`unit-model-config.js→.ts`（`UnitPalette`/`RigProportions`/`UnitCapsule`）、`attack-sfx-map.js→.ts`（`AnnouncePriority` + `isBossMonster(monsterId)` 参数语义化），16 导出等价。
- `c5ff51f` 第三批：`ai-tactics.js→.ts`（`HeroAiPersonality`/`AiTuning`）、`particle-atlas.js→.ts`（`ParticleKind` + `clamp01`/`smoothstep` 参数语义化）、`scene-sky-palettes.js→.ts`（`SceneSkyPalette`），11 导出等价。
- 至此 kernel `.ts` **12 个**（原有 3 + 本轮 9）。剩余零依赖模块多为着色器/样式字符串（`postfx-shader`/`bloom-shaders`/`hud-styles` 等），类型化收益低，暂缓。

### sim 运行时类型契约层（2026-11-20，`ce121ef`，kernel .ts 12→14）

按「先建独立 `types.ts` 再逐步接入」的计划，落地 sim 战斗层运行时类型契约：

- **新建 `sim/types.ts`（纯类型，零运行时代码）**：编译产物仅 `export {}`（854 字节全是注释），六个契约族——
  - 几何/通用：`Vec2` / `TeamId` / `UnitKind` / `DamageType`
  - 属性状态：`UnitStats` / `AttackConfig` / `DashState` / `RuntimeState`（对应 `Um`/`nu` 工厂逐字段）
  - Buff：`BuffSpec` / `BuffInstance`（对应 combat-behavior buff 构造点）
  - 单位：`BaseUnit`（`su` 工厂）+ `HeroUnit`/`MinionUnit`/`StructureUnit`/`MonsterUnit` 联合 `RuntimeUnit`，各带 `HeroRuntime`/`MinionRuntime`/`MonsterRuntime` 扩展
  - 投射物/区域：`Projectile`（`spawnProjectile`）/ `AreaEffect`（`spawnArea`）
  - 事件/状态：`SimEvent` / `TeamState` / `CampState` / `MatchState`（`sim.state`）
  - 字段全部来自生产代码反推，与运行时对象 100% 对应；不可枚举回调字段以 `| null` 表达。
- **`skills/skill-values.js→.ts` 首个接入契约**：`f5()` 返回 `UnitStats`（契约生产者）、`Nh`/`US` 消费 `SkillSpec`（契约消费者）、`z0` 消费 `HeroSpec`，形成闭环。参数全部业务化（`n/t/e→hero/level/value` 等）。8 导出 α 等价（含真实英雄数据），16 引用方同步。
- **验证全过**：六闸门 + `tsc` 0 error + VFX 8/8 + 冒烟 32/32 + build；有界面 `check-match.py` + `check-skill.py` 双点检 0 pageerror（技能数值/法力/CD 正常）。

**为何不继续强推高耦合模块**：`combat-behavior.js`(15 导出/329 行) 等战斗核心内部访问 `t.heroId`/`t.skills` 等 kind 专有字段，用 `RuntimeUnit` 联合类型会 tsc 报错、需大量类型守卫；契约的价值已在 skill-values 闭环中验证，强行扩大接入面风险大于收益。后续如要深化，应逐模块引入判别联合（discriminated union）收窄，而非一次性加类型。

## 短名语义化收官 + 全量 JS→TS（2026-11-20，主人「所有短名语义化 / 所有 js 转 ts / 源码更清新」）

### 收官盘点（转换前）
`tools/inventory-shortnames.cjs` 全库扫描：**1171 个顶层短名 / 77 文件**，全部在 `src/kernel`。
跨文件顶层同名 **0 个**（全局映射安全）；仅 9 个名字在别处被内层遮蔽（`cv up sk cc to dy sp bg fn`）+ `id`。

### Phase 1 — 1126 符号 / 6462 处（提交 `47d729b`）
六组并行分析（models/ships、world、audio、fx、sim、render、ui）各出提案 map，合并为 `2026-11-20-bulk-phase1.json`。
- 排除三类不可安全全局改名的符号：**16 个跨模块对象键契约**（`buildVfxTemplates({Gd,yc,…})` / `buildClassicMap({$t,…})` 的键被 TS 侧按名解构）、9 个遮蔽名、`id`（banner.js 同名局部参数）。
- 新工具：`inventory-shortnames.cjs`（全库盘点）、`naming-worksheet.cjs`（命名工作单）、`check-map-collisions.cjs`、`validate-map.cjs`、`find-shorthand-symbols.cjs`、`apply-map-verified.cjs`（改名+α 等价一键）。
- 99 文件逐一 α 等价通过；六闸门 / tsc / 冒烟 32/32 / build 全绿；有界面 Playwright 0 pageerror。

### Phase 2 — 26 符号 / 235 处，短名归零（提交 `3a53b79`）
新建 **`rename-scoped-all.cjs`**（`rename-scoped.cjs` 的多文件版）：只改解析到顶层绑定的引用、保留局部遮蔽同名变量、简写属性 `{Gd}` **展开为 `{Gd: 语义名}` 保住对象键契约**；配套 `verify-rename-scoped.cjs` 做 α 等价。
- 16 个契约符号：`buildVfxTemplates({ Gd: holdZoneDecalSlot, yc: PANYUE_AREA_PALETTE, … })`、`buildClassicMap({ $t: makePointXY, … })` —— 键原样、值语义化。
- 9 个遮蔽名 + `id`：按作用域精确改名，遮蔽处不动。
- 25 文件 α 等价通过；`inventory-shortnames.cjs` 复扫 **`totalShort: 0`（原 1171 全部消除）**；vfx 8/8、浏览器 0 pageerror。

### 全量 JS→TS（提交 `c415b88`）
`tools/js-to-ts.cjs`：134 个 `.js`→`.ts` + 582 处相对 import 去 `.js` 后缀。**`src` 现 0 个 .js / 173 个 .ts**。
- 纯机械转换后 `tsc` 报 1132 错（60 文件）：525 个 TS2339（压缩代码对推断窄类型取属性）+ 463 个 TS2554（实参数少于具名签名）——均为 `.js`+`checkJs:false` 从未检查的存量动态类型模式。
- 采用 TypeScript 官方增量迁移法：这 60 文件顶部加 `// @ts-nocheck — 存量压缩模块，类型化迁移待续`，保留源码不变；**其余 113 文件保持完整类型检查**。后续可逐文件去掉该注释深化类型。
- 闸门工具适配 `.ts`：`lib-files.cjs`（`listSourceFiles`/`resolveSource`，.ts 优先）、engine-smoke / check-vfx 入口 `.ts` 优先；audit / method-calls / unbound 跳过带类型注解的样板（由 tsc 校验），覆盖纯 JS 语法的迁移文件。
- **验证全过**：tsc 0 error / import-surface 173 / audit 0 / unbound 147 / vfx 8/8 / 冒烟 32/32 / build 成功；有界面 Playwright 对局（6/6 模型、24/24 图标、6/6 雷达、45 音效 8 VFX）+ 设置/暂停对话框 + Q 技能（法力 430→385、CD 7.8s）**全程 0 pageerror**。

> **命名原则固化**：three.js 等标准库的压缩别名直接恢复官方类名；业务自有符号按业务语义命名；跨模块对象键是契约，只改绑定不改键（简写属性必须展开）。

## 语义化进度（2026-11-19 00:xx）

| 类别 | 已语义化 | 剩余 | 说明 |
|---|---|---|---|
| 顶层类 | **75 / 75（100%）** | 0 | 全部有语义名（音频/渲染/AI/特效/骨骼/池…） |
| 顶层函数 | 130 | 566 | 按调用关系聚类推进；其余见 `SYMBOLS.md` |
| 配置对象 | 35 | 168 | 配色板/参数表，按 content 命名 |
| 数组表 | 0 | 112 | 待按内容命名 |
| 临时实例 | 0 | 86 | 模块级 scratch 变量，非业务语义 |
| 其它 | 0 | 864 | 多为单表达式常量/字符串 |

**已建成的工具链**（可重复使用）：

| 工具 | 作用 |
|---|---|
| `rename-across.cjs` | 批量改名（遮蔽即拒绝，安全但保守） |
| `rename-scoped.cjs` | **作用域感知**改名：解析到顶层绑定才改，能处理被局部变量遮蔽的符号；属性名/键名不改，简写属性展开为 `key: 新名` |
| `verify-rename.cjs` | α 等价验证（映射应用到旧 AST 必须等于新 AST） |
| `detect-math-utils.cjs` / `detect-topvars.cjs` | 按 AST 形状发现可命名的数学工具 / 配置表 |
| `gen-symbol-index.cjs` | 生成 `SYMBOLS.md`（未语义化符号的可导航索引） |
| `playwright/check-match.py` / `check-skill.py` | 有界面浏览器验证（真实渲染 + 操作） |

**已知的坑（务必注意）**：
1. `mapping['constructor']` 会命中原型链 → 查表必须 `hasOwnProperty`。
2. 属性名（`obj.z`、`{ z: 1 }`）不是绑定，改名会破坏语义。
3. 简写属性 `{ z }` 改名必须展开成 `{ z: 新名 }`，否则会改掉对象键。
4. `acorn-walk` 对 `Property` 只访问 value、对简写属性不访问 key，自定义遍历必须自己补。

## 事故复盘：`z is not defined`（2026-11-19）

**现象**：首页点「设置」、对局内点「暂停」都弹"出了点状况"，控制台 `ReferenceError: z is not defined`。

**原因**：`z → createEl` 改名时漏改 20 处调用，全部位于**类字段里的箭头函数**中
（设置项构造器、死亡回放、击杀播报）。v1 版 `rename-scoped.cjs` 的两遍遍历都用
`switch` 枚举节点类型，类字段（`PropertyDefinition`）里的函数体没有被遍历。

**为什么验证没拦住**：`audit-all-modules.cjs` 当时按**名字**判断是否已定义
（`defined.has(name)`），而文件里恰好在某处有 `function onTick(z, area)` 这样的参数声明，
于是所有 `z` 引用都被当成"已定义"放过了。

**修复**：
1. `rename-scoped.cjs` 重写为通用递归（只在函数/类/catch 切作用域），并新增 `--audit`
   模式：校验「目标名的 AST 引用计数 == 实际解析数」，不等即说明遍历有盲区。
2. 新增 `tools/lib-scope.cjs`（作用域分析库），`audit-all-modules.cjs` 改用它：
   只有**在任何作用域都找不到声明**的标识符才算自由引用。
3. 新增回归脚本 `tools/playwright/check-dialogs.py`：断言设置面板与暂停对话框能打开且无 pageerror。

**教训**：改名后的验证不能只看「名字是否存在」，必须做**作用域级**检查；
并且任何涉及 UI 的改动都要跑一次浏览器点检。

## 搬迁闸门：初始化期依赖（2026-11-19）

`tools/extract-symbols.cjs` 现在会拒绝「顶层 const 在初始化求值时读取其它绑定」的搬迁。
真实案例：`d8`（状态特效表）在定义时就调用 `Wb(...)` 并读取 `ELEMENT_COLORS.frost`、`PARTICLE_KIND`，
搬到独立模块后这些绑定尚未初始化 → `Cannot read properties of undefined (reading 'frost')`。

**被闸门拦下、暂不搬的大块**（需先重构为惰性工厂才能搬）：
| 块 | 行数 | 初始化期依赖 |
|---|---|---|
| 音效总库 `XS` 等 | 668 | `xn`/`FS`/`GS`/`zS` |
| 粒子绘制表 `vb` | 504 | `PARTICLE_KIND`（作计算键） |
| 状态特效表 `d8/az/oz` | 502 | `ELEMENT_COLORS`/`PARTICLE_KIND`/`tz`/`JD`/`Kg`/`Zg` |

## 事故复盘：vfx kit key 不匹配（2026-11-19）

**现象**：进对局后渲染循环每帧抛错，画面卡住。

```
TypeError: Cannot read properties of undefined (reading 'shield')
  at Object.create → AreaEffectView.update → Object.update → render → frame
TypeError: Cannot read properties of undefined (reading 'telegraph')
```

**根因（两层）**

1. `AreaEffectView.make` 里 `def: Pb[t.visual] ?? Pb.fountain_zone`，`def.create` 内部用
   `Xt.telegraph`、`qe.shield`。`Xt`/`qe` 来自 `src/vfx/templates.ts` 的解构：
   ```ts
   const { _r, Gd, Xt, ad, yc, qe, sn, ... } = kit as any
   ```
2. 内核侧调用早已改名成新语义名：
   ```js
   Pb = buildVfxTemplates({ _r, Gd, GROUND_FX_KINDS, ad: drawZoneDecal, yc, FX_SHAPES, FX_STYLES, ... })
   ```
   **对象解构按属性名匹配，不按位置** → `kit.Xt` / `kit.qe` 都是 `undefined` → 读 `.telegraph` / `.shield` 崩。

**为什么以前没炸**：同一时期 `Simulation.fx()` 被误改名，任何施法都会先抛
`n.fx is not a function`，渲染根本走不到区域特效。修好 fx 后这条路径才被暴露。

**为什么 key 会被改成新名**：batch13 用 `tools/rename-across.cjs` 做语义化，其排除规则写的是
`parent.type === 'Property' && key === 'key' && !parent.shorthand` —— **简写属性 `{ Xt }` 恰好不被排除**，
于是 key 与 value 一起被改成 `GROUND_FX_KINDS`。而解构方（TS）的 key 是字符串，不会跟着改。

**修复**

- `src/vfx/templates.ts`：解构改为别名映射 `GROUND_FX_KINDS: Xt` / `FX_SHAPES: qe` / …，模板体一行未动；
  并新增 `REQUIRED` 依赖完整性检查，缺 key 时启动即明确报出（不再静默 undefined）。
- `tools/rename-across.cjs`：属性名一律不改；**命中简写属性时直接拒绝执行**并提示改用 `rename-scoped.cjs`
  （它会把 `{ Xt }` 正确展开为 `{ Xt: 新名 }`）。

**新增闸门**：`tools/check-vfx-templates.cjs`
- 对 `Pb` 的**每个模板**用 Proxy stub 跑 `create + update × 2`，读 undefined 立刻暴露
- 当前 8/8 通过：`telegraph` / `panyue_s2_aura` / `panyue_ult_fissure` / `chijin_ult_spin` /
  `xingli_s2_well` / `xingli_ult_storm` / `fengling_ult_rain` / `fountain_zone`
- 灵敏度已实测：把解构 key 改回旧短名 → 2/8，并精确报出 `telegraph` / `shield` / `cone` / `swirl`
  （后两个是尚未被玩家触发、但同样会崩的模板）

**影响面核对**：core → TS 的对象契约只有三处，另两处 key 完全匹配——
`buildSoundBank`（`At: defineSfxCue` 保留旧 key，故安全）、`buildClassicMap`（`$t/$h/I0/Ax/h8` 未改名）。

**教训**：语义化改名不能只保证「同一个文件里自洽」，**跨文件的对象 key 是契约**，
尤其"简写属性"最容易被误伤；凡改名涉及对象字面量，必须核查消费方的解构 key。

## 改任意文件的标准动作（2026-11-19 定稿）

> 起因：`node-tree.js` 转 `.ts` 时只改了 `starfall.core.js` 的 import，漏了 `skeleton.js` 与 `models.js`，
> 是 build 报 `Could not resolve "./node-tree.js"` 才发现的。说明「同步改调用方」不能靠记性。

### 1) 改之前：先量影响面

```bash
node tools/find-usages.cjs src/kernel/xxx.ts        # 谁 import 这个文件、导入了哪些符号
node tools/find-usages.cjs --symbol SomeSymbol      # 该符号在项目里出现 16 处（声明/引用/属性名/字符串）
```

看三个数字决定要不要改：
- 引用方数量 → 决定要同步改几个文件
- 「属性名」出现次数 → 若 >0，说明该名字同时被当属性用，**不能直接改**
- 「字符串」出现次数 → 说明存在字符串形式的 key（事件名、音效名），改了变量名它不会跟着变

### 2) 改内容

- 只改函数内部（参数 / 局部变量）→ **调用方零改动**，最安全，优先做这类
- 改函数名 / 类名 / 导出名 → 必须同步改全部引用方
- 改文件后缀（.js → .ts）→ 必须改全部 import 路径

### 3) 改之后：六道闸门

| 闸门 | 抓什么 | 抓不到什么 |
|---|---|---|
| `check-import-surface.cjs` | import 路径解析失败、导入了目标没导出的符号 | 运行时才发生的类型/契约错 |
| `audit-all-modules.cjs` | 作用域级自由标识符（漏 import、拼错名字） | 方法名、对象 key；**core 顶层的同名绑定放过** |
| `check-unbound-core-refs.cjs` | 模块引用了 core 顶层符号却没 import（补 audit 盲区） | `.ts` 文件、非大写开头的普通工具名 |
| `tsc --noEmit` | `.ts` 文件的类型错误 | `.js` 文件一概不查 |
| `npm run build` | rollup 解析、语法 | 逻辑错误 |
| `verify-behavior.cjs` / 数据 JSON 对比 | 改名后行为是否漂移 | 未被用例覆盖的分支 |

涉及引擎逻辑再加 `engine-smoke.cjs`；涉及渲染/UI 再加浏览器点检。

**`check-unbound-core-refs.cjs` 的来历（2026-11-19 真事故）**：UI 图标层 `heroIconPalette()` 用了
`HERO_TABLE`（core 的 import 绑定），`extract-symbols` 把 import 绑定视为「新模块会再 import 一次」而未自动补，
`audit` 又因 core 顶层有同名声明而放过 → 六道里前五道全绿，只有浏览器 `pageerror: HERO_TABLE is not defined`
暴露。此闸门对模块做作用域分析取 freeRefs，与 core 顶层声明求交，专门堵这个洞（注入故障已验证会报）。
**二次修正（同日）**：初版闸门只报「大写开头」符号，漏掉 `buildVfxTemplates`（小写开头的 import 绑定，
在 fx/emitters.js 里漏 import，冒烟 `buildVfxTemplates is not defined` 才暴露）。已去掉大小写过滤——
coreTop 本身已是白名单，无需二次筛选。

### 4) 已知盲区（必须人工核对）

1. **跨文件对象 key 契约**：`fn({ GROUND_FX_KINDS })` 与 `const { Xt } = kit` —— 静态工具全查不到，
   曾导致 `reading 'telegraph'` 崩溃。对策：看到「对象字面量传给别的模块的函数」，人工核对解构 key，
   并对该模块写专门的运行时自检（如 `check-vfx-templates.cjs`）。
2. **动态属性访问**：`obj[key]`、`this[name]` 无法静态校验。
3. **字符串 key**：事件名、音效名、存档字段等，改名不会传播到字符串里。
4. **跨模块可变状态写入（2026-11-19 事故 #3）**：`let Y8/K8` 被搬到 ui/dom-kit.js 后，core 顶层
   `if (typeof window < 'u')` 副作用块仍在写 `Y8 = clientX` → 运行时 `Y8 is not defined`，
   六道静态闸门全过（写入点不在顶层声明、是副作用块内的赋值），只有浏览器错误边界抓到。
   **对策**：已固化进 `extract-symbols.cjs` —— 搬 `let/var` 时扫描 core AST 的
   AssignmentExpression/UpdateExpression，若残留代码仍给该绑定赋值则直接拒绝（`--force-write` 可强推）。
   真正修法：`export function setXxx()` setter，core 调 setter（ESM import 绑定只读）。
   灵敏度已验：对 `let dh/c4/k2`（有外部写入点）正确拦下。
5. **作用域分析器多级成员访问（2026-11-19 事故 #4）**：`lib-scope.cjs` 的 MemberExpression 分支
   遇到 `HERO_TABLE.chijin.skills.s2` 这种链时，因链尾是非 computed 属性直接 return，
   整个链的 object（`HERO_TABLE`）从不被 resolve → 第 6 道闸门漏报，unit-views.js 漏 import
   在运行时才炸。已修：object 永远 resolve，只跳过非 computed 的 property 本身。

---

## 第二轮结构优化（2026-11-20，主人「还有什么可以做的源码优化」）

在语义化归零 + 全量 TS 之后，按 ROI 做了四项优化，工作区 5 个提交（`894b23f`→本轮）。

### 1) 单元测试网（node:test，零新依赖）
- `tests/unit/*.test.cjs` + `load-ts.cjs`（esbuild 现场把 TS bundle 成 CJS 供 node:test 加载，同 engine-smoke 手法）。
- 覆盖 6 组纯逻辑模块：音频数学 / 粒子图集 / 游戏平衡数值 / 装备文案 / 技能数值契约 / 战斗音效映射，**27 用例全绿**。
- `npm test` / `npm run test:verbose`；临时 bundle 落在 `tests/unit/.bundles/`（gitignore）。

### 2) 拆分 6745 行 models.ts
- `tools/split-models.cjs`：AST 闭包分析按「声明块」切分（不能拆 `const A,B` 多声明块），14 个导出构造器分 3 组且互不直接调用。
  - `model-heroes.ts` 3188 行（6 英雄）/ `model-monsters.ts` 2591 行（5 怪物）/ `model-world.ts` 977 行（小兵/塔）。
  - `models.ts` 降为 11 行聚合入口，导出面 14/14 不变，调用方零改动。
- 每文件只带自身需要的 import（自由标识符 0 / 39 声明逐字节保留）。此拆分也让原 models.ts 的 193 个类型债分散到 99/60/34。

### 3) 类型债清零（60 → 51 个 @ts-nocheck）
- `speech-announcer.ts` 加 `SpeechAnnouncerDeps` 接口完整类型化（构造参数可注入测试替身）。
- 另 10 个单错误文件用 typeChecker 精确修复：被调函数尾部参数改可选 `?`（`createEl`/`computeSkillDamage`/`emitTwinSlashGlow`/`removeBuff` 等，编译后擦除、运行时零变更）、`Object.values(...)` 断言为数组。
- **剩余 51 个文件是压缩层本质债务**：约 1083 处错误（517 TS2339 属性访问 + 445 TS2554 缺参），均为压缩代码的动态类型模式。
  继续用 `as any` 刷满只会让代码更脏、背离「清新」初衷，故停止。真正清零需逐文件理解压缩逻辑重写，投入产出比低。
  `post-pipeline.ts`(176)/`foundation.ts`(108)/`sfx-cues.ts`(69)/`hero-preview.ts`(47)/`model-builder.ts`(45) 是最大几处，留待后续按需处理。

### 4) 发布版构建 + 扩展点说明
- `vite.config.ts` 支持 `RELEASE_MINIFY=1`：`npm run build`（调试版 dist/，不压缩）+ `npm run build:release`（dist-release/，esbuild 压缩）。
  产物 3.1M → 1.9M（gzip 815K → 663K），发布版已用有界面 Playwright 验证 6/6 模型 + 0 pageerror。
- `tools/playwright/check-match.py` 支持 `STARFALL_URL` 环境变量覆盖目标，便于验证不同产物。
- 跨模块可变状态仅剩 2 处 setter（`setMapFactory`/`setLastPointerPos`），规模小、无需收敛重构。
- 扩展 API（`src/extensions/api.ts`）已有完整内联契约注释（Kernel 接口 20+ 成员），作为唯一「往核心加东西」的入口。

---

## 第三轮：函数内部语义化 + 关键逻辑注释（2026-11-20，主人「函数内部变量也要按语义命名」）

### 盘点基线
- `tools/inventory-locals.cjs`（新增）：用 TypeScript AST 逐个函数盘点参数 / 局部变量 / catch 绑定，不再只看顶层。
- 基线：**176 个 `.ts` / 4290 个函数 / 19162 个函数内短名 / 仅 75 个函数有 JSDoc**；51 个 `@ts-nocheck` 压缩模块是重灾区（world-builder 1078、model-monsters 1018、model-heroes 814）。
- 顶层仍为 0（`inventory-shortnames.cjs` → `totalShort: 0`），本轮只处理函数体内部。

### 工具链（全部新增，零依赖）
| 工具 | 作用 |
|---|---|
| `tools/inventory-locals.cjs` | 函数内短名 + JSDoc 覆盖率盘点，输出 `/tmp/localname-inventory.json` |
| `tools/plan-local-names.cjs` | 按结构性信号生成候选工作单：循环下标 / 遍历元素 / DOM 元素 / 距离 / 累加 / Map 键 / 事件参数 |
| `tools/rename-locals.cjs` | 用 TypeScript LanguageService 的 `findRenameLocations` 做作用域安全改名；属性名/对象键不改，简写属性自动展开为 `{ key: newName }`；引用越出函数区间整条拒绝 |
| `tools/add-function-docs.cjs` | 只给「参数已语义化 + 函数名能推断业务对象」的函数补 JSDoc，拒绝生成 `@param n - 输入` 式噪音 |
| `tools/fix-doc-indent.cjs` | 修正自动插入类方法 JSDoc 时丢失的缩进 |

### 第一批（本轮已落地）
1. **全库结构性改名 1113 条 / 99 个文件**：`index` 422、`distance` 146、`item` 126、`lookupKey` 122、`element` 110、`total` 103 等。只取高置信规则，重名时放弃而非产生 `index11` 这类伪语义名。
2. **战斗核心手工精修**：`combat-core.ts` 追加 176 + 4 条工作单，覆盖草丛包围盒缓存、可见性两阶段、`TeamContext` 全部查询、区域生命周期、动作/动画/控制状态、单位创建等；`startPoint/points`、`heroId/skillKey/castHandler`、`viewerUnit/deltaX/distanceSquared`、`riskMargin/hazardCircles` 等进入代码。
3. **关键注释**：`polylineLength` / 施法 handler 注册查找 / 被动实例缓存 / `getBushBounds` / `findBushAt` / `updateBushVisibility`（含两阶段行内注释）/ `TeamContext.refresh` / `near` / `pathDistance` / `safePath` / `perceivesPoint` / 动作与区域生命周期 / 单位状态创建，均改为解释业务语义的 JSDoc，而非模板文案。
4. **复扫**：函数内短名 19162 → **18056**；有 JSDoc 函数 75 → **99**。顶层短名保持 0。

### 验证
`tsc --noEmit` 0 error；六道闸门全绿（176 模块导入契约、0 自由标识符、150 模块无漏绑、8/8 特效模板、引擎冒烟 32/32）；单测 27/27；`npm run build` 成功（dist 3,268.58 kB / gzip 819.26 kB）。

### 后续批次原则
- 剩余约 1.8 万个内部短名绝大多数在 51 个压缩模块；继续按「先结构性、后业务手工」推进，每批跑同一组闸门。
- 禁止无依据兜底命名：`sourceSpec` / `targetState` / `candidate` 这类泛化名已在生成器里过滤。
- 注释优先级：导出函数 → 长函数 → 含状态机/多阶段逻辑的函数；一行式 lambda 不补注释。

---

## 第四轮：函数内部语义化收官（2026-11-21，主人「全部处理完」）

### 结果
| 指标 | 第三轮后 | 本轮收官 |
|---|---|---|
| 函数内短名（1-4 字符） | 18056 | **88**（全部是合法英文业务词：item/unit/camp/hero/base/wall/hook/lane/mesh/ally/melt/node/step/bush/buff…） |
| 压缩残留（`n/t/e/s/a/o/r`） | ~1.5 万 | **0** |
| 有 JSDoc 函数 | 99 | **468** |
| 顶层短名 | 0 | 0 |

### 核心工具（本轮新增/重写）
- `tools/plan-all-names.cjs`（全量覆盖版）：对 100% 声明生成语义名，信号优先级——
  结构性（循环/元素/DOM/距离/累加/Map 键/事件）→ 初始化表达式（`new` 类名、调用方法名、属性名、元素基名、三元比较值、二元运算符、字面量）→ 使用上下文（DSL builder 方法数≥3 → `soundBuilder`/`fxBuilder`、赋给 `this.xxx`、成员访问推断实体）→ **跨文件调用点实参名**（`buildCallSiteNames`，带出现频次置信阈值）→ 参数位置角色。
- `tools/dedupe-worklist.cjs`：写盘前按 (file,to) 去重，后缀用 `Secondary/Tertiary/...` 而非 `2/Alt`（避免新名重新落入短名判定）；原始标识符从 `git show HEAD:./` 读取，避免工作树污染。
- `tools/rename-locals.cjs` 增强：支持 `occurrence` 字段消歧（同行嵌套 `<anonymous>` 声明）。

### 三大事故与修法（都已固化进工具）
1. **解构别名契约**：`buildVfxTemplates` 的 `{ GROUND_FX_KINDS: Xt }` 等是跨模块对象键契约，改名会拿到 undefined（历史事故）。→ `isDestructured` 识别并跳过。
2. **DSL builder 误命名**：音频回调参数 `e` 被叫点推断成 `noise`（实参恰好是 `.noise`），导致内层遮蔽、`.noise is not a function`。→ 方法调用数≥3 判定为 builder，优先命名 `soundBuilder`/`fxBuilder`；调用点名强制小驼峰、排除类名/常量名。
3. **嵌套作用域撞名**：`productValue`/`sumValue` 在同一文件重复声明（TS2451）。→ dedupe 工具全文件去重兜底，修掉 4817 处潜在撞名。

### 收官验证
- `tsc --noEmit` 0 error；六道闸门全绿（176 模块、0 自由标识符、150 模块无漏绑、8/8 特效模板）；引擎冒烟 32/32；单测 27/27。
- 双构建：`dist` 4.52 MB（调试版变量名长，符合预期）、`dist-release` 1.99 MB / gzip 663 KB（minify 抹平差异，与历史持平）。
- 有界面浏览器加载对局页 0 pageerror。
- 残留 88 个 3-4 字母标识符均为业务语义词，非压缩短名，命名目标达成。

### 第五轮：model 文件「序数后缀」专治（2026-11-21）
- **问题**：用户指出 `model-heroes/monsters/world/parts/builder` 里变量是 `primaryInputSecondary`、`valuesExtra867`、`xxxTertiary` 这类「长前缀 + 序数/行号」伪语义名，可读性差。根因：第四轮 `dedupe-worklist.cjs` 按**全文件**去重，导致不同函数的同名参数被迫加 `Secondary/Tertiary/...` 后缀；局部变量加 `Extra+行号`。
- **新工具链**：
  - `tools/inventory-model-names.cjs`：TS AST 盘点 5 个 model 文件的伪语义名，收集成员访问签名、init 表达式、索引使用、调用点、`bindingKey`（解构键）。
  - `tools/plan-model-names.cjs`：按 6 级优先级推断领域语义——①解构别名 `{rig:x}`→rig ②成员签名→`builder/rig/joints/proportions/surfaceProfile/ribbonSpec/featureSpec/furSpec/pose/animState/...` ③init 表达式→`deltaX/deltaY/deltaZ/ratio/clamped/lerped/entries` ④同行参数组→`coordX/coordY/coordZ` ⑤运算基名 ⑥兜底。**按函数作用域去重**（不同函数复用同名），同函数冲突用维度后缀 `X/Y/Z/Width/...` 而非序数。
  - `tools/rename-locals.cjs` 增 `--allow-jsdoc-refs`：允许越界引用位于 `/* */` 注释块内（修复 `const f = /** JSDoc */ (x)=>{}` 形态下 JSDoc `@param` 被误判越界，25 条 anonymous 回调参数得以改名）。
- **成果**：5 个 model 文件改名 2256 条（2231 主单 + 25 JSDoc 回调单）。`Extra+数字` 残留 **0**、序数后缀残留 **0**。典型：`buildFaceFeatures(builderX, rig, surfaceProfile, featureSpec)`（原 `(builder, secondaryInputNinth, tertiaryInputFifth, quaternaryInputTertiary)`）；解构 `{ rig: rig, J: joints, d: proportions }`；`makeChainColorBinder(entries, samples, coordZ)`。
- **三处坑**：①内层遮蔽 `const element = samples[value]` 曾与参数同名 → 元素用单数名（infer 区分 `X[i]` init → `element`）；②`model-monsters.ts:429` `distance` 重复声明（@ts-nocheck 下 tsc 不查，审计工具抓到）→ dedupe 禁用种子加入本函数所有原始声明名；③25 条 anonymous 回调被 `REF_OUTSIDE_FUNCTION` 拒绝 → `--allow-jsdoc-refs` + 手工修正 8 条边缘语义（`teamId/paletteIndex/cornerA~D/faceColorA~B`）。
- **验证**：tsc 0 error、六闸门全绿（审计 0 问题 / 冒烟 32/32 / 单测 27/27）、双构建成功。有界面系统 Chrome 检查：dist 在 file:// 下有 1 处 `openMenuFlow` 的 `HierarchyRequestError`，经 HEAD 对照确认属**既有历史问题**（与 model 改动无关，boot.ts 菜单 DOM 操作）。

### 第六轮：model 文件「伪语义/编号后缀」专治（2026-11-21）
- **问题**：用户以 `buildMeleeMinionModel()` 为例指出——`nodeTreeInstance`/`addResult`/`addAddResult`/`value`/`valueX`/`valueY`/`valueZ`/`valueWidth`/`valueHeight`/`valueDepth` 这类名字看不出业务语义，且 `valueX/Y/Z/Width/Height` 会被误读成坐标分量（实际是**关节 id**）。盘点了 5 个 model 文件共 **641 个**伪语义声明、78 种名字（含成片的 `valueV1..V50` 编号后缀、`callback` 回调、`xxxInstance`）。
- **命名依据（本轮核心）**：不再用「词根+序数/维度后缀」的机械编号，而是从**业务语义信号**取名——
  - ① `rig.add("head", ...)` / `rig.addChain("sash", ...)` 的字符串参数就是关节/链名 → `headJoint`/`sashChain`（81 个，权威依据）；
  - ② 回调参数看**调用点实参**：`by` 着色回调真实签名 `(posX,posY,posZ,gradient,normalX,normalY,normalZ)`（由 `model-builder.ts:288 writeVertex` 证实）→ 法线/渐变命名；`sym((side)=>...)` 的 `side` 是 ±1 镜像标志；
  - ③ 数值计算看 init 函数与用途：`inverseLerpClamped`→progress、`hitImpactPulse`→hitPulse、`smoothFalloff`→falloff、`windupEaseCurve`→windupEase；
  - ④ `new ModelBuilder()`/`new NodeTree()` → `builder`/`nodeTree`。
- **新工具**：`tools/inventory-model-semantic.cjs`——TS AST 盘点伪语义名并收集「所有使用行源码 + 关节名字符串 + 成员访问 + 调用点参数位」，供逐函数业务判定（比第五轮只收集签名更全）。
- **成果**：三批落地——关节/链/instance 86 个 + 逐函数业务判定 555 个 + 重复词根/Value 后缀简化 56 个，合计约 **697 个声明**（改写约 2500+ 处引用）。典型：`addResult/addAddResult/value/valueX...` → `rootJoint/bodyJoint/headJoint/armLJoint/armRJoint/legLJoint/legRJoint/emblemBJoint/emblemRJoint`（`buildMeleeMinionModel`）；`valueV22..V25` → `topEdgeIndex/rightEdgeIndex/bottomEdgeIndex/leftEdgeIndex`；`callback` → `emitChainRibbon/emitArmGuard/radiusAtHeight`；`BeastRigBeastRigValue`→`beastRig`、`hermiteSmoothStepHermiteSmoothStepResult`→`smoothedValue`、`bUILDING_GEOMETRY_CACHEBUILDING_GEOMETRY_CACHEResult`→`buildingGeometryCache`。
- **三处坑**：①盘点工具的 `fn` 标签对匿名回调是 `<anonymous@行号>`，改名器 fnLabel 却是 `<anonymous>` → 118 条定位失败，去掉 `fn` 字段按 `name+line` 定位（已验证同行同名=0）；②6 条 JSDoc `@param` 越界 → `--allow-jsdoc-refs`；③`vertexVertexResult`→`vertexResult` 撞同函数已有变量（`@ts-nocheck` 下 tsc 不查）→ 按四边形角点语义改 `cornerBVertex`。**教训**：`@ts-nocheck` 模块的撞名必须用 AST 函数区间精确校验（本轮自建校验脚本，0 冲突后才写入）。
- **验证**：tsc 0 error；六闸门全绿（176 模块 / 审计 0 问题 / 150 模块无漏绑 / 8/8 特效模板 / 冒烟 32/32 / 单测 27/27）；双构建成功（dev 4.47M、release 1.99M / gzip 663KB）。复扫：伪语义名仅剩 `builder`（ModelBuilder 实例，合法语义名）22 个，重复词根名 **0**。
