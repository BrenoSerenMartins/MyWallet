import { PeriodBudgetDto } from '../../../core/integration/index.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class BudgetLineDto {
  @ApiProperty({ type: String }) @IsUUID() categoryId!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(0) @Max(1000000000000) amount!: number;
}
export class PlannedCardBillDto {
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiProperty({ type: String }) @IsString() @MaxLength(7) billMonth!: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() included!: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  planned?: number | null;
}
export class PlanningCardBillDto {
  @ApiPropertyOptional({ type: Number }) pendingRecurring?: number;
  @ApiProperty({ type: String }) cardId!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) billMonth!: string;
  @ApiProperty({ type: String }) dueDate!: string;
  @ApiProperty({ type: Number }) amount!: number;
  @ApiProperty({ type: Number }) paid!: number;
  @ApiProperty({ type: Number }) remaining!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
  @ApiProperty({ type: Boolean }) included!: boolean;
  @ApiProperty({ type: Number }) planned!: number;
  @ApiProperty({ type: Boolean }) automatic!: boolean;
}
export class SaveMonthlyPlanDto {
  @ApiPropertyOptional({ type: [PlannedCardBillDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PlannedCardBillDto)
  cardPlans?: PlannedCardBillDto[];
  @ApiProperty({ type: Number }) @IsInt() @Min(0) version!: number;
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  contribution!: number | null;
  @ApiProperty({ type: String }) @IsString() @MaxLength(1000) notes!: string;
  @ApiProperty({ type: [BudgetLineDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BudgetLineDto)
  lines!: BudgetLineDto[];
}
export class CopyMonthlyPlanDto {
  @ApiProperty({ type: Number }) @IsInt() @Min(0) version!: number;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) sourceVersion!: number;
}
export class PlanningLineResourceDto {
  @ApiProperty({ type: String, nullable: true }) groupId!: string | null;
  @ApiProperty({ type: String, nullable: true }) groupName!: string | null;
  @ApiProperty({ type: Number, nullable: true }) difference!: number | null;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: ['income', 'expense'] }) type!: 'income' | 'expense';
  @ApiProperty({ type: String }) color!: string;
  @ApiProperty({ type: Number, nullable: true }) planned!: number | null;
  @ApiProperty({ type: Number }) actual!: number;
  @ApiProperty({ type: Number }) transactionCount!: number;
  @ApiProperty({ type: Boolean }) archived!: boolean;
}
export class PlanningTotalsDto {
  @ApiProperty({ type: Number, nullable: true }) incomeDifference!: number | null;
  @ApiProperty({ type: Number, nullable: true }) expenseDifference!: number | null;
  @ApiProperty({ type: Number, nullable: true }) resultDifference!: number | null;
  @ApiProperty({ type: Number, nullable: true }) plannedIncome!: number | null;
  @ApiProperty({ type: Number, nullable: true }) plannedExpense!: number | null;
  @ApiProperty({ type: Number }) actualIncome!: number;
  @ApiProperty({ type: Number }) actualExpense!: number;
  @ApiProperty({ type: Number, nullable: true }) plannedResult!: number | null;
  @ApiProperty({ type: Number }) actualResult!: number;
  @ApiProperty({ type: Number, nullable: true }) afterContribution!: number | null;
  @ApiProperty({ type: Number }) missingCategoryCount!: number;
  @ApiProperty({ type: Number }) unclassifiedCount!: number;
  @ApiProperty({ type: Number }) unclassifiedInflow!: number;
  @ApiProperty({ type: Number }) unclassifiedOutflow!: number;
}
export class PlanningBenefitAccountDto {
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: ['received', 'following'] }) benefitCreditMonth!: 'received' | 'following';
}
export class MonthlyPlanResourceDto {
  @ApiPropertyOptional({ type: [PlannedCardBillDto] }) cardPlans?: PlannedCardBillDto[];
  @ApiPropertyOptional({ type: [PlanningCardBillDto] }) cardBills?: PlanningCardBillDto[];
  @ApiPropertyOptional({ type: PeriodBudgetDto }) budget?: PeriodBudgetDto;
  @ApiPropertyOptional({ type: [PlanningBenefitAccountDto] })
  benefitAccounts?: PlanningBenefitAccountDto[];
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number, nullable: true }) contribution!: number | null;
  @ApiProperty({ type: String }) notes!: string;
  @ApiProperty({ type: [PlanningLineResourceDto] }) lines!: PlanningLineResourceDto[];
  @ApiProperty({ type: PlanningTotalsDto }) totals!: PlanningTotalsDto;
}
