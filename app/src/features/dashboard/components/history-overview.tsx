import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ErrorState, Loading } from '../../../shared/ui/primitives';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { dateToday, money } from '../../../shared/formatting/money';
import { useDashboardHistory } from '../hooks/use-dashboard-history';
import { HistoryChart, historyMonthLabel } from './history-chart';
import '../history.css';
export function HistoryOverview({
  month,
  visible,
  onMonthChange,
}: {
  month: string;
  visible: boolean;
  onMonthChange: (month: string) => void;
}) {
  const [months, setMonths] = useState('4');
  const [mode, setMode] = useState<'bars' | 'lines'>('bars');
  const [selected, setSelected] = useState(month);
  const history = useDashboardHistory(month, months);
  const items = history.data?.items ?? [];
  const current = items.at(-1),
    previous = items.at(-2);
  const detail = items.find((item) => item.month === selected) ?? current;
  const metrics =
    current && previous
      ? [
          { label: 'Receitas', value: current.income, previous: previous.income, expense: false },
          { label: 'Despesas', value: current.expense, previous: previous.expense, expense: true },
        ]
      : [];
  return (
    <section className="panel history-overview" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <h2 id="history-title">Evolução mensal</h2>
          <p>Receitas e despesas de todas as contas. O período termina no mês da análise.</p>
        </div>
        <div className="history-controls">
          <ViewSwitcher
            label="Intervalo do comparativo"
            value={months}
            onChange={setMonths}
            options={[
              { value: '2', label: '2 meses' },
              { value: '4', label: '4 meses' },
              { value: '7', label: '7 meses' },
              { value: '12', label: '12 meses' },
            ]}
          />
          <ViewSwitcher
            label="Formato do gráfico"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'bars', label: 'Barras' },
              { value: 'lines', label: 'Linhas' },
            ]}
          />
        </div>
      </div>
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <ErrorState error={history.error} retry={() => void history.refetch()} />
      ) : !visible ? (
        <p className="history-hidden">
          Valores e gráficos ocultos. Use “Mostrar valores” para consultar o comparativo.
        </p>
      ) : (
        <>
          {current && previous && (
            <>
              <p className="history-comparison-caption">
                {historyMonthLabel(current.month)} em comparação com{' '}
                {historyMonthLabel(previous.month)}
              </p>
              <div className="history-comparisons">
                {metrics.map((metric) => {
                  const difference = metric.value - metric.previous;
                  const percent =
                    metric.previous > 0 && metric.value >= 0
                      ? (Math.abs(difference) / metric.previous) * 100
                      : null;
                  return (
                    <article key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{money(metric.value)}</strong>
                      <small>Anterior: {money(metric.previous)}</small>
                      <p
                        className={
                          difference === 0
                            ? ''
                            : (metric.expense ? difference < 0 : difference > 0)
                              ? 'positive-text'
                              : 'negative-text'
                        }
                      >
                        {difference === 0
                          ? 'Sem variação'
                          : `${money(Math.abs(difference))} a ${difference > 0 ? 'mais' : 'menos'}${percent === null ? '' : ` (${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(percent)}%)`}`}
                      </p>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {month === dateToday().slice(0, 7) && (
            <p className="history-period-note">
              Mês atual em andamento: os valores podem mudar com novos lançamentos. O mês anterior é
              comparado por inteiro.
            </p>
          )}
          {items.some((item) => item.unclassified > 0) && (
            <p className="history-period-note">
              Há movimentos sem tipo financeiro neste período; eles ainda não entram nas receitas e
              despesas.
            </p>
          )}
          {items.some((item) => item.count > 0) ? (
            <>
              <div className="history-legend">
                <span className="income">Receitas</span>
                <span className="expense">Despesas</span>
              </div>
              <HistoryChart
                items={items}
                mode={mode}
                selected={detail?.month ?? month}
                onSelect={setSelected}
              />
              {detail && (
                <div className="history-selection" aria-live="polite">
                  <strong>{historyMonthLabel(detail.month)}</strong>
                  <span>
                    Receitas <b className="positive-text">{money(detail.income)}</b>
                  </span>
                  <span>
                    Despesas <b className="negative-text">{money(detail.expense)}</b>
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onMonthChange(detail.month)}
                  >
                    Abrir mês <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="history-hidden">Nenhuma receita ou despesa registrada neste período.</p>
          )}
          <details className="history-table-details">
            <summary>Ver valores mês a mês</summary>
            <div
              className="history-table-scroll"
              role="region"
              aria-label="Tabela do comparativo mensal"
              tabIndex={0}
            >
              <table>
                <caption>
                  Valores registrados por mês. Meses sem movimentos na base aparecem com zero.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col">Receitas</th>
                    <th scope="col">Despesas</th>
                    <th scope="col">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.month}>
                      <th scope="row">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onMonthChange(item.month)}
                        >
                          {historyMonthLabel(item.month)}
                        </button>
                      </th>
                      <td>{money(item.income)}</td>
                      <td>{money(item.expense)}</td>
                      <td>{money(item.income - item.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="history-footnote">
            Apenas lançamentos registrados, incluindo os sem categoria. Transferências e ajustes de
            saldo ficam fora; devoluções reduzem o valor na data em que foram registradas.
          </p>
        </>
      )}
    </section>
  );
}
