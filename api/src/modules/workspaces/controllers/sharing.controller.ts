import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { requireUuid } from '../../../core/rest/index.js';
import {
  InviteDto,
  MemberRoleDto,
  AcceptInviteDto,
  MemberDto,
  InviteResultDto,
} from '../dto/sharing.dto.js';
import { SharingService } from '../services/sharing.service.js';
@ApiTags('Workspace sharing')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/workspaces')
export class SharingController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SharingService) private readonly sharing: SharingService,
  ) {}
  @Get(':id/members') @ApiOkResponse({ type: [MemberDto] }) members(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.sharing.members(), true, requireUuid(id));
  }
  @Get(':id/invites') invites(@Req() r: AuthenticatedRequest, @Param('id') id: string) {
    return this.db.forUser(r.identity.id, () => this.sharing.invites(), true, requireUuid(id));
  }
  @Post(':id/invites')
  @ApiBody({ type: InviteDto })
  @ApiCreatedResponse({ type: InviteResultDto })
  async invite(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    const input = await validateInput(InviteDto, body);
    return this.db.forUser(r.identity.id, () => this.sharing.invite(input), false, requireUuid(id));
  }
  @Delete(':id/invites/:invite') revoke(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('invite') invite: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.sharing.revoke(requireUuid(invite)),
      false,
      requireUuid(id),
    );
  }
  @Patch(':id/members/:actor') @ApiBody({ type: MemberRoleDto }) async change(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('actor') actor: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(MemberRoleDto, body);
    return this.db.forUser(
      r.identity.id,
      () => this.sharing.change(requireUuid(actor), input.role),
      false,
      requireUuid(id),
    );
  }
  @Delete(':id/members/:actor') remove(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('actor') actor: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.sharing.change(requireUuid(actor)),
      false,
      requireUuid(id),
    );
  }
  @Post('invitations/accept') @ApiBody({ type: AcceptInviteDto }) async accept(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = await validateInput(AcceptInviteDto, body);
    return this.db.forUser(
      r.identity.id,
      () => this.sharing.accept(input.token, r.identity.verifiedEmail),
      false,
      null,
    );
  }
}
