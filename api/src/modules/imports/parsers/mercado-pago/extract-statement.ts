import { extractStatement } from './statement.parser.js';
import { statementFileFormat } from '../files/file-format.js';
import { readStatementWorker } from '../files/worker-reader.js';
import { parseMercadoPagoTable, type StatementCell } from './tabular-statement.parser.js';
import { isSettlementHeader, parseSettlementTable } from './settlement.parser.js';
import { mapMercadoPagoSettlements } from '../../mappers/mercado-pago/settlement.mapper.js';
export async function extractMercadoPagoStatement(buffer: Buffer, filename: string) {
  const format = statementFileFormat(buffer, filename);
  if (format === 'pdf') return extractStatement(buffer);
  const result = await readStatementWorker<{ rows: StatementCell[][] }>(
    new URL('../files/tabular-worker.mjs', import.meta.url),
    { buffer, format },
  );
  if (format === 'csv' && isSettlementHeader(result.rows[0] ?? []))
    return mapMercadoPagoSettlements(parseSettlementTable(result.rows));
  return parseMercadoPagoTable(result.rows, format);
}
