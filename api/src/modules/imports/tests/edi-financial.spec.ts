import 'reflect-metadata';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TestDatabase } from '../../../../test/database-harness.js';
import { AccountsService } from '../../accounts/services/accounts.service.js';
import { AccountsRepository } from '../../accounts/repositories/accounts.repository.js';
import { CategoriesService } from '../../categories/services/categories.service.js';
import { CategoriesRepository } from '../../categories/repositories/categories.repository.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { LedgerRepository } from '../../ledger/repositories/ledger.repository.js';
import { IdempotencyService } from '../../ledger/services/idempotency.service.js';
import { ImportsRepository } from '../repositories/imports.repository.js';
import { ImportsService } from '../services/imports.service.js';
import { ImportReconciliationService } from '../services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../repositories/import-reconciliation.repository.js';
import { settlementFixture } from './settlement-fixture.js';
import { extractMercadoPagoStatement } from '../parsers/mercado-pago/extract-statement.js';
import { DataExportService } from '../../data-export/services/data-export.service.js';
import { RestoreRepository } from '../../data-export/repositories/restore.repository.js';
import { PlanningService } from '../../planning/services/planning.service.js';
import { PlanningRepository } from '../../planning/repositories/planning.repository.js';
const db = new TestDatabase();
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const receipts = new IdempotencyService(db.service);
const ledger = new LedgerService(new LedgerRepository(db.service), accounts, categories, receipts);
const imports = new ImportsService(
  new ImportsRepository(db.service),
  accounts,
  ledger,
  receipts,
  categories,
  ledger,
  new ImportReconciliationService(new ImportReconciliationRepository(db.service)),
);
const backups = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  new PlanningService(new PlanningRepository(db.service), categories, ledger),
);
beforeAll(() => db.initialize());
afterAll(() => db.close());
const run = <T>(fn: () => Promise<T>) => db.forUser(db.user, fn);
async function account(name: string) {
  return run(() =>
    accounts.create({
      name,
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 10000,
      openingDate: '2026-10-01',
    }),
  );
}
async function edi(
  accountId: string,
  reference: string,
  overrides: Record<string, string> = {},
  suffix = '',
) {
  const fixture = settlementFixture({
    SOURCE_ID: reference,
    SETTLEMENT_NET_AMOUNT: '-10.00',
    IS_RELEASED: 'false',
    ...overrides,
  });
  const parsed = await extractMercadoPagoStatement(fixture.buffer, 'edi.csv');
  return run(() =>
    imports.upload(
      accountId,
      Buffer.concat([fixture.buffer, Buffer.from(suffix)]),
      'edi.csv',
      parsed,
    ),
  );
}
async function statement(accountId: string, reference: string) {
  const parsed = {
    openingBalance: 10000,
    closingBalance: 9000,
    items: [
      {
        sourceRow: 1,
        sourcePage: 1,
        sourceOperationId: reference,
        description: 'Original purchase',
        transactionDate: '2026-10-03',
        amount: -1000,
        balanceAfter: 9000,
      },
    ],
  };
  return run(() =>
    imports.upload(accountId, Buffer.from(accountId + reference), 'statement.pdf', parsed),
  );
}
it('creates pending statement entries, then reconciles with EDI without duplicating or replacing categories', async () => {
  const a = await account('statement first');
  const draft = await statement(a.id, 'edi-reference');
  await run(() => imports.confirm(draft.id, draft.version, 'statement-first'));
  const entry = (await run(() => ledger.exportRecords())).find((t) => t.accountId === a.id)!;
  expect((await run(() => ledger.find(entry.id))).reconciliationStatus).toBe('pending');
  const category = await run(() =>
    categories.save({ name: 'EDI preserved category', type: 'expense', color: '#f28a97' }),
  );
  await run(() =>
    ledger.update(
      entry.id,
      { ...entry, description: 'Reviewed name', categoryId: category.id },
      String(entry.version),
    ),
  );
  const report = await edi(a.id, 'edi-reference');
  expect(report.items[0].action).toBe('reconcile');
  await run(() => imports.confirm(report.id, report.version, 'reconcile-existing'));
  expect((await run(() => accounts.find(a.id))).balance).toBe(9000);
  expect(await run(() => ledger.find(entry.id))).toMatchObject({
    description: 'Reviewed name',
    categoryId: category.id,
    reconciliationStatus: 'reconciled',
    sourceOperationId: 'edi-reference',
  });
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
});
it('uses EDI to create reconciled transactions and later statements only attach evidence', async () => {
  const a = await account('EDI first');
  const report = await edi(a.id, 'edi-first');
  expect(report.items[0]).toMatchObject({
    action: 'create',
    selected: true,
    transactionType: 'expense',
  });
  await run(() => imports.confirm(report.id, report.version, 'edi-create'));
  const original = (await run(() => ledger.exportRecords())).find((t) => t.accountId === a.id)!;
  expect((await run(() => ledger.find(original.id))).reconciliationStatus).toBe('reconciled');
  const other = await statement(a.id, 'edi-first');
  expect(other.items[0].action).toBe('reconcile');
  await run(() => imports.confirm(other.id, other.version, 'statement-after-edi'));
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
  expect((await run(() => accounts.find(a.id))).balance).toBe(9000);
  await expect(run(() => imports.reverse(report.id, String(report.version + 1)))).rejects.toThrow(
    'Outro arquivo',
  );
});
it('does not create available cash from unavailable receipts or silently classify unknown events', async () => {
  const a = await account('Unavailable');
  for (const overrides of [
    { SETTLEMENT_NET_AMOUNT: '10.00' },
    { TRANSACTION_TYPE: 'UNKNOWN_EVENT' },
  ] as Record<string, string>[]) {
    const report = await edi(a.id, 'pending-' + JSON.stringify(overrides), overrides);
    expect(report.items[0]).toMatchObject({ action: 'review', selected: false });
    await expect(
      run(() => imports.confirm(report.id, report.version, 'blocked-' + report.id)),
    ).rejects.toThrow('Selecione');
  }
  expect((await run(() => accounts.find(a.id))).balance).toBe(10000);
});
it('keeps portable source identity after backup/restore and blocks repeated EDI financial effects', async () => {
  const a = await account('Portable EDI');
  const report = await edi(a.id, 'portable-id');
  await run(() => imports.confirm(report.id, report.version, 'portable-confirm'));
  const backup = await run(() => backups.backup());
  expect(backup.version).toBe(4);
  await db.forUser(db.other, async () => {
    const draft = await backups.preview(backup);
    await backups.confirm(draft.id);
  });
  await db.forUser(db.other, async () => {
    const restored = (await accounts.list()).find((row) => row.name === 'Portable EDI')!;
    const fixture = settlementFixture({
      SOURCE_ID: 'portable-id',
      SETTLEMENT_NET_AMOUNT: '-10.00',
      IS_RELEASED: 'false',
    });
    const parsed = await extractMercadoPagoStatement(fixture.buffer, 'edi.csv');
    const again = await imports.upload(restored.id, fixture.buffer, 'edi.csv', parsed);
    expect(again.items[0].action).toBe('recorded');
    await imports.confirm(again.id, again.version, 'restored-edi-confirm');
    expect((await accounts.find(restored.id)).balance).toBe(9000);
  });
});
it('preserves repeated source confirmations and only removes reconciliation when the last supporting EDI is undone', async () => {
  const a = await account('Evidence reversal');
  const original = await statement(a.id, 'reversal-ref');
  await run(() => imports.confirm(original.id, original.version, 'pending-original'));
  const first = await edi(a.id, 'reversal-ref');
  await run(() => imports.confirm(first.id, first.version, 'first-proof'));
  const second = await edi(a.id, 'reversal-ref', {}, '\n');
  expect(second.items[0].action).toBe('recorded');
  await run(() => imports.confirm(second.id, second.version, 'second-proof'));
  const entry = (await run(() => ledger.exportRecords())).find((t) => t.accountId === a.id)!;
  await run(() => imports.reverse(second.id, String(second.version + 1)));
  expect((await run(() => ledger.find(entry.id))).reconciliationStatus).toBe('reconciled');
  await run(() => imports.reverse(first.id, String(first.version + 1)));
  expect((await run(() => ledger.find(entry.id))).reconciliationStatus).toBe('pending');
  expect((await run(() => accounts.find(a.id))).balance).toBe(9000);
});
it('retains external IDs when reconciling manual entries and rejects foreign account links', async () => {
  const a = await account('Manual reconciliation');
  const entry = await run(() =>
    ledger.create({
      accountId: a.id,
      transactionDate: '2026-10-03',
      description: 'Manual purchase',
      amount: -1000,
      transactionType: 'expense',
    }),
  );
  const report = await edi(a.id, 'external-manual-id');
  expect(report.items[0].action).toBe('review');
  const resolved = await run(() =>
    imports.review(
      report.id,
      report.items[0].id,
      { selected: true, transactionType: 'expense', linkedTransactionId: entry.id },
      String(report.version),
    ),
  );
  expect(resolved.items[0].action).toBe('reconcile');
  await run(() => imports.confirm(report.id, resolved.version, 'manual-linked'));
  expect(await run(() => ledger.find(entry.id))).toMatchObject({
    sourceOperationId: 'external-manual-id',
    reconciliationStatus: 'reconciled',
  });
  const other = await account('Foreign');
  const foreign = await edi(other.id, 'foreign-manual-id');
  await expect(
    run(() =>
      imports.review(
        foreign.id,
        foreign.items[0].id,
        { selected: true, transactionType: 'expense', linkedTransactionId: entry.id },
        String(foreign.version),
      ),
    ),
  ).rejects.toThrow('compatível');
});

it('does not collapse distinct EDI events sharing reference, date and amount', async () => {
  const a = await account('Repeated external reference');
  const first = await edi(a.id, 'repeat-external');
  await run(() => imports.confirm(first.id, first.version, 'repeated-event-first'));
  const second = await edi(a.id, 'repeat-external', {
    SETTLEMENT_DATE: '2026-10-03T00:06:00-04:00',
  });
  expect(second.items[0].action).toBe('review');
  const reviewed = await run(() =>
    imports.review(
      second.id,
      second.items[0].id,
      { selected: true, transactionType: 'expense', confirmNew: true },
      String(second.version),
    ),
  );
  expect(reviewed.items[0].action).toBe('create');
  await run(() => imports.confirm(second.id, reviewed.version, 'repeated-event-second'));
  expect(
    (await run(() => ledger.exportRecords())).filter((row) => row.accountId === a.id),
  ).toHaveLength(2);
  expect((await run(() => accounts.find(a.id))).balance).toBe(8000);
});
it('returns an edited reconciled movement to pending and supports reconciliation filters', async () => {
  const a = await account('Edited reconciliation');
  const report = await edi(a.id, 'edited-proof');
  await run(() => imports.confirm(report.id, report.version, 'edited-proof-confirm'));
  const entry = (await run(() => ledger.exportRecords())).find((row) => row.accountId === a.id)!;
  expect(
    (await run(() => ledger.list({ limit: 100, accountId: a.id, reconciliation: 'reconciled' })))
      .items,
  ).toHaveLength(1);
  await run(() => ledger.update(entry.id, { ...entry, amount: -900 }, String(entry.version)));
  expect((await run(() => ledger.find(entry.id))).reconciliationStatus).toBe('pending');
  expect(
    (await run(() => ledger.list({ limit: 100, accountId: a.id, reconciliation: 'reconciled' })))
      .items,
  ).toHaveLength(0);
  expect(
    (await run(() => ledger.list({ limit: 100, accountId: a.id, reconciliation: 'pending' })))
      .items,
  ).toHaveLength(1);
  const again = await edi(a.id, 'edited-proof', {}, '\n\n');
  expect(again.items[0].action).toBe('review');
});
