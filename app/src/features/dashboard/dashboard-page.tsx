import { MonthPicker } from '../../shared/ui/controls/month-picker';
import { ActionMenu } from '../../shared/ui/action-menu';
import { HelpTip } from '../../shared/ui/tooltip';
import { Tooltip } from '../../shared/ui/tooltip';
import { ViewSwitcher } from '../../shared/ui/view-switcher';
import { PageHeader } from '../../shared/ui/page-header';
import { FinanceOverview } from './components/finance-overview';
import { CashflowForecast } from '../planning/components/cashflow-forecast';
import '../planning/commitments.css';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ChevronLeft, ChevronRight, Upload, Plus } from 'lucide-react';
import { ErrorState, Loading } from '../../shared/ui/primitives';
import { dateToday } from '../../shared/formatting/money';
import { validMonth, shiftMonth } from '../../shared/formatting/month';
import { useDashboard } from './hooks/use-dashboard';
import { BalanceOverview } from './components/balance-overview';
import { RecentMovements } from './components/recent-movements';
import { MonthOverview } from './components/month-overview';
import { HistoryOverview } from './components/history-overview';
import { ExpenseGroups } from './components/expense-groups';
import './dashboard.css';
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'analysis' ? 'analysis' : 'summary';
  const requestedMonth = params.get('month');
  const month = validMonth(requestedMonth) ? requestedMonth : dateToday().slice(0, 7);
  const setMonth = (value: string) => {
    if (validMonth(value)) {
      const next = new URLSearchParams(params);
      next.set('month', value);
      setParams(next);
    }
  };
  const [visible, setVisible] = useState(true);
  const { snapshot, summary, movements, plan, transactionsLink } = useDashboard(month);
  return (
    <div className="page-enter dashboard-page">
      <PageHeader
        title="Visão geral"
        navigation={
          <ViewSwitcher
            variant="tabs"
            label="Conteúdo da visão geral"
            value={view}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'summary') next.delete('view');
              else next.set('view', value);
              setParams(next);
            }}
            options={[
              { value: 'summary', label: 'Resumo' },
              { value: 'analysis', label: 'Análise' },
            ]}
          />
        }
      >
        {view === 'analysis' && (
          <Tooltip text={visible ? 'Ocultar valores' : 'Mostrar valores'}>
            <button
              className="icon-button"
              aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </Tooltip>
        )}
        <Link className="button compact" to="/imports">
          <Upload size={16} />
          Importar extrato
        </Link>
        <ActionMenu label="Mais ações da visão geral">
          <Link to="/transactions?new=1">
            <Plus size={16} />
            Novo lançamento
          </Link>
          <Link to={`/planning?month=${month}`}>Planejar este mês</Link>
        </ActionMenu>
      </PageHeader>
      <div className="dashboard-overview motion-reveal" hidden={view !== 'summary'}>
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
        <FinanceOverview visible={visible} />
      </div>
      {view === 'summary' && <CashflowForecast visible={visible} compact />}
      <section className="monthly-analysis" aria-labelledby="monthly-title">
        <div className="monthly-heading">
          <div>
            <h2 id="monthly-title">
              Seu mês
              <HelpTip
                label="Valores do mês"
                text="Receitas e despesas usam a data original dos lançamentos. O planejamento pode atribuir o crédito de VA/VR antecipado ao mês seguinte. Transferências não entram no resultado."
              />
            </h2>
          </div>
          <div className="month-navigation">
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
                aria-label="Mês do resumo"
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
        {view === 'analysis' && (
          <HistoryOverview month={month} visible={visible} onMonthChange={setMonth} />
        )}
        <div key={view} className="dashboard-detail-area motion-reveal">
          {view === 'summary' && (
            <RecentMovements
              items={movements.data?.items}
              pending={movements.isPending}
              error={movements.error}
              retry={() => void movements.refetch()}
              visible={visible}
              link={transactionsLink()}
            />
          )}
          {view === 'analysis' && !summary.isPending && !summary.isError && (
            <ExpenseGroups
              groups={summary.data.expenseGroups ?? []}
              categories={summary.data.expenseCategories ?? []}
              visible={visible}
              link={transactionsLink('expense')}
            />
          )}
        </div>
      </section>
    </div>
  );
}
