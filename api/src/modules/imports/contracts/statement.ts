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
  sourceFormat?: 'pdf' | 'csv' | 'xlsx';
  reportType?: 'account_statement' | 'settlement';
  openingBalance: number | null;
  closingBalance: number | null;
  items: StatementRow[];
}
export interface ImportEntry extends StatementRow {
  transactionType: 'income' | 'expense' | 'transfer' | 'unclassified';
}

export interface SettlementMetadata {
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
