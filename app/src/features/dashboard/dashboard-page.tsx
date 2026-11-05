import { MonthPicker } from '../../shared/ui/controls/month-picker';
import { HelpTip } from '../../shared/ui/tooltip';
import { Tooltip } from '../../shared/ui/tooltip';
import { FinanceOverview } from './components/finance-overview';
import { CashflowForecast } from '../planning/components/cashflow-forecast';
import '../planning/commitments.css';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorState, Loading } from '../../shared/ui/primitives';
import { dateToday } from '../../shared/formatting/money';
import { validMonth, shiftMonth } from '../../shared/formatting/month';
import { useDashboard } from './hooks/use-dashboard';
import { BalanceOverview } from './components/balance-overview';
import { RecentMovements } from './components/recent-movements';
import { MonthOverview } from './components/month-overview';
import { HistoryOverview } from './components/history-overview';
import './dashboard.css';
import './overview-editorial.css';
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requestedMonth = params.get('month');
  const month = validMonth(requestedMonth) ? requestedMonth : dateToday().slice(0, 7);
  const setMonth = (value: string) => {
    if (validMonth(value)) {
      const next = new URLSearchParams(params);
      next.delete('view');
      next.set('month', value);
      setParams(next);
    }
  };
  const [visible, setVisible] = useState(true);
  const { snapshot, summary, movements, plan, transactionsLink } = useDashboard(month);
  return (
    <div className="page-enter dashboard-page overview-editorial">
      <h1 className="sr-only">Visão geral</h1>
      <div className="dashboard-overview motion-reveal">
        {snapshot.isPending ? (
          <Loading />
        ) : snapshot.isError ? (
          <ErrorState error={snapshot.error} retry={() => void snapshot.refetch()} />
        ) : (
          <BalanceOverview
            summary={snapshot.data}
            visible={visible}
            onToggle={() => setVisible(!visible)}
          />
        )}
      </div>
      <section className="monthly-analysis" aria-labelledby="monthly-title">
        <div className="monthly-heading">
          <div>
            <h2 id="monthly-title">
              Seu mês
              <HelpTip
                label="Valores do mês"
                text="Receitas e despesas usam a data original dos lançamentos. O planejamento pode atribuir o crédito de VA/VR antecipado ao mês seguinte. Transferências não entram no resultado. O saldo atual também inclui valores anteriores; ajustes da base não são receitas ou despesas."
              />
            </h2>
          </div>
          <div className="month-navigation" role="group" aria-label="Período da visão geral">
            <span className="overview-period-label">Período</span>
            <Tooltip text="Mês anterior">
              <button
                className="icon-button"
                aria-label="Mês anterior"
                disabled={month === '1900-01'}
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft size={18} />
              </button>
            </Tooltip>
            <label className="period-picker">
              <span className="sr-only">Mês da análise</span>
              <MonthPicker
                clearable={false}
                aria-label="Mês da visão geral"
                min="1900-01"
                max="9998-12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <Tooltip text="Próximo mês">
              <button
                className="icon-button"
                aria-label="Próximo mês"
                disabled={month === '9998-12'}
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
        {summary.isPending ? (
          <Loading />
        ) : summary.isError ? (
          <ErrorState error={summary.error} retry={() => void summary.refetch()} />
        ) : (
          <>
            <MonthOverview
              summary={summary.data}
              plan={plan.data}
              planState={plan.isPending ? 'pending' : plan.isError ? 'error' : 'ready'}
              visible={visible}
              link={transactionsLink}
            />
            {summary.data.unclassified > 0 && (
              <div className="review-banner">
                <div>
                  <strong>{summary.data.unclassified} movimentos sem tipo financeiro</strong>
                  <p>
                    Esses valores ainda não entram em receitas e despesas. Movimentos com tipo e sem
                    categoria já entram nos totais.
                  </p>
                </div>
                <Link to={transactionsLink('unclassified')}>
                  Revisar <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
        {plan.isError && (
          <div className="dashboard-plan-link">
            <div className="plan-load-error">
              <span>Não foi possível carregar a previsão.</span>
              <button type="button" className="text-button" onClick={() => void plan.refetch()}>
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </section>
      <RecentMovements
        items={movements.data?.items}
        pending={movements.isPending}
        error={movements.error}
        retry={() => void movements.refetch()}
        visible={visible}
        link={transactionsLink()}
      />
      <HistoryOverview month={month} visible={visible} onMonthChange={setMonth} />
      <details className="overview-finance-details">
        <summary>Cartões, investimentos e patrimônio</summary>
        <div className="dashboard-overview">
          <FinanceOverview visible={visible} />
        </div>
      </details>
      <CashflowForecast visible={visible} compact />
    </div>
  );
}
