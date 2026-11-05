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
    new PlanningService(new PlanningRepository(db.service), categories, ledger, accounts).summary(
      '2026-11',
    ),
  );
  expect(plan.lines.find((l) => l.categoryId === cat.id)?.actual).toBe(3334);
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
  expect(source.version).toBe(11);
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
