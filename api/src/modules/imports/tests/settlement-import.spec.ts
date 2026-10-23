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
const ledger = new LedgerService(new LedgerRepository(db.service), accounts, categories, receipts);
const imports = new ImportsService(
  new ImportsRepository(db.service),
  accounts,
  ledger,
  receipts,
  categories,
  ledger,
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
    expect(preview.canIntegrate).toBe(false);
    expect(preview.sourceFormat).toBe('csv');
    expect(preview.openingBalance).toBeNull();
    await expect(
      db.forUser(db.user, () => imports.classify(preview.id, preview.version)),
    ).rejects.toThrow('apenas para consulta');
    await expect(
      db.forUser(db.user, () => imports.confirm(preview.id, preview.version, 'settlement-attempt')),
    ).rejects.toThrow('não fornece saldos');
    await expect(
      db.forUser(db.user, () =>
        db.service.query("UPDATE wallet.import_batches SET status='confirmed' WHERE id=$1", [
          preview.id,
        ]),
      ),
    ).rejects.toThrow();
    const history = await db.forUser(db.user, () =>
      imports.retainHistory(preview.id, preview.version),
    );
    expect(history.items[0].metadata?.netAmount).toBe(9700);
    expect(history.status).toBe('history');
    await expect(
      db.forUser(db.user, () => imports.reopenHistory(preview.id, history.version)),
    ).rejects.toThrow('apenas para consulta');
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
  expect(result.canIntegrate).toBe(false);
  expect(result.openingBalance).toBeNull();
  expect(result.items[0]).toMatchObject({
    transactionType: 'unclassified',
    metadata: { netAmount: 9700 },
  });
  expect((await db.forUser(db.user, () => imports.get(result.id))).history_saved_at).not.toBeNull();
  expect(await db.forUser(db.user, () => ledger.exportRecords())).toEqual([]);
});
