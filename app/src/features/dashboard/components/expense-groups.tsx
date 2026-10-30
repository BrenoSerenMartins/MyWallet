import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Dashboard } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function ExpenseGroups({
  groups,
  visible,
  link,
}: {
  groups: Dashboard['expenseGroups'];
  visible: boolean;
  link: string;
}) {
  const max = Math.max(1, ...groups.map((g) => Math.abs(g.amount)));
  const rows = (items: typeof groups) =>
    items.map((group) => (
      <div className="expense-group" key={group.groupId ?? 'uncategorized'}>
        <div>
          <span>
            {group.name}
            <small>
              {group.count} {group.count === 1 ? 'movimento' : 'movimentos'}
            </small>
          </span>
          <strong>{visible ? money(group.amount) : '••••••'}</strong>
        </div>
        {visible && (
          <div className="expense-group-track" aria-hidden="true">
            <span style={{ width: `${(Math.abs(group.amount) / max) * 100}%` }} />
          </div>
        )}
      </div>
    ));
  return (
    <section className="panel expense-groups">
      <div className="section-heading">
        <div>
          <h2>Despesas por grupo</h2>
          <p>Inclui gastos sem categoria em Outros.</p>
        </div>
        <Link to={link} className="text-button" aria-label="Ver despesas do mês">
          <ArrowUpRight size={18} />
        </Link>
      </div>
      {groups.length ? (
        <>
          <div className="expense-group-list">{rows(groups.slice(0, 5))}</div>
          {groups.length > 5 && (
            <details className="more-expense-groups">
              <summary>Ver mais {groups.length - 5} grupos</summary>
              <div className="expense-group-list">{rows(groups.slice(5))}</div>
            </details>
          )}
          <p className="field-help group-footnote">
            Devoluções reduzem os gastos do grupo na data em que foram registradas.
          </p>
        </>
      ) : (
        <div className="small-empty">
          <p>Nenhuma despesa registrada neste mês.</p>
        </div>
      )}
    </section>
  );
}
