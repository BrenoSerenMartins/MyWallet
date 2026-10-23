import type { ParsedStatement } from '../../contracts/statement.js';
import type { SettlementSourceRow } from '../../parsers/mercado-pago/settlement.parser.js';
export function mapMercadoPagoSettlements(rows: SettlementSourceRow[]): ParsedStatement {
  return {
    reportType: 'settlement',
    sourceFormat: 'csv',
    openingBalance: null,
    closingBalance: null,
    items: rows.map((row) => ({
      sourceRow: row.sourceRow,
      sourcePage: 1,
      sourceOperationId: row.sourceOperationId,
      transactionDate: row.metadata.settlementTimestamp.slice(0, 10),
      amount: row.metadata.netAmount,
      balanceAfter: null,
      description: row.description ?? `Mercado Pago · ${row.metadata.eventType}`,
      metadata: row.metadata,
    })),
  };
}
