import { ArrowUpRight } from 'lucide-react';
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
        <span>
          Dívida dos cartões <ArrowUpRight size={14} aria-hidden="true" />
        </span>
        <strong>{query.isPending ? '…' : value(query.data.cardDebt)}</strong>
        <small>Faturas e parcelas</small>
      </Link>
      <Link className="panel" to="/wealth">
        <span>
          Investimentos informados <ArrowUpRight size={14} aria-hidden="true" />
        </span>
        <strong>{query.isPending ? '…' : value(query.data.investments)}</strong>
        <small>Avaliações manuais</small>
      </Link>
      <Link className="panel" to="/wealth?view=history">
        <span>
          Patrimônio registrado <ArrowUpRight size={14} aria-hidden="true" />
        </span>
        <strong>{query.isPending ? '…' : value(query.data.netWorth)}</strong>
        <small>Ativos menos dívidas</small>
      </Link>
    </section>
  );
}
