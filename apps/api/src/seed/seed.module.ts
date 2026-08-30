import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { TemplateEntity } from '../database/entities/template.entity';
import { SubscriptionPlanEntity } from '../database/entities/subscription-plan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateEntity, SubscriptionPlanEntity])],
  providers: [SeedService],
})
export class SeedModule {}
