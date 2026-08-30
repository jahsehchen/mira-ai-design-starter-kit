/** 颜色工具：亮度判断 + 明暗调整 + WCAG 对比度数学（编辑器换色联动 / 自适应遮罩共用） */
export function hexToRgb(hex: string): [number, number, number] {
  const value = (hex || '#2B4CFF').replace('#', '');
  return [
    parseInt(value.slice(0, 2) || '2B', 16),
    parseInt(value.slice(2, 4) || '4C', 16),
    parseInt(value.slice(4, 6) || 'FF', 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** 调整颜色亮度：percent -1~1（负变暗，正变亮） */
export function adjustColor(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const amount = percent * 255;
  return rgbToHex(r + amount, g + amount, b + amount);
}

/** 相对亮度（WCAG）：返回 0~1，>0.5 视为浅色 */
export function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5;
}

/** hex/rgb 颜色转带透明度；rgba 类颜色直接透传（R4 遮罩渐变 / 副标题半透明用） */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color;
  if (color.startsWith('#')) {
    const [r, g, b] = hexToRgb(color);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  return color;
}

/** sRGB 单通道（0-255）→ 线性域（WCAG 2.x） */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 相对亮度（WCAG 2.x）：sRGB → 线性 → 加权，返回 0~1 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = [linearize(rgb[0]), linearize(rgb[1]), linearize(rgb[2])];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 对比度：(L1+0.05)/(L2+0.05)，L1 为较亮者；返回 ≥1 */
export function wcagContrast(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB 通道域 alpha 混合：bg 与 fg 按 alpha（0-1）混合，返回 0-255 通道 */
export function blendRgb(
  bg: [number, number, number],
  fg: [number, number, number],
  alpha: number,
): [number, number, number] {
  const a = Math.max(0, Math.min(1, alpha));
  return [
    Math.round(bg[0] * (1 - a) + fg[0] * a),
    Math.round(bg[1] * (1 - a) + fg[1] * a),
    Math.round(bg[2] * (1 - a) + fg[2] * a),
  ];
}
