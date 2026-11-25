/** 音效合成套件：内核注入给 buildSoundBank 的依赖面 */
export interface SoundKit {
  At: (category: string, label: string, build: (s: any, variant: number) => void, opts?: Record<string, unknown>) => unknown
  [k: string]: any
}
