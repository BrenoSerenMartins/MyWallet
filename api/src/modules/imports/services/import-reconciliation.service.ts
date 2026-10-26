import { reconciliationCandidates } from './reconciliation-candidates.js';
import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { sourceEvidenceKey, type SourceEvidence } from '../../../core/integration/index.js';
import type { SavedImportItem } from '../contracts/statement.js';
import { ImportReconciliationRepository } from '../repositories/import-reconciliation.repository.js';
import { ediFinancialType, ediCanPost } from '../mappers/mercado-pago/edi-financial-type.js';
import { importSourceEvidence } from './import-source-evidence.js';
export type ImportAction = 'create' | 'reconcile' | 'recorded' | 'review' | 'ignore';
@Injectable()
export class ImportReconciliationService {
  constructor(
    @Inject(ImportReconciliationRepository)
    private readonly repository: ImportReconciliationRepository,
  ) {}
  async plan(
    accountId: string,
    reportType: SourceEvidence['reportType'],
    items: SavedImportItem[],
  ) {
    const dates = items
      .flatMap((i) => [
        i.transactionDate,
        ...(i.metadata ? [i.metadata.transactionTimestamp.slice(0, 10)] : []),
      ])
      .sort();
    const candidates = dates.length
      ? await this.repository.candidates(
          accountId,
          items.flatMap((i) => (i.sourceOperationId ? [i.sourceOperationId] : [])),
          dates[0],
          dates.at(-1)!,
        )
      : [];
    if (candidates.length > 20000)
      throw new UnprocessableEntityException('Use um período menor para conciliar os movimentos.');
    const indexed = reconciliationCandidates(candidates);
    const benefitOccurrences = new Map<string, number>();
    const seen = new Set<string>();
    const claimed = new Map<string, string | null>();
    return items.map((item) => {
      const benefitIdentity = JSON.stringify([item.transactionDate, item.amount, item.description]);
      const existingOccurrence =
        item.confirmNew && reportType === 'benefit_statement'
          ? Math.max(
              0,
              ...candidates.flatMap((candidate) =>
                candidate.evidence
                  .filter(
                    (proof) =>
                      proof.data.reportType === 'benefit_statement' &&
                      proof.data.date === item.transactionDate &&
                      proof.data.amount === item.amount &&
                      proof.data.description === item.description,
                  )
                  .map((proof) => proof.data.occurrence ?? 0),
              ),
            )
          : 0;
      const occurrence = existingOccurrence + (benefitOccurrences.get(benefitIdentity) ?? 0) + 1;
      benefitOccurrences.set(benefitIdentity, occurrence);
      let source: SourceEvidence | null =
        reportType === 'benefit_statement'
          ? {
              reportType,
              institution: 'alelo',
              reference: '',
              date: item.transactionDate,
              amount: item.amount,
              balance: null,
              eventType: null,
              timestamp: null,
              installmentNumber: null,
              description: item.description,
              occurrence,
              ruleVersion: 'alelo/food-pdf/1',
            }
          : importSourceEvidence(item, reportType);
      if (reportType === 'benefit_statement' && item.linkedTransactionId && !item.confirmNew) {
        const proof = indexed.byId
          .get(item.linkedTransactionId)
          ?.evidence.find(
            (proof) =>
              proof.data.reportType === 'benefit_statement' &&
              proof.data.date === item.transactionDate &&
              proof.data.amount === item.amount &&
              proof.data.description === item.description,
          );
        if (proof) source = proof.data;
      }
      const key = source ? sourceEvidenceKey(source) : null;
      const occurrenceRepeated = key !== null && seen.has(key);
      if (key) seen.add(key);
      const known = key ? indexed.bySource.get(key) : undefined;
      const dates = [
        item.transactionDate,
        ...(item.metadata ? [item.metadata.transactionTimestamp.slice(0, 10)] : []),
      ];
      const exact = indexed.exact(dates, item.amount, item.sourceOperationId);
      const sameSource =
        reportType === 'account_statement' && key ? (indexed.byOriginal.get(key) ?? []) : [];
      // Different source balances distinguish genuine repeated statement operations.
      const eligible =
        reportType === 'account_statement'
          ? exact.filter((candidate) => candidate.source?.reportType !== 'account_statement')
          : exact.filter(
              (candidate) =>
                !candidate.evidence.some((proof) => proof.data.reportType === 'settlement'),
            );
      const requested = item.linkedTransactionId
        ? indexed.byId.get(item.linkedTransactionId)
        : undefined;
      const explicit =
        requested && requested.amount === item.amount && dates.includes(requested.date)
          ? requested
          : undefined;
      const linked =
        known ??
        explicit ??
        (sameSource.length === 1 ? sameSource[0] : eligible.length === 1 ? eligible[0] : undefined);
      const similar = indexed.similar(dates, item.amount);
      let action: ImportAction = occurrenceRepeated
        ? 'ignore'
        : known || sameSource.length === 1
          ? 'recorded'
          : linked
            ? 'reconcile'
            : eligible.length > 1 || similar.length
              ? 'review'
              : 'create';
      if (reportType === 'benefit_statement' && (known || similar.length) && !explicit)
        action = 'review';
      if (reportType === 'benefit_statement' && explicit) action = 'reconcile';
      if (item.confirmNew && !linked && !occurrenceRepeated) action = 'create';
      const metadata = item.metadata;
      const transactionType =
        reportType === 'settlement' && item.transactionType === 'unclassified' && metadata
          ? ediFinancialType(metadata, item.amount)
          : item.transactionType;
      if (
        !linked &&
        reportType === 'settlement' &&
        metadata &&
        (!ediCanPost(metadata, item.amount) || transactionType === 'unclassified')
      )
        action = 'review';
      if (linked?.modified && reportType === 'settlement') action = 'review';
      if (linked && claimed.has(linked.id) && claimed.get(linked.id) !== key) action = 'review';
      if (linked && action !== 'review') claimed.set(linked.id, key);
      if (!item.amount) action = 'ignore';
      const reason =
        linked?.modified && reportType === 'settlement'
          ? 'O valor ou a data do lançamento foi alterado. Confira a diferença antes de conciliar; suas alterações serão preservadas.'
          : reportType === 'benefit_statement' && action === 'review'
            ? 'O PDF não fornece ID por compra. Confira as ocorrências antes de vincular; compras iguais no mesmo dia podem ser legítimas.'
            : action === 'create'
              ? 'Novo movimento identificado na fonte.'
              : action === 'reconcile'
                ? 'Vincular ao lançamento existente, preservando seus valores e categorias.'
                : action === 'recorded'
                  ? 'Esta operação já está registrada.'
                  : action === 'ignore'
                    ? 'Registro repetido ou sem efeito financeiro.'
                    : 'Confira classificação, disponibilidade ou um possível lançamento já existente.';
      return {
        ...item,
        transactionType,
        sourceEvidence: source,
        action,
        actionReason: reason,
        linkedTransactionId: linked?.id ?? null,
        candidateIds: similar.map((c) => c.id).slice(0, 20),
        candidateDescriptions: similar
          .slice(0, 20)
          .map((c) => ({ id: c.id, description: c.description })),
        originalSource: linked?.source ?? null,
        duplicateLocked: action === 'recorded' || action === 'ignore',
        duplicateCandidate: action === 'recorded' || action === 'ignore' || action === 'review',
        duplicateReason:
          action === 'recorded'
            ? ('recorded' as const)
            : action === 'ignore'
              ? ('same_statement' as const)
              : null,
        selected:
          item.selected && action !== 'recorded' && action !== 'ignore' && action !== 'review',
      };
    });
  }
  link(batchId: string, itemId: string, transactionId: string, source: SourceEvidence | null) {
    return this.repository.link(
      batchId,
      itemId,
      transactionId,
      source ? sourceEvidenceKey(source) : null,
    );
  }
}
