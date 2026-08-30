import type { GenerationOptions } from '@mira/contracts';

/** 生成任务载荷（AiProvider.generate 入参） */
export interface AiPayload {
  generationId: string;
  ownerId: string;
  prompt: string;
  stylePreset?: string;
  options: GenerationOptions;
  /**
   * 重绘模式（P1 R2）：存在时生成成功**不新建作品**，仅把结果写回 generation，
   * 由前端把新底图保存到原作品（避免每次重绘产生垃圾作品）。
   */
  regenerateWorkId?: string;
}

/**
 * AI 供应商适配接口（A12 验收）。
 * 业务层只依赖本接口（DI token），通过 AI_PROVIDER 环境变量切换 Mock / 真实供应商。
 */
export interface AiProvider {
  readonly name: string;
  /** 异步调度一次生成：负责推进任务状态并最终写回 DB（成功写 result/作品，失败写 error）。 */
  generate(payload: AiPayload): Promise<void>;
}

/** DI token：AiService 依赖此 token 获取当前供应商实例 */
export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';
