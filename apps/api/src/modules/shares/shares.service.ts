import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import type { ShareDto, SharePreviewResponse, WorkPreviewDto } from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { ShareEntity } from '../../database/entities/share.entity';
import { WorkEntity } from '../../database/entities/work.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class SharesService {
  constructor(
    @InjectRepository(ShareEntity)
    private readonly sharesRepo: Repository<ShareEntity>,
    @InjectRepository(WorkEntity)
    private readonly worksRepo: Repository<WorkEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  /** 创建分享链接（作品所有权校验） */
  async create(userId: string, workId: string): Promise<ShareDto> {
    const work = await this.worksRepo.findOne({ where: { id: workId } });
    if (!work) throw ApiException.notFound('作品不存在');
    if (work.ownerId !== userId) throw ApiException.forbidden('无权分享该作品');

    const token = randomBytes(16).toString('hex');
    const share = await this.sharesRepo.save(
      this.sharesRepo.create({
        workId,
        token,
        createdBy: userId,
        expiresAt: null,
        viewCount: 0,
      }),
    );

    return {
      shareId: share.id,
      token: share.token,
      url: `/share/${share.token}`,
    };
  }

  /** 公开只读预览（无需登录） */
  async getByToken(token: string): Promise<SharePreviewResponse> {
    const share = await this.sharesRepo.findOne({ where: { token } });
    if (!share) throw ApiException.notFound('分享链接不存在或已失效');
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw ApiException.notFound('分享链接已过期');
    }

    const work = await this.worksRepo.findOne({ where: { id: share.workId } });
    if (!work) throw ApiException.notFound('作品不存在');

    const owner = await this.usersRepo.findOne({ where: { id: share.createdBy } });
    const ownerNickname = owner?.nickname || 'MIRA 用户';

    share.viewCount += 1;
    await this.sharesRepo.save(share);

    const preview: WorkPreviewDto = {
      id: work.id,
      title: work.title,
      thumbnailUrl: work.thumbnailUrl,
      canvasJson: work.canvasJson,
      ownerNickname,
    };

    return { work: preview };
  }
}
