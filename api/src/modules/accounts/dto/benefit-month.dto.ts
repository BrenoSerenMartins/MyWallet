import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
export class BenefitMonthDto {
  @ApiProperty({ enum: ['received', 'following'] })
  @IsIn(['received', 'following'])
  benefitCreditMonth!: 'received' | 'following';
}
