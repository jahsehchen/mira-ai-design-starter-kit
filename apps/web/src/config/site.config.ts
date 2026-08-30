/**
 * MIRA·弥画 L1 品牌配置（Starter Kit）
 *
 * 改这里 → 全站品牌文案同步（Header/Footer/登录注册/分享页/导出前缀/index.html title+meta+favicon）。
 * 默认值 = MIRA 现状；无需改动即可开箱使用。
 *
 * 修改后需重新构建（npm run build）或等待 dev HMR 生效。
 */
import type { SiteConfig } from './types';

export const SITE: SiteConfig = {
  /** 品牌名：出现在顶栏 / footer / 登录注册 / 分享页 / index.html title / document.title 兜底 */
  name: 'MIRA·弥画',
  /** 文字徽标（单字，用于 logo-mark 与 favicon 中央字） */
  logoMark: '弥',
  /** 标语：Hero 主标题 / 登录副标题 / 分享页结尾文案 */
  tagline: '一句话，做出好设计',
  /** 公司名：footer 品牌段与版权行（© 年份 公司名） */
  companyName: 'MIRA·弥画',
  /** 版权年份 */
  copyrightYear: 2026,
  /** 联系邮箱：关闭注册 / 分享等占位页的「联系管理员」入口 */
  supportEmail: 'support@mira.app',
  /** index.html meta description（Vite 插件注入） */
  metaDescription:
    'MIRA·弥画：AI 视觉设计工具。用一句话描述你的想法，自动生成海报、社媒图、电商图。让每个人都能把想法变成看得见的作品。',
} as const;
