/**
 * MIRA·弥画 L2 主题配置（Starter Kit）
 *
 * 改这里 → 全站主强调色 / 星云辅助色 / 字体族联动（main.tsx 运行时注入 :root 覆盖层，
 * 在 tokens.css 之后生效）。默认值 = 深空科幻风（与 tokens.css 同源）。
 *
 * 派生规则（theme-utils.ts 实现）：
 *   - accent 单值 → HSL 派生 gold-300/400/600 与 glow-* 发光（用户无需面对 5 个金色令牌）
 *   - on-accent 自动按 WCAG 亮度选深字/白字（qa-contrast-check.mjs --theme 可校验）
 *
 * 修改后需重新构建；qa 校验：NODE_OPTIONS="" node scripts/qa-contrast-check.mjs --theme
 */
import type { ThemeConfig } from './types';

export const THEME: ThemeConfig = {
  /** 主强调色 == tokens.css --color-gold-500 */
  accent: '#D4AF37',
  /** 星云辅助色（仅装饰，禁止作 CTA/链接/业务语义） */
  nebula: {
    cyan: '#5FC9E8',
    violet: '#8B7CF8',
  },
  /** 字体族三路（保留中文回退栈） */
  font: {
    display:
      '"Orbitron","Exo 2","Rajdhani",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif',
    sans: '"Inter","Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif',
    mono: '"JetBrains Mono","SFMono-Regular","Menlo","Consolas",monospace',
  },
} as const;
