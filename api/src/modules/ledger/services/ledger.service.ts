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
  type AccountReads,
  type CategoryReads,
  type TransactionInput,
  type LedgerWrites,
  type LedgerReads,
} from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireVersion } from '../../../core/rest/index.js';
import { LedgerRepository, type LedgerFilter } from '../repositories/ledger.repository.js';
import { IdempotencyService } from './idempotency.service.js';
import type { TransferDto } from '../dto/transaction.dto.js';
@Injectable()
export class LedgerService implements LedgerWrites, LedgerReads {
  constructor(
    @Inject(LedgerRepository) private readonly repository: LedgerRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(IdempotencyService) private readonly receipts: IdempotencyService,
  ) {}
  exportRecords() {
    return this.repository.exportRecords();
  }
  async restoreRecords(
    records: import('../../../core/integration/index.js').BackupTransaction[],
    accounts: Map<string, string>,
    categories: Map<string, string>,
  ) {
    const groups = new Map<string, string>();
    for (const entry of records) {
      let transferGroupId: string | undefined;
      if (entry.transferGroupId) {
        if (!groups.has(entry.transferGroupId))
          groups.set(entry.transferGroupId, await this.repository.createTransferGroup());
        transferGroupId = groups.get(entry.transferGroupId);
      }
      await this.create(
        {
          ...entry,
          accountId: accounts.get(entry.accountId)!,
          categoryId: entry.categoryId ? categories.get(entry.categoryId) : null,
          transferGroupId,
        },
        true,
      );
    }
  }
  list(filter: LedgerFilter) {
    return this.repository.list(filter);
  }
  balanceBefore(accountId: string, date: string) {
    return this.repository.balanceBefore(accountId, date);
  }
  summary(from: string, to: string) {
    return this.repository.summary(from, to);
  }
  async find(id: string, lock = false) {
    const entry = await this.repository.find(id, lock);
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');
    return entry;
  }
  async validate(input: TransactionInput) {
    const account = await this.accounts.find(input.accountId, true);
    dateOnly(input.transactionDate);
    exactAmount(input.amount);
    if (account.archived || input.transactionDate < account.openingDate)
      throw new UnprocessableEntityException('A data deve respeitar a posição inicial da conta.');
    if (!input.amount || !input.description.trim())
      throw new UnprocessableEntityException('Informe valor e descrição.');
    if (
      (input.transactionType === 'income' && input.amount < 0) ||
      (input.transactionType === 'expense' && input.amount > 0)
    )
      throw new UnprocessableEntityException('Valor incompatível com o tipo do lançamento.');
    if (input.categoryId) await this.categories.validate(input.categoryId, input.transactionType);
  }
  async create(input: TransactionInput, imported = false) {
    await this.validate(input);
    if (!imported && !['income', 'expense'].includes(input.transactionType))
      throw new UnprocessableEntityException('Use o fluxo de transferência.');
    return this.repository.insert(input);
  }
  async update(id: string, input: TransactionInput, version: string) {
    const original = await this.find(id);
    await this.accounts.find(original.accountId, true);
    const current = await this.find(id, true);
    requireVersion(current.version, version);
    if (current.transferGroupId)
      throw new ConflictException('Uma transferência deve ser corrigida como um conjunto.');
    if (input.accountId !== current.accountId)
      throw new ConflictException('A conta de um lançamento não pode ser substituída.');
    await this.validate(input);
    return this.repository.update(id, input);
  }
  async reverse(id: string, version: string) {
    const current = await this.find(id);
    await this.accounts.find(current.accountId, true);
    const latest = await this.find(id, true);
    requireVersion(latest.version, version);
    await this.repository.reverse(id, latest.transferGroupId);
    return { reversed: true };
  }
  async transfer(input: TransferDto, key: string) {
    return this.receipts.execute('transfer', key, input, async () => {
      if (input.fromAccountId === input.toAccountId)
        throw new UnprocessableEntityException('Escolha duas contas diferentes.');
      for (const id of [input.fromAccountId, input.toAccountId].sort())
        await this.accounts.find(id, true);
      const group = await this.repository.createTransferGroup();
      const common = {
        transactionDate: input.transactionDate,
        description: input.description,
        transactionType: 'transfer' as const,
        transferGroupId: group,
      };
      await this.validate({ ...common, accountId: input.fromAccountId, amount: -input.amount });
      await this.validate({ ...common, accountId: input.toAccountId, amount: input.amount });
      const from = await this.repository.insert({
        ...common,
        accountId: input.fromAccountId,
        amount: -input.amount,
      });
      const to = await this.repository.insert({
        ...common,
        accountId: input.toAccountId,
        amount: input.amount,
      });
      return { id: group, from, to };
    });
  }
  async reverseBatch(batchId: string) {
    const entries = await this.repository.batchEntries(batchId);
    if (entries.some((e) => e.version !== 1 || e.transfer_group_id))
      throw new ConflictException(
        'Existem lançamentos alterados. Resolva as alterações antes de desfazer.',
      );
    await this.repository.reverseBatch(batchId);
  }
}
