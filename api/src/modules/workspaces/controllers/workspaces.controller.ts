import { Body, Controller, Delete, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { validateInput } from '../../../core/http/index.js';
import {
  CreateWorkspaceDto,
  WorkspaceResourceDto,
  TrashedWorkspaceResourceDto,
} from '../dto/workspace.dto.js';
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
  @Get('trash') @ApiOkResponse({ type: [TrashedWorkspaceResourceDto] }) trash(
    @Req() r: AuthenticatedRequest,
  ) {
    return this.db.forUser(r.identity.id, () => this.workspaces.trash(), false, null);
  }
  @Delete(':id') @ApiOkResponse({ type: TrashedWorkspaceResourceDto }) archive(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.workspaces.archive(requireUuid(id)),
      false,
      null,
    );
  }
  @Post(':id/restorations') @ApiOkResponse({ type: WorkspaceResourceDto }) restore(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.workspaces.restore(requireUuid(id)),
      false,
      null,
    );
  }
  @Post()
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiCreatedResponse({ type: WorkspaceResourceDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const input = await validateInput(CreateWorkspaceDto, body);
    return this.db.forUser(r.identity.id, () => this.workspaces.create(input), false, null);
  }
}
