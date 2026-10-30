import { BalanceBasisService } from '../../accounts/services/balance-basis.service.js';
import { BalanceBasisRepository } from '../../accounts/repositories/balance-basis.repository.js';
import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
import { ImportReconciliationService } from '../../imports/services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../../imports/repositories/import-reconciliation.repository.js';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestDatabase } from '../../../../test/database-harness.js';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository.js';
import { AccountsService } from '../../accounts/services/accounts.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { LedgerRepository } from '../repositories/ledger.repository.js';
import { LedgerService } from '../services/ledger.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { DataExportService } from '../../data-export/services/data-export.service.js';
import { RestoreRepository } from '../../data-export/repositories/restore.repository.js';
import { ImportsService } from '../../imports/services/imports.service.js';
import { ImportsRepository } from '../../imports/repositories/imports.repository.js';
const db = new TestDatabase();
const balanceBasis = new BalanceBasisService(new BalanceBasisRepository(db.service));
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const counterparties = new CounterpartiesService(
  new CounterpartiesRepository(db.service),
  accounts,
  categories,
);
const ledger = new LedgerService(
  new LedgerRepository(db.service),
  accounts,
  categories,
  new IdempotencyService(db.service),
  counterparties,
  balanceBasis,
);
import { PlanningRepository } from '../../planning/repositories/planning.repository.js';
import { PlanningService } from '../../planning/services/planning.service.js';
const backups = new DataExportService(
  accounts,
  categories,
  ledger,
  new IdempotencyService(db.service),
  new RestoreRepository(db.service),
  new PlanningService(new PlanningRepository(db.service), categories, ledger),
  counterparties,
  balanceBasis,
);
const imports = new ImportsService(
  new ImportsRepository(db.service),
  accounts,
  ledger,
  new IdempotencyService(db.service),
  categories,
  ledger,
  new ImportReconciliationService(new ImportReconciliationRepository(db.service)),
  counterparties,
  balanceBasis,
);
let first: string;
let second: string;
beforeAll(async () => {
  await db.initialize();
  await db.forUser(db.user, async () => {
    first = (
      await accounts.create({
        name: 'Main',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 10000,
        openingDate: '2026-01-01',
      })
    ).id;
    second = (
      await accounts.create({
        name: 'Reserve',
        institution: 'other',
        type: 'reserve',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
    ).id;
  });
});
afterAll(() => db.close());
describe('Financial integrity with PostgreSQL RLS', () => {
  it('records exact movements and transfers without counting them as income', async () => {
    await db.forUser(db.user, async () => {
      await ledger.create({
        accountId: first,
        transactionDate: '2026-01-02',
        description: 'Salary',
        amount: 50000,
        transactionType: 'income',
      });
      const input = {
        fromAccountId: first,
        toAccountId: second,
        transactionDate: '2026-01-03',
        description: 'Reserve',
        amount: 15000,
      };
      const transfer = await ledger.transfer(input, 'transfer-one');
      expect(await ledger.transfer(input, 'transfer-one')).toEqual(transfer);
      expect((await accounts.find(first)).balance).toBe(45000);
      expect((await accounts.find(second)).balance).toBe(15000);
      expect(await ledger.summary('2026-01-01', '2026-02-01')).toEqual({
        income: 50000,
        expense: 0,
        unclassified: 0,
        expenseGroups: [],
        expenseCategories: [],
      });
      await expect(ledger.transfer({ ...input, amount: 1 }, 'transfer-one')).rejects.toThrow(
        'outra operação',
      );
    });
  });
  it('rolls back partial writes when the destination account is archived', async () => {
    const future = await db.forUser(db.user, () =>
      accounts.create({
        name: 'Future',
        institution: 'other',
        type: 'checking',
        openingBalance: 0,
        openingDate: '2026-12-01',
      }),
    );
    await db.engine.query('UPDATE wallet.financial_accounts SET archived_at=now() WHERE id=$1', [
      future.id,
    ]);
    const count = await db.forUser(db.user, async () => (await ledger.exportRecords()).length);
    await expect(
      db.forUser(db.user, () =>
        ledger.transfer(
          {
            fromAccountId: first,
            toAccountId: future.id,
            amount: 2000,
            description: 'Archived destination',
            transactionDate: '2026-02-01',
          },
          'bad-transfer',
        ),
      ),
    ).rejects.toThrow();
    expect(await db.forUser(db.user, async () => (await ledger.exportRecords()).length)).toBe(
      count,
    );
  });
  it('denies cross-user reads and references and does not leak pool scope', async () => {
    await db.forUser(db.other, async () => {
      expect(await accounts.list()).toEqual([]);
      await expect(accounts.find(first)).rejects.toThrow('não encontrada');
    });
    await expect(
      db.forUser(db.other, () =>
        db.service.query(
          'INSERT INTO wallet.transactions(id,user_id,account_id,transaction_date,description,amount_minor,transaction_type) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [randomUUID(), db.other, first, '2026-01-01', 'Bad reference', -100, 'expense'],
        ),
      ),
    ).rejects.toThrow();
    await db.engine.exec('SET ROLE mywallet_runtime');
    try {
      expect((await db.engine.query('SELECT * FROM wallet.financial_accounts')).rows).toEqual([]);
    } finally {
      await db.engine.exec('RESET ROLE');
    }
    expect((await db.forUser(db.user, () => accounts.list())).length).toBe(3);
  });
  it('rejects stale edits and preserves opening positions with recorded history', async () => {
    await db.forUser(db.user, async () => {
      const item = await ledger.create({
        accountId: first,
        transactionDate: '2026-02-01',
        description: 'Groceries',
        amount: -1234,
        transactionType: 'expense',
      });
      const input = {
        accountId: first,
        transactionDate: item.transactionDate,
        description: 'Updated groceries',
        amount: -1235,
        transactionType: 'expense' as const,
      };
      expect((await ledger.update(item.id, input, '1'))?.version).toBe(2);
      await expect(ledger.update(item.id, input, '1')).rejects.toThrow('mudou');
      const a = await accounts.find(first);
      await expect(
        accounts.update(first, { ...a, openingBalance: 0 }, String(a.version)),
      ).rejects.toThrow('reconciliação');
    });
  });
  it('keeps distinct repeated source IDs and confirms imports idempotently', async () => {
    const repository = new ImportsRepository(db.service);
    await db.forUser(db.user, async () => {
      const openingBalance = (await accounts.find(first)).balance;
      const statement = { openingBalance, closingBalance: openingBalance + 30, items: [] };
      const id = await repository.create(first, 'test-file', 'synthetic.pdf', 'test', statement);
      for (const [i, amount] of [10, 20].entries())
        await repository.addItem(
          id,
          {
            sourceRow: i + 1,
            sourcePage: 1,
            transactionDate: '2026-03-01',
            description: 'Shared reference',
            sourceOperationId: 'same-reference',
            amount,
            balanceAfter: amount,
            transactionType: 'income',
          },
          false,
        );
      const review = await imports.preview(id);
      expect(review.items.length).toBe(2);
      const confirmed = await imports.confirm(id, review.version, 'import-one');
      expect(await imports.confirm(id, review.version, 'import-one')).toEqual(confirmed);
      expect(
        (await ledger.exportRecords()).filter((t) => t.sourceOperationId === 'same-reference'),
      ).toHaveLength(2);
      const latest = await imports.preview(id);
      await imports.reverse(id, String(latest.version));
      expect(
        (await ledger.exportRecords()).filter((t) => t.sourceOperationId === 'same-reference'),
      ).toHaveLength(0);
    });
  });
  it('round-trips a backup into a second isolated owner without trusting source owner IDs', async () => {
    const backup = await db.forUser(db.user, () => backups.backup());
    await db.forUser(db.other, async () => {
      const preview = await backups.preview({ ...backup, user_id: db.user });
      await backups.confirm(preview.id);
      const restored = await backups.backup();
      expect(restored.accounts.map((a) => a.openingBalance).sort()).toEqual(
        backup.accounts.map((a) => a.openingBalance).sort(),
      );
      expect(restored.transactions.map((t) => t.amount).sort()).toEqual(
        backup.transactions.map((t) => t.amount).sort(),
      );
      const repeated = await backups.preview({ ...backup, user_id: db.user });
      await backups.confirm(repeated.id);
      expect((await backups.backup()).transactions).toHaveLength(backup.transactions.length);
      expect(restored.accounts.some((a) => a.id === first)).toBe(false);
    });
  });
  it('enforces read-only snapshot transactions for backups', async () => {
    const backup = await db.forUser(db.user, () => backups.backup(), true);
    expect(backup.accounts.length).toBe(3);
    await expect(
      db.forUser(
        db.user,
        () =>
          accounts.create({
            name: 'Blocked',
            institution: 'other',
            type: 'cash',
            openingBalance: 0,
            openingDate: '2026-01-01',
          }),
        true,
      ),
    ).rejects.toThrow();
  });
  it('rolls back when a nested transaction fails even if its caller catches the error', async () => {
    const count = await db.forUser(db.user, async () => (await accounts.list()).length);
    await expect(
      db.forUser(db.user, async () => {
        await accounts.create({
          name: 'Rolled back',
          institution: 'other',
          type: 'cash',
          openingBalance: 0,
          openingDate: '2026-01-01',
        });
        try {
          await db.service.forUser(db.user, async () => {
            throw new Error('Nested financial failure');
          });
        } catch {}
      }),
    ).rejects.toThrow('Nested financial failure');
    expect(await db.forUser(db.user, async () => (await accounts.list()).length)).toBe(count);
  });
  it('adopts the opening amount supplied by a fully confirmed first statement', async () => {
    await db.forUser(db.user, async () => {
      const a = await accounts.create({
        name: 'Opening check',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 0,
        openingDate: '2026-01-01',
      });
      const repository = new ImportsRepository(db.service);
      const id = await repository.create(a.id, 'opening-test', 'synthetic.pdf', 'test', {
        openingBalance: 500,
        closingBalance: 510,
        items: [],
      });
      await repository.addItem(
        id,
        {
          sourceRow: 1,
          sourcePage: 1,
          transactionDate: '2026-01-02',
          description: 'Income',
          sourceOperationId: 'opening-id',
          amount: 10,
          balanceAfter: 510,
          transactionType: 'income',
        },
        false,
      );
      expect((await imports.preview(id)).openingMismatch).toBe(true);
      expect((await imports.preview(id)).willInitializeOpening).toBe(true);
      await imports.confirm(id, 1, 'opening-mismatch');
      expect((await accounts.find(a.id)).openingBalance).toBe(500);
    });
  });
});

it('corrects the base idempotently without writing financial transactions or income/expense totals', async () => {
  await db.forUser(db.user, async () => {
    const account = await accounts.create({
      name: 'Balance correction test',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 10000,
      openingDate: '2026-01-01',
    });
    const before = await ledger.summary('2026-01-01', '2027-01-01');
    const adjustment = await ledger.adjustBalance(
      account.id,
      { expectedBalance: 10000, targetBalance: 7500, reason: 'Historical gap verified manually' },
      'manual-balance-proof',
    );
    expect(adjustment).toMatchObject({
      operation: 'manual',
      previousBase: 10000,
      newBase: 7500,
      details: { previousBalance: 10000, targetBalance: 7500, difference: -2500 },
    });
    expect(
      (await ledger.exportRecords()).filter((row) => row.accountId === account.id),
    ).toHaveLength(0);
    expect(
      await ledger.adjustBalance(
        account.id,
        { expectedBalance: 10000, targetBalance: 7500, reason: 'Historical gap verified manually' },
        'manual-balance-proof',
      ),
    ).toEqual(adjustment);
    expect(await accounts.find(account.id)).toMatchObject({ openingBalance: 7500, balance: 7500 });
    expect(await ledger.summary('2026-01-01', '2027-01-01')).toEqual(before);
  });
});
it('rejects stale/zero balance adjustments and reverses corrections without deleting original movements', async () => {
  const account = await db.forUser(db.user, () =>
    accounts.create({
      name: 'Correction reversal',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 1000,
      openingDate: '2026-01-01',
    }),
  );
  await expect(
    db.forUser(db.user, () =>
      ledger.adjustBalance(
        account.id,
        { expectedBalance: 900, targetBalance: 2000, reason: 'Stale balance' },
        'stale-balance',
      ),
    ),
  ).rejects.toThrow('saldo mudou');
  await expect(
    db.forUser(db.user, () =>
      ledger.adjustBalance(
        account.id,
        { expectedBalance: 1000, targetBalance: 1000, reason: 'No difference' },
        'zero-balance',
      ),
    ),
  ).rejects.toThrow('já corresponde');
  await expect(
    db.forUser(db.other, () =>
      ledger.adjustBalance(
        account.id,
        { expectedBalance: 1000, targetBalance: 2000, reason: 'Foreign' },
        'foreign-balance',
      ),
    ),
  ).rejects.toThrow('não encontrada');
  const adjustment = await db.forUser(db.user, () =>
    ledger.adjustBalance(
      account.id,
      { expectedBalance: 1000, targetBalance: 2000, reason: 'Verified statement snapshot' },
      'upward-balance',
    ),
  );
  await db.forUser(db.user, async () =>
    balanceBasis.undo(account.id, adjustment.id, (await accounts.find(account.id)).version),
  );
  expect((await db.forUser(db.user, () => accounts.find(account.id))).balance).toBe(1000);
});
it('round-trips base history separately from financial transactions', async () => {
  const backup = await db.forUser(db.user, () => backups.backup());
  const adjustment = backup.balanceHistory!.find(
    (row) => row.reason === 'Historical gap verified manually',
  )!;
  expect(adjustment.operation).toBe('manual');
  expect(backup.transactions.some((t) => t.balanceAdjustment)).toBe(false);
  const bad = structuredClone(backup);
  bad.accounts.find((a) => a.id === adjustment.accountId)!.openingBalance++;
  await expect(db.forUser(db.user, () => backups.preview(bad))).rejects.toThrow('backup');
  const space = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Base restore') RETURNING id",
    [db.user],
  );
  await db.forUser(
    db.user,
    async () => {
      const draft = await backups.preview(backup);
      await backups.confirm(draft.id);
      expect(
        (await balanceBasis.exportHistory()).some((event) => event.reason === adjustment.reason),
      ).toBe(true);
      expect(
        (await accounts.list()).find((a) => a.name === 'Balance correction test')?.balance,
      ).toBe(7500);
    },
    false,
    space.rows[0].id,
  );
});

it('creates and renames accounts without starting fields while preserving legacy values on edits', async () => {
  const { validateInput } = await import('../../../core/http/index.js');
  const { CreateAccountDto } = await import('../../accounts/dto/create-account.dto.js');
  const input = await validateInput(CreateAccountDto, {
    name: 'No starting setup',
    institution: 'mercado_pago',
    type: 'checking',
  });
  await db.forUser(db.user, async () => {
    const a = await accounts.create(input);
    expect(a.balance).toBe(0);
    const updated = await accounts.update(
      a.id,
      { ...input, name: 'Renamed without defaults' },
      String(a.version),
    );
    expect(updated.openingDate).toBe(a.openingDate);
    expect(updated.balance).toBe(0);
    const legacy = await accounts.create({
      ...input,
      name: 'Existing legacy account',
      openingBalance: 5500,
      openingDate: '2020-01-01',
    });
    const preserved = await accounts.update(legacy.id, input, String(legacy.version));
    expect(preserved).toMatchObject({
      openingBalance: 5500,
      openingDate: '2020-01-01',
      balance: 5500,
    });
  });
});
