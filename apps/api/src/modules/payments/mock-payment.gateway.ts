import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentGateway,
  PaymentGatewayCreateResult,
  PaymentGatewayOrder,
  PaymentGatewayVerifyResult,
} from './payment-gateway.interface';

/**
 * 模拟网关回调 payload 结构（仅 mock 网关使用）。
 * - token：固定签名 token（来自配置 payments.mockToken），模拟回调验签
 * - amountCents：金额（分），便于服务端二次校验
 * - tradeNo：模拟网关交易号
 */
export interface MockCallbackPayload {
  orderNo: string;
  amountCents: number;
  token: string;
  tradeNo: string;
  /** 支付是否成功（默认 true；false 表示未成功） */
  paid?: boolean;
}

/**
 * 模拟支付网关（无真实商户资质时的验收路径）：
 * - createOrder 返回站内模拟支付页 payUrl（实际由前端弹窗 + POST /payments/mock-pay 完成）
 * - verifyCallback 校验固定 token（模拟签名）
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';

  private readonly logger = new Logger(MockPaymentGateway.name);

  constructor(private readonly config: ConfigService) {}

  /** 生成模拟网关交易号 */
  static buildTradeNo(): string {
    const ts = Date.now().toString();
    const rand = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
    return `MOCK${ts}${rand}`;
  }

  async createOrder(order: PaymentGatewayOrder): Promise<PaymentGatewayCreateResult> {
    const base = this.config.get<string>('payments.mockPayUrlBase') || '/payments/mock-pay';
    this.logger.debug(`模拟网关创建支付单：${order.orderNo} ¥${(order.amountCents / 100).toFixed(2)}`);
    return { payUrl: `${base}?orderNo=${order.orderNo}` };
  }

  async verifyCallback(payload: unknown): Promise<PaymentGatewayVerifyResult> {
    const body = payload as Partial<MockCallbackPayload>;
    const expectedToken = this.config.get<string>('payments.mockToken') || 'mira-mock-pay-token';
    if (!body || body.token !== expectedToken) {
      throw new Error('模拟网关回调签名校验失败（token 不匹配）');
    }
    if (body.paid === false) {
      throw new Error('模拟网关回调：支付未成功');
    }
    return {
      tradeNo: body.tradeNo || MockPaymentGateway.buildTradeNo(),
      paid: true,
    };
  }
}
