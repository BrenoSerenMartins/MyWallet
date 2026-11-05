import { recognizedCounterpartiesSql } from './counterparty-recognition-sql.js';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../../core/database/index.js';
import type { PlanningActual, TransactionInput } from '../../../core/integration/index.js';
import { sourceEvidenceKey, type SourceEvidence } from '../../../core/integration/index.js';
import { isoDate, exactAmount } from '../../../core/rest/index.js';
import { transactionResource } from '../mappers/transaction.mapper.js';
function reconciliationSql(alias = 'wallet.transactions') {
  return `EXISTS(SELECT 1 FROM wallet.transaction_sources proof
    WHERE proof.transaction_id=${alias}.id AND proof.source_data->>'reportType' IN ('account_statement','benefit_statement','settlement')
    AND (proof.source_data->>'amount')::bigint=${alias}.amount_minor
    AND ${alias}.transaction_date IN ((proof.source_data->>'date')::date,(proof.source_data->>'originDate')::date))`;
}
function cardPaymentSql(alias = 'wallet.transactions') {
  return `(SELECT json_build_object('cardId',p.card_id,'billMonth',p.bill_month,'cardName',c.name,'paymentId',p.id)
    FROM wallet.card_payments p JOIN wallet.credit_cards c ON c.id=p.card_id AND c.user_id=p.user_id AND c.workspace_id=p.workspace_id
    WHERE p.user_id=${alias}.user_id AND p.workspace_id=${alias}.workspace_id AND NOT p.voided
      AND ${alias}.id IN (p.debit_id,p.credit_id) LIMIT 1)`;
}
/** Reporting competence only; bank dates and balance/reconciliation evidence stay unchanged. */
function reportingDateSql(alias = 'wallet.transactions') {
  return `CASE WHEN ${alias}.transaction_type='income' AND ${alias}.amount_minor>0
    AND EXISTS(SELECT 1 FROM wallet.financial_accounts reporting_account
      WHERE reporting_account.id=${alias}.account_id AND reporting_account.user_id=${alias}.user_id
      AND reporting_account.workspace_id=${alias}.workspace_id
      AND reporting_account.type IN ('benefit_food','benefit_meal')
      AND reporting_account.benefit_credit_month='following')
    THEN (date_trunc('month',${alias}.transaction_date)+interval '1 month')::date
    ELSE ${alias}.transaction_date END`;
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
  async commitmentEntries(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.db.query(
      `SELECT * FROM wallet.transactions WHERE user_id=$1 AND id=ANY($2::uuid[]) AND reversed_at IS NULL AND refund_of_id IS NULL AND balance_adjustment IS NULL AND transfer_group_id IS NULL AND transaction_type IN ('income','expense') AND managed_kind IS NULL`,
      [this.db.userId, ids],
    );
    return rows.map(transactionResource);
  }
  async commitmentCandidates(accountId: string, from: string, to: string) {
    const rows = await this.db.query(
      `SELECT * FROM wallet.transactions WHERE user_id=$1 AND account_id=$2 AND transaction_date BETWEEN $3 AND $4 AND reversed_at IS NULL AND refund_of_id IS NULL AND balance_adjustment IS NULL AND transfer_group_id IS NULL AND transaction_type IN ('income','expense') AND managed_kind IS NULL ORDER BY transaction_date DESC,id LIMIT 100`,
      [this.db.userId, accountId, from, to],
    );
    return rows.map(transactionResource);
  }
  async managedEntries(ids: string[]) {
    if (!ids.length) return [];
    return (
      await this.db.query(
        `SELECT t.*,coalesce((SELECT sum(abs(r.amount_minor)) FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL),0) AS refunded_amount FROM wallet.transactions t WHERE user_id=$1 AND id=ANY($2::uuid[]) AND reversed_at IS NULL`,
        [this.db.userId, ids],
      )
    ).map((row) => ({
      ...transactionResource(row),
      refundedAmount: Number(row.refunded_amount ?? 0),
    }));
  }
  async managedCandidates(
    accountId: string,
    from: string,
    to: string,
    direction: 'income' | 'expense',
  ) {
    return (
      await this.db.query(
        `SELECT t.*,coalesce((SELECT sum(abs(r.amount_minor)) FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL),0) AS refunded_amount FROM wallet.transactions t WHERE t.user_id=$1 AND t.account_id=$2 AND t.transaction_date BETWEEN $3 AND $4 AND t.reversed_at IS NULL AND t.managed_kind IS NULL AND t.refund_of_id IS NULL AND t.balance_adjustment IS NULL AND t.transfer_group_id IS NULL
      AND ${direction === 'income' ? "t.transaction_type IN ('income','transfer') AND t.amount_minor>0" : "t.transaction_type IN ('expense','transfer','unclassified') AND t.amount_minor<0 AND NOT EXISTS(SELECT 1 FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL)"}
      AND NOT EXISTS(SELECT 1 FROM wallet.transaction_claims c WHERE c.user_id=t.user_id AND c.workspace_id=t.workspace_id AND c.transaction_id=t.id) ORDER BY t.transaction_date DESC,t.id LIMIT 100`,
        [this.db.userId, accountId, from, to],
      )
    ).map((row) => ({
      ...transactionResource(row),
      refundedAmount: Number(row.refunded_amount ?? 0),
    }));
  }
  async claimEntry(id: string, purpose: string, ownerKey: string) {
    const rows = await this.db.query(
      `INSERT INTO wallet.transaction_claims(user_id,transaction_id,purpose,owner_key) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,workspace_id,transaction_id) DO UPDATE SET purpose=EXCLUDED.purpose WHERE transaction_claims.owner_key=EXCLUDED.owner_key AND transaction_claims.purpose=EXCLUDED.purpose RETURNING transaction_id`,
      [this.db.userId, id, purpose, ownerKey],
    );
    if (!rows.length)
      throw new ConflictException(
        'Este lançamento já está vinculado a outro compromisso ou módulo.',
      );
  }
  async releaseEntry(id: string, ownerKey: string) {
    await this.db.query(
      'DELETE FROM wallet.transaction_claims WHERE user_id=$1 AND transaction_id=$2 AND owner_key=$3',
      [this.db.userId, id, ownerKey],
    );
  }
  async convertManagedDebit(id: string, groupId: string, kind: string) {
    await this.db.query(
      "UPDATE wallet.transactions SET transaction_type='transfer',category_id=NULL,classification_rule_id=NULL,transfer_group_id=$3,managed_kind=$4,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2",
      [this.db.userId, id, groupId, kind],
    );
  }
  async detachManagedDebit(
    id: string,
    original?: { transactionType: string; categoryId: string | null } | null,
  ) {
    await this.db.query(
      'UPDATE wallet.transactions SET transfer_group_id=NULL,managed_kind=NULL,transaction_type=CASE WHEN $5 THEN $3 ELSE transaction_type END,category_id=CASE WHEN $5 THEN $4 ELSE category_id END,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        id,
        original?.transactionType ?? null,
        original?.categoryId ?? null,
        !!original,
      ],
    );
  }
  async setManagedCategory(ids: string[], categoryId: string | null, kind: string) {
    await this.db.query(
      'UPDATE wallet.transactions SET category_id=$3,version=version+1,updated_at=now() WHERE user_id=$1 AND (id=ANY($2::uuid[]) OR refund_of_id=ANY($2::uuid[])) AND managed_kind=$4 AND reversed_at IS NULL',
      [this.db.userId, ids, categoryId, kind],
    );
  }
  async setManagedKind(id: string, kind: string | null) {
    await this.db.query(
      'UPDATE wallet.transactions SET managed_kind=$3,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2',
      [this.db.userId, id, kind],
    );
  }
  async exportRecords() {
    const rows = await this.db.query(
      `SELECT t.*, ${reconciliationSql('t')} AS reconciled, coalesce((SELECT jsonb_agg(s.source_data ORDER BY s.source_key) FROM wallet.transaction_sources s WHERE s.transaction_id=t.id),'[]'::jsonb) AS source_evidence FROM wallet.transactions t WHERE user_id=$1 AND reversed_at IS NULL ORDER BY transaction_date,id`,
      [this.db.userId],
    );
    return rows.map((row) => ({
      ...transactionResource(row),
      balanceBasisIncluded: row.balance_basis_included,
      sourceEvidence:
        row.source_evidence as import('../../../core/integration/index.js').SourceEvidence[],
    }));
  }
  async applyCounterpartyRelation(accountId: string, counterpartyId: string) {
    const rows = await this.db.query(
      `${recognizedCounterpartiesSql}
      UPDATE wallet.transactions t SET counterparty_id=$3,version=t.version+1,updated_at=now()
      WHERE t.user_id=$1 AND t.account_id=$2 AND t.counterparty_id IS NULL AND t.reversed_at IS NULL
        AND t.transaction_type IN ('income','expense') AND t.refund_of_id IS NULL
        AND t.balance_adjustment IS NULL AND t.transfer_group_id IS NULL
        AND EXISTS(SELECT 1 FROM recognized x WHERE x.id=t.id AND x.counterparty_id=$3)
      RETURNING t.id`,
      [this.db.userId, accountId, counterpartyId],
    );
    return rows.length;
  }
  async applyClassificationRule(
    rule: import('../../../core/integration/index.js').ClassificationRule,
  ) {
    const rows = await this.db.query(
      `
    ${recognizedCounterpartiesSql}
    UPDATE wallet.transactions t SET counterparty_id=$3,category_id=$4,classification_rule_id=$5,version=t.version+1,updated_at=now()
    WHERE t.user_id=$1 AND t.account_id=$2 AND t.transaction_type=$6 AND t.reversed_at IS NULL
      AND t.refund_of_id IS NULL AND t.balance_adjustment IS NULL AND t.transfer_group_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM wallet.transactions r WHERE r.refund_of_id=t.id AND r.reversed_at IS NULL)
      AND (t.category_id IS NULL OR t.classification_rule_id IS NOT NULL)
      AND (t.counterparty_id=$3 OR (t.counterparty_id IS NULL AND EXISTS(SELECT 1 FROM recognized x WHERE x.id=t.id AND x.counterparty_id=$3)))
      AND (t.category_id IS DISTINCT FROM $4 OR t.counterparty_id IS DISTINCT FROM $3 OR t.classification_rule_id IS DISTINCT FROM $5)
    RETURNING t.id`,
      [
        this.db.userId,
        rule.accountId,
        rule.counterpartyId,
        rule.categoryId,
        rule.id,
        rule.transactionType,
      ],
    );
    return { updated: rows.length };
  }
  async evidence(id: string) {
    const rows = await this.db.query(
      'SELECT source_data FROM wallet.transaction_sources WHERE user_id=$1 AND transaction_id=$2',
      [this.db.userId, id],
    );
    return rows.map((row) => row.source_data as SourceEvidence);
  }
  async bindCounterparty(id: string, agent: string) {
    await this.db.query(
      'UPDATE wallet.transactions SET counterparty_id=$3 WHERE user_id=$1 AND id=$2 AND counterparty_id IS NULL',
      [this.db.userId, id, agent],
    );
  }
  async recordEvidence(transactionId: string, accountId: string, evidence: SourceEvidence) {
    const inserted = await this.db.query(
      `INSERT INTO wallet.transaction_sources(user_id,account_id,transaction_id,source_key,source_data) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(user_id,workspace_id,account_id,source_key) DO UPDATE SET transaction_id=excluded.transaction_id,source_data=wallet.transaction_sources.source_data || excluded.source_data
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
      `INSERT INTO wallet.transactions(id,user_id,account_id,category_id,transaction_date,description,amount_minor,transaction_type,source_operation_id,import_batch_id,source_row,transfer_group_id,balance_adjustment,refund_of_id,counterparty_id,classification_rule_id,source_kind,balance_basis_included,managed_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
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
        input.counterpartyId ?? null,
        input.classificationRuleId ?? null,
        input.sourceKind ?? 'manual',
        input.balanceBasisIncluded ?? false,
        input.managedKind ?? null,
      ],
    );
    return transactionResource(rows[0]);
  }
  async find(id: string, lock = false) {
    const rows = await this.db.query(
      `SELECT *,${cardPaymentSql()} AS card_payment,${reportingDateSql()} AS reporting_date,${reconciliationSql()} AS reconciled FROM wallet.transactions WHERE user_id=$1 AND id=$2 AND reversed_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
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
    if (filter.from) add(`(${reportingDateSql()})>=?`, filter.from);
    if (filter.to) add(`(${reportingDateSql()})<?`, filter.to);
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
      `SELECT *,${cardPaymentSql()} AS card_payment,${reportingDateSql()} AS reporting_date,${reconciliationSql()} AS reconciled FROM wallet.transactions WHERE ${where.join(' AND ')} ORDER BY transaction_date DESC,id DESC LIMIT $${values.length}`,
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
      'UPDATE wallet.transactions SET category_id=$3,transaction_date=$4,description=$5,amount_minor=$6,transaction_type=$7,counterparty_id=$8,classification_rule_id=$9,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        id,
        input.categoryId ?? null,
        input.transactionDate,
        input.description.trim(),
        input.amount,
        input.transactionType,
        input.counterpartyId ?? null,
        input.classificationRuleId ?? null,
      ],
    );
    return this.find(id);
  }
  async transferAccounts(groupId: string) {
    const rows = await this.db.query(
      'SELECT DISTINCT account_id FROM wallet.transactions WHERE user_id=$1 AND transfer_group_id=$2 ORDER BY account_id',
      [this.db.userId, groupId],
    );
    return rows.map((row) => row.account_id as string);
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
  async budgetActivity(
    from: string,
    to: string,
  ): Promise<import('../../../core/integration/index.js').BudgetActivity[]> {
    return (await this.budgetActivities([{ from, to }]))[0].activity;
  }
  async budgetActivities(periods: { from: string; to: string }[]) {
    const rows = await this.db.query(
      `SELECT cut.start_date,cut.end_date,t.account_id,
        coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_type='income' AND (${reportingDateSql('t')}) >=cut.start_date AND (${reportingDateSql('t')}) <cut.end_date),0) AS income,
        coalesce(-sum(t.amount_minor) FILTER(WHERE t.transaction_type='expense' AND (${reportingDateSql('t')}) >=cut.start_date AND (${reportingDateSql('t')}) <cut.end_date),0) AS expense,
        coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_type='transfer' AND t.transaction_date >=cut.start_date AND t.transaction_date <cut.end_date),0) AS transfers,
        coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_type='unclassified' AND t.transaction_date >=cut.start_date AND t.transaction_date <cut.end_date),0) AS unclassified,
        coalesce(-sum(t.amount_minor) FILTER(WHERE t.transaction_type='transfer' AND t.transaction_date >=cut.start_date AND t.transaction_date <cut.end_date
          AND EXISTS(SELECT 1 FROM wallet.transactions other JOIN wallet.financial_accounts destination ON destination.id=other.account_id AND destination.workspace_id=other.workspace_id AND destination.user_id=other.user_id
            WHERE other.transfer_group_id=t.transfer_group_id AND other.account_id<>t.account_id AND other.user_id=t.user_id AND other.workspace_id=t.workspace_id AND other.reversed_at IS NULL AND destination.type IN ('reserve','investment'))),0) AS reserved,
        coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_date <cut.start_date AND (${reportingDateSql('t')}) >=cut.start_date),0) AS deferred_opening,
        coalesce(sum(t.amount_minor) FILTER(WHERE t.transaction_date <cut.end_date AND (${reportingDateSql('t')}) >=cut.end_date),0) AS deferred_closing
       FROM unnest($2::date[], $3::date[]) AS cut(start_date,end_date) JOIN wallet.transactions t ON t.transaction_date<cut.end_date WHERE t.user_id=$1 AND t.reversed_at IS NULL AND t.transaction_date <cut.end_date
       GROUP BY cut.start_date,cut.end_date,t.account_id`,
      [this.db.userId, periods.map((p) => p.from), periods.map((p) => p.to)],
    );
    return periods.map((period) => ({
      ...period,
      activity: rows
        .filter((r) => isoDate(r.start_date) === period.from && isoDate(r.end_date) === period.to)
        .map((r) => ({
          accountId: r.account_id,
          income: Number(r.income),
          expense: Number(r.expense),
          transfers: Number(r.transfers),
          unclassified: Number(r.unclassified),
          reserved: Number(r.reserved),
          deferredOpening: Number(r.deferred_opening),
          deferredClosing: Number(r.deferred_closing),
        })),
    }));
  }
  async monthlySummary(from: string, to: string) {
    const rows = await this.db.query(
      `WITH totals AS (
        SELECT date_trunc('month',(${reportingDateSql()}))::date AS month,
          coalesce(sum(amount_minor) FILTER(WHERE transaction_type='income'),0) AS income,
          coalesce(-sum(amount_minor) FILTER(WHERE transaction_type='expense'),0) AS expense,
          count(*) FILTER(WHERE transaction_type IN ('income','expense')) AS count,
          count(*) FILTER(WHERE transaction_type='unclassified') AS unclassified
        FROM wallet.transactions
        WHERE user_id=$1 AND reversed_at IS NULL AND (${reportingDateSql()})>=$2 AND (${reportingDateSql()})<$3
        GROUP BY 1
      )
      SELECT to_char(m.month,'YYYY-MM') AS month,coalesce(t.income,0) AS income,
        coalesce(t.expense,0) AS expense,coalesce(t.count,0) AS count,coalesce(t.unclassified,0) AS unclassified
      FROM generate_series($2::date,($3::date-interval '1 month')::date,interval '1 month') AS m(month)
      LEFT JOIN totals t ON t.month=m.month::date ORDER BY m.month`,
      [this.db.userId, from, to],
    );
    return rows.map((row) => ({
      month: row.month,
      income: exactAmount(Number(row.income)),
      expense: exactAmount(Number(row.expense)),
      count: Number(row.count),
      unclassified: Number(row.unclassified),
    }));
  }
  async summary(from: string, to: string) {
    const [r] = await this.db.query(
      `SELECT coalesce(sum(amount_minor) FILTER(WHERE transaction_type='income'),0) income,coalesce(-sum(amount_minor) FILTER(WHERE transaction_type='expense'),0) expense,count(*) FILTER(WHERE transaction_type='unclassified') unclassified FROM wallet.transactions WHERE user_id=$1 AND reversed_at IS NULL AND (${reportingDateSql()})>=$2 AND (${reportingDateSql()})<$3`,
      [this.db.userId, from, to],
    );
    const groups = await this.db.query(
      `SELECT g.id AS group_id, coalesce(g.name,'Outros') AS name,
        -sum(t.amount_minor) AS amount, count(*) AS count
       FROM wallet.transactions t
       LEFT JOIN wallet.categories c ON c.id=t.category_id AND c.type='expense'
       LEFT JOIN wallet.category_groups g ON g.id=c.group_id
       WHERE t.user_id=$1 AND t.reversed_at IS NULL AND t.transaction_type='expense'
         AND (${reportingDateSql('t')})>=$2 AND (${reportingDateSql('t')})<$3
       GROUP BY g.id,g.name ORDER BY amount DESC, name, g.id`,
      [this.db.userId, from, to],
    );
    const categories = await this.db.query(
      `SELECT c.id AS category_id,coalesce(c.name,'Outros') AS name,g.name AS group_name,
        -sum(t.amount_minor) AS amount,count(*) AS count
       FROM wallet.transactions t
       LEFT JOIN wallet.categories c ON c.id=t.category_id AND c.type='expense'
       LEFT JOIN wallet.category_groups g ON g.id=c.group_id
       WHERE t.user_id=$1 AND t.reversed_at IS NULL AND t.transaction_type='expense'
         AND (${reportingDateSql('t')})>=$2 AND (${reportingDateSql('t')})<$3
       GROUP BY c.id,c.name,g.name ORDER BY amount DESC,name,c.id`,
      [this.db.userId, from, to],
    );
    return {
      income: Number(r.income),
      expense: Number(r.expense),
      unclassified: Number(r.unclassified),
      expenseCategories: categories.map((category) => ({
        categoryId: category.category_id,
        name: category.name,
        groupName: category.group_name,
        amount: exactAmount(Number(category.amount)),
        count: Number(category.count),
      })),
      expenseGroups: groups.map((group) => ({
        groupId: group.group_id,
        name: group.name,
        amount: Number(group.amount),
        count: Number(group.count),
      })),
    };
  }
  async planningActuals(
    from: string,
    to: string,
    scope: 'all' | 'cash' | 'benefits' = 'all',
  ): Promise<PlanningActual[]> {
    const planningDate = reportingDateSql('t');
    const rows = await this.db.query(
      `SELECT t.category_id,t.transaction_type,
      coalesce(sum(t.amount_minor),0) AS total,count(*) AS count,
      coalesce(sum(t.amount_minor) FILTER(WHERE t.amount_minor>0),0) AS inflow,
      coalesce(-sum(t.amount_minor) FILTER(WHERE t.amount_minor<0),0) AS outflow
      FROM wallet.transactions t JOIN wallet.financial_accounts a
        ON a.user_id=t.user_id AND a.workspace_id=t.workspace_id AND a.id=t.account_id
      WHERE t.user_id=$1 AND t.reversed_at IS NULL AND t.transaction_type <> 'transfer'
      AND (${planningDate}) >= $2::date AND (${planningDate}) < $3::date
      AND ($4='all' OR CASE WHEN $4='benefits' THEN a.type IN ('benefit_food','benefit_meal') ELSE a.type NOT IN ('benefit_food','benefit_meal') END)
      GROUP BY t.category_id,t.transaction_type`,
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
