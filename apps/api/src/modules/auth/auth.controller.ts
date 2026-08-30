import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthResponse, MessageResponse, RefreshResponse, UserPublic } from '@mira/contracts';
import { ok } from '../../common/envelope';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return ok<AuthResponse>(await this.authService.register(dto), '注册成功');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return ok<AuthResponse>(await this.authService.login(dto), '登录成功');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return ok<RefreshResponse>(await this.authService.refresh(dto.refreshToken));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(): Promise<ReturnType<typeof ok<MessageResponse>>> {
    // stateless JWT：登出 = 客户端丢弃令牌（黑名单 P2 再议）
    return ok<MessageResponse>({ message: 'ok' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return ok<UserPublic>(await this.authService.me(user.id));
  }
}
