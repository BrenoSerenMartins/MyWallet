import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
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
import { ImportsService } from '../services/imports.service.js';
import { ImportsRepository } from '../repositories/imports.repository.js';
import { ImportReconciliationService } from '../services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../repositories/import-reconciliation.repository.js';
import { parseAleloPages } from '../parsers/alelo/benefit.parser.js';
import { mapAlelo } from '../mappers/alelo/benefit.mapper.js';
import { DashboardService } from '../../dashboard/services/dashboard.service.js';
import { validateBackup } from '../../data-export/services/backup-validation.js';
import { sourceEvidenceKey } from '../../../core/integration/index.js';
import type { TextCell } from '../contracts/statement.js';
const db = new TestDatabase();
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
);
const imports = new ImportsService(
  new ImportsRepository(db.service),
  accounts,
  ledger,
  receipts,
  categories,
  ledger,
  new ImportReconciliationService(new ImportReconciliationRepository(db.service)),
  accounts,
  counterparties,
);
const run = <T>(fn: () => Promise<T>) => db.forUser(db.user, fn);
beforeAll(() => db.initialize());
afterAll(() => db.close());
const cell = (text: string, x: number, y: number): TextCell => ({ text, x, y });
function sample(): TextCell[][] {
  return [
    [
      cell('Extrato Alelo Alimentação', 46, 1127),
      cell('Saldo', 217, 1076),
      cell('R$ 0,00', 243, 1076),
      cell('Último benefício', 560, 1076),
      cell('2026-09-30 - R$ 100,00', 622, 1076),
      cell('SYNTHETIC MARKET', 214, 1036),
      cell('02/10/2026', 214, 1027),
      cell('- R$ 10,00', 686, 1031),
      cell('SYNTHETIC MARKET', 214, 1013),
      cell('02/10/2026', 214, 1004),
      cell('- R$ 10,00', 683, 1009),
      cell('Seu Benefício Caiu', 214, 991),
      cell('30/09/2026', 214, 982),
      cell('R$ 100,00', 686, 986),
      cell('10/26/26, 4:45 PM', 20, 15),
    ],
  ];
}
async function account(name: string, type = 'benefit_food') {
  return run(() =>
    accounts.create({
      name,
      institution: 'alelo',
      type,
      openingBalance: 0,
      openingDate: '2026-09-01',
    }),
  );
}
it('extracts reverse-ordered Alelo rows, excludes summary/footer and preserves genuine same-day duplicates', () => {
  const result = parseAleloPages(sample());
  expect(result).toMatchObject({
    institution: 'alelo',
    reportType: 'benefit_statement',
    openingBalance: null,
    closingBalance: null,
  });
  expect(result.items.map((i) => i.amount)).toEqual([10000, -1000, -1000]);
  expect(result.items.map((i) => i.transactionDate)).toEqual([
    '2026-09-30',
    '2026-10-02',
    '2026-10-02',
  ]);
  expect(result.items.every((i) => i.sourceOperationId === null && i.balanceAfter === null)).toBe(
    true,
  );
  expect(mapAlelo(result).map((i) => i.transactionType)).toEqual(['income', 'expense', 'expense']);
});
it('rejects unknown layouts, incomplete amount rows, impossible dates and image-only pages', () => {
  expect(() => parseAleloPages([[]])).toThrow('Alimentação');
  expect(() => parseAleloPages([sample()[0].filter((i) => i.text !== '- R$ 10,00')])).toThrow(
    'incompleta',
  );
  expect(() =>
    parseAleloPages([
      sample()[0].map((i) => (i.text === '02/10/2026' ? { ...i, text: '31/02/2026' } : i)),
    ]),
  ).toThrow();
  expect(() => parseAleloPages([[cell('Extrato Alelo Refeição', 46, 1127)]])).toThrow(
    'Alimentação',
  );
});
it('keeps account product/institution consistent and does not silently relocate the legacy MP benefit', async () => {
  await expect(
    run(() =>
      accounts.create({
        name: 'Invalid',
        institution: 'alelo',
        type: 'checking',
        openingBalance: 0,
        openingDate: '2026-01-01',
      }),
    ),
  ).rejects.toThrow('Alimentação');
  const mp = await run(() =>
    accounts.create({
      name: 'Manual MP benefit',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 0,
      openingDate: '2026-01-01',
    }),
  );
  await run(() =>
    ledger.create({
      accountId: mp.id,
      transactionDate: '2026-10-01',
      description: 'Manual benefit',
      amount: 70000,
      transactionType: 'income',
    }),
  );
  await account('Separate Alelo');
  expect((await run(() => accounts.find(mp.id))).balance).toBe(70000);
  await expect(
    run(() =>
      accounts.update(
        mp.id,
        { ...mp, institution: 'alelo', type: 'benefit_food' },
        String(mp.version),
      ),
    ),
  ).rejects.toThrow('preservados');
});
it('imports partial Alelo history, maintains pending status and refuses another institution or benefit product', async () => {
  const a = await account('Food import');
  const parsed = parseAleloPages(sample());
  const draft = await run(() =>
    imports.upload(a.id, Buffer.from('alelo-fixture'), 'alelo.pdf', parsed),
  );
  expect(draft).toMatchObject({
    reconciliationCapability: 'partial',
    openingMismatch: false,
    openingBalance: null,
    canIntegrate: true,
  });
  expect(draft.items.every((i) => i.selected && i.action === 'create')).toBe(true);
  await run(() => imports.confirm(draft.id, draft.version, 'alelo-confirm'));
  const rows = (await run(() => ledger.exportRecords())).filter((i) => i.accountId === a.id);
  expect(rows).toHaveLength(3);
  expect(
    rows.every((i) => i.sourceOperationId === null && i.reconciliationStatus === 'pending'),
  ).toBe(true);
  expect((await run(() => accounts.find(a.id))).balance).toBe(8000);
  const same = await run(() =>
    imports.upload(a.id, Buffer.from('alelo-fixture'), 'alelo.pdf', parsed),
  );
  expect(same.id).toBe(draft.id);
  const meal = await account('Meal account', 'benefit_meal');
  await expect(
    run(() => imports.upload(meal.id, Buffer.from('meal'), 'alelo.pdf', parsed)),
  ).rejects.toThrow('Alimentação');
  const mp = await run(() =>
    accounts.create({
      name: 'Another MP',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 0,
      openingDate: '2026-01-01',
    }),
  );
  await expect(
    run(() => imports.upload(mp.id, Buffer.from('wrong-bank'), 'alelo.pdf', parsed)),
  ).rejects.toThrow('instituição');
  await expect(db.forUser(db.other, () => imports.preview(draft.id))).rejects.toThrow(
    'não encontrada',
  );
});
it('requires review for overlapping benefit exports, then links occurrences without duplicate financial effects', async () => {
  const a = await account('Overlap Alelo');
  const parsed = parseAleloPages(sample());
  const original = await run(() =>
    imports.upload(a.id, Buffer.from('overlap-original'), 'alelo.pdf', parsed),
  );
  await run(() => imports.confirm(original.id, original.version, 'overlap-alelo'));
  let overlap = await run(() =>
    imports.upload(a.id, Buffer.from('overlap-export'), 'another.pdf', parsed),
  );
  expect(overlap.items.every((i) => i.action === 'review' && !i.selected)).toBe(true);
  const originalEntries = (await run(() => ledger.exportRecords())).filter(
    (i) => i.accountId === a.id,
  );
  for (const item of overlap.items) {
    const target = originalEntries.find((entry) =>
      entry.sourceEvidence.some(
        (source) =>
          source.date === item.transactionDate &&
          source.amount === item.amount &&
          source.occurrence === item.sourceEvidence?.occurrence,
      ),
    )!;
    overlap = await run(() =>
      imports.review(
        overlap.id,
        item.id,
        { selected: true, transactionType: item.transactionType, linkedTransactionId: target.id },
        String(overlap.version),
      ),
    );
  }
  expect(overlap.items.every((i) => i.action === 'reconcile' && i.selected)).toBe(true);
  await run(() => imports.confirm(overlap.id, overlap.version, 'overlap-link'));
  expect(
    (await run(() => ledger.exportRecords())).filter((i) => i.accountId === a.id),
  ).toHaveLength(3);
});
it('separates benefit/reserve resources from available cash and filters planning actuals explicitly', async () => {
  const a = await account('Planning Alelo');
  const report = await run(() =>
    imports.upload(a.id, Buffer.from('planning-alelo'), 'alelo.pdf', parseAleloPages(sample())),
  );
  await run(() => imports.confirm(report.id, report.version, 'planning-alelo'));
  const dashboard = new DashboardService(accounts, ledger);
  const summary = await run(() => dashboard.summary('2026-09-01', '2026-11-01'));
  const all = await run(() => accounts.list());
  expect(summary.balance).toBe(
    all
      .filter((i) => !['benefit_food', 'benefit_meal', 'reserve'].includes(i.type))
      .reduce((s, i) => s + i.balance, 0),
  );
  expect(summary.benefitBalance).toBe(
    all.filter((i) => i.type.startsWith('benefit_')).reduce((s, i) => s + i.balance, 0),
  );
  const benefit = await run(() => ledger.planningActuals('2026-09-01', '2026-11-01', 'benefits'));
  const cash = await run(() => ledger.planningActuals('2026-09-01', '2026-11-01', 'cash'));
  expect(benefit.some((i) => i.type === 'expense')).toBe(true);
  expect(cash.some((i) => i.amount === 70000)).toBe(true);
});
it('exports benefit source facts without fake external IDs and keeps MP source keys backward compatible', async () => {
  const entries = await run(() => ledger.exportRecords());
  const a = entries.find((entry) =>
    entry.sourceEvidence?.some((source) => source.reportType === 'benefit_statement'),
  )!;
  const backup = {
    format: 'mywallet',
    version: 4,
    currency: 'BRL',
    exportedAt: new Date().toISOString(),
    accounts: await run(() => accounts.exportRecords()),
    categories: await run(() => categories.exportRecords()),
    categoryGroups: await run(() => categories.exportGroups()),
    monthlyPlans: [],
    transactions: entries,
  };
  expect(
    validateBackup(backup).transactions.find((i) => i.id === a.id)?.sourceOperationId,
  ).toBeNull();
  await db.forUser(db.other, async () => {
    const original = backup.accounts.find((account) => account.id === a.accountId)!;
    const restored = await accounts.restoreRecord(original);
    await ledger.restoreRecords(
      entries.filter((entry) => entry.accountId === a.accountId),
      new Map([[a.accountId, restored]]),
      new Map(),
    );
    const result = await imports.upload(
      restored,
      Buffer.from('restored-alelo'),
      'alelo.pdf',
      parseAleloPages(sample()),
    );
    expect(result.items.every((item) => item.action === 'review' && !item.selected)).toBe(true);
    expect((await accounts.find(restored)).balance).toBe(8000);
  });
  const source = {
    reportType: 'account_statement' as const,
    reference: 'mp-source',
    date: '2026-10-01',
    amount: 100,
    balance: 200,
    eventType: null,
    timestamp: null,
    installmentNumber: null,
  };
  const { createHash } = await import('node:crypto');
  expect(sourceEvidenceKey(source)).toBe(
    createHash('sha256')
      .update(
        JSON.stringify([
          'mercado_pago',
          'account_statement',
          'mp-source',
          '2026-10-01',
          100,
          200,
          null,
          null,
        ]),
      )
      .digest('hex'),
  );
});
