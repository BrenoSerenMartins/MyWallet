import type { SourceEvidence } from '../../../core/integration/index.js';
import type { SavedImportItem } from '../contracts/statement.js';
export function importSourceEvidence(
  item: Pick<
    SavedImportItem,
    'sourceOperationId' | 'transactionDate' | 'amount' | 'balanceAfter' | 'metadata' | 'description'
  >,
  reportType: SourceEvidence['reportType'],
): SourceEvidence | null {
  if (!item.sourceOperationId) return null;
  return {
    ruleVersion: reportType === 'settlement' ? 'mercado-pago/edi/4' : 'mercado-pago/account/2',
    reportType,
    description: item.description,
    ...(item.metadata?.storeId ? { storeId: item.metadata.storeId } : {}),
    reference: item.sourceOperationId,
    date: item.transactionDate,
    amount: item.amount,
    originDate:
      reportType === 'settlement'
        ? (item.metadata?.transactionTimestamp.slice(0, 10) ?? null)
        : null,
    balance: reportType === 'account_statement' ? item.balanceAfter : null,
    eventType: reportType === 'settlement' ? (item.metadata?.eventType ?? null) : null,
    timestamp: reportType === 'settlement' ? (item.metadata?.settlementTimestamp ?? null) : null,
    installmentNumber:
      reportType === 'settlement' ? (item.metadata?.installmentNumber ?? null) : null,
  };
}
