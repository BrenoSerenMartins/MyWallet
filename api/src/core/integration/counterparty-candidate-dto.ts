import { ApiProperty } from '@nestjs/swagger';
export class CounterpartyCandidateDto {
  @ApiProperty({ type: String }) counterpartyId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: ['name', 'abbreviation', 'similar_description'] }) reason!:
    'name' | 'abbreviation' | 'similar_description';
}
