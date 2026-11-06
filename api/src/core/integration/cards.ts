export interface CreditCardBill {
  id: string;
  cardId: string;
  month: string;
  closingDate: string;
  dueDate: string;
}
export interface CreditCard {
  id: string;
  accountId: string;
  paymentAccountId: string | null;
  name: string;
  closingDay: number;
  dueDay: number;
  limit: number;
  archived: boolean;
  version: number;
}
export interface CardPurchase {
  id: string;
  cardId: string;
  categoryId: string | null;
  description: string;
  purchaseDate: string;
  amount: number;
  installments: number;
  firstBillMonth: string;
  canceled: boolean;
  version: number;
}
export interface CardBillEntry {
  id: string;
  cardId: string;
  purchaseId: string | null;
  transactionId: string | null;
  billMonth: string;
  kind: 'purchase' | 'opening' | 'refund';
  installmentNumber: number | null;
  amount: number;
  description: string;
}
export interface CardPayment {
  originalDebit?: { transactionType: string; categoryId: string | null } | null;
  id: string;
  cardId: string;
  billMonth: string;
  debitId: string | null;
  creditId: string | null;
  amount: number;
  paymentDate: string;
  mode: 'create' | 'link';
  voided: boolean;
  version: number;
}
export interface CardsSnapshot {
  cards: CreditCard[];
  bills: CreditCardBill[];
  purchases: CardPurchase[];
  entries: CardBillEntry[];
  payments: CardPayment[];
}
