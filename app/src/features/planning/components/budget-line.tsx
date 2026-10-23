import type { PlanningLine } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function BudgetLine({ line, type }: { line: PlanningLine; type: 'income' | 'expense' }) {
  const difference = line.difference;
  return (
    <article className="budget-line" role="listitem" key={line.categoryId ?? 'uncategorized'}>
      <div className="budget-identity">
        <span style={{ background: line.color }} />
        <div>
          <strong>{line.name}</strong>
          <small>
            {line.archived ? 'Arquivada · ' : ''}
            {line.transactionCount} lançamentos
          </small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Previsto</dt>
          <dd>{line.planned === null ? 'Não definido' : money(line.planned)}</dd>
        </div>
        <div>
          <dt>Realizado</dt>
          <dd>{money(line.actual)}</dd>
        </div>
        <div>
          <dt>{type === 'income' ? 'Acima / abaixo' : 'Disponível / excedido'}</dt>
          <dd className={difference !== null && difference < 0 ? 'negative-text' : ''}>
            {difference === null ? '—' : money(difference)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
