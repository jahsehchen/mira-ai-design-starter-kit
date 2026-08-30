import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUiStore } from '../../stores/uiStore';
import { FEATURES } from '../../config';
import { usersApi } from '../../api/endpoints';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { Badge } from '../../components/ui/Badge';
import './app-views.css';

/** ISO → YYYY-MM-DD（本地时区） */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** V7 设置：订阅状态卡（额度 /subscriptions/me）+ 账户信息 + 偏好 + 危险区注销 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const cancel = useSubscriptionStore((s) => s.cancel);
  const showToast = useUiStore((s) => s.showToast);
  const openConfirm = useUiStore((s) => s.openConfirm);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [notify, setNotify] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname ?? '');
  }, [user?.nickname]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateMe({ nickname: nickname.trim() });
      setUser(updated);
      showToast('资料已更新', 'success');
    } catch {
      showToast('保存失败，请稍后再试', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelSubscription = async () => {
    const ok = await openConfirm({
      title: '确定取消续费吗？',
      description: '取消后当前周期仍可继续使用，周期结束后自动回到免费版。',
      confirmText: '取消续费',
    });
    if (!ok) return;
    try {
      await cancel();
      showToast('已取消续费，当前周期结束后自动回到免费版', 'success');
    } catch {
      showToast('操作失败，请稍后再试', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await openConfirm({
      title: '确定要注销账户吗？',
      description: '注销后将删除全部作品与数据，此操作不可恢复。',
      confirmText: '注销账户',
      danger: true,
    });
    if (!ok) return;
    try {
      await usersApi.deleteMe();
      await logout();
      showToast('账号已注销', 'success');
      navigate('/');
    } catch {
      showToast('注销失败，请稍后再试', 'error');
    }
  };

  const planName = user?.plan === 'free' ? '免费版' : user?.plan === 'pro' ? 'Pro' : '团队版';
  const isFree = (user?.plan ?? 'free') === 'free';

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>设置</h1>
          <p>管理你的账户与偏好</p>
        </div>
      </div>

      <div className="settings-wrap">
        {/* 订阅状态卡 */}
        <div className="sub-card">
          <div>
            <h3>{planName}</h3>
            <p>
              {subscription
                ? `本月剩余 ${subscription.remainingGenerations} 次生成 · ${subscription.quotaPerMonth} 次/月`
                : '加载额度中…'}
            </p>
            {subscription && (
              <>
                <p>下次额度重置：{formatDate(subscription.resetAt)}</p>
                {!isFree && <p>计费周期：{subscription.billingCycle === 'yearly' ? '年付' : '月付'}</p>}
              </>
            )}
          </div>
          <div className="sub-status-actions">
            {isFree ? (
              FEATURES.payments ? (
                <Button className="btn-light" onClick={() => navigate('/app/subscribe')}>
                  升级 Pro
                </Button>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>订阅未开放</span>
              )
            ) : (
              <>
                {subscription?.status === 'canceled' ? (
                  <Badge tone="neutral">已取消 · 周期结束自动回免费版</Badge>
                ) : (
                  <Badge tone="success">订阅中</Badge>
                )}
                {FEATURES.payments && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="sub-cancel-btn"
                    onClick={handleCancelSubscription}
                  >
                    取消续费
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 账户信息 */}
        <Card style={{ marginBottom: 16 }}>
          <h3 className="section-title">账户信息</h3>
          <div className="setting-row">
            <div>
              <div className="s-label">邮箱</div>
              <div className="s-desc">{user?.email ?? '—'}</div>
            </div>
            <Badge tone="success">已验证 ✓</Badge>
          </div>
          <div className="setting-row">
            <div>
              <div className="s-label">昵称</div>
              <div className="s-desc">修改后立即生效</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={64}
                style={{ width: 160, minHeight: 40 }}
              />
              <Button variant="secondary" size="sm" onClick={handleSaveProfile} loading={savingProfile}>
                保存
              </Button>
            </div>
          </div>
        </Card>

        {/* 升级方案（FEATURES.payments 关闭时隐藏；额度与订阅卡仍照常展示） */}
        {isFree && FEATURES.payments && (
          <Card style={{ marginBottom: 16 }}>
            <h3 className="section-title">升级方案</h3>
            <p className="s-desc" style={{ marginBottom: 14 }}>
              解锁更多生成次数与高清导出能力，随时升级或取消续费。
            </p>
            <Button onClick={() => navigate('/app/subscribe')}>查看套餐与升级</Button>
          </Card>
        )}

        {/* 偏好 */}
        <Card style={{ marginBottom: 16 }}>
          <h3 className="section-title">偏好</h3>
          <div className="setting-row">
            <div>
              <div className="s-label">自动保存</div>
              <div className="s-desc">每次编辑自动保存草稿</div>
            </div>
            <Switch checked={autoSave} onChange={setAutoSave} label="自动保存" />
          </div>
          <div className="setting-row">
            <div>
              <div className="s-label">生成完成提醒</div>
              <div className="s-desc">生成完成后通知我</div>
            </div>
            <Switch checked={notify} onChange={setNotify} label="生成完成提醒" />
          </div>
          <div className="setting-row">
            <div>
              <div className="s-label">深色模式</div>
              <div className="s-desc">当前为浅色模式</div>
            </div>
            <Switch checked={darkMode} onChange={setDarkMode} label="深色模式" />
          </div>
        </Card>

        {/* 危险区 */}
        <div className="danger-zone">
          <h4>危险操作</h4>
          <p>注销账户将删除你的全部作品与数据，此操作不可恢复。</p>
          <Button variant="danger" onClick={handleDeleteAccount}>
            注销账户
          </Button>
        </div>
      </div>
    </div>
  );
}
