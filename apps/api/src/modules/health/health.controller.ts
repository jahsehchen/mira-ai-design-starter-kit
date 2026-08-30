import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ok } from '../../common/envelope';
import type { HealthResponse } from '@mira/contracts';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  async health(): Promise<ReturnType<typeof ok<HealthResponse>>> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      db = 'down';
    }
    return ok<HealthResponse>({
      status: 'ok',
      version: this.config.get<string>('npm_package_version') || '1.0.0',
      uptime: process.uptime(),
      db,
    });
  }
}
