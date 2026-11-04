import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
export class CreateHoldingDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ type: String }) @IsString() @Length(0, 100) provider!: string;
  @ApiProperty({ enum: ['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'] })
  @IsIn(['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'])
  productType!: 'fixed_income' | 'fund' | 'stock' | 'etf' | 'crypto' | 'other';
  @ApiProperty({ type: Number }) @IsInt() @Min(0) @Max(1000000000000) capital!: number;
  @ApiProperty({ type: Number }) @IsInt() @Min(0) @Max(1000000000000) marketValue!: number;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) valuationDate!: string;
}
export class UpdateHoldingDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ type: String }) @IsString() @Length(0, 100) provider!: string;
  @ApiProperty({ enum: ['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'] })
  @IsIn(['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'])
  productType!: CreateHoldingDto['productType'];
  @ApiProperty({ type: Boolean }) @IsBoolean() archived!: boolean;
}
export class InvestmentOperationDto {
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() includedInPosition?: boolean;
  @ApiProperty({ enum: ['contribution', 'redemption', 'income', 'valuation', 'capital'] })
  @IsIn(['contribution', 'redemption', 'income', 'valuation', 'capital'])
  kind!: 'contribution' | 'redemption' | 'income' | 'valuation' | 'capital';
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) date!: string;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  amount?: number;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  capitalRemoved?: number;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  marketValue?: number;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000000)
  capital?: number;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() accountId?: string;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() transactionId?: string;
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(1) transactionVersion?: number;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() categoryId?:
    string | null;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsString() @Length(1, 500) reason?: string;
}
export class SaveWealthItemDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ enum: ['asset', 'debt'] }) @IsIn(['asset', 'debt']) kind!: 'asset' | 'debt';
  @ApiProperty({ type: Number }) @IsInt() @Min(0) @Max(1000000000000) value!: number;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) valuationDate!: string;
  @ApiProperty({ type: String }) @IsString() @Length(0, 500) notes!: string;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() archived?: boolean;
}
