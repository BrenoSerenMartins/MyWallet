import { expect, it } from 'vitest';
import type { PlanningLine } from '../../../shared/api/resources';
import { planningGroupTotals } from '../group-totals';
const line = (planned: number | null, actual: number) => ({ planned, actual }) as PlanningLine;
it('totals every subscription including an explicit zero budget', () => {
  expect(
    planningGroupTotals(
      [line(999, 0), line(9990, 0), line(0, 0), line(7480, 0), line(5400, 0)],
      'expense',
    ),
  ).toEqual({ planned: 23869, actual: 0, difference: 23869, missing: 0 });
});
it('includes spending without a budget and identifies a partial forecast', () => {
  expect(planningGroupTotals([line(10000, 9000), line(null, 3000)], 'expense')).toEqual({
    planned: 10000,
    actual: 12000,
    difference: -2000,
    missing: 1,
  });
});
it('keeps an undefined forecast distinct from an explicit zero', () => {
  expect(planningGroupTotals([line(null, 500)], 'expense')).toEqual({
    planned: null,
    actual: 500,
    difference: null,
    missing: 1,
  });
  expect(planningGroupTotals([line(0, 500)], 'expense').difference).toBe(-500);
});
it('uses received minus expected for income, and available minus spending for expenses', () => {
  expect(planningGroupTotals([line(10000, 12000), line(5000, 4000)], 'income').difference).toBe(
    1000,
  );
  expect(planningGroupTotals([line(10000, 12000), line(5000, 4000)], 'expense').difference).toBe(
    -1000,
  );
});
