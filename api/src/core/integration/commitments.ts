export interface CommitmentSchedule {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: number;
  transactionType: 'income' | 'expense';
  frequency: 'once' | 'monthly';
  startDate: string;
  endDate: string | null;
  endedOn: string | null;
  version: number;
}
export interface CommitmentEntry {
  version: number;
  id: string;
  accountId: string;
  transactionDate: string;
  description: string;
  amount: number;
  transactionType: string;
}
export interface CommitmentRecord {
  scheduleId: string;
  dueDate: string;
  status: 'settled' | 'skipped' | 'review';
  transactionId: string | null;
  snapshot: Pick<
    CommitmentSchedule,
    'accountId' | 'categoryId' | 'description' | 'amount' | 'transactionType'
  >;
}
export interface CommitmentSnapshot {
  schedules: CommitmentSchedule[];
  occurrences: CommitmentRecord[];
}
export const COMMITMENT_LEDGER = Symbol('COMMITMENT_LEDGER');
export interface CommitmentLedger {
  claimEntry(
    id: string,
    purpose: 'commitment' | 'card' | 'investment',
    ownerKey: string,
  ): Promise<void>;
  releaseEntry(id: string, ownerKey: string): Promise<void>;
  commitmentEntries(ids: string[]): Promise<CommitmentEntry[]>;
  commitmentCandidates(accountId: string, from: string, to: string): Promise<CommitmentEntry[]>;
}
export const COMMITMENTS_BACKUP = Symbol('COMMITMENTS_BACKUP');
export interface CommitmentsBackup {
  exportCommitments(): Promise<CommitmentSnapshot>;
  restoreCommitments(
    data: CommitmentSnapshot,
    accounts: Map<string, string>,
    categories: Map<string, string>,
    transactions: Map<string, string>,
  ): Promise<void>;
}
