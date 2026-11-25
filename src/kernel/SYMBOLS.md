# 内核符号索引

> **2026-11-20 收官**：全库顶层短名已 100% 语义化（`tools/inventory-shortnames.cjs` 复扫 `totalShort: 0`，原 1171 个），
> 且所有源码已转为 TypeScript（`src` 下 0 个 `.js` / 173 个 `.ts`）。
> 本索引原为「未语义化符号」清单，基于已废弃的 7 万行单文件内核的行号——现已全部失效，故移除。

## 现状

- **源码分层**：`core / sim / render / fx / ui / audio / world / ships / skills`，共 176 个 `.ts` 模块；`starfall.core.ts` 为 435 行薄入口。
- **短名盘点**：顶层 `node tools/inventory-shortnames.cjs` → `totalShort: 0`；函数内部 `node tools/inventory-locals.cjs` → 19162 → 18056 → 88 → 191 → **22**（第六轮后再治：伪语义/编号后缀清零，仅剩 `builder` 这一合法语义名 22 个；第五轮的 sum/sumX/rig/pose 等已按业务信号换成 `sideSign/skeleton/boneChainProjector/hitPulse` 等，详见 `SECTIONS.md`）。
- **model 文件领域语义化**（第五轮 + 第六轮）：第五轮 `inventory-model-names.cjs` + `plan-model-names.cjs` 改名 2256 条（`Extra+数字`/序数后缀归零）；第六轮 `inventory-model-semantic.cjs` 再按业务信号改名约 697 个声明（关节名→`xxxJoint`/链名→`xxxChain`、回调看调用点实参、动画量看 init 函数），重复词根名（`BeastRigBeastRigValue` 等）归零。5 个 model 文件伪语义名残留 **0**（仅 `builder` 合法名）。
- **命名工作单**（如需审计某个符号的语义）：`node tools/naming-worksheet.cjs <file.ts>`。
- **改名映射存档**：`tools/rename-maps/*.json`（44+ 批，含 `2026-11-20-bulk-phase1/2.json` 两次批量收官）。
- **迁移注记**：60 个存量压缩模块顶部有 `// @ts-nocheck`（隐式动态类型），其余 113 文件完整类型检查；可逐文件深化。
- **里程碑与命名约定**：见 `SECTIONS.md`（尤其文末「短名语义化收官 + 全量 JS→TS」节）。
