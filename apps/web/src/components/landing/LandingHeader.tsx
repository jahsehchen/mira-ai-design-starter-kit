import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { SITE } from '../../config';
import './landing.css';

interface LandingHeaderProps {
  /** 当前页 key，用于高亮（home/features/cases/pricing） */
  active?: 'home' | 'features' | 'cases' | 'pricing';
}

/** 落地页顶栏：Logo + 导航 + 免费开始 CTA + 移动端汉堡 */
export function LandingHeader({ active }: LandingHeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goStart = () => {
    navigate(user ? '/app/dashboard' : '/login');
  };

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="logo" aria-label={`${SITE.name} 首页`}>
          <span className="logo-mark">{SITE.logoMark}</span>
          <span>{SITE.name}</span>
        </Link>

        <nav className={`nav-links${open ? ' open' : ''}`} aria-label="主导航">
          <NavLink to="/" className={active === 'home' ? 'active' : ''} onClick={() => setOpen(false)}>
            首页
          </NavLink>
          <NavLink to="/features" className={active === 'features' ? 'active' : ''} onClick={() => setOpen(false)}>
            功能
          </NavLink>
          <NavLink to="/cases" className={active === 'cases' ? 'active' : ''} onClick={() => setOpen(false)}>
            案例
          </NavLink>
          <NavLink to="/pricing" className={active === 'pricing' ? 'active' : ''} onClick={() => setOpen(false)}>
            定价
          </NavLink>
        </nav>

        <div className="nav-right">
          <button className="btn btn-primary" onClick={goStart} style={{ minHeight: 40 }}>
            {user ? '进入应用' : '免费开始'}
          </button>
          <button
            className="nav-burger"
            aria-label="打开菜单"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
