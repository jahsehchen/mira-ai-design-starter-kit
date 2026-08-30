import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import type { PageResult, TemplateCategory, TemplateDto, WorkDto } from '@mira/contracts';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { TemplateEntity } from '../../database/entities/template.entity';
import { WorksService } from '../works/works.service';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(TemplateEntity)
    private readonly tplRepo: Repository<TemplateEntity>,
    private readonly worksService: WorksService,
  ) {}

  async list(query: {
    category?: TemplateCategory | 'all';
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PageResult<TemplateDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const keyword = query.keyword?.trim();

    const where: Record<string, unknown> = { isActive: true };
    if (query.category && query.category !== 'all') where.category = query.category;
    if (keyword) where.name = ILike(`%${keyword}%`);

    const [items, total] = await this.tplRepo.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((t) => this.toDto(t)),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<TemplateDto> {
    const tpl = await this.tplRepo.findOne({ where: { id, isActive: true } });
    if (!tpl) throw ApiException.notFound('模板不存在');
    return this.toDto(tpl);
  }

  /** 一键套用：根据模板生成作品草稿并进入编辑器 */
  async apply(userId: string, id: string): Promise<WorkDto> {
    const tpl = await this.tplRepo.findOne({ where: { id, isActive: true } });
    if (!tpl) throw ApiException.notFound('模板不存在');

    return this.worksService.create(userId, {
      title: tpl.name,
      description: tpl.description ?? `基于模板「${tpl.name}」创建`,
      canvasJson: tpl.canvasJson ?? this.buildCanvas(tpl),
      width: 1080,
      height: 1350,
      thumbnailUrl: null,
      formatMeta: { source: 'template', templateId: tpl.id },
    });
  }

  toDto(tpl: TemplateEntity): TemplateDto {
    return {
      id: tpl.id,
      name: tpl.name,
      category: tpl.category as TemplateCategory,
      description: tpl.description,
      thumbnailUrl: tpl.thumbnailUrl,
      gradientFrom: tpl.gradientFrom,
      gradientTo: tpl.gradientTo,
      displayText: tpl.displayText,
    };
  }

  private buildCanvas(tpl: TemplateEntity): Record<string, unknown> {
    return {
      version: 1,
      width: 1080,
      height: 1350,
      background: { type: 'gradient', from: tpl.gradientFrom, to: tpl.gradientTo },
      elements: [
        {
          type: 'text',
          id: 'title',
          text: tpl.displayText,
          x: 72,
          y: 820,
          fontSize: 64,
          fontWeight: 600,
          color: '#FFFFFF',
          fontFamily: 'display',
        },
      ],
      palette: [tpl.gradientFrom, tpl.gradientTo, '#FFFFFF', '#23272B'],
    };
  }
}
