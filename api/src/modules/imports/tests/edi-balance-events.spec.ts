import { expect, it } from 'vitest';
import { parseSettlementTable } from '../parsers/mercado-pago/settlement.parser.js';
import { settlementFixture } from './settlement-fixture.js';
import { ediCanPost, ediFinancialType } from '../mappers/mercado-pago/edi-financial-type.js';
import { ediEventExplanation } from '../mappers/mercado-pago/edi-event.js';
function metadata(overrides: Record<string, string> = {}) {
  return parseSettlementTable(
    settlementFixture({
      TRANSACTION_TYPE: 'SETTLEMENT',
      TRANSACTION_AMOUNT: '0.19',
      SETTLEMENT_NET_AMOUNT: '0.19',
      REAL_AMOUNT: '0.19',
      FEE_AMOUNT: '0.00',
      TAXES_AMOUNT: '0.00',
      PAYMENT_METHOD: '',
      PAYMENT_METHOD_TYPE: '',
      FRANCHISE: '',
      INSTALLMENTS: '1',
      INSTALLMENT_NUMBER: '',
      LAST_FOUR_DIGITS: '',
      IS_RELEASED: 'false',
      ...overrides,
    }).rows,
  )[0].metadata;
}
it('accepts direct balance inflows even when the payment release flag is false or absent', () => {
  for (const value of ['false', '']) {
    const source = metadata({ IS_RELEASED: value });
    expect(ediCanPost(source, source.netAmount)).toBe(true);
    expect(ediFinancialType(source, source.netAmount)).toBe('income');
    expect(
      ediEventExplanation(source.eventType, source.isReleased, source.netAmount, source),
    ).toBeNull();
  }
});
it('does not confuse scheduled receipts, payment events, fees or installments with direct balance events', () => {
  const cases: Record<string, string>[] = [
    { PAYMENT_METHOD_TYPE: 'credit_card' },
    { PAYMENT_METHOD: 'visa' },
    { FRANCHISE: 'Visa' },
    { MONEY_RELEASE_DATE: '2026-10-10T12:00:00-04:00' },
    { INSTALLMENTS: '3' },
    { INSTALLMENT_NUMBER: '1' },
    { INSTALLMENT_NET_AMOUNT: '0.19' },
    { TRANSACTION_AMOUNT: '1.00' },
    { FEE_AMOUNT: '-0.01' },
    { TAXES_AMOUNT: '-0.01' },
    { TRANSACTION_TYPE: 'CREDIT' },
    { TRANSACTION_TYPE: 'DISPUTE' },
  ];
  for (const change of cases) {
    const source = metadata(change);
    expect(ediCanPost(source, source.netAmount), JSON.stringify(change)).toBe(false);
  }
});
it('preserves released-payment, outgoing and zero-value policies', () => {
  expect(ediCanPost(metadata({ PAYMENT_METHOD: 'visa', IS_RELEASED: 'true' }), 19)).toBe(true);
  expect(ediCanPost(metadata({ SETTLEMENT_NET_AMOUNT: '-0.19' }), -19)).toBe(true);
  expect(
    ediCanPost(metadata({ TRANSACTION_AMOUNT: '0.00', SETTLEMENT_NET_AMOUNT: '0.00' }), 0),
  ).toBe(false);
});
