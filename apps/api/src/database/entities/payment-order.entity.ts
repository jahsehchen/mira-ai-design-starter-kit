import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 支付订单表（Q8 支付系统框架）。
 * 状态机：pending → paid / failed / expired；paid 后可 refunded。
 * 金额统一单位：分（cents）。
 */
@Entity('payment_orders')
export class PaymentOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 业务单号（如 MIRA20260828120000123456），对外唯一 */
  @Index({ unique: true })
  @Column({ name: 'order_no', type: 'varchar', length: 64 })
  orderNo: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'plan_key', type: 'varchar', length: 16 })
  planKey: string;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 16 })
  billingCycle: string;

  /** 应付金额（分） */
  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 8, default: 'CNY' })
  currency: string;

  /** 支付渠道：mock / wechat / alipay */
  @Column({ type: 'varchar', length: 16, default: 'mock' })
  provider: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  /** 网关交易号（支付成功后回填） */
  @Column({ name: 'trade_no', type: 'varchar', length: 64, nullable: true })
  tradeNo: string | null;

  @Column({ name: 'paid_at', type: Date, nullable: true })
  paidAt: Date | null;

  /** 订单过期时间（默认创建后 15 分钟） */
  @Column({ name: 'expires_at', type: Date })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
