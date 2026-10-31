import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateAccountDto } from './update-account.dto.js';

export const SUPPORTED_ACCOUNT_INSTITUTIONS = ['mercado_pago', 'alelo'] as const;

export class CreateAccountDto extends UpdateAccountDto {
  @ApiProperty({ enum: SUPPORTED_ACCOUNT_INSTITUTIONS })
  @IsIn(SUPPORTED_ACCOUNT_INSTITUTIONS, {
    message: 'Escolha uma instituição disponível: Mercado Pago ou Alelo.',
  })
  declare institution: string;
}
