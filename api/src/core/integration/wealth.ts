export interface InvestmentHolding {
  id: string;
  accountId: string;
  name: string;
  provider: string;
  productType: 'fixed_income' | 'fund' | 'stock' | 'etf' | 'crypto' | 'other';
  capital: number;
  marketValue: number;
  valuationDate: string;
  valuationMethod: 'manual' | 'flow_estimate';
  openedDate: string;
  lastEventId: string | null;
  archived: boolean;
  version: number;
}
export interface InvestmentEvent {
  id: string;
  holdingId: string;
  kind: 'contribution' | 'redemption' | 'income' | 'valuation' | 'capital' | 'edit' | 'undo';
  eventDate: string;
  amount: number;
  capitalRemoved: number;
  beforeState: InvestmentHolding;
  details: Record<string, unknown>;
  debitId: string | null;
  creditId: string | null;
  resultId: string | null;
  linkedId: string | null;
  undone: boolean;
  undoOfId: string | null;
  createdAt: string;
}
export interface WealthItem {
  id: string;
  name: string;
  kind: 'asset' | 'debt';
  value: number;
  valuationDate: string;
  notes: string;
  archived: boolean;
  version: number;
}
export interface WealthHistory {
  id: string;
  kind: 'snapshot' | 'item_change';
  data: Record<string, unknown>;
  createdAt: string;
}
export interface WealthSnapshot {
  holdings: InvestmentHolding[];
  events: InvestmentEvent[];
  items: WealthItem[];
  history: WealthHistory[];
}
