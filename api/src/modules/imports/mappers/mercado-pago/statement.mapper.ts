import type { ImportEntry, ParsedStatement } from '../../contracts/statement.js';
export const MERCADO_PAGO_MAPPER_VERSION = 'mercado-pago/account-pdf/1';
export function mercadoPagoMapperVersion(
  format: 'pdf' | 'csv' | 'xlsx',
  reportType = 'account_statement',
) {
  if (reportType === 'settlement') return 'mercado-pago/settlement-csv/1';
  return `mercado-pago/account-${format}/1`;
}
export function mapMercadoPago(statement: ParsedStatement): ImportEntry[] {
  return statement.items.map((item) => ({
    ...item,
    transactionType:
      statement.reportType === 'settlement'
        ? 'unclassified'
        : /^Dinheiro (reservado|retirado)/i.test(item.description)
          ? 'transfer'
          : /^Rendimentos/i.test(item.description) && item.amount > 0
            ? 'income'
            : 'unclassified',
  }));
}
