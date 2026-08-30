import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** 请求用户（JwtAuthGuard 校验后注入） */
export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  plan: string;
}

/**
 * @CurrentUser() 装饰器：从 request.user 读取当前登录用户。
 * 用法：@CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
