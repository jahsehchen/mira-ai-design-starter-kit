import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MessageResponse, PlanDto, SubscriptionDto, UpgradeResponse } from '@mira/contracts';
import { ok } from '../../common/envelope';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { UpgradeDto } from './dto/upgrade.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async plans() {
    return ok<PlanDto[]>(await this.subscriptionsService.plans());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return ok<SubscriptionDto>(await this.subscriptionsService.me(user.id));
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async upgrade(@CurrentUser() user: AuthUser, @Body() dto: UpgradeDto) {
    return ok<UpgradeResponse>(
      await this.subscriptionsService.upgrade(user.id, dto),
      '订单已创建，请完成支付',
    );
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async cancel(@CurrentUser() user: AuthUser) {
    return ok<MessageResponse>(await this.subscriptionsService.cancel(user.id));
  }
}
