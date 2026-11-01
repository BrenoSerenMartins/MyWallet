import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ACCOUNT_READS,
  CATEGORY_READS,
  LEDGER_WRITES,
  COMMITMENT_LEDGER,
  COMMAND_RECEIPTS,
  type AccountReads,
  type CategoryReads,
  type LedgerWrites,
  type CommitmentLedger,
  type CommandReceipts,
  type CommitmentSchedule,
  type CommitmentRecord,
  type CommitmentSnapshot,
  type CommitmentsBackup,
} from '../../../core/integration/index.js';
import { dateOnly, requireVersion } from '../../../core/rest/index.js';
import { CommitmentsRepository } from '../repositories/commitments.repository.js';
import type { SaveCommitmentDto, SettleCommitmentDto } from '../dto/commitments.dto.js';
import { commitmentToday, dueDates, monthEnd, sumAmounts } from './commitment-calendar.js';
export type CommitmentOccurrence = CommitmentRecord['snapshot'] & {
  scheduleId: string;
  dueDate: string;
  status: 'pending' | 'overdue' | 'settled' | 'skipped' | 'review';
  transactionId: string | null;
  version: number;
  actualAmount: number | null;
};
@Injectable()
export class CommitmentsService implements CommitmentsBackup {
  constructor(
    @Inject(CommitmentsRepository) private readonly repository: CommitmentsRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(LEDGER_WRITES) private readonly ledger: LedgerWrites,
    @Inject(COMMITMENT_LEDGER) private readonly entries: CommitmentLedger,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
  ) {}
  private async validate(input: SaveCommitmentDto) {
    dateOnly(input.startDate);
    if (input.startDate < '1900-01-01' || input.startDate > '9998-12-31')
      throw new UnprocessableEntityException('Data fora do intervalo.');
    if (input.endDate) {
      dateOnly(input.endDate);
      if (input.endDate < input.startDate || input.endDate > '9998-12-31')
        throw new UnprocessableEntityException(
          'O término deve ser igual ou posterior ao primeiro vencimento.',
        );
    }
    if (!input.description.trim()) throw new UnprocessableEntityException('Informe uma descrição.');
    if ((await this.accounts.find(input.accountId)).archived)
      throw new UnprocessableEntityException('Escolha uma conta ativa.');
    if (input.categoryId) await this.categories.validate(input.categoryId, input.transactionType);
  }
  async create(input: SaveCommitmentDto, key: string) {
    return this.receipts.execute('commitment.create', key, input, async () => {
      await this.validate(input);
      await this.repository.lock();
      if ((await this.repository.schedules()).length >= 200)
        throw new UnprocessableEntityException('O limite é de 200 compromissos por espaço.');
      const id = await this.repository.create(input);
      return this.find(id);
    });
  }
  private async find(id: string) {
    const row = (await this.repository.schedules()).find((r) => r.id === id);
    if (!row) throw new NotFoundException('Compromisso não encontrado.');
    return row;
  }
  async update(id: string, input: SaveCommitmentDto, version: string) {
    await this.validate(input);
    await this.repository.lock();
    const row = await this.find(id);
    requireVersion(row.version, version);
    if (row.endedOn) throw new ConflictException('Esta recorrência já foi encerrada.');
    if (
      ['accountId', 'transactionType', 'frequency', 'startDate'].some(
        (key) => row[key as keyof CommitmentSchedule] !== input[key as keyof SaveCommitmentDto],
      )
    )
      throw new ConflictException(
        'Preserve a conta, o tipo e o primeiro vencimento. Encerre esta série para criar outra.',
      );
    await this.repository.update(id, input);
    return this.find(id);
  }
  async end(id: string, version: string) {
    await this.repository.lock();
    const row = await this.find(id);
    requireVersion(row.version, version);
    if (!row.endedOn) await this.repository.end(id, commitmentToday());
    return this.find(id);
  }
  private async occurrences(through: string) {
    const schedules = await this.repository.schedules();
    const records = await this.repository.records();
    const transactions = await this.entries.commitmentEntries(
      records.flatMap((r) => (r.transactionId ? [r.transactionId] : [])),
    );
    const entries = new Map(transactions.map((t) => [t.id, t]));
    const result = new Map<string, CommitmentOccurrence>();
    const today = commitmentToday();
    for (const rule of schedules)
      for (const date of dueDates(rule, through)) {
        result.set(`${rule.id}:${date}`, {
          ...this.snapshot(rule),
          scheduleId: rule.id,
          dueDate: date,
          status: date < today ? 'overdue' : 'pending',
          transactionId: null,
          version: rule.version,
          actualAmount: null,
        });
      }
    for (const record of records) {
      if (record.dueDate > through) continue;
      const rule = schedules.find((r) => r.id === record.scheduleId)!;
      const entry = record.transactionId ? entries.get(record.transactionId) : null;
      const valid =
        entry &&
        entry.accountId === record.snapshot.accountId &&
        entry.transactionType === record.snapshot.transactionType &&
        entry.transactionDate <= today &&
        Math.sign(entry.amount) === (record.snapshot.transactionType === 'income' ? 1 : -1);
      result.set(`${record.scheduleId}:${record.dueDate}`, {
        ...record.snapshot,
        scheduleId: record.scheduleId,
        dueDate: record.dueDate,
        status: record.status === 'settled' && !valid ? 'review' : record.status,
        transactionId: record.transactionId,
        version: rule.version,
        actualAmount: valid ? Math.abs(entry.amount) : null,
      });
    }
    return {
      schedules,
      items: [...result.values()].sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) ||
          a.description.localeCompare(b.description) ||
          a.scheduleId.localeCompare(b.scheduleId),
      ),
    };
  }
  async summary(month: string) {
    const today = commitmentToday();
    const end = monthEnd(month);
    const through = end < today ? monthEnd(today.slice(0, 7)) : end;
    if (
      Number(through.slice(0, 4)) * 12 +
        Number(through.slice(5, 7)) -
        (Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7))) >
      12
    )
      throw new UnprocessableEntityException('A previsão pode alcançar até 12 meses à frente.');
    const { schedules, items } = await this.occurrences(through);
    const outstanding = items.filter((r) => ['pending', 'overdue', 'review'].includes(r.status));
    const accounts = await this.accounts.list();
    const projection = accounts
      .filter((a) => !a.archived)
      .map((account) => {
        const due = outstanding.filter((r) => r.accountId === account.id);
        const income = sumAmounts(
          due.filter((r) => r.transactionType === 'income').map((r) => r.amount),
        );
        const expense = sumAmounts(
          due.filter((r) => r.transactionType === 'expense').map((r) => r.amount),
        );
        return {
          accountId: account.id,
          name: account.name,
          kind: ['benefit_food', 'benefit_meal'].includes(account.type)
            ? 'benefits'
            : account.type === 'reserve'
              ? 'reserves'
              : 'cash',
          balance: account.balance,
          income,
          expense,
          projected: sumAmounts([account.balance, income, -expense]),
          overdue: due.filter((r) => r.dueDate < today).length,
        };
      });
    const visible = items.filter(
      (r) =>
        r.dueDate.startsWith(month) ||
        (r.dueDate < today && ['overdue', 'review'].includes(r.status)),
    );
    return {
      today,
      month,
      through,
      schedules,
      items: visible.slice(0, 1000),
      totalItems: visible.length,
      projection,
      overdueCount: outstanding.filter((r) => r.dueDate < today).length,
      overdueIncome: sumAmounts(
        outstanding
          .filter((r) => r.dueDate < today && r.transactionType === 'income')
          .map((r) => r.amount),
      ),
      overdueExpense: sumAmounts(
        outstanding
          .filter((r) => r.dueDate < today && r.transactionType === 'expense')
          .map((r) => r.amount),
      ),
    };
  }
  private snapshot(rule: CommitmentSchedule) {
    return {
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      description: rule.description,
      amount: rule.amount,
      transactionType: rule.transactionType,
    };
  }
  private async occurrence(id: string, date: string) {
    dateOnly(date);
    const rule = await this.find(id);
    const record = (await this.repository.records()).find(
      (r) => r.scheduleId === id && r.dueDate === date,
    );
    if (!record && !dueDates(rule, date).includes(date))
      throw new NotFoundException('Vencimento não encontrado.');
    return { rule, record };
  }
  async candidates(id: string, date: string, from?: string, to?: string) {
    const { rule, record } = await this.occurrence(id, date);
    const snap = record?.snapshot ?? this.snapshot(rule);
    const shift = (offset: number) =>
      new Date(new Date(`${date}T12:00:00Z`).getTime() + offset * 86400000)
        .toISOString()
        .slice(0, 10);
    from = from ?? shift(-7);
    to = to ?? shift(7);
    dateOnly(from);
    dateOnly(to);
    if (
      from > to ||
      new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime() >
        366 * 86400000
    )
      throw new UnprocessableEntityException('Busque um período de até 366 dias.');
    const used = new Set(
      (await this.repository.records()).flatMap((r) => (r.transactionId ? [r.transactionId] : [])),
    );
    return (await this.entries.commitmentCandidates(snap.accountId, from, to)).filter(
      (t) =>
        !used.has(t.id) &&
        t.transactionType === snap.transactionType &&
        t.transactionDate <= commitmentToday(),
    );
  }
  async resolve(
    id: string,
    date: string,
    input: SettleCommitmentDto,
    version: string,
    key: string,
  ) {
    return this.receipts.execute(
      'commitment.resolve',
      key,
      { id, date, input, version },
      async () => {
        const initial = await this.find(id);
        await this.accounts.find(initial.accountId, true);
        await this.repository.lock();
        const { rule, record } = await this.occurrence(id, date);
        requireVersion(rule.version, version);
        const snap = record?.snapshot ?? this.snapshot(rule);
        if (input.action === 'reopen') {
          if (!record) throw new ConflictException('Este vencimento já está pendente.');
          await this.repository.reopen(id, date);
          return { id, date, status: 'pending', transactionId: record.transactionId };
        }
        if (record) throw new ConflictException('Reabra o vencimento antes de mudar a conclusão.');
        if (input.action === 'skip') {
          await this.repository.record({
            scheduleId: id,
            dueDate: date,
            status: 'skipped',
            transactionId: null,
            snapshot: snap,
          });
          return { id, date, status: 'skipped', transactionId: null };
        }
        const today = commitmentToday();
        let transactionId = input.transactionId;
        if (input.action === 'link') {
          const [entry] = await this.entries.commitmentEntries(
            transactionId ? [transactionId] : [],
          );
          if (
            !entry ||
            entry.accountId !== snap.accountId ||
            entry.transactionType !== snap.transactionType ||
            entry.transactionDate > today ||
            Math.sign(entry.amount) !== (snap.transactionType === 'income' ? 1 : -1)
          )
            throw new UnprocessableEntityException(
              'Escolha um lançamento ativo da mesma conta e tipo, realizado até hoje.',
            );
          requireVersion(entry.version, input.transactionVersion);
        } else {
          if (!input.transactionDate || !input.amount || input.transactionId)
            throw new UnprocessableEntityException(
              'Informe data e valor do pagamento ou recebimento.',
            );
          dateOnly(input.transactionDate);
          if (input.transactionDate > today)
            throw new UnprocessableEntityException(
              'Registre apenas pagamentos ou recebimentos já realizados.',
            );
          transactionId = (
            await this.ledger.create({
              accountId: snap.accountId,
              categoryId: snap.categoryId,
              description: snap.description,
              amount: input.amount * (snap.transactionType === 'income' ? 1 : -1),
              transactionType: snap.transactionType,
              transactionDate: input.transactionDate,
            })
          ).id;
        }
        if ((await this.repository.records()).some((r) => r.transactionId === transactionId))
          throw new ConflictException('Este lançamento já está vinculado a outro vencimento.');
        await this.repository.record({
          scheduleId: id,
          dueDate: date,
          status: 'settled',
          transactionId: transactionId!,
          snapshot: snap,
        });
        return { id, date, status: 'settled', transactionId: transactionId! };
      },
    );
  }
  async exportCommitments(): Promise<CommitmentSnapshot> {
    const records = await this.repository.records();
    const entries = new Map(
      (
        await this.entries.commitmentEntries(
          records.flatMap((r) => (r.transactionId ? [r.transactionId] : [])),
        )
      ).map((t) => [t.id, t]),
    );
    return {
      schedules: await this.repository.schedules(),
      occurrences: records.map((record) => {
        const entry = record.transactionId ? entries.get(record.transactionId) : null;
        if (
          record.status === 'settled' &&
          (!entry ||
            entry.accountId !== record.snapshot.accountId ||
            entry.transactionType !== record.snapshot.transactionType ||
            entry.transactionDate > commitmentToday() ||
            Math.sign(entry.amount) !== (record.snapshot.transactionType === 'income' ? 1 : -1))
        )
          return { ...record, status: 'review', transactionId: null };
        return record;
      }),
    };
  }
  async restoreCommitments(
    data: CommitmentSnapshot,
    accounts: Map<string, string>,
    categories: Map<string, string>,
    transactions: Map<string, string>,
  ) {
    await this.repository.lock();
    const mapping = new Map<string, string>();
    if ((await this.repository.schedules()).length + data.schedules.length > 200)
      throw new ConflictException('A restauração ultrapassa o limite de compromissos do espaço.');
    for (const rule of data.schedules) {
      const id = await this.repository.create({
        ...rule,
        accountId: accounts.get(rule.accountId)!,
        categoryId: rule.categoryId ? categories.get(rule.categoryId)! : null,
      });
      mapping.set(rule.id, id);
      if (rule.endedOn) await this.repository.end(id, rule.endedOn);
    }
    for (const record of data.occurrences)
      await this.repository.record({
        ...record,
        scheduleId: mapping.get(record.scheduleId)!,
        transactionId: record.transactionId ? transactions.get(record.transactionId)! : null,
        snapshot: {
          ...record.snapshot,
          accountId: accounts.get(record.snapshot.accountId)!,
          categoryId: record.snapshot.categoryId
            ? categories.get(record.snapshot.categoryId)!
            : null,
        },
      });
  }
}
