import { csvFixture } from './tabular-fixture.js';
export function settlementFixture(overrides: Record<string, string> = {}) {
  const record = {
    TRANSACTION_DATE: '2026-10-02T23:50:00-04:00',
    SETTLEMENT_DATE: '2026-10-03T00:05:00-04:00',
    SOURCE_ID: 'mp-reference-1',
    PAYMENT_METHOD_TYPE: 'credit_card',
    TRANSACTION_TYPE: 'SETTLEMENT',
    TRANSACTION_AMOUNT: '100.00',
    FEE_AMOUNT: '-3.00',
    REAL_AMOUNT: '97.00',
    TAXES_AMOUNT: '0.00',
    TRANSACTION_DATE_SHORT: '2026-10-02',
    SETTLEMENT_DATE_SHORT: '2026-10-03',
    PAYMENT_METHOD: 'visa',
    TRANSACTION_CURRENCY: 'BRL',
    SETTLEMENT_NET_AMOUNT: '97.00',
    SETTLEMENT_CURRENCY: 'BRL',
    INSTALLMENTS: '3',
    INSTALLMENT_NUMBER: '1',
    DESCRIPTION: 'Synthetic settlement',
    FRANCHISE: 'Visa',
    LAST_FOUR_DIGITS: '0123',
    CARD_INITIAL_NUMBER: '411111',
    METADATA: 'private data that must not be retained',
    ...overrides,
  };
  const rows = [Object.keys(record), Object.values(record)];
  return { rows, buffer: csvFixture(rows) };
}
