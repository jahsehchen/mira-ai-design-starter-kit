import { IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { STYLE_PRESETS, type StylePreset } from '@mira/contracts';
import { GenerationOptionsDto } from './create-generation.dto';

/**
 * AI 重绘请求 DTO（P1 R2）：
 * - workId 必填；prompt/stylePreset/options 可选（缺省由后端按作品关联 generation / 标题兜底解析）。
 * 注意：嵌套类属性必须带校验装饰器，否则 ValidationPipe whitelist 会剥离无装饰器字段。
 */
export class RegenerateGenerationDto {
  @IsUUID('4', { message: 'workId 无效' })
  workId!: string;

  @IsOptional()
  @IsString({ message: '描述格式不正确' })
  @Length(1, 500, { message: '描述长度需为 1-500 字' })
  prompt?: string;

  @IsOptional()
  @IsIn(STYLE_PRESETS, { message: '风格预设无效' })
  stylePreset?: StylePreset;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationOptionsDto)
  options?: GenerationOptionsDto;
}
