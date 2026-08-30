import { IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateWorkDto {
  @IsString()
  @Length(1, 128, { message: '标题长度需为 1-128 位' })
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

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
}
