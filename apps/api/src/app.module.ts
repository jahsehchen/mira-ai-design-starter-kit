import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorksModule } from './modules/works/works.module';
import { AiModule } from './modules/ai/ai.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ExportModule } from './modules/export/export.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SharesModule } from './modules/shares/shares.module';
import { HealthModule } from './modules/health/health.module';
import { SeedModule } from './seed/seed.module';

/**
 * 根模块：全局配置 + 数据库 + 10 业务模块 + 种子。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    WorksModule,
    AiModule,
    TemplatesModule,
    ExportModule,
    SubscriptionsModule,
    PaymentsModule,
    SharesModule,
    HealthModule,
    SeedModule,
  ],
})
export class AppModule {}
