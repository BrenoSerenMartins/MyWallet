import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { request } from '../../../shared/api/client';
import { money } from '../../../shared/formatting/money';
import { Button, ErrorState, Loading } from '../../../shared/ui/primitives';
export function CopyPlanDialog({
  plan,
  onCopy,
  onCopied,
}: {
  plan: MonthlyPlan;
  onCopy: (version: number, sourceVersion: number) => Promise<void>;
  onCopied: () => void;
}) {
  const [year, month] = plan.month.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const source = useQuery({
    queryKey: ['planning', previous],
    queryFn: () => request<MonthlyPlan>(`/planning/${previous}`),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (source.isPending) return <Loading />;
  if (source.isError)
    return <ErrorState error={source.error} retry={() => void source.refetch()} />;
  if (!source.data.version)
    return (
      <p>Nenhum planejamento salvo em {previous}. Escolha esse mês e prepare seu primeiro plano.</p>
    );
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onCopy(plan.version, source.data!.version);
      onCopied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível copiar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-stack">
      <p>
        Copiar os valores previstos de <strong>{previous}</strong> para{' '}
        <strong>{plan.month}</strong>?
      </p>
      <ul className="copy-plan-summary">
        {source.data.lines
          .filter((l) => l.planned !== null)
          .map((l) => (
            <li key={l.categoryId}>
              {l.name}
              <strong>{money(l.planned!)}</strong>
            </li>
          ))}
        <li>
          Aporte planejado
          <strong>
            {source.data.contribution === null ? 'Não definido' : money(source.data.contribution)}
          </strong>
        </li>
      </ul>
      <p className="field-help">
        {plan.version ? 'Os valores previstos deste mês serão substituídos. ' : ''}Lançamentos e
        notas atuais serão preservados. Nenhuma movimentação será criada.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy || !navigator.onLine} onClick={() => void confirm()}>
        {busy ? 'Copiando…' : 'Confirmar cópia do planejamento'}
      </Button>
    </div>
  );
}
