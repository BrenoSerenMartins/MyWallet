import { useEffect, useRef, useState } from 'react';
import type { DashboardHistory } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
type Month = DashboardHistory['items'][number];
export const historyMonthLabel = (month: string, short = false) =>
  new Intl.DateTimeFormat('pt-BR', {
    month: short ? 'short' : 'long',
    year: short ? '2-digit' : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-01T12:00:00Z'));
const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});
export function HistoryChart({
  items,
  mode,
  selected,
  onSelect,
}: {
  items: Month[];
  mode: 'bars' | 'lines';
  selected: string;
  onSelect: (month: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) =>
      setContainerWidth(entries[0].contentRect.width),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(containerWidth, items.length * 46 + 76);
  const height = 260,
    left = 68,
    right = 16,
    top = 20,
    bottom = 38;
  const plotHeight = height - top - bottom;
  const values = items.flatMap((item) => [item.income, item.expense]);
  const maximum = Math.max(0, ...values) || 100;
  const minimum = Math.min(0, ...values);
  const max = maximum * 1.12,
    min = minimum * 1.12;
  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const step = (width - left - right) / items.length;
  const x = (index: number) => left + step * (index + 0.5);
  const barWidth = Math.min(20, step * 0.28);
  return (
    <div className="history-chart-scroll" ref={ref}>
      <svg
        className="history-chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width }}
        role="group"
        aria-label={
          mode === 'bars'
            ? 'Receitas e despesas mensais em barras'
            : 'Receitas e despesas mensais em linhas'
        }
      >
        {Array.from({ length: 5 }, (_, index) => max - ((max - min) * index) / 4).map(
          (value, index) => (
            <g key={index} aria-hidden="true">
              <line
                className="history-gridline"
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
              />
              <text x={left - 10} y={y(value) + 4} textAnchor="end">
                {compactMoney.format(value / 100)}
              </text>
            </g>
          ),
        )}
        <line
          className="history-baseline"
          x1={left}
          x2={width - right}
          y1={y(0)}
          y2={y(0)}
          aria-hidden="true"
        />
        {mode === 'lines' &&
          (['income', 'expense'] as const).map((type) => (
            <polyline
              key={type}
              className={`history-series ${type}`}
              points={items.map((item, index) => `${x(index)},${y(item[type])}`).join(' ')}
              fill="none"
              strokeWidth="2.5"
              strokeDasharray={type === 'expense' ? '6 4' : undefined}
              aria-hidden="true"
            />
          ))}
        {items.map((item, index) => (
          <g
            key={item.month}
            role="button"
            tabIndex={0}
            aria-pressed={selected === item.month}
            aria-label={`${historyMonthLabel(item.month)}. Receitas ${money(item.income)}. Despesas ${money(item.expense)}. Selecionar mês.`}
            onClick={() => onSelect(item.month)}
            onFocus={() => onSelect(item.month)}
            onMouseEnter={() => onSelect(item.month)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item.month);
              }
            }}
          >
            <rect
              className={`history-month-hit ${selected === item.month ? 'selected' : ''}`}
              x={left + step * index + 2}
              y={top}
              width={step - 4}
              height={plotHeight}
              rx={6}
            />
            {(['income', 'expense'] as const).map((type, seriesIndex) =>
              mode === 'bars' ? (
                <rect
                  key={type}
                  className={`history-series ${type}`}
                  x={x(index) + (seriesIndex === 0 ? -barWidth - 2 : 2)}
                  y={Math.min(y(0), y(item[type]))}
                  width={barWidth}
                  height={Math.abs(y(item[type]) - y(0))}
                  rx={3}
                  aria-hidden="true"
                />
              ) : (
                <circle
                  key={type}
                  className={`history-series ${type}`}
                  cx={x(index)}
                  cy={y(item[type])}
                  r={selected === item.month ? 5 : 3.5}
                  aria-hidden="true"
                />
              ),
            )}
            <text x={x(index)} y={height - 12} textAnchor="middle" aria-hidden="true">
              {historyMonthLabel(item.month, true).replace(' de ', '/').replace('.', '')}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
