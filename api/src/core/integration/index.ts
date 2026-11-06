export * from './budget-dto.js';
export * from './budget.js';
export * from './cards.js';
export * from './wealth.js';
export * from './managed-finance.js';
export * from './commitments.js';
export * from './balance-basis.js';
export * from './counterparty-identifier.js';
export * from './counterparties.js';

import type { SourceEvidence } from './source-evidence.js';
export * from './source-evidence.js';
export const ACCOUNT_READS = Symbol('ACCOUNT_READS');
export const CATEGORY_READS = Symbol('CATEGORY_READS');
export const LEDGER_WRITES = Symbol('LEDGER_WRITES');
export const LEDGER_READS = Symbol('LEDGER_READS');
export interface AccountResource {
  defaultIncomeCategoryId?: string | null;
  defaultExpenseCategoryId?: string | null;
  benefitCreditMonth?: 'received' | 'following';
  balanceBasis?: import('./balance-basis.js').BalanceBasis;
  canEditOpeningPosition?: boolean;
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
export interface CategoryGroupResource {
  isDefault?: boolean;
  id: string;
  name: string;
  type: string;
  color: string;
}
export interface CategoryResource {
  groupId?: string | null;
  groupName?: string | null;
  id: string;
  name: string;
  type: string;
  color: string;
  archived?: boolean;
}
export interface BalanceAdjustment {
  previousBalance: number;
  targetBalance: number;
  reason: string;
}
export interface TransactionInput {
  categoryChoiceExplicit?: boolean;
  /** Internal managed-module authorization, never exposed in public write DTOs. */
  managedKind?: import('./managed-finance.js').ManagedKind | null;
  /** Internal atomic import workflow: refresh after the entire batch, never from HTTP input. */
  deferBalanceRefresh?: boolean;
  balanceBasisIncluded?: boolean;
  sourceStoreId?: string;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  rememberCategory?: boolean;
  rememberCounterparty?: boolean;
  classificationRuleId?: string | null;
  sourceKind?: import('./counterparties.js').SourceKind;
  refundOfId?: string | null;
  balanceAdjustment?: BalanceAdjustment | null;
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
  positions(dates: string[]): Promise<import('./budget.js').HistoricalPosition[]>;
  list(): Promise<AccountResource[]>;
  find(id: string, lock?: boolean): Promise<AccountResource>;
}
export interface CategoryReads {
  list(includeArchived?: boolean): Promise<CategoryResource[]>;
  validate(id: string, type: string): Promise<void>;
}
export interface LedgerWrites {
  applyCounterpartyRelation(
    accountId: string,
    counterpartyId: string,
  ): Promise<{ linked: number; categorized: number }>;
  applyClassificationRule(ruleId: string): Promise<{ updated: number }>;
  attachRefund(transactionId: string, refundOfId: string): Promise<void>;
  create(input: TransactionInput, imported?: boolean): Promise<{ id: string }>;
  recordEvidence(transactionId: string, accountId: string, evidence: SourceEvidence): Promise<void>;
  removeBatchEvidence(batchId: string): Promise<void>;
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
  budgetActivities(
    periods: { from: string; to: string }[],
  ): Promise<{ from: string; to: string; activity: import('./budget.js').BudgetActivity[] }[]>;
  budgetActivity(from: string, to: string): Promise<import('./budget.js').BudgetActivity[]>;
  monthlySummary(
    from: string,
    to: string,
  ): Promise<
    {
      month: string;
      income: number;
      expense: number;
      count: number;
      unclassified: number;
    }[]
  >;
  planningActuals(
    from: string,
    to: string,
    scope?: 'all' | 'cash' | 'benefits',
    excludeCards?: boolean,
  ): Promise<PlanningActual[]>;
  balanceBefore(accountId: string, date: string): Promise<number>;
  summary(
    from: string,
    to: string,
  ): Promise<{
    income: number;
    expense: number;
    unclassified: number;
    expenseCategories: {
      categoryId: string | null;
      name: string;
      groupName: string | null;
      amount: number;
      count: number;
    }[];
    expenseGroups: { groupId: string | null; name: string; amount: number; count: number }[];
  }>;
}

export const COMMAND_RECEIPTS = Symbol('COMMAND_RECEIPTS');
export interface CommandReceipts {
  execute<T>(operation: string, key: string, input: unknown, action: () => Promise<T>): Promise<T>;
}

export const ACCOUNT_BACKUP = Symbol('ACCOUNT_BACKUP');
export const CATEGORY_BACKUP = Symbol('CATEGORY_BACKUP');
export const LEDGER_BACKUP = Symbol('LEDGER_BACKUP');
export interface BackupAccount {
  defaultIncomeCategoryId?: string | null;
  defaultExpenseCategoryId?: string | null;
  benefitCreditMonth?: 'received' | 'following';
  balanceBasis?: import('./balance-basis.js').BalanceBasis;
  id: string;
  name: string;
  institution: string;
  type: string;
  openingBalance: number;
  openingDate: string;
}
export interface BackupCategory {
  groupId?: string | null;
  id: string;
  name: string;
  type: string;
  color: string;
}
export interface BackupTransaction {
  categoryChoiceExplicit?: boolean;
  managedKind?: import('./managed-finance.js').ManagedKind | null;
  balanceBasisIncluded?: boolean;
  counterpartyId?: string | null;
  classificationRuleId?: string | null;
  sourceKind?: import('./counterparties.js').SourceKind;
  refundOfId?: string | null;
  balanceAdjustment?: BalanceAdjustment | null;
  id: string;
  accountId: string;
  categoryId: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: TransactionInput['transactionType'];
  transferGroupId: string | null;
  sourceOperationId: string | null;
  sourceEvidence?: SourceEvidence[];
}
export interface BackupPayload {
  format: 'plannedwallet';
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  goals?: GoalBackup;
  cards?: import('./cards.js').CardsSnapshot;
  wealth?: import('./wealth.js').WealthSnapshot;
  commitments?: import('./commitments.js').CommitmentSnapshot;
  balanceHistory?: import('./balance-basis.js').BalanceHistory[];
  counterparties?: import('./counterparties.js').CounterpartySnapshot;
  categoryGroups?: CategoryGroupResource[];
  monthlyPlans?: BackupMonthlyPlan[];
  currency: 'BRL';
  exportedAt: string;
  accounts: BackupAccount[];
  categories: BackupCategory[];
  transactions: BackupTransaction[];
}
export interface AccountBackup {
  restoreDefaults(id: string, income: string | null, expense: string | null): Promise<void>;
  exportRecords(): Promise<BackupAccount[]>;
  restoreRecord(record: BackupAccount): Promise<string>;
}
export interface CategoryBackup {
  exportGroups(): Promise<CategoryGroupResource[]>;
  restoreGroupRecord(record: CategoryGroupResource): Promise<string>;
  exportRecords(): Promise<BackupCategory[]>;
  restoreRecord(record: BackupCategory): Promise<string>;
}
export interface LedgerBackup {
  exportRecords(): Promise<BackupTransaction[]>;
  restoreRecords(
    records: BackupTransaction[],
    accounts: Map<string, string>,
    categories: Map<string, string>,
    identities?: { agents: Map<string, string>; rules: Map<string, string> },
  ): Promise<Map<string, string>>;
}

export * from './resource-dto.js';

export interface BackupMonthlyPlan {
  cardPlans?: import('./managed-finance.js').PlannedCardBill[];
  month: string;
  contribution: number | null;
  notes: string;
  lines: { categoryId: string; amount: number }[];
}
export const PLANNING_BACKUP = Symbol('PLANNING_BACKUP');
export interface PlanningBackup {
  exportRecords(): Promise<BackupMonthlyPlan[]>;
  restoreRecords(
    plans: BackupMonthlyPlan[],
    categories: Map<string, string>,
    accounts?: Map<string, string>,
  ): Promise<void>;
}

export const GOALS_READS = Symbol('GOALS_READS');
export interface GoalsReads {
  summary(): Promise<{
    goals: {
      id: string;
      name: string;
      target: number;
      allocated: number;
      remaining: number;
      deadline: string | null;
      underfunded: boolean;
      status: string;
    }[];
    accounts: { accountId: string; allocated: number; free: number; deficit: number }[];
    allocated: number;
  }>;
}

export interface GoalBackup {
  goals: {
    id: string;
    name: string;
    target: number;
    deadline: string | null;
    priority: number;
    status: string;
    allocations: {
      id: string;
      accountId: string;
      delta: number;
      reverseOfId: string | null;
      createdAt: string;
    }[];
  }[];
}
export const GOALS_BACKUP = Symbol('GOALS_BACKUP');
export interface GoalsBackup {
  exportManaged(): Promise<GoalBackup>;
  restoreManaged(data: GoalBackup, accounts: Map<string, string>): Promise<void>;
}

export const PLANNING_READS = Symbol('PLANNING_READS');
export interface PlanningReads {
  summary(
    month: string,
  ): Promise<{
    lines: {
      categoryId: string | null;
      name: string;
      type: string;
      planned: number | null;
      actual: number;
    }[];
  }>;
}
export const COMMITMENT_READS = Symbol('COMMITMENT_READS');
export interface CommitmentReads {
  summary(
    month: string,
  ): Promise<{ projection: { accountId: string; name: string; projected: number }[] }>;
}
