import {
  normalizeCounterpartyIdentifier,
  isSpecificCounterpartyIdentifier,
} from '../../../core/integration/index.js';
import { UnprocessableEntityException } from '@nestjs/common';
import type { BackupPayload } from '../../../core/integration/index.js';
const kinds = ['manual', 'account_statement', 'settlement', 'benefit_statement'];
export function validateCounterpartyBackup(b: BackupPayload, unique: (id: string) => void) {
  const fail = () => {
    throw new UnprocessableEntityException('Os vínculos de agentes do backup estão inválidos.');
  };
  const data = b.counterparties ?? { agents: [], identifiers: [], rules: [] };
  if (
    !data ||
    !Array.isArray(data.agents) ||
    !Array.isArray(data.identifiers) ||
    !Array.isArray(data.rules) ||
    data.agents.length > 10000 ||
    data.identifiers.length > 50000 ||
    data.rules.length > 20000
  )
    fail();
  const agents = new Map(data.agents.map((a) => [a?.id, a])),
    accounts = new Map(b.accounts.map((a) => [a.id, a])),
    categories = new Map(b.categories.map((c) => [c.id, c]));
  for (const a of data.agents) {
    if (
      !a ||
      typeof a.name !== 'string' ||
      !a.name.trim() ||
      a.name.length > 150 ||
      typeof a.enabled !== 'boolean' ||
      !Number.isSafeInteger(a.version) ||
      a.version < 1
    )
      fail();
    unique(a.id);
  }
  const identities = new Set<string>();
  for (const i of data.identifiers) {
    if (
      !i ||
      !agents.has(i.counterpartyId) ||
      !accounts.has(i.accountId) ||
      !kinds.includes(i.sourceKind) ||
      typeof i.enabled !== 'boolean' ||
      typeof i.value !== 'string' ||
      !isSpecificCounterpartyIdentifier(i.value, i.identifierKind) ||
      (i.identifierKind !== undefined && !['description', 'store_id'].includes(i.identifierKind)) ||
      (i.identifierKind === 'store_id' && i.sourceKind !== 'settlement') ||
      !i.value.trim() ||
      i.value.length > 500
    )
      fail();
    unique(i.id);
    const key = JSON.stringify([
      i.accountId,
      i.sourceKind,
      i.identifierKind ?? 'description',
      normalizeCounterpartyIdentifier(i.value, i.identifierKind),
    ]);
    if (identities.has(key)) fail();
    identities.add(key);
  }
  const ruleKeys = new Set<string>();
  for (const r of data.rules) {
    if (
      !r ||
      !agents.has(r.counterpartyId) ||
      !accounts.has(r.accountId) ||
      !['income', 'expense'].includes(r.transactionType) ||
      categories.get(r.categoryId)?.type !== r.transactionType ||
      typeof r.enabled !== 'boolean' ||
      !Number.isSafeInteger(r.version) ||
      r.version < 1
    )
      fail();
    unique(r.id);
    const key = JSON.stringify([r.accountId, r.counterpartyId, r.transactionType]);
    if (ruleKeys.has(key)) fail();
    ruleKeys.add(key);
  }
  const rules = new Map(data.rules.map((r) => [r.id, r]));
  for (const t of b.transactions) {
    if (t.counterpartyId && !agents.has(t.counterpartyId)) fail();
    if (t.sourceKind && !kinds.includes(t.sourceKind)) fail();
    if (t.classificationRuleId) {
      const r = rules.get(t.classificationRuleId);
      if (
        !r ||
        r.counterpartyId !== t.counterpartyId ||
        r.accountId !== t.accountId ||
        r.transactionType !== t.transactionType
      )
        fail();
    }
  }
  return data;
}
