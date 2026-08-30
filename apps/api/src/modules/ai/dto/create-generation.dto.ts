import { IsBoolean, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { STYLE_PRESETS, type GenerationOptions, type StylePreset } from '@mira/contracts';

export class GenerationOptionsDto implements GenerationOptions {
  @IsOptional()
  @IsIn([1, 2], { message: '备选数量只能是 1 或 2' })
  count?: 1 | 2;

  @IsOptional()
  @IsBoolean()
  autoMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}

export class CreateGenerationDto {
  @IsString({ message: '描述格式不正确' })
  @Length(1, 500, { message: '描述长度需为 1-500 字' })
  prompt!: string;

  @IsOptional()
  @IsIn(STYLE_PRESETS, { message: '风格预设无效' })
  stylePreset?: StylePreset;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationOptionsDto)
  options?: GenerationOptionsDto;
}
