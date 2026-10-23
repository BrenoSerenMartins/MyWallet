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
      value: display(t.plannedIncome),
      caption: `Recebido: ${money(t.actualIncome)}`,
    },
    {
      label: 'Orçamento de despesas',
      Icon: ArrowUpRight,
      value: display(t.plannedExpense),
      caption: `Realizado: ${money(t.actualExpense)}`,
    },
    {
      label: 'Resultado previsto',
      Icon: Scale,
      value: display(t.plannedResult),
      caption: `Resultado registrado: ${money(t.actualResult)}`,
    },
    {
      label: 'Após aporte planejado',
      Icon: PiggyBank,
      value: display(t.afterContribution),
      caption: `Aporte previsto: ${display(plan.contribution)}`,
    },
  ];
  return (
    <section className="planning-metrics" aria-label="Resumo do planejamento">
      {metrics.map(({ label, Icon, value, caption }) => (
        <article className="panel planning-metric" key={label}>
          <span>
            <Icon size={17} />
            {label}
          </span>
          <strong>{value}</strong>
          <p>{caption}</p>
        </article>
      ))}
    </section>
  );
}
