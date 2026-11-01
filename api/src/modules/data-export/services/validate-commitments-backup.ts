import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupPayload, CommitmentSnapshot } from '../../../core/integration/index.js';
import { dateOnly, requireUuid } from '../../../core/rest/index.js';
export function validateCommitmentsBackup(
  b: BackupPayload,
  unique: (id: string) => void,
): CommitmentSnapshot {
  const fail = (): never => {
    throw new UnprocessableEntityException('Os compromissos do backup são inválidos.');
  };
  const empty = { schedules: [], occurrences: [] };
  if (b.version < 8) {
    if (b.commitments !== undefined) fail();
    return empty;
  }
  const data = b.commitments;
  if (
    !data ||
    !Array.isArray(data.schedules) ||
    !Array.isArray(data.occurrences) ||
    data.schedules.length > 200 ||
    data.occurrences.length > 50000
  )
    return fail();
  const accounts = new Set(b.accounts.map((a) => a.id));
  const categories = new Map(b.categories.map((c) => [c.id, c]));
  const snapshot = (row: CommitmentSnapshot['occurrences'][number]['snapshot']) => {
    if (
      !row ||
      !accounts.has(row.accountId) ||
      typeof row.description !== 'string' ||
      !row.description.trim() ||
      row.description.length > 120 ||
      !Number.isSafeInteger(row.amount) ||
      row.amount < 1 ||
      row.amount > 1000000000000 ||
      !['income', 'expense'].includes(row.transactionType) ||
      !(
        row.categoryId === null ||
        (typeof row.categoryId === 'string' &&
          categories.get(row.categoryId)?.type === row.transactionType)
      )
    )
      fail();
  };
  const date = (value: string) => {
    dateOnly(value);
    if (value < '1900-01-01' || value > '9998-12-31') fail();
  };
  for (const rule of data.schedules) {
    if (!rule || typeof rule !== 'object') fail();
    unique(rule.id);
    snapshot(rule);
    date(rule.startDate);
    if (
      !['once', 'monthly'].includes(rule.frequency) ||
      !Number.isInteger(rule.version) ||
      rule.version < 1
    )
      fail();
    if (rule.endDate !== null) {
      date(rule.endDate);
      if (rule.endDate < rule.startDate) fail();
    }
    if (rule.endedOn !== null) date(rule.endedOn);
  }
  const schedules = new Map(data.schedules.map((s) => [s.id, s]));
  const occurrences = new Set<string>();
  const used = new Set<string>();
  const transactions = new Map(b.transactions.map((t) => [t.id, t]));
  for (const record of data.occurrences) {
    if (!record || typeof record !== 'object') fail();
    requireUuid(record.scheduleId);
    date(record.dueDate);
    snapshot(record.snapshot);
    const rule = schedules.get(record.scheduleId) ?? fail();
    const key = `${record.scheduleId}:${record.dueDate}`;
    if (
      !rule ||
      occurrences.has(key) ||
      record.snapshot.accountId !== rule.accountId ||
      record.snapshot.transactionType !== rule.transactionType ||
      record.dueDate < rule.startDate ||
      !['settled', 'skipped', 'review'].includes(record.status)
    )
      fail();
    occurrences.add(key);
    if (rule.frequency === 'once' && record.dueDate !== rule.startDate) fail();
    if (rule.frequency === 'monthly') {
      const last = new Date(
        Date.UTC(Number(record.dueDate.slice(0, 4)), Number(record.dueDate.slice(5, 7)), 0),
      ).getUTCDate();
      if (Number(record.dueDate.slice(8)) !== Math.min(Number(rule.startDate.slice(8)), last))
        fail();
    }
    if (record.status !== 'settled') {
      if (record.transactionId !== null) fail();
    } else {
      if (!record.transactionId || used.has(record.transactionId)) fail();
      const t = transactions.get(record.transactionId!);
      if (
        !t ||
        t.refundOfId ||
        t.balanceAdjustment ||
        t.transferGroupId ||
        t.accountId !== record.snapshot.accountId ||
        t.transactionType !== record.snapshot.transactionType ||
        Math.sign(t.amount) !== (record.snapshot.transactionType === 'income' ? 1 : -1)
      )
        fail();
      used.add(record.transactionId!);
    }
  }
  return data;
}
