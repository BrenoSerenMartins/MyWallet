import { ApiOkResponse } from '@nestjs/swagger';
import { DashboardHistoryDto, DashboardResourceDto } from '../../../core/integration/index.js';
import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { dateOnly } from '../../../core/rest/index.js';
import { DashboardService } from '../services/dashboard.service.js';
@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/dashboard')
export class DashboardController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}
  @Get('history') @ApiOkResponse({ type: DashboardHistoryDto }) history(
    @Req() r: AuthenticatedRequest,
    @Query('month') month: string,
    @Query('months') months?: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.dashboard.history(month, months === undefined ? 4 : Number(months)),
      true,
    );
  }
  @Get() @ApiOkResponse({ type: DashboardResourceDto }) summary(
    @Req() r: AuthenticatedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    dateOnly(from);
    dateOnly(to);
    if (from >= to) throw new BadRequestException('Período inválido.');
    return this.db.forUser(r.identity.id, () => this.dashboard.summary(from, to), true);
  }
}
