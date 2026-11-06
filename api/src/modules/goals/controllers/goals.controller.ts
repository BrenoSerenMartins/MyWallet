import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Headers,
  Req,
  Inject,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { GoalsService } from '../services/goals.service.js';
import { SaveGoalDto, AllocateGoalDto, GoalResourceDto, GoalsSummaryDto } from '../dto/goal.dto.js';
@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/goals')
export class GoalsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(GoalsService) private readonly goals: GoalsService,
  ) {}
  @Get() @ApiOkResponse({ type: GoalsSummaryDto }) summary(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.goals.summary(), true);
  }
  @Post()
  @ApiBody({ type: SaveGoalDto })
  @ApiCreatedResponse({ type: GoalResourceDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const input = await validateInput(SaveGoalDto, body);
    return this.db.forUser(r.identity.id, () => this.goals.save(input));
  }
  @Patch(':id')
  @ApiBody({ type: SaveGoalDto })
  @ApiOkResponse({ type: GoalResourceDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
  ) {
    const input = await validateInput(SaveGoalDto, body);
    return this.db.forUser(r.identity.id, () => this.goals.save(input, requireUuid(id), version));
  }
  @Post(':id/allocations')
  @ApiBody({ type: AllocateGoalDto })
  @ApiCreatedResponse({ type: GoalResourceDto })
  async allocate(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const input = await validateInput(AllocateGoalDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.goals.allocate(requireUuid(id), input, version, key),
    );
  }
  @Post(':id/allocations/:event/undo') @ApiOkResponse({ type: GoalResourceDto }) undo(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('event') event: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.goals.undo(requireUuid(id), requireUuid(event), version, key),
    );
  }
}
