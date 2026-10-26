import { UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../../../core/rest/index.js';
export function parseAmount(text: string): number {
  const value = text.replace(/R\$|\s/g, '').replace('−', '-');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})*),\d{2}$/.test(value))
    throw new UnprocessableEntityException('Valor monetário não reconhecido.');
  return checkedMinorUnits(BigInt(value.replace(/[.,]/g, '')));
}
export function checkedMinorUnits(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
    throw new UnprocessableEntityException('Valor fora do limite.');
  return Number(value);
}
export function parseDecimalAmount(text: string): number {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text))
    throw new UnprocessableEntityException('Valor numérico da planilha não reconhecido.');
  const [integer, fraction = ''] = text.replace('-', '').split('.');
  return checkedMinorUnits(
    (BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'))) * (text.startsWith('-') ? -1n : 1n),
  );
}
export function statementDate(text: string): string {
  if (!/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(text))
    throw new UnprocessableEntityException('Data do extrato não reconhecida.');
  const [day, month, year] = text.split(/[/-]/);
  return dateOnly(`${year}-${month}-${day}`);
}
