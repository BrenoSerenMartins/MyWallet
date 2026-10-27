import {
  comparableCounterpartyIdentifier,
  isSpecificCounterpartyIdentifier,
  type CounterpartySnapshot,
  type CounterpartyCandidate,
  type SourceKind,
} from '../../../core/integration/index.js';

const boilerplate = new Set(
  'pix enviado enviada recebido recebida pagamento pagamentos com qr cartao credito debito transferencia transferido recebimento compra para por de da do das dos ao a o em no na via'.split(
    ' ',
  ),
);
const genericNames = new Set(
  'mercado supermercado loja restaurante padaria posto banco pessoa estabelecimento pagamento transferencia rendimento dinheiro'.split(
    ' ',
  ),
);
const words = (value: string) =>
  comparableCounterpartyIdentifier(value)
    .split(' ')
    .filter((word) => word && !boilerplate.has(word) && !/^\d+$/.test(word));
const meaningful = (value: string) => {
  const parts = words(value);
  return (
    (parts.length >= 2 && parts.some((part) => part.length >= 3 && !genericNames.has(part))) ||
    (parts.length === 1 && parts[0].length >= 5 && !genericNames.has(parts[0]))
  );
};
function oneEdit(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) {
      i += 2;
      j += 2;
      continue;
    }
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}
function resemblance(
  identity: string[],
  description: string[],
): CounterpartyCandidate['reason'] | null {
  const phrase = ` ${description.join(' ')} `;
  if (phrase.includes(` ${identity.join(' ')} `)) return 'name';
  if (identity.length < 2) return null;
  // Abbreviations and omitted middle names are suggestions, never identities.
  const first = identity[0],
    last = identity.at(-1)!;
  for (let i = 0; i < description.length - 1; i++) {
    const start = description[i];
    if (!(start === first || (start.length === 1 && start === first[0]))) continue;
    for (const end of description.slice(i + 1)) {
      if (last.length >= 4 && end === last) return 'abbreviation';
      if (end.length >= 4 && last.length > end.length && last.startsWith(end))
        return 'abbreviation';
      if (last.length >= 5 && end !== last && oneEdit(last, end)) return 'similar_description';
    }
  }
  return null;
}

export function counterpartyRecognition(
  state: CounterpartySnapshot,
  accountId: string,
  sourceKind: SourceKind,
) {
  const agents = state.agents.filter((agent) => agent.enabled);
  const active = new Set(agents.map((agent) => agent.id));
  const aliases = state.identifiers.filter(
    (alias) => alias.enabled && alias.accountId === accountId && active.has(alias.counterpartyId),
  );
  const exact = new Map<string, Set<string>>();
  for (const alias of aliases.filter((alias) => alias.sourceKind === sourceKind)) {
    const kind = alias.identifierKind ?? 'description';
    const key = `${kind}:${comparableCounterpartyIdentifier(alias.value, kind)}`;
    const matches = exact.get(key) ?? new Set<string>();
    matches.add(alias.counterpartyId);
    exact.set(key, matches);
  }
  const identities = agents.map((agent) => ({
    agent,
    names: [
      agent.name,
      ...aliases
        .filter(
          (alias) =>
            alias.counterpartyId === agent.id &&
            (alias.identifierKind ?? 'description') === 'description',
        )
        .map((alias) => alias.value),
    ]
      .filter(meaningful)
      .map(words),
  }));
  const candidateCache = new Map<string, CounterpartyCandidate[]>();
  return {
    identify(description: string, storeId?: string) {
      const matches = new Set<string>();
      if (isSpecificCounterpartyIdentifier(description))
        for (const id of exact.get(
          `description:${comparableCounterpartyIdentifier(description)}`,
        ) ?? [])
          matches.add(id);
      if (storeId && sourceKind === 'settlement')
        for (const id of exact.get(`store_id:${storeId.trim()}`) ?? []) matches.add(id);
      return matches.size === 1 ? [...matches][0] : null;
    },
    candidates(description: string): CounterpartyCandidate[] {
      if (!isSpecificCounterpartyIdentifier(description)) return [];
      const key = comparableCounterpartyIdentifier(description);
      const cached = candidateCache.get(key);
      if (cached) return cached;
      const query = words(description);
      const rank = { name: 0, abbreviation: 1, similar_description: 2 };
      const candidates = identities
        .flatMap(({ agent, names }) => {
          const reasons = names
            .map((name) => resemblance(name, query))
            .filter((reason): reason is CounterpartyCandidate['reason'] => !!reason);
          reasons.sort((a, b) => rank[a] - rank[b]);
          return reasons.length
            ? [{ counterpartyId: agent.id, name: agent.name, reason: reasons[0] }]
            : [];
        })
        .sort(
          (a, b) =>
            rank[a.reason] - rank[b.reason] ||
            a.name.localeCompare(b.name) ||
            a.counterpartyId.localeCompare(b.counterpartyId),
        )
        .slice(0, 3);
      candidateCache.set(key, candidates);
      return candidates;
    },
  };
}
