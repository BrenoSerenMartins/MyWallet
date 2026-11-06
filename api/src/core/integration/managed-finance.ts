import type { AccountResource, TransactionInput } from './index.js';
export type ManagedKind = 'card' | 'investment';
export interface ManagedEntry {
  refundedAmount?: number;
  id: string;
  accountId: string;
  categoryId: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: string;
  transferGroupId: string | null;
  refundOfId: string | null;
  managedKind: ManagedKind | null;
  version: number;
}
export const MANAGED_ACCOUNTS = Symbol('MANAGED_ACCOUNTS');
export interface ManagedAccounts {
  createManaged(
    name: string,
    type: 'credit_card' | 'investment',
    openingBalance?: number,
  ): Promise<AccountResource>;
}
export const MANAGED_LEDGER = Symbol('MANAGED_LEDGER');
export interface ManagedLedger {
  saveCardPaymentSource(
    input: TransactionInput,
    id?: string,
    version?: number,
  ): Promise<ManagedEntry>;
  managedEntries(ids: string[]): Promise<ManagedEntry[]>;
  managedCandidates(
    accountId: string,
    from: string,
    to: string,
    direction: 'income' | 'expense',
  ): Promise<ManagedEntry[]>;
  postManaged(input: TransactionInput, kind: ManagedKind): Promise<{ id: string }>;
  transferManaged(input: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description: string;
    kind: ManagedKind;
    existingDebitId?: string;
    existingVersion?: number;
    existingCreditId?: string;
    existingCreditVersion?: number;
    ownerKey: string;
  }): Promise<{ debitId: string; creditId: string }>;
  setManagedCategory(ids: string[], categoryId: string | null, kind: ManagedKind): Promise<void>;
  reverseManaged(id: string, version: number, kind: ManagedKind): Promise<unknown>;
  detachManagedTransfer(
    debitId: string,
    creditId: string,
    ownerKey: string,
    kind?: ManagedKind,
    preserve?: 'debit' | 'credit',
    originalDebit?: { transactionType: string; categoryId: string | null } | null,
  ): Promise<void>;
  tagManagedIncome(id: string, version: number, ownerKey: string): Promise<void>;
  untagManagedIncome(id: string, ownerKey: string): Promise<void>;
  claimEntry(id: string, purpose: 'commitment' | ManagedKind, ownerKey: string): Promise<void>;
  releaseEntry(id: string, ownerKey: string): Promise<void>;
}
export const CARD_FORECAST = Symbol('CARD_FORECAST');
export interface CardForecast {
  planningBills(month: string): Promise<PlanningCardBill[]>;
  pendingBills(through: string): Promise<
    {
      cardId: string;
      billMonth: string;
      accountId: string | null;
      description: string;
      dueDate: string;
      amount: number;
    }[]
  >;
}
export const CARDS_BACKUP = Symbol('CARDS_BACKUP');
export const WEALTH_BACKUP = Symbol('WEALTH_BACKUP');
export interface ManagedBackup<T = unknown> {
  exportManaged(): Promise<T>;
  restoreManaged(
    data: T,
    accounts: Map<string, string>,
    categories: Map<string, string>,
    transactions: Map<string, string>,
  ): Promise<void>;
}

export interface PlanningCardBill {
  pendingRecurring?: number;
  cardId: string;
  accountId: string;
  name: string;
  billMonth: string;
  dueDate: string;
  amount: number;
  paid: number;
  remaining: number;
  version: number;
  archived: boolean;
}
export interface PlannedCardBill {
  accountId: string;
  billMonth: string;
  included: boolean;
  planned?: number | null;
}
export const CARD_IMPORT_PAYMENTS = Symbol('CARD_IMPORT_PAYMENTS');
export interface CardImportPayments {
  validateImportedPayment(
    cardId: string,
    month: string,
    accountId: string,
    amount: number,
  ): Promise<void>;
  linkImportedPayment(
    cardId: string,
    month: string,
    transactionId: string,
    key: string,
  ): Promise<void>;
}
