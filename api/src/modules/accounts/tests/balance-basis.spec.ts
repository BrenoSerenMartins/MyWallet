import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
import { AccountsRepository } from '../repositories/accounts.repository.js';
import { AccountsService } from '../services/accounts.service.js';
import { BalanceBasisRepository } from '../repositories/balance-basis.repository.js';
import { BalanceBasisService } from '../services/balance-basis.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { LedgerRepository } from '../../ledger/repositories/ledger.repository.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { IdempotencyService } from '../../ledger/services/idempotency.service.js';
import { ImportsRepository } from '../../imports/repositories/imports.repository.js';
import { ImportsService } from '../../imports/services/imports.service.js';
import { ImportReconciliationRepository } from '../../imports/repositories/import-reconciliation.repository.js';
import { ImportReconciliationService } from '../../imports/services/import-reconciliation.service.js';
import { DataExportService } from '../../data-export/services/data-export.service.js';
import { RestoreRepository } from '../../data-export/repositories/restore.repository.js';
import { PlanningService } from '../../planning/services/planning.service.js';
import { PlanningRepository } from '../../planning/repositories/planning.repository.js';
const db = new TestDatabase();
const accounts = new AccountsService(new AccountsRepository(db.service));
const basis = new BalanceBasisService(new BalanceBasisRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const parties = new CounterpartiesService(
  new CounterpartiesRepository(db.service),
  accounts,
  categories,
);
const receipts = new IdempotencyService(db.service);
const ledger = new LedgerService(
  new LedgerRepository(db.service),
  accounts,
  categories,
  receipts,
  parties,
  basis,
);
const imports = new ImportsService(
  new ImportsRepository(db.service),
  accounts,
  ledger,
  receipts,
  categories,
  ledger,
  new ImportReconciliationService(new ImportReconciliationRepository(db.service)),
  parties,
  basis,
);
const backup = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  new PlanningService(new PlanningRepository(db.service), categories, ledger),
  parties,
  basis,
);
const run = <T>(fn: () => Promise<T>) => db.forUser(db.user, fn);
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
beforeAll(() => db.initialize());
afterAll(() => db.close());
const account = (name: string) =>
  run(() => accounts.create({ name, institution: 'mercado_pago', type: 'checking' }));
const movement = (accountId: string, amount: number, date = '2026-01-01') => ({
  accountId,
  amount,
  transactionType: amount > 0 ? ('income' as const) : ('expense' as const),
  description: 'Real movement',
  transactionDate: date,
});
async function statement(accountId: string, date: string, opening: number, amounts: number[]) {
  let balance = opening;
  return run(() =>
    imports.upload(accountId, Buffer.from(randomUUID()), 'statement.csv', {
      reportType: 'account_statement',
      sourceFormat: 'csv',
      openingBalance: opening,
      closingBalance: opening + amounts.reduce((a, b) => a + b, 0),
      items: amounts.map((amount, i) => ({
        sourceRow: i + 1,
        sourcePage: 1,
        transactionDate: date,
        description: `Bank movement ${i}`,
        sourceOperationId: randomUUID(),
        amount,
        balanceAfter: (balance += amount),
      })),
    }),
  );
}
async function confirm(draft: Awaited<ReturnType<typeof statement>>) {
  return run(() => imports.confirm(draft.id, draft.version, randomUUID()));
}
it('learns the first complete statement and an older consistent base without a manual setup or duplicate money', async () => {
  const a = await account('Bank first');
  const later = await statement(a.id, '2026-10-01', 1307, [-100]);
  await confirm(later);
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 1307,
    balance: 1207,
    balanceBasis: { kind: 'statement', referenceDate: '2026-10-01' },
  });
  const earlier = await statement(a.id, '2026-09-01', 1494, [-187]);
  await confirm(earlier);
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 1494,
    balance: 1207,
    balanceBasis: { referenceDate: '2026-09-01' },
  });
  await run(() => imports.reverse(earlier.id, String(earlier.version + 1)));
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 1307,
    balance: 1207,
    balanceBasis: { referenceDate: '2026-10-01' },
  });
  expect(
    (await run(() => basis.history(a.id))).filter((event) => event.operation === 'statement'),
  ).toHaveLength(2);
});
it('recalculates a manual correction when missing old bank movements arrive instead of counting the adjustment twice', async () => {
  const a = await account('Missing 13.07');
  await run(() => ledger.create(movement(a.id, 4605, '2026-10-01')));
  await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 4605, targetBalance: 5912, reason: 'Available bank balance' },
      'known-5912',
    ),
  );
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 1307,
    balance: 5912,
  });
  const earlier = await statement(a.id, '2026-09-01', 1494, [-187]);
  await confirm(earlier);
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 1494,
    balance: 5912,
    balanceBasis: { kind: 'statement' },
  });
  expect(
    (await run(() => ledger.exportRecords())).filter((row) => row.accountId === a.id),
  ).toHaveLength(2);
});
it('preserves a manual observation when bank history contradicts it and reports the difference', async () => {
  const a = await account('Conflicting bank');
  await run(() => ledger.create(movement(a.id, 1000)));
  await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 1000, targetBalance: 2000, reason: 'Known current balance' },
      'manual-conflict',
    ),
  );
  const older = await statement(a.id, '2026-02-01', 9000, [-100]);
  expect(await confirm(older)).toMatchObject({ balanceBasis: { status: 'conflict' } });
  expect((await run(() => accounts.find(a.id))).balance).toBe(2000);
});
it('does not apply bank base evidence when part of the source was intentionally excluded', async () => {
  const a = await account('Partial bank selection');
  let draft = await statement(a.id, '2026-10-01', 1307, [-100, -200]);
  draft = await run(() =>
    imports.review(
      draft.id,
      draft.items[1].id,
      { selected: false, transactionType: 'expense' },
      String(draft.version),
    ),
  );
  expect(await confirm(draft)).toMatchObject({ balanceBasis: { status: 'partial' } });
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 0,
    balance: -100,
    balanceBasis: { kind: 'unknown' },
  });
});
it('supports balance-less benefit history and optional current-balance calibration without a financial entry', async () => {
  const a = await run(() =>
    accounts.create({
      name: 'Benefit without balances',
      institution: 'alelo',
      type: 'benefit_food',
    }),
  );
  const draft = await run(() =>
    imports.upload(a.id, Buffer.from('benefit-no-base'), 'alelo.pdf', {
      reportType: 'benefit_statement',
      openingBalance: null,
      closingBalance: null,
      items: [
        {
          sourceRow: 1,
          sourcePage: 1,
          transactionDate: '2026-10-01',
          description: 'Seu Benefício Caiu',
          amount: 70000,
          balanceAfter: null,
          sourceOperationId: null,
        },
      ],
    }),
  );
  await confirm(draft);
  expect((await run(() => accounts.find(a.id))).balanceBasis?.kind).toBe('unknown');
  const before = (await run(() => ledger.exportRecords())).filter((row) => row.accountId === a.id);
  await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 70000, targetBalance: 20000, reason: 'Current benefit balance' },
      'benefit-current',
    ),
  );
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: -50000,
    balance: 20000,
  });
  expect((await run(() => ledger.exportRecords())).filter((row) => row.accountId === a.id)).toEqual(
    before.map((row) => ({ ...row, balanceBasisIncluded: true })),
  );
});
it('distinguishes known same-day movements from later ones and flags date-only imports for a new check', async () => {
  const a = await account('Same-day observation');
  const date = today();
  await run(() => ledger.create(movement(a.id, 100, date)));
  const first = await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 100, targetBalance: 150, reason: 'Observed before later movements' },
      'same-day-first',
    ),
  );
  await run(() => ledger.create(movement(a.id, -20, date)));
  expect((await run(() => accounts.find(a.id))).balance).toBe(130);
  await run(() => ledger.create(movement(a.id, -10, date), true));
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    balance: 120,
    balanceBasis: { reviewRequired: true },
  });
  const second = await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 120, targetBalance: 120, reason: 'Current balance checked again' },
      'same-day-second',
    ),
  );
  await run(async () => basis.undo(a.id, second.id, (await accounts.find(a.id)).version));
  expect((await run(() => accounts.find(a.id))).balance).toBe(120);
  await run(async () => basis.undo(a.id, first.id, (await accounts.find(a.id)).version));
  expect((await run(() => accounts.find(a.id))).balance).toBe(70);
});
it('rolls back imported movements and inferred bank base atomically if confirmation fails later', async () => {
  const a = await account('Atomic source base');
  const draft = await statement(a.id, '2026-01-01', 1307, [-100]);
  await expect(
    run(async () => {
      await imports.confirm(draft.id, draft.version, 'rollback-after-basis');
      throw Error('Failure after confirmation');
    }),
  ).rejects.toThrow('Failure after');
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    openingBalance: 0,
    balance: 0,
    balanceBasis: { kind: 'unknown' },
  });
  expect(await run(() => basis.history(a.id))).toHaveLength(0);
  expect((await run(() => imports.get(draft.id))).status).toBe('draft');
});
it('prevents stale or foreign corrections and makes the audit append-only for the runtime role', async () => {
  const a = await account('Scoped base');
  const event = await run(() =>
    ledger.adjustBalance(
      a.id,
      {
        expectedBalance: 0,
        targetBalance: 0,
        expectedVersion: a.version,
        reason: 'Confirmed zero balance',
      },
      'confirmed-zero',
    ),
  );
  await expect(
    run(() =>
      ledger.adjustBalance(
        a.id,
        { expectedBalance: 0, targetBalance: 100, expectedVersion: a.version, reason: 'Stale' },
        'stale-base-version',
      ),
    ),
  ).rejects.toThrow('registro mudou');
  await expect(
    run(async () => {
      const fresh = await accounts.find(a.id);
      return accounts.update(a.id, { ...fresh, openingBalance: 200 }, String(fresh.version));
    }),
  ).rejects.toThrow('reconciliação');
  expect(await db.forUser(db.other, () => basis.exportHistory())).toHaveLength(0);
  await expect(
    run(() =>
      db.service.query('DELETE FROM wallet.account_balance_history WHERE id=$1', [event.id]),
    ),
  ).rejects.toThrow();
});
it('round-trips manual observation membership and undo history in v6 backups', async () => {
  const a = await account('Portable observation');
  await run(() => ledger.create(movement(a.id, 100, today())));
  const first = await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 100, targetBalance: 150, reason: 'Portable first' },
      'portable-first',
    ),
  );
  await run(() => ledger.create(movement(a.id, -20, today())));
  const second = await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 130, targetBalance: 160, reason: 'Portable second' },
      'portable-second',
    ),
  );
  const exported = await run(() => backup.backup());
  const space = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Restored basis') RETURNING id",
    [db.user],
  );
  await db.forUser(
    db.user,
    async () => {
      const draft = await backup.preview(exported);
      await backup.confirm(draft.id);
      const restored = (await accounts.list()).find((row) => row.name === a.name)!;
      expect(restored.balance).toBe(160);
      const history = await basis.history(restored.id);
      const latest = history.find((row) => row.reason === 'Portable second')!;
      expect(latest.id).not.toBe(second.id);
      expect(latest.previousBasis.originId).not.toBe(first.id);
      await basis.undo(restored.id, latest.id, restored.version);
      expect((await accounts.find(restored.id)).balance).toBe(130);
    },
    false,
    space.rows[0].id,
  );
});
it('restores old correction transactions into base history exactly once', async () => {
  const accountId = randomUUID();
  const transactionId = randomUUID();
  const payload = {
    format: 'mywallet',
    version: 4,
    currency: 'BRL',
    exportedAt: new Date().toISOString(),
    categoryGroups: [],
    monthlyPlans: [],
    categories: [],
    accounts: [
      {
        id: accountId,
        name: 'Legacy backup correction',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 1000,
        openingDate: '2026-01-01',
      },
    ],
    transactions: [
      {
        ...movement(accountId, -100),
        id: transactionId,
        categoryId: null,
        transferGroupId: null,
        sourceOperationId: null,
      },
      {
        id: randomUUID(),
        accountId,
        categoryId: null,
        transferGroupId: null,
        sourceOperationId: null,
        transactionDate: '2026-10-01',
        description: 'Old correction',
        transactionType: 'transfer',
        amount: 500,
        balanceAdjustment: {
          previousBalance: 900,
          targetBalance: 1400,
          reason: 'Old known balance',
        },
      },
    ],
  };
  const space = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Legacy base restore') RETURNING id",
    [db.user],
  );
  await db.forUser(
    db.user,
    async () => {
      const draft = await backup.preview(payload);
      await backup.confirm(draft.id);
      await backup.confirm(draft.id);
      const a = (await accounts.list()).find((row) => row.name === 'Legacy backup correction')!;
      expect(a.balance).toBe(1400);
      expect((await ledger.exportRecords()).filter((row) => row.accountId === a.id)).toHaveLength(
        1,
      );
      expect((await basis.history(a.id))[0].operation).toBe('legacy_conversion');
    },
    false,
    space.rows[0].id,
  );
});

it('rebases both sides of historical transfers and undoes same-day transfers with no extra cash', async () => {
  const a = await account('Transfer source'),
    b = await account('Transfer target');
  await run(() => ledger.create(movement(a.id, 100)));
  await run(() => ledger.create(movement(b.id, 200)));
  await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 100, targetBalance: 150, reason: 'Source checked' },
      'source-check',
    ),
  );
  await run(() =>
    ledger.adjustBalance(
      b.id,
      { expectedBalance: 200, targetBalance: 250, reason: 'Target checked' },
      'target-check',
    ),
  );
  const historic = await run(() =>
    ledger.transfer(
      {
        fromAccountId: a.id,
        toAccountId: b.id,
        amount: 30,
        transactionDate: '2026-01-02',
        description: 'Historical internal transfer',
      },
      'old-transfer',
    ),
  );
  expect((await run(() => accounts.find(a.id))).balance).toBe(150);
  expect((await run(() => accounts.find(b.id))).balance).toBe(250);
  await run(() => ledger.reverse(historic.from.id, String(historic.from.version)));
  const current = await run(() =>
    ledger.transfer(
      {
        fromAccountId: a.id,
        toAccountId: b.id,
        amount: 30,
        transactionDate: today(),
        description: 'Current internal transfer',
      },
      'current-transfer',
    ),
  );
  expect((await run(() => accounts.find(a.id))).balance).toBe(120);
  expect((await run(() => accounts.find(b.id))).balance).toBe(280);
  await run(() => ledger.reverse(current.to.id, String(current.to.version)));
  expect((await run(() => accounts.find(a.id))).balance).toBe(150);
  expect((await run(() => accounts.find(b.id))).balance).toBe(250);
});

it('restores the original manual membership when a later manual correction and bank reference are both undone', async () => {
  const a = await account('Mixed reference undo');
  await run(() => ledger.create(movement(a.id, 100, '2026-01-01')));
  await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 100, targetBalance: 150, reason: 'First manual reference' },
      'mixed-first',
    ),
  );
  const bank = await statement(a.id, '2026-02-01', 130, [20]);
  await confirm(bank);
  expect((await run(() => accounts.find(a.id))).balanceBasis?.kind).toBe('statement');
  await run(() => ledger.create(movement(a.id, -10, today())));
  const latest = await run(() =>
    ledger.adjustBalance(
      a.id,
      { expectedBalance: 140, targetBalance: 145, reason: 'Later manual reference' },
      'mixed-later',
    ),
  );
  await run(async () => basis.undo(a.id, latest.id, (await accounts.find(a.id)).version));
  await run(() => imports.reverse(bank.id, String(bank.version + 1)));
  expect(await run(() => accounts.find(a.id))).toMatchObject({
    balance: 140,
    openingBalance: 50,
    balanceBasis: { kind: 'manual' },
  });
});
