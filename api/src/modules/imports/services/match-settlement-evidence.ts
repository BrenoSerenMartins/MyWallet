import type { SettlementMetadata } from '../contracts/statement.js';
export interface SettlementEvidence {
  itemId: string;
  batchId: string;
  fileName: string;
  date: string;
  amount: number;
  reference: string;
  metadata: SettlementMetadata;
}
export interface CashEvidence {
  transactionId: string;
  date: string;
  amount: number;
  reference: string;
}
// These families support evidence matching only, not automatic financial classification.
const supportedEvents = new Set([
  'SETTLEMENT',
  'PAYOUT',
  'PAYOUTS',
  'WITHDRAWAL',
  'CASHBACK',
  'CREDIT',
  'CRYPTO_OPERATION',
  'REFUND',
  'PAYOUTS_CANCEL',
  'WITHDRAWAL_CANCEL',
  'CHARGEBACK',
  'DISPUTE',
]);
function cashIdentity(item: { reference: string; date: string; amount: number }) {
  return JSON.stringify([item.reference, item.date, item.amount]);
}
function metadataIdentity(metadata: SettlementMetadata) {
  return JSON.stringify(Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b)));
}
export function matchSettlementEvidence(evidence: SettlementEvidence[], cash: CashEvidence[]) {
  const cashGroups = new Map<string, CashEvidence[]>();
  const occurrences = new Map<string, number>();
  const ambiguousKeys = new Set<string>();
  const eventGroups = new Map<string, Set<string>>();
  for (const entry of cash) {
    const key = cashIdentity(entry);
    const group = cashGroups.get(key) ?? [];
    group.push(entry);
    cashGroups.set(key, group);
  }
  for (const entry of evidence) {
    const key = cashIdentity(entry);
    const occurrence = JSON.stringify([key, entry.batchId]);
    occurrences.set(occurrence, (occurrences.get(occurrence) ?? 0) + 1);
    if (occurrences.get(occurrence)! > 1) ambiguousKeys.add(key);
    const group = eventGroups.get(key) ?? new Set<string>();
    group.add(metadataIdentity(entry.metadata));
    eventGroups.set(key, group);
  }
  return evidence.map((entry) => {
    const candidates = cashGroups.get(cashIdentity(entry)) ?? [];
    const supported = supportedEvents.has(entry.metadata.eventType);
    const ambiguous =
      ambiguousKeys.has(cashIdentity(entry)) ||
      candidates.length > 1 ||
      (eventGroups.get(cashIdentity(entry))?.size ?? 0) > 1;
    const status = !supported
      ? 'unsupported'
      : ambiguous
        ? 'ambiguous'
        : candidates.length === 1
          ? 'matched'
          : 'unmatched';
    const reasons = {
      unsupported: 'Evento ainda sem regra de correspondência.',
      ambiguous:
        'Há mais de uma operação ou evidências diferentes para a mesma referência, data e valor.',
      matched:
        'Referência, data de aprovação e valor líquido correspondem a um único lançamento do extrato.',
      unmatched:
        'Nenhum lançamento confirmado corresponde à referência, data de aprovação e valor líquido.',
    };
    return {
      itemId: entry.itemId,
      batchId: entry.batchId,
      fileName: entry.fileName,
      metadata: entry.metadata,
      status,
      transactionId: status === 'matched' ? candidates[0].transactionId : null,
      reason: reasons[status],
    };
  });
}
