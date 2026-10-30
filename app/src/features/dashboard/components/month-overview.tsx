import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import type { Dashboard, MonthlyPlan } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function MonthOverview({
  summary,
  plan,
  planState,
  visible,
  link,
}: {
  summary: Dashboard;
  plan?: MonthlyPlan;
  planState: 'pending' | 'error' | 'ready';
  visible: boolean;
  link: (type?: string) => string;
}) {
  const result = summary.income - summary.expense;
  const metrics = [
    {
      title: 'Receitas',
      actual: summary.income,
      planned: plan?.totals.plannedIncome,
      Icon: ArrowDownLeft,
      type: 'income',
      tone: 'positive-text',
    },
    {
      title: 'Despesas',
      actual: summary.expense,
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
      tone: result < 0 ? 'negative-text' : 'positive-text',
    },
  ];
  const display = (value: number) => (visible ? money(value) : '••••••');
  return (
    <>
      <div className="monthly-metrics">
        {metrics.map(({ title, actual, planned, Icon, type, tone }) => {
          const difference =
            planned == null ? null : type === 'expense' ? planned - actual : actual - planned;
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
              <strong className={tone}>{display(actual)}</strong>
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
      <p className="month-result-note">
        {!visible
          ? 'Resultado do mês oculto.'
          : result < 0
            ? `As despesas superaram as receitas em ${money(-result)} neste mês.`
            : result > 0
              ? `As receitas superaram as despesas em ${money(result)} neste mês.`
              : 'Receitas e despesas se equilibraram neste mês.'}{' '}
        O saldo atual também inclui valores anteriores e transferências; ajustes da base não são
        receitas ou despesas.
      </p>
    </>
  );
}
