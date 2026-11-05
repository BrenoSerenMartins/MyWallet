import { PeriodBudget } from '../../../shared/ui/period-budget';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function MonthOverview({
  plan,
  planState,
  visible,
  link,
}: {
  plan?: MonthlyPlan;
  planState: 'pending' | 'error' | 'ready';
  visible: boolean;
  link: (type?: string) => string;
}) {
  const totals = planState === 'ready' ? plan?.totals : undefined;
  const result = totals?.actualResult;
  const metrics = [
    {
      title: 'Receitas',
      actual: totals?.actualIncome,
      planned: plan?.totals.plannedIncome,
      Icon: ArrowDownLeft,
      type: 'income',
      tone: 'positive-text',
    },
    {
      title: 'Despesas',
      actual: totals?.actualExpense,
      planned: plan?.totals.plannedExpense,
      Icon: ArrowUpRight,
      type: 'expense',
      tone: 'negative-text',
    },
    {
      title: 'Resultado do mês',
      actual: result,
      planned: plan?.totals.plannedResult,
      Icon: Scale,
      type: '',
      tone: (result ?? 0) < 0 ? 'negative-text' : 'positive-text',
    },
  ];
  const display = (value: number) => (visible ? money(value) : '••••••');
  return (
    <>
      <PeriodBudget
        budget={plan?.budget}
        visible={visible}
        forecast={
          plan ? { result: plan.totals.plannedResult, contribution: plan.contribution } : undefined
        }
      />
      <div className="monthly-metrics">
        {metrics.map(({ title, actual, planned, Icon, type, tone }) => {
          const difference =
            planned == null || actual == null
              ? null
              : type === 'expense'
                ? planned - actual
                : actual - planned;
          return (
            <Link
              className={`panel month-metric ${type || 'result'}`}
              key={title}
              to={link(type || undefined)}
              aria-label={
                type ? `Ver ${title.toLowerCase()} do período` : 'Ver movimentos do período'
              }
            >
              <span className="month-metric-label">
                <Icon size={18} />
                {title}
                <ArrowUpRight size={15} />
              </span>
              <strong className={tone}>
                {planState === 'pending'
                  ? 'Carregando…'
                  : actual == null
                    ? 'Indisponível'
                    : display(actual)}
              </strong>
              <dl>
                <div>
                  <dt>Previsto</dt>
                  <dd>
                    {planState === 'pending'
                      ? 'Carregando…'
                      : planState === 'error'
                        ? 'Indisponível'
                        : planned == null
                          ? 'Não definido'
                          : display(planned)}
                  </dd>
                </div>
              </dl>
              <p
                className={
                  difference == null ? '' : difference < 0 ? 'negative-text' : 'positive-text'
                }
              >
                {planState === 'pending'
                  ? 'Buscando planejamento'
                  : planState === 'error'
                    ? 'Previsão indisponível'
                    : difference == null
                      ? 'Sem previsão para comparar'
                      : !visible
                        ? 'Comparação oculta'
                        : difference === 0
                          ? 'Dentro do previsto'
                          : `${display(Math.abs(difference))} ${type === 'expense' ? (difference < 0 ? 'acima do orçamento' : 'disponíveis no orçamento') : difference < 0 ? 'abaixo do previsto' : 'acima do previsto'}`}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
