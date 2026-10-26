import {
  extractInstitutionStatement,
  mapInstitutionStatement,
  statementMapperVersion,
} from './statement-institution.js';
import { ImportReconciliationService } from './import-reconciliation.service.js';
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
  ACCOUNT_OPENING_POSITIONS,
  type AccountOpeningPositions,
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
  classifyMercadoPagoMovement,
  mercadoPagoSourceFormat,
} from '../mappers/mercado-pago/statement.mapper.js';
import type { ParsedStatement } from '../contracts/statement.js';
import type { ReviewItemDto } from '../dto/import.dto.js';
@Injectable()
export class ImportsService {
  private readonly activeExtractions = new Set<string>();
  async extract(
    userId: string,
    buffer: Buffer,
    fileName = 'statement.pdf',
    institution = 'mercado_pago',
  ) {
    if (this.activeExtractions.has(userId))
      throw new ConflictException('Já existe uma leitura em andamento.');
    this.activeExtractions.add(userId);
    try {
      return await extractInstitutionStatement(institution, buffer, fileName);
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
    @Inject(ImportReconciliationService)
    private readonly reconciliation: ImportReconciliationService,
    @Inject(ACCOUNT_OPENING_POSITIONS) private readonly openingPositions: AccountOpeningPositions,
  ) {}
  async sourceAccount(accountId: string) {
    const account = await this.accounts.find(accountId);
    if (!['mercado_pago', 'alelo'].includes(account.institution))
      throw new UnprocessableEntityException('Esta instituição ainda não possui importador.');
    return account;
  }
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
  private async reviewItems(
    id: string,
    accountId: string,
    automaticClassification = false,
    reportType: 'account_statement' | 'settlement' | 'benefit_statement' = 'account_statement',
  ) {
    const items = await this.repository.items(id);
    const normalized = items.map((item) => ({
      ...item,
      transactionType:
        automaticClassification && item.transactionType === 'unclassified'
          ? classifyMercadoPagoMovement(item)
          : item.transactionType,
    }));
    return this.reconciliation.plan(accountId, reportType, normalized);
  }

  async preview(id: string) {
    const b = await this.get(id);
    const items = await this.reviewItems(
      id,
      b.account_id,
      b.report_type === 'account_statement' && b.status === 'draft',
      b.report_type,
    );
    if (b.status === 'confirmed') for (const item of items) item.duplicateLocked = false;
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
    const openingMismatch =
      b.opening_balance_minor !== null &&
      recordedOpeningBalance !== Number(b.opening_balance_minor);
    const previousImports =
      openingMismatch && statementStartDate
        ? await this.repository.previousImports(account.id, statementStartDate, id)
        : [];
    return {
      willInitializeOpening:
        !!account.canEditOpeningPosition &&
        !account.archived &&
        b.status === 'draft' &&
        !!statementStartDate &&
        ((b.report_type === 'account_statement' && openingMismatch) ||
          statementStartDate < account.openingDate),
      canAdjustOpeningPosition: !!account.canEditOpeningPosition && !account.archived,
      openingDifference:
        b.opening_balance_minor === null
          ? null
          : Number(b.opening_balance_minor) - recordedOpeningBalance,
      previousImports,
      canReprocess: ['draft', 'history'].includes(b.status),
      sourceFormat: mercadoPagoSourceFormat(b.mapper_version),
      reconciliationCapability:
        b.report_type === 'account_statement' ? 'running_balance' : 'partial',
      institution: account.institution,
      reportType: b.report_type,
      canIntegrate: true,
      accountOpeningDate: account.openingDate,
      statementStartDate,
      openingDateMismatch: !!statementStartDate && statementStartDate < account.openingDate,
      recordedOpeningBalance,
      openingMismatch,
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
    if (
      (statement.reportType === 'benefit_statement') !== (account.institution === 'alelo') ||
      !['alelo', 'mercado_pago'].includes(account.institution)
    )
      throw new UnprocessableEntityException('O arquivo não corresponde à instituição da conta.');
    if (account.institution === 'alelo' && account.type !== 'benefit_food')
      throw new UnprocessableEntityException(
        'Este modelo é Alelo Alimentação. Selecione uma conta de Alimentação.',
      );
    const hash = createHash('sha256').update(buffer).digest('hex');
    const existing = await this.repository.sameFile(accountId, hash);
    if (existing) return this.preview(existing.id);

    const id = await this.repository.create(
      accountId,
      hash,
      fileName,
      statementMapperVersion(statement),
      statement,
    );
    const entries = mapInstitutionStatement(statement);
    for (const entry of entries) await this.repository.addItem(id, entry, false);
    return this.preview(id);
  }
  async review(id: string, itemId: string, input: ReviewItemDto, version: string) {
    const batch = await this.get(id, true);
    this.assertDraft(batch);
    requireVersion(batch.version, version);
    const items = await this.reviewItems(
      id,
      batch.account_id,
      batch.report_type === 'account_statement',
      batch.report_type,
    );
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Linha não encontrada.');
    if (input.linkedTransactionId && !item.candidateIds.includes(input.linkedTransactionId))
      throw new UnprocessableEntityException('Escolha um movimento compatível desta conta.');
    if (item.duplicateLocked)
      throw new ConflictException(
        'Esta duplicata foi excluída automaticamente e não pode ser selecionada.',
      );
    if (input.refundOfId && !item.refundCandidates.some((origin) => origin.id === input.refundOfId))
      throw new UnprocessableEntityException('Escolha uma operação original válida desta conta.');
    if (
      !input.refundOfId &&
      ((input.transactionType === 'income' && item.amount < 0) ||
        (input.transactionType === 'expense' && item.amount > 0))
    )
      throw new UnprocessableEntityException('O tipo não corresponde ao sinal do valor.');
    if (input.categoryId && !input.refundOfId)
      await this.categories.validate(input.categoryId, input.transactionType);
    await this.repository.updateItem(id, itemId, input);
    return this.preview(id);
  }
  async classify(id: string, version: number) {
    const batch = await this.get(id, true);
    this.assertDraft(batch);
    requireVersion(batch.version, version);
    await this.repository.applyAutomaticTypes(
      id,
      await this.reviewItems(
        id,
        batch.account_id,
        batch.report_type === 'account_statement',
        batch.report_type,
      ),
    );
    await this.repository.advanceVersion(id);
    return this.preview(id);
  }
  async confirm(id: string, version: number, key: string) {
    return this.receipts.execute('import-confirm', key, { id, version }, async () => {
      const first = await this.get(id);
      await this.accounts.find(first.account_id, true);
      const batch = await this.get(id, true);
      if (batch.status === 'confirmed') return { id, status: 'confirmed' };
      this.assertDraft(batch);
      requireVersion(batch.version, version);
      let preview = await this.preview(id);
      if (
        preview.willInitializeOpening &&
        preview.items.some((item) => item.selected && item.action === 'create')
      ) {
        await this.openingPositions.initializeFromStatement(
          batch.account_id,
          batch.opening_balance_minor === null
            ? preview.recordedOpeningBalance
            : Number(batch.opening_balance_minor),
          preview.statementStartDate!,
        );
        preview = await this.preview(id);
      }
      const selected = preview.items.filter((i) => i.selected);
      const skippedDuplicates = preview.items.filter((i) => i.duplicateLocked).length;
      const creating = selected.filter((item) => item.action === 'create');
      if (selected.some((item) => item.action === 'review'))
        throw new ConflictException('Resolva as pendências de conciliação antes de confirmar.');
      if (creating.length && preview.openingDateMismatch)
        throw new ConflictException(
          preview.canAdjustOpeningPosition
            ? 'A posição inicial da conta não confere com o extrato. Revise o cadastro inicial antes de confirmar.'
            : 'O saldo registrado antes deste extrato não confere. Confirme os extratos anteriores ou confira as movimentações faltantes; o saldo de abertura da conta será preservado.',
        );
      if (!selected.length && !skippedDuplicates)
        throw new UnprocessableEntityException('Selecione ao menos um movimento.');
      if (creating.some((i) => i.transactionType === 'unclassified'))
        throw new UnprocessableEntityException(
          'Classifique os movimentos novos antes de confirmar.',
        );
      await this.repository.applyAutomaticTypes(id, preview.items);
      for (const item of preview.items.filter(
        (item) => item.selected || item.action === 'recorded',
      )) {
        if (item.linkedTransactionId) {
          if (item.refundOfId)
            await this.ledger.attachRefund(item.linkedTransactionId, item.refundOfId);
          if (item.originalSource)
            await this.ledger.recordEvidence(
              item.linkedTransactionId,
              batch.account_id,
              item.originalSource,
            );
          if (item.sourceEvidence)
            await this.ledger.recordEvidence(
              item.linkedTransactionId,
              batch.account_id,
              item.sourceEvidence,
            );
          await this.reconciliation.link(
            id,
            item.id,
            item.linkedTransactionId,
            item.sourceEvidence,
          );
          continue;
        }
        const created = await this.ledger.create(
          {
            accountId: batch.account_id,
            categoryId: item.categoryId,
            refundOfId: item.refundOfId,
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
        if (item.sourceEvidence)
          await this.ledger.recordEvidence(created.id, batch.account_id, item.sourceEvidence);
        await this.reconciliation.link(id, item.id, created.id, item.sourceEvidence);
      }
      await this.repository.mark(id, 'confirmed');
      return {
        id,
        status: 'confirmed',
        count: creating.length,
        reconciled: selected.length - creating.length,
        skippedDuplicates,
      };
    });
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
    await this.ledger.removeBatchEvidence(id);
    await this.repository.mark(id, 'reversed');
    return { id, status: 'reversed' };
  }
}
