import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupMonthlyPlan } from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireUuid } from '../../../core/rest/index.js';
export function validatePlanningBackup(
  raw: unknown,
  categoryIds: Set<string>,
): BackupMonthlyPlan[] {
  const fail = () => {
    throw new UnprocessableEntityException('Os planejamentos do backup são inválidos.');
  };
  if (!Array.isArray(raw) || raw.length > 1200) return fail();
  const months = new Set<string>();
  for (const plan of raw) {
    if (
      !plan ||
      typeof plan !== 'object' ||
      typeof plan.month !== 'string' ||
      !/^(?:19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/.test(plan.month) ||
      plan.month.startsWith('9999') ||
      months.has(plan.month)
    )
      return fail();
    dateOnly(`${plan.month}-01`);
    months.add(plan.month);
    if (
      typeof plan.notes !== 'string' ||
      plan.notes.length > 1000 ||
      !Array.isArray(plan.lines) ||
      plan.lines.length > 2000
    )
      return fail();
    if (
      plan.contribution !== null &&
      (!Number.isSafeInteger(plan.contribution) ||
        plan.contribution < 0 ||
        plan.contribution > 1000000000000)
    )
      return fail();
    const seen = new Set<string>();
    for (const line of plan.lines) {
      if (!line || typeof line !== 'object') return fail();
      requireUuid(line.categoryId);
      exactAmount(line.amount);
      if (
        !categoryIds.has(line.categoryId) ||
        seen.has(line.categoryId) ||
        line.amount < 0 ||
        line.amount > 1000000000000
      )
        return fail();
      seen.add(line.categoryId);
    }
  }
  return raw;
}
