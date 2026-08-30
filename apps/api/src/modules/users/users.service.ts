import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MessageResponse, UserPublic } from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { UserEntity } from '../../database/entities/user.entity';
import { WorkEntity } from '../../database/entities/work.entity';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { ExportJobEntity } from '../../database/entities/export-job.entity';
import { ShareEntity } from '../../database/entities/share.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(WorkEntity)
    private readonly worksRepo: Repository<WorkEntity>,
    @InjectRepository(GenerationEntity)
    private readonly gensRepo: Repository<GenerationEntity>,
    @InjectRepository(ExportJobEntity)
    private readonly exportRepo: Repository<ExportJobEntity>,
    @InjectRepository(ShareEntity)
    private readonly sharesRepo: Repository<ShareEntity>,
    @InjectRepository(UserSubscriptionEntity)
    private readonly subsRepo: Repository<UserSubscriptionEntity>,
  ) {}

  async updateProfile(
    userId: string,
    input: { nickname?: string; avatarUrl?: string },
  ): Promise<UserPublic> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw ApiException.notFound('用户不存在');

    if (input.nickname !== undefined) user.nickname = input.nickname.trim();
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || null;
    await this.usersRepo.save(user);

    return this.toUserPublic(user);
  }

  /** 注销：作品/生成/导出/分享/订阅硬删，用户软删 */
  async deleteAccount(userId: string): Promise<MessageResponse> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw ApiException.notFound('用户不存在');

    await this.worksRepo.delete({ ownerId: userId });
    await this.gensRepo.delete({ ownerId: userId });
    await this.exportRepo.delete({ ownerId: userId });
    await this.sharesRepo.delete({ createdBy: userId });
    await this.subsRepo.delete({ userId });

    await this.usersRepo.softDelete(userId);
    return { message: 'ok' };
  }

  toUserPublic(user: UserEntity): UserPublic {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      plan: user.plan as UserPublic['plan'],
      createdAt: user.createdAt.toISOString(),
    };
  }
}
