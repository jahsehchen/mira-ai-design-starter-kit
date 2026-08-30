import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLAN_DEFINITIONS } from '@mira/contracts';
import { TemplateEntity } from '../database/entities/template.entity';
import { SubscriptionPlanEntity } from '../database/entities/subscription-plan.entity';
import { TEMPLATE_SEED } from './seed-data';

/**
 * 幂等种子：仅当对应表为空时写入。
 * - 12 条模板（复用原型渐变数据）
 * - 3 个订阅方案（Free/Pro/团队版，来自 contracts PLAN_DEFINITIONS 单一来源）
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(TemplateEntity)
    private readonly tplRepo: Repository<TemplateEntity>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plansRepo: Repository<SubscriptionPlanEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedTemplates();
    await this.seedPlans();
  }

  private async seedTemplates(): Promise<void> {
    const count = await this.tplRepo.count();
    if (count > 0) {
      this.logger.log(`模板种子跳过（已有 ${count} 条）`);
      return;
    }

    await this.tplRepo.save(
      TEMPLATE_SEED.map((item, index) =>
        this.tplRepo.create({
          ...item,
          canvasJson: null,
          isActive: true,
          sortOrder: index + 1,
        }),
      ),
    );
    this.logger.log(`模板种子完成：写入 ${TEMPLATE_SEED.length} 条`);
  }

  private async seedPlans(): Promise<void> {
    const count = await this.plansRepo.count();
    if (count > 0) {
      this.logger.log(`订阅方案种子跳过（已有 ${count} 条）`);
      return;
    }

    await this.plansRepo.save(
      PLAN_DEFINITIONS.map((plan) =>
        this.plansRepo.create({
          key: plan.key,
          name: plan.name,
          priceMonthlyCents: plan.priceMonthlyCents,
          priceYearlyCents: plan.priceYearlyCents,
          quotaPerMonth: plan.quotaPerMonth,
          features: plan.features,
          isActive: true,
        }),
      ),
    );
    this.logger.log(`订阅方案种子完成：写入 ${PLAN_DEFINITIONS.length} 条`);
  }
}
