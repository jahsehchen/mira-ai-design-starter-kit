import { IsIn } from 'class-validator';
import type { BillingCycle } from '@mira/contracts';

export class UpgradeDto {
  @IsIn(['pro', 'team'], { message: '仅支持升级 Pro 或团队版' })
  planKey!: 'pro' | 'team';

  @IsIn(['monthly', 'yearly'], { message: '计费周期无效' })
  billingCycle!: BillingCycle;
}
