import { BadRequestException, PreconditionFailedException } from '@nestjs/common';
export function requireVersion(actual: number, expected: unknown) {
  if (Number(String(expected ?? '').replaceAll('"', '')) !== actual)
    throw new PreconditionFailedException('Este registro mudou. Atualize a tela antes de salvar.');
}
export function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new BadRequestException('Identificador inválido.');
  return value;
}
export function exactAmount(value: number) {
  if (!Number.isSafeInteger(value))
    throw new BadRequestException('Valor fora do intervalo permitido.');
  return value;
}
export function dateOnly(value: string): string {
  const parsed = new Date(value + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Data inválida.');
  return value;
}
export function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
