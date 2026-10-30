import { BalanceHistoryDto } from '../../../core/integration/balance-basis-dto.js';
import { BalanceAdjustmentDto } from '../dto/balance-adjustment.dto.js';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  TransactionResourceDto,
  TransactionCollectionDto,
} from '../../../core/integration/index.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUserGuard, type AuthenticatedRequest } from '../../../core/auth/index.js';
import { DatabaseService } from '../../../core/database/index.js';
import { validateInput } from '../../../core/http/index.js';
import { dateOnly, requireUuid } from '../../../core/rest/index.js';
import { TransactionDto, TransferDto } from '../dto/transaction.dto.js';
import { LedgerService } from '../services/ledger.service.js';
@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1')
export class LedgerController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
  ) {}
  @Get('transactions') @ApiOkResponse({ type: TransactionCollectionDto }) list(
    @Req() r: AuthenticatedRequest,
    @Query() q: Record<string, string>,
  ) {
    if (q.reconciliation && !['pending', 'reconciled'].includes(q.reconciliation))
      throw new BadRequestException('Filtro de conciliação inválido.');
    const limit = Math.min(Number(q.limit ?? 50), 100);
    if (!Number.isInteger(limit) || limit < 1) throw new BadRequestException('Limite inválido.');
    if (q.cursor) {
      try {
        const c = JSON.parse(Buffer.from(q.cursor, 'base64url').toString());
        if (typeof c !== 'string' || c.length !== 46) throw 0;
      } catch {
        throw new BadRequestException('Cursor inválido.');
      }
    }
    return this.db.forUser(r.identity.id, () =>
      this.ledger.list({
        limit,
        from: q.from ? dateOnly(q.from) : undefined,
        to: q.to ? dateOnly(q.to) : undefined,
        accountId: q.accountId ? requireUuid(q.accountId) : undefined,
        categoryId: q.categoryId ? requireUuid(q.categoryId) : undefined,
        type: q.type,
        reconciliation: q.reconciliation,
        search: q.search?.slice(0, 150),
        cursor: q.cursor,
      }),
    );
  }
  @Get('transactions/:id') @ApiOkResponse({ type: TransactionResourceDto }) find(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.ledger.find(requireUuid(id)));
  }
  @Post('transactions')
  @ApiCreatedResponse({ type: TransactionResourceDto })
  @ApiBody({ type: TransactionDto })
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    const dto = await validateInput(TransactionDto, body);
    return this.db.forUser(r.identity.id, () => this.ledger.create(dto));
  }
  @Patch('transactions/:id')
  @ApiOkResponse({ type: TransactionResourceDto })
  @ApiBody({ type: TransactionDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
    @Body() body: unknown,
  ) {
    const dto = await validateInput(TransactionDto, body);
    return this.db.forUser(r.identity.id, () => this.ledger.update(requireUuid(id), dto, version));
  }
  @Post('transactions/:id/reversals') reverse(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.ledger.reverse(requireUuid(id), version));
  }
  @Post('accounts/:id/balance-adjustments')
  @ApiBody({ type: BalanceAdjustmentDto })
  @ApiCreatedResponse({ type: BalanceHistoryDto })
  async adjustBalance(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Body() body: unknown,
  ) {
    const input = await validateInput(BalanceAdjustmentDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.ledger.adjustBalance(requireUuid(id), input, key),
    );
  }
  @Post('transfers') @ApiBody({ type: TransferDto }) async transfer(
    @Req() r: AuthenticatedRequest,
    @Headers('idempotency-key') key: string,
    @Body() body: unknown,
  ) {
    const dto = await validateInput(TransferDto, body);
    return this.db.forUser(r.identity.id, () => this.ledger.transfer(dto, key));
  }
}
