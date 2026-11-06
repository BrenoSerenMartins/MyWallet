import { UnprocessableEntityException } from '@nestjs/common';
import type {
  BackupPayload,
  InvestmentHolding,
  WealthItem,
} from '../../../core/integration/index.js';
import { dateOnly, requireUuid } from '../../../core/rest/index.js';
export function validateManagedBackup(b: BackupPayload, unique: (id: string) => void) {
  const fail = (): never => {
    throw new UnprocessableEntityException(
      'Os dados de cartões, investimentos ou patrimônio do backup são inválidos.',
    );
  };
  if (b.version < 9) {
    if (b.cards !== undefined || b.wealth !== undefined) fail();
    return;
  }
  const cards = b.cards;
  const wealth = b.wealth;
  if (!cards || !wealth) return fail();
  const arr = (v: unknown, max: number) => {
    if (!Array.isArray(v) || v.length > max) fail();
  };
  arr(cards.cards, 100);
  arr(cards.bills, 20000);
  arr(cards.purchases, 10000);
  arr(cards.entries, 50000);
  arr(cards.payments, 30000);
  arr(wealth.holdings, 500);
  arr(wealth.events, 50000);
  arr(wealth.items, 1000);
  arr(wealth.history, 20000);
  const num = (v: unknown, min = 0) => {
    if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > 1000000000000) fail();
  };
  const text = (v: unknown, max: number, empty = false) => {
    if (typeof v !== 'string' || v.length > max || (!empty && !v.trim())) fail();
  };
  const date = (v: string) => {
    dateOnly(v);
    if (v < '1900-01-01' || v > '9998-12-31') fail();
  };
  const month = (v: string) => {
    if (
      typeof v !== 'string' ||
      !/^(?:19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(v) ||
      v > '9998-12'
    )
      fail();
  };
  const bool = (v: unknown) => {
    if (typeof v !== 'boolean') fail();
  };
  const version = (v: unknown) => num(v, 1);
  const accounts = new Map(b.accounts.map((a) => [a.id, a]));
  const txs = new Map(b.transactions.map((t) => [t.id, t]));
  const categories = new Map(b.categories.map((c) => [c.id, c]));
  const ordinary = (id: string) => {
    const a = accounts.get(id);
    return a && !['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type);
  };
  const managedAccounts = new Set<string>();
  const coverage = new Set<string>();
  const claims = new Set(
    (b.commitments?.occurrences ?? []).flatMap((r) => (r.transactionId ? [r.transactionId] : [])),
  );
  const cover = (id: string) => {
    if (coverage.has(id)) fail();
    coverage.add(id);
  };
  const claim = (id: string) => {
    if (claims.has(id)) fail();
    claims.add(id);
  };
  const samePair = (
    debitId: string | null,
    creditId: string | null,
    amount: number,
    kind: string,
  ) => {
    const debit = debitId ? txs.get(debitId) : null;
    const credit = creditId ? txs.get(creditId) : null;
    if (
      !debit ||
      !credit ||
      debit.amount !== -amount ||
      credit.amount !== amount ||
      debit.transactionType !== 'transfer' ||
      credit.transactionType !== 'transfer' ||
      debit.managedKind !== kind ||
      credit.managedKind !== kind ||
      !debit.transferGroupId ||
      debit.transferGroupId !== credit.transferGroupId ||
      debit.transactionDate !== credit.transactionDate
    )
      return fail();
    return { debit, credit };
  };
  for (const c of cards.cards) {
    unique(c.id);
    text(c.name, 100);
    version(c.version);
    bool(c.archived);
    num(c.limit);
    if (
      !Number.isInteger(c.closingDay) ||
      c.closingDay < 1 ||
      c.closingDay > 31 ||
      !Number.isInteger(c.dueDay) ||
      c.dueDay < 1 ||
      c.dueDay > 31 ||
      accounts.get(c.accountId)?.type !== 'credit_card' ||
      accounts.get(c.accountId)?.openingBalance !== 0 ||
      (c.paymentAccountId === null ? b.version < 12 : !ordinary(c.paymentAccountId)) ||
      managedAccounts.has(c.accountId)
    )
      fail();
    managedAccounts.add(c.accountId);
  }
  const cardMap = new Map(cards.cards.map((c) => [c.id, c]));
  const billMap = new Map<string, (typeof cards.bills)[number]>();
  for (const bill of cards.bills) {
    unique(bill.id);
    month(bill.month);
    date(bill.closingDate);
    date(bill.dueDate);
    const key = `${bill.cardId}:${bill.month}`;
    if (
      !cardMap.has(bill.cardId) ||
      billMap.has(key) ||
      bill.closingDate > bill.dueDate ||
      bill.dueDate.slice(0, 7) !== bill.month
    )
      fail();
    billMap.set(key, bill);
  }
  for (const p of cards.purchases) {
    unique(p.id);
    text(p.description, 120);
    date(p.purchaseDate);
    month(p.firstBillMonth);
    num(p.amount, 1);
    version(p.version);
    bool(p.canceled);
    if (
      !cardMap.has(p.cardId) ||
      !Number.isInteger(p.installments) ||
      p.installments < 1 ||
      p.installments > 120 ||
      p.amount < p.installments ||
      (p.categoryId !== null && categories.get(p.categoryId)?.type !== 'expense')
    )
      fail();
  }
  const purchases = new Map(cards.purchases.map((p) => [p.id, p]));
  for (const e of cards.entries) {
    unique(e.id);
    month(e.billMonth);
    text(e.description, 500);
    const bill = billMap.get(`${e.cardId}:${e.billMonth}`);
    const card = cardMap.get(e.cardId);
    if (
      !card ||
      !bill ||
      !Number.isSafeInteger(e.amount) ||
      !e.amount ||
      Math.abs(e.amount) > 1000000000000 ||
      !['purchase', 'opening', 'refund'].includes(e.kind)
    )
      fail();
    const p = e.purchaseId ? purchases.get(e.purchaseId) : null;
    if (e.purchaseId && (!p || p.cardId !== e.cardId)) fail();
    if (
      e.kind === 'purchase' &&
      (!p ||
        !Number.isInteger(e.installmentNumber) ||
        e.installmentNumber! < 1 ||
        e.installmentNumber! > p.installments ||
        e.amount >= 0)
    )
      fail();
    if (e.kind !== 'purchase' && e.installmentNumber !== null) fail();
    if (e.kind === 'opening' && (e.purchaseId !== null || e.amount >= 0)) fail();
    if (e.kind === 'refund' && e.amount <= 0) fail();
    if (e.transactionId) {
      requireUuid(e.transactionId);
      const t = txs.get(e.transactionId);
      if (
        !t ||
        t.accountId !== card!.accountId ||
        t.amount !== e.amount ||
        t.transactionDate !== bill!.dueDate ||
        t.managedKind !== 'card' ||
        t.transactionType !== (e.kind === 'opening' ? 'transfer' : 'expense') ||
        (e.kind === 'purchase' && (p!.canceled || t.categoryId !== p!.categoryId)) ||
        (e.kind === 'refund' && !t.refundOfId)
      )
        fail();
      cover(e.transactionId);
    } else if (e.kind === 'purchase' && !p!.canceled) fail();
  }
  for (const p of cards.purchases) {
    const rows = cards.entries.filter((e) => e.purchaseId === p.id && e.kind === 'purchase');
    if (
      rows.length !== p.installments ||
      new Set(rows.map((e) => e.installmentNumber)).size !== rows.length ||
      -rows.reduce((s, e) => s + BigInt(e.amount), 0n) !== BigInt(p.amount)
    )
      fail();
  }
  for (const p of cards.payments) {
    if (p.originalDebit) {
      if (
        b.version < 11 ||
        p.mode !== 'link' ||
        !['expense', 'transfer', 'unclassified'].includes(p.originalDebit.transactionType)
      )
        fail();
      if (p.originalDebit.categoryId !== null) {
        requireUuid(p.originalDebit.categoryId);
        if (
          p.originalDebit.transactionType !== 'expense' ||
          categories.get(p.originalDebit.categoryId)?.type !== 'expense'
        )
          fail();
      }
    }
    unique(p.id);
    month(p.billMonth);
    date(p.paymentDate);
    num(p.amount, 1);
    version(p.version);
    bool(p.voided);
    if (
      !cardMap.has(p.cardId) ||
      !billMap.has(`${p.cardId}:${p.billMonth}`) ||
      !['create', 'link'].includes(p.mode)
    )
      fail();
    if (p.voided) {
      if (p.debitId !== null || p.creditId !== null) fail();
      continue;
    }
    const pair = samePair(p.debitId, p.creditId, p.amount, 'card');
    if (
      pair.credit.accountId !== cardMap.get(p.cardId)!.accountId ||
      !ordinary(pair.debit.accountId) ||
      pair.debit.transactionDate !== p.paymentDate
    )
      fail();
    cover(pair.debit.id);
    cover(pair.credit.id);
    claim(pair.debit.id);
  }
  const holdingShape = (h: InvestmentHolding) => {
    if (!h || typeof h !== 'object') fail();
    requireUuid(h.id);
    text(h.name, 100);
    text(h.provider, 100, true);
    num(h.capital);
    num(h.marketValue);
    date(h.valuationDate);
    date(h.openedDate);
    bool(h.archived);
    version(h.version);
    if (
      !['fixed_income', 'fund', 'stock', 'etf', 'crypto', 'other'].includes(h.productType) ||
      !['manual', 'flow_estimate'].includes(h.valuationMethod) ||
      h.valuationDate < h.openedDate ||
      (h.lastEventId !== null && typeof h.lastEventId !== 'string')
    )
      fail();
  };
  for (const h of wealth.holdings) {
    unique(h.id);
    holdingShape(h);
    if (accounts.get(h.accountId)?.type !== 'investment' || managedAccounts.has(h.accountId))
      fail();
    managedAccounts.add(h.accountId);
    const book =
      BigInt(accounts.get(h.accountId)!.openingBalance) +
      b.transactions
        .filter((t) => t.accountId === h.accountId)
        .reduce((s, t) => s + BigInt(t.amount), 0n);
    if (book !== BigInt(h.capital)) fail();
  }
  const holdings = new Map(wealth.holdings.map((h) => [h.id, h]));
  const eventMap = new Map(wealth.events.map((e) => [e.id, e]));
  for (const e of wealth.events) {
    unique(e.id);
    date(e.eventDate);
    num(e.amount);
    num(e.capitalRemoved);
    bool(e.undone);
    holdingShape(e.beforeState);
    const h = holdings.get(e.holdingId);
    if (
      !h ||
      h.id !== e.beforeState.id ||
      h.accountId !== e.beforeState.accountId ||
      !['contribution', 'redemption', 'income', 'valuation', 'capital', 'edit', 'undo'].includes(
        e.kind,
      ) ||
      !Number.isFinite(Date.parse(e.createdAt)) ||
      !e.details ||
      typeof e.details !== 'object' ||
      Array.isArray(e.details) ||
      JSON.stringify(e.details).length > 4000
    )
      fail();
    for (const pointer of [e.beforeState.lastEventId, e.undoOfId])
      if (
        pointer &&
        (!eventMap.has(pointer) ||
          eventMap.get(pointer)!.holdingId !== e.holdingId ||
          pointer === e.id)
      )
        fail();
    for (const id of [e.debitId, e.creditId, e.resultId, e.linkedId])
      if (id && !txs.has(id)) fail();
    if (e.undone || e.kind === 'undo') continue;
    if (e.kind === 'contribution' || e.kind === 'redemption') {
      if (e.amount > 0) {
        const pair = samePair(e.debitId, e.creditId, e.amount, 'investment');
        if (
          e.kind === 'contribution'
            ? pair.credit.accountId !== h!.accountId || !ordinary(pair.debit.accountId)
            : pair.debit.accountId !== h!.accountId || !ordinary(pair.credit.accountId)
        )
          fail();
        cover(pair.debit.id);
        cover(pair.credit.id);
      } else if (e.debitId || e.creditId) fail();
      const gain = e.kind === 'redemption' ? e.amount - e.capitalRemoved : 0;
      if (gain) {
        const t = e.resultId ? txs.get(e.resultId) : null;
        if (
          !t ||
          t.accountId !== h!.accountId ||
          t.amount !== gain ||
          t.transactionType !== (gain > 0 ? 'income' : 'expense') ||
          t.managedKind !== 'investment'
        )
          fail();
        cover(t!.id);
      } else if (e.resultId) fail();
      if (e.linkedId) {
        if (e.linkedId !== (e.kind === 'contribution' ? e.debitId : e.creditId)) fail();
        claim(e.linkedId);
      }
    } else if (e.kind === 'income') {
      const t = txs.get(e.linkedId ?? e.resultId ?? '');
      if (
        !t ||
        !ordinary(t.accountId) ||
        t.amount !== e.amount ||
        t.transactionType !== 'income' ||
        t.managedKind !== 'investment' ||
        t.transactionDate !== e.eventDate ||
        e.debitId ||
        e.creditId ||
        (e.linkedId && e.resultId)
      )
        fail();
      cover(t!.id);
      if (e.linkedId) claim(e.linkedId);
    } else if (e.debitId || e.creditId || e.resultId || e.linkedId) fail();
  }
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const walk = (id: string) => {
    if (visiting.has(id)) fail();
    if (seen.has(id)) return;
    visiting.add(id);
    const prev = eventMap.get(id)?.beforeState.lastEventId;
    if (prev) walk(prev);
    visiting.delete(id);
    seen.add(id);
  };
  for (const id of eventMap.keys()) walk(id);
  for (const h of wealth.holdings)
    if (h.lastEventId) {
      const e = eventMap.get(h.lastEventId);
      if (!e || e.holdingId !== h.id || e.undone || e.kind === 'undo') fail();
    }
  const itemShape = (i: WealthItem) => {
    if (!i || typeof i !== 'object') fail();
    requireUuid(i.id);
    text(i.name, 100);
    text(i.notes, 500, true);
    date(i.valuationDate);
    num(i.value);
    bool(i.archived);
    version(i.version);
    if (!['asset', 'debt'].includes(i.kind)) fail();
  };
  for (const i of wealth.items) {
    unique(i.id);
    itemShape(i);
  }
  const itemIds = new Set(wealth.items.map((i) => i.id));
  for (const h of wealth.history) {
    unique(h.id);
    if (
      !['snapshot', 'item_change'].includes(h.kind) ||
      !Number.isFinite(Date.parse(h.createdAt)) ||
      !h.data ||
      typeof h.data !== 'object' ||
      JSON.stringify(h.data).length > 10000
    )
      fail();
    if (h.kind === 'snapshot') {
      date(String(h.data.asOf));
      for (const field of [
        'assets',
        'liabilities',
        'cash',
        'reserves',
        'investments',
        'otherAssets',
        'cardCredit',
        'cardDebt',
        'overdrafts',
        'otherDebts',
        'benefitsExcluded',
      ]) {
        const value = h.data[field];
        if (!Number.isSafeInteger(value) || (field !== 'benefitsExcluded' && Number(value) < 0))
          fail();
      }
      if (
        !Number.isSafeInteger(h.data.netWorth) ||
        BigInt(h.data.assets as number) - BigInt(h.data.liabilities as number) !==
          BigInt(h.data.netWorth as number)
      )
        fail();
    } else {
      if (!itemIds.has(String(h.data.itemId))) fail();
      if (h.data.before) itemShape(h.data.before as WealthItem);
      itemShape(h.data.after as WealthItem);
    }
  }
  for (const a of b.accounts)
    if (['credit_card', 'investment'].includes(a.type) && !managedAccounts.has(a.id)) fail();
  for (const t of b.transactions) if (t.managedKind && !coverage.has(t.id)) fail();
}
