import type { CommitmentsSummary } from '../../shared/api/resources';

export function forecastPreview(data: CommitmentsSummary) {
  const cash = data.projection.filter((account) => account.kind === 'cash');
  const accounts = new Map(cash.map((account) => [account.accountId, account.name]));
  const total = (field: 'income' | 'expense' | 'projected') =>
    cash.reduce((sum, row) => sum + row[field], 0);
  const items = [
    ...data.items
      .filter(
        (item) =>
          accounts.has(item.accountId) &&
          ['pending', 'overdue', 'review'].includes(item.status) &&
          item.dueDate <= data.through,
      )
      .map((item) => ({
        id: `${item.scheduleId}:${item.dueDate}`,
        description: item.description,
        dueDate: item.dueDate,
        amount: item.amount,
        type: item.transactionType,
        account: accounts.get(item.accountId)!,
        href: undefined as string | undefined,
      })),
    ...(data.cardBills ?? [])
      .filter((bill) => accounts.has(bill.accountId) && bill.dueDate <= data.through)
      .map((bill) => ({
        id: `card:${bill.cardId}:${bill.billMonth}`,
        description: bill.description,
        dueDate: bill.dueDate,
        amount: bill.amount,
        type: 'expense' as const,
        account: accounts.get(bill.accountId)!,
        href: `/cards?card=${bill.cardId}&month=${bill.billMonth}`,
      })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  return {
    items,
    income: total('income'),
    expense: total('expense'),
    projected: total('projected'),
    hasPending: items.length > 0 || total('income') > 0 || total('expense') > 0,
  };
}
