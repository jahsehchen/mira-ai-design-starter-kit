import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import type {
  AuthResponse,
  RefreshResponse,
  UserPublic,
} from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { UserEntity } from '../../database/entities/user.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(UserSubscriptionEntity)
    private readonly subsRepo: Repository<UserSubscriptionEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    nickname?: string;
  }): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.usersRepo.findOne({
      where: { email },
      withDeleted: true,
    });
    if (existing) {
      throw ApiException.conflict('该邮箱已注册，请直接登录');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const nickname = input.nickname?.trim() || email.split('@')[0] || '新朋友';

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email,
        passwordHash,
        nickname,
        plan: 'free',
      }),
    );

    // 默认免费订阅记录（额度控制数据源）
    await this.subsRepo.save(
      this.subsRepo.create({
        userId: user.id,
        planKey: 'free',
        status: 'active',
        billingCycle: 'monthly',
        startedAt: new Date(),
        expiresAt: null,
      }),
    );

    return this.issueTokens(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      throw ApiException.unauthorized('邮箱或密码不正确');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw ApiException.unauthorized('邮箱或密码不正确');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(
        refreshToken,
        { secret: this.config.get<string>('jwt.refreshSecret') },
      );
    } catch {
      throw ApiException.unauthorized('刷新令牌无效或已过期，请重新登录');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw ApiException.unauthorized('刷新令牌类型无效');
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw ApiException.unauthorized('账号不存在或已注销');
    }

    return this.issueTokens(user);
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw ApiException.notFound('用户不存在');
    }
    return this.toUserPublic(user);
  }

  /** 签发 access(15m) + refresh(7d) 双令牌 */
  private async issueTokens(user: UserEntity): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'access' },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn') || '15m',
      } as JwtSignOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn') || '7d',
      } as JwtSignOptions,
    );

    return {
      user: this.toUserPublic(user),
      accessToken,
      refreshToken,
    };
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
