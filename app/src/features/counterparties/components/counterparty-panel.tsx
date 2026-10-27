import { CounterpartyRelationForm } from './counterparty-relation-form';
import { ClassificationRuleEditor } from './classification-rule-editor';
import { useState } from 'react';
import type { Account, Category, Counterparty } from '../../../shared/api/resources';
import { Button } from '../../../shared/ui/primitives';
export function CounterpartyPanel({
  agent,
  accounts,
  categories,
  busy,
  rename,
  toggle,
  toggleRule,
  removeIdentifier,
  relate,
}: {
  agent: Counterparty;
  accounts: Account[];
  categories: Category[];
  busy: boolean;
  rename: (name: string) => void;
  toggle: () => void;
  toggleRule: (id: string, enabled: boolean, version: number, categoryId?: string) => void;
  relate: (value: unknown) => Promise<void>;
  removeIdentifier: (id: string) => void;
}) {
  const [name, setName] = useState(agent.name);
  const sources: Record<string, string> = {
    manual: 'Manual',
    account_statement: 'Extrato',
    settlement: 'EDI antigo',
    benefit_statement: 'Benefício',
  };
  return (
    <details className="panel counterparty-panel">
      <summary>
        <strong>{agent.name}</strong>
        <span>
          {agent.enabled ? 'Ativo' : 'Desativado'} · {agent.rules.filter((r) => r.enabled).length}{' '}
          regras ativas
        </span>
      </summary>
      <div className="form-stack">
        <div className="form-grid">
          <label>
            Nome do agente
            <input maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="form-actions">
            <Button
              className="secondary compact"
              disabled={busy || !name.trim() || name === agent.name}
              onClick={() => rename(name)}
            >
              Salvar nome
            </Button>
            <Button className="secondary compact" disabled={busy} onClick={toggle}>
              {agent.enabled ? 'Desativar agente' : 'Ativar agente'}
            </Button>
          </div>
        </div>
        {agent.enabled && (
          <CounterpartyRelationForm
            accounts={accounts}
            categories={categories}
            busy={busy}
            onSave={relate}
          />
        )}
        <div>
          <h3>Regras de categoria</h3>
          {!agent.rules.length && (
            <p className="field-help">
              Ao categorizar um lançamento, marque a opção de lembrar para criar uma regra.
            </p>
          )}
          {agent.rules.map((rule) => (
            <div className="counterparty-rule" key={rule.id}>
              <span>
                <strong>
                  {categories.find((c) => c.id === rule.categoryId)?.name ?? 'Categoria arquivada'}
                </strong>
                <small>
                  {accounts.find((a) => a.id === rule.accountId)?.name ?? 'Conta'} ·{' '}
                  {rule.transactionType === 'expense' ? 'Despesas' : 'Receitas'}
                </small>
              </span>
              <ClassificationRuleEditor
                key={`${rule.id}-${rule.version}`}
                rule={rule}
                categories={categories}
                busy={busy}
                onChange={(enabled, categoryId) =>
                  toggleRule(rule.id, enabled, rule.version, categoryId)
                }
              />
            </div>
          ))}
        </div>
        <div>
          <h3>Identificações por origem</h3>
          <p className="field-help">
            Nomes, descrições e IDs de loja vinculados por você ou por uma operação já conciliada.
            Remover uma identificação afeta apenas o reconhecimento futuro.
          </p>
          {agent.identifiers.map((identifier) => (
            <div className="counterparty-rule" key={identifier.id}>
              <span>
                <strong>{identifier.value}</strong>
                <small>
                  {identifier.identifierKind === 'store_id' ? 'ID da loja · ' : ''}
                  {identifier.enabled
                    ? sources[identifier.sourceKind]
                    : 'Reconhecimento desativado'}{' '}
                  · {accounts.find((a) => a.id === identifier.accountId)?.name ?? 'Conta'}
                </small>
              </span>
              <Button
                className="secondary compact"
                disabled={busy || !identifier.enabled}
                onClick={() => removeIdentifier(identifier.id)}
              >
                Remover identificação
              </Button>
            </div>
          ))}
          {!agent.identifiers.length && <p className="field-help">Nenhuma identificação salva.</p>}
        </div>
      </div>
    </details>
  );
}
