import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
);
let account: string, batch: string;
beforeAll(async () => {
  await db.initialize();
  account = (
    await db.forUser(db.user, () =>
      accounts.create({
        name: 'MP',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 0,
        openingDate: '2026-10-23',
      }),
    )
  ).id;
});
afterAll(() => db.close());
describe('Older statements and consultation history', () => {
  it('opens an old statement for review without changing an empty account', async () => {
    const preview = await db.forUser(db.user, () =>
      imports.upload(account, Buffer.from('synthetic-history'), 'history.pdf', {
        openingBalance: 5000,
        closingBalance: 4000,
        items: [
          {
            sourceRow: 1,
            sourcePage: 1,
            transactionDate: '2026-01-05',
            description: 'Purchase',
            sourceOperationId: 'historical-op',
            amount: -1000,
            balanceAfter: 4000,
          },
        ],
      }),
    );
    batch = preview.id;
    expect(preview.openingDateMismatch).toBe(true);
    expect(preview.statementStartDate).toBe('2026-01-05');
    expect((await db.forUser(db.user, () => accounts.find(account))).balance).toBe(0);
    await expect(
      db.forUser(db.user, () => imports.confirm(batch, preview.version, 'early-confirm')),
    ).rejects.toThrow('posição inicial');
  });
  it('retains history without transactions and returns the same uploaded file', async () => {
    const history = await db.forUser(db.user, () => imports.retainHistory(batch, 1));
    expect(history.status).toBe('history');
    expect(history.items).toHaveLength(1);
    expect(await db.forUser(db.user, () => ledger.exportRecords())).toEqual([]);
    const repeated = await db.forUser(db.user, () =>
      imports.upload(account, Buffer.from('synthetic-history'), 'history.pdf', {
        openingBalance: 0,
        closingBalance: 0,
        items: [],
      }),
    );
    expect(repeated.id).toBe(batch);
    expect(repeated.status).toBe('history');
    await expect(
      db.forUser(db.user, () => imports.confirm(batch, history.version, 'history-confirm')),
    ).rejects.toThrow('revisão');
    await expect(db.forUser(db.other, () => imports.preview(batch))).rejects.toThrow(
      'não encontrada',
    );
  });
  it('reopens through explicit review and preserves saved history through expiry cleanup', async () => {
    const history = await db.forUser(db.user, () => imports.preview(batch));
    const draft = await db.forUser(db.user, () => imports.reopenHistory(batch, history.version));
    expect(draft.status).toBe('draft');
    expect(draft.version).toBe(history.version + 1);
    await db.engine.query(
      "UPDATE wallet.import_batches SET expires_at=now()-interval '2 days' WHERE id=$1",
      [batch],
    );
    await db.engine.exec(
      "DELETE FROM wallet.import_batches WHERE status='draft' AND history_saved_at IS NULL AND expires_at<now()",
    );
    expect((await db.forUser(db.user, () => imports.preview(batch))).items).toHaveLength(1);
    expect(
      (await db.forUser(db.user, () => imports.retainHistory(batch, draft.version))).status,
    ).toBe('history');
  });
  it('requires actual reconciliation before historical movements enter the account', async () => {
    const history = await db.forUser(db.user, () => imports.preview(batch));
    let draft = await db.forUser(db.user, () => imports.reopenHistory(batch, history.version));
    const current = await db.forUser(db.user, () => accounts.find(account));
    await db.forUser(db.user, () =>
      accounts.update(
        account,
        { ...current, openingDate: '2026-01-05', openingBalance: 5000 },
        String(current.version),
      ),
    );
    draft = await db.forUser(db.user, () => imports.classify(batch, draft.version));
    expect(draft.openingDateMismatch).toBe(false);
    expect(draft.openingMismatch).toBe(false);
    await db.forUser(db.user, () => imports.confirm(batch, draft.version, 'integrate-history'));
    expect((await db.forUser(db.user, () => accounts.find(account))).balance).toBe(4000);
    expect(
      await db.forUser(db.user, () => ledger.summary('2026-01-01', '2026-02-01')),
    ).toMatchObject({ expense: 1000 });
    await expect(
      db.forUser(db.user, () =>
        accounts.update(account, { ...current, openingDate: '2025-01-01' }, '2'),
      ),
    ).rejects.toThrow('reconciliação');
  });
});

describe('Overlapping account reports in different formats', () => {
  it('preserves format provenance and flags existing movements across PDF, CSV and XLSX', async () => {
    const accountId = (
      await db.forUser(db.user, () =>
        accounts.create({
          name: 'Formats',
          institution: 'mercado_pago',
          type: 'checking',
          openingBalance: 10000,
          openingDate: '2026-10-01',
        }),
      )
    ).id;
    const statement = {
      openingBalance: 10000,
      closingBalance: 10030,
      items: [
        {
          sourceRow: 1,
          sourcePage: 1,
          transactionDate: '2026-10-02',
          description: 'Rendimentos',
          sourceOperationId: 'shared-reference',
          amount: 10,
          balanceAfter: 10010,
        },
        {
          sourceRow: 2,
          sourcePage: 1,
          transactionDate: '2026-10-02',
          description: 'Rendimentos',
          sourceOperationId: 'shared-reference',
          amount: 20,
          balanceAfter: 10030,
        },
      ],
    };
    const pdf = await db.forUser(db.user, () =>
      imports.upload(accountId, Buffer.from('pdf'), 'synthetic.pdf', {
        ...statement,
        sourceFormat: 'pdf',
      }),
    );
    await db.forUser(db.user, () => imports.confirm(pdf.id, pdf.version, 'formats-pdf'));
    for (const format of ['csv', 'xlsx'] as const) {
      const preview = await db.forUser(db.user, () =>
        imports.upload(accountId, Buffer.from(format), `synthetic.${format}`, {
          ...statement,
          sourceFormat: format,
        }),
      );
      expect(preview.sourceFormat).toBe(format);
      expect(preview.items).toHaveLength(2);
      expect(preview.items.every((item) => item.duplicateCandidate && !item.selected)).toBe(true);
      const stored = await db.forUser(db.user, () => imports.get(preview.id));
      expect(stored.mapper_version).toBe(`mercado-pago/account-${format}/1`);
      const repeated = await db.forUser(db.user, () =>
        imports.upload(accountId, Buffer.from(format), `another-name.${format}`, {
          ...statement,
          sourceFormat: format,
        }),
      );
      expect(repeated.id).toBe(preview.id);
    }
    expect((await db.forUser(db.user, () => accounts.find(accountId))).balance).toBe(10030);
    expect(
      (await db.forUser(db.user, () => ledger.exportRecords())).filter(
        (t) => t.accountId === accountId,
      ),
    ).toHaveLength(2);
  });
});

it('automatically locks overlapping drafts after confirmation and preserves legitimate repeated references', async () => {
  const accountId = (
    await db.forUser(db.user, () =>
      accounts.create({
        name: 'Dedup account',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 10000,
        openingDate: '2026-10-23',
      }),
    )
  ).id;
  const firstRow = {
    sourceRow: 1,
    sourcePage: 1,
    transactionDate: '2026-10-23',
    description: 'Same purchase',
    sourceOperationId: 'repeated-ref',
    amount: -1000,
    balanceAfter: 9000,
  };
  const parsed = {
    openingBalance: 10000,
    closingBalance: 8000,
    items: [firstRow, { ...firstRow, sourceRow: 2, balanceAfter: 8000 }],
  };
  const first = await db.forUser(db.user, () =>
    imports.upload(accountId, Buffer.from('dedup-first'), 'first.pdf', parsed),
  );
  const second = await db.forUser(db.user, () =>
    imports.upload(accountId, Buffer.from('dedup-second'), 'second.csv', {
      ...parsed,
      sourceFormat: 'csv',
    }),
  );
  expect(first.items.every((i) => !i.duplicateLocked)).toBe(true);
  expect(second.items.every((i) => !i.duplicateLocked)).toBe(true);
  const classified = await db.forUser(db.user, () => imports.classify(first.id, first.version));
  await db.forUser(db.user, () =>
    imports.confirm(first.id, classified.version, 'dedup-first-confirm'),
  );
  expect(
    (await db.forUser(db.user, () => imports.preview(first.id))).items.every(
      (i) => !i.duplicateLocked,
    ),
  ).toBe(true);
  const refreshed = await db.forUser(db.user, () => imports.preview(second.id));
  expect(refreshed.items.every((i) => i.duplicateLocked && !i.selected)).toBe(true);
  await expect(
    db.forUser(db.user, () =>
      imports.review(
        second.id,
        refreshed.items[0].id,
        { selected: true, transactionType: 'expense' },
        String(refreshed.version),
      ),
    ),
  ).rejects.toThrow('duplicata');
  const receipt = await db.forUser(db.user, () =>
    imports.confirm(second.id, refreshed.version, 'dedup-second-confirm'),
  );
  expect(receipt).toMatchObject({ count: 0, skippedDuplicates: 2 });
  expect((await db.forUser(db.user, () => accounts.find(accountId))).balance).toBe(8000);
  const transactions = await db.forUser(db.user, () => ledger.list({ limit: 50, accountId }));
  expect(transactions.items).toHaveLength(2);
  const entry = transactions.items[0];
  await db.forUser(db.user, () =>
    ledger.update(
      entry.id,
      {
        accountId,
        amount: -1200,
        description: 'Corrected',
        transactionDate: '2026-10-24',
        transactionType: 'expense',
      },
      String(entry.version),
    ),
  );
  const afterEdit = await db.forUser(db.user, () =>
    imports.upload(accountId, Buffer.from('dedup-third'), 'third.pdf', parsed),
  );
  expect(afterEdit.items.every((i) => i.duplicateLocked)).toBe(true);
  await db.forUser(db.user, () => ledger.reverse(entry.id, String(entry.version + 1)));
  const afterReversal = await db.forUser(db.user, () => imports.preview(afterEdit.id));
  expect(afterReversal.items.filter((i) => i.duplicateLocked)).toHaveLength(1);
});
