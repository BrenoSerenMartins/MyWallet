import type { TransactionInput } from './index.js';
export type SourceKind = 'manual' | 'account_statement' | 'settlement' | 'benefit_statement';
export interface CounterpartyRecord {
  id: string;
  name: string;
  enabled: boolean;
  version: number;
}
export type CounterpartyIdentifierKind = 'description' | 'store_id';
export interface CounterpartyIdentifier {
  identifierKind?: CounterpartyIdentifierKind;
  enabled: boolean;
  id: string;
  counterpartyId: string;
  accountId: string;
  sourceKind: SourceKind;
  value: string;
}
export interface ClassificationRule {
  id: string;
  counterpartyId: string;
  accountId: string;
  transactionType: 'income' | 'expense';
  categoryId: string;
  enabled: boolean;
  version: number;
}
export interface CounterpartySnapshot {
  agents: CounterpartyRecord[];
  identifiers: CounterpartyIdentifier[];
  rules: ClassificationRule[];
}
export const COUNTERPARTY_RULES = Symbol('COUNTERPARTY_RULES');
export interface CounterpartyRules {
  suggest(
    accountId: string,
    sourceKind: SourceKind,
    entries: Pick<
      TransactionInput,
      | 'description'
      | 'transactionType'
      | 'categoryId'
      | 'counterpartyId'
      | 'counterpartyName'
      | 'sourceStoreId'
    >[],
  ): Promise<ClassificationSuggestion[]>;
  resolve(input: TransactionInput, automatic: boolean): Promise<TransactionInput>;
  observe(
    counterpartyId: string,
    accountId: string,
    sourceKind: SourceKind,
    description: string,
    storeId?: string,
  ): Promise<void>;
  snapshot(): Promise<CounterpartySnapshot>;
  restore(
    snapshot: CounterpartySnapshot,
    accounts: Map<string, string>,
    categories: Map<string, string>,
  ): Promise<{ agents: Map<string, string>; rules: Map<string, string> }>;
}
export interface ClassificationSuggestion {
  counterpartyId: string | null;
  categoryId: string | null;
  classificationRuleId: string | null;
}
