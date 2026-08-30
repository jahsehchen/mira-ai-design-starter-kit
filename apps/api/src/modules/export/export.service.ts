import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import {
  DEFAULT_PAGE_SIZE,
  EXPORT_PRESETS,
  MAX_PAGE_SIZE,
  type ExportCreateRequest,
  type ExportJobDto,
  type ExportPreset,
  type PageResult,
} from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { ExportJobEntity } from '../../database/entities/export-job.entity';
import { WorksService } from '../works/works.service';
import { ExportQueueService } from './queue/export-queue.service';
import type { BatchCreateExportDto } from './dto/batch-create-export.dto';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly jobsRepo: Repository<ExportJobEntity>,
    private readonly worksService: WorksService,
    private readonly queue: ExportQueueService,
    private readonly config: ConfigService,
  ) {}

  getPresets(): ExportPreset[] {
    return EXPORT_PRESETS;
  }

  async createJob(
    userId: string,
    dto: ExportCreateRequest,
  ): Promise<{ jobId: string }> {
    // 所有权校验：作品必须属于当前用户
    const work = await this.worksService.findById(dto.workId);
    if (work.ownerId !== userId) {
      throw ApiException.forbidden('无权导出该作品');
    }

    const job = await this.jobsRepo.save(
      this.jobsRepo.create({
        ownerId: userId,
        workId: dto.workId,
        format: dto.format,
        sizes: dto.sizes,
        status: 'pending',
        progress: 0,
        stageText: '等待处理',
      }),
    );

    this.queue.enqueue(job.id);
    return { jobId: job.id };
  }

  /**
   * 批量创建导出任务（P1 R3）：
   * 一次性校验全部作品所有权，**任一非本人 → 整批 403 拒绝且不创建任何 job**；
   * 通过后循环建 job 并全部入队（沿用进程内串行队列，不新增并行渲染）。
   */
  async batchCreateJobs(
    userId: string,
    dto: BatchCreateExportDto,
  ): Promise<{ jobIds: string[] }> {
    const uniqueWorkIds = [...new Set(dto.workIds)];

    // 所有权整批校验：任一失败 → 整批拒绝（不创建任何 job）
    for (const workId of uniqueWorkIds) {
      const work = await this.worksService.findById(workId);
      if (work.ownerId !== userId) {
        throw ApiException.forbidden('批量导出中包含非本人作品，已整批取消');
      }
    }

    // 循环建 job 并全部入队（串行）
    const jobIds: string[] = [];
    for (const workId of uniqueWorkIds) {
      const job = await this.jobsRepo.save(
        this.jobsRepo.create({
          ownerId: userId,
          workId,
          format: dto.format,
          sizes: dto.sizes,
          status: 'pending',
          progress: 0,
          stageText: '等待处理',
        }),
      );
      this.queue.enqueue(job.id);
      jobIds.push(job.id);
    }

    return { jobIds };
  }

  async getJob(userId: string, id: string): Promise<ExportJobDto> {
    const job = await this.jobsRepo.findOne({ where: { id, ownerId: userId } });
    if (!job) throw ApiException.notFound('导出任务不存在');
    return this.toDto(job);
  }

  async listJobs(
    userId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PageResult<ExportJobDto>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const [items, total] = await this.jobsRepo.findAndCount({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: items.map((j) => this.toDto(j)), total, page, pageSize };
  }

  /** 返回文件绝对路径（所有权 + 存在性校验） */
  async getFilePath(userId: string, jobId: string, fileId: string): Promise<string> {
    const job = await this.queue.assertOwned(jobId, userId);
    if (!job.files || !job.files.some((f) => f.fileId === fileId)) {
      throw ApiException.notFound('文件不存在');
    }

    const uploadDir = this.config.get<string>('uploadDir') || './uploads';
    const absPath = join(process.cwd(), uploadDir, 'exports', jobId, fileId);
    if (!existsSync(absPath)) {
      throw ApiException.notFound('文件不存在或已被清理');
    }
    return absPath;
  }

  toDto(job: ExportJobEntity): ExportJobDto {
    return {
      id: job.id,
      workId: job.workId,
      format: job.format as ExportJobDto['format'],
      sizes: (job.sizes ?? []) as ExportJobDto['sizes'],
      status: job.status as ExportJobDto['status'],
      progress: job.progress,
      stageText: job.stageText,
      files: (job.files as ExportJobDto['files']) ?? null,
      error: job.errorCode
        ? { code: job.errorCode, message: job.errorMessage ?? '导出失败' }
        : null,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }
}
