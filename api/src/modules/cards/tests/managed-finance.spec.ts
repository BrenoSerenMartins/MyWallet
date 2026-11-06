import { ImportsService } from '../../imports/services/imports.service.js';
import { ImportsRepository } from '../../imports/repositories/imports.repository.js';
import { ImportReconciliationService } from '../../imports/services/import-reconciliation.service.js';
import { ImportReconciliationRepository } from '../../imports/repositories/import-reconciliation.repository.js';
import { CardsService } from '../services/cards.service.js';
import { CardsRepository } from '../repositories/cards.repository.js';
import { WealthService } from '../../wealth/services/wealth.service.js';
import { WealthRepository } from '../../wealth/repositories/wealth.repository.js';
import { firstBillMonth, billCalendar, splitInstallments } from '../services/card-calendar.js';
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
import { CommitmentsService } from '../../planning/services/commitments.service.js';
import { CommitmentsRepository } from '../../planning/repositories/commitments.repository.js';
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
const cards = new CardsService(
  new CardsRepository(db.service),
  accounts,
  categories,
  accounts,
  ledger,
  receipts,
);
const wealth = new WealthService(
  new WealthRepository(db.service),
  accounts,
  accounts,
  ledger,
  receipts,
  basis,
);
const commitments = new CommitmentsService(
  new CommitmentsRepository(db.service),
  accounts,
  categories,
  ledger,
  ledger,
  receipts,
  cards,
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
  cards,
  wealth,
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
    accounts.create({ name, institution, type, openingBalance: 100000, openingDate: '2026-01-01' }),
  );
const makeCard = async (name: string) => {
  const bank = await account(name + ' bank');
  const card = await run(() =>
    cards.create(
      { name, paymentAccountId: bank.id, closingDay: 10, dueDay: 20, limit: 200000 },
      randomUUID(),
    ),
  );
  return { bank, card };
};
const currentCard = async (id: string) =>
  (await run(() => cards.summary())).cards.find((c) => c.id === id)!;
const purchase = (
  cardId: string,
  version: number,
  amount = 10000,
  installments = 3,
  categoryId?: string,
) =>
  run(() =>
    cards.purchase(
      cardId,
      {
        description: 'Compra de teste',
        purchaseDate: '2026-11-05',
        amount,
        installments,
        categoryId,
      },
      String(version),
      randomUUID(),
    ),
  );
const makeHolding = async (name: string, capital = 80000, marketValue = 90000) =>
  run(() =>
    wealth.create(
      {
        name,
        provider: 'Custódia manual',
        productType: 'fixed_income',
        capital,
        marketValue,
        valuationDate: '2026-11-01',
      },
      randomUUID(),
    ),
  );
const holding = async (id: string) =>
  (await run(() => wealth.summary())).holdings.find((h) => h.id === id)!;

it('assigns card cycles across closing days, year boundaries and short months without losing cents', () => {
  expect(firstBillMonth('2026-11-09', 10, 20)).toBe('2026-11');
  expect(firstBillMonth('2026-11-10', 10, 20)).toBe('2026-12');
  expect(firstBillMonth('2026-12-25', 25, 1)).toBe('2027-02');
  expect(billCalendar('2027-03', 31, 10)).toEqual({
    closingDate: '2027-02-28',
    dueDate: '2027-03-10',
  });
  expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  expect(() => splitInstallments(2, 3)).toThrow();
});
it('posts installments once and keeps credit debt out of cash while planning counts only each bill month', async () => {
  const { card, bank } = await makeCard('Installments');
  const cat = await run(() =>
    categories.save({ name: 'Unique card expense', type: 'expense', color: '#f28a97' }),
  );
  const key = randomUUID();
  const payload = {
    description: 'Parcelada',
    purchaseDate: '2026-11-05',
    amount: 10000,
    installments: 3,
    categoryId: cat.id,
  };
  const p = await run(() => cards.purchase(card.id, payload, '1', key));
  expect(await run(() => cards.purchase(card.id, payload, '1', key))).toEqual(p);
  const c = await currentCard(card.id);
  expect(c).toMatchObject({ debt: 10000, availableLimit: 190000 });
  expect(c.bills.map((b) => b.total)).toEqual([3334, 3333, 3333]);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(100000);
  const plan = await run(() =>
    new PlanningService(
      new PlanningRepository(db.service),
      categories,
      ledger,
      accounts,
      cards,
    ).summary('2026-11'),
  );
  expect(plan.lines.find((l) => l.categoryId === cat.id)?.actual).toBe(0);
  expect(
    plan.cardBills?.find((b) => b.cardId === card.id && b.billMonth === '2026-11'),
  ).toMatchObject({ planned: 3334, paid: 0, included: true });
  const projection = await run(() => commitments.summary('2026-11'));
  expect(projection.projection.find((a) => a.accountId === bank.id)).toMatchObject({
    expense: 3334,
    projected: 96666,
  });
  expect(projection.projection.some((a) => a.accountId === card.accountId)).toBe(false);
});
it('supports partial/full payments without counting the bill a second time and rejects overpayment', async () => {
  const { card, bank } = await makeCard('Payments');
  await purchase(card.id, 1, 10000, 1);
  let c = await currentCard(card.id);
  const before = await run(() => ledger.summary('2026-11-01', '2026-12-01'));
  const payload = { mode: 'create' as const, accountId: bank.id, date: '2026-11-15', amount: 2500 };
  const key = randomUUID();
  const payment = await run(() => cards.pay(card.id, '2026-11', payload, String(c.version), key));
  await run(() => cards.pay(card.id, '2026-11', payload, String(c.version), key));
  c = await currentCard(card.id);
  expect(c.bills[0]).toMatchObject({ paid: 2500, remaining: 7500 });
  expect((await run(() => accounts.find(bank.id))).balance).toBe(97500);
  expect((await run(() => ledger.summary('2026-11-01', '2026-12-01'))).expense).toBe(
    before.expense,
  );
  await expect(
    run(() =>
      cards.pay(card.id, '2026-11', { ...payload, amount: 7501 }, String(c.version), randomUUID()),
    ),
  ).rejects.toThrow('valor pendente');
  await run(() =>
    cards.pay(card.id, '2026-11', { ...payload, amount: 7500 }, String(c.version), randomUUID()),
  );
  expect((await currentCard(card.id)).debt).toBe(0);
  c = await currentCard(card.id);
  await run(() => cards.undoPayment(card.id, payment.id, String(c.version), randomUUID()));
  expect((await run(() => accounts.find(bank.id))).balance).toBe(92500);
  expect((await currentCard(card.id)).debt).toBe(2500);
});
it('links an imported debit while preserving its fact and supports correcting the assignment', async () => {
  const { card, bank } = await makeCard('Link bank debit');
  await purchase(card.id, 1, 5000, 1);
  const entry = await run(() =>
    ledger.create({
      accountId: bank.id,
      description: 'Pagamento já importado',
      amount: -5000,
      transactionDate: '2026-11-12',
      transactionType: 'expense',
    }),
  );
  let c = await currentCard(card.id);
  const bankBefore = (await run(() => accounts.find(bank.id))).balance;
  const payment = await run(() =>
    cards.pay(
      card.id,
      '2026-11',
      {
        mode: 'link',
        accountId: bank.id,
        date: '2026-11-12',
        amount: 5000,
        transactionId: entry.id,
        transactionVersion: 1,
      },
      String(c.version),
      randomUUID(),
    ),
  );
  expect((await run(() => accounts.find(bank.id))).balance).toBe(bankBefore);
  expect(await run(() => ledger.find(entry.id))).toMatchObject({
    transactionType: 'transfer',
    managedKind: 'card',
  });
  c = await currentCard(card.id);
  await run(() => cards.undoPayment(card.id, payment.id, String(c.version), randomUUID()));
  expect(await run(() => ledger.find(entry.id))).toMatchObject({
    amount: -5000,
    transactionType: 'expense',
    managedKind: null,
    transferGroupId: null,
  });
  expect((await run(() => accounts.find(bank.id))).balance).toBe(bankBefore);
  c = await currentCard(card.id);
  const t = await run(() => ledger.find(entry.id));
  await run(() =>
    cards.pay(
      card.id,
      '2026-11',
      {
        mode: 'link',
        accountId: bank.id,
        date: '2026-11-12',
        amount: 5000,
        transactionId: entry.id,
        transactionVersion: t.version,
      },
      String(c.version),
      randomUUID(),
    ),
  );
  expect((await currentCard(card.id)).debt).toBe(0);
});
it('prevents public edits, direct managed postings and conflicting commitment claims', async () => {
  const { card, bank } = await makeCard('Protected');
  await purchase(card.id, 1, 6000, 1);
  const entry = (await run(() => ledger.exportRecords())).find(
    (t) => t.accountId === card.accountId,
  )!;
  await expect(
    run(() =>
      ledger.create({
        accountId: card.accountId,
        description: 'Bypass',
        amount: -100,
        transactionDate: '2026-11-15',
        transactionType: 'expense',
      }),
    ),
  ).rejects.toThrow('módulo');
  await expect(run(() => ledger.reverse(entry.id, String(entry.version)))).rejects.toThrow(
    'módulo',
  );
  const debit = await run(() =>
    ledger.create({
      accountId: bank.id,
      description: 'Claimed',
      amount: -6000,
      transactionDate: '2026-11-10',
      transactionType: 'expense',
    }),
  );
  const obligation = await run(() =>
    commitments.create(
      {
        accountId: bank.id,
        description: 'Same bill',
        amount: 6000,
        transactionType: 'expense',
        frequency: 'once',
        startDate: '2026-11-10',
      },
      randomUUID(),
    ),
  );
  await run(() =>
    commitments.resolve(
      obligation.id,
      '2026-11-10',
      { action: 'link', transactionId: debit.id, transactionVersion: 1 },
      '1',
      randomUUID(),
    ),
  );
  const c = await currentCard(card.id);
  await expect(
    run(() =>
      cards.pay(
        card.id,
        '2026-11',
        {
          mode: 'link',
          accountId: bank.id,
          date: '2026-11-10',
          amount: 6000,
          transactionId: debit.id,
          transactionVersion: 1,
        },
        String(c.version),
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('vinculado');
});
it('preserves established bill dates when settings change and cancels only unpaid purchases', async () => {
  const { card } = await makeCard('Settings');
  const p = await purchase(card.id, 1, 3000, 1);
  let c = await currentCard(card.id);
  await run(() =>
    cards.update(
      card.id,
      {
        name: card.name,
        paymentAccountId: card.paymentAccountId,
        closingDay: 12,
        dueDay: 25,
        limit: card.limit,
      },
      String(c.version),
    ),
  );
  c = await currentCard(card.id);
  expect(c.bills[0].dueDate).toBe('2026-11-20');
  await run(() => cards.cancelPurchase(card.id, p.id, String(c.version), randomUUID()));
  expect((await currentCard(card.id)).debt).toBe(0);
});
it('records prior debt without manufacturing spending and carries refunds as credit into later bills', async () => {
  const { card, bank } = await makeCard('Refunds');
  const initialSummary = await run(() => ledger.summary('2026-11-01', '2026-12-01'));
  await run(() => cards.opening(card.id, '2026-10', 1000, '1', randomUUID()));
  expect((await run(() => ledger.summary('2026-11-01', '2026-12-01'))).expense).toBe(
    initialSummary.expense,
  );
  let c = await currentCard(card.id);
  await purchase(card.id, c.version, 10000, 1);
  c = await currentCard(card.id);
  await run(() =>
    cards.pay(
      card.id,
      '2026-11',
      { mode: 'create', accountId: bank.id, date: '2026-11-15', amount: 10000 },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await currentCard(card.id);
  const original = c.bills.find((b) => b.month === '2026-11')!.entries[0];
  await run(() =>
    cards.refund(
      card.id,
      { entryId: original.id, billMonth: '2026-11', amount: 10000 },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await currentCard(card.id);
  await run(() =>
    cards.purchase(
      card.id,
      { description: 'Next bill', purchaseDate: '2026-11-15', amount: 5000, installments: 1 },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await currentCard(card.id);
  expect(c.bills.find((b) => b.month === '2026-12')!.remaining).toBe(0);
  expect(c.credit).toBe(4000);
});
it('opens existing investments without charging cash and keeps transfers, valuation and realized profit separate', async () => {
  const bank = await account('Portfolio bank');
  const h = await makeHolding('CDB');
  const start = await run(() => wealth.summary());
  const key = randomUUID();
  const input = {
    kind: 'contribution' as const,
    date: '2026-11-15',
    amount: 10000,
    accountId: bank.id,
  };
  await run(() => wealth.operate(h.id, input, '1', key));
  await run(() => wealth.operate(h.id, input, '1', key));
  let current = await holding(h.id);
  expect(current).toMatchObject({
    capital: 90000,
    marketValue: 100000,
    valuationMethod: 'flow_estimate',
  });
  expect((await run(() => wealth.summary())).netWorth).toBe(start.netWorth);
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'valuation', date: '2026-11-15', marketValue: 120000 },
      String(current.version),
      randomUUID(),
    ),
  );
  current = await holding(h.id);
  expect(current.unrealized).toBe(30000);
  await run(() =>
    wealth.operate(
      h.id,
      {
        kind: 'redemption',
        date: '2026-11-15',
        amount: 50000,
        capitalRemoved: 40000,
        marketValue: 70000,
        accountId: bank.id,
      },
      String(current.version),
      randomUUID(),
    ),
  );
  current = await holding(h.id);
  expect(current).toMatchObject({
    capital: 50000,
    marketValue: 70000,
    realized: 10000,
    unrealized: 20000,
    totalResult: 30000,
  });
  expect((await run(() => accounts.find(bank.id))).balance).toBe(140000);
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(50000);
  const prior = await run(() => wealth.summary());
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'income', date: '2026-11-15', amount: 5000, accountId: bank.id },
      String(current.version),
      randomUUID(),
    ),
  );
  expect((await run(() => wealth.summary())).netWorth).toBe(prior.netWorth + 5000);
});
it('undoes investment events in order and preserves existing bank facts when unlinking', async () => {
  const bank = await account('Undo portfolio');
  const h = await makeHolding('Fund', 10000, 10000);
  const initial = await run(() => wealth.summary());
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'contribution', date: '2026-11-15', amount: 1000, accountId: bank.id },
      '1',
      randomUUID(),
    ),
  );
  let c = await holding(h.id);
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'valuation', date: '2026-11-15', marketValue: 12000 },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await holding(h.id);
  await run(() => wealth.undo(h.id, String(c.version), randomUUID()));
  c = await holding(h.id);
  expect(c.marketValue).toBe(11000);
  await run(() => wealth.undo(h.id, String(c.version), randomUUID()));
  expect((await holding(h.id)).capital).toBe(10000);
  expect((await run(() => wealth.summary())).netWorth).toBe(initial.netWorth);
  const income = await run(() =>
    ledger.create({
      accountId: bank.id,
      amount: 500,
      description: 'Income imported',
      transactionDate: '2026-11-15',
      transactionType: 'income',
    }),
  );
  c = await holding(h.id);
  await run(() =>
    wealth.operate(
      h.id,
      {
        kind: 'income',
        date: '2026-11-15',
        amount: 500,
        accountId: bank.id,
        transactionId: income.id,
        transactionVersion: 1,
      },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await holding(h.id);
  await run(() => wealth.undo(h.id, String(c.version), randomUUID()));
  expect(await run(() => ledger.find(income.id))).toMatchObject({
    amount: 500,
    transactionType: 'income',
    managedKind: null,
  });
});
it('links redemption receipts and records only their gain as income', async () => {
  const bank = await account('Redemption linked');
  const h = await makeHolding('ETF', 10000, 12000);
  const receipt = await run(() =>
    ledger.create({
      accountId: bank.id,
      amount: 6000,
      description: 'Resgate importado',
      transactionDate: '2026-11-15',
      transactionType: 'income',
    }),
  );
  await run(() =>
    wealth.operate(
      h.id,
      {
        kind: 'redemption',
        date: '2026-11-15',
        amount: 6000,
        capitalRemoved: 5000,
        marketValue: 6000,
        accountId: bank.id,
        transactionId: receipt.id,
        transactionVersion: 1,
      },
      '1',
      randomUUID(),
    ),
  );
  expect(await run(() => ledger.find(receipt.id))).toMatchObject({
    transactionType: 'transfer',
    amount: 6000,
  });
  expect((await holding(h.id)).realized).toBe(1000);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(106000);
});
it('corrects invested capital without inventing income or moving bank money', async () => {
  const h = await makeHolding('Capital correction', 10000, 12000);
  const prior = await run(() => ledger.summary('2026-11-01', '2026-12-01'));
  await run(() =>
    wealth.operate(
      h.id,
      {
        kind: 'capital',
        date: '2026-11-15',
        capital: 8000,
        reason: 'Capital inicial informado incorretamente',
      },
      '1',
      randomUUID(),
    ),
  );
  expect((await holding(h.id)).unrealized).toBe(4000);
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(8000);
  expect(await run(() => ledger.summary('2026-11-01', '2026-12-01'))).toEqual(prior);
  const c = await holding(h.id);
  await run(() => wealth.undo(h.id, String(c.version), randomUUID()));
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(10000);
});
it('consolidates assets and debt once, excludes benefits, and saves reproducible net-worth snapshots', async () => {
  const prior = await run(() => wealth.summary());
  await account('Alelo excluded', 'alelo', 'benefit_food');
  expect((await run(() => wealth.summary())).netWorth).toBe(prior.netWorth);
  const home = await run(() =>
    wealth.saveItem(
      {
        name: 'Moto',
        kind: 'asset',
        value: 200000,
        valuationDate: '2026-11-15',
        notes: 'Valor estimado',
      },
      undefined,
      undefined,
      randomUUID(),
    ),
  );
  await run(() =>
    wealth.saveItem(
      {
        name: 'Saldo de financiamento',
        kind: 'debt',
        value: 50000,
        valuationDate: '2026-11-15',
        notes: '',
      },
      undefined,
      undefined,
      randomUUID(),
    ),
  );
  const s = await run(() => wealth.summary());
  expect(s.netWorth).toBe(prior.netWorth + 150000);
  const key = randomUUID();
  const snap = await run(() => wealth.capture(key));
  expect(await run(() => wealth.capture(key))).toEqual(snap);
  expect(snap.data.netWorth).toBe(s.netWorth);
  await run(() =>
    wealth.saveItem({ ...home, archived: true }, home.id, String(home.version), randomUUID()),
  );
});
it('round-trips cards, positions, liabilities, claims and historical undo pointers in v11 without duplicating money', async () => {
  const source = await run(() => backup.backup());
  expect(source.version).toBe(13);
  const financialState = async () => {
    const worth = await wealth.summary();
    const cardsState = await cards.summary('2026-11');
    const pending = await commitments.summary('2026-11');
    const plan = await new PlanningService(
      new PlanningRepository(db.service),
      categories,
      ledger,
      accounts,
    ).summary('2026-11');
    return {
      accounts: (await accounts.list())
        .map((a) => ({ name: a.name, balance: a.balance }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      cards: cardsState.cards
        .map((c) => ({
          name: c.name,
          debt: c.debt,
          credit: c.credit,
          availableLimit: c.availableLimit,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      worth: { assets: worth.assets, liabilities: worth.liabilities, netWorth: worth.netWorth },
      forecast: pending.projection
        .map((a) => ({
          name: a.name,
          balance: a.balance,
          income: a.income,
          expense: a.expense,
          projected: a.projected,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      planning: plan.totals,
    };
  };
  const expected = await run(financialState);
  await db.forUser(db.other, async () => {
    const draft = await backup.preview(source);
    await backup.confirm(draft.id);
    const restored = await backup.backup();
    expect(restored.cards!.cards.length).toBe(source.cards!.cards.length);
    expect(restored.wealth!.holdings.length).toBe(source.wealth!.holdings.length);
    expect(await financialState()).toEqual(expected);
    const repeated = await backup.preview(source);
    await backup.confirm(repeated.id);
    expect(await financialState()).toEqual(expected);
    expect((await backup.backup()).transactions).toHaveLength(source.transactions.length);
    expect(
      restored.accounts.every(
        (account) => !source.accounts.some((original) => original.id === account.id),
      ),
    ).toBe(true);
  });
});

it('keeps managed capital corrections scalar and requires chronological position changes', async () => {
  const bank = await account('After capital correction');
  const h = await makeHolding('Book correction', 10000, 12000);
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'capital', date: '2026-11-15', capital: 8000, reason: 'Capital corrigido' },
      '1',
      randomUUID(),
    ),
  );
  let c = await holding(h.id);
  await expect(
    run(() =>
      wealth.operate(
        h.id,
        { kind: 'contribution', date: '2026-11-14', amount: 1000, accountId: bank.id },
        String(c.version),
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('última avaliação');
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'contribution', date: '2026-11-15', amount: 1000, accountId: bank.id },
      String(c.version),
      randomUUID(),
    ),
  );
  c = await holding(h.id);
  expect(c.capital).toBe(9000);
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(9000);
  const payload = await run(() => backup.backup());
  await expect(run(() => backup.preview(payload))).resolves.toHaveProperty('id');
});
it('isolates managed modules across owners/spaces and cascades the new records through workspace trash', async () => {
  const original = (await run(() => cards.summary())).cards[0];
  await expect(
    db.forUser(db.other, () =>
      cards.update(
        original.id,
        {
          name: 'Foreign',
          paymentAccountId: original.paymentAccountId,
          closingDay: 1,
          dueDay: 10,
          limit: 100,
        },
        String(original.version),
      ),
    ),
  ).rejects.toThrow('não encontrado');
  const space = (
    await db.engine.query<{ id: string }>(
      "INSERT INTO wallet.workspaces(user_id,name) VALUES($1,'Managed isolated') RETURNING id",
      [db.user],
    )
  ).rows[0].id;
  await db.forUser(
    db.user,
    async () => {
      expect((await cards.summary()).cards).toHaveLength(0);
      const bank = await accounts.create({
        name: 'Managed bank',
        institution: 'mercado_pago',
        type: 'checking',
      });
      const c = await cards.create(
        {
          name: 'Disposable card',
          paymentAccountId: bank.id,
          closingDay: 10,
          dueDay: 20,
          limit: 10000,
        },
        randomUUID(),
      );
      await cards.purchase(
        c.id,
        { description: 'Scoped', purchaseDate: '2026-11-01', amount: 1000, installments: 2 },
        '1',
        randomUUID(),
      );
      const h = await wealth.create(
        {
          name: 'Disposable holding',
          provider: '',
          productType: 'other',
          capital: 0,
          marketValue: 0,
          valuationDate: '2026-11-01',
        },
        randomUUID(),
      );
      await wealth.operate(
        h.id,
        { kind: 'contribution', date: '2026-11-15', amount: 1000, accountId: bank.id },
        '1',
        randomUUID(),
      );
    },
    false,
    space,
  );
  await db.engine.query(
    "UPDATE wallet.workspaces SET deleted_at=clock_timestamp()-interval '8 days' WHERE id=$1",
    [space],
  );
  await db.engine.query('SELECT wallet.purge_expired_workspaces($1)', [db.user]);
  for (const table of [
    'credit_cards',
    'card_purchases',
    'investment_holdings',
    'investment_events',
    'transaction_claims',
  ])
    expect(
      (await db.engine.query(`SELECT 1 FROM wallet.${table} WHERE workspace_id=$1`, [space])).rows,
    ).toHaveLength(0);
});
it('rolls back transfers and profit records when a redemption or valuation is invalid', async () => {
  const bank = await account('Atomic portfolio');
  const h = await makeHolding('Atomic holding', 1000, 1000);
  const before = await run(() => ledger.exportRecords());
  await expect(
    run(() =>
      wealth.operate(
        h.id,
        {
          kind: 'redemption',
          date: '2026-11-15',
          amount: 2000,
          capitalRemoved: 1000,
          accountId: bank.id,
        },
        '1',
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('intervalo');
  expect(await run(() => ledger.exportRecords())).toEqual(before);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(100000);
});

it('links historical capital already included in a current position without adding it again', async () => {
  const bank = await account('Historical contribution');
  const debit = await run(() =>
    ledger.create({
      accountId: bank.id,
      description: 'Aporte antigo no extrato',
      amount: -3000,
      transactionDate: '2026-10-10',
      transactionType: 'expense',
    }),
  );
  const h = await makeHolding('Existing position', 10000, 12000);
  const before = await run(() => wealth.summary());
  await run(() =>
    wealth.operate(
      h.id,
      {
        kind: 'contribution',
        date: '2026-10-10',
        amount: 3000,
        accountId: bank.id,
        transactionId: debit.id,
        transactionVersion: 1,
        includedInPosition: true,
      },
      '1',
      randomUUID(),
    ),
  );
  let c = await holding(h.id);
  expect(c).toMatchObject({ capital: 10000, marketValue: 12000, valuationDate: '2026-11-01' });
  expect((await run(() => wealth.summary())).netWorth).toBe(before.netWorth);
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(10000);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(97000);
  await run(() => wealth.undo(h.id, String(c.version), randomUUID()));
  c = await holding(h.id);
  expect(c.capital).toBe(10000);
  expect((await run(() => accounts.find(h.accountId))).balance).toBe(10000);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(97000);
});

it('tracks the net investment income when a bank receipt later has a linked refund', async () => {
  const bank = await account('Income refund bank');
  const h = await makeHolding('Income refund holding', 1000, 1000);
  await run(() =>
    wealth.operate(
      h.id,
      { kind: 'income', date: '2026-11-15', amount: 500, accountId: bank.id },
      '1',
      randomUUID(),
    ),
  );
  const e = (await holding(h.id)).events.find((e) => e.kind === 'income')!;
  await run(() =>
    ledger.create({
      accountId: bank.id,
      amount: -200,
      description: 'Devolução do rendimento',
      transactionDate: '2026-11-15',
      transactionType: 'income',
      refundOfId: e.resultId,
      categoryId: null,
    }),
  );
  expect((await holding(h.id)).realized).toBe(300);
  expect((await run(() => accounts.find(bank.id))).balance).toBe(100300);
  await expect(run(async () => backup.preview(await backup.backup()))).resolves.toHaveProperty(
    'id',
  );
});

it('protects even empty managed accounts from conversion through the bank-account editor', async () => {
  const { card } = await makeCard('Empty protected card');
  const h = await makeHolding('Existing protected capital', 1000, 1000);
  for (const id of [card.accountId, h.accountId]) {
    const a = await run(() => accounts.find(id));
    await expect(
      run(() =>
        accounts.update(
          id,
          { name: 'Bypass', institution: 'mercado_pago', type: 'checking', openingBalance: 999999 },
          String(a.version),
        ),
      ),
    ).rejects.toThrow('módulo');
    expect((await run(() => accounts.find(id))).type).toBe(a.type);
  }
});

it('keeps multiple prior debts and links an unclassified debit without charging cash twice, then restores its type', async () => {
  const { card, bank } = await makeCard('Multiple prior debts');
  await run(() => cards.opening(card.id, '2026-10', 3000, '1', randomUUID()));
  let c = await currentCard(card.id);
  await run(() => cards.opening(card.id, '2026-11', 4000, String(c.version), randomUUID()));
  c = await currentCard(card.id);
  await run(() => cards.opening(card.id, '2026-11', 1000, String(c.version), randomUUID()));
  c = await currentCard(card.id);
  expect(c.bills.find((b) => b.month === '2026-11')?.remaining).toBe(5000);
  const debit = await run(() =>
    ledger.create(
      {
        accountId: bank.id,
        amount: -5000,
        transactionDate: '2026-11-12',
        description: 'Card bill from statement',
        transactionType: 'unclassified',
      },
      true,
    ),
  );
  const bankBalance = (await run(() => accounts.find(bank.id))).balance;
  const candidates = await run(() =>
    cards.candidates(card.id, bank.id, '2026-11-01', '2026-11-15'),
  );
  expect(candidates.some((t) => t.id === debit.id)).toBe(true);
  const payment = await run(() =>
    cards.pay(
      card.id,
      '2026-11',
      {
        mode: 'link',
        accountId: bank.id,
        date: '2026-11-12',
        amount: 5000,
        transactionId: debit.id,
        transactionVersion: debit.version,
      },
      String(c.version),
      randomUUID(),
    ),
  );
  expect((await run(() => accounts.find(bank.id))).balance).toBe(bankBalance);
  expect((await currentCard(card.id)).bills.find((b) => b.month === '2026-11')?.remaining).toBe(0);
  expect(await run(() => ledger.find(debit.id))).toMatchObject({
    cardPayment: { cardId: card.id, billMonth: '2026-11' },
    transactionType: 'transfer',
  });
  const exported = await run(() => backup.backup());
  const tampered = { ...exported, version: 10 };
  await expect(run(() => backup.preview(tampered))).rejects.toThrow();
  await db.forUser(db.other, async () => {
    const draft = await backup.preview(exported);
    await backup.confirm(draft.id);
    const restored = (await cards.summary('2026-11')).cards.find((r) => r.name === card.name)!;
    const saved = (await backup.backup()).cards!.payments.find(
      (p) => p.cardId === restored.id && !p.voided,
    )!;
    expect(saved.originalDebit?.transactionType).toBe('unclassified');
    await cards.undoPayment(restored.id, saved.id, String(restored.version), randomUUID());
    expect(await ledger.find(saved.debitId!)).toMatchObject({
      transactionType: 'unclassified',
      amount: -5000,
      cardPayment: null,
    });
  });
  c = await currentCard(card.id);
  await run(() => cards.undoPayment(card.id, payment.id, String(c.version), randomUUID()));
  expect(await run(() => ledger.find(debit.id))).toMatchObject({
    transactionType: 'unclassified',
    cardPayment: null,
    amount: -5000,
  });
  expect((await run(() => accounts.find(bank.id))).balance).toBe(bankBalance);
});

it('plans invoices by default, accepts payments from different accounts and preserves monthly selections in backups', async () => {
  const planService = new PlanningService(
    new PlanningRepository(db.service),
    categories,
    ledger,
    accounts,
    cards,
  );
  const bankA = await account('Invoice payment A');
  const bankB = await account('Invoice payment B');
  const card = await run(() =>
    cards.create(
      { name: 'Free funding invoice', closingDay: 10, dueDay: 20, limit: 100000 },
      randomUUID(),
    ),
  );
  expect(card.paymentAccountId).toBeNull();
  const cat = (await run(() => categories.list())).find((c) => c.type === 'expense')!;
  await purchase(card.id, 1, 12000, 1, cat.id);
  const initial = await run(() => planService.summary('2026-11'));
  const initialRow = initial.cardBills!.find((b) => b.cardId === card.id)!;
  expect(initialRow).toMatchObject({ included: true, planned: 12000, paid: 0, remaining: 12000 });
  expect(
    (await run(() => ledger.planningActuals('2026-11-01', '2026-12-01'))).find(
      (r) => r.categoryId === cat.id,
    )?.amount,
  ).toBeLessThan(0);
  const bankBefore = (await run(() => accounts.find(bankA.id))).balance;
  let c = await currentCard(card.id);
  const key = randomUUID();
  const command = {
    accountId: bankA.id,
    date: '2026-11-15',
    amount: 4000,
    description: 'Pagamento parcial na transação',
  };
  const first = await run(() =>
    cards.payTransaction(card.id, '2026-11', command, String(c.version), key),
  );
  expect(first.debitId).toBeTruthy();
  expect(
    await run(() => cards.payTransaction(card.id, '2026-11', command, String(c.version), key)),
  ).toEqual(first);
  expect((await run(() => accounts.find(bankA.id))).balance).toBe(bankBefore - 4000);
  const debit = await run(() =>
    ledger.create({
      accountId: bankB.id,
      amount: -3000,
      transactionDate: '2026-11-15',
      description: 'Outro pagamento',
      transactionType: 'expense',
      categoryId: cat.id,
    }),
  );
  const bankBBefore = (await run(() => accounts.find(bankB.id))).balance;
  c = await currentCard(card.id);
  const second = await run(() =>
    cards.payTransaction(
      card.id,
      '2026-11',
      {
        accountId: bankB.id,
        date: '2026-11-15',
        amount: 3000,
        description: 'Outro pagamento',
        transactionId: debit.id,
        transactionVersion: debit.version,
      },
      String(c.version),
      randomUUID(),
    ),
  );
  expect((await run(() => accounts.find(bankB.id))).balance).toBe(bankBBefore);
  const paid = await run(() => planService.summary('2026-11'));
  expect(paid.cardBills!.find((b) => b.cardId === card.id)).toMatchObject({
    paid: 7000,
    remaining: 5000,
  });
  expect(paid.totals.actualExpense - initial.totals.actualExpense).toBe(7000);
  const disabled = await run(() =>
    planService.save('2026-11', {
      version: paid.version,
      notes: '',
      contribution: null,
      lines: [],
      cardPlans: [{ accountId: card.accountId, billMonth: '2026-11', included: false }],
    }),
  );
  expect(disabled.cardBills!.find((b) => b.cardId === card.id)?.included).toBe(false);
  const enabled = await run(() =>
    planService.save('2026-11', {
      version: disabled.version,
      notes: '',
      contribution: null,
      lines: [],
      cardPlans: [
        { accountId: card.accountId, billMonth: '2026-11', included: true, planned: 15000 },
      ],
    }),
  );
  expect(enabled.cardBills!.find((b) => b.cardId === card.id)).toMatchObject({
    planned: 15000,
    automatic: false,
  });
  const copied = await run(() =>
    planService.copyPrevious('2026-12', { version: 0, sourceVersion: enabled.version }),
  );
  expect(copied.cardPlans).toContainEqual({
    accountId: card.accountId,
    billMonth: '2026-12',
    included: true,
    planned: null,
  });
  c = await currentCard(card.id);
  await run(() => cards.undoPayment(card.id, second.id, String(c.version), randomUUID()));
  expect(await run(() => ledger.find(debit.id))).toMatchObject({
    categoryId: cat.id,
    transactionType: 'expense',
    cardPayment: null,
  });
  const beforeReject = await run(() => accounts.find(bankA.id));
  c = await currentCard(card.id);
  await expect(
    run(() =>
      cards.payTransaction(
        card.id,
        '2026-11',
        { ...command, amount: 999999 },
        String(c.version),
        randomUUID(),
      ),
    ),
  ).rejects.toThrow('pendente');
  expect((await run(() => accounts.find(bankA.id))).balance).toBe(beforeReject.balance);
  const exported = await run(() => backup.backup());
  expect(exported.version).toBe(13);
  await db.forUser(db.other, async () => {
    const preview = await backup.preview(exported);
    await backup.confirm(preview.id);
    const restored = (await cards.summary('2026-11')).cards.find((r) => r.name === card.name)!;
    expect(restored.paymentAccountId).toBeNull();
    const restoredPlan = await planService.summary('2026-11');
    expect(restoredPlan.cardBills!.find((b) => b.cardId === restored.id)).toMatchObject({
      included: true,
      planned: 15000,
      paid: 4000,
    });
    expect(restoredPlan.cardPlans![0].accountId).not.toBe(card.accountId);
  });
});

it('confirms an imported invoice payment atomically and never duplicates its bank debit', async () => {
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
    cards,
  );
  const bank = await account('Invoice import bank');
  const card = await run(() =>
    cards.create(
      { name: 'Invoice from statement', closingDay: 10, dueDay: 20, limit: 30000 },
      randomUUID(),
    ),
  );
  await purchase(card.id, 1, 6000, 1);
  const preview = await run(() =>
    imports.upload(bank.id, Buffer.from('invoice-bank-statement'), 'invoice.csv', {
      openingBalance: 100000,
      closingBalance: 97000,
      items: [
        {
          sourceRow: 1,
          sourcePage: 1,
          transactionDate: '2026-11-15',
          description: 'Pagamento fatura importado',
          sourceOperationId: 'invoice-payment-import',
          amount: -3000,
          balanceAfter: 97000,
        },
      ],
    }),
  );
  const item = preview.items[0];
  const reviewed = await run(() =>
    imports.review(
      preview.id,
      item.id,
      {
        selected: true,
        transactionType: 'expense',
        categoryId: null,
        cardId: card.id,
        cardBillMonth: '2026-11',
      },
      String(preview.version),
    ),
  );
  expect(reviewed.items[0]).toMatchObject({ cardId: card.id, cardBillMonth: '2026-11' });
  const balance = (await run(() => accounts.find(bank.id))).balance;
  expect((await currentCard(card.id)).bills.find((b) => b.month === '2026-11')?.paid).toBe(0);
  const key = randomUUID();
  const confirmed = await run(() => imports.confirm(preview.id, reviewed.version, key));
  expect(await run(() => imports.confirm(preview.id, reviewed.version, key))).toEqual(confirmed);
  const paid = (await currentCard(card.id)).bills.find((b) => b.month === '2026-11')!;
  expect(paid).toMatchObject({ paid: 3000, remaining: 3000 });
  expect((await run(() => accounts.find(bank.id))).balance).toBe(balance - 3000);
  const transactions = await run(() => ledger.exportRecords());
  const debit = transactions.find((t) => t.sourceOperationId === 'invoice-payment-import')!;
  expect(await run(() => ledger.find(debit.id))).toMatchObject({
    cardPayment: { cardId: card.id, billMonth: '2026-11' },
    transactionType: 'transfer',
  });
});

it('counts only payments made in the selected month and can explicitly include an older invoice', async () => {
  const planner = new PlanningService(
    new PlanningRepository(db.service),
    categories,
    ledger,
    accounts,
    cards,
  );
  const bank = await account('Across month payments');
  const card = await run(() =>
    cards.create(
      { name: 'Across month invoice', closingDay: 10, dueDay: 20, limit: 30000 },
      randomUUID(),
    ),
  );
  await purchase(card.id, 1, 10000, 1);
  let current = await currentCard(card.id);
  await run(() =>
    cards.payTransaction(
      card.id,
      '2026-11',
      { accountId: bank.id, date: '2026-11-15', amount: 4000, description: 'Primeira parte' },
      String(current.version),
      randomUUID(),
    ),
  );
  try {
    vi.setSystemTime(new Date('2026-12-05T12:00:00Z'));
    current = await currentCard(card.id);
    await run(() =>
      cards.payTransaction(
        card.id,
        '2026-11',
        { accountId: bank.id, date: '2026-12-05', amount: 3000, description: 'Segunda parte' },
        String(current.version),
        randomUUID(),
      ),
    );
    const november = await run(() => planner.summary('2026-11'));
    expect(november.cardBills!.find((b) => b.cardId === card.id)).toMatchObject({
      paid: 4000,
      remaining: 6000,
      planned: 10000,
    });
    const december = await run(() => planner.summary('2026-12'));
    expect(
      december.cardBills!.find((b) => b.cardId === card.id && b.billMonth === '2026-11'),
    ).toMatchObject({ included: false, paid: 3000, remaining: 3000, planned: 6000 });
    const saved = await run(() =>
      planner.save('2026-12', {
        version: december.version,
        notes: '',
        contribution: null,
        lines: [],
        cardPlans: [{ accountId: card.accountId, billMonth: '2026-11', included: true }],
      }),
    );
    expect(
      saved.cardBills!.find((b) => b.cardId === card.id && b.billMonth === '2026-11'),
    ).toMatchObject({ included: true, paid: 3000 });
  } finally {
    vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));
  }
});

import { GoalsService } from '../../goals/services/goals.service.js';
import { SharingService } from '../../workspaces/services/sharing.service.js';
import { AlertsService } from '../../alerts/services/alerts.service.js';
import { RecognitionService } from '../../ledger/services/recognition.service.js';
const goals = new GoalsService(db.service, accounts, receipts);
const sharing = new SharingService(db.service);
const planningCycle = new PlanningService(
  new PlanningRepository(db.service),
  categories,
  ledger,
  accounts,
  cards,
);
const alerts = new AlertsService(db.service, cards, goals, planningCycle, commitments);
const recognition = new RecognitionService(
  db.service,
  accounts,
  categories,
  parties,
  cards,
  cards,
  receipts,
);
it('uses optional account defaults by direction while preserving explicit choices, recognized rules and archived categories', async () => {
  const expense = await run(() =>
    categories.save({ name: 'Default expense cycle', type: 'expense', color: '#f28a97' }),
  );
  const income = await run(() =>
    categories.save({ name: 'Default income cycle', type: 'income', color: '#5ee9b5' }),
  );
  const a = await run(() =>
    accounts.create({
      name: 'Defaults cycle',
      institution: 'mercado_pago',
      type: 'checking',
      openingBalance: 10000,
      openingDate: '2026-01-01',
      defaultIncomeCategoryId: income.id,
      defaultExpenseCategoryId: expense.id,
    }),
  );
  const base = {
    accountId: a.id,
    description: 'Defaults test',
    transactionDate: '2026-11-01',
    amount: -100,
    transactionType: 'expense' as const,
  };
  expect((await run(() => ledger.create(base))).categoryId).toBe(expense.id);
  expect(
    (await run(() => ledger.create({ ...base, amount: 100, transactionType: 'income' })))
      .categoryId,
  ).toBe(income.id);
  expect(
    (await run(() => ledger.create({ ...base, categoryId: null, categoryChoiceExplicit: true })))
      .categoryId,
  ).toBeNull();
  await expect(
    run(() =>
      accounts.create({
        name: 'Wrong defaults',
        institution: 'mercado_pago',
        type: 'checking',
        defaultExpenseCategoryId: income.id,
      }),
    ),
  ).rejects.toThrow('tipo correspondente');
  const manualNone = await run(() =>
    ledger.create({
      ...base,
      description: 'Explicit uncategorized cycle',
      categoryId: null,
      categoryChoiceExplicit: true,
    }),
  );
  expect(
    (await run(() => recognition.queue())).items.some((i) => i.transactionId === manualNone.id),
  ).toBe(false);
  await run(() => categories.archive(expense.id));
  expect((await run(() => ledger.create(base))).categoryId).toBeNull();
});
it('allocates existing money once, preserves account balances and supports guarded release/undo with visible deficits', async () => {
  const a = await account('Goal cycle'),
    before = a.balance;
  const g = await run(() =>
    goals.save({ name: 'Emergency cycle', target: 200000, priority: 1, deadline: '2027-01-01' }),
  );
  const allocated = await run(() =>
    goals.allocate(
      g.id,
      { accountId: a.id, amount: 80000, action: 'allocate' },
      String(g.version),
      'goal-cycle-first',
    ),
  );
  expect(allocated.allocated).toBe(80000);
  expect((await run(() => accounts.find(a.id))).balance).toBe(before);
  const g2 = await run(() => goals.save({ name: 'Travel cycle', target: 50000, priority: 2 }));
  await expect(
    run(() =>
      goals.allocate(
        g2.id,
        { accountId: a.id, amount: 30000, action: 'allocate' },
        String(g2.version),
        'goal-cycle-over',
      ),
    ),
  ).rejects.toThrow('insuficiente');
  const released = await run(() =>
    goals.allocate(
      g.id,
      { accountId: a.id, amount: 20000, action: 'release' },
      String(allocated.version),
      'goal-cycle-release',
    ),
  );
  const undone = await run(() =>
    goals.undo(
      g.id,
      released.allocations.find((e) => e.delta === -20000)!.id,
      String(released.version),
      'goal-cycle-undo',
    ),
  );
  expect(undone.allocated).toBe(80000);
  await run(() =>
    ledger.create({
      accountId: a.id,
      description: 'External spend cycle',
      amount: -50000,
      transactionDate: '2026-11-01',
      transactionType: 'expense',
    }),
  );
  expect((await run(() => goals.summary())).goals.find((x) => x.id === g.id)?.underfunded).toBe(
    true,
  );
  await expect(
    db.forUser(db.other, () =>
      goals.allocate(
        g.id,
        { accountId: a.id, amount: 1, action: 'allocate' },
        String(undone.version),
        'goal-foreign',
      ),
    ),
  ).rejects.toThrow();
});
it('forecasts recurring card charges and replaces them with one confirmed or linked purchase, including cancellation and retry', async () => {
  const { card } = await makeCard('Recurring cycle');
  const rule = await run(() =>
    cards.saveRecurring(card.id, {
      name: 'Streaming cycle',
      amount: 1900,
      chargeDay: 5,
      startMonth: '2026-11',
    }),
  );
  expect(
    (await run(() => cards.planningBills('2026-11'))).find((b) => b.cardId === card.id)?.amount,
  ).toBe(1900);
  const first = await run(() =>
    cards.confirmRecurring(
      card.id,
      rule.id,
      '2026-11',
      String(card.version),
      'recurring-cycle-first',
    ),
  );
  const current = await currentCard(card.id);
  expect(current.purchases.filter((p) => !p.canceled)).toHaveLength(1);
  expect(
    (await run(() => cards.planningBills('2026-11'))).find((b) => b.cardId === card.id)?.amount,
  ).toBe(1900);
  expect(
    (
      await run(() =>
        cards.confirmRecurring(
          card.id,
          rule.id,
          '2026-11',
          String(current.version),
          'recurring-cycle-again',
        ),
      )
    ).id,
  ).toBe(first.id);
  await run(() =>
    cards.cancelPurchase(card.id, first.id, String(current.version), 'recurring-cycle-cancel'),
  );
  const updated = await currentCard(card.id);
  const recreated = await run(() =>
    cards.confirmRecurring(
      card.id,
      rule.id,
      '2026-11',
      String(updated.version),
      'recurring-cycle-replace',
    ),
  );
  expect(recreated.id).not.toBe(first.id);
  const beforeManual = await currentCard(card.id);
  const existing = await run(() =>
    cards.purchase(
      card.id,
      {
        description: 'Manual recurring cycle',
        amount: 2100,
        installments: 1,
        purchaseDate: '2026-11-06',
      },
      String(beforeManual.version),
      'recurring-cycle-manual',
    ),
  );
  const second = await run(() =>
    cards.saveRecurring(card.id, {
      name: 'Manual recurring cycle',
      amount: 2100,
      chargeDay: 6,
      startMonth: '2026-11',
    }),
  );
  const beforeLink = await currentCard(card.id);
  await run(() =>
    cards.confirmRecurring(
      card.id,
      second.id,
      '2026-11',
      String(beforeLink.version),
      'recurring-cycle-link',
      existing.id,
    ),
  );
  expect((await currentCard(card.id)).purchases.filter((p) => !p.canceled)).toHaveLength(2);
});
it('round-trips goals, allocations, default categories and recurring card associations in backup v13', async () => {
  const complete = new DataExportService(
    accounts,
    categories,
    ledger,
    receipts,
    new RestoreRepository(db.service),
    planningCycle,
    parties,
    basis,
    commitments,
    cards,
    wealth,
    goals,
  );
  const source = await run(() => complete.backup());
  expect(source.version).toBe(13);
  expect(source.goals!.goals.length).toBeGreaterThan(0);
  expect(source.cards!.recurringCharges!.length).toBeGreaterThan(0);
  const workspace = await db.forUser(
    db.user,
    async () => {
      const [w] = await db.service.query(
        "INSERT INTO wallet.workspaces(user_id,name,description,color) VALUES($1,'Cycle restored','','emerald') RETURNING id",
        [db.user],
      );
      return w.id;
    },
    false,
    null,
  );
  await db.forUser(
    db.user,
    async () => {
      const draft = await complete.preview(source);
      await complete.confirm(draft.id);
      const restored = await complete.backup();
      expect(
        restored.goals!.goals.map((g) => ({
          name: g.name,
          total: g.allocations.reduce((n, e) => n + e.delta, 0),
        })),
      ).toEqual(
        source.goals!.goals.map((g) => ({
          name: g.name,
          total: g.allocations.reduce((n, e) => n + e.delta, 0),
        })),
      );
      expect(restored.cards!.recurringCharges).toHaveLength(source.cards!.recurringCharges!.length);
      expect(
        restored.accounts.find((a) => a.name === 'Defaults cycle')?.defaultIncomeCategoryId,
      ).toBe(restored.categories.find((c) => c.name === 'Default income cycle')?.id);
    },
    false,
    workspace,
  );
});
it('previews recognition batches, rejects persistently, preserves money and prevents stale overwrites with undo', async () => {
  const cat = await run(() =>
    categories.save({ name: 'Recognition category cycle', type: 'expense', color: '#f28a97' }),
  );
  const a = await account('Recognition cycle');
  const t = await run(() =>
    ledger.create({
      accountId: a.id,
      description: 'Recognition cycle transaction',
      amount: -150,
      transactionDate: '2026-11-02',
      transactionType: 'expense',
    }),
  );
  await run(() =>
    accounts.update(
      a.id,
      { name: a.name, institution: a.institution, type: a.type, defaultExpenseCategoryId: cat.id },
      String(a.version),
    ),
  );
  const candidate = (await run(() => recognition.queue())).items.find(
    (i) => i.transactionId === t.id,
  )!;
  expect(candidate.categoryId).toBe(cat.id);
  const draft = await run(() => recognition.preview([candidate.signature]));
  const before = (await run(() => accounts.find(a.id))).balance;
  await run(() => recognition.confirm(draft.id, 'recognition-cycle-confirm'));
  expect((await run(() => ledger.find(t.id))).categoryId).toBe(cat.id);
  expect((await run(() => accounts.find(a.id))).balance).toBe(before);
  const change = (await run(() => recognition.changes())).find((c) => c.transactionId === t.id)!;
  await run(() => recognition.undo(change.id, 'recognition-cycle-undo'));
  expect((await run(() => ledger.find(t.id))).categoryId).toBeNull();
  const next = (await run(() => recognition.queue())).items.find((i) => i.transactionId === t.id)!;
  await run(() => recognition.reject([next.signature]));
  expect(
    (await run(() => recognition.queue())).items.some((i) => i.signature === next.signature),
  ).toBe(false);
  const latest = await run(() => accounts.find(a.id));
  await run(() =>
    accounts.update(
      a.id,
      { name: a.name, institution: a.institution, type: a.type, defaultExpenseCategoryId: null },
      String(latest.version),
    ),
  );
  const another = await run(() =>
    ledger.create({
      accountId: a.id,
      description: 'Stale recognition',
      amount: -100,
      transactionDate: '2026-11-03',
      transactionType: 'expense',
    }),
  );
  const newest = await run(() => accounts.find(a.id));
  await run(() =>
    accounts.update(
      a.id,
      { name: a.name, institution: a.institution, type: a.type, defaultExpenseCategoryId: cat.id },
      String(newest.version),
    ),
  );
  const stale = (await run(() => recognition.queue())).items.find(
    (i) => i.transactionId === another.id,
  )!;
  const preview = await run(() => recognition.preview([stale.signature]));
  await run(() =>
    ledger.update(
      another.id,
      {
        accountId: a.id,
        description: 'Now manual',
        amount: -100,
        transactionDate: '2026-11-03',
        transactionType: 'expense',
        categoryId: cat.id,
      },
      String(another.version),
    ),
  );
  await expect(
    run(() => recognition.confirm(preview.id, 'recognition-cycle-stale')),
  ).rejects.toThrow('mudou');
});
it('shares through expiring invitations, enforces reader/editor/owner capabilities, records actor and revokes access', async () => {
  const [{ id: workspace }] = await db.engine
    .query<{ id: string }>('SELECT id FROM wallet.workspaces WHERE user_id=$1 AND is_default', [
      db.user,
    ])
    .then((r) => r.rows);
  const invite = await run(() => sharing.invite({ email: 'reader@example.com', role: 'reader' }));
  await expect(
    db.forUser(db.other, () => sharing.accept(invite.token, 'wrong@example.com'), false, null),
  ).rejects.toThrow('outro e-mail');
  await db.forUser(db.other, () => sharing.accept(invite.token, 'reader@example.com'), false, null);
  expect(
    (await db.forUser(db.other, () => accounts.list(), true, workspace)).length,
  ).toBeGreaterThan(0);
  await expect(
    db.forUser(
      db.other,
      () =>
        accounts.create({ name: 'Reader denied', type: 'checking', institution: 'mercado_pago' }),
      false,
      workspace,
    ),
  ).rejects.toThrow('apenas consultar');
  await expect(
    db.forUser(db.other, async () => db.service.requireExport(), true, workspace),
  ).rejects.toThrow('apenas consultar');
  await db.forUser(
    db.other,
    async () => {
      await expect(
        db.service.query("UPDATE wallet.financial_accounts SET name='Forbidden' WHERE user_id=$1", [
          db.user,
        ]),
      ).rejects.toThrow();
    },
    true,
    workspace,
  );
  const readerAlerts = await db.forUser(db.other, () => alerts.sync(), false, workspace, true);
  expect(readerAlerts.preferences.bills).toBe(true);
  const ownerAlerts = await run(() => alerts.list());
  await db.forUser(
    db.other,
    () =>
      alerts.save({
        dueDays: 1,
        budgetPercent: 80,
        bills: false,
        budgets: false,
        negativeBalance: false,
        goals: false,
      }),
    false,
    workspace,
    true,
  );
  expect((await run(() => alerts.list())).preferences).toEqual(ownerAlerts.preferences);
  expect(
    await db.forUser(
      db.other,
      () =>
        db.service.query(
          "UPDATE wallet.financial_accounts SET name='Reader cannot write' WHERE user_id=$1 RETURNING id",
          [db.user],
        ),
      false,
      workspace,
      true,
    ),
  ).toEqual([]);
  await expect(
    db.forUser(
      db.other,
      () =>
        accounts.create({
          name: 'Reader RLS blocked',
          type: 'checking',
          institution: 'mercado_pago',
        }),
      false,
      workspace,
      true,
    ),
  ).rejects.toThrow();
  await run(() => sharing.change(db.other, 'editor'));
  const edited = await db.forUser(
    db.other,
    () =>
      accounts.create({
        name: 'Shared editor cycle',
        type: 'checking',
        institution: 'mercado_pago',
      }),
    false,
    workspace,
  );
  await expect(
    db.forUser(db.other, async () => db.service.requireOwner(), false, workspace),
  ).rejects.toThrow('proprietário');
  const audit = await run(() =>
    db.service.query('SELECT actor_id FROM wallet.actor_audit WHERE record_id=$1', [edited.id]),
  );
  expect(audit[0].actor_id).toBe(db.other);
  await run(() => sharing.change(db.other));
  await expect(db.forUser(db.other, () => accounts.list(), true, workspace)).rejects.toThrow(
    'Espaço não encontrado',
  );
  const expired = await run(() => sharing.invite({ email: 'reader@example.com', role: 'reader' }));
  await db.engine.query(
    "UPDATE wallet.workspace_invites SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
    [expired.id],
  );
  await expect(
    db.forUser(db.other, () => sharing.accept(expired.token, 'reader@example.com'), false, null),
  ).rejects.toThrow('Convite inválido');
  const revoked = await run(() => sharing.invite({ email: 'reader@example.com', role: 'reader' }));
  await run(() => sharing.revoke(revoked.id));
  await expect(
    db.forUser(db.other, () => sharing.accept(revoked.token, 'reader@example.com'), false, null),
  ).rejects.toThrow('Convite inválido');
});
it('persists alert preferences, read/dismiss state and condition deduplication separately for each participant', async () => {
  const first = await run(() => alerts.sync());
  expect(first.items.length).toBeGreaterThan(0);
  const item = first.items[0];
  await run(() => alerts.action(item.id, 'dismiss'));
  expect((await run(() => alerts.sync())).items.some((i) => i.id === item.id)).toBe(false);
  const p = {
    dueDays: 7,
    budgetPercent: 90,
    bills: false,
    budgets: false,
    negativeBalance: false,
    goals: false,
  };
  await run(() => alerts.save(p));
  expect((await run(() => alerts.list())).preferences).toEqual(p);
  expect((await run(() => alerts.list())).items).toHaveLength(0);
  await db.forUser(db.other, async () =>
    expect((await alerts.list()).preferences.bills).toBe(true),
  );
});
