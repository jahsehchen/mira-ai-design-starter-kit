import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MockPayResponse } from '@mira/contracts';
import { ok } from '../../common/envelope';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { MockPayDto } from './dto/mock-pay.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * 支付网关异步回调统一入口（mock / wechat / alipay 共用）。
   * 注意：此路由不带 JWT（网关服务端回调，无登录态）。
   * 返回网关需要的成功响应：微信 "SUCCESS" / 支付宝 "success"。
   */
  @Post('callback/:provider')
  async callback(@Param('provider') provider: string, @Body() body: Record<string, unknown>) {
    return this.paymentsService.handleCallback(provider, body);
  }

  /** 模拟支付（无真实商户资质时的验收路径）：POST /payments/mock-pay，body: { orderId } */
  @Post('mock-pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async mockPay(@CurrentUser() user: AuthUser, @Body() dto: MockPayDto) {
    return ok<MockPayResponse>(
      await this.paymentsService.mockPay(dto.orderId, user.id),
      '模拟支付成功',
    );
  }
}
