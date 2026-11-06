import { DashboardService } from '../../dashboard/services/dashboard.service.js';
import { BalanceBasisService } from '../../accounts/services/balance-basis.service.js';
import { BalanceBasisRepository } from '../../accounts/repositories/balance-basis.repository.js';
import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestDatabase } from '../../../../test/database-harness.js';
import { AccountsService } from '../../accounts/services/accounts.service.js';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { LedgerRepository } from '../../ledger/repositories/ledger.repository.js';
import { IdempotencyService } from '../../ledger/services/idempotency.service.js';
import { PlanningRepository } from '../repositories/planning.repository.js';
import { PlanningService } from '../services/planning.service.js';
import { WorkspacesService } from '../../workspaces/services/workspaces.service.js';
import { WorkspacesRepository } from '../../workspaces/repositories/workspaces.repository.js';
import { DataExportService } from '../../data-export/services/data-export.service.js';
import { RestoreRepository } from '../../data-export/repositories/restore.repository.js';
import { validateBackup } from '../../data-export/services/backup-validation.js';
import { planningPeriod } from '../services/planning-period.js';
import { validateInput } from '../../../core/http/index.js';
import { SaveMonthlyPlanDto } from '../dto/planning.dto.js';
const db = new TestDatabase();
const balanceBasis = new BalanceBasisService(new BalanceBasisRepository(db.service));
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const receipts = new IdempotencyService(db.service);
const counterparties = new CounterpartiesService(
  new CounterpartiesRepository(db.service),
  accounts,
  categories,
);
const ledger = new LedgerService(
  new LedgerRepository(db.service),
  accounts,
  categories,
  receipts,
  counterparties,
  balanceBasis,
);
const planning = new PlanningService(
  new PlanningRepository(db.service),
  categories,
  ledger,
  accounts,
);
const backups = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  planning,
  counterparties,
  balanceBasis,
);
let income: string, expense: string, zero: string, account: string, otherSpace: string;
beforeAll(async () => {
  await db.initialize();
  otherSpace = (
    await db.forUser(
      db.user,
      () =>
        new WorkspacesService(new WorkspacesRepository(db.service)).create({
          name: 'Other',
          description: '',
          color: 'blue',
        }),
      false,
      null,
    )
  ).id;
  await db.forUser(db.user, async () => {
    income = (await categories.save({ name: 'Salary', type: 'income', color: '#123456' })).id;
    expense = (await categories.save({ name: 'Food', type: 'expense', color: '#123456' })).id;
    zero = (await categories.save({ name: 'Leisure', type: 'expense', color: '#123456' })).id;
    account = (
      await accounts.create({
        name: 'Cash',
        institution: 'other',
        type: 'cash',
        openingBalance: 10000,
        openingDate: '2026-01-01',
      })
    ).id;
    const reserve = (
      await accounts.create({
        name: 'Reserve',
        institution: 'other',
        type: 'reserve',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
    ).id;
    for (const [categoryId, amount, type] of [
      [income, 100000, 'income'],
      [expense, -25000, 'expense'],
      [null, -1000, 'expense'],
      [null, 2000, 'unclassified'],
      [null, -3000, 'unclassified'],
    ] as const)
      await ledger.create(
        {
          accountId: account,
          categoryId,
          amount,
          transactionType: type,
          transactionDate: '2026-02-02',
          description: 'Synthetic entry',
        },
        true,
      );
    const reversed = await ledger.create({
      accountId: account,
      categoryId: expense,
      amount: -999,
      transactionType: 'expense',
      transactionDate: '2026-02-03',
      description: 'Reversed',
    });
    await ledger.reverse(reversed.id, '1');
    await ledger.transfer(
      {
        fromAccountId: account,
        toAccountId: reserve,
        amount: 20000,
        transactionDate: '2026-02-04',
        description: 'Contribution',
      },
      'planning-transfer',
    );
  });
});
afterAll(() => db.close());
const input = (version = 0) => ({
  version,
  notes: 'February plan',
  contribution: 20000,
  lines: [
    { categoryId: income, amount: 120000 },
    { categoryId: expense, amount: 30000 },
    { categoryId: zero, amount: 0 },
  ],
});
describe('Monthly planning financial invariants', () => {
  it('reads actuals without transfers/reversals and keeps unclassified cash visible', async () => {
    const plan = await db.forUser(db.user, () => planning.summary('2026-02'), true);
    expect(plan.version).toBe(0);
    expect(plan.totals).toMatchObject({
      plannedIncome: null,
      plannedExpense: null,
      plannedResult: null,
      afterContribution: null,
      incomeDifference: null,
      expenseDifference: null,
      resultDifference: null,
      actualIncome: 100000,
      actualExpense: 26000,
      actualResult: 74000,
      missingCategoryCount: 1,
      unclassifiedCount: 2,
      unclassifiedInflow: 2000,
      unclassifiedOutflow: 3000,
    });
  });
  it('saves budgets without changing balances and preserves explicit zero', async () => {
    const before = await db.forUser(db.user, () => accounts.list());
    const saved = await db.forUser(db.user, () => planning.save('2026-02', input()));
    expect(saved.version).toBe(1);
    expect(
      saved.lines.find((line) => line.categoryId === null && line.type === 'expense'),
    ).toMatchObject({ name: 'Outros', groupName: 'Outros', actual: 1000, transactionCount: 1 });
    expect(saved.totals).toMatchObject({
      incomeDifference: -20000,
      expenseDifference: 4000,
      resultDifference: -16000,
    });
    expect(saved.totals).toMatchObject({
      plannedIncome: 120000,
      plannedExpense: 30000,
      plannedResult: 90000,
      afterContribution: 70000,
    });
    expect(saved.lines.find((l) => l.categoryId === zero)?.planned).toBe(0);
    expect(saved.lines.find((l) => l.categoryId === income)?.difference).toBe(-20000);
    expect(saved.lines.find((l) => l.categoryId === expense)?.difference).toBe(5000);
    expect(await db.forUser(db.user, () => accounts.list())).toEqual(before);
    await expect(db.forUser(db.user, () => planning.save('2026-02', input()))).rejects.toThrow(
      'mudou',
    );
  });
  it('copies only planned values, preserves target notes and rejects changed preview versions', async () => {
    await db.forUser(db.user, () =>
      planning.save('2026-03', { ...input(), notes: 'Keep March notes', lines: [] }),
    );
    const count = (await db.forUser(db.user, () => ledger.exportRecords())).length;
    const copy = await db.forUser(db.user, () =>
      planning.copyPrevious('2026-03', { version: 1, sourceVersion: 1 }),
    );
    expect(copy.notes).toBe('Keep March notes');
    expect(copy.totals.actualIncome).toBe(0);
    expect(copy.totals.plannedIncome).toBe(120000);
    expect((await db.forUser(db.user, () => ledger.exportRecords())).length).toBe(count);
    await expect(
      db.forUser(db.user, () => planning.copyPrevious('2026-03', { version: 1, sourceVersion: 1 })),
    ).rejects.toThrow('mudou');
    await expect(
      db.forUser(db.user, () =>
        planning.copyPrevious('2026-03', { version: 2, sourceVersion: 99 }),
      ),
    ).rejects.toThrow('mudou');
  });
  it('enforces workspace isolation, scoped category references and unique lines', async () => {
    expect(
      (await db.forUser(db.user, () => planning.summary('2026-02'), true, otherSpace)).version,
    ).toBe(0);
    expect(
      (await db.forUser(db.other, () => planning.summary('2026-02'), true)).totals.actualIncome,
    ).toBe(0);
    await expect(
      db.forUser(db.user, () => planning.save('2026-02', input()), false, otherSpace),
    ).rejects.toThrow('Categoria');
    await expect(
      db.forUser(db.user, () =>
        planning.save('2026-04', { ...input(), lines: [input().lines[0], input().lines[0]] }),
      ),
    ).rejects.toThrow('duas vezes');
    await expect(
      db.forUser(
        db.user,
        () =>
          db.service.query(
            'INSERT INTO wallet.monthly_plan_lines(user_id,plan_id,category_id,amount_minor) VALUES($1,$2,$3,1)',
            [db.user, randomUUID(), income],
          ),
        false,
        otherSpace,
      ),
    ).rejects.toThrow();
  });
  it('exports/restores plans with remapped categories and blocks month conflicts atomically', async () => {
    const group = await db.forUser(db.user, async () => {
      const created = await categories.saveGroup({
        name: 'Casa',
        type: 'expense',
        color: '#5ee9b5',
      });
      const category = (await categories.list()).find((c) => c.id === expense)!;
      await categories.update(expense, {
        name: category.name,
        type: category.type,
        color: category.color,
        groupId: created.id,
      });
      return created;
    });
    const backup = await db.forUser(db.user, () => backups.backup(), true);
    expect(backup.version).toBe(12);
    expect(backup.categoryGroups?.[0].id).toBe(group.id);
    expect(backup.monthlyPlans).toHaveLength(2);
    await db.forUser(db.other, async () => {
      const draft = await backups.preview(backup);
      await backups.confirm(draft.id);
      const restored = await planning.summary('2026-02');
      expect(restored.totals.plannedIncome).toBe(120000);
      expect(restored.lines.some((l) => l.categoryId === income)).toBe(false);
      const grouped = restored.lines.find((l) => l.groupName === 'Casa');
      expect(grouped).toBeDefined();
      expect(grouped?.groupId).not.toBe(group.id);
    });
    const count = (await db.forUser(db.other, () => accounts.list())).length;
    const modified = { ...backup, exportedAt: '2026-05-01T00:00:00Z' };
    const draft = await db.forUser(db.other, () => backups.preview(modified));
    await expect(db.forUser(db.other, () => backups.confirm(draft.id))).rejects.toThrow(
      'Já existe um planejamento',
    );
    expect((await db.forUser(db.other, () => accounts.list())).length).toBe(count);
    const legacy = {
      ...backup,
      categoryGroups: undefined,
      commitments: undefined,
      cards: undefined,
      wealth: undefined,
      categories: backup.categories.map(({ groupId: _group, ...category }) => category),
    };
    expect(validateBackup({ ...legacy, version: 1, monthlyPlans: undefined }).monthlyPlans).toEqual(
      [],
    );
    expect(validateBackup({ ...legacy, version: 2 }).monthlyPlans).toHaveLength(2);
    expect(() => validateBackup({ ...backup, categoryGroups: [] })).toThrow();
    expect(() =>
      validateBackup({
        ...backup,
        monthlyPlans: [
          { ...backup.monthlyPlans![0], lines: [{ categoryId: randomUUID(), amount: 1 }] },
        ],
      }),
    ).toThrow();
  });
  it('validates months, negative budgets, nested lines and month rollover', async () => {
    expect(planningPeriod('2026-01').previous).toBe('2025-12');
    expect(planningPeriod('2024-02').to).toBe('2024-03-01');
    for (const month of ['2026-00', '2026-13', '2026-1', 'bad', '9999-01'])
      expect(() => planningPeriod(month)).toThrow();
    await expect(
      validateInput(SaveMonthlyPlanDto, {
        ...input(),
        lines: [{ categoryId: income, amount: -1 }],
      }),
    ).rejects.toThrow();
    await expect(
      validateInput(SaveMonthlyPlanDto, {
        ...input(),
        lines: [{ categoryId: income, amount: 1, owner: 'fake' }],
      }),
    ).rejects.toThrow();
  });
});

it('counts uncategorized income and expenses exactly once and preserves totals when they receive a category', async () => {
  await db.forUser(db.user, async () => {
    const received = await ledger.create({
      accountId: account,
      amount: 10000,
      transactionDate: '2026-04-03',
      description: 'Uncategorized receipt',
      transactionType: 'income',
    });
    const paid = await ledger.create({
      accountId: account,
      amount: -2500,
      transactionDate: '2026-04-03',
      description: 'Uncategorized expense',
      transactionType: 'expense',
    });
    const before = await planning.summary('2026-04');
    expect(before.totals).toMatchObject({
      actualIncome: 10000,
      actualExpense: 2500,
      actualResult: 7500,
      missingCategoryCount: 2,
    });
    expect(before.lines.filter((line) => line.categoryId === null)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Outros', type: 'income', actual: 10000 }),
        expect.objectContaining({ name: 'Outros', type: 'expense', actual: 2500 }),
      ]),
    );
    await ledger.update(
      received.id,
      {
        accountId: account,
        categoryId: income,
        amount: 10000,
        transactionDate: '2026-04-03',
        description: 'Uncategorized receipt',
        transactionType: 'income',
      },
      String(received.version),
    );
    await ledger.update(
      paid.id,
      {
        accountId: account,
        categoryId: expense,
        amount: -2500,
        transactionDate: '2026-04-03',
        description: 'Uncategorized expense',
        transactionType: 'expense',
      },
      String(paid.version),
    );
    const after = await planning.summary('2026-04');
    expect(after.totals).toMatchObject({
      actualIncome: 10000,
      actualExpense: 2500,
      actualResult: 7500,
      missingCategoryCount: 0,
    });
    expect(after.lines.filter((line) => line.categoryId === null)).toEqual([]);
  });
});

describe('Overview expense groups', () => {
  it('keeps group totals equal to signed period expenses across refunds, benefits, reversals and workspace isolation', async () => {
    const groupId = await db.forUser(db.user, async () => {
      const group = await categories.saveGroup({
        name: 'Overview group',
        type: 'expense',
        color: '#f28a97',
      });
      const firstCategory = (
        await categories.save({
          name: 'Overview food',
          type: 'expense',
          color: '#f28a97',
          groupId: group.id,
        })
      ).id;
      const secondCategory = (
        await categories.save({
          name: 'Overview leisure',
          type: 'expense',
          color: '#f28a97',
          groupId: group.id,
        })
      ).id;
      const original = await ledger.create({
        accountId: account,
        categoryId: firstCategory,
        amount: -4000,
        transactionType: 'expense',
        transactionDate: '2027-01-31',
        description: 'Prior month purchase',
      });
      await ledger.create({
        accountId: account,
        categoryId: firstCategory,
        amount: 1500,
        transactionType: 'expense',
        refundOfId: original.id,
        transactionDate: '2027-02-01',
        description: 'Current month refund',
      });
      await ledger.create({
        accountId: account,
        categoryId: secondCategory,
        amount: -500,
        transactionType: 'expense',
        transactionDate: '2027-02-02',
        description: 'Same group, second category',
      });
      await ledger.create({
        accountId: account,
        categoryId: null,
        amount: -2000,
        transactionType: 'expense',
        transactionDate: '2027-02-28',
        description: 'Uncategorized expense',
      });
      const benefit = await accounts.create({
        name: 'Overview benefit',
        institution: 'alelo',
        type: 'benefit_food',
        openingBalance: 0,
        openingDate: '2026-01-01',
      });
      await ledger.create({
        accountId: benefit.id,
        categoryId: firstCategory,
        amount: -700,
        transactionType: 'expense',
        transactionDate: '2027-02-03',
        description: 'Benefit expense',
      });
      await ledger.create({
        accountId: account,
        amount: 5000,
        transactionType: 'income',
        transactionDate: '2027-02-03',
        description: 'Income excluded from expenses',
      });
      await ledger.create(
        {
          accountId: account,
          amount: -300,
          transactionType: 'unclassified',
          transactionDate: '2027-02-03',
          description: 'Unknown excluded from expenses',
        },
        true,
      );
      await ledger.create(
        {
          accountId: account,
          amount: -1000,
          transactionType: 'transfer',
          transactionDate: '2027-02-03',
          description: 'Transfer excluded from expenses',
        },
        true,
      );
      const reversed = await ledger.create({
        accountId: account,
        amount: -999,
        transactionType: 'expense',
        transactionDate: '2027-02-03',
        description: 'Reversed expense',
      });
      await ledger.reverse(reversed.id, '1');
      await ledger.create({
        accountId: account,
        amount: -8000,
        transactionType: 'expense',
        transactionDate: '2027-03-01',
        description: 'Outside exclusive end date',
      });
      return group.id;
    });
    const summary = await db.forUser(
      db.user,
      () => ledger.summary('2027-02-01', '2027-03-01'),
      true,
    );
    expect(summary).toMatchObject({ income: 5000, expense: 1700, unclassified: 1 });
    expect(summary.expenseGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Outros', groupId: null, amount: 2000, count: 1 }),
        expect.objectContaining({ groupId, name: 'Overview group', amount: -300, count: 3 }),
      ]),
    );
    expect(summary.expenseCategories.reduce((total, category) => total + category.amount, 0)).toBe(
      summary.expense,
    );
    expect(summary.expenseCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Outros', amount: 2000 }),
        expect.objectContaining({ name: 'Overview food', amount: -800 }),
      ]),
    );
    expect(summary.expenseGroups.reduce((total, group) => total + group.amount, 0)).toBe(
      summary.expense,
    );
    const otherWorkspace = await db.forUser(
      db.user,
      () => ledger.summary('2027-02-01', '2027-03-01'),
      true,
      otherSpace,
    );
    const otherUser = await db.forUser(
      db.other,
      () => ledger.summary('2027-02-01', '2027-03-01'),
      true,
    );
    expect(otherWorkspace.expenseGroups).toEqual([]);
    expect(otherUser.expenseGroups).toEqual([]);
  });
});

describe('Monthly overview history', () => {
  const dashboard = new DashboardService(accounts, ledger);
  it('fills chronological months, preserves signed refunds and matches period summaries without reading other owners/spaces', async () => {
    const history = await db.forUser(db.user, () => dashboard.history('2027-02', 4), true);
    expect(history.items.map((item) => item.month)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(history.items[0]).toMatchObject({ income: 0, expense: 0, count: 0, unclassified: 0 });
    for (const item of history.items) {
      const [year, number] = item.month.split('-').map(Number);
      const to = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
      const summary = await db.forUser(db.user, () => ledger.summary(item.month + '-01', to), true);
      expect(item).toMatchObject({
        income: summary.income,
        expense: summary.expense,
        unclassified: summary.unclassified,
      });
    }
    expect(history.items.at(-1)).toMatchObject({
      income: 5000,
      expense: 1700,
      count: 5,
      unclassified: 1,
    });
    const other = await db.forUser(
      db.user,
      () => dashboard.history('2027-02', 4),
      true,
      otherSpace,
    );
    const otherOwner = await db.forUser(db.other, () => dashboard.history('2027-02', 4), true);
    expect(other.items.every((item) => item.count === 0)).toBe(true);
    expect(otherOwner.items.every((item) => item.count === 0)).toBe(true);
  });
  it('bounds ranges, rejects malformed periods and returns leap-year months without timezone shifts', async () => {
    for (const month of ['bad', '2026-13', '1899-12', '9999-01'])
      await expect(dashboard.history(month, 4)).rejects.toThrow('mês válido');
    for (const count of [0, 1, 3, 13, NaN, Infinity])
      await expect(dashboard.history('2026-01', count)).rejects.toThrow('intervalo');
    const earliest = await db.forUser(db.user, () => dashboard.history('1900-01', 12), true);
    expect(earliest.items.map((item) => item.month)).toEqual(['1900-01']);
    const leap = await db.forUser(db.user, () => dashboard.history('2024-03', 2), true);
    expect(leap).toMatchObject({ from: '2024-02-01', to: '2024-04-01' });
    expect(leap.items.map((item) => item.month)).toEqual(['2024-02', '2024-03']);
  });
});

async function benefitPlanningSpace<T>(action: () => Promise<T>) {
  const space = await db.forUser(
    db.user,
    () =>
      new WorkspacesService(new WorkspacesRepository(db.service)).create({
        name: `Benefit planning ${randomUUID()}`,
        description: '',
        color: 'emerald',
      }),
    false,
    null,
  );
  return db.forUser(db.user, action, false, space.id);
}
it('assigns prepaid VA credits to the following planning month while retaining bank dates and balances', async () => {
  await benefitPlanningSpace(async () => {
    const salary = await categories.save({
      name: 'Salary competency',
      type: 'income',
      color: '#5ee9b5',
    });
    const va = await categories.save({ name: 'VA competency', type: 'income', color: '#5ee9b5' });
    const food = await categories.save({
      name: 'Food competency',
      type: 'expense',
      color: '#f28a97',
    });
    const bank = await accounts.create({
      name: 'Payment account',
      institution: 'mercado_pago',
      type: 'checking',
    });
    const alelo = await accounts.create({
      name: 'Alelo VA',
      institution: 'alelo',
      type: 'benefit_food',
    });
    const credit = await ledger.create({
      accountId: alelo.id,
      categoryId: va.id,
      amount: 70000,
      description: 'Seu Benefício Caiu',
      transactionDate: '2026-10-30',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: bank.id,
      categoryId: salary.id,
      amount: 300000,
      description: 'Salary',
      transactionDate: '2026-11-03',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: alelo.id,
      categoryId: food.id,
      amount: -15012,
      description: 'Benefit purchase',
      transactionDate: '2026-11-03',
      transactionType: 'expense',
    });
    await planning.save('2026-11', {
      version: 0,
      contribution: null,
      notes: '',
      lines: [
        { categoryId: salary.id, amount: 300000 },
        { categoryId: va.id, amount: 70000 },
      ],
    });
    expect((await planning.summary('2026-11')).totals.actualIncome).toBe(300000);
    const before = await accounts.find(alelo.id);
    await accounts.setBenefitMonth(alelo.id, 'following', String(before.version));
    const plan = await planning.summary('2026-11');
    expect(plan.totals).toMatchObject({
      plannedIncome: 370000,
      actualIncome: 370000,
      actualExpense: 15012,
      actualResult: 354988,
    });
    expect(plan.lines.find((l) => l.categoryId === va.id)?.actual).toBe(70000);
    expect(plan.benefitAccounts).toEqual([
      expect.objectContaining({ id: alelo.id, benefitCreditMonth: 'following' }),
    ]);
    expect((await planning.summary('2026-11', 'benefits')).totals).toMatchObject({
      actualIncome: 70000,
      actualExpense: 15012,
    });
    expect((await planning.summary('2026-11', 'cash')).totals).toMatchObject({
      actualIncome: 300000,
      actualExpense: 0,
    });
    expect((await planning.summary('2026-10')).totals.actualIncome).toBe(0);
    expect(await ledger.find(credit.id)).toMatchObject({
      transactionDate: '2026-10-30',
      amount: 70000,
      version: 1,
    });
    expect((await accounts.find(alelo.id)).balance).toBe(before.balance);
    expect((await ledger.summary('2026-10-01', '2026-11-01')).income).toBe(0);
    expect((await ledger.summary('2026-11-01', '2026-12-01')).income).toBe(370000);
    const history = await ledger.monthlySummary('2026-10-01', '2026-12-01');
    expect(history.map((m) => m.income)).toEqual([0, 370000]);
    const november = await ledger.list({
      from: '2026-11-01',
      to: '2026-12-01',
      accountId: alelo.id,
      limit: 1,
    });
    expect(november.items).toHaveLength(1);
    expect(november.nextCursor).not.toBeNull();
    const next = await ledger.list({
      from: '2026-11-01',
      to: '2026-12-01',
      accountId: alelo.id,
      limit: 1,
      cursor: november.nextCursor!,
    });
    expect(next.items).toEqual([
      expect.objectContaining({ id: credit.id, transactionDate: '2026-10-30' }),
    ]);
    expect(
      (await ledger.list({ from: '2026-10-01', to: '2026-11-01', accountId: alelo.id, limit: 10 }))
        .items,
    ).toHaveLength(0);
  });
});
it('shifts only configured positive benefit income across year boundaries and excludes bases, transfers and reversed entries', async () => {
  await benefitPlanningSpace(async () => {
    const meal = await accounts.create({
      name: 'Meal next month',
      institution: 'alelo',
      type: 'benefit_meal',
      openingBalance: 50000,
      benefitCreditMonth: 'following',
    });
    const food = await accounts.create({
      name: 'Food received month',
      institution: 'alelo',
      type: 'benefit_food',
    });
    await ledger.create({
      accountId: meal.id,
      amount: 12345,
      description: 'Meal credit',
      transactionDate: '2026-12-31',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: food.id,
      amount: 20000,
      description: 'Food credit',
      transactionDate: '2026-12-30',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: meal.id,
      amount: -500,
      description: 'Purchase',
      transactionDate: '2027-01-01',
      transactionType: 'expense',
    });
    await ledger.create(
      {
        accountId: meal.id,
        amount: 9999,
        description: 'Transfer excluded',
        transactionDate: '2026-12-31',
        transactionType: 'transfer',
      },
      true,
    );
    const reversed = await ledger.create({
      accountId: meal.id,
      amount: 8888,
      description: 'Reversed credit',
      transactionDate: '2026-12-30',
      transactionType: 'income',
    });
    await ledger.reverse(reversed.id, '1');
    const december = await planning.summary('2026-12');
    const january = await planning.summary('2027-01');
    expect(december.totals.actualIncome).toBe(20000);
    expect(january.totals).toMatchObject({ actualIncome: 12345, actualExpense: 500 });
    expect(january.lines.find((l) => l.type === 'income' && l.categoryId === null)?.actual).toBe(
      12345,
    );
    await expect(
      accounts.create({
        name: 'Invalid policy',
        institution: 'mercado_pago',
        type: 'checking',
        benefitCreditMonth: 'following',
      }),
    ).rejects.toThrow('exclusiva');
  });
});
it('preserves the configured benefit month on name edits and backup/restore without moving source transactions', async () => {
  const source = await benefitPlanningSpace(async () => {
    const a = await accounts.create({
      name: 'Portable Alelo policy',
      institution: 'alelo',
      type: 'benefit_food',
      benefitCreditMonth: 'following',
    });
    await ledger.create({
      accountId: a.id,
      amount: 70000,
      description: 'Seu Benefício Caiu',
      transactionDate: '2026-10-30',
      transactionType: 'income',
    });
    const current = await accounts.find(a.id);
    await accounts.update(
      a.id,
      { name: 'Renamed Alelo', institution: 'alelo', type: 'benefit_food' },
      String(current.version),
    );
    expect((await accounts.find(a.id)).benefitCreditMonth).toBe('following');
    const payload = await backups.backup();
    expect(payload.version).toBe(12);
    expect(() => validateBackup({ ...payload, version: 9 })).toThrow('backup');
    return payload;
  });
  await benefitPlanningSpace(async () => {
    const draft = await backups.preview(source);
    await backups.confirm(draft.id);
    expect((await planning.summary('2026-11')).totals.actualIncome).toBe(70000);
    expect((await planning.summary('2026-10')).totals.actualIncome).toBe(0);
    expect((await ledger.exportRecords())[0]).toMatchObject({
      transactionDate: '2026-10-30',
      amount: 70000,
    });
  });
});

it('changes benefit planning preferences independently with version and workspace protection', async () => {
  let foreignId = '';
  await benefitPlanningSpace(async () => {
    const alelo = await accounts.create({
      name: 'VA first day',
      institution: 'alelo',
      type: 'benefit_food',
    });
    foreignId = alelo.id;
    await ledger.create({
      accountId: alelo.id,
      amount: 70000,
      description: 'Benefit',
      transactionDate: '2026-11-01',
      transactionType: 'income',
    });
    expect((await planning.summary('2026-11')).totals.actualIncome).toBe(70000);
    const following = await accounts.setBenefitMonth(alelo.id, 'following', String(alelo.version));
    expect((await planning.summary('2026-12')).totals.actualIncome).toBe(70000);
    await expect(
      accounts.setBenefitMonth(alelo.id, 'received', String(alelo.version)),
    ).rejects.toThrow();
    const received = await accounts.setBenefitMonth(
      alelo.id,
      'received',
      String(following.version),
    );
    expect(received.version).toBe(following.version + 1);
    expect((await planning.summary('2026-11')).totals.actualIncome).toBe(70000);
    expect((await planning.summary('2026-12')).totals.actualIncome).toBe(0);
    const bank = await accounts.create({
      name: 'Ordinary bank',
      institution: 'mercado_pago',
      type: 'checking',
    });
    await expect(
      accounts.setBenefitMonth(bank.id, 'following', String(bank.version)),
    ).rejects.toThrow('exclusiva');
  });
  await benefitPlanningSpace(async () => {
    await expect(accounts.setBenefitMonth(foreignId, 'following', '1')).rejects.toThrow(
      'não encontrada',
    );
  });
});

it('carries benefit leftovers once, excludes future credits and reconciles reserves without inventing income', async () => {
  await benefitPlanningSpace(async () => {
    const benefit = await accounts.create({
      name: 'Carry VA',
      institution: 'alelo',
      type: 'benefit_food',
      openingBalance: 10000,
      openingDate: '2026-10-01',
      benefitCreditMonth: 'following',
    });
    const cash = await accounts.create({
      name: 'Cash',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 100000,
      openingDate: '2026-10-01',
    });
    const reserve = await accounts.create({
      name: 'Saved',
      institution: 'mercado_pago',
      type: 'reserve',
      openingBalance: 80000,
      openingDate: '2026-10-01',
    });
    const credit = await ledger.create({
      accountId: benefit.id,
      amount: 70000,
      transactionDate: '2026-10-31',
      description: 'November credit',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: benefit.id,
      amount: -70000,
      transactionDate: '2026-11-15',
      description: 'November purchases',
      transactionType: 'expense',
    });
    await ledger.create({
      accountId: benefit.id,
      amount: 70000,
      transactionDate: '2026-11-30',
      description: 'December credit',
      transactionType: 'income',
    });
    await ledger.transfer(
      {
        fromAccountId: cash.id,
        toAccountId: reserve.id,
        amount: 40000,
        transactionDate: '2026-11-20',
        description: 'Save',
      },
      randomUUID(),
    );
    const nov = (await planning.summary('2026-11')).budget!;
    expect(nov).toMatchObject({
      coverage: 'complete',
      carried: 110000,
      income: 70000,
      expense: 70000,
      transfers: -40000,
      reserved: 40000,
      available: 70000,
      adjustments: 0,
    });
    expect(nov.accounts.find((a) => a.accountId === benefit.id)).toMatchObject({
      carried: 10000,
      available: 10000,
      deferredOpening: 70000,
      deferredClosing: 70000,
    });
    expect(nov.accounts.some((a) => a.accountId === reserve.id)).toBe(false);
    const dec = (await planning.summary('2026-12')).budget!;
    expect(dec).toMatchObject({ carried: 70000, income: 70000, available: 140000, adjustments: 0 });
    const dashboard = new DashboardService(accounts, ledger);
    expect((await dashboard.summary('2026-11-01', '2026-12-01')).budget).toEqual(nov);
    expect((await dashboard.history('2026-12', 2)).items[0].budget).toEqual(nov);
    const rows = await ledger.list({
      accountId: benefit.id,
      from: '2026-11-01',
      to: '2026-12-01',
      limit: 10,
    });
    expect(rows.items.find((t) => t.id === credit.id)).toMatchObject({
      transactionDate: '2026-10-31',
      reportingDate: '2026-11-01',
    });
  });
});

it('retains negative carryover for early spending and never fabricates history before a reference', async () => {
  await benefitPlanningSpace(async () => {
    const benefit = await accounts.create({
      name: 'Early VA',
      institution: 'alelo',
      type: 'benefit_meal',
      openingBalance: 1,
      openingDate: '2026-10-01',
      benefitCreditMonth: 'following',
    });
    await ledger.create({
      accountId: benefit.id,
      amount: 70000,
      transactionDate: '2026-10-31',
      description: 'Advance',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: benefit.id,
      amount: -5001,
      transactionDate: '2026-10-31',
      description: 'Early use',
      transactionType: 'expense',
    });
    expect((await planning.summary('2026-11')).budget).toMatchObject({
      carried: -5000,
      income: 70000,
      available: 65000,
      adjustments: 0,
    });
    const unknown = await accounts.create({
      name: 'Unproven',
      institution: 'mercado_pago',
      type: 'checking',
    });
    const partial = (await planning.summary('2026-11')).budget!;
    expect(partial.coverage).toBe('partial');
    expect(partial.available).toBeNull();
    expect(partial.accounts.find((a) => a.accountId === unknown.id)?.reason).toBe(
      'missing-reference',
    );
    expect((await planning.summary('2026-09')).budget?.carried).toBeNull();
    const state = await accounts.find(benefit.id);
    expect(state.balance).toBe(65000);
  });
});

it('reconstructs the active prior balance reference and isolates manual corrections from income', async () => {
  await benefitPlanningSpace(async () => {
    const a = await accounts.create({
      name: 'Observed',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 10000,
      openingDate: '2026-10-01',
    });
    await ledger.create({
      accountId: a.id,
      amount: -2000,
      transactionDate: '2026-11-10',
      description: 'Purchase',
      transactionType: 'expense',
    });
    const repo = new BalanceBasisRepository(db.service);
    const id = randomUUID();
    const basis = {
      kind: 'manual' as const,
      referenceDate: '2026-11-15',
      referenceBalance: 9000,
      originId: id,
    };
    await repo.append({
      id,
      accountId: a.id,
      operation: 'manual',
      previousBase: 10000,
      newBase: 11000,
      previousBasis: { kind: 'legacy' },
      newBasis: basis,
      reason: 'Observed position',
      details: { knownSameDayIds: [] },
      undoOfId: null,
      createdAt: '2026-11-15T12:00:00Z',
    });
    await repo.write(a.id, 11000, basis);
    expect((await planning.summary('2026-11')).budget).toMatchObject({
      carried: 10000,
      income: 0,
      expense: 2000,
      adjustments: 1000,
      available: 9000,
    });
    expect((await planning.summary('2026-10')).budget).toMatchObject({
      carried: 10000,
      available: 10000,
      adjustments: 0,
    });
    await db.service.query('UPDATE wallet.financial_accounts SET archived_at=now() WHERE id=$1', [
      a.id,
    ]);
    expect((await planning.summary('2026-11')).budget?.available).toBe(9000);
  });
});

it('keeps a partial leap-month period, year rollover, received credits and reversals consistent', async () => {
  await benefitPlanningSpace(async () => {
    const a = await accounts.create({
      name: 'Boundary',
      institution: 'alelo',
      type: 'benefit_meal',
      openingBalance: 10000,
      openingDate: '2023-12-01',
      benefitCreditMonth: 'following',
    });
    const credit = await ledger.create({
      accountId: a.id,
      amount: 70000,
      transactionDate: '2023-12-31',
      transactionType: 'income',
      description: 'January',
    });
    await ledger.create({
      accountId: a.id,
      amount: -10000,
      transactionDate: '2024-02-29',
      transactionType: 'expense',
      description: 'Leap purchase',
    });
    const january = (await planning.summary('2024-01')).budget!;
    expect(january).toMatchObject({
      carried: 10000,
      income: 70000,
      available: 80000,
      adjustments: 0,
    });
    const dashboard = new DashboardService(accounts, ledger);
    expect((await dashboard.summary('2024-02-29', '2024-03-01')).budget).toMatchObject({
      carried: 80000,
      income: 0,
      expense: 10000,
      available: 70000,
      adjustments: 0,
    });
    const current = await accounts.find(a.id);
    await accounts.setBenefitMonth(a.id, 'received', String(current.version));
    expect((await planning.summary('2024-01')).budget).toMatchObject({
      carried: 80000,
      income: 0,
      available: 80000,
    });
    await db.service.query('UPDATE wallet.transactions SET reversed_at=now() WHERE id=$1', [
      credit.id,
    ]);
    expect((await planning.summary('2024-01')).budget).toMatchObject({
      carried: 10000,
      income: 0,
      available: 10000,
    });
  });
});

it('restores derived carryover from backup facts without creating monthly entries or crossing spaces', async () => {
  const source = await benefitPlanningSpace(async () => {
    const a = await accounts.create({
      name: 'Portable leftover',
      institution: 'alelo',
      type: 'benefit_food',
      openingBalance: 10000,
      openingDate: '2026-10-01',
      benefitCreditMonth: 'following',
    });
    await ledger.create({
      accountId: a.id,
      amount: 70000,
      transactionDate: '2026-10-31',
      description: 'November',
      transactionType: 'income',
    });
    await ledger.create({
      accountId: a.id,
      amount: -60000,
      transactionDate: '2026-11-10',
      description: 'Use',
      transactionType: 'expense',
    });
    return { backup: await backups.backup(), budget: (await planning.summary('2026-11')).budget! };
  });
  await benefitPlanningSpace(async () => {
    expect((await planning.summary('2026-11')).budget).toMatchObject({
      carried: 0,
      available: 0,
      income: 0,
    });
    const preview = await backups.preview(source.backup);
    await backups.confirm(preview.id);
    const restored = (await planning.summary('2026-11')).budget!;
    expect(restored).toMatchObject({
      carried: source.budget.carried,
      available: source.budget.available,
      income: source.budget.income,
      expense: source.budget.expense,
      adjustments: 0,
      coverage: 'complete',
    });
    expect((await ledger.exportRecords()).length).toBe(2);
  });
});
