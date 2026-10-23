import { ArrowDownLeft, ArrowUpRight, PiggyBank, Scale } from 'lucide-react';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
const display = (value: number | null) => (value === null ? 'Não definido' : money(value));
export function PlanningSummary({ plan }: { plan: MonthlyPlan }) {
  const { totals: t } = plan;
  const metrics = [
    {
      label: 'Receitas do mês',
      Icon: ArrowDownLeft,
      planned: t.plannedIncome,
      actual: t.actualIncome,
      difference: t.incomeDifference,
      kind: 'income',
    },
    {
      label: 'Orçamento de despesas',
      Icon: ArrowUpRight,
      planned: t.plannedExpense,
      actual: t.actualExpense,
      difference: t.expenseDifference,
      kind: 'expense',
    },
    {
      label: 'Resultado do mês',
      Icon: Scale,
      planned: t.plannedResult,
      actual: t.actualResult,
      difference: t.resultDifference,
      kind: 'result',
    },
  ];
  return (
    <section className="planning-metrics" aria-label="Resumo do planejamento">
      {metrics.map(({ label, Icon, planned, actual, difference, kind }) => (
        <article className="panel planning-metric comparison-metric" key={kind} aria-label={label}>
          <span>
            <Icon size={17} />
            {label}
          </span>
          <dl className="planning-comparison">
            <div>
              <dt>Previsto</dt>
              <dd>{display(planned)}</dd>
            </div>
            <div>
              <dt>Realizado</dt>
              <dd>{money(actual)}</dd>
            </div>
          </dl>
          <p
            className={`planning-difference ${difference == null ? '' : difference < 0 ? 'negative-text' : difference > 0 ? 'positive-text' : ''}`}
          >
            {difference == null
              ? 'Sem previsão para comparar'
              : difference === 0
                ? 'Dentro do previsto'
                : kind === 'expense'
                  ? `${money(Math.abs(difference))} ${difference < 0 ? 'acima do orçamento' : 'disponíveis no orçamento'}`
                  : `${money(Math.abs(difference))} ${difference < 0 ? 'abaixo' : 'acima'} do previsto`}
          </p>
        </article>
      ))}
      <article className="panel planning-metric comparison-metric" aria-label="Aporte planejado">
        <span>
          <PiggyBank size={17} />
          Aporte planejado
        </span>
        <dl className="planning-comparison">
          <div>
            <dt>Previsto</dt>
            <dd>{display(plan.contribution)}</dd>
          </div>
          <div>
            <dt>Realizado</dt>
            <dd className="planning-unavailable">Não identificado</dd>
          </div>
        </dl>
        <p>Resultado previsto após aporte: {display(t.afterContribution)}</p>
      </article>
    </section>
  );
}
