import { exactAmount } from '../rest/index.js';
export interface HistoricalPosition {
  accountId: string;
  date: string;
  balance: number | null;
  referenceDate: string | null;
  reason: string | null;
}
export interface BudgetActivity {
  accountId: string;
  income: number;
  expense: number;
  transfers: number;
  unclassified: number;
  reserved: number;
  deferredOpening: number;
  deferredClosing: number;
}
export interface BudgetAccount {
  accountId: string;
  name: string;
  type: string;
  openingBankBalance: number | null;
  closingBankBalance: number | null;
  deferredOpening: number;
  deferredClosing: number;
  carried: number | null;
  available: number | null;
  income: number;
  expense: number;
  transfers: number;
  reserved: number;
  unclassified: number;
  adjustments: number | null;
  referenceDate: string | null;
  reason: string | null;
}
export interface PeriodBudget {
  from: string;
  to: string;
  coverage: 'complete' | 'partial' | 'unavailable';
  carried: number | null;
  available: number | null;
  income: number;
  expense: number;
  transfers: number;
  reserved: number;
  unclassified: number;
  adjustments: number | null;
  accounts: BudgetAccount[];
}
export function periodBudget(
  from: string,
  to: string,
  accounts: { id: string; name: string; type: string }[],
  positions: HistoricalPosition[],
  activity: BudgetActivity[],
  scope: 'all' | 'cash' | 'benefits' = 'all',
): PeriodBudget {
  const rows = accounts
    .filter((a) => !['reserve', 'credit_card', 'investment'].includes(a.type))
    .filter(
      (a) =>
        scope === 'all' ||
        ['benefit_food', 'benefit_meal'].includes(a.type) === (scope === 'benefits'),
    )
    .map((a): BudgetAccount => {
      const opening = positions.find((p) => p.accountId === a.id && p.date === from);
      const closing = positions.find((p) => p.accountId === a.id && p.date === to);
      const flow = activity.find((p) => p.accountId === a.id);
      const income = flow?.income ?? 0,
        expense = flow?.expense ?? 0;
      const deferredOpening = flow?.deferredOpening ?? 0,
        deferredClosing = flow?.deferredClosing ?? 0;
      const carried =
        opening?.balance == null ? null : exactAmount(opening.balance - deferredOpening);
      const available =
        closing?.balance == null ? null : exactAmount(closing.balance - deferredClosing);
      const transfers = flow?.transfers ?? 0,
        unclassified = flow?.unclassified ?? 0;
      return {
        accountId: a.id,
        name: a.name,
        type: a.type,
        openingBankBalance: opening?.balance ?? null,
        closingBankBalance: closing?.balance ?? null,
        carried,
        available,
        income,
        expense,
        deferredOpening,
        deferredClosing,
        transfers,
        unclassified,
        reserved: flow?.reserved ?? 0,
        adjustments:
          carried == null || available == null
            ? null
            : exactAmount(available - carried - income + expense - transfers - unclassified),
        referenceDate: opening?.referenceDate ?? null,
        reason: opening?.reason ?? closing?.reason ?? null,
      };
    });
  const complete = rows.every((a) => a.carried !== null && a.available !== null);
  const sum = (key: 'income' | 'expense' | 'transfers' | 'reserved' | 'unclassified') =>
    exactAmount(rows.reduce((n, a) => n + a[key], 0));
  return {
    from,
    to,
    coverage: complete
      ? 'complete'
      : rows.some((a) => a.carried !== null || a.available !== null)
        ? 'partial'
        : 'unavailable',
    carried: rows.every((a) => a.carried !== null)
      ? exactAmount(rows.reduce((n, a) => n + a.carried!, 0))
      : null,
    available: rows.every((a) => a.available !== null)
      ? exactAmount(rows.reduce((n, a) => n + a.available!, 0))
      : null,
    adjustments: complete ? exactAmount(rows.reduce((n, a) => n + a.adjustments!, 0)) : null,
    income: sum('income'),
    expense: sum('expense'),
    transfers: sum('transfers'),
    reserved: sum('reserved'),
    unclassified: sum('unclassified'),
    accounts: rows,
  };
}
