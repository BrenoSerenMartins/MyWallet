import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { request } from '../../../shared/api/client';
import type { WealthTotals } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { ErrorState } from '../../../shared/ui/primitives';
import '../../cards/cards.css';
export function FinanceOverview({ visible }: { visible: boolean }) {
  const query = useQuery({
    queryKey: ['wealth-overview'],
    queryFn: () => request<WealthTotals>('/wealth/overview'),
  });
  const value = (n: number) => (visible ? money(n) : '••••••');
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  return (
    <section className="finance-overview-links" aria-label="Cartões e patrimônio">
      <Link className="panel" to="/cards">
        <span>Dívida dos cartões</span>
        <strong>{query.isPending ? '…' : value(query.data.cardDebt)}</strong>
        <small>Faturas e parcelas · ver cartões</small>
      </Link>
      <Link className="panel" to="/wealth">
        <span>Investimentos informados</span>
        <strong>{query.isPending ? '…' : value(query.data.investments)}</strong>
        <small>Avaliações manuais · ver carteira</small>
      </Link>
      <Link className="panel" to="/wealth?view=history">
        <span>Patrimônio registrado</span>
        <strong>{query.isPending ? '…' : value(query.data.netWorth)}</strong>
        <small>Ativos menos dívidas · ver composição</small>
      </Link>
    </section>
  );
}
