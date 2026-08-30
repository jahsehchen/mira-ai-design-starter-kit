import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, RefreshResponse } from '@mira/contracts';
import { tokenStore, clearTokenStore } from './tokenStore';

/** API 基础路径（dev 走 Vite proxy；生产由 nginx 反代） */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** 统一业务错误：code 为 envelope 业务码，httpStatus 为 HTTP 状态 */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/* ---------- 请求拦截：注入 Bearer ---------- */
client.interceptors.request.use((config) => {
  const token = tokenStore.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ---------- 401 单飞刷新 ---------- */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refreshToken;
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiResponse<RefreshResponse>>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const body = res.data;
        if (body.code !== 0 || !body.data) return null;
        const { accessToken, refreshToken: newRefresh } = body.data;
        tokenStore.accessToken = accessToken;
        tokenStore.refreshToken = newRefresh;
        localStorage.setItem('mira_access_token', accessToken);
        localStorage.setItem('mira_refresh_token', newRefresh);
        return accessToken;
      })
      .catch(() => {
        clearTokenStore();
        localStorage.removeItem('mira_access_token');
        localStorage.removeItem('mira_refresh_token');
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/* ---------- 响应拦截：envelope 解包 + 401 刷新重放 ---------- */
client.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === 'object' && 'code' in body && 'data' in body && 'message' in body) {
      if (body.code === 0) {
        // 解包：response.data 变为业务数据
        response.data = body.data;
        return response;
      }
      return Promise.reject(new ApiError(body.code, body.message, response.status));
    }
    return response;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
      // 刷新失败：清空登录态并回到登录页
      clearTokenStore();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const code = error.response?.data?.code ?? -1;
    const message = error.response?.data?.message ?? error.message ?? '网络异常，请稍后再试';
    return Promise.reject(new ApiError(code, message, error.response?.status));
  },
);

/* ---------- 类型化请求助手（envelope 已解包，直接返回业务数据） ---------- */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.get<T>(url, config);
  return res.data;
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.post<T>(url, data, config);
  return res.data;
}

export async function apiPatch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.patch<T>(url, data, config);
  return res.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.delete<T>(url, config);
  return res.data;
}

/** 文件下载（返回 Blob） */
export async function apiDownload(url: string): Promise<Blob> {
  const res = await client.get<Blob>(url, { responseType: 'blob' });
  return res.data;
}

export default client;
