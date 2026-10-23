import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
export class SaveMonthlyPlanDto {
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
export class MonthlyPlanResourceDto {
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number, nullable: true }) contribution!: number | null;
  @ApiProperty({ type: String }) notes!: string;
  @ApiProperty({ type: [PlanningLineResourceDto] }) lines!: PlanningLineResourceDto[];
  @ApiProperty({ type: PlanningTotalsDto }) totals!: PlanningTotalsDto;
}
