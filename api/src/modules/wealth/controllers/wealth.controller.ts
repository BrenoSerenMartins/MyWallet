import {
  BadRequestException,
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
import { WealthService } from '../services/wealth.service.js';
import {
  CreateHoldingDto,
  UpdateHoldingDto,
  InvestmentOperationDto,
  SaveWealthItemDto,
} from '../dto/wealth.dto.js';
import {
  WealthTotalsDto,
  WealthSummaryDto,
  InvestmentHoldingDto,
  WealthItemDto,
  WealthHistoryDto,
  InvestmentUndoDto,
} from '../dto/wealth-resource.dto.js';
import { ManagedEntryDto } from '../../../core/integration/managed-entry-dto.js';
@ApiTags('Wealth')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/wealth')
export class WealthController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(WealthService) private readonly wealth: WealthService,
  ) {}
  @Get('overview') @ApiOkResponse({ type: WealthTotalsDto }) overview(
    @Req() r: AuthenticatedRequest,
  ) {
    return this.db.forUser(
      r.identity.id,
      async () => {
        const {
          holdings: _h,
          items: _i,
          history: _history,
          ...totals
        } = await this.wealth.summary();
        return totals;
      },
      true,
    );
  }
  @Get() @ApiOkResponse({ type: WealthSummaryDto }) summary(@Req() r: AuthenticatedRequest) {
    return this.db.forUser(r.identity.id, () => this.wealth.summary(), true);
  }
  @Post('holdings')
  @ApiBody({ type: CreateHoldingDto })
  @ApiCreatedResponse({ type: InvestmentHoldingDto })
  async create(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(CreateHoldingDto, body);
    return this.db.forUser(r.identity.id, () => this.wealth.create(dto, key));
  }
  @Patch('holdings/:id')
  @ApiBody({ type: UpdateHoldingDto })
  @ApiOkResponse({ type: InvestmentHoldingDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
  ) {
    const dto = await validateInput(UpdateHoldingDto, body);
    return this.db.forUser(r.identity.id, () => this.wealth.update(requireUuid(id), dto, version));
  }
  @Get('holdings/:id/candidates') @ApiOkResponse({ type: [ManagedEntryDto] }) candidates(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('accountId') accountId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('direction') direction: string,
  ) {
    if (!['income', 'expense'].includes(direction))
      throw new BadRequestException('Direção inválida.');
    return this.db.forUser(
      r.identity.id,
      () =>
        this.wealth.candidates(
          requireUuid(id),
          requireUuid(accountId),
          from,
          to,
          direction as 'income' | 'expense',
        ),
      true,
    );
  }
  @Post('holdings/:id/operations')
  @ApiBody({ type: InvestmentOperationDto })
  @ApiCreatedResponse({ type: InvestmentHoldingDto })
  async operate(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(InvestmentOperationDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.wealth.operate(requireUuid(id), dto, version, key),
    );
  }
  @Post('holdings/:id/reversal') @ApiOkResponse({ type: InvestmentUndoDto }) undo(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.wealth.undo(requireUuid(id), version, key));
  }
  @Post('items')
  @ApiBody({ type: SaveWealthItemDto })
  @ApiCreatedResponse({ type: WealthItemDto })
  async item(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(SaveWealthItemDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.wealth.saveItem(dto, undefined, undefined, key),
    );
  }
  @Patch('items/:id')
  @ApiBody({ type: SaveWealthItemDto })
  @ApiOkResponse({ type: WealthItemDto })
  async updateItem(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(SaveWealthItemDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.wealth.saveItem(dto, requireUuid(id), version, key),
    );
  }
  @Post('snapshots') @ApiCreatedResponse({ type: WealthHistoryDto }) capture(
    @Req() r: AuthenticatedRequest,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.wealth.capture(key));
  }
}
