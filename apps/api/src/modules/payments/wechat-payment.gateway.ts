import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentGateway,
  PaymentGatewayCreateResult,
  PaymentGatewayOrder,
  PaymentGatewayVerifyResult,
} from './payment-gateway.interface';

/**
 * 微信支付网关（骨架）。
 * 当前未接入真实商户：mchid 为空时 createOrder / verifyCallback 直接抛中文错误。
 * 拿到商户资质后，仅需填入 .env 的 WECHAT_* 配置并补全下述「真实对接点」即可切换。
 *
 * 真实对接点（https://pay.weixin.qq.com 商户平台，需已备案域名 + 微信支付商户号）：
 * 1. 下单：POST https://api.mch.weixin.qq.com/v3/pay/transactions/native（Native 扫码）
 *          或 /v3/pay/transactions/jsapi（JSAPI 公众号/小程序支付）
 *    - 请求体：{ appid, mchid, description, out_trade_no, notify_url, amount:{ total(分), currency:'CNY' } }
 *    - 鉴权：微信支付 APIv3 平台证书 + 商户私钥签名，或使用商户 API 密钥生成 Authorization 头
 *    - 返回 code_url → 作为 qrCode 给前端渲染二维码
 * 2. 回调验签：POST /payments/callback/wechat 收到通知后
 *    - 用微信平台证书公钥验签（Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce 请求头）
 *    - 解密 resource.ciphertext（AES-256-GCM，密钥=APIv3 密钥）
 *    - 明文含 out_trade_no（本系统 orderNo）、transaction_id（网关交易号）、trade_state
 *    - trade_state === 'SUCCESS' 视为支付成功；处理后必须返回纯文本 "SUCCESS"，否则微信会重复通知
 * 3. 退款/关单：对应 /v3/refund/domestic/refunds、/v3/pay/transactions/out-trade-no/{no}/close
 */
@Injectable()
export class WechatPaymentGateway implements PaymentGateway {
  readonly name = 'wechat';

  constructor(private readonly config: ConfigService) {}

  /** 校验商户配置，未配置时抛出可读中文错误 */
  private assertConfigured(): void {
    const mchid = this.config.get<string>('payments.wechat.mchid') || '';
    if (!mchid) {
      throw new Error('未配置微信支付商户号（WECHAT_MCHID），请在 .env 填写后切换真实网关');
    }
  }

  async createOrder(order: PaymentGatewayOrder): Promise<PaymentGatewayCreateResult> {
    this.assertConfigured();
    // TODO(真实对接)：调微信 Native/JSAPI 下单接口，返回 code_url
    // 示意：const res = await fetch('https://api.mch.weixin.qq.com/v3/pay/transactions/native', {...})
    throw new Error('微信支付网关骨架：真实下单接口待接入（见 wechat-payment.gateway.ts 注释）');
  }

  async verifyCallback(payload: unknown): Promise<PaymentGatewayVerifyResult> {
    this.assertConfigured();
    // TODO(真实对接)：验签 + AES-GCM 解密 resource，取 out_trade_no / transaction_id / trade_state
    void payload;
    throw new Error('微信支付网关骨架：回调验签待接入（见 wechat-payment.gateway.ts 注释）');
  }
}
