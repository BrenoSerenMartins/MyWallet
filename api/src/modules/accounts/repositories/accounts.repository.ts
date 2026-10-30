import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type { AccountResource } from '../../../core/integration/index.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
@Injectable()
export class AccountsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async list(): Promise<AccountResource[]> {
    const rows = await this.db.query(
      `SELECT a.*, NOT EXISTS(SELECT 1 FROM wallet.transactions existing WHERE existing.user_id=a.user_id AND existing.account_id=a.id) AND NOT EXISTS(SELECT 1 FROM wallet.account_balance_history h WHERE h.user_id=a.user_id AND h.account_id=a.id) AS opening_position_editable, a.opening_balance_minor+coalesce((SELECT sum(t.amount_minor) FROM wallet.transactions t WHERE t.user_id=a.user_id AND t.account_id=a.id AND t.reversed_at IS NULL),0) AS balance FROM wallet.financial_accounts a WHERE a.user_id=$1 ORDER BY a.created_at,a.id`,
      [this.db.userId],
    );
    return rows.map((r) => ({
      balanceBasis: r.balance_basis,
      id: r.id,
      name: r.name,
      institution: r.institution,
      type: r.type,
      currency: r.currency,
      openingBalance: Number(r.opening_balance_minor),
      canEditOpeningPosition: r.opening_position_editable,
      openingDate: isoDate(r.opening_date),
      balance: Number(r.balance),
      version: r.version,
      archived: !!r.archived_at,
    }));
  }
  async lock(id: string) {
    await this.db.query(
      'SELECT id FROM wallet.financial_accounts WHERE user_id=$1 AND id=$2 FOR UPDATE',
      [this.db.userId, id],
    );
  }
  async create(input: CreateAccountDto) {
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date,balance_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        id,
        this.db.userId,
        input.name.trim(),
        input.institution.trim(),
        input.type,
        input.openingBalance,
        input.openingDate,
        JSON.stringify({ kind: input.openingBalance ? 'legacy' : 'unknown' }),
      ],
    );
    return id;
  }
  async update(id: string, input: CreateAccountDto) {
    await this.db.query(
      `UPDATE wallet.financial_accounts SET name=$3,institution=$4,type=$5,opening_balance_minor=$6,opening_date=$7,balance_basis=CASE WHEN opening_balance_minor IS DISTINCT FROM $6 OR opening_date IS DISTINCT FROM $7 THEN jsonb_build_object('kind',CASE WHEN $6::bigint=0 THEN 'unknown' ELSE 'legacy' END) ELSE balance_basis END,version=version+1 WHERE user_id=$1 AND id=$2`,
      [
        this.db.userId,
        id,
        input.name.trim(),
        input.institution.trim(),
        input.type,
        input.openingBalance,
        input.openingDate,
      ],
    );
  }
  async hasTransactions(id: string) {
    return (
      (
        await this.db.query(
          'SELECT id FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 UNION ALL SELECT id FROM wallet.account_balance_history WHERE user_id=$1 AND account_id=$2 LIMIT 1',
          [this.db.userId, id],
        )
      ).length > 0
    );
  }
}
