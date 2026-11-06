import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository.js';
import { AccountsService } from '../../accounts/services/accounts.service.js';
import { BalanceBasisRepository } from '../../accounts/repositories/balance-basis.repository.js';
import { BalanceBasisService } from '../../accounts/services/balance-basis.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { LedgerRepository } from '../../ledger/repositories/ledger.repository.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { IdempotencyService } from '../../ledger/services/idempotency.service.js';
import { CommitmentsService } from '../services/commitments.service.js';
import { CommitmentsRepository } from '../repositories/commitments.repository.js';
import { dueDates } from '../services/commitment-calendar.js';
import { validateInput } from '../../../core/http/index.js';
import { SaveCommitmentDto, SettleCommitmentDto } from '../dto/commitments.dto.js';
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
const commitments = new CommitmentsService(
  new CommitmentsRepository(db.service),
  accounts,
  categories,
  ledger,
  ledger,
  receipts,
);
const backup = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  new PlanningService(new PlanningRepository(db.service), categories, ledger, accounts),
  parties,
  basis,
  commitments,
);
const run = <T>(fn: () => Promise<T>) => db.forUser(db.user, fn);
beforeAll(async () => {
  await db.initialize();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));
});
afterAll(async () => {
  vi.useRealTimers();
  await db.close();
});
const account = (name: string, institution = 'mercado_pago', type = 'checking') =>
  run(() =>
    accounts.create({ name, institution, type, openingBalance: 10000, openingDate: '2026-01-01' }),
  );
const input = (accountId: string) => ({
  accountId,
  categoryId: null,
  description: 'Internet',
  amount: 2000,
  transactionType: 'expense' as const,
  frequency: 'monthly' as const,
  startDate: '2026-11-10',
  endDate: null,
});
const schedule = (accountId: string) =>
  run(() => commitments.create(input(accountId), randomUUID()));
const movement = (accountId: string, amount = -2000) => ({
  accountId,
  amount,
  description: 'Pagamento existente',
  transactionType: amount < 0 ? ('expense' as const) : ('income' as const),
  transactionDate: '2026-11-11',
});

it('clamps monthly dates without drifting after February, including leap years', () => {
  const rule = {
    ...input(randomUUID()),
    id: randomUUID(),
    version: 1,
    endedOn: null,
    startDate: '2024-01-31',
  };
  expect(dueDates(rule, '2024-04-30')).toEqual([
    '2024-01-31',
    '2024-02-29',
    '2024-03-31',
    '2024-04-30',
  ]);
  expect(
    dueDates({ ...rule, startDate: '2025-01-31', endDate: '2025-03-01' }, '2025-05-31'),
  ).toEqual(['2025-01-31', '2025-02-28']);
  expect(dueDates({ ...rule, frequency: 'once' }, '2024-12-31')).toEqual(['2024-01-31']);
});
it('creates idempotent commitments without changing balances, budgets or actual movements', async () => {
  const a = await account('Bills');
  const key = randomUUID();
  const rule = await run(() => commitments.create(input(a.id), key));
  expect(await run(() => commitments.create(input(a.id), key))).toEqual(rule);
  expect((await run(() => accounts.find(a.id))).balance).toBe(10000);
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(0);
  const summary = await run(() => commitments.summary('2026-11'));
  expect(summary.items.find((r) => r.scheduleId === rule.id)).toMatchObject({
    status: 'overdue',
    dueDate: '2026-11-10',
  });
  expect(summary.projection.find((r) => r.accountId === a.id)).toMatchObject({
    balance: 10000,
    expense: 2000,
    income: 0,
    projected: 8000,
    kind: 'cash',
  });
  await expect(
    run(() => commitments.create({ ...input(a.id), amount: 3000 }, key)),
  ).rejects.toThrow('outra operação');
});
it('links an existing payment without posting money twice and prevents reuse across obligations', async () => {
  const a = await account('Link');
  const entry = await run(() => ledger.create(movement(a.id)));
  const rule = await schedule(a.id);
  expect(
    (await run(() => commitments.candidates(rule.id, '2026-11-10'))).some((r) => r.id === entry.id),
  ).toBe(true);
  const payload = { action: 'link' as const, transactionId: entry.id, transactionVersion: 1 };
  const key = randomUUID();
  const result = await run(() =>
    commitments.resolve(rule.id, '2026-11-10', payload, String(rule.version), key),
  );
  expect(
    await run(() => commitments.resolve(rule.id, '2026-11-10', payload, String(rule.version), key)),
  ).toEqual(result);
  expect((await run(() => accounts.find(a.id))).balance).toBe(8000);
  expect(
    (await run(() => commitments.summary('2026-11'))).projection.find((r) => r.accountId === a.id),
  ).toMatchObject({ expense: 0, projected: 8000 });
  const second = await schedule(a.id);
  await expect(
    run(() =>
      commitments.resolve(second.id, '2026-11-10', payload, String(second.version), randomUUID()),
    ),
  ).rejects.toThrow('outro vencimento');
  await expect(run(() => commitments.end(rule.id, String(rule.version)))).rejects.toThrow('mudou');
});
it('records the actual amount once, reopens without deleting money and accepts relinking', async () => {
  const a = await account('Actual');
  const rule = await schedule(a.id);
  const key = randomUUID();
  const payload = { action: 'create' as const, transactionDate: '2026-11-15', amount: 2500 };
  const result = await run(() =>
    commitments.resolve(rule.id, '2026-11-10', payload, String(rule.version), key),
  );
  await run(() => commitments.resolve(rule.id, '2026-11-10', payload, String(rule.version), key));
  let summary = await run(() => commitments.summary('2026-11'));
  expect(summary.items.find((r) => r.scheduleId === rule.id)).toMatchObject({
    status: 'settled',
    amount: 2000,
    actualAmount: 2500,
  });
  expect((await run(() => accounts.find(a.id))).balance).toBe(7500);
  const current = summary.schedules.find((r) => r.id === rule.id)!;
  await run(() =>
    commitments.resolve(
      rule.id,
      '2026-11-10',
      { action: 'reopen' },
      String(current.version),
      randomUUID(),
    ),
  );
  expect((await run(() => accounts.find(a.id))).balance).toBe(7500);
  summary = await run(() => commitments.summary('2026-11'));
  await run(() =>
    commitments.resolve(
      rule.id,
      '2026-11-10',
      { action: 'link', transactionId: result.transactionId!, transactionVersion: 1 },
      String(summary.schedules.find((r) => r.id === rule.id)!.version),
      randomUUID(),
    ),
  );
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
});
it('rejects foreign, opposite-direction and future payments atomically', async () => {
  const a = await account('Validation');
  const b = await account('Different');
  const rule = await schedule(a.id);
  const entries = [
    await run(() => ledger.create(movement(b.id))),
    await run(() => ledger.create(movement(a.id, 2000))),
    await run(() => ledger.create({ ...movement(a.id), transactionDate: '2026-12-01' })),
  ];
  for (const entry of entries)
    await expect(
      run(() =>
        commitments.resolve(
          rule.id,
          '2026-11-10',
          { action: 'link', transactionId: entry.id, transactionVersion: 1 },
          String(rule.version),
          randomUUID(),
        ),
      ),
    ).rejects.toThrow('mesma conta e tipo');
  await expect(
    run(() =>
      commitments.resolve(
        rule.id,
        '2026-11-10',
        { action: 'create', amount: 2000, transactionDate: '2026-12-01' },
        String(rule.version),
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('já realizados');
  expect(
    (await run(() => commitments.exportCommitments())).occurrences.filter(
      (r) => r.scheduleId === rule.id,
    ),
  ).toHaveLength(0);
  await expect(db.forUser(db.other, () => commitments.end(rule.id, '1'))).rejects.toThrow(
    'não encontrado',
  );
});
it('edits pending dates only and ending a series preserves past debt and completed snapshots', async () => {
  const a = await account('Series');
  const rule = await run(() =>
    commitments.create({ ...input(a.id), startDate: '2026-10-10' }, randomUUID()),
  );
  await run(() =>
    commitments.resolve(
      rule.id,
      '2026-10-10',
      { action: 'skip' },
      String(rule.version),
      randomUUID(),
    ),
  );
  let state = await run(() => commitments.summary('2026-11'));
  const version = state.schedules.find((r) => r.id === rule.id)!.version;
  await run(() =>
    commitments.update(
      rule.id,
      { ...input(a.id), startDate: '2026-10-10', description: 'Updated bill', amount: 3000 },
      String(version),
    ),
  );
  state = await run(() => commitments.summary('2026-10'));
  expect(
    state.items.find((r) => r.scheduleId === rule.id && r.dueDate === '2026-10-10'),
  ).toMatchObject({ description: 'Internet', amount: 2000, status: 'skipped' });
  const updated = state.schedules.find((r) => r.id === rule.id)!;
  await run(() => commitments.end(rule.id, String(updated.version)));
  state = await run(() => commitments.summary('2026-12'));
  expect(state.items.filter((r) => r.scheduleId === rule.id)).toEqual([
    expect.objectContaining({ dueDate: '2026-11-10', status: 'overdue', amount: 3000 }),
  ]);
});
it('keeps benefits and reserves separate and includes overdue debts in future projections', async () => {
  const a = await account('Benefit', 'alelo', 'benefit_food');
  const b = await account('Reserve', 'mercado_pago', 'reserve');
  await schedule(a.id);
  await run(() => commitments.create({ ...input(b.id), transactionType: 'income' }, randomUUID()));
  const summary = await run(() => commitments.summary('2026-12'));
  expect(summary.projection.find((r) => r.accountId === a.id)).toMatchObject({
    kind: 'benefits',
    expense: 4000,
    projected: 6000,
  });
  expect(summary.projection.find((r) => r.accountId === b.id)).toMatchObject({
    kind: 'reserves',
    income: 4000,
    projected: 14000,
  });
  await expect(run(() => commitments.summary('2027-12'))).rejects.toThrow('12 meses');
});
it('reopens invalid linked entries for review and round-trips commitment snapshots in v8 backups', async () => {
  const a = await account('Reversal');
  const rule = await schedule(a.id);
  const entry = await run(() => ledger.create(movement(a.id)));
  await run(() =>
    commitments.resolve(
      rule.id,
      '2026-11-10',
      { action: 'link', transactionId: entry.id, transactionVersion: 1 },
      String(rule.version),
      randomUUID(),
    ),
  );
  const t = await run(() => ledger.find(entry.id));
  await run(() => ledger.reverse(entry.id, String(t.version)));
  expect(
    (await run(() => commitments.summary('2026-11'))).items.find((r) => r.scheduleId === rule.id),
  ).toMatchObject({ status: 'review' });
  const data = await run(() => backup.backup());
  expect(data.version).toBe(13);
  expect(data.commitments!.occurrences.find((r) => r.scheduleId === rule.id)).toMatchObject({
    status: 'review',
    transactionId: null,
  });
  await db.forUser(db.other, async () => {
    const draft = await backup.preview(data);
    await backup.confirm(draft.id);
    const restored = await backup.backup();
    expect(restored.commitments!.schedules.length).toBe(data.commitments!.schedules.length);
    expect(restored.commitments!.occurrences.filter((r) => r.status === 'review')).toHaveLength(1);
    expect(restored.commitments!.schedules.some((r) => r.accountId === a.id)).toBe(false);
  });
  const bad = structuredClone(data);
  bad.commitments!.schedules[0].accountId = randomUUID();
  await expect(run(() => backup.preview(bad))).rejects.toThrow('compromissos');
  const old = structuredClone(data);
  old.version = 7;
  delete old.goals;
  delete old.commitments;
  delete old.cards;
  delete old.wealth;
  await db.forUser(db.other, async () => {
    const draft = await backup.preview({ ...old, monthlyPlans: [] });
    await backup.review(draft.id);
    await backup.confirm(draft.id);
  });
});
it('validates transport amounts, dates, enum values and ownership injection', async () => {
  for (const change of [
    { amount: 0 },
    { amount: 1.5 },
    { frequency: 'weekly' },
    { startDate: '2026-02-30' },
    { userId: randomUUID() },
  ])
    await expect(
      validateInput(SaveCommitmentDto, { ...input(randomUUID()), ...change }),
    ).rejects.toThrow();
  await expect(
    validateInput(SettleCommitmentDto, { action: 'create', amount: -1 }),
  ).rejects.toThrow();
});

it('isolates schedules and transaction links between spaces of the same owner and purges their snapshots', async () => {
  const a = await account('Original space');
  const original = await schedule(a.id);
  const space = (
    await db.engine.query<{ id: string }>(
      "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Temporary commitments') RETURNING id",
      [db.user],
    )
  ).rows[0].id;
  await db.forUser(
    db.user,
    async () => {
      expect((await commitments.exportCommitments()).schedules).toHaveLength(0);
      await expect(commitments.create(input(a.id), randomUUID())).rejects.toThrow(
        'Conta não encontrada',
      );
    },
    true,
    space,
  );
  let scheduleId = '';
  await db.forUser(
    db.user,
    async () => {
      const own = await accounts.create({
        name: 'Owned temp',
        institution: 'mercado_pago',
        type: 'checking',
      });
      const rule = await commitments.create({ ...input(own.id), frequency: 'once' }, randomUUID());
      scheduleId = rule.id;
      await commitments.resolve(
        rule.id,
        '2026-11-10',
        { action: 'create', amount: 100, transactionDate: '2026-11-15' },
        String(rule.version),
        randomUUID(),
      );
    },
    false,
    space,
  );
  expect(
    (await run(() => commitments.exportCommitments())).schedules.some((r) => r.id === scheduleId),
  ).toBe(false);
  await db.engine.query(
    "UPDATE wallet.workspaces SET deleted_at=clock_timestamp()-interval '8 days' WHERE id=$1",
    [space],
  );
  await db.engine.query('SELECT wallet.purge_expired_workspaces($1)', [db.user]);
  expect(
    (await db.engine.query('SELECT id FROM wallet.commitment_schedules WHERE id=$1', [scheduleId]))
      .rows,
  ).toHaveLength(0);
  expect(
    (await run(() => commitments.exportCommitments())).schedules.some((r) => r.id === original.id),
  ).toBe(true);
});

it('refuses to link a payment changed since candidate review', async () => {
  const a = await account('Stale payment');
  const rule = await schedule(a.id);
  const entry = await run(() => ledger.create(movement(a.id)));
  await run(() => ledger.update(entry.id, movement(a.id, -3000), '1'));
  await expect(
    run(() =>
      commitments.resolve(
        rule.id,
        '2026-11-10',
        { action: 'link', transactionId: entry.id, transactionVersion: 1 },
        String(rule.version),
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('mudou');
  expect(
    (await run(() => commitments.exportCommitments())).occurrences.some(
      (r) => r.scheduleId === rule.id,
    ),
  ).toBe(false);
});
