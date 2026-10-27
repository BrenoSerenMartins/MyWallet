export interface TextCell {
  text: string;
  x: number;
  y: number;
}
export interface StatementRow {
  sourceRow: number;
  sourcePage: number;
  transactionDate: string;
  description: string;
  sourceOperationId: string | null;
  amount: number;
  balanceAfter: number | null;
  metadata?: SettlementMetadata;
}
export interface ParsedStatement {
  institution?: 'mercado_pago' | 'alelo';
  sourceFormat?: 'pdf' | 'csv' | 'xlsx';
  reportType?: 'account_statement' | 'settlement' | 'benefit_statement';
  openingBalance: number | null;
  closingBalance: number | null;
  items: StatementRow[];
}
export interface ImportEntry extends StatementRow {
  transactionType: 'income' | 'expense' | 'transfer' | 'unclassified';
}

export interface SettlementMetadata {
  storeName?: string;
  storeId?: string;
  isReleased?: boolean | null;
  releaseTimestamp?: string | null;
  installmentNetAmount?: number | null;
  eventType: string;
  transactionTimestamp: string;
  settlementTimestamp: string;
  currency: string;
  grossAmount: number;
  netAmount: number;
  realAmount: number | null;
  fees: number | null;
  taxes: number | null;
  paymentMethod: string | null;
  paymentMethodType: string | null;
  brand: string | null;
  installments: number | null;
  installmentNumber: number | null;
  lastFourDigits: string | null;
}

export interface CounterpartyIntent {
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  rememberCategory?: boolean;
  rememberCounterparty?: boolean;
}
export interface SavedImportItem
  extends CounterpartyIntent, Omit<StatementRow, 'sourcePage' | 'metadata'> {
  id: string;
  metadata: SettlementMetadata | null;
  transactionType: ImportEntry['transactionType'];
  selected: boolean;
  duplicateCandidate: boolean;
  categoryId: string | null;
  linkedTransactionId?: string | null;
  confirmNew?: boolean;
  refundOfId?: string | null;
}
export interface ReprocessedImportEntry extends CounterpartyIntent, ImportEntry {
  id: string;
  selected: boolean;
  duplicateCandidate: boolean;
  categoryId: string | null;
  linkedTransactionId?: string | null;
  confirmNew?: boolean;
  refundOfId?: string | null;
}
