import { readFile } from 'node:fs/promises';
import { extractMercadoPagoStatement } from '../api/dist/modules/imports/parsers/mercado-pago/extract-statement.js';
import { basename } from 'node:path';
import { mapMercadoPago } from '../api/dist/modules/imports/mappers/mercado-pago/statement.mapper.js';
if (!process.argv[2])
  throw new Error(
    'Supply a PDF, CSV or XLSX path. This command reads locally and does not write financial records.',
  );
const statement = await extractMercadoPagoStatement(
  await readFile(process.argv[2]),
  basename(process.argv[2]),
);
const items = mapMercadoPago(statement);
console.log({
  format: statement.sourceFormat,
  movements: items.length,
  reconciled: true,
  reserveTransfers: items.filter((i) => i.transactionType === 'transfer').length,
  unclassified: items.filter((i) => i.transactionType === 'unclassified').length,
});
