import { describe, expect, it } from 'vitest';
import type { CommitmentsSummary, CommitmentOccurrence } from '../../../shared/api/resources';
import { forecastPreview } from '../forecast-preview';

const occurrence = (
  id: string,
  accountId = 'cash',
  status: CommitmentOccurrence['status'] = 'pending',
  dueDate = '2026-11-10',
): CommitmentOccurrence => ({
  scheduleId: id,
  accountId,
  categoryId: null,
  description: id,
  amount: 1000,
  transactionType: 'expense',
  dueDate,
  status,
  transactionId: null,
  version: 1,
  actualAmount: null,
});
const summary = (): CommitmentsSummary => ({
  today: '2026-11-05',
  month: '2026-11',
  through: '2026-11-30',
  schedules: [],
  items: [],
  totalItems: 0,
  overdueCount: 0,
  overdueIncome: 0,
  overdueExpense: 0,
  projection: [
    {
      accountId: 'cash',
      name: 'Dinheiro',
      kind: 'cash',
      balance: 10000,
      income: 2000,
      expense: 1000,
      projected: 11000,
      overdue: 0,
    },
    {
      accountId: 'benefit',
      name: 'VA',
      kind: 'benefits',
      balance: 5000,
      income: 0,
      expense: 1000,
      projected: 4000,
      overdue: 0,
    },
  ],
});
describe('dashboard forecast preview', () => {
  it('uses cash projections and excludes completed, skipped, benefit and later occurrences', () => {
    const data = summary();
    data.items = [
      occurrence('pending'),
      occurrence('settled', 'cash', 'settled'),
      occurrence('skipped', 'cash', 'skipped'),
      occurrence('VA', 'benefit'),
      occurrence('later', 'cash', 'pending', '2026-12-01'),
    ];
    const preview = forecastPreview(data);
    expect(preview.items.map((item) => item.id)).toEqual(['pending:2026-11-10']);
    expect(preview).toMatchObject({
      income: 2000,
      expense: 1000,
      projected: 11000,
      hasPending: true,
    });
  });
  it('orders overdue occurrences and card bills with upcoming payments and retains invoice destinations', () => {
    const data = summary();
    data.items = [occurrence('next'), occurrence('overdue', 'cash', 'overdue', '2026-11-01')];
    data.cardBills = [
      {
        cardId: 'card',
        billMonth: '2026-11',
        accountId: 'cash',
        description: 'Fatura',
        dueDate: '2026-11-08',
        amount: 3000,
      },
    ];
    const preview = forecastPreview(data);
    expect(preview.items.map((item) => item.dueDate)).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-10',
    ]);
    expect(preview.items[1].href).toBe('/cards?card=card&month=2026-11');
  });
  it('shows an empty state when cash has no pending amounts, even with benefit activity', () => {
    const data = summary();
    data.projection[0] = { ...data.projection[0], income: 0, expense: 0, projected: 10000 };
    data.items = [occurrence('VA', 'benefit')];
    expect(forecastPreview(data).hasPending).toBe(false);
  });
});
