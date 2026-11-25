/**
 * 项羽的技能"玩法规格"（给 AI 与通用施法执行器看的）。
 * 数据（伤害/冷却/数值）在三处：xiangyu.ts；这里是它们到战斗系统的映射。
 * 不写这份，内核启动时会用 __defaultActionSpec 兜底（够跑，但护盾、攻速增益会丢）。
 */
import type { Kernel } from '../extensions/api'

/**
 * 处理配置。
 *
 * @param kernel - 主要输入
 * @returns 结果对象
 */
export function xiangyuActionSpec(kernel: Kernel) {
  const readSkillParam = (clavL: string, paramKey: string) => (kernel as any).skillValue('xiangyu', clavL, paramKey)
  const range = (idleMin: string) => (kernel as any).skillRange('xiangyu', idleMin)
  const buildDamage = (damageType: string, extra: Record<string, string> = {}) => (kernel as any).makeDamage(damageType, extra)

  return {
    s1: (kernel as any).buildActionSpec('xiangyu', 's1', {
      roles: ['engage', 'chase'],
      damage: buildDamage('physical', { ad: 'adRatio' }),
      cc: [{ kind: 'knockup', duration: readSkillParam('s1', 'knockup'), value: 0 }],
      mobility: (kernel as any).makeDash('xiangyu', 's1', true),
      lock: (kernel as any).makeDash('xiangyu', 's1').duration,
      reach: range('s1') + readSkillParam('s1', 'impactRadius'),
      aoeRadius: readSkillParam('s1', 'impactRadius'),
      // 撞到第一个英雄就停
      stopsAtFirstHero: true,
      dodgeable: true,
    }),
    s2: (kernel as any).buildActionSpec('xiangyu', 's2', {
      roles: ['defense', 'buff'],
      damage: buildDamage('physical'),
      duration: readSkillParam('s2', 'duration'),
      selfBuffs: ['shield'],
    }),
    ult: (kernel as any).buildActionSpec('xiangyu', 'ult', {
      roles: ['engage', 'zone'],
      damage: buildDamage('physical', { ad: 'adRatio' }),
      cc: [
        { kind: 'knockup', duration: readSkillParam('ult', 'knockup'), value: 0 },
        { kind: 'slow', duration: readSkillParam('ult', 'zoneDur'), value: readSkillParam('ult', 'slow') },
      ],
      duration: readSkillParam('ult', 'zoneDur'),
      delay: readSkillParam('ult', 'leapTime'),
      dodgeable: false,
    }),
  }
}
