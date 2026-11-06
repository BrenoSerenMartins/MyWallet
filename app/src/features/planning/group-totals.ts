import type { PlanningLine } from '../../shared/api/resources';

export function planningGroupTotals(lines: PlanningLine[], type: 'income' | 'expense') {
  const defined = lines.filter((line) => line.planned !== null);
  const planned = defined.length ? defined.reduce((sum, line) => sum + line.planned!, 0) : null;
  const actual = lines.reduce((sum, line) => sum + line.actual, 0);
  return {
    planned,
    actual,
    difference: planned === null ? null : type === 'income' ? actual - planned : planned - actual,
    missing: lines.length - defined.length,
  };
}
