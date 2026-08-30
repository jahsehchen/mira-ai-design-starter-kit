import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PageResult, TemplateCategory, TemplateDto, WorkDto } from '@mira/contracts';
import { ok, okPage } from '../../common/envelope';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async list(
    @Query('category') category?: TemplateCategory | 'all',
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.templatesService.list({
      category,
      keyword,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return okPage<TemplateDto>(result.items, result.total, result.page, result.pageSize);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return ok<TemplateDto>(await this.templatesService.get(id));
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async apply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ok<WorkDto>(await this.templatesService.apply(user.id, id), '已套用模板，去编辑器调整吧');
  }
}
