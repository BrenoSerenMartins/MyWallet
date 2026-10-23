import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ReviewItemDto {
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
