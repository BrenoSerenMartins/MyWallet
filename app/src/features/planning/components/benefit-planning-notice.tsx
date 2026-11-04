import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { ApiError, jsonBody, request } from '../../../shared/api/client';
import { shiftMonth } from '../../../shared/formatting/month';
const label = (month: string) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
export function BenefitPlanningNotice({ plan, scope }: { plan: MonthlyPlan; scope: string }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!plan.benefitAccounts?.length || scope === 'cash') return null;
  async function change(account: NonNullable<MonthlyPlan['benefitAccounts']>[number]) {
    setBusy(account.id);
    setError('');
    try {
      await request(`/accounts/${account.id}/benefit-planning-month`, {
        method: 'PATCH',
        headers: { 'If-Match': String(account.version) },
        body: jsonBody({
          benefitCreditMonth: account.benefitCreditMonth === 'following' ? 'received' : 'following',
        }),
      });
      await client.invalidateQueries({
        predicate: (q) => q.queryKey.includes('planning') || q.queryKey.includes('accounts'),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) void client.invalidateQueries();
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar a regra.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="benefit-planning-notice" aria-label="Competência do VA/VR">
      <div>
        <strong>VA/VR no realizado</strong>
        <p className="field-help">
          Se o benefício cai no fim do mês anterior, considere o crédito no mês seguinte. A regra
          vale para o histórico e os próximos meses, mantendo a data do extrato e o saldo.
        </p>
      </div>
      <ul>
        {plan.benefitAccounts.map((a) => (
          <li key={a.id}>
            <div>
              <strong>{a.name}</strong>
              <span>
                {a.benefitCreditMonth === 'following'
                  ? `Créditos de ${label(shiftMonth(plan.month, -1))} entram em ${label(plan.month)}.`
                  : 'Créditos entram no mês em que foram recebidos.'}
              </span>
            </div>
            <button
              className="text-button"
              disabled={!!busy || !navigator.onLine}
              onClick={() => void change(a)}
            >
              {busy === a.id
                ? 'Recalculando…'
                : a.benefitCreditMonth === 'following'
                  ? 'Usar mês do recebimento'
                  : 'Usar no mês seguinte'}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
