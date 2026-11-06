import {
  ConflictException,
  Optional,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CARD_FORECAST,
  type CardForecast,
  type PlannedCardBill,
  ACCOUNT_READS,
  periodBudget,
  type AccountReads,
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
    @Inject(ACCOUNT_READS) private readonly accounts: AccountReads,
    @Optional() @Inject(CARD_FORECAST) private readonly cards?: CardForecast,
  ) {}
  async summary(month: string, scope: 'all' | 'cash' | 'benefits' = 'all') {
    const { from, to } = planningPeriod(month);
    const saved = await this.repository.find(month);
    const summary = planningSummary(
      month,
      saved,
      await this.categories.list(true),
      await this.ledger.planningActuals(from, to, scope, true),
    );
    const preferences = saved?.cardPlans ?? [];
    const allBills = scope === 'benefits' ? [] : ((await this.cards?.planningBills(month)) ?? []);
    const cardBills = allBills
      .filter(
        (b) =>
          b.billMonth === month ||
          (b.billMonth < month &&
            (b.remaining > 0 ||
              b.paid > 0 ||
              preferences.some((p) => p.accountId === b.accountId && p.billMonth === b.billMonth))),
      )
      .map((b) => {
        const preference = preferences.find(
          (p) => p.accountId === b.accountId && p.billMonth === b.billMonth,
        );
        return {
          ...b,
          included: preference?.included ?? b.billMonth === month,
          planned: preference?.planned ?? b.amount,
          automatic: preference?.planned == null,
        };
      });
    const selected = cardBills.filter((b) => b.included);
    if (selected.length) {
      const planned = selected.reduce((sum, b) => sum + b.planned, 0);
      const paid = selected.reduce((sum, b) => sum + b.paid, 0);
      const t = summary.totals;
      t.plannedExpense = (t.plannedExpense ?? 0) + planned;
      t.actualExpense += paid;
      t.actualResult = t.actualIncome - t.actualExpense;
      t.expenseDifference = t.plannedExpense - t.actualExpense;
      t.plannedResult = t.plannedIncome === null ? null : t.plannedIncome - t.plannedExpense;
      t.resultDifference = t.plannedResult === null ? null : t.actualResult - t.plannedResult;
      t.afterContribution =
        t.plannedResult === null || summary.contribution === null
          ? null
          : t.plannedResult - summary.contribution;
    }
    const accounts = await this.accounts.list();
    const budget = periodBudget(
      from,
      to,
      accounts,
      await this.accounts.positions([from, to]),
      await this.ledger.budgetActivity(from, to),
      scope,
    );
    return {
      ...summary,
      cardPlans: preferences,
      cardBills,
      budget,
      benefitAccounts: (await this.accounts.list())
        .filter((a) => ['benefit_food', 'benefit_meal'].includes(a.type))
        .map((a) => ({
          id: a.id,
          version: a.version,
          name: a.name,
          benefitCreditMonth: a.benefitCreditMonth ?? 'received',
        })),
    };
  }
  async save(month: string, input: SaveMonthlyPlanDto) {
    planningPeriod(month);
    await this.repository.lock(month);
    requireVersion((await this.repository.find(month))?.version ?? 0, input.version);
    await this.validateLines(input.lines);
    const cardPlans = input.cardPlans ?? (await this.repository.find(month))?.cardPlans ?? [];
    await this.validateCardPlans(month, cardPlans);
    await this.repository.save({
      month,
      notes: input.notes,
      contribution: input.contribution ?? null,
      lines: input.lines,
      cardPlans,
    });
    return this.summary(month);
  }
  private async validateCardPlans(month: string, preferences: PlannedCardBill[]) {
    const accounts = await this.accounts.list();
    const seen = new Set<string>();
    for (const p of preferences) {
      planningPeriod(p.billMonth);
      const key = `${p.accountId}:${p.billMonth}`;
      if (
        p.billMonth > month ||
        seen.has(key) ||
        accounts.find((a) => a.id === p.accountId)?.type !== 'credit_card'
      )
        throw new UnprocessableEntityException(
          'Confira os cartões e faturas selecionados para o mês.',
        );
      seen.add(key);
    }
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
      cardPlans: (source.cardPlans ?? [])
        .filter((p) => p.billMonth === previous)
        .map((p) => ({ ...p, billMonth: month, planned: null })),
    });
    return this.summary(month);
  }
  exportRecords() {
    return this.repository.exportRecords();
  }
  async restoreRecords(
    plans: BackupMonthlyPlan[],
    categories: Map<string, string>,
    accounts = new Map<string, string>(),
  ) {
    for (const plan of [...plans].sort((a, b) => a.month.localeCompare(b.month))) {
      await this.repository.lock(plan.month);
      if (await this.repository.find(plan.month))
        throw new ConflictException(
          `Já existe um planejamento em ${plan.month}. Restaure em outro espaço para preservar os dois.`,
        );
      await this.repository.save({
        ...plan,
        cardPlans: (plan.cardPlans ?? []).map((p) => ({
          ...p,
          accountId: accounts.get(p.accountId)!,
        })),
        lines: plan.lines.map((line) => ({
          ...line,
          categoryId: categories.get(line.categoryId)!,
        })),
      });
    }
  }
}
