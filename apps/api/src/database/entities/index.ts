import { UserEntity } from './user.entity';
import { WorkEntity } from './work.entity';
import { GenerationEntity } from './generation.entity';
import { TemplateEntity } from './template.entity';
import { ExportJobEntity } from './export-job.entity';
import { SubscriptionPlanEntity } from './subscription-plan.entity';
import { UserSubscriptionEntity } from './user-subscription.entity';
import { ShareEntity } from './share.entity';
import { PaymentOrderEntity } from './payment-order.entity';

/** 全部实体（TypeORM 注册用，单一入口） */
export const entities = [
  UserEntity,
  WorkEntity,
  GenerationEntity,
  TemplateEntity,
  ExportJobEntity,
  SubscriptionPlanEntity,
  UserSubscriptionEntity,
  ShareEntity,
  PaymentOrderEntity,
];

export {
  UserEntity,
  WorkEntity,
  GenerationEntity,
  TemplateEntity,
  ExportJobEntity,
  SubscriptionPlanEntity,
  UserSubscriptionEntity,
  ShareEntity,
  PaymentOrderEntity,
};
