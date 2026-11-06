import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ACCOUNT_READS,
  CATEGORY_READS,
  MANAGED_ACCOUNTS,
  MANAGED_LEDGER,
  COMMAND_RECEIPTS,
  type AccountReads,
  type CategoryReads,
  type ManagedAccounts,
  type ManagedLedger,
  type CommandReceipts,
  type CreditCard,
  type CardsSnapshot,
  type CardForecast,
  type ManagedBackup,
} from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireVersion } from '../../../core/rest/index.js';
import { CardsRepository } from '../repositories/cards.repository.js';
import type {
  SaveCardDto,
  CardPurchaseDto,
  CardPaymentDto,
  CardTransactionPaymentDto,
  CardRefundDto,
} from '../dto/cards.dto.js';
import {
  billCalendar,
  firstBillMonth,
  financeToday,
  shiftCardMonth,
  splitInstallments,
  validCardMonth,
} from './card-calendar.js';
const sum = (values: number[]) => exactAmount(Number(values.reduce((a, b) => a + BigInt(b), 0n)));
@Injectable()
export class CardsService implements CardForecast, ManagedBackup<CardsSnapshot> {
  constructor(
    @Inject(CardsRepository) private readonly repo: CardsRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(MANAGED_ACCOUNTS) private readonly managed: ManagedAccounts,
    @Inject(MANAGED_LEDGER) private readonly ledger: ManagedLedger,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
  ) {}
  private async card(id: string) {
    const row = (await this.repo.snapshot()).cards.find((r) => r.id === id);
    if (!row) throw new NotFoundException('Cartão não encontrado.');
    return row;
  }
  private async ordinary(id: string) {
    const a = await this.accounts.find(id);
    if (
      a.archived ||
      ['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type)
    )
      throw new UnprocessableEntityException(
        'Escolha uma conta de dinheiro ou reserva para o pagamento.',
      );
    return a;
  }
  async create(input: SaveCardDto, key: string) {
    return this.receipts.execute('card.create', key, input, async () => {
      if (input.paymentAccountId) await this.ordinary(input.paymentAccountId);
      if (!input.name.trim()) throw new UnprocessableEntityException('Informe um nome.');
      await this.repo.lock();
      if ((await this.repo.snapshot()).cards.length >= 100)
        throw new ConflictException('Limite de 100 cartões por espaço.');
      const account = await this.managed.createManaged(input.name, 'credit_card');
      const card = {
        id: randomUUID(),
        accountId: account.id,
        ...input,
        paymentAccountId: input.paymentAccountId ?? null,
        name: input.name.trim(),
        archived: false,
        version: 1,
      };
      await this.repo.saveCard(card);
      return card;
    });
  }
  async update(id: string, input: SaveCardDto, version: string) {
    const initial = await this.card(id);
    await this.accounts.find(initial.accountId, true);
    await this.repo.lock();
    const card = await this.card(id);
    requireVersion(card.version, version);
    if (input.paymentAccountId) await this.ordinary(input.paymentAccountId);
    if (!input.name.trim()) throw new UnprocessableEntityException('Informe um nome.');
    if (input.archived && (await this.accounts.find(card.accountId)).balance !== 0)
      throw new ConflictException('Quite a dívida ou utilize o crédito antes de arquivar.');
    await this.repo.update({
      ...card,
      ...input,
      paymentAccountId: input.paymentAccountId ?? null,
      name: input.name.trim(),
    });
    return this.card(id);
  }
  private async ensureBill(card: CreditCard, month: string) {
    validCardMonth(month);
    const existing = (await this.repo.snapshot()).bills.find(
      (b) => b.cardId === card.id && b.month === month,
    );
    if (existing) return existing;
    const bill = {
      id: randomUUID(),
      cardId: card.id,
      month,
      ...billCalendar(month, card.closingDay, card.dueDay),
    };
    await this.repo.saveBill(bill);
    return bill;
  }
  private async lockedCard(id: string, version: string) {
    const initial = await this.card(id);
    await this.accounts.find(initial.accountId, true);
    await this.repo.lock();
    const card = await this.card(id);
    requireVersion(card.version, version);
    if (card.archived)
      throw new ConflictException('Reative o cartão antes de registrar novos movimentos.');
    return card;
  }
  async purchase(id: string, input: CardPurchaseDto, version: string, key: string) {
    return this.receipts.execute('card.purchase', key, { id, input, version }, async () => {
      const card = await this.lockedCard(id, version);
      dateOnly(input.purchaseDate);
      if (input.purchaseDate > financeToday() || input.purchaseDate < '1900-01-01')
        throw new UnprocessableEntityException('Informe a data de uma compra já realizada.');
      if (!input.description.trim()) throw new UnprocessableEntityException('Informe a descrição.');
      if (input.categoryId) await this.categories.validate(input.categoryId, 'expense');
      const first = input.firstBillMonth
        ? validCardMonth(input.firstBillMonth)
        : firstBillMonth(input.purchaseDate, card.closingDay, card.dueDay);
      if (first < input.purchaseDate.slice(0, 7))
        throw new UnprocessableEntityException(
          'A primeira fatura não pode anteceder o mês da compra.',
        );
      const amounts = splitInstallments(input.amount, input.installments);
      shiftCardMonth(first, input.installments - 1);
      const purchase = {
        id: randomUUID(),
        cardId: id,
        categoryId: input.categoryId ?? null,
        description: input.description.trim(),
        purchaseDate: input.purchaseDate,
        amount: input.amount,
        installments: input.installments,
        firstBillMonth: first,
        canceled: false,
        version: 1,
      };
      await this.repo.savePurchase(purchase);
      for (let i = 0; i < amounts.length; i++) {
        const month = shiftCardMonth(first, i);
        const bill = await this.ensureBill(card, month);
        const description = `${purchase.description} · ${i + 1}/${amounts.length}`;
        const entry = await this.ledger.postManaged(
          {
            accountId: card.accountId,
            categoryId: purchase.categoryId,
            description,
            amount: -amounts[i],
            transactionDate: bill.dueDate,
            transactionType: 'expense',
          },
          'card',
        );
        await this.repo.saveEntry({
          id: randomUUID(),
          cardId: id,
          purchaseId: purchase.id,
          transactionId: entry.id,
          billMonth: month,
          kind: 'purchase',
          installmentNumber: i + 1,
          amount: -amounts[i],
          description,
        });
      }
      await this.repo.bump(id);
      return purchase;
    });
  }
  async opening(id: string, month: string, amount: number, version: string, key: string) {
    return this.receipts.execute('card.opening', key, { id, month, amount, version }, async () => {
      const card = await this.lockedCard(id, version);
      exactAmount(amount);
      if (amount <= 0) throw new UnprocessableEntityException('Informe o saldo devedor.');
      const bill = await this.ensureBill(card, month);
      const transaction = await this.ledger.postManaged(
        {
          accountId: card.accountId,
          description: 'Dívida anterior do cartão',
          amount: -amount,
          transactionDate: bill.dueDate,
          transactionType: 'transfer',
        },
        'card',
      );
      await this.repo.saveEntry({
        id: randomUUID(),
        cardId: id,
        purchaseId: null,
        transactionId: transaction.id,
        billMonth: month,
        kind: 'opening',
        installmentNumber: null,
        amount: -amount,
        description: 'Dívida anterior · sem despesa nova',
      });
      await this.repo.bump(id);
      return { id, month, amount };
    });
  }
  private async calculated() {
    const data = await this.repo.snapshot();
    const ids = [
      ...data.entries.flatMap((e) => (e.transactionId ? [e.transactionId] : [])),
      ...data.payments.flatMap((p) => [p.debitId, p.creditId].filter((v): v is string => !!v)),
    ];
    const live = new Map((await this.ledger.managedEntries(ids)).map((e) => [e.id, e]));
    const accounts = new Map((await this.accounts.list()).map((a) => [a.id, a]));
    const cards = data.cards.map((card) => {
      const bills = data.bills
        .filter((b) => b.cardId === card.id)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const computed = bills.map((bill) => {
        const entries = data.entries
          .filter((e) => e.cardId === card.id && e.billMonth === bill.month)
          .map((e) => ({ ...e, active: !!e.transactionId && live.has(e.transactionId) }));
        const payments = data.payments
          .filter((p) => p.cardId === card.id && p.billMonth === bill.month)
          .map((p) => {
            const debit = p.debitId ? live.get(p.debitId) : null;
            const credit = p.creditId ? live.get(p.creditId) : null;
            const active =
              !p.voided &&
              !!debit &&
              !!credit &&
              debit.managedKind === 'card' &&
              credit.managedKind === 'card' &&
              credit.accountId === card.accountId &&
              debit.amount === -p.amount &&
              credit.amount === p.amount &&
              debit.transferGroupId !== null &&
              debit.transferGroupId === credit.transferGroupId;
            return { ...p, active };
          });
        const total = -sum(
          entries.filter((e) => e.active).map((e) => live.get(e.transactionId!)!.amount),
        );
        const paid = sum(payments.filter((p) => p.active).map((p) => p.amount));
        return {
          ...bill,
          total,
          paid,
          creditApplied: 0,
          remaining: total - paid,
          entries,
          payments,
          state: 'open' as string,
        };
      });
      let creditPool = -sum(computed.filter((b) => b.remaining < 0).map((b) => b.remaining));
      for (const bill of computed) {
        const owed = Math.max(0, bill.remaining);
        bill.creditApplied = Math.min(owed, creditPool);
        creditPool -= bill.creditApplied;
        bill.remaining = owed - bill.creditApplied;
        bill.state =
          bill.remaining === 0
            ? 'paid'
            : bill.dueDate < financeToday()
              ? 'overdue'
              : bill.closingDate <= financeToday()
                ? 'closed'
                : 'open';
      }
      const balance = accounts.get(card.accountId)?.balance ?? 0;
      return {
        ...card,
        balance,
        debt: Math.max(0, -balance),
        credit: Math.max(0, balance),
        availableLimit: Math.max(0, card.limit - Math.max(0, -balance)),
        limitExceeded: card.limit > 0 ? Math.max(0, -balance - card.limit) : 0,
        bills: computed,
      };
    });
    return { data, live, cards };
  }
  async summary(month?: string) {
    if (month) validCardMonth(month);
    const { cards, data } = await this.calculated();
    return {
      today: financeToday(),
      cards: cards.map((card) => ({
        ...card,
        selectedMonth: month ?? financeToday().slice(0, 7),
        purchases: data.purchases.filter((p) => p.cardId === card.id),
      })),
    };
  }
  async validateImportedPayment(id: string, month: string, accountId: string, amount: number) {
    await this.ordinary(accountId);
    const { cards } = await this.calculated();
    const card = cards.find((c) => c.id === id);
    const bill = card?.bills.find((b) => b.month === validCardMonth(month));
    if (!card || card.archived || !bill || amount >= 0 || -amount > bill.remaining)
      throw new UnprocessableEntityException(
        'Escolha uma fatura pendente compatível com este débito.',
      );
  }
  async linkImportedPayment(id: string, month: string, transactionId: string, key: string) {
    const source = (await this.ledger.managedEntries([transactionId]))[0];
    if (!source) throw new NotFoundException('Pagamento não encontrado.');
    const data = await this.repo.snapshot();
    const previous = data.payments.find((p) => p.debitId === transactionId && !p.voided);
    if (previous) {
      if (previous.cardId === id && previous.billMonth === month) return;
      throw new ConflictException('Este lançamento já está vinculado a outra fatura.');
    }
    const card = await this.card(id);
    await this.pay(
      id,
      month,
      {
        mode: 'link',
        accountId: source.accountId,
        date: source.transactionDate,
        amount: -source.amount,
        transactionId,
        transactionVersion: source.version,
      },
      String(card.version),
      key,
    );
  }
  async planningBills(month: string) {
    validCardMonth(month);
    const { cards } = await this.calculated();
    return cards.flatMap((card) =>
      card.bills
        .filter((b) => b.total > 0 || b.paid > 0 || b.remaining > 0)
        .map((b) => {
          const throughPaid = sum(
            b.payments
              .filter((p) => p.active && p.paymentDate.slice(0, 7) <= month)
              .map((p) => p.amount),
          );
          const paid = sum(
            b.payments
              .filter((p) => p.active && p.paymentDate.startsWith(month))
              .map((p) => p.amount),
          );
          const remaining = Math.max(0, b.total - b.creditApplied - throughPaid);
          return {
            cardId: card.id,
            accountId: card.accountId,
            name: card.name,
            billMonth: b.month,
            dueDate: b.dueDate,
            amount: remaining + paid,
            paid,
            remaining,
            version: card.version,
            archived: card.archived,
          };
        }),
    );
  }
  async payTransaction(
    id: string,
    month: string,
    input: CardTransactionPaymentDto,
    version: string,
    key: string,
  ) {
    return this.receipts.execute(
      'card.transaction-payment',
      key,
      { id, month, input, version },
      async () => {
        const card = await this.card(id);
        for (const accountId of [card.accountId, input.accountId].sort())
          await this.accounts.find(accountId, true);
        await this.ordinary(input.accountId);
        if (input.transactionId && !input.transactionVersion)
          throw new UnprocessableEntityException('Confira a versão do lançamento.');
        const original = input.transactionId
          ? (await this.ledger.managedEntries([input.transactionId]))[0]
          : undefined;
        const source = await this.ledger.saveCardPaymentSource(
          {
            accountId: input.accountId,
            amount: -input.amount,
            transactionDate: input.date,
            description: input.description,
            transactionType: 'expense',
            categoryId: null,
          },
          input.transactionId,
          input.transactionVersion,
        );
        const payment = await this.pay(
          id,
          month,
          {
            mode: 'link',
            accountId: input.accountId,
            date: input.date,
            amount: input.amount,
            transactionId: source.id,
            transactionVersion: source.version,
          },
          version,
          key,
        );
        if (original) {
          payment.originalDebit = {
            transactionType: original.transactionType,
            categoryId: original.categoryId,
          };
          await this.repo.savePaymentOrigin(payment.id, payment.originalDebit);
        }
        return payment;
      },
    );
  }
  async pendingBills(through: string) {
    const { cards } = await this.calculated();
    return cards.flatMap((card) =>
      card.bills
        .filter((b) => b.remaining > 0 && b.dueDate <= through)
        .map((b) => ({
          cardId: card.id,
          billMonth: b.month,
          accountId: card.paymentAccountId,
          description: `Fatura ${card.name} · ${b.month}`,
          dueDate: b.dueDate,
          amount: b.remaining,
        })),
    );
  }
  async candidates(id: string, accountId: string, from: string, to: string) {
    await this.card(id);
    await this.ordinary(accountId);
    dateOnly(from);
    dateOnly(to);
    if (from > to || new Date(to).getTime() - new Date(from).getTime() > 366 * 86400000)
      throw new UnprocessableEntityException('Escolha um período de até 366 dias.');
    return this.ledger.managedCandidates(accountId, from, to, 'expense');
  }
  async pay(id: string, month: string, input: CardPaymentDto, version: string, key: string) {
    return this.receipts.execute('card.payment', key, { id, month, input, version }, async () => {
      const initial = await this.card(id);
      for (const aid of [initial.accountId, input.accountId].sort())
        await this.accounts.find(aid, true);
      await this.repo.lock();
      const card = await this.card(id);
      requireVersion(card.version, version);
      await this.ordinary(input.accountId);
      dateOnly(input.date);
      if (input.date > financeToday())
        throw new UnprocessableEntityException('Registre apenas pagamentos realizados até hoje.');
      const { cards } = await this.calculated();
      const bill = cards
        .find((c) => c.id === id)!
        .bills.find((b) => b.month === validCardMonth(month));
      if (!bill || input.amount > bill.remaining || input.amount <= 0)
        throw new ConflictException(
          'O pagamento deve ser positivo e não superar o valor pendente da fatura.',
        );
      if ((input.mode === 'link') !== !!input.transactionId)
        throw new UnprocessableEntityException(
          'Confira o modo de pagamento e o lançamento escolhido.',
        );
      const original =
        input.mode === 'link' && input.transactionId
          ? (await this.ledger.managedEntries([input.transactionId]))[0]
          : undefined;
      const originalDebit = original
        ? { transactionType: original.transactionType, categoryId: original.categoryId }
        : null;
      const paymentId = randomUUID();
      const pair = await this.ledger.transferManaged({
        fromAccountId: input.accountId,
        toAccountId: card.accountId,
        amount: input.amount,
        date: input.date,
        description: `Pagamento da fatura ${card.name} · ${month}`,
        kind: 'card',
        existingDebitId: input.transactionId,
        existingVersion: input.transactionVersion,
        ownerKey: paymentId,
      });
      const payment = {
        originalDebit,
        id: paymentId,
        cardId: id,
        billMonth: month,
        ...pair,
        amount: input.amount,
        paymentDate: input.date,
        mode: input.mode,
        voided: false,
        version: 1,
      };
      await this.repo.savePayment(payment);
      await this.repo.bump(id);
      return payment;
    });
  }
  async undoPayment(id: string, paymentId: string, version: string, key: string) {
    return this.receipts.execute('card.payment.undo', key, { id, paymentId, version }, async () => {
      const state = await this.repo.snapshot();
      const payment = state.payments.find(
        (p) => p.id === paymentId && p.cardId === id && !p.voided,
      );
      if (!payment || !payment.debitId || !payment.creditId)
        throw new NotFoundException('Pagamento não encontrado.');
      const entries = await this.ledger.managedEntries([payment.debitId, payment.creditId]);
      for (const aid of [...new Set(entries.map((e) => e.accountId))].sort())
        await this.accounts.find(aid, true);
      await this.repo.lock();
      requireVersion((await this.card(id)).version, version);
      const current = (await this.repo.snapshot()).payments.find((p) => p.id === paymentId);
      if (!current || current.voided) throw new ConflictException('O pagamento já foi desfeito.');
      if (payment.mode === 'link')
        await this.ledger.detachManagedTransfer(
          payment.debitId,
          payment.creditId,
          payment.id,
          'card',
          'debit',
          payment.originalDebit,
        );
      else {
        const debit = entries.find((e) => e.id === payment.debitId);
        if (!debit) throw new ConflictException('O pagamento mudou.');
        await this.ledger.reverseManaged(debit.id, debit.version, 'card');
      }
      await this.repo.voidPayment(payment.id);
      await this.repo.bump(id);
      return { id: payment.id, mode: payment.mode };
    });
  }
  async cancelPurchase(id: string, purchaseId: string, version: string, key: string) {
    return this.receipts.execute(
      'card.purchase.cancel',
      key,
      { id, purchaseId, version },
      async () => {
        const card = await this.lockedCard(id, version);
        const { data, cards, live } = await this.calculated();
        const purchase = data.purchases.find(
          (p) => p.id === purchaseId && p.cardId === id && !p.canceled,
        );
        if (!purchase) throw new NotFoundException('Compra não encontrada.');
        const entries = data.entries.filter(
          (e) => e.purchaseId === purchaseId && e.kind === 'purchase',
        );
        if (
          cards
            .find((c) => c.id === id)!
            .bills.some((b) => b.paid > 0 && entries.some((e) => e.billMonth === b.month))
        )
          throw new ConflictException(
            'Há pagamentos nesta compra. Registre o estorno informado pelo emissor.',
          );
        for (const e of entries) {
          const entry = e.transactionId ? live.get(e.transactionId) : null;
          if (entry) await this.ledger.reverseManaged(entry.id, entry.version, 'card');
        }
        await this.repo.cancelPurchase(purchase.id);
        await this.repo.bump(card.id);
        return { id: purchase.id, status: 'canceled' };
      },
    );
  }
  async category(id: string, purchaseId: string, categoryId: string | null, version: string) {
    const card = await this.lockedCard(id, version);
    if (categoryId) await this.categories.validate(categoryId, 'expense');
    const data = await this.repo.snapshot();
    if (!data.purchases.some((p) => p.id === purchaseId && p.cardId === id && !p.canceled))
      throw new NotFoundException('Compra não encontrada.');
    await this.ledger.setManagedCategory(
      data.entries
        .filter((e) => e.purchaseId === purchaseId && e.kind === 'purchase')
        .flatMap((e) => (e.transactionId ? [e.transactionId] : [])),
      categoryId,
      'card',
    );
    await this.repo.category(purchaseId, categoryId);
    await this.repo.bump(card.id);
    return { id: purchaseId };
  }
  async refund(id: string, input: CardRefundDto, version: string, key: string) {
    return this.receipts.execute('card.refund', key, { id, input, version }, async () => {
      const card = await this.lockedCard(id, version);
      const data = await this.repo.snapshot();
      const original = data.entries.find(
        (e) =>
          e.id === input.entryId && e.cardId === id && e.kind === 'purchase' && e.transactionId,
      );
      if (!original) throw new NotFoundException('Parcela não encontrada.');
      const [entry] = await this.ledger.managedEntries([original.transactionId!]);
      if (!entry) throw new ConflictException('Esta parcela foi cancelada.');
      const bill = await this.ensureBill(card, input.billMonth);
      if (bill.dueDate < entry.transactionDate)
        throw new UnprocessableEntityException(
          'O estorno deve entrar na fatura original ou em uma posterior.',
        );
      const credit = await this.ledger.postManaged(
        {
          accountId: card.accountId,
          categoryId: entry.categoryId,
          description: `Estorno · ${original.description}`,
          amount: input.amount,
          transactionDate: bill.dueDate,
          transactionType: 'expense',
          refundOfId: entry.id,
        },
        'card',
      );
      await this.repo.saveEntry({
        id: randomUUID(),
        cardId: id,
        purchaseId: original.purchaseId,
        transactionId: credit.id,
        billMonth: bill.month,
        kind: 'refund',
        installmentNumber: null,
        amount: input.amount,
        description: `Estorno · ${original.description}`,
      });
      await this.repo.bump(id);
      return { id: credit.id };
    });
  }
  async cancelOpening(id: string, entryId: string, version: string, key: string) {
    return this.receipts.execute('card.opening.undo', key, { id, entryId, version }, async () => {
      await this.lockedCard(id, version);
      const { cards, data, live } = await this.calculated();
      const row = data.entries.find(
        (e) => e.id === entryId && e.cardId === id && e.kind === 'opening' && e.transactionId,
      );
      if (!row) throw new NotFoundException('Dívida anterior não encontrada.');
      const bill = cards.find((c) => c.id === id)!.bills.find((b) => b.month === row.billMonth)!;
      if (bill.paid > 0)
        throw new ConflictException('Revise os pagamentos antes de corrigir a dívida anterior.');
      const entry = live.get(row.transactionId!);
      if (!entry) throw new ConflictException('Este registro já foi desfeito.');
      await this.ledger.reverseManaged(entry.id, entry.version, 'card');
      await this.repo.bump(id);
      return { id: entryId };
    });
  }
  async cancelRefund(id: string, entryId: string, version: string, key: string) {
    return this.receipts.execute('card.refund.undo', key, { id, entryId, version }, async () => {
      await this.lockedCard(id, version);
      const row = (await this.repo.snapshot()).entries.find(
        (e) => e.id === entryId && e.cardId === id && e.kind === 'refund' && e.transactionId,
      );
      if (!row) throw new NotFoundException('Estorno não encontrado.');
      const [entry] = await this.ledger.managedEntries([row.transactionId!]);
      if (!entry) throw new ConflictException('Este estorno já foi desfeito.');
      await this.ledger.reverseManaged(entry.id, entry.version, 'card');
      await this.repo.bump(id);
      return { id: entryId };
    });
  }
  async exportManaged(): Promise<CardsSnapshot> {
    const { data, live } = await this.calculated();
    return {
      ...data,
      entries: data.entries.map((e) => ({
        ...e,
        transactionId: e.transactionId && live.has(e.transactionId) ? e.transactionId : null,
      })),
      payments: data.payments.map((p) => (p.voided ? { ...p, debitId: null, creditId: null } : p)),
    };
  }
  async restoreManaged(
    data: CardsSnapshot,
    accounts: Map<string, string>,
    categories: Map<string, string>,
    transactions: Map<string, string>,
  ) {
    await this.repo.lock();
    const cardIds = new Map(data.cards.map((c) => [c.id, randomUUID()]));
    const purchaseIds = new Map(data.purchases.map((p) => [p.id, randomUUID()]));
    for (const card of data.cards)
      await this.repo.saveCard({
        ...card,
        id: cardIds.get(card.id)!,
        accountId: accounts.get(card.accountId)!,
        paymentAccountId: card.paymentAccountId ? accounts.get(card.paymentAccountId)! : null,
        version: 1,
      });
    for (const bill of data.bills)
      await this.repo.saveBill({ ...bill, id: randomUUID(), cardId: cardIds.get(bill.cardId)! });
    for (const p of data.purchases)
      await this.repo.savePurchase({
        ...p,
        id: purchaseIds.get(p.id)!,
        cardId: cardIds.get(p.cardId)!,
        categoryId: p.categoryId ? categories.get(p.categoryId)! : null,
        version: 1,
      });
    for (const e of data.entries)
      await this.repo.saveEntry({
        ...e,
        id: randomUUID(),
        cardId: cardIds.get(e.cardId)!,
        purchaseId: e.purchaseId ? purchaseIds.get(e.purchaseId)! : null,
        transactionId: e.transactionId ? transactions.get(e.transactionId)! : null,
      });
    for (const p of data.payments) {
      const id = randomUUID();
      const debitId = p.debitId ? transactions.get(p.debitId)! : null;
      const creditId = p.creditId ? transactions.get(p.creditId)! : null;
      await this.repo.savePayment({
        ...p,
        id,
        cardId: cardIds.get(p.cardId)!,
        originalDebit: p.originalDebit
          ? {
              ...p.originalDebit,
              categoryId: p.originalDebit.categoryId
                ? (categories.get(p.originalDebit.categoryId) ?? null)
                : null,
            }
          : null,
        debitId,
        creditId,
        version: 1,
      });
      if (!p.voided && p.mode === 'link' && debitId)
        await this.ledger.claimEntry(debitId, 'card', id);
    }
  }
}
