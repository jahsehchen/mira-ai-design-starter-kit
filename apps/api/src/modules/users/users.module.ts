import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from '../../database/entities/user.entity';
import { WorkEntity } from '../../database/entities/work.entity';
import { GenerationEntity } from '../../database/entities/generation.entity';
import { ExportJobEntity } from '../../database/entities/export-job.entity';
import { ShareEntity } from '../../database/entities/share.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      WorkEntity,
      GenerationEntity,
      ExportJobEntity,
      ShareEntity,
      UserSubscriptionEntity,
    ]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
