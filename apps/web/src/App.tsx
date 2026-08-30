import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { useSubscriptionStore } from './stores/subscriptionStore';
import { ToastHost } from './components/ui/Toast';
import { ConfirmDialog } from './components/ui/Modal';

/**
 * 应用根组件：路由 + 全局浮层（Toast/Confirm）+ 登录态初始化。
 */
export default function App() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const fetchPlans = useSubscriptionStore((s) => s.fetchPlans);
  const fetchSubMe = useSubscriptionStore((s) => s.fetchMe);

  useEffect(() => {
    void init();
    void fetchPlans();
  }, [init, fetchPlans]);

  // 登录后拉取订阅额度状态
  useEffect(() => {
    if (user) {
      void fetchSubMe().catch(() => undefined);
    }
  }, [user, fetchSubMe]);

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
      <ConfirmDialog />
    </>
  );
}
