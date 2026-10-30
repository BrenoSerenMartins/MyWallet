export interface BalanceBasis {
  kind: 'unknown' | 'legacy' | 'statement' | 'manual';
  referenceDate?: string;
  referenceBalance?: number;
  originId?: string;
  importId?: string;
  reviewRequired?: boolean;
  reviewReason?: 'same_day' | 'statement_conflict';
}
export interface BalanceHistory {
  id: string;
  accountId: string;
  operation: 'manual' | 'statement' | 'rebase' | 'undo' | 'legacy_conversion';
  previousBase: number;
  newBase: number;
  previousBasis: BalanceBasis;
  newBasis: BalanceBasis;
  reason: string;
  details: Record<string, unknown>;
  undoOfId: string | null;
  createdAt: string;
}
export interface BalanceCorrectionInput {
  targetBalance: number;
  expectedBalance: number;
  expectedVersion?: number;
  reason: string;
}
export const ACCOUNT_BALANCE_BASIS = Symbol('ACCOUNT_BALANCE_BASIS');
export interface AccountBalanceBasis {
  correct(accountId: string, input: BalanceCorrectionInput): Promise<BalanceHistory>;
  refresh(accountId: string, importedDate?: string): Promise<void>;
  considerStatement(
    accountId: string,
    importId: string,
  ): Promise<{ status: string; difference?: number }>;
  removeStatement(accountId: string, importId: string): Promise<void>;
  exportHistory(): Promise<BalanceHistory[]>;
  restoreBackup(
    accounts: import('./index.js').BackupAccount[],
    transactions: import('./index.js').BackupTransaction[],
    history: BalanceHistory[],
    mapping: Map<string, string>,
    transactionIds: Map<string, string>,
  ): Promise<void>;
}
