import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreditCardDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String, nullable: true }) paymentAccountId!: string | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) closingDay!: number;
  @ApiProperty({ type: Number }) dueDay!: number;
  @ApiProperty({ type: Number }) limit!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
}
export class CardPurchaseResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) cardId!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: String }) purchaseDate!: string;
  @ApiProperty({ type: String }) firstBillMonth!: string;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: Number }) installments!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) canceled!: boolean;
}
export class CardEntryResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) cardId!: string;
  @ApiProperty({ type: String }) billMonth!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ nullable: true, type: String }) purchaseId!: string | null;
  @ApiProperty({ nullable: true, type: String }) transactionId!: string | null;
  @ApiProperty({ nullable: true, type: Number }) installmentNumber!: number | null;
  @ApiProperty({ enum: ['purchase', 'opening', 'refund'] }) kind!:
    'purchase' | 'opening' | 'refund';
  @ApiProperty({ type: Number }) amount!: number;
  @ApiPropertyOptional({ type: Boolean }) active?: boolean;
}
export class CardPaymentOriginDto {
  @ApiProperty({ type: String }) transactionType!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
}
export class CardPaymentResourceDto {
  @ApiPropertyOptional({ type: CardPaymentOriginDto, nullable: true })
  originalDebit?: CardPaymentOriginDto | null;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) cardId!: string;
  @ApiProperty({ type: String }) billMonth!: string;
  @ApiProperty({ type: String }) paymentDate!: string;
  @ApiProperty({ nullable: true, type: String }) debitId!: string | null;
  @ApiProperty({ nullable: true, type: String }) creditId!: string | null;
  @ApiProperty({ enum: ['create', 'link'] }) mode!: 'create' | 'link';
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) voided!: boolean;
  @ApiPropertyOptional({ type: Boolean }) active?: boolean;
}
export class CardBillResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) cardId!: string;
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: String }) closingDate!: string;
  @ApiProperty({ type: String }) dueDate!: string;
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) paid!: number;
  @ApiProperty({ type: Number }) creditApplied!: number;
  @ApiProperty({ type: Number }) remaining!: number;
  @ApiProperty({ enum: ['open', 'closed', 'overdue', 'paid'] }) state!:
    'open' | 'closed' | 'overdue' | 'paid';
  @ApiProperty({ type: [CardEntryResourceDto] }) entries!: CardEntryResourceDto[];
  @ApiProperty({ type: [CardPaymentResourceDto] }) payments!: CardPaymentResourceDto[];
}
export class CardViewDto extends CreditCardDto {
  @ApiProperty({ type: Number }) balance!: number;
  @ApiProperty({ type: Number }) debt!: number;
  @ApiProperty({ type: Number }) credit!: number;
  @ApiProperty({ type: Number }) availableLimit!: number;
  @ApiProperty({ type: Number }) limitExceeded!: number;
  @ApiProperty({ type: String }) selectedMonth!: string;
  @ApiProperty({ type: [CardBillResourceDto] }) bills!: CardBillResourceDto[];
  @ApiProperty({ type: [CardPurchaseResourceDto] }) purchases!: CardPurchaseResourceDto[];
}
export class CardsSummaryDto {
  @ApiProperty({ type: String }) today!: string;
  @ApiProperty({ type: [CardViewDto] }) cards!: CardViewDto[];
}
export class FinanceActionDto {
  @ApiPropertyOptional({ type: String }) id?: string;
  @ApiPropertyOptional({ type: String }) status?: string;
  @ApiPropertyOptional({ type: String }) mode?: string;
}
