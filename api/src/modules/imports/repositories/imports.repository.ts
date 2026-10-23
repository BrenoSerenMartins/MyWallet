import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type { ParsedStatement, ImportEntry } from '../contracts/statement.js';
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
  async items(id: string) {
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
  async duplicate(
    accountId: string,
    item: {
      transactionDate: string;
      amount: number;
      description: string;
      sourceOperationId: string | null;
    },
  ) {
    const rows = await this.db.query(
      `SELECT id FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND transaction_date=$3 AND amount_minor=$4 AND reversed_at IS NULL AND (description=$5 OR ($6::text IS NOT NULL AND source_operation_id=$6)) LIMIT 1`,
      [
        this.db.userId,
        accountId,
        item.transactionDate,
        item.amount,
        item.description,
        item.sourceOperationId,
      ],
    );
    return rows.length > 0;
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
  async updateItem(
    batchId: string,
    id: string,
    input: { selected: boolean; transactionType: string; categoryId?: string | null },
  ) {
    await this.db.query(
      'UPDATE wallet.import_items SET selected=$4,transaction_type=$5,category_id=$6 WHERE user_id=$1 AND batch_id=$2 AND id=$3',
      [
        this.db.userId,
        batchId,
        id,
        input.selected,
        input.transactionType,
        input.categoryId ?? null,
      ],
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
