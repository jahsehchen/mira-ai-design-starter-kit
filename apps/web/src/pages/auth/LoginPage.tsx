import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { SITE, FEATURES } from '../../config';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import './auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const showToast = useUiStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      showToast('欢迎回来！', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo" aria-label={`${SITE.name} 首页`}>
          <span className="logo-mark">{SITE.logoMark}</span>
          <span>{SITE.name}</span>
        </Link>
        <h1 className="auth-title">登录</h1>
        <p className="auth-sub">{SITE.tagline}</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="邮箱"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="密码"
            type="password"
            placeholder="至少 8 位"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" block loading={loading} style={{ marginTop: 8 }}>
            登录
          </Button>
        </form>

        <p className="auth-switch">
          {FEATURES.registration ? (
            <>
              还没有账号？<Link to="/register">免费注册</Link>
            </>
          ) : (
            <>还没有账号？请联系 {SITE.supportEmail}</>
          )}
        </p>
      </div>
    </div>
  );
}
