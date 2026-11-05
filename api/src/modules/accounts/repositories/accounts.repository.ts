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
      benefitCreditMonth: r.benefit_credit_month ?? 'received',
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
  async positions(
    dates: string[],
  ): Promise<import('../../../core/integration/index.js').HistoricalPosition[]> {
    // Walk only the active reference lineage. An undone/replaced observation must
    // not become an anchor merely because it exists in the append-only audit.
    const rows = await this.db.query(
      `WITH RECURSIVE anchors AS (
        SELECT a.id,a.user_id,a.workspace_id,a.opening_date,a.balance_basis AS basis,
          a.opening_balance_minor AS base,0 AS depth,ARRAY[]::uuid[] AS visited
        FROM wallet.financial_accounts a WHERE a.user_id=$1
        UNION ALL
        SELECT x.id,x.user_id,x.workspace_id,x.opening_date,h.previous_basis,h.previous_base_minor,x.depth+1,x.visited||h.id
        FROM anchors x JOIN wallet.account_balance_history h ON h.id::text=x.basis->>'originId'
          AND h.account_id=x.id AND h.user_id=x.user_id AND h.workspace_id=x.workspace_id
        WHERE NOT h.id=ANY(x.visited) AND x.depth<100
      ), cuts AS (
        SELECT a.id,a.user_id,a.workspace_id,cut.date,chosen.basis,chosen.base,chosen.reference
        FROM wallet.financial_accounts a CROSS JOIN unnest($2::date[]) AS cut(date)
        LEFT JOIN LATERAL (
          SELECT x.basis,x.base,coalesce(x.basis->>'referenceDate',CASE WHEN x.basis->>'kind'='legacy' THEN x.opening_date::text END) AS reference
          FROM anchors x WHERE x.id=a.id
            AND (coalesce(x.basis->>'referenceDate',CASE WHEN x.basis->>'kind'='legacy' THEN x.opening_date::text END)<cut.date::text
              OR (x.basis->>'kind'='legacy' AND x.opening_date<=cut.date)
              OR (x.basis->>'kind'='statement' AND coalesce(x.basis->>'referencePoint','')<>'closing' AND x.basis->>'referenceDate'=cut.date::text))
          ORDER BY x.depth LIMIT 1
        ) chosen ON true WHERE a.user_id=$1
      )
      SELECT c.id,c.date,c.basis,c.reference,
        CASE WHEN c.basis->>'kind'='legacy' THEN c.base
          ELSE (c.basis->>'referenceBalance')::bigint END
        +coalesce(sum(t.amount_minor),0) AS balance
      FROM cuts c
      LEFT JOIN wallet.account_balance_history anchor ON anchor.id::text=c.basis->>'originId'
        AND anchor.account_id=c.id AND anchor.user_id=c.user_id AND anchor.workspace_id=c.workspace_id
      LEFT JOIN wallet.transactions t ON t.account_id=c.id AND t.user_id=c.user_id AND t.workspace_id=c.workspace_id
        AND t.reversed_at IS NULL AND t.transaction_date<c.date
        AND (CASE WHEN c.basis->>'kind'='legacy' THEN t.transaction_date>=c.reference::date
          WHEN c.basis->>'kind'='statement' AND coalesce(c.basis->>'referencePoint','')<>'closing' THEN t.transaction_date>=c.reference::date
          ELSE t.transaction_date>c.reference::date OR (t.transaction_date=c.reference::date
            AND NOT CASE WHEN anchor.details ? 'knownSameDayIds' THEN (anchor.details->'knownSameDayIds') ? t.id::text ELSE t.balance_basis_included END) END)
      GROUP BY c.id,c.date,c.basis,c.reference,c.base`,
      [this.db.userId, dates],
    );
    return rows.map((row) => {
      const known =
        row.basis &&
        !row.basis.reviewRequired &&
        row.basis.kind !== 'unknown' &&
        row.balance != null;
      return {
        accountId: row.id,
        date: isoDate(row.date),
        balance: known ? Number(row.balance) : null,
        referenceDate: row.reference ?? null,
        reason: known
          ? null
          : row.basis?.reviewRequired
            ? 'reference-under-review'
            : 'missing-reference',
      };
    });
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
      'INSERT INTO wallet.financial_accounts(id,user_id,name,institution,type,opening_balance_minor,opening_date,balance_basis,benefit_credit_month) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        this.db.userId,
        input.name.trim(),
        input.institution.trim(),
        input.type,
        input.openingBalance,
        input.openingDate,
        JSON.stringify({ kind: input.openingBalance ? 'legacy' : 'unknown' }),
        input.benefitCreditMonth ?? 'received',
      ],
    );
    return id;
  }
  async update(id: string, input: CreateAccountDto) {
    await this.db.query(
      `UPDATE wallet.financial_accounts SET name=$3,institution=$4,type=$5,opening_balance_minor=$6,opening_date=$7,balance_basis=CASE WHEN opening_balance_minor IS DISTINCT FROM $6 OR opening_date IS DISTINCT FROM $7 THEN jsonb_build_object('kind',CASE WHEN $6::bigint=0 THEN 'unknown' ELSE 'legacy' END) ELSE balance_basis END,benefit_credit_month=$8,version=version+1 WHERE user_id=$1 AND id=$2`,
      [
        this.db.userId,
        id,
        input.name.trim(),
        input.institution.trim(),
        input.type,
        input.openingBalance,
        input.openingDate,
        input.benefitCreditMonth ?? 'received',
      ],
    );
  }
  async setBenefitMonth(id: string, month: 'received' | 'following') {
    await this.db.query(
      'UPDATE wallet.financial_accounts SET benefit_credit_month=$3,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id, month],
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
