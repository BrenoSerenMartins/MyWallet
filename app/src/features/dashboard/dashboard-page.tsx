import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, Loading } from '../../shared/ui/primitives';
import { useDashboard } from './hooks/use-dashboard';
import { BalanceOverview } from './components/balance-overview';
import { AccountsOverview } from './components/accounts-overview';
import { QuickActions } from './components/quick-actions';
import { RecentMovements } from './components/recent-movements';
export function DashboardPage() {
  const { session } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [visible, setVisible] = useState(true);
  const { summary, movements } = useDashboard(month);
  const firstName = session?.user.user_metadata?.full_name?.split(' ')[0] ?? 'você';
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU DINHEIRO, COM CLAREZA</span>
          <h1>Um bom dia para cuidar de {firstName}.</h1>
          <p>Seu presente organizado. Seus próximos passos mais perto.</p>
        </div>
        <label className="period-picker">
          <span>Período</span>
          <input
            aria-label="Mês do resumo"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
      </div>
      {summary.isPending ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorState error={summary.error} retry={() => void summary.refetch()} />
      ) : (
        <>
          <BalanceOverview
            summary={summary.data}
            visible={visible}
            onToggle={() => setVisible(!visible)}
          />
          <QuickActions />
          {summary.data.unclassified > 0 && (
            <div className="review-banner">
              <div>
                <strong>
                  {summary.data.unclassified} movimentos precisam de uma categoria financeira
                </strong>
                <p>Revise os movimentos para completar os totais de entradas e saídas.</p>
              </div>
              <Link to="/transactions?type=unclassified">
                Revisar <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <div className="dashboard-lower">
            <RecentMovements
              items={movements.data?.items}
              pending={movements.isPending}
              error={movements.error}
              visible={visible}
            />
            <AccountsOverview accounts={summary.data.accounts} visible={visible} />
          </div>
        </>
      )}
    </div>
  );
}
