import { strToU8, zipSync } from 'fflate';
export const tableHeaders = [
  'RELEASE_DATE',
  'TRANSACTION_TYPE',
  'REFERENCE_ID',
  'TRANSACTION_NET_AMOUNT',
  'PARTIAL_BALANCE',
];
export const sampleRows = [
  ['INITIAL_BALANCE', 'CREDITS', 'DEBITS', 'FINAL_BALANCE'],
  ['100,00', '20,00', '-5,00', '115,00'],
  [],
  tableHeaders,
  ['01-10-2026', 'Dinheiro reservado Reserva', '123456789012345678', '-5,00', '95,00'],
  ['02-10-2026', 'Pix recebido Exemplo', '123456789012345678', '20,00', '115,00'],
];
export function csvFixture(rows: unknown[][] = sampleRows, delimiter = ';') {
  return Buffer.from(
    rows
      .map((row) =>
        row.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(delimiter),
      )
      .join('\r\n'),
    'utf8',
  );
}
type Cell = string | { numeric: string };
const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function xlsxFixture(rows: Cell[][] = sampleRows, extra = false) {
  const worksheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}"${typeof value === 'string' ? ' t="inlineStr"' : ''}>${typeof value === 'string' ? `<is><t>${escape(value)}</t></is>` : `<v>${escape(value.numeric)}</v>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files = {
    '[Content_Types].xml': strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
    ),
    'xl/workbook.xml': strToU8(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Account" sheetId="1" r:id="rId1"/>${extra ? '<sheet name="Other" sheetId="2" r:id="rId2"/>' : ''}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${extra ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' : ''}</Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(worksheet),
    ...(extra ? { 'xl/worksheets/sheet2.xml': strToU8(worksheet) } : {}),
  };
  return Buffer.from(zipSync(files));
}
