import { isDirectEdiBalanceEvent } from './edi-balance-event.js';
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
  if (
    ['SETTLEMENT', 'SETTLEMENT_SHIPPING'].includes(metadata.eventType) &&
    metadata.installmentNumber != null &&
    metadata.installmentNetAmount != null &&
    Math.abs(metadata.installmentNetAmount) !== Math.abs(amount)
  )
    return false;
  // Payment availability and direct balance events are distinct source concepts.
  return amount < 0 || metadata.isReleased === true || isDirectEdiBalanceEvent(metadata);
}
