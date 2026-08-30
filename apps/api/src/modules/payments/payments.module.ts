import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrderEntity } from '../../database/entities/payment-order.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_GATEWAY_TOKEN } from './payment-gateway.interface';
import { MockPaymentGateway } from './mock-payment.gateway';
import { WechatPaymentGateway } from './wechat-payment.gateway';
import { AlipayPaymentGateway } from './alipay-payment.gateway';

/**
 * 支付模块（Q8 支付系统框架）：
 * - 按 PAYMENT_PROVIDER（env，默认 mock）注册对应网关到 PAYMENT_GATEWAY_TOKEN
 * - 导出 PaymentsService，供 SubscriptionsModule 创建订单/回调激活套餐使用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentOrderEntity, SubscriptionPlanEntity, UserEntity]),
    // 循环依赖：SubscriptionsService（activatePlan）↔ PaymentsService（createPayment）
    forwardRef(() => SubscriptionsModule),
    // JwtAuthGuard（/payments/mock-pay 需要登录态）
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_GATEWAY_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<'mock' | 'wechat' | 'alipay'>('payments.provider') || 'mock';
        switch (provider) {
          case 'wechat':
            return new WechatPaymentGateway(config);
          case 'alipay':
            return new AlipayPaymentGateway(config);
          case 'mock':
          default:
            return new MockPaymentGateway(config);
        }
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
