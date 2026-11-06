import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class UpdateAccountDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  defaultIncomeCategoryId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsUUID()
  defaultExpenseCategoryId?: string | null;
  @ApiPropertyOptional({ enum: ['received', 'following'] })
  @IsOptional()
  @IsIn(['received', 'following'])
  benefitCreditMonth?: 'received' | 'following';
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
