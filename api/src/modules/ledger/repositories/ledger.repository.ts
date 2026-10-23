import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { PlanningActual, TransactionInput } from '../../../core/integration/index.js';
import { transactionResource } from '../mappers/transaction.mapper.js';
export interface LedgerFilter {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
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
      'SELECT * FROM wallet.transactions WHERE user_id=$1 AND reversed_at IS NULL ORDER BY transaction_date,id',
      [this.db.userId],
    );
    return rows.map(transactionResource);
  }
  async insert(input: TransactionInput) {
    const rows = await this.db.query(
      `INSERT INTO wallet.transactions(id,user_id,account_id,category_id,transaction_date,description,amount_minor,transaction_type,source_operation_id,import_batch_id,source_row,transfer_group_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
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
      ],
    );
    return transactionResource(rows[0]);
  }
  async find(id: string, lock = false) {
    const rows = await this.db.query(
      `SELECT * FROM wallet.transactions WHERE user_id=$1 AND id=$2 AND reversed_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [this.db.userId, id],
    );
    return rows[0] ? transactionResource(rows[0]) : null;
  }
  async list(filter: LedgerFilter) {
    const values: unknown[] = [this.db.userId];
    const where = ['user_id=$1', 'reversed_at IS NULL'];
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
      `SELECT * FROM wallet.transactions WHERE ${where.join(' AND ')} ORDER BY transaction_date DESC,id DESC LIMIT $${values.length}`,
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
  async planningActuals(from: string, to: string): Promise<PlanningActual[]> {
    const rows = await this.db.query(
      `SELECT category_id,transaction_type,
      coalesce(sum(amount_minor),0) AS total,count(*) AS count,
      coalesce(sum(amount_minor) FILTER(WHERE amount_minor>0),0) AS inflow,
      coalesce(-sum(amount_minor) FILTER(WHERE amount_minor<0),0) AS outflow
      FROM wallet.transactions WHERE user_id=$1 AND reversed_at IS NULL
      AND transaction_date >= $2 AND transaction_date < $3 AND transaction_type <> 'transfer'
      GROUP BY category_id,transaction_type`,
      [this.db.userId, from, to],
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
  async reverseBatch(id: string) {
    await this.db.query(
      'UPDATE wallet.transactions SET reversed_at=now(),version=version+1 WHERE user_id=$1 AND import_batch_id=$2 AND reversed_at IS NULL',
      [this.db.userId, id],
    );
  }
}
