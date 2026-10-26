import { describe, expect, it } from 'vitest';
import {
  matchSettlementEvidence,
  type SettlementEvidence,
} from '../services/match-settlement-evidence.js';
import { parseSettlementTable } from '../parsers/mercado-pago/settlement.parser.js';
import { settlementFixture } from './settlement-fixture.js';
const metadata = parseSettlementTable(settlementFixture().rows)[0].metadata;
const source: SettlementEvidence = {
  itemId: 'item-1',
  batchId: 'batch-1',
  fileName: 'settlement.csv',
  date: '2026-10-03',
  amount: 9700,
  reference: 'source-1',
  metadata,
};
const cash = {
  transactionId: 'transaction-1',
  date: source.date,
  amount: source.amount,
  reference: source.reference,
};
describe('Mercado Pago evidence matching', () => {
  it('matches exact original cash evidence and tolerates repeated exports of the same details', () => {
    const matches = matchSettlementEvidence(
      [source, { ...source, itemId: 'item-2', batchId: 'batch-2' }],
      [cash],
    );
    expect(matches.map((match) => match.status)).toEqual(['matched', 'matched']);
    expect(matches[0].transactionId).toBe(cash.transactionId);
  });
  it('never matches by reference alone or guesses a date/amount difference', () => {
    for (const change of [{ reference: 'another' }, { date: '2026-10-04' }, { amount: 10000 }])
      expect(matchSettlementEvidence([source], [{ ...cash, ...change }])[0].status).toBe(
        'unmatched',
      );
  });
  it('blocks duplicate cash occurrences, repeated source occurrences and conflicting metadata across all files', () => {
    expect(
      matchSettlementEvidence([source], [cash, { ...cash, transactionId: 'transaction-2' }])[0]
        .status,
    ).toBe('ambiguous');
    const repeated = [
      source,
      { ...source, itemId: 'repeated' },
      { ...source, batchId: 'other', itemId: 'copy' },
    ];
    expect(
      matchSettlementEvidence(repeated, [cash]).every((match) => match.status === 'ambiguous'),
    ).toBe(true);
    const conflict = { ...source, batchId: 'other', metadata: { ...metadata, fees: -100 } };
    expect(
      matchSettlementEvidence([source, conflict], [cash]).every(
        (match) => match.status === 'ambiguous',
      ),
    ).toBe(true);
  });
  it('keeps unknown events and changed event families out of automatic matching', () => {
    expect(
      matchSettlementEvidence(
        [{ ...source, metadata: { ...metadata, eventType: 'NEW_EVENT' } }],
        [cash],
      )[0],
    ).toMatchObject({ status: 'unsupported', transactionId: null });
    expect(
      matchSettlementEvidence(
        [source, { ...source, batchId: 'other', metadata: { ...metadata, eventType: 'REFUND' } }],
        [cash],
      ).every((match) => match.status === 'ambiguous'),
    ).toBe(true);
  });
});
