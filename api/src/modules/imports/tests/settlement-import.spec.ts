import { CounterpartiesService } from '../../counterparties/services/counterparties.service.js';
import { CounterpartiesRepository } from '../../counterparties/repositories/counterparties.repository.js';
import { ImportReconciliationService } from '../services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../repositories/import-reconciliation.repository.js';
import { SettlementMatchingService } from '../services/settlement-matching.service.js';
import { SettlementEvidenceRepository } from '../repositories/settlement-evidence.repository.js';
import { ImportReprocessingService } from '../services/import-reprocessing.service.js';
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
import { extractMercadoPagoStatement } from '../parsers/mercado-pago/extract-statement.js';
import { parseSettlementTable } from '../parsers/mercado-pago/settlement.parser.js';
import { mapMercadoPagoSettlements } from '../mappers/mercado-pago/settlement.mapper.js';
import { mapMercadoPago } from '../mappers/mercado-pago/statement.mapper.js';
import { settlementFixture } from './settlement-fixture.js';
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
let accountId: string;
beforeAll(async () => {
  await db.initialize();
  accountId = (
    await db.forUser(db.user, () =>
      accounts.create({
        name: 'Settlement account',
        institution: 'mercado_pago',
        type: 'checking',
        openingBalance: 20000,
        openingDate: '2026-10-01',
      }),
    )
  ).id;
});
afterAll(() => db.close());
describe('Settlement v2 consultation report', () => {
  it('explains empty exports without mistaking valid headers for an unsupported layout', async () => {
    const { rows, buffer } = settlementFixture();
    const headerOnly = buffer.subarray(0, buffer.indexOf('\n') + 1);
    await expect(extractMercadoPagoStatement(headerOnly, 'settlement.csv')).rejects.toThrow(
      'sem transações para importar',
    );
    expect(() => parseSettlementTable([rows[0], rows[0].map(() => '')])).toThrow(
      'sem transações para importar',
    );
    expect(() => parseSettlementTable([['SOURCE_ID', 'SETTLEMENT_NET_AMOUNT']])).toThrow(
      'Cabeçalho settlement_v2 inválido',
    );
  });
  it('extracts net impact and payment metadata without inventing running balances or executing metadata', async () => {
    const statement = await extractMercadoPagoStatement(
      settlementFixture().buffer,
      'settlement.csv',
    );
    expect(statement.reportType).toBe('settlement');
    expect(statement.openingBalance).toBeNull();
    expect(statement.closingBalance).toBeNull();
    expect(statement.items[0]).toMatchObject({
      transactionDate: '2026-10-03',
      amount: 9700,
      balanceAfter: null,
      metadata: {
        grossAmount: 10000,
        netAmount: 9700,
        fees: -300,
        taxes: 0,
        brand: 'Visa',
        installments: 3,
        installmentNumber: 1,
        lastFourDigits: '0123',
        transactionTimestamp: '2026-10-02T23:50:00-04:00',
      },
    });
    expect(mapMercadoPago(statement)[0].transactionType).toBe('unclassified');
    expect(JSON.stringify(statement)).not.toContain('411111');
    expect(JSON.stringify(statement)).not.toContain('private data');
  });
  it('keeps negative/zero net effects and repeated IDs as source records with unknown optional fields', () => {
    const { rows } = settlementFixture({
      SETTLEMENT_NET_AMOUNT: '-97.00',
      FRANCHISE: '',
      INSTALLMENTS: '',
      INSTALLMENT_NUMBER: '',
    });
    const zero = [...rows[1]];
    zero[rows[0].indexOf('SETTLEMENT_NET_AMOUNT')] = '0.00';
    const mapped = mapMercadoPagoSettlements(parseSettlementTable([rows[0], rows[1], zero]));
    expect(mapped.items.map((row) => row.amount)).toEqual([-9700, 0]);
    expect(mapped.items[0].sourceOperationId).toBe(mapped.items[1].sourceOperationId);
    expect(mapped.items[0].metadata?.brand).toBeNull();
    expect(mapped.items[0].metadata?.installments).toBeNull();
  });
  it('rejects missing fields, inconsistent/invalid dates, currency and invalid installments', () => {
    const invalid: Record<string, string>[] = [
      { SETTLEMENT_DATE: '2026-02-31T10:00:00-04:00' },
      { SETTLEMENT_DATE: '2026-10-03T00:05:00' },
      { SETTLEMENT_DATE_SHORT: '2026-10-02' },
      { SETTLEMENT_CURRENCY: 'USD' },
      { INSTALLMENT_NUMBER: '4' },
      { LAST_FOUR_DIGITS: '123' },
      { SETTLEMENT_NET_AMOUNT: '1.234' },
      { IS_RELEASED: 'yes' },
      { MONEY_RELEASE_DATE: '2026-10-03T12:00:00' },
      { MONEY_RELEASE_DATE: '2026-10-03T12:00:00-04:00', MONEY_RELEASE_DATE_SHORT: '2026-10-04' },
      { INSTALLMENT_NET_AMOUNT: '1.234' },
    ];
    for (const patch of invalid)
      expect(() => parseSettlementTable(settlementFixture(patch).rows)).toThrow();
    expect(() =>
      parseSettlementTable([
        ['SOURCE_ID', 'SETTLEMENT_NET_AMOUNT'],
        ['id', '1.00'],
      ]),
    ).toThrow();
  });
  it('persists a consultation report and never changes ledger balance, including direct confirmation attempts', async () => {
    const fixture = settlementFixture();
    const parsed = await extractMercadoPagoStatement(fixture.buffer, 'settlement.csv');
    const preview = await db.forUser(db.user, () =>
      imports.upload(accountId, fixture.buffer, 'settlement.csv', parsed),
    );
    expect(preview.canIntegrate).toBe(true);
    expect(preview.sourceFormat).toBe('csv');
    expect(preview.openingBalance).toBeNull();
    expect(preview.items[0].action).toBe('review');
    expect(preview.items[0].selected).toBe(false);
    await expect(
      db.forUser(db.user, () =>
        imports.confirm(preview.id, preview.version, 'unavailable-receipt'),
      ),
    ).rejects.toThrow('Selecione');
    const history = await db.forUser(db.user, () =>
      imports.retainHistory(preview.id, preview.version),
    );
    expect(history.items[0].metadata?.netAmount).toBe(9700);
    expect(history.status).toBe('history');
    expect((await db.forUser(db.user, () => accounts.find(accountId))).balance).toBe(20000);
    expect(await db.forUser(db.user, () => ledger.exportRecords())).toEqual([]);
    await expect(db.forUser(db.other, () => imports.preview(preview.id))).rejects.toThrow(
      'não encontrada',
    );
  });
});

it('reprocesses retained settlement data while preserving consultation status and no-ledger semantics', async () => {
  const fixture = settlementFixture();
  const parsed = await extractMercadoPagoStatement(fixture.buffer, 'settlement.csv');
  const draft = await db.forUser(db.user, () =>
    imports.upload(
      accountId,
      Buffer.concat([fixture.buffer, Buffer.from('\n')]),
      'settlement.csv',
      parsed,
    ),
  );
  const history = await db.forUser(db.user, () => imports.retainHistory(draft.id, draft.version));
  const service = new ImportReprocessingService(
    new ImportsRepository(db.service),
    imports,
    accounts,
  );
  const result = await db.forUser(db.user, () =>
    service.reprocess(history.id, history.version, { resetClassification: true }),
  );
  expect(result.status).toBe('history');
  expect(result.canIntegrate).toBe(true);
  expect(result.openingBalance).toBeNull();
  expect(result.items[0]).toMatchObject({
    transactionType: 'income',
    metadata: { netAmount: 9700 },
  });
  expect((await db.forUser(db.user, () => imports.get(result.id))).history_saved_at).not.toBeNull();
  expect(await db.forUser(db.user, () => ledger.exportRecords())).toEqual([]);
});

const matching = new SettlementMatchingService(
  new ImportsRepository(db.service),
  new SettlementEvidenceRepository(db.service),
);
async function uploadEvidence(reference: string) {
  const fixture = settlementFixture({
    SOURCE_ID: reference,
    IS_RELEASED: 'false',
    MONEY_RELEASE_DATE: '2026-10-05T12:00:00-04:00',
    INSTALLMENT_NET_AMOUNT: '32.33',
  });
  const parsed = await extractMercadoPagoStatement(fixture.buffer, 'evidence.csv');
  return db.forUser(db.user, () =>
    imports.upload(accountId, fixture.buffer, 'evidence.csv', parsed),
  );
}
async function confirmCash(reference: string, targetAccountId = accountId) {
  return db.forUser(db.user, async () => {
    const account = await accounts.find(targetAccountId);
    const parsed = {
      reportType: 'account_statement' as const,
      openingBalance: account.balance,
      closingBalance: account.balance + 9700,
      items: [
        {
          sourceRow: 1,
          sourcePage: 1,
          sourceOperationId: reference,
          transactionDate: '2026-10-03',
          description: 'Synthetic cash movement',
          amount: 9700,
          balanceAfter: account.balance + 9700,
        },
      ],
    };
    const draft = await imports.upload(
      targetAccountId,
      Buffer.from(reference + targetAccountId),
      'cash.pdf',
      parsed,
    );
    await imports.confirm(draft.id, draft.version, reference + targetAccountId);
    return (await ledger.exportRecords()).find((row) => row.importBatchId === draft.id)!;
  });
}
it('enriches confirmed statement evidence only after history retention, preserves manual edits and removes reversed matches', async () => {
  const transaction = await confirmCash('enrichment-original');
  const report = await uploadEvidence('enrichment-original');
  const matches = await db.forUser(db.user, () => matching.preview(report.id));
  expect(matches[0]).toMatchObject({
    status: 'matched',
    transactionId: transaction.id,
    metadata: {
      isReleased: false,
      installmentNetAmount: 3233,
      releaseTimestamp: '2026-10-05T12:00:00-04:00',
    },
  });
  expect(await db.forUser(db.user, () => matching.transactionSources(transaction.id))).toEqual([]);
  const before = await db.forUser(db.user, () => accounts.find(accountId));
  await db.forUser(db.user, () => imports.retainHistory(report.id, report.version));
  expect(
    (await db.forUser(db.user, () => matching.transactionSources(transaction.id))).length,
  ).toBe(1);
  expect((await db.forUser(db.user, () => accounts.find(accountId))).balance).toBe(before.balance);
  const edited = await db.forUser(db.user, () =>
    ledger.update(
      transaction.id,
      { ...transaction, description: 'Manually reviewed', amount: 9600 },
      String(transaction.version),
    ),
  );
  expect(
    (await db.forUser(db.user, () => matching.transactionSources(transaction.id))).length,
  ).toBe(1);
  expect(await db.forUser(db.user, () => ledger.find(transaction.id))).toMatchObject({
    amount: 9600,
    description: 'Manually reviewed',
  });
  await expect(db.forUser(db.other, () => matching.preview(report.id))).rejects.toThrow(
    'não encontrada',
  );
  await expect(
    db.forUser(db.other, () => matching.transactionSources(transaction.id)),
  ).rejects.toThrow('não encontrado');
  const space = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Isolated evidence') RETURNING id",
    [db.user],
  );
  await expect(
    db.forUser(db.user, () => matching.preview(report.id), true, space.rows[0].id),
  ).rejects.toThrow('não encontrada');
  await expect(
    db.forUser(db.user, () => matching.transactionSources(transaction.id), true, space.rows[0].id),
  ).rejects.toThrow('não encontrado');

  await db.forUser(db.user, () => ledger.reverse(transaction.id, String(edited!.version)));
  expect((await db.forUser(db.user, () => matching.preview(report.id)))[0].status).toBe(
    'unmatched',
  );
});
it('finds retained settlement evidence when the account statement arrives later, without matching another account', async () => {
  const report = await uploadEvidence('settlement-first');
  await db.forUser(db.user, () => imports.retainHistory(report.id, report.version));
  expect((await db.forUser(db.user, () => matching.preview(report.id)))[0].status).toBe(
    'unmatched',
  );
  const otherAccount = await db.forUser(db.user, () =>
    accounts.create({
      name: 'Another account',
      institution: 'mercado_pago',
      type: 'checking',
      openingDate: '2026-10-01',
      openingBalance: 0,
    }),
  );
  const unrelated = await confirmCash('settlement-first', otherAccount.id);
  expect(await db.forUser(db.user, () => matching.transactionSources(unrelated.id))).toEqual([]);
  expect((await db.forUser(db.user, () => matching.preview(report.id)))[0].status).toBe(
    'unmatched',
  );
  const transaction = await confirmCash('settlement-first');
  expect(
    (await db.forUser(db.user, () => matching.transactionSources(transaction.id)))[0].transactionId,
  ).toBe(transaction.id);
});
