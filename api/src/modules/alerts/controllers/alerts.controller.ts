import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../../core/database/index.js';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { validateInput } from '../../../core/http/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { AlertsService } from '../services/alerts.service.js';
import { AlertActionDto, AlertPreferencesDto, AlertsSummaryDto } from '../dto/alerts.dto.js';
@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/alerts')
export class AlertsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
  ) {}
  @Get() @ApiOkResponse({ type: AlertsSummaryDto }) list(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.alerts.list(), true);
  }
  @Post('sync') @ApiOkResponse({ type: AlertsSummaryDto }) sync(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.alerts.sync(), false, undefined, true);
  }
  @Put('preferences')
  @ApiBody({ type: AlertPreferencesDto })
  @ApiOkResponse({ type: AlertsSummaryDto })
  async save(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const p = await validateInput(AlertPreferencesDto, body);
    return this.db.forUser(r.identity.id, () => this.alerts.save(p), false, undefined, true);
  }
  @Patch(':id') @ApiBody({ type: AlertActionDto }) async action(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const p = await validateInput(AlertActionDto, body);
    return this.db.forUser(
      r.identity.id,
      () => this.alerts.action(requireUuid(id), p.action),
      false,
      undefined,
      true,
    );
  }
}
