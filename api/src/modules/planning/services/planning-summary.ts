import type { CategoryResource, PlanningActual } from '../../../core/integration/index.js';
import { exactAmount } from '../../../core/rest/index.js';
import type { MonthlyPlanResourceDto, PlanningLineResourceDto } from '../dto/planning.dto.js';
import type { SavedMonthlyPlan } from '../repositories/planning.repository.js';
function sum(values: number[]) {
  return exactAmount(values.reduce((total, value) => total + exactAmount(value), 0));
}
function plannedTotal(lines: PlanningLineResourceDto[], type: string) {
  const filled = lines.filter((l) => l.type === type && l.planned !== null);
  return filled.length ? sum(filled.map((l) => l.planned!)) : null;
}
export function planningSummary(
  month: string,
  plan: SavedMonthlyPlan | null,
  categories: CategoryResource[],
  actuals: PlanningActual[],
): MonthlyPlanResourceDto {
  const lines: PlanningLineResourceDto[] = categories.map((c) => {
    const actual = actuals.find((a) => a.categoryId === c.id && a.type === c.type);
    const planned = plan?.lines.find((l) => l.categoryId === c.id)?.amount ?? null;
    const amount = actual ? exactAmount(Math.abs(actual.amount)) : 0;
    return {
      difference:
        planned === null
          ? null
          : exactAmount(c.type === 'income' ? amount - planned : planned - amount),
      categoryId: c.id,
      groupId: c.groupId ?? null,
      groupName: c.groupName ?? null,
      name: c.name,
      type: c.type as 'income' | 'expense',
      color: c.color,
      archived: c.archived ?? false,
      planned,
      actual: amount,
      transactionCount: actual?.count ?? 0,
    };
  });
  for (const type of ['income', 'expense'] as const) {
    const unmatched = actuals.filter(
      (a) => a.type === type && !categories.some((c) => c.id === a.categoryId && c.type === a.type),
    );
    if (unmatched.length)
      lines.push({
        categoryId: null,
        groupId: null,
        groupName: 'Outros',
        difference: null,
        name: 'Outros',
        type,
        color: type === 'expense' ? '#f28a97' : '#5ee9b5',
        archived: false,
        planned: null,
        actual: sum(unmatched.map((a) => Math.abs(a.amount))),
        transactionCount: sum(unmatched.map((a) => a.count)),
      });
  }
  const plannedIncome = plannedTotal(lines, 'income');
  const plannedExpense = plannedTotal(lines, 'expense');
  const actualIncome = sum(lines.filter((l) => l.type === 'income').map((l) => l.actual));
  const actualExpense = sum(lines.filter((l) => l.type === 'expense').map((l) => l.actual));
  const plannedResult =
    plannedIncome === null || plannedExpense === null
      ? null
      : exactAmount(plannedIncome - plannedExpense);
  const unknown = actuals.filter((a) => a.type === 'unclassified');
  return {
    month,
    version: plan?.version ?? 0,
    notes: plan?.notes ?? '',
    contribution: plan?.contribution ?? null,
    lines,
    totals: {
      incomeDifference: plannedIncome === null ? null : exactAmount(actualIncome - plannedIncome),
      expenseDifference:
        plannedExpense === null ? null : exactAmount(plannedExpense - actualExpense),
      resultDifference:
        plannedResult === null ? null : exactAmount(actualIncome - actualExpense - plannedResult),
      plannedIncome,
      plannedExpense,
      actualIncome,
      actualExpense,
      plannedResult,
      actualResult: exactAmount(actualIncome - actualExpense),
      afterContribution:
        plannedResult === null || plan?.contribution == null
          ? null
          : exactAmount(plannedResult - plan.contribution),
      missingCategoryCount: sum(
        lines.filter((l) => l.categoryId === null).map((l) => l.transactionCount),
      ),
      unclassifiedCount: sum(unknown.map((a) => a.count)),
      unclassifiedInflow: sum(unknown.map((a) => a.inflow)),
      unclassifiedOutflow: sum(unknown.map((a) => a.outflow)),
    },
  };
}
