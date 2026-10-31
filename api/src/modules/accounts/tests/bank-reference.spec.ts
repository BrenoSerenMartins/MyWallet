import { expect, it } from 'vitest';
import {
  coveredReferences,
  newestReference,
  type BankReference,
} from '../services/bank-reference.js';
function reference(key: string, keys: string[], date = '2026-10-30'): BankReference {
  return {
    importId: key,
    key,
    date,
    amount: 100,
    rows: keys.map((key) => ({ date, key, transactionId: null })),
  };
}
it('proves the latest endpoint across transitive source overlap regardless of upload order', () => {
  const a = reference('b', ['a', 'b']),
    b = reference('c', ['b', 'c']),
    c = reference('d', ['c', 'd']);
  for (const items of [
    [a, b, c],
    [c, a, b],
    [b, c, a],
  ]) {
    expect(newestReference(items).reference).toBe(c);
    expect(coveredReferences(c, items).size).toBe(3);
  }
});
it('rejects incompatible same-day order instead of breaking a cycle with file identity', () => {
  expect(newestReference([reference('b', ['a', 'b']), reference('a', ['b', 'a'])])).toEqual({
    reference: null,
    conflict: true,
  });
});
it('accepts identical endpoints and chronological dates but does not order unrelated same-day positions', () => {
  const older = reference('a', ['a'], '2026-01-01'),
    latest = reference('b', ['b']);
  expect(newestReference([latest, older]).reference).toBe(latest);
  expect(newestReference([latest, reference('b', ['a', 'b'])]).conflict).toBe(false);
  expect(newestReference([latest, reference('c', ['c'])]).conflict).toBe(true);
});
