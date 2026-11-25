/**
 * 星陨战纪 · Starfall —— 反混淆核心（kernel）
 * ---------------------------------------------------------------
 * 本文件由线上单文件 bundle 反混淆（prettier）而来，逻辑与线上 100% 一致。
 * 已做的三处改动，仅为"可维护/可扩展"，不改变行为：
 *   1. 文件头 import 英雄数据表（原为内联字面量，见 src/heroes/）
 *   2. 原 `kr = [...] , Se = {...}` 改为 `kr = Object.keys(HERO_DATA), Se = Object.assign({}, HERO_DATA)`
 *   3. 文件尾追加 export 块，导出各注册表给扩展层使用
 * 内部符号是压缩后的短名，按 §分区 注释导航，不要试图全局重命名。
 * 分区索引见 kernel/SECTIONS.md
 * ---------------------------------------------------------------
 */
import HERO_DATA from "../heroes/index";
import { HERO_IDS, HERO_TABLE } from "../heroes/registry";
import { buildClassicMap } from "../world/map/classic";
import { buildVfxTemplates } from "../vfx/templates";
import { getMonsterDisplayName, findUnitsInCone, finishHeroRecall, poseQuadrupedLegIk, applyHealTick, revealUnitAfterAttack, scheduleDelayedAction, resetSkillCooldown, faceUnitToward, applyHasteBuff, scheduleIfCasterAlive, teleportToPosition, QUADRUPED_GAIT_TABLE, dashTowardPoint, extendDisarmDuration, poseAllLegsIk, getBuffStackCount, tryUseHeroCooldown, removeBuffById, dealProcDamage, HEAL_TICK_SECONDS, spawnConfiguredProjectile, XIANGYU_PALETTE_ALIAS, GEOMETRY_TWO_PI, hasAnyBuff, reduceSkillCooldown, beginUnitAction, healTargetUnit } from './render/geometry-helpers'
import { clonePoint, applyStun, startDash, queryTargetsByDistance, applyAttackSpeedBuff, __makeGenericCastHandler, findMoveEndpoint, emitSkillFx, startLeap, makeTargetFilter, applyShieldBuff, scaleSkillDamage, applySlow, dealSkillHit, applyKnockup, dealSkillDamage } from './sim/generic-cast-handler'
import { bootApp } from './core/boot'
import { getModelKeys, heroModelScaleByHero, startMatch, getMonotonicTime } from './sim/match-lifecycle'
import { Animator, COSTUME_PALETTE, drawPortraitFallback, minionModelKey, aimPropAtTarget, ruinModelKey, YEQUE_RIG_PROPORTIONS, MODEL_BUILDER_TABLE, createPreviewStage, coreModelKey, XINGLI_RIG_PROPORTIONS, configurePreviewRenderer, XIANGYU_COLOR_PALETTE, RANGER_PALETTE, ROBE_COSTUME_PALETTE, FENGLING_RIG_PROPORTIONS, FENGLING_BOW_SPEC, YEQUE_ARM_SPAN_SCALE, monsterModelKey, heroModelKey, CAST_ANIM_SPECS, PORTRAIT_CAMERA_PARAMS, createHeroPreview, FURL_ROW_COUNT, FENGLING_DEG_TO_RAD, getOrBuildModel, PORTRAIT_YAW_RANGE, YEQUE_DEG_TO_RAD, towerModelKey } from './render/hero-preview'
import { BODY_PROPORTIONS, BODY_ANCHOR_HEIGHTS, SkeletonSolver, WARRIOR_PALETTE, DEG_TO_RAD, HERO_MODEL_SCALE, WARRIOR_PROPORTIONS, buildWorldSync, MODEL_ANGLE_TO_RAD } from './ships/skeleton-solver'
import { Simulation, spawnProjectile } from './sim/simulation'
import { buildWorldStaged } from './world/world-builder'
import { applyDamage, findBuffByKey, MINION_AGGRO_QUERY_RADIUS, ATTACK_THINK_INTERVAL, EMBER_BURN_TICK_INTERVAL, ATTACK_TARGET_PADDING, EMBER_SLOW_DURATION, PERIODIC_CHECK_INTERVAL, applyStatusEffect, EMBER_BURN_DURATION, healUnit, isStatusImmune, COMBAT_QUERY_BUFFER, refreshStructureInvulnerability, TOWER_FOCUS_DURATION } from './sim/combat-behavior'
import { hasActiveBuff, rejectCast, cancelAttackWindup, ALL_CAST_SLOT_IDS, removeBuff, refreshStatusFlags, STAT_MODIFYING_BUFF_IDS, isValidAimPoint, ATTACK_ACQUIRE_RANGE, invokeBuffRemoval, tryCastSkill, HARD_CROWD_CONTROL_STATES, ATTACK_RANGE_TOLERANCE, ATTACK_TARGET_SEARCH_RADIUS, AUTO_BUY_CHECK_INTERVAL, cancelRecall, markRevealedOnAttack, RESPAWN_GUARD_DURATION } from './sim/skill-cast'
import { SCRATCH_VEC_A, rotateVectorByQuaternion, solveTwoBoneIK, accumulateAncestorTransform, multiplyQuaternions, SCRATCH_QUAT_B, SCRATCH_VEC_B, SCRATCH_QUAT_A, ANCESTOR_INDEX_CHAIN, IK_SWAY_Z_BIAS, IK_SWAY_X_BIAS } from './fx/effect-spawner'
import { EFFECT_STONE_DARK_COLOR, EFFECT_SCRATCH_MATRIX, EFFECT_BLOB_BASE_COLOR, EFFECT_FULL_TURN_RADIANS, scatterNicheDecor, EFFECT_CRYSTAL_TIP_COLOR, EFFECT_AMBER_LIGHT_COLOR, EFFECT_CRYSTAL_TINT_COLOR } from './fx/effect-geometry'
import { RANDOM_PROP_TRUNK, RANDOM_PROP_TRUNK_BASE, finalizeMeshBuilder, buildRandomProp, RANDOM_PROP_ENV } from './world/random-props'
import { MOUNTAIN_BASE_HEIGHT, buildMountainRange } from './render/toon-material-factory'
import { showAppCardDialog, injectHudStyle } from './ui/dom-snapshot'
import { LineBatch } from './render/line-batch'
import { buildFenglingPoseSet } from './render/unit-poses-extra3'
import { buildAtmosphereLayer } from './world/map-nav-utils'
import { HeroAgent, KILL_WINDOW_SLACK_BY_HERO } from './sim/hero-agent'
import { getStoredSetting, setStoredSetting, createHudRoot } from './ui/hud-root'
import { buildLobedBlobMesh, buildSceneryProps } from './world/scenery-props'
import { FULL_TURN_RADIANS, buildPuffedBlobMesh, buildCrystalShard, buildTubeAlongPath, buildBaseDecorations, getSubdividedIcosphere, buildTaperedFrustum } from './fx/fx-random'
import { RING_FRAGMENT_SHADER, RING_STYLE_PLAYER, RING_VERTEX_SHADER, RING_STYLE_ENEMY_HERO, RING_STYLE_MINION, RING_STYLE_SHADOW } from './fx/fx-enums'
import { buildTerrainGround, generateTerrainTextures } from './world/geometry-projection'
import { GameLoop } from './sim/game-loop'
import { buildBasePedestal, buildTeamBaseRuinModel } from './ships/team-base-variant'
import { createGrassTexture, fillCanvasWithPattern } from './render/canvas-factory'
import { buildXingliPoseSet } from './render/unit-poses-extra2'
import { updateSetting, getBooleanSetting, createCoachPanel } from './ui/coach-panel'
import { GRID_C_CLIFF_GLOW_STOPS, GRID_C_BASE_DISTANCE, GRID_C_CLIFF_BANDS, computePolygonRimFrames, GRID_C_GLOW_LOW, buildMapBorder, extrudeRibbonBand } from './world/grid-c'
import { bindInputControls } from './ui/input-controls'
import { buildWaterfalls } from './world/grid-b'
import { GRID_A_STONE_DARK, GRID_A_HALF, GRID_A_STONE, GRID_A_LEDGE_HEIGHT, scatterBoundaryVegetation, GRID_A_ROCK, GRID_A_ROCK_LIGHT, GRID_A_DARK_FOLIAGE, GRID_A_PLATEAU_EDGE_HEIGHT, GRID_A_SLOPE_LIMIT, GRID_A_STONE_WARM, GRID_A_ROCK_DARK, GRID_A_ROCK_WARM, GRID_A_FOG, GRID_A_MOSS, GRID_A_LOWLAND_DEPTH, GRID_A_PLATEAU_HEIGHT } from './world/grid-a'
import { getNextBuildItem, getItemSellValue, getEffectiveItemCost, evaluatePurchase, BLOCK_REASON_LABELS, isRecommendedItem, createShopPanel, MIN_ITEM_COST, canBuyItem } from './ui/shop-panel'
import { castAlongClearLine, LANE_DECOR_COLOR_A, LANE_DECOR_MARGIN, ENGAGE_SCRATCH_MATRIX, LANE_DECOR_COLOR_D, LANE_DECOR_WIDTH_SCALE, ENGAGE_SCRATCH_POSITION, LANE_DECOR_COLOR_B, LANE_DECOR_COLOR_C, runHeroEngage, ENGAGE_SCRATCH_NORMAL, SCENERY_FOG_PALETTE } from './sim/hero-engage'
import { scatterPlateauVegetation } from './fx/fx-batch'
import { createGuideArrow } from './ui/hud-arrows'
import { generateTerrainNoiseTextures, smoothStepBetween, createTileableDataTexture, clampToUnitRange, clampToByteRange } from './render/texture-factory'
import { createScoreboard, formatScoreboardClock } from './ui/scoreboard-panel'
import { buildYequePoseSet } from './render/unit-poses-extra'
import { NEUTRAL_BASE_SPEC, buildStructureModelB } from './ships/qu-component'
import { TEAM_COLOR_TABLE, TEAM_PALETTE_KEYS, TEAM_CRYSTAL_SPEC, BUILDING_GEOMETRY_CACHE, STRUCTURE_PALETTE, SURFACE_MATERIAL, buildStructureModelA, STRUCTURE_MATERIAL_SPEC, TOWER_BUILDING_SPEC, BASE_BUILDING_SPEC } from './ships/zu-component'
import { TEAM_BASE_PALETTES, BASE_GLOW_COLOR, MATERIAL_PRESETS, SURFACE_MATERIAL_ALT, buildStarCrackTube, buildTeamBaseModel, FULL_CIRCLE_RADIANS, hashNoise, METAL_MATERIAL_SPEC } from './ships/yw-component'
import { inverseLerpClamped, makeBoneChainProjector, hermiteSmoothStep, hitImpactPulse, easeOutQuad, windupEaseCurve, smoothFalloff, buildTowerModel, squareValue } from './world/po-system'
import { composeMatrixTRS, TF_PETAL_COLORS, buildWorldDecor, sampleMonsterCampTint, vectorToAngle, TF_AMBER } from './world/tf-system'
import { renderHeroRoster, createHeroSelect, isOverlayAvailable, openDialog } from './ui/rh-widget'
import { trackEpicObjectives } from './sim/epic-objectives'
import { skillTagLabel, createSkillBar } from './ui/skill-bar'
import { createFormattedTextWriter, bindClassToggle, createCssVarWriter, createStatusStrip, hexToRgbString, skillTagHtml, toggleClassOn, createTextWriter } from './ui/status-strip'
import { MINIMAP_STYLE, createMinimap } from './ui/minimap'
import { MINIMAP_TUNING, minimapWorldToScreen, minimapUnitDot, mountMiniMapWidgets, MINIMAP_WIDGET_STATE } from './ui/minimap-widgets'
import { TeamAi, HERO_AI_ACTION_MAP } from './sim/team-ai'
import { applyDeathPose, DEATH_POSE_TUNING } from './render/unit-poses'
import { BOT_GROUP_TIME_SEC, RETREAT_HP_THRESHOLD, BOT_GOAL_LABELS, BOT_LANE_ORDER, forEachVisibleUnit, MatchFlow, findNearestUnit, estimateAttackReady, BOT_ROLE_ORDER, BOT_TUNING } from './ui/match-flow'
import { injectSkillTagStyles, createHudPanel, renderHeroNameTag, buildItemTooltip, formatNumber, escapeHtml, formatGameClock, getItemTooltip } from './ui/hud-panels'
import { EASING_FUNCTIONS, buildFxSpritePose, lerpNumeric, spriteWorldTransform, applyPose, clampUnitInput, bellPulseWindow, readPoseBones, remapSmoothStep, copyPoseInto, parsePoseSpec } from './render/fx-sprite'
import { ABILITY_KEYS, bannerTeamClass, HERO_ID_LIST, heroBannerLabel, makeBannerTag, ROLE_TINT_COLORS, BANNER_ANIM_CACHE, heroNameForBanner, __heroRow, createBanner, ROLE_BRIEF_TEXTS, ABILITY_LABELS, heroRoleTag, killFeedLine, streakBannerText } from './ui/banner'
import { buildArenaDecor } from './fx/fx-helpers'
import { FOG_FRAGMENT_SHADER, FOG_VERTEX_SHADER } from './render/fog-shaders'
import { buildButtress } from './render/model-parts'
import { HUD_ZINDEX_CSS } from './ui/hud-zindex-styles'
import { INFO_ICON_PATH } from './ui/svg-path-assets'
import { WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER } from './render/water-shaders'
import { HOWTO_PANEL_CSS } from './ui/howto-styles'
import { UNIT_ATTRIBUTE_FRAGMENT_SHADER, UNIT_ATTRIBUTE_DECLS, UNIT_ATTRIBUTE_VERTEX_SHADER } from './render/unit-attribute-shaders'
import { InstanceBatch } from './render/instance-batch'
import { buildRiverMesh } from './world/river-geometry'
import { buildInterleavedFloatAttribute } from './render/geometry-utils'
import { TERRAIN_DECAL_FRAGMENT_SHADER, DECAL_EDGE_TIP_COLOR, TERRAIN_DECAL_VERTEX_SHADER, DECAL_EDGE_DARK_COLOR, DECAL_CENTER_COLOR, DECAL_EDGE_LIGHT_COLOR, DECAL_MESH_SEGMENTS } from './render/terrain-decal-shaders'
import { HINT_CARD_CSS } from './ui/hint-card-styles'
import { HUD_SIDEBAR_CSS } from './ui/hud-sidebar-styles'
import { INSTANCE_VERTEX_SHADER, INSTANCE_FRAGMENT_SHADER, INSTANCE_MAX_PER_FRAME } from './render/instance-shaders'
import { SCOREBOARD_CSS } from './ui/scoreboard-styles'
import { LOADING_SCREEN_CSS } from './ui/loading-screen-styles'
import { SVG_BRAND_MARK, LOGO_STREAK_CSS, HOME_SCREEN_CSS } from './ui/svg-icon-assets'
import { BANNER_SCALE_BY_STREAK, BANNER_ANIM_FAST, BANNER_ANIM_MID, BANNER_MAX_STREAK, BANNER_WIDTH_BY_STREAK, BANNER_ANIM_SLOW, HUD_BANNER_CSS } from './ui/hud-banner-styles'
import { DEATH_OVERLAY_CSS } from './ui/death-overlay-styles'
import { HUD_STAT_FADE_ALPHA, HUD_STAT_MAX_LINES, STATUS_ID_TO_INDEX, HUD_STAT_CSS } from './ui/hud-stat-styles'
import { PARTICLE_SOFT_VERTEX_SHADER, PARTICLE_SOFT_FRAGMENT_SHADER } from './render/particle-shaders-extra'
import { RESULT_SCREEN_CSS } from './ui/result-screen-styles'
import { SKILL_SLOT_ORDER, SUMMONER_ICON_POSITIONS, SKILL_KEY_LABELS, SKILL_ICON_POSITIONS, HUD_SKILLS_CSS, SKILL_SLOT_NAMES } from './ui/hud-controls-styles'
import { HUD_COMPACT_BREAKPOINT_PX, itemShortName, BOOT_TIER_LABELS, KILLFEED_INTERVAL_SECONDS, TOAST_FADE_SECONDS, TOAST_HOLD_SECONDS, itemBrief, HUD_SHOP_CSS_COMPACT, ITEM_CATEGORY_LABELS, ITEM_CATEGORY_ORDER } from './ui/hud-shop-styles'
import { VEGETATION_FRAGMENT_SHADER, MONSTER_TERRAIN_PALETTE, VEGETATION_VERTEX_SHADER } from './render/vegetation-shaders'
import { CellGeometryBuilder, MeshBuilder, polygonArea, createVisualKit, polygonCentroid } from './render/buff-view'
import { grantGold, LAST_HIT_AGGRO_WINDOW, clearDrakeBreath, beginDrakeBreath, onMinionDeath, CAMP_BUFFER, MONSTER_REGEN_FRACTION, MONSTER_LEASH_GRACE, findKillCreditHero, recomputeStats, initJungleCamps, interruptDash, MONSTER_RESPAWN_HEAL_FRACTION, grantXp, updateDash, resolveUnitOverlaps, updateJungleCamps, onHeroDeath } from './sim/unit-stats'
import { getSkillValueRaw, castDirectionWithError, AREA_THREAT_KIND_BY_VISUAL, castAtWithScatter, scratchPoint, getCastRange, canCastAlongLine, isTargetSlowed, computeClusterCenter, getCastDelay, pointSegmentDistanceSq, makeDamage, getScaledSkillValue, countTargetsInBand, computeSkillDamage, SKILL_PRIORITY_BY_HERO, HERO_ACTION_SPECS, hasBuffById, computeBasicAttackDamage, estimateAttackDps, UnitCommander, clampToRange, findBestAoeAimPoint, __defaultActionSpec, predictLeadAimPoint, allyProximityFactor, isLineBlockedByMinions, buildActionSpec, canHitTarget, chooseCastableSkill, makeDash, dist2, effectiveHp, estimateFightHorizon, estimateSkillDamage, estimateTimeToKill, expectedDps, foeProximityFactor, skillRange, resolveDifficulty, maxCrowdControlDuration, canCastComboSkill, availableManaFraction, skillValue } from './sim/skill-evaluation'
import { formatRangeLabel, SKILL_SLOT_LABELS, SKILL_KEY_BINDINGS, SUMMONER_SPELL_KEYS, HERO_SELECT_CSS, SKILL_SLOT_KEYS } from './ui/hero-select-styles'
import { STATUS_FX_DEFS, STATUS_FX_INDEX } from './render/status-effect-fx'
import { ALL_UNIT_VFX, STATUS_RED_HOT, ELEMENT_COLORS, SIGIL_RADIUS_SCALE, STATUS_VIOLET_DEEP, FENGLING_PALETTE, FROST_SIGIL_BLUE, CHIJIN_PALETTE, STATUS_EMBER_ORANGE, holdDecalSlot, STATUS_GREEN_LIGHT, STATUS_GOLD_BRIGHT, UnitVisualView, sinePulse, STATUS_GOLD_AMBER, makeSigilEffect, PANYUE_HERO_PALETTE, STATUS_VIOLET_LIGHT, STATUS_EMBER_LIGHT, scaleDecalRadius, STATUS_GLOW_GOLD, STATUS_ICE_BLUE, expiryFlicker, YEQUE_PALETTE_ALT, STATUS_WARM_GOLD, accumulateSteps, STATUS_GOLD_PALE, STATUS_GREEN_DEEP, XINGLI_PALETTE_ALT, STATUS_AQUA_BLUE, FROST_SIGIL_DEEP_BLUE } from './render/unit-visual-effects'
import { getPassiveFactory, faceTowards, COMBAT_MEMORY_WINDOW, NEARBY_QUERY_RADIUS, markNonEnumerable, getPassive, stopMovement, MOVE_DIRECTION, moveTowards, MAX_WINDUP_TIME, MONSTER_ACTIVE, registerCastHandler, RECENT_TARGET_WINDOW, MOVE_IDLE, isStructure, TeamContext, canTarget, getCastHandler, cancelArea, createMinionUnit, spawnArea, setDirectionMove, updateMovement, createBaseUnit, createCoreUnit, createTowerUnit, navigateToGoal, isSummonerSpell, startAction, TELEPORT_SEARCH_RADIUS, MONSTER_DEAD, teleportUnit, SEPARATION_PUSH_FACTOR, isTargetable, SUMMONER_SPELL_SPECS, registerWildcardHandler, setPathMove, registerPassiveDef, MONSTER_IDLE, MAX_SEPARATION_STEP, SEPARATION_DISTANCE_FACTOR, createMonsterUnit, tickCrowdControl, CAST_HANDLERS, registerPassiveFactory, updateAreas, updateBushVisibility, createDashState } from './sim/combat-core'
import { PANYUE_SKILL_VFX, emitMoteBurst, XINGLI_VFX_PALETTE, emitMeleeSlashFx, XINGLI_MOTE_SPAWN, playMinionDeathFx, BATTLE_EVENT_VFX, playHeroDeathFx } from './render/unit-skill-fx'
import { BUCKET_MIN, BUCKET_HIGH, buildTerrainFieldTextures, SIGN_NEGATIVE, lerpScalar, createFxOverlay, paintShadowBlobs, applyRankDrawRange, scratchVecB, smoothStepScalar, colorToRgb, scratchVecA, clamp01Scalar, hashBucket, BUCKET_MAX, lerp3, BUCKET_LOW, scratchMat3, scale3, getClassicMapData, BUCKET_MID } from './fx/particle-system'
import { getUnitHeight, facingScratch, playTeamUltBuffFx, computeFacingDirection, getFirstValue, MONSTER_VFX_HANDLERS, UnitShadowView, CHIJIN_VFX_HANDLERS, getSkillWidth, involvesPlayer, FENGLING_VFX_HANDLERS, readBuffIcons, getSkillRange, playMonsterDeathBurst } from './render/unit-views'
import { SKILL_VISUALS, VfxSystem } from './fx/vfx-system'
import { setLastPointerPos,  createProgressBar, makeIconByName, createSlider, SVG_STROKE_ATTR, isTooltipOpen, uToCalc, injectThemeStyles, buildHeroPortraitIcon, expandCssUnits, bindTooltip, getHudIconPath, laneLabels, hasOpenDialog, makeIconButton, scheduleUiUpdate, statusEffects, makeSegmentedControl, createTabs, showModalDialog, isFocusVisibleButton, SVG_FILL_ATTR, injectStyleSheet, HUD_ICON_PATHS, createEl, createIconEl, iconFor, createToggle, svgToDataUrl, createLaneIcon, makePanelBody, closeDialogs, bindUiSounds, makePanel, makeBadge, refreshHud } from './ui/dom-kit'
import { VFX_RIBBON_STYLES, AimIndicator, AreaEffectView, emitGoosePlume, findRecentHitEvent, emitRockChips, emitSparkBurst, HIT_FEEDBACK_TUNING, emitDustPuff, emitSphereGlow, emitDrakeBreath, emitInkStreakDecal, emitFlashBurst, showDrakeBreathWarning, emitPillarGlow, emitPlumeBurst, emitDustTrail, FX_ANCHOR_SCRATCH_POSITION, emitSoftSparkBurst, emitEarthChunks, emitDrakeBreathAftermath, VFX_TEMPLATE_TABLE, emitTwinSlashGlow, recordHitEvent, emitInkDotBurst, emitInkBurst, TrailBuilder, emitShards, SLASH_K_NORMALIZER, VFX_EMITTERS, emitGroundImpact, emitRingDecal, emitSphereCoreGlow, emitEmbers, emitGlint, emitGrassBurst, emitSlashGlow, emitHitSparks, emitShieldGlow, emitHoopGlow, AREA_ALPHA_AGE_SCALE, emitScorchDecal, emitRockBarrage } from './fx/emitters'
import { makeSpriteSpec, buildStagedAssets, InstancedSpriteBuffer, RIBBON_VERTEX_SHADER, SPRITE_STRIDE, RibbonState, SPRITE_LAYOUTS, ShapePool, SPRITE_CAPACITY, RIBBON_FRAGMENT_SHADER, RIBBON_COMPOSE_SHADER, loadAssetsStaged, MAX_SPRITES, makeRibbonSpec } from './render/sprite-ribbons'
import { smoothStepVfx, FX_SHAPES, FX_STYLES, triangleCountForShape, VFX_LIFETIME, ROCK_SHAPES, resetVertexColors, applyVertexColors, hexToColor, ObjectPool, SeededRandom, VFX_COLORS, VFX_VERTEX_SHADER, VFX_FRAGMENT_SHADER, buildGroundRingGeometry, SHAPE_SEGMENT_COUNTS, FX_TWO_PI, buildGroundDiscGeometry, easeOutBack, HERO_VFX_PALETTES } from './fx/fx-definitions'
import { sampleLanePath, TERRAIN_FRAGMENT_SHADER, buildTerrainBoundary, TERRAIN_VERTEX_SHADER, riverFlowDirection, waterDetailLevel } from './render/terrain-shaders'
import { configureParticleMaterial, buildParticleAtlas, PARTICLE_TONEMAP_GLSL } from './render/noise-geometry'
import { makeCanvasTexture, starPath, BUFF_DESCRIPTIONS, SVG_STROKE_CURRENT, describeSkillFull, itemIconFor, describeMonsterBuff, SVG_FILL_CURRENT, riverNameFor, makeStarHudPath, ICON_LIGHT_HIGHLIGHT, describeCampBuff } from './render/procedural-art'
import { mixColor, formatBriefStats, KILL_FEED_LABELS, lightenColor, ICON_FRAME_KINDS, round2, BASIC_SKILL_SPECS, renderIconFrame, makeSvgIcon, darkenColor, radialGradientDef, gradientCircle, polarPoint, describeSkillShape, SKILL_ICON_TABLE, describeSkillRange, buildIconSvg, extractStatLabels, linearGradientDef, diamondPath, radialGlowDef, EVENT_PRIORITIES, EQUIP_SLOT_NAMES, SKILL_EFFECT_COLORS, ICON_OUTLINE_COLOR } from './ui/icon-theme'
import { toRgbChannels, sampleColorGradient, MATERIAL_KINDS, RIBBON_WIDTH_PROFILE, ModelBuilder, smoothStep01, emitFurTufts, TERRAIN_LOOK, scaleRgbChannels, clampUnit, applyBreathingPose, emitTaperedTube, emitConeSkirt, lerpValue, composeMatrix, getLodDistance } from './render/model-builder'
import { PROJECTION_SCALE, CameraRig, DecalLayer, GpuTimer, SUN_HEIGHT_RATIO, LightRig, OutlineRegistry, isGpuTimingEnabled, SUN_DIRECTION, CAMERA_PEEK_MAX_GROUND, LIGHT_TARGET_SCRATCH, disposeSceneResources, SUN_GROUND_DIRECTION } from './render/scene-rigs'
import { DAMAGE_TYPE_KINDS, CanvasCache, DprCache, HudMarkers, FLOAT_TEXT_LIFT, FLOAT_TEXT_FADE_END, FLOAT_TEXT_OFFSETS, FLOAT_TEXT_MAX_STACK, TextRasterizer, floatTextEaseOut, FLOAT_TEXT_POOL_SIZE, FLOAT_TEXT_STYLES, FLOAT_TEXT_MIN_GAP, FLOAT_TEXT_FADE_START } from './render/text-rasterizer'
import { DecalPen, MAX_DECALS, DECAL_FRAGMENT_SHADER, GROUND_FX_KINDS, DECAL_VERTEX_SHADER, DECALS_FILL_RATIO_BY_QUALITY, DECAL_STRIDE, PERMANENT_DECAL_LIFETIME } from './render/decal-pen'
import { deathGrayscaleCssFilter, releaseRenderer, viewDirection, detectGraphicsQuality, PostRenderer, acquireRenderer, supportsFloatRenderTargets, scratchRay, groundPlane } from './render/post-pipeline'
import { installCustomToneMapping, createOutlineMaterial, COLOR_GRADE, createUnitSkinMaterial, makeLightUniforms, createToonMaterial, createXrayMaterial, createUnitMaterial, SHARED_SCRATCH_VECTOR_A, buildNoiseTexture, SHARED_SCRATCH_VECTOR_B, createCanvas, SHARED_SCRATCH_QUATERNION, disposeTextureCache, rockTexture, patternedMaterials, setUnitPatternsEnabled, FastRandom, setLightTint, forEachNeighbor, hashNoise2D, advanceGlobalTime, CUSTOM_TONE_MAPPING, createMaterialState, valueNoise2D, fbmNoise2D } from './render/foundation'
import { XRAY_FRAGMENT_SHADER, OUTLINE_FRAGMENT_SHADER, OUTLINE_VERTEX_SHADER, UNIT_VERTEX_SHADER, UNIT_SKIN_FRAGMENT_SHADER, XRAY_VERTEX_SHADER, UNIT_FRAGMENT_SHADER, UNIT_SKIN_VERTEX_SHADER } from './render/unit-shaders'
import { SURFACE_FRAGMENT_SHADER, SURFACE_VERTEX_SHADER } from './render/surface-shaders'
import { GLSL_DEFAULT_NORMAL, GLSL_SIDE_FILL, GLSL_LIGHT_TINT, GLSL_VERTEX_COMMON, GLSL_TIME_UNIFORM, GLSL_HASH_NOISE, GLSL_KICK, GLSL_TONEMAP, GLSL_DITHER, GLSL_ADDITIVE } from './render/glsl-chunks'
import { PolylineProjector, getLaneProgress, LANE_NAMES, projectParamOnSegment } from './world/lane-progress'
import { smoothstepClamped, monsterRadius, MONSTER_KIND_INDEX, signedDistanceToPolygon, WATER_LEVEL, TERRAIN_PALETTE_INDEX, MapGeometry, TOWER_PAD_RADIUS, BASE_PAD_RADIUS, MAX_CAMP_COUNT, SHADOW_LENGTH_FACTOR, MAP_GRID_HALF_EXTENT, paintSegmentIntoGrid } from './world/map-geometry'
import { capsuleHitsAnyCircle, NavGrid } from './world/nav-grid'
import { pointSegmentDistance, isPointInPolygon } from './world/geometry-2d'
import { createAudioMixer } from './audio/audio-mixer'
import { SFX_COMBAT_CUE_TABLE, SFX_SKILL_CAST_CUES, __registerSound, __registerSoundRuntime, SFX_RUNTIME_CUE_TABLE } from './audio/sfx-cues'
import { Nh, SKILL_EFFECT_KINDS, US, ea, eh, f5, lm, z0 } from './skills/skill-values'
import { defineSfxCue } from './audio/sfx-primitives'
import { UI_THEME_CSS, UI_THEME_COLORS, UI_COMPONENT_CSS } from './ui/svg-icons'
import { buildRangerModel, buildFrostGolemModel, buildArcherModel, buildTeamTowerModel, buildSuperMinionModel, buildMeleeMinionModel, buildStarColossusModel, buildSwordsmanModel, buildXiangYuModel, buildMageModel, buildAbyssDrakeModel, buildMossbackModel, buildEmberGolemModel, buildShieldBearerModel } from './models'
import { MINION_STATS, WAVE_SCHEDULE, TOWER_STATS, TOWER_RULES, CORE_STATS, CORE_RULES, JUNGLE_RULES, MONSTER_STATS, ECONOMY, xpToNext, heroRespawnSeconds, LATE_GAME_SCALING, VISION_RANGES } from './game-balance'

import { HERO_ATTACK_SFX, HERO_HIT_SFX } from './attack-sfx-map'

// ---- Three.js r180（官方 npm 包，版本锁定见 package.json）----
// 保留打包后的短别名，使其余游戏代码零改动；新增功能请直接用官方类名。
import {
  ACESFilmicToneMapping,
  AddEquation,
  AdditiveBlending,
  AlphaFormat,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  ByteType,
  CanvasTexture,
  CircleGeometry,
  ClampToEdgeWrapping,
  Clock,
  Color,
  ConeGeometry,
  CustomBlending,
  CustomToneMapping,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Float32BufferAttribute,
  FloatType,
  Fog,
  FrontSide,
  Frustum,
  GreaterDepth,
  Group,
  HalfFloatType,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InstancedMesh,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  IntType,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  NearestFilter,
  NoBlending,
  NoColorSpace,
  OctahedronGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  RawShaderMaterial,
  Ray,
  RED_GREEN_RGTC2_Format,
  RED_RGTC1_Format,
  RedFormat,
  RedIntegerFormat,
  RepeatWrapping,
  RGB_BPTC_SIGNED_Format,
  RGB_BPTC_UNSIGNED_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_2BPPV1_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
  RGBA_ASTC_10x10_Format,
  RGBA_ASTC_10x5_Format,
  RGBA_ASTC_10x6_Format,
  RGBA_ASTC_10x8_Format,
  RGBA_ASTC_12x10_Format as $5,
  RGBA_ASTC_12x12_Format,
  RGBA_ASTC_4x4_Format,
  RGBA_ASTC_5x4_Format,
  RGBA_ASTC_5x5_Format,
  RGBA_ASTC_6x5_Format,
  RGBA_ASTC_6x6_Format,
  RGBA_ASTC_8x5_Format,
  RGBA_ASTC_8x6_Format,
  RGBA_ASTC_8x8_Format,
  RGBA_BPTC_Format,
  RGBA_ETC2_EAC_Format,
  RGBA_PVRTC_2BPPV1_Format,
  RGBA_PVRTC_4BPPV1_Format,
  RGBA_S3TC_DXT1_Format,
  RGBA_S3TC_DXT3_Format,
  RGBA_S3TC_DXT5_Format,
  RGBAFormat,
  RGBAIntegerFormat,
  RGBFormat,
  RGFormat,
  RGIntegerFormat,
  Scene,
  UniformsLib,
  ShaderChunk,   // 游戏启动时会改写 tonemapping_pars_fragment（自定义色调映射）
  ShaderMaterial,
  ShapeUtils,
  ShortType,
  SIGNED_RED_GREEN_RGTC2_Format,
  SIGNED_RED_RGTC1_Format,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  UniformsUtils,
  UnsignedByteType,
  UnsignedInt101111Type,
  UnsignedInt5999Type,
  UnsignedIntType,
  UnsignedShort4444Type,
  UnsignedShort5551Type,
  UnsignedShortType,
  Vector2,
  Vector3,
  Matrix3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'

// Three.js 内部复用的临时向量/四元数（原内联副本中的模块级 scratch 变量）

import { ARENA_PALETTE, SIDE_FILL_FACTOR, LIGHT_TINT_GRID_SIZE, LIGHT_TINT_GAIN, NEUTRAL_LIGHT_TINT_TEXTURE, ARENA_SHARED_UNIFORMS } from './arena-palette'

installCustomToneMapping()

import { FULLSCREEN_VERT, BLOOM_PREFILTER_FRAG, BLUR_FRAG, BLOOM_COMPOSITE_FRAG, BLOOM_LEVELS, BLOOM_LEVEL_WEIGHTS } from './bloom-shaders'

import { POSTFX_FRAGMENT } from './postfx-shader'

import { QUALITY_PRESETS } from './quality-presets'

import { ATLAS_COLS, ATLAS_ROWS, ATLAS_CELL_SIZE, PARTICLE_KIND, clamp01, smoothstep, TWO_PI } from './particle-atlas'

// 几何体合并：直接使用 Three.js 官方 addon（行为已与内联副本逐字节比对一致）
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

import { ParticleSprite } from './particle-sprite'

import { NodeTree } from './node-tree'

import { UNIT_MODEL_SCALE } from './unit-model-config'

// ── 项羽专属调色板（玄黑重甲 / 赤红披风 / 鎏金饰件）

if (typeof window < "u") {
  const n = (pointerEvent) => {
    pointerEvent.pointerType === "mouse" && setLastPointerPos(pointerEvent.clientX, pointerEvent.clientY)
  }
  ;(window.addEventListener("pointermove", n, { capture: !0, passive: !0 }), window.addEventListener("pointerdown", n, { capture: !0, passive: !0 }))
}

import { SCENE_SKY_PALETTES } from './scene-sky-palettes'

import { ItemTable, ItemList, BaseAttackRange, CastFailMessage, formatPercent, LaneName, formatTowerLabel } from './equipment'

;[...Object.keys(HUD_ICON_PATHS)]

/* ============================================================
 * 扩展补丁：为"只有数据、没有玩法规格"的英雄生成缺省规格
 * —— 让新增英雄在 Oa 表遍历时不报错，并能用通用结算打出基础效果。
 * 对内置 5 个英雄无影响（它们都有手写规格）。
 * ============================================================ */

for (const __id of HERO_IDS) if (!HERO_ACTION_SPECS[__id]) HERO_ACTION_SPECS[__id] = __defaultActionSpec(__id);
HERO_IDS.flatMap((heroId) => [HERO_ACTION_SPECS[heroId].s1, HERO_ACTION_SPECS[heroId].s2, HERO_ACTION_SPECS[heroId].ult])

import { AI_DIFFICULTY_PRESETS } from './ai-difficulty'

import { HERO_AI_PERSONALITY, AI_TUNING, SKILL_SLOTS } from './ai-tactics'

registerWildcardHandler("recall", {
  canCast: (lookupKey, heroUnit) => (hasActiveBuff(heroUnit, "recall") ? "disabled" : null),
  cast(castContext) {
    const { sim: battleWorld, caster: caster } = castContext
    ;(stopMovement(caster),
      (caster.h.atkOrder = !1),
      applyStatusEffect(battleWorld, caster, "recall", { duration: ea.recall.channel, sourceId: caster.id, merge: "replace", onExpire: finishHeroRecall }),
      startAction(battleWorld, caster, "channel", 0, !1),
      battleWorld.fx("recall_start", caster.pos, caster.team, { unitId: caster.id }))
  },
})

registerWildcardHandler("heal", {
  cast(castContext) {
    const { sim: battleWorld, caster: caster } = castContext
    ;(applyStatusEffect(battleWorld, caster, "restore", { duration: ea.heal.duration, sourceId: caster.id, merge: "replace", tickInterval: HEAL_TICK_SECONDS, onTick: applyHealTick }), battleWorld.fx("heal", caster.pos, caster.team, { unitId: caster.id }))
  },
})
registerWildcardHandler("flash", {
  aim: "facing",
  cast(castContext) {
    const { sim: battleWorld, caster: caster, dir: castDirection } = castContext,
      xConfig = { x: caster.pos.x, y: caster.pos.y },
      flashRange = ea.flash.range,
      teleportUnitResult = teleportUnit(battleWorld, caster, xConfig.x + castDirection.x * flashRange, xConfig.y + castDirection.y * flashRange)
    battleWorld.fx("flash", teleportUnitResult, caster.team, { unitId: caster.id, from: xConfig, to: { x: teleportUnitResult.x, y: teleportUnitResult.y }, dir: { x: castDirection.x, y: castDirection.y } })
  },
})

import { PANYUE_PASSIVE, PANYUE_FISSURE_TICK_INTERVAL, PANYUE_SLOW_DURATION, PANYUE_UNSTOPPABLE_BONUS, PANYUE_AIM_RANGE_FACTOR, CHIJIN_PASSIVE, CHIJIN_S1_CAST_DELAY, XINGLI_PASSIVE, XINGLI_S1_CAST_DELAY, XINGLI_METEOR_COUNT, XINGLI_METEOR_RADIUS, XINGLI_ULT_DELAY_COMPENSATION, randomPointInRadius, castXingliMeteorBarrage, FENGLING_PASSIVE, FENGLING_S1_CAST_DELAY, FENGLING_ULT_DELAY_COMPENSATION, YEQUE_PASSIVE, YEQUE_S2_CAST_DELAY, YEQUE_SHADOW_DURATION, YEQUE_SHADOW_VALUE, SPELL_SHIELD_HP_RATIO, ITEM_PASSIVE_VALUE_UQ, ITEM_PASSIVE_VALUE_PQ, REGEN_OUT_OF_COMBAT_DELAY, passiveValue, passiveValue2 } from './sim/passive-registration'

bootApp()

/* ============================================================
 * 扩展导出（本次反混淆新增，仅导出引用，不改变行为）
 * ============================================================ */
// ── 新增英雄 项羽：按 id 查表统一登记（放在模块末尾，保证各表已初始化）
/**
 * 处理英雄。
 *
 * @param heroId - 主要输入
 * @param heroConfig - 次要输入
 */
function __registerHeroTables(heroId, heroConfig) {
  if (heroConfig.palette) { const vfxPalette = {}; for (const paletteKey of Object.keys(heroConfig.palette)) vfxPalette[paletteKey] = hexToColor(heroConfig.palette[paletteKey]); HERO_VFX_PALETTES[heroId] = vfxPalette }
  if (heroConfig.portrait) PORTRAIT_YAW_RANGE[heroId] = heroConfig.portrait
  if (heroConfig.scale != null) heroModelScaleByHero[heroId] = heroConfig.scale
  if (heroConfig.cast) CAST_ANIM_SPECS[heroId] = heroConfig.cast
  if (heroConfig.hit) PORTRAIT_CAMERA_PARAMS[heroId] = heroConfig.hit
  if (heroConfig.ability) heroRoleTag[heroId] = heroConfig.ability
  if (heroConfig.tactics) HERO_AI_PERSONALITY[heroId] = heroConfig.tactics
  if (heroConfig.skillMap) HERO_AI_ACTION_MAP[heroId] = heroConfig.skillMap
  if (heroConfig.speed != null) KILL_WINDOW_SLACK_BY_HERO[heroId] = heroConfig.speed
  if (heroConfig.skillOrder) SKILL_PRIORITY_BY_HERO[heroId] = heroConfig.skillOrder
  if (heroConfig.icons) {
    const iconBackgrounds = heroConfig.iconBg || {}, table = {}
    for (const iconKey of Object.keys(heroConfig.icons)) table[iconKey] = () => buildIconSvg(iconBackgrounds[iconKey] || ['#2a1a18','#8a3520','#150b09'], '', heroConfig.icons[iconKey])
    SKILL_ICON_TABLE[heroId] = table
  }
}

/* ============================================================
 * 数据驱动的通用施法 handler（重构新增，零改内核加英雄的关键）
 * ------------------------------------------------------------
 * 内核执行位移/伤害/控制靠 tm 表里的 Oi(hero,slot,{cast}) handler；
 * Oa(actionSpec) 只是数值表，仅供 Pk() 算伤害。旧工程给 5 个内置英雄
 * 各自硬编码了 handler，外部新英雄即使注册了 actionSpec，也会因
 * Wk() 落到默认空 cast 而"扣蓝进 CD 但技能不生效"。
 * 这里把 Oa 的声明翻译成等价 cast handler，新增英雄无需改内核。
 * ============================================================ */

function __installActionHandlers(heroId) {
  for (const s1s2ult of ['s1', 's2', 'ult']) {
    if (CAST_HANDLERS.has(heroId + ':' + s1s2ult)) continue // 内置英雄已有专属 handler，不覆盖
    const handler = __makeGenericCastHandler(heroId, s1s2ult)
    if (handler) registerCastHandler(heroId, s1s2ult, handler)
  }
}

export {
  HERO_TABLE as HeroTable,          // 英雄数据表（运行时由 src/heroes 注入）
  HERO_ACTION_SPECS as HeroActionSpecs,    // 技能玩法规格表：damage / cc / mobility / selfBuffs
  MODEL_BUILDER_TABLE as ModelRegistry,      // 模型注册表：'hero:panyue' -> builder
  VFX_TEMPLATE_TABLE as VfxTemplates,       // 战斗特效模板表
  PANYUE_SKILL_VFX as VfxEventHandlers,   // 特效事件处理函数表
  SFX_COMBAT_CUE_TABLE as SoundBank,          // 音效事件表（WebAudio 程序化合成）
  SKILL_ICON_TABLE as HeroIcons,          // 技能图标 SVG 生成器表
  ItemTable as ItemTable,          // 装备表
  defineSfxCue as defineSound,        // 音效定义 DSL
  getOrBuildModel as buildModel,         // 按 key 取（并缓存）模型
  HERO_ATTACK_SFX as AttackSwingSfx, HERO_HIT_SFX as AttackHitSfx,
  HERO_VFX_PALETTES as VfxPalette, heroModelScaleByHero as HeroModelScale, PORTRAIT_YAW_RANGE as PortraitCrop,
  __registerSound as registerSoundDef, __registerSoundRuntime as registerSoundRuntime,
  SFX_SKILL_CAST_CUES as SoundBankSkillGroup,
  Mesh as Mesh3D, BufferGeometry as Geometry3D, ShaderMaterial as Material3D, Vector3 as Vector3, Group as Group3D,
  Animator as ModelInstance,
  renderHeroRoster as heroRadarSvg, __heroRow as heroRow,
  getClassicMapData as buildMap,           // 地图数据工厂（默认来自 src/world/map/classic.ts）
  getModelKeys as listModelKeys,      // 已注册模型 key 列表
  __registerHeroTables as registerHeroTables, // 通用英雄视觉表注入（数据驱动）
  __installActionHandlers as installActionHandlers, // 数据驱动：按 Oa 生成真实施法 handler（位移/伤害/控制/增益）

  // 技能规格构造器：在 TS 侧手写新英雄的 Oa 条目时用
  buildActionSpec as buildActionSpec,    // bi(heroId, slot, fields)
  makeDamage as makeDamage,         // Gi('physical', { ad: 'adRatio', hits, interval })
  makeDash as makeDash,           // d0(heroId, slot, stopsAtHero)
  skillValue as skillValue,         // ze(heroId, slot, key) —— 从 Se 里取技能数值
  skillRange as skillRange,         // k1(heroId, slot) —— 取施法距离
};

// 供 models.js 使用的内部符号（不改动对外 API）
export { TEAM_COLOR_TABLE, TEAM_BASE_PALETTES, TEAM_PALETTE_KEYS, COSTUME_PALETTE, BODY_ANCHOR_HEIGHTS, inverseLerpClamped, makeBoneChainProjector, poseQuadrupedLegIk, lerpNumeric, YEQUE_RIG_PROPORTIONS, hermiteSmoothStep, TEAM_CRYSTAL_SPEC, NEUTRAL_BASE_SPEC, hitImpactPulse, easeOutQuad, buildBasePedestal, BASE_GLOW_COLOR, toRgbChannels, sampleColorGradient, MATERIAL_KINDS, MATERIAL_PRESETS, RIBBON_WIDTH_PROFILE, ModelBuilder, XINGLI_RIG_PROPORTIONS, BUILDING_GEOMETRY_CACHE, smoothStep01, windupEaseCurve, emitFurTufts, RANGER_PALETTE, ROBE_COSTUME_PALETTE, FENGLING_RIG_PROPORTIONS, FENGLING_BOW_SPEC, STRUCTURE_PALETTE, SURFACE_MATERIAL, SURFACE_MATERIAL_ALT, YEQUE_ARM_SPAN_SCALE, TERRAIN_LOOK, scaleRgbChannels, buildStarCrackTube, WARRIOR_PALETTE, smoothFalloff, clampUnit, QUADRUPED_GAIT_TABLE, poseAllLegsIk, emitTaperedTube, emitConeSkirt, lerpValue, composeMatrix, clampUnitInput, FURL_ROW_COUNT, FULL_CIRCLE_RADIANS, WARRIOR_PROPORTIONS, STRUCTURE_MATERIAL_SPEC, XIANGYU_PALETTE_ALIAS, FENGLING_DEG_TO_RAD, GEOMETRY_TWO_PI, hashNoise, YEQUE_DEG_TO_RAD, TOWER_BUILDING_SPEC, squareValue, MODEL_ANGLE_TO_RAD, METAL_MATERIAL_SPEC, BASE_BUILDING_SPEC }

// 供 svg-icons.js 使用的内部符号
export { expandCssUnits, svgToDataUrl }

// 供 epic-objectives.js 使用的内部符号
export { getMonsterDisplayName }
