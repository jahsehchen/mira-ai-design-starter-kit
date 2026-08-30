import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Spinner } from '../ui/Spinner';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * 应用区守卫：未登录 → 重定向 /login（A2 前端侧）。
 * 初始化期间显示全屏加载（恢复登录态）。
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowLoader(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!initialized || showLoader) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-page)',
        }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) {
    // 保留 query（如 /app/generator?prompt=xxx），登录回跳后参数不丢失
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}
