import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { SITE, FEATURES } from '../../config';
import { FeatureOff } from '../../components/ui/FeatureOff';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import './auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const showToast = useUiStore((s) => s.showToast);

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    if (password.length < 8) {
      setError('密码至少需要 8 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(email.trim(), password, nickname.trim() || undefined);
      showToast('注册成功，开始创作吧！', 'success');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // FEATURES.registration 关闭：路由直达显示占位（不 404），保留演示账号说明
  if (!FEATURES.registration) {
    return (
      <FeatureOff
        title="注册已关闭"
        description="当前站点未开放注册。演示账号：demo@mira.app / Passw0rd!"
        showContact
      />
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo" aria-label={`${SITE.name} 首页`}>
          <span className="logo-mark">{SITE.logoMark}</span>
          <span>{SITE.name}</span>
        </Link>
        <h1 className="auth-title">免费注册</h1>
        <p className="auth-sub">无需信用卡，注册即可开始创作</p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="昵称（选填）"
            placeholder="怎么称呼你？"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={64}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            hint="8-64 位，不能包含空格"
          />
          <Input
            label="确认密码"
            type="password"
            placeholder="再输一次"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" block loading={loading} style={{ marginTop: 8 }}>
            创建账号
          </Button>
        </form>

        <p className="auth-switch">
          已有账号？<Link to="/login">直接登录</Link>
        </p>
      </div>
    </div>
  );
}
