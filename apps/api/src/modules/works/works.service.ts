import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import type { PageResult, WorkDto, WorksMatchingIdsResponse } from '@mira/contracts';
import { DEFAULT_PAGE_SIZE, EXPORT_MAX_WORKS_PER_BATCH, MAX_PAGE_SIZE } from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { WorkEntity } from '../../database/entities/work.entity';

@Injectable()
export class WorksService {
  constructor(
    @InjectRepository(WorkEntity)
    private readonly worksRepo: Repository<WorkEntity>,
  ) {}

  async create(
    ownerId: string,
    input: {
      title: string;
      description?: string;
      canvasJson?: Record<string, unknown>;
      width?: number;
      height?: number;
      thumbnailUrl?: string | null;
      formatMeta?: Record<string, unknown> | null;
      sourceGenerationId?: string | null;
    },
  ): Promise<WorkDto> {
    const work = await this.worksRepo.save(
      this.worksRepo.create({
        ownerId,
        title: input.title,
        description: input.description ?? null,
        canvasJson: input.canvasJson ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        formatMeta: input.formatMeta ?? null,
        sourceGenerationId: input.sourceGenerationId ?? null,
      }),
    );
    return this.toDto(work);
  }

  /**
   * list 与 matchingIds 共用的筛选条件（单一来源，防两处条件漂移）：
   * ownerId 过滤 + 标题 ILike（keyword 为空时不加标题条件）。
   */
  private buildWhere(ownerId: string, keyword?: string): Record<string, unknown> {
    const where: Record<string, unknown> = { ownerId };
    const kw = keyword?.trim();
    if (kw) where.title = ILike(`%${kw}%`);
    return where;
  }

  async list(
    ownerId: string,
    query: { page?: number; pageSize?: number; sort?: 'recent' | 'oldest'; keyword?: string },
  ): Promise<PageResult<WorkDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const where = this.buildWhere(ownerId, query.keyword);

    const [items, total] = await this.worksRepo.findAndCount({
      where,
      order: { createdAt: query.sort === 'oldest' ? 'ASC' : 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((w) => this.toDto(w)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * R5 跨页全选：返回当前筛选（owner + 标题 ILike + 排序）下按排序的前 ≤20 个作品 id 与匹配总数。
   * where 与 list 完全一致（buildWhere 单一来源）；total 用 countBy 与列表 total 天然一致。
   * 仅返回 id，不携带 canvasJson（防滥用/减负）；limit 服务端钳制 [1, EXPORT_MAX_WORKS_PER_BATCH]（纵深防御）。
   */
  async matchingIds(
    ownerId: string,
    query: { sort?: 'recent' | 'oldest'; keyword?: string; limit?: number },
  ): Promise<WorksMatchingIdsResponse> {
    const limit = Math.min(
      EXPORT_MAX_WORKS_PER_BATCH,
      Math.max(1, query.limit ?? EXPORT_MAX_WORKS_PER_BATCH),
    );
    const where = this.buildWhere(ownerId, query.keyword);

    const [items, total] = await Promise.all([
      this.worksRepo.find({
        where,
        order: { createdAt: query.sort === 'oldest' ? 'ASC' : 'DESC' },
        take: limit,
        select: { id: true },
      }),
      this.worksRepo.countBy(where),
    ]);

    return { ids: items.map((w) => w.id), total };
  }

  async findOwned(ownerId: string, id: string): Promise<WorkEntity> {
    const work = await this.worksRepo.findOne({ where: { id, ownerId } });
    if (!work) throw ApiException.notFound('作品不存在');
    return work;
  }

  async findById(id: string): Promise<WorkEntity> {
    const work = await this.worksRepo.findOne({ where: { id } });
    if (!work) throw ApiException.notFound('作品不存在');
    return work;
  }

  async get(ownerId: string, id: string): Promise<WorkDto> {
    return this.toDto(await this.findOwned(ownerId, id));
  }

  async update(
    ownerId: string,
    id: string,
    input: {
      title?: string;
      canvasJson?: Record<string, unknown>;
      width?: number;
      height?: number;
      thumbnailUrl?: string | null;
    },
  ): Promise<WorkDto> {
    const work = await this.findOwned(ownerId, id);
    if (input.title !== undefined) work.title = input.title;
    if (input.canvasJson !== undefined) work.canvasJson = input.canvasJson;
    if (input.width !== undefined) work.width = input.width;
    if (input.height !== undefined) work.height = input.height;
    if (input.thumbnailUrl !== undefined) work.thumbnailUrl = input.thumbnailUrl;
    await this.worksRepo.save(work);
    return this.toDto(work);
  }

  async remove(ownerId: string, id: string): Promise<{ message: 'ok' }> {
    const work = await this.findOwned(ownerId, id);
    await this.worksRepo.delete(work.id);
    return { message: 'ok' };
  }

  async duplicate(ownerId: string, id: string): Promise<WorkDto> {
    const work = await this.findOwned(ownerId, id);
    const copy = await this.worksRepo.save(
      this.worksRepo.create({
        ownerId,
        title: `${work.title} 副本`,
        description: work.description,
        canvasJson: work.canvasJson,
        width: work.width,
        height: work.height,
        thumbnailUrl: work.thumbnailUrl,
        formatMeta: work.formatMeta,
        sourceGenerationId: work.sourceGenerationId,
      }),
    );
    return this.toDto(copy);
  }

  toDto(work: WorkEntity): WorkDto {
    return {
      id: work.id,
      title: work.title,
      description: work.description,
      thumbnailUrl: work.thumbnailUrl,
      canvasJson: work.canvasJson,
      width: work.width,
      height: work.height,
      formatMeta: work.formatMeta,
      sourceGenerationId: work.sourceGenerationId,
      createdAt: work.createdAt.toISOString(),
      updatedAt: work.updatedAt.toISOString(),
    };
  }
}
