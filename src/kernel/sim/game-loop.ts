/**
 * 游戏主循环（类型化）
 * ---------------------------------------------------------------
 * FadeTimer 负责把可变帧间隔切成固定步长的模拟 tick，并在卡顿/掉帧时
 * 限制补偿步数、累计被丢弃的时间；GameLoop 在其上包一层 requestAnimationFrame
 * 驱动，把 step / drain / events / frame / error 五个钩子串成完整帧。
 *
 * 本文件是 sim 层 TS 类型化的示范模块：逻辑与原 game-loop.js 逐字节等价，
 * 仅补充业务语义命名与完整类型标注（构造配置、字段、钩子接口）。
 */

/** FadeTimer 的构造配置 */
export interface FadeTimerOptions {
  /** 固定模拟步长（秒），必须为正数 */
  stepDt: number
  /** 单帧允许计入的最大真实时间（秒），缺省 0.25 */
  maxFrameDt?: number
  /** 单帧最多补偿的模拟步数，缺省 6 */
  maxSteps?: number
}

/** 固定步长计时器：把可变帧间隔切成若干个 stepDt */
export class FadeTimer {
  stepDt: number
  maxFrameDt: number
  maxSteps: number
  acc = 0
  droppedTime = 0

  constructor(options: FadeTimerOptions) {
    if (!(options.stepDt > 0)) throw new Error('stepDt 必须为正数')
    ;((this.stepDt = options.stepDt), (this.maxFrameDt = options.maxFrameDt ?? 0.25), (this.maxSteps = Math.max(1, Math.floor(options.maxSteps ?? 6))))
  }

  /**
   * 推进计时器，返回本帧应执行的模拟步数。
   * @param frameSeconds 本帧真实间隔（秒）
   * @param speed 时间倍率（默认 1）
  */
  advance(frameSeconds: number, speed = 1): number {
    if (!(frameSeconds > 0) || !(speed > 0)) return 0
    this.acc += Math.min(frameSeconds, this.maxFrameDt) * speed
    let steps = Math.floor(this.acc / this.stepDt + 1e-9)
    const maxStepsAllowed = this.maxSteps * Math.max(1, Math.ceil(speed))
    return (steps > maxStepsAllowed ? ((this.droppedTime += (steps - maxStepsAllowed) * this.stepDt), (steps = maxStepsAllowed), (this.acc = 0)) : (this.acc = Math.max(0, this.acc - steps * this.stepDt)), steps)
  }

  /** 当前帧内剩余的插值系数（0~1） */
  get alpha(): number {
    const interpolationFraction = this.acc / this.stepDt
    return interpolationFraction < 0 ? 0 : interpolationFraction > 0.999999 ? 0.999999 : interpolationFraction
  }

  reset(): void {
    this.acc = 0
  }
}

/** 每帧回调拿到的循环状态快照 */
export interface FrameInfo {
  /** 当前帧插值系数 */
  alpha: number
  /** 本帧真实间隔（秒） */
  dt: number
  /** 本帧执行的模拟步数 */
  steps: number
  paused: boolean
  /** 本帧模拟耗时（毫秒） */
  simMs: number
  /** 当前帧时间戳（毫秒，来自 env.now()） */
  now: number
}

/** 主循环驱动的环境适配层（注入以便测试/替换 rAF） */
export interface LoopEnv {
  /** 注册下一帧回调，返回可取消的句柄 */
  raf(cb: (now: number) => void): number
  /** 取消 rAF 句柄 */
  caf(handle: number): void
  /** 当前高精度时间戳（毫秒） */
  now(): number
}

/** 主循环在帧边界调用的业务钩子 */
export interface LoopHooks {
  /** 推进一个固定模拟步 */
  step(): void
  /** 取走自上次 drain 以来累积的事件 */
  drain(): unknown[]
  /** 批量派发本帧事件 */
  events(batch: unknown[], steps: number, lastCount: number): void
  /** 每帧收尾（拿 FrameInfo 更新 HUD/渲染） */
  frame(info: FrameInfo): void
  /** 帧内异常回调；缺省时异常被重新抛出 */
  error?(err: unknown): void
}

/** GameLoop 的构造配置（复用 FadeTimer 配置 + 循环专属项） */
export interface GameLoopOptions extends FadeTimerOptions {
  /** 时间倍率，缺省 1 */
  speed?: number
  /** 超过此间隔（秒）视为切后台回来，重置时钟，缺省 5 */
  gapResetSec?: number
  /** 单帧模拟耗时预算（毫秒），超预算提前跳出，缺省 80 */
  simBudgetMs?: number
}

/** 固定步长 + rAF 驱动的游戏主循环 */
export class GameLoop {
  stepper: FadeTimer
  speed: number
  frames = 0
  ticks = 0
  gapResets = 0
  hooks: LoopHooks
  env: LoopEnv
  gapResetSec: number
  simBudgetMs: number
  rafId = 0
  active = false
  isPaused = false
  last = -1
  info: FrameInfo = { alpha: 0, dt: 0, steps: 0, paused: false, simMs: 0, now: 0 }
  onRaf = () => {
    ;((this.rafId = 0), this.active && ((this.rafId = this.env.raf(this.onRaf)), this.runFrame(this.env.now())))
  }

  constructor(hooks: LoopHooks, loopEnv: LoopEnv, options: GameLoopOptions) {
    ;((this.hooks = hooks), (this.env = loopEnv), (this.stepper = new FadeTimer(options)), (this.speed = options.speed ?? 1), (this.gapResetSec = options.gapResetSec ?? 5), (this.simBudgetMs = options.simBudgetMs ?? 80))
  }

  get running(): boolean {
    return this.active
  }

  get paused(): boolean {
    return this.isPaused
  }

  start(): void {
    this.active || ((this.active = true), this.resetClock(), (this.rafId = this.env.raf(this.onRaf)))
  }

  stop(): void {
    ;((this.active = false), this.rafId && this.env.caf(this.rafId), (this.rafId = 0))
  }

  setPaused(paused: boolean): void {
    paused !== this.isPaused && ((this.isPaused = paused), paused || this.stepper.reset())
  }

  resetClock(): void {
    ;(this.stepper.reset(), (this.last = -1))
  }

  /** 执行单帧：计算间隔 → 定步推进 → 派发事件 → 收尾回调 */
  runFrame(nowMs: number): void {
    const hooks = this.hooks
    try {
      let frameSeconds = this.last < 0 ? 0 : (nowMs - this.last) / 1e3
      ;((this.last = nowMs), frameSeconds < 0 && (frameSeconds = 0), frameSeconds > this.gapResetSec && ((frameSeconds = 0), this.stepper.reset(), this.gapResets++), frameSeconds > this.stepper.maxFrameDt && (frameSeconds = this.stepper.maxFrameDt))
      let steps = 0,
        simMs = 0,
        batch: unknown[] | null = null,
        lastCount = 0
      if (!this.isPaused) {
        const planned = this.stepper.advance(frameSeconds, this.speed)
        if (planned > 0) {
          const envState = this.env,
            startMs = envState.now()
          let copied = false
          for (; steps < planned; ) {
            ;(hooks.step(), steps++)
            const drained = hooks.drain()
            if (((lastCount = batch ? batch.length : 0), drained.length > 0))
              if (!batch) batch = drained
              else {
                copied || ((batch = batch.slice()), (copied = true))
                for (let index = 0; index < drained.length; index++) batch.push(drained[index])
              }
            if ((steps & 3) === 0 && steps < planned && envState.now() - startMs > this.simBudgetMs) {
              ;((this.stepper.droppedTime += (planned - steps) * this.stepper.stepDt), this.stepper.reset())
              break
            }
          }
          ;((simMs = envState.now() - startMs), (this.ticks += steps))
        }
      }
      batch && hooks.events(batch, steps, lastCount)
      const infoState = this.info
      ;((infoState.alpha = this.stepper.alpha), (infoState.dt = frameSeconds), (infoState.steps = steps), (infoState.paused = this.isPaused), (infoState.simMs = simMs), (infoState.now = nowMs), this.frames++, hooks.frame(infoState))
    } catch (frameError) {
      if ((this.stop(), hooks.error)) hooks.error(frameError)
      else throw frameError
    }
  }
}
