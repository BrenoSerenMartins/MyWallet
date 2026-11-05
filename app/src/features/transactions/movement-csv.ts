import type { Account, Category, Transaction } from '../../shared/api/resources';
// Quotes preserve delimiters/newlines; apostrophe prevents spreadsheet formula execution.
const cell = (value: string) =>
  '"' + (/^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
export function movementCsv(items: Transaction[], accounts: Account[], categories: Category[]) {
  const rows = [
    [
      'ID',
      'Data original',
      'Competência',
      'Descrição',
      'Conta',
      'Categoria',
      'Tipo',
      'Valor (BRL)',
      'Critério de período',
    ],
  ];
  for (const item of items)
    rows.push([
      item.id,
      item.transactionDate,
      item.reportingDate ?? item.transactionDate,
      item.description,
      accounts.find((a) => a.id === item.accountId)?.name ?? item.accountId,
      categories.find((c) => c.id === item.categoryId)?.name ?? '',
      item.transactionType,
      (item.amount / 100).toFixed(2).replace('.', ','),
      'Competência do benefício; demais lançamentos pela data original',
    ]);
  return rows
    .map((row, index) =>
      row
        .map((value, column) => (index > 0 && column === 7 ? '"' + value + '"' : cell(value)))
        .join(';'),
    )
    .join('\r\n');
}
