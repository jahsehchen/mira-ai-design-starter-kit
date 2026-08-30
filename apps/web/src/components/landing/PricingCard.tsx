import { useNavigate } from 'react-router-dom';
import type { PlanDto } from '@mira/contracts';
import { SITE, FEATURES } from '../../config';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import './landing.css';

const PLAN_LABELS: Record<string, { name: string; badge: string | null }> = {
  free: { name: '免费版', badge: null },
  pro: { name: 'Pro', badge: '最受欢迎' },
  team: { name: '团队版', badge: '适合团队' },
};

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-success-bg)" />
      <path d="M4.8 8.2l2.2 2.2 4.2-4.8" stroke="var(--color-success-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-bg-surface)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface PricingCardProps {
  plan: PlanDto;
  yearly?: boolean;
  ctaText?: string;
}

/** 定价方案卡（免费/Pro/团队版；Pro featured；按月/按年切换） */
export function PricingCard({ plan, yearly = false, ctaText }: PricingCardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const meta = PLAN_LABELS[plan.key] ?? { name: plan.name, badge: null };
  const featured = plan.key === 'pro';
  const price = yearly ? plan.priceYearlyCents : plan.priceMonthlyCents;
  const priceYuan = (price / 100).toFixed(0);
  const unit = price === 0 ? '免费' : `元 / 月${yearly ? '（年付）' : ''}`;

  // T04：已登录 → 应用内订阅页；未登录 → 登录页（带 from 回跳订阅页）
  const goAction = () => {
    if (user) {
      navigate('/app/subscribe');
    } else {
      navigate('/login', { state: { from: '/app/subscribe' } });
    }
  };

  return (
    <div className={`price-card${featured ? ' featured' : ''}`}>
      {meta.badge && <span className="price-badge">{meta.badge}</span>}
      <div className="price-name">{meta.name}</div>
      <div className="price-desc">
        {plan.key === 'free' && `体验 ${SITE.name} 的基础流程`}
        {plan.key === 'pro' && '个人方案演示，权益以实际实现为准'}
        {plan.key === 'team' && '团队方案演示，不代表功能已完整上线'}
      </div>
      <div className="price-amount">
        <span className="num">{priceYuan}</span>
        <span className="unit">{unit}</span>
      </div>
      <ul className="price-features">
        {plan.features.map((feature, index) => {
          const enabled = index < 4 || plan.key !== 'free';
          return (
            <li key={feature} className={enabled ? '' : 'muted'}>
              {enabled ? <CheckIcon /> : <CrossIcon />}
              <span>{feature}</span>
            </li>
          );
        })}
      </ul>
      {/* FEATURES.payments 关闭时隐藏订阅 CTA（方案信息照常展示，不报错） */}
      {FEATURES.payments ? (
        <Button variant={featured ? 'primary' : 'secondary'} block onClick={goAction}>
          {ctaText ?? (plan.key === 'free' ? '免费开始' : '立即升级')}
        </Button>
      ) : null}
    </div>
  );
}
