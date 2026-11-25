/**
 * 合成器声部 SynthVoice（步进/调度/干湿输出）（原 starfall.core.js 第 2481-2574 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */

/** chan() 的 layer 输出总线：dry/wet/dly 三条增益节点，供声部路由到干声、混响、延时。 */
interface ChanLayer {
  dry: AudioNode
  wet: AudioNode
  dly: AudioNode
}

/** chan() 的可选路由参数；全部可选以兼容默认值 `{}` 与各调用点的子集传入。 */
interface ChanOptions {
  pan?: number
  layer?: ChanLayer
  rev?: number
  dly?: number
}

/** 模板方法签名：由各曲目子类以方法形式实现；接口合并只贡献类型，不产出运行时代码。 */
interface SynthVoice {
  stepDur(): number
  onStep(step: number, nextT: number, stepDur: number): void
}

class SynthVoice {
  m
  step = 0
  nextT
  killAt = 1 / 0
  out
  wetOut
  delayIn
  nodes = []
  chanNames = []
  constructor(musicEngine, nextStepTime, delayTime) {
    ;((this.m = musicEngine), (this.nextT = nextStepTime))
    const audioContext = musicEngine.ctx
    ;((this.out = this.keep(audioContext.createGain())),
      (this.out.gain.value = 0),
      this.out.connect(musicEngine.musicIn),
      (this.wetOut = this.keep(audioContext.createGain())),
      (this.wetOut.gain.value = 0),
      this.wetOut.connect(musicEngine.musicRev),
      (this.delayIn = this.keep(audioContext.createGain())))
    const keepResult = this.keep(audioContext.createDelay(1.5)),
      rightDelayLine = this.keep(audioContext.createDelay(1.5))
    ;((keepResult.delayTime.value = delayTime), (rightDelayLine.delayTime.value = delayTime))
    const leftFeedbackGain = this.keep(audioContext.createGain()),
      rightFeedbackGain = this.keep(audioContext.createGain())
    ;((leftFeedbackGain.gain.value = 0.4), (rightFeedbackGain.gain.value = 0.4))
    const feedbackFilter = this.keep(audioContext.createBiquadFilter())
    if (((feedbackFilter.type = "lowpass"), (feedbackFilter.frequency.value = 2600), this.delayIn.connect(keepResult), keepResult.connect(leftFeedbackGain), leftFeedbackGain.connect(feedbackFilter), feedbackFilter.connect(rightDelayLine), rightDelayLine.connect(rightFeedbackGain), rightFeedbackGain.connect(keepResult), musicEngine.kit.canPan)) {
      const leftOutputPanner = this.keep(audioContext.createStereoPanner()),
        rightOutputPanner = this.keep(audioContext.createStereoPanner())
      ;((leftOutputPanner.pan.value = -0.65), (rightOutputPanner.pan.value = 0.65), keepResult.connect(leftOutputPanner), rightDelayLine.connect(rightOutputPanner), leftOutputPanner.connect(this.out), rightOutputPanner.connect(this.out))
    } else (keepResult.connect(this.out), rightDelayLine.connect(this.out))
  }
  keep(audioNode) {
    return (this.nodes.push(audioNode), audioNode)
  }
  layer(layerGain) {
    const audioContext = this.m.ctx,
      createLayerGain = (target) => {
        const layerGainNode = this.keep(audioContext.createGain())
        return ((layerGainNode.gain.value = layerGain), layerGainNode.connect(target), layerGainNode)
      }
    return { dry: createLayerGain(this.out), wet: createLayerGain(this.wetOut), dly: createLayerGain(this.delayIn) }
  }
  setLayer(targetObject, propertyName, timeConstant) {
    const currentTime = this.m.now()
    ;(targetObject.dry.gain.setTargetAtTime(propertyName, currentTime, timeConstant), targetObject.wet.gain.setTargetAtTime(propertyName, currentTime, timeConstant), targetObject.dly.gain.setTargetAtTime(propertyName, currentTime, timeConstant))
  }
  chan(channelName, channelGain, channelOptions: ChanOptions = {}) {
    const audioContext = this.m.ctx,
      channelGainNode = this.keep(audioContext.createGain())
    ;((channelGainNode.gain.value = channelGain), this.chanNames.push(channelName))
    let routeOutput = channelGainNode
    if (channelOptions.pan && this.m.kit.canPan) {
      const channelPanner = this.keep(audioContext.createStereoPanner())
      ;((channelPanner.pan.value = channelOptions.pan), channelGainNode.connect(channelPanner), (routeOutput = channelPanner))
    }
    if ((routeOutput.connect(channelOptions.layer ? channelOptions.layer.dry : this.out), channelOptions.rev)) {
      const reverbSendGain = this.keep(audioContext.createGain())
      ;((reverbSendGain.gain.value = channelOptions.rev), routeOutput.connect(reverbSendGain), reverbSendGain.connect(channelOptions.layer ? channelOptions.layer.wet : this.wetOut))
    }
    if (channelOptions.dly) {
      const delaySendGain = this.keep(audioContext.createGain())
      ;((delaySendGain.gain.value = channelOptions.dly), routeOutput.connect(delaySendGain), delaySendGain.connect(channelOptions.layer ? channelOptions.layer.dly : this.delayIn))
    }
    return channelGainNode
  }
  play(cDrum, playTime, configureVoice) {
    configureVoice(this.m.note(cDrum, playTime))
  }
  rnd() {
    return this.m.kit.rnd()
  }
  fade(targetGain, timeConstant) {
    const currentTime = this.m.now()
    ;(this.out.gain.setTargetAtTime(targetGain, currentTime, timeConstant), this.wetOut.gain.setTargetAtTime(targetGain, currentTime, timeConstant))
  }
  schedule(currentTime, lookahead) {
    if (this.nextT < currentTime - 0.1) {
      const stepDurResult = this.stepDur(),
        stepsToSkip = Math.ceil((currentTime - this.nextT) / stepDurResult)
      ;((this.step += stepsToSkip), (this.nextT += stepsToSkip * stepDurResult))
    }
    for (; this.nextT < currentTime + lookahead;) {
      const stepDuration = this.stepDur()
      ;(this.onStep(this.step, this.nextT, stepDuration), (this.nextT += stepDuration), this.step++)
    }
  }
  mood(moodIntensity, tension) {}
  dispose() {
    for (const node of this.nodes) node.disconnect()
    this.nodes.length = 0
  }
}

export { SynthVoice }