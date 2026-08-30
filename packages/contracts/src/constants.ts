/**
 * MIRA·弥画 共享常量
 * 前后端共用的预设/定义/错误码，单一来源，避免两端各写一份漂移。
 */
import type { ExportPreset, GenerationStep, PlanDto } from './types';
import type { StylePreset } from './enums';

/** 业务错误码（envelope.code，非 0 表示失败） */
export const ERROR_CODES = {
  /** 参数校验失败 */
  VALIDATION: 10001,
  /** 未登录 / 令牌失效 */
  UNAUTHORIZED: 10002,
  /** 无权限（非资源所有者） */
  FORBIDDEN: 10003,
  /** 资源不存在 */
  NOT_FOUND: 10004,
  /** 冲突（如邮箱已注册） */
  CONFLICT: 10005,
  /** 本月生成额度超限 */
  QUOTA_EXCEEDED: 20001,
  /** AI 生成失败 */
  GENERATION_FAILED: 20002,
  /** 导出失败 */
  EXPORT_FAILED: 20003,
  /** 内部错误 */
  INTERNAL: 50000,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 生成三步（LoadingSteps 渲染来源；state 由后端任务实时更新） */
export const GENERATION_STEPS: GenerationStep[] = [
  { key: 'understand', label: '理解你的描述', state: 'pending' },
  { key: 'match', label: '匹配版式与配色', state: 'pending' },
  { key: 'generate', label: '生成设计', state: 'pending' },
];

/** 风格预设（生成器 chips，顺序即展示顺序） */
export const STYLE_PRESETS: StylePreset[] = ['不限', '极简', '手绘风', '科技感', '复古', '清新'];

/** 导出尺寸预设（6 个） */
export const EXPORT_PRESETS: ExportPreset[] = [
  { key: '1:1', width: 1080, height: 1080, label: '社媒帖子', category: 'social' },
  { key: '9:16', width: 1080, height: 1920, label: '短视频 / 竖版', category: 'social' },
  { key: '16:9', width: 1920, height: 1080, label: '横版封面', category: 'social' },
  { key: '3:4', width: 1080, height: 1440, label: '小红书封面', category: 'social' },
  { key: '800x800', width: 800, height: 800, label: '电商主图', category: 'ecommerce' },
  { key: 'a4', width: 1240, height: 1754, label: '打印 / 传单', category: 'print' },
];

/** 订阅方案定义（Q8 默认值：free 10 / pro 500 / team 2000 每月；价格沿用定价页） */
export const PLAN_DEFINITIONS: PlanDto[] = [
  {
    key: 'free',
    name: '免费版',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    quotaPerMonth: 10,
    features: ['每月 10 次 AI 生成', '基础模板库', '普通画质导出', '社区支持'],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthlyCents: 3900,
    priceYearlyCents: 3120,
    quotaPerMonth: 500,
    features: [
      '每月 500 次 AI 生成',
      '全部模板库',
      '4K 高清导出',
      '多尺寸一键导出',
      'AI 抠图 / 一键美化',
      '品牌色板 / 字体预设',
      '优先生成通道',
    ],
  },
  {
    key: 'team',
    name: '团队版',
    priceMonthlyCents: 9900,
    priceYearlyCents: 7920,
    quotaPerMonth: 2000,
    features: [
      'Pro 全部能力',
      '团队协作与共享空间',
      '统一品牌色板',
      '管理员后台 / 用量报表',
      '优先生成通道',
      '专属客户成功支持',
    ],
  },
];

/** 生成任务轮询间隔（前端 1s，架构 §4.2） */
export const GENERATION_POLL_INTERVAL_MS = 1000;

/** 导出任务轮询间隔 */
export const EXPORT_POLL_INTERVAL_MS = 1000;

/** 分页默认值 */
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

/** 批量导出：单次最多作品数（前后端共用上限，R3-2） */
export const EXPORT_MAX_WORKS_PER_BATCH = 20;

/** 批量导出：单任务最多尺寸数（沿用单作品 ArrayMaxSize(10)） */
export const EXPORT_MAX_SIZES_PER_JOB = 10;
