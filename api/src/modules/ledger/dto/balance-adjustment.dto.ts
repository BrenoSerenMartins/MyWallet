import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Min, Max } from 'class-validator';
export class BalanceAdjustmentDto {
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
