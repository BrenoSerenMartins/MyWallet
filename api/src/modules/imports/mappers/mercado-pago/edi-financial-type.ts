import type { ImportEntry, SettlementMetadata } from '../../contracts/statement.js';
const cashEvents = new Set(['SETTLEMENT', 'SETTLEMENT_SHIPPING', 'PAYOUT', 'PAYOUTS', 'CASHBACK']);
const transferEvents = new Set([
  'WITHDRAWAL',
  'WITHDRAWAL_CANCEL',
  'PAYOUTS_CANCEL',
  'CRYPTO_OPERATION',
  'CREDIT',
]);
export function ediFinancialType(
  metadata: SettlementMetadata,
  amount: number,
): ImportEntry['transactionType'] {
  if (!amount) return 'unclassified';
  if (transferEvents.has(metadata.eventType)) return 'transfer';
  if (cashEvents.has(metadata.eventType)) return amount > 0 ? 'income' : 'expense';
  return 'unclassified';
}
export function ediCanPost(metadata: SettlementMetadata, amount: number) {
  if (!amount) return false;
  // Outgoing cash already has an observed net effect. Positive unavailable receipts
  // remain pending until the source proves availability or an existing cash entry matches.
  return amount < 0 || metadata.isReleased === true;
}
