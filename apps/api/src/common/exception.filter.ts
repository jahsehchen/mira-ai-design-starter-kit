import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ERROR_CODES, type ApiResponse } from '@mira/contracts';

/**
 * 全局异常过滤器：所有异常 → 统一 envelope。
 * - HttpException：若 body 已是 envelope（ApiException）则透传；否则包装。
 * - class-validator 校验错误（BadRequestException，含 message 数组）→ code 10001。
 * - 其余 → 500 + 50000 INTERNAL。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (
        typeof body === 'object' &&
        body !== null &&
        'code' in body &&
        'data' in body &&
        'message' in body
      ) {
        // ApiException 已构造为 envelope
        response.status(status).json(body);
        return;
      }

      // 校验错误（class-validator）：message 为字符串数组
      let message = exception.message;
      if (typeof body === 'object' && body !== null && Array.isArray((body as { message?: unknown }).message)) {
        const arr = (body as { message: string[] }).message;
        message = arr.length > 0 ? arr[0] : '参数校验失败';
      } else if (typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string') {
        message = (body as { message: string }).message as string;
      }

      response.status(status).json({
        code: status === HttpStatus.BAD_REQUEST ? ERROR_CODES.VALIDATION : ERROR_CODES.UNAUTHORIZED,
        data: null,
        message,
      } satisfies ApiResponse<null>);
      return;
    }

    // 未知异常
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`未捕获异常: ${err.message}`, err.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODES.INTERNAL,
      data: null,
      message: '服务开小差了，请稍后再试',
    } satisfies ApiResponse<null>);
  }
}
