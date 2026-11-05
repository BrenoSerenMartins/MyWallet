import { Select } from '../../../shared/ui/controls/select';
import { EmptyState } from '../../../shared/ui/primitives';
import { ChartNoAxesCombined as EmptyIcon } from 'lucide-react';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ErrorState, Loading } from '../../../shared/ui/primitives';
import { HelpTip, Tooltip } from '../../../shared/ui/tooltip';
import { ChartColumn, ChartLine } from 'lucide-react';
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
          <h2>
            <span id="history-title">Evolução mensal</span>
            <HelpTip
              label="Sobre a evolução mensal"
              text={`O intervalo termina no mês selecionado na visão geral. Apenas lançamentos registrados entram no gráfico; transferências e ajustes de saldo ficam fora.${month === dateToday().slice(0, 7) ? ' O mês atual está em andamento; o mês anterior é comparado por inteiro.' : ''}${items.some((item) => item.unclassified > 0) ? ' Há movimentos sem tipo financeiro que ainda não entram nas receitas e despesas.' : ''}`}
            />
          </h2>
        </div>
        <div className="history-controls">
          <label className="history-range-select">
            <span className="sr-only">Intervalo do comparativo</span>
            <Select
              aria-label="Intervalo do comparativo"
              value={months}
              onChange={(event) => setMonths(event.target.value)}
            >
              <option value="2">2 meses</option>
              <option value="4">4 meses</option>
              <option value="7">7 meses</option>
              <option value="12">12 meses</option>
            </Select>
          </label>
          <Tooltip text={mode === 'bars' ? 'Trocar para linhas' : 'Trocar para barras'}>
            <button
              type="button"
              className="icon-button history-mode-toggle"
              aria-label={mode === 'bars' ? 'Trocar para linhas' : 'Trocar para barras'}
              onClick={() => setMode(mode === 'bars' ? 'lines' : 'bars')}
            >
              {mode === 'bars' ? <ChartColumn size={18} /> : <ChartLine size={18} />}
            </button>
          </Tooltip>
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
            <EmptyState compact icon={<EmptyIcon size={26} />} title="Sem movimentos neste período">
              Escolha outro período para comparar receitas e despesas.
            </EmptyState>
          )}
          {current && previous && (
            <details className="history-comparison-details">
              <summary>Comparar meses</summary>
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
            </details>
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
        </>
      )}
    </section>
  );
}
