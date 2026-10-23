import { Link } from 'react-router-dom';
import type { PlanningLine } from '../../../shared/api/resources';
import { BudgetLine } from './budget-line';
export function BudgetSection({
  type,
  lines,
}: {
  type: 'income' | 'expense';
  lines: PlanningLine[];
}) {
  return (
    <section className="panel budget-section">
      <div className="section-heading">
        <div>
          <h2>{type === 'income' ? 'Receitas previstas' : 'Orçamento de despesas'}</h2>
          <p>
            {type === 'income'
              ? 'Fontes de renda e valores recebidos.'
              : 'O que você planejou e o que já foi registrado.'}
          </p>
        </div>
      </div>
      {!lines.length ? (
        <div className="planning-empty">
          Crie categorias de {type === 'income' ? 'receita' : 'despesa'} para organizar seu plano.{' '}
          <Link to="/settings/categories">Gerenciar categorias</Link>
        </div>
      ) : (
        <div className="budget-lines" role="list">
          {[...new Set(lines.map((line) => line.groupId ?? ''))].map((id) => {
            const children = lines.filter((line) => (line.groupId ?? '') === id);
            return (
              <details className="budget-group" key={id} open={!id || undefined}>
                <summary>
                  {children[0].groupName ?? 'Sem grupo'}
                  <span>{children.length} categorias</span>
                </summary>
                {children.map((line) => (
                  <BudgetLine key={line.categoryId ?? 'uncategorized'} line={line} type={type} />
                ))}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
