import { Suspense, lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { RequireAuth } from './components/auth/RequireAuth';
import { PublicOnly } from './components/auth/PublicOnly';
import { Spinner } from './components/ui/Spinner';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

function PageLoader() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-page)',
      }}
    >
      <Spinner size={28} />
    </div>
  );
}

function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(loader);
  return (
    <Suspense fallback={<PageLoader />}>
      <Comp />
    </Suspense>
  );
}

/* ---------- 路由表 ---------- */
export const router = createBrowserRouter([
  { path: '/', element: lazyPage(() => import('./pages/landing/HomePage')) },
  { path: '/features', element: lazyPage(() => import('./pages/landing/FeaturesPage')) },
  { path: '/cases', element: lazyPage(() => import('./pages/landing/CasesPage')) },
  { path: '/pricing', element: lazyPage(() => import('./pages/landing/PricingPage')) },
  {
    path: '/login',
    element: (
      <PublicOnly>
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <Suspense fallback={<PageLoader />}>
          <RegisterPage />
        </Suspense>
      </PublicOnly>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: lazyPage(() => import('./pages/app/DashboardPage')) },
      { path: 'templates', element: lazyPage(() => import('./pages/app/TemplatesPage')) },
      { path: 'generator', element: lazyPage(() => import('./pages/app/GeneratorPage')) },
      { path: 'editor', element: lazyPage(() => import('./pages/app/EditorPage')) },
      { path: 'editor/:workId', element: lazyPage(() => import('./pages/app/EditorPage')) },
      { path: 'gallery', element: lazyPage(() => import('./pages/app/GalleryPage')) },
      { path: 'export', element: lazyPage(() => import('./pages/app/ExportPage')) },
      { path: 'export/:workId', element: lazyPage(() => import('./pages/app/ExportPage')) },
      { path: 'settings', element: lazyPage(() => import('./pages/app/SettingsPage')) },
      { path: 'subscribe', element: lazyPage(() => import('./pages/app/SubscribePage')) },
    ],
  },
  { path: '/share/:token', element: lazyPage(() => import('./pages/SharePreviewPage')) },
  { path: '*', element: lazyPage(() => import('./pages/NotFoundPage')) },
]);

// 供非 React 上下文（如 client 刷新后跳转）使用
export const LOGIN_PATH = '/login';
export const DASHBOARD_PATH = '/app/dashboard';
