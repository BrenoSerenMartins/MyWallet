import { useState } from 'react';
import type { WealthSummary } from '../../../shared/api/resources';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { money, shortDate, dateToday } from '../../../shared/formatting/money';
export function WealthHistory({
  history,
  visible,
}: {
  history: WealthSummary['history'];
  visible: boolean;
}) {
  const [range, setRange] = useState('12');
  const cutoff = new Date(`${dateToday()}T12:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - Number(range));
  const seen = new Set<string>();
  const points = history
    .filter((h) => {
      const date = h.data.asOf;
      if (date < cutoff.toISOString().slice(0, 10) || seen.has(date)) return false;
      seen.add(date);
      return true;
    })
    .reverse();
  const values = points.map((p) => p.data.netWorth);
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? 300 : 40 + (i * 520) / (points.length - 1));
  const y = (value: number) => 170 - ((value - min) * 140) / span;
  return (
    <section className="panel wealth-history">
      <div className="section-heading">
        <h2>Evolução registrada</h2>
        <ViewSwitcher
          label="Período da evolução patrimonial"
          value={range}
          onChange={setRange}
          options={[
            { value: '4', label: '4 meses' },
            { value: '7', label: '7 meses' },
            { value: '12', label: '12 meses' },
          ]}
        />
      </div>
      {!points.length ? (
        <p>
          Guarde a posição atual para começar sua linha do tempo. O histórico será formado pelos
          registros que você salvar.
        </p>
      ) : !visible ? (
        <p className="wealth-hidden-chart">Valores ocultos</p>
      ) : (
        <>
          <svg
            viewBox="0 0 600 205"
            className="wealth-chart"
            role="img"
            aria-label="Evolução do patrimônio nas posições salvas"
          >
            <line x1="40" x2="560" y1={y(0)} y2={y(0)} stroke="var(--border)" />
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinejoin="round"
              points={points.map((p, i) => `${x(i)},${y(p.data.netWorth)}`).join(' ')}
            />
            {points.map((p, i) => (
              <circle key={p.id} cx={x(i)} cy={y(p.data.netWorth)} r="4" fill="var(--accent)">
                <title>
                  {shortDate(p.data.asOf)}: {money(p.data.netWorth)}
                </title>
              </circle>
            ))}
          </svg>
          <div className="wealth-chart-labels">
            <span>
              {shortDate(points[0].data.asOf)}
              <strong>{money(points[0].data.netWorth)}</strong>
            </span>
            <span>
              {shortDate(points.at(-1)!.data.asOf)}
              <strong>{money(points.at(-1)!.data.netWorth)}</strong>
            </span>
          </div>
        </>
      )}
      <p className="field-help">
        Os pontos representam posições salvas, usando os valores conhecidos naquela data. O gráfico
        não reconstrói meses anteriores nem atualiza avaliações antigas automaticamente.
      </p>
      {points.length > 0 && (
        <details className="finance-disclosure">
          <summary>Ver valores das posições</summary>
          <div className="wealth-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Ativos</th>
                  <th>Dívidas</th>
                  <th>Patrimônio</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {shortDate(p.data.asOf)} {p.data.asOf.slice(0, 4)}
                    </td>
                    <td>{visible ? money(p.data.assets) : '••••••'}</td>
                    <td>{visible ? money(p.data.liabilities) : '••••••'}</td>
                    <td>{visible ? money(p.data.netWorth) : '••••••'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
