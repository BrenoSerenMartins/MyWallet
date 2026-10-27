import '../counterparties.css';
import { useEffect, useState, type ReactNode } from 'react';
import { CounterpartySuggestions } from './counterparty-suggestions';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request, jsonBody } from '../../../shared/api/client';
import type { Counterparty, CounterpartyCandidate } from '../../../shared/api/resources';
export function CounterpartyFields({
  accountId,
  description,
  sourceKind = 'manual',
  suggestions,
  rememberIdentity,
  onRememberIdentity,
  agent,
  name,
  remember,
  category,
  automatic,
  onAgent,
  onName,
  onRemember,
  children,
}: {
  accountId: string;
  description: string;
  sourceKind?: string;
  suggestions?: CounterpartyCandidate[];
  rememberIdentity: boolean;
  onRememberIdentity: (value: boolean) => void;
  agent: string;
  name: string;
  remember: boolean;
  category: string;
  automatic: boolean;
  children?: ReactNode;
  onAgent: (value: string) => void;
  onName: (value: string) => void;
  onRemember: (value: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => request<Counterparty[]>('/counterparties'),
  });
  const [debounced, setDebounced] = useState(description);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(description), 350);
    return () => clearTimeout(timer);
  }, [description]);
  const candidates = useQuery({
    queryKey: ['counterparty-suggestions', accountId, sourceKind, debounced],
    queryFn: () =>
      request<CounterpartyCandidate[]>('/counterparties/suggestions', {
        method: 'POST',
        body: jsonBody({ accountId, sourceKind, value: debounced }),
      }),
    enabled:
      suggestions === undefined &&
      !!accountId &&
      !agent &&
      debounced.trim().length >= 3 &&
      sourceKind !== 'settlement',
    retry: false,
    staleTime: 30000,
  });
  const visibleCandidates =
    suggestions ?? (debounced === description ? (candidates.data ?? []) : []);
  return (
    <>
      {!agent && (
        <CounterpartySuggestions
          candidates={visibleCandidates}
          onSelect={(id) => {
            onAgent(id);
            onRememberIdentity(true);
          }}
        />
      )}
      <details className="secondary-disclosure" open={!!agent || automatic || undefined}>
        <summary>Pessoa ou estabelecimento {automatic ? '· categoria automática' : ''}</summary>
        <div className="form-stack">
          <label>
            Pessoa ou estabelecimento
            <select
              value={agent}
              onChange={(e) => {
                onAgent(e.target.value);
                if (!e.target.value) onRememberIdentity(false);
              }}
              disabled={query.isPending || query.isError}
            >
              <option value="">Reconhecer automaticamente quando possível</option>
              {(query.data ?? [])
                .filter((a) => a.enabled || a.id === agent)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.enabled ? '' : ' (desativado)'}
                  </option>
                ))}
              <option value="new">Criar pessoa ou estabelecimento</option>
            </select>
          </label>
          {agent === 'new' && (
            <label>
              Nome da pessoa ou estabelecimento
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => onName(e.target.value)}
                placeholder="Supermercado ABC"
              />
            </label>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberIdentity}
              disabled={!agent || sourceKind === 'settlement'}
              onChange={(event) => onRememberIdentity(event.target.checked)}
            />
            Reconhecer esta descrição no histórico e nos próximos movimentos desta conta
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              disabled={!category || !agent}
              onChange={(e) => onRemember(e.target.checked)}
            />
            Usar esta categoria para esta pessoa ou estabelecimento neste tipo de movimento
          </label>
          <p className="field-help">
            O vínculo será salvo junto com o lançamento ou a confirmação do extrato. A identidade
            vale para receitas e despesas; a regra de categoria é separada por tipo. Escolhas
            manuais são preservadas.{' '}
            <Link to="/counterparties">Gerenciar pessoas e estabelecimentos</Link>
          </p>
          {children}
          {query.isError && (
            <p className="form-error">
              Não foi possível carregar as pessoas e estabelecimentos. Você pode salvar o lançamento
              sem criar uma regra.
            </p>
          )}
        </div>
      </details>
    </>
  );
}
