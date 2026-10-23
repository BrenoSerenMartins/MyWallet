import { it, expect } from 'vitest';
import { detectDuplicates, type DuplicateSource } from '../services/duplicate-detection.js';
const row: DuplicateSource = {
  transactionDate: '2026-10-23',
  amount: -1000,
  description: 'Market',
  sourceOperationId: 'ref',
  balanceAfter: 9000,
};
it('blocks exact copies and within-file repeats but keeps distinct source balances and references', () => {
  expect(
    detectDuplicates(
      [row, row, { ...row, balanceAfter: 8000 }, { ...row, sourceOperationId: 'different' }],
      [row],
    ),
  ).toEqual(['recorded', 'same_statement', null, null]);
});
it('keeps a possible manual match reviewable and never treats identical descriptions alone as proof', () => {
  expect(
    detectDuplicates([row], [{ ...row, sourceOperationId: null, balanceAfter: null }]),
  ).toEqual(['similar']);
  expect(detectDuplicates([{ ...row, sourceOperationId: null }], [])).toEqual([null]);
});
