import { IsUUID } from 'class-validator';

/** 模拟支付请求（POST /payments/mock-pay，body: { orderId }） */
export class MockPayDto {
  @IsUUID('4', { message: '订单号格式无效' })
  orderId!: string;
}
