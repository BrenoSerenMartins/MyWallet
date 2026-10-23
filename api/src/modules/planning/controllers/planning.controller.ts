import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import {
  CopyMonthlyPlanDto,
  MonthlyPlanResourceDto,
  SaveMonthlyPlanDto,
} from '../dto/planning.dto.js';
import { PlanningService } from '../services/planning.service.js';
@ApiTags('Planning')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/planning')
export class PlanningController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PlanningService) private readonly planning: PlanningService,
  ) {}
  @Get(':month')
  @ApiOkResponse({ type: MonthlyPlanResourceDto })
  summary(@Req() r: AuthenticatedRequest, @Param('month') month: string) {
    return this.db.forUser(r.identity.id, () => this.planning.summary(month), true);
  }
  @Put(':month')
  @ApiBody({ type: SaveMonthlyPlanDto })
  @ApiOkResponse({ type: MonthlyPlanResourceDto })
  async save(
    @Req() r: AuthenticatedRequest,
    @Param('month') month: string,
    @Body() body: SaveMonthlyPlanDto,
  ) {
    const input = await validateInput(SaveMonthlyPlanDto, body);
    return this.db.forUser(r.identity.id, () => this.planning.save(month, input));
  }
  @Post(':month/copies')
  @ApiBody({ type: CopyMonthlyPlanDto })
  @ApiOkResponse({ type: MonthlyPlanResourceDto })
  async copy(
    @Req() r: AuthenticatedRequest,
    @Param('month') month: string,
    @Body() body: CopyMonthlyPlanDto,
  ) {
    const input = await validateInput(CopyMonthlyPlanDto, body);
    return this.db.forUser(r.identity.id, () => this.planning.copyPrevious(month, input));
  }
}
