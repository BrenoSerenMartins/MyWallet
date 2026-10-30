import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account, BalanceHistory } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { money } from '../../../shared/formatting/money';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
const labels: Record<string, string> = {
  manual: 'Conferência manual',
  statement: 'Base identificada no extrato',
  rebase: 'Histórico recalculado',
  undo: 'Correção desfeita',
  legacy_conversion: 'Correções antigas preservadas',
};
export function BalanceHistoryPanel({
  account,
  onChanged,
}: {
  account: Account;
  onChanged: () => void;
}) {
  const history = useQuery({
    queryKey: ['balance-history', account.id],
    queryFn: () => request<BalanceHistory[]>(`/accounts/${account.id}/balance-history`),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function undo(id: string) {
    if (
      !window.confirm(
        'Desfazer esta correção e restaurar a referência anterior? Seus movimentos financeiros serão preservados.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/accounts/${account.id}/balance-adjustments/${id}/reversals`, {
        method: 'POST',
        headers: { 'If-Match': String(account.version) },
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desfazer.');
    } finally {
      setBusy(false);
    }
  }
  if (history.isPending) return <Loading />;
  if (history.isError) return <ErrorState error={history.error} />;
  return (
    <div className="form-stack">
      <p>
        As correções ajustam o saldo base. Elas ficam neste histórico, separadas de receitas,
        despesas e transferências.
      </p>
      {!history.data.length && <p>Nenhuma alteração do saldo base registrada.</p>}
      {history.data.map((event) => (
        <article className="panel" key={event.id}>
          <strong>{labels[event.operation] ?? event.operation}</strong>
          <p>{event.reason}</p>
          <small>{new Date(event.createdAt).toLocaleString('pt-BR')}</small>
          <p>
            Base anterior: {money(event.previousBase)} · nova base: {money(event.newBase)}
          </p>
          {typeof event.details.targetBalance === 'number' && (
            <p>Saldo conferido: {money(event.details.targetBalance)}</p>
          )}
          {event.operation === 'manual' && account.balanceBasis?.originId === event.id && (
            <Button className="secondary" disabled={busy} onClick={() => void undo(event.id)}>
              Desfazer correção
            </Button>
          )}
          {event.operation === 'legacy_conversion' &&
            Array.isArray(event.details.legacyCorrections) && (
              <details>
                <summary>Ver correções anteriores</summary>
                {event.details.legacyCorrections.map((row: any) => (
                  <p key={row.id}>
                    {row.date} · {money(Number(row.amount))} · {row.adjustment?.reason}
                  </p>
                ))}
              </details>
            )}
        </article>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
