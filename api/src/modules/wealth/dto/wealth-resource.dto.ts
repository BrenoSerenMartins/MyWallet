import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class InvestmentHoldingDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) provider!: string;
  @ApiProperty({ type: String }) valuationDate!: string;
  @ApiProperty({ type: String }) openedDate!: string;
  @ApiProperty({ enum: ['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'] }) productType!:
    'fixed_income' | 'fund' | 'stock' | 'etf' | 'crypto' | 'other';
  @ApiProperty({ nullable: true, type: String }) lastEventId!: string | null;
  @ApiProperty({ enum: ['manual', 'flow_estimate'] }) valuationMethod!: 'manual' | 'flow_estimate';
  @ApiProperty({ type: Number }) capital!: number;
  @ApiProperty({ type: Number }) marketValue!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
}
export class InvestmentEventDto {
  @ApiPropertyOptional({ type: Number }) effectiveAmount?: number;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) holdingId!: string;
  @ApiProperty({ type: String }) eventDate!: string;
  @ApiProperty({ type: String }) createdAt!: string;
  @ApiProperty({
    enum: ['contribution', 'redemption', 'income', 'valuation', 'capital', 'edit', 'undo'],
  })
  kind!: 'contribution' | 'redemption' | 'income' | 'valuation' | 'capital' | 'edit' | 'undo';
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: Number }) capitalRemoved!: number;
  @ApiProperty({ type: InvestmentHoldingDto }) beforeState!: InvestmentHoldingDto;
  @ApiProperty({ type: Object, additionalProperties: true }) details!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: String }) debitId!: string | null;
  @ApiProperty({ nullable: true, type: String }) creditId!: string | null;
  @ApiProperty({ nullable: true, type: String }) resultId!: string | null;
  @ApiProperty({ nullable: true, type: String }) linkedId!: string | null;
  @ApiProperty({ nullable: true, type: String }) undoOfId!: string | null;
  @ApiProperty({ type: Boolean }) undone!: boolean;
}
export class InvestmentViewDto extends InvestmentHoldingDto {
  @ApiProperty({ type: String }) movementFromDate!: string;
  @ApiProperty({ type: Number }) unrealized!: number;
  @ApiProperty({ type: Number }) realized!: number;
  @ApiProperty({ type: Number }) totalResult!: number;
  @ApiProperty({ type: Boolean }) stale!: boolean;
  @ApiProperty({ type: [InvestmentEventDto] }) events!: InvestmentEventDto[];
}
export class WealthItemDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) valuationDate!: string;
  @ApiProperty({ type: String }) notes!: string;
  @ApiProperty({ enum: ['asset', 'debt'] }) kind!: 'asset' | 'debt';
  @ApiProperty({ type: Number }) value!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
}
export class WealthTotalsDto {
  @ApiProperty({ type: String }) asOf!: string;
  @ApiProperty({ type: Number }) assets!: number;
  @ApiProperty({ type: Number }) liabilities!: number;
  @ApiProperty({ type: Number }) netWorth!: number;
  @ApiProperty({ type: Number }) cash!: number;
  @ApiProperty({ type: Number }) reserves!: number;
  @ApiProperty({ type: Number }) investments!: number;
  @ApiProperty({ type: Number }) otherAssets!: number;
  @ApiProperty({ type: Number }) cardCredit!: number;
  @ApiProperty({ type: Number }) cardDebt!: number;
  @ApiProperty({ type: Number }) overdrafts!: number;
  @ApiProperty({ type: Number }) otherDebts!: number;
  @ApiProperty({ type: Number }) benefitsExcluded!: number;
}
export class WealthHistoryDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) createdAt!: string;
  @ApiProperty({ type: String }) kind!: string;
  @ApiProperty({ type: WealthTotalsDto }) data!: WealthTotalsDto;
}
export class WealthSummaryDto extends WealthTotalsDto {
  @ApiProperty({ type: [InvestmentViewDto] }) holdings!: InvestmentViewDto[];
  @ApiProperty({ type: [WealthItemDto] }) items!: WealthItemDto[];
  @ApiProperty({ type: [WealthHistoryDto] }) history!: WealthHistoryDto[];
}
export class InvestmentUndoDto {
  @ApiProperty({ type: InvestmentHoldingDto }) holding!: InvestmentHoldingDto;
  @ApiProperty({ type: Boolean }) preservedBankMovement!: boolean;
}
