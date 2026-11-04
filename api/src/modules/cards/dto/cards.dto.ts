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
export class SaveCardDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ type: String }) @IsUUID() paymentAccountId!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(31) closingDay!: number;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(31) dueDay!: number;
  @ApiProperty({ type: Number }) @IsInt() @Min(0) @Max(1000000000000) limit!: number;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() archived?: boolean;
}
export class CardPurchaseDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 120) description!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() categoryId?:
    string | null;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) purchaseDate!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(120) installments!: number;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Length(7, 7)
  firstBillMonth?: string;
}
export class CardPaymentDto {
  @ApiProperty({ enum: ['create', 'link'] }) @IsIn(['create', 'link']) mode!: 'create' | 'link';
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiProperty({ type: String }) @IsISO8601({ strict: true }) date!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() transactionId?: string;
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(1) transactionVersion?: number;
}
export class CardOpeningDto {
  @ApiProperty({ type: String }) @IsString() @Length(7, 7) billMonth!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
}
export class CardRefundDto {
  @ApiProperty({ type: String }) @IsUUID() entryId!: string;
  @ApiProperty({ type: String }) @IsString() @Length(7, 7) billMonth!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(1) @Max(1000000000000) amount!: number;
}
export class CardCategoryDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() categoryId?:
    string | null;
}
