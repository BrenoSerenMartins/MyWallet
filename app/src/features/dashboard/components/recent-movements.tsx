import { Link } from 'react-router-dom';
import { ArrowUpRight, Upload } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../../../shared/ui/primitives';
import type { Transaction } from '../../../shared/api/resources';
import { TransactionRow } from '../../../shared/ui/transaction-row';
export function RecentMovements({
  items,
  pending,
  error,
  visible,
}: {
  items?: Transaction[];
  pending: boolean;
  error: unknown;
  visible: boolean;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Últimos movimentos</h2>
          <p>Os detalhes que fazem parte do seu mês.</p>
        </div>
        <Link className="text-button" to="/transactions">
          Ver todos <ArrowUpRight size={16} />
        </Link>
      </div>
      {pending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : items?.length ? (
        <div className="transaction-list">
          {items.map((t) => (
            <TransactionRow key={t.id} transaction={t} hidden={!visible} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Seu primeiro movimento começa aqui"
          action={
            <Link className="button secondary" to="/imports">
              Importar um extrato <Upload size={16} />
            </Link>
          }
        >
          Importe seu extrato ou registre um lançamento para acompanhar seu mês.
        </EmptyState>
      )}
    </section>
  );
}
