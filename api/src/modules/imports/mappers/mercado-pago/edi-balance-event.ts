import type { SettlementMetadata } from '../../contracts/statement.js';
// Account-money exports also use SETTLEMENT for non-payment balance events.
// IS_RELEASED is not sufficient to classify those as receivables.
export function isDirectEdiBalanceEvent(metadata: SettlementMetadata) {
  return (
    metadata.eventType === 'SETTLEMENT' &&
    !metadata.storeName &&
    !metadata.storeId &&
    !metadata.paymentMethod &&
    !metadata.paymentMethodType &&
    !metadata.brand &&
    !metadata.releaseTimestamp &&
    !metadata.installmentNumber &&
    (metadata.installments == null || metadata.installments === 1) &&
    metadata.installmentNetAmount == null &&
    metadata.grossAmount === metadata.netAmount &&
    (metadata.fees == null || metadata.fees === 0) &&
    (metadata.taxes == null || metadata.taxes === 0)
  );
}
