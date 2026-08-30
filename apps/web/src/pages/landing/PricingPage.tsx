import { useEffect, useState } from 'react';
import { LandingHeader } from '../../components/landing/LandingHeader';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { CtaSection } from '../../components/landing/CtaSection';
import { PricingCard } from '../../components/landing/PricingCard';
import { FaqItem } from '../../components/landing/FaqItem';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { Skeleton } from '../../components/ui/Skeleton';
import '../../components/landing/landing.css';
import './landing-pages.css';

const FAQS = [
  { question: '这些价格会产生真实扣款吗？', answer: '不会。开源仓库默认使用 mock 支付，价格与套餐只用于演示产品流程。运营者接入真实支付后应自行公布并维护有效条款。' },
  { question: '生成内容可以商用吗？', answer: '不能一概保证。请根据所选模型、输入素材、输出内容和使用地区，分别核对服务条款、版权、商标、肖像与其他适用规则。' },
  { question: '取消订阅功能是真的吗？', answer: '默认只演示站内订阅状态流转。接入真实支付后，还需要实现并验证提供商侧的续费、取消、退款和通知流程。' },
  { question: '团队功能是否已经完整实现？', answer: '套餐表是界面和数据模型示例，不应当作已验证的商业功能清单。部署者应按实际实现调整名称、额度和权益。' },
  { question: '支持开发票吗？', answer: '当前开源框架只提供 mock 支付演示，不会产生真实交易或发票。接入真实支付前，请按运营主体所在地规则完成商户、税务与开票流程。' },
];

const COMPARE_ROWS: { feature: string; free: string; pro: string; team: string }[] = [
  { feature: '每月 AI 生成次数', free: '10 次', pro: '500 次', team: '2000 次' },
  { feature: '模板库全部模板', free: '部分', pro: '全部', team: '全部' },
  { feature: '高清导出（4K）', free: '—', pro: '支持', team: '支持' },
  { feature: '多尺寸一键导出', free: '—', pro: '支持', team: '支持' },
  { feature: '品牌色板 / 字体预设', free: '—', pro: '支持', team: '支持' },
  { feature: 'AI 抠图 / 一键美化', free: '—', pro: '支持', team: '支持' },
  { feature: '团队协作与共享空间', free: '—', pro: '—', team: '支持' },
  { feature: '管理员后台 / 用量报表', free: '—', pro: '—', team: '支持' },
  { feature: '优先生成通道', free: '—', pro: '支持', team: '支持' },
];

/** 定价页：方案卡（按月/年切换）+ 对比表 + FAQ + 最终 CTA */
export default function PricingPage() {
  const plans = useSubscriptionStore((s) => s.plans);
  const fetchPlans = useSubscriptionStore((s) => s.fetchPlans);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    void fetchPlans().catch(() => undefined);
  }, [fetchPlans]);

  return (
    <div className="landing-page">
      <LandingHeader active="pricing" />

      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">套餐演示</span>
            <h1>体验订阅与额度流程</h1>
            <p>以下套餐和金额仅用于开源框架演示，默认不会产生真实扣款。</p>
            <div className="billing-toggle">
              <span style={{ color: yearly ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}>按月付费</span>
              <button
                type="button"
                className={`toggle${yearly ? ' on' : ''}`}
                aria-label="切换计费周期"
                aria-pressed={yearly}
                onClick={() => setYearly((v) => !v)}
              />
              <span style={{ color: yearly ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>按年付费</span>
              <span className="toggle-note">省 20%</span>
            </div>
          </div>
        </section>

        <section className="container">
          {plans.length === 0 ? (
            <div className="pricing-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={420} radius={12} />
              ))}
            </div>
          ) : (
            <div className="pricing-grid">
              {plans.map((plan) => (
                <PricingCard key={plan.key} plan={plan} yearly={yearly} />
              ))}
            </div>
          )}
        </section>

        {/* 对比表 */}
        <section className="compare-section">
          <div className="container">
            <h2 className="h2-serif" style={{ textAlign: 'center' }}>方案对比</h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: 32 }}>
              这是功能矩阵示例，请按实际实现和运营规则调整。
            </p>
            <div className="compare-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>功能</th>
                    <th>免费版</th>
                    <th className="col-featured">Pro</th>
                    <th>团队版</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td className={row.free === '—' ? 'no' : 'yes'}>{row.free}</td>
                      <td className={`col-featured ${row.pro === '—' ? 'no' : 'yes'}`}>{row.pro}</td>
                      <td className={row.team === '—' ? 'no' : 'yes'}>{row.team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section" id="faq">
          <div className="container">
            <h2 className="h2-serif" style={{ textAlign: 'center' }}>常见问题</h2>
            <div className="faq-list" style={{ marginTop: 32 }}>
              {FAQS.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        <CtaSection
          title="从本地演示开始"
          description="使用 mock 服务体验完整界面，再接入你自己的生产能力。"
          primaryText="开始体验"
          secondaryText="先看看案例"
          secondaryTo="/cases"
          note="默认 mock 支付 · 不产生真实扣款"
        />
      </main>

      <LandingFooter />
    </div>
  );
}
