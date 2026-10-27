import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateAccountDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ type: String }) @IsString() @Length(1, 80) institution!: string;
  @ApiProperty({ enum: ['checking', 'savings', 'cash', 'reserve', 'benefit_food', 'benefit_meal'] })
  @IsIn(['checking', 'savings', 'cash', 'reserve', 'benefit_food', 'benefit_meal'])
  type!: string;
  @ApiPropertyOptional({ type: Number, deprecated: true })
  @IsOptional()
  @IsInt()
  @Min(-9007199254740991)
  @Max(9007199254740991)
  openingBalance?: number;
  @ApiPropertyOptional({ type: String, deprecated: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  openingDate?: string;
}
