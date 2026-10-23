export const ACCOUNT_READS = Symbol('ACCOUNT_READS');
export const CATEGORY_READS = Symbol('CATEGORY_READS');
export const LEDGER_WRITES = Symbol('LEDGER_WRITES');
export const LEDGER_READS = Symbol('LEDGER_READS');
export interface AccountResource {
  id: string;
  name: string;
  institution: string;
  type: string;
  currency: string;
  openingBalance: number;
  openingDate: string;
  balance: number;
  version: number;
  archived: boolean;
}
export interface CategoryResource {
  id: string;
  name: string;
  type: string;
  color: string;
  archived?: boolean;
}
export interface TransactionInput {
  accountId: string;
  categoryId?: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: 'income' | 'expense' | 'transfer' | 'unclassified';
  sourceOperationId?: string | null;
  importBatchId?: string;
  sourceRow?: number;
  transferGroupId?: string;
}
export interface AccountReads {
  list(): Promise<AccountResource[]>;
  find(id: string, lock?: boolean): Promise<AccountResource>;
}
export interface CategoryReads {
  list(includeArchived?: boolean): Promise<CategoryResource[]>;
  validate(id: string, type: string): Promise<void>;
}
export interface LedgerWrites {
  create(input: TransactionInput, imported?: boolean): Promise<unknown>;
  reverseBatch(batchId: string): Promise<void>;
}
export interface PlanningActual {
  categoryId: string | null;
  type: string;
  amount: number;
  count: number;
  inflow: number;
  outflow: number;
}
export interface LedgerReads {
  planningActuals(from: string, to: string): Promise<PlanningActual[]>;
  balanceBefore(accountId: string, date: string): Promise<number>;
  summary(
    from: string,
    to: string,
  ): Promise<{ income: number; expense: number; unclassified: number }>;
}

export const COMMAND_RECEIPTS = Symbol('COMMAND_RECEIPTS');
export interface CommandReceipts {
  execute<T>(operation: string, key: string, input: unknown, action: () => Promise<T>): Promise<T>;
}

export const ACCOUNT_BACKUP = Symbol('ACCOUNT_BACKUP');
export const CATEGORY_BACKUP = Symbol('CATEGORY_BACKUP');
export const LEDGER_BACKUP = Symbol('LEDGER_BACKUP');
export interface BackupAccount {
  id: string;
  name: string;
  institution: string;
  type: string;
  openingBalance: number;
  openingDate: string;
}
export interface BackupCategory {
  id: string;
  name: string;
  type: string;
  color: string;
}
export interface BackupTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: TransactionInput['transactionType'];
  transferGroupId: string | null;
  sourceOperationId: string | null;
}
export interface BackupPayload {
  format: 'mywallet';
  version: 1 | 2;
  monthlyPlans?: BackupMonthlyPlan[];
  currency: 'BRL';
  exportedAt: string;
  accounts: BackupAccount[];
  categories: BackupCategory[];
  transactions: BackupTransaction[];
}
export interface AccountBackup {
  exportRecords(): Promise<BackupAccount[]>;
  restoreRecord(record: BackupAccount): Promise<string>;
}
export interface CategoryBackup {
  exportRecords(): Promise<BackupCategory[]>;
  restoreRecord(record: BackupCategory): Promise<string>;
}
export interface LedgerBackup {
  exportRecords(): Promise<BackupTransaction[]>;
  restoreRecords(
    records: BackupTransaction[],
    accounts: Map<string, string>,
    categories: Map<string, string>,
  ): Promise<void>;
}

export * from './resource-dto.js';

export interface BackupMonthlyPlan {
  month: string;
  contribution: number | null;
  notes: string;
  lines: { categoryId: string; amount: number }[];
}
export const PLANNING_BACKUP = Symbol('PLANNING_BACKUP');
export interface PlanningBackup {
  exportRecords(): Promise<BackupMonthlyPlan[]>;
  restoreRecords(plans: BackupMonthlyPlan[], categories: Map<string, string>): Promise<void>;
}
