import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MessageResponse, PageResult, WorkDto, WorksMatchingIdsResponse } from '@mira/contracts';
import { ok, okPage } from '../../common/envelope';
import { WorksService } from './works.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';

@ApiTags('works')
@Controller('works')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkDto) {
    return ok<WorkDto>(await this.worksService.create(user.id, dto), '作品已创建');
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: 'recent' | 'oldest',
    @Query('keyword') keyword?: string,
  ) {
    const result = await this.worksService.list(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sort,
      keyword,
    });
    return okPage<WorkDto>(result.items, result.total, result.page, result.pageSize);
  }

  /**
   * R5 跨页全选：返回当前筛选下匹配作品 id + 总数（上限 EXPORT_MAX_WORKS_PER_BATCH=20）。
   * ⚠️ 必须声明在 @Get(':id') 之前，避免 ':id' 路由抢先匹配 'matching-ids'。
   */
  @Get('matching-ids')
  async matchingIds(
    @CurrentUser() user: AuthUser,
    @Query('sort') sort?: 'recent' | 'oldest',
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.worksService.matchingIds(user.id, {
      sort,
      keyword,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return ok<WorksMatchingIdsResponse>(result);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ok<WorkDto>(await this.worksService.get(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkDto,
  ) {
    return ok<WorkDto>(await this.worksService.update(user.id, id, dto), '作品已保存');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ok<MessageResponse>(await this.worksService.remove(user.id, id), '作品已删除');
  }

  @Post(':id/duplicate')
  async duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return ok<WorkDto>(await this.worksService.duplicate(user.id, id), '已复制一份副本');
  }
}
