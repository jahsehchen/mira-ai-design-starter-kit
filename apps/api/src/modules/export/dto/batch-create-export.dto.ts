import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EXPORT_MAX_SIZES_PER_JOB,
  EXPORT_MAX_WORKS_PER_BATCH,
  type ExportFormat,
} from '@mira/contracts';
import { ExportSizeDto } from './create-export.dto';

/**
 * 批量创建导出任务 DTO（P1 R3）：
 * workIds 1..20；sizes 1..10（沿用单作品上限，前后端共用常量）。
 * 后端一次性校验全部所有权，任一非本人 → 整批拒绝且不创建任何 job。
 */
export class BatchCreateExportDto {
  @IsArray({ message: '请选择要导出的作品' })
  @ArrayMinSize(1, { message: '请至少选择 1 个作品' })
  @ArrayMaxSize(EXPORT_MAX_WORKS_PER_BATCH, {
    message: `一次最多导出 ${EXPORT_MAX_WORKS_PER_BATCH} 个作品`,
  })
  @IsUUID('4', { each: true, message: 'workId 无效' })
  workIds!: string[];

  @IsIn(['png', 'jpg', 'pdf'], { message: '格式仅支持 png/jpg/pdf' })
  format!: ExportFormat;

  @IsArray({ message: '请至少选择一个尺寸' })
  @ArrayMinSize(1, { message: '请至少选择一个尺寸' })
  @ArrayMaxSize(EXPORT_MAX_SIZES_PER_JOB, {
    message: `一次最多导出 ${EXPORT_MAX_SIZES_PER_JOB} 个尺寸`,
  })
  @ValidateNested({ each: true })
  @Type(() => ExportSizeDto)
  sizes!: ExportSizeDto[];
}
