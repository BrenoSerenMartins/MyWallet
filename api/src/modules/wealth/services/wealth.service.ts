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
  ACCOUNT_BALANCE_BASIS,
  MANAGED_ACCOUNTS,
  MANAGED_LEDGER,
  COMMAND_RECEIPTS,
  type AccountReads,
  type AccountBalanceBasis,
  type ManagedAccounts,
  type ManagedLedger,
  type CommandReceipts,
  type InvestmentHolding,
  type InvestmentEvent,
  type WealthSnapshot,
  type ManagedBackup,
} from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireVersion } from '../../../core/rest/index.js';
import type {
  CreateHoldingDto,
  UpdateHoldingDto,
  InvestmentOperationDto,
  SaveWealthItemDto,
} from '../dto/wealth.dto.js';
import { WealthRepository } from '../repositories/wealth.repository.js';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const sum = (values: number[]) => exactAmount(Number(values.reduce((a, b) => a + BigInt(b), 0n)));
@Injectable()
export class WealthService implements ManagedBackup<WealthSnapshot> {
  constructor(
    @Inject(WealthRepository) private readonly repo: WealthRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(MANAGED_ACCOUNTS) private readonly managed: ManagedAccounts,
    @Inject(MANAGED_LEDGER) private readonly ledger: ManagedLedger,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
    @Inject(ACCOUNT_BALANCE_BASIS) private readonly basis: AccountBalanceBasis,
  ) {}
  private date(date: string) {
    dateOnly(date);
    if (date < '1900-01-01' || date > today())
      throw new UnprocessableEntityException('Informe uma data válida até hoje.');
    return date;
  }
  private amount(value: number) {
    exactAmount(value);
    if (value < 0 || value > 1000000000000)
      throw new UnprocessableEntityException('Valor fora do intervalo.');
    return value;
  }
  private async holding(id: string) {
    const row = (await this.repo.snapshot()).holdings.find((r) => r.id === id);
    if (!row) throw new NotFoundException('Investimento não encontrado.');
    return row;
  }
  private async ordinary(id: string) {
    const a = await this.accounts.find(id);
    if (
      a.archived ||
      ['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type)
    )
      throw new UnprocessableEntityException('Escolha uma conta de dinheiro ou reserva.');
    return a;
  }
  async create(input: CreateHoldingDto, key: string) {
    return this.receipts.execute('investment.create', key, input, async () => {
      this.date(input.valuationDate);
      if (!input.name.trim()) throw new UnprocessableEntityException('Informe um nome.');
      await this.repo.lock();
      if ((await this.repo.snapshot()).holdings.length >= 500)
        throw new ConflictException('Limite de 500 posições por espaço.');
      const account = await this.managed.createManaged(input.name, 'investment', input.capital);
      const row: InvestmentHolding = {
        id: randomUUID(),
        accountId: account.id,
        ...input,
        name: input.name.trim(),
        provider: input.provider.trim(),
        openedDate: input.valuationDate,
        valuationMethod: 'manual',
        lastEventId: null,
        archived: false,
        version: 1,
      };
      await this.repo.saveHolding(row);
      return row;
    });
  }
  private async lockHolding(id: string, version: string, bankId?: string) {
    const initial = await this.holding(id);
    for (const aid of [...new Set([initial.accountId, ...(bankId ? [bankId] : [])])].sort())
      await this.accounts.find(aid, true);
    await this.repo.lock();
    const row = await this.holding(id);
    requireVersion(row.version, version);
    return row;
  }
  private event(
    before: InvestmentHolding,
    kind: InvestmentEvent['kind'],
    date: string,
  ): InvestmentEvent {
    return {
      id: randomUUID(),
      holdingId: before.id,
      kind,
      eventDate: date,
      amount: 0,
      capitalRemoved: 0,
      beforeState: before,
      details: {},
      debitId: null,
      creditId: null,
      resultId: null,
      linkedId: null,
      undone: false,
      undoOfId: null,
      createdAt: new Date().toISOString(),
    };
  }
  private async record(before: InvestmentHolding, next: InvestmentHolding, event: InvestmentEvent) {
    await this.repo.saveEvent(event);
    await this.repo.updateHolding({ ...next, lastEventId: event.id });
    return this.holding(before.id);
  }
  async update(id: string, input: UpdateHoldingDto, version: string) {
    const current = await this.lockHolding(id, version);
    if (!input.name.trim()) throw new UnprocessableEntityException('Informe um nome.');
    if (input.archived && (current.capital !== 0 || current.marketValue !== 0))
      throw new ConflictException('Zere a posição antes de arquivar.');
    const event = this.event(current, 'edit', today());
    event.details = {
      name: input.name,
      provider: input.provider,
      productType: input.productType,
      archived: input.archived,
    };
    return this.record(
      current,
      { ...current, ...input, name: input.name.trim(), provider: input.provider.trim() },
      event,
    );
  }
  async candidates(
    id: string,
    accountId: string,
    from: string,
    to: string,
    direction: 'income' | 'expense',
  ) {
    await this.holding(id);
    await this.ordinary(accountId);
    dateOnly(from);
    dateOnly(to);
    if (from > to || new Date(to).getTime() - new Date(from).getTime() > 366 * 86400000)
      throw new UnprocessableEntityException('Escolha até 366 dias para buscar.');
    return this.ledger.managedCandidates(accountId, from, to, direction);
  }
  private async bookCapital(accountId: string, target: number, reason: string) {
    const account = await this.accounts.find(accountId);
    if (account.balance !== target)
      await this.basis.correct(accountId, {
        expectedBalance: account.balance,
        targetBalance: target,
        expectedVersion: account.version,
        reason,
      });
  }
  async operate(id: string, input: InvestmentOperationDto, version: string, key: string) {
    return this.receipts.execute('investment.operation', key, { id, input, version }, async () => {
      const current = await this.lockHolding(id, version, input.accountId);
      if (current.archived)
        throw new ConflictException('Reative esta posição antes de movimentar.');
      this.date(input.date);
      const latestMovement =
        (await this.repo.snapshot()).events
          .filter(
            (e) =>
              e.holdingId === id &&
              !e.undone &&
              ['contribution', 'redemption', 'capital'].includes(e.kind),
          )
          .map((e) => e.eventDate)
          .sort()
          .at(-1) ?? current.openedDate;
      const historical = !!input.includedInPosition;
      if (
        historical &&
        (!['contribution', 'redemption'].includes(input.kind) ||
          !input.transactionId ||
          input.date > current.valuationDate)
      )
        throw new UnprocessableEntityException(
          'O vínculo já incluído na posição exige aporte ou resgate do extrato anterior à avaliação.',
        );
      if (
        !historical &&
        input.kind !== 'income' &&
        input.date < [current.valuationDate, latestMovement].sort().at(-1)!
      )
        throw new ConflictException(
          'Registre a movimentação na data da última avaliação ou depois dela. Corrija o histórico antes de substituir uma avaliação mais recente.',
        );
      if (!input.includedInPosition && input.kind !== 'income' && input.date < current.openedDate)
        throw new UnprocessableEntityException('A movimentação antecede a posição cadastrada.');
      const event = this.event(current, input.kind, input.date);
      const next = { ...current };
      event.details = {
        reason: input.reason ?? '',
        includedInPosition: !!input.includedInPosition,
      };
      if (input.kind === 'valuation') {
        if (input.marketValue === undefined)
          throw new UnprocessableEntityException('Informe o valor total atualizado.');
        next.marketValue = this.amount(input.marketValue);
        next.valuationDate = input.date;
        next.valuationMethod = 'manual';
        event.details = { ...event.details, marketValue: next.marketValue };
      } else if (input.kind === 'capital') {
        if (input.capital === undefined || !input.reason?.trim())
          throw new UnprocessableEntityException('Informe o capital correto e o motivo.');
        next.capital = this.amount(input.capital);
        await this.bookCapital(
          current.accountId,
          next.capital,
          `Correção de capital · ${current.name}: ${input.reason}`,
        );
        event.details = { ...event.details, capital: next.capital };
      } else {
        const amount = this.amount(input.amount ?? 0);
        if ((input.kind !== 'redemption' && amount === 0) || !input.accountId)
          throw new UnprocessableEntityException('Informe a conta e o valor realizado.');
        await this.ordinary(input.accountId);
        event.amount = amount;
        if (input.kind === 'income') {
          if (input.transactionId) {
            const [entry] = await this.ledger.managedEntries([input.transactionId]);
            if (
              !entry ||
              entry.accountId !== input.accountId ||
              entry.amount !== amount ||
              entry.transactionDate !== input.date ||
              entry.transactionType !== 'income'
            )
              throw new ConflictException('Escolha o recebimento da mesma conta, data e valor.');
            await this.ledger.tagManagedIncome(entry.id, input.transactionVersion ?? 0, event.id);
            event.linkedId = entry.id;
          } else
            event.resultId = (
              await this.ledger.postManaged(
                {
                  accountId: input.accountId,
                  categoryId: input.categoryId ?? null,
                  description: `Rendimento recebido · ${current.name}`,
                  amount,
                  transactionDate: input.date,
                  transactionType: 'income',
                },
                'investment',
              )
            ).id;
        } else {
          const contribution = input.kind === 'contribution';
          const removed = contribution ? 0 : this.amount(input.capitalRemoved ?? -1);
          if (
            (!input.includedInPosition && removed > current.capital) ||
            (!contribution && amount === 0 && removed === 0)
          )
            throw new UnprocessableEntityException(
              'Confira o capital resgatado. Ele não pode superar o capital registrado.',
            );
          event.capitalRemoved = removed;
          if (amount > 0) {
            const pair = await this.ledger.transferManaged({
              fromAccountId: contribution ? input.accountId : current.accountId,
              toAccountId: contribution ? current.accountId : input.accountId,
              amount,
              date: input.date,
              description: `${contribution ? 'Aporte' : 'Resgate'} · ${current.name}`,
              kind: 'investment',
              ...(input.transactionId
                ? contribution
                  ? {
                      existingDebitId: input.transactionId,
                      existingVersion: input.transactionVersion,
                    }
                  : {
                      existingCreditId: input.transactionId,
                      existingCreditVersion: input.transactionVersion,
                    }
                : {}),
              ownerKey: event.id,
            });
            event.debitId = pair.debitId;
            event.creditId = pair.creditId;
            if (input.transactionId) event.linkedId = input.transactionId;
          }
          const gain = contribution ? 0 : amount - removed;
          if (gain !== 0)
            event.resultId = (
              await this.ledger.postManaged(
                {
                  accountId: current.accountId,
                  categoryId: input.categoryId ?? null,
                  description: `${gain > 0 ? 'Ganho' : 'Perda'} no resgate · ${current.name}`,
                  amount: gain,
                  transactionDate: input.date,
                  transactionType: gain > 0 ? 'income' : 'expense',
                },
                'investment',
              )
            ).id;
          if (input.includedInPosition) {
            await this.bookCapital(
              current.accountId,
              current.capital,
              `Vínculo histórico já incluído · ${current.name}`,
            );
          } else {
            next.capital = this.amount(current.capital + (contribution ? amount : -removed));
            next.marketValue = this.amount(
              input.marketValue ?? current.marketValue + (contribution ? amount : -amount),
            );
            next.valuationDate = input.date;
            next.valuationMethod = input.marketValue === undefined ? 'flow_estimate' : 'manual';
          }
          event.details = {
            ...event.details,
            realizedGain: gain,
            marketValue: next.marketValue,
            valuationMethod: next.valuationMethod,
          };
        }
      }
      return this.record(current, next, event);
    });
  }
  async undo(id: string, version: string, key: string) {
    return this.receipts.execute('investment.undo', key, { id, version }, async () => {
      const initial = await this.holding(id);
      const state = await this.repo.snapshot();
      const event = state.events.find(
        (e) => e.id === initial.lastEventId && e.holdingId === id && !e.undone,
      );
      if (!event) throw new ConflictException('Não há movimentação para desfazer.');
      const ids = [event.debitId, event.creditId, event.resultId, event.linkedId].filter(
        (v): v is string => !!v,
      );
      const entries = await this.ledger.managedEntries(ids);
      for (const aid of [
        ...new Set([initial.accountId, ...entries.map((e) => e.accountId)]),
      ].sort())
        await this.accounts.find(aid, true);
      await this.repo.lock();
      const current = await this.holding(id);
      requireVersion(current.version, version);
      if (current.lastEventId !== event.id)
        throw new ConflictException('O histórico mudou. Atualize antes de desfazer.');
      if (event.kind === 'income' && event.linkedId)
        await this.ledger.untagManagedIncome(event.linkedId, event.id);
      else if (event.debitId && event.creditId) {
        if (event.linkedId)
          await this.ledger.detachManagedTransfer(
            event.debitId,
            event.creditId,
            event.id,
            'investment',
            event.linkedId === event.debitId ? 'debit' : 'credit',
          );
        else {
          const debit = entries.find((e) => e.id === event.debitId);
          if (!debit) throw new ConflictException('A transferência foi alterada.');
          await this.ledger.reverseManaged(debit.id, debit.version, 'investment');
        }
      }
      if (event.resultId) {
        const result = entries.find((e) => e.id === event.resultId);
        if (result) await this.ledger.reverseManaged(result.id, result.version, 'investment');
      }
      const before = { ...event.beforeState, id: current.id, accountId: current.accountId };
      if (event.kind === 'capital' || event.details.includedInPosition === true)
        await this.bookCapital(
          current.accountId,
          before.capital,
          `Desfazer correção de capital · ${current.name}`,
        );
      await this.repo.markUndone(event.id);
      const audit = this.event(current, 'undo', today());
      audit.undoOfId = event.id;
      audit.details = { preservedBankMovement: !!event.linkedId };
      await this.repo.saveEvent(audit);
      await this.repo.updateHolding(before);
      return { holding: await this.holding(id), preservedBankMovement: !!event.linkedId };
    });
  }
  async saveItem(input: SaveWealthItemDto, id?: string, version?: string, key?: string) {
    return this.receipts.execute('wealth.item', key ?? '', { id, input, version }, async () => {
      this.date(input.valuationDate);
      if (!input.name.trim()) throw new UnprocessableEntityException('Informe um nome.');
      await this.repo.lock();
      const state = await this.repo.snapshot();
      const before = id ? state.items.find((i) => i.id === id) : null;
      if (id && !before) throw new NotFoundException('Bem ou dívida não encontrado.');
      if (before) {
        requireVersion(before.version, version);
        if (before.kind !== input.kind)
          throw new ConflictException('O tipo do cadastro deve ser preservado.');
      }
      if (!before && state.items.length >= 1000)
        throw new ConflictException('Limite de 1.000 bens e dívidas.');
      const row = {
        id: id ?? randomUUID(),
        ...input,
        name: input.name.trim(),
        archived: input.archived ?? false,
        version: before?.version ?? 1,
      };
      if (before) await this.repo.updateItem(row);
      else await this.repo.saveItem(row);
      await this.repo.saveHistory({
        id: randomUUID(),
        kind: 'item_change',
        data: { itemId: row.id, before: before ?? null, after: row },
        createdAt: new Date().toISOString(),
      });
      return { ...row, version: before ? before.version + 1 : 1 };
    });
  }
  async summary() {
    const data = await this.repo.snapshot();
    const accounts = await this.accounts.list();
    const incomeEntries = new Map(
      (
        await this.ledger.managedEntries(
          data.events
            .filter((e) => e.kind === 'income' && !e.undone)
            .flatMap((e) => (e.linkedId ? [e.linkedId] : e.resultId ? [e.resultId] : [])),
        )
      ).map((e) => [e.id, e]),
    );
    const netIncome = (e: InvestmentEvent) => {
      const entry = incomeEntries.get(e.linkedId ?? e.resultId ?? '');
      return entry ? Math.max(0, e.amount - (entry.refundedAmount ?? 0)) : 0;
    };
    const holdings = data.holdings.map((h) => {
      const events = data.events.filter((e) => e.holdingId === h.id && !e.undone);
      const realized = sum(
        events.map((e) =>
          e.kind === 'income'
            ? netIncome(e)
            : e.kind === 'redemption'
              ? e.amount - e.capitalRemoved
              : 0,
        ),
      );
      return {
        ...h,
        movementFromDate: [
          h.valuationDate,
          ...events
            .filter((e) => ['contribution', 'redemption', 'capital'].includes(e.kind))
            .map((e) => e.eventDate),
        ]
          .sort()
          .at(-1)!,
        unrealized: sum([h.marketValue, -h.capital]),
        realized,
        totalResult: sum([h.marketValue, -h.capital, realized]),
        stale:
          h.valuationMethod === 'flow_estimate' ||
          today() >
            new Date(new Date(`${h.valuationDate}T12:00:00Z`).getTime() + 30 * 86400000)
              .toISOString()
              .slice(0, 10),
        events: data.events
          .filter((e) => e.holdingId === h.id)
          .map((e) => ({
            ...e,
            ...(e.kind === 'income' && !e.undone ? { effectiveAmount: netIncome(e) } : {}),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
      };
    });
    const regular = accounts.filter(
      (a) => !['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type),
    );
    const cash = sum(
      regular.filter((a) => a.type !== 'reserve' && a.balance > 0).map((a) => a.balance),
    );
    const reserves = sum(
      regular.filter((a) => a.type === 'reserve' && a.balance > 0).map((a) => a.balance),
    );
    const overdrafts = Math.max(
      0,
      -sum(regular.filter((a) => a.balance < 0).map((a) => a.balance)),
    );
    const cards = accounts.filter((a) => a.type === 'credit_card');
    const cardDebt = Math.max(0, -sum(cards.filter((a) => a.balance < 0).map((a) => a.balance)));
    const cardCredit = sum(cards.filter((a) => a.balance > 0).map((a) => a.balance));
    const investments = sum(holdings.filter((h) => !h.archived).map((h) => h.marketValue));
    const otherAssets = sum(
      data.items.filter((i) => i.kind === 'asset' && !i.archived).map((i) => i.value),
    );
    const otherDebts = sum(
      data.items.filter((i) => i.kind === 'debt' && !i.archived).map((i) => i.value),
    );
    const assets = sum([cash, reserves, investments, otherAssets, cardCredit]);
    const liabilities = sum([cardDebt, overdrafts, otherDebts]);
    const dailySnapshots = new Map<string, (typeof data.history)[number]>();
    for (const snapshot of data.history
      .filter((h) => h.kind === 'snapshot')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const day = String(snapshot.data.asOf);
      if (!dailySnapshots.has(day)) dailySnapshots.set(day, snapshot);
    }
    const benefitsExcluded = sum(
      accounts.filter((a) => a.type.startsWith('benefit_')).map((a) => a.balance),
    );
    return {
      asOf: today(),
      assets,
      liabilities,
      netWorth: sum([assets, -liabilities]),
      cash,
      reserves,
      investments,
      otherAssets,
      cardCredit,
      cardDebt,
      overdrafts,
      otherDebts,
      benefitsExcluded,
      holdings,
      items: data.items,
      history: [...dailySnapshots.values()].slice(0, 400),
    };
  }
  async capture(key: string) {
    return this.receipts.execute('wealth.capture', key, {}, async () => {
      await this.repo.lock();
      const s = await this.summary();
      const { holdings: _h, items: _i, history: _history, ...data } = s;
      const row = {
        id: randomUUID(),
        kind: 'snapshot' as const,
        data,
        createdAt: new Date().toISOString(),
      };
      await this.repo.saveHistory(row);
      return row;
    });
  }
  async exportManaged(): Promise<WealthSnapshot> {
    const data = await this.repo.snapshot();
    const live = new Set(
      (
        await this.ledger.managedEntries(
          data.events.flatMap((e) =>
            [e.debitId, e.creditId, e.resultId, e.linkedId].filter((v): v is string => !!v),
          ),
        )
      ).map((e) => e.id),
    );
    return {
      ...data,
      events: data.events.map((e) => ({
        ...e,
        debitId: e.debitId && live.has(e.debitId) ? e.debitId : null,
        creditId: e.creditId && live.has(e.creditId) ? e.creditId : null,
        resultId: e.resultId && live.has(e.resultId) ? e.resultId : null,
        linkedId: e.linkedId && live.has(e.linkedId) ? e.linkedId : null,
      })),
    };
  }
  async restoreManaged(
    data: WealthSnapshot,
    accounts: Map<string, string>,
    _categories: Map<string, string>,
    transactions: Map<string, string>,
  ) {
    await this.repo.lock();
    const holdingIds = new Map(data.holdings.map((h) => [h.id, randomUUID()]));
    const eventIds = new Map(data.events.map((e) => [e.id, randomUUID()]));
    const itemIds = new Map(data.items.map((i) => [i.id, randomUUID()]));
    const mapHolding = (h: InvestmentHolding) => ({
      ...h,
      id: holdingIds.get(h.id)!,
      accountId: accounts.get(h.accountId)!,
      lastEventId: h.lastEventId ? eventIds.get(h.lastEventId)! : null,
    });
    const tx = (id: string | null) => (id ? transactions.get(id)! : null);
    for (const h of data.holdings) await this.repo.saveHolding({ ...mapHolding(h), version: 1 });
    for (const event of data.events) {
      const id = eventIds.get(event.id)!;
      const linkedId = tx(event.linkedId);
      const restored = {
        ...event,
        id,
        holdingId: holdingIds.get(event.holdingId)!,
        beforeState: mapHolding(event.beforeState),
        debitId: tx(event.debitId),
        creditId: tx(event.creditId),
        resultId: tx(event.resultId),
        linkedId,
        undoOfId: event.undoOfId ? eventIds.get(event.undoOfId)! : null,
      };
      await this.repo.saveEvent(restored);
      if (!event.undone && event.kind !== 'undo' && linkedId)
        await this.ledger.claimEntry(linkedId, 'investment', id);
    }
    for (const i of data.items)
      await this.repo.saveItem({ ...i, id: itemIds.get(i.id)!, version: 1 });
    for (const h of data.history) {
      const details = { ...h.data };
      if (h.kind === 'item_change') {
        details.itemId = itemIds.get(String(details.itemId));
        for (const field of ['before', 'after'])
          if (details[field] && typeof details[field] === 'object')
            details[field] = {
              ...(details[field] as Record<string, unknown>),
              id: itemIds.get(String(details.itemId)) ?? details.itemId,
            };
      }
      await this.repo.saveHistory({ ...h, id: randomUUID(), data: details });
    }
  }
}
