import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
export class SaveCommitmentDto {
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() categoryId?:
    string | null;
  @ApiProperty({ type: String }) @IsString() @Length(1, 120) description!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiProperty({ enum: ['income', 'expense'] }) @IsIn(['income', 'expense']) transactionType!:
    'income' | 'expense';
  @ApiProperty({ enum: ['once', 'monthly'] }) @IsIn(['once', 'monthly']) frequency!:
    'once' | 'monthly';
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) startDate!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string | null;
}
export class SettleCommitmentDto {
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(1) transactionVersion?: number;
  @ApiProperty({ enum: ['link', 'create', 'skip', 'reopen'] })
  @IsIn(['link', 'create', 'skip', 'reopen'])
  action!: 'link' | 'create' | 'skip' | 'reopen';
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() transactionId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsISO8601({ strict: true })
  transactionDate?: string;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  amount?: number;
}
