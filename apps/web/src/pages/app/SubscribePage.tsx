import { useEffect, useState } from 'react';
import { ERROR_CODES, type BillingCycle, type PlanDto, type PlanKey, type UpgradeResponse } from '@mira/contracts';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useUiStore } from '../../stores/uiStore';
import { FEATURES } from '../../config';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import './app-views.css';

/* ---------- 展示工具 ---------- */

const PLAN_RANK: Record<PlanKey, number> = { free: 0, pro: 1, team: 2 };

/** 分 → 元展示（整数去小数：3900→"39"；3120→"31.2"） */
function fmtYuan(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(1);
}

/** ISO → YYYY-MM-DD（本地时区） */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function cycleText(c: BillingCycle): string {
  return c === 'yearly' ? '年付' : '月付';
}

function planLabel(key: PlanKey): string {
  if (key === 'free') return '免费版';
  if (key === 'pro') return 'Pro';
  return '团队版';
}

/* ---------- 购买流程状态机（页面局部 state，不进 store） ---------- */

type BuyStep = 'idle' | 'upgrading' | 'confirm' | 'paying';

interface BuyFlow {
  step: BuyStep;
  order: UpgradeResponse | null;
}

interface PlanCta {
  label: string;
  disabled: boolean;
  kind: 'buy' | 'renew' | 'current' | 'disabled' | 'downgrade';
}

/**
 * 订阅页 /app/subscribe
 * 当前订阅状态卡 + 月付/年付切换 + 三套餐卡（Free/Pro/团队版）+ mock 订单确认闭环。
 * 视觉：星际太空风（tokens），金色 CTA；新类统一 sub- 前缀（e2e selector 隔离）。
 */
export default function SubscribePage() {
  const user = useAuthStore((s) => s.user);
  const plans = useSubscriptionStore((s) => s.plans);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const fetchPlans = useSubscriptionStore((s) => s.fetchPlans);
  const fetchMe = useSubscriptionStore((s) => s.fetchMe);
  const upgrade = useSubscriptionStore((s) => s.upgrade);
  const payMock = useSubscriptionStore((s) => s.payMock);
  const showToast = useUiStore((s) => s.showToast);
  const openConfirm = useUiStore((s) => s.openConfirm);

  const [yearly, setYearly] = useState(false);
  const [flow, setFlow] = useState<BuyFlow>({ step: 'idle', order: null });
  const [buyingKey, setBuyingKey] = useState<PlanKey | null>(null);

  // 挂载时并发拉取套餐列表与当前订阅（App 登录后已拉过，这里保证最新）
  useEffect(() => {
    void fetchPlans();
    void fetchMe().catch(() => undefined);
  }, [fetchPlans, fetchMe]);

  const paymentsOn = FEATURES.payments;
  const currentPlan: PlanKey = subscription?.plan ?? user?.plan ?? 'free';
  const isPaid = currentPlan !== 'free';
  const loading = plans.length === 0 && !subscription;

  const planName = subscription?.name ?? planLabel(currentPlan);
  const quotaText = subscription
    ? `本月剩余 ${subscription.remainingGenerations} 次生成 · ${subscription.quotaPerMonth} 次/月`
    : '加载额度中…';

  /** 套餐卡 CTA 分支（按当前方案与目标方案层级） */
  const planCta = (plan: PlanDto): PlanCta => {
    if (plan.key === currentPlan) {
      return plan.key === 'free'
        ? { label: '当前方案', disabled: true, kind: 'current' }
        : { label: '续费', disabled: false, kind: 'renew' };
    }
    if (PLAN_RANK[plan.key] > PLAN_RANK[currentPlan]) {
      return { label: plan.key === 'team' ? '升级团队版' : '立即升级', disabled: false, kind: 'buy' };
    }
    return plan.key === 'free'
      ? { label: '降级提示', disabled: false, kind: 'downgrade' }
      : { label: '已是更高方案', disabled: true, kind: 'disabled' };
  };

  /** 发起购买：upgrade → 建订单 → mock 走确认浮层 */
  const startBuy = async (plan: PlanDto) => {
    const cycle: BillingCycle = yearly ? 'yearly' : 'monthly';
    setBuyingKey(plan.key);
    setFlow({ step: 'upgrading', order: null });
    try {
      const order = await upgrade(plan.key as 'pro' | 'team', cycle);
      if (order.provider === 'mock') {
        setFlow({ step: 'confirm', order });
      } else {
        // 防御分支：真实渠道未配置
        showToast('暂未配置真实支付渠道，当前为模拟支付环境', 'info');
        setFlow({ step: 'idle', order: null });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.CONFLICT) {
        showToast('支付订单已过期，请重新下单', 'warning');
      } else {
        showToast(err instanceof Error ? err.message : '下单失败，请稍后再试', 'error');
      }
      setFlow({ step: 'idle', order: null });
    } finally {
      setBuyingKey(null);
    }
  };

  /** 卡片点击统一入口（current/disabled 无操作；downgrade 仅提示；其余发起购买） */
  const handleCardAction = async (plan: PlanDto) => {
    const cta = planCta(plan);
    if (cta.kind === 'current' || cta.kind === 'disabled') return;
    if (cta.kind === 'downgrade') {
      await openConfirm({
        title: '降级提示',
        description: '降级请先在设置页取消续费，当前周期结束后自动回到免费版。',
        confirmText: '知道了',
      });
      return;
    }
    await startBuy(plan);
  };

  /** 确认支付：mock-pay → 套餐生效 → 数据一致性由 store 内部刷新（B1） */
  const confirmPay = async () => {
    if (!flow.order) return;
    setFlow({ step: 'paying', order: flow.order });
    try {
      await payMock(flow.order.orderId);
      showToast('模拟支付成功，套餐已生效', 'success');
      setFlow({ step: 'idle', order: null });
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.CONFLICT) {
        showToast('支付订单已过期，请重新下单', 'warning');
      } else {
        showToast(err instanceof Error ? err.message : '支付失败，请稍后再试', 'error');
      }
      setFlow({ step: 'idle', order: null });
    }
  };

  const cancelBuy = () => setFlow({ step: 'idle', order: null });

  const orderPlanName = flow.order ? planLabel(flow.order.planKey) : '';

  return (
    <div className="subscribe-page fade-in">
      {/* 顶部：当前订阅状态卡（复用金色渐变 sub-card） */}
      <div className="sub-card">
        <div>
          <h3 className="sub-status-plan">{planName}</h3>
          <p className="sub-quota-line">{quotaText}</p>
          {subscription && (
            <>
              <p>下次额度重置：{fmtDate(subscription.resetAt)}</p>
              {isPaid && <p>计费周期：{cycleText(subscription.billingCycle)}</p>}
            </>
          )}
        </div>
        <div className="sub-status-right">
          {isPaid ? (
            subscription?.status === 'canceled' ? (
              <Badge tone="neutral">已取消 · 周期结束自动回免费版</Badge>
            ) : (
              <Badge tone="success">订阅中</Badge>
            )
          ) : (
            <Badge tone="info">免费版</Badge>
          )}
          {!paymentsOn && <p className="sub-payments-off">订阅未开放</p>}
        </div>
      </div>

      {/* 周期切换（payments 关闭时隐藏购买相关交互） */}
      {paymentsOn && (
        <div className="sub-billing-toggle">
          <span className={`sub-toggle-label${yearly ? ' off' : ' on'}`}>按月付费</span>
          <button
            type="button"
            className={`sub-toggle${yearly ? ' on' : ''}`}
            role="switch"
            aria-checked={yearly}
            aria-label="切换按年付费"
            onClick={() => setYearly((v) => !v)}
          />
          <span className={`sub-toggle-label${yearly ? ' on' : ' off'}`}>按年付费</span>
          <span className="sub-toggle-note">省 20%</span>
        </div>
      )}

      {/* 套餐卡区 */}
      {loading ? (
        <div className="sub-price-grid">
          <Skeleton height={330} />
          <Skeleton height={330} />
          <Skeleton height={330} />
        </div>
      ) : (
        <div className="sub-price-grid">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const featured = plan.key === 'pro';
            const cta = planCta(plan);
            const price = yearly ? plan.priceYearlyCents : plan.priceMonthlyCents;
            const priceNote = yearly && price > 0 ? `按年 ¥${fmtYuan(plan.priceYearlyCents * 12)}/年 · 省 20%` : '';
            return (
              <div
                key={plan.key}
                className={`sub-price-card${featured ? ' featured' : ''}${isCurrent ? ' current' : ''}`}
              >
                {featured && <span className="sub-price-badge">最受欢迎</span>}
                {isCurrent && <span className="sub-current-badge">当前方案</span>}
                <div className="sub-price-name">{plan.name}</div>
                <div className="sub-price-amount">
                  <span className="num">{price === 0 ? '0' : `¥${fmtYuan(price)}`}</span>
                  <span className="unit">{price === 0 ? '免费' : ` / 月${yearly ? '（年付）' : ''}`}</span>
                </div>
                {priceNote && <div className="sub-price-note">{priceNote}</div>}
                <div className="sub-quota">{plan.quotaPerMonth} 次/月</div>
                <ul className="sub-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="sub-feature-dot" />
                      {f}
                    </li>
                  ))}
                </ul>
                {paymentsOn ? (
                  <Button
                    variant={featured ? 'primary' : 'secondary'}
                    block
                    disabled={cta.disabled || flow.step !== 'idle'}
                    loading={flow.step === 'upgrading' && buyingKey === plan.key}
                    onClick={() => void handleCardAction(plan)}
                  >
                    {cta.label}
                  </Button>
                ) : (
                  <div className="sub-cta-readonly">订阅未开放</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 订单确认浮层（页内 mock 支付确认：套餐/周期/金额/订单号） */}
      {flow.order && (flow.step === 'confirm' || flow.step === 'paying') && (
        <div className="sub-order-mask">
          <div className="sub-order-confirm" role="dialog" aria-label="订单确认">
            <h3>确认支付</h3>
            <div className="sub-order-row">
              <span>套餐</span>
              <strong>{orderPlanName}</strong>
            </div>
            <div className="sub-order-row">
              <span>计费周期</span>
              <strong>{cycleText(flow.order.billingCycle)}</strong>
            </div>
            <div className="sub-order-row">
              <span>金额</span>
              <strong>¥{fmtYuan(flow.order.amountCents)}</strong>
            </div>
            <div className="sub-order-row">
              <span>订单号</span>
              <strong className="sub-order-no">{flow.order.orderNo}</strong>
            </div>
            <p className="sub-order-tip">模拟支付环境，确认后套餐立即生效。</p>
            <div className="sub-order-actions">
              <Button variant="ghost" onClick={cancelBuy} disabled={flow.step === 'paying'}>
                取消
              </Button>
              <Button variant="primary" className="sub-order-pay" onClick={() => void confirmPay()} loading={flow.step === 'paying'}>
                确认支付
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ / 说明 + 安全承诺 */}
      <div className="sub-faq">
        <h3>常见问题</h3>
        <div className="sub-faq-item">
          <div className="sub-faq-q">升级后额度什么时候生效？</div>
          <div className="sub-faq-a">模拟支付确认后立即生效，剩余额度变为所选套餐的每月配额。</div>
        </div>
        <div className="sub-faq-item">
          <div className="sub-faq-q">如何取消订阅？</div>
          <div className="sub-faq-a">在「设置 → 订阅状态」点击取消续费，当前周期结束后自动回到免费版。</div>
        </div>
        <div className="sub-faq-item">
          <div className="sub-faq-q">降级到免费版会丢失作品吗？</div>
          <div className="sub-faq-a">mock 流程不会主动删除作品；实际保留期限由部署者的数据与隐私策略决定。</div>
        </div>
        <p className="sub-promise">模拟支付 · 不产生真实扣款</p>
      </div>
    </div>
  );
}
