import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';
import { ApiException } from '../../common/api-exception';
import { WorksService } from '../works/works.service';
import { ExportQueueService } from './queue/export-queue.service';

/** zip 打包结果：archiver 流 + 建议下载文件名 */
export interface ZipResult {
  stream: archiver.Archiver;
  fileName: string;
}

/**
 * 批量导出 zip 打包（P1 R3）：
 * - 所有权校验：全部 job 必须属于当前用户，任一非本人 → 整批 403 拒绝（不打包任何文件）
 * - 仅打包 succeeded job 的 files（uploads/exports/<jobId>/<fileId>）
 * - 文件名安全：safeFileName（非法字符 → '_'、截断 64）+ 重名追加 -N 后缀
 * - 流式输出（archiver），零整包内存驻留
 */
@Injectable()
export class ExportZipService {
  private readonly logger = new Logger(ExportZipService.name);

  constructor(
    private readonly worksService: WorksService,
    private readonly queue: ExportQueueService,
    private readonly config: ConfigService,
  ) {}

  /** 与前端 utils/format.ts safeFileName 一致的后端实现 */
  private safeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64);
  }

  async zipJobs(userId: string, jobIds: string[]): Promise<ZipResult> {
    // 1) 所有权校验：任一 job 非本人 → 整批 403
    const jobs = [];
    for (const id of jobIds) {
      const job = await this.queue.assertOwned(id, userId);
      jobs.push(job);
    }

    // 2) 仅打包 succeeded 且含文件的 job
    const succeeded = jobs.filter(
      (j) => j.status === 'succeeded' && Array.isArray(j.files) && j.files.length > 0,
    );
    if (succeeded.length === 0) {
      throw ApiException.validation('暂无可打包的已完成文件');
    }

    // 3) 收集绝对路径 + zip 内安全文件名（重名追加 -N 后缀）
    const uploadDir = this.config.get<string>('uploadDir') || './uploads';
    const usedNames = new Map<string, number>();
    const pending: { absPath: string; name: string }[] = [];

    for (const job of succeeded) {
      const work = await this.worksService.findById(job.workId).catch(() => null);
      const base = this.safeFileName(work?.title ?? '未命名作品');
      for (const file of job.files ?? []) {
        const sizeKey = file.sizeKey ?? 'file';
        const format = file.format ?? job.format ?? 'png';
        const desired = `${base}-${sizeKey}.${format}`;
        const count = (usedNames.get(desired) ?? 0) + 1;
        usedNames.set(desired, count);
        const name = count === 1 ? desired : `${base}-${sizeKey}-${count}.${format}`;

        const absPath = join(process.cwd(), uploadDir, 'exports', job.id, file.fileId);
        if (existsSync(absPath)) {
          pending.push({ absPath, name });
        }
      }
    }

    if (pending.length === 0) {
      throw ApiException.notFound('文件不存在或已被清理');
    }

    // 4) archiver 流式打包（pipe 时自动 finalize，由调用方 pipe 到响应）
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (err) => {
      this.logger.warn(`zip 打包警告: ${err.message}`);
    });
    archive.on('error', (err) => {
      this.logger.error(`zip 打包失败: ${err.message}`);
    });
    for (const item of pending) {
      archive.file(item.absPath, { name: item.name });
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const fileName = `弥画-批量导出-${dateStr}.zip`;

    this.logger.log(`zip 打包: userId=${userId} jobs=${succeeded.length} files=${pending.length} -> ${fileName}`);
    return { stream: archive, fileName };
  }
}
