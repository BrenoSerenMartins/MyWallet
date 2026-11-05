import { ApiProperty } from '@nestjs/swagger';
export class BudgetAccountDto {
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) type!: string;
  @ApiProperty({ type: Number, nullable: true }) openingBankBalance!: number | null;
  @ApiProperty({ type: Number, nullable: true }) closingBankBalance!: number | null;
  @ApiProperty({ type: Number }) deferredOpening!: number;
  @ApiProperty({ type: Number }) deferredClosing!: number;
  @ApiProperty({ type: Number, nullable: true }) carried!: number | null;
  @ApiProperty({ type: Number, nullable: true }) available!: number | null;
  @ApiProperty({ type: Number }) income!: number;
  @ApiProperty({ type: Number }) expense!: number;
  @ApiProperty({ type: Number }) transfers!: number;
  @ApiProperty({ type: Number }) reserved!: number;
  @ApiProperty({ type: Number }) unclassified!: number;
  @ApiProperty({ type: Number, nullable: true }) adjustments!: number | null;
  @ApiProperty({ type: String, nullable: true }) referenceDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) reason!: string | null;
}
export class PeriodBudgetDto {
  @ApiProperty({ type: String }) from!: string;
  @ApiProperty({ type: String }) to!: string;
  @ApiProperty({ enum: ['complete', 'partial', 'unavailable'] }) coverage!: string;
  @ApiProperty({ type: Number, nullable: true }) carried!: number | null;
  @ApiProperty({ type: Number, nullable: true }) available!: number | null;
  @ApiProperty({ type: Number, nullable: true }) adjustments!: number | null;
  @ApiProperty({ type: Number }) income!: number;
  @ApiProperty({ type: Number }) expense!: number;
  @ApiProperty({ type: Number }) transfers!: number;
  @ApiProperty({ type: Number }) reserved!: number;
  @ApiProperty({ type: Number }) unclassified!: number;
  @ApiProperty({ type: [BudgetAccountDto] }) accounts!: BudgetAccountDto[];
}
