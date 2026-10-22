import { ApiProperty } from '@nestjs/swagger';
export class AccountResourceDto {
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
export class CategoryResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: String }) color!: string;
}
export class TransactionResourceDto {
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
export class ImportItemResourceDto {
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
export class ImportBatchResourceDto {
  @ApiProperty({ type: Number }) recordedOpeningBalance!: number;
  @ApiProperty({ type: Boolean }) openingMismatch!: boolean;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) fileName!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number }) openingBalance!: number;
  @ApiProperty({ type: Number }) closingBalance!: number;
  @ApiProperty({ type: () => [ImportItemResourceDto] }) items!: ImportItemResourceDto[];
}
export class DashboardResourceDto {
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
