import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CATEGORY_READS,
  LEDGER_READS,
  type CategoryReads,
  type LedgerReads,
  type BackupMonthlyPlan,
  type PlanningBackup,
} from '../../../core/integration/index.js';
import { requireVersion } from '../../../core/rest/index.js';
import { PlanningRepository } from '../repositories/planning.repository.js';
import type { CopyMonthlyPlanDto, SaveMonthlyPlanDto } from '../dto/planning.dto.js';
import { planningPeriod } from './planning-period.js';
import { planningSummary } from './planning-summary.js';
@Injectable()
export class PlanningService implements PlanningBackup {
  constructor(
    @Inject(PlanningRepository) private readonly repository: PlanningRepository,
    @Inject(CATEGORY_READS) private readonly categories: CategoryReads,
    @Inject(LEDGER_READS) private readonly ledger: LedgerReads,
  ) {}
  async summary(month: string) {
    const { from, to } = planningPeriod(month);
    return planningSummary(
      month,
      await this.repository.find(month),
      await this.categories.list(true),
      await this.ledger.planningActuals(from, to),
    );
  }
  async save(month: string, input: SaveMonthlyPlanDto) {
    planningPeriod(month);
    await this.repository.lock(month);
    requireVersion((await this.repository.find(month))?.version ?? 0, input.version);
    await this.validateLines(input.lines);
    await this.repository.save({
      month,
      notes: input.notes,
      contribution: input.contribution ?? null,
      lines: input.lines,
    });
    return this.summary(month);
  }
  private async validateLines(lines: { categoryId: string; amount: number }[]) {
    if (new Set(lines.map((l) => l.categoryId)).size !== lines.length)
      throw new UnprocessableEntityException(
        'Uma categoria não pode aparecer duas vezes no planejamento.',
      );
    const categories = await this.categories.list(true);
    if (lines.some((l) => !categories.some((c) => c.id === l.categoryId)))
      throw new UnprocessableEntityException('Categoria não encontrada neste espaço.');
  }
  async copyPrevious(month: string, input: CopyMonthlyPlanDto) {
    const { previous } = planningPeriod(month);
    planningPeriod(previous);
    for (const value of [previous, month].sort()) await this.repository.lock(value);
    const source = await this.repository.find(previous);
    if (!source) throw new NotFoundException('O mês anterior ainda não tem um planejamento salvo.');
    requireVersion(source.version, input.sourceVersion);
    const target = await this.repository.find(month);
    requireVersion(target?.version ?? 0, input.version);
    await this.repository.save({
      month,
      notes: target?.notes ?? '',
      contribution: source.contribution,
      lines: source.lines,
    });
    return this.summary(month);
  }
  exportRecords() {
    return this.repository.exportRecords();
  }
  async restoreRecords(plans: BackupMonthlyPlan[], categories: Map<string, string>) {
    for (const plan of [...plans].sort((a, b) => a.month.localeCompare(b.month))) {
      await this.repository.lock(plan.month);
      if (await this.repository.find(plan.month))
        throw new ConflictException(
          `Já existe um planejamento em ${plan.month}. Restaure em outro espaço para preservar os dois.`,
        );
      await this.repository.save({
        ...plan,
        lines: plan.lines.map((line) => ({
          ...line,
          categoryId: categories.get(line.categoryId)!,
        })),
      });
    }
  }
}
