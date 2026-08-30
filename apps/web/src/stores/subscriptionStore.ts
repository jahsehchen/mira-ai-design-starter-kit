import { create } from 'zustand';
import type {
  BillingCycle,
  MockPayResponse,
  PlanDto,
  PlanKey,
  SubscriptionDto,
  UpgradeResponse,
} from '@mira/contracts';
import { paymentsApi, subscriptionsApi } from '../api/endpoints';
import { useAuthStore } from './authStore';

interface SubscriptionState {
  plans: PlanDto[];
  subscription: SubscriptionDto | null;
  loading: boolean;
  fetchPlans: () => Promise<void>;
  fetchMe: () => Promise<void>;
  /** 创建支付订单（Q8：不再直接生效套餐，支付完成后套餐才生效） */
  upgrade: (planKey: 'pro' | 'team', billingCycle: BillingCycle) => Promise<UpgradeResponse>;
  /** 模拟支付：确认支付 → 套餐生效 → 刷新订阅额度 */
  payMock: (orderId: string) => Promise<MockPayResponse>;
  /** 取消续费（T05）：幂等置 canceled，不立即降级 plan */
  cancel: () => Promise<void>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  plans: [],
  subscription: null,
  loading: false,

  fetchPlans: async () => {
    const plans = await subscriptionsApi.plans();
    set({ plans });
  },

  fetchMe: async () => {
    const subscription = await subscriptionsApi.me();
    set({ subscription });
  },

  upgrade: async (planKey, billingCycle) => {
    return subscriptionsApi.upgrade({ planKey, billingCycle });
  },

  payMock: async (orderId) => {
    const res = await paymentsApi.mockPay({ orderId });
    // 支付成功，刷新订阅状态（额度提升）
    await get().fetchMe();
    // B1：同步刷新 authStore.user.plan（侧栏/设置页 plan 文本立即生效）
    await useAuthStore.getState().fetchMe();
    return res;
  },

  cancel: async () => {
    await subscriptionsApi.cancel();
    await get().fetchMe();
  },

  reset: () => set({ plans: [], subscription: null }),
}));

export type { PlanKey };
