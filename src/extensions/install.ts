/**
 * 扩展安装入口 —— 重构后只有三段：绑内核 / 装 bundle / 自检。
 *
 * 旧版这里写死了项羽的 5 条音效、外观别名、模型自检、规格打印，
 * 180 行里绝大多数是"某一个英雄"的专属逻辑。现在这些全部搬进
 * src/bundles/xiangyu.bundle.ts，本文件对任意英雄通用。
 */

import type { Kernel } from './api'
import { bindKernel } from './api'
import { bundles, installAllBundles, type InstallReport } from '../bundles'

/** 是否打印启动自检（调试期打开，生产可关） */
const VERBOSE = true

export function installExtensions(kernel: Kernel) {
  bindKernel(kernel)

  // ---- 1. 通用安装：所有 bundle 一次装完 ----
  const reports: InstallReport[] = installAllBundles(kernel, bundles)

  // ---- 2. 通用自检：对所有英雄（含内置 5 个）跑一遍能力检查 ----
  if (VERBOSE) {
    const keysResult = Object.keys(kernel.HeroTable)
    console.info('[starfall] heroes = ' + keysResult.join(','))

    // 模型可构建性：每个英雄 × 全部动作跑一遍（纯 CPU，不依赖 WebGL）
    const ANIMS = ['idle', 'move', 'attack', 'cast_s1', 'cast_s2', 'cast_ult', 'dash', 'spin', 'stunned', 'dead', 'airborne']
    let modelOk = 0
    for (const modelCheckHeroId of keysResult) {
      try {
        const model: any = kernel.buildModel('hero:' + modelCheckHeroId)
        const modelAnimator = new (kernel as any).ModelInstance(model, 1)
        let passedAnimCount = 0
        for (const animName of ANIMS) {
          try {
            modelAnimator.input.anim = animName; modelAnimator.input.p = 0.35; modelAnimator.input.time = 1.2; modelAnimator.input.stride = 0.4
            modelAnimator.pose.reset()
            model.animate(modelAnimator.pose, modelAnimator.input, modelAnimator.output)
            passedAnimCount++
          } catch { /* 该动作未实现，不算失败 */ }
        }
        if (passedAnimCount === ANIMS.length) modelOk++
      } catch { /* 该英雄模型缺失，自检计入失败 */ }
    }
    console.info('[starfall] models fully animated = ' + modelOk + '/' + keysResult.length)

    // 图标 / 雷达 / 音效 自检
    let iconBad = 0
    for (const iconCheckHeroId of keysResult) {
      for (const passives1s2ult of ['passive', 's1', 's2', 'ult']) {
        try {
          if (!String((kernel as any).HeroIcons[iconCheckHeroId][passives1s2ult]()).includes('<svg')) iconBad++
        } catch { iconBad++ }
      }
    }
    const radarFails = keysResult.filter((heroId) => {
      try { return !kernel.heroRadarSvg(heroId).includes('<svg') } catch { return true }
    })
    console.info('[starfall] icons ok = ' + (keysResult.length * 4 - iconBad) + '/' + keysResult.length * 4)
    console.info('[starfall] radar ok = ' + (keysResult.length - radarFails.length) + '/' + keysResult.length)
    console.info('[starfall] sounds = ' + Object.keys(kernel.SoundBank).length +
      ', vfx = ' + Object.keys(kernel.VfxTemplates).length)

    // bundle 安装报告：每个英雄每层是否到位
    for (const report of reports) {
      console.info('[starfall] bundle ' + report.id + ' -> data=' + report.data + ' model=' + report.model +
        ' visual=' + report.visual + ' combat=' + report.combat + ' audio=' + report.audio +
        (report.notes.length ? ' | ' + report.notes.join('; ') : ''))
    }
  }

  return kernel
}
