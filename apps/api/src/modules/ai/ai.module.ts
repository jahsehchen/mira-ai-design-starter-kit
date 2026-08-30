import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { NvidiaAiProvider } from './providers/nvidia-ai.provider';
import { AI_PROVIDER_TOKEN, AiProvider } from './providers/ai-provider.interface';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { WorksModule } from '../works/works.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerationEntity, SubscriptionPlanEntity, UserEntity]),
    WorksModule,
    AuthModule,
  ],
  controllers: [AiController],
  providers: [
    MockAiProvider,
    NvidiaAiProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      inject: [ConfigService, MockAiProvider, NvidiaAiProvider],
      useFactory: (config: ConfigService, mock: MockAiProvider, nvidia: NvidiaAiProvider): AiProvider => {
        const providerName = config.get<string>('ai.provider') || 'mock';
        switch (providerName) {
          case 'mock':
            return mock;
          case 'nvidia':
            return nvidia;
          default:
            throw new Error(`未知 AI_PROVIDER: ${providerName}（当前支持 mock | nvidia）`);
        }
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
