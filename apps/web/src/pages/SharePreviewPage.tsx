import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SharePreviewResponse } from '@mira/contracts';
import { sharesApi } from '../api/endpoints';
import { SITE, FEATURES } from '../config';
import { FeatureOff } from '../components/ui/FeatureOff';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

/** 分享只读预览页（P1-04）：/share/:token，移动适配 */
export default function SharePreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharePreviewResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('分享链接无效');
      setLoading(false);
      return;
    }
    sharesApi
      .get(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '分享链接不存在或已失效'))
      .finally(() => setLoading(false));
  }, [token]);

  // FEATURES.sharing 关闭：路由直达显示占位（不 404 不报错），不发起接口请求
  if (!FEATURES.sharing) {
    return (
      <FeatureOff
        title="分享已关闭"
        description="当前站点未开放分享功能。"
      />
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-page)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-page)', padding: 24, textAlign: 'center' }}>
        <div className="empty-icon" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 3l1.9 5.1L23 10l-5.1 1.9L16 17l-1.9-5.1L9 10l5.1-1.9L16 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-display)' }}>链接打不开</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 24px' }}>{error}</p>
        <Link to="/">
          <Button>回到 {SITE.name}</Button>
        </Link>
      </div>
    );
  }

  const work = data.work;
  const canvas = (work.canvasJson ?? {}) as {
    background?: { from?: string; to?: string };
  };
  const background =
    canvas.background?.from && canvas.background?.to
      ? `linear-gradient(160deg, ${canvas.background.from}, ${canvas.background.to})`
      : undefined;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px calc(24px + env(safe-area-inset-bottom))' }}>
      <Link to="/" className="logo" style={{ marginBottom: 32 }} aria-label={`${SITE.name} 首页`}>
        <span className="logo-mark">{SITE.logoMark}</span>
        <span>{SITE.name}</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 480 }}>
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div
            style={{
              aspectRatio: '4/3',
              background: background ?? 'var(--color-bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              color: '#fff',
              textAlign: 'center',
              padding: 16,
            }}
          >
            {work.thumbnailUrl ? (
              <img src={work.thumbnailUrl} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              work.title
            )}
          </div>
          <div style={{ padding: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-display)' }}>{work.title}</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
              创作者：{work.ownerNickname}
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 24 }}>
          用{SITE.tagline} —— {SITE.name}
        </p>
      </div>
    </div>
  );
}
