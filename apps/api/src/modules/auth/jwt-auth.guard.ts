import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { ApiException } from '../../common/api-exception';
import { UserEntity } from '../../database/entities/user.entity';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * 自定义 JWT 守卫（无 passport）：
 * 1. 解析 Authorization: Bearer <accessToken>
 * 2. 校验 access 令牌（type=access）
 * 3. 加载用户（保证删除/禁用即时生效）
 * 4. 注入 request.user
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiException.unauthorized('请先登录');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let payload: { sub: string; type?: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw ApiException.unauthorized('登录已过期，请重新登录');
    }

    if (!payload.sub || payload.type !== 'access') {
      throw ApiException.unauthorized('登录状态无效');
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw ApiException.unauthorized('账号不存在或已注销');
    }

    request.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      plan: user.plan,
    };
    return true;
  }
}
