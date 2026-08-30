import { create } from 'zustand';
import {
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_STEPS,
  type GenerationOptions,
  type GenerationResultDto,
  type GenerationStatus,
  type GenerationStep,
  type StylePreset,
} from '@mira/contracts';
import { aiApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useUiStore } from './uiStore';

/**
 * 生成限频/排队（NVIDIA 免费层 40 RPM 保护）
 * ------------------------------------------------------------------
 * - 免费层约 40 RPM ≈ 1.5s/次；GENERATION_COOLDOWN_MS=10s 保证两次生成
 *   最短间隔，既有充足余量避免 429，体感也可接受。
 * - 后端若仍返回 429（限流），前端临时把冷却拉长到 RATE_LIMIT_COOLDOWN_MS
 *   =30s，并弹友好提示「生成的人太多了，稍等几秒再试」，给免费层喘息窗口。
 * - 冷却针对"生成动作频率"，与结果状态无关：reset 只清结果，不清除冷却。
 */

/** 正常生成冷却：两次生成之间的最短间隔（ms） */
export const GENERATION_COOLDOWN_MS = 10000;

/** 429 限流惩罚冷却：被后端限流时临时拉长（ms） */
export const RATE_LIMIT_COOLDOWN_MS = 30000;

/** 冷却拦截异常：页面捕获后静默处理（按钮已 disabled，仅作兜底） */
export class CooldownError extends Error {
  constructor(public readonly remainingSec: number) {
    super(`生成太频繁，请 ${remainingSec} 秒后再试`);
    this.name = 'CooldownError';
  }
}

/** 判断是否为 429 限流错误（httpStatus=429 或消息含「过于频繁/限流」） */
function isRateLimitError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.httpStatus === 429) return true;
    const msg = err.message ?? '';
    return msg.includes('过于频繁') || msg.includes('限流');
  }
  return false;
}

/** 前端生成四态（A3） */
export type GenerationPhase = 'idle' | 'loading' | 'success' | 'error';

export interface GenerationErrorState {
  code: string;
  message: string;
}

interface GenerationState {
  phase: GenerationPhase;
  status: GenerationStatus | null;
  step: number;
  steps: GenerationStep[];
  result: GenerationResultDto | null;
  error: GenerationErrorState | null;
  generationId: string | null;
  prompt: string;
  stylePreset: StylePreset;
  options: GenerationOptions;
  /** 冷却截止时间戳（ms），null 表示不在冷却 */
  cooldownUntil: number | null;
  /** 冷却剩余秒数（每秒递减，供 UI 展示） */
  cooldownRemainingSec: number;
  /** 是否处于 429 限流惩罚期（用于限流 toast 去重） */
  rateLimited: boolean;
  startGeneration: (payload: {
    prompt: string;
    stylePreset?: StylePreset;
    options?: GenerationOptions;
  }) => Promise<void>;
  retry: () => Promise<void>;
  /**
   * AI 重绘（P1 R2）：编辑器使用。复用冷却/429/轮询，**不新建作品**；
   * 返回最终 result（成功时），供调用方替换底图并自动保存。不动 startGeneration/retry。
   */
  regenerateForWork: (payload: {
    workId: string;
    prompt: string;
    stylePreset?: StylePreset;
    options?: GenerationOptions;
  }) => Promise<GenerationResultDto>;
  reset: () => void;
  stopPolling: () => void;
}

const MAX_POLL_TRIES = 60;

export const useGenerationStore = create<GenerationState>((set, get) => {
  let pollTimer: number | null = null;
  let pollTries = 0;
  let cooldownTimer: number | null = null;

  const stopPolling = () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    pollTries = 0;
  };

  /**
   * 启动冷却倒计时：每秒刷新 cooldownRemainingSec，到 0 自停并清态。
   * 计时器独立于组件生命周期，页面卸载后仍在递减，保证再次进入时剩余秒数准确。
   */
  const startCooldown = (durationMs: number) => {
    const deadline = Date.now() + durationMs;
    const current = get().cooldownUntil;
    // 已在冷却且截止时间不晚于本次 → 沿用现有计时器即可
    if (cooldownTimer !== null && current !== null && current >= deadline) {
      return;
    }
    if (cooldownTimer !== null) {
      window.clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
    set({ cooldownUntil: deadline, cooldownRemainingSec: Math.ceil(durationMs / 1000) });
    const timerId = window.setInterval(() => {
      const remainingSec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      set({ cooldownRemainingSec: remainingSec });
      if (remainingSec <= 0) {
        window.clearInterval(timerId);
        cooldownTimer = null;
        set({ cooldownUntil: null, cooldownRemainingSec: 0, rateLimited: false });
      }
    }, 1000);
    cooldownTimer = timerId;
  };

  /** 429 处理：首次弹友好 toast，之后只拉长惩罚冷却，避免连续 429 刷屏 */
  const handleRateLimit = () => {
    if (!get().rateLimited) {
      set({ rateLimited: true });
      useUiStore.getState().showToast('生成的人太多了，稍等几秒再试', 'warning');
    }
    startCooldown(RATE_LIMIT_COOLDOWN_MS);
  };

  const poll = (generationId: string) => {
    stopPolling();
    pollTries = 0;
    pollTimer = window.setInterval(async () => {
      pollTries += 1;
      try {
        const data = await aiApi.getGeneration(generationId);
        set({
          status: data.status,
          step: data.step,
          steps: data.steps,
        });
        if (data.status === 'succeeded' && data.result) {
          stopPolling();
          set({ phase: 'success', result: data.result, error: null });
          return;
        }
        if (data.status === 'failed') {
          stopPolling();
          set({
            phase: 'error',
            error: data.error ?? { code: 'GENERATION_FAILED', message: '生成失败，请重试' },
          });
          return;
        }
      } catch (err) {
        // 单次轮询失败忽略，继续尝试；仅 429 需要限流提示与惩罚冷却
        if (isRateLimitError(err)) {
          handleRateLimit();
        }
      }
      if (pollTries >= MAX_POLL_TRIES) {
        stopPolling();
        set({
          phase: 'error',
          error: { code: 'POLL_TIMEOUT', message: '生成超时，请重试' },
        });
      }
    }, GENERATION_POLL_INTERVAL_MS);
  };

  /**
   * 可 await 的轮询（重绘用）：轮询到 succeeded 返回 result，failed/超时 reject。
   * 与 poll 共用同一节奏与 429 处理，但不复用模块级 pollTimer（避免与生成页互相干扰）。
   */
  const pollUntilDone = (generationId: string): Promise<GenerationResultDto> =>
    new Promise((resolve, reject) => {
      stopPolling();
      pollTries = 0;
      const timerId = window.setInterval(async () => {
        pollTries += 1;
        try {
          const data = await aiApi.getGeneration(generationId);
          set({ status: data.status, step: data.step, steps: data.steps });
          if (data.status === 'succeeded' && data.result) {
            window.clearInterval(timerId);
            stopPolling();
            set({ phase: 'success', result: data.result, error: null });
            resolve(data.result);
            return;
          }
          if (data.status === 'failed') {
            window.clearInterval(timerId);
            stopPolling();
            const error = data.error ?? { code: 'GENERATION_FAILED', message: '生成失败，请重试' };
            set({ phase: 'error', error });
            reject(new Error(error.message));
            return;
          }
        } catch (err) {
          if (isRateLimitError(err)) handleRateLimit();
        }
        if (pollTries >= MAX_POLL_TRIES) {
          window.clearInterval(timerId);
          stopPolling();
          const error = { code: 'POLL_TIMEOUT', message: '生成超时，请重试' };
          set({ phase: 'error', error });
          reject(new Error(error.message));
        }
      }, GENERATION_POLL_INTERVAL_MS);
    });

  return {
    phase: 'idle',
    status: null,
    step: 0,
    steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
    result: null,
    error: null,
    generationId: null,
    prompt: '',
    stylePreset: '不限',
    options: { count: 2, autoMatch: true },
    cooldownUntil: null,
    cooldownRemainingSec: 0,
    rateLimited: false,

    startGeneration: async ({ prompt, stylePreset, options }) => {
      // 冷却拦截：不发起任何请求
      const cooldownUntil = get().cooldownUntil;
      if (cooldownUntil !== null && Date.now() < cooldownUntil) {
        const remainSec = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
        throw new CooldownError(remainSec);
      }

      stopPolling();
      set({
        phase: 'loading',
        status: 'pending',
        step: 0,
        steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
        result: null,
        error: null,
        prompt,
        stylePreset: stylePreset ?? '不限',
        options: options ?? { count: 2, autoMatch: true },
      });

      try {
        const { generationId } = await aiApi.createGeneration({
          prompt,
          stylePreset: stylePreset === '不限' ? undefined : stylePreset,
          options,
        });
        set({ generationId });
        // 成功发起生成 → 进入正常冷却
        startCooldown(GENERATION_COOLDOWN_MS);
        poll(generationId);
      } catch (err) {
        // 429：惩罚冷却 + 友好提示；错误卡展示友好文案，不再抛错避免页面双 toast
        if (isRateLimitError(err)) {
          handleRateLimit();
          set({
            phase: 'error',
            error: { code: 'RATE_LIMITED', message: '生成的人太多了，稍等几秒再试' },
          });
          return;
        }
        // 其他创建失败：落到错误态（避免 phase 卡在 loading 导致覆盖层常驻）
        set({
          phase: 'error',
          error: {
            code: 'GENERATION_FAILED',
            message: err instanceof Error ? err.message : '生成失败，请重试',
          },
        });
        throw err instanceof Error ? err : new Error('生成失败，请重试');
      }
    },

    retry: async () => {
      const { prompt, stylePreset, options } = get();
      await get().startGeneration({ prompt, stylePreset, options });
    },

    regenerateForWork: async ({ workId, prompt, stylePreset, options }) => {
      // 冷却拦截：不发起任何请求（与 startGeneration 一致）
      const cooldownUntil = get().cooldownUntil;
      if (cooldownUntil !== null && Date.now() < cooldownUntil) {
        const remainSec = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
        throw new CooldownError(remainSec);
      }

      stopPolling();
      set({
        phase: 'loading',
        status: 'pending',
        step: 0,
        steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
        result: null,
        error: null,
        prompt,
        stylePreset: stylePreset ?? '不限',
        options: options ?? { count: 2, autoMatch: true },
      });

      try {
        const { generationId } = await aiApi.regenerateGeneration({
          workId,
          prompt,
          stylePreset: stylePreset === '不限' ? undefined : stylePreset,
          options,
        });
        set({ generationId });
        // 成功发起重绘 → 进入正常冷却（复用 10s / 429 惩罚 30s）
        startCooldown(GENERATION_COOLDOWN_MS);
        // await 轮询直到终态，返回 result（失败会 reject，由调用方兜底不丢底图）
        return await pollUntilDone(generationId);
      } catch (err) {
        if (isRateLimitError(err)) {
          handleRateLimit();
          set({
            phase: 'error',
            error: { code: 'RATE_LIMITED', message: '生成的人太多了，稍等几秒再试' },
          });
          throw err;
        }
        // 创建失败或轮询终态失败：落到错误态并抛出（编辑器捕获后 Toast + 底图不变）
        set({
          phase: 'error',
          error: {
            code: 'GENERATION_FAILED',
            message: err instanceof Error ? err.message : '生成失败，请重试',
          },
        });
        throw err instanceof Error ? err : new Error('生成失败，请重试');
      }
    },

    reset: () => {
      stopPolling();
      // 注意：不清除 cooldownUntil/cooldownRemainingSec/rateLimited ——
      // 冷却针对"生成动作频率"，与结果状态无关；用户刚生成完无论结果如何，
      // 都应遵守间隔限制，避免通过 reset 绕过限频。
      set({
        phase: 'idle',
        status: null,
        step: 0,
        steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
        result: null,
        error: null,
        generationId: null,
      });
    },

    stopPolling,
  };
});
