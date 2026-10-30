import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';
export class BalanceAdjustmentDto {
  @ApiPropertyOptional({ type: Number }) @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(-9007199254740991)
  @Max(9007199254740991)
  targetBalance!: number;
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(-9007199254740991)
  @Max(9007199254740991)
  expectedBalance!: number;
  @ApiProperty({ type: String }) @IsString() @Length(1, 500) reason!: string;
}
