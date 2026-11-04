import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/index.js';
import { isoDate } from '../../../core/rest/index.js';
import type {
  CreditCard,
  CreditCardBill,
  CardPurchase,
  CardBillEntry,
  CardPayment,
  CardsSnapshot,
} from '../../../core/integration/index.js';
@Injectable()
export class CardsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async lock() {
    await this.db.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1||':cards:'||wallet.current_workspace_id()::text,0))",
      [this.db.userId],
    );
  }
  async snapshot(): Promise<CardsSnapshot> {
    const get = (table: string) =>
      this.db.query(`SELECT * FROM wallet.${table} WHERE user_id=$1 ORDER BY id`, [this.db.userId]);
    const [cards, bills, purchases, entries, payments] = await Promise.all(
      [
        'credit_cards',
        'credit_card_bills',
        'card_purchases',
        'card_bill_entries',
        'card_payments',
      ].map(get),
    );
    return {
      cards: cards.map((r) => ({
        id: r.id,
        accountId: r.account_id,
        paymentAccountId: r.payment_account_id,
        name: r.name,
        closingDay: r.closing_day,
        dueDay: r.due_day,
        limit: Number(r.limit_minor),
        archived: r.archived,
        version: r.version,
      })),
      bills: bills.map((r) => ({
        id: r.id,
        cardId: r.card_id,
        month: r.month,
        closingDate: isoDate(r.closing_date),
        dueDate: isoDate(r.due_date),
      })),
      purchases: purchases.map((r) => ({
        id: r.id,
        cardId: r.card_id,
        categoryId: r.category_id,
        description: r.description,
        purchaseDate: isoDate(r.purchase_date),
        amount: Number(r.amount_minor),
        installments: r.installments,
        firstBillMonth: r.first_bill_month,
        canceled: r.canceled,
        version: r.version,
      })),
      entries: entries.map((r) => ({
        id: r.id,
        cardId: r.card_id,
        purchaseId: r.purchase_id,
        transactionId: r.transaction_id,
        billMonth: r.bill_month,
        kind: r.kind,
        installmentNumber: r.installment_number,
        amount: Number(r.amount_minor),
        description: r.description,
      })),
      payments: payments.map((r) => ({
        id: r.id,
        cardId: r.card_id,
        billMonth: r.bill_month,
        debitId: r.debit_id,
        creditId: r.credit_id,
        amount: Number(r.amount_minor),
        paymentDate: isoDate(r.payment_date),
        mode: r.mode,
        voided: r.voided,
        version: r.version,
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
  saveCard(r: CreditCard) {
    return this.insert('credit_cards', {
      id: r.id,
      account_id: r.accountId,
      payment_account_id: r.paymentAccountId,
      name: r.name,
      closing_day: r.closingDay,
      due_day: r.dueDay,
      limit_minor: r.limit,
      archived: r.archived,
      version: r.version,
    });
  }
  saveBill(r: CreditCardBill) {
    return this.insert('credit_card_bills', {
      id: r.id,
      card_id: r.cardId,
      month: r.month,
      closing_date: r.closingDate,
      due_date: r.dueDate,
    });
  }
  savePurchase(r: CardPurchase) {
    return this.insert('card_purchases', {
      id: r.id,
      card_id: r.cardId,
      category_id: r.categoryId,
      description: r.description,
      purchase_date: r.purchaseDate,
      amount_minor: r.amount,
      installments: r.installments,
      first_bill_month: r.firstBillMonth,
      canceled: r.canceled,
      version: r.version,
    });
  }
  saveEntry(r: CardBillEntry) {
    return this.insert('card_bill_entries', {
      id: r.id,
      card_id: r.cardId,
      purchase_id: r.purchaseId,
      transaction_id: r.transactionId,
      bill_month: r.billMonth,
      kind: r.kind,
      installment_number: r.installmentNumber,
      amount_minor: r.amount,
      description: r.description,
    });
  }
  savePayment(r: CardPayment) {
    return this.insert('card_payments', {
      id: r.id,
      card_id: r.cardId,
      bill_month: r.billMonth,
      debit_id: r.debitId,
      credit_id: r.creditId,
      amount_minor: r.amount,
      payment_date: r.paymentDate,
      mode: r.mode,
      voided: r.voided,
      version: r.version,
    });
  }
  async update(r: CreditCard) {
    await this.db.query(
      'UPDATE wallet.credit_cards SET name=$3,payment_account_id=$4,closing_day=$5,due_day=$6,limit_minor=$7,archived=$8,version=version+1 WHERE user_id=$1 AND id=$2',
      [
        this.db.userId,
        r.id,
        r.name,
        r.paymentAccountId,
        r.closingDay,
        r.dueDay,
        r.limit,
        r.archived,
      ],
    );
  }
  async bump(id: string) {
    await this.db.query(
      'UPDATE wallet.credit_cards SET version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
  async cancelPurchase(id: string) {
    await this.db.query(
      'UPDATE wallet.card_purchases SET canceled=true,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
  async category(id: string, categoryId: string | null) {
    await this.db.query(
      'UPDATE wallet.card_purchases SET category_id=$3,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id, categoryId],
    );
  }
  async voidPayment(id: string) {
    await this.db.query(
      'UPDATE wallet.card_payments SET voided=true,version=version+1 WHERE user_id=$1 AND id=$2',
      [this.db.userId, id],
    );
  }
}
