import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  Length,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsISO8601,
  IsIn,
  IsUUID,
} from 'class-validator';
export class SaveGoalDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) target!: number;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  deadline?: string | null;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(3) priority!: number;
  @ApiPropertyOptional({ enum: ['active', 'completed', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'completed', 'archived'])
  status?: 'active' | 'completed' | 'archived';
}
export class AllocateGoalDto {
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiProperty({ enum: ['allocate', 'release'] }) @IsIn(['allocate', 'release']) action!:
    'allocate' | 'release';
}
export class GoalAllocationDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) goalId!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: Number }) delta!: number;
  @ApiProperty({ type: String, nullable: true }) reverseOfId!: string | null;
  @ApiProperty({ type: String }) createdAt!: string;
  @ApiProperty({ type: String }) actorId!: string;
}
export class GoalResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) target!: number;
  @ApiProperty({ type: String, nullable: true }) deadline!: string | null;
  @ApiProperty({ type: Number }) priority!: number;
  @ApiProperty({ enum: ['active', 'completed', 'archived'] }) status!:
    'active' | 'completed' | 'archived';
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: Number }) allocated!: number;
  @ApiProperty({ type: Number }) remaining!: number;
  @ApiProperty({ type: Number }) progress!: number;
  @ApiProperty({ type: Number, nullable: true }) monthlyPace!: number | null;
  @ApiProperty({ type: Boolean }) underfunded!: boolean;
  @ApiProperty({ type: [GoalAllocationDto] }) allocations!: GoalAllocationDto[];
}
export class GoalAccountDto {
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Number }) balance!: number;
  @ApiProperty({ type: Number }) allocated!: number;
  @ApiProperty({ type: Number }) free!: number;
  @ApiProperty({ type: Number }) deficit!: number;
}
export class GoalsSummaryDto {
  @ApiProperty({ type: [GoalResourceDto] }) goals!: GoalResourceDto[];
  @ApiProperty({ type: [GoalAccountDto] }) accounts!: GoalAccountDto[];
  @ApiProperty({ type: Number }) allocated!: number;
}
