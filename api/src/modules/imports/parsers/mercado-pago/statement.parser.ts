import { UnprocessableEntityException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { dateOnly } from '../../../../core/rest/index.js';
import type { ParsedStatement, StatementRow, TextCell } from '../../contracts/statement.js';
export function parseAmount(text: string): number {
  const value = text.replace(/R\$|\s/g, '').replace('−', '-');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})*),\d{2}$/.test(value))
    throw new UnprocessableEntityException('Valor monetário não reconhecido.');
  const number = BigInt(value.replace(/[.,]/g, ''));
  if (number > BigInt(Number.MAX_SAFE_INTEGER) || number < BigInt(Number.MIN_SAFE_INTEGER))
    throw new UnprocessableEntityException('Valor fora do limite.');
  return Number(number);
}
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
  if (!items.length)
    throw new UnprocessableEntityException('O extrato não contém movimentos legíveis.');
  let balance = openingBalance;
  for (const item of items) {
    balance += item.amount;
    if (!Number.isSafeInteger(balance) || balance !== item.balanceAfter)
      throw new UnprocessableEntityException(
        'O saldo não confere em todas as linhas. Este layout precisa de revisão.',
      );
  }
  if (balance !== closingBalance)
    throw new UnprocessableEntityException('O saldo final não confere.');
  return { openingBalance, closingBalance, items };
}
export async function extractStatement(buffer: Buffer): Promise<ParsedStatement> {
  const pages = await new Promise<TextCell[][]>((resolve, reject) => {
    let received = false;
    const worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), { workerData: buffer });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new UnprocessableEntityException('A leitura excedeu o tempo permitido.'));
    }, 30000);
    worker.once('message', (result) => {
      received = true;
      clearTimeout(timer);
      void worker.terminate();
      if (result.error) reject(new UnprocessableEntityException(result.error));
      else resolve(result.pages);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(new UnprocessableEntityException('Falha ao ler o arquivo.'));
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      if (!received) reject(new UnprocessableEntityException('A leitura foi interrompida.'));
    });
  });
  return parseMercadoPagoPages(pages);
}
