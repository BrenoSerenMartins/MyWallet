import { expect, it } from 'vitest';
import { movementCsv } from '../movement-csv';
import type { Transaction } from '../../../shared/api/resources';
it('exports competence independently of original date and escapes spreadsheet content', () => {
  const row = {
    id: 'entry',
    accountId: 'account',
    categoryId: null,
    transactionDate: '2026-10-31',
    reportingDate: '2026-11-01',
    description: '=HYPERLINK("external";"x")\ncontinued',
    transactionType: 'income',
    amount: 70000,
  } as Transaction;
  const csv = movementCsv([row], [], []);
  expect(csv).toContain('"2026-10-31";"2026-11-01"');
  expect(csv).toContain('"\'=HYPERLINK(""external"";""x"")\ncontinued"');
  expect(csv).toContain('"700,00"');
});
