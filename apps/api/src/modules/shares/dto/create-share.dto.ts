import { IsUUID } from 'class-validator';

export class CreateShareDto {
  @IsUUID('4', { message: 'workId 无效' })
  workId!: string;
}
