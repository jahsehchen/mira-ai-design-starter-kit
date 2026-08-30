/**
 * MIRA·弥画 配置统一汇出（Starter Kit）
 *
 *   import { SITE, THEME, FEATURES, type SiteConfig } from '../config';
 *
 * L1–L3 全部为构建期 TS 常量（零运行时读取）；L4 供应商配置由后端读取 env（.env / .env.production）。
 */
export { SITE } from './site.config';
export { THEME } from './theme.config';
export { FEATURES } from './features.config';
export type { SiteConfig, ThemeConfig, FeaturesConfig, CaseMode } from './types';
