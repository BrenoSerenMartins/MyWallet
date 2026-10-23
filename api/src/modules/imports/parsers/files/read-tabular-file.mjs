import { parse } from 'csv-parse/sync';
import readExcelFile from 'read-excel-file/universal';
import { Open } from 'unzipper-esm';
function readCsvRows(buffer) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
  const delimiter = header.includes(';') ? ';' : ',';
  return parse(text, {
    delimiter,
    bom: true,
    relax_column_count: true,
    relax_quotes: header.includes('SOURCE_ID') && header.includes('SETTLEMENT_NET_AMOUNT'),
    max_record_size: 65536,
    skip_empty_lines: false,
  });
}
async function assertWorkbookLimits(buffer) {
  const archive = await Open.buffer(buffer);
  if (archive.files.length > 256 || !archive.files.some((file) => file.path === 'xl/workbook.xml'))
    throw new Error('Unsupported workbook.');
  let expanded = 0;
  for (const file of archive.files) {
    expanded += file.uncompressedSize;
    if (file.uncompressedSize > 8 * 1024 * 1024 || expanded > 32 * 1024 * 1024 || file.flags & 1)
      throw new Error('Workbook exceeds limits.');
  }
}
async function readWorkbookRows(buffer) {
  await assertWorkbookLimits(buffer);
  const sheets = await readExcelFile(new Uint8Array(buffer).buffer, {
    parseNumber: (value) => ({ numeric: value }),
    trim: false,
  });
  if (sheets.length !== 1) throw new Error('Expected one account statement sheet.');
  return sheets[0].data.map((row) =>
    row.map((cell) => (cell instanceof Date ? { date: cell.toISOString().slice(0, 10) } : cell)),
  );
}
export async function readTabularFile(buffer, format) {
  const rows = format === 'csv' ? readCsvRows(buffer) : await readWorkbookRows(buffer);
  if (rows.length > 10010 || rows.some((row) => row.length > (format === 'csv' ? 96 : 32)))
    throw new Error('Too many rows or columns.');
  return rows;
}
