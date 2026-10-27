import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  NotEquals,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class TransactionDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() counterpartyId?:
    string | null;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  counterpartyName?: string;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() rememberCategory?: boolean;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() rememberCounterparty?: boolean;
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() categoryId?: string | null;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) transactionDate!: string;
  @ApiProperty({ type: String }) @IsString() @Length(1, 500) description!: string;
  @ApiProperty({ type: Number })
  @IsInt()
  @NotEquals(0)
  @Min(-9007199254740991)
  @Max(9007199254740991)
  amount!: number;
  @ApiProperty({ enum: ['income', 'expense'] }) @IsIn(['income', 'expense']) transactionType!:
    'income' | 'expense';
}
export class TransferDto {
  @ApiProperty({ type: String }) @IsUUID() fromAccountId!: string;
  @ApiProperty({ type: String }) @IsUUID() toAccountId!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(9007199254740991) amount!: number;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) transactionDate!: string;
  @ApiProperty({ type: String }) @IsString() @Length(1, 500) description!: string;
}
