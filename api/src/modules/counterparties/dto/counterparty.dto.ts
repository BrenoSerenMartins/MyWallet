export { CounterpartyCandidateDto } from '../../../core/integration/counterparty-candidate-dto.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, Length, IsOptional, IsUUID, IsIn } from 'class-validator';
export class CreateCounterpartyDto {
  @ApiProperty({ type: String }) @IsString() @Length(1, 150) name!: string;
}
export class UpdateCounterpartyDto extends CreateCounterpartyDto {
  @ApiProperty({ type: Boolean }) @IsBoolean() enabled!: boolean;
}
export class ToggleRuleDto {
  @ApiPropertyOptional({ type: String }) @IsOptional() @IsUUID() categoryId?: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() enabled!: boolean;
}
export class IdentifierResourceDto {
  @ApiPropertyOptional({ type: String, enum: ['description', 'store_id'] }) identifierKind?:
    'description' | 'store_id';
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) counterpartyId!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ enum: ['manual', 'account_statement', 'settlement', 'benefit_statement'] })
  sourceKind!: string;
  @ApiProperty({ type: String }) value!: string;
}
export class RuleResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) counterpartyId!: string;
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ enum: ['income', 'expense'] }) transactionType!: string;
  @ApiProperty({ type: String }) categoryId!: string;
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: Number }) version!: number;
}
export class CounterpartyResourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: () => [IdentifierResourceDto] }) identifiers!: IdentifierResourceDto[];
  @ApiProperty({ type: () => [RuleResourceDto] }) rules!: RuleResourceDto[];
}

export class CounterpartyRelationDto {
  @ApiPropertyOptional({ type: String, enum: ['description', 'store_id'] })
  @IsOptional()
  @IsIn(['description', 'store_id'])
  identifierKind?: 'description' | 'store_id';
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiProperty({
    type: String,
    enum: ['manual', 'account_statement', 'settlement', 'benefit_statement'],
  })
  @IsIn(['manual', 'account_statement', 'settlement', 'benefit_statement'])
  sourceKind!: 'manual' | 'account_statement' | 'settlement' | 'benefit_statement';
  @ApiProperty({ type: String }) @IsString() @Length(1, 500) value!: string;
  @ApiProperty({ type: String, enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  transactionType!: 'income' | 'expense';
  @ApiProperty({ type: String }) @IsUUID() categoryId!: string;
}

export class CounterpartyIdentifierDto {
  @ApiProperty({ type: String }) @IsUUID() accountId!: string;
  @ApiProperty({ enum: ['manual', 'account_statement', 'benefit_statement'] })
  @IsIn(['manual', 'account_statement', 'benefit_statement'])
  sourceKind!: 'manual' | 'account_statement' | 'benefit_statement';
  @ApiProperty({ type: String }) @IsString() @Length(3, 500) value!: string;
}
export class CounterpartyLookupDto extends CounterpartyIdentifierDto {}
