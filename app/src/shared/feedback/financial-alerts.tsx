import { useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../api/client';
import { getRequestWorkspace } from '../api/workspace-selection';
import { useFinanceWrite } from '../api/use-finance-write';
import { FinanceForm } from '../ui/finance-forms';
import { ErrorState, Loading } from '../ui/primitives';
import type { components } from '../api/generated';
type Summary = components['schemas']['AlertsSummaryDto'];
type Preferences = components['schemas']['AlertPreferencesDto'];
function subscribe(fn: () => void) {
  window.addEventListener('plannedwallet:workspace-changed', fn);
  return () => window.removeEventListener('plannedwallet:workspace-changed', fn);
}
export function useFinancialAlerts() {
  const workspace = useSyncExternalStore(subscribe, getRequestWorkspace, () => null);
  return useQuery({
    queryKey: ['financial-alerts', workspace],
    queryFn: () => request<Summary>('/alerts/sync', { method: 'POST' }),
    enabled: !!workspace,
    staleTime: 60000,
    retry: false,
  });
}
export function FinancialAlerts({
  query,
  onClose,
}: {
  query: ReturnType<typeof useFinancialAlerts>;
  onClose: () => void;
}) {
  const write = useFinanceWrite(),
    client = useQueryClient(),
    [error, setError] = useState('');
  if (!getRequestWorkspace()) return null;
  async function action(id: string, kind: string) {
    setError('');
    try {
      await write(`/alerts/${id}`, { action: kind }, undefined, 'PATCH');
      await client.invalidateQueries({ queryKey: ['financial-alerts'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar o aviso.');
    }
  }
  return (
    <section className="persistent-alerts">
      <h3>Alertas financeiros</h3>
      <p className="field-help">
        Atualizados ao consultar o sistema e após alterações. Preferências e dispensas ficam salvas
        para você neste espaço.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <ol className="notification-history">
            {query.data.items.map((a) => (
              <li key={a.id}>
                <div>
                  <p>{a.title}</p>
                  <Link className="text-button" to={a.href} onClick={onClose}>
                    Ver detalhes
                  </Link>
                  <div className="inline-actions">
                    {!a.readAt && (
                      <button className="text-button" onClick={() => void action(a.id, 'read')}>
                        Marcar como lido
                      </button>
                    )}
                    <button className="text-button" onClick={() => void action(a.id, 'dismiss')}>
                      Dispensar alerta
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {!query.data.items.length && (
            <p className="field-help">Nenhum alerta financeiro ativo.</p>
          )}
          <details>
            <summary>Preferências de alertas</summary>
            <AlertPreferences
              key={JSON.stringify(query.data.preferences)}
              initial={query.data.preferences}
            />
          </details>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function AlertPreferences({ initial }: { initial: Preferences }) {
  const [p, setP] = useState(initial),
    write = useFinanceWrite();
  return (
    <FinanceForm
      label="Salvar preferências"
      onSubmit={async () => {
        await write('/alerts/preferences', p, undefined, 'PUT');
      }}
    >
      {(
        [
          ['bills', 'Faturas próximas ou vencidas'],
          ['budgets', 'Limite do orçamento'],
          ['negativeBalance', 'Previsão de saldo negativo'],
          ['goals', 'Metas com prazo ou cobertura insuficiente'],
        ] as const
      ).map(([key, label]) => (
        <label className="check-row" key={key}>
          <input
            type="checkbox"
            checked={p[key]}
            onChange={(e) => setP({ ...p, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <label>
        Avisar antes do vencimento (dias)
        <input
          type="number"
          min={0}
          max={30}
          value={p.dueDays}
          onChange={(e) => setP({ ...p, dueDays: Number(e.target.value) })}
        />
      </label>
      <label>
        Alertar ao atingir o orçamento (%)
        <input
          type="number"
          min={1}
          max={100}
          value={p.budgetPercent}
          onChange={(e) => setP({ ...p, budgetPercent: Number(e.target.value) })}
        />
      </label>
    </FinanceForm>
  );
}
