import { useState } from 'react';
import { ViewSwitcher } from '../../../shared/ui/view-switcher';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Dashboard } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function ExpenseGroups({
  groups,
  categories,
  visible,
  link,
}: {
  groups: Dashboard['expenseGroups'];
  categories: Dashboard['expenseCategories'];
  visible: boolean;
  link: string;
}) {
  const [view, setView] = useState<'groups' | 'categories'>('groups');
  const items =
    view === 'groups'
      ? groups.map((group) => ({ ...group, id: group.groupId, context: null }))
      : categories.map((category) => ({
          ...category,
          id: category.categoryId,
          context: category.groupName,
        }));
  const max = Math.max(1, ...items.map((item) => Math.abs(item.amount)));
  const rows = (entries: typeof items) =>
    entries.map((item) => (
      <div className="expense-group" key={item.id ?? 'uncategorized'}>
        <div>
          <span>
            {item.name}
            <small>
              {item.context ? `${item.context} · ` : ''}
              {item.count} {item.count === 1 ? 'movimento' : 'movimentos'}
            </small>
          </span>
          <strong>{visible ? money(item.amount) : '••••••'}</strong>
        </div>
        {visible && (
          <div className="expense-group-track" aria-hidden="true">
            <span
              style={{
                width: `${(Math.abs(item.amount) / max) * 100}%`,
                background: item.amount < 0 ? 'var(--positive)' : 'var(--negative)',
              }}
            />
          </div>
        )}
      </div>
    ));
  return (
    <section className="panel expense-groups">
      <div className="section-heading">
        <div>
          <h2>Onde você gastou</h2>
          <p>Inclui gastos sem categoria em Outros.</p>
        </div>
        <Link to={link} className="text-button" aria-label="Ver despesas do mês">
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="expense-breakdown-controls">
        <ViewSwitcher
          label="Organização das despesas"
          value={view}
          onChange={setView}
          options={[
            { value: 'groups', label: 'Grupos' },
            { value: 'categories', label: 'Categorias' },
          ]}
        />
      </div>
      {items.length ? (
        <>
          <div className="expense-group-list">{rows(items.slice(0, 5))}</div>
          {items.length > 5 && (
            <details className="more-expense-groups">
              <summary>
                Ver mais {items.length - 5} {view === 'groups' ? 'grupos' : 'categorias'}
              </summary>
              <div className="expense-group-list">{rows(items.slice(5))}</div>
            </details>
          )}
          <p className="field-help group-footnote">
            Devoluções reduzem os gastos na data em que foram registradas.
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
