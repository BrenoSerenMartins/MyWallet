export interface DuplicateSource {
  transactionDate: string;
  amount: number;
  description: string;
  sourceOperationId: string | null;
  balanceAfter: number | null;
}
export type DuplicateReason = 'recorded' | 'same_statement' | 'similar' | null;
function sourceIdentity(item: DuplicateSource) {
  if (!item.sourceOperationId || item.balanceAfter === null) return null;
  return JSON.stringify([
    item.transactionDate,
    item.amount,
    item.sourceOperationId,
    item.balanceAfter,
  ]);
}
function similarMovement(item: DuplicateSource, recorded: DuplicateSource) {
  if (item.sourceOperationId && recorded.sourceOperationId)
    return item.sourceOperationId === recorded.sourceOperationId;
  return (
    item.description.trim().toLocaleLowerCase('pt-BR') ===
    recorded.description.trim().toLocaleLowerCase('pt-BR')
  );
}
// Source references are not unique. Date, exact amount and source running balance
// distinguish legitimate repeated references; matches consume recorded occurrences.
export function detectDuplicates(
  items: DuplicateSource[],
  recorded: DuplicateSource[],
): DuplicateReason[] {
  const identities = new Map<string, number>();
  const candidates = new Map<string, DuplicateSource[]>();
  for (const entry of recorded) {
    const identity = sourceIdentity(entry);
    if (identity) identities.set(identity, (identities.get(identity) ?? 0) + 1);
    const key = `${entry.transactionDate}:${entry.amount}`;
    const group = candidates.get(key) ?? [];
    group.push(entry);
    candidates.set(key, group);
  }
  const seen = new Set<string>();
  return items.map((item) => {
    const identity = sourceIdentity(item);
    if (identity && seen.has(identity)) return 'same_statement';
    if (identity) seen.add(identity);
    if (identity && (identities.get(identity) ?? 0) > 0) {
      identities.set(identity, identities.get(identity)! - 1);
      return 'recorded';
    }
    const matches = candidates.get(`${item.transactionDate}:${item.amount}`) ?? [];
    return matches.some(
      (entry) =>
        similarMovement(item, entry) &&
        (entry.balanceAfter === null ||
          item.balanceAfter === null ||
          !entry.sourceOperationId ||
          !item.sourceOperationId),
    )
      ? 'similar'
      : null;
  });
}
