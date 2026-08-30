import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportFormat, ExportSize } from '@mira/contracts';
import { ApiException } from '../../../common/api-exception';
import { ExportJobEntity } from '../../../database/entities/export-job.entity';
import { WorksService } from '../../works/works.service';
import { EXPORT_RENDERER_TOKEN, ExportRenderer } from '../renderer/export-renderer.interface';

/**
 * 进程内导出队列（P1-03）：
 * Promise 链串行处理，逐尺寸推进 progress/stageText（真实回传，非伪造）。
 * P2 可换 Bull/Redis，接口已抽象为 enqueue(jobId)。
 */
@Injectable()
export class ExportQueueService {
  private readonly logger = new Logger(ExportQueueService.name);
  private chain: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly jobsRepo: Repository<ExportJobEntity>,
    private readonly worksService: WorksService,
    @Inject(EXPORT_RENDERER_TOKEN)
    private readonly renderer: ExportRenderer,
    private readonly config: ConfigService,
  ) {}

  /** 入队（串行） */
  enqueue(jobId: string): void {
    this.chain = this.chain
      .then(() => this.processJob(jobId))
      .catch((err) => {
        this.logger.error(`导出队列处理异常 job=${jobId}`, err instanceof Error ? err.stack : String(err));
      });
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    job.status = 'processing';
    job.progress = 0;
    job.stageText = '正在准备文件…';
    await this.jobsRepo.save(job);

    const work = await this.worksService.findById(job.workId).catch(() => null);
    if (!work) {
      await this.fail(jobId, '作品不存在或已被删除');
      return;
    }

    const sizes = job.sizes as ExportSize[];
    const format = job.format as ExportFormat;
    const uploadDir = this.config.get<string>('uploadDir') || './uploads';
    const files: ExportJobEntity['files'] = [];

    for (let i = 0; i < sizes.length; i += 1) {
      const size = sizes[i];
      job.stageText = `正在生成 ${i + 1}/${sizes.length} 个文件…`;
      job.progress = Math.round((i / sizes.length) * 100);
      await this.jobsRepo.save(job);

      const fileName = `${size.key}.${format}`;
      const jobDir = join(process.cwd(), uploadDir, 'exports', jobId);
      if (!existsSync(jobDir)) mkdirSync(jobDir, { recursive: true });
      const outPath = join(jobDir, fileName);

      try {
        const { byteSize } = await this.renderer.render({
          work,
          format,
          width: size.width,
          height: size.height,
          outPath,
        });
        files.push({
          fileId: fileName,
          sizeKey: size.key,
          format,
          url: `/api/v1/export/files/${jobId}/${fileName}`,
          fileName,
          byteSize,
        });
      } catch (err) {
        this.logger.error(`导出渲染失败 job=${jobId} file=${fileName}`, err instanceof Error ? err.message : String(err));
        await this.fail(jobId, `生成文件「${fileName}」失败，请重试`);
        return;
      }
    }

    job.stageText = '正在打包文件…';
    job.progress = 95;
    await this.jobsRepo.save(job);

    job.status = 'succeeded';
    job.progress = 100;
    job.stageText = '全部完成';
    job.files = files;
    job.finishedAt = new Date();
    await this.jobsRepo.save(job);
    this.logger.log(`导出完成 job=${jobId} files=${files.length}`);
  }

  private async fail(jobId: string, message: string): Promise<void> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    job.status = 'failed';
    job.errorCode = 'EXPORT_FAILED';
    job.errorMessage = message;
    job.finishedAt = new Date();
    await this.jobsRepo.save(job);
  }

  /** 校验导出任务归属（供下载文件用） */
  async assertOwned(jobId: string, ownerId: string): Promise<ExportJobEntity> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId, ownerId } });
    if (!job) throw ApiException.notFound('导出任务不存在');
    return job;
  }
}
