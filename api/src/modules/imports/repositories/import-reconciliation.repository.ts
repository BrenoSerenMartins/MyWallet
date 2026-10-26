import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type { SourceEvidence } from '../../../core/integration/index.js';
export interface ReconciliationCandidate {
  id: string;
  reference: string | null;
  date: string;
  amount: number;
  description: string;
  modified: boolean;
  evidence: { key: string; data: SourceEvidence }[];
  source: SourceEvidence | null;
}
@Injectable()
export class ImportReconciliationRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async refundOrigins(accountId: string, to: string) {
    const rows = await this.db.query(
      `SELECT t.id,t.description,t.category_id,t.transaction_type,t.amount_minor,t.transaction_date,t.source_operation_id,
      abs(t.amount_minor)-coalesce((SELECT sum(abs(r.amount_minor)) FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL),0) AS remaining
      FROM wallet.transactions t WHERE t.user_id=$1 AND t.account_id=$2 AND t.reversed_at IS NULL AND t.refund_of_id IS NULL AND t.balance_adjustment IS NULL AND t.transaction_type IN ('income','expense') AND t.transaction_date<=$3 ORDER BY t.transaction_date DESC,t.id LIMIT 20001`,
      [this.db.userId, accountId, to],
    );
    return rows.map((row) => ({
      id: row.id,
      description: row.description,
      categoryId: row.category_id as string | null,
      transactionType: row.transaction_type as 'income' | 'expense',
      amount: Number(row.amount_minor),
      remaining: Number(row.remaining),
      date: isoDate(row.transaction_date),
      reference: row.source_operation_id as string | null,
    }));
  }
  async candidates(accountId: string, references: string[], from: string, to: string) {
    const rows = await this.db.query(
      `SELECT t.id,t.description,t.amount_minor AS current_amount,t.transaction_date AS current_date,coalesce(i.source_operation_id,t.source_operation_id) AS reference,
       coalesce(i.transaction_date,t.transaction_date) AS original_date,coalesce(i.amount_minor,t.amount_minor) AS original_amount,
       i.balance_after_minor,b.report_type,i.report_metadata,
       coalesce((SELECT jsonb_agg(jsonb_build_object('key',s.source_key,'data',s.source_data)) FROM wallet.transaction_sources s WHERE s.transaction_id=t.id),'[]'::jsonb) AS evidence
       FROM wallet.transactions t LEFT JOIN wallet.import_items i ON i.batch_id=t.import_batch_id AND i.source_row=t.source_row
       LEFT JOIN wallet.import_batches b ON b.id=t.import_batch_id
       WHERE t.user_id=$1 AND t.account_id=$2 AND t.reversed_at IS NULL AND t.balance_adjustment IS NULL
       AND (coalesce(i.source_operation_id,t.source_operation_id)=ANY($3::text[])
        OR coalesce(i.transaction_date,t.transaction_date) BETWEEN $4 AND $5
        OR EXISTS(SELECT 1 FROM wallet.transaction_sources s WHERE s.transaction_id=t.id AND s.source_data->>'reference'=ANY($3::text[])))
       ORDER BY t.id LIMIT 20001`,
      [this.db.userId, accountId, references, from, to],
    );
    return rows.map((row) => {
      const source: SourceEvidence | null =
        row.reference && row.report_type
          ? {
              reportType: row.report_type,
              reference: row.reference,
              date: isoDate(row.original_date),
              amount: Number(row.original_amount),
              balance: row.balance_after_minor == null ? null : Number(row.balance_after_minor),
              eventType: row.report_metadata?.eventType ?? null,
              timestamp:
                row.report_type === 'settlement'
                  ? (row.report_metadata?.settlementTimestamp ?? null)
                  : null,
              installmentNumber: row.report_metadata?.installmentNumber ?? null,
            }
          : null;
      return {
        id: row.id,
        modified:
          Number(row.current_amount) !== Number(row.original_amount) ||
          isoDate(row.current_date) !== isoDate(row.original_date),
        reference: row.reference,
        date: isoDate(row.original_date),
        amount: Number(row.original_amount),
        description: row.description,
        source,
        evidence: row.evidence as { key: string; data: SourceEvidence }[],
      };
    });
  }
  async link(batchId: string, itemId: string, transactionId: string, sourceKey: string | null) {
    await this.db.query(
      `UPDATE wallet.import_items i SET linked_transaction_id=t.id,source_key=$5 FROM wallet.transactions t, wallet.import_batches b
      WHERE i.user_id=$1 AND i.batch_id=$2 AND i.id=$3 AND b.id=i.batch_id AND t.id=$4 AND t.account_id=b.account_id AND t.reversed_at IS NULL`,
      [this.db.userId, batchId, itemId, transactionId, sourceKey],
    );
  }
}
