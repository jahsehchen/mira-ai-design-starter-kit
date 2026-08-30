import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString({ message: 'refreshToken 格式不正确' })
  @MinLength(10, { message: 'refreshToken 无效' })
  refreshToken!: string;
}
