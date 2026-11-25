/**
 * 程序化模型聚合入口（拆分后）
 * ----------------------------------------------------------------
 * 实体构造器已按语义分组到 model-heroes / model-monsters / model-world，
 * 公共辅助在 model-kit。本文件保持原导出面，调用方无需改动。
 */
import { buildSwordsmanModel, buildArcherModel, buildShieldBearerModel, buildRangerModel, buildMageModel, buildXiangYuModel } from './model-heroes'
import { buildMossbackModel, buildAbyssDrakeModel, buildEmberGolemModel, buildStarColossusModel, buildFrostGolemModel } from './model-monsters'
import { buildMeleeMinionModel, buildSuperMinionModel, buildTeamTowerModel } from './model-world'

export { buildSwordsmanModel, buildArcherModel, buildShieldBearerModel, buildRangerModel, buildMageModel, buildXiangYuModel, buildMossbackModel, buildAbyssDrakeModel, buildEmberGolemModel, buildStarColossusModel, buildFrostGolemModel, buildMeleeMinionModel, buildSuperMinionModel, buildTeamTowerModel }
