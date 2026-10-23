import { UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../../../core/rest/index.js';
import type { ParsedStatement, StatementRow, TextCell } from '../../contracts/statement.js';
import { parseAmount } from './statement-values.js';
export { parseAmount } from './statement-values.js';
import { reconcileStatement } from './reconcile-statement.js';
import { readStatementWorker } from '../files/worker-reader.js';
function summary(cells: TextCell[], label: string): number {
  const heading = cells.find((c) => c.text === label);
  if (!heading) throw new UnprocessableEntityException('Resumo do extrato não encontrado.');
  const cell = cells.find((c) => c.x > heading.x && Math.abs(c.y - heading.y) <= 1);
  if (!cell) throw new UnprocessableEntityException('Saldo do extrato não encontrado.');
  return parseAmount(cell.text);
}
function parsePage(cells: TextCell[], page: number, offset: number): StatementRow[] {
  const dates = cells.filter((c) => c.x < 70 && /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(c.text));
  return dates.map((date, index) => {
    const upper = index === 0 ? date.y + 22 : (dates[index - 1].y + date.y) / 2;
    const lower = index === dates.length - 1 ? date.y - 22 : (dates[index + 1].y + date.y) / 2;
    const row = cells.filter((c) => Math.abs(c.y - date.y) <= 1);
    const description = cells
      .filter((c) => c.x >= 85 && c.x < 195 && c.y <= upper && c.y > lower)
      .sort((a, b) => b.y - a.y)
      .map((c) => c.text)
      .join(' ');
    const amount = row.find((c) => c.x >= 280 && c.x < 345);
    const balance = row.find((c) => c.x >= 350);
    const id = row.find((c) => c.x >= 195 && c.x < 260);
    if (!description || !amount || !balance || !id)
      throw new UnprocessableEntityException('Layout não suportado: uma linha está incompleta.');
    const [day, month, year] = date.text.split(/[/-]/);
    return {
      sourceRow: offset + index + 1,
      sourcePage: page,
      transactionDate: dateOnly(`${year}-${month}-${day}`),
      description,
      sourceOperationId: id.text,
      amount: parseAmount(amount.text),
      balanceAfter: parseAmount(balance.text),
    };
  });
}
export function parseMercadoPagoPages(pages: TextCell[][]): ParsedStatement {
  if (
    !pages.length ||
    !pages[0].some((c) => c.text === 'EXTRATO DE CONTA') ||
    !pages.flat().some((c) => /Mercado Pago Institui/.test(c.text))
  )
    throw new UnprocessableEntityException(
      'Este arquivo não é um extrato de conta Mercado Pago reconhecido.',
    );
  const openingBalance = summary(pages[0], 'Saldo inicial:');
  const closingBalance = summary(pages[0], 'Saldo final:');
  const items: StatementRow[] = [];
  for (const [index, cells] of pages.entries())
    items.push(...parsePage(cells, index + 1, items.length));
  return reconcileStatement({ openingBalance, closingBalance, items, sourceFormat: 'pdf' });
}

export async function extractStatement(buffer: Buffer): Promise<ParsedStatement> {
  const result = await readStatementWorker<{ pages: TextCell[][] }>(
    new URL('./pdf-worker.mjs', import.meta.url),
    buffer,
  );
  return parseMercadoPagoPages(result.pages);
}
