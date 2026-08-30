import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ExportZipService } from './export-zip.service';
import { ExportQueueService } from './queue/export-queue.service';
import { PlaceholderRenderer } from './renderer/placeholder.renderer';
import { EXPORT_RENDERER_TOKEN } from './renderer/export-renderer.interface';
import { ExportJobEntity } from '../../database/entities/export-job.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { WorksModule } from '../works/works.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExportJobEntity, UserEntity]), WorksModule, AuthModule],
  controllers: [ExportController],
  providers: [
    ExportService,
    ExportQueueService,
    ExportZipService,
    {
      provide: EXPORT_RENDERER_TOKEN,
      useClass: PlaceholderRenderer,
    },
  ],
  exports: [ExportService],
})
export class ExportModule {}
