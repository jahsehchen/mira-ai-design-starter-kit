/**
 * MIRA·弥画 框架化配置类型定义（Starter Kit）
 * L1 品牌 / L2 主题 / L3 功能 三组配置的类型收敛点。
 * 默认值适合本地框架演示；生产部署仍需按环境模板显式配置。
 */

/** 案例库模式：builtin 内置 3 个自有演示案例（默认）| custom 自备案例 | off 关闭 */
export type CaseMode = 'builtin' | 'custom' | 'off';

/** L1 品牌配置（构建期，apps/web/src/config/site.config.ts） */
export interface SiteConfig {
  /** 品牌名（任意字符串，含中文，如 'MIRA·弥画'） */
  name: string;
  /** 文字徽标（单字建议，如 '弥'） */
  logoMark: string;
  /** 标语（如 '一句话，做出好设计'） */
  tagline: string;
  /** 公司名（footer 品牌段 / 版权） */
  companyName: string;
  /** 版权年份 */
  copyrightYear: number;
  /** 联系邮箱（footer 支持入口 / 关闭注册时提示） */
  supportEmail: string;
  /** index.html meta description 全文 */
  metaDescription: string;
}

/** L2 主题配置（构建期，apps/web/src/config/theme.config.ts） */
export interface ThemeConfig {
  /** 主强调色 HEX（如 '#D4AF37'，== tokens.css --color-gold-500） */
  accent: string;
  /** 星云辅助色（装饰，不参与对比度） */
  nebula: {
    cyan: string;
    violet: string;
  };
  /** 字体族三路 */
  font: {
    /** Display 标题字体栈（含中文回退） */
    display: string;
    /** UI 正文字体栈 */
    sans: string;
    /** 数字 / 坐标等宽字体栈 */
    mono: string;
  };
}

/** L3 功能开关（构建期，apps/web/src/config/features.config.ts） */
export interface FeaturesConfig {
  /** 案例库模式（'builtin' | 'custom' | 'off'） */
  cases: CaseMode;
  /** 订阅支付（false 时隐藏订阅 CTA / 升级按钮，后端模块保留不动） */
  payments: boolean;
  /** 分享（false 时隐藏分享按钮，/share/:token 直达显示占位） */
  sharing: boolean;
  /** 注册（false 时隐藏注册入口，/register 直达显示占位） */
  registration: boolean;
}
