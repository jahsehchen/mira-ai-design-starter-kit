import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserEntity } from '../../database/entities/user.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserSubscriptionEntity]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtService],
  exports: [JwtAuthGuard, AuthService, JwtService],
})
export class AuthModule {}
