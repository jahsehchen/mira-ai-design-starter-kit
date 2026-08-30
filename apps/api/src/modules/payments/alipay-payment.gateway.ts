import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentGateway,
  PaymentGatewayCreateResult,
  PaymentGatewayOrder,
  PaymentGatewayVerifyResult,
} from './payment-gateway.interface';

/**
 * 支付宝网关（骨架）。
 * 当前未接入真实商户：appId 为空时 createOrder / verifyCallback 直接抛中文错误。
 * 拿到商户资质后，仅需填入 .env 的 ALIPAY_* 配置并补全下述「真实对接点」即可切换。
 *
 * 真实对接点（https://open.alipay.com 开放平台，需已备案域名 + 企业支付宝账号）：
 * 1. 下单：构造 alipay.trade.page.pay 请求（电脑网站支付）
 *    - 参数：app_id, method, charset, sign_type=RSA2, sign, notify_url,
 *      biz_content={ out_trade_no, total_amount(元, 注意是元不是分), subject, product_code:'FAST_INSTANT_TRADE_PAY' }
 *    - 签名：应用私钥（ALIPAY_PRIVATE_KEY）对参数做 RSA2（SHA256withRSA）签名
 *    - 返回支付表单/跳转 URL → 作为 payUrl 给前端
 * 2. 回调验签：POST /payments/callback/alipay 收到 notify 后
 *    - 校验 sign：用支付宝公钥（ALIPAY_PUBLIC_KEY）RSA2 验签
 *    - 校验 out_trade_no 是否存在、app_id 是否为本应用、total_amount 是否一致
 *    - trade_status === 'TRADE_SUCCESS' / 'TRADE_FINISHED' 视为支付成功
 *    - 处理后必须返回纯文本 "success"，否则支付宝会重复通知
 * 3. 退款：alipay.trade.refund 接口
 */
@Injectable()
export class AlipayPaymentGateway implements PaymentGateway {
  readonly name = 'alipay';

  constructor(private readonly config: ConfigService) {}

  /** 校验应用配置，未配置时抛出可读中文错误 */
  private assertConfigured(): void {
    const appId = this.config.get<string>('payments.alipay.appId') || '';
    if (!appId) {
      throw new Error('未配置支付宝应用（ALIPAY_APP_ID），请在 .env 填写后切换真实网关');
    }
  }

  async createOrder(order: PaymentGatewayOrder): Promise<PaymentGatewayCreateResult> {
    this.assertConfigured();
    // TODO(真实对接)：构造 alipay.trade.page.pay 表单 + RSA2 签名，返回支付跳转 URL
    throw new Error('支付宝网关骨架：真实下单接口待接入（见 alipay-payment.gateway.ts 注释）');
  }

  async verifyCallback(payload: unknown): Promise<PaymentGatewayVerifyResult> {
    this.assertConfigured();
    // TODO(真实对接)：用支付宝公钥验签，取 out_trade_no / trade_no / trade_status
    void payload;
    throw new Error('支付宝网关骨架：回调验签待接入（见 alipay-payment.gateway.ts 注释）');
  }
}
