import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@mira/contracts';

/**
 * 业务异常：携带业务码 + 用户可读中文消息 + HTTP 状态。
 * 全局异常过滤器会将其转换为统一 envelope 响应。
 */
export class ApiException extends HttpException {
  constructor(
    public readonly bizCode: number,
    message: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code: bizCode, data: null, message }, httpStatus);
  }

  static validation(message: string): ApiException {
    return new ApiException(ERROR_CODES.VALIDATION, message, HttpStatus.BAD_REQUEST);
  }

  static unauthorized(message = '请先登录'): ApiException {
    return new ApiException(ERROR_CODES.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = '无权访问该资源'): ApiException {
    return new ApiException(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = '资源不存在'): ApiException {
    return new ApiException(ERROR_CODES.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static conflict(message = '资源冲突'): ApiException {
    return new ApiException(ERROR_CODES.CONFLICT, message, HttpStatus.CONFLICT);
  }
}
