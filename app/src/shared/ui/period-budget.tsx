import type { components } from '../api/generated';
import { money } from '../formatting/money';
import { Link } from 'react-router-dom';
import './period-budget.css';
type Budget = components['schemas']['PeriodBudgetDto'];
export function PeriodBudget({
  budget,
  visible = true,
  forecast,
}: {
  budget?: Budget;
  visible?: boolean;
  forecast?: { result: number | null; contribution: number | null };
}) {
  if (!budget) return null;
  const display = (value: number | null) =>
    !visible ? '••••••' : value == null ? 'Não disponível' : money(value);
  const reasons: Record<string, string> = {
    'missing-reference': 'Falta uma referência de saldo para este período.',
    'reference-after-cut': 'A referência disponível é posterior ao início deste período.',
    'reference-under-review': 'A referência de saldo precisa de conferência.',
  };
  return (
    <section className="period-budget" aria-label="Disponível no período">
      <div className="period-budget-head">
        {budget.carried != null || budget.available != null ? (
          <>
            {budget.carried != null && (
              <div>
                <span>Saldo trazido</span>
                <strong>{display(budget.carried)}</strong>
              </div>
            )}
            {budget.available != null && (
              <div>
                <span>Disponível</span>
                <strong>{display(budget.available)}</strong>
              </div>
            )}
          </>
        ) : (
          <span className="period-budget-unavailable">Saldo trazido ainda não disponível</span>
        )}
      </div>
      <details className="period-budget-details">
        <summary>Detalhes</summary>
        <p className="field-help">
          Reservas ficam fora do disponível. Benefícios antecipados entram no mês configurado, sem
          duplicar o saldo trazido.
        </p>
        {budget.coverage !== 'complete' && (
          <p className="field-help">
            Falta uma referência de saldo para completar este período. Confira as contas abaixo.
          </p>
        )}
        {forecast && budget.carried != null && forecast.result != null && (
          <p className="field-help">
            Disponível previsto após poupar:{' '}
            <strong>
              {display(budget.carried + forecast.result - (forecast.contribution ?? 0))}
            </strong>
          </p>
        )}
        <dl className="period-budget-flows">
          {[
            ['Saldo trazido', budget.carried],
            ['Entradas nas contas', budget.income],
            ['Despesas nas contas', -budget.expense],
            ...(budget.transfers ? [['Transferências líquidas', budget.transfers]] : []),
            ...(budget.unclassified ? [['A revisar', budget.unclassified]] : []),
            ...(budget.adjustments ? [['Ajustes de saldo', budget.adjustments]] : []),
            ['Disponível final', budget.available],
          ].map(([label, amount]) => (
            <div key={label as string}>
              <dt>{label}</dt>
              <dd>{display(amount as number | null)}</dd>
            </div>
          ))}
          {!!budget.reserved && (
            <div>
              <dt>Guardado no período (incluído nas transferências)</dt>
              <dd>{display(budget.reserved)}</dd>
            </div>
          )}
        </dl>
        {budget.accounts.map((account) => (
          <details key={account.accountId} className="period-budget-account">
            <summary>{account.name}</summary>
            <dl className="period-budget-flows">
              <div>
                <dt>Saldo bancário na virada</dt>
                <dd>{display(account.openingBankBalance)}</dd>
              </div>
              <div>
                <dt>Créditos antecipados excluídos do saldo trazido</dt>
                <dd>{display(account.deferredOpening)}</dd>
              </div>
              <div>
                <dt>Saldo trazido ajustado</dt>
                <dd>{display(account.carried)}</dd>
              </div>
              <div>
                <dt>Créditos recebidos para períodos futuros</dt>
                <dd>{display(account.deferredClosing)}</dd>
              </div>
              <div>
                <dt>Disponível final</dt>
                <dd>{display(account.available)}</dd>
              </div>
            </dl>
            {account.reason && (
              <p>
                {reasons[account.reason] ?? 'Referência incompleta.'}{' '}
                <Link to={`/accounts/${account.accountId}`}>Conferir conta</Link>
              </p>
            )}
            {account.referenceDate && (
              <p className="field-help">Referência: {account.referenceDate}</p>
            )}
          </details>
        ))}
      </details>
    </section>
  );
}
