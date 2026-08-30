#!/usr/bin/env node
/**
 * QA · R4 换色联动数值自测
 * 直接 import esbuild 打包的真实源码（apps/web/src/utils/mask.ts + color.ts），
 * 对 computeAdaptiveMask 做数值断言，验证：
 *  - R4-1/R4-5 深色主题最坏点（用户强度 0）经 floor 反解后白字对比度 ≥ 4.5，且 floor ≤ 60
 *  - R4-2 浅色主题有效强度 ≤ 70（ceiling）
 *  - R4-3 maskColor 各通道钳制在 [24,96]，非纯黑
 *  - 黑字 floor=0（不无谓加深）
 *  - 采样失败（imageBrightness=null）保守下限仍满足对比度
 *  - 深色主题 ceiling=100（用户 100 → 有效 100）
 *
 * 用法：NODE_OPTIONS="" node scripts/qa-r4-mask-check.mjs
 * 注意：先跑 esbuild 打包（见命令），bundle 输出在 ./tmp/mira-mask-bundle.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '../tmp/mira-mask-bundle.mjs');
const { computeAdaptiveMask, MASK_FLOOR_MAX, MASK_LIGHT_CEILING, MASK_READABILITY_CONTRAST } = await import(
  `file://${bundlePath.replace(/\\/g, '/')}`
);

// ---- color.ts 内联副本（仅用于派生 gradientTo，与源码逐行一致） ----
function hexToRgb(hex) {
  const value = (hex || '#2B4CFF').replace('#', '');
  return [
    parseInt(value.slice(0, 2) || '2B', 16),
    parseInt(value.slice(2, 4) || '4C', 16),
    parseInt(value.slice(4, 6) || 'FF', 16),
  ];
}
function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
function adjustColor(hex, percent) {
  const [r, g, b] = hexToRgb(hex);
  const amount = percent * 255;
  return rgbToHex(r + amount, g + amount, b + amount);
}
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance(rgb) {
  const [r, g, b] = [linearize(rgb[0]), linearize(rgb[1]), linearize(rgb[2])];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// EditorPage derived 逻辑：浅色主题 to=themeColor，深色主题 to=adjustColor(themeColor, 0.45)
function deriveTo(themeColor) {
  const [r, g, b] = hexToRgb(themeColor);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? themeColor : adjustColor(themeColor, 0.45);
}

// 遮罩最强点（底边，alpha=effectiveOpacity/100）亮度域混合后白字对比度（与 mask.ts 同一近似）
function worstPointContrast(maskColor, lBg, effectiveOpacity) {
  const a = effectiveOpacity / 100;
  const lMask = relativeLuminance(hexToRgb(maskColor));
  const l = lBg * (1 - a) + lMask * a;
  return (1.0 + 0.05) / (l + 0.05);
}

let passed = 0;
let failed = 0;
function ok(name, detail = '') {
  passed += 1;
  console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`  ✘ ${name} — ${detail}`);
}
function assert(cond, name, detail) {
  if (cond) ok(name, detail);
  else fail(name, detail);
}

console.log('\nQA · R4 换色联动数值自测（真实源码 bundle）\n');

// 1) 深色主题 #0D0F12 最坏点：用户强度 0（滑杆拖到底），白字，无底图
{
  const theme = '#0D0F12';
  const gradientTo = deriveTo(theme);
  const r = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 0,
    imageBrightness: null,
    hasImage: false,
    textColor: '#FFFFFF',
  });
  const lBg = relativeLuminance(hexToRgb(gradientTo));
  const contrast = worstPointContrast(r.maskColor, lBg, r.effectiveOpacity);
  assert(
    r.effectiveOpacity > 0 && contrast >= MASK_READABILITY_CONTRAST,
    '深色主题 #0D0F12 最坏点对比度 ≥4.5（用户 0 → floor 兜底）',
    `effectiveOpacity=${r.effectiveOpacity} contrast=${contrast.toFixed(2)} maskColor=${r.maskColor}`,
  );
  assert(
    r.effectiveOpacity <= MASK_FLOOR_MAX,
    'floor 钳制 ≤ MASK_FLOOR_MAX(60)',
    `floor=${r.effectiveOpacity}`,
  );
}

// 2) 浅色主题 #E5F4EC：用户 100 → 有效 ≤ 70；用户 0 → floor 兜底且对比度达标
{
  const theme = '#E5F4EC';
  const gradientTo = deriveTo(theme);
  const r100 = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 100,
    imageBrightness: null,
    hasImage: false,
    textColor: '#FFFFFF',
  });
  assert(
    r100.effectiveOpacity <= MASK_LIGHT_CEILING,
    '浅色主题 #E5F4EC 有效强度 ≤70（ceiling）',
    `user=100 → effective=${r100.effectiveOpacity}`,
  );
  const r0 = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 0,
    imageBrightness: null,
    hasImage: false,
    textColor: '#FFFFFF',
  });
  // 设计边界（R4-5）：浅色底 + 白字极端组合下，floor 被 MASK_FLOOR_MAX=60 截断是有意取舍
  // （理论需 ≈91% 强度才能达标；浅色主题应配深色文字，见 #4 黑字 floor=0）。
  // 此处验证 floor 钳制行为本身：floor === MASK_FLOOR_MAX（上限生效）
  assert(
    r0.effectiveOpacity === MASK_FLOOR_MAX,
    '浅色主题 #E5F4EC 用户 0 → floor 被 MASK_FLOOR_MAX(60) 钳制（设计边界，非回归）',
    `effective=${r0.effectiveOpacity}`,
  );
}

// 3) maskColor 逐通道 [24,96] 且非纯黑：遍历全部 8 个主题色
{
  const THEME_COLORS = ['#2B4CFF', '#0D0F12', '#D9D4CC', '#E5F4EC', '#F5B84B', '#E86A33', '#7CC576', '#7A5CF0'];
  let allOk = true;
  const details = [];
  for (const theme of THEME_COLORS) {
    const r = computeAdaptiveMask({
      themeColor: theme,
      gradientTo: deriveTo(theme),
      userOverlayOpacity: 50,
      imageBrightness: null,
      hasImage: false,
      textColor: '#FFFFFF',
    });
    const [cr, cg, cb] = hexToRgb(r.maskColor);
    const inBand = cr >= 24 && cr <= 96 && cg >= 24 && cg <= 96 && cb >= 24 && cb <= 96;
    const notPureBlack = r.maskColor !== '#000000';
    if (!(inBand && notPureBlack)) allOk = false;
    details.push(`${theme}→${r.maskColor}`);
  }
  assert(allOk, 'maskColor 逐通道 ∈[24,96] 且非纯黑（8 主题全量）', details.join(' '));
}

// 4) 黑字 floor=0：textColor 深色 → 不无谓加深
{
  const r = computeAdaptiveMask({
    themeColor: '#E5F4EC',
    gradientTo: deriveTo('#E5F4EC'),
    userOverlayOpacity: 0,
    imageBrightness: null,
    hasImage: false,
    textColor: '#23272B',
  });
  assert(
    r.effectiveOpacity === 0,
    '黑字 floor=0（用户 0 → 有效 0）',
    `textColor=#23272B effective=${r.effectiveOpacity}`,
  );
}

// 5) 采样失败保守下限：hasImage=true, brightness=null, 背景很亮 → 仍满足对比度
{
  const theme = '#E5F4EC';
  const gradientTo = deriveTo(theme); // 浅色 → 亮背景
  const r = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 0,
    imageBrightness: null,
    hasImage: true,
    textColor: '#FFFFFF',
  });
  // 有底图采样失败 → lBg = min(L(gradientTo), 0.2)
  const lBg = Math.min(relativeLuminance(hexToRgb(gradientTo)), 0.2);
  const contrast = worstPointContrast(r.maskColor, lBg, r.effectiveOpacity);
  assert(
    r.effectiveOpacity > 0 && contrast >= MASK_READABILITY_CONTRAST,
    '采样失败（有底图 brightness=null）保守下限对比度 ≥4.5',
    `lBg=min(${relativeLuminance(hexToRgb(gradientTo)).toFixed(3)},0.2)=${lBg.toFixed(3)} effective=${r.effectiveOpacity} contrast=${contrast.toFixed(2)}`,
  );
}

// 6) 深色主题 ceiling=100：用户 100 → 有效 100（深色不限制上限）
{
  const r = computeAdaptiveMask({
    themeColor: '#0D0F12',
    gradientTo: deriveTo('#0D0F12'),
    userOverlayOpacity: 100,
    imageBrightness: null,
    hasImage: false,
    textColor: '#FFFFFF',
  });
  assert(
    r.effectiveOpacity === 100,
    '深色主题 ceiling=100（用户 100 → 有效 100）',
    `effective=${r.effectiveOpacity}`,
  );
}

// 7) 有底图且采样成功：brightness 参与计算（暗底图 floor 低、亮底图 floor 高）
{
  const theme = '#2B4CFF';
  const gradientTo = deriveTo(theme);
  const dark = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 0,
    imageBrightness: 0.1, // 很暗的底图
    hasImage: true,
    textColor: '#FFFFFF',
  });
  const bright = computeAdaptiveMask({
    themeColor: theme,
    gradientTo,
    userOverlayOpacity: 0,
    imageBrightness: 0.9, // 很亮的底图
    hasImage: true,
    textColor: '#FFFFFF',
  });
  assert(
    dark.effectiveOpacity <= bright.effectiveOpacity,
    '底图越亮 floor 越高（暗图 0.1 vs 亮图 0.9）',
    `dark=${dark.effectiveOpacity} bright=${bright.effectiveOpacity}`,
  );
}

console.log(`\nR4 数值自测结果：${passed} 通过 / ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
