/**
 * MIRA·弥画 Vite 插件：index.html 品牌注入（Starter Kit）
 *
 * 在 transformIndexHtml 阶段读取 site.config.ts / theme.config.ts，
 * 自动改写 <title> / meta description / favicon（data URI SVG）。
 * 优点：`npm run build` 零额外命令，改配置重建即同步，index.html 无需二次维护。
 *
 * 读取方式：直接按正则解析 TS 配置文件的字面量（配置为 as const 纯字面量对象，稳定可靠）；
 * 解析失败回退 MIRA 默认值（配置缺省即安全）。
 *
 * favicon：底 = THEME.accent，中央字 = SITE.logoMark，字色按 WCAG 亮度自动深/白，
 * 与 main.tsx 的 on-accent 逻辑一致（两处需同步，见 theme-utils.ts）。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '../src/config');

/* ---------- 缺省值（= MIRA 现状） ---------- */
const SITE_DEFAULTS = {
  name: 'MIRA·弥画',
  logoMark: '弥',
  tagline: '一句话，做出好设计',
  companyName: 'MIRA·弥画',
  copyrightYear: 2026,
  supportEmail: 'support@mira.app',
  metaDescription:
    'MIRA·弥画：AI 视觉设计工具。用一句话描述你的想法，自动生成海报、社媒图、电商图。让每个人都能把想法变成看得见的作品。',
};
const THEME_DEFAULTS = {
  accent: '#D4AF37',
  nebula: { cyan: '#5FC9E8', violet: '#8B7CF8' },
};

/* ---------- TS 配置字面量解析 ---------- */

/** 读取 `<key>.config.ts` 的 `export const X = {...} as const;` 主体 */
function readBlock(file: string): string | undefined {
  try {
    const src = readFileSync(resolve(CONFIG_DIR, file), 'utf8');
    const m = src.match(new RegExp(`export const [A-Z]+[^=]*=\\s*\\{([\\s\\S]*?)\\}\\s*as const;`));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

function strVal(block: string | undefined, key: string): string {
  if (!block) return '';
  const s = block.match(new RegExp(`\\b${key}\\s*:\\s*['"]([^'"]*)['"]`));
  return s ? s[1] : '';
}

function numVal(block: string | undefined, key: string): string {
  if (!block) return '';
  const n = block.match(new RegExp(`\\b${key}\\s*:\\s*(\\d+)`));
  return n ? n[1] : '';
}

function loadSite(): typeof SITE_DEFAULTS {
  const block = readBlock('site.config.ts');
  const get = (k: keyof typeof SITE_DEFAULTS): string => {
    const raw = strVal(block, k as string);
    if (raw) return raw;
    const fallback = SITE_DEFAULTS[k];
    return typeof fallback === 'string' ? fallback : String(fallback);
  };
  return {
    name: get('name'),
    logoMark: get('logoMark'),
    tagline: get('tagline'),
    companyName: get('companyName'),
    copyrightYear: parseInt(numVal(block, 'copyrightYear') || String(SITE_DEFAULTS.copyrightYear), 10),
    supportEmail: get('supportEmail'),
    metaDescription: get('metaDescription'),
  };
}

function loadTheme(): typeof THEME_DEFAULTS {
  const block = readBlock('theme.config.ts');
  const accent = strVal(block, 'accent') || THEME_DEFAULTS.accent;
  let cyan = THEME_DEFAULTS.nebula.cyan;
  let violet = THEME_DEFAULTS.nebula.violet;
  const nebula = block?.match(/nebula\s*:\s*\{\s*cyan\s*:\s*['"]([^'"]*)['"]\s*,\s*violet\s*:\s*['"]([^'"]*)['"]/);
  if (nebula) {
    cyan = nebula[1];
    violet = nebula[2];
  }
  return { accent, nebula: { cyan, violet } };
}

/* ---------- favicon 生成 ---------- */

/** WCAG 2.1 相对亮度（与 theme-utils.ts luminance 同步） */
function luminance(hex: string): number {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return 0;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return 0;
  const rgb = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

/** on-accent 自动深/白字（与 theme-utils.ts computeOnAccent 同步：默认金 #D4AF37 → 深字） */
function onAccent(accent: string): string {
  return luminance(accent) > 0.44 ? '#0A0E1A' : '#FFFFFF';
}

function faviconDataUri(logoMark: string, accent: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>` +
    `<rect width='32' height='32' rx='8' fill='${accent}'/>` +
    `<text x='16' y='22' font-size='16' text-anchor='middle' fill='${onAccent(accent)}' font-family='serif'>${logoMark}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------- 插件 ---------- */

/**
 * transformIndexHtml 时**重新读取**配置文件（每次请求读取，成本可忽略），
 * 保证 dev 下改 site/theme 配置后 title/meta/favicon 即时同步（与 React HMR 一致）；
 * 生产构建时读取一次（构建期快照）即正确。
 */
export function siteMeta(): Plugin {
  return {
    name: 'mira-site-meta',
    transformIndexHtml(html) {
      const site = loadSite();
      const theme = loadTheme();
      const title = `${site.name} — ${site.tagline}`;
      const description = site.metaDescription;
      const favicon = faviconDataUri(site.logoMark, theme.accent);

      let out = html;
      if (/<title>[\s\S]*?<\/title>/.test(out)) {
        out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
      } else {
        out = out.replace('</head>', `  <title>${title}</title>\n  </head>`);
      }
      if (/<meta name="description"[^>]*>/.test(out)) {
        out = out.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`);
      } else {
        out = out.replace('</head>', `  <meta name="description" content="${description}" />\n  </head>`);
      }
      if (/<link rel="icon"[^>]*>/.test(out)) {
        out = out.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${favicon}" />`);
      } else {
        out = out.replace('</head>', `  <link rel="icon" href="${favicon}" />\n  </head>`);
      }
      return out;
    },
  };
}
