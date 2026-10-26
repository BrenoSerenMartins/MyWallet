import type { ImportEntry, ParsedStatement } from '../../contracts/statement.js';
export const MERCADO_PAGO_MAPPER_VERSION = 'mercado-pago/account-pdf/2';
export function mercadoPagoMapperVersion(
  format: 'pdf' | 'csv' | 'xlsx',
  reportType = 'account_statement',
) {
  if (reportType === 'settlement') return 'mercado-pago/settlement-csv/2';
  return `mercado-pago/account-${format}/2`;
}
export function classifyMercadoPagoMovement(item: {
  description: string;
  amount: number;
}): ImportEntry['transactionType'] {
  if (/^(?:Dinheiro (?:reservado|retirado)|Reserva por gastos(?:\s|$))/i.test(item.description))
    return 'transfer';
  if (item.amount > 0) return 'income';
  if (item.amount < 0) return 'expense';
  return 'unclassified';
}
export function mapMercadoPago(statement: ParsedStatement): ImportEntry[] {
  return statement.items.map((item) => ({
    ...item,
    transactionType:
      statement.reportType === 'settlement' ? 'unclassified' : classifyMercadoPagoMovement(item),
  }));
}

export function mercadoPagoSourceFormat(mapperVersion: string): 'pdf' | 'csv' | 'xlsx' {
  return mapperVersion.includes('-csv/')
    ? 'csv'
    : mapperVersion.includes('-xlsx/')
      ? 'xlsx'
      : 'pdf';
}
