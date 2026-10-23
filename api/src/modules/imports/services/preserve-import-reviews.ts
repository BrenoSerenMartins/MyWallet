import { randomUUID } from 'node:crypto';
import type {
  ParsedStatement,
  SavedImportItem,
  ReprocessedImportEntry,
  StatementRow,
} from '../contracts/statement.js';
import { mapMercadoPago } from '../mappers/mercado-pago/statement.mapper.js';
function sourceIdentity(
  item: Pick<
    StatementRow,
    'transactionDate' | 'amount' | 'balanceAfter' | 'sourceOperationId' | 'description'
  >,
) {
  return JSON.stringify([
    item.transactionDate,
    item.amount,
    item.balanceAfter,
    item.sourceOperationId,
    item.sourceOperationId ? null : item.description,
  ]);
}
// Match source occurrences, not row numbers: a parser update can change grouping.
// Existing defined types are preserved conservatively; older rows do not record
// whether their type was chosen manually or by an earlier mapper.
export function preserveImportReviews(
  statement: ParsedStatement,
  previous: SavedImportItem[],
  resetClassification = false,
): ReprocessedImportEntry[] {
  const matches = new Map<string, SavedImportItem[]>();
  for (const item of previous) {
    const identity = sourceIdentity(item),
      group = matches.get(identity) ?? [];
    group.push(item);
    matches.set(identity, group);
  }
  return mapMercadoPago(statement).map((item) => {
    const old = matches.get(sourceIdentity(item))?.shift();
    const transactionType =
      !resetClassification && old && old.transactionType !== 'unclassified'
        ? old.transactionType
        : item.transactionType;
    return {
      ...item,
      id: old?.id ?? randomUUID(),
      selected: old?.selected ?? true,
      categoryId: old?.transactionType === transactionType ? old.categoryId : null,
      transactionType,
      duplicateCandidate: false,
    };
  });
}
