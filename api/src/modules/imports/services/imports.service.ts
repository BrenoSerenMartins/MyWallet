import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ACCOUNT_READS,
  LEDGER_WRITES,
  LEDGER_READS,
  type LedgerReads,
  COMMAND_RECEIPTS,
  CATEGORY_READS,
  type AccountReads,
  type LedgerWrites,
  type CommandReceipts,
  type CategoryReads,
} from '../../../core/integration/index.js';
import { requireVersion } from '../../../core/rest/index.js';
import { ImportsRepository } from '../repositories/imports.repository.js';
import {
  mapMercadoPago,
  mercadoPagoMapperVersion,
} from '../mappers/mercado-pago/statement.mapper.js';
import { extractMercadoPagoStatement } from '../parsers/mercado-pago/extract-statement.js';
import type { ParsedStatement } from '../contracts/statement.js';
import type { ReviewItemDto } from '../dto/import.dto.js';
@Injectable()
export class ImportsService {
  private readonly activeExtractions = new Set<string>();
  async extract(userId: string, buffer: Buffer, fileName = 'statement.pdf') {
    if (this.activeExtractions.has(userId))
      throw new ConflictException('Já existe uma leitura em andamento.');
    this.activeExtractions.add(userId);
    try {
      return await extractMercadoPagoStatement(buffer, fileName);
    } finally {
      this.activeExtractions.delete(userId);
    }
  }
  constructor(
    @Inject(ImportsRepository) private readonly repository: ImportsRepository,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Inject(LEDGER_WRITES) private readonly ledger: LedgerWrites,
    @Inject(COMMAND_RECEIPTS) private readonly receipts: CommandReceipts,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(LEDGER_READS) private readonly ledgerReads: LedgerReads,
  ) {}
  list() {
    return this.repository.list();
  }
  async get(id: string, lock = false) {
    const batch = await this.repository.get(id, lock);
    if (!batch) throw new NotFoundException('Importação não encontrada.');
    return batch;
  }
  private assertDraft(batch: Record<string, any>) {
    if (batch.status !== 'draft')
      throw new ConflictException('Esta importação não está em revisão.');
    if (new Date(batch.expires_at).getTime() <= Date.now())
      throw new GoneException('A revisão expirou. Envie o arquivo novamente.');
  }
  async preview(id: string) {
    const b = await this.get(id);
    const items = await this.repository.items(id);
    const account = await this.accounts.find(b.account_id);
    const statementStartDate = items.reduce<string | null>(
      (date, item) => (!date || item.transactionDate < date ? item.transactionDate : date),
      null,
    );
    const recordedOpeningBalance =
      account.openingBalance +
      (statementStartDate
        ? await this.ledgerReads.balanceBefore(account.id, statementStartDate)
        : 0);
    return {
      sourceFormat: b.mapper_version.includes('-csv/')
        ? 'csv'
        : b.mapper_version.includes('account-xlsx/')
          ? 'xlsx'
          : 'pdf',
      reportType: b.report_type,
      canIntegrate: b.report_type === 'account_statement',
      accountOpeningDate: account.openingDate,
      statementStartDate,
      openingDateMismatch: !!statementStartDate && statementStartDate < account.openingDate,
      recordedOpeningBalance,
      openingMismatch:
        b.opening_balance_minor !== null &&
        recordedOpeningBalance !== Number(b.opening_balance_minor),
      id: b.id,
      accountId: b.account_id,
      fileName: b.file_name,
      status: b.status,
      version: b.version,
      openingBalance: b.opening_balance_minor === null ? null : Number(b.opening_balance_minor),
      closingBalance: b.closing_balance_minor === null ? null : Number(b.closing_balance_minor),
      expiresAt: b.expires_at,
      items,
    };
  }
  async upload(accountId: string, buffer: Buffer, fileName: string, statement: ParsedStatement) {
    const account = await this.accounts.find(accountId, true);
    if (account.institution !== 'mercado_pago')
      throw new UnprocessableEntityException('O primeiro importador atende contas Mercado Pago.');
    const hash = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.repository.sameFile(accountId, hash);
    if (existing) return this.preview(existing.id);

    const id = await this.repository.create(
      accountId,
      hash,
      fileName,
      mercadoPagoMapperVersion(statement.sourceFormat ?? 'pdf', statement.reportType),
      statement,
    );
    const signatures = new Set<string>();
    for (const entry of mapMercadoPago(statement)) {
      const signature = JSON.stringify([
        entry.transactionDate,
        entry.amount,
        entry.description,
        entry.sourceOperationId,
      ]);
      const duplicate =
        signatures.has(signature) || (await this.repository.duplicate(accountId, entry));
      signatures.add(signature);
      await this.repository.addItem(id, entry, duplicate);
    }
    return this.preview(id);
  }
  async review(id: string, itemId: string, input: ReviewItemDto, version: string) {
    const batch = await this.get(id, true);
    this.assertDraft(batch);
    this.assertAccountStatement(batch.report_type);
    requireVersion(batch.version, version);
    const items = await this.repository.items(id);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Linha não encontrada.');
    if (
      (input.transactionType === 'income' && item.amount < 0) ||
      (input.transactionType === 'expense' && item.amount > 0)
    )
      throw new UnprocessableEntityException('O tipo não corresponde ao sinal do valor.');
    if (input.categoryId) await this.categories.validate(input.categoryId, input.transactionType);
    await this.repository.updateItem(id, itemId, input);
    return this.preview(id);
  }
  async classify(id: string, version: number) {
    const batch = await this.get(id, true);
    this.assertDraft(batch);
    this.assertAccountStatement(batch.report_type);
    requireVersion(batch.version, version);
    for (const item of await this.repository.items(id)) {
      if (item.transactionType === 'unclassified')
        await this.repository.updateItem(id, item.id, {
          selected: item.selected,
          transactionType: item.amount > 0 ? 'income' : 'expense',
          categoryId: null,
        });
    }
    return this.preview(id);
  }
  async confirm(id: string, version: number, key: string) {
    return this.receipts.execute('import-confirm', key, { id, version }, async () => {
      const first = await this.get(id);
      await this.accounts.find(first.account_id, true);
      const batch = await this.get(id, true);
      if (batch.status === 'confirmed') return { id, status: 'confirmed' };
      this.assertDraft(batch);
      this.assertAccountStatement(batch.report_type);
      requireVersion(batch.version, version);
      const preview = await this.preview(id);
      if (preview.openingMismatch || preview.openingDateMismatch)
        throw new ConflictException(
          'A posição inicial da conta não confere com o extrato. Corrija a conta ou os movimentos anteriores antes de confirmar.',
        );
      const selected = (await this.repository.items(id)).filter((i) => i.selected);
      if (!selected.length)
        throw new UnprocessableEntityException('Selecione ao menos um movimento.');
      if (selected.some((i) => i.transactionType === 'unclassified'))
        throw new UnprocessableEntityException(
          'Classifique os movimentos selecionados antes de confirmar.',
        );
      for (const item of selected) {
        const duplicate = await this.repository.duplicate(batch.account_id, item);
        if (duplicate && !item.duplicateCandidate)
          throw new ConflictException(
            'Novas possíveis duplicidades foram encontradas. Reenvie e revise o extrato.',
          );
        await this.ledger.create(
          {
            accountId: batch.account_id,
            categoryId: item.categoryId,
            transactionDate: item.transactionDate,
            description: item.description,
            amount: item.amount,
            transactionType: item.transactionType,
            sourceOperationId: item.sourceOperationId,
            importBatchId: id,
            sourceRow: item.sourceRow,
          },
          true,
        );
      }
      await this.repository.mark(id, 'confirmed');
      return { id, status: 'confirmed', count: selected.length };
    });
  }
  private assertAccountStatement(reportType: string) {
    if (reportType !== 'account_statement')
      throw new ConflictException(
        'Este relatório é apenas para consulta e não fornece saldos para conciliação. Use um extrato de conta para integrar os movimentos.',
      );
  }
  async retainHistory(id: string, version: number) {
    const batch = await this.get(id, true);
    if (batch.status === 'history') return this.preview(id);
    if (batch.status !== 'draft')
      throw new ConflictException('Somente um extrato em revisão pode ser salvo para consulta.');
    if (!batch.history_saved_at) this.assertDraft(batch);
    requireVersion(batch.version, version);
    await this.repository.retainHistory(id);
    return this.preview(id);
  }
  async reopenHistory(id: string, version: number) {
    const batch = await this.get(id, true);
    requireVersion(batch.version, version);
    this.assertAccountStatement(batch.report_type);
    if (batch.status !== 'history')
      throw new ConflictException('Somente um extrato salvo para consulta pode voltar à revisão.');
    await this.repository.reopenHistory(id);
    return this.preview(id);
  }
  async reverse(id: string, version: string) {
    const initial = await this.get(id);
    await this.accounts.find(initial.account_id, true);
    const batch = await this.get(id, true);
    requireVersion(batch.version, version);
    if (batch.status !== 'confirmed')
      throw new ConflictException('Somente uma importação confirmada pode ser desfeita.');
    await this.ledger.reverseBatch(id);
    await this.repository.mark(id, 'reversed');
    return { id, status: 'reversed' };
  }
}
