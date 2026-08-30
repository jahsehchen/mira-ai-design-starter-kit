import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import type {
  ExportJobDto,
  ExportPreset,
  PageResult,
} from '@mira/contracts';
import { ok, okPage } from '../../common/envelope';
import { ExportService } from './export.service';
import { ExportZipService } from './export-zip.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateExportDto } from './dto/create-export.dto';
import { BatchCreateExportDto } from './dto/batch-create-export.dto';
import { ZipExportDto } from './dto/zip-export.dto';

@ApiTags('export')
@Controller('export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly exportZipService: ExportZipService,
  ) {}

  @Get('presets')
  async presets() {
    return ok<ExportPreset[]>(this.exportService.getPresets());
  }

  @Post('jobs')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateExportDto) {
    return ok<{ jobId: string }>(await this.exportService.createJob(user.id, dto), '导出任务已创建');
  }

  @Post('batch-jobs')
  async batchCreate(@CurrentUser() user: AuthUser, @Body() dto: BatchCreateExportDto) {
    return ok<{ jobIds: string[] }>(
      await this.exportService.batchCreateJobs(user.id, dto),
      '批量导出任务已创建',
    );
  }

  @Post('zip')
  @Header('Content-Type', 'application/zip')
  async zip(@CurrentUser() user: AuthUser, @Body() dto: ZipExportDto, @Res() res: Response): Promise<void> {
    const { stream, fileName } = await this.exportZipService.zipJobs(user.id, dto.jobIds);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    // 流式打包：pipe 后 finalize（archiver 会在 finalize 后写入中央目录并结束流）
    stream.pipe(res);
    await stream.finalize();
  }

  @Get('jobs')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.exportService.listJobs(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return okPage<ExportJobDto>(result.items, result.total, result.page, result.pageSize);
  }

  @Get('jobs/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok<ExportJobDto>(await this.exportService.getJob(user.id, id));
  }

  @Get('files/:jobId/:fileId')
  @Header('Content-Type', 'application/octet-stream')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const absPath = await this.exportService.getFilePath(user.id, jobId, fileId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileId)}`,
    );
    createReadStream(absPath).pipe(res);
  }
}
