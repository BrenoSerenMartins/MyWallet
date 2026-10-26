import { createHash } from 'node:crypto';
export interface SourceEvidence {
  ruleVersion?: string;
  reportType: 'account_statement' | 'settlement';
  reference: string;
  date: string;
  originDate?: string | null;
  amount: number;
  balance: number | null;
  eventType: string | null;
  timestamp: string | null;
  installmentNumber: number | null;
}
export function sourceEvidenceKey(source: SourceEvidence) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'mercado_pago',
        source.reportType,
        source.reference,
        source.date,
        source.amount,
        source.reportType === 'account_statement' ? source.balance : source.eventType,
        source.reportType === 'settlement' && source.timestamp
          ? new Date(source.timestamp).toISOString()
          : null,
        source.reportType === 'settlement' ? source.installmentNumber : null,
      ]),
    )
    .digest('hex');
}
