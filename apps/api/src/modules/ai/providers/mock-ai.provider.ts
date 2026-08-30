import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { GenerationResultDto, GenerationStep } from '@mira/contracts';
import { GENERATION_STEPS } from '@mira/contracts';
import { AiProvider, AiPayload } from './ai-provider.interface';
import { GenerationEntity } from '../../../database/entities/generation.entity';
import { WorksService } from '../../works/works.service';

/** 渐变配色池（暖中性 + 墨蓝体系，符合设计令牌） */
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

const STEP_MS = [0, 800, 1600]; // 理解 → 匹配 → 生成 的推进时刻

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function buildSteps(step: number): GenerationStep[] {
  return GENERATION_STEPS.map((s, index) => ({
    ...s,
    state: (index < step ? 'done' : index === step ? 'current' : 'pending') as GenerationStep['state'],
  }));
}

/**
 * Mock AI 供应商（默认实现，A3/A12）。
 * 三态状态机：pending → processing(step 0→1→2) → succeeded / failed。
 * - options.simulateFailure 或 prompt 含「失败」→ 确定性失败
 * - AI_MOCK_FAIL_RATE 支持随机失败演示
 * - 成功时用 sharp 生成渐变缩略图（webp），并落库为作品
 */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  private readonly logger = new Logger(MockAiProvider.name);

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

    const simulateFailure = options?.simulateFailure === true || prompt.includes('失败');
    const failRate = this.config.get<number>('ai.mockFailRate') || 0;
    const failNow = simulateFailure || (failRate > 0 && Math.random() < failRate);

    try {
      // step 0 → 1（匹配）
      await this.advanceStep(generationId, 1);

      if (failNow) {
        await this.fail(generationId, 'AI 生成遇到了一点问题，请换个描述再试一次');
        return;
      }

      // step 1 → 2（生成）
      await this.advanceStep(generationId, 2);

      // 完成
      const result = this.buildResult(generationId, prompt, stylePreset, options?.count ?? 2);
      const thumbnailUrl = await this.generateThumbnail(result.gradient.from, result.gradient.to, generationId);
      result.thumbnailUrl = thumbnailUrl;

      const done = await this.gensRepo.findOne({ where: { id: generationId } });
      if (!done) return;
      done.status = 'succeeded';
      done.step = 3;
      done.steps = buildSteps(3);
      done.result = result as unknown as Record<string, unknown>;
      done.finishedAt = new Date();
      await this.gensRepo.save(done);

      // 结果落库为作品（P1 R2 重绘模式：跳过，避免每次重绘产生垃圾作品；
      // 前端负责把新底图保存到原作品）
      if (regenerateWorkId) {
        this.logger.log(`生成成功(重绘): ${generationId} -> ${result.title}（不新建作品）`);
      } else {
        await this.worksService.create(ownerId, {
          title: result.title,
          description: prompt,
          canvasJson: result.canvasJson,
          width: 1080,
          height: 1350,
          thumbnailUrl,
          formatMeta: { source: 'ai', stylePreset: stylePreset ?? '不限' },
          sourceGenerationId: generationId,
        });

        this.logger.log(`生成成功: ${generationId} -> ${result.title}`);
      }
    } catch (err) {
      this.logger.error(`Mock 生成异常: ${generationId}`, err instanceof Error ? err.stack : String(err));
      await this.fail(generationId, '服务开小差了，请稍后再试');
    }
  }

  /** 推进一步：sleep 后写 step 状态 */
  private async advanceStep(id: string, step: number): Promise<void> {
    await sleep(STEP_MS[step] ?? 800);
    const gen = await this.gensRepo.findOne({ where: { id } });
    if (!gen || gen.status !== 'processing') return;
    gen.step = step;
    gen.steps = buildSteps(step);
    await this.gensRepo.save(gen);
  }

  private async fail(id: string, message: string): Promise<void> {
    const gen = await this.gensRepo.findOne({ where: { id } });
    if (!gen) return;
    gen.status = 'failed';
    gen.steps = buildSteps(gen.step);
    gen.errorCode = 'GENERATION_FAILED';
    gen.errorMessage = message;
    gen.finishedAt = new Date();
    await this.gensRepo.save(gen);
    this.logger.warn(`生成失败: ${id} -> ${message}`);
  }

  /** 确定性伪随机结果：同一 prompt 产出稳定方案 */
  private buildResult(
    generationId: string,
    prompt: string,
    stylePreset?: string,
    count: number = 2,
  ): GenerationResultDto {
    const seed = this.hashString(prompt);
    const styleSeed = stylePreset ? this.hashString(stylePreset) : 0;
    const palette = PALETTES[(seed + styleSeed) % PALETTES.length];
    const title = this.extractTitle(prompt) || TITLES[seed % TITLES.length];
    const subtitle = SUBTITLES[(seed + 1) % SUBTITLES.length];
    const countLabel = count === 1 ? '' : `方案 ${(seed % count) + 1} · `;

    return {
      title,
      subtitle: `${countLabel}${stylePreset ?? '自动风格'}`,
      gradient: { from: palette.from, to: palette.to },
      palette: [palette.from, palette.to, '#FFFFFF', '#23272B'],
      thumbnailUrl: null,
      canvasJson: {
        version: 1,
        width: 1080,
        height: 1350,
        background: { type: 'gradient', from: palette.from, to: palette.to },
        elements: [
          { type: 'text', id: 'title', text: title, x: 72, y: 780, fontSize: 72, fontWeight: 600, color: '#FFFFFF', fontFamily: 'display' },
          { type: 'text', id: 'subtitle', text: subtitle, x: 72, y: 880, fontSize: 28, fontWeight: 400, color: 'rgba(255,255,255,0.92)', fontFamily: 'sans' },
        ],
        palette: [palette.from, palette.to, '#FFFFFF', '#23272B'],
      },
    };
  }

  /** 提取 prompt 中「」内的标题；否则取前 6 个字 */
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

  /** sharp 生成渐变缩略图（webp，400×500） */
  private async generateThumbnail(from: string, to: string, genId: string): Promise<string> {
    const width = 400;
    const height = 500;
    const buffer = Buffer.alloc(width * height * 4);
    const [r1, g1, b1] = hexToRgb(from);
    const [r2, g2, b2] = hexToRgb(to);

    for (let y = 0; y < height; y += 1) {
      const t = y / (height - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        buffer[i] = r;
        buffer[i + 1] = g;
        buffer[i + 2] = b;
        buffer[i + 3] = 255;
      }
    }

    const uploadDir = this.config.get<string>('uploadDir') || './uploads';
    const thumbDir = join(process.cwd(), uploadDir, 'thumbnails');
    if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });

    const outPath = join(thumbDir, `${genId}.webp`);
    await sharp(buffer, { raw: { width, height, channels: 4 } })
      .webp({ quality: 80 })
      .toFile(outPath);
    return `/uploads/thumbnails/${genId}.webp`;
  }
}
