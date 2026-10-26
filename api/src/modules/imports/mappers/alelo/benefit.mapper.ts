import type { ImportEntry, ParsedStatement } from '../../contracts/statement.js';
export function mapAlelo(statement: ParsedStatement): ImportEntry[] {
  return statement.items.map((item) => ({
    ...item,
    transactionType:
      item.amount < 0
        ? 'expense'
        : /^Seu Benefício Caiu$/i.test(item.description.trim()) && item.amount > 0
          ? 'income'
          : 'unclassified',
  }));
}
