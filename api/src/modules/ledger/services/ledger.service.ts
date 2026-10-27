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
    const restoredIds = new Map<string, string>();
    for (const entry of [
      ...records.filter((entry) => !entry.refundOfId),
      ...records.filter((entry) => entry.refundOfId),
    ]) {
      let transferGroupId: string | undefined;
      if (entry.transferGroupId) {
        if (!groups.has(entry.transferGroupId))
          groups.set(entry.transferGroupId, await this.repository.createTransferGroup());
        transferGroupId = groups.get(entry.transferGroupId);
      }
      const restored = await this.create(
        {
          ...entry,
          importBatchId: undefined,
          sourceRow: undefined,
          refundOfId: entry.refundOfId ? restoredIds.get(entry.refundOfId) : null,
          accountId: accounts.get(entry.accountId)!,
          categoryId: entry.categoryId ? categories.get(entry.categoryId) : null,
          transferGroupId,
        },
        true,
      );
      restoredIds.set(entry.id, restored.id);
      for (const evidence of entry.sourceEvidence ?? [])
        await this.recordEvidence(restored.id, accounts.get(entry.accountId)!, evidence);
    }
  }
  recordEvidence(
    transactionId: string,
    accountId: string,
    evidence: import('../../../core/integration/index.js').SourceEvidence,
  ) {
    return this.repository.recordEvidence(transactionId, accountId, evidence);
  }
  list(filter: LedgerFilter) {
    return this.repository.list(filter);
  }
  balanceBefore(accountId: string, date: string) {
    return this.repository.balanceBefore(accountId, date);
  }
  planningActuals(from: string, to: string, scope: 'all' | 'cash' | 'benefits' = 'all') {
    return this.repository.planningActuals(from, to, scope);
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
    if (account.archived)
      throw new UnprocessableEntityException('Não é possível lançar em uma conta arquivada.');
    if (!input.amount || !input.description.trim())
      throw new UnprocessableEntityException('Informe valor e descrição.');
    if (input.refundOfId) await this.validateRefund(input);
    else if (
      (input.transactionType === 'income' && input.amount < 0) ||
      (input.transactionType === 'expense' && input.amount > 0)
    )
      throw new UnprocessableEntityException('Valor incompatível com o tipo do lançamento.');
    if (input.categoryId && !input.refundOfId)
      await this.categories.validate(input.categoryId, input.transactionType);
  }
  async attachRefund(transactionId: string, refundOfId: string) {
    const entry = await this.find(transactionId);
    await this.accounts.find(entry.accountId, true);
    const current = await this.find(transactionId, true);
    if (current.refundOfId === refundOfId) return;
    if (
      current.refundOfId ||
      current.balanceAdjustment ||
      current.transferGroupId ||
      (await this.repository.refundedAmount(current.id)) > 0
    )
      throw new ConflictException('Este lançamento já possui um vínculo financeiro incompatível.');
    const original = await this.find(refundOfId, true);
    await this.validateRefund({
      ...current,
      refundOfId,
      transactionType: original.transactionType,
      categoryId: original.categoryId,
    });
    await this.repository.attachRefund(current.id, original);
  }
  private async validateRefund(input: TransactionInput) {
    const original = await this.find(input.refundOfId!, true);
    if (
      original.accountId !== input.accountId ||
      original.refundOfId ||
      original.balanceAdjustment ||
      !['income', 'expense'].includes(original.transactionType) ||
      input.transactionType !== original.transactionType ||
      input.categoryId !== original.categoryId ||
      input.amount * original.amount >= 0 ||
      input.transactionDate < original.transactionDate
    )
      throw new UnprocessableEntityException(
        'A devolução deve corresponder à conta, categoria e natureza da operação original, com sinal oposto.',
      );
    const refunded = await this.repository.refundedAmount(original.id);
    if (refunded + Math.abs(input.amount) > Math.abs(original.amount))
      throw new ConflictException('O total devolvido excede o valor da operação original.');
  }
  async create(input: TransactionInput, imported = false) {
    await this.validate(input);
    if (!imported && !['income', 'expense'].includes(input.transactionType))
      throw new UnprocessableEntityException('Use o fluxo de transferência.');
    return this.repository.insert(input);
  }
  async adjustBalance(
    accountId: string,
    input: import('../dto/balance-adjustment.dto.js').BalanceAdjustmentDto,
    key: string,
  ) {
    return this.receipts.execute('balance-adjustment', key, { accountId, ...input }, async () => {
      const account = await this.accounts.find(accountId, true);
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (account.archived) throw new ConflictException('Esta conta está arquivada.');
      if (account.balance !== input.expectedBalance)
        throw new ConflictException(
          'O saldo mudou. Atualize a conta e confira a diferença novamente.',
        );
      if (await this.repository.hasFutureEntries(accountId, date))
        throw new ConflictException(
          'Existem lançamentos futuros nesta conta. Revise-os antes de corrigir o saldo atual.',
        );
      const amount = input.targetBalance - account.balance;
      exactAmount(amount);
      if (!amount)
        throw new UnprocessableEntityException('O saldo já corresponde ao valor informado.');
      if (!input.reason.trim())
        throw new UnprocessableEntityException('Informe o motivo da correção.');
      return this.create(
        {
          accountId,
          amount,
          transactionType: 'transfer',
          description: 'Correção de saldo manual',
          transactionDate: date,
          categoryId: null,
          balanceAdjustment: {
            previousBalance: account.balance,
            targetBalance: input.targetBalance,
            reason: input.reason.trim(),
          },
        },
        true,
      );
    });
  }
  async update(id: string, input: TransactionInput, version: string) {
    const original = await this.find(id);
    if (original.refundOfId || (await this.repository.refundedAmount(id)) > 0)
      throw new ConflictException(
        'Operações com devoluções não são editadas. Desfaça as devoluções antes de corrigir o histórico.',
      );
    if (original.balanceAdjustment)
      throw new ConflictException(
        'Correções de saldo não são editadas. Desfaça a correção e registre outra para preservar o histórico.',
      );
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
    if ((await this.repository.refundedAmount(id)) > 0)
      throw new ConflictException('Desfaça as devoluções antes da operação original.');
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
  removeBatchEvidence(batchId: string) {
    return this.repository.removeBatchEvidence(batchId);
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
