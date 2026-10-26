import { statementMapperVersion } from './statement-institution.js';
import {
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ACCOUNT_READS, type AccountReads } from '../../../core/integration/index.js';
import { requireVersion } from '../../../core/rest/index.js';
import type { ParsedStatement } from '../contracts/statement.js';
import { ImportsRepository } from '../repositories/imports.repository.js';
import { ImportsService } from './imports.service.js';
import { preserveImportReviews } from './preserve-import-reviews.js';
import { reconcileStatement } from '../parsers/mercado-pago/reconcile-statement.js';
import { mercadoPagoSourceFormat } from '../mappers/mercado-pago/statement.mapper.js';
@Injectable()
export class ImportReprocessingService {
  constructor(
    @Inject(ImportsRepository) private readonly repository: ImportsRepository,
    @Inject(ImportsService) private readonly imports: ImportsService,
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
  ) {}
  private assertReprocessable(status: string) {
    if (!['draft', 'history'].includes(status))
      throw new ConflictException(
        'Reprocesse apenas importações em revisão ou para consulta. Movimentos já confirmados devem ser corrigidos ou estornados pelo fluxo financeiro.',
      );
  }
  async validateSource(id: string, version: number, buffer?: Buffer) {
    const batch = await this.imports.get(id);
    this.assertReprocessable(batch.status);
    requireVersion(batch.version, version);
    if (buffer && createHash('sha256').update(buffer).digest('hex') !== batch.file_hash)
      throw new UnprocessableEntityException(
        'Selecione o mesmo arquivo original desta importação. Para outro arquivo, use uma nova importação.',
      );
  }
  async reprocess(
    id: string,
    version: number,
    options: {
      source?: { buffer: Buffer; statement: ParsedStatement };
      resetClassification?: boolean;
    } = {},
  ) {
    const { source, resetClassification } = options;
    const first = await this.imports.get(id);
    const account = await this.accounts.find(first.account_id, true);
    const batch = await this.imports.get(id, true);
    await this.validateSource(id, version, source?.buffer);
    if (!['mercado_pago', 'alelo'].includes(account.institution))
      throw new UnprocessableEntityException('O arquivo pertence ao importador Mercado Pago.');
    const previous = await this.repository.items(id);
    const statement: ParsedStatement = source?.statement ?? {
      sourceFormat: mercadoPagoSourceFormat(batch.mapper_version),
      reportType: batch.report_type,
      openingBalance:
        batch.opening_balance_minor === null ? null : Number(batch.opening_balance_minor),
      closingBalance:
        batch.closing_balance_minor === null ? null : Number(batch.closing_balance_minor),
      items: previous.map((item) => ({
        ...item,
        sourcePage: 1,
        metadata: item.metadata ?? undefined,
      })),
    };
    if ((statement.reportType ?? 'account_statement') !== batch.report_type)
      throw new ConflictException('O tipo de relatório da importação não pode ser substituído.');
    if (batch.report_type === 'account_statement') reconcileStatement(statement);
    const items = preserveImportReviews(statement, previous, resetClassification);
    if (!items.length || items.length > 10000)
      throw new UnprocessableEntityException('O relatório deve ter entre 1 e 10.000 movimentos.');
    await this.repository.replaceUnconfirmedSource(
      id,
      statement,
      items,
      statementMapperVersion(statement),
    );
    return this.imports.preview(id);
  }
}
