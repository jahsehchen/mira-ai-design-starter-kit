#!/usr/bin/env node
/**
 * MIRA·弥画 主题覆盖层静态产物生成（Starter Kit · 可选）
 *
 * 主方案是 main.tsx 运行时注入（buildThemeVars → :root setProperty，零额外文件）。
 * 本脚本按同一派生逻辑把 theme.config.ts 输出为静态 `theme-override.css`，
 * 供需要静态产物的场景（预渲染 / CI 视觉回归基线 / 演示）使用，运行时默认不加载。
 *
 * 用法：NODE_OPTIONS="" node scripts/gen-theme-css.mjs
 *       NODE_OPTIONS="" node scripts/gen-theme-css.mjs apps/web/public/theme-override.css
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const THEME_CONFIG = join(ROOT, 'apps', 'web', 'src', 'config', 'theme.config.ts');
const OUT = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'apps', 'web', 'public', 'theme-override.css');

/* ---- 派生工具（与 theme-utils.ts 同步，两处需同步） ---- */
function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function toHsl(hex) {
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
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function fromHsl(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const X = C * (1 - Math.abs((hp % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hp < 1) [r, g, b] = [C, X, 0];
  else if (hp < 2) [r, g, b] = [X, C, 0];
  else if (hp < 3) [r, g, b] = [0, C, X];
  else if (hp < 4) [r, g, b] = [0, X, C];
  else if (hp < 5) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];
  const m = L - C / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function shade(hex, pct) {
  const { h, s, l } = toHsl(hex);
  const light = Math.min(100, Math.max(0, l + pct));
  const sat = Math.min(100, Math.max(0, s + (pct > 0 ? pct * 0.35 : pct * 0.15)));
  return fromHsl(h, sat, light);
}
function computeOnAccent(accent) {
  return luminance(accent) > 0.44 ? '#0A0E1A' : '#FFFFFF';
}
function hexToRgbStr(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '212,175,55';
}
function glow(hex, px, alpha) {
  return `0 0 ${px}px rgba(${hexToRgbStr(hex)},${alpha})`;
}
function rebuildNebula(theme) {
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
function rebuildNebulaSoft(theme) {
  const violet = hexToRgbStr(theme.nebula.violet);
  const cyan = hexToRgbStr(theme.nebula.cyan);
  return [
    `radial-gradient(44% 40% at 50% 20%, rgba(${violet},.10), transparent 60%)`,
    `radial-gradient(40% 36% at 30% 80%, rgba(${cyan},.08), transparent 58%)`,
  ].join(',\n    ');
}
function buildThemeVars(theme) {
  return {
    '--color-gold-500': theme.accent,
    '--color-gold-400': shade(theme.accent, 13),
    '--color-gold-300': shade(theme.accent, 22),
    '--color-gold-600': shade(theme.accent, -8),
    '--color-on-gold': computeOnAccent(theme.accent),
    '--glow-gold-xs': glow(theme.accent, 8, 0.12),
    '--glow-gold-sm': glow(theme.accent, 12, 0.18),
    '--glow-gold-md': glow(theme.accent, 20, 0.3),
    '--color-nebula-cyan': theme.nebula.cyan,
    '--color-nebula-violet': theme.nebula.violet,
    '--gradient-nebula': rebuildNebula(theme),
    '--gradient-nebula-soft': rebuildNebulaSoft(theme),
  };
}

/* ---- 读取 theme.config.ts 字面量 ---- */
function loadTheme() {
  const src = readFileSync(THEME_CONFIG, 'utf8');
  const block = src.match(/export const THEME[^=]*=\s*\{([\s\S]*?)\}\s*as const;/);
  if (!block) throw new Error('theme.config.ts 解析失败');
  const accent = block[1].match(/\baccent\s*:\s*['"]([^'"]*)['"]/)?.[1] ?? '#D4AF37';
  const nebula = block[1].match(/nebula\s*:\s*\{\s*cyan\s*:\s*['"]([^'"]*)['"]\s*,\s*violet\s*:\s*['"]([^'"]*)['"]/);
  const font = block[1].match(/font\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const grab = (k, fallback) => {
    const m = font.match(new RegExp(`\\b${k}\\s*:\\s*(['"])([\\s\\S]*?)\\1`));
    return m ? m[2] : fallback;
  };
  return {
    accent,
    nebula: { cyan: nebula?.[1] ?? '#5FC9E8', violet: nebula?.[2] ?? '#8B7CF8' },
    font: {
      display: grab('display', 'inherit'),
      sans: grab('sans', 'inherit'),
      mono: grab('mono', 'inherit'),
    },
  };
}

const theme = loadTheme();
const vars = buildThemeVars(theme);
vars['--font-display'] = theme.font.display;
vars['--font-sans'] = theme.font.sans;
vars['--font-mono'] = theme.font.mono;

const body = Object.entries(vars)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n');
const cssOut = `/* Auto-generated by scripts/gen-theme-css.mjs from apps/web/src/config/theme.config.ts.
   Runtime default is main.tsx setProperty injection; this file is an optional static artifact. */
:root {
${body}
}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, cssOut, 'utf8');
console.log(`已生成主题覆盖层：${OUT}`);
console.log(`  accent = ${theme.accent}（on-gold = ${computeOnAccent(theme.accent)}）`);
