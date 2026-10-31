export interface BankReference {
  importId: string;
  date: string;
  amount: number;
  key: string;
  rows: { date: string; key: string; transactionId: string | null }[];
}
export function coveredReferences(reference: BankReference, references: BankReference[]) {
  const included = new Set(references.filter((item) => item.date < reference.date));
  const keys = new Set(
    reference.rows.filter((row) => row.date === reference.date).map((row) => row.key),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of references) {
      if (item.date !== reference.date || included.has(item) || !keys.has(item.key)) continue;
      included.add(item);
      changed = true;
      for (const row of item.rows) if (row.date === reference.date) keys.add(row.key);
    }
  }
  return included;
}
// IDs identify operations, not time. Same-day order must be proved by source
// sequence/overlap, including transitive overlap; upload order never settles ties.
export function newestReference(references: BankReference[]) {
  if (!references.length) return { reference: null, conflict: false };
  const date = references.reduce((latest, item) => (item.date > latest ? item.date : latest), '');
  const recent = references.filter((item) => item.date === date);
  const candidates = recent.filter((item) => {
    const covered = coveredReferences(item, references);
    return recent.every((other) => covered.has(other));
  });
  const reference = candidates[0];
  if (
    !reference ||
    candidates.some((item) => item.key !== reference.key) ||
    recent.some((item) => item.key === reference.key && item.amount !== reference.amount)
  )
    return { reference: null, conflict: true };
  return { reference, conflict: false };
}
