import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useWorksStore } from '../stores/worksStore';
import { SITE, FEATURES } from '../config';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import './app-layout.css';

interface NavItemDef {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const SIDEBAR_NAV: NavItemDef[] = [
  { to: '/app/dashboard', label: '工作台', icon: <IconDashboard /> },
  { to: '/app/templates', label: '模板库', icon: <IconTemplates /> },
  { to: '/app/generator', label: 'AI 生成', icon: <IconGenerator /> },
  { to: '/app/editor', label: '编辑器', icon: <IconEditor /> },
  { to: '/app/gallery', label: '我的作品', icon: <IconGallery /> },
  { to: '/app/export', label: '导出', icon: <IconExport /> },
  { to: '/app/settings', label: '设置', icon: <IconSettings /> },
];

const MOBILE_TABS: NavItemDef[] = [
  { to: '/app/dashboard', label: '工作台', icon: <IconDashboard /> },
  { to: '/app/templates', label: '模板', icon: <IconTemplates /> },
  { to: '/app/generator', label: '生成', icon: <IconGenerator /> },
  { to: '/app/gallery', label: '作品', icon: <IconGallery /> },
  { to: '/app/settings', label: '我的', icon: <IconSettings /> },
];

const TITLES: Record<string, string> = {
  '/app/dashboard': '工作台',
  '/app/templates': '模板库',
  '/app/generator': 'AI 生成',
  '/app/editor': '编辑器',
  '/app/gallery': '我的作品',
  '/app/export': '导出',
  '/app/settings': '设置',
};

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/app/editor')) return '编辑器';
  if (pathname.startsWith('/app/export')) return '导出';
  return TITLES[pathname] ?? SITE.name;
}

/**
 * 应用壳：桌面侧栏（240/64 收起）+ Topbar + 移动底部 Tab + Outlet。
 * 4 断点：<640 / 640-1023 / 1024-1439 / ≥1440（侧栏 240px 常驻）。
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const total = useWorksStore((s) => s.total);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  const paymentsOn = FEATURES.payments;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 路由变化时关闭移动抽屉
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleToggle = () => {
    if (isMobile) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  /** 导航额度入口：payments 开启时可点击直达订阅页；关闭时仅展示 */
  const goSubscribe = () => {
    if (paymentsOn) navigate('/app/subscribe');
  };

  return (
    <div className="app-shell">
      <div
        className={`sidebar-mask${mobileOpen ? ' show' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* 侧栏 */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/" className="logo" aria-label={`${SITE.name} 首页`}>
            <span className="logo-mark">{SITE.logoMark}</span>
            <span className="brand-text">{SITE.name}</span>
          </NavLink>
        </div>

        <nav className="side-nav" aria-label="应用导航">
          {SIDEBAR_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
              {item.to === '/app/gallery' && total > 0 && <span className="nav-count">{total}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="side-foot">
          <div
            className={`side-user${paymentsOn && subscription ? ' clickable' : ''}`}
            onClick={goSubscribe}
          >
            <Avatar name={user?.nickname ?? '?'} src={user?.avatarUrl} />
            <span className="side-foot-text">
              <span className="name">{user?.nickname ?? '新朋友'}</span>
              <span className="plan">
                {user?.plan === 'free' ? '免费版' : user?.plan === 'pro' ? 'Pro' : '团队版'} · 设置
              </span>
              {subscription && (
                <span className="quota-line">
                  剩余 {subscription.remainingGenerations}/{subscription.quotaPerMonth} 次/月
                </span>
              )}
            </span>
            <button
              className="side-logout"
              onClick={(e) => {
                e.stopPropagation();
                void handleLogout();
              }}
              title="退出登录"
              aria-label="退出登录"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2.5h5.5v11H6M2.5 8h7M7.5 5.5L10 8l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className={`main${collapsed ? ' collapsed' : ''}`}>
        <header className="topbar">
          <button className="icon-btn" onClick={handleToggle} aria-label={isMobile ? '打开菜单' : '收起菜单'}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 4v12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <div className="topbar-title">{pageTitle(location.pathname)}</div>
          <div className="topbar-right">
            {subscription && (
              <span
                className={`quota-chip${paymentsOn ? ' clickable' : ''}`}
                onClick={goSubscribe}
                title="查看订阅额度"
              >
                {subscription.remainingGenerations}/{subscription.quotaPerMonth} 次/月
              </span>
            )}
            <Button size="sm" onClick={() => navigate('/app/generator')} style={{ minHeight: 40, padding: '0 16px' }}>
              ＋ 新建
            </Button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* 移动底部 Tab */}
      <nav className="mobile-tabbar" aria-label="移动端导航">
        {MOBILE_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ---------- 图标 ---------- */
function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTemplates() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconGenerator() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5v15M2.5 10h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconEditor() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 3.5l4 4L7 17H3v-4L12.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconGallery() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 13.5l4-4 3 3 2.5-2.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 13V3M6.5 6.5L10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13.5v2A1.5 1.5 0 004.5 17h11a1.5 1.5 0 001.5-1.5v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1L4.7 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
