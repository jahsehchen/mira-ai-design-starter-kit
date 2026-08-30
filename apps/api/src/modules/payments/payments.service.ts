import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  MockPayResponse,
  PaymentProvider,
  UpgradeResponse,
} from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { PaymentOrderEntity } from '../../database/entities/payment-order.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  PAYMENT_GATEWAY_TOKEN,
  type PaymentGateway,
} from './payment-gateway.interface';
import {
  MockPaymentGateway,
  type MockCallbackPayload,
} from './mock-payment.gateway';

/**
 * 支付服务（Q8 支付系统框架）：
 * - createPayment：建支付订单（expiresAt=15min）→ 调网关拿支付引导
 * - handleCallback：网关回调统一入口（验签 → 校验订单 → 置 paid → 激活套餐）
 * - mockPay：模拟支付，复用同一套回调处理逻辑（无资质验收路径）
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentOrderEntity)
    private readonly ordersRepo: Repository<PaymentOrderEntity>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plansRepo: Repository<SubscriptionPlanEntity>,
    @Inject(PAYMENT_GATEWAY_TOKEN)
    private readonly gateway: PaymentGateway,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /** 生成业务单号：MIRA + yyyyMMddHHmmss + 6 位随机 */
  private static buildOrderNo(now = new Date()): string {
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const datePart =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `MIRA${datePart}${rand}`;
  }

  /** 创建支付订单（由 /subscriptions/upgrade 或 /payments/create 调用） */
  async createPayment(
    userId: string,
    input: { planKey: 'pro' | 'team'; billingCycle: 'monthly' | 'yearly'; provider?: PaymentProvider },
  ): Promise<UpgradeResponse> {
    const target = await this.plansRepo.findOne({ where: { key: input.planKey } });
    if (!target) throw ApiException.notFound('套餐方案不存在');

    // 金额单位：分（cents）；年付用年价
    const amountCents =
      input.billingCycle === 'yearly' ? target.priceYearlyCents : target.priceMonthlyCents;

    // 顺手过期该用户的旧 pending 单（状态机：pending → expired），避免堆积
    await this.expireStalePendingOrders(userId);

    // 建订单
    const order = this.ordersRepo.create({
      orderNo: PaymentsService.buildOrderNo(),
      userId,
      planKey: input.planKey,
      billingCycle: input.billingCycle,
      amountCents,
      currency: 'CNY',
      provider: this.gateway.name, // 实际渠道以配置注册的网关为准
      status: 'pending',
      expiresAt: new Date(Date.now() + this.expireMinutes() * 60_000),
    });
    await this.ordersRepo.save(order);

    // 调网关拿支付引导
    const desc = `${target.name}会员·${input.billingCycle === 'yearly' ? '按年' : '按月'}付费`;
    let payUrl: string | null = null;
    let qrCode: string | null = null;
    try {
      const result = await this.gateway.createOrder({
        orderNo: order.orderNo,
        amountCents,
        description: desc,
      });
      payUrl = result.payUrl ?? null;
      qrCode = result.qrCode ?? null;
    } catch (err) {
      this.logger.error(`网关下单失败：${err instanceof Error ? err.message : err}`);
      // 网关未配置/下单失败：订单仍保留 pending，对外暴露明确错误
      throw ApiException.conflict(err instanceof Error ? err.message : '支付渠道暂不可用');
    }

    return {
      status: 'order_created',
      orderId: order.id,
      orderNo: order.orderNo,
      amountCents,
      planKey: input.planKey,
      billingCycle: input.billingCycle,
      provider: order.provider as PaymentProvider,
      payUrl,
      qrCode,
      message: `订单已创建，请在 ${this.expireMinutes()} 分钟内完成支付`,
    };
  }

  /**
   * 网关异步回调统一入口。
   * 微信/支付宝/模拟网关共用此接口（POST /payments/callback/:provider）。
   * 返回网关需要的成功响应（微信 "SUCCESS" / 支付宝 "success"）。
   */
  async handleCallback(provider: string, body: unknown): Promise<string> {
    // 1. 网关验签（真实网关验签名/解密，mock 校验固定 token）；验签失败转可读业务错误
    let verification: Awaited<ReturnType<PaymentGateway['verifyCallback']>>;
    try {
      verification = await this.gateway.verifyCallback(body);
    } catch (err) {
      this.logger.warn(`回调验签失败：${err instanceof Error ? err.message : err}`);
      throw ApiException.validation(err instanceof Error ? err.message : '支付回调验签失败');
    }
    if (!verification.paid) {
      throw ApiException.validation('支付未成功');
    }

    // 2. 从回调 payload 提取订单号（各网关字段名不同：mock→orderNo，微信/支付宝→out_trade_no）
    const orderNo = this.resolveOrderNo(body);
    if (!orderNo) throw ApiException.validation('回调缺少订单号');

    // 3. 校验 + 置 paid + 激活套餐
    const amountCents = this.resolveAmountCents(body);
    await this.applyPaid(orderNo, verification.tradeNo, amountCents);

    // 4. 网关约定的成功响应文本
    return provider === 'alipay' ? 'success' : 'SUCCESS';
  }

  /** 模拟支付：构造 mock 回调 payload，走与真实回调相同的处理链路 */
  async mockPay(orderId: string, userId: string): Promise<MockPayResponse> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw ApiException.notFound('支付订单不存在');
    if (order.userId !== userId) throw ApiException.forbidden('无权操作该订单');
    if (order.provider !== 'mock') throw ApiException.conflict('该订单不是模拟支付订单');

    const payload: MockCallbackPayload = {
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      token: this.mockToken(),
      tradeNo: MockPaymentGateway.buildTradeNo(),
    };
    await this.handleCallback('mock', payload);

    return {
      status: 'paid',
      planKey: order.planKey as 'pro' | 'team',
      message: '模拟支付成功，套餐已生效',
    };
  }

  /**
   * 统一「支付成功」处理：
   * 幂等（已 paid 直接返回）→ 校验订单存在/未支付/未过期/金额一致 → 置 paid + paidAt + tradeNo → 激活套餐。
   */
  private async applyPaid(
    orderNo: string,
    tradeNo: string,
    amountCents?: number,
  ): Promise<PaymentOrderEntity> {
    const order = await this.ordersRepo.findOne({ where: { orderNo } });
    if (!order) throw ApiException.notFound('支付订单不存在');

    // 幂等：重复回调直接成功返回
    if (order.status === 'paid') return order;
    if (order.status === 'refunded') throw ApiException.conflict('订单已退款，不可重复支付');

    // 过期校验
    if (order.expiresAt.getTime() < Date.now()) {
      order.status = 'expired';
      await this.ordersRepo.save(order);
      throw ApiException.conflict('支付订单已过期，请重新下单');
    }

    // 金额校验（回调带金额时才校验）
    if (amountCents !== undefined && amountCents !== order.amountCents) {
      order.status = 'failed';
      await this.ordersRepo.save(order);
      throw ApiException.conflict(`支付金额不匹配（订单 ${order.amountCents} 分，回调 ${amountCents} 分）`);
    }

    // 置 paid
    order.status = 'paid';
    order.paidAt = new Date();
    order.tradeNo = tradeNo;
    await this.ordersRepo.save(order);
    this.logger.log(`订单 ${order.orderNo} 支付成功（${tradeNo}），开始生效套餐`);

    // 触发套餐生效（复用订阅服务的套餐更新逻辑）
    await this.subscriptionsService.activatePlan(order.userId, {
      planKey: order.planKey as 'pro' | 'team',
      billingCycle: order.billingCycle as 'monthly' | 'yearly',
      orderId: order.id,
    });

    return order;
  }

  /** 批量过期该用户所有已到期的 pending 订单（状态机：pending → expired） */
  private async expireStalePendingOrders(userId: string): Promise<void> {
    const stale = await this.ordersRepo.find({
      where: { userId, status: 'pending' },
    });
    const now = Date.now();
    const toExpire = stale.filter((o) => o.expiresAt.getTime() < now);
    for (const o of toExpire) {
      o.status = 'expired';
    }
    if (toExpire.length > 0) await this.ordersRepo.save(toExpire);
  }

  /** 从回调 payload 提取业务单号 */
  private resolveOrderNo(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.orderNo === 'string') return p.orderNo;
    if (typeof p.out_trade_no === 'string') return p.out_trade_no;
    if (typeof p.outTradeNo === 'string') return p.outTradeNo;
    return null;
  }

  /** 从回调 payload 提取金额（分）；无该字段则不校验 */
  private resolveAmountCents(payload: unknown): number | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const p = payload as Record<string, unknown>;
    if (typeof p.amountCents === 'number') return p.amountCents;
    return undefined;
  }

  private expireMinutes(): number {
    return this.config.get<number>('payments.orderExpireMinutes') || 15;
  }

  private mockToken(): string {
    return this.config.get<string>('payments.mockToken') || 'mira-mock-pay-token';
  }
}
