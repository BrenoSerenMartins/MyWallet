import { UnprocessableEntityException } from '@nestjs/common';
import type { ParsedStatement } from '../contracts/statement.js';
import { extractAleloStatement } from '../parsers/alelo/benefit.parser.js';
import { extractMercadoPagoStatement } from '../parsers/mercado-pago/extract-statement.js';
import { mapAlelo } from '../mappers/alelo/benefit.mapper.js';
import {
  mapMercadoPago,
  mercadoPagoMapperVersion,
} from '../mappers/mercado-pago/statement.mapper.js';
export async function extractInstitutionStatement(
  institution: string,
  buffer: Buffer,
  filename: string,
) {
  if (institution === 'mercado_pago') return extractMercadoPagoStatement(buffer, filename);
  if (
    institution === 'alelo' &&
    filename.toLowerCase().endsWith('.pdf') &&
    buffer.subarray(0, 5).toString() === '%PDF-'
  )
    return extractAleloStatement(buffer);
  throw new UnprocessableEntityException(
    'Formato não suportado para esta instituição. Alelo aceita o PDF com texto de Alimentação; Mercado Pago aceita PDF, CSV e XLSX.',
  );
}
export function mapInstitutionStatement(statement: ParsedStatement) {
  return statement.reportType === 'benefit_statement'
    ? mapAlelo(statement)
    : mapMercadoPago(statement);
}
export function statementMapperVersion(statement: ParsedStatement) {
  return statement.reportType === 'benefit_statement'
    ? 'alelo/food-pdf/1'
    : mercadoPagoMapperVersion(statement.sourceFormat ?? 'pdf', statement.reportType);
}
