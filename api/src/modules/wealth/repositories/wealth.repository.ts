import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type {
  InvestmentHolding,
  InvestmentEvent,
  WealthItem,
  WealthHistory,
  WealthSnapshot,
} from '../../../core/integration/index.js';
@Injectable()
export class WealthRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async lock() {
    await this.db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1||':wealth:'||wallet.current_workspace_id()::text,0))",
      [this.db.userId],
    );
  }
  async snapshot(): Promise<WealthSnapshot> {
    const get = (table: string) =>
      this.db.query(`SELECT * FROM wallet.${table} WHERE user_id=$1 ORDER BY id`, [this.db.userId]);
    const [holdings, events, items, history] = await Promise.all(
      ['investment_holdings', 'investment_events', 'wealth_items', 'wealth_history'].map(get),
    );
    return {
      holdings: holdings.map((r) => ({
        id: r.id,
        accountId: r.account_id,
        name: r.name,
        provider: r.provider,
        productType: r.product_type,
        capital: Number(r.capital_minor),
        marketValue: Number(r.market_minor),
        valuationDate: isoDate(r.valuation_date),
        valuationMethod: r.valuation_method,
        openedDate: isoDate(r.opened_date),
        lastEventId: r.last_event_id,
        archived: r.archived,
        version: r.version,
      })),
      events: events.map((r) => ({
        id: r.id,
        holdingId: r.holding_id,
        kind: r.kind,
        eventDate: isoDate(r.event_date),
        amount: Number(r.amount_minor),
        capitalRemoved: Number(r.capital_removed_minor),
        beforeState: r.before_state,
        details: r.details,
        debitId: r.debit_id,
        creditId: r.credit_id,
        resultId: r.result_id,
        linkedId: r.linked_id,
        undone: r.undone,
        undoOfId: r.undo_of_id,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        value: Number(r.value_minor),
        valuationDate: isoDate(r.valuation_date),
        notes: r.notes,
        archived: r.archived,
        version: r.version,
      })),
      history: history.map((r) => ({
        id: r.id,
        kind: r.kind,
        data: r.data,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
    };
  }
  private async insert(table: string, row: Record<string, unknown>) {
    const keys = ['user_id', ...Object.keys(row)];
    await this.db.query(
      `INSERT INTO wallet.${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
      [this.db.userId, ...Object.values(row)],
    );
  }
  saveHolding(r: InvestmentHolding) {
    return this.insert('investment_holdings', {
      id: r.id,
      account_id: r.accountId,
      name: r.name,
      provider: r.provider,
      product_type: r.productType,
      capital_minor: r.capital,
      market_minor: r.marketValue,
      valuation_date: r.valuationDate,
      valuation_method: r.valuationMethod,
      opened_date: r.openedDate,
      last_event_id: r.lastEventId,
      archived: r.archived,
      version: r.version,
    });
  }
  async updateHolding(r: InvestmentHolding) {
    await this.db.query(
      'UPDATE wallet.investment_holdings SET name=$3,provider=$4,product_type=$5,capital_minor=$6,market_minor=$7,valuation_date=$8,valuation_method=$9,last_event_id=$10,archived=$11,version=version+1 WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        r.id,
        r.name,
        r.provider,
        r.productType,
        r.capital,
        r.marketValue,
        r.valuationDate,
        r.valuationMethod,
        r.lastEventId,
        r.archived,
      ],
    );
  }
  saveEvent(r: InvestmentEvent) {
    return this.insert('investment_events', {
      id: r.id,
      holding_id: r.holdingId,
      kind: r.kind,
      event_date: r.eventDate,
      amount_minor: r.amount,
      capital_removed_minor: r.capitalRemoved,
      before_state: JSON.stringify(r.beforeState),
      details: JSON.stringify(r.details),
      debit_id: r.debitId,
      credit_id: r.creditId,
      result_id: r.resultId,
      linked_id: r.linkedId,
      undone: r.undone,
      undo_of_id: r.undoOfId,
      created_at: r.createdAt,
    });
  }
  async markUndone(id: string) {
    await this.db.query(
      'UPDATE wallet.investment_events SET undone=true WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
  saveItem(r: WealthItem) {
    return this.insert('wealth_items', {
      id: r.id,
      name: r.name,
      kind: r.kind,
      value_minor: r.value,
      valuation_date: r.valuationDate,
      notes: r.notes,
      archived: r.archived,
      version: r.version,
    });
  }
  async updateItem(r: WealthItem) {
    await this.db.query(
      'UPDATE wallet.wealth_items SET name=$3,value_minor=$4,valuation_date=$5,notes=$6,archived=$7,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, r.id, r.name, r.value, r.valuationDate, r.notes, r.archived],
    );
  }
  saveHistory(r: WealthHistory) {
    return this.insert('wealth_history', {
      id: r.id,
      kind: r.kind,
      data: JSON.stringify(r.data),
      created_at: r.createdAt,
    });
  }
}
