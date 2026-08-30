import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  @IsString({ message: '密码格式不正确' })
  @Length(1, 64, { message: '密码不能为空' })
  password!: string;
}
