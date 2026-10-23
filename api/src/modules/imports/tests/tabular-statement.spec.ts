import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { extractMercadoPagoStatement } from '../parsers/mercado-pago/extract-statement.js';
import { parseMercadoPagoTable } from '../parsers/mercado-pago/tabular-statement.parser.js';
import { statementFileFormat } from '../parsers/files/file-format.js';
import { parseDecimalAmount } from '../parsers/mercado-pago/statement-values.js';
import {
  mapMercadoPago,
  mercadoPagoMapperVersion,
} from '../mappers/mercado-pago/statement.mapper.js';
import { csvFixture, sampleRows, xlsxFixture } from './tabular-fixture.js';
describe('Mercado Pago account CSV and XLSX reports', () => {
  it('reads CSV with BOM, quoted delimiters/newlines and full repeated references', async () => {
    const rows = structuredClone(sampleRows);
    rows[5][1] = 'Pix recebido "Exemplo"; com\ndescrição';
    const statement = await extractMercadoPagoStatement(
      Buffer.concat([Buffer.from('\uFEFF'), csvFixture(rows)]),
      'statement.CSV',
    );
    expect(statement.sourceFormat).toBe('csv');
    expect(statement.items).toHaveLength(2);
    expect(statement.items[1].description).toBe('Pix recebido "Exemplo"; com descrição');
    expect(statement.items[0].sourceOperationId).toBe('123456789012345678');
    expect(statement.items[0].sourceOperationId).toBe(statement.items[1].sourceOperationId);
    expect(statement.items[0].sourceRow).toBe(5);
    expect(mapMercadoPago(statement).map((item) => item.transactionType)).toEqual([
      'transfer',
      'income',
    ]);
  });
  it('supports comma-delimited CSV with quoted Brazilian amounts', async () => {
    const statement = await extractMercadoPagoStatement(
      csvFixture(sampleRows, ','),
      'statement.csv',
    );
    expect(statement.items.map((i) => i.amount)).toEqual([-500, 2000]);
    expect(statement.closingBalance).toBe(11500);
  });
  it('reads XLSX string cells and exact native numeric cells without rounding references', async () => {
    const rows: (string | { numeric: string })[][] = structuredClone(sampleRows);
    rows[1] = [{ numeric: '100' }, { numeric: '20' }, { numeric: '-5' }, { numeric: '115' }];
    rows[4] = [
      '01-10-2026',
      'Dinheiro reservado Reserva',
      { numeric: '123456789012345678' },
      { numeric: '-5' },
      { numeric: '95' },
    ];
    rows[5] = [
      '02-10-2026',
      'Pix recebido Exemplo',
      { numeric: '123456789012345678' },
      { numeric: '20' },
      { numeric: '115' },
    ];
    const result = await extractMercadoPagoStatement(xlsxFixture(rows), 'statement.xlsx');
    expect(result.items).toEqual(parseMercadoPagoTable(sampleRows, 'csv').items);
    expect(result.sourceFormat).toBe('xlsx');
    expect(mercadoPagoMapperVersion('xlsx')).not.toBe(mercadoPagoMapperVersion('csv'));
  });
  it('rejects incorrect running balances, summary totals and incomplete rows', () => {
    for (const [row, column, value] of [
      [4, 4, '94,00'],
      [1, 1, '21,00'],
      [1, 3, '114,00'],
      [4, 3, ''],
      [4, 1, ''],
      [4, 2, '1.23E+17'],
      [4, 0, '31-02-2026'],
    ] as const) {
      const rows = structuredClone(sampleRows);
      rows[row][column] = value;
      expect(() => parseMercadoPagoTable(rows, 'csv')).toThrow();
    }
  });
  it('rejects unrelated reports, descending dates, duplicate/missing headers and excessive records', () => {
    expect(() => parseMercadoPagoTable([['SALE_ID'], ['1'], [], ['TRANSACTION']], 'csv')).toThrow(
      'não suportado',
    );
    const missing = structuredClone(sampleRows);
    missing[3][0] = 'OTHER';
    expect(() => parseMercadoPagoTable(missing, 'csv')).toThrow();
    const duplicate = structuredClone(sampleRows);
    duplicate[3].push('REFERENCE_ID');
    expect(() => parseMercadoPagoTable(duplicate, 'csv')).toThrow();
    const descending = structuredClone(sampleRows);
    descending[5][0] = '01-09-2026';
    expect(() => parseMercadoPagoTable(descending, 'csv')).toThrow('ordem');
    expect(() =>
      parseMercadoPagoTable(
        Array.from({ length: 10011 }, () => []),
        'xlsx',
      ),
    ).toThrow('excede');
  });
  it('refuses malformed CSV, invalid UTF-8, corrupted/multi-sheet XLSX and oversized archives', async () => {
    await expect(
      extractMercadoPagoStatement(Buffer.from('"unterminated'), 'statement.csv'),
    ).rejects.toThrow('Não foi possível ler');
    await expect(
      extractMercadoPagoStatement(Buffer.from([0xff, 0xfe]), 'statement.csv'),
    ).rejects.toThrow('Não foi possível ler');
    await expect(
      extractMercadoPagoStatement(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]), 'statement.xlsx'),
    ).rejects.toThrow();
    await expect(
      extractMercadoPagoStatement(xlsxFixture(sampleRows, true), 'statement.xlsx'),
    ).rejects.toThrow();
    const archive = Buffer.from(
      zipSync({
        'xl/workbook.xml': strToU8('dummy'),
        'large.xml': new Uint8Array(9 * 1024 * 1024),
      }),
    );
    await expect(extractMercadoPagoStatement(archive, 'statement.xlsx')).rejects.toThrow();
  });
  it('does not accept renamed files, legacy XLS, empty/oversized input or fractional cents', () => {
    expect(() => statementFileFormat(Buffer.from('%PDF-test'), 'renamed.csv')).toThrow();
    expect(() => statementFileFormat(csvFixture(), 'statement.pdf')).toThrow();
    expect(() => statementFileFormat(xlsxFixture(), 'statement.xls')).toThrow();
    expect(() => statementFileFormat(Buffer.alloc(0), 'statement.csv')).toThrow();
    expect(() =>
      statementFileFormat(Buffer.alloc(10 * 1024 * 1024 + 1), 'statement.csv'),
    ).toThrow();
    expect(parseDecimalAmount('-1234.56')).toBe(-123456);
    expect(parseDecimalAmount('0.1')).toBe(10);
    expect(() => parseDecimalAmount('1.234')).toThrow();
    expect(() => parseDecimalAmount('9007199254740992')).toThrow();
  });
});
