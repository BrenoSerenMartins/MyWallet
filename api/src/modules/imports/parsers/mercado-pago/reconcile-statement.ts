import { UnprocessableEntityException } from '@nestjs/common';
import type { ParsedStatement } from '../../contracts/statement.js';
export function reconcileStatement(
  statement: ParsedStatement,
  totals?: { credits: number; debits: number },
): ParsedStatement {
  if (statement.openingBalance === null || statement.closingBalance === null)
    throw new UnprocessableEntityException('Este relatório não fornece saldos para conciliação.');
  if (!statement.items.length || statement.items.length > 10000)
    throw new UnprocessableEntityException(
      'O extrato deve conter entre 1 e 10.000 movimentos legíveis.',
    );
  let balance = BigInt(statement.openingBalance),
    credits = 0n,
    debits = 0n;
  let previous = '';
  for (const item of statement.items) {
    if (item.transactionDate < previous)
      throw new UnprocessableEntityException(
        'As datas do extrato estão fora de ordem. Não é possível conferir os saldos.',
      );
    previous = item.transactionDate;
    balance += BigInt(item.amount);
    if (item.balanceAfter === null || balance !== BigInt(item.balanceAfter))
      throw new UnprocessableEntityException(
        `O saldo não confere na linha de origem ${item.sourceRow}. Revise o arquivo.`,
      );
    if (!Number.isSafeInteger(Number(balance)))
      throw new UnprocessableEntityException('Saldo fora do limite.');
    if (item.amount > 0) credits += BigInt(item.amount);
    else debits += BigInt(item.amount);
  }
  if (balance !== BigInt(statement.closingBalance))
    throw new UnprocessableEntityException('O saldo final não confere.');
  if (totals && (credits !== BigInt(totals.credits) || debits !== BigInt(totals.debits)))
    throw new UnprocessableEntityException(
      'Os totais de entradas e saídas não conferem com os movimentos.',
    );
  return statement;
}
