import { Link } from 'react-router-dom';
import type { PlanningLine } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
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
          {lines.map((line) => {
            const difference = line.difference;
            return (
              <article
                className="budget-line"
                role="listitem"
                key={line.categoryId ?? 'uncategorized'}
              >
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
          })}
        </div>
      )}
    </section>
  );
}
