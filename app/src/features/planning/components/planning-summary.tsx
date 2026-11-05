import type { ReactNode } from 'react';
import { HelpTip } from '../../../shared/ui/tooltip';
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Scale } from 'lucide-react';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
const display = (value: number | null) => (value === null ? 'Não definido' : money(value));
export function PlanningSummary({
  plan,
  navigation,
  actions,
}: {
  plan: MonthlyPlan;
  navigation?: ReactNode;
  actions?: ReactNode;
}) {
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
      {actions && (
        <div className="summary-action-bar">
          <span>Seu orçamento</span>
          <div>{actions}</div>
        </div>
      )}
      {metrics.map(({ label, Icon, planned, actual, difference, kind }) => (
        <article
          className={`panel planning-metric comparison-metric metric-${kind}`}
          key={kind}
          aria-label={label}
        >
          <span>
            <Icon size={17} />
            <span className="planning-metric-title">
              <span className="planning-title-full">{label}</span>
              <span className="planning-title-short">
                {kind === 'income' ? 'Receitas' : kind === 'expense' ? 'Despesas' : label}
              </span>
            </span>
            <HelpTip
              label={label}
              text={
                kind === 'result'
                  ? 'Receitas menos despesas do mês. Esse resultado não é o saldo atual das contas e não inclui transferências.'
                  : kind === 'expense'
                    ? 'Compara o orçamento com as despesas registradas, incluindo gastos sem categoria em Outros.'
                    : 'Compara as receitas previstas com as registradas. O VA/VR segue a configuração de mês de cada conta.'
              }
            />
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
          {kind !== 'result' && planned !== null && planned > 0 && (
            <div
              className="planning-meter"
              role="img"
              aria-label={`${label}: ${Math.round((actual / planned) * 100)}% do previsto`}
            >
              <span style={{ width: `${Math.min(100, Math.max(0, (actual / planned) * 100))}%` }} />
            </div>
          )}
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
      <article
        className="panel planning-metric comparison-metric metric-contribution"
        aria-label="Aporte planejado"
      >
        <span>
          <PiggyBank size={17} />
          Aporte planejado
          <HelpTip
            label="Aporte planejado"
            text="É o valor que você pretende reservar ou investir. O realizado ainda não é identificado automaticamente nesta comparação."
          />
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
      {navigation && <div className="summary-navigation">{navigation}</div>}
    </section>
  );
}
