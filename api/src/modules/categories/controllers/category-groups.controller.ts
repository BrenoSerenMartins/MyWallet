import { requireUuid } from '../../../core/rest/index.js';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  CategoryGroupResourceDto,
  CategoryGroupDeletionResourceDto,
} from '../../../core/integration/index.js';
import {
  Body,
  Delete,
  Controller,
  Get,
  Inject,
  Post,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { CategoryGroupDto } from '../dto/category.dto.js';
import { CategoriesService } from '../services/categories.service.js';
@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/category-groups')
export class CategoryGroupsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CategoriesService) private readonly categories: CategoriesService,
  ) {}
  @Get() @ApiOkResponse({ type: [CategoryGroupResourceDto] }) list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.categories.exportGroups());
  }
  @Post()
  @ApiCreatedResponse({ type: CategoryGroupResourceDto })
  @ApiBody({ type: CategoryGroupDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const dto = await validateInput(CategoryGroupDto, body);
    return this.db.forUser(r.identity.id, () => this.categories.saveGroup(dto));
  }
  @Patch(':id')
  @ApiBody({ type: CategoryGroupDto })
  @ApiOkResponse({ type: CategoryGroupResourceDto })
  async update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const dto = await validateInput(CategoryGroupDto, body);
    return this.db.forUser(r.identity.id, () => this.categories.saveGroup(dto, requireUuid(id)));
  }
  @Get(':id/deletion-preview')
  @ApiOkResponse({ type: CategoryGroupDeletionResourceDto })
  deletionPreview(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.categories.deletionPreview(requireUuid(id)));
  }
  @Delete(':id')
  deleteGroup(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.categories.deleteGroup(requireUuid(id)));
  }
}
