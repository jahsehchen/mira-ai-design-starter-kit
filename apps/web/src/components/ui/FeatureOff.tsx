import { SITE } from '../../config';

interface FeatureOffProps {
  /** 占位标题，如「注册已关闭」「分享已关闭」「案例库已关闭」 */
  title: string;
  /** 补充说明（可省略） */
  description?: string;
  /** 是否展示「联系管理员」入口（引用 SITE.supportEmail） */
  showContact?: boolean;
}

/**
 * 功能关闭占位组件（Starter Kit）
 *
 * 路由不删除、不 404：功能开关关闭时，页面组件内部渲染本占位。
 * 复用现有 empty-state 卡片样式，保证与深空科幻风一致。
 */
export function FeatureOff({ title, description, showContact = false }: FeatureOffProps) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-page)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div className="empty-state">
        <div
          className="empty-icon"
          style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="6" width="20" height="20" rx="4" stroke="var(--color-text-tertiary)" strokeWidth="1.8" />
            <path d="M10 14h12M10 19h8" stroke="var(--color-text-tertiary)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-display)' }}>{title}</h3>
        {description && (
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>{description}</p>
        )}
        {showContact && (
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 16 }}>
            如需开通，请联系 <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
          </p>
        )}
      </div>
    </div>
  );
}
