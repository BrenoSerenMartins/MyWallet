import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CommitmentScheduleDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ enum: ['income', 'expense'] }) transactionType!: 'income' | 'expense';
  @ApiProperty({ enum: ['once', 'monthly'] }) frequency!: 'once' | 'monthly';
  @ApiProperty({ type: String }) startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) endedOn!: string | null;
  @ApiProperty({ type: Number }) version!: number;
}
export class CommitmentOccurrenceDto {
  @ApiProperty({ type: String }) scheduleId!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ enum: ['income', 'expense'] }) transactionType!: 'income' | 'expense';
  @ApiProperty({ type: String }) dueDate!: string;
  @ApiProperty({ enum: ['pending', 'overdue', 'review', 'settled', 'skipped'] }) status!:
    'pending' | 'overdue' | 'review' | 'settled' | 'skipped';
  @ApiProperty({ type: String, nullable: true }) transactionId!: string | null;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number, nullable: true }) actualAmount!: number | null;
}
export class CommitmentProjectionDto {
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: ['cash', 'benefits', 'reserves'] }) kind!: 'cash' | 'benefits' | 'reserves';
  @ApiProperty({ type: Number }) balance!: number;
  @ApiProperty({ type: Number }) income!: number;
  @ApiProperty({ type: Number }) expense!: number;
  @ApiProperty({ type: Number }) projected!: number;
  @ApiProperty({ type: Number }) overdue!: number;
}
export class CommitmentsSummaryDto {
  @ApiProperty({ type: String }) today!: string;
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: String }) through!: string;
  @ApiProperty({ type: [CommitmentScheduleDto] }) schedules!: CommitmentScheduleDto[];
  @ApiProperty({ type: [CommitmentOccurrenceDto] }) items!: CommitmentOccurrenceDto[];
  @ApiProperty({ type: Number }) totalItems!: number;
  @ApiProperty({ type: [CommitmentProjectionDto] }) projection!: CommitmentProjectionDto[];
  @ApiProperty({ type: Number }) overdueCount!: number;
  @ApiProperty({ type: Number }) overdueIncome!: number;
  @ApiProperty({ type: Number }) overdueExpense!: number;
}
export class CommitmentCandidateDto {
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) transactionDate!: string;
  @ApiProperty({ type: String }) description!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: String }) transactionType!: string;
}
export class CommitmentResolutionDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) date!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) transactionId?: string | null;
}
