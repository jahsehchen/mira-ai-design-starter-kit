import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 64, { message: '昵称长度需为 1-64 位' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @Length(0, 512)
  @IsUrl({ require_protocol: true }, { message: '头像地址格式不正确' })
  avatarUrl?: string;
}
