import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GenerationResultDto, GenerationStep } from '@mira/contracts';
import { GENERATION_STEPS } from '@mira/contracts';
import { AiProvider, AiPayload } from './ai-provider.interface';
import { GenerationEntity } from '../../../database/entities/generation.entity';
import { WorksService } from '../../works/works.service';

/**
 * 渐变配色池（与 Mock 一致，暖中性 + 墨蓝体系，作为生成底图的占位/兜底）
 */
const PALETTES: { from: string; to: string }[] = [
  { from: '#0D0F12', to: '#2B4CFF' },
  { from: '#1A33B8', to: '#9FADFF' },
  { from: '#2B4CFF', to: '#9FADFF' },
  { from: '#FBF0E2', to: '#D9D4CC' },
  { from: '#F3F1EE', to: '#D9D4CC' },
  { from: '#23272B', to: '#6B6760' },
  { from: '#1630A6', to: '#2240E0' },
  { from: '#7A5CF0', to: '#2B4CFF' },
];

const TITLES = ['未来已来', '新·视界', '夏日物语', '焕新登场', '灵感时刻', '城市漫游', '温暖日常', '此刻正好'];
const SUBTITLES = ['FUTURE IS NOW', 'NEW VISION', 'SUMMER STORY', 'FRESH START', 'MOMENT OF IDEA', 'CITY WALK', 'WARM DAYS', 'RIGHT NOW'];

/** 步进间隔：真实 API 调用不需要 Mock 那么久的动画时间，但仍留出短间隔让前端 LoadingSteps 可见 */
const STEP_MS = [0, 300, 600];

/** NVIDIA 免费层约 40 RPM，429 最多重试 2 次（指数退避） */
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

/** FLUX 系列模型对宽高的约束：16 的倍数且 ∈ [256, 1440] */
const MIN_SIZE = 256;
const MAX_SIZE = 1440;

/** flux.1-dev 的 steps 约束：≥ 5（实测 8 效果好、耗时适中） */
const DEFAULT_STEPS = 8;
const DEFAULT_CFG_SCALE = 3.5;

/** 默认模型 / 端点（可被 AI_NVIDIA_MODEL / AI_NVIDIA_BASE_URL 覆盖） */
const DEFAULT_MODEL = 'black-forest-labs/flux.1-dev';
const DEFAULT_BASE_URL = 'https://ai.api.nvidia.com/v1/genai';

/** 文本模型前置优化（LLM）默认配置：OpenAI 兼容 chat/completions 端点（与 FLUX 的 GenAI 端点不同） */
const DEFAULT_LLM_MODEL = 'deepseek-ai/deepseek-v4-flash-0731';
const DEFAULT_LLM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
/** LLM 调用超时：15s（AbortController 实现） */
const LLM_TIMEOUT_MS = 15_000;
/** LLM 429 最多重试 1 次（退避 1s），其余错误直接降级 */
const LLM_MAX_RETRIES = 1;

/** 风格预设 → FLUX 英文风格描述（中文预设映射，LLM 提示词里使用） */
const STYLE_EN: Record<string, string> = {
  极简: 'minimalist, clean and simple with lots of negative space',
  手绘风: 'hand-drawn illustration style, charming and organic',
  科技感: 'futuristic tech style, sleek and high-tech',
  复古: 'retro vintage style, nostalgic and warm',
  清新: 'fresh and clean style, light and airy',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSteps(step: number): GenerationStep[] {
  return GENERATION_STEPS.map((s, index) => ({
    ...s,
    state: (index < step ? 'done' : index === step ? 'current' : 'pending') as GenerationStep['state'],
  }));
}

/** NVIDIA 调用失败的领域错误：message 为可直接展示给用户的中文文案 */
class NvidiaApiError extends Error {
  constructor(
    /** 机器可读错误码：RATE_LIMITED / INVALID_API_KEY / BAD_REQUEST / NO_IMAGE / UPSTREAM / NETWORK */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NvidiaApiError';
  }
}

/**
 * NVIDIA Build AI 供应商（真实文生图，A12 验收）。
 *
 * 调用方式（已实测验证，2026-08-28）：
 * - build.nvidia.com 托管 API 按「模型独立 GenAI 路径」：
 *   `POST https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev`
 * - 鉴权：`Authorization: Bearer nvapi-*`
 * - 请求体：`{ prompt, width, height, steps, seed, cfg_scale }`
 *   （实测约束：steps ≥ 5；不接受 aspect_ratio / n / response_format 字段）
 * - 响应：`{ artifacts: [{ base64, finishReason, seed }] }`（base64 为 JPEG）
 *
 * 三态状态机与 Mock 一致：pending → processing(step 0→1→2) → succeeded / failed；
 * options.simulateFailure 或 prompt 含「失败」→ 确定性失败（便于测试）。
 */
@Injectable()
export class NvidiaAiProvider implements AiProvider {
  readonly name = 'nvidia';

  private readonly logger = new Logger(NvidiaAiProvider.name);

  constructor(
    @InjectRepository(GenerationEntity)
    private readonly gensRepo: Repository<GenerationEntity>,
    private readonly config: ConfigService,
    private readonly worksService: WorksService,
  ) {}

  async generate(payload: AiPayload): Promise<void> {
    const { generationId, ownerId, prompt, stylePreset, options, regenerateWorkId } = payload;

    const gen = await this.gensRepo.findOne({ where: { id: generationId } });
    if (!gen) return;

    // 进入 processing
    gen.status = 'processing';
    gen.step = 0;
    gen.steps = buildSteps(0);
    await this.gensRepo.save(gen);

    try {
      // step 0 → 1（匹配版式与配色）
      await this.advanceStep(generationId, 1);

      // 确定性失败（与 Mock 一致，便于联调前的本地测试）
      if (options?.simulateFailure === true || prompt.includes('失败')) {
        await this.fail(generationId, 'GENERATION_FAILED', 'AI 生成遇到了一点问题，请换个描述再试一次');
        return;
      }

      // step 1 → 2（生成）
      await this.advanceStep(generationId, 2);

      // 调用 NVIDIA Build 生成底图
      const apiKey = this.config.get<string>('ai.nvidia.apiKey') || '';
      if (!apiKey) {
        await this.fail(generationId, 'MISSING_API_KEY', '未配置 NVIDIA_API_KEY，请先在 build.nvidia.com 申请后填入 .env');
        return;
      }

      const model = this.config.get<string>('ai.nvidia.model') || DEFAULT_MODEL;
      const baseUrl = this.config.get<string>('ai.nvidia.baseUrl') || DEFAULT_BASE_URL;

      // —— 文本模型前置优化：中文 prompt → 英文图像描述 → 再调 FLUX ——
      // 任何失败都自动降级回原始中文 prompt，不阻塞生图（真实可用性优先）
      let genPrompt = prompt;
      let genTitle: string | null = null;
      const promptEnhance = this.config.get<boolean>('ai.nvidia.promptEnhance');
      if (promptEnhance === true) {
        const enhanced = await this.enhancePrompt(apiKey, prompt, stylePreset);
        if (enhanced) {
          genPrompt = enhanced.prompt;
          genTitle = enhanced.title;
          this.logger.log(`NVIDIA prompt 优化生效: ${generationId} -> ${genTitle ? `标题「${genTitle}」` : '（未提取到标题）'}`);
        }
      } else {
        this.logger.log(`NVIDIA prompt 优化已跳过（AI_NVIDIA_PROMPT_ENHANCE 未启用），使用原始 prompt`);
      }

      const { b64Json, imageUrl } = await this.callNvidia(apiKey, baseUrl, model, genPrompt);
      const thumbnailUrl = await this.saveImage(generationId, b64Json, imageUrl);

      // 完成：结果写回任务 + 落库为作品
      const result = this.buildResult(generationId, prompt, stylePreset, thumbnailUrl, options?.count ?? 2, genTitle);

      const done = await this.gensRepo.findOne({ where: { id: generationId } });
      if (!done) return;
      done.status = 'succeeded';
      done.step = 3;
      done.steps = buildSteps(3);
      done.result = result as unknown as Record<string, unknown>;
      done.finishedAt = new Date();
      await this.gensRepo.save(done);

      // 结果落库为作品（P1 R2 重绘模式：跳过，与 Mock 语义一致，避免垃圾作品）
      if (regenerateWorkId) {
        this.logger.log(`NVIDIA 生成成功(重绘): ${generationId} -> ${result.title}（不新建作品）`);
      } else {
        await this.worksService.create(ownerId, {
          title: result.title,
          description: prompt,
          canvasJson: result.canvasJson,
          width: 1080,
          height: 1350,
          thumbnailUrl,
          formatMeta: { source: 'ai', provider: this.name, model, stylePreset: stylePreset ?? '不限' },
          sourceGenerationId: generationId,
        });

        this.logger.log(`NVIDIA 生成成功: ${generationId} -> ${result.title}`);
      }
    } catch (err) {
      this.logger.error(`NVIDIA 生成异常: ${generationId}`, err instanceof Error ? err.stack : String(err));
      if (err instanceof NvidiaApiError) {
        await this.fail(generationId, err.code, err.message);
      } else {
        await this.fail(generationId, 'GENERATION_FAILED', '服务开小差了，请稍后再试');
      }
    }
  }

  /**
   * 调用 NVIDIA Build 文生图 GenAI 端点（按模型独立路径）。
   * - 请求：`POST {baseUrl}/{model}`，body `{ prompt, width, height, steps, seed, cfg_scale }`
   *   （实测：`https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev`；
   *    steps ≥ 5；不接受 aspect_ratio / n / response_format 字段）
   * - 响应：`{ artifacts: [{ base64, finishReason, seed }] }`
   * - 429（免费层限流）最多重试 2 次，指数退避（1s → 2s）
   * - 非 200 / 无图片 → 抛 NvidiaApiError（确定性、可读中文）
   */
  private async callNvidia(
    apiKey: string,
    baseUrl: string,
    model: string,
    prompt: string,
  ): Promise<{ b64Json: string | null; imageUrl: string | null }> {
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/${model}`;
    const width = this.normalizeSize(1080);
    const height = this.normalizeSize(1350);
    const body = {
      prompt,
      width,
      height,
      steps: DEFAULT_STEPS,
      seed: 0,
      cfg_scale: DEFAULT_CFG_SCALE,
    };

    let lastError: NvidiaApiError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.logger.warn(`NVIDIA 429 限流，${backoffMs}ms 后第 ${attempt + 1} 次重试（共 ${MAX_RETRIES + 1} 次机会）`);
        await sleep(backoffMs);
      }

      try {
        return await this.doRequest(endpoint, apiKey, body);
      } catch (err) {
        if (err instanceof NvidiaApiError && err.code === 'RATE_LIMITED' && attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new NvidiaApiError('RATE_LIMITED', 'NVIDIA 生成请求过于频繁（免费层约 40 次/分钟），请稍后再试');
  }

  private async doRequest(
    endpoint: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<{ b64Json: string | null; imageUrl: string | null }> {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`NVIDIA 网络错误: ${endpoint}`, err instanceof Error ? err.message : String(err));
      throw new NvidiaApiError('NETWORK', '无法连接 NVIDIA 服务，请检查网络后重试');
    }

    if (res.status === 429) {
      throw new NvidiaApiError('RATE_LIMITED', 'NVIDIA 生成请求过于频繁（免费层约 40 次/分钟），请稍后再试');
    }

    if (res.status === 401 || res.status === 403) {
      throw new NvidiaApiError('INVALID_API_KEY', 'NVIDIA_API_KEY 无效或已过期，请到 build.nvidia.com 重新生成');
    }

    let json: {
      artifacts?: { base64?: string; url?: string; finishReason?: string }[];
      error?: { message?: string };
      detail?: unknown;
    };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      throw new NvidiaApiError('UPSTREAM', `NVIDIA 返回了无法解析的响应（HTTP ${res.status}），请稍后再试`);
    }

    if (!res.ok) {
      const detail = this.extractErrorMessage(json);
      if (res.status === 400) {
        throw new NvidiaApiError('BAD_REQUEST', `生成参数被 NVIDIA 拒绝：${detail}`);
      }
      throw new NvidiaApiError('UPSTREAM', `NVIDIA 服务返回错误（HTTP ${res.status}）：${detail}`);
    }

    const item = json.artifacts?.[0];
    const b64Json = item?.base64 || null;
    const imageUrl = item?.url || null;

    if (!b64Json && !imageUrl) {
      throw new NvidiaApiError('NO_IMAGE', 'NVIDIA 未返回生成图片，请换一个描述重试');
    }

    return { b64Json, imageUrl };
  }

  /** 从 NVIDIA 各种错误响应形态中提取可读信息 */
  private extractErrorMessage(json: { error?: { message?: string }; detail?: unknown }): string {
    if (typeof json?.error?.message === 'string' && json.error.message) return json.error.message;
    if (typeof json?.detail === 'string') return json.detail;
    if (Array.isArray(json?.detail)) return JSON.stringify(json.detail).slice(0, 200);
    return '未知错误';
  }

  /**
   * 文本模型前置优化：把用户中文描述改写为适合 FLUX 文生图的英文图像描述 + 中文标题。
   * - 端点：`POST {llmBaseUrl}/chat/completions`（OpenAI 兼容，与 FLUX 的 GenAI 端点不同）
   * - 鉴权：同一 NVIDIA_API_KEY
   * - 超时 15s（AbortController）；429 最多重试 1 次（退避 1s）
   * - **任何失败都返回 null**（网络/超时/429/解析失败/空内容/非英文描述），外层降级用原始中文 prompt 继续生图
   */
  private async enhancePrompt(
    apiKey: string,
    prompt: string,
    stylePreset: string | undefined,
  ): Promise<{ prompt: string; title: string | null } | null> {
    const llmBaseUrl = this.config.get<string>('ai.nvidia.llmBaseUrl') || DEFAULT_LLM_BASE_URL;
    const llmModel = this.config.get<string>('ai.nvidia.llmModel') || DEFAULT_LLM_MODEL;

    const endpoint = `${llmBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = {
      model: llmModel,
      messages: [
        { role: 'system', content: this.buildLlmSystemPrompt() },
        { role: 'user', content: this.buildLlmUserPrompt(prompt, stylePreset) },
      ],
      temperature: 0.7,
      max_tokens: 300,
    };

    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        this.logger.warn(`NVIDIA LLM 429 限流，${RETRY_BASE_MS}ms 后重试一次`);
        await sleep(RETRY_BASE_MS);
      }

      try {
        const content = await this.doLlmRequest(endpoint, apiKey, body);
        const parsed = this.parseEnhanceResult(content);
        if (parsed) return parsed;
        // 内容为空或解析不出英文描述 → 降级
        this.logger.warn(`NVIDIA LLM 返回内容无法解析为英文描述，跳过 prompt 优化（${llmModel}）`);
        return null;
      } catch (err) {
        if (err instanceof NvidiaApiError && err.code === 'RATE_LIMITED' && attempt < LLM_MAX_RETRIES) {
          lastErr = err;
          continue;
        }
        this.logger.warn(
          `NVIDIA LLM prompt 优化失败（${err instanceof Error ? err.message : String(err)}），降级使用原始中文 prompt 继续生图`,
        );
        return null;
      }
    }

    // 重试仍 429 → 降级，不阻断生图
    this.logger.warn(
      `NVIDIA LLM prompt 优化失败（${lastErr instanceof Error ? lastErr.message : String(lastErr)}），降级使用原始中文 prompt 继续生图`,
    );
    return null;
  }

  /** 调用 NVIDIA 文本模型（OpenAI 兼容 chat/completions），返回 choices[0].message.content */
  private async doLlmRequest(
    endpoint: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.error(
        isTimeout
          ? `NVIDIA LLM 请求超时（${LLM_TIMEOUT_MS / 1000}s），降级为原始 prompt`
          : `NVIDIA LLM 网络错误: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new NvidiaApiError('NETWORK', 'NVIDIA LLM 网络异常');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      throw new NvidiaApiError('RATE_LIMITED', 'NVIDIA LLM 请求过于频繁');
    }
    if (res.status === 401 || res.status === 403) {
      throw new NvidiaApiError('INVALID_API_KEY', 'NVIDIA_API_KEY 无效或已过期');
    }

    let json: { choices?: { message?: { content?: string } }[] };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      throw new NvidiaApiError('UPSTREAM', `NVIDIA LLM 返回了无法解析的响应（HTTP ${res.status}）`);
    }

    if (!res.ok) {
      throw new NvidiaApiError('UPSTREAM', `NVIDIA LLM 服务返回错误（HTTP ${res.status}）`);
    }

    const content = json.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : '';
  }

  /**
   * 解析 LLM 输出：英文图像描述 + `[TITLE]` 前缀的中文标题。
   * - 标题提取失败返回 title=null（外层回退现有 extractTitle 逻辑）
   * - 描述不是英文（说明模型没听话）→ 返回 null，整体降级
   */
  private parseEnhanceResult(content: string): { prompt: string; title: string | null } | null {
    let title: string | null = null;
    const titleMatch = content.match(/\[TITLE\]\s*([^\n]+)/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].replace(/[，。！？、,.!?]/g, '').trim();
      if (title.length > 12) title = title.slice(0, 12);
      if (title.length < 4) title = null;
    }

    // 英文描述 = 去掉 [TITLE] 行及其之后的内容，去掉整体引号与多余空白
    let promptPart = titleMatch ? content.slice(0, titleMatch.index).trim() : content.trim();
    promptPart = promptPart
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!promptPart || !/^[a-zA-Z]/.test(promptPart)) return null;
    return { prompt: promptPart, title };
  }

  /** System prompt：要求模型只输出英文图像描述 + [TITLE] 中文标题 */
  private buildLlmSystemPrompt(): string {
    return [
      '你是一名专业的 AI 文生图提示词工程师，负责把用户的中文描述改写为适合 FLUX 文生图模型的高质量英文图像描述。',
      '严格要求：',
      '1. 只输出英文图像描述本身，不要任何解释、不要用引号包裹、不要 markdown 格式；',
      '2. 描述整体氛围、主体与配色，用词具体、画面感强；',
      '3. 关注构图与留白：为海报预留顶部标题区和底部价格区（clean composition with empty space reserved for headline and price text）；',
      '4. 结合用户的风格预设生成对应风格；',
      '5. 英文描述控制在 50-80 个单词；',
      '6. 英文描述之后另起一行，用 [TITLE] 前缀输出一个 4-12 字的中文标题，适合用作海报主标题。',
      '输出格式：',
      '<英文图像描述>',
      '[TITLE]<中文标题>',
    ].join('\n');
  }

  /** User prompt：把用户描述与风格预设一起交给 LLM */
  private buildLlmUserPrompt(prompt: string, stylePreset: string | undefined): string {
    const styleEn = stylePreset ? STYLE_EN[stylePreset] : null;
    const styleLine = styleEn
      ? `风格预设：${stylePreset}（${styleEn}）`
      : '风格预设：不限（请根据内容自动判断合适风格）';
    return `${styleLine}\n用户描述：${prompt}`;
  }

  /** FLUX 要求宽高为 16 的倍数且 ∈ [256, 1440]；海报 1080×1350 会规范化为 1088×1344 */
  private normalizeSize(value: number): number {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)));
    return Math.round(clamped / 16) * 16;
  }

  /**
   * 保存底图到 uploads/thumbnails/：
   * 优先用返回的 b64_json 直接落盘（少一次网络请求、不依赖远端 URL 存活）；
   * 仅当 NVIDIA 返回 url 时才下载。
   * 返回可被 /uploads 静态服务访问的相对路径。
   */
  private async saveImage(genId: string, b64Json: string | null, imageUrl: string | null): Promise<string> {
    let buffer: Buffer;
    if (b64Json) {
      buffer = Buffer.from(b64Json, 'base64');
    } else if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        throw new NvidiaApiError('NO_IMAGE', `NVIDIA 图片下载失败（HTTP ${imgRes.status}），请稍后再试`);
      }
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new NvidiaApiError('NO_IMAGE', 'NVIDIA 未返回生成图片，请换一个描述重试');
    }

    if (buffer.length === 0) {
      throw new NvidiaApiError('NO_IMAGE', 'NVIDIA 返回的图片为空，请换一个描述重试');
    }

    const uploadDir = this.config.get<string>('uploadDir') || './uploads';
    const thumbDir = join(process.cwd(), uploadDir, 'thumbnails');
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });

    const outPath = join(thumbDir, `${genId}.png`);
    writeFileSync(outPath, buffer);
    return `/uploads/thumbnails/${genId}.png`;
  }

  /** 推进一步：sleep 后写 step 状态（与 Mock 一致） */
  private async advanceStep(id: string, step: number): Promise<void> {
    await sleep(STEP_MS[step] ?? 300);
    const gen = await this.gensRepo.findOne({ where: { id } });
    if (!gen || gen.status !== 'processing') return;
    gen.step = step;
    gen.steps = buildSteps(step);
    await this.gensRepo.save(gen);
  }

  private async fail(id: string, errorCode: string, message: string): Promise<void> {
    const gen = await this.gensRepo.findOne({ where: { id } });
    if (!gen) return;
    gen.status = 'failed';
    gen.steps = buildSteps(gen.step);
    gen.errorCode = errorCode;
    gen.errorMessage = message;
    gen.finishedAt = new Date();
    await this.gensRepo.save(gen);
    this.logger.warn(`NVIDIA 生成失败: ${id} -> [${errorCode}] ${message}`);
  }

  /**
   * 结果组装：渐变占位逻辑复用 Mock 的 buildResult（确定性伪随机方案），
   * 并把 AI 底图 URL 塞进 canvasJson.background.image 供前端渲染。
   */
  private buildResult(
    generationId: string,
    prompt: string,
    stylePreset: string | undefined,
    thumbnailUrl: string,
    count: number = 2,
    enhancedTitle?: string | null,
  ): GenerationResultDto {
    const seed = this.hashString(prompt);
    const styleSeed = stylePreset ? this.hashString(stylePreset) : 0;
    const palette = PALETTES[(seed + styleSeed) % PALETTES.length];
    // 标题优先级：LLM 提取的中文标题 → extractTitle 兜底 → 占位标题池
    const title =
      (enhancedTitle && enhancedTitle.trim() ? enhancedTitle.trim().slice(0, 20) : null) ||
      this.extractTitle(prompt) ||
      TITLES[seed % TITLES.length];
    const subtitle = SUBTITLES[(seed + 1) % SUBTITLES.length];
    const countLabel = count === 1 ? '' : `方案 ${(seed % count) + 1} · `;

    return {
      title,
      subtitle: `${countLabel}${stylePreset ?? '自动风格'}`,
      gradient: { from: palette.from, to: palette.to },
      palette: [palette.from, palette.to, '#FFFFFF', '#23272B'],
      thumbnailUrl,
      canvasJson: {
        version: 1,
        width: 1080,
        height: 1350,
        background: {
          type: 'gradient',
          from: palette.from,
          to: palette.to,
          image: thumbnailUrl, // NVIDIA 生成的底图（前端有 image 字段则显示底图，否则回退渐变）
        },
        elements: [
          { type: 'text', id: 'title', text: title, x: 72, y: 780, fontSize: 72, fontWeight: 600, color: '#FFFFFF', fontFamily: 'display' },
          { type: 'text', id: 'subtitle', text: subtitle, x: 72, y: 880, fontSize: 28, fontWeight: 400, color: 'rgba(255,255,255,0.92)', fontFamily: 'sans' },
        ],
        palette: [palette.from, palette.to, '#FFFFFF', '#23272B'],
      },
    };
  }

  /** 提取 prompt 中「」内的标题；否则取前 6 个字（与 Mock 一致） */
  private extractTitle(prompt: string): string | null {
    const match = prompt.match(/「(.+?)」/);
    if (match && match[1]) return match[1].slice(0, 20);
    const cleaned = prompt
      .replace(/[，。！？、,.!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 6) : null;
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
