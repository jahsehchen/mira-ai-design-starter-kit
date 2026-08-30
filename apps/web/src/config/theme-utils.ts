/**
 * MIRA·弥画 L2 主题覆盖层工具（Starter Kit）
 *
 * 唯一职责：把 theme.config.ts 的「少数用户键」派生为 tokens.css 既有令牌的覆盖值，
 * 由 main.tsx 在 createRoot 之前以 :root style.setProperty 注入（render 前完成，无 FOUC）。
 *
 * 红线：
 *   - 只覆盖 tokens.css 既有令牌，不新增令牌、不写死新色值（组件 CSS 仍一律 var()）。
 *   - WCAG 2.1 相对亮度算法与 scripts/qa-contrast-check.mjs 保持一致（两处需同步）。
 *   - 默认 accent（#D4AF37）时派生结果 ≈ tokens.css 原金色阶，默认配置零视觉差异。
 *
 * 用法：
 *   import { THEME } from './theme.config';
 *   import { buildThemeVars } from './theme-utils';
 *   const vars = buildThemeVars(THEME);
 *   for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
 */
import type { ThemeConfig } from './types';

/* ---------- 基础色工具 ---------- */

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG 2.1 相对亮度（gamma 2.4 线性化），与 qa-contrast-check.mjs 同算法 */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function toHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function fromHsl(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hp = ((h % 360) + 360) % 360 / 60;
  const X = C * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [C, X, 0];
  else if (hp < 2) [r, g, b] = [X, C, 0];
  else if (hp < 3) [r, g, b] = [0, C, X];
  else if (hp < 4) [r, g, b] = [0, X, C];
  else if (hp < 5) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];
  const m = L - C / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * 主色派生色阶：HSL 亮度 ± pct 个百分点（保持色相；饱和度随亮度方向微调，
 * 使默认 accent 派生结果 ≈ tokens.css 原金色阶，视觉零差异）。
 *   pct > 0 提亮（亮金），pct < 0 调暗（暗金）。
 */
export function shade(hex: string, pct: number): string {
  const { h, s, l } = toHsl(hex);
  const light = Math.min(100, Math.max(0, l + pct));
  const sat = Math.min(100, Math.max(0, s + (pct > 0 ? pct * 0.35 : pct * 0.15)));
  return fromHsl(h, sat, light);
}

/**
 * 亮度自动选字色：浅底深字 / 深底白字。
 * 阈值 >0.44：默认 accent #D4AF37（L≈0.449）→ 深字 #0A0E1A，与 v3.0 --color-on-gold 一致。
 * （WCAG 深/白字对比度交叉点在 L≈0.19，本阈值保守取 0.44，保证主题可配性 + 默认零变化。）
 */
export function computeOnAccent(accent: string): string {
  return luminance(accent) > 0.44 ? '#0A0E1A' : '#FFFFFF';
}

function hexToRgbStr(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '212,175,55';
}

/** 发光跟随主色：保持 tokens.css 的尺寸结构（8/12/20px），仅替换色值 */
function glow(hex: string, px: number, alpha: number): string {
  const rgb = hexToRgbStr(hex);
  return `0 0 ${px}px rgba(${rgb},${alpha})`;
}

/** --gradient-nebula：保留 v3.0 径向结构，仅把内嵌色值替换为 theme 派生值 */
function rebuildNebula(theme: ThemeConfig): string {
  const violet = hexToRgbStr(theme.nebula.violet);
  const cyan = hexToRgbStr(theme.nebula.cyan);
  const accent = hexToRgbStr(theme.accent);
  return [
    `radial-gradient(52% 46% at 22% 16%, rgba(${violet},.16), transparent 62%)`,
    `radial-gradient(46% 42% at 78% 28%, rgba(${cyan},.12), transparent 60%)`,
    `radial-gradient(60% 52% at 50% 90%, rgba(${accent},.07), transparent 64%)`,
    `linear-gradient(180deg,#070A14 0%,#0A0E1A 48%,#070A14 100%)`,
  ].join(',\n    ');
}

/** --gradient-nebula-soft：同结构换色 */
function rebuildNebulaSoft(theme: ThemeConfig): string {
  const violet = hexToRgbStr(theme.nebula.violet);
  const cyan = hexToRgbStr(theme.nebula.cyan);
  return [
    `radial-gradient(44% 40% at 50% 20%, rgba(${violet},.10), transparent 60%)`,
    `radial-gradient(40% 36% at 30% 80%, rgba(${cyan},.08), transparent 58%)`,
  ].join(',\n    ');
}

/**
 * 构建 :root 覆盖变量映射（只覆盖 tokens.css 既有令牌，不新增）。
 * 语义色（success/warning/danger）、文字/背景色阶、spacing/radius/motion 默认不动。
 */
export function buildThemeVars(theme: ThemeConfig): Record<string, string> {
  return {
    '--color-gold-500': theme.accent,
    '--color-gold-400': shade(theme.accent, 13), // 亮金：激活文字 / 链接
    '--color-gold-300': shade(theme.accent, 22), // 高亮金：星点
    '--color-gold-600': shade(theme.accent, -8), // 暗金：按压态
    '--color-on-gold': computeOnAccent(theme.accent), // ★ 自动深/白字
    '--glow-gold-xs': glow(theme.accent, 8, 0.12),
    '--glow-gold-sm': glow(theme.accent, 12, 0.18),
    '--glow-gold-md': glow(theme.accent, 20, 0.3),
    '--color-nebula-cyan': theme.nebula.cyan,
    '--color-nebula-violet': theme.nebula.violet,
    '--gradient-nebula': rebuildNebula(theme),
    '--gradient-nebula-soft': rebuildNebulaSoft(theme),
    '--font-display': theme.font.display,
    '--font-sans': theme.font.sans,
    '--font-mono': theme.font.mono,
  };
}
