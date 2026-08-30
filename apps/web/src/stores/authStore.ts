import { create } from 'zustand';
import type { UserPublic } from '@mira/contracts';
import { authApi } from '../api/endpoints';
import { tokenStore, clearTokenStore } from '../api/tokenStore';
import { useSubscriptionStore } from './subscriptionStore';

const ACCESS_KEY = 'mira_access_token';
const REFRESH_KEY = 'mira_refresh_token';

interface AuthState {
  user: UserPublic | null;
  initialized: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserPublic | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  init: () => Promise<void>;
}

function restoreTokens(): void {
  const access = localStorage.getItem(ACCESS_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (access && refresh) {
    tokenStore.accessToken = access;
    tokenStore.refreshToken = refresh;
  } else {
    clearTokenStore();
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,

  setTokens: (accessToken, refreshToken) => {
    tokenStore.accessToken = accessToken;
    tokenStore.refreshToken = refreshToken;
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    get().setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  register: async (email, password, nickname) => {
    const res = await authApi.register({ email, password, nickname });
    get().setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // 忽略登出接口错误（stateless）
    }
    // B2：登出清空订阅状态，避免跨账号额度串数据（收口所有 logout 出口）
    useSubscriptionStore.getState().reset();
    clearTokenStore();
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ user: null });
  },

  fetchMe: async () => {
    const user = await authApi.me();
    set({ user });
  },

  init: async () => {
    restoreTokens();
    if (tokenStore.accessToken && tokenStore.refreshToken) {
      try {
        await get().fetchMe();
      } catch {
        clearTokenStore();
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        set({ user: null });
      }
    }
    set({ initialized: true });
  },
}));
