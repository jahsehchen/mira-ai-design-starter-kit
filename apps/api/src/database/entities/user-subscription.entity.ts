import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 用户订阅表（每用户一条，unique user_id） */
@Entity('user_subscriptions')
export class UserSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'plan_key', length: 16 })
  planKey: string;

  @Column({ length: 16, default: 'active' })
  status: string;

  @Column({ name: 'billing_cycle', length: 16, default: 'monthly' })
  billingCycle: string;

  @Column({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'expires_at', type: Date, nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
