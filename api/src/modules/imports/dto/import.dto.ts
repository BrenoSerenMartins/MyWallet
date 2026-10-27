import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ReviewItemDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() counterpartyId?:
    string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  counterpartyName?: string | null;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() rememberCategory?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsUUID() refundOfId?:
    string | null;
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() confirmNew?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  linkedTransactionId?: string | null;
  @ApiProperty({ type: Boolean }) @IsBoolean() selected!: boolean;
  @ApiProperty({ type: String })
  @IsIn(['income', 'expense', 'transfer', 'unclassified'])
  transactionType!: 'income' | 'expense' | 'transfer' | 'unclassified';
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() categoryId?: string | null;
}
export class ConfirmImportDto {
  @ApiProperty({ type: Number }) @IsInt() @Min(1) version!: number;
}

export class ReprocessImportDto extends ConfirmImportDto {
  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean() resetClassification?: boolean;
}
