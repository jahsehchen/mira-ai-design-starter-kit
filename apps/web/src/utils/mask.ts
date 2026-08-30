/**
 * R4 换色联动视觉协调：自适应遮罩纯函数 + 底图亮度采样。
 *
 * 核心思想：把「遮罩强度/颜色」从「用户值直通」升级为「用户值 + 自适应保护」的派生层：
 * - maskColor：由主题色派生深色调并钳制到中性深色带（各通道 24–96），非纯黑（R4-3）
 * - floor：WCAG AA 可读性下限 —— 以「遮罩最强点（底部边缘，opacity=1）」为最坏像素，
 *   反解使白字对比度 ≥ 4.5 的最小不透明度 a，再钳制到 MASK_FLOOR_MAX=60（R4-1/R4-5）
 * - ceiling：浅色主题 70 / 深色主题 100（R4-2）
 * - effectiveOpacity = clamp(用户值, floor, ceiling)：仅预览层派生，不写 canvasJson（R4-4 红线）
 */
import { adjustColor, hexToRgb, isLight, relativeLuminance } from './color';

/** WCAG AA 白字对比度下限（R4-1） */
export const MASK_READABILITY_CONTRAST = 4.5;
/** 浅色主题有效强度上限（R4-2） */
export const MASK_LIGHT_CEILING = 70;
/** 可读性下限钳制上限（滑杆拖 0 不强制很黑，R4-5） */
export const MASK_FLOOR_MAX = 60;
/** 底图采样区域：底部 40%（文字所在区域） */
export const MASK_SAMPLE_BAND_RATIO = 0.4;

/** 遮罩色逐通道钳制带 [24,96]（中性深色带，与主题协调） */
const MASK_CHANNEL_MIN = 24;
const MASK_CHANNEL_MAX = 96;

export interface AdaptiveMaskInput {
  /** state.themeColor */
  themeColor: string;
  /** derived.to（遮罩区背景底部色） */
  gradientTo: string;
  /** 0-100 用户值（canvasJson 仍存此值，R4-4） */
  userOverlayOpacity: number;
  /** 0-1 底图底部 40% 平均亮度；null=不可采样/无底图 */
  imageBrightness: number | null;
  hasImage: boolean;
  /** 默认 '#FFFFFF'；仅浅色文字启用 floor */
  textColor?: string;
}

export interface AdaptiveMaskResult {
  /** 主题色派生的协调深色调（hex），非纯黑（R4-3） */
  maskColor: string;
  /** 0-100 预览用有效强度（不写 canvasJson） */
  effectiveOpacity: number;
}

/** 亮度域 WCAG 对比度（输入为相对亮度 0-1） */
function luminanceContrast(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 反解最小不透明度 a（0-1），使白字（L=1）对「亮度域线性混合 L(a)=L_bg*(1-a)+L_mask*a」
 * 的对比度 ≥ target。亮度域线性混合为工程近似（架构 Q3 拍板）；
 * 单调性：L_mask < L_bg 时 a 越大 L 越小、对比度越大 → 二分查找安全。
 */
function minAlphaForContrast(lBg: number, lMask: number, target: number): number {
  if (luminanceContrast(1.0, lBg) >= target) return 0;
  // 边界保护：遮罩不暗于背景时无法通过加深达到目标 → 返回 1（由调用方 clamp 到 MASK_FLOOR_MAX）
  if (lMask >= lBg) return 1;
  let lo = 0;
  let hi = 1;
  // 40 次二分足够收敛到 1e-12 精度
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const l = lBg * (1 - mid) + lMask * mid;
    if (luminanceContrast(1.0, l) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

const clampChannel = (n: number) => Math.max(MASK_CHANNEL_MIN, Math.min(MASK_CHANNEL_MAX, Math.round(n)));

/**
 * 纯函数：输入 → 预览派生值（浅色主题不压暗、深色主题自动加深）。
 * 不产生副作用、不依赖 DOM，可独立单测。
 */
export function computeAdaptiveMask(input: AdaptiveMaskInput): AdaptiveMaskResult {
  const { themeColor, gradientTo, userOverlayOpacity, imageBrightness, hasImage } = input;
  const textColor = input.textColor ?? '#FFFFFF';

  // 1) maskColor：浅色主题加深 55%，深色主题加深 35%；逐通道 clamp 到 [24,96]（中性深色带）
  const themeLight = isLight(themeColor);
  const baseHex = themeLight ? adjustColor(themeColor, -0.55) : adjustColor(themeColor, -0.35);
  const [br, bg, bb] = hexToRgb(baseHex);
  const maskColor = `#${[clampChannel(br), clampChannel(bg), clampChannel(bb)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
  const lMask = relativeLuminance(hexToRgb(maskColor));

  // 2) 底部背景亮度 L_bg
  let lBg: number;
  if (hasImage) {
    if (imageBrightness !== null && imageBrightness >= 0 && imageBrightness <= 1) {
      lBg = imageBrightness;
    } else {
      // 有底图但采样失败/跨域：保守暗值下限（R4-5）
      lBg = Math.min(relativeLuminance(hexToRgb(gradientTo)), 0.2);
    }
  } else {
    lBg = relativeLuminance(hexToRgb(gradientTo));
  }

  // 3) 可读性下限 floor：仅当文字为浅色时启用；深色文字 floor=0（不无谓加深）
  let floor = 0;
  if (isLight(textColor)) {
    const a = minAlphaForContrast(lBg, lMask, MASK_READABILITY_CONTRAST);
    floor = Math.max(0, Math.min(MASK_FLOOR_MAX, Math.ceil(a * 100)));
  }

  // 4) 上限 ceiling：浅色主题 70 / 深色主题 100
  const ceiling = themeLight ? MASK_LIGHT_CEILING : 100;

  // 5) 有效强度 = clamp(用户值, floor, ceiling)
  const effectiveOpacity = Math.max(floor, Math.min(ceiling, Math.round(userOverlayOpacity)));

  return { maskColor, effectiveOpacity };
}

/**
 * 离屏 canvas 采样底图底部 40%（MASK_SAMPLE_BAND_RATIO）平均亮度（0-1）。
 * - 缩小到 32px 宽采样带，平均亮度足够代表文字区明暗
 * - crossOrigin='anonymous'：同源上传图可采样；跨域无 CORS → getImageData 抛错 → catch → null
 * - 任何失败（加载失败/画布污染/环境无 canvas）都返回 null，调用方走主题色保守下限
 */
export async function sampleImageBrightness(url: string): Promise<number | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
    });
    img.src = url;
    const image = await loaded;

    const canvas = document.createElement('canvas');
    // 采样带：宽 32px（足够平均）、高按底部 40% 比例
    const w = 32;
    const h = Math.max(1, Math.round(32 * MASK_SAMPLE_BAND_RATIO));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const sw = image.naturalWidth || image.width;
    const sh = image.naturalHeight || image.height;
    const bandHeight = Math.max(1, Math.round(sh * MASK_SAMPLE_BAND_RATIO));
    ctx.drawImage(image, 0, sh - bandHeight, sw, bandHeight, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
    return pixelCount > 0 ? sum / pixelCount : null;
  } catch {
    return null;
  }
}
