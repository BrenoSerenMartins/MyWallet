import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { PlanningActual, TransactionInput } from '../../../core/integration/index.js';
import { sourceEvidenceKey, type SourceEvidence } from '../../../core/integration/index.js';
import { transactionResource } from '../mappers/transaction.mapper.js';
function reconciliationSql(alias = 'wallet.transactions') {
  return `EXISTS(SELECT 1 FROM wallet.transaction_sources proof
    WHERE proof.transaction_id=${alias}.id AND proof.source_data->>'reportType'='settlement'
    AND (proof.source_data->>'amount')::bigint=${alias}.amount_minor
    AND ${alias}.transaction_date IN ((proof.source_data->>'date')::date,(proof.source_data->>'originDate')::date))`;
}
export interface LedgerFilter {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  reconciliation?: string;
  type?: string;
  search?: string;
  cursor?: string;
  limit: number;
}
@Injectable()
export class LedgerRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async exportRecords() {
    const rows = await this.db.query(
      `SELECT t.*, ${reconciliationSql('t')} AS reconciled, coalesce((SELECT jsonb_agg(s.source_data ORDER BY s.source_key) FROM wallet.transaction_sources s WHERE s.transaction_id=t.id),'[]'::jsonb) AS source_evidence FROM wallet.transactions t WHERE user_id=$1 AND reversed_at IS NULL ORDER BY transaction_date,id`,
      [this.db.userId],
    );
    return rows.map((row) => ({
      ...transactionResource(row),
      sourceEvidence:
        row.source_evidence as import('../../../core/integration/index.js').SourceEvidence[],
    }));
  }
  async recordEvidence(transactionId: string, accountId: string, evidence: SourceEvidence) {
    const inserted = await this.db.query(
      `INSERT INTO wallet.transaction_sources(user_id,account_id,transaction_id,source_key,source_data) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,workspace_id,account_id,source_key) DO UPDATE SET transaction_id=excluded.transaction_id,source_data=excluded.source_data
      WHERE wallet.transaction_sources.transaction_id=excluded.transaction_id
      OR EXISTS(SELECT 1 FROM wallet.transactions t WHERE t.id=wallet.transaction_sources.transaction_id AND t.reversed_at IS NOT NULL) RETURNING transaction_id`,
      [
        this.db.userId,
        accountId,
        transactionId,
        sourceEvidenceKey(evidence),
        JSON.stringify(evidence),
      ],
    );
    if (!inserted.length)
      throw new ConflictException('A operação externa já está vinculada a outro lançamento.');
    if (evidence.reportType === 'settlement')
      await this.db.query(
        'UPDATE wallet.transactions SET source_operation_id=coalesce(source_operation_id,$3) WHERE user_id=$1 AND id=$2',
        [this.db.userId, transactionId, evidence.reference],
      );
  }
  async attachRefund(
    id: string,
    original: { id: string; transactionType: string; categoryId: string | null },
  ) {
    await this.db.query(
      'UPDATE wallet.transactions SET refund_of_id=$3,transaction_type=$4,category_id=$5,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id, original.id, original.transactionType, original.categoryId],
    );
  }
  async refundedAmount(id: string) {
    const [row] = await this.db.query(
      'SELECT coalesce(sum(abs(amount_minor)),0) AS amount FROM wallet.transactions WHERE user_id=$1 AND refund_of_id=$2 AND reversed_at IS NULL',
      [this.db.userId, id],
    );
    return Number(row.amount);
  }
  async insert(input: TransactionInput) {
    const rows = await this.db.query(
      `INSERT INTO wallet.transactions(id,user_id,account_id,category_id,transaction_date,description,amount_minor,transaction_type,source_operation_id,import_batch_id,source_row,transfer_group_id,balance_adjustment,refund_of_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        randomUUID(),
        this.db.userId,
        input.accountId,
        input.categoryId ?? null,
        input.transactionDate,
        input.description.trim(),
        input.amount,
        input.transactionType,
        input.sourceOperationId ?? null,
        input.importBatchId ?? null,
        input.sourceRow ?? null,
        input.transferGroupId ?? null,
        input.balanceAdjustment ? JSON.stringify(input.balanceAdjustment) : null,
        input.refundOfId ?? null,
      ],
    );
    return transactionResource(rows[0]);
  }
  async find(id: string, lock = false) {
    const rows = await this.db.query(
      `SELECT *,${reconciliationSql()} AS reconciled FROM wallet.transactions WHERE user_id=$1 AND id=$2 AND reversed_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [this.db.userId, id],
    );
    return rows[0] ? transactionResource(rows[0]) : null;
  }
  async list(filter: LedgerFilter) {
    const values: unknown[] = [this.db.userId];
    const where = ['user_id=$1', 'reversed_at IS NULL'];
    if (filter.reconciliation)
      where.push(`${filter.reconciliation === 'pending' ? 'NOT ' : ''}${reconciliationSql()}`);
    const add = (expression: string, value: unknown) => {
      values.push(value);
      where.push(expression.replace('?', `$${values.length}`));
    };
    if (filter.from) add('transaction_date>=?', filter.from);
    if (filter.to) add('transaction_date<?', filter.to);
    if (filter.accountId) add('account_id=?', filter.accountId);
    if (filter.categoryId) add('category_id=?', filter.categoryId);
    if (filter.type) add('transaction_type=?', filter.type);
    if (filter.search) add('description ILIKE ?', `%${filter.search}%`);
    if (filter.cursor) {
      const cursor = JSON.parse(Buffer.from(filter.cursor, 'base64url').toString());
      add('(transaction_date::text || id::text) < ?', cursor);
    }
    values.push(filter.limit + 1);
    const rows = await this.db.query(
      `SELECT *,${reconciliationSql()} AS reconciled FROM wallet.transactions WHERE ${where.join(' AND ')} ORDER BY transaction_date DESC,id DESC LIMIT $${values.length}`,
      values,
    );
    const items = rows.slice(0, filter.limit).map(transactionResource);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > filter.limit && last
          ? Buffer.from(JSON.stringify(last.transactionDate + last.id)).toString('base64url')
          : null,
    };
  }
  async update(id: string, input: TransactionInput) {
    await this.db.query(
      'UPDATE wallet.transactions SET category_id=$3,transaction_date=$4,description=$5,amount_minor=$6,transaction_type=$7,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        id,
        input.categoryId ?? null,
        input.transactionDate,
        input.description.trim(),
        input.amount,
        input.transactionType,
      ],
    );
    return this.find(id);
  }
  async reverse(id: string, groupId?: string | null) {
    await this.db.query(
      `UPDATE wallet.transactions SET reversed_at=now(),version=version+1 WHERE user_id=$1 AND ${groupId ? 'transfer_group_id' : 'id'}=$2 AND reversed_at IS NULL`,
      [this.db.userId, groupId ?? id],
    );
  }
  async createTransferGroup() {
    const id = randomUUID();
    await this.db.query('INSERT INTO wallet.transfer_groups(id,user_id) VALUES($1,$2)', [
      id,
      this.db.userId,
    ]);
    return id;
  }
  async hasFutureEntries(accountId: string, date: string) {
    const rows = await this.db.query(
      'SELECT 1 FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND reversed_at IS NULL AND transaction_date>$3 LIMIT 1',
      [this.db.userId, accountId, date],
    );
    return rows.length > 0;
  }
  async balanceBefore(accountId: string, date: string) {
    const [r] = await this.db.query(
      'SELECT coalesce(sum(amount_minor),0) total FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND transaction_date<$3 AND reversed_at IS NULL',
      [this.db.userId, accountId, date],
    );
    return Number(r.total);
  }
  async summary(from: string, to: string) {
    const [r] = await this.db.query(
      `SELECT coalesce(sum(amount_minor) FILTER(WHERE transaction_type='income'),0) income,coalesce(-sum(amount_minor) FILTER(WHERE transaction_type='expense'),0) expense,count(*) FILTER(WHERE transaction_type='unclassified') unclassified FROM wallet.transactions WHERE user_id=$1 AND reversed_at IS NULL AND transaction_date>=$2 AND transaction_date<$3`,
      [this.db.userId, from, to],
    );
    return {
      income: Number(r.income),
      expense: Number(r.expense),
      unclassified: Number(r.unclassified),
    };
  }
  async planningActuals(
    from: string,
    to: string,
    scope: 'all' | 'cash' | 'benefits' = 'all',
  ): Promise<PlanningActual[]> {
    const rows = await this.db.query(
      `SELECT category_id,transaction_type,
      coalesce(sum(amount_minor),0) AS total,count(*) AS count,
      coalesce(sum(amount_minor) FILTER(WHERE amount_minor>0),0) AS inflow,
      coalesce(-sum(amount_minor) FILTER(WHERE amount_minor<0),0) AS outflow
      FROM wallet.transactions WHERE user_id=$1 AND reversed_at IS NULL
      AND transaction_date >= $2 AND transaction_date < $3 AND transaction_type <> 'transfer'
      AND ($4='all' OR account_id IN(SELECT id FROM wallet.financial_accounts WHERE CASE WHEN $4='benefits' THEN type IN ('benefit_food','benefit_meal') ELSE type NOT IN ('benefit_food','benefit_meal') END))
      GROUP BY category_id,transaction_type`,
      [this.db.userId, from, to, scope],
    );
    return rows.map((r) => ({
      categoryId: r.category_id,
      type: r.transaction_type,
      amount: Number(r.total),
      count: Number(r.count),
      inflow: Number(r.inflow),
      outflow: Number(r.outflow),
    }));
  }
  async batchEntries(id: string) {
    return this.db.query(
      'SELECT id,account_id,version,transfer_group_id FROM wallet.transactions WHERE user_id=$1 AND import_batch_id=$2 AND reversed_at IS NULL',
      [this.db.userId, id],
    );
  }
  async removeBatchEvidence(id: string) {
    await this.db.query(
      `DELETE FROM wallet.transaction_sources s WHERE s.user_id=$1
      AND EXISTS(SELECT 1 FROM wallet.import_items i WHERE i.batch_id=$2 AND i.source_key=s.source_key AND i.linked_transaction_id=s.transaction_id)
      AND NOT EXISTS(SELECT 1 FROM wallet.import_items other JOIN wallet.import_batches b ON b.id=other.batch_id WHERE other.batch_id<>$2 AND b.status='confirmed' AND other.source_key=s.source_key AND other.linked_transaction_id=s.transaction_id)`,
      [this.db.userId, id],
    );
  }
  async reverseBatch(id: string) {
    const refunds = await this.db.query(
      'SELECT 1 FROM wallet.transactions r JOIN wallet.transactions original ON original.id=r.refund_of_id WHERE original.user_id=$1 AND original.import_batch_id=$2 AND original.reversed_at IS NULL AND r.reversed_at IS NULL LIMIT 1',
      [this.db.userId, id],
    );
    if (refunds.length)
      throw new ConflictException(
        'Existem devoluções vinculadas. Desfaça as devoluções antes da operação original.',
      );
    const supported = await this.db.query(
      `SELECT 1 FROM wallet.transactions t JOIN wallet.import_items i ON i.linked_transaction_id=t.id JOIN wallet.import_batches b ON b.id=i.batch_id WHERE t.user_id=$1 AND t.import_batch_id=$2 AND t.reversed_at IS NULL AND b.id<>$2 AND b.status='confirmed' LIMIT 1`,
      [this.db.userId, id],
    );
    if (supported.length)
      throw new ConflictException(
        'Outro arquivo confirmado está vinculado a estes movimentos. Revise os vínculos antes de desfazer.',
      );
    await this.db.query(
      'UPDATE wallet.transactions SET reversed_at=now(),version=version+1 WHERE user_id=$1 AND import_batch_id=$2 AND reversed_at IS NULL',
      [this.db.userId, id],
    );
  }
}
