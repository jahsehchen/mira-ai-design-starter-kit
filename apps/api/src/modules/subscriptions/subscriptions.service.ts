import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import type {
  MessageResponse,
  PlanDto,
  PlanKey,
  SubscriptionDto,
  UpgradeResponse,
} from '@mira/contracts';
import { ApiException } from '../../common/api-exception';
import { UserEntity } from '../../database/entities/user.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plansRepo: Repository<SubscriptionPlanEntity>,
    @InjectRepository(UserSubscriptionEntity)
    private readonly subsRepo: Repository<UserSubscriptionEntity>,
    @InjectRepository(GenerationEntity)
    private readonly gensRepo: Repository<GenerationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  async plans(): Promise<PlanDto[]> {
    const plans = await this.plansRepo.find({ where: { isActive: true }, order: { priceMonthlyCents: 'ASC' } });
    return plans.map((p) => ({
      key: p.key as PlanKey,
      name: p.name,
      priceMonthlyCents: p.priceMonthlyCents,
      priceYearlyCents: p.priceYearlyCents,
      quotaPerMonth: p.quotaPerMonth,
      features: p.features,
    }));
  }

  async me(userId: string): Promise<SubscriptionDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw ApiException.notFound('用户不存在');

    const plan = await this.plansRepo.findOne({ where: { key: user.plan } });
    const quota = plan?.quotaPerMonth ?? 10;
    const planName = plan?.name ?? '免费版';

    const sub = await this.subsRepo.findOne({ where: { userId } });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const used = await this.gensRepo.count({
      where: { ownerId: userId, createdAt: MoreThanOrEqual(startOfMonth) },
    });

    const nextMonth = new Date(startOfMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return {
      plan: user.plan as PlanKey,
      name: planName,
      remainingGenerations: Math.max(0, quota - used),
      quotaPerMonth: quota,
      resetAt: nextMonth.toISOString(),
      billingCycle: (sub?.billingCycle as SubscriptionDto['billingCycle']) ?? 'monthly',
      status: (sub?.status as SubscriptionDto['status']) ?? 'active',
    };
  }

  /**
   * 套餐生效（支付成功后由支付模块回调触发，或直接调用）：
   * 更新 user.plan + upsert user_subscription。
   */
  async activatePlan(
    userId: string,
    input: { planKey: 'pro' | 'team'; billingCycle: 'monthly' | 'yearly'; orderId?: string },
  ): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw ApiException.notFound('用户不存在');

    user.plan = input.planKey;
    await this.usersRepo.save(user);

    let sub = await this.subsRepo.findOne({ where: { userId } });
    if (!sub) {
      sub = this.subsRepo.create({
        userId,
        planKey: input.planKey,
        status: 'active',
        billingCycle: input.billingCycle,
        startedAt: new Date(),
      });
    } else {
      sub.planKey = input.planKey;
      sub.status = 'active';
      sub.billingCycle = input.billingCycle;
      if (!sub.startedAt) sub.startedAt = new Date();
    }
    await this.subsRepo.save(sub);
  }

  /**
   * 升级入口（Q8）：改为创建支付订单，不再直接生效套餐。
   * 支付成功后由支付回调调用 activatePlan 完成套餐生效。
   */
  async upgrade(
    userId: string,
    input: { planKey: 'pro' | 'team'; billingCycle: 'monthly' | 'yearly' },
  ): Promise<UpgradeResponse> {
    return this.paymentsService.createPayment(userId, input);
  }

  /**
   * 取消续费（幂等）：user_subscriptions.status → 'canceled'，不立即降级 user.plan。
   * 无订阅记录或已是 canceled 均幂等返回 ok；到期自动回 free 属后端业务增量，本期不做。
   */
  async cancel(userId: string): Promise<MessageResponse> {
    const sub = await this.subsRepo.findOne({ where: { userId } });
    if (!sub || sub.status === 'canceled') return { message: 'ok' };
    sub.status = 'canceled';
    await this.subsRepo.save(sub);
    return { message: 'ok' };
  }
}
