import { Controller, Get, Post, Param, Headers, Req, UseGuards, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { requireUuid } from '../../../core/rest/index.js';
import { BalanceBasisService } from '../services/balance-basis.service.js';
import { BalanceHistoryDto } from '../../../core/integration/balance-basis-dto.js';
@ApiTags('Account balance')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/accounts/:accountId')
export class BalanceBasisController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(BalanceBasisService) private readonly basis: BalanceBasisService,
  ) {}
  @Get('balance-history')
  @ApiOkResponse({ type: [BalanceHistoryDto] })
  history(@Req() r: AuthenticatedRequest, @Param('accountId') account: string) {
    return this.db.forUser(r.identity.id, () => this.basis.history(requireUuid(account)));
  }
  @Post('balance-adjustments/:id/reversals')
  @ApiOkResponse({ type: BalanceHistoryDto })
  undo(
    @Req() r: AuthenticatedRequest,
    @Param('accountId') account: string,
    @Param('id') id: string,
    @Headers('if-match') version: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.basis.undo(requireUuid(account), requireUuid(id), Number(version)),
    );
  }
  @Post('balance-basis/imports/:id')
  statement(
    @Req() r: AuthenticatedRequest,
    @Param('accountId') account: string,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.basis.considerStatement(requireUuid(account), requireUuid(id)),
    );
  }
}
