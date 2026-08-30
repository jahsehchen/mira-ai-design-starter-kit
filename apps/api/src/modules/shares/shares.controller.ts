import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ShareDto, SharePreviewResponse } from '@mira/contracts';
import { ok } from '../../common/envelope';
import { SharesService } from './shares.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateShareDto } from './dto/create-share.dto';

@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateShareDto) {
    return ok<ShareDto>(await this.sharesService.create(user.id, dto.workId), '分享链接已生成');
  }

  @Get(':token')
  async get(@Param('token') token: string) {
    return ok<SharePreviewResponse>(await this.sharesService.getByToken(token));
  }
}
