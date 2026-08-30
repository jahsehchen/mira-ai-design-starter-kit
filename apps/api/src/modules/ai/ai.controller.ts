import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  GenerationCreateResponse,
  GenerationStatusDto,
} from '@mira/contracts';
import { ok } from '../../common/envelope';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { RegenerateGenerationDto } from './dto/regenerate-generation.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generations')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateGenerationDto) {
    return ok<GenerationCreateResponse>(
      await this.aiService.createGeneration(user.id, dto),
      '生成任务已创建',
    );
  }

  @Post('generations/regenerate')
  async regenerate(@CurrentUser() user: AuthUser, @Body() dto: RegenerateGenerationDto) {
    return ok<GenerationCreateResponse>(
      await this.aiService.regenerateGeneration(user.id, dto),
      '重绘任务已创建',
    );
  }

  @Get('generations/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ok<GenerationStatusDto>(await this.aiService.getGeneration(user.id, id));
  }
}
