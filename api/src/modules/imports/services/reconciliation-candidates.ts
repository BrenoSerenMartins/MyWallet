import { sourceEvidenceKey } from '../../../core/integration/index.js';
import type { ReconciliationCandidate } from '../repositories/import-reconciliation.repository.js';
const key = (date: string, amount: number, reference?: string | null) =>
  JSON.stringify([date, amount, reference ?? null]);
export function reconciliationCandidates(candidates: ReconciliationCandidate[]) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const bySource = new Map<string, ReconciliationCandidate>();
  const byOriginal = new Map<string, ReconciliationCandidate[]>();
  const byCash = new Map<string, ReconciliationCandidate[]>();
  const byReference = new Map<string, ReconciliationCandidate[]>();
  for (const candidate of candidates) {
    for (const source of candidate.evidence) bySource.set(source.key, candidate);
    if (candidate.source?.reportType === 'account_statement')
      append(byOriginal, sourceEvidenceKey(candidate.source), candidate);
    append(byCash, key(candidate.date, candidate.amount), candidate);
    if (candidate.reference)
      append(byReference, key(candidate.date, candidate.amount, candidate.reference), candidate);
  }
  return {
    byId,
    bySource,
    byOriginal,
    similar: (dates: string[], amount: number) =>
      unique(dates.flatMap((date) => byCash.get(key(date, amount)) ?? [])),
    exact: (dates: string[], amount: number, reference: string | null) =>
      reference
        ? unique(dates.flatMap((date) => byReference.get(key(date, amount, reference)) ?? []))
        : [],
  };
}
function append(
  map: Map<string, ReconciliationCandidate[]>,
  key: string,
  candidate: ReconciliationCandidate,
) {
  const rows = map.get(key) ?? [];
  rows.push(candidate);
  map.set(key, rows);
}
function unique(rows: ReconciliationCandidate[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
