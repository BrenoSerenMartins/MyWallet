import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class AccountResourceDto {
  @ApiProperty({ type: Boolean }) canEditOpeningPosition!: boolean;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) institution!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) currency!: string;
  @ApiProperty({ type: Number }) openingBalance!: number;
  @ApiProperty({ type: String }) openingDate!: string;
  @ApiProperty({ type: Number }) balance!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
}
export class CategoryGroupResourceDto {
  @ApiProperty({ type: Boolean }) isDefault!: boolean;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) color!: string;
}
export class CategoryResourceDto {
  @ApiProperty({ type: String, nullable: true }) groupId!: string | null;
  @ApiProperty({ type: String, nullable: true }) groupName!: string | null;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) color!: string;
}
export class BalanceAdjustmentResourceDto {
  @ApiProperty({ type: Number }) previousBalance!: number;
  @ApiProperty({ type: Number }) targetBalance!: number;
  @ApiProperty({ type: String }) reason!: string;
}
export class TransactionResourceDto {
  @ApiPropertyOptional({ type: String, nullable: true }) refundOfId?: string | null;
  @ApiPropertyOptional({ type: () => BalanceAdjustmentResourceDto, nullable: true })
  balanceAdjustment?: BalanceAdjustmentResourceDto | null;
  @ApiProperty({ type: String, enum: ['pending', 'reconciled'] }) reconciliationStatus!:
    'pending' | 'reconciled';
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String }) transactionDate!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: String, enum: ['income', 'expense', 'transfer', 'unclassified'] })
  transactionType!: 'income' | 'expense' | 'transfer' | 'unclassified';
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) importBatchId!: string | null;
  @ApiProperty({ type: String, nullable: true }) transferGroupId!: string | null;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ type: Number, nullable: true }) installments!: number | null;
  @ApiProperty({ type: Number, nullable: true }) installmentNumber!: number | null;
  @ApiProperty({ type: String, nullable: true }) merchant!: string | null;
  @ApiProperty({ type: String, nullable: true }) counterparty!: string | null;
  @ApiProperty({ type: String, nullable: true }) sourceOperationId!: string | null;
}
export class SettlementMetadataResourceDto {
  @ApiPropertyOptional({ type: Boolean, nullable: true }) isReleased?: boolean | null;
  @ApiPropertyOptional({ type: String, nullable: true }) releaseTimestamp?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) installmentNetAmount?: number | null;
  @ApiProperty({ type: String }) eventType!: string;
  @ApiProperty({ type: String }) transactionTimestamp!: string;
  @ApiProperty({ type: String }) settlementTimestamp!: string;
  @ApiProperty({ type: String }) currency!: string;
  @ApiProperty({ type: Number }) grossAmount!: number;
  @ApiProperty({ type: Number }) netAmount!: number;
  @ApiProperty({ type: Number, nullable: true }) realAmount!: number | null;
  @ApiProperty({ type: Number, nullable: true }) fees!: number | null;
  @ApiProperty({ type: Number, nullable: true }) taxes!: number | null;
  @ApiProperty({ type: String, nullable: true }) paymentMethod!: string | null;
  @ApiProperty({ type: String, nullable: true }) paymentMethodType!: string | null;
  @ApiProperty({ type: String, nullable: true }) brand!: string | null;
  @ApiProperty({ type: Number, nullable: true }) installments!: number | null;
  @ApiProperty({ type: Number, nullable: true }) installmentNumber!: number | null;
  @ApiProperty({ type: String, nullable: true }) lastFourDigits!: string | null;
}
export class ReconciliationCandidateResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) description!: string;
}
export class ImportItemResourceDto {
  @ApiPropertyOptional({ type: String, nullable: true }) refundOfId?: string | null;
  @ApiProperty({ type: () => [ReconciliationCandidateResourceDto] })
  refundCandidates!: ReconciliationCandidateResourceDto[];
  @ApiProperty({ type: Boolean }) confirmNew!: boolean;
  @ApiProperty({ type: String, enum: ['create', 'reconcile', 'recorded', 'review', 'ignore'] })
  action!: 'create' | 'reconcile' | 'recorded' | 'review' | 'ignore';
  @ApiProperty({ type: String }) actionReason!: string;
  @ApiProperty({ type: String, nullable: true }) linkedTransactionId!: string | null;
  @ApiProperty({ type: () => [ReconciliationCandidateResourceDto] })
  candidateDescriptions!: ReconciliationCandidateResourceDto[];
  @ApiProperty({ type: Boolean }) duplicateLocked!: boolean;
  @ApiProperty({ type: String, nullable: true, enum: ['recorded', 'same_statement', 'similar'] })
  duplicateReason!: 'recorded' | 'same_statement' | 'similar' | null;
  @ApiProperty({ type: () => SettlementMetadataResourceDto, nullable: true })
  metadata!: SettlementMetadataResourceDto | null;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: Number }) sourceRow!: number;
  @ApiProperty({ type: String }) transactionDate!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: String, nullable: true }) sourceOperationId!: string | null;
  @ApiProperty({ type: String, enum: ['income', 'expense', 'transfer', 'unclassified'] })
  transactionType!: 'income' | 'expense' | 'transfer' | 'unclassified';
  @ApiProperty({ type: Boolean }) selected!: boolean;
  @ApiProperty({ type: Boolean }) duplicateCandidate!: boolean;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
}
export class PreviousImportResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String, enum: ['draft', 'history'] }) status!: 'draft' | 'history';
  @ApiProperty({ type: String }) firstDate!: string;
  @ApiProperty({ type: String }) lastDate!: string;
}
export class ImportBatchResourceDto {
  @ApiPropertyOptional({ type: Boolean }) willInitializeOpening?: boolean;
  @ApiProperty({ type: String }) institution!: string;
  @ApiProperty({ type: String, enum: ['running_balance', 'partial'] }) reconciliationCapability!:
    'running_balance' | 'partial';
  @ApiProperty({ type: Boolean }) canReprocess!: boolean;
  @ApiProperty({ type: Boolean }) canAdjustOpeningPosition!: boolean;
  @ApiProperty({ type: Number, nullable: true }) openingDifference!: number | null;
  @ApiProperty({ type: () => [PreviousImportResourceDto] })
  previousImports!: PreviousImportResourceDto[];
  @ApiProperty({ type: String, enum: ['account_statement', 'settlement', 'benefit_statement'] })
  reportType!: 'account_statement' | 'settlement' | 'benefit_statement';
  @ApiProperty({ type: Boolean }) canIntegrate!: boolean;
  @ApiProperty({ type: String, enum: ['pdf', 'csv', 'xlsx'] }) sourceFormat!:
    'pdf' | 'csv' | 'xlsx';
  @ApiProperty({ type: String }) accountOpeningDate!: string;
  @ApiProperty({ type: String, nullable: true }) statementStartDate!: string | null;
  @ApiProperty({ type: Boolean }) openingDateMismatch!: boolean;
  @ApiProperty({ type: Number }) recordedOpeningBalance!: number;
  @ApiProperty({ type: Boolean }) openingMismatch!: boolean;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number, nullable: true }) openingBalance!: number | null;
  @ApiProperty({ type: Number, nullable: true }) closingBalance!: number | null;
  @ApiProperty({ type: () => [ImportItemResourceDto] }) items!: ImportItemResourceDto[];
}
export class DashboardResourceDto {
  @ApiProperty({ type: Number }) benefitBalance!: number;
  @ApiProperty({ type: Number }) reserveBalance!: number;
  @ApiProperty({ type: Number }) recordedResources!: number;
  @ApiProperty({ type: Number }) balance!: number;
  @ApiProperty({ type: Number }) income!: number;
  @ApiProperty({ type: Number }) expense!: number;
  @ApiProperty({ type: Number }) unclassified!: number;
  @ApiProperty({ type: () => [AccountResourceDto] }) accounts!: AccountResourceDto[];
  @ApiProperty({ type: String }) from!: string;
  @ApiProperty({ type: String }) to!: string;
  @ApiProperty({ type: String }) coverage!: string;
}
export class TransactionCollectionDto {
  @ApiProperty({ type: () => [TransactionResourceDto] }) items!: TransactionResourceDto[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}

export class CategoryGroupDeletionResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) categoryCount!: number;
  @ApiProperty({ type: String }) destinationGroupId!: string;
  @ApiProperty({ type: String }) destinationGroupName!: string;
  @ApiProperty({ type: [String] }) conflictingNames!: string[];
}

export class SettlementMatchResourceDto {
  @ApiProperty({ type: String }) itemId!: string;
  @ApiProperty({ type: String }) batchId!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String, enum: ['matched', 'ambiguous', 'unmatched', 'unsupported'] })
  status!: 'matched' | 'ambiguous' | 'unmatched' | 'unsupported';
  @ApiProperty({ type: String, nullable: true }) transactionId!: string | null;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: () => SettlementMetadataResourceDto })
  metadata!: SettlementMetadataResourceDto;
}
