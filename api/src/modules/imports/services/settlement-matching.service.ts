import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ImportsRepository } from '../repositories/imports.repository.js';
import { SettlementEvidenceRepository } from '../repositories/settlement-evidence.repository.js';
import { matchSettlementEvidence } from './match-settlement-evidence.js';
@Injectable()
export class SettlementMatchingService {
  constructor(
    @Inject(ImportsRepository) private readonly imports: ImportsRepository,
    @Inject(SettlementEvidenceRepository) private readonly evidence: SettlementEvidenceRepository,
  ) {}
  async preview(id: string) {
    const batch = await this.imports.get(id);
    if (!batch) throw new NotFoundException('Importação não encontrada.');
    if (batch.status === 'draft' && new Date(batch.expires_at).getTime() <= Date.now())
      throw new GoneException('A revisão expirou. Reprocesse ou envie o arquivo novamente.');
    if (batch.report_type !== 'settlement') return [];
    const items = await this.imports.items(id);
    const references = [
      ...new Set(items.flatMap((item) => (item.sourceOperationId ? [item.sourceOperationId] : []))),
    ];
    return (await this.match(batch.account_id, references, id)).filter(
      (entry) => entry.batchId === id,
    );
  }
  async transactionSources(id: string) {
    const transaction = await this.evidence.transaction(id);
    if (!transaction) throw new NotFoundException('Lançamento não encontrado.');
    const direct = await this.evidence.directSources(id);
    if (direct.length) return direct;
    if (!transaction.source_operation_id) return [];
    const matches = await this.match(
      transaction.account_id,
      [transaction.source_operation_id],
      null,
    );
    const seen = new Set<string>();
    return matches.filter((entry) => {
      if (entry.transactionId !== id) return false;
      const signature = JSON.stringify(
        Object.entries(entry.metadata).sort(([a], [b]) => a.localeCompare(b)),
      );
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }
  private async match(accountId: string, references: string[], previewBatchId: string | null) {
    const settlements = await this.evidence.settlements(accountId, references, previewBatchId);
    const cash = await this.evidence.cashMovements(accountId, references);
    return matchSettlementEvidence(settlements, cash);
  }
}
