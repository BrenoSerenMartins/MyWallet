import { UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../../../core/rest/index.js';
import type { ParsedStatement, StatementRow, TextCell } from '../../contracts/statement.js';
import { parseAmount } from '../files/statement-values.js';
import { readStatementWorker } from '../files/worker-reader.js';
export function parseAleloPages(pages: TextCell[][]): ParsedStatement {
  if (
    !pages.length ||
    !pages[0].some((cell) => /^Extrato Alelo Alimentação\s*$/.test(cell.text.trim()))
  )
    throw new UnprocessableEntityException(
      'Use o PDF com texto do extrato Alelo Alimentação. Outros modelos ainda não são suportados.',
    );
  const items: StatementRow[] = [];
  for (const [pageIndex, cells] of pages.entries()) {
    const dates = cells
      .filter((cell) => /^\d{2}\/\d{2}\/\d{4}$/.test(cell.text.trim()))
      .sort((a, b) => b.y - a.y);
    for (const [index, date] of dates.entries()) {
      const upper = index === 0 ? date.y + 20 : dates[index - 1].y - 1;
      const description = cells
        .filter(
          (cell) =>
            Math.abs(cell.x - date.x) <= 3 &&
            cell.y > date.y + 1 &&
            cell.y <= upper &&
            !/^\d{2}\/\d{2}\/\d{4}$/.test(cell.text.trim()),
        )
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((cell) => cell.text.trim())
        .join(' ');
      const amounts = cells.filter(
        (cell) =>
          cell.x > date.x + 100 &&
          Math.abs(cell.y - date.y) <= 7 &&
          /^-?\s*R\$\s*[\d.,]+$/.test(cell.text.trim()),
      );
      if (!description || description.length > 500 || amounts.length !== 1)
        throw new UnprocessableEntityException(
          'Uma linha do extrato Alelo está incompleta ou ambígua. Nenhum movimento foi importado.',
        );
      const [day, month, year] = date.text.trim().split('/');
      items.push({
        sourcePage: pageIndex + 1,
        sourceRow: items.length + 1,
        transactionDate: dateOnly(`${year}-${month}-${day}`),
        description,
        amount: parseAmount(amounts[0].text.replace(/R\$\s*/, '').replace(/\s/g, '')),
        sourceOperationId: null,
        balanceAfter: null,
      });
    }
    const amounts = cells.filter(
      (cell) =>
        /^-?\s*R\$\s*[\d.,]+$/.test(cell.text.trim()) &&
        dates.some((date) => cell.x > date.x + 100 && Math.abs(cell.y - date.y) <= 7),
    );
    if (amounts.length !== dates.length)
      throw new UnprocessableEntityException('As linhas e valores do extrato Alelo não conferem.');
  }
  if (!items.length || items.length > 10000)
    throw new UnprocessableEntityException('O extrato Alelo deve conter de 1 a 10.000 movimentos.');
  items.sort(
    (a, b) => a.transactionDate.localeCompare(b.transactionDate) || b.sourceRow - a.sourceRow,
  );
  return {
    institution: 'alelo',
    reportType: 'benefit_statement',
    sourceFormat: 'pdf',
    openingBalance: null,
    closingBalance: null,
    items,
  };
}
export async function extractAleloStatement(buffer: Buffer) {
  const result = await readStatementWorker<{ pages: TextCell[][] }>(
    new URL('../mercado-pago/pdf-worker.mjs', import.meta.url),
    buffer,
  );
  return parseAleloPages(result.pages);
}
