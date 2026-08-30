import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlanEntity,
      UserSubscriptionEntity,
      GenerationEntity,
      UserEntity,
    ]),
    AuthModule,
    // 循环依赖：SubscriptionsService（createPayment）↔ PaymentsService（activatePlan）
    forwardRef(() => PaymentsModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
