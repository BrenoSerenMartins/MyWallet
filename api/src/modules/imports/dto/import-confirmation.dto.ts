import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ImportConfirmationDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) status!: string;
  @ApiPropertyOptional({ type: Number }) count?: number;
  @ApiPropertyOptional({ type: Number }) reconciled?: number;
  @ApiPropertyOptional({ type: Number }) skippedDuplicates?: number;
  @ApiPropertyOptional({ type: Number }) balanceBefore?: number;
  @ApiPropertyOptional({ type: Number }) balanceAfter?: number;
  @ApiPropertyOptional({ type: String }) referenceStatus?: string;
}
