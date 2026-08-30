import type { ApiResponse } from '@mira/contracts';

/**
 * 统一响应 envelope 构造器（成功）
 * 成功：{ code: 0, data: <T>, message: 'ok' }
 */
export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, data, message };
}

/** 分页响应便捷构造 */
export function okPage<T>(items: T[], total: number, page: number, pageSize: number): ApiResponse<{ items: T[]; total: number; page: number; pageSize: number }> {
  return ok({ items, total, page, pageSize });
}
