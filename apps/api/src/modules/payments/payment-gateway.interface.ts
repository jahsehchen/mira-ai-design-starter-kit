import type { InjectionToken } from '@nestjs/common';

/**
 * 创建支付订单入参（网关视角，不含内部订单字段）。
 */
export interface PaymentGatewayOrder {
  /** 业务单号（如 MIRA20260828120000123456），传给网关作为 out_trade_no */
  orderNo: string;
  /** 金额（分） */
  amountCents: number;
  /** 商品描述（如「Pro 会员·按月」） */
  description: string;
}

/**
 * 创建支付订单结果：payUrl（跳转）/ qrCode（扫码）至少其一，或返回自定义 params 给前端。
 */
export interface PaymentGatewayCreateResult {
  payUrl?: string;
  qrCode?: string;
  params?: Record<string, unknown>;
}

/**
 * 回调验证结果。
 */
export interface PaymentGatewayVerifyResult {
  /** 网关交易号 */
  tradeNo: string;
  /** 是否支付成功 */
  paid: boolean;
}

/**
 * 支付网关抽象（适配器模式）。
 * 新接入网关实现此接口即可；DI 通过 PAYMENT_GATEWAY_TOKEN 注入当前配置的网关。
 */
export interface PaymentGateway {
  readonly name: string;

  /** 调网关创建支付单，返回支付引导（payUrl / qrCode / params） */
  createOrder(order: PaymentGatewayOrder): Promise<PaymentGatewayCreateResult>;

  /** 验证异步回调 payload（签名 + 状态），返回交易号与是否支付成功 */
  verifyCallback(payload: unknown): Promise<PaymentGatewayVerifyResult>;
}

/** 当前支付网关的 DI token（由 PaymentsModule 按配置注册） */
export const PAYMENT_GATEWAY_TOKEN: InjectionToken = 'PAYMENT_GATEWAY_TOKEN';
