import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import type { BalanceBasis, BalanceHistory } from '../../../core/integration/index.js';
import { isoDate, exactAmount } from '../../../core/rest/index.js';
const resource = (r: Record<string, any>): BalanceHistory => ({
  id: r.id,
  accountId: r.account_id,
  operation: r.operation,
  previousBase: Number(r.previous_base_minor),
  newBase: Number(r.new_base_minor),
  previousBasis: r.previous_basis,
  newBasis: r.new_basis,
  reason: r.reason,
  details: r.details,
  undoOfId: r.undo_of_id,
  createdAt: new Date(r.created_at).toISOString(),
});
@Injectable()
export class BalanceBasisRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async state(accountId: string) {
    const [row] = await this.db.query(
      `SELECT a.*,a.opening_balance_minor+coalesce((SELECT sum(t.amount_minor) FROM wallet.transactions t WHERE t.account_id=a.id AND t.reversed_at IS NULL),0) AS balance FROM wallet.financial_accounts a WHERE a.user_id=$1 AND a.id=$2 FOR UPDATE`,
      [this.db.userId, accountId],
    );
    return row
      ? {
          id: row.id,
          base: exactAmount(Number(row.opening_balance_minor)),
          basis: row.balance_basis as BalanceBasis,
          balance: exactAmount(Number(row.balance)),
          version: Number(row.version),
          archived: !!row.archived_at,
        }
      : null;
  }
  async net(accountId: string, date: string, observed: boolean) {
    const [row] = await this.db.query(
      `SELECT coalesce(sum(amount_minor),0) AS net FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND reversed_at IS NULL AND (transaction_date<$3 OR ($4 AND transaction_date=$3 AND balance_basis_included))`,
      [this.db.userId, accountId, date, observed],
    );
    return exactAmount(Number(row.net));
  }
  async snapshot(accountId: string, date: string) {
    const [future] = await this.db.query(
      'SELECT count(*)::int AS count FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND reversed_at IS NULL AND transaction_date>$3',
      [this.db.userId, accountId, date],
    );
    if (future.count) return false;
    await this.db.query(
      'UPDATE wallet.transactions SET balance_basis_included=true WHERE user_id=$1 AND account_id=$2',
      [this.db.userId, accountId],
    );
    return true;
  }
  async write(accountId: string, base: number, basis: BalanceBasis) {
    await this.db.query(
      'UPDATE wallet.financial_accounts SET opening_balance_minor=$3,balance_basis=$4,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, accountId, base, JSON.stringify(basis)],
    );
  }
  async append(event: BalanceHistory) {
    await this.db.query(
      `INSERT INTO wallet.account_balance_history(id,user_id,account_id,operation,previous_base_minor,new_base_minor,previous_basis,new_basis,reason,details,undo_of_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        event.id,
        this.db.userId,
        event.accountId,
        event.operation,
        event.previousBase,
        event.newBase,
        JSON.stringify(event.previousBasis),
        JSON.stringify(event.newBasis),
        event.reason,
        JSON.stringify(event.details),
        event.undoOfId,
        event.createdAt,
      ],
    );
    return event;
  }
  async history(accountId?: string, all = false) {
    const rows = await this.db.query(
      `SELECT * FROM wallet.account_balance_history WHERE user_id=$1 ${accountId ? 'AND account_id=$2' : ''} ORDER BY created_at DESC,id DESC ${accountId && !all ? 'LIMIT 100' : ''}`,
      [this.db.userId, ...(accountId ? [accountId] : [])],
    );
    return rows.map(resource);
  }
  async statement(accountId: string, importId: string) {
    const [row] = await this.db.query(
      `SELECT b.status,b.report_type,b.opening_balance_minor,min(i.transaction_date) AS first_date,
      bool_and(i.amount_minor=0 OR EXISTS(SELECT 1 FROM wallet.transactions t WHERE t.account_id=b.account_id AND t.reversed_at IS NULL AND (t.id=i.linked_transaction_id OR (t.import_batch_id=b.id AND t.source_row=i.source_row)) AND t.amount_minor=i.amount_minor AND t.transaction_date=i.transaction_date)) AS complete
      FROM wallet.import_batches b JOIN wallet.import_items i ON i.batch_id=b.id WHERE b.user_id=$1 AND b.account_id=$2 AND b.id=$3 GROUP BY b.id`,
      [this.db.userId, accountId, importId],
    );
    return row
      ? {
          status: row.status,
          type: row.report_type,
          opening: row.opening_balance_minor === null ? null : Number(row.opening_balance_minor),
          date: isoDate(row.first_date),
          complete: !!row.complete,
        }
      : null;
  }
  async event(accountId: string, id: string) {
    const [row] = await this.db.query(
      'SELECT * FROM wallet.account_balance_history WHERE user_id=$1 AND account_id=$2 AND id=$3',
      [this.db.userId, accountId, id],
    );
    return row ? resource(row) : null;
  }
  async knownDateIds(accountId: string, date: string) {
    const rows = await this.db.query(
      'SELECT id FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND transaction_date=$3 AND reversed_at IS NULL',
      [this.db.userId, accountId, date],
    );
    return rows.map((row) => row.id as string);
  }
  async restoreMarkers(accountId: string, ids: string[]) {
    await this.db.query(
      'UPDATE wallet.transactions SET balance_basis_included=(id=ANY($3::uuid[])) WHERE user_id=$1 AND account_id=$2',
      [this.db.userId, accountId, ids],
    );
  }
  async setMarkers(accountId: string, value: boolean) {
    await this.db.query(
      'UPDATE wallet.transactions SET balance_basis_included=$3 WHERE user_id=$1 AND account_id=$2',
      [this.db.userId, accountId, value],
    );
  }
}
