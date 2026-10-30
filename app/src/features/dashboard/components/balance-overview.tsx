import { Link } from 'react-router-dom';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { Dashboard } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
import { AccountsOverview } from './accounts-overview';
export function BalanceOverview({
  summary,
  visible,
  onToggle,
}: {
  summary: Dashboard;
  visible: boolean;
  onToggle: () => void;
}) {
  const cashAccounts = summary.accounts.filter(
    (a) => !['benefit_food', 'benefit_meal', 'reserve'].includes(a.type),
  );
  const partial = cashAccounts.some((a) => a.balanceBasis?.kind === 'unknown');
  const review = cashAccounts.some((a) => a.balanceBasis?.reviewRequired);
  const amount = (value: number) => (visible ? money(value) : '••••••');
  return (
    <section className="current-balances panel" aria-label="Saldos atuais">
      <div className="balance-topline">
        <h2>Saldos atuais</h2>
        <button
          className="icon-button"
          aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
          onClick={onToggle}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      <div className="balance-snapshot">
        <div className="available-balance">
          <span>{partial || review ? 'Saldo registrado nas contas' : 'Dinheiro disponível'}</span>
          <strong className="hero-balance">{amount(summary.balance)}</strong>
          <small>Sem benefícios e reservas</small>
        </div>
        {summary.accounts.some((a) => ['benefit_food', 'benefit_meal'].includes(a.type)) && (
          <div>
            <span>Benefícios</span>
            <strong>{amount(summary.benefitBalance)}</strong>
            <small>Alimentação e refeição · uso restrito</small>
          </div>
        )}
        {summary.accounts.some((a) => a.type === 'reserve') && (
          <div>
            <span>Reservas</span>
            <strong>{amount(summary.reserveBalance)}</strong>
            <small>Contas de reserva cadastradas</small>
          </div>
        )}
      </div>
      {(partial || review) && (
        <p className="balance-warning">
          {review
            ? 'Há saldos que precisam de conferência.'
            : 'Algumas contas têm histórico parcial.'}{' '}
          <Link to="/accounts">Conferir contas</Link>
        </p>
      )}
      <details className="balance-composition">
        <summary>
          <span>
            Composição por conta <span className="badge">{summary.accounts.length}</span>
          </span>
          <ChevronDown size={17} />
        </summary>
        <p className="field-help">
          Saldos calculados pelos dados cadastrados. Não mudam ao selecionar outro mês abaixo.
        </p>
        <AccountsOverview accounts={summary.accounts} visible={visible} />
      </details>
    </section>
  );
}
