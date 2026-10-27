import { useState } from 'react';
import { CounterpartyFields } from '../../counterparties/components/counterparty-fields';
import { Button } from '../../../shared/ui/primitives';
import type { ImportItem } from '../../../shared/api/resources';
type Choice = Pick<
  ImportItem,
  'counterpartyId' | 'counterpartyName' | 'rememberCategory' | 'rememberCounterparty'
>;
export function ImportCounterpartyEditor({
  item,
  accountId,
  sourceKind,
  onReview,
}: {
  item: ImportItem;
  accountId: string;
  sourceKind: string;
  onReview: (item: ImportItem, change: Partial<Choice>) => Promise<void>;
}) {
  const [agent, setAgent] = useState(item.counterpartyName ? 'new' : (item.counterpartyId ?? ''));
  const [name, setName] = useState(item.counterpartyName ?? '');
  const [remember, setRemember] = useState(item.rememberCategory ?? false);
  const [rememberIdentity, setRememberIdentity] = useState(item.rememberCounterparty ?? false);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await onReview(item, {
        counterpartyId: agent === 'new' ? null : agent || null,
        counterpartyName: agent === 'new' ? name : null,
        rememberCategory: remember && !!item.categoryId && !!agent,
        rememberCounterparty: rememberIdentity && !!agent,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <CounterpartyFields
      accountId={accountId}
      sourceKind={sourceKind}
      description={item.description}
      suggestions={item.counterpartySuggestions ?? []}
      rememberIdentity={rememberIdentity}
      onRememberIdentity={setRememberIdentity}
      agent={agent}
      name={name}
      remember={remember}
      category={item.categoryId ?? ''}
      automatic={!!item.classificationRuleId}
      onAgent={setAgent}
      onName={setName}
      onRemember={setRemember}
    >
      <Button
        className="secondary compact"
        disabled={busy || (agent === 'new' && !name.trim())}
        onClick={() => void save()}
      >
        {item.rememberCategory ? 'Atualizar relação' : 'Salvar relação para a confirmação'}
      </Button>
    </CounterpartyFields>
  );
}
