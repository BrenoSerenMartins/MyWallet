import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BalanceBasis } from './balance-basis.js';
export class BalanceBasisDto {
  @ApiProperty({ enum: ['unknown', 'legacy', 'statement', 'manual'] }) kind!: BalanceBasis['kind'];
  @ApiPropertyOptional({ type: String }) referenceDate?: string;
  @ApiPropertyOptional({ type: Number }) referenceBalance?: number;
  @ApiPropertyOptional({ type: String }) originId?: string;
  @ApiPropertyOptional({ type: String }) importId?: string;
  @ApiPropertyOptional({ type: Boolean }) reviewRequired?: boolean;
  @ApiPropertyOptional({ enum: ['same_day', 'statement_conflict'] }) reviewReason?:
    'same_day' | 'statement_conflict';
}
export class BalanceHistoryDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ enum: ['manual', 'statement', 'rebase', 'undo', 'legacy_conversion'] })
  operation!: string;
  @ApiProperty({ type: Number }) previousBase!: number;
  @ApiProperty({ type: Number }) newBase!: number;
  @ApiProperty({ type: () => BalanceBasisDto }) previousBasis!: BalanceBasisDto;
  @ApiProperty({ type: () => BalanceBasisDto }) newBasis!: BalanceBasisDto;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) details!: Record<string, unknown>;
  @ApiProperty({ type: String, nullable: true }) undoOfId!: string | null;
  @ApiProperty({ type: String }) createdAt!: string;
}
