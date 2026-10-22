import type { ImportEntry, ParsedStatement } from '../../contracts/statement.js';
export const MERCADO_PAGO_MAPPER_VERSION = 'mercado-pago/account-pdf/1';
export function mapMercadoPago(statement: ParsedStatement): ImportEntry[] {
  return statement.items.map((item) => ({
    ...item,
    transactionType: /^Dinheiro (reservado|retirado)/i.test(item.description)
      ? 'transfer'
      : /^Rendimentos/i.test(item.description) && item.amount > 0
        ? 'income'
        : 'unclassified',
  }));
}
