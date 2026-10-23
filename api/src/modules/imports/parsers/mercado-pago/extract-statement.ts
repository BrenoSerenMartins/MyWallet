import { extractStatement } from './statement.parser.js';
import { statementFileFormat } from '../files/file-format.js';
import { readStatementWorker } from '../files/worker-reader.js';
import { parseMercadoPagoTable, type StatementCell } from './tabular-statement.parser.js';
export async function extractMercadoPagoStatement(buffer: Buffer, filename: string) {
  const format = statementFileFormat(buffer, filename);
  if (format === 'pdf') return extractStatement(buffer);
  const result = await readStatementWorker<{ rows: StatementCell[][] }>(
    new URL('../files/tabular-worker.mjs', import.meta.url),
    { buffer, format },
  );
  return parseMercadoPagoTable(result.rows, format);
}
