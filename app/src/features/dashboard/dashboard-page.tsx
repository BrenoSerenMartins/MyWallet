import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { ErrorState, Loading } from '../../shared/ui/primitives';
import { dateToday } from '../../shared/formatting/money';
import { validMonth, shiftMonth } from '../../shared/formatting/month';
import { useDashboard } from './hooks/use-dashboard';
import { BalanceOverview } from './components/balance-overview';
import { RecentMovements } from './components/recent-movements';
import { MonthOverview } from './components/month-overview';
import { ExpenseGroups } from './components/expense-groups';
import './dashboard.css';
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requestedMonth = params.get('month');
  const month = validMonth(requestedMonth) ? requestedMonth : dateToday().slice(0, 7);
  const setMonth = (value: string) => {
    if (validMonth(value)) setParams({ month: value });
  };
  const [visible, setVisible] = useState(true);
  const { snapshot, summary, movements, plan, transactionsLink } = useDashboard(month);
  return (
    <div className="page-enter dashboard-page">
      <div className="dashboard-heading">
        <h1>Visão geral</h1>
        <Link className="button secondary compact" to="/imports">
          <Upload size={16} />
          Importar extrato
        </Link>
      </div>
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
      <section className="monthly-analysis" aria-labelledby="monthly-title">
        <div className="monthly-heading">
          <div>
            <h2 id="monthly-title">Seu mês</h2>
            <p>
              Todas as contas, incluindo benefícios e reservas. Transferências ficam fora do
              resultado.
            </p>
          </div>
          <div className="month-navigation">
            <button
              className="icon-button"
              aria-label="Mês anterior"
              disabled={month === '1900-01'}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <label className="period-picker">
              <span>Mês da análise</span>
              <input
                aria-label="Mês do resumo"
                type="month"
                min="1900-01"
                max="9998-12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <button
              className="icon-button"
              aria-label="Próximo mês"
              disabled={month === '9998-12'}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} />
            </button>
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
        <div className="dashboard-plan-link">
          <Link className="text-button" to={`/planning?month=${month}`}>
            {plan.data?.version ? 'Abrir planejamento deste mês' : 'Planejar este mês'}
            <ArrowRight size={16} />
          </Link>
          {plan.isPending && <span role="status">Carregando previsão…</span>}
          {plan.isError && (
            <div className="plan-load-error">
              <span>Não foi possível carregar a previsão.</span>
              <button type="button" className="text-button" onClick={() => void plan.refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>
        <div className="dashboard-lower">
          <RecentMovements
            items={movements.data?.items}
            pending={movements.isPending}
            error={movements.error}
            retry={() => void movements.refetch()}
            visible={visible}
            link={transactionsLink()}
          />
          {!summary.isPending && !summary.isError && (
            <ExpenseGroups
              groups={summary.data.expenseGroups ?? []}
              visible={visible}
              link={transactionsLink('expense')}
            />
          )}
        </div>
      </section>
    </div>
  );
}
