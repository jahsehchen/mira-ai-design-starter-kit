import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString({ message: '密码格式不正确' })
  @Length(8, 64, { message: '密码长度需为 8-64 位' })
  @Matches(/^\S+$/, { message: '密码不能包含空格' })
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64, { message: '昵称长度需为 1-64 位' })
  nickname?: string;
}
