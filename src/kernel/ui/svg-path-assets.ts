/**
 * SVG 路径资源
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { SVG_STROKE_ATTR, getHudIconPath, SVG_FILL_ATTR, buildHeroPortraitIcon } from './dom-kit'
import { ICON_FRAME_KINDS, diamondPath, renderIconFrame } from './icon-theme'
import { starPath } from '../render/procedural-art'

const MISSING_ICON_PATH = "M12.500 1.800c.6 4.200 5.500 5.700 5.500 11.200a6 6 0 0 1-12 0c0-2.600 1.300-4.200 2.700-5.400.1 1.900.9 2.900 1.900 3.100-.2-3.300.3-6.400 1.900-8.900z",
  WARNING_ICON_PATH = "M12 2.200l8 3v6.300c0 5-3.400 8.500-8 10.300-4.600-1.800-8-5.300-8-10.300V5.200z",
  INFO_ICON_PATH = {
    stun: () => buildHeroPortraitIcon("#c9a227", `<path d="M12 12.500a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0" ${SVG_STROKE_ATTR(2.3)}/><path d="${diamondPath(5.5, 6, 3.4)}" ${SVG_FILL_ATTR}/><path d="${diamondPath(18.5, 19.5, 2.6)}" ${SVG_FILL_ATTR}/>`),
    airborne: () => buildHeroPortraitIcon("#b9832e", `<path d="M12 2.500l7 7.500h-4.200v5H9.200v-5H5z" ${SVG_FILL_ATTR}/><path d="M5 19.500h14M8 22h8" ${SVG_STROKE_ATTR(2)}/>`),
    root: () =>
      buildHeroPortraitIcon(
        "#8a6a3a",
        `<path d="M3 21l3.500-11L10 21zM8.500 21L12 5l3.500 16zM14 21l3.500-11L21 21z" ${SVG_FILL_ATTR}/><path d="M12 5v16M6.500 10v11M17.500 10v11" stroke="#060a16" stroke-opacity=".35" stroke-width="1"/>`,
      ),
    slow: () => buildHeroPortraitIcon("#6c70c4", `<path d="M5 4.500l7 6.500 7-6.500M5 12.500l7 6.500 7-6.500" ${SVG_STROKE_ATTR(3)}/>`),
    silence: () => buildHeroPortraitIcon("#7a4fb8", `<path d="M4 4.500h16v10.500h-9l-4.500 4v-4H4z" ${SVG_STROKE_ATTR(2.2)}/><path d="M4.500 21L19.500 3" ${SVG_STROKE_ATTR(2.6)}/>`),
    shield: () => buildHeroPortraitIcon("#4f7fc8", `<path d="${WARNING_ICON_PATH}" ${SVG_FILL_ATTR}/><path d="M12 5.200v13.800M7 8.500l5 2 5-2" stroke="#060a16" stroke-opacity=".3" stroke-width="1.200" fill="none"/>`),
    haste: () => buildHeroPortraitIcon("#2f9e6a", `<path d="M4 5.500l7 6.500-7 6.500M12.500 5.500l7 6.500-7 6.500" ${SVG_STROKE_ATTR(3)}/>`),
    attack_speed: () => buildHeroPortraitIcon("#c8642a", `${getHudIconPath("kill")}<path d="M3 5h5M2 9h4" ${SVG_STROKE_ATTR(1.8)}/>`),
    dmg_reduction: () => buildHeroPortraitIcon("#5f6f86", `<path fill-rule="evenodd" d="${WARNING_ICON_PATH}M10.700 7h2.600v5.200h2.700L12 17l-4-4.800h2.700z" ${SVG_FILL_ATTR}/>`),
    untargetable: /**
 * 处理目标。
 *
 */
() =>
      buildHeroPortraitIcon(
        "#6a55a8",
        `<circle cx="12" cy="12" r="9.500" ${SVG_STROKE_ATTR(1.8)} stroke-dasharray="3.200 3"/><circle cx="12" cy="9" r="3.200" ${SVG_FILL_ATTR} opacity=".85"/><path d="M5.800 18.500c1-3.600 3.400-5 6.200-5s5.200 1.400 6.200 5z" ${SVG_FILL_ATTR} opacity=".85"/>`,
      ),
    unstoppable: () => buildHeroPortraitIcon("#c89a2a", `<path d="${starPath(12, 12, 8, 10.6, 5.2)}" ${SVG_FILL_ATTR}/><circle cx="12" cy="12" r="2.600" fill="#060a16" fill-opacity=".4"/>`),
    burn: () =>
      buildHeroPortraitIcon("#c8402a", `<path d="${MISSING_ICON_PATH}" ${SVG_FILL_ATTR}/><path d="M12 12.500c1.800 1.400 2.600 2.800 2.600 4.300a2.600 2.600 0 0 1-5.200 0c0-1.500.8-2.900 2.600-4.300z" fill="#060a16" fill-opacity=".35"/>`),
    recall: () => renderIconFrame("recall"),
    restore: () => renderIconFrame("heal"),
    fountain: () =>
      buildHeroPortraitIcon("#2a9fb8", `<path d="M12 2c2.800 3.700 5.500 6.800 5.500 10.200a5.500 5.500 0 0 1-11 0C6.500 8.800 9.200 5.700 12 2z" ${SVG_FILL_ATTR}/><path d="M3.500 20.500q4.200-3 8.500 0t8.500 0" ${SVG_STROKE_ATTR(2)}/>`),
    respawn_guard: () =>
      buildHeroPortraitIcon("#c8a83a", `<circle cx="12" cy="12" r="4.600" ${SVG_FILL_ATTR}/><g ${SVG_STROKE_ATTR(2.2)}>${[0, 45, 90, 135, 180, 225, 270, 315].map((angleDegrees) => `<path d="M12 2v3" transform="rotate(${angleDegrees} 12 12)"/>`).join("")}</g>`),
    frost_insight: () =>
      buildHeroPortraitIcon(
        "#3a78d0",
        `<path d="${starPath(12, 12, 6, 10.6, 5.4)}" ${SVG_FILL_ATTR}/><path d="M12 5v14M5.900 8.500l12.200 7M5.900 15.500l12.200-7" stroke="#060a16" stroke-opacity=".35" stroke-width="1.100"/><circle cx="12" cy="12" r="2" fill="#060a16" fill-opacity=".35"/>`,
      ),
    ember_might: () => buildHeroPortraitIcon("#d0502a", `<path d="${MISSING_ICON_PATH}" ${SVG_FILL_ATTR}/><path d="${diamondPath(12, 15, 3.6, 0.2)}" fill="#060a16" fill-opacity=".5"/>`),
    star_blessing: () => buildHeroPortraitIcon("#d8a83a", `<path d="${diamondPath(10.5, 13, 8.8, 0.2)}" ${SVG_FILL_ATTR}/><path d="${diamondPath(19, 5.5, 3.8, 0.2)}" ${SVG_FILL_ATTR}/><path d="${diamondPath(19.5, 19, 2.4, 0.2)}" ${SVG_FILL_ATTR}/>`),
    panyue_passive: () => ICON_FRAME_KINDS("panyue", "passive"),
    panyue_bulwark: () => ICON_FRAME_KINDS("panyue", "s2"),
    chijin_ember: () => ICON_FRAME_KINDS("chijin", "passive"),
    chijin_blaze: () => ICON_FRAME_KINDS("chijin", "s2"),
    chijin_spin: () => ICON_FRAME_KINDS("chijin", "ult"),
    xingli_mark: () => ICON_FRAME_KINDS("xingli", "passive"),
    fengling_gale: () => ICON_FRAME_KINDS("fengling", "passive"),
    fengling_crit: () => ICON_FRAME_KINDS("fengling", "s2"),
    yeque_shadow: () => ICON_FRAME_KINDS("yeque", "passive"),
    tower_focus: () => buildHeroPortraitIcon("#c8303a", getHudIconPath("target")),
  }

export { INFO_ICON_PATH }
