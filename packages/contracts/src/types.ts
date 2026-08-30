/**
 * MIRA·弥画 共享 DTO / 实体只读类型
 * 与架构设计 §3.2 REST API 契约精确对齐（字段名、可选性、嵌套结构）。
 */
import type {
  BillingCycle,
  ExportFormat,
  ExportStatus,
  GenerationStatus,
  GenerationStepKey,
  PaymentOrderStatus,
  PaymentProvider,
  PlanKey,
  StepState,
  StylePreset,
  SubscriptionStatus,
  TemplateCategory,
  WorkSort,
} from './enums';

/* ---------- 通用 ---------- */

/** 统一响应 envelope */
export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
}

/** 分页结果 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 通用 ok 响应 */
export interface MessageResponse {
  message: 'ok';
}

/* ---------- 认证 auth ---------- */

export interface UserPublic {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  plan: PlanKey;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/* ---------- 用户 users ---------- */

export interface UpdateProfileRequest {
  nickname?: string;
  avatarUrl?: string;
}

/* ---------- 作品 works ---------- */

export interface WorkDto {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  canvasJson: Record<string, unknown> | null;
  width: number | null;
  height: number | null;
  formatMeta: Record<string, unknown> | null;
  sourceGenerationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCreateRequest {
  title: string;
  description?: string;
  canvasJson?: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface WorkUpdateRequest {
  title?: string;
  canvasJson?: Record<string, unknown>;
  width?: number;
  height?: number;
  /** 缩略图 URL（AI 重绘成功后随新底图同步更新，R2-2） */
  thumbnailUrl?: string | null;
}

export interface WorkQuery {
  page?: number;
  pageSize?: number;
  sort?: WorkSort;
  keyword?: string;
}

/** R5 跨页全选：查询匹配 id 的轻量请求（where 与 GET /works 一致） */
export interface WorkMatchingIdsQuery {
  sort?: WorkSort;
  keyword?: string;
  /** 可选，服务端钳制 ≤ EXPORT_MAX_WORKS_PER_BATCH(=20) */
  limit?: number;
}

/** R5 跨页全选：匹配 id 响应（仅 id + total，不携带 canvasJson） */
export interface WorksMatchingIdsResponse {
  /** 当前筛选（owner + 标题 ILike + 排序）下按排序的前 ≤20 个作品 id */
  ids: string[];
  /** 匹配总数（与 GET /works total 一致）；>20 时前端据此提示截取 */
  total: number;
}

/* ---------- AI 生成 ai ---------- */

export interface GenerationOptions {
  /** 生成方案数量（默认 2） */
  count?: 1 | 2;
  /** 自动匹配字体配色（默认 true） */
  autoMatch?: boolean;
  /** 模拟失败（确定性可测） */
  simulateFailure?: boolean;
}

export interface GenerationCreateRequest {
  prompt: string;
  stylePreset?: StylePreset;
  options?: GenerationOptions;
}

export interface GenerationCreateResponse {
  generationId: string;
}

export interface GenerationStep {
  key: GenerationStepKey;
  label: string;
  state: StepState;
}

export interface GenerationError {
  code: string;
  message: string;
}

export interface GenerationResultDto {
  title: string;
  subtitle: string;
  gradient: { from: string; to: string };
  palette: string[];
  thumbnailUrl: string | null;
  canvasJson: Record<string, unknown>;
}

export interface GenerationStatusDto {
  id: string;
  status: GenerationStatus;
  step: number;
  steps: GenerationStep[];
  provider: string;
  /** 原始描述（R2-5 编辑器重绘 prompt 来源） */
  prompt: string;
  /** 风格预设（R2-5 编辑器重绘复用原风格） */
  stylePreset: string | null;
  result: GenerationResultDto | null;
  error: GenerationError | null;
  createdAt: string;
  finishedAt: string | null;
}

/* ---------- 模板 templates ---------- */

export interface TemplateDto {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string | null;
  thumbnailUrl: string | null;
  gradientFrom: string;
  gradientTo: string;
  displayText: string;
}

export interface TemplateQuery {
  category?: TemplateCategory | 'all';
  keyword?: string;
  page?: number;
  pageSize?: number;
}

/* ---------- 导出 export ---------- */

export interface ExportPreset {
  key: string;
  width: number;
  height: number;
  label: string;
  category: string;
}

export interface ExportSize {
  key: string;
  width: number;
  height: number;
  label: string;
}

export interface ExportCreateRequest {
  workId: string;
  format: ExportFormat;
  sizes: ExportSize[];
}

export interface ExportCreateResponse {
  jobId: string;
}

export interface ExportFile {
  fileId: string;
  sizeKey: string;
  format: ExportFormat;
  url: string;
  fileName: string;
  byteSize: number;
}

export interface ExportError {
  code: string;
  message: string;
}

export interface ExportJobDto {
  id: string;
  workId: string;
  format: ExportFormat;
  sizes: ExportSize[];
  status: ExportStatus;
  progress: number;
  stageText: string;
  files: ExportFile[] | null;
  error: ExportError | null;
  createdAt: string;
  finishedAt: string | null;
}

/* ---------- AI 重绘（P1 R2） ---------- */

export interface RegenerateRequest {
  workId: string;
  /** 可选：不传由后端按 sourceGenerationId / 标题兜底解析（R2-5） */
  prompt?: string;
  stylePreset?: StylePreset;
  options?: GenerationOptions;
}

/* ---------- 批量导出（P1 R3） ---------- */

export interface BatchExportCreateRequest {
  /** 1..20；后端一次性校验所有权，任一非本人整批拒绝 */
  workIds: string[];
  format: ExportFormat;
  /** 1..10 */
  sizes: ExportSize[];
}

export interface BatchExportCreateResponse {
  jobIds: string[];
}

export interface ZipExportRequest {
  /** 1..200（20 作品 × 10 尺寸上限）；仅打包 succeeded job 的文件 */
  jobIds: string[];
}

/* ---------- 订阅 subscriptions ---------- */

export interface PlanDto {
  key: PlanKey;
  name: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  quotaPerMonth: number;
  features: string[];
}

export interface SubscriptionDto {
  plan: PlanKey;
  name: string;
  remainingGenerations: number;
  quotaPerMonth: number;
  resetAt: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
}

export interface UpgradeRequest {
  planKey: 'pro' | 'team';
  billingCycle: BillingCycle;
}

/**
 * 升级响应（Q8 支付系统框架）：
 * 不再直接生效套餐，而是返回支付订单，由支付回调/模拟支付确认后生效。
 */
export interface UpgradeResponse {
  status: 'order_created';
  orderId: string;
  orderNo: string;
  amountCents: number;
  planKey: PlanKey;
  billingCycle: BillingCycle;
  provider: PaymentProvider;
  /** 支付跳转链接（mock 指向站内模拟支付页；真实网关为支付 URL，可能为空） */
  payUrl: string | null;
  /** 二维码内容（如微信 Native 扫码，可能为空） */
  qrCode: string | null;
  message: string;
}

/* ---------- 支付 payments ---------- */

/** 支付订单 DTO（payment_orders 表只读视图） */
export interface PaymentOrderDto {
  id: string;
  orderNo: string;
  userId: string;
  planKey: PlanKey;
  billingCycle: BillingCycle;
  /** 金额，单位：分 */
  amountCents: number;
  currency: 'CNY';
  provider: PaymentProvider;
  status: PaymentOrderStatus;
  /** 网关交易号（支付成功后回填） */
  tradeNo: string | null;
  paidAt: string | null;
  /** 订单过期时间（默认创建后 15 分钟） */
  expiresAt: string;
  createdAt: string;
}

/** 模拟支付请求（无真实商户资质时的验收路径） */
export interface MockPayRequest {
  orderId: string;
}

/** 模拟支付响应 */
export interface MockPayResponse {
  status: 'paid';
  planKey: PlanKey;
  message: string;
}

/* ---------- 分享 shares ---------- */

export interface ShareCreateRequest {
  workId: string;
}

export interface ShareDto {
  shareId: string;
  token: string;
  url: string;
}

export interface WorkPreviewDto {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  canvasJson: Record<string, unknown> | null;
  ownerNickname: string;
}

export interface SharePreviewResponse {
  work: WorkPreviewDto;
}

/* ---------- 健康 health ---------- */

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptime: number;
  db: 'up' | 'down';
}
