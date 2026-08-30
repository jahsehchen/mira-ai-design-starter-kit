import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 订阅方案表（种子 3 方案：Free/Pro/团队版） */
@Entity('subscription_plans')
export class SubscriptionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 16, unique: true })
  key: string;

  @Column({ length: 32 })
  name: string;

  @Column({ name: 'price_monthly_cents', type: 'int' })
  priceMonthlyCents: number;

  @Column({ name: 'price_yearly_cents', type: 'int' })
  priceYearlyCents: number;

  @Column({ name: 'quota_per_month', type: 'int' })
  quotaPerMonth: number;

  @Column({ type: 'simple-json' })
  features: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
