/**
 * 语音播报：战况播报的排队、优先级与语音合成（SpeechAnnouncer）
 *
 * 由 tools/extract-symbols.cjs 自动抽取；已补类型化（构造参数可注入，便于测试替身）。
 */

import { SPEECH_ANNOUNCEMENT_TEXTS, selectEnglishSpeechVoice } from './music'

/** 语音播报的可注入依赖（测试时可传替身，避免真实 Web Speech） */
interface SpeechAnnouncerDeps {
  synth?: SpeechSynthesis | null
  makeUtterance?: ((text: string) => SpeechSynthesisUtterance) | null
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

class SpeechAnnouncer {
  synth: SpeechSynthesis | null
  make: ((text: string) => SpeechSynthesisUtterance) | null
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  voice: SpeechSynthesisVoice | null = null
  volume = 1
  timers = new Set<unknown>()
  disposed = !1
  constructor(deps: SpeechAnnouncerDeps = {}) {
    const browserGlobal = globalThis as typeof globalThis & { SpeechSynthesisUtterance?: new (speechText: string) => SpeechSynthesisUtterance }
    this.synth = deps.synth !== void 0 ? deps.synth : (browserGlobal.speechSynthesis ?? null)
    const speechSynthesisUtterance = browserGlobal.SpeechSynthesisUtterance
    if (
      ((this.make = deps.makeUtterance ?? (speechSynthesisUtterance ? (utteranceText: string) => new speechSynthesisUtterance(utteranceText) : null)),
      (this.setTimer = deps.setTimer ?? ((timerCallback, delayMs) => globalThis.setTimeout(timerCallback, delayMs))),
      (this.clearTimer = deps.clearTimer ?? ((timerHandle) => globalThis.clearTimeout(timerHandle as number))),
      this.synth)
    ) {
      this.refreshVoice()
      try {
        this.synth.addEventListener?.("voiceschanged", this.refreshVoice)
      } catch {}
    }
  }
  get available() {
    return !this.disposed && this.synth !== null && this.make !== null
  }
  refreshVoice = () => {
    try {
      this.voice = this.synth ? selectEnglishSpeechVoice(this.synth.getVoices()) : null
    } catch {
      this.voice = null
    }
  }
  setVolume(targetObject) {
    this.volume = Math.max(0, Math.min(1, targetObject))
  }
  say(announcementKey, isMajorEnemyEvent, delaySeconds = 0) {
    const selectedSPEECH_ANNOUNCEMENT_TEXTS = SPEECH_ANNOUNCEMENT_TEXTS[announcementKey]
    if (!selectedSPEECH_ANNOUNCEMENT_TEXTS || !this.available || this.volume <= 0.01) return !1
    const speakAnnouncement = () => {
      if (this.available)
        try {
          const Value = this.make(selectedSPEECH_ANNOUNCEMENT_TEXTS)
          ;((Value.lang = this.voice?.lang ?? "en-US"),
            this.voice && (Value.voice = this.voice),
            (Value.rate = 0.92),
            (Value.pitch = isMajorEnemyEvent ? 0.5 : 0.75),
            (Value.volume = this.volume),
            this.synth.cancel(),
            this.synth.speak(Value))
        } catch {}
    }
    if (delaySeconds <= 0.02) speakAnnouncement()
    else {
      const lookupKey = this.setTimer(() => {
        ;(this.timers.delete(lookupKey), speakAnnouncement())
      }, delaySeconds * 1e3)
      this.timers.add(lookupKey)
    }
    return !0
  }
  stop() {
    for (const timer of this.timers) this.clearTimer(timer)
    this.timers.clear()
    try {
      this.synth?.cancel()
    } catch {}
  }
  dispose() {
    if (!this.disposed) {
      this.stop()
      try {
        this.synth?.removeEventListener?.("voiceschanged", this.refreshVoice)
      } catch {}
      this.disposed = !0
    }
  }
}

/**
 * 判断目标。
 *
 * @param position - 坐标
 * @param targetRadius - 半径
 * @param coneSourceEvent - 第三输入
 * @returns 数值结果
 */
function isTargetInDirectionalCone(position, targetRadius, coneSourceEvent) {
  if (!coneSourceEvent.dir || coneSourceEvent.radius === void 0) return !1
  const offsetX = position.x - coneSourceEvent.pos.x,
    offsetY = position.y - coneSourceEvent.pos.y,
    distance = Math.hypot(offsetX, offsetY)
  if (distance > coneSourceEvent.radius + targetRadius) return !1
  if (distance <= targetRadius) return !0
  const effectiveHalfAngle = (coneSourceEvent.angle ?? Math.PI / 3) / 2 + Math.asin(Math.min(1, targetRadius / distance))
  return (offsetX * coneSourceEvent.dir.x + offsetY * coneSourceEvent.dir.y) / distance >= Math.cos(Math.min(Math.PI, effectiveHalfAngle))
}

export { isTargetInDirectionalCone, SpeechAnnouncer }