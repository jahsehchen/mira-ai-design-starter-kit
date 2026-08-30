#!/usr/bin/env node
/**
 * MIRA·弥画 QA 对比度扫描（T1 产出 · 契约 §7.1；Starter Kit --theme 增强）
 *
 * 输入  ：apps/web/src/styles/tokens.css 的 :root 变量块
 * 配对矩阵：契约 §1.3 / §7.1（文字对 page/surface/elevated、大字号、金色、金底深字、
 *         语义色、tint 底、实底图标）
 * 输出  ：CLI 表格 + reports/qa-contrast-sciui.txt 留档
 * 阈值  ：正文 ≥4.5:1；大字号 ≥3:1；实底图标 ≥4.5:1
 * 豁免  ：tertiary / disabled（仅 WARN 不 FAIL）；金底白字为禁止组合（仅告警展示）
 * 实现  ：纯 Node 无依赖；WCAG 2.1 相对亮度（gamma 2.4 线性化）；支持 #RRGGBB 与 rgba() 混合
 * 用法  ：NODE_OPTIONS="" node scripts/qa-contrast-check.mjs
 *        NODE_OPTIONS="" node scripts/qa-contrast-check.mjs --theme   （合并 theme.config.ts 覆盖层）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOKENS = join(ROOT, 'apps', 'web', 'src', 'styles', 'tokens.css');
const THEME_CONFIG = join(ROOT, 'apps', 'web', 'src', 'config', 'theme.config.ts');
const REPORT = join(ROOT, 'reports', 'qa-contrast-sciui.txt');

/* ---------- 解析 ---------- */
const css = readFileSync(TOKENS, 'utf8');
const rootMatch = css.match(/:root\s*{([\s\S]*?)\n}/);
if (!rootMatch) {
  console.error('tokens.css 未找到 :root 变量块');
  process.exit(1);
}
const vars = new Map();
const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
let m;
while ((m = re.exec(rootMatch[1])) !== null) {
  let val = m[2].trim().replace(/\/\*[\s\S]*?\*\//g, '').trim();
  vars.set(`--${m[1]}`, val);
}

/* ---------- --theme 覆盖合并（Starter Kit：验证改主色后的对比度） ---------- */
// 用法：NODE_OPTIONS="" node scripts/qa-contrast-check.mjs --theme
// 默认只扫 tokens.css 基线（= 未配主题，报告与 v3.0 一致）；加 --theme 时按 theme.config.ts
// 的 accent/nebula 派生 buildThemeVars 覆盖值合并后再校验（算法与 theme-utils.ts 同步，两处需同步）。
const THEME_MODE = process.argv.includes('--theme');
if (THEME_MODE) {
  try {
    const src = readFileSync(THEME_CONFIG, 'utf8');
    const block = src.match(/export const THEME[^=]*=\s*\{([\s\S]*?)\}\s*as const;/);
    if (block) {
      const accent = block[1].match(/\baccent\s*:\s*['"]([^'"]*)['"]/)?.[1] ?? '#D4AF37';
      const nebula = block[1].match(/nebula\s*:\s*\{\s*cyan\s*:\s*['"]([^'"]*)['"]\s*,\s*violet\s*:\s*['"]([^'"]*)['"]/);
      const cyan = nebula?.[1] ?? '#5FC9E8';
      const violet = nebula?.[2] ?? '#8B7CF8';
      const derived = buildThemeVars({ accent, nebula: { cyan, violet } });
      for (const [k, v] of Object.entries(derived)) vars.set(k, v);
    } else {
      console.warn('  ! theme.config.ts 解析失败，按默认（MIRA 现状）校验');
    }
  } catch {
    console.warn('  ! theme.config.ts 读取失败，按默认（MIRA 现状）校验');
  }
}

/* ---------- --theme 派生工具（与 apps/web/src/config/theme-utils.ts 同步，两处需同步） ---------- */
function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
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
  return luminance(hexToRgb(accent)) > 0.44 ? '#0A0E1A' : '#FFFFFF';
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

/* ---------- 颜色工具 ---------- */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function parseRgb(str) {
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), a];
}

/** 解析任意颜色值：支持 #RRGGBB / rgb() / rgba() / 引用令牌（间接） */
function parseColor(raw) {
  const v = (raw ?? '').trim();
  if (v.startsWith('#')) return hexToRgb(v).concat(1);
  if (v.startsWith('rgb')) return parseRgb(v);
  if (v.startsWith('--')) {
    // 间接令牌引用
    const inner = vars.get(v);
    return inner ? parseColor(inner) : null;
  }
  return null;
}

/** 将带 alpha 的前景色混合到参考底色之上 */
function blend(fg, bg) {
  const a = fg[3];
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ];
}

/** WCAG 2.1 相对亮度（gamma 2.4 线性化） */
function luminance(rgb) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

/** 对比度（1..21） */
function contrast(fg, bg) {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 获取解析后的 RGB（含 alpha），支持令牌名或直接色值；失败返回 null */
function resolveColor(name) {
  if (name.startsWith('--')) {
    if (!vars.has(name)) return null;
    return parseColor(vars.get(name));
  }
  return parseColor(name);
}

/** 解析颜色，若带 alpha 混合到参考底色 */
function resolveWithBlend(name, refName) {
  const c = resolveColor(name);
  if (!c) return null;
  if (c[3] < 1) {
    const bg = resolveColor(refName);
    if (!bg) return null;
    return blend(c, bg);
  }
  return c;
}

/** 混合令牌到参考底色（tint 底：背景 = tint 混合到 elevated） */
function mixTokenTo(fgName, refName) {
  const fg = resolveColor(fgName);
  const bg = resolveColor(refName);
  if (!fg || !bg || fg[3] >= 1) return fg;
  return blend(fg, bg);
}

/* ---------- 配对矩阵 ---------- */
const rows = [];
const failRows = [];
const warnRows = [];
const blockRows = [];

function addCheck(name, fgName, bgName, threshold, kind = 'PASS', opts = {}) {
  // bgMix: 把背景令牌混合到此参考底色后再参与对比（用于 tint 底）
  const fg = opts.bgMix ? resolveColor(fgName) : resolveWithBlend(fgName, bgName);
  const bg = opts.bgMix ? mixTokenTo(bgName, opts.bgMix) : resolveColor(bgName);
  if (!fg || !bg) {
    warnRows.push({ name, ratio: null, threshold, kind, note: `颜色缺失：${fgName} 或 ${bgName}` });
    return;
  }
  const ratio = contrast(fg, bg);
  const ok = ratio >= threshold;
  if (kind === 'PASS') {
    rows.push({ name, ratio, threshold, ok });
  } else if (kind === 'WARN') {
    warnRows.push({ name, ratio, threshold });
  } else {
    blockRows.push({ name, ratio, threshold });
  }
}

const THREE_BG = [
  ['--color-bg-page', 'bg-page'],
  ['--color-bg-surface', 'bg-surface'],
  ['--color-bg-elevated', 'bg-elevated'],
];

// 1. 文字：text-primary / text-secondary 对 page / surface / elevated（≥4.5）
for (const [bg, label] of THREE_BG) {
  addCheck(`正文 primary on ${label}`, '--color-text-primary', bg, 4.5);
  addCheck(`正文 secondary on ${label}`, '--color-text-secondary', bg, 4.5);
}
// 豁免：tertiary / disabled（WARN）
addCheck('占位符 tertiary on page（豁免）', '--color-text-tertiary', '--color-bg-page', 4.5, 'WARN');
addCheck('禁用 disabled on page（豁免）', '--color-text-disabled', '--color-bg-page', 4.5, 'WARN');
addCheck('占位符 tertiary on elevated（豁免）', '--color-text-tertiary', '--color-bg-elevated', 4.5, 'WARN');

// 2. 大字号：text-display（≥3）
addCheck('大标题 display on page', '--color-text-display', '--color-bg-page', 3);
addCheck('大标题 display on deep', '--color-text-display', '--color-bg-deep', 3);

// 3. 金色 on page（做文字 ≥4.5）
addCheck('金色 gold-500 on page', '--color-gold-500', '--color-bg-page', 4.5);
addCheck('亮金 gold-400 on page', '--color-gold-400', '--color-bg-page', 4.5);
addCheck('亮金 gold-300 on page', '--color-gold-300', '--color-bg-page', 4.5);
addCheck('激活文字 gold-400 on elevated', '--color-gold-400', '--color-bg-elevated', 4.5);

// 4. 金底深字（≥4.5）
addCheck('金底深字 on-gold on gold-500', '--color-on-gold', '--color-gold-500', 4.5);
addCheck('暗金底 on-gold on gold-600', '--color-on-gold', '--color-gold-600', 4.5);

// 5. 金底白字（禁止组合 · BLOCK 告警展示，不参与 FAIL 退出）
addCheck('白字 on 金 gold-500（禁止组合）', '#FFFFFF', '--color-gold-500', 4.5, 'BLOCK');
addCheck('白字 on 亮金 gold-400（禁止组合）', '#FFFFFF', '--color-gold-400', 4.5, 'BLOCK');
addCheck('白字 on 高亮 gold-300（禁止组合）', '#FFFFFF', '--color-gold-300', 4.5, 'BLOCK');

// 6. 语义文字（≥4.5 on page / elevated）
const SEM = [
  ['--color-success-text', 'success'],
  ['--color-warning-text', 'warning'],
  ['--color-danger-text', 'danger'],
  ['--color-info-text', 'info'],
];
for (const [fg, label] of SEM) {
  addCheck(`语义 ${label}-text on page`, fg, '--color-bg-page', 4.5);
  addCheck(`语义 ${label}-text on elevated`, fg, '--color-bg-elevated', 4.5);
}

// 7. tint 底：语义文字对 tint 混合色 over elevated（≥4.5）
for (const [fg, bg, label] of [
  ['--color-success-text', '--color-success-bg', 'success'],
  ['--color-warning-text', '--color-warning-bg', 'warning'],
  ['--color-danger-text', '--color-danger-bg', 'danger'],
  ['--color-info-text', '--color-info-bg', 'info'],
]) {
  addCheck(`tint 底 ${label}-text on ${label}-bg(elevated)`, fg, bg, 4.5, 'PASS', { bgMix: '--color-bg-elevated' });
}

// 8. 实底图标：on-* 对实底色（≥4.5）
for (const [fg, bg, label] of [
  ['--color-on-success', '--color-success-text', 'success'],
  ['--color-on-warning', '--color-warning-text', 'warning'],
  ['--color-on-danger', '--color-danger-text', 'danger'],
]) {
  addCheck(`实底图标 on-${label} on ${label}-text`, fg, bg, 4.5);
}

// 9. 星云装饰（仅展示参考，非业务文字）
addCheck('星云 cyan on page（装饰参考）', '--color-nebula-cyan', '--color-bg-page', 4.5, 'WARN');
addCheck('星云 violet on page（装饰参考）', '--color-nebula-violet', '--color-bg-page', 4.5, 'WARN');

/* ---------- 渲染 ---------- */
function fmt(n) {
  return n === null ? '  --  ' : n.toFixed(2).padStart(5);
}

const lines = [];
lines.push('=============================================================');
lines.push('MIRA·弥画 v3.0-sciui 对比度扫描报告');
lines.push(`扫描时间：${new Date().toISOString()}`);
lines.push(
  THEME_MODE
    ? '模式：--theme（合并 theme.config.ts 覆盖层后校验）'
    : '模式：tokens.css 基线（默认）',
);
lines.push('标准：WCAG 2.1 AA（正文≥4.5:1 大字号≥3:1 实底图标≥4.5:1）');
lines.push('=============================================================');
lines.push('');

let fails = 0;
for (const r of rows) {
  const status = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) fails += 1;
  const line = `${status}  ${fmt(r.ratio)}  ≥${r.threshold}  ${r.name}`;
  lines.push(line);
  console.log(line);
}

lines.push('');
lines.push('—— 豁免项（WARN，不参与失败判定）——');
for (const r of warnRows) {
  const note = r.note ? `  (${r.note})` : '';
  lines.push(`WARN  ${fmt(r.ratio)}  ${r.name}${note}`);
  console.log(`WARN  ${fmt(r.ratio)}  ${r.name}${note}`);
}
lines.push('');
lines.push('—— 禁止组合告警（BLOCK，若组件中出现即为违规）——');
for (const r of blockRows) {
  const status = r.ratio !== null && r.ratio >= 4.5 ? '可用' : '✗ 违规(白字 on 金)';
  lines.push(`BLOCK ${fmt(r.ratio)}  ${r.name} → ${status}`);
  console.log(`BLOCK ${fmt(r.ratio)}  ${r.name} → ${status}`);
}

lines.push('');
lines.push('=============================================================');
if (fails === 0) {
  lines.push(`结果：全部 ${rows.length} 项 PASS（WARN ${warnRows.length} 项豁免）`);
  console.log(`结果：全部 ${rows.length} 项 PASS（WARN ${warnRows.length} 项豁免）`);
} else {
  lines.push(`结果：${fails} 项 FAIL / 共 ${rows.length} 项（未通过 AA）`);
  console.log(`结果：${fails} 项 FAIL / 共 ${rows.length} 项（未通过 AA）`);
}
lines.push('=============================================================');

mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');
console.log(`报告已归档：${REPORT}`);

process.exit(fails === 0 ? 0 : 1);
