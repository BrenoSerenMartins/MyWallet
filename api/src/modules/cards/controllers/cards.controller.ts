import { ManagedEntryDto } from '../../../core/integration/managed-entry-dto.js';
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
import { CardsService } from '../services/cards.service.js';
import {
  SaveCardDto,
  CardPurchaseDto,
  CardPaymentDto,
  CardTransactionPaymentDto,
  CardOpeningDto,
  CardRefundDto,
  CardCategoryDto,
} from '../dto/cards.dto.js';
import {
  CreditCardDto,
  CardsSummaryDto,
  CardPurchaseResourceDto,
  CardPaymentResourceDto,
  FinanceActionDto,
} from '../dto/cards-resource.dto.js';
@ApiTags('Cards')
@ApiBearerAuth()
@UseGuards(AuthenticatedUserGuard)
@Controller('v1/cards')
export class CardsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CardsService) private readonly cards: CardsService,
  ) {}
  @Get() @ApiOkResponse({ type: CardsSummaryDto }) summary(
    @Req() r: AuthenticatedRequest,
    @Query('month') month?: string,
  ) {
    return this.db.forUser(r.identity.id, () => this.cards.summary(month), true);
  }
  @Post() @ApiBody({ type: SaveCardDto }) @ApiCreatedResponse({ type: CreditCardDto }) async create(
    @Req() r: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(SaveCardDto, body);
    return this.db.forUser(r.identity.id, () => this.cards.create(dto, key));
  }
  @Patch(':id')
  @ApiBody({ type: SaveCardDto })
  @ApiOkResponse({ type: CreditCardDto })
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
  ) {
    const dto = await validateInput(SaveCardDto, body);
    return this.db.forUser(r.identity.id, () => this.cards.update(requireUuid(id), dto, version));
  }
  @Post(':id/bills/:month/transaction-payments')
  @ApiBody({ type: CardTransactionPaymentDto })
  @ApiCreatedResponse({ type: CardPaymentResourceDto })
  async transactionPayment(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('month') month: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const input = await validateInput(CardTransactionPaymentDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.payTransaction(requireUuid(id), month, input, version, key),
    );
  }
  @Post(':id/purchases')
  @ApiBody({ type: CardPurchaseDto })
  @ApiCreatedResponse({ type: CardPurchaseResourceDto })
  async purchase(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(CardPurchaseDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.purchase(requireUuid(id), dto, version, key),
    );
  }
  @Post(':id/opening')
  @ApiBody({ type: CardOpeningDto })
  @ApiCreatedResponse({ type: FinanceActionDto })
  async opening(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(CardOpeningDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.opening(requireUuid(id), dto.billMonth, dto.amount, version, key),
    );
  }
  @Get(':id/candidates') @ApiOkResponse({ type: [ManagedEntryDto] }) candidates(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('accountId') accountId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.db.forUser(
      r.identity.id,
      () => this.cards.candidates(requireUuid(id), requireUuid(accountId), from, to),
      true,
    );
  }
  @Post(':id/bills/:month/payments')
  @ApiBody({ type: CardPaymentDto })
  @ApiCreatedResponse({ type: CardPaymentResourceDto })
  async pay(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('month') month: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(CardPaymentDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.pay(requireUuid(id), month, dto, version, key),
    );
  }
  @Post(':id/payments/:paymentId/reversal') @ApiOkResponse({ type: FinanceActionDto }) undoPayment(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.cards.undoPayment(requireUuid(id), requireUuid(paymentId), version, key),
    );
  }
  @Post(':id/purchases/:purchaseId/reversal')
  @ApiOkResponse({ type: FinanceActionDto })
  cancelPurchase(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.cards.cancelPurchase(requireUuid(id), requireUuid(purchaseId), version, key),
    );
  }
  @Patch(':id/purchases/:purchaseId/category')
  @ApiBody({ type: CardCategoryDto })
  @ApiOkResponse({ type: FinanceActionDto })
  async category(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('purchaseId') purchaseId: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
  ) {
    const dto = await validateInput(CardCategoryDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.category(
        requireUuid(id),
        requireUuid(purchaseId),
        dto.categoryId ?? null,
        version,
      ),
    );
  }
  @Post(':id/refunds')
  @ApiBody({ type: CardRefundDto })
  @ApiCreatedResponse({ type: FinanceActionDto })
  async refund(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    const dto = await validateInput(CardRefundDto, body);
    return this.db.forUser(r.identity.id, () =>
      this.cards.refund(requireUuid(id), dto, version, key),
    );
  }
  @Post(':id/opening/:entryId/reversal') @ApiOkResponse({ type: FinanceActionDto }) cancelOpening(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.cards.cancelOpening(requireUuid(id), requireUuid(entryId), version, key),
    );
  }
  @Post(':id/refunds/:entryId/reversal') @ApiOkResponse({ type: FinanceActionDto }) cancelRefund(
    @Req() r: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Headers('if-match') version: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.db.forUser(r.identity.id, () =>
      this.cards.cancelRefund(requireUuid(id), requireUuid(entryId), version, key),
    );
  }
}
