import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  ERROR_CODES,
  GENERATION_STEPS,
  type GenerationCreateRequest,
  type GenerationCreateResponse,
  type GenerationResultDto,
  type GenerationStatus,
  type GenerationStatusDto,
} from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { WorksService } from '../works/works.service';
import { AI_PROVIDER_TOKEN, AiProvider } from './providers/ai-provider.interface';
import { RegenerateGenerationDto } from './dto/regenerate-generation.dto';
import type { StylePreset } from '@mira/contracts';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(GenerationEntity)
    private readonly gensRepo: Repository<GenerationEntity>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plansRepo: Repository<SubscriptionPlanEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @Inject(AI_PROVIDER_TOKEN)
    private readonly provider: AiProvider,
    private readonly config: ConfigService,
    private readonly worksService: WorksService,
  ) {}

  /** 创建生成任务：额度校验 → 落库 pending → 异步调度 provider */
  async createGeneration(
    userId: string,
    dto: GenerationCreateRequest,
  ): Promise<GenerationCreateResponse> {
    await this.assertQuota(userId);

    const gen = await this.gensRepo.save(
      this.gensRepo.create({
        ownerId: userId,
        prompt: dto.prompt,
        stylePreset: dto.stylePreset ?? null,
        options: (dto.options ?? {}) as unknown as Record<string, unknown>,
        status: 'pending',
        step: 0,
        steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
        provider: this.provider.name,
      }),
    );

    // 异步调度（不阻塞响应）；Mock 内部用 setTimeout 推进三态
    void this.provider.generate({
      generationId: gen.id,
      ownerId: userId,
      prompt: dto.prompt,
      stylePreset: dto.stylePreset,
      options: dto.options ?? {},
    });

    return { generationId: gen.id };
  }

  /** 查询任务状态（所有权校验） */
  async getGeneration(userId: string, id: string): Promise<GenerationStatusDto> {
    const gen = await this.gensRepo.findOne({ where: { id, ownerId: userId } });
    if (!gen) throw ApiException.notFound('生成任务不存在');
    return this.toDto(gen);
  }

  /**
   * AI 重绘（P1 R2）：校验作品所有权 → prompt 兜底解析 → 额度校验 → 建 generation
   * → 以 regenerate 模式调度 provider（**不新建作品**，仅写 generation.result）。
   * prompt 缺省时按 sourceGenerationId → generation.prompt 解析；无关联则标题+描述兜底。
   */
  async regenerateGeneration(
    userId: string,
    dto: RegenerateGenerationDto,
  ): Promise<GenerationCreateResponse> {
    // 1) 作品所有权校验：非本人 → 403
    const work = await this.worksService.findById(dto.workId);
    if (work.ownerId !== userId) {
      throw ApiException.forbidden('无权重绘该作品');
    }

    // 2) prompt 兜底解析（R2-5）：body.prompt → 关联 generation.prompt → 标题+描述；
    //    stylePreset 同理从关联 generation 复用（即便 body 已带 prompt 也会补全风格）
    let prompt = dto.prompt?.trim();
    let stylePreset: StylePreset | undefined = dto.stylePreset;
    if (work.sourceGenerationId) {
      const source = await this.gensRepo.findOne({
        where: { id: work.sourceGenerationId, ownerId: userId },
      });
      if (source) {
        if (!prompt && source.prompt) prompt = source.prompt;
        if (!stylePreset && source.stylePreset) stylePreset = source.stylePreset as StylePreset;
      }
    }
    if (!prompt) {
      prompt = [work.title, work.description].filter(Boolean).join('，') || work.title;
    }

    // 3) 额度校验（与普通生成一致；重绘同样消耗月度额度）
    await this.assertQuota(userId);

    // 4) 建 generation（pending）
    const gen = await this.gensRepo.save(
      this.gensRepo.create({
        ownerId: userId,
        prompt,
        stylePreset: stylePreset ?? null,
        options: (dto.options ?? {}) as unknown as Record<string, unknown>,
        status: 'pending',
        step: 0,
        steps: GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
        provider: this.provider.name,
      }),
    );

    // 5) 异步调度 provider（regenerate 模式：成功不新建作品，仅写 result）
    void this.provider.generate({
      generationId: gen.id,
      ownerId: userId,
      prompt,
      stylePreset: stylePreset === '不限' ? undefined : stylePreset,
      options: dto.options ?? {},
      regenerateWorkId: dto.workId,
    });

    return { generationId: gen.id };
  }

  /** 本月生成次数是否达到套餐额度 */
  private async assertQuota(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    const planKey = user?.plan ?? 'free';

    const plan = await this.plansRepo.findOne({ where: { key: planKey } });
    const quota = plan?.quotaPerMonth ?? 10;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const used = await this.gensRepo.count({
      where: { ownerId: userId, createdAt: MoreThanOrEqual(startOfMonth) },
    });

    if (used >= quota) {
      throw new ApiException(
        ERROR_CODES.QUOTA_EXCEEDED,
        '本月生成次数已用完，升级 Pro 可解锁更多次数',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private toDto(gen: GenerationEntity): GenerationStatusDto {
    return {
      id: gen.id,
      status: gen.status as GenerationStatus,
      step: gen.step,
      steps:
        (gen.steps as GenerationStatusDto['steps']) ??
        GENERATION_STEPS.map((s) => ({ ...s, state: 'pending' as const })),
      provider: gen.provider,
      prompt: gen.prompt,
      stylePreset: gen.stylePreset,
      result: (gen.result as unknown as GenerationResultDto) ?? null,
      error: gen.errorCode
        ? { code: gen.errorCode, message: gen.errorMessage ?? '生成失败' }
        : null,
      createdAt: gen.createdAt.toISOString(),
      finishedAt: gen.finishedAt?.toISOString() ?? null,
    };
  }
}
