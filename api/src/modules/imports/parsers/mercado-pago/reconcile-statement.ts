import { UnprocessableEntityException } from '@nestjs/common';
import type { ParsedStatement } from '../../contracts/statement.js';
export function reconcileStatement(
  statement: ParsedStatement,
  totals?: { credits: number; debits: number },
): ParsedStatement {
  if (!statement.items.length || statement.items.length > 10000)
    throw new UnprocessableEntityException(
      'O extrato deve conter entre 1 e 10.000 movimentos legíveis.',
    );
  let balance = statement.openingBalance === null ? null : BigInt(statement.openingBalance),
    credits = 0n,
    debits = 0n;
  let previous = '';
  for (const item of statement.items) {
    if (item.transactionDate < previous)
      throw new UnprocessableEntityException(
        'As datas do extrato estão fora de ordem. Não é possível conferir os saldos.',
      );
    previous = item.transactionDate;
    if (!Number.isSafeInteger(item.amount))
      throw new UnprocessableEntityException('Valor fora do limite.');
    if (balance !== null) balance += BigInt(item.amount);
    if (item.balanceAfter !== null && balance !== null && balance !== BigInt(item.balanceAfter))
      throw new UnprocessableEntityException(
        `O saldo não confere na linha de origem ${item.sourceRow}. Revise o arquivo.`,
      );
    if (item.balanceAfter !== null) balance = BigInt(item.balanceAfter);
    if (balance !== null && !Number.isSafeInteger(Number(balance)))
      throw new UnprocessableEntityException('Saldo fora do limite.');
    if (item.amount > 0) credits += BigInt(item.amount);
    else debits += BigInt(item.amount);
  }
  if (
    statement.closingBalance !== null &&
    balance !== null &&
    balance !== BigInt(statement.closingBalance)
  )
    throw new UnprocessableEntityException('O saldo final não confere.');
  if (totals && (credits !== BigInt(totals.credits) || debits !== BigInt(totals.debits)))
    throw new UnprocessableEntityException(
      'Os totais de entradas e saídas não conferem com os movimentos.',
    );
  return statement;
}
