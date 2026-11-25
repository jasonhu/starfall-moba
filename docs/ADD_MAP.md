# 换地图 / 改场景

## 地图数据的唯一真源

`src/world/map/classic.ts`（`buildClassicMap`）—— 从内核整块搬出来的，内核现在只有一句
`const __MAP = buildClassicMap({ $t, $h, I0, Ax, h8 })`，其余全部从这里读。

里面的东西就是"地图长什么样"的全部答案：

| 数据 | 含义 | 当前值 |
|---|---|---|
| `Fz` / `Uz` | 地图外框 / 半边长 | 57.5 / 76 |
| `s_` / `Gz` | 上/中/下三路的路点折线 | 6 / 5 / 6 个点 |
| `a_` / `Vz` | 单边 9 座塔定义 + 双方镜像成 18 座 | 18 |
| `i_` | 基地与泉水：核心、泉水半径、出生点、兵线出口、基地区域 | 2 个 |
| `Oz` / `e_` | 墙体多边形（用镜像函数复制成四象限） | 24 段 |
| `Bz` / `n_` | 草丛矩形 | 22 片 |
| `Hz` / `$z` | 野怪点位（含 frost_golem / ember_golem 换皮、刷新时间） | 14 个 |
| `river` / `riverWidth` | 河道折线与宽度 | 10.6 |

坐标工具 `$t(x,y)`、`$h`、`I0`、`Ax`、`h8` 由内核注入，别在模块里另写一套。

## 改法三种

### A. 直接改数值（最常用）

```ts
// classic.ts
const s_ = [$t(-52, 42), ...]        // 改路点
const Oz = [[$t(-46.5, 35), ...]]    // 改墙体
riverWidth: 10.6                     // → 12 河道变宽
```

出门前记得同时检查：塔位（`a_`）、基地（`i_`）、野区（`Hz`）不要压到新的墙体/河道里，
否则 AI 寻路和野怪站位会出问题。

### B. 加一张新地图（保留经典图）

```ts
// src/world/map/arena.ts
export function buildArenaMap(kit: MapKit) { ... return { u8, Oz, Bz, ... } }
```

```ts
// src/world/map/index.ts
import { buildArenaMap } from './arena'
export const activeMap = buildArenaMap
```

内核里把 import 换成 `buildArenaMap` 即可。地图对象结构见 `types.ts` 的 `GameMap`。

### C. 运行时整体替换

```ts
// 必须在 import kernel 之前执行（地图只在世界构建时读一次）
import { setMapFactory } from './extensions/api'
setMapFactory(buildArenaMap as any)
const kernel = await import('./kernel/starfall.core')
```

内核 `u8()` 已经是 `globalThis.__STARFALL_MAP__ ? __STARFALL_MAP__() : __MAP.u8()`。

## 场景（地表 / 水面 / 崖壁 / 散布物）

这些是**程序化生成**，不是资源：splat 贴图、地形网格、河流曲面、崖壁、草丛、石头、树、
AO 贴花、粒子气氛，都在内核 `nw()` 里按地图数据算出来 —— 所以改地图数据，场景会跟着变。

想在场景里**追加自己的东西**（碑、旗、灯、传送门……），用钩子：

```ts
import { registerSceneExtra } from './extensions/api'

registerSceneExtra(({ scene, map, terrain, kit }) => {
  const { Mesh, Geometry, Material, Vector3, Group } = kit
  // terrain.heightAt(x, z) 取地面高度；terrain.waterLevel 是水面高度
  const y = terrain.heightAt(0, 0)
  const g = new Group()
  g.name = 'my-monument'
  // ... 用 Geometry/Material 自己拼几何，然后 scene.add(g)
  scene.add(g)
})
```

钩子在内核建完地形后调用，拿到的是**同一个 scene 组**，所以和既有内容自然合批/排序。

> 注意：`kit` 暴露的是内核的 three.js 内部类（`Sn`=Mesh、`Bn`=BufferGeometry、
> `An`=材质、`dt`=Vector3、`Ji`=Group），接口不稳定；复杂场景建议直接在内核 `nw()` 里加构建步骤。
