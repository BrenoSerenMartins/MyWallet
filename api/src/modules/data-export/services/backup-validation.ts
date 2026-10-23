import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupPayload } from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireUuid } from '../../../core/rest/index.js';
import { validatePlanningBackup } from './validate-planning-backup.js';
const fail = () => {
  throw new UnprocessableEntityException('O backup está inválido ou usa uma versão não suportada.');
};
function text(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
export function validateBackup(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object') return fail();
  const b = raw as BackupPayload;
  if (
    b.format !== 'mywallet' ||
    ![1, 2, 3].includes(b.version) ||
    b.currency !== 'BRL' ||
    !Array.isArray(b.accounts) ||
    !Array.isArray(b.categories) ||
    !Array.isArray(b.transactions) ||
    b.accounts.length > 1000 ||
    b.categories.length > 2000 ||
    b.transactions.length > 50000
  )
    return fail();
  const ids = new Set<string>();
  const unique = (id: string) => {
    requireUuid(id);
    if (ids.has(id)) fail();
    ids.add(id);
  };
  for (const a of b.accounts) {
    if (!a || typeof a !== 'object') fail();
    unique(a.id);
    if (
      !text(a.name, 100) ||
      !text(a.institution, 80) ||
      !['checking', 'savings', 'cash', 'reserve'].includes(a.type)
    )
      fail();
    dateOnly(a.openingDate);
    exactAmount(a.openingBalance);
  }
  const categoryGroups = b.version === 3 ? b.categoryGroups : [];
  if (!Array.isArray(categoryGroups) || categoryGroups.length > 2000) fail();
  for (const group of categoryGroups!) {
    if (!group || typeof group !== 'object') fail();
    unique(group.id);
    if (
      !text(group.name, 80) ||
      !['income', 'expense'].includes(group.type) ||
      !/^#[0-9a-f]{6}$/i.test(group.color)
    )
      fail();
  }
  for (const c of b.categories) {
    if (!c || typeof c !== 'object') fail();
    unique(c.id);
    if (c.groupId && !categoryGroups!.some((g) => g.id === c.groupId && g.type === c.type)) fail();
    if (
      !text(c.name, 80) ||
      !['income', 'expense'].includes(c.type) ||
      !/^#[0-9a-f]{6}$/i.test(c.color)
    )
      fail();
  }
  const accounts = new Map(b.accounts.map((a) => [a.id, a]));
  const categories = new Map(b.categories.map((c) => [c.id, c]));
  const groups = new Map<string, typeof b.transactions>();
  for (const t of b.transactions) {
    if (!t || typeof t !== 'object') fail();
    unique(t.id);
    dateOnly(t.transactionDate);
    exactAmount(t.amount);
    const account = accounts.get(t.accountId);
    const category = t.categoryId ? categories.get(t.categoryId) : null;
    if (
      !account ||
      !text(t.description, 500) ||
      !t.amount ||
      !['income', 'expense', 'transfer', 'unclassified'].includes(t.transactionType) ||
      t.transactionDate < account.openingDate
    )
      fail();
    if (t.categoryId && (!category || category.type !== t.transactionType)) fail();
    if (
      (t.transactionType === 'income' && t.amount < 0) ||
      (t.transactionType === 'expense' && t.amount > 0)
    )
      fail();
    if (t.sourceOperationId !== null && !text(t.sourceOperationId, 160)) fail();
    if (t.transferGroupId) {
      requireUuid(t.transferGroupId);
      if (t.transactionType !== 'transfer') fail();
      const group = groups.get(t.transferGroupId) ?? [];
      group.push(t);
      groups.set(t.transferGroupId, group);
    }
  }
  for (const pair of groups.values())
    if (
      pair.length !== 2 ||
      pair[0].accountId === pair[1].accountId ||
      pair[0].amount + pair[1].amount !== 0 ||
      pair[0].transactionDate !== pair[1].transactionDate
    )
      fail();
  return {
    ...b,
    categoryGroups,
    monthlyPlans:
      b.version >= 2 ? validatePlanningBackup(b.monthlyPlans, new Set(categories.keys())) : [],
  };
}
