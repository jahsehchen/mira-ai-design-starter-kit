/**
 * 全部 REST 调用函数（按模块分组）。
 * 统一 envelope 已在 client 解包，这里直接返回业务数据类型。
 */
import { apiGet, apiPost, apiPatch, apiDelete, apiDownload } from './client';
import type {
  AuthResponse,
  BatchExportCreateRequest,
  BatchExportCreateResponse,
  ExportCreateRequest,
  ExportCreateResponse,
  ExportJobDto,
  ExportPreset,
  GenerationCreateRequest,
  GenerationCreateResponse,
  GenerationStatusDto,
  MessageResponse,
  MockPayRequest,
  MockPayResponse,
  PageResult,
  PlanDto,
  RefreshResponse,
  RegenerateRequest,
  RegisterRequest,
  ShareCreateRequest,
  ShareDto,
  SharePreviewResponse,
  SubscriptionDto,
  TemplateCategory,
  TemplateDto,
  UpgradeRequest,
  UpgradeResponse,
  UpdateProfileRequest,
  UserPublic,
  WorkCreateRequest,
  WorkDto,
  WorkMatchingIdsQuery,
  WorkQuery,
  WorkSort,
  WorksMatchingIdsResponse,
  WorkUpdateRequest,
  ZipExportRequest,
} from '@mira/contracts';

/* ---------- auth ---------- */
export const authApi = {
  register: (data: RegisterRequest) => apiPost<AuthResponse>('/auth/register', data),
  login: (data: { email: string; password: string }) => apiPost<AuthResponse>('/auth/login', data),
  refresh: (refreshToken: string) => apiPost<RefreshResponse>('/auth/refresh', { refreshToken }),
  logout: () => apiPost<MessageResponse>('/auth/logout'),
  me: () => apiGet<UserPublic>('/auth/me'),
};

/* ---------- users ---------- */
export const usersApi = {
  updateMe: (data: UpdateProfileRequest) => apiPatch<UserPublic>('/users/me', data),
  deleteMe: () => apiDelete<MessageResponse>('/users/me'),
};

/* ---------- works ---------- */
export const worksApi = {
  list: (query: WorkQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.sort) params.set('sort', query.sort);
    if (query.keyword) params.set('keyword', query.keyword);
    const qs = params.toString();
    return apiGet<PageResult<WorkDto>>(`/works${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiGet<WorkDto>(`/works/${id}`),
  /** R5 跨页全选：仅返回匹配 id + total（≤20，服务端钳制），不携带 canvasJson */
  matchingIds: (query: WorkMatchingIdsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.sort) params.set('sort', query.sort);
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    const qs = params.toString();
    return apiGet<WorksMatchingIdsResponse>(`/works/matching-ids${qs ? `?${qs}` : ''}`);
  },
  create: (data: WorkCreateRequest) => apiPost<WorkDto>('/works', data),
  update: (id: string, data: WorkUpdateRequest) => apiPatch<WorkDto>(`/works/${id}`, data),
  remove: (id: string) => apiDelete<MessageResponse>(`/works/${id}`),
  duplicate: (id: string) => apiPost<WorkDto>(`/works/${id}/duplicate`),
};

/* ---------- ai ---------- */
export const aiApi = {
  createGeneration: (data: GenerationCreateRequest) =>
    apiPost<GenerationCreateResponse>('/ai/generations', data),
  /** AI 重绘（P1 R2）：后端以 regenerate 模式运行，不新建作品 */
  regenerateGeneration: (data: RegenerateRequest) =>
    apiPost<GenerationCreateResponse>('/ai/generations/regenerate', data),
  getGeneration: (id: string) => apiGet<GenerationStatusDto>(`/ai/generations/${id}`),
};

/* ---------- templates ---------- */
export const templatesApi = {
  list: (params: { category?: TemplateCategory | 'all'; keyword?: string; page?: number; pageSize?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.category && params.category !== 'all') search.set('category', params.category);
    if (params.keyword) search.set('keyword', params.keyword);
    if (params.page) search.set('page', String(params.page));
    if (params.pageSize) search.set('pageSize', String(params.pageSize));
    const qs = search.toString();
    return apiGet<PageResult<TemplateDto>>(`/templates${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiGet<TemplateDto>(`/templates/${id}`),
  apply: (id: string) => apiPost<WorkDto>(`/templates/${id}/apply`),
};

/* ---------- export ---------- */
export const exportApi = {
  presets: () => apiGet<ExportPreset[]>('/export/presets'),
  createJob: (data: ExportCreateRequest) => apiPost<ExportCreateResponse>('/export/jobs', data),
  /** 批量创建导出任务（P1 R3）：任一作品非本人 → 整批 403 且不创建任何 job */
  batchCreateJobs: (data: BatchExportCreateRequest) =>
    apiPost<BatchExportCreateResponse>('/export/batch-jobs', data),
  /** zip 打包下载（P1 R3）：后端流式打包，返回 Blob */
  zipDownload: (data: ZipExportRequest) =>
    apiPost<Blob>('/export/zip', data, { responseType: 'blob' }),
  getJob: (id: string) => apiGet<ExportJobDto>(`/export/jobs/${id}`),
  listJobs: (query: { page?: number; pageSize?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return apiGet<PageResult<ExportJobDto>>(`/export/jobs${qs ? `?${qs}` : ''}`);
  },
  downloadFile: (jobId: string, fileId: string) =>
    apiDownload(`/export/files/${jobId}/${fileId}`),
};

/* ---------- subscriptions ---------- */
export const subscriptionsApi = {
  plans: () => apiGet<PlanDto[]>('/subscriptions/plans'),
  me: () => apiGet<SubscriptionDto>('/subscriptions/me'),
  upgrade: (data: UpgradeRequest) => apiPost<UpgradeResponse>('/subscriptions/upgrade', data),
  /** 取消续费（T05）：幂等置 user_subscriptions.status='canceled'，不立即降级 user.plan */
  cancel: () => apiPost<MessageResponse>('/subscriptions/cancel'),
};

/* ---------- payments ---------- */
export const paymentsApi = {
  /** 模拟支付（无真实商户资质时的验收路径）：确认支付后调用，成功后套餐生效 */
  mockPay: (data: MockPayRequest) => apiPost<MockPayResponse>('/payments/mock-pay', data),
};

/* ---------- shares ---------- */
export const sharesApi = {
  create: (data: ShareCreateRequest) => apiPost<ShareDto>('/shares', data),
  get: (token: string) => apiGet<SharePreviewResponse>(`/shares/${token}`),
};

/* ---------- health ---------- */
export const healthApi = {
  check: () => apiGet<{ status: 'ok'; version: string; uptime: number; db: 'up' }>('/health'),
};

export type { WorkSort };
