import { IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

export class UpdateWorkDto {
  @IsOptional()
  @IsString()
  @Length(1, 128, { message: '标题长度需为 1-128 位' })
  title?: string;

  @IsOptional()
  @IsObject()
  canvasJson?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;

  /** 缩略图 URL（AI 重绘成功后随新底图同步更新，R2-2） */
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: '缩略图地址过长' })
  thumbnailUrl?: string | null;
}
