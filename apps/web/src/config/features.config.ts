/**
 * MIRA·弥画 L3 功能开关（Starter Kit）
 *
 * 默认全开用于本地框架演示。
 * 开关只控制「UI 显隐 + 路由直达占位」，后端 API、路由 URL、数据契约一律不动。
 *
 *   cases:      'builtin' 内置 3 个仓库自有演示案例（默认）
 *               'custom'  展示自备案例（替换 data/cases.json + public/images/demo/）
 *               'off'     隐藏全部案例入口，/cases 直达显示占位（不 404）
 *   payments:   false → 定价页订阅 CTA / 设置页升级按钮隐藏，订阅卡降级为只读说明
 *   sharing:    false → 作品分享按钮隐藏，/share/:token 直达显示占位
 *   registration: false → 注册入口隐藏，/register 直达显示占位（含演示账号说明）
 */
import type { FeaturesConfig } from './types';

export const FEATURES: FeaturesConfig = {
  cases: 'builtin',
  payments: true,
  sharing: true,
  registration: true,
} as const;
