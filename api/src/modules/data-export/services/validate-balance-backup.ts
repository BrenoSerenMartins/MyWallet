import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupPayload, BalanceBasis } from '../../../core/integration/index.js';
import { dateOnly, exactAmount, requireUuid } from '../../../core/rest/index.js';
const fail = () => {
  throw new UnprocessableEntityException('O histórico do saldo base no backup está inválido.');
};
function basis(value: BalanceBasis | undefined) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !['unknown', 'legacy', 'statement', 'manual'].includes(value.kind)
  )
    fail();
  if (value!.referenceDate !== undefined) dateOnly(value!.referenceDate);
  if (value!.referenceBalance !== undefined) exactAmount(value!.referenceBalance);
  if (
    ['manual', 'statement'].includes(value!.kind) &&
    (!value!.referenceDate || value!.referenceBalance === undefined || !value!.originId)
  )
    fail();
  if (value!.originId) requireUuid(value!.originId);
  if (value!.importId) requireUuid(value!.importId);
  if (
    value!.reviewReason !== undefined &&
    !['same_day', 'statement_conflict'].includes(value!.reviewReason)
  )
    fail();
  if (value!.reviewRequired !== undefined && typeof value!.reviewRequired !== 'boolean') fail();
}
export function validateBalanceBackup(payload: BackupPayload, unique: (id: string) => void) {
  if (payload.version < 6) {
    if (
      payload.balanceHistory !== undefined ||
      payload.accounts.some((a) => a.balanceBasis !== undefined) ||
      payload.transactions.some((t) => t.balanceBasisIncluded !== undefined)
    ) {
      // Older exports of accounts may have additive read fields. They never carry a manual observation.
      if (
        payload.balanceHistory?.length ||
        payload.accounts.some((a) => a.balanceBasis && a.balanceBasis.kind === 'manual')
      )
        fail();
    }
    return;
  }
  if (!Array.isArray(payload.balanceHistory) || payload.balanceHistory.length > 50000) fail();
  const accounts = new Set(payload.accounts.map((a) => a.id));
  const events = new Map(payload.balanceHistory!.map((event) => [event.id, event]));
  for (const event of payload.balanceHistory!) {
    unique(event.id);
    if (
      !accounts.has(event.accountId) ||
      !['manual', 'statement', 'rebase', 'undo', 'legacy_conversion'].includes(event.operation)
    )
      fail();
    exactAmount(event.previousBase);
    exactAmount(event.newBase);
    basis(event.previousBasis);
    basis(event.newBasis);
    if (
      typeof event.reason !== 'string' ||
      !event.reason.trim() ||
      event.reason.length > 500 ||
      typeof event.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(event.createdAt))
    )
      fail();
    if (
      !event.details ||
      typeof event.details !== 'object' ||
      Array.isArray(event.details) ||
      JSON.stringify(event.details).length > 8_000_000
    )
      fail();
    const legacy = event.details.legacyCorrections;
    if (legacy !== undefined) {
      if (!Array.isArray(legacy) || legacy.length > 50000) fail();
      for (const row of legacy as any[]) {
        if (!row || typeof row !== 'object' || !row.adjustment) fail();
        requireUuid(row.id);
        dateOnly(row.date);
        exactAmount(row.amount);
        exactAmount(row.adjustment.previousBalance);
        exactAmount(row.adjustment.targetBalance);
        if (
          row.adjustment.targetBalance - row.adjustment.previousBalance !== row.amount ||
          typeof row.adjustment.reason !== 'string' ||
          !row.adjustment.reason.trim() ||
          row.adjustment.reason.length > 500
        )
          fail();
      }
    }
    const known = event.details.knownSameDayIds;
    if (known !== undefined) {
      if (!Array.isArray(known) || known.length > 50000) fail();
      for (const id of known as string[]) requireUuid(id);
    }
    if (event.undoOfId && events.get(event.undoOfId)?.accountId !== event.accountId) fail();
    for (const ref of [event.previousBasis, event.newBasis])
      if (ref.originId && events.get(ref.originId)?.accountId !== event.accountId) fail();
  }
  for (const transaction of payload.transactions) {
    if (transaction.balanceAdjustment || typeof transaction.balanceBasisIncluded !== 'boolean')
      fail();
  }
  for (const account of payload.accounts) {
    basis(account.balanceBasis);
    const b = account.balanceBasis!;
    if (b.originId && events.get(b.originId)?.accountId !== account.id) fail();
    if (['manual', 'statement'].includes(b.kind)) {
      const net = payload.transactions
        .filter(
          (t) =>
            t.accountId === account.id &&
            (t.transactionDate < b.referenceDate! ||
              (b.kind === 'manual' &&
                t.transactionDate === b.referenceDate &&
                t.balanceBasisIncluded)),
        )
        .reduce((sum, t) => sum + BigInt(t.amount), 0n);
      if (BigInt(account.openingBalance) !== BigInt(b.referenceBalance!) - net) fail();
    }
  }
}
