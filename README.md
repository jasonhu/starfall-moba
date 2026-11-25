# starfall-moba · 星陨战纪

> # ▶ 点击在线试玩
>
> **[https://jasonhu.github.io/starfall-moba/](https://jasonhu.github.io/starfall-moba/)** — 打开即玩，无需安装。1 名玩家 + 9 名 AI，6 位历史人物英雄。

一个 5v5 MOBA 网页游戏的可维护源码工程。

把一个约 2 MB 的线上单文件 HTML 反混淆、分层、语义化，重构成 Vite + TypeScript 工程；构建产物仍是**单个自包含 HTML**（内联全部 JS/CSS），双击即可运行。

英雄取材于中国历史人物（樊哙、程咬金、王昭君、李广、荆轲、项羽），角色模型、贴图、特效与音效全部由代码程序化生成，不依赖外部美术素材。

## 特性

- **单文件产物**：`npm run build` 产出 `dist/index.html`，零外部依赖，可直接分发或用浏览器打开。
- **完全语义化的内核**：原压缩短名已 100% 重命名为业务语义名，短名残留 0、伪语义名残留 0、`@ts-nocheck` 0。176 个 TypeScript 文件，约 6.3 万行。
- **声明式英雄系统**：英雄是纯数据（`src/heroes/*.ts`），改数值/文案/出装/技能不必碰内核；新增英雄有模板和完整清单。
- **程序化资产**：3D 模型/骨架/动画由内核几何 DSL 生成，音效用 WebAudio 实时合成，特效为模板驱动。
- **可验证**：引擎冒烟测试 32 项、单元测试 27 项，另有导入契约、模块审计、未绑定引用、特效模板等多道静态闸门。

## 快速开始

需要 Node.js（构建验证环境为 v22.20.0）。

```bash
npm install
npm run dev            # 本地开发，热更新
npm run build          # 产出 dist/index.html（不压缩，便于调试）
npm run build:release  # 产出压缩版 dist-release/index.html
npm test               # 单元测试
```

运行产物：直接双击 `dist/index.html`，或在 `dist/` 下起一个静态服务：

```bash
cd dist && python3 -m http.server 8099
# 浏览器打开 http://127.0.0.1:8099/index.html
```

浏览器需要 WebGL 2。

## 目录结构

```
src/
  main.ts                 启动入口：先加载内核，再挂扩展
  kernel/                 游戏内核（约 6.3 万行，从单文件拆出）
    starfall.core.ts      薄入口，真实逻辑分布在下列模块
    SECTIONS.md           内核分区索引：哪个功能在哪个模块
    SYMBOLS.md            符号语义化说明与索引
    core/                 内核装配、生命周期
    sim/                  战斗模拟、AI、技能结算、比赛流程
    render/               渲染、材质、模型构建、后处理
    fx/                   粒子、发射器、持续特效
    audio/                WebAudio 合成音效与语音
    ships/                骨骼装配与单位姿态
    world/                地图几何、寻路、河道、场景
    model-*.ts            英雄/怪物/世界的程序化建模
    ui/                   HUD、菜单、引导、小地图
  heroes/                 英雄数据（单一真源）
    types.ts              HeroSpec 类型契约
    *.ts                  6 个英雄，纯数据
    _template.ts          新英雄模板
  bundles/                英雄完整说明书（模型/技能/音效）
  extensions/             向内核注册模型/特效/音效/图标的 API
  vfx/templates.ts        持续型战斗特效模板（8 条）
  world/map/              地图数据：三路路点、塔位、墙体、草丛、野区、河道
docs/
  ARCHITECTURE.md         整体架构与各子系统位置
  ADD_HERO.md             加一个新英雄的完整清单
  ADD_MAP.md              换地图 / 改场景 / 追加场景元素
  ADD_SOUND_VFX.md        换音效 / 加特效
tools/                    反混淆、拆分、语义化、校验工具链（71 个脚本）
tests/unit/               单元测试
dist/index.html           构建产物（单文件，可直接运行）
```

## 扩展指南

- 加英雄：读 [`docs/ADD_HERO.md`](docs/ADD_HERO.md)
- 换地图 / 加场景元素：读 [`docs/ADD_MAP.md`](docs/ADD_MAP.md)
- 加音效 / 特效：读 [`docs/ADD_SOUND_VFX.md`](docs/ADD_SOUND_VFX.md)
- 理解内核布局：读 [`src/kernel/SECTIONS.md`](src/kernel/SECTIONS.md) 与 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 已知限制

- 角色模型/骨架/动作依赖内核内部的几何 DSL（`ge()` 摆姿势、`zs()` 关键帧），因此**新增外观需要写在内核侧**；只改数值/技能可以完全在 TS 数据层完成。
- 无头浏览器环境若缺 WebGL 2，页面会停在"需要 WebGL 2"提示，这不是构建问题。
- `dist/index.html` 是默认（未压缩）构建产物；发布用 `npm run build:release`。

## 来源

本项目由一份线上 3D MOBA 单文件 demo 反混淆、分层重构而来。反混淆阶段共做 7 处必要改动（头部导入注入、英雄表外置、音效/特效表外置、地图数据外置、导出追加、默认技能兜底、场景钩子），其余逐字符保留原 bundle；把这几处还原后与原 bundle 比对逐字符一致（仅差一个行尾换行）。详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 许可证

[MIT](LICENSE)
