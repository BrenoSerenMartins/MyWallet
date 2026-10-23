import { UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../../../core/rest/index.js';
import type { StatementRow, ParsedStatement } from '../../contracts/statement.js';
import { parseAmount, parseDecimalAmount, statementDate } from './statement-values.js';
import { reconcileStatement } from './reconcile-statement.js';
export type StatementCell = string | null | boolean | { numeric: string } | { date: string };
const summaryColumns = ['INITIAL_BALANCE', 'CREDITS', 'DEBITS', 'FINAL_BALANCE'];
const transactionColumns = [
  'RELEASE_DATE',
  'TRANSACTION_TYPE',
  'REFERENCE_ID',
  'TRANSACTION_NET_AMOUNT',
  'PARTIAL_BALANCE',
];
const blank = (cell: StatementCell) => cell === null || (typeof cell === 'string' && !cell.trim());
function headerIndexes(row: StatementCell[], expected: string[]): Map<string, number> {
  const headers = row.map((cell) =>
    typeof cell === 'string' ? cell.trim().replace(/^\uFEFF/, '') : '',
  );
  if (
    expected.some((name) => headers.filter((header) => header === name).length !== 1) ||
    headers.some((header) => header && !expected.includes(header))
  )
    throw new UnprocessableEntityException(
      'Relatório não suportado: use o extrato de conta Mercado Pago com saldos e movimentos, não um relatório de vendas ou de cartão.',
    );
  return new Map(expected.map((name) => [name, headers.indexOf(name)]));
}
function amount(cell: StatementCell): number {
  if (typeof cell === 'string') return parseAmount(cell);
  if (cell && typeof cell === 'object' && 'numeric' in cell)
    return parseDecimalAmount(cell.numeric);
  throw new UnprocessableEntityException('Valor monetário ausente ou inválido no extrato.');
}
function reference(cell: StatementCell): string {
  const value =
    typeof cell === 'string'
      ? cell.trim()
      : cell && typeof cell === 'object' && 'numeric' in cell
        ? cell.numeric
        : '';
  if (!/^\d{1,160}$/.test(value))
    throw new UnprocessableEntityException(
      'Referência da operação ausente ou inválida. Exporte os identificadores completos, sem notação científica.',
    );
  return value;
}
function sourceDate(cell: StatementCell): string {
  if (typeof cell === 'string') return statementDate(cell.trim());
  if (cell && typeof cell === 'object' && 'date' in cell) return dateOnly(cell.date);
  throw new UnprocessableEntityException('Data inválida no extrato.');
}
function transaction(
  row: StatementCell[],
  columns: Map<string, number>,
  sourceRow: number,
): StatementRow {
  if (row.some((cell, index) => !blank(cell) && ![...columns.values()].includes(index)))
    throw new UnprocessableEntityException(`Colunas não reconhecidas na linha ${sourceRow}.`);
  const get = (name: string) => row[columns.get(name)!] ?? null;
  const description = get('TRANSACTION_TYPE');
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 500)
    throw new UnprocessableEntityException(
      `Descrição ausente ou muito longa na linha ${sourceRow}.`,
    );
  return {
    sourceRow,
    sourcePage: 1,
    transactionDate: sourceDate(get('RELEASE_DATE')),
    description: description.trim().replace(/\s+/g, ' '),
    sourceOperationId: reference(get('REFERENCE_ID')),
    amount: amount(get('TRANSACTION_NET_AMOUNT')),
    balanceAfter: amount(get('PARTIAL_BALANCE')),
  };
}
export function parseMercadoPagoTable(
  rows: StatementCell[][],
  sourceFormat: 'csv' | 'xlsx',
): ParsedStatement {
  if (rows.length < 3 || rows.length > 10010)
    throw new UnprocessableEntityException('O relatório está vazio ou excede 10.000 movimentos.');
  const summary = headerIndexes(rows[0], summaryColumns);
  const totals = rows[1];
  if (totals.some((cell, index) => !blank(cell) && ![...summary.values()].includes(index)))
    throw new UnprocessableEntityException('Colunas extras no resumo do extrato.');
  const total = (name: string) => amount(totals[summary.get(name)!] ?? null);
  const header = rows.findIndex((row, index) => index > 1 && row.some((cell) => !blank(cell)));
  if (header < 0)
    throw new UnprocessableEntityException('A tabela de movimentos não foi encontrada.');
  const columns = headerIndexes(rows[header], transactionColumns);
  const items = rows
    .slice(header + 1)
    .flatMap((row, index) =>
      row.every(blank) ? [] : [transaction(row, columns, header + index + 2)],
    );
  return reconcileStatement(
    {
      openingBalance: total('INITIAL_BALANCE'),
      closingBalance: total('FINAL_BALANCE'),
      items,
      sourceFormat,
    },
    { credits: total('CREDITS'), debits: total('DEBITS') },
  );
}
