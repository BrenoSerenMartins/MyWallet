import { expect, it } from 'vitest';
import { reconcileStatement } from '../parsers/mercado-pago/reconcile-statement.js';
import type { ParsedStatement } from '../contracts/statement.js';
const row = {
  sourceRow: 1,
  sourcePage: 1,
  transactionDate: '2026-01-01',
  description: 'Purchase',
  sourceOperationId: null,
  amount: -1000,
  balanceAfter: null,
};
it('accepts statement movements without starting, ending or running balances', () => {
  const statement: ParsedStatement = { openingBalance: null, closingBalance: null, items: [row] };
  expect(reconcileStatement(statement, { credits: 0, debits: -1000 })).toBe(statement);
  expect(() => reconcileStatement(statement, { credits: 0, debits: -900 })).toThrow('totais');
});
it('checks balances when supplied without requiring absent balance columns', () => {
  const statement: ParsedStatement = {
    openingBalance: 3000,
    closingBalance: null,
    items: [row, { ...row, sourceRow: 2, transactionDate: '2026-01-02', balanceAfter: 1000 }],
  };
  expect(reconcileStatement(statement)).toBe(statement);
  expect(() => reconcileStatement({ ...statement, closingBalance: 999 })).toThrow('saldo final');
  expect(() =>
    reconcileStatement({
      ...statement,
      items: [row, { ...statement.items[1], balanceAfter: 2000 }],
    }),
  ).toThrow('saldo não confere');
});
