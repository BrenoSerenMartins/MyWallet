import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Upload } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../../../shared/ui/primitives';
import type { Transaction } from '../../../shared/api/resources';
import { TransactionRow } from '../../../shared/ui/transaction-row';
export function RecentMovements({
  items,
  pending,
  error,
  visible,
  link,
  retry,
}: {
  items?: Transaction[];
  pending: boolean;
  error: unknown;
  visible: boolean;
  link: string;
  retry: () => void;
}) {
  const navigate = useNavigate();
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Últimos movimentos</h2>
          <p>Movimentos mais recentes do período selecionado.</p>
        </div>
        <Link className="text-button" to={link}>
          Ver todos <ArrowUpRight size={16} />
        </Link>
      </div>
      {pending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : items?.length ? (
        <div className="transaction-list">
          {items.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              hidden={!visible}
              onClick={() => navigate(`${link}&transaction=${t.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum movimento neste mês"
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
