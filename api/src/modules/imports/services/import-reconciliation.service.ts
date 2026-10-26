import { importActionReason } from './import-action-reason.js';
import { isEdiRefund } from '../mappers/mercado-pago/edi-event.js';
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
    const refundOrigins =
      reportType === 'settlement' &&
      items.some((item) => item.metadata && isEdiRefund(item.metadata.eventType)) &&
      dates.length
        ? await this.repository.refundOrigins(accountId, dates.at(-1)!)
        : [];
    if (refundOrigins.length > 20000)
      throw new UnprocessableEntityException(
        'Use um período menor ou revise a origem das devoluções.',
      );
    const refundClaims = new Map<string, number>();
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
      let transactionType =
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
      const refundable =
        metadata && isEdiRefund(metadata.eventType)
          ? refundOrigins
              .filter(
                (origin) =>
                  origin.amount * item.amount < 0 &&
                  origin.date <= item.transactionDate &&
                  origin.remaining >= Math.abs(item.amount),
              )
              .sort(
                (a, b) =>
                  Number(b.reference === item.sourceOperationId) -
                  Number(a.reference === item.sourceOperationId),
              )
          : [];
      const refundOrigin = item.refundOfId
        ? refundable.find((origin) => origin.id === item.refundOfId)
        : undefined;
      if (metadata && isEdiRefund(metadata.eventType) && !known) {
        if (refundOrigin && (linked || ediCanPost(metadata, item.amount))) {
          const total = (refundClaims.get(refundOrigin.id) ?? 0) + Math.abs(item.amount);
          action = total <= refundOrigin.remaining ? (linked ? 'reconcile' : 'create') : 'review';
          if (item.selected && (action === 'create' || action === 'reconcile'))
            refundClaims.set(refundOrigin.id, total);
          transactionType = refundOrigin.transactionType;
        } else action = 'review';
      }
      if (!item.amount) action = 'ignore';
      const reason = importActionReason({
        action,
        reportType,
        metadata: item.metadata,
        amount: item.amount,
        modified: !!linked?.modified,
      });
      return {
        ...item,
        transactionType,
        categoryId: refundOrigin ? refundOrigin.categoryId : item.categoryId,
        refundOfId: refundOrigin?.id ?? item.refundOfId ?? null,
        refundCandidates: refundable.slice(0, 20).map((origin) => ({
          id: origin.id,
          description: `${origin.description} · ${origin.date} · disponível para devolver: R$ ${(origin.remaining / 100).toFixed(2).replace('.', ',')}`,
        })),
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
