import { requireUuid } from '../../../core/rest/index.js';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CategoryResourceDto } from '../../../core/integration/index.js';
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
import { CategoryDto } from '../dto/category.dto.js';
import { CategoriesService } from '../services/categories.service.js';
@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/categories')
export class CategoriesController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CategoriesService) private readonly categories: CategoriesService,
  ) {}
  @Get() @ApiOkResponse({ type: [CategoryResourceDto] }) list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.categories.list());
  }
  @Post()
  @ApiCreatedResponse({ type: CategoryResourceDto })
  @ApiBody({ type: CategoryDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const dto = await validateInput(CategoryDto, body);
    return this.db.forUser(r.identity.id, () => this.categories.save(dto));
  }
  @Patch(':id')
  @ApiBody({ type: CategoryDto })
  @ApiOkResponse({ type: CategoryResourceDto })
  async update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const dto = await validateInput(CategoryDto, body);
    return this.db.forUser(r.identity.id, () => this.categories.update(requireUuid(id), dto));
  }
  @Delete(':id')
  archive(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.categories.archive(requireUuid(id)));
  }
}
