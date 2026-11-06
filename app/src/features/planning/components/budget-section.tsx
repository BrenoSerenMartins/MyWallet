import { money } from '../../../shared/formatting/money';
import { Link } from 'react-router-dom';
import type { PlanningLine } from '../../../shared/api/resources';
import { planningGroupTotals } from '../group-totals';
import { BudgetLine } from './budget-line';
const groupKey = (line: PlanningLine) =>
  line.categoryId === null ? 'uncategorized' : (line.groupId ?? 'ungrouped');
export function BudgetSection({
  type,
  lines,
}: {
  type: 'income' | 'expense';
  lines: PlanningLine[];
}) {
  const visibleLines = lines.filter(
    (line) =>
      !line.archived ||
      line.actual !== 0 ||
      line.transactionCount > 0 ||
      (line.planned !== null && line.planned !== 0),
  );
  return (
    <section className={`panel budget-section budget-${type}`}>
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
      {!visibleLines.length ? (
        <div className="planning-empty">
          Crie categorias de {type === 'income' ? 'receita' : 'despesa'} para organizar seu plano.{' '}
          <Link to="/categories">Gerenciar categorias</Link>
        </div>
      ) : (
        <div className="budget-lines" role="list">
          {[...new Set(visibleLines.map(groupKey))].map((id) => {
            const children = visibleLines.filter((line) => groupKey(line) === id);
            const totals = planningGroupTotals(children, type);
            return (
              <details
                className="budget-group"
                key={id}
                open={['uncategorized', 'ungrouped'].includes(id) || undefined}
              >
                <summary>
                  <span className="budget-group-identity">
                    <strong>{children[0].groupName ?? 'Sem grupo'}</strong>
                    <small>
                      {children.length} {children.length === 1 ? 'categoria' : 'categorias'}
                      {totals.missing > 0 ? ` · ${totals.missing} sem previsão` : ''}
                    </small>
                  </span>
                  <span className="budget-group-totals" role="group" aria-label="Totais do grupo">
                    <span className="budget-group-metric">
                      <span>
                        {totals.missing > 0 && totals.planned !== null
                          ? 'Previsto (parcial)'
                          : 'Previsto'}
                      </span>
                      <strong>
                        {totals.planned === null ? 'Não definido' : money(totals.planned)}
                      </strong>
                    </span>
                    <span className="budget-group-metric">
                      <span>Realizado</span>
                      <strong>{money(totals.actual)}</strong>
                    </span>
                    <span className="budget-group-metric">
                      <span>{type === 'income' ? 'Acima / abaixo' : 'Disponível / excedido'}</span>
                      <strong
                        className={
                          totals.difference !== null && totals.difference < 0
                            ? 'negative-text'
                            : undefined
                        }
                      >
                        {totals.difference === null ? '—' : money(totals.difference)}
                      </strong>
                    </span>
                  </span>
                </summary>
                <div className="budget-group-content">
                  {children.map((line) => (
                    <BudgetLine key={line.categoryId ?? 'uncategorized'} line={line} type={type} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
