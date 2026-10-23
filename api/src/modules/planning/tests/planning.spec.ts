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
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const receipts = new IdempotencyService(db.service);
const ledger = new LedgerService(new LedgerRepository(db.service), accounts, categories, receipts);
const planning = new PlanningService(new PlanningRepository(db.service), categories, ledger);
const backups = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  planning,
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
    expect(backup.version).toBe(3);
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
