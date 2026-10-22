import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { CreateWorkspaceDto, WorkspaceResourceDto } from '../dto/workspace.dto.js';
import { WorkspacesService } from '../services/workspaces.service.js';
@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(WorkspacesService) private readonly workspaces: WorkspacesService,
  ) {}
  @Get() @ApiOkResponse({ type: [WorkspaceResourceDto] }) list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.workspaces.list(), false, null);
  }
  @Post()
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiCreatedResponse({ type: WorkspaceResourceDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const input = await validateInput(CreateWorkspaceDto, body);
    return this.db.forUser(r.identity.id, () => this.workspaces.create(input), false, null);
  }
}
