import { readFile } from 'node:fs/promises';
import { extractStatement } from '../api/dist/modules/imports/parsers/mercado-pago/statement.parser.js';
import { mapMercadoPago } from '../api/dist/modules/imports/mappers/mercado-pago/statement.mapper.js';
if (!process.argv[2])
  throw new Error(
    'Supply a PDF path. This command reads locally and does not write financial records.',
  );
const statement = await extractStatement(await readFile(process.argv[2]));
const items = mapMercadoPago(statement);
console.log({
  movements: items.length,
  reconciled: true,
  reserveTransfers: items.filter((i) => i.transactionType === 'transfer').length,
  unclassified: items.filter((i) => i.transactionType === 'unclassified').length,
});
