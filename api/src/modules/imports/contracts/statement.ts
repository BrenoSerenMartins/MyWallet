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
  balanceAfter: number;
}
export interface ParsedStatement {
  openingBalance: number;
  closingBalance: number;
  items: StatementRow[];
}
export interface ImportEntry extends StatementRow {
  transactionType: 'income' | 'expense' | 'transfer' | 'unclassified';
}
