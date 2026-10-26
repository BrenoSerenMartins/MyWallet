import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type {
  ParsedStatement,
  ImportEntry,
  SavedImportItem,
  ReprocessedImportEntry,
} from '../contracts/statement.js';
@Injectable()
export class ImportsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async list() {
    return this.db.query(
      'SELECT id,file_name AS "fileName",status,created_at AS "createdAt" FROM wallet.import_batches WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [this.db.userId],
    );
  }
  async get(id: string, lock = false) {
    const [batch] = await this.db.query(
      `SELECT * FROM wallet.import_batches WHERE user_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`,
      [this.db.userId, id],
    );
    return batch;
  }
  async items(id: string): Promise<SavedImportItem[]> {
    const rows = await this.db.query(
      'SELECT * FROM wallet.import_items WHERE user_id=$1 AND batch_id=$2 ORDER BY source_row',
      [this.db.userId, id],
    );
    return rows.map((r) => ({
      id: r.id,
      sourceRow: r.source_row,
      transactionDate: isoDate(r.transaction_date),
      description: r.description,
      amount: Number(r.amount_minor),
      balanceAfter: r.balance_after_minor === null ? null : Number(r.balance_after_minor),
      metadata: Object.keys(r.report_metadata ?? {}).length ? r.report_metadata : null,
      sourceOperationId: r.source_operation_id,
      transactionType: r.transaction_type,
      selected: r.selected,
      duplicateCandidate: r.duplicate_candidate,
      categoryId: r.category_id,
      linkedTransactionId: r.linked_transaction_id,
      confirmNew: r.confirm_new,
      refundOfId: r.refund_of_id,
    }));
  }
  async previousImports(accountId: string, date: string, excludeBatchId: string) {
    const rows = await this.db.query(
      `SELECT b.id,b.file_name,b.status,min(i.transaction_date) AS first_date,max(i.transaction_date) AS last_date
       FROM wallet.import_batches b JOIN wallet.import_items i ON i.batch_id=b.id
       WHERE b.user_id=$1 AND b.account_id=$2 AND b.id<>$3 AND b.report_type='account_statement'
       AND (b.status='history' OR (b.status='draft' AND b.expires_at>now()))
       GROUP BY b.id,b.file_name,b.status HAVING min(i.transaction_date)<$4
       ORDER BY max(i.transaction_date) DESC,b.id LIMIT 5`,
      [this.db.userId, accountId, excludeBatchId, date],
    );
    return rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      status: row.status,
      firstDate: isoDate(row.first_date),
      lastDate: isoDate(row.last_date),
    }));
  }
  async sameFile(accountId: string, hash: string) {
    await this.db.query(
      "DELETE FROM wallet.import_batches WHERE user_id=$1 AND account_id=$2 AND file_hash=$3 AND status='draft' AND history_saved_at IS NULL AND expires_at<now()",
      [this.db.userId, accountId, hash],
    );

    const [r] = await this.db.query(
      "SELECT id FROM wallet.import_batches WHERE user_id=$1 AND account_id=$2 AND file_hash=$3 AND status IN ('draft','confirmed','history')",
      [this.db.userId, accountId, hash],
    );
    return r;
  }
  async duplicateSources(accountId: string, from: string, to: string, excludeBatchId: string) {
    const rows = await this.db.query(
      `SELECT coalesce(i.transaction_date,t.transaction_date) AS transaction_date,coalesce(i.amount_minor,t.amount_minor) AS amount_minor,coalesce(i.description,t.description) AS description,coalesce(i.source_operation_id,t.source_operation_id) AS source_operation_id,i.balance_after_minor
       FROM wallet.transactions t LEFT JOIN wallet.import_items i ON i.batch_id=t.import_batch_id AND i.source_row=t.source_row
       WHERE t.user_id=$1 AND t.account_id=$2 AND coalesce(i.transaction_date,t.transaction_date) BETWEEN $3 AND $4 AND t.reversed_at IS NULL AND t.import_batch_id IS DISTINCT FROM $5`,
      [this.db.userId, accountId, from, to, excludeBatchId],
    );
    return rows.map((r) => ({
      transactionDate: isoDate(r.transaction_date),
      amount: Number(r.amount_minor),
      description: r.description,
      sourceOperationId: r.source_operation_id,
      balanceAfter: r.balance_after_minor == null ? null : Number(r.balance_after_minor),
    }));
  }
  async create(
    accountId: string,
    hash: string,
    fileName: string,
    version: string,
    statement: ParsedStatement,
  ) {
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO wallet.import_batches(id,user_id,account_id,file_hash,file_name,mapper_version,opening_balance_minor,closing_balance_minor,report_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        this.db.userId,
        accountId,
        hash,
        fileName.slice(0, 160),
        version,
        statement.openingBalance,
        statement.closingBalance,
        statement.reportType ?? 'account_statement',
      ],
    );
    return id;
  }
  async addItem(batchId: string, item: ImportEntry, duplicate: boolean) {
    await this.db.query(
      'INSERT INTO wallet.import_items(id,user_id,batch_id,source_row,transaction_date,description,amount_minor,balance_after_minor,source_operation_id,transaction_type,duplicate_candidate,selected,report_metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [
        randomUUID(),
        this.db.userId,
        batchId,
        item.sourceRow,
        item.transactionDate,
        item.description,
        item.amount,
        item.balanceAfter,
        item.sourceOperationId,
        item.transactionType,
        duplicate,
        !duplicate,
        JSON.stringify(item.metadata ?? {}),
      ],
    );
  }
  async replaceUnconfirmedSource(
    id: string,
    statement: ParsedStatement,
    items: ReprocessedImportEntry[],
    mapperVersion: string,
  ) {
    const rows = items.map((item) => ({
      id: item.id,
      source_row: item.sourceRow,
      transaction_date: item.transactionDate,
      description: item.description,
      amount_minor: item.amount,
      balance_after_minor: item.balanceAfter,
      source_operation_id: item.sourceOperationId,
      transaction_type: item.transactionType,
      selected: item.selected,
      category_id: item.categoryId,
      duplicate_candidate: item.duplicateCandidate,
      report_metadata: item.metadata ?? {},
      linked_transaction_id: item.linkedTransactionId ?? null,
      confirm_new: item.confirmNew ?? false,
      refund_of_id: item.refundOfId ?? null,
    }));
    await this.db.query('DELETE FROM wallet.import_items WHERE user_id=$1 AND batch_id=$2', [
      this.db.userId,
      id,
    ]);
    await this.db.query(
      `INSERT INTO wallet.import_items(id,user_id,batch_id,source_row,transaction_date,description,amount_minor,balance_after_minor,source_operation_id,transaction_type,selected,category_id,duplicate_candidate,report_metadata,linked_transaction_id,confirm_new,refund_of_id)
      SELECT r.id,$1,$2,r.source_row,r.transaction_date,r.description,r.amount_minor,r.balance_after_minor,r.source_operation_id,r.transaction_type,r.selected,r.category_id,r.duplicate_candidate,r.report_metadata,r.linked_transaction_id,r.confirm_new,r.refund_of_id
      FROM jsonb_to_recordset($3::jsonb) AS r(id uuid,source_row integer,transaction_date date,description text,amount_minor bigint,balance_after_minor bigint,source_operation_id text,transaction_type text,selected boolean,category_id uuid,duplicate_candidate boolean,report_metadata jsonb,linked_transaction_id uuid,confirm_new boolean,refund_of_id uuid)`,
      [this.db.userId, id, JSON.stringify(rows)],
    );
    await this.db.query(
      `UPDATE wallet.import_batches SET mapper_version=$3,opening_balance_minor=$4,closing_balance_minor=$5,version=version+1,
      expires_at=CASE WHEN status='draft' THEN now()+interval '24 hours' ELSE expires_at END WHERE user_id=$1 AND id=$2 AND status IN ('draft','history')`,
      [this.db.userId, id, mapperVersion, statement.openingBalance, statement.closingBalance],
    );
  }
  async applyAutomaticTypes(batchId: string, items: { id: string; transactionType: string }[]) {
    if (!items.length) return;
    await this.db.query(
      `UPDATE wallet.import_items i SET transaction_type=source.type
       FROM unnest($3::uuid[],$4::text[]) source(id,type)
       WHERE i.user_id=$1 AND i.batch_id=$2 AND i.id=source.id AND i.transaction_type='unclassified'`,
      [
        this.db.userId,
        batchId,
        items.map((item) => item.id),
        items.map((item) => item.transactionType),
      ],
    );
  }
  async advanceVersion(id: string) {
    await this.db.query(
      'UPDATE wallet.import_batches SET version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
  async updateItem(
    batchId: string,
    id: string,
    input: {
      selected: boolean;
      transactionType: string;
      categoryId?: string | null;
      linkedTransactionId?: string | null;
      confirmNew?: boolean;
      refundOfId?: string | null;
    },
  ) {
    await this.db.query(
      'UPDATE wallet.import_items SET selected=$4,transaction_type=$5,category_id=$6,linked_transaction_id=$7,confirm_new=$8,refund_of_id=$9 WHERE user_id=$1 AND batch_id=$2 AND id=$3',
      [
        this.db.userId,
        batchId,
        id,
        input.selected,
        input.transactionType,
        input.categoryId ?? null,
        input.linkedTransactionId ?? null,
        input.confirmNew ?? false,
        input.refundOfId ?? null,
      ],
    );
    if (input.refundOfId)
      await this.db.query(
        `UPDATE wallet.import_items i SET transaction_type=t.transaction_type,category_id=t.category_id FROM wallet.transactions t WHERE i.user_id=$1 AND i.batch_id=$2 AND i.id=$3 AND t.id=i.refund_of_id AND t.reversed_at IS NULL`,
        [this.db.userId, batchId, id],
      );
    await this.db.query(
      'UPDATE wallet.import_batches SET version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, batchId],
    );
  }
  async retainHistory(id: string) {
    await this.db.query(
      "UPDATE wallet.import_batches SET status='history',history_saved_at=coalesce(history_saved_at,now()),version=version+1 WHERE user_id=$1 AND id=$2",
      [this.db.userId, id],
    );
  }
  async reopenHistory(id: string) {
    await this.db.query(
      "UPDATE wallet.import_batches SET status='draft',expires_at=now()+interval '24 hours',version=version+1 WHERE user_id=$1 AND id=$2",
      [this.db.userId, id],
    );
  }
  async mark(id: string, status: 'confirmed' | 'reversed') {
    await this.db.query(
      `UPDATE wallet.import_batches SET status=$3,${status === 'confirmed' ? 'confirmed_at' : 'reversed_at'}=now(),version=version+1 WHERE user_id=$1 AND id=$2`,
      [this.db.userId, id, status],
    );
  }
}
