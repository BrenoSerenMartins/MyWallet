import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type { SettlementEvidence, CashEvidence } from '../services/match-settlement-evidence.js';
@Injectable()
export class SettlementEvidenceRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async transaction(id: string) {
    const [row] = await this.db.query(
      'SELECT account_id,source_operation_id FROM wallet.transactions WHERE user_id=$1 AND id=$2 AND reversed_at IS NULL',
      [this.db.userId, id],
    );
    return row;
  }
  async directSources(transactionId: string) {
    const rows = await this.db.query(
      `SELECT i.id,i.batch_id,b.file_name,i.report_metadata FROM wallet.import_items i JOIN wallet.import_batches b ON b.id=i.batch_id WHERE i.user_id=$1 AND i.linked_transaction_id=$2 AND b.status='confirmed' AND b.report_type='settlement' ORDER BY b.created_at,i.source_row`,
      [this.db.userId, transactionId],
    );
    return rows.map((row) => ({
      itemId: row.id,
      batchId: row.batch_id,
      fileName: row.file_name,
      metadata: row.report_metadata,
      status: 'matched' as const,
      transactionId,
      reason: 'Vínculo confirmado pelo EDI.',
    }));
  }
  async settlements(accountId: string, references: string[], previewBatchId: string | null) {
    if (!references.length) return [];
    const rows = await this.db.query(
      `SELECT i.id,i.batch_id,b.file_name,i.transaction_date,i.amount_minor,i.source_operation_id,i.report_metadata
       FROM wallet.import_items i JOIN wallet.import_batches b ON b.id=i.batch_id
       WHERE b.user_id=$1 AND b.account_id=$2 AND b.report_type='settlement'
       AND (b.status IN ('history','confirmed') OR (b.id=$3 AND b.status='draft' AND b.expires_at>now()))
       AND i.source_operation_id=ANY($4::text[]) ORDER BY b.created_at,b.id,i.source_row LIMIT 20001`,
      [this.db.userId, accountId, previewBatchId, references],
    );
    if (rows.length > 20000)
      throw new UnprocessableEntityException(
        'Há evidências demais para cruzar neste relatório. Use um período menor.',
      );
    return rows.map((r): SettlementEvidence => ({
      itemId: r.id,
      batchId: r.batch_id,
      fileName: r.file_name,
      date: isoDate(r.transaction_date),
      amount: Number(r.amount_minor),
      reference: r.source_operation_id,
      metadata: r.report_metadata,
    }));
  }
  async cashMovements(accountId: string, references: string[]) {
    if (!references.length) return [];
    const rows = await this.db.query(
      `SELECT t.id,i.transaction_date,i.amount_minor,i.source_operation_id
       FROM wallet.transactions t JOIN wallet.import_batches b ON b.id=t.import_batch_id
       JOIN wallet.import_items i ON i.batch_id=b.id AND i.source_row=t.source_row
       WHERE t.user_id=$1 AND t.account_id=$2 AND t.reversed_at IS NULL
       AND b.report_type='account_statement' AND b.status='confirmed'
       AND i.source_operation_id=ANY($3::text[]) ORDER BY t.id LIMIT 20001`,
      [this.db.userId, accountId, references],
    );
    if (rows.length > 20000)
      throw new UnprocessableEntityException(
        'Há movimentos demais para cruzar neste relatório. Use um período menor.',
      );
    return rows.map((r): CashEvidence => ({
      transactionId: r.id,
      date: isoDate(r.transaction_date),
      amount: Number(r.amount_minor),
      reference: r.source_operation_id,
    }));
  }
}
