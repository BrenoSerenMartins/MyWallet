import { Link } from 'react-router-dom';
import type { MonthlyPlan } from '../../../shared/api/resources';
import { money, shortDate } from '../../../shared/formatting/money';

export function PlanningCardBills({ plan }: { plan: MonthlyPlan }) {
  const bills = (plan.cardBills ?? []).filter((b) => b.included);
  if (!bills.length) return null;
  const planned = bills.reduce((n, b) => n + b.planned, 0);
  const paid = bills.reduce((n, b) => n + b.paid, 0);
  const remaining = bills.reduce((n, b) => n + b.remaining, 0);
  const metrics = (expected: number, settled: number, balance: number) => (
    <>
      <span className="budget-group-metric">
        <span>Previsto</span>
        <strong>{money(expected)}</strong>
      </span>
      <span className="budget-group-metric">
        <span>Pago</span>
        <strong>{money(settled)}</strong>
      </span>
      <span className="budget-group-metric">
        <span>Falta pagar</span>
        <strong>{money(balance)}</strong>
      </span>
    </>
  );
  return (
    <section className="budget-section planning-invoice-section">
      <div className="section-heading">
        <div>
          <h2>Cartões e faturas</h2>
          <p>
            Selecionados para este mês. Os pagamentos entram aqui; as compras detalhadas ficam em
            Cartões.
          </p>
        </div>
      </div>
      <details className="budget-group" open>
        <summary>
          <span className="budget-group-identity">
            <strong>Faturas do mês</strong>
            <small>
              {bills.length} {bills.length === 1 ? 'fatura' : 'faturas'}
            </small>
          </span>
          <span className="budget-group-totals">{metrics(planned, paid, remaining)}</span>
        </summary>
        <div className="budget-group-content">
          {bills.map((bill) => (
            <article className="budget-line" key={`${bill.accountId}:${bill.billMonth}`}>
              <div className="budget-identity">
                <div>
                  <strong>{bill.name}</strong>
                  <small>
                    {bill.billMonth} · vence {shortDate(bill.dueDate)}
                    {bill.automatic ? ' · previsão automática' : ' · previsão manual'}
                  </small>
                  <Link
                    className="text-button"
                    to={`/cards?card=${bill.cardId}&month=${bill.billMonth}${bill.remaining > 0 ? '&action=pay' : ''}`}
                  >
                    {bill.remaining > 0 ? 'Registrar ou vincular pagamento' : 'Ver fatura'}
                  </Link>
                </div>
              </div>
              <dl>
                {[
                  ['Previsto', bill.planned],
                  ['Pago', bill.paid],
                  ['Falta pagar', bill.remaining],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{money(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
