/**
 * 内存令牌镜像：client 与 authStore 共同读写，避免循环依赖。
 * 持久化由 authStore 负责（localStorage）。
 */
export const tokenStore: {
  accessToken: string | null;
  refreshToken: string | null;
} = {
  accessToken: null,
  refreshToken: null,
};

export function clearTokenStore(): void {
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
}
