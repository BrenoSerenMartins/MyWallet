import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupPayload } from '../../../core/integration/index.js';
import { dateOnly } from '../../../core/rest/index.js';
export function validateGoalsBackup(b: BackupPayload, unique: (id: string) => void) {
  const fail = (): never => {
    throw new UnprocessableEntityException('As metas e alocações do backup são inválidas.');
  };
  if (b.version < 13) {
    if (b.goals !== undefined) fail();
    return;
  }
  if (!b.goals || !Array.isArray(b.goals.goals) || b.goals.goals.length > 1000) fail();
  let count = 0;
  for (const g of b.goals!.goals) {
    if (!g || typeof g !== 'object') fail();
    unique(g.id);
    if (
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      g.name.length > 100 ||
      !Number.isSafeInteger(g.target) ||
      g.target <= 0 ||
      g.target > 1e12 ||
      ![1, 2, 3].includes(g.priority) ||
      !['active', 'completed', 'archived'].includes(g.status) ||
      !Array.isArray(g.allocations)
    )
      fail();
    if (g.deadline !== null) dateOnly(g.deadline);
    if (g.allocations.some((e) => !e || typeof e !== 'object')) fail();
    const events = new Map(g.allocations.map((e) => [e.id, e])),
      reversed = new Set<string>(),
      net = new Map<string, number>();
    for (const e of g.allocations) {
      if (!e || typeof e !== 'object' || ++count > 50000) fail();
      unique(e.id);
      if (
        !b.accounts.some(
          (a) =>
            a.id === e.accountId &&
            !['benefit_food', 'benefit_meal', 'credit_card', 'investment'].includes(a.type),
        ) ||
        !Number.isSafeInteger(e.delta) ||
        e.delta === 0 ||
        Math.abs(e.delta) > 1e12 ||
        typeof e.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(e.createdAt))
      )
        fail();
      if (e.reverseOfId !== null) {
        const original = events.get(e.reverseOfId);
        if (
          !original ||
          original.reverseOfId !== null ||
          original.accountId !== e.accountId ||
          original.delta !== -e.delta ||
          reversed.has(original.id)
        )
          fail();
        reversed.add(original!.id);
      }
      net.set(e.accountId, (net.get(e.accountId) ?? 0) + e.delta);
    }
    if (
      [...net.values()].some((n) => !Number.isSafeInteger(n) || n < 0) ||
      (g.status === 'archived' && [...net.values()].some((n) => n !== 0))
    )
      fail();
  }
}
