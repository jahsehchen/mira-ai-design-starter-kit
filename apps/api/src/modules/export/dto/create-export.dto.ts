import { IsArray, IsIn, IsNotEmpty, IsNumber, IsString, IsUUID, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import type { ExportFormat, ExportSize } from '@mira/contracts';

export class ExportSizeDto implements ExportSize {
  @IsString()
  @IsNotEmpty({ message: '尺寸标识不能为空' })
  @Type(() => String)
  key!: string;

  @IsNumber({}, { message: '宽度必须是数字' })
  @Type(() => Number)
  width!: number;

  @IsNumber({}, { message: '高度必须是数字' })
  @Type(() => Number)
  height!: number;

  @IsString()
  @Type(() => String)
  label!: string;
}

export class CreateExportDto {
  @IsUUID('4', { message: 'workId 无效' })
  workId!: string;

  @IsIn(['png', 'jpg', 'pdf'], { message: '格式仅支持 png/jpg/pdf' })
  format!: ExportFormat;

  @IsArray({ message: '请至少选择一个尺寸' })
  @ArrayMinSize(1, { message: '请至少选择一个尺寸' })
  @ArrayMaxSize(10, { message: '一次最多导出 10 个尺寸' })
  @ValidateNested({ each: true })
  @Type(() => ExportSizeDto)
  sizes!: ExportSizeDto[];
}
