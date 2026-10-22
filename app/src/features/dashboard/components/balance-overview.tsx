import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Wallet } from 'lucide-react';
import type { Dashboard } from '../../../shared/api/resources';
import { money } from '../../../shared/formatting/money';
export function BalanceOverview({
  summary,
  visible,
  onToggle,
}: {
  summary: Dashboard;
  visible: boolean;
  onToggle: () => void;
}) {
  const amount = (value: number) => (visible ? money(value) : '••••••');
  return (
    <section className="overview-grid">
      <div className="balance-hero">
        <div className="hero-orbits" aria-hidden="true" />
        <div className="hero-label">
          <span>
            <span className="status-dot" /> SALDO NAS SUAS CONTAS
          </span>
          <button
            className="icon-button"
            aria-label={visible ? 'Ocultar valores' : 'Mostrar valores'}
            onClick={onToggle}
          >
            {visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
        <div className="hero-balance">{amount(summary.balance)}</div>
        <p className="hero-caption">
          Visão das contas cadastradas <span>BRL</span>
        </p>
        <div className="hero-divider" />
        <div className="hero-bottom">
          <span>
            <Wallet size={16} />
            {summary.accounts.length} contas no seu controle
          </span>
          <Link to="/accounts">
            Ver minhas contas <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="month-summary">
        <div className="summary-item">
          <span className="metric-icon positive">
            <ArrowDownLeft size={21} />
          </span>
          <div>
            <span>Entradas do mês</span>
            <strong>{amount(summary.income)}</strong>
          </div>
        </div>
        <div className="summary-line" />
        <div className="summary-item">
          <span className="metric-icon negative">
            <ArrowUpRight size={21} />
          </span>
          <div>
            <span>Saídas do mês</span>
            <strong>{amount(summary.expense)}</strong>
          </div>
        </div>
        <div className="summary-foot">
          <span>Resultado do período</span>
          <strong
            className={summary.income - summary.expense >= 0 ? 'positive-text' : 'negative-text'}
          >
            {amount(summary.income - summary.expense)}
          </strong>
        </div>
      </div>
    </section>
  );
}
