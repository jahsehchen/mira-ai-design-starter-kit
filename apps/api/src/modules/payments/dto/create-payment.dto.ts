import { IsIn, IsOptional } from 'class-validator';
import type { BillingCycle, PaymentProvider } from '@mira/contracts';

/** 创建支付订单入参（POST /payments/create 或 /subscriptions/upgrade 内部使用） */
export class CreatePaymentDto {
  @IsIn(['pro', 'team'], { message: '仅支持升级 Pro 或团队版' })
  planKey!: 'pro' | 'team';

  @IsIn(['monthly', 'yearly'], { message: '计费周期无效' })
  billingCycle!: BillingCycle;

  /** 支付渠道（可选，默认取配置 payments.provider） */
  @IsOptional()
  @IsIn(['mock', 'wechat', 'alipay'], { message: '支付渠道无效' })
  provider?: PaymentProvider;
}
