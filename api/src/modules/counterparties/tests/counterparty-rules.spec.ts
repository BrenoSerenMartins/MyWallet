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
import { ImportsService } from '../../imports/services/imports.service.js';
import { ImportsRepository } from '../../imports/repositories/imports.repository.js';
import { ImportReconciliationService } from '../../imports/services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../../imports/repositories/import-reconciliation.repository.js';
import { ImportReprocessingService } from '../../imports/services/import-reprocessing.service.js';
import { CounterpartiesRepository } from '../repositories/counterparties.repository.js';
import { CounterpartiesService } from '../services/counterparties.service.js';
import { parseSettlementTable } from '../../imports/parsers/mercado-pago/settlement.parser.js';
import { mapMercadoPagoSettlements } from '../../imports/mappers/mercado-pago/settlement.mapper.js';
import { settlementFixture } from '../../imports/tests/settlement-fixture.js';
import { DataExportService } from '../../data-export/services/data-export.service.js';
import { RestoreRepository } from '../../data-export/repositories/restore.repository.js';
import { PlanningService } from '../../planning/services/planning.service.js';
import { PlanningRepository } from '../../planning/repositories/planning.repository.js';
const db = new TestDatabase();
const accounts = new AccountsService(new AccountsRepository(db.service));
const categories = new CategoriesService(new CategoriesRepository(db.service));
const counterparties = new CounterpartiesService(
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
  counterparties,
);
const reprocessing = new ImportReprocessingService(
  new ImportsRepository(db.service),
  imports,
  accounts,
);
const backups = new DataExportService(
  accounts,
  categories,
  ledger,
  receipts,
  new RestoreRepository(db.service),
  new PlanningService(new PlanningRepository(db.service), categories, ledger),
  counterparties,
);
const run = <T>(fn: () => Promise<T>) => db.forUser(db.user, fn);
beforeAll(() => db.initialize());
afterAll(() => db.close());
async function account(name: string) {
  return run(() =>
    accounts.create({
      name,
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 0,
      openingDate: '2026-10-01',
    }),
  );
}
async function category(name: string) {
  return run(() => categories.save({ name, type: 'expense', color: '#ff8899' }));
}
const movement = (accountId: string, description = 'Supermercado ABC') => ({
  accountId,
  description,
  amount: -100,
  transactionDate: '2026-06-01',
  transactionType: 'expense' as const,
  categoryId: null,
});
async function statement(accountId: string, reference: string, description: string) {
  return run(() =>
    imports.upload(accountId, Buffer.from(reference), 'statement.pdf', {
      openingBalance: 0,
      closingBalance: -100,
      items: [
        {
          sourceRow: 1,
          sourcePage: 1,
          sourceOperationId: reference,
          description,
          amount: -100,
          balanceAfter: -100,
          transactionDate: '2026-06-01',
        },
      ],
    }),
  );
}
async function edi(
  accountId: string,
  reference: string,
  description: string,
  overrides: Record<string, string> = {},
) {
  const fixture = settlementFixture({
    SOURCE_ID: reference,
    DESCRIPTION: description,
    SETTLEMENT_NET_AMOUNT: '-1.00',
    TRANSACTION_DATE: '2026-06-01T12:00:00-03:00',
    TRANSACTION_DATE_SHORT: '2026-06-01',
    SETTLEMENT_DATE: '2026-06-01T12:00:00-03:00',
    SETTLEMENT_DATE_SHORT: '2026-06-01',
    ...overrides,
  });
  const parsed = mapMercadoPagoSettlements(parseSettlementTable(fixture.rows));
  return run(() => imports.upload(accountId, fixture.buffer, 'edi.csv', parsed));
}
it('learns only after an explicit choice and respects account, direction and manual overrides', async () => {
  const a = await account('Learn'),
    other = await account('Other'),
    market = await category('Mercado'),
    different = await category('Outra');
  const first = await run(() =>
    ledger.create({
      ...movement(a.id),
      categoryId: market.id,
      counterpartyName: 'ABC',
      rememberCategory: true,
    }),
  );
  expect(first.classificationRuleId).toBeTruthy();
  const next = await run(() => ledger.create(movement(a.id, '  SUPERMERCADO   ABC ')));
  expect(next).toMatchObject({ categoryId: market.id, counterpartyId: first.counterpartyId });
  expect(next.classificationRuleId).toBeTruthy();
  const explicit = await run(() => ledger.create({ ...movement(a.id), categoryId: different.id }));
  expect(explicit.categoryId).toBe(different.id);
  expect(explicit.classificationRuleId).toBeNull();
  expect((await run(() => ledger.create(movement(other.id)))).categoryId).toBeNull();
  expect(
    (await run(() => ledger.create({ ...movement(a.id), amount: 100, transactionType: 'income' })))
      .categoryId,
  ).toBeNull();
  expect(
    (await run(() => ledger.create(movement(a.id, 'Supermercado ABC filial')))).categoryId,
  ).toBeNull();
  expect((await run(() => ledger.find(first.id))).categoryId).toBe(market.id);
});
it('stores draft learning intent without effects and preserves it when reprocessing before confirmation', async () => {
  const a = await account('Draft intent'),
    market = await category('Draft category');
  let draft = await statement(a.id, 'draft-intent', 'Pix enviado Mercado Bom');
  draft = await run(() =>
    imports.review(
      draft.id,
      draft.items[0].id,
      {
        selected: true,
        transactionType: 'expense',
        categoryId: market.id,
        counterpartyName: 'Mercado Bom',
        rememberCategory: true,
      },
      String(draft.version),
    ),
  );
  expect((await run(() => counterparties.list())).some((a) => a.name === 'Mercado Bom')).toBe(
    false,
  );
  draft = await run(() => reprocessing.reprocess(draft.id, draft.version));
  expect(draft.items[0]).toMatchObject({ rememberCategory: true, counterpartyName: 'Mercado Bom' });
  await run(() => imports.confirm(draft.id, draft.version, 'draft-intent-confirm'));
  const next = await statement(a.id, 'draft-intent-next', 'Pix enviado Mercado Bom');
  expect(next.items[0]).toMatchObject({ categoryId: market.id });
  expect(next.items[0].classificationRuleId).toBeTruthy();
});
it('learns source-specific aliases only through proved statement/EDI links and skips generic event names', async () => {
  const a = await account('Sources'),
    market = await category('Sources category');
  let draft = await statement(a.id, 'proved-one', 'Pix enviado Loja Central');
  await run(() => imports.confirm(draft.id, draft.version, 'proved-statement'));
  const entry = (await run(() => ledger.exportRecords())).find((t) => t.accountId === a.id)!;
  await run(() =>
    ledger.update(
      entry.id,
      {
        ...entry,
        categoryId: market.id,
        counterpartyName: 'Loja Central',
        counterpartyId: null,
        rememberCategory: true,
      },
      String(entry.version),
    ),
  );
  const report = await edi(a.id, 'proved-one', 'LOJA CENTRAL COMERCIO');
  expect(report.items[0].action).toBe('reconcile');
  await run(() => imports.confirm(report.id, report.version, 'proved-edi'));
  const next = await edi(a.id, 'proved-two', 'LOJA CENTRAL COMERCIO');
  expect(next.items[0].categoryId).toBe(market.id);
  expect(next.items[0].action).toBe('review');
  const generic = await edi(a.id, 'proved-one', 'SETTLEMENT');
  await run(() => imports.confirm(generic.id, generic.version, 'proved-generic'));
  const agent = (await run(() => counterparties.list())).find((c) => c.name === 'Loja Central')!;
  expect(agent.identifiers.map((i) => i.sourceKind)).toContain('settlement');
  expect(agent.identifiers.some((i) => i.value === 'SETTLEMENT')).toBe(false);
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
});
it('disabling agents or rules stops future automation and category edits do not rewrite earlier entries', async () => {
  const a = await account('Disable'),
    market = await category('Disable category');
  const first = await run(() =>
    ledger.create({
      ...movement(a.id),
      categoryId: market.id,
      counterpartyName: 'Disable ABC',
      rememberCategory: true,
    }),
  );
  let agent = (await run(() => counterparties.list())).find((a) => a.id === first.counterpartyId)!;
  await run(() => counterparties.toggleRule(agent.rules[0].id, false, agent.rules[0].version));
  expect((await run(() => ledger.create(movement(a.id)))).categoryId).toBeNull();
  agent = (await run(() => counterparties.list())).find((a) => a.id === first.counterpartyId)!;
  await run(() => counterparties.toggleRule(agent.rules[0].id, true, agent.rules[0].version));
  await run(() => counterparties.update(agent.id, agent.name, false, agent.version));
  expect((await run(() => ledger.create(movement(a.id)))).counterpartyId).toBeNull();
  expect((await run(() => ledger.find(first.id))).categoryId).toBe(market.id);
});
it('rejects conflicting learned aliases, invalid categories and generic identifiers atomically', async () => {
  const a = await account('Conflict'),
    market = await category('Conflict category');
  await run(() =>
    ledger.create({
      ...movement(a.id),
      categoryId: market.id,
      counterpartyName: 'First ABC',
      rememberCategory: true,
    }),
  );
  const before = await run(() => accounts.find(a.id));
  await expect(
    run(() =>
      ledger.create({
        ...movement(a.id),
        categoryId: market.id,
        counterpartyName: 'Conflicting ABC',
        rememberCategory: true,
      }),
    ),
  ).rejects.toThrow('outro agente');
  await expect(
    run(() =>
      ledger.create({
        ...movement(a.id, 'Mercado Pago · SETTLEMENT'),
        categoryId: market.id,
        counterpartyName: 'Generic ABC',
        rememberCategory: true,
      }),
    ),
  ).rejects.toThrow('específica');
  expect((await run(() => accounts.find(a.id))).balance).toBe(before.balance);
  expect((await run(() => counterparties.list())).some((a) => a.name === 'Conflicting ABC')).toBe(
    false,
  );
});
it('isolates identifiers and rules by workspace and owner including direct foreign references', async () => {
  const state = await run(() => counterparties.snapshot());
  expect(await db.forUser(db.other, () => counterparties.list())).toEqual([]);
  await expect(db.forUser(db.other, () => counterparties.find(state.agents[0].id))).rejects.toThrow(
    'não encontrado',
  );
  const workspace = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Other rules') RETURNING id",
    [db.user],
  );
  expect(
    await db.forUser(db.user, () => counterparties.list(), false, workspace.rows[0].id),
  ).toEqual([]);
  await expect(
    db.forUser(db.other, () =>
      db.service.query(
        'INSERT INTO wallet.counterparty_identifiers(user_id,counterparty_id,account_id,source_kind,value,normalized_value) VALUES($1,$2,$3,$4,$5,$5)',
        [db.other, state.agents[0].id, state.identifiers[0].accountId, 'manual', 'forbidden'],
      ),
    ),
  ).rejects.toThrow();
});
it('applies one table relation retroactively, preserves manual categories and propagates subsequent rule changes', async () => {
  const a = await account('Retroactive'),
    other = await account('Retroactive other');
  const market = await category('Retro market'),
    replacement = await category('Retro replacement'),
    manual = await category('Retro manual');
  const old = await run(() => ledger.create(movement(a.id, '  LOJA   RETRO ')));
  const explicit = await run(() =>
    ledger.create({ ...movement(a.id, 'Loja Retro'), categoryId: manual.id }),
  );
  const elsewhere = await run(() => ledger.create(movement(other.id, 'Loja Retro')));
  const agent = await run(() => counterparties.create('Retro Agent'));
  const { CounterpartyRulesWorkflow } = await import('../services/counterparty-rules-workflow.js');
  const workflow = new CounterpartyRulesWorkflow(counterparties, accounts, ledger);
  const result = await run(() =>
    workflow.relate(agent.id, {
      accountId: a.id,
      sourceKind: 'manual',
      transactionType: 'expense',
      value: 'Loja Retro',
      categoryId: market.id,
    }),
  );
  expect(result.updated).toBe(1);
  expect(await run(() => ledger.find(old.id))).toMatchObject({
    categoryId: market.id,
    counterpartyId: agent.id,
    classificationRuleId: result.id,
    amount: -100,
  });
  expect((await run(() => ledger.find(explicit.id))).categoryId).toBe(manual.id);
  expect((await run(() => ledger.find(elsewhere.id))).categoryId).toBeNull();
  const rule = await run(() => counterparties.findRule(result.id));
  const changed = await run(() =>
    workflow.configure(rule.id, { enabled: true, categoryId: replacement.id }, rule.version),
  );
  expect(changed.updated).toBe(1);
  expect((await run(() => ledger.find(old.id))).categoryId).toBe(replacement.id);
  expect((await run(() => ledger.find(explicit.id))).categoryId).toBe(manual.id);
  expect((await run(() => accounts.find(a.id))).balance).toBe(-200);
  const repeated = await run(() =>
    workflow.relate(agent.id, {
      accountId: a.id,
      sourceKind: 'manual',
      transactionType: 'expense',
      value: 'Loja Retro',
      categoryId: replacement.id,
    }),
  );
  expect(repeated.updated).toBe(0);
});
it('keeps removed aliases disabled when the same proved source is observed again', async () => {
  const a = await account('Removed alias'),
    market = await category('Removed alias category');
  const first = await run(() =>
    ledger.create({
      ...movement(a.id, 'Loja Removida'),
      categoryId: market.id,
      counterpartyName: 'Removed Agent',
      rememberCategory: true,
    }),
  );
  const agent = (await run(() => counterparties.list())).find(
    (a) => a.id === first.counterpartyId,
  )!;
  await run(() => counterparties.removeIdentifier(agent.id, agent.identifiers[0].id));
  await run(() => counterparties.observe(agent.id, a.id, 'manual', 'Loja Removida'));
  expect((await run(() => ledger.create(movement(a.id, 'Loja Removida')))).categoryId).toBeNull();
  expect(
    (await run(() => counterparties.list())).find((a) => a.id === agent.id)!.identifiers[0].enabled,
  ).toBe(false);
});

it('relates a merchant ID once for past and future EDI operations without using the operation ID as agent identity', async () => {
  const a = await account('Store IDs'),
    market = await category('Store category');
  const old = await edi(a.id, 'store-old-operation', '', { STORE_ID: 'STORE-001' });
  await run(() => imports.confirm(old.id, old.version, 'store-id-old-confirm'));
  const agent = await run(() => counterparties.create('Store ID Agent'));
  const { CounterpartyRulesWorkflow } = await import('../services/counterparty-rules-workflow.js');
  const workflow = new CounterpartyRulesWorkflow(counterparties, accounts, ledger);
  const result = await run(() =>
    workflow.relate(agent.id, {
      accountId: a.id,
      sourceKind: 'settlement',
      identifierKind: 'store_id',
      value: 'STORE-001',
      transactionType: 'expense',
      categoryId: market.id,
    }),
  );
  expect(result.updated).toBe(1);
  const next = await edi(a.id, 'store-new-operation', '', { STORE_ID: 'STORE-001' });
  expect(next.items[0]).toMatchObject({ counterpartyId: agent.id, categoryId: market.id });
  const different = await edi(a.id, 'store-other-operation', '', { STORE_ID: 'STORE-002' });
  expect(different.items[0].counterpartyId).toBeNull();
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
});
it('learns an EDI store ID from a proved statement match so generic future EDI rows can use the same agent', async () => {
  const a = await account('Store proof'),
    market = await category('Store proof category');
  let first = await statement(a.id, 'store-proved', 'Pix enviado Mercado Identificado');
  first = await run(() =>
    imports.review(
      first.id,
      first.items[0].id,
      {
        selected: true,
        transactionType: 'expense',
        categoryId: market.id,
        counterpartyName: 'Identified Store',
        rememberCategory: true,
      },
      String(first.version),
    ),
  );
  await run(() => imports.confirm(first.id, first.version, 'store-proof-statement'));
  const proof = await edi(a.id, 'store-proved', '', { STORE_ID: 'PROVED-STORE' });
  expect(proof.items[0].action).toBe('reconcile');
  await run(() => imports.confirm(proof.id, proof.version, 'store-proof-edi'));
  const next = await edi(a.id, 'another-proved-payment', '', { STORE_ID: 'PROVED-STORE' });
  expect(next.items[0].categoryId).toBe(market.id);
  const agent = (await run(() => counterparties.list())).find(
    (c) => c.name === 'Identified Store',
  )!;
  expect(
    agent.identifiers.some((i) => i.identifierKind === 'store_id' && i.value === 'PROVED-STORE'),
  ).toBe(true);
});

it('backs up and restores agents, aliases, rules and transaction provenance without relearning', async () => {
  const backup = await run(() => backups.backup());
  expect(backup.version).toBe(5);
  expect(backup.counterparties!.rules.length).toBeGreaterThan(0);
  const bad = structuredClone(backup);
  bad.counterparties!.rules[0].accountId = '00000000-0000-4000-8000-000000000001';
  await expect(run(() => backups.preview(bad))).rejects.toThrow('agentes');
  const workspace = await db.engine.query<{ id: string }>(
    "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Restored rules') RETURNING id",
    [db.user],
  );
  await db.forUser(
    db.user,
    async () => {
      const draft = await backups.preview(backup);
      await backups.confirm(draft.id);
      const restored = await counterparties.snapshot();
      expect(restored.agents).toHaveLength(backup.counterparties!.agents.length);
      expect(restored.rules).toHaveLength(backup.counterparties!.rules.length);
      expect(restored.agents[0].id).not.toBe(backup.counterparties!.agents[0].id);
      const entries = await ledger.exportRecords();
      const original = backup.transactions.find((t) => t.classificationRuleId)!;
      const copy = entries.find(
        (t) =>
          t.description === original.description &&
          t.amount === original.amount &&
          t.classificationRuleId,
      )!;
      expect(copy.counterpartyId).not.toBe(original.counterpartyId);
      expect(restored.rules.some((r) => r.id === copy.classificationRuleId)).toBe(true);
    },
    false,
    workspace.rows[0].id,
  );
});

it('learns a store identifier when EDI arrives first and a later statement supplies the known agent name', async () => {
  const a = await account('EDI first store'),
    market = await category('EDI first category');
  const agent = await run(() => counterparties.create('EDI First Agent'));
  const { CounterpartyRulesWorkflow } = await import('../services/counterparty-rules-workflow.js');
  const workflow = new CounterpartyRulesWorkflow(counterparties, accounts, ledger);
  await run(() =>
    workflow.relate(agent.id, {
      accountId: a.id,
      sourceKind: 'account_statement',
      value: 'Pix enviado EDI First Agent',
      categoryId: market.id,
      transactionType: 'expense',
    }),
  );
  const report = await edi(a.id, 'edi-first-store', '', { STORE_ID: 'EDI-FIRST-ID' });
  await run(() => imports.confirm(report.id, report.version, 'edi-first-store-confirm'));
  const saved = (await run(() => ledger.exportRecords())).find((t) => t.accountId === a.id)!;
  const sparse = { ...saved.sourceEvidence[0] };
  delete sparse.storeId;
  await run(() => ledger.recordEvidence(saved.id, a.id, sparse));
  const bank = await statement(a.id, 'edi-first-store', 'Pix enviado EDI First Agent');
  await run(() => imports.confirm(bank.id, bank.version, 'edi-first-bank-confirm'));
  const next = await edi(a.id, 'edi-first-another', '', { STORE_ID: 'EDI-FIRST-ID' });
  expect(next.items[0].counterpartyId).toBe(agent.id);
  expect(next.items[0].categoryId).toBe(market.id);
  expect(
    (await run(() => ledger.exportRecords())).filter((t) => t.accountId === a.id),
  ).toHaveLength(1);
});
