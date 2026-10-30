import { validateBalanceBackup } from './validate-balance-backup.js';
import { validateCounterpartyBackup } from './validate-counterparty-backup.js';
import { sourceEvidenceKey } from '../../../core/integration/index.js';
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
    ![1, 2, 3, 4, 5, 6].includes(b.version) ||
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
      !['checking', 'savings', 'cash', 'reserve', 'benefit_food', 'benefit_meal'].includes(a.type)
    )
      fail();
    if ((a.institution === 'alelo') !== ['benefit_food', 'benefit_meal'].includes(a.type)) fail();
    dateOnly(a.openingDate);
    exactAmount(a.openingBalance);
  }
  const categoryGroups = b.version >= 3 ? b.categoryGroups : [];
  if (!Array.isArray(categoryGroups) || categoryGroups.length > 2000) fail();
  const defaultTypes = new Set<string>();
  for (const group of categoryGroups!) {
    if (!group || typeof group !== 'object') fail();
    unique(group.id);
    if (group.isDefault !== undefined && typeof group.isDefault !== 'boolean') fail();
    if (group.isDefault) {
      if (defaultTypes.has(group.type)) fail();
      defaultTypes.add(group.type);
    }
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
  validateCounterpartyBackup(b, unique);
  const accounts = new Map(b.accounts.map((a) => [a.id, a]));
  const categories = new Map(b.categories.map((c) => [c.id, c]));
  const groups = new Map<string, typeof b.transactions>();
  const sourceKeys = new Set<string>();
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
      !['income', 'expense', 'transfer', 'unclassified'].includes(t.transactionType)
    )
      fail();
    if (t.categoryId && (!category || category.type !== t.transactionType)) fail();
    if (
      !t.refundOfId &&
      ((t.transactionType === 'income' && t.amount < 0) ||
        (t.transactionType === 'expense' && t.amount > 0))
    )
      fail();
    if (t.sourceOperationId !== null && !text(t.sourceOperationId, 160)) fail();
    if (t.balanceAdjustment != null) {
      const adjustment = t.balanceAdjustment;
      exactAmount(adjustment.previousBalance);
      exactAmount(adjustment.targetBalance);
      if (
        b.version < 4 ||
        !text(adjustment.reason, 500) ||
        t.transactionType !== 'transfer' ||
        t.categoryId ||
        t.transferGroupId ||
        adjustment.targetBalance - adjustment.previousBalance !== t.amount
      )
        fail();
    }
    if (t.sourceEvidence !== undefined) {
      if (
        !Array.isArray(t.sourceEvidence) ||
        t.sourceEvidence.length > 100 ||
        (b.version < 4 && t.sourceEvidence.length > 0)
      )
        fail();
      for (const evidence of t.sourceEvidence ?? []) {
        if (
          !evidence ||
          !['account_statement', 'settlement', 'benefit_statement'].includes(evidence.reportType) ||
          !(evidence.reportType === 'benefit_statement'
            ? evidence.reference === '' &&
              evidence.institution === 'alelo' &&
              text(evidence.description, 500) &&
              Number.isInteger(evidence.occurrence) &&
              evidence.occurrence! > 0 &&
              evidence.occurrence! <= 10000
            : text(evidence.reference, 160))
        )
          fail();
        if (
          evidence.storeId !== undefined &&
          (evidence.reportType !== 'settlement' || !text(evidence.storeId, 100))
        )
          fail();
        if (evidence.description !== undefined && !text(evidence.description, 500)) fail();
        if (evidence.ruleVersion !== undefined && !text(evidence.ruleVersion, 80)) fail();
        dateOnly(evidence.date);
        if (evidence.originDate != null) dateOnly(evidence.originDate);
        exactAmount(evidence.amount);
        if (!evidence.amount) fail();
        if (evidence.reportType === 'account_statement' && evidence.balance === null) fail();
        if (evidence.reportType === 'settlement' && (!evidence.eventType || !evidence.timestamp))
          fail();
        if (evidence.balance !== null) exactAmount(evidence.balance);
        if (evidence.eventType !== null && !text(evidence.eventType, 100)) fail();
        if (
          evidence.timestamp !== null &&
          (!text(evidence.timestamp, 64) || !Number.isFinite(Date.parse(evidence.timestamp!)))
        )
          fail();
        if (
          evidence.installmentNumber !== null &&
          (!Number.isInteger(evidence.installmentNumber) ||
            evidence.installmentNumber < 1 ||
            evidence.installmentNumber > 999)
        )
          fail();
        const key = t.accountId + sourceEvidenceKey(evidence);
        if (sourceKeys.has(key)) fail();
        sourceKeys.add(key);
      }
    }
    if (t.transferGroupId) {
      requireUuid(t.transferGroupId);
      if (t.transactionType !== 'transfer') fail();
      const group = groups.get(t.transferGroupId) ?? [];
      group.push(t);
      groups.set(t.transferGroupId, group);
    }
  }
  const transactions = new Map(b.transactions.map((row) => [row.id, row]));
  const refunds = new Map<string, number>();
  for (const transaction of b.transactions)
    if (transaction.refundOfId) {
      requireUuid(transaction.refundOfId);
      const original = transactions.get(transaction.refundOfId);
      if (
        b.version < 4 ||
        !original ||
        original.refundOfId ||
        original.balanceAdjustment ||
        !['income', 'expense'].includes(original.transactionType) ||
        transaction.accountId !== original.accountId ||
        transaction.categoryId !== original.categoryId ||
        transaction.transactionType !== original.transactionType ||
        transaction.amount * original.amount >= 0 ||
        transaction.transactionDate < original.transactionDate ||
        transaction.balanceAdjustment ||
        transaction.transferGroupId
      )
        fail();
      const amount = (refunds.get(original!.id) ?? 0) + Math.abs(transaction.amount);
      if (amount > Math.abs(original!.amount)) fail();
      refunds.set(original!.id, amount);
    }
  for (const pair of groups.values())
    if (
      pair.length !== 2 ||
      pair[0].accountId === pair[1].accountId ||
      pair[0].amount + pair[1].amount !== 0 ||
      pair[0].transactionDate !== pair[1].transactionDate
    )
      fail();
  validateBalanceBackup(b, unique);
  return {
    ...b,
    categoryGroups,
    monthlyPlans:
      b.version >= 2 ? validatePlanningBackup(b.monthlyPlans, new Set(categories.keys())) : [],
  };
}
