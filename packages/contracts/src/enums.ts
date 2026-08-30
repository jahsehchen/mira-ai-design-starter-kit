/**
 * MIRA·弥画 共享枚举与联合类型
 * 前后端唯一类型来源；后端实体枚举、前端 UI 分支均引用此文件。
 */

/** AI 生成任务状态（三态 + 终态） */
export type GenerationStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

/** 生成步骤 key（三步） */
export type GenerationStepKey = 'understand' | 'match' | 'generate';

/** 步骤状态 */
export type StepState = 'pending' | 'current' | 'done';

/** 模板分类 */
export type TemplateCategory = 'poster' | 'social' | 'ecommerce' | 'brand';

/** 导出文件格式 */
export type ExportFormat = 'png' | 'jpg' | 'pdf';

/** 导出任务状态 */
export type ExportStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

/** 订阅方案 key */
export type PlanKey = 'free' | 'pro' | 'team';

/** 计费周期 */
export type BillingCycle = 'monthly' | 'yearly';

/** 订阅状态 */
export type SubscriptionStatus = 'active' | 'expired' | 'canceled' | 'trialing';

/** 支付渠道（mock=模拟网关 / wechat=微信支付 / alipay=支付宝） */
export type PaymentProvider = 'mock' | 'wechat' | 'alipay';

/** 支付订单状态机：pending → paid / failed / expired；paid 后可 refunded */
export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

/** 风格预设（生成器 chips） */
export type StylePreset = '不限' | '极简' | '手绘风' | '科技感' | '复古' | '清新';

/** 作品排序 */
export type WorkSort = 'recent' | 'oldest';
